// api/submit-lead.js — KARAKTERİZASYON (davranış sabitleme) testi
// Lead yazma mantığı ortak modüle (api/_lib/lead.js) taşınırken submit-lead'in
// Firestore'a yazdığı kayıt BİREBİR aynı kalmalı. Beklenen çıktılar, taşımadan
// ÖNCEKİ kodla üretilip tests/fixtures/submitLeadKarakter.json'a yazıldı.
// Yeniden üretmek için (yalnızca bilerek davranış değiştirildiğinde):
//   KARAKTER_YAZ=1 node --test tests/submitLeadKarakter.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const { handlerOlustur } = await import('../api/submit-lead.js');
const DOSYA = new URL('./fixtures/submitLeadKarakter.json', import.meta.url);

// Zaman damgaları her çalıştırmada değişir — karşılaştırmadan önce sabitlenir
const zamanSabitle = (v) => JSON.parse(JSON.stringify(v).replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, '<ZAMAN>'));

const SENARYOLAR = [
  ['evden eve tam', [{ leadId: 'A', source: 'web-wizard-fullpage', fullName: ' Ayşe Yılmaz ', phone: '0555 111 22 33', homeSize: '3+1', fromCity: 'İstanbul (Anadolu)', fromDistrict: 'Kadıköy', fromFloor: '4', fromElevator: 'merdiven', toCity: 'Bursa', toDistrict: 'İnegöl', toFloor: '2', toElevator: 'dis_cephe', paketleme: 'firma', kirilacak: 'evet', ambalaj: 'evet', specialItems: ['piyano', 'akvaryum'], moveDate: '2026-11-01', priceMin: 30000, priceMax: 37500, photoUrls: ['u1'], kvkkConsent: true, status: 'completed', reklamKaynagi: 'google_ads', inisSayfasi: '/x', digerSiteAdi: '' }]],
  ['evden eve ara kayıt → tamamlandı (hareket eklenir, durum korunur)', [
    { leadId: 'B', source: 'evden-eve-nakliyat', fullName: 'Ali', phone: '1', homeSize: '2+1', dateFlexible: true, tarihTercihi: 'Hafta sonu', tarihNotu: 'Saat: öğleden sonra', status: 'partial' },
    { leadId: 'B', source: 'evden-eve-nakliyat', fullName: 'Ali Veli', phone: '1', homeSize: 'villa', dateFlexible: true, status: 'completed', reklamKaynagi: 'bilinmeyen' }]],
  ['geri arama talebi', [{ leadId: 'C', source: 'web-wizard-fullpage', fullName: 'X', callbackRequested: true, status: 'partial' }, { leadId: 'C', source: 'web-wizard-fullpage', fullName: 'X', callbackRequested: true, status: 'callback_requested' }]],
  ['parça eşya', [{ leadId: 'D', source: 'web-wizard-parca-esya', homeSize: 'birkac', fromCity: 'İzmir', fromDistrict: 'Konak', specialItems: ['yok'], moveDate: 'esnek' }]],
  ['ofis', [{ leadId: 'E', source: 'ofis-isyeri-tasima', companyName: 'ACME', homeSize: 'orta', paketleme: 'kismi', kirilacak: 'evet', ambalaj: 'evet', specialItems: ['sunucu'] }]],
  ['sembol depolama', [{ leadId: 'F', source: 'web-wizard-depolama', homeSize: '2+1', fromCity: 'İstanbul (Avrupa)', fromDistrict: 'Bakırcılar', fromFloor: 3, fromElevator: 'var', sureKiralama: '6', alimTeslim: 'alim', paketleme: 'kendim', fromYurume: 'm50', moveDate: 'Bu hafta', tarihTercihi: 'Bu hafta', fiyatAylik: 4000, fiyatToplam: 20000, nakliyeMin: 9000, nakliyeMax: 11000, nakliyeEk: 0, fiyatVersiyonu: 3 }]],
  ['asansör', [{ leadId: 'G', source: 'asansor-kiralama-wizard', kurulumCity: 'İstanbul (Anadolu)', kurulumDistrict: 'Pendik', kullanimAmaci: 'evden_eve', asansorTaraf: 'cift_taraf', isHacmi: '3+1', kiralamaSuresi: 'yarim_gun', aracYanasma: 'uzak', kurulumKat: 'orta', moveDate: '2026-12-01' }]],
  ['depoevim anahtar teslim', [{ leadId: 'H', source: 'depoevim-esya-depolama-wizard', depoBoyutu: '15', kiralamaSuresi: '12', sube: 'kartal', teslimSekli: 'anahtar_teslim', pickupCity: 'Kocaeli', pickupDistrict: 'Gebze', pickupFloor: '5', pickupElevator: 'yok', paketleme: 'firma', pickupYurume: 'yok', baslangicTarihi: '2026-10-20', fiyatAylik: 3500, fiyatToplam: 35000, nakliyeMin: 12000, nakliyeMax: 15000, priceMin: 1, priceMax: 2 }]],
  ['depoevim kendim getiririm', [{ leadId: 'I', source: 'depoevim-esya-depolama-wizard', depoBoyutu: '10', sube: 'farketmez', teslimSekli: 'kendim' }]],
  ['woocommerce siparişi', [{ leadId: 'J', source: 'depoevim-woocommerce-siparis', siparisNo: '123', urunler: '10 m³ Depo', toplamTutar: 4200, odemeYontemi: 'iyzico', faturaAdresi: 'Kartal', status: 'completed' }]],
  ['QR izi (organik üzerine yazar)', [{ leadId: 'K', source: 'web-wizard-fullpage', reklamKaynagi: 'google_anasayfa', qrIzi: { utmSource: 'qr', utmMedium: 'kamyon', utmCampaign: '34 NAR 385', qr: '34nar385', sayfaUrl: 'https://www.sembolevdeneve.com/?qr=34nar385', zaman: '2026-10-01T10:00:00.000Z' } }]],
  ['QR izi ödemeli reklamda yoksayılır', [{ leadId: 'L', source: 'web-wizard-fullpage', reklamKaynagi: 'facebook_ads', sayfaUrl: 'https://www.sembolevdeneve.com/?utm_source=qr&utm_campaign=bilbord1' }]],
  ['source yok → evden eve', [{ leadId: 'M', fullName: 'Eski' }]],
];

async function calistir(adimlar) {
  const db = sahteDb();
  const handler = handlerOlustur({ getDb: () => db, env: {}, waitUntil: () => {} });
  const cevaplar = [];
  for (const body of adimlar) {
    const res = sahteYanit();
    await handler({ method: 'POST', headers: { origin: 'https://www.sembolevdeneve.com', referer: 'https://www.sembolevdeneve.com/fiyat-teklifi-al/' }, body }, res);
    cevaplar.push({ kod: res.kod, govde: res.govde });
  }
  return zamanSabitle({ cevaplar, kayit: db.havuz(adimlar[0].leadId) });
}

const uret = async () => Object.fromEntries(await Promise.all(SENARYOLAR.map(async ([ad, adimlar]) => [ad, await calistir(adimlar)])));

if (process.env.KARAKTER_YAZ) {
  fs.writeFileSync(DOSYA, JSON.stringify(await uret(), null, 2) + '\n');
}
const BEKLENEN = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));

for (const [ad, adimlar] of SENARYOLAR) {
  test(`submit-lead çıktısı değişmedi: ${ad}`, async () => {
    assert.deepEqual(await calistir(adimlar), BEKLENEN[ad]);
  });
}
