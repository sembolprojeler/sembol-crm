// tests/mesafe.test.js — Km bazlı fiyat (4 nokta / 3 etap) birim testleri
import test from 'node:test';
import assert from 'node:assert/strict';
import { MESAFE_VARSAYILAN, mesafeKalemleri, mesafeIscilikKalemi, mesafeEsikAsildi, ilceMerkezAdresi, rotaGecisleriBul,
  fiyatEksikleriDoldur, fiyatDogrula, fiyatTemizle, fiyatFarklari, mesafeModuAcik } from '../src/fiyatSema.js';

const M = { ...MESAFE_VARSAYILAN, kmUcreti: 100, esikKm: 200, iscilikYuzde: 15, uzunYolEk: 0, gecis: { ...MESAFE_VARSAYILAN.gecis, kopruOsmangazi: 1500 } };

test('kullanıcı örneği: 15 + 100 + 85 = 200 km × 100 ₺ = 20.000 ₺, eşik altı → geçiş yok', () => {
  const k = mesafeKalemleri(M, { toplamKm: 15 + 100 + 85, gecisler: { kopruOsmangazi: 2 } });
  assert.equal(k.length, 1);
  assert.equal(k[0].tutar, 20000);
  assert.equal(mesafeIscilikKalemi(M, { toplamKm: 200 }, [{ ad: 'taban', tutar: 30000 }, ...k]), null); // tam 200 = aşmıyor
});
test('200 km aşılınca: geçişler + sabit ek + %15 işçilik (taban + hizmetler üzerinden)', () => {
  const M2 = { ...M, uzunYolEk: 2000 };
  const k = mesafeKalemleri(M2, { toplamKm: 260, gecisler: { kopruOsmangazi: 2 } });
  assert.equal(k[0].tutar, 26000);                      // 260 × 100
  assert.equal(k[1].tutar, 3000);                       // Osmangazi × 2
  assert.equal(k[2].tutar, 2000);                       // sabit ek
  const hizmetler = [{ ad: 'taban', tutar: 30000 }, { ad: 'toplama', tutar: 10000 }];
  const isc = mesafeIscilikKalemi(M2, { toplamKm: 260 }, [...hizmetler, ...k]);
  assert.equal(isc.tutar, 6000);                        // %15 × 40.000 (km kalemleri hariç)
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
  assert.equal(temiz.mesafe.kmUcreti, 100); assert.equal(temiz.mesafe.esikKm, 200); assert.equal(temiz.mesafe.iscilikYuzde, 15);
  assert.equal(mesafeModuAcik(temiz.mesafe), false);
});
test('doğrulama: hatalı değerler yakalanır', () => {
  const v = fiyatEksikleriDoldur({}); v.mesafe.modu = 2; v.mesafe.iscilikYuzde = 150; v.mesafe.esikKm = 0; v.mesafe.cikisAdresi = ' ';
  const h = fiyatDogrula(v).hatalar.filter(x => x.yol[0] === 'mesafe').map(x => x.yol.join('.'));
  for (const y of ['mesafe.modu', 'mesafe.iscilikYuzde', 'mesafe.esikKm', 'mesafe.cikisAdresi']) assert.ok(h.includes(y), y);
});
test('farklar: hareket merkezi metin olarak karşılaştırılır', () => {
  const a = fiyatEksikleriDoldur({}); const b = fiyatEksikleriDoldur({}); b.mesafe.cikisAdresi = 'Kartal, İstanbul, Türkiye';
  const f = fiyatFarklari(a, b).filter(x => x.yol[0] === 'mesafe');
  assert.equal(f.length, 1); assert.equal(f[0].yol.join('.'), 'mesafe.cikisAdresi');
});
