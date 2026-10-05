// tests/mesafe.test.js — Km bazlı fiyat (4 nokta / 3 etap) birim testleri
import test from 'node:test';
import assert from 'node:assert/strict';
import { MESAFE_VARSAYILAN, mesafeKalemleri, mesafeIscilikKalemi, mesafeEsikAsildi, ilceMerkezAdresi, rotaGecisleriBul,
  fiyatEksikleriDoldur, fiyatDogrula, fiyatTemizle, fiyatFarklari, mesafeModuAcik, mesafeAktifKademe, mesafeKademeListesi, mesafeOdaFarkiKalemi } from '../src/fiyatSema.js';

const M = { ...MESAFE_VARSAYILAN, kmUcreti: 100, kademeler: [{ km: 200, yuzde: 15, ek: 0 }], gecis: { ...MESAFE_VARSAYILAN.gecis, kopruOsmangazi: 1500 } };

test('kullanıcı örneği: 15 + 100 + 85 = 200 km × 100 ₺ = 20.000 ₺, eşik altı → geçiş yok', () => {
  const k = mesafeKalemleri(M, { toplamKm: 15 + 100 + 85, gecisler: { kopruOsmangazi: 2 } });
  assert.equal(k.length, 1);
  assert.equal(k[0].tutar, 20000);
  assert.equal(mesafeIscilikKalemi(M, { toplamKm: 200 }, [{ ad: 'taban', tutar: 30000 }, ...k]), null); // tam 200 = aşmıyor
});
test('200 km aşılınca: geçişler + sabit ek + %15 uzun yol farkı (toplamın üzerine)', () => {
  const M2 = { ...M, kademeler: [{ km: 200, yuzde: 15, ek: 2000 }] };
  const k = mesafeKalemleri(M2, { toplamKm: 260, gecisler: { kopruOsmangazi: 2 } });
  assert.equal(k[0].tutar, 26000);                      // 260 × 100
  assert.equal(k[1].tutar, 3000);                       // Osmangazi × 2
  assert.equal(k[2].tutar, 2000);                       // sabit ek
  const hizmetler = [{ ad: 'taban', tutar: 30000 }, { ad: 'toplama', tutar: 10000 }];
  const isc = mesafeIscilikKalemi(M2, { toplamKm: 260 }, [...hizmetler, ...k]);
  assert.equal(isc.tutar, Math.round((40000 + 26000 + 3000 + 2000) * 0.15)); // %15 × TOPLAM (km, geçiş, sabit ek dahil)
});
test('eşik: tam eşit aşmaz, bir fazlası aşar', () => {
  assert.equal(mesafeEsikAsildi(M, 200), false); assert.equal(mesafeEsikAsildi(M, 201), true);
});
test('ilçe merkezi adresi: yaka eki silinir, ilçe yoksa il merkezi', () => {
  assert.equal(ilceMerkezAdresi('İstanbul (Anadolu)', 'Kadıköy'), 'Kadıköy, İstanbul, Türkiye');
  assert.equal(ilceMerkezAdresi('İstanbul (Avrupa)', 'Bağcılar'), 'Bağcılar, İstanbul, Türkiye');
  assert.equal(ilceMerkezAdresi('Bursa', 'İnegöl'), 'İnegöl, Bursa, Türkiye');
  assert.equal(ilceMerkezAdresi('Bursa', ''), 'Bursa, Türkiye');
  assert.equal(ilceMerkezAdresi('', 'Kadıköy'), '');
});
test('rota yoksa kalem yok', () => { assert.deepEqual(mesafeKalemleri(M, null), []); });
test('geçiş tespiti: Türkçe yol tariflerinden', () => {
  assert.deepEqual(rotaGecisleriBul(['Osmangazi Köprüsü yönünde devam edin', 'O-5 üzerinden'], false), { kopruOsmangazi: 1 });
  assert.deepEqual(rotaGecisleriBul([], true), { feribot: 1 });
  assert.deepEqual(rotaGecisleriBul(['D-100 üzerinden Kartal'], false), {});
});
test('eski kayıt: mesafe yoksa doğrulama hata vermez, varsayılanlar yazılır, mod kapalı', () => {
  const eski = { genel: { acilisOraniEve: 25, acilisOraniDepo: 25 } };
  assert.equal(fiyatDogrula(eski).hatalar.filter(h => h.yol[0] === 'mesafe').length, 0);
  const temiz = fiyatTemizle(eski, eski);
  assert.equal(temiz.mesafe.kmUcreti, 100); assert.deepEqual(temiz.mesafe.kademeler, [{ km: 200, yuzde: 15, ek: 0 }]);
  assert.equal(mesafeModuAcik(temiz.mesafe), false);
});
test('doğrulama: hatalı değerler yakalanır', () => {
  // DEĞİŞTİ: km oranı sınırı artık %1000 (1500 hatalı)
  const v = fiyatEksikleriDoldur({}); v.mesafe.modu = 2; v.mesafe.kademeler = [{ km: 0, yuzde: 1500, ek: -1 }]; v.mesafe.cikisAdresi = ' ';
  const h = fiyatDogrula(v).hatalar.filter(x => x.yol[0] === 'mesafe').map(x => x.yol.join('.'));
  for (const y of ['mesafe.modu', 'mesafe.kademeler.0.km', 'mesafe.kademeler.0.yuzde', 'mesafe.kademeler.0.ek', 'mesafe.cikisAdresi']) assert.ok(h.includes(y), y);
});
test('farklar: hareket merkezi metin olarak karşılaştırılır', () => {
  const a = fiyatEksikleriDoldur({}); const b = fiyatEksikleriDoldur({}); b.mesafe.cikisAdresi = 'Kartal, İstanbul, Türkiye';
  const f = fiyatFarklari(a, b).filter(x => x.yol[0] === 'mesafe');
  assert.equal(f.length, 1); assert.equal(f[0].yol.join('.'), 'mesafe.cikisAdresi');
});

// ---------------------------------------------------------------- UZUN YOL KADEMELERİ
const MK = { ...M, kademeler: [{ km: 200, yuzde: 15, ek: 0 }, { km: 400, yuzde: 25, ek: 3000 }] };
test('kademe: aşılan EN YÜKSEK kademe uygulanır, tam eşit aşmaz', () => {
  assert.equal(mesafeAktifKademe(MK, 150), null);
  assert.equal(mesafeAktifKademe(MK, 200), null);
  assert.equal(mesafeAktifKademe(MK, 300).km, 200);
  assert.equal(mesafeAktifKademe(MK, 400).km, 200);
  assert.equal(mesafeAktifKademe(MK, 500).km, 400);
});
test('kademe: 500 km → %25 işçilik + 3.000 ₺ sabit ek + geçişler', () => {
  const k = mesafeKalemleri(MK, { toplamKm: 500, gecisler: { kopruOsmangazi: 2 } });
  assert.deepEqual(k.map(x => x.tutar), [50000, 3000, 3000]);
  assert.equal(mesafeIscilikKalemi(MK, { toplamKm: 500 }, [{ ad: 'taban', tutar: 40000 }, ...k]).tutar, Math.round((40000 + 50000 + 3000 + 3000) * 0.25));
  assert.equal(mesafeIscilikKalemi(MK, { toplamKm: 300 }, [{ ad: 'taban', tutar: 40000 }]).tutar, 6000);
});
test('kademe yoksa uzun yol farkı ve geçiş alınmaz', () => {
  const M0 = { ...M, kademeler: [] };
  assert.equal(mesafeEsikAsildi(M0, 5000), false);
  assert.equal(mesafeKalemleri(M0, { toplamKm: 5000, gecisler: { kopruOsmangazi: 2 } }).length, 1);
});
test('eski tek eşikli kayıt (esikKm/iscilikYuzde/uzunYolEk) 1. kademeye taşınır', () => {
  const eski = { mesafe: { modu: 1, cikisAdresi: 'Pendik, İstanbul, Türkiye', kmUcreti: 15, esikKm: 800, iscilikYuzde: 20, uzunYolEk: 500, gecis: {} } };
  assert.deepEqual(mesafeKademeListesi(eski.mesafe), [{ km: 800, yuzde: 20, ek: 500 }]);
  assert.deepEqual(fiyatTemizle(eski, eski).mesafe.kademeler, [{ km: 800, yuzde: 20, ek: 500 }]);
});
test('kademe ekle / sil kaydedilir, sıralanır ve fark sayılır; aynı km hata verir', () => {
  const t0 = fiyatTemizle(fiyatEksikleriDoldur({}), null);
  const ekle = JSON.parse(JSON.stringify(t0)); ekle.mesafe.kademeler.unshift({ km: 600, yuzde: 30, ek: 0 });
  const t1 = fiyatTemizle(ekle, t0);
  assert.deepEqual(t1.mesafe.kademeler.map(k => k.km), [200, 600]);
  assert.ok(fiyatFarklari(t0, t1).some(f => f.yol[0] === 'mesafe'));
  const sil = JSON.parse(JSON.stringify(t1)); sil.mesafe.kademeler = [];
  const t2 = fiyatTemizle(sil, t1);
  assert.deepEqual(t2.mesafe.kademeler, []);
  assert.ok(fiyatFarklari(t1, t2).some(f => f.yol[1] === 'kademeler'));
  const cift = JSON.parse(JSON.stringify(t1)); cift.mesafe.kademeler.push({ km: 600, yuzde: 5, ek: 0 });
  assert.ok(fiyatDogrula(cift, t1).hatalar.some(h => h.mesaj.includes('Aynı km')));
});

// ---------------------------------------------------------------- EV TİPİNE GÖRE KM FARKI (KADEMELİ)
const Y = (a, b, c, d, e) => ({ '1+0': a, '1+1': b, '2+1': c, '3+1': d, '4+1': e });
const MO = { ...M, kmUcreti: 15, kademeler: [{ km: 800, yuzde: 20, ek: 0 }],
  odaKademeleri: [{ km: 0, yuzde: Y(0, 0, 5, 10, 15) }, { km: 600, yuzde: Y(0, 5, 10, 20, 30) }] };
test('ev tipi kademesi: aşılan EN YÜKSEK kademe, 0 km her mesafede, tam eşit aşmaz', () => {
  assert.equal(mesafeOdaFarkiKalemi(MO, { toplamKm: 300 }, '3+1').tutar, 450);    // 4.500 × %10
  assert.equal(mesafeOdaFarkiKalemi(MO, { toplamKm: 600 }, '3+1').tutar, 900);    // 600 = aşmaz → 1. kademe
  assert.equal(mesafeOdaFarkiKalemi(MO, { toplamKm: 1000 }, '3+1').tutar, 3000);  // 15.000 × %20
  assert.equal(mesafeOdaFarkiKalemi(MO, { toplamKm: 1000 }, '4+1').tutar, 4500);  // 15.000 × %30
  assert.equal(mesafeOdaFarkiKalemi(MO, { toplamKm: 1000 }, '1+0'), null);        // %0
  assert.equal(mesafeOdaFarkiKalemi({ ...MO, odaKademeleri: [] }, { toplamKm: 1000 }, '3+1'), null);
});
test('sıra: mesafe → geçiş → uzun yol farkı → EN SON ev tipi farkı (ev tipi uzun yol tabanına girmez)', () => {
  const rota = { toplamKm: 1000, gecisler: {} };
  const k = [{ ad: 'taban', tutar: 35000 }, ...mesafeKalemleri(MO, rota), mesafeOdaFarkiKalemi(MO, rota, '3+1')];
  assert.equal(mesafeIscilikKalemi(MO, rota, k).tutar, Math.round((35000 + 15000) * 0.2)); // ev tipi (3.000) hariç
});
test('ev tipi kademeleri şemada: varsayılan, eski tek satır göçü, ekle/sil, doğrulama', () => {
  const d = fiyatEksikleriDoldur({ mesafe: { kmUcreti: 15 } });
  assert.deepEqual(d.mesafe.odaKademeleri, [{ km: 0, yuzde: Y(0, 0, 0, 0, 0) }]);
  const eski = { mesafe: { kmUcreti: 15, odaFarki: { esikKm: 400, yuzde: Y(0, 5, 10, 20, 30) } } };
  assert.deepEqual(fiyatEksikleriDoldur(eski, eski).mesafe.odaKademeleri, [{ km: 400, yuzde: Y(0, 5, 10, 20, 30) }]);
  const t0 = fiyatTemizle(fiyatEksikleriDoldur({}), null);
  const ekle = JSON.parse(JSON.stringify(t0)); ekle.mesafe.odaKademeleri.unshift({ km: 600, yuzde: Y(0, 5, 10, 20, 30) });
  const t1 = fiyatTemizle(ekle, t0);
  assert.deepEqual(t1.mesafe.odaKademeleri.map(k => k.km), [0, 600]);
  assert.ok(fiyatFarklari(t0, t1).some(f => f.yol[1] === 'odaKademeleri'));
  const sil = JSON.parse(JSON.stringify(t1)); sil.mesafe.odaKademeleri = [];
  assert.deepEqual(fiyatTemizle(sil, t1).mesafe.odaKademeleri, []);
  const hata = (v) => fiyatDogrula(v, t1).hatalar.filter(h => h.yol[0] === 'mesafe');
  const cift = JSON.parse(JSON.stringify(t1)); cift.mesafe.odaKademeleri.push({ km: 600, yuzde: Y(0, 0, 0, 0, 0) });
  assert.ok(hata(cift).some(h => h.mesaj.includes('ev tipi kademesi')));
  // DEĞİŞTİ (kullanıcı talebi): %100 üstü geçerli (ör. %120); sınır %1000
  const yuz20 = JSON.parse(JSON.stringify(t1)); yuz20.mesafe.odaKademeleri[1].yuzde['4+1'] = 120;
  assert.equal(hata(yuz20).length, 0);
  const fazla = JSON.parse(JSON.stringify(t1)); fazla.mesafe.odaKademeleri[1].yuzde['4+1'] = 1500;
  assert.ok(hata(fazla).some(h => h.yol.join('.') === 'mesafe.odaKademeleri.1.yuzde.4+1'));
});

test('km oranları %100 üstü: ev tipi %120 ve uzun yol %150 doğru hesaplanır; açılış yüzdesi yine 0–100', () => {
  const M2 = { ...M, kmUcreti: 15, kademeler: [{ km: 800, yuzde: 150, ek: 0 }], odaKademeleri: [{ km: 0, yuzde: Y(0, 0, 0, 0, 120) }] };
  const rota = { toplamKm: 1000, gecisler: {} };
  const oda = mesafeOdaFarkiKalemi(M2, rota, '4+1');
  assert.equal(oda.tutar, 18000);                                   // 15.000 × %120
  const k = [{ ad: 'taban', tutar: 42000 }, ...mesafeKalemleri(M2, rota), oda];
  assert.equal(mesafeIscilikKalemi(M2, rota, k).tutar, Math.round((42000 + 15000) * 1.5)); // %150 × toplam (ev tipi hariç)
  const v = fiyatEksikleriDoldur({}); v.mesafe.kademeler = [{ km: 200, yuzde: 250, ek: 0 }];
  assert.equal(fiyatDogrula(v).hatalar.filter(h => h.yol[0] === 'mesafe').length, 0);
  const g = fiyatEksikleriDoldur({}); g.genel = { acilisOraniEve: 120, acilisOraniDepo: 25 };
  assert.ok(fiyatDogrula(g).hatalar.some(h => h.yol.join('.') === 'genel.acilisOraniEve'));
});

test('ekran örneği: 1.171,5 km · 4+1 · Osmangazi×2 + Anadolu Otoyolu×2 · %35 kademe · %40 ev tipi', () => {
  const MX = { ...MESAFE_VARSAYILAN, kmUcreti: 15, kademeler: [{ km: 1000, yuzde: 35, ek: 0 }],
    gecis: { ...MESAFE_VARSAYILAN.gecis, kopruOsmangazi: 4805, otoyolAnadolu: 675 }, odaKademeleri: [{ km: 1000, yuzde: Y(0, 0, 0, 0, 40) }] };
  const rota = { toplamKm: 1171.5, gecisler: { kopruOsmangazi: 2, otoyolAnadolu: 2 } };
  const k = [{ ad: 'taban', tutar: 42000 }, ...mesafeKalemleri(MX, rota)];
  k.push(mesafeIscilikKalemi(MX, rota, k)); k.push(mesafeOdaFarkiKalemi(MX, rota, '4+1'));
  assert.deepEqual(k.map(x => x.tutar), [42000, 17580, 9610, 1350, 24689, 7032]);
  assert.equal(k.reduce((t, x) => t + x.tutar, 0), 102261);
});
