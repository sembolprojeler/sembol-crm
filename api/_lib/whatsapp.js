// api/_lib/whatsapp.js
// ============================================================================
// Sembol CRM — WHATSAPP CLOUD API ORTAK YARDIMCILARI
// ----------------------------------------------------------------------------
// api/whatsapp-webhook.js (bot) ve api/whatsapp-send.js (personel cevabı) kullanır.
//   • Firestore yolları: artifacts/{appId}/public/data/whatsapp_conversations/{konuşmaKimliği}
//                        …/whatsapp_conversations/{konuşmaKimliği}/messages/{wamid}
//     konuşmaKimliği = waId (eskiKimlik hattı: 0850) | "{phoneNumberId}_{waId}" (diğer hatlar)
//   • Hat → marka eşlemesi (WHATSAPP_HATLAR) — hatlariOku / hatBul
//                        …/whatsapp_durum/token  (token / kalıcı hata uyarısı)
//   • Mesaj gönderme (Graph API), token hatası (190 / OAuthException) tespiti
//   • Loglarda telefon numarası MASKELENİR (maskele)
// Ortam: WHATSAPP_HATLAR (JSON, isteğe bağlı) | WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_VERSION (isteğe bağlı)
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
// kimlik: konusmaKimligi(hat, waId) — 0850 hattında waId'nin kendisi (eski belgeler aynen geçerli)
export const konusmaRef = (db, kimlik, appId) => veriKoku(db, appId).collection('whatsapp_conversations').doc(String(kimlik));
export const mesajlarRef = (db, kimlik, appId) => konusmaRef(db, kimlik, appId).collection('messages');
// belge: 'token' (Meta token / kalıcı gönderim hatası) | 'ai' (yapay zeka yapılandırma hatası: anahtar, model, kredi)
export const durumRef = (db, appId, belge = 'token') => veriKoku(db, appId).collection('whatsapp_durum').doc(belge);
export const havuzRef = (db, id, appId) => veriKoku(db, appId).collection('havuzKayitlari').doc(String(id));

// "905321234567" → "9053****4567" (loglar için; BSUID "US.1349…1918" → "1349****1918")
export const maskele = (no) => { const d = String(no || '').replace(/\D/g, ''); return d.length > 6 ? `${d.slice(0, 4)}****${d.slice(-4)}` : '****'; };

// --------------------------------------------------------------- HATLAR (2026-10-07)
// Her WhatsApp numarası (hat) TEK markaya aittir. Yapılandırma env'de (Firestore'da değil:
// tarayıcıdan değiştirilemesin, her mesajda ek okuma olmasın):
//   WHATSAPP_HATLAR=[{"phoneNumberId":"123","marka":"depoevim","tokenEnv":"WHATSAPP_TOKEN","ad":"0850 441 78 86","eskiKimlik":true}]
//   • tokenEnv: o hattın erişim token'ını tutan env değişkeninin ADI (varsayılan WHATSAPP_TOKEN)
//   • eskiKimlik: konuşma belgesi kimliği yalnızca waId (2026-10-07 öncesi belgeler) — EN FAZLA BİR hat
// WHATSAPP_HATLAR yoksa: WHATSAPP_PHONE_NUMBER_ID tek hat = DepoEvim (0850), eskiKimlik.
const HAT_MARKALARI = ['sembol', 'depoevim'];
export function hatlariOku(env = process.env) {
  const ham = String(env.WHATSAPP_HATLAR || '').trim();
  if (!ham) {
    return env.WHATSAPP_PHONE_NUMBER_ID
      ? [{ phoneNumberId: String(env.WHATSAPP_PHONE_NUMBER_ID), marka: 'depoevim', tokenEnv: 'WHATSAPP_TOKEN', ad: '0850 441 78 86', eskiKimlik: true }]
      : [];
  }
  let liste;
  try { liste = JSON.parse(ham); } catch { console.error('[whatsapp] WHATSAPP_HATLAR geçersiz JSON — hiçbir hat işlenmiyor'); return []; }
  let eskiVar = false;
  return (Array.isArray(liste) ? liste : []).filter(h => h && h.phoneNumberId && HAT_MARKALARI.includes(h.marka)).map(h => {
    const eskiKimlik = h.eskiKimlik === true && !eskiVar;
    if (eskiKimlik) eskiVar = true;
    return { phoneNumberId: String(h.phoneNumberId), marka: h.marka, tokenEnv: String(h.tokenEnv || 'WHATSAPP_TOKEN'), ad: String(h.ad || ''), eskiKimlik };
  });
}
export const hatBul = (env, phoneNumberId) => (phoneNumberId ? hatlariOku(env).find(h => h.phoneNumberId === String(phoneNumberId)) : null) || null;
// Konuşma belgesinin hattı: hatId (2026-10-07 sonrası) — yoksa eski belge → eskiKimlik hattı (0850)
export const konusmaHatti = (env, k = {}) => (k.hatId ? hatBul(env, k.hatId) : hatlariOku(env).find(h => h.eskiKimlik) || null);
// Aynı müşteri iki hatta yazarsa iki ayrı konuşma olur
export const konusmaKimligi = (hat, waId) => (hat?.eskiKimlik ? String(waId) : `${hat.phoneNumberId}_${waId}`);

// --------------------------------------------------------------- KULLANICI ADI / BSUID (2026-10-08)
// Meta kullanıcı adı geçişi: kullanıcı adı olan müşterinin mesajı telefon OLMADAN gelebilir
// (messages[].from ve contacts[].wa_id yok). O zaman kimlik işletmeye özel kullanıcı kimliğidir (BSUID):
//   messages[].from_user_id · contacts[].user_id · contacts[].profile.username · statuses[].recipient_user_id
//   Biçim: "US.13491208655302741918" (ülke kodu + nokta + harf/rakam; ana kimlik "US.ENT.…")
// Gönderim: BSUID "to" alanına YAZILMAZ → "recipient" alanı (waMetinGonder bunu kendisi seçer).
export const bsuidMi = (x) => /^[A-Z]{2}\.[A-Za-z0-9.]{1,140}$/.test(String(x || ''));
// Gelen mesajın müşterisi: { kimlik (telefon, yoksa BSUID), telefon, userId, kullaniciAdi, profilAdi }
export function musteriCoz(m = {}, contacts = []) {
  let telefon = String(m.from || '').trim();
  let userId = String(m.from_user_id || '').trim();
  const liste = Array.isArray(contacts) ? contacts : [];
  const c = liste.find(x => (telefon && String(x?.wa_id || '') === telefon) || (userId && String(x?.user_id || '') === userId))
    || (liste.length === 1 ? liste[0] : null);
  if (!telefon && c?.wa_id) telefon = String(c.wa_id);
  if (!userId && c?.user_id) userId = String(c.user_id);
  if (bsuidMi(telefon)) { userId = userId || telefon; telefon = ''; } // telefon alanında BSUID gelirse
  return {
    kimlik: telefon || userId, telefon, userId,
    kullaniciAdi: String(c?.profile?.username || '').replace(/^@/, '').slice(0, 100), profilAdi: String(c?.profile?.name || ''),
  };
}
// Teşhis logu: nesnenin ANAHTAR adları (değerler değil) — "from,id,type,text{body}" / "wa_id,user_id,profile{name,username}"
export function anahtarOzeti(o) {
  if (!o || typeof o !== 'object') return '-';
  return Object.keys(o).map(k => (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? `${k}{${Object.keys(o[k]).join(',')}}` : k)).join(',') || '-';
}

export const varsayilanGraphSurumu = 'v23.0';
const graphUrl = (env, phoneNumberId) => `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION || varsayilanGraphSurumu}/${phoneNumberId}/messages`;

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

// Metin mesajı gönderir (hat verilirse o hattın numarası ve token'ı). Asla fırlatmaz: { ok, wamid } | { ok: false, hata }
export async function waMetinGonder({ env = process.env, fetchFn = globalThis.fetch, hat = null, to, metin, ms = 15000 }) {
  const phoneNumberId = hat ? hat.phoneNumberId : env.WHATSAPP_PHONE_NUMBER_ID;
  const token = hat ? env[hat.tokenEnv] : env.WHATSAPP_TOKEN;
  if (!token || !phoneNumberId) {
    return { ok: false, hata: { kod: null, mesaj: `${hat ? hat.tokenEnv : 'WHATSAPP_TOKEN'} / phone_number_id tanımlı değil`, tokenHatasi: true, kalici: true } };
  }
  const ctrl = new AbortController();
  const z = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetchFn(graphUrl(env, phoneNumberId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // Telefon → "to"; BSUID (kullanıcı adıyla yazan müşteri) → "recipient" (Meta: BSUID "to"ya yazılmaz)
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...(bsuidMi(to) ? { recipient: String(to) } : { to: String(to) }),
        type: 'text', text: { body: String(metin).slice(0, 4096), preview_url: false } }),
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

// Webhook'taki medya alanı → mesaj belgesindeki "medya" (dosya henüz alınmadı: durum 'bekliyor')
const medyaBilgisi = (x = {}) => ({
  durum: 'bekliyor', mimeType: String(x.mime_type || '').split(';')[0].trim(),
  caption: String(x.caption || '').slice(0, 1000), dosyaAdi: String(x.filename || '').slice(0, 200),
});
// Gelen mesaj → { tip, metin (yapay zekaya gidecek), mediaId, ozet (CRM önizlemesi), botaGitsin, medya? }
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
    // YENİ (2026-10-07): medya bilgisi (mimeType, caption, belge adı) — dosya arka planda crm/uploads'a alınır
    case 'audio': return { tip, metin: '[sesli mesaj]', mediaId: m.audio?.id || null, ozet: '🎤 Sesli mesaj', botaGitsin: true, medya: medyaBilgisi(m.audio) };
    case 'image': return { tip, metin: `[görsel]${m.image?.caption ? ' ' + kes(m.image.caption) : ''}`, mediaId: m.image?.id || null, ozet: '📷 Görsel', botaGitsin: true, medya: medyaBilgisi(m.image) };
    case 'video': return { tip, metin: `[video]${m.video?.caption ? ' ' + kes(m.video.caption) : ''}`, mediaId: m.video?.id || null, ozet: '🎥 Video', botaGitsin: true, medya: medyaBilgisi(m.video) };
    case 'document': return { tip, metin: `[belge] ${kes(m.document?.filename || '')}${m.document?.caption ? ' ' + kes(m.document.caption) : ''}`.trim(), mediaId: m.document?.id || null, ozet: '📄 Belge', botaGitsin: true, medya: medyaBilgisi(m.document) };
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
