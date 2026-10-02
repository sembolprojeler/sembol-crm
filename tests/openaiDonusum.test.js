// OpenAI dönüşüm bildirimi — sahte fetch / waitUntil / Firestore
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sahteDb, sahteIstek, sahteYanit } from './yardimci.js';
import { openaiAyarlari, olayGonder } from '../api/_lib/openaiDonusum.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur } = await import('../api/submit-lead.js');

const ENV = { OPENAI_PIXEL_ID: 'U5H4Xwx1SwGJwJHVEazhp4', OPENAI_CONVERSIONS_KEY: 'gizli-anahtar', OPENAI_CAPI_TEST: '1' };
const LANDING = 'https://www.sembolevdeneve.com/fiyat-teklifi-al/?utm_source=chatgpt&utm_medium=cpc&utm_campaign=55';
const reklamBody = (ek) => ({ leadId: 'L1', source: 'web-wizard-fullpage', fullName: 'Ayşe', phone: '0555', utm_source: 'chatgpt', utm_medium: 'cpc', landing_url: LANDING, ...ek });

// Bir isteği işler; waitUntil'e verilen işleri bekler. fetch çağrılarını döndürür.
async function calistir({ db = sahteDb(), env = ENV, body, fetchYaniti = { ok: true, status: 200 } }) {
  const cagrilar = [];
  const isler = [];
  const sahteFetch = async (url, ops) => { cagrilar.push({ url, ops, govde: JSON.parse(ops.body) }); return { ...fetchYaniti, text: async () => 'hata' }; };
  const handler = handlerOlustur({ getDb: () => db, waitUntil: (p) => isler.push(p), fetch: sahteFetch, env });
  const res = sahteYanit();
  await handler(sahteIstek(body), res);
  assert.equal(res.kod, 200);
  await Promise.all(isler);
  return { db, cagrilar, isler };
}

test('chatgpt_ads tam kayıt → dönüşüm gider (doğru uç, başlık, gövde) ve sonuç kayda yazılır', async () => {
  const { db, cagrilar, isler } = await calistir({ body: reklamBody({ status: 'completed' }) });
  assert.equal(isler.length, 1, 'waitUntil ile gönderilmeli');
  assert.equal(cagrilar.length, 1);
  const c = cagrilar[0];
  assert.equal(c.url, 'https://bzr.openai.com/v1/events?pid=U5H4Xwx1SwGJwJHVEazhp4');
  assert.equal(c.ops.method, 'POST');
  assert.equal(c.ops.headers.Authorization, 'Bearer gizli-anahtar');
  assert.equal(c.govde.validate_only, true);
  const olay = c.govde.events[0];
  assert.equal(olay.id, 'L1', 'olay id = Firestore belge id');
  assert.equal(olay.type, 'lead_created');
  assert.equal(olay.action_source, 'web');
  assert.equal(olay.source_url, LANDING);
  assert.deepEqual(olay.data, { type: 'customer_action' });
  assert.equal(typeof olay.timestamp_ms, 'number');
  const k = db.havuz('L1');
  assert.equal(k.openaiDonusum.durum, 'test_gonderildi');
  assert.equal(k.openaiDonusum.httpKodu, 200);
  assert.ok(k.openaiDonusum.zaman);
});

test('callback_requested de dönüşüm sayılır', async () => {
  const { cagrilar } = await calistir({ body: reklamBody({ status: 'callback_requested' }) });
  assert.equal(cagrilar.length, 1);
});

test('partial-save → gitmez', async () => {
  const { cagrilar, isler } = await calistir({ body: reklamBody({ status: 'partial' }) });
  assert.equal(cagrilar.length, 0);
  assert.equal(isler.length, 0);
  const { cagrilar: c2 } = await calistir({ body: reklamBody({}) }); // status yok = partial
  assert.equal(c2.length, 0);
});

test('organik ChatGPT → gitmez', async () => {
  const { cagrilar } = await calistir({ body: reklamBody({ status: 'completed', utm_source: 'chatgpt.com', utm_medium: '', landing_url: 'https://www.sembolevdeneve.com/?utm_source=chatgpt.com' }) });
  assert.equal(cagrilar.length, 0);
});

test('env yok → sessizce atlanır, kayıt yine yazılır', async () => {
  const { db, cagrilar } = await calistir({ env: {}, body: reklamBody({ status: 'completed' }) });
  assert.equal(cagrilar.length, 0);
  assert.equal(db.havuz('L1').reklamKaynagi, 'chatgpt_ads');
  assert.equal('openaiDonusum' in db.havuz('L1'), false);
});

test('başarılı gönderimden sonra (callback → completed) tekrar gönderilmez', async () => {
  const db = sahteDb();
  const env = { ...ENV, OPENAI_CAPI_TEST: '' };
  const ilk = await calistir({ db, env, body: reklamBody({ status: 'callback_requested' }) });
  assert.equal(ilk.cagrilar.length, 1);
  assert.equal(ilk.cagrilar[0].govde.validate_only, false);
  assert.equal(db.havuz('L1').openaiDonusum.durum, 'gonderildi');
  const ikinci = await calistir({ db, env, body: reklamBody({ status: 'completed' }) });
  assert.equal(ikinci.cagrilar.length, 0);
});

test('başarısız gönderim kaydedilir ve sonraki tamamlamada yeniden denenir', async () => {
  const db = sahteDb();
  await calistir({ db, body: reklamBody({ status: 'completed' }), fetchYaniti: { ok: false, status: 401 } });
  assert.deepEqual([db.havuz('L1').openaiDonusum.durum, db.havuz('L1').openaiDonusum.httpKodu], ['hata', 401]);
  const tekrar = await calistir({ db, body: reklamBody({ status: 'completed' }) });
  assert.equal(tekrar.cagrilar.length, 1);
});

test('landing_url yoksa varsayılan source_url', async () => {
  const { cagrilar } = await calistir({ body: reklamBody({ status: 'completed', landing_url: '' }) });
  assert.equal(cagrilar[0].govde.events[0].source_url, 'https://www.sembolevdeneve.com/fiyat-teklifi-al/');
});

test('DepoEvim varsayılan olarak gönderilmez; OPENAI_DONUSUM_SITELERI ile açılabilir', async () => {
  const body = reklamBody({ status: 'completed', source: 'depoevim-esya-depolama-wizard' });
  assert.equal((await calistir({ body })).cagrilar.length, 0);
  const env = { ...ENV, OPENAI_DONUSUM_SITELERI: 'sembolevdeneve,depoevim', OPENAI_PIXEL_ID: 'sembolevdeneve:PIX_S,depoevim:PIX_D' };
  const { cagrilar } = await calistir({ env, body });
  assert.equal(cagrilar.length, 1);
  assert.ok(cagrilar[0].url.endsWith('pid=PIX_D'));
});

test('site başına pixel: listede olmayan site için pixel yoksa atlanır', () => {
  const env = { OPENAI_PIXEL_ID: 'depoevim:PIX_D', OPENAI_CONVERSIONS_KEY: 'k' };
  assert.equal(openaiAyarlari(env, 'sembolevdeneve'), null);
  assert.equal(openaiAyarlari({ ...env, OPENAI_PIXEL_ID: 'TEK' }, 'sembolevdeneve').pixelId, 'TEK');
});

test('zaman aşımı → durum zaman_asimi; anahtar loglanmaz', async () => {
  const loglar = [];
  const eski = console.error;
  console.error = (...a) => loglar.push(a.join(' '));
  try {
    const askida = (url, ops) => new Promise((_, red) => ops.signal.addEventListener('abort', () => red(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const s = await olayGonder({ ayar: { pixelId: 'P', anahtar: 'gizli-anahtar', test: false }, belgeId: 'L9', fetchFn: askida, zamanAsimiMs: 20 });
    assert.equal(s.durum, 'zaman_asimi');
    assert.equal(s.httpKodu, null);
    await olayGonder({ ayar: { pixelId: 'P', anahtar: 'gizli-anahtar', test: false }, belgeId: 'L9', fetchFn: async () => ({ ok: false, status: 500, text: async () => 'x' }) });
  } finally {
    console.error = eski;
  }
  assert.ok(loglar.length >= 2);
  assert.ok(loglar.every(l => !l.includes('gizli-anahtar')));
});
