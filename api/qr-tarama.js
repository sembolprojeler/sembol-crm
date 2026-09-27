// api/qr-tarama.js
// ============================================================================
// Sembol CRM — QR TAKİP: SAYFA GÖRÜNTÜLEME (OKUTMA) BİLDİRİMİ
// ----------------------------------------------------------------------------
// Site header'ındaki sembol-qr-takip.js, adreste "?qr=<KOD>" (veya
// utm_source=qr&utm_campaign=<KOD>) görünce BİR KEZ buraya bildirir. Sunucu
// kodu qrKampanyalari'nda bulur, qrTaramalari'na bir okutma yazar ve sayacı
// artırır. Böylece QR, CRM'e uğramadan DOĞRUDAN siteye gitse bile okutmalar
// sayılır. (CRM'deki "?qrt=" geçiş noktası da aynı koleksiyona yazar; iki
// yöntem birlikte çalışır.)
//
// İSTEK: POST { kod: "34_NAR_385_QR", site: "sembolevdeneve"|"depoevim", sayfaUrl }
// Ortam değişkenleri: submit-lead.js ile AYNI (ek kurulum gerekmez).
// ============================================================================
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'https://www.sembolevdeneve.com,https://www.depoevim.com')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }) });
  }
  return getFirestore();
}
function normalizeKod(v) {
  return String(v || '').toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}
function bugunYmd() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!FIRESTORE_APP_ID) { res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const kod = normalizeKod(body.kod || body.qr || body.utm_campaign);
  const site = body.site === 'depoevim' ? 'depoevim' : 'sembolevdeneve';
  if (!kod) { res.status(400).json({ error: 'kod zorunlu' }); return; }
  try {
    const db = getDb();
    const veri = db.collection('artifacts').doc(FIRESTORE_APP_ID).collection('public').doc('data');
    // Kampanyayı kod + site ile bul (kod benzersiz üretilir)
    const snap = await veri.collection('qrKampanyalari').where('kod', '==', kod).where('site', '==', site).limit(1).get();
    if (snap.empty) { res.status(200).json({ ok: true, bulundu: false }); return; } // bilinmeyen kod: sessizce geç
    const kmp = snap.docs[0];
    if (kmp.data().aktif === false) { res.status(200).json({ ok: true, pasif: true }); return; }
    const ua = String(req.headers['user-agent'] || '');
    const cihaz = /Android|iPhone|iPad|Mobile/i.test(ua) ? 'mobil' : 'masaüstü';
    const zaman = new Date().toISOString();
    await Promise.all([
      veri.collection('qrTaramalari').add({ kampanyaId: kmp.id, kampanyaAd: kmp.data().ad || '', site, zaman, gun: bugunYmd(), cihaz, referer: String(body.sayfaUrl || req.headers.referer || '').slice(0, 500), kaynak: 'site' }),
      kmp.ref.update({ taramaSayisi: FieldValue.increment(1), sonTarama: zaman }),
    ]);
    res.status(200).json({ ok: true, bulundu: true });
  } catch (err) {
    console.error('[qr-tarama] hata:', err);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
}
