// api/fiyatlar.js
// ============================================================================
// Sembol CRM — FİYAT TABLOSU: TEK KAYNAK
// ----------------------------------------------------------------------------
// Veri: artifacts/{appId}/public/data/ayarlar/fiyatTablosu (CRM'deki "Fiyat
// Tablosu" penceresinin okuduğu belge). Geçmiş: .../fiyat_gecmisi/v{versiyon}.
// Şekil ve etiketler: src/fiyatSema.js (CRM ekranıyla ortak).
//
// GET  /api/fiyatlar?site=sembol | depoevim   (HERKESE AÇIK — site wizard'ları)
//   sembol   → Evden Eve Nakliyat sekmesinin tamamı
//   depoevim → Eşya Depolama Nakliyesi + Kiralık Depo sekmelerinin tamamı
//   Geçersiz site → 400. CDN'de 5 dk önbelleklenir.
//
// POST /api/fiyatlar                            (YALNIZCA CRM "Fiyatları Düzenle")
//   { islem: "kaydet",  kullaniciId, sifre, veri, beklenenVersiyon }
//   { islem: "geriDon", kullaniciId, sifre, gecmisId, beklenenVersiyon }
//   Kullanıcı personnelList'te CRM girişiyle AYNI kuralla (şifre, Pasif değil,
//   giriş yetkisi açık) ve Fiyat Tablosu'nu düzenleme yetkisiyle (Müdür /
//   Firma Sahibi / Sistem Yöneticisi) doğrulanır. Her kayıtta versiyon 1 artar,
//   fiyat_gecmisi'ne {versiyon, eskiVeri, yeniVeri, guncelleyen, tarih} yazılır.
//   Tarayıcılar bu belgelere doğrudan yazamaz (firestore.rules); Admin SDK yazar.
//
// Ortam değişkenleri: submit-lead.js ile AYNI (ek kurulum gerekmez).
// ============================================================================
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fiyatApiYaniti, fiyatDogrula, fiyatTemizle, fiyatFarklari, FIYAT_SITELERI, FIYAT_VERI_ANAHTARLARI } from '../src/fiyatSema.js';

// Bu uç yalnızca bu dört siteye açıktır (ALLOWED_ORIGINS ortam değişkeninden bağımsız)
const FIYAT_ORIGINS = ['https://www.depoevim.com', 'https://depoevim.com', 'https://www.sembolevdeneve.com', 'https://sembolevdeneve.com'];
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin && FIYAT_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
const fiyatRef = (db) => veriKoku(db).collection('ayarlar').doc('fiyatTablosu');
const gecmisKol = (db) => veriKoku(db).collection('fiyat_gecmisi');
// Belgedeki fiyat verisi (meta alanlar hariç) — eskiVeri olarak birebir saklanır
const fiyatVerisi = (belge) => {
  const o = {};
  FIYAT_VERI_ANAHTARLARI.forEach(k => { if (belge && belge[k] !== undefined) o[k] = belge[k]; });
  return o;
};
// Satis.jsx'teki ttMudurMu ile aynı kural
const duzenleyebilirMi = (u) => u?.rank === 'Müdür' || String(u?.position || '').includes('Firma Sahibi') || u?.fullName === 'Sistem Yöneticisi';

class IstekHatasi extends Error {
  constructor(durum, mesaj, ek = {}) { super(mesaj); this.durum = durum; this.ek = ek; }
}

async function kullaniciDogrula(db, kullaniciId, sifre) {
  if (!kullaniciId || sifre == null || sifre === '') throw new IstekHatasi(401, 'Oturum bilgisi eksik — CRM\'e yeniden giriş yapın.');
  const snap = await veriKoku(db).collection('personnelList').doc(String(kullaniciId)).get();
  const u = snap.exists ? snap.data() : null;
  if (!u || String(u.password) !== String(sifre)) throw new IstekHatasi(401, 'Kullanıcı doğrulanamadı — CRM\'e yeniden giriş yapın.');
  if (u.employmentStatus === 'Pasif' || (u.permissions && u.permissions.canView === false)) throw new IstekHatasi(403, 'Hesabınızın sisteme erişim yetkisi yok.');
  if (!duzenleyebilirMi(u)) throw new IstekHatasi(403, 'Fiyatları yalnızca Müdür / Firma Sahibi düzenleyebilir.');
  return u.fullName || 'Bilinmiyor';
}

async function getIsle(req, res) {
  const site = String(req.query?.site || '');
  if (!FIYAT_SITELERI.includes(site)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ error: 'Geçersiz site. Kullanım: /api/fiyatlar?site=sembol veya ?site=depoevim' });
    return;
  }
  const snap = await fiyatRef(getDb()).get();
  if (!snap.exists) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ error: 'Fiyat tablosu bulunamadı' }); return; }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).json(fiyatApiYaniti(snap.data(), site));
}

async function postIsle(req, res) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const islem = body.islem === 'geriDon' ? 'geriDon' : 'kaydet';
  const db = getDb();
  const guncelleyen = await kullaniciDogrula(db, body.kullaniciId, body.sifre);

  const sonuc = await db.runTransaction(async (t) => {
    const snap = await t.get(fiyatRef(db));
    if (!snap.exists) throw new IstekHatasi(503, 'Fiyat tablosu bulunamadı');
    const mevcut = snap.data();
    const mevcutVersiyon = Number(mevcut.versiyon) || 1;   // versiyon alanı öncesi kayıt = 1
    if (body.beklenenVersiyon != null && Number(body.beklenenVersiyon) !== mevcutVersiyon) {
      throw new IstekHatasi(409, `Fiyatlar siz düzenlerken başka biri tarafından güncellendi (şu an v${mevcutVersiyon}). Pencereyi kapatıp yeniden açın.`, { versiyon: mevcutVersiyon });
    }
    let hedef = body.veri;
    let geriDonus = null;
    if (islem === 'geriDon') {
      const g = await t.get(gecmisKol(db).doc(String(body.gecmisId || '-')));
      if (!g.exists || !g.data().eskiVeri) throw new IstekHatasi(404, 'Geçmiş kaydı bulunamadı.');
      hedef = g.data().eskiVeri;
      geriDonus = { gecmisId: g.id, hedefVersiyon: (Number(g.data().versiyon) || 1) - 1 };
    }
    // İl listesi mevcut kayıttan alınır: il eklenemez / silinemez, eksik il "boş" hatası verir
    const { hatalar } = fiyatDogrula(hedef, mevcut);
    if (hatalar.length) throw new IstekHatasi(400, `${hatalar.length} hücrede hatalı değer var.`, { hatalar });
    const yeniVeri = fiyatTemizle(hedef, mevcut);
    const eskiVeri = fiyatVerisi(mevcut);
    const farklar = fiyatFarklari(eskiVeri, yeniVeri);
    if (!farklar.length) throw new IstekHatasi(400, 'Değişiklik yok.');
    const versiyon = mevcutVersiyon + 1;
    const tarih = new Date().toISOString();
    t.set(fiyatRef(db), { ...yeniVeri, versiyon, guncellendi: tarih, guncelleyen, guncellemeTarihi: tarih });
    // create: aynı versiyon iki kez yazılamaz
    t.create(gecmisKol(db).doc(`v${versiyon}`), {
      versiyon, eskiVeri, yeniVeri, guncelleyen, tarih, degisenHucre: farklar.length, ...(geriDonus ? { geriDonus } : {}),
    });
    return { versiyon, guncellendi: tarih, guncelleyen, degisenHucre: farklar.length };
  });
  res.status(200).json({ ok: true, ...sonuc });
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!FIRESTORE_APP_ID) { res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }
  try {
    if (req.method === 'GET') await getIsle(req, res);
    else await postIsle(req, res);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    if (err instanceof IstekHatasi) { res.status(err.durum).json({ error: err.message, ...err.ek }); return; }
    console.error('[fiyatlar] hata:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}
