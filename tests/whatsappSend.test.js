// api/whatsapp-send.js — CRM WhatsApp paneli sunucu ucu (sahte Firestore, sahte Meta API)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur, PENCERE_MS } = await import('../api/whatsapp-send.js');
const { altSatisErisimi, modulErisimi, yoneticiMi, SIFRE_YOK_MESAJI } = await import('../api/_lib/crmYetki.js');

const WA = '905321234567';
const SAAT = Date.parse('2026-10-07T12:00:00Z');
const ENV = { FIRESTORE_APP_ID: 'test-app', WHATSAPP_TOKEN: 't', WHATSAPP_NUMARALAR: JSON.stringify({ 111: 'depoevim', 222: 'sembolevdeneve' }) };
const kok = (db) => db.collection('artifacts').doc('test-app').collection('public').doc('data');

async function kur({ konusma = {}, personel = {}, positionModules = { 'Satış Temsilcisi': { addJob: true } }, metaHata = null } = {}) {
  const db = sahteDb();
  await kok(db).collection('settings').doc('company').set({ positionModules });
  await kok(db).collection('personnelList').doc('P1').set({ fullName: 'Ayşe Satış', position: 'Satış Temsilcisi', password: '1234', employmentStatus: 'Aktif', ...personel });
  await kok(db).collection('personnelList').doc('P2').set({ fullName: 'Mehmet Satış', position: 'Satış Temsilcisi', password: '9999' });
  await kok(db).collection('personnelList').doc('M1').set({ fullName: 'Müdür Bey', position: 'Satış Temsilcisi', rank: 'Müdür', password: 'm' });
  await kok(db).collection('whatsapp_conversations').doc(WA).set({ waId: WA, mode: 'bot', needsAgent: true, unreadCount: 3, leadId: 'L1',
    lastCustomerMessageAt: new Date(SAAT - 3600000).toISOString(), ...konusma });
  await kok(db).collection('havuzKayitlari').doc('L1').set({ durum: 'Yeni', hareketler: [] });
  const gonderilen = [];
  const fetchFn = async (url, ops) => {
    gonderilen.push({ url: String(url), govde: JSON.parse(ops.body) });
    if (metaHata) return { ok: false, status: 400, json: async () => ({ error: metaHata }) };
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.ag1' }] }) };
  };
  const handler = handlerOlustur({ getDb: () => db, fetchFn, env: ENV, simdi: () => SAAT });
  const istek = async (govde) => { const r = sahteYanit(); await handler({ method: 'POST', headers: {}, body: govde }, r); return r; };
  return { db, istek, gonderilen };
}
const kon = (db) => db.belge(`whatsapp_conversations/${WA}`);
const mesajlar = (db) => [...db.belgeler.entries()].filter(([k]) => k.includes(`whatsapp_conversations/${WA}/messages/`)).map(([, v]) => v);
const ayse = { personelId: 'P1', sifre: '1234' };

test('yetki kuralları App.jsx ile aynı: alt sayfa üst Satış yetkisini miras alır, kişiye özel kapatılabilir', () => {
  const pm = { 'Satış Temsilcisi': { addJob: true }, 'Şoför': {} };
  assert.equal(altSatisErisimi({ position: 'Satış Temsilcisi' }, pm, 'satisWhatsapp'), true);
  assert.equal(altSatisErisimi({ position: 'Satış Temsilcisi', permissions: { modules: { satisWhatsapp: false } } }, pm, 'satisWhatsapp'), false);
  assert.equal(altSatisErisimi({ position: 'Şoför' }, pm, 'satisWhatsapp'), false);
  assert.equal(altSatisErisimi({ position: 'Firma Sahibi' }, {}, 'satisWhatsapp'), true);
  assert.equal(modulErisimi({ position: 'Firma Sahibi', employmentStatus: 'Pasif' }, {}, 'addJob'), false);
  assert.equal(yoneticiMi({ rank: 'Müdür' }), true);
  assert.equal(yoneticiMi({ position: 'Satış Temsilcisi' }), false);
});

test('yetkisiz: kimlik yok / şifre hatalı → 401; şifresiz (yalnız Google) → 401 + anlaşılır mesaj; hiçbir şey gönderilmez', async () => {
  const o = await kur({ personel: { password: '' } });
  let r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba' });
  assert.equal(r.kod, 401);
  r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', personelId: 'P2', sifre: 'yanlis' });
  assert.equal(r.kod, 401); assert.equal(r.govde.sebep, 'sifre_hatali');
  r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', personelId: 'P1', sifre: 'herhangi' });
  assert.equal(r.kod, 401); assert.equal(r.govde.sebep, 'sifre_yok'); assert.equal(r.govde.hata, SIFRE_YOK_MESAJI);
  r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', personelId: 'YOK', sifre: 'x' });
  assert.equal(r.kod, 401);
  assert.equal(o.gonderilen.length, 0);
  assert.equal(kon(o.db).mode, 'bot');
});

test('yetkisiz: Pasif personel ya da WhatsApp yetkisi kapalı → 403', async () => {
  let o = await kur({ personel: { employmentStatus: 'Pasif' } });
  assert.equal((await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'x', ...ayse })).kod, 403);
  o = await kur({ personel: { permissions: { modules: { satisWhatsapp: false } } } });
  const r = await o.istek({ islem: 'devral', konusmaId: WA, ...ayse });
  assert.equal(r.kod, 403); assert.equal(r.govde.sebep, 'yetki_yok');
  o = await kur({ positionModules: {} });   // Satış Bölümü yetkisi yok
  assert.equal((await o.istek({ islem: 'okundu', konusmaId: WA, ...ayse })).kod, 403);
  assert.equal(o.gonderilen.length, 0);
});

test('gonder: 0850 hattından gider, messages\'a from:"agent" + agentName, konuşma mode "human", lead\'e hareket', async () => {
  const o = await kur();
  const r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba, ben Ayşe. Size yardımcı olayım.', ...ayse });
  assert.equal(r.kod, 200); assert.equal(r.govde.ok, true);
  assert.match(o.gonderilen[0].url, /\/111\/messages$/);
  assert.equal(o.gonderilen[0].govde.to, WA);
  const m = mesajlar(o.db)[0];
  assert.equal(m.from, 'agent'); assert.equal(m.agentName, 'Ayşe Satış'); assert.equal(m.agentId, 'P1');
  assert.equal(m.status, 'sent'); assert.equal(m.wamid, 'wamid.ag1');
  const k = kon(o.db);
  assert.equal(k.mode, 'human'); assert.equal(k.devirTuru, 'personel'); assert.equal(k.needsAgent, false); assert.equal(k.unreadCount, 0);
  assert.equal(k.lastAgentAt, new Date(SAAT).toISOString());
  assert.deepEqual(k.devralan, { id: 'P1', ad: 'Ayşe Satış' });
  assert.match(o.db.havuz('L1').hareketler.at(-1).islem, /Ayşe Satış WhatsApp'tan cevap yazdı/);
  // hatId'li konuşma kendi hattından gider
  const o2 = await kur({ konusma: { hatId: '111' } });
  assert.equal((await o2.istek({ islem: 'gonder', konusmaId: WA, metin: 'x', ...ayse })).kod, 200);
});

test('gonder: müşterinin son mesajından 24 saat geçtiyse 409, Meta çağrılmaz', async () => {
  const o = await kur({ konusma: { lastCustomerMessageAt: new Date(SAAT - PENCERE_MS - 60000).toISOString() } });
  const r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', ...ayse });
  assert.equal(r.kod, 409); assert.equal(r.govde.sebep, 'pencere');
  assert.match(r.govde.hata, /24 saat geçti/);
  assert.equal(o.gonderilen.length, 0);
  assert.equal(mesajlar(o.db).length, 0);
});

test('gonder: Meta hatası → 502, mesaj "failed" olarak kaydedilir (panelde görünür)', async () => {
  const o = await kur({ metaHata: { code: 131047, message: 'Re-engagement message' } });
  const r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', ...ayse });
  assert.equal(r.kod, 502);
  assert.equal(mesajlar(o.db)[0].status, 'failed');
  assert.equal(kon(o.db).mode, 'bot');
});

test('gonder: konuşmanın geldiği numaradan — Sembol (222) konuşması 222\'den, depolama lead\'ine de hareket yazılır', async () => {
  const o = await kur({ konusma: { hatId: '222', marka: 'sembol', leadId: null, depoLeadId: 'L1' } });
  const r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', ...ayse });
  assert.equal(r.kod, 200);
  assert.match(o.gonderilen[0].url, /\/222\/messages$/);
  assert.match(o.db.havuz('L1').hareketler.at(-1).islem, /cevap yazdı/);
});

test('gonder: eşlenmemiş numaradan gelen konuşma → 409 hat_yok, Meta çağrılmaz, mesaj yazılmaz', async () => {
  const o = await kur({ konusma: { hatId: '999', marka: '', eslenmemis: true } });
  const r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', ...ayse });
  assert.equal(r.kod, 409); assert.equal(r.govde.sebep, 'hat_yok'); assert.match(r.govde.hata, /WHATSAPP_NUMARALAR/);
  assert.equal(o.gonderilen.length, 0); assert.equal(mesajlar(o.db).length, 0);
  assert.equal(kon(o.db).mode, 'bot');
});

test('gonder: token hatası (190) → 502 + whatsapp_durum/token uyarısı (CRM bandı); sonraki başarılı gönderim bandı kaldırır', async () => {
  const o = await kur({ metaHata: { code: 190, type: 'OAuthException', message: 'Error validating access token' } });
  const r = await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'Merhaba', ...ayse });
  assert.equal(r.kod, 502);
  const uyari = o.db.belge('whatsapp_durum/token');
  assert.equal(uyari.aktif, true); assert.equal(uyari.tur, 'token'); assert.equal(uyari.kod, 190);
  assert.equal(uyari.mesaj, 'WhatsApp token geçersiz, mesajlar gönderilemiyor');
  // token düzeldi
  const o2 = await kur();
  await kok(o2.db).collection('whatsapp_durum').doc('token').set({ aktif: true, tur: 'token' });
  assert.equal((await o2.istek({ islem: 'gonder', konusmaId: WA, metin: 'x', ...ayse })).kod, 200);
  assert.equal(o2.db.belge('whatsapp_durum/token').aktif, false);
});

test('gonder: 24 saat penceresi sınırda — 23 sa 59 dk açık, 24 sa 1 dk kapalı; müşteri mesajı hiç yoksa kapalı', async () => {
  let o = await kur({ konusma: { lastCustomerMessageAt: new Date(SAAT - PENCERE_MS + 60000).toISOString() } });
  assert.equal((await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'x', ...ayse })).kod, 200);
  o = await kur({ konusma: { lastCustomerMessageAt: new Date(SAAT - PENCERE_MS - 60000).toISOString() } });
  assert.equal((await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'x', ...ayse })).kod, 409);
  o = await kur({ konusma: { lastCustomerMessageAt: null } });
  assert.equal((await o.istek({ islem: 'gonder', konusmaId: WA, metin: 'x', ...ayse })).kod, 409);
  assert.equal(o.gonderilen.length, 0);
});

test('devral → human (needsAgent kalkar); bota ver: başka personel 403, devralan ya da yönetici 200', async () => {
  const o = await kur();
  assert.equal((await o.istek({ islem: 'devral', konusmaId: WA, ...ayse })).kod, 200);
  let k = kon(o.db);
  assert.equal(k.mode, 'human'); assert.equal(k.needsAgent, false); assert.equal(k.devralan.id, 'P1'); assert.equal(k.devirTuru, 'personel');
  assert.match(o.db.havuz('L1').hareketler.at(-1).islem, /devraldı/);
  const r = await o.istek({ islem: 'botaVer', konusmaId: WA, personelId: 'P2', sifre: '9999' });
  assert.equal(r.kod, 403); assert.equal(r.govde.sebep, 'devralan_degil');
  assert.equal((await o.istek({ islem: 'botaVer', konusmaId: WA, personelId: 'M1', sifre: 'm' })).kod, 200);
  k = kon(o.db);
  assert.equal(k.mode, 'bot'); assert.equal(k.devralan, null); assert.equal(k.botaDonus.sebep, 'personel');
  assert.match(o.db.havuz('L1').hareketler.at(-1).islem, /bota geri verdi/);
  assert.equal(o.gonderilen.length, 0);
});

test('okundu: unreadCount sıfırlanır; geçersiz istek 400, olmayan konuşma 404', async () => {
  const o = await kur();
  assert.equal((await o.istek({ islem: 'okundu', konusmaId: WA, ...ayse })).kod, 200);
  assert.equal(kon(o.db).unreadCount, 0);
  assert.equal((await o.istek({ islem: 'sil', konusmaId: WA, ...ayse })).kod, 400);
  assert.equal((await o.istek({ islem: 'okundu', konusmaId: '../x', ...ayse })).kod, 400);
  assert.equal((await o.istek({ islem: 'okundu', konusmaId: '905000000000', ...ayse })).kod, 404);
});
