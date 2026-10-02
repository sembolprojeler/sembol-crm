// api/submit-lead.js — kaynak / pazarlama kaydı (sahte Firestore)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sahteDb, sahteIstek, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur } = await import('../api/submit-lead.js');

async function gonder(db, body) {
  const handler = handlerOlustur({ getDb: () => db, env: {}, waitUntil: () => {} });
  const res = sahteYanit();
  await handler(sahteIstek(body), res);
  assert.equal(res.kod, 200, JSON.stringify(res.govde));
  return res;
}

const temel = { leadId: 'L1', source: 'web-wizard-fullpage', fullName: 'Ayşe', phone: '0555' };

test('ChatGPT reklamından gelen teklif chatgpt_ads + pazarlama kaydı', async () => {
  const db = sahteDb();
  await gonder(db, { ...temel, status: 'completed', reklamKaynagi: 'direkt_giris', utm_source: 'chatgpt', utm_medium: 'cpc', utm_campaign: '{campaign_id}', utm_content: '987', landing_url: 'https://www.sembolevdeneve.com/fiyat-teklifi-al/?utm_source=chatgpt' });
  const k = db.havuz('L1');
  assert.equal(k.reklamKaynagi, 'chatgpt_ads');
  assert.equal(k.kaynakKarari, 'sunucu_utm_reklam');
  assert.equal(k.pazarlama.utmSource, 'chatgpt');
  assert.equal(k.pazarlama.utmContent, '987');
  assert.equal('utmCampaign' in k.pazarlama, false);
});

test('tarayıcının yeni AI değeri geçerli kabul edilir (artık direkt_giris değil)', async () => {
  const db = sahteDb();
  await gonder(db, { ...temel, reklamKaynagi: 'perplexity_organik' });
  assert.equal(db.havuz('L1').reklamKaynagi, 'perplexity_organik');
});

test('sonraki ara kayıt pazarlama izini silmez, sınıflandırma birleşik izle yapılır', async () => {
  const db = sahteDb();
  await gonder(db, { ...temel, status: 'partial', utm_source: 'chatgpt', utm_medium: 'cpc', referrer: 'https://chatgpt.com/' });
  await gonder(db, { ...temel, status: 'completed', reklamKaynagi: 'direkt_giris' });
  const k = db.havuz('L1');
  assert.equal(k.pazarlama.utmSource, 'chatgpt');
  assert.equal(k.pazarlama.referrer, 'https://chatgpt.com/');
  assert.equal(k.reklamKaynagi, 'chatgpt_ads');
});

test('eşleşme yoksa mevcut davranış aynen çalışır', async () => {
  const db = sahteDb();
  await gonder(db, { ...temel, reklamKaynagi: 'google_anasayfa' });
  const k = db.havuz('L1');
  assert.equal(k.reklamKaynagi, 'google_anasayfa');
  assert.equal('pazarlama' in k, false);
});

test('QR izi AI organik kaynağın üzerine yazar, chatgpt_ads\'in üzerine yazmaz', async () => {
  const db = sahteDb();
  await gonder(db, { ...temel, reklamKaynagi: 'chatgpt_organik', qrIzi: { utmSource: 'qr', utmCampaign: 'KAMYON1' } });
  assert.equal(db.havuz('L1').reklamKaynagi, 'qr');
  const db2 = sahteDb();
  await gonder(db2, { ...temel, reklamKaynagi: 'chatgpt_ads', qrIzi: { utmSource: 'qr', utmCampaign: 'KAMYON1' } });
  assert.equal(db2.havuz('L1').reklamKaynagi, 'chatgpt_ads');
});
