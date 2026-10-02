// api/_lib/pazarlama.js
// ============================================================================
// Pazarlama izi (UTM / referrer / iniş adresi) okuma + kaynak kararı
// ----------------------------------------------------------------------------
// submit-lead.js ve yeni-musteri.js'in ORTAK yardımcısı. "_lib" klasörü "_"
// ile başladığı için Vercel bunu bir API ucu olarak YAYINLAMAZ.
//
// WordPress sözleşmesi (kök düzeyde, hepsi opsiyonel, her gönderimde — partial
// dahil — aynı değerlerle):
//   utm_source, utm_medium, utm_campaign, utm_content, utm_term,
//   referrer, landing_url  (+ AI_TIKLAMA_KIMLIGI_ALANLARI'ndaki parametreler)
// ============================================================================

import { AI_KAYNAK_DEGERLERI, AI_REKLAM_DEGERLERI, AI_TIKLAMA_KIMLIGI_ALANLARI, aiKaynakSiniflandir } from '../../src/aiKaynakSema.js';

// Sitelerin "reklamKaynagi" alanında gönderebileceği klasik değerler.
export const KLASIK_REKLAM_KAYNAKLARI = ['google_ads', 'facebook_ads', 'facebook_organik', 'instagram_ads', 'instagram_organik', 'google_anasayfa', 'google_altsayfa', 'direkt_giris', 'diger_site'];
// Geçerli tüm değerler — tanınmayan değer 'direkt_giris' sayılır.
export const REKLAM_KAYNAGI_DEGERLERI = [...KLASIK_REKLAM_KAYNAKLARI, ...AI_KAYNAK_DEGERLERI];
// "Ödemeli reklam" — QR izi bunların ÜZERİNE YAZMAZ; tarayıcı/sunucu
// çelişkisinde de ilk sırada bunlar gelir.
export const PAID_ADS_DEGERLERI = ['google_ads', 'facebook_ads', 'instagram_ads', ...AI_REKLAM_DEGERLERI];
// Tarayıcının "bilmiyorum" anlamına gelen değerleri — sunucu bir yapay zeka
// izi bulduysa bunların yerine geçer.
const ZAYIF_KAYNAKLAR = ['direkt_giris', 'diger_site'];

const SINIRLAR = { utm: 150, url: 500, kimlik: 200 };

// Kontrol karakterlerini at, boşlukları sadeleştir, uzunluğu sınırla.
export function metinTemizle(v, max) {
  if (v == null || typeof v === 'object') return '';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Yalnızca http(s) adresleri kabul edilir.
function urlTemizle(v) {
  const s = metinTemizle(v, 2000);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString().slice(0, SINIRLAR.url);
  } catch { return ''; }
}

function urlParametreleri(url) {
  try { return Object.fromEntries(new URL(url).searchParams.entries()); } catch { return {}; }
}

// Reklam panelindeki doldurulmamış yer tutucu ("{campaign_id}") = boş.
const yerTutucuMu = (s) => s.startsWith('{');

// Payload'dan pazarlama izini okur. YALNIZCA dolu alanları döndürür — kayıt
// merge:true ile yazıldığı için boş alan, önceki ara kayıttaki değeri silmesin.
// utm_* gövdede yoksa landing_url'nin sorgu dizisinden okunur.
export function pazarlamaOku(body) {
  const b = body || {};
  const landingUrl = urlTemizle(b.landing_url);
  const q = urlParametreleri(landingUrl);
  const al = (ad) => metinTemizle(b[ad] != null && b[ad] !== '' ? b[ad] : q[ad], SINIRLAR.utm);

  const p = {};
  const utmSource = al('utm_source');
  const utmMedium = al('utm_medium');
  const utmCampaign = al('utm_campaign');
  const utmContent = al('utm_content');
  const utmTerm = al('utm_term');
  const referrer = urlTemizle(b.referrer);
  if (utmSource) p.utmSource = utmSource;
  if (utmMedium) p.utmMedium = utmMedium;
  if (utmCampaign && !yerTutucuMu(utmCampaign)) p.utmCampaign = utmCampaign;
  if (utmContent && !yerTutucuMu(utmContent)) p.utmContent = utmContent;
  if (utmTerm && !yerTutucuMu(utmTerm)) p.utmTerm = utmTerm;
  if (referrer) p.referrer = referrer;
  if (landingUrl) p.landingUrl = landingUrl;

  const kimlikler = {};
  AI_TIKLAMA_KIMLIGI_ALANLARI.forEach(({ platform, alan }) => {
    const v = metinTemizle(b[alan] || q[alan], SINIRLAR.kimlik);
    if (v && !yerTutucuMu(v)) kimlikler[platform] = v;
  });
  if (Object.keys(kimlikler).length) p.tiklamaKimlikleri = kimlikler;
  return p;
}

// Nihai reklamKaynagi kararı. Öncelik:
//   1) Ödemeli reklam (tarayıcının söylediği ya da sunucunun UTM/tıklama
//      kimliğiyle bulduğu)
//   2) Tarayıcının değeri (zayıf değilse)
//   3) Sunucunun yapay zeka tahmini (UTM / referrer)
//   4) Tarayıcının zayıf değeri ya da 'direkt_giris'
// Dönen "karar" alanı kayda yazılır (hangi kuralın kazandığı — hata ayıklama için).
export function reklamKaynagiKarar(tarayiciDegeri, pazarlama) {
  const tarayici = REKLAM_KAYNAGI_DEGERLERI.includes(tarayiciDegeri) ? tarayiciDegeri : null;
  const sunucu = aiKaynakSiniflandir(pazarlama);
  if (tarayici && PAID_ADS_DEGERLERI.includes(tarayici)) return { reklamKaynagi: tarayici, karar: 'tarayici' };
  if (sunucu && sunucu.reklam) return { reklamKaynagi: sunucu.kod, karar: `sunucu_${sunucu.yontem}` };
  if (tarayici && !ZAYIF_KAYNAKLAR.includes(tarayici)) return { reklamKaynagi: tarayici, karar: 'tarayici' };
  if (sunucu) return { reklamKaynagi: sunucu.kod, karar: `sunucu_${sunucu.yontem}` };
  return { reklamKaynagi: tarayici || 'direkt_giris', karar: tarayici ? 'tarayici' : 'varsayilan' };
}

