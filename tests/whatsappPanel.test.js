// src/whatsappPanel.js — CRM WhatsApp panelinin saf mantığı
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pencereAcikMi, pencereKalan, konusmalariSuz, mesajGorunumu, durumBilgisi, dikkatSayisi, sekmeBasligi, bekleyenSayisi, botLeadKonusmaId, listeSaati, PENCERE_MS } from '../src/whatsappPanel.js';

const SIMDI = Date.parse('2026-10-07T12:00:00Z');

test('24 saat penceresi: müşterinin son mesajından itibaren', () => {
  assert.equal(pencereAcikMi({ lastCustomerMessageAt: new Date(SIMDI - 3600000).toISOString() }, SIMDI), true);
  assert.equal(pencereAcikMi({ lastCustomerMessageAt: new Date(SIMDI - PENCERE_MS - 1).toISOString() }, SIMDI), false);
  assert.equal(pencereAcikMi({}, SIMDI), false);
  assert.equal(pencereKalan({ lastCustomerMessageAt: new Date(SIMDI - 3600000).toISOString() }, SIMDI), '23 sa 0 dk');
  assert.equal(pencereKalan({ lastCustomerMessageAt: new Date(SIMDI - PENCERE_MS + 5 * 60000).toISOString() }, SIMDI), '5 dk');
});

test('liste: personel bekleyenler üstte, sonra en yeni; marka / mod / arama filtresi', () => {
  const liste = [
    { id: 'a', waId: '905001112233', profileName: 'Ayşe', lastMessageAt: '2026-10-07T10:00:00Z', mode: 'bot', marka: 'depoevim' },
    { id: 'b', waId: '905004445566', profileName: 'Bora', lastMessageAt: '2026-10-07T09:00:00Z', mode: 'human', needsAgent: true },
    { id: 'c', waId: '905007778899', profileName: 'Cem', lastMessageAt: '2026-10-07T11:00:00Z', mode: 'bot', marka: 'sembol' },
  ];
  assert.deepEqual(konusmalariSuz(liste).map(k => k.id), ['b', 'c', 'a']);
  assert.deepEqual(konusmalariSuz(liste, { marka: 'depoevim' }).map(k => k.id), ['b', 'a']);   // marka yok = 0850 DepoEvim
  assert.deepEqual(konusmalariSuz(liste, { mod: 'human' }).map(k => k.id), ['b']);
  assert.deepEqual(konusmalariSuz(liste, { mod: 'bekleyen' }).map(k => k.id), ['b']);
  assert.deepEqual(konusmalariSuz(liste, { arama: 'cem' }).map(k => k.id), ['c']);
  assert.deepEqual(konusmalariSuz(liste, { arama: '0500 444' }).map(k => k.id), ['b']);   // yerel biçim de bulur
  assert.deepEqual(konusmalariSuz(liste, { arama: '0599 123' }).map(k => k.id), []);
  assert.deepEqual(konusmalariSuz(liste, { arama: '4445566' }).map(k => k.id), ['b']);
  assert.equal(bekleyenSayisi(liste), 1);
});

test('mesaj görünümü: müşteri / bot / personel ayrı; medya etiketli; konumda harita linki', () => {
  assert.deepEqual(mesajGorunumu({ from: 'customer', type: 'text', text: 'Merhaba' }), { kimden: 'musteri', metin: 'Merhaba', harita: null, ad: '', medya: false, otomatik: false });
  assert.equal(mesajGorunumu({ from: 'bot', agentName: 'DepoEvim Asistanı', text: 'x' }).ad, 'DepoEvim Asistanı');
  assert.equal(mesajGorunumu({ from: 'agent', agentName: 'Ayşe', text: 'x' }).kimden, 'personel');
  // webhook "[görsel] açıklama" yazar → çift etiket olmaz
  assert.equal(mesajGorunumu({ from: 'customer', type: 'image', text: '[görsel] salon' }).metin, '[görsel] salon');
  assert.equal(mesajGorunumu({ from: 'customer', type: 'audio', text: '' }).metin, '[sesli mesaj]');
  assert.equal(mesajGorunumu({ from: 'customer', type: 'document', text: '[belge] sozlesme.pdf' }).metin, '[belge] sozlesme.pdf');
  const konum = mesajGorunumu({ from: 'customer', type: 'location', text: '[konum: Kadıköy (40.99, 29.03)]', konum: { lat: 40.99, lng: 29.03 } });
  assert.equal(konum.harita, 'https://www.google.com/maps?q=40.99,29.03');
  assert.equal(konum.medya, true);
});

test('gönderim durumu simgeleri; müşteri mesajında durum yok', () => {
  assert.equal(durumBilgisi({ from: 'customer', direction: 'in' }), null);
  assert.equal(durumBilgisi({ direction: 'out', status: 'read' }).baslik, 'Okundu');
  assert.equal(durumBilgisi({ direction: 'out', status: 'delivered' }).simge, '✓✓');
  assert.match(durumBilgisi({ direction: 'out', status: 'failed', hata: { mesaj: 'Re-engagement' } }).baslik, /Gönderilemedi: Re-engagement/);
});

test('sekme başlığı: okunmamış ya da personel bekleyen konuşma sayısı', () => {
  const liste = [{ unreadCount: 2 }, { needsAgent: true, unreadCount: 0 }, { unreadCount: 0 }, { unreadCount: 1, needsAgent: true }];
  assert.equal(dikkatSayisi(liste), 3);
  assert.equal(sekmeBasligi(3), '(3) WhatsApp – CRM');
  assert.equal(sekmeBasligi(0), 'WhatsApp – CRM');
});

test('lead → sohbet: yalnızca bot hattından gelen lead\'ler (yeni: konusmaId, eski: waId)', () => {
  assert.equal(botLeadKonusmaId({ kayitTipi: 'whatsapp-bot', whatsapp: { waId: '905', konusmaId: '222_905' } }), '222_905');
  assert.equal(botLeadKonusmaId({ kayitTipi: 'whatsapp-bot', whatsapp: { waId: '905' } }), '905');
  assert.equal(botLeadKonusmaId({ kayitTipi: 'site', kanal: 'whatsapp', iletisim: '0532' }), null);
  assert.equal(botLeadKonusmaId(null), null);
});

test('liste saati: bugün saat, dün "Dün", eski tarih', () => {
  assert.equal(listeSaati('2026-10-07T08:05:00Z', SIMDI), '11:05');
  assert.equal(listeSaati('2026-10-06T08:05:00Z', SIMDI), 'Dün');
  assert.equal(listeSaati('2026-10-01T08:05:00Z', SIMDI), '01.10');
  assert.equal(listeSaati('', SIMDI), '');
});

test('panel yetkisi tarayıcıda da sunucuyla aynı kural (crmYetki.altSatisErisimi)', async () => {
  const { whatsappErisimi } = await import('../src/whatsappPanel.js');
  const { altSatisErisimi } = await import('../api/_lib/crmYetki.js');
  const pm = { 'Satış Temsilcisi': { addJob: true }, Müdür: { addJob: true, satisWhatsapp: false }, 'Şoför': {} };
  const kisiler = [
    { position: 'Satış Temsilcisi' }, { position: 'Satış Temsilcisi', rank: 'Müdür' }, { position: 'Şoför' },
    { position: 'Firma Sahibi' }, { fullName: 'Sistem Yöneticisi' }, { position: 'Satış Temsilcisi', employmentStatus: 'Pasif' },
    { position: 'Satış Temsilcisi', permissions: { modules: { satisWhatsapp: false } } }, { position: 'Şoför', permissions: { modules: { addJob: true } } },
  ];
  for (const k of kisiler) assert.equal(whatsappErisimi(k, pm), altSatisErisimi(k, pm, 'satisWhatsapp'), JSON.stringify(k));
  assert.equal(whatsappErisimi(null, pm), false);
});
