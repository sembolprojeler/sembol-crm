// api/whatsapp-send.js
// ============================================================================
// Sembol CRM — WHATSAPP PANELİ SUNUCU UCU (src/WhatsApp.jsx)
// ----------------------------------------------------------------------------
// whatsapp_conversations / messages tarayıcıdan YAZILAMAZ (firestore.rules); panelin
// bütün yazma işleri buradan geçer. Tek uç, "islem" alanıyla (Vercel fonksiyon sınırı):
//   gonder  → mesaj konuşmanın hattından (Cloud API) gider; messages'a from:"agent",
//             agentName, agentId; konuşma mode "human" (personel yazdı → bot susar)
//   devral  → mode "human", devralan = bu personel (needsAgent kalkar)
//   botaVer → mode "bot" — yalnızca devralan ya da yönetici
//   okundu  → unreadCount 0
//   medyaGetir → eski / alınamamış medyayı Meta'dan indirip crm/uploads'a yükler (api/_lib/whatsappMedya.js)
// Kimlik: personelId + şifre, sunucuda personnelList ile (api/_lib/crmYetki.js — GEÇİCİ).
// 24 saat penceresi: müşterinin son mesajından 24 saat geçtiyse serbest metin gönderilemez → 409.
// Yanıt: { ok: true, ... } | { ok: false, hata, sebep } (401 kimlik · 403 yetki · 404 · 409 pencere · 502 Meta)
// ============================================================================
import { getDb as dbVarsayilan, konusmaRef, mesajlarRef, havuzRef, maskele, waMetinGonder, uyariYaz, uyariTemizle, konusmaHatti } from './_lib/whatsapp.js';
import { personelDogrula, yoneticiMi } from './_lib/crmYetki.js';
import { mesajMedyasiniIsle } from './_lib/whatsappMedya.js';

export const PENCERE_MS = 24 * 60 * 60 * 1000;
const ISLEMLER = ['gonder', 'devral', 'botaVer', 'okundu', 'medyaGetir'];
const gecerliKimlik = (x) => typeof x === 'string' && x.length > 0 && x.length < 300 && !x.includes('/');

export function handlerOlustur({ getDb = dbVarsayilan, fetchFn = globalThis.fetch, env = process.env, simdi = () => Date.now() } = {}) {
  const appId = env.FIRESTORE_APP_ID;
  const iso = () => new Date(simdi()).toISOString();

  async function leadHareketi(db, k, islem) {
    for (const id of new Set([k.leadId, k.tasimaLeadId].filter(Boolean))) {
      try {
        const ref = havuzRef(db, id, appId);
        const s = await ref.get();
        if (s.exists) await ref.set({ hareketler: [...(s.data()?.hareketler || []), { tarih: iso(), kullanici: 'WhatsApp Paneli', islem }] }, { merge: true });
      } catch (err) { console.error('[whatsapp-send] lead hareketi yazılamadı', err?.message); }
    }
  }

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const cevap = (kod, govde) => res.status(kod).json(govde);
    if (req.method !== 'POST') return cevap(405, { ok: false, hata: 'Method not allowed' });
    if (!appId) return cevap(500, { ok: false, hata: 'Sunucu yapılandırma hatası' });
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    b = b && typeof b === 'object' ? b : {};
    const { islem, konusmaId } = b;
    if (!ISLEMLER.includes(islem) || !gecerliKimlik(konusmaId) || (islem === 'medyaGetir' && !gecerliKimlik(b.mesajId))) return cevap(400, { ok: false, hata: 'Geçersiz istek' });

    const db = getDb();
    const d = await personelDogrula(db, appId, { personelId: b.personelId, sifre: b.sifre });
    if (!d.ok) { console.warn('[whatsapp-send] reddedildi', d.kod, d.sebep); return cevap(d.kod, { ok: false, hata: d.hata, sebep: d.sebep }); }
    const p = d.personel;
    const kim = { id: p.id, ad: p.fullName || 'Personel' };

    const kRef = konusmaRef(db, konusmaId, appId);
    const ks = await kRef.get();
    if (!ks.exists) return cevap(404, { ok: false, hata: 'Konuşma bulunamadı' });
    const k = ks.data() || {};
    const nowIso = iso();

    if (islem === 'okundu') {
      if (Number(k.unreadCount) > 0) await kRef.set({ unreadCount: 0, okundu: { ...kim, zaman: nowIso } }, { merge: true });
      return cevap(200, { ok: true });
    }

    if (islem === 'medyaGetir') {
      const ms = await mesajlarRef(db, konusmaId, appId).doc(b.mesajId).get();
      const m = ms.exists ? ms.data() || {} : null;
      if (!m || !m.mediaId) return cevap(404, { ok: false, hata: 'Bu mesajda medya yok' });
      if (m.medya?.durum === 'hazir' && m.medya.url) return cevap(200, { ok: true, medya: m.medya });
      const hat = konusmaHatti(env, k);
      if (!hat) return cevap(409, { ok: false, sebep: 'hat_yok', hata: 'Bu konuşmanın WhatsApp hattı yapılandırmada yok.' });
      const s = await mesajMedyasiniIsle({ db, appId, env, fetchFn, hat, kid: konusmaId, mesajId: b.mesajId, m: { ...m, waId: k.waId }, simdi });
      if (s.ok) return cevap(200, { ok: true, medya: { url: s.url, mimeType: s.mimeType, boyut: s.boyut } });
      return cevap(s.tur === 'suresi_doldu' ? 410 : 502, { ok: false, sebep: s.tur, hata: s.hata });
    }

    if (islem === 'devral') {
      await kRef.set({ mode: 'human', devirTuru: 'personel', needsAgent: false, devralan: kim, devralmaAt: nowIso, handoffAt: nowIso,
        handoffReason: `Personel devraldı: ${kim.ad}`, sonOtomatikBilgi: null, unreadCount: 0 }, { merge: true });
      await leadHareketi(db, k, `${kim.ad} WhatsApp konuşmasını devraldı (bot sustu)`);
      console.log('[whatsapp-send] devral', maskele(k.waId || konusmaId), kim.ad);
      return cevap(200, { ok: true });
    }

    if (islem === 'botaVer') {
      if (k.mode !== 'human') return cevap(200, { ok: true, degisiklik: false });
      if (k.devralan?.id && String(k.devralan.id) !== String(p.id) && !yoneticiMi(p)) {
        return cevap(403, { ok: false, sebep: 'devralan_degil', hata: `Bu konuşmayı ${k.devralan.ad || 'başka bir personel'} devraldı; bota yalnızca o ya da bir yönetici geri verebilir.` });
      }
      await kRef.set({ mode: 'bot', needsAgent: false, devirTuru: null, devralan: null, sonOtomatikBilgi: null,
        botaDonus: { zaman: nowIso, sebep: 'personel', ...kim } }, { merge: true });
      await leadHareketi(db, k, `${kim.ad} WhatsApp konuşmasını bota geri verdi`);
      console.log('[whatsapp-send] bota verildi', maskele(k.waId || konusmaId), kim.ad);
      return cevap(200, { ok: true });
    }

    // ---- gonder
    const metin = typeof b.metin === 'string' ? b.metin.trim() : '';
    if (!metin) return cevap(400, { ok: false, hata: 'Mesaj boş' });
    if (metin.length > 4096) return cevap(400, { ok: false, hata: 'Mesaj çok uzun (en fazla 4096 karakter)' });
    const sonMusteri = Date.parse(k.lastCustomerMessageAt || '');
    if (!sonMusteri || simdi() - sonMusteri > PENCERE_MS) {
      return cevap(409, { ok: false, sebep: 'pencere', hata: '24 saat geçti, müşteri yazınca cevap verebilirsiniz (şablon mesaj sonraki aşamada).' });
    }
    const hat = konusmaHatti(env, k);
    if (!hat || !k.waId) return cevap(409, { ok: false, sebep: 'hat_yok', hata: 'Bu konuşmanın WhatsApp hattı yapılandırmada yok.' });

    const g = await waMetinGonder({ env, fetchFn, hat, to: k.waId, metin });
    const zaman = iso();
    await mesajlarRef(db, konusmaId, appId).doc(g.wamid || `yerel_${simdi()}`).set({
      direction: 'out', from: 'agent', agentName: kim.ad, agentId: kim.id, type: 'text', text: metin, timestamp: zaman, wamid: g.wamid || null,
      status: g.ok ? 'sent' : 'failed', ...(g.ok ? {} : { hata: { kod: g.hata.kod ?? null, mesaj: g.hata.mesaj || '' } }),
    });
    if (!g.ok) {
      console.error('[whatsapp-send] gönderilemedi', maskele(k.waId), g.hata.kod, g.hata.mesaj);
      if (g.hata.kalici) await uyariYaz(db, g.hata, zaman, appId);
      return cevap(502, { ok: false, sebep: 'meta', hata: `Mesaj gönderilemedi: ${g.hata.mesaj || 'WhatsApp hatası'}` });
    }
    await uyariTemizle(db, zaman, appId);
    const devralindi = k.mode !== 'human';
    await kRef.set({
      mode: 'human', devirTuru: 'personel', needsAgent: false, unreadCount: 0, lastAgentAt: zaman,
      lastMessageAt: zaman, lastMessagePreview: metin.slice(0, 120), sonOtomatikBilgi: null,
      ...(devralindi || !k.devralan ? { devralan: kim, devralmaAt: zaman } : {}),
      ...(devralindi ? { handoffAt: zaman, handoffReason: `Personel CRM'den yazdı: ${kim.ad}` } : {}),
    }, { merge: true });
    if (devralindi) await leadHareketi(db, k, `${kim.ad} WhatsApp'tan cevap yazdı (konuşmayı devraldı, bot sustu)`);
    return cevap(200, { ok: true, wamid: g.wamid });
  };
}

export default handlerOlustur();
