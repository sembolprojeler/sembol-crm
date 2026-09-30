// api/qr-site.js
// ============================================================================
// Sembol CRM — QR SİTE TAKİP: HERKESE AÇIK SAYFANIN (WORDPRESS) TEK KAPISI
// ----------------------------------------------------------------------------
// Asansör afişindeki QR artık sembolevdeneve.com/sembol-nakliyat-pro/?yer=<id>
// sayfasını açar. O sayfa Firestore'a HİÇ bağlanmaz; yalnızca bu uçla konuşur.
// Yazmalar Admin SDK ile yapılır (firestore.rules'a takılmaz).
//
// GET  /api/qr-site?id=<qrSiteler id>
//   → 200 { ok, site:{ id, ad, tur, adres, ilce, il, bloklar, temsilciAd, temsilciTel, aktif } }
//   → 404 { ok:false, hata:'yok' }   (notlar, temsilciId, olusturan*, taramaSayisi GİZLİ)
//
// POST (Content-Type: text/plain — CORS ön-kontrolü olmasın diye; gövde JSON metni)
//   { islem:'tarama',   id }                       → her durumda 200 { ok:true }
//   { islem:'talep',    id, tur, adSoyad, telefon, hizmet, blok, kat, daire,
//                       randevuTarihi, randevuSaati, mesaj, website(honeypot) }
//                                                  → 200 { ok:true, talepId, anahtar }
//   { islem:'iletisim', talepId, anahtar, alan }   → her durumda 200 { ok:true } (sendBeacon)
//
// Talep belgesi, eski QrSiteLanding'in (Satis.jsx) yazdığıyla BİREBİR aynı
// alanlarla yazılır; ek olarak kaynak:'wordpress' ve iletisimAnahtari. Anahtar
// yalnızca talebi gönderen tarayıcıya döner — "Hemen Ara / WhatsApp" işaretini
// başkası düşüremesin diye.
//
// Sabitler ve telefon kuralı: src/qrSiteSema.js (CRM ile ortak).
// Ortam değişkenleri: submit-lead.js ile AYNI (ek kurulum gerekmez).
// ============================================================================
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { QR_SIRKET_TELEFONU, QR_HIZMETLER, QR_RANDEVU_SAATLERI, qrTelefonNormalize, qrTelefonGecerliMi } from '../src/qrSiteSema.js';

// Bu uç yalnızca Sembol sitesine açıktır (ALLOWED_ORIGINS ortam değişkeninden bağımsız)
const QR_SITE_ORIGINS = ['https://www.sembolevdeneve.com', 'https://sembolevdeneve.com'];
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;

const KIMLIK_DESENI = /^[A-Za-z0-9_-]{1,64}$/;   // qrSiteler / qrSiteTalepleri belge id'si
const ANAHTAR_DESENI = /^[0-9a-f]{32}$/;          // randomBytes(16).toString('hex')
const MUKERRER_PENCERE_MS = 2 * 60 * 1000;        // aynı site + telefon: 2 dk içinde tek talep
const RANDEVU_EN_FAZLA_GUN = 90;
const ILETISIM_ALANLARI = ['temsilciyiAradi', 'whatsappYazdi'];

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  // İzinsiz origin'e başlık eklenmez → tarayıcı yanıtı sayfaya vermez
  if (origin && QR_SITE_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}
function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }) });
  }
  return getFirestore();
}
const veriKoku = (db) => db.collection('artifacts').doc(FIRESTORE_APP_ID).collection('public').doc('data');
const qrSiteRef = (db, id) => veriKoku(db).collection('qrSiteler').doc(id);
const qrTalepKoleksiyonu = (db) => veriKoku(db).collection('qrSiteTalepleri');

function hataDon(res, kod, hata) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(kod).json({ ok: false, hata });
}
const metin = (v) => (v === undefined || v === null ? '' : String(v)).trim();

// "Bugün" Türkiye saatine göre (sunucu UTC'de çalışır) → "YYYY-MM-DD"
function istanbulBugun() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function gunEkle(ymd, gun) {
  const [y, a, g] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, a - 1, g + gun)).toISOString().slice(0, 10);
}
// Takvimde gerçekten var olan tarih mi? (2026-02-30 gibi değerleri eler)
function gecerliTarihMi(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, a, g] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g));
  return d.getUTCFullYear() === y && d.getUTCMonth() === a - 1 && d.getUTCDate() === g;
}

// ---------------------------------------------------------------- GET ?id=
async function yerGetir(req, res) {
  const id = metin(req.query && req.query.id);
  if (!KIMLIK_DESENI.test(id)) { hataDon(res, 400, 'Geçersiz yer kodu'); return; }
  const snap = await qrSiteRef(getDb(), id).get();
  if (!snap.exists) { hataDon(res, 404, 'yok'); return; }
  const v = snap.data() || {};
  // YALNIZCA sayfanın ihtiyaç duyduğu alanlar — notlar, temsilciId, olusturan*, taramaSayisi gizli
  const site = {
    id: snap.id,
    ad: v.ad || '', tur: v.tur || '', adres: v.adres || '', ilce: v.ilce || '', il: v.il || '',
    bloklar: v.bloklar || '', temsilciAd: v.temsilciAd || '',
    temsilciTel: metin(v.temsilciTel) || QR_SIRKET_TELEFONU,
    aktif: v.aktif !== false,
  };
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json({ ok: true, site });
}

// ---------------------------------------------------------------- POST tarama
async function taramaIsle(body, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = metin(body.id);
  if (KIMLIK_DESENI.test(id)) {
    const ref = qrSiteRef(getDb(), id);
    const snap = await ref.get();
    if (snap.exists && snap.data().aktif !== false) {
      await ref.update({ taramaSayisi: FieldValue.increment(1), sonTarama: new Date().toISOString() });
    }
  }
  // Her durumda aynı yanıt — yerin var olup olmadığı sızmaz
  res.status(200).json({ ok: true });
}

// ---------------------------------------------------------------- POST talep
// Hata mesajları WordPress sayfasındakilerle aynı (sayfa "Gönderilemedi, lütfen
// tekrar deneyin. " + hata olarak gösterir).
function talepDogrula(body) {
  const tur = metin(body.tur);
  if (tur !== 'bilgi' && tur !== 'kesif') return { hata: 'Geçersiz talep türü.' };
  const kesif = tur === 'kesif';
  const f = {
    tur,
    adSoyad: metin(body.adSoyad),
    telefon: metin(body.telefon),
    hizmet: kesif ? '' : metin(body.hizmet),
    blok: kesif ? metin(body.blok) : '',
    kat: kesif ? metin(body.kat) : '',
    daire: kesif ? metin(body.daire) : '',
    randevuTarihi: kesif ? metin(body.randevuTarihi) : '',
    randevuSaati: kesif ? metin(body.randevuSaati) : '',
    mesaj: metin(body.mesaj),
  };
  if (!f.adSoyad) return { hata: 'Lütfen adınızı ve soyadınızı yazın.' };
  if (f.adSoyad.length > 80) return { hata: 'Ad soyad en fazla 80 karakter olabilir.' };
  if (!qrTelefonGecerliMi(f.telefon)) return { hata: 'Lütfen geçerli bir cep telefonu yazın (05XX XXX XX XX).' };
  if (f.hizmet && !QR_HIZMETLER.includes(f.hizmet)) return { hata: 'Lütfen listeden bir hizmet seçin.' };
  if (kesif) {
    if (!f.randevuTarihi) return { hata: 'Lütfen keşif için bir tarih seçin.' };
    if (!gecerliTarihMi(f.randevuTarihi)) return { hata: 'Geçersiz tarih.' };
    const bugun = istanbulBugun();
    if (f.randevuTarihi < bugun) return { hata: 'Geçmiş bir tarih seçilemez.' };
    if (f.randevuTarihi > gunEkle(bugun, RANDEVU_EN_FAZLA_GUN)) return { hata: `En fazla ${RANDEVU_EN_FAZLA_GUN} gün sonrası için keşif randevusu alınabilir.` };
    if (!QR_RANDEVU_SAATLERI.includes(f.randevuSaati)) return { hata: 'Lütfen bir saat seçin.' };
    if (f.blok.length > 20 || f.kat.length > 20 || f.daire.length > 20) return { hata: 'Blok, kat ve daire en fazla 20 karakter olabilir.' };
  }
  if (f.mesaj.length > 500) return { hata: 'Not en fazla 500 karakter olabilir.' };
  return { form: f };
}

async function talepIsle(body, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Honeypot doluysa bot: hiçbir şey yazmadan "başarılı" gibi dön
  if (metin(body.website)) { res.status(200).json({ ok: true, talepId: null, anahtar: '' }); return; }

  const id = metin(body.id);
  if (!KIMLIK_DESENI.test(id)) { hataDon(res, 400, 'Geçersiz yer kodu'); return; }
  const db = getDb();
  const snap = await qrSiteRef(db, id).get();
  if (!snap.exists) { hataDon(res, 404, 'Bu QR kod tanınmadı'); return; }
  const site = snap.data() || {};
  if (site.aktif === false) { hataDon(res, 400, 'Bu kampanya sona erdi'); return; }

  const { hata, form } = talepDogrula(body);
  if (hata) { hataDon(res, 400, hata); return; }

  // Mükerrer koruma: son 2 dk'daki talepler (tek alanlı aralık sorgusu —
  // bileşik index gerekmez; pencere kısa olduğu için sonuç kümesi küçüktür),
  // site + normalize telefon + tür bellekte süzülür.
  // DEĞİŞTİ: tür de anahtarda — önce bilgi sonra keşif gönderen sakinin keşfi ayrı talep olarak yazılır.
  const simdi = Date.now();
  const telAnahtar = qrTelefonNormalize(form.telefon);
  const yakin = await qrTalepKoleksiyonu(db)
    .where('olusturmaTarihi', '>=', new Date(simdi - MUKERRER_PENCERE_MS).toISOString()).get();
  const mukerrer = yakin.docs.find(d => d.data().siteId === snap.id && d.data().tur === form.tur && qrTelefonNormalize(d.data().telefon) === telAnahtar);
  if (mukerrer) {
    res.status(200).json({ ok: true, talepId: mukerrer.id, anahtar: mukerrer.data().iletisimAnahtari || '' });
    return;
  }

  const anahtar = randomBytes(16).toString('hex');
  const ref = await qrTalepKoleksiyonu(db).add({
    siteId: snap.id, siteAd: site.ad || '', siteAdres: site.adres || '',
    tur: form.tur, adSoyad: form.adSoyad, telefon: form.telefon,
    hizmet: form.hizmet,
    blok: form.blok, kat: form.kat, daire: form.daire,
    randevuTarihi: form.randevuTarihi, randevuSaati: form.randevuSaati,
    mesaj: form.mesaj,
    temsilciId: site.temsilciId || '', temsilciAd: site.temsilciAd || '',
    durum: 'Yeni', temsilciyiAradi: false, whatsappYazdi: false,
    olusturmaTarihi: new Date(simdi).toISOString(),
    // Ek alanlar (WordPress akışı)
    kaynak: 'wordpress',
    iletisimAnahtari: anahtar,
  });
  res.status(200).json({ ok: true, talepId: ref.id, anahtar });
}

// ---------------------------------------------------------------- POST iletisim
async function iletisimIsle(body, res) {
  res.setHeader('Cache-Control', 'no-store');
  const alan = metin(body.alan);
  if (!ILETISIM_ALANLARI.includes(alan)) { hataDon(res, 400, 'Geçersiz alan'); return; }
  const talepId = metin(body.talepId);
  const anahtar = metin(body.anahtar);
  if (KIMLIK_DESENI.test(talepId) && ANAHTAR_DESENI.test(anahtar)) {
    const ref = qrTalepKoleksiyonu(getDb()).doc(talepId);
    const snap = await ref.get();
    const kayitli = snap.exists ? String(snap.data().iletisimAnahtari || '') : '';
    // Uzunluk eşitliği önce denetlenir (timingSafeEqual farklı uzunlukta hata fırlatır)
    if (ANAHTAR_DESENI.test(kayitli) && timingSafeEqual(Buffer.from(kayitli, 'hex'), Buffer.from(anahtar, 'hex'))) {
      await ref.update({ [alan]: true, [`${alan}Zamani`]: new Date().toISOString() });
    }
  }
  // sendBeacon yanıtı okumaz; her durumda aynı yanıt
  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET' && req.method !== 'POST') { hataDon(res, 405, 'Geçersiz istek'); return; }
  if (!FIRESTORE_APP_ID) { console.error('[qr-site] FIRESTORE_APP_ID ortam değişkeni tanımlı değil.'); hataDon(res, 500, 'Sunucu yapılandırma hatası'); return; }
  try {
    if (req.method === 'GET') { await yerGetir(req, res); return; }

    // text/plain gövde Vercel'de string (bazen Buffer) gelir; JSON ise zaten nesnedir
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { hataDon(res, 400, 'Geçersiz istek'); return; }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { hataDon(res, 400, 'Geçersiz istek'); return; }

    if (body.islem === 'tarama') { await taramaIsle(body, res); return; }
    if (body.islem === 'talep') { await talepIsle(body, res); return; }
    if (body.islem === 'iletisim') { await iletisimIsle(body, res); return; }
    hataDon(res, 400, 'Geçersiz işlem');
  } catch (err) {
    console.error('[qr-site] hata:', err);
    hataDon(res, 500, 'Sunucu hatası, lütfen tekrar deneyin');
  }
}
