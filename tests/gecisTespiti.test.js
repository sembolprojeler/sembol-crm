// Geçiş tespiti (köprü: rota çizgisi · otoyol: özet / adım km · feribot: FERRY manevrası)
// Örnek metinler 6 Ekim 2026'da Google Routes API'den alınan gerçek yol tarifleridir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polylineCoz, yolaUzaklikM, rotaGecisleriGeometri } from '../src/fiyatSema.js';

const FSM = [41.0911, 29.0611];
// FSM'nin üzerinden doğu-batı geçen çizgi, ve aynı çizginin ~1 km kuzeyi
const fsmUstu = [[41.0911, 29.05], [41.0911, 29.07]];
const fsmKuzeyi = [[41.1001, 29.05], [41.1001, 29.07]];

test('polyline çözümü (Google örneği)', () => {
  const y = polylineCoz('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(y, [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});

test('uzaklık: köprü üzerinden geçen çizgi ~0 m, 1 km kuzeyi ~1 km (köşe değil parça ölçülür)', () => {
  assert.ok(yolaUzaklikM(fsmUstu, FSM) < 5);
  const d = yolaUzaklikM(fsmKuzeyi, FSM);
  assert.ok(d > 950 && d < 1050, String(d));
});

test('köprü yalnızca rota çizgisi köprüden geçiyorsa sayılır — tabela yazısı sayılmaz', () => {
  const tabela = [{ metin: 'Yavuz Sultan Selim Köp./Fatih Sultan Mehmet Köp/Ankara/Ümraniye doğru 2. Çevre Yolu/İstanbul Çevre Yolu/O-2 yönündeki çıkışa girin', km: 6.6 }];
  assert.deepEqual(rotaGecisleriGeometri({ yol: fsmKuzeyi, adimlar: tabela }), {});           // Pendik → Ümraniye
  assert.deepEqual(rotaGecisleriGeometri({ yol: fsmUstu, adimlar: tabela }), { kopruFsm: 1 }); // köprüden geçen rota
});

test('Anadolu yakasındaki O-1 çevre yolu 15 Temmuz Köprüsü sayılmaz (Kadıköy → İnegöl)', () => {
  const adimlar = [{ metin: '1. Çevre Yolu/İstanbul Çevre Yolu/O-1 yönünde devam edin', km: 2.5 }];
  assert.deepEqual(rotaGecisleriGeometri({ yol: fsmKuzeyi, adimlar }), {});
});

test('feribot yalnızca FERRY manevrasıyla: "Harem Feribot" tabelası sayılmaz', () => {
  const adimlar = [{ metin: 'Kartal/Edirne/Harem Feribot yönündeki rampaya doğru sağa yönelin', km: 0.2 }];
  assert.deepEqual(rotaGecisleriGeometri({ adimlar }), {});
  assert.deepEqual(rotaGecisleriGeometri({ adimlar, feribot: true }), { feribot: 1 });
});

test('otoyol: adı geçen adımlarda ≥ 10 km gidilirse; kısa bağlantı sayılmaz', () => {
  const uzun = [{ metin: 'Ataşehir/S. Gökçen Havalimanı/Ankara doğru Anadolu Otoyolu/İstanbul - İzmir Otoyolu/O-4 yönündeki çıkışa girin', km: 46.9 }];
  const kisa = [{ metin: 'Istanbul/Ankara yönünde O-4/E80 rampaya girin', km: 0.8 }, { metin: 'Anadolu Otoyolu/İstanbul - İzmir Otoyolu/O-4/E80 girin', km: 1.6 }];
  assert.deepEqual(rotaGecisleriGeometri({ adimlar: uzun }), { otoyolAnadolu: 1 });
  assert.deepEqual(rotaGecisleriGeometri({ adimlar: kisa }), {}); // Pendik → Yalova
});

test('otoyol rota özetinden de tanınır ("E80 yönünde dümdüz ilerleyin" adımı O-3 yazmaz)', () => {
  const adimlar = [{ metin: 'E80 yönünde dümdüz ilerleyin', km: 225.4 }];
  assert.deepEqual(rotaGecisleriGeometri({ adimlar, aciklama: 'Avrupa Otoyolu/O-3/E80' }), { otoyolAvrupa: 1 });
  // özette köprü adı (O-1 / Kuzey Marmara) geçse de köprü yalnızca çizgiden bulunur
  assert.deepEqual(rotaGecisleriGeometri({ yol: fsmKuzeyi, aciklama: 'Kuzey Marmara Otoyolu/O-7 ve Anadolu Otoyolu/O-4' }), { otoyolAnadolu: 1 });
});
