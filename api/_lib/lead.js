// api/_lib/lead.js
// ============================================================================
// Sembol CRM — ORTAK LEAD (Müşteri Havuzu kaydı) MODÜLÜ
// ----------------------------------------------------------------------------
// api/submit-lead.js (site teklif sihirbazları) ve api/whatsapp-webhook.js
// (WhatsApp botu) havuzKayitlari belgesini BU modülle üretir: aynı etiket
// sözlükleri, aynı sonMesaj biçimi, aynı teklifAlanlari / guzergah alanları.
// Böylece CRM'deki Teklif Detayı kartı WhatsApp lead'ini de sihirbaz
// lead'i gibi okur. Bu dosya Firestore'a kendisi YAZMAZ; kayıt nesnesini
// üretir, yazmayı çağıran uç yapar.
// ============================================================================
import { PAID_ADS_DEGERLERI, pazarlamaOku, reklamKaynagiKarar } from './pazarlama.js';

// ============================================================================
// YENİ (Sembol CRM QR TAKİP): QR / UTM İZİNİ YAKALA
// ----------------------------------------------------------------------------
// Kamyon, bilbord, dergi QR'ları siteyi "?utm_source=qr&utm_campaign=<KOD>&qr=<KOD>"
// adresiyle açar. Bu iz form kaydına yazılmazsa CRM formu "Organik" görür.
// Aşağıdaki fonksiyon izi HANGİ BİÇİMDE gelirse gelsin bulur:
//   • body.qrIzi          → site header'ına eklenen sembol-qr-takip.js'in
//                            gönderdiği nesne { utmSource, utmMedium, utmCampaign, qr, sayfaUrl }
//   • body.utm_campaign / utmCampaign / qr / kampanya (wizard doğrudan gönderirse)
//   • body.sayfaUrl / pageUrl / landingUrl / href (sayfa adresinin içinden)
//   • Referer başlığı (tarayıcı sorgu dizisini gönderdiyse)
// Bulunan iz kayda ŞU alanlarla yazılır (Satis.jsx bunları tanır):
//   qrKodu, utmSource, utmMedium, utmCampaign, sayfaUrl, reklamKaynagi:'qr'
// ============================================================================
export function normalizeKod(v) {
  return String(v || '').toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}
function paramsFromUrl(url) {
  try { const u = new URL(String(url)); return Object.fromEntries(u.searchParams.entries()); } catch { return {}; }
}
export function qrIziniCoz(body, req) {
  body = body || {};
  const iz = (body.qrIzi && typeof body.qrIzi === 'object') ? body.qrIzi : {};
  // Sayfa adresi: gövdedeki alanlar → Referer başlığı
  const sayfaUrl = iz.sayfaUrl || body.sayfaUrl || body.pageUrl || body.landingUrl || body.href || (req && req.headers && req.headers.referer) || '';
  const urlParams = paramsFromUrl(sayfaUrl);
  const utmSource = iz.utmSource || body.utm_source || body.utmSource || urlParams.utm_source || '';
  const utmMedium = iz.utmMedium || body.utm_medium || body.utmMedium || urlParams.utm_medium || '';
  const utmCampaign = iz.utmCampaign || body.utm_campaign || body.utmCampaign || body.kampanya || urlParams.utm_campaign || '';
  const qrHam = iz.qr || body.qr || body.qrKodu || urlParams.qr || (String(utmSource).toLowerCase() === 'qr' ? utmCampaign : '');
  const qrKodu = normalizeKod(qrHam);
  if (!qrKodu && !utmCampaign) return null;
  return {
    qrKodu: qrKodu || normalizeKod(utmCampaign),
    utmSource: String(utmSource || ''), utmMedium: String(utmMedium || ''), utmCampaign: String(utmCampaign || ''),
    sayfaUrl: String(sayfaUrl || '').slice(0, 500),
    qrIziZamani: iz.zaman || new Date().toISOString(),
  };
}

export function fmtTL(n) {
  try { return Number(n).toLocaleString('tr-TR'); } catch { return String(n); }
}

// ============================================================================
// HANGİ WIZARD? — "source" alanına bakarak formu belirle.
// Eski/bilinmeyen bir source gelirse (veya hiç gelmezse) güvenli varsayılan
// olarak "evdenEve" kullanılır — canlıdaki evden eve wizard'ı böylece ASLA
// bozulmaz.
// ============================================================================
export function resolveWizardType(source) {
  switch (source) {
    case 'esya-depolama':
    case 'web-wizard-depolama':
      return 'depolama';
    case 'asansor-kiralama':
    case 'asansor-kiralama-wizard':
      return 'asansor';
    case 'ofis-isyeri-tasima':
    case 'web-wizard-ofis':
      return 'ofis';
    case 'parca-esya-tasima':
    case 'web-wizard-parca-esya':
      return 'parcaEsya';
    case 'depoevim-esya-depolama-wizard':
      return 'depoevimDepolama';
    case 'depoevim-woocommerce-siparis':
      return 'depoevimSiparis';
    case 'evden-eve-nakliyat':
    case 'web-wizard-fullpage':
    default:
      return 'evdenEve';
  }
}

// CRM'de hizmetTipi SADECE bu dört değerden birini kabul ediyor.
// depoevimDepolama da 'Depo' kovasına düşer — DepoEvim de bir depolama hizmeti;
// hangi SİTEDEN geldiği hizmetTipi'nde değil, aşağıdaki SITE_BY_WIZARD ile
// hesapId alanına yazılır (Satis.jsx'te "Hesap" sütununda "DepoEvim" /
// "Sembol Nakliyat Sitesi" olarak görünür — satış ekibi tıklamadan, tek
// bakışta hangi siteden geldiğini görür).
export const HIZMET_TIPI_BY_WIZARD = {
  evdenEve: 'Nakliye',
  parcaEsya: 'Nakliye',
  ofis: 'Nakliye',
  depolama: 'Depo',
  asansor: 'Asansör',
  depoevimDepolama: 'Depo',
  depoevimSiparis: 'Depo',
};

// Satis.jsx'teki hangi SEKMEDE (kanal) görüneceği. Tüm teklif talepleri
// "web" (Web Sitesi Teklifleri) sekmesinde toplanır; ödemesi zaten alınmış
// WooCommerce siparişleri ise kendi ayrı sekmesinde ("İyzico Siparişleri")
// görünür — ikisi karışmasın diye.
export const KANAL_BY_WIZARD = {
  depoevimSiparis: 'iyzico',
};

// Wizard'ların "reklamKaynagi" alanında gönderebileceği geçerli değerler —
// Satis.jsx (Müşteri Havuzu) bu değerlere göre Google Ads / Facebook Ads /
// Facebook Organik / Instagram Ads / Instagram Organik / Google Anasayfa /
// Google Altsayfa / Direkt Giriş / Diğer Site ayrımını yapıyor. GÜNCELLEME
// (Ali'nin talebi, 2026-09): "organik" tek kovası tamamen kaldırıldı, 9
// kategoriye bölündü — facebook_organik ve instagram_organik yeni eklendi,
// "direkt" ise "direkt_giris" olarak yeniden adlandırıldı (wizard'lardaki ve
// site-geneli tıklama takibindeki isimlendirmeyle BİREBİR aynı olsun diye).
// Bu listede olmayan (ör. çok eski wizard sürümünden hiç gelmeyen ya da
// bozuk bir) değer artık güvenli şekilde 'direkt_giris' sayılır.
// GÜNCELLEME (yapay zeka kaynakları): REKLAM_KAYNAGI_DEGERLERI ve
// PAID_ADS_DEGERLERI artık api/_lib/pazarlama.js'te (yukarıda import edildi) —
// src/aiKaynakSema.js'teki chatgpt_ads / chatgpt_organik / gemini_organik …
// değerleri de geçerli. Ödemeli reklamlar (google/facebook/instagram_ads +
// chatgpt_ads) üzerine QR izi YAZMAZ (aşağıdaki qrIzi bloğuna bakın); diğer tüm
// kategorilerin üzerine QR izi kazanır.

// Satış ekibinin "Hesap" sütununda göreceği site etiketi — yeni-musteri.js'te
// (tıklama bildirimleri) kullanılan "depoevim"/"sembolevdeneve" değerleriyle
// BİREBİR AYNI — Satis.jsx'teki hesapAdi() fonksiyonu bu iki değeri özel
// olarak tanıyıp "DepoEvim" / "Sembol Nakliyat Sitesi" diye gösteriyor.
export const SITE_BY_WIZARD = {
  evdenEve: 'sembolevdeneve',
  parcaEsya: 'sembolevdeneve',
  ofis: 'sembolevdeneve',
  depolama: 'sembolevdeneve',
  asansor: 'sembolevdeneve',
  depoevimDepolama: 'depoevim',
  depoevimSiparis: 'depoevim',
};

// Satış ekibinin Müşteri Havuzu listesinde formu ayırt edebilmesi için
// sonMesaj'ın başına eklenen kısa etiket.
export const WIZARD_ETIKET = {
  evdenEve: 'Evden Eve Nakliyat',
  parcaEsya: 'Parça Eşya Taşıma',
  ofis: 'Ofis / İşyeri Taşıma',
  depolama: 'Eşya Depolama',
  asansor: 'Asansör Kiralama',
  depoevimDepolama: 'DepoEvim - Eşya Depolama',
  depoevimSiparis: 'DepoEvim - WooCommerce Siparişi',
};

// ---- Etiket sözlükleri (her wizard'ın kendi HTML'indeki seçeneklerle birebir) ----
export const EV_TIPI_LABEL = {
  '1+1': '1+1', '2+1': '2+1', '3+1': '3+1', '4+1': '4+1', '5+1': '5+1 ve üzeri',
  villa: 'Villa/Müstakil', ofis: 'Ofis',
};
const PARCA_KAPSAM_LABEL = {
  tek: 'Tek Parça Eşya', birkac: 'Birkaç Parça Eşya', oda: 'Oda Eşyası (1 oda)', ceyiz: 'Çeyiz Eşyası',
};
const OFIS_BUYUKLUK_LABEL = {
  kucuk: 'Küçük Ofis (1-10 kişilik)', orta: 'Orta Ölçekli Ofis (11-30 kişilik)',
  buyuk: 'Büyük Ofis (31-60 kişilik)', kurumsal: 'Kurumsal / Plaza Katı (60+ kişilik)',
};
const DEPO_HACIM_LABEL = {
  '1+0': '1+0 Depo (10 m³)', '1+1': '1+1 Depo (15 m³)', '2+1': '2+1 Depo (22 m³)', '3+1': '3+1 Depo (30 m³)',
};
const ELEVATOR_LABEL = {
  var: 'Binada asansör var', yok: 'Asansör yok / merdiven',
  merdiven: 'Merdivenden', bina_asansoru: 'Bina asansörü', dis_cephe: 'Dış cephe asansörü kurulması isteniyor',
};
// Sembol Eşya Depolama "Küçük eşyaları kim koliyecek?" sorusu
const TOPLAMA_LABEL = { kendim: 'Kendim toplayacağım', firma: 'Firma toplasın' };
const PAKETLEME_LABEL = {
  hayir: 'Kendim paketleyeceğim', kismi: 'Kısmi paketleme', firma: 'Firma paketlesin',
};
const OFIS_HIZMET_LABEL = {
  hayir: 'Sadece taşıma', kismi: 'Mobilya sökme-montaj dahil', firma: 'Sökme-montaj + IT ekipmanı kurulumu dahil',
};
const SURE_KIRALAMA_LABEL = { '1': 'Aylık', '6': '6 Aylık Peşin (1 ay hediye)', '12': 'Yıllık Peşin (2 ay hediye)' };
const ALIM_TESLIM_LABEL = {
  yok: 'Müşteri kendi getirecek', alim: 'Firma alım yapacak', alim_teslim: 'Firma hem alım hem teslim yapacak',
};
const KULLANIM_AMACI_LABEL = {
  evden_eve: 'Evden Eve Nakliyat', insaat: 'İnşaat Malzemesi Sevkiyatı',
  mobilya: 'Mobilya / Beyaz Eşya Teslimatı', moloz: 'Moloz veya Hurda İndirme',
};
const ASANSOR_TARAF_LABEL = { tek_taraf: 'Tek Taraf', cift_taraf: 'Çift Taraf' };
const IS_HACMI_LABEL = {
  '1+1': 'Az Eşya (1+1 kapasite)', '2+1': 'Orta Eşya (2+1 kapasite)',
  '3+1': 'Standart Eşya (3+1 kapasite)', '4+1': 'Yoğun Eşya (4+1/5+1/Villa)',
};
const KIRALAMA_SURESI_LABEL = { saatlik: 'Saatlik (1-3 saat)', yarim_gun: 'Yarım Gün', tam_gun: 'Tam Gün' };
const ARAC_YANASMA_LABEL = { sifir: 'Araç tam yanaşabiliyor', uzak: 'Araç yanaşamıyor / mesafe var' };
const KURULUM_KAT_LABEL = {
  normal: '1-8. kat (standart kurulum)', orta: '9-15. kat (teleskopik asansör)', yuksek: '16+ kat (büyük bomlu vinç)',
};
// ---- DepoEvim (depoevim.com) Eşya Depolama sihirbazına özel etiketler ----
const DEPOEVIM_BOYUT_LABEL = {
  '10': '10 m³ Depo', '15': '15 m³ Depo', '22': '22 m³ Depo', '30': '30 m³ Depo',
};
export const DEPOEVIM_SUBE_LABEL = {
  kartal: 'Kartal Şubesi', umraniye: 'Ümraniye Şubesi', cekmekoy: 'Çekmeköy Şubesi',
  basaksehir: 'Başakşehir Şubesi', farketmez: 'Şube farketmez',
};
const DEPOEVIM_TESLIM_LABEL = {
  kendim: 'Müşteri kendi getirecek', anahtar_teslim: 'Anahtar teslim (firma alım yapacak)',
};

// YENİ (kullanıcı talebi): TARİH SATIRI — müşteri tarihte esnekse (dateFlexible)
// "Esnek" yerine sihirbazın gönderdiği tarih tercihi (ör. "Hafta sonu") ve
// tarih notu yazılır; ikisi de boşsa "Esnek" kalır. Kesin tarih varsa o yazılır.
// Not serbest metindir: satır sonları ve ":" temizlenir, yoksa Satis.jsx'teki
// teklifOzetiAyristir notun içindeki "Kat:" / "Not:" gibi ifadeleri yeni bir
// alan sanıp Tarih satırını bölerdi.
function tarihTemizle(v) {
  return String(v || '').replace(/\s+/g, ' ').replace(/\s*:\s*/g, ' - ').trim().slice(0, 200);
}
// Kesin tarih seçilip ayrıca tercih/not da yazıldıysa hepsi gösterilir
// (DepoEvim sihirbazının kendi özetindeki gibi: "tarih · tercih · not").
// "bosIse": hiçbir tarih bilgisi yoksa yazılacak değer.
export function tarihMetni(p, tarih, bosIse = '-') {
  const tc = tarihTemizle(p.tarihTercihi);
  const tercih = [tc, tarihTemizle(p.tarihNotu)].filter(Boolean).join(' · ');
  if (p.dateFlexible) return tercih || 'Esnek';
  // DÜZELTME: Sembol Eşya Depolama sihirbazı tarih seçilmemişse hızlı seçimi
  // (ya da "esnek") tarih alanına da koyuyor — aynı değer iki kez yazılmaz.
  let t = tarihTemizle(tarih);
  if (t === tc) t = '';
  if (t.toLocaleLowerCase('tr-TR') === 'esnek') return tercih || 'Esnek';
  return [t, tercih].filter(Boolean).join(' · ') || bosIse;
}

function ortakKuyruk(satirlar, p) {
  if (p.priceMin && p.priceMax) satirlar.push(`Sistem fiyat tahmini: ${fmtTL(p.priceMin)} - ${fmtTL(p.priceMax)} TL`);
  if (Array.isArray(p.photoUrls) && p.photoUrls.length) satirlar.push(`${p.photoUrls.length} fotoğraf eklendi`);
  if (p.callbackRequested) satirlar.push('Müşteri "Beni Siz Arayın" talebinde bulundu');
  return satirlar;
}

// ---- Evden Eve Nakliyat ----
function buildSonMesajEvdenEve(p) {
  const satirlar = [];
  satirlar.push(`${p.fromCity || '-'}/${p.fromDistrict || '-'} → ${p.toCity || '-'}/${p.toDistrict || '-'}`);
  if (p.homeSize) satirlar.push(`Tip: ${EV_TIPI_LABEL[p.homeSize] || p.homeSize}`);
  if (p.fromFloor || p.toFloor) satirlar.push(`Kat: ${p.fromFloor ?? '-'} → ${p.toFloor ?? '-'}`);
  if (p.fromElevator) satirlar.push(`Çıkış asansör: ${ELEVATOR_LABEL[p.fromElevator] || p.fromElevator}`);
  if (p.toElevator) satirlar.push(`Varış asansör: ${ELEVATOR_LABEL[p.toElevator] || p.toElevator}`);
  if (p.paketleme) satirlar.push(`Paketleme: ${PAKETLEME_LABEL[p.paketleme] || p.paketleme}`);
  if (p.kirilacak === 'evet') satirlar.push('Kırılacak / hassas eşya var');
  if (p.ambalaj === 'evet') satirlar.push('Ambalaj malzemesi firma tarafından temin edilecek');
  if (Array.isArray(p.specialItems) && p.specialItems.length && !(p.specialItems.length === 1 && p.specialItems[0] === 'yok')) {
    satirlar.push(`Özel eşyalar: ${p.specialItems.join(', ')}`);
  }
  satirlar.push(`Tarih: ${tarihMetni(p, p.moveDate)}`);
  return ortakKuyruk(satirlar, p);
}

// ---- Parça Eşya Taşıma ----
function buildSonMesajParcaEsya(p) {
  const satirlar = [];
  satirlar.push(`${p.fromCity || '-'}/${p.fromDistrict || '-'} → ${p.toCity || '-'}/${p.toDistrict || '-'}`);
  if (p.homeSize) satirlar.push(`Kapsam: ${PARCA_KAPSAM_LABEL[p.homeSize] || p.homeSize}`);
  if (p.fromFloor || p.toFloor) satirlar.push(`Kat: ${p.fromFloor ?? '-'} → ${p.toFloor ?? '-'}`);
  if (p.fromElevator) satirlar.push(`Çıkış asansör: ${ELEVATOR_LABEL[p.fromElevator] || p.fromElevator}`);
  if (p.toElevator) satirlar.push(`Varış asansör: ${ELEVATOR_LABEL[p.toElevator] || p.toElevator}`);
  if (p.paketleme) satirlar.push(`Paketleme: ${PAKETLEME_LABEL[p.paketleme] || p.paketleme}`);
  if (p.kirilacak === 'evet') satirlar.push('Kırılacak / hassas eşya var');
  if (p.ambalaj === 'evet') satirlar.push('Ambalaj malzemesi firma tarafından temin edilecek');
  if (Array.isArray(p.specialItems) && p.specialItems.length && !(p.specialItems.length === 1 && p.specialItems[0] === 'yok')) {
    satirlar.push(`Özel eşyalar: ${p.specialItems.join(', ')}`);
  }
  satirlar.push(`Tarih: ${tarihMetni(p, p.moveDate)}`);
  return ortakKuyruk(satirlar, p);
}

// ---- Ofis ve İşyeri Taşıma ----
function buildSonMesajOfis(p) {
  const satirlar = [];
  satirlar.push(`${p.fromCity || '-'}/${p.fromDistrict || '-'} → ${p.toCity || '-'}/${p.toDistrict || '-'}`);
  if (p.companyName) satirlar.push(`Firma: ${p.companyName}`);
  if (p.homeSize) satirlar.push(`Ofis Büyüklüğü: ${OFIS_BUYUKLUK_LABEL[p.homeSize] || p.homeSize}`);
  if (p.fromFloor || p.toFloor) satirlar.push(`Kat: ${p.fromFloor ?? '-'} → ${p.toFloor ?? '-'}`);
  if (p.fromElevator) satirlar.push(`Çıkış: ${ELEVATOR_LABEL[p.fromElevator] || p.fromElevator}`);
  if (p.toElevator) satirlar.push(`Varış: ${ELEVATOR_LABEL[p.toElevator] || p.toElevator}`);
  if (p.paketleme) satirlar.push(`Hizmet Kapsamı: ${OFIS_HIZMET_LABEL[p.paketleme] || p.paketleme}`);
  if (p.kirilacak === 'evet') satirlar.push('Evrak / arşiv kutulama hizmeti isteniyor');
  if (p.ambalaj === 'evet') satirlar.push('Taşıma mesai saatleri dışında (akşam/hafta sonu) planlanacak');
  if (Array.isArray(p.specialItems) && p.specialItems.length && !(p.specialItems.length === 1 && p.specialItems[0] === 'yok')) {
    satirlar.push(`Özel ekipmanlar: ${p.specialItems.join(', ')}`);
  }
  satirlar.push(`Tarih: ${tarihMetni(p, p.moveDate)}`);
  return ortakKuyruk(satirlar, p);
}

// ---- Eşya Depolama ----
function buildSonMesajDepolama(p) {
  const satirlar = [];
  satirlar.push(`Eşyanın bulunduğu yer: ${p.fromCity || '-'}/${p.fromDistrict || '-'}`);
  if (p.homeSize) satirlar.push(`Depo Hacmi: ${DEPO_HACIM_LABEL[p.homeSize] || p.homeSize}`);
  if (p.fromFloor) satirlar.push(`Bulunduğu Kat: ${p.fromFloor}`);
  if (p.fromElevator) satirlar.push(`Asansör: ${ELEVATOR_LABEL[p.fromElevator] || p.fromElevator}`);
  if (p.sureKiralama) satirlar.push(`Kiralama Süresi: ${SURE_KIRALAMA_LABEL[p.sureKiralama] || p.sureKiralama}`);
  if (p.alimTeslim) satirlar.push(`Alım/Teslim: ${ALIM_TESLIM_LABEL[p.alimTeslim] || p.alimTeslim}`);
  // DEĞİŞTİ (kullanıcı talebi): "Kutulama" → "Toplama"; sihirbaz artık kendim | firma gönderiyor
  if (p.paketleme) satirlar.push(`Toplama: ${TOPLAMA_LABEL[p.paketleme] || PAKETLEME_LABEL[p.paketleme] || p.paketleme}`);
  if (p.kirilacak === 'evet') satirlar.push('Kırılacak / hassas eşya var');
  if (p.ambalaj === 'evet') satirlar.push('Ambalaj malzemesi firma tarafından temin edilecek');
  if (Array.isArray(p.specialItems) && p.specialItems.length && !(p.specialItems.length === 1 && p.specialItems[0] === 'yok')) {
    satirlar.push(`Özel eşyalar: ${p.specialItems.join(', ')}`);
  }
  satirlar.push(`Depoya Giriş Tarihi: ${tarihMetni(p, p.moveDate)}`);
  return ortakKuyruk(satirlar, p);
}

// ---- Asansör Kiralama ----
function buildSonMesajAsansor(p) {
  const satirlar = [];
  satirlar.push(`Kurulum yeri: ${p.kurulumCity || '-'}/${p.kurulumDistrict || '-'}`);
  if (p.kullanimAmaci) satirlar.push(`Kullanım Amacı: ${KULLANIM_AMACI_LABEL[p.kullanimAmaci] || p.kullanimAmaci}`);
  if (p.asansorTaraf) satirlar.push(`Kurulum: ${ASANSOR_TARAF_LABEL[p.asansorTaraf] || p.asansorTaraf}`);
  if (p.isHacmi) satirlar.push(`İş Hacmi: ${IS_HACMI_LABEL[p.isHacmi] || p.isHacmi}`);
  if (p.kiralamaSuresi) satirlar.push(`Süre: ${KIRALAMA_SURESI_LABEL[p.kiralamaSuresi] || p.kiralamaSuresi}`);
  if (p.aracYanasma) satirlar.push(`Araç Yanaşma: ${ARAC_YANASMA_LABEL[p.aracYanasma] || p.aracYanasma}`);
  if (p.kurulumKat) satirlar.push(`Kat: ${KURULUM_KAT_LABEL[p.kurulumKat] || p.kurulumKat}`);
  satirlar.push(`Tarih: ${p.moveDate || '-'}`);
  return ortakKuyruk(satirlar, p);
}

// ---- DepoEvim (depoevim.com) Eşya Depolama ----
// DİKKAT: Bu, yukarıdaki Sembol'ün kendi "depolama" wizard'ından FARKLI bir
// form — depoevim.com'un site geneli marka rengiyle (mavi) ve kendi
// şube/teslim şekli/fiyat mantığıyla çalışıyor. Alan adları da farklı
// (fromCity/fromDistrict yerine "sube"), bu yüzden ayrı bir builder gerekiyor.
function buildSonMesajDepoEvim(p) {
  const satirlar = [];
  if (p.depoBoyutu) satirlar.push(`Depo Boyutu: ${DEPOEVIM_BOYUT_LABEL[p.depoBoyutu] || p.depoBoyutu}`);
  if (p.kiralamaSuresi) satirlar.push(`Kiralama Süresi: ${SURE_KIRALAMA_LABEL[p.kiralamaSuresi] || p.kiralamaSuresi}`);
  if (p.sube) satirlar.push(`Şube: ${DEPOEVIM_SUBE_LABEL[p.sube] || p.sube}`);
  if (p.teslimSekli) satirlar.push(`Teslim Şekli: ${DEPOEVIM_TESLIM_LABEL[p.teslimSekli] || p.teslimSekli}`);
  // YENİ: "Firma adresimden alsın (Anahtar Teslim)" seçilince 2. adımda
  // alınan İl/İlçe ve buna bağlı tahmini nakliye (toplama) ücreti — bu iki
  // alan CRM özet metninde EKSİKTİ (payload'da geliyordu ama sonMesaj'a hiç
  // yazılmıyordu, o yüzden "Teklif Detayı" penceresinde hiç görünmüyorlardı).
  // Etiketler Satis.jsx'teki TEKLIF_ALANLARI listesindeki adlarla BİREBİR
  // aynı olmak zorunda, yoksa ayrıştırıcı bunları ayrı satır olarak yakalayıp
  // bölemez — bir önceki alanın değerine yapışık görünürler.
  if (p.pickupCity) satirlar.push(`Eşyaların Alınacağı Yer: ${p.pickupCity}${p.pickupDistrict ? '/' + p.pickupDistrict : ''}`);
  // DÜZELTME: DepoEvim sihirbazı "dateFlexible" GÖNDERMİYOR — tarih adımı
  // isteğe bağlı bir tarih + "Bu hafta" gibi hızlı seçim + not. Hiçbiri
  // seçilmediyse de satır "Esnek" olarak gösterilir (eskiden hiç çıkmıyordu).
  satirlar.push(`Başlangıç Tarihi: ${tarihMetni(p, p.baslangicTarihi, 'Esnek')}`);
  if (p.fiyatAylik) satirlar.push(`Aylık Fiyat: ${fmtTL(p.fiyatAylik)} TL`);
  if (p.fiyatToplam) satirlar.push(`Toplam Ödenecek (peşin): ${fmtTL(p.fiyatToplam)} TL`);
  if (p.nakliyeMin) satirlar.push(`Tahmini Alım/Nakliye Ücreti: ${fmtTL(p.nakliyeMin)} - ${fmtTL(p.nakliyeMax || p.nakliyeMin)} TL`);
  return ortakKuyruk(satirlar, p);
}

// ---- DepoEvim WooCommerce Siparişi (iyzico ile ödeme alınmış) ----
// Bu, bir "teklif talebi" DEĞİL, ödemesi zaten tamamlanmış GERÇEK bir sipariş
// — WordPress tarafında bir PHP snippet (woocommerce_payment_complete hook'u)
// tarafından gönderiliyor. Alan adları wizard'lardan farklı: urunler,
// toplamTutar, siparisNo, odemeYontemi, faturaAdresi.
function buildSonMesajDepoEvimSiparis(p) {
  const satirlar = [];
  if (p.siparisNo) satirlar.push(`Sipariş No: #${p.siparisNo}`);
  if (p.urunler) satirlar.push(`Ürün(ler): ${p.urunler}`);
  if (p.toplamTutar) satirlar.push(`Ödenen Tutar: ${fmtTL(p.toplamTutar)} TL`);
  if (p.odemeYontemi) satirlar.push(`Ödeme Yöntemi: ${p.odemeYontemi}`);
  if (p.faturaAdresi) satirlar.push(`Adres: ${p.faturaAdresi}`);
  satirlar.push('Ödeme başarıyla alındı — bu bir teklif talebi değil, kesinleşmiş sipariş.');
  return ortakKuyruk(satirlar, p);
}

const SON_MESAJ_BUILDERS = {
  evdenEve: buildSonMesajEvdenEve,
  parcaEsya: buildSonMesajParcaEsya,
  ofis: buildSonMesajOfis,
  depolama: buildSonMesajDepolama,
  asansor: buildSonMesajAsansor,
  depoevimDepolama: buildSonMesajDepoEvim,
  depoevimSiparis: buildSonMesajDepoEvimSiparis,
};

// YENİ (Ali'nin talebi): DepoEvim sihirbazında müşteri "Eşyalarımı kendim
// getiririm" (teslimSekli === 'kendim') derse, firma hiçbir alım/nakliye işi
// yapmıyor — müşteri sadece boş depo alanı kiralıyor demektir. Bu yüzden satış
// ekibinin listede gördüğü başlık bu durumda "DepoEvim - Depo Kiralama"
// olmalı; "Firma adresimden alsın (Anahtar Teslim)" seçilirse (firma eşyayı
// alıp getiriyor, gerçek bir "eşya depolama" hizmeti) başlık eskisi gibi
// "DepoEvim - Eşya Depolama" kalır. Yalnızca BAŞLIK (köşeli parantez) değişir;
// hizmetTipi hâlâ 'Depo' — filtre/istatistik davranışı etkilenmez.
function wizardBasligi(wizardType, p) {
  if (wizardType === 'depoevimDepolama' && p.teslimSekli === 'kendim') return 'DepoEvim - Depo Kiralama';
  return WIZARD_ETIKET[wizardType] || 'Web Formu';
}

export function buildSonMesaj(wizardType, p) {
  const builder = SON_MESAJ_BUILDERS[wizardType] || buildSonMesajEvdenEve;
  const govde = builder(p).join('\n');
  return `[${wizardBasligi(wizardType, p)}]\n${govde}`;
}

// YENİ (kullanıcı talebi): Teklif Detayı kartının satır satır gösterdiği ham
// alanlar. Her kayıtta TÜM anahtarlar yazılır (gelmeyen = ''), çünkü kayıt
// merge:true ile güncelleniyor — müşteri sonradan boşalttığı bir seçimin eski
// değeri ara kayıtlardan kalmasın. Eski kayıtlarda bu alan yoktur; kart onları
// eskisi gibi sonMesaj metninden gösterir.
export const TEKLIF_ALANLARI_BY_WIZARD = {
  depolama: ['homeSize', 'fromCity', 'fromDistrict', 'fromFloor', 'fromElevator', 'sureKiralama', 'alimTeslim',
    'paketleme', 'fromYurume', 'moveDate', 'tarihTercihi', 'tarihNotu', 'dateFlexible',
    'fiyatAylik', 'fiyatToplam', 'nakliyeMin', 'nakliyeMax', 'nakliyeEk', 'priceMin', 'priceMax', 'fiyatVersiyonu'],
  depoevimDepolama: ['depoBoyutu', 'kiralamaSuresi', 'sube', 'teslimSekli', 'pickupCity', 'pickupDistrict', 'pickupFloor',
    'pickupElevator', 'paketleme', 'pickupYurume', 'baslangicTarihi', 'tarihTercihi', 'tarihNotu',
    'fiyatAylik', 'fiyatToplam', 'nakliyeMin', 'nakliyeMax', 'nakliyeEk', 'priceMin', 'priceMax', 'fiyatVersiyonu'],
};
export function teklifAlanlariAl(wizardType, body) {
  const o = { tur: wizardType };
  TEKLIF_ALANLARI_BY_WIZARD[wizardType].forEach(function (k) {
    const v = body[k];
    if (typeof v === 'number' || typeof v === 'boolean') o[k] = v;
    else o[k] = v == null ? '' : String(v).slice(0, 300);
  });
  return o;
}

// Her form türünün güzergah/lokasyon bilgisini tek tip bir "guzergah" nesnesine
// toplar (Satis.jsx bu alanı doğrudan render etmiyor, sadece kayıt içinde
// referans amaçlı tutuluyor — o yüzden tür bazında eksik alan sorun yaratmaz).
export function buildGuzergah(wizardType, body) {
  if (wizardType === 'depolama') {
    return {
      fromCity: body.fromCity || '', fromDistrict: body.fromDistrict || '',
      fromFloor: body.fromFloor || '', fromElevator: body.fromElevator || '',
    };
  }
  if (wizardType === 'asansor') {
    return {
      fromCity: body.kurulumCity || '', fromDistrict: body.kurulumDistrict || '',
    };
  }
  if (wizardType === 'depoevimDepolama') {
    // Bu wizard'da şehir/ilçe yok, müşteri bir DepoEvim şubesi seçiyor.
    return { fromDistrict: DEPOEVIM_SUBE_LABEL[body.sube] || body.sube || '' };
  }
  if (wizardType === 'depoevimSiparis') {
    // WooCommerce sipariş adresini olduğu gibi tutuyoruz.
    return { fromDistrict: body.faturaAdresi || '' };
  }
  // evdenEve / parcaEsya / ofis
  return {
    fromCity: body.fromCity || '', fromDistrict: body.fromDistrict || '',
    fromFloor: body.fromFloor || '', fromElevator: body.fromElevator || '',
    toCity: body.toCity || '', toDistrict: body.toDistrict || '',
    toFloor: body.toFloor || '', toElevator: body.toElevator || '',
  };
}


// ============================================================================
// ORTAK: web sihirbazı kaydı — submit-lead.js'in havuzKayitlari'na yazdığı belge.
// (Kayıt mantığı submit-lead.js'ten AYNEN taşındı; WhatsApp botu da aynı sözlükleri
// ve sonMesaj üreticilerini kullanır — bkz. whatsappLeadKaydi.)
//   onceki   → belgenin mevcut verisi ({} = yok) · ilkKayit → belge yoksa true
//   döner    → { kayit, pazarlama } — çağıran ref.set(kayit, { merge: true }) yapar
// ============================================================================
export function webLeadKaydi({ body, req, wizardType, onceki = {}, ilkKayit, nowIso = new Date().toISOString() }) {
  // YENİ (yapay zeka kaynakları): UTM / referrer / iniş adresi izi. Yalnızca
  // dolu alanlar yazılır (merge:true — sonraki ara kayıt eski izi silmez);
  // sınıflandırma, önceki kayıttaki iz ile bu gönderimdeki iz birleştirilerek
  // yapılır (bkz. api/_lib/pazarlama.js → reklamKaynagiKarar).
  const yeniPazarlama = pazarlamaOku(body);
  const pazarlama = { ...(onceki.pazarlama || {}), ...yeniPazarlama };
  const kaynakKarari = reklamKaynagiKarar(body.reklamKaynagi, pazarlama);

  const kayit = {
    kanal: KANAL_BY_WIZARD[wizardType] || 'web',
    musteriAdi: String(body.fullName || '').trim(),
    iletisim: String(body.phone || '').trim(),
    hesapId: SITE_BY_WIZARD[wizardType] || 'sembolevdeneve',
    hizmetTipi: HIZMET_TIPI_BY_WIZARD[wizardType] || 'Nakliye',
    sonMesaj: buildSonMesaj(wizardType, body),
    kaynak: `web-sihirbaz-${wizardType}`,
    wizardKaynagi: body.source || '',
    // Ziyaretçi Google reklamından mı (gclid/utm_source=google&utm_medium=cpc),
    // Meta (Facebook/Instagram) reklamından mı (fbclid/utm_source=facebook
    // veya instagram), organik Google/Facebook/Instagram'dan mı yoksa direkt
    // mi geldi — wizard sayfa yüklenirken URL'den/referrer'dan okuyup
    // gönderiyor (bkz. wizard dosyasındaki REKLAM_KAYNAGI / snwKaynakOkuTam).
    // Eski wizard sürümleri bu alanı hiç göndermez, o yüzden varsayılan
    // 'direkt_giris'; tanınmayan bir değer de güvenli şekilde 'direkt_giris'
    // sayılır (eskiden bu iki durumda da 'organik' kovasına düşerdi).
    // YENİ: tarayıcının değeri sunucunun yapay zeka sınıflandırmasıyla
    // birleştirilir (ödemeli reklam > tarayıcı > sunucu tahmini);
    // kaynakKarari hangi kuralın kazandığını tutar.
    reklamKaynagi: kaynakKarari.reklamKaynagi,
    kaynakKarari: kaynakKarari.karar,
    ...(Object.keys(yeniPazarlama).length ? { pazarlama: yeniPazarlama } : {}),
    // "google_anasayfa"/"google_altsayfa"/"diger_site" kategorilerinde HANGİ
    // sayfaya düşüldüğü ve (varsa) HANGİ dış sitenin yönlendirdiği — wizard
    // bunu document.referrer + location.pathname'den hesaplayıp gönderiyor.
    // Boşsa CRM tarafında hiç gösterilmez.
    inisSayfasi: String(body.inisSayfasi || '').trim(),
    digerSiteAdi: String(body.digerSiteAdi || '').trim(),

    // Wizard'ın kendi akış durumu (partial/completed/callback_requested).
    // DİKKAT: CRM'in satış-hattı durumu olan "durum" alanıyla KARIŞTIRILMAMALI —
    // o alana sadece ilk oluşturmada dokunuyoruz (aşağıda).
    wizardDurumu: body.status || 'partial',
    wizardGuncelleme: body.updatedAt || nowIso,

    fiyatTahminiMin: body.priceMin || null,
    fiyatTahminiMax: body.priceMax || null,
    fotograflar: Array.isArray(body.photoUrls) ? body.photoUrls : [],
    kvkkOnay: !!body.kvkkConsent,
    geriAramaTalebi: !!body.callbackRequested,

    guzergah: buildGuzergah(wizardType, body),
    paketlemeTercihi: body.paketleme || '',
    kirilacakEsya: body.kirilacak || '',
    ambalajTalebi: body.ambalaj || '',
    // depoevimDepolama "moveDate" değil "baslangicTarihi" gönderiyor — diğer
    // wizard'lar baslangicTarihi hiç göndermediği için bu satır onları etkilemez.
    tasinmaTarihi: body.moveDate || body.baslangicTarihi || '',
    tarihEsnek: !!body.dateFlexible,
    ozelEsyalar: Array.isArray(body.specialItems) ? body.specialItems : [],
    // YENİ (kullanıcı talebi): depolama sihirbazlarının ham alanları — Teklif
    // Detayı kartı bu kayıtlarda satırları buradan üretir (src/teklifDetay.js).
    ...(TEKLIF_ALANLARI_BY_WIZARD[wizardType] ? { teklifAlanlari: teklifAlanlariAl(wizardType, body) } : {}),

    updatedAt: nowIso,
  };

  // YENİ (QR TAKİP): QR/UTM izi varsa kayda yaz. Reklam kaynağı ödemeli bir
  // reklam DEĞİLSE (google_ads/facebook_ads/instagram_ads) 'qr' olarak
  // işaretlenir — Google/Meta reklamıysa o etiket korunur. DÜZELTME: eskiden
  // sadece tam olarak 'organik' değerinin üzerine yazılıyordu; artık
  // google_anasayfa/google_altsayfa/facebook_organik/instagram_organik/
  // direkt_giris/diger_site kategorilerinin de üzerine yazar, aksi halde
  // QR'dan gelip "Google Anasayfa" ya da "Direkt Giriş" sayılan ziyaretçiler
  // yanlışlıkla QR kampanyasına bağlanmazdı.
  // QR izi yine de ayrı alanlarda durur — CRM kampanyayı qrKodu ile bağlar.
  // QR kararı TARAYICIDA verilir (sembol-qr-takip.js sürüm 3): QR izi yalnızca
  // bu ziyaret QR'lı bir adresle başladıysa vardır — siteye QR'sız her yeni
  // girişte (Google, direkt, sosyal medya, reklam) iz silinir. Bu yüzden iz
  // geldiyse ziyaret QR'dandır ve sihirbazın hesapladığı kaynağın üzerine yazar.
  // DİKKAT: sihirbazın kaynağına bakılarak QR ELENMEZ — telefon kamerası QR'ı
  // Google Lens / Google uygulaması üzerinden açınca önceki sayfa google.com
  // görünür ve sihirbaz ziyareti "Google Anasayfa/Altsayfa" sayar; QR yine de
  // doğru kaynaktır. Yalnızca ödemeli reklam etiketi korunur.
  const qrIzi = qrIziniCoz(body, req);
  const qrGercekMi = !!qrIzi && String(qrIzi.utmSource).toLowerCase() === 'qr';
  if (qrGercekMi && !PAID_ADS_DEGERLERI.includes(kayit.reklamKaynagi)) {
    kayit.qrKodu = qrIzi.qrKodu;
    kayit.utmSource = qrIzi.utmSource;
    kayit.utmMedium = qrIzi.utmMedium;
    kayit.utmCampaign = qrIzi.utmCampaign;
    kayit.sayfaUrl = qrIzi.sayfaUrl;
    kayit.qrIziZamani = qrIzi.qrIziZamani;
    // QR'dan önceki asıl kaynak saklanır — CRM'de "Bağı kaldır (QR değil)"
    // seçilirse kayıt bu değere geri döner.
    kayit.oncekiReklamKaynagi = kayit.reklamKaynagi;
    kayit.reklamKaynagi = 'qr';
  } else if (qrGercekMi) {
    // Yalnızca bilgi amaçlı (CRM bununla eşleştirme YAPMAZ).
    kayit.yoksayilanQrIzi = { qrKodu: qrIzi.qrKodu, qrIziZamani: qrIzi.qrIziZamani };
  }

  if (ilkKayit) {
    // İlk kayıt — Müşteri Havuzu'nun beklediği satış-hattı alanlarını burada açıyoruz.
    // depoevimSiparis İSTİSNA: bu bir "olası müşteri" değil, ödemesi zaten
    // tamamlanmış kesin bir sipariş — satış ekibini "yeni takip gerekiyor"
    // diye yanıltmamak için doğrudan "İşi Aldık" durumunda açılıyor.
    kayit.durum = wizardType === 'depoevimSiparis' ? 'İşi Aldık' : 'Yeni';
    kayit.atanan = '';
    kayit.notlar = [];
    kayit.hareketler = [{
      tarih: nowIso, kullanici: wizardType === 'depoevimSiparis' ? 'WooCommerce' : 'Web Sihirbazı',
      islem: wizardType === 'depoevimSiparis'
        ? `WooCommerce üzerinden ödemesi tamamlanmış yeni sipariş (#${body.siparisNo || '-'})`
        : `Web sitesinden yeni teklif talebi alındı (${WIZARD_ETIKET[wizardType] || 'Web Formu'})${qrIzi ? ` — QR: ${qrIzi.qrKodu}` : ''}`,
    }];
    kayit.createdAt = nowIso;
  } else if (body.status === 'completed' || body.status === 'callback_requested') {
    // Sadece anlamlı kilometre taşlarında hareket geçmişine bir satır ekliyoruz;
    // her debounce'lu ara-kayıtta hareketler listesini şişirmiyoruz.
    const not = body.status === 'completed'
      ? 'Müşteri formu tamamladı'
      : 'Müşteri "Beni Siz Arayın" talebinde bulundu';
    kayit.hareketler = [...(onceki.hareketler || []), { tarih: nowIso, kullanici: 'Web Sihirbazı', islem: not }];
  }
  // Not: durum/atanan/notlar/hareketler burada listede YOK ise, merge:true
  // sayesinde satış ekibinin CRM'de yaptığı değişiklikler korunur.
  return { kayit, pazarlama };
}

// ============================================================================
// WHATSAPP LEAD'İ (SEMBO Asistan botu) — sihirbaz kaydıyla AYNI biçim
// ----------------------------------------------------------------------------
// Bot sohbette sihirbazın alan adlarıyla ("homeSize", "fromCity", "pickupCity" …)
// bilgi toplar; bu fonksiyon onları sihirbaz gövdesine çevirip AYNI sonMesaj /
// teklifAlanlari / guzergah üreticilerinden geçirir. Farklar (Ali'nin kararları):
//   kanal 'whatsapp' · kaynak 'whatsapp' · kayitTipi 'whatsapp-bot'
//   kvkkOnay YAZILMAZ — yerine kvkkAydinlatma / kvkkAydinlatmaKanal / kvkkAydinlatmaTarihi
//   Ref kodu yoksa reklamKaynagi 'direkt_giris'; ref'li tıklama kaydına bağlanırsa
//   o kaydın reklamKaynagi / QR izi KORUNUR (üzerine yazılmaz).
// Marka hizmetTipi + hesapId'den okunur: DepoEvim → 'Depo' + 'depoevim'.
// ============================================================================

// İş kapandıysa (bu durumlarda) aynı numaradan gelen yeni talep YENİ lead açar
export const KAPALI_LEAD_DURUMLARI = ['İşi Aldık', 'Reddedildi'];
export const leadAcikMi = (k) => !!k && !KAPALI_LEAD_DURUMLARI.includes(k.durum || 'Yeni');

// Site WhatsApp butonunun mesaja eklediği ref: "(Ref: SB-7K2QF)" / "(Ref: DE-…)"
// SB → Sembol (sembolevdeneve.com), DE → DepoEvim (depoevim.com)
const REF_DESENI = /\(?\s*Ref\s*:\s*(SB|DE)-([A-Z0-9]{4,10})\s*\)?/i;
export function refKoduBul(metin) {
  const m = String(metin || '').match(REF_DESENI);
  if (!m) return null;
  const onEk = m[1].toUpperCase();
  return { kod: `${onEk}-${m[2].toUpperCase()}`, marka: onEk === 'DE' ? 'depoevim' : 'sembol' };
}
// Ref kodu müşteriye / yapay zekaya gösterilmez — metinden çıkarılır
export const refKoduTemizle = (metin) => String(metin || '').replace(REF_DESENI, '').replace(/[ \t]{2,}/g, ' ').trim();
// Tıklama kaydı (api/yeni-musteri.js) ile bot lead'inin ORTAK belge kimliği
export const refBelgeId = (kod) => `ref_${String(kod || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)}`;

// WhatsApp numarası (wa_id, ör. "905321234567") → CRM'in iletişim biçimi "0532 123 45 67".
// Türkiye dışı numaralar rakam olarak kalır (CRM'deki wa.me bağlantısı bozulmaz).
export function waTelefonCrm(waId) {
  const d = String(waId || '').replace(/\D/g, '');
  if (/^90\d{10}$/.test(d)) { const n = '0' + d.slice(2); return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7, 9)} ${n.slice(9)}`; }
  return d;
}

// Botun hizmet niyeti → sihirbaz türü (sonMesaj biçimi ve hizmetTipi buna göre)
export function whatsappWizardTuru(marka, hizmet) {
  if (marka === 'depoevim') return 'depoevimDepolama';
  return ({ depolama: 'depolama', asansor_kiralama: 'asansor', parca_esya: 'parcaEsya', ofis: 'ofis' })[hizmet] || 'evdenEve';
}

// Botun yazabileceği sihirbaz alanları (başka anahtar kayda girmez)
export const WHATSAPP_ALANLARI = [
  'fullName', 'homeSize', 'companyName',
  'fromCity', 'fromDistrict', 'fromFloor', 'fromElevator', 'fromYurume',
  'toCity', 'toDistrict', 'toFloor', 'toElevator', 'toYurume',
  'paketleme', 'moveDate', 'dateFlexible', 'tarihTercihi', 'tarihNotu', 'specialItems',
  // Sembol depolama
  'sureKiralama', 'alimTeslim',
  // DepoEvim
  'depoBoyutu', 'kiralamaSuresi', 'sube', 'teslimSekli', 'pickupCity', 'pickupDistrict', 'pickupFloor',
  'pickupElevator', 'pickupYurume', 'baslangicTarihi',
  // Asansör kiralama
  'kurulumCity', 'kurulumDistrict', 'kullanimAmaci', 'asansorTaraf', 'isHacmi', 'aracYanasma', 'kurulumKat',
];
export function whatsappAlanlariniTemizle(c) {
  const o = {};
  WHATSAPP_ALANLARI.forEach(k => {
    const v = c?.[k];
    if (v == null || v === '') return;
    if (k === 'dateFlexible') o[k] = v === true || v === 'true';
    else if (k === 'specialItems') { if (Array.isArray(v)) o[k] = v.map(x => String(x).slice(0, 60)).slice(0, 20); }
    else if (typeof v === 'number') o[k] = v;
    else o[k] = String(v).replace(/\s+/g, ' ').trim().slice(0, 200);
  });
  return o;
}

// fiyat: sunucunun hesapladığı tahmin (yapay zeka hesaplamaz) —
//   Sembol: { min, max } · DepoEvim: { aylik, toplam, nakliyeMin, nakliyeMax }
export function whatsappLeadKaydi({ marka = 'sembol', hizmet = '', collected = {}, waId, profilAdi = '', onceki = {}, ilkKayit,
  tamamlandi = false, fiyat = null, nowIso = new Date().toISOString() }) {
  const wizardType = whatsappWizardTuru(marka, hizmet);
  const alanlar = whatsappAlanlariniTemizle(collected);
  const body = { ...alanlar, phone: waTelefonCrm(waId) };
  if (fiyat?.min) { body.priceMin = fiyat.min; body.priceMax = fiyat.max || fiyat.min; }
  if (fiyat?.aylik) body.fiyatAylik = fiyat.aylik;
  if (fiyat?.toplam) body.fiyatToplam = fiyat.toplam;
  if (fiyat?.nakliyeMin) { body.nakliyeMin = fiyat.nakliyeMin; body.nakliyeMax = fiyat.nakliyeMax || fiyat.nakliyeMin; }

  // Ad: müşterinin teyit ettiği ad > CRM'de zaten yazılı gerçek ad > WhatsApp profil adı
  const oncekiAd = onceki.sadeceTiklama ? '' : String(onceki.musteriAdi || '').trim();
  const musteriAdi = alanlar.fullName || oncekiAd || String(profilAdi || '').trim() || 'WhatsApp Müşterisi';

  const kayit = {
    kanal: 'whatsapp',
    musteriAdi,
    iletisim: body.phone,
    hesapId: SITE_BY_WIZARD[wizardType] || 'sembolevdeneve',
    hizmetTipi: HIZMET_TIPI_BY_WIZARD[wizardType] || 'Nakliye',
    sonMesaj: buildSonMesaj(wizardType, body),
    kaynak: 'whatsapp',
    kayitTipi: 'whatsapp-bot',
    sadeceTiklama: false,
    wizardDurumu: tamamlandi ? 'completed' : 'partial',
    wizardGuncelleme: nowIso,
    fiyatTahminiMin: body.priceMin || null,
    fiyatTahminiMax: body.priceMax || null,
    guzergah: buildGuzergah(wizardType, body),
    paketlemeTercihi: body.paketleme || '',
    tasinmaTarihi: body.moveDate || body.baslangicTarihi || '',
    tarihEsnek: !!body.dateFlexible,
    ...(TEKLIF_ALANLARI_BY_WIZARD[wizardType] ? { teklifAlanlari: teklifAlanlariAl(wizardType, body) } : {}),
    whatsapp: { waId: String(waId || ''), profilAdi: String(profilAdi || '').slice(0, 100) },
    updatedAt: nowIso,
  };
  // KVKK: aydınlatma metni botun ilk mesajında verildi (açık rıza / kvkkOnay DEĞİL)
  if (!onceki.kvkkAydinlatmaTarihi) {
    kayit.kvkkAydinlatma = true;
    kayit.kvkkAydinlatmaKanal = 'whatsapp';
    kayit.kvkkAydinlatmaTarihi = nowIso;
  }

  const hareket = (islem) => ({ tarih: nowIso, kullanici: 'WhatsApp Bot', islem });
  if (ilkKayit) {
    kayit.durum = 'Yeni';
    kayit.atanan = '';
    kayit.notlar = [];
    kayit.reklamKaynagi = 'direkt_giris';
    kayit.kaynakKarari = 'varsayilan';
    kayit.hareketler = [hareket(`WhatsApp'tan yeni talep (SEMBO Asistan · ${WIZARD_ETIKET[wizardType] || 'WhatsApp'})`)];
    kayit.createdAt = nowIso;
  } else if (onceki.sadeceTiklama) {
    // Sitedeki WhatsApp butonu tıklaması (ref kodu) — reklam kaynağı / QR izi korunur
    kayit.hareketler = [...(onceki.hareketler || []), hareket('Ziyaretçi WhatsApp\'tan yazdı — bot görüşmesi bu kayda bağlandı')];
  } else if (tamamlandi && onceki.wizardDurumu !== 'completed') {
    kayit.hareketler = [...(onceki.hareketler || []), hareket('Bot gerekli bilgileri tamamladı')];
  }
  return { kayit, wizardType };
}
