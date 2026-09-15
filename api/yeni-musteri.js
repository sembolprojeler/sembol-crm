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
//     kaynak: string    — "google_ads" ise "Google Ads Ziyaretçisi", aksi
//                         halde "Organik Ziyaretçi"
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

// Site → hizmetTipi eşlemesi. "Belirsiz" artık CRM'de yok, bu yüzden her
// site için en mantıklı sabit değeri seçiyoruz (formun tam detayı zaten yok,
// ama en azından hangi iş koluna ait olduğu bellidir).
const HIZMET_TIPI_BY_SITE = {
  depoevim: 'Depo',
  sembolevdeneve: 'Nakliye',
};

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
    const musteriAdi = crmData.kaynak === 'google_ads' ? 'Google Ads Ziyaretçisi' : 'Organik Ziyaretçi';

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
      sonMesaj: `${siteEtiket} sitesinden ${crmData.kaynak === 'google_ads' ? 'Google reklamlarından ' : ''}tıklama geldi`,
      // submit-lead.js ile AYNI alan adı — Satis.jsx artık Ads/Organik
      // sayımını metin eşleştirme yerine doğrudan bu alandan yapıyor.
      reklamKaynagi: crmData.kaynak === 'google_ads' ? 'google_ads' : 'organik',
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