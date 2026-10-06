// api/whatsapp-webhook.js
// ============================================================================
// Sembol CRM — WHATSAPP CLOUD API WEBHOOK + SEMBO ASİSTAN BOTU
// ----------------------------------------------------------------------------
// GET  → Meta webhook doğrulaması (hub.mode=subscribe + hub.verify_token → hub.challenge)
// POST → Meta olayları:
//   1) X-Hub-Signature-256 (HMAC-SHA256, App Secret, HAM gövde) doğrulanır; geçersiz → 401
//   2) Meta'ya HEMEN 200 dönülür; iş waitUntil ile arka planda yapılır
//   3) Tekrar koruması: mesaj belgesi kimliği = wamid, create() ile yazılır; zaten
//      varsa (Meta aynı olayı yeniden gönderdi) işlenmez, bot ikinci kez cevap vermez
//   4) Peş peşe mesaj kilidi: müşteri art arda yazarsa kısa bir bekleme sonrası
//      yalnızca SON mesajın işleyicisi cevap verir (hepsini birlikte okur); bot
//      cevap yazarken gelen yeni mesajlar için tur tekrarlanır (konuşma başına tek kilit)
//   5) Bot cevabı (api/_lib/ai.js), fiyat (api/_lib/fiyatHesap.js — yapay zeka hesaplamaz),
//      lead kaydı (api/_lib/lead.js — sihirbazla aynı biçim), devretme (mode: human)
//   6) statuses → giden mesajın durumu (sent / delivered / read / failed)
//   7) Meta 190 / OAuthException ya da kalıcı hata → whatsapp_durum/token uyarısı
//      (CRM'de yöneticilere kırmızı bant); yapay zeka yapılandırma hatası → whatsapp_durum/ai
//   8) Yapay zeka hatası konuşmayı KİLİTLEMEZ: sabit mesaj (30 dk'da bir), sonraki mesajda yeniden dener
//
// ORTAM DEĞİŞKENLERİ (Vercel, VITE_ öneki YOK):
//   WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
//   AI_PROVIDER (gemini|claude), GEMINI_API_KEY | ANTHROPIC_API_KEY, AI_MODEL (isteğe bağlı)
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIRESTORE_APP_ID (mevcut)
//   İsteğe bağlı: WHATSAPP_BIRLESTIRME_MS (peş peşe mesaj bekleme, varsayılan 4000),
//   WHATSAPP_CUMARTESI ("09:00-14:00"), WHATSAPP_GUNLUK_GOOGLE (bot km sorgu sınırı, 300),
//   WHATSAPP_GRAPH_VERSION (varsayılan v23.0), WHATSAPP_BOT_KAPALI=1 (bot cevap vermez, yalnızca kaydeder)
// ============================================================================
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { waitUntil } from '@vercel/functions';
import { getDb as dbVarsayilan, konusmaRef, mesajlarRef, havuzRef, maskele, waMetinGonder, uyariYaz, uyariTemizle, aiUyariYaz, aiUyariTemizle, gelenMesajiCoz, metaHatasiCoz } from './_lib/whatsapp.js';
import { botCevabiUret } from './_lib/ai.js';
import { sistemTalimati, girisMetni, kvkkEkMetni, asistanAdi, fiyatRakamlariGecerliMi, hizmetReddiVarMi, RET_DUZELTME_NOTU, retYerineCevap } from './_lib/botTalimatlari.js';
import { botFiyatHesapla, leadFiyati } from './_lib/fiyatHesap.js';
import { whatsappLeadKaydi, whatsappAlanlariniTemizle, refKoduBul, refKoduTemizle, refBelgeId, leadAcikMi, waTelefonCrm } from './_lib/lead.js';

export const YEDEK_MESAJ = 'Mesajınızı aldık, ekibimiz en kısa sürede dönüş yapacak.';
const KILIT_SURESI_MS = 90000;
// Yapay zeka art arda hata verirse müşteriye sabit mesaj en fazla 30 dakikada bir gider
const YEDEK_ARALIGI_MS = 30 * 60 * 1000;
// Eski kod (2026-10-06) yapay zeka hatasında konuşmayı bu sebeple personele devrediyordu
const ESKI_AI_DEVIR_SEBEBI = /yapay zeka/i;

// Hangi markaların aydınlatma linki gönderildi? Eski konuşmalar: kvkkVerildi → eski nötr
// metin yalnızca Sembol linkini gönderiyordu.
export function kvkkGonderilenOku(k = {}) {
  if (k.kvkkGonderilen && typeof k.kvkkGonderilen === 'object') return { ...k.kvkkGonderilen };
  return k.kvkkVerildi ? { sembol: k.kvkkAydinlatmaTarihi || true } : {};
}
const DURUM_SIRASI = { sent: 1, delivered: 2, read: 3 };

// ------------------------------------------------------------------ İMZA
export function imzaGecerliMi(ham, baslik, secret) {
  if (!secret || !baslik || !String(baslik).startsWith('sha256=')) return false;
  const beklenen = Buffer.from('sha256=' + createHmac('sha256', secret).update(ham).digest('hex'));
  const gelen = Buffer.from(String(baslik));
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}
// İmza HAM gövde üzerinden hesaplanır: Vercel req.body'yi yalnızca erişilince
// ayrıştırır, bu yüzden req.body'ye DOKUNMADAN akış okunur.
async function hamGovdeOku(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  const parcalar = [];
  for await (const p of req) parcalar.push(typeof p === 'string' ? Buffer.from(p) : p);
  const ham = Buffer.concat(parcalar);
  if (ham.length) return ham;
  // Akış başka bir katmanca okunmuşsa: yalnızca HAM (metin / Buffer) gövde kabul edilir — ayrıştırılmış nesneden imza üretilemez
  const b = req.body;
  if (Buffer.isBuffer(b)) return b;
  return Buffer.from(typeof b === 'string' ? b : '');
}

const tl = (n) => `${Number(n).toLocaleString('tr-TR')} TL`;
// Yapay zeka fiyat cevabı üretemezse / rakam uydurursa kullanılan sabit fiyat metni
export function fiyatMesaji(f) {
  if (f.marka === 'depoevim') {
    const k = f.kira;
    const s = [`Seçimlerinize göre aylık depo kirası ${tl(k.aylik)} +KDV.`];
    if (k.ucretsizAy > 0) s.push(`${k.sureAy} ay peşin ödemede ${k.ucretsizAy} ay hediye: toplam ${tl(k.toplam)} +KDV.`);
    if (f.nakliye) s.push(`Eşyalarınızın adresten alımı için tahmini fiyat aralığı: ${tl(f.nakliye.min)} – ${tl(f.nakliye.max)} +KDV.`);
    s.push('Net fiyat ücretsiz ekspertiz sonrası belirlenir. Ücretsiz ekspertiz için randevu oluşturmamı ister misiniz?');
    return s.join('\n');
  }
  return `Verdiğiniz bilgilere göre tahmini fiyat aralığı: ${tl(f.min)} – ${tl(f.max)}.\nNet fiyat ücretsiz ekspertiz sonrası belirlenir. Ücretsiz ekspertiz için randevu oluşturmamı ister misiniz?`;
}

// Otomatik fiyatı olmayan hizmetler (Sembol)
const FIYATSIZ_NIYETLER = ['ofis', 'parca_esya', 'asansor_kiralama'];

export function handlerOlustur({
  getDb = dbVarsayilan, waitUntil: arkaPlanda = waitUntil, fetchFn = globalThis.fetch, env = process.env,
  simdi = () => Date.now(), bekle = (ms) => new Promise(r => setTimeout(r, ms)),
  aiUret = botCevabiUret, fiyatHesapla = botFiyatHesapla,
} = {}) {
  const appId = env.FIRESTORE_APP_ID;
  const iso = () => new Date(simdi()).toISOString();
  const msAyar = String(env.WHATSAPP_BIRLESTIRME_MS ?? '').trim();
  const birlestirmeMs = msAyar !== '' && Number(msAyar) >= 0 ? Number(msAyar) : 4000;

  async function fiyatGuvenli(db, marka, collected, intent) {
    if (!marka) return null;
    if (marka === 'sembol') {
      if (FIYATSIZ_NIYETLER.includes(intent) || collected.homeSize === 'ofis') return { durum: 'fiyat_yok', sebep: intent || 'ofis' };
      if (!collected.homeSize && !['evden_eve', 'sehirlerarasi'].includes(intent)) return null;
    }
    try { return await fiyatHesapla({ db, marka, alanlar: collected, env, appId, simdi: simdi() }); }
    catch (err) { console.error('[whatsapp] fiyat hesaplanamadı:', err?.message); return { durum: 'hata' }; }
  }

  // ---- lead (Müşteri Havuzu) — açık lead güncellenir, iş kapandıysa yeni lead
  async function leadYaz(db, { waId, konusma, marka, intent, collected, fiyat, handoff, handoffReason }) {
    const nowIso = iso();
    let id = null, onceki = {}, ilkKayit = true;
    const dene = async (aday) => {
      const s = await havuzRef(db, aday, appId).get();
      if (!s.exists) { id = aday; onceki = {}; ilkKayit = true; return true; }
      const d = s.data() || {};
      if (!leadAcikMi(d)) return false;
      id = aday; onceki = d; ilkKayit = false; return true;
    };
    if (konusma.leadId) await dene(konusma.leadId);
    if (!id && konusma.refKodu && !konusma.refKullanildi) await dene(refBelgeId(konusma.refKodu));
    if (!id) { id = `wa_${waId}_${simdi()}`; onceki = {}; ilkKayit = true; }

    const hizmet = intent === 'parca_esya' ? 'parca_esya' : intent === 'asansor_kiralama' ? 'asansor_kiralama' : '';
    const { kayit } = whatsappLeadKaydi({ marka: marka || 'sembol', hizmet, collected, waId, profilAdi: konusma.profileName || '', onceki, ilkKayit,
      tamamlandi: fiyat?.durum === 'tamam', fiyat: leadFiyati(fiyat), nowIso });
    if (handoff) {
      kayit.hareketler = [...(kayit.hareketler || onceki.hareketler || []), { tarih: nowIso, kullanici: 'WhatsApp Bot', islem: `Bot görüşmeyi personele devretti: ${handoffReason || '-'}` }];
      kayit.whatsappDevir = { tarih: nowIso, sebep: handoffReason || '' };
    }
    await havuzRef(db, id, appId).set(kayit, { merge: true });
    return id;
  }

  // ---- bir bot turu: son mesajları okur, cevap üretir, gönderir, kaydeder
  async function botTuru(db, waId) {
    const kRef = konusmaRef(db, waId, appId);
    const konusma = (await kRef.get()).data() || {};
    if (konusma.mode === 'human') return;
    const snap = await mesajlarRef(db, waId, appId).orderBy('timestamp', 'desc').limit(20).get();
    const mesajlar = snap.docs.map(d => d.data()).reverse();
    const gecmis = mesajlar.map(d => ({ rol: d.from === 'customer' ? 'musteri' : 'asistan', metin: d.text || '' }));
    const kvkkGonderilen = kvkkGonderilenOku(konusma);
    const ilkCevap = !Object.keys(kvkkGonderilen).length;
    const collected = konusma.collected || {};
    let marka = konusma.marka || '';
    let intent = konusma.intent || '';
    const fiyatOnce = await fiyatGuvenli(db, marka, collected, intent);
    const talimat = (m, c, f) => sistemTalimati({ marka: m, collected: c, fiyat: f, profilAdi: konusma.profileName || '', simdiMs: simdi(), env, ilkCevap });

    let reply, handoff, handoffReason, yeniCollected = collected, fiyat = fiyatOnce, aiHata = null;
    const r1 = await aiUret({ sistem: talimat(marka, collected, fiyatOnce), gecmis, env, fetchFn });
    if (!r1.ok) {
      // DEĞİŞTİ (2026-10-07): yapay zeka hatası konuşmayı KİLİTLEMEZ (personele devretmez);
      // müşterinin sonraki mesajında bot yeniden dener. Sabit mesaj 30 dakikada en fazla bir kez.
      aiHata = r1.hata;
      const hataAni = iso();
      console.error('[whatsapp] yapay zeka hatası:', maskele(waId), r1.tur, r1.hata);
      if (r1.tur === 'yapilandirma') await aiUyariYaz(db, r1, hataAni, appId);
      if (simdi() - (Date.parse(konusma.sonYedekMesaj || '') || 0) < YEDEK_ARALIGI_MS) {
        await kRef.set({ botHatasi: { zaman: hataAni, sebep: String(r1.hata || '').slice(0, 300), tur: r1.tur || 'gecici' } }, { merge: true });
        return;
      }
      reply = YEDEK_MESAJ; handoff = false; handoffReason = '';
    } else {
      await aiUyariTemizle(db, iso(), appId);
      let out = r1.cikti;
      marka = out.marka || marka;
      intent = out.intent && out.intent !== 'diger' ? out.intent : (intent || out.intent);
      yeniCollected = { ...collected, ...whatsappAlanlariniTemizle(out.collected) };
      fiyat = await fiyatGuvenli(db, marka, yeniCollected, intent);
      // Fiyat bu turda hesaplanabilir hâle geldiyse (ya da değiştiyse) cevap fiyatla yeniden üretilir
      if (fiyat?.durum === 'tamam' && JSON.stringify(fiyat) !== JSON.stringify(fiyatOnce) && !out.handoff) {
        const r2 = await aiUret({ sistem: talimat(marka, yeniCollected, fiyat), gecmis, env, fetchFn });
        if (r2.ok) {
          out = { ...r2.cikti, handoff: r2.cikti.handoff || out.handoff, handoffReason: r2.cikti.handoffReason || out.handoffReason };
          yeniCollected = { ...yeniCollected, ...whatsappAlanlariniTemizle(r2.cikti.collected) };
        } else out = { ...out, reply: fiyatMesaji(fiyat) };
      }
      reply = out.reply;
      handoff = out.handoff;
      handoffReason = out.handoffReason;
      // YENİ (2026-10-07): coğrafi hizmet reddi ("İstanbul dışı taşıma yapmıyoruz") yakalanır —
      // bir kez düzeltme notuyla yeniden üretilir; yine ret varsa sabit cevap (soru / fiyat / devret)
      if (hizmetReddiVarMi(reply)) {
        console.warn('[whatsapp] cevapta hizmet reddi — yeniden üretiliyor', maskele(waId));
        const r3 = await aiUret({ sistem: `${talimat(marka, yeniCollected, fiyat)}\n${RET_DUZELTME_NOTU}`, gecmis, env, fetchFn });
        if (r3.ok && !hizmetReddiVarMi(r3.cikti.reply)) {
          reply = r3.cikti.reply; handoff = r3.cikti.handoff; handoffReason = r3.cikti.handoffReason;
          yeniCollected = { ...yeniCollected, ...whatsappAlanlariniTemizle(r3.cikti.collected) };
        } else if (fiyat?.durum === 'tamam') {
          reply = fiyatMesaji(fiyat);
        } else {
          const y = retYerineCevap(fiyat);
          reply = y.metin;
          if (y.devret) { handoff = true; handoffReason = 'Fiyatı ekip iletecek (bot reddetmeye çalıştı)'; }
        }
      }
      // Uydurma rakam koruması: cevapta sistemin hesaplamadığı bir tutar varsa sabit metin
      if (!fiyatRakamlariGecerliMi(reply, fiyat)) {
        console.warn('[whatsapp] cevapta sistem dışı tutar — sabit metne çevrildi', maskele(waId));
        if (fiyat?.durum === 'tamam') reply = fiyatMesaji(fiyat);
        else { reply = 'Fiyat bilgisini ekibimiz sizinle paylaşacak. ' + YEDEK_MESAJ; handoff = true; handoffReason = handoffReason || 'Fiyat sorusu (otomatik fiyat yok)'; }
      }
      if (fiyat && ['fiyat_yok', 'hata'].includes(fiyat.durum) && !handoff && /fiyat|ücret|ne kadar|kaç para/i.test(gecmis.filter(g => g.rol === 'musteri').slice(-1)[0]?.metin || '')) {
        handoff = true; handoffReason = fiyat.durum === 'hata' ? 'Fiyat hesaplanamadı' : 'Otomatik fiyatı olmayan hizmet';
      }
    }
    // KVKK: ilk cevapta tanıtım + aydınlatma linki (marka belli değilse iki marka birden);
    // marka sonradan belli olduysa ve linki gitmediyse kişisel bilgi istemeden önce BİR KEZ
    let kvkkYeni = [];
    if (ilkCevap) { const gm = girisMetni(marka); reply = `${gm.metin}\n\n${reply}`; kvkkYeni = gm.markalar; }
    else if (marka && !kvkkGonderilen[marka]) { reply = `${kvkkEkMetni(marka)}\n\n${reply}`; kvkkYeni = [marka]; }

    // Fiyat izi (Vercel logu + konuşma belgesi) — numara maskeli
    const fiyatIzi = fiyat ? { durum: fiyat.durum, kaynak: fiyat.kaynak || '', toplamKm: fiyat.toplamKm ?? null,
      eksik: [...(fiyat.eksik || []), ...(fiyat.konumHatalari || []).map(k => `${k}?`)], sebep: fiyat.sebep || '' } : null;
    console.log('[whatsapp] tur', maskele(waId), JSON.stringify({ marka, intent, fiyat: fiyatIzi, handoff: !!handoff }));

    // Gönder
    const g = await waMetinGonder({ env, fetchFn, to: waId, metin: reply });
    const nowIso = iso();
    const cikanId = g.wamid || `yerel_${simdi()}`;
    await mesajlarRef(db, waId, appId).doc(cikanId).set({
      direction: 'out', from: 'bot', agentName: asistanAdi(marka), type: 'text', text: reply, timestamp: nowIso, wamid: g.wamid || null,
      status: g.ok ? 'sent' : 'failed', ...(g.ok ? {} : { hata: { kod: g.hata.kod ?? null, mesaj: g.hata.mesaj || '' } }),
      ...(aiHata ? { aiHata: String(aiHata).slice(0, 300) } : {}),
    });
    if (!g.ok) {
      console.error('[whatsapp] gönderilemedi', maskele(waId), g.hata.kod, g.hata.mesaj);
      if (g.hata.kalici) await uyariYaz(db, g.hata, nowIso, appId);
    } else await uyariTemizle(db, nowIso, appId);

    // Lead: ilk anlamlı bilgi geldiyse (ya da devredildiyse) oluştur / güncelle
    let leadId = konusma.leadId || null;
    if (Object.keys(yeniCollected).length || handoff) {
      try {
        leadId = await leadYaz(db, { waId, konusma, marka, intent, collected: yeniCollected, fiyat, handoff, handoffReason });
      } catch (err) { console.error('[whatsapp] lead yazılamadı', maskele(waId), err?.message); }
    }

    await kRef.set({
      collected: yeniCollected, marka, intent, leadId,
      ...(leadId && konusma.refKodu && leadId === refBelgeId(konusma.refKodu) ? { refKullanildi: true } : {}),
      ...(g.ok && kvkkYeni.length ? {
        kvkkVerildi: true, kvkkGonderilen: { ...kvkkGonderilen, ...Object.fromEntries(kvkkYeni.map(m => [m, nowIso])) },
        ...(ilkCevap ? { kvkkAydinlatmaTarihi: nowIso } : {}),
      } : {}),
      ...(aiHata ? { botHatasi: { zaman: nowIso, sebep: String(aiHata).slice(0, 300), tur: r1.tur || 'gecici' }, ...(g.ok ? { sonYedekMesaj: nowIso } : {}) } : { botHatasi: null }),
      lastMessageAt: nowIso, lastMessagePreview: reply.slice(0, 120), lastBotAt: nowIso,
      ...(fiyat?.durum === 'tamam' ? { sonFiyat: fiyat } : {}),
      ...(fiyatIzi ? { sonFiyatDurumu: { ...fiyatIzi, zaman: nowIso } } : {}),
      ...(handoff ? { mode: 'human', needsAgent: true, handoffReason: handoffReason || '', handoffAt: nowIso } : {}),
    }, { merge: true });
  }

  // ---- YENİ (2026-10-07): yapay zeka hatası yüzünden personele geçmiş, personelin henüz cevap
  // yazmadığı konuşma müşterinin yeni mesajında bota döner. Eski kodun yazdığı işaretler:
  // handoffReason "Yapay zeka hatası" ya da (sebep boşsa) devirdeki bot mesajında aiHata alanı.
  // Gerçek devretmeler (temsilci isteği, şikayet, ofis …) ve personelin yazdığı konuşmalar AÇILMAZ.
  async function aiKilidiniAc(db, waId, k) {
    const devir = k.handoffAt || '';
    const sebepAi = ESKI_AI_DEVIR_SEBEBI.test(k.handoffReason || '');
    const mesajlar = (await mesajlarRef(db, waId, appId).orderBy('timestamp', 'desc').limit(50).get()).docs.map(d => d.data());
    if (mesajlar.some(m => m.from === 'agent' && (!devir || String(m.timestamp) >= devir))) return k;
    const devirMesaji = mesajlar.find(m => m.from === 'bot' && (!devir || String(m.timestamp) <= devir));
    if (!sebepAi && !(!k.handoffReason && devirMesaji?.aiHata)) return k;
    const nowIso = iso();
    await konusmaRef(db, waId, appId).set({
      mode: 'bot', needsAgent: false, handoffReason: '', aiKilidiAcildi: nowIso,
      botHatasi: { zaman: nowIso, sebep: 'Önceki yapay zeka hatası — konuşma bota geri döndü', tur: 'gecici' },
    }, { merge: true });
    if (k.leadId) {
      try {
        const lRef = havuzRef(db, k.leadId, appId);
        const l = await lRef.get();
        if (l.exists) await lRef.set({ hareketler: [...(l.data()?.hareketler || []), { tarih: nowIso, kullanici: 'WhatsApp Bot', islem: 'Bot görüşmeye geri döndü (önceki devir yapay zeka hatasından)' }] }, { merge: true });
      } catch (err) { console.error('[whatsapp] lead hareketi yazılamadı', maskele(waId), err?.message); }
    }
    console.log('[whatsapp] yapay zeka kilidi açıldı', maskele(waId));
    return { ...k, mode: 'bot', needsAgent: false, handoffReason: '' };
  }

  // ---- gelen müşteri mesajı
  async function mesajIsle(db, m, profilAdi) {
    const waId = String(m.from || '');
    const wamid = String(m.id || '');
    if (!waId || !wamid) return;
    const c = gelenMesajiCoz(m);
    const ref = c.tip === 'text' || c.tip === 'button' ? refKoduBul(c.metin) : null;
    const metin = ref ? refKoduTemizle(c.metin) : c.metin;
    const zaman = Number(m.timestamp) > 0 ? new Date(Number(m.timestamp) * 1000).toISOString() : iso();

    // 1) Tekrar koruması — wamid ile create(); varsa çık
    try {
      await mesajlarRef(db, waId, appId).doc(wamid).create({
        direction: 'in', from: 'customer', type: c.tip, text: metin, timestamp: zaman, alindi: iso(), wamid,
        mediaId: c.mediaId || null, ...(c.konum ? { konum: c.konum } : {}), ...(ref ? { refKodu: ref.kod } : {}),
      });
    } catch (err) {
      if (err?.code === 6 || /ALREADY_EXISTS/i.test(String(err?.message))) { console.log('[whatsapp] tekrar gelen mesaj atlandı', maskele(waId)); return; }
      throw err;
    }

    // 2) Konuşma özeti (okunmamış sayısı, son mesaj, ref → marka)
    const kRef = konusmaRef(db, waId, appId);
    let konusma = await db.runTransaction(async (t) => {
      const s = await t.get(kRef);
      const k = s.exists ? s.data() : {};
      const yeni = {
        waId, phone: waTelefonCrm(waId), profileName: profilAdi || k.profileName || '',
        lastMessageAt: zaman, lastMessagePreview: c.ozet || '', lastCustomerMessageAt: zaman, lastCustomerWamid: wamid,
        unreadCount: (Number(k.unreadCount) || 0) + 1,
        mode: k.mode || 'bot',
        ...(s.exists ? {} : { createdAt: iso(), needsAgent: false, collected: {} }),
        // Ref kodu yalnızca ilk kez (ya da yeni bir ref) gelince bağlanır; marka henüz yoksa ref'ten
        ...(ref && ref.kod !== k.refKodu ? { refKodu: ref.kod, refKullanildi: false, ...(k.marka ? {} : { marka: ref.marka }) } : {}),
      };
      t.set(kRef, yeni, { merge: true });
      return { ...k, ...yeni };
    });
    if (c.botaGitsin && konusma.mode === 'human') konusma = await aiKilidiniAc(db, waId, konusma);
    if (!c.botaGitsin || konusma.mode === 'human' || env.WHATSAPP_BOT_KAPALI === '1') return;

    // 3) Peş peşe mesaj: kısa bekleme; bu arada yeni mesaj geldiyse cevabı o verir
    await bekle(birlestirmeMs);
    const kilitAlindi = await db.runTransaction(async (t) => {
      const k = (await t.get(kRef)).data() || {};
      if (k.lastCustomerWamid !== wamid) return false;
      if (k.botKilit && simdi() - Date.parse(k.botKilit.zaman) < KILIT_SURESI_MS) { t.set(kRef, { botTekrar: true }, { merge: true }); return false; }
      t.set(kRef, { botKilit: { wamid, zaman: iso() }, botTekrar: false }, { merge: true });
      return true;
    });
    if (!kilitAlindi) return;

    // 4) Bot turu; bu sırada yeni mesaj geldiyse (botTekrar) bir tur daha
    try {
      for (let tur = 0; tur < 3; tur++) {
        await botTuru(db, waId);
        const devam = await db.runTransaction(async (t) => {
          const k = (await t.get(kRef)).data() || {};
          if (k.botTekrar && k.mode !== 'human') { t.set(kRef, { botTekrar: false, botKilit: { wamid, zaman: iso() } }, { merge: true }); return true; }
          t.set(kRef, { botKilit: null, botTekrar: false }, { merge: true });
          return false;
        });
        if (!devam) return;
      }
    } catch (err) {
      await kRef.set({ botKilit: null }, { merge: true }).catch(() => {});
      throw err;
    }
  }

  // ---- giden mesaj durumu
  async function durumIsle(db, s) {
    const waId = String(s.recipient_id || '');
    if (!waId || !s.id) return;
    const ref = mesajlarRef(db, waId, appId).doc(String(s.id));
    const snap = await ref.get();
    if (!snap.exists) return; // bu sistemden gönderilmemiş mesaj
    const d = snap.data() || {};
    const zaman = Number(s.timestamp) > 0 ? new Date(Number(s.timestamp) * 1000).toISOString() : iso();
    if (s.status === 'failed') {
      const hata = metaHatasiCoz({ error: s.errors?.[0] || {} }, 200);
      await ref.set({ status: 'failed', statusAt: zaman, hata: { kod: hata.kod, mesaj: hata.mesaj } }, { merge: true });
      console.error('[whatsapp] mesaj iletilemedi', maskele(waId), hata.kod, hata.mesaj);
      if (hata.kalici) await uyariYaz(db, hata, iso(), appId);
      return;
    }
    if ((DURUM_SIRASI[s.status] || 0) > (DURUM_SIRASI[d.status] || 0)) await ref.set({ status: s.status, statusAt: zaman }, { merge: true });
  }

  async function olaylariIsle(payload) {
    const db = getDb();
    const isler = [];
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        if (change?.field !== 'messages') continue;
        const v = change.value || {};
        // Aynı uygulamaya bağlı başka numaraların olayları işlenmez
        if (env.WHATSAPP_PHONE_NUMBER_ID && v.metadata?.phone_number_id && String(v.metadata.phone_number_id) !== String(env.WHATSAPP_PHONE_NUMBER_ID)) continue;
        const profiller = Object.fromEntries((v.contacts || []).map(c => [String(c.wa_id), c.profile?.name || '']));
        (v.statuses || []).forEach(s => isler.push(durumIsle(db, s)));
        (v.messages || []).forEach(m => isler.push(mesajIsle(db, m, profiller[String(m.from)] || '')));
      }
    }
    const sonuc = await Promise.allSettled(isler);
    sonuc.filter(r => r.status === 'rejected').forEach(r => console.error('[whatsapp] olay işlenemedi:', r.reason?.message || r.reason));
  }

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      if (q['hub.mode'] === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && q['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(String(q['hub.challenge'] || ''));
        return;
      }
      res.status(403).json({ error: 'Doğrulama başarısız' });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!env.WHATSAPP_APP_SECRET || !appId) { console.error('[whatsapp] WHATSAPP_APP_SECRET / FIRESTORE_APP_ID tanımlı değil'); res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }

    let ham;
    try { ham = await hamGovdeOku(req); } catch { res.status(400).json({ error: 'Gövde okunamadı' }); return; }
    if (!imzaGecerliMi(ham, req.headers['x-hub-signature-256'], env.WHATSAPP_APP_SECRET)) { res.status(401).json({ error: 'Geçersiz imza' }); return; }
    let payload;
    try { payload = JSON.parse(ham.toString('utf8')); } catch { res.status(400).json({ error: 'Geçersiz JSON' }); return; }

    // Meta'ya hızlı 200 — asıl iş arka planda (waitUntil)
    arkaPlanda(olaylariIsle(payload).catch(err => console.error('[whatsapp] arka plan hatası:', err?.message || err)));
    res.status(200).json({ ok: true });
  };
}

export default handlerOlustur();
