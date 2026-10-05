// api/mesafe.js
// ============================================================================
// Sembol CRM — KM HESABI (4 NOKTA / 3 ETAP) · Google Routes API
// ----------------------------------------------------------------------------
// Telefon Görüşmesi formu il/ilçe seçilince bu uca 4 noktalık rotayı gönderir:
//   Hareket merkezi (Pendik) → Yükleme ilçesi → Boşaltma ilçesi → Hareket merkezi
// Noktalar ilçe MERKEZİ adresleridir ("Kadıköy, İstanbul, Türkiye").
//
// POST /api/mesafe   (yalnızca CRM kullanıcıları — personnelList ile doğrulanır)
//   { kullaniciId, sifre, noktalar: ["Pendik, İstanbul, Türkiye", "Kadıköy, İstanbul, Türkiye", ...] }  (2–6 nokta)
//   → { etaplar: [{ nereden, nereye, km, dk, gecisler, googleUcret, onbellek }],
//       toplamKm, toplamDk, gecisler: { kopruOsmangazi: 2, ... }, googleUcret }
//
// ÖNBELLEK: Her etap (nereden → nereye) Firestore'da 90 gün saklanır:
//   artifacts/{appId}/public/data/mesafeOnbellek/{anahtar}
// Aynı ilçe çifti ikinci kez sorulduğunda Google'a gidilmez → ücret ve hız kazancı.
//
// ORTAM DEĞİŞKENİ (Vercel → Settings → Environment Variables):
//   GOOGLE_MAPS_API_KEY → Google Cloud'da yalnızca "Routes API" açık anahtar
//   (Firebase değişkenleri fiyatlar.js / submit-lead.js ile AYNI — ek kurulum yok)
// Anahtar YALNIZCA sunucuda kullanılır; tarayıcıya hiç inmez.
// ============================================================================
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rotaGecisleriBul } from '../src/fiyatSema.js';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const FIRESTORE_APP_ID = process.env.FIRESTORE_APP_ID;
const ROTA_UCU = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const ONBELLEK_GUN = 90;

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
const veriKoku = (db) => db.collection('artifacts').doc(FIRESTORE_APP_ID).collection('public').doc('data');

class IstekHatasi extends Error { constructor(durum, mesaj) { super(mesaj); this.durum = durum; } }

// CRM girişiyle AYNI kural: şifre doğru, Pasif değil, giriş yetkisi açık
async function kullaniciDogrula(db, kullaniciId, sifre) {
  if (!kullaniciId || sifre == null || sifre === '') throw new IstekHatasi(401, 'Oturum bilgisi eksik — CRM\'e yeniden giriş yapın.');
  const snap = await veriKoku(db).collection('personnelList').doc(String(kullaniciId)).get();
  const u = snap.exists ? snap.data() : null;
  if (!u || String(u.password) !== String(sifre)) throw new IstekHatasi(401, 'Kullanıcı doğrulanamadı — CRM\'e yeniden giriş yapın.');
  if (u.employmentStatus === 'Pasif' || (u.permissions && u.permissions.canView === false)) throw new IstekHatasi(403, 'Hesabınızın sisteme erişim yetkisi yok.');
}

// Önbellek anahtarı: Türkçe karaktersiz, küçük harf (ör. "pendik_istanbul_turkiye__kadikoy_istanbul_turkiye")
const anahtarYap = (s) => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 180);

// Tek etap: Google Routes API (kamyon değil otomobil profili; km için yeterli)
async function googleEtap(nereden, nereye) {
  const r = await fetch(ROTA_UCU, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.description,routes.warnings,routes.travelAdvisory.tollInfo,routes.legs.steps.navigationInstruction',
    },
    body: JSON.stringify({
      origin: { address: nereden }, destination: { address: nereye },
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE',
      languageCode: 'tr-TR', units: 'METRIC', regionCode: 'TR', extraComputations: ['TOLLS'],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new IstekHatasi(502, `Google rota hatası: ${j?.error?.message || r.status}`);
  const rota = j.routes?.[0];
  if (!rota) throw new IstekHatasi(404, `Rota bulunamadı: ${nereden} → ${nereye}`);
  const adimlar = (rota.legs || []).flatMap(l => l.steps || []).map(st => st.navigationInstruction || {});
  const metinler = [rota.description || '', ...(rota.warnings || []), ...adimlar.map(a => a.instructions || '')];
  const feribot = adimlar.some(a => /FERRY/i.test(a.maneuver || ''));
  const ucret = rota.travelAdvisory?.tollInfo?.estimatedPrice?.find(x => x.currencyCode === 'TRY');
  return {
    km: Math.round((rota.distanceMeters || 0) / 100) / 10,
    dk: Math.round(parseFloat(String(rota.duration || '0').replace('s', '')) / 60),
    gecisler: rotaGecisleriBul(metinler, feribot),
    googleUcret: ucret ? Number(ucret.units || 0) + Number(ucret.nanos || 0) / 1e9 : null,
  };
}

// Önbellekli etap
async function etapGetir(db, nereden, nereye) {
  const ref = veriKoku(db).collection('mesafeOnbellek').doc(`${anahtarYap(nereden)}__${anahtarYap(nereye)}`);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data();
    const yas = (Date.now() - new Date(d.tarih || 0).getTime()) / 86400000;
    if (yas < ONBELLEK_GUN && Number.isFinite(d.km)) return { nereden, nereye, km: d.km, dk: d.dk, gecisler: d.gecisler || {}, googleUcret: d.googleUcret ?? null, onbellek: true };
  }
  const e = await googleEtap(nereden, nereye);
  await ref.set({ nereden, nereye, ...e, tarih: new Date().toISOString() }).catch(() => {}); // önbellek yazılamazsa sorun değil
  return { nereden, nereye, ...e, onbellek: false };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!FIRESTORE_APP_ID) { res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }
  if (!GOOGLE_KEY) { res.status(503).json({ error: 'Google Maps anahtarı tanımlı değil (Vercel › Environment Variables › GOOGLE_MAPS_API_KEY).' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const db = getDb();
    await kullaniciDogrula(db, body.kullaniciId, body.sifre);
    const noktalar = (Array.isArray(body.noktalar) ? body.noktalar : []).map(n => String(n || '').trim()).filter(Boolean);
    if (noktalar.length < 2 || noktalar.length > 6) throw new IstekHatasi(400, '2 ile 6 arasında nokta gönderin.');
    const etaplar = [];
    for (let i = 0; i < noktalar.length - 1; i++) {
      // Aynı ilçede başlayıp biten etap (ör. Pendik → Pendik) 0 km sayılır
      if (anahtarYap(noktalar[i]) === anahtarYap(noktalar[i + 1])) { etaplar.push({ nereden: noktalar[i], nereye: noktalar[i + 1], km: 0, dk: 0, gecisler: {}, googleUcret: 0, onbellek: true }); continue; }
      etaplar.push(await etapGetir(db, noktalar[i], noktalar[i + 1]));
    }
    const gecisler = {};
    etaplar.forEach(e => Object.keys(e.gecisler || {}).forEach(id => { gecisler[id] = (gecisler[id] || 0) + 1; }));
    const googleUcret = etaplar.some(e => e.googleUcret != null) ? etaplar.reduce((t, e) => t + (e.googleUcret || 0), 0) : null;
    res.status(200).json({
      etaplar,
      toplamKm: Math.round(etaplar.reduce((t, e) => t + e.km, 0) * 10) / 10,
      toplamDk: etaplar.reduce((t, e) => t + (e.dk || 0), 0),
      gecisler, googleUcret,
    });
  } catch (err) {
    if (err instanceof IstekHatasi) { res.status(err.durum).json({ error: err.message }); return; }
    console.error('[mesafe] hata:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}
