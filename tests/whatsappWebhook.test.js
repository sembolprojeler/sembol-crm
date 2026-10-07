// api/whatsapp-webhook.js — uçtan uca (sahte Firestore, sahte Meta API, sahte yapay zeka)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur, imzaGecerliMi, devirTuruBul, YEDEK_MESAJ, SESSIZ_BILGI_MESAJI, SINIR_MESAJI, SEMBOL_TASIMA_KVKK } = await import('../api/whatsapp-webhook.js');

const SECRET = 'gizli';
const ENV = { WHATSAPP_APP_SECRET: SECRET, WHATSAPP_VERIFY_TOKEN: 'dogrula', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '111',
  FIRESTORE_APP_ID: 'test-app', GEMINI_API_KEY: 'k', WHATSAPP_BIRLESTIRME_MS: '0' };
const WA = '905321234567';
// Gelecekteki Sembol hattı (Sembol talimatları kodda kalır, 0850'de kullanılmaz)
const HATLAR_IKI = JSON.stringify([
  { phoneNumberId: '111', marka: 'depoevim', tokenEnv: 'WHATSAPP_TOKEN', eskiKimlik: true },
  { phoneNumberId: '222', marka: 'sembol', tokenEnv: 'WHATSAPP_TOKEN_SEMBOL' },
]);
const ENV_SEMBOL = { WHATSAPP_HATLAR: JSON.stringify([{ phoneNumberId: '111', marka: 'sembol', eskiKimlik: true }]) };

let SAAT = Date.parse('2026-10-06T08:00:00Z');
function ortam({ aiCevaplari = [], metaHata = null, fiyat = null, env = {}, db = sahteDb(), bekle } = {}) {
  const gonderilen = [], aiCagrilari = [], arka = [];
  const fetchFn = async (url, ops) => {
    if (String(url).includes('graph.facebook.com')) {
      gonderilen.push({ ...JSON.parse(ops.body), _url: String(url), _yetki: ops.headers.Authorization });
      if (metaHata) return { ok: false, status: 401, json: async () => ({ error: metaHata }) };
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: `wamid.out${gonderilen.length}` }] }) };
    }
    throw new Error('beklenmeyen istek ' + url);
  };
  const aiUret = async (a) => {
    aiCagrilari.push(a);
    const c = aiCevaplari[Math.min(aiCagrilari.length - 1, aiCevaplari.length - 1)];
    return typeof c === 'function' ? c(a) : c;
  };
  const fiyatHesapla = async (a) => (typeof fiyat === 'function' ? fiyat(a) : fiyat);
  const handler = handlerOlustur({ getDb: () => db, waitUntil: (p) => arka.push(p), fetchFn, env: { ...ENV, ...env }, aiUret, fiyatHesapla,
    bekle: bekle || (async () => {}), simdi: () => SAAT });
  return { db, handler, gonderilen, aiCagrilari, bitir: async () => { while (arka.length) await arka.shift(); } };
}
const tamam = (o) => ({ ok: true, cikti: { reply: 'Hangi depo boyutunu düşünüyorsunuz?', collected: {}, handoff: false, handoffReason: '', handoffType: '', intent: 'depolama', marka: '', ...o } });
const mesaj = (id, metin, ek = {}) => ({ from: WA, id, timestamp: '1791273600', type: 'text', text: { body: metin }, ...ek });
const olay = (value, hat = '111') => ({ object: 'whatsapp_business_account', entry: [{ id: 'x', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: hat }, ...value } }] }] });

function istek(payload, imza = true) {
  const ham = Buffer.from(JSON.stringify(payload));
  const req = {
    method: 'POST',
    headers: { 'x-hub-signature-256': imza ? 'sha256=' + createHmac('sha256', SECRET).update(ham).digest('hex') : 'sha256=00' },
    async *[Symbol.asyncIterator]() { yield ham; },
  };
  return req;
}
async function gonder(o, payload) {
  const res = sahteYanit();
  res.send = (g) => { res.govde = g; return res; };
  await o.handler(istek(payload), res);
  await o.bitir();
  return res;
}
const konusma = (db) => db.belge(`whatsapp_conversations/${WA}`);
const mesajlar = (db) => [...db.belgeler.entries()].filter(([k]) => k.includes(`whatsapp_conversations/${WA}/messages/`)).map(([, v]) => v);

test('GET doğrulama: doğru token → challenge, yanlış → 403', async () => {
  const { handler } = ortam();
  const r1 = sahteYanit(); r1.send = (g) => { r1.govde = g; return r1; };
  await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'dogrula', 'hub.challenge': '12345' }, headers: {} }, r1);
  assert.equal(r1.kod, 200); assert.equal(r1.govde, '12345');
  const r2 = sahteYanit();
  await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'yanlis', 'hub.challenge': '1' }, headers: {} }, r2);
  assert.equal(r2.kod, 403);
});

test('imza: geçersiz → 401 ve hiçbir şey işlenmez', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  const res = sahteYanit();
  await o.handler(istek(olay({ messages: [mesaj('w1', 'merhaba')] }), false), res);
  await o.bitir();
  assert.equal(res.kod, 401);
  assert.equal(o.aiCagrilari.length, 0);
  assert.equal(imzaGecerliMi(Buffer.from('a'), 'sha256=' + createHmac('sha256', 's').update('a').digest('hex'), 's'), true);
});

test('ilk mesaj (0850 = DepoEvim): DepoEvim Asistanı tanıtımı + yalnızca DepoEvim linki, konuşma ve mesajlar kaydedilir', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  const res = await gonder(o, olay({ contacts: [{ wa_id: WA, profile: { name: 'Ayşe' } }], messages: [mesaj('w1', 'Merhaba, taşınacağım')] }));
  assert.equal(res.kod, 200);
  assert.equal(o.gonderilen.length, 1);
  assert.equal(o.gonderilen[0].to, WA);
  // Hat tek markalı: marka sorusu / nötr tanıtım yok
  assert.match(o.gonderilen[0].text.body, /^Merhaba, ben DepoEvim Asistanı, DepoEvim'in dijital asistanıyım/);
  assert.doesNotMatch(o.gonderilen[0].text.body, /SEMBO Asistan|sembolevdeneve/);
  assert.match(o.gonderilen[0].text.body, /depoevim\.com\/aydinlatma-metni\//);
  assert.match(o.gonderilen[0].text.body, /Hangi depo boyutunu/);
  assert.match(o.gonderilen[0]._url, /\/111\/messages$/);
  assert.match(o.aiCagrilari[0].sistem, /MARKA: DepoEvim/);
  assert.doesNotMatch(o.aiCagrilari[0].sistem, /MARKA HENÜZ BELLİ DEĞİL/);
  const k = konusma(o.db);
  assert.equal(k.profileName, 'Ayşe'); assert.equal(k.phone, '0532 123 45 67'); assert.equal(k.mode, 'bot');
  assert.equal(k.marka, 'depoevim'); assert.equal(k.hatId, '111'); assert.deepEqual(k.botGunluk, { gun: '2026-10-06', sayi: 1 });
  assert.equal(k.kvkkVerildi, true); assert.equal(k.botKilit, null); assert.equal(k.unreadCount, 1);
  assert.deepEqual(Object.keys(k.kvkkGonderilen), ['depoevim']);
  const m = mesajlar(o.db);
  assert.deepEqual(m.map(x => x.from).sort(), ['bot', 'customer']);
  // İkinci mesajda KVKK tekrar edilmez
  await gonder(o, olay({ messages: [mesaj('w2', '2+1')] }));
  assert.doesNotMatch(o.gonderilen[1].text.body, /aydinlatma/);
});

test('tekrar koruması: aynı wamid ikinci kez gelirse bot ikinci kez cevap vermez', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  const p = olay({ messages: [mesaj('wDUP', 'merhaba')] });
  await gonder(o, p);
  await gonder(o, p);
  assert.equal(o.aiCagrilari.length, 1);
  assert.equal(o.gonderilen.length, 1);
  assert.equal(konusma(o.db).unreadCount, 1);
});

test('peş peşe mesaj: yalnızca SON mesaj cevaplanır, yapay zeka hepsini birlikte görür', async () => {
  let birinciBekliyor;
  const ilkBekle = new Promise(r => { birinciBekliyor = r; });
  let sayac = 0;
  const bekle = async () => { sayac++; if (sayac === 1) await ilkBekle; };
  const o = ortam({ aiCevaplari: [tamam()], bekle });
  const res1 = sahteYanit();
  await o.handler(istek(olay({ messages: [mesaj('wA', 'Merhaba')] })), res1);   // 1. mesaj beklemede
  const res2 = sahteYanit();
  await o.handler(istek(olay({ messages: [{ ...mesaj('wB', 'Kadıköy\'den Ankara\'ya'), timestamp: '1791273601' }] })), res2);
  birinciBekliyor();
  await o.bitir();
  assert.equal(o.aiCagrilari.length, 1);
  assert.equal(o.gonderilen.length, 1);
  assert.deepEqual(o.aiCagrilari[0].gecmis.map(g => g.metin), ['Merhaba', 'Kadıköy\'den Ankara\'ya']);
});

test('ref kodu: ref yapay zekaya gitmez, DepoEvim tıklama kaydı lead\'e dönüşür (reklam kaynağı korunur)', async () => {
  const db = sahteDb();
  await db.collection('artifacts').doc('test-app').collection('public').doc('data').collection('havuzKayitlari').doc('ref_DE-ABC12')
    .set({ sadeceTiklama: true, musteriAdi: 'Google Ads Ziyaretçisi', reklamKaynagi: 'google_ads', durum: 'Yeni', kanal: 'whatsapp', hareketler: [{ islem: 'tık' }] });
  const o = ortam({ db, aiCevaplari: [tamam({ collected: { depoBoyutu: '15', sube: 'kartal' }, marka: 'sembol' })] });
  await gonder(o, olay({ contacts: [{ wa_id: WA, profile: { name: 'Mehmet' } }], messages: [mesaj('w1', 'Merhaba fiyat almak istiyorum (Ref: DE-ABC12)')] }));
  assert.equal(o.aiCagrilari[0].gecmis[0].metin, 'Merhaba fiyat almak istiyorum');
  assert.match(o.aiCagrilari[0].sistem, /MARKA: DepoEvim/);
  const lead = db.havuz('ref_DE-ABC12');
  assert.equal(lead.reklamKaynagi, 'google_ads');
  assert.equal(lead.kayitTipi, 'whatsapp-bot');
  assert.equal(lead.sadeceTiklama, false);
  assert.equal(lead.musteriAdi, 'Mehmet');
  assert.equal(lead.iletisim, '0532 123 45 67');
  // yapay zekanın "sembol" markası yok sayıldı: hat DepoEvim
  assert.equal(lead.hesapId, 'depoevim'); assert.equal(lead.hizmetTipi, 'Depo');
  assert.equal(lead.kvkkAydinlatmaKanal, 'whatsapp'); assert.deepEqual(lead.kvkkAydinlatmaMarka, ['depoevim']);
  assert.equal(lead.whatsapp.konusmaId, WA); assert.equal(lead.whatsapp.hatId, '111');
  assert.equal(konusma(db).leadId, 'ref_DE-ABC12');
});

test('Sembol hattı (gelecek) fiyat: alanlar tamamlanınca sistem fiyatıyla ikinci tur; uydurma rakam sabit metne çevrilir; lead fiyatı yazılır', async () => {
  const fiyat = ({ alanlar }) => (alanlar.paketleme ? { durum: 'tamam', marka: 'sembol', min: 51100, max: 64000 } : { durum: 'eksik', eksik: ['paketleme'] });
  const o = ortam({ fiyat, env: ENV_SEMBOL, aiCevaplari: [
    tamam({ marka: 'sembol', collected: { homeSize: '2+1', paketleme: 'firma' }, reply: 'Hesaplıyorum' }),
    tamam({ marka: 'sembol', reply: 'Tahmini fiyat 45.000 TL olur.' }), // uydurma rakam
  ] });
  await gonder(o, olay({ messages: [mesaj('w1', 'paketlemeyi siz yapın')] }));
  assert.equal(o.aiCagrilari.length, 2);
  assert.match(o.aiCagrilari[1].sistem, /51\.100 TL – 64\.000 TL/);
  assert.match(o.gonderilen[0].text.body, /tahmini fiyat aralığı: 51\.100 TL – 64\.000 TL/);
  assert.doesNotMatch(o.gonderilen[0].text.body, /45\.000/);
  const k = konusma(o.db);
  assert.equal(o.db.havuz(k.leadId).fiyatTahminiMin, 51100);
  assert.equal(o.db.havuz(k.leadId).wizardDurumu, 'completed');
});

test('temsilci isteği: mode human olur, sonraki mesajlarda bot susar; lead\'e hareket yazılır', async () => {
  SAAT = Date.parse('2026-10-06T08:00:00Z');
  const o = ortam({ aiCevaplari: [tamam({ reply: 'Sizi ekibimize aktarıyorum.', handoff: true, handoffType: 'temsilci', handoffReason: 'Temsilci istedi', collected: { fullName: 'Ali Veli' } })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'temsilciyle görüşmek istiyorum')] }));
  const k = konusma(o.db);
  assert.equal(k.mode, 'human'); assert.equal(k.needsAgent, true); assert.equal(k.handoffReason, 'Temsilci istedi'); assert.equal(k.devirTuru, 'temsilci');
  assert.match(o.db.havuz(k.leadId).hareketler.at(-1).islem, /devretti: Temsilci istedi/);
  await gonder(o, olay({ messages: [mesaj('w2', 'alo?')] }));
  assert.equal(o.aiCagrilari.length, 1);
  assert.equal(o.gonderilen.length, 1);
  assert.equal(konusma(o.db).unreadCount, 2);
});

// ---------------------------------------------------------------- YAPAY ZEKA HATASI (2026-10-07: kilitlemez)
const hataAi = (tur = 'gecici', durum = 429) => ({ ok: false, tur, durum, hata: `Gemini HTTP ${durum}` });
const kok = (db) => db.collection('artifacts').doc('test-app').collection('public').doc('data');
const konusmaKur = (db, veri) => kok(db).collection('whatsapp_conversations').doc(WA).set(veri);
const mesajKur = (db, id, veri) => kok(db).collection('whatsapp_conversations').doc(WA).collection('messages').doc(id).set(veri);
const yedekDeseni = new RegExp(YEDEK_MESAJ.replace('.', '\\.'));

test('yapay zeka hatası: sabit mesaj gider, konuşma bot modunda kalır, sonraki mesajda bot cevap verir', async () => {
  SAAT = Date.parse('2026-10-06T08:00:00Z');
  const o = ortam({ aiCevaplari: [hataAi('yapilandirma', 402), tamam({ reply: 'Kaç oda?' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'merhaba')] }));
  assert.match(o.gonderilen[0].text.body, yedekDeseni);
  let k = konusma(o.db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, false);
  assert.equal(k.botHatasi.tur, 'yapilandirma');
  assert.equal(o.db.belge('whatsapp_durum/ai').aktif, true);   // yöneticiye uyarı (kredi bitti)
  SAAT += 60000;
  await gonder(o, olay({ messages: [mesaj('w2', 'fiyat alabilir miyim')] }));
  assert.equal(o.gonderilen.length, 2);
  assert.equal(o.gonderilen[1].text.body, 'Kaç oda?');
  k = konusma(o.db);
  assert.equal(k.botHatasi, null);
  assert.equal(o.db.belge('whatsapp_durum/ai').aktif, false);
});

test('yapay zeka art arda hata: sabit mesaj 30 dakikada bir kez, her mesajda yeniden denenir', async () => {
  SAAT = Date.parse('2026-10-06T08:00:00Z');
  const o = ortam({ aiCevaplari: [hataAi()] });
  await gonder(o, olay({ messages: [mesaj('w1', 'merhaba')] }));
  SAAT += 10 * 60000;
  await gonder(o, olay({ messages: [mesaj('w2', 'orada mısınız')] }));
  assert.equal(o.gonderilen.length, 1);                      // 10. dakikada sessiz
  assert.equal(konusma(o.db).botHatasi.tur, 'gecici');
  SAAT += 25 * 60000;
  await gonder(o, olay({ messages: [mesaj('w3', 'alo')] }));
  assert.equal(o.gonderilen.length, 2);                      // 35. dakikada tekrar
  assert.equal(o.aiCagrilari.length, 3);
  assert.equal(konusma(o.db).mode, 'bot');
});

test('eski kilit: "Yapay zeka hatası" ile devredilmiş, personel yazmamış konuşma yeni mesajda bota döner', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const db = sahteDb();
  const devir = '2026-10-06T19:00:00.000Z';
  // Eski kodun (2026-10-06, 755062e) yazdığı alanların birebir aynısı
  await konusmaKur(db, { waId: WA, mode: 'human', needsAgent: true, handoffReason: 'Yapay zeka hatası', handoffAt: devir,
    kvkkVerildi: true, kvkkAydinlatmaTarihi: devir, leadId: 'L1', collected: {}, unreadCount: 1, lastCustomerWamid: 'eski1' });
  await mesajKur(db, 'eski1', { direction: 'in', from: 'customer', type: 'text', text: 'merhaba', timestamp: '2026-10-06T18:59:50.000Z' });
  await mesajKur(db, 'wamid.eskibot', { direction: 'out', from: 'bot', agentName: 'SEMBO Asistan', type: 'text', text: YEDEK_MESAJ, timestamp: devir, status: 'sent', aiHata: 'Gemini HTTP 402: prepayment credits are depleted' });
  await kok(db).collection('havuzKayitlari').doc('L1').set({ durum: 'Yeni', hareketler: [{ islem: 'Bot görüşmeyi personele devretti: Yapay zeka hatası' }] });
  const o = ortam({ db, aiCevaplari: [tamam({ reply: 'Kaç odalı bir ev?' })] });
  await gonder(o, olay({ messages: [mesaj('wYeni', 'evden eve fiyat istiyorum')] }));
  assert.equal(o.aiCagrilari.length, 1);
  // eski KVKK yalnızca Sembol linkiydi → hat DepoEvim olduğu için DepoEvim linki BİR KEZ eklenir
  assert.equal(o.gonderilen[0].text.body, 'Bilgilendirme: DepoEvim olarak paylaştığınız bilgiler KVKK kapsamında işlenir: https://www.depoevim.com/aydinlatma-metni/\n\nKaç odalı bir ev?');
  const k = konusma(db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, false); assert.equal(k.handoffReason, '');
  assert.ok(k.aiKilidiAcildi);
  assert.match(db.havuz('L1').hareketler.at(-1).islem, /Bot görüşmeye geri döndü/);
});

test('eski kilit: sebep boş ama devirdeki bot mesajında aiHata varsa da açılır', async () => {
  const db = sahteDb();
  const devir = '2026-10-06T19:00:00.000Z';
  await konusmaKur(db, { waId: WA, mode: 'human', needsAgent: true, handoffAt: devir, kvkkVerildi: true, collected: {} });
  await mesajKur(db, 'wamid.b', { from: 'bot', text: YEDEK_MESAJ, timestamp: devir, aiHata: 'Gemini HTTP 404' });
  const o = ortam({ db, aiCevaplari: [tamam()] });
  await gonder(o, olay({ messages: [mesaj('w1', 'merhaba')] }));
  assert.equal(konusma(db).mode, 'bot');
  assert.equal(o.gonderilen.length, 1);
});

test('gerçek devretme ve personelin cevap yazdığı konuşma AÇILMAZ', async () => {
  const devir = '2026-10-06T19:00:00.000Z';
  const db1 = sahteDb();
  await konusmaKur(db1, { waId: WA, mode: 'human', needsAgent: true, handoffReason: 'Temsilci istedi', handoffAt: devir, kvkkVerildi: true });
  const o1 = ortam({ db: db1, aiCevaplari: [tamam()] });
  await gonder(o1, olay({ messages: [mesaj('w1', 'merhaba')] }));
  assert.equal(konusma(db1).mode, 'human'); assert.equal(o1.aiCagrilari.length, 0);
  const db2 = sahteDb();
  await konusmaKur(db2, { waId: WA, mode: 'human', needsAgent: true, handoffReason: 'Yapay zeka hatası', handoffAt: devir, kvkkVerildi: true });
  await mesajKur(db2, 'wamid.p', { from: 'agent', agentName: 'Ayşe', text: 'Merhaba, ben Ayşe', timestamp: '2026-10-06T19:30:00.000Z' });
  const o2 = ortam({ db: db2, aiCevaplari: [tamam()] });
  await gonder(o2, olay({ messages: [mesaj('w1', 'tamam')] }));
  assert.equal(konusma(db2).mode, 'human'); assert.equal(o2.aiCagrilari.length, 0);
});

// ---------------------------------------------------------------- MARKA / KVKK (2026-10-07)
test('ref ile DepoEvim belli: DepoEvim Asistanı tanıtımı + yalnızca DepoEvim linki', async () => {
  const o = ortam({ aiCevaplari: [tamam({ marka: 'depoevim', intent: 'depolama', reply: 'Hangi depo boyutunu düşünüyorsunuz?' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'Depo fiyatı (Ref: DE-AB12C)')] }));
  const b = o.gonderilen[0].text.body;
  assert.match(b, /^Merhaba, ben DepoEvim Asistanı, DepoEvim'in dijital asistanıyım/);
  assert.match(b, /https:\/\/www\.depoevim\.com\/aydinlatma-metni\//);
  assert.doesNotMatch(b, /sembolevdeneve/);
  assert.match(o.aiCagrilari[0].sistem, /SEN: "DepoEvim Asistanı"/);
  assert.deepEqual(Object.keys(konusma(o.db).kvkkGonderilen), ['depoevim']);
  assert.equal(mesajlar(o.db).find(m => m.from === 'bot').agentName, 'DepoEvim Asistanı');
});

test('token hatası (190): mesaj failed, whatsapp_durum/token uyarısı; sesli mesaj işlenir', async () => {
  const o = ortam({ aiCevaplari: [tamam({ reply: 'Sesli mesajları dinleyemiyorum, yazabilir misiniz?' })], metaHata: { message: 'Error validating access token', type: 'OAuthException', code: 190 } });
  await gonder(o, olay({ messages: [{ from: WA, id: 'w1', timestamp: '1791273600', type: 'audio', audio: { id: 'MEDIA1' } }] }));
  assert.equal(o.aiCagrilari[0].gecmis[0].metin, '[sesli mesaj]');
  const uyari = o.db.belge('whatsapp_durum/token');
  assert.equal(uyari.aktif, true); assert.equal(uyari.tur, 'token');
  assert.equal(uyari.mesaj, 'WhatsApp token geçersiz, mesajlar gönderilemiyor');
  const gelen = mesajlar(o.db).find(m => m.from === 'customer');
  assert.equal(gelen.mediaId, 'MEDIA1');
  assert.equal(mesajlar(o.db).find(m => m.from === 'bot').status, 'failed');
});

test('statuses: sent → read ilerler, geri gitmez; failed kaydedilir', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  await gonder(o, olay({ messages: [mesaj('w1', 'merhaba')] }));
  const st = (status, ek = {}) => olay({ statuses: [{ id: 'wamid.out1', recipient_id: WA, status, timestamp: '1791273700', ...ek }] });
  await gonder(o, st('read'));
  await gonder(o, st('delivered'));
  const bot = () => mesajlar(o.db).find(m => m.from === 'bot');
  assert.equal(bot().status, 'read');
  await gonder(o, st('failed', { errors: [{ code: 131047, title: 'Re-engagement message' }] }));
  assert.equal(bot().status, 'failed');
  assert.equal(bot().hata.kod, 131047);
  // bilinmeyen mesajın durumu yeni belge açmaz
  await gonder(o, olay({ statuses: [{ id: 'baska', recipient_id: WA, status: 'read' }] }));
  assert.equal(mesajlar(o.db).length, 2);
});

test('bilinmeyen hattın olayı işlenmez; WHATSAPP_BOT_KAPALI=1 iken yalnızca kaydedilir', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  const p = olay({ messages: [mesaj('w1', 'merhaba')] });
  p.entry[0].changes[0].value.metadata.phone_number_id = '999';
  await gonder(o, p);
  assert.equal(mesajlar(o.db).length, 0);
  const o2 = ortam({ aiCevaplari: [tamam()], env: { WHATSAPP_BOT_KAPALI: '1' } });
  await gonder(o2, olay({ messages: [mesaj('w1', 'merhaba')] }));
  assert.equal(mesajlar(o2.db).length, 1);
  assert.equal(o2.aiCagrilari.length, 0);
});

// ================================================================ 2026-10-07 FAZ 1: hat yapısı, bildir/sustur, sınır, loglar
// console.log'u yakalar (atlandı satırları) — testten sonra geri yüklenir
async function loglariYakala(fn) {
  const satirlar = [];
  const eski = console.log;
  console.log = (...a) => { satirlar.push(a.join(' ')); };
  try { await fn(); } finally { console.log = eski; }
  return satirlar;
}
const leadHareketleri = (db, id) => (db.havuz(id)?.hareketler || []).map(h => h.islem);

test('devirTuruBul: tür verilmişse o; yoksa sebepten — yalnızca temsilci / şikayet botu susturur', () => {
  assert.equal(devirTuruBul('bildir', 'Müşteri temsilci istedi'), 'bildir');
  assert.equal(devirTuruBul('', 'Müşteri temsilciyle görüşmek istiyor'), 'temsilci');
  assert.equal(devirTuruBul('', 'Hasar şikayeti'), 'sikayet');
  assert.equal(devirTuruBul('', 'Ekspertiz randevusu oluşturuldu'), 'bildir');
  assert.equal(devirTuruBul('', 'Otomatik fiyatı olmayan hizmet'), 'bildir');
  assert.equal(devirTuruBul('', ''), 'bildir');
});

test('ekspertiz sonrası: personel bilgilendirilir ama bot devam eder; sonraki soruya cevap verir, bilgileri baştan sormaz', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const o = ortam({ aiCevaplari: [
    tamam({ reply: 'Ücretsiz ekspertiz talebinizi ekibimize ilettim.', handoff: true, handoffType: 'bildir', handoffReason: 'Ekspertiz randevusu talebi', collected: { depoBoyutu: '15', fullName: 'Ayşe Kaya' } }),
    tamam({ reply: 'Depolarımız 7/24 kamerayla izlenir.' }),
    // tür vermeden yine devir — aynı bildirim tekrar yazılmaz
    tamam({ reply: 'Ekibimiz mesai saatinde dönüş yapacak.', handoff: true, handoffReason: 'Randevu bekliyor' }),
  ] });
  await gonder(o, olay({ messages: [mesaj('w1', 'ekspertiz istiyorum')] }));
  let k = konusma(o.db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, true); assert.equal(k.devirTuru, 'bildir');
  assert.equal(k.handoffReason, 'Ekspertiz randevusu talebi');
  assert.equal(k.handoffAt, undefined);
  assert.match(leadHareketleri(o.db, k.leadId).at(-1), /Bot personeli bilgilendirdi \(bot devam ediyor\): Ekspertiz randevusu talebi/);
  assert.equal(o.db.havuz(k.leadId).whatsappDevir.tur, 'bildir');

  SAAT += 60000;
  await gonder(o, olay({ messages: [mesaj('w2', 'depolarınız güvenli mi?')] }));
  assert.equal(o.gonderilen.length, 2);
  assert.equal(o.gonderilen[1].text.body, 'Depolarımız 7/24 kamerayla izlenir.');
  assert.match(o.aiCagrilari[1].sistem, /EKİP BİLGİLENDİRİLDİ \(Ekspertiz randevusu talebi\)/);
  assert.match(o.aiCagrilari[1].sistem, /TOPLANAN bilgileri baştan sorma, fiyat uydurma, kesin tarih\/saat verme/);
  assert.match(o.aiCagrilari[1].sistem, /"depoBoyutu":"15"/);

  SAAT += 60000;
  await gonder(o, olay({ messages: [mesaj('w3', 'ne zaman ararsınız')] }));
  k = konusma(o.db);
  assert.equal(k.mode, 'bot');
  assert.equal(leadHareketleri(o.db, k.leadId).filter(h => /bilgilendirdi/.test(h)).length, 1);
});

test('sunucu devirleri (fiyat yok) "bildir" türündedir: bot susmaz', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const o = ortam({ fiyat: { durum: 'hata' }, aiCevaplari: [tamam({ reply: 'Fiyat için birkaç bilgi alayım.', collected: { depoBoyutu: '30' } }), tamam({ reply: 'Başka sorunuz var mı?' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'depo fiyatı ne kadar')] }));
  let k = konusma(o.db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, true); assert.equal(k.handoffReason, 'Fiyat hesaplanamadı');
  await gonder(o, olay({ messages: [mesaj('w2', 'teşekkürler')] }));
  assert.equal(o.gonderilen.length, 2);
});

test('temsilci isteği → sessiz mod: personel yazmadıysa en fazla 3 saatte bir bilgi mesajı, yapay zeka çağrılmaz', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const o = ortam({ aiCevaplari: [tamam({ reply: 'Sizi ekibimize aktarıyorum.', handoff: true, handoffType: 'temsilci', handoffReason: 'Temsilci istedi' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'bir yetkiliyle görüşmek istiyorum')] }));
  assert.equal(konusma(o.db).mode, 'human');
  SAAT += 10 * 60000;                                   // 10 dk: devir mesajı yeni gitti → sessiz
  await gonder(o, olay({ messages: [mesaj('w2', 'alo')] }));
  assert.equal(o.gonderilen.length, 1);
  SAAT += 3 * 3600000;                                  // 3 saat 10 dk → bilgi mesajı
  await gonder(o, olay({ messages: [mesaj('w3', 'kimse yok mu')] }));
  assert.equal(o.gonderilen.length, 2);
  assert.equal(o.gonderilen[1].text.body, SESSIZ_BILGI_MESAJI);
  assert.equal(mesajlar(o.db).find(m => m.otomatik === 'sessiz_bilgi').from, 'bot');
  SAAT += 3600000;                                      // +1 saat → sessiz
  await gonder(o, olay({ messages: [mesaj('w4', '?')] }));
  assert.equal(o.gonderilen.length, 2);
  SAAT += 2 * 3600000;                                  // son bilgiden 3 saat sonra → yine
  await gonder(o, olay({ messages: [mesaj('w5', 'hala bekliyorum')] }));
  assert.equal(o.gonderilen.length, 3);
  assert.equal(o.aiCagrilari.length, 1);
  assert.equal(konusma(o.db).mode, 'human');
});

test('sessiz modda personel yazdıysa otomatik bilgi mesajı gitmez', async () => {
  SAAT = Date.parse('2026-10-07T12:00:00Z');
  const db = sahteDb();
  const devir = '2026-10-07T08:00:00.000Z';
  await konusmaKur(db, { waId: WA, mode: 'human', needsAgent: true, handoffReason: 'Temsilci istedi', devirTuru: 'temsilci', handoffAt: devir, kvkkGonderilen: { depoevim: devir } });
  await mesajKur(db, 'wamid.p', { from: 'agent', agentName: 'Ayşe', text: 'Merhaba, ben Ayşe', timestamp: '2026-10-07T08:30:00.000Z' });
  const o = ortam({ db, aiCevaplari: [tamam()] });
  const log = await loglariYakala(() => gonder(o, olay({ messages: [mesaj('w1', 'tamam, bekliyorum')] })));
  assert.equal(o.gonderilen.length, 0);
  assert.equal(o.aiCagrilari.length, 0);
  assert.ok(log.some(s => s === '[whatsapp] atlandı 9053****4567 human mode (personel yazıyor)'));
});

test('24 saat: son personel mesajından (yoksa devirden) 24 saat geçince müşterinin yeni mesajında bota döner, needsAgent korunur', async () => {
  // a) personel hiç yazmadı — devirden 25 saat sonra
  SAAT = Date.parse('2026-10-08T09:00:00Z');
  const db = sahteDb();
  await konusmaKur(db, { waId: WA, mode: 'human', needsAgent: true, handoffReason: 'Temsilci istedi', devirTuru: 'temsilci', handoffAt: '2026-10-07T08:00:00.000Z',
    leadId: 'L1', kvkkGonderilen: { depoevim: '2026-10-07T07:00:00.000Z' } });
  await kok(db).collection('havuzKayitlari').doc('L1').set({ durum: 'Yeni', hareketler: [] });
  const o = ortam({ db, aiCevaplari: [tamam({ reply: 'Size nasıl yardımcı olabilirim?' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'merhaba tekrar')] }));
  let k = konusma(db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, true);
  assert.equal(k.botaDonus.sebep, '24 saat');
  assert.equal(o.gonderilen[0].text.body, 'Size nasıl yardımcı olabilirim?');
  assert.match(leadHareketleri(db, 'L1').at(-1), /devirden bu yana 24 saat geçti/);

  // b) devir 30 saat önce ama personel 23 saat önce yazdı → hâlâ sessiz (personel yazdığı için bilgi mesajı da yok)
  const db2 = sahteDb();
  await konusmaKur(db2, { waId: WA, mode: 'human', needsAgent: true, devirTuru: 'temsilci', handoffAt: '2026-10-07T03:00:00.000Z', kvkkGonderilen: { depoevim: 'x' } });
  await mesajKur(db2, 'wamid.p', { from: 'agent', text: 'Yarın arayacağız', timestamp: '2026-10-07T10:00:00.000Z' });
  const o2 = ortam({ db: db2, aiCevaplari: [tamam()] });
  await gonder(o2, olay({ messages: [mesaj('w1', 'tamam')] }));
  assert.equal(konusma(db2).mode, 'human'); assert.equal(o2.gonderilen.length, 0);
  // c) aynı konuşma, personel mesajından 24 saat sonra → bota döner
  SAAT = Date.parse('2026-10-08T10:30:00Z');
  await gonder(o2, olay({ messages: [mesaj('w2', 'aramadınız')] }));
  k = konusma(db2);
  assert.equal(k.mode, 'bot'); assert.equal(o2.aiCagrilari.length, 1);
});

test('günlük sınır: konuşma başına günde 30 bot cevabı; dolunca bir kez sabit mesaj + needsAgent, o gün yapay zeka çağrılmaz; ertesi gün sıfırlanır', async () => {
  SAAT = Date.parse('2026-10-07T06:00:00Z');   // İstanbul 09:00
  const o = ortam({ aiCevaplari: [tamam({ reply: 'Cevap' })] });
  for (let i = 1; i <= 30; i++) { SAAT += 60000; await gonder(o, olay({ messages: [mesaj(`w${i}`, `soru ${i}`)] })); }
  assert.equal(o.aiCagrilari.length, 30);
  assert.deepEqual(konusma(o.db).botGunluk, { gun: '2026-10-07', sayi: 30 });
  SAAT += 60000;
  await gonder(o, olay({ messages: [mesaj('w31', 'soru 31')] }));
  assert.equal(o.aiCagrilari.length, 30);
  assert.equal(o.gonderilen.at(-1).text.body, SINIR_MESAJI);
  const k = konusma(o.db);
  assert.equal(k.needsAgent, true); assert.equal(k.mode, 'bot'); assert.match(k.handoffReason, /Günlük bot cevabı sınırı/);
  const log = await loglariYakala(async () => { SAAT += 60000; await gonder(o, olay({ messages: [mesaj('w32', 'soru 32')] })); });
  assert.equal(o.gonderilen.length, 31);                  // ikinci kez sabit mesaj yok
  assert.equal(o.aiCagrilari.length, 30);
  assert.ok(log.includes('[whatsapp] atlandı 9053****4567 günlük sınır'));
  // Türkiye saatiyle ertesi gün (UTC 21:30 = İstanbul 00:30)
  SAAT = Date.parse('2026-10-07T21:30:00Z');
  await gonder(o, olay({ messages: [mesaj('w33', 'günaydın')] }));
  assert.equal(o.aiCagrilari.length, 31);
  assert.deepEqual(konusma(o.db).botGunluk, { gun: '2026-10-08', sayi: 1 });
});

test('DepoEvim hattında evden eve talebi: fiyat verilmez, Sembol ekibi için "evden eve" lead\'i (SB ref bağlanır), ekip bilgilendirilir, bot devam eder', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const db = sahteDb();
  await kok(db).collection('havuzKayitlari').doc('ref_SB-XYZ99')
    .set({ sadeceTiklama: true, musteriAdi: 'Ziyaretçi', reklamKaynagi: 'google_ads', durum: 'Yeni', kanal: 'whatsapp', hareketler: [] });
  let fiyatCagrisi = 0; const fiyatMarkalari = [];
  const tam = { homeSize: '2+1', fromCity: 'İstanbul', fromDistrict: 'Kadıköy', toCity: 'Ankara', toDistrict: 'Çankaya', fullName: 'Can Demir' };
  const o = ortam({ db, fiyat: (a) => { fiyatCagrisi++; fiyatMarkalari.push(a.marka); return { durum: 'tamam', marka: 'sembol', min: 50000, max: 60000 }; }, aiCevaplari: [
    tamam({ intent: 'evden_eve', reply: 'Kaç odalı bir ev taşınacak?' }),
    tamam({ intent: 'evden_eve', collected: tam, reply: 'Tahmini 45.000 TL tutar.' }),    // uydurma rakam → engellenir
    tamam({ intent: 'evden_eve', reply: 'Taşıma ekibimiz size dönüş yapacak, başka sorunuz var mı?' }),
  ] });
  await gonder(o, olay({ messages: [mesaj('w1', 'Evden eve taşınacağım (Ref: SB-XYZ99)')] }));
  assert.match(o.aiCagrilari[0].sistem, /TAŞIMA TALEBİ/);
  // ilk cevap: DepoEvim tanıtımı + (taşıma anlaşıldı) Sembol aydınlatması BİR KEZ + cevap
  assert.match(o.gonderilen[0].text.body, /^Merhaba, ben DepoEvim Asistanı/);
  assert.ok(o.gonderilen[0].text.body.includes(`\n\n${SEMBOL_TASIMA_KVKK}\n\nKaç odalı bir ev taşınacak?`));
  assert.deepEqual(Object.keys(konusma(db).kvkkGonderilen).sort(), ['depoevim', 'sembol']);
  fiyatCagrisi = 0;                       // niyet belli olduktan sonra hiç fiyat hesaplanmaz
  SAAT += 60000;
  await gonder(o, olay({ messages: [mesaj('w2', '2+1 Kadıköy\'den Ankara Çankaya\'ya, adım Can Demir')] }));
  assert.equal(fiyatCagrisi, 0);
  assert.ok(!fiyatMarkalari.includes('sembol'));
  assert.match(o.aiCagrilari[1].sistem, /SİSTEM FİYATI: yok — taşıma talebinde fiyat VERİLMEZ/);
  assert.doesNotMatch(o.gonderilen[1].text.body, /45\.000|50\.000/);
  assert.match(o.gonderilen[1].text.body, /Fiyatı taşıma ekibimiz size iletecek/);
  let k = konusma(db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, true); assert.equal(k.marka, 'depoevim');
  assert.equal(k.tasimaLeadId, 'ref_SB-XYZ99'); assert.equal(k.leadId ?? null, null);
  assert.ok(k.tasimaBildirildi);
  const lead = db.havuz('ref_SB-XYZ99');
  assert.equal(lead.hesapId, 'sembolevdeneve'); assert.equal(lead.hizmetTipi, 'Nakliye');
  assert.equal(lead.reklamKaynagi, 'google_ads'); assert.equal(lead.fiyatTahminiMin, null);
  assert.match(lead.sonMesaj, /Tip: 2\+1/);
  assert.deepEqual(lead.kvkkAydinlatmaMarka, ['depoevim', 'sembol']);
  assert.match(lead.hareketler.at(-1).islem, /taşıma ekibine iletildi/);
  SAAT += 60000;
  await gonder(o, olay({ messages: [mesaj('w3', 'teşekkürler, sigortalı mı?')] }));
  assert.equal(o.gonderilen.length, 3);
  assert.ok(o.gonderilen.slice(1).every(m => !m.text.body.includes('sembolevdeneve.com/aydinlatma')));   // tekrar edilmez
  assert.equal(konusma(db).mode, 'bot');
  assert.equal(db.havuz('ref_SB-XYZ99').hareketler.filter(h => /bilgilendirdi/.test(h.islem)).length, 1);
});

test('hat ayrımı: aynı müşteri iki hatta yazarsa iki ayrı konuşma; her hat kendi numarası, token\'ı ve markasıyla cevap verir', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const o = ortam({ env: { WHATSAPP_HATLAR: HATLAR_IKI, WHATSAPP_TOKEN_SEMBOL: 'ts' }, aiCevaplari: [tamam({ reply: 'Nasıl yardımcı olabilirim?' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'merhaba')] }, '111'));
  await gonder(o, olay({ messages: [mesaj('w2', 'merhaba')] }, '222'));
  assert.match(o.gonderilen[0]._url, /\/111\/messages$/); assert.equal(o.gonderilen[0]._yetki, 'Bearer t');
  assert.match(o.gonderilen[0].text.body, /DepoEvim Asistanı/);
  assert.match(o.gonderilen[1]._url, /\/222\/messages$/); assert.equal(o.gonderilen[1]._yetki, 'Bearer ts');
  assert.match(o.gonderilen[1].text.body, /^Merhaba, ben SEMBO Asistan/);
  assert.doesNotMatch(o.gonderilen[1].text.body, /depoevim\.com/);
  assert.equal(konusma(o.db).marka, 'depoevim');
  const k2 = o.db.belge(`whatsapp_conversations/222_${WA}`);
  assert.equal(k2.marka, 'sembol'); assert.equal(k2.hatId, '222'); assert.equal(k2.unreadCount, 1);
  // durum (statuses) doğru konuşmaya yazılır
  await gonder(o, olay({ statuses: [{ id: 'wamid.out2', recipient_id: WA, status: 'read', timestamp: '1791273700' }] }, '222'));
  assert.equal(o.db.belge(`whatsapp_conversations/222_${WA}/messages/wamid.out2`).status, 'read');
});

test('bilinmeyen hat: mesaj kaydedilmez, maskeli tek satır loglanır', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  const log = await loglariYakala(() => gonder(o, olay({ messages: [mesaj('w1', 'merhaba')] }, '987654321')));
  assert.equal(mesajlar(o.db).length, 0);
  assert.equal(o.aiCagrilari.length, 0);
  assert.ok(log.includes('[whatsapp] atlandı 9053****4567 bilinmeyen hat (9876****4321)'));
  assert.ok(!log.some(s => s.includes(WA)));
});

test('eski konuşma (8761 benzeri): ekspertiz "Oluştur" sonrası human\'a düşmüş, personel yazmamış → yeni mesajda bota döner, needsAgent kalır', async () => {
  SAAT = Date.parse('2026-10-07T09:00:00Z');
  const db = sahteDb();
  const devir = '2026-10-07T08:30:00.000Z';
  // Eski kod (8c28f09) alanları: devirTuru YOK, serbest metin sebep
  await konusmaKur(db, { waId: WA, mode: 'human', needsAgent: true, handoffReason: 'Müşteri ücretsiz ekspertiz randevusu oluşturmak istiyor', handoffAt: devir,
    kvkkGonderilen: { depoevim: devir }, leadId: 'L8761', collected: { depoBoyutu: '22' }, marka: 'depoevim' });
  await mesajKur(db, 'wamid.b', { from: 'bot', text: 'Talebinizi ekibimize ilettim.', timestamp: devir });
  await kok(db).collection('havuzKayitlari').doc('L8761').set({ durum: 'Yeni', hareketler: [{ islem: 'Bot görüşmeyi personele devretti: ...' }] });
  const o = ortam({ db, aiCevaplari: [tamam({ reply: 'Ekspertiz için ekibimiz sizi arayacak. Başka sorunuz var mı?' })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'ekspertiz ne kadar sürer?')] }));
  const k = konusma(db);
  assert.equal(k.mode, 'bot'); assert.equal(k.needsAgent, true); assert.equal(k.devirTuru, 'bildir');
  assert.equal(o.aiCagrilari.length, 1);
  assert.match(o.aiCagrilari[0].sistem, /EKİP BİLGİLENDİRİLDİ/);
  assert.match(leadHareketleri(db, 'L8761').at(-1), /Bot görüşmeye geri döndü \(önceki devir bildirim türündeydi/);
  // Sebep boş olan eski devir ihtiyaten açılmaz (24 saat kuralı açar)
  const db2 = sahteDb();
  await konusmaKur(db2, { waId: WA, mode: 'human', needsAgent: true, handoffReason: '', handoffAt: devir, kvkkGonderilen: { depoevim: devir } });
  const o2 = ortam({ db: db2, aiCevaplari: [tamam()] });
  await gonder(o2, olay({ messages: [mesaj('w1', 'merhaba')] }));
  assert.equal(konusma(db2).mode, 'human'); assert.equal(o2.aiCagrilari.length, 0);
});

test('loglar: erken çıkışlar maskeli tek satır (tekrar, human mode)', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const o = ortam({ aiCevaplari: [tamam({ reply: 'Aktarıyorum.', handoff: true, handoffType: 'sikayet', handoffReason: 'Hasar şikayeti' })] });
  const p = olay({ messages: [mesaj('wX', 'eşyam kırıldı')] });
  await gonder(o, p);
  const log = await loglariYakala(async () => { await gonder(o, p); await gonder(o, olay({ messages: [mesaj('wY', 'cevap verin')] })); });
  assert.ok(log.includes('[whatsapp] atlandı 9053****4567 tekrar'));
  assert.ok(log.includes('[whatsapp] atlandı 9053****4567 human mode'));
  assert.ok(!log.some(s => s.includes(WA)));
  assert.equal(konusma(o.db).devirTuru, 'sikayet');
});

test('DepoEvim hattı: konuşma depolamayla başlayıp sonra taşımaya dönerse Sembol aydınlatması o turda bir kez eklenir', async () => {
  SAAT = Date.parse('2026-10-07T08:00:00Z');
  const o = ortam({ aiCevaplari: [
    tamam({ reply: 'Hangi depo boyutunu düşünüyorsunuz?' }),
    tamam({ intent: 'ofis', reply: 'Ofisiniz hangi ilçede?' }),
    tamam({ intent: 'ofis', collected: { homeSize: 'ofis', fromCity: 'İstanbul' }, reply: 'Kaç kişilik bir ofis?' }),
  ] });
  await gonder(o, olay({ messages: [mesaj('w1', 'depo bakıyorum')] }));
  assert.doesNotMatch(o.gonderilen[0].text.body, /sembolevdeneve/);
  await gonder(o, olay({ messages: [mesaj('w2', 'aslında ofisimizi taşıyacağız')] }));
  assert.equal(o.gonderilen[1].text.body, `${SEMBOL_TASIMA_KVKK}\n\nOfisiniz hangi ilçede?`);
  await gonder(o, olay({ messages: [mesaj('w3', 'Kadıköy')] }));
  assert.equal(o.gonderilen[2].text.body, 'Kaç kişilik bir ofis?');
  const k = konusma(o.db);
  const lead = o.db.havuz(k.tasimaLeadId);
  assert.equal(lead.hizmetTipi, 'Nakliye'); assert.match(lead.hareketler[0].islem, /Ofis \/ İşyeri Taşıma/);
  assert.deepEqual(lead.kvkkAydinlatmaMarka, ['depoevim', 'sembol']);
});
