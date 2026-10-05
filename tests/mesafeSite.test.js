// api/mesafe-site.js — sitenin herkese açık km ucu (sahte Firestore, Google'a gidilmez)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur, siteNoktasi } = await import('../api/mesafe-site.js');

const SITE = 'https://www.sembolevdeneve.com';
const GOVDE = { yukIl: 'İstanbul (Anadolu)', yukIlce: 'Kadıköy', bosIl: 'Bursa', bosIlce: 'İnegöl' };

// Km modu açık/kapalı Fiyat Tablosu belgesiyle sahte db
async function dbHazirla(mesafe = { modu: 1, cikisAdresi: 'Pendik, İstanbul, Türkiye' }) {
  const db = sahteDb();
  await db.collection('artifacts').doc('test-app').collection('public').doc('data').collection('ayarlar').doc('fiyatTablosu').set({ mesafe });
  return db;
}
// Sahte etap: her çağrıda "Google'a gidiyormuş" gibi googleOncesi'ni çağırır
function sahteEtap(kayit = []) {
  return async (db, nereden, nereye, googleOncesi) => {
    kayit.push([nereden, nereye]);
    if (googleOncesi) await googleOncesi();
    return { nereden, nereye, km: 100, dk: 60, gecisler: nereye.startsWith('İnegöl') ? { kopruOsmangazi: 1 } : {}, onbellek: false };
  };
}
async function iste({ db, body = GOVDE, origin = SITE, ip = '1.2.3.4', env = {}, etap = sahteEtap(), method = 'POST', simdi } = {}) {
  const handler = handlerOlustur({ getDb: () => db, etapGetir: etap, env: { GOOGLE_MAPS_API_KEY: 'x', ...env }, ...(simdi ? { simdi } : {}) });
  const res = sahteYanit();
  await handler({ method, headers: { ...(origin ? { origin } : {}), 'x-forwarded-for': ip }, body }, res);
  return res;
}

test('4 nokta: hareket merkezi → yükleme ilçe merkezi → boşaltma ilçe merkezi → hareket merkezi', async () => {
  const kayit = [];
  const res = await iste({ db: await dbHazirla(), etap: sahteEtap(kayit) });
  assert.equal(res.kod, 200, JSON.stringify(res.govde));
  assert.deepEqual(res.govde.noktalar, ['Pendik, İstanbul, Türkiye', 'Kadıköy, İstanbul, Türkiye', 'İnegöl, Bursa, Türkiye', 'Pendik, İstanbul, Türkiye']);
  assert.equal(kayit.length, 3);
  assert.equal(res.govde.toplamKm, 300);
  assert.deepEqual(res.govde.gecisler, { kopruOsmangazi: 1 });
  assert.equal(res.basliklar['Access-Control-Allow-Origin'], SITE);
  assert.equal('googleUcret' in res.govde.etaplar[0], false); // iç maliyet bilgisi dışarı verilmez
});

test('izinsiz site / Origin yok → 403, Google\'a gidilmez', async () => {
  const kayit = [];
  for (const origin of ['https://kotu.example', null]) {
    const res = await iste({ db: await dbHazirla(), origin, etap: sahteEtap(kayit) });
    assert.equal(res.kod, 403);
    assert.equal(res.basliklar['Access-Control-Allow-Origin'], undefined);
  }
  assert.equal(kayit.length, 0);
});

test('test için ek origin ortam değişkeniyle açılabilir', async () => {
  const res = await iste({ db: await dbHazirla(), origin: 'http://localhost:3000', env: { MESAFE_SITE_EK_ORIGINS: 'http://localhost:3000' } });
  assert.equal(res.kod, 200);
});

test('serbest adres / tabloda olmayan ilçe → 400', async () => {
  for (const body of [{ ...GOVDE, yukIlce: 'Atatürk Cad. No:5' }, { ...GOVDE, bosIl: '' }, { ...GOVDE, yukIl: 'Narnia' }]) {
    const res = await iste({ db: await dbHazirla(), body });
    assert.equal(res.kod, 400, JSON.stringify(body));
  }
  assert.equal(siteNoktasi('Bursa', ''), 'Bursa, Türkiye'); // ilçesiz → il merkezi
  assert.equal(siteNoktasi('İstanbul', 'kadıköy'), 'kadıköy, İstanbul, Türkiye');
});

test('km modu kapalıysa 409 { aktif: false }, Google\'a gidilmez', async () => {
  const kayit = [];
  const res = await iste({ db: await dbHazirla({ modu: 0 }), etap: sahteEtap(kayit) });
  assert.equal(res.kod, 409);
  assert.equal(res.govde.aktif, false);
  assert.equal(kayit.length, 0);
});

test('IP saatlik sınırı: sınır dolunca 429; başka IP etkilenmez', async () => {
  const db = await dbHazirla();
  const env = { MESAFE_SITE_IP_SAATLIK: '2' };
  assert.equal((await iste({ db, env })).kod, 200);
  assert.equal((await iste({ db, env })).kod, 200);
  assert.equal((await iste({ db, env })).kod, 429);
  assert.equal((await iste({ db, env, ip: '5.6.7.8' })).kod, 200);
});

test('günlük Google sınırı: sınır dolunca 429; ertesi gün yeniden açılır', async () => {
  const db = await dbHazirla();
  const env = { MESAFE_SITE_GUNLUK_GOOGLE: '4' };
  const gun1 = () => Date.UTC(2026, 9, 5, 9);
  assert.equal((await iste({ db, env, simdi: gun1 })).kod, 200);            // 3 sorgu
  assert.equal((await iste({ db, env, simdi: gun1, ip: '9.9.9.9' })).kod, 429); // 4. sorgu geçer, 5. takılır
  assert.equal((await iste({ db, env, simdi: () => Date.UTC(2026, 9, 6, 9), ip: '8.8.8.8' })).kod, 200);
});

test('Google hatası ayrıntısı müşteriye gösterilmez', async () => {
  const { IstekHatasi } = await import('../api/mesafe.js');
  const res = await iste({ db: await dbHazirla(), etap: async () => { throw new IstekHatasi(502, 'Google rota hatası: API key invalid'); } });
  assert.equal(res.kod, 502);
  assert.equal(res.govde.error, 'Km hesaplanamadı.');
});

test('Google anahtarı yoksa 503', async () => {
  const handler = handlerOlustur({ getDb: () => null, env: {} });
  const res = sahteYanit();
  await handler({ method: 'POST', headers: { origin: SITE }, body: GOVDE }, res);
  assert.equal(res.kod, 503);
});

// ---------------------------------------------------------------- YENİ: liste, DepoEvim şubesi, sunucuda fiyat
const { siteFiyatHesapla, siteListeleri } = await import('../api/mesafe-site.js');
const { MESAFE_VARSAYILAN, fiyatEksikleriDoldur } = await import('../src/fiyatSema.js');
const Y = (a, b, c, d, e) => ({ '1+0': a, '1+1': b, '2+1': c, '3+1': d, '4+1': e });

test('GET: il/ilçe listesi İstanbul yakalarıyla başlar, şubeler gelir; Google\'a gidilmez', async () => {
  const kayit = [];
  const res = await iste({ db: await dbHazirla(), method: 'GET', etap: sahteEtap(kayit) });
  assert.equal(res.kod, 200);
  assert.deepEqual(res.govde.ilSirasi.slice(0, 7), ['İstanbul (Anadolu)', 'İstanbul (Avrupa)', 'Kocaeli', 'Bursa', 'İzmir', 'Ankara', 'Adana']);
  assert.deepEqual(Object.keys(res.govde.iller), res.govde.ilSirasi);
  assert.equal(res.govde.ilSirasi.length, 82);
  assert.ok(res.govde.iller['Bursa'].includes('İnegöl'));
  assert.deepEqual(res.govde.subeler[0], { ad: 'Pendik Depoevim', il: 'İstanbul (Anadolu)', ilce: 'Pendik' });
  assert.equal(kayit.length, 0);
  assert.equal(siteListeleri().subeler.length, 5);
});

test('DepoEvim: depoevim.com izinli; boşaltma = seçilen şube; tanınmayan şube → ilk şube (CRM kuralı)', async () => {
  const res = await iste({ db: await dbHazirla(), origin: 'https://www.depoevim.com', body: { yukIl: 'Bursa', yukIlce: 'İnegöl', sube: 'Başakşehir Depoevim' } });
  assert.equal(res.kod, 200, JSON.stringify(res.govde));
  assert.equal(res.govde.noktalar[2], 'Başakşehir, İstanbul, Türkiye');
  assert.equal(res.govde.sube, 'Başakşehir Depoevim');
  const res2 = await iste({ db: await dbHazirla(), origin: 'https://depoevim.com', body: { yukIl: 'Bursa', yukIlce: 'İnegöl', sube: 'Farketmez' } });
  assert.equal(res2.govde.sube, 'Pendik Depoevim');
});

test('sunucuda fiyat = CRM: ekran örneği 2 (851,3 km · 1+1 %5) → 65.938 ₺', () => {
  const MS = fiyatEksikleriDoldur({ mesafe: { ...MESAFE_VARSAYILAN, modu: 1, kmUcreti: 15, kademeler: [{ km: 800, yuzde: 40, ek: 0 }],
    gecis: { ...MESAFE_VARSAYILAN.gecis, kopruFsm: 333, kopruOsmangazi: 4805, otoyolAnadolu: 675, kopruYss: 270 },
    odaKademeleri: [{ km: 800, yuzde: Y(0, 5, 0, 0, 0) }] } }).mesafe;
  const rota = { toplamKm: 851.3, gecisler: { kopruFsm: 2, kopruOsmangazi: 1, otoyolAnadolu: 2, kopruYss: 1 } };
  const f = siteFiyatHesapla(MS, rota, { odaK: '1+1', araToplam: 25000 });
  assert.equal(f.tabanFiyat, 65938);
  assert.equal(f.evTipiFarki, 3140);
  assert.equal(f.kmTutari, 12765);
  assert.equal(f.kademeKm, 800);
  assert.equal(f.tabanFiyat, 25000 + f.kmTutari + f.gecisTutari + f.sabitEk + f.uzunYolFarki + f.evTipiFarki);
});

test('Avrupa ekstrası: kademe aşılmadıysa eklenir (ev tipi farkına dahil), aşıldıysa eklenmez', () => {
  const M = fiyatEksikleriDoldur({ mesafe: { modu: 1, kmUcreti: 10, kademeler: [{ km: 200, yuzde: 10, ek: 0 }], odaKademeleri: [{ km: 0, yuzde: Y(0, 0, 10, 0, 0) }] } }).mesafe;
  const kisa = siteFiyatHesapla(M, { toplamKm: 100, gecisler: {} }, { odaK: '2+1', araToplam: 20000, avrupaEkstra: 2000 });
  assert.equal(kisa.avrupaEkstraUygulandi, true);
  assert.equal(kisa.tabanFiyat, Math.round((20000 + 1000 + 2000) * 1.1)); // km 1.000 · ev tipi %10 son toplama
  const uzun = siteFiyatHesapla(M, { toplamKm: 300, gecisler: {} }, { odaK: '2+1', araToplam: 20000, avrupaEkstra: 2000 });
  assert.equal(uzun.avrupaEkstraUygulandi, false);
  const ara = Math.round((20000 + 3000) * 1.1); // uzun yol %10
  assert.equal(uzun.tabanFiyat, ara + Math.round(ara * 0.1));
});

test('POST + hesap: fiyat cevapta; geçersiz odaK → 400', async () => {
  const res = await iste({ db: await dbHazirla({ modu: 1, kmUcreti: 100 }), body: { ...GOVDE, hesap: { odaK: '2+1', araToplam: 30000 } } });
  assert.equal(res.kod, 200, JSON.stringify(res.govde));
  assert.equal(res.govde.fiyat.kmTutari, 30000); // 300 km × 100 ₺
  assert.equal(res.govde.fiyat.tabanFiyat, res.govde.fiyat.kmTutari + 30000 + res.govde.fiyat.gecisTutari + res.govde.fiyat.uzunYolFarki + res.govde.fiyat.evTipiFarki);
  const kotu = await iste({ db: await dbHazirla(), body: { ...GOVDE, hesap: { odaK: '5+1', araToplam: 30000 } } });
  assert.equal(kotu.kod, 400);
});

test('şube: sitenin kodları (kartal, umraniye, cekmekoy, basaksehir, farketmez) ve tam ad tanınır', async () => {
  const { subeBul } = await import('../api/mesafe-site.js');
  assert.equal(subeBul('kartal').name, 'Kartal Depoevim');
  assert.equal(subeBul('umraniye').name, 'Ümraniye Depoevim');
  assert.equal(subeBul('cekmekoy').name, 'Çekmeköy Depoevim');
  assert.equal(subeBul('basaksehir').name, 'Başakşehir Depoevim');
  assert.equal(subeBul('Başakşehir Depoevim').name, 'Başakşehir Depoevim');
  assert.equal(subeBul('farketmez').name, 'Pendik Depoevim');
  assert.equal(subeBul('').name, 'Pendik Depoevim');
});
