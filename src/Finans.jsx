import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Truck, ShieldCheck, MapPin, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, Briefcase, Wallet, Activity, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Landmark, CreditCard, DollarSign, Edit, Ban, User, Loader2, Package, Database, Download, BarChart, TrendingUp, UserPlus, BookOpen, Search, ChevronLeft, ChevronRight, Tag, History, Plus, Trash2, ChevronDown, ChevronUp , Banknote, UserMinus } from 'lucide-react';
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
          else if (val.status === 'FGM') { fazlaGun++; toplamMesaiSaati += parseFloat(val.hours) || 0; }
          else if (val.status === 'FM') toplamMesaiSaati += parseFloat(val.hours) || 0;
          else if (val.status === 'EM') toplamMesaiSaati -= parseFloat(val.hours) || 0;
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
                    <h4 className="font-black text-purple-900 text-lg mb-4 flex items-center gap-2 border-b border-purple-200 pb-2">🏆 En Çok Puan Alanlar (Bonus Puanlar)</h4>
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
                        <p className="text-xs font-black text-purple-800 mb-2 uppercase tracking-wide">📋 20 Puan Üstü Tüm Sıralama</p>
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
    }, [currentMonth, currentYear, db, appId, docPrefix, collarType, personnelList, daysInMonth]);

    useEffect(() => {
      if (!isDataLoaded) return;
      const timeoutId = setTimeout(async () => {
        setIsSaving(true);
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${currentYear}_${currentMonth}`);
          await setDoc(docRef, { records: mesaiData, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
          console.error("Otomatik kaydetme hatası:", e);
        }
        setTimeout(() => setIsSaving(false), 800);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }, [mesaiData, docPrefix]);

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
          setMesaiData(newData);
      }
    }, [mesaiData, isDataLoaded, collarType, currentMonth, currentYear, daysInMonth, prevMonthData, targetPersonnelList]);

    const handleCellChange = (personId, day, value) => {
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
            else if (val.status === 'FM') { counts.G++; counts.FM_H += parseFloat(val.hours) || 0; }
            else if (val.status === 'EM') { counts.G++; counts.EM_H += parseFloat(val.hours) || 0; }
            else if (val.status === 'FGM') { counts.FG++; counts.FM_H += parseFloat(val.hours) || 0; }
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
                  {months.find(m => m.val === currentMonth)?.label.toUpperCase()} {currentYear} {collarType.toUpperCase()} MESAİ LİSTESİ
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
                                  value={hours}
                                  onChange={(e) => handleHoursChange(person.id, d, e.target.value)}
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
                      <input type="number" value={row.nakitAvans || ''} onChange={e => handleCellChange(person.id, 'nakitAvans', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-yellow-100 focus:ring-1 focus:ring-yellow-400 rounded" placeholder="0" />
                    </td>
                    )}
                    {g('hakedis') && (
                      <td className="border-r border-neutral-300 px-0.5 py-0.5 bg-yellow-50/30">
                      <input type="number" value={row.resmiAvans || ''} onChange={e => handleCellChange(person.id, 'resmiAvans', e.target.value)} className="w-full h-6 text-center text-[10px] bg-transparent outline-none focus:bg-yellow-100 focus:ring-1 focus:ring-yellow-400 rounded" placeholder="0" />
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
                    {g('finans') && (
                      <td className={`border-r border-neutral-300 px-0.5 py-0.5 align-middle ${row.bankaOdendi ? 'bg-green-200' : 'bg-yellow-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${row.bankaOdendi ? 'text-green-800 line-through opacity-70' : 'text-yellow-900'}`}>{c.bankaKalan.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'bankaOdendi', 'bankaOdenenTutar', c.bankaKalan)} className={`p-0.5 shrink-0 rounded transition ${row.bankaOdendi ? 'text-green-700' : 'text-yellow-600/50 hover:text-yellow-800'}`} title={row.bankaOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    )}
                    {g('finans') && (
                      <td style={{ borderRight: '3px solid #16a34a' }} className={`px-0.5 py-0.5 align-middle ${row.nakitOdendi ? 'bg-green-300' : 'bg-orange-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${row.nakitOdendi ? 'text-green-900 line-through opacity-70' : 'text-orange-900'}`}>{c.kalanNakit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'nakitOdendi', 'nakitOdenenTutar', c.kalanNakit)} className={`p-0.5 shrink-0 rounded transition ${row.nakitOdendi ? 'text-green-800' : 'text-orange-600/50 hover:text-orange-800'}`} title={row.nakitOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    )}
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
          else if (val.status === 'FGM') { fazlaGunCount++; toplamMesaiSaati += parseFloat(val.hours) || 0; }
          else if (val.status === 'FM') toplamMesaiSaati += parseFloat(val.hours) || 0;
          else if (val.status === 'EM') toplamMesaiSaati -= parseFloat(val.hours) || 0;
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
                <button onClick={handleDownloadCSV} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-md w-full md:w-auto">
                    <Download className="w-5 h-5" /> Banka Excel Formatında İndir
                </button>
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
    const bosOdemeKalemi = { id: '', ad: '', tutar: '', ilkTarih: bugunStr(), tekrar: 'aylik', tekrarSayisi: '', not: '' };
    const [odemeKalemForm, setOdemeKalemForm] = useState(null); // null = kapalı
    // { kalem, vade, kaynakDefterId, tarih } — hangi kalemin hangi vadesi, nereden
    const [vadeOdeme, setVadeOdeme] = useState(null);
    // Vade listesi açık olan kalemin kimliği (akordiyon)
    const [acikOdemeKalemi, setAcikOdemeKalemi] = useState(null);

    // YENİ: Kredi kalemi formu ve akordiyon durumu (Ödemeler ile aynı desen)
    const bosKrediKalemi = { id: '', ad: '', bankaAdi: '', anaPara: '', toplamGeriOdeme: '', taksitSayisi: '', aylikTaksit: '', ilkTaksitTarihi: bugunStr(), not: '' };
    const [krediKalemForm, setKrediKalemForm] = useState(null); // null = kapalı
    const [acikKrediKalemi, setAcikKrediKalemi] = useState(null);
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
      return () => { u1(); u2(); };
    }, []);

    // --- Hesaplamalar ---
    const paraFmt = (n) => (n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const defterIslemleri = (dId) => islemler.filter(i => i.defterId === dId);
    const defterBakiye = (dId) => defterIslemleri(dId).reduce((t, i) => t + (i.tip === 'giris' ? 1 : -1) * (parseFloat(i.tutar) || 0), 0);
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
    const ciroyaGirer = (i) => !i.isVirman && !i.krediMahsup && !i.odemeMahsup;

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
        i.tip === 'giris' && i.krediMahsup &&
        (k.id === '__eski__' ? true : (i.krediKalemId ? i.krediKalemId === k.id : false)));
      const odenenTutar = odemeler.reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
      const odenenTaksitNolar = new Set(odemeler.map(i => parseInt(i.taksitNo)).filter(n => !isNaN(n)));
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
          const odendi = odenenTaksitNolar.has(n);
          const odemeKaydi = odemeler.find(i => parseInt(i.taksitNo) === n);
          plan.push({
            no: n,
            tarih: tarihStr,
            tutar: aylikTaksit,
            odendi,
            odemeTarihi: odemeKaydi?.tarih || null,
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
      return {
        detaylar,
        kalemSayisi: kalemler.length,
        toplamBorc: detaylar.reduce((t, d) => t + d.bilgi.kalanBorc, 0),
        toplamAnaPara: detaylar.reduce((t, d) => t + d.bilgi.anaPara, 0),
        toplamGeriOdeme: detaylar.reduce((t, d) => t + d.bilgi.toplamGeriOdeme, 0),
        toplamOdenen: detaylar.reduce((t, d) => t + d.bilgi.odenenTutar, 0),
        gecikmisAdet: detaylar.reduce((t, d) => t + d.bilgi.gecikmisAdet, 0),
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
    const TEKRAR_SECENEKLERI = [
      { id: 'tek', ad: 'Tek Seferlik' },
      { id: 'haftalik', ad: 'Her Hafta' },
      { id: 'aylik', ad: 'Her Ay' },
      { id: 'yillik', ad: 'Her Yıl' },
    ];
    const SURESIZ_VADE_PENCERESI = 24; // Süresiz kalemlerde gösterilecek vade sayısı

    const tekrarEtiket = (tekrar, sayi) => {
      const ad = TEKRAR_SECENEKLERI.find(t => t.id === tekrar)?.ad || 'Tek Seferlik';
      if (tekrar === 'tek') return ad;
      return parseInt(sayi) > 0 ? `${ad} • ${sayi} kez` : `${ad} • süresiz`;
    };

    // Bir ödeme kaleminin vade planını ve ödeme durumunu çıkarır
    const odemeKalemBilgi = (defter, kalem) => {
      const tutar = parseFloat(kalem.tutar) || 0;
      const tekrar = kalem.tekrar || 'tek';
      const istenenAdet = tekrar === 'tek' ? 1 : (parseInt(kalem.tekrarSayisi) || 0);
      const suresiz = tekrar !== 'tek' && istenenAdet === 0;

      // Bu kaleme ait ödemeler (defterdeki mahsup girişleri)
      const odemeler = defterIslemleri(defter?.id)
        .filter(i => i.tip === 'giris' && i.odemeMahsup && i.odemeKalemId === kalem.id);
      const odenenVadeNolar = new Set(odemeler.map(i => parseInt(i.vadeNo)).filter(n => !isNaN(n)));
      const odenenTutar = odemeler.reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);

      // Süresizde: ödenen sayısı + pencere kadar vade üret (liste hep dolu kalsın)
      const uretilecek = suresiz ? odenenVadeNolar.size + SURESIZ_VADE_PENCERESI : istenenAdet;

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
          const odendi = odenenVadeNolar.has(n);
          const kayit = odemeler.find(i => parseInt(i.vadeNo) === n);
          plan.push({ no: n, tarih: tarihStr, tutar, odendi, odemeTarihi: kayit?.tarih || null,
                      gecikmis: !odendi && tarihStr < bugunStr() });
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
               gecikmisTutar: gecikmisler.reduce((t, p) => t + p.tutar, 0), siradaki };
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
        t + d.bilgi.plan.filter(p => !p.odendi && p.tarih >= buAyBas && p.tarih <= buAyBit).reduce((s, p) => s + p.tutar, 0), 0);
      return { detaylar, kalemSayisi: kalemler.length, gecikmisAdet, gecikmisTutar, buAyBekleyen };
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
      const aralik = donemAraligi(ozetDonem);
      if (!aralik) return islemler; // Tüm Zamanlar
      return islemler.filter(i => i.tarih && i.tarih >= aralik.bas && i.tarih <= aralik.bit);
    }, [islemler, ozetDonem]);

    const toplamGiris = ozetIslemleri.filter(i => i.tip === 'giris' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const toplamCikis = ozetIslemleri.filter(i => i.tip === 'cikis' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const netBakiye = toplamGiris - toplamCikis;

    const seciliDefter = defterler.find(d => d.id === seciliDefterId) || null;

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
      const tutar = parseFloat(t.tutar) || 0;
      if (tutar <= 0) { alert('Taksit tutarı geçersiz.'); return; }
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
          aciklama: `${taksitOdeme.kalem?.ad || taksitOdeme.kalem?.bankaAdi || seciliDefter.ad} — ${t.no}. taksit ödemesi`,
        });
        // 2) Kredi defterinde GİRİŞ (borç azalması — ciroya girmez)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'giris', tutar,
          defterId: seciliDefter.id,
          krediMahsup: true,
          odemeYontemi: defterdenOdemeYontemi(taksitOdeme.kaynakDefterId),
          aciklama: `${taksitOdeme.kalem?.ad || taksitOdeme.kalem?.bankaAdi || 'Kredi'} ${t.no}. taksit ödendi ← ${kaynak?.ad || 'hesap'}`,
        });
        addSystemLog?.('Kredi Taksiti Ödendi',
          `${seciliDefter.ad}: ${t.no}. taksit ₺${paraFmt(tutar)} — ${kaynak?.ad || '-'} hesabından ödendi.`);
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
    const vadeOde = async () => {
      if (!vadeOdeme?.vade || !seciliDefter) return;
      if (!vadeOdeme.kaynakDefterId) { alert('Ödemenin hangi hesaptan yapıldığını seçin.'); return; }
      const v = vadeOdeme.vade;
      const tutar = parseFloat(vadeOdeme.tutar ?? v.tutar) || 0;
      if (tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
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
        createdAt: new Date().toISOString(),
        by: currentUser?.fullName || 'Sistem',
      };
      setTaksitKaydediliyor(true);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'cikis', tutar, odemeMahsup: false,
          defterId: vadeOdeme.kaynakDefterId,
          odemeYontemi: defterdenOdemeYontemi(vadeOdeme.kaynakDefterId),
          aciklama: `${vadeOdeme.kalem.ad} — ${v.no}. ödeme`,
        });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...ortak, tip: 'giris', tutar, odemeMahsup: true,
          defterId: seciliDefter.id,
          odemeYontemi: defterdenOdemeYontemi(vadeOdeme.kaynakDefterId),
          aciklama: `${vadeOdeme.kalem.ad} ${v.no}. ödeme ← ${kaynak?.ad || 'hesap'}`,
        });
        addSystemLog?.('Düzenli Ödeme Yapıldı',
          `${vadeOdeme.kalem.ad} ${v.no}. ödeme ₺${paraFmt(tutar)} — ${kaynak?.ad || '-'} hesabından ödendi.`);
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
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', editingIslemId), kayit);
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

    const handleDeleteIslem = async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', deleteIslemId));
      addSystemLog?.('Defter İşlemi Silindi', `${seciliDefter?.ad} defterinden bir kayıt silindi.`);
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
    const bekleyenIsler = useMemo(() => {
      if (!seciliDefterId || seciliDefterId !== bekleyenIsDefteriId) return [];
      const gun = gunFiltreAktif ? seciliGun : bugunStr();
      return (jobs || [])
        .filter(j => j && j.date === gun
          && j.status !== 'completed' && j.status !== 'cancelled'
          && !j.endJobDetails)
        .map(j => ({ ...j, bekleyenTutar: Math.max(0, (parseFloat(j.price) || 0) - (parseFloat(j.deposit) || 0)) }))
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
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }, [jobs, seciliDefterId, bekleyenIsDefteriId, gunFiltreAktif, seciliGun]);

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
          {/* ÜST ÖZET — tüm defterlerin genel durumu */}
          <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-neutral-900 rounded-2xl p-5 md:p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              <h2 className="text-lg sm:text-xl font-black">Defter</h2>
              {/* Alt başlık telefonda gizlenir — tek satıra sığmıyordu */}
              <span className="hidden sm:inline text-xs font-bold text-white/60">Kasa, cari ve borç/alacak takibi</span>
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
                      ? 'bg-white text-emerald-800 border-white'
                      : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20 hover:text-white'
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
                <div className="text-[10px] font-bold text-white/50 mb-2">
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
              <div className="bg-white/10 rounded-xl p-2.5 sm:p-3 border border-white/10 flex sm:block items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase text-emerald-300 flex items-center gap-1 shrink-0"><ArrowDownRight className="w-3.5 h-3.5" /> Toplam Giriş</div>
                <div className="text-base sm:text-lg md:text-2xl font-black sm:mt-1 tabular-nums text-right">₺{paraFmt(toplamGiris)}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 sm:p-3 border border-white/10 flex sm:block items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase text-red-300 flex items-center gap-1 shrink-0"><ArrowUpRight className="w-3.5 h-3.5" /> Toplam Çıkış</div>
                <div className="text-base sm:text-lg md:text-2xl font-black sm:mt-1 tabular-nums text-right">₺{paraFmt(toplamCikis)}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 sm:p-3 border border-white/10 flex sm:block items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase text-white/70 flex items-center gap-1 shrink-0"><Wallet className="w-3.5 h-3.5" /> Net Bakiye</div>
                <div className={`text-base sm:text-lg md:text-2xl font-black sm:mt-1 tabular-nums text-right ${netBakiye >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>₺{paraFmt(netBakiye)}</div>
              </div>
            </div>

            {/* ==============================================================
                YENİ: TOPLAM KREDİ BORCU
                Yalnızca en az bir kredi defteri varsa görünür. Dönem
                filtresinden ETKİLENMEZ — kalan borç kümülatif bir tutardır,
                "bugünkü kredi borcu" diye bir şey olmaz.
                ============================================================== */}
            {krediDefterleri.length > 0 && (
              <div className="mt-3 bg-violet-500/20 border border-violet-300/30 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-violet-200" />
                  <div>
                    <div className="text-[10px] font-black uppercase text-violet-200">Toplam Kredi Borcu</div>
                    <div className="text-[10px] font-bold text-white/50">{krediDefterleri.length} kredi hesabı • tüm zamanlar</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base sm:text-lg md:text-2xl font-black text-violet-100 tabular-nums">₺{paraFmt(toplamKrediBorcu)}</div>
                  {toplamGecikmis > 0 && (
                    <div className="text-[10px] font-black text-red-300">{toplamGecikmis} gecikmiş taksit</div>
                  )}
                </div>
              </div>
            )}

            {/* YENİ: BEKLEYEN ÖDEMELER — bu ay vadesi gelen + gecikmişler */}
            {odemeDefterleri.length > 0 && (toplamBuAyBekleyen > 0 || toplamGecikmisOdeme > 0) && (
              <div className="mt-2 bg-orange-500/20 border border-orange-300/30 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-orange-200" />
                  <div>
                    <div className="text-[10px] font-black uppercase text-orange-200">Bu Ay Bekleyen Ödemeler</div>
                    <div className="text-[10px] font-bold text-white/50">{odemeDefterleri.length} ödeme defteri</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base sm:text-lg md:text-2xl font-black text-orange-100 tabular-nums">₺{paraFmt(toplamBuAyBekleyen)}</div>
                  {toplamGecikmisOdeme > 0 && (
                    <div className="text-[10px] font-black text-red-300">{toplamGecikmisOdeme} gecikmiş ödeme</div>
                  )}
                </div>
              </div>
            )}
          </div>

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
              return (
                <div key={blokAdi} className="border border-neutral-300 rounded-2xl overflow-hidden bg-neutral-50/50">
                  {/* BLOK BAŞLIĞI */}
                  <div className="px-3 sm:px-4 py-2.5 bg-white border-b border-neutral-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-5 rounded-full bg-emerald-600 shrink-0"></span>
                      <span className="font-black text-sm text-black truncate">{blokAdi}</span>
                      <span className="text-[10px] font-bold text-neutral-400 shrink-0">{blokDefterleri.length} defter</span>
                    </div>
                    <div className={`text-sm font-black tabular-nums shrink-0 ${blokBakiye > 0 ? 'text-emerald-600' : blokBakiye < 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                      ₺{paraFmt(Math.abs(blokBakiye))}
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
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
              const defteriAc = () => { setSeciliDefterId(d.id); setDetayArama(''); setKategoriFiltre('Tümü'); setSeciliGun(bugunStr()); setGunFiltreAktif(true); };
              return (
                <div key={d.id} role="button" tabIndex={0}
                  onClick={defteriAc}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); defteriAc(); } }}
                  className="w-full bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3 hover:border-emerald-400 hover:shadow-md transition text-left cursor-pointer">
                  {/* ==========================================================
                      YENİ: SIRALAMA OKLARI (yukarı / aşağı)
                      Defterin listedeki yerini değiştirir. stopPropagation ile
                      kart tıklaması (defteri açma) engellenir. En üstteki
                      defterde yukarı, en alttakinde aşağı oku pasif görünür.
                      Arama yapılırken oklar hiç gösterilmez (bkz. siralamaAktif).
                      ========================================================== */}
                  {siralamaAktif && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button type="button" disabled={defterIndex === 0}
                        onClick={e => { e.stopPropagation(); defterSirasiDegistir(defterIndex, -1, blokDefterleri); }}
                        title="Yukarı taşı"
                        className={`p-1 rounded-md transition ${defterIndex === 0 ? 'text-neutral-200 cursor-not-allowed' : 'text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button type="button" disabled={defterIndex === blokDefterleri.length - 1}
                        onClick={e => { e.stopPropagation(); defterSirasiDegistir(defterIndex, 1, blokDefterleri); }}
                        title="Aşağı taşı"
                        className={`p-1 rounded-md transition ${defterIndex === blokDefterleri.length - 1 ? 'text-neutral-200 cursor-not-allowed' : 'text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {/* Defter adının ilk HARFİ yerine TÜRE UYGUN SİMGE.
                      Tüm defterler "NAKLİYE (...)" ile başladığı için hepsinde aynı
                      "N" harfi çıkıyordu ve ayırt edici bir bilgi vermiyordu.
                      Simge + renk defterTuruGorunum() ile tek yerden geliyor. */}
                  {(() => {
                    const { Ikon, renk } = defterTuruGorunum(d.tur);
                    return (
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white ${renk}`}>
                        <Ikon className="w-5 h-5" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-black truncate">{d.ad}</div>
                    {/* DEĞİŞİKLİK: Ham d.tur yerine defterTuruEtiket() — eski kayıtlar da
                        yeni isimle görünür (Cari -> Kredi Kartı, Diğer -> Borçlu). */}
                    <div className="text-[11px] font-bold text-neutral-400">{defterTuruEtiket(d.tur)} {sonTarih ? `• Son işlem: ${new Date(sonTarih).toLocaleDateString('tr-TR')}` : '• Henüz işlem yok'}</div>
                  </div>
                  {/* ==========================================================
                      KREDİ DEFTERİ farklı gösterilir: "bakiye" yerine KALAN BORÇ
                      ve taksit ilerlemesi. Kredi hesabının bakiyesi kavramsal
                      olarak anlamsızdır; asıl bilgi ne kadar borç kaldığıdır.
                      ========================================================== */}
                  {d.tur === 'Ödemeler' ? (() => {
                    // ÖDEMELER DEFTERİ: bakiye yerine bu ay bekleyen tutar ve gecikme
                    const od = odemeDefterBilgi(d);
                    return (
                      <div className="text-right shrink-0 max-w-[45%] sm:max-w-none sm:min-w-[120px]">
                        <div className={`text-base sm:text-lg font-black tabular-nums ${od.gecikmisAdet > 0 ? 'text-red-600' : 'text-orange-700'}`}>₺{paraFmt(od.buAyBekleyen)}</div>
                        <div className="text-[9px] sm:text-[10px] font-black uppercase text-orange-500 leading-tight">
                          Bu Ay Bekleyen • {od.kalemSayisi} kalem
                        </div>
                        {od.gecikmisAdet > 0 && (
                          <div className="text-[9px] font-black text-red-600 mt-0.5">{od.gecikmisAdet} gecikmiş • ₺{paraFmt(od.gecikmisTutar)}</div>
                        )}
                      </div>
                    );
                  })() : d.tur === 'Kredi' ? (() => {
                    // DEĞİŞTİ: Defterdeki TÜM kredilerin toplamı gösterilir
                    const kd = krediDefterBilgi(d);
                    const yuzde = kd.toplamGeriOdeme > 0 ? Math.round((kd.toplamOdenen / kd.toplamGeriOdeme) * 100) : 0;
                    return (
                      <div className="text-right shrink-0 max-w-[45%] sm:max-w-none sm:min-w-[120px]">
                        <div className={`text-base sm:text-lg font-black tabular-nums ${kd.toplamBorc > 0 ? 'text-violet-700' : 'text-emerald-600'}`}>₺{paraFmt(kd.toplamBorc)}</div>
                        <div className="text-[9px] sm:text-[10px] font-black uppercase text-violet-500 leading-tight">
                          {kd.kalemSayisi === 0 ? 'Kredi Eklenmemiş'
                            : kd.toplamBorc > 0 ? `Kalan Borç • ${kd.kalemSayisi} kredi`
                            : 'Tüm Krediler Kapandı'}
                        </div>
                        {kd.kalemSayisi > 0 && (
                          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-violet-500" style={{ width: `${yuzde}%` }}></div>
                          </div>
                        )}
                        {kd.gecikmisAdet > 0 && (
                          <div className="text-[9px] font-black text-red-600 mt-0.5">{kd.gecikmisAdet} gecikmiş taksit</div>
                        )}
                      </div>
                    );
                  })() : (
                  <div className="text-right shrink-0 max-w-[45%] sm:max-w-none">
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
                </div>
              );
            })}
                  </div>
                </div>
              );
            })}
          </div>

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
    const dIslemler = defterIslemleri(seciliDefterId)
      // YENİ: GÜNLÜK FİLTRE — en başta uygulanır ki arama ve kategori
      // filtreleri yalnızca o günün hareketleri içinde çalışsın.
      .filter(i => !gunFiltreAktif || i.tarih === seciliGun)
      // YENİ: Gelir / Gider / Transfer filtresi.
      // Transferler (isVirman) gelir ve gider listelerinden çıkarılır; kendi
      // sekmelerinde görünürler.
      .filter(i => hareketFiltre === 'tumu'
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
    const gunIslemleri = defterIslemleri(seciliDefterId).filter(i => i.tarih === seciliGun);
    // Günün GELİR / GİDER rakamlarında da virman sayılmaz (yukarıdaki gerekçe).
    // Transferler listede görünür ama bu üç rakamı bozmaz.
    const gunGiris = gunIslemleri.filter(i => i.tip === 'giris' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const gunCikis = gunIslemleri.filter(i => i.tip === 'cikis' && ciroyaGirer(i)).reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const gunNet = gunGiris - gunCikis;
    // O gün yapılan transfer toplamı — ayrı bir bilgi olarak gösterilir.
    const gunVirman = gunIslemleri.filter(i => i.isVirman && i.tip === 'cikis').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);

    // Hangi günlerde hareket var? Ok tuşlarının yanında ipucu göstermek için.
    const hareketliGunler = new Set(defterIslemleri(seciliDefterId).map(i => i.tarih));

    // Toplam (tüm zamanlar) — üst karttaki defter bakiyesi bunu kullanır,
    // günlük filtre bu rakamları ETKİLEMEZ. Bakiye her zaman defterin
    // gerçek durumunu göstermeli, yoksa yanlış okunur.
    const dGiris = defterIslemleri(seciliDefterId).filter(i => i.tip === 'giris').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const dCikis = defterIslemleri(seciliDefterId).filter(i => i.tip === 'cikis').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const dBakiye = dGiris - dCikis;

    // Kategori dağılımı (bu defterin tüm işlemleri üzerinden)
    const katDagilim = {};
    defterIslemleri(seciliDefterId).forEach(i => {
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
          return (
            <div className="bg-white rounded-2xl border border-violet-200 overflow-hidden">
              <div className="bg-violet-600 text-white px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="font-black flex items-center gap-2 text-sm">
                  <Landmark className="w-4 h-4" /> Krediler
                  <span className="text-[10px] font-bold text-white/70">{kd.kalemSayisi} kredi</span>
                  {kd.gecikmisAdet > 0 && (
                    <span className="text-[10px] font-black bg-red-500 px-2 py-0.5 rounded-full">{kd.gecikmisAdet} GECİKMİŞ TAKSİT</span>
                  )}
                </div>
                <button type="button"
                  onClick={() => setKrediKalemForm({ ...bosKrediKalemi })}
                  className="px-3 py-1.5 bg-white text-violet-700 text-[11px] font-black rounded-lg hover:bg-violet-50 transition flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" /> Yeni Kredi Ekle
                </button>
              </div>

              {/* TÜM KREDİLERİN TOPLAMI */}
              {kd.kalemSayisi > 0 && (
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
              )}

              <div className="p-4 space-y-3">
                {kd.kalemSayisi === 0 && (
                  <div className="text-center py-8 border border-dashed border-neutral-300 rounded-xl">
                    <Landmark className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-neutral-400">Henüz kredi eklenmemiş.</p>
                    <p className="text-[11px] font-medium text-neutral-400 mt-1">"Yeni Kredi Ekle" ile taşıt, ihtiyaç, ticari kredilerinizi tek tek tanımlayın.</p>
                  </div>
                )}

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
                              onClick={e => { e.stopPropagation(); setTaksitOdeme({ kalem, taksit: bilgi.siradaki, kaynakDefterId: '', tarih: bugunStr() }); }}
                              className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black rounded-lg transition">
                              Öde
                            </button>
                          )}
                          <button type="button" onClick={e => { e.stopPropagation(); setKrediKalemForm({ ...bosKrediKalemi, ...kalem }); }}
                            className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={e => { e.stopPropagation(); krediKalemiSil(kalem.id); }}
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
                                : 'bg-white border-neutral-200'}`}>
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  t.odendi ? 'bg-emerald-600 text-white' : t.gecikmis ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                                  {t.no}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-black text-black">₺{paraFmt(t.tutar)}</div>
                                  <div className={`text-[10px] font-bold ${t.gecikmis ? 'text-red-600' : 'text-neutral-500'}`}>
                                    Vade: {t.tarih.split('-').reverse().join('.')}
                                    {t.odendi && t.odemeTarihi ? ` • Ödendi: ${t.odemeTarihi.split('-').reverse().join('.')}` : t.gecikmis ? ' • GECİKMİŞ' : ''}
                                  </div>
                                </div>
                                {t.odendi ? (
                                  <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1 shrink-0"><CheckCircle className="w-3.5 h-3.5" /> ÖDENDİ</span>
                                ) : (
                                  <button type="button"
                                    onClick={() => setTaksitOdeme({ kalem, taksit: t, kaynakDefterId: '', tarih: bugunStr() })}
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
                <button type="button"
                  onClick={() => setOdemeKalemForm({ ...bosOdemeKalemi })}
                  className="px-3 py-1.5 bg-white text-orange-700 text-[11px] font-black rounded-lg hover:bg-orange-50 transition flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" /> Yeni Ödeme
                </button>
              </div>

              {/* ÜST ÖZET: bu ay bekleyen + gecikmiş */}
              <div className="grid grid-cols-2 gap-2 p-4 pb-0">
                <div className="bg-orange-50 rounded-xl p-2.5 border border-orange-200">
                  <div className="text-[9px] font-black uppercase text-orange-600">Bu Ay Bekleyen</div>
                  <div className="text-sm font-black text-orange-700">₺{paraFmt(od.buAyBekleyen)}</div>
                </div>
                <div className={`rounded-xl p-2.5 border ${od.gecikmisAdet > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className={`text-[9px] font-black uppercase ${od.gecikmisAdet > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Gecikmiş</div>
                  <div className={`text-sm font-black ${od.gecikmisAdet > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {od.gecikmisAdet > 0 ? `₺${paraFmt(od.gecikmisTutar)} • ${od.gecikmisAdet} ödeme` : 'Yok'}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {od.detaylar.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-neutral-300 rounded-xl">
                    <CalendarDays className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-neutral-400">Henüz ödeme planı yok.</p>
                    <p className="text-[11px] font-medium text-neutral-400 mt-1">"Yeni Ödeme" ile kira, sigorta, vergi gibi düzenli giderlerinizi ekleyin.</p>
                  </div>
                )}

                {od.detaylar.map(({ kalem, bilgi }) => {
                  const acik = acikOdemeKalemi === kalem.id;
                  return (
                    <div key={kalem.id} className={`rounded-xl border overflow-hidden ${bilgi.gecikmisAdet > 0 ? 'border-red-300' : 'border-neutral-200'}`}>
                      {/* KALEM BAŞLIĞI — tıklayınca vade listesi açılır */}
                      <div className={`p-3 flex items-center gap-3 cursor-pointer transition ${bilgi.gecikmisAdet > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-neutral-50 hover:bg-neutral-100'}`}
                        onClick={() => setAcikOdemeKalemi(acik ? null : kalem.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-black text-sm truncate flex items-center gap-2">
                            {kalem.ad}
                            {bilgi.gecikmisAdet > 0 && <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full shrink-0">{bilgi.gecikmisAdet} GECİKMİŞ</span>}
                          </div>
                          <div className="text-[11px] font-bold text-neutral-500">
                            ₺{paraFmt(bilgi.tutar)} • {tekrarEtiket(kalem.tekrar, kalem.tekrarSayisi)}
                            {bilgi.suresiz ? ` • ${bilgi.odenenAdet} ödeme yapıldı` : ` • ${bilgi.odenenAdet}/${bilgi.istenenAdet} ödendi`}
                          </div>
                          {bilgi.siradaki && (
                            <div className={`text-[11px] font-bold mt-0.5 ${bilgi.siradaki.gecikmis ? 'text-red-600' : 'text-orange-700'}`}>
                              Sıradaki: {bilgi.siradaki.tarih.split('-').reverse().join('.')}
                              {bilgi.siradaki.gecikmis && ' (gecikmiş)'}
                            </div>
                          )}
                          {!bilgi.siradaki && <div className="text-[11px] font-black text-emerald-700 mt-0.5">Tüm ödemeler tamamlandı ✓</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Sıradaki vadeyi tek tıkla ödeme kısayolu */}
                          {bilgi.siradaki && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setVadeOdeme({ kalem, vade: bilgi.siradaki, kaynakDefterId: '', tarih: bugunStr(), tutar: String(bilgi.siradaki.tutar) }); }}
                              className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black rounded-lg transition">
                              Öde
                            </button>
                          )}
                          <button type="button" onClick={e => { e.stopPropagation(); setOdemeKalemForm({ ...bosOdemeKalemi, ...kalem }); }}
                            className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={e => { e.stopPropagation(); odemeKalemiSil(kalem.id); }}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Planı kaldır">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronDown className={`w-4 h-4 text-neutral-400 transition ${acik ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* VADE LİSTESİ */}
                      {acik && (
                        <div className="p-3 bg-white border-t border-neutral-200">
                          {kalem.not && <p className="text-[11px] font-medium text-neutral-500 mb-2 italic">{kalem.not}</p>}
                          <div className="max-h-64 overflow-y-auto space-y-1">
                            {bilgi.plan.map(v => (
                              <div key={v.no} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                                v.odendi ? 'bg-emerald-50 border-emerald-200'
                                : v.gecikmis ? 'bg-red-50 border-red-200'
                                : 'bg-white border-neutral-200'}`}>
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  v.odendi ? 'bg-emerald-600 text-white' : v.gecikmis ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                                  {v.no}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-black text-black">₺{paraFmt(v.tutar)}</div>
                                  <div className={`text-[10px] font-bold ${v.gecikmis ? 'text-red-600' : 'text-neutral-500'}`}>
                                    Vade: {v.tarih.split('-').reverse().join('.')}
                                    {v.odendi && v.odemeTarihi ? ` • Ödendi: ${v.odemeTarihi.split('-').reverse().join('.')}` : v.gecikmis ? ' • GECİKMİŞ' : ''}
                                  </div>
                                </div>
                                {v.odendi ? (
                                  <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1 shrink-0"><CheckCircle className="w-3.5 h-3.5" /> ÖDENDİ</span>
                                ) : (
                                  <button type="button"
                                    onClick={() => setVadeOdeme({ kalem, vade: v, kaynakDefterId: '', tarih: bugunStr(), tutar: String(v.tutar) })}
                                    className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black rounded-lg transition shrink-0">
                                    Öde
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {bilgi.suresiz && (
                            <p className="text-[10px] font-bold text-neutral-400 mt-2 text-center">
                              Süresiz ödeme — sonraki {SURESIZ_VADE_PENCERESI} vade gösteriliyor, ödedikçe liste ilerler.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
            };
            const sekmeler = [
              { id: 'tumu', ad: 'Tümü', aktif: 'bg-neutral-900 text-white', pasif: 'text-neutral-500 hover:bg-neutral-100' },
              { id: 'giris', ad: 'Gelir', aktif: 'bg-emerald-600 text-white', pasif: 'text-emerald-700 hover:bg-emerald-50' },
              { id: 'cikis', ad: 'Gider', aktif: 'bg-red-600 text-white', pasif: 'text-red-600 hover:bg-red-50' },
              { id: 'transfer', ad: 'Transfer', aktif: 'bg-slate-800 text-white', pasif: 'text-slate-600 hover:bg-slate-100' },
            ];
            return (
              <div className="grid grid-cols-4 gap-1.5 px-2.5 sm:px-3 pb-2.5 sm:pb-3 border-t border-neutral-100 pt-2.5">
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
            <div className="grid grid-cols-3 border-t border-neutral-200 divide-x divide-neutral-200">
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
            <div className="border-t border-neutral-200 px-3 py-2 flex items-center justify-between bg-slate-50">
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

        {/* İŞLEM LİSTESİ — tarih + açıklama + etiketler | sağda renkli tutar */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-neutral-900 text-white text-[10px] font-black uppercase">
            <span>İşlem</span><span className="text-right w-24 sm:w-28">Gelir</span><span className="text-right w-24 sm:w-28">Gider</span>
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
                ? `Bu ${gunFiltreAktif ? 'günde' : 'defterde'} ${hareketFiltre === 'giris' ? 'gelir' : hareketFiltre === 'cikis' ? 'gider' : 'transfer'} kaydı yok. "Tümü" sekmesine bakabilirsiniz.`
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
                <div key={j.id} className="grid grid-cols-[1fr_auto] gap-2 px-3 sm:px-4 py-2.5 items-center opacity-60 border-t border-dashed border-amber-200">
                  <div className="min-w-0">
                    <div className="font-black text-sm text-neutral-700 break-words">{j.customerName}</div>
                    <div className="text-[10px] font-bold text-neutral-500">
                      {j.time || '—'} • {j.type || 'Nakliye'}
                      {j.assignedVehiclePlate ? ` • ${j.assignedVehiclePlate}` : ''}
                      {(parseFloat(j.deposit) || 0) > 0 ? ` • Kapora düşüldü: ₺${paraFmt(parseFloat(j.deposit))}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-amber-700 tabular-nums text-sm sm:text-base">₺{paraFmt(j.bekleyenTutar)}</div>
                    <div className="text-[9px] font-black uppercase text-amber-500">Bekleniyor</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-neutral-100">
            {/* YENİ: Tüm Zamanlar modunda yalnızca ilk 'gosterilenSayi' kayıt
                çizilir (günlük modda zaten tek günün hareketleri var, dilimlenmez). */}
            {(gunFiltreAktif ? dIslemler : dIslemler.slice(0, gosterilenSayi)).map(i => (
              <div key={i.id} className="grid grid-cols-[1fr_auto_auto] gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 items-center group hover:bg-neutral-50 transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-neutral-400">{new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">{i.kategori}</span>
                    {i.odemeYontemi && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{i.odemeYontemi}</span>}
                    {/* DEĞİŞİKLİK: Etiketlerdeki plaka-tıklama mantığı KALDIRILDI.
                        Araç artık kendi alanında (aracId/plaka) tutuluyor ve
                        aşağıda ayrı rozet olarak gösteriliyor. Etiketten de
                        tıklanabilir olsaydı aynı bilgi iki yerde çıkardı. */}
                    {(i.etiketler || []).map(e => <span key={e} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">#{e}</span>)}
                    {i.kaynak && i.kaynak !== 'Manuel' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">{i.kaynak}</span>}
                  </div>
                  {/* DEĞİŞİKLİK: Müşteri adı artık AÇIKLAMA METNİNİN İÇİNDE değil.
                      Açıklama düz metin basılır; müşteri ve araç altta ayrı ROZET
                      olarak gösterilir. Böylece hangi bilginin gerçek bir kayda
                      bağlı olduğu görsel olarak ayrışır. */}
                  {i.aciklama && <div className="text-sm font-bold text-neutral-700 truncate mt-0.5">{i.aciklama}</div>}

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
                  <div className="text-[10px] font-bold text-neutral-300">{i.by}</div>
                  <div className="hidden group-hover:flex items-center gap-1 mt-1">
                    <button onClick={() => { setIslemForm({ tip: i.tip, tutar: String(i.tutar), aciklama: i.aciklama || '', kategori: i.kategori || 'Diğer', etiketler: (i.etiketler || []), odemeYontemi: i.odemeYontemi || 'Nakit', tarih: i.tarih, hedefDefterId: i.defterId || seciliDefterId || '', musteriAdi: i.musteriAdi || '', musteriTel: i.musteriTel || '', plaka: i.plaka || '', aracId: i.aracId || '', ekipSefi: i.ekipSefi || '', ekipSefiId: i.ekipSefiId || '' }); setEditingIslemId(i.id); setShowIslemForm(true); }}
                      className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-0.5"><Edit className="w-3 h-3" /> Düzenle</button>
                    <button onClick={() => setDeleteIslemId(i.id)} className="text-[10px] font-black text-red-500 hover:underline flex items-center gap-0.5 ml-2"><X className="w-3 h-3" /> Sil</button>
                  </div>
                </div>
                <div className="text-right w-24 sm:w-28 font-black text-emerald-600 text-sm sm:text-base">{i.tip === 'giris' ? `₺${paraFmt(parseFloat(i.tutar))}` : ''}</div>
                <div className="text-right w-24 sm:w-28 font-black text-red-500 text-sm sm:text-base">{i.tip === 'cikis' ? `₺${paraFmt(parseFloat(i.tutar))}` : ''}</div>
              </div>
            ))}
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

        {/* YENİ: ETİKET SEÇME PENCERESİ
            Hazır etiketler gruplar hâlinde listelenir. Gruplar VARSAYILAN olarak
            KAPALI gelir — 88 etiket birden açılırsa pencere okunamaz. Arama
            yazıldığında gruplar göz ardı edilip düz sonuç listesi gösterilir.
            KATMAN NOTU: z-[9999] kullanılıyor. Bu pencereyi açan İŞLEM FORMU
            z-[9997] olduğu için, daha düşük bir değerde (z-50) formun ARKASINDA
            kalıyor ve ekranda hiç görünmüyordu. 9999 dosyadaki en yüksek değer. */}
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

                  // ARAMA MODU: gruplar göz ardı edilir, düz sonuç listesi çıkar.
                  if (q) {
                    const tumu = [...tumVarsayilanEtiketler(), ...ozelEtiketler]
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

                  // NORMAL MOD: katlanır gruplar + en altta özel etiketler
                  return (
                    <>
                      {VARSAYILAN_ETIKET_GRUPLARI.map(grup => {
                        const acik = !!acikGruplar[grup.baslik];
                        // Grup başlığı da bir etiket olabilir (örn. KAMYONLAR),
                        // ama KİŞİLER/GENEL yalnızca gruplama amaçlı sanal başlıklar.
                        const sanalBaslik = grup.baslik === 'KİŞİLER' || grup.baslik === 'GENEL';
                        const grupSeciliSayi = grup.etiketler.filter(e => secili.includes(e)).length;

                        return (
                          <div key={grup.baslik} className="border border-neutral-200 rounded-xl overflow-hidden">
                            <button type="button" onClick={() => setAcikGruplar({ ...acikGruplar, [grup.baslik]: !acik })}
                              className="w-full px-3 py-2.5 bg-neutral-50 hover:bg-neutral-100 flex items-center justify-between transition">
                              <span className="text-xs font-black text-black flex items-center gap-2">
                                {grup.baslik}
                                {grupSeciliSayi > 0 && (
                                  <span className="text-[9px] font-black bg-emerald-600 text-white rounded-full px-1.5">{grupSeciliSayi}</span>
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-neutral-400">{grup.etiketler.length}</span>
                                {acik ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />}
                              </span>
                            </button>

                            {acik && (
                              <div className="p-2.5 flex flex-wrap gap-1.5">
                                {/* Grup başlığının kendisi de seçilebilir (sanal başlıklar hariç) */}
                                {!sanalBaslik && (
                                  <button type="button" onClick={() => etiketToggle(grup.baslik)}
                                    className={`text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition ${
                                      secili.includes(grup.baslik)
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700'
                                    }`}>
                                    {secili.includes(grup.baslik) && '✓ '}{grup.baslik} (tümü)
                                  </button>
                                )}
                                {grup.etiketler.map(e => (
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
                            )}
                          </div>
                        );
                      })}

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

        {/* ==================================================================
            YENİ: ÖDEME KALEMİ EKLE / DÜZENLE
            Tekrar tipi ve sayısı burada belirlenir. "Süresiz" için tekrar
            sayısı boş bırakılır — kira gibi bitiş tarihi olmayan ödemeler.
            ================================================================== */}
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

        {/* ==================================================================
            YENİ: VADE ÖDEME PENCERESİ
            Tutar değiştirilebilir — kira zammı gibi durumlarda o ayki gerçek
            tutar farklı olabilir. Plan tutarı bozulmaz, yalnızca bu ödeme
            girilen tutarla kaydedilir.
            ================================================================== */}
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
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödenen Tutar (₺) *</label>
                  <input type="number" inputMode="decimal" value={vadeOdeme.tutar}
                    onChange={e => setVadeOdeme({ ...vadeOdeme, tutar: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-lg font-black" />
                  {parseFloat(vadeOdeme.tutar) !== parseFloat(vadeOdeme.vade.tutar) && (
                    <p className="text-[11px] font-bold text-amber-700 mt-1.5">
                      Plandaki tutar ₺{paraFmt(vadeOdeme.vade.tutar)}. Farklı tutar girdiniz — yalnızca bu ödeme etkilenir, plan değişmez.
                    </p>
                  )}
                </div>

                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hangi hesaptan ödendi? *</label>
                  <select value={vadeOdeme.kaynakDefterId}
                    onChange={e => setVadeOdeme({ ...vadeOdeme, kaynakDefterId: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                    <option value="">Hesap seçin...</option>
                    {/* Kredi ve Ödemeler defterleri kaynak olamaz — onlar plan defteridir */}
                    {defterler.filter(d => d.tur !== 'Kredi' && d.tur !== 'Ödemeler')
                      .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.ad} — {defterTuruEtiket(d.tur)} (₺{paraFmt(defterBakiye(d.id))})</option>
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
                  <div className="text-2xl font-black text-violet-800">₺{paraFmt(taksitOdeme.taksit.tutar)}</div>
                  <div className="text-[11px] font-bold text-violet-600">
                    {/* DEĞİŞTİ: Defter adı yerine ÖDENEN KREDİNİN adı — bir
                        defterde birden çok kredi olduğu için hangisi olduğu
                        belli olmalı. */}
                    {taksitOdeme.kalem?.ad || taksitOdeme.kalem?.bankaAdi || seciliDefter.ad} • Vade: {taksitOdeme.taksit.tarih.split('-').reverse().join('.')}
                    {taksitOdeme.taksit.gecikmis && <span className="text-red-600"> • GECİKMİŞ</span>}
                  </div>
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
                        <option key={d.id} value={d.id}>{d.ad} — {defterTuruEtiket(d.tur)} (₺{paraFmt(defterBakiye(d.id))})</option>
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
                  Onayladığınızda seçtiğiniz hesaptan <b>₺{paraFmt(taksitOdeme.taksit.tutar)} çıkış</b> yazılır ve kredinin kalan borcu aynı tutarda azalır. Bu hareket ciro toplamlarında <b>çift sayılmaz</b>.
                </p>

                <button onClick={taksitOde} disabled={taksitKaydediliyor}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-300 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {taksitKaydediliyor ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                      {defterTuruEtiket(seciliDefter.tur)} • Bakiye: ₺{paraFmt(defterBakiye(seciliDefterId))}
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
                    {defterler
                      .filter(d => d.id !== seciliDefterId)
                      .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'))
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.ad} — {defterTuruEtiket(d.tur)} (₺{paraFmt(defterBakiye(d.id))})
                        </option>
                      ))}
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
            ================================================================== */}
        {Object.keys(katDagilim).length > 0 && (
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
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-xl px-3 flex gap-2 sm:gap-3 pointer-events-auto">
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

        {/* İŞLEM EKLE/DÜZENLE PENCERESİ */}
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
                      {defterler
                        .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'))
                        .map(d => (
                          <option key={d.id} value={d.id}>{d.ad} — {defterTuruEtiket(d.tur)}</option>
                        ))}
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
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Defter Türü</label>
                  <select value={defterForm.tur} onChange={e => setDefterForm({ ...defterForm, tur: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                    {DEFTER_TURLERI.map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Not</label>
                  <input value={defterForm.not} onChange={e => setDefterForm({ ...defterForm, not: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" /></div>
                <button onClick={handleSaveDefter} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition">Kaydet</button>
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
