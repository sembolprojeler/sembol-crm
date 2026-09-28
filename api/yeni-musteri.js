// api/yeni-musteri.js
// ============================================================================
// Sembol CRM — Site Tıklama Bildirimi (WhatsApp / Telefon)
// ----------------------------------------------------------------------------
// Bu uç, Ali'nin AÇIKLADIĞI ve zaten sembolevdeneve.com'da ÇALIŞAN sistemin
// GÜVENLİ ve HATASIZ hâlidir. Amaç DEĞİŞMEDİ: bir ziyaretçi sitedeki
// WhatsApp/telefon butonuna bastığında, satış ekibinin Müşteri Havuzu'nda
// (Satis.jsx) o kanalın (Telefon Çağrıları / WhatsApp Mesajları) sekmesinde
// GERÇEK bir çağrı/mesaj gibi görünen bir kayıt açılır — isim/telefon henüz
// bilinmese bile ("Google Ads Ziyaretçisi" / "Organik Ziyaretçi" olarak).
//
// BU DOSYADA NE DEĞİŞTİ VE NEDEN:
//   1) GÜVENLİK: Eski sürüm tarayıcıdan (client) Firebase SDK'sı ve
//      "signInAnonymously" ile anonim oturum açıp Firestore güvenlik
//      kurallarını (Security Rules) "request.auth != null" şartını sağlayarak
//      AŞIYORDU. Bu, herkesin (bu sayfanın JS'ini okuyan biri) aynı anonim
//      girişi taklit ederek CRM'e istediği veriyi YAZABİLECEĞİ anlamına
//      geliyordu. Şimdi diğer tüm uçlarımız (submit-lead.js, track-click.js)
//      gibi SUNUCU tarafında firebase-admin SDK'sı kullanıyor — güvenlik
//      kurallarını admin yetkisiyle atlıyor, tarayıcıya HİÇBİR Firebase
//      anahtarı göndermiyor.
//   2) HİZMET TİPİ: Eski sürüm hizmetTipi'ni "Belirsiz" olarak sabitliyordu.
//      Ama CRM'den "Belirsiz" kategorisi TAMAMEN KALDIRILDI (artık öyle bir
//      seçenek yok). Bu yüzden site bazında mantıklı bir varsayıma geçtik:
//      DepoEvim sadece depolama hizmeti sattığı için "Depo", Sembol Nakliyat
//      sitesi (ve bilinmeyen/varsayılan durumlar) için "Nakliye".
//   3) CORS: Eski sürüm Access-Control-Allow-Origin: '*' (herkese açık)
//      kullanıyordu. Artık submit-lead.js/track-click.js ile AYNI
//      ALLOWED_ORIGINS listesini paylaşıyor.
//   4) ÇOK SİTELİ: "site" alanı artık hem sembolevdeneve.com hem depoevim.com
//      için kullanılabiliyor — aynı uç, iki sitenin de tıklamalarını kabul
//      eder.
//
// İSTEK SÖZLEŞMESİ (front-end tarafı DEĞİŞMEDEN çalışsın diye AYNEN korundu):
//   POST body: {
//     islem:  string   — örn. "Ziyaretçi WhatsApp butonuna bastı" (içinde
//                         "WhatsApp" geçiyorsa whatsapp, aksi halde telefon
//                         sayılır — eski davranışla BİREBİR aynı)
//     kaynak: string    — "google_ads" ise "Google Ads Ziyaretçisi",
//                         "facebook_ads" ise "Facebook Ads Ziyaretçisi",
//                         "instagram_ads" ise "Instagram Ads Ziyaretçisi",
//                         "facebook_organik"/"instagram_organik"/
//                         "google_anasayfa"/"google_altsayfa"/"diger_site"
//                         kendi etiketiyle, aksi halde "Direkt Giriş Ziyaretçisi"
//     site:   string    — "depoevim" | "sembolevdeneve" (hangi site)
//   }
// Yanıt sözleşmesi de AYNEN korundu: { success: true, message } veya
// { success: false, error, detay }.
//
// Gerekli ortam değişkenleri: submit-lead.js / track-click.js ile TAMAMEN
// AYNI (ayrıca bir kurulum GEREKMEZ):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
//   FIRESTORE_APP_ID, ALLOWED_ORIGINS
// ============================================================================

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'https://www.sembolevdeneve.com,https://www.depoevim.com')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Tarayıcı, "navigator.sendBeacon" ile gönderilen isteklere credentials'ı
  // (cookie vb.) OTOMATİK dahil ediyor — JS tarafından kapatılamıyor. Bu
  // yüzden sunucu bunu açıkça KABUL ETTİĞİNİ belirtmek zorunda, yoksa
  // tarayıcı isteği CORS hatasıyla engelliyor (yukarıdaki Origin echo zaten
  // '*' değil tam eşleşen origin olduğu için bu güvenli).
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// ============================================================================
// YENİ (Sembol CRM QR TAKİP): QR / UTM izi — submit-lead.js ile AYNI mantık.
// Ziyaretçi QR'dan gelip WhatsApp/telefon butonuna bastıysa tıklama kaydı da
// kampanyaya bağlanır (havuzda "34 NAR 385 QR (QR)" olarak görünür).
// ============================================================================
function normalizeKod(v) {
  return String(v || '').toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}
function paramsFromUrl(url) {
  try { const u = new URL(String(url)); return Object.fromEntries(u.searchParams.entries()); } catch { return {}; }
}
function qrIziniCoz(body, req) {
  body = body || {};
  const iz = (body.qrIzi && typeof body.qrIzi === 'object') ? body.qrIzi : {};
  const sayfaUrl = iz.sayfaUrl || body.sayfaUrl || body.pageUrl || body.href || (req && req.headers && req.headers.referer) || '';
  const p = paramsFromUrl(sayfaUrl);
  const utmSource = iz.utmSource || body.utm_source || p.utm_source || '';
  const utmMedium = iz.utmMedium || body.utm_medium || p.utm_medium || '';
  const utmCampaign = iz.utmCampaign || body.utm_campaign || body.kampanya || p.utm_campaign || '';
  const qrKodu = normalizeKod(iz.qr || body.qr || body.qrKodu || p.qr || (String(utmSource).toLowerCase() === 'qr' ? utmCampaign : ''));
  if (!qrKodu && !utmCampaign) return null;
  return { qrKodu: qrKodu || normalizeKod(utmCampaign), utmSource: String(utmSource), utmMedium: String(utmMedium), utmCampaign: String(utmCampaign), sayfaUrl: String(sayfaUrl).slice(0, 500), qrIziZamani: iz.zaman || new Date().toISOString() };
}

// Site → hizmetTipi eşlemesi. "Belirsiz" artık CRM'de yok, bu yüzden her
// site için en mantıklı sabit değeri seçiyoruz (formun tam detayı zaten yok,
// ama en azından hangi iş koluna ait olduğu bellidir).
const HIZMET_TIPI_BY_SITE = {
  depoevim: 'Depo',
  sembolevdeneve: 'Nakliye',
};

// "kaynak" (site-tiklama-takip-*.txt'teki snwKaynakOkuTam()/kaynakOku()'nun
// gönderdiği değer) → satış ekibinin göreceği isim + sonMesaj'a eklenecek
// kısa ifade. submit-lead.js'teki REKLAM_KAYNAGI_DEGERLERI ile AYNI değerler
// kullanılır. GÜNCELLEME (Ali'nin talebi, 2026-09): "organik" tek kovası
// tamamen kaldırıldı, 9 kategoriye bölündü — facebook_organik ve
// instagram_organik yeni eklendi, "direkt" ise "direkt_giris" olarak yeniden
// adlandırıldı (wizard'lardaki ve submit-lead.js'teki isimlendirmeyle
// BİREBİR aynı olsun diye).
const KAYNAK_ETIKETLERI = {
  google_ads: { ad: 'Google Ads Ziyaretçisi', reklamMetni: 'Google reklamlarından ' },
  facebook_ads: { ad: 'Facebook Ads Ziyaretçisi', reklamMetni: 'Facebook reklamlarından ' },
  facebook_organik: { ad: 'Facebook Organik Ziyaretçisi', reklamMetni: 'Facebook\'tan organik olarak ' },
  instagram_ads: { ad: 'Instagram Ads Ziyaretçisi', reklamMetni: 'Instagram reklamlarından ' },
  instagram_organik: { ad: 'Instagram Organik Ziyaretçisi', reklamMetni: 'Instagram\'dan organik olarak ' },
  google_anasayfa: { ad: 'Google Anasayfa Ziyaretçisi', reklamMetni: 'Google\'da aratıp ana sayfaya düşerek ' },
  google_altsayfa: { ad: 'Google Altsayfa Ziyaretçisi', reklamMetni: 'Google\'da aratıp bir alt sayfaya düşerek ' },
  direkt_giris: { ad: 'Direkt Giriş Ziyaretçisi', reklamMetni: 'adres çubuğuna doğrudan yazarak ' },
  diger_site: { ad: 'Diğer Site Ziyaretçisi', reklamMetni: 'başka bir siteden yönlendirilerek ' },
};

// yeni-musteri.js ve submit-lead.js'in KABUL ETTİĞİ tüm geçerli değerler —
// submit-lead.js'teki REKLAM_KAYNAGI_DEGERLERI ile BİREBİR aynı olmalı.
const REKLAM_KAYNAGI_DEGERLERI = ['google_ads', 'facebook_ads', 'facebook_organik', 'instagram_ads', 'instagram_organik', 'google_anasayfa', 'google_altsayfa', 'direkt_giris', 'diger_site'];
// QR eşleşmesi bunların ÜZERİNE YAZMAZ (bkz. aşağıdaki musteriAdi/reklamKaynagi
// hesaplaması) — genuine bir ödemeli reklam tıklamasıysa QR izi bulunsa bile
// reklam etiketi korunur; diğer tüm (organik/direkt/google anasayfa-altsayfa/
// diğer site) kategorilerin üzerine QR izi kazanır.
const PAID_ADS_DEGERLERI = ['google_ads', 'facebook_ads', 'instagram_ads'];

// Site → satış ekibinin göreceği okunaklı etiket.
const SITE_ETIKET = {
  depoevim: 'DepoEvim',
  sembolevdeneve: 'Sembol Nakliyat Sitesi',
};

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ message: 'Sadece POST metoduna izin verilir' }); return; }

  if (!FIRESTORE_APP_ID) {
    console.error('[yeni-musteri] FIRESTORE_APP_ID ortam değişkeni tanımlı değil.');
    res.status(500).json({ success: false, error: 'Sunucu yapılandırma hatası' });
    return;
  }

  try {
    let crmData = req.body;
    if (typeof crmData === 'string') {
      try { crmData = JSON.parse(crmData); } catch { crmData = {}; }
    }
    crmData = crmData || {};

    const site = HIZMET_TIPI_BY_SITE[crmData.site] ? crmData.site : (crmData.site || 'sembolevdeneve');
    const siteEtiket = SITE_ETIKET[site] || site || 'Web Sitesi';
    const hizmetTipi = HIZMET_TIPI_BY_SITE[site] || 'Nakliye';

    const suAnkiTarih = new Date().toISOString();
    const kanalTipi = (crmData.islem || '').includes('WhatsApp') ? 'whatsapp' : 'telefon';
    const kaynakGecerliMi = REKLAM_KAYNAGI_DEGERLERI.includes(crmData.kaynak);
    const kaynakBilgi = kaynakGecerliMi ? KAYNAK_ETIKETLERI[crmData.kaynak] : undefined;
    const kaynakOdemeliReklamMi = kaynakGecerliMi && PAID_ADS_DEGERLERI.includes(crmData.kaynak);
    // YENİ (QR TAKİP): QR izi varsa ziyaretçi "QR Ziyaretçisi" olarak açılır —
    // ödemeli bir reklam tıklaması DEĞİLSE QR izi kazanır (direkt/organik/google
    // anasayfa-altsayfa/diğer site gibi "zayıf" kategorilerin üzerine yazar).
    const qrIzi = qrIziniCoz(crmData, req);
    const qrKazaniyorMu = !!qrIzi && !kaynakOdemeliReklamMi;
    const musteriAdi = qrKazaniyorMu ? `QR Ziyaretçisi (${qrIzi.qrKodu})` : (kaynakBilgi ? kaynakBilgi.ad : 'Direkt Giriş Ziyaretçisi');

    const db = getDb();
    const ref = db
      .collection('artifacts').doc(FIRESTORE_APP_ID)
      .collection('public').doc('data')
      .collection('havuzKayitlari');

    await ref.add({
      musteriAdi,
      iletisim: 'Tıklama (Bekleniyor)',
      kanal: kanalTipi,
      // "site" değişkeni her zaman "depoevim" veya "sembolevdeneve" — Satis.jsx
      // bu iki değeri "Hesap" sütununda okunaklı bir etikete çeviriyor.
      hesapId: site,
      hizmetTipi,
      durum: 'Yeni',
      sonMesaj: `${siteEtiket} sitesinden ${qrKazaniyorMu ? `QR (${qrIzi.qrKodu}) üzerinden ` : (kaynakBilgi ? kaynakBilgi.reklamMetni : '')}tıklama geldi`,
      // submit-lead.js ile AYNI alan adı — Satis.jsx artık Ads/Organik
      // sayımını metin eşleştirme yerine doğrudan bu alandan yapıyor.
      reklamKaynagi: qrKazaniyorMu ? 'qr' : (kaynakGecerliMi ? crmData.kaynak : 'direkt_giris'),
      // "google_anasayfa"/"google_altsayfa"/"diger_site" kategorilerinde hangi
      // sayfaya düşüldüğü ve (varsa) hangi dış sitenin yönlendirdiği —
      // site-tiklama-takip-*.txt bunu document.referrer + location.pathname'den
      // hesaplayıp gönderiyor. Boşsa CRM tarafında hiç gösterilmez.
      inisSayfasi: String(crmData.inisSayfasi || '').trim(),
      digerSiteAdi: String(crmData.digerSiteAdi || '').trim(),
      // YENİ (QR TAKİP): iz alanları — Satis.jsx qrKodu ile kampanyaya bağlar
      ...(qrIzi ? { qrKodu: qrIzi.qrKodu, utmSource: qrIzi.utmSource, utmMedium: qrIzi.utmMedium, utmCampaign: qrIzi.utmCampaign, sayfaUrl: qrIzi.sayfaUrl, qrIziZamani: qrIzi.qrIziZamani } : {}),
      // Bu alan sayesinde Satis.jsx (istenirse) gerçek isim/telefon verilmiş
      // kayıtlarla salt tıklama bildirimlerini ayırt edebilir; iletisim alanına
      // güvenmek zorunda kalmaz.
      sadeceTiklama: true,
      kaynak: 'api',
      createdAt: suAnkiTarih,
      hareketler: [
        { tarih: suAnkiTarih, kullanici: 'Sistem API', islem: `Ziyaretçi ${siteEtiket} sitesinde ${kanalTipi} butonuna tıkladı.` }
      ],
    });

    res.status(200).json({ success: true, message: 'Harika, müşteri CRM havuzuna düştü!' });
  } catch (error) {
    console.error('Firebase Yazma Hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası', detay: error.message });
  }
}