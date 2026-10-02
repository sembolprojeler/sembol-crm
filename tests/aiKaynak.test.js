// Yapay zeka sınıflandırması + pazarlama izi okuma testleri
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiKaynakSiniflandir, AI_ISTATISTIK_KUTULARI, AI_KAYNAK_DEGERLERI } from '../src/aiKaynakSema.js';
import { pazarlamaOku, reklamKaynagiKarar, PAID_ADS_DEGERLERI } from '../api/_lib/pazarlama.js';

const kod = (g) => aiKaynakSiniflandir(g)?.kod ?? null;

test('her platformun referrer\'ı doğru sınıfa düşer', () => {
  const beklenen = {
    'https://chatgpt.com/': 'chatgpt_organik',
    'https://chat.openai.com/c/123': 'chatgpt_organik',
    'https://gemini.google.com/app': 'gemini_organik',
    'https://bard.google.com/': 'gemini_organik',
    'https://claude.ai/chat/abc': 'claude_organik',
    'https://grok.com/': 'grok_organik',
    'https://www.perplexity.ai/search?q=nakliyat': 'perplexity_organik',
    'https://copilot.microsoft.com/': 'copilot_organik',
    'https://m365.copilot.cloud.microsoft/chat': 'copilot_organik',
  };
  for (const [referrer, sinif] of Object.entries(beklenen)) {
    assert.equal(kod({ referrer }), sinif, referrer);
  }
});

test('referrer tek başına reklam sayılmaz', () => {
  assert.equal(kod({ referrer: 'https://chatgpt.com/', utmMedium: 'cpc' }), 'chatgpt_organik');
});

test('utm_source=chatgpt & utm_medium=cpc → chatgpt_ads', () => {
  assert.equal(kod({ utmSource: 'chatgpt', utmMedium: 'cpc' }), 'chatgpt_ads');
  assert.equal(kod({ utmSource: 'ChatGPT', utmMedium: 'PAID' }), 'chatgpt_ads');
  assert.equal(kod({ utmSource: 'openai', utmMedium: 'ads' }), 'chatgpt_ads');
});

test('utm_source=chatgpt.com (medium yok) → chatgpt_organik', () => {
  assert.equal(kod({ utmSource: 'chatgpt.com' }), 'chatgpt_organik');
});

test('utm_source referrer\'dan önce gelir', () => {
  assert.equal(kod({ utmSource: 'chatgpt', utmMedium: 'cpc', referrer: 'https://gemini.google.com/' }), 'chatgpt_ads');
});

test('x.com / twitter.com Grok sayılmaz; google.com Gemini sayılmaz', () => {
  assert.equal(kod({ referrer: 'https://x.com/i/grok' }), null);
  assert.equal(kod({ referrer: 'https://twitter.com/' }), null);
  assert.equal(kod({ referrer: 'https://www.google.com/' }), null);
  assert.equal(kod({ referrer: 'https://notchatgpt.com/' }), null);
});

test('reklamı tanımlı olmayan platformda cpc organik kalır', () => {
  assert.equal(kod({ utmSource: 'gemini', utmMedium: 'cpc' }), 'gemini_organik');
});

test('kutular tablodan üretilir (ChatGPT Ads ilk sırada, 7 kutu)', () => {
  assert.deepEqual(AI_ISTATISTIK_KUTULARI.map(k => k.ad), ['ChatGPT Ads', 'ChatGPT Organik', 'Gemini', 'Claude', 'Grok', 'Perplexity', 'Copilot']);
  assert.ok(PAID_ADS_DEGERLERI.includes('chatgpt_ads'));
  assert.ok(!PAID_ADS_DEGERLERI.includes('chatgpt_organik'));
});

test('pazarlamaOku: "{campaign_id}" yer tutucusu kaydedilmez', () => {
  const p = pazarlamaOku({ utm_source: 'chatgpt', utm_medium: 'cpc', utm_campaign: '{campaign_id}', utm_content: '{ad_id}' });
  assert.equal(p.utmSource, 'chatgpt');
  assert.equal(p.utmCampaign, undefined);
  assert.equal(p.utmContent, undefined);
});

test('pazarlamaOku: boş alan yazılmaz, uzunluk sınırlanır, kontrol karakteri temizlenir', () => {
  const p = pazarlamaOku({ utm_source: 'a\u0000b\nc', utm_term: 'x'.repeat(1000), referrer: '', landing_url: 'javascript:alert(1)' });
  assert.equal(p.utmSource, 'a b c');
  assert.equal(p.utmTerm.length, 150);
  assert.equal('referrer' in p, false);
  assert.equal('landingUrl' in p, false);
});

test('pazarlamaOku: utm gövdede yoksa landing_url\'den okunur', () => {
  const p = pazarlamaOku({ landing_url: 'https://www.sembolevdeneve.com/fiyat-teklifi-al/?utm_source=chatgpt&utm_medium=cpc&utm_campaign=123&utm_content={ad_id}' });
  assert.equal(p.utmSource, 'chatgpt');
  assert.equal(p.utmMedium, 'cpc');
  assert.equal(p.utmCampaign, '123');
  assert.equal(p.utmContent, undefined);
});

test('karar: ödemeli reklam > tarayıcı > sunucu tahmini', () => {
  // tarayıcı Google Ads diyor, referrer ChatGPT → Google Ads korunur
  assert.equal(reklamKaynagiKarar('google_ads', { referrer: 'https://chatgpt.com/' }).reklamKaynagi, 'google_ads');
  // tarayıcı organik, sunucu UTM ile ChatGPT reklamı buldu → reklam kazanır
  assert.equal(reklamKaynagiKarar('chatgpt_organik', { utmSource: 'chatgpt', utmMedium: 'cpc' }).reklamKaynagi, 'chatgpt_ads');
  // tarayıcı gemini_organik, referrer ChatGPT → tarayıcı kazanır
  assert.equal(reklamKaynagiKarar('gemini_organik', { referrer: 'https://chatgpt.com/' }).reklamKaynagi, 'gemini_organik');
  // tarayıcı "bilmiyorum" (direkt/diğer site), referrer Claude → sunucu kazanır
  assert.equal(reklamKaynagiKarar('direkt_giris', { referrer: 'https://claude.ai/' }).reklamKaynagi, 'claude_organik');
  assert.equal(reklamKaynagiKarar('diger_site', { referrer: 'https://claude.ai/' }).reklamKaynagi, 'claude_organik');
  // tarayıcının AI değerleri artık geçerli
  for (const d of AI_KAYNAK_DEGERLERI) assert.equal(reklamKaynagiKarar(d, {}).reklamKaynagi, d);
  // hiçbir şey yok → mevcut davranış
  assert.equal(reklamKaynagiKarar(undefined, {}).reklamKaynagi, 'direkt_giris');
  assert.equal(reklamKaynagiKarar('bozuk_deger', {}).reklamKaynagi, 'direkt_giris');
  assert.equal(reklamKaynagiKarar('instagram_organik', {}).reklamKaynagi, 'instagram_organik');
});
