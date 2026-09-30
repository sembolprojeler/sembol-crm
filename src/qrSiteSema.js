// src/qrSiteSema.js
// ============================================================================
// QR SİTE TAKİP ŞEMASI — CRM ekranı ile /api/qr-site'ın ORTAK tanımı
// ----------------------------------------------------------------------------
// Asansör afişi QR'larının herkese açık sayfası WordPress'tedir
// (sembolevdeneve.com/sembol-nakliyat-pro/?yer=<qrSiteler id>) ve Firestore'a
// yalnızca api/qr-site.js üzerinden ulaşır. Hizmet / randevu saati listeleri
// ve telefon kuralı hem CRM'de (Satis.jsx) hem API'de BURADAN okunur —
// ikisi hiçbir zaman ayrışmaz. (WordPress sayfasındaki AYAR listeleri de
// bunlarla aynı tutulmalıdır.)
//
// React / Firebase içermez; hem tarayıcıda (Satis.jsx) hem Vercel
// fonksiyonunda (api/qr-site.js) çalışır.
// ============================================================================

// Herkese açık sayfanın adresi. Parametre adı bilerek "yer": sitedeki
// sembol-qr-takip.js "?qr=" parametresini reklam QR kampanya kodu sayar.
export const QR_SITE_LANDING_URL = 'https://www.sembolevdeneve.com/sembol-nakliyat-pro/';

// Temsilcinin şirket hattı yoksa sakine gösterilen merkez numarası
export const QR_SIRKET_TELEFONU = '0554 726 16 61';

// Sakinin seçebileceği hizmet türleri (bilgi formunda, isteğe bağlı)
export const QR_HIZMETLER = ['Evden Eve Nakliyat', 'Asansörlü Taşıma', 'Depolama', 'Ofis Taşıma', 'Diğer'];

// Randevu saat dilimleri (keşif formu)
export const QR_RANDEVU_SAATLERI = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

// Telefonu WhatsApp/tel formatına çevirir (0555... → 90555...)
export const qrTelefonNormalize = (ham) => {
  let tel = String(ham || '').replace(/\D/g, '');
  if (!tel) return '';
  if (tel.startsWith('0')) tel = '90' + tel.substring(1);
  else if (!tel.startsWith('90')) tel = '90' + tel;
  return tel;
};

// Basit Türkiye cep telefonu doğrulaması (10 hane, 5 ile başlar; 0 / 90 öneki olabilir)
export const qrTelefonGecerliMi = (ham) => {
  const tel = String(ham || '').replace(/\D/g, '');
  const yalın = tel.startsWith('90') ? tel.substring(2) : tel.startsWith('0') ? tel.substring(1) : tel;
  return yalın.length === 10 && yalın.startsWith('5');
};
