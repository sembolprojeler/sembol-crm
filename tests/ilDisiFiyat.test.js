// İl dışı / şehirlerarası evden eve — bot fiyatı (2026-10-07 hatası: "İstanbul dışı taşıma yapmıyoruz")
// Bot fiyatı gerçek kmRotaFiyat (mesafe-site) ile hesaplanır; yalnızca Google km'si sahte.
// Beklenen taban, CRM "Hızlı Fiyat Hesapla"nın km yolu (ttFiyatHesapla, şehirler arası dalı) ile
// AYNI sırada, CRM'in kullandığı ortak fonksiyonlarla bağımsız hesaplanır:
//   [şehir içi taban(oda)] + km kalemleri (+ Avrupa ekstrası, kademe aşılmadıysa) + toplama + adres ekleri
//   → mesafeFarklariEkle (uzun yol farkı, EN SON ev tipi km farkı)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sahteDb, sahteYanit } from './yardimci.js';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

process.env.FIRESTORE_APP_ID = 'test-app';
const F = await import('../api/_lib/fiyatHesap.js');
const { kmRotaFiyat } = await import('../api/mesafe-site.js');
const { fiyatEksikleriDoldur, mesafeKalemleri, mesafeFarklariEkle, MESAFE_VARSAYILAN } = await import('../src/fiyatSema.js');
const { handlerOlustur } = await import('../api/whatsapp-webhook.js');

const Y = (a, b, c, d, e) => ({ '1+0': a, '1+1': b, '2+1': c, '3+1': d, '4+1': e });
// Canlı Fiyat Tablosu'na benzer km ayarları
const BELGE = fiyatEksikleriDoldur({ mesafe: { ...MESAFE_VARSAYILAN, modu: 1, kmUcreti: 15,
  kademeler: [{ km: 200, yuzde: 10, ek: 0 }, { km: 400, yuzde: 15, ek: 0 }, { km: 800, yuzde: 40, ek: 0 }, { km: 1000, yuzde: 50, ek: 0 }, { km: 3000, yuzde: 200, ek: 0 }],
  gecis: { ...MESAFE_VARSAYILAN.gecis, kopruOsmangazi: 4805, otoyolAnadolu: 675, kopruYss: 270 },
  odaKademeleri: [{ km: 200, yuzde: Y(2, 5, 10, 15, 20) }, { km: 800, yuzde: Y(10, 25, 30, 40, 60) }, { km: 3000, yuzde: Y(50, 90, 110, 130, 150) }] } });
const M = BELGE.mesafe;

// Sahte Google: ilçe merkezi adresleri arası km ve geçişler
const ETAPLAR = {
  'Pendik|Bornova': [480, { kopruOsmangazi: 1, otoyolAnadolu: 1 }], 'Bornova|Kadıköy': [470, { kopruOsmangazi: 1 }], 'Kadıköy|Pendik': [25, {}],
  'Pendik|Kağızman': [1500, { otoyolAnadolu: 1 }], 'Kağızman|Malkara': [1700, { kopruYss: 1 }], 'Malkara|Pendik': [160, { kopruYss: 1 }],
  'Pendik|Çankaya': [450, { otoyolAnadolu: 1 }], 'Çankaya|Keçiören': [12, {}], 'Keçiören|Pendik': [455, { otoyolAnadolu: 1 }],
};
const ilce = (adres) => String(adres).split(',')[0].trim();
const sahteEtap = async (db, nereden, nereye, googleOncesi) => {
  const e = ETAPLAR[`${ilce(nereden)}|${ilce(nereye)}`];
  if (!e) throw new Error(`tanımsız etap ${nereden} → ${nereye}`);
  if (googleOncesi) await googleOncesi();
  return { nereden, nereye, km: e[0], dk: 0, gecisler: e[1] };
};
const kmHesapla = (a) => kmRotaFiyat({ ...a, etapGetir: sahteEtap });

async function dbHazirla() {
  const db = sahteDb();
  await db.collection('artifacts').doc('test-app').collection('public').doc('data').collection('ayarlar').doc('fiyatTablosu').set(BELGE);
  return db;
}
// CRM sırasıyla beklenen taban
function crmTaban({ taban, ekler, rota, odaK }) {
  const kalemler = [{ ad: 'taban', tutar: taban }, ...mesafeKalemleri(M, rota), ...ekler.map(t => ({ ad: 'ek', tutar: t }))];
  mesafeFarklariEkle(M, rota, kalemler, odaK);
  return kalemler.reduce((t, k) => t + k.tutar, 0);
}
const rotaOf = (anahtarlar) => {
  const gecisler = {};
  let km = 0;
  anahtarlar.forEach(a => { km += ETAPLAR[a][0]; Object.keys(ETAPLAR[a][1]).forEach(id => { gecisler[id] = (gecisler[id] || 0) + 1; }); });
  return { toplamKm: Math.round(km * 10) / 10, gecisler };
};
const aralik = (t) => ({ min: Math.round(t / 100) * 100, max: Math.ceil(t * 1.25 / 500) * 500 });

const ORNEKLER = [
  { ad: 'İzmir Bornova → İstanbul Kadıköy, 2+1 (iller arası, varış İstanbul)',
    alanlar: { homeSize: '2+1', fromCity: 'izmir', fromDistrict: 'bornova', fromFloor: '3', fromElevator: 'merdiven', fromYurume: 'yok',
      toCity: 'İstanbul', toDistrict: 'Kadıköy', toFloor: '2', toElevator: 'bina_asansoru', toYurume: 'yok', paketleme: 'firma' },
    // şehir içi taban 2+1 30.000 · şehirler arası ekler: toplama 2+1 9.000, merdiven 3. kat 2.500
    beklenen: () => crmTaban({ taban: 30000, ekler: [9000, 2500], rota: rotaOf(['Pendik|Bornova', 'Bornova|Kadıköy', 'Kadıköy|Pendik']), odaK: '2+1' }) },
  { ad: 'Kars Kağızman → Tekirdağ Malkara, 2+1 (İstanbul hiç yok)',
    alanlar: { homeSize: '2+1', fromCity: 'Kars', fromDistrict: 'Kağızman', fromFloor: '1', fromElevator: 'bina_asansoru', fromYurume: 'yok',
      toCity: 'Tekirdağ', toDistrict: 'Malkara', toFloor: '0', toElevator: 'merdiven', toYurume: 'yok', paketleme: 'hayir' },
    beklenen: () => crmTaban({ taban: 30000, ekler: [], rota: rotaOf(['Pendik|Kağızman', 'Kağızman|Malkara', 'Malkara|Pendik']), odaK: '2+1' }) },
  { ad: 'Ankara Çankaya → Ankara Keçiören, 3+1 (il dışı il içi)',
    alanlar: { homeSize: '3+1', fromCity: 'Ankara', fromDistrict: 'Çankaya', fromFloor: '4', fromElevator: 'merdiven', fromYurume: 'm50',
      toCity: 'ankara', toDistrict: 'keçiören', toFloor: '6', toElevator: 'dis_cephe', toYurume: 'yok', paketleme: 'firma' },
    // şehir içi taban 3+1 35.000 · şehirler arası ekler: toplama 11.000, merdiven 4. kat 4.500, yürüme 50 m 4.000,
    // dış cephe 6. kat (İstanbul dışı → Avrupa tarifesi) 5.000
    beklenen: () => crmTaban({ taban: 35000, ekler: [11000, 4500, 4000, 5000], rota: rotaOf(['Pendik|Çankaya', 'Çankaya|Keçiören', 'Keçiören|Pendik']), odaK: '3+1' }) },
];

for (const o of ORNEKLER) {
  test(`bot fiyatı = CRM km tabanı: ${o.ad}`, async () => {
    const r = await F.botFiyatHesapla({ db: await dbHazirla(), marka: 'sembol', alanlar: o.alanlar, kmHesapla, env: {} });
    assert.equal(r.durum, 'tamam');
    assert.equal(r.kaynak, 'km');
    assert.equal(r.taban, o.beklenen());
    assert.deepEqual({ min: r.min, max: r.max }, aralik(o.beklenen()));
  });
}

test('il/ilçe bulunamazsa ret değil "eksik" — bot tekrar sorar', async () => {
  const r = await F.botFiyatHesapla({ db: await dbHazirla(), marka: 'sembol', alanlar: { ...ORNEKLER[0].alanlar, fromDistrict: 'Olmayanilçe' }, kmHesapla });
  assert.equal(r.durum, 'eksik');
  assert.deepEqual(r.konumHatalari, ['fromCity']);
});

// ---------------------------------------------------------------- webhook: ret cümlesi gitmez
const SECRET = 's';
const WA = '905321234567';
function ortam(aiCevaplari) {
  const db = sahteDb();
  const gonderilen = [], ai = [], arka = [];
  const fetchFn = async (url, ops) => { gonderilen.push(JSON.parse(ops.body)); return { ok: true, status: 200, json: async () => ({ messages: [{ id: `out${gonderilen.length}` }] }) }; };
  const handler = handlerOlustur({ getDb: () => db, waitUntil: (p) => arka.push(p), fetchFn, bekle: async () => {}, simdi: () => Date.parse('2026-10-07T08:00:00Z'),
    // 0850 artık yalnızca DepoEvim — Sembol fiyatı ileride gelecek Sembol hattında (talimatlar kodda kalır)
    env: { WHATSAPP_APP_SECRET: SECRET, WHATSAPP_TOKEN: 't', WHATSAPP_NUMARALAR: JSON.stringify({ 111: 'sembolevdeneve' }), FIRESTORE_APP_ID: 'test-app', WHATSAPP_BIRLESTIRME_MS: '0' },
    aiUret: async (a) => { ai.push(a); return aiCevaplari[Math.min(ai.length - 1, aiCevaplari.length - 1)]; },
    fiyatHesapla: async (a) => F.botFiyatHesapla({ ...a, kmHesapla }) });
  const gonder = async (metin, id) => {
    const ham = Buffer.from(JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '111' }, messages: [{ from: WA, id, timestamp: '1791360000', type: 'text', text: { body: metin } }] } }] }] }));
    const req = { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', SECRET).update(ham).digest('hex') }, async *[Symbol.asyncIterator]() { yield ham; } };
    await handler(req, sahteYanit());
    while (arka.length) await arka.shift();
  };
  return { db, gonderilen, ai, gonder, dbHazir: db.collection('artifacts').doc('test-app').collection('public').doc('data').collection('ayarlar').doc('fiyatTablosu').set(BELGE) };
}
const tamam = (o) => ({ ok: true, cikti: { reply: '', collected: {}, handoff: false, handoffReason: '', intent: 'sehirlerarasi', marka: 'sembol', ...o } });
const RET = /dışı|yapmıyoruz|yapamıyoruz|vermiyoruz/i;

test('webhook: yapay zeka İzmir için ret cümlesi kursa da müşteriye sistem fiyatı gider', async () => {
  const o = ortam([
    tamam({ reply: 'Maalesef İstanbul dışı taşıma yapmıyoruz.', collected: ORNEKLER[0].alanlar }),
    tamam({ reply: 'İzmir\'den taşıma yapamıyoruz.' }),        // fiyatlı ikinci tur — yine ret
    tamam({ reply: 'Üzgünüz, bu bölgeye hizmet vermiyoruz.' }), // düzeltme denemesi — yine ret
  ]);
  await o.dbHazir;
  await o.gonder('İzmir', 'w1');
  const govde = o.gonderilen[0].text.body;
  const { min, max } = aralik(ORNEKLER[0].beklenen());
  assert.match(govde, new RegExp(`${min.toLocaleString('tr-TR').replace('.', '\\.')} TL – ${max.toLocaleString('tr-TR').replace('.', '\\.')} TL`));
  assert.doesNotMatch(govde, RET);
  assert.match(o.ai[2].sistem, /DÜZELTME: Bir önceki taslak cevabın/);
  const k = o.db.belge(`whatsapp_conversations/111_${WA}`);
  assert.equal(k.sonFiyatDurumu.durum, 'tamam'); assert.equal(k.sonFiyatDurumu.kaynak, 'km');
  assert.notEqual(k.mode, 'human');
});

test('webhook: fiyat eksikken ret cümlesi yerine "81 il" + eksik bilginin sorusu (devretmez)', async () => {
  const o = ortam([tamam({ reply: 'İstanbul dışına hizmet vermiyoruz maalesef.', collected: { homeSize: '2+1', fromCity: 'İzmir' } })]);
  await o.dbHazir;
  await o.gonder('İzmir\'den taşınacağım', 'w1');
  const govde = o.gonderilen[0].text.body;
  assert.match(govde, /Türkiye'nin 81 ilinde il içi ve iller arası taşıma yapıyoruz\. Eşyalar hangi ilçeden alınacak\?/);
  assert.doesNotMatch(govde, /vermiyoruz/);
  assert.notEqual(o.db.belge(`whatsapp_conversations/111_${WA}`).mode, 'human');
});

test('webhook: yapay zeka ret etmezse cevap aynen gider (düzeltme çağrısı yapılmaz)', async () => {
  const o = ortam([tamam({ reply: 'İzmir\'den taşıma yapıyoruz. Hangi ilçeden alınacak?', collected: { homeSize: '2+1', fromCity: 'İzmir' } })]);
  await o.dbHazir;
  await o.gonder('İzmir', 'w1');
  assert.match(o.gonderilen[0].text.body, /İzmir'den taşıma yapıyoruz\. Hangi ilçeden alınacak\?$/);
  assert.equal(o.ai.length, 1);
});
