// site-kodlari/*-tiklama-takip-ref.js — WhatsApp butonu: numara config'den + "(Ref: SB/DE-XXXXXX)" + CRM'e refKodu
// Tarayıcı yok: script sahte window / document ile vm içinde çalıştırılır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { refKoduBul, refKoduTemizle } from '../api/_lib/lead.js';

function calistir(dosya) {
  const dinleyiciler = [], beacon = [];
  const depo = {};
  const document = { referrer: '', addEventListener: (tur, fn) => { if (tur === 'click') dinleyiciler.push(fn); } };
  class Blob { constructor(p) { this.metin = p.join(''); } }
  const window = {
    crypto: globalThis.crypto, fetch: async () => ({}),
    location: { href: 'https://www.ornek.com/fiyat/?utm_source=google&utm_medium=cpc', search: '?utm_source=google&utm_medium=cpc', pathname: '/fiyat/', hostname: 'www.ornek.com' },
  };
  const ctx = {
    window, document, location: window.location, URL, URLSearchParams, Blob, console, Date, JSON, Math, Uint8Array,
    navigator: { sendBeacon: (_u, b) => { beacon.push(JSON.parse(b.metin)); return true; } },
    localStorage: { getItem: (k) => depo[k] ?? null, setItem: (k, v) => { depo[k] = String(v); }, removeItem: (k) => { delete depo[k]; } },
    fetch: async () => ({}), setTimeout, clearTimeout,
  };
  ctx.globalThis = ctx;
  window.document = document; window.navigator = ctx.navigator; window.localStorage = ctx.localStorage;
  vm.runInNewContext(fs.readFileSync(new URL(`../site-kodlari/${dosya}`, import.meta.url), 'utf8'), ctx);
  const tikla = (href) => {
    const link = { href, getAttribute: (a) => (a === 'href' ? link.href : null), setAttribute: (a, v) => { if (a === 'href') link.href = v; } };
    const e = { target: { closest: (sec) => (sec === 'a' || (/wa\.me|whatsapp/.test(sec) && /wa\.me|whatsapp/.test(href)) || (/tel:/.test(sec) && href.startsWith('tel:')) ? link : null) } };
    dinleyiciler.forEach(fn => fn(e));
    return link.href;
  };
  return { tikla, beacon };
}

const metniAl = (href) => new URL(href).searchParams.get('text');

test('Sembol sitesi: her WhatsApp butonu 0216 390 89 99\'a gider, mesaja SB ref eklenir, aynı kod CRM\'e gider', () => {
  const s = calistir('sembol-tiklama-takip-ref.js');
  const yeni = s.tikla('https://wa.me/908504417886?text=Merhaba%2C%20ta%C5%9F%C4%B1nma%20fiyat%C4%B1');
  assert.match(yeni, /^https:\/\/wa\.me\/902163908999\?text=/);
  const metin = metniAl(yeni);
  const ref = refKoduBul(metin);
  assert.equal(ref.marka, 'sembol'); assert.match(ref.kod, /^SB-[A-Z0-9]{6}$/);
  assert.equal(refKoduTemizle(metin), 'Merhaba, taşınma fiyatı');               // bot ref'i görmez
  assert.equal(s.beacon.length, 1);
  assert.equal(s.beacon[0].refKodu, ref.kod); assert.equal(s.beacon[0].site, 'sembolevdeneve');
  assert.equal(s.beacon[0].islem, 'WhatsApp Mesajı'); assert.equal(s.beacon[0].detay, yeni);
  assert.match(s.beacon[0].refKodu, /^(SB|DE)-[A-Z0-9]{4,10}$/);                 // api/yeni-musteri.js deseni
  // ikinci tıklama: eski ref silinir, yeni ref; metinsiz buton → varsayılan mesaj
  const ikinci = s.tikla(yeni);
  assert.equal((metniAl(ikinci).match(/Ref:/g) || []).length, 1);
  assert.notEqual(refKoduBul(metniAl(ikinci)).kod, ref.kod);
  assert.match(metniAl(s.tikla('https://api.whatsapp.com/send?phone=905000000000')), /^Merhaba, bilgi almak istiyorum\. \(Ref: SB-/);
  // telefon bağlantısı değişmez, ref gönderilmez
  s.tikla('tel:+902163908999');
  assert.equal(s.beacon.at(-1).islem, 'Telefon Araması'); assert.equal(s.beacon.at(-1).refKodu, undefined);
});

test('DepoEvim sitesi: WhatsApp butonları (sihirbazdaki 0545 dahil) 0850 441 78 86\'ya gider, DE ref', () => {
  const s = calistir('depoevim-tiklama-takip-ref.js');
  const yeni = s.tikla('https://wa.me/905452408461?text=1%2B1%20depo%20fiyat%C4%B1');
  assert.match(yeni, /^https:\/\/wa\.me\/908504417886\?text=/);
  const ref = refKoduBul(metniAl(yeni));
  assert.equal(ref.marka, 'depoevim'); assert.match(ref.kod, /^DE-[A-Z0-9]{6}$/);
  assert.equal(refKoduTemizle(metniAl(yeni)), '1+1 depo fiyatı');
  assert.equal(s.beacon[0].refKodu, ref.kod); assert.equal(s.beacon[0].site, 'depoevim');
  assert.match(s.beacon[0].islem, /WhatsApp/);
  s.tikla('tel:+908504417886');
  assert.equal(s.beacon.at(-1).refKodu, undefined); assert.match(s.beacon.at(-1).islem, /Telefon/);
});

test('site script\'lerinde numara yalnızca config satırında (başka sabit numara yok)', () => {
  for (const [dosya, no] of [['sembol-tiklama-takip-ref.js', '902163908999'], ['depoevim-tiklama-takip-ref.js', '908504417886']]) {
    const k = fs.readFileSync(new URL(`../site-kodlari/${dosya}`, import.meta.url), 'utf8');
    assert.equal(k.split(`whatsappNumarasi: "${no}"`).length, 2);
    assert.ok(!/wa\.me\/\d/.test(k), 'wa.me linkinde sabit numara yok');
  }
});
