// api/_lib/fiyatHesap.js
// ============================================================================
// Sembol CRM — WHATSAPP BOTU FİYAT HESABI (sitedeki sihirbazlarla BİREBİR)
// ----------------------------------------------------------------------------
// Fiyatı yapay zeka HESAPLAMAZ: bot alanları toplar, bu modül hesaplar, yapay
// zeka yalnızca sonucu anlatır. Hesap, sitelerdeki canlı sihirbazların (Ekim 2026,
// km'li sürüm — kopyası referans/*-canli-2026-10-06.js) mantığının sunucu tarafı
// karşılığıdır:
//   • Veri: /api/fiyatlar'ın sitelere verdiği yanıtın AYNISI (fiyatApiYaniti) —
//     sihirbazın yedek değerleri + CRM'den gelenle güncelleme kuralları korunur.
//   • Km: sihirbaz /api/mesafe-site'a { yukIl, yukIlce, bosIl+bosIlce | sube,
//     hesap { odaK, araToplam, avrupaEkstra } } gönderiyor; bot aynı gövdeyi
//     kurup mesafe-site'ın sunucu fonksiyonunu (kmRotaFiyat) DOĞRUDAN çağırır —
//     IP deneme sınırına girmez, Google sorgularını kendi günlük sayacıyla sayar.
//   • araToplam = şehir içi nakliye tabanı[odaK] + ek hizmetler (CRM "Hızlı Fiyat
//     Hesapla" kuralları; şehirler arası işte de 81 il tablosu KULLANILMAZ).
//   • Km alınamazsa (mod kapalı / il listede yok / Google hatası / sınır) sihirbazın
//     eski km'siz hesabına (81 il tablosu) düşülür.
//   • Gösterim: alt = taban (Sembol 100'e yuvarlar), üst = yukarı_yuvarla(taban ×
//     (1 + aralikYuzdesi/100), yuvarlama).
// Ofis için fiyat verilmez (Ali'nin kararı) — "fiyat_yok" döner, bot devreder.
// ============================================================================
import { fiyatApiYaniti, mesafeModuAcik, ilceMerkezAdresi } from '../../src/fiyatSema.js';
import { TURKEY_LOCATIONS, IL_SIRASI } from '../../src/konumlar.js';
import { kmAyarlariOku, kmRotaFiyat, siteNoktasi, subeBul, sayacArtir, gunDamgasi } from '../mesafe-site.js';
import { anahtarYap } from '../mesafe.js';

const kopya = (o) => JSON.parse(JSON.stringify(o));
// Sihirbazdaki snwSayi: yalnızca pozitif sonlu sayı, değilse 0
const snwSayi = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
const grupDegerleri = (g) => (g ? g.degerler : null);
function mevcutAnahtarlariGuncelle(kaynak, hedef) {
  if (!kaynak) return;
  Object.keys(hedef).forEach(k => { const v = snwSayi(kaynak[k]); if (v) hedef[k] = v; });
}
function tumAnahtarlariAktar(kaynak, hedef, anahtarCevir) {
  if (!kaynak) return;
  Object.keys(kaynak).forEach(k => { const v = snwSayi(kaynak[k]); if (v) hedef[anahtarCevir ? anahtarCevir(k) : k] = v; });
}
const katNumarasi = (k) => String(k).replace('kat', '');

// "İstanbul (Anadolu)" ve "İstanbul (Avrupa)" ikisi de İstanbul sayılır
export const istanbulMu = (il) => il === 'İstanbul' || String(il || '').indexOf('İstanbul (') === 0;
const tarifeIli = (il) => (istanbulMu(il) ? 'İstanbul' : il);
const AVRUPA_ILCELERI = TURKEY_LOCATIONS['İstanbul (Avrupa)'] || [];
// Sihirbazdaki istanbulYakasiBul — "avrupa" | "anadolu" | null
function istanbulYakasiBul(sehir, ilce) {
  if (sehir === 'İstanbul (Avrupa)') return 'avrupa';
  if (sehir === 'İstanbul (Anadolu)') return 'anadolu';
  if (sehir !== 'İstanbul' || !ilce) return null;
  return AVRUPA_ILCELERI.includes(ilce) ? 'avrupa' : 'anadolu';
}

// ---------------------------------------------------------------- KONUM
// Müşterinin yazdığı il / ilçe → sihirbaz listesindeki ad (GET /api/mesafe-site:
// ilSirasi + iller). "İstanbul" + ilçe → yakası bulunur. Bulunamazsa null.
export function konumNormalize(il, ilce) {
  const ilA = anahtarYap(il);
  const ilceA = anahtarYap(ilce);
  if (!ilA) return null;
  let aday = IL_SIRASI.filter(x => anahtarYap(x) === ilA);
  if (!aday.length && (ilA === anahtarYap('İstanbul') || ilA.startsWith('istanbul'))) aday = ['İstanbul (Anadolu)', 'İstanbul (Avrupa)'];
  for (const ilAd of aday) {
    if (!ilceA) return aday.length === 1 ? { il: ilAd, ilce: '' } : null;
    const ilceAd = (TURKEY_LOCATIONS[ilAd] || []).find(x => anahtarYap(x) === ilceA);
    if (ilceAd) return { il: ilAd, ilce: ilceAd };
  }
  return null;
}

// ================================================================= SEMBOL
// Sihirbazın yedek değerleri (CRM'e ulaşılamazsa) — referans/sembol-sihirbaz-evden-eve-canli-2026-10-06.js
const SEMBOL_YEDEK = {
  SEHIR_ICI_TABAN: { '1+0': 18000, '1+1': 25000, '2+1': 30000, '3+1': 35000, '4+1': 42000 },
  SEHIR_ICI_TOPLAMA: { '1+0': 3000, '1+1': 5000, '2+1': 8000, '3+1': 10000, '4+1': 15000 },
  SEHIR_ICI_MERDIVEN: { 3: 2000, 4: 4000, 5: 6000, 6: 8500, 7: 12000 },
  SEHIR_ICI_DIS_CEPHE: { anadolu: 4000, avrupa: 5000, anadolu913: 7000, avrupa913: 9000 },
  SEHIR_ICI_AVRUPA_EKSTRA: { '1+0': 4500, '1+1': 5500, '2+1': 6500, '3+1': 11000, '4+1': 16500 },
  SEHIR_ICI_YURUME: { m50: 4000, m100: 7000, m150: 10000, m200: 13000 },
  SEHIRLERARASI_TOPLAMA: { '1+0': 3500, '1+1': 5500, '2+1': 9000, '3+1': 11000, '4+1': 16500 },
  SEHIRLERARASI_MERDIVEN: { 3: 2500, 4: 4500, 5: 6500, 6: 8500, 7: 10500 },
  SEHIRLERARASI_DIS_CEPHE: { anadolu: 3500, avrupa: 5000, anadolu913: 5500, avrupa913: 7500 },
  SEHIRLERARASI_YURUME: { m50: 4000, m100: 7000, m150: 10000, m200: 13000 },
  SEHIRLERARASI_FIYAT: {},
  FIYAT_ARALIK_YUZDE: 25,
  FIYAT_YUVARLAMA: 500,
  MESAFE_AKTIF: false,
};
export const KM_ODA = { '1+0': '1+0', '1+1': '1+1', '2+1': '2+1', '3+1': '3+1', '4+1': '4+1', '5+1': '4+1', villa: '4+1', ofis: '3+1' };

// Sihirbazdaki crmFiyatlariUygula — j: /api/fiyatlar?site=sembol yanıtı
export function sembolTablolari(j) {
  const T = kopya(SEMBOL_YEDEK);
  if (!j) return T;
  const e = j.evdenEve || {};
  const si = e.sehirIci || {};
  const sa = e.sehirlerArasi || {};
  mevcutAnahtarlariGuncelle(grupDegerleri(si.nakliyeTaban), T.SEHIR_ICI_TABAN);
  mevcutAnahtarlariGuncelle(grupDegerleri(si.toplama), T.SEHIR_ICI_TOPLAMA);
  tumAnahtarlariAktar(grupDegerleri(si.merdiven), T.SEHIR_ICI_MERDIVEN, katNumarasi);
  tumAnahtarlariAktar(grupDegerleri(si.disCepheAsansor), T.SEHIR_ICI_DIS_CEPHE);
  tumAnahtarlariAktar(grupDegerleri(si.yurumeMesafesi), T.SEHIR_ICI_YURUME);
  mevcutAnahtarlariGuncelle(grupDegerleri(si.avrupaYakasiEkstra), T.SEHIR_ICI_AVRUPA_EKSTRA);
  mevcutAnahtarlariGuncelle(grupDegerleri(sa.toplama), T.SEHIRLERARASI_TOPLAMA);
  tumAnahtarlariAktar(grupDegerleri(sa.merdiven), T.SEHIRLERARASI_MERDIVEN, katNumarasi);
  tumAnahtarlariAktar(grupDegerleri(sa.disCepheAsansor), T.SEHIRLERARASI_DIS_CEPHE);
  tumAnahtarlariAktar(grupDegerleri(sa.yurumeMesafesi), T.SEHIRLERARASI_YURUME);
  const ild = (sa.iller || {}).degerler || {};
  Object.keys(ild).forEach(slug => {
    const il = ild[slug];
    if (!il || !il.etiket || !il.degerler) return;
    if (!T.SEHIRLERARASI_FIYAT[il.etiket]) T.SEHIRLERARASI_FIYAT[il.etiket] = { '1+1': 0, '2+1': 0, '3+1': 0, '4+1': 0 };
    mevcutAnahtarlariGuncelle(il.degerler, T.SEHIRLERARASI_FIYAT[il.etiket]);
  });
  if (snwSayi(e.aralikYuzdesi)) T.FIYAT_ARALIK_YUZDE = e.aralikYuzdesi;
  if (snwSayi(e.yuvarlama)) T.FIYAT_YUVARLAMA = e.yuvarlama;
  T.MESAFE_AKTIF = !!(j.mesafe || {}).aktif;
  return T;
}

// ---- km'siz (eski) hesap: sihirbazdaki ekYuklemeMaliyeti / disCepheSec / yurumeMaliyeti
function ekYuklemeMaliyeti(floorStr, elevatorVal, merdivenTablo, disCepheTutar) {
  const kat = parseInt(floorStr, 10);
  if (Number.isNaN(kat)) return 0;
  if (elevatorVal === 'bina_asansoru') return 0;
  if (elevatorVal === 'dis_cephe') {
    if (kat < 2) return 0;
    if (typeof disCepheTutar === 'object') return kat >= 9 ? (disCepheTutar.yuksek || disCepheTutar.normal) : disCepheTutar.normal;
    return disCepheTutar;
  }
  if (kat <= 2) return 0;
  if (merdivenTablo[kat] !== undefined) return merdivenTablo[kat];
  let enUst = 0;
  Object.keys(merdivenTablo).forEach(k => { const n = parseInt(k, 10); if (n > enUst) enUst = n; });
  if (enUst && kat > enUst) return merdivenTablo[enUst] + (kat - enUst) * 2000;
  return 0;
}
const disCepheSec = (tablo, yaka) => (yaka === 'avrupa' ? { normal: tablo.avrupa, yuksek: tablo.avrupa913 } : { normal: tablo.anadolu, yuksek: tablo.anadolu913 });
const yurumeMaliyeti = (deger, tablo) => (!deger || deger === 'yok' ? 0 : (tablo[deger] || 0));

// Sihirbazdaki calculatePriceKmsiz — taban toplam (yuvarlanmamış)
export function sembolKmsizToplam(T, s) {
  const fiyatKategorisi = KM_ODA[s.homeSize] || s.homeSize;
  const fromC = tarifeIli(s.fromCity), toC = tarifeIli(s.toCity);
  const sameCity = !(!fromC || !toC || fromC !== toC);
  let anaBedel, ekYuklemeBedel, toplamaBedel = 0;
  const fromYaka = istanbulYakasiBul(s.fromCity, s.fromDistrict);
  const toYaka = istanbulYakasiBul(s.toCity, s.toDistrict);
  if (sameCity) {
    anaBedel = T.SEHIR_ICI_TABAN[fiyatKategorisi] || T.SEHIR_ICI_TABAN['4+1'];
    if (s.paketleme === 'firma') toplamaBedel = T.SEHIR_ICI_TOPLAMA[fiyatKategorisi] || T.SEHIR_ICI_TOPLAMA['4+1'];
    ekYuklemeBedel = ekYuklemeMaliyeti(s.fromFloor, s.fromElevator, T.SEHIR_ICI_MERDIVEN, disCepheSec(T.SEHIR_ICI_DIS_CEPHE, fromYaka))
      + ekYuklemeMaliyeti(s.toFloor, s.toElevator, T.SEHIR_ICI_MERDIVEN, disCepheSec(T.SEHIR_ICI_DIS_CEPHE, toYaka));
    ekYuklemeBedel += yurumeMaliyeti(s.fromYurume, T.SEHIR_ICI_YURUME) + yurumeMaliyeti(s.toYurume, T.SEHIR_ICI_YURUME);
    if (fromYaka === 'avrupa' || toYaka === 'avrupa') anaBedel += T.SEHIR_ICI_AVRUPA_EKSTRA[fiyatKategorisi] || T.SEHIR_ICI_AVRUPA_EKSTRA['4+1'];
  } else {
    let digerSehir = null;
    if (fromC === 'İstanbul') digerSehir = toC;
    else if (toC === 'İstanbul') digerSehir = fromC;
    const tarife = digerSehir ? T.SEHIRLERARASI_FIYAT[digerSehir] : null;
    if (tarife) anaBedel = tarife[fiyatKategorisi] || tarife['4+1'];
    else {
      const f1 = T.SEHIRLERARASI_FIYAT[fromC], f2 = T.SEHIRLERARASI_FIYAT[toC];
      const v1 = f1 ? (f1[fiyatKategorisi] || f1['4+1']) : 0;
      const v2 = f2 ? (f2[fiyatKategorisi] || f2['4+1']) : 0;
      if (v1 && v2) anaBedel = Math.round((v1 + v2) / 2);
      else anaBedel = v1 || v2 || (T.SEHIR_ICI_TABAN['4+1'] * 2);
    }
    if (s.paketleme === 'firma') toplamaBedel = T.SEHIRLERARASI_TOPLAMA[fiyatKategorisi] || T.SEHIRLERARASI_TOPLAMA['4+1'];
    ekYuklemeBedel = ekYuklemeMaliyeti(s.fromFloor, s.fromElevator, T.SEHIRLERARASI_MERDIVEN, disCepheSec(T.SEHIRLERARASI_DIS_CEPHE, fromYaka))
      + ekYuklemeMaliyeti(s.toFloor, s.toElevator, T.SEHIRLERARASI_MERDIVEN, disCepheSec(T.SEHIRLERARASI_DIS_CEPHE, toYaka));
    ekYuklemeBedel += yurumeMaliyeti(s.fromYurume, T.SEHIRLERARASI_YURUME) + yurumeMaliyeti(s.toYurume, T.SEHIRLERARASI_YURUME);
  }
  return anaBedel + toplamaBedel + ekYuklemeBedel;
}
// Sihirbazdaki fiyatiUygula
export const sembolAralik = (T, toplam) => ({
  min: Math.round(toplam / 100) * 100,
  max: Math.ceil((toplam * (1 + T.FIYAT_ARALIK_YUZDE / 100)) / T.FIYAT_YUVARLAMA) * T.FIYAT_YUVARLAMA,
});

// ---- km modu: CRM "Hızlı Fiyat Hesapla" kurallarıyla ek hizmetler (sihirbazdaki crm* fonksiyonları)
function crmMerdiven(tablo, kat) {
  let v = tablo[Math.min(kat, 7)];
  if (v === undefined) v = tablo[5];
  return v || 0;
}
function crmDisCephe(tablo, yaka, kat) {
  if (kat >= 10) { const y = tablo[yaka + '913']; if (y) return y; }
  return tablo[yaka] || 0;
}
function crmAdresEk(katStr, asansor, yurume, il, ilce, MERDIVEN, DIS_CEPHE, YURUME) {
  let kat = parseInt(katStr, 10);
  if (Number.isNaN(kat)) kat = 0;
  let ek = 0;
  if (asansor === 'merdiven') { if (kat >= 3) ek += crmMerdiven(MERDIVEN, kat); }
  else if (asansor === 'dis_cephe') {
    let yaka = 'avrupa';
    if (istanbulMu(il)) yaka = istanbulYakasiBul(il, ilce) === 'avrupa' ? 'avrupa' : 'anadolu';
    ek += crmDisCephe(DIS_CEPHE, yaka, kat);
  }
  ek += yurumeMaliyeti(yurume, YURUME);
  return ek;
}
function sembolEkHizmetBedeli(T, s, odaK, ikisiIstanbul) {
  const TOPLAMA = ikisiIstanbul ? T.SEHIR_ICI_TOPLAMA : T.SEHIRLERARASI_TOPLAMA;
  const MERDIVEN = ikisiIstanbul ? T.SEHIR_ICI_MERDIVEN : T.SEHIRLERARASI_MERDIVEN;
  const DIS_CEPHE = ikisiIstanbul ? T.SEHIR_ICI_DIS_CEPHE : T.SEHIRLERARASI_DIS_CEPHE;
  const YURUME = ikisiIstanbul ? T.SEHIR_ICI_YURUME : T.SEHIRLERARASI_YURUME;
  let ek = 0;
  if (s.paketleme === 'firma') ek += TOPLAMA[odaK] || TOPLAMA['4+1'] || 0;
  ek += crmAdresEk(s.fromFloor, s.fromElevator, s.fromYurume, s.fromCity, s.fromDistrict, MERDIVEN, DIS_CEPHE, YURUME);
  ek += crmAdresEk(s.toFloor, s.toElevator, s.toYurume, s.toCity, s.toDistrict, MERDIVEN, DIS_CEPHE, YURUME);
  return ek;
}
// Sihirbazdaki kmGovdesi — /api/mesafe-site gövdesi; uygun değilse null (→ km'siz hesap)
export function sembolKmGovdesi(T, s) {
  if (!T.MESAFE_AKTIF) return null;
  if (!s.homeSize || !s.fromCity || !s.fromDistrict || !s.toCity || !s.toDistrict) return null;
  if (!TURKEY_LOCATIONS[s.fromCity] || !TURKEY_LOCATIONS[s.toCity] || !IL_SIRASI.includes(s.fromCity) || !IL_SIRASI.includes(s.toCity)) return null;
  const odaK = KM_ODA[s.homeSize] || '4+1';
  const ikisiIstanbul = istanbulMu(s.fromCity) && istanbulMu(s.toCity);
  const taban = T.SEHIR_ICI_TABAN[odaK] || T.SEHIR_ICI_TABAN['4+1'];
  const avrupa = (s.fromCity === 'İstanbul (Avrupa)' || s.toCity === 'İstanbul (Avrupa)')
    ? (T.SEHIR_ICI_AVRUPA_EKSTRA[odaK] || T.SEHIR_ICI_AVRUPA_EKSTRA['4+1'] || 0) : 0;
  return {
    yukIl: s.fromCity, yukIlce: s.fromDistrict, bosIl: s.toCity, bosIlce: s.toDistrict,
    hesap: { odaK, araToplam: taban + sembolEkHizmetBedeli(T, s, odaK, ikisiIstanbul), avrupaEkstra: avrupa },
  };
}

// =============================================================== DEPOEVİM
// Sihirbazın yedek değerleri — referans/depoevim-sihirbaz-teklif-canli-2026-10-06.js
const DEPOEVIM_YEDEK = {
  TABAN_FIYATLAR: { 10: 4500, 15: 6000, 22: 7500, 30: 9000 },
  UCRETSIZ_AY: { 1: 0, 6: 1, 12: 2 },
  ISTANBUL_ICI_NAKLIYE_TABAN: { '1+0': 14000, '1+1': 18000, '2+1': 25000, '3+1': 30000 },
  SEHIRLER_ARASI_NAKLIYE: {},
  AVRUPA_YAKASI_NAKLIYE_EKSTRA: { '1+0': 4000, '1+1': 5000, '2+1': 6000, '3+1': 10000 },
  NAKLIYE_ARALIK_YUZDE: 25,
  NAKLIYE_YUVARLAMA: 500,
  NAK_SEHIR_ICI: { toplama: { '1+0': 2000, '1+1': 4000, '2+1': 6000, '3+1': 8000, '4+1': 10000 }, merdiven: { 3: 1000, 4: 3000, 5: 5000, 6: 7000, 7: 9000 }, disCephe: { anadolu: 4000, avrupa: 5000, anadolu913: 7000, avrupa913: 9000 }, yurume: { m50: 3000, m100: 6000, m150: 9000, m200: 12000 } },
  NAK_SEHIRLERARASI: { toplama: { '1+0': 3500, '1+1': 5500, '2+1': 9000, '3+1': 11000, '4+1': 16500 }, merdiven: { 3: 2500, 4: 4500, 5: 6500, 6: 8500, 7: 10500 }, disCephe: { anadolu: 3500, avrupa: 5000, anadolu913: 5500, avrupa913: 7500 }, yurume: { m50: 4000, m100: 7000, m150: 10000, m200: 13000 } },
  SUBE_KIRA: null,
  MESAFE_AKTIF: false,
};
export const DEPO_BOYUT_TIER = { 10: '1+0', 15: '1+1', 22: '2+1', 30: '3+1' };
const SEHIRLER_ARASI_TIER_INDEX = { '1+1': 0, '2+1': 1, '3+1': 2, '4+1': 3 };
// Bot ek: Pendik şubesi de seçilebilir (sitede yok) — fiyatı Fiyat Tablosu'ndaki Pendik satırı
const SUBE_ANAHTAR = { kartal: 'kartal', umraniye: 'umraniye', cekmekoy: 'cekmekoy', basaksehir: 'basaksehir', pendik: 'pendik', farketmez: 'genel' };
export const DEPOEVIM_SUBELERI = Object.keys(SUBE_ANAHTAR);

const degerleriAktar = (kaynak, hedef) => { if (kaynak) Object.keys(kaynak).forEach(k => { const v = snwSayi(kaynak[k]); if (v) hedef[k] = v; }); };
function ekTablolariAktar(g, hedef) {
  if (g.toplama) degerleriAktar(g.toplama.degerler, hedef.toplama);
  if (g.disCepheAsansor) degerleriAktar(g.disCepheAsansor.degerler, hedef.disCephe);
  if (g.yurumeMesafesi) degerleriAktar(g.yurumeMesafesi.degerler, hedef.yurume);
  if (g.merdiven) {
    const md = g.merdiven.degerler || {};
    Object.keys(md).forEach(k => { const v = snwSayi(md[k]); if (v) hedef.merdiven[String(k).replace('kat', '')] = v; });
  }
}
// Sihirbazdaki crmFiyatlariUygula — j: /api/fiyatlar?site=depoevim yanıtı
export function depoevimTablolari(j) {
  const T = kopya(DEPOEVIM_YEDEK);
  if (!j) return T;
  const n = j.esyaDepolamaNakliye || {};
  const si = n.sehirIci || {};
  if (si.nakliyeTaban) degerleriAktar(si.nakliyeTaban.degerler, T.ISTANBUL_ICI_NAKLIYE_TABAN);
  if (si.avrupaYakasiEkstra) degerleriAktar(si.avrupaYakasiEkstra.degerler, T.AVRUPA_YAKASI_NAKLIYE_EKSTRA);
  const ild = ((n.sehirlerArasi || {}).iller || {}).degerler || {};
  Object.keys(ild).forEach(slug => {
    const il = ild[slug];
    if (!il || !il.etiket || !il.degerler) return;
    const satir = ['1+1', '2+1', '3+1', '4+1'].map(t => snwSayi(il.degerler[t]));
    if (satir.indexOf(0) === -1) T.SEHIRLER_ARASI_NAKLIYE[il.etiket] = satir;
  });
  ekTablolariAktar(si, T.NAK_SEHIR_ICI);
  ekTablolariAktar(n.sehirlerArasi || {}, T.NAK_SEHIRLERARASI);
  if (snwSayi(n.aralikYuzdesi)) T.NAKLIYE_ARALIK_YUZDE = n.aralikYuzdesi;
  if (snwSayi(n.yuvarlama)) T.NAKLIYE_YUVARLAMA = n.yuvarlama;
  const kd = j.kiralikDepo || {};
  if (kd.subeler) {
    T.SUBE_KIRA = kd.subeler;
    const genel = kd.subeler.genel ? (kd.subeler.genel.degerler || {}) : {};
    Object.keys(DEPO_BOYUT_TIER).forEach(m3 => { const v = snwSayi(genel[DEPO_BOYUT_TIER[m3]]); if (v) T.TABAN_FIYATLAR[m3] = v; });
  }
  if (Array.isArray(kd.kampanyalar)) kd.kampanyalar.forEach(k => {
    if (!k) return;
    const hediye = (Number(k.toplamAy) || 0) - (Number(k.odenecekAy) || 0);
    if (hediye >= 0) T.UCRETSIZ_AY[k.id] = hediye;
  });
  T.KDV_ORANI = Number(kd.kdvOrani) || 20;
  T.MESAFE_AKTIF = !!(j.mesafe || {}).aktif;
  return T;
}
function subeAylikFiyat(T, sube, boyut) {
  const tier = DEPO_BOYUT_TIER[boyut];
  if (T.SUBE_KIRA && tier) {
    const s = T.SUBE_KIRA[SUBE_ANAHTAR[sube] || 'genel'] || T.SUBE_KIRA.genel;
    if (s && s.degerler) { const v = snwSayi(s.degerler[tier]); if (v) return v; }
  }
  return T.TABAN_FIYATLAR[boyut] || 4500;
}
// Kira (KDV hariç): aylık, peşin toplam, hediye ay
export function depoevimKira(T, s) {
  const aylik = subeAylikFiyat(T, s.sube, s.depoBoyutu);
  const sure = parseInt(s.kiralamaSuresi, 10) || 1;
  const ucretsizAy = T.UCRETSIZ_AY[s.kiralamaSuresi] || 0;
  const odenecekAy = Math.max(sure - ucretsizAy, 1);
  return { aylik, toplam: aylik * odenecekAy, sureAy: sure, ucretsizAy, odenecekAy };
}
function avrupaYakasiMi(il, ilce) {
  if (il === 'İstanbul (Avrupa)') return true;
  if (il === 'İstanbul (Anadolu)') return false;
  if (il !== 'İstanbul' || !ilce) return false;
  return AVRUPA_ILCELERI.includes(ilce);
}
function nakliyeEkMaliyet(T, s, tier) {
  const N = istanbulMu(s.pickupCity) ? T.NAK_SEHIR_ICI : T.NAK_SEHIRLERARASI;
  let toplam = 0;
  if (s.paketleme === 'firma') toplam += N.toplama[tier] || N.toplama['1+1'] || 0;
  const kat = parseInt(s.pickupFloor, 10);
  if (!Number.isNaN(kat)) {
    if (s.pickupElevator === 'dis_cephe') {
      if (kat >= 2) {
        const yaka = avrupaYakasiMi(s.pickupCity, s.pickupDistrict) ? 'avrupa' : 'anadolu';
        toplam += N.disCephe[yaka + (kat >= 9 ? '913' : '')] || N.disCephe[yaka] || 0;
      }
    } else if (s.pickupElevator === 'merdiven' && kat > 2) {
      const m = N.merdiven;
      if (m[kat] !== undefined) toplam += m[kat];
      else {
        let enUst = 0;
        Object.keys(m).forEach(k => { const x = parseInt(k, 10); if (x > enUst) enUst = x; });
        if (enUst && kat > enUst) toplam += m[enUst] + (kat - enUst) * 2000;
      }
    }
  }
  if (s.pickupYurume && s.pickupYurume !== 'yok') toplam += N.yurume[s.pickupYurume] || 0;
  return toplam;
}
function nakliyeTabanFiyati(T, il, tier) {
  if (!il) return null;
  if (istanbulMu(il)) return T.ISTANBUL_ICI_NAKLIYE_TABAN[tier] || T.ISTANBUL_ICI_NAKLIYE_TABAN['1+1'];
  const row = T.SEHIRLER_ARASI_NAKLIYE[il];
  if (!row) return null;
  if (tier === '1+0') return row[0];
  const idx = SEHIRLER_ARASI_TIER_INDEX[tier];
  return typeof idx === 'number' ? row[idx] : row[0];
}
function depoevimCrmEkMaliyet(T, s, odaK) {
  const N = istanbulMu(s.pickupCity) ? T.NAK_SEHIR_ICI : T.NAK_SEHIRLERARASI;
  let ek = 0;
  if (s.paketleme === 'firma') ek += N.toplama[odaK] || N.toplama['4+1'] || 0;
  let kat = parseInt(s.pickupFloor, 10);
  if (Number.isNaN(kat)) kat = 0;
  if (s.pickupElevator === 'merdiven') {
    if (kat >= 3) { let m = N.merdiven[Math.min(kat, 7)]; if (m === undefined) m = N.merdiven[5]; ek += m || 0; }
  } else if (s.pickupElevator === 'dis_cephe') {
    let yaka = 'avrupa';
    if (istanbulMu(s.pickupCity)) yaka = avrupaYakasiMi(s.pickupCity, s.pickupDistrict) ? 'avrupa' : 'anadolu';
    let d = 0;
    if (kat >= 10) d = N.disCephe[yaka + '913'] || 0;
    if (!d) d = N.disCephe[yaka] || 0;
    ek += d;
  }
  if (s.pickupYurume && s.pickupYurume !== 'yok') ek += N.yurume[s.pickupYurume] || 0;
  return ek;
}
// Sihirbazdaki kmGovdesi (DepoEvim)
export function depoevimKmGovdesi(T, s) {
  if (!T.MESAFE_AKTIF) return null;
  if (s.teslimSekli !== 'anahtar_teslim') return null;
  if (!s.depoBoyutu || !s.sube || !s.pickupCity || !s.pickupDistrict) return null;
  if (!TURKEY_LOCATIONS[s.pickupCity] || !IL_SIRASI.includes(s.pickupCity)) return null;
  const odaK = DEPO_BOYUT_TIER[s.depoBoyutu] || '4+1';
  const taban = T.ISTANBUL_ICI_NAKLIYE_TABAN[odaK];
  if (!taban) return null;
  const avrupa = (s.pickupCity === 'İstanbul (Avrupa)' || s.sube === 'basaksehir') ? (T.AVRUPA_YAKASI_NAKLIYE_EKSTRA[odaK] || 0) : 0;
  return {
    yukIl: s.pickupCity, yukIlce: s.pickupDistrict, sube: s.sube,
    hesap: { odaK, araToplam: taban + depoevimCrmEkMaliyet(T, s, odaK), avrupaEkstra: avrupa },
  };
}
// Sihirbazdaki calculatePrice (nakliye kısmı). kmS: { taban, avr, avrupaEkstra } | null
export function depoevimNakliye(T, s, kmS = null) {
  if (s.teslimSekli !== 'anahtar_teslim' || !s.pickupCity) return null;
  let min = 0, ekstra = 0;
  const tier = DEPO_BOYUT_TIER[s.depoBoyutu] || '1+1';
  const taban = nakliyeTabanFiyati(T, s.pickupCity, tier);
  if (taban) {
    if (avrupaYakasiMi(s.pickupCity, s.pickupDistrict)) ekstra = T.AVRUPA_YAKASI_NAKLIYE_EKSTRA[tier] || 0;
    min = taban + ekstra + nakliyeEkMaliyet(T, s, tier);
  }
  if (kmS) { ekstra = kmS.avr ? kmS.avrupaEkstra : 0; min = kmS.taban; }
  if (!min) return null;
  const max = Math.ceil((min * (1 + T.NAKLIYE_ARALIK_YUZDE / 100)) / T.NAKLIYE_YUVARLAMA) * T.NAKLIYE_YUVARLAMA;
  return { min, max, avrupaEkstra: ekstra };
}

// ============================================================= BOT GİRİŞİ
// Fiyat için gereken alanlar (sihirbazların doğrulama adımlarıyla aynı)
const SEMBOL_GEREKLI = ['homeSize', 'fromCity', 'fromDistrict', 'fromFloor', 'fromElevator', 'fromYurume',
  'toCity', 'toDistrict', 'toFloor', 'toElevator', 'toYurume', 'paketleme'];
const DEPO_GEREKLI = ['depoBoyutu', 'kiralamaSuresi', 'sube', 'teslimSekli'];
const DEPO_ALIM_GEREKLI = ['pickupCity', 'pickupDistrict', 'pickupFloor', 'pickupElevator', 'paketleme', 'pickupYurume'];
const bos = (v) => v == null || v === '';

// Botun topladığı alanları sihirbaz değerlerine çevirir (il/ilçe adları, ofis vb.).
// Dönen "s" sihirbaz "state"i gibidir; "konumHatalari" bot tarafından müşteriye sorulur.
export function botDurumuHazirla(marka, alanlar) {
  const s = { ...alanlar };
  const konumHatalari = [];
  const ciftler = marka === 'depoevim' ? [['pickupCity', 'pickupDistrict']] : [['fromCity', 'fromDistrict'], ['toCity', 'toDistrict']];
  ciftler.forEach(([ilK, ilceK]) => {
    if (bos(s[ilK])) return;
    const k = konumNormalize(s[ilK], s[ilceK]);
    if (k) { s[ilK] = k.il; s[ilceK] = k.ilce || s[ilceK] || ''; } else konumHatalari.push(ilK);
  });
  if (marka === 'depoevim' && s.sube && !SUBE_ANAHTAR[s.sube]) s.sube = 'farketmez';
  return { s, konumHatalari };
}

// Botun günlük Google sorgu sayacı — sitelerin sayacından AYRI (biri diğerini kilitlemez)
export function botGoogleSayaci(db, env = process.env, simdi = Date.now()) {
  const sinir = Number(env.WHATSAPP_GUNLUK_GOOGLE) > 0 ? Number(env.WHATSAPP_GUNLUK_GOOGLE) : 300;
  return () => sayacArtir(db, `google_bot_${gunDamgasi(simdi)}`, sinir, 2 * 86400000, simdi, 'Bot günlük km sorgu sınırı doldu.');
}

const fiyatBelgesiOku = async (db, appId) => {
  const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('ayarlar').doc('fiyatTablosu').get();
  return snap.exists ? snap.data() : null;
};

// Ana giriş. marka: 'sembol' | 'depoevim'; alanlar: botun topladığı (sihirbaz adlarıyla) alanlar.
// Döner:
//   { durum: 'eksik', eksik: [...], konumHatalari: [...] }
//   { durum: 'fiyat_yok', sebep: 'ofis' }                       → bot devreder
//   { durum: 'hata' }                                            → bot fiyat vermez, devreder
//   Sembol:   { durum: 'tamam', min, max, kaynak: 'km'|'tablo', toplamKm }
//   DepoEvim: { durum: 'tamam', kdvHaric: true, kira: {...}, nakliye: {min,max,avrupaEkstra,kaynak}|null, nakliyeEksik: [...] }
export async function botFiyatHesapla({ db, marka, alanlar = {}, env = process.env, appId = process.env.FIRESTORE_APP_ID,
  kmHesapla = kmRotaFiyat, simdi = Date.now() } = {}) {
  const { s, konumHatalari } = botDurumuHazirla(marka, alanlar);
  if (marka !== 'depoevim' && s.homeSize === 'ofis') return { durum: 'fiyat_yok', sebep: 'ofis' };
  const gerekli = marka === 'depoevim' ? DEPO_GEREKLI : SEMBOL_GEREKLI;
  const eksik = gerekli.filter(k => bos(s[k]));
  if (eksik.length || (marka !== 'depoevim' && konumHatalari.length)) return { durum: 'eksik', eksik, konumHatalari };

  let belge;
  try { belge = await fiyatBelgesiOku(db, appId); } catch (err) { console.error('[fiyatHesap] fiyat tablosu okunamadı:', err?.message); return { durum: 'hata' }; }
  if (!belge) return { durum: 'hata' };
  const site = marka === 'depoevim' ? 'depoevim' : 'sembol';
  const j = fiyatApiYaniti(belge, site);
  const T = marka === 'depoevim' ? depoevimTablolari(j) : sembolTablolari(j);

  // Km fiyatı (mesafe-site ile aynı fonksiyon); her hatada sessizce km'siz hesaba düşülür
  const kmDene = async (govde) => {
    if (!govde) return null;
    try {
      const M = await kmAyarlariOku(db);
      if (!mesafeModuAcik(M)) return null;
      const yuk = siteNoktasi(govde.yukIl, govde.yukIlce);
      const sube = govde.sube !== undefined ? subeBul(govde.sube) : null;
      const bosN = sube ? ilceMerkezAdresi(sube.province, sube.district) : siteNoktasi(govde.bosIl, govde.bosIlce);
      if (!yuk || !bosN) return null;
      const r = await kmHesapla({ db, M, yuk, bos: bosN, sube, hesap: govde.hesap, googleOncesi: botGoogleSayaci(db, env, simdi) });
      const t = snwSayi(r?.fiyat?.tabanFiyat);
      return t ? { taban: t, avr: !!r.fiyat.avrupaEkstraUygulandi, toplamKm: r.toplamKm } : null;
    } catch (err) {
      console.warn('[fiyatHesap] km alınamadı, km\'siz hesaba düşülüyor:', err?.message);
      return null;
    }
  };

  if (marka === 'depoevim') {
    const kira = depoevimKira(T, s);
    let nakliye = null;
    let nakliyeEksik = [];
    if (s.teslimSekli === 'anahtar_teslim') {
      nakliyeEksik = DEPO_ALIM_GEREKLI.filter(k => bos(s[k]));
      if (konumHatalari.length) nakliyeEksik = [...new Set([...nakliyeEksik, ...konumHatalari])];
      if (!nakliyeEksik.length) {
        const govde = depoevimKmGovdesi(T, s);
        const km = await kmDene(govde);
        const n = depoevimNakliye(T, s, km ? { ...km, avrupaEkstra: govde.hesap.avrupaEkstra } : null);
        if (n) nakliye = { ...n, kaynak: km ? 'km' : 'tablo', ...(km ? { toplamKm: km.toplamKm } : {}) };
      }
    }
    return { durum: 'tamam', marka: 'depoevim', kdvHaric: true, kdvOrani: T.KDV_ORANI, kira, nakliye, nakliyeEksik };
  }

  const km = await kmDene(sembolKmGovdesi(T, s));
  const toplam = km ? km.taban : sembolKmsizToplam(T, s);
  return { durum: 'tamam', marka: 'sembol', ...sembolAralik(T, toplam), taban: toplam, kaynak: km ? 'km' : 'tablo', ...(km ? { toplamKm: km.toplamKm } : {}) };
}

// Lead kaydına yazılacak fiyat (api/_lib/lead.js → whatsappLeadKaydi "fiyat" parametresi)
export function leadFiyati(sonuc) {
  if (!sonuc || sonuc.durum !== 'tamam') return null;
  if (sonuc.marka === 'depoevim') return { aylik: sonuc.kira.aylik, toplam: sonuc.kira.toplam, ...(sonuc.nakliye ? { nakliyeMin: sonuc.nakliye.min, nakliyeMax: sonuc.nakliye.max } : {}) };
  return { min: sonuc.min, max: sonuc.max };
}
