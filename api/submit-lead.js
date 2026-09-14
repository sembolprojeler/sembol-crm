// api/submit-lead.js
// ============================================================================
// Sembol Evden Eve Nakliyat — Fiyat Teklifi Sihirbazı → Sembol CRM köprüsü
// ----------------------------------------------------------------------------
// Bu dosyayı, mevcut Vercel projenizin "api/" klasörüne AYNEN "submit-lead.js"
// adıyla koyun (diğer uçlarınızla aynı hizada: api/santral/vapi.js,
// api/openai/whatsapp.js gibi — bu da örneğin api/submit-lead.js olur).
//
// Ne yapıyor:
//   1) Wizard'dan (evden eve nakliyat fiyat teklifi sayfası) gelen POST'u alır.
//   2) Firebase Admin SDK ile CRM'in kullandığı AYNI Firestore projesine,
//      AYNI veri yoluna (artifacts/{appId}/public/data/havuzKayitlari) yazar.
//   3) Aynı leadId ile tekrar tekrar gelen "partial" kayıtları (kullanıcı
//      formu doldururken debounce ile atılan otomatik kayıtlar) TEK bir
//      dokümanda birleştirir (upsert) — her tuşa basışta yeni satış kaydı
//      OLUŞMAZ.
//   4) Satış ekibinin CRM'de zaten değiştirmiş olabileceği durum/atanan/not
//      alanlarının üzerine, müşteri formu doldurmaya devam ettikçe TEKRAR
//      YAZILMAZ (sadece ilk oluşturmada set edilir).
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
//   3) Wizard dosyasındaki SNW_CONFIG.apiEndpoint'i gerçek adresle değiştirin:
//        apiEndpoint: "https://SIZIN-VERCEL-ADRESINIZ.vercel.app/api/submit-lead"
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

// ---- Wizard'daki etiketlerle birebir aynı (evden eve nakliyat fiyat teklifi sayfası) ----
const HOME_LABEL = {
  '1+1': '1+1', '2+1': '2+1', '3+1': '3+1', '4+1': '4+1', '5+1': '5+1 ve üzeri',
  villa: 'Villa/Müstakil', ofis: 'Ofis',
};
const ELEVATOR_LABEL = {
  merdiven: 'Merdivenden', bina_asansoru: 'Bina asansörü', dis_cephe: 'Dış cephe asansörü',
};
const PAKETLEME_LABEL = {
  hayir: 'Kendim paketleyeceğim', kismi: 'Kısmi paketleme', firma: 'Firma paketlesin',
};

function fmtTL(n) {
  try { return Number(n).toLocaleString('tr-TR'); } catch { return String(n); }
}

// Satış ekibinin Müşteri Havuzu ekranında tek bakışta okuyabileceği özet metin.
function buildSonMesaj(p) {
  const satirlar = [];
  satirlar.push(`${p.fromCity || '-'}/${p.fromDistrict || '-'} → ${p.toCity || '-'}/${p.toDistrict || '-'}`);
  if (p.homeSize) satirlar.push(`Tip: ${HOME_LABEL[p.homeSize] || p.homeSize}`);
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
  if (p.priceMin && p.priceMax) satirlar.push(`Sistem fiyat tahmini: ${fmtTL(p.priceMin)} - ${fmtTL(p.priceMax)} TL`);
  if (Array.isArray(p.photoUrls) && p.photoUrls.length) satirlar.push(`${p.photoUrls.length} fotoğraf eklendi`);
  if (p.callbackRequested) satirlar.push('Müşteri "Beni Siz Arayın" talebinde bulundu');
  return satirlar.join('\n');
}

export default async function handler(req, res) {
  // ---- CORS: wizard, CRM'den FARKLI bir alan adından (sembolevdeneve.com) çağırıyor ----
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GEÇİCİ TEŞHİS: tarayıcıdan bu adrese düz girildiğinde (GET), sunucunun
  // gerçekte hangi FIRESTORE_APP_ID / FIREBASE_PROJECT_ID değerlerini
  // kullandığını gösterir. Şifre/anahtar İÇERMEZ, sadece yol/proje adı —
  // sorun bulununca bu bloğu kaldıracağız.
  if (req.method === 'GET') {
    res.status(200).json({
      debug: true,
      firestoreAppId: FIRESTORE_APP_ID || null,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null,
      firebaseClientEmailSet: !!process.env.FIREBASE_CLIENT_EMAIL,
      firebasePrivateKeySet: !!process.env.FIREBASE_PRIVATE_KEY,
      allowedOrigin: ALLOWED_ORIGIN,
    });
    return;
  }

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
      hizmetTipi: HOME_LABEL[body.homeSize] || 'Belirsiz',
      sonMesaj: buildSonMesaj(body),
      kaynak: 'web-sihirbaz',

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

      guzergah: {
        fromCity: body.fromCity || '', fromDistrict: body.fromDistrict || '',
        fromFloor: body.fromFloor || '', fromElevator: body.fromElevator || '',
        toCity: body.toCity || '', toDistrict: body.toDistrict || '',
        toFloor: body.toFloor || '', toElevator: body.toElevator || '',
      },
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
        islem: 'Web sitesinden yeni teklif talebi alındı',
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