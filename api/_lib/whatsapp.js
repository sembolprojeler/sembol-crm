// api/_lib/whatsapp.js
// ============================================================================
// Sembol CRM — WHATSAPP CLOUD API ORTAK YARDIMCILARI
// ----------------------------------------------------------------------------
// api/whatsapp-webhook.js (bot) ve api/whatsapp-send.js (personel cevabı) kullanır.
//   • Firestore yolları: artifacts/{appId}/public/data/whatsapp_conversations/{waId}
//                        …/whatsapp_conversations/{waId}/messages/{wamid}
//                        …/whatsapp_durum/token  (token / kalıcı hata uyarısı)
//   • Mesaj gönderme (Graph API), token hatası (190 / OAuthException) tespiti
//   • Loglarda telefon numarası MASKELENİR (maskele)
// Ortam: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_VERSION (isteğe bağlı)
// ============================================================================
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }) });
  }
  return getFirestore();
}

export const veriKoku = (db, appId = process.env.FIRESTORE_APP_ID) => db.collection('artifacts').doc(appId).collection('public').doc('data');
export const konusmaRef = (db, waId, appId) => veriKoku(db, appId).collection('whatsapp_conversations').doc(String(waId));
export const mesajlarRef = (db, waId, appId) => konusmaRef(db, waId, appId).collection('messages');
// belge: 'token' (Meta token / kalıcı gönderim hatası) | 'ai' (yapay zeka yapılandırma hatası: anahtar, model, kredi)
export const durumRef = (db, appId, belge = 'token') => veriKoku(db, appId).collection('whatsapp_durum').doc(belge);
export const havuzRef = (db, id, appId) => veriKoku(db, appId).collection('havuzKayitlari').doc(String(id));

// "905321234567" → "9053****4567" (loglar için)
export const maskele = (no) => { const d = String(no || '').replace(/\D/g, ''); return d.length > 6 ? `${d.slice(0, 4)}****${d.slice(-4)}` : '****'; };

export const varsayilanGraphSurumu = 'v23.0';
const graphUrl = (env) => `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION || varsayilanGraphSurumu}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Meta hata kodları: 190 = token geçersiz/süresi dolmuş; OAuthException tipi de token sorunu.
// Diğer kalıcı (yeniden denemekle düzelmeyen) hesap/izin hataları da uyarı bandına yazılır.
const KALICI_KODLAR = new Set([190, 10, 200, 100, 131005, 131031, 131042, 133010]);
export function metaHatasiCoz(govde, httpDurum) {
  const e = govde?.error || {};
  const kod = Number(e.code) || null;
  const tokenHatasi = kod === 190 || e.type === 'OAuthException' && [190, 102, 463, 467].includes(kod ?? 190);
  return {
    kod, altKod: Number(e.error_subcode) || null, tip: e.type || '', mesaj: String(e.message || `HTTP ${httpDurum}`).slice(0, 300),
    tokenHatasi, kalici: tokenHatasi || KALICI_KODLAR.has(kod), httpDurum,
  };
}

// Metin mesajı gönderir. Asla fırlatmaz: { ok, wamid } | { ok: false, hata }
export async function waMetinGonder({ env = process.env, fetchFn = globalThis.fetch, to, metin, ms = 15000 }) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, hata: { kod: null, mesaj: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID tanımlı değil', tokenHatasi: true, kalici: true } };
  }
  const ctrl = new AbortController();
  const z = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetchFn(graphUrl(env), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: String(to), type: 'text', text: { body: String(metin).slice(0, 4096), preview_url: false } }),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, hata: metaHatasiCoz(j, r.status) };
    return { ok: true, wamid: j.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, hata: { kod: null, mesaj: err?.name === 'AbortError' ? 'Meta zaman aşımı' : String(err?.message || err).slice(0, 300), tokenHatasi: false, kalici: false } };
  } finally { clearTimeout(z); }
}

// CRM'de yöneticilere kırmızı bant: "WhatsApp token geçersiz, mesajlar gönderilemiyor"
export async function uyariYaz(db, hata, nowIso = new Date().toISOString(), appId) {
  await durumRef(db, appId).set({
    aktif: true,
    tur: hata.tokenHatasi ? 'token' : 'kalici_hata',
    mesaj: hata.tokenHatasi ? 'WhatsApp token geçersiz, mesajlar gönderilemiyor' : `WhatsApp mesajı gönderilemiyor: ${hata.mesaj}`,
    kod: hata.kod ?? null, metaMesaj: hata.mesaj || '', tarih: nowIso,
  }, { merge: true });
}
// Başarılı gönderimden sonra bant kalkar (yalnızca aktifse yazılır)
export async function uyariTemizle(db, nowIso = new Date().toISOString(), appId) {
  const ref = durumRef(db, appId);
  const s = await ref.get();
  if (s.exists && s.data()?.aktif) await ref.set({ aktif: false, cozuldu: nowIso }, { merge: true });
}

// YENİ (2026-10-07): yapay zeka yapılandırma hatası (anahtar yok / 400-404 / kredi bitti) — yöneticiye bant.
// Konuşma KİLİTLENMEZ; bot sonraki mesajda yeniden dener.
export async function aiUyariYaz(db, hata, nowIso = new Date().toISOString(), appId) {
  await durumRef(db, appId, 'ai').set({
    aktif: true, tur: 'ai', mesaj: 'Yapay zeka cevap veremiyor (anahtar / model / kredi) — bot müşterilere sabit mesaj gönderiyor',
    durum: hata?.durum ?? null, metaMesaj: String(hata?.hata || '').slice(0, 300), tarih: nowIso,
  }, { merge: true });
}
export async function aiUyariTemizle(db, nowIso = new Date().toISOString(), appId) {
  const ref = durumRef(db, appId, 'ai');
  const s = await ref.get();
  if (s.exists && s.data()?.aktif) await ref.set({ aktif: false, cozuldu: nowIso }, { merge: true });
}

// Gelen mesaj → { tip, metin (yapay zekaya gidecek), mediaId, ozet (CRM önizlemesi), botaGitsin }
export function gelenMesajiCoz(m = {}) {
  const tip = m.type || 'unknown';
  const kes = (s, n = 1000) => String(s || '').slice(0, n);
  switch (tip) {
    case 'text': return { tip, metin: kes(m.text?.body, 4096), ozet: kes(m.text?.body, 120), botaGitsin: true };
    case 'button': return { tip, metin: kes(m.button?.text || m.button?.payload), ozet: kes(m.button?.text, 120), botaGitsin: true };
    case 'interactive': {
      const r = m.interactive?.button_reply || m.interactive?.list_reply || {};
      return { tip, metin: kes(r.title || r.id), ozet: kes(r.title, 120), botaGitsin: true };
    }
    case 'audio': return { tip, metin: '[sesli mesaj]', mediaId: m.audio?.id || null, ozet: '🎤 Sesli mesaj', botaGitsin: true };
    case 'image': return { tip, metin: `[görsel]${m.image?.caption ? ' ' + kes(m.image.caption) : ''}`, mediaId: m.image?.id || null, ozet: '📷 Görsel', botaGitsin: true };
    case 'video': return { tip, metin: `[video]${m.video?.caption ? ' ' + kes(m.video.caption) : ''}`, mediaId: m.video?.id || null, ozet: '🎥 Video', botaGitsin: true };
    case 'document': return { tip, metin: `[belge] ${kes(m.document?.filename || '')}${m.document?.caption ? ' ' + kes(m.document.caption) : ''}`.trim(), mediaId: m.document?.id || null, ozet: '📄 Belge', botaGitsin: true };
    case 'sticker': return { tip, metin: '[çıkartma]', mediaId: m.sticker?.id || null, ozet: 'Çıkartma', botaGitsin: false };
    case 'location': {
      const l = m.location || {};
      const ad = [l.name, l.address].filter(Boolean).join(' — ');
      return { tip, metin: `[konum: ${ad || 'adres yok'} (${l.latitude}, ${l.longitude})]`, konum: { lat: l.latitude ?? null, lng: l.longitude ?? null, ad: ad || '' }, ozet: '📍 Konum', botaGitsin: true };
    }
    case 'contacts': return { tip, metin: '[kişi kartı]', ozet: 'Kişi kartı', botaGitsin: true };
    case 'reaction': return { tip, metin: `[tepki ${kes(m.reaction?.emoji, 8)}]`, ozet: `Tepki ${kes(m.reaction?.emoji, 8)}`, botaGitsin: false };
    default: return { tip, metin: '[desteklenmeyen mesaj]', ozet: 'Desteklenmeyen mesaj', botaGitsin: false };
  }
}
