// WhatsApp medyası → crm/upload.php (api/_lib/whatsappMedya.js, webhook arka plan işi, whatsapp-send medyaGetir)
// Ağ yok: Meta ve upload.php sahte (Node Response nesneleri).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { medyaIndirYukle, yuklemeYanitiniCoz, rastgeleDosyaAdi, uzantiBul, MEDYA_SINIRI } = await import('../api/_lib/whatsappMedya.js');
const webhook = await import('../api/whatsapp-webhook.js');
const send = await import('../api/whatsapp-send.js');

const WA = '905321234567';
const HAT = { phoneNumberId: '111', marka: 'depoevim', tokenEnv: 'WHATSAPP_TOKEN', eskiKimlik: true };
const ENV = { WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: '111', FIRESTORE_APP_ID: 'test-app', WHATSAPP_APP_SECRET: 's', WHATSAPP_BIRLESTIRME_MS: '0' };
const YUKLEME = 'https://www.sembolevdeneve.com/crm/upload.php';
const META_DOSYA = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

// Sahte ağ: Meta medya bilgisi → Meta dosyası → upload.php
function sahteAg({ bilgi = { url: META_DOSYA, mime_type: 'image/jpeg', file_size: 5 }, bilgiDurum = 200, dosya = Buffer.from('JPEG!'), dosyaKapisi = null,
  yukleme = (ad) => json({ url: `https://www.sembolevdeneve.com/crm/uploads/${ad}` }) } = {}) {
  const kayit = [];
  const fetchFn = async (url, ops = {}) => {
    const u = String(url);
    kayit.push({ url: u, ops });
    if (u.startsWith('https://graph.facebook.com/') && u.endsWith('/messages')) return json({ messages: [{ id: `wamid.out${kayit.length}` }] });
    if (u.startsWith('https://graph.facebook.com/')) return json(bilgi, bilgiDurum);
    if (u === META_DOSYA) { if (dosyaKapisi) await dosyaKapisi; return new Response(dosya, { status: 200 }); }
    if (u === YUKLEME) { const f = ops.body.get('file'); return yukleme(f.name, f); }
    throw new Error('beklenmeyen istek ' + u);
  };
  return { fetchFn, kayit };
}

test('medyaIndirYukle: Meta\'dan alır, upload.php\'ye "file" alanıyla rastgele adla yükler (telefon / ad geçmez)', async () => {
  const ag = sahteAg();
  const s = await medyaIndirYukle({ env: ENV, fetchFn: ag.fetchFn, hat: HAT, mediaId: 'MEDIA1', rastgele: () => 'a'.repeat(32) });
  assert.equal(s.ok, true);
  assert.equal(s.url, `https://www.sembolevdeneve.com/crm/uploads/wa_${'a'.repeat(32)}.jpg`);
  assert.equal(s.mimeType, 'image/jpeg'); assert.equal(s.boyut, 5);
  const [bilgi, indir, yukle] = ag.kayit;
  assert.match(bilgi.url, /\/MEDIA1$/); assert.equal(bilgi.ops.headers.Authorization, 'Bearer tok');
  assert.equal(indir.ops.headers.Authorization, 'Bearer tok');
  assert.equal(yukle.ops.method, 'POST'); assert.equal(yukle.ops.headers, undefined);   // upload.php'ye token GİTMEZ
  const f = yukle.ops.body.get('file');
  assert.equal(f.type, 'image/jpeg'); assert.equal(f.size, 5);
  assert.doesNotMatch(f.name, /905|532|1234567/);
  // gerçek rastgele ad: wa_ + 32 hex
  assert.match(rastgeleDosyaAdi('audio/ogg; codecs=opus'), /^wa_[0-9a-f]{32}\.ogg$/);
  assert.equal(uzantiBul('application/pdf'), 'pdf'); assert.equal(uzantiBul('x/y'), 'bin');
});

test('20 MB sınırı: Meta boyutu bildirirse indirilmez; bildirmezse indirirken kesilir; yüklenmez', async () => {
  const ag = sahteAg({ bilgi: { url: META_DOSYA, mime_type: 'video/mp4', file_size: MEDYA_SINIRI + 1 } });
  const s = await medyaIndirYukle({ env: ENV, fetchFn: ag.fetchFn, hat: HAT, mediaId: 'M' });
  assert.equal(s.ok, false); assert.equal(s.tur, 'boyut'); assert.match(s.hata, /20 MB sınırını aşıyor/);
  assert.equal(ag.kayit.length, 1);
  const ag2 = sahteAg({ bilgi: { url: META_DOSYA, mime_type: 'video/mp4' }, dosya: Buffer.alloc(100) });
  const s2 = await medyaIndirYukle({ env: ENV, fetchFn: ag2.fetchFn, hat: HAT, mediaId: 'M', sinir: 50 });
  assert.equal(s2.tur, 'boyut');
  assert.ok(!ag2.kayit.some(k => k.url === YUKLEME));
});

test('Meta\'da süresi dolmuş medya → "suresi_doldu"; upload.php hatası → "yukleme" + sunucu metni', async () => {
  const ag = sahteAg({ bilgi: { error: { code: 100, message: 'Unsupported get request. Object with ID does not exist' } }, bilgiDurum: 400 });
  const s = await medyaIndirYukle({ env: ENV, fetchFn: ag.fetchFn, hat: HAT, mediaId: 'ESKI' });
  assert.equal(s.tur, 'suresi_doldu'); assert.match(s.hata, /artık alınamıyor/);
  const ag2 = sahteAg({ yukleme: () => new Response('Dosya boyutu çok büyük', { status: 413 }) });
  const s2 = await medyaIndirYukle({ env: ENV, fetchFn: ag2.fetchFn, hat: HAT, mediaId: 'M' });
  assert.equal(s2.tur, 'yukleme'); assert.match(s2.hata, /upload\.php HTTP 413\): Dosya boyutu çok büyük/);
});

test('upload.php yanıtı CRM ile aynı okunur: url | fileName | file | düz metin', () => {
  assert.equal(yuklemeYanitiniCoz('{"url":"https://www.sembolevdeneve.com/crm/uploads/wa_x.jpg"}'), 'https://www.sembolevdeneve.com/crm/uploads/wa_x.jpg');
  assert.equal(yuklemeYanitiniCoz('{"fileName":"wa_x.pdf"}'), 'https://www.sembolevdeneve.com/crm/uploads/wa_x.pdf');
  assert.equal(yuklemeYanitiniCoz(' https://www.sembolevdeneve.com/crm/uploads/wa_y.ogg \n'), 'https://www.sembolevdeneve.com/crm/uploads/wa_y.ogg');
  assert.equal(yuklemeYanitiniCoz('<html>Error</html>'), null);
  assert.equal(yuklemeYanitiniCoz(''), null);
});

// ---------------------------------------------------------------- webhook
const kok = (db) => db.collection('artifacts').doc('test-app').collection('public').doc('data');
const mesajBelgesi = (db, id) => db.belge(`whatsapp_conversations/${WA}/messages/${id}`);
function webhookOrtami(ag) {
  const db = sahteDb(); const arka = [], ai = [];
  const handler = webhook.handlerOlustur({ getDb: () => db, waitUntil: (p) => arka.push(p), fetchFn: ag.fetchFn, env: ENV, bekle: async () => {},
    simdi: () => Date.parse('2026-10-07T08:00:00Z'), fiyatHesapla: async () => null,
    aiUret: async (a) => { ai.push(a); return { ok: true, cikti: { reply: 'Fotoğrafı aldım.', collected: {}, handoff: false, handoffReason: '', handoffType: '', intent: 'depolama', marka: '' } }; } });
  const gonder = async (m) => {
    const ham = Buffer.from(JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '111' }, messages: [{ from: WA, timestamp: '1791360000', ...m }] } }] }] }));
    await handler({ method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', 's').update(ham).digest('hex') }, async *[Symbol.asyncIterator]() { yield ham; } }, sahteYanit());
  };
  return { db, arka, ai, gonder, bitir: async () => { while (arka.length) await arka.shift(); } };
}

test('webhook: görsel gelince bot cevabı medyayı BEKLEMEZ; sonra mesaj belgesine url, mime, boyut, caption yazılır', async () => {
  let kapiyiAc; const kapi = new Promise(r => { kapiyiAc = r; });
  const ag = sahteAg({ dosyaKapisi: kapi });
  const o = webhookOrtami(ag);
  await o.gonder({ id: 'wIMG', type: 'image', image: { id: 'MEDIA9', mime_type: 'image/jpeg', caption: 'salon eşyaları' } });
  assert.equal(mesajBelgesi(o.db, 'wIMG').medya.durum, 'bekliyor');
  // medya indirmesi takılıyken bot turu biter
  const botIsi = o.arka.shift(); const medyaIsi = o.arka.shift();
  await botIsi;
  assert.equal(o.ai.length, 1);
  assert.ok(ag.kayit.some(k => k.url.endsWith('/111/messages')));
  assert.equal(mesajBelgesi(o.db, 'wIMG').medya.durum, 'bekliyor');
  kapiyiAc(); await medyaIsi; await o.bitir();
  const m = mesajBelgesi(o.db, 'wIMG');
  assert.equal(m.medya.durum, 'hazir'); assert.match(m.medya.url, /^https:\/\/www\.sembolevdeneve\.com\/crm\/uploads\/wa_[0-9a-f]{32}\.jpg$/);
  assert.equal(m.medya.mimeType, 'image/jpeg'); assert.equal(m.medya.boyut, 5); assert.equal(m.medya.caption, 'salon eşyaları');
  assert.equal(m.medyaHata, null);
  assert.equal(m.text, '[görsel] salon eşyaları');
});

test('webhook: belge adı saklanır; medya hatası medyaHata olarak yazılır, bot yine cevap verir', async () => {
  const ag = sahteAg({ bilgi: { url: META_DOSYA, mime_type: 'application/pdf', file_size: 5 }, yukleme: () => new Response('', { status: 500 }) });
  const o = webhookOrtami(ag);
  await o.gonder({ id: 'wDOC', type: 'document', document: { id: 'MEDIA7', mime_type: 'application/pdf', filename: 'kira-sozlesmesi.pdf' } });
  await o.bitir();
  const m = mesajBelgesi(o.db, 'wDOC');
  assert.equal(m.medya.durum, 'hata'); assert.equal(m.medya.dosyaAdi, 'kira-sozlesmesi.pdf'); assert.equal(m.medya.hataTuru, 'yukleme');
  assert.match(m.medyaHata, /upload\.php HTTP 500/);
  assert.equal(o.ai.length, 1);
});

test('webhook: metin, konum ve çıkartma medya işi başlatmaz', async () => {
  const ag = sahteAg();
  const o = webhookOrtami(ag);
  await o.gonder({ id: 'wT', type: 'text', text: { body: 'merhaba' } });
  await o.gonder({ id: 'wS', type: 'sticker', sticker: { id: 'ST1', mime_type: 'image/webp' } });
  await o.bitir();
  assert.ok(!ag.kayit.some(k => k.url === YUKLEME || k.url === META_DOSYA));
  assert.equal(mesajBelgesi(o.db, 'wT').medya, undefined);
});

// ---------------------------------------------------------------- whatsapp-send medyaGetir
async function sendOrtami(ag, mesaj) {
  const db = sahteDb();
  await kok(db).collection('settings').doc('company').set({ positionModules: { 'Satış Temsilcisi': { addJob: true } } });
  await kok(db).collection('personnelList').doc('P1').set({ fullName: 'Ayşe', position: 'Satış Temsilcisi', password: '1234' });
  await kok(db).collection('whatsapp_conversations').doc(WA).set({ waId: WA, mode: 'bot', lastCustomerMessageAt: '2026-09-01T00:00:00.000Z' });
  await kok(db).collection('whatsapp_conversations').doc(WA).collection('messages').doc('wESKI').set(mesaj);
  const handler = send.handlerOlustur({ getDb: () => db, fetchFn: ag.fetchFn, env: ENV, simdi: () => Date.parse('2026-10-07T12:00:00Z') });
  const istek = async (g) => { const r = sahteYanit(); await handler({ method: 'POST', headers: {}, body: g }, r); return r; };
  return { db, istek };
}

test('medyaGetir: eski mesajın medyası alınır (24 saat penceresinden bağımsız); yetkisiz 401', async () => {
  const ag = sahteAg({ bilgi: { url: META_DOSYA, mime_type: 'audio/ogg; codecs=opus', file_size: 5 } });
  const o = await sendOrtami(ag, { from: 'customer', type: 'audio', text: '[sesli mesaj]', mediaId: 'MEDIA3', timestamp: '2026-09-01T00:00:00.000Z' });
  assert.equal((await o.istek({ islem: 'medyaGetir', konusmaId: WA, mesajId: 'wESKI' })).kod, 401);
  const r = await o.istek({ islem: 'medyaGetir', konusmaId: WA, mesajId: 'wESKI', personelId: 'P1', sifre: '1234' });
  assert.equal(r.kod, 200); assert.match(r.govde.medya.url, /wa_[0-9a-f]{32}\.ogg$/);
  const m = mesajBelgesi(o.db, 'wESKI');
  assert.equal(m.medya.durum, 'hazir'); assert.equal(m.medya.mimeType, 'audio/ogg');
  // ikinci istek yeniden indirmez
  const once = ag.kayit.length;
  assert.equal((await o.istek({ islem: 'medyaGetir', konusmaId: WA, mesajId: 'wESKI', personelId: 'P1', sifre: '1234' })).kod, 200);
  assert.equal(ag.kayit.length, once);
});

test('medyaGetir: Meta\'da süresi dolmuşsa 410 + "artık alınamıyor"; medyasız mesaj 404', async () => {
  const ag = sahteAg({ bilgi: { error: { code: 100, message: 'does not exist' } }, bilgiDurum: 400 });
  const o = await sendOrtami(ag, { from: 'customer', type: 'image', text: '[görsel]', mediaId: 'COKESKI' });
  const r = await o.istek({ islem: 'medyaGetir', konusmaId: WA, mesajId: 'wESKI', personelId: 'P1', sifre: '1234' });
  assert.equal(r.kod, 410); assert.equal(r.govde.sebep, 'suresi_doldu');
  assert.equal(mesajBelgesi(o.db, 'wESKI').medya.hataTuru, 'suresi_doldu');
  const o2 = await sendOrtami(ag, { from: 'customer', type: 'text', text: 'merhaba' });
  assert.equal((await o2.istek({ islem: 'medyaGetir', konusmaId: WA, mesajId: 'wESKI', personelId: 'P1', sifre: '1234' })).kod, 404);
  assert.equal((await o2.istek({ islem: 'medyaGetir', konusmaId: WA, personelId: 'P1', sifre: '1234' })).kod, 400);
});
