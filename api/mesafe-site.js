// api/mesafe-site.js
// ============================================================================
// Sembol CRM — SİTELER İÇİN KM + FİYAT HESABI (4 NOKTA / 3 ETAP) · herkese açık
// ----------------------------------------------------------------------------
// sembolevdeneve.com "Fiyat Teklifi Al → Evden Eve" ve depoevim.com "Eşya Depolama
// → Firma adresimden alsın (Anahtar Teslim)" sihirbazları bu uca sorar. CRM'in
// kullandığı /api/mesafe ile AYNI km hesabı, AYNI Google anahtarı ve AYNI 90 günlük
// önbellek (mesafeOnbellek) kullanılır; fark kapıdadır:
//   • CRM şifresi İSTENMEZ, ama yalnızca iki sitenin adresinden gelen istek kabul edilir
//   • Serbest adres ALINMAZ: yalnızca il / ilçe adı (ya da DepoEvim şube adı); ilçe
//     merkezi koordinat tablosunda olmayan il/ilçe reddedilir
//   • Hareket merkezini site seçemez — Fiyat Tablosu'ndaki ayardan okunur
//   • Fiyat Tablosu'nda km modu KAPALIYSA Google'a hiç gidilmez
//   • Fatura koruması: IP başına saatlik istek sınırı + günlük toplam Google sorgu sınırı
//     (önbellekten dönen etaplar Google sınırına SAYILMAZ)
// YENİ: km'ye bağlı fiyat da BURADA hesaplanır (fiyatSema.js — CRM ile aynı fonksiyonlar),
// böylece formül sitelere kopyalanmaz ve CRM'le site hep aynı rakamı verir.
//
// GET /api/mesafe-site   → sihirbazların il / ilçe ve şube listesi (CRM'le aynı liste;
//   her ilçe km tablosunda var). CDN'de 1 gün önbelleklenir.
//   → { iller: { "İstanbul (Anadolu)": ["Adalar", …], "İstanbul (Avrupa)": […], "Adana": […], … },
//       subeler: [{ ad: "Pendik Depoevim", il: "İstanbul (Anadolu)", ilce: "Pendik" }, …] }
//
// POST /api/mesafe-site
//   Sembol (evden eve):   { yukIl, yukIlce, bosIl, bosIlce, hesap? }
//   DepoEvim (depoya):    { yukIl, yukIlce, sube: "Kartal Depoevim", hesap? }
//     sube boş / "Farketmez" / tanınmıyorsa CRM gibi ilk şube (Pendik Depoevim) kullanılır.
//   hesap (isteğe bağlı): { odaK: "2+1", araToplam: 30000, avrupaEkstra: 0 }
//     odaK        → '1+0' | '1+1' | '2+1' | '3+1' | '4+1' (depoda depo boyutu)
//     araToplam   → sitenin bugünkü hesabıyla: nakliye taban + ek hizmetler (Avrupa ekstrası HARİÇ)
//     avrupaEkstra→ Avrupa Yakası ekstrası uygulanacaksa tutarı, yoksa 0. Sunucu, uzun yol
//                   kademesi aşılmışsa bunu EKLEMEZ (CRM kuralı).
//   → 200 { aktif: true, noktalar: [4 adres], etaplar: [{ nereden, nereye, km, dk }],
//           toplamKm, toplamDk, gecisler: { kopruOsmangazi: 2, ... }, sube?,
//           fiyat?: { tabanFiyat, kmTutari, gecisTutari, sabitEk, uzunYolFarki, evTipiFarki,
//                     avrupaEkstraUygulandi, kademeKm } }
//     fiyat.tabanFiyat = CRM'deki sistem (taban) fiyatı. Müşteriye gösterilecek aralık sitenin
//     bugünkü mantığıyla bunun üzerine kurulur (aralikYuzdesi / yuvarlama — /api/fiyatlar).
//   → 409 { aktif: false }   km modu kapalı (site eski fiyatla devam eder)
//   → 400 geçersiz girdi · 403 izinsiz site · 429 sınır doldu · 5xx sunucu/Google hatası
//   Site 200 dışındaki her cevapta km'siz (eski) fiyata düşmelidir.
//
// ORTAM DEĞİŞKENLERİ (hepsi isteğe bağlı; GOOGLE_MAPS_API_KEY ve Firebase
// değişkenleri /api/mesafe ile AYNI — ek kurulum yok):
//   MESAFE_SITE_IP_SAATLIK     → bir IP'nin saatte en fazla isteği (varsayılan 20)
//   MESAFE_SITE_GUNLUK_GOOGLE  → sitelerin günde en fazla Google sorgusu (varsayılan 500)
//   MESAFE_SITE_EK_ORIGINS     → test için ek izinli adresler, virgülle (ör. http://localhost:3000)
//
// Sayaçlar: artifacts/{appId}/public/data/mesafeSiteSayac/{ip_<özet>_<saat> | google_<gün>}
// IP adresi açık yazılmaz, yalnızca özeti (SHA-256) tutulur. "sonKullanma" alanı
// Firestore TTL politikası için hazırdır (eski sayaçları otomatik silmek isterseniz).
// ============================================================================
import { createHash } from 'node:crypto';
import { getDb, IstekHatasi, etapGetir as etapGetirVarsayilan, anahtarYap, adresKoordinati } from './mesafe.js';
import { ilceMerkezAdresi, mesafeModuAcik, MESAFE_VARSAYILAN, fiyatEksikleriDoldur, FIYAT_ODALAR,
  mesafeKalemleri, mesafeEsikAsildi, mesafeAktifKademe, mesafeIscilikKalemi, mesafeOdaFarkiKalemi } from '../src/fiyatSema.js';
import { TURKEY_LOCATIONS, DEPO_LOCATIONS, IL_SIRASI, ONCELIKLI_ILLER } from '../src/konumlar.js';

const SITE_ORIGINS = ['https://www.sembolevdeneve.com', 'https://sembolevdeneve.com', 'https://www.depoevim.com', 'https://depoevim.com'];
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;
const veriKoku = (db) => db.collection('artifacts').doc(FIRESTORE_APP_ID).collection('public').doc('data');

const sayi = (v, varsayilan) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : varsayilan; };
// Türkiye saatine göre saat / gün damgası (gün sınırı gece 00:00 TR)
const trDamga = (ms) => new Date(ms + 3 * 3600000).toISOString();
const saatDamgasi = (ms) => trDamga(ms).slice(0, 13).replace(/\D/g, ''); // 2026100514
const gunDamgasi = (ms) => trDamga(ms).slice(0, 10).replace(/\D/g, '');  // 20261005

const istemciIp = (req) => String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'bilinmiyor';
const ipOzeti = (ip) => createHash('sha256').update(`sembol-mesafe-site|${ip}`).digest('hex').slice(0, 20);

// İl/ilçe → ilçe merkezi adresi; koordinat tablosunda yoksa null (serbest metin kabul edilmez)
export const siteNoktasi = (il, ilce) => {
  const ilS = String(il || '').trim(); const ilceS = String(ilce || '').trim();
  if (!ilS || ilS.length > 40 || ilceS.length > 40) return null;
  const adres = ilceMerkezAdresi(ilS, ilceS);
  return adres && adresKoordinati(adres) ? adres : null;
};

// GET cevabı: CRM'deki sırayla — İstanbul (Anadolu/Avrupa), Kocaeli, Bursa, İzmir, Ankara, sonra alfabetik.
// "ilSirasi" dizisi de verilir (JSON nesnelerinde sıra korunur ama sitelerin diziyi kullanması daha güvenli).
export const siteListeleri = () => {
  const iller = {};
  IL_SIRASI.forEach(il => { iller[il] = [...TURKEY_LOCATIONS[il]]; });
  return { ilSirasi: [...IL_SIRASI], oncelikliIller: [...ONCELIKLI_ILLER], iller,
    subeler: DEPO_LOCATIONS.map(d => ({ ad: d.name, il: d.province, ilce: d.district })) };
};
// DepoEvim şubesi — tam ad ("Kartal Depoevim") ya da sitenin gönderdiği kod ("kartal",
// "basaksehir"). CRM ile aynı kural: bulunamazsa / "farketmez" ise ilk şube (Pendik).
export const subeBul = (ad) => {
  const a = anahtarYap(ad);
  return DEPO_LOCATIONS.find(d => anahtarYap(d.name) === a || anahtarYap(d.name.split(' ')[0]) === a) || DEPO_LOCATIONS[0];
};

// Km'ye bağlı fiyat — CRM ttFiyatHesapla ile aynı sıra:
// ara toplam (taban + ek hizmetler) + km + geçişler + sabit ek (+ Avrupa ekstrası, kademe aşılmadıysa)
// → uzun yol farkı (toplamın %) → EN SON ev tipi farkı (son toplamın %)
export const siteFiyatHesapla = (M, rota, { odaK, araToplam, avrupaEkstra = 0 }) => {
  const kalemler = [{ ad: 'Ara toplam', tutar: Math.round(araToplam) }];
  const km = mesafeKalemleri(M, rota);
  km.forEach(k => kalemler.push(k));
  const esikAsildi = mesafeEsikAsildi(M, rota.toplamKm);
  const avrupaEkstraUygulandi = !esikAsildi && avrupaEkstra > 0;
  if (avrupaEkstraUygulandi) kalemler.push({ ad: 'Avrupa Yakası ekstra', tutar: Math.round(avrupaEkstra) });
  const isc = mesafeIscilikKalemi(M, rota, kalemler);
  if (isc) kalemler.push(isc);
  const oda = mesafeOdaFarkiKalemi(M, rota, odaK, kalemler);
  if (oda) kalemler.push(oda);
  const topla = (liste) => liste.reduce((t, k) => t + (Number(k.tutar) || 0), 0);
  return {
    tabanFiyat: topla(kalemler),
    kmTutari: km[0]?.tutar || 0,
    gecisTutari: topla(km.filter(k => k.ad.startsWith('Geçiş'))),
    sabitEk: topla(km.slice(1).filter(k => !k.ad.startsWith('Geçiş'))),
    uzunYolFarki: isc?.tutar || 0,
    evTipiFarki: oda?.tutar || 0,
    avrupaEkstraUygulandi,
    kademeKm: Number(mesafeAktifKademe(M, rota.toplamKm)?.km) || null,
  };
};
const hesapGirdisi = (h) => {
  if (h == null) return null;
  const odaK = String(h.odaK || '');
  const araToplam = Number(h.araToplam);
  const avrupaEkstra = h.avrupaEkstra == null || h.avrupaEkstra === '' ? 0 : Number(h.avrupaEkstra);
  if (!FIYAT_ODALAR.includes(odaK)) throw new IstekHatasi(400, `hesap.odaK şunlardan biri olmalı: ${FIYAT_ODALAR.join(', ')}`);
  if (!Number.isFinite(araToplam) || araToplam < 0 || araToplam > 5000000) throw new IstekHatasi(400, 'hesap.araToplam geçersiz.');
  if (!Number.isFinite(avrupaEkstra) || avrupaEkstra < 0 || avrupaEkstra > 1000000) throw new IstekHatasi(400, 'hesap.avrupaEkstra geçersiz.');
  return { odaK, araToplam, avrupaEkstra };
};

// Sayaç: sınır dolduysa 429 fırlatır, dolmadıysa 1 artırır.
// (Okuma + yazma atomik değil; aynı anda gelen birkaç istek sınırı birkaç adet aşabilir — kabul edilebilir.)
async function sayacArtir(db, id, sinir, sureMs, simdi, mesaj) {
  const ref = veriKoku(db).collection('mesafeSiteSayac').doc(id);
  const snap = await ref.get();
  const mevcut = snap.exists ? Number(snap.data()?.sayi) || 0 : 0;
  if (mevcut >= sinir) throw new IstekHatasi(429, mesaj);
  await ref.set({ sayi: mevcut + 1, sonKullanma: new Date(simdi + sureMs).toISOString() });
}

export function handlerOlustur({ getDb: dbAl = getDb, etapGetir = etapGetirVarsayilan, env = process.env, simdi = () => Date.now() } = {}) {
  const izinli = [...SITE_ORIGINS, ...String(env.MESAFE_SITE_EK_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
  return async function handler(req, res) {
    const origin = req.headers.origin;
    const izinliMi = !!origin && izinli.includes(origin);
    res.setHeader('Vary', 'Origin');
    if (izinliMi) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') { res.setHeader('Cache-Control', 'no-store'); res.status(izinliMi ? 204 : 403).end(); return; }
    // YENİ: il / ilçe ve şube listesi (gizli bilgi yok, Google'a gidilmez)
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
      res.status(200).json(siteListeleri());
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!izinliMi) { res.status(403).json({ error: 'Bu adresten erişime izin yok.' }); return; }
    if (!FIRESTORE_APP_ID) { res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }
    if (!env.GOOGLE_MAPS_API_KEY) { res.status(503).json({ error: 'Km servisi şu an kullanılamıyor.' }); return; }
    try {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const yuk = siteNoktasi(body.yukIl, body.yukIlce);
      // YENİ: DepoEvim — boşaltma noktası müşterinin seçtiği şube (sube alanı gönderildiyse)
      const subeVar = Object.prototype.hasOwnProperty.call(body, 'sube');
      const sube = subeVar ? subeBul(body.sube) : null;
      const bos = sube ? ilceMerkezAdresi(sube.province, sube.district) : siteNoktasi(body.bosIl, body.bosIlce);
      if (!yuk || !bos) throw new IstekHatasi(400, sube ? 'Eşyaların alınacağı il / ilçeyi seçin.' : 'Yükleme ve boşaltma için geçerli il / ilçe seçin.');
      const hesap = hesapGirdisi(body.hesap);

      const db = dbAl();
      // Km modu, hareket merkezi ve km fiyat ayarları Fiyat Tablosu'ndan (CRM ile aynı belge)
      const fiyatSnap = await veriKoku(db).collection('ayarlar').doc('fiyatTablosu').get();
      const M = fiyatEksikleriDoldur(fiyatSnap.exists ? fiyatSnap.data() : {}).mesafe;
      if (!mesafeModuAcik(M)) { res.status(409).json({ aktif: false, error: 'Km bazlı fiyat kapalı.' }); return; }
      const merkez = String(M.cikisAdresi || '').trim() || MESAFE_VARSAYILAN.cikisAdresi;

      const an = simdi();
      await sayacArtir(db, `ip_${ipOzeti(istemciIp(req))}_${saatDamgasi(an)}`, sayi(env.MESAFE_SITE_IP_SAATLIK, 20), 2 * 3600000, an,
        'Çok fazla deneme yaptınız, lütfen biraz sonra tekrar deneyin.');
      const googleSiniri = sayi(env.MESAFE_SITE_GUNLUK_GOOGLE, 500);
      const googleOncesi = () => sayacArtir(db, `google_${gunDamgasi(an)}`, googleSiniri, 2 * 86400000, an,
        'Km hesaplama şu an yoğun, fiyat km\'siz gösteriliyor.');

      const noktalar = [merkez, yuk, bos, merkez];
      const etaplar = [];
      for (let i = 0; i < noktalar.length - 1; i++) {
        // Aynı ilçede başlayıp biten etap (ör. Pendik → Pendik) 0 km — /api/mesafe ile aynı kural
        if (anahtarYap(noktalar[i]) === anahtarYap(noktalar[i + 1])) { etaplar.push({ nereden: noktalar[i], nereye: noktalar[i + 1], km: 0, dk: 0, gecisler: {} }); continue; }
        etaplar.push(await etapGetir(db, noktalar[i], noktalar[i + 1], googleOncesi));
      }
      const gecisler = {};
      etaplar.forEach(e => Object.keys(e.gecisler || {}).forEach(id => { gecisler[id] = (gecisler[id] || 0) + 1; }));
      const toplamKm = Math.round(etaplar.reduce((t, e) => t + e.km, 0) * 10) / 10;
      res.status(200).json({
        aktif: true,
        noktalar,
        etaplar: etaplar.map(e => ({ nereden: e.nereden, nereye: e.nereye, km: e.km, dk: e.dk || 0 })),
        toplamKm,
        toplamDk: etaplar.reduce((t, e) => t + (e.dk || 0), 0),
        gecisler,
        ...(sube ? { sube: sube.name } : {}),
        ...(hesap ? { fiyat: siteFiyatHesapla(M, { toplamKm, gecisler }, hesap) } : {}),
      });
    } catch (err) {
      // Google / rota hataları (5xx, 404) ayrıntısıyla müşteriye gösterilmez — günlüğe yazılır
      if (err instanceof IstekHatasi && err.durum < 500 && err.durum !== 404) { res.status(err.durum).json({ error: err.message }); return; }
      if (err instanceof IstekHatasi) { console.error('[mesafe-site] rota hatası:', err.message); res.status(502).json({ error: 'Km hesaplanamadı.' }); return; }
      console.error('[mesafe-site] hata:', err);
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  };
}

export default handlerOlustur();
