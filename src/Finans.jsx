import React, { useState, useEffect } from 'react';
import { Truck, ShieldCheck, MapPin, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, Briefcase, Wallet, Activity, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Landmark, CreditCard, DollarSign, Edit, Ban, User, Loader2, Package, Database, Download, BarChart, TrendingUp, UserPlus, BookOpen, Search, ChevronLeft, Tag, History} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, appId, MESAI_STATUS_OPTIONS, isPersonnelVisibleInMonth } from './shared.jsx';

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
      const maas = parseFloat(row.maas !== undefined && row.maas !== '' ? row.maas : person.maas) || 0;
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
      const kalanNakit = netMaas - hesaplananBanka - nakitAvans + mesaiUcretiToplam;

      // ====================================================================
      // YENİ: SİGORTA MALİYETİ
      // Personel kartındaki (Personel Ekle / Düzenle) "Sigorta Maliyeti"
      // alanından okunur. Bu tutar personele ÖDENMEZ — devlete/SGK'ya
      // ödenir. Bu yüzden işveren maliyetine DAHİL edilir, ama personele
      // ödenecek tutara DAHİL EDİLMEZ.
      // ====================================================================
      const sigortaMaliyeti = parseFloat(person.sigortaMaliyeti) || 0;

      // PERSONELE ÖDENECEK brüt tutar (sigorta hariç — bu para personelin eline/bankasına geçer)
      const personeleOdenecek = netMaas + mesaiUcretiToplam + yol + yemek;
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

      return { netMaas, mesaiUcreti, primTL, yol, yemek, nakitAvans, resmiAvans, toplamAvans, icraKesintisi, hesaplananBanka, bankaKalan, kalanNakit, sigortaMaliyeti, personeleOdenecek, maliyet, odenen, odenenToplam, kalan };
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

  export const MaasView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
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
                          {c.primTL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
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
      
      const maas = parseFloat(row.maas !== undefined && row.maas !== '' ? row.maas : person.maas) || 0;
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

      const toplamAvans = nakitAvans + resmiAvans;
      const netMaas = (maas / 30) * mesaiGunSayisi;
      const maliyet = netMaas + mesaiUcreti + yol + yemek;
      
      // Kalan Nakit: (Hak edilen maaş) - Bankaya Yatan Kısım - Nakit Avans + Mesai Ücreti
      const kalanNakit = netMaas - hesaplananBanka - nakitAvans + mesaiUcreti;

      return { 
        nakitAvans, resmiAvans, gunlukSaat, toplamSaat, mesaiGunSayisi, 
        maas, fazlaGunSayisi, devamsizlikSayisi, rapor, ucretsizIzinSayisi, prim, yol, yemek,
        hesaplananBanka, icraKesintisi, bankaKalan,
        mesaiUcreti, primTL, mesaiUcretiSaf, toplamAvans, netMaas, maliyet, kalanNakit 
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

  export const PersonelMuhasebeView = ({ personnelList, db, appId, addSystemLog }) => {
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
           {activeSubTab === 'maas' && <MaasView collarType={collarType} personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
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
        // YENİ: ÇIKTI ARTIK CSV DEĞİL, BANKANIN ORİJİNAL EXCEL (.xlsx)
        // ŞABLONUNUN BİREBİR AYNISI. Satır düzeni, başlıklar, sağdaki "Ödeme
        // Tipleri" referans tablosu ve bilgilendirme metinleri şablonla aynı;
        // yalnızca rakamlar (kurum bilgileri, adet, tutar, tarih ve personel
        // satırları) seçime göre doldurulur. 3 sekme (Resmi Avans / Kalan
        // Banka / Yol Parası) için de aynı şablon kullanılır.
        // SheetJS kütüphanesi ilk indirmede CDN'den bir kez yüklenir.
        // ====================================================================
        try {
          const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');

          // Şablonun üst bilgi + veri satırlarını birebir kur (A1:L...)
          const aoa = [
            ['Kurum Kodu', bankInfo.kurumKodu, 'Garanti Bankası tarafından verilen kurum kodunuz.', null, null, null, null, null, 'Ödeme Tipleri', null, null, null],
            ['Şube Kodu', bankInfo.subeKodu, 'Şubenizden öğreniniz', null, null, null, null, null, 'O', 'SOSYAL YARDIM', 'G', 'PROMOSYON'],
            ['Hesap', bankInfo.hesapNo, 'Maaş ödemesinde kullanacağınız hesap. 1299998-2 şeklinde kontrol digiti girmeyiniz.', null, null, null, null, null, 'D', 'DÖNER SERMAYE    ', 'R', 'PRİM ÖDEMESİ     '],
            ['Toplam Adet', toplamAdet, 'Toplam maaş adedi. (Giriş yapıldıkça otomatik olarak hesaplanır.)', null, null, null, null, null, 'C', 'KOMİSYON', 'S', 'EK DERS ÜCRETİ'],
            ['Toplam Tutar', Math.round(toplamTutar * 100) / 100, 'Toplam ödeme tutarı. (Giriş yapıldıkça otomatik olarak hesaplanır.)', null, null, null, null, null, 'F', 'FAZLA MESAİ      ', 'H', 'HUZUR HAKKI'],
            ['Döviz Kodu', 'TL ', 'Döviz kodunu listeden seçiniz.', null, null, null, null, null, 'I', 'İKRAMİYE         ', 'V', 'ASGARİ GEÇİM İNDİRİMİ'],
            ['Ödeme Tarihi', odemeTarihiFormatted, 'GGAAYYYY formatında. (Örnek: 04032001 giriniz.)', null, null, null, null, null, 'K', 'KIDEM TAZMİNATI  ', 'Y', 'YOLLUK           '],
            ['Ödeme Tipi', odemeTipiFormatted, 'Ödeme tiplerini yandaki tabloda görebilirsiniz.', null, null, null, null, null, 'M', 'MAAŞ             ', 'Z', 'DİĞER            '],
            ['Borç İzahat', bankInfo.borcIzahat, null, null, null, null, null, null, 'N', 'AVANS            ', 'X', 'KESİNTİ'],
            ["BİLGİLENDİRME : Dosyanızdaki bilgiler banka sistemine otomatik olarak yüklenecektir. Banka kodu boş veya  62 ise havale, 62'den farklı ise EFT'dir. Kayıtlar içinde EFT varsa ödeme tarihi işgünü olmalıdır. Başka bir excel dosyasından kopyalama yapmak istiyorsanız Edit/Paste Spacial seçeneğini Values seçerek kullanınız."],
            ['Herhangi bir hataya yol açmamak için dosyanın formatını değiştirmeyiniz, açıklamalara uyunuz. '],
            ['İsim', 'TCKN (Opsiyonel)', 'Banka Kodu', 'Şube Kodu', 'Hesap', 'IBAN (Boşluksuz 26 Karakter)', 'Tutar', 'Borç İzahat', 'Alacak izahat'],
          ];

          // Personel satırları — şablondaki gibi: İsim + IBAN + Tutar (sayı olarak)
          selectedPersonnel.forEach(id => {
            const person = targetPersonnelList.find(p => p.id === id);
            if (!person) return;
            const amount = getAmountForTab(id);
            const iban = person.iban ? person.iban.replace(/\s+/g, '') : '';
            const tckn = person.tcNo ? person.tcNo.replace(/\s+/g, '') : null;
            aoa.push([person.fullName, tckn || null, null, null, null, iban, Math.round(amount * 100) / 100, null, null]);
          });

          const ws = XLSX.utils.aoa_to_sheet(aoa);
          // Şablona yakın sütun genişlikleri
          ws['!cols'] = [
            { wch: 24 }, { wch: 18 }, { wch: 40 }, { wch: 10 }, { wch: 10 },
            { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 6 }, { wch: 24 }
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Sayfa1');

          // YENİ: Dosya adı artık bulunduğun bölümün adını alıyor — örn.
          // "Beyaz Yaka Temmuz 2026 Avans Listesi.xlsx" (ekteki örnek dosya adıyla
          // aynı okunabilir formatta). Hangi sekmedeysen o sekmenin adı kullanılır.
          const sekmeDosyaAdi = {
            'Resmi Avans Ödemesi': 'Avans Listesi',
            'Kalan Banka Ödemesi': 'Kalan Banka Listesi',
            'Yol Parası Ödemesi': 'Yol Parası Listesi'
          }[activeTab] || activeTab;
          const dosyaAdi = `${collarType} ${monthNames[currentMonth - 1]} ${currentYear} ${sekmeDosyaAdi}.xlsx`;
          XLSX.writeFile(wb, dosyaAdi);

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
  export const FinansDefterView = ({ currentUser, addSystemLog }) => {
    // Varsayılan işlem kategorileri (giderler + gelirler bir arada)
    const DEFTER_KATEGORILER = ['İş Geliri', 'Tahsilat', 'Personel Maaş', 'Avans', 'Yakıt', 'Kira', 'Malzeme', 'Bakım / Onarım', 'Vergi / Resmi', 'Yemek / Yol', 'Borç Ödeme', 'Borç Verme', 'Transfer', 'Diğer'];
    const DEFTER_TURLERI = ['Kasa', 'Banka', 'Cari (Kişi/Firma)', 'Diğer'];
    const ODEME_YONTEMLERI = ['Nakit', 'Banka / Havale', 'Kredi Kartı', 'Çek / Senet', 'Diğer'];

    const [defterler, setDefterler] = useState([]);
    const [islemler, setIslemler] = useState([]);
    const [seciliDefterId, setSeciliDefterId] = useState(null);
    const [arama, setArama] = useState('');

    // Defter oluşturma/düzenleme penceresi
    const [showDefterForm, setShowDefterForm] = useState(false);
    const [defterForm, setDefterForm] = useState({ ad: '', tur: 'Kasa', not: '' });
    const [editingDefterId, setEditingDefterId] = useState(null);
    const [deleteDefterId, setDeleteDefterId] = useState(null);

    // İşlem ekleme/düzenleme penceresi
    const emptyIslem = { tip: 'giris', tutar: '', aciklama: '', kategori: 'Diğer', etiketler: '', odemeYontemi: 'Nakit', tarih: new Date().toISOString().split('T')[0] };
    const [showIslemForm, setShowIslemForm] = useState(false);
    const [islemForm, setIslemForm] = useState(emptyIslem);
    const [editingIslemId, setEditingIslemId] = useState(null);
    const [deleteIslemId, setDeleteIslemId] = useState(null);

    // Detay filtreleri
    const [detayArama, setDetayArama] = useState('');
    const [kategoriFiltre, setKategoriFiltre] = useState('Tümü');

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
    const toplamGiris = islemler.filter(i => i.tip === 'giris').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const toplamCikis = islemler.filter(i => i.tip === 'cikis').reduce((t, i) => t + (parseFloat(i.tutar) || 0), 0);
    const netBakiye = toplamGiris - toplamCikis;

    const seciliDefter = defterler.find(d => d.id === seciliDefterId) || null;

    // --- Defter işlemleri ---
    const handleSaveDefter = async () => {
      if (!defterForm.ad.trim()) return;
      if (editingDefterId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterler', editingDefterId), { ...defterForm });
        addSystemLog?.('Defter Güncellendi', `"${defterForm.ad}" defteri düzenlendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'), {
          ...defterForm, createdAt: new Date().toISOString(), createdBy: currentUser?.fullName || 'Sistem'
        });
        addSystemLog?.('Yeni Defter', `"${defterForm.ad}" defteri açıldı.`);
      }
      setShowDefterForm(false); setEditingDefterId(null); setDefterForm({ ad: '', tur: 'Kasa', not: '' });
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
    const handleSaveIslem = async () => {
      const tutar = parseFloat(islemForm.tutar);
      if (!tutar || tutar <= 0) { alert('Geçerli bir tutar girin.'); return; }
      const kayit = {
        ...islemForm,
        tutar,
        // Etiketler virgülle ayrılır, boşluklar temizlenir
        etiketler: (islemForm.etiketler || '').split(',').map(e => e.trim()).filter(Boolean),
        defterId: seciliDefterId,
      };
      if (editingIslemId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', editingIslemId), kayit);
        addSystemLog?.('Defter İşlemi Güncellendi', `${seciliDefter?.ad}: ${kayit.tip === 'giris' ? 'Giriş' : 'Çıkış'} ₺${paraFmt(tutar)} düzenlendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...kayit, kaynak: 'Manuel', createdAt: new Date().toISOString(), by: currentUser?.fullName || 'Sistem'
        });
        addSystemLog?.('Defter İşlemi', `${seciliDefter?.ad}: ${kayit.tip === 'giris' ? 'PARA GİRİŞİ' : 'PARA ÇIKIŞI'} ₺${paraFmt(tutar)} (${kayit.kategori}).`);
      }
      setShowIslemForm(false); setEditingIslemId(null); setIslemForm(emptyIslem);
    };

    const handleDeleteIslem = async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', deleteIslemId));
      addSystemLog?.('Defter İşlemi Silindi', `${seciliDefter?.ad} defterinden bir kayıt silindi.`);
      setDeleteIslemId(null);
    };

    // ======================== DEFTER LİSTESİ GÖRÜNÜMÜ ========================
    if (!seciliDefter) {
      const filtreliDefterler = defterler
        .filter(d => !arama.trim() || (d.ad || '').toLocaleLowerCase('tr-TR').includes(arama.trim().toLocaleLowerCase('tr-TR')))
        .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));

      return (
        <div className="max-w-5xl mx-auto animate-in fade-in space-y-5">
          {/* ÜST ÖZET — tüm defterlerin genel durumu */}
          <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-neutral-900 rounded-2xl p-5 md:p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6" />
              <h2 className="text-xl font-black">Defter</h2>
              <span className="text-xs font-bold text-white/60">Kasa, cari ve borç/alacak takibi</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] font-black uppercase text-emerald-300 flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5" /> Toplam Giriş</div>
                <div className="text-lg md:text-2xl font-black mt-1">₺{paraFmt(toplamGiris)}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] font-black uppercase text-red-300 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> Toplam Çıkış</div>
                <div className="text-lg md:text-2xl font-black mt-1">₺{paraFmt(toplamCikis)}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-[10px] font-black uppercase text-white/70 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Net Bakiye</div>
                <div className={`text-lg md:text-2xl font-black mt-1 ${netBakiye >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>₺{paraFmt(netBakiye)}</div>
              </div>
            </div>
          </div>

          {/* ARAMA + YENİ DEFTER */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Defter ara (kasa, kişi, firma adı)..."
                className="w-full pl-9 pr-3 py-3 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600 bg-white transition" />
            </div>
            <button onClick={() => { setDefterForm({ ad: '', tur: 'Kasa', not: '' }); setEditingDefterId(null); setShowDefterForm(true); }}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl transition flex items-center gap-2 shadow-md shadow-emerald-600/20 shrink-0">
              <PlusCircle className="w-4 h-4" /> Yeni Defter
            </button>
          </div>

          {/* DEFTER KARTLARI — videodaki liste mantığı: ad + son işlem + renkli bakiye */}
          <div className="space-y-2">
            {filtreliDefterler.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm font-bold text-neutral-400">
                Henüz defter yok. "Yeni Defter" ile ilk defterinizi (örn. MERKEZ KASA) açın.
              </div>
            )}
            {filtreliDefterler.map(d => {
              const bakiye = defterBakiye(d.id);
              const sonTarih = defterSonIslem(d.id);
              return (
                <button key={d.id} onClick={() => { setSeciliDefterId(d.id); setDetayArama(''); setKategoriFiltre('Tümü'); }}
                  className="w-full bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3 hover:border-emerald-400 hover:shadow-md transition text-left">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-black text-white ${d.tur === 'Banka' ? 'bg-blue-600' : d.tur === 'Kasa' ? 'bg-emerald-600' : d.tur === 'Cari (Kişi/Firma)' ? 'bg-amber-500' : 'bg-neutral-500'}`}>
                    {(d.ad || '?').charAt(0).toLocaleUpperCase('tr-TR')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-black truncate">{d.ad}</div>
                    <div className="text-[11px] font-bold text-neutral-400">{d.tur} {sonTarih ? `• Son işlem: ${new Date(sonTarih).toLocaleDateString('tr-TR')}` : '• Henüz işlem yok'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-black ${bakiye > 0 ? 'text-emerald-600' : bakiye < 0 ? 'text-red-600' : 'text-neutral-400'}`}>₺{paraFmt(Math.abs(bakiye))}</div>
                    <div className={`text-[10px] font-black uppercase ${bakiye > 0 ? 'text-emerald-500' : bakiye < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                      {bakiye > 0 ? 'Alacaklısınız / Kasada Var' : bakiye < 0 ? 'Borçlusunuz' : 'Bakiye Sıfır'}
                    </div>
                  </div>
                </button>
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
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Defter Türü</label>
                    <select value={defterForm.tur} onChange={e => setDefterForm({ ...defterForm, tur: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      {DEFTER_TURLERI.map(t => <option key={t}>{t}</option>)}
                    </select></div>
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
    const dIslemler = defterIslemleri(seciliDefterId)
      .filter(i => kategoriFiltre === 'Tümü' || i.kategori === kategoriFiltre)
      .filter(i => {
        const q = detayArama.trim().toLocaleLowerCase('tr-TR');
        if (!q) return true;
        return (i.aciklama || '').toLocaleLowerCase('tr-TR').includes(q) ||
               (i.kategori || '').toLocaleLowerCase('tr-TR').includes(q) ||
               (i.etiketler || []).some(e => e.toLocaleLowerCase('tr-TR').includes(q));
      })
      .sort((a, b) => new Date(b.tarih) - new Date(a.tarih) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

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
        {/* BAŞLIK + BAKİYE KARTI */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-neutral-900 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button onClick={() => setSeciliDefterId(null)} className="flex items-center gap-1.5 text-white/80 hover:text-white font-bold text-sm transition"><ChevronLeft className="w-5 h-5" /> Defterler</button>
            <div className="flex items-center gap-2">
              <button onClick={() => { setDefterForm({ ad: seciliDefter.ad, tur: seciliDefter.tur, not: seciliDefter.not || '' }); setEditingDefterId(seciliDefter.id); setShowDefterForm(true); }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition" title="Defteri Düzenle"><Edit className="w-4 h-4" /></button>
              <button onClick={() => setDeleteDefterId(seciliDefter.id)} className="p-2 bg-white/10 hover:bg-red-500/60 rounded-lg transition" title="Defteri Sil"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-black">{seciliDefter.ad}</h2>
              <div className="text-xs font-bold text-white/60">{seciliDefter.tur}{seciliDefter.not ? ` • ${seciliDefter.not}` : ''}</div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-black ${dBakiye >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>₺{paraFmt(Math.abs(dBakiye))}</div>
              <div className="text-[11px] font-black uppercase text-white/70">{dBakiye > 0 ? 'Alacaklısınız / Kasada Var' : dBakiye < 0 ? 'Borçlusunuz' : 'Bakiye Sıfır'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
              <div className="text-[10px] font-black uppercase text-emerald-300">Toplam Giriş (Aldım)</div>
              <div className="text-base font-black">₺{paraFmt(dGiris)}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
              <div className="text-[10px] font-black uppercase text-red-300">Toplam Çıkış (Verdim)</div>
              <div className="text-base font-black">₺{paraFmt(dCikis)}</div>
            </div>
          </div>
        </div>

        {/* KATEGORİ DAĞILIMI — etiket/kategori bazlı görsel rapor */}
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

        {/* ARAMA */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={detayArama} onChange={e => setDetayArama(e.target.value)} placeholder="İşlemlerde ara: açıklama, kategori veya etiket..."
            className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600 bg-white transition" />
        </div>

        {/* İŞLEM LİSTESİ — tarih + açıklama + etiketler | sağda renkli tutar */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 bg-neutral-900 text-white text-[10px] font-black uppercase">
            <span>İşlem</span><span className="text-right w-28">Giriş (Aldım)</span><span className="text-right w-28">Çıkış (Verdim)</span>
          </div>
          {dIslemler.length === 0 && <div className="p-8 text-center text-sm font-bold text-neutral-400">Kayıt bulunamadı. Alttaki butonlarla ilk işlemi ekleyin.</div>}
          <div className="divide-y divide-neutral-100">
            {dIslemler.map(i => (
              <div key={i.id} className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 items-center group hover:bg-neutral-50 transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-neutral-400">{new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">{i.kategori}</span>
                    {i.odemeYontemi && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{i.odemeYontemi}</span>}
                    {(i.etiketler || []).map(e => <span key={e} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">#{e}</span>)}
                    {i.kaynak && i.kaynak !== 'Manuel' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">{i.kaynak}</span>}
                  </div>
                  {i.aciklama && <div className="text-sm font-bold text-neutral-700 truncate mt-0.5">{i.aciklama}</div>}
                  <div className="text-[10px] font-bold text-neutral-300">{i.by}</div>
                  <div className="hidden group-hover:flex items-center gap-1 mt-1">
                    <button onClick={() => { setIslemForm({ tip: i.tip, tutar: String(i.tutar), aciklama: i.aciklama || '', kategori: i.kategori || 'Diğer', etiketler: (i.etiketler || []).join(', '), odemeYontemi: i.odemeYontemi || 'Nakit', tarih: i.tarih }); setEditingIslemId(i.id); setShowIslemForm(true); }}
                      className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-0.5"><Edit className="w-3 h-3" /> Düzenle</button>
                    <button onClick={() => setDeleteIslemId(i.id)} className="text-[10px] font-black text-red-500 hover:underline flex items-center gap-0.5 ml-2"><X className="w-3 h-3" /> Sil</button>
                  </div>
                </div>
                <div className="text-right w-28 font-black text-emerald-600">{i.tip === 'giris' ? `₺${paraFmt(parseFloat(i.tutar))}` : ''}</div>
                <div className="text-right w-28 font-black text-red-500">{i.tip === 'cikis' ? `₺${paraFmt(parseFloat(i.tutar))}` : ''}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ALDIM / VERDİM BÜYÜK BUTONLAR — videodaki gibi sabit altta */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 flex gap-3 z-40">
          <button onClick={() => { setIslemForm({ ...emptyIslem, tip: 'cikis' }); setEditingIslemId(null); setShowIslemForm(true); }}
            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-2xl shadow-red-600/40 transition flex items-center justify-center gap-2 text-base">
            <ArrowUpRight className="w-5 h-5" /> VERDİM (Çıkış)
          </button>
          <button onClick={() => { setIslemForm({ ...emptyIslem, tip: 'giris' }); setEditingIslemId(null); setShowIslemForm(true); }}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-2xl shadow-emerald-600/40 transition flex items-center justify-center gap-2 text-base">
            <ArrowDownRight className="w-5 h-5" /> ALDIM (Giriş)
          </button>
        </div>

        {/* İŞLEM EKLE/DÜZENLE PENCERESİ */}
        {showIslemForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 my-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-black flex items-center gap-2 ${islemForm.tip === 'giris' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {islemForm.tip === 'giris' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  {editingIslemId ? 'İşlemi Düzenle' : islemForm.tip === 'giris' ? 'PARA GİRİŞİ (Aldım)' : 'PARA ÇIKIŞI (Verdim)'}
                </h3>
                <button onClick={() => setShowIslemForm(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {/* Giriş/Çıkış değiştirme (düzenlemede de kullanılabilir) */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setIslemForm({ ...islemForm, tip: 'giris' })} className={`py-2.5 rounded-xl font-black text-sm border-2 transition ${islemForm.tip === 'giris' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>ALDIM (Giriş)</button>
                  <button onClick={() => setIslemForm({ ...islemForm, tip: 'cikis' })} className={`py-2.5 rounded-xl font-black text-sm border-2 transition ${islemForm.tip === 'cikis' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-red-400'}`}>VERDİM (Çıkış)</button>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tutar (₺) *</label>
                  <input type="number" inputMode="decimal" value={islemForm.tutar} onChange={e => setIslemForm({ ...islemForm, tutar: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-lg font-black" placeholder="0,00" autoFocus /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Tarih</label>
                    <input type="date" value={islemForm.tarih} onChange={e => setIslemForm({ ...islemForm, tarih: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ödeme Yöntemi</label>
                    <select value={islemForm.odemeYontemi} onChange={e => setIslemForm({ ...islemForm, odemeYontemi: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      {ODEME_YONTEMLERI.map(y => <option key={y}>{y}</option>)}
                    </select></div>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Kategori</label>
                  <select value={islemForm.kategori} onChange={e => setIslemForm({ ...islemForm, kategori: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                    {DEFTER_KATEGORILER.map(k => <option key={k}>{k}</option>)}
                  </select></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Etiketler <span className="text-neutral-400 font-normal">(virgülle ayırın — aramada ve raporda kullanılır)</span></label>
                  <input value={islemForm.etiketler} onChange={e => setIslemForm({ ...islemForm, etiketler: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" placeholder="örn: temmuz, şantiye, acil" /></div>
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
