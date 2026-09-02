import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Truck, ShieldCheck, MapPin, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, Briefcase, Wallet, Activity, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Landmark, CreditCard, DollarSign, Edit, Ban, User, Loader2, Package, Database, Download, BarChart, TrendingUp, UserPlus, BookOpen, Search, ChevronLeft, ChevronRight, Tag, History, Plus, Trash2, ChevronDown, ChevronUp , Banknote, UserMinus, Settings, FileText } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
// DEĞİŞİKLİK: gecerliMaas artık shared.jsx içinden gelir.
// Deneme maaşı mantığı ayrı dosya yerine shared.jsx içinde tek noktada tutuluyor;
// hem Operasyon.jsx (form) hem Finans.jsx (bordro) aynı kaynaktan okur.
import { db, appId, MESAI_STATUS_OPTIONS, isPersonnelVisibleInMonth, gecerliMaas,
  // YENİ: Avans ve maaş ödemelerini ilgili deftere gider olarak yazar.
  defterPersonelGiderKaydet,
  // YENİ: Hazır etiket ağacı ve kullanıcı etiketlerinin Firestore referansı.
  VARSAYILAN_ETIKET_GRUPLARI, tumVarsayilanEtiketler, defterEtiketleriRef, GARANTI_MAAS_SABLON_BASE64, odemeIcinDefterBul } from './shared.jsx';

// ==========================================================================
// HATA DÜZELTMESİ (kullanıcı bildirimi): "İş Onaylama Tahtası"ndan onaylanan
// Fazla/Eksik Mesai saatleri (örn. Ahmet Öztürk, 26.08 → 4,5 saat) Personel
// Muhasebe > Mesai tablosunda görünmüyor / maaşa yansımıyordu.
//
// KÖK NEDEN: Mesai saatleri sistemde VİRGÜLLÜ ondalık olarak saklanıyor
// (örn. "4,5"). JavaScript'in parseFloat() fonksiyonu virgülü ondalık ayıracı
// olarak TANIMAZ; parseFloat("4,5") sonucu 4.5 değil, SADECE 4 döner (virgülden
// sonrasını tamamen keser). Bu yüzden saat hem ekranda eksik görünüyor hem de
// maaş hesabına eksik/yanlış yansıyordu. Aynı sorun sayı (number) tipindeki
// giriş kutusunda da vardı: <input type="number"> virgüllü bir değeri GEÇERSİZ
// sayıp kutuyu tamamen BOŞ ("Saat" placeholder) gösteriyordu — onaylanan 4,5
// saat kaydedilmiş olsa bile ekranda hiç görünmüyordu.
//
// ÇÖZÜM: Tüm dosyada saat metnini sayıya çevirirken bu tek yardımcı fonksiyon
// kullanılır; virgülü noktaya çevirip güvenli şekilde parseFloat yapar.
// Mevcut kayıtlardaki veri biçimi (virgüllü string) DEĞİŞTİRİLMEDİ, sadece
// okuma/yazma sırasında doğru yorumlanması sağlandı.
// ==========================================================================
const saatMetniSayiyaCevir = (deger) => {
  if (deger === null || deger === undefined || deger === '') return 0;
  const normal = String(deger).trim().replace(',', '.'); // "4,5" -> "4.5"
  const sayi = parseFloat(normal);
  return isNaN(sayi) ? 0 : sayi;
};

  // ==========================================================================
  // YENİ BİLEŞEN: MAAŞ RAPORU (Genel Ciro Raporu sayfasındaki 2. sekme)
  // Bu bileşen TAMAMEN YENİ ve EKLENTİ niteliğindedir; mevcut hiçbir koda
  // dokunulmadı. Maaş Tablosu'ndaki (maas + mesai koleksiyonları) verileri
  // okuyarak dönem bazında (Aylık/Yıllık) toplam personel maliyetini,
  // Mavi Yaka / Beyaz Yaka kırılımını, ödenen ve kalan tutarları raporlar.
  // Hesaplama mantığı MaasView.calcRow ile birebir aynı tutulmuştur; böylece
  // Maaş Tablosu'nda görünen rakamlarla bu rapor her zaman tutarlı olur.
  // ==========================================================================
  const MaasRaporuView = ({ personnelList }) => {
    const bugun = new Date();
    const [raporDonem, setRaporDonem] = useState('month'); // 'month' | 'year'
    const [raporYil, setRaporYil] = useState(bugun.getFullYear());
    const [raporAy, setRaporAy] = useState(bugun.getMonth() + 1);
    const [yakaFiltre, setYakaFiltre] = useState('Tümü'); // Tümü | Mavi Yaka | Beyaz Yaka
    const [yukleniyor, setYukleniyor] = useState(true);
    // Firebase'den okunan ham veriler: anahtar = `${prefix}${ay}` (örn. '7' veya 'beyaz_7')
    const [maasKayitlari, setMaasKayitlari] = useState({});
    const [mesaiKayitlari, setMesaiKayitlari] = useState({});

    const aylar = [
      { val: 1, label: 'Ocak' }, { val: 2, label: 'Şubat' }, { val: 3, label: 'Mart' },
      { val: 4, label: 'Nisan' }, { val: 5, label: 'Mayıs' }, { val: 6, label: 'Haziran' },
      { val: 7, label: 'Temmuz' }, { val: 8, label: 'Ağustos' }, { val: 9, label: 'Eylül' },
      { val: 10, label: 'Ekim' }, { val: 11, label: 'Kasım' }, { val: 12, label: 'Aralık' }
    ];
    const yillar = Array.from({ length: 10 }, (_, i) => 2024 + i);

    // Mavi yaka pozisyonları (MaasView'daki filtreyle birebir aynı liste)
    const MAVI_POZISYONLAR = ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'];
    const yakaTipi = (p) => (p.collarType === 'Mavi Yaka' || (!p.collarType && MAVI_POZISYONLAR.includes(p.position))) ? 'Mavi Yaka' : 'Beyaz Yaka';

    // Seçilen döneme ait maas + mesai dokümanlarını (her iki yaka için) Firebase'den yükle
    useEffect(() => {
      let iptal = false;
      const yukle = async () => {
        setYukleniyor(true);
        const hedefAylar = raporDonem === 'year' ? Array.from({ length: 12 }, (_, i) => i + 1) : [raporAy];
        const prefixler = ['', 'beyaz_']; // '' = Mavi Yaka, 'beyaz_' = Beyaz Yaka (mevcut doküman adlandırması)
        const maasSonuc = {};
        const mesaiSonuc = {};
        try {
          await Promise.all(hedefAylar.flatMap(ay => prefixler.flatMap(pref => ([
            getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${pref}${raporYil}_${ay}`))
              .then(s => { if (s.exists()) maasSonuc[`${pref}${ay}`] = s.data().records || {}; })
              .catch(() => {}),
            getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${pref}${raporYil}_${ay}`))
              .then(s => { if (s.exists()) mesaiSonuc[`${pref}${ay}`] = s.data().records || {}; })
              .catch(() => {})
          ]))));
        } catch (e) { console.error('Maaş raporu verisi yüklenemedi:', e); }
        if (!iptal) { setMaasKayitlari(maasSonuc); setMesaiKayitlari(mesaiSonuc); setYukleniyor(false); }
      };
      yukle();
      return () => { iptal = true; };
    }, [raporDonem, raporYil, raporAy]);

    // ------------------------------------------------------------------
    // TEK SATIR HESABI — MaasView.calcRow ile birebir aynı formüller.
    // Ek olarak: Mesai Ücreti ile Prim Ücreti raporda AYRI gösterilir.
    // (Orijinal mesaiUcreti = mesai + prim'i birlikte içerir; burada
    // primTL = (maas/200)*primSaat olarak ayrıştırılır, toplam değişmez.)
    // ------------------------------------------------------------------
    const hesaplaKisiAy = (person, row, mesaiRecord, yil, ay) => {
      let devamsiz = 0, raporSay = 0, ucretsizIzin = 0, toplamMesaiSaati = 0, fazlaGun = 0;
      Object.values(mesaiRecord || {}).forEach(val => {
        if (typeof val === 'object' && val !== null) {
          if (val.status === 'D') devamsiz++;
          else if (val.status === 'R') raporSay++;
          else if (val.status === 'Üİ' || val.status === 'İB') ucretsizIzin++;
          else if (val.status === 'FG') fazlaGun++;
          else if (val.status === 'FGM') { fazlaGun++; toplamMesaiSaati += saatMetniSayiyaCevir(val.hours); }
          else if (val.status === 'FM') toplamMesaiSaati += saatMetniSayiyaCevir(val.hours);
          else if (val.status === 'EM') toplamMesaiSaati -= saatMetniSayiyaCevir(val.hours);
        } else {
          if (val === 'D') devamsiz++;
          else if (val === 'R') raporSay++;
          else if (val === 'Üİ' || val === 'İB') ucretsizIzin++;
          else if (val === 'FG') fazlaGun++;
          else if (val === 'FGM') fazlaGun++;
        }
      });
      // Manuel girilmiş değerler otomatik hesaplananları ezer (MaasView ile aynı davranış)
      const devamsizlikSayisi = row.devamsizlik !== undefined && row.devamsizlik !== '' ? parseFloat(row.devamsizlik) : devamsiz;
      const rapor = row.rapor !== undefined && row.rapor !== '' ? parseFloat(row.rapor) : raporSay;
      const fazlaGunSayisi = row.fazlaGun !== undefined && row.fazlaGun !== '' ? parseFloat(row.fazlaGun) : fazlaGun;
      // İşe giriş tarihinden önceki günler ücretsiz izin gibi sayılır
      let iseGirisGun = 0;
      if (person.startDate) {
        const s = new Date(person.startDate + 'T00:00:00');
        if (!isNaN(s.getTime())) {
          const ayGunSayisi = new Date(yil, ay, 0).getDate();
          const baslangic = new Date(s.getFullYear(), s.getMonth(), s.getDate());
          for (let d = 1; d <= ayGunSayisi; d++) {
            if (new Date(yil, ay - 1, d) < baslangic) iseGirisGun++;
          }
        }
      }
      const mesaiGunSayisi = Math.max(0, 30 - rapor - devamsizlikSayisi - ucretsizIzin - iseGirisGun);
      // DEĞİŞİKLİK: person.maas yerine gecerliMaas() kullanılır. Bu fonksiyon,
      // ilgili ay deneme süresi içindeyse person.denemeMaasi, değilse person.maas
      // döndürür. Elle girilen satır değeri (row.maas) her ikisini de EZER —
      // muhasebenin tek bir ay için manuel düzeltme yapma imkânı korunur.
      const maas = parseFloat(row.maas !== undefined && row.maas !== '' ? row.maas : gecerliMaas(person, yil, ay)) || 0;
      const bankaParasiBase = parseFloat(person.bankaParasi) || 0;
      const nakitAvans = parseFloat(row.nakitAvans) || 0;
      const resmiAvans = parseFloat(row.resmiAvans) || 0;
      const prim = parseFloat(row.prim) || 0; // Prim SAAT cinsindendir
      const yol = parseFloat(row.yol !== undefined && row.yol !== '' ? row.yol : person.yol) || 0;
      const yemek = parseFloat(row.yemek !== undefined && row.yemek !== '' ? row.yemek : person.yemek) || 0;
      const hesaplananBanka = (bankaParasiBase / 30) * mesaiGunSayisi;
      const icraKesintisi = person.icrasiVar === 'Evet' ? (hesaplananBanka / 4) : 0;
      const bankaKalan = hesaplananBanka - icraKesintisi - resmiAvans;
      const toplamSaat = toplamMesaiSaati + (fazlaGunSayisi * 10) - (devamsizlikSayisi * 3) + prim;
      const mesaiUcretiToplam = (maas / 200) * toplamSaat; // prim dahil (orijinal formül)
      const primTL = (maas / 200) * prim;                   // primin TL karşılığı (raporda ayrı gösterilir)
      const mesaiUcreti = mesaiUcretiToplam - primTL;       // primden arındırılmış saf mesai ücreti
      const netMaas = (maas / 30) * mesaiGunSayisi;
      // YENİ: HASAR KESİNTİSİ — Maaş Tablosu'nun priminden otomatik kestiği
      // hasar borcu payı. Rapor tarafında da Kalan Nakit ve Personele Ödenecek
      // tutarlardan düşülür ki iki ekran birbirini tutsun. Prim TL'sinden
      // büyük olamaz (Maaş Tablosu'ndaki effect bunu garanti eder; yine de
      // güvenlik için burada da sınırlanır).
      const hasarKesinti = Math.min(parseFloat(row.hasarKesinti) || 0, primTL);
      const kalanNakit = netMaas - hesaplananBanka - nakitAvans + mesaiUcretiToplam - hasarKesinti;

      // ====================================================================
      // YENİ: SİGORTA MALİYETİ
      // Personel kartındaki (Personel Ekle / Düzenle) "Sigorta Maliyeti"
      // alanından okunur. Bu tutar personele ÖDENMEZ — devlete/SGK'ya
      // ödenir. Bu yüzden işveren maliyetine DAHİL edilir, ama personele
      // ödenecek tutara DAHİL EDİLMEZ.
      // ====================================================================
      const sigortaMaliyeti = parseFloat(person.sigortaMaliyeti) || 0;

      // PERSONELE ÖDENECEK brüt tutar (sigorta hariç — bu para personelin eline/bankasına geçer)
      // YENİ: hasar kesintisi düşülür — kesilen prim personele hiç ödenmez
      const personeleOdenecek = netMaas + mesaiUcretiToplam + yol + yemek - hasarKesinti;
      // TOPLAM İŞVEREN MALİYETİ (sigorta dahil)
      const maliyet = personeleOdenecek + sigortaMaliyeti;

      // Ödeme tikleriyle GİDERE işlenmiş (fiilen ödenmiş) tutarlar
      const odenen = (parseFloat(row.yemekOdenenTutar) || 0) + (parseFloat(row.yolOdenenTutar) || 0)
        + (parseFloat(row.bankaOdenenTutar) || 0) + (parseFloat(row.nakitOdenenTutar) || 0)
        + (parseFloat(row.icraOdenenTutar) || 0);

      // ====================================================================
      // YENİ: AVANSLAR ARTIK "ÖDENMİŞ" SAYILIR
      // Nakit avans ve resmi (banka) avans, personele PEŞİN verilmiş
      // paradır. Eskiden bu tutarlar "Kalan" hesabına hiç girmiyordu; bu
      // yüzden tüm ödemeler tiklenmiş olsa bile Kalan sıfırlanmıyordu.
      // Artık toplam avans, ödenen tutara eklenir ve Kalan'dan düşülür.
      // ====================================================================
      const toplamAvans = nakitAvans + resmiAvans;
      const odenenToplam = odenen + toplamAvans;       // fiilen personele geçen toplam para
      const kalan = personeleOdenecek - odenenToplam;   // hâlâ ödenmesi gereken (eksi olabilir = fazla ödeme)

      return { netMaas, mesaiUcreti, primTL, hasarKesinti, yol, yemek, nakitAvans, resmiAvans, toplamAvans, icraKesintisi, hesaplananBanka, bankaKalan, kalanNakit, sigortaMaliyeti, personeleOdenecek, maliyet, odenen, odenenToplam, kalan };
    };

    // ------------------------------------------------------------------
    // DÖNEM TOPLAMA: seçili aya (veya yıllıkta 12 aya) ait tüm kişilerin
    // hesaplarını topla; kişi bazlı satırlar ve yaka bazlı özetler üret.
    // ------------------------------------------------------------------
    const hedefAylar = raporDonem === 'year' ? Array.from({ length: 12 }, (_, i) => i + 1) : [raporAy];
    const kisiSatirlari = {}; // personId -> birikimli toplamlar
    const bosToplam = () => ({ netMaas: 0, mesaiUcreti: 0, primTL: 0, yol: 0, yemek: 0, nakitAvans: 0, resmiAvans: 0, toplamAvans: 0, icraKesintisi: 0, kalanNakit: 0, bankaKalan: 0, sigortaMaliyeti: 0, personeleOdenecek: 0, maliyet: 0, odenen: 0, odenenToplam: 0, kalan: 0 });

    personnelList.filter(p => p.position !== 'Firma Sahibi').forEach(person => {
      const yaka = yakaTipi(person);
      if (yakaFiltre !== 'Tümü' && yaka !== yakaFiltre) return; // Yaka filtresi
      const prefix = yaka === 'Mavi Yaka' ? '' : 'beyaz_';
      hedefAylar.forEach(ay => {
        if (!isPersonnelVisibleInMonth(person, raporYil, ay)) return; // O ay çalışmıyorsa dahil etme
        const row = (maasKayitlari[`${prefix}${ay}`] || {})[person.id];
        const mesaiRec = (mesaiKayitlari[`${prefix}${ay}`] || {})[person.id];
        if (!row && !mesaiRec && !(parseFloat(person.maas) > 0)) return; // Hiç verisi yoksa atla
        const c = hesaplaKisiAy(person, row || {}, mesaiRec || {}, raporYil, ay);
        if (!kisiSatirlari[person.id]) kisiSatirlari[person.id] = { person, yaka, ...bosToplam() };
        const t = kisiSatirlari[person.id];
        Object.keys(bosToplam()).forEach(k => { t[k] += c[k]; });
      });
    });

    const satirlar = Object.values(kisiSatirlari).sort((a, b) => b.maliyet - a.maliyet);
    // Genel ve yaka bazlı toplamlar
    const genel = bosToplam();
    const mavi = bosToplam();
    const beyaz = bosToplam();
    satirlar.forEach(s => {
      Object.keys(bosToplam()).forEach(k => {
        genel[k] += s[k];
        if (s.yaka === 'Mavi Yaka') mavi[k] += s[k]; else beyaz[k] += s[k];
      });
    });
    // YENİ: Kalan ödeme artık doğrudan kişi bazlı "kalan" toplamından gelir.
    // Böylece hem AVANSLAR düşülmüş olur hem de SİGORTA maliyeti (personele
    // ödenmeyen, SGK'ya giden kısım) yanlışlıkla "ödenecek" gibi görünmez.
    const kalanOdeme = genel.kalan;
    const tl = (n) => `₺${(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

    // Özet kartlarında gösterilecek kalemler (etiket, tutar, renk sınıfları)
    const ozetKartlari = [
      { etiket: 'Net Maaş Toplamı', tutar: genel.netMaas, ikon: DollarSign, renk: 'bg-green-50 text-green-600' },
      { etiket: 'Mesai Ücreti Toplamı', tutar: genel.mesaiUcreti, ikon: Clock, renk: 'bg-purple-50 text-purple-600' },
      { etiket: 'Prim Ücreti Toplamı', tutar: genel.primTL, ikon: TrendingUp, renk: 'bg-amber-50 text-amber-600' },
      { etiket: 'Yemek Toplamı', tutar: genel.yemek, ikon: Package, renk: 'bg-orange-50 text-orange-600' },
      { etiket: 'Yol Toplamı', tutar: genel.yol, ikon: Truck, renk: 'bg-blue-50 text-blue-600' },
      // YENİ: Sigorta (SGK) maliyeti — personele ödenmez, işveren maliyetine dahildir
      { etiket: 'Sigorta Maliyeti Toplamı', tutar: genel.sigortaMaliyeti, ikon: ShieldCheck, renk: 'bg-cyan-50 text-cyan-700' },
      { etiket: 'Avanslar (Nakit+Banka)', tutar: genel.toplamAvans, ikon: Wallet, renk: 'bg-yellow-50 text-yellow-700' },
      { etiket: 'İcra Kesintileri', tutar: genel.icraKesintisi, ikon: Ban, renk: 'bg-red-50 text-red-600' },
      // YENİ: Ödenen artık avansları da içerir (fiilen personele geçen toplam para)
      { etiket: 'Ödenen (Tik + Avans)', tutar: genel.odenenToplam, ikon: CheckCircle, renk: 'bg-emerald-50 text-emerald-600' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* BAŞLIK + FİLTRELER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-green-600" /> Maaş Raporu
          </h2>
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm w-full md:w-auto">
            {/* Aylık / Yıllık dönem seçimi */}
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button onClick={() => setRaporDonem('month')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${raporDonem === 'month' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>Aylık</button>
              <button onClick={() => setRaporDonem('year')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${raporDonem === 'year' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>Yıllık</button>
            </div>
            <select value={raporYil} onChange={e => setRaporYil(parseInt(e.target.value))} className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none">
              {yillar.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {raporDonem === 'month' && (
              <select value={raporAy} onChange={e => setRaporAy(parseInt(e.target.value))} className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none">
                {aylar.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            )}
            {/* Mavi / Beyaz Yaka filtresi */}
            <select value={yakaFiltre} onChange={e => setYakaFiltre(e.target.value)} className="px-3 py-1.5 text-sm font-bold bg-green-50 text-green-700 border border-green-200 rounded-xl outline-none">
              <option value="Tümü">Tüm Personel</option>
              <option value="Mavi Yaka">Sadece Mavi Yaka</option>
              <option value="Beyaz Yaka">Sadece Beyaz Yaka</option>
            </select>
          </div>
        </div>

        {yukleniyor ? (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            <p className="text-sm font-bold text-neutral-500">Maaş verileri yükleniyor...</p>
          </div>
        ) : (
          <>
            {/* BÜYÜK ÖZET: Toplam Maliyet + Kalan Ödeme + Yaka Kırılımı */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4">
                <div className="p-4 bg-green-50 text-green-600 rounded-2xl shrink-0"><Landmark className="w-8 h-8" /></div>
                <div>
                  <p className="text-neutral-500 text-sm font-bold mb-1">Dönem İçi Toplam Personel Maliyeti</p>
                  <p className="text-3xl font-black text-green-600">{tl(genel.maliyet)}</p>
                  {/* YENİ: Sigorta maliyeti de toplama dahil edildi */}
                  <p className="text-[11px] font-bold text-neutral-400 mt-1">Net Maaş + Mesai + Prim + Yemek + Yol + Sigorta</p>
                  <p className="text-[11px] font-bold text-cyan-700 mt-0.5">Bunun {tl(genel.sigortaMaliyeti)}'si sigorta (SGK) maliyeti</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0"><CheckCircle className="w-8 h-8" /></div>
                <div>
                  <p className="text-neutral-500 text-sm font-bold mb-1">Fiilen Ödenen</p>
                  {/* YENİ: Avanslar da fiilen ödenmiş sayılır */}
                  <p className="text-3xl font-black text-emerald-600">{tl(genel.odenenToplam)}</p>
                  <p className="text-[11px] font-bold text-neutral-400 mt-1">Tikli ödemeler {tl(genel.odenen)} + Avanslar {tl(genel.toplamAvans)}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4">
                <div className={`p-4 rounded-2xl shrink-0 ${kalanOdeme < -0.5 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}><Wallet className="w-8 h-8" /></div>
                <div>
                  <p className="text-neutral-500 text-sm font-bold mb-1">{kalanOdeme < -0.5 ? 'Fazla Ödeme (Alacak)' : 'Kalan Ödenecek'}</p>
                  <p className={`text-3xl font-black ${kalanOdeme < -0.5 ? 'text-blue-600' : 'text-red-600'}`}>{tl(Math.abs(kalanOdeme))}</p>
                  {/* YENİ: Formül netleştirildi — sigorta hariç, avanslar düşülmüş */}
                  <p className="text-[11px] font-bold text-neutral-400 mt-1">Personele Ödenecek {tl(genel.personeleOdenecek)} − Ödenen {tl(genel.odenenToplam)}</p>
                  <p className="text-[10px] font-bold text-neutral-400 mt-0.5">(Sigorta maliyeti hariç — personele ödenmez)</p>
                </div>
              </div>
            </div>

            {/* YAKA KIRILIMI: Mavi Yaka / Beyaz Yaka karşılaştırması */}
            {yakaFiltre === 'Tümü' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[{ ad: 'Mavi Yaka', t: mavi, renk: 'blue' }, { ad: 'Beyaz Yaka', t: beyaz, renk: 'neutral' }].map(y => (
                  <div key={y.ad} className={`bg-white p-5 rounded-2xl shadow-sm border ${y.renk === 'blue' ? 'border-blue-200' : 'border-neutral-300'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-black text-sm uppercase tracking-wide flex items-center gap-2 ${y.renk === 'blue' ? 'text-blue-700' : 'text-neutral-700'}`}>
                        <Users className="w-4 h-4" /> {y.ad}
                      </h3>
                      <span className={`text-lg font-black ${y.renk === 'blue' ? 'text-blue-700' : 'text-neutral-800'}`}>{tl(y.t.maliyet)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                      <span className="text-neutral-500">Net Maaş</span><span className="text-right text-black">{tl(y.t.netMaas)}</span>
                      <span className="text-neutral-500">Mesai Ücreti</span><span className="text-right text-purple-700">{tl(y.t.mesaiUcreti)}</span>
                      <span className="text-neutral-500">Prim Ücreti</span><span className="text-right text-amber-700">{tl(y.t.primTL)}</span>
                      <span className="text-neutral-500">Yemek</span><span className="text-right text-black">{tl(y.t.yemek)}</span>
                      <span className="text-neutral-500">Yol</span><span className="text-right text-black">{tl(y.t.yol)}</span>
                      {/* YENİ: Sigorta maliyeti yaka kırılımında da görünür */}
                      <span className="text-neutral-500">Sigorta (SGK)</span><span className="text-right text-cyan-700">{tl(y.t.sigortaMaliyeti)}</span>
                      <span className="text-neutral-500">Nakit Avans</span><span className="text-right text-yellow-700">{tl(y.t.nakitAvans)}</span>
                      <span className="text-neutral-500">Banka Avans</span><span className="text-right text-orange-700">{tl(y.t.resmiAvans)}</span>
                      <span className="text-neutral-500">Ödenen (tik+avans)</span><span className="text-right text-emerald-700">{tl(y.t.odenenToplam)}</span>
                      <span className="text-neutral-500">Kalan</span>
                      <span className={`text-right ${y.t.kalan < -0.5 ? 'text-blue-600' : 'text-red-600'}`}>
                        {y.t.kalan < -0.5 ? `+${tl(Math.abs(y.t.kalan))}` : tl(Math.max(0, y.t.kalan))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* KALEM BAZLI ÖZET KARTLARI: Neye ne kadar ödediğinizi tek bakışta gösterir */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ozetKartlari.map(k => {
                const Ikon = k.ikon;
                return (
                  <div key={k.etiket} className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${k.renk}`}><Ikon className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide truncate">{k.etiket}</p>
                      <p className="text-base font-black text-black">{tl(k.tutar)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PERSONEL BAZLI DETAY TABLOSU */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-black">Personel Bazlı Maaş Ödeme Detayı</h3>
                <span className="ml-auto text-xs font-bold text-neutral-400">{satirlar.length} personel</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                    <tr>
                      <th className="p-3 font-bold">Personel</th>
                      <th className="p-3 font-bold text-center">Yaka</th>
                      <th className="p-3 font-bold text-right">Net Maaş</th>
                      <th className="p-3 font-bold text-right">Mesai</th>
                      <th className="p-3 font-bold text-right">Prim</th>
                      <th className="p-3 font-bold text-right">Yemek</th>
                      <th className="p-3 font-bold text-right">Yol</th>
                      {/* YENİ: Sigorta (SGK) maliyeti sütunu — personele ödenmez, işveren maliyetine dahildir */}
                      <th className="p-3 font-bold text-right">Sigorta</th>
                      {/* YENİ: Avans sütunu artık TEK SÜTUNDA ÇİFT SATIR — Nakit ve Banka ayrı görünür */}
                      <th className="p-3 font-bold text-right">Avans<br /><span className="text-[9px] font-medium normal-case text-neutral-400">Nakit / Banka</span></th>
                      <th className="p-3 font-bold text-right">Toplam Maliyet</th>
                      <th className="p-3 font-bold text-right">Ödenen<br /><span className="text-[9px] font-medium normal-case text-neutral-400">tik + avans</span></th>
                      <th className="p-3 font-bold text-right">Kalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {satirlar.map(s => (
                      <tr key={s.person.id} className="hover:bg-neutral-50 transition">
                        <td className="p-3 font-bold text-black">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 text-[10px]">
                              {s.person.profileImage ? <img src={s.person.profileImage} alt={s.person.fullName} className="w-full h-full object-cover" /> : (s.person.fullName || '?').charAt(0)}
                            </div>
                            <span className="truncate">{s.person.fullName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${s.yaka === 'Mavi Yaka' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-neutral-100 text-neutral-700 border-neutral-300'}`}>{s.yaka}</span>
                        </td>
                        <td className="p-3 text-right font-bold">{tl(s.netMaas)}</td>
                        <td className="p-3 text-right font-bold text-purple-700">{tl(s.mesaiUcreti)}</td>
                        <td className="p-3 text-right font-bold text-amber-700">{tl(s.primTL)}</td>
                        <td className="p-3 text-right">{tl(s.yemek)}</td>
                        <td className="p-3 text-right">{tl(s.yol)}</td>
                        {/* YENİ: Sigorta maliyeti */}
                        <td className="p-3 text-right font-bold text-cyan-700">{tl(s.sigortaMaliyeti)}</td>
                        {/* YENİ: Avans — tek sütunda iki satır (Nakit üstte, Banka altta) */}
                        <td className="p-3 text-right leading-tight">
                          <span className="block font-bold text-yellow-700">{tl(s.nakitAvans)}<span className="text-[9px] font-medium text-neutral-400 ml-1">N</span></span>
                          <span className="block font-bold text-orange-700">{tl(s.resmiAvans)}<span className="text-[9px] font-medium text-neutral-400 ml-1">B</span></span>
                        </td>
                        <td className="p-3 text-right font-black text-black">{tl(s.maliyet)}</td>
                        <td className="p-3 text-right font-black text-emerald-600">{tl(s.odenenToplam)}</td>
                        {/* YENİ: Kalan artık avanslar düşülmüş ve sigorta hariç tutulmuş halde;
                            fazla ödeme yapıldıysa (eksi değer) mavi renkle "fazla" olarak gösterilir */}
                        <td className={`p-3 text-right font-black ${s.kalan > 0.5 ? 'text-red-600' : s.kalan < -0.5 ? 'text-blue-600' : 'text-neutral-400'}`}>
                          {s.kalan < -0.5 ? `+${tl(Math.abs(s.kalan))}` : tl(Math.max(0, s.kalan))}
                        </td>
                      </tr>
                    ))}
                    {satirlar.length === 0 && (
                      <tr>
                        <td colSpan="13" className="p-8 text-center text-neutral-500 font-medium">Bu döneme ait maaş kaydı bulunamadı. Maaş Tablosu'na veri girildikçe rapor burada oluşur.</td>
                      </tr>
                    )}
                  </tbody>
                  {/* TOPLAM SATIRI */}
                  {satirlar.length > 0 && (
                    <tfoot>
                      <tr className="bg-black text-white font-black">
                        <td className="p-3 text-right" colSpan="2">GENEL TOPLAM :</td>
                        <td className="p-3 text-right">{tl(genel.netMaas)}</td>
                        <td className="p-3 text-right text-purple-300">{tl(genel.mesaiUcreti)}</td>
                        <td className="p-3 text-right text-amber-300">{tl(genel.primTL)}</td>
                        <td className="p-3 text-right">{tl(genel.yemek)}</td>
                        <td className="p-3 text-right">{tl(genel.yol)}</td>
                        {/* YENİ: Sigorta maliyeti toplamı */}
                        <td className="p-3 text-right text-cyan-300">{tl(genel.sigortaMaliyeti)}</td>
                        {/* YENİ: Avans toplamı — nakit ve banka ayrı satırlarda */}
                        <td className="p-3 text-right leading-tight">
                          <span className="block text-yellow-300">{tl(genel.nakitAvans)}<span className="text-[9px] font-medium opacity-70 ml-1">N</span></span>
                          <span className="block text-orange-300">{tl(genel.resmiAvans)}<span className="text-[9px] font-medium opacity-70 ml-1">B</span></span>
                        </td>
                        <td className="p-3 text-right text-green-400">{tl(genel.maliyet)}</td>
                        <td className="p-3 text-right text-emerald-400">{tl(genel.odenenToplam)}</td>
                        <td className={`p-3 text-right ${kalanOdeme < -0.5 ? 'text-blue-300' : 'text-red-400'}`}>
                          {kalanOdeme < -0.5 ? `+${tl(Math.abs(kalanOdeme))}` : tl(Math.max(0, kalanOdeme))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  export const ReportingView = ({ jobs, personnelList }) => {
    // YENİ: Rapor sekmesi — 'operasyon' (mevcut Operasyon & Ciro Raporu) ile
    // 'maas' (yeni Maaş Raporu) arasında geçiş yapılır. Mevcut rapor koduna
    // hiç dokunulmadı; Maaş Raporu tamamen ayrı bileşen olarak eklendi.
    const [reportTab, setReportTab] = useState('operasyon');
    const [reportPeriod, setReportPeriod] = useState('month'); // 'month' or 'year'
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedType, setSelectedType] = useState('Tümü');

    // İşlerin yıllarını bul
    const years = Array.from(new Set(jobs.map(j => new Date(j.date).getFullYear()))).sort((a,b) => b-a);
    if(years.length === 0) years.push(new Date().getFullYear());

    const months = [
      { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
      { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
      { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
      { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' }
    ];

    // Filtreleme
    const filteredJobs = jobs.filter(job => {
      if (job.status === 'cancelled') return false; // İptal edilenleri cirodan çıkar
      if (selectedType !== 'Tümü' && job.type !== selectedType) return false;
      const d = new Date(job.date);
      if (reportPeriod === 'year') {
        return d.getFullYear() === selectedYear;
      } else {
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      }
    });

    // Veri Toparlama
    const reportData = {};
    filteredJobs.forEach(job => {
      const creator = job.createdBy || 'Sistem / Bilinmeyen';
      if (!reportData[creator]) {
        reportData[creator] = { count: 0, revenue: 0, nakliyeCount: 0, nakliyeRevenue: 0, depoCount: 0, depoRevenue: 0, asansorCount: 0, asansorRevenue: 0, cancelledCount: 0, cancelledNakliyeCount: 0, cancelledDepoCount: 0, cancelledAsansorCount: 0 };
      }
      const price = Number(job.price) || 0;
      reportData[creator].count += 1;
      reportData[creator].revenue += price;
      
      if (job.type === 'Nakliye') { reportData[creator].nakliyeCount += 1; reportData[creator].nakliyeRevenue += price; }
      else if (job.type === 'Depo') { reportData[creator].depoCount += 1; reportData[creator].depoRevenue += price; }
      else if (job.type === 'Asansör') { reportData[creator].asansorCount += 1; reportData[creator].asansorRevenue += price; }
    });

    // YENİ: İptal edilen işleri ayrıca say — her personelin kaç iş iptal ettiğini
    // ayrı bir sayaçta topla (bu işler ciro/toplam iş sayısına dahil DEĞİL,
    // sadece "İş İptali" olarak gösterilir; Nakliye/Depo/Asansör sayıları etkilenmez).
    jobs.forEach(job => {
      if (job.status !== 'cancelled') return;
      // YENİ: 0 TL'lik (kendi işimiz olan) Asansör işlerinin iptali hiç sayılmaz
      if (job.type === 'Asansör' && (Number(job.price) || 0) === 0) return;
      if (selectedType !== 'Tümü' && job.type !== selectedType) return;
      const d = new Date(job.date);
      const inPeriod = reportPeriod === 'year'
        ? d.getFullYear() === selectedYear
        : (d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth);
      if (!inPeriod) return;
      const creator = job.createdBy || 'Sistem / Bilinmeyen';
      if (!reportData[creator]) {
        reportData[creator] = { count: 0, revenue: 0, nakliyeCount: 0, nakliyeRevenue: 0, depoCount: 0, depoRevenue: 0, asansorCount: 0, asansorRevenue: 0, cancelledCount: 0, cancelledNakliyeCount: 0, cancelledDepoCount: 0, cancelledAsansorCount: 0 };
      }
      reportData[creator].cancelledCount = (reportData[creator].cancelledCount || 0) + 1;
      if (job.type === 'Nakliye') reportData[creator].cancelledNakliyeCount = (reportData[creator].cancelledNakliyeCount || 0) + 1;
      else if (job.type === 'Depo') reportData[creator].cancelledDepoCount = (reportData[creator].cancelledDepoCount || 0) + 1;
      else if (job.type === 'Asansör') reportData[creator].cancelledAsansorCount = (reportData[creator].cancelledAsansorCount || 0) + 1;
    });

    const summaryList = Object.keys(reportData)
      .map(k => ({ name: k, ...reportData[k] }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalJobs = filteredJobs.length;
    const totalNakliye = filteredJobs.filter(j => j.type === 'Nakliye').length;
    const totalDepo = filteredJobs.filter(j => j.type === 'Depo').length;
    const totalAsansor = filteredJobs.filter(j => j.type === 'Asansör').length;
    const totalRevenue = summaryList.reduce((acc, curr) => acc + curr.revenue, 0);

    // --- YENİ: İptal Edilen İşler (aynı dönem/tip filtresine göre, sadece ayrı gösterim için) ---
    const cancelledJobsInPeriod = jobs.filter(job => {
      if (job.status !== 'cancelled') return false;
      if (job.type === 'Asansör' && (Number(job.price) || 0) === 0) return false;
      if (selectedType !== 'Tümü' && job.type !== selectedType) return false;
      const d = new Date(job.date);
      if (reportPeriod === 'year') {
        return d.getFullYear() === selectedYear;
      } else {
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      }
    });
    const totalCancelled = cancelledJobsInPeriod.length;
    const cancelledNakliye = cancelledJobsInPeriod.filter(j => j.type === 'Nakliye').length;
    const cancelledDepo = cancelledJobsInPeriod.filter(j => j.type === 'Depo').length;
    const cancelledAsansor = cancelledJobsInPeriod.filter(j => j.type === 'Asansör').length;

    // YENİ: Hasarlı İşler (aynı dönem/tip filtresine göre, Nakliye/Depo ayrı gösterim için)
    const damagedJobsInPeriod = jobs.filter(job => {
      if (job.status === 'cancelled') return false;
      if (job.endJobDetails?.damageStatus !== 'Hasar var') return false;
      if (selectedType !== 'Tümü' && job.type !== selectedType) return false;
      const d = new Date(job.date);
      if (reportPeriod === 'year') {
        return d.getFullYear() === selectedYear;
      } else {
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      }
    });
    const totalDamaged = damagedJobsInPeriod.length;
    const damagedNakliye = damagedJobsInPeriod.filter(j => j.type === 'Nakliye').length;
    const damagedDepo = damagedJobsInPeriod.filter(j => j.type === 'Depo').length;
    const damagedAsansor = damagedJobsInPeriod.filter(j => j.type === 'Asansör').length;

    // YENİ: SEKME ÇUBUĞU — Operasyon & Ciro Raporu ile Maaş Raporu arasında
    // geçiş sağlar. Her iki sekmede de aynı çubuk gösterilir.
    const sekmeBar = (
      <div className="flex bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-sm w-fit">
        <button type="button" onClick={() => setReportTab('operasyon')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition flex items-center gap-2 ${reportTab === 'operasyon' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>
          <BarChart className="w-4 h-4" /> Operasyon & Ciro Raporu
        </button>
        <button type="button" onClick={() => setReportTab('maas')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition flex items-center gap-2 ${reportTab === 'maas' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>
          <DollarSign className="w-4 h-4" /> Maaş Raporu
        </button>
      </div>
    );

    // YENİ: Maaş Raporu sekmesi seçiliyse yeni bileşeni göster (erken dönüş);
    // mevcut Operasyon & Ciro Raporu kodu hiç değişmeden aşağıda çalışmaya devam eder.
    if (reportTab === 'maas') {
      return (
        <div className="space-y-6 animate-in fade-in">
          {sekmeBar}
          <MaasRaporuView personnelList={personnelList} />
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* YENİ: Rapor sekmesi geçiş çubuğu (Operasyon & Ciro / Maaş Raporu) */}
        {sekmeBar}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <BarChart className="w-7 h-7 text-red-600" /> Operasyon & Ciro Raporu
          </h2>
          
          {/* Filtreler */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm w-full md:w-auto">
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button 
                onClick={() => setReportPeriod('month')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${reportPeriod === 'month' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Aylık
              </button>
              <button 
                onClick={() => setReportPeriod('year')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${reportPeriod === 'year' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Yıllık
              </button>
            </div>
            
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            
            {reportPeriod === 'month' && (
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}

            <select 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 text-sm font-bold bg-red-50 text-red-700 border border-red-200 rounded-xl outline-none"
            >
              <option value="Tümü">Tüm Hizmetler</option>
              <option value="Nakliye">Sadece Nakliye</option>
              <option value="Depo">Sadece Depo</option>
              <option value="Asansör">Sadece Asansör</option>
            </select>
          </div>
        </div>

        {/* Özet Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-start gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shrink-0"><ClipboardList className="w-8 h-8" /></div>
            <div className="flex-1">
              <p className="text-neutral-500 text-sm font-bold mb-1">Dönem İçinde Alınan Toplam İş</p>
              <p className="text-3xl font-black text-black mb-2">{totalJobs} <span className="text-sm font-medium text-neutral-400">Adet</span></p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-lg border border-red-100">{totalNakliye} Nakliye</span>
                <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100">{totalDepo} Depo</span>
                <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-lg border border-green-100">{totalAsansor} Asansör</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><TrendingUp className="w-8 h-8" /></div>
            <div>
              <p className="text-neutral-500 text-sm font-bold mb-1">Dönem İçi Toplam Ciro</p>
              <p className="text-3xl font-black text-green-600">₺{totalRevenue.toLocaleString('tr-TR')}</p>
            </div>
          </div>
        </div>

        {/* YENİ: İptal Edilen İşler (rapor/ciro hesaplarına dahil edilmez, sadece bilgi amaçlı ayrı gösterilir) */}
        {totalCancelled > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl shrink-0"><Ban className="w-8 h-8" /></div>
              <div className="flex-1">
                <p className="text-neutral-500 text-sm font-bold mb-1">Dönem İçinde İptal Edilen İşler <span className="text-[10px] font-medium text-neutral-400">(ciro ve toplam iş sayısına dahil değildir)</span></p>
                <p className="text-3xl font-black text-red-600 mb-2">{totalCancelled} <span className="text-sm font-medium text-neutral-400">Adet</span></p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-lg border border-red-100">{cancelledNakliye} Nakliye</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100">{cancelledDepo} Depo</span>
                  <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-lg border border-green-100">{cancelledAsansor} Asansör</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* YENİ: Hasarlı İşler (ekibine "Hasar var" yazılan işler) — Nakliye/Depo/Asansör ayrı gösterilir */}
        {totalDamaged > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-200">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl shrink-0"><AlertTriangle className="w-8 h-8" /></div>
              <div className="flex-1">
                <p className="text-neutral-500 text-sm font-bold mb-1">Dönem İçinde Hasarlı İşler <span className="text-[10px] font-medium text-neutral-400">(ekibine "Hasar var" kaydı yazılan işler)</span></p>
                <p className="text-3xl font-black text-orange-600 mb-2">{totalDamaged} <span className="text-sm font-medium text-neutral-400">Adet</span></p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-lg border border-red-100">{damagedNakliye} Nakliye</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100">{damagedDepo} Depo</span>
                  <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-lg border border-green-100">{damagedAsansor} Asansör</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Personel Performans Tablosu */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2">
            <User className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-black">Personel Kayıt Açma ve Performans Raporu</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="p-4 font-bold">Kayıt Açan Personel</th>
                  <th className="p-4 font-bold text-center">Açılan İş Sayısı Detayı</th>
                  <th className="p-4 font-bold text-right">Getirdiği Toplam Ciro</th>
                  <th className="p-4 font-bold text-right" title="Ortalama hesaplamasına asansör işleri dahil edilmemiştir.">İş Başı Ortalama <br/><span className="text-[10px] font-normal text-neutral-400">(Asansör Hariç)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {summaryList.map((item, index) => (
                  <tr key={index} className="hover:bg-neutral-50 transition">
                    <td className="p-4 font-bold text-black flex items-center gap-3 mt-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {personnelList?.find(p => p.fullName === item.name)?.profileImage ? (
                          <img src={personnelList.find(p => p.fullName === item.name).profileImage} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          item.name.charAt(0)
                        )}
                      </div>
                      {item.name}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-neutral-100 text-black px-3 py-1 rounded-lg font-black text-sm border border-neutral-200 block w-max mx-auto mb-1.5">
                        {item.count} Toplam İş
                      </span>
                      {selectedType === 'Tümü' && (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold">
                          <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{item.nakliyeCount} Nak.</span>
                          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{item.depoCount} Depo</span>
                          <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{item.asansorCount} Asn.</span>
                        </div>
                      )}
                      {/* YENİ: İptal edilen iş sayısı (ciro ve toplam işe dahil değildir) */}
                      {item.cancelledCount > 0 && (
                        <div className="flex flex-col items-center gap-1 mt-1.5">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-lg border border-red-200 text-[10px] font-black flex items-center gap-1">
                            <Ban className="w-3 h-3" /> {item.cancelledCount} İş İptali
                          </span>
                          <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold">
                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{item.cancelledNakliyeCount || 0} Nak.</span>
                            <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{item.cancelledDepoCount || 0} Depo</span>
                            <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{item.cancelledAsansorCount || 0} Asn.</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-black text-green-600 text-base block mb-1">₺{item.revenue.toLocaleString('tr-TR')}</span>
                      {selectedType === 'Tümü' && (
                        <div className="flex flex-col items-end gap-0.5 text-[10px] font-bold">
                          {item.nakliyeRevenue > 0 && <span className="text-red-500">Nak: ₺{item.nakliyeRevenue.toLocaleString('tr-TR')}</span>}
                          {item.depoRevenue > 0 && <span className="text-blue-500">Depo: ₺{item.depoRevenue.toLocaleString('tr-TR')}</span>}
                          {item.asansorRevenue > 0 && <span className="text-green-500">Asn: ₺{item.asansorRevenue.toLocaleString('tr-TR')}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right font-bold text-neutral-600">
                      ₺{(item.count - item.asansorCount) > 0 ? Math.round((item.revenue - item.asansorRevenue) / (item.count - item.asansorCount)).toLocaleString('tr-TR') : 0}
                    </td>
                  </tr>
                ))}
                {summaryList.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-neutral-500 font-medium">Bu döneme ait herhangi bir operasyon kaydı bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  export const AdvancedReportingView = ({ jobs }) => {
    const [reportPeriod, setReportPeriod] = useState('month'); // 'month', 'year', 'all'
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedTab, setSelectedTab] = useState('Nakliye'); // 'Nakliye', 'Depo'

    const years = Array.from(new Set(jobs.map(j => new Date(j.date).getFullYear()))).sort((a,b) => b-a);
    if(years.length === 0) years.push(new Date().getFullYear());

    const months = [
      { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
      { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
      { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
      { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' }
    ];

    const filteredJobs = jobs.filter(job => {
      if (job.status === 'cancelled') return false;
      const jobType = job.type || 'Nakliye';
      if (jobType !== selectedTab) return false;
      
      if (reportPeriod === 'all') return true;

      const d = new Date(job.date);
      if (reportPeriod === 'year') {
        return d.getFullYear() === selectedYear;
      } else {
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      }
    });

    const aggregateData = (data, keyGetter) => {
      const result = {};
      data.forEach(job => {
        const key = keyGetter(job);
        if (!key) return;
        if (!result[key]) result[key] = { count: 0, totalPrice: 0 };
        result[key].count += 1;
        result[key].totalPrice += (parseFloat(job.price) || 0);
      });
      return Object.entries(result).map(([name, val]) => ({
        name,
        count: val.count,
        avgPrice: val.count > 0 ? Math.round(val.totalPrice / val.count) : 0
      })).sort((a, b) => b.count - a.count);
    };

    const cityData = aggregateData(filteredJobs, j => (j.fromProvince && j.toProvince) ? `${j.fromProvince} ➔ ${j.toProvince}` : null);
    const districtData = aggregateData(filteredJobs, j => (j.fromDistrict && j.toDistrict) ? `${j.fromDistrict} ➔ ${j.toDistrict}` : null);
    const roomData = aggregateData(filteredJobs, j => j.fromRoomCount);
    const packingData = aggregateData(filteredJobs, j => j.fromPacking);

    const renderTable = (title, icon, data, nameLabel) => (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-[350px]">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2 shrink-0">
          {icon}
          <h3 className="font-bold text-black text-sm">{title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-white sticky top-0 border-b border-neutral-100 text-neutral-500 shadow-sm z-10">
              <tr>
                <th className="p-3 font-bold">{nameLabel}</th>
                <th className="p-3 font-bold text-center">Adet</th>
                <th className="p-3 font-bold text-right">Ortalama Fiyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-50 transition">
                  <td className="p-3 font-bold text-black">{item.name}</td>
                  <td className="p-3 text-center">
                    <span className="bg-neutral-100 text-black px-2.5 py-1 rounded-lg font-black text-xs border border-neutral-200">
                      {item.count} İş
                    </span>
                  </td>
                  <td className="p-3 text-right font-black text-green-600">
                    ₺{item.avgPrice.toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-6 text-center text-neutral-500 font-medium">Bu döneme ait veri bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <Activity className="w-7 h-7 text-red-600" /> Operasyon Analiz & İstatistik
          </h2>
          
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm w-full md:w-auto">
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button 
                onClick={() => setReportPeriod('month')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${reportPeriod === 'month' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Aylık
              </button>
              <button 
                onClick={() => setReportPeriod('year')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${reportPeriod === 'year' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Yıllık
              </button>
              <button 
                onClick={() => setReportPeriod('all')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${reportPeriod === 'all' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Tüm Zamanlar
              </button>
            </div>
            
            {reportPeriod !== 'all' && (
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            
            {reportPeriod === 'month' && (
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="bg-white p-2 rounded-2xl shadow-sm border border-neutral-200 flex gap-2 overflow-x-auto custom-scrollbar">
           <button
              onClick={() => setSelectedTab('Nakliye')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${selectedTab === 'Nakliye' ? 'bg-red-600 text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}
           >
              <Truck className="w-5 h-5 shrink-0" /> Nakliye Operasyonları Analizi
           </button>
           <button
              onClick={() => setSelectedTab('Depo')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${selectedTab === 'Depo' ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}
           >
              <Database className="w-5 h-5 shrink-0" /> Depolama Operasyonları Analizi
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {renderTable('Şehirler Arası Hareket (İlden İle)', <MapPin className="w-4 h-4 text-red-600" />, cityData, 'Güzergah (İl)')}
           {renderTable('Bölgesel Hareket (İlçeden İlçeye)', <MapPin className="w-4 h-4 text-blue-600" />, districtData, 'Güzergah (İlçe)')}
           {renderTable('Daire / Oda Sayısı Dağılımı', <Briefcase className="w-4 h-4 text-green-600" />, roomData, 'Daire Tipi')}
           {renderTable('Toplama / Ambalaj Hizmeti Dağılımı', <Package className="w-4 h-4 text-orange-600" />, packingData, 'Toplama Tipi')}
        </div>
      </div>
    );
  };

  export const FinanceDashboardView = ({ jobs, transactions, transactionType, setTransactionType, newTransaction, setNewTransaction, handleAddTransaction, personnelList = [], handleEditJob, db, appId }) => {
    const [filterPeriod, setFilterPeriod] = useState('today');

    // YENİ: Maaş tablosundaki (maas koleksiyonu) tüm ayların ödeme kayıtlarını canlı dinle.
    // Personel maaş tablosunda Yemek/Yol/Banka/Nakit/İcra tiklendiğinde yazılan tutarlar
    // burada GİDER olarak toplanır ve ay bazında Kasa Özeti'ne yansır.
    const [maasGiderKayitlari, setMaasGiderKayitlari] = useState([]);
    useEffect(() => {
      if (!db || !appId) return;
      const maasColRef = collection(db, 'artifacts', appId, 'public', 'data', 'maas');
      const unsub = onSnapshot(maasColRef, snap => {
        const list = [];
        snap.docs.forEach(d => {
          const docId = d.id; // format: {prefix}{yıl}_{ay}  (ör. 2026_6 veya beyaz_2026_6)
          const records = (d.data().records) || {};
          const m = docId.match(/(\d{4})_(\d{1,2})$/);
          const yil = m ? parseInt(m[1]) : null;
          const ay = m ? parseInt(m[2]) : null;
          Object.keys(records).forEach(personId => {
            const r = records[personId] || {};
            const person = personnelList.find(p => String(p.id) === String(personId));
            const adSoyad = person ? person.fullName : 'Personel';
            const kalemler = [
              { odendi: r.yemekOdendi, tutar: r.yemekOdenenTutar, etiket: 'Yemek Parası' },
              { odendi: r.yolOdendi, tutar: r.yolOdenenTutar, etiket: 'Yol Parası' },
              { odendi: r.bankaOdendi, tutar: r.bankaOdenenTutar, etiket: 'Maaş (Banka)' },
              { odendi: r.nakitOdendi, tutar: r.nakitOdenenTutar, etiket: 'Maaş (Nakit)' },
              { odendi: r.icraOdendi, tutar: r.icraOdenenTutar, etiket: 'İcra Kesintisi' }
            ];
            kalemler.forEach((k, idx) => {
              const tutar = parseFloat(k.tutar) || 0;
              if (k.odendi && tutar > 0 && yil && ay) {
                list.push({ personId, adSoyad, yil, ay, tutar, etiket: k.etiket, key: `${docId}_${personId}_${idx}` });
              }
            });
          });
        });
        setMaasGiderKayitlari(list);
      }, console.error);
      return () => unsub();
    }, [db, appId, personnelList]);

    // Tarih karşılaştırması için bugünü sıfırla
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let allRecords = [];

    // YENİ: Ekip şefini bulan yardımcı — atanan personeller içinde rütbesi yetkili olan ilk kişi,
    // yoksa listedeki ilk atanan personel.
    const findTeamLeader = (job) => {
      const ids = job.assignedPersonnelIds || [];
      if (ids.length === 0) return '';
      const assigned = ids.map(id => personnelList.find(p => String(p.id) === String(id))).filter(Boolean);
      const leader = assigned.find(p => ['Ekip Şefi', 'Müdür', 'Heryerden Usta', 'Kalfa'].includes(p.rank));
      if (leader) return leader.fullName;
      return assigned[0]?.fullName || '';
    };

    // İşlerden Gelen Kayıtlar — DEĞİŞTİRİLDİ: Artık sadece tamamlananlar değil,
    // iptal olmayan TÜM işler tabloya dahil edilir (durum sütununda gösterilir).
    // Ancak Toplam Gelir/Gider ve net kasa hesabı yalnızca tamamlanan işlerden hesaplanır.
    jobs.filter(j => j.status !== 'cancelled').forEach(job => {
      const jobDate = new Date(job.date);
      jobDate.setHours(0, 0, 0, 0);
      const price = parseFloat(job.price) || 0;
      const deposit = parseFloat(job.deposit) || 0;
      const isCompleted = job.status === 'completed';
      allRecords.push({
        id: 'job_' + job.id,
        rawDate: jobDate,
        displayDate: job.date,
        type: 'income',
        category: (job.type || 'Nakliye') + ' Tahsilatı',
        amount: price,
        deposit: deposit,
        remaining: Math.max(0, price - deposit),
        totalPrice: price,
        customerOrDesc: job.customerName,
        vehicle: job.assignedVehiclePlate || '-',
        paymentMethod: job.endJobDetails?.paymentMethod || '-',
        teamLeader: findTeamLeader(job),
        jobStatus: job.status || 'pending',
        isCompleted,
        isJob: true,
        jobRef: job,
        // Net kasa/gelir hesabına yalnızca tamamlanan işler katkı sağlasın
        countInTotals: isCompleted
      });
    });

    // Manuel Girilen Finans İşlemlerini Topla (Kasa Gideri / Geliri)
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      tDate.setHours(0, 0, 0, 0);
      allRecords.push({
        id: 'trans_' + t.id,
        rawDate: tDate,
        displayDate: t.date,
        type: t.type,
        category: t.category,
        amount: parseFloat(t.amount) || 0,
        deposit: 0,
        remaining: 0,
        totalPrice: parseFloat(t.amount) || 0,
        customerOrDesc: t.description || '-',
        vehicle: '-',
        paymentMethod: t.account === 'cash' ? 'Nakit Kasa' : 'Banka / Havale',
        teamLeader: '',
        jobStatus: 'manual',
        isCompleted: true,
        isJob: false,
        countInTotals: true
      });
    });

    // YENİ: Maaş tablosundan gelen ödenmiş (tikli) kalemleri GİDER olarak ekle.
    // Ay bazında işlensin diye o ayın 1. günü tarih olarak kullanılır; ay/yıl filtreleri doğru çalışır.
    maasGiderKayitlari.forEach(g => {
      const gDate = new Date(g.yil, g.ay - 1, 1);
      gDate.setHours(0, 0, 0, 0);
      allRecords.push({
        id: 'maas_' + g.key,
        rawDate: gDate,
        displayDate: gDate.toISOString().split('T')[0],
        type: 'expense',
        category: 'Personel Ödemesi (' + g.etiket + ')',
        amount: g.tutar,
        deposit: 0,
        remaining: 0,
        totalPrice: g.tutar,
        customerOrDesc: g.adSoyad + ' — ' + g.etiket,
        vehicle: '-',
        paymentMethod: g.etiket === 'Maaş (Banka)' ? 'Banka / Havale' : 'Nakit Kasa',
        teamLeader: '',
        jobStatus: 'manual',
        isCompleted: true,
        isJob: false,
        countInTotals: true
      });
    });

    // YENİ: Önce iş tipine göre (Nakliye → Depo → Asansör) sırala, aynı tip içinde ise tarihe göre yeniden eskiye
    const JOB_TYPE_ORDER_FINANCE = { 'Nakliye': 0, 'Depo': 1, 'Asansör': 2 };
    allRecords.sort((a, b) => {
      const typeA = a.isJob ? (JOB_TYPE_ORDER_FINANCE[a.jobRef?.type] ?? 3) : 4;
      const typeB = b.isJob ? (JOB_TYPE_ORDER_FINANCE[b.jobRef?.type] ?? 3) : 4;
      if (typeA !== typeB) return typeA - typeB;
      return b.rawDate - a.rawDate;
    });

    // Seçilen Filtreye Göre Verileri Ayır
    const filteredRecords = allRecords.filter(r => {
      const rDate = r.rawDate;
      const diffTime = today.getTime() - rDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'today') return rDate.getTime() === today.getTime();
      if (filterPeriod === '3days') return diffDays >= 0 && diffDays <= 3;
      if (filterPeriod === 'month') return rDate.getMonth() === today.getMonth() && rDate.getFullYear() === today.getFullYear();
      if (filterPeriod === '6months') {
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        return rDate >= sixMonthsAgo && rDate <= today;
      }
      if (filterPeriod === 'year') return rDate.getFullYear() === today.getFullYear();
      return true; // 'all' (Tümü)
    });

    const totalIncome = filteredRecords.filter(r => r.type === 'income' && r.countInTotals).reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = filteredRecords.filter(r => r.type === 'expense' && r.countInTotals).reduce((sum, r) => sum + r.amount, 0);
    const netBalance = totalIncome - totalExpense;

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <Wallet className="w-7 h-7 text-red-600" /> Kasa Özeti
          </h2>
          
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm w-full md:w-auto">
            <span className="text-xs font-bold text-neutral-500 pl-2">Tarih Filtresi:</span>
            <select 
              value={filterPeriod} 
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="px-3 py-1.5 text-sm font-bold bg-red-50 border border-red-100 rounded-xl outline-none text-red-700 cursor-pointer"
            >
              <option value="today">Bugünkü Hareketler</option>
              <option value="3days">Son 3 Günlük Hareketler</option>
              <option value="month">Bu Ay</option>
              <option value="6months">Son 6 Aylık</option>
              <option value="year">Bu Sene</option>
              <option value="all">Tüm Zamanlar</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-start gap-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl shrink-0"><ArrowDownRight className="w-8 h-8" /></div>
            <div>
              <p className="text-neutral-500 text-sm font-bold mb-1">Toplam Gelir</p>
              <p className="text-2xl font-black text-green-600">₺{totalIncome.toLocaleString('tr-TR')}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-start gap-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl shrink-0"><ArrowUpRight className="w-8 h-8" /></div>
            <div>
              <p className="text-neutral-500 text-sm font-bold mb-1">Toplam Gider</p>
              <p className="text-2xl font-black text-red-600">₺{totalExpense.toLocaleString('tr-TR')}</p>
            </div>
          </div>
          <div className="bg-black p-6 rounded-2xl shadow-sm border border-black flex items-start gap-4">
            <div className="p-4 bg-neutral-800 text-white rounded-2xl shrink-0"><Landmark className="w-8 h-8" /></div>
            <div>
              <p className="text-neutral-400 text-sm font-bold mb-1">Net Kasa Durumu</p>
              <p className={`text-2xl font-black ${netBalance >= 0 ? 'text-white' : 'text-red-400'}`}>₺{netBalance.toLocaleString('tr-TR')}</p>
            </div>
          </div>
        </div>

        {/* Yeni İşlem Ekleme Formu */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
           <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
             <PlusCircle className="w-5 h-5 text-red-600" /> Manuel Finansal İşlem Ekle
           </h3>
           <div  className="flex flex-col lg:flex-row gap-4">
              <div className="flex bg-neutral-100 p-1 rounded-xl shrink-0">
                <button type="button" onClick={() => setTransactionType('income')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${transactionType === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-neutral-500'}`}>Gelir</button>
                <button type="button" onClick={() => setTransactionType('expense')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${transactionType === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-neutral-500'}`}>Gider</button>
              </div>
              <input required type="number" placeholder="Tutar (₺)" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
              <input required type="text" placeholder="Müşteri İsmi / Açıklama" value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} className="flex-[2] p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
              <select value={newTransaction.account} onChange={e => setNewTransaction({...newTransaction, account: e.target.value})} className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium">
                <option value="cash">Nakit Kasa</option>
                <option value="bank">Banka / Havale</option>
              </select>
              <input required type="date" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
              <button type="button" onClick={handleAddTransaction} className="px-6 py-3 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition">Kaydet</button>
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-black">Hareket Dökümü ve Ödeme Detayları</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="p-4 font-bold rounded-tl-xl">Tarih</th>
                  <th className="p-4 font-bold">Müşteri / Açıklama</th>
                  <th className="p-4 font-bold">Durum</th>
                  <th className="p-4 font-bold">Ekip Şefi</th>
                  <th className="p-4 font-bold">Araç Plakası</th>
                  <th className="p-4 font-bold">Ödeme Şekli (Kasa/Banka)</th>
                  <th className="p-4 font-bold text-right">Tutar (TL)</th>
                  {/* YENİ: Teslimat kodu sütunu — işin müşteriye verdiği 6 haneli kod burada görünür */}
                  <th className="p-4 font-bold text-center">Teslimat Kodu</th>
                  <th className="p-4 font-bold text-center rounded-tr-xl">İş Bilgisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRecords.map(r => {
                  // Durum etiketi ve rengi
                  const statusInfo = !r.isJob
                    ? { label: 'Manuel İşlem', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' }
                    : r.jobStatus === 'completed'
                      ? { label: 'Tamamlandı', cls: 'bg-green-50 text-green-700 border-green-200' }
                      : r.jobStatus === 'in-progress'
                        ? { label: 'Sürüyor', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
                        : { label: 'Bekliyor', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
                  return (
                  <tr key={r.id} className="hover:bg-neutral-50 transition">
                    <td className="p-4 font-medium text-black whitespace-nowrap">{r.displayDate}</td>
                    <td className="p-4">
                      <p className="font-bold text-neutral-800 text-base">{r.customerOrDesc}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5">{r.category}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1.5 rounded-lg text-xs border font-bold flex items-center gap-1.5 w-max ${statusInfo.cls}`}>
                        {r.jobStatus === 'completed' ? <CheckCircle className="w-3.5 h-3.5" /> : r.jobStatus === 'in-progress' ? <Loader2 className="w-3.5 h-3.5" /> : r.isJob ? <Clock className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-neutral-600">
                      {r.teamLeader ? <span className="bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-lg text-xs border border-yellow-200 flex items-center gap-1.5 w-max"><Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500"/>{r.teamLeader}</span> : <span className="text-neutral-400 italic">-</span>}
                    </td>
                    <td className="p-4 font-bold text-neutral-600">
                      {r.vehicle !== '-' ? <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-xs border border-purple-100 flex items-center gap-1.5 w-max"><Truck className="w-3.5 h-3.5"/>{r.vehicle}</span> : <span className="text-neutral-400 italic">Belirtilmedi</span>}
                    </td>
                    <td className="p-4 font-bold text-neutral-600">
                      <span className={`px-3 py-1.5 rounded-lg text-xs border flex items-center gap-1.5 w-max ${r.paymentMethod.includes('Banka') || r.paymentMethod.includes('Havale') || r.paymentMethod.includes('EFT') ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {r.paymentMethod.includes('Banka') || r.paymentMethod.includes('Havale') || r.paymentMethod.includes('EFT') ? <CreditCard className="w-3.5 h-3.5"/> : <Wallet className="w-3.5 h-3.5"/>}
                        {r.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <span className={`font-black text-base block ${r.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {r.type === 'income' ? '+' : '-'}₺{r.amount.toLocaleString('tr-TR')}
                      </span>
                      {r.isJob && (
                        <div className="mt-1 space-y-0.5">
                          <span className="block text-[10px] font-bold text-neutral-500">Toplam Ücret: ₺{r.totalPrice.toLocaleString('tr-TR')}</span>
                          {r.deposit > 0 && <span className="block text-[10px] font-bold text-blue-600">Kapora: ₺{r.deposit.toLocaleString('tr-TR')}</span>}
                          <span className="block text-[10px] font-bold text-orange-600">Kalan: ₺{r.remaining.toLocaleString('tr-TR')}</span>
                        </div>
                      )}
                    </td>
                    {/* YENİ: TESLİMAT KODU — sadece iş kaydı olan satırlarda gösterilir.
                        Manuel gelir/gider kayıtlarında (r.isJob false) veya kodu olmayan
                        (örn. Asansör işleri, kod muaf) kayıtlarda tire görünür. */}
                    <td className="p-4 text-center">
                      {r.isJob && r.jobRef?.deliveryCode ? (
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard?.writeText(r.jobRef.deliveryCode); }}
                          title="Kodu kopyalamak için tıklayın"
                          className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-black rounded-lg border border-neutral-200 tracking-wider transition inline-flex items-center gap-1.5"
                        >
                          <Tag className="w-3.5 h-3.5 text-neutral-400" /> {r.jobRef.deliveryCode}
                        </button>
                      ) : (
                        <span className="text-neutral-300 text-xs italic">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {r.isJob && r.jobRef ? (
                        <button
                          type="button"
                          onClick={() => handleEditJob && handleEditJob(r.jobRef)}
                          className="px-3 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          İşe Git <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-neutral-300 text-xs italic">-</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-neutral-500 font-medium">Seçili tarih aralığında finansal hareket bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  export const PuantajView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [puantajData, setPuantajData] = useState({});
    const [puantajMeta, setPuantajMeta] = useState({ isClosed: false, bonusRecords: {} });
    const [isSaving, setIsSaving] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const currentDayRef = React.useRef(null);
    
    // Ay Kapanış Modalı State'leri
    const [showMonthCloseModal, setShowMonthCloseModal] = useState(false);
    const [monthCloseModalData, setMonthCloseModalData] = useState(null);

    const docPrefix = collarType === 'Mavi Yaka' ? '' : 'beyaz_';

    const months = [
      { val: 1, label: 'Ocak' }, { val: 2, label: 'Şubat' }, { val: 3, label: 'Mart' },
      { val: 4, label: 'Nisan' }, { val: 5, label: 'Mayıs' }, { val: 6, label: 'Haziran' },
      { val: 7, label: 'Temmuz' }, { val: 8, label: 'Ağustos' }, { val: 9, label: 'Eylül' },
      { val: 10, label: 'Ekim' }, { val: 11, label: 'Kasım' }, { val: 12, label: 'Aralık' }
    ];
    const years = Array.from({ length: 10 }, (_, i) => 2024 + i);

    const targetPersonnelList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (!isPersonnelVisibleInMonth(p, currentYear, currentMonth)) return false;
      return collarType === 'Mavi Yaka' 
        ? (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
        : (p.collarType === 'Beyaz Yaka' || (!p.collarType && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
    }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'));

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    useEffect(() => {
      if (currentDayRef.current) {
        setTimeout(() => {
          currentDayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 300);
      }
    }, [currentMonth, currentYear, targetPersonnelList.length]);

    useEffect(() => {
      const fetchPuantaj = async () => {
        setIsDataLoaded(false);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${docPrefix}${currentYear}_${currentMonth}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setPuantajData(snap.data().records || {});
            setPuantajMeta({
              isClosed: snap.data().isClosed || false,
              bonusRecords: snap.data().bonusRecords || {}
            });
          } else {
            setPuantajData({});
            setPuantajMeta({ isClosed: false, bonusRecords: {} });
          }
        } catch (e) {
          console.error("Puantaj yüklenirken hata:", e);
        } finally {
          setIsDataLoaded(true);
        }
      };
      fetchPuantaj();
    }, [currentMonth, currentYear, db, appId, docPrefix]);

    useEffect(() => {
      if (!isDataLoaded) return;
      const timeoutId = setTimeout(async () => {
        setIsSaving(true);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${docPrefix}${currentYear}_${currentMonth}`);
          await setDoc(docRef, { records: puantajData, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
          console.error("Otomatik kaydetme hatası:", e);
        }
        setTimeout(() => setIsSaving(false), 800);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }, [puantajData]);

    const handleCellChange = (personId, day, value) => {
      setPuantajData(prev => ({
        ...prev,
        [personId]: {
          ...(prev[personId] || {}),
          [day]: value
        }
      }));
    };

    const handleDownloadPDF = () => {
      const printWindow = window.open('', '_blank');
      
      let tableRows = targetPersonnelList.map(person => {
        const rawTotal = getPersonTotal(person.id);
        const bonusTotal = puantajMeta.bonusRecords[person.id] || 0;
        const netTotal = rawTotal + bonusTotal;
        
        const rawStr = rawTotal > 0 ? rawTotal.toString().replace('.', ',') : '';
        const bonusStr = bonusTotal > 0 ? `+${bonusTotal}` : '';
        const netStr = netTotal > 0 ? netTotal.toString().replace('.', ',') : '';

        let daysHtml = days.map(d => {
          const val = (puantajData[person.id] && puantajData[person.id][d]) || '';
          return `<td style="border: 1px solid #000; text-align: center; padding: 2px; height: 20px;">${val}</td>`;
        }).join('');
        
        return `
          <tr>
            <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold; white-space: nowrap; font-size: 11px;">${person.fullName.toUpperCase()}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #fef08a;">${rawStr}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #e9d5ff;">${bonusStr}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #facc15;">${netStr}</td>
            ${daysHtml}
          </tr>
        `;
      }).join('');

      let commentsHtml = days.map(d => {
        const val = (puantajData['daily_comments'] && puantajData['daily_comments'][d]) || '';
        return `<td style="border: 1px solid #000; text-align: center; padding: 2px; background-color: #22c55e; color: white; font-weight: bold;">${val}</td>`;
      }).join('');

        let daysHeaderHtml = days.map(d => `<th style="border: 1px solid #000; padding: 2px; min-width: 20px; background-color: #8bb4e7; font-size: 9px;">${String(d).padStart(2, '0')}.${String(currentMonth).padStart(2, '0')}<br/>${currentYear}</th>`).join('');

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${collarType.replace(' ', '_')}_Puantaj_${months.find(m => m.val === currentMonth)?.label}_${currentYear}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #000; padding: 2px; overflow: hidden; text-overflow: ellipsis; }
          .header-title { background-color: #f97316; color: black; font-weight: bold; font-size: 16px; text-align: center; padding: 8px; border: 2px solid #000; }
          .bg-yellow { background-color: #facc15; }
          .bg-black { background-color: #000; color: #fff; }
          .bg-gray { background-color: #e5e7eb; color: #dc2626; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th colspan="${daysInMonth + 4}" class="header-title">${months.find(m => m.val === currentMonth)?.label.toUpperCase()} ${currentYear} ${collarType.toUpperCase()} PUANTAJ LİSTESİ</th>
            </tr>
            <tr>
              <th colspan="4" class="bg-yellow" style="text-align: center; font-size: 12px; padding: 4px;">GENEL NET TOPLAM : ${targetPersonnelList.reduce((acc, p) => acc + getPersonTotal(p.id) + (puantajMeta.bonusRecords[p.id] || 0), 0) > 0 ? targetPersonnelList.reduce((acc, p) => acc + getPersonTotal(p.id) + (puantajMeta.bonusRecords[p.id] || 0), 0).toString().replace('.', ',') : ''}</th>
              <th colspan="${daysInMonth}" class="bg-black" style="text-align: center; letter-spacing: 2px; padding: 4px;">GÜN BİLGİSİ</th>
            </tr>
            <tr>
              <th class="bg-gray" style="text-align: left; padding: 4px 8px; width: 150px;">AD SOYAD</th>
              <th class="bg-yellow" style="width: 30px; font-size: 9px;">HAM</th>
              <th style="background-color: #e9d5ff; width: 30px; font-size: 9px;">BONUS</th>
              <th class="bg-yellow" style="width: 30px; font-size: 9px;">NET</th>
              ${daysHeaderHtml}
            </tr>
            <tr>
              <th class="bg-gray" style="text-align: center; font-size: 16px;">${getPersonTotal('daily_comments') > 0 ? getPersonTotal('daily_comments').toString().replace('.', ',') : ''}</th>
              <th colspan="3" class="bg-yellow" style="font-size: 9px;">YORUM SAYISI</th>
              ${commentsHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
          setTimeout(() => { window.print(); window.close(); }, 500);
        </script>
      </body>
      </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    };

    const getPersonTotal = (personId) => {
      const record = puantajData[personId] || {};
      return Object.values(record).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    };

    const handleCloseMonth = () => {
      const rawTotals = targetPersonnelList.map(p => ({
          id: p.id,
          name: p.fullName,
          rawScore: getPersonTotal(p.id)
      }));

      const uniqueScores = [...new Set(rawTotals.map(p => p.rawScore))]
          .filter(s => s > 0)
          .sort((a, b) => b - a);

      const rank1Score = uniqueScores[0] || -1;
      const rank2Score = uniqueScores[1] || -1;
      const rank3Score = uniqueScores[2] || -1;

      const newBonusRecords = {};
      const winners = { rank1: [], rank2: [], rank3: [] };

      rawTotals.forEach(p => {
          if (p.rawScore === rank1Score && rank1Score > 0) {
              newBonusRecords[p.id] = 10;
              winners.rank1.push(p);
          }
          else if (p.rawScore === rank2Score && rank2Score > 0) {
              newBonusRecords[p.id] = 5;
              winners.rank2.push(p);
          }
          else if (p.rawScore === rank3Score && rank3Score > 0) {
              newBonusRecords[p.id] = 3;
              winners.rank3.push(p);
          }
          else {
              newBonusRecords[p.id] = 0;
          }
      });

      const finalTotals = rawTotals.map(p => ({
          ...p,
          bonusScore: newBonusRecords[p.id],
          finalScore: p.rawScore + newBonusRecords[p.id]
      }));

      const over20 = finalTotals.filter(p => p.finalScore >= 20);

      const yorumSayisi = getPersonTotal('daily_comments');
      const N = over20.length;
      const cikanRakam = (yorumSayisi * N) / 8;

      // YENİ: Prim = her bir NET puanın (raw + bonus) 0.5 ile çarpımı. (Örn. 35 net puan → 17.5 prim)
      const nextMonthPrims = {};
      over20.forEach(p => {
          nextMonthPrims[p.id] = p.finalScore * 0.5;
      });
      // YENİ: 20 üstü herkesi net puana göre büyükten küçüğe sıralı liste (modalde sıralama gösterimi için)
      const over20Sorted = [...over20].sort((a, b) => b.finalScore - a.finalScore);

      setMonthCloseModalData({
          rank1Score, rank2Score, rank3Score,
          winners, over20, over20Sorted, yorumSayisi, cikanRakam, nextMonthPrims, newBonusRecords
      });
      setShowMonthCloseModal(true);
    };

    // ==========================================================================
    // YENİ (kullanıcı talebi): 20 PUAN ÜSTÜ SIRALAMAYI EXCEL OLARAK İNDİR
    // --------------------------------------------------------------------------
    // Ay kapatma ekranındaki tüm 20+ puan sıralamasını (ham puan, kazanılan
    // bonus, net puan ve gelecek aya yansıyacak prim tutarıyla birlikte) tek
    // tıkla indirir. Projede zaten kullanılan yöntemin (UTF-8 BOM'lu CSV)
    // aynısı — Excel bu dosyayı Türkçe karakterlerle sorunsuz açar. Ayrı bir
    // kütüphane gerekmez; mevcut maaş tablosu indirmesiyle birebir aynı desen.
    // ==========================================================================
    const primSiralamaExcelIndir = () => {
      if (!monthCloseModalData) return;
      const liste = monthCloseModalData.over20Sorted || monthCloseModalData.over20 || [];
      const ayEtiketi = months.find(m => m.val === currentMonth)?.label || currentMonth;
      // Excel'in ; ayıracını doğru yorumlaması için başa "sep=;" satırı, Türkçe
      // karakterler için başa BOM eklenir.
      let csv = 'sep=;\n';
      csv += `${collarType} — ${ayEtiketi} ${currentYear} • 20 Puan Üstü Prim Sıralaması\n\n`;
      csv += ['Sıra', 'Personel', 'Ham Puan', 'Kazanılan Bonus', 'Net Puan', 'Gelecek Ay Primi (Net × 0.5)'].join(';') + '\n';
      liste.forEach((p, idx) => {
        const prim = monthCloseModalData.nextMonthPrims?.[p.id];
        csv += [
          idx + 1,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          p.rawScore ?? '',
          p.bonusScore ? `+${p.bonusScore}` : '0',
          p.finalScore ?? '',
          (typeof prim === 'number' ? prim.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : ''),
        ].join(';') + '\n';
      });
      // Özet satırları
      csv += '\n';
      csv += `Toplam Yorum;${monthCloseModalData.yorumSayisi ?? ''}\n`;
      csv += `20 Puan ve Üzeri Kişi;${(monthCloseModalData.over20 || []).length}\n`;
      const toplamPrim = liste.reduce((t, p) => t + (monthCloseModalData.nextMonthPrims?.[p.id] || 0), 0);
      csv += `Toplam Dağıtılacak Prim;${toplamPrim.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}\n`;

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${collarType.replace(' ', '_')}_Prim_Siralamasi_${ayEtiketi}_${currentYear}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addSystemLog?.('Prim Sıralaması İndirildi', `${collarType} ${ayEtiketi} ${currentYear} • ${liste.length} kişilik 20 puan üstü sıralama Excel olarak indirildi.`);
    };

    // ==========================================================================
    // YENİ (kullanıcı talebi): İLK 3 "ZİRVEDEKİLER" SERTİFİKASI (A4 PDF)
    // --------------------------------------------------------------------------
    // Ay kapatma ekranındaki ilk 3 personeli (1./2./3. sıra), ikinci ekran
    // görüntüsündeki tasarımla — bordo zemin, altın çelenkli madalyon içinde
    // profil fotoğrafı, altında isim şeridi — A4 dikey bir sayfaya dizer ve
    // yazdırma/PDF penceresi açar (projede zaten kullanılan window.print()
    // yöntemi; kullanıcı "PDF olarak kaydet"i seçince A4 PDF iner).
    // YERLEŞİM (2. ekrandaki gibi): üstte yan yana 1. ve 2., altta ortada 3.
    // Fotoğraf id ile personnelList'ten (profileImage) çekilir; fotoğrafı
    // olmayan için baş harf rozeti gösterilir (kırılmaz).
    // ==========================================================================
    const zirveSertifikasiIndir = () => {
      if (!monthCloseModalData) return;
      const w = monthCloseModalData.winners || { rank1: [], rank2: [], rank3: [] };
      const sirali = [
        { p: w.rank1?.[0], sira: 1 },
        { p: w.rank2?.[0], sira: 2 },
        { p: w.rank3?.[0], sira: 3 },
      ].filter(x => x.p);
      if (sirali.length === 0) { alert('İlk 3 sıralamada personel bulunmuyor.'); return; }
      const ayEtiketi = (months.find(m => m.val === currentMonth)?.label || String(currentMonth)).toLocaleUpperCase('tr-TR');
      const fotoBul = (id) => (personnelList.find(pp => String(pp.id) === String(id))?.profileImage) || '';

      const madalyon = (kisi, sira) => {
        const foto = fotoBul(kisi.id);
        const bas = (kisi.name || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
        const siraRenk = sira === 1 ? '#FFD54A' : sira === 2 ? '#D9D9D9' : '#E8A55B';
        const icerik = foto
          ? `<image href="${foto}" x="0" y="0" width="200" height="230" preserveAspectRatio="xMidYMid slice" clip-path="url(#arch${sira})" />`
          : `<rect x="0" y="0" width="200" height="230" fill="#7a1220" clip-path="url(#arch${sira})"/><text x="100" y="140" text-anchor="middle" font-size="90" font-weight="bold" fill="#e8c98a" font-family="Georgia,serif">${bas}</text>`;
        return `
        <div class="kart">
          <div class="sira-rozet" style="background:${siraRenk};">${sira}</div>
          <svg viewBox="0 0 300 300" width="230" height="230" xmlns="http://www.w3.org/2000/svg">
            <defs><clipPath id="arch${sira}"><path d="M0,230 L0,90 A100,100 0 0,1 200,90 L200,230 Z"/></clipPath></defs>
            <g fill="#d4af37" transform="translate(6,150)">
              ${[0,1,2,3,4,5].map(i=>`<ellipse cx="18" cy="${-i*22}" rx="16" ry="8" transform="rotate(-35 18 ${-i*22})"/>`).join('')}
            </g>
            <g fill="#d4af37" transform="translate(294,150) scale(-1,1)">
              ${[0,1,2,3,4,5].map(i=>`<ellipse cx="18" cy="${-i*22}" rx="16" ry="8" transform="rotate(-35 18 ${-i*22})"/>`).join('')}
            </g>
            <g transform="translate(50,20)">
              <path d="M0,230 L0,90 A100,100 0 0,1 200,90 L200,230 Z" fill="none" stroke="#d4af37" stroke-width="8"/>
              ${icerik}
            </g>
          </svg>
          <div class="isim-serit">${(kisi.name || '').toLocaleUpperCase('tr-TR')}</div>
        </div>`;
      };

      const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
      <title>${ayEtiketi}_${currentYear}_Zirvedekiler</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        body { width:210mm; height:297mm; font-family:'Georgia','Times New Roman',serif;
          background:radial-gradient(circle at 50% 30%, #7a1220 0%, #4a0a13 70%, #300109 100%);
          color:#fff; display:flex; flex-direction:column; align-items:center; padding:22mm 14mm; }
        .baslik { font-size:52px; font-weight:bold; letter-spacing:3px; text-align:center; line-height:1.05; }
        .alt-baslik { font-size:40px; font-weight:bold; letter-spacing:6px; text-align:center; margin-bottom:6mm; }
        .ust-sira { display:flex; justify-content:center; gap:26mm; margin-top:8mm; }
        .alt-sira { display:flex; justify-content:center; margin-top:6mm; }
        .kart { position:relative; display:flex; flex-direction:column; align-items:center; }
        .sira-rozet { position:absolute; top:-6px; left:50%; transform:translateX(-50%); z-index:2;
          width:34px; height:34px; border-radius:50%; color:#4a0a13; font-weight:bold; font-size:18px;
          display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,.4); border:2px solid #fff; }
        .isim-serit { margin-top:-6px; background:linear-gradient(180deg,#f7e9c4,#e6c883);
          color:#5a3a12; font-weight:bold; font-size:17px; letter-spacing:1px; padding:8px 22px;
          border-radius:6px; box-shadow:0 3px 8px rgba(0,0,0,.4); border:2px solid #b8860b; white-space:nowrap; max-width:230px; overflow:hidden; text-overflow:ellipsis; text-align:center; }
        .dilek { margin-top:auto; font-size:24px; font-weight:bold; letter-spacing:1px; text-align:center; }
        .web { font-size:16px; letter-spacing:3px; color:#e8c98a; margin-top:8px; }
      </style></head>
      <body>
        <div class="baslik">${ayEtiketi} AYI</div>
        <div class="alt-baslik">ZİRVEDEKİLER</div>
        <div class="ust-sira">
          ${sirali.filter(x => x.sira <= 2).map(x => madalyon(x.p, x.sira)).join('')}
        </div>
        <div class="alt-sira">
          ${sirali.filter(x => x.sira === 3).map(x => madalyon(x.p, x.sira)).join('')}
        </div>
        <div class="dilek">BAŞARILARINIZIN DEVAMINI DİLERİZ.</div>
        <div class="web">www.sembolnakliyat.com</div>
        <script>
          window.onload = () => { setTimeout(() => { window.print(); }, 700); };
        </script>
      </body></html>`;

      const pw = window.open('', '_blank');
      if (!pw) { alert('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından izin verin.'); return; }
      pw.document.open(); pw.document.write(html); pw.document.close();
      addSystemLog?.('Zirvedekiler Sertifikası', `${ayEtiketi} ${currentYear} • ilk 3 personel sertifikası (A4 PDF) oluşturuldu.`);
    };

    const confirmCloseMonth = async () => {
       try {
           const puantajRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${docPrefix}${currentYear}_${currentMonth}`);
           await setDoc(puantajRef, {
               bonusRecords: monthCloseModalData.newBonusRecords,
               isClosed: true,
               appliedPrims: monthCloseModalData.nextMonthPrims // YENİ: Geri alma için uygulanan primler saklanır
           }, { merge: true });

           let nextMonth = currentMonth + 1;
           let nextYear = currentYear;
           if (nextMonth > 12) {
               nextMonth = 1;
               nextYear++;
           }
           const nextDocId = `${docPrefix}${nextYear}_${nextMonth}`;
           const nextMaasRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', nextDocId);
           const nextMaasSnap = await getDoc(nextMaasRef);
           let nextMaasRecords = nextMaasSnap.exists() ? nextMaasSnap.data().records : {};

           Object.keys(monthCloseModalData.nextMonthPrims).forEach(pId => {
               if (!nextMaasRecords[pId]) nextMaasRecords[pId] = {};
               const existingPrim = parseFloat(nextMaasRecords[pId].prim) || 0;
               nextMaasRecords[pId].prim = existingPrim + monthCloseModalData.nextMonthPrims[pId];
           });

           await setDoc(nextMaasRef, { records: nextMaasRecords, updatedAt: new Date().toISOString() }, { merge: true });

           setPuantajMeta(prev => ({...prev, bonusRecords: monthCloseModalData.newBonusRecords, isClosed: true, appliedPrims: monthCloseModalData.nextMonthPrims}));
           setShowMonthCloseModal(false);
           addSystemLog('Ay Sonu Kapanışı', `${currentMonth}/${currentYear} dönemi ${collarType} puantajı kapatıldı, primler hesaplanıp ${nextMonth}/${nextYear} maaşlarına eklendi.`);
           
       } catch (e) {
           console.error(e);
           alert("Kapatma işlemi sırasında hata oluştu.");
       }
    };

    // YENİ: AY KAPANIŞINI GERİ AL — kapatmada uygulanan bonus puanları ve gelecek aya
    // eklenen primleri geri alır; ayı tekrar açık (düzenlenebilir) hale getirir.
    const handleUndoCloseMonth = async () => {
      if (!window.confirm('Bu ayın kapanışını geri almak istediğinize emin misiniz?\n\nVerilen bonus puanlar ve gelecek aya eklenen primler geri alınacak, ay yeniden düzenlenebilir hale gelecek.')) return;
      try {
          const appliedPrims = puantajMeta.appliedPrims || {};

          // 1) Gelecek aydaki maaş primlerinden, kapatmada eklenen tutarları düş
          let nextMonth = currentMonth + 1;
          let nextYear = currentYear;
          if (nextMonth > 12) { nextMonth = 1; nextYear++; }
          const nextDocId = `${docPrefix}${nextYear}_${nextMonth}`;
          const nextMaasRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', nextDocId);
          const nextMaasSnap = await getDoc(nextMaasRef);
          if (nextMaasSnap.exists()) {
              let nextMaasRecords = nextMaasSnap.data().records || {};
              Object.keys(appliedPrims).forEach(pId => {
                  if (nextMaasRecords[pId]) {
                      const existingPrim = parseFloat(nextMaasRecords[pId].prim) || 0;
                      nextMaasRecords[pId].prim = Math.max(0, existingPrim - (parseFloat(appliedPrims[pId]) || 0));
                  }
              });
              await setDoc(nextMaasRef, { records: nextMaasRecords, updatedAt: new Date().toISOString() }, { merge: true });
          }

          // 2) Puantaj meta: bonusları temizle, kapalı durumu ve uygulanan primleri sıfırla
          const puantajRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${docPrefix}${currentYear}_${currentMonth}`);
          await setDoc(puantajRef, { bonusRecords: {}, isClosed: false, appliedPrims: {} }, { merge: true });

          setPuantajMeta(prev => ({ ...prev, bonusRecords: {}, isClosed: false, appliedPrims: {} }));
          addSystemLog('Ay Kapanışı Geri Alındı', `${currentMonth}/${currentYear} dönemi ${collarType} kapanışı geri alındı; bonus puanlar ve ${nextMonth}/${nextYear} maaşına eklenen primler iptal edildi.`);
      } catch (e) {
          console.error(e);
          alert("Geri alma işlemi sırasında hata oluştu.");
      }
    };


    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 md:p-6 animate-in fade-in flex flex-col min-h-[920px] h-[calc(100vh-190px)] relative w-full overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 shrink-0 gap-4 w-full">
          <h2 className="text-lg md:text-xl font-bold text-black flex items-center gap-2">
            <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-red-600" /> {collarType} Puantaj Tablosu
          </h2>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select value={currentMonth} onChange={e => setCurrentMonth(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-red-600 cursor-pointer flex-1 md:flex-none text-sm">
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            <select value={currentYear} onChange={e => setCurrentYear(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-red-600 cursor-pointer flex-1 md:flex-none text-sm">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleDownloadPDF} className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-md text-sm mt-1 md:mt-0 order-last md:order-none">
              <Download className="w-4 h-4" /> 
              Tabloyu İndir
            </button>
            {!puantajMeta.isClosed ? (
                <button onClick={handleCloseMonth} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-md text-sm mt-1 md:mt-0 order-last md:order-none">
                  <Star className="w-4 h-4" /> Ayı Kapat & Primleri Dağıt
                </button>
            ) : (
                <div className="flex items-center gap-2 w-full md:w-auto mt-1 md:mt-0 order-last md:order-none">
                  <div className="flex-1 md:flex-none bg-purple-100 text-purple-800 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 border border-purple-200 text-sm cursor-not-allowed">
                    <CheckCircle className="w-4 h-4" /> Ay Kapatıldı
                  </div>
                  {/* YENİ: Kapanışı geri al — bonus puanları ve eklenen primleri iptal eder */}
                  <button onClick={handleUndoCloseMonth} title="Ay kapanışını geri al" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition shadow-md text-sm">
                    <ArrowRightLeft className="w-4 h-4" /> Geri Al
                  </button>
                </div>
            )}
            <div className="flex items-center w-full md:w-28 justify-center md:justify-end mt-1 md:mt-0">
              {isSaving ? (
                <span className="text-xs font-bold text-neutral-400 flex items-center gap-1 animate-pulse"><Loader2 className="w-3 h-3 animate-spin"/> Kaydediliyor...</span>
              ) : isDataLoaded ? (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Kaydedildi</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 w-full overflow-auto overflow-x-auto border border-neutral-300 custom-scrollbar-table rounded-xl bg-white shadow-inner relative">
          <table className="w-full border-collapse text-xs md:text-sm min-w-max">
            <thead className="sticky top-0 z-30 shadow-md">
              <tr>
                <th colSpan={daysInMonth + 4} className="bg-orange-500 text-black font-black py-2 border-b-2 border-neutral-400 text-sm md:text-lg tracking-wider">
                  {months.find(m => m.val === currentMonth)?.label.toUpperCase()} {currentYear} {collarType.toUpperCase()} PUANTAJ LİSTESİ
                </th>
              </tr>
              <tr>
                <th colSpan="4" className="bg-yellow-400 border-b border-r border-neutral-400 text-center text-xs md:text-xl font-black text-black p-1 md:p-2">
                  <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
                    <span className="text-[9px] md:text-sm font-bold text-black/70 uppercase tracking-tight">GENEL NET TOPLAM :</span>
                    <span>{targetPersonnelList.reduce((acc, p) => acc + getPersonTotal(p.id) + (puantajMeta.bonusRecords[p.id] || 0), 0) > 0 ? targetPersonnelList.reduce((acc, p) => acc + getPersonTotal(p.id) + (puantajMeta.bonusRecords[p.id] || 0), 0).toString().replace('.', ',') : ''}</span>
                  </div>
                </th>
                <th colSpan={daysInMonth} className="bg-black text-white font-bold p-1 border-b border-neutral-400 text-[9px] md:text-xs tracking-widest">
                  GÜN BİLGİSİ
                </th>
              </tr>
              <tr>
                <th className="bg-neutral-200 text-red-600 font-black p-1 md:p-2 border-b border-r border-neutral-400 sticky left-0 z-30 w-24 min-w-[90px] md:w-64 md:min-w-[220px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">AD SOYAD</th>
                <th className="bg-yellow-200 text-black font-black p-1 md:p-2 border-b border-r border-neutral-400 w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px] leading-tight text-[8px] md:text-[10px]">HAM<br/>PUAN</th>
                <th className="bg-purple-200 text-purple-900 font-black p-1 md:p-2 border-b border-r border-neutral-400 w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px] leading-tight text-[8px] md:text-[10px]">BONUS</th>
                <th className="bg-yellow-400 text-black font-black p-1 md:p-2 border-b border-r border-neutral-400 w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px] leading-tight text-[8px] md:text-[10px]">NET<br/>PUAN</th>
                {days.map(d => {
                  const isToday = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1 && d === today.getDate();
                  return (
                    <th key={d} ref={isToday ? currentDayRef : null} className={`bg-[#8bb4e7] text-black font-bold p-1 md:p-1 border-b border-r border-neutral-400 w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px] ${isToday ? 'bg-red-500 text-white shadow-md z-10 relative ring-2 ring-red-500 ring-inset' : ''}`}>
                      <div className="text-[9px] md:text-[11px] tracking-tight">{String(d).padStart(2, '0')}.{String(currentMonth).padStart(2, '0')}</div>
                      {isToday && <div className="text-[7px] md:text-[9px] uppercase mt-0.5 font-black text-white/90">BUGÜN</div>}
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="bg-neutral-100 text-red-600 font-black p-1 md:p-2 border-b border-r border-neutral-400 sticky left-0 z-30 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-24 min-w-[90px] md:w-64 md:min-w-[220px]">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[8px] md:text-[11px] text-neutral-600 uppercase tracking-tighter font-bold">GENEL YORUM / PUAN</span>
                    <span className="text-sm md:text-2xl">{getPersonTotal('daily_comments') > 0 ? getPersonTotal('daily_comments').toString().replace('.', ',') : '0'}</span>
                  </div>
                </th>
                <th colSpan="3" className="bg-yellow-400 text-black font-black p-1 border-b border-r border-neutral-400 text-[7px] md:text-[11px] leading-tight text-center">
                  YORUM SAYISI
                </th>
                {days.map(d => (
                  <th key={`comment-${d}`} className="bg-green-500 p-0 border-b border-r border-green-600 relative w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px]">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={(puantajData['daily_comments'] && puantajData['daily_comments'][d]) || ''}
                      onChange={(e) => handleCellChange('daily_comments', d, e.target.value)}
                      className="w-full h-7 md:h-10 text-center text-[10px] md:text-sm font-bold text-white bg-transparent outline-none focus:bg-green-600 focus:ring-inset focus:ring-2 focus:ring-white transition-colors appearance-none placeholder-green-300"
                      style={{ MozAppearance: 'textfield' }}
                      disabled={puantajMeta.isClosed}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targetPersonnelList.map((person, index) => {
                const rawTotal = getPersonTotal(person.id);
                const bonusTotal = puantajMeta.bonusRecords[person.id] || 0;
                const netTotal = rawTotal + bonusTotal;

                return (
                <tr key={person.id} className="hover:bg-neutral-50 transition border-b border-neutral-300 group">
                  <td className="sticky left-0 z-20 bg-white group-hover:bg-neutral-50 border-r border-neutral-400 p-1 md:p-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-24 min-w-[90px] md:w-64 md:min-w-[220px]">
                    <div className="flex items-center gap-1.5 md:gap-2.5">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 border border-neutral-300 text-[8px] md:text-sm">
                        {person.profileImage ? (
                          <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                        ) : (
                          person.fullName.charAt(0)
                        )}
                      </div>
                      <span className="font-bold text-neutral-800 text-[9px] md:text-xs truncate max-w-[50px] md:max-w-[160px] leading-tight">{person.fullName.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="bg-yellow-100/70 text-black font-black text-center border-r border-neutral-400 text-xs md:text-base w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px]">
                    {rawTotal > 0 ? rawTotal.toString().replace('.', ',') : ''}
                  </td>
                  <td className="bg-purple-100/70 text-purple-900 font-black text-center border-r border-neutral-400 text-xs md:text-base w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px]">
                    {bonusTotal > 0 ? `+${bonusTotal}` : ''}
                  </td>
                  <td className="bg-yellow-400/80 text-black font-black text-center border-r border-neutral-400 text-xs md:text-base w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px]">
                    {netTotal > 0 ? netTotal.toString().replace('.', ',') : ''}
                  </td>
                  {days.map(d => {
                    const isToday = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1 && d === today.getDate();
                    return (
                      <td key={d} className={`border-r border-neutral-300 p-0 text-center relative w-10 min-w-[40px] max-w-[40px] md:w-14 md:min-w-[56px] md:max-w-[56px] ${isToday ? 'bg-red-50/40' : 'bg-white'}`}>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={(puantajData[person.id] && puantajData[person.id][d]) || ''}
                          onChange={(e) => handleCellChange(person.id, d, e.target.value)}
                          className={`w-full h-7 md:h-11 text-center text-[10px] md:text-sm font-bold text-black outline-none focus:ring-inset focus:ring-2 focus:ring-blue-600 transition-colors appearance-none ${isToday ? 'bg-transparent focus:bg-blue-100' : 'bg-transparent focus:bg-blue-100'}`}
                          style={{ MozAppearance: 'textfield' }}
                          disabled={puantajMeta.isClosed}
                        />
                      </td>
                    );
                  })}
                </tr>
                );
              })}
              {targetPersonnelList.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth + 4} className="p-4 md:p-8 text-center text-neutral-500 font-medium text-xs md:text-sm">
                    Sistemde {collarType.toLowerCase()} personel kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showMonthCloseModal && monthCloseModalData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-black text-xl flex items-center gap-2"><Star className="w-6 h-6 fill-white" /> Ay Sonu Kapanışı & Prim Dağıtımı</h3>
                <button onClick={() => setShowMonthCloseModal(false)} className="text-white/80 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* 1. Kısım: Dereceye Girenler */}
                <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                    <div className="flex items-center justify-between gap-2 mb-4 border-b border-purple-200 pb-2">
                        <h4 className="font-black text-purple-900 text-lg flex items-center gap-2">🏆 En Çok Puan Alanlar (Bonus Puanlar)</h4>
                        {/* YENİ (kullanıcı talebi): İlk 3'ün fotoğraflı A4 sertifikasını indir */}
                        <button onClick={zirveSertifikasiIndir}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-[11px] font-black rounded-lg transition shadow-sm">
                            <Download className="w-3.5 h-3.5" /> Zirvedekiler (PDF)
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-yellow-300 shadow-sm">
                            <span className="text-2xl">🥇</span>
                            <div>
                                <p className="font-black text-yellow-600 text-lg leading-none mb-1">1. Sıra <span className="text-sm text-neutral-500">({monthCloseModalData.rank1Score > 0 ? monthCloseModalData.rank1Score : 0} Puan)</span></p>
                                <p className="text-sm font-bold text-neutral-800">
                                    {monthCloseModalData.winners.rank1.length > 0 ? monthCloseModalData.winners.rank1.map(w => w.name).join(', ') : 'Kimse Yok'}
                                </p>
                                {monthCloseModalData.winners.rank1.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-white bg-yellow-500 px-2 py-0.5 rounded-full">+10 Puan Eklenecek</span>
                                    {/* YENİ: Bonus eklenmiş NET toplam puan */}
                                    <span className="text-[10px] font-black text-yellow-700 bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded-full">Net: {monthCloseModalData.rank1Score + 10} Puan</span>
                                  </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-neutral-300 shadow-sm">
                            <span className="text-2xl">🥈</span>
                            <div>
                                <p className="font-black text-neutral-500 text-lg leading-none mb-1">2. Sıra <span className="text-sm text-neutral-400">({monthCloseModalData.rank2Score > 0 ? monthCloseModalData.rank2Score : 0} Puan)</span></p>
                                <p className="text-sm font-bold text-neutral-800">
                                    {monthCloseModalData.winners.rank2.length > 0 ? monthCloseModalData.winners.rank2.map(w => w.name).join(', ') : 'Kimse Yok'}
                                </p>
                                {monthCloseModalData.winners.rank2.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-white bg-neutral-500 px-2 py-0.5 rounded-full">+5 Puan Eklenecek</span>
                                    <span className="text-[10px] font-black text-neutral-700 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-full">Net: {monthCloseModalData.rank2Score + 5} Puan</span>
                                  </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-orange-300 shadow-sm">
                            <span className="text-2xl">🥉</span>
                            <div>
                                <p className="font-black text-orange-600 text-lg leading-none mb-1">3. Sıra <span className="text-sm text-neutral-500">({monthCloseModalData.rank3Score > 0 ? monthCloseModalData.rank3Score : 0} Puan)</span></p>
                                <p className="text-sm font-bold text-neutral-800">
                                    {monthCloseModalData.winners.rank3.length > 0 ? monthCloseModalData.winners.rank3.map(w => w.name).join(', ') : 'Kimse Yok'}
                                </p>
                                {monthCloseModalData.winners.rank3.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full">+3 Puan Eklenecek</span>
                                    <span className="text-[10px] font-black text-orange-700 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-full">Net: {monthCloseModalData.rank3Score + 3} Puan</span>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* YENİ: 20 puan ve üzeri yorum alan HERKESİN tam sıralaması (bonus dahil net puanla) */}
                    <div className="mt-4 pt-4 border-t border-purple-200">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-black text-purple-800 uppercase tracking-wide">📋 20 Puan Üstü Tüm Sıralama</p>
                            {/* YENİ (kullanıcı talebi): Bu sıralamanın tamamını Excel olarak indir */}
                            <button onClick={primSiralamaExcelIndir}
                                disabled={(monthCloseModalData.over20Sorted || []).length === 0}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-black rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                                <Download className="w-3.5 h-3.5" /> Excel İndir
                            </button>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                            {(monthCloseModalData.over20Sorted || []).length > 0 ? monthCloseModalData.over20Sorted.map((p, idx) => (
                                <div key={p.id} className="flex items-center gap-2 bg-white rounded-lg border border-purple-100 px-3 py-2">
                                    <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-neutral-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-purple-100 text-purple-700'}`}>{idx + 1}</span>
                                    <span className="flex-1 font-bold text-sm text-neutral-800 truncate">{p.name}</span>
                                    {/* Raw puan + kazanılan bonus + net puan ayrı gösterilir */}
                                    <span className="text-[10px] font-medium text-neutral-400">{p.rawScore} puan</span>
                                    {p.bonusScore > 0 && <span className="text-[10px] font-black text-green-600">+{p.bonusScore}</span>}
                                    <span className="text-xs font-black text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 w-max">Net: {p.finalScore}</span>
                                </div>
                            )) : (
                                <p className="text-sm font-medium text-neutral-500 text-center py-3">20 puan ve üzeri personel bulunmuyor.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Kısım: Prim Hesaplama Formülü */}
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                    <h4 className="font-black text-blue-900 text-lg mb-4 flex items-center gap-2 border-b border-blue-200 pb-2">💰 Prime Dönüşüm Hesaplaması</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-blue-200 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-neutral-500 mb-1">Toplam Yorum</p>
                            <p className="text-xl font-black text-blue-600">{monthCloseModalData.yorumSayisi}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-blue-200 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-neutral-500 mb-1">&ge;20 Puan Alan</p>
                            <p className="text-xl font-black text-blue-600">{monthCloseModalData.over20.length} Kişi</p>
                        </div>
                        {/* YENİ: Prim kuralı — her net puan 0.5 ile çarpılır */}
                        <div className="bg-blue-600 p-3 rounded-xl border border-blue-700 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-blue-200 mb-1">Puan Çarpanı</p>
                            <p className="text-xl font-black text-white">× 0.5</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-white p-3 rounded-xl border border-blue-200">
                        <p className="text-xs font-bold text-blue-800 mb-2">Gelecek Ay Primine Yansıyacak Tutarlar (Net Puan × 0.5):</p>
                        {monthCloseModalData.over20.length > 0 ? (monthCloseModalData.over20Sorted || monthCloseModalData.over20).map(p => (
                            <div key={p.id} className="flex justify-between items-center border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                                <span className="font-bold text-sm text-neutral-800">{p.name} <span className="text-[10px] text-neutral-400">({p.finalScore} Net Puan × 0.5)</span></span>
                                <span className="font-black text-green-600">{monthCloseModalData.nextMonthPrims[p.id]?.toLocaleString('tr-TR', {maximumFractionDigits: 1})} Prim</span>
                            </div>
                        )) : (
                            <p className="text-sm font-medium text-neutral-500 text-center py-4">Bu ay 20 puan ve üzerini geçen personel bulunmuyor.</p>
                        )}
                    </div>
                </div>

                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs font-medium text-red-800 flex gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>Onayladıktan sonra bu ayın puanları kapatılacak ve listedeki prim tutarları gelecek ayın {collarType} Maaş Tablosu'ndaki "PRİM" alanlarına otomatik olarak eklenecektir.</p>
                </div>

              </div>

              <div className="p-5 border-t border-neutral-200 flex gap-3 shrink-0">
                <button onClick={() => setShowMonthCloseModal(false)} className="flex-1 py-4 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={confirmCloseMonth} className="flex-1 py-4 bg-purple-600 text-white font-black rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-600/30">Ayı Kapat ve Onayla</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export const MesaiView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [mesaiData, setMesaiData] = useState({});
    const [prevMonthData, setPrevMonthData] = useState({}); // YENİ EKLENDİ
    const [isSaving, setIsSaving] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    // YENİ (kullanıcı talebi): İş onaylama tahtasından mesai işlendiğinde bu
    // tablo açıkken de görülebilsin diye elle YENİLE sayacı. Sayaç artınca
    // aşağıdaki okuma effect'i yeniden çalışır ve güncel mesai gelir.
    const [mesaiYenile, setMesaiYenile] = useState(0);
    const currentDayRef = React.useRef(null);

    const docPrefix = collarType === 'Mavi Yaka' ? '' : 'beyaz_';

    const months = [
      { val: 1, label: 'Ocak' }, { val: 2, label: 'Şubat' }, { val: 3, label: 'Mart' },
      { val: 4, label: 'Nisan' }, { val: 5, label: 'Mayıs' }, { val: 6, label: 'Haziran' },
      { val: 7, label: 'Temmuz' }, { val: 8, label: 'Ağustos' }, { val: 9, label: 'Eylül' },
      { val: 10, label: 'Ekim' }, { val: 11, label: 'Kasım' }, { val: 12, label: 'Aralık' }
    ];
    const years = Array.from({ length: 10 }, (_, i) => 2024 + i);

    const targetPersonnelList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (!isPersonnelVisibleInMonth(p, currentYear, currentMonth)) return false;
      return collarType === 'Mavi Yaka' 
        ? (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
        : (p.collarType === 'Beyaz Yaka' || (!p.collarType && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
    }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'));

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getDayName = (day) => {
      const date = new Date(currentYear, currentMonth - 1, day);
      const dayNames = ["PAZ", "PZT", "SALI", "ÇAR", "PER", "CUM", "CMT"];
      return dayNames[date.getDay()];
    };

    const isWeekend = (day) => {
      const date = new Date(currentYear, currentMonth - 1, day);
      return date.getDay() === 0; // Pazar günleri
    };

    const getWeekNumber = (day) => {
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
      const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
      return Math.floor((day + adjustedFirstDay - 1) / 7);
    };

    useEffect(() => {
      if (currentDayRef.current) {
        setTimeout(() => {
          currentDayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 300);
      }
    }, [currentMonth, currentYear, targetPersonnelList.length]);

    useEffect(() => {
      const fetchMesai = async () => {
        setIsDataLoaded(false);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${currentYear}_${currentMonth}`);
          const snap = await getDoc(docRef);
          let fetchedRecords = snap.exists() ? snap.data().records || {} : {};

          // Önceki Ayın Verisini Çek (Pazar hesaplaması için)
          let pMonth = currentMonth - 1;
          let pYear = currentYear;
          if (pMonth === 0) { pMonth = 12; pYear -= 1; }
          const prevDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${pYear}_${pMonth}`);
          const prevSnap = await getDoc(prevDocRef);
          if (prevSnap.exists()) {
             setPrevMonthData(prevSnap.data().records || {});
          } else {
             setPrevMonthData({});
          }

          // BEYAZ YAKA İÇİN OTOMATİK MESAİ DOLDURMA
          if (collarType === 'Beyaz Yaka') {
            const beyazYakaList = personnelList.filter(p => {
              if (p.position === 'Firma Sahibi') return false;
              return p.collarType === 'Beyaz Yaka' || (!p.collarType && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position));
            });

            // ================================================================
            // BEYAZ YAKA OTOMATİK DOLDURMA
            // DÜZELTME: Eskiden ayın TÜM günleri (1–31) baştan "G" (Geldi) olarak
            // işaretleniyordu — henüz YAŞANMAMIŞ günler bile. Bu yüzden ayın
            // başında tablo tamamen "Geldi" görünüyor, gerçeği yansıtmıyordu.
            // Artık yalnızca BUGÜNE KADARKİ (bugün dahil) günler doldurulur;
            // gelecek günler BOŞ bırakılır ve gün geldikçe otomatik "G" olur.
            // Pazar günleri (yaşanmış olsun ya da olmasın) haftalık izin olduğu
            // için "Hİ" olarak işaretlenir — takvim planı baştan görünsün.
            // NOT: Elle girilmiş hiçbir değer EZİLMEZ (yalnızca boş hücreler
            // doldurulur); mevcut davranış aynen korunmuştur.
            // ================================================================
            const busun = new Date(); busun.setHours(0, 0, 0, 0);

            beyazYakaList.forEach(person => {
              if (!fetchedRecords[person.id]) fetchedRecords[person.id] = {};
              for (let d = 1; d <= daysInMonth; d++) {
                const existingValObj = fetchedRecords[person.id][d];
                const existingStatus = typeof existingValObj === 'object' && existingValObj !== null ? existingValObj.status : existingValObj;

                // Eğer o güne ait bir mesai girişi yapılmamışsa (boşsa) otomatik doldur
                if (!existingStatus) {
                  const dateObj = new Date(currentYear, currentMonth - 1, d);
                  dateObj.setHours(0, 0, 0, 0);
                  const isSunday = dateObj.getDay() === 0; // 0 = Pazar

                  if (isSunday) {
                    // Pazar = haftalık izin. Gelecekteki pazarlar da işaretlenir ki
                    // izin günleri takvimde baştan planlı görünsün.
                    fetchedRecords[person.id][d] = { status: 'Hİ', hours: '', auto: true };
                  } else if (dateObj <= busun) {
                    // Yalnızca BUGÜN ve GEÇMİŞ günler "Geldi" sayılır.
                    // auto:true -> bu hücrenin ELLE değil OTOMATİK dolduğunu belirtir.
                    fetchedRecords[person.id][d] = { status: 'G', hours: '', auto: true };
                  }
                  // else: GELECEK günler boş bırakılır — o gün geldiğinde dolar.
                }
              }

              // ================================================================
              // DÜZELTME (GERİYE DÖNÜK TEMİZLİK):
              // Uygulamanın ESKİ sürümü ayın tüm günlerini (gelecek günler dahil)
              // "G" olarak Firebase'e KAYDETMİŞTİ. Yukarıdaki doldurma mantığı
              // yalnızca BOŞ hücrelere dokunduğu için, o eski kayıtlar ekranda
              // kalıyor ve tablo hâlâ ileri tarihleri "Geldi" gösteriyordu.
              // Bu döngü, GELECEK günlerdeki otomatik "G" işaretlerini temizler.
              // ELLE girilmiş değerler (manual:true) ve planlı izinler (Hİ, Yİ,
              // Bİ, Üİ, R, D vb.) KORUNUR; sadece anlamsız olan ileri tarihli
              // "Geldi" kaydı silinir. Temizlenen veri otomatik kaydetme ile
              // Firebase'e de yazılır, böylece sorun kalıcı olarak çözülür.
              // ================================================================
              for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(currentYear, currentMonth - 1, d);
                dateObj.setHours(0, 0, 0, 0);
                if (dateObj <= busun) continue; // Bugün ve geçmiş günlere dokunulmaz

                const valObj = fetchedRecords[person.id][d];
                if (!valObj) continue;
                const status = typeof valObj === 'object' && valObj !== null ? valObj.status : valObj;
                const elleGirilmis = typeof valObj === 'object' && valObj !== null && valObj.manual === true;

                // Gelecek bir gün "Geldi" olarak duruyorsa ve elle girilmediyse temizle
                if (status === 'G' && !elleGirilmis) {
                  delete fetchedRecords[person.id][d];
                }
              }
            });
          }

          setMesaiData(fetchedRecords);
        } catch (e) {
          console.error("Mesai yüklenirken hata:", e);
        } finally {
          setIsDataLoaded(true);
        }
      };
      fetchMesai();
    }, [currentMonth, currentYear, db, appId, docPrefix, collarType, personnelList, daysInMonth, mesaiYenile]);

    // ========================================================================
    // KRİTİK DÜZELTME (kullanıcı talebi — "iş onayındaki mesai tabloya
    // aktarılmıyor"):
    // ========================================================================
    // SORUNUN KÖKÜ: Aşağıdaki otomatik kaydetme, tablo AÇILDIĞI ANDA da
    // çalışıyordu. Okunan veri 1 saniye sonra olduğu gibi geri yazılıyor ve
    // `records` alanı TÜMÜYLE değiştiriliyordu (merge:true yalnızca üst seviye
    // alanları birleştirir, records'un içini değil). Sonuç: Finans > Personel
    // Muhasebe > Mesai ekranı açıkken (veya sekmede açık bırakılmışken)
    // operasyon sorumlusu iş onayı yaptığında, bu ekranın elindeki ESKİ veri
    // onayın üstüne yazılıp yeni mesaiyi SİLİYORDU. "Aktarım olmuyor"
    // şikâyetinin sebebi buydu.
    // ÇÖZÜM: Kaydetme yalnızca kullanıcı tabloda GERÇEKTEN bir hücre
    // değiştirdiğinde yapılır (degisiklikVar bayrağı). İlk yükleme ya da
    // dışarıdan gelen tazeleme artık hiçbir şeyi geri yazmaz.
    const [degisiklikVar, setDegisiklikVar] = useState(false);

    useEffect(() => {
      if (!isDataLoaded) return;
      if (!degisiklikVar) return; // Kullanıcı değişikliği yoksa YAZMA
      const timeoutId = setTimeout(async () => {
        setIsSaving(true);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${currentYear}_${currentMonth}`);
          await setDoc(docRef, { records: mesaiData, updatedAt: new Date().toISOString() }, { merge: true });
          setDegisiklikVar(false);
        } catch (e) {
          console.error("Otomatik kaydetme hatası:", e);
        }
        setTimeout(() => setIsSaving(false), 800);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }, [mesaiData, docPrefix, degisiklikVar]);

    // OTOMATİK PAZAR GÜNÜ MESAİ KONTROLÜ (7 GÜN KURALI)
    useEffect(() => {
      if (!isDataLoaded) return; // Mavi Yaka kısıtlaması kaldırılarak tüm personellere (Beyaz Yaka dahil) uygulandı

      let hasChanges = false;
      const newData = JSON.parse(JSON.stringify(mesaiData));
      const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

      targetPersonnelList.forEach(person => {
          const pId = person.id;
          if (!newData[pId]) return;

          for (let d = 1; d <= daysInMonth; d++) {
             const dateObj = new Date(currentYear, currentMonth - 1, d);
             if (dateObj.getDay() === 0) { // Sadece Pazar günlerini kontrol et
                const sundayValObj = newData[pId][d];
                const sundayStatus = typeof sundayValObj === 'object' && sundayValObj !== null ? sundayValObj.status : sundayValObj;
                
                // Eğer pazar günü çalışılmışsa kontrol yap
                if (sundayStatus && ['G', 'FM', 'EM', 'FGM', 'FG'].includes(sundayStatus)) {
                   let workedDays = 0;
                   let hasLeave = false;
                   
                   // Pazartesiden Pazara (d-6'dan d'ye) 7 günlük periyodu tara
                   for (let i = d - 6; i <= d; i++) {
                      let cellStatus = '';
                      if (i > 0) {
                         const cell = newData[pId][i];
                         cellStatus = typeof cell === 'object' && cell !== null ? cell.status : cell;
                      } else {
                         // Ayın ilk günlerine denk geliyorsa önceki aydan veri al
                         const prevDay = daysInPrevMonth + i;
                         const cell = prevMonthData[pId]?.[prevDay];
                         cellStatus = typeof cell === 'object' && cell !== null ? cell.status : cell;
                      }
                      
                      if (['Hİ', 'D', 'R', 'Üİ', 'Yİ', 'Bİ'].includes(cellStatus)) {
                         hasLeave = true;
                      }
                      if (['G', 'FM', 'EM', 'FGM', 'FG'].includes(cellStatus)) {
                         workedDays++;
                      }
                   }

                   // Eğer hiç izin kullanmamış ve 7 gün tam gelmişse -> FGM
                   if (workedDays === 7 && !hasLeave) {
                       if (sundayStatus !== 'FGM' && sundayStatus !== 'FG') { 
                           newData[pId][d] = { ...(typeof sundayValObj === 'object' ? sundayValObj : {}), status: 'FGM' };
                           hasChanges = true;
                       }
                   } 
                   // Eğer hafta içi izin kullanmışsa, Pazar günü normal mesai(G) sayılır
                   else if (hasLeave) {
                       if (sundayStatus === 'FGM' || sundayStatus === 'FG') { 
                           newData[pId][d] = { ...(typeof sundayValObj === 'object' ? sundayValObj : {}), status: 'G' };
                           hasChanges = true;
                       }
                   }
                }
             }
          }
      });

      if (hasChanges) {
          // Otomatik Pazar/FGM düzeltmesi bir SİSTEM kararıdır; kaydedilmesi
          // gerekir. Bu yüzden değişiklik bayrağı burada da açılır.
          setDegisiklikVar(true);
          setMesaiData(newData);
      }
    }, [mesaiData, isDataLoaded, collarType, currentMonth, currentYear, daysInMonth, prevMonthData, targetPersonnelList]);

    const handleCellChange = (personId, day, value) => {
      setDegisiklikVar(true); // Kullanıcı düzenledi -> kaydetme serbest
      setMesaiData(prev => ({
        ...prev,
        [personId]: {
          ...(prev[personId] || {}),
          // manual:true -> bu hücre ELLE girildi; ileri tarihli otomatik temizlik bunu silmez
          [day]: { status: value, hours: '', manual: true } // Sadece status değiştirirken saati sıfırla
        }
      }));
    };

    const handleHoursChange = (personId, day, hours) => {
        setDegisiklikVar(true); // Kullanıcı düzenledi -> kaydetme serbest
        setMesaiData(prev => ({
            ...prev,
            [personId]: {
                ...(prev[personId] || {}),
                [day]: { ...(prev[personId]?.[day] || { status: '' }), hours: hours }
            }
        }));
    };

    const getStatusCounts = (personId) => {
      const record = mesaiData[personId] || {};
      const counts = { G: 0, FG: 0, D: 0, I: 0, FM_H: 0, EM_H: 0 }; // I: Toplam İzin, FM_H: Fazla Mesai Saati, EM_H: Eksik Mesai Saati
      
      Object.values(record).forEach(val => {
        if (typeof val === 'object' && val !== null) {
            if (val.status && val.status.startsWith('G')) counts.G++;
            else if (val.status === 'FG') counts.FG++;
            else if (val.status === 'D') counts.D++;
            else if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ', 'İB'].includes(val.status)) counts.I++;
            else if (val.status === 'FM') { counts.G++; counts.FM_H += saatMetniSayiyaCevir(val.hours); }
            else if (val.status === 'EM') { counts.G++; counts.EM_H += saatMetniSayiyaCevir(val.hours); }
            else if (val.status === 'FGM') { counts.FG++; counts.FM_H += saatMetniSayiyaCevir(val.hours); }
        } else {
             // Eski veri yapısı uyumluluğu
            if (val && val.startsWith('G')) counts.G++;
            else if (val === 'FG') counts.FG++;
            else if (val === 'D') counts.D++;
            else if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ', 'İB'].includes(val)) counts.I++;
            else if (val === 'FGM') counts.FG++;
        }
      });
      return counts;
    };

    const getCellColor = (val) => {
      const statusCode = typeof val === 'object' && val !== null ? val.status : val;
      const option = MESAI_STATUS_OPTIONS.find(o => o.code === statusCode);
      return option ? option.color : 'bg-transparent text-black';
    };

    const handleDownloadPDF = () => {
        const printWindow = window.open('', '_blank');
        
        let tableRows = targetPersonnelList.map(person => {
          const counts = getStatusCounts(person.id);
          let daysHtml = days.map(d => {
            const valObj = mesaiData[person.id] && mesaiData[person.id][d];
            const val = typeof valObj === 'object' && valObj !== null ? valObj.status : valObj || '';
            const hours = typeof valObj === 'object' && valObj !== null && valObj.hours ? ` (${valObj.hours}s)` : '';
            
            let bgColor = '#ffffff';
            let color = '#000000';
            
            if(val && val.startsWith('G')) { bgColor = '#dcfce7'; color = '#15803d'; }
            else if(val === 'FG') { bgColor = '#ccfbf1'; color = '#0f766e'; }
            else if(val === 'FGM') { bgColor = '#cffafe'; color = '#155e75'; }
            else if(val === 'FM') { bgColor = '#dbeafe'; color = '#1d4ed8'; }
            else if(val === 'EM') { bgColor = '#fef08a'; color = '#a16207'; }
            else if(val === 'D') { bgColor = '#fee2e2'; color = '#b91c1c'; }
            else if(val === 'R') { bgColor = '#ffedd5'; color = '#c2410c'; }
            else if(val === 'Hİ') { bgColor = '#dbeafe'; color = '#1d4ed8'; }
            else if(val === 'Yİ') { bgColor = '#f3e8ff'; color = '#7e22ce'; }
            else if(val === 'Bİ') { bgColor = '#fce7f3'; color = '#be185d'; }
            else if(val === 'Üİ') { bgColor = '#e5e5e5'; color = '#404040'; }

            return `<td style="border: 1px solid #000; text-align: center; padding: 2px; height: 20px; font-weight: bold; background-color: ${bgColor}; color: ${color}; font-size: 9px;">${val}${hours}</td>`;
          }).join('');
          
          return `
            <tr>
              <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold; white-space: nowrap; font-size: 11px;">${person.fullName.toUpperCase()}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #dcfce7;">${counts.G}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #ccfbf1;">${counts.FG}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #fee2e2;">${counts.D}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #dbeafe;">${counts.I}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #bfdbfe;">${counts.FM_H}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 10px; background-color: #fef08a;">${counts.EM_H}</td>
              ${daysHtml}
            </tr>
          `;
        }).join('');
  
        let daysHeaderHtml = days.map(d => {
            const isWknd = isWeekend(d);
            const bg = isWknd ? '#ef4444' : '#8bb4e7';
            const color = isWknd ? 'white' : 'black';
            return `<th style="border: 1px solid #000; padding: 2px; min-width: 20px; background-color: ${bg}; color: ${color}; font-size: 9px;">${String(d).padStart(2, '0')}.${String(currentMonth).padStart(2, '0')}<br/>${getDayName(d)}</th>`;
        }).join('');
  
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${collarType.replace(' ', '_')}_Mesai_${months.find(m => m.val === currentMonth)?.label}_${currentYear}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 2px; overflow: hidden; text-overflow: ellipsis; }
            .header-title { background-color: #f97316; color: black; font-weight: bold; font-size: 16px; text-align: center; padding: 8px; border: 2px solid #000; }
            .bg-black { background-color: #000; color: #fff; }
            .bg-gray { background-color: #e5e7eb; color: #000; }
            .legend { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; font-size: 9px; font-weight: bold; justify-content: center; }
            .legend-item { padding: 2px 6px; border: 1px solid #000; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div className="legend">
            <span class="legend-item" style="background: #dcfce7; color: #15803d;">G: Geldi</span>
            <span class="legend-item" style="background: #ccfbf1; color: #0f766e;">FG: Fazla Gün</span>
            <span class="legend-item" style="background: #cffafe; color: #155e75;">FGM: F.Gün+Mesai</span>
            <span class="legend-item" style="background: #dbeafe; color: #1d4ed8;">FM: Fazla Mesai</span>
            <span class="legend-item" style="background: #fef08a; color: #a16207;">EM: Eksik Mesai</span>
            <span class="legend-item" style="background: #fee2e2; color: #b91c1c;">D: Devamsız</span>
            <span class="legend-item" style="background: #ffedd5; color: #c2410c;">R: Raporlu</span>
            <span class="legend-item" style="background: #dbeafe; color: #1d4ed8;">Hİ: Haftalık İzin</span>
            <span class="legend-item" style="background: #f3e8ff; color: #7e22ce;">Yİ: Yıllık İzin</span>
            <span class="legend-item" style="background: #fce7f3; color: #be185d;">Bİ: Bayram İzni</span>
            <span class="legend-item" style="background: #e5e5e5; color: #404040;">Üİ: Ücretsiz İzin</span>
          </div>
          <table>
            <thead>
              <tr>
                <th colspan="${daysInMonth + 7}" class="header-title">${months.find(m => m.val === currentMonth)?.label.toUpperCase()} ${currentYear} ${collarType.toUpperCase()} MESAİ LİSTESİ</th>
              </tr>
              <tr>
                <th rowspan="2" class="bg-gray" style="text-align: left; padding: 4px 8px; width: 150px; vertical-align: middle;">AD SOYAD</th>
                <th colspan="6" class="bg-gray" style="text-align: center; font-size: 10px; padding: 4px;">AYLIK ÖZET</th>
                <th colspan="${daysInMonth}" class="bg-black" style="text-align: center; letter-spacing: 2px; padding: 4px;">GÜNLÜK TAKİP</th>
              </tr>
              <tr>
                <th style="width: 25px; font-size: 9px; background: #dcfce7; color: #15803d;">G</th>
                <th style="width: 25px; font-size: 9px; background: #ccfbf1; color: #0f766e;">FG</th>
                <th style="width: 25px; font-size: 9px; background: #fee2e2; color: #b91c1c;">D</th>
                <th style="width: 25px; font-size: 9px; background: #dbeafe; color: #1d4ed8;">İZN</th>
                <th style="width: 30px; font-size: 9px; background: #bfdbfe; color: #1e3a8a;">FM(s)</th>
                <th style="width: 30px; font-size: 9px; background: #fef08a; color: #713f12;">EM(s)</th>
                ${daysHeaderHtml}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
        </html>
        `;
  
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 md:p-6 animate-in fade-in flex flex-col min-h-[1060px] h-[calc(100vh-190px)] relative w-full overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 shrink-0 gap-4 w-full">
          <h2 className="text-lg md:text-xl font-bold text-black flex items-center gap-2">
            <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /> {collarType} Mesai Takibi
          </h2>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select value={currentMonth} onChange={e => setCurrentMonth(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-blue-600 cursor-pointer flex-1 md:flex-none text-sm">
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            <select value={currentYear} onChange={e => setCurrentYear(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-blue-600 cursor-pointer flex-1 md:flex-none text-sm">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleDownloadPDF} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-md text-sm mt-1 md:mt-0 order-last md:order-none">
              <Download className="w-4 h-4" /> 
              Tabloyu İndir
            </button>
            <div className="flex items-center w-full md:w-28 justify-center md:justify-end mt-1 md:mt-0">
              {isSaving ? (
                <span className="text-xs font-bold text-neutral-400 flex items-center gap-1 animate-pulse"><Loader2 className="w-3 h-3 animate-spin"/> Kaydediliyor...</span>
              ) : isDataLoaded ? (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Kaydedildi</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4 shrink-0 justify-center">
            {MESAI_STATUS_OPTIONS.map(opt => (
                <div key={opt.code} className={`text-[10px] font-bold px-2 py-1 rounded border border-black/10 flex items-center gap-1 ${opt.color.split(' ')[0]} ${opt.color.split(' ')[1]}`}>
                    <span>{opt.code}</span> - <span>{opt.label}</span>
                </div>
            ))}
        </div>

        <div className="flex-1 w-full overflow-auto overflow-x-auto border border-neutral-300 custom-scrollbar-table rounded-xl bg-white shadow-inner relative">
          <table className="w-full border-collapse text-xs md:text-sm min-w-max">
            <thead className="sticky top-0 z-30 shadow-md">
              <tr>
                <th colSpan={daysInMonth + 7} className="bg-blue-600 text-white font-black py-2 border-b-2 border-neutral-400 text-sm md:text-lg tracking-wider">
                  <span className="inline-flex items-center gap-3">
                    {months.find(m => m.val === currentMonth)?.label.toUpperCase()} {currentYear} {collarType.toUpperCase()} MESAİ LİSTESİ
                    {/* YENİ (kullanıcı talebi): İş onaylama tahtasında mesai
                        onaylandıysa, bu tablo açıkken de güncel veriyi çekmek
                        için elle yenileme düğmesi. */}
                    <button type="button" onClick={() => setMesaiYenile(x => x + 1)}
                      title="İş onaylarından gelen mesaileri yeniden yükle"
                      className="text-[10px] font-black bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition normal-case tracking-normal">
                      Yenile
                    </button>
                  </span>
                </th>
              </tr>
              <tr>
                <th rowSpan="2" className="bg-neutral-200 text-black font-black p-1 md:p-2 border-b border-r border-neutral-400 sticky left-0 z-30 w-24 min-w-[90px] md:w-64 md:min-w-[220px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm align-bottom pb-2">AD SOYAD</th>
                <th colSpan="6" className="bg-neutral-100 border-b border-r border-neutral-400 text-center text-[10px] md:text-xs font-black text-black p-1">
                  AYLIK ÖZET
                </th>
                <th colSpan={daysInMonth} className="bg-black text-white font-bold p-1 border-b border-neutral-400 text-[9px] md:text-xs tracking-widest text-center">
                  GÜNLÜK TAKİP
                </th>
              </tr>
              <tr>
                <th className="bg-green-100 text-green-700 font-black p-1 border-b border-r border-neutral-400 w-8 min-w-[32px] md:w-10 text-[9px] md:text-[11px]" title="Geldiği Günler">G</th>
                <th className="bg-teal-100 text-teal-700 font-black p-1 border-b border-r border-neutral-400 w-8 min-w-[32px] md:w-10 text-[9px] md:text-[11px]" title="Fazla Günler">FG</th>
                <th className="bg-red-100 text-red-700 font-black p-1 border-b border-r border-neutral-400 w-8 min-w-[32px] md:w-10 text-[9px] md:text-[11px]" title="Devamsızlık">D</th>
                <th className="bg-blue-100 text-blue-700 font-black p-1 border-b border-r border-neutral-400 w-8 min-w-[32px] md:w-10 text-[9px] md:text-[11px]" title="Toplam İzin">İZN</th>
                <th className="bg-blue-200 text-blue-800 font-black p-1 border-b border-r border-neutral-400 w-10 min-w-[40px] md:w-12 text-[8px] md:text-[10px]" title="Toplam Fazla Mesai Saati">FM(s)</th>
                <th className="bg-yellow-200 text-yellow-800 font-black p-1 border-b border-r border-neutral-400 w-10 min-w-[40px] md:w-12 text-[8px] md:text-[10px]" title="Toplam Eksik Mesai Saati">EM(s)</th>
                {days.map(d => {
                  const isToday = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1 && d === today.getDate();
                  const isWknd = isWeekend(d);
                  const weekNum = getWeekNumber(d);
                  const isEvenWeek = weekNum % 2 === 0;
                  const headerBg = isToday ? 'bg-blue-500 text-white shadow-md z-10 relative ring-2 ring-blue-500 ring-inset' : isWknd ? 'bg-red-500 text-white' : (isEvenWeek ? 'bg-[#8bb4e7]' : 'bg-[#a3c6f2]');
                  const weekSeparatorClass = isWknd ? 'border-r-[3px] border-r-neutral-800' : 'border-r border-neutral-400';

                  return (
                    <th key={d} ref={isToday ? currentDayRef : null} className={`text-black font-bold p-1 border-b ${weekSeparatorClass} w-12 min-w-[48px] max-w-[48px] md:w-16 md:min-w-[64px] md:max-w-[64px] ${headerBg}`}>
                      <div className="text-[9px] md:text-[11px] tracking-tight">{String(d).padStart(2, '0')}.{String(currentMonth).padStart(2, '0')}</div>
                      <div className={`text-[8px] md:text-[10px] uppercase mt-0.5 font-black ${isWknd || isToday ? 'text-white' : 'text-black/80'}`}>{getDayName(d)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {targetPersonnelList.map((person, index) => {
                const counts = getStatusCounts(person.id);
                return (
                  <tr key={person.id} className="hover:bg-neutral-50 transition border-b border-neutral-300 group">
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-neutral-50 border-r border-neutral-400 p-1 md:p-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-24 min-w-[90px] md:w-64 md:min-w-[220px]">
                      <div className="flex items-center gap-1.5 md:gap-2.5">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 border border-neutral-300 text-[8px] md:text-sm">
                          {person.profileImage ? (
                            <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                          ) : (
                            person.fullName.charAt(0)
                          )}
                        </div>
                        <span className="font-bold text-neutral-800 text-[9px] md:text-xs truncate max-w-[50px] md:max-w-[160px] leading-tight">{person.fullName.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="bg-green-50 text-green-700 font-black text-center border-r border-neutral-400 text-[10px] md:text-xs">{counts.G}</td>
                    <td className="bg-teal-50 text-teal-700 font-black text-center border-r border-neutral-400 text-[10px] md:text-xs">{counts.FG}</td>
                    <td className="bg-red-50 text-red-700 font-black text-center border-r border-neutral-400 text-[10px] md:text-xs">{counts.D}</td>
                    <td className="bg-blue-50 text-blue-700 font-black text-center border-r border-neutral-400 text-[10px] md:text-xs">{counts.I}</td>
                    <td className="bg-blue-100/50 text-blue-800 font-black text-center border-r border-neutral-400 text-[10px] md:text-xs">{counts.FM_H}</td>
                    <td className="bg-yellow-100/50 text-yellow-800 font-black text-center border-r border-neutral-400 text-[10px] md:text-xs">{counts.EM_H}</td>
                    {days.map(d => {
                      const isToday = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1 && d === today.getDate();
                      const valObj = mesaiData[person.id] && mesaiData[person.id][d];
                      const val = typeof valObj === 'object' && valObj !== null ? valObj.status : valObj || '';
                      const hours = typeof valObj === 'object' && valObj !== null ? valObj.hours : '';
                      const cellColor = getCellColor(val);
                      const isWknd = isWeekend(d);
                      const weekSeparatorClass = isWknd ? 'border-r-[3px] border-r-neutral-800' : 'border-r border-neutral-300';

                      // YENİ: Personelin işe başlangıç tarihinden ÖNCEKİ günler için "İŞE GİRİŞ" kutucuğu.
                      // Bu günler düzenlenemez; personelin henüz işe başlamadığını belirtir.
                      const _startD = person.startDate ? new Date(person.startDate + 'T00:00:00') : null;
                      const _cellD = new Date(currentYear, currentMonth - 1, d);
                      const isBeforeStart = _startD && !isNaN(_startD.getTime()) && _cellD < new Date(_startD.getFullYear(), _startD.getMonth(), _startD.getDate());

                      if (isBeforeStart) {
                        return (
                          <td key={d} className={`${weekSeparatorClass} p-0 text-center relative w-12 min-w-[48px] max-w-[48px] md:w-16 md:min-w-[64px] md:max-w-[64px]`}>
                            <div className="flex flex-col items-center justify-center h-7 md:h-11 bg-emerald-50 text-emerald-600 leading-none gap-0.5" title={`İşe Başlangıç: ${person.startDate} — bu tarihten önce personel işte değildi`}>
                              <UserPlus className="w-3 h-3 md:w-3.5 md:h-3.5" />
                              <span className="text-[6px] md:text-[8px] font-black tracking-tight">İŞE GİRİŞ</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={d} className={`${weekSeparatorClass} p-0 text-center relative w-12 min-w-[48px] max-w-[48px] md:w-16 md:min-w-[64px] md:max-w-[64px] ${isToday ? 'ring-1 ring-inset ring-blue-300' : isWknd && !val ? 'bg-red-50/20' : ''}`}>
                          <div className="flex flex-col h-full">
                              <select
                                value={val}
                                onChange={(e) => handleCellChange(person.id, d, e.target.value)}
                                className={`w-full ${val === 'FM' || val === 'EM' || val === 'FGM' ? 'h-5 md:h-6 text-[8px] md:text-[10px]' : 'h-7 md:h-11 text-[9px] md:text-xs'} text-center font-bold outline-none transition-colors appearance-none cursor-pointer ${cellColor} ${!val && isToday ? 'bg-blue-50/50' : ''}`}
                                title={MESAI_STATUS_OPTIONS.find(o => o.code === val)?.label || 'Durum Seç'}
                              >
                                <option value="" className="text-black bg-white"></option>
                                {MESAI_STATUS_OPTIONS.map(opt => (
                                    <option key={opt.code} value={opt.code} className="text-black bg-white">{opt.code}</option>
                                ))}
                              </select>
                              {(val === 'FM' || val === 'EM' || val === 'FGM') && (
                                <input
                                  type="number"
                                  placeholder="Saat"
                                  /* HATA DÜZELTMESİ: "hours" Firestore'da VİRGÜLLÜ saklanıyor (örn. "4,5").
                                     <input type="number"> virgüllü değeri GEÇERSİZ sayıp kutuyu BOŞ
                                     gösteriyordu — onaylanan saat kayıtlı olsa bile ekranda "Saat"
                                     placeholder'ı görünüyordu (Ahmet Öztürk 26.08 örneği). Ekranda NOKTA
                                     ile gösterilir; veri biçimi (virgüllü) değişmez. */
                                  value={String(hours ?? '').replace(',', '.')}
                                  onChange={(e) => handleHoursChange(person.id, d, e.target.value.replace('.', ','))}
                                  className={`w-full h-4 md:h-5 text-center text-[8px] md:text-[10px] font-bold outline-none ${val === 'FM' || val === 'FGM' ? 'bg-blue-50 text-blue-800 placeholder-blue-300' : 'bg-yellow-50 text-yellow-800 placeholder-yellow-300'} border-t border-neutral-200/50`}
                                  style={{ MozAppearance: 'textfield' }}
                                />
                              )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {targetPersonnelList.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth + 7} className="p-4 md:p-8 text-center text-neutral-500 font-medium text-xs md:text-sm">
                    Sistemde {collarType.toLowerCase()} personel kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // YENİ: MAAŞ TABLOSU SÜTUN KATEGORİLERİ
  // Tablo çok genişlediği için sütunlar 4 gruba ayrıldı; üstteki butonlarla seçilen
  // grubun sütunları gösterilir. Hesaplama mantığı ve veriler hiç değişmez.
  // YENİ DÜZEN: Maaş tablosu 4 kategori BLOĞU olarak alt alta, tek sayfada
  // (yatay kaydırma olmadan) gösterilir. Bloklar salt-okunurdur; her bloğun
  // başlığındaki "Düzenle" butonu, o kategoriyi düzenlenebilir bir pencerede açar.
  // cizgi: kategoriler arasındaki KALIN AYIRICI ÇİZGİNİN rengi (kategori rengiyle aynı tonda).
  // Tailwind sınıf adları dinamik üretilemediği için çizgi rengi inline style ile verilir.
  const MAAS_KATEGORILER = [
    { id: 'genel',   label: 'Genel Bilgiler',  renk: 'bg-neutral-800', sayi: 3, cizgi: '#262626' },
    { id: 'izinler', label: 'İzinler Durumu',  renk: 'bg-blue-600',    sayi: 7, cizgi: '#2563eb' },
    { id: 'hakedis', label: 'Hak Ediş Durumu', renk: 'bg-purple-700',  sayi: 6, cizgi: '#6d28d9' },
    { id: 'finans',  label: 'Finans Durumu',   renk: 'bg-green-600',   sayi: 4, cizgi: '#16a34a' },
  ];

  export const MaasView = ({ collarType, personnelList, db, appId, addSystemLog, currentUser }) => {
    // YENİ: Düzenleme penceresi — hangi kategori düzenleniyorsa onun kimliği tutulur
    const [duzenlemeKategori, setDuzenlemeKategori] = useState(null);
    // YENİ: PRİM hücresi artık TL (tutar) gösterir. Girişin hâlâ SAAT olarak
    // yapılabilmesi için, tıklanan hücre bu state ile geçici olarak saat
    // giriş kutusuna dönüşür; odaktan çıkılınca yeniden TL karşılığı gösterilir.
    const [primDuzenlenenId, setPrimDuzenlenenId] = useState(null);

    // ========================================================================
    // YENİ: KATEGORİ TABLOSU ÜRETİCİ
    // Aynı tablo iskeleti hem salt-okunur bloklar hem de düzenleme penceresi
    // için kullanılır. duzenlenebilir=false iken tabloya tıklanamaz (sadece
    // görüntüleme); true iken mevcut giriş alanları normal çalışır ve
    // değişiklikler mevcut otomatik kayıt mekanizmasıyla Firebase'e yazılır.
    // ========================================================================
    // aktifKatlar: kategori kimliği dizisi (örn. ['genel','izinler','hakedis','finans']).
    // Tek dize de verilebilir; tümü aynı tablo iskeletini kullanır.
    const tabloRender = (aktifKatlar, duzenlenebilir) => {
      const katListe = Array.isArray(aktifKatlar) ? aktifKatlar : [aktifKatlar];
      const g = (kat) => katListe.includes(kat);
      const gosterilenKategoriler = MAAS_KATEGORILER.filter(k => g(k.id));
      const aktifSutunSayisi = gosterilenKategoriler.reduce((t, k) => t + k.sayi, 0) + 1;
      return (
        <div className="w-full h-full overflow-auto border border-neutral-300 custom-scrollbar-table rounded-xl bg-white shadow-inner relative">
          {/* table-fixed: tüm veri sütunları BİREBİR AYNI genişlikte kalır (tarayıcı
              içeriğe göre sütun genişletmez). min-w yalnız 4 kategori birlikte
              gösterilirken uygulanır; tek kategorilik düzenleme penceresinde gerekmez. */}
          <table className={`w-full table-fixed border-collapse text-[10px] md:text-[11px] ${katListe.length > 1 ? 'min-w-[1408px]' : ''} ${duzenlenebilir ? '' : 'pointer-events-none select-none'}`}>
            {/* colgroup: table-fixed düzeninde sütun genişlikleri YALNIZCA ilk satırdan
                okunur; ilk satırda birleştirilmiş (colSpan) grup başlıkları olduğu için
                genişlikler burada tek tek sabitlenir. Böylece Personel Bilgisi dışındaki
                TÜM veri sütunları birebir aynı genişlikte kalır. */}
            <colgroup>
              <col className="w-36" />
              {/* Finans Durumu sütunları (Yemek / Yol / Kalan Banka / Kalan Nakit) diğer
                  sütunlardan daha geniştir: 60px -> 76px (%15 ek genişletme yapıldı).
                  Bu sütunlarda tutarın yanında ödeme onay tiki de bulunduğu için
                  rakamların taşmaması adına ek genişlik gerekir. */}
              {gosterilenKategoriler.flatMap(k => Array.from({ length: k.sayi }).map((_, i) => (
                <col key={`${k.id}-${i}`} className={k.id === 'finans' ? 'w-[76px]' : 'w-[60px]'} />
              )))}
            </colgroup>
            <thead className="sticky top-0 z-30 shadow-md">
              {/* YENİ: KATEGORİ GRUP BAŞLIĞI — 4 kategori yan yana, her grubun kendi
                  rengi, kendi "Düzenle" butonu ve kendi renginde KALIN AYIRICI ÇİZGİSİ
                  vardır (salt-okunur tabloda da tıklanır). */}
              <tr>
                <th rowSpan="2" className="bg-blue-100 text-blue-900 font-black px-1.5 py-1 border-b border-r border-neutral-400 sticky left-0 z-30 w-36 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] align-middle">PERSONEL BİLGİSİ</th>
                {gosterilenKategoriler.map(k => (
                  <th key={k.id} colSpan={k.sayi} style={{ borderRight: `3px solid ${k.cizgi}` }} className={`${k.renk} text-white font-black px-1 py-1 border-b border-neutral-500 text-[10px] uppercase tracking-wide`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="truncate">{k.label}</span>
                      {!duzenlenebilir && (
                        <button type="button" onClick={() => setDuzenlemeKategori(k.id)}
                          className="pointer-events-auto shrink-0 px-1.5 py-0.5 bg-white/20 hover:bg-white/40 rounded border border-white/30 flex items-center gap-1 text-[9px] font-black transition"
                          title={`${k.label} sütunlarını düzenle`}>
                          <Edit className="w-2.5 h-2.5" /> Düzenle
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {g('genel') && <th className="bg-neutral-100 text-neutral-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px] text-center">BAŞLAMA</th>}
                {g('genel') && <th className="bg-neutral-100 text-neutral-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">BANKA</th>}
                {g('genel') && <th style={{ borderRight: '3px solid #262626' }} className="bg-neutral-100 text-neutral-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">MAAŞ</th>}
                {g('izinler') && <th className="bg-blue-100 text-blue-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">GÜN. SAAT</th>}
                {g('izinler') && <th className="bg-blue-100 text-blue-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">TOP. SAAT</th>}
                {g('izinler') && <th className="bg-blue-100 text-blue-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">MESAİ GÜN</th>}
                {g('izinler') && <th className="bg-teal-100 text-teal-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">FAZLA GÜN</th>}
                {g('izinler') && <th className="bg-red-100 text-red-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">DEVAMSIZ</th>}
                {g('izinler') && <th className="bg-orange-100 text-orange-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">RAPOR</th>}
                {g('izinler') && <th style={{ borderRight: '3px solid #2563eb' }} className="bg-purple-100 text-purple-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">YIL. İZİN</th>}
                {g('hakedis') && <th className="bg-yellow-100 text-yellow-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">NAKİT AV.</th>}
                {g('hakedis') && <th className="bg-yellow-100 text-yellow-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">RESMİ AV.</th>}
                {/* YENİ: Başlıklar artık her iki sütunun da TUTAR gösterdiğini belirtir.
                    PRİM hücresine giriş yine SAAT olarak yapılır (tıklayınca saat kutusu açılır). */}
                {g('hakedis') && <th className="bg-green-100 text-green-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]" title="Girilen prim saatinin TL karşılığı. Düzenlemek için hücreye tıklayın, saat olarak girin.">PRİM ₺</th>}
                {g('hakedis') && <th className="bg-purple-200 text-purple-900 font-black px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]" title="Prim payı düşülmüş saf mesai ücreti.">MESAİ ÜCR.</th>}
                {g('hakedis') && <th className="bg-red-100 text-red-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">BORÇ</th>}
                {g('hakedis') && <th style={{ borderRight: '3px solid #6d28d9' }} className="bg-red-200 text-red-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[60px]">İCRA</th>}
                {g('finans') && <th className="bg-neutral-100 text-neutral-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[66px]">YEMEK</th>}
                {g('finans') && <th className="bg-neutral-100 text-neutral-900 font-bold px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[66px]">YOL</th>}
                {g('finans') && <th className="bg-yellow-200 text-yellow-900 font-black px-0.5 py-1 border-b border-r border-neutral-400 text-[9px] leading-tight w-[66px]">KAL. BANKA</th>}
                {g('finans') && <th style={{ borderRight: '3px solid #16a34a' }} className="bg-orange-200 text-orange-900 font-black px-0.5 py-1 border-b border-neutral-400 text-[9px] leading-tight w-[66px]">KAL. NAKİT</th>}
              </tr>
            </thead>
            <tbody>
              {targetPersonnelList.map(person => {
                const row = maasData[person.id] || {};
                const c = calcRow(person.id);
                return (
                  <tr key={person.id} className="hover:bg-neutral-50 transition border-b border-neutral-300">
                    <td className="sticky left-0 z-20 bg-white border-r border-neutral-400 px-1.5 py-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 border border-neutral-300 text-[8px] md:text-sm">
                          {person.profileImage ? (
                            <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                          ) : (
                            person.fullName.charAt(0)
                          )}
                        </div>
                        <span className="font-bold text-neutral-800 text-[10px] truncate max-w-[120px]">{person.fullName.toUpperCase()}</span>
                      </div>
                    </td>
                    {g('genel') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-neutral-100 text-center text-xs font-medium text-neutral-600 align-middle">
                      {person.startDate || '-'}
                    </td>
                    )}
                    {g('genel') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-neutral-100 font-bold text-neutral-600 text-center align-middle">
                      {c.hesaplananBanka.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </td>
                    )}
                    {g('genel') && (
                      <td style={{ borderRight: '3px solid #262626' }} className="border-r border-neutral-300 px-0.5 py-0.5 bg-neutral-100">
                      <input type="number" value={row.maas !== undefined ? row.maas : (person.maas || '')} onChange={e => handleCellChange(person.id, 'maas', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-neutral-500 rounded font-bold" placeholder="0" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-blue-50/50">
                      <input type="number" readOnly value={c.gunlukSaat || ''} className="w-full h-6 text-center text-[10px] bg-transparent outline-none rounded font-bold text-blue-600 cursor-not-allowed" placeholder="0" title="Mesai tablosundan otomatik hesaplanır" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-blue-50/50">
                      <input type="number" readOnly value={c.toplamSaat} className="w-full h-6 text-center text-[10px] bg-transparent outline-none rounded font-bold text-blue-600 cursor-not-allowed" placeholder="0" title="Otomatik hesaplanır" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-blue-50/50">
                      <input type="number" readOnly value={c.mesaiGunSayisi} className="w-full h-6 text-center text-[10px] bg-transparent outline-none rounded font-bold cursor-not-allowed" title="Mesai tablosundan otomatik hesaplanır" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-teal-50/50">
                      <input type="number" value={row.fazlaGun !== undefined ? row.fazlaGun : (c.fazlaGunSayisi || '')} onChange={e => handleCellChange(person.id, 'fazlaGun', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-teal-100 focus:ring-1 focus:ring-teal-400 rounded text-teal-700 font-bold" placeholder="0" title="Manuel düzenlenebilir" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-red-50/50">
                      <input type="number" value={row.devamsizlik !== undefined ? row.devamsizlik : (c.devamsizlikSayisi || '')} onChange={e => handleCellChange(person.id, 'devamsizlik', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-red-100 focus:ring-1 focus:ring-red-400 rounded text-red-600 font-bold" placeholder="0" title="Manuel düzenlenebilir" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-orange-50/50">
                      <input type="number" value={row.rapor !== undefined ? row.rapor : (c.rapor || '')} onChange={e => handleCellChange(person.id, 'rapor', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-orange-100 focus:ring-1 focus:ring-orange-400 rounded text-orange-600 font-bold" placeholder="0" title="Manuel düzenlenebilir" />
                    </td>
                    )}
                    {g('izinler') && (
                      <td style={{ borderRight: '3px solid #2563eb' }} className="border-r border-neutral-300 px-0.5 py-0.5 bg-purple-50/50">
                      <input type="number" value={(yearlyData[person.id] && yearlyData[person.id].yillikIzin) || ''} onChange={e => handleYearlyChange(person.id, 'yillikIzin', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-purple-100 focus:ring-1 focus:ring-purple-400 rounded text-purple-700 font-bold" placeholder="0" title="Tüm yıl boyunca geçerlidir. Yıl sonunda sıfırlanır." />
                    </td>
                    )}
                    {g('hakedis') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-yellow-50/30">
                      {/* DEĞİŞTİ (kullanıcı talebi): Muhasebeden avans GİRİŞİ
                          kaldırıldı. Avanslar artık yalnızca Ödemeler defterinden
                          girilir ve ÖDEME yapılınca buraya otomatik işlenir. Bu
                          hücre salt-okunur: ödenen avansı gösterir. */}
                      <div className="w-full h-6 flex items-center justify-center text-[10px] text-neutral-600 font-bold" title="Avans girişi Ödemeler defterinden yapılır; ödeme sonrası buraya işlenir.">{row.nakitAvans ? Number(row.nakitAvans).toLocaleString('tr-TR') : '—'}</div>
                    </td>
                    )}
                    {g('hakedis') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-yellow-50/30">
                      {/* DEĞİŞTİ (kullanıcı talebi): salt-okunur — bkz. Nakit Avans hücresi */}
                      <div className="w-full h-6 flex items-center justify-center text-[10px] text-neutral-600 font-bold" title="Avans girişi Ödemeler defterinden yapılır; ödeme sonrası buraya işlenir.">{row.resmiAvans ? Number(row.resmiAvans).toLocaleString('tr-TR') : '—'}</div>
                    </td>
                    )}
                    {g('hakedis') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5">
                      {/* YENİ: PRİM SÜTUNU ARTIK TUTAR (TL) GÖSTERİR.
                          Giriş mantığı değişmedi: hücreye tıklandığında yine SAAT girilir
                          (row.prim saat olarak saklanır ve toplam saate eklenir).
                          Odaktan çıkılınca saatin TL karşılığı (maas/200 * saat) görünür. */}
                      {duzenlenebilir && primDuzenlenenId === person.id ? (
                        <input type="number" autoFocus value={row.prim || ''}
                          onChange={e => handleCellChange(person.id, 'prim', e.target.value)}
                          onBlur={() => setPrimDuzenlenenId(null)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setPrimDuzenlenenId(null); }}
                          className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-green-50 focus:ring-1 focus:ring-green-400 rounded text-green-600 font-bold"
                          placeholder="Saat" title="Prim SAAT olarak girilir; tabloda TL karşılığı gösterilir." />
                      ) : (
                        <div
                          onClick={() => { if (duzenlenebilir) setPrimDuzenlenenId(person.id); }}
                          className={`w-full h-6 flex items-center justify-center text-[10px] font-bold text-green-700 rounded ${duzenlenebilir ? 'cursor-pointer hover:bg-green-50' : ''}`}
                          title={duzenlenebilir ? `Girilen prim: ${c.prim} saat — değiştirmek için tıklayın` : `Girilen prim: ${c.prim} saat`}>
                          {/* YENİ: Hasar kesintisi varsa NET prim gösterilir; kesilen
                              tutar kırmızı olarak yanında belirtilir. Kesinti yoksa
                              görünüm eskisiyle birebir aynıdır. */}
                          {c.hasarKesinti > 0 ? (
                            <span className="flex flex-col leading-tight items-center">
                              <span>{c.primTLNet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                              <span className="text-[8px] text-red-600 font-black" title={`Hasar kesintisi: ₺${c.hasarKesinti.toLocaleString('tr-TR')}`}>-{c.hasarKesinti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} hasar</span>
                            </span>
                          ) : (
                            c.primTL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                          )}
                        </div>
                      )}
                    </td>
                    )}
                    {g('hakedis') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-purple-100 font-bold text-purple-900 text-center align-middle">
                      {/* YENİ: Mesai ücreti artık PRİM PAYI DÜŞÜLMÜŞ olarak gösterilir.
                          Maaş hesabı değişmedi; Kalan Nakit hâlâ prim dahil tutarı kullanır. */}
                      {c.mesaiUcretiSaf.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </td>
                    )}
                    {g('hakedis') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-red-50/50">
                      <input type="number" value={(yearlyData[person.id] && yearlyData[person.id].borclanma) || ''} onChange={e => handleYearlyChange(person.id, 'borclanma', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-red-100 focus:ring-1 focus:ring-red-400 rounded text-red-700 font-bold" placeholder="0" title="Tüm yıl boyunca geçerlidir. Yıl sonunda sıfırlanır." />
                    </td>
                    )}
                    {g('hakedis') && (
                      <td style={{ borderRight: '3px solid #6d28d9' }} className={`border-r border-neutral-300 px-0.5 py-0.5 font-black text-center align-middle ${row.icraOdendi ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={row.icraOdendi ? 'line-through opacity-70' : ''}>{c.icraKesintisi.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        {c.icraKesintisi > 0 && (
                          <button type="button" onClick={() => handlePaymentToggle(person.id, 'icraOdendi', 'icraOdenenTutar', c.icraKesintisi)} className={`p-0.5 shrink-0 rounded transition ${row.icraOdendi ? 'text-green-700' : 'text-red-600/50 hover:text-red-800'}`} title={row.icraOdendi ? 'İcra Kesintisi Yatırıldı (Gidere işlendi)' : 'İcra Kesintisi Ödenmedi'}>
                            <CheckCircle className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    )}
                    {g('finans') && (
                      <td className={`border-r border-neutral-300 px-0.5 py-0.5 ${row.yemekOdendi ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input type="number" value={row.yemek !== undefined ? row.yemek : (person.yemek || '')} onChange={e => handleCellChange(person.id, 'yemek', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-neutral-100 focus:ring-1 focus:ring-neutral-400 rounded" placeholder="0" />
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'yemekOdendi', 'yemekOdenenTutar', (row.yemek !== undefined ? row.yemek : (person.yemek || 0)))} className={`p-1 shrink-0 rounded transition ${row.yemekOdendi ? 'text-green-600' : 'text-neutral-300 hover:text-neutral-500'}`} title={row.yemekOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    )}
                    {g('finans') && (
                      <td className={`border-r border-neutral-300 px-0.5 py-0.5 ${row.yolOdendi ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input type="number" value={row.yol !== undefined ? row.yol : (person.yol || '')} onChange={e => handleCellChange(person.id, 'yol', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-neutral-100 focus:ring-1 focus:ring-neutral-400 rounded" placeholder="0" />
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'yolOdendi', 'yolOdenenTutar', (row.yol !== undefined ? row.yol : (person.yol || 0)))} className={`p-1 shrink-0 rounded transition ${row.yolOdendi ? 'text-green-600' : 'text-neutral-300 hover:text-neutral-500'}`} title={row.yolOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    )}
                    {g('finans') && (() => {
                      // ============================================================
                      // YENİ (kullanıcı talebi): KISMİ ÖDEME PERSONEL MUHASEBEDE DE DÜŞER
                      // ------------------------------------------------------------
                      // c.bankaKalan tam tutardır. Ödemeler ekranından yapılan kısmi
                      // ödemede biriken bankaOdenenTutar buradan da düşülür; böylece
                      // iki ekran birbirini tutar. Tik atılmışsa (tam ödeme) 0/Ödendi
                      // görünür. Bakiye 0 (veya altı) ise her zaman "Ödendi" sayılır.
                      // ============================================================
                      const bKismi = parseFloat(row.bankaOdenenTutar) || 0;
                      const bGoster = Math.max(0, c.bankaKalan - bKismi);
                      const bKapandi = row.bankaOdendi || bGoster <= 0.01;
                      const bKismiVar = !bKapandi && bKismi > 0.01;
                      return (
                      <td className={`border-r border-neutral-300 px-0.5 py-0.5 align-middle ${bKapandi ? 'bg-green-200' : bKismiVar ? 'bg-sky-100' : 'bg-yellow-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${bKapandi ? 'text-green-800 line-through opacity-70' : bKismiVar ? 'text-sky-800' : 'text-yellow-900'}`} title={bKismiVar ? `Kısmi: ₺${paraFmt(bKismi)} ödendi, ₺${paraFmt(bGoster)} kaldı` : ''}>{bKapandi ? 'Ödendi' : bGoster.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'bankaOdendi', 'bankaOdenenTutar', c.bankaKalan)} className={`p-0.5 shrink-0 rounded transition ${bKapandi ? 'text-green-700' : 'text-yellow-600/50 hover:text-yellow-800'}`} title={bKapandi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                      );
                    })()}
                    {g('finans') && (() => {
                      // Nakit hücresi — banka ile aynı kısmi ödeme mantığı
                      const nKismi = parseFloat(row.nakitOdenenTutar) || 0;
                      const nGoster = Math.max(0, c.kalanNakit - nKismi);
                      const nKapandi = row.nakitOdendi || nGoster <= 0.01;
                      const nKismiVar = !nKapandi && nKismi > 0.01;
                      return (
                      <td style={{ borderRight: '3px solid #16a34a' }} className={`px-0.5 py-0.5 align-middle ${nKapandi ? 'bg-green-300' : nKismiVar ? 'bg-sky-100' : 'bg-orange-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${nKapandi ? 'text-green-900 line-through opacity-70' : nKismiVar ? 'text-sky-800' : 'text-orange-900'}`} title={nKismiVar ? `Kısmi: ₺${paraFmt(nKismi)} ödendi, ₺${paraFmt(nGoster)} kaldı` : ''}>{nKapandi ? 'Ödendi' : nGoster.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'nakitOdendi', 'nakitOdenenTutar', c.kalanNakit)} className={`p-0.5 shrink-0 rounded transition ${nKapandi ? 'text-green-800' : 'text-orange-600/50 hover:text-orange-800'}`} title={nKapandi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                      );
                    })()}
                  </tr>
                );
              })}
              {targetPersonnelList.length === 0 && (
                <tr>
                  <td colSpan={aktifSutunSayisi} className="p-8 text-center text-neutral-500 font-medium">
                    Sistemde {collarType.toLowerCase()} personel kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Toplam satırı yalnızca Finans kategorisinde anlamlıdır (parasal sütunlar orada) */}
            {targetPersonnelList.length > 0 && g('finans') && (
              <tfoot className="sticky bottom-0 z-40 shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.1)]">
                <tr className="bg-black text-white font-black text-[10px]">
                  {/* Toplam hücreleri son 4 sütuna (Yemek/Yol/Kalan Banka/Kalan Nakit) denk gelir;
                      soldaki tüm sütunlar tek hücrede birleştirilir.
                      YENİ: Tik atılan (ödenen) kalemler bu toplamlara dahil edilmediği için
                      burada görünen rakamlar her zaman KALAN ÖDENECEK tutarlardır. */}
                  <td colSpan={aktifSutunSayisi - 4} className="px-2 py-2 text-right border-r border-neutral-600">KALAN ÖDENECEK TOPLAM :</td>
                  <td className="px-1 py-2 text-center border-r border-neutral-600 text-white text-[10px]">₺{totalYemek.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                  <td className="px-1 py-2 text-center border-r border-neutral-600 text-white text-[10px]">₺{totalYol.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                  <td className="px-1 py-2 text-center border-r border-neutral-600 text-yellow-400 text-[10px]">₺{totalKalanBanka.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                  <td className="px-1 py-2 text-center text-orange-400 text-[10px]">₺{totalKalanNakit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    };

    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [maasData, setMaasData] = useState({});
    const [mesaiData, setMesaiData] = useState({});
    const [yearlyData, setYearlyData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const docPrefix = collarType === 'Mavi Yaka' ? '' : 'beyaz_';

    const months = [
      { val: 1, label: 'Ocak' }, { val: 2, label: 'Şubat' }, { val: 3, label: 'Mart' },
      { val: 4, label: 'Nisan' }, { val: 5, label: 'Mayıs' }, { val: 6, label: 'Haziran' },
      { val: 7, label: 'Temmuz' }, { val: 8, label: 'Ağustos' }, { val: 9, label: 'Eylül' },
      { val: 10, label: 'Ekim' }, { val: 11, label: 'Kasım' }, { val: 12, label: 'Aralık' }
    ];
    const years = Array.from({ length: 10 }, (_, i) => 2024 + i);

    const targetPersonnelList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (!isPersonnelVisibleInMonth(p, currentYear, currentMonth)) return false;
      return collarType === 'Mavi Yaka' 
        ? (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
        : (p.collarType === 'Beyaz Yaka' || (!p.collarType && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
    }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'));

    useEffect(() => {
      const fetchData = async () => {
        setIsDataLoaded(false);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${docPrefix}${currentYear}_${currentMonth}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setMaasData(snap.data().records || {});
          } else {
            setMaasData({});
          }
          
          const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${currentYear}_${currentMonth}`);
          const mesaiSnap = await getDoc(mesaiRef);
          if (mesaiSnap.exists()) {
            setMesaiData(mesaiSnap.data().records || {});
          } else {
            setMesaiData({});
          }

          const yearlyRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas_yearly', currentYear.toString());
          const yearlySnap = await getDoc(yearlyRef);
          if (yearlySnap.exists()) {
            setYearlyData(yearlySnap.data().records || {});
          } else {
            setYearlyData({});
          }
        } catch (e) {
          console.error("Veri yüklenirken hata:", e);
        } finally {
          setIsDataLoaded(true);
        }
      };
      fetchData();
    }, [currentMonth, currentYear, db, appId, docPrefix]);

    useEffect(() => {
      if (!isDataLoaded) return;
      const timeoutId = setTimeout(async () => {
        setIsSaving(true);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${docPrefix}${currentYear}_${currentMonth}`);
          await setDoc(docRef, { records: maasData, updatedAt: new Date().toISOString() }, { merge: true });

          const yearlyRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas_yearly', currentYear.toString());
          await setDoc(yearlyRef, { records: yearlyData, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
          console.error("Otomatik kaydetme hatası:", e);
        }
        setTimeout(() => setIsSaving(false), 800);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }, [maasData, yearlyData, docPrefix]);

    // ========================================================================
    // YENİ: MAAŞ / AVANS -> DEFTER ENTEGRASYONU
    // ========================================================================
    // Nakit avans, resmi avans ve ödeme tikleri ilgili deftere "PARA ÇIKIŞI
    // (VERDİM)" olarak personel bazlı yazılır. İşlemi yapan kullanıcı da kayda geçer.
    //
    // NEDEN AYRI EFFECT VE 1.5 SANİYE GECİKME: nakitAvans bir metin kutusu.
    // Her tuş vuruşunda Firestore'a yazmak hem yavaş hem maliyetli olurdu
    // (50.000 yazarken 5 ayrı kayıt). Gecikme, kullanıcı yazmayı bitirene
    // kadar bekler. Süre maasData otomatik kaydından (1 sn) biraz UZUN
    // tutuldu ki maaş satırı deftere yazılmadan önce kaydedilmiş olsun.
    //
    // sonSenkronRef: son yazılan tutarları hatırlar. Böylece her effect
    // çalışmasında TÜM personel için yazma yapılmaz; yalnızca DEĞİŞEN
    // kalemler deftere gider.
    const sonSenkronRef = useRef({});

    // ========================================================================
    // YENİ: HASAR BORCU -> PRİMDEN OTOMATİK KESİNTİ
    // ========================================================================
    // KURALLAR (kullanıcı talebi):
    //  • Kesinti YALNIZCA primden yapılır; maaş, yol, yemek, banka asla etkilenmez.
    //  • Prim eksiye düşmez: kesinti = min(o ayki prim TL, kalan hasar borcu).
    //  • O ay prim yoksa kesinti 0 olur; borç SONRAKİ aylara aynen devreder.
    //  • Prim borçtan büyükse borç tamamen kapanır, primin kalanı personele kalır.
    //
    // NASIL ÇALIŞIR (kendi kendini düzelten hesap):
    //  Personel kartındaki hasarBorcuKalan, KAYITLI TÜM kesintiler düşülmüş
    //  kalan borçtur. Bu ayın primi değiştiğinde önce bu ayın eski kesintisi
    //  geri eklenir (borcOncesi), sonra yeni prim üzerinden kesinti YENİDEN
    //  hesaplanır. Böylece prim artarsa kesinti otomatik büyür, azalırsa
    //  küçülür; işlem kaç kez çalışırsa çalışsın sonuç aynı kalır (idempotent).
    //
    //  Kesinti maaş satırına (row.hasarKesinti) yazılır -> calcRow bunu
    //  Kalan Nakit'ten düşer. Personelin hareket akışına ayda TEK kayıt düşülür
    //  (sabit belge kimliği ile üzerine yazılır, tuş başına kayıt ÜREMEZ).
    // ========================================================================
    const hasarSenkronRef = useRef({});
    useEffect(() => { hasarSenkronRef.current = {}; }, [currentYear, currentMonth, docPrefix]);

    useEffect(() => {
      if (!isDataLoaded) return;
      const timeoutId = setTimeout(async () => {
        for (const person of targetPersonnelList) {
          const row = maasData[person.id] || {};
          const eskiKesinti = parseFloat(row.hasarKesinti) || 0;
          const kalanBorc = parseFloat(person.hasarBorcuKalan) || 0;
          if (kalanBorc <= 0 && eskiKesinti <= 0) continue; // Borcu olmayan atlanır

          // Bu ayın etkisi geri alınmış borç (yeniden hesap için taban)
          const borcOncesi = Math.round((kalanBorc + eskiKesinti) * 100) / 100;

          // O ayki prim TL — calcRow ile AYNI formül: (maaş / 200) * prim saati
          const c = calcRow(person.id);
          const yeniKesinti = Math.round(Math.min(c.primTL, borcOncesi) * 100) / 100;

          if (Math.abs(yeniKesinti - eskiKesinti) < 0.01) continue; // Değişiklik yoksa dokunma

          // Aynı değeri arka arkaya yazmayı önle (personnelList prop'u
          // güncellenince effect yeniden koşar; bu bekçi döngüyü keser)
          const bekciAnahtari = `${docPrefix}${currentYear}_${currentMonth}_${person.id}`;
          if (hasarSenkronRef.current[bekciAnahtari] === yeniKesinti) continue;
          hasarSenkronRef.current[bekciAnahtari] = yeniKesinti;

          try {
            // 1) Maaş satırına yaz (autosave 'maas' dokümanına kaydeder)
            setMaasData(prev => ({ ...prev, [person.id]: { ...(prev[person.id] || {}), hasarKesinti: yeniKesinti } }));

            // 2) Personel kartındaki kalan borcu güncelle
            const yeniKalan = Math.round((borcOncesi - yeniKesinti) * 100) / 100;
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(person.id)), {
              hasarBorcuKalan: yeniKalan
            });

            // 3) Hareket akışına AYDA TEK kayıt (sabit kimlik -> üzerine yazar)
            const actionRef = doc(db, 'artifacts', appId, 'public', 'data', 'personnelActions', `hasarkesinti_${docPrefix}${currentYear}_${currentMonth}_${person.id}`);
            if (yeniKesinti > 0) {
              await setDoc(actionRef, {
                personnelId: String(person.id),
                type: 'hasarKesinti',
                title: 'Hasar Kesintisi (Primden)',
                amount: yeniKesinti,
                month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
                note: `Priminden ₺${yeniKesinti.toLocaleString('tr-TR')} hasar borcu düşüldü. Kalan borç: ₺${yeniKalan.toLocaleString('tr-TR')}.`,
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString()
              });
            } else {
              // Kesinti 0'a düştüyse (prim silindiyse) o ayın kaydı da kaldırılır
              await deleteDoc(actionRef).catch(() => {});
            }
          } catch (err) { console.error('Hasar kesintisi yazılamadı:', person.id, err); }
        }
      }, 1500); // Prim yazımı bitene kadar bekle (defter entegrasyonuyla aynı süre)
      return () => clearTimeout(timeoutId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maasData, isDataLoaded, personnelList]);

    // Ay/yıl değiştiğinde hafıza sıfırlanır. Aksi halde önceki aya ait
    // tutarlar "değişmedi" sanılır ve yeni ayın kalemleri deftere yazılmaz.
    useEffect(() => { sonSenkronRef.current = {}; }, [currentYear, currentMonth, docPrefix]);

    useEffect(() => {
      if (!isDataLoaded) return;
      const timeoutId = setTimeout(async () => {
        // Deftere yazılacak dört kalem. Alan adları maasData içindekilerle aynı.
        const kalemler = ['nakitAvans', 'resmiAvans', 'nakitOdenenTutar', 'bankaOdenenTutar'];

        for (const person of targetPersonnelList) {
          const row = maasData[person.id];
          if (!row) continue;

          for (const kalem of kalemler) {
            // Ödeme tutarları yalnızca TİK AÇIKKEN geçerlidir. Tik kapalıysa
            // tutar 0 sayılır ve varsa defter kaydı silinir.
            let tutar = parseFloat(row[kalem]) || 0;
            if (kalem === 'nakitOdenenTutar' && !row.nakitOdendi) tutar = 0;
            if (kalem === 'bankaOdenenTutar' && !row.bankaOdendi) tutar = 0;

            // Kalem kimliği: ay + personel + kalem. Aynı kalem tekrar
            // yazıldığında yeni satır değil GÜNCELLEME yapılmasını sağlar.
            const kaynakId = `${docPrefix}${currentYear}_${currentMonth}_${person.id}_${kalem}`;

            // Değişmediyse Firestore'a hiç dokunulmaz.
            if (sonSenkronRef.current[kaynakId] === tutar) continue;
            sonSenkronRef.current[kaynakId] = tutar;

            await defterPersonelGiderKaydet({
              db, appId, kalem, kaynakId,
              personelAdi: person.fullName || 'Personel',
              tutar,
              yil: currentYear,
              ay: currentMonth,
              currentUser,
              addSystemLog
            });
          }
        }
      }, 1500);
      return () => clearTimeout(timeoutId);
    }, [maasData, docPrefix, currentYear, currentMonth, isDataLoaded]);

    const handleCellChange = (personId, field, value) => {
      setMaasData(prev => ({
        ...prev,
        [personId]: {
          ...(prev[personId] || {}),
          [field]: value
        }
      }));
    };

    // YENİ: Ödeme tiki (yemek/yol/banka/nakit/icra) yapıldığında, o kalemin TUTARINI ve
    // hangi aya ait olduğunu da maaş kaydına yazar. Böylece Kasa Özeti bu tikli tutarları
    // ay bazında GİDER olarak okuyabilir. Tik kaldırılırsa tutar sıfırlanır (gider düşer).
    const handlePaymentToggle = (personId, field, amountField, amountValue) => {
      const row = maasData[personId] || {};
      const newChecked = !row[field];
      setMaasData(prev => ({
        ...prev,
        [personId]: {
          ...(prev[personId] || {}),
          [field]: newChecked,
          // Tik açıkken tutarı yaz, kapalıyken 0 yaz (gider hesabından düşsün)
          [amountField]: newChecked ? (parseFloat(amountValue) || 0) : 0,
          // Bu satırın ait olduğu ay bilgisini kaydet (Kasa Özeti ay filtresi için)
          _giderYil: currentYear,
          _giderAy: currentMonth
        }
      }));
    };

    const handleYearlyChange = (personId, field, value) => {
      setYearlyData(prev => ({
        ...prev,
        [personId]: {
          ...(prev[personId] || {}),
          [field]: value
        }
      }));
    };

    const calcRow = (personId) => {
      const person = targetPersonnelList.find(p => p.id === personId) || {};
      const row = maasData[personId] || {};
      
      const record = mesaiData[personId] || {};
      let devamsiz = 0;
      let raporCount = 0;
      let ucretsizIzinCount = 0;
      let toplamMesaiSaati = 0;
      let fazlaGunCount = 0;

      Object.values(record).forEach(val => {
        if (typeof val === 'object' && val !== null) {
          if (val.status === 'D') devamsiz++;
          else if (val.status === 'R') raporCount++;
          // YENİ: "İşi Bıraktı (İB)" kodu, maaş hesabında Ücretsiz İzin (Üİ) ile aynı mantıkla
          // (o gün için ödeme yapılmaz) işlenir.
          else if (val.status === 'Üİ' || val.status === 'İB') ucretsizIzinCount++;
          else if (val.status === 'FG') fazlaGunCount++;
          else if (val.status === 'FGM') { fazlaGunCount++; toplamMesaiSaati += saatMetniSayiyaCevir(val.hours); }
          else if (val.status === 'FM') toplamMesaiSaati += saatMetniSayiyaCevir(val.hours);
          else if (val.status === 'EM') toplamMesaiSaati -= saatMetniSayiyaCevir(val.hours);
        } else {
          if (val === 'D') devamsiz++;
          else if (val === 'R') raporCount++;
          else if (val === 'Üİ' || val === 'İB') ucretsizIzinCount++;
          else if (val === 'FG') fazlaGunCount++;
          else if (val === 'FGM') fazlaGunCount++;
        }
      });

      const nakitAvans = parseFloat(row.nakitAvans) || 0;
      const resmiAvans = parseFloat(row.resmiAvans) || 0;
      
      const gunlukSaat = toplamMesaiSaati;
      
      // Manuel ve Otomatik Veri Birleşimi
      const devamsizlikSayisi = row.devamsizlik !== undefined && row.devamsizlik !== '' ? parseFloat(row.devamsizlik) : devamsiz;
      const rapor = row.rapor !== undefined && row.rapor !== '' ? parseFloat(row.rapor) : raporCount;
      const ucretsizIzinSayisi = ucretsizIzinCount; // Ücretsiz izin mesai tablosundan çekilir
      const fazlaGunSayisi = row.fazlaGun !== undefined && row.fazlaGun !== '' ? parseFloat(row.fazlaGun) : fazlaGunCount;

      // YENİ: İŞE GİRİŞ günleri (personelin işe başlangıç tarihinden ÖNCEKİ günler) ücretsiz izin gibi
      // sayılır; bu günler için maaş hesaplanmaz (çalışılmamış kabul edilir).
      let iseGirisGunSayisi = 0;
      if (person.startDate) {
        const _s = new Date(person.startDate + 'T00:00:00');
        if (!isNaN(_s.getTime())) {
          const _daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
          const _startMidnight = new Date(_s.getFullYear(), _s.getMonth(), _s.getDate());
          for (let _d = 1; _d <= _daysInMonth; _d++) {
            if (new Date(currentYear, currentMonth - 1, _d) < _startMidnight) iseGirisGunSayisi++;
          }
        }
      }

      // Devamsızlık, Rapor, Ücretsiz İzin ve İŞE GİRİŞ günleri doğrudan Mesai Gün Sayısını eksiltir
      const mesaiGunSayisi = Math.max(0, 30 - rapor - devamsizlikSayisi - ucretsizIzinSayisi - iseGirisGunSayisi);
      const odenecekGun = mesaiGunSayisi;
      
      // DEĞİŞİKLİK: person.maas yerine gecerliMaas() kullanılır. Bu fonksiyon,
      // ilgili ay deneme süresi içindeyse person.denemeMaasi, değilse person.maas
      // döndürür. Elle girilen satır değeri (row.maas) her ikisini de EZER —
      // muhasebenin tek bir ay için manuel düzeltme yapma imkânı korunur.
      const maas = parseFloat(row.maas !== undefined && row.maas !== '' ? row.maas : gecerliMaas(person, currentYear, currentMonth)) || 0;
      const bankaParasiBase = parseFloat(person.bankaParasi) || 0;
      
      const hesaplananBanka = (bankaParasiBase / 30) * odenecekGun;
      const icraKesintisi = person.icrasiVar === 'Evet' ? (hesaplananBanka / 4) : 0;
      const bankaKalan = hesaplananBanka - icraKesintisi - resmiAvans;

      const prim = parseFloat(row.prim) || 0;
      const yol = parseFloat(row.yol !== undefined && row.yol !== '' ? row.yol : person.yol) || 0;
      const yemek = parseFloat(row.yemek !== undefined && row.yemek !== '' ? row.yemek : person.yemek) || 0;

      // Toplam Saat Hesaplama:
      // Günlük Saat (Fazla/Eksik Mesailer neticesi) + (Fazla Gün * 10) - (Devamsızlık * 3) + PRİM SAATİ
      const hesaplananToplamSaat = gunlukSaat + (fazlaGunSayisi * 10) - (devamsizlikSayisi * 3) + prim;
      
      const toplamSaat = hesaplananToplamSaat;

      // Mesai ücreti: Toplam saat üzerinden hesaplanan tutar (Prim saate eklendi)
      const mesaiUcreti = ((maas / 200) * toplamSaat);

      // ====================================================================
      // YENİ: SADECE GÖSTERİM İÇİN AYRIŞTIRMA
      // Alttaki hesap mantığı AYNEN KORUNDU: prim hâlâ SAAT olarak girilir,
      // saate eklenir ve mesaiUcreti içinde yer alır. Kalan Banka / Kalan Nakit
      // / Maliyet hesapları aşağıda değişmeden mesaiUcreti'ni kullanmaya devam eder.
      // Aşağıdaki iki değer YALNIZCA tabloda ayrı ayrı göstermek içindir:
      //   primTL        -> girilen prim saatinin TL karşılığı
      //   mesaiUcretiSaf-> prim payı düşülmüş saf mesai ücreti
      // Toplamları eşittir: mesaiUcretiSaf + primTL = mesaiUcreti (değişim yok)
      // ====================================================================
      const primTL = (maas / 200) * prim;
      const mesaiUcretiSaf = mesaiUcreti - primTL;

      // ====================================================================
      // YENİ: HASAR KESİNTİSİ (yalnızca PRİMDEN, asla maaştan)
      // ====================================================================
      // row.hasarKesinti: bu ay personelin priminden kesilen hasar borcu (TL).
      // Bu değer aşağıdaki otomatik effect tarafından yazılır ve HİÇBİR ZAMAN
      // o ayın prim TL'sinden büyük olamaz (prim eksiye düşmez; saat hesabına
      // da eksi sokulmaz — toplamSaat/mesaiUcreti formülleri aynen korunur).
      // primTLNet: kesinti sonrası personelin eline geçecek prim.
      // ====================================================================
      const hasarKesinti = Math.min(parseFloat(row.hasarKesinti) || 0, primTL);
      const primTLNet = primTL - hasarKesinti;

      const toplamAvans = nakitAvans + resmiAvans;
      const netMaas = (maas / 30) * mesaiGunSayisi;
      const maliyet = netMaas + mesaiUcreti + yol + yemek;
      
      // Kalan Nakit: (Hak edilen maaş) - Bankaya Yatan Kısım - Nakit Avans + Mesai Ücreti
      // YENİ: - Hasar Kesintisi (prim nakit ödendiği için kesinti Kalan Nakit'ten düşer)
      const kalanNakit = netMaas - hesaplananBanka - nakitAvans + mesaiUcreti - hasarKesinti;

      return { 
        nakitAvans, resmiAvans, gunlukSaat, toplamSaat, mesaiGunSayisi, 
        maas, fazlaGunSayisi, devamsizlikSayisi, rapor, ucretsizIzinSayisi, prim, yol, yemek,
        hesaplananBanka, icraKesintisi, bankaKalan,
        mesaiUcreti, primTL, mesaiUcretiSaf, hasarKesinti, primTLNet, toplamAvans, netMaas, maliyet, kalanNakit 
      };
    };

    // Alt Kısımda Gösterilecek Genel Toplamları Hesapla
    // YENİ: Ödeme tiki ATILAN (ödenmiş) kalemler toplama DAHİL EDİLMEZ.
    // Böylece alttaki toplam satırı her zaman "KALAN ÖDENECEK" tutarı gösterir;
    // bir kaleme tik atıldığında ilgili sütunun toplamı anında azalır,
    // tik kaldırıldığında tutar toplama geri eklenir.
    let totalKalanBanka = 0;
    let totalKalanNakit = 0;
    let totalYol = 0;
    let totalYemek = 0;

    targetPersonnelList.forEach(person => {
        const c = calcRow(person.id);
        const row = maasData[person.id] || {}; // Ödeme tiki durumları bu satırda tutulur
        if (!row.yemekOdendi) totalYemek += c.yemek;          // Yemek ödenmediyse toplama ekle
        if (!row.yolOdendi) totalYol += c.yol;                // Yol ödenmediyse toplama ekle
        if (!row.bankaOdendi) totalKalanBanka += c.bankaKalan; // Banka ödenmediyse toplama ekle
        if (!row.nakitOdendi) totalKalanNakit += c.kalanNakit; // Nakit ödenmediyse toplama ekle
    });

    const handleDownloadCSV = () => {
      const headers = [
        "PERSONEL BİLGİSİ", "İŞE BAŞLANGIÇ TARİHİ", "NAKİT AVANS", "RESMİ AVANS", "GÜNLÜK SAAT", "TOPLAM SAAT", 
        "MESAİ GÜN SAYISI", "FAZLA GÜN SAYISI", "DEVAMSIZLIK", "RAPOR", "YILLIK İZİN", "BANKA PARASI", 
        "PRİM SAAT", "PRİM ÜCRETİ", "MAAŞ", "MESAİ ÜCRETİ", "YEMEK PARASI", "YOL PARASI", "BORÇLANMA", "İCRA TUTARI", "KALAN BANKA", "KALAN NAKİT"
      ];
      let csvContent = "\uFEFF" + headers.join(";") + "\n";
      
      targetPersonnelList.forEach(person => {
          const c = calcRow(person.id);
          const yRow = yearlyData[person.id] || {};
          const rowData = [
              `"${person.fullName.replace(/"/g, '""')}"`,
              `"${person.startDate || '-'}"`,
              c.nakitAvans,
              c.resmiAvans,
              c.gunlukSaat,
              c.toplamSaat,
              c.mesaiGunSayisi,
              c.fazlaGunSayisi,
              c.devamsizlikSayisi,
              c.rapor,
              yRow.yillikIzin || 0,
              c.hesaplananBanka.toFixed(2),
              c.prim,                       // Girilen prim SAATİ (mantık aynı kaldı)
              c.primTL.toFixed(2),          // YENİ: Primin TL karşılığı
              c.maas,
              c.mesaiUcretiSaf.toFixed(2),  // YENİ: Prim payı düşülmüş saf mesai ücreti
              c.yemek,
              c.yol,
              yRow.borclanma || 0,
              c.icraKesintisi.toFixed(2),
              c.bankaKalan.toFixed(2),
              c.kalanNakit.toFixed(2)
          ];
          csvContent += rowData.join(";") + "\n";
      });

      // CSV Dosyasına Genel Toplamların Eklenmesi
      const totalRow = [
          `"GENEL TOPLAMLAR"`, "","","","","","","","","","", "","","", 
          totalYemek.toFixed(2), totalYol.toFixed(2), "", "", 
          totalKalanBanka.toFixed(2), totalKalanNakit.toFixed(2)
      ];
      csvContent += totalRow.join(";") + "\n";
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${collarType.replace(' ', '_')}_Maas_Tablosu_${months.find(m => m.val === currentMonth)?.label}_${currentYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 md:p-6 animate-in fade-in flex flex-col h-[calc(100vh-190px)] relative w-full overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 shrink-0 gap-4 w-full">
          <h2 className="text-lg md:text-xl font-bold text-black flex items-center gap-2">
            <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600" /> {collarType} Maaş Tablosu
          </h2>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select value={currentMonth} onChange={e => setCurrentMonth(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-green-600 cursor-pointer flex-1 md:flex-none text-sm">
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            <select value={currentYear} onChange={e => setCurrentYear(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-green-600 cursor-pointer flex-1 md:flex-none text-sm">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleDownloadCSV} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-md text-sm mt-1 md:mt-0 order-last md:order-none">
              <Download className="w-4 h-4" /> 
              Excel (CSV) İndir
            </button>
            <div className="flex items-center w-full md:w-28 justify-center md:justify-end mt-1 md:mt-0">
              {isSaving ? (
                <span className="text-xs font-bold text-neutral-400 flex items-center gap-1 animate-pulse"><Loader2 className="w-3 h-3 animate-spin"/> Kaydediliyor...</span>
              ) : isDataLoaded ? (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Kaydedildi</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* YENİ: 4 KATEGORİ YAN YANA — Genel Bilgiler / İzinler Durumu / Hak Ediş Durumu /
            Finans Durumu tek tabloda gruplanır. Personel Bilgisi sütunu tektir ve solda
            sabit kalır; tüm personel listesi tek sayfada görünür. Sütunlar tek ekrana
            sığacak şekilde daraltılmıştır. Her grup başlığındaki "Düzenle" butonu o
            kategoriyi düzenlenebilir pencerede açar. */}
        <div className="flex-1 w-full min-h-0">
          {tabloRender(['genel', 'izinler', 'hakedis', 'finans'], false)}
        </div>

        {/* YENİ: KATEGORİ DÜZENLEME PENCERESİ — değişiklikler mevcut otomatik
            kayıt mekanizmasıyla anında Firebase'e yazılır. */}
        {duzenlemeKategori && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex justify-center items-center p-3 md:p-6">
            {/* h-[88vh]: Pencereye KESİN yükseklik verilir. Yükseklik "içeriğe göre"
                bırakıldığında içindeki tablonun h-full değeri hesaplanamıyor, tablo
                kendi kaydırma alanını oluşturmadan taşıyor ve alt satırlar kesiliyordu.
                Sabit yükseklikle tablo alanı kesinleşir; liste aşağıya doğru kaydırılır,
                başlık satırları üstte, "Kaydet ve Kapat" altta sabit kalır. */}
            <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col h-[88vh]">
              <div className={`${MAAS_KATEGORILER.find(k => k.id === duzenlemeKategori)?.renk || 'bg-neutral-800'} text-white px-4 py-3 flex justify-between items-center shrink-0`}>
                <h3 className="font-black text-sm md:text-base flex items-center gap-2">
                  <Edit className="w-4 h-4" /> {MAAS_KATEGORILER.find(k => k.id === duzenlemeKategori)?.label} — Düzenleme
                </h3>
                <div className="flex items-center gap-3">
                  {isSaving
                    ? <span className="text-[11px] font-bold text-white/80 flex items-center gap-1 animate-pulse"><Loader2 className="w-3 h-3 animate-spin"/> Kaydediliyor...</span>
                    : <span className="text-[11px] font-bold text-white/80 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Kaydedildi</span>}
                  <button onClick={() => setDuzenlemeKategori(null)} className="text-white/70 hover:text-white transition"><X className="w-6 h-6" /></button>
                </div>
              </div>
              {/* min-h-0: flex çocuğunun küçülmesine izin verir; böylece tablo pencere
                  yüksekliğini taşırmaz ve tüm personel listesi AŞAĞIYA DOĞRU KAYDIRILARAK
                  görülebilir (başlık satırları üstte sabit kalır). 4 kategorinin
                  düzenleme penceresi de aynı iskeleti kullandığı için hepsinde geçerlidir. */}
              {/* Tablo alanına px cinsinden KESİN yükseklik verilir (pencere 88vh, üstteki
                  başlık ~48px, alttaki "Kaydet ve Kapat" ~72px). Yükseklik flex hesabına
                  bırakıldığında tarayıcı içteki tablonun h-full değerini çözemiyor ve
                  liste kaydırılamayıp alt satırlar kesiliyordu. Kesin yükseklikle 4
                  kategorinin (Genel Bilgiler / İzinler / Hak Ediş / Finans) ve hem Mavi
                  hem Beyaz Yaka ekranlarının düzenleme penceresi aşağıya kaydırılabilir. */}
              <div className="shrink-0 overflow-hidden p-3 h-[calc(88vh-120px)]">
                {tabloRender(duzenlemeKategori, true)}
              </div>
              <div className="p-3 border-t border-neutral-200 shrink-0">
                <button onClick={() => setDuzenlemeKategori(null)}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl transition flex justify-center items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Kaydet ve Kapat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export const PersonelMuhasebeView = ({ personnelList, db, appId, addSystemLog, currentUser }) => {
    const [collarType, setCollarType] = useState('Mavi Yaka');
    const [activeSubTab, setActiveSubTab] = useState('puantaj');

    return (
      <div className="flex flex-col gap-4 h-full animate-in fade-in">
         {/* Üst Kısım: Yaka Seçimi */}
         <div className="bg-white p-2 rounded-2xl shadow-sm border border-neutral-200 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
           <button
              onClick={() => setCollarType('Mavi Yaka')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${collarType === 'Mavi Yaka' ? 'bg-black text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
           >
              <Users className="w-5 h-5 shrink-0" /> Mavi Yaka Muhasebe
           </button>
           <button
              onClick={() => setCollarType('Beyaz Yaka')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${collarType === 'Beyaz Yaka' ? 'bg-black text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
           >
              <Briefcase className="w-5 h-5 shrink-0" /> Beyaz Yaka Muhasebe
           </button>
         </div>

         {/* Alt Kısım: Sekme Seçimi */}
         <div className="bg-white p-2 rounded-2xl shadow-sm border border-neutral-200 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
           <button
              onClick={() => setActiveSubTab('puantaj')}
              className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${activeSubTab === 'puantaj' ? 'bg-red-600 text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}
           >
              <CalendarDays className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">{collarType} Puantaj</span>
           </button>
           <button
              onClick={() => setActiveSubTab('mesai')}
              className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${activeSubTab === 'mesai' ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}
           >
              <Clock className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">{collarType} Mesai</span>
           </button>
           <button
              onClick={() => setActiveSubTab('maas')}
              className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${activeSubTab === 'maas' ? 'bg-green-600 text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}
           >
              <DollarSign className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">{collarType} Maaş</span>
           </button>
         </div>

         <div className="flex-1 w-full relative">
           {activeSubTab === 'puantaj' && <PuantajView collarType={collarType} personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
           {activeSubTab === 'mesai' && <MesaiView collarType={collarType} personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
           {activeSubTab === 'maas' && <MaasView collarType={collarType} personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} currentUser={currentUser} />}
         </div>
      </div>
    );
  };

  export const PersonelOdemeView = ({ personnelList, db, appId, addSystemLog, currentUser }) => {
    const today = new Date();
    const [collarType, setCollarType] = useState('Mavi Yaka');
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [maasData, setMaasData] = useState({});
    const [mesaiData, setMesaiData] = useState({});
    
    const [bankInfo, setBankInfo] = useState({
      kurumKodu: '598551',
      subeKodu: '137',
      hesapNo: '6289441',
      odemeTarihi: today.toISOString().split('T')[0],
      odemeTipi: 'MAAŞ (M)',
      borcIzahat: 'MAAŞ ÖDEMESİ'
    });

    const [activeTab, setActiveTab] = useState('Resmi Avans Ödemesi');
    const [selectedPersonnel, setSelectedPersonnel] = useState([]);
    // YENİ: Personel arama — listede isme göre filtreleme (3 sekmede de geçerli)
    const [personelArama, setPersonelArama] = useState('');

    // ========================================================================
    // YENİ (kullanıcı talebi): TOPLU AVANS GİRİŞİ
    // ========================================================================
    // "Resmi Avans Ödemesi" sekmesinde açılan pencere. Bölümdeki (Mavi/Beyaz
    // Yaka) tüm personeli listeler; toplu seçim yapılıp tek tutar uygulanabilir
    // veya her personele ayrı tutar yazılabilir. Mevcut avansı olanlar dolu
    // gelir; üzerine yazılarak düzenlenir. Kaydet, maas dokümanındaki
    // resmiAvans alanına yazar — yani Muhasebe ekranındaki avans hücresiyle
    // AYNI veridir. Kaydedildiği an alttaki Avans Listesi'nde görünür.
    // Mavi ve Beyaz Yaka'da aynı şekilde çalışır (doküman adı collarType'a
    // göre değişir: 'YYYY_M' veya 'beyaz_YYYY_M').
    // ========================================================================
    const [topluAvansAcik, setTopluAvansAcik] = useState(false);
    const [topluAvansSecim, setTopluAvansSecim] = useState([]);   // seçili personel id'leri
    const [topluAvansTutarlar, setTopluAvansTutarlar] = useState({}); // { personId: 'tutar' }
    const [topluAvansToplu, setTopluAvansToplu] = useState('');   // seçililere uygulanacak tek tutar
    const [topluAvansArama, setTopluAvansArama] = useState('');
    const [topluAvansKaydediliyor, setTopluAvansKaydediliyor] = useState(false);

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const years = Array.from({ length: 10 }, (_, i) => 2024 + i);

    useEffect(() => {
      const fetchData = async () => {
        if (!db || !appId) return;
        const docPrefix = collarType === 'Mavi Yaka' ? '' : 'beyaz_';
        try {
          const maasRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${docPrefix}${currentYear}_${currentMonth}`);
          const maasSnap = await getDoc(maasRef);
          if (maasSnap.exists()) setMaasData(maasSnap.data().records || {});
          else setMaasData({});

          const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${currentYear}_${currentMonth}`);
          const mesaiSnap = await getDoc(mesaiRef);
          if (mesaiSnap.exists()) setMesaiData(mesaiSnap.data().records || {});
          else setMesaiData({});
        } catch (e) {
          console.error("Veri yüklenirken hata:", e);
        }
      };
      fetchData();
    }, [currentMonth, currentYear, db, appId, collarType]);

    const targetPersonnelList = personnelList.filter(p => {
      if (!isPersonnelVisibleInMonth(p, currentYear, currentMonth) || p.position === 'Firma Sahibi') return false;
      // YENİ: Banka Parası 0 veya boş olan personel bu listede GÖSTERİLMEZ.
      // Personel kartındaki "Banka Parası (Aylık TL)" alanına değer girildiği anda
      // burada otomatik görünmeye başlar. (Mavi ve Beyaz Yaka için geçerlidir.)
      if (!(parseFloat(p.bankaParasi) > 0)) return false;
      return collarType === 'Mavi Yaka' 
        ? (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
        : (p.collarType === 'Beyaz Yaka' || (!p.collarType && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
    }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'));

    const calcRow = (personId) => {
      const person = targetPersonnelList.find(p => p.id === personId) || {};
      const row = maasData[personId] || {};
      const record = mesaiData[personId] || {};
      
      let devamsiz = 0, raporCount = 0, ucretsizIzinCount = 0;
      Object.values(record).forEach(val => {
          let st = typeof val === 'object' && val !== null ? val.status : val;
          if (st === 'D') devamsiz++;
          else if (st === 'R') raporCount++;
          else if (st === 'Üİ') ucretsizIzinCount++;
      });

      const devamsizlikSayisi = row.devamsizlik !== undefined && row.devamsizlik !== '' ? parseFloat(row.devamsizlik) : devamsiz;
      const rapor = row.rapor !== undefined && row.rapor !== '' ? parseFloat(row.rapor) : raporCount;
      const ucretsizIzinSayisi = ucretsizIzinCount;

      // YENİ: İŞE GİRİŞ günleri (işe başlangıç öncesi) ücretsiz izin gibi sayılır (o günler için ödeme yok)
      let iseGirisGunSayisi = 0;
      if (person.startDate) {
        const _s = new Date(person.startDate + 'T00:00:00');
        if (!isNaN(_s.getTime())) {
          const _daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
          const _startMidnight = new Date(_s.getFullYear(), _s.getMonth(), _s.getDate());
          for (let _d = 1; _d <= _daysInMonth; _d++) {
            if (new Date(currentYear, currentMonth - 1, _d) < _startMidnight) iseGirisGunSayisi++;
          }
        }
      }

      const mesaiGunSayisi = Math.max(0, 30 - rapor - devamsizlikSayisi - ucretsizIzinSayisi - iseGirisGunSayisi);
      const odenecekGun = mesaiGunSayisi;
      
      const bankaParasiBase = parseFloat(person.bankaParasi) || 0;
      const hesaplananBanka = (bankaParasiBase / 30) * odenecekGun;
      
      const resmiAvans = parseFloat(row.resmiAvans) || 0;
      const icraKesintisi = person.icrasiVar === 'Evet' ? (hesaplananBanka / 4) : 0;
      const bankaKalan = hesaplananBanka - icraKesintisi - resmiAvans;
      
      const yol = parseFloat(row.yol !== undefined && row.yol !== '' ? row.yol : person.yol) || 0;

      return {
          resmiAvans: resmiAvans,
          bankaKalan: bankaKalan,
          yol: yol
      };
    };

    const getAmountForTab = (personId) => {
        const c = calcRow(personId);
        if (activeTab === 'Resmi Avans Ödemesi') return c.resmiAvans;
        if (activeTab === 'Kalan Banka Ödemesi') return c.bankaKalan;
        if (activeTab === 'Yol Parası Ödemesi') return c.yol;
        return 0;
    };

    // YENİ: Arama kutusuna göre + BULUNULAN SEKMENİN TUTARI 0'DAN BÜYÜK olan
    // personel görüntülenir. Örn. "Resmi Avans Ödemesi" sekmesindeyken avansı
    // 0 olan personel listede GÖRÜNMEZ; Maaş tablosuna avans girildiği an
    // (rakam 0'dan büyük olduğu an) otomatik olarak burada belirir. Bu kural
    // her 3 sekmede de (Resmi Avans / Kalan Banka / Yol Parası) aynı şekilde
    // ve hem Mavi hem Beyaz Yaka için geçerlidir. Seçimler ve indirme yalnızca
    // görünen (tutarı 0'dan büyük olan) personel üzerinden çalışır.
    const goruntulenenPersonel = targetPersonnelList.filter(p => {
      const q = personelArama.trim().toLocaleLowerCase('tr-TR');
      const aramaUyumlu = !q || (p.fullName || '').toLocaleLowerCase('tr-TR').includes(q);
      const tutarUyumlu = getAmountForTab(p.id) > 0;
      return aramaUyumlu && tutarUyumlu;
    });

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Arama aktifse yalnızca görünen (filtrelenmiş) personel seçilir
            setSelectedPersonnel(goruntulenenPersonel.map(p => p.id));
        } else {
            setSelectedPersonnel([]);
        }
    };

    const handleSelectPerson = (id) => {
        if (selectedPersonnel.includes(id)) {
            setSelectedPersonnel(selectedPersonnel.filter(pId => pId !== id));
        } else {
            setSelectedPersonnel([...selectedPersonnel, id]);
        }
    };

    // Toplu avans penceresini açar: bölümdeki tüm personelin MEVCUT avansı
    // forma yüklenir, avansı olanlar baştan seçili gelir (düzenleme kolaylığı).
    const topluAvansAc = () => {
        const baslangic = {};
        const seciliBaslangic = [];
        targetPersonnelList.forEach(p => {
            const mevcut = parseFloat((maasData[p.id] || {}).resmiAvans) || 0;
            baslangic[p.id] = mevcut > 0 ? String(mevcut) : '';
            if (mevcut > 0) seciliBaslangic.push(p.id);
        });
        setTopluAvansTutarlar(baslangic);
        setTopluAvansSecim(seciliBaslangic);
        setTopluAvansToplu('');
        setTopluAvansArama('');
        setTopluAvansAcik(true);
    };

    // Üstteki tek tutarı SEÇİLİ personelin hepsine yazar (toplu doldurma)
    const topluAvansUygula = () => {
        const t = topluAvansToplu.trim();
        if (topluAvansSecim.length === 0) { alert('Önce personel seçin.'); return; }
        if (!(parseFloat(t) >= 0)) { alert('Geçerli bir tutar girin.'); return; }
        setTopluAvansTutarlar(onceki => {
            const yeni = { ...onceki };
            topluAvansSecim.forEach(id => { yeni[id] = t; });
            return yeni;
        });
    };

    // KAYDET: yalnızca SEÇİLİ personelin resmiAvans değeri maas dokümanına
    // yazılır. Seçilmeyenlere dokunulmaz (yanlışlıkla sıfırlanma olmasın).
    // Tutarı boş bırakılan seçili personelin avansı temizlenir.
    const topluAvansKaydet = async () => {
        if (topluAvansSecim.length === 0) { alert('Kaydedilecek personel seçin.'); return; }
        setTopluAvansKaydediliyor(true);
        try {
            const docPrefix = collarType === 'Mavi Yaka' ? '' : 'beyaz_';
            const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${docPrefix}${currentYear}_${currentMonth}`);
            const mSnap = await getDoc(mRef);
            const records = mSnap.exists() ? (mSnap.data().records || {}) : {};
            let toplam = 0;
            topluAvansSecim.forEach(id => {
                if (!records[id]) records[id] = {};
                const ham = (topluAvansTutarlar[id] ?? '').toString().trim();
                const deger = parseFloat(ham);
                // Boş veya 0 girildiyse avans kaldırılır
                records[id].resmiAvans = (ham === '' || !(deger > 0)) ? '' : String(deger);
                if (deger > 0) toplam += deger;
            });
            await setDoc(mRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
            // Ekrandaki liste anında tazelensin diye yerel durum da güncellenir
            setMaasData(records);
            addSystemLog?.('Toplu Avans Girişi',
                `${collarType} — ${monthNames[currentMonth - 1]} ${currentYear}: ${topluAvansSecim.length} personele toplam ₺${toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} resmi avans işlendi.`);
            setTopluAvansAcik(false);
        } catch (e) {
            console.error('Toplu avans kaydedilemedi:', e);
            alert('Toplu avans kaydedilemedi. Lütfen tekrar deneyin.');
        } finally { setTopluAvansKaydediliyor(false); }
    };

    const handleDownloadCSV = async () => {
        if (selectedPersonnel.length === 0) {
            alert("Lütfen en az bir personel seçin.");
            return;
        }

        let toplamAdet = selectedPersonnel.length;
        // YENİ: Çıktı artık doğrudan banka Excel şablonu (aşağıdaki aoa dizisi) olarak
        // üretiliyor; burada sadece "Toplam Tutar" bilgisi için toplam hesaplanır.
        let toplamTutar = 0;
        selectedPersonnel.forEach(id => {
            const person = targetPersonnelList.find(p => p.id === id);
            if (person) toplamTutar += getAmountForTab(id);
        });

        // Tarih formatını (Örn: 2026-06-20) GGAAYYYY formatına (Örn: 20062026) çevirme
        let odemeTarihiFormatted = bankInfo.odemeTarihi;
        if(odemeTarihiFormatted && odemeTarihiFormatted.includes('-')) {
            const parts = odemeTarihiFormatted.split('-');
            odemeTarihiFormatted = `${parts[2]}${parts[1]}${parts[0]}`;
        }

        // Ödeme tipi harfini ayıklama (Sadece baş harf - M, N, Z vb.)
        let odemeTipiFormatted = bankInfo.odemeTipi;
        if (odemeTipiFormatted === 'MAAŞ (M)') odemeTipiFormatted = 'M';
        else if (odemeTipiFormatted === 'AVANS') odemeTipiFormatted = 'N';
        else if (odemeTipiFormatted === 'DİĞER') odemeTipiFormatted = 'Z';

        // Toplam Tutar formatı: Noktasız, küsurat için virgül
        let toplamTutarStr = toplamTutar.toFixed(2).replace('.', ',');
        if (toplamTutarStr.endsWith(',00')) {
            toplamTutarStr = toplamTutar.toString();
        }

        // ====================================================================
        // TAMAMEN YENİLENDİ: ÇIKTI ARTIK BANKANIN ORİJİNAL ŞABLONUNUN KENDİSİ
        // ====================================================================
        // ESKİ YÖNTEMİN SORUNU: Dosya SheetJS ile SIFIRDAN kuruluyordu. SheetJS'in
        // ücretsiz sürümü stil yazamadığı için fontlar (Times New Roman /
        // Courier New), renkler (yeşil başlıklar), birleşik hücreler, veri
        // doğrulama kuralları ve formüller ÜRETİLEMİYORDU. Banka bu yüzden
        // dosyayı reddediyordu.
        //
        // YENİ YÖNTEM: Bankanın kabul ettiği orijinal .xlsx dosyası base64
        // olarak uygulamaya gömülü (shared.jsx > GARANTI_MAAS_SABLON_BASE64).
        // Dosya bir ZIP arşividir; fflate ile açılır, içindeki sheet1.xml'de
        // YALNIZCA şu hücreler değiştirilir:
        //   B1-B2-B3 (kurum/şube/hesap) · B7 (tarih) · B8 (tip) · B9 (izahat)
        //   B4-B5 (adet/toplam formülleri korunur, önbellek değeri güncellenir)
        //   13. satırdan itibaren personel satırları (İsim + IBAN + Tutar)
        // Fontlar, renkler, sütun genişlikleri, birleşik hücreler, açıklama
        // balonları ve veri doğrulama kuralları dosyanın içinde HAZIR olduğu
        // için çıktı şablondan hiçbir şekilde sapamaz.
        // ====================================================================
        try {
          // fflate: küçük ve hızlı zip kütüphanesi (ilk indirmede CDN'den bir kez yüklenir)
          const { unzipSync, zipSync, strToU8, strFromU8 } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm');

          // --- Base64 şablonu byte dizisine çevir ---
          const ham = atob(GARANTI_MAAS_SABLON_BASE64);
          const bayt = new Uint8Array(ham.length);
          for (let i = 0; i < ham.length; i++) bayt[i] = ham.charCodeAt(i);
          const files = unzipSync(bayt);

          // --- XML yardımcıları ---
          // Özel karakter kaçışı (& < > " ') — Türkçe karakterler UTF-8 olarak aynen kalır
          const xmlKacir = (s) => String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
          // Bir satırın tamamını yenisiyle değiştirir (boş/self-closing veya dolu)
          const satirDegistir = (x, rowNo, yeni) => {
            const re = new RegExp(`<row r="${rowNo}"[^>]*/>|<row r="${rowNo}"[^>]*>[\\s\\S]*?</row>`);
            if (!re.test(x)) throw new Error(`Şablonda ${rowNo}. satır bulunamadı`);
            return x.replace(re, yeni);
          };
          // Tek bir hücreyi yenisiyle değiştirir
          const hucreDegistir = (x, ref, yeni) => {
            const re = new RegExp(`<c r="${ref}"[^>]*/>|<c r="${ref}"[^>]*>[\\s\\S]*?</c>`);
            if (!re.test(x)) throw new Error(`Şablonda ${ref} hücresi bulunamadı`);
            return x.replace(re, yeni);
          };
          // Metin hücresi (inline string) ve sayı/metin otomatik seçimi
          const metinHucre = (ref, s, deger) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlKacir(deger)}</t></is></c>`;
          const akilliHucre = (ref, s, deger) => /^\d+$/.test(String(deger).trim())
            ? `<c r="${ref}" s="${s}"><v>${String(deger).trim()}</v></c>`
            : metinHucre(ref, s, deger);

          let xml = strFromU8(files['xl/worksheets/sheet1.xml']);

          // --- 1) ÜST BİLGİ HÜCRELERİ (stil numaraları şablondan birebir) ---
          xml = hucreDegistir(xml, 'B1', akilliHucre('B1', 2, bankInfo.kurumKodu));  // Kurum Kodu
          xml = hucreDegistir(xml, 'B2', akilliHucre('B2', 2, bankInfo.subeKodu));   // Şube Kodu
          xml = hucreDegistir(xml, 'B3', akilliHucre('B3', 2, bankInfo.hesapNo));    // Hesap No
          // B4 Toplam Adet / B5 Toplam Tutar: FORMÜLLER korunur, yalnızca
          // Excel açılmadan da doğru görünsün diye önbellek değeri güncellenir
          xml = hucreDegistir(xml, 'B4', `<c r="B4" s="2"><f>COUNTA(A:A)-12+COUNTBLANK(A1:A12)</f><v>${toplamAdet}</v></c>`);
          const toplamYuvarlak = Math.round(toplamTutar * 100) / 100;
          xml = hucreDegistir(xml, 'B5', `<c r="B5" s="8"><f>SUM(G:G)</f><v>${toplamYuvarlak}</v></c>`);
          xml = hucreDegistir(xml, 'B7', metinHucre('B7', 9, odemeTarihiFormatted)); // GGAAYYYY
          xml = hucreDegistir(xml, 'B8', metinHucre('B8', 2, odemeTipiFormatted));   // M / N / Z
          xml = hucreDegistir(xml, 'B9', metinHucre('B9', 38, bankInfo.borcIzahat)); // Borç İzahat

          // --- 2) PERSONEL SATIRLARI (13. satırdan itibaren) ---
          // Stil numaraları şablonun kendi veri satırlarından birebir alındı:
          //   13. satır: A=19, H=25  |  sonrakiler: A=20, H=20 (kenarlık farkı)
          const secilenler = selectedPersonnel
            .map(id => targetPersonnelList.find(p => p.id === id))
            .filter(Boolean);
          const veriSatiri = (i, person) => {
            const aStil = i === 13 ? 19 : 20;
            const hStil = i === 13 ? 25 : 20;
            const iban = person.iban ? person.iban.replace(/\s+/g, '') : '';
            const tckn = person.tcNo ? person.tcNo.replace(/\s+/g, '') : '';
            const tutar = Math.round(getAmountForTab(person.id) * 100) / 100;
            return `<row r="${i}" spans="1:12" ht="14.25" customHeight="1" x14ac:dyDescent="0.25">` +
              metinHucre(`A${i}`, aStil, person.fullName) +
              (tckn ? metinHucre(`B${i}`, 20, tckn) : `<c r="B${i}" s="20"/>`) +
              `<c r="C${i}" s="21"/><c r="D${i}" s="22"/><c r="E${i}" s="23"/>` +
              metinHucre(`F${i}`, 24, iban) +
              `<c r="G${i}" s="24"><v>${tutar}</v></c>` +
              `<c r="H${i}" s="${hStil}"/><c r="I${i}" s="25"/><c r="J${i}" s="29"/><c r="K${i}" s="30"/><c r="L${i}" s="30"/></row>`;
          };
          const bosSatir = (i) => `<row r="${i}" spans="1:12" ht="14.25" customHeight="1" x14ac:dyDescent="0.25"/>`;

          // 13'ten başlayarak personel satırları yazılır; şablonda dolu kalan
          // eski satırlar (24'e kadar) boş satırla değiştirilir ki şablondaki
          // örnek kişiler çıktıya sızmasın.
          const temizlenecekSon = Math.max(24, 12 + secilenler.length);
          for (let i = 13; i <= temizlenecekSon; i++) {
            const idx = i - 13;
            xml = satirDegistir(xml, i, idx < secilenler.length ? veriSatiri(i, secilenler[idx]) : bosSatir(i));
          }

          files['xl/worksheets/sheet1.xml'] = strToU8(xml);

          // --- 3) calcChain TEMİZLİĞİ ---
          // Şablonun calcChain'i, boşalttığımız J14/J16 formül hücrelerine işaret
          // ediyor; formülü kalmayan hücreye işaret Excel'de "onarım" uyarısı
          // çıkarabilir. calcChain silinirse Excel açılışta sessizce yeniden
          // kurar — standart ve güvenli yöntem. İlgili kayıt ve ilişki de silinir.
          delete files['xl/calcChain.xml'];
          files['[Content_Types].xml'] = strToU8(
            strFromU8(files['[Content_Types].xml']).replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, '')
          );
          files['xl/_rels/workbook.xml.rels'] = strToU8(
            strFromU8(files['xl/_rels/workbook.xml.rels']).replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/, '')
          );

          // --- 4) ZIP'e geri paketle ve indir ---
          const zipBayt = zipSync(files, { level: 6 });
          const blob = new Blob([zipBayt], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

          const sekmeDosyaAdi = {
            'Resmi Avans Ödemesi': 'Avans Listesi',
            'Kalan Banka Ödemesi': 'Kalan Banka Listesi',
            'Yol Parası Ödemesi': 'Yol Parası Listesi'
          }[activeTab] || activeTab;
          const dosyaAdi = `${collarType} ${monthNames[currentMonth - 1]} ${currentYear} ${sekmeDosyaAdi}.xlsx`;

          // Tarayıcıda indirme tetikleme (SheetJS writeFile'ın karşılığı)
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = dosyaAdi;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          addSystemLog('Banka Excel İndirildi', `${collarType} ${activeTab} için toplu ödeme Excel dosyası oluşturuldu. (${selectedPersonnel.length} Kişi)`);
        } catch (err) {
          console.error('XLSX oluşturma hatası:', err);
          alert('Excel dosyası oluşturulamadı (internet bağlantısını kontrol edin). Hata: ' + err.message);
        }
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* YENİ EKLENEN YAKA SEÇİMİ */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-neutral-200 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
           <button
              onClick={() => { setCollarType('Mavi Yaka'); setSelectedPersonnel([]); }}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${collarType === 'Mavi Yaka' ? 'bg-black text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
           >
              <Users className="w-5 h-5 shrink-0" /> Mavi Yaka Ödemeleri
           </button>
           <button
              onClick={() => { setCollarType('Beyaz Yaka'); setSelectedPersonnel([]); }}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition flex items-center justify-center gap-2 ${collarType === 'Beyaz Yaka' ? 'bg-black text-white shadow-md' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
           >
              <Briefcase className="w-5 h-5 shrink-0" /> Beyaz Yaka Ödemeleri
           </button>
        </div>

        <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-sm font-medium text-green-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
            <p>Bu alandan personellerin maaş, yol veya avans ödemelerini toplu bir şekilde gerçekleştirmek için bankanın orijinal Excel şablonuyla birebir aynı formatta dosya indirebilirsiniz. <b>Burada girilen tutarlar, doğrudan seçili dönemin "{collarType}" Maaş Tablosuna işlenir.</b> İstediğiniz personeli listeden seçip/çıkarabilirsiniz.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-100 pb-3">
                <Landmark className="w-5 h-5 text-neutral-600" /> Banka ve Ödeme Bilgileri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">Kurum Kodu</label>
                    <input type="text" value={bankInfo.kurumKodu} onChange={e => setBankInfo({...bankInfo, kurumKodu: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">Şube Kodu</label>
                    <input type="text" value={bankInfo.subeKodu} onChange={e => setBankInfo({...bankInfo, subeKodu: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">Hesap No</label>
                    <input type="text" value={bankInfo.hesapNo} onChange={e => setBankInfo({...bankInfo, hesapNo: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">Ödeme Tarihi</label>
                    <input type="date" value={bankInfo.odemeTarihi} onChange={e => setBankInfo({...bankInfo, odemeTarihi: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">Ödeme Tipi</label>
                    <select value={bankInfo.odemeTipi} onChange={e => setBankInfo({...bankInfo, odemeTipi: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-bold bg-white text-black">
                        <option value="MAAŞ (M)">MAAŞ (M)</option>
                        <option value="AVANS">AVANS</option>
                        <option value="DİĞER">DİĞER</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">Borç İzahat (Açıklama)</label>
                    <input type="text" value={bankInfo.borcIzahat} onChange={e => setBankInfo({...bankInfo, borcIzahat: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-bold text-black" />
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-neutral-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-black text-lg">{collarType} Ödeme Listesi</h3>
                  <div className="flex items-center gap-2">
                      <select value={currentMonth} onChange={e => setCurrentMonth(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-green-600 cursor-pointer text-xs">
                      {monthNames.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                      <select value={currentYear} onChange={e => setCurrentYear(parseInt(e.target.value))} className="p-2 border border-neutral-300 rounded-lg outline-none font-bold bg-neutral-50 focus:ring-2 focus:ring-green-600 cursor-pointer text-xs">
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* KALDIRILDI (kullanıcı talebi): "Toplu Avans Gir" bu sayfadan
                        kaldırıldı. Avans girişi artık yalnızca Defter → Ödemeler
                        sayfasındaki avans satırlarından yapılır. */}
                    <button onClick={handleDownloadCSV} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-md w-full md:w-auto">
                        <Download className="w-5 h-5" /> Banka Excel Formatında İndir
                    </button>
                </div>
            </div>
            
            <div className="p-3 border-b border-neutral-200 flex gap-2 overflow-x-auto custom-scrollbar bg-white">
                {['Resmi Avans Ödemesi', 'Kalan Banka Ödemesi', 'Yol Parası Ödemesi'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition whitespace-nowrap border ${activeTab === tab ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* YENİ: Personel arama — isme göre anında filtreleme (3 sekmede de geçerli) */}
            <div className="p-3 border-b border-neutral-200 bg-white">
                <div className="relative max-w-sm">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={personelArama}
                        onChange={e => setPersonelArama(e.target.value)}
                        placeholder="Personel adı ile ara..."
                        className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-600 transition"
                    />
                </div>
            </div>

            <div className="overflow-x-auto bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                        <tr>
                            <th className="p-4 w-12 text-center">
                                <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-green-600 focus:ring-green-600 cursor-pointer" onChange={handleSelectAll} checked={goruntulenenPersonel.length > 0 && goruntulenenPersonel.every(p => selectedPersonnel.includes(p.id))} />
                            </th>
                            <th className="p-4 font-black">Personel Adı</th>
                            <th className="p-4 font-black">IBAN</th>
                            <th className="p-4 font-black text-center">Tutar / {activeTab} (TL)</th>
                            <th className="p-4 font-black">Alacak İzahat (Dekont Açıklaması)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {goruntulenenPersonel.map(p => {
                            const amount = getAmountForTab(p.id);
                            return (
                                <tr key={p.id} className="hover:bg-neutral-50 transition">
                                    <td className="p-4 text-center">
                                        <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-green-600 focus:ring-green-600 cursor-pointer" checked={selectedPersonnel.includes(p.id)} onChange={() => handleSelectPerson(p.id)} />
                                    </td>
                                    <td className="p-4 font-bold text-black">{p.fullName}</td>
                                    <td className="p-4 font-mono text-xs text-neutral-600">{p.iban || 'Belirtilmedi'}</td>
                                    <td className="p-4 text-center">
                                        <input type="text" readOnly value={amount > 0 ? amount.toLocaleString('tr-TR', {minimumFractionDigits: 2}) : '0,00'} className="w-28 p-2 border border-neutral-200 rounded-lg text-center font-black text-green-700 bg-neutral-100 outline-none" />
                                    </td>
                                    <td className="p-4">
                                        <input type="text" value={bankInfo.borcIzahat} readOnly className="w-full p-2 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-600 bg-neutral-100 outline-none" />
                                    </td>
                                </tr>
                            )
                        })}
                        {goruntulenenPersonel.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-neutral-500 font-medium">{personelArama.trim() ? 'Aramanıza uygun personel bulunamadı.' : 'Bu listeye uygun personel bulunamadı.'}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* ==================================================================
            YENİ (kullanıcı talebi): TOPLU AVANS GİRİŞ PENCERESİ
            ==================================================================
            Bölümdeki (Mavi/Beyaz Yaka) TÜM personel listelenir — Ödeme
            Listesi'ndeki gibi "avansı 0 olanı gizle" kuralı burada YOKTUR,
            çünkü avansı olmayanlara da avans girmek bu pencerenin asıl amacı.
            Üstteki alan seçili herkese aynı tutarı yazar; satırdaki kutuya
            farklı tutar yazılarak kişiye özel değer verilebilir. Mevcut
            avanslar dolu ve seçili gelir; üzerine yazılınca düzenlenmiş olur.
            Kaydet, maas dokümanındaki resmiAvans alanına yazar; bu alan
            Personel Muhasebe ekranıyla ORTAK olduğundan değişiklik anında
            hem burada (Avans Listesi) hem muhasebede görünür.
            ================================================================== */}
        {topluAvansAcik && (() => {
            const q = topluAvansArama.trim().toLocaleLowerCase('tr-TR');
            const liste = targetPersonnelList.filter(p => !q || (p.fullName || '').toLocaleLowerCase('tr-TR').includes(q));
            const hepsiSecili = liste.length > 0 && liste.every(p => topluAvansSecim.includes(p.id));
            // Kaydedildiğinde işlenecek toplam — pencerenin altında canlı görünür
            const secilenToplam = topluAvansSecim.reduce((t, id) => t + (parseFloat(topluAvansTutarlar[id]) || 0), 0);
            const secimDegistir = (id) => setTopluAvansSecim(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
            return (
                <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
                        {/* BAŞLIK */}
                        <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-2">
                            <div>
                                <h3 className="font-black text-black flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-600" /> Toplu Avans Gir</h3>
                                <p className="text-[11px] font-bold text-neutral-500 mt-0.5">{collarType} • {monthNames[currentMonth - 1]} {currentYear} • Resmi Avans</p>
                            </div>
                            <button onClick={() => setTopluAvansAcik(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
                        </div>

                        {/* TOPLU DOLDURMA + ARAMA */}
                        <div className="p-4 border-b border-neutral-200 bg-neutral-50 space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input type="number" inputMode="decimal" value={topluAvansToplu} onChange={e => setTopluAvansToplu(e.target.value)}
                                    placeholder="Seçili personele uygulanacak tutar (₺)"
                                    className="flex-1 p-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                                <button type="button" onClick={topluAvansUygula}
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition whitespace-nowrap">
                                    Seçililere Uygula ({topluAvansSecim.length})
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input value={topluAvansArama} onChange={e => setTopluAvansArama(e.target.value)}
                                    placeholder="Personel adı ile ara..."
                                    className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" />
                            </div>
                        </div>

                        {/* PERSONEL LİSTESİ */}
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-100 border-b border-neutral-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 w-12 text-center">
                                            <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                checked={hepsiSecili}
                                                onChange={e => setTopluAvansSecim(e.target.checked
                                                    ? Array.from(new Set([...topluAvansSecim, ...liste.map(p => p.id)]))
                                                    : topluAvansSecim.filter(id => !liste.some(p => p.id === id)))} />
                                        </th>
                                        <th className="p-3 font-black text-xs">Personel Adı</th>
                                        <th className="p-3 font-black text-xs text-center">Mevcut Avans</th>
                                        <th className="p-3 font-black text-xs text-center">Yeni Avans (₺)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {liste.map(p => {
                                        const mevcut = parseFloat((maasData[p.id] || {}).resmiAvans) || 0;
                                        const secili = topluAvansSecim.includes(p.id);
                                        return (
                                            <tr key={p.id} className={`transition ${secili ? 'bg-blue-50/60' : 'hover:bg-neutral-50'}`}>
                                                <td className="p-3 text-center">
                                                    <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                        checked={secili} onChange={() => secimDegistir(p.id)} />
                                                </td>
                                                <td className="p-3 font-bold text-black">
                                                    {p.fullName}
                                                    {mevcut > 0 && <span className="ml-1.5 text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">MEVCUT AVANS</span>}
                                                </td>
                                                <td className="p-3 text-center font-black text-xs text-neutral-500 tabular-nums">
                                                    {mevcut > 0 ? `₺${mevcut.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {/* Tutar yazınca personel otomatik seçilir; unutup kaydetmeme riski kalmasın */}
                                                    <input type="number" inputMode="decimal"
                                                        value={topluAvansTutarlar[p.id] ?? ''}
                                                        onChange={e => {
                                                            const v = e.target.value;
                                                            setTopluAvansTutarlar(o => ({ ...o, [p.id]: v }));
                                                            if (v !== '' && !topluAvansSecim.includes(p.id)) setTopluAvansSecim(s => [...s, p.id]);
                                                        }}
                                                        placeholder="0"
                                                        className="w-32 p-2 border border-neutral-300 rounded-lg text-center font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-600" />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {liste.length === 0 && (
                                        <tr><td colSpan="4" className="p-8 text-center text-neutral-500 font-medium">Aramanıza uygun personel bulunamadı.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ALT ÖZET + KAYDET */}
                        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs font-black text-neutral-600">
                                {topluAvansSecim.length} personel seçili • Toplam: <span className="text-blue-700">₺{secilenToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setTopluAvansAcik(false)}
                                    className="px-4 py-2.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-sm font-black rounded-xl transition">Vazgeç</button>
                                <button onClick={topluAvansKaydet} disabled={topluAvansKaydediliyor}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition">
                                    {topluAvansKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        })()}
      </div>
    );
  };
  // ==========================================================================
  // YENİ: DEFTER — Cari hesap / kasa defteri sistemi.
  // Videodaki "Defterler" uygulamasıyla aynı mantık: her kasa/cari/kişi için
  // ayrı bir defter açılır; her deftere "PARA GİRİŞİ (ALDIM)" ve "PARA ÇIKIŞI
  // (VERDİM)" işlemleri girilir. Bakiye yeşil (alacaklısınız / kasada var) veya
  // kırmızı (borçlusunuz) görünür. İşlemlere kategori + serbest etiketler
  // eklenir; defter detayında kategori dağılımı çubuklarla raporlanır.
  // Tüm veriler Firestore'da tutulur; ileride CRM'in diğer modüllerinden
  // (maaş, iş geliri vb.) otomatik kayıt aktarmak için defterIslemleri
  // koleksiyonuna kaynak etiketiyle addDoc yapmak yeterlidir.
  // ==========================================================================
  // ===========================================================================
  // YENİ: MAAŞ KİŞİ HESABI (modül düzeyi)
  // ===========================================================================
  // FinansRaporView içindeki hesaplaKisiAy ile BİREBİR AYNI formüllerdir;
  // Ödemeler defterindeki otomatik maaş satırları da aynı rakamları üretsin
  // diye buraya kopyalandı. (O fonksiyon bileşen içinde tanımlı olduğu için
  // DefterView'dan doğrudan çağrılamıyor; davranışı bozmamak adına mevcut
  // kod taşınmadı, kopyalandı. Formül değişecekse İKİ YERDE birden değişmeli.)
  // Döndürdükleri: bankaKalan (banka tarafının ödenmemiş kısmı), kalanNakit
  // (nakit tarafı) ve tik alanlarıyla birlikte "muhasebede kapatılmamış" tutar.
  // ===========================================================================
  const maasKisiHesabi = (person, row, mesaiRecord, yil, ay) => {
    let devamsiz = 0, raporSay = 0, ucretsizIzin = 0, toplamMesaiSaati = 0, fazlaGun = 0;
    Object.values(mesaiRecord || {}).forEach(val => {
      if (typeof val === 'object' && val !== null) {
        if (val.status === 'D') devamsiz++;
        else if (val.status === 'R') raporSay++;
        else if (val.status === 'Üİ' || val.status === 'İB') ucretsizIzin++;
        else if (val.status === 'FG') fazlaGun++;
        else if (val.status === 'FGM') { fazlaGun++; toplamMesaiSaati += saatMetniSayiyaCevir(val.hours); }
        else if (val.status === 'FM') toplamMesaiSaati += saatMetniSayiyaCevir(val.hours);
        else if (val.status === 'EM') toplamMesaiSaati -= saatMetniSayiyaCevir(val.hours);
      } else {
        if (val === 'D') devamsiz++;
        else if (val === 'R') raporSay++;
        else if (val === 'Üİ' || val === 'İB') ucretsizIzin++;
        else if (val === 'FG') fazlaGun++;
        else if (val === 'FGM') fazlaGun++;
      }
    });
    const devamsizlikSayisi = row.devamsizlik !== undefined && row.devamsizlik !== '' ? parseFloat(row.devamsizlik) : devamsiz;
    const rapor = row.rapor !== undefined && row.rapor !== '' ? parseFloat(row.rapor) : raporSay;
    const fazlaGunSayisi = row.fazlaGun !== undefined && row.fazlaGun !== '' ? parseFloat(row.fazlaGun) : fazlaGun;
    let iseGirisGun = 0;
    if (person.startDate) {
      const st = new Date(person.startDate + 'T00:00:00');
      if (!isNaN(st.getTime())) {
        const ayGunSayisi = new Date(yil, ay, 0).getDate();
        const baslangic = new Date(st.getFullYear(), st.getMonth(), st.getDate());
        for (let d = 1; d <= ayGunSayisi; d++) { if (new Date(yil, ay - 1, d) < baslangic) iseGirisGun++; }
      }
    }
    const mesaiGunSayisi = Math.max(0, 30 - rapor - devamsizlikSayisi - ucretsizIzin - iseGirisGun);
    const maas = parseFloat(row.maas !== undefined && row.maas !== '' ? row.maas : gecerliMaas(person, yil, ay)) || 0;
    const bankaParasiBase = parseFloat(person.bankaParasi) || 0;
    const nakitAvans = parseFloat(row.nakitAvans) || 0;
    const resmiAvans = parseFloat(row.resmiAvans) || 0;
    const prim = parseFloat(row.prim) || 0;
    const hesaplananBanka = (bankaParasiBase / 30) * mesaiGunSayisi;
    const icraKesintisi = person.icrasiVar === 'Evet' ? (hesaplananBanka / 4) : 0;
    const bankaKalan = hesaplananBanka - icraKesintisi - resmiAvans;
    const toplamSaat = toplamMesaiSaati + (fazlaGunSayisi * 10) - (devamsizlikSayisi * 3) + prim;
    const mesaiUcretiToplam = (maas / 200) * toplamSaat;
    const primTL = (maas / 200) * prim;
    const netMaas = (maas / 30) * mesaiGunSayisi;
    const hasarKesinti = Math.min(parseFloat(row.hasarKesinti) || 0, primTL);
    const kalanNakit = netMaas - hesaplananBanka - nakitAvans + mesaiUcretiToplam - hasarKesinti;
    return { bankaKalan, kalanNakit };
  };

  export const FinansDefterView = ({ currentUser, addSystemLog, onViewCari, onViewVehicle, onViewPersonnel, jobs = [], vehicles = [], personnelList = [] }) => {
    // Varsayılan işlem kategorileri (giderler + gelirler bir arada)
    // DEĞİŞİKLİK: Eski sabit kategori listesi KALDIRILDI. Kategoriler artık
    // etiket ağacından gelir (VARSAYILAN_ETIKET_GRUPLARI) + kullanıcının
    // eklediği özel kategoriler (Firestore: settings/defterEtiketleri).
    // Böylece "etiket" ve "kategori" tek kavrama indirildi; işlem formunda
    // ayrı etiket alanı yok. 'İş Geliri' otomatik kayıtların geriye dönük
    // uyumu için korunur (eski kayıtlar bu kategoriyle yazılmıştı).
    // DEĞİŞİKLİK: 'Cari (Kişi/Firma)' -> 'Kredi Kartı', 'Diğer' -> 'Borçlu'.
    // Bu dizi HER İKİ formu da (yeni defter ve defter düzenle) besler; tek
    // yerden değiştirmek yeterlidir.
    // DİKKAT: Bu metinler Firestore'a d.tur alanında DEĞER olarak yazılır.
    // Eski defterlerde hâlâ 'Cari (Kişi/Firma)' / 'Diğer' yazılı olabilir;
    // aşağıdaki ESKI_DEFTER_TURLERI eşlemesi onların rengini ve etiketini korur.
    // DEĞİŞİKLİK: 'Kasa' türünün adı 'Nakit' oldu. Eski defter kayıtlarında
    // d.tur alanında 'Kasa' yazmaya devam eder; defterTuruEtiket eşlemesi
    // onları da 'Nakit' olarak gösterir, veritabanına dokunulmaz.
    const DEFTER_TURLERI = ['Nakit', 'Banka', 'Kredi Kartı', 'Borçlu', 'Kredi', 'Ödemeler'];

    // ========================================================================
    // YENİ: DEFTER BLOKLARI (şirket/grup ayrımı)
    // ========================================================================
    // Defterler artık tek düz liste değil; ait oldukları BLOK'a göre
    // gruplanır ve her grup kendi ince çerçevesi + başlığı içinde görünür.
    // Dizideki SIRA, ekrandaki sırayı belirler (kullanıcı talebi: yazıldığı
    // sıraya göre yukarıdan aşağıya). Blok bilgisi olmayan eski defterler
    // otomatik olarak son bloğa ('Genel') düşer — veri kaybı olmaz.
    const DEFTER_BLOKLARI = ['Sembol Nakliyat', 'Depoevim', 'Genel'];
    const VARSAYILAN_BLOK = 'Genel';
    // Bir defterin bloğunu güvenli biçimde verir (tanımsız/geçersizse Genel)
    const defterBlogu = (d) => DEFTER_BLOKLARI.includes(d?.blok) ? d.blok : VARSAYILAN_BLOK;

    // ========================================================================
    // YENİ: "KREDİ" DEFTER TÜRÜ
    // ========================================================================
    // Diğer türlerden farklı çalışır. Bir kredi defteri açıldığında ana para,
    // toplam geri ödeme, taksit sayısı ve ilk taksit tarihi girilir; sistem
    // taksit planını kendisi üretir. Taksit ödendiğinde İKİ kayıt oluşur:
    //   1) Ödemenin yapıldığı defterde  ÇIKIŞ  (gerçek para çıkışı)
    //   2) Kredi defterinde             GİRİŞ  (borcun azalması — mahsup)
    // İkincisi gerçek bir gelir olmadığı için krediMahsup bayrağıyla
    // ciro toplamlarından dışlanır (virman mantığının aynısı).
    // ========================================================================

    // Eski kayıtları yeni karşılıklarına eşler. Sadece GÖRÜNTÜLEME için kullanılır;
    // Firestore'daki eski veri değiştirilmez, dolayısıyla geçmiş bozulmaz.
    // YENİ: Defter türüne göre SİMGE ve RENK. İkisi tek yerden veriliyor;
    // eskiden renk mantığı iki ayrı yerde tekrarlanıyordu ve biri güncellenip
    // diğeri unutulabiliyordu. Eski tür adları ('Kasa', 'Cari (Kişi/Firma)',
    // 'Diğer') da eşleşir, geçmiş defterler simgesiz/renksiz kalmaz.
    const defterTuruGorunum = (tur) => {
      if (tur === 'Banka') return { Ikon: Landmark, renk: 'bg-blue-600' };
      if (tur === 'Nakit' || tur === 'Kasa') return { Ikon: Banknote, renk: 'bg-emerald-600' };
      if (tur === 'Kredi Kartı' || tur === 'Cari (Kişi/Firma)') return { Ikon: CreditCard, renk: 'bg-amber-500' };
      if (tur === 'Borçlu' || tur === 'Diğer') return { Ikon: UserMinus, renk: 'bg-rose-600' };
      // YENİ: Kredi — mor tema, diğerlerinden net ayrılsın
      if (tur === 'Kredi') return { Ikon: Landmark, renk: 'bg-violet-600' };
      // YENİ: Ödemeler — turuncu tema (kira, sigorta, vergi gibi düzenli giderler)
      if (tur === 'Ödemeler') return { Ikon: CalendarDays, renk: 'bg-orange-600' };
      // Tanınmayan tür: nötr gri + genel defter simgesi
      return { Ikon: BookOpen, renk: 'bg-neutral-500' };
    };

    const defterTuruEtiket = (tur) => {
      if (tur === 'Kasa') return 'Nakit';
      if (tur === 'Cari (Kişi/Firma)') return 'Kredi Kartı';
      if (tur === 'Diğer') return 'Borçlu';
      return tur || '-';
    };
    // ARTIK FORMDA KULLANILMIYOR: "Ödeme Yöntemi" seçicisi "Hesap Türü"ne
    // dönüştürüldü ve seçenekler gerçek defterlerden geliyor. Bu dizi yalnızca
    // referans olarak bırakıldı; kayıtlardaki odemeYontemi değeri artık
    // defterdenOdemeYontemi() ile hesabın türünden türetiliyor.
    // ========================================================================
    // TAŞINDI (KRİTİK HATA DÜZELTMESİ): bugunStr artık bileşenin EN BAŞINDA
    // ========================================================================
    // HATANIN SEBEBİ: bosKrediForm ve bosOdemeKalemi sabitleri tanımlanırken
    // bugunStr() ÇAĞRILIYORDU; ama bugunStr'nin tanımı onlardan YÜZ satır kadar
    // SONRA duruyordu. JavaScript'te const'a tanımından önce erişmek "Cannot
    // access before initialization" hatası verir — canlıda Defter sayfası bu
    // yüzden "Bir şeyler ters gitti / Cannot access 'Ee' before initialization"
    // diyerek hiç açılmıyordu ('Ee', derleyicinin bugunStr'ye verdiği kısa ad).
    // Tanım tüm kullanımların ÖNÜNE taşındı; davranış birebir aynı.
    //
    // DİKKAT: toISOString() kullanılmıyor; o UTC'ye çevirdiği için Türkiye
    // saatinde gece yarısına yakın saatlerde günü bir gün geriye kaydırabiliyor.
    // Bu yüzden yerel tarih parçalarından elle string üretiliyor.
    const bugunStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const ODEME_YONTEMLERI = ['Nakit', 'Banka / Havale', 'Kredi Kartı', 'Çek / Senet', 'Diğer'];

    const [defterler, setDefterler] = useState([]);
    const [islemler, setIslemler] = useState([]);
    const [seciliDefterId, setSeciliDefterId] = useState(null);
    const [arama, setArama] = useState('');

    // Defter oluşturma/düzenleme penceresi
    const [showDefterForm, setShowDefterForm] = useState(false);
    // YENİ: kredi alt nesnesi — yalnızca tur === 'Kredi' iken kullanılır
    const bosKrediForm = { bankaAdi: '', anaPara: '', toplamGeriOdeme: '', taksitSayisi: '', aylikTaksit: '', ilkTaksitTarihi: bugunStr() };
    const [defterForm, setDefterForm] = useState({ ad: '', tur: 'Nakit', not: '', blok: VARSAYILAN_BLOK, kredi: bosKrediForm });
    // YENİ (kullanıcı talebi): DEVİR TUTARI penceresi — { defter, tutar, yon, tarih, not }
    // 1 Eylül 2026'dan itibaren her defterdeki "Devir" düğmesiyle açılır.
    const [devirModal, setDevirModal] = useState(null);
    const [devirKaydediliyor, setDevirKaydediliyor] = useState(false);
    // ========================================================================
    // YENİ (kullanıcı talebi): ALACAK TAKİBİ (BORÇLU DEFTERİ) STATE'LERİ
    // ========================================================================
    // Borçlu defteri artık gelir/gider girişi değil, Ödemeler sayfası gibi
    // bir ALACAK TAKİP modülüdür: borçlular (Personel/Müşteri/Kurum) kalem
    // olarak eklenir, isteğe göre taksitlendirilir, tahsilatta para seçilen
    // hesaba işlenir ve ANCAK O ZAMAN ciroya girer. İcra takibi de buradan.
    const bosAlacakKalemi = { id: '', ad: '', tur: 'musteri', toplamTutar: '', taksitSayisi: '', ilkTarih: bugunStr(), not: '', icra: null };
    const [alacakForm, setAlacakForm] = useState(null);          // null = kapalı
    // YENİ (kullanıcı talebi): Yeni Borçlu formunda Personel/Müşteri arama kutusu
    const [borcluAramaP, setBorcluAramaP] = useState(''); // personel arama metni
    const [borcluAramaM, setBorcluAramaM] = useState(''); // müşteri/cari arama metni
    // YENİ: Personel şirket borçları (maas_yearly'den canlı) — otomatik borçlu
    const [personelBorclari, setPersonelBorclari] = useState({});
    const [tahsilModal, setTahsilModal] = useState(null);        // { kalem, taksit, hedefDefterId, tarih, tutar }
    const [tahsilKaydediliyor, setTahsilKaydediliyor] = useState(false);
    const [alacakAyi, setAlacakAyi] = useState(bugunStr().slice(0, 7));
    const [mevcutBorclularAcik, setMevcutBorclularAcik] = useState(false);
    const [acikAlacakKalemi, setAcikAlacakKalemi] = useState(null);
    // Üç borçlu türü — rozet renkleriyle
    const ALACAK_TURLERI = [
      { id: 'personel', ad: 'Personel', rozet: 'bg-purple-600', yumusak: 'bg-purple-50 border-purple-200', yazi: 'text-purple-700' },
      { id: 'musteri',  ad: 'Müşteri',  rozet: 'bg-emerald-600', yumusak: 'bg-emerald-50 border-emerald-200', yazi: 'text-emerald-700' },
      { id: 'kurum',    ad: 'Kurum',    rozet: 'bg-sky-600', yumusak: 'bg-sky-50 border-sky-200', yazi: 'text-sky-700' },
    ];
    const alacakTuru = (id) => ALACAK_TURLERI.find(t => t.id === id) || ALACAK_TURLERI[1];
    // ========================================================================
    // YENİ (kullanıcı talebi): MOBİL HIZLI KAYIT ÇUBUĞU
    // ========================================================================
    // Telefonda, banka uygulamalarındaki gibi tek satırdan işlem girilir:
    // tutar yazılır, alttaki sekmeden GİDER/GELİR seçilir, KAYDET'e basılır.
    // Kayıt bakılan güne, "Diğer" kategorisiyle anında yazılır; ayrıntı
    // gerekiyorsa sağdaki simge tam formu açar. TRANSFER sekmesi tutarı
    // hazır şekilde virman penceresine taşır.
    const [hizliTip, setHizliTip] = useState('cikis');   // ekran görüntüsündeki gibi GİDER önde
    const [hizliTutar, setHizliTutar] = useState('');
    // YENİ (kullanıcı talebi): rakam yazılınca üstte açılan satırın alanları —
    // Not (açıklama) ve Kategori yan yana.
    const [hizliAciklama, setHizliAciklama] = useState('');
    const [hizliKategori, setHizliKategori] = useState('Diğer');
    // YENİ (kullanıcı talebi): Mobilde kategori seçimi artık pencere ile —
    // alt kategoriler de görünür ve tıklanabilir olsun diye.
    const [hizliKatSecici, setHizliKatSecici] = useState(false);
    const [hizliKaydediliyor, setHizliKaydediliyor] = useState(false);
    // ========================================================================
    // YENİ (kullanıcı talebi): HIZLI KAYIT ÇUBUĞUNU KAYITTAN SONRA YENİDEN AKTİFLEŞTİR
    // ------------------------------------------------------------------------
    // Bir ödeme girişi/çıkışı kaydedildikten sonra tutar kutusu boşalıyordu
    // ama ODAK (focus) kutuda KALMIYORDU — mobilde bu, klavyenin kapanmasına
    // ve kullanıcının bir sonraki tutarı yazabilmek için kutuya TEKRAR
    // dokunması gerekmesine yol açıyordu ("bar tekrar aktif olmuyor" hissi).
    // Bu ref ile kayıttan hemen sonra kutuya programatik olarak yeniden
    // odaklanılır; klavye açık kalır ve aynı ekranda art arda birden fazla
    // gelir/gider girilebilir.
    // ========================================================================
    const hizliTutarInputRef = useRef(null);
    // YENİ (kullanıcı talebi): Satıra tıklanınca Düzenle/Sil düğmeleri açılır.
    // Tek seferde yalnız bir satır açık kalır; tekrar tıklanınca kapanır.
    const [acikIslemId, setAcikIslemId] = useState(null);
    // YENİ: "Yaklaşan İşlemler" akordeonu (mobil kolaylık) — varsayılan kapalı
    const [yaklasanAcik, setYaklasanAcik] = useState(false);

    // ========================================================================
    // YENİ: TAKSİT ÖDEME PENCERESİ
    // ========================================================================
    // { taksit, kaynakDefterId, tarih } — hangi taksit, hangi hesaptan, ne zaman.
    // Ödeme onaylanınca iki kayıt oluşur (bkz. taksitOde).
    const [taksitOdeme, setTaksitOdeme] = useState(null);
    const [taksitKaydediliyor, setTaksitKaydediliyor] = useState(false);

    // ========================================================================
    // YENİ: ÖDEME KALEMİ FORMU ve VADE ÖDEME PENCERESİ
    // ========================================================================
    // YENİ (kullanıcı talebi): ibanlar — bir ödeme kalemine BİRDEN ÇOK IBAN
    // eklenebilir. Her kayıt { id, isim, iban, tur } biçimindedir; tur 'sahsi'
    // veya 'resmi' olur. Boş dizi varsayılan; eski kalemlerde alan hiç yoksa
    // kod her yerde (k.ibanlar || []) diye okuduğu için sorun çıkmaz.
    const bosOdemeKalemi = { id: '', ad: '', tutar: '', ilkTarih: bugunStr(), tekrar: 'aylik', tekrarSayisi: '', not: '', odemeTuru: 'firma', ibanlar: [] };
    const [odemeKalemForm, setOdemeKalemForm] = useState(null); // null = kapalı

    // ========================================================================
    // YENİ (kullanıcı talebi): IBAN YARDIMCILARI
    // ========================================================================
    // Bir ödeme kalemine birden çok IBAN eklenebilir (şahsi/resmi ayrımıyla).
    // Amaç: ödeme yaparken IBAN'ı ve hesap sahibinin adını tek tıkla kopyalayıp
    // bankacılık uygulamasına yapıştırabilmek.
    // ========================================================================
    // Hangi değerin az önce kopyalandığını gösterir (buton "Kopyalandı ✓" olur)
    const [kopyalanan, setKopyalanan] = useState('');
    // IBAN'ı 4'erli gruplar hâlinde okunaklı yazar: TR12 3456 7890 ...
    const ibanGoster = (iban) => (iban || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
    // Panoya kopyalama. navigator.clipboard bazı tarayıcı/HTTP ortamlarında
    // çalışmaz; o yüzden eski usul textarea + execCommand yedeği bırakıldı.
    const panoyaKopyala = async (metin, etiket) => {
      const temiz = (metin || '').toString();
      if (!temiz) return;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(temiz);
        else {
          const ta = document.createElement('textarea');
          ta.value = temiz; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setKopyalanan(etiket);
        setTimeout(() => setKopyalanan(k => (k === etiket ? '' : k)), 1800);
      } catch (e) { console.error('Kopyalanamadı:', e); alert('Kopyalanamadı, elle seçip kopyalayın.'); }
    };
    // Formdaki IBAN satırlarını ekle / güncelle / sil
    const ibanSatirEkle = () => setOdemeKalemForm(f => ({
      ...f,
      ibanlar: [...(f.ibanlar || []), { id: `ib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, isim: '', iban: '', tur: 'resmi' }],
    }));
    const ibanSatirGuncelle = (id, alan, deger) => setOdemeKalemForm(f => ({
      ...f,
      ibanlar: (f.ibanlar || []).map(s => s.id === id ? { ...s, [alan]: deger } : s),
    }));
    const ibanSatirSil = (id) => setOdemeKalemForm(f => ({
      ...f, ibanlar: (f.ibanlar || []).filter(s => s.id !== id),
    }));
    // { kalem, vade, kaynakDefterId, tarih } — hangi kalemin hangi vadesi, nereden
    const [vadeOdeme, setVadeOdeme] = useState(null);
    // Vade listesi açık olan kalemin kimliği (akordiyon)
    // NOT: Türe göre kalem blokları kaldırıldığı için bu state artık
    // kullanılmıyor; kalem açılımı "Otomatik Ödemeler" penceresine taşındı.
    // Silinmedi çünkü ileride kalem detayı geri istenirse hazır duruyor.
    const [acikOdemeKalemi, setAcikOdemeKalemi] = useState(null);

    // YENİ: Kredi kalemi formu ve akordiyon durumu (Ödemeler ile aynı desen)
    const bosKrediKalemi = { id: '', ad: '', bankaAdi: '', anaPara: '', toplamGeriOdeme: '', taksitSayisi: '', aylikTaksit: '', ilkTaksitTarihi: bugunStr(), not: '' };
    const [krediKalemForm, setKrediKalemForm] = useState(null); // null = kapalı
    const [acikKrediKalemi, setAcikKrediKalemi] = useState(null);
    // YENİ (kullanıcı talebi): Kredi sayfası Ödemeler sayfasıyla aynı mantığa
    // geçirildi. krediAyi 'YYYY-MM' biçiminde tutulur; ay gezgini bununla
    // "Ağustos 2026 Kredi Ödemeleri" gibi başlıklar üretir.
    const [krediAyi, setKrediAyi] = useState(bugunStr().slice(0, 7));
    // "Mevcut Krediler" düğmesi: true iken aylık görünüm gizlenir, tüm
    // kredi kartları (taksit planlarıyla birlikte) bu panelde listelenir.
    const [mevcutKredilerAcik, setMevcutKredilerAcik] = useState(false);
    const [editingDefterId, setEditingDefterId] = useState(null);
    const [deleteDefterId, setDeleteDefterId] = useState(null);

    // İşlem ekleme/düzenleme penceresi
    // DÜZELTME: tarih alanı toISOString() ile üretiliyordu; o UTC verdiği için
    // Türkiye'de (UTC+3) gece 00:00-03:00 arası girilen işlem DÜNÜN tarihiyle
    // kaydoluyor ve günlük filtrede bugün altında görünmüyordu. Artık yerel
    // tarih kullanılıyor (bugunStr yukarıda tanımlı).
    // DEĞİŞİKLİK: etiketler artık METİN değil DİZİ. Etiketler serbest yazı
    // yerine seçim penceresinden işaretlendiği için dizi tutmak daha doğru;
    // virgülle ayırma / birleştirme adımları tamamen kalktı.
    // YENİ: Etiket seçim penceresi durumu
    const [showEtiketSecici, setShowEtiketSecici] = useState(false);
    const [etiketArama, setEtiketArama] = useState('');
    // Kullanıcının sonradan eklediği etiketler — Firestore'da saklanır ki
    // bir sonraki işlemde hazır olarak gelsin.
    const [ozelEtiketler, setOzelEtiketler] = useState([]);
    // Hangi grupların açık olduğu. Varsayılanda hepsi kapalı; 88 etiket
    // birden açılırsa pencere okunamaz hale gelir.
    const [acikGruplar, setAcikGruplar] = useState({});
    const [yeniEtiket, setYeniEtiket] = useState('');

    // Özel etiketleri oku (canlı dinleme — başka kullanıcı eklerse hemen görünür)
    useEffect(() => {
      const unsub = onSnapshot(defterEtiketleriRef(db, appId), snap => {
        setOzelEtiketler(snap.exists() ? (snap.data().liste || []) : []);
      }, err => console.error('Etiketler okunamadı:', err));
      return () => unsub();
    }, []);

    // Yeni etiket ekle. Hazır listede veya özel listede varsa tekrar eklenmez.
    const etiketEkle = async () => {
      const ad = yeniEtiket.trim().toLocaleUpperCase('tr-TR');
      if (!ad) return;
      const mevcut = [...tumVarsayilanEtiketler(), ...ozelEtiketler].map(e => e.toLocaleUpperCase('tr-TR'));
      if (mevcut.includes(ad)) {
        // Zaten varsa yeni kayıt açmak yerine doğrudan seçili hale getirilir.
        // Zaten varsa doğrudan kategori olarak seçilir.
        setIslemForm({ ...islemForm, kategori: ad });
        setYeniEtiket('');
        setShowEtiketSecici(false);
        return;
      }
      const yeniListe = [...ozelEtiketler, ad].sort((a, b) => a.localeCompare(b, 'tr-TR'));
      try {
        await setDoc(defterEtiketleriRef(db, appId), { liste: yeniListe, updatedAt: new Date().toISOString() }, { merge: true });
        // Eklenen kategori otomatik seçilir ve pencere kapanır.
        setIslemForm({ ...islemForm, kategori: ad });
        setYeniEtiket('');
        setShowEtiketSecici(false);
        addSystemLog?.('Defter Etiketi Eklendi', `"${ad}" etiketi hazır etiketler listesine eklendi.`);
      } catch (e) {
        console.error('Etiket eklenemedi:', e);
        alert('Etiket eklenemedi. Bağlantınızı kontrol edin.');
      }
    };

    // Özel etiketi listeden kaldır. SADECE kullanıcı eklediği etiketler
    // silinebilir; hazır etiketler kodda tanımlı olduğu için silinmez.
    // Geçmiş işlemlerdeki etiket metni SİLİNMEZ — o kayıtlar bozulmaz.
    const etiketKaldir = async (ad) => {
      if (!window.confirm(`"${ad}" etiketi hazır listeden kaldırılacak. Geçmiş işlemlerdeki etiket yazısı silinmez. Emin misiniz?`)) return;
      const yeniListe = ozelEtiketler.filter(e => e !== ad);
      try {
        await setDoc(defterEtiketleriRef(db, appId), { liste: yeniListe, updatedAt: new Date().toISOString() }, { merge: true });
        addSystemLog?.('Defter Etiketi Kaldırıldı', `"${ad}" etiketi hazır listeden çıkarıldı.`);
      } catch (e) {
        console.error('Etiket kaldırılamadı:', e);
      }
    };

    // Bir etiketi seç / seçimi kaldır
    // DEĞİŞİKLİK: Çoklu etiket seçimi TEK kategori seçimine dönüştü.
    // Bir kategoriye tıklanınca alana yazılır ve pencere kapanır; aynı
    // kategoriye tekrar tıklanırsa seçim kaldırılır.
    const etiketToggle = (ad) => {
      setIslemForm({ ...islemForm, kategori: islemForm.kategori === ad ? '' : ad });
      if (islemForm.kategori !== ad) setShowEtiketSecici(false);
    };

    // DÜZELTME (TDZ HATASI): Bu tarih yardımcıları önce aşağıda,
    // emptyIslem'den SONRA tanımlıydı. Ama emptyIslem satırı bugunStr()'i
    // ÇAĞIRIYOR; const bildirimleri TDZ'de olduğu için tanımlanmadan önce
    // erişim 'Cannot access before initialization' hatası veriyor ve Defter
    // sayfası hiç açılmıyordu. Çözüm: yardımcıları kullanıldıkları yerin
    // ÜSTÜNE taşımak. Fonksiyon gövdeleri değişmedi.
    // YENİ: GÜNLÜK FİLTRE — defter detayında hangi günün hareketleri görünecek.
    // Verilen güne +1 / -1 gün ekler. Ay ve yıl geçişlerini Date nesnesi
    // kendisi hallettiği için 31 Aralık -> 1 Ocak de doğru çalışır.
    const gunKaydir = (gunStr, adet) => {
      const [y, a, g] = gunStr.split('-').map(Number);
      const d = new Date(y, a - 1, g + adet);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Tarih etiketi: "17 Ağustos 2026, Pazartesi"
    const gunEtiketi = (gunStr) => {
      const [y, a, g] = gunStr.split('-').map(Number);
      return new Date(y, a - 1, g).toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric', weekday: 'long'
      });
    };

    const emptyIslem = { tip: 'giris', tutar: '', aciklama: '', kategori: '', etiketler: [], odemeYontemi: 'Nakit', tarih: bugunStr(),
      // YENİ: hedefDefterId — işlemin HANGİ DEFTERDE duracağını belirler.
      // Boşsa o an açık olan defter kullanılır (eski davranış). Düzenleme
      // sırasında değiştirilirse işlem seçilen deftere TAŞINIR.
      hedefDefterId: '',
      // YENİ: MÜŞTERİ (cari) ve ARAÇ alanları — ikisi de OPSİYONEL.
      // Eskiden bu bilgiler açıklama metnine gömülüydü; ayrı alan olunca
      // tıklanabilir, filtrelenebilir ve raporlanabilir hale geliyor.
      musteriAdi: '', musteriTel: '', plaka: '', aracId: '', ekipSefi: '', ekipSefiId: '' };

    // ========================================================================
    // ARAMA NORMALLEŞTİRME — Türkçe karakter toleransı
    // ========================================================================
    // Amaç: "ekrem dirikman", "EKREM DİRİKMAN", "ekrem dırıkman" ve
    // "Ekrem  Dirikman." aynı sonucu vermeli.
    //
    // NEDEN toLocaleLowerCase YETMEZ: Türkçe'de I/ı ve İ/i ayrı harfler.
    // Kullanıcı klavyeden "i" yazarken kayıtta "ı" olabilir (veya tersi).
    // Bu yüzden ı/İ/i/I hepsi 'i'ye indirgenir. Aynı şekilde ş->s, ğ->g,
    // ü->u, ö->o, ç->c. Noktalama ve fazla boşluklar da atılır.
    // DİKKAT — SIRA ÖNEMLİ: Harf dönüşümleri toLowerCase()'den ÖNCE yapılır.
    // Sebep: JavaScript'te 'İ'.toLowerCase() sonucu 'i' DEĞİL, 'i' + U+0307
    // (ayrı birleşik nokta) oluyor. Küçültme önce yapılırsa bu nokta geride
    // kalır, sonraki [^a-z0-9] deseni onu boşluğa çevirir ve kelime bölünür:
    // 'BEŞİNCİ' -> 'besi nci' gibi. Bu yüzden büyük harfler de doğrudan
    // eşlenir, ardından küçültme ve kalan birleşik işaretlerin temizliği gelir.
    const aramaNormalize = (metin) => (metin || '')
      .toString()
      .replace(/[ıİI]/g, 'i')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[âÂ]/g, 'a')
      .replace(/[îÎ]/g, 'i')
      .replace(/[ûÛ]/g, 'u')
      .toLowerCase()
      // Kalan birleşik aksan işaretleri ayrıştırılıp atılır
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Harf ve rakam dışındaki her şey tek boşluğa indirilir (nokta, tire, vs.)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    // Cari (müşteri) arama penceresi
    const [showCariSecici, setShowCariSecici] = useState(false);
    const [cariArama, setCariArama] = useState('');

    // İŞLERDEN benzersiz CARİ listesi. Anahtar telefon numarası; aynı müşteri
    // farklı isim yazımıyla girilmiş olsa bile tek cari sayılır — uygulamanın
    // Müşteri Portföyü ekranı da aynı mantığı kullanıyor, tutarlı olsun diye.
    const cariListesi = useMemo(() => {
      const harita = new Map();
      (jobs || []).forEach(j => {
        const tel = (j.customerPhone || '').replace(/\D/g, '');
        if (!tel) return;
        const mevcut = harita.get(tel);
        if (mevcut) {
          mevcut.isSayisi++;
          // En son işteki isim yazımı esas alınır
          if ((j.date || '') > mevcut.sonTarih) { mevcut.ad = j.customerName || mevcut.ad; mevcut.sonTarih = j.date || ''; }
        } else {
          harita.set(tel, { tel, ad: j.customerName || 'İsimsiz', isSayisi: 1, sonTarih: j.date || '' });
        }
      });
      // Normalleştirilmiş ad ve telefon ÖNCEDEN hesaplanır. 4400+ cari varken
      // her tuş vuruşunda yeniden normalize etmek arama kutusunu yavaşlatırdı.
      return [...harita.values()]
        .map(c => ({ ...c, adNorm: aramaNormalize(c.ad), telNorm: (c.tel || '').replace(/\D/g, '') }))
        .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
    }, [jobs]);
    const [showIslemForm, setShowIslemForm] = useState(false);
    const [islemForm, setIslemForm] = useState(emptyIslem);
    const [editingIslemId, setEditingIslemId] = useState(null);
    const [deleteIslemId, setDeleteIslemId] = useState(null);

    // Detay filtreleri
    const [detayArama, setDetayArama] = useState('');
    const [kategoriFiltre, setKategoriFiltre] = useState('Tümü');


    // Açılışta HER ZAMAN mevcut gün seçilidir.
    const [seciliGun, setSeciliGun] = useState(bugunStr());
    // Günlük filtre açık mı? Kapatılırsa defterin tüm geçmişi listelenir.
    const [gunFiltreAktif, setGunFiltreAktif] = useState(true);
    // YENİ: "Tüm Geçmiş" modunda sayfalama. Bir defterde binlerce hareket
    // olabildiği için hepsi birden çizilmez; 50'şer açılır.
    const SAYFA_BOYU = 50;
    const [gosterilenSayi, setGosterilenSayi] = useState(SAYFA_BOYU);
    // YENİ: HAREKET TÜRÜ FİLTRESİ — 'tumu' | 'giris' | 'cikis' | 'transfer'
    // Defterde yalnızca gelirleri, yalnızca giderleri ya da yalnızca hesaplar
    // arası transferleri görmek için. Transfer kayıtları isVirman bayrağıyla
    // işaretli olduğu için gelir/gider filtrelerinde dışarıda bırakılır —
    // aksi halde bir transfer hem "gelir" hem "gider" listesinde çıkardı.
    const [hareketFiltre, setHareketFiltre] = useState('tumu');
    // Defter değişince, arama yapılınca veya kategori filtresi değişince
    // sayaç başa sarılır. Aksi halde 200 kayıt açıkken filtreleyip 12 kayda
    // düşünce "Devamını Gör" mantığı şaşar ve gereksiz kalabalık kalır.
    useEffect(() => { setGosterilenSayi(SAYFA_BOYU); }, [seciliDefterId, detayArama, kategoriFiltre, hareketFiltre]);

    // YENİ: VİRMAN (hesaplar arası transfer) formu.
    // State'ler kasten BURAYA konuldu: bugunStr/seciliGun tanımlarından SONRA,
    // handleVirmanKaydet'ten önce. Daha yukarıya alınsa TDZ hatası çıkardı.
    const [showVirmanForm, setShowVirmanForm] = useState(false);
    const [virmanKaydediliyor, setVirmanKaydediliyor] = useState(false);
    const [virmanForm, setVirmanForm] = useState({ hedefDefterId: '', tutar: '', aciklama: '' });

    // Firestore canlı dinleme
    useEffect(() => {
      const u1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'), snap => {
        setDefterler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const u2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), snap => {
        setIslemler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      // YENİ (kullanıcı talebi): Personel ŞİRKET BORÇLARI (maas_yearly/{yıl} →
      // records[personId].borclanma) canlı dinlenir. Borcu olan personel
      // Borçlu defterinde OTOMATİK görünür; borç sıfırlanınca listeden düşer.
      const yilStr = String(new Date().getFullYear());
      const u3 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'maas_yearly', yilStr), snap => {
        setPersonelBorclari(snap.exists() ? (snap.data().records || {}) : {});
      });
      return () => { u1(); u2(); u3(); };
    }, []);

    // --- Hesaplamalar ---
    const paraFmt = (n) => (n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // PERFORMANS (kullanıcı talebi: pencereler geç açılıyordu):
    // defterIslemleri aynı render içinde 8-10 kez çağrılıyor ve her çağrıda
    // TÜM işlem kayıtları baştan filtreleniyordu. Kayıt sayısı büyüdükçe
    // her tıklama (ör. "Yeni Ödeme" düğmesi) bu yüzden gecikiyordu.
    // Artık sonuç defter bazında bir Map'te saklanır; aynı defter için
    // ikinci ve sonraki çağrılar hazır listeyi anında döndürür.
    const _defterIslemCache = new Map();
    const defterIslemleri = (dId) => {
      if (!_defterIslemCache.has(dId)) _defterIslemCache.set(dId, islemler.filter(i => i.defterId === dId));
      return _defterIslemCache.get(dId);
    };
    // ========================================================================
    // YENİ (kullanıcı talebi): CANLI DÖNEM — 1 EYLÜL 2026 SİSTEM GEÇİŞİ PLANI
    // ========================================================================
    // Şirket 1 Eylül 2026'da (o gün DAHİL) başka uygulamadan bu sisteme geçer.
    // PLAN ŞÖYLE İŞLER:
    //   1) 1 Eylül'e KADAR: her şey bugünkü gibi çalışır (deneme dönemi).
    //      Eski işlemler listelerde görünmeye devam eder, hiçbir kayıt silinmez.
    //   2) 1 Eylül'den İTİBAREN: bakiye, gelir, gider ve ciro hesapları
    //      YALNIZCA 1 Eylül ve sonrası işlemlerden yapılır — geçmiş "deneme"
    //      rakamları hesaplara girmez ama işlem listelerinde görünür kalır.
    //   3) O gün her defterde "Devir" düğmesi AKTİF olur; eski uygulamadaki
    //      gerçek kalan bakiye devir kaydı olarak girilir. Devir kaydı
    //      BAKİYEYE GİRER (banka ile eşleşsin) ama CİROYA GİRMEZ (o ayın
    //      gelir/giderini şişirmesin — ciroyaGirer bunu dışlar).
    //   4) Devirler girilip banka bakiyeleriyle eşleşince canlı takip başlar.
    // Not: SISTEM_DEVIR_TARIHI'nin tek tanımı burasıdır.
    const SISTEM_DEVIR_TARIHI = '2026-09-01';
    // ========================================================================
    // YENİ (kullanıcı talebi): DEVİR SÜRECİ TAMAMLANDI
    // ------------------------------------------------------------------------
    // Devir (eski uygulamadan bakiye aktarımı) işi bitti. Bakiyesi girilmesi
    // gereken defterlere devir kaydı yapıldı; geri kalanlar (bakiyesi sıfır
    // olanlar ve Ödemeler/Krediler gibi kendi iç takibi olan defterler) zaten
    // devir GEREKTİRMİYOR — bunlar da "yapıldı" kabul edilir.
    // Bu bayrak true iken defter listesindeki "Devir" düğmesi HİÇBİR defterde
    // görünmez; böylece yanlışlıkla ikinci/gereksiz bir devir kaydı girilemez.
    // Yeni bir defter için devir gerekirse bu satırı false yapmak yeterlidir —
    // devir penceresi ve kaydetme mantığı olduğu gibi duruyor, silinmedi.
    // ========================================================================
    const DEVIR_DONEMI_TAMAMLANDI = true;
    // Canlı dönemde miyiz? (bugün devir gününe ulaştı mı — o gün dahil)
    const canliDonemde = bugunStr() >= SISTEM_DEVIR_TARIHI;
    // Bir işlem bakiye/ciro hesaplarına katılır mı?
    // Deneme döneminde HERKES katılır; canlı dönemde yalnızca devir tarihi ve
    // sonrası katılır. (Listeleme filtrelenmez — eski kayıtlar hep görünür.)
    // DEĞİŞTİ (kullanıcı talebi): yumuşak silinen işlemler (silindi=true)
    // hiçbir hesapta sayılmaz — listede etiketle görünmeye devam ederler.
    // AYRICA: eski "Maaş Tablosu (Oto)" otomatik senkron kayıtları (maaş/avans)
    // artık ne hesaba katılır ne de listede görünür. Maaş ve avanslar YALNIZCA
    // Ödemeler defterinden "Öde" ile ödendiğinde Sembol Nakliyat hesaplarına
    // düşer (kaynak: 'Personel Avans' / defterden yapılan ödeme).
    const otomatikMaasKaydi = (i) => i.kaynak === 'Maaş Tablosu (Oto)' || !!i.maasKaynakId;
    const hesabaKatilir = (i) => !i.silindi && !otomatikMaasKaydi(i) && (!canliDonemde || ((i.tarih || '') >= SISTEM_DEVIR_TARIHI));

    // DEĞİŞTİ: Bakiye artık yalnızca canlı döneme dahil işlemlerden hesaplanır.
    const defterBakiye = (dId) => defterIslemleri(dId).filter(hesabaKatilir).reduce((t, i) => t + (i.tip === 'giris' ? 1 : -1) * (parseFloat(i.tutar) || 0), 0);
    const defterSonIslem = (dId) => {
      const list = defterIslemleri(dId).sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
      return list[0]?.tarih || null;
    };

    // Genel toplamlar (tüm defterler)
    // DEĞİŞİKLİK: VİRMAN (hesaplar arası transfer) bu toplamlara KATILMAZ.
    // Virman gerçek bir gelir/gider değil, paranın yer değiştirmesi. Sayılsaydı
    // 10.000 TL'lik bir transfer hem "toplam giriş" hem "toplam çıkış"a 10.000
    // eklerdi; net doğru kalsa da iki rakam şişer ve gelir-gider yanlış okunur.
    // NOT: defterBakiye() virmanı SAYAR — çünkü para o defterden gerçekten çıkıp
    // diğerine gerçekten girdi, bakiyeler doğru olmak zorunda.
    // Ciro toplamlarına GİRMEYEN hareketler:
    //  isVirman     -> hesaplar arası transfer (para yer değiştirir, gelir değil)
    //  krediMahsup  -> kredi taksitinin kredi defterindeki borç azaltma bacağı
    //  odemeMahsup  -> düzenli ödemenin ödemeler defterindeki izleme bacağı
    // Bunlar sayılsaydı her ödeme hem gelir hem gider olarak görünür, ciro şişerdi.
    // DEĞİŞTİ (kullanıcı talebi): devir kayıtları (devirKaydi) CİROYA GİRMEZ —
    // açılış bakiyesidir, o ayın gelir/giderini şişirmemelidir.
    // ========================================================================
    // YENİ (kullanıcı talebi): ALACAK (BORÇLU DEFTERİ) CİRO KURALI
    // ========================================================================
    // Borçlu (Tahsil Bekleyen) defterine yazılan GELİRLER henüz tahsil
    // edilmemiş ALACAKTIR — ciroya girmez. Gelir ancak tahsil edilip gerçek
    // bir hesaba (Kasa/Banka) geçtiğinde ciroya eklenir. Tahsilat sırasında
    // borçlu defterine yazılan mahsup çıkışı (alacakMahsup) da ciro/gider
    // sayılmaz; yalnızca alacağı azaltır.
    const borcluDefterIdSet = new Set(defterler.filter(d => d.tur === 'Borçlu').map(d => d.id));
    // YENİ (kullanıcı talebi): "BORÇ" kategorisiyle işlenen kayıtlar (borç
    // alma / borç verme) genel ciroyu ETKİLEMEZ — kredi taksit ödemeleri
    // (krediMahsup) ile aynı mantık. Büyük/küçük harf ve "Borç Alınan" /
    // "Borç Verilen" gibi alt kategoriler de kapsanır; sadece kategori adı
    // "BORÇ" ile BAŞLIYORSA dışlanır (başka kelime içinde geçen "borç"
    // yanlışlıkla eşleşmesin diye tam kelime/başlangıç eşleşmesi kullanılır).
    const borcKategorisiMi = (i) => (i.kategori || '').trim().toLocaleUpperCase('tr-TR').startsWith('BORÇ');
    // ========================================================================
    // YENİ (kullanıcı talebi): ALACAK TAHSİLATLARI CİROYA GİRMEZ
    // ------------------------------------------------------------------------
    // "Tahsil Bekleyen" defterinden yapılan tahsilatta hedef hesaba bir GELİR
    // satırı yazılır. Bu satır PARANIN HESABA GİRDİĞİNİ gösterir (bakiye doğru
    // kalsın diye şart) ama YENİ BİR GELİR DEĞİLDİR: ilgili iş tamamlandığında
    // ciroya zaten bir kez yazılmıştı. Tahsilat, o alacağın nakde dönmesidir.
    // Ciroya ikinci kez eklenirse Nakliye ve Depoevim gelirleri ÇİFT SAYILIR.
    // Bu yüzden tahsilat girişleri ciro/gelir hesaplarının tamamından dışlanır.
    // Bakiye (hesabaKatilir) ETKİLENMEZ — para hesapta görünmeye devam eder.
    //
    // GERİYE UYUM: Bu değişiklikten ÖNCE yapılmış tahsilatlarda yeni bayrak
    // yoktur; onlar da dışlansın diye ek olarak kaynak alanı kontrol edilir
    // (tahsilat kayıtları her zaman kaynak: 'Alacak Tahsilatı' ile yazılır).
    // ========================================================================
    const alacakTahsilatiMi = (i) => i.tahsilatKaydi === true || i.kaynak === 'Alacak Tahsilatı';
    const ciroyaGirer = (i) => !i.silindi && !otomatikMaasKaydi(i) && !i.isVirman && !i.krediMahsup && !i.odemeMahsup && !i.devirKaydi
      && !i.alacakMahsup && !borcKategorisiMi(i) && !alacakTahsilatiMi(i)
      && !(i.tip === 'giris' && borcluDefterIdSet.has(i.defterId));

    // ========================================================================
    // KREDİ MOTORU
    // ========================================================================
    // Bir kredi defterinin taksit planını üretir ve ödeme durumunu çıkarır.
    // Taksit planı VERİTABANINDA TUTULMAZ; defterdeki dört bilgiden (toplam
    // geri ödeme, taksit sayısı, ilk taksit tarihi, aylık taksit) her seferinde
    // hesaplanır. Böylece plan bozulmaz ve kayıt şişmez.
    //
    // Hangi taksitin ödendiği, o kredi defterine yazılmış GİRİŞ kayıtlarının
    // taksitNo alanından okunur. Yani "ödendi" bilgisi ayrı bir yerde değil,
    // paranın gerçekten hareket ettiği işlemin kendisinde durur.
    // ========================================================================
    // Bir defterin kredi kalemlerini verir.
    // GERİYE UYUM: Eski sürümde defterin kendisi TEK bir krediydi (defter.kredi).
    // O yapıdaki kayıtlar, tek elemanlı bir listeye çevrilerek yeni ekranda
    // aynen görünmeye devam eder; kimlikleri '__eski__' olur.
    const krediKalemleri = (defter) => {
      if (Array.isArray(defter?.krediler)) return defter.krediler;
      if (defter?.kredi && (parseFloat(defter.kredi.toplamGeriOdeme) > 0)) {
        return [{ id: '__eski__', ...defter.kredi }];
      }
      return [];
    };

    const SURESIZ_VADE_PENCERESI = 24; // Süresiz kalemlerde gösterilecek vade sayısı

    // ========================================================================
    // YENİ (kullanıcı talebi): SİSTEM DEVİR TARİHİ
    // ========================================================================
    // Şirket bu sisteme 1 Eylül 2026'da geçti. Bu tarihten ÖNCEKİ tüm vadeler
    // (kiralar, firma ödemeleri, kredi taksitleri) eski düzende zaten ödenmişti;
    // uygulamaya tek tek girilmeyecekleri için "devirden ödendi" sayılırlar.
    // Böylece geçmişten gelen yüzlerce sahte "gecikmiş" kaydı temizlenir ve
    // yalnızca 1 Eylül 2026 ve sonrası bekleyen olarak görünür.
    // Kiralarda geçmiş aylar, zam yapılmış hâliyle ödenmiş kabul edilir.
    // NOT: SISTEM_DEVIR_TARIHI'nin tanımı yukarıya (defterBakiye'nin üstüne)
    // taşındı — canlı dönem yardımcılarıyla birlikte tek kaynaktan yönetilir.

    // ========================================================================
    // DÜZELTME (kullanıcı talebi: "Otomatik ödeme olup da burada gözükmeyen
    // ödemeler var"): SÜRESİZ VADE ÜRETİMİ ARTIK TARİH TABANLI
    // ========================================================================
    // ESKİ HATA: Süresiz kalemlerde üretilecek vade sayısı
    //   (yapılmış ödeme sayısı + 24) idi. Hiç ödeme yapılmamış ve ilk tarihi
    //   eski olan bir kalem (ör. 01.08.2022 başlangıçlı kira) yalnızca ilk 24
    //   ayı üretiyor, plan 2024'te bitiyordu; bu yüzden Eylül/Ekim 2026
    //   listesinde HİÇ GÖRÜNMÜYORDU. Otomatik Ödemeler penceresinde duruyor
    //   ama aylık listede yok — bildirilen sorun tam olarak buydu.
    // YENİ: Vadeler ilk tarihten başlayıp BUGÜNDEN 24 AY SONRASINA kadar
    //   üretilir. Böylece başlangıcı ne kadar eski olursa olsun her kalem
    //   içinde bulunulan ayda ve ileri aylarda görünür.
    const vadeUfku = (() => {
      const [y, a] = bugunStr().split('-').map(Number);
      const d = new Date(y, (a - 1) + SURESIZ_VADE_PENCERESI, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`;
    })();
    // Güvenlik sınırı: haftalık kalemlerde bile sonsuz döngü olmasın
    const VADE_URETIM_SINIRI = 2000;

    const krediBilgi = (defter, kalem) => {
      const k = kalem || {};
      const taksitSayisi = parseInt(k.taksitSayisi) || 0;
      const toplamGeriOdeme = parseFloat(k.toplamGeriOdeme) || 0;
      const anaPara = parseFloat(k.anaPara) || 0;
      // Aylık taksit girilmemişse toplamdan türetilir
      const aylikTaksit = parseFloat(k.aylikTaksit) || (taksitSayisi > 0 ? toplamGeriOdeme / taksitSayisi : 0);
      const toplamFaiz = Math.max(0, toplamGeriOdeme - anaPara);

      // Bu KALEME ait taksit ödemeleri (giriş = borç azalması).
      // Eski kayıtlarda krediKalemId yoktur; o durumda defterin tüm kredi
      // mahsupları tek krediye aittir ve hepsi sayılır.
      const odemeler = defterIslemleri(defter?.id).filter(i =>
        !i.silindi && i.tip === 'giris' && i.krediMahsup &&
        (k.id === '__eski__' ? true : (i.krediKalemId ? i.krediKalemId === k.id : false)));
      const odenenTutar = odemeler.reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
      // YENİ (kullanıcı talebi): KISMİ ÖDEME — bir taksite birden çok ödeme
      // yazılabilir; taksit ancak toplam tutara ulaşınca kapanır.
      const taksitOdenenToplam = {};
      const taksitSonOdemeTarihi = {};
      odemeler.forEach(i => {
        const n = parseInt(i.taksitNo);
        if (isNaN(n)) return;
        taksitOdenenToplam[n] = (taksitOdenenToplam[n] || 0) + (parseFloat(i.tutar) || 0);
        if (!taksitSonOdemeTarihi[n] || (i.tarih || '') > taksitSonOdemeTarihi[n]) taksitSonOdemeTarihi[n] = i.tarih || null;
      });
      const odenenTaksitNolar = new Set(Object.keys(taksitOdenenToplam).map(Number));
      const kalanBorc = Math.max(0, toplamGeriOdeme - odenenTutar);

      // Taksit planı: ilk taksit tarihinden başlayarak aydan aya
      const plan = [];
      if (taksitSayisi > 0 && k.ilkTaksitTarihi) {
        const [y, a, g] = k.ilkTaksitTarihi.split('-').map(Number);
        for (let n = 1; n <= taksitSayisi; n++) {
          // Ay ekleme: gün taşmalarını (31 Ocak + 1 ay) ayın son gününe sabitler
          const t = new Date(y, (a - 1) + (n - 1), 1);
          const ayinSonGunu = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
          t.setDate(Math.min(g, ayinSonGunu));
          const tarihStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          const taksitOdenen = taksitOdenenToplam[n] || 0;
          // YENİ (kullanıcı talebi): DEVİR — 1 Eylül 2026 öncesi taksitler eski
          // düzende ödendiği için ödenmiş kabul edilir. Kredinin KALAN BORCU bu
          // kuraldan etkilenmez; o hâlâ gerçekten yatan paradan hesaplanır.
          const devir = tarihStr < SISTEM_DEVIR_TARIHI;
          const odendi = devir || taksitOdenen >= aylikTaksit - 0.01;
          const taksitKalan = devir ? 0 : Math.max(0, aylikTaksit - taksitOdenen);
          const odemeKaydi = odemeler.find(i => parseInt(i.taksitNo) === n);
          plan.push({
            no: n,
            tarih: tarihStr,
            tutar: aylikTaksit,
            odendi, devir,
            odemeTarihi: taksitSonOdemeTarihi[n] || odemeKaydi?.tarih || null,
            // Kısmi ödeme alanları
            odenenTutar: taksitOdenen, kalan: taksitKalan,
            kismi: !devir && !odendi && taksitOdenen > 0.01,
            // Vadesi geçmiş ve hâlâ ödenmemişse gecikmiş sayılır
            gecikmis: !odendi && tarihStr < bugunStr(),
          });
        }
      }
      const odenenAdet = plan.filter(t => t.odendi).length;
      const gecikmisAdet = plan.filter(t => t.gecikmis).length;
      // Sırada bekleyen ilk ödenmemiş taksit
      const siradaki = plan.find(t => !t.odendi) || null;

      return { kalemId: k.id, anaPara, toplamGeriOdeme, toplamFaiz, taksitSayisi, aylikTaksit,
               odenenTutar, kalanBorc, plan, odenenAdet, kalanAdet: taksitSayisi - odenenAdet,
               gecikmisAdet, siradaki, bankaAdi: k.bankaAdi || '', ad: k.ad || k.bankaAdi || 'Kredi' };
    };

    // Bir kredi defterinin TÜM kalemlerinin toplu durumu
    const krediDefterBilgi = (defter) => {
      const kalemler = krediKalemleri(defter);
      const detaylar = kalemler.map(k => ({ kalem: k, bilgi: krediBilgi(defter, k) }));
      // ======================================================================
      // YENİ (kullanıcı talebi): BU AY ÖDENECEK TAKSİT TUTARI
      // ----------------------------------------------------------------------
      // Kredi defteri kartı toplam KALAN BORCU gösteriyordu (milyonlarca TL);
      // asıl merak edilen "bu ay cebimizden ne çıkacak" bilgisiydi. Ödemeler
      // defterindeki buAyBekleyen hesabının BİREBİR AYNISI uygulanır: bu ayın
      // ilk ve son günü arasında vadesi olan, HENÜZ ÖDENMEMİŞ taksitlerin
      // KALAN tutarları toplanır (kısmi ödenmişse yalnızca kalanı sayılır).
      // Mevcut alanların hiçbiri değiştirilmedi; yalnızca yeni alanlar eklendi.
      // ======================================================================
      const buAyBas = bugunStr().slice(0, 8) + '01';
      const [kyy, kmm] = bugunStr().split('-').map(Number);
      const buAyBit = `${kyy}-${String(kmm).padStart(2, '0')}-${String(new Date(kyy, kmm, 0).getDate()).padStart(2, '0')}`;
      const buAyBekleyen = detaylar.reduce((t, d) =>
        t + d.bilgi.plan.filter(p => !p.odendi && p.tarih >= buAyBas && p.tarih <= buAyBit).reduce((s, p) => s + p.kalan, 0), 0);
      // Gecikmiş taksitlerin TUTARI (Ödemeler kartındaki gibi tutar da gösterilsin)
      const gecikmisTutar = detaylar.reduce((t, d) =>
        t + d.bilgi.plan.filter(p => p.gecikmis).reduce((s, p) => s + p.kalan, 0), 0);
      return {
        detaylar,
        kalemSayisi: kalemler.length,
        toplamBorc: detaylar.reduce((t, d) => t + d.bilgi.kalanBorc, 0),
        toplamAnaPara: detaylar.reduce((t, d) => t + d.bilgi.anaPara, 0),
        toplamGeriOdeme: detaylar.reduce((t, d) => t + d.bilgi.toplamGeriOdeme, 0),
        toplamOdenen: detaylar.reduce((t, d) => t + d.bilgi.odenenTutar, 0),
        gecikmisAdet: detaylar.reduce((t, d) => t + d.bilgi.gecikmisAdet, 0),
        buAyBekleyen,
        gecikmisTutar,
      };
    };

    // Tüm kredi defterlerinin toplam kalan borcu — üst özette gösterilir
    const krediDefterleri = defterler.filter(d => d.tur === 'Kredi');
    const toplamKrediBorcu = krediDefterleri.reduce((t, d) => t + krediDefterBilgi(d).toplamBorc, 0);
    const toplamGecikmis = krediDefterleri.reduce((t, d) => t + krediDefterBilgi(d).gecikmisAdet, 0);

    // ========================================================================
    // ÖDEMELER MOTORU
    // ========================================================================
    // "Ödemeler" defteri, içinde BİRDEN FAZLA ödeme kalemi barındırır
    // (kira, sigorta, vergi, abonelik...). Krediden farkı budur: kredi tek bir
    // borç planıdır, ödemeler defteri ise bir gider takvimidir.
    //
    // Her kalem defterin odemeler dizisinde durur:
    //   { id, ad, tutar, ilkTarih, tekrar, tekrarSayisi, not }
    //   tekrar: 'tek' | 'haftalik' | 'aylik' | 'yillik'
    //   tekrarSayisi: sayı  ya da  0 = SÜRESİZ (sürekli ödeme)
    //
    // Vade planı kayıt edilmez, bu dört bilgiden üretilir. Süresiz kalemlerde
    // sonsuz liste olamayacağı için ileriye dönük SURESIZ_VADE_PENCERESI kadar
    // vade gösterilir; ödendikçe pencere kendiliğinden ilerler.
    // ========================================================================
    // ========================================================================
    // YENİ: ÖDEME TÜRLERİ
    // ========================================================================
    // Her ödeme kalemi bir türe aittir. Ödemeler defterinde kalemler bu
    // türlere göre AYRI BLOKLAR halinde listelenir; her bloğun başlığı kendi
    // rengini taşır. Böylece kira, firma gideri ve personel ödemesi bir arada
    // karışmaz. Türü olmayan eski kayıtlar varsayılan olarak "Firma Ödemesi"
    // sayılır (geriye uyum).
    // ========================================================================
    const ODEME_TURLERI = [
      { id: 'kira',     ad: 'Kira Ödemesi',   baslik: 'bg-blue-600',    yumusak: 'bg-blue-50 border-blue-200',       yazi: 'text-blue-700',    Ikon: Landmark },
      { id: 'firma',    ad: 'Firma Ödemesi',  baslik: 'bg-orange-600',  yumusak: 'bg-orange-50 border-orange-200',   yazi: 'text-orange-700',  Ikon: Briefcase },
      { id: 'personel', ad: 'Personel Ödeme', baslik: 'bg-purple-600',  yumusak: 'bg-purple-50 border-purple-200',   yazi: 'text-purple-700',  Ikon: Users },
    ];
    const VARSAYILAN_ODEME_TURU = 'firma';
    const odemeTuruBilgi = (id) => ODEME_TURLERI.find(t => t.id === id) || ODEME_TURLERI.find(t => t.id === VARSAYILAN_ODEME_TURU);

    const TEKRAR_SECENEKLERI = [
      { id: 'tek', ad: 'Tek Seferlik' },
      { id: 'haftalik', ad: 'Her Hafta' },
      { id: 'aylik', ad: 'Her Ay' },
      { id: 'yillik', ad: 'Her Yıl' },
    ];
    // SURESIZ_VADE_PENCERESI yukarı taşındı (TDZ düzeltmesi — açıklama aşağıda).

    // NOT (TDZ düzeltmesi): SISTEM_DEVIR_TARIHI, vadeUfku ve VADE_URETIM_SINIRI
    // sabitleri buradan krediBilgi'nin ÜSTÜNE taşındı. Sebep: kredi toplamları
    // bileşen gövdesinde hemen hesaplanıyor ve krediBilgi bu sabitleri
    // kullanıyor; sabitler aşağıda kalınca "Cannot access before
    // initialization" hatasıyla Finans/Defter sayfası çöküyordu.

    const tekrarEtiket = (tekrar, sayi) => {
      const ad = TEKRAR_SECENEKLERI.find(t => t.id === tekrar)?.ad || 'Tek Seferlik';
      if (tekrar === 'tek') return ad;
      return parseInt(sayi) > 0 ? `${ad} • ${sayi} kez` : `${ad} • süresiz`;
    };

    // Bir ödeme kaleminin vade planını ve ödeme durumunu çıkarır
    // ========================================================================
    // YENİ: TUTAR TARİHE GÖRE (ZAM DESTEĞİ)
    // ========================================================================
    // kalem.zamlar = [{ gecerliTarih:'2027-01-01', tutar:320000 }, ...]
    // Bir vadenin tutarı, o vade tarihinde GEÇERLİ olan son zam kaydıdır;
    // hiç zam yoksa kalemin ana tutarı kullanılır. Böylece "Ocak'tan itibaren
    // kira 320 bin" dendiğinde geçmiş aylar eski tutarıyla kalır, yeni aylar
    // zamlı hesaplanır — geçmişe dönük yanlış rakam oluşmaz.
    // ========================================================================
    const kalemTutariTarihte = (kalem, tarihStr) => {
      const anaTutar = parseFloat(kalem.tutar) || 0;
      const zamlar = (kalem.zamlar || [])
        .filter(z => z && z.gecerliTarih && z.gecerliTarih <= tarihStr)
        .sort((a, b) => a.gecerliTarih.localeCompare(b.gecerliTarih));
      if (!zamlar.length) return anaTutar;
      return parseFloat(zamlar[zamlar.length - 1].tutar) || anaTutar;
    };

    const odemeKalemBilgi = (defter, kalem) => {
      const tutar = parseFloat(kalem.tutar) || 0;
      const tekrar = kalem.tekrar || 'tek';
      const istenenAdet = tekrar === 'tek' ? 1 : (parseInt(kalem.tekrarSayisi) || 0);
      const suresiz = tekrar !== 'tek' && istenenAdet === 0;

      // Bu kaleme ait ödemeler (defterdeki mahsup girişleri)
      const odemeler = defterIslemleri(defter?.id)
        .filter(i => !i.silindi && i.tip === 'giris' && i.odemeMahsup && i.odemeKalemId === kalem.id);
      // ======================================================================
      // YENİ (kullanıcı talebi): KISMİ ÖDEME DESTEĞİ
      // ======================================================================
      // Eskiden bir vadeye tek kayıt yazılıyor ve o vade anında "ödendi"
      // sayılıyordu. Artık aynı vadeye BİRDEN ÇOK ödeme yazılabilir (ör.
      // bir kısmı nakit, bir kısmı bankadan). Bir vade ancak yapılan
      // ödemelerin TOPLAMI vade tutarına ulaşınca kapanır; o ana kadar
      // "kısmi ödendi" olarak bekleyenlerde kalır ve kalan tutarla ödenmeye
      // devam eder.
      const vadeOdenenToplam = {};   // { vadeNo: o vadeye şimdiye dek ödenen toplam }
      const vadeSonOdemeTarihi = {}; // { vadeNo: en son ödeme tarihi }
      odemeler.forEach(i => {
        const n = parseInt(i.vadeNo);
        if (isNaN(n)) return;
        vadeOdenenToplam[n] = (vadeOdenenToplam[n] || 0) + (parseFloat(i.tutar) || 0);
        if (!vadeSonOdemeTarihi[n] || (i.tarih || '') > vadeSonOdemeTarihi[n]) vadeSonOdemeTarihi[n] = i.tarih || null;
      });
      // Üzerinde en az bir ödeme bulunan vadeler (süresiz pencere hesabı için)
      const odenenVadeNolar = new Set(Object.keys(vadeOdenenToplam).map(Number));
      const odenenTutar = odemeler.reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);

      // DEĞİŞTİ: Süresizde artık sabit adet değil, TARİH UFKU esas alınır.
      // Sınır yalnızca sonsuz döngüyü engellemek için; asıl duruş koşulu
      // aşağıdaki "tarihStr > vadeUfku" kontrolüdür.
      const uretilecek = suresiz ? VADE_URETIM_SINIRI : istenenAdet;

      const plan = [];
      if (kalem.ilkTarih) {
        const [y, a, g] = kalem.ilkTarih.split('-').map(Number);
        for (let n = 1; n <= uretilecek; n++) {
          let t;
          if (tekrar === 'haftalik') { t = new Date(y, a - 1, g); t.setDate(t.getDate() + 7 * (n - 1)); }
          else if (tekrar === 'yillik') { t = new Date(y + (n - 1), a - 1, 1); const son = new Date(y + (n - 1), a, 0).getDate(); t.setDate(Math.min(g, son)); }
          else if (tekrar === 'aylik') { t = new Date(y, (a - 1) + (n - 1), 1); const son = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); t.setDate(Math.min(g, son)); }
          else { t = new Date(y, a - 1, g); } // tek seferlik
          const tarihStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          // YENİ: Süresizlerde ufku aşınca dur (yukarıdaki açıklamaya bakınız)
          if (suresiz && tarihStr > vadeUfku) break;
          // YENİ: BİTİŞ TARİHİ — bu tarihten SONRAKİ vadeler hiç üretilmez.
          // "Kiralama bitti, artık borçlanmasın" durumu için. Ödenmiş vadeler
          // korunur (geçmiş kayıt silinmez), yalnız ileri vadeler kesilir.
          if (kalem.bitisTarihi && tarihStr > kalem.bitisTarihi && !odenenVadeNolar.has(n)) break;
          // YENİ: Vadenin tutarı o tarihte geçerli olan zamlı tutardır
          const vadeTutari = kalemTutariTarihte(kalem, tarihStr);
          // YENİ: Kısmi ödeme hesabı — vade ancak toplam tutara ulaşınca kapanır
          const vadeOdenen = vadeOdenenToplam[n] || 0;
          // YENİ (kullanıcı talebi): DEVİR — sistem devir tarihinden önceki her
          // vade, uygulamada kaydı olmasa bile ödenmiş kabul edilir.
          const devir = tarihStr < SISTEM_DEVIR_TARIHI;
          const odendi = devir || vadeOdenen >= vadeTutari - 0.01;
          const vadeKalan = devir ? 0 : Math.max(0, vadeTutari - vadeOdenen);
          const kismi = !devir && !odendi && vadeOdenen > 0.01; // kısmen ödenmiş, hâlâ bekliyor
          const kayit = odemeler.find(i => parseInt(i.vadeNo) === n);
          const kiraAylik = (kalem.odemeTuru === 'kira') && tekrar === 'aylik';
          const yilSonu = kiraAylik && n % 12 === 0;
          plan.push({ no: n, tarih: tarihStr, tutar: vadeTutari, odendi, devir,
                      odemeTarihi: vadeSonOdemeTarihi[n] || kayit?.tarih || null,
                      // Kısmi ödeme alanları: ekranda kalan tutarla devam edilir
                      odenenTutar: vadeOdenen, kalan: vadeKalan, kismi,
                      gecikmis: !odendi && tarihStr < bugunStr(),
                      yilSonu, yilNo: yilSonu ? n / 12 : null });
        }
      }
      const odenenAdet = plan.filter(p => p.odendi).length;
      const gecikmisler = plan.filter(p => p.gecikmis);
      const siradaki = plan.find(p => !p.odendi) || null;
      // Kalan borç yalnızca SONLU planlarda anlamlıdır; süresizde bilinemez
      const kalanTutar = suresiz ? null : Math.max(0, tutar * istenenAdet - odenenTutar);

      return { tutar, tekrar, suresiz, istenenAdet, plan, odenenAdet, odenenTutar,
               kalanAdet: suresiz ? null : Math.max(0, istenenAdet - odenenAdet),
               kalanTutar, gecikmisAdet: gecikmisler.length,
               // KISMİ ÖDEME: gecikmiş tutarda vade tutarı değil KALAN tutar sayılır
               gecikmisTutar: gecikmisler.reduce((t, p) => t + p.kalan, 0), siradaki };
    };

    // Bir ödemeler defterinin toplu durumu
    const odemeDefterBilgi = (defter) => {
      const kalemler = defter?.odemeler || [];
      const detaylar = kalemler.map(k => ({ kalem: k, bilgi: odemeKalemBilgi(defter, k) }));
      const gecikmisAdet = detaylar.reduce((t, d) => t + d.bilgi.gecikmisAdet, 0);
      const gecikmisTutar = detaylar.reduce((t, d) => t + d.bilgi.gecikmisTutar, 0);
      // Bu ay içinde vadesi gelen ve HENÜZ ÖDENMEMİŞ toplam
      const buAyBas = bugunStr().slice(0, 8) + '01';
      const [yy, mm] = bugunStr().split('-').map(Number);
      const buAyBit = `${yy}-${String(mm).padStart(2, '0')}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`;
      const buAyBekleyen = detaylar.reduce((t, d) =>
        t + d.bilgi.plan.filter(p => !p.odendi && p.tarih >= buAyBas && p.tarih <= buAyBit).reduce((s, p) => s + p.kalan, 0), 0);
      // ======================================================================
      // YENİ (kullanıcı talebi): BU AYIN TOPLAM VE ÖDENEN TUTARLARI
      // ----------------------------------------------------------------------
      // Defter kartında yalnızca "bu ay bekleyen" (ödenmemiş kalan) görünüyordu.
      // Artık ayın TAMAMI da görünsün isteniyor:
      //   buAyToplam  = bu ay vadesi gelen TÜM ödemelerin tutarı (ödenen dahil)
      //   buAyOdenen  = bunun ödenmiş kısmı (kısmi ödemelerde ödenen parça da sayılır)
      // Kısmi ödeme doğru yansısın diye ödenen kısım (tutar - kalan) üzerinden
      // hesaplanır; ödenmiş vadelerde kalan zaten 0'dır.
      // Mevcut buAyBekleyen alanı DEĞİŞTİRİLMEDİ — onu kullanan yerler (kredi
      // kartı, üst özet) aynen çalışmaya devam eder.
      // ======================================================================
      const buAyVadeleri = detaylar.flatMap(d =>
        d.bilgi.plan.filter(p => p.tarih >= buAyBas && p.tarih <= buAyBit));
      const buAyToplam = buAyVadeleri.reduce((t, p) => t + (parseFloat(p.tutar) || 0), 0);
      const buAyOdenen = buAyVadeleri.reduce((t, p) => t + ((parseFloat(p.tutar) || 0) - (parseFloat(p.kalan) || 0)), 0);
      const buAyAdet = buAyVadeleri.length;
      const buAyOdenenAdet = buAyVadeleri.filter(p => p.odendi).length;
      return { detaylar, kalemSayisi: kalemler.length, gecikmisAdet, gecikmisTutar, buAyBekleyen,
               buAyToplam, buAyOdenen, buAyAdet, buAyOdenenAdet };
    };

    const odemeDefterleri = defterler.filter(d => d.tur === 'Ödemeler');
    const toplamGecikmisOdeme = odemeDefterleri.reduce((t, d) => t + odemeDefterBilgi(d).gecikmisAdet, 0);
    const toplamBuAyBekleyen = odemeDefterleri.reduce((t, d) => t + odemeDefterBilgi(d).buAyBekleyen, 0);

    // ========================================================================
    // YENİ: ÜST ÖZET DÖNEM FİLTRESİ
    // ========================================================================
    // Eskiden Toplam Giriş / Çıkış / Net Bakiye TÜM ZAMANLARI topluyordu ve
    // değiştirilemiyordu. Artık üstte bir dönem seçici var.
    // VARSAYILAN: 'bugun' — kullanıcı isteği: "Her zaman Bugün gözüksün."
    // Sayfa her açıldığında bugüne döner (state başlangıç değeri olduğu için).
    // NOT: Bu filtre YALNIZCA üstteki özet kartını etkiler; alttaki defter
    // listesi ve her defterin kendi bakiyesi TÜM ZAMANLAR üzerinden kalır,
    // çünkü bir hesabın bakiyesi doğası gereği kümülatiftir.
    // ========================================================================
    const OZET_DONEMLERI = [
      { id: 'tum', ad: 'Tüm Zamanlar' },
      { id: 'bugun', ad: 'Bugün' },
      { id: 'dun', ad: 'Dün' },
      { id: 'buAy', ad: 'Bu Ay' },
      { id: 'gecenAy', ad: 'Geçen Ay' },
      { id: 'buSene', ad: 'Bu Sene' },
      { id: 'gecenSene', ad: 'Geçen Sene' },
    ];
    const [ozetDonem, setOzetDonem] = useState('bugun'); // Varsayılan: Bugün

    // Seçilen döneme karşılık gelen tarih aralığını verir (YYYY-AA-GG metinleri).
    // Kayıtlardaki tarih alanı da aynı biçimde olduğu için metin karşılaştırması
    // güvenlidir (saat dilimi kaymasına yol açmaz).
    const donemAraligi = (donem) => {
      const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const bugun = new Date();
      if (donem === 'bugun') return { bas: g(bugun), bit: g(bugun) };
      if (donem === 'dun') { const d = new Date(bugun); d.setDate(d.getDate() - 1); return { bas: g(d), bit: g(d) }; }
      if (donem === 'buAy') return { bas: g(new Date(bugun.getFullYear(), bugun.getMonth(), 1)), bit: g(new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0)) };
      if (donem === 'gecenAy') return { bas: g(new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1)), bit: g(new Date(bugun.getFullYear(), bugun.getMonth(), 0)) };
      if (donem === 'buSene') return { bas: `${bugun.getFullYear()}-01-01`, bit: `${bugun.getFullYear()}-12-31` };
      if (donem === 'gecenSene') return { bas: `${bugun.getFullYear() - 1}-01-01`, bit: `${bugun.getFullYear() - 1}-12-31` };
      return null; // 'tum' -> sınır yok
    };

    // Dönem filtresinden geçen işlemler (virmanlar zaten ciroyaGirer ile dışlanır)
    const ozetIslemleri = useMemo(() => {
      // DEĞİŞTİ (kullanıcı talebi): canlı dönemde özet kartlar da yalnızca
      // 1 Eylül 2026 ve sonrası işlemleri sayar ("Tüm Zamanlar" dahil).
      const canliFiltre = islemler.filter(hesabaKatilir);
      const aralik = donemAraligi(ozetDonem);
      if (!aralik) return canliFiltre; // Tüm Zamanlar (canlı dönem sınırıyla)
      return canliFiltre.filter(i => i.tarih && i.tarih >= aralik.bas && i.tarih <= aralik.bit);
    }, [islemler, ozetDonem, canliDonemde]);

    const toplamGiris = ozetIslemleri.filter(i => i.tip === 'giris' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const toplamCikis = ozetIslemleri.filter(i => i.tip === 'cikis' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const netBakiye = toplamGiris - toplamCikis;

    const seciliDefter = defterler.find(d => d.id === seciliDefterId) || null;

    // ========================================================================
    // YENİ (kullanıcı talebi): DEVİR TUTARI KAYDETME
    // ========================================================================
    // Eski uygulamadan aktarılan gerçek kalan bakiye deftere tek kayıtla
    // işlenir. Kayıt devirKaydi=true taşır: BAKİYEYE GİRER (banka hesabıyla
    // eşleşir) ama CİROYA GİRMEZ (ciroyaGirer dışlar) — o ayın gelir/gider
    // rakamlarını etkilemez. Girdiğiniz gün işlenir; tarih devir gününden
    // önceye alınamaz (öncesi zaten hesaba katılmıyor).
    // YENİ: Mobil hızlı kayıt — tek dokunuşta gelir/gider yazar.
    const hizliKaydet = async () => {
      const tutar = parseFloat(hizliTutar);
      if (!tutar || tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      // TRANSFER: tutar hazır, hedef hesap seçimi için virman penceresi açılır
      if (hizliTip === 'virman') {
        setVirmanForm({ hedefDefterId: '', tutar: String(tutar), aciklama: '' });
        setShowVirmanForm(true);
        setHizliTutar('');
        return;
      }
      setHizliKaydediliyor(true);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          defterId: seciliDefterId,
          tip: hizliTip,
          tutar,
          // Kayıt, ekranda BAKILAN güne yazılır ki listeden kaybolmasın
          tarih: gunFiltreAktif ? seciliGun : bugunStr(),
          // YENİ: açılan satırdan gelen kategori ve not kullanılır
          kategori: hizliKategori || 'Diğer',
          etiketler: [],
          aciklama: (hizliAciklama || '').trim() || 'Hızlı kayıt',
          odemeYontemi: defterdenOdemeYontemi(seciliDefterId),
          kaynak: 'Hızlı Kayıt',
          createdAt: new Date().toISOString(),
          by: currentUser?.fullName || 'Sistem',
        });
        addSystemLog?.('Defter İşlemi (Hızlı)', `${seciliDefter?.ad}: ${hizliTip === 'giris' ? 'PARA GİRİŞİ' : 'PARA ÇIKIŞI'} ₺${paraFmt(tutar)} (${hizliKategori}).`);
        setHizliTutar(''); setHizliAciklama(''); setHizliKategori('Diğer');
        // YENİ (kullanıcı talebi): Kayıt tamamlanır tamamlanmaz tutar kutusuna
        // yeniden odaklanılır — bar "tekrar aktif" olur, klavye kapanmaz ve
        // aynı ekranda hemen bir sonraki gelir/gider tutarı yazılabilir.
        // setTimeout(...,0): state güncellemesi (input'un boşalması) ekrana
        // yansıdıktan HEMEN SONRA odaklanmayı garanti eder.
        setTimeout(() => hizliTutarInputRef.current?.focus(), 0);
      } catch (e) { console.error('Hızlı kayıt başarısız:', e); alert('Kaydedilemedi. Lütfen tekrar deneyin.'); }
      finally { setHizliKaydediliyor(false); }
    };

    // ========================================================================
    // YENİ (kullanıcı talebi): ALACAK MOTORU
    // ========================================================================
    // Bir borçlu kaleminin taksit planını üretir. taksitSayisi boş/1 ise tek
    // vade (peşin alacak); >1 ise aylık taksitler. Kısmi tahsilat desteklenir:
    // taksit ancak toplam tahsilat tutara ulaşınca kapanır. Devir kuralı
    // BURADA UYGULANMAZ — alacaklar gerçek alacaktır, eski vadeler gecikmiş
    // görünmelidir.
    const alacakBilgi = (defter, kalem) => {
      const toplam = parseFloat(kalem.toplamTutar) || 0;
      const adet = Math.max(1, parseInt(kalem.taksitSayisi) || 1);
      const taksitTutar = Math.round((toplam / adet) * 100) / 100;
      // Bu kaleme yapılan tahsilat mahsupları (borçlu defterindeki çıkışlar)
      const tahsilatlar = defterIslemleri(defter?.id)
        .filter(i => !i.silindi && i.tip === 'cikis' && i.alacakMahsup && i.alacakKalemId === kalem.id);
      const taksitTahsil = {}; const taksitSonTarih = {};
      tahsilatlar.forEach(i => {
        const n = parseInt(i.taksitNo); if (isNaN(n)) return;
        taksitTahsil[n] = (taksitTahsil[n] || 0) + (parseFloat(i.tutar) || 0);
        if (!taksitSonTarih[n] || (i.tarih || '') > taksitSonTarih[n]) taksitSonTarih[n] = i.tarih || null;
      });
      const plan = [];
      if (kalem.ilkTarih) {
        const [y, a, g] = kalem.ilkTarih.split('-').map(Number);
        for (let n = 1; n <= adet; n++) {
          const t = new Date(y, (a - 1) + (n - 1), 1);
          const son = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
          t.setDate(Math.min(g, son));
          const tarihStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          // Kuruş farkı son taksite eklenir ki toplam birebir tutsun
          const tutar = n === adet ? Math.round((toplam - taksitTutar * (adet - 1)) * 100) / 100 : taksitTutar;
          const tahsil = taksitTahsil[n] || 0;
          // YENİ (kullanıcı talebi): 1 Eylül 2026 ÖNCESİ vadeler tahsil edilmiş
          // sayılır (devir); borçlu defterinde bekleyen olarak GÖSTERİLMEZ.
          const devir = tarihStr < SISTEM_DEVIR_TARIHI;
          const odendi = devir || tahsil >= tutar - 0.01;
          plan.push({ no: n, tarih: tarihStr, tutar, odendi, devir,
                      odenenTutar: tahsil, kalan: devir ? 0 : Math.max(0, tutar - tahsil),
                      kismi: !devir && !odendi && tahsil > 0.01,
                      odemeTarihi: taksitSonTarih[n] || null,
                      gecikmis: !odendi && tarihStr < bugunStr() });
        }
      }
      const toplamTahsil = tahsilatlar.reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
      // DEVİR taksitler (1 Eylül öncesi) tahsil edilmiş sayılır: kalan alacaktan düşülür
      const devirToplam = plan.filter(pp => pp.devir).reduce((t, pp) => t + pp.tutar, 0);
      const gecikmisler = plan.filter(pp => pp.gecikmis);
      return { ad: kalem.ad, tur: kalem.tur, toplam, adet, plan, toplamTahsil,
               kalanAlacak: Math.max(0, toplam - toplamTahsil - devirToplam),
               tahsilAdet: plan.filter(pp => pp.odendi).length,
               gecikmisAdet: gecikmisler.length,
               gecikmisTutar: gecikmisler.reduce((t, pp) => t + pp.kalan, 0),
               siradaki: plan.find(pp => !pp.odendi) || null };
    };
    // Defterdeki TÜM borçluların özeti
    const alacakDefterBilgi = (defter) => {
      const kalemler = defter?.alacaklar || [];
      const detaylar = kalemler.map(kalem => ({ kalem, bilgi: alacakBilgi(defter, kalem) }));
      // ======================================================================
      // YENİ (kullanıcı talebi): OTOMATİK BORÇLULAR
      // ======================================================================
      // 1) PERSONEL: maas_yearly'deki şirket borcu (borclanma) > 0 olan her
      //    personel otomatik borçlu olarak eklenir. Borç sıfırlanınca düşer.
      // 2) MÜŞTERİ: işi TAMAMLANMIŞ ama tahsil edilmemiş (kalan bakiye > 0)
      //    her cari otomatik borçlu olur. İş tamamlanmadan GÖRÜNMEZ; bakiye
      //    sıfırlanınca (ödeme alınınca) listeden düşer.
      // Bu kalemler "otomatik" işaretlidir; elle silinmez/düzenlenmez, kaynak
      // veriden canlı gelir. Tahsilat yine yapılabilir.
      const otoDetaylar = [];
      // Yalnızca Sembol Nakliyat blokundaki Borçlu defterine otomatik doldur
      if (defter?.tur === 'Borçlu') {
        // --- 1) Personel borçları ---
        (personnelList || []).forEach(p => {
          const borc = parseFloat(personelBorclari[p.id]?.borclanma) || 0;
          if (borc <= 0.01) return;
          const kalem = { id: `oto_personel_${p.id}`, ad: p.fullName || p.name || 'Personel',
            tur: 'personel', toplamTutar: String(borc), taksitSayisi: '',
            // Personel şirket borcu güncel/canlı borçtur; devir sonrası tarihle
            // gösterilir ki 1 Eylül devir kuralına takılıp gizlenmesin.
            ilkTarih: bugunStr() >= SISTEM_DEVIR_TARIHI ? bugunStr() : SISTEM_DEVIR_TARIHI,
            not: 'Şirkete borç (personel profilinden otomatik)', icra: null, otomatik: true, kaynak: 'personel', personId: p.id };
          otoDetaylar.push({ kalem, bilgi: alacakBilgi(defter, kalem) });
        });
        // --- 2) Tamamlanmış ama ödenmemiş müşteri işleri (cari bazında) ---
        // ====================================================================
        // HATA DÜZELTMESİ (kullanıcı bildirimi): "Bugün taşınan müşteriler
        // borçlu listesinde çıkıyor; oysa carisi ₺0 ve ödeme alınmıştı."
        // --------------------------------------------------------------------
        // KÖK NEDEN: Tahsil edilen tutar `j.collectedAmount ?? j.paidAmount`
        // alanlarından okunuyordu. Bu iki alan projede HİÇBİR YERDE YAZILMIYOR
        // (arama ile doğrulandı) — yani her zaman undefined, dolayısıyla
        // tahsil = 0 ve kalan = anlaşma tutarı çıkıyordu. Sonuç: ödemesi
        // NAKİT/HAVALE/KREDİ KARTI ile TAM ALINMIŞ her tamamlanmış iş bile
        // borçlu listesine düşüyordu (örn. Serkan er — cari bakiyesi ₺0).
        //
        // ÇÖZÜM: Ödemenin alınıp alınmadığının sistemdeki GERÇEK kaynağı,
        // iş sonlandırma ekranında seçilen `endJobDetails.paymentMethod`
        // alanıdır ("Nakit" / "Banka / Havale" / "Kredi Kartı" /
        // "Ödeme Alınmadı"). Artık borçlu listesine YALNIZCA açıkça
        // "Ödeme Alınmadı" seçilen işler girer. Aynı ölçüt, bu dosyadaki
        // `tasinanOdemeler` hesabında da kullanılıyor — iki yer artık tutarlı.
        //
        // Kalan tutar da sistemin geri kalanıyla aynı formülle bulunur:
        // (fiyat - kapora). Kapora alınmış işlerde yalnızca bakiyesi borç
        // sayılır. Eski alanlar (totalAmount/agreedPrice) yedek olarak durur.
        // ====================================================================
        const cariHarita = new Map();
        (jobs || []).forEach(j => {
          // Yalnızca TAMAMLANMIŞ işler
          if (j.status !== 'completed') return;
          // Ödeme durumu iş sonlandırma ekranından gelir; kaydı yoksa borç sayılmaz
          if (!j.endJobDetails) return;
          // SADECE "Ödeme Alınmadı" işaretlenen işler borçlu listesine girer
          if (j.endJobDetails.paymentMethod !== 'Ödeme Alınmadı') return;
          // YENİ (kullanıcı talebi): 1 Eylül 2026 ÖNCESİ tamamlanan işler devir
          // sayılır (tahsil edilmiş kabul); borçlu defterinde gösterilmez.
          if ((j.date || j.completedDate || '') < SISTEM_DEVIR_TARIHI) return;
          // Kalan borç = fiyat - kapora (sistemin diğer yerleriyle aynı hesap)
          const anlasma = parseFloat(j.price ?? j.totalAmount ?? j.agreedPrice) || 0;
          const kapora = parseFloat(j.deposit) || 0;
          const kalan = anlasma - kapora;
          if (kalan <= 0.01) return; // bakiye yoksa borçlu değil
          const tel = (j.customerPhone || '').replace(/\D/g, '') || (j.customerName || 'musteri');
          const m = cariHarita.get(tel);
          if (m) { m.kalan += kalan; if ((j.date || '') > m.tarih) { m.ad = j.customerName || m.ad; m.tarih = j.date; } }
          else cariHarita.set(tel, { ad: j.customerName || 'Müşteri', tel, kalan, tarih: j.date || bugunStr() });
        });
        cariHarita.forEach((c, tel) => {
          const kalem = { id: `oto_musteri_${tel}`, ad: c.ad, tur: 'musteri',
            toplamTutar: String(c.kalan), taksitSayisi: '', ilkTarih: c.tarih,
            not: 'Tamamlanan iş — ödeme alınmadı (cariden otomatik)', icra: null,
            otomatik: true, kaynak: 'musteri', tel };
          otoDetaylar.push({ kalem, bilgi: alacakBilgi(defter, kalem) });
        });
      }
      const tumDetaylar = [...detaylar, ...otoDetaylar];
      const buAyOn = alacakAyi;
      return {
        kalemSayisi: tumDetaylar.length,
        detaylar: tumDetaylar,
        toplamAlacak: tumDetaylar.reduce((t, d) => t + d.bilgi.toplam, 0),
        toplamTahsil: tumDetaylar.reduce((t, d) => t + d.bilgi.toplamTahsil, 0),
        kalanAlacak: tumDetaylar.reduce((t, d) => t + d.bilgi.kalanAlacak, 0),
        gecikmisAdet: tumDetaylar.reduce((t, d) => t + d.bilgi.gecikmisAdet, 0),
        gecikmisTutar: tumDetaylar.reduce((t, d) => t + d.bilgi.gecikmisTutar, 0),
        icradaAdet: tumDetaylar.filter(d => d.kalem.icra).length,
        buAyBekleyen: tumDetaylar.reduce((t, d) => t + d.bilgi.plan.filter(pp => !pp.odendi && pp.tarih.startsWith(buAyOn)).reduce((x, pp) => x + pp.kalan, 0), 0),
      };
    };

    // YENİ BORÇLU KAYDET / DÜZENLE — kalemler defter dokümanındaki
    // "alacaklar" dizisinde tutulur (odemeler/krediler ile aynı desen).
    const alacakKaydet = async () => {
      if (!seciliDefter || !alacakForm) return;
      if (!alacakForm.ad.trim()) { alert('Borçlu adını girin (örn: Melike Özdemir / X Ltd. Şti.).'); return; }
      if (!(parseFloat(alacakForm.toplamTutar) > 0)) { alert('Geçerli bir alacak tutarı girin.'); return; }
      if (!alacakForm.ilkTarih) { alert('İlk vade tarihini seçin.'); return; }
      const mevcut = seciliDefter.alacaklar || [];
      const kalem = {
        ...alacakForm,
        id: alacakForm.id || `al_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        toplamTutar: String(parseFloat(alacakForm.toplamTutar)),
        taksitSayisi: parseInt(alacakForm.taksitSayisi) > 1 ? String(parseInt(alacakForm.taksitSayisi)) : '',
        tur: ['personel', 'musteri', 'kurum'].includes(alacakForm.tur) ? alacakForm.tur : 'musteri',
      };
      const yeniListe = alacakForm.id ? mevcut.map(k => k.id === kalem.id ? kalem : k) : [...mevcut, kalem];
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), { alacaklar: yeniListe });
        addSystemLog?.('Alacak Kalemi', `${seciliDefter.ad}: "${kalem.ad}" ${alacakForm.id ? 'güncellendi' : 'eklendi'} (₺${paraFmt(kalem.toplamTutar)}${kalem.taksitSayisi ? ` • ${kalem.taksitSayisi} taksit` : ' • peşin'}).`);
        setAlacakForm(null);
      } catch (e) { console.error(e); alert('Borçlu kaydedilemedi.'); }
    };

    // BORÇLU SİL — tahsilat yapılmışsa ek uyarı (ödemeler/kredi ile aynı kural)
    const alacakSil = async (kalemId) => {
      const kalem = (seciliDefter.alacaklar || []).find(k => k.id === kalemId);
      if (!kalem) return;
      const bilgi = alacakBilgi(seciliDefter, kalem);
      if (bilgi.toplamTahsil > 0.01 &&
          !window.confirm(`"${kalem.ad}" borçlusundan ₺${paraFmt(bilgi.toplamTahsil)} tahsilat yapılmış.\n\nKalemi silerseniz tahsilat kayıtları defterde KALIR ama hangi borçluya ait oldukları listede görünmez.\n\nYine de silmek istiyor musunuz?`)) return;
      if (!window.confirm(`"${kalem.ad}" borçlu kaydı silinsin mi?`)) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), {
          alacaklar: (seciliDefter.alacaklar || []).filter(k => k.id !== kalemId),
        });
        addSystemLog?.('Alacak Kalemi Silindi', `${seciliDefter.ad}: "${kalem.ad}" kaldırıldı.`);
      } catch (e) { console.error(e); alert('Silinemedi.'); }
    };

    // İCRA İŞLEMİ — başlat / geri al. Kalem üstünde icra tarihi tutulur;
    // listede kırmızı "İCRADA" rozeti görünür, plan ve tahsilat aynen sürer.
    const alacakIcra = async (kalemId, baslat) => {
      const kalem = (seciliDefter.alacaklar || []).find(k => k.id === kalemId);
      if (!kalem) return;
      if (baslat && !window.confirm(`"${kalem.ad}" için icra işlemi başlatılsın mı?\n\nKalem "İCRADA" olarak işaretlenir; tahsilat yapılabilir olmaya devam eder.`)) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), {
          alacaklar: (seciliDefter.alacaklar || []).map(k => k.id === kalemId ? { ...k, icra: baslat ? bugunStr() : null } : k),
        });
        addSystemLog?.(baslat ? 'İcra İşlemi Başlatıldı' : 'İcra Kaydı Kaldırıldı',
          `${seciliDefter.ad}: "${kalem.ad}"${baslat ? ' icraya verildi.' : ' icra işareti kaldırıldı.'}`);
      } catch (e) { console.error(e); alert('Güncellenemedi.'); }
    };

    // TAHSİLAT — paranın YÖNÜ ödemenin tersidir:
    //   1) Seçilen HEDEF hesaba GİRİŞ yazılır (para hesaba girer, bakiye artar
    //      — ama CİROYA GİRMEZ; iş tamamlandığında ciroya zaten yazılmıştı,
    //      tahsilat o alacağın nakde dönmesidir. Bkz. ciroyaGirer/tahsilatKaydi).
    //   2) Borçlu defterine alacakMahsup ÇIKIŞI yazılır (alacak azalır,
    //      ciro/gider sayılmaz). Kısmi tahsilat desteklenir.
    const alacakTahsilEt = async () => {
      if (!tahsilModal) return;
      // Maaştan kesme yolunda hesap seçimi gerekmez; sadece nakit girişinde şart
      const _maastan = tahsilModal.kalem.tur === 'personel' && (tahsilModal.tahsilSekli || 'hesap').startsWith('maas');
      if (!_maastan && !tahsilModal.hedefDefterId) { alert('Paranın girdiği hesabı seçin.'); return; }
      const t = tahsilModal.taksit;
      const kalan = t.kalan ?? t.tutar;
      const tutar = parseFloat(tahsilModal.tutar ?? kalan) || 0;
      if (tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      if (tutar > kalan + 0.01) { alert(`Kalan alacaktan fazla tahsilat girilemez.\n\nBu taksit için kalan: ₺${paraFmt(kalan)}`); return; }
      const kismiOdeme = tutar < kalan - 0.01;
      const kalacak = Math.max(0, kalan - tutar);
      const kismiNot = kismiOdeme ? ` (kısmi tahsilat — kalan ₺${paraFmt(kalacak)})` : '';
      // ======================================================================
      // YENİ (kullanıcı talebi): PERSONEL — MAAŞTAN KESEREK TAHSİLAT
      // ======================================================================
      // tahsilSekli 'maas_nakit' / 'maas_banka' ise para hesaba GİRMEZ.
      // Bunun yerine: (1) personelin şirket borcu (borclanma) düşürülür,
      // (2) o ayki maaşının ilgili kanalından kesinti işlenir (maasKesintiNakit
      // / maasKesintiBanka), (3) defter geliri yazılmaz — ciro şişmez.
      const tahsilSekli = tahsilModal.tahsilSekli || 'hesap';
      if (tahsilModal.kalem.tur === 'personel' && tahsilSekli.startsWith('maas')) {
        const personId = tahsilModal.kalem.personId;
        if (!personId) { alert('Bu borçlu bir personele bağlı değil; maaştan kesilemez. "Hesaba Nakit" seçin.'); return; }
        setTahsilKaydediliyor(true);
        try {
          // 1) Şirket borcunu (maas_yearly borclanma) düş
          const yilStr = String(new Date().getFullYear());
          const yRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas_yearly', yilStr);
          const ySnap = await getDoc(yRef);
          const yRec = ySnap.exists() ? (ySnap.data().records || {}) : {};
          const mevcutBorc = parseFloat(yRec[personId]?.borclanma) || 0;
          yRec[personId] = { ...(yRec[personId] || {}), borclanma: String(Math.max(0, mevcutBorc - tutar)) };
          await setDoc(yRef, { records: yRec }, { merge: true });
          // 2) O ayki maaş kanalına kesinti işle (mavi/beyaz doc'u kişiye göre bul)
          const [ky, kmo] = odemeAyi.split('-').map(Number);
          const kesintiAlan = tahsilSekli === 'maas_banka' ? 'maasKesintiBanka' : 'maasKesintiNakit';
          for (const docAdi of [`${ky}_${kmo}`, `beyaz_${ky}_${kmo}`]) {
            const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', docAdi);
            const mSnap = await getDoc(mRef);
            if (!mSnap.exists()) continue;
            const recs = mSnap.data().records || {};
            if (!recs[personId]) continue; // bu kişi bu yakada değil
            recs[personId][kesintiAlan] = String((parseFloat(recs[personId][kesintiAlan]) || 0) + tutar);
            await setDoc(mRef, { records: recs, updatedAt: new Date().toISOString() }, { merge: true });
            break;
          }
          addSystemLog?.('Personel Borcu Maaştan Kesildi',
            `${tahsilModal.kalem.ad}: ₺${paraFmt(tutar)} borç, ${tahsilSekli === 'maas_banka' ? 'Kalan Banka' : 'Kalan Nakit'} maaşından kesilerek tahsil edildi.${kismiOdeme ? ` Kalan borç: ₺${paraFmt(kalacak)}` : ''}`);
          setTahsilModal(null);
        } catch (e) { console.error('Maaştan kesinti başarısız:', e); alert('İşlem kaydedilemedi. Lütfen tekrar deneyin.'); }
        finally { setTahsilKaydediliyor(false); }
        return; // hesaba nakit akışına girme
      }
      const hedef = defterler.find(d => d.id === tahsilModal.hedefDefterId);
      const odemeId = `alacak_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const ortak = {
        tarih: tahsilModal.tarih || bugunStr(),
        kategori: 'Tahsilat', etiketler: [], odemeId,
        taksitNo: t.no, alacakKalemId: tahsilModal.kalem.id,
        alacakDefterId: seciliDefter.id, kaynak: 'Alacak Tahsilatı',
        kismiOdeme, createdAt: new Date().toISOString(),
        by: currentUser?.fullName || 'Sistem',
      };
      setTahsilKaydediliyor(true);
      try {
        // 1) HEDEF hesaba GİRİŞ — para hesaba girer (bakiye artar) ama
        //    tahsilatKaydi bayrağı sayesinde CİROYA/gelir raporlarına GİRMEZ.
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'giris', tutar, defterId: tahsilModal.hedefDefterId,
          tahsilatKaydi: true,
          odemeYontemi: defterdenOdemeYontemi(tahsilModal.hedefDefterId),
          aciklama: `${tahsilModal.kalem.ad} — ${t.no}. taksit tahsilatı${kismiNot}`,
        });
        // 2) BORÇLU defterine mahsup ÇIKIŞI — alacak azalır, ciroya girmez
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'cikis', tutar, defterId: seciliDefter.id,
          alacakMahsup: true,
          odemeYontemi: defterdenOdemeYontemi(tahsilModal.hedefDefterId),
          aciklama: `${tahsilModal.kalem.ad} ${t.no}. taksit tahsil edildi${kismiNot} → ${hedef?.ad || 'hesap'}`,
        });
        addSystemLog?.(kismiOdeme ? 'Kısmi Tahsilat Yapıldı' : 'Tahsilat Yapıldı',
          `${tahsilModal.kalem.ad}: ${t.no}. taksit ₺${paraFmt(tutar)} — ${hedef?.ad || '-'} hesabına alındı (ciroya eklenmez).${kismiOdeme ? ` Kalan: ₺${paraFmt(kalacak)}` : ''}`);
        setTahsilModal(null);
      } catch (e) { console.error('Tahsilat kaydedilemedi:', e); alert('Tahsilat kaydedilemedi. Lütfen tekrar deneyin.'); }
      finally { setTahsilKaydediliyor(false); }
    };

    const devirKaydet = async () => {
      if (!devirModal) return;
      const tutar = parseFloat(devirModal.tutar) || 0;
      if (tutar <= 0) { alert('Geçerli bir devir tutarı girin.'); return; }
      const tarih = devirModal.tarih || bugunStr();
      if (tarih < SISTEM_DEVIR_TARIHI) {
        alert(`Devir tarihi ${SISTEM_DEVIR_TARIHI.split('-').reverse().join('.')} gününden önce olamaz.`);
        return;
      }
      setDevirKaydediliyor(true);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          defterId: devirModal.defter.id,
          tip: devirModal.yon, // 'giris' = kasada var / alacak, 'cikis' = borç
          tutar,
          tarih,
          kategori: 'Devir',
          etiketler: [],
          devirKaydi: true, // ciro raporlarından dışlanmasını sağlayan damga
          odemeYontemi: devirModal.defter.tur === 'Nakit' ? 'nakit' : 'banka',
          aciklama: `Devir tutarı — sistem geçişi (eski uygulamadan aktarılan ${devirModal.yon === 'giris' ? 'kasa/alacak' : 'borç'} bakiyesi)${devirModal.not ? ` • ${devirModal.not}` : ''}`,
          kaynak: 'Devir',
          createdAt: new Date().toISOString(),
          by: currentUser?.fullName || 'Sistem',
        });
        addSystemLog?.('Devir Tutarı Girildi',
          `${devirModal.defter.ad}: ₺${paraFmt(tutar)} ${devirModal.yon === 'giris' ? 'kasada var/alacak' : 'borç'} olarak devredildi (${tarih.split('-').reverse().join('.')}). Ciroya dahil edilmedi.`);
        setDevirModal(null);
      } catch (e) { console.error('Devir kaydedilemedi:', e); alert('Devir kaydedilemedi. Lütfen tekrar deneyin.'); }
      finally { setDevirKaydediliyor(false); }
    };

    // --- Defter işlemleri ---
    const handleSaveDefter = async () => {
      if (!defterForm.ad.trim()) return;
      // DEĞİŞTİ: Kredi bilgileri defter formunda sorulmadığı için burada
      // doğrulama yapılmaz; krediler defterin içinden tek tek eklenir ve
      // zorunlu alan denetimi kredi kalemi formunda yapılır.
      // Form kredi alt nesnesini artık Firestore'a yazmaz — mevcut kayıtlardaki
      // krediler dizisine dokunulmaz (updateDoc yalnızca verilen alanları değiştirir).
      const { kredi: _formKredi, ...kayitVerisi } = defterForm;
      if (editingDefterId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', editingDefterId), { ...kayitVerisi });
        addSystemLog?.('Defter Güncellendi', `"${defterForm.ad}" defteri düzenlendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'), {
          ...kayitVerisi, createdAt: new Date().toISOString(), createdBy: currentUser?.fullName || 'Sistem'
        });
        addSystemLog?.('Yeni Defter', `"${defterForm.ad}" defteri açıldı.`);
      }
      setShowDefterForm(false); setEditingDefterId(null); setDefterForm({ ad: '', tur: 'Nakit', not: '', blok: VARSAYILAN_BLOK, kredi: bosKrediForm });
    };

    // ========================================================================
    // YENİ: TAKSİT ÖDEME — iki bacaklı kayıt
    // ========================================================================
    // 1) KAYNAK DEFTERDE ÇIKIŞ: gerçek para çıkışıdır, gidere yazılır.
    // 2) KREDİ DEFTERİNDE GİRİŞ: borcun azalmasıdır, GERÇEK GELİR DEĞİLDİR;
    //    bu yüzden krediMahsup:true ile ciro toplamlarından dışlanır. Aksi halde
    //    her taksit ödemesi hem gelir hem gider olarak sayılır, ciro şişerdi.
    // İki kayıt aynı odemeId ile bağlanır; geri alınmak istenirse ikisi birden
    // bulunabilir. taksitNo alanı, planda hangi taksitin ödendiğini belirler.
    // ========================================================================
    const taksitOde = async () => {
      if (!taksitOdeme?.taksit || !seciliDefter) return;
      if (!taksitOdeme.kaynakDefterId) { alert('Ödemenin hangi hesaptan yapıldığını seçin.'); return; }
      const t = taksitOdeme.taksit;
      // YENİ (kullanıcı talebi): KISMİ ÖDEME — tutar artık formdan gelir.
      // Kalandan az girilirse taksit kapanmaz, kalan tutarla beklemeye devam eder.
      const taksitKalan = t.kalan ?? t.tutar;
      const tutar = parseFloat(taksitOdeme.tutar ?? taksitKalan) || 0;
      if (tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      if (tutar > taksitKalan + 0.01) {
        alert(`Kalan tutardan fazla ödeme yapılamaz.\n\nBu taksit için kalan: ₺${paraFmt(taksitKalan)}`);
        return;
      }
      const kismiOdeme = tutar < taksitKalan - 0.01;
      const kalacak = Math.max(0, taksitKalan - tutar);
      const kismiNot = kismiOdeme ? ` (kısmi ödeme — kalan ₺${paraFmt(kalacak)})` : '';
      const kaynak = defterler.find(d => d.id === taksitOdeme.kaynakDefterId);
      const odemeId = `kredi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const ortak = {
        tarih: taksitOdeme.tarih || bugunStr(),
        kategori: 'Kredi Taksiti',
        etiketler: [],
        krediMahsup: false,
        odemeId,
        taksitNo: t.no,
        krediDefterId: seciliDefter.id,
        // YENİ: hangi krediye ait olduğu — bir defterde birden çok kredi olabilir
        krediKalemId: taksitOdeme.kalem?.id || null,
        kaynak: 'Kredi Ödemesi',
        kismiOdeme,
        createdAt: new Date().toISOString(),
        by: currentUser?.fullName || 'Sistem',
      };
      setTaksitKaydediliyor(true);
      try {
        // 1) Ödemenin yapıldığı hesaptan ÇIKIŞ (gerçek gider)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'cikis', tutar,
          defterId: taksitOdeme.kaynakDefterId,
          odemeYontemi: defterdenOdemeYontemi(taksitOdeme.kaynakDefterId),
          aciklama: `${taksitOdeme.kalem?.ad || taksitOdeme.kalem?.bankaAdi || seciliDefter.ad} — ${t.no}. taksit ödemesi${kismiNot}`,
        });
        // 2) Kredi defterinde GİRİŞ (borç azalması — ciroya girmez)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'giris', tutar,
          defterId: seciliDefter.id,
          krediMahsup: true,
          odemeYontemi: defterdenOdemeYontemi(taksitOdeme.kaynakDefterId),
          aciklama: `${taksitOdeme.kalem?.ad || taksitOdeme.kalem?.bankaAdi || 'Kredi'} ${t.no}. taksit${kismiNot} ← ${kaynak?.ad || 'hesap'}`,
        });
        addSystemLog?.(kismiOdeme ? 'Kredi Taksiti Kısmi Ödendi' : 'Kredi Taksiti Ödendi',
          `${seciliDefter.ad}: ${t.no}. taksit ₺${paraFmt(tutar)} — ${kaynak?.ad || '-'} hesabından ödendi.${kismiOdeme ? ` Kalan: ₺${paraFmt(kalacak)}` : ''}`);
        setTaksitOdeme(null);
      } catch (e) {
        console.error('Taksit ödemesi kaydedilemedi:', e);
        alert('Taksit ödemesi kaydedilemedi. Lütfen tekrar deneyin.');
      } finally {
        setTaksitKaydediliyor(false);
      }
    };

    // ========================================================================
    // YENİ: KREDİ KALEMİ KAYDET / SİL
    // Krediler defterin krediler dizisinde tutulur (Ödemeler ile aynı desen).
    // Böylece tek bir "KREDİLER" defterinde şirketin tüm kredileri toplanır.
    // ========================================================================
    const krediKalemiKaydet = async () => {
      if (!seciliDefter || !krediKalemForm) return;
      const f = krediKalemForm;
      if (!f.ad.trim() && !f.bankaAdi.trim()) { alert('Kredi adı veya banka girin (örn: Taşıt Kredisi).'); return; }
      if (!(parseFloat(f.toplamGeriOdeme) > 0)) { alert('"Toplam Geri Ödeme" girilmelidir.'); return; }
      if (!(parseInt(f.taksitSayisi) > 0)) { alert('"Taksit Sayısı" girilmelidir.'); return; }
      if (!f.ilkTaksitTarihi) { alert('"İlk Taksit Tarihi" seçilmelidir.'); return; }
      const mevcut = krediKalemleri(seciliDefter).filter(k => k.id !== '__eski__');
      const kalem = { ...f, id: f.id && f.id !== '__eski__' ? f.id : `kr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
      const yeniListe = (f.id && f.id !== '__eski__')
        ? mevcut.map(k => k.id === kalem.id ? kalem : k)
        : [...mevcut, kalem];
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), { krediler: yeniListe });
        addSystemLog?.('Kredi Kalemi', `${seciliDefter.ad}: "${kalem.ad || kalem.bankaAdi}" ${f.id ? 'güncellendi' : 'eklendi'} (₺${paraFmt(kalem.toplamGeriOdeme)}).`);
        setKrediKalemForm(null);
      } catch (e) { console.error(e); alert('Kredi kaydedilemedi.'); }
    };

    const krediKalemiSil = async (kalemId) => {
      if (!seciliDefter) return;
      const kalem = krediKalemleri(seciliDefter).find(k => k.id === kalemId);
      // Yapılmış taksit ödemeleri SİLİNMEZ; yalnızca kredi planı kaldırılır.
      if (!window.confirm(`"${kalem?.ad || kalem?.bankaAdi}" kredi planı kaldırılsın mı?\n\nDaha önce yapılmış taksit ödemeleri silinmez, defterde kalır.`)) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), {
          krediler: krediKalemleri(seciliDefter).filter(k => k.id !== kalemId && k.id !== '__eski__')
        });
        addSystemLog?.('Kredi Kalemi Silindi', `${seciliDefter.ad}: "${kalem?.ad || kalem?.bankaAdi}" planı kaldırıldı.`);
      } catch (e) { console.error(e); alert('Kredi silinemedi.'); }
    };

    // ========================================================================
    // YENİ: ÖDEME KALEMİ KAYDET / SİL
    // Kalemler defter dokümanındaki odemeler dizisinde tutulur. Ayrı koleksiyon
    // açmak yerine dizi tercih edildi: kalem sayısı sınırlıdır (kira, sigorta,
    // vergi gibi onlarca kalem) ve defterle birlikte tek okumada gelir.
    // ========================================================================
    const odemeKalemiKaydet = async () => {
      if (!seciliDefter || !odemeKalemForm) return;
      if (!odemeKalemForm.ad.trim()) { alert('Ödeme adı girin (örn: Dükkan Kirası).'); return; }
      if (!(parseFloat(odemeKalemForm.tutar) > 0)) { alert('Geçerli bir tutar girin.'); return; }
      if (!odemeKalemForm.ilkTarih) { alert('İlk ödeme tarihini seçin.'); return; }
      const mevcut = seciliDefter.odemeler || [];
      const kalem = {
        ...odemeKalemForm,
        // Yeni kalemse benzersiz kimlik üretilir; düzenlemede mevcut kimlik korunur
        id: odemeKalemForm.id || `ok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tutar: String(parseFloat(odemeKalemForm.tutar)),
        // Tek seferlikte tekrar sayısı anlamsızdır
        tekrarSayisi: odemeKalemForm.tekrar === 'tek' ? '' : odemeKalemForm.tekrarSayisi,
        // YENİ: IBAN'lar boşluksuz/büyük harf saklanır (kopyalarken temiz gelsin);
        // hem ismi hem numarası boş olan satırlar atılır.
        ibanlar: (odemeKalemForm.ibanlar || [])
          .map(s => ({
            id: s.id || `ib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            isim: (s.isim || '').trim(),
            iban: (s.iban || '').replace(/\s+/g, '').toUpperCase(),
            tur: s.tur === 'sahsi' ? 'sahsi' : 'resmi',
          }))
          .filter(s => s.isim || s.iban),
      };
      const yeniListe = odemeKalemForm.id
        ? mevcut.map(k => k.id === kalem.id ? kalem : k)
        : [...mevcut, kalem];
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), { odemeler: yeniListe });
        addSystemLog?.('Ödeme Kalemi', `${seciliDefter.ad}: "${kalem.ad}" ${odemeKalemForm.id ? 'güncellendi' : 'eklendi'} (₺${paraFmt(kalem.tutar)}).`);
        setOdemeKalemForm(null);
      } catch (e) { console.error(e); alert('Ödeme kalemi kaydedilemedi.'); }
    };

    // ========================================================================
    // YENİ: OTOMATİK ÖDEME YÖNETİMİ
    // ========================================================================
    // Tekrarlanan (aylık/haftalık/yıllık) kalemleri iki şekilde yönetir:
    //   • SONLANDIR: bitisTarihi yazılır -> o tarihten sonra vade üretilmez
    //     ("kiralama bitti, artık aylık borç çıkmasın")
    //   • ZAM: zamlar[] dizisine { gecerliTarih, tutar } eklenir -> o tarihten
    //     itibaren yeni tutar geçerli olur, GEÇMİŞ AYLAR eski tutarında kalır
    // Her ikisi de kalemi silmez; geçmiş ödeme kayıtları olduğu gibi durur.
    // ========================================================================
    const [otomatikYonetim, setOtomatikYonetim] = useState(false);
    const [yonetimForm, setYonetimForm] = useState(null); // { kalemId, mod:'bitis'|'zam', tarih, tutar }
    const [yonetimKaydediliyor, setYonetimKaydediliyor] = useState(false);

    const otomatikOdemeGuncelle = async () => {
      if (!yonetimForm || !seciliDefter) return;
      const { kalemId, mod, tarih, tutar } = yonetimForm;
      if (!tarih) { alert('Tarih seçin.'); return; }
      if (mod === 'zam' && !(parseFloat(tutar) > 0)) { alert('Yeni tutarı girin.'); return; }
      setYonetimKaydediliyor(true);
      try {
        const yeniListe = (seciliDefter.odemeler || []).map(k => {
          if (k.id !== kalemId) return k;
          if (mod === 'bitis') return { ...k, bitisTarihi: tarih };
          const zamlar = [...(k.zamlar || []).filter(z => z.gecerliTarih !== tarih),
                          { gecerliTarih: tarih, tutar: String(parseFloat(tutar)) }]
                          .sort((a, b) => a.gecerliTarih.localeCompare(b.gecerliTarih));
          return { ...k, zamlar };
        });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), { odemeler: yeniListe });
        const kalemAd = (seciliDefter.odemeler || []).find(k => k.id === kalemId)?.ad || 'Kalem';
        addSystemLog?.('Otomatik Ödeme Güncellendi', mod === 'bitis'
          ? `${kalemAd}: ${tarih} tarihinde sonlandırıldı; sonrası için borç oluşmayacak.`
          : `${kalemAd}: ${tarih} tarihinden itibaren tutar ₺${paraFmt(parseFloat(tutar))} olarak güncellendi.`);
        setYonetimForm(null);
      } catch (e) { console.error(e); alert('Güncellenemedi. Lütfen tekrar deneyin.'); }
      finally { setYonetimKaydediliyor(false); }
    };

    // Sonlandırmayı veya bir zammı geri al
    const otomatikOdemeGeriAl = async (kalemId, tur, gecerliTarih) => {
      if (!seciliDefter) return;
      if (!window.confirm(tur === 'bitis' ? 'Sonlandırma kaldırılsın mı? Ödeme yeniden aylık borç üretmeye başlar.' : 'Bu tutar değişikliği kaldırılsın mı?')) return;
      try {
        const yeniListe = (seciliDefter.odemeler || []).map(k => {
          if (k.id !== kalemId) return k;
          if (tur === 'bitis') { const { bitisTarihi, ...kalan } = k; return kalan; }
          return { ...k, zamlar: (k.zamlar || []).filter(z => z.gecerliTarih !== gecerliTarih) };
        });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), { odemeler: yeniListe });
      } catch (e) { console.error(e); alert('Geri alınamadı.'); }
    };

    const odemeKalemiSil = async (kalemId) => {
      if (!seciliDefter) return;
      const kalem = (seciliDefter.odemeler || []).find(k => k.id === kalemId);
      // Yapılmış ödemeler SİLİNMEZ; yalnızca plan kaldırılır. Geçmiş hareketler
      // defterde durmaya devam eder, muhasebe izi kaybolmaz.
      if (!window.confirm(`"${kalem?.ad}" ödeme planı kaldırılsın mı?\n\nDaha önce yapılmış ödemeler silinmez, defterde kalır.`)) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', seciliDefter.id), {
          odemeler: (seciliDefter.odemeler || []).filter(k => k.id !== kalemId)
        });
        addSystemLog?.('Ödeme Kalemi Silindi', `${seciliDefter.ad}: "${kalem?.ad}" planı kaldırıldı.`);
      } catch (e) { console.error(e); alert('Kalem silinemedi.'); }
    };

    // ========================================================================
    // YENİ: VADE ÖDEME — kredi taksitiyle aynı iki bacaklı mantık
    //   1) Kaynak hesapta ÇIKIŞ (gerçek gider, ciroya girer)
    //   2) Ödemeler defterinde GİRİŞ (izleme kaydı, odemeMahsup ile ciro dışı)
    // ========================================================================
    // ========================================================================
    // YENİ: SEÇİLİ AYIN VADELERİ
    // ========================================================================
    // Tüm kalemlerin planlarından seçili aya (odemeAyi) düşen vadeler tek
    // listede toplanır. Bekleyenler tarihe göre EN YAKINI ÜSTTE sıralanır;
    // ödenenler ayrı dizide döner (ekranda en alttaki "Ödenenler" bölümü).
    // Maaş satırları bu listeye AYRICA eklenir (render tarafında).
    // ========================================================================
    const ayinVadeleri = (defter) => {
      const bekleyen = [], odenen = [];
      (defter?.odemeler || []).forEach(kalem => {
        const bilgi = odemeKalemBilgi(defter, kalem);
        bilgi.plan.forEach(v => {
          if (!v.tarih.startsWith(odemeAyi)) return;
          const kayit = { kalem, vade: v, tur: odemeTuruBilgi(kalem.odemeTuru) };
          (v.odendi ? odenen : bekleyen).push(kayit);
        });
      });
      bekleyen.sort((a, b) => a.vade.tarih.localeCompare(b.vade.tarih));
      odenen.sort((a, b) => (a.vade.odemeTarihi || '').localeCompare(b.vade.odemeTarihi || ''));
      return { bekleyen, odenen };
    };

    // Vadeye 7 gün ve daha az kaldıysa (ve geçmemişse) yanıp sönen uyarı çıkar
    const vadeYaklasti = (tarih) => {
      const bugun = bugunStr();
      if (tarih < bugun) return false; // geçmiş: zaten GECİKMİŞ rozeti var
      const fark = (new Date(tarih) - new Date(bugun)) / 86400000;
      return fark <= 7;
    };

    // ========================================================================
    // YENİ: MAAŞ ÖDE — iki yönlü senkronun "Ödemeler -> Muhasebe" bacağı
    // ========================================================================
    // 1) Kaynak defterden ÇIKIŞ + Ödemeler defterine mahsup GİRİŞ yazılır
    //    (vadeOde ile aynı desen; kalem kimliği sentetik: maas_mavi_YYYY_M).
    // 2) maas dokümanında TÜM personellere banka+nakit tikleri atılır ve
    //    ödenen tutarlar yazılır — Personel Muhasebe ekranı da "ödendi"
    //    gösterir, kalanlar sıfırlanır.
    // ========================================================================
    const maasOde = async () => {
      const satir = maasOdeModal?.satir;
      if (!satir || !seciliDefter) return;
      if (!maasOdeModal.kaynakDefterId) { alert('Maaşın hangi hesaptan ödendiğini seçin.'); return; }
      const kaynak = defterler.find(d => d.id === maasOdeModal.kaynakDefterId);
      // ====================================================================
      // YENİ (kullanıcı talebi): KISMİ ÖDEME + PERSONEL/DEFTER ETİKETİ
      // --------------------------------------------------------------------
      // Tek personellik ödemede kullanıcı kalandan az girebilir (kısmi). Bu
      // durumda yalnızca girilen tutar deftere düşer, muhasebede o kanalın
      // "ödenenTutar"ı BİRİKTİRİLİR ve tik atılmaz; kalan azalır, satır
      // "KISMİ" olarak açık kalır. Tam ödemede eski davranış (tik atılır).
      // Toplu satırda (birden çok kişi) kısmi girilemez — tam tutar ödenir.
      // Deftere yazılan çıkış PERSONEL etiketli (ekipSefi/ekipSefiId) ve
      // kaynak DEFTER TÜRÜ etiketiyle (Banka/Nakit) açıklanır.
      // ====================================================================
      const tekKisi = satir.kisiler.length === 1 ? satir.kisiler[0] : null;
      const girilen = tekKisi
        ? (parseFloat(String(maasOdeModal.tutar ?? satir.tutar).replace(',', '.')) || 0)
        : satir.tutar;
      const tutar = girilen;
      if (tutar <= 0) { alert('Ödenecek tutar sıfır — geçerli bir tutar girin.'); return; }
      if (tutar > satir.tutar + 0.01) { alert('Girilen tutar kalandan fazla olamaz.'); return; }
      const kismiMi = tekKisi && tutar < satir.tutar - 0.01; // tam değilse kısmi
      setMaasKaydediliyor(true);
      try {
        const odemeId = `odeme_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        // Kaynak defterin türü (Banka/Nakit) etiket olarak açıklamaya yazılır
        const defterTuruEtiketi = kaynak?.tur === 'Nakit' || kaynak?.tur === 'Kasa' ? 'Nakit'
          : kaynak?.tur === 'Banka' ? 'Banka' : (kaynak?.tur || 'Hesap');
        const kanalAd = satir.kanal === 'banka' ? 'Banka' : satir.kanal === 'nakit' ? 'Nakit' : 'Maaş';
        const ortak = {
          tarih: bugunStr(), kategori: 'Personel Maaşı', etiketler: ['Maaş'],
          odemeId, vadeNo: 1, odemeKalemId: satir.id, odemeDefterId: seciliDefter.id,
          kaynak: 'Maaş Ödemesi (Oto)', createdAt: new Date().toISOString(),
          by: currentUser?.fullName || 'Sistem',
        };
        // Personel etiketi (tek kişilik ödemede)
        const etiketAlanlari = tekKisi
          ? { ekipSefi: tekKisi.person?.fullName || '', ekipSefiId: tekKisi.person?.id || null }
          : {};
        const kismiNot = kismiMi ? ' • KISMİ ÖDEME' : '';
        const kisiAd = tekKisi ? (tekKisi.person?.fullName || '') + ' — ' : '';
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, ...etiketAlanlari, tip: 'cikis', tutar, odemeMahsup: false,
          defterId: maasOdeModal.kaynakDefterId,
          odemeYontemi: defterdenOdemeYontemi(maasOdeModal.kaynakDefterId),
          aciklama: `${kisiAd}${kanalAd} Maaşı (${satir.kaynakEtiket}) • ${defterTuruEtiketi}${kismiNot}`,
        });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, ...etiketAlanlari, tip: 'giris', tutar, odemeMahsup: true,
          defterId: seciliDefter.id,
          odemeYontemi: defterdenOdemeYontemi(maasOdeModal.kaynakDefterId),
          aciklama: `${kisiAd}${kanalAd} Maaşı (${satir.kaynakEtiket})${kismiNot} ← ${kaynak?.ad || 'hesap'}`,
        });
        // 2) Muhasebe kayıtları
        const { yil, ay } = maasKaynakAy;
        const docAdi = satir.yaka === 'beyaz' ? `beyaz_${yil}_${ay}` : `${yil}_${ay}`;
        const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', docAdi);
        const mSnap = await getDoc(mRef);
        const records = mSnap.exists() ? (mSnap.data().records || {}) : {};
        satir.kisiler.forEach(k => {
          if (!records[k.person.id]) records[k.person.id] = {};
          const r = records[k.person.id];
          // TAM ödeme: tik at + o kanalın tamamını ödenen olarak yaz
          const bankaTikTam = () => { if (!r.bankaOdendi) { r.bankaOdendi = true; r.bankaOdenenTutar = String(Math.max(0, k.bankaKalan).toFixed(2)); } };
          const nakitTikTam = () => { if (!r.nakitOdendi) { r.nakitOdendi = true; r.nakitOdenenTutar = String(Math.max(0, k.kalanNakit).toFixed(2)); } };
          // KISMİ ödeme: tik ATMA, ödenen tutarı BİRİKTİR (kalan otomatik azalır)
          const bankaKismi = () => { const onceki = parseFloat(r.bankaOdenenTutar) || 0; r.bankaOdenenTutar = String((onceki + tutar).toFixed(2)); };
          const nakitKismi = () => { const onceki = parseFloat(r.nakitOdenenTutar) || 0; r.nakitOdenenTutar = String((onceki + tutar).toFixed(2)); };
          if (kismiMi) {
            if (satir.kanal === 'banka') bankaKismi();
            else if (satir.kanal === 'nakit') nakitKismi();
          } else {
            if (satir.kanal === 'banka') bankaTikTam();
            else if (satir.kanal === 'nakit') nakitTikTam();
            else { bankaTikTam(); nakitTikTam(); }
          }
        });
        await setDoc(mRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
        addSystemLog?.(kismiMi ? 'Maaş Kısmi Ödeme' : 'Maaş Ödemesi Yapıldı',
          `${satir.ad} (${satir.kaynakEtiket}) ₺${paraFmt(tutar)}${kismiMi ? ' KISMİ' : ''} — ${kaynak?.ad || '-'} (${defterTuruEtiketi}) hesabından ödendi.`);
        setMaasOdeModal(null);
      } catch (e) {
        console.error('Maaş ödemesi kaydedilemedi:', e);
        alert('Maaş ödemesi kaydedilemedi. Lütfen tekrar deneyin.');
      } finally { setMaasKaydediliyor(false); }
    };

    const vadeOde = async () => {
      if (!vadeOdeme?.vade || !seciliDefter) return;
      if (!vadeOdeme.kaynakDefterId) { alert('Ödemenin hangi hesaptan yapıldığını seçin.'); return; }
      const v = vadeOdeme.vade;
      const tutar = parseFloat(vadeOdeme.tutar ?? v.tutar) || 0;
      if (tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      // YENİ (kullanıcı talebi): KISMİ ÖDEME KONTROLÜ
      // Kalandan fazla ödeme kaydı tutarsızlık yaratır (vade iki kez kapanmış
      // gibi görünür), bu yüzden engellenir. Kalandan AZ ödeme serbesttir —
      // vade kapanmaz, kalan tutarla bekleyenlerde durmaya devam eder.
      const vadeKalan = v.kalan ?? v.tutar;
      if (tutar > vadeKalan + 0.01) {
        alert(`Kalan tutardan fazla ödeme yapılamaz.\n\nBu vade için kalan: ₺${paraFmt(vadeKalan)}`);
        return;
      }
      const kismiOdeme = tutar < vadeKalan - 0.01;   // bu ödeme vadeyi kapatmıyor
      const kalacak = Math.max(0, vadeKalan - tutar);
      const kaynak = defterler.find(d => d.id === vadeOdeme.kaynakDefterId);
      const odemeId = `odeme_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const ortak = {
        tarih: vadeOdeme.tarih || bugunStr(),
        kategori: 'Düzenli Ödeme',
        etiketler: [],
        odemeId,
        vadeNo: v.no,
        odemeKalemId: vadeOdeme.kalem.id,
        odemeDefterId: seciliDefter.id,
        kaynak: 'Ödeme Planı',
        // YENİ: kayıt kısmi mi? Açıklamada ve ileride raporlamada kullanılır.
        kismiOdeme,
        createdAt: new Date().toISOString(),
        by: currentUser?.fullName || 'Sistem',
      };
      // Açıklamaya kısmi ödeme notu düşülür ki hesap ekstresinde de anlaşılsın
      const kismiNot = kismiOdeme ? ` (kısmi ödeme — kalan ₺${paraFmt(kalacak)})` : '';
      setTaksitKaydediliyor(true);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'cikis', tutar, odemeMahsup: false,
          defterId: vadeOdeme.kaynakDefterId,
          odemeYontemi: defterdenOdemeYontemi(vadeOdeme.kaynakDefterId),
          aciklama: `${vadeOdeme.kalem.ad} — ${v.no}. ödeme${kismiNot}`,
        });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'giris', tutar, odemeMahsup: true,
          defterId: seciliDefter.id,
          odemeYontemi: defterdenOdemeYontemi(vadeOdeme.kaynakDefterId),
          aciklama: `${vadeOdeme.kalem.ad} ${v.no}. ödeme${kismiNot} ← ${kaynak?.ad || 'hesap'}`,
        });
        addSystemLog?.(kismiOdeme ? 'Kısmi Ödeme Yapıldı' : 'Düzenli Ödeme Yapıldı',
          `${vadeOdeme.kalem.ad} ${v.no}. ödeme ₺${paraFmt(tutar)} — ${kaynak?.ad || '-'} hesabından ödendi.${kismiOdeme ? ` Kalan: ₺${paraFmt(kalacak)}` : ''}`);
        setVadeOdeme(null);
      } catch (e) {
        console.error('Ödeme kaydedilemedi:', e);
        alert('Ödeme kaydedilemedi. Lütfen tekrar deneyin.');
      } finally { setTaksitKaydediliyor(false); }
    };

    const handleDeleteDefter = async () => {
      const d = defterler.find(x => x.id === deleteDefterId);
      // Defterle birlikte tüm işlemleri de silinir
      for (const i of defterIslemleri(deleteDefterId)) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', i.id));
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', deleteDefterId));
      addSystemLog?.('Defter Silindi', `"${d?.ad}" defteri ve tüm işlemleri silindi.`);
      setDeleteDefterId(null);
      if (seciliDefterId === deleteDefterId) setSeciliDefterId(null);
    };

    // --- İşlem kayıtları ---
    // Defter türünden eski "ödeme yöntemi" etiketini türetir (geriye uyum için).
    // Kayıttaki odemeYontemi alanı listede rozet olarak gösterildiği ve eski
    // kayıtlarda arandığı için korunuyor; artık elle seçilmiyor, hesabın
    // türünden otomatik geliyor.
    const defterdenOdemeYontemi = (defterId) => {
      const tur = defterler.find(d => d.id === defterId)?.tur;
      if (tur === 'Banka') return 'Banka / Havale';
      if (tur === 'Kredi Kartı' || tur === 'Cari (Kişi/Firma)') return 'Kredi Kartı';
      if (tur === 'Nakit' || tur === 'Kasa') return 'Nakit';
      if (tur === 'Borçlu' || tur === 'Diğer') return 'Diğer';
      return 'Nakit';
    };

    const handleSaveIslem = async () => {
      const tutar = parseFloat(islemForm.tutar);
      if (!tutar || tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      // DEĞİŞTİ: Hedef defter seçildiyse işlem ORAYA yazılır (taşıma).
      // Seçilmediyse eski davranış: o an açık olan defter.
      const kayitDefterId = islemForm.hedefDefterId || seciliDefterId;
      const tasindiMi = editingIslemId && kayitDefterId !== seciliDefterId;
      // hedefDefterId yalnızca form içi bir alan — Firestore'a yazılmaz
      const { hedefDefterId, ...formVerisi } = islemForm;
      const kayit = {
        ...formVerisi,
        tutar,
        // Etiketler virgülle ayrılır, boşluklar temizlenir
        // DEĞİŞİKLİK: Artık dizi geldiği için split gerekmez; yalnızca boşlar ayıklanır.
        etiketler: (islemForm.etiketler || []).filter(Boolean),
        // Ödeme yöntemi artık hesabın türünden türetilir (elle seçilmiyor)
        odemeYontemi: defterdenOdemeYontemi(kayitDefterId),
        defterId: kayitDefterId,
      };
      if (editingIslemId) {
        // YENİ (kullanıcı talebi): düzenlenen işleme damga vurulur; satırda
        // mavi "DÜZENLENDİ" rozeti olarak görünür.
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', editingIslemId), {
          ...kayit, duzenlendi: true, duzenlenmeTarihi: new Date().toISOString(), duzenleyen: currentUser?.fullName || 'Sistem',
        });
        const hedefAd = defterler.find(d => d.id === kayitDefterId)?.ad || '-';
        addSystemLog?.('Defter İşlemi Güncellendi',
          tasindiMi
            ? `${seciliDefter?.ad} -> ${hedefAd}: ₺${paraFmt(tutar)} tutarındaki işlem başka hesaba taşındı.`
            : `${seciliDefter?.ad}: ${kayit.tip === 'giris' ? 'Giriş' : 'Çıkış'} ₺${paraFmt(tutar)} düzenlendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...kayit, kaynak: 'Manuel', createdAt: new Date().toISOString(), by: currentUser?.fullName || 'Sistem'
        });
        addSystemLog?.('Defter İşlemi', `${seciliDefter?.ad}: ${kayit.tip === 'giris' ? 'PARA GİRİŞİ' : 'PARA ÇIKIŞI'} ₺${paraFmt(tutar)} (${kayit.kategori}).`);
      }
      setShowIslemForm(false); setEditingIslemId(null); setIslemForm(emptyIslem);
    };

    // ========================================================================
    // VİRMAN (HESAPLAR ARASI TRANSFER)
    // ========================================================================
    // Bir transfer İKİ kayıt üretir:
    //   - Kaynak defterde  ÇIKIŞ (cikis)
    //   - Hedef defterde   GİRİŞ (giris)
    // İkisi aynı virmanId ile bağlanır; böylece biri silinirse diğeri de
    // silinebilir ve raporlarda çift kayıt olduğu anlaşılır.
    //
    // isVirman: true bayrağı KRİTİK. Gelir/gider toplamları bu bayrağa bakarak
    // transferleri dışlar (bkz. ciroyaGirer). Bayrak olmasa 10.000 TL'lik bir
    // transfer hem toplam gelire hem toplam gidere 10.000 eklerdi.
    //
    // Etiket ve kategori girişi YOKTUR — transfer bir harcama kalemi değil,
    // paranın yer değiştirmesi. Açıklama opsiyoneldir.
    const handleVirmanKaydet = async () => {
      const tutar = parseFloat(virmanForm.tutar);
      if (!tutar || tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      if (!virmanForm.hedefDefterId) { alert('Transfer edilecek hedef defteri seçin.'); return; }
      if (virmanForm.hedefDefterId === seciliDefterId) { alert('Kaynak ve hedef defter aynı olamaz.'); return; }

      const hedefDefter = defterler.find(d => d.id === virmanForm.hedefDefterId);
      if (!hedefDefter) { alert('Hedef defter bulunamadı.'); return; }

      // Bakiyesi yetmiyorsa uyar ama ENGELLEME: nakit avans gibi durumlarda
      // defter geçici olarak eksiye düşebilir, bu geçerli bir iş durumu.
      const mevcutBakiye = defterBakiye(seciliDefterId);
      if (tutar > mevcutBakiye) {
        if (!window.confirm(`${seciliDefter.ad} bakiyesi ₺${paraFmt(mevcutBakiye)}. ₺${paraFmt(tutar)} transfer edilirse bakiye eksiye düşer. Devam edilsin mi?`)) return;
      }

      setVirmanKaydediliyor(true);
      try {
        // Aynı transferin iki bacağını bağlayan kimlik
        const virmanId = `vir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const yapan = currentUser?.fullName || 'Sistem';
        const not = (virmanForm.aciklama || '').trim();
        const ortak = {
          tutar,
          tarih: gunFiltreAktif ? seciliGun : bugunStr(),
          kategori: 'Virman (Transfer)',
          etiketler: [],
          odemeYontemi: 'Virman',
          isVirman: true,
          virmanId,
          kaynak: 'Virman',
          createdAt: new Date().toISOString(),
          by: yapan
        };

        // Kaynak defter: ÇIKIŞ. Açıklamada NEREYE gittiği yazar.
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak,
          defterId: seciliDefterId,
          tip: 'cikis',
          aciklama: `Transfer → ${hedefDefter.ad}${not ? ` | ${not}` : ''}`,
          virmanKarsiDefterId: virmanForm.hedefDefterId,
          virmanKarsiDefterAd: hedefDefter.ad
        });

        // Hedef defter: GİRİŞ. Açıklamada NEREDEN geldiği yazar.
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak,
          defterId: virmanForm.hedefDefterId,
          tip: 'giris',
          aciklama: `Transfer ← ${seciliDefter.ad}${not ? ` | ${not}` : ''}`,
          virmanKarsiDefterId: seciliDefterId,
          virmanKarsiDefterAd: seciliDefter.ad
        });

        addSystemLog?.('Virman (Transfer)',
          `${seciliDefter.ad} → ${hedefDefter.ad} arasında ₺${paraFmt(tutar)} transfer edildi. İşlemi yapan: ${yapan}.`);

        setShowVirmanForm(false);
        setVirmanForm({ hedefDefterId: '', tutar: '', aciklama: '' });
      } catch (err) {
        console.error('Virman kaydedilemedi:', err);
        alert('Transfer kaydedilemedi: ' + (err?.message || 'bilinmeyen hata'));
      }
      setVirmanKaydediliyor(false);
    };

    // DEĞİŞTİ (kullanıcı talebi): SİLME artık YUMUŞAK — kayıt veritabanından
    // kaldırılmaz, silindi damgası vurulur. Satır listede soluk ve "İŞLEM
    // SİLİNDİ" etiketiyle kalır; bakiye, ciro ve tüm hesaplardan düşülür
    // (hesabaKatilir/ciroyaGirer bunu dışlar). Böylece hem iz kaybolmaz hem
    // yanlışlıkla silmenin kaydı görünür kalır.
    const handleDeleteIslem = async () => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', deleteIslemId), {
        silindi: true, silinmeTarihi: new Date().toISOString(), silen: currentUser?.fullName || 'Sistem',
      });
      addSystemLog?.('Defter İşlemi Silindi', `${seciliDefter?.ad} defterinden bir kayıt silindi (izli silme — satırda görünür).`);
      setDeleteIslemId(null);
    };

    // ======================== DEFTER LİSTESİ GÖRÜNÜMÜ ========================
    // ========================================================================
    // ÖDEMESİ BEKLENEN İŞLER (soluk satırlar)
    // ========================================================================
    // KONUM NOTU (KRİTİK): Bu iki useMemo, aşağıdaki "if (!seciliDefter)"
    // erken return'ünden ÖNCE durmak ZORUNDADIR. Önceden return'den SONRA
    // duruyorlardı: defter listesindeyken hiç çalışmıyor, bir deftere
    // girilince çalışıyorlardı. Hook sayısı render'lar arasında değiştiği
    // için React #310 hatası ("Rendered more hooks than during the previous
    // render") oluşuyor ve defter detayı hiç açılmıyordu.
    // React'te hook'lar her render'da AYNI sayıda ve AYNI sırada çağrılmalıdır;
    // koşullu return'lerin ÜSTÜNDE tutulmaları bunun tek güvencesidir.
    //
    // İşlev: İş gelirlerinin otomatik düştüğü BANKA defteri açıkken, seçili
    // günün HENÜZ SONLANDIRILMAMIŞ işleri listenin en üstünde soluk kartlar
    // olarak gösterilir. Bunlar deftere yazılmış kayıtlar değildir; iş
    // kapatılınca yöntemine göre ilgili deftere gerçek satır olarak düşer.
    // ========================================================================
    const bekleyenIsDefteriId = useMemo(() => odemeIcinDefterBul(defterler, 'Banka')?.id || null, [defterler]);
    // ========================================================================
    // YENİ (kullanıcı talebi): "Ödemesi Bekleniyor" bölümü artık SADECE Banka
    // defterinde değil, Nakit (Kasa) ve Kredi Kartı (İşyerim POS) defterlerinde
    // de BİREBİR AYNI tasarım ve sıralamayla görünür. Aşağıdaki bekleyenIsler
    // AYNI JSX bloğuyla render edildiği için (bkz. render kısmı) ayrı bir
    // tasarım kodu yazmaya gerek kalmadı — hangi defter seçiliyse o üçünden
    // biri mi diye bakılıyor.
    // NOT: "Başka Deftere Taşınan Ödeme Bildirimi" (tasinanOdemeler, aşağıda)
    // BİLİNÇLİ OLARAK bu kümeye dahil EDİLMEDİ — o bildirim "bu iş bankaya
    // değil başka bir deftere taşındı" anlamına geldiği için sadece Banka'da
    // anlamlıdır; Nakit/Kredi Kartı defterinde göstermek kendi kendine
    // gönderme gibi kafa karıştırıcı olurdu.
    // ========================================================================
    const bekleyenIslerGorunurDefterIdleri = useMemo(() => {
      const idler = new Set();
      const bankaD = odemeIcinDefterBul(defterler, 'Banka'); if (bankaD) idler.add(bankaD.id);
      const nakitD = odemeIcinDefterBul(defterler, 'Nakit'); if (nakitD) idler.add(nakitD.id);
      const posD = odemeIcinDefterBul(defterler, 'Kredi Kartı'); if (posD) idler.add(posD.id);
      return idler;
    }, [defterler]);
    const bekleyenIsler = useMemo(() => {
      if (!seciliDefterId || !bekleyenIslerGorunurDefterIdleri.has(seciliDefterId)) return [];
      // ======================================================================
      // DEĞİŞTİ (kullanıcı talebi): TAMAMLANMAYAN ÖDEMELER HER GÜN GÖRÜNÜR
      // ======================================================================
      // ESKİ: Yalnızca bakılan GÜNÜN bekleyen işleri listeleniyordu; dün
      // tamamlanmayan bir ödeme bugüne geçince listeden kayboluyor, gözden
      // kaçıyordu.
      // YENİ: İş sonlandırılana (ya da iptal edilene) kadar TARİHTEN BAĞIMSIZ
      // olarak listede kalır — hangi güne bakarsanız bakın, "Tüm Zamanlar"da
      // da en üstte durur. Sıralama: en ESKİ bekleyen en üstte (en çok geciken
      // önce görünsün), aynı gün içindekiler saate göre.
      //
      // İKİ SINIR (kullanıcı talebi):
      //   1) KAPATMA TARİHİ: 23.08.2026 ve ÖNCESİ tüm geciken ödemeler
      //      "alınmış" kabul edilir ve listede GÖSTERİLMEZ (eski birikmiş
      //      kayıtlar ekranı doldurmasın). Tek satırdan yönetilir.
      //   2) GELECEK TARİH: Günü GELMEMİŞ işler gösterilmez. Bugün 26.08 ise
      //      27.08 ve sonrası listede yer almaz; günü geldikçe kendiliğinden
      //      görünür. Ödemesi kapanmazsa ertesi gün "1 GÜN GECİKTİ" olur.
      const BEKLEYEN_KAPATMA_TARIHI = '2026-08-23'; // bu tarih DAHİL kapatıldı
      const bugunBek = bugunStr();
      return (jobs || [])
        .filter(j => j && j.status !== 'completed' && j.status !== 'cancelled' && !j.endJobDetails)
        .filter(j => (j.date || '') > BEKLEYEN_KAPATMA_TARIHI)   // 23.08 ve öncesi kapatıldı
        .filter(j => (j.date || '') <= bugunBek)                 // günü gelmeyen görünmez
        .map(j => ({
          ...j,
          bekleyenTutar: Math.max(0, (parseFloat(j.price) || 0) - (parseFloat(j.deposit) || 0)),
          // Kaç gün geciktiği (bugüne göre); 0 = bugünün işi
          gecikmeGunu: Math.max(0, Math.round((new Date(bugunBek) - new Date(j.date || bugunBek)) / 86400000)),
        }))
        // ====================================================================
        // YENİ: ÜCRETSİZ ASANSÖR İŞLERİ LİSTELENMEZ (kullanıcı talebi)
        // ====================================================================
        // Kendi nakliye işimize verdiğimiz asansör hizmeti ücretsizdir; müşteri
        // ayrıca ödeme yapmaz. Bunlar "ödemesi bekleniyor" listesinde ₺0,00
        // satırı olarak görünüp listeyi kalabalıklaştırıyordu — bekleyen para
        // yokken bekleme kaydı da olmamalı.
        // NOT: Yalnızca ASANSÖR + tutar 0 olanlar gizlenir. Fiyatı henüz
        // girilmemiş bir NAKLİYE işi ₺0 olsa bile listede kalır; orada sıfır
        // "eksik veri" demektir ve gözden kaçmaması gerekir.
        // ====================================================================
        .filter(j => !((j.type === 'Asansör' || j.type === 'asansor') && j.bekleyenTutar <= 0))
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    }, [jobs, seciliDefterId, bekleyenIslerGorunurDefterIdleri]);

    // ========================================================================
    // YENİ (kullanıcı talebi): BAŞKA DEFTERE TAŞINAN ÖDEME BİLDİRİMİ
    // ========================================================================
    // Banka defterinde "ödemesi bekleniyor" olarak duran bir iş, sonlandırma
    // sırasında NAKİT / KREDİ KARTI / ÖDEME ALINMADI seçilirse parası başka bir
    // deftere (Kasa, POS ya da Tahsil Bekleyen) yazılır ve banka defterinden
    // kaybolur. Nereye gittiği görünmediği için "ödeme kayboldu" izlenimi
    // oluşuyordu. Artık BİLGİ AMAÇLI, tek satırlık bir bildirim olarak
    // yalnızca BANKA defterinde gösterilir. Hesaplara hiçbir etkisi yoktur;
    // yalnızca son 30 günün kayıtları listelenir ki liste şişmesin.
    const tasinanOdemeler = useMemo(() => {
      if (!seciliDefterId || seciliDefterId !== bekleyenIsDefteriId) return [];
      const bugun = bugunStr();
      const [by, bm, bg] = bugun.split('-').map(Number);
      const otuzGunOnce = new Date(by, bm - 1, bg - 30);
      const sinir = `${otuzGunOnce.getFullYear()}-${String(otuzGunOnce.getMonth() + 1).padStart(2, '0')}-${String(otuzGunOnce.getDate()).padStart(2, '0')}`;
      const hedefAd = (yontem) => {
        if (yontem === 'Nakit') return 'NAKİT DEFTERİNE TAŞINDI';
        if (yontem === 'Kredi Kartı' || yontem === 'KrediKarti') return 'KREDİ KARTI DEFTERİNE TAŞINDI';
        if (yontem === 'Ödeme Alınmadı') return 'TAHSİL BEKLEYEN (BORÇLU) DEFTERİNE TAŞINDI';
        return null;
      };
      return (jobs || [])
        .filter(j => {
          if (!j || j.status !== 'completed' || !j.endJobDetails) return false;
          if ((j.date || '') < sinir) return false;                       // yalnızca son 30 gün
          const y = j.endJobDetails.paymentMethod;
          return y === 'Nakit' || y === 'Kredi Kartı' || y === 'KrediKarti' || y === 'Ödeme Alınmadı';
        })
        .map(j => ({
          ...j,
          tutar: Math.max(0, (parseFloat(j.price) || 0) - (parseFloat(j.deposit) || 0)),
          yontem: j.endJobDetails.paymentMethod,
          hedefEtiket: hedefAd(j.endJobDetails.paymentMethod),
        }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));      // en yeni üstte
    }, [jobs, seciliDefterId, bekleyenIsDefteriId]);

    // ========================================================================
    // YENİ: ÖDEMELER DEFTERİ — AYLIK GÖRÜNÜM + OTOMATİK MAAŞ SATIRLARI
    // ========================================================================
    // (Hook'lar erken return'den ÖNCE — React #310 dersi unutulmadı.)
    //
    // odemeAyi: 'YYYY-MM' — Ödemeler defterinde hangi ayın vadelerine
    // bakıldığı. Sağ/sol oklarla gezilir, varsayılan bugünün ayı.
    //
    // MAAŞ KURALI (kullanıcı): "Temmuz maaşı Ağustos'un 6'sında ödenir."
    // Yani seçili ayda görünen maaş satırının KAYNAK AYI bir önceki aydır:
    // Ağustos görünümü -> Temmuz'un maas/mesai dokümanları okunur, vade
    // tarihi Ağustos'un 6'sıdır. Mavi ve beyaz yaka AYRI iki satırdır.
    //
    // TAMAMLANMA (iki yönlü senkron):
    //   1) Muhasebe -> Ödemeler: tik atılmamış (bankaOdendi/nakitOdendi
    //      false) kalanların toplamı 0'a inerse satır kendiliğinden
    //      "Ödenenler" bölümüne düşer. Yazma yok, canlı hesap.
    //   2) Ödemeler -> Muhasebe: "Öde" düğmesi hem defterlere gerçek para
    //      hareketini yazar hem maas dokümanındaki TÜM personellere
    //      banka/nakit tiklerini atar (aşağıda maasOde fonksiyonu).
    // ========================================================================
    const [odemeAyi, setOdemeAyi] = useState(bugunStr().slice(0, 7));
    const [maasVeri, setMaasVeri] = useState(null); // { mavi:{maas,mesai}, beyaz:{maas,mesai}, kaynakAnahtar }
    const [maasOdeModal, setMaasOdeModal] = useState(null); // { satir, kaynakDefterId }
    const [maasKaydediliyor, setMaasKaydediliyor] = useState(false);
    const [acikMaasSatiri, setAcikMaasSatiri] = useState(null);

    // Seçili ödeme ayının KAYNAK ayı (bir önceki ay): '2026-08' -> {yil:2026, ay:7}
    const maasKaynakAy = useMemo(() => {
      const [y, m] = odemeAyi.split('-').map(Number);
      const d = new Date(y, m - 2, 1); // m-1 = seçili ay indeksi, bir öncesi m-2
      return { yil: d.getFullYear(), ay: d.getMonth() + 1 };
    }, [odemeAyi]);

    // ========================================================================
    // DEĞİŞTİ (kullanıcı talebi): Maaş/avans satırları artık YALNIZCA Ödemeler
    // defteri AÇIKKEN değil, sistemde bir Ödemeler defteri VARSA hesaplanır.
    // Gerekçe: Defter anasayfasındaki ÖDEMELER kartının "bu ay toplam / ödenen
    // / kalan" rakamlarına maaş ve avanslar da dahil edilecek. Kart, defter
    // açılmadan çizildiği için bu verinin orada da hazır olması gerekiyor.
    // Mahsup (ödendi mi?) araması artık seçili deftere değil, ÖDEMELER
    // defterinin kendi kimliğine bakar — liste ekranında seçili defter yoktur.
    // ========================================================================
    const odemeDefteriId = odemeDefterleri[0]?.id || null;
    // Kaynak ayın maaş + mesai dokümanlarını oku (Ödemeler defteri mevcutsa)
    useEffect(() => {
      if (!odemeDefteriId) return;
      let iptal = false;
      const { yil, ay } = maasKaynakAy;
      const anahtar = `${yil}_${ay}`;
      (async () => {
        try {
          const oku = (kol, ad) => getDoc(doc(db, 'artifacts', appId, 'public', 'data', kol, ad))
            .then(sn => sn.exists() ? (sn.data().records || {}) : {}).catch(() => ({}));
          const [maviMaas, maviMesai, beyazMaas, beyazMesai] = await Promise.all([
            oku('maas', anahtar), oku('mesai', anahtar),
            oku('maas', `beyaz_${anahtar}`), oku('mesai', `beyaz_${anahtar}`),
          ]);
          if (!iptal) setMaasVeri({ mavi: { maas: maviMaas, mesai: maviMesai }, beyaz: { maas: beyazMaas, mesai: beyazMesai }, kaynakAnahtar: anahtar });
        } catch (e) { console.error('Maaş verisi okunamadı:', e); }
      })();
      return () => { iptal = true; };
    }, [odemeDefteriId, maasKaynakAy]);

    // ========================================================================
    // YENİ (kullanıcı talebi): PERSONEL AVANS ÖDEMESİ (her ayın 20'si)
    // ========================================================================
    // Maaş satırları gibi ama iki AVANS satırı: NAKİT AVANS ve RESMİ AVANS.
    // Vade her ayın 20'sidir; tutar sıfır olsa bile satırlar hep görünür.
    // Tutarlar, görüntülenen AYIN muhasebe dokümanındaki nakitAvans/resmiAvans
    // hücrelerinden toplanır — muhasebe ekranıyla AYNI veridir. Satıra
    // tıklayınca kişi bazlı avanslar açılır; "Avans Gir" düğmesi Personel
    // Ödemeleri'ndeki toplu avans penceresinin aynısını burada açar.
    const [avansVeri, setAvansVeri] = useState(null);            // { mavi:{}, beyaz:{}, anahtar }
    const [avansYenile, setAvansYenile] = useState(0);           // toplu giriş sonrası tazeleme sayacı
    const [acikAvansSatiri, setAcikAvansSatiri] = useState(null);
    const [avansOdeModal, setAvansOdeModal] = useState(null);    // { satir, kaynakDefterId, tarih }
    const [avansOdeKaydediliyor, setAvansOdeKaydediliyor] = useState(false);
    const [avansTopluModal, setAvansTopluModal] = useState(null);// { kanal, yaka, secim, tutarlar, toplu, arama }
    const [avansTopluKaydediliyor, setAvansTopluKaydediliyor] = useState(false);

    // Görüntülenen AYIN muhasebe dokümanlarını oku (avans hücreleri için)
    useEffect(() => {
      if (seciliDefter?.tur !== 'Ödemeler') return;
      let iptal = false;
      const [ay2y, ay2a] = odemeAyi.split('-').map(Number);
      const anahtar = `${ay2y}_${ay2a}`;
      (async () => {
        try {
          const oku = (ad) => getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maas', ad))
            .then(sn => sn.exists() ? (sn.data().records || {}) : {}).catch(() => ({}));
          const [mavi, beyaz] = await Promise.all([oku(anahtar), oku(`beyaz_${anahtar}`)]);
          if (!iptal) setAvansVeri({ mavi, beyaz, anahtar });
        } catch (e) { console.error('Avans verisi okunamadı:', e); }
      })();
      return () => { iptal = true; };
    }, [seciliDefter?.tur, odemeAyi, avansYenile]);

    // İki otomatik maaş satırı (mavi + beyaz)
    const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    // ========================================================================
    // YENİ (kullanıcı talebi bağlamında): Defter LİSTESİNE dönüldüğünde ödeme
    // ayı içinde bulunulan aya sıfırlanır. Gerekçe: ÖDEMELER kartındaki
    // "bu ay" rakamları maasSatirlari/avansSatirlari üzerinden odemeAyi'na
    // bağlıdır. Kullanıcı defter içinde başka bir aya gidip listeye dönerse,
    // kart o eski ayı göstermeye devam ederdi. Sıfırlayınca kart her zaman
    // içinde bulunulan ayı gösterir; defteri tekrar açtığında da güncel aydan
    // başlar (daha doğal davranış).
    // ========================================================================
    useEffect(() => {
      if (!seciliDefterId) setOdemeAyi(bugunStr().slice(0, 7));
    }, [seciliDefterId]);

    const maasSatirlari = useMemo(() => {
      // DEĞİŞTİ: defter açık olmasa da (liste ekranı) hesaplanır
      if (!odemeDefteriId || !maasVeri) return [];
      const { yil, ay } = maasKaynakAy;
      if (maasVeri.kaynakAnahtar !== `${yil}_${ay}`) return []; // eski ayın verisi ekrana sızmasın
      const yakalar = [
        { id: 'mavi', ad: 'Mavi Yaka Maaşı', filtre: (p) => p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)) },
        { id: 'beyaz', ad: 'Beyaz Yaka Maaşı', filtre: (p) => p.collarType === 'Beyaz Yaka' },
      ];
      return yakalar.flatMap(yaka => {
        const veriKaynagi = maasVeri[yaka.id];
        const kisiler = (personnelList || [])
          .filter(p => p.position !== 'Firma Sahibi' && yaka.filtre(p) && isPersonnelVisibleInMonth(p, yil, ay))
          .map(p => {
            const row = veriKaynagi.maas[p.id] || {};
            const hes = maasKisiHesabi(p, row, veriKaynagi.mesai[p.id], yil, ay);
            // ============================================================
            // YENİ (kullanıcı talebi): KISMİ ÖDEME KALANI DÜŞSÜN
            // ------------------------------------------------------------
            // hes.bankaKalan/kalanNakit tam tutardır; kısmi ödemede biriken
            // bankaOdenenTutar/nakitOdenenTutar bekleyenden düşülür. Tik
            // (bankaOdendi/nakitOdendi) yalnızca TAM kapanınca atılır; kısmi
            // ödemede tik atılmaz, satır azalmış kalanla açık kalır.
            // ============================================================
            const bankaKismiOdenen = parseFloat(row.bankaOdenenTutar) || 0;
            const nakitKismiOdenen = parseFloat(row.nakitOdenenTutar) || 0;
            // Muhasebede tik ATILMAMIŞ kısımlar hâlâ ödenecek demektir
            const bankaBekleyen = row.bankaOdendi ? 0 : Math.max(0, hes.bankaKalan - bankaKismiOdenen);
            const nakitBekleyen = row.nakitOdendi ? 0 : Math.max(0, hes.kalanNakit - nakitKismiOdenen);
            return { person: p, bankaKalan: hes.bankaKalan, kalanNakit: hes.kalanNakit,
                     bankaOdendi: !!row.bankaOdendi, nakitOdendi: !!row.nakitOdendi,
                     // Kısmi ödeme bilgisi (satırda "KISMİ" rozeti için)
                     bankaKismiOdenen, nakitKismiOdenen,
                     // YENİ: kanal bazlı bekleyenler ayrı tutulur ki banka ve
                     // nakit satırları kendi tutarlarını gösterebilsin
                     bankaBekleyen, nakitBekleyen,
                     bekleyen: bankaBekleyen + nakitBekleyen };
          });
        // ==================================================================
        // YENİ (kullanıcı talebi): HER YAKA İKİ AYRI ÖDEME SATIRINA BÖLÜNDÜ
        // ==================================================================
        // Eskiden "Mavi Yaka Maaşı" tek satırdı ve banka+nakit toplamı tek
        // seferde ödeniyordu. Artık her ay 4 ayrı ödeme görünür:
        //   Mavi Yaka Kalan Banka • Mavi Yaka Kalan Nakit
        //   Beyaz Yaka Kalan Banka • Beyaz Yaka Kalan Nakit
        // Her satır kendi kanalının toplamını taşır ve ayrı ayrı ödenir;
        // "Öde" yalnızca o kanalın muhasebe tiklerini atar.
        const kanallar = [
          { id: 'banka', etiket: 'Kalan Banka' },
          { id: 'nakit', etiket: 'Kalan Nakit' },
        ];
        return kanallar.map(kanal => {
          // Kişi listesinde bekleyen, yalnızca bu kanalın kalanıdır
          const kanalKisiler = kisiler.map(k => ({ ...k, bekleyen: kanal.id === 'banka' ? k.bankaBekleyen : k.nakitBekleyen, kismiOdenen: kanal.id === 'banka' ? k.bankaKismiOdenen : k.nakitKismiOdenen }));
          const toplamBekleyen = kanalKisiler.reduce((t, k) => t + k.bekleyen, 0);
          const kalemId = `maas_${yaka.id}_${yil}_${ay}_${kanal.id}`;
          // GERİYE UYUM: eski tek-satır döneminde yapılmış ödemelerin kalem
          // kimliği kanalsızdı (maas_mavi_YYYY_M); o kayıt bulunursa her iki
          // kanal da ödenmiş sayılır — eski aylar bozulmaz.
          const eskiKalemId = `maas_${yaka.id}_${yil}_${ay}`;
          const mahsup = islemler.find(i => !i.silindi && i.defterId === odemeDefteriId && i.tip === 'giris' && i.odemeMahsup &&
            (i.odemeKalemId === kalemId || i.odemeKalemId === eskiKalemId));
          return {
            id: kalemId, yaka: yaka.id, kanal: kanal.id,
            // Satır adı: "Mavi Yaka Kalan Banka" gibi
            ad: `${yaka.ad.replace(' Maaşı', '')} ${kanal.etiket}`,
            kaynakEtiket: `${AY_ADLARI[ay - 1]} ${yil} maaşı`,
            vadeTarihi: `${odemeAyi}-06`,
            tutar: toplamBekleyen,
            kisiler: kanalKisiler,
            // YENİ (kullanıcı talebi): DEVİR — vadesi 1 Eylül 2026'dan önce olan
            // maaş satırları eski düzende ödendiği için ödenmiş sayılır.
            devir: `${odemeAyi}-06` < SISTEM_DEVIR_TARIHI,
            // Tamamlandı: devirse VEYA defterden ödendiyse VEYA muhasebedeki kalanlar sıfırlandıysa
            odendi: `${odemeAyi}-06` < SISTEM_DEVIR_TARIHI || !!mahsup || (kanalKisiler.length > 0 && toplamBekleyen <= 0.01),
            odemeTarihi: mahsup?.tarih || null,
          };
        });
      }).filter(sa => sa.kisiler.length > 0);
    }, [odemeDefteriId, maasVeri, maasKaynakAy, personnelList, islemler, odemeAyi]);

    // ========================================================================
    // YENİ: İKİ AVANS SATIRI (NAKİT + RESMİ) — her ayın 20'si
    // ========================================================================
    const YAKA_FILTRELERI = {
      mavi: (p) => p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)),
      beyaz: (p) => p.collarType === 'Beyaz Yaka',
    };
    const avansSatirlari = useMemo(() => {
      // DEĞİŞTİ: defter açık olmasa da (liste ekranı) hesaplanır
      if (!odemeDefteriId || !avansVeri) return [];
      const [yil, ay] = odemeAyi.split('-').map(Number);
      if (avansVeri.anahtar !== `${yil}_${ay}`) return []; // eski ayın verisi sızmasın
      // DEĞİŞTİ (kullanıcı talebi): Maaştaki gibi her kanal YAKAYA göre de
      // ikiye bölünür → 4 satır: Mavi/Beyaz × Nakit/Banka(Resmi).
      // DEĞİŞTİ (kullanıcı talebi): Avanslar artık MUHASEBE alanına (nakitAvans/
      // resmiAvans) DEĞİL, "bekleyen" alanına yazılır. Bu sayede avans girişi
      // muhasebeyi ETKİLEMEZ; muhasebeye yalnızca ÖDEME yapılınca işlenir.
      //   bekleyenAlan  -> girişte yazılan, ödenmeyi bekleyen avans
      //   alan          -> ödeme yapılınca muhasebeye kopyalanan gerçek alan
      const kanallar = [
        { id: 'nakit', etiket: 'Nakit Avansı', alan: 'nakitAvans', bekleyenAlan: 'bekleyenNakitAvans' },
        { id: 'resmi', etiket: 'Banka Avansı', alan: 'resmiAvans', bekleyenAlan: 'bekleyenResmiAvans' },
      ];
      const yakalar = [
        { id: 'mavi', ad: 'Mavi Yaka' },
        { id: 'beyaz', ad: 'Beyaz Yaka' },
      ];
      // Sıra: Mavi Nakit, Mavi Banka, Beyaz Nakit, Beyaz Banka
      const satirlar = [];
      yakalar.forEach(yaka => {
        kanallar.forEach(kanal => {
          // Yalnızca bu yakanın o ay görünür personeli
          const kisiler = (personnelList || [])
            .filter(p => p.position !== 'Firma Sahibi' && isPersonnelVisibleInMonth(p, yil, ay) && YAKA_FILTRELERI[yaka.id](p))
            .map(p => {
              // Ödeme öncesi tutar bekleyen alandan; ödeme sonrası muhasebeye
              // kopyalandığı için gerçek alan da fallback olarak okunur.
              const rec = avansVeri[yaka.id][p.id] || {};
              const tutar = parseFloat(rec[kanal.bekleyenAlan]) || parseFloat(rec[kanal.alan]) || 0;
              return { person: p, yaka: yaka.id, tutar };
            });
          const toplam = kisiler.reduce((t, k) => t + k.tutar, 0);
          // Kalem kimliğine YAKA da eklendi ki 4 satır ayrı ayrı ödenebilsin
          const kalemId = `avans_${yaka.id}_${kanal.id}_${yil}_${ay}`;
          const mahsup = islemler.find(i => !i.silindi && i.defterId === odemeDefteriId && i.tip === 'giris' && i.odemeMahsup && i.odemeKalemId === kalemId);
          const vadeTarihi = `${odemeAyi}-20`; // her ayın 20'si
          // YENİ (kullanıcı talebi): 1 Eylül 2026 (sistem devri) ÖNCESİ avanslar
          // ARTIK HİÇ GÖSTERİLMEZ (eski girişler Ödemeler bölümünde yer almaz).
          const devir = vadeTarihi < SISTEM_DEVIR_TARIHI;
          if (devir) return; // devir öncesi satır üretme
          satirlar.push({
            id: kalemId, kanal: kanal.id, alan: kanal.alan, bekleyenAlan: kanal.bekleyenAlan, yaka: yaka.id,
            ad: `${yaka.ad} ${kanal.etiket}`,
            kaynakEtiket: `${AY_ADLARI[ay - 1]} ${yil} avansı`,
            vadeTarihi, devir,
            tutar: toplam,
            kisiler,
            odendi: devir || !!mahsup,
            odemeTarihi: mahsup?.tarih || null,
          });
        });
      });
      return satirlar;
    }, [odemeDefteriId, avansVeri, personnelList, islemler, odemeAyi]);

    // AVANS ÖDEMESİ — kaynak hesap seçilir; varsayılan: Nakit avans için
    // Sembol Nakliyat'ın NAKİT defteri, Resmi avans için BANKA defteri.
    const avansVarsayilanKaynak = (kanal) => {
      const tur = kanal === 'nakit' ? 'Nakit' : 'Banka';
      const d = defterler.find(x => x.blok === 'Sembol Nakliyat' && x.tur === tur)
             || defterler.find(x => x.tur === tur);
      return d?.id || '';
    };
    const avansOde = async () => {
      if (!avansOdeModal) return;
      const satir = avansOdeModal.satir;
      const tutar = satir.tutar;
      if (!(tutar > 0)) { alert('Bu ay girilmiş avans yok (toplam ₺0). Önce "Avans Gir" ile avans yazın.'); return; }
      if (!avansOdeModal.kaynakDefterId) { alert('Ödemenin yapıldığı hesabı seçin.'); return; }
      const kaynak = defterler.find(d => d.id === avansOdeModal.kaynakDefterId);
      const odemeId = `avanso_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const ortak = {
        tarih: avansOdeModal.tarih || bugunStr(),
        kategori: 'Avans', etiketler: [], odemeId,
        odemeKalemId: satir.id, odemeDefterId: seciliDefter.id,
        kaynak: 'Personel Avans', createdAt: new Date().toISOString(),
        by: currentUser?.fullName || 'Sistem',
      };
      setAvansOdeKaydediliyor(true);
      try {
        // ====================================================================
        // DEĞİŞTİ (kullanıcı talebi): DEFTERE HER PERSONEL AYRI + ETİKETLİ DÜŞER
        // --------------------------------------------------------------------
        // ESKİ: Kaynak deftere TEK bir toplu gider satırı yazılıyordu
        //   ("Mavi Yaka Nakit Avansı" gibi) — hangi personele ne ödendiği
        //   defterde görünmüyordu.
        // YENİ: Bu avans satırındaki HER personel için AYRI bir gider (çıkış)
        //   satırı yazılır; satıra personel ETİKETLENİR (ekipSefi/ekipSefiId),
        //   böylece defterde adı tıklanınca profiline gidilir. Açıklama net:
        //   "Ahmet Öztürk — Nakit Avans (Eylül 2026)" gibi.
        //   Doğru deftere gitme kuralı DEĞİŞMEDİ: Nakit avans → Nakit defteri,
        //   Resmi avans → Banka (öncelik Sembol Nakliyat/GARANTİ) — kaynak
        //   defter zaten avansVarsayilanKaynak ile bu kurala göre seçili gelir.
        //
        // avansTuruEtiket: satırın kanalına göre okunur ad. 'resmi' → Resmi
        //   Avans, diğer → Nakit Avans.
        // ====================================================================
        const avansTuruEtiket = satir.kanal === 'resmi' ? 'Resmi Avans' : 'Nakit Avans';
        const odenenKisiler = satir.kisiler.filter(k => k.tutar > 0);
        // Personeli işlem kaydına bağlamak için id çözümü (profil linki için)
        const kisiIdBul = (k) => k.person?.id || k.id || null;

        if (odenenKisiler.length > 0) {
          // Her personel için AYRI gider satırı — personel etiketli
          for (const k of odenenKisiler) {
            const pid = kisiIdBul(k);
            const pad = k.person?.fullName || k.ad || 'Personel';
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
              ...ortak, tip: 'cikis', tutar: k.tutar, odemeMahsup: false,
              defterId: avansOdeModal.kaynakDefterId,
              odemeYontemi: defterdenOdemeYontemi(avansOdeModal.kaynakDefterId),
              // Personel etiketi: defterde adı görünür + tıklanınca profile gider
              ekipSefi: pad, ekipSefiId: pid,
              aciklama: `${pad} — ${avansTuruEtiket} (${satir.kaynakEtiket})`,
            });
          }
        } else {
          // Kişi listesi boşsa (beklenmez) eski davranış: tek toplu satır
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
            ...ortak, tip: 'cikis', tutar, odemeMahsup: false,
            defterId: avansOdeModal.kaynakDefterId,
            odemeYontemi: defterdenOdemeYontemi(avansOdeModal.kaynakDefterId),
            aciklama: `${satir.ad} — ${satir.kaynakEtiket}`,
          });
        }
        // Ödemeler defterine tek mahsup (giriş) bacağı — muhasebe dengesi için
        // (ay içindeki "ödendi" durumunu bu tek kayıt belirler; bölmeye gerek yok)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'giris', tutar, odemeMahsup: true,
          defterId: seciliDefter.id,
          odemeYontemi: defterdenOdemeYontemi(avansOdeModal.kaynakDefterId),
          aciklama: `${satir.ad} (${satir.kaynakEtiket}) ← ${kaynak?.ad || 'hesap'}`,
        });
        addSystemLog?.('Personel Avansı Ödendi',
          `${satir.ad} (${satir.kaynakEtiket}) ₺${paraFmt(tutar)} — ${kaynak?.ad || '-'} hesabından ödendi; ${odenenKisiler.length} personel ayrı ayrı etiketlenerek deftere işlendi.`);
        // ====================================================================
        // YENİ (kullanıcı talebi): ÖDEME SONRASI MUHASEBEYE İŞLE
        // ====================================================================
        // Avans girişi muhasebeyi etkilemiyordu (bekleyen alanda duruyordu).
        // Ödeme yapıldığı AN, bu satırdaki her personelin bekleyen avansı
        // muhasebedeki gerçek alana (nakitAvans/resmiAvans) yazılır ve maaş
        // hesabına dahil olur. Bekleyen alan kayıt olarak korunur.
        try {
          const [yil2, ay2] = odemeAyi.split('-').map(Number);
          const docAdi = satir.yaka === 'beyaz' ? `beyaz_${yil2}_${ay2}` : `${yil2}_${ay2}`;
          const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', docAdi);
          const mSnap = await getDoc(mRef);
          const records = mSnap.exists() ? (mSnap.data().records || {}) : {};
          satir.kisiler.filter(k => k.tutar > 0).forEach(k => {
            if (!records[k.person.id]) records[k.person.id] = {};
            records[k.person.id][satir.alan] = String(k.tutar); // muhasebeye işle
          });
          await setDoc(mRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (muhErr) { console.error('Avans muhasebeye işlenemedi:', muhErr); }
        setAvansYenile(x => x + 1);
        setAvansOdeModal(null);
      } catch (e) { console.error('Avans ödemesi kaydedilemedi:', e); alert('Kaydedilemedi. Lütfen tekrar deneyin.'); }
      finally { setAvansOdeKaydediliyor(false); }
    };

    // TOPLU AVANS GİRİŞİ (Ödemeler sayfası) — Personel Ödemeleri'ndeki
    // pencereyle aynı mantık: seçim + tek tutar uygulama + kişiye özel tutar.
    // Kanal (Nakit/Resmi) ve yaka (Mavi/Beyaz) pencere içinden değiştirilir.
    const avansTopluAc = (kanal, baslangicYaka = 'mavi') => {
      const yaka = baslangicYaka;
      const kisiler = (personnelList || []).filter(p => p.position !== 'Firma Sahibi' && YAKA_FILTRELERI[yaka](p));
      const alan = kanal === 'resmi' ? 'bekleyenResmiAvans' : 'bekleyenNakitAvans';
      const tutarlar = {}; const secim = [];
      kisiler.forEach(p => {
        const mevcut = parseFloat((avansVeri?.[yaka]?.[p.id] || {})[alan]) || 0;
        tutarlar[p.id] = mevcut > 0 ? String(mevcut) : '';
        if (mevcut > 0) secim.push(p.id);
      });
      setAvansTopluModal({ kanal, yaka, secim, tutarlar, toplu: '', arama: '' });
    };
    const avansTopluYakaDegistir = (yaka) => {
      if (!avansTopluModal) return;
      const alan = avansTopluModal.kanal === 'resmi' ? 'bekleyenResmiAvans' : 'bekleyenNakitAvans';
      const kisiler = (personnelList || []).filter(p => p.position !== 'Firma Sahibi' && YAKA_FILTRELERI[yaka](p));
      const tutarlar = {}; const secim = [];
      kisiler.forEach(p => {
        const mevcut = parseFloat((avansVeri?.[yaka]?.[p.id] || {})[alan]) || 0;
        tutarlar[p.id] = mevcut > 0 ? String(mevcut) : '';
        if (mevcut > 0) secim.push(p.id);
      });
      setAvansTopluModal(m => ({ ...m, yaka, secim, tutarlar, arama: '' }));
    };
    const avansTopluKanalDegistir = (kanal) => {
      if (!avansTopluModal) return;
      const alan = kanal === 'resmi' ? 'bekleyenResmiAvans' : 'bekleyenNakitAvans';
      const yaka = avansTopluModal.yaka;
      const kisiler = (personnelList || []).filter(p => p.position !== 'Firma Sahibi' && YAKA_FILTRELERI[yaka](p));
      const tutarlar = {}; const secim = [];
      kisiler.forEach(p => {
        const mevcut = parseFloat((avansVeri?.[yaka]?.[p.id] || {})[alan]) || 0;
        tutarlar[p.id] = mevcut > 0 ? String(mevcut) : '';
        if (mevcut > 0) secim.push(p.id);
      });
      setAvansTopluModal(m => ({ ...m, kanal, secim, tutarlar }));
    };
    const avansTopluKaydet = async () => {
      if (!avansTopluModal) return;
      const { kanal, yaka, secim, tutarlar } = avansTopluModal;
      if (secim.length === 0) { alert('Kaydedilecek personel seçin.'); return; }
      // DEĞİŞTİ (kullanıcı talebi): Giriş MUHASEBEYE değil BEKLEYEN alana yazılır.
      // Muhasebeye yalnızca "Öde" ile ödeme yapılınca işlenir (avansOde).
      const alan = kanal === 'resmi' ? 'bekleyenResmiAvans' : 'bekleyenNakitAvans';
      const [yil, ay] = odemeAyi.split('-').map(Number);
      const docAdi = yaka === 'beyaz' ? `beyaz_${yil}_${ay}` : `${yil}_${ay}`;
      setAvansTopluKaydediliyor(true);
      try {
        const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', docAdi);
        const mSnap = await getDoc(mRef);
        const records = mSnap.exists() ? (mSnap.data().records || {}) : {};
        let toplam = 0;
        secim.forEach(id => {
          if (!records[id]) records[id] = {};
          const ham = (tutarlar[id] ?? '').toString().trim();
          const deger = parseFloat(ham);
          records[id][alan] = (ham === '' || !(deger > 0)) ? '' : String(deger);
          if (deger > 0) toplam += deger;
        });
        await setDoc(mRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
        addSystemLog?.('Toplu Avans Girişi (Ödemeler)',
          `${yaka === 'beyaz' ? 'Beyaz' : 'Mavi'} Yaka — ${AY_ADLARI[ay - 1]} ${yil}: ${secim.length} personele toplam ₺${toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${kanal === 'resmi' ? 'resmi' : 'nakit'} avans işlendi.`);
        setAvansTopluModal(null);
        setAvansYenile(x => x + 1); // satır tutarları anında tazelensin
      } catch (e) { console.error('Toplu avans kaydedilemedi:', e); alert('Kaydedilemedi. Lütfen tekrar deneyin.'); }
      finally { setAvansTopluKaydediliyor(false); }
    };

    if (!seciliDefter) {
      // ====================================================================
      // DEĞİŞTİ: DEFTER SIRASI ARTIK ELLE AYARLANABİLİR
      // ====================================================================
      // ESKİ HALİ: Liste her zaman alfabetikti; kullanıcı defterleri kendi
      // önem sırasına göre dizemiyordu.
      // YENİ HALİ: Her defterin 'sira' alanı vardır (yukarı/aşağı oklarıyla
      // değişir). Sırası HENÜZ atanmamış defterler (eski kayıtlar) listenin
      // sonuna gider ve kendi aralarında alfabetik kalır — böylece ilk açılışta
      // görünüm bozulmaz.
      // ====================================================================
      const filtreliDefterler = defterler
        .filter(d => !arama.trim() || (d.ad || '').toLocaleLowerCase('tr-TR').includes(arama.trim().toLocaleLowerCase('tr-TR')))
        .sort((a, b) => {
          const sa = Number.isFinite(a.sira) ? a.sira : 9999;
          const sb = Number.isFinite(b.sira) ? b.sira : 9999;
          if (sa !== sb) return sa - sb;
          return (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'); // Eşitse alfabetik
        });

      // Arama yapılırken sıralama okları gizlenir: filtrelenmiş kısa listede
      // "yukarı taşı" demek yanıltıcı olur, çünkü aradaki gizli defterler
      // görünmüyor. Sıra düzenlemek için aramayı temizlemek gerekir.
      const siralamaAktif = !arama.trim();

      // İki defterin yerini değiştirir ve yeni sırayı Firestore'a yazar.
      // Not: Sıra hiç atanmamışsa önce GÖRÜNEN sıraya göre 0,1,2… atanır;
      // böylece ilk tıklamada liste zıplamaz.
      // DEĞİŞTİ: Artık BLOK İÇİNDE sıralama yapılır. Eskiden tüm liste
      // üzerinden index alınıyordu; defterler bloklara ayrıldıktan sonra bu
      // yanlış defterlerin yer değiştirmesine yol açardı (örn. Depoevim'deki
      // bir defter, Sembol Nakliyat'takiyle takas edilirdi). Bu yüzden
      // fonksiyona o bloğun listesi parametre olarak verilir.
      const defterSirasiDegistir = async (index, yon, blokListesi) => {
        const liste = blokListesi || filtreliDefterler;
        const hedefIndex = index + yon;
        if (hedefIndex < 0 || hedefIndex >= liste.length) return; // Uçlarda işlem yok
        const yeniSira = [...liste];
        [yeniSira[index], yeniSira[hedefIndex]] = [yeniSira[hedefIndex], yeniSira[index]];
        try {
          // Blok içi sıralar 0,1,2… olarak yazılır. Bloklar zaten ekranda ayrı
          // kutularda çizildiği için bloklar arası sıra çakışması sorun değildir.
          // Yalnızca sırası DEĞİŞEN defterler yazılır (gereksiz yazma olmasın).
          await Promise.all(yeniSira.map((d, i) =>
            d.sira === i ? null : updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', d.id), { sira: i })
          ).filter(Boolean));
        } catch (e) {
          console.error('Defter sırası kaydedilemedi:', e);
          alert('Sıra değiştirilemedi. Lütfen tekrar deneyin.');
        }
      };

      return (
        <div className="max-w-5xl mx-auto animate-in fade-in space-y-5">
          {/* TAŞINDI (kullanıcı talebi): Genel özet kartı (dönem sekmeleri,
              Toplam Giriş/Çıkış/Net Bakiye, Toplam Kredi Borcu ve Bekleyen
              Ödemeler) sayfanın EN ALTINA alındı — önce defter listesi
              görünsün, özet aşağıda dursun. */}


          {/* TAŞINDI (kullanıcı talebi): "Defter ara" kutusu ve "Yeni Defter"
              düğmesi SAYFANIN EN ALTINA alındı — açılışta doğrudan defter
              listesi görünür. */}

          {/* ==================================================================
              DEFTER KARTLARI — BLOKLARA GÖRE GRUPLANMIŞ
              ==================================================================
              YENİ: Defterler artık düz liste değil; ait oldukları bloğa göre
              ince çerçeveli kutulara ayrılır ve blok adı kutunun en üstünde
              yazar. Bloklar DEFTER_BLOKLARI dizisindeki sırayla listelenir
              (Sembol Nakliyat > Depoevim > Genel).
              Boş bloklar hiç çizilmez — kullanılmayan grup ekranı doldurmasın.
              Blok İÇİNDEKİ sıra eskisi gibi 'sira' alanına göredir; sıralama
              okları da yalnızca kendi bloğu içinde çalışır (aşağıya bkz.).
              ================================================================== */}
          <div className="space-y-4">
            {filtreliDefterler.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm font-bold text-neutral-400">
                Henüz defter yok. "Yeni Defter" ile ilk defterinizi (örn. MERKEZ KASA) açın.
              </div>
            )}
            {DEFTER_BLOKLARI.map(blokAdi => {
              const blokDefterleri = filtreliDefterler.filter(d => defterBlogu(d) === blokAdi);
              if (blokDefterleri.length === 0) return null; // Boş blok çizilmez
              // Blok toplamı: kredi/ödeme defterleri bakiye mantığına girmediği
              // için yalnızca para hesapları toplanır (nakit/banka/kk/borçlu).
              const blokBakiye = blokDefterleri
                .filter(d => d.tur !== 'Kredi' && d.tur !== 'Ödemeler')
                .reduce((t, d) => t + defterBakiye(d.id), 0);
              // DEĞİŞTİ (kullanıcı talebi): blok çerçevesi ve başlık altı
              // ayırıcı KALINLAŞTIRILDI — bloklar birbirinden net ayrışıyor.
              // YENİ (kullanıcı talebi): her bloğun kendi rengi var —
              // Sembol Nakliyat KIRMIZI, Depoevim MAVİ, Genel/diğerleri YEŞİL.
              const blokRenk = blokAdi === 'Sembol Nakliyat'
                ? { cerceve: 'border-red-500', simge: 'bg-red-600' }
                : blokAdi === 'Depoevim'
                ? { cerceve: 'border-blue-500', simge: 'bg-blue-600' }
                : { cerceve: 'border-emerald-500', simge: 'bg-emerald-600' };
              return (
                <div key={blokAdi} className={`border-2 ${blokRenk.cerceve} rounded-2xl overflow-hidden bg-neutral-100/70 shadow-sm`}>
                  {/* BLOK BAŞLIĞI */}
                  <div className="px-3 sm:px-4 py-2.5 bg-white border-b-2 border-neutral-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-5 rounded-full ${blokRenk.simge} shrink-0`}></span>
                      <span className="font-black text-sm text-black truncate">{blokAdi}</span>
                      <span className="text-[10px] font-bold text-neutral-400 shrink-0">{blokDefterleri.length} defter</span>
                    </div>
                    <div className={`text-sm font-black tabular-nums shrink-0 ${blokBakiye > 0 ? 'text-emerald-600' : blokBakiye < 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                      ₺{paraFmt(Math.abs(blokBakiye))}
                    </div>
                  </div>
                  <div className="p-2.5 space-y-2.5">
            {blokDefterleri.map((d, defterIndex) => {
              const bakiye = defterBakiye(d.id);
              const sonTarih = defterSonIslem(d.id);
              // DÜZELTME: Bu açıklama önce {/* */} biçiminde return ( ile <button>
              // arasına yazılmıştı; JSX'te ana elemandan ÖNCE yorum konamaz
              // (iki ayrı ifade sayılır) ve derleme hatası veriyordu. Artık
              // normal JS yorumu olarak return'den önce duruyor.
              //
              // DEĞİŞİKLİK: Defter açılırken günlük filtre BUGÜNE sıfırlanır.
              // Başka bir defterde geçmiş bir güne bakıp çıkıldığında, yeni
              // defter yanlış günde açılmasın diye.
              //
              // DEĞİŞİKLİK (SIRALAMA): Kartın kendisi eskiden <button> idi.
              // İçine yukarı/aşağı ok BUTONLARI eklenince "buton içinde buton"
              // oluşuyordu; bu geçersiz HTML'dir ve tarayıcı yapıyı bozar.
              // Bu yüzden kart <div role="button"> oldu; klavye ile açılabilmesi
              // için tabIndex ve Enter/Space desteği eklendi.
              // DEĞİŞTİ (kullanıcı talebi): NAKİT, BANKA ve KREDİ KARTI defterleri
              // artık HEPSİ her açılışta "Tüm Zamanlar" ile gelir (gün filtresi
              // kapalı) — üçü de aynı görünüm/sıralama/tasarımla davranır.
              // 'Kasa' da NAKİT'in eski (geriye uyumlu) adıdır, o da dahil edilir.
              // Diğer defter türlerinde (Borçlu, Kredi, Ödemeler) eski davranış
              // korunur: bugün seçili olarak açılır.
              const defteriAc = () => {
                setSeciliDefterId(d.id);
                setDetayArama('');
                setKategoriFiltre('Tümü');
                setSeciliGun(bugunStr());
                setGunFiltreAktif(!(d.tur === 'Nakit' || d.tur === 'Kasa' || d.tur === 'Banka' || d.tur === 'Kredi Kartı'));
              };
              return (
                <div key={d.id} role="button" tabIndex={0}
                  onClick={defteriAc}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); defteriAc(); } }}
                  /* DEĞİŞTİ (kullanıcı talebi): çerçeve 2px'e çıkarıldı ve
                     koyulaştırıldı — her defter kartı net ayrışıyor. */
                  className="w-full bg-white rounded-2xl border-2 border-neutral-300 p-3.5 flex items-center gap-3 hover:border-emerald-500 hover:shadow-md transition text-left cursor-pointer">
                  {/* KALDIRILDI (kullanıcı talebi): yukarı/aşağı sıralama okları
                      listeden çıkarıldı — kart artık tüm satırı kullanıyor ve
                      defter adları tam görünüyor. Sıralama fonksiyonu kodda
                      duruyor, yalnızca düğmeleri kaldırıldı. */}
                  {/* Defter adının ilk HARFİ yerine TÜRE UYGUN SİMGE.
                      Tüm defterler "NAKLİYE (...)" ile başladığı için hepsinde aynı
                      "N" harfi çıkıyordu ve ayırt edici bir bilgi vermiyordu.
                      Simge + renk defterTuruGorunum() ile tek yerden geliyor. */}
                  {(() => {
                    const { Ikon, renk } = defterTuruGorunum(d.tur);
                    return (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${renk}`}>
                        <Ikon className="w-5 h-5" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    {/* DEĞİŞTİ (kullanıcı talebi): ad artık KESİLMİYOR — uzun
                        defter adları alt satıra taşarak tam görünür. */}
                    <div className="font-black text-black text-[15px] leading-tight break-words">{d.ad}</div>
                    {/* DEĞİŞİKLİK: Ham d.tur yerine defterTuruEtiket() — eski kayıtlar da
                        yeni isimle görünür (Cari -> Kredi Kartı, Diğer -> Borçlu). */}
                    <div className="text-[10px] font-bold text-neutral-400 truncate mt-0.5">{defterTuruEtiket(d.tur)} {sonTarih ? `• ${new Date(sonTarih).toLocaleDateString('tr-TR')}` : '• Henüz işlem yok'}</div>
                  </div>
                  {/* ==========================================================
                      KREDİ DEFTERİ farklı gösterilir: "bakiye" yerine KALAN BORÇ
                      ve taksit ilerlemesi. Kredi hesabının bakiyesi kavramsal
                      olarak anlamsızdır; asıl bilgi ne kadar borç kaldığıdır.
                      ========================================================== */}
                  {d.tur === 'Ödemeler' ? (() => {
                    // ÖDEMELER DEFTERİ: bakiye yerine bu ayın ödeme durumu
                    const od = odemeDefterBilgi(d);
                    // ==========================================================
                    // DEĞİŞTİ (kullanıcı talebi): MAAŞ ve AVANSLAR DA DAHİL
                    // ----------------------------------------------------------
                    // odemeDefterBilgi yalnızca defterin kendi ödeme planı
                    // kalemlerini (kira, firma ödemesi vb.) sayar. Oysa defter
                    // içindeki aylık listede bunların yanında MUHASEBEDEN gelen
                    // otomatik satırlar da var: Mavi/Beyaz Yaka Kalan Banka ve
                    // Nakit maaşları ile 4 avans satırı. Kart bunları saymadığı
                    // için toplam eksik görünüyordu (ör. 17 kalem yazarken
                    // listede 25 satır vardı). Artık o satırlar da eklenir;
                    // böylece kart, defter içindeki sayfayla birebir tutar.
                    // Bu satırlar sentetiktir (defter.odemeler içinde yer
                    // almazlar), dolayısıyla ÇİFT SAYIM riski yoktur.
                    // ==========================================================
                    const ekSatirlar = [...maasSatirlari, ...avansSatirlari];
                    const ekToplam = ekSatirlar.reduce((t, s) => t + (parseFloat(s.tutar) || 0), 0);
                    const ekOdenen = ekSatirlar.filter(s => s.odendi).reduce((t, s) => t + (parseFloat(s.tutar) || 0), 0);
                    const ekBekleyen = ekToplam - ekOdenen;

                    const buAyToplam = od.buAyToplam + ekToplam;
                    const buAyOdenen = od.buAyOdenen + ekOdenen;
                    const buAyKalan = od.buAyBekleyen + ekBekleyen;
                    const buAyAdet = od.buAyAdet + ekSatirlar.length;
                    const buAyOdenenAdet = od.buAyOdenenAdet + ekSatirlar.filter(s => s.odendi).length;
                    const yuzdeOd = buAyToplam > 0 ? Math.round((buAyOdenen / buAyToplam) * 100) : 0;
                    return (
                      <div className="text-right shrink-0 max-w-[45%] sm:max-w-none sm:min-w-[120px]">
                        <div className={`text-base sm:text-lg font-black tabular-nums ${od.gecikmisAdet > 0 ? 'text-red-600' : 'text-orange-700'}`}>₺{paraFmt(buAyKalan)}</div>
                        <div className="text-[9px] sm:text-[10px] font-black uppercase text-orange-500 leading-tight">
                          Bu Ay Kalan{buAyAdet > 0 ? ` • ${buAyAdet - buAyOdenenAdet}/${buAyAdet} ödeme` : ` • ${od.kalemSayisi} kalem`}
                        </div>
                        {buAyAdet > 0 && (
                          <>
                            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-orange-500" style={{ width: `${yuzdeOd}%` }}></div>
                            </div>
                            {/* Bu ayın TOPLAMI (maaş + avans dahil) ve ödenen kısmı */}
                            <div className="text-[9px] font-bold text-neutral-500 mt-0.5">
                              Bu ay toplam: ₺{paraFmt(buAyToplam)}
                            </div>
                            <div className="text-[9px] font-bold text-emerald-600">
                              Ödenen: ₺{paraFmt(buAyOdenen)}
                            </div>
                          </>
                        )}
                        {od.gecikmisAdet > 0 && (
                          <div className="text-[9px] font-black text-red-600 mt-0.5">{od.gecikmisAdet} gecikmiş • ₺{paraFmt(od.gecikmisTutar)}</div>
                        )}
                      </div>
                    );
                  })() : d.tur === 'Kredi' ? (() => {
                    // DEĞİŞTİ (kullanıcı talebi): Kart artık ÖDEMELER defteriyle
                    // aynı şekilde "BU AY ÖDENECEK" taksit tutarını ve kredi
                    // sayısını gösterir. Önceden toplam kalan borç (milyonlar)
                    // yazıyordu; o bilgi kaybolmasın diye altta küçük punto ile
                    // ikincil satırda korundu. İlerleme çubuğu aynen duruyor.
                    const kd = krediDefterBilgi(d);
                    const yuzde = kd.toplamGeriOdeme > 0 ? Math.round((kd.toplamOdenen / kd.toplamGeriOdeme) * 100) : 0;
                    return (
                      <div className="text-right shrink-0 max-w-[45%] sm:max-w-none sm:min-w-[120px]">
                        <div className={`text-base sm:text-lg font-black tabular-nums ${kd.gecikmisAdet > 0 ? 'text-red-600' : 'text-violet-700'}`}>₺{paraFmt(kd.buAyBekleyen)}</div>
                        <div className="text-[9px] sm:text-[10px] font-black uppercase text-violet-500 leading-tight">
                          {kd.kalemSayisi === 0 ? 'Kredi Eklenmemiş'
                            : `Bu Ay Ödenecek • ${kd.kalemSayisi} kredi`}
                        </div>
                        {kd.kalemSayisi > 0 && (
                          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-violet-500" style={{ width: `${yuzde}%` }}></div>
                          </div>
                        )}
                        {/* Toplam kalan borç ikincil bilgi olarak korunur */}
                        {kd.kalemSayisi > 0 && (
                          <div className="text-[9px] font-bold text-neutral-400 mt-0.5">
                            {kd.toplamBorc > 0 ? `Kalan borç: ₺${paraFmt(kd.toplamBorc)}` : 'Tüm krediler kapandı ✓'}
                          </div>
                        )}
                        {kd.gecikmisAdet > 0 && (
                          <div className="text-[9px] font-black text-red-600 mt-0.5">{kd.gecikmisAdet} gecikmiş • ₺{paraFmt(kd.gecikmisTutar)}</div>
                        )}
                      </div>
                    );
                  })() : d.tur === 'Borçlu' || d.tur === 'Diğer' ? (() => {
                    // ==========================================================
                    // YENİ (kullanıcı talebi): BORÇLU ("Tahsil Bekleyen") DEFTERİ
                    // ----------------------------------------------------------
                    // Bu defterde gelir/gider işlemi tutulmaz; borçlu kalemleri
                    // defter dokümanındaki "alacaklar" dizisinde durur. Bu yüzden
                    // klasik bakiye hesabı hep ₺0,00 "BAKİYE SIFIR" çıkıyor ve
                    // kart hiçbir bilgi vermiyordu.
                    // Artık kartta, defterin İÇİNDEKİ tahsil edilecek kişilerin
                    // TOPLAM KALAN ALACAĞI gösterilir — Alacak Takibi ekranının
                    // üstündeki "KALAN ALACAK" rakamıyla birebir aynı kaynaktan
                    // (alacakDefterBilgi) gelir, dolayısıyla ikisi hep tutar.
                    // Ödemeler ve Kredi defterlerindeki desenin aynısı.
                    // NOT: Blok toplamları defterBakiye() üzerinden hesaplanmaya
                    // devam eder; alacak bir kasa parası olmadığı için blok
                    // toplamına EKLENMEZ (eski davranış korundu).
                    // ==========================================================
                    const al = alacakDefterBilgi(d);
                    return (
                      <div className="text-right shrink-0 max-w-[45%] sm:max-w-none sm:min-w-[120px]">
                        <div className={`text-base sm:text-lg font-black tabular-nums ${al.kalanAlacak > 0 ? 'text-rose-700' : 'text-emerald-600'}`}>₺{paraFmt(al.kalanAlacak)}</div>
                        <div className="text-[9px] sm:text-[10px] font-black uppercase text-rose-500 leading-tight">
                          {al.kalemSayisi === 0 ? 'Borçlu Eklenmemiş'
                            : al.kalanAlacak > 0 ? `Kalan Alacak • ${al.kalemSayisi} borçlu`
                            : 'Tüm Alacaklar Tahsil Edildi'}
                        </div>
                        {al.gecikmisAdet > 0 && (
                          <div className="text-[9px] font-black text-red-600 mt-0.5">{al.gecikmisAdet} gecikmiş • ₺{paraFmt(al.gecikmisTutar)}</div>
                        )}
                      </div>
                    );
                  })() : (
                  <div className="text-right shrink-0 max-w-[38%] sm:max-w-none">
                    {/* MOBİL: Bakiye sütunu daraltıldı, yazı küçültüldü ve
                        "Alacaklısınız / Kasada Var" etiketi telefonda yalnızca
                        "ALACAK" olarak kısaltıldı — uzun metin iki satıra taşıp
                        kart yüksekliğini bozuyordu. */}
                    <div className={`text-base sm:text-lg font-black tabular-nums ${bakiye > 0 ? 'text-emerald-600' : bakiye < 0 ? 'text-red-600' : 'text-neutral-400'}`}>₺{paraFmt(Math.abs(bakiye))}</div>
                    <div className={`text-[9px] sm:text-[10px] font-black uppercase leading-tight ${bakiye > 0 ? 'text-emerald-500' : bakiye < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                      <span className="sm:hidden">{bakiye > 0 ? 'Alacak' : bakiye < 0 ? 'Borç' : 'Sıfır'}</span>
                      <span className="hidden sm:inline">{bakiye > 0 ? 'Alacaklısınız / Kasada Var' : bakiye < 0 ? 'Borçlusunuz' : 'Bakiye Sıfır'}</span>
                    </div>
                  </div>
                  )}
                  {/* ==========================================================
                      YENİ (kullanıcı talebi): DEVİR DÜĞMESİ — her defterde var.
                      1 Eylül 2026'ya kadar KİLİTLİ görünür (deneme dönemi);
                      o gün ve sonrasında aktif olur. Eski uygulamadaki gerçek
                      kalan bakiye buradan girilir; bakiye banka ile eşleşir,
                      ciro etkilenmez. ========================================== */}
                  {/* DEĞİŞTİ (kullanıcı talebi): Devir süreci TAMAMLANDI —
                      DEVIR_DONEMI_TAMAMLANDI bayrağı açıkken düğme hiçbir
                      defterde çizilmez. Devri yapılmamış defterler de (bakiyesi
                      sıfır olanlar, Ödemeler/Krediler gibi kendi takibi olanlar)
                      "yapıldı" sayılır. Eski kurallar (yalnızca canlı dönemde ve
                      devir kaydı yoksa göster) aşağıda AYNEN duruyor; bayrak
                      false yapılırsa düğme eskisi gibi çalışmaya devam eder. */}
                  {!DEVIR_DONEMI_TAMAMLANDI && canliDonemde && !defterIslemleri(d.id).some(x => x.devirKaydi && !x.silindi) && (
                    <button type="button"
                      title="Eski uygulamadaki kalan bakiyeyi devret"
                      onClick={e => { e.stopPropagation(); setDevirModal({ defter: d, tutar: '', yon: 'giris', tarih: bugunStr() < SISTEM_DEVIR_TARIHI ? SISTEM_DEVIR_TARIHI : bugunStr(), not: '' }); }}
                      className="shrink-0 px-2.5 py-1.5 text-[10px] font-black rounded-lg transition bg-teal-600 hover:bg-teal-700 text-white">
                      Devir
                    </button>
                  )}
                </div>
              );
            })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ==================================================================
              TAŞINDI (kullanıcı talebi): GENEL ÖZET KARTI ARTIK EN ALTTA
              ================================================================== */}
          {/* DEĞİŞTİ (kullanıcı talebi): koyu yeşil gradyan KALDIRILDI; arka plan
              ŞEFFAF (üst tarafa uyumlu açık zemin) ve kart mobilde %20 küçültüldü
              ([zoom:0.8]). Metinler koyu zemin yerine açık zemine göre. */}
          <div className="[zoom:0.8] sm:[zoom:1] bg-transparent border-2 border-neutral-200 rounded-2xl p-5 md:p-6 text-neutral-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-emerald-700" />
              <h2 className="text-lg sm:text-xl font-black text-black">Defter</h2>
              {/* Alt başlık telefonda gizlenir — tek satıra sığmıyordu */}
              <span className="hidden sm:inline text-xs font-bold text-neutral-400">Kasa, cari ve borç/alacak takibi</span>
            </div>
            {/* ==============================================================
                YENİ: DÖNEM FİLTRESİ
                Aşağıdaki üç kutu (Giriş / Çıkış / Net) seçilen döneme göre
                hesaplanır. Varsayılan "Bugün"dür ve sayfa her açıldığında
                bugüne döner. Dar ekranda yatay kaydırılabilir.
                ============================================================== */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
              {/* MOBİL: Sekmeler daraltıldı; yedi seçenek dar ekranda yatay
                  kayarak sığar, yazı küçültülüp dolgu azaltıldı. */}
              {OZET_DONEMLERI.map(d => (
                <button key={d.id} type="button" onClick={() => setOzetDonem(d.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap transition shrink-0 border ${
                    ozetDonem === d.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200 hover:text-black'
                  }`}>
                  {d.ad}
                </button>
              ))}
            </div>
            {/* Seçili dönemin tarih aralığı — hangi aralığın toplandığı net görünsün */}
            {(() => {
              const a = donemAraligi(ozetDonem);
              const gg = (t) => t.split('-').reverse().join('.');
              return (
                <div className="text-[10px] font-bold text-neutral-400 mb-2">
                  {a ? (a.bas === a.bit ? gg(a.bas) : `${gg(a.bas)} — ${gg(a.bit)}`) : 'Tüm kayıtlar'}
                  {' • '}{ozetIslemleri.filter(ciroyaGirer).length} işlem
                </div>
              );
            })()}
            {/* ==============================================================
                DEĞİŞTİ (MOBİL DÜZELTME): Üç kutu dar ekranda yan yana
                sıkışıp rakamlar birbirinin üstüne biniyordu ("₺6.185.000,00"
                ile "₺6.022.982,02" iç içe geçiyordu). Artık:
                  • Telefonda ALT ALTA (etiket solda, rakam sağda) — rakam
                    ne kadar uzun olursa olsun taşmaz
                  • sm ve üzeri ekranda eski üçlü ızgara korunur
                  • Rakamlarda tabular-nums: basamaklar eşit genişlikte
                    hizalanır, alt alta okunması kolaylaşır
                ============================================================== */}
            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-emerald-50 rounded-xl p-2.5 sm:p-3 border border-emerald-200 flex sm:block items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1 shrink-0"><ArrowDownRight className="w-3.5 h-3.5" /> Toplam Giriş</div>
                <div className="text-base sm:text-lg md:text-2xl font-black sm:mt-1 tabular-nums text-right text-emerald-700">₺{paraFmt(toplamGiris)}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-2.5 sm:p-3 border border-red-200 flex sm:block items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1 shrink-0"><ArrowUpRight className="w-3.5 h-3.5" /> Toplam Çıkış</div>
                <div className="text-base sm:text-lg md:text-2xl font-black sm:mt-1 tabular-nums text-right text-red-700">₺{paraFmt(toplamCikis)}</div>
              </div>
              <div className="bg-neutral-100 rounded-xl p-2.5 sm:p-3 border border-neutral-200 flex sm:block items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1 shrink-0"><Wallet className="w-3.5 h-3.5" /> Net Bakiye</div>
                <div className={`text-base sm:text-lg md:text-2xl font-black sm:mt-1 tabular-nums text-right ${netBakiye >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₺{paraFmt(netBakiye)}</div>
              </div>
            </div>

            {/* ==============================================================
                YENİ: TOPLAM KREDİ BORCU
                Yalnızca en az bir kredi defteri varsa görünür. Dönem
                filtresinden ETKİLENMEZ — kalan borç kümülatif bir tutardır,
                "bugünkü kredi borcu" diye bir şey olmaz.
                ============================================================== */}
            {krediDefterleri.length > 0 && (
              <div className="mt-3 bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-violet-600" />
                  <div>
                    <div className="text-[10px] font-black uppercase text-violet-700">Toplam Kredi Borcu</div>
                    <div className="text-[10px] font-bold text-neutral-400">{krediDefterleri.length} kredi hesabı • tüm zamanlar</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base sm:text-lg md:text-2xl font-black text-violet-700 tabular-nums">₺{paraFmt(toplamKrediBorcu)}</div>
                  {toplamGecikmis > 0 && (
                    <div className="text-[10px] font-black text-red-600">{toplamGecikmis} gecikmiş taksit</div>
                  )}
                </div>
              </div>
            )}

            {/* YENİ: BEKLEYEN ÖDEMELER — bu ay vadesi gelen + gecikmişler */}
            {odemeDefterleri.length > 0 && (toplamBuAyBekleyen > 0 || toplamGecikmisOdeme > 0) && (
              <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-orange-600" />
                  <div>
                    <div className="text-[10px] font-black uppercase text-orange-700">Bu Ay Bekleyen Ödemeler</div>
                    <div className="text-[10px] font-bold text-neutral-400">{odemeDefterleri.length} ödeme defteri</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base sm:text-lg md:text-2xl font-black text-orange-700 tabular-nums">₺{paraFmt(toplamBuAyBekleyen)}</div>
                  {toplamGecikmisOdeme > 0 && (
                    <div className="text-[10px] font-black text-red-600">{toplamGecikmisOdeme} gecikmiş ödeme</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ==================================================================
              TAŞINDI (kullanıcı talebi): DEFTER ARAMA + YENİ DEFTER
              Artık sayfanın en altında. İçerik hiç değişmedi. */}
          {/* ARAMA + YENİ DEFTER */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Defter ara (kasa, kişi, firma adı)..."
                className="w-full pl-9 pr-3 py-3 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600 bg-white transition" />
            </div>
            <button onClick={() => { setDefterForm({ ad: '', tur: 'Nakit', not: '', blok: VARSAYILAN_BLOK, kredi: bosKrediForm }); setEditingDefterId(null); setShowDefterForm(true); }}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl transition flex items-center gap-2 shadow-md shadow-emerald-600/20 shrink-0">
              <PlusCircle className="w-4 h-4" /> Yeni Defter
            </button>
          </div>

          {/* ==================================================================
              YENİ (kullanıcı talebi): DEVİR TUTARI PENCERESİ
              ==================================================================
              Eski uygulamadaki gerçek kalan bakiye buradan girilir. Kayıt
              bakiyeye işlenir (banka ile eşleşir) ama ciroya GİRMEZ. */}
          {devirModal && (
            <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-black flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-teal-600" /> Devir Tutarı Gir</h3>
                  <button onClick={() => setDevirModal(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                    <div className="font-black text-teal-900">{devirModal.defter.ad}</div>
                    <div className="text-[11px] font-bold text-teal-600">{defterTuruEtiket(devirModal.defter.tur)} • Sistem geçişi açılış bakiyesi</div>
                  </div>

                  {/* YÖN: kasada var (giriş) mı, borç (çıkış) mı? */}
                  <div>
                    <label className="text-xs font-bold text-neutral-600 block mb-1">Devir Yönü *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setDevirModal({ ...devirModal, yon: 'giris' })}
                        className={`p-2.5 rounded-xl text-xs font-black transition border ${devirModal.yon === 'giris' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'}`}>
                        Kasada Var / Alacak
                      </button>
                      <button type="button" onClick={() => setDevirModal({ ...devirModal, yon: 'cikis' })}
                        className={`p-2.5 rounded-xl text-xs font-black transition border ${devirModal.yon === 'cikis' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'}`}>
                        Borç
                      </button>
                    </div>
                  </div>

                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Devir Tutarı (₺) *</label>
                    <input type="number" inputMode="decimal" value={devirModal.tutar}
                      onChange={e => setDevirModal({ ...devirModal, tutar: e.target.value })}
                      placeholder="Eski uygulamadaki kalan bakiye"
                      className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-lg font-black" /></div>

                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Devir Tarihi</label>
                    <input type="date" value={devirModal.tarih} min={SISTEM_DEVIR_TARIHI}
                      onChange={e => setDevirModal({ ...devirModal, tarih: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" />
                    <p className="text-[10px] font-bold text-neutral-400 mt-1">Girdiğiniz gün işlenir; {SISTEM_DEVIR_TARIHI.split('-').reverse().join('.')} öncesine alınamaz.</p></div>

                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                    <input value={devirModal.not} onChange={e => setDevirModal({ ...devirModal, not: e.target.value })}
                      placeholder="Örn: Garanti hesap ekstresiyle eşleşti"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" /></div>

                  <p className="text-[11px] font-medium text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                    Devir kaydı defterin <b>bakiyesine işlenir</b> (banka hesabıyla birebir eşleşmesi için) ama <b>ciroya ve gelir/gider raporlarına girmez</b> — o ayın rakamlarını etkilemez.
                  </p>

                  <button onClick={devirKaydet} disabled={devirKaydediliyor}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> {devirKaydediliyor ? 'Kaydediliyor...' : 'Devri Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DEFTER OLUŞTUR/DÜZENLE PENCERESİ */}
          {showDefterForm && (
            <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-black flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" /> {editingDefterId ? 'Defteri Düzenle' : 'Yeni Defter'}</h3>
                  <button onClick={() => setShowDefterForm(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Defter Adı *</label>
                    <input value={defterForm.ad} onChange={e => setDefterForm({ ...defterForm, ad: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" placeholder="Örn: MERKEZ KASA, Ahmet Usta, X Tedarikçi" /></div>
                  {/* ==============================================================
                      YENİ: BLOK SEÇİMİ
                      Defterin hangi grubun (şirketin) altında listeleneceğini
                      belirler. Türden ÖNCE sorulur, çünkü blok daha üst
                      seviye bir ayrımdır: önce "kimin defteri", sonra "ne tür".
                      ============================================================== */}
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Blok (Grup)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DEFTER_BLOKLARI.map(b => (
                        <button key={b} type="button" onClick={() => setDefterForm({ ...defterForm, blok: b })}
                          className={`py-2 px-1 rounded-lg text-[11px] font-black border-2 transition leading-tight ${
                            defterForm.blok === b ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Defter Türü</label>
                    <select value={defterForm.tur} onChange={e => setDefterForm({ ...defterForm, tur: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      {DEFTER_TURLERI.map(t => <option key={t}>{t}</option>)}
                    </select></div>

                  {/* ==============================================================
                      YENİ: KREDİ BİLGİLERİ — yalnızca tür "Kredi" seçilince açılır
                      Girilen dört bilgiden (toplam geri ödeme, taksit sayısı, ilk
                      taksit tarihi, aylık taksit) taksit planı OTOMATİK üretilir.
                      Aylık taksit boş bırakılırsa toplam / taksit sayısı olarak
                      hesaplanır. Ana para ile toplam geri ödeme arasındaki fark
                      "toplam faiz/masraf" olarak gösterilir.
                      ============================================================== */}
                  {/* Ödemeler türü seçilince: kalemler defter açıldıktan sonra eklenir */}
                  {defterForm.tur === 'Ödemeler' && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] font-bold text-orange-800">
                      Bu defter <b>kira, sigorta, vergi, abonelik</b> gibi düzenli ödemeleri takip eder. Defteri açtıktan sonra içine tek tek ödeme kalemleri ekleyecek, her biri için tekrar sıklığını (haftalık/aylık/yıllık), kaç kez tekrarlanacağını ve ilk ödeme tarihini belirleyeceksiniz.
                    </div>
                  )}
                  {/* DEĞİŞTİ: Kredi bilgileri artık BURADA sorulmuyor.
                      Bir şirketin birden fazla kredisi olabildiği için Kredi
                      defteri, Ödemeler defteriyle aynı mantığa geçirildi:
                      defter bir KAPSAYICIDIR, krediler defterin içine tek tek
                      eklenir. Böylece tüm krediler tek defterde toplanır ve
                      toplam borç bir arada görünür. */}
                  {defterForm.tur === 'Kredi' && (
                    <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-[11px] font-bold text-violet-800">
                      Bu defter <b>tüm kredilerinizi</b> tek çatı altında toplar. Defteri açtıktan sonra içine girip <b>"Yeni Kredi Ekle"</b> ile her krediyi ayrı ayrı tanımlayacaksınız (banka, ana para, toplam geri ödeme, taksit sayısı, ilk taksit tarihi). Toplam kredi borcunuz tüm kalemlerin toplamı olarak görünür.
                    </div>
                  )}
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                    <input value={defterForm.not} onChange={e => setDefterForm({ ...defterForm, not: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" placeholder="Opsiyonel açıklama..." /></div>
                  {/* ==============================================================
                      YENİ (kullanıcı talebi): DEPOEVİM CRM ENTEGRASYON PANELİ
                      ==============================================================
                      Yalnızca BANKA türü defterlerin DÜZENLEME penceresinde
                      görünür. Depoevim CRM'deki tahsilatların bu deftere
                      otomatik gelir olarak akması için gereken iki kimlik
                      (Defter ID + Uygulama ID) burada gösterilir ve tek
                      dokunuşla kopyalanır. Kimlikler, Depoevim projesine
                      eklenecek köprü dosyasına (sembolKoprusu.js) yapıştırılır.
                      Köprüden gelen kayıtlar kaynak='Depoevim CRM' rozetiyle
                      normal GELİR olarak işlenir (bakiye + ciroya girer). */}
                  {editingDefterId && defterForm.tur === 'Banka' && (
                    <div className="p-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl space-y-2">
                      <div className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4" /> Depoevim CRM Entegrasyonu
                      </div>
                      <p className="text-[11px] font-medium text-indigo-700">
                        Depoevim CRM tahsilatlarının bu deftere otomatik <b>GELİR</b> olarak düşmesi için aşağıdaki iki kimliği kopyalayıp Depoevim projesindeki <b>sembolKoprusu.js</b> dosyasına yapıştırın.
                      </p>
                      {/* ==========================================================
                          YENİ (kullanıcı talebi): SİLME SENKRONİZASYONU SÖZLEŞMESİ
                          ----------------------------------------------------------
                          Depoevim'de bir tahsilat silindiğinde burada da düşmeli,
                          AMA kayıt yok olmamalı — "silinmiştir" damgası ile
                          görünmeye devam etmeli. Bu ekranın tarafı hazırdır:
                          aşağıdaki üç alan yazıldığı anda satır otomatik olarak
                          soluklaşır, "DEPOEVİM CRM'DE SİLİNDİ" rozeti alır,
                          bakiye ve ciro hesaplarından düşer ama "Silinen"
                          sekmesinde listelenmeye devam eder.
                          Köprünün yapması gereken TEK ŞEY: kaydı silmek yerine
                          güncellemek (updateDoc) — asla deleteDoc kullanmamak.
                          ========================================================== */}
                      <div className="p-2 bg-white rounded-lg border border-indigo-200">
                        <div className="text-[9px] font-black uppercase text-indigo-400 mb-1">Silme Senkronizasyonu</div>
                        <p className="text-[10px] font-medium text-neutral-600 leading-snug">
                          Depoevim'de bir tahsilat silindiğinde köprü, ilgili kaydı <b>silmemeli</b>; şu üç alanı yazacak şekilde <b>güncellemelidir</b>:
                        </p>
                        <pre className="mt-1 p-2 bg-neutral-900 text-emerald-300 rounded-md text-[9px] font-mono overflow-x-auto leading-relaxed">{`silindi: true,
silmeKaynagi: 'Depoevim CRM',
silinmeTarihi: new Date().toISOString()`}</pre>
                        <p className="text-[10px] font-medium text-neutral-500 mt-1 leading-snug">
                          Bu yazıldığı anda kayıt burada <b>"DEPOEVİM CRM'DE SİLİNDİ"</b> damgası alır; bakiye ve ciroya dahil edilmez, <b>"Silinen"</b> sekmesinden görüntülenebilir.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 p-2 bg-white rounded-lg border border-indigo-200">
                          <div className="text-[9px] font-black uppercase text-indigo-400">Defter ID (HEDEF_DEFTER_ID)</div>
                          <div className="text-[11px] font-mono font-bold text-neutral-700 truncate">{editingDefterId}</div>
                        </div>
                        <button type="button" onClick={() => panoyaKopyala(editingDefterId, 'entg_defter')}
                          className="shrink-0 px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition">
                          {kopyalanan === 'entg_defter' ? 'Kopyalandı ✓' : 'Kopyala'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 p-2 bg-white rounded-lg border border-indigo-200">
                          <div className="text-[9px] font-black uppercase text-indigo-400">Uygulama ID (SEMBOL_APP_ID)</div>
                          <div className="text-[11px] font-mono font-bold text-neutral-700 truncate">{appId}</div>
                        </div>
                        <button type="button" onClick={() => panoyaKopyala(appId, 'entg_app')}
                          className="shrink-0 px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition">
                          {kopyalanan === 'entg_app' ? 'Kopyalandı ✓' : 'Kopyala'}
                        </button>
                      </div>
                    </div>
                  )}
                  <button onClick={handleSaveDefter} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition">{editingDefterId ? 'Kaydet' : 'Defteri Aç'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ======================== DEFTER DETAY GÖRÜNÜMÜ ========================
    // ========================================================================
    // PERFORMANS (kullanıcı talebi: "Yeni Ödeme penceresi tıkladığım gibi
    // açılmıyor"): Ödemeler ve Kredi sayfalarında günlük işlem bölümü hiç
    // ÇİZİLMİYOR; buna rağmen aşağıdaki filtre + arama + sıralama zinciri
    // her tıklamada (pencere açma dahil) baştan hesaplanıyordu. Binlerce
    // kayıtta asıl gecikme buydu. Artık bu hesaplar yalnızca işlem
    // listesinin gerçekten görüneceği defter türlerinde yapılır.
    const islemBolumuGerekli = seciliDefter.tur !== 'Ödemeler' && seciliDefter.tur !== 'Kredi';
    const dIslemler = !islemBolumuGerekli ? [] : [
      ...defterIslemleri(seciliDefterId),
      // ======================================================================
      // DEĞİŞTİ (kullanıcı talebi): TAŞINAN ÖDEMELER ARTIK BLOK DEĞİL
      // ======================================================================
      // Eskiden başka deftere taşınan ödemeler listenin üstünde tek bir toplu
      // blok olarak duruyordu ("49 iş"). Artık her biri NORMAL BİR İŞLEM SATIRI
      // gibi davranır ve KENDİ GÜNÜNE göre listede sıralanır.
      // Bunlar SANAL satırlardır: veritabanında kayıt değiller, yalnızca bilgi
      // amaçlı gösterilirler. Bakiye, ciro, gün toplamları ve tüm hesaplar
      // ayrı kaynaklardan (defterIslemleri / gunIslemleri) beslendiği için bu
      // satırların hiçbir hesaba etkisi YOKTUR.
      ...tasinanOdemeler.map(j => ({
        id: `tasinan_${j.id}`,
        _tasinanBilgi: true,                 // render'da özel satır olarak çizilir
        tarih: j.date,
        createdAt: j.completedAt || j.date,
        tip: 'giris',                        // filtre uyumu için (gelir tarafı)
        tutar: j.tutar,
        kategori: 'Taşınan Ödeme',
        etiketler: [],
        aciklama: `${j.customerName} — (${(j.yontem || '').toUpperCase()} OLARAK ÖDEMEYİ KAPATTI) ${j.hedefEtiket}`,
        _musteri: j.customerName,
        _saat: j.time,
        _tur: j.type,
        _plaka: j.assignedVehiclePlate,
        _kapora: parseFloat(j.deposit) || 0,
        _yontem: j.yontem,
        _hedefEtiket: j.hedefEtiket,
      })),
    ]
      // YENİ (kullanıcı talebi): eski "Maaş Tablosu (Oto)" otomatik kayıtları
      // listede GÖRÜNMEZ. Maaş/avans yalnızca Ödemeler'den ödenince görünür.
      .filter(i => !otomatikMaasKaydi(i))
      // YENİ: GÜNLÜK FİLTRE — en başta uygulanır ki arama ve kategori
      // filtreleri yalnızca o günün hareketleri içinde çalışsın.
      .filter(i => !gunFiltreAktif || i.tarih === seciliGun)
      // YENİ: Gelir / Gider / Transfer filtresi.
      // Transferler (isVirman) gelir ve gider listelerinden çıkarılır; kendi
      // sekmelerinde görünürler.
      .filter(i => hareketFiltre === 'tumu'
        // YENİ: yalnızca silinmiş (damgalanmış) kayıtlar
        || (hareketFiltre === 'silinen' && i.silindi)
        || (hareketFiltre === 'transfer' && i.isVirman)
        || (hareketFiltre === 'giris' && i.tip === 'giris' && !i.isVirman)
        || (hareketFiltre === 'cikis' && i.tip === 'cikis' && !i.isVirman))
      .filter(i => kategoriFiltre === 'Tümü' || i.kategori === kategoriFiltre)
      .filter(i => {
        const q = detayArama.trim().toLocaleLowerCase('tr-TR');
        if (!q) return true;
        return (i.aciklama || '').toLocaleLowerCase('tr-TR').includes(q) ||
               (i.kategori || '').toLocaleLowerCase('tr-TR').includes(q) ||
               (i.etiketler || []).some(e => e.toLocaleLowerCase('tr-TR').includes(q));
      })
      .sort((a, b) => new Date(b.tarih) - new Date(a.tarih) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // YENİ: SEÇİLİ GÜNÜN toplamları. Arama/kategori filtresinden BAĞIMSIZ
    // hesaplanır; o günün gerçek gelir-gider tablosunu göstermesi gerekiyor.
    // PERFORMANS: işlem bölümü çizilmeyen defterlerde (Ödemeler/Kredi) atlanır.
    const gunIslemleri = !islemBolumuGerekli ? [] : defterIslemleri(seciliDefterId).filter(i => i.tarih === seciliGun);
    // Günün GELİR / GİDER rakamlarında da virman sayılmaz (yukarıdaki gerekçe).
    // Transferler listede görünür ama bu üç rakamı bozmaz.
    const gunGiris = gunIslemleri.filter(i => i.tip === 'giris' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const gunCikis = gunIslemleri.filter(i => i.tip === 'cikis' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const gunNet = gunGiris - gunCikis;
    // O gün yapılan transfer toplamı — ayrı bir bilgi olarak gösterilir.
    const gunVirman = gunIslemleri.filter(i => i.isVirman && i.tip === 'cikis').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);

    // Hangi günlerde hareket var? Ok tuşlarının yanında ipucu göstermek için.
    // PERFORMANS: işlem bölümü çizilmeyen defterlerde boş küme yeterli.
    const hareketliGunler = new Set(islemBolumuGerekli ? defterIslemleri(seciliDefterId).map(i => i.tarih) : []);

    // Toplam (tüm zamanlar) — üst karttaki defter bakiyesi bunu kullanır,
    // günlük filtre bu rakamları ETKİLEMEZ. Bakiye her zaman defterin
    // gerçek durumunu göstermeli, yoksa yanlış okunur.
    // DEĞİŞTİ (kullanıcı talebi): başlıktaki toplamlar da canlı dönem kuralına
    // uyar — 1 Eylül 2026'dan itibaren yalnızca o tarihten sonraki işlemler
    // sayılır; günlük işlem listesi ise filtrelenmez, eski kayıtlar görünür.
    const dGiris = defterIslemleri(seciliDefterId).filter(i => i.tip === 'giris' && hesabaKatilir(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const dCikis = defterIslemleri(seciliDefterId).filter(i => i.tip === 'cikis' && hesabaKatilir(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const dBakiye = dGiris - dCikis;

    // Kategori dağılımı (bu defterin tüm işlemleri üzerinden)
    // PERFORMANS: Kredi sayfasında bu kart gizli olduğundan hesap da atlanır.
    // ========================================================================
    // DEĞİŞTİ (kullanıcı talebi): KATEGORİ DAĞILIMI KARTI TÜM SAYFALARDAN
    // KALDIRILDI. Kod silinmedi; ileride geri istenirse aşağıdaki anahtarı
    // true yapmak yeterlidir. false iken hem kart çizilmez hem de hesap
    // hiç yapılmaz (boşa işlem dönmesin diye).
    // ========================================================================
    const KATEGORI_DAGILIMI_GOSTER = false;
    const katDagilim = {};
    if (KATEGORI_DAGILIMI_GOSTER && seciliDefter.tur !== 'Kredi') defterIslemleri(seciliDefterId).forEach(i => {
      const k = i.kategori || 'Diğer';
      if (!katDagilim[k]) katDagilim[k] = { giris: 0, cikis: 0 };
      katDagilim[k][i.tip === 'giris' ? 'giris' : 'cikis'] += (parseFloat(i.tutar) || 0);
    });
    const katToplam = Object.values(katDagilim).reduce((t, v) => t + v.giris + v.cikis, 0) || 1;

    return (
      <div className="max-w-5xl mx-auto animate-in fade-in space-y-4 pb-24">
        {/* ==================================================================
            BAŞLIK + BAKİYE KARTI
            ==================================================================
            DEĞİŞTİ (kullanıcı talebi): Kart mobilde çok yer kaplıyordu —
            yaklaşık %40 küçültüldü. Küçülen ölçüler:
              • Dış dolgu       p-5      -> p-3   (sm+ p-4)
              • Defter adı      text-2xl -> text-base (sm+ text-xl)
              • Bakiye rakamı   text-3xl -> text-xl   (sm+ text-2xl)
              • Tür simgesi     w-6      -> w-4      (sm+ w-5)
              • Geri/düzenle/sil düğmeleri ve iç kutular da aynı oranda
            Masaüstünde eski görünüme yakın kalması için sm: kırılımında
            ölçüler bir kademe yukarı çıkarıldı. */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-neutral-900 rounded-2xl p-3 sm:p-4 text-white shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button onClick={() => setSeciliDefterId(null)} className="flex items-center gap-1 text-white/80 hover:text-white font-bold text-xs sm:text-sm transition"><ChevronLeft className="w-4 h-4" /> Defterler</button>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setDefterForm({ ad: seciliDefter.ad, tur: seciliDefter.tur, not: seciliDefter.not || '', blok: defterBlogu(seciliDefter), kredi: { ...bosKrediForm, ...(seciliDefter.kredi || {}) } }); setEditingDefterId(seciliDefter.id); setShowDefterForm(true); }}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition" title="Defteri Düzenle"><Edit className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDeleteDefterId(seciliDefter.id)} className="p-1.5 bg-white/10 hover:bg-red-500/60 rounded-lg transition" title="Defteri Sil"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              {/* Tür simgesi liste kartlarıyla aynı; hangi defterde olduğunuz belli olsun diye. */}
              <h2 className="text-base sm:text-xl font-black flex items-center gap-1.5 leading-tight">
                {(() => { const { Ikon } = defterTuruGorunum(seciliDefter.tur); return <Ikon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white/80" />; })()}
                <span className="break-words">{seciliDefter.ad}</span>
              </h2>
              <div className="text-[10px] sm:text-xs font-bold text-white/60 mt-0.5">{defterTuruEtiket(seciliDefter.tur)}{seciliDefter.not ? ` • ${seciliDefter.not}` : ''}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-xl sm:text-2xl font-black tabular-nums leading-tight ${dBakiye >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>₺{paraFmt(Math.abs(dBakiye))}</div>
              <div className="text-[9px] sm:text-[10px] font-black uppercase text-white/70 leading-tight">{dBakiye > 0 ? 'Alacaklısınız / Kasada Var' : dBakiye < 0 ? 'Borçlusunuz' : 'Bakiye Sıfır'}</div>
            </div>
          </div>
          {/* KALDIRILDI (kullanıcı talebi): TOPLAM GELİR / TOPLAM GİDER
              kartları başlıktan çıkarıldı — geri istenirse false -> true. */}
          {false && (
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <div className="bg-white/10 rounded-lg p-2 border border-white/10">
              <div className="text-[9px] font-black uppercase text-emerald-300">Toplam Gelir</div>
              <div className="text-sm font-black tabular-nums">₺{paraFmt(dGiris)}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2 border border-white/10">
              <div className="text-[9px] font-black uppercase text-red-300">Toplam Gider</div>
              <div className="text-sm font-black tabular-nums">₺{paraFmt(dCikis)}</div>
            </div>
          </div>
          )}
        </div>

        {/* ==================================================================
            YENİ: KREDİ PANELİ — yalnızca tür "Kredi" olan defterlerde görünür
            Üstte dört özet kutusu, altında ilerleme çubuğu ve taksit tablosu.
            Her ödenmemiş taksitin yanında "Öde" düğmesi vardır; ödeme hangi
            defterden yapılacaksa oradan ÇIKIŞ, kredi defterine GİRİŞ yazılır.
            ================================================================== */}
        {/* ==================================================================
            KREDİ PANELİ — tür "Kredi" olan defterlerde görünür
            ==================================================================
            DEĞİŞTİ: Artık defterin KENDİSİ tek bir kredi değil; defter bir
            kapsayıcıdır ve içinde birden çok kredi kalemi bulunur (Ödemeler
            defteriyle aynı desen). Üstte tüm kredilerin toplamı, altında her
            kredi ayrı kart olarak listelenir; kart açılınca taksit planı çıkar.
            ================================================================== */}
        {seciliDefter.tur === 'Kredi' && (() => {
          const kd = krediDefterBilgi(seciliDefter);
          const genelYuzde = kd.toplamGeriOdeme > 0 ? Math.round((kd.toplamOdenen / kd.toplamGeriOdeme) * 100) : 0;

          // ============================================================
          // YENİ (kullanıcı talebi): AYLIK KREDİ GÖRÜNÜMÜ
          // ============================================================
          // Ödemeler sayfasıyla AYNI mantık: seçili aya (krediAyi) vadesi
          // düşen taksitler — hangi krediden olursa olsun — tek listede,
          // güne göre sıralı gösterilir. Ödenen taksitler en alttaki
          // "Ödenenler" bölümüne iner. Günlük takvim/uzun taksit tablosu
          // ana sayfadan kaldırıldı; tüm kredilerin ayrıntısı artık
          // "Mevcut Krediler" düğmesinin açtığı panelde.
          const [ky, km] = krediAyi.split('-').map(Number);
          const ayBaslik = `${AY_ADLARI[km - 1]} ${ky}`;
          // Sağ/sol oklarla ay değiştirme — Ödemeler'deki ayDegistir ile aynı
          const krediAyDegistir = (yon) => {
            const d = new Date(ky, km - 1 + yon, 1);
            setKrediAyi(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          };
          // Seçili aya düşen TÜM taksitleri topla (tüm kredi kalemlerinden)
          const ayinTaksitleri = [];
          kd.detaylar.forEach(({ kalem, bilgi }) => {
            (bilgi.plan || []).forEach(t => {
              if (t.tarih && t.tarih.startsWith(krediAyi)) ayinTaksitleri.push({ kalem, bilgi, t });
            });
          });
          // Gün sıralaması: ayın en erken vadesi en üstte
          ayinTaksitleri.sort((a, b) => a.t.tarih.localeCompare(b.t.tarih));
          const bekleyenTaksitler = ayinTaksitleri.filter(s => !s.t.odendi);
          const odenenTaksitler = ayinTaksitleri.filter(s => s.t.odendi);
          const buAyBekleyenTutar = bekleyenTaksitler.reduce((top, s) => top + (parseFloat(s.t.tutar) || 0), 0);
          const trh = (t) => t?.split('-').reverse().join('.');
          return (
            <div className="bg-white rounded-2xl border border-violet-200 overflow-hidden">
              {/* BAŞLIK ÇUBUĞU — Ödeme Planları başlığıyla aynı düzen */}
              <div className="bg-violet-600 text-white px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black flex items-center gap-2 text-sm">
                  <Landmark className="w-4 h-4" /> Krediler
                  <span className="text-[10px] font-bold text-white/70">{kd.kalemSayisi} kredi</span>
                  {kd.gecikmisAdet > 0 && (
                    <span className="text-[10px] font-black bg-red-500 px-2 py-0.5 rounded-full">{kd.gecikmisAdet} GECİKMİŞ TAKSİT</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* YENİ: "Mevcut Krediler" — Yeni Kredi Ekle'nin SOL yanında.
                      Tıklanınca tüm kredi kartları (taksit planlarıyla) açılır;
                      tekrar tıklanınca aylık görünüme dönülür. */}
                  <button type="button" onClick={() => setMevcutKredilerAcik(v => !v)}
                    className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition flex items-center gap-1.5 ${
                      mevcutKredilerAcik ? 'bg-white text-violet-700 hover:bg-violet-50' : 'bg-violet-800 text-white hover:bg-violet-900'}`}>
                    <ClipboardList className="w-3.5 h-3.5" /> {mevcutKredilerAcik ? 'Aylık Görünüm' : 'Mevcut Krediler'}
                  </button>
                  <button type="button"
                    onClick={() => setKrediKalemForm({ ...bosKrediKalemi })}
                    className="px-3 py-1.5 bg-white text-violet-700 text-[11px] font-black rounded-lg hover:bg-violet-50 transition flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> Yeni Kredi Ekle
                  </button>
                </div>
              </div>

              {/* HİÇ KREDİ YOKSA — boş durum (iki görünümde de aynı) */}
              {kd.kalemSayisi === 0 && (
                <div className="p-4">
                  <div className="text-center py-8 border border-dashed border-neutral-300 rounded-xl">
                    <Landmark className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-neutral-400">Henüz kredi eklenmemiş.</p>
                    <p className="text-[11px] font-medium text-neutral-400 mt-1">"Yeni Kredi Ekle" ile taşıt, ihtiyaç, ticari kredilerinizi tek tek tanımlayın.</p>
                  </div>
                </div>
              )}

              {/* ==========================================================
                  GÖRÜNÜM 1: AYLIK KREDİ ÖDEMELERİ (varsayılan ana sayfa)
                  Ödemeler sayfasındaki desenin birebir kredi karşılığı.
                  ========================================================== */}
              {kd.kalemSayisi > 0 && !mevcutKredilerAcik && (
                <>
                  {/* ÜST ÖZET: bu ay bekleyen + gecikmiş — Ödemeler ile aynı */}
                  <div className="grid grid-cols-2 gap-2 p-4 pb-0">
                    <div className="bg-violet-50 rounded-xl p-2.5 border border-violet-200">
                      <div className="text-[9px] font-black uppercase text-violet-600">Bu Ay Bekleyen</div>
                      <div className="text-sm font-black text-violet-700">₺{paraFmt(buAyBekleyenTutar)}</div>
                    </div>
                    <div className={`rounded-xl p-2.5 border ${kd.gecikmisAdet > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <div className={`text-[9px] font-black uppercase ${kd.gecikmisAdet > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Gecikmiş</div>
                      <div className={`text-sm font-black ${kd.gecikmisAdet > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {kd.gecikmisAdet > 0 ? `${kd.gecikmisAdet} taksit` : 'Yok'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* AY GEZGİNİ — "Ağustos 2026 Kredi Ödemeleri" */}
                    <div className="flex items-center justify-between gap-2 bg-neutral-900 text-white rounded-xl px-2 py-2 mb-2">
                      <button type="button" onClick={() => krediAyDegistir(-1)} className="p-2 hover:bg-white/10 rounded-lg transition"><ChevronLeft className="w-5 h-5" /></button>
                      <div className="text-center">
                        <div className="font-black text-base">{ayBaslik} Kredi Ödemeleri</div>
                        <div className="text-[10px] font-bold text-white/60">{bekleyenTaksitler.length} bekleyen • {odenenTaksitler.length} ödenen</div>
                      </div>
                      <button type="button" onClick={() => krediAyDegistir(1)} className="p-2 hover:bg-white/10 rounded-lg transition"><ChevronRight className="w-5 h-5" /></button>
                    </div>

                    {/* BEKLEYEN TAKSİTLER — güne göre sıralı, en erken üstte */}
                    <div className="space-y-1.5">
                      {bekleyenTaksitler.length === 0 && (
                        <div className="p-4 text-center text-xs font-bold text-neutral-400 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">Bu ay bekleyen kredi ödemesi yok.</div>
                      )}
                      {bekleyenTaksitler.map(({ kalem, bilgi, t }) => (
                        <div key={`${kalem.id}_${t.no}`} className={`flex items-center gap-2 p-2.5 rounded-xl border ${t.gecikmis ? 'border-red-300 bg-red-50' : 'border-violet-200 bg-violet-50'}`}>
                          {/* Vadeye 7 gün ve daha az kaldıysa yanıp sönen uyarı — Ödemeler ile aynı */}
                          {vadeYaklasti(t.tarih) && !t.gecikmis && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" title="Vadeye 1 haftadan az kaldı"></span>}
                          <Landmark className={`w-4 h-4 shrink-0 ${t.gecikmis ? 'text-red-600' : 'text-violet-600'}`} />
                          <div className="flex-1 min-w-0">
                            {/* Başlıkta ayın adı yazar: "Ağustos Taksiti" — hangi ayın
                                borcu olduğu tek bakışta anlaşılır (Ödemeler deseni) */}
                            <div className="font-black text-sm text-neutral-800 truncate">
                              {bilgi.ad} <span className="text-neutral-500 font-bold">— {AY_ADLARI[Number(t.tarih.slice(5, 7)) - 1]} Taksiti ({t.no}/{bilgi.taksitSayisi})</span>
                            </div>
                            <div className="text-[10px] font-bold text-neutral-500">
                              Vade: {trh(t.tarih)}{bilgi.bankaAdi ? ` • ${bilgi.bankaAdi}` : ''}
                              {t.gecikmis && <span className="ml-1 text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full">GECİKMİŞ</span>}
                              {/* YENİ: kısmi ödeme rozeti */}
                              {t.kismi && <span className="ml-1 text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full">KISMİ ÖDENDİ • ₺{paraFmt(t.odenenTutar)} yatırıldı</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {/* KISMİ ÖDEME: ekranda KALAN tutar gösterilir */}
                            <div className={`font-black tabular-nums ${t.gecikmis ? 'text-red-700' : 'text-violet-700'}`}>₺{paraFmt(t.kalan ?? t.tutar)}</div>
                            {t.kismi && <div className="text-[9px] font-bold text-neutral-400 line-through">₺{paraFmt(t.tutar)}</div>}
                            {vadeYaklasti(t.tarih) && !t.gecikmis && <div className="text-[9px] font-black text-red-600 animate-pulse">YAKLAŞIYOR</div>}
                          </div>
                          <button type="button" onClick={() => setTaksitOdeme({ kalem, taksit: t, kaynakDefterId: '', tarih: bugunStr(), tutar: String(t.kalan ?? t.tutar) })}
                            className="shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-lg transition">Öde</button>
                        </div>
                      ))}
                    </div>

                    {/* ÖDENENLER — en altta ayrı bölüm (Ödemeler ile aynı) */}
                    {odenenTaksitler.length > 0 && (
                      <div className="mt-3 border-t-2 border-dashed border-emerald-300 pt-2">
                        <div className="text-[10px] font-black text-emerald-700 uppercase mb-1.5 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> Ödenenler ({odenenTaksitler.length})
                        </div>
                        <div className="space-y-1">
                          {odenenTaksitler.map(({ kalem, bilgi, t }) => (
                            <div key={`${kalem.id}_${t.no}`} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 opacity-80">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="flex-1 text-xs font-bold text-emerald-900 truncate line-through">
                                {bilgi.ad} — {AY_ADLARI[Number(t.tarih.slice(5, 7)) - 1]} Taksiti ({t.no}/{bilgi.taksitSayisi}) • ₺{paraFmt(t.tutar)}
                              </span>
                              <span className="text-[10px] font-black text-emerald-700 shrink-0">
                                {t.devir ? 'Devir (sistem öncesi)' : (t.odemeTarihi ? trh(t.odemeTarihi) : 'Ödendi')} ✓
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ==========================================================
                  GÖRÜNÜM 2: MEVCUT KREDİLER (düğmeyle açılır)
                  Eski ana sayfadaki her şey buraya taşındı: dört özet kutusu,
                  toplam ilerleme çubuğu ve taksit planlı kredi kartları.
                  ========================================================== */}
              {kd.kalemSayisi > 0 && mevcutKredilerAcik && (
                <>
                  {/* TÜM KREDİLERİN TOPLAMI */}
                  <div className="p-4 pb-0 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200">
                        <div className="text-[9px] font-black uppercase text-neutral-500">Toplam Ana Para</div>
                        <div className="text-sm font-black text-black">₺{paraFmt(kd.toplamAnaPara)}</div>
                      </div>
                      <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200">
                        <div className="text-[9px] font-black uppercase text-neutral-500">Toplam Geri Ödeme</div>
                        <div className="text-sm font-black text-black">₺{paraFmt(kd.toplamGeriOdeme)}</div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200">
                        <div className="text-[9px] font-black uppercase text-emerald-600">Ödenen</div>
                        <div className="text-sm font-black text-emerald-700">₺{paraFmt(kd.toplamOdenen)}</div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-2.5 border border-red-200">
                        <div className="text-[9px] font-black uppercase text-red-600">Kalan Borç</div>
                        <div className="text-sm font-black text-red-700">₺{paraFmt(kd.toplamBorc)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-black mb-1">
                        <span className="text-neutral-600">Toplam Ödeme İlerlemesi</span>
                        <span className="text-violet-700">%{genelYuzde}</span>
                      </div>
                      <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all" style={{ width: `${genelYuzde}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {kd.detaylar.map(({ kalem, bilgi }) => {
                      const acik = acikKrediKalemi === kalem.id;
                      const yuzde = bilgi.toplamGeriOdeme > 0 ? Math.round((bilgi.odenenTutar / bilgi.toplamGeriOdeme) * 100) : 0;
                      return (
                        <div key={kalem.id} className={`rounded-xl border overflow-hidden ${bilgi.gecikmisAdet > 0 ? 'border-red-300' : 'border-neutral-200'}`}>
                          {/* KREDİ BAŞLIĞI — tıklayınca taksit planı açılır */}
                          <div className={`p-3 flex items-center gap-3 cursor-pointer transition ${bilgi.gecikmisAdet > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-neutral-50 hover:bg-neutral-100'}`}
                            onClick={() => setAcikKrediKalemi(acik ? null : kalem.id)}>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-black text-sm truncate flex items-center gap-2">
                                {bilgi.ad}
                                {kalem.id === '__eski__' && <span className="text-[9px] font-black bg-neutral-300 text-neutral-700 px-1.5 py-0.5 rounded-full shrink-0">ESKİ KAYIT</span>}
                                {bilgi.gecikmisAdet > 0 && <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full shrink-0">{bilgi.gecikmisAdet} GECİKMİŞ</span>}
                              </div>
                              <div className="text-[11px] font-bold text-neutral-500">
                                {bilgi.bankaAdi ? `${bilgi.bankaAdi} • ` : ''}₺{paraFmt(bilgi.aylikTaksit)} × {bilgi.taksitSayisi} ay • {bilgi.odenenAdet}/{bilgi.taksitSayisi} ödendi
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden flex-1 max-w-[140px]">
                                  <div className="h-full bg-violet-500" style={{ width: `${yuzde}%` }}></div>
                                </div>
                                <span className={`text-[11px] font-black ${bilgi.kalanBorc > 0 ? 'text-violet-700' : 'text-emerald-700'}`}>
                                  {bilgi.kalanBorc > 0 ? `₺${paraFmt(bilgi.kalanBorc)} kaldı` : 'Kapandı ✓'}
                                </span>
                              </div>
                              {bilgi.siradaki && (
                                <div className={`text-[11px] font-bold mt-0.5 ${bilgi.siradaki.gecikmis ? 'text-red-600' : 'text-violet-700'}`}>
                                  Sıradaki: {bilgi.siradaki.no}. taksit — {bilgi.siradaki.tarih.split('-').reverse().join('.')}
                                  {bilgi.siradaki.gecikmis && ' (gecikmiş)'}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {bilgi.siradaki && (
                                <button type="button"
                                  onClick={e => { e.stopPropagation(); setTaksitOdeme({ kalem, taksit: bilgi.siradaki, kaynakDefterId: '', tarih: bugunStr(), tutar: String(bilgi.siradaki.kalan ?? bilgi.siradaki.tutar) }); }}
                                  className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black rounded-lg transition">
                                  Öde
                                </button>
                              )}
                              <button type="button" onClick={e => { e.stopPropagation(); setKrediKalemForm({ ...bosKrediKalemi, ...kalem }); }}
                                className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {/* YENİ (kullanıcı talebi): Ödeme yapılmış bir krediyi
                                  silmeden önce ek uyarı. Ödemeler defterindeki Sil
                                  ile aynı davranış — planı kaldırır, geçmiş taksit
                                  ödemeleri defterde kalır. */}
                              <button type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (bilgi.odenenAdet > 0 &&
                                      !window.confirm(`"${bilgi.ad}" kredisine daha önce ${bilgi.odenenAdet} taksit ödemesi yapılmış (toplam ₺${paraFmt(bilgi.odenenTutar)}).\n\nPlanı silerseniz bu ödemeler defterde KALIR ama hangi krediye ait oldukları listede görünmez.\n\nYine de silmek istiyor musunuz?`)) return;
                                  krediKalemiSil(kalem.id);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Krediyi kaldır">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <ChevronDown className={`w-4 h-4 text-neutral-400 transition ${acik ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {/* TAKSİT PLANI */}
                          {acik && (
                            <div className="p-3 bg-white border-t border-neutral-200">
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="bg-neutral-50 rounded-lg p-2 border border-neutral-200 text-center">
                                  <div className="text-[9px] font-black uppercase text-neutral-500">Ana Para</div>
                                  <div className="text-xs font-black text-black">₺{paraFmt(bilgi.anaPara)}</div>
                                </div>
                                <div className="bg-neutral-50 rounded-lg p-2 border border-neutral-200 text-center">
                                  <div className="text-[9px] font-black uppercase text-neutral-500">Toplam</div>
                                  <div className="text-xs font-black text-black">₺{paraFmt(bilgi.toplamGeriOdeme)}</div>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 text-center">
                                  <div className="text-[9px] font-black uppercase text-amber-600">Faiz</div>
                                  <div className="text-xs font-black text-amber-700">₺{paraFmt(bilgi.toplamFaiz)}</div>
                                </div>
                              </div>
                              {kalem.not && <p className="text-[11px] font-medium text-neutral-500 mb-2 italic">{kalem.not}</p>}
                              <div className="max-h-64 overflow-y-auto space-y-1">
                                {bilgi.plan.map(t => (
                                  <div key={t.no} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                                    t.odendi ? 'bg-emerald-50 border-emerald-200'
                                    : t.gecikmis ? 'bg-red-50 border-red-200'
                                    : t.kismi ? 'bg-sky-50 border-sky-200'
                                    : 'bg-white border-neutral-200'}`}>
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                                      t.odendi ? 'bg-emerald-600 text-white' : t.gecikmis ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                                      {t.no}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      {/* KISMİ ÖDEME: ödenmemişse KALAN tutar gösterilir */}
                                      <div className="font-black text-black">₺{paraFmt(t.odendi ? t.tutar : (t.kalan ?? t.tutar))}</div>
                                      <div className={`text-[10px] font-bold ${t.gecikmis ? 'text-red-600' : 'text-neutral-500'}`}>
                                        Vade: {t.tarih.split('-').reverse().join('.')}
                                        {t.odendi && t.odemeTarihi ? ` • Ödendi: ${t.odemeTarihi.split('-').reverse().join('.')}` : t.gecikmis ? ' • GECİKMİŞ' : ''}
                                        {t.kismi && <span className="ml-1 text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full">KISMİ • ₺{paraFmt(t.odenenTutar)} ödendi</span>}
                                      </div>
                                    </div>
                                    {t.odendi ? (
                                      <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1 shrink-0"><CheckCircle className="w-3.5 h-3.5" /> ÖDENDİ</span>
                                    ) : (
                                      <button type="button"
                                        onClick={() => setTaksitOdeme({ kalem, taksit: t, kaynakDefterId: '', tarih: bugunStr(), tutar: String(t.kalan ?? t.tutar) })}
                                        className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black rounded-lg transition shrink-0">
                                        Öde
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {bilgi.plan.length === 0 && (
                                  <p className="text-xs font-bold text-neutral-400 text-center py-4">
                                    Taksit planı üretilemedi. Krediyi düzenleyip taksit sayısı ve ilk taksit tarihini kontrol edin.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ==================================================================
            YENİ: ÖDEMELER PANELİ — tür "Ödemeler" olan defterlerde görünür
            Her ödeme kalemi (kira, sigorta, vergi...) ayrı bir kart olur.
            Kartta sıradaki vade, ilerleme ve gecikme bilgisi durur; açılınca
            tüm vade listesi ve tek tek "Öde" düğmeleri görünür.
            ================================================================== */}
        {seciliDefter.tur === 'Ödemeler' && (() => {
          const od = odemeDefterBilgi(seciliDefter);
          return (
            <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
              <div className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black flex items-center gap-2 text-sm">
                  <CalendarDays className="w-4 h-4" /> Ödeme Planları
                  <span className="text-[10px] font-bold text-white/70">{od.kalemSayisi} kalem</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* YENİ: Otomatik ödemeleri durdurma / tutar güncelleme penceresi */}
                  <button type="button" onClick={() => setOtomatikYonetim(true)}
                    className="px-3 py-1.5 bg-orange-800 text-white text-[11px] font-black rounded-lg hover:bg-orange-900 transition flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" /> Otomatik Ödemeler
                  </button>
                  <button type="button"
                    onClick={() => setOdemeKalemForm({ ...bosOdemeKalemi })}
                    className="px-3 py-1.5 bg-white text-orange-700 text-[11px] font-black rounded-lg hover:bg-orange-50 transition flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> Yeni Ödeme
                  </button>
                </div>
              </div>

              {/* ÜST ÖZET: bu ay toplam + bu ay kalan + gecikmiş
                  DEĞİŞTİ (kullanıcı talebi): Rakamlara MAAŞ ve AVANS satırları
                  da dahil edildi (aşağıdaki aylık listede görünen her şey).
                  Böylece bu özet, defter anasayfasındaki ÖDEMELER kartıyla
                  birebir aynı toplamı gösterir. */}
              {(() => {
                const ekSatirlar = [...maasSatirlari, ...avansSatirlari];
                const ekToplam = ekSatirlar.reduce((t, s) => t + (parseFloat(s.tutar) || 0), 0);
                const ekOdenen = ekSatirlar.filter(s => s.odendi).reduce((t, s) => t + (parseFloat(s.tutar) || 0), 0);
                const ozetToplam = od.buAyToplam + ekToplam;
                const ozetOdenen = od.buAyOdenen + ekOdenen;
                const ozetKalan = od.buAyBekleyen + (ekToplam - ekOdenen);
                const ozetAdet = od.buAyAdet + ekSatirlar.length;
                const ozetOdenenAdet = od.buAyOdenenAdet + ekSatirlar.filter(s => s.odendi).length;
                return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 pb-0">
                <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200">
                  <div className="text-[9px] font-black uppercase text-neutral-500">Bu Ay Toplam</div>
                  <div className="text-sm font-black text-neutral-800">₺{paraFmt(ozetToplam)}</div>
                  <div className="text-[9px] font-bold text-emerald-600 mt-0.5">
                    Ödenen: ₺{paraFmt(ozetOdenen)}{ozetAdet > 0 ? ` • ${ozetOdenenAdet}/${ozetAdet}` : ''}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-xl p-2.5 border border-orange-200">
                  <div className="text-[9px] font-black uppercase text-orange-600">Bu Ay Kalan</div>
                  <div className="text-sm font-black text-orange-700">₺{paraFmt(ozetKalan)}</div>
                </div>
                <div className={`rounded-xl p-2.5 border ${od.gecikmisAdet > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className={`text-[9px] font-black uppercase ${od.gecikmisAdet > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Gecikmiş</div>
                  <div className={`text-sm font-black ${od.gecikmisAdet > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {od.gecikmisAdet > 0 ? `₺${paraFmt(od.gecikmisTutar)} • ${od.gecikmisAdet} ödeme` : 'Yok'}
                  </div>
                </div>
              </div>
                );
              })()}

              {/* ==============================================================
                  YENİ (kullanıcı talebi): KALICI KİRA ZAM UYARISI
                  ==============================================================
                  Hangi ay görüntülenirse görüntülensin, 12 ayı (24., 36. ...)
                  DOLMUŞ ama henüz ZAM GİRİLMEMİŞ her kira burada listelenir.
                  İlk ödeme tarihi = kiralama tarihi kabul edilir; yıl dönümü
                  hep o tarihe göre sayılır (sonradan eklenen kiralar dahil,
                  devirden ödenmiş sayılan geçmiş aylar da hesaba katılır).
                  Uyarı, o kiraya zam girilene (veya kira sonlandırılana) kadar
                  KAYBOLMAZ; zam girildiği an kendiliğinden söner. */}
              {(() => {
                const bugun = bugunStr();
                // DÜZELTME: trh bu kapsamda tanımlı değildi ("trh is not defined"
                // hatasıyla Ödemeler sayfası çöküyordu). Diğer bloklardaki
                // tanımlar kendi kapsamlarında kaldığı için burada yerel olarak
                // tanımlanır: YYYY-AA-GG -> GG.AA.YYYY
                const trh = (t) => t?.split('-').reverse().join('.');
                const zamBekleyenler = [];
                od.detaylar.forEach(({ kalem, bilgi }) => {
                  if (kalem.odemeTuru !== 'kira' || kalem.bitisTarihi) return;
                  // DEĞİŞTİ (kullanıcı talebi): 1 Eylül 2026 (sistem devri)
                  // ÖNCESİNE düşen yıl dönümleri için uyarı ÇIKARILMAZ — o
                  // dönemin zamları eski düzende zaten yapılmış kabul edilir.
                  // Yalnızca devir tarihi ve SONRASINA düşen, vadesi geçmiş
                  // yıl dönümleri hatırlatılır.
                  const gecmisYilSonlari = bilgi.plan.filter(p => p.yilSonu && p.tarih >= SISTEM_DEVIR_TARIHI && p.tarih <= bugun);
                  if (gecmisYilSonlari.length === 0) return;
                  const sonYilSonu = gecmisYilSonlari[gecmisYilSonlari.length - 1];
                  const sonraki = bilgi.plan.find(p => p.no === sonYilSonu.no + 1);
                  // Sonraki vade yoksa veya tutarı değiştiyse zam zaten girilmiş demektir
                  if (!sonraki || Math.abs(sonraki.tutar - sonYilSonu.tutar) > 0.01) return;
                  zamBekleyenler.push({ kalem, sonYilSonu, sonraki });
                });
                if (zamBekleyenler.length === 0) return null;
                return (
                  <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
                    <div className="px-3 py-2 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 animate-pulse" />
                      <span className="text-[11px] font-black text-amber-800 uppercase">Zam Bekleyen Kiralar ({zamBekleyenler.length})</span>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {zamBekleyenler.map(({ kalem, sonYilSonu, sonraki }) => (
                        <div key={kalem.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200 flex-wrap">
                          <div className="flex-1 min-w-0 text-[11px] font-bold text-amber-900">
                            <b>{kalem.ad}</b> — {sonYilSonu.yilNo}. yıl {trh(sonYilSonu.tarih)}'de doldu, hâlâ zam girilmedi.
                            Güncel tutar ₺{paraFmt(sonYilSonu.tutar)} ödenmeye devam ediyor.
                          </div>
                          <button type="button"
                            onClick={() => { setOtomatikYonetim(true); setYonetimForm({ kalemId: kalem.id, mod: 'zam', tarih: sonraki.tarih >= bugun ? sonraki.tarih : bugun, tutar: String(sonYilSonu.tutar) }); }}
                            className="shrink-0 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded-lg transition">
                            Tutarı Güncelle
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="p-4 space-y-3">
                {od.detaylar.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-neutral-300 rounded-xl">
                    <CalendarDays className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-neutral-400">Henüz ödeme planı yok.</p>
                    <p className="text-[11px] font-medium text-neutral-400 mt-1">"Yeni Ödeme" ile kira, sigorta, vergi gibi düzenli giderlerinizi ekleyin.</p>
                  </div>
                )}

                {/* ==============================================================
                    YENİ: AYLIK ÖDEME GÖRÜNÜMÜ (kullanıcı talebi)
                    ==============================================================
                    "Ağustos 2026 Ödemeleri" başlığı ve sağ/sol oklarla ay
                    gezilir. O aya vadesi düşen HER kalem (tekrarlananlar
                    dahil) kendi gününde listelenir; en yakın tarih en üstte.
                    Ödenenler en alttaki "Ödenenler" bölümüne iner. Vadeye
                    7 gün ve daha az kalanlarda yanıp sönen uyarı çıkar.
                    Otomatik MAAŞ satırları (mavi + beyaz, her ayın 6'sı,
                    tutar Muhasebe'den canlı) bu listenin doğal parçasıdır.
                    ============================================================== */}
                {(() => {
                  const { bekleyen, odenen } = ayinVadeleri(seciliDefter);
                  const [oy, om] = odemeAyi.split('-').map(Number);
                  const ayBaslik = `${AY_ADLARI[om - 1]} ${oy}`;
                  const ayDegistir = (yon) => {
                    const d = new Date(oy, om - 1 + yon, 1);
                    setOdemeAyi(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  };
                  const bekleyenMaaslar = maasSatirlari.filter(m => !m.odendi);
                  const odenenMaaslar = maasSatirlari.filter(m => m.odendi);
                  // YENİ (kullanıcı talebi): iki AVANS satırı (nakit + resmi),
                  // her ayın 20'si vadeli — tutar 0 olsa da hep görünür.
                  const bekleyenAvanslar = avansSatirlari.filter(a => !a.odendi);
                  const odenenAvanslar = avansSatirlari.filter(a => a.odendi);
                  // Maaşlar + avanslar + kalem vadeleri tek sırada: tarihe göre en yakın üstte
                  const bekleyenBirlesik = [
                    ...bekleyen.map(x => ({ tip: 'vade', tarih: x.vade.tarih, x })),
                    ...bekleyenMaaslar.map(m => ({ tip: 'maas', tarih: m.vadeTarihi, m })),
                    ...bekleyenAvanslar.map(a => ({ tip: 'avans', tarih: a.vadeTarihi, a })),
                  ].sort((a, b) => a.tarih.localeCompare(b.tarih));
                  const trh = (t) => t?.split('-').reverse().join('.');
                  return (
                    <div className="mb-3">
                      {/* AY GEZGİNİ */}
                      <div className="flex items-center justify-between gap-2 bg-neutral-900 text-white rounded-xl px-2 py-2 mb-2">
                        <button type="button" onClick={() => ayDegistir(-1)} className="p-2 hover:bg-white/10 rounded-lg transition"><ChevronLeft className="w-5 h-5" /></button>
                        <div className="text-center">
                          <div className="font-black text-base">{ayBaslik} Ödemeleri</div>
                          <div className="text-[10px] font-bold text-white/60">{bekleyenBirlesik.length} bekleyen • {odenen.length + odenenMaaslar.length + odenenAvanslar.length} ödenen</div>
                        </div>
                        <button type="button" onClick={() => ayDegistir(1)} className="p-2 hover:bg-white/10 rounded-lg transition"><ChevronRight className="w-5 h-5" /></button>
                      </div>

                      {/* BEKLEYENLER — en yakın vade üstte */}
                      <div className="space-y-1.5">
                        {bekleyenBirlesik.length === 0 && (
                          <div className="p-4 text-center text-xs font-bold text-neutral-400 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">Bu ay bekleyen ödeme yok.</div>
                        )}
                        {bekleyenBirlesik.map((satir, i) => {
                          // ==========================================================
                          // YENİ (kullanıcı talebi): AVANS SATIRI — amber renkli.
                          // Tıklayınca kişi bazlı avanslar açılır; "Avans Gir" toplu
                          // pencereyi, "Öde" varsayılan hesapla ödeme penceresini açar.
                          // ==========================================================
                          if (satir.tip === 'avans') {
                            const a = satir.a;
                            const acikA = acikAvansSatiri === a.id;
                            const avansliKisiler = a.kisiler.filter(k => k.tutar > 0);
                            return (
                              <div key={a.id} className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
                                <div className="flex items-center gap-2 p-2.5 flex-wrap cursor-pointer hover:bg-amber-100/60 transition"
                                  onClick={() => setAcikAvansSatiri(acikA ? null : a.id)}>
                                  <Banknote className="w-4 h-4 text-amber-700 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-sm text-neutral-800 flex items-center gap-2 flex-wrap">
                                      {a.ad}
                                      <span className="text-[8px] font-black bg-amber-600 text-white px-1.5 py-0.5 rounded-full">OTOMATİK • MUHASEBEDEN</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-neutral-500">
                                      {a.kaynakEtiket} • Vade: {trh(a.vadeTarihi)} • {avansliKisiler.length} personel
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className={`font-black tabular-nums ${a.tutar > 0 ? 'text-amber-700' : 'text-neutral-400'}`}>₺{paraFmt(a.tutar)}</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); avansTopluAc(a.kanal, a.yaka); }}
                                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition">Avans Gir</button>
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); if (!(a.tutar > 0)) { alert('Bu ay girilmiş avans yok (₺0). Önce "Avans Gir" ile avans yazın.'); return; } setAvansOdeModal({ satir: a, kaynakDefterId: avansVarsayilanKaynak(a.kanal), tarih: bugunStr() }); }}
                                      className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${a.tutar > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}>Öde</button>
                                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition ${acikA ? 'rotate-180' : ''}`} />
                                  </div>
                                </div>
                                {acikA && (
                                  <div className="border-t border-amber-200 bg-white p-2 max-h-56 overflow-y-auto space-y-1">
                                    {avansliKisiler.length === 0 && (
                                      <p className="text-[11px] font-bold text-neutral-400 text-center py-3">Bu ay bu kanaldan avans girilmemiş. "Avans Gir" ile ekleyin.</p>
                                    )}
                                    {avansliKisiler.map(k => (
                                      <div key={k.person.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50/60 border border-amber-100">
                                        <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded-full shrink-0 ${k.yaka === 'beyaz' ? 'bg-neutral-500' : 'bg-blue-600'}`}>{k.yaka === 'beyaz' ? 'BEYAZ' : 'MAVİ'}</span>
                                        <span className="flex-1 min-w-0 text-xs font-bold text-neutral-700 truncate">{k.person.fullName || k.person.name}</span>
                                        <span className="text-xs font-black tabular-nums text-amber-700 shrink-0">₺{paraFmt(k.tutar)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (satir.tip === 'maas') {
                            const m = satir.m;
                            const acikM = acikMaasSatiri === m.id;
                            return (
                              <div key={m.id} className="rounded-xl border border-purple-300 bg-purple-50 overflow-hidden">
                                <div className="flex items-center gap-2 p-2.5 cursor-pointer" onClick={() => setAcikMaasSatiri(acikM ? null : m.id)}>
                                  {vadeYaklasti(m.vadeTarihi) && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" title="Vadeye 1 haftadan az kaldı"></span>}
                                  <Users className="w-4 h-4 text-purple-600 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-sm text-purple-900 flex items-center gap-1.5 flex-wrap">
                                      {m.ad}
                                      <span className="text-[9px] font-black bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">OTOMATİK • MUHASEBEDEN</span>
                                    </div>
                                    {/* DEĞİŞTİ: satır artık tek kanala ait — alt yazı ona göre */}
                                    <div className="text-[10px] font-bold text-purple-600">{m.kaynakEtiket} • Vade: {trh(m.vadeTarihi)} • {m.kisiler.length} personel • kalan {m.kanal === 'banka' ? 'banka' : m.kanal === 'nakit' ? 'nakit' : 'banka+nakit'} toplamı</div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-black text-purple-800 tabular-nums">₺{paraFmt(m.tutar)}</div>
                                    {vadeYaklasti(m.vadeTarihi) && <div className="text-[9px] font-black text-red-600 animate-pulse">YAKLAŞIYOR</div>}
                                  </div>
                                  <button type="button" onClick={e => { e.stopPropagation(); setMaasOdeModal({ satir: m, kaynakDefterId: '' }); }}
                                    className="shrink-0 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-lg transition">Öde</button>
                                </div>
                                {/* Personel açılımı: tıklayınca herkesin kalanı alt alta */}
                                {acikM && (
                                  <div className="border-t border-purple-200 bg-white divide-y divide-neutral-100">
                                    {m.kisiler.map(k => (
                                      <div key={k.person.id} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs ${k.bekleyen <= 0.01 ? 'opacity-50' : ''}`}>
                                        <span className="font-bold text-neutral-700 truncate flex items-center gap-1.5">
                                          {k.person.fullName}
                                          {/* YENİ (kullanıcı talebi): kısmi ödeme yapılmış kişi rozetlenir */}
                                          {k.bekleyen > 0.01 && (k.kismiOdenen || 0) > 0.01 && (
                                            <span className="text-[8px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full shrink-0">KISMİ • ₺{paraFmt(k.kismiOdenen)} alındı</span>
                                          )}
                                        </span>
                                        <span className="font-black tabular-nums text-purple-800 shrink-0">
                                          {k.bekleyen <= 0.01 ? 'Ödendi ✓' : `₺${paraFmt(k.bekleyen)}`}
                                          {/* DEĞİŞTİ: satır tek kanala ait olduğundan yalnızca o kanalın
                                              ayrıntısı gösterilir; kanalsız eski satırda ikisi de çıkar */}
                                          <span className="text-[9px] font-bold text-neutral-400 ml-1">
                                            ({m.kanal !== 'nakit' && <>B: {k.bankaOdendi ? '✓' : paraFmt(Math.max(0, k.bankaKalan))}</>}{!m.kanal && ' • '}{m.kanal !== 'banka' && <>N: {k.nakitOdendi ? '✓' : paraFmt(Math.max(0, k.kalanNakit))}</>})
                                          </span>
                                        </span>
                                        {/* YENİ (kullanıcı talebi): KİŞİ BAZLI ÖDEME
                                            Personelin yanındaki "Öde" butonu, aynı ödeme
                                            penceresini yalnızca O KİŞİ için açar. Sentetik
                                            tek kişilik bir satır üretilir; kalem kimliğine
                                            personel id'si eklenir ki bu ödeme tüm yakayı
                                            "ödendi" saymasın. Onaylanınca kaynak defterden
                                            çıkış + Ödemeler defterine mahsup giriş yazılır
                                            ve Personel Muhasebe ekranında o kişinin ilgili
                                            kanal tiki (banka veya nakit) atılır. */}
                                        {k.bekleyen > 0.01 && (
                                          <button type="button"
                                            onClick={() => setMaasOdeModal({
                                              satir: {
                                                ...m,
                                                id: `${m.id}_${k.person.id}`,
                                                ad: `${m.ad} — ${k.person.fullName}`,
                                                tutar: k.bekleyen,
                                                kisiler: [k],
                                              },
                                              kaynakDefterId: '',
                                            })}
                                            className="shrink-0 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-md transition">
                                            Öde
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          const { kalem, vade, tur } = satir.x;
                          return (
                            <div key={`${kalem.id}_${vade.no}`} className={`rounded-xl border overflow-hidden ${vade.gecikmis ? 'border-red-300 bg-red-50' : vade.yilSonu ? 'border-amber-300 bg-amber-50' : tur.yumusak}`}>
                            <div className="flex items-center gap-2 p-2.5">
                              {vadeYaklasti(vade.tarih) && !vade.gecikmis && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" title="Vadeye 1 haftadan az kaldı"></span>}
                              <tur.Ikon className={`w-4 h-4 shrink-0 ${tur.yazi}`} />
                              <div className="flex-1 min-w-0">
                                {/* DEĞİŞTİ: Başlıkta "Sıradaki / 3. ödeme" yerine AYIN ADI.
                                    Ağustos görünümünde "Ağustos Kirası" yazar; hangi ayın
                                    borcu olduğu tek bakışta anlaşılır. */}
                                <div className="font-black text-sm text-neutral-800 truncate">
                                  {kalem.ad} <span className="text-neutral-500 font-bold">— {AY_ADLARI[Number(vade.tarih.slice(5, 7)) - 1]} {tur.id === 'kira' ? 'Kirası' : 'Ödemesi'}</span>
                                </div>
                                <div className="text-[10px] font-bold text-neutral-500">
                                  Vade: {trh(vade.tarih)} • {tur.ad}
                                  {vade.gecikmis && <span className="ml-1 text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full">GECİKMİŞ</span>}
                                  {/* YENİ: 12. taksitte sözleşme yılı dolduğu rozeti */}
                                  {vade.yilSonu && <span className="ml-1 text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{vade.yilNo}. YIL SON ÖDEMESİ</span>}
                                  {/* YENİ: kısmi ödeme rozeti — ne kadarı ödenmiş */}
                                  {vade.kismi && <span className="ml-1 text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full">KISMİ ÖDENDİ • ₺{paraFmt(vade.odenenTutar)} yatırıldı</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {/* KISMİ ÖDEME: ekranda artık KALAN tutar gösterilir */}
                                <div className={`font-black tabular-nums ${vade.gecikmis ? 'text-red-700' : tur.yazi}`}>₺{paraFmt(vade.kalan ?? vade.tutar)}</div>
                                {vade.kismi && <div className="text-[9px] font-bold text-neutral-400 line-through">₺{paraFmt(vade.tutar)}</div>}
                                {vadeYaklasti(vade.tarih) && !vade.gecikmis && <div className="text-[9px] font-black text-red-600 animate-pulse">YAKLAŞIYOR</div>}
                              </div>
                              <button type="button" onClick={() => setVadeOdeme({ kalem, vade, kaynakDefterId: '', tarih: bugunStr(), tutar: String(vade.kalan ?? vade.tutar) })}
                                className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition">Öde</button>
                            </div>

                            {/* ==================================================
                                YENİ (kullanıcı talebi): KİRA YIL DOLUMU UYARISI
                                ==================================================
                                Kira sözleşmesinin 12. ayına gelindiğinde bu şerit
                                çıkar. "Tutarı Güncelle" düğmesi, Otomatik Ödemeler
                                penceresindeki zam formunu doğrudan bu kalem için
                                açar; geçerlilik tarihi bir sonraki vadeye ayarlanır,
                                böylece geçmiş aylar eski tutarında kalır. */}
                            {vade.yilSonu && !vade.gecikmis && (() => {
                              // Bir sonraki vadenin tarihi = zammın geçerli olacağı gün
                              const sonrakiTarih = (() => {
                                const [yy, mm, dd] = vade.tarih.split('-').map(Number);
                                const d = new Date(yy, mm, 1);
                                const sonGun = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                d.setDate(Math.min(dd, sonGun));
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                              })();
                              return (
                                <div className="px-2.5 pb-2.5 pt-0">
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-100 border border-amber-300 flex-wrap">
                                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                                    <div className="flex-1 min-w-0 text-[11px] font-bold text-amber-800">
                                      Bu ödemeyle <b>{vade.yilNo}. yıl doldu.</b> Gelecek ay ({trh(sonrakiTarih)}) itibarıyla zamlı tutar uygulayabilirsiniz.
                                    </div>
                                    <button type="button"
                                      onClick={() => { setOtomatikYonetim(true); setYonetimForm({ kalemId: kalem.id, mod: 'zam', tarih: sonrakiTarih, tutar: String(vade.tutar) }); }}
                                      className="shrink-0 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded-lg transition">
                                      Tutarı Güncelle
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                            </div>
                          );
                        })}
                      </div>

                      {/* ÖDENENLER — en altta ayrı bölüm */}
                      {(odenen.length > 0 || odenenMaaslar.length > 0 || odenenAvanslar.length > 0) && (
                        <div className="mt-3 border-t-2 border-dashed border-emerald-300 pt-2">
                          <div className="text-[10px] font-black text-emerald-700 uppercase mb-1.5 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Ödenenler ({odenen.length + odenenMaaslar.length})
                          </div>
                          <div className="space-y-1">
                            {/* YENİ: ödenen avans satırları */}
                            {odenenAvanslar.map(a => (
                              <div key={a.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 opacity-80">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="flex-1 text-xs font-bold text-emerald-900 truncate line-through">{a.ad} — {a.kaynakEtiket} (₺{paraFmt(a.tutar)})</span>
                                <span className="text-[10px] font-black text-emerald-700 shrink-0">{a.devir ? 'Devir (sistem öncesi)' : (a.odemeTarihi ? trh(a.odemeTarihi) : 'Ödendi')} ✓</span>
                              </div>
                            ))}
                            {odenenMaaslar.map(m => (
                              <div key={m.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 opacity-80">
                                <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="flex-1 text-xs font-bold text-emerald-900 truncate line-through">{m.ad} — {m.kaynakEtiket}</span>
                                <span className="text-[10px] font-black text-emerald-700 shrink-0">{m.devir ? 'Devir (sistem öncesi)' : (m.odemeTarihi ? trh(m.odemeTarihi) : 'Muhasebede kapatıldı')} ✓</span>
                              </div>
                            ))}
                            {odenen.map(({ kalem, vade }) => (
                              <div key={`${kalem.id}_${vade.no}`}>
                                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 opacity-80">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="flex-1 text-xs font-bold text-emerald-900 truncate line-through">{kalem.ad} — {AY_ADLARI[Number(vade.tarih.slice(5, 7)) - 1]} (₺{paraFmt(vade.tutar)})</span>
                                  {/* YENİ: Devirden gelen kayıtlar ayrı etiketlenir ki
                                      "bunu ben mi ödedim?" sorusu oluşmasın. */}
                                  <span className="text-[10px] font-black text-emerald-700 shrink-0">
                                    {vade.devir ? 'Devir (sistem öncesi) ✓' : `${trh(vade.odemeTarihi)} ✓`}
                                  </span>
                                </div>
                                {/* YENİ: Yıl dolumu uyarısı ÖDENDİKTEN SONRA DA görünür —
                                    asıl anlamı burada: yıl kapandı, sıradaki ay zamlı olacak.
                                    Zam zaten girilmişse (bir sonraki vadenin tutarı bu
                                    vadeden farklıysa) uyarı gösterilmez, iş tamamlanmıştır.
                                    DÜZELTME (devir): Sistem öncesi (devir) aylarda uyarı
                                    çıkmaz — o dönemin zamları eski düzende zaten yapıldı,
                                    geçmişe dönük "zam girin" uyarısı kafa karıştırırdı. */}
                                {vade.yilSonu && !vade.devir && (() => {
                                  const bilgi = odemeKalemBilgi(seciliDefter, kalem);
                                  const sonraki = bilgi.plan.find(p => p.no === vade.no + 1);
                                  if (!sonraki || Math.abs(sonraki.tutar - vade.tutar) > 0.01) return null; // zam girilmiş
                                  return (
                                    <div className="flex items-center gap-2 p-2 mt-1 rounded-lg bg-amber-100 border border-amber-300 flex-wrap">
                                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 animate-pulse" />
                                      <div className="flex-1 min-w-0 text-[11px] font-bold text-amber-800">
                                        <b>{kalem.ad}</b> için {vade.yilNo}. yıl doldu. Gelecek ay ({trh(sonraki.tarih)}) zamlı tutar uygulayabilirsiniz.
                                      </div>
                                      <button type="button"
                                        onClick={() => { setOtomatikYonetim(true); setYonetimForm({ kalemId: kalem.id, mod: 'zam', tarih: sonraki.tarih, tutar: String(vade.tutar) }); }}
                                        className="shrink-0 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded-lg transition">
                                        Tutarı Güncelle
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ==============================================================
                    KALDIRILDI (kullanıcı talebi): TÜRE GÖRE KALEM BLOKLARI
                    ==============================================================
                    Kalemler yukarıdaki AYLIK listede zaten görünüyor; ayrıca
                    türe göre renkli bloklar halinde tekrar listelenmesi aynı
                    ödemeyi iki kez göstermek oluyordu. Kalemlerin tam listesi
                    ve yönetimi artık "Otomatik Ödemeler" penceresinde.
                    Aşağıdaki "Ödeme Türü Özeti" korundu — o, kalem listesi
                    değil, türlerin toplam yükünü karşılaştıran bir özettir.
                    ============================================================== */}

                {/* ==========================================================
                    YENİ: TÜR BAZLI ÖZET (en altta)
                    Her ödeme türünün toplam yükünü bir arada gösterir:
                    bu ay bekleyen + gecikmiş. Üstteki bloklar tek tek
                    ayrıntı verirken burası "hangi kaleme ne kadar para
                    gidiyor" sorusunu tek bakışta yanıtlar.
                    ========================================================== */}
                {od.detaylar.length > 0 && (
                  <div className="mt-2 border-t-2 border-dashed border-neutral-300 pt-3">
                    <div className="text-[10px] font-black text-neutral-500 uppercase mb-2 flex items-center gap-1.5">
                      <BarChart className="w-3.5 h-3.5" /> Ödeme Türü Özeti
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {ODEME_TURLERI.map(tur => {
                        const turKalemleri = od.detaylar.filter(d => (d.kalem.odemeTuru || VARSAYILAN_ODEME_TURU) === tur.id);
                        const buAyBas = bugunStr().slice(0, 8) + '01';
                        const [yy, mm] = bugunStr().split('-').map(Number);
                        const buAyBit = `${yy}-${String(mm).padStart(2, '0')}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`;
                        const buAy = turKalemleri.reduce((t, d) =>
                          t + d.bilgi.plan.filter(p => !p.odendi && p.tarih >= buAyBas && p.tarih <= buAyBit).reduce((x, p) => x + p.tutar, 0), 0);
                        const gecikmisTutar = turKalemleri.reduce((t, d) => t + d.bilgi.gecikmisTutar, 0);
                        return (
                          <div key={tur.id} className={`rounded-xl p-2.5 border ${tur.yumusak}`}>
                            <div className={`text-[10px] font-black uppercase flex items-center gap-1.5 ${tur.yazi}`}>
                              <tur.Ikon className="w-3.5 h-3.5" /> {tur.ad}
                            </div>
                            <div className={`text-base font-black tabular-nums mt-0.5 ${tur.yazi}`}>₺{paraFmt(buAy)}</div>
                            <div className="text-[9px] font-bold text-neutral-500">
                              {turKalemleri.length} kalem • bu ay bekleyen
                            </div>
                            {gecikmisTutar > 0 && (
                              <div className="text-[9px] font-black text-red-600 mt-0.5">Gecikmiş: ₺{paraFmt(gecikmisTutar)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* DEĞİŞTİ (kullanıcı talebi): Ödemeler defterinde GÜN GÜN görünüm
            tamamen KALDIRILDI — orada aylık ödeme görünümü var; günlük
            gezinme, hareket filtreleri, işlem listesi ve kategori dağılımı
            yalnızca DİĞER defter türlerinde çizilir.
            YENİ (kullanıcı talebi): Aynı kural artık KREDİ defterinde de
            geçerli — Krediler sayfası Ödemeler ile aynı aylık mantığa
            geçtiği için günlük işlemler bölümü orada da gösterilmez. */}
        {/* ==================================================================
            YENİ (kullanıcı talebi): ALACAK TAKİBİ PANELİ (BORÇLU DEFTERİ)
            ==================================================================
            Borçlu defteri artık Ödemeler sayfası gibi çalışır ama yön terstir:
            firmanın ALACAKLARI takip edilir. Personel/Müşteri/Kurum türünde
            borçlular eklenir, istenirse taksitlendirilir; tahsilatta para
            seçilen hesaba girer ve ANCAK O ZAMAN ciroya eklenir. İcra takibi
            ve kısmi tahsilat desteklenir. */}
        {seciliDefter.tur === 'Borçlu' && (() => {
          const ad2 = alacakDefterBilgi(seciliDefter);
          const trh = (t) => t?.split('-').reverse().join('.');
          const [ky, km] = alacakAyi.split('-').map(Number);
          const ayBaslik = `${AY_ADLARI[km - 1]} ${ky}`;
          const ayDegistir = (yon) => {
            const d = new Date(ky, km - 1 + yon, 1);
            setAlacakAyi(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          };
          // Seçili aya düşen taksitler (tüm borçlulardan), güne göre sıralı
          const ayinTaksitleri = [];
          ad2.detaylar.forEach(({ kalem, bilgi }) => {
            bilgi.plan.forEach(t => { if (t.tarih.startsWith(alacakAyi)) ayinTaksitleri.push({ kalem, bilgi, t }); });
          });
          ayinTaksitleri.sort((a, b) => a.t.tarih.localeCompare(b.t.tarih));
          const bekleyenler = ayinTaksitleri.filter(x => !x.t.odendi);
          const tahsilEdilenler = ayinTaksitleri.filter(x => x.t.odendi);
          return (
            <div className="bg-white rounded-2xl border-2 border-rose-200 overflow-hidden">
              {/* BAŞLIK */}
              <div className="bg-rose-600 text-white px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black flex items-center gap-2 text-sm">
                  <UserMinus className="w-4 h-4" /> Alacak Takibi
                  <span className="text-[10px] font-bold text-white/70">{ad2.kalemSayisi} borçlu</span>
                  {ad2.icradaAdet > 0 && <span className="text-[10px] font-black bg-black/40 px-2 py-0.5 rounded-full">{ad2.icradaAdet} İCRADA</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setMevcutBorclularAcik(v => !v)}
                    className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition flex items-center gap-1.5 ${
                      mevcutBorclularAcik ? 'bg-white text-rose-700 hover:bg-rose-50' : 'bg-rose-800 text-white hover:bg-rose-900'}`}>
                    <ClipboardList className="w-3.5 h-3.5" /> {mevcutBorclularAcik ? 'Aylık Görünüm' : 'Mevcut Borçlular'}
                  </button>
                  <button type="button" onClick={() => setAlacakForm({ ...bosAlacakKalemi })}
                    className="px-3 py-1.5 bg-white text-rose-700 text-[11px] font-black rounded-lg hover:bg-rose-50 transition flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> Yeni Borçlu
                  </button>
                </div>
              </div>

              {/* BOŞ DURUM */}
              {ad2.kalemSayisi === 0 && (
                <div className="p-4">
                  <div className="text-center py-8 border border-dashed border-neutral-300 rounded-xl">
                    <UserMinus className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-neutral-400">Henüz borçlu eklenmemiş.</p>
                    <p className="text-[11px] font-medium text-neutral-400 mt-1">"Yeni Borçlu" ile Personel / Müşteri / Kurum alacaklarınızı tek tek tanımlayın; isterseniz taksitlendirin.</p>
                  </div>
                </div>
              )}

              {/* ÜST ÖZET */}
              {ad2.kalemSayisi > 0 && (
                <div className="grid grid-cols-3 gap-2 p-4 pb-0">
                  <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-200">
                    <div className="text-[9px] font-black uppercase text-rose-600">Kalan Alacak</div>
                    <div className="text-sm font-black text-rose-700">₺{paraFmt(ad2.kalanAlacak)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200">
                    <div className="text-[9px] font-black uppercase text-emerald-600">Tahsil Edilen</div>
                    <div className="text-sm font-black text-emerald-700">₺{paraFmt(ad2.toplamTahsil)}</div>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${ad2.gecikmisAdet > 0 ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className={`text-[9px] font-black uppercase ${ad2.gecikmisAdet > 0 ? 'text-red-600' : 'text-neutral-500'}`}>Gecikmiş</div>
                    <div className={`text-sm font-black ${ad2.gecikmisAdet > 0 ? 'text-red-700' : 'text-neutral-500'}`}>
                      {ad2.gecikmisAdet > 0 ? `₺${paraFmt(ad2.gecikmisTutar)}` : 'Yok'}
                    </div>
                  </div>
                </div>
              )}

              {/* GÖRÜNÜM 1: AYLIK TAHSİLATLAR */}
              {ad2.kalemSayisi > 0 && !mevcutBorclularAcik && (
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 bg-neutral-900 text-white rounded-xl px-2 py-2 mb-2">
                    <button type="button" onClick={() => ayDegistir(-1)} className="p-2 hover:bg-white/10 rounded-lg transition"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="text-center">
                      <div className="font-black text-base">{ayBaslik} Tahsilatları</div>
                      <div className="text-[10px] font-bold text-white/60">{bekleyenler.length} bekleyen • {tahsilEdilenler.length} tahsil edildi</div>
                    </div>
                    <button type="button" onClick={() => ayDegistir(1)} className="p-2 hover:bg-white/10 rounded-lg transition"><ChevronRight className="w-5 h-5" /></button>
                  </div>

                  <div className="space-y-1.5">
                    {bekleyenler.length === 0 && (
                      <div className="p-4 text-center text-xs font-bold text-neutral-400 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">Bu ay bekleyen tahsilat yok.</div>
                    )}
                    {bekleyenler.map(({ kalem, bilgi, t }) => {
                      const tr2 = alacakTuru(kalem.tur);
                      return (
                        /* ================================================================
                           DÜZELTİLDİ (kullanıcı talebi): MOBİLDE İSİM VE TUTAR KESİLİYORDU
                           ----------------------------------------------------------------
                           ESKİ DÜZEN: rozet + isim + tutar + 2 düğme HEPSİ tek satırdaydı.
                           Telefonda (~340px) rozet, tutar ve düğmeler sabit genişlik
                           kapladığı için ortadaki isim alanına neredeyse hiç yer kalmıyor,
                           "truncate" ile "Emir ...", "İSMAİ...", "ÇEK..." diye kesiliyordu.
                           YENİ DÜZEN: Mobilde satır İKİ KATA ayrılır —
                             1. kat: rozet + TAM isim (kesilmez, gerekirse alt satıra sarar)
                             2. kat: solda tutar, sağda "Tahsil Et" / "İcra" düğmeleri
                           sm ve üzeri ekranlarda (masaüstü) ESKİ TEK SATIR düzeni aynen
                           korunur; hiçbir veri veya davranış değişmedi, sadece yerleşim.
                           ================================================================ */
                        <div key={`${kalem.id}_${t.no}`} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl border ${t.gecikmis ? 'border-red-300 bg-red-50' : tr2.yumusak}`}>
                          {/* 1. KAT (mobil) / SOL BLOK (masaüstü): rozet + isim + vade */}
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${tr2.rozet}`}>{tr2.ad.toUpperCase()}</span>
                            <div className="flex-1 min-w-0">
                              {/* break-words: mobilde uzun isim kesilmek yerine alt satıra sarar */}
                              <div className="font-black text-sm text-neutral-800 break-words sm:truncate">
                                {kalem.ad}
                                {bilgi.adet > 1 && <span className="text-neutral-500 font-bold"> — {AY_ADLARI[Number(t.tarih.slice(5, 7)) - 1]} Taksiti ({t.no}/{bilgi.adet})</span>}
                              </div>
                              <div className="text-[10px] font-bold text-neutral-500 flex flex-wrap items-center gap-1 mt-0.5">
                                <span>Vade: {trh(t.tarih)}</span>
                                {t.gecikmis && <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full">GECİKMİŞ</span>}
                                {kalem.icra && <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5 rounded-full">İCRADA • {trh(kalem.icra)}</span>}
                                {t.kismi && <span className="text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full">KISMİ • ₺{paraFmt(t.odenenTutar)} alındı</span>}
                              </div>
                            </div>
                          </div>
                          {/* 2. KAT (mobil) / SAĞ BLOK (masaüstü): tutar + düğmeler */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                            <div className="text-left sm:text-right">
                              {/* whitespace-nowrap: tutar asla bölünmez/kesilmez */}
                              <div className={`font-black tabular-nums whitespace-nowrap ${t.gecikmis ? 'text-red-700' : tr2.yazi}`}>₺{paraFmt(t.kalan ?? t.tutar)}</div>
                              {t.kismi && <div className="text-[9px] font-bold text-neutral-400 line-through whitespace-nowrap">₺{paraFmt(t.tutar)}</div>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => setTahsilModal({ kalem, taksit: t, hedefDefterId: '', tarih: bugunStr(), tutar: String(t.kalan ?? t.tutar) })}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition whitespace-nowrap">Tahsil Et</button>
                              {!kalem.icra && (
                                <button type="button" onClick={() => alacakIcra(kalem.id, true)}
                                  title="Ödeme alınamazsa icra takibi başlat"
                                  className="px-2 py-1.5 bg-neutral-800 hover:bg-black text-white text-[10px] font-black rounded-lg transition">İcra</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* KALDIRILDI (kullanıcı talebi): "Tahsil Edilenler" listesi
                      artık gösterilmiyor — yalnızca tahsil edilemeyen (bekleyen)
                      borçlular görünür. Blok false ile kapatıldı; geri istenirse
                      false -> tahsilEdilenler.length > 0 yapmak yeterli. */}
                  {false && tahsilEdilenler.length > 0 && (
                    <div className="mt-3 border-t-2 border-dashed border-emerald-300 pt-2">
                      <div className="text-[10px] font-black text-emerald-700 uppercase mb-1.5 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Tahsil Edilenler ({tahsilEdilenler.length})
                      </div>
                      <div className="space-y-1">
                        {tahsilEdilenler.map(({ kalem, bilgi, t }) => (
                          <div key={`${kalem.id}_${t.no}`} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 opacity-80">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="flex-1 text-xs font-bold text-emerald-900 truncate line-through">
                              {kalem.ad}{bilgi.adet > 1 ? ` — ${t.no}/${bilgi.adet}` : ''} • ₺{paraFmt(t.tutar)}
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 shrink-0">{t.odemeTarihi ? trh(t.odemeTarihi) : 'Alındı'} ✓</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GÖRÜNÜM 2: MEVCUT BORÇLULAR */}
              {ad2.kalemSayisi > 0 && mevcutBorclularAcik && (
                <div className="p-4 space-y-3">
                  {ad2.detaylar.map(({ kalem, bilgi }) => {
                    const tr2 = alacakTuru(kalem.tur);
                    const acik = acikAlacakKalemi === kalem.id;
                    const yuzde = bilgi.toplam > 0 ? Math.round((bilgi.toplamTahsil / bilgi.toplam) * 100) : 0;
                    return (
                      <div key={kalem.id} className={`rounded-xl border-2 overflow-hidden ${kalem.icra ? 'border-neutral-800' : bilgi.gecikmisAdet > 0 ? 'border-red-300' : 'border-neutral-200'}`}>
                        {/* DÜZELTİLDİ (aynı mobil sorunu): düğme grubu mobilde
                            bilgi bloğunu daraltıyordu. Artık mobilde alt satıra
                            geçer, isim ve tutarlar tam genişlikte görünür.
                            sm ve üzerinde eski yan yana düzen korunur. */}
                        <div className={`p-3 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer transition ${bilgi.gecikmisAdet > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-neutral-50 hover:bg-neutral-100'}`}
                          onClick={() => setAcikAlacakKalemi(acik ? null : kalem.id)}>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-black text-sm flex items-center gap-2 flex-wrap break-words">
                              <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded-full ${tr2.rozet}`}>{tr2.ad.toUpperCase()}</span>
                              {kalem.ad}
                              {kalem.icra && <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5 rounded-full">İCRADA • {trh(kalem.icra)}</span>}
                              {bilgi.gecikmisAdet > 0 && <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full">{bilgi.gecikmisAdet} GECİKMİŞ</span>}
                            </div>
                            <div className="text-[11px] font-bold text-neutral-500 mt-0.5">
                              Toplam ₺{paraFmt(bilgi.toplam)} • {bilgi.adet > 1 ? `${bilgi.adet} taksit` : 'peşin'} • {bilgi.tahsilAdet}/{bilgi.adet} tahsil edildi
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden flex-1 max-w-[140px]">
                                <div className="h-full bg-emerald-500" style={{ width: `${yuzde}%` }}></div>
                              </div>
                              <span className={`text-[11px] font-black ${bilgi.kalanAlacak > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {bilgi.kalanAlacak > 0 ? `₺${paraFmt(bilgi.kalanAlacak)} kaldı` : 'Kapandı ✓'}
                              </span>
                            </div>
                            {kalem.not && <p className="text-[10px] font-medium text-neutral-400 italic mt-0.5">{kalem.not}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap sm:shrink-0">
                            {bilgi.siradaki && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setTahsilModal({ kalem, taksit: bilgi.siradaki, hedefDefterId: '', tarih: bugunStr(), tutar: String(bilgi.siradaki.kalan ?? bilgi.siradaki.tutar) }); }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition whitespace-nowrap">Tahsil Et</button>
                            )}
                            {/* YENİ (kullanıcı talebi): OTOMATİK borçlularda (personel
                                şirket borcu / tamamlanmış ödenmemiş müşteri işi)
                                Düzenle/Sil GİZLİ — kayıt kaynak veriden canlı gelir,
                                borç sıfırlanınca listeden kendiliğinden düşer. İcra
                                ve tahsilat yine yapılabilir. */}
                            {kalem.otomatik ? (
                              <span className="text-[9px] font-black bg-neutral-200 text-neutral-500 px-2 py-1 rounded-lg" title={kalem.kaynak === 'personel' ? 'Personel profilindeki şirket borcundan otomatik' : 'Tamamlanan iş cari bakiyesinden otomatik'}>OTOMATİK</span>
                            ) : (
                              <>
                                {!kalem.icra ? (
                                  <button type="button" onClick={e => { e.stopPropagation(); alacakIcra(kalem.id, true); }}
                                    className="px-2 py-1.5 bg-neutral-800 hover:bg-black text-white text-[10px] font-black rounded-lg transition">İcra</button>
                                ) : (
                                  <button type="button" onClick={e => { e.stopPropagation(); alacakIcra(kalem.id, false); }}
                                    className="px-2 py-1.5 bg-white border border-neutral-400 text-neutral-700 hover:bg-neutral-100 text-[10px] font-black rounded-lg transition">İcradan Çıkar</button>
                                )}
                                <button type="button" onClick={e => { e.stopPropagation(); setAlacakForm({ ...bosAlacakKalemi, ...kalem }); }}
                                  className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle"><Edit className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={e => { e.stopPropagation(); alacakSil(kalem.id); }}
                                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Borçluyu sil"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                            <ChevronDown className={`w-4 h-4 text-neutral-400 transition ${acik ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {acik && (
                          <div className="p-3 bg-white border-t border-neutral-200 max-h-64 overflow-y-auto space-y-1">
                            {bilgi.plan.map(t => (
                              <div key={t.no} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                                t.odendi ? 'bg-emerald-50 border-emerald-200' : t.gecikmis ? 'bg-red-50 border-red-200' : t.kismi ? 'bg-sky-50 border-sky-200' : 'bg-white border-neutral-200'}`}>
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  t.odendi ? 'bg-emerald-600 text-white' : t.gecikmis ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>{t.no}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-black text-black">₺{paraFmt(t.odendi ? t.tutar : (t.kalan ?? t.tutar))}</div>
                                  <div className={`text-[10px] font-bold ${t.gecikmis ? 'text-red-600' : 'text-neutral-500'}`}>
                                    Vade: {trh(t.tarih)}
                                    {t.odendi && t.odemeTarihi ? ` • Tahsil: ${trh(t.odemeTarihi)}` : t.gecikmis ? ' • GECİKMİŞ' : ''}
                                    {t.kismi && <span className="ml-1 text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full">KISMİ • ₺{paraFmt(t.odenenTutar)}</span>}
                                  </div>
                                </div>
                                {t.odendi ? (
                                  <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1 shrink-0"><CheckCircle className="w-3.5 h-3.5" /> TAHSİL EDİLDİ</span>
                                ) : (
                                  <button type="button" onClick={() => setTahsilModal({ kalem, taksit: t, hedefDefterId: '', tarih: bugunStr(), tutar: String(t.kalan ?? t.tutar) })}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition shrink-0">Tahsil Et</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {seciliDefter.tur !== 'Ödemeler' && seciliDefter.tur !== 'Kredi' && (<>
        {/* KALDIRILDI (kullanıcı talebi): AY ÖZETİ ŞERİDİ — aşağıdaki blok
            false ile kapatıldı; geri istenirse false -> true yapılır. */}
        {false && (() => { return null; })()}
        {false && (
        <div className="hidden">
        {/* ==================================================================
            ESKİ: AY ÖZETİ ŞERİDİ (mobil banka görünümü)
            ==================================================================
            Ekran görüntüsündeki "AĞUSTOS 2026  2.510.200  −1.993.411 = 516.788"
            şeridinin karşılığı: bakılan günün AYINA ait gelir, gider ve net,
            tek satırda. Virman/devir/mahsuplar ciroyaGirer ile dışlanır;
            canlı dönemde 1 Eylül öncesi zaten hesaba katılmaz. */}
        {(() => {
          const ayOn = (gunFiltreAktif ? seciliGun : bugunStr()).slice(0, 7);
          const [oy, oa] = ayOn.split('-').map(Number);
          const ayIsimleri = ['OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN','TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK'];
          const ayIslemler = defterIslemleri(seciliDefterId).filter(i => (i.tarih || '').startsWith(ayOn) && hesabaKatilir(i) && ciroyaGirer(i));
          const ayGelir = ayIslemler.filter(i => i.tip === 'giris').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
          const ayGider = ayIslemler.filter(i => i.tip === 'cikis').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
          const ayNet = ayGelir - ayGider;
          return (
            <div className="bg-neutral-900 text-white rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-black tracking-wide text-white/70">{ayIsimleri[oa - 1]} {oy}</span>
              <span className="flex items-center gap-2 text-[13px] font-black tabular-nums flex-wrap">
                <span className="text-emerald-400">{paraFmt(ayGelir)}</span>
                <span className="text-red-400">−{paraFmt(ayGider)}</span>
                <span className="text-white/50">=</span>
                <span className={ayNet >= 0 ? 'text-white' : 'text-red-300'}>{paraFmt(ayNet)}</span>
              </span>
            </div>
          );
        })()}

        </div>
        )}

        {/* ==================================================================
            YENİ (kullanıcı talebi): YAKLAŞAN İŞLEMLER AKORDEONU
            ==================================================================
            Ekran görüntüsündeki "Yaklaşan İşlemler (4)" bölümünün karşılığı:
            bu bloktaki (Sembol Nakliyat / Depoevim) Ödemeler ve Kredi
            defterlerinin önümüzdeki 30 güne düşen bekleyen vadeleri, güne
            göre sıralı, en fazla 8 satır. Satıra dokununca ilgili defter
            açılır ve ödeme oradan yapılır. */}
        {(() => {
          const bugun = bugunStr();
          const [by2, ba2, bg2] = bugun.split('-').map(Number);
          const d30 = new Date(by2, ba2 - 1, bg2 + 30);
          const sinir = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
          const yaklasanlar = [];
          defterler.filter(d => d.blok === seciliDefter.blok && (d.tur === 'Ödemeler' || d.tur === 'Kredi')).forEach(d => {
            if (d.tur === 'Ödemeler') {
              odemeDefterBilgi(d).detaylar.forEach(({ kalem, bilgi }) => {
                bilgi.plan.forEach(v => {
                  if (!v.odendi && v.tarih >= bugun && v.tarih <= sinir)
                    yaklasanlar.push({ defterId: d.id, ad: kalem.ad, tarih: v.tarih, tutar: v.kalan ?? v.tutar, tip: 'Ödeme' });
                });
              });
            } else {
              krediDefterBilgi(d).detaylar.forEach(({ bilgi }) => {
                bilgi.plan.forEach(t => {
                  if (!t.odendi && t.tarih >= bugun && t.tarih <= sinir)
                    yaklasanlar.push({ defterId: d.id, ad: `${bilgi.ad} (${t.no}. taksit)`, tarih: t.tarih, tutar: t.kalan ?? t.tutar, tip: 'Kredi' });
                });
              });
            }
          });
          yaklasanlar.sort((a, b) => a.tarih.localeCompare(b.tarih));
          const liste = yaklasanlar.slice(0, 8);
          if (yaklasanlar.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <button type="button" onClick={() => setYaklasanAcik(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-neutral-50 transition">
                <span className="flex items-center gap-2 text-xs font-black text-neutral-700">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  Yaklaşan İşlemler
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">{yaklasanlar.length}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition ${yaklasanAcik ? 'rotate-180' : ''}`} />
              </button>
              {yaklasanAcik && (
                <div className="border-t border-neutral-100 divide-y divide-neutral-100">
                  {liste.map((y, i) => (
                    <button key={i} type="button" onClick={() => {
                      // Aynı kural (kullanıcı talebi): Nakit/Banka/Kredi Kartı
                      // defterleri "Tüm Zamanlar" ile açılır, diğerleri bugün
                      // seçili. 'Kasa' Nakit'in eski (geriye uyumlu) adıdır.
                      const hedef = defterler.find(x => x.id === y.defterId);
                      setSeciliDefterId(y.defterId);
                      setSeciliGun(bugunStr());
                      setGunFiltreAktif(!(hedef?.tur === 'Nakit' || hedef?.tur === 'Kasa' || hedef?.tur === 'Banka' || hedef?.tur === 'Kredi Kartı'));
                    }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 transition">
                      <span className="text-[9px] font-black text-red-600 uppercase shrink-0 w-10">Gider</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-black text-neutral-800 truncate">{y.ad}</span>
                        <span className="block text-[10px] font-bold text-neutral-400">{y.tarih.split('-').reverse().join('.')} • {y.tip}</span>
                      </span>
                      <span className="shrink-0 text-sm font-black tabular-nums text-red-600">−{paraFmt(y.tutar)}</span>
                    </button>
                  ))}
                  {yaklasanlar.length > liste.length && (
                    <div className="px-3 py-2 text-[10px] font-bold text-neutral-400 text-center">+ {yaklasanlar.length - liste.length} işlem daha (Ödemeler defterinde)</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAŞINDI (kullanıcı talebi): Gün gezinme çubuğu, hareket
            filtreleri, günün gelir/gider/net tablosu ve işlem araması
            SAYFANIN EN ALTINA alındı — önce hareketler görünsün. */}


        {/* İŞLEM LİSTESİ — tarih + açıklama + etiketler | sağda renkli tutar */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-neutral-900 text-white text-[10px] font-black uppercase">
            <span>İşlem</span><span className="hidden sm:block text-right w-24 sm:w-28">Gelir</span><span className="hidden sm:block text-right w-24 sm:w-28">Gider</span>
          </div>
          {/* DEĞİŞİKLİK: Boş liste mesajı artık hangi modda olduğumuzu söylüyor.
              Günlük moddayken "kayıt yok" demek yanıltıcı olurdu; kullanıcı
              defterin tamamen boş olduğunu sanabilir. */}
          {dIslemler.length === 0 && (
            <div className="p-8 text-center text-sm font-bold text-neutral-400">
              {/* DEĞİŞTİ: Mesaj artık hareket türü filtresini de dikkate alır.
                  "Gelir" sekmesindeyken "hareket yok" demek yanıltıcı olurdu —
                  o gün gider olabilir ama gelir olmayabilir. */}
              {hareketFiltre !== 'tumu'
                ? `Bu ${gunFiltreAktif ? 'günde' : 'defterde'} ${hareketFiltre === 'giris' ? 'gelir' : hareketFiltre === 'cikis' ? 'gider' : hareketFiltre === 'silinen' ? 'silinmiş' : 'transfer'} kaydı yok. "Tümü" sekmesine bakabilirsiniz.`
                : gunFiltreAktif
                  ? `${gunEtiketi(seciliGun)} tarihinde hareket yok. Oklarla başka bir güne geçin veya "Tüm Zamanlar"a bakın.`
                  : 'Kayıt bulunamadı. Alttaki butonlarla ilk işlemi ekleyin.'}
            </div>
          )}
          {/* ==============================================================
              YENİ: ÖDEMESİ BEKLENEN İŞLER — soluk ön izleme kartları
              Gerçek kayıtların ÜSTÜNDE dururlar (iş sonlanmadıkça hep en
              üstte). Kesikli çerçeve + düşük opaklık: paranın henüz
              GELMEDİĞİNİ tek bakışta anlatır. İş kapatıldığında kayıt,
              seçilen ödeme yöntemine göre ilgili deftere gerçek satır olarak
              düşer ve buradaki soluk kart kendiliğinden kaybolur.
              ============================================================== */}
          {bekleyenIsler.length > 0 && (
            <div className="border-b border-amber-200 bg-amber-50/50">
              <div className="px-3 sm:px-4 py-2 text-[10px] font-black uppercase text-amber-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Ödemesi Bekleniyor — {bekleyenIsler.length} iş (sonlanınca yöntemine göre deftere işlenir)
              </div>
              {bekleyenIsler.map(j => (
                <div key={j.id} className={`grid grid-cols-[1fr_auto] gap-2 px-3 sm:px-4 py-2.5 items-center border-t border-dashed border-amber-200 ${j.gecikmeGunu > 0 ? 'bg-red-50/60' : 'opacity-60'}`}>
                  <div className="min-w-0">
                    <div className="font-black text-sm text-neutral-700 break-words flex items-center gap-1.5 flex-wrap">
                      {j.customerName}
                      {/* YENİ: geçmiş günden devreden bekleyen ödeme vurgulanır */}
                      {j.gecikmeGunu > 0 && (
                        <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                          {j.gecikmeGunu} GÜN GECİKTİ
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-500">
                      {/* Tarih eklendi: hangi güne ait olduğu artık belli */}
                      {j.date ? j.date.split('-').reverse().join('.') : '—'} • {j.time || '—'} • {j.type || 'Nakliye'}
                      {j.assignedVehiclePlate ? ` • ${j.assignedVehiclePlate}` : ''}
                      {(parseFloat(j.deposit) || 0) > 0 ? ` • Kapora düşüldü: ₺${paraFmt(parseFloat(j.deposit))}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-black tabular-nums text-sm sm:text-base ${j.gecikmeGunu > 0 ? 'text-red-700' : 'text-amber-700'}`}>₺{paraFmt(j.bekleyenTutar)}</div>
                    <div className={`text-[9px] font-black uppercase ${j.gecikmeGunu > 0 ? 'text-red-500' : 'text-amber-500'}`}>Bekleniyor</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* KALDIRILDI (kullanıcı talebi): "Başka Deftere Taşınan Ödemeler"
              toplu bloğu kaldırıldı. Bu kayıtlar artık aşağıdaki normal işlem
              listesinde KENDİ GÜNLERİNE göre sıralı, tek tek görünür. */}

          {/* DEĞİŞTİ (kullanıcı talebi): satır ayırıcıları BELİRGİNLEŞTİRİLDİ —
              ince açık gri yerine 2px kalınlığında koyu gri; satırların nerede
              bittiği telefonda net görünür. */}
          <div className="divide-y-2 divide-neutral-200">
            {/* YENİ: Tüm Zamanlar modunda yalnızca ilk 'gosterilenSayi' kayıt
                çizilir (günlük modda zaten tek günün hareketleri var, dilimlenmez). */}
            {/* ================================================================
                YENİ (kullanıcı talebi): GÜN DEĞİŞİMİ AYIRICISI
                ----------------------------------------------------------------
                "Tüm Zamanlar" görünümünde liste tarihe göre YENİDEN ESKİYE
                sıralıdır; 1 Eylül kayıtları bitip 31 Ağustos'a geçilen yer
                belli olmuyordu. Artık her gün değişiminde iki kırmızı çizgi
                arasında, ALTINDA BAŞLAYAN günün etiketi küçük bir rozetle
                gösterilir (ör. "31 Ağustos 2026 Pazartesi").
                Günlük (tek gün) görünümünde zaten tek tarih olduğu için
                ayırıcı çizilmez.
                NOT: Üst kapsayıcıdaki `divide-y-2` her kardeş öğeye gri üst
                kenarlık koyduğu için, hem ayırıcının hem de hemen altındaki
                satırın üst kenarlığı satır içi stille sıfırlanır; böylece
                kırmızı çizginin etrafında istenmeyen gri çizgiler oluşmaz.
                ================================================================ */}
            {(() => {
              const _liste = gunFiltreAktif ? dIslemler : dIslemler.slice(0, gosterilenSayi);
              return _liste.map((i, _idx) => {
                const _oncekiTarih = _idx > 0 ? _liste[_idx - 1].tarih : null;
                const _gunDegisti = !gunFiltreAktif && _oncekiTarih && _oncekiTarih !== i.tarih;
                const _satir = (
              i._tasinanBilgi ? (
                <div key={i.id} className="grid grid-cols-[60%_40%] sm:grid-cols-[1fr_auto_auto] gap-1.5 sm:gap-2 px-3 sm:px-4 py-3.5 items-center bg-sky-50/40">
                  <div className="min-w-0">
                    <div className="sm:hidden mb-0.5">
                      <span className="text-[9px] font-black uppercase text-sky-600">
                        TAŞINDI <span className="text-neutral-400 font-bold normal-case">{new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="hidden sm:inline text-[11px] font-black text-neutral-400">{new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                      <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200">Taşınan Ödeme</span>
                      <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">{i._tur || 'Nakliye'}</span>
                      {i._plaka && <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">{i._plaka}</span>}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-neutral-700 mt-0.5 break-words">{i._musteri}</div>
                    <div className="text-[10px] font-black text-sky-700">
                      ({(i._yontem || '').toUpperCase()} OLARAK ÖDEMEYİ KAPATTI) {i._hedefEtiket}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-neutral-400">
                      {i._saat || '—'}{i._kapora > 0 ? ` • Kapora düşüldü: ₺${paraFmt(i._kapora)}` : ''} • bu deftere işlenmedi
                    </div>
                  </div>
                  <div className="sm:hidden flex items-center justify-center self-stretch">
                    <span className="font-black tabular-nums text-lg leading-tight text-center text-sky-700">₺{paraFmt(i.tutar)}</span>
                  </div>
                  <div className="hidden sm:block text-right w-24 sm:w-28 font-black text-sm sm:text-base text-sky-700">₺{paraFmt(i.tutar)}</div>
                  <div className="hidden sm:block text-right w-24 sm:w-28"></div>
                </div>
              ) : (
              /* DEĞİŞTİ (kullanıcı talebi): Satıra TIKLANINCA Düzenle/Sil açılır.
                 Tıklamadan görünmezler. Açık satır hafif vurgulanır. */
              <div key={i.id}
                onClick={() => { if (!i.silindi) setAcikIslemId(acikIslemId === i.id ? null : i.id); }}
                /* MOBİL DÜZEN (kullanıcı talebi): sol %60 açıklama/etiketler,
                   sağ %40 tutar — tutar kendi sütununda DİKEY ORTALI durur.
                   Masaüstünde eski üç sütunlu düzen korunur. */
                className={`grid grid-cols-[60%_40%] sm:grid-cols-[1fr_auto_auto] gap-1.5 sm:gap-2 px-3 sm:px-4 py-3.5 items-center transition ${i.silindi ? 'opacity-50' : 'cursor-pointer hover:bg-neutral-50'} ${acikIslemId === i.id ? 'bg-blue-50/60' : ''}`}>
                <div className="min-w-0">
                  {/* ==========================================================
                      YENİ (kullanıcı talebi): MOBİL TEK SÜTUN TUTAR
                      Telefonda Gelir/Gider iki ayrı sütun yerine banka
                      uygulamasındaki gibi tek satır: solda GELİR (yeşil) /
                      GİDER (kırmızı) etiketi + tarih, sağda tutar (gider
                      önünde − işaretiyle). Masaüstü iki sütun aynen durur. */}
                  {/* DEĞİŞTİ: tutar buradan SAĞ SÜTUNA taşındı; burada yalnızca
                      küçük GELİR/GİDER etiketi ve tarih kalır. */}
                  <div className="sm:hidden mb-0.5">
                    <span className={`text-[9px] font-black uppercase ${i.tip === 'giris' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {i.tip === 'giris' ? 'GELİR' : 'GİDER'} <span className="text-neutral-400 font-bold normal-case">{new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* YENİ: silinen/düzenlenen işlemler satırda etiketlenir.
                        DEĞİŞTİ (kullanıcı talebi): Kaynak sistemde (Depoevim CRM)
                        silinen kayıtlar, buradan ELLE silinenlerden ayırt edilsin
                        diye farklı bir rozet alır. Köprü, silme bilgisini
                        silmeKaynagi alanıyla gönderir (bkz. silinme dipnotu). */}
                    {i.silindi && (
                      i.silmeKaynagi
                        ? <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-700 text-white">{String(i.silmeKaynagi).toLocaleUpperCase('tr-TR')}'DE SİLİNDİ</span>
                        : <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white">İŞLEM SİLİNDİ</span>
                    )}
                    {!i.silindi && i.duzenlendi && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white">DÜZENLENDİ</span>}
                    <span className="hidden sm:inline text-[11px] font-black text-neutral-400">{new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                    {/* MOBİL: etiket yazıları küçültüldü — sol sütun %60'a
                        sığsın, tutarın üstüne taşmasın. */}
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">{i.kategori}</span>
                    {i.odemeYontemi && <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{i.odemeYontemi}</span>}
                    {/* DEĞİŞİKLİK: Etiketlerdeki plaka-tıklama mantığı KALDIRILDI.
                        Araç artık kendi alanında (aracId/plaka) tutuluyor ve
                        aşağıda ayrı rozet olarak gösteriliyor. Etiketten de
                        tıklanabilir olsaydı aynı bilgi iki yerde çıkardı. */}
                    {(i.etiketler || []).map(e => <span key={e} className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">#{e}</span>)}
                    {i.kaynak && i.kaynak !== 'Manuel' && <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">{i.kaynak}</span>}
                  </div>
                  {/* DEĞİŞİKLİK: Müşteri adı artık AÇIKLAMA METNİNİN İÇİNDE değil.
                      Açıklama düz metin basılır; müşteri ve araç altta ayrı ROZET
                      olarak gösterilir. Böylece hangi bilginin gerçek bir kayda
                      bağlı olduğu görsel olarak ayrışır. */}
                  {i.aciklama && <div className="text-xs sm:text-sm font-bold text-neutral-700 truncate mt-0.5">{i.aciklama}</div>}

                  {/* MÜŞTERİ ve ARAÇ ROZETLERİ — tıklanınca ilgili profile gider */}
                  {(i.musteriAdi || i.plaka || i.ekipSefi) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {i.musteriAdi && (onViewCari ? (
                        <button type="button"
                          onClick={(ev) => { ev.stopPropagation(); onViewCari(i.musteriTel || i.musteriAdi); }}
                          title={`${i.musteriAdi} carisine git`}
                          className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400 transition inline-flex items-center gap-1">
                          <User className="w-3 h-3" /> {i.musteriAdi}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <User className="w-3 h-3" /> {i.musteriAdi}
                        </span>
                      ))}
                      {i.plaka && ((onViewVehicle && i.aracId) ? (
                        <button type="button"
                          onClick={(ev) => { ev.stopPropagation(); onViewVehicle(i.plaka); }}
                          title={`${i.plaka} araç profiline git`}
                          className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 hover:border-orange-400 transition inline-flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {i.plaka}
                        </button>
                      ) : (
                        /* Araç kimliği yoksa (kayıt silinmiş) tıklanamaz rozet */
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {i.plaka}
                        </span>
                      ))}

                      {/* YENİ: EKİP ŞEFİ ROZETİ — tıklanınca personel profiline gider.
                          Kimlik yoksa (eski kayıt) tıklanamaz rozet gösterilir. */}
                      {i.ekipSefi && ((onViewPersonnel && i.ekipSefiId) ? (
                        <button type="button"
                          onClick={(ev) => { ev.stopPropagation(); onViewPersonnel(i.ekipSefiId); }}
                          title={`${i.ekipSefi} personel profiline git`}
                          className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-400 transition inline-flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {i.ekipSefi}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {i.ekipSefi}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[9px] sm:text-[10px] font-bold text-neutral-300 truncate">{i.by}</div>
                  {/* DEĞİŞTİ (kullanıcı talebi): Düzenle/Sil düğmeleri artık
                      MOBİLDE HER İŞLEMDE görünür (telefonda hover yok, gizli
                      kalıyorlardı); masaüstünde eskisi gibi üzerine gelince
                      çıkar. Silinmiş işlemde düğmeler gösterilmez. */}
                  {!i.silindi && acikIslemId === i.id && (
                    <div className="flex items-center gap-1 mt-1.5 animate-in fade-in slide-in-from-top-1">
                      <button onClick={(ev) => { ev.stopPropagation(); setIslemForm({ tip: i.tip, tutar: String(i.tutar), aciklama: i.aciklama || '', kategori: i.kategori || 'Diğer', etiketler: (i.etiketler || []), odemeYontemi: i.odemeYontemi || 'Nakit', tarih: i.tarih, hedefDefterId: i.defterId || seciliDefterId || '', musteriAdi: i.musteriAdi || '', musteriTel: i.musteriTel || '', plaka: i.plaka || '', aracId: i.aracId || '', ekipSefi: i.ekipSefi || '', ekipSefiId: i.ekipSefiId || '' }); setEditingIslemId(i.id); setShowIslemForm(true); setAcikIslemId(null); }}
                        className="text-[10px] font-black text-blue-700 px-2.5 py-1.5 rounded-lg bg-blue-100 border border-blue-300 hover:bg-blue-200 transition flex items-center gap-1"><Edit className="w-3 h-3" /> Düzenle</button>
                      <button onClick={(ev) => { ev.stopPropagation(); setDeleteIslemId(i.id); setAcikIslemId(null); }}
                        className="text-[10px] font-black text-red-700 px-2.5 py-1.5 rounded-lg bg-red-100 border border-red-300 hover:bg-red-200 transition flex items-center gap-1 ml-1"><X className="w-3 h-3" /> Sil</button>
                    </div>
                  )}
                  {i.silindi && (
                    <div className="text-[10px] font-bold text-red-400 mt-0.5">
                      {i.silmeKaynagi
                        ? `${i.silmeKaynagi} tarafında silindi`
                        : 'İşlem silindi'}
                      {i.silinmeTarihi ? ` • ${new Date(i.silinmeTarihi).toLocaleDateString('tr-TR')}` : ''}{i.silen ? ` • ${i.silen}` : ''} — kayıt saklanıyor, hesaplara dahil edilmiyor
                    </div>
                  )}
                </div>
                {/* MOBİL TUTAR SÜTUNU — satırın sağ %40'ı, dikey ve yatay ortalı,
                    yazı büyük; gelir yeşil, gider kırmızı ve önünde − işareti. */}
                <div className="sm:hidden flex items-center justify-center self-stretch">
                  <span className={`font-black tabular-nums text-lg leading-tight text-center ${i.silindi ? 'line-through text-neutral-400' : i.tip === 'giris' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {i.tip === 'cikis' ? '−' : ''}₺{paraFmt(parseFloat(i.tutar))}
                  </span>
                </div>
                <div className={`hidden sm:block text-right w-24 sm:w-28 font-black text-sm sm:text-base ${i.silindi ? 'line-through text-neutral-300' : 'text-emerald-600'}`}>{i.tip === 'giris' ? `₺${paraFmt(parseFloat(i.tutar))}` : ''}</div>
                <div className={`hidden sm:block text-right w-24 sm:w-28 font-black text-sm sm:text-base ${i.silindi ? 'line-through text-neutral-300' : 'text-red-500'}`}>{i.tip === 'cikis' ? `₺${paraFmt(parseFloat(i.tutar))}` : ''}</div>
              </div>
              )
                );
                if (!_gunDegisti) return _satir;
                return (
                  <React.Fragment key={`gunayirici_${i.id}`}>
                    {/* Kırmızı gün ayırıcı: iki çizgi arasında o günün etiketi */}
                    <div style={{ borderTopWidth: 0 }} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-50/70">
                      <span className="flex-1 h-[2px] bg-red-500 rounded-full" />
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-red-700 bg-white border-2 border-red-400 rounded-full px-2.5 py-0.5 whitespace-nowrap shadow-sm">
                        {gunEtiketi(i.tarih)}
                      </span>
                      <span className="flex-1 h-[2px] bg-red-500 rounded-full" />
                    </div>
                    {/* Ayırıcının hemen altındaki satırın gri üst çizgisi kapatılır */}
                    {React.cloneElement(_satir, { style: { ..._satir.props.style, borderTopWidth: 0 } })}
                  </React.Fragment>
                );
              });
            })()}
          </div>

          {/* ==============================================================
              YENİ: DEVAMINI GÖR
              Tüm Zamanlar modunda ve gösterilenden fazla kayıt varsa çıkar.
              Her tıklamada 50 kayıt daha açılır; kaç kaydın kaldığı da yazar.
              Hepsi açıldığında düğme yerini "tümü listelendi" bilgisine bırakır.
              ============================================================== */}
          {!gunFiltreAktif && dIslemler.length > 0 && (
            <div className="p-3 border-t border-neutral-100 bg-neutral-50 text-center">
              {dIslemler.length > gosterilenSayi ? (
                <>
                  <button onClick={() => setGosterilenSayi(n => n + SAYFA_BOYU)}
                    className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black rounded-xl transition inline-flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" /> Devamını Gör ({Math.min(SAYFA_BOYU, dIslemler.length - gosterilenSayi)} kayıt daha)
                  </button>
                  <p className="text-[11px] font-bold text-neutral-400 mt-1.5">
                    {gosterilenSayi} / {dIslemler.length} kayıt gösteriliyor
                  </p>
                </>
              ) : (
                <p className="text-[11px] font-bold text-neutral-400">
                  Tüm kayıtlar listelendi ({dIslemler.length} hareket)
                </p>
              )}
            </div>
          )}
        </div>

        {/* ==================================================================
            TAŞINDI (kullanıcı talebi): GÜN GEZİNME + FİLTRE + ARAMA
            Artık işlem listesinin ALTINDA. İçerik hiç değişmedi. */}
        {/* YENİ: GÜNLÜK GEZİNME ÇUBUĞU
            Sol/sağ oklarla düne ve yarına geçilir. Açılışta her zaman bugün seçilidir.
            "Tüm Geçmiş" düğmesi filtreyi kapatıp defterin tamamını listeler. */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3">
            {/* DÜN */}
            <button onClick={() => { setSeciliGun(gunKaydir(seciliGun, -1)); setGunFiltreAktif(true); }}
              title="Önceki gün"
              className="w-10 h-10 shrink-0 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition">
              <ChevronLeft className="w-5 h-5 text-neutral-700" />
            </button>

            <div className="flex-1 min-w-0 text-center">
              {/* Tarih etiketi — tıklanınca bugüne döner */}
              <button onClick={() => { setSeciliGun(bugunStr()); setGunFiltreAktif(true); }}
                className="w-full group">
                <div className="text-sm font-black text-black truncate">
                  {gunFiltreAktif ? gunEtiketi(seciliGun) : 'Tüm Zamanlar'}
                </div>
                <div className="text-[10px] font-bold text-neutral-400">
                  {!gunFiltreAktif ? `${defterIslemleri(seciliDefterId).length} kayıt` :
                    seciliGun === bugunStr() ? 'Bugün' :
                    `${gunIslemleri.length} hareket • bugüne dönmek için dokun`}
                </div>
              </button>
            </div>

            {/* YARIN — hareket olan günlerde nokta gösterilir ki ileride kayıt
                olup olmadığı ok tuşuna basmadan anlaşılsın. */}
            <button onClick={() => { setSeciliGun(gunKaydir(seciliGun, 1)); setGunFiltreAktif(true); }}
              title="Sonraki gün"
              className="w-10 h-10 shrink-0 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition relative">
              <ChevronRight className="w-5 h-5 text-neutral-700" />
              {hareketliGunler.has(gunKaydir(seciliGun, 1)) && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              )}
            </button>

            {/* TÜM GEÇMİŞ / TARİHE DÖN geçişi
                DEĞİŞTİ: "Günlük" yerine "Tarihe Dön" yazıyor (kullanıcı talebi) —
                tüm geçmişteyken hangi düğmenin sizi günlük görünüme geri
                götüreceği daha açık oluyor. Mod değişince sayfalama sayacı
                başa sarılır ki yeni listede yine 50'den başlansın. */}
            <button onClick={() => { setGunFiltreAktif(!gunFiltreAktif); setGosterilenSayi(SAYFA_BOYU); if (gunFiltreAktif) setKategoriFiltre('Tümü'); }}
              className={`shrink-0 px-2.5 sm:px-3 h-10 rounded-xl text-[10px] sm:text-[11px] font-black transition ${
                gunFiltreAktif ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}>
              {gunFiltreAktif ? 'Tüm Zamanlar' : 'Tarihe Dön'}
            </button>
          </div>

          {/* ==============================================================
              YENİ: HAREKET TÜRÜ FİLTRESİ — Tümü / Gelir / Gider / Transfer
              ==============================================================
              Gün gezinme çubuğunun hemen altında, "Tüm Zamanlar" düğmesiyle
              aynı bloktadır. Her sekmede o türe ait KAYIT SAYISI da yazar,
              böylece tıklamadan önce ne kadar hareket olduğu görünür.
              Sayılar, o an geçerli olan gün/tüm zamanlar seçimine göre
              hesaplanır — yani "Gelir 12" derken hangi dönemdeyseniz onun
              gelir sayısıdır.
              MOBİL: Dört sekme eşit bölüşür, dar ekranda yazı küçülür.
              ============================================================== */}
          {(() => {
            // Sayımlar: yalnızca gün filtresi uygulanmış havuz üzerinden
            // (arama ve kategori filtresi burada kasten hesaba katılmaz;
            //  sekme sayıları sabit bir referans olmalı).
            const havuz = defterIslemleri(seciliDefterId).filter(i => !gunFiltreAktif || i.tarih === seciliGun);
            const sayilar = {
              tumu: havuz.length,
              giris: havuz.filter(i => i.tip === 'giris' && !i.isVirman).length,
              cikis: havuz.filter(i => i.tip === 'cikis' && !i.isVirman).length,
              transfer: havuz.filter(i => i.isVirman).length,
              // YENİ (kullanıcı talebi): silinmiş kayıtların sayısı
              silinen: havuz.filter(i => i.silindi).length,
            };
            const sekmeler = [
              { id: 'tumu', ad: 'Tümü', aktif: 'bg-neutral-900 text-white', pasif: 'text-neutral-500 hover:bg-neutral-100' },
              { id: 'giris', ad: 'Gelir', aktif: 'bg-emerald-600 text-white', pasif: 'text-emerald-700 hover:bg-emerald-50' },
              { id: 'cikis', ad: 'Gider', aktif: 'bg-red-600 text-white', pasif: 'text-red-600 hover:bg-red-50' },
              { id: 'transfer', ad: 'Transfer', aktif: 'bg-slate-800 text-white', pasif: 'text-slate-600 hover:bg-slate-100' },
              // YENİ (kullanıcı talebi): "Silinenleri görelim" — silinen kayıtlar
              // veritabanından KALDIRILMAZ, yalnızca damgalanır; bu sekme onları
              // tek tuşla listeler.
              { id: 'silinen', ad: 'Silinen', aktif: 'bg-rose-600 text-white', pasif: 'text-rose-600 hover:bg-rose-50' },
            ];
            // DEĞİŞTİ (kullanıcı talebi): bu bölge MOBİLDE %15 küçültüldü
            // ([zoom:0.85]); masaüstünde boyut aynı (sm:[zoom:1]).
            return (
              <div className="[zoom:0.85] sm:[zoom:1] grid grid-cols-5 gap-1.5 px-2.5 sm:px-3 pb-2.5 sm:pb-3 border-t border-neutral-100 pt-2.5">
                {sekmeler.map(sk => (
                  <button key={sk.id} type="button" onClick={() => setHareketFiltre(sk.id)}
                    className={`py-2 rounded-xl text-[10px] sm:text-[11px] font-black transition flex flex-col items-center justify-center leading-tight ${
                      hareketFiltre === sk.id ? sk.aktif : `bg-neutral-50 ${sk.pasif}`}`}>
                    <span>{sk.ad}</span>
                    <span className={`text-[9px] font-bold ${hareketFiltre === sk.id ? 'text-white/70' : 'text-neutral-400'}`}>{sayilar[sk.id]}</span>
                  </button>
                ))}
              </div>
            );
          })()}

          {/* SEÇİLİ GÜNÜN GELİR / GİDER / NET tablosu — yalnızca günlük moddayken */}
          {gunFiltreAktif && (
            <div className="[zoom:0.85] sm:[zoom:1] grid grid-cols-3 border-t border-neutral-200 divide-x divide-neutral-200">
              <div className="p-2.5 text-center">
                <div className="text-[9px] font-black uppercase text-emerald-600">Gelir</div>
                <div className="text-sm font-black text-emerald-700">₺{paraFmt(gunGiris)}</div>
              </div>
              <div className="p-2.5 text-center">
                <div className="text-[9px] font-black uppercase text-red-500">Gider</div>
                <div className="text-sm font-black text-red-600">₺{paraFmt(gunCikis)}</div>
              </div>
              <div className="p-2.5 text-center">
                <div className="text-[9px] font-black uppercase text-neutral-500">Günün Neti</div>
                {/* Net negatifse eksi işaretiyle kırmızı gösterilir */}
                <div className={`text-sm font-black ${gunNet > 0 ? 'text-emerald-700' : gunNet < 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                  {gunNet < 0 ? '−' : ''}₺{paraFmt(Math.abs(gunNet))}
                </div>
              </div>
            </div>
          )}

          {/* YENİ: O gün transfer yapıldıysa ayrı satırda gösterilir.
              Üstteki üç rakama katılmıyor; buraya yazılmasa kullanıcı
              "para nereye gitti" diye toplamları sorgulardı. */}
          {gunFiltreAktif && gunVirman > 0 && (
            <div className="[zoom:0.85] sm:[zoom:1] border-t border-neutral-200 px-3 py-2 flex items-center justify-between bg-slate-50">
              <span className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Hesaplar arası transfer
              </span>
              <span className="text-xs font-black text-slate-700">₺{paraFmt(gunVirman)}</span>
            </div>
          )}
        </div>

        {/* ARAMA */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={detayArama} onChange={e => setDetayArama(e.target.value)} placeholder="İşlemlerde ara: açıklama, kategori veya etiket..."
            className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600 bg-white transition" />
        </div>

        {/* YENİ: ETİKET SEÇME PENCERESİ
            Hazır etiketler gruplar hâlinde listelenir. Gruplar VARSAYILAN olarak
            KAPALI gelir — 88 etiket birden açılırsa pencere okunamaz. Arama
            yazıldığında gruplar göz ardı edilip düz sonuç listesi gösterilir.
            KATMAN NOTU: z-[9999] kullanılıyor. Bu pencereyi açan İŞLEM FORMU
            z-[9997] olduğu için, daha düşük bir değerde (z-50) formun ARKASINDA
            kalıyor ve ekranda hiç görünmüyordu. 9999 dosyadaki en yüksek değer. */}
        {/* ==================================================================
            YENİ (kullanıcı talebi): MOBİL HIZLI KATEGORİ SEÇİCİ PENCERESİ
            ==================================================================
            Ana kategoriler ve altındaki alt kategoriler tek tek tıklanabilir.
            Masaüstündeki kategori seçici mantığıyla aynı; alttan açılır kart. */}
        {hizliKatSecici && (() => {
          const KATEGORI_AGACI = [
            { ad: 'Nakliyat', alt: ['Şehir İçi', 'Şehirlerarası', 'Depo-Depo'] },
            { ad: 'Depoevim', alt: ['Eşya Depolama', 'Ambalaj', 'Kurulum'] },
            { ad: 'Araç', alt: ['Yakıt', 'Bakım', 'Lastik', 'Sigorta', 'HGS/OGS', 'Ceza'] },
            { ad: 'Personel', alt: ['Maaş', 'Avans', 'Prim', 'SGK'] },
            { ad: 'Kira', alt: [] },
            // YENİ (kullanıcı talebi): BORÇ kategorisi — bir yerden borç
            // ALINDIĞINDA ya da birine borç VERİLDİĞİNDE kullanılır. Bu
            // kategoriyle işlenen tutar genel ciro/gelir-gider hesabını
            // ETKİLEMEZ (kredi taksit ödemeleri gibi ayrı tutulur).
            { ad: 'Borç', alt: ['Borç Alınan', 'Borç Verilen'] },
            { ad: 'Fatura', alt: ['Elektrik', 'Su', 'Doğalgaz', 'İnternet', 'Telefon'] },
            { ad: 'Malzeme', alt: [] },
            { ad: 'Yemek', alt: [] },
            { ad: 'Vergi', alt: ['KDV', 'Stopaj', 'Gelir Vergisi'] },
            { ad: 'Tahsilat', alt: [] },
            { ad: 'Diğer', alt: [] },
          ];
          return (
            <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setHizliKatSecici(false)}>
              <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 shrink-0">
                  <h3 className="font-black text-black flex items-center gap-2"><Tag className="w-5 h-5 text-emerald-600" /> Kategori Seç</h3>
                  <button onClick={() => setHizliKatSecici(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {/* DEĞİŞTİ (kullanıcı talebi): ALT KATEGORİLER KALDIRILDI.
                      Bu seçici de artık tek katmanlı — yalnızca ana kategoriler
                      listelenir ve doğrudan seçilir. Alt kategori seçimi
                      "ANA • ALT" biçiminde birleşik bir değer kaydediyordu;
                      artık yalnızca ana kategori adı kaydedilir. Eskiden bu
                      biçimde kaydedilmiş işlemler bozulmaz, aynen görünür. */}
                  {KATEGORI_AGACI.map(kat => {
                    const anaSecili = hizliKategori === kat.ad;
                    return (
                      <div key={kat.ad} className={`rounded-xl border-2 overflow-hidden ${anaSecili ? 'border-emerald-500' : 'border-neutral-200'}`}>
                        <button type="button"
                          onClick={() => { setHizliKategori(kat.ad); setHizliKatSecici(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left transition ${anaSecili ? 'bg-emerald-50' : 'bg-neutral-50 hover:bg-neutral-100'}`}>
                          <span className="font-black text-sm text-neutral-800 flex items-center gap-2">
                            {anaSecili && <CheckCircle className="w-4 h-4 text-emerald-600" />}{kat.ad}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-neutral-200 shrink-0">
                  <button type="button" onClick={() => { setHizliKategori('Diğer'); setHizliKatSecici(false); }}
                    className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl transition">
                    Kategorisiz (Diğer) kapat
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {showEtiketSecici && (
          <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">

              {/* PENCERE BAŞLIĞI */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 shrink-0">
                <div className="font-black text-black flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-600" /> Kategori Seç
                  {islemForm.kategori && (
                    <span className="text-[10px] font-black bg-emerald-600 text-white rounded-full px-2 py-0.5 max-w-[140px] truncate">
                      {islemForm.kategori}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowEtiketSecici(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* ARAMA */}
              <div className="p-3 border-b border-neutral-200 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={etiketArama} onChange={e => setEtiketArama(e.target.value)} placeholder="Kategori ara..."
                    className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
                </div>
              </div>

              {/* ETİKET LİSTESİ */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(() => {
                  const q = etiketArama.trim().toLocaleLowerCase('tr-TR');
                  // Tek seçim: seçili dizi, mevcut kategoriden türetilir ki
                  // penceredeki includes() kontrolleri değişmeden çalışsın.
                  const secili = [islemForm.kategori].filter(Boolean);

                  // ==================================================================
                  // DEĞİŞTİ (kullanıcı talebi): ARTIK YALNIZCA ANA KATEGORİLER
                  // ------------------------------------------------------------------
                  // Önceden liste iki katmanlıydı: açılıp kapanan grup başlıkları ve
                  // içlerinde alt kategoriler (ARAÇ > 34 MIA 813, KİRALAR > MERKEZ
                  // DEPO gibi). Artık alt kategoriler GÖSTERİLMEZ; seçici tek katman,
                  // düz bir ana kategori listesidir.
                  //
                  // ÖNEMLİ AYRIM: 'KİŞİLER' ve 'GENEL' gerçek birer kategori DEĞİL,
                  // yalnızca görsel gruplama başlıklarıdır (shared.jsx'te
                  // tumVarsayilanEtiketler() bu ikisini listeden çıkarır ve seçici de
                  // onlara "(tümü)" düğmesi vermez). Dolayısıyla onların altındaki
                  // YAKIT, MAZOT, VERGİ, KAPORA, MUSTAFA BEŞİNCİ gibi kayıtlar alt
                  // kategori değil, ZATEN ANA KATEGORİDİR — bu yüzden listede kalırlar.
                  // Aksi halde en çok kullanılan kategoriler kaybolurdu.
                  //
                  // NOT: Daha önce alt kategoriyle (örn. "34 NDD 433") kaydedilmiş
                  // işlemler bozulmaz; kayıtlı değerleri aynen durur ve listelerde
                  // görünmeye devam eder. Yalnızca yeni seçimlerde sunulmazlar.
                  // Araç bilgisi için işlem formundaki ayrı "Araç Plakası" alanı var.
                  // ==================================================================
                  const anaKategoriler = [];
                  VARSAYILAN_ETIKET_GRUPLARI.forEach(grup => {
                    const sanalBaslik = grup.baslik === 'KİŞİLER' || grup.baslik === 'GENEL';
                    if (sanalBaslik) anaKategoriler.push(...grup.etiketler); // bunlar zaten ana kategori
                    else anaKategoriler.push(grup.baslik);                   // alt kategorileri atlanır
                  });

                  // ARAMA MODU: aynı ana kategori listesi içinde arar.
                  if (q) {
                    const tumu = [...anaKategoriler, ...ozelEtiketler]
                      .filter(e => e.toLocaleLowerCase('tr-TR').includes(q))
                      .sort((a, b) => a.localeCompare(b, 'tr-TR'));
                    if (tumu.length === 0) {
                      return <p className="text-center text-sm font-bold text-neutral-400 py-8">
                        "{etiketArama}" bulunamadı. Aşağıdan yeni kategori olarak ekleyebilirsiniz.
                      </p>;
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {tumu.map(e => (
                          <button key={e} type="button" onClick={() => etiketToggle(e)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${
                              secili.includes(e)
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-neutral-700 border-neutral-300 hover:border-emerald-400'
                            }`}>
                            {secili.includes(e) && '✓ '}{e}
                          </button>
                        ))}
                      </div>
                    );
                  }

                  // NORMAL MOD: tek katman — düz ana kategori listesi + özel etiketler
                  return (
                    <>
                      <div className="border border-neutral-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2.5 bg-neutral-50 text-xs font-black text-black flex items-center justify-between">
                          <span>ANA KATEGORİLER</span>
                          <span className="text-[10px] font-bold text-neutral-400">{anaKategoriler.length}</span>
                        </div>
                        <div className="p-2.5 flex flex-wrap gap-1.5">
                          {anaKategoriler.map(e => (
                            <button key={e} type="button" onClick={() => etiketToggle(e)}
                              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${
                                secili.includes(e)
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-emerald-400'
                              }`}>
                              {secili.includes(e) && '✓ '}{e}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* KULLANICI ETİKETLERİ — silme düğmesi yalnızca burada var */}
                      {ozelEtiketler.length > 0 && (
                        <div className="border-2 border-emerald-200 rounded-xl overflow-hidden">
                          <div className="px-3 py-2.5 bg-emerald-50 text-xs font-black text-emerald-900">
                            EKLEDİĞİNİZ KATEGORİLER ({ozelEtiketler.length})
                          </div>
                          <div className="p-2.5 flex flex-wrap gap-1.5">
                            {ozelEtiketler.map(e => (
                              <span key={e} className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg border transition ${
                                secili.includes(e) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-700 border-neutral-300'
                              }`}>
                                <button type="button" onClick={() => etiketToggle(e)} className="pl-2.5 py-1.5">
                                  {secili.includes(e) && '✓ '}{e}
                                </button>
                                <button type="button" onClick={() => etiketKaldir(e)} title="Bu etiketi hazır listeden kaldır"
                                  className={`pr-2 py-1.5 transition ${secili.includes(e) ? 'hover:text-red-200' : 'hover:text-red-600'}`}>
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* EN ALT: YENİ ETİKET EKLE — eklenen etiket kalıcı olarak saklanır
                  ve bir sonraki işlemde hazır olarak gelir. */}
              <div className="p-3 border-t border-neutral-200 shrink-0 space-y-2">
                <div className="flex gap-2">
                  <input value={yeniEtiket} onChange={e => setYeniEtiket(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); etiketEkle(); } }}
                    placeholder="Yeni kategori adı..."
                    className="flex-1 min-w-0 p-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600 uppercase" />
                  <button type="button" onClick={etiketEkle} disabled={!yeniEtiket.trim()}
                    className="shrink-0 px-4 rounded-xl bg-neutral-900 text-white text-xs font-black hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Ekle
                  </button>
                </div>
                <button type="button" onClick={() => setShowEtiketSecici(false)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition">
                  {islemForm.kategori ? `Tamam — ${islemForm.kategori}` : 'Kategorisiz kapat'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* YENİ: CARİ ARAMA PENCERESİ
            İşlere kayıtlı müşteriler arasında isim veya telefonla arama.
            Katman z-[9999]: işlem formunun (9997) üstünde kalmalı, yoksa
            etiket seçicide yaşadığımız "arkada kalma" sorunu tekrarlar. */}
        {showCariSecici && (
          <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">

              <div className="flex items-center justify-between p-4 border-b border-neutral-200 shrink-0">
                <div className="font-black text-black flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" /> Cari Seç
                </div>
                <button onClick={() => setShowCariSecici(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="p-3 border-b border-neutral-200 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={cariArama} onChange={e => setCariArama(e.target.value)}
                    placeholder="Müşteri adı veya telefon ara..." autoFocus
                    className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
                </div>
                {/* İpucu: arama yapılınca kaç sonuç bulunduğunu söyler.
                    Eskiden sadece toplam cari sayısını yazıyordu; filtre çalışmadığında
                    kullanıcı bunu fark edemiyordu. */}
                <p className="text-[11px] font-bold text-neutral-400 mt-2">
                  {aramaNormalize(cariArama).length >= 2 || cariArama.replace(/\D/g, '')
                    ? `${cariListesi.filter(c => { const kl = aramaNormalize(cariArama).split(' ').filter(Boolean); const qr = cariArama.replace(/\D/g, ''); return (kl.length > 0 && kl.every(k => c.adNorm.includes(k))) || (qr.length >= 3 && c.telNorm.includes(qr)); }).length} sonuç bulundu`
                    : `${cariListesi.length} cari kayıtlı. Aramak için en az 2 harf yazın.`}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
                {(() => {
                  const q = cariArama.trim().toLocaleLowerCase('tr-TR');
                  // 2 harften kısa aramada TÜM listeyi basmıyoruz; yüzlerce cari
                  // olabilir, pencere kilitlenir. En son iş yapılanları gösteriyoruz.
                  // DÜZELTME: Eski filtrede telefon kontrolü şöyleydi:
                  //   (c.tel || '').includes(q.replace(/\D/g, ''))
                  // Metin araması yapıldığında q.replace(/\D/g,'') BOŞ STRING
                  // döner ve includes('') JavaScript'te HER ZAMAN true'dur.
                  // Sonuç: 4400+ carinin tamamı eşleşiyor, filtre hiç çalışmıyordu.
                  // Artık telefon kontrolü yalnızca sorguda RAKAM varsa yapılır.
                  const qNorm = aramaNormalize(cariArama);
                  const qRakam = cariArama.replace(/\D/g, '');
                  // Kelime kelime arama: "ekrem dirikman" -> ['ekrem','dirikman'].
                  // TÜM kelimelerin geçmesi yeterli, SIRA önemli değil; böylece
                  // "dirikman ekrem" de aynı sonucu bulur.
                  const kelimeler = qNorm.split(' ').filter(Boolean);

                  const kaynak = qNorm.length < 2 && !qRakam
                    ? [...cariListesi]
                        .sort((a, b) => (b.sonTarih || '').localeCompare(a.sonTarih || ''))
                        .slice(0, 20)
                    : cariListesi
                        .filter(c => {
                          const adEsleme = kelimeler.length > 0 && kelimeler.every(k => c.adNorm.includes(k));
                          const telEsleme = qRakam.length >= 3 && c.telNorm.includes(qRakam);
                          return adEsleme || telEsleme;
                        })
                        // İsmi sorguyla BAŞLAYANLAR üste alınır; 'Abbas' aranırken
                        // 'Ali Abbasoğlu' değil 'Abbas Şahin' önce görünsün.
                        .sort((a, b) => {
                          const aBas = a.adNorm.startsWith(kelimeler[0] || '') ? 0 : 1;
                          const bBas = b.adNorm.startsWith(kelimeler[0] || '') ? 0 : 1;
                          if (aBas !== bBas) return aBas - bBas;
                          return (a.ad || '').localeCompare((b.ad || ''), 'tr-TR');
                        })
                        // Uzun listelerde pencere kilitlenmesin diye üst sınır
                        .slice(0, 50);

                  if (kaynak.length === 0) {
                    return <p className="p-8 text-center text-sm font-bold text-neutral-400">
                      "{cariArama}" ile eşleşen cari bulunamadı.
                    </p>;
                  }
                  return kaynak.map(c => (
                    <button key={c.tel} type="button"
                      onClick={() => {
                        setIslemForm({ ...islemForm, musteriAdi: c.ad, musteriTel: c.tel });
                        setShowCariSecici(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-black text-neutral-500 shrink-0">
                        {(c.ad || '?').charAt(0).toLocaleUpperCase('tr-TR')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-black truncate">{c.ad}</div>
                        <div className="text-[11px] font-bold text-neutral-500">{c.tel} • {c.isSayisi} iş</div>
                      </div>
                    </button>
                  ));
                })()}
              </div>

              
            </div>
          </div>
        )}

        {/* YENİ: TRANSFER (VİRMAN) PENCERESİ
            Sadece üç alan var: hedef defter, tutar, opsiyonel açıklama.
            Etiket ve kategori BİLEREK yok — transfer bir harcama kalemi değil.
            Katman z-[9998]: işlem formunun (9997) üstünde, etiket seçicinin
            (9999) altında kalır. */}
        {/* ==================================================================
            YENİ: TAKSİT ÖDEME PENCERESİ
            Ödemenin hangi hesaptan yapılacağı seçilir. Onaylanınca o hesaptan
            para çıkar, kredinin kalan borcu azalır. Bakiyesi yetersiz hesap
            seçilirse uyarı gösterilir ama engellenmez (nakit akışı eksiye
            düşebilir; karar kullanıcıya bırakılır).
            ================================================================== */}
        {/* ==================================================================
            YENİ: KREDİ EKLE / DÜZENLE
            Bir defterde birden çok kredi olabildiği için her kredi burada
            ayrı ayrı tanımlanır. Aylık taksit boş bırakılırsa toplam/adet
            olarak otomatik hesaplanır.
            ================================================================== */}


        {/* ==================================================================
            YENİ: ÖDEME KALEMİ EKLE / DÜZENLE
            Tekrar tipi ve sayısı burada belirlenir. "Süresiz" için tekrar
            sayısı boş bırakılır — kira gibi bitiş tarihi olmayan ödemeler.
            ================================================================== */}


        {/* ==================================================================
            YENİ: VADE ÖDEME PENCERESİ
            Tutar değiştirilebilir — kira zammı gibi durumlarda o ayki gerçek
            tutar farklı olabilir. Plan tutarı bozulmaz, yalnızca bu ödeme
            girilen tutarla kaydedilir.
            ================================================================== */}




        {showVirmanForm && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">

              <div className="flex items-center justify-between p-4 border-b border-neutral-200 sticky top-0 bg-white">
                <div className="font-black text-black flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-slate-700" /> TRANSFER (Virman)
                </div>
                <button onClick={() => setShowVirmanForm(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="p-4 space-y-4">

                {/* CİROYU ETKİLEMEZ bilgisi — muhasebe açısından en kritik nokta */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                    Transfer <b>gelir veya gider olarak sayılmaz</b>; sadece para bir hesaptan
                    diğerine geçer. Ciro, toplam gelir ve toplam gider rakamları değişmez.
                  </p>
                </div>

                {/* NEREDEN — değiştirilemez, içinde bulunduğumuz defter */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">Nereden (kaynak hesap)</label>
                  <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl">
                    <div className="text-sm font-black text-black">{seciliDefter.ad}</div>
                    <div className="text-[11px] font-bold text-neutral-500">
                      {/* Kaynak hesapta da blok gösterilir; hedefle aynı dili konuşsun */}
                      {defterBlogu(seciliDefter)} • Bakiye: ₺{paraFmt(defterBakiye(seciliDefterId))}
                    </div>
                  </div>
                </div>

                {/* NEREYE — kaynak defter listeden çıkarılır, kendine transfer engellenir */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">Nereye (hedef hesap) *</label>
                  <select value={virmanForm.hedefDefterId}
                    onChange={e => setVirmanForm({ ...virmanForm, hedefDefterId: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-700 text-sm bg-white">
                    <option value="">Hedef hesap seçin...</option>
                    {/* ==========================================================
                        YENİ (kullanıcı talebi): Hesap Türü seçicisiyle (İşlemi
                        Düzenle formu) AYNI desen — hesaplar düz liste yerine
                        BLOKLARA (Sembol Nakliyat / Depoevim / Genel) göre
                        gruplanmış gösteriliyor. <optgroup label="..."> tarayıcıda
                        ayırıcı başlık olarak render edilir. Kaynak hesap (kendine
                        transfer engeli) ve alfabetik sıralama AYNEN korunur.
                        ========================================================== */}
                    {DEFTER_BLOKLARI.map(blokAdi => {
                      const blokDefterleri = defterler
                        .filter(d => d.id !== seciliDefterId && defterBlogu(d) === blokAdi)
                        .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
                      if (blokDefterleri.length === 0) return null; // Boş blok gösterilmez
                      return (
                        <optgroup key={blokAdi} label={blokAdi}>
                          {blokDefterleri.map(d => (
                            <option key={d.id} value={d.id}>
                              {/* DEĞİŞTİ (kullanıcı talebi): İkinci alanda TÜR yerine
                                  BLOK yazıyor. "BANKA — Banka" gibi kendini tekrar
                                  eden bir etiket yerine "BANKA — Sembol Nakliyat"
                                  gösteriliyor; hangi şirkete ait olduğu anlaşılıyor. */}
                              {d.ad} — {defterBlogu(d)} (₺{paraFmt(defterBakiye(d.id))})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {defterler.length < 2 && (
                    <p className="text-[11px] font-bold text-red-600 mt-1.5">
                      Transfer için en az iki defter gerekiyor. Defterler ekranından yeni bir hesap açın.
                    </p>
                  )}
                </div>

                {/* TUTAR */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">Tutar (₺) *</label>
                  <input type="number" step="0.01" value={virmanForm.tutar}
                    onChange={e => setVirmanForm({ ...virmanForm, tutar: e.target.value })}
                    placeholder="0,00" autoFocus
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-700 text-lg font-black" />
                </div>

                {/* AÇIKLAMA — opsiyonel */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">
                    Açıklama <span className="text-neutral-400 font-normal">(opsiyonel)</span>
                  </label>
                  <input value={virmanForm.aciklama}
                    onChange={e => setVirmanForm({ ...virmanForm, aciklama: e.target.value })}
                    placeholder="Örn: Kasadan bankaya yatırıldı"
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-700 text-sm" />
                </div>

                {/* ÖNİZLEME — iki kayıt oluşacağı ve bakiyelerin ne olacağı gösterilir.
                    Yanlış hesaba transfer geri alınması zahmetli olduğu için önemli. */}
                {virmanForm.hedefDefterId && parseFloat(virmanForm.tutar) > 0 && (() => {
                  const hedef = defterler.find(d => d.id === virmanForm.hedefDefterId);
                  const t = parseFloat(virmanForm.tutar) || 0;
                  const kaynakSonra = defterBakiye(seciliDefterId) - t;
                  const hedefSonra = defterBakiye(virmanForm.hedefDefterId) + t;
                  return (
                    <div className="border border-neutral-200 rounded-xl overflow-hidden">
                      <div className="bg-neutral-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wider">
                        İşlem sonrası bakiyeler
                      </div>
                      <div className="divide-y divide-neutral-100">
                        <div className="px-3 py-2.5 flex justify-between items-center gap-2">
                          <span className="text-[11px] font-bold text-neutral-600 truncate">{seciliDefter.ad}</span>
                          <span className={`text-xs font-black shrink-0 ${kaynakSonra < 0 ? 'text-red-600' : 'text-neutral-800'}`}>
                            ₺{paraFmt(kaynakSonra)}
                          </span>
                        </div>
                        <div className="px-3 py-2.5 flex justify-between items-center gap-2">
                          <span className="text-[11px] font-bold text-neutral-600 truncate">{hedef?.ad}</span>
                          <span className="text-xs font-black text-emerald-700 shrink-0">₺{paraFmt(hedefSonra)}</span>
                        </div>
                      </div>
                      {kaynakSonra < 0 && (
                        <div className="px-3 py-2 bg-red-50 text-[11px] font-bold text-red-700">
                          Kaynak hesap eksiye düşecek. Kaydetmeden önce onay istenecek.
                        </div>
                      )}
                    </div>
                  );
                })()}

                <button onClick={handleVirmanKaydet}
                  disabled={virmanKaydediliyor || defterler.length < 2}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  {virmanKaydediliyor
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Aktarılıyor...</>
                    : <><ArrowRightLeft className="w-4 h-4" /> Transferi Yap</>}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ==================================================================
            TAŞINDI (kullanıcı talebi): KATEGORİ DAĞILIMI ARTIK EN ALTTA
            ==================================================================
            Eskiden bakiye kartının hemen altındaydı ve asıl bakılan yer olan
            hesap hareketlerini aşağı itiyordu — özellikle telefonda defteri
            açar açmaz listeye ulaşmak için uzun uzun kaydırmak gerekiyordu.
            Artık hareket listesinin ALTINDA duruyor: önce hareketler, sonra
            özet dağılım. Kategoriye tıklayıp listeyi filtreleme davranışı
            aynen korundu.
            YENİ (kullanıcı talebi): Kredi defterinde bu kart da gizlendi —
            işlemler bölümüyle birlikte kaldırıldı; kredi sayfası yalnızca
            aylık ödeme görünümü + Mevcut Krediler panelinden oluşur.
            ================================================================== */}
        {/* DEĞİŞTİ (kullanıcı talebi): kart tüm sayfalardan kaldırıldı —
            KATEGORI_DAGILIMI_GOSTER anahtarı yukarıda false. */}
        {KATEGORI_DAGILIMI_GOSTER && seciliDefter.tur !== 'Kredi' && Object.keys(katDagilim).length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4">
            <div className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5 mb-3"><BarChart className="w-3.5 h-3.5 text-emerald-600" /> Kategori Dağılımı</div>
            <div className="space-y-2">
              {Object.entries(katDagilim).sort((a, b) => (b[1].giris + b[1].cikis) - (a[1].giris + a[1].cikis)).map(([k, v]) => {
                const oran = Math.round(((v.giris + v.cikis) / katToplam) * 100);
                return (
                  <button key={k} onClick={() => setKategoriFiltre(kategoriFiltre === k ? 'Tümü' : k)} className={`w-full text-left group ${kategoriFiltre === k ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}>
                    <div className="flex items-center justify-between text-[11px] font-bold mb-0.5">
                      <span className={`flex items-center gap-1 ${kategoriFiltre === k ? 'text-emerald-700' : 'text-neutral-600'}`}><Tag className="w-3 h-3" /> {k} <span className="text-neutral-400">%{oran}</span></span>
                      <span className="text-neutral-500">{v.giris > 0 && <span className="text-emerald-600">+₺{paraFmt(v.giris)}</span>} {v.cikis > 0 && <span className="text-red-500 ml-1.5">−₺{paraFmt(v.cikis)}</span>}</span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex">
                      {v.giris > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(v.giris / katToplam) * 100}%` }}></div>}
                      {v.cikis > 0 && <div className="h-full bg-red-400" style={{ width: `${(v.cikis / katToplam) * 100}%` }}></div>}
                    </div>
                  </button>
                );
              })}
            </div>
            {kategoriFiltre !== 'Tümü' && (
              <button onClick={() => setKategoriFiltre('Tümü')} className="mt-2 text-[11px] font-black text-emerald-700 hover:underline">✕ "{kategoriFiltre}" filtresini kaldır</button>
            )}
          </div>
        )}


        </>)}

        {/* ==================================================================
            TAŞINDI (hata düzeltmesi — kullanıcı talebi): AŞAĞIDAKİ 4 PENCERE
            ==================================================================
            Yeni Kredi / Kredi Düzenle (krediKalemForm), Yeni Ödeme / Ödeme
            Düzenle (odemeKalemForm), vade ödeme (vadeOdeme) ve taksit ödeme
            (taksitOdeme) pencereleri eskiden "günlük işlemler" bloğunun
            İÇİNDEYDİ. O blok Ödemeler ve Kredi defterlerinde hiç çizilmediği
            için bu sayfalarda düğmelere basınca pencereler AÇILMIYORDU.
            Pencereler bloğun dışına taşındı — artık her defter türünde çalışır.
            İçerikleri tek satır bile değiştirilmedi, yalnızca yerleri değişti. */}
        {krediKalemForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-violet-600" /> {krediKalemForm.id ? 'Krediyi Düzenle' : 'Yeni Kredi'}
                </h3>
                <button onClick={() => setKrediKalemForm(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Kredi Adı *</label>
                  <input value={krediKalemForm.ad} onChange={e => setKrediKalemForm({ ...krediKalemForm, ad: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                    placeholder="Örn: Taşıt Kredisi, İşletme Kredisi" /></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Banka / Kurum</label>
                  <input value={krediKalemForm.bankaAdi} onChange={e => setKrediKalemForm({ ...krediKalemForm, bankaAdi: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                    placeholder="Örn: Garanti BBVA, Halkbank" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ana Para (₺)</label>
                    <input type="number" inputMode="decimal" value={krediKalemForm.anaPara} onChange={e => setKrediKalemForm({ ...krediKalemForm, anaPara: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="500000" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Toplam Geri Ödeme (₺) *</label>
                    <input type="number" inputMode="decimal" value={krediKalemForm.toplamGeriOdeme} onChange={e => setKrediKalemForm({ ...krediKalemForm, toplamGeriOdeme: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="650000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Taksit Sayısı *</label>
                    <input type="number" inputMode="numeric" value={krediKalemForm.taksitSayisi} onChange={e => setKrediKalemForm({ ...krediKalemForm, taksitSayisi: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="24" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Aylık Taksit (₺)</label>
                    <input type="number" inputMode="decimal" value={krediKalemForm.aylikTaksit} onChange={e => setKrediKalemForm({ ...krediKalemForm, aylikTaksit: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="boş = otomatik" /></div>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">İlk Taksit Tarihi *</label>
                  <input type="date" value={krediKalemForm.ilkTaksitTarihi} onChange={e => setKrediKalemForm({ ...krediKalemForm, ilkTaksitTarihi: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" /></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                  <input value={krediKalemForm.not || ''} onChange={e => setKrediKalemForm({ ...krediKalemForm, not: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="Opsiyonel açıklama..." /></div>

                {/* Canlı önizleme */}
                {(() => {
                  const ana = parseFloat(krediKalemForm.anaPara) || 0;
                  const top = parseFloat(krediKalemForm.toplamGeriOdeme) || 0;
                  const adet = parseInt(krediKalemForm.taksitSayisi) || 0;
                  const aylik = parseFloat(krediKalemForm.aylikTaksit) || (adet > 0 ? top / adet : 0);
                  if (!top || !adet) return null;
                  return (
                    <div className="text-[11px] font-bold text-violet-800 bg-violet-50 rounded-lg p-2.5 border border-violet-200 space-y-0.5">
                      <div>Aylık taksit: <b>₺{paraFmt(aylik)}</b> × {adet} ay</div>
                      {ana > 0 && <div>Toplam faiz / masraf: <b>₺{paraFmt(Math.max(0, top - ana))}</b></div>}
                      {Math.abs(aylik * adet - top) > 1 && <div className="text-amber-700">Uyarı: {adet} × ₺{paraFmt(aylik)} = ₺{paraFmt(aylik * adet)} — toplamla ₺{paraFmt(Math.abs(aylik * adet - top))} fark var.</div>}
                    </div>
                  );
                })()}

                <button onClick={krediKalemiKaydet} className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl transition">
                  {krediKalemForm.id ? 'Kaydet' : 'Krediyi Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {odemeKalemForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-orange-600" /> {odemeKalemForm.id ? 'Ödemeyi Düzenle' : 'Yeni Ödeme'}
                </h3>
                <button onClick={() => setOdemeKalemForm(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödeme Adı *</label>
                  <input value={odemeKalemForm.ad} onChange={e => setOdemeKalemForm({ ...odemeKalemForm, ad: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    placeholder="Örn: Dükkan Kirası, Araç Sigortası, Vergi" /></div>

                {/* ==============================================================
                    YENİ: ÖDEME TÜRÜ
                    Kalem, defterde bu türün bloğu altında listelenir.
                    ============================================================== */}
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödeme Türü *</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ODEME_TURLERI.map(t => {
                      const secili = (odemeKalemForm.odemeTuru || VARSAYILAN_ODEME_TURU) === t.id;
                      return (
                        <button key={t.id} type="button" onClick={() => setOdemeKalemForm({ ...odemeKalemForm, odemeTuru: t.id })}
                          className={`py-2 px-1 rounded-lg text-[10px] font-black border-2 transition leading-tight flex flex-col items-center gap-1 ${
                            secili ? `${t.baslik} text-white border-transparent` : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'}`}>
                          <t.Ikon className="w-3.5 h-3.5" />
                          {t.ad}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tutar (₺) *</label>
                    <input type="number" inputMode="decimal" value={odemeKalemForm.tutar} onChange={e => setOdemeKalemForm({ ...odemeKalemForm, tutar: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm" placeholder="25000" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">İlk Ödeme Tarihi *</label>
                    <input type="date" value={odemeKalemForm.ilkTarih} onChange={e => setOdemeKalemForm({ ...odemeKalemForm, ilkTarih: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm" /></div>
                </div>
                <p className="text-[10px] font-bold text-neutral-400 -mt-1">İleri tarihli ödeme için gelecekteki bir tarih seçebilirsiniz.</p>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tekrar</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TEKRAR_SECENEKLERI.map(t => (
                      <button key={t.id} type="button" onClick={() => setOdemeKalemForm({ ...odemeKalemForm, tekrar: t.id })}
                        className={`py-2 rounded-lg text-[11px] font-black border-2 transition ${
                          odemeKalemForm.tekrar === t.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-orange-400'}`}>
                        {t.ad}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tek seferlikte tekrar sayısı sorulmaz */}
                {odemeKalemForm.tekrar !== 'tek' && (
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Kaç kez tekrarlanacak?</label>
                    <input type="number" inputMode="numeric" min="0" value={odemeKalemForm.tekrarSayisi}
                      onChange={e => setOdemeKalemForm({ ...odemeKalemForm, tekrarSayisi: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                      placeholder="Boş bırakın = süresiz (kira gibi)" />
                    <p className="text-[10px] font-bold text-neutral-400 mt-1">
                      Örn: 10 yazarsanız 10 kez tekrarlanır ve biter. Boş bırakırsanız süresiz devam eder.
                    </p>
                  </div>
                )}

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                  <input value={odemeKalemForm.not || ''} onChange={e => setOdemeKalemForm({ ...odemeKalemForm, not: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm" placeholder="Opsiyonel açıklama..." /></div>

                {/* ==============================================================
                    YENİ (kullanıcı talebi): IBAN BİLGİLERİ (çoklu)
                    ==============================================================
                    Bir ödemeye birden çok IBAN eklenebilir. Her satırda hesap
                    sahibinin ADI ve IBAN NUMARASI AYRI kutulardadır; ikisi de
                    ödeme sırasında tek tıkla ayrı ayrı kopyalanabilir. Tür
                    (Şahsi / Resmi) seçimi, ödemenin nereye gittiğini ayırt eder
                    — ör. kira şahsi IBAN'a, fatura resmi hesaba gidebilir. */}
                <div className="border-t border-neutral-200 pt-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-black text-neutral-700 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-orange-600" /> IBAN Bilgileri
                      <span className="text-[10px] font-bold text-neutral-400">({(odemeKalemForm.ibanlar || []).length} kayıt)</span>
                    </label>
                    <button type="button" onClick={ibanSatirEkle}
                      className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black rounded-lg transition flex items-center gap-1">
                      <PlusCircle className="w-3 h-3" /> IBAN Ekle
                    </button>
                  </div>

                  {(odemeKalemForm.ibanlar || []).length === 0 && (
                    <p className="text-[11px] font-bold text-neutral-400 bg-neutral-50 border border-dashed border-neutral-300 rounded-lg p-2.5 text-center">
                      IBAN eklemek zorunlu değildir. Eklerseniz ödeme yaparken tek tıkla kopyalayabilirsiniz.
                    </p>
                  )}

                  <div className="space-y-2">
                    {(odemeKalemForm.ibanlar || []).map((s, i) => {
                      // Basit biçim kontrolü: TR + 24 rakam = 26 karakter
                      const temiz = (s.iban || '').replace(/\s+/g, '').toUpperCase();
                      const gecerli = /^TR\d{24}$/.test(temiz);
                      return (
                        <div key={s.id} className={`rounded-xl border p-2.5 space-y-2 ${s.tur === 'sahsi' ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-neutral-500">#{i + 1}</span>
                            <div className="flex items-center gap-1.5">
                              {/* ŞAHSİ / RESMİ seçimi */}
                              {[{ id: 'resmi', ad: 'Resmi' }, { id: 'sahsi', ad: 'Şahsi' }].map(t => (
                                <button key={t.id} type="button" onClick={() => ibanSatirGuncelle(s.id, 'tur', t.id)}
                                  className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                                    s.tur === t.id
                                      ? (t.id === 'sahsi' ? 'bg-amber-600 text-white' : 'bg-sky-600 text-white')
                                      : 'bg-white text-neutral-500 border border-neutral-300 hover:bg-neutral-50'}`}>
                                  {t.ad}
                                </button>
                              ))}
                              <button type="button" onClick={() => ibanSatirSil(s.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Bu IBAN'ı kaldır">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {/* İSİM ve IBAN AYRI KUTULARDA */}
                          <input value={s.isim} onChange={e => ibanSatirGuncelle(s.id, 'isim', e.target.value)}
                            placeholder="Hesap sahibinin adı (örn: Ahmet Yılmaz / Sembol Nakliyat Ltd. Şti.)"
                            className="w-full p-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white" />
                          <input value={s.iban} onChange={e => ibanSatirGuncelle(s.id, 'iban', e.target.value.toUpperCase())}
                            placeholder="TR00 0000 0000 0000 0000 0000 00"
                            className="w-full p-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono tracking-wide bg-white" />
                          {temiz.length > 0 && !gecerli && (
                            <p className="text-[10px] font-bold text-amber-700">
                              IBAN "TR" ile başlayıp 24 rakam içermeli (toplam 26 karakter). Şu an {temiz.length} karakter — yine de kaydedilir.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Canlı önizleme: kaç ödeme, ne zaman biter, toplam ne kadar */}
                {(() => {
                  const tutar = parseFloat(odemeKalemForm.tutar) || 0;
                  const adet = odemeKalemForm.tekrar === 'tek' ? 1 : (parseInt(odemeKalemForm.tekrarSayisi) || 0);
                  if (!tutar || !odemeKalemForm.ilkTarih) return null;
                  const suresiz = odemeKalemForm.tekrar !== 'tek' && adet === 0;
                  const gecici = odemeKalemBilgi({ id: '__onizleme__', odemeler: [] }, { ...odemeKalemForm, id: '__onizleme__' });
                  const son = !suresiz && gecici.plan.length > 0 ? gecici.plan[gecici.plan.length - 1].tarih : null;
                  return (
                    <div className="text-[11px] font-bold text-orange-800 bg-orange-50 rounded-lg p-2.5 border border-orange-200 space-y-0.5">
                      <div>{tekrarEtiket(odemeKalemForm.tekrar, odemeKalemForm.tekrarSayisi)}</div>
                      {suresiz
                        ? <div>Süresiz ödeme — bitiş tarihi yok, siz durdurana kadar devam eder.</div>
                        : <><div>Toplam: <b>₺{paraFmt(tutar * adet)}</b> ({adet} ödeme)</div>
                           {son && <div>Son ödeme: <b>{son.split('-').reverse().join('.')}</b></div>}</>}
                    </div>
                  );
                })()}

                <button onClick={odemeKalemiKaydet} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl transition">
                  {odemeKalemForm.id ? 'Kaydet' : 'Ödemeyi Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {vadeOdeme && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-orange-600" /> Ödeme Yap
                </h3>
                <button onClick={() => setVadeOdeme(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="font-black text-orange-900">{vadeOdeme.kalem.ad}</div>
                  <div className="text-[11px] font-bold text-orange-600">
                    {vadeOdeme.vade.no}. ödeme • Vade: {vadeOdeme.vade.tarih.split('-').reverse().join('.')}
                    {vadeOdeme.vade.gecikmis && <span className="text-red-600"> • GECİKMİŞ</span>}
                  </div>
                  {/* YENİ (kullanıcı talebi): Kaleme girilen AÇIKLAMA / NOT ödeme
                      sırasında burada görünür (ör. "ŞAHSİ İBANA GÖNDERİLMEKTEDİR.").
                      Not girilmemişse bu kutu hiç çizilmez. */}
                  {(vadeOdeme.kalem.not || '').trim() && (
                    <div className="mt-2 pt-2 border-t border-orange-200 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] font-bold text-orange-800 whitespace-pre-wrap">{vadeOdeme.kalem.not}</div>
                    </div>
                  )}
                  {/* YENİ (kullanıcı talebi): KISMİ ÖDEME DURUMU
                      Bu vadeye daha önce parça ödeme yapıldıysa ne kadar ödendiği
                      ve ne kadar kaldığı burada açıkça yazar. */}
                  {vadeOdeme.vade.kismi && (
                    <div className="mt-2 pt-2 border-t border-orange-200 grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[9px] font-black uppercase text-neutral-500">Vade Tutarı</div>
                        <div className="text-xs font-black text-neutral-700">₺{paraFmt(vadeOdeme.vade.tutar)}</div></div>
                      <div><div className="text-[9px] font-black uppercase text-emerald-600">Ödenen</div>
                        <div className="text-xs font-black text-emerald-700">₺{paraFmt(vadeOdeme.vade.odenenTutar)}</div></div>
                      <div><div className="text-[9px] font-black uppercase text-red-600">Kalan</div>
                        <div className="text-xs font-black text-red-700">₺{paraFmt(vadeOdeme.vade.kalan)}</div></div>
                    </div>
                  )}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödenen Tutar (₺) *</label>
                  <input type="number" inputMode="decimal" value={vadeOdeme.tutar}
                    onChange={e => setVadeOdeme({ ...vadeOdeme, tutar: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-lg font-black" />
                  {/* YENİ: KISMİ ÖDEME YÖNLENDİRMESİ
                      Kalanın tamamını değil bir kısmını ödüyorsanız uyarı çıkar ve
                      geriye ne kalacağı yazar. Tek tıkla "kalanın tamamı" da girilir.
                      Kalandan FAZLA yazılamaz — fazla ödeme kaydı tutarsızlık yaratır. */}
                  {(() => {
                    const kalan = vadeOdeme.vade.kalan ?? vadeOdeme.vade.tutar;
                    const girilen = parseFloat(vadeOdeme.tutar) || 0;
                    const kalacak = Math.max(0, kalan - girilen);
                    return (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => setVadeOdeme({ ...vadeOdeme, tutar: String(kalan) })}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-black text-white text-[10px] font-black rounded-lg transition">
                            Kalanın Tamamı (₺{paraFmt(kalan)})
                          </button>
                          {[0.5, 0.25].map(oran => (
                            <button key={oran} type="button" onClick={() => setVadeOdeme({ ...vadeOdeme, tutar: String(Math.round(kalan * oran * 100) / 100) })}
                              className="px-2.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-black rounded-lg transition">
                              %{oran * 100}
                            </button>
                          ))}
                        </div>
                        {girilen > kalan + 0.01 && (
                          <p className="text-[11px] font-black text-red-600">
                            Kalan tutardan fazla giremezsiniz. Bu vade için kalan: ₺{paraFmt(kalan)}
                          </p>
                        )}
                        {girilen > 0 && girilen < kalan - 0.01 && (
                          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <b>Kısmi ödeme yapıyorsunuz.</b> Bu ödemeden sonra <b>₺{paraFmt(kalacak)}</b> kalacak ve ödeme <b>tamamlanmış sayılmayacak</b> — bekleyenler listesinde kalan tutarla durmaya devam edecek.
                          </p>
                        )}
                        {girilen >= kalan - 0.01 && girilen <= kalan + 0.01 && kalan > 0 && (
                          <p className="text-[11px] font-bold text-emerald-700">
                            Bu ödemeyle vade <b>tamamen kapanacak</b> ve Ödenenler bölümüne inecek.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ==============================================================
                    YENİ (kullanıcı talebi): ÖDEME SIRASINDA IBAN KOPYALAMA
                    ==============================================================
                    Bu kaleme tanımlı IBAN'lar burada listelenir. İsim ve numara
                    ayrı kutulardadır, her biri kendi düğmesiyle tek tıkla
                    kopyalanır — bankacılık uygulamasına doğrudan yapıştırılır. */}
                {(vadeOdeme.kalem.ibanlar || []).length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-600 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-neutral-500" /> Ödeme Yapılacak Hesaplar
                    </label>
                    {(vadeOdeme.kalem.ibanlar || []).map(s => (
                      <div key={s.id} className={`rounded-xl border p-2.5 ${s.tur === 'sahsi' ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full text-white ${s.tur === 'sahsi' ? 'bg-amber-600' : 'bg-sky-600'}`}>
                            {s.tur === 'sahsi' ? 'ŞAHSİ' : 'RESMİ'}
                          </span>
                          <span className="flex-1 min-w-0 text-xs font-black text-neutral-800 truncate">{s.isim || '(isim girilmemiş)'}</span>
                          {s.isim && (
                            <button type="button" onClick={() => panoyaKopyala(s.isim, `isim_${s.id}`)}
                              className="shrink-0 px-2 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[10px] font-black rounded-lg transition">
                              {kopyalanan === `isim_${s.id}` ? 'Kopyalandı ✓' : 'İsmi Kopyala'}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 min-w-0 text-[11px] font-mono font-bold text-neutral-700 truncate">{ibanGoster(s.iban) || '—'}</span>
                          {s.iban && (
                            <button type="button" onClick={() => panoyaKopyala(s.iban, `iban_${s.id}`)}
                              className={`shrink-0 px-2.5 py-1 text-white text-[10px] font-black rounded-lg transition ${
                                kopyalanan === `iban_${s.id}` ? 'bg-emerald-600' : (s.tur === 'sahsi' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700')}`}>
                              {kopyalanan === `iban_${s.id}` ? 'Kopyalandı ✓' : 'IBAN Kopyala'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hangi hesaptan ödendi? *</label>
                  <select value={vadeOdeme.kaynakDefterId}
                    onChange={e => setVadeOdeme({ ...vadeOdeme, kaynakDefterId: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                    <option value="">Hesap seçin...</option>
                    {/* Kredi ve Ödemeler defterleri kaynak olamaz — onlar plan defteridir */}
                    {defterler.filter(d => d.tur !== 'Kredi' && d.tur !== 'Ödemeler')
                      .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.ad} — {defterBlogu(d)} (₺{paraFmt(defterBakiye(d.id))})</option>
                      ))}
                  </select>
                  {vadeOdeme.kaynakDefterId && defterBakiye(vadeOdeme.kaynakDefterId) < (parseFloat(vadeOdeme.tutar) || 0) && (
                    <p className="text-[11px] font-bold text-amber-700 mt-1.5">Bu hesabın bakiyesi yetersiz. Ödeme yine de kaydedilir, hesap eksiye düşer.</p>
                  )}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödeme Tarihi</label>
                  <input type="date" value={vadeOdeme.tarih} onChange={e => setVadeOdeme({ ...vadeOdeme, tarih: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm" /></div>

                <button onClick={vadeOde} disabled={taksitKaydediliyor}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {taksitKaydediliyor ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {taksitOdeme && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-violet-600" /> {taksitOdeme.taksit.no}. Taksiti Öde
                </h3>
                <button onClick={() => setTaksitOdeme(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {/* Taksit özeti */}
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
                  <div className="text-2xl font-black text-violet-800">₺{paraFmt(taksitOdeme.taksit.kalan ?? taksitOdeme.taksit.tutar)}</div>
                  <div className="text-[11px] font-bold text-violet-600">
                    {/* DEĞİŞTİ: Defter adı yerine ÖDENEN KREDİNİN adı — bir
                        defterde birden çok kredi olduğu için hangisi olduğu
                        belli olmalı. */}
                    {taksitOdeme.kalem?.ad || taksitOdeme.kalem?.bankaAdi || seciliDefter.ad} • Vade: {taksitOdeme.taksit.tarih.split('-').reverse().join('.')}
                    {taksitOdeme.taksit.gecikmis && <span className="text-red-600"> • GECİKMİŞ</span>}
                  </div>
                  {/* YENİ: Bu taksite daha önce parça ödeme yapıldıysa dökümü */}
                  {taksitOdeme.taksit.kismi && (
                    <div className="mt-2 pt-2 border-t border-violet-200 grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[9px] font-black uppercase text-neutral-500">Taksit</div>
                        <div className="text-xs font-black text-neutral-700">₺{paraFmt(taksitOdeme.taksit.tutar)}</div></div>
                      <div><div className="text-[9px] font-black uppercase text-emerald-600">Ödenen</div>
                        <div className="text-xs font-black text-emerald-700">₺{paraFmt(taksitOdeme.taksit.odenenTutar)}</div></div>
                      <div><div className="text-[9px] font-black uppercase text-red-600">Kalan</div>
                        <div className="text-xs font-black text-red-700">₺{paraFmt(taksitOdeme.taksit.kalan)}</div></div>
                    </div>
                  )}
                </div>

                {/* YENİ (kullanıcı talebi): KISMİ ÖDEME TUTARI
                    Taksitin tamamını değil bir kısmını ödeyebilirsiniz (ör. bir
                    kısmı nakit, bir kısmı bankadan). Taksit ancak toplam tutara
                    ulaşınca kapanır. */}
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödenen Tutar (₺) *</label>
                  <input type="number" inputMode="decimal"
                    value={taksitOdeme.tutar ?? String(taksitOdeme.taksit.kalan ?? taksitOdeme.taksit.tutar)}
                    onChange={e => setTaksitOdeme({ ...taksitOdeme, tutar: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-lg font-black" />
                  {(() => {
                    const kalan = taksitOdeme.taksit.kalan ?? taksitOdeme.taksit.tutar;
                    const girilen = parseFloat(taksitOdeme.tutar ?? kalan) || 0;
                    const kalacak = Math.max(0, kalan - girilen);
                    return (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => setTaksitOdeme({ ...taksitOdeme, tutar: String(kalan) })}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-black text-white text-[10px] font-black rounded-lg transition">
                            Kalanın Tamamı (₺{paraFmt(kalan)})
                          </button>
                          {[0.5, 0.25].map(oran => (
                            <button key={oran} type="button" onClick={() => setTaksitOdeme({ ...taksitOdeme, tutar: String(Math.round(kalan * oran * 100) / 100) })}
                              className="px-2.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-black rounded-lg transition">
                              %{oran * 100}
                            </button>
                          ))}
                        </div>
                        {girilen > kalan + 0.01 && (
                          <p className="text-[11px] font-black text-red-600">Kalan tutardan fazla giremezsiniz. Kalan: ₺{paraFmt(kalan)}</p>
                        )}
                        {girilen > 0 && girilen < kalan - 0.01 && (
                          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <b>Kısmi ödeme yapıyorsunuz.</b> Bu ödemeden sonra <b>₺{paraFmt(kalacak)}</b> kalacak ve taksit <b>kapanmayacak</b> — kalan tutarla bekleyenlerde durmaya devam edecek.
                          </p>
                        )}
                        {girilen >= kalan - 0.01 && girilen <= kalan + 0.01 && kalan > 0 && (
                          <p className="text-[11px] font-bold text-emerald-700">Bu ödemeyle taksit <b>tamamen kapanacak</b>.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hangi hesaptan ödendi? *</label>
                  <select value={taksitOdeme.kaynakDefterId}
                    onChange={e => setTaksitOdeme({ ...taksitOdeme, kaynakDefterId: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-violet-500 text-sm">
                    <option value="">Hesap seçin...</option>
                    {/* Kredi defterleri listeye alınmaz — krediyle kredi ödenmez */}
                    {defterler.filter(d => d.tur !== 'Kredi')
                      .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.ad} — {defterBlogu(d)} (₺{paraFmt(defterBakiye(d.id))})</option>
                      ))}
                  </select>
                  {/* Bakiye yetersizse uyar, ama engelleme */}
                  {taksitOdeme.kaynakDefterId && defterBakiye(taksitOdeme.kaynakDefterId) < taksitOdeme.taksit.tutar && (
                    <p className="text-[11px] font-bold text-amber-700 mt-1.5">
                      Bu hesabın bakiyesi taksitten düşük. Ödeme yine de kaydedilir, hesap eksiye düşer.
                    </p>
                  )}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödeme Tarihi</label>
                  <input type="date" value={taksitOdeme.tarih}
                    onChange={e => setTaksitOdeme({ ...taksitOdeme, tarih: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm" /></div>

                <p className="text-[11px] font-medium text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                  Onayladığınızda seçtiğiniz hesaptan <b>₺{paraFmt(parseFloat(taksitOdeme.tutar ?? (taksitOdeme.taksit.kalan ?? taksitOdeme.taksit.tutar)) || 0)} çıkış</b> yazılır ve kredinin kalan borcu aynı tutarda azalır. Bu hareket ciro toplamlarında <b>çift sayılmaz</b>.
                </p>

                <button onClick={taksitOde} disabled={taksitKaydediliyor}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-300 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {taksitKaydediliyor ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Sabit alt buton çubuğunun son kayıtları örtmemesi için boşluk.
            Mobilde çubuk daha yüksek durduğu için pay biraz fazla bırakıldı. */}
        <div className="h-24 sm:h-20"></div>

        {/* ==================================================================
            GELİR / GİDER / TRANSFER — sayfanın altında sabit buton çubuğu
            ==================================================================
            DEĞİŞTİ (kullanıcı talebi):
              • "ALDIM" -> GELİR, "VERDİM" -> GİDER
              • Sıra: GELİR → GİDER → TRANSFER (önce para girişi)
              • Çubuk sayfaya tam ortalandı (left-1/2 + -translate-x-1/2 zaten
                vardı; max-w genişletilip mobilde kenar boşlukları dengelendi)
            MOBİL: Dar ekranda üç buton yan yana sığmadığı için yazılar
            küçülür, Transfer'in metni gizlenip yalnız simge kalır ve dokunma
            yüksekliği korunur (py-3.5). Güvenli alan (iPhone alt çubuğu) için
            pb-[env(safe-area-inset-bottom)] eklendi. */}
        {/* ==================================================================
            DEĞİŞTİ (kullanıcı talebi): BORÇLU DEFTERİNDE İŞLEM ÇUBUĞU YOK
            ------------------------------------------------------------------
            "Tahsil Bekleyen" (Borçlu) defterinde gelir/gider/transfer kaydı
            tutulmaz; kalemler defterin "alacaklar" dizisinde durur ve yalnızca
            "Yeni Borçlu" ile eklenir, tahsilat da "Tahsil Et" ile yapılır.
            Bu yüzden alttaki GELİR / GİDER / TRANSFER çubuğu bu defterde
            gizlenir — yanlışlıkla buraya serbest işlem girilmesi önlenir.
            'Diğer', Borçlu türünün eski (geriye uyumlu) adıdır, o da dahildir.
            Ödemeler defterindeki mevcut gizleme kuralı AYNEN korunmuştur.
            ================================================================== */}
        {seciliDefter.tur !== 'Ödemeler' && seciliDefter.tur !== 'Borçlu' && seciliDefter.tur !== 'Diğer' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* ==============================================================
              YENİ (kullanıcı talebi): MOBİL HIZLI KAYIT ÇUBUĞU
              ==============================================================
              Telefonda banka uygulaması gibi: üstte tutar + KAYDET, altta
              GİDER / GELİR / TRANSFER sekmeleri ve tam formu açan simge.
              Masaüstünde eski üç büyük buton aynen kalır (aşağıda). */}
          <div className="sm:hidden mx-auto w-full max-w-xl px-3 pointer-events-auto">
            <div className={`rounded-2xl shadow-2xl border overflow-hidden ${hizliTip === 'giris' ? 'bg-emerald-700 border-emerald-500 shadow-emerald-700/40' : hizliTip === 'virman' ? 'bg-slate-800 border-slate-600 shadow-slate-800/40' : 'bg-red-700 border-red-500 shadow-red-700/40'}`}>
              {/* YENİ (kullanıcı talebi): RAKAM YAZILINCA AÇILAN SATIR
                  Tutar kutusuna bir şey yazıldığı anda üstte Not (açıklama) ve
                  Kategori seçimi YAN YANA belirir; kutu boşalınca kaybolur. */}
              {hizliTutar.trim() !== '' && (
                <div className="flex items-center gap-2 p-2 pb-0 animate-in fade-in slide-in-from-bottom-1">
                  <input value={hizliAciklama} onChange={e => setHizliAciklama(e.target.value)}
                    placeholder="Not (açıklama)"
                    className="flex-1 min-w-0 p-2 rounded-lg bg-black/25 text-white placeholder-white/45 text-sm font-bold outline-none focus:ring-2 focus:ring-white/40" />
                  {/* DEĞİŞTİ (kullanıcı talebi): Native select yerine PENCERE açan
                      buton — masaüstündeki gibi ana kategoriler ve alt kategoriler
                      tıklanabilir görünür. */}
                  <button type="button" onClick={() => setHizliKatSecici(true)}
                    className="shrink-0 w-[38%] p-2 rounded-lg bg-black/25 text-white text-sm font-bold outline-none focus:ring-2 focus:ring-white/40 flex items-center justify-between gap-1">
                    <span className="truncate">{hizliKategori || 'Kategori'}</span>
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 p-2">
                <input ref={hizliTutarInputRef} type="number" inputMode="decimal" value={hizliTutar}
                  onChange={e => setHizliTutar(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') hizliKaydet(); }}
                  placeholder={hizliTip === 'giris' ? 'Gelir tutarı (₺)' : hizliTip === 'virman' ? 'Transfer tutarı (₺)' : 'Gider tutarı (₺)'}
                  className="flex-1 min-w-0 p-2.5 rounded-xl bg-black/25 text-white placeholder-white/50 font-black text-base outline-none focus:ring-2 focus:ring-white/40" />
                <button type="button" onClick={hizliKaydet} disabled={hizliKaydediliyor}
                  className="shrink-0 px-4 py-2.5 bg-white/95 hover:bg-white text-black text-sm font-black rounded-xl transition disabled:opacity-60">
                  {hizliKaydediliyor ? '...' : 'KAYDET'}
                </button>
              </div>
              <div className="flex items-stretch border-t border-white/15">
                {[
                  { id: 'cikis', ad: 'GİDER' },
                  { id: 'giris', ad: 'GELİR' },
                  { id: 'virman', ad: 'TRANSFER' },
                ].map(t => (
                  <button key={t.id} type="button" onClick={() => setHizliTip(t.id)}
                    className={`flex-1 py-2.5 text-[11px] font-black transition ${hizliTip === t.id ? 'bg-white/20 text-white' : 'text-white/55 hover:text-white'}`}>
                    {t.ad}
                  </button>
                ))}
                {/* Ayrıntılı kayıt gerekiyorsa tam form (kategori, etiket, not...) */}
                <button type="button" title="Ayrıntılı işlem formu"
                  onClick={() => { setIslemForm({ ...emptyIslem, tip: hizliTip === 'virman' ? 'cikis' : hizliTip, tutar: hizliTutar, tarih: gunFiltreAktif ? seciliGun : bugunStr() }); setEditingIslemId(null); setShowIslemForm(true); }}
                  className="shrink-0 px-3.5 text-white/70 hover:text-white transition border-l border-white/15">
                  <ClipboardList className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          {/* MASAÜSTÜ: eski üç büyük buton (mobilde gizli) */}
          <div className="hidden sm:flex mx-auto w-full max-w-xl px-3 gap-2 sm:gap-3 pointer-events-auto">
            {/* DEĞİŞİKLİK: Yeni işlemin tarihi, ekranda BAKILAN güne ayarlanır.
                Geçmiş bir güne bakarken kayıt eklendiğinde bugüne yazılsaydı,
                kayıt anında listeden kaybolur ve kullanıcı eklenmedi sanardı.
                Tüm Zamanlar modunda bugüne yazılır. */}
            <button onClick={() => { setIslemForm({ ...emptyIslem, tip: 'giris', tarih: gunFiltreAktif ? seciliGun : bugunStr() }); setEditingIslemId(null); setShowIslemForm(true); }}
              className="flex-1 min-w-0 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl shadow-2xl shadow-emerald-600/40 transition flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              <ArrowDownRight className="w-5 h-5 shrink-0" /> <span className="truncate">GELİR</span>
            </button>
            <button onClick={() => { setIslemForm({ ...emptyIslem, tip: 'cikis', tarih: gunFiltreAktif ? seciliGun : bugunStr() }); setEditingIslemId(null); setShowIslemForm(true); }}
              className="flex-1 min-w-0 py-3.5 sm:py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black rounded-2xl shadow-2xl shadow-red-600/40 transition flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              <ArrowUpRight className="w-5 h-5 shrink-0" /> <span className="truncate">GİDER</span>
            </button>
            {/* TRANSFER (VİRMAN): nötr lacivert — yeşil/kırmızı gelir-gideri
                işaret ettiği için transfer o renklerden uzak durmalı.
                Dar ekranda yalnız simge görünür, geniş ekranda metin de çıkar. */}
            <button onClick={() => { setVirmanForm({ hedefDefterId: '', tutar: '', aciklama: '' }); setShowVirmanForm(true); }}
              title="Hesaplar arası transfer"
              className="shrink-0 px-4 py-3.5 sm:py-4 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-black rounded-2xl shadow-2xl shadow-slate-800/40 transition flex items-center justify-center gap-2 text-sm sm:text-base">
              <ArrowRightLeft className="w-5 h-5 shrink-0" /> <span className="hidden sm:inline">Transfer</span>
            </button>
          </div>
        </div>
        )}

        {/* İŞLEM EKLE/DÜZENLE PENCERESİ */}
        {/* ==================================================================
            YENİ (kullanıcı talebi): YENİ BORÇLU / BORÇLUYU DÜZENLE PENCERESİ
            ================================================================== */}
        {alacakForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2">
                  <UserMinus className="w-5 h-5 text-rose-600" /> {alacakForm.id ? 'Borçluyu Düzenle' : 'Yeni Borçlu'}
                </h3>
                <button onClick={() => setAlacakForm(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {/* ÜÇ BORÇLU TÜRÜ: Personel / Müşteri / Kurum */}
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Borçlu Türü *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALACAK_TURLERI.map(t => (
                      <button key={t.id} type="button" onClick={() => { setAlacakForm({ ...alacakForm, tur: t.id }); setBorcluAramaP(''); setBorcluAramaM(''); }}
                        className={`p-2.5 rounded-xl text-xs font-black transition border ${
                          alacakForm.tur === t.id ? `${t.rozet} text-white border-transparent` : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'}`}>
                        {t.ad}
                      </button>
                    ))}
                  </div></div>

                {/* YENİ (kullanıcı talebi): PERSONEL SEÇME ARAMASI
                    Tür "Personel" iken isim serbest yazılmaz; listeden aranıp
                    seçilir, seçilince ad kutusuna otomatik yazılır. */}
                {alacakForm.tur === 'personel' && !alacakForm.id && (
                  <div>
                    <label className="text-xs font-bold text-neutral-600 block mb-1">Personel Ara ve Seç</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input value={borcluAramaP} onChange={e => setBorcluAramaP(e.target.value)}
                        placeholder="Personel adı yazın..."
                        className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    {borcluAramaP.trim().length >= 1 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                        {(personnelList || [])
                          .filter(p => p.position !== 'Firma Sahibi' && (p.fullName || p.name || '').toLocaleLowerCase('tr-TR').includes(borcluAramaP.toLocaleLowerCase('tr-TR')))
                          .slice(0, 20)
                          .map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { setAlacakForm({ ...alacakForm, ad: p.fullName || p.name }); setBorcluAramaP(''); }}
                              className="w-full text-left px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-purple-50 flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-purple-600" /> {p.fullName || p.name}
                              <span className="text-[10px] font-medium text-neutral-400">{p.position}</span>
                            </button>
                          ))}
                        {(personnelList || []).filter(p => p.position !== 'Firma Sahibi' && (p.fullName || p.name || '').toLocaleLowerCase('tr-TR').includes(borcluAramaP.toLocaleLowerCase('tr-TR'))).length === 0 && (
                          <div className="px-3 py-2 text-xs font-bold text-neutral-400">Personel bulunamadı.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* YENİ (kullanıcı talebi): MÜŞTERİ (CARİ) SEÇME ARAMASI */}
                {alacakForm.tur === 'musteri' && !alacakForm.id && (
                  <div>
                    <label className="text-xs font-bold text-neutral-600 block mb-1">Müşteri (Cari) Ara ve Seç</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input value={borcluAramaM} onChange={e => setBorcluAramaM(e.target.value)}
                        placeholder="Müşteri adı veya telefon yazın..."
                        className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    {borcluAramaM.trim().length >= 2 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                        {(() => {
                          const kl = aramaNormalize(borcluAramaM).split(' ').filter(Boolean);
                          const qr = borcluAramaM.replace(/\D/g, '');
                          const sonuc = cariListesi.filter(c => (kl.length > 0 && kl.every(k => c.adNorm.includes(k))) || (qr.length >= 3 && c.telNorm.includes(qr))).slice(0, 20);
                          if (sonuc.length === 0) return <div className="px-3 py-2 text-xs font-bold text-neutral-400">Cari bulunamadı.</div>;
                          return sonuc.map(c => (
                            <button key={c.tel} type="button"
                              onClick={() => { setAlacakForm({ ...alacakForm, ad: c.ad, not: (alacakForm.not || '') || `Tel: ${c.tel}` }); setBorcluAramaM(''); }}
                              className="w-full text-left px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-emerald-50 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0"><User className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> <span className="truncate">{c.ad}</span></span>
                              <span className="text-[10px] font-medium text-neutral-400 shrink-0">{c.tel} • {c.isSayisi} iş</span>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Borçlu Adı *</label>
                  <input value={alacakForm.ad} onChange={e => setAlacakForm({ ...alacakForm, ad: e.target.value })}
                    placeholder="Örn: Melike Özdemir / X Lojistik Ltd. Şti."
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm" /></div>

                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Toplam Alacak (₺) *</label>
                    <input type="number" inputMode="decimal" value={alacakForm.toplamTutar}
                      onChange={e => setAlacakForm({ ...alacakForm, toplamTutar: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm font-black" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Taksit Sayısı</label>
                    <input type="number" inputMode="numeric" value={alacakForm.taksitSayisi}
                      onChange={e => setAlacakForm({ ...alacakForm, taksitSayisi: e.target.value })}
                      placeholder="Boş = peşin"
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm" /></div>
                </div>
                {parseInt(alacakForm.taksitSayisi) > 1 && parseFloat(alacakForm.toplamTutar) > 0 && (
                  <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    Aylık taksit: ₺{paraFmt(Math.round((parseFloat(alacakForm.toplamTutar) / parseInt(alacakForm.taksitSayisi)) * 100) / 100)} × {parseInt(alacakForm.taksitSayisi)} ay
                  </p>
                )}

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">İlk Vade Tarihi *</label>
                  <input type="date" value={alacakForm.ilkTarih} onChange={e => setAlacakForm({ ...alacakForm, ilkTarih: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">Taksitliyse sonraki taksitler her ay aynı güne düşer.</p></div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                  <input value={alacakForm.not || ''} onChange={e => setAlacakForm({ ...alacakForm, not: e.target.value })}
                    placeholder="Opsiyonel açıklama (iş, sözleşme, dosya no...)"
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm" /></div>

                <button onClick={alacakKaydet}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {alacakForm.id ? 'Güncelle' : 'Borçluyu Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ (kullanıcı talebi): TAHSİLAT PENCERESİ
            Paranın hangi hesaba girdiği burada seçilir; tahsilat o hesaba
            GELİR olarak yazılır ve CİROYA O ANDA EKLENİR. Kısmi tahsilat
            desteklenir — taksit ancak tamamı alınınca kapanır. */}
        {tahsilModal && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" /> Tahsilat Yap</h3>
                <button onClick={() => setTahsilModal(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="font-black text-rose-900 flex items-center gap-2 flex-wrap">
                    <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded-full ${alacakTuru(tahsilModal.kalem.tur).rozet}`}>{alacakTuru(tahsilModal.kalem.tur).ad.toUpperCase()}</span>
                    {tahsilModal.kalem.ad}
                    {tahsilModal.kalem.icra && <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5 rounded-full">İCRADA</span>}
                  </div>
                  <div className="text-[11px] font-bold text-rose-600">
                    {tahsilModal.taksit.no}. taksit • Vade: {tahsilModal.taksit.tarih.split('-').reverse().join('.')}
                    {tahsilModal.taksit.gecikmis && <span className="text-red-600"> • GECİKMİŞ</span>}
                  </div>
                  {tahsilModal.taksit.kismi && (
                    <div className="mt-2 pt-2 border-t border-rose-200 grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[9px] font-black uppercase text-neutral-500">Taksit</div>
                        <div className="text-xs font-black text-neutral-700">₺{paraFmt(tahsilModal.taksit.tutar)}</div></div>
                      <div><div className="text-[9px] font-black uppercase text-emerald-600">Alınan</div>
                        <div className="text-xs font-black text-emerald-700">₺{paraFmt(tahsilModal.taksit.odenenTutar)}</div></div>
                      <div><div className="text-[9px] font-black uppercase text-red-600">Kalan</div>
                        <div className="text-xs font-black text-red-700">₺{paraFmt(tahsilModal.taksit.kalan)}</div></div>
                    </div>
                  )}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tahsil Edilen Tutar (₺) *</label>
                  <input type="number" inputMode="decimal" value={tahsilModal.tutar}
                    onChange={e => setTahsilModal({ ...tahsilModal, tutar: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-black" />
                  {(() => {
                    const kalan = tahsilModal.taksit.kalan ?? tahsilModal.taksit.tutar;
                    const girilen = parseFloat(tahsilModal.tutar) || 0;
                    const kalacak = Math.max(0, kalan - girilen);
                    return (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => setTahsilModal({ ...tahsilModal, tutar: String(kalan) })}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-black text-white text-[10px] font-black rounded-lg transition">Kalanın Tamamı (₺{paraFmt(kalan)})</button>
                          {[0.5, 0.25].map(oran => (
                            <button key={oran} type="button" onClick={() => setTahsilModal({ ...tahsilModal, tutar: String(Math.round(kalan * oran * 100) / 100) })}
                              className="px-2.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-black rounded-lg transition">%{oran * 100}</button>
                          ))}
                        </div>
                        {girilen > kalan + 0.01 && <p className="text-[11px] font-black text-red-600">Kalan alacaktan fazla giremezsiniz. Kalan: ₺{paraFmt(kalan)}</p>}
                        {girilen > 0 && girilen < kalan - 0.01 && (
                          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <b>Kısmi tahsilat yapıyorsunuz.</b> Bu tahsilattan sonra <b>₺{paraFmt(kalacak)}</b> alacak kalacak ve taksit <b>kapanmayacak</b>.
                          </p>
                        )}
                        {girilen >= kalan - 0.01 && girilen <= kalan + 0.01 && kalan > 0 && (
                          <p className="text-[11px] font-bold text-emerald-700">Bu tahsilatla taksit <b>tamamen kapanacak</b>.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* YENİ (kullanıcı talebi): PERSONEL için MAAŞTAN KESME seçeneği.
                    Personel türü borçluda tahsilat ya bir hesaba nakit girişi ya
                    da personelin MAAŞINDAN (Kalan Nakit / Kalan Banka) kesilerek
                    yapılır. Maaştan kesince defter gelir yazılmaz; borç düşer. */}
                {tahsilModal.kalem.tur === 'personel' && (
                  <div>
                    <label className="text-xs font-bold text-neutral-600 block mb-1">Tahsilat Şekli *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'hesap', ad: 'Hesaba Nakit' },
                        { id: 'maas_nakit', ad: 'Maaş • Nakit' },
                        { id: 'maas_banka', ad: 'Maaş • Banka' },
                      ].map(y => (
                        <button key={y.id} type="button" onClick={() => setTahsilModal({ ...tahsilModal, tahsilSekli: y.id })}
                          className={`p-2 rounded-xl text-[11px] font-black transition border ${
                            (tahsilModal.tahsilSekli || 'hesap') === y.id ? 'bg-purple-600 text-white border-transparent' : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'}`}>
                          {y.ad}
                        </button>
                      ))}
                    </div>
                    {(tahsilModal.tahsilSekli || 'hesap').startsWith('maas') && (
                      <p className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg p-2 mt-1.5">
                        Bu tutar personelin <b>{tahsilModal.tahsilSekli === 'maas_banka' ? 'Kalan Banka' : 'Kalan Nakit'}</b> maaşından kesilecek. Kasaya para girişi olmaz; yalnızca borç düşer ve maaş kesintisi işlenir.
                      </p>
                    )}
                  </div>
                )}

                {/* PARANIN GİRDİĞİ HESAP — maaştan kesmede gizlenir */}
                {(tahsilModal.kalem.tur !== 'personel' || (tahsilModal.tahsilSekli || 'hesap') === 'hesap') && (
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Para hangi hesaba girdi? *</label>
                  <select value={tahsilModal.hedefDefterId}
                    onChange={e => setTahsilModal({ ...tahsilModal, hedefDefterId: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white">
                    <option value="">Hesap seçin...</option>
                    {defterler.filter(d => d.tur !== 'Borçlu' && d.tur !== 'Ödemeler' && d.tur !== 'Kredi').map(d => (
                      <option key={d.id} value={d.id}>{d.ad} — {d.blok || 'Genel'} (₺{paraFmt(defterBakiye(d.id))})</option>
                    ))}
                  </select></div>
                )}

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tahsilat Tarihi</label>
                  <input type="date" value={tahsilModal.tarih} onChange={e => setTahsilModal({ ...tahsilModal, tarih: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" /></div>

                <p className="text-[11px] font-medium text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                  Onayladığınızda seçtiğiniz hesaba <b>₺{paraFmt(parseFloat(tahsilModal.tutar) || 0)}</b> girer ve hesap bakiyesi artar; borçlunun alacağı aynı tutarda azalır. Bu tutar <b>ciroya (Nakliye/Depoevim gelirlerine) eklenmez</b> — ilgili iş tamamlandığında ciroya zaten yazılmıştı, bu yalnızca alacağın tahsilidir.
                </p>

                <button onClick={alacakTahsilEt} disabled={tahsilKaydediliyor}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {tahsilKaydediliyor ? 'Kaydediliyor...' : 'Tahsilatı Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ (kullanıcı talebi): AVANS ÖDEME PENCERESİ
            Varsayılan hesap: Nakit avans -> Sembol Nakliyat NAKİT defteri,
            Resmi avans -> Sembol Nakliyat BANKA defteri. Duruma göre başka
            hesap da seçilebilir. */}
        {avansOdeModal && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><Banknote className="w-5 h-5 text-amber-600" /> Avans Ödemesi</h3>
                <button onClick={() => setAvansOdeModal(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="font-black text-amber-900">{avansOdeModal.satir.ad}</div>
                  <div className="text-[11px] font-bold text-amber-600">{avansOdeModal.satir.kaynakEtiket} • Vade: {avansOdeModal.satir.vadeTarihi.split('-').reverse().join('.')}</div>
                  <div className="text-2xl font-black text-amber-800 mt-1">₺{paraFmt(avansOdeModal.satir.tutar)}</div>
                  <div className="text-[10px] font-bold text-neutral-500">{avansOdeModal.satir.kisiler.filter(k => k.tutar > 0).length} personelin avans toplamı — muhasebeden otomatik</div>
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hangi hesaptan ödendi? *</label>
                  <select value={avansOdeModal.kaynakDefterId}
                    onChange={e => setAvansOdeModal({ ...avansOdeModal, kaynakDefterId: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white">
                    <option value="">Hesap seçin...</option>
                    {defterler.filter(d => d.tur !== 'Borçlu' && d.tur !== 'Ödemeler' && d.tur !== 'Kredi').map(d => (
                      <option key={d.id} value={d.id}>{d.ad} — {d.blok || 'Genel'} (₺{paraFmt(defterBakiye(d.id))})</option>
                    ))}
                  </select>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">
                    Varsayılan: {avansOdeModal.satir.kanal === 'nakit' ? 'Sembol Nakliyat NAKİT defteri' : 'Sembol Nakliyat BANKA defteri'} — duruma göre değiştirebilirsiniz.
                  </p></div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödeme Tarihi</label>
                  <input type="date" value={avansOdeModal.tarih} onChange={e => setAvansOdeModal({ ...avansOdeModal, tarih: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm" /></div>

                <p className="text-[11px] font-medium text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                  Onayladığınızda seçilen hesaptan <b>₺{paraFmt(avansOdeModal.satir.tutar)} çıkış</b> yazılır; satır Ödenenler bölümüne iner. Bu hareket ciroda <b>çift sayılmaz</b>.
                </p>

                <button onClick={avansOde} disabled={avansOdeKaydediliyor}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {avansOdeKaydediliyor ? 'Kaydediliyor...' : 'Avansı Öde'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ (kullanıcı talebi): TOPLU AVANS GİR (ÖDEMELER SAYFASI)
            Personel Ödemeleri'ndeki pencerenin aynısı: kanal (Nakit/Resmi) ve
            yaka (Mavi/Beyaz) sekmeleri, arama, toplu tutar uygulama, kişiye
            özel tutar. Kaydedilen değer muhasebe dokümanına yazılır ve satır
            toplamı anında güncellenir. */}
        {avansTopluModal && (() => {
          const m2 = avansTopluModal;
          const alanEtiket = m2.kanal === 'resmi' ? 'Resmi Avans' : 'Nakit Avans';
          const kisiler = (personnelList || [])
            .filter(p => p.position !== 'Firma Sahibi' && YAKA_FILTRELERI[m2.yaka](p))
            .filter(p => !m2.arama.trim() || (p.fullName || p.name || '').toLocaleLowerCase('tr-TR').includes(m2.arama.toLocaleLowerCase('tr-TR')))
            .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '', 'tr'));
          const tumu = kisiler.length > 0 && kisiler.every(p => m2.secim.includes(p.id));
          const seciliToplam = m2.secim.reduce((t, id) => t + (parseFloat(m2.tutarlar[id]) || 0), 0);
          const [ty, ta] = odemeAyi.split('-').map(Number);
          return (
            <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 shrink-0">
                  <div>
                    <h3 className="font-black text-black flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-600" /> Toplu Avans Gir</h3>
                    <p className="text-[11px] font-bold text-neutral-400">{m2.yaka === 'beyaz' ? 'Beyaz Yaka' : 'Mavi Yaka'} • {AY_ADLARI[ta - 1]} {ty} • {alanEtiket}</p>
                  </div>
                  <button onClick={() => setAvansTopluModal(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 space-y-2.5 shrink-0">
                  {/* KANAL + YAKA SEKMELERİ */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl">
                      {[{ id: 'nakit', ad: 'Nakit Avans' }, { id: 'resmi', ad: 'Resmi Avans' }].map(k => (
                        <button key={k.id} type="button" onClick={() => avansTopluKanalDegistir(k.id)}
                          className={`py-1.5 text-[11px] font-black rounded-lg transition ${m2.kanal === k.id ? 'bg-amber-600 text-white' : 'text-neutral-500 hover:text-black'}`}>{k.ad}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl">
                      {[{ id: 'mavi', ad: 'Mavi Yaka' }, { id: 'beyaz', ad: 'Beyaz Yaka' }].map(y => (
                        <button key={y.id} type="button" onClick={() => avansTopluYakaDegistir(y.id)}
                          className={`py-1.5 text-[11px] font-black rounded-lg transition ${m2.yaka === y.id ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-black'}`}>{y.ad}</button>
                      ))}
                    </div>
                  </div>
                  {/* TOPLU TUTAR + ARAMA */}
                  <div className="flex gap-2">
                    <input type="number" inputMode="decimal" value={m2.toplu}
                      onChange={e => setAvansTopluModal({ ...m2, toplu: e.target.value })}
                      placeholder="Seçili personele uygulanacak tutar (₺)"
                      className="flex-1 min-w-0 p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    <button type="button"
                      onClick={() => {
                        const deger = parseFloat(m2.toplu);
                        if (!(deger >= 0)) { alert('Geçerli bir tutar girin.'); return; }
                        const tutarlar = { ...m2.tutarlar };
                        m2.secim.forEach(id => { tutarlar[id] = deger > 0 ? String(deger) : ''; });
                        setAvansTopluModal({ ...m2, tutarlar });
                      }}
                      className="shrink-0 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition">
                      Seçililere Uygula ({m2.secim.length})
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={m2.arama} onChange={e => setAvansTopluModal({ ...m2, arama: e.target.value })}
                      placeholder="Personel adı ile ara..."
                      className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {/* PERSONEL LİSTESİ */}
                <div className="flex-1 overflow-y-auto px-4">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-2 py-2 text-[10px] font-black uppercase text-neutral-400 border-b border-neutral-200 sticky top-0 bg-white">
                    <input type="checkbox" checked={tumu}
                      onChange={() => setAvansTopluModal({ ...m2, secim: tumu ? m2.secim.filter(id => !kisiler.some(p => p.id === id)) : [...new Set([...m2.secim, ...kisiler.map(p => p.id)])] })}
                      className="w-4 h-4 accent-blue-600" />
                    <span>Personel Adı</span><span className="text-right w-24">Mevcut Avans</span><span className="text-right w-28">Yeni Avans (₺)</span>
                  </div>
                  {kisiler.map(p2 => {
                    const alan = m2.kanal === 'resmi' ? 'bekleyenResmiAvans' : 'bekleyenNakitAvans';
                    const mevcut = parseFloat((avansVeri?.[m2.yaka]?.[p2.id] || {})[alan]) || 0;
                    const secili = m2.secim.includes(p2.id);
                    return (
                      <div key={p2.id} className={`grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-2 py-2 border-b border-neutral-100 ${secili ? 'bg-blue-50/50' : ''}`}>
                        <input type="checkbox" checked={secili}
                          onChange={() => setAvansTopluModal({ ...m2, secim: secili ? m2.secim.filter(id => id !== p2.id) : [...m2.secim, p2.id] })}
                          className="w-4 h-4 accent-blue-600" />
                        <span className="text-sm font-bold text-neutral-800 truncate">
                          {p2.fullName || p2.name}
                          {mevcut > 0 && <span className="ml-1.5 text-[8px] font-black bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded">MEVCUT AVANS</span>}
                        </span>
                        <span className="text-right w-24 text-xs font-bold text-neutral-500 tabular-nums">{mevcut > 0 ? `₺${paraFmt(mevcut)}` : '—'}</span>
                        <input type="number" inputMode="decimal" value={m2.tutarlar[p2.id] ?? ''}
                          onChange={e => {
                            const tutarlar = { ...m2.tutarlar, [p2.id]: e.target.value };
                            // Tutar yazılınca kişi kendiliğinden seçilir
                            const secim = e.target.value && !secili ? [...m2.secim, p2.id] : m2.secim;
                            setAvansTopluModal({ ...m2, tutarlar, secim });
                          }}
                          placeholder="0"
                          className="w-28 p-2 border border-neutral-300 rounded-lg text-right text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    );
                  })}
                  {kisiler.length === 0 && <p className="text-center text-xs font-bold text-neutral-400 py-6">Personel bulunamadı.</p>}
                </div>

                <div className="flex items-center justify-between gap-2 p-4 border-t border-neutral-200 shrink-0 flex-wrap">
                  <span className="text-xs font-black text-neutral-600">{m2.secim.length} personel seçili • Toplam: <span className="text-blue-700">₺{paraFmt(seciliToplam)}</span></span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAvansTopluModal(null)}
                      className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-black rounded-xl transition">Vazgeç</button>
                    <button type="button" onClick={avansTopluKaydet} disabled={avansTopluKaydediliyor}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition">
                      {avansTopluKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {showIslemForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 my-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-black flex items-center gap-2 ${islemForm.tip === 'giris' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {islemForm.tip === 'giris' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  {editingIslemId ? 'İşlemi Düzenle' : islemForm.tip === 'giris' ? 'GELİR EKLE' : 'GİDER EKLE'}
                </h3>
                <button onClick={() => setShowIslemForm(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {/* Giriş/Çıkış değiştirme (düzenlemede de kullanılabilir) */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setIslemForm({ ...islemForm, tip: 'giris' })} className={`py-2.5 rounded-xl font-black text-sm border-2 transition ${islemForm.tip === 'giris' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>GELİR</button>
                  <button onClick={() => setIslemForm({ ...islemForm, tip: 'cikis' })} className={`py-2.5 rounded-xl font-black text-sm border-2 transition ${islemForm.tip === 'cikis' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-red-400'}`}>GİDER</button>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tutar (₺) *</label>
                  <input type="number" inputMode="decimal" value={islemForm.tutar} onChange={e => setIslemForm({ ...islemForm, tutar: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-lg font-black" placeholder="0,00" autoFocus /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tarih</label>
                    <input type="date" value={islemForm.tarih} onChange={e => setIslemForm({ ...islemForm, tarih: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" /></div>
                  {/* ==============================================================
                      DEĞİŞTİ: "Ödeme Yöntemi" -> "Hesap Türü"
                      ==============================================================
                      ESKİ HALİ: Sabit bir liste (Nakit / Banka-Havale / Kredi Kartı /
                      Çek-Senet / Diğer) seçtiriyordu. Bu liste yalnızca bir ETİKETTİ;
                      işlemin hangi defterde durduğuyla ilgisi yoktu ve işlem yanlış
                      deftere kaydedilmişse düzeltmenin yolu yoktu.

                      YENİ HALİ: Seçenekler artık Defter ekranındaki GERÇEK HESAPLARDIR
                      (NAKLİYE (NAKİT), NAKLİYE (GARANTİ BANK), DEPO (ALBARAKA BANK)…).
                      Buradan başka bir hesap seçilirse işlem kaydedilirken O DEFTERE
                      TAŞINIR — yani yanlış deftere düşmüş bir kayıt tek hamlede
                      doğru hesaba alınır.

                      GERİYE UYUM: Kayıttaki odemeYontemi alanı silinmedi; seçilen
                      defterin türünden otomatik türetilip yazılmaya devam eder
                      (Banka -> "Banka / Havale" gibi). Böylece işlem listesindeki
                      mavi rozet ve eski kayıtların araması bozulmaz.
                      ============================================================== */}
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hesap Türü</label>
                    <select value={islemForm.hedefDefterId || seciliDefterId || ''}
                      onChange={e => setIslemForm({ ...islemForm, hedefDefterId: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      {/* ==========================================================
                          YENİ (kullanıcı talebi): Hesaplar artık düz liste değil,
                          ana Defterler ekranındaki gibi BLOKLARA göre gruplanmış
                          gösteriliyor. <optgroup label="..."> kullanılır; tarayıcı
                          bunu açılır listede AYIRICI BAŞLIK olarak gösterir, böylece
                          blok adı (Sembol Nakliyat / Depoevim / Genel) görünür olur.
                          Bloklar DEFTER_BLOKLARI sırasıyla (Sembol Nakliyat > Depoevim
                          > Genel) listelenir; blok içi sıralama eskisi gibi isme göre
                          alfabetiktir. Boş bloklar hiç çizilmez.
                          ========================================================== */}
                      {DEFTER_BLOKLARI.map(blokAdi => {
                        const blokDefterleri = defterler
                          .filter(d => defterBlogu(d) === blokAdi)
                          .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
                        if (blokDefterleri.length === 0) return null; // Boş blok gösterilmez
                        return (
                          <optgroup key={blokAdi} label={blokAdi}>
                            {blokDefterleri.map(d => (
                              <option key={d.id} value={d.id}>{d.ad} — {defterTuruEtiket(d.tur)}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    {/* Başka hesap seçildiyse taşınacağı açıkça belirtilir */}
                    {islemForm.hedefDefterId && islemForm.hedefDefterId !== seciliDefterId && (
                      <p className="text-[11px] font-bold text-amber-700 mt-1.5">
                        Bu işlem kaydedildiğinde <b>{defterler.find(d => d.id === islemForm.hedefDefterId)?.ad}</b> hesabına taşınacak.
                      </p>
                    )}
                  </div>
                </div>
                {/* DEĞİŞİKLİK: Eski sabit kategori listesi (İş Geliri, Tahsilat, ...)
                    KALDIRILDI. Kategori artık hazır etiket ağacından seçilir; eski
                    "Etiketler" alanı da kaldırıldı çünkü ikisi tek kavramda birleşti.
                    NOT: Kayıtlardaki "etiketler" alanı veritabanında duruyor; eski
                    kayıtların araması bozulmaz, yalnızca formdan girişi kalktı. */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">Kategori</label>
                  <div className="flex items-stretch gap-2">
                    {/* Seçili kategori kutusu — tıklayınca seçim penceresi açılır */}
                    <button type="button" onClick={() => { setShowEtiketSecici(true); setEtiketArama(''); }}
                      className={`flex-1 min-w-0 p-2.5 border rounded-xl text-sm text-left transition flex items-center justify-between gap-2 ${
                        islemForm.kategori ? 'border-neutral-300 bg-white text-black font-bold' : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 font-bold'
                      }`}>
                      <span className="truncate">{islemForm.kategori || 'Kategori seçin...'}</span>
                      <ChevronDown className="w-4 h-4 shrink-0 text-neutral-400" />
                    </button>
                    {/* + YENİ KATEGORİ: pencereyi açar; en alttaki ekleme kutusuyla
                        yeni kategori yazılır, kaydedilir ve otomatik seçilir. */}
                    <button type="button" onClick={() => { setShowEtiketSecici(true); setEtiketArama(''); }}
                      title="Yeni kategori ekle"
                      className="shrink-0 w-10 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* YENİ: MÜŞTERİ (CARİ) — opsiyonel.
                    Serbest metin değil, mevcut carilerden seçilir. Böylece
                    işlem gerçek bir müşteri kaydıyla EŞLEŞİR ve satırdan
                    carisine gidilebilir. Yeni bir isim yazılmasına izin
                    verilmiyor; yoksa aynı müşteri iki farklı yazımla kaydolur. */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">
                    Müşteri / Cari <span className="text-neutral-400 font-normal">(opsiyonel)</span>
                  </label>
                  {islemForm.musteriTel || islemForm.musteriAdi ? (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <User className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-emerald-900 truncate">{islemForm.musteriAdi}</div>
                        {islemForm.musteriTel && <div className="text-[11px] font-bold text-emerald-700">{islemForm.musteriTel}</div>}
                      </div>
                      <button type="button" onClick={() => setIslemForm({ ...islemForm, musteriAdi: '', musteriTel: '' })}
                        title="Müşteri eşleşmesini kaldır"
                        className="p-1.5 rounded-lg hover:bg-emerald-100 transition shrink-0">
                        <X className="w-4 h-4 text-emerald-700" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setShowCariSecici(true); setCariArama(''); }}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-neutral-300 text-[11px] font-black text-neutral-500 hover:border-emerald-400 hover:text-emerald-700 transition flex items-center justify-center gap-1.5">
                      <Search className="w-3.5 h-3.5" /> Cari ara ve seç
                    </button>
                  )}
                </div>

                {/* YENİ: EKİP ŞEFİ / SORUMLU — opsiyonel, personel listesinden seçilir.
                    İş sonlandırmadan gelen kayıtlarda otomatik dolar; elle girilen
                    kayıtlarda buradan seçilir. Ada değil kimliğe bağlanıyor ki
                    rozetten personel profiline gidilebilsin. */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">
                    Ekip Şefi / Sorumlu <span className="text-neutral-400 font-normal">(opsiyonel)</span>
                  </label>
                  <select
                    value={islemForm.ekipSefiId || ''}
                    onChange={e => {
                      const per = (personnelList || []).find(pp => pp.id === e.target.value);
                      setIslemForm({ ...islemForm, ekipSefiId: per?.id || '', ekipSefi: per?.fullName || '' });
                    }}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                    <option value="">Seçilmedi</option>
                    {[...(personnelList || [])]
                      .filter(pp => pp.employmentStatus !== 'Pasif')
                      .sort((a, b) => (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR'))
                      .map(pp => (
                        <option key={pp.id} value={pp.id}>
                          {pp.fullName}{pp.position ? ` — ${pp.position}` : ''}
                        </option>
                      ))}
                  </select>
                  {/* Personel işten ayrılmışsa listede olmaz; kayıtlı ad yine gösterilir */}
                  {islemForm.ekipSefi && !islemForm.ekipSefiId && (
                    <p className="text-[11px] font-bold text-amber-700 mt-1.5">
                      Kayıtlı sorumlu: {islemForm.ekipSefi} — bu personel aktif listede yok.
                    </p>
                  )}
                </div>

                {/* YENİ: ARAÇ PLAKASI — opsiyonel, mevcut araçlardan seçilir.
                    Etiket listesinden değil kendi alanından; böylece plaka hem
                    araç profiline bağlanır hem etiketlerle karışmaz. */}
                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">
                    Araç Plakası <span className="text-neutral-400 font-normal">(opsiyonel)</span>
                  </label>
                  <select
                    value={islemForm.aracId || ''}
                    onChange={e => {
                      const arac = (vehicles || []).find(v => v.id === e.target.value);
                      // Hem kimlik hem plaka yazılır: kimlik profile gitmek için,
                      // plaka ise araç kaydı sonradan silinse bile bilginin kalması için.
                      setIslemForm({ ...islemForm, aracId: arac?.id || '', plaka: arac?.plate || '' });
                    }}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                    <option value="">Araç seçilmedi</option>
                    {[...(vehicles || [])]
                      .sort((a, b) => (a.plate || '').localeCompare((b.plate || ''), 'tr-TR'))
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {v.plate}{v.type ? ` — ${v.type}` : ''}
                        </option>
                      ))}
                  </select>
                  {/* Araç kaydı silinmiş eski işlemlerde plaka metni kalır, kimlik boş olur */}
                  {islemForm.plaka && !islemForm.aracId && (
                    <p className="text-[11px] font-bold text-amber-700 mt-1.5">
                      Kayıtlı plaka: {islemForm.plaka} — bu plakayla eşleşen araç listede yok.
                    </p>
                  )}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Açıklama / Not</label>
                  <textarea value={islemForm.aciklama} onChange={e => setIslemForm({ ...islemForm, aciklama: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm h-16 resize-none" placeholder="İşleme dair not..." /></div>
                <button onClick={handleSaveIslem} className={`w-full py-3.5 text-white font-black rounded-xl transition flex items-center justify-center gap-2 ${islemForm.tip === 'giris' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  <CheckCircle className="w-5 h-5" /> {editingIslemId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DEFTER DÜZENLE PENCERESİ (detaydan açılır) */}
        {showDefterForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" /> Defteri Düzenle</h3>
                <button onClick={() => setShowDefterForm(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Defter Adı *</label>
                  <input value={defterForm.ad} onChange={e => setDefterForm({ ...defterForm, ad: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" /></div>
                {/* ==============================================================
                    YENİ: BLOK SEÇİMİ (detay ekranındaki düzenleme formu)
                    ==============================================================
                    DİKKAT: Defter formu iki ayrı yerde render ediliyor —
                    biri defter LİSTESİNDE, biri defter DETAYINDA. Blok seçimi
                    önce yalnızca listedekine eklenmişti; detaydan "Düzenle"
                    denince alan görünmüyordu. Aynı alan buraya da eklendi ki
                    her iki yoldan da blok değiştirilebilsin.
                    ============================================================== */}
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Blok (Grup)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEFTER_BLOKLARI.map(b => (
                      <button key={b} type="button" onClick={() => setDefterForm({ ...defterForm, blok: b })}
                        className={`py-2 px-1 rounded-lg text-[11px] font-black border-2 transition leading-tight ${
                          defterForm.blok === b ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>
                        {b}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">Defter, seçtiğiniz bloğun altında listelenir.</p>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Defter Türü</label>
                  <select value={defterForm.tur} onChange={e => setDefterForm({ ...defterForm, tur: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                    {DEFTER_TURLERI.map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                  <input value={defterForm.not} onChange={e => setDefterForm({ ...defterForm, not: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" /></div>

                {/* ==============================================================
                    YENİ (kullanıcı talebi): DEPOEVİM CRM ENTEGRASYON PANELİ
                    ==============================================================
                    DİKKAT: Defter formu iki ayrı yerde render ediliyor — biri
                    listede, biri detay ekranında. Panel önce yalnızca listeye
                    eklenmişti; detaydan "Düzenle" ile açılan bu pencerede
                    görünmüyordu. Aynı panel buraya da eklendi. */}
                {seciliDefterId && defterForm.tur === 'Banka' && (
                  <div className="p-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl space-y-2">
                    <div className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4" /> Depoevim CRM Entegrasyonu
                    </div>
                    <p className="text-[11px] font-medium text-indigo-700">
                      Depoevim CRM tahsilatlarının bu deftere otomatik <b>GELİR</b> olarak düşmesi için aşağıdaki iki kimliği kopyalayıp Depoevim projesindeki <b>sembolKoprusu.js</b> dosyasına yapıştırın.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 p-2 bg-white rounded-lg border border-indigo-200">
                        <div className="text-[9px] font-black uppercase text-indigo-400">Defter ID (HEDEF_DEFTER_ID)</div>
                        <div className="text-[11px] font-mono font-bold text-neutral-700 truncate">{seciliDefterId}</div>
                      </div>
                      <button type="button" onClick={() => panoyaKopyala(seciliDefterId, 'entg_defter2')}
                        className="shrink-0 px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition">
                        {kopyalanan === 'entg_defter2' ? 'Kopyalandı ✓' : 'Kopyala'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 p-2 bg-white rounded-lg border border-indigo-200">
                        <div className="text-[9px] font-black uppercase text-indigo-400">Uygulama ID (SEMBOL_APP_ID)</div>
                        <div className="text-[11px] font-mono font-bold text-neutral-700 truncate">{appId}</div>
                      </div>
                      <button type="button" onClick={() => panoyaKopyala(appId, 'entg_app2')}
                        className="shrink-0 px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition">
                        {kopyalanan === 'entg_app2' ? 'Kopyalandı ✓' : 'Kopyala'}
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={handleSaveDefter} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition">Kaydet</button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ: OTOMATİK ÖDEMELER YÖNETİMİ
            ==================================================================
            Tekrarlanan kalemleri listeler; her biri için iki işlem sunar:
              • Sonlandır: seçilen tarihten sonra artık borç üretilmez
              • Tutarı Güncelle (zam): seçilen tarihten itibaren yeni tutar
            Geçmiş aylar ve yapılmış ödemeler etkilenmez.
            ================================================================== */}
        {otomatikYonetim && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><Settings className="w-5 h-5 text-orange-600" /> Otomatik Ödemeler</h3>
                <button onClick={() => { setOtomatikYonetim(false); setYonetimForm(null); }} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[11px] font-bold text-neutral-500 mb-3">
                Ödemeleri düzenleyebilir, durdurabilir, belirli bir tarihten itibaren tutarını değiştirebilir veya
                yanlış eklenmiş bir kalemi tamamen <b>silebilirsiniz</b>. Geçmiş aylar ve yapılmış ödemeler etkilenmez.
              </p>
              <div className="space-y-2">
                {/* DEĞİŞTİ (kullanıcı talebi): Liste artık TEK SEFERLİK kalemleri de
                    gösterir. Sebep: yanlış eklenen bir kalem tek seferlikse eskiden
                    bu pencerede hiç görünmüyor ve silinemiyordu. Tekrarlanmayan
                    kalemlerde "Tutarı Güncelle / Sonlandır" anlamsız olduğu için
                    gizlenir; "Düzenle" ve "Sil" her kalemde vardır. */}
                {(seciliDefter.odemeler || []).length === 0 && (
                  <div className="p-6 text-center text-xs font-bold text-neutral-400 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                    Henüz ödeme kalemi yok.
                  </div>
                )}
                {(seciliDefter.odemeler || []).map(k => {
                  const tekrarli = (k.tekrar || 'tek') !== 'tek';
                  const tur = odemeTuruBilgi(k.odemeTuru);
                  const guncelTutar = kalemTutariTarihte(k, bugunStr());
                  const duzenleniyor = yonetimForm?.kalemId === k.id;
                  return (
                    <div key={k.id} className={`rounded-xl border p-3 ${k.bitisTarihi ? 'bg-neutral-100 border-neutral-300' : tur.yumusak}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className={`font-black text-sm ${k.bitisTarihi ? 'text-neutral-500 line-through' : 'text-neutral-800'}`}>{k.ad}</div>
                          <div className="text-[10px] font-bold text-neutral-500">
                            Güncel tutar: ₺{paraFmt(guncelTutar)} • {tekrarEtiket(k.tekrar, k.tekrarSayisi)} • {tur.ad}
                          </div>
                          {/* YENİ (kullanıcı talebi): Kalemin IBAN'ları burada da
                              görünür ve kopyalanabilir — ödeme yapmadan önce
                              hesap bilgisini almak için pencere değiştirmeye
                              gerek kalmaz. */}
                          {(k.ibanlar || []).length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {(k.ibanlar || []).map(s => (
                                <div key={s.id} className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full text-white shrink-0 ${s.tur === 'sahsi' ? 'bg-amber-600' : 'bg-sky-600'}`}>
                                    {s.tur === 'sahsi' ? 'ŞAHSİ' : 'RESMİ'}
                                  </span>
                                  <span className="text-[10px] font-bold text-neutral-600">{s.isim}</span>
                                  <span className="text-[10px] font-mono font-bold text-neutral-500">{ibanGoster(s.iban)}</span>
                                  {s.iban && (
                                    <button type="button" onClick={() => panoyaKopyala(s.iban, `yon_${s.id}`)}
                                      className={`px-1.5 py-0.5 text-[9px] font-black rounded-md transition ${
                                        kopyalanan === `yon_${s.id}` ? 'bg-emerald-600 text-white' : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}>
                                      {kopyalanan === `yon_${s.id}` ? 'Kopyalandı ✓' : 'Kopyala'}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {!duzenleniyor && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* YENİ (kullanıcı talebi): DÜZENLE — kalemi doğrudan
                                "Ödeme Ekleme" penceresinde açar. Ad, tutar, tür,
                                ilk tarih, tekrar... her alan oradan değiştirilir.
                                Bu pencere kapatılır ki iki pencere üst üste binmesin;
                                kayıt mevcut odemeKalemiKaydet akışıyla yapılır
                                (id dolu olduğu için ekleme değil güncelleme olur). */}
                            <button type="button"
                              onClick={() => { setOtomatikYonetim(false); setYonetimForm(null); setOdemeKalemForm({ ...bosOdemeKalemi, ...k, tutar: String(k.tutar ?? ''), ibanlar: k.ibanlar || [] }); }}
                              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white text-[10px] font-black rounded-lg transition flex items-center gap-1">
                              <Edit className="w-3 h-3" /> Düzenle
                            </button>
                            {/* Tutarı Güncelle / Sonlandır yalnızca TEKRARLANAN
                                kalemlerde anlamlıdır; tek seferlikte gizlenir. */}
                            {tekrarli && !k.bitisTarihi && (
                              <>
                                <button type="button" onClick={() => setYonetimForm({ kalemId: k.id, mod: 'zam', tarih: bugunStr(), tutar: String(guncelTutar) })}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition">Tutarı Güncelle</button>
                                <button type="button" onClick={() => setYonetimForm({ kalemId: k.id, mod: 'bitis', tarih: bugunStr(), tutar: '' })}
                                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-lg transition">Sonlandır</button>
                              </>
                            )}
                            {tekrarli && k.bitisTarihi && (
                              <button type="button" onClick={() => otomatikOdemeGeriAl(k.id, 'bitis')}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition">Yeniden Başlat</button>
                            )}
                            {/* YENİ (kullanıcı talebi): SİL — yanlış eklenmiş kalemi
                                tamamen kaldırır. Zaten var olan odemeKalemiSil
                                fonksiyonu çağrılır; o fonksiyon onay sorar ve
                                YAPILMIŞ ÖDEMELERİ SİLMEZ, yalnızca planı kaldırır.
                                Yapılmış ödeme varsa ek uyarı gösterilir; "Sonlandır"
                                çoğu durumda daha doğru seçimdir (geçmiş korunur,
                                ileri vadeler kesilir). */}
                            <button type="button"
                              onClick={() => {
                                const bilgi = odemeKalemBilgi(seciliDefter, k);
                                if (bilgi.odenenAdet > 0 &&
                                    !window.confirm(`"${k.ad}" kalemine daha önce ${bilgi.odenenAdet} ödeme yapılmış (toplam ₺${paraFmt(bilgi.odenenTutar)}).\n\nPlanı silerseniz bu ödemeler defterde KALIR ama hangi plana ait oldukları listede görünmez.\n\nSadece ileri vadeleri durdurmak istiyorsanız "Sonlandır" daha doğrudur.\n\nYine de silmek istiyor musunuz?`)) return;
                                odemeKalemiSil(k.id);
                              }}
                              className="px-2.5 py-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-black rounded-lg transition flex items-center gap-1">
                              <Trash2 className="w-3 h-3" /> Sil
                            </button>
                          </div>
                        )}
                      </div>

                      {k.bitisTarihi && (
                        <div className="mt-1.5 text-[10px] font-black text-red-600">
                          {k.bitisTarihi.split('-').reverse().join('.')} tarihinde sonlandırıldı
                        </div>
                      )}
                      {(k.zamlar || []).length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {(k.zamlar || []).map((z, zi) => (
                            <div key={zi} className="flex items-center justify-between gap-2 text-[10px] font-bold text-blue-700 bg-white/70 rounded px-2 py-1">
                              <span>{z.gecerliTarih?.split('-').reverse().join('.')} → ₺{paraFmt(parseFloat(z.tutar) || 0)}</span>
                              <button type="button" onClick={() => otomatikOdemeGeriAl(k.id, 'zam', z.gecerliTarih)}
                                className="text-red-500 hover:text-red-700 shrink-0" title="Bu değişikliği kaldır"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Düzenleme formu */}
                      {duzenleniyor && (
                        <div className="mt-2 pt-2 border-t border-neutral-300 space-y-2">
                          <div className="text-[10px] font-black uppercase text-neutral-600">
                            {yonetimForm.mod === 'bitis' ? 'Hangi tarihten sonra borç oluşmasın?' : 'Yeni tutar hangi tarihten itibaren geçerli?'}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={yonetimForm.tarih} onChange={e => setYonetimForm({ ...yonetimForm, tarih: e.target.value })}
                              className="w-full p-2 border border-neutral-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500" />
                            {yonetimForm.mod === 'zam' && (
                              <input type="number" inputMode="decimal" value={yonetimForm.tutar} onChange={e => setYonetimForm({ ...yonetimForm, tutar: e.target.value })}
                                placeholder="Yeni tutar" className="w-full p-2 border border-neutral-300 rounded-lg text-xs font-black outline-none focus:ring-2 focus:ring-orange-500" />
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setYonetimForm(null)} className="flex-1 py-2 bg-neutral-100 text-neutral-600 text-xs font-black rounded-lg">Vazgeç</button>
                            <button type="button" onClick={otomatikOdemeGuncelle} disabled={yonetimKaydediliyor}
                              className={`flex-1 py-2 text-white text-xs font-black rounded-lg disabled:bg-neutral-300 ${yonetimForm.mod === 'bitis' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                              {yonetimKaydediliyor ? 'Kaydediliyor...' : yonetimForm.mod === 'bitis' ? 'Sonlandır' : 'Tutarı Güncelle'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ: MAAŞ ÖDEME PENCERESİ
            Kaynak hesap seçilir; onaylanınca (1) kaynak defterden çıkış +
            Ödemeler defterine mahsup girişi yazılır, (2) Muhasebe'deki tüm
            personellerin banka/nakit tikleri atılır. İki ekran aynı anda
            "ödendi" gösterir.
            ================================================================== */}
        {maasOdeModal && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" /> {maasOdeModal.satir.ad} Öde</h3>
                <button onClick={() => setMaasOdeModal(null)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-800">
                  <div className="font-black text-sm">{maasOdeModal.satir.kaynakEtiket}</div>
                  <div>{maasOdeModal.satir.kisiler.length} personel • Kalan {maasOdeModal.satir.kanal === 'banka' ? 'banka' : maasOdeModal.satir.kanal === 'nakit' ? 'nakit' : 'banka + nakit'} toplamı</div>
                  <div className="text-lg font-black tabular-nums mt-1">₺{paraFmt(maasOdeModal.satir.tutar)}</div>
                </div>
                {/* ================================================================
                    YENİ (kullanıcı talebi): KISMİ ÖDEME
                    ----------------------------------------------------------------
                    Tek personellik ödemede (kisiler.length === 1) tutar
                    değiştirilebilir. Kalandan AZ girilirse kısmi ödeme yapılır:
                    o kadarı deftere düşer, kalan güncellenir ve satır "KISMİ"
                    olarak açık kalır. Tam girilirse tik atılır (eski davranış).
                    Toplu satırlarda (birden çok kişi) bu alan gösterilmez; orada
                    her kişi kendi satırından ayrı ayrı ödenir.
                    ================================================================ */}
                {maasOdeModal.satir.kisiler.length === 1 && (
                  <div>
                    <label className="text-xs font-bold text-neutral-600 block mb-1">Ödenecek Tutar (₺) — kısmi ödeme için azaltabilirsiniz</label>
                    <input type="number" inputMode="decimal" min="0" step="any"
                      value={maasOdeModal.tutar ?? String(maasOdeModal.satir.tutar)}
                      onChange={e => setMaasOdeModal({ ...maasOdeModal, tutar: e.target.value })}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-black" />
                    {/* Hızlı seçim: kalanın tamamı / yarısı */}
                    <div className="flex gap-1.5 mt-1.5">
                      <button type="button" onClick={() => setMaasOdeModal({ ...maasOdeModal, tutar: String(maasOdeModal.satir.tutar) })}
                        className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[10px] font-black rounded-lg hover:bg-purple-200 transition">Tamamı (₺{paraFmt(maasOdeModal.satir.tutar)})</button>
                      <button type="button" onClick={() => setMaasOdeModal({ ...maasOdeModal, tutar: (maasOdeModal.satir.tutar / 2).toFixed(2) })}
                        className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-[10px] font-black rounded-lg hover:bg-neutral-200 transition">Yarısı</button>
                    </div>
                    {(() => {
                      const gir = parseFloat(String(maasOdeModal.tutar ?? maasOdeModal.satir.tutar).replace(',', '.')) || 0;
                      const kalanSonra = maasOdeModal.satir.tutar - gir;
                      if (gir > maasOdeModal.satir.tutar + 0.01) {
                        return <p className="text-[11px] font-black text-red-600 mt-1.5">⚠ Girilen tutar kalandan fazla olamaz.</p>;
                      }
                      if (gir > 0 && kalanSonra > 0.01) {
                        return <p className="text-[11px] font-bold text-amber-700 mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">Kısmi ödeme yapıyorsunuz. Bu ödemeden sonra <b>₺{paraFmt(kalanSonra)}</b> kalacak; satır <b>KISMİ</b> olarak açık kalır.</p>;
                      }
                      return null;
                    })()}
                  </div>
                )}
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hangi hesaptan ödendi? *</label>
                  <select value={maasOdeModal.kaynakDefterId} onChange={e => setMaasOdeModal({ ...maasOdeModal, kaynakDefterId: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                    <option value="">Hesap seçin...</option>
                    {defterler.filter(d => d.id !== seciliDefterId && d.tur !== 'Kredi' && d.tur !== 'Ödemeler')
                      .map(d => <option key={d.id} value={d.id}>{d.ad} — {defterBlogu(d)} (₺{paraFmt(defterBakiye(d.id))})</option>)}
                  </select></div>
                <div className="text-[10px] font-bold text-neutral-500 bg-neutral-50 rounded-lg p-2.5 border border-neutral-200">
                  Onayladığınızda seçtiğiniz hesaptan çıkış yazılır ve personel <b>etiketlenerek</b> deftere işlenir. Tam ödemede Muhasebe tikleri atılır; kısmi ödemede yalnızca ödenen tutar düşer, kalan açık kalır.
                </div>
                {(() => {
                  const gir = maasOdeModal.satir.kisiler.length === 1
                    ? (parseFloat(String(maasOdeModal.tutar ?? maasOdeModal.satir.tutar).replace(',', '.')) || 0)
                    : maasOdeModal.satir.tutar;
                  const gecersiz = !(gir > 0) || gir > maasOdeModal.satir.tutar + 0.01;
                  const kismi = gir > 0 && gir < maasOdeModal.satir.tutar - 0.01;
                  return (
                    <button onClick={maasOde} disabled={maasKaydediliyor || gecersiz}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 text-white font-black rounded-xl transition">
                      {maasKaydediliyor ? 'Kaydediliyor...' : `₺${paraFmt(gir)} ${kismi ? 'Kısmi ' : ''}Ödemeyi Onayla`}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* SİLME ONAYLARI */}
        {deleteIslemId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h3 className="font-black text-black mb-1">İşlem Silinsin mi?</h3>
              <p className="text-xs text-neutral-500 font-bold mb-4">Bu kayıt kalıcı olarak silinir ve bakiye yeniden hesaplanır.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteIslemId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-black rounded-xl">Vazgeç</button>
                <button onClick={handleDeleteIslem} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl">Sil</button>
              </div>
            </div>
          </div>
        )}
        {deleteDefterId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h3 className="font-black text-black mb-1">Defter Silinsin mi?</h3>
              <p className="text-xs text-neutral-500 font-bold mb-4">"{defterler.find(x => x.id === deleteDefterId)?.ad}" defteri ve içindeki TÜM işlemler kalıcı olarak silinir.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteDefterId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-black rounded-xl">Vazgeç</button>
                <button onClick={handleDeleteDefter} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl">Defteri Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
