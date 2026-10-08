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
//   YENİ (2026-10-08) — BOT BİLGİLERİ (Sistem Dosyaları > Bot Bilgileri, src/BotBilgileri.jsx), konusmaId YOK:
//   botBilgiKaydet → { marka, icerik, tabanSurum, kaynak: { tur: 'elle'|'word', dosyaAdi?, url? } } → yeni sürüm
//   botBilgiGeriAl → { marka, surumId, tabanSurum } → eski sürümün içeriği yeni sürüm olur
//   botBilgiDene   → { marka, soru, kaynak: 'kayitli'|'taslak', icerik? } → botun cevabı GÖSTERİLİR;
//                    müşteriye hiçbir şey gitmez, lead / konuşma / günlük sayaç DEĞİŞMEZ
//   Yetki: Sistem Yöneticisi, Firma Sahibi, Müdür, pozisyonunda "Yönetici" (botBilgiYetkisi; canEdit AÇMAZ)
// Kimlik: personelId + şifre, sunucuda personnelList ile (api/_lib/crmYetki.js — GEÇİCİ).
// 24 saat penceresi: müşterinin son mesajından 24 saat geçtiyse serbest metin gönderilemez → 409.
// Yanıt: { ok: true, ... } | { ok: false, hata, sebep } (401 kimlik · 403 yetki · 404 · 409 pencere · 502 Meta)
// ============================================================================
import { getDb as dbVarsayilan, konusmaRef, mesajlarRef, havuzRef, maskele, waMetinGonder, uyariYaz, uyariTemizle, konusmaHatti } from './_lib/whatsapp.js';
import { personelDogrula, yoneticiMi } from './_lib/crmYetki.js';
import { mesajMedyasiniIsle } from './_lib/whatsappMedya.js';
import { botBilgiKaydet, botBilgiGeriAl, botBilgiRef } from './_lib/botBilgi.js';
import { botCevabiUret } from './_lib/ai.js';
import { sistemTalimati, fiyatRakamlariGecerliMi } from './_lib/botTalimatlari.js';
import { botBilgiYetkisi, botBilgiMarkasiGecerliMi, botBilgiDogrula, botBilgiMetni } from '../src/botBilgiSema.js';

export const PENCERE_MS = 24 * 60 * 60 * 1000;
const ISLEMLER = ['gonder', 'devral', 'botaVer', 'okundu', 'medyaGetir'];
const BOT_BILGI_ISLEMLERI = ['botBilgiKaydet', 'botBilgiGeriAl', 'botBilgiDene'];
const gecerliKimlik = (x) => typeof x === 'string' && x.length > 0 && x.length < 300 && !x.includes('/');
const DOSYA_KOKU = 'https://www.sembolevdeneve.com/crm/uploads/';
// Tarayıcıdan gelen sürüm kaynağı: yalnızca bilinen alanlar; URL yalnızca crm/uploads altı
function kaynakTemizle(k) {
  const tur = k?.tur === 'word' ? 'word' : 'elle';
  if (tur === 'elle') return { tur };
  const dosyaAdi = typeof k.dosyaAdi === 'string' ? k.dosyaAdi.replace(/[\r\n]/g, ' ').trim().slice(0, 200) : '';
  const url = typeof k.url === 'string' && k.url.startsWith(DOSYA_KOKU) && k.url.length <= 500 && !/[\s"'<>]/.test(k.url) ? k.url : '';
  return { tur, ...(dosyaAdi ? { dosyaAdi } : {}), ...(url ? { url } : {}) };
}

export function handlerOlustur({ getDb = dbVarsayilan, fetchFn = globalThis.fetch, env = process.env, simdi = () => Date.now(), aiUret = botCevabiUret } = {}) {
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

  // ---- Bot Bilgileri (2026-10-08) — yalnızca botBilgiYetkisi olan yöneticiler
  async function botBilgiIslemi(b, cevap) {
    const { islem, marka } = b;
    if (!botBilgiMarkasiGecerliMi(marka)) return cevap(400, { ok: false, hata: 'Geçersiz marka' });
    const db = getDb();
    const d = await personelDogrula(db, appId, { personelId: b.personelId, sifre: b.sifre },
      { yetki: botBilgiYetkisi, yetkiHatasi: 'Bot Bilgileri yalnızca yöneticilere açıktır.' });
    if (!d.ok) { console.warn('[bot-bilgi] reddedildi', islem, d.kod, d.sebep); return cevap(d.kod, { ok: false, hata: d.hata, sebep: d.sebep }); }
    const kim = { id: d.personel.id, ad: d.personel.fullName || 'Personel' };
    const tabanSurum = typeof b.tabanSurum === 'string' && b.tabanSurum.length < 100 ? b.tabanSurum : null;

    if (islem === 'botBilgiKaydet') {
      const s = await botBilgiKaydet(db, appId, marka, { icerik: b.icerik, kim, kaynak: kaynakTemizle(b.kaynak), tabanSurum, simdi: simdi() });
      if (!s.ok) return cevap(s.kod, { ok: false, hata: s.hata, sebep: s.sebep });
      console.log('[bot-bilgi] kaydedildi', marka, s.surumId, kim.ad, s.toplam);
      return cevap(200, { ok: true, surumId: s.surumId, kaydedilme: s.kaydedilme });
    }

    if (islem === 'botBilgiGeriAl') {
      if (!gecerliKimlik(b.surumId)) return cevap(400, { ok: false, hata: 'Geçersiz sürüm' });
      const s = await botBilgiGeriAl(db, appId, marka, { surumId: b.surumId, kim, tabanSurum, simdi: simdi() });
      if (!s.ok) return cevap(s.kod, { ok: false, hata: s.hata, sebep: s.sebep });
      console.log('[bot-bilgi] geri alındı', marka, b.surumId, '→', s.surumId, kim.ad);
      return cevap(200, { ok: true, surumId: s.surumId, kaydedilme: s.kaydedilme });
    }

    // ---- botBilgiDene: yalnızca yapay zeka çağrılır — gönderim / Firestore yazımı YOK
    const soru = typeof b.soru === 'string' ? b.soru.trim() : '';
    if (!soru || soru.length > 1000) return cevap(400, { ok: false, hata: 'Soru 1-1000 karakter olmalı' });
    let bilgiMetni = '', bilgiKaynagi = 'yedek';
    if (b.kaynak === 'taslak') {
      const v = botBilgiDogrula(b.icerik);
      if (!v.ok) return cevap(400, { ok: false, hata: v.hata });
      bilgiMetni = botBilgiMetni(v.icerik); bilgiKaynagi = 'taslak';
    } else {
      const s = await botBilgiRef(db, appId, marka).get();
      const v = s.exists ? botBilgiDogrula(s.data()?.icerik) : { ok: false };
      if (v.ok) { bilgiMetni = botBilgiMetni(v.icerik); bilgiKaynagi = 'kayitli'; }
    }
    if (!bilgiMetni) bilgiKaynagi = 'yedek';
    const sistem = sistemTalimati({ marka, collected: {}, fiyat: null, simdiMs: simdi(), env, ilkCevap: false, bilgiMetni });
    const r = await aiUret({ sistem, gecmis: [{ rol: 'musteri', metin: soru }], env, fetchFn });
    if (!r.ok) return cevap(502, { ok: false, hata: `Yapay zeka cevap vermedi: ${String(r.hata || r.tur || '').slice(0, 200)}` });
    const reply = String(r.cikti.reply || '');
    const tutarUyarisi = !fiyatRakamlariGecerliMi(reply, null);
    console.log('[bot-bilgi] dene', marka, bilgiKaynagi, kim.ad);
    return cevap(200, { ok: true, cevap: reply, bilgiKaynagi, intent: r.cikti.intent || '', handoff: !!r.cikti.handoff,
      handoffType: r.cikti.handoffType || '', handoffReason: r.cikti.handoffReason || '',
      ...(tutarUyarisi ? { uyari: 'Cevapta sistemin hesaplamadığı bir tutar var; gerçek konuşmada bot bu cevabı sabit metne çevirirdi.' } : {}) });
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
    if (BOT_BILGI_ISLEMLERI.includes(islem)) return botBilgiIslemi(b, cevap);
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
