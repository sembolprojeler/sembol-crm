// api/_lib/ai.js
// ============================================================================
// Sembol CRM — YAPAY ZEKA KATMANI (WhatsApp botu · SEMBO Asistan)
// ----------------------------------------------------------------------------
// Sağlayıcı AI_PROVIDER ortam değişkeniyle seçilir; değiştirmek için koda
// dokunulmaz:  AI_PROVIDER=gemini (varsayılan) | claude
//   gemini → GEMINI_API_KEY (bot için AYRI anahtar; CRM'deki VITE_ anahtarı DEĞİL)
//   claude → ANTHROPIC_API_KEY
//   AI_MODEL (isteğe bağlı) → model adı (boşsa aşağıdaki varsayılan)
// SDK kullanılmaz (paket eklenmez): iki sağlayıcı da REST ile çağrılır.
//
// Çıktı ZORUNLU JSON'dur ve aiCiktisiDogrula ile şemaya göre denetlenir:
//   { reply, collected, handoff, handoffReason, handoffType, intent, marka }
// Geçersizse çağıran taraf (whatsapp-webhook) sabit yedek mesajı gönderir; konuşma
// KİLİTLENMEZ, müşterinin sonraki mesajında bot yeniden dener.
// ============================================================================

// DEĞİŞTİ (2026-10-07): gemini-2.5-flash 404 veriyordu; canlıda doğrulanan model gemini-3.8-flash
export const VARSAYILAN_MODEL = { gemini: 'gemini-3.8-flash', claude: 'claude-sonnet-5-5' };
export const DEVIR_TURLERI = ['temsilci', 'sikayet', 'bildir'];
export const NIYETLER = ['evden_eve', 'ofis', 'parca_esya', 'depolama', 'kiralik_depo', 'asansor_kiralama', 'sehirlerarasi', 'diger'];

export function aiAyarlari(env = process.env) {
  const saglayici = String(env.AI_PROVIDER || 'gemini').trim().toLowerCase() === 'claude' ? 'claude' : 'gemini';
  const anahtar = saglayici === 'claude' ? env.ANTHROPIC_API_KEY : env.GEMINI_API_KEY;
  return { saglayici, anahtar: anahtar || '', model: String(env.AI_MODEL || '').trim() || VARSAYILAN_MODEL[saglayici] };
}

export class AiHatasi extends Error {
  constructor(mesaj, ek = {}) { super(mesaj); this.ek = ek; }
}
// Yapılandırma hatası mı (anahtar yok, 400/401/402/403/404 — model adı, kredi, yetki)? Yöneticiye uyarı bandı için.
// Diğerleri (429, 5xx, zaman aşımı, ağ, geçersiz JSON) geçicidir. İkisinde de konuşma KİLİTLENMEZ.
const YAPILANDIRMA_DURUMLARI = [400, 401, 402, 403, 404];

// gecmis: [{ rol: 'musteri' | 'asistan', metin }] → sağlayıcıların istediği sırayla
// (kullanıcıyla başlar, roller dönüşümlü; art arda aynı rol birleştirilir)
function sirala(gecmis) {
  const sonuc = [];
  for (const m of gecmis) {
    const rol = m.rol === 'asistan' ? 'asistan' : 'musteri';
    const metin = String(m.metin || '').trim();
    if (!metin) continue;
    const son = sonuc[sonuc.length - 1];
    if (son && son.rol === rol) son.metin += '\n' + metin;
    else sonuc.push({ rol, metin });
  }
  while (sonuc.length && sonuc[0].rol !== 'musteri') sonuc.shift();
  if (!sonuc.length) sonuc.push({ rol: 'musteri', metin: '(müşteri metin dışı bir mesaj gönderdi)' });
  return sonuc;
}

async function zamanli(fetchFn, url, ops, ms) {
  const ctrl = new AbortController();
  const z = setTimeout(() => ctrl.abort(), ms);
  try { return await fetchFn(url, { ...ops, signal: ctrl.signal }); }
  finally { clearTimeout(z); }
}

async function geminiCagir({ ayar, sistem, gecmis, fetchFn, ms }) {
  const govde = {
    systemInstruction: { parts: [{ text: sistem }] },
    contents: sirala(gecmis).map(m => ({ role: m.rol === 'asistan' ? 'model' : 'user', parts: [{ text: m.metin }] })),
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      // Yeni modellerde "düşünme" çıktı payını kullanır — JSON yarıda kesilmesin diye geniş tutulur
      maxOutputTokens: 4096,
      // 2.5 Flash'ta düşünme kapatılabiliyor (kısa sohbet cevabı için gereksiz)
      ...(/2\.5-flash/.test(ayar.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ayar.model)}:generateContent`;
  const r = await zamanli(fetchFn, url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ayar.anahtar }, body: JSON.stringify(govde) }, ms);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiHatasi(`Gemini HTTP ${r.status}: ${j?.error?.message || ''}`.slice(0, 300), { durum: r.status });
  const metin = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!metin) throw new AiHatasi(`Gemini boş cevap (${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || 'bilinmiyor'})`);
  return metin;
}

async function claudeCagir({ ayar, sistem, gecmis, fetchFn, ms }) {
  const govde = {
    model: ayar.model,
    max_tokens: 1024,
    system: sistem,
    messages: sirala(gecmis).map(m => ({ role: m.rol === 'asistan' ? 'assistant' : 'user', content: m.metin })),
  };
  const r = await zamanli(fetchFn, 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ayar.anahtar, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(govde),
  }, ms);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiHatasi(`Claude HTTP ${r.status}: ${j?.error?.message || ''}`.slice(0, 300), { durum: r.status });
  const metin = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!metin) throw new AiHatasi(`Claude boş cevap (${j.stop_reason || 'bilinmiyor'})`);
  return metin;
}

// Model bazen JSON'u ```json … ``` içine ya da açıklamayla birlikte yazar — ilk dengeli nesne alınır
export function aiJsonCoz(metin) {
  const s = String(metin || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch { /* aşağıda dene */ }
  const bas = s.indexOf('{');
  const son = s.lastIndexOf('}');
  if (bas >= 0 && son > bas) { try { return JSON.parse(s.slice(bas, son + 1)); } catch { /* geçersiz */ } }
  return null;
}

// Şema denetimi — geçersizse { ok: false, hata }
export function aiCiktisiDogrula(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, hata: 'JSON nesnesi değil' };
  const reply = typeof o.reply === 'string' ? o.reply.trim() : '';
  if (!reply) return { ok: false, hata: 'reply boş' };
  if (reply.length > 1500) return { ok: false, hata: 'reply çok uzun' };
  if (o.collected != null && (typeof o.collected !== 'object' || Array.isArray(o.collected))) return { ok: false, hata: 'collected nesne değil' };
  if (o.handoff != null && typeof o.handoff !== 'boolean') return { ok: false, hata: 'handoff boolean değil' };
  const intent = NIYETLER.includes(o.intent) ? o.intent : 'diger';
  const marka = o.marka === 'sembol' || o.marka === 'depoevim' ? o.marka : '';
  return {
    ok: true,
    deger: {
      reply,
      collected: o.collected || {},
      handoff: o.handoff === true,
      handoffReason: typeof o.handoffReason === 'string' ? o.handoffReason.slice(0, 300) : '',
      // YENİ (2026-10-07): temsilci | sikayet → bot susar; bildir → personel bilgilendirilir, bot devam eder
      handoffType: DEVIR_TURLERI.includes(o.handoffType) ? o.handoffType : '',
      intent,
      marka,
    },
  };
}

// Tek giriş: sistem talimatı + son mesajlar → doğrulanmış çıktı.
// Hata / geçersiz JSON → { ok: false, tur: 'gecici' | 'yapilandirma', hata } (çağıran yedek davranışa geçer). Asla fırlatmaz.
export async function botCevabiUret({ sistem, gecmis, env = process.env, fetchFn = globalThis.fetch, ms = 20000 }) {
  const ayar = aiAyarlari(env);
  if (!ayar.anahtar) return { ok: false, tur: 'yapilandirma', hata: `${ayar.saglayici === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} tanımlı değil` };
  try {
    const cagir = ayar.saglayici === 'claude' ? claudeCagir : geminiCagir;
    const metin = await cagir({ ayar, sistem, gecmis: (gecmis || []).slice(-20), fetchFn, ms });
    const d = aiCiktisiDogrula(aiJsonCoz(metin));
    if (!d.ok) return { ok: false, tur: 'gecici', hata: `Geçersiz yapay zeka çıktısı: ${d.hata}`, ham: String(metin).slice(0, 500) };
    return { ok: true, cikti: d.deger, saglayici: ayar.saglayici, model: ayar.model };
  } catch (err) {
    const tur = YAPILANDIRMA_DURUMLARI.includes(err?.ek?.durum) ? 'yapilandirma' : 'gecici';
    return { ok: false, tur, durum: err?.ek?.durum ?? null, hata: err?.name === 'AbortError' ? 'Yapay zeka zaman aşımı' : String(err?.message || err) };
  }
}
