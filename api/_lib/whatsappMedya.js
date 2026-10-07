// api/_lib/whatsappMedya.js
// ============================================================================
// Sembol CRM — WHATSAPP MEDYASI (görsel / ses / video / belge) → crm/uploads
// ----------------------------------------------------------------------------
// Firebase Storage KULLANILMAZ. Dosya, CRM'in bugün her yerde kullandığı yöntemle
// yüklenir: POST https://www.sembolevdeneve.com/crm/upload.php, multipart, tek alan "file";
// yanıt json.url || json.fileName || json.file || düz metin (src/App.jsx ile aynı okuma).
// upload.php klasör parametresi almadığı için dosyalar uploads/ köküne gider (Ali: A seçeneği):
//   ad = "wa_<32 hex rastgele>.<uzantı>" — müşteri adı / telefonu GEÇMEZ.
// Akış: Meta GET /{media_id} (hattın token'ı) → geçici URL + mime + boyut → indir → yükle.
// Dosya başına 20 MB sınırı (Meta'nın bildirdiği boyut + indirirken sayılan bayt).
// Meta medya kimliğini artık tanımıyorsa (süresi doldu) tur: 'suresi_doldu'.
// Ortam (isteğe bağlı): MEDYA_YUKLEME_URL, MEDYA_DOSYA_KOKU, WHATSAPP_GRAPH_VERSION,
//   MEDYA_YUKLEME_ANAHTARI → upload.php isteğine "X-Medya-Anahtari" başlığı (Cloudflare geçiş kuralı).
//   Değer ASLA loglanmaz / hata metnine yazılmaz. Tanımlı değilse istek bugünkü gibi başlıksız gider.
// ============================================================================
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mesajlarRef, varsayilanGraphSurumu, maskele } from './whatsapp.js';

export const MEDYA_SINIRI = 20 * 1024 * 1024;
export const MEDYA_TIPLERI = ['image', 'audio', 'video', 'document'];
const YUKLEME_URL = 'https://www.sembolevdeneve.com/crm/upload.php';
const DOSYA_KOKU = 'https://www.sembolevdeneve.com/crm/uploads/';

const UZANTILAR = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
export const sadeMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();
export const uzantiBul = (mime) => UZANTILAR[sadeMime(mime)] || 'bin';
export const rastgeleDosyaAdi = (mime, rastgele = () => randomBytes(16).toString('hex')) => `wa_${rastgele()}.${uzantiBul(mime)}`;

const graph = (env, yol) => `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION || varsayilanGraphSurumu}/${yol}`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// Gövdeyi sınırı aşmadan okur (aşarsa null)
async function sinirliOku(r, sinir) {
  const okuyucu = r.body?.getReader?.();
  if (!okuyucu) { const b = Buffer.from(await r.arrayBuffer()); return b.length > sinir ? null : b; }
  const parcalar = []; let toplam = 0;
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) break;
    toplam += value.length;
    if (toplam > sinir) { await okuyucu.cancel().catch(() => {}); return null; }
    parcalar.push(Buffer.from(value));
  }
  return Buffer.concat(parcalar);
}

// upload.php yanıtı → mutlak URL (CRM ile aynı okuma; yalnızca dosya adı dönerse uploads köküne eklenir)
export function yuklemeYanitiniCoz(metin, env = {}) {
  const t = String(metin || '').trim();
  let deger = t;
  try { const j = JSON.parse(t); deger = j?.url || j?.fileName || j?.file || ''; } catch { /* düz metin */ }
  deger = String(deger || '').trim();
  if (/^https?:\/\/\S+$/i.test(deger)) return deger;
  if (/^[\w.-]+\.[a-z0-9]{2,5}$/i.test(deger)) return `${env.MEDYA_DOSYA_KOKU || DOSYA_KOKU}${deger}`;
  return null;
}

// upload.php hata metni: Cloudflare doğrulama sayfası (HTML) yerine kısa açıklama;
// anahtar yanıtta geçerse (yansıtılmışsa) metinden silinir — loglara / medyaHata'ya ASLA girmez
export function yuklemeHatasi(durum, metin, anahtar = '') {
  const t = String(metin || '');
  if (durum === 403 && /Just a moment/i.test(t)) return 'Cloudflare engelledi (403) — geçiş kuralını kontrol edin';
  let kisa = t.replace(/\s+/g, ' ').trim();
  if (anahtar) kisa = kisa.split(anahtar).join('***');
  return `Yükleme başarısız (upload.php HTTP ${durum}): ${kisa.slice(0, 200) || 'boş yanıt'}`;
}

// { ok: true, url, mimeType, boyut, dosya } | { ok: false, tur: 'suresi_doldu'|'boyut'|'meta'|'yukleme'|'yapilandirma', hata }
export async function medyaIndirYukle({ env = process.env, fetchFn = globalThis.fetch, hat, mediaId, rastgele, sinir = MEDYA_SINIRI, ms = 45000 }) {
  const token = hat ? env[hat.tokenEnv] : env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, tur: 'yapilandirma', hata: 'WhatsApp token tanımlı değil' };
  if (!mediaId) return { ok: false, tur: 'meta', hata: 'Medya kimliği yok' };
  const ctrl = new AbortController();
  const z = setTimeout(() => ctrl.abort(), ms);
  try {
    // 1) Meta: geçici indirme adresi
    const r1 = await fetchFn(graph(env, encodeURIComponent(mediaId)), { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
    const j1 = await r1.json().catch(() => ({}));
    if (!r1.ok || !j1.url) {
      const kod = Number(j1?.error?.code) || null;
      // 100 (nesne yok / desteklenmeyen istek) ve 404: medya Meta'da artık yok
      if (r1.status === 404 || kod === 100 || kod === 131052) return { ok: false, tur: 'suresi_doldu', hata: 'Medya artık alınamıyor (Meta\'daki süresi dolmuş)' };
      return { ok: false, tur: 'meta', hata: `Meta medya bilgisi alınamadı: ${j1?.error?.message || `HTTP ${r1.status}`}`.slice(0, 300) };
    }
    const mimeType = sadeMime(j1.mime_type) || 'application/octet-stream';
    if (Number(j1.file_size) > sinir) return { ok: false, tur: 'boyut', hata: `Dosya 20 MB sınırını aşıyor (${mb(Number(j1.file_size))})` };

    // 2) İndir (Meta adresi de token ister)
    const r2 = await fetchFn(j1.url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
    if (!r2.ok) return { ok: false, tur: r2.status === 404 ? 'suresi_doldu' : 'meta', hata: r2.status === 404 ? 'Medya artık alınamıyor (Meta\'daki süresi dolmuş)' : `Medya indirilemedi: HTTP ${r2.status}` };
    const veri = await sinirliOku(r2, sinir);
    if (!veri) return { ok: false, tur: 'boyut', hata: 'Dosya 20 MB sınırını aşıyor' };

    // 3) crm/upload.php — CRM'in bugünkü yöntemi (alan adı "file")
    const dosya = rastgeleDosyaAdi(mimeType, rastgele);
    const fd = new FormData();
    fd.append('file', new Blob([veri], { type: mimeType }), dosya);
    const anahtar = String(env.MEDYA_YUKLEME_ANAHTARI || '').trim();
    const r3 = await fetchFn(env.MEDYA_YUKLEME_URL || YUKLEME_URL, { method: 'POST', body: fd, signal: ctrl.signal,
      ...(anahtar ? { headers: { 'X-Medya-Anahtari': anahtar } } : {}) });
    const metin = await r3.text().catch(() => '');
    const url = r3.ok ? yuklemeYanitiniCoz(metin, env) : null;
    if (!url) return { ok: false, tur: 'yukleme', hata: yuklemeHatasi(r3.status, metin, anahtar) };
    return { ok: true, url, mimeType, boyut: veri.length, dosya };
  } catch (err) {
    return { ok: false, tur: 'meta', hata: err?.name === 'AbortError' ? 'Medya işlemi zaman aşımına uğradı' : String(err?.message || err).slice(0, 300) };
  } finally { clearTimeout(z); }
}

// Mesaj belgesindeki medyayı işler ve sonucu YAZAR: medya.durum bekliyor → hazir | hata (+ medyaHata).
// m: mesaj belgesi verisi (mediaId, medya{}). Döner: medyaIndirYukle sonucu.
export async function mesajMedyasiniIsle({ db, appId, env = process.env, fetchFn = globalThis.fetch, hat, kid, mesajId, m = {}, rastgele, simdi = () => Date.now() }) {
  const ref = mesajlarRef(db, kid, appId).doc(String(mesajId));
  const onceki = m.medya || {};
  await ref.set({ medya: { ...onceki, durum: 'bekliyor' }, medyaHata: null }, { merge: true });
  const s = await medyaIndirYukle({ env, fetchFn, hat, mediaId: m.mediaId, rastgele });
  const zaman = new Date(simdi()).toISOString();
  if (s.ok) {
    await ref.set({ medya: { ...onceki, durum: 'hazir', url: s.url, mimeType: s.mimeType, boyut: s.boyut, dosya: s.dosya, yuklendi: zaman }, medyaHata: null }, { merge: true });
  } else {
    console.error('[whatsapp] medya alınamadı', maskele(m.waId || kid), s.tur, s.hata);
    await ref.set({ medya: { ...onceki, durum: 'hata', hataTuru: s.tur }, medyaHata: s.hata }, { merge: true });
  }
  return s;
}
