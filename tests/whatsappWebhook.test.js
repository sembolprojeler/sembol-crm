// api/whatsapp-webhook.js — uçtan uca (sahte Firestore, sahte Meta API, sahte yapay zeka)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur, imzaGecerliMi, YEDEK_MESAJ } = await import('../api/whatsapp-webhook.js');

const SECRET = 'gizli';
const ENV = { WHATSAPP_APP_SECRET: SECRET, WHATSAPP_VERIFY_TOKEN: 'dogrula', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '111',
  FIRESTORE_APP_ID: 'test-app', GEMINI_API_KEY: 'k', WHATSAPP_BIRLESTIRME_MS: '0' };
const WA = '905321234567';

let SAAT = Date.parse('2026-10-06T08:00:00Z');
function ortam({ aiCevaplari = [], metaHata = null, fiyat = null, env = {}, db = sahteDb(), bekle } = {}) {
  const gonderilen = [], aiCagrilari = [], arka = [];
  const fetchFn = async (url, ops) => {
    if (String(url).includes('graph.facebook.com')) {
      gonderilen.push(JSON.parse(ops.body));
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
const tamam = (o) => ({ ok: true, cikti: { reply: 'Kaç odalı bir ev taşınacak?', collected: {}, handoff: false, handoffReason: '', intent: 'evden_eve', marka: '', ...o } });
const mesaj = (id, metin, ek = {}) => ({ from: WA, id, timestamp: '1791273600', type: 'text', text: { body: metin }, ...ek });
const olay = (value) => ({ object: 'whatsapp_business_account', entry: [{ id: 'x', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '111' }, ...value } }] }] });

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

test('ilk mesaj: 200, bot cevabı KVKK ile başlar, konuşma ve mesajlar kaydedilir', async () => {
  const o = ortam({ aiCevaplari: [tamam()] });
  const res = await gonder(o, olay({ contacts: [{ wa_id: WA, profile: { name: 'Ayşe' } }], messages: [mesaj('w1', 'Merhaba, taşınacağım')] }));
  assert.equal(res.kod, 200);
  assert.equal(o.gonderilen.length, 1);
  assert.equal(o.gonderilen[0].to, WA);
  // Marka belli değil: nötr tanıtım + İKİ aydınlatma linki
  assert.match(o.gonderilen[0].text.body, /^Merhaba, ben Sembol Nakliyat ve DepoEvim'in dijital asistanıyım/);
  assert.doesNotMatch(o.gonderilen[0].text.body, /SEMBO Asistan/);
  assert.match(o.gonderilen[0].text.body, /sembolevdeneve\.com\/aydinlatma-metni\//);
  assert.match(o.gonderilen[0].text.body, /depoevim\.com\/aydinlatma-metni\//);
  assert.match(o.gonderilen[0].text.body, /Kaç odalı/);
  const k = konusma(o.db);
  assert.equal(k.profileName, 'Ayşe'); assert.equal(k.phone, '0532 123 45 67'); assert.equal(k.mode, 'bot');
  assert.equal(k.kvkkVerildi, true); assert.equal(k.botKilit, null); assert.equal(k.unreadCount, 1);
  assert.deepEqual(Object.keys(k.kvkkGonderilen).sort(), ['depoevim', 'sembol']);
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

test('ref kodu: marka ref\'ten, ref yapay zekaya gitmez, tıklama kaydı lead\'e dönüşür (reklam kaynağı korunur)', async () => {
  const db = sahteDb();
  await db.collection('artifacts').doc('test-app').collection('public').doc('data').collection('havuzKayitlari').doc('ref_SB-ABC12')
    .set({ sadeceTiklama: true, musteriAdi: 'Google Ads Ziyaretçisi', reklamKaynagi: 'google_ads', durum: 'Yeni', kanal: 'whatsapp', hareketler: [{ islem: 'tık' }] });
  const o = ortam({ db, aiCevaplari: [tamam({ collected: { homeSize: '2+1', fromCity: 'İstanbul', fromDistrict: 'Kadıköy' }, marka: 'sembol' })] });
  await gonder(o, olay({ contacts: [{ wa_id: WA, profile: { name: 'Mehmet' } }], messages: [mesaj('w1', 'Merhaba fiyat almak istiyorum (Ref: SB-ABC12)')] }));
  assert.equal(o.aiCagrilari[0].gecmis[0].metin, 'Merhaba fiyat almak istiyorum');
  assert.match(o.aiCagrilari[0].sistem, /MARKA: Sembol Nakliyat/);
  const lead = db.havuz('ref_SB-ABC12');
  assert.equal(lead.reklamKaynagi, 'google_ads');
  assert.equal(lead.kayitTipi, 'whatsapp-bot');
  assert.equal(lead.sadeceTiklama, false);
  assert.equal(lead.musteriAdi, 'Mehmet');
  assert.equal(lead.iletisim, '0532 123 45 67');
  assert.match(lead.sonMesaj, /Tip: 2\+1/);
  assert.equal(lead.kvkkAydinlatmaKanal, 'whatsapp');
  assert.equal(konusma(db).leadId, 'ref_SB-ABC12');
});

test('fiyat: alanlar tamamlanınca sistem fiyatıyla ikinci tur; uydurma rakam sabit metne çevrilir; lead fiyatı yazılır', async () => {
  const fiyat = ({ alanlar }) => (alanlar.paketleme ? { durum: 'tamam', marka: 'sembol', min: 51100, max: 64000 } : { durum: 'eksik', eksik: ['paketleme'] });
  const o = ortam({ fiyat, aiCevaplari: [
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

test('devretme: mode human olur, sonraki mesajlarda bot susar; lead\'e hareket yazılır', async () => {
  const o = ortam({ aiCevaplari: [tamam({ reply: 'Sizi ekibimize aktarıyorum.', handoff: true, handoffReason: 'Temsilci istedi', collected: { fullName: 'Ali Veli' } })] });
  await gonder(o, olay({ messages: [mesaj('w1', 'temsilciyle görüşmek istiyorum')] }));
  const k = konusma(o.db);
  assert.equal(k.mode, 'human'); assert.equal(k.needsAgent, true); assert.equal(k.handoffReason, 'Temsilci istedi');
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
  assert.equal(o.gonderilen[0].text.body, 'Kaç odalı bir ev?');   // eski KVKK (Sembol) gitmiş sayılır; marka yok → ek yok
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

test('marka sonradan değişirse yeni markanın linki bir kez eklenir', async () => {
  const o = ortam({ aiCevaplari: [
    tamam({ marka: 'sembol', reply: 'Kaç odalı?' }),
    tamam({ marka: 'depoevim', intent: 'depolama', reply: 'Eşyalarınızı hangi şubemizde depolamak istersiniz?' }),
    tamam({ marka: 'depoevim', intent: 'depolama', reply: 'Adınızı alabilir miyim?' }),
  ] });
  await gonder(o, olay({ messages: [mesaj('w1', 'Merhaba (Ref: SB-ABC12)')] }));
  assert.match(o.gonderilen[0].text.body, /^Merhaba, ben SEMBO Asistan, Sembol Nakliyat'ın/);
  assert.doesNotMatch(o.gonderilen[0].text.body, /depoevim\.com/);
  await gonder(o, olay({ messages: [mesaj('w2', 'Aslında eşyalarımı depolatmak istiyorum')] }));
  assert.match(o.gonderilen[1].text.body, /^Bilgilendirme: DepoEvim olarak paylaştığınız bilgiler KVKK kapsamında işlenir: https:\/\/www\.depoevim\.com\/aydinlatma-metni\//);
  await gonder(o, olay({ messages: [mesaj('w3', 'Kartal')] }));
  assert.equal(o.gonderilen[2].text.body, 'Adınızı alabilir miyim?');
  assert.deepEqual(Object.keys(konusma(o.db).kvkkGonderilen).sort(), ['depoevim', 'sembol']);
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

test('başka numaranın olayı işlenmez; WHATSAPP_BOT_KAPALI=1 iken yalnızca kaydedilir', async () => {
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
