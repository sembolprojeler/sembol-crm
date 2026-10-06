// api/_lib/fiyatHesap.js — WhatsApp botu fiyat hesabı (sitedeki sihirbazlarla birebir)
// Beklenen değerler, sihirbazların canlı kodu aynı /api/fiyatlar yanıtıyla çalıştırılarak
// doğrulandı (6.000 rastgele senaryoda 0 fark — referans/*-canli-2026-10-06.js).
// tests/fixtures/fiyatlar-*.json: 6 Ekim 2026 tarihli /api/fiyatlar yanıtları.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sahteDb } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const F = await import('../api/_lib/fiyatHesap.js');
const { fiyatEksikleriDoldur } = await import('../src/fiyatSema.js');
const oku = (ad) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${ad}`, import.meta.url), 'utf8'));
const JS = oku('fiyatlar-sembol.json');
const JD = oku('fiyatlar-depoevim.json');

const SEMBOL = { homeSize: '3+1', fromCity: 'İstanbul (Avrupa)', fromDistrict: 'Bağcılar', fromFloor: '5', fromElevator: 'merdiven', fromYurume: 'm50',
  toCity: 'Ankara', toDistrict: 'Çankaya', toFloor: '11', toElevator: 'dis_cephe', toYurume: 'yok', paketleme: 'firma' };
const DEPO = { depoBoyutu: '22', kiralamaSuresi: '6', sube: 'pendik', teslimSekli: 'anahtar_teslim', pickupCity: 'İstanbul (Anadolu)', pickupDistrict: 'Kadıköy',
  pickupFloor: '4', pickupElevator: 'merdiven', paketleme: 'firma', pickupYurume: 'yok' };

test('Sembol km gövdesi: araToplam = şehir içi taban + CRM kurallı ek hizmetler; Avrupa ekstrası ayrı', () => {
  const T = F.sembolTablolari(JS);
  // 35.000 taban + 11.000 toplama (şehirler arası) + 6.500 merdiven 5. kat + 4.000 yürüme 50 m + 7.500 dış cephe 11. kat (Ankara → Avrupa 9-13)
  assert.deepEqual(F.sembolKmGovdesi(T, SEMBOL), { yukIl: 'İstanbul (Avrupa)', yukIlce: 'Bağcılar', bosIl: 'Ankara', bosIlce: 'Çankaya',
    hesap: { odaK: '3+1', araToplam: 64000, avrupaEkstra: 11000 } });
});

test('Sembol km\'siz (81 il) yedek hesap ve aralık gösterimi', () => {
  const T = F.sembolTablolari(JS);
  const t = F.sembolKmsizToplam(T, SEMBOL);
  assert.equal(t, 126000);
  assert.deepEqual(F.sembolAralik(T, t), { min: 126000, max: 157500 });
  assert.deepEqual(F.sembolAralik(T, 51082), { min: 51100, max: 64000 }); // alt 100'e, üst %25 + 500'e yukarı
});

test('5+1 / villa → 4+1, ofis → 3+1, çarpan yok', () => {
  const T = F.sembolTablolari(JS);
  const s = { ...SEMBOL, toCity: 'İstanbul (Anadolu)', toDistrict: 'Kadıköy' };
  assert.equal(F.sembolKmGovdesi(T, { ...s, homeSize: 'villa' }).hesap.odaK, '4+1');
  assert.equal(F.sembolKmsizToplam(T, { ...s, homeSize: '5+1' }), F.sembolKmsizToplam(T, { ...s, homeSize: '4+1' }));
});

test('DepoEvim: şube kirası (Pendik satırı), peşin kampanya, km\'siz nakliye ve km gövdesi', () => {
  const T = F.depoevimTablolari(JD);
  assert.deepEqual(F.depoevimKira(T, DEPO), { aylik: 7500, toplam: 37500, sureAy: 6, ucretsizAy: 1, odenecekAy: 5 });
  assert.deepEqual(F.depoevimNakliye(T, DEPO), { min: 34000, max: 42500, avrupaEkstra: 0 });
  assert.deepEqual(F.depoevimKmGovdesi(T, DEPO), { yukIl: 'İstanbul (Anadolu)', yukIlce: 'Kadıköy', sube: 'pendik', hesap: { odaK: '2+1', araToplam: 34000, avrupaEkstra: 0 } });
  // Başakşehir şubesi → Avrupa ekstrası; km sonucu taban olur (yuvarlanmaz), ekstra yalnızca uygulandıysa
  const bas = { ...DEPO, sube: 'basaksehir' };
  assert.equal(F.depoevimKmGovdesi(T, bas).hesap.avrupaEkstra, 6000);
  assert.deepEqual(F.depoevimNakliye(T, bas, { taban: 40123, avr: true, avrupaEkstra: 6000 }), { min: 40123, max: 50500, avrupaEkstra: 6000 });
  assert.equal(F.depoevimNakliye(T, { ...DEPO, teslimSekli: 'kendim' }), null);
});

test('konum: müşterinin yazdığı il/ilçe sihirbaz adlarına çevrilir', () => {
  assert.deepEqual(F.konumNormalize('istanbul', 'kadikoy'), { il: 'İstanbul (Anadolu)', ilce: 'Kadıköy' });
  assert.deepEqual(F.konumNormalize('İstanbul', 'Bağcılar'), { il: 'İstanbul (Avrupa)', ilce: 'Bağcılar' });
  assert.deepEqual(F.konumNormalize('bursa', 'inegol'), { il: 'Bursa', ilce: 'İnegöl' });
  assert.equal(F.konumNormalize('Bursa', 'Kadıköy'), null);
  assert.equal(F.konumNormalize('İstanbul', ''), null); // yaka belli değil → bot ilçeyi sorar
});

// ---------------------------------------------------------------- botFiyatHesapla (sahte Firestore + sahte km)
async function dbHazirla(modu) {
  const db = sahteDb();
  const belge = fiyatEksikleriDoldur({});
  belge.mesafe.modu = modu;
  await db.collection('artifacts').doc('test-app').collection('public').doc('data').collection('ayarlar').doc('fiyatTablosu').set(belge);
  return db;
}

test('bot: ofis → fiyat yok; eksik alanlar listelenir', async () => {
  const db = await dbHazirla(1);
  assert.deepEqual(await F.botFiyatHesapla({ db, marka: 'sembol', alanlar: { ...SEMBOL, homeSize: 'ofis' } }), { durum: 'fiyat_yok', sebep: 'ofis' });
  const r = await F.botFiyatHesapla({ db, marka: 'sembol', alanlar: { homeSize: '2+1', fromCity: 'İstanbul', fromDistrict: 'Kadıköy' } });
  assert.equal(r.durum, 'eksik');
  assert.ok(r.eksik.includes('toCity') && r.eksik.includes('paketleme'));
});

test('bot: km modu açıkken mesafe-site fonksiyonu çağrılır (gövde sihirbazınkiyle aynı), sonuç aralığa çevrilir', async () => {
  const db = await dbHazirla(1);
  const cagrilar = [];
  const kmHesapla = async (a) => { cagrilar.push(a); return { toplamKm: 375.5, fiyat: { tabanFiyat: 51082, avrupaEkstraUygulandi: false } }; };
  const alanlar = { ...SEMBOL, fromCity: 'istanbul', fromDistrict: 'kadıköy', toCity: 'Bursa', toDistrict: 'İnegöl', toFloor: '2', toElevator: 'bina_asansoru' };
  const r = await F.botFiyatHesapla({ db, marka: 'sembol', alanlar, kmHesapla });
  assert.equal(cagrilar.length, 1);
  assert.equal(cagrilar[0].yuk, 'Kadıköy, İstanbul, Türkiye');
  assert.equal(typeof cagrilar[0].googleOncesi, 'function'); // botun kendi Google sayacı
  assert.deepEqual(r, { durum: 'tamam', marka: 'sembol', min: 51100, max: 64000, taban: 51082, kaynak: 'km', toplamKm: 375.5 });
  assert.deepEqual(F.leadFiyati(r), { min: 51100, max: 64000 });
});

test('bot: km hatası / km modu kapalı → sihirbazın km\'siz hesabı', async () => {
  const hatali = async () => { throw new Error('Google'); };
  const r1 = await F.botFiyatHesapla({ db: await dbHazirla(1), marka: 'sembol', alanlar: SEMBOL, kmHesapla: hatali });
  assert.equal(r1.kaynak, 'tablo');
  let cagrildi = false;
  const r2 = await F.botFiyatHesapla({ db: await dbHazirla(0), marka: 'sembol', alanlar: SEMBOL, kmHesapla: async () => { cagrildi = true; } });
  assert.equal(r2.kaynak, 'tablo');
  assert.equal(cagrildi, false);
});

test('bot DepoEvim: kira KDV hariç; alım bilgisi eksikse nakliye yok ama kira var', async () => {
  const db = await dbHazirla(1);
  const r = await F.botFiyatHesapla({ db, marka: 'depoevim', alanlar: { depoBoyutu: '15', kiralamaSuresi: '12', sube: 'kartal', teslimSekli: 'anahtar_teslim', pickupCity: 'Kocaeli' },
    kmHesapla: async () => ({ toplamKm: 120, fiyat: { tabanFiyat: 30000, avrupaEkstraUygulandi: false } }) });
  assert.equal(r.durum, 'tamam');
  assert.equal(r.kdvHaric, true);
  assert.equal(r.kira.odenecekAy, 10);
  assert.equal(r.nakliye, null);
  assert.ok(r.nakliyeEksik.includes('pickupDistrict'));
});
