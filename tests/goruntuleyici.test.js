// Görsel görüntüleyici (App.jsx viewingImage) + WhatsApp paneli çağrı biçimi + panel hata sınırı
// 2026-10-07 hatası: panel setViewingImage(url) çağırıyordu; görüntüleyici viewingImage.name.startsWith('http')
// yaptığı için "Cannot read properties of undefined (reading 'startsWith')" ile tüm CRM düşüyordu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidElement } from 'react';
import { goruntuleyiciBilgisi } from '../src/goruntuleyici.js';
import { gorselGoruntuleyiciIstegi } from '../src/whatsappPanel.js';
import { WhatsAppHataSiniri, PANEL_HATA_METNI } from '../src/whatsappHataSiniri.js';

const URL = 'https://www.sembolevdeneve.com/crm/uploads/wa_0123456789abcdef0123456789abcdef.jpg';

test('görüntüleyici: diğer ekranların { title, name } girdisi için davranış aynı', () => {
  assert.deepEqual(goruntuleyiciBilgisi({ title: 'Hasar Fotoğrafı', name: URL }), { baslik: 'Hasar Fotoğrafı', adres: URL, http: true });
  // http olmayan ad (eski kayıtlarda dosya adı) → önizleme yerine simge, eskisi gibi
  assert.deepEqual(goruntuleyiciBilgisi({ title: 'Belge', name: 'dekont.jpg' }), { baslik: 'Belge', adres: 'dekont.jpg', http: false });
});

test('görüntüleyici: name eksik / dize değil / düz URL → ÇÖKMEZ', () => {
  assert.doesNotThrow(() => goruntuleyiciBilgisi({ title: 'x' }));
  assert.equal(goruntuleyiciBilgisi({ title: 'x' }).http, false);
  assert.equal(goruntuleyiciBilgisi({ name: 42 }).adres, '');
  assert.equal(goruntuleyiciBilgisi({ name: null }).http, false);
  // eski panel çağrısı (düz URL dizesi) — artık çökmeden açılır
  assert.deepEqual(goruntuleyiciBilgisi(URL), { baslik: '', adres: URL, http: true });
});

test('WhatsApp paneli görüntüleyiciyi diğer ekranlarla AYNI biçimde ({ title, name }) çağırır', () => {
  const istek = gorselGoruntuleyiciIstegi({ url: URL, caption: 'salon eşyaları' });
  assert.deepEqual(Object.keys(istek).sort(), ['name', 'title']);
  assert.equal(istek.name, URL);
  assert.equal(istek.title, 'WhatsApp görseli — salon eşyaları');
  assert.equal(gorselGoruntuleyiciIstegi({ url: URL }).title, 'WhatsApp görseli');
  // hatanın çıktığı yol: görüntüleyici bu girdiyi okur → önizleme açılır
  const gv = goruntuleyiciBilgisi(istek);
  assert.equal(gv.http, true); assert.equal(gv.adres, URL);
  // url'siz medya bile çökmez
  assert.equal(goruntuleyiciBilgisi(gorselGoruntuleyiciIstegi({})).http, false);
});

test('panel hata sınırı: hata yoksa paneli çizer; hata olunca yalnızca panel yerine uyarı (CRM düşmez)', () => {
  const cocuk = { type: 'div', props: {} };
  const s = new WhatsAppHataSiniri({ children: cocuk });
  assert.equal(s.render(), cocuk);
  const hata = new TypeError("Cannot read properties of undefined (reading 'startsWith')");
  s.state = { ...s.state, ...WhatsAppHataSiniri.getDerivedStateFromError(hata) };
  const el = s.render();
  assert.ok(isValidElement(el));
  assert.equal(el.props.role, 'alert');
  const metinler = [];
  const topla = (x) => { if (typeof x === 'string') metinler.push(x); else if (Array.isArray(x)) x.forEach(topla); else if (x?.props) topla(x.props.children); };
  topla(el);
  assert.ok(metinler.includes(PANEL_HATA_METNI));
  assert.equal(PANEL_HATA_METNI, 'Bir hata oluştu, sayfayı yenileyin');
  assert.ok(metinler.some(t => t.includes('startsWith')));
  // componentDidCatch konsola yazar, fırlatmaz
  const eski = console.error; const yazilan = [];
  console.error = (...a) => yazilan.push(a);
  try { s.componentDidCatch(hata, { componentStack: '\n    at MedyaIcerik' }); } finally { console.error = eski; }
  assert.equal(yazilan.length, 1);
});
