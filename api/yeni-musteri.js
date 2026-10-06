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
//     refKodu?: string  — YENİ, isteğe bağlı: "SB-XXXXX" / "DE-XXXXX" (WhatsApp butonu; bkz. aşağı)
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
import { PAID_ADS_DEGERLERI, pazarlamaOku, reklamKaynagiKarar } from './_lib/pazarlama.js';
import { AI_KAYNAK_ETIKETLERI } from '../src/aiKaynakSema.js';
import { refBelgeId } from './_lib/lead.js';

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
  // YENİ: yapay zeka kaynakları — src/aiKaynakSema.js tablosundan üretilir
  // (ör. "ChatGPT Reklam Ziyaretçisi" / "ChatGPT üzerinden organik olarak ").
  ...Object.fromEntries(Object.entries(AI_KAYNAK_ETIKETLERI).map(([kod, e]) => [kod, {
    ad: `${e.ad} Ziyaretçisi`,
    reklamMetni: e.reklam ? `${e.platform} reklamlarından ` : `${e.platform} üzerinden organik olarak `,
  }])),
};

// Geçerli değerler (REKLAM_KAYNAGI_DEGERLERI) ve QR'ın üzerine yazamadığı
// ödemeli reklamlar (PAID_ADS_DEGERLERI) submit-lead.js ile ORTAK —
// api/_lib/pazarlama.js'ten import edildi. Ödemeli reklam tıklamasıysa QR izi
// bulunsa bile reklam etiketi korunur; diğer tüm (organik/direkt/google
// anasayfa-altsayfa/diğer site/yapay zeka organik) kategorilerin üzerine QR
// izi kazanır.

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
    // YENİ (yapay zeka kaynakları): sitenin gönderdiği "kaynak" ile sunucunun
    // UTM/referrer sınıflandırması submit-lead.js ile AYNI kuralla birleştirilir.
    // Bu uç OpenAI'a dönüşüm BİLDİRMEZ (tıklama bir teklif değildir).
    const pazarlama = pazarlamaOku(crmData);
    const kaynakKarari = reklamKaynagiKarar(crmData.kaynak, pazarlama);
    const kaynak = kaynakKarari.reklamKaynagi;
    const kaynakGecerliMi = kaynakKarari.karar !== 'varsayilan';
    const kaynakBilgi = kaynakGecerliMi ? KAYNAK_ETIKETLERI[kaynak] : undefined;
    const kaynakOdemeliReklamMi = kaynakGecerliMi && PAID_ADS_DEGERLERI.includes(kaynak);
    // YENİ (QR TAKİP): QR izi varsa ziyaretçi "QR Ziyaretçisi" olarak açılır —
    // ödemeli bir reklam tıklaması DEĞİLSE QR izi kazanır (direkt/organik/google
    // anasayfa-altsayfa/diğer site gibi "zayıf" kategorilerin üzerine yazar).
    // QR kararı tarayıcıda verilir (sembol-qr-takip.js sürüm 3 — QR'sız her yeni
    // girişte iz silinir), submit-lead.js ile AYNI kural: iz geldiyse ve ödemeli
    // reklam değilse QR kazanır. (Google Lens ile okutulan QR'da önceki sayfa
    // google.com görünür; bu yüzden kaynağa bakılarak QR elenmez.)
    const qrIzi = qrIziniCoz(crmData, req);
    const qrKazaniyorMu = !!qrIzi && String(qrIzi.utmSource).toLowerCase() === 'qr' && !kaynakOdemeliReklamMi;
    const musteriAdi = qrKazaniyorMu ? `QR Ziyaretçisi (${qrIzi.qrKodu})` : (kaynakBilgi ? kaynakBilgi.ad : 'Direkt Giriş Ziyaretçisi');

    const db = getDb();
    const ref = db
      .collection('artifacts').doc(FIRESTORE_APP_ID)
      .collection('public').doc('data')
      .collection('havuzKayitlari');

    const veri = {
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
      reklamKaynagi: qrKazaniyorMu ? 'qr' : kaynak,
      kaynakKarari: kaynakKarari.karar,
      ...(Object.keys(pazarlama).length ? { pazarlama } : {}),
      // "google_anasayfa"/"google_altsayfa"/"diger_site" kategorilerinde hangi
      // sayfaya düşüldüğü ve (varsa) hangi dış sitenin yönlendirdiği —
      // site-tiklama-takip-*.txt bunu document.referrer + location.pathname'den
      // hesaplayıp gönderiyor. Boşsa CRM tarafında hiç gösterilmez.
      inisSayfasi: String(crmData.inisSayfasi || '').trim(),
      digerSiteAdi: String(crmData.digerSiteAdi || '').trim(),
      // YENİ (QR TAKİP): iz alanları — Satis.jsx qrKodu ile kampanyaya bağlar
      ...(qrKazaniyorMu ? { oncekiReklamKaynagi: kaynak, qrKodu: qrIzi.qrKodu, utmSource: qrIzi.utmSource, utmMedium: qrIzi.utmMedium, utmCampaign: qrIzi.utmCampaign, sayfaUrl: qrIzi.sayfaUrl, qrIziZamani: qrIzi.qrIziZamani } : {}),
      // Bu alan sayesinde Satis.jsx (istenirse) gerçek isim/telefon verilmiş
      // kayıtlarla salt tıklama bildirimlerini ayırt edebilir; iletisim alanına
      // güvenmek zorunda kalmaz.
      sadeceTiklama: true,
      kaynak: 'api',
      createdAt: suAnkiTarih,
      hareketler: [
        { tarih: suAnkiTarih, kullanici: 'Sistem API', islem: `Ziyaretçi ${siteEtiket} sitesinde ${kanalTipi} butonuna tıkladı.` }
      ],
    };

    // YENİ (WhatsApp botu): site WhatsApp butonu mesaja "(Ref: SB-XXXXX)" ekler ve aynı kodu
    // burada "refKodu" olarak gönderir. Tıklama kaydı ref_<kod> belgesine yazılır; bot o kodu
    // mesajda görünce AYNI belgeyi lead'e çevirir (api/_lib/lead.js → whatsappLeadKaydi).
    // refKodu yoksa (eski site kodu) davranış AYNEN eskisi gibidir: yeni belge (add).
    const refKodu = String(crmData.refKodu || '').trim().toUpperCase();
    if (/^(SB|DE)-[A-Z0-9]{4,10}$/.test(refKodu)) {
      const belge = ref.doc(refBelgeId(refKodu));
      const mevcut = await belge.get();
      if (!mevcut.exists) await belge.set({ ...veri, refKodu });
      else if ((mevcut.data() || {}).kaynakKarari === 'varsayilan') {
        // Bot belgeyi tıklamadan ÖNCE açtıysa: yalnızca kaynak / QR izi eklenir, lead verisine dokunulmaz
        const kaynakAlanlari = {};
        ['reklamKaynagi', 'kaynakKarari', 'pazarlama', 'inisSayfasi', 'digerSiteAdi', 'oncekiReklamKaynagi', 'qrKodu', 'utmSource', 'utmMedium', 'utmCampaign', 'sayfaUrl', 'qrIziZamani']
          .forEach(k => { if (veri[k] !== undefined) kaynakAlanlari[k] = veri[k]; });
        await belge.set({ ...kaynakAlanlari, refKodu }, { merge: true });
      }
    } else {
      await ref.add(veri);
    }

    res.status(200).json({ success: true, message: 'Harika, müşteri CRM havuzuna düştü!' });
  } catch (error) {
    console.error('Firebase Yazma Hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası', detay: error.message });
  }
}