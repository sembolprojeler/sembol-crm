// api/submit-lead.js
// ============================================================================
// Sembol Evden Eve Nakliyat — Fiyat Teklifi Sihirbazları → Sembol CRM köprüsü
// ----------------------------------------------------------------------------
// Bu tek uç (endpoint), sitedeki TÜM fiyat teklifi sihirbazlarından gelen
// POST isteklerini karşılar:
//   1) Evden Eve Nakliyat        (source: "web-wizard-fullpage" / "evden-eve-nakliyat")
//   2) Parça Eşya Taşıma         (source: "web-wizard-parca-esya" / "parca-esya-tasima")
//   3) Ofis ve İşyeri Taşıma     (source: "web-wizard-ofis" / "ofis-isyeri-tasima")
//   4) Eşya Depolama             (source: "web-wizard-depolama" / "esya-depolama")
//   5) Asansör Kiralama          (source: "asansor-kiralama-wizard" / "asansor-kiralama")
//
// Her form kendi alan setini gönderir (ör. depolama'da "toCity" yok, asansör
// kiralamada tamamen farklı alanlar var). Bu dosya, wizard'ın gönderdiği
// "source" alanına bakarak hangi form olduğunu anlar ve satış ekibinin
// Müşteri Havuzu ekranında tek bakışta okuyacağı "sonMesaj" özetini o forma
// göre üretir. "source" tanınmıyorsa (veya eksikse) güvenli varsayılan olarak
// Evden Eve Nakliyat formatı kullanılır — bu sayede zaten canlıda çalışan
// evden eve wizard'ı ASLA bozulmaz.
//
// Ne yapıyor (genel akış):
//   1) Wizard'dan gelen POST'u alır.
//   2) Firebase Admin SDK ile CRM'in kullandığı AYNI Firestore projesine,
//      AYNI veri yoluna (artifacts/{appId}/public/data/havuzKayitlari) yazar.
//   3) Aynı leadId ile tekrar tekrar gelen "partial" kayıtları (kullanıcı
//      formu doldururken debounce ile atılan otomatik kayıtlar) TEK bir
//      dokümanda birleştirir (upsert) — her tuşa basışta yeni satış kaydı
//      OLUŞMAZ.
//   4) Satış ekibinin CRM'de zaten değiştirmiş olabileceği durum/atanan/not
//      alanlarının üzerine, müşteri formu doldurmaya devam ettikçe TEKRAR
//      YAZILMAZ (sadece ilk oluşturmada set edilir).
//   5) CRM'de hizmetTipi SADECE 'Nakliye' | 'Depo' | 'Asansör' değerlerini
//      kabul ediyor (başka bir değer CRM ekranında çökmeye yol açıyor) —
//      bu yüzden her form türü bu üç değerden birine sabitlenir; hiçbir form
//      "Belirsiz" olarak işaretlenmez, çünkü müşteri hangi formu doldurduysa
//      hizmet zaten bellidir. Formun tam
//      hizmet detayı (ev tipi, ofis büyüklüğü, depo hacmi vb.) zaten sonMesaj
//      özetinde ayrıca yer alır, kaybolmaz.
//
// Gerekli ortam değişkenleri (Vercel → Project Settings → Environment Variables):
//   FIREBASE_PROJECT_ID    → Firebase servis hesabı JSON'undaki "project_id"
//   FIREBASE_CLIENT_EMAIL  → aynı JSON'daki "client_email"
//   FIREBASE_PRIVATE_KEY   → aynı JSON'daki "private_key" (BEGIN/END satırlarıyla birlikte)
//   FIRESTORE_APP_ID       → shared.jsx'teki "appId" ile BİREBİR AYNI değer olmalı
//                            (CRM hangi "artifacts/{appId}/..." yoluna yazıyorsa
//                            bu fonksiyon da aynı yola yazmalı)
//   ALLOWED_ORIGIN         → örn. https://www.sembolevdeneve.com
//
// NOT: Bu, App.jsx içindeki "firebaseConfig" (apiKey, authDomain vb.) ile
// AYNI şey DEĞİLDİR. O config tarayıcı (client) tarafı içindir ve CRM'e giriş
// yapmış/anonim oturum açmış kullanıcılar için güvenlik kurallarına tabidir.
// Burada ise sunucu tarafında (Vercel fonksiyonu) çalıştığımız için Firebase
// Console → Proje Ayarları → Service accounts → "Generate new private key"
// ile İNDİRDİĞİNİZ AYRI bir JSON dosyasını kullanıyoruz. Bu anahtar tarayıcıya
// asla gönderilmez, sadece Vercel'in sunucu ortam değişkenlerinde durur ve
// Firestore güvenlik kurallarını atlayarak (admin yetkisiyle) doğrudan yazar.
//
// Kurulum:
//   1) npm install firebase-admin   (Vercel projenizin package.json'ına eklenir)
//   2) Yukarıdaki ortam değişkenlerini Vercel'e girin, yeniden deploy edin.
//   3) Her wizard dosyasındaki SNW_CONFIG.apiEndpoint'i gerçek adresle
//      değiştirin: apiEndpoint: "https://sembol-crm.vercel.app/api/submit-lead"
//
// NOT: sembol-crm'in package.json'ında "type": "module" tanımlı olduğu için
// bu dosya import/export (ESM) sözdizimiyle yazıldı — require/module.exports
// KULLANILMADI, aksi halde Vercel derleme sırasında hata verirdi.
// ============================================================================

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://www.sembolevdeneve.com';
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Vercel'de ortam değişkenindeki "\n" karakterleri literal string olarak
        // saklanır; gerçek satır sonuna çeviriyoruz, aksi halde anahtar geçersiz olur.
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

function fmtTL(n) {
  try { return Number(n).toLocaleString('tr-TR'); } catch { return String(n); }
}

// ============================================================================
// HANGİ WIZARD? — "source" alanına bakarak formu belirle.
// Eski/bilinmeyen bir source gelirse (veya hiç gelmezse) güvenli varsayılan
// olarak "evdenEve" kullanılır — canlıdaki evden eve wizard'ı böylece ASLA
// bozulmaz.
// ============================================================================
function resolveWizardType(source) {
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
    case 'evden-eve-nakliyat':
    case 'web-wizard-fullpage':
    default:
      return 'evdenEve';
  }
}

// CRM'de hizmetTipi SADECE bu dört değerden birini kabul ediyor.
const HIZMET_TIPI_BY_WIZARD = {
  evdenEve: 'Nakliye',
  parcaEsya: 'Nakliye',
  ofis: 'Nakliye',
  depolama: 'Depo',
  asansor: 'Asansör',
};

// Satış ekibinin Müşteri Havuzu listesinde formu ayırt edebilmesi için
// sonMesaj'ın başına eklenen kısa etiket.
const WIZARD_ETIKET = {
  evdenEve: 'Evden Eve Nakliyat',
  parcaEsya: 'Parça Eşya Taşıma',
  ofis: 'Ofis / İşyeri Taşıma',
  depolama: 'Eşya Depolama',
  asansor: 'Asansör Kiralama',
};

// ---- Etiket sözlükleri (her wizard'ın kendi HTML'indeki seçeneklerle birebir) ----
const EV_TIPI_LABEL = {
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
  satirlar.push(`Tarih: ${p.dateFlexible ? 'Esnek' : (p.moveDate || '-')}`);
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
  satirlar.push(`Tarih: ${p.dateFlexible ? 'Esnek' : (p.moveDate || '-')}`);
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
  satirlar.push(`Tarih: ${p.dateFlexible ? 'Esnek' : (p.moveDate || '-')}`);
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
  if (p.paketleme) satirlar.push(`Kutulama: ${PAKETLEME_LABEL[p.paketleme] || p.paketleme}`);
  if (p.kirilacak === 'evet') satirlar.push('Kırılacak / hassas eşya var');
  if (p.ambalaj === 'evet') satirlar.push('Ambalaj malzemesi firma tarafından temin edilecek');
  if (Array.isArray(p.specialItems) && p.specialItems.length && !(p.specialItems.length === 1 && p.specialItems[0] === 'yok')) {
    satirlar.push(`Özel eşyalar: ${p.specialItems.join(', ')}`);
  }
  satirlar.push(`Depoya Giriş Tarihi: ${p.dateFlexible ? 'Esnek' : (p.moveDate || '-')}`);
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

const SON_MESAJ_BUILDERS = {
  evdenEve: buildSonMesajEvdenEve,
  parcaEsya: buildSonMesajParcaEsya,
  ofis: buildSonMesajOfis,
  depolama: buildSonMesajDepolama,
  asansor: buildSonMesajAsansor,
};

function buildSonMesaj(wizardType, p) {
  const builder = SON_MESAJ_BUILDERS[wizardType] || buildSonMesajEvdenEve;
  const govde = builder(p).join('\n');
  return `[${WIZARD_ETIKET[wizardType] || 'Web Formu'}]\n${govde}`;
}

// Her form türünün güzergah/lokasyon bilgisini tek tip bir "guzergah" nesnesine
// toplar (Satis.jsx bu alanı doğrudan render etmiyor, sadece kayıt içinde
// referans amaçlı tutuluyor — o yüzden tür bazında eksik alan sorun yaratmaz).
function buildGuzergah(wizardType, body) {
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
  // evdenEve / parcaEsya / ofis
  return {
    fromCity: body.fromCity || '', fromDistrict: body.fromDistrict || '',
    fromFloor: body.fromFloor || '', fromElevator: body.fromElevator || '',
    toCity: body.toCity || '', toDistrict: body.toDistrict || '',
    toFloor: body.toFloor || '', toElevator: body.toElevator || '',
  };
}

export default async function handler(req, res) {
  // ---- CORS: wizardlar, CRM'den FARKLI bir alan adından (sembolevdeneve.com) çağırıyor ----
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!FIRESTORE_APP_ID) {
    console.error('[submit-lead] FIRESTORE_APP_ID ortam değişkeni tanımlı değil.');
    res.status(500).json({ error: 'Sunucu yapılandırma hatası' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const leadId = String(body.leadId || '').trim();
  if (!leadId) { res.status(400).json({ error: 'leadId zorunlu' }); return; }

  const wizardType = resolveWizardType(body.source);

  try {
    const db = getDb();
    // artifacts/{appId}/public/data/havuzKayitlari/{leadId}
    // — CRM'in (Satis.jsx → Müşteri Havuzu) okuduğu yolun BİREBİR aynısı.
    const ref = db
      .collection('artifacts').doc(FIRESTORE_APP_ID)
      .collection('public').doc('data')
      .collection('havuzKayitlari').doc(leadId);

    const nowIso = new Date().toISOString();
    const existingSnap = await ref.get();

    const kayit = {
      kanal: 'web',
      musteriAdi: String(body.fullName || '').trim(),
      iletisim: String(body.phone || '').trim(),
      hesapId: '',
      hizmetTipi: HIZMET_TIPI_BY_WIZARD[wizardType] || 'Nakliye',
      sonMesaj: buildSonMesaj(wizardType, body),
      kaynak: `web-sihirbaz-${wizardType}`,
      wizardKaynagi: body.source || '',

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
      tasinmaTarihi: body.moveDate || '',
      tarihEsnek: !!body.dateFlexible,
      ozelEsyalar: Array.isArray(body.specialItems) ? body.specialItems : [],

      updatedAt: nowIso,
    };

    if (!existingSnap.exists) {
      // İlk kayıt — Müşteri Havuzu'nun beklediği satış-hattı alanlarını burada açıyoruz.
      kayit.durum = 'Yeni';
      kayit.atanan = '';
      kayit.notlar = [];
      kayit.hareketler = [{
        tarih: nowIso, kullanici: 'Web Sihirbazı',
        islem: `Web sitesinden yeni teklif talebi alındı (${WIZARD_ETIKET[wizardType] || 'Web Formu'})`,
      }];
      kayit.createdAt = nowIso;
    } else if (body.status === 'completed' || body.status === 'callback_requested') {
      // Sadece anlamlı kilometre taşlarında hareket geçmişine bir satır ekliyoruz;
      // her debounce'lu ara-kayıtta hareketler listesini şişirmiyoruz.
      const onceki = existingSnap.data() || {};
      const not = body.status === 'completed'
        ? 'Müşteri formu tamamladı'
        : 'Müşteri "Beni Siz Arayın" talebinde bulundu';
      kayit.hareketler = [...(onceki.hareketler || []), { tarih: nowIso, kullanici: 'Web Sihirbazı', islem: not }];
    }
    // Not: durum/atanan/notlar/hareketler burada listede YOK ise, merge:true
    // sayesinde satış ekibinin CRM'de yaptığı değişiklikler korunur.

    await ref.set(kayit, { merge: true });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[submit-lead] Firestore yazma hatası:', err);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
}