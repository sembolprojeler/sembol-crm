// src/fiyatSema.js
// ============================================================================
// FİYAT TABLOSU ŞEMASI — CRM ekranı ile /api/fiyatlar'ın ORTAK tanımı
// ----------------------------------------------------------------------------
// Fiyat verisinin kendisi Firestore'dadır:
//   artifacts/{appId}/public/data/ayarlar/fiyatTablosu
// Bu dosya yalnızca verinin ŞEKLİNİ tanımlar: hangi grup/satır var, ekrandaki
// başlıkları (etiket) ve web sitelerine verilen sabit anahtarları (slug).
// Fiyat Tablosu penceresi başlıklarını buradan çizer, API aynı başlıkları
// "etiket" alanında döndürür — ikisi hiçbir zaman ayrışmaz.
//
// React / Firebase içermez; hem tarayıcıda (Satis.jsx) hem Vercel
// fonksiyonunda (api/fiyatlar.js) çalışır.
// ============================================================================

export const FIYAT_ODALAR = ['1+0', '1+1', '2+1', '3+1', '4+1'];
// 81 il tablosunun sütunları (1+0 için 1+1 sütunu kullanılır)
export const FIYAT_IL_SUTUNLARI = ['1+1', '2+1', '3+1', '4+1'];
// Açılış (aralık üst sınırı) fiyatı bu adıma YUKARI yuvarlanır
export const FIYAT_YUVARLAMA = 500;
export const FIYAT_KDV_ORANI = 20;

// Depo boyutları — depoevim.com/depo-fiyatlarimiz (Eylül 2026), +%20 KDV.
// "aylik" yalnızca PDF varsayılanıdır; geçerli kira Firestore'daki depoKira'dır.
export const DEPO_BOYUTLARI = [
  { id: '1+0', m3: 10, olcu: '2×1.7×3 m', aylik: 4500, aciklama: 'Birkaç parça / stüdyo eşyası' },
  { id: '1+1', m3: 15, olcu: '2×2.5×3 m', aylik: 6000, aciklama: '1+1 ev eşyası' },
  { id: '2+1', m3: 22, olcu: '3×2.5×3 m', aylik: 7500, aciklama: '2+1 ev eşyası, kentsel dönüşüm' },
  { id: '3+1', m3: 30, olcu: '4×2.5×3 m', aylik: 9000, aciklama: '3+1 ev eşyası' },
  { id: 'Özel', m3: null, olcu: '40 m³ ve üzeri', aylik: null, aciklama: 'Video ile ölçü belirlenir' },
];
// Kiralama süresi — web sihirbazı: 6 ay peşin (1 ay hediye) = 5 öde 1 hediye; 12 ay = 10 öde 2 hediye
export const DEPO_KIRALAMA = [
  { id: '1',  ad: '1 Aylık Kiralama',            odenecekAy: 1,  toplamAy: 1 },
  { id: '6',  ad: '6 Ay Peşin (1 Ay Hediye)',    odenecekAy: 5,  toplamAy: 6 },
  { id: '12', ad: '12 Ay Peşin (2 Ay Hediye)',   odenecekAy: 10, toplamAy: 12 },
];
const KIRA_BOYUTLARI = DEPO_BOYUTLARI.filter(b => b.aylik).map(b => b.id);

// Türkçe karaktersiz, sabit anahtar
export const trSlug = (s) => String(s || '')
  .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
  .replace(/[Çç]/g, 'c').replace(/[Ğğ]/g, 'g').replace(/[Öö]/g, 'o')
  .replace(/[Şş]/g, 's').replace(/[Üü]/g, 'u').replace(/[Ââ]/g, 'a')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

// ---------------------------------------------------------------- GRUPLAR ---
// ic: Firestore'daki anahtar · slug: API anahtarı · etiket: ekrandaki başlık
const DIS_CEPHE_SATIRLARI = [
  { ic: 'Anadolu', slug: 'anadolu', etiket: 'Anadolu Yakası (2-9 Kat)' },
  { ic: 'Avrupa', slug: 'avrupa', etiket: 'Avrupa Yakası (2-9 Kat · Tek Taraf Kurulum)' },
  { ic: 'Anadolu913', slug: 'anadolu913', etiket: 'Anadolu Yakası (9-13 Kat)' },
  { ic: 'Avrupa913', slug: 'avrupa913', etiket: 'Avrupa Yakası (9-13 Kat · Tek Taraf Kurulum)' },
];
const odaSatirlari = (ek) => FIYAT_ODALAR.map(o => ({ ic: o, slug: o, etiket: `${o} ${ek}` }));
const katSatirlari = (ek) => [3, 4, 5, 6, 7].map(k => ({ ic: String(k), slug: `kat${k}`, etiket: `${k}. Kat ${ek}` }));
const mesafeSatirlari = () => [50, 100, 150, 200].map(m => ({ ic: String(m), slug: `m${m}`, etiket: `${m} Adım / Metre` }));

export const SEHIR_ICI_GRUPLARI = [
  { ic: 'taban', slug: 'nakliyeTaban', etiket: 'Nakliye Taban Fiyatı (Anadolu Yakası)', satirlar: odaSatirlari('Nakliye'), odaSirali: true },
  { ic: 'toplama', slug: 'toplama', etiket: 'Toplama Hizmeti Maliyeti', satirlar: odaSatirlari('Toplama'), odaSirali: true },
  { ic: 'merdiven', slug: 'merdiven', etiket: 'Merdiven Maliyeti (Asansör Yoksa)', satirlar: katSatirlari('Merdiven Taşıma') },
  { ic: 'disCephe', slug: 'disCepheAsansor', etiket: 'Dış Cephe Asansör Maliyeti', satirlar: DIS_CEPHE_SATIRLARI },
  { ic: 'avrupaEkstra', slug: 'avrupaYakasiEkstra', etiket: 'Avrupa Yakası Ekstra Maliyet (Yakaya Eklenir)', satirlar: odaSatirlari('Nakliye Ekstra'), odaSirali: true },
  { ic: 'yurume', slug: 'yurumeMesafesi', etiket: 'Yürüme Mesafesi Maliyeti (Araç Yanaşamazsa)', satirlar: mesafeSatirlari() },
];
export const SEHIRLER_ARASI_EK_GRUPLARI = [
  { ic: 'toplama', slug: 'toplama', etiket: 'Toplama Hizmeti (İstenirse)', satirlar: odaSatirlari('Toplama'), odaSirali: true },
  { ic: 'merdiven', slug: 'merdiven', etiket: 'Merdiven (Asansör Yoksa)', satirlar: katSatirlari('Merdiven') },
  { ic: 'disCephe', slug: 'disCepheAsansor', etiket: 'Dış Cephe Asansörü', satirlar: DIS_CEPHE_SATIRLARI },
  { ic: 'yurume', slug: 'yurumeMesafesi', etiket: 'Yürüme Mesafesi (Araç Yanaşamazsa)', satirlar: mesafeSatirlari() },
];
export const IL_TABLOSU_ETIKET = '81 İl — Pendik Çıkışlı Ortalama Bedeller';
export const IL_TABLOSU_NOTU = '1+0 için 1+1 sütunu kullanılır. Trakya / Avrupa Yakası ötesi illerde %15 geçiş farkı dahildir. İskonto (%10) için Mehmet Bey\'e danışın.';

// İki nakliye listesi (Fiyat Tablosu'nun ilk iki sekmesi)
export const NAKLIYE_LISTELERI = [
  { id: 'eve', site: 'sembol', apiAnahtar: 'evdenEve', marka: 'SEMBOL', etiket: 'Evden Eve Nakliyat',
    sehirIci: 'sehirIciEve', ek: 'sehirlerArasiEkEve', il: 'ilEve', oran: 'acilisOraniEve' },
  { id: 'depo', site: 'depoevim', apiAnahtar: 'esyaDepolamaNakliye', marka: 'DEPOEVİM', etiket: 'Eşya Depolama Nakliyesi',
    sehirIci: 'sehirIciDepo', ek: 'sehirlerArasiEkDepo', il: 'ilDepo', oran: 'acilisOraniDepo' },
];

// Kiralık depo şubeleri (Firestore anahtarı → API anahtarı), ekrandaki sırayla
export const DEPO_SUBELERI = [
  { ic: 'Genel', slug: 'genel', etiket: 'Genel Liste (Şube farketmez)' },
  { ic: 'Pendik Depoevim', slug: 'pendik', etiket: 'Pendik Depoevim' },
  { ic: 'Kartal Depoevim', slug: 'kartal', etiket: 'Kartal Depoevim' },
  { ic: 'Çekmeköy Depoevim', slug: 'cekmekoy', etiket: 'Çekmeköy Depoevim' },
  { ic: 'Ümraniye Depoevim', slug: 'umraniye', etiket: 'Ümraniye Depoevim' },
  { ic: 'Başakşehir Depoevim', slug: 'basaksehir', etiket: 'Başakşehir Depoevim' },
];

// Fiyat belgesinde fiyat verisi taşıyan üst anahtarlar (meta alanlar hariç)
// DEĞİŞTİ (kullanıcı talebi): 'mesafe' — km bazlı fiyat ayarları (aşağıda)
export const FIYAT_VERI_ANAHTARLARI = ['genel', 'sehirIciEve', 'sehirIciDepo', 'sehirlerArasiEkEve', 'sehirlerArasiEkDepo', 'ilEve', 'ilDepo', 'depoKira', 'mesafe'];

// ============================================================================
// YENİ (kullanıcı talebi): KM BAZLI FİYAT — 4 NOKTA / 3 ETAP
// ----------------------------------------------------------------------------
// Araç Pendik hareket merkezinden kalkar ve oraya döner. 4 nokta:
//   1) Pendik hareket merkezi (kalkış) → 2) Yükleme → 3) Boşaltma → 4) Pendik (dönüş)
// Noktalar ADRES DEĞİL, seçilen İL / İLÇE MERKEZİdir (ör. "Kadıköy, İstanbul",
// "İnegöl, Bursa"). Depo işlerinde yükleme/boşaltma yerine şubenin ilçesi girer.
// Etapların km'si sunucudaki /api/mesafe ucundan (Google Routes API) gelir.
//
//   Taşıma = Nakliye taban (oda sayısı, Anadolu listesi)
//          + toplam km × km ücreti                      (ör. 200 km × 100 ₺ = 20.000 ₺)
//          + ek hizmetler (toplama, merdiven, dış cephe, yürüme — eskisi gibi)
//   Toplam km EŞİĞİ AŞARSA (varsayılan 200 km):
//          + rotadaki köprü / otoyol / feribot geçiş ücretleri
//          + uzun yol ek maliyeti (sabit, isteğe bağlı)
//          + işçilik farkı = %15 × (taban + ek hizmetler)
//   Eşik ALTINDA: geçiş ücreti alınmaz; Avrupa Yakası ekstrası eskisi gibi uygulanır.
//
// Mod AÇIKKEN 81 il tablosu kullanılmaz. Mod KAPALIYKEN her şey bugünkü gibidir.
// ============================================================================
// Ücretli geçişler. "anahtarlar": Google rotasının Türkçe yol tariflerinde bu
// ifadeler geçiyorsa geçiş otomatik işaretlenir (satışçı ± ile düzeltebilir).
// Tutarlar KAMYON (2. sınıf) içindir; varsayılanlar tahminidir — düzenleyin.
export const MESAFE_GECISLERI = [
  { ic: 'kopru15Temmuz',  slug: 'kopru15Temmuz',  etiket: '15 Temmuz Şehitler Köprüsü (O-1)',                        anahtarlar: [/15 temmuz/i, /boğaziçi köprüsü/i, /\bO-1\b/] },
  { ic: 'kopruFsm',       slug: 'kopruFsm',       etiket: 'Fatih Sultan Mehmet Köprüsü (O-2)',                        anahtarlar: [/fatih sultan mehmet/i, /\bfsm\b/i, /\bO-2\b/] },
  { ic: 'kopruYss',       slug: 'kopruYss',       etiket: 'Yavuz Sultan Selim Köprüsü · Kuzey Marmara Otoyolu (O-7)', anahtarlar: [/yavuz sultan selim/i, /\byss\b/i, /kuzey marmara/i, /\bO-7\b/] },
  { ic: 'kopruOsmangazi', slug: 'kopruOsmangazi', etiket: 'Osmangazi Köprüsü · İstanbul–İzmir Otoyolu (O-5)',         anahtarlar: [/osmangazi/i, /\bO-5\b/, /körfez geçiş/i, /izmir otoyolu/i] },
  { ic: 'kopruCanakkale', slug: 'kopruCanakkale', etiket: '1915 Çanakkale Köprüsü',                                   anahtarlar: [/1915/, /çanakkale köprüsü/i] },
  { ic: 'otoyolAnadolu',  slug: 'otoyolAnadolu',  etiket: 'Anadolu Otoyolu (O-4 · İstanbul–Ankara)',                  anahtarlar: [/\bO-4\b/, /anadolu otoyolu/i] },
  { ic: 'otoyolAvrupa',   slug: 'otoyolAvrupa',   etiket: 'Avrupa Otoyolu (O-3 · İstanbul–Edirne)',                   anahtarlar: [/\bO-3\b/, /edirne otoyolu/i, /avrupa otoyolu/i] },
  { ic: 'otoyolNigde',    slug: 'otoyolNigde',    etiket: 'Ankara–Niğde Otoyolu (O-21)',                              anahtarlar: [/\bO-21\b/, /niğde otoyolu/i] },
  { ic: 'feribot',        slug: 'feribot',        etiket: 'Feribot / Arabalı Vapur (Eskihisar–Topçular vb.)',         anahtarlar: [/feribot/i, /ferry/i, /vapur/i, /topçular/i, /eskihisar/i] },
];
// Varsayılanlar (tahmini) — Fiyat Tablosu > Km & Güzergah'tan değiştirilir
export const MESAFE_VARSAYILAN = {
  modu: 0,                                  // 1 = km bazlı fiyat AÇIK, 0 = KAPALI (eski sistem)
  cikisAdresi: 'Pendik, İstanbul, Türkiye', // hareket merkezi — kalkış ve dönüş noktası (ilçe merkezi)
  kmUcreti: 100,                            // ₺ / km — 3 etabın TOPLAM km'sine uygulanır
  esikKm: 200,                              // bu km AŞILINCA geçiş ücretleri + uzun yol eki + işçilik farkı eklenir
  iscilikYuzde: 15,                         // eşik aşılınca (taban + ek hizmetler) üzerine eklenen işçilik farkı (%)
  uzunYolEk: 0,                             // eşik aşılınca eklenen sabit ek maliyet (₺) — kullanılmıyorsa 0
  gecis: { kopru15Temmuz: 50, kopruFsm: 50, kopruYss: 900, kopruOsmangazi: 1500, kopruCanakkale: 1800, otoyolAnadolu: 500, otoyolAvrupa: 300, otoyolNigde: 400, feribot: 1200 },
};
// Hücre türleri: 'fiyat' (>0) · 'tutar0' (≥0) · 'yuzde' (0–100) · 'anahtar' (0/1) · 'metin'
export const MESAFE_HUCRELERI = () => [
  { yol: ['mesafe', 'modu'], etiket: 'Km Bazlı Fiyat · Mod (1 açık / 0 kapalı)', tur: 'anahtar' },
  { yol: ['mesafe', 'cikisAdresi'], etiket: 'Km Bazlı Fiyat · Hareket merkezi (ilçe, il)', tur: 'metin' },
  { yol: ['mesafe', 'kmUcreti'], etiket: 'Km Bazlı Fiyat · Km ücreti (₺/km)', tur: 'fiyat' },
  { yol: ['mesafe', 'esikKm'], etiket: 'Km Bazlı Fiyat · Uzun yol eşiği (km)', tur: 'fiyat' },
  { yol: ['mesafe', 'iscilikYuzde'], etiket: 'Km Bazlı Fiyat · Eşik üstü işçilik farkı (%)', tur: 'yuzde' },
  { yol: ['mesafe', 'uzunYolEk'], etiket: 'Km Bazlı Fiyat · Eşik üstü sabit ek maliyet (₺)', tur: 'tutar0' },
  ...MESAFE_GECISLERI.map(g => ({ yol: ['mesafe', 'gecis', g.ic], etiket: `Km Bazlı Fiyat · Geçiş · ${g.etiket}`, tur: 'tutar0' })),
];
// Eski kayıtlarda 'mesafe' yoktur: eksik hücreler önce şablondan (mevcut kayıt),
// sonra varsayılanlardan doldurulur — kayıt ve geri dönüş hiçbir zaman takılmaz.
export const fiyatEksikleriDoldur = (veri, sablon = null) => {
  const out = JSON.parse(JSON.stringify(veri || {}));
  MESAFE_HUCRELERI().forEach(c => {
    const v = yolAl(out, c.yol);
    if (v !== undefined && v !== null) return;
    const kaynak = yolAl(sablon, c.yol) ?? yolAl({ mesafe: MESAFE_VARSAYILAN }, c.yol);
    let x = out;
    c.yol.slice(0, -1).forEach(k => { if (x[k] == null) x[k] = {}; x = x[k]; });
    x[c.yol[c.yol.length - 1]] = kaynak;
  });
  return out;
};
export const mesafeModuAcik = (M) => Number(M?.modu) === 1;
// Toplam km eşiği AŞIYOR mu? (eşit = aşmıyor; ör. tam 200 km → eşik altı)
export const mesafeEsikAsildi = (M, km) => (Number(km) || 0) > (Number(M?.esikKm) || 0);
// İl / ilçe → Google'a gönderilecek merkez adresi ("Kadıköy, İstanbul, Türkiye")
export const ilceMerkezAdresi = (il, ilce) => {
  const ilAdi = String(il || '').replace(/\s*\((Anadolu|Avrupa)\)\s*$/, '').trim();
  if (!ilAdi) return '';
  return [String(ilce || '').trim(), ilAdi, 'Türkiye'].filter(Boolean).join(', ');
};
// Rota metinlerinden (Google yol tarifleri, rota açıklaması) geçişleri bulur → { id: 1 }
export const rotaGecisleriBul = (metinler = [], feribotVar = false) => {
  const metin = metinler.filter(Boolean).join(' \n ');
  const bulunan = {};
  MESAFE_GECISLERI.forEach(g => { if (g.anahtarlar.some(re => re.test(metin))) bulunan[g.ic] = 1; });
  if (feribotVar) bulunan.feribot = 1;
  return bulunan;
};
// Km bazlı kalemler (km + eşik üstü geçişler / sabit ek). rota: { toplamKm, gecisler }
// Her kaleme "km: true" işareti konur → işçilik farkı hesabına KATILMAZ.
export const mesafeKalemleri = (M, rota) => {
  const kalemler = [];
  const km = Math.round(Number(rota?.toplamKm) || 0);
  if (!km) return kalemler;
  const kmUcreti = Number(M?.kmUcreti) || 0;
  kalemler.push({ ad: `Mesafe: ${km.toLocaleString('tr-TR')} km (4 nokta / 3 etap) × ${kmUcreti.toLocaleString('tr-TR')} ₺/km`, tutar: Math.round(km * kmUcreti), km: true });
  if (!mesafeEsikAsildi(M, km)) return kalemler; // eşik altında geçiş/ek yok
  Object.entries(rota?.gecisler || {}).forEach(([id, adet]) => {
    const g = MESAFE_GECISLERI.find(x => x.ic === id);
    const birim = Number(M?.gecis?.[id]) || 0;
    const n = Math.max(0, Math.round(Number(adet) || 0));
    if (g && birim > 0 && n > 0) kalemler.push({ ad: `Geçiş: ${g.etiket}${n > 1 ? ` × ${n}` : ''}`, tutar: birim * n, km: true });
  });
  const ek = Number(M?.uzunYolEk) || 0;
  if (ek > 0) kalemler.push({ ad: `Uzun yol ek maliyeti (${Number(M.esikKm).toLocaleString('tr-TR')} km üstü)`, tutar: ek, km: true });
  return kalemler;
};
// Eşik üstü işçilik farkı: %X × (taban + ek hizmetler). "kalemler" = km DIŞI kalemler
export const mesafeIscilikKalemi = (M, rota, kalemler) => {
  if (!mesafeEsikAsildi(M, rota?.toplamKm)) return null;
  const yuzde = Number(M?.iscilikYuzde) || 0;
  if (yuzde <= 0) return null;
  const baz = (kalemler || []).filter(k => !k.km).reduce((t, k) => t + (Number(k.tutar) || 0), 0);
  if (baz <= 0) return null;
  return { ad: `Uzun yol işçilik farkı (%${yuzde} · ${Number(M.esikKm).toLocaleString('tr-TR')} km üstü)`, tutar: Math.round(baz * yuzde / 100), km: true };
};

const ilSirala = (obj) => Object.keys(obj || {}).sort((a, b) => a.localeCompare(b, 'tr'));
const yolAl = (o, yol) => yol.reduce((x, k) => (x == null ? x : x[k]), o);

// ------------------------------------------------------------ HÜCRELER ---
// Tablodaki TÜM düzenlenebilir hücreler: { yol, etiket, tur: 'fiyat'|'yuzde', sira? }
// "sira": büyüklük sırası kontrolü için aynı satır grubunun kimliği ve konumu.
// İl listesi mevcut veriden alınır (il adları ekrandan değiştirilemez).
export const fiyatHucreleri = (veri) => {
  const h = [];
  NAKLIYE_LISTELERI.forEach(L => {
    h.push({ yol: ['genel', L.oran], etiket: `${L.marka} · ${L.etiket} · Fiyat Aralığı Yüzdesi`, tur: 'yuzde' });
    SEHIR_ICI_GRUPLARI.forEach(g => g.satirlar.forEach((s, i) => h.push({
      yol: [L.sehirIci, g.ic, s.ic], etiket: `${L.marka} · Şehir İçi · ${g.etiket} · ${s.etiket}`, tur: 'fiyat',
      sira: g.odaSirali ? { grup: `${L.sehirIci}.${g.ic}`, i } : null,
    })));
    ilSirala(veri?.[L.il]).forEach(il => FIYAT_IL_SUTUNLARI.forEach((o, i) => h.push({
      yol: [L.il, il, i], etiket: `${L.marka} · Şehirler Arası · ${il} · ${o}`, tur: 'fiyat', sira: { grup: `${L.il}.${il}`, i },
    })));
    SEHIRLER_ARASI_EK_GRUPLARI.forEach(g => g.satirlar.forEach((s, i) => h.push({
      yol: [L.ek, g.ic, s.ic], etiket: `${L.marka} · Şehirler Arası · ${g.etiket} · ${s.etiket}`, tur: 'fiyat',
      sira: g.odaSirali ? { grup: `${L.ek}.${g.ic}`, i } : null,
    })));
  });
  DEPO_SUBELERI.forEach(sb => KIRA_BOYUTLARI.forEach((b, i) => h.push({
    yol: ['depoKira', sb.ic, b], etiket: `DEPOEVİM · Kiralık Depo · ${sb.etiket} · ${b}`, tur: 'fiyat', sira: { grup: `depoKira.${sb.ic}`, i },
  })));
  MESAFE_HUCRELERI().forEach(c => h.push(c)); // YENİ: km bazlı fiyat hücreleri
  return h;
};
export const fiyatYolAnahtari = (yol) => yol.join('|');

// ----------------------------------------------------------- DOĞRULAMA ---
// "sablon": il listesinin alınacağı belge (varsayılan: verinin kendisi)
// hatalar: kaydı ENGELLER (boş, sıfır, negatif, sayı olmayan; yüzde 0-100 tam sayı değil)
// uyarilar: büyük boyun küçükten ucuz olduğu hücreler (kullanıcı onayıyla kaydedilebilir)
export const fiyatDogrula = (veriHam, sablon = veriHam) => {
  const veri = fiyatEksikleriDoldur(veriHam, sablon); // YENİ: eski kayıtlarda mesafe eksikse doldur
  const hatalar = [];
  const uyarilar = [];
  const hucreler = fiyatHucreleri(sablon);
  const gruplar = {};
  hucreler.forEach(c => {
    const v = yolAl(veri, c.yol);
    const sayi = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
    if (c.tur === 'yuzde') {
      if (!Number.isInteger(sayi) || sayi < 0 || sayi > 100) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: '0–100 arası tam sayı olmalı' });
      return;
    }
    // YENİ türler (km bazlı fiyat)
    if (c.tur === 'anahtar') { if (sayi !== 0 && sayi !== 1) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: '1 (açık) ya da 0 (kapalı) olmalı' }); return; }
    if (c.tur === 'metin') { if (!String(v ?? '').trim()) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Boş bırakılamaz' }); return; }
    if (c.tur === 'tutar0') {
      if (v === '' || v == null) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Boş bırakılamaz (0 yazılabilir)' });
      else if (!Number.isFinite(sayi)) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Sayı olmalı' });
      else if (sayi < 0) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Negatif olamaz' });
      return;
    }
    if (v === '' || v == null) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Boş bırakılamaz' });
    else if (!Number.isFinite(sayi)) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Sayı olmalı' });
    else if (sayi <= 0) hatalar.push({ yol: c.yol, etiket: c.etiket, mesaj: 'Sıfır veya negatif olamaz' });
    else if (c.sira) (gruplar[c.sira.grup] = gruplar[c.sira.grup] || []).push({ ...c, v: sayi });
  });
  Object.values(gruplar).forEach(liste => {
    liste.sort((a, b) => a.sira.i - b.sira.i);
    for (let i = 1; i < liste.length; i++) {
      if (liste[i].v < liste[i - 1].v) uyarilar.push({
        yol: liste[i].yol, etiket: liste[i].etiket,
        mesaj: `Büyük boy küçükten ucuz: ${liste[i].v.toLocaleString('tr-TR')} ₺, bir küçük boy ${liste[i - 1].v.toLocaleString('tr-TR')} ₺`,
      });
    }
  });
  return { hatalar, uyarilar };
};

// Kaydedilecek temiz veri: yalnızca şemadaki hücreler, hepsi Number.
// "sablon": il listesinin alınacağı belge (sunucuda mevcut kayıt — il silinemez/eklenemez)
export const fiyatTemizle = (veriHam, sablon = veriHam) => {
  const veri = fiyatEksikleriDoldur(veriHam, sablon); // YENİ: eski kayıtlarda mesafe eksikse doldur
  const out = {};
  fiyatHucreleri(sablon).forEach(c => {
    let x = out;
    c.yol.slice(0, -1).forEach((k, i) => {
      const sonraki = c.yol[i + 1];
      if (x[k] == null) x[k] = typeof sonraki === 'number' ? [] : {};
      x = x[k];
    });
    const v = yolAl(veri, c.yol);
    x[c.yol[c.yol.length - 1]] = c.tur === 'metin' ? String(v ?? '').trim() : Number(v); // YENİ: metin hücresi
  });
  return out;
};

// İki sürüm arasındaki farklar (kaydet özeti ve geçmiş listesi için)
export const fiyatFarklari = (eski, yeni) => fiyatHucreleri(yeni)
  .map(c => ({ yol: c.yol, etiket: c.etiket, tur: c.tur, eski: yolAl(eski, c.yol), yeni: yolAl(yeni, c.yol) }))
  .filter(f => f.tur === 'metin' ? String(f.eski ?? '') !== String(f.yeni ?? '') // YENİ: metin hücresi
    : (Number(f.eski) !== Number(f.yeni) || (f.eski == null) !== (f.yeni == null)));

// ---------------------------------------------------------- API YANITI ---
const grupCikti = (kaynak, g) => {
  const degerler = {};
  g.satirlar.forEach(s => { degerler[s.slug] = kaynak?.[g.ic]?.[s.ic] ?? null; });
  return { etiket: g.etiket, degerler };
};
const nakliyeCikti = (belge, L) => {
  const genel = belge.genel || {};
  const sehirIci = {};
  SEHIR_ICI_GRUPLARI.forEach(g => { sehirIci[g.slug] = grupCikti(belge[L.sehirIci], g); });
  const iller = {};
  ilSirala(belge[L.il]).forEach(il => {
    const d = {};
    FIYAT_IL_SUTUNLARI.forEach((o, i) => { d[o] = belge[L.il][il]?.[i] ?? null; });
    iller[trSlug(il)] = { etiket: il, degerler: d };
  });
  const sehirlerArasi = { iller: { etiket: IL_TABLOSU_ETIKET, not: IL_TABLOSU_NOTU, sutunlar: FIYAT_IL_SUTUNLARI, degerler: iller } };
  SEHIRLER_ARASI_EK_GRUPLARI.forEach(g => { sehirlerArasi[g.slug] = grupCikti(belge[L.ek], g); });
  return {
    etiket: L.etiket,
    aralikYuzdesi: Number(genel[L.oran]),
    yuvarlama: FIYAT_YUVARLAMA,
    sehirIci: { etiket: 'Şehir İçi (İstanbul)', ...sehirIci },
    sehirlerArasi: { etiket: 'Şehirler Arası (81 İl)', ...sehirlerArasi },
  };
};
const kiraCikti = (belge) => {
  const subeler = {};
  DEPO_SUBELERI.forEach(sb => {
    const d = {};
    KIRA_BOYUTLARI.forEach(b => { d[b] = belge.depoKira?.[sb.ic]?.[b] ?? null; });
    subeler[sb.slug] = { etiket: sb.etiket, degerler: d };
  });
  return {
    etiket: 'Kiralık Depo',
    kdvHaric: true,
    kdvOrani: FIYAT_KDV_ORANI,
    boyutlar: DEPO_BOYUTLARI.filter(b => b.aylik).map(b => ({ id: b.id, m3: b.m3, olcu: b.olcu })),
    kampanyalar: DEPO_KIRALAMA.map(k => ({ id: k.id, etiket: k.ad, odenecekAy: k.odenecekAy, toplamAy: k.toplamAy })),
    subeler,
  };
};

export const FIYAT_SITELERI = ['sembol', 'depoevim'];
// Firestore belgesi → herkese açık API yanıtı
export const fiyatApiYaniti = (belge, site) => {
  const meta = {
    site,
    versiyon: Number(belge.versiyon) || 1,
    guncellendi: belge.guncellendi || belge.guncellemeTarihi || null,
    guncelleyen: belge.guncelleyen || null,
  };
  const mesafe = mesafeCikti(belge); // YENİ: km bazlı fiyat ayarları (her iki siteye)
  if (site === 'sembol') return { ...meta, evdenEve: nakliyeCikti(belge, NAKLIYE_LISTELERI[0]), mesafe };
  return { ...meta, esyaDepolamaNakliye: nakliyeCikti(belge, NAKLIYE_LISTELERI[1]), kiralikDepo: kiraCikti(belge), mesafe };
};
// YENİ: km bazlı fiyat ayarlarının API çıktısı
const mesafeCikti = (belge) => {
  const M = fiyatEksikleriDoldur(belge).mesafe;
  const gecis = {}; MESAFE_GECISLERI.forEach(g => { gecis[g.slug] = { etiket: g.etiket, tutar: M.gecis?.[g.ic] ?? null }; });
  return { etiket: 'Km Bazlı Fiyat (4 nokta: hareket merkezi → yükleme → boşaltma → hareket merkezi)', aktif: mesafeModuAcik(M),
    hareketMerkezi: M.cikisAdresi, kmUcreti: M.kmUcreti, esikKm: M.esikKm, iscilikYuzde: M.iscilikYuzde, uzunYolEk: M.uzunYolEk, gecis };
};
