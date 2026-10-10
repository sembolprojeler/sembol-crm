// api/_lib/ai.js + api/_lib/botTalimatlari.js — sahte fetch (ağa çıkılmaz)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botCevabiUret, aiJsonCoz, aiCiktisiDogrula, aiAyarlari } from '../api/_lib/ai.js';
import { sistemTalimati, mesaiIcindeMi, fiyatRakamlariGecerliMi, kvkkMetni, girisMetni } from '../api/_lib/botTalimatlari.js';

const CEVAP = { reply: 'Kaç oda?', collected: { fromCity: 'İstanbul' }, handoff: false, handoffReason: '', intent: 'evden_eve', marka: 'sembol' };
const sahteFetch = (yanit, kayit = []) => async (url, ops) => { kayit.push({ url, ops, govde: JSON.parse(ops.body) }); return { ok: true, status: 200, json: async () => yanit }; };

test('sağlayıcı seçimi env ile: varsayılan gemini, claude seçilebilir, AI_MODEL geçersiz kılar', () => {
  assert.deepEqual(aiAyarlari({ GEMINI_API_KEY: 'g' }), { saglayici: 'gemini', anahtar: 'g', model: 'gemini-3.8-flash' });
  assert.equal(aiAyarlari({ AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'a' }).saglayici, 'claude');
  assert.equal(aiAyarlari({ AI_PROVIDER: 'claude', AI_MODEL: 'x' }).model, 'x');
});

test('Gemini: JSON yanıtı, sistem talimatı ve roller doğru; geçmiş müşteriyle başlar', async () => {
  const kayit = [];
  const r = await botCevabiUret({ sistem: 'S', gecmis: [{ rol: 'asistan', metin: 'eski' }, { rol: 'musteri', metin: 'a' }, { rol: 'musteri', metin: 'b' }, { rol: 'asistan', metin: 'c' }, { rol: 'musteri', metin: 'd' }],
    env: { GEMINI_API_KEY: 'k' }, fetchFn: sahteFetch({ candidates: [{ content: { parts: [{ text: JSON.stringify(CEVAP) }] } }] }, kayit) });
  assert.equal(r.ok, true);
  assert.equal(r.cikti.reply, 'Kaç oda?');
  const g = kayit[0].govde;
  assert.equal(kayit[0].ops.headers['x-goog-api-key'], 'k');
  assert.equal(g.systemInstruction.parts[0].text, 'S');
  assert.deepEqual(g.contents.map(c => c.role), ['user', 'model', 'user']);
  assert.equal(g.contents[0].parts[0].text, 'a\nb');
  assert.equal(g.generationConfig.responseMimeType, 'application/json');
});

test('Claude: messages API biçimi', async () => {
  const kayit = [];
  const r = await botCevabiUret({ sistem: 'S', gecmis: [{ rol: 'musteri', metin: 'selam' }], env: { AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k' },
    fetchFn: sahteFetch({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(CEVAP) + '\n```' }] }, kayit) });
  assert.equal(r.ok, true);
  assert.equal(kayit[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(kayit[0].govde.system, 'S');
  assert.deepEqual(kayit[0].govde.messages, [{ role: 'user', content: 'selam' }]);
});

test('hata durumları fırlatmaz, ok:false döner (anahtar yok / HTTP hata / geçersiz JSON / şema)', async () => {
  assert.equal((await botCevabiUret({ sistem: 'S', gecmis: [], env: {} })).ok, false);
  const http = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'kota' } }) });
  const r429 = await botCevabiUret({ sistem: 'S', gecmis: [], env: { GEMINI_API_KEY: 'k' }, fetchFn: http });
  assert.match(r429.hata, /429/);
  assert.equal(r429.tur, 'gecici');
  // Yapılandırma hataları (kredi bitti / model yok / anahtar yok) — yöneticiye uyarı için ayrı tür
  const kredi = async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'prepayment credits are depleted' } }) });
  assert.equal((await botCevabiUret({ sistem: 'S', gecmis: [], env: { GEMINI_API_KEY: 'k' }, fetchFn: kredi })).tur, 'yapilandirma');
  assert.equal((await botCevabiUret({ sistem: 'S', gecmis: [], env: {} })).tur, 'yapilandirma');
  const bozuk = sahteFetch({ candidates: [{ content: { parts: [{ text: 'merhaba!' }] } }] });
  assert.equal((await botCevabiUret({ sistem: 'S', gecmis: [], env: { GEMINI_API_KEY: 'k' }, fetchFn: bozuk })).ok, false);
  assert.equal(aiCiktisiDogrula({ reply: '' }).ok, false);
  assert.equal(aiCiktisiDogrula({ reply: 'x', handoff: 'evet' }).ok, false);
  assert.equal(aiCiktisiDogrula({ reply: 'x', intent: 'uydurma' }).deger.intent, 'diger');
  assert.deepEqual(aiJsonCoz('Tabii: {"reply":"a"} umarım'), { reply: 'a' });
});

test('mesai: hafta içi 09-18 İstanbul saati; cumartesi env ile', () => {
  assert.equal(mesaiIcindeMi(Date.parse('2026-10-06T07:00:00Z'), {}), true);   // Salı 10:00 TR
  assert.equal(mesaiIcindeMi(Date.parse('2026-10-06T15:30:00Z'), {}), false);  // Salı 18:30 TR
  assert.equal(mesaiIcindeMi(Date.parse('2026-10-10T08:00:00Z'), {}), false);  // Cumartesi 11:00
  assert.equal(mesaiIcindeMi(Date.parse('2026-10-10T08:00:00Z'), { WHATSAPP_CUMARTESI: '09:00-14:00' }), true);
});

test('talimat: fiyat yalnızca sistem bloğundan; DepoEvim +KDV; marka hep numaradan (sorma kuralı yok); Sembol hattında depolama', () => {
  const s1 = sistemTalimati({ marka: 'sembol', fiyat: { durum: 'tamam', marka: 'sembol', min: 51100, max: 64000 } });
  assert.match(s1, /51\.100 TL – 64\.000 TL/);
  assert.doesNotMatch(s1, /DEPOEVİM \(depoevim\.com\)/);
  const s2 = sistemTalimati({ marka: 'depoevim', fiyat: { durum: 'tamam', marka: 'depoevim', kira: { aylik: 7500, toplam: 37500, sureAy: 6, ucretsizAy: 1, odenecekAy: 5 }, nakliye: null, nakliyeEksik: ['pickupFloor'] } });
  assert.match(s2, /aylık kira 7\.500 TL \+KDV/);
  assert.match(s2, /alım ücreti için eksik: pickupFloor/);
  // 2026-10-10: marka her zaman numaradan — nötr kimlik / "markayı sor" / çıktıda marka alanı yok
  for (const s of [s1, s2, sistemTalimati({})]) {
    assert.doesNotMatch(s, /MARKA HENÜZ BELLİ DEĞİL|ortak WhatsApp dijital asistanı|"marka":/);
  }
  assert.match(sistemTalimati({}), /MARKA: Sembol Nakliyat/);
  // Sembol hattı: depolama ipucu (reddetme) her zaman; depolama talebinde DepoEvim bilgileri + alanları
  assert.match(s1, /DEPOLAMA TALEBİ: Müşteri eşya depolama/);
  const s3 = sistemTalimati({ marka: 'sembol', depolama: true, bilgiMetni: '- Kartal şubesi: test' });
  assert.match(s3, /SEN: "SEMBO Asistan"/);
  assert.match(s3, /DEPOEVİM \(depoevim\.com\)/); assert.match(s3, /Kartal şubesi: test/);
  assert.match(s3, /depoBoyutu/); assert.match(s3, /"\+KDV"/);
  assert.doesNotMatch(s3, /TOPLANACAK ALANLAR[^]*homeSize: "1\+1"/);
  assert.match(kvkkMetni('depoevim'), /depoevim\.com\/aydinlatma-metni/);
  assert.equal(girisMetni('').metin, '');
});

test('uydurma rakam koruması', () => {
  const f = { durum: 'tamam', marka: 'sembol', min: 51100, max: 64000 };
  assert.equal(fiyatRakamlariGecerliMi('Tahmini fiyat aralığı 51.100 TL – 64.000 TL', f), true);
  assert.equal(fiyatRakamlariGecerliMi('Tahmini 50.000 TL civarı', f), false);
  assert.equal(fiyatRakamlariGecerliMi('3. kat, 2026 yılında, 15 m³', null), true);
  assert.equal(fiyatRakamlariGecerliMi('18.000 TL\'den başlıyor', null), false);
});
