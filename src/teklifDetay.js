// src/teklifDetay.js
// ============================================================================
// TEKLİF DETAYI — DEPOLAMA KAYITLARININ SATIRLARI (Sembol + DepoEvim)
// ----------------------------------------------------------------------------
// submit-lead, Sembol "Eşya Depolama" ve DepoEvim sihirbazlarından gelen ham
// alanları kayda "teklifAlanlari" olarak yazar. Müşteri Havuzu'ndaki "Teklif
// Detayı" kartı bu kayıtlarda satırları sonMesaj metnini ayrıştırarak DEĞİL,
// bu alanlardan tek tek üretir (metin ayrıştırma bu formlarda satırları
// birbirine yapıştırıyordu). teklifAlanlari olmayan eski kayıtlar eskisi gibi
// metinden gösterilir.
//
// Dönen şekil teklifOzetiAyristir ile aynıdır: { baslik, ozet, satirlar }
// satır: { etiket, deger, para }
// ============================================================================

const ASANSOR = {
  var: 'Bina asansörü', bina_asansoru: 'Bina asansörü',
  yok: 'Merdivenden', merdiven: 'Merdivenden',
  dis_cephe: 'Dış cephe asansörü',
};
const TOPLAMA = { kendim: 'Kendim toplayacağım', hayir: 'Kendim toplayacağım', firma: 'Firma toplasın', kismi: 'Kısmi toplama' };
const ULASIM = {
  yok: 'Kendim getireceğim', kendim: 'Kendim getireceğim',
  alim: 'Firma alacak', anahtar_teslim: 'Firma alacak',
  alim_teslim: 'Firma alacak ve teslim edecek',
};
const YANASMA = {
  yok: 'Araç binaya yanaşıyor',
  m50: 'Yanaşmıyor · yaklaşık 50 m', m100: 'Yanaşmıyor · yaklaşık 100 m',
  m150: 'Yanaşmıyor · yaklaşık 150 m', m200: 'Yanaşmıyor · yaklaşık 200 m',
};
const SURE = { '1': 'Aylık', '6': '6 Aylık Peşin (1 ay hediye)', '12': 'Yıllık Peşin (2 ay hediye)' };
const HACIM = { '1+0': '1+0 Depo (10 m³)', '1+1': '1+1 Depo (15 m³)', '2+1': '2+1 Depo (22 m³)', '3+1': '3+1 Depo (30 m³)' };
const DEPOEVIM_BOYUT = { '10': '10 m³ Depo', '15': '15 m³ Depo', '22': '22 m³ Depo', '30': '30 m³ Depo' };
const SUBE = {
  kartal: 'Kartal Şubesi', umraniye: 'Ümraniye Şubesi', cekmekoy: 'Çekmeköy Şubesi',
  basaksehir: 'Başakşehir Şubesi', farketmez: 'Şube farketmez',
};

const metin = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const etiketle = (sozluk, v) => (metin(v) ? (sozluk[metin(v)] || metin(v)) : '');
const tl = (n) => `${Math.round(Number(n)).toLocaleString('tr-TR')} TL`;
const sayiVar = (n) => Number.isFinite(Number(n)) && Number(n) > 0;
const aralik = (min, max) => {
  if (!sayiVar(min) && !sayiVar(max)) return '';
  if (!sayiVar(max) || Number(max) === Number(min)) return tl(sayiVar(min) ? min : max);
  if (!sayiVar(min)) return tl(max);
  return `${Math.round(Number(min)).toLocaleString('tr-TR')} – ${tl(max)}`;
};
const katMetni = (v) => {
  const s = metin(v);
  if (!s) return '';
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || String(n) !== s) return s;
  return n <= 0 ? 'Giriş Kat' : `${n}. Kat`;
};
const trTarih = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('.') : s);
// Tarih + hızlı seçim + not. Sihirbaz tarih yoksa hızlı seçimi (ya da "esnek")
// tarih alanına da koyuyor — aynı değer iki kez yazılmaz.
const tarihMetni = (tarih, tercih, not, esnek, bosIse) => {
  const t = metin(tarih), tc = metin(tercih), n = metin(not);
  const tarihGecerli = t && t.toLocaleLowerCase('tr-TR') !== 'esnek' && t !== tc;
  const parcalar = [tarihGecerli && !esnek ? trTarih(t) : '', tc, n].filter(Boolean);
  if (parcalar.length) return parcalar.join(' · ');
  return esnek || t.toLocaleLowerCase('tr-TR') === 'esnek' ? 'Esnek' : bosIse;
};
const yer = (il, ilce) => [metin(il), metin(ilce)].filter(Boolean).join('/');

const satirlariTopla = (liste) => liste.filter(s => s.deger).map(s => ({ para: false, ...s }));
const fiyatSatirlari = (a) => [
  { etiket: 'Aylık Kira', deger: sayiVar(a.fiyatAylik) ? `${tl(a.fiyatAylik)} + KDV` : '', para: true },
  { etiket: 'Kira Toplamı', deger: sayiVar(a.fiyatToplam) ? tl(a.fiyatToplam) : '', para: true },
  { etiket: 'Nakliye', deger: aralik(a.nakliyeMin, a.nakliyeMax), para: true },
  { etiket: 'Sistem Fiyat Tahmini', deger: aralik(a.priceMin, a.priceMax), para: true },
];

// Sembol — sembolevdeneve.com/fiyat-teklifi-al/esya-depolama (source: web-wizard-depolama)
const sembolDepolama = (a) => {
  const firmaAlacak = metin(a.alimTeslim) !== 'yok';
  const nereden = yer(a.fromCity, a.fromDistrict);
  return {
    ozet: nereden ? `${nereden} → Depo` : '',
    satirlar: satirlariTopla([
      { etiket: 'Depo Hacmi', deger: etiketle(HACIM, a.homeSize) },
      { etiket: 'Kat', deger: firmaAlacak ? katMetni(a.fromFloor) : '' },
      { etiket: 'Asansör', deger: firmaAlacak ? etiketle(ASANSOR, a.fromElevator) : '' },
      { etiket: 'Kiralama Süresi', deger: etiketle(SURE, a.sureKiralama) },
      { etiket: 'Depoya Ulaşım', deger: etiketle(ULASIM, a.alimTeslim) },
      { etiket: 'Toplama', deger: firmaAlacak ? etiketle(TOPLAMA, a.paketleme) : '' },
      { etiket: 'Araç Yanaşma', deger: firmaAlacak ? etiketle(YANASMA, a.fromYurume) : '' },
      { etiket: 'Giriş Tarihi', deger: tarihMetni(a.moveDate, a.tarihTercihi, a.tarihNotu, a.dateFlexible === true, '') },
      ...fiyatSatirlari(a),
    ]),
  };
};

// DepoEvim — depoevim.com/fiyat-teklifi-al (source: depoevim-esya-depolama-wizard)
const depoevimDepolama = (a) => {
  const firmaAlacak = metin(a.teslimSekli) === 'anahtar_teslim';
  const nereden = firmaAlacak ? yer(a.pickupCity, a.pickupDistrict) : '';
  return {
    ozet: nereden ? `${nereden} → Depo` : '',
    satirlar: satirlariTopla([
      { etiket: 'Depo Hacmi', deger: etiketle(DEPOEVIM_BOYUT, a.depoBoyutu) },
      { etiket: 'Şube', deger: etiketle(SUBE, a.sube) },
      { etiket: 'Kiralama Süresi', deger: etiketle(SURE, a.kiralamaSuresi) },
      { etiket: 'Depoya Ulaşım', deger: etiketle(ULASIM, a.teslimSekli) },
      { etiket: 'Kat', deger: firmaAlacak ? katMetni(a.pickupFloor) : '' },
      { etiket: 'Asansör', deger: firmaAlacak ? etiketle(ASANSOR, a.pickupElevator) : '' },
      { etiket: 'Toplama', deger: firmaAlacak ? etiketle(TOPLAMA, a.paketleme) : '' },
      { etiket: 'Araç Yanaşma', deger: firmaAlacak ? etiketle(YANASMA, a.pickupYurume) : '' },
      // Sihirbaz "esnek" göndermiyor: hiçbir tarih bilgisi yoksa "Esnek"
      { etiket: 'Giriş Tarihi', deger: tarihMetni(a.baslangicTarihi, a.tarihTercihi, a.tarihNotu, false, 'Esnek') },
      ...fiyatSatirlari(a),
    ]),
  };
};

const TURLER = { depolama: sembolDepolama, depoevimDepolama };

// Kayıtta tanınan "teklifAlanlari" varsa satırları üretir, yoksa null döner
// (çağıran eski metin ayrıştırmaya düşer).
export const teklifDetayiAlanlardan = (kayit, baslik = '') => {
  const a = kayit?.teklifAlanlari;
  const uret = a && TURLER[a.tur];
  if (!uret) return null;
  const { ozet, satirlar } = uret(a);
  return { baslik, ozet, satirlar, ham: '' };
};
