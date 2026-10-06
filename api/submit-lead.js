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
//   OPENAI_PIXEL_ID, OPENAI_CONVERSIONS_KEY, OPENAI_CAPI_TEST,
//   OPENAI_DONUSUM_SITELERI → (opsiyonel) ChatGPT reklam dönüşüm bildirimi,
//                            bkz. api/_lib/openaiDonusum.js
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
import { waitUntil } from '@vercel/functions';
// DEĞİŞTİ: sözlükler, sonMesaj üreticileri ve kayıt içeriği ortak modüle taşındı (WhatsApp botu da kullanır)
import { qrIziniCoz, resolveWizardType, webLeadKaydi } from './_lib/lead.js';
import { openaiAyarlari, donusumGonderilmeli, olayGonder } from './_lib/openaiDonusum.js';

// Birden fazla site bu endpoint'e istek atabiliyor (sembolevdeneve.com ve
// depoevim.com) — ALLOWED_ORIGINS ortam değişkenine virgülle ayrılmış liste
// olarak birden fazla adres girilebilir. Hiç ayarlanmazsa iki bilinen site de
// varsayılan olarak izinlidir, böylece mevcut kurulum bozulmaz.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'https://www.sembolevdeneve.com,https://www.depoevim.com')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Wizard'lar sayfadan ayrılırken (flushOnLeave) "navigator.sendBeacon"
  // kullanabiliyor — tarayıcı bu isteklere credentials'ı OTOMATİK dahil
  // ediyor, JS'ten kapatılamıyor. Sunucu bunu kabul ettiğini belirtmezse
  // tarayıcı isteği CORS hatasıyla engelliyor (Origin echo zaten '*' değil
  // tam eşleşen origin olduğu için bu güvenli).
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

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

// Eski testler / araçlar qrIziniCoz'u buradan alıyordu — aynı fonksiyon yeniden dışa açılır
export { qrIziniCoz };

// Testler sahte Firestore / fetch / waitUntil / ortam verebilsin diye uç bir
// "fabrika"dan üretilir; Vercel'in kullandığı varsayılan dışa aktarım gerçek
// bağımlılıkları kullanır.
export function handlerOlustur({ getDb: dbAl = getDb, waitUntil: arkaPlanda = waitUntil, fetch: fetchFn = globalThis.fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    // ---- CORS: wizardlar, CRM'den FARKLI alan adlarından (sembolevdeneve.com / depoevim.com) çağırıyor ----
    applyCors(req, res);

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
      const db = dbAl();
      // artifacts/{appId}/public/data/havuzKayitlari/{leadId}
      // — CRM'in (Satis.jsx → Müşteri Havuzu) okuduğu yolun BİREBİR aynısı.
      const ref = db
        .collection('artifacts').doc(FIRESTORE_APP_ID)
        .collection('public').doc('data')
        .collection('havuzKayitlari').doc(leadId);

      const nowIso = new Date().toISOString();
      const existingSnap = await ref.get();
      const onceki = existingSnap.exists ? (existingSnap.data() || {}) : {};

      // Kayıt içeriği ortak modülde (api/_lib/lead.js → webLeadKaydi) üretilir.
      const { kayit, pazarlama } = webLeadKaydi({ body, req, wizardType, onceki, ilkKayit: !existingSnap.exists, nowIso });

      await ref.set(kayit, { merge: true });

      // YENİ: OpenAI dönüşüm bildirimi — yalnızca ChatGPT reklamından gelen,
      // TAMAMLANMIŞ (completed / callback_requested) teklifte ve daha önce
      // başarıyla bildirilmemişse; ayarlı olmayan sitede / ortam eksikse sessizce
      // atlanır. Kayıt yazıldıktan SONRA waitUntil ile arka planda gider, yanıtı
      // geciktirmez. Sonuç kayda "openaiDonusum" olarak yazılır.
      const openaiAyar = donusumGonderilmeli({ status: body.status, reklamKaynagi: kayit.reklamKaynagi, onceki })
        ? openaiAyarlari(env, kayit.hesapId) : null;
      if (openaiAyar) {
        arkaPlanda(olayGonder({ ayar: openaiAyar, belgeId: ref.id, sourceUrl: pazarlama.landingUrl, fetchFn })
          .then(openaiDonusum => ref.set({ openaiDonusum }, { merge: true }))
          .catch(err => console.error('[submit-lead] OpenAI dönüşüm sonucu yazılamadı:', err && err.message)));
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[submit-lead] Firestore yazma hatası:', err);
      res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
    }
  };
}

export default handlerOlustur();