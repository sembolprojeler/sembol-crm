// api/mesafe-site.js
// ============================================================================
// Sembol CRM — SİTE İÇİN KM HESABI (4 NOKTA / 3 ETAP) · herkese açık
// ----------------------------------------------------------------------------
// sembolevdeneve.com "Fiyat Teklifi Al → Evden Eve" sihirbazı, müşteri il/ilçe
// seçince bu uca sorar. CRM'in kullandığı /api/mesafe ile AYNI hesap, AYNI Google
// anahtarı ve AYNI 90 günlük önbellek (mesafeOnbellek) kullanılır; fark kapıdadır:
//   • CRM şifresi İSTENMEZ, ama yalnızca sembolevdeneve.com'dan gelen istek kabul edilir
//   • Serbest adres ALINMAZ: yalnızca il / ilçe adı; ilçe merkezi koordinat tablosunda
//     olmayan il/ilçe reddedilir (uç başka işler için kullanılamaz)
//   • Hareket merkezini site seçemez — Fiyat Tablosu'ndaki ayardan okunur
//   • Fiyat Tablosu'nda km modu KAPALIYSA Google'a hiç gidilmez
//   • Fatura koruması: IP başına saatlik istek sınırı + günlük toplam Google sorgu sınırı
//     (önbellekten dönen etaplar Google sınırına SAYILMAZ)
//
// POST /api/mesafe-site
//   { yukIl: "İstanbul", yukIlce: "Kadıköy", bosIl: "Bursa", bosIlce: "İnegöl" }
//   → 200 { aktif: true, noktalar: [4 adres], etaplar: [{ nereden, nereye, km, dk }],
//           toplamKm, toplamDk, gecisler: { kopruOsmangazi: 2, ... } }
//   → 409 { aktif: false }   km modu kapalı (site eski fiyatla devam eder)
//   → 400 geçersiz il/ilçe · 403 izinsiz site · 429 sınır doldu · 5xx sunucu/Google hatası
//   Site 200 dışındaki her cevapta km'siz (eski) fiyata düşmelidir.
//
// ORTAM DEĞİŞKENLERİ (hepsi isteğe bağlı; GOOGLE_MAPS_API_KEY ve Firebase
// değişkenleri /api/mesafe ile AYNI — ek kurulum yok):
//   MESAFE_SITE_IP_SAATLIK     → bir IP'nin saatte en fazla isteği (varsayılan 20)
//   MESAFE_SITE_GUNLUK_GOOGLE  → sitenin günde en fazla Google sorgusu (varsayılan 500)
//   MESAFE_SITE_EK_ORIGINS     → test için ek izinli adresler, virgülle (ör. http://localhost:3000)
//
// Sayaçlar: artifacts/{appId}/public/data/mesafeSiteSayac/{ip_<özet>_<saat> | google_<gün>}
// IP adresi açık yazılmaz, yalnızca özeti (SHA-256) tutulur. "sonKullanma" alanı
// Firestore TTL politikası için hazırdır (eski sayaçları otomatik silmek isterseniz).
// ============================================================================
import { createHash } from 'node:crypto';
import { getDb, IstekHatasi, etapGetir as etapGetirVarsayilan, anahtarYap, adresKoordinati } from './mesafe.js';
import { ilceMerkezAdresi, mesafeModuAcik, MESAFE_VARSAYILAN } from '../src/fiyatSema.js';

const SITE_ORIGINS = ['https://www.sembolevdeneve.com', 'https://sembolevdeneve.com'];
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
    res.setHeader('Cache-Control', 'no-store');
    if (izinliMi) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') { res.status(izinliMi ? 204 : 403).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!izinliMi) { res.status(403).json({ error: 'Bu adresten erişime izin yok.' }); return; }
    if (!FIRESTORE_APP_ID) { res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }
    if (!env.GOOGLE_MAPS_API_KEY) { res.status(503).json({ error: 'Km servisi şu an kullanılamıyor.' }); return; }
    try {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const yuk = siteNoktasi(body.yukIl, body.yukIlce);
      const bos = siteNoktasi(body.bosIl, body.bosIlce);
      if (!yuk || !bos) throw new IstekHatasi(400, 'Yükleme ve boşaltma için geçerli il / ilçe seçin.');

      const db = dbAl();
      // Km modu ve hareket merkezi Fiyat Tablosu'ndan (CRM ile aynı belge)
      const fiyat = await veriKoku(db).collection('ayarlar').doc('fiyatTablosu').get();
      const M = (fiyat.exists ? fiyat.data()?.mesafe : null) || {};
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
      res.status(200).json({
        aktif: true,
        noktalar,
        etaplar: etaplar.map(e => ({ nereden: e.nereden, nereye: e.nereye, km: e.km, dk: e.dk || 0 })),
        toplamKm: Math.round(etaplar.reduce((t, e) => t + e.km, 0) * 10) / 10,
        toplamDk: etaplar.reduce((t, e) => t + (e.dk || 0), 0),
        gecisler,
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
