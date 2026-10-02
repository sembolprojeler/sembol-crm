// Geriye dönük yeniden sınıflandırma betiğinin karar fonksiyonu
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yenidenSiniflandir } from '../scripts/ai-kaynak-yeniden-siniflandir.mjs';

test('Diğer Site + chatgpt.com → chatgpt_organik', () => {
  assert.deepEqual(yenidenSiniflandir({ reklamKaynagi: 'diger_site', digerSiteAdi: 'chatgpt.com' }), { yeni: 'chatgpt_organik', karar: 'sunucu_referrer' });
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'direkt_giris', digerSiteAdi: 'https://www.perplexity.ai/' }).yeni, 'perplexity_organik');
});

test('iniş adresindeki UTM ile reklam bulunur', () => {
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'direkt_giris', sayfaUrl: 'https://www.sembolevdeneve.com/fiyat-teklifi-al/?utm_source=chatgpt&utm_medium=cpc' }).yeni, 'chatgpt_ads');
});

test('dokunulmayanlar: QR, ödemeli reklam, zaten AI, eşleşmeyen', () => {
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'qr', digerSiteAdi: 'chatgpt.com' }), null);
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'diger_site', qrKampanyaId: 'x', digerSiteAdi: 'chatgpt.com' }), null);
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'google_ads', digerSiteAdi: 'chatgpt.com' }), null);
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'gemini_organik', digerSiteAdi: 'chatgpt.com' }), null);
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'diger_site', digerSiteAdi: 'x.com' }), null);
  assert.equal(yenidenSiniflandir({ reklamKaynagi: 'google_anasayfa' }), null);
});

test('reklamKaynagi alanı olmayan eski kayıt da sınıflandırılır', () => {
  assert.equal(yenidenSiniflandir({ digerSiteAdi: 'claude.ai' }).yeni, 'claude_organik');
});
