import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Truck, Calendar, Phone, FileText, Upload, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, ChevronDown, ChevronUp, Briefcase, Car, Wallet, BookOpen, CheckSquare, Shield, Activity, ArrowUpRight, UserPlus, Camera, Edit, Ban, LogOut, Lock, Bell, User, Sparkles, Loader2, Copy, MessageSquareText, MessageCircle, Package, Database, Download, Save, Search, Key, ListTodo, Eye, EyeOff, FolderOpen, Scale, QrCode , Landmark, Plus, Trash2, RotateCcw, Building2 } from 'lucide-react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs, getDocsFromCache, query, orderBy, getDoc, limit, where } from 'firebase/firestore';
import { db, appId, auth, DEPO_LOCATIONS, MESAI_STATUS_OPTIONS, callGeminiAPI, isVideoUrl, normalizeCariName, normalizeCariPhone, CopyButton, MediaCaptureMenu, calculateMaterials, generateContractPDF, bildirimDestekleniyorMu, bildirimIzniIste, bildirimGonder,
  // YENİ: Resmi Ayarları ekranının kullandığı veri ve yardımcılar.
  // Sözleşme PDF'i ve WhatsApp mesajları da aynı kaynaktan okuyacağı için
  // bu tanımlar shared.jsx içinde tek noktada tutuluyor.
  VARSAYILAN_SOZLESME_GRUPLARI, VARSAYILAN_SOZLESME_KAPANIS, VARSAYILAN_BANKA_HESAPLARI,
  ibanBicimle, ibanGecerliMi, maddeSayisi, bankaBilgiMetni, resmiAyarlarRef,
  // YENİ: Resmi Ayarları'ndaki GÜNCEL banka bilgisini döndürür (canlı önbellek).
  aktifBankaBilgiMetni,
  // YENİ: İş kapandığında kalan bakiyeyi ilgili deftere gelir olarak yazar.
  defterGelirKaydet,
  // YENİ: Kaporayı banka defterine gelir olarak yazar.
  defterKaporaKaydet, HasarCozumBelgeleri } from './shared.jsx';
import { AddJobView, CustomerListView, CustomerProfileView , EskiVeriIceAktar, MusteriHavuzuView, SahaPortfoyView } from './Satis.jsx';
import { CurrentJobsView, AllJobsView, CompletedJobsView, CalendarView, DamagedJobsView, CancelledJobsView, IsOnaylamaTahtasiView, EkipKurmaTahtasiView, MyAssignedJobsView, IsMerkeziView, IsKilavuzuView, HatirlatmalarView } from './OperasyonIsler.jsx';
import { IzinTahtasiView, PuantajTahtasiView, AddPersonnelView, PersonnelListView, PersonnelProfileView, OzlukDosyalariView, PersonelTahtasiView, MesaiOnayButonlari, MesaiTakipView, MesaiTakipMenuButonu, CalismaProgramiBolumu, mesaiOnerileriHesapla, gunlukQrKayitlariGetir } from './OperasyonPersonel.jsx';
import { MaterialListView, AddVehicleView, VehicleMaintenanceView, VehicleProfileView } from './OperasyonAracMalzeme.jsx';
import { AddInfoView, ComplaintsView, MyComplaintSubmitView, PersonelBasvuruView, SirketEvraklariView, DavaDosyalariView, SirketBelgeleriView, AvukatDashboardView, SahaRaporlamasiView } from './OperasyonInsanKaynaklari.jsx';
import { ReportingView, AdvancedReportingView, FinanceDashboardView, PersonelMuhasebeView, PersonelOdemeView, FinansDefterView } from './Finans.jsx';
// NOT: Mesai Takip modülü artık ayrı bir dosya değil; kullanıcı isteğiyle
// Operasyon Bölümü'nün parçası olarak OperasyonPersonel.jsx içine taşındı
// (yukarıdaki OperasyonPersonel.jsx import satırından geliyor).
// NOT: MusteriHavuzuView ve SahaPortfoyView artık ayrı dosyalar değil;
// kullanıcı isteğiyle Satış Bölümü'nün parçası olarak Satis.jsx içine taşındı
// (yukarıdaki Satis.jsx import satırından geliyorlar).
// NOT: HatirlatmalarView ve IsKilavuzuView artık ayrı dosyalar değil;
// kullanıcı isteğiyle Operasyon Bölümü'nün parçası olarak OperasyonIsler.jsx
// içine taşındı (yukarıdaki OperasyonIsler.jsx import satırından geliyorlar).
// NOT: 2026-09 itibarıyla dev haldeki Operasyon.jsx dört dosyaya bölündü:
// OperasyonIsler.jsx, OperasyonPersonel.jsx, OperasyonAracMalzeme.jsx,
// OperasyonInsanKaynaklari.jsx. Eski dosya, geri dönüş ihtimaline karşı
// Operasyon_yedek.jsx adıyla (hiçbir yerden import edilmeden) saklanıyor.

  // ============================================================================
  // YENİ: MARKA LOGOSU BİLEŞENİ
  // Eskiden her logo yerinde onError içinde `outerHTML` ile DOM doğrudan
  // değiştiriliyordu. Bu YIKICI bir işlemdi: bir kez hata alındığında React o
  // düğümü artık güncelleyemiyor, Firebase'den gerçek logo gelse bile ekranda
  // kalıcı olarak "S" kutusu kalıyordu. Ayrıca eski varsayılan adres yüklenmediği
  // için ilk açılışta HER ZAMAN "S" görünüyordu.
  // Artık hata React state'inde tutuluyor ve logo adresi değişince otomatik
  // yeniden denenir; böylece gerçek logo gelir gelmez ekrana oturur.
  // ============================================================================
  const VARSAYILAN_LOGO = 'https://www.sembolevdeneve.com/wp-content/uploads/2026/07/favicon.webp';

  // ============================================================================
  // YENİ: SAYFA (MODÜL) KATALOĞU — "ANA ŞEMA"
  // Kişiye Özel Modül Yetkileri'nde görünen sayfa listesi artık kodda sabit değil;
  // Firebase'de (settings/company → moduleCatalog) tutulur ve "Modül Görüntüleme"
  // sayfasından yönetilir. Yeni bir sayfa geliştirildiğinde oradan eklenir,
  // gereksizler kaldırılır. Aşağıdaki liste yalnızca İLK KURULUM ve
  // "Varsayılanlara Sıfırla" için kullanılan başlangıç şemasıdır.
  // ============================================================================
  const VARSAYILAN_MODUL_KATALOGU = [
    { id: 'dashboard', label: 'Anasayfa' },
    { id: 'calendar', label: 'Takvim' },
    { id: 'profileSettings', label: 'Profilim' },
    { id: 'addInfo', label: 'Bilgilendirme Ekle' },
    { id: 'mySpecialTasks', label: 'Özel Görevlerim' },
    { id: 'addJob', label: 'Satış Bölümü' },
    // YENİ (kullanıcı talebi): Satış Bölümü'nün ALT SAYFALARI ayrı ayrı
    // yetkilendirilebilir. Bir alt sayfanın yetkisi kişiye özel VERİLMEMİŞSE,
    // üst "Satış Bölümü" (addJob) yetkisini miras alır (bkz. altSatisErisimi).
    // Böylece mevcut kullanıcılar kilitlenmez; sadece kısıtlamak isteyen
    // yönetici ilgili alt sayfayı buradan kapatır.
    { id: 'satisMusteriKayit', label: 'Satış: Müşteri Kayıt' },
    { id: 'satisMusteriHavuzu', label: 'Satış: Müşteri Havuzu' },
    { id: 'satisSahaPortfoy', label: 'Satış: Saha Portföy' },
    { id: 'operasyon', label: 'Operasyon Bölümü' },
    { id: 'jobList', label: 'İş Listesi' },
    { id: 'customers', label: 'Müşteri Listesi' },
    { id: 'personnel', label: 'Personel Listesi' },
    { id: 'todos', label: 'Yapılacak Listesi' },
    { id: 'finance', label: 'Finans Yönetimi' },
    { id: 'auth', label: 'Yetkilendirme' },
    { id: 'systemFiles', label: 'Sistem Dosyaları' },
    { id: 'myComplaint', label: 'Şikayet Bildirim' },
    { id: 'globalSearch', label: 'Arama Barı' },
    { id: 'globalSearchCustomer', label: 'Arama: Müşteri' },
    { id: 'globalSearchVehicle', label: 'Arama: Araç' },
    { id: 'globalSearchPersonnel', label: 'Arama: Personel' },
    { id: 'davaDosyalari', label: 'Dava Dosyaları' },
    { id: 'companyContacts', label: 'Şirket İletişimi Yönetimi' },
    { id: 'mesaiTakip', label: 'Mesai Takip' }, // YENİ: QR + konumlu mesai takip sayfası
    { id: 'hatirlatmalar', label: 'Hatırlatmalar' } // YENİ: sol menüdeki Hatırlatmalar sayfası
  ];


  const MarkaLogo = ({ logoUrl, className = '', style = {}, fallback = null, alt = 'Sembol Nakliyat' }) => {
    const [hata, setHata] = useState(false);
    const kaynak = logoUrl || VARSAYILAN_LOGO;
    // Adres değiştiğinde (ör. Firebase'den gerçek logo geldiğinde) tekrar dene
    useEffect(() => { setHata(false); }, [kaynak]);

    if (hata) {
      // Görsel yüklenemezse yerine geçecek içerik (her kullanım yeri kendi tasarımını verir)
      return fallback || (
        <div className="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg">S</div>
      );
    }
    return <img src={kaynak} alt={alt} className={className} style={style} onError={() => setHata(true)} />;
  };

  // ============================================================================
  // GÜNCELLENMİŞ DashboardView — Kendi App.jsx dosyanızdaki eski DashboardView
  // bileşeninin TAMAMININ yerine bunu koyun. Diğer hiçbir dosyaya/bileşene
  // dokunmanıza gerek yok. db ve appId zaten './shared.jsx' üzerinden modül
  // seviyesinde import edildiği için ekstra prop göndermenize gerek kalmadı.
  // ============================================================================
  const DashboardView = ({ jobs, allJobs, personnelList, currentUser, setViewingImage, transactions }) => {
    const [filterPeriod, setFilterPeriod] = useState('today');
    const [viewingDashboardJob, setViewingDashboardJob] = useState(null);
    // YENİ: "Son Kaydedilen İşler" için dönem filtresi (bugün/hafta/ay/tümü)
    const [sonKayitFilter, setSonKayitFilter] = useState('all');
    // YENİ: "Tümünü Gör" — liste varsayılan olarak 15 kayıtla sınırlıdır, butonla tamamı açılır
    const [sonKayitHepsi, setSonKayitHepsi] = useState(false);

    const isAdmin = ['Müdür', 'Firma Sahibi', 'Operasyon'].some(role => currentUser?.position?.includes(role) || currentUser?.rank === role) || currentUser?.permissions?.canEdit;

    const today = new Date();
    // DÜZELTME: toISOString() tarihi UTC'ye kaydırdığı için gece/sabah saatlerinde
    // kayıtlar yanlış güne düşüyordu. Artık yerel (Türkiye) tarihine göre anahtar üretilir.
    const localGunKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = localGunKey(today);
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    // YENİ: Bir işin GERÇEK kayıt (oluşturulma) zamanını döndürür.
    // ÖNEMLİ: Artık taşıma tarihine (job.date) geri düşülmez! Eskiden createdAt yoksa
    // taşıma tarihi kayıt zamanı sanılıyor, ileri tarihli işler "bugün kaydedilmiş"
    // gibi görünüyordu. Gerçek kayıt zamanı yoksa null döner.
    const getKayitZamani = (job) => {
      const ham = job?.createdAt || job?.createdDate || job?.kayitTarihi || job?.timestamp;
      if (!ham) return null;
      // Firestore Timestamp nesnesi gelirse saniyeden çevir
      const t = (typeof ham === 'object' && ham.seconds) ? new Date(ham.seconds * 1000) : new Date(ham);
      if (isNaN(t.getTime())) return null;
      // DÜZELTME: Bir kayıt GELECEKTE oluşturulmuş olamaz. Eski sistem aktarımında
      // createdAt alanı taşıma tarihine eşitlendiği için ileri tarihli işlerde
      // (örn. 2030/2032 taşıma tarihi) kayıt zamanı gelecekte görünüyordu; bu da
      // "Son Kaydedilen İşler > Tümü" listesinde bu kayıtların en üstte kalmasına,
      // gerçekten en son kaydedilen işin aşağıda kaybolmasına yol açıyordu.
      // Gelecek tarihli kayıt zamanları güvenilmez sayılır (saat dilimi farkları için
      // 1 günlük pay bırakılır) ve zamanı bilinmeyen kayıt gibi davranır: listenin
      // sonuna düşer, dönem filtrelerine girmez.
      const ustSinir = new Date();
      ustSinir.setDate(ustSinir.getDate() + 1);
      if (t > ustSinir) return null;
      return t;
    };

    const matchesPeriod = (d) => {
      if (filterPeriod === 'all') return true;
      if (!d || isNaN(d.getTime())) return false; // geçersiz/eksik tarih dönem filtrelerine girmez
      if (filterPeriod === 'today') return localGunKey(d) === todayStr;
      if (filterPeriod === 'week') {
        // DÜZELTME: Haftaya ÜST SINIR eklendi. Önceden sadece "haftanın başından sonrası"
        // kontrol ediliyordu; bu yüzden gelecek tarihli tüm kayıtlar da "Bu Hafta" sayılıyordu.
        const day = today.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const weekStart = new Date(today); weekStart.setDate(today.getDate() - diffToMonday); weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7); // Pazartesi 00:00 (dahil değil)
        return d >= weekStart && d < weekEnd;
      }
      if (filterPeriod === 'month') return d.getMonth() === todayMonth && d.getFullYear() === todayYear;
      if (filterPeriod === 'lastMonth') {
        const lastMonthDate = new Date(todayYear, todayMonth - 1, 1);
        const lastMonthEnd = new Date(todayYear, todayMonth, 0, 23, 59, 59, 999);
        return d >= lastMonthDate && d <= lastMonthEnd;
      }
      if (filterPeriod === 'year') return d.getFullYear() === todayYear;
      return true;
    };

    const dashboardJobs = jobs.filter(j => matchesPeriod(new Date(j.date)));

    // YENİ: SATIŞ BÖLÜMÜ KAYITLARI — "Kayıt İstatistiği" artık yalnızca Satış Bölümü'nden
    // girilen GERÇEK kayıtları sayar. Önceki sürümde sayılar şişiyordu, çünkü:
    //  1) Nakliye/Depo kaydı açılırken sistemin otomatik ürettiği 0₺'lik "Asansör Kurulum"
    //     kaydı da ayrı bir kayıt gibi sayılıyordu.
    //  2) Çok günlü işlerde (durationDays > 1) her gün için ayrı doküman açıldığından
    //     tek bir satış kaydı birden fazla kez sayılıyordu.
    // Bu kayıtların hepsi AYNI teslim kodunu (deliveryCode) paylaştığı için gruplayıp
    // her gruptan tek bir temsilci kayıt alıyoruz.
    const otomatikAsansorMu = (j) => j.type === 'Asansör' && typeof j.contractDetails === 'string' && j.contractDetails.includes('Otomatik Oluşturulan Asansör');

    const satisKayitlari = (() => {
      const gruplar = new Map();
      jobs.forEach(j => {
        const anahtar = j.deliveryCode || j.id; // teslim kodu yoksa kaydın kendisi tekil sayılır
        if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
        gruplar.get(anahtar).push(j);
      });
      const sonuc = [];
      gruplar.forEach(grup => {
        // Temsilci: otomatik asansör kaydı değil, en erken oluşturulan gerçek satış kaydı
        const gercekler = grup.filter(j => !otomatikAsansorMu(j));
        const kaynak = gercekler.length ? gercekler : grup;
        const aday = kaynak.slice().sort((a, b) => {
          const ta = getKayitZamani(a), tb = getKayitZamani(b);
          if (ta && tb) return ta - tb;
          if (ta) return -1; if (tb) return 1;
          return String(a.date || '').localeCompare(String(b.date || ''));
        })[0];
        // Bir satış kaydı, kendisine ait tüm gün kayıtları iptal edildiyse "iptal" sayılır
        const iptalMi = kaynak.every(j => j.status === 'cancelled');
        sonuc.push({ ...aday, __iptalMi: iptalMi });
      });
      return sonuc;
    })();

    // Kayıt istatistikleri: gerçek kayıt zamanına göre dönem filtresi uygulanır.
    // Kayıt zamanı olmayan eski kayıtlar yalnızca "Tümü" seçildiğinde sayılır.
    const registrationJobs = satisKayitlari.filter(j => {
      const t = getKayitZamani(j);
      if (!t) return filterPeriod === 'all';
      return matchesPeriod(t);
    });

    // YENİ: Mavi Yaka mı, Beyaz Yaka mı olduğunu belirle
    const isMaviYaka = currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position));

    // YENİ: Duyuru / Paylaşım / En İyiler bilgilendirmeleri
    const [latestInfo, setLatestInfo] = useState({ announcements: [], posts: [], bestEmps: [] });
    useEffect(() => {
      const annRef = collection(db, 'artifacts', appId, 'public', 'data', 'announcements');
      const postRef = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
      const bestRef = collection(db, 'artifacts', appId, 'public', 'data', 'bestEmployees');

      const qAnn = query(annRef, orderBy('timestamp', 'desc'), limit(15));
      const qPost = query(postRef, orderBy('timestamp', 'desc'), limit(15));
      const qBest = query(bestRef, orderBy('timestamp', 'desc'), limit(15));

      const filterAndSort = (docs) => docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter(item => !item.hidden)
        .sort((a, b) => (a.sortOrder ?? a.timestamp ?? 0) - (b.sortOrder ?? b.timestamp ?? 0));

      const unsubs = [];
      unsubs.push(onSnapshot(qAnn, snap => setLatestInfo(prev => ({ ...prev, announcements: filterAndSort(snap.docs) }))));
      unsubs.push(onSnapshot(qPost, snap => setLatestInfo(prev => ({ ...prev, posts: filterAndSort(snap.docs) }))));
      unsubs.push(onSnapshot(qBest, snap => setLatestInfo(prev => ({ ...prev, bestEmps: filterAndSort(snap.docs) }))));
      return () => unsubs.forEach(u => u());
    }, []);

    const handleDeleteInfo = async (colName, id) => {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id)); } catch (err) { console.error('Silme hatası:', err); }
    };

    // YENİ: Aylık puan + Bugün/Dün mesai ve yorum(puan) durumu
    const [myScore, setMyScore] = useState(0);
    // NOT: dailyData state'i, "Bugün/Dün Özeti" kartları kaldırıldığı için silindi.
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchMyScoreAndStatus = async () => {
      if (!currentUser?.id) return;
      try {
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = yesterday.getMonth() + 1;
        const yDay = yesterday.getDate();

        const docRefPuantaj = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${currentYear}_${currentMonth}`);
        const snapPuantaj = await getDoc(docRefPuantaj);
        let currentMonthPuantajRecords = {};
        if (snapPuantaj.exists()) {
          currentMonthPuantajRecords = snapPuantaj.data().records || {};
          const myRecord = currentMonthPuantajRecords[currentUser.id] || {};
          const total = Object.values(myRecord).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
          setMyScore(total);
        }

        // ====================================================================
        // OKUMA TASARRUFU: "BUGÜN / DÜN ÖZETİ" kartları kaldırıldığı için
        // yalnızca o kartlar için yapılan 3 ek Firestore okuması (dünün puantaj
        // belgesi + bugünün ve dünün mesai belgeleri) de kaldırıldı.
        // Aylık puan rozeti (myScore) yukarıdaki TEK okumadan hesaplanmaya
        // devam ediyor.
        // ====================================================================
      } catch (error) {
        console.error('Veriler yüklenemedi', error);
      }
    };

    useEffect(() => {
      if (!isMaviYaka || !currentUser) return;
      fetchMyScoreAndStatus();
    }, [currentUser, isMaviYaka]);

    const handleRefresh = async () => {
      setIsRefreshing(true);
      await fetchMyScoreAndStatus();
      setTimeout(() => setIsRefreshing(false), 800);
    };

    let scoreColor = '', scoreTextColor = '', scoreMessage = '', scoreIcon = null;
    if (myScore < 10) {
      scoreColor = 'bg-red-50 border-red-200'; scoreTextColor = 'text-red-600';
      scoreMessage = 'Daha iyi! Azimlen, başarabilirsin! 💪'; scoreIcon = <AlertTriangle className="w-6 h-6 text-red-600" />;
    } else if (myScore < 25) {
      scoreColor = 'bg-yellow-50 border-yellow-200'; scoreTextColor = 'text-yellow-600';
      scoreMessage = 'Gayret! Potaya girmeye az kaldı! 🏃‍♂️'; scoreIcon = <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
    } else {
      scoreColor = 'bg-green-50 border-green-200'; scoreTextColor = 'text-green-600';
      scoreMessage = 'Birinciliğe göz dikmişsin! Çok iyisin, en iyisi olacaksın! 🏆'; scoreIcon = <CheckCircle className="w-6 h-6 text-green-600" />;
    }

    // NOT: renderDailySummary fonksiyonu da kaldırıldı (artık çağrılmıyor).

    // GÜNCELLENDİ: Pozisyona/rütbeye göre günlük motive edici mesaj — hem Beyaz Yaka hem Mavi Yaka için
    const getDailyMotivation = () => {
      const pos = currentUser?.position || '';
      const rank = currentUser?.rank || '';
      const messagePools = {
        'Firma Sahibi': [
          'Kurduğun bu düzen, her gün büyüyen bir başarı hikayesi. Bugün de vizyonunla fark yarat!',
          'Bir liderin gücü, ekibine ilham vermesindedir. Bugün harika işlere imza atacaksın!',
          'Her karar, şirketini bir adım öteye taşıyor. Bugün de doğru yoldasın!',
          'Başarı tesadüf değil, senin emeğinin sonucudur. Gününe güçlü başla!'
        ],
        'Muhasebe': [
          'Her rakam senin titizliğinle anlam kazanıyor. Bugün de kusursuz bir gün olacak!',
          'Düzenin ve dikkatin, şirketin sağlam temeli. İyi çalışmalar!',
          'Detaylara verdiğin önem fark yaratıyor. Bugün de her şey yerli yerinde!'
        ],
        'Satış Sorumlusu': [
          'Her görüşme yeni bir fırsat! Bugün gülümsemenle kazandır.',
          'Bir "evet" için attığın her adım değerli. Bugün rekor kırma günü!',
          'Müşterinin güveni senin en büyük sermayen. Bugün de kazandıracaksın!'
        ],
        'Operatör': [
          'Sahadaki gözün, kulağın sensin. Bugün de her operasyon senin sayende sorunsuz!',
          'Koordinasyon senin işin, başarı ise sonucu. Harika bir gün olsun!'
        ],
        'Ekip Şefi': [
          'Ekibinin pusulası sensin. Bugün de onlara güvenle yol göster, hepiniz birlikte kazanın!',
          'İyi bir ekip şefi, işi değil insanı yönetir. Bugün ekibine değer kattığın bir gün olsun!',
          'Senin liderliğin, sahadaki her işin kalitesini belirliyor. Gururla ve dikkatle devam et!',
          'Zor işleri kolay hale getiren tecrüben. Bugün de ekibine örnek ol!'
        ],
        'Heryerden Usta': [
          'Ustalığın, ekibin en büyük güvencesi. Bugün de işini titizlikle tamamla!',
          'Deneyimin, her operasyonda fark yaratıyor. Ekibine yol gösterirken kendine de güven!',
          'Emeğinle şekillenen her iş, senin imzanı taşıyor. Bugün de iyi bir gün olsun!'
        ],
        'Kalfa': [
          'Ustalığın, ekibin en büyük güvencesi. Bugün de işini titizlikle tamamla!',
          'Deneyimin, her operasyonda fark yaratıyor. Ekibine yol gösterirken kendine de güven!',
          'Emeğinle şekillenen her iş, senin imzanı taşıyor. Bugün de iyi bir gün olsun!'
        ],
        'Şoför': [
          'Direksiyondaki güvenin, tüm ekibin güvenliği demek. Yolun açık, işin bereketli olsun!',
          'Her sefer bir sorumluluk, her varış bir başarı. Bugün de dikkatli ve güvenli sür!',
          'Zamanında ve güvenle taşıdığın her yük, güveninin bir kanıtı. İyi yolculuklar!'
        ],
        'Taşıma Elemanı': [
          'Alın terinle taşıdığın her eşya, bir ailenin anısını taşıyor. Bugün de özenle çalış!',
          'Gücün kadar özenin de değerli. Bugün de sağlam ve dikkatli bir gün geçir!',
          'Her kutuda, her eşyada emeğin var. Bugün de gururla çalış!',
          'Zorluklar seni yıldırmaz, çünkü sen bu işin ustasısın. İyi çalışmalar!'
        ],
        'Mobilya Ustası': [
          'Ellerinin değdiği her mobilya, ustalığınla yeniden hayat buluyor. Bugün de titizlikle çalış!',
          'Sökülen, kurulan her eşya senin becerinle güvenceye alınıyor. Harika bir gün olsun!'
        ],
        'Depo Sorumlusu': [
          'Düzenin ve dikkatin, deponun güvencesi. Bugün de her şey yerli yerinde olsun!',
          'Emanet edilen her eşya senin sorumluluğunda güvende. İyi çalışmalar!'
        ],
        'Temizlik Görevlisi': [
          'Her temiz köşe, senin emeğinin bir kanıtı. Bugün de işini gururla yap!',
          'Düzen ve temizlik, senin elinden çıkan bir sanat. İyi çalışmalar!'
        ]
      };
      const generalPool = [
        'Bugün, dün yapamadığını başarmak için yeni bir fırsat. Haydi başla!',
        'Küçük adımlar büyük başarılar getirir. Bugün de bir adım daha at!',
        'Emeğin asla boşa gitmez. Bugün de elinden gelenin en iyisini yap!',
        'Gülümse, çünkü bugün senin günün. Enerjinle etrafına ilham ver!',
        'Her yeni gün, yeni bir başlangıçtır. Bugünü değerlendir!',
        'Başarı, pes etmeyenlerin ödülüdür. Bugün de kararlılıkla ilerle!',
        'Takımın bir parçası olman, onu güçlü kılıyor. İyi çalışmalar!'
      ];
      const pool = (messagePools[rank] && messagePools[rank].length > 0) ? messagePools[rank]
        : (messagePools[pos] && messagePools[pos].length > 0) ? messagePools[pos]
        : generalPool;
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      return pool[dayOfYear % pool.length];
    };
    const motivationColors = [
      'from-red-50 to-orange-50 border-red-300 text-red-800',
      'from-blue-50 to-cyan-50 border-blue-300 text-blue-800',
      'from-green-50 to-emerald-50 border-green-300 text-green-800',
      'from-purple-50 to-fuchsia-50 border-purple-300 text-purple-800',
      'from-orange-50 to-amber-50 border-orange-300 text-orange-800',
      'from-teal-50 to-cyan-50 border-teal-300 text-teal-800'
    ];
    const dayOfYearForColor = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const motivationColor = motivationColors[dayOfYearForColor % motivationColors.length];

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* HOŞ GELDİNİZ + (Mavi Yaka için) AYLIK PUAN */}
        {/* BOYUT: Kart yaklaşık %20 küçültüldü (p-6 -> p-5, başlık 2xl -> xl,
            açıklama 14px -> 12px). Ad-soyad ve açıklama TEK SATIRDA tutulur;
            uzun isimlerde satır kırılmak yerine üç nokta ile kısalır. */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-3 w-full lg:w-auto min-w-0">
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-black text-black whitespace-nowrap overflow-hidden text-ellipsis">Hoş Geldiniz, {currentUser?.fullName}</h2>
              <p className="text-neutral-500 font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis">Sistemdeki genel operasyon özetini aşağıdan takip edebilirsiniz.</p>
            </div>
            {isMaviYaka && (
              <button onClick={handleRefresh} disabled={isRefreshing} className="ml-auto p-2 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition shrink-0 shadow-sm border border-neutral-200" title="Günlük Özeti Yenile">
                <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-red-600' : ''}`} />
              </button>
            )}
          </div>
          {isMaviYaka && (
            <div className={`flex items-center gap-3 p-2.5 pr-4 rounded-2xl border ${scoreColor} shadow-sm shrink-0 w-full lg:w-auto animate-in slide-in-from-right-4`}>
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/50">{scoreIcon}</div>
              <div className="min-w-0">
                <div className="flex items-end gap-1.5 mb-0.5">
                  <span className={`text-xl font-black leading-none ${scoreTextColor}`}>{myScore.toString().replace('.', ',')}</span>
                  <span className="text-[10px] font-bold text-neutral-600 mb-0.5 uppercase tracking-wider">Aylık Puan</span>
                </div>
                <p className={`text-[11px] font-bold ${scoreTextColor} opacity-90 truncate`}>{scoreMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* YENİ: MESAİ GİRİŞ / ÇIKIŞ ONAY BUTONLARI — Hoş Geldiniz'in hemen altında.
            Yeşil buton = Mesai Giriş, Kırmızı buton = Mesai Çıkış. Butona basınca
            QR okuma kamerası direkt açılır ve konum kayda işlenir (MesaiTakip.jsx). */}
        <MesaiOnayButonlari currentUser={currentUser} />

        {/* GÜNLÜK MOTİVASYON — artık hem Beyaz Yaka hem Mavi Yaka'da (pozisyona/rütbeye göre) */}
        <div className={`bg-gradient-to-r ${motivationColor} border-2 p-5 rounded-2xl shadow-sm flex items-center gap-4 animate-in fade-in slide-in-from-top-2`}>
          <div className="w-12 h-12 bg-white/70 rounded-full flex items-center justify-center shrink-0 shadow-sm"><Sparkles className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-1">Günün Motivasyonu • {currentUser?.rank || currentUser?.position || 'Ekip'}</p>
            <p className="font-bold text-base leading-snug">{getDailyMotivation()}</p>
          </div>
        </div>

        {/* BİLGİLENDİRME: DUYURU / PAYLAŞIM / EN İYİLER */}
        {(latestInfo.announcements.length > 0 || latestInfo.posts.length > 0 || latestInfo.bestEmps.length > 0) && (
          <div className="flex flex-col gap-6 mb-2">
            {latestInfo.announcements.length > 0 && (
              <div className="flex flex-col gap-4 max-h-[340px] overflow-y-auto custom-scrollbar pr-2">
                {latestInfo.announcements.map((ann) => (
                  <div key={ann.id} className="bg-red-50 border border-red-200 p-4 md:p-5 rounded-2xl shadow-sm flex items-start gap-4 shrink-0 relative animate-in slide-in-from-top-4">
                    {isAdmin && <button onClick={() => handleDeleteInfo('announcements', ann.id)} className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-700 bg-white rounded-lg shadow-sm border border-red-100 transition"><X className="w-4 h-4"/></button>}
                    <div className="bg-white p-3 rounded-full shrink-0 shadow-sm border border-red-100"><Bell className="w-6 h-6 text-red-600" /></div>
                    <div className="flex-1 pr-8">
                      <h3 className="text-red-800 font-black text-lg flex flex-wrap items-center gap-2">{ann.title} <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full shadow-sm">DUYURU</span></h3>
                      <p className="text-red-700 text-sm font-medium mt-2 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                      <p className="text-red-500/80 text-[10px] mt-3 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {ann.dateStr} • {ann.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {latestInfo.posts.length > 0 && (
              <div className="flex flex-col gap-4 max-h-[640px] overflow-y-auto custom-scrollbar pr-2">
                {latestInfo.posts.map((post) => (
                  <div key={post.id} className="bg-blue-50 border border-blue-200 p-4 md:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center md:items-start gap-4 shrink-0 relative animate-in slide-in-from-top-4 delay-75">
                    {isAdmin && <button onClick={() => handleDeleteInfo('posts', post.id)} className="absolute top-3 right-3 p-1.5 text-blue-400 hover:text-blue-700 bg-white rounded-lg shadow-sm border border-blue-100 transition"><X className="w-4 h-4"/></button>}
                    <div className="bg-white p-3 rounded-full shrink-0 shadow-sm border border-blue-100 hidden md:block"><Sparkles className="w-6 h-6 text-blue-600" /></div>
                    <div className="flex-1 w-full pr-8">
                      <h3 className="text-blue-800 font-black text-lg flex flex-wrap items-center gap-2 mb-2">{post.title} <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-sm">SAHADAN KARELER</span></h3>
                      {post.imageUrl && (
                        <div className="w-full max-w-sm h-48 md:h-64 rounded-xl overflow-hidden shadow-sm border border-blue-100 cursor-pointer group relative" onClick={() => setViewingImage && setViewingImage({ title: post.title, name: post.imageUrl })}>
                          {isVideoUrl(post.imageUrl) ? (
                            <video src={post.imageUrl} className="w-full h-full object-cover bg-black" muted />
                          ) : (
                            <img src={post.imageUrl} alt="Paylaşım" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                          )}
                        </div>
                      )}
                      <p className="text-blue-500/80 text-[10px] mt-3 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {post.dateStr} • {post.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* EN İYİLER — ilk 3 kart direkt görünür, fazlası kaydırmalı. Sadece Mavi Yaka görür */}
            {isMaviYaka && latestInfo.bestEmps.length > 0 && (
              <div className="flex flex-col gap-4 max-h-[430px] overflow-y-auto custom-scrollbar pr-2">
                {latestInfo.bestEmps.map((bestEmp) => {
                  const bestEmpPerson = personnelList?.find(p => p.fullName === bestEmp.employeeName);
                  return (
                    <div key={bestEmp.id} className="bg-yellow-50 border border-yellow-200 p-4 md:p-5 rounded-2xl shadow-sm flex items-center gap-4 shrink-0 relative animate-in slide-in-from-top-4 delay-150">
                      {isAdmin && <button onClick={() => handleDeleteInfo('bestEmployees', bestEmp.id)} className="absolute top-3 right-3 p-1.5 text-yellow-500 hover:text-yellow-700 bg-white rounded-lg shadow-sm border border-yellow-200 transition"><X className="w-4 h-4"/></button>}
                      <div className="w-14 h-14 bg-white rounded-full shrink-0 shadow-sm border border-yellow-300 flex items-center justify-center overflow-hidden relative">
                        {bestEmpPerson?.profileImage ? (
                          <img src={bestEmpPerson.profileImage} alt={bestEmpPerson.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-1 border-2 border-white"><Star className="w-3 h-3 text-white fill-white"/></div>
                      </div>
                      <div className="flex-1 pr-8">
                        <h3 className="text-yellow-800 font-black text-lg flex flex-wrap items-center gap-2">{bestEmp.title} <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full shadow-sm">EN İYİLER</span></h3>
                        <p className="text-yellow-700 text-sm font-bold mt-1.5">Tebrikler <span className="text-black font-black bg-yellow-200 px-1.5 py-0.5 rounded">{bestEmp.employeeName}</span>! Başarılarının devamını dileriz. 👏</p>
                        <p className="text-yellow-600/80 text-[10px] mt-3 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {bestEmp.dateStr} • {bestEmp.author}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* NOT: "BUGÜN ÖZETİ" ve "DÜN ÖZETİ" blokları (mesai/puan durum kartları)
            kullanıcı isteğiyle Mavi Yaka ana sayfasından KALDIRILDI.
            Personel bugünkü mesai durumunu zaten üstteki QR Mesai kartında
            (Giriş 07:33 / Çıkış 19:26) görüyor.
            Ayrıca üretici fonksiyon renderDailySummary de artık çağrılmıyor. */}

        {/* ALINAN YORUMLAR — sadece Mavi Yaka */}
        {isMaviYaka && (allJobs || jobs).filter(j => j.pointsApproved && j.reviewImage).length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
            <h3 className="text-emerald-800 font-black flex items-center gap-2 mb-3"><Star className="w-5 h-5 fill-emerald-600 text-emerald-600" /> Alınan Yorumlar</h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {(allJobs || jobs).filter(j => j.pointsApproved && j.reviewImage).slice(0, 10).map(j => (
                <div key={j.id} className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden shrink-0 w-64 cursor-pointer group" onClick={() => setViewingImage && setViewingImage({ title: j.customerName, name: j.reviewImage })}>
                  <div className="h-36 bg-neutral-100 overflow-hidden relative">
                    {isVideoUrl(j.reviewImage) ? (
                      <video src={j.reviewImage} className="w-full h-full object-cover bg-black" muted />
                    ) : (
                      <img src={j.reviewImage} alt="Müşteri Yorumu" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">Müşteri Yorumu</p>
                    <p className="font-bold text-black text-sm truncate">{j.customerName}</p>
                    <p className="text-[10px] text-neutral-400 mt-1">{j.date}</p>
                    <div className="mt-2 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg inline-block">👏 Güzel Tebrikler!</div>
                    <p className="text-[10px] text-neutral-500 mt-2 flex items-center gap-1"><Users className="w-3 h-3" /><b>Yorum Alan Ekip:</b></p>
                    <p className="text-[10px] text-neutral-600">{j.team}</p>
                    {j.assignedVehiclePlate && (
                      <p className="text-[10px] text-purple-600 mt-1 flex items-center gap-1"><Truck className="w-3 h-3" /><b>Araç:</b> {j.assignedVehiclePlate}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAKIM ÇALIŞMASI & DESTEK PANOSU — sadece Mavi Yaka */}
        {isMaviYaka && (allJobs || jobs).filter(j => j.pointsApproved && j.supportPersonnelIds && j.supportPersonnelIds.length > 0).length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-600 border border-blue-200 p-4 rounded-2xl shadow-sm">
            <h3 className="text-blue-800 font-black flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5 text-blue-600" /> Takım Çalışması & Destek Panosu</h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {(allJobs || jobs).filter(j => j.pointsApproved && j.supportPersonnelIds && j.supportPersonnelIds.length > 0).slice(0, 10).map(j => (
                <div key={j.id} className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4 shrink-0 w-72">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-blue-600" /></div>
                    <div>
                      <p className="text-[10px] text-neutral-400 font-bold">{j.date}</p>
                      <p className="font-bold text-black text-sm">{j.customerName}</p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 mb-3 leading-relaxed">Zorlu anlarda takım arkadaşlarını yalnız bırakmayıp destek olan kahramanlarımız! Diğer takım arkadaşlarına yardımcı olduğunuz için teşekkür eder, tebrik ederiz. Harika bir iş çıkardınız! 🏆💪</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(j.supportPersonnelIds || []).map(pid => {
                      const p = personnelList?.find(pp => String(pp.id) === String(pid));
                      return (
                        <span key={pid} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {p ? p.fullName : 'Personel'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* YENİ: İş İstatistikleri, Kayıt İstatistiği ve Son Kaydedilen İşler — sadece Beyaz Yaka'da gösterilir */}
        {!isMaviYaka && (
        <>
        <div className="flex justify-between items-end">
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">İş İstatistikleri</h3>
          <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="px-3 py-1.5 text-sm font-bold bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-red-600 transition shadow-sm cursor-pointer">
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta</option>
            <option value="month">Bu Ay</option>
            <option value="lastMonth">Geçen Ay</option>
            <option value="year">Bu Yıl</option>
            <option value="all">Tüm Zamanlar</option>
          </select>
        </div>

        {/* İŞ İSTATİSTİKLERİ — "Bekleyen" kartı kaldırıldı; 3 kart üzerinden takip edilir */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Toplam İş</p>
            <p className="text-2xl font-black text-black mb-2">{dashboardJobs.length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.type === 'Nakliye' || !j.type).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 border-l-4 border-l-red-600 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Sahada (Devam)</p>
            <p className="text-2xl font-black text-red-600 mb-2">{dashboardJobs.filter(j => j.status === 'in-progress').length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.status === 'in-progress' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.status === 'in-progress' && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.status === 'in-progress' && j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          <div className="bg-black p-4 rounded-2xl shadow-sm border border-black flex flex-col justify-between">
            <p className="text-neutral-400 text-sm font-medium mb-1">Tamamlanan</p>
            <p className="text-2xl font-black text-white mb-2">{dashboardJobs.filter(j => j.status === 'completed').length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{dashboardJobs.filter(j => j.status === 'completed' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{dashboardJobs.filter(j => j.status === 'completed' && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{dashboardJobs.filter(j => j.status === 'completed' && j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end mt-2">
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Kayıt İstatistiği</h3>
        </div>
        {/* KAYIT İSTATİSTİĞİ — sadece Satış Bölümü'nden girilen kayıtlar; 2 kart üzerinden takip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Toplam Kayıt</p>
            <p className="text-2xl font-black text-black mb-2">{registrationJobs.length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{registrationJobs.filter(j => j.type === 'Nakliye' || !j.type).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{registrationJobs.filter(j => j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{registrationJobs.filter(j => j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          {/* İptal Edilen Kayıt — yukarıdaki toplamın alt kümesidir, böylece iki kart her zaman tutarlıdır */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 border-l-4 border-l-red-500 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">İptal Edilen Kayıt</p>
            <p className="text-2xl font-black text-red-600 mb-2">{registrationJobs.filter(j => j.__iptalMi).length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{registrationJobs.filter(j => j.__iptalMi && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{registrationJobs.filter(j => j.__iptalMi && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{registrationJobs.filter(j => j.__iptalMi && j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-80 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-neutral-100 pb-2">
            <h3 className="text-lg font-bold text-black flex items-center gap-2"><ClipboardList className="w-5 h-5 text-red-600" /> Son Kaydedilen İşler</h3>
            {/* YENİ: Dönem filtresi — kaydedilme (createdAt) tarihine göre bugün/hafta/ay/tümü */}
            <div className="flex bg-neutral-100 p-1 rounded-xl flex-wrap gap-0.5">
              {[{ k: 'today', l: 'Bugün' }, { k: 'week', l: 'Bu Hafta' }, { k: 'month', l: 'Bu Ay' }, { k: 'all', l: 'Tümü' }].map(opt => (
                <button key={opt.k} type="button" onClick={() => setSonKayitFilter(opt.k)} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${sonKayitFilter === opt.k ? 'bg-white text-red-600 shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
            {(() => {
              // DÜZELTME: Dönem filtresi artık GERÇEK kayıt zamanına (createdAt) göre ve
              // ALT+ÜST SINIRLI çalışır. Önceki sürümde iki hata vardı:
              //  1) createdAt yoksa taşıma tarihine (job.date) düşülüyordu → ileri tarihli işler
              //     "bugün kaydedilmiş" görünüyordu (ekrandaki 09.08.2026 03:00 hatası).
              //  2) Aralıkların üst sınırı yoktu (sadece "t >= başlangıç") → gelecek tarihli
              //     her kayıt Bugün/Bu Hafta/Bu Ay filtrelerinden geçiyordu.
              const now = new Date();
              const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const endOfDay = new Date(startOfDay); endOfDay.setDate(startOfDay.getDate() + 1);
              const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7)); // Pazartesi başlangıç
              const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7);
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

              const inRange = (job) => {
                if (sonKayitFilter === 'all') return true;
                const t = getKayitZamani(job);
                if (!t) return false; // kayıt zamanı bilinmeyen eski kayıtlar sadece "Tümü"de görünür
                if (sonKayitFilter === 'today') return t >= startOfDay && t < endOfDay;
                if (sonKayitFilter === 'week') return t >= startOfWeek && t < endOfWeek;
                if (sonKayitFilter === 'month') return t >= startOfMonth && t < endOfMonth;
                return true;
              };

              // Kaydedilme zamanını okunabilir biçimde göster (yoksa null → sahte tarih yazılmaz)
              const formatKayitZamani = (job) => {
                const t = getKayitZamani(job);
                if (!t) return null;
                return t.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              };

              // YENİ: Asansör işleri bu listede gösterilmez — sadece Nakliye ve Depo kayıtları listelenir.
              const nakliyeVeyaDepo = (j) => j.type === 'Depo' || j.type === 'Nakliye' || !j.type;

              // En son kaydedilen en üstte olacak şekilde sırala (kayıt zamanı olmayanlar en sona)
              const tumListe = jobs.slice()
                .filter(nakliyeVeyaDepo)
                .filter(inRange)
                .sort((a, b) => {
                  const ta = getKayitZamani(a), tb = getKayitZamani(b);
                  if (ta && tb) return tb - ta;
                  if (ta) return -1;
                  if (tb) return 1;
                  return new Date(b.date) - new Date(a.date);
                });

              // Varsayılan 15 kayıt; "Tümünü Gör" ile tamamı açılır
              const LIMIT = 15;
              const list = sonKayitHepsi ? tumListe : tumListe.slice(0, LIMIT);
              const gizliSayisi = tumListe.length - list.length;

              if (tumListe.length === 0) return <p className="text-center text-neutral-400 text-xs py-4">Bu dönemde kaydedilmiş iş yok.</p>;
              return (<>
                {list.map(job => (
                <div key={job.id} onClick={() => setViewingDashboardJob(job)} className="p-3 bg-neutral-50 hover:bg-neutral-100 cursor-pointer rounded-xl border border-neutral-100 flex justify-between items-center text-sm transition">
                  <div>
                    <p className="font-bold text-black">{job.customerName}</p>
                    <p className="text-[10px] text-neutral-500">Taşıma: {job.date} - {job.time}</p>
                    {/* Kaydın gerçekten ne zaman oluşturulduğu; bilinmiyorsa dürüstçe belirtilir */}
                    {formatKayitZamani(job) ? (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Kaydedildi: {formatKayitZamani(job)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-neutral-400 font-bold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Kayıt zamanı yok (eski kayıt)
                      </p>
                    )}
                    <p className="text-[10px] text-neutral-400 font-medium">Kaydeden: <span className="font-bold text-neutral-600">{job.createdBy || 'Bilinmiyor'}</span></p>
                  </div>
                  <span className={`text-[9px] px-2 py-1 rounded font-bold text-white uppercase shrink-0 ml-2 ${job.type === 'Depo' ? 'bg-blue-600' : 'bg-red-600'}`}>{job.type || 'Nakliye'}</span>
                </div>
                ))}
                {/* YENİ: En altta "Tümünü Gör" / "Daha Az Göster" butonu */}
                {tumListe.length > LIMIT && (
                  <button type="button" onClick={() => setSonKayitHepsi(v => !v)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 text-xs font-black text-neutral-500 hover:text-red-600 hover:border-red-400 transition">
                    {sonKayitHepsi ? 'Daha Az Göster' : `Tümünü Gör (${gizliSayisi} kayıt daha)`}
                  </button>
                )}
              </>);
            })()}
          </div>
        </div>
        </>
        )}

        {viewingDashboardJob && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setViewingDashboardJob(null)}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className={`p-4 flex justify-between items-center text-white ${viewingDashboardJob.type === 'Depo' ? 'bg-blue-600' : viewingDashboardJob.type === 'Asansör' ? 'bg-green-600' : 'bg-red-600'}`}>
                <h3 className="font-bold text-lg flex items-center gap-2"><ClipboardList className="w-5 h-5" /> İş Bilgisi</h3>
                <button onClick={() => setViewingDashboardJob(null)} className="text-white/80 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 space-y-3 text-sm max-h-[70vh] overflow-y-auto">
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Müşteri</span><span className="font-black text-black">{viewingDashboardJob.customerName}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Tip</span><span className="font-black text-black">{viewingDashboardJob.type || 'Nakliye'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Tarih / Saat</span><span className="font-black text-black">{viewingDashboardJob.date} - {viewingDashboardJob.time}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Durum</span><span className="font-black text-black">{viewingDashboardJob.status || 'pending'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Kaydeden</span><span className="font-black text-black">{viewingDashboardJob.createdBy || 'Bilinmiyor'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Alış Adresi</span><span className="font-black text-black text-right">{viewingDashboardJob.fromProvince}/{viewingDashboardJob.fromDistrict}</span></div>
                {viewingDashboardJob.toProvince && (
                  <div className="flex justify-between"><span className="text-neutral-500 font-bold">Teslim Adresi</span><span className="font-black text-black text-right">{viewingDashboardJob.toProvince}/{viewingDashboardJob.toDistrict}</span></div>
                )}
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Ekip</span><span className="font-black text-black text-right">{viewingDashboardJob.team || 'Atanmadı'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Araç</span><span className="font-black text-black">{viewingDashboardJob.assignedVehiclePlate || '-'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500 font-bold">Fiyat</span><span className="font-black text-emerald-600">₺{(parseFloat(viewingDashboardJob.price) || 0).toLocaleString('tr-TR')}</span></div>
              </div>
            </div>
          </div>
        )}

        {isAdmin && !isMaviYaka && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-64 flex flex-col">
            <h3 className="text-sm font-bold text-black mb-3 flex items-center gap-2 border-b border-neutral-100 pb-2"><Briefcase className="w-4 h-4 text-red-600" /> Yeni Gelen Kayıt Olan Personel</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {personnelList.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8).map(p => (
                <div key={p.id} className="text-xs flex justify-between items-center p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                      {p.profileImage ? <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" /> : p.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-black block truncate">{p.fullName}</span>
                      <span className="text-[9px] font-bold text-neutral-400 block truncate">{p.collarType || '-'}</span>
                    </div>
                  </div>
                  <span className="text-neutral-500 shrink-0 ml-2">{p.position}</span>
                </div>
              ))}
              {personnelList.length === 0 && <p className="text-center text-neutral-400 text-xs py-4">Kayıtlı personel yok.</p>}
            </div>
          </div>
        )}
      </div>
    );
  };


  const AddTaskFormView = ({ newTask, setNewTask, handleAddTask, personnelList }) => (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <CheckSquare className="w-6 h-6 text-red-600" /> Yeni Görev Ekle
      </h2>
      <div  className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">Görev Başlığı</label>
          <input required type="text" value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" placeholder="Örn: Müşteri aramaları yapılacak" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-black mb-1">Detaylar</label>
          <textarea required value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none h-24 resize-none transition" placeholder="Görev açıklaması..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-black mb-1">Görevli</label>
            <select value={newTask.assignee} onChange={(e) => setNewTask({...newTask, assignee: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition">
              <option value="Tüm Personeller">Tüm Personeller</option>
              {personnelList.map(person => <option key={person.id} value={person.fullName}>{person.fullName}</option>)}
              <option value="Muhasebe">Muhasebe Departmanı</option>
              <option value="Yönetim">Yönetim Kurulu</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1">Tarih</label>
            <input required type="date" value={newTask.date} onChange={(e) => setNewTask({...newTask, date: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" />
          </div>
        </div>

        <button type="button" onClick={handleAddTask} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
          <PlusCircle className="w-5 h-5" /> Listeye Kaydet
        </button>
      </div>
    </div>
  );

  const TaskManagerView = ({ tasks, setShowTaskModal, draggingTask, setDraggingTask, openEditTask, handleUpdateTaskStatus, handleDeleteTask }) => {
    const columns = [
      { id: 'todo', title: 'YAPILACAKLAR', color: 'bg-neutral-800' },
      { id: 'in-progress', title: 'DEVAM EDENLER', color: 'bg-red-600' },
      { id: 'completed', title: 'TAMAMLANANLAR', color: 'bg-neutral-800' }
    ];

    const handleDragStart = (e, taskId) => {
      setDraggingTask(taskId);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetStatus) => {
      e.preventDefault();
      if (draggingTask) {
        handleUpdateTaskStatus(draggingTask, targetStatus);
        setDraggingTask(null);
      }
    };

    return (
      <div className="h-[calc(100vh-120px)] flex flex-col animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <CheckSquare className="w-7 h-7 text-red-600" /> Görev Yöneticisi
          </h2>
          <button 
            onClick={() => setShowTaskModal(true)}
            className="bg-black text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition shadow-lg"
          >
            <PlusCircle className="w-5 h-5" /> Yeni Görev Ekle
          </button>
        </div>

        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar items-start">
          {columns.map(column => {
            const columnTasks = tasks.filter(t => t.status === column.id);
            return (
              <div 
                key={column.id} 
                className="bg-neutral-50 rounded-2xl w-80 md:w-96 flex-shrink-0 flex flex-col max-h-full border border-neutral-200"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-white rounded-t-2xl shadow-sm">
                  <h3 className="font-bold text-black text-sm flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                    {column.title}
                  </h3>
                  <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2.5 py-1 rounded-lg border border-neutral-200">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
                  {columnTasks.sort((a, b) => new Date(b.date) - new Date(a.date)).map(task => (
                    <div 
                      key={task.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 hover:border-red-400 transition group flex flex-col gap-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-neutral-50 text-neutral-600 border-neutral-200 flex items-center gap-1">
                          <User className="w-3 h-3" /> {task.assignee}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => openEditTask(task)} className="text-blue-500 hover:text-blue-700 p-1"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteTask(task.id)} className="text-red-500 hover:text-red-700 p-1"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <h4 className="font-black text-black text-base leading-tight">{task.title}</h4>
                      <p className="text-xs text-neutral-600 whitespace-pre-wrap font-medium">{task.description}</p>
                      
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 bg-neutral-50 px-2 py-1.5 rounded-lg border border-neutral-200 mt-1 w-max">
                        <CalendarDays className="w-3.5 h-3.5 text-red-600" /> Tarih: {task.date}
                      </div>
                    </div>
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="text-center text-xs font-medium text-neutral-400 py-4">Bu alanda görev bulunmuyor.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const AddTodoView = ({ newTodo, setNewTodo, handleAddTodo }) => (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <ListTodo className="w-6 h-6 text-red-600" /> Yeni Yapılacak İş Ekle
      </h2>
      <div  className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">Başlık</label>
          <input required type="text" value={newTodo.title} onChange={(e) => setNewTodo({...newTodo, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: Araç muayenesi randevusu alınacak" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-black mb-1">Detaylar / Notlar</label>
          <textarea required value={newTodo.details} onChange={(e) => setNewTodo({...newTodo, details: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-24 resize-none transition" placeholder="Yapılacak işin detayları..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-black mb-1">Hatırlatma Tarihi</label>
            <input required type="date" value={newTodo.reminderDate} onChange={(e) => setNewTodo({...newTodo, reminderDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1">Önem Derecesi</label>
            <select value={newTodo.priority} onChange={(e) => setNewTodo({...newTodo, priority: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Düşük">Düşük</option>
              <option value="Normal">Normal</option>
              <option value="Yüksek">Yüksek</option>
              <option value="Acil">Acil</option>
            </select>
          </div>
        </div>

        <button type="button" onClick={handleAddTodo} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
          <PlusCircle className="w-5 h-5" /> Kaydet ve Ekle
        </button>
      </div>
    </div>
  );

  const TodoListView = ({ todos, handleUpdateTodoStatus, handleDeleteTodo, onAddClick }) => {
    const columns = [
      { id: 'todo', title: 'YAPILACAK', color: 'bg-neutral-800' },
      { id: 'in-progress', title: 'İŞLEME ALINDI', color: 'bg-blue-600' },
      { id: 'completed', title: 'YAPILDI', color: 'bg-green-600' }
    ];

    return (
      <div className="h-[calc(100vh-120px)] flex flex-col animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-red-600" /> Takip ve Yapılacak İşler
          </h2>
          {/* YENİ: "Yeni Ekle" artık sol menüde değil, burada sağ üstte bir buton */}
          <button
            onClick={onAddClick}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-black rounded-xl transition flex items-center gap-2 shadow-md shadow-red-600/20 shrink-0"
          >
            <PlusCircle className="w-4 h-4" /> Yeni Ekle
          </button>
        </div>

        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar items-start">
          {columns.map(column => (
            <div key={column.id} className="bg-neutral-100 rounded-2xl w-80 md:w-96 flex-shrink-0 flex flex-col max-h-full border border-neutral-200">
              <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-white rounded-t-2xl shadow-sm">
                <h3 className="font-bold text-black text-sm flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                  {column.title}
                </h3>
                <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2.5 py-1 rounded-lg border border-neutral-200">
                  {todos.filter(t => t.status === column.id).length} İş
                </span>
              </div>

              <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
                {todos.filter(t => t.status === column.id).sort((a,b) => new Date(a.reminderDate) - new Date(b.reminderDate)).map(todo => (
                  <div key={todo.id} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 hover:border-red-400 transition group flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          todo.priority === 'Acil' ? 'bg-red-50 text-red-700 border-red-200' :
                          todo.priority === 'Yüksek' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          todo.priority === 'Normal' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        Önem: {todo.priority}
                      </span>
                      <button onClick={() => handleDeleteTodo(todo.id)} className="text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <h4 className="font-black text-black text-base leading-tight">{todo.title}</h4>
                    <p className="text-xs text-neutral-600 whitespace-pre-wrap font-medium">{todo.details}</p>
                    
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 bg-neutral-50 px-2 py-1.5 rounded-lg border border-neutral-200 mt-1 w-max">
                      <CalendarDays className="w-3.5 h-3.5 text-red-600" /> Hatırlatma: {todo.reminderDate}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-3 mt-1 border-t border-neutral-100">
                      {todo.status !== 'todo' && <button onClick={() => handleUpdateTodoStatus(todo.id, 'todo')} className="flex-1 py-1.5 px-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition text-[10px] font-bold rounded-lg border border-neutral-200 text-center">Yapılacaklara Al</button>}
                      {todo.status !== 'in-progress' && <button onClick={() => handleUpdateTodoStatus(todo.id, 'in-progress')} className="flex-1 py-1.5 px-1 bg-blue-50 text-blue-700 hover:bg-blue-100 transition text-[10px] font-bold rounded-lg border border-blue-100 text-center">İşleme Al</button>}
                      {todo.status !== 'completed' && <button onClick={() => handleUpdateTodoStatus(todo.id, 'completed')} className="flex-1 py-1.5 px-1 bg-green-50 text-green-700 hover:bg-green-100 transition text-[10px] font-bold rounded-lg border border-green-100 text-center">Yapıldı</button>}
                    </div>
                  </div>
                ))}
                {todos.filter(t => t.status === column.id).length === 0 && (
                  <p className="text-center text-xs font-medium text-neutral-400 py-4">Bu alanda iş bulunmuyor.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PlaceholderView = ({ title, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-neutral-200 border-dashed animate-in fade-in">
      <div className="p-5 bg-neutral-100 rounded-full mb-4">
        <Icon className="w-12 h-12 text-black" />
      </div>
      <h2 className="text-2xl font-bold text-black mb-2">{title}</h2>
      <p className="text-neutral-500 text-center max-w-sm">
        Bu modül şu anda yapım aşamasındadır. En kısa sürede operasyon merkezinize entegre edilecektir.
      </p>
    </div>
  );

  const UserListView = ({ personnelList, onUpdate, onDelete, positions, ranks, positionModules, moduleCatalog }) => {
    const [editingUser, setEditingUser] = useState(null);
    // YENİ: Arama + pozisyon/yaka filtresi + alfabetik sıralama
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPosition, setFilterPosition] = useState('Tümü');
    const [filterCollar, setFilterCollar] = useState('Tümü');

    // YENİ: Kişiye Özel Modül Yetkileri'nde görünen sayfa listesi artık kodda sabit
    // değil; "Modül Görüntüleme" sayfasından yönetilen ANA ŞEMA'dan (Firebase:
    // settings/company → moduleCatalog) gelir. Katalog boşsa varsayılan liste kullanılır.
    const modules = (moduleCatalog && moduleCatalog.length > 0) ? moduleCatalog : VARSAYILAN_MODUL_KATALOGU;

    const handleToggleModule = (moduleId, currentMergedState) => {
        const currentModules = editingUser.permissions?.modules || {};
        const updatedPermissions = {
            ...editingUser.permissions,
            modules: {
                ...currentModules,
                [moduleId]: !currentMergedState
            }
        };
        setEditingUser({...editingUser, permissions: updatedPermissions});
    };

    // YENİ: Arama + Pozisyon/Yaka filtresi + Ad Soyad'a göre alfabetik sıralama (tr-TR)
    const filteredSortedPersonnel = personnelList
      .filter(p => {
        const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
        const matchQuery = !q || (p.fullName || '').toLocaleLowerCase('tr-TR').includes(q) || (p.email || '').toLocaleLowerCase('tr-TR').includes(q);
        const matchPosition = filterPosition === 'Tümü' || p.position === filterPosition;
        const matchCollar = filterCollar === 'Tümü' || (p.collarType || 'Mavi Yaka') === filterCollar;
        return matchQuery && matchPosition && matchCollar;
      })
      .sort((a, b) => (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR'));

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Users className="w-6 h-6 text-red-600" /> Mevcut Kullanıcılar ve Yetkileri
        </h2>
        
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium mb-6 border border-blue-200">
          Kullanıcıları düzenleyebilir, silebilir veya onlara <b>kişiye özel</b> modül erişim yetkileri atayabilirsiniz. Kişiye özel atanan yetkiler, pozisyon yetkilerini ezer.
        </div>

        {/* YENİ: Arama + Pozisyon/Yaka filtresi (liste her zaman ada göre alfabetik sıralı) */}
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="İsim veya e-posta ile ara..."
              className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600 transition" />
          </div>
          <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)}
            className="px-3 py-2.5 border border-neutral-300 rounded-xl text-sm bg-white font-medium text-neutral-700 outline-none focus:ring-2 focus:ring-red-600 cursor-pointer">
            <option value="Tümü">Tüm Pozisyonlar</option>
            {(positions || []).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterCollar} onChange={e => setFilterCollar(e.target.value)}
            className="px-3 py-2.5 border border-neutral-300 rounded-xl text-sm bg-white font-medium text-neutral-700 outline-none focus:ring-2 focus:ring-red-600 cursor-pointer">
            <option value="Tümü">Tüm Yakalar</option>
            <option value="Mavi Yaka">Mavi Yaka</option>
            <option value="Beyaz Yaka">Beyaz Yaka</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-white">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Ad Soyad</th>
                <th className="p-4 font-bold">Kullanıcı Adı / E-Posta</th>
                <th className="p-4 font-bold">Pozisyon / Rütbe</th>
                <th className="p-4 font-bold text-center">Durum</th>
                <th className="p-4 font-bold rounded-tr-xl text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredSortedPersonnel.map(person => (
                <tr key={person.id} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden shrink-0 border border-neutral-300">
                      {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" alt="Profil"/> : <User className="w-4 h-4 text-neutral-400"/>}
                    </div>
                    {person.fullName}
                  </td>
                  <td className="p-4 text-neutral-600 font-medium">{person.email}</td>
                  <td className="p-4 text-neutral-600">{person.position} <span className="text-xs text-neutral-400">({person.rank})</span></td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${person.employmentStatus === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {person.employmentStatus || 'Aktif'}
                    </span>
                  </td>
                  <td className="p-4 flex items-center justify-center gap-2">
                    <button onClick={() => setEditingUser(person)} className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition" title="Düzenle ve Özel Yetki Ver">
                      Düzenle & Yetkilendir
                    </button>
                    <button onClick={() => { if(window.confirm('Bu kullanıcıyı sistemden silmek istediğinize emin misiniz?')) onDelete(person.id); }} className="p-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition" title="Sil"><X className="w-4 h-4"/></button>
                  </td>
                </tr>
              ))}
              {filteredSortedPersonnel.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-neutral-500">
                    {searchQuery.trim() || filterPosition !== 'Tümü' || filterCollar !== 'Tümü' ? 'Aramanıza uygun kullanıcı bulunamadı.' : 'Kayıtlı kullanıcı bulunamadı.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
                <h3 className="font-bold text-lg">Kullanıcı Düzenle ve Yetkilendir</h3>
                <button onClick={() => setEditingUser(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div  className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Ad Soyad</label>
                      <input required type="text" value={editingUser.fullName || ''} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">E-Posta / Kullanıcı Adı</label>
                      <input required type="text" value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Şifre</label>
                      <input required type="text" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Durum</label>
                      <select value={editingUser.employmentStatus || 'Aktif'} onChange={e => setEditingUser({...editingUser, employmentStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-600">
                        <option value="Aktif">Aktif</option>
                        <option value="Pasif">Pasif</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Pozisyon</label>
                      <select value={editingUser.position || ''} onChange={e => setEditingUser({...editingUser, position: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-600">
                        {positions.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Rütbe</label>
                      <select value={editingUser.rank || ''} onChange={e => setEditingUser({...editingUser, rank: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-red-600">
                        {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                      <h4 className="font-bold text-black mb-3 border-b border-neutral-200 pb-2 flex items-center gap-2">
                          <Eye className="w-5 h-5 text-red-600" /> Kişiye Özel Modül Yetkileri
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {modules.map(mod => {
                          const isRoleAccess = positionModules?.[editingUser.position]?.[mod.id] || positionModules?.[editingUser.rank]?.[mod.id] || false;
                          const personalAccess = editingUser.permissions?.modules?.[mod.id];
                          const currentMergedState = typeof personalAccess === 'boolean' ? personalAccess : isRoleAccess;
                          const displayAccess = currentMergedState;

                          return (
                              <label key={mod.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${displayAccess ? 'bg-blue-50 border-blue-200' : 'bg-white border-neutral-200 hover:bg-neutral-100'}`}>
                              <span className={`text-xs font-bold ${displayAccess ? 'text-blue-800' : 'text-neutral-600'}`}>{mod.label}</span>
                              <div className="relative inline-flex items-center">
                                  <input type="checkbox" className="sr-only peer" checked={displayAccess} onChange={() => handleToggleModule(mod.id, currentMergedState)} />
                                  <div className="w-7 h-4 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                              </div>
                              </label>
                          );
                          })}
                      </div>
                  </div>
                  
                  <button type="button" onClick={(e) => { e.preventDefault(); onUpdate(editingUser); setEditingUser(null); }} className="w-full bg-red-600 text-white p-4 rounded-xl font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-lg mt-4">
                    <CheckCircle className="w-5 h-5" /> Değişiklikleri Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const PositionsView = ({ positions, onAddPosition, onDeletePosition, onUpdatePosition }) => {
    const [newPos, setNewPos] = useState('');
    // YENİ: Satır içi isim düzenleme — hangi pozisyon düzenleniyor ve geçici metin
    const [editingPos, setEditingPos] = useState(null);
    const [editValue, setEditValue] = useState('');

    const startEdit = (pos) => { setEditingPos(pos); setEditValue(pos); };
    const cancelEdit = () => { setEditingPos(null); setEditValue(''); };
    const saveEdit = () => {
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== editingPos) onUpdatePosition(editingPos, trimmed);
      cancelEdit();
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Briefcase className="w-6 h-6 text-red-600" /> Pozisyon Yönetimi
        </h2>
        <div  className="flex gap-2 mb-6">
          <input type="text" value={newPos} onChange={e => setNewPos(e.target.value)} placeholder="Yeni Pozisyon Adı" className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          <button type="button" onClick={e => { e.preventDefault(); if(newPos) { onAddPosition(newPos); setNewPos(''); } }} className="px-6 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition">Ekle</button>
        </div>
        <div className="space-y-2">
          {positions.map((pos, idx) => (
            <div key={idx} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-neutral-200 gap-2">
              {editingPos === pos ? (
                <>
                  {/* YENİ: İsim düzenleme modu — Enter ile kaydet, Esc ile vazgeç */}
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 p-2 border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 font-bold text-black"
                  />
                  <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition" title="Kaydet"><CheckCircle className="w-4 h-4" /></button>
                  <button onClick={cancelEdit} className="p-1.5 text-neutral-500 hover:bg-neutral-200 rounded-lg transition" title="Vazgeç"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <span className="font-bold text-black">{pos}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* YENİ: İsim Düzenle butonu */}
                    <button onClick={() => startEdit(pos)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="İsmi Düzenle"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => onDeletePosition(pos)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition" title="Sil"><X className="w-4 h-4" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };


  const RanksView = ({ ranks, onAddRank, onDeleteRank, onUpdateRank }) => {
    const [newRank, setNewRank] = useState('');
    // YENİ: Satır içi isim düzenleme — hangi rütbe düzenleniyor ve geçici metin
    const [editingRank, setEditingRank] = useState(null);
    const [editValue, setEditValue] = useState('');

    const startEdit = (rank) => { setEditingRank(rank); setEditValue(rank); };
    const cancelEdit = () => { setEditingRank(null); setEditValue(''); };
    const saveEdit = () => {
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== editingRank) onUpdateRank(editingRank, trimmed);
      cancelEdit();
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Star className="w-6 h-6 text-red-600" /> Rütbe Yönetimi
        </h2>
        <div  className="flex gap-2 mb-6">
          <input type="text" value={newRank} onChange={e => setNewRank(e.target.value)} placeholder="Yeni Rütbe Adı" className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          <button type="button" onClick={e => { e.preventDefault(); if(newRank) { onAddRank(newRank); setNewRank(''); } }} className="px-6 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition">Ekle</button>
        </div>
        <div className="space-y-2">
          {ranks.map((rank, idx) => (
            <div key={idx} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-neutral-200 gap-2">
              {editingRank === rank ? (
                <>
                  {/* YENİ: İsim düzenleme modu — Enter ile kaydet, Esc ile vazgeç */}
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 p-2 border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 font-bold text-black"
                  />
                  <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition" title="Kaydet"><CheckCircle className="w-4 h-4" /></button>
                  <button onClick={cancelEdit} className="p-1.5 text-neutral-500 hover:bg-neutral-200 rounded-lg transition" title="Vazgeç"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <span className="font-bold text-black">{rank}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* YENİ: İsim Düzenle butonu */}
                    <button onClick={() => startEdit(rank)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="İsmi Düzenle"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => onDeleteRank(rank)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition" title="Sil"><X className="w-4 h-4" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PermissionsView = ({ personnelList, handleUpdatePermissions, positions }) => {
    // YENİ: Arama + pozisyon/yaka filtresi + ada göre alfabetik sıralama (tr-TR)
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPosition, setFilterPosition] = useState('Tümü');
    const [filterCollar, setFilterCollar] = useState('Tümü');

    const filteredSortedPersonnel = personnelList
      .filter(p => {
        const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
        const matchQuery = !q || (p.fullName || '').toLocaleLowerCase('tr-TR').includes(q);
        const matchPosition = filterPosition === 'Tümü' || p.position === filterPosition;
        const matchCollar = filterCollar === 'Tümü' || (p.collarType || 'Mavi Yaka') === filterCollar;
        return matchQuery && matchPosition && matchCollar;
      })
      .sort((a, b) => (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR'));

    return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Shield className="w-6 h-6 text-red-600" /> İzinler Yönetimi
      </h2>
      <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-6 border border-red-200">
        Personellerin sisteme müdahale (veri ekleme, silme, düzenleme) ve sisteme giriş yetkilerini buradan yönetebilirsiniz. <b>Düzenleme Yetkisi</b> verilen personeller görüntüleyebildikleri modüllerde değişiklik yapabilirler. Sayfa görünürlükleri "Modül Görüntüleme" alanından belirlenir.
      </div>

      {/* YENİ: Arama + Pozisyon/Yaka filtresi (liste her zaman ada göre alfabetik sıralı) */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="İsim ile ara..."
            className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600 transition" />
        </div>
        <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)}
          className="px-3 py-2.5 border border-neutral-300 rounded-xl text-sm bg-white font-medium text-neutral-700 outline-none focus:ring-2 focus:ring-red-600 cursor-pointer">
          <option value="Tümü">Tüm Pozisyonlar</option>
          {(positions || []).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterCollar} onChange={e => setFilterCollar(e.target.value)}
          className="px-3 py-2.5 border border-neutral-300 rounded-xl text-sm bg-white font-medium text-neutral-700 outline-none focus:ring-2 focus:ring-red-600 cursor-pointer">
          <option value="Tümü">Tüm Yakalar</option>
          <option value="Mavi Yaka">Mavi Yaka</option>
          <option value="Beyaz Yaka">Beyaz Yaka</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
            <tr>
              <th className="p-4 font-bold rounded-tl-xl">Kullanıcı</th>
              <th className="p-4 font-bold">Pozisyon / Rütbe</th>
              <th className="p-4 font-bold text-center">Sisteme Giriş</th>
              <th className="p-4 font-bold text-center rounded-tr-xl">Düzenleme Yetkisi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredSortedPersonnel.map(user => (
              <tr key={user.id} className="hover:bg-neutral-50 transition">
                <td className="p-4 font-bold text-black">{user.fullName}</td>
                <td className="p-4 text-neutral-600">{user.position} - {user.rank}</td>
                <td className="p-4 text-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={user.permissions?.canView || false} onChange={e => handleUpdatePermissions(user.id, 'canView', e.target.checked)} />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </td>
                <td className="p-4 text-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={user.permissions?.canEdit || false} onChange={e => handleUpdatePermissions(user.id, 'canEdit', e.target.checked)} />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </td>
              </tr>
            ))}
            {filteredSortedPersonnel.length === 0 && (
              <tr>
                <td colSpan="4" className="p-6 text-center text-neutral-500">
                  {searchQuery.trim() || filterPosition !== 'Tümü' || filterCollar !== 'Tümü' ? 'Aramanıza uygun kullanıcı bulunamadı.' : 'Kayıtlı kullanıcı bulunamadı.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

// YENİDEN TASARLANDI: "Modül Görüntüleme" artık pozisyon bazlı toggle sayfası değil,
// SAYFA KATALOĞU (ANA ŞEMA) yönetim sayfasıdır. Buradaki liste, her kullanıcının
// "Kişiye Özel Modül Yetkileri" penceresinde görünen sayfaları belirler:
//   1) Önce buradan ana şema oluşturulur (sayfa ekle / kaldır),
//   2) Sonra "Mevcut Kullanıcılar"dan kişi kişi girip o sayfalar açılıp kapatılır.
// Yeni bir sayfa/bölüm geliştirildiğinde buradan eklenir; tüm değişiklikler
// anında Firebase'e (settings/company → moduleCatalog) kaydedilir.
// NOT: Eski pozisyon bazlı yetki VERİLERİ silinmez; arka planda geçerli olmaya
// devam eder (kişiye özel yetki > pozisyon > rütbe önceliği aynen korunur).
const ModuleAccessView = ({ moduleCatalog, addSystemLog }) => {
    const [yeniEtiket, setYeniEtiket] = useState('');
    const [yeniAnahtar, setYeniAnahtar] = useState('');
    const [hata, setHata] = useState('');
    const [kaydediliyor, setKaydediliyor] = useState(false);

    const katalog = (moduleCatalog && moduleCatalog.length > 0) ? moduleCatalog : VARSAYILAN_MODUL_KATALOGU;

    // Kataloğu Firebase'e yaz (tüm değişikliklerin tek kayıt noktası)
    const katalogKaydet = async (yeniListe, logMesaji) => {
      setKaydediliyor(true);
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { moduleCatalog: yeniListe });
        if (logMesaji) addSystemLog?.('Sayfa Kataloğu Güncellendi', logMesaji);
      } catch (err) { console.error(err); setHata('Kaydedilemedi: ' + err.message); }
      setKaydediliyor(false);
    };

    // Yeni sayfa ekleme
    const handleEkle = async () => {
      setHata('');
      const etiket = yeniEtiket.trim();
      // Anahtar: boşluklar temizlenir; girilmediyse etiketten otomatik türetilir
      let anahtar = yeniAnahtar.trim().replace(/\s+/g, '');
      if (!etiket) { setHata('Sayfa adı boş olamaz.'); return; }
      if (!anahtar) {
        anahtar = etiket.toLocaleLowerCase('tr-TR')
          .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİi]/g, 'i')
          .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
          .replace(/[^a-z0-9]+/g, '');
      }
      if (katalog.some(m => m.id === anahtar)) { setHata(`"${anahtar}" anahtarı zaten listede var.`); return; }
      await katalogKaydet([...katalog, { id: anahtar, label: etiket }], `"${etiket}" (${anahtar}) sayfası kataloğa eklendi.`);
      setYeniEtiket(''); setYeniAnahtar('');
    };

    // Sayfayı katalogdan kaldırma
    const handleKaldir = async (mod) => {
      if (!window.confirm(`"${mod.label}" sayfası katalogdan kaldırılacak.\n\nBu sayfa artık Kişiye Özel Modül Yetkileri listesinde GÖRÜNMEYECEK. Daha önce kişilere verilmiş yetki kayıtları silinmez; sayfayı tekrar eklerseniz aynı anahtarla geri gelir.\n\nDevam edilsin mi?`)) return;
      await katalogKaydet(katalog.filter(m => m.id !== mod.id), `"${mod.label}" (${mod.id}) sayfası katalogdan kaldırıldı.`);
    };

    // Varsayılan listeyi geri yükleme
    const handleSifirla = async () => {
      if (!window.confirm('Sayfa kataloğu varsayılan listeye sıfırlanacak. Sonradan eklediğiniz özel sayfalar listeden çıkar (yetki kayıtları silinmez). Devam edilsin mi?')) return;
      await katalogKaydet([...VARSAYILAN_MODUL_KATALOGU], 'Sayfa kataloğu varsayılan listeye sıfırlandı.');
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Eye className="w-6 h-6 text-red-600" /> Modül Görüntüleme — Sayfa Kataloğu (Ana Şema)
        </h2>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium mb-6 border border-blue-200">
          Buradaki liste, her kullanıcının <b>Kişiye Özel Modül Yetkileri</b> penceresinde görünen sayfaları belirler.
          Önce buradan <b>ana şemayı</b> oluşturun (sayfa ekleyin/kaldırın); sonra <b>Mevcut Kullanıcılar</b> bölümünden
          kişi kişi girip bu sayfaları o kullanıcıya özel açıp kapatın. Tüm değişiklikler anında kaydedilir.
        </div>

        {hata && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl p-3 mb-4">{hata}</div>}

        {/* YENİ SAYFA EKLEME */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-black text-neutral-700 uppercase tracking-wider mb-3 flex items-center gap-1.5"><PlusCircle className="w-4 h-4 text-red-600" /> Kataloğa Yeni Sayfa Ekle</p>
          <div className="flex flex-col md:flex-row gap-2">
            <input value={yeniEtiket} onChange={e => setYeniEtiket(e.target.value)} placeholder="Sayfa Adı (örn: Filo Takibi)"
              className="flex-1 p-3 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600 transition" />
            <input value={yeniAnahtar} onChange={e => setYeniAnahtar(e.target.value)} placeholder="Sistem Anahtarı (örn: filoTakibi)"
              className="flex-1 p-3 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600 transition font-mono" />
            <button onClick={handleEkle} disabled={kaydediliyor}
              className="px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition disabled:opacity-50 whitespace-nowrap">Ekle</button>
          </div>
          <p className="text-[11px] text-neutral-400 font-bold mt-2">
            Sistem anahtarı, yazılımdaki modül anahtarıyla <b>birebir aynı</b> olmalıdır (örn: davaDosyalari). Boş bırakırsanız sayfa adından otomatik türetilir.
          </p>
        </div>

        {/* KATALOG LİSTESİ */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-neutral-500 uppercase tracking-wider">Katalogdaki Sayfalar ({katalog.length})</p>
          <button onClick={handleSifirla} disabled={kaydediliyor} className="text-[11px] font-black text-neutral-400 hover:text-red-600 transition underline underline-offset-2">Varsayılanlara Sıfırla</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {katalog.map(mod => (
            <div key={mod.id} className="flex items-center justify-between gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2.5 hover:border-red-300 transition">
              <div className="min-w-0">
                <p className="text-sm font-bold text-black truncate">{mod.label}</p>
                <p className="text-[10px] font-mono text-neutral-400 truncate">{mod.id}</p>
              </div>
              <button onClick={() => handleKaldir(mod)} disabled={kaydediliyor}
                className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition shrink-0" title="Katalogdan Kaldır">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CompanyPasswordsView = ({ passwords, db, appId, addSystemLog }) => {
    const [formData, setFormData] = useState({ platform: '', link: '', username: '', password: '', notes: '', category: 'Genel' });
    const [editingId, setEditingId] = useState(null);
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [copiedField, setCopiedField] = useState(null);

    const [categories, setCategories] = useState(['Genel']);
    const [newCategory, setNewCategory] = useState('');
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    useEffect(() => {
      if (!db || !appId) return;
      const catRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'passwordCategories');
      const unsub = onSnapshot(catRef, (snap) => {
        if (snap.exists()) {
          setCategories(snap.data().list || ['Genel']);
        } else {
          setDoc(catRef, { list: ['Genel'] });
          setCategories(['Genel']);
        }
      });
      return () => unsub();
    }, [db, appId]);

    const handleAddCategory = async (e) => {
      e.preventDefault();
      const catName = newCategory.trim();
      if (!catName || categories.includes(catName)) return;
      
      const updated = [...categories, catName];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'passwordCategories'), { list: updated });
      addSystemLog('Şifre Kategorisi Eklendi', `Yeni şifre kategorisi oluşturuldu: ${catName}`);
      setNewCategory('');
    };

    const handleDeleteCategory = async (catToDelete) => {
      if (catToDelete === 'Genel') {
        alert("Genel kategorisi silinemez.");
        return;
      }
      if (window.confirm(`'${catToDelete}' kategorisini silmek istediğinize emin misiniz? (Bu kategorideki şifreler 'Genel' kategorisine taşınacaktır)`)) {
        const updated = categories.filter(c => c !== catToDelete);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'passwordCategories'), { list: updated });
        
        const affectedPwds = passwords.filter(p => p.category === catToDelete);
        for (const pwd of affectedPwds) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyPasswords', pwd.id), { category: 'Genel' });
        }
        addSystemLog('Şifre Kategorisi Silindi', `${catToDelete} kategorisi silindi ve içerikleri Genel kategorisine aktarıldı.`);
      }
    };

    const handleAdd = async (e) => {
      e.preventDefault();
      try {
        if (editingId) {
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyPasswords', editingId), formData);
           addSystemLog('Kurumsal Şifre Güncellendi', `${formData.platform} platformuna ait şifre bilgisi güncellendi.`);
           setEditingId(null);
        } else {
           await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companyPasswords'), {
              ...formData,
              createdAt: new Date().toISOString()
           });
           addSystemLog('Kurumsal Şifre Eklendi', `${formData.platform} platformuna ait yeni şifre eklendi.`);
        }
        setFormData({ platform: '', link: '', username: '', password: '', notes: '', category: categories[0] || 'Genel' });
      } catch(err) { console.error(err); }
    };

    const handleEdit = (pwd) => {
      setEditingId(pwd.id);
      setFormData({ platform: pwd.platform || '', link: pwd.link || '', username: pwd.username || '', password: pwd.password || '', notes: pwd.notes || '', category: pwd.category || 'Genel' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id, platform) => {
       if(window.confirm('Bu şifreyi kalıcı olarak silmek istediğinize emin misiniz?')) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyPasswords', id));
          addSystemLog('Kurumsal Şifre Silindi', `${platform} platformuna ait şifre silindi.`);
       }
    };

    const toggleVisible = (id) => {
      setVisiblePasswords(prev => ({...prev, [id]: !prev[id]}));
    };

    const handleCopy = (text, fieldId) => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Key className="w-6 h-6 text-red-600" /> Kurumsal Şifreler ve Hesaplar
        </h2>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-800 font-medium mb-6 flex items-start gap-3">
          <Shield className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <p>Şirkete ait (Instagram, Hosting, E-Posta, vb.) tüm kurumsal hesapların giriş bilgilerini buradan güvenle yönetebilirsiniz. Bu bölüme sadece yetkili yöneticiler erişebilir.</p>
            <button 
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition shrink-0 shadow-sm flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Kategori Yönetimi {showCategoryManager ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {showCategoryManager && (
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6 animate-in slide-in-from-top-2">
            <h3 className="font-bold text-black mb-3 text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600" /> Şifre Kategorileri
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-1 bg-white border border-neutral-300 pl-3 pr-1 py-1 rounded-lg shadow-sm text-sm font-bold text-neutral-700">
                  {cat}
                  {cat !== 'Genel' && (
                    <button onClick={() => handleDeleteCategory(cat)} className="text-red-500 hover:bg-red-50 p-1 rounded transition"><X className="w-3 h-3"/></button>
                  )}
                </div>
              ))}
            </div>
            <div  className="flex gap-2">
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Yeni Kategori Adı" className="p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm w-64" />
              <button type="button" onClick={handleAddCategory} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">Ekle</button>
            </div>
          </div>
        )}

        <div  className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 mb-8 space-y-4">
          <h3 className="font-bold text-black border-b border-neutral-200 pb-2 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-red-600" /> {editingId ? 'Şifre Bilgilerini Güncelle' : 'Yeni Hesap / Şifre Ekle'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Platform / Sistem Adı *</label>
              <input required type="text" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} placeholder="Örn: Instagram (Sembol Nakliyat)" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Kategori *</label>
              <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium transition">
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Giriş Linki (URL)</label>
              <input type="text" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} placeholder="Örn: https://instagram.com" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Kullanıcı Adı / E-Posta *</label>
              <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Kullanıcı adı veya mail adresi" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Şifre *</label>
              <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Hesap Şifresi" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-mono" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-neutral-700 mb-1">Ekstra Notlar</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Giriş için pin kodu veya ekstra notlar..." className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none h-20 text-sm"></textarea>
            </div>
          </div>

          <div className="flex gap-3">
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setFormData({ platform: '', link: '', username: '', password: '', notes: '', category: categories[0] || 'Genel' }); }} className="flex-1 py-3 bg-neutral-200 text-neutral-700 font-bold rounded-xl hover:bg-neutral-300 transition">İptal</button>
            )}
            <button type="button" onClick={handleAdd} className="flex-[2] py-3 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-md">
              <Save className="w-5 h-5" /> {editingId ? 'Değişiklikleri Kaydet' : 'Sisteme Kaydet'}
            </button>
          </div>
        </div>

        {passwords.length === 0 ? (
          <div className="text-center text-neutral-500 py-10 bg-neutral-50 rounded-2xl border border-neutral-200">
            <Key className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="font-medium text-sm">Sistemde kayıtlı kurumsal şifre bulunmuyor.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map(cat => {
              const catPwds = passwords.filter(p => (p.category || 'Genel') === cat);
              if (catPwds.length === 0) return null;

              return (
                <div key={cat} className="animate-in fade-in">
                  <h3 className="text-lg font-black text-neutral-800 mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2 pl-2">
                    <FolderOpen className="w-5 h-5 text-red-600" /> {cat} <span className="text-xs bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">{catPwds.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {catPwds.map(pwd => (
                      <div key={pwd.id} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-4 hover:border-red-300 transition group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-600 opacity-0 group-hover:opacity-100 transition"></div>
                        <div className="flex justify-between items-start border-b border-neutral-100 pb-3 pl-1">
                            <div>
                              <h4 className="font-black text-lg text-black">{pwd.platform}</h4>
                              {pwd.link && (
                                <a href={pwd.link.startsWith('http') ? pwd.link : `https://${pwd.link}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-0.5">
                                  <ArrowUpRight className="w-3 h-3" /> {pwd.link}
                                </a>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => handleEdit(pwd)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-200" title="Düzenle"><Edit className="w-4 h-4"/></button>
                              <button onClick={() => handleDelete(pwd.id, pwd.platform)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-200" title="Sil"><X className="w-4 h-4"/></button>
                            </div>
                        </div>

                        <div className="space-y-3 flex-1 pl-1">
                            <div>
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Kullanıcı Adı / E-Posta</span>
                              <div className="flex items-center gap-2">
                                <code className="bg-neutral-100 px-3 py-1.5 rounded-lg text-sm font-bold text-black flex-1 truncate select-all">{pwd.username}</code>
                                <button onClick={() => handleCopy(pwd.username, `user_${pwd.id}`)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition shrink-0" title="Kopyala">
                                  {copiedField === `user_${pwd.id}` ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Şifre</span>
                              <div className="flex items-center gap-2">
                                <code className="bg-neutral-100 px-3 py-1.5 rounded-lg text-sm font-bold text-black flex-1 truncate select-all">
                                  {visiblePasswords[pwd.id] ? pwd.password : '••••••••••••'}
                                </code>
                                <button onClick={() => toggleVisible(pwd.id)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition shrink-0 border border-transparent hover:border-neutral-300" title={visiblePasswords[pwd.id] ? "Gizle" : "Göster"}>
                                  {visiblePasswords[pwd.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleCopy(pwd.password, `pwd_${pwd.id}`)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition shrink-0 border border-transparent hover:border-neutral-300" title="Kopyala">
                                  {copiedField === `pwd_${pwd.id}` ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            
                            {pwd.notes && (
                              <div className="mt-2 text-xs text-neutral-600 bg-yellow-50 p-2.5 rounded-lg border border-yellow-200 shadow-sm leading-relaxed">
                                <b className="text-yellow-800">Not:</b> {pwd.notes}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ==========================================================================
  // RESMİ AYARLARI EKRANI — Sistem Dosyaları > Resmi Ayarları
  // ==========================================================================
  // İki bölümü yönetir:
  //   1) ŞİRKET IBAN'I      -> WhatsApp bilgilendirme mesajlarındaki banka bilgisi
  //   2) SÖZLEŞME MADDELERİ -> PDF sözleşmede basılan tüm maddeler
  //
  // Ekran burada, kardeşi AppSettingsView'in hemen yanında duruyor: ikisi de
  // aynı alt menüde (Sistem Dosyaları) ve aynı yetkiye (systemFiles) bağlı.
  // Veri ve yardımcı fonksiyonlar shared.jsx içinde: sözleşme PDF'i ve
  // WhatsApp mesajları da aynı kaynaktan okuyacağı için orada tutuldu.
  //
  // FIRESTORE: artifacts/{appId}/public/data/settings/resmiAyarlar
  // ==========================================================================

  // BİLEŞEN: Bölüm başlığı — iki bölümde de aynı görünüm için tek yerden
  // ============================================================================
  const BolumBasligi = ({ ikon: Ikon, baslik, aciklama, sag }) => (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
          <Ikon className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-black leading-tight">{baslik}</h3>
          {aciklama && <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{aciklama}</p>}
        </div>
      </div>
      {sag}
    </div>
  );

  // ============================================================================
  // BİLEŞEN: Tek bir sözleşme maddesi satırı
  // Numara solda sabit genişlikte durur, metin textarea içinde büyür.
  // ============================================================================
  const MaddeSatiri = ({ numara, metin, onChange, onSil, onYukari, onAsagi, ilkMi, sonMu }) => (
    <div className="flex items-start gap-2 group">
      {/* Madde numarası — otomatik, elle girilmez */}
      <span className="w-8 h-8 shrink-0 mt-1 rounded-lg bg-neutral-900 text-white text-xs font-black flex items-center justify-center">
        {numara}
      </span>

      {/* Maddenin kendisi — satır sayısına göre büyüyen textarea */}
      <textarea
        value={metin}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(2, Math.ceil((metin || '').length / 70))}
        className="flex-1 p-3 text-sm border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none leading-relaxed"
        placeholder="Madde metnini yazın..."
      />

      {/* Sıra değiştirme ve silme — masaüstünde hover'da belirir, mobilde her zaman görünür */}
      <div className="flex flex-col gap-1 shrink-0 mt-1 opacity-100 md:opacity-40 md:group-hover:opacity-100 transition">
        <button type="button" onClick={onYukari} disabled={ilkMi} title="Yukarı taşı"
          className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronUp className="w-3.5 h-3.5 text-neutral-700" />
        </button>
        <button type="button" onClick={onAsagi} disabled={sonMu} title="Aşağı taşı"
          className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronDown className="w-3.5 h-3.5 text-neutral-700" />
        </button>
        <button type="button" onClick={onSil} title="Maddeyi sil"
          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition">
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // BİLEŞEN: Sözleşme maddeleri editörü
  // Gruplar (başlıklar) + her grubun altındaki maddeler yönetilir.
  // ============================================================================
  const SozlesmeMaddeleriEditor = ({ gruplar, setGruplar, kapanis, setKapanis }) => {
    const [onizleme, setOnizleme] = useState(false);
    const toplam = maddeSayisi(gruplar);

    // Numaralandırma gruplar boyunca kesintisiz devam ettiği için her grubun
    // başlangıç numarasını önceden hesaplıyoruz.
    const baslangicNumaralari = useMemo(() => {
      let sayac = 0;
      return gruplar.map(g => {
        const bas = sayac + 1;
        sayac += (g.maddeler || []).length;
        return bas;
      });
    }, [gruplar]);

    // Yardımcı: belirli bir grubu güncelle (React state'i mutasyona uğratmadan)
    const grupGuncelle = (grupIndex, yeniAlanlar) => {
      setGruplar(gruplar.map((g, i) => i === grupIndex ? { ...g, ...yeniAlanlar } : g));
    };

    const maddeGuncelle = (grupIndex, maddeIndex, yeniMetin) => {
      const yeniMaddeler = [...gruplar[grupIndex].maddeler];
      yeniMaddeler[maddeIndex] = yeniMetin;
      grupGuncelle(grupIndex, { maddeler: yeniMaddeler });
    };

    const maddeEkle = (grupIndex) => {
      grupGuncelle(grupIndex, { maddeler: [...gruplar[grupIndex].maddeler, ''] });
    };

    const maddeSil = (grupIndex, maddeIndex) => {
      if (!window.confirm('Bu madde silinecek. Emin misiniz?')) return;
      grupGuncelle(grupIndex, { maddeler: gruplar[grupIndex].maddeler.filter((_, i) => i !== maddeIndex) });
    };

    // Madde sırasını değiştir — yon: -1 yukarı, +1 aşağı
    const maddeTasi = (grupIndex, maddeIndex, yon) => {
      const yeniMaddeler = [...gruplar[grupIndex].maddeler];
      const hedef = maddeIndex + yon;
      if (hedef < 0 || hedef >= yeniMaddeler.length) return;
      [yeniMaddeler[maddeIndex], yeniMaddeler[hedef]] = [yeniMaddeler[hedef], yeniMaddeler[maddeIndex]];
      grupGuncelle(grupIndex, { maddeler: yeniMaddeler });
    };

    const grupEkle = () => {
      setGruplar([...gruplar, { id: `grup_${Date.now()}`, baslik: 'YENİ BÖLÜM BAŞLIĞI', maddeler: [''] }]);
    };

    const grupSil = (grupIndex) => {
      const adet = gruplar[grupIndex].maddeler.length;
      if (!window.confirm(`"${gruplar[grupIndex].baslik}" bölümü ve içindeki ${adet} madde silinecek. Emin misiniz?`)) return;
      setGruplar(gruplar.filter((_, i) => i !== grupIndex));
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <BolumBasligi
          ikon={Scale}
          baslik="Sözleşme Maddeleri"
          aciklama="Buradaki maddeler, müşteriye verilen PDF sözleşmede aynen basılır. Madde numaraları otomatik verilir; bölümler arasında kesintisiz devam eder."
          sag={
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-black whitespace-nowrap">
                {toplam} madde
              </span>
              <button type="button" onClick={() => setOnizleme(!onizleme)}
                className="px-3 py-1.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> {onizleme ? 'Düzenle' : 'Önizle'}
              </button>
            </div>
          }
        />

        {/* ÖNİZLEME: PDF'te nasıl görüneceğini gösterir — yazdırmaya gerek kalmaz */}
        {onizleme ? (
          <div className="border border-neutral-200 rounded-xl p-5 bg-neutral-50 max-h-[500px] overflow-y-auto">
            <p className="text-center text-xs font-black text-neutral-500 tracking-widest mb-4">
              SÖZLEŞME ŞARTLARI VE MADDELERİ
            </p>
            {(() => {
              // Önizlemede de gerçek numaralandırma mantığı kullanılır.
              let sayac = 0;
              return gruplar.map((grup, gi) => (
                <div key={grup.id} className="mb-4">
                  {gi > 0 && grup.baslik && (
                    <p className="text-[11px] font-black text-black mt-4 mb-2 tracking-wide">{grup.baslik}</p>
                  )}
                  {grup.maddeler.map((madde, mi) => {
                    sayac++;
                    return (
                      <p key={mi} className="text-[11px] text-neutral-800 leading-relaxed mb-1">
                        <b>{sayac}.</b> {madde || <i className="text-red-500">(boş madde)</i>}
                      </p>
                    );
                  })}
                </div>
              ));
            })()}
            <p className="text-[11px] text-neutral-800 leading-relaxed mt-4 pt-3 border-t border-neutral-300 font-bold">
              {(kapanis || '').replace('{ADET}', String(toplam))}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {gruplar.map((grup, gi) => (
              <div key={grup.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                {/* Grup başlığı — doğrudan düzenlenebilir input */}
                <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
                  <input
                    value={grup.baslik}
                    onChange={(e) => grupGuncelle(gi, { baslik: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-black text-black outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded-lg transition"
                    placeholder="BÖLÜM BAŞLIĞI"
                  />
                  <span className="text-[11px] font-bold text-neutral-500 whitespace-nowrap">
                    {baslangicNumaralari[gi]}–{baslangicNumaralari[gi] + grup.maddeler.length - 1}
                  </span>
                  <button type="button" onClick={() => grupSil(gi)} title="Bölümü sil"
                    className="p-1.5 rounded-lg hover:bg-red-100 transition">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {grup.maddeler.map((madde, mi) => (
                    <MaddeSatiri
                      key={mi}
                      numara={baslangicNumaralari[gi] + mi}
                      metin={madde}
                      onChange={(v) => maddeGuncelle(gi, mi, v)}
                      onSil={() => maddeSil(gi, mi)}
                      onYukari={() => maddeTasi(gi, mi, -1)}
                      onAsagi={() => maddeTasi(gi, mi, 1)}
                      ilkMi={mi === 0}
                      sonMu={mi === grup.maddeler.length - 1}
                    />
                  ))}
                  <button type="button" onClick={() => maddeEkle(gi)}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-neutral-300 text-xs font-bold text-neutral-500 hover:border-red-400 hover:text-red-600 transition flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Bu bölüme madde ekle
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={grupEkle}
              className="w-full py-3 rounded-xl bg-neutral-900 text-white text-sm font-bold hover:bg-neutral-800 transition flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Yeni bölüm ekle
            </button>

            {/* Kapanış cümlesi — {ADET} yer tutucusu madde sayısıyla otomatik dolar */}
            <div className="pt-5 border-t border-neutral-200">
              <label className="block text-sm font-bold text-neutral-700 mb-1">Kapanış Cümlesi</label>
              <p className="text-xs text-neutral-500 mb-2">
                <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono">{'{ADET}'}</code> yazdığınız
                yere toplam madde sayısı otomatik yazılır. Madde eklediğinizde bu cümleyi elle düzeltmeniz gerekmez.
              </p>
              <textarea
                value={kapanis}
                onChange={(e) => setKapanis(e.target.value)}
                rows={2}
                className="w-full p-3 text-sm border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none"
              />
              <p className="text-xs text-neutral-600 mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                <b>Sonuç:</b> {(kapanis || '').replace('{ADET}', String(toplam))}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // BİLEŞEN: Şirket IBAN yönetimi
  // Birden fazla hesap tutulabilir, biri "varsayılan" seçilir. Mesajlarda
  // varsayılan hesap kullanılır.
  // ============================================================================
  const SirketIbanEditor = ({ hesaplar, setHesaplar, varsayilanId, setVarsayilanId }) => {
    const [kopyalandi, setKopyalandi] = useState('');
    // Hangi hesabın QR'ı yükleniyor? (hesap id'si tutulur, aynı anda tek yükleme)
    const [qrYukleniyor, setQrYukleniyor] = useState('');

    // QR görselini sunucuya yükler ve dönen URL'i hesaba yazar.
    // Yükleme yöntemi mevcut logo yükleme akışıyla birebir aynı (upload.php).
    const handleQrYukle = async (e, index, hesapId) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setQrYukleniyor(hesapId);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        // Sunucu bazen JSON bazen düz metin dönüyor; iki durumu da karşılıyoruz.
        let url = text.trim();
        try { const json = JSON.parse(text); url = json.url || json.fileName || json.file || url; } catch (err) { /* düz metin */ }
        hesapGuncelle(index, { qrUrl: url });
      } catch (err) {
        console.error('QR yükleme hatası:', err);
        alert('QR görseli yüklenemedi. Bağlantınızı kontrol edin.');
      }
      setQrYukleniyor('');
      // Aynı dosyayı tekrar seçebilmek için input sıfırlanır.
      e.target.value = '';
    };

    const hesapGuncelle = (index, alanlar) => {
      setHesaplar(hesaplar.map((h, i) => i === index ? { ...h, ...alanlar } : h));
    };

    const hesapEkle = () => {
      const yeniId = `hesap_${Date.now()}`;
      setHesaplar([...hesaplar, { id: yeniId, banka: '', aliciAdi: '', iban: '', not: '' }]);
    };

    const hesapSil = (index) => {
      const hesap = hesaplar[index];
      if (hesaplar.length === 1) {
        window.alert('En az bir banka hesabı bulunmalıdır. Son hesap silinemez.');
        return;
      }
      if (!window.confirm(`"${hesap.banka || 'İsimsiz hesap'}" silinecek. Emin misiniz?`)) return;
      const kalan = hesaplar.filter((_, i) => i !== index);
      setHesaplar(kalan);
      // Silinen hesap varsayılansa varsayılanı ilk hesaba devret — mesajlar boş kalmasın.
      if (varsayilanId === hesap.id) setVarsayilanId(kalan[0].id);
    };

    // IBAN'ı panoya kopyala — operasyon ekibi müşteriye elle göndermek isterse
    const ibanKopyala = (iban, id) => {
      navigator.clipboard.writeText(ibanBicimle(iban));
      setKopyalandi(id);
      setTimeout(() => setKopyalandi(''), 2000);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <BolumBasligi
          ikon={Landmark}
          baslik="Şirket IBAN'ı"
          aciklama="Müşteriye gönderilen kapora bilgilendirme mesajlarında bu bilgiler kullanılır. Birden fazla hesap tanımlayıp birini varsayılan seçebilirsiniz."
          sag={
            <span className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-black whitespace-nowrap shrink-0">
              {hesaplar.length} hesap
            </span>
          }
        />

        <div className="space-y-4">
          {hesaplar.map((hesap, i) => {
            const varsayilanMi = hesap.id === varsayilanId;
            const ibanUyari = hesap.iban && !ibanGecerliMi(hesap.iban);

            return (
              <div key={hesap.id}
                className={`rounded-xl border-2 transition ${varsayilanMi ? 'border-red-600 bg-red-50/40' : 'border-neutral-200 bg-white'}`}>

                {/* Hesap üst şeridi: varsayılan seçimi + kopyala + sil */}
                <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-neutral-200">
                  <button type="button" onClick={() => setVarsayilanId(hesap.id)}
                    className={`flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-lg transition ${
                      varsayilanMi ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}>
                    <Star className={`w-3.5 h-3.5 ${varsayilanMi ? 'fill-white' : ''}`} />
                    {varsayilanMi ? 'VARSAYILAN HESAP' : 'Varsayılan yap'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => ibanKopyala(hesap.iban, hesap.id)} title="IBAN'ı kopyala"
                      className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition">
                      {kopyalandi === hesap.id
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <Copy className="w-4 h-4 text-neutral-700" />}
                    </button>
                    <button type="button" onClick={() => hesapSil(i)} title="Hesabı sil"
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Banka Adı</label>
                    <input value={hesap.banka} onChange={(e) => hesapGuncelle(i, { banka: e.target.value })}
                      placeholder="Garanti Bankası"
                      className="w-full p-3 text-sm border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Alıcı / Hesap Sahibi</label>
                    <input value={hesap.aliciAdi} onChange={(e) => hesapGuncelle(i, { aliciAdi: e.target.value })}
                      placeholder="Sembol Nakliyat Depoculuk Tic. Ltd. Şti."
                      className="w-full p-3 text-sm border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">IBAN</label>
                    {/* font-mono + tracking: rakamları saymak kolaylaşır, yanlış IBAN riski azalır */}
                    <input value={hesap.iban} onChange={(e) => hesapGuncelle(i, { iban: e.target.value })}
                      placeholder="TR00 0000 0000 0000 0000 0000 00"
                      className={`w-full p-3 text-sm font-mono tracking-wider uppercase border rounded-xl outline-none transition ${
                        ibanUyari ? 'border-amber-400 bg-amber-50 focus:ring-2 focus:ring-amber-500'
                                  : 'border-neutral-300 focus:ring-2 focus:ring-red-600'
                      }`} />
                    {/* Uyarı KAYDETMEYİ ENGELLEMEZ — yurt dışı hesap gerekebilir */}
                    {ibanUyari && (
                      <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        TR IBAN'ı 26 karakter olmalı (TR + 24 rakam). Kontrol edin.
                      </p>
                    )}
                    {hesap.iban && !ibanUyari && (
                      <p className="text-xs text-neutral-500 mt-1.5 font-mono">
                        Mesajda görünecek hâli: <b className="text-black">{ibanBicimle(hesap.iban)}</b>
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İç Not (müşteriye gönderilmez)</label>
                    <input value={hesap.not || ''} onChange={(e) => hesapGuncelle(i, { not: e.target.value })}
                      placeholder="Örn: Kurumsal tahsilat hesabı"
                      className="w-full p-3 text-sm border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>

                  {/* YENİ: BANKA QR KODU
                      Ekip şefinin "IBAN Paylaş" penceresinde gösterilir.
                      NEDEN YÜKLEME: Banka QR'ı IBAN'dan ÜRETİLEMEZ — bankanın kendi
                      ödeme formatını taşır. Bu yüzden bankadan alınan görsel yüklenir. */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Banka QR Kodu</label>
                    <p className="text-xs text-neutral-500 mb-2">
                      Bankanızın mobil uygulamasından aldığınız QR görselini yükleyin. Ekip şefi
                      müşteriyle paylaşırken bu kod gösterilir. QR, IBAN'dan üretilemediği için elle yüklenmesi gerekir.
                    </p>
                    <div className="flex items-start gap-3">
                      {hesap.qrUrl ? (
                        <div className="relative shrink-0">
                          <img src={hesap.qrUrl} alt="Banka QR kodu" className="w-24 h-24 object-contain border border-neutral-200 rounded-xl bg-white p-1" />
                          <button type="button" onClick={() => hesapGuncelle(i, { qrUrl: '' })} title="QR kodunu kaldır"
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 shrink-0 border-2 border-dashed border-neutral-300 rounded-xl flex items-center justify-center text-neutral-300">
                          <QrCode className="w-8 h-8" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer transition ${
                          qrYukleniyor === hesap.id ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                        }`}>
                          {qrYukleniyor === hesap.id
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</>
                            : <><QrCode className="w-4 h-4" /> QR görseli seç</>}
                          <input type="file" accept="image/*" className="hidden"
                            disabled={qrYukleniyor === hesap.id}
                            onChange={(e) => handleQrYukle(e, i, hesap.id)} />
                        </label>
                        <p className="text-[11px] text-neutral-400 mt-2">PNG veya JPG. Kare görseller en iyi sonucu verir.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" onClick={hesapEkle}
            className="w-full py-3 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-bold text-neutral-500 hover:border-red-400 hover:text-red-600 transition flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Yeni banka hesabı ekle
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // BİLEŞEN: WhatsApp mesaj önizlemesi
  // Varsayılan hesabın müşteriye nasıl gideceğini gerçek mesaj formatında gösterir.
  // Yanlış IBAN'ın müşteriye gitmesi ciddi bir hata olduğu için bu önizleme önemli.
  // ============================================================================
  const MesajOnizleme = ({ ayarlar }) => {
    const bankaBlogu = bankaBilgiMetni(ayarlar);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <BolumBasligi
          ikon={FileText}
          baslik="Müşteriye Gidecek Mesaj"
          aciklama="Kapora bilgilendirme mesajının banka bölümü. Varsayılan hesabı değiştirdiğinizde burası da değişir."
        />
        {/* WhatsApp benzeri baloncuk — gerçek görünümü taklit eder */}
        <div className="bg-[#E7FFDB] border border-green-200 rounded-2xl rounded-tr-sm p-4 max-w-md">
          <p className="text-xs text-neutral-800 whitespace-pre-line leading-relaxed font-medium">
            {'💰 *Kapora Bilgilendirmesi:*\nİşleminizin onaylanması ve aracınızın rezerve edilmesi için toplam tutarın %20\'si olan *X.XXX TL* kapora ödemenizi rica ederiz.\n\n🏦 *Banka Bilgileri:*\n' + bankaBlogu}
          </p>
          <p className="text-[10px] text-neutral-500 text-right mt-2">şimdi ✓✓</p>
        </div>
      </div>
    );
  };

  // ============================================================================
  // ANA BİLEŞEN: ResmiAyarlarView
  // App.tsx içinden şu şekilde çağrılır:
  //   <ResmiAyarlarView db={db} appId={appId} addSystemLog={addSystemLog} currentUser={currentUser} />
  // ============================================================================
  const ResmiAyarlarView = ({ db, appId, addSystemLog, currentUser }) => {
    const [yukleniyor, setYukleniyor] = useState(true);
    const [kaydediliyor, setKaydediliyor] = useState(false);
    const [mesaj, setMesaj] = useState('');
    const [hata, setHata] = useState('');

    // Düzenlenen taslak state — Firestore'a yalnızca "Kaydet"e basınca yazılır.
    const [gruplar, setGruplar] = useState(VARSAYILAN_SOZLESME_GRUPLARI);
    const [kapanis, setKapanis] = useState(VARSAYILAN_SOZLESME_KAPANIS);
    const [hesaplar, setHesaplar] = useState(VARSAYILAN_BANKA_HESAPLARI);
    const [varsayilanId, setVarsayilanId] = useState('hesap_1');

    // Kaydedilmemiş değişiklik var mı? Sekmeden çıkarken uyarmak için kullanılır.
    const [kirli, setKirli] = useState(false);

    // ---------------------------------------------------------------------------
    // Firestore'dan oku. onSnapshot kullanıldı çünkü iki yönetici aynı anda
    // düzenlerse diğerinin kaydı anında yansır. Kaydedilmemiş değişiklik varsa
    // (kirli === true) gelen veri UZAKTAN YAZILMAZ — kullanıcının emeği silinmesin.
    // ---------------------------------------------------------------------------
    useEffect(() => {
      if (!db || !appId) return;
      const unsub = onSnapshot(resmiAyarlarRef(db, appId), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (!kirli) {
            if (d.sozlesmeGruplari?.length) setGruplar(d.sozlesmeGruplari);
            if (d.sozlesmeKapanis) setKapanis(d.sozlesmeKapanis);
            if (d.bankaHesaplari?.length) setHesaplar(d.bankaHesaplari);
            if (d.varsayilanHesapId) setVarsayilanId(d.varsayilanHesapId);
          }
        }
        setYukleniyor(false);
      }, (err) => {
        console.error('Resmi Ayarları okunamadı:', err);
        setHata('Ayarlar okunamadı. İnternet bağlantınızı ve yetkilerinizi kontrol edin.');
        setYukleniyor(false);
      });
      return () => unsub();
    }, [db, appId, kirli]);

    // Alt bileşenlerden gelen her değişiklik "kirli" işaretini kaldırır
    const izle = (setter) => (deger) => { setter(deger); setKirli(true); setMesaj(''); };

    const ayarlar = { sozlesmeGruplari: gruplar, sozlesmeKapanis: kapanis, bankaHesaplari: hesaplar, varsayilanHesapId: varsayilanId };

    // ---------------------------------------------------------------------------
    // KAYDET
    // ---------------------------------------------------------------------------
    const kaydet = async () => {
      // Boş madde kaydedilirse PDF'te "12. " gibi boş satır çıkar — önce uyar.
      const bosMadde = gruplar.some(g => g.maddeler.some(m => !String(m).trim()));
      if (bosMadde && !window.confirm('Boş madde(ler) var. Bunlar sözleşmede boş satır olarak görünür. Yine de kaydedilsin mi?')) return;

      const varsayilanHesap = hesaplar.find(h => h.id === varsayilanId);
      if (!varsayilanHesap?.iban?.trim()) {
        setHata('Varsayılan hesabın IBAN alanı boş. Müşteri mesajları IBAN olmadan gönderilemez.');
        return;
      }

      setKaydediliyor(true);
      setHata('');
      try {
        await setDoc(resmiAyarlarRef(db, appId), {
          sozlesmeGruplari: gruplar,
          sozlesmeKapanis: kapanis,
          bankaHesaplari: hesaplar,
          varsayilanHesapId: varsayilanId,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.fullName || 'Bilinmiyor'
        }, { merge: true });

        // Sistem kaydı — sözleşme ve IBAN kritik alanlar, kim değiştirdi izlenebilsin
        if (addSystemLog) {
          addSystemLog(
            'Resmi Ayarları Güncellendi',
            `${maddeSayisi(gruplar)} sözleşme maddesi ve ${hesaplar.length} banka hesabı kaydedildi. Varsayılan: ${varsayilanHesap.banka} — ${ibanBicimle(varsayilanHesap.iban)}`
          );
        }

        setKirli(false);
        setMesaj('Kaydedildi. Yeni sözleşmeler ve mesajlar bu bilgilerle oluşturulacak.');
        setTimeout(() => setMesaj(''), 5000);
      } catch (err) {
        console.error('Resmi Ayarları kaydedilemedi:', err);
        setHata('Kaydedilemedi: ' + (err?.message || 'bilinmeyen hata'));
      } finally {
        setKaydediliyor(false);
      }
    };

    // Varsayılana dön — yanlış düzenleme sonrası kurtarma yolu
    const varsayilanaDon = () => {
      if (!window.confirm('Tüm sözleşme maddeleri ve banka bilgileri fabrika ayarlarına dönecek. Kaydedilmemiş değişiklikleriniz kaybolur. Emin misiniz?')) return;
      setGruplar(VARSAYILAN_SOZLESME_GRUPLARI);
      setKapanis(VARSAYILAN_SOZLESME_KAPANIS);
      setHesaplar(VARSAYILAN_BANKA_HESAPLARI);
      setVarsayilanId('hesap_1');
      setKirli(true);
    };

    if (yukleniyor) {
      return (
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <div className="flex items-center gap-3 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold">Resmi ayarlar yükleniyor...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-6 space-y-6 pb-32">
        {/* SAYFA BAŞLIĞI */}
        <div>
          <h2 className="text-2xl font-black text-black flex items-center gap-3">
            <Building2 className="w-7 h-7 text-red-600" /> Resmi Ayarları
          </h2>
          <p className="text-sm text-neutral-500 mt-1.5">
            Sözleşme maddeleri ve şirket banka bilgileri buradan yönetilir. Yapılan değişiklikler
            bundan sonra oluşturulan tüm sözleşme ve müşteri mesajlarına uygulanır.
          </p>
        </div>

        {/* GEÇMİŞ BELGELERİN DEĞİŞMEDİĞİ UYARISI — hukuki açıdan kritik */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 leading-relaxed">
            <b>Geçmiş sözleşmeler değişmez.</b> Sözleşme PDF'i her indirilişte yeniden üretildiği için,
            burada yaptığınız değişiklik <b>eski işlerin sözleşmesini yeniden indirdiğinizde de</b> geçerli olur.
            İmzalanmış bir sözleşmenin metnini korumak istiyorsanız imzalı PDF'i özlük/iş dosyasına yükleyin.
          </p>
        </div>

        {mesaj && (
          <div className="p-3.5 bg-green-50 text-green-800 rounded-xl font-bold text-sm border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" /> {mesaj}
          </div>
        )}
        {hata && (
          <div className="p-3.5 bg-red-50 text-red-800 rounded-xl font-bold text-sm border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {hata}
          </div>
        )}

        <SirketIbanEditor
          hesaplar={hesaplar}
          setHesaplar={izle(setHesaplar)}
          varsayilanId={varsayilanId}
          setVarsayilanId={izle(setVarsayilanId)}
        />

        <MesajOnizleme ayarlar={ayarlar} />

        <SozlesmeMaddeleriEditor
          gruplar={gruplar}
          setGruplar={izle(setGruplar)}
          kapanis={kapanis}
          setKapanis={izle(setKapanis)}
        />

        {/* SABİT KAYDET ŞERİDİ — uzun sayfada aşağı kaydırınca da erişilebilir kalır */}
        <div className="fixed bottom-0 left-0 right-0 md:left-72 bg-white/95 backdrop-blur border-t border-neutral-200 p-4 z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="text-xs font-bold min-w-0">
              {kirli
                ? <span className="text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Kaydedilmemiş değişiklik var</span>
                : <span className="text-neutral-400">Tüm değişiklikler kayıtlı</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={varsayilanaDon}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Varsayılana dön</span>
              </button>
              <button type="button" onClick={kaydet} disabled={kaydediliyor || !kirli}
                className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-lg shadow-red-600/20">
                {kaydediliyor
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor</>
                  : <><Save className="w-4 h-4" /> Kaydet</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AppSettingsView = ({ db, appId, addSystemLog, appBranding }) => {
    const [logoPreview, setLogoPreview] = useState(appBranding?.logoUrl || '');
    const [logoSize, setLogoSize] = useState(appBranding?.logoSize || 100);
    const [isUploading, setIsUploading] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
      setLogoPreview(appBranding?.logoUrl || '');
      setLogoSize(appBranding?.logoSize || 100);
    }, [appBranding]);

    const handleLogoFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setLogoPreview(uploadedUrl);
      } catch (err) {
        console.error('Logo yükleme hatası:', err);
        alert('Logo yüklenemedi.');
      }
      setIsUploading(false);
    };

    const handleSaveBranding = async () => {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'appBranding'), {
        logoUrl: logoPreview,
        logoSize: logoSize,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (addSystemLog) addSystemLog('Uygulama Logosu Güncellendi', `Sistem logosu ve/veya boyutu değiştirildi (Boyut: %${logoSize}).`);
      setSaveMessage('Logo ayarları başarıyla kaydedildi!');
      setTimeout(() => setSaveMessage(''), 3000);
    };

    const handleResetLogo = async () => {
      if (!window.confirm('Varsayılan logoya dönmek istediğinize emin misiniz?')) return;
      setLogoPreview('');
      setLogoSize(100);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'appBranding'), {
        logoUrl: '', logoSize: 100, updatedAt: new Date().toISOString()
      }, { merge: true });
      if (addSystemLog) addSystemLog('Uygulama Logosu Sıfırlandı', 'Sistem logosu varsayılan haline döndürüldü.');
    };

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-black flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-red-600" /> Uygulama Ayarları
        </h2>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-black mb-1 flex items-center gap-2 border-b border-neutral-200 pb-4">
            <FileText className="w-5 h-5 text-red-600" /> Logo Değiştir
          </h3>
          <p className="text-sm text-neutral-500 mt-4 mb-5">
            Buradan yüklediğiniz logo; giriş ekranı, yükleniyor ekranı, mobil üst menü ve sol menüdeki
            mevcut Sembol Nakliyat logosunun yerine otomatik olarak gösterilir.
          </p>

          {saveMessage && (
            <div className="mb-5 p-3 bg-green-50 text-green-700 rounded-xl font-bold text-sm border border-green-200 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> {saveMessage}
            </div>
          )}

          <div className="bg-black rounded-2xl p-8 flex justify-center items-center mb-5 border border-neutral-800">
            <MarkaLogo
              logoUrl={logoPreview}
              alt="Logo Önizleme"
              className="max-w-full w-auto object-contain"
              style={{ height: `${96 * (logoSize / 100)}px` }}
              fallback={<div className="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl">S</div>}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-black mb-2">Yeni Logo Yükle</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
              disabled={isUploading}
              className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-black file:text-white file:font-bold file:cursor-pointer"
            />
            {isUploading && <p className="text-xs text-neutral-400 mt-1.5 animate-pulse">Yükleniyor...</p>}
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-black">Logo Boyutu</label>
              <span className="text-sm font-black text-red-600">%{logoSize}</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={logoSize}
              onChange={(e) => setLogoSize(parseInt(e.target.value))}
              className="w-full accent-red-600"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 font-bold mt-1">
              <span>%50 (Küçük)</span>
              <span>%100 (Varsayılan)</span>
              <span>%200 (Büyük)</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={handleResetLogo} className="flex-1 py-3.5 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">
              Varsayılana Döndür
            </button>
            <button type="button" onClick={handleSaveBranding} disabled={isUploading} className="flex-[2] py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/20 disabled:opacity-50 flex justify-center items-center gap-2">
              <Save className="w-5 h-5" /> Logo Ayarlarını Kaydet
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SystemFilesView = ({ jobs, personnelList, vehicles, materials, db, appId, addSystemLog, onJobDeleted }) => {
    // ========================================================================
    // YENİ: MÜKERRER İŞ KAYDI TEMİZLİĞİ
    // ========================================================================
    // NEDEN GEREKLİ: Eski sistemden toplu aktarım yapılan dönemlerde (ör. Mayıs
    // 2026), zaten elle girilmiş işler bir kez daha "Eski Sistem Aktarımı"
    // olarak eklenmiş. Bunlar KOD hatası değil, iki ayrı veritabanı kaydıdır;
    // bu yüzden takvimde ve listelerde aynı müşteri iki kez görünür.
    //
    // NASIL EŞLEŞTİRİR: Aynı GÜN + aynı MÜŞTERİ (ad normalize edilir: küçük
    // harf, Türkçe karakter sadeleştirmesi, boşluk/noktalama temizliği) olan
    // işler bir grup sayılır. Böylece "Müminoğlu" ile "Mümin oğlu" veya
    // "Çömez" ile "Comez" aynı grupta buluşur.
    //
    // GÜVENLİK: Hiçbir kayıt otomatik silinmez. Araç yalnızca grupları listeler;
    // hangi kaydın kalacağına kullanıcı karar verir. Silinecek kayıt için ayrıca
    // yazılı onay istenir. İptal edilmiş işler taramaya dahil edilmez.
    // ========================================================================
    const [mukerrerAcik, setMukerrerAcik] = useState(false);
    const [silinen, setSilinen] = useState([]);   // Bu oturumda silinen id'ler
    const [siliniyor, setSiliniyor] = useState(null);

    // Müşteri adını karşılaştırılabilir hale getirir
    const adNormalize = (s) => String(s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
      .replace(/[^a-z0-9]/g, ''); // Boşluk ve noktalama tamamen atılır

    // Telefonu son 10 haneye indirger (0/+90/boşluk farklarını yok sayar)
    const telNormalize = (s) => String(s || '').replace(/\D/g, '').slice(-10);

    // ========================================================================
    // DÜZELTME: TELEFON ARTIK EŞLEŞTİRMEYE DAHİL
    // ========================================================================
    // ÖNCEKİ SORUN: Yalnızca "gün + ad" eşleşiyordu. Aynı isimli FARKLI iki
    // müşteri (ör. iki ayrı "Kadir Usta": 0537... ve 0532...) aynı gün iş
    // yaptırdığında mükerrer sanılıyordu. Artık telefonu farklı olanlar AYRI
    // müşteri sayılır ve gruplanmaz.
    // Telefonu olmayan kayıtlar yalnızca kendi aralarında eşleşir.
    // ========================================================================
    const grupAnahtari = (j) => `${j.date}__${adNormalize(j.customerName)}__${telNormalize(j.customerPhone)}`;

    // ========================================================================
    // YENİ: "BİREBİR AYNI" PARMAK İZİ
    // ========================================================================
    // İki kaydın gerçekten aynı işin kopyası olduğunu anlamak için yalnızca ad
    // ve tarih yetmez — fiyat, saat, adresler ve tip de birebir tutmalıdır.
    // Bu imza eşleşiyorsa kayıtlar ayırt edilemez kopyalardır ve birini silmek
    // bilgi kaybına yol açmaz.
    // ========================================================================
    const birebirImza = (j) => [
      j.date, j.time, adNormalize(j.customerName), telNormalize(j.customerPhone),
      j.type || 'Nakliye',
      String(parseFloat(j.price) || 0), String(parseFloat(j.deposit) || 0),
      adNormalize(j.fromProvince), adNormalize(j.fromDistrict), adNormalize(j.fromAddress),
      adNormalize(j.toProvince), adNormalize(j.toDistrict), adNormalize(j.toAddress),
      adNormalize(j.notes)
    ].join('|');

    const mukerrerGruplar = useMemo(() => {
      const harita = new Map();
      (jobs || [])
        .filter(j => j && j.status !== 'cancelled' && !silinen.includes(j.id))
        .forEach(j => {
          const ad = adNormalize(j.customerName);
          if (!ad || !j.date) return; // Adı veya tarihi olmayan kayıt eşleştirilemez
          const anahtar = grupAnahtari(j); // DEĞİŞTİ: telefon da anahtara dahil
          if (!harita.has(anahtar)) harita.set(anahtar, []);
          harita.get(anahtar).push(j);
        });
      // Yalnızca 2+ kayıt içeren gruplar mükerrerdir; en yeni tarih en üstte
      return [...harita.values()]
        .filter(g => g.length > 1)
        .sort((a, b) => String(b[0].date).localeCompare(String(a[0].date)));
    }, [jobs, silinen]);

    // ========================================================================
    // YENİ: EKİPSİZ KOPYALAR (kullanıcı kuralı — en güvenilir tespit)
    // ========================================================================
    // KURAL: "Ekip listesi olan orijinal, diğerleri sistemin kopyaladığı."
    // Aynı gün + aynı müşteri + aynı telefon grubunda, ekip atanmış bir kayıt
    // VARSA, ekibi olmayanlar aktarım artığıdır.
    //
    // Bu tespit adrese BAKMAZ — çünkü aktarımda adresler farklı yazılmış olabiliyor
    // (ör. aynı iş için biri "İstanbul/Pendik/Kurtköy", diğeri "Bitlis/" diyor).
    // "Birebir aynı" listesi bu yüzden bu çiftleri kaçırıyordu.
    //
    // GÜVENLİK ŞARTLARI — bir kayıt ancak ŞU ÜÇÜ birden sağlanırsa silinebilir:
    //   1) Grubunda ekip atanmış EN AZ BİR kayıt var (yani orijinali duruyor)
    //   2) Kendisinde ekip atanmamış
    //   3) İş sonlandırma verisi yok (endJobDetails boş) — sonlandırılmış kayıt
    //      hasar/fotoğraf/ödeme bilgisi taşır, asla silinmez
    // Ekip atanmış kayıt birden fazlaysa gruba hiç dokunulmaz; o durum
    // gerçekten iki ayrı iş olabilir (ör. aynı gün ikinci iş) ve kararı
    // kullanıcı aşağıdaki listede tek tek verir.
    // ========================================================================
    const ekipsizKopyalar = useMemo(() => {
      const sonuc = [];
      mukerrerGruplar.forEach(g => {
        const ekipli = g.filter(j => (j.assignedPersonnelIds || []).length > 0);
        if (ekipli.length !== 1) return; // Tek bir orijinal yoksa karışma
        g.forEach(j => {
          if ((j.assignedPersonnelIds || []).length > 0) return; // Orijinal korunur
          if (j.endJobDetails) return;                            // Sonlandırılmış korunur
          sonuc.push({ silinecek: j, tutulan: ekipli[0] });
        });
      });
      return sonuc;
    }, [mukerrerGruplar]);

    const [ekipsizOnay, setEkipsizOnay] = useState(false);
    const [ekipsizIlerleme, setEkipsizIlerleme] = useState(null);

    const ekipsizTopluSil = async () => {
      setEkipsizOnay(false);
      setEkipsizIlerleme({ toplam: ekipsizKopyalar.length, biten: 0 });
      const basarili = [];
      for (const { silinecek } of ekipsizKopyalar) {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', silinecek.id));
          basarili.push(silinecek.id);
        } catch (e) { console.error('Ekipsiz kopya silinemedi:', silinecek.id, e); }
        setEkipsizIlerleme(p => ({ ...p, biten: (p?.biten || 0) + 1 }));
      }
      setSilinen(prev => [...prev, ...basarili]);
      if (onJobDeleted) onJobDeleted(basarili); // Arşiv katmanından da düşür
      if (addSystemLog) addSystemLog('Ekipsiz Kopyalar Temizlendi', `${basarili.length} adet ekibi atanmamış kopya iş kaydı silindi.`);
      setTimeout(() => setEkipsizIlerleme(null), 2500);
    };

    // ========================================================================
    // YENİ: BİREBİR AYNI KAYITLAR (güvenli otomatik temizlik adayları)
    // ========================================================================
    // Yukarıdaki "mükerrer" listesi benzer kayıtları da içerir (biri ekipli,
    // diğeri değil gibi) — orada karar insana aittir. Buradaki liste ise
    // TÜM alanları birebir tutan, ayırt edilemez kopyalardır. Her gruptan
    // yalnızca BİR tanesi tutulur; hangisinin tutulacağı doluluk puanına göre
    // seçilir (ekip/sonlandırma bilgisi olan kazanır), kalanlar silinebilir.
    // ========================================================================
    const birebirGruplar = useMemo(() => {
      const harita = new Map();
      (jobs || [])
        .filter(j => j && j.status !== 'cancelled' && !silinen.includes(j.id))
        .forEach(j => {
          if (!j.date || !adNormalize(j.customerName)) return;
          const im = birebirImza(j);
          if (!harita.has(im)) harita.set(im, []);
          harita.get(im).push(j);
        });
      return [...harita.values()]
        .filter(g => g.length > 1)
        .sort((a, b) => String(b[0].date).localeCompare(String(a[0].date)));
    }, [jobs, silinen]);

    // Bir kaydın ne kadar "dolu" olduğunu puanlar — hangisini tutacağınıza yardımcı olur
    const doluluk = (j) => {
      let p = 0;
      if ((j.assignedPersonnelIds || []).length > 0) p += 3; // Ekip atanmış
      if (j.team && j.team !== 'Atanmadı') p += 2;
      if (j.endJobDetails) p += 3;                            // İş sonlandırılmış
      if (j.deposit) p += 1;
      if (j.createdBy && j.createdBy !== 'Eski Sistem Aktarımı') p += 2;
      if (j.notes) p += 1;
      return p;
    };

    const kaydiSil = async (job) => {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id));
        setSilinen(prev => [...prev, job.id]);
        if (onJobDeleted) onJobDeleted([job.id]); // Arşiv katmanından da düşür
        if (addSystemLog) addSystemLog('Mükerrer Kayıt Silindi', `${job.customerName} (${job.date}) mükerrer iş kaydı silindi. Kaydı açan: ${job.createdBy || 'bilinmiyor'}.`);
      } catch (e) {
        console.error('Mükerrer kayıt silinemedi:', e);
        alert('Kayıt silinirken bir hata oluştu.');
      }
      setSiliniyor(null);
    };

    // ========================================================================
    // YENİ: BİREBİR KOPYALARI TOPLU SİL
    // Her gruptan en dolu kayıt TUTULUR, kalanları silinir. Silmeden önce
    // kullanıcıdan açık onay alınır (aşağıdaki onay penceresi).
    // ========================================================================
    const [topluSilOnay, setTopluSilOnay] = useState(false);
    const [topluIlerleme, setTopluIlerleme] = useState(null);

    const birebirTopluSil = async () => {
      const silinecekler = [];
      birebirGruplar.forEach(g => {
        const tutulan = g.reduce((a, b) => doluluk(b) > doluluk(a) ? b : a, g[0]);
        g.forEach(j => { if (j.id !== tutulan.id) silinecekler.push(j); });
      });
      setTopluSilOnay(false);
      setTopluIlerleme({ toplam: silinecekler.length, biten: 0 });
      const basarili = [];
      for (const j of silinecekler) {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', j.id));
          basarili.push(j.id);
        } catch (e) { console.error('Kopya silinemedi:', j.id, e); }
        setTopluIlerleme(p => ({ ...p, biten: (p?.biten || 0) + 1 }));
      }
      setSilinen(prev => [...prev, ...basarili]);
      if (onJobDeleted) onJobDeleted(basarili); // Arşiv katmanından da düşür
      if (addSystemLog) addSystemLog('Birebir Kopyalar Temizlendi', `${basarili.length} adet ayırt edilemez kopya iş kaydı silindi.`);
      setTimeout(() => setTopluIlerleme(null), 2500);
    };

    // ========================================================================
    // YENİ: YEDEKTEN İŞ KAYDI GERİ YÜKLEME
    // ========================================================================
    // Yanlışlıkla silinen işleri kurtarmanın TEK yolu budur; Firestore'da
    // silinen doküman kalıcı olarak yok olur. Bu araç, daha önce indirilmiş
    // JSON yedeğini okur, içindeki işlerden ŞU AN veritabanında BULUNMAYANLARI
    // tespit eder ve orijinal kimlikleriyle geri yazar.
    // GÜVENLİK: Mevcut kayıtların üzerine ASLA yazmaz — yalnızca eksik olanlar
    // eklenir. Böylece geri yükleme, sonradan yapılan düzenlemeleri bozmaz.
    // ========================================================================
    const [yedekIsler, setYedekIsler] = useState(null);   // Dosyadan okunan işler
    const [geriYukleniyor, setGeriYukleniyor] = useState(null);

    const yedekDosyaSec = (e) => {
      const dosya = e.target.files?.[0];
      if (!dosya) return;
      e.target.value = ''; // Aynı dosya tekrar seçilebilsin
      const okuyucu = new FileReader();
      okuyucu.onload = () => {
        try {
          const veri = JSON.parse(okuyucu.result);
          const isler = Array.isArray(veri.jobs) ? veri.jobs : null;
          if (!isler) { alert('Bu dosyada iş kaydı bulunamadı. Sistem Yedekleme ile indirilmiş .json dosyasını seçin.'); return; }
          setYedekIsler({ tarih: veri.timestamp, isler });
        } catch (err) {
          alert('Dosya okunamadı. Geçerli bir yedek (.json) dosyası seçtiğinizden emin olun.');
        }
      };
      okuyucu.readAsText(dosya);
    };

    // Yedekte olup şu an sistemde OLMAYAN işler
    const eksikIsler = useMemo(() => {
      if (!yedekIsler) return [];
      const mevcutIdler = new Set((jobs || []).map(j => j.id));
      return yedekIsler.isler.filter(j => j?.id && !mevcutIdler.has(j.id));
    }, [yedekIsler, jobs]);

    const eksikleriGeriYukle = async () => {
      setGeriYukleniyor({ toplam: eksikIsler.length, biten: 0 });
      let basarili = 0;
      for (const j of eksikIsler) {
        try {
          const { id, ...veri } = j; // id alanı doküman kimliği olarak kullanılır
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), veri);
          basarili++;
        } catch (e) { console.error('Geri yüklenemedi:', j.id, e); }
        setGeriYukleniyor(p => ({ ...p, biten: (p?.biten || 0) + 1 }));
      }
      if (addSystemLog) addSystemLog('Yedekten Geri Yükleme', `${basarili} adet silinmiş iş kaydı yedekten geri yüklendi.`);
      setTimeout(() => { setGeriYukleniyor(null); setYedekIsler(null); }, 2500);
    };

    const handleBackup = () => {
      const backupData = {
        timestamp: new Date().toISOString(),
        jobs,
        personnelList,
        vehicles,
        materials
      };
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `sembol_yedek_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      if(addSystemLog) {
        addSystemLog('Sistem Yedeği Alındı', 'Kullanıcı tüm veritabanının yedeğini indirdi.');
      }
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Database className="w-6 h-6 text-red-600" /> Sistem Yedekleme
        </h2>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium mb-6 border border-blue-200">
          Sistemdeki tüm operasyonları, personelleri, araçları ve stok kayıtlarını tek bir JSON dosyası olarak bilgisayarınıza indirebilirsiniz. Veri güvenliği için düzenli yedek almanız önerilir.
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-neutral-50 p-6 rounded-xl border border-neutral-200 flex flex-col items-center justify-center text-center gap-3">
            <Database className="w-12 h-12 text-neutral-400" />
            <h3 className="font-bold text-black text-lg">Tüm Veritabanını İndir</h3>
            <p className="text-xs text-neutral-500 font-medium px-4">İşler, Personeller, Araçlar, Stoklar vb. sistem verilerini içerir.</p>
            <button onClick={handleBackup} className="mt-2 w-full max-w-xs py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-lg">
              <Download className="w-5 h-5" /> Yedeği İndir (.json)
            </button>
          </div>
        </div>

        {/* ==================================================================
            YENİ: YEDEKTEN GERİ YÜKLEME
            Silinen iş kayıtlarını kurtarmanın tek yolu. Yalnızca sistemde
            BULUNMAYAN kayıtlar eklenir; mevcutların üzerine yazılmaz.
            ================================================================== */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
            <Upload className="w-6 h-6 text-green-600" /> Yedekten İş Kaydı Geri Yükle
          </h2>
          <div className="bg-green-50 text-green-800 p-4 rounded-xl text-sm font-medium mb-4 border border-green-200">
            Yanlışlıkla silinen işleri kurtarmak için daha önce indirdiğiniz <b>.json yedeğini</b> seçin. Sistem, yedekte olup şu an veritabanında <b>bulunmayan</b> kayıtları bulur ve orijinal kimlikleriyle geri yazar. Mevcut kayıtlara dokunulmaz, üzerine yazılmaz. <b>Yedeğiniz yoksa silinen kayıtlar geri getirilemez</b> — Firestore'da silme kalıcıdır.
          </div>

          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-3 bg-white border border-neutral-300 border-dashed rounded-xl hover:bg-neutral-50 transition text-sm font-bold text-neutral-700">
            <Upload className="w-4 h-4" /> Yedek Dosyası Seç (.json)
            <input type="file" accept="application/json,.json" onChange={yedekDosyaSec} className="hidden" />
          </label>

          {yedekIsler && (
            <div className="mt-4 border border-green-200 rounded-xl overflow-hidden">
              <div className="bg-green-100 px-4 py-2 text-xs font-black text-green-800">
                Yedek tarihi: {yedekIsler.tarih ? new Date(yedekIsler.tarih).toLocaleString('tr-TR') : 'bilinmiyor'} • Yedekteki iş sayısı: {yedekIsler.isler.length}
              </div>
              <div className="p-4">
                {eksikIsler.length === 0 ? (
                  <p className="text-sm font-bold text-neutral-600">Bu yedekteki tüm işler sistemde zaten mevcut — geri yüklenecek kayıt yok.</p>
                ) : (
                  <>
                    <p className="text-sm font-black text-green-700 mb-3">{eksikIsler.length} kayıt sistemde bulunmuyor, geri yüklenebilir:</p>
                    <div className="max-h-56 overflow-y-auto space-y-1 mb-4">
                      {eksikIsler.slice(0, 100).map(j => (
                        <div key={j.id} className="text-xs font-medium text-neutral-600 bg-neutral-50 px-3 py-1.5 rounded-lg flex justify-between gap-2">
                          <span className="truncate"><b className="text-black">{j.customerName}</b> • {j.date?.split('-').reverse().join('.')} {j.time || ''}</span>
                          <span className="shrink-0">₺{j.price ? parseInt(j.price).toLocaleString('tr-TR') : '0'}</span>
                        </div>
                      ))}
                      {eksikIsler.length > 100 && <p className="text-[11px] font-bold text-neutral-400 px-3">…ve {eksikIsler.length - 100} kayıt daha</p>}
                    </div>
                    {geriYukleniyor ? (
                      <p className="text-sm font-bold text-green-700">Geri yükleniyor… {geriYukleniyor.biten} / {geriYukleniyor.toplam}</p>
                    ) : (
                      <button onClick={eksikleriGeriYukle} className="px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center gap-2 shadow-lg">
                        <Upload className="w-4 h-4" /> {eksikIsler.length} Kaydı Geri Yükle
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================
            YENİ: EKİPSİZ KOPYALAR — en güvenilir temizlik
            Ekip atanmış kayıt orijinaldir; aynı gün/müşteri/telefondaki
            ekipsiz ve sonlandırılmamış kayıtlar aktarım artığıdır.
            ================================================================== */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-red-600" /> Ekipsiz Kopyalar
          </h2>
          <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-4 border border-red-200">
            <b>Ekip listesi olan kayıt orijinaldir.</b> Aynı gün, aynı müşteri ve aynı telefonla kayıtlı olup <b>ekibi atanmamış</b> ve <b>sonlandırılmamış</b> kayıtlar, eski sistem aktarımının bıraktığı kopyalardır. Adresler farklı yazılmış olsa bile yakalanır — aktarımda adres alanları bozulabildiği için karşılaştırmaya girmez. Grupta ekipli <b>birden fazla</b> kayıt varsa hiç dokunulmaz (gerçekten iki ayrı iş olabilir); o gruplar aşağıda tek tek incelenir. <b>Silmeden önce yukarıdan yedek alın.</b>
          </div>

          {ekipsizIlerleme ? (
            <p className="text-sm font-bold text-red-700">Siliniyor… {ekipsizIlerleme.biten} / {ekipsizIlerleme.toplam}</p>
          ) : ekipsizKopyalar.length === 0 ? (
            <p className="text-sm font-bold text-green-700 bg-green-50 p-4 rounded-xl border border-green-200 text-center">Ekipsiz kopya bulunamadı.</p>
          ) : (
            <>
              <p className="text-sm font-bold text-neutral-600 mb-3">{ekipsizKopyalar.length} kopya silinebilir:</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5 mb-4">
                {ekipsizKopyalar.map(({ silinecek, tutulan }, i) => (
                  <div key={i} className="text-xs bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200">
                    <div className="font-black text-black mb-1">{silinecek.customerName} • {silinecek.date?.split('-').reverse().join('.')} {silinecek.time || ''} • ₺{silinecek.price ? parseInt(silinecek.price).toLocaleString('tr-TR') : '0'}</div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 font-medium">
                      <span className="text-green-700">✓ Tutulacak: <b>{(tutulan.assignedPersonnelIds || []).length} kişilik ekip</b> • {tutulan.createdBy || '—'}</span>
                      <span className="text-red-700">✕ Silinecek: <b>ekip yok</b> • {silinecek.createdBy || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setEkipsizOnay(true)} className="px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex items-center gap-2 shadow-lg">
                <Trash2 className="w-4 h-4" /> {ekipsizKopyalar.length} Ekipsiz Kopyayı Sil
              </button>
            </>
          )}
        </div>

        {/* Ekipsiz kopya silme onayı */}
        {ekipsizOnay && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Ekipsiz Kopyaları Sil</h3>
              <p className="text-neutral-600 mb-2 text-sm font-medium">
                {ekipsizKopyalar.length} kayıt silinecek. Ekibi atanmış orijinaller korunacak.
              </p>
              <p className="text-red-600 mb-6 text-xs font-bold">Bu işlem geri alınamaz. Yedeğinizi aldınız mı?</p>
              <div className="flex gap-3">
                <button onClick={() => setEkipsizOnay(false)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={ekipsizTopluSil} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ: BİREBİR AYNI KAYITLAR (güvenli toplu temizlik)
            Tüm alanları (fiyat, saat, adresler, telefon, not) birebir tutan
            ayırt edilemez kopyalar. Her gruptan biri tutulur.
            ================================================================== */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
            <Copy className="w-6 h-6 text-red-600" /> Birebir Aynı Kayıtlar
          </h2>
          <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-4 border border-red-200">
            Burada yalnızca <b>tüm alanları birebir aynı</b> olan kayıtlar listelenir: tarih, saat, müşteri, telefon, tutar, kapora, alış/teslim adresleri ve not. Bunlar ayırt edilemez kopyalardır, birini silmek bilgi kaybettirmez. Her gruptan <b>bir kayıt tutulur</b>. Benzer ama farklı kayıtlar (biri ekipli, diğeri değil gibi) buraya <b>girmez</b> — onlar aşağıdaki listede tek tek incelenir. <b>Silmeden önce yukarıdan yedek alın.</b>
          </div>

          {topluIlerleme ? (
            <p className="text-sm font-bold text-red-700">Siliniyor… {topluIlerleme.biten} / {topluIlerleme.toplam}</p>
          ) : birebirGruplar.length === 0 ? (
            <p className="text-sm font-bold text-green-700 bg-green-50 p-4 rounded-xl border border-green-200 text-center">Birebir aynı kayıt bulunamadı.</p>
          ) : (
            <>
              <p className="text-sm font-bold text-neutral-600 mb-3">
                {birebirGruplar.length} grup • silinecek kopya: {birebirGruplar.reduce((t, g) => t + g.length - 1, 0)} kayıt
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1 mb-4">
                {birebirGruplar.map((g, i) => (
                  <div key={i} className="text-xs font-medium text-neutral-600 bg-neutral-50 px-3 py-1.5 rounded-lg flex justify-between gap-2">
                    <span className="truncate"><b className="text-black">{g[0].customerName}</b> • {g[0].date?.split('-').reverse().join('.')} {g[0].time || ''} • ₺{g[0].price ? parseInt(g[0].price).toLocaleString('tr-TR') : '0'}</span>
                    <span className="shrink-0 font-black text-red-600">{g.length} kopya</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setTopluSilOnay(true)} className="px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex items-center gap-2 shadow-lg">
                <Trash2 className="w-4 h-4" /> Kopyaları Temizle (her gruptan 1 kayıt kalır)
              </button>
            </>
          )}
        </div>

        {/* Toplu silme onay penceresi */}
        {topluSilOnay && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Kopyaları Temizle</h3>
              <p className="text-neutral-600 mb-2 text-sm font-medium">
                {birebirGruplar.reduce((t, g) => t + g.length - 1, 0)} adet birebir kopya silinecek. Her gruptan bir kayıt korunacak.
              </p>
              <p className="text-red-600 mb-6 text-xs font-bold">Bu işlem geri alınamaz. Yedeğinizi aldınız mı?</p>
              <div className="flex gap-3">
                <button onClick={() => setTopluSilOnay(false)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={birebirTopluSil} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg">Evet, Temizle</button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ: MÜKERRER İŞ KAYITLARI
            Aynı gün + aynı müşteri adına birden fazla iş kaydı varsa burada
            listelenir. Silme işlemi her zaman kullanıcı onayıyla yapılır.
            ================================================================== */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
            <Copy className="w-6 h-6 text-orange-600" /> Mükerrer İş Kayıtları
          </h2>
          <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm font-medium mb-4 border border-orange-200">
            Aynı <b>gün</b>, aynı <b>müşteri adı</b> ve aynı <b>telefon</b> ile birden fazla iş kaydı varsa burada listelenir. (Telefonu farklı olan aynı isimli müşteriler AYRI kişi sayılır, gruplanmaz.) Genellikle eski sistemden yapılan toplu aktarımın, elle girilmiş kayıtlarla çakışmasından oluşur. Adlar Türkçe karakter ve boşluk farkları gözetilmeden eşleştirilir ("Müminoğlu" = "Mümin oğlu"). <b>Hiçbir kayıt otomatik silinmez</b> — hangisinin kalacağına siz karar verirsiniz. Silmeden önce yukarıdan yedek almanız önerilir.
          </div>

          {!mukerrerAcik ? (
            <button onClick={() => setMukerrerAcik(true)} className="w-full max-w-xs py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-lg">
              <Search className="w-5 h-5" /> Mükerrer Kayıtları Tara
            </button>
          ) : mukerrerGruplar.length === 0 ? (
            <p className="text-sm font-bold text-green-700 bg-green-50 p-4 rounded-xl border border-green-200 text-center">
              Mükerrer iş kaydı bulunamadı. {silinen.length > 0 ? `(${silinen.length} kayıt bu oturumda silindi.)` : ''}
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-bold text-neutral-600">
                {mukerrerGruplar.length} mükerrer grup bulundu
                {silinen.length > 0 ? ` • ${silinen.length} kayıt silindi` : ''}
              </p>
              {mukerrerGruplar.map((grup, gi) => {
                // Grubun en "dolu" kaydı — tutulması önerilen kayıt
                const enDolu = grup.reduce((a, b) => doluluk(b) > doluluk(a) ? b : a, grup[0]);
                return (
                  <div key={gi} className="border border-orange-200 rounded-xl overflow-hidden">
                    <div className="bg-orange-100 px-4 py-2 text-xs font-black text-orange-800">
                      {grup[0].date?.split('-').reverse().join('.')} • {grup[0].customerName} • {grup.length} kayıt
                    </div>
                    <div className="divide-y divide-neutral-200">
                      {grup.map(j => {
                        const onerilir = j.id === enDolu.id;
                        return (
                          <div key={j.id} className={`p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${onerilir ? 'bg-green-50' : 'bg-white'}`}>
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-black text-black">{j.customerName}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{j.type || 'Nakliye'}</span>
                                {onerilir && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-600 text-white">BUNU TUTUN</span>}
                              </div>
                              <div className="text-neutral-500 font-medium space-y-0.5">
                                <div>Kaydı açan: <b className={j.createdBy === 'Eski Sistem Aktarımı' ? 'text-orange-700' : 'text-black'}>{j.createdBy || 'bilinmiyor'}</b></div>
                                <div>Ekip: <b className="text-black">{(j.assignedPersonnelIds || []).length > 0 ? `${j.assignedPersonnelIds.length} kişi atanmış` : 'Atanmadı'}</b> • Araç: <b className="text-black">{j.team && j.team !== 'Atanmadı' ? j.team : '—'}</b></div>
                                <div>Tutar: <b className="text-black">₺{j.price ? parseInt(j.price).toLocaleString('tr-TR') : '0'}</b> • Kapora: <b className="text-black">₺{j.deposit ? parseInt(j.deposit).toLocaleString('tr-TR') : '0'}</b> • {j.endJobDetails ? <b className="text-green-700">Sonlandırılmış</b> : 'Sonlandırılmamış'}</div>
                              </div>
                            </div>
                            <button onClick={() => setSiliniyor(j)} className="shrink-0 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100 transition flex items-center gap-1.5">
                              <Trash2 className="w-3.5 h-3.5" /> Bu Kaydı Sil
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Silme onay penceresi — kalıcı silme her zaman açık onay ister */}
        {siliniyor && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Kaydı Kalıcı Olarak Sil</h3>
              <p className="text-neutral-600 mb-2 text-sm font-medium">
                <b>{siliniyor.customerName}</b> — {siliniyor.date?.split('-').reverse().join('.')}
              </p>
              <p className="text-neutral-500 mb-6 text-xs font-medium">
                Kaydı açan: {siliniyor.createdBy || 'bilinmiyor'}. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setSiliniyor(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={() => kaydiSil(siliniyor)} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SystemLogsView = ({ logs }) => {
    // YENİ: Kayıtları tarih/saate göre en YENİden en ESKİye sırala.
    // timestamp formatı "GG.AA.YYYY SS:DD" olduğundan parse edip karşılaştırıyoruz.
    const parseLogDate = (str) => {
      if (!str) return 0;
      const parts = String(str).trim().split(' ');
      const datePart = parts[0] || '';
      const timePart = parts[1] || '00:00';
      const [d, m, y] = datePart.split('.');
      const [hr, min] = timePart.split(':');
      const t = new Date(`${y}-${m}-${d}T${(hr || '00').padStart(2, '0')}:${(min || '00').padStart(2, '0')}:00`).getTime();
      return isNaN(t) ? 0 : t;
    };
    const sortedLogs = [...logs].sort((a, b) => parseLogDate(b.timestamp) - parseLogDate(a.timestamp));

    return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Activity className="w-6 h-6 text-red-600" /> Hareket Geçmişi (Log Kayıtları)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
            <tr>
              <th className="p-4 font-bold rounded-tl-xl">Tarih / Saat</th>
              <th className="p-4 font-bold">İşlemi Yapan</th>
              <th className="p-4 font-bold">İşlem Türü</th>
              <th className="p-4 font-bold rounded-tr-xl">Detaylar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedLogs.map(log => (
              <tr key={log.id} className="hover:bg-neutral-50 transition">
                <td className="p-4 font-medium text-black whitespace-nowrap">{log.timestamp}</td>
                <td className="p-4 font-bold text-neutral-800">{log.user}</td>
                <td className="p-4">
                  <span className="bg-neutral-100 px-2 py-1 rounded-md text-xs font-bold border border-neutral-200">{log.action}</span>
                </td>
                <td className="p-4 text-neutral-600">{log.details}</td>
              </tr>
            ))}
            {sortedLogs.length === 0 && (
              <tr>
                <td colSpan="4" className="p-6 text-center text-neutral-500 font-medium">Sistemde henüz bir hareket bulunmuyor.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const UserActivitiesView = ({ personnelList }) => {
    const sortedList = [...personnelList].sort((a, b) => {
      const parseDate = (str) => {
        if (!str) return 0;
        const parts = str.split(' ');
        if (parts.length < 2) return 0;
        const [datePart, timePart] = parts;
        const [d, m, y] = datePart.split('.');
        const [hr, min] = timePart.split(':');
        return new Date(`${y}-${m}-${d}T${hr}:${min}:00`).getTime() || 0;
      };
      return parseDate(b.lastLogin) - parseDate(a.lastLogin);
    });

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Activity className="w-6 h-6 text-red-600" /> Kullanıcı Hareketleri (Son Girişler)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Personel</th>
                <th className="p-4 font-bold">Pozisyon / Rütbe</th>
                <th className="p-4 font-bold rounded-tr-xl">Sisteme Son Giriş Zamanı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedList.map(p => (
                <tr key={p.id} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {p.profileImage ? <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" /> : p.fullName.charAt(0)}
                      </div>
                      {p.fullName}
                    </div>
                  </td>
                  <td className="p-4 text-neutral-600 font-medium">
                    <span className="block text-black font-bold">{p.position}</span>
                    <span className="text-xs text-neutral-500">{p.rank}</span>
                  </td>
                  <td className="p-4">
                    {p.lastLogin ? (
                      <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-100 font-bold flex items-center gap-1.5 w-max">
                        <Clock className="w-4 h-4 shrink-0" /> {p.lastLogin}
                      </span>
                    ) : (
                      <span className="bg-neutral-100 text-neutral-500 px-3 py-1.5 rounded-lg border border-neutral-200 font-bold flex items-center gap-1.5 w-max">
                        <Clock className="w-4 h-4 shrink-0" /> Henüz Giriş Yapmadı
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedList.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-6 text-center text-neutral-500">Kayıtlı personel bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const NotificationsView = ({ notifications, markNotificationsAsRead, currentUser, canAddInfo, onAddInfo }) => {
    useEffect(() => {
      if (currentUser?.id) {
        markNotificationsAsRead(currentUser.id);
      }
    }, [currentUser?.id]);

    const myNotifications = notifications
      .filter(n => n.userId === currentUser?.id)
      .sort((a, b) => {
         const parseDate = (str) => {
            if (!str) return 0;
            const parts = str.split(' ');
            if (parts.length < 2) return 0;
            const [datePart, timePart] = parts;
            const [d, m, y] = datePart.split('.');
            const [hr, min] = timePart.split(':');
            return new Date(`${y}-${m}-${d}T${hr}:${min}:00`).getTime() || 0;
         };
         return parseDate(b.date) - parseDate(a.date);
      });

    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-neutral-200 pb-4">
          <h2 className="text-2xl font-black text-black flex items-center gap-2">
            <Bell className="w-7 h-7 text-red-600" /> Bildirim Merkezi
          </h2>
          {/* YENİ: "Bilgilendirme Ekle" artık sol menüde ayrı bir bölüm değil,
              Bildirim Merkezi'nin sağ üstünde bir buton olarak burada. */}
          {canAddInfo && (
            <button
              onClick={onAddInfo}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-black rounded-xl transition flex items-center gap-2 shadow-md shadow-red-600/20"
            >
              <PlusCircle className="w-4 h-4" /> Bilgilendirme Ekle
            </button>
          )}
        </div>
        <div className="space-y-4">
          {myNotifications.length === 0 ? (
             <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200">
               <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
               <p className="text-neutral-500 font-medium">Sistemde size ait herhangi bir bildirim bulunmuyor.</p>
             </div>
          ) : (
             myNotifications.map(n => (
               <div key={n.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                 // Görev/not bildirimi tamamlanana kadar sarı vurguyla AYRIŞIR
                 n.type === 'hatirlatmaGorev' && !n.gorevTamamlandi ? 'bg-amber-50 border-amber-300'
                 : n.read ? 'bg-white border-neutral-200' : 'bg-red-50/40 border-red-200'}`}>
                 <div className="min-w-0">
                   <h4 className="font-bold text-black flex items-center gap-2 text-lg">
                     {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0"></span>}
                     {n.title}
                     {n.type === 'hatirlatmaGorev' && (
                       n.gorevTamamlandi
                         ? <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">TAMAMLANDI</span>
                         : <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full shrink-0 animate-pulse">BEKLİYOR</span>
                     )}
                   </h4>
                   <p className="text-sm text-neutral-600 mt-1.5 leading-relaxed">{n.message}</p>
                 </div>
                 <div className="shrink-0 text-right space-y-2">
                    <span className="inline-block text-xs font-bold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />{n.date}
                    </span>
                    {/* ==========================================================
                        YENİ: TAMAMLANDI OLARAK İŞARETLE
                        Görev/not bildirimi, hatırlatmanın kendisine bağlıdır
                        (hatirlatmaId). Düğme İKİ şeyi birden yapar:
                          1) hatirlatmalar/{id} -> tamamlandi:true (Hatırlatmalar
                             sayfasında da tamamlanmış görünür, rozet söner)
                          2) Bu bildirime gorevTamamlandi:true yazar (rozet ve
                             sarı vurgu kalkar, TAMAMLANDI etiketi kalır)
                        Görev tamamlanana kadar düğme burada durur — kullanıcı
                        talebi: "tamamlandı işaretlenene kadar görsün".
                        ========================================================== */}
                    {n.type === 'hatirlatmaGorev' && n.hatirlatmaId && !n.gorevTamamlandi && (
                      <button type="button"
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar', n.hatirlatmaId), {
                              tamamlandi: true,
                              tamamlayan: currentUser?.fullName || 'Sistem',
                              tamamlanmaTarihi: new Date().toISOString(),
                            });
                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', n.id), {
                              gorevTamamlandi: true, read: true,
                            });
                          } catch (e) { console.error('Görev tamamlanamadı:', e); alert('İşaretlenemedi, tekrar deneyin.'); }
                        }}
                        className="block w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition">
                        ✓ Tamamlandı Olarak İşaretle
                      </button>
                    )}
                 </div>
               </div>
             ))
          )}
        </div>
      </div>
    );
  };

  const ProfileSettingsView = ({ currentUser, handleUpdatePersonnel, showMySpecialTasks, tasks, handleUpdateTaskStatus, showMyComplaint, db, appId, addSystemLog }) => {
    const [editForm, setEditForm] = useState({ 
      personalPhone: currentUser?.personalPhone || '', 
      password: currentUser?.password || '', 
      profileImage: currentUser?.profileImage || '' 
    });
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    // YENİ: Giriş şifresi varsayılan olarak gizli; göz ikonuyla geçici açılıp kapanabilir
    const [sifreGorunur, setSifreGorunur] = useState(false);

    const showMessage = (text, type = 'success') => {
      setStatusMessage({ text, type });
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
    };

    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      setEditForm(prev => ({ ...prev, profileImage: 'Yükleniyor...' }));
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setEditForm(prev => ({ ...prev, profileImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err); 
        showMessage("Görsel yüklenemedi.", "error"); 
        setEditForm(prev => ({ ...prev, profileImage: '' }));
      }
      setIsUploading(false);
    };

    const handleSaveProfile = (e) => {
      e.preventDefault();
      handleUpdatePersonnel({ ...currentUser, ...editForm });
      showMessage('Profil bilgileriniz güncellendi.', 'success');
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in relative">
         {statusMessage.text && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-sm shadow-xl z-50 animate-in slide-in-from-top-4 ${statusMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
              {statusMessage.text}
            </div>
         )}
         <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
           <User className="w-7 h-7 text-red-600" /> Profil Bilgilerim
         </h2>
         <div  className="space-y-6">
           <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
             <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-neutral-200 flex items-center justify-center shrink-0">
               {editForm.profileImage === 'Yükleniyor...' ? (
                 <span className="text-xs text-neutral-500 font-bold animate-pulse">Yükleniyor...</span>
               ) : editForm.profileImage ? (
                 <img src={editForm.profileImage} alt="Profil" className="w-full h-full object-cover" />
               ) : (
                 <User className="w-10 h-10 text-neutral-400" />
               )}
             </div>
             <div className="flex flex-col gap-2 w-full sm:w-auto">
               <label className="block text-sm font-bold text-neutral-700">Profil Fotoğrafını Değiştir</label>
               <MediaCaptureMenu onChange={handleImageUpload} disabled={isUploading} compact buttonLabel="Fotoğraf Seç" buttonClassName="cursor-pointer px-4 py-2 bg-white border border-neutral-300 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-50 transition w-full sm:w-fit shadow-sm" />
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Ad Soyad (Değiştirilemez)</label>
               <input type="text" readOnly value={currentUser.fullName} className="w-full p-3 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-500 font-bold outline-none cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Pozisyon (Değiştirilemez)</label>
               <input type="text" readOnly value={currentUser.position} className="w-full p-3 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-500 font-bold outline-none cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Kişisel Telefon</label>
               <input type="tel" value={editForm.personalPhone} onChange={e => setEditForm({...editForm, personalPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             {/* YENİ: Şirket Telefonu — şirket tarafından atanır, buradan sadece görüntülenir */}
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Şirket Telefonu (Değiştirilemez)</label>
               <input type="text" readOnly value={currentUser?.companyPhone || 'Kayıtlı değil'} className="w-full p-3 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-500 font-bold outline-none cursor-not-allowed" />
             </div>
             {/* YENİ: Doğum Tarihi — Özlük'ten girilir, buradan sadece görüntülenir */}
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Doğum Tarihi (Değiştirilemez)</label>
               <input type="text" readOnly value={currentUser?.birthDate ? new Date(currentUser.birthDate).toLocaleDateString('tr-TR') : 'Kayıtlı değil'} className="w-full p-3 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-500 font-bold outline-none cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Giriş Şifresi</label>
               {/* YENİ: Şifre varsayılan olarak gizli (type="password"); göz ikonuyla geçici görülebilir */}
               <div className="relative">
                 <input
                   type={sifreGorunur ? 'text' : 'password'}
                   value={editForm.password}
                   onChange={e => setEditForm({...editForm, password: e.target.value})}
                   className="w-full p-3 pr-11 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition"
                 />
                 <button type="button" onClick={() => setSifreGorunur(v => !v)}
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition"
                   title={sifreGorunur ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                 >
                   {sifreGorunur ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                 </button>
               </div>
             </div>
           </div>

           <button type="button" onClick={handleSaveProfile} disabled={isUploading} className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 disabled:opacity-50">
             Bilgilerimi Güncelle
           </button>
         </div>
      </div>

      {/* YENİ: "Özel Görevlerim" artık sol menüde ayrı bir bölüm değil, Profilim
          sayfasının bir parçası. Yeni/bitmemiş görev sayısı sol menüdeki
          "Profilim" yazısının yanında yanıp sönen ışıkla da gösteriliyor. */}
      {showMySpecialTasks && (
        <MyTasksView currentUser={currentUser} tasks={tasks} handleUpdateTaskStatus={handleUpdateTaskStatus} />
      )}

      {/* YENİ: "Şikayet Bildirim" de aynı mantıkla artık sol menüde değil,
          Profilim sayfasının bir parçası. Sistem/personel/araç sorunlarını
          buradan yönetime bildirebilirsiniz. */}
      {showMyComplaint && (
        <MyComplaintSubmitView currentUser={currentUser} db={db} appId={appId} addSystemLog={addSystemLog} />
      )}
      </div>
    );
  };

  const MyTasksView = ({ currentUser, tasks, handleUpdateTaskStatus }) => {
    const myTasks = tasks.filter(t => t.assignee === currentUser?.fullName || t.assignee === 'Tüm Personeller');
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <CheckSquare className="w-6 h-6 text-red-600" /> Özel Görevlerim
        </h2>
        <div className="space-y-4">
           {myTasks.length === 0 ? (
              <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 font-medium">
                Size atanmış özel bir görev bulunmuyor.
              </div>
           ) : myTasks.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(task => (
              <div key={task.id} className="p-5 border border-neutral-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-black text-lg">{task.title}</h3>
                      <p className="text-xs font-bold text-neutral-400 mt-1">Son Tarih: {task.date}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      task.status === 'completed' ? 'bg-black text-white' :
                      task.status === 'in-progress' ? 'bg-blue-600 text-white' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {task.status === 'completed' ? 'Yapıldı' : task.status === 'in-progress' ? 'İşleniyor' : 'Bekliyor'}
                    </span>
                 </div>
                 <p className="text-sm text-neutral-600">{task.description}</p>
                 
                 <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100">
                   {task.status !== 'todo' && <button onClick={() => handleUpdateTaskStatus(task.id, 'todo')} className="flex-1 py-2 text-xs font-bold rounded-lg border border-neutral-200 hover:bg-neutral-50 transition">Bekliyor Yap</button>}
                   {task.status !== 'in-progress' && <button onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')} className="flex-1 py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition">İşleme Al</button>}
                   {task.status !== 'completed' && <button onClick={() => handleUpdateTaskStatus(task.id, 'completed')} className="flex-1 py-2 text-xs font-bold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">Tamamlandı</button>}
                 </div>
              </div>
           ))}
        </div>
      </div>
    );
  };

  const LoginScreen = ({ onLogin, error, appBranding }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    React.useEffect(() => {
      try {
        const savedUser = localStorage.getItem('sembol_crm_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.password) setPassword(parsed.password);
          setRememberMe(true);
        }
      } catch (e) {
        console.warn("Önbellek okuma hatası:", e);
      }
    }, []);

    const handleSubmit = (e) => {
      e.preventDefault();
      onLogin(email, password, rememberMe);
    };

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-neutral-50 p-8 flex flex-col items-center border-b border-neutral-200">
            <MarkaLogo
              logoUrl={appBranding?.logoUrl}
              className="max-w-[80%] w-auto object-contain mb-2 drop-shadow-sm"
              style={{ height: `${96 * ((appBranding?.logoSize || 100) / 100)}px` }}
              fallback={(
                <div className="flex flex-col items-center mb-2">
                  <div className="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg">S</div>
                  <h1 className="text-2xl font-black text-black tracking-widest mt-2">SEMBOL</h1>
                </div>
              )}
            />
            <p className="text-red-600 text-xs font-bold mt-1 tracking-[0.2em] bg-red-50 px-3 py-1 rounded-full border border-red-100">OPERASYON MERKEZİ</p>
          </div>
          
          {/* ================================================================
              DEĞİŞTİ: <div> yerine gerçek <form> kullanılıyor.
              Sebep: Eskiden giriş yalnızca butona TIKLANARAK yapılabiliyordu;
              kullanıcı adı/şifre alanlarında Enter tuşu hiçbir şey yapmıyordu.
              Gerçek form + type="submit" buton sayesinde her iki alanda da
              Enter'a basmak formu gönderir (tarayıcının doğal davranışı).
              handleSubmit içindeki e.preventDefault() sayfa yenilenmesini
              engeller; "required" alan denetimleri de artık çalışır.
              ================================================================ */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
                <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">E-Posta veya Ad Soyad</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"><User className="w-5 h-5" /></span>
                <input 
                  required 
                  type="text" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition font-medium" 
                  placeholder="Örn: Ahmet Öztürk" 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Şifre</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"><Lock className="w-5 h-5" /></span>
                <input 
                  required 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition font-medium" 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id="remember" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-600 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm font-bold text-neutral-600 cursor-pointer">
                Beni Hatırla
              </label>
            </div>
            
            {/* DEĞİŞTİ: type="button" + onClick yerine type="submit" — Enter
                tuşu da bu butonu tetikler, tıklama davranışı aynen korunur */}
            <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 text-lg mt-4">
              Sisteme Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  };

  // --- ANA UYGULAMA (APP) ---
  // YENİ: Bu fonksiyonun adı "App" idi, "AppInternal" olarak değiştirildi.
  // İçeriğine (state'ler, useEffect'ler, JSX) TEK BİR SATIR dokunulmadı.
  // Sebep: aşağıda tanımlanan ErrorBoundary ile sarmalanabilmesi için.
  // Dosyanın en altındaki "export default function App()" gerçek giriş
  // noktasıdır ve AppInternal'i ErrorBoundary içinde render eder.
  // ==========================================================================
  // İŞ KILAVUZU — ÖZELLİK YAYIN TARİHİ
  // Üst çubuktaki kılavuz simgesi, bu tarihten itibaren 30 GÜN boyunca
  // "YENİ" rozetiyle yanıp söner; süre dolunca kendiliğinden normale döner.
  // Yeni bir duyuru yapmak isterseniz bu tarihi güncellemeniz yeterlidir.
  // ==========================================================================
  const KILAVUZ_YAYIN_TARIHI = '2026-08-16';

  function AppInternal() {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    // YENİ: Ana içerik alanının kaydırma kabı — "iki kez yukarı çek → yenile" için gerekli
    const mainScrollRef = useRef(null);
    const cekimRef = useRef({ sayac: 0, sonZaman: 0, zamanlayici: null });
    const [yenilemeAsamasi, setYenilemeAsamasi] = useState(0); // 0: yok, 1: bir kez çekildi, 2: yenileniyor
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    // YENİ: Kayıtlı oturum var mı? (varsa açılışta giriş ekranı "flaş" etmesin)
    const kayitliOturumVar = React.useMemo(() => {
      try { return !!localStorage.getItem('sembol_crm_user'); } catch (e) { return false; }
    }, []);
    const [oturumDenendi, setOturumDenendi] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // ========================================================================
    // YENİ: HATIRLATMA BİLDİRİM SAYACI
    // Sol menüdeki "Hatırlatmalar" öğesinin yanında yanan ışık ve sayı için.
    // Sayaç = bugüne ait + geçmişte kalıp hâlâ tamamlanmamış hatırlatmalar.
    // (Modülün kendi verisini dinler; başka hiçbir mevcut state'e dokunmaz.)
    // ÖNEMLİ: Bu blok, React Hook Kuralları gereği fonksiyonun en başında,
    // HERHANGİ BİR erken "return" ifadesinden ÖNCE bulunmak zorundadır.
    // (Önceki konumu erken return'lerden sonraydı; bu, giriş yapıldıktan
    // sonra hook sırası değiştiği için React'i çökertip BEYAZ EKRANA
    // sebep oluyordu. Buraya taşınarak sorun kalıcı olarak çözüldü.)
    // ========================================================================
    const [hatirlatmaBildirim, setHatirlatmaBildirim] = useState(0);
    // YENİ: Bu kullanıcıya ATANMIŞ ve henüz TAMAMLANMAMIŞ görev sayısı.
    // Zil ikonundaki rozet, görev tamamlanana kadar yanıp sönmeye devam eder
    // (bildirim okunsa bile — çünkü iş bitmediyse hatırlatma sürmelidir).
    const [atanmisGorevSayisi, setAtanmisGorevSayisi] = useState(0);
    // ========================================================================
    // DÜZELTME (Firestore okuma patlaması denetimi): Bu koleksiyon ('hatirlatmalar')
    // eskiden İKİ AYRI onSnapshot ile dinleniyordu (biri sadece rozet sayısı için,
    // biri sadece tarayıcı bildirimi için) — bu, aynı veriyi iki kat okutuyordu.
    // Artık TEK bir dinleyici hem rozet sayısını hem bildirimleri üretiyor.
    // ========================================================================
    const hatirlatmaIlkYuklemeRef = useRef(true);
    useEffect(() => {
      if (!isAuthenticated) return;
      // OKUMA SINIRI: 'hatirlatmalar' zamanla büyüyen bir koleksiyondur ve
      // sınırsız dinlenirse her oturum açılışında tüm geçmiş kayıtlar okunur.
      // Rozet sayısı için 1000 kayıt fazlasıyla yeterlidir (gerçekçi üst sınır).
      // CANLI LİMİT 1000 -> 200 (rozet sayımı için yeterli)
      const qHatirlatma = query(collection(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar'), limit(200));
      const unsub = onSnapshot(qHatirlatma, (snap) => {
        const bugunTarih = new Date();
        const bugunStr = `${bugunTarih.getFullYear()}-${String(bugunTarih.getMonth() + 1).padStart(2, '0')}-${String(bugunTarih.getDate()).padStart(2, '0')}`;
        const sayi = snap.docs.filter(d => {
          const k = d.data();
          return !k.tamamlandi && k.tarih && k.tarih <= bugunStr;
        }).length;
        setHatirlatmaBildirim(sayi);

        // YENİ: Bu kullanıcıya atanmış, tamamlanmamış görevleri say.
        // AYNI snapshot kullanılır — ek Firestore okuması YOKTUR.
        if (currentUser?.id) {
          const benimGorevler = snap.docs.filter(d => {
            const k = d.data();
            // DEĞİŞTİ: tur === 'gorev' şartı kaldırıldı — kullanıcıya atanan
            // NOT'lar da görevler gibi rozette sayılır ve tamamlanana kadar
            // yanıp sönmeye devam eder (kullanıcı talebi: "görev ya da not").
            return !k.tamamlandi && String(k.atananPersonelId || '') === String(currentUser.id);
          }).length;
          setAtanmisGorevSayisi(benimGorevler);
        } else {
          setAtanmisGorevSayisi(0);
        }

        // Bildirimler: yalnızca ilk yüklemeden SONRAKİ değişikliklerde (sayfa
        // ilk açıldığında mevcut kayıtlar için bildirim üretilmez).
        // ====================================================================
        // YENİ (kullanıcı talebi): 1 EYLÜL 2026 KESME TARİHİ
        // --------------------------------------------------------------------
        // Sistemde birikmiş ESKİ hatırlatmalar (1 Eylül 2026'dan ÖNCE açılmış
        // kayıtlar) için artık bildirim/hatırlatma ÜRETİLMEZ — geçmişte kalan
        // yığın bildirim spam'i olarak gelmesin. Yalnızca bu tarihten SONRA
        // AÇILAN (oluşturulan) hatırlatma kayıtları bildirim üretmeye devam
        // eder. Ölçüt kaydın "createdAt" alanıdır (hatırlatmanın AÇILDIĞI an),
        // "tarih" (hatırlatmanın vadesi) değil — kullanıcı "ondan sonra açılan
        // kayıtlar bildirim olarak gelsin" dedi; açılış anı esas alınır.
        // ====================================================================
        const HATIRLATMA_BILDIRIM_BASLANGIC = '2026-09-01T00:00:00';
        if (!hatirlatmaIlkYuklemeRef.current) {
          snap.docChanges().forEach(chg => {
            const h = chg.doc.data();
            const acilisZamaniUygun = h.createdAt && h.createdAt >= HATIRLATMA_BILDIRIM_BASLANGIC;
            if ((chg.type === 'added' || chg.type === 'modified') && !h.tamamlandi && h.tarih && h.tarih <= bugunStr && acilisZamaniUygun) {
              bildirimGonder('🗓️ Hatırlatma', h.aciklama || 'Bugüne ait bir hatırlatmanız var.', { tag: `hatirlatma-${chg.doc.id}` });
            }
          });
        }
        hatirlatmaIlkYuklemeRef.current = false;
      }, () => {});
      return () => unsub();
      // NOT: currentUser?.id İLKEL bir değerdir (string) — dizi/nesne referansı
      // değil. Bu yüzden bağımlılığa eklenmesi, dinleyicinin gereksiz yere
      // yeniden kurulmasına ve Firestore okuma maliyetinin artmasına yol açmaz.
      // Atanmış görev sayacı doğru kullanıcıya göre hesaplansın diye gereklidir.
    }, [isAuthenticated, currentUser?.id]);

    const [loginError, setLoginError] = useState('');

    // ========================================================================
    // YENİ: TARAYICI BİLDİRİMİ — YETKİ KONTROLLERİ VE İZİN İSTEME
    // ----------------------------------------------------------------------
    // ÖNEMLİ (Hook Kuralları): Bu blok erken return'lerden ÖNCE durur; sadece
    // en başta tanımlı currentUser/positionModules kullanır.
    //
    // DÜZELTME (Firestore okuma patlaması denetimi — 13 Ağustos 2026):
    // Önceki sürümde burada 'jobs', 'tasks', 'vehicles' koleksiyonları için
    // AYRICA birer onSnapshot dinleyicisi açılıyordu — oysa bu üç koleksiyon
    // zaten aşağıdaki ana veri yükleme useEffect'i (bkz. "qJobs/qTasks/vehicles")
    // tarafından dinlenip jobs/tasks/vehicles state'lerine yazılıyordu. Yani
    // aynı koleksiyonlar İKİ KEZ dinleniyordu — 'jobs' özelinde ayrıca bir de
    // hasar sorgusu vardı, yani ÜÇ kez. 19 kullanıcı x her oturum açılışında
    // bu üç fazladan dinleyicinin İLK anlık görüntüsü TÜM koleksiyonu yeniden
    // okutuyordu. Bu, muhtemelen 38 milyon okumanın başlıca sebebiydi.
    // ÇÖZÜM: O üç ayrı dinleyici tamamen kaldırıldı. Bildirimler artık
    // aşağıda (jobs/tasks/vehicles state'leri tanımlandıktan hemen sonra)
    // MEVCUT state'lerin üzerinde fark (diff) alınarak üretiliyor — SIFIR
    // ek Firestore okuması ile.
    // ========================================================================
    const jobBildirimYetkisiVarMi = () => {
      if (currentUser?.employmentStatus === 'Pasif') return false;
      if (currentUser?.position === 'Firma Sahibi') return true;
      if (currentUser?.rank === 'Müdür') return true;
      if (currentUser?.position === 'Operasyon' || currentUser?.position === 'Satış Personeli') return true;
      return false;
    };
    const opYetkisiVarMi = () => {
      if (currentUser?.employmentStatus === 'Pasif') return false;
      if (currentUser?.fullName === 'Sistem Yöneticisi' || currentUser?.position === 'Firma Sahibi') return true;
      if (currentUser?.permissions?.modules && typeof currentUser.permissions.modules['operasyon'] === 'boolean') {
        return currentUser.permissions.modules['operasyon'];
      }
      const posAccess = positionModules?.[currentUser?.position];
      if (posAccess && typeof posAccess['operasyon'] === 'boolean') return posAccess['operasyon'];
      const rankAccess = positionModules?.[currentUser?.rank];
      if (rankAccess && typeof rankAccess['operasyon'] === 'boolean') return rankAccess['operasyon'];
      return false;
    };
    // ==========================================================================
    // YENİ (kullanıcı talebi): FİNANS BİLDİRİM YETKİSİ
    // opYetkisiVarMi() ile birebir aynı desen — yalnızca 'finance' modülü için.
    // Defter işlemi (para girişi/çıkışı/transfer) bildirimlerini kimin göreceğini
    // belirler; aşağıdaki defterIslemleri bildirim effect'i bunu kullanır.
    // ==========================================================================
    const finansBildirimYetkisiVarMi = () => {
      if (currentUser?.employmentStatus === 'Pasif') return false;
      if (currentUser?.fullName === 'Sistem Yöneticisi' || currentUser?.position === 'Firma Sahibi') return true;
      if (currentUser?.permissions?.modules && typeof currentUser.permissions.modules['finance'] === 'boolean') {
        return currentUser.permissions.modules['finance'];
      }
      const posAccess = positionModules?.[currentUser?.position];
      if (posAccess && typeof posAccess['finance'] === 'boolean') return posAccess['finance'];
      const rankAccess = positionModules?.[currentUser?.rank];
      if (rankAccess && typeof rankAccess['finance'] === 'boolean') return rankAccess['finance'];
      return false;
    };

    // Giriş yapıldıktan kısa süre sonra tarayıcıdan bildirim izni ister.
    useEffect(() => {
      if (!isAuthenticated || !bildirimDestekleniyorMu()) return;
      bildirimIzniIste();
    }, [isAuthenticated]);

    // ========================================================================
    // YENİ: SAYFA YENİLENSE BİLE AYNI BÖLÜMDE KALMA
    // Aktif sekme sessionStorage'da saklanır; yenilemeden sonra kullanıcı
    // kaldığı bölümden (sayfanın en üstünden) devam eder.
    // Not: Detay sayfaları (cari/personel/araç profili) geçici bir seçime bağlı
    // olduğundan, yenilemede kendi liste sayfalarına düşer.
    const GECICI_SEKME_KARSILIGI = { customerProfile: 'allCustomers', personnelProfile: 'personnelList', vehicleProfile: 'vehicleList' };
    const [activeTab, setActiveTab] = useState(() => {
      try {
        const kayitli = sessionStorage.getItem('sembolAktifSekme');
        if (!kayitli) return 'dashboard';
        return GECICI_SEKME_KARSILIGI[kayitli] || kayitli;
      } catch (e) { return 'dashboard'; }
    }); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const [isAddJobSubMenuOpen, setIsAddJobSubMenuOpen] = useState(false);
    const [isVehicleSubMenuOpen, setIsVehicleSubMenuOpen] = useState(false);
    const [isMaterialSubMenuOpen, setIsMaterialSubMenuOpen] = useState(false);
    const [isPersonnelSubMenuOpen, setIsPersonnelSubMenuOpen] = useState(false);
    const [isTaskSubMenuOpen, setIsTaskSubMenuOpen] = useState(false);
    const [isCustomerSubMenuOpen, setIsCustomerSubMenuOpen] = useState(false);
    const [isJobSubMenuOpen, setIsJobSubMenuOpen] = useState(false);
    const [isAuthSubMenuOpen, setIsAuthSubMenuOpen] = useState(false);
    const [isFinanceSubMenuOpen, setIsFinanceSubMenuOpen] = useState(false);
    const [isSystemFilesSubMenuOpen, setIsSystemFilesSubMenuOpen] = useState(false);
    const [isTodoSubMenuOpen, setIsTodoSubMenuOpen] = useState(false);
    // YENİ: "Mevcut Kullanıcılar" sayfası artık İzinler Yönetimi ve Modül Görüntüleme'yi
    // de sekme olarak barındırıyor; bu üçü artık ayrı sol menü öğeleri değil.
    const [kullaniciYonetimSekme, setKullaniciYonetimSekme] = useState('kullanicilar');
    
    const [isOperasyonSubMenuOpen, setIsOperasyonSubMenuOpen] = useState(false);
    // YENİ: Şirket Dosyaları (Dava Dosyaları vb.) alt menüsünün açık/kapalı durumu
    const [isSirketDosyalariSubMenuOpen, setIsSirketDosyalariSubMenuOpen] = useState(false);
    
    const [recordType, setRecordType] = useState('Nakliye');
    const [transactionType, setTransactionType] = useState('income');
    const [editingJobId, setEditingJobId] = useState(null); 
    const [cancelJobId, setCancelJobId] = useState(null); 
    const [deleteJobId, setDeleteJobId] = useState(null);
    const [markDamageJobId, setMarkDamageJobId] = useState(null);
    // DEĞİŞTİ: cost (Hasar Tutarı ₺) alanı eklendi — hasar kapatılırken maliyet girilir
    // DEĞİŞTİ: files (çözüm belgeleri) eklendi — fotoğraf/PDF/dekont, çoklu ve isteğe bağlı
    const [resolveDamageModal, setResolveDamageModal] = useState({ isOpen: false, jobId: null, note: '', cost: '', files: [] });
    // Kaç dosyanın yüklemesi sürüyor? (>0 iken Kaydet kilitlenir ki yarım dosya kaydedilmesin)
    const [resolveYukleniyor, setResolveYukleniyor] = useState(0);

    // ========================================================================
    // YENİ: HASAR ÇÖZÜM BELGESİ YÜKLEME (çoklu — fotoğraf, PDF, dekont vb.)
    // Mevcut handleFileUpload ile AYNI sunucuya (upload.php) yükler; tek fark
    // sonucun iş sonlandırma verisine değil, çözüm modalının files listesine
    // { url, name } olarak eklenmesidir. Dosyalar sırayla yüklenir; her biri
    // için listede "Yükleniyor..." yer tutucusu görünür.
    // ========================================================================
    const handleResolveFileUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      e.target.value = ''; // Aynı dosya tekrar seçilebilsin
      for (const file of files) {
        const yerTutucu = { url: 'Yükleniyor...', name: file.name };
        setResolveDamageModal(prev => ({ ...prev, files: [...prev.files, yerTutucu] }));
        setResolveYukleniyor(n => n + 1);
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
          const text = await res.text();
          let uploadedUrl = '';
          try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; }
          catch (err) { uploadedUrl = text.trim(); }
          setResolveDamageModal(prev => ({
            ...prev,
            files: prev.files.map(f => f === yerTutucu ? { url: uploadedUrl, name: file.name } : f)
          }));
        } catch (err) {
          console.error('Çözüm belgesi yüklenemedi:', err);
          // Başarısız yükleme listeden çıkarılır (kırık bağlantı kaydedilmez)
          setResolveDamageModal(prev => ({ ...prev, files: prev.files.filter(f => f !== yerTutucu) }));
          alert(`"${file.name}" yüklenemedi. Lütfen tekrar deneyin.`);
        } finally {
          setResolveYukleniyor(n => n - 1);
        }
      }
    };
    // YENİ: Hasarlı İşler "Düzenle" — hasar notu ve (varsa) çözüm notunu düzenleme modalı
    const [editDamageModal, setEditDamageModal] = useState({ isOpen: false, jobId: null, damageDetails: '', damageResolutionNote: '', damageResolved: false });

    const [showChangeDateModal, setShowChangeDateModal] = useState(false);
    const [jobToChangeDate, setJobToChangeDate] = useState(null);
    const [newJobDate, setNewJobDate] = useState('');

    const [showSecondFromAddress, setShowSecondFromAddress] = useState(false);
    const [showSecondToAddress, setShowSecondToAddress] = useState(false);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [jobToAssign, setJobToAssign] = useState(null);
    const [assigneeId, setAssigneeId] = useState('');
    const [additionalAssignees, setAdditionalAssignees] = useState([]);
    const [manualExtraAssignees, setManualExtraAssignees] = useState([]);
    const [assignedVehiclePlate, setAssignedVehiclePlate] = useState('');
    const [showBusyPersonnel, setShowBusyPersonnel] = useState(false);
    const [assignOperationNote, setAssignOperationNote] = useState('');
    
    const [assignedMaterials, setAssignedMaterials] = useState({ strec: 0, bant: 0, poset: 0, kagit: 0, koli: 0 });
    const [customMaterials, setCustomMaterials] = useState([]);
    const [newCustomMaterial, setNewCustomMaterial] = useState({ name: '', amount: 1 });
    
    const [assignedTargetVehiclePlate, setAssignedTargetVehiclePlate] = useState('');
    const [isTargetVehicleExternal, setIsTargetVehicleExternal] = useState(false);
    const [assignedJobTime, setAssignedJobTime] = useState('');

    const [teamSuggestion, setTeamSuggestion] = useState(null);

    const [showEndJobModal, setShowEndJobModal] = useState(false);
    const [jobToEnd, setJobToEnd] = useState(null);
    const [endJobError, setEndJobError] = useState('');
    // ==========================================================================
    // HATA DÜZELTMESİ (kullanıcı bildirimi — deftere aynı işten mükerrer/kopya
    // gelir kaydı düşmesi, örn. aynı "Teslim kodu" ile art arda ₺56.000 satırları):
    // ==========================================================================
    // KÖK NEDEN: "Kodu Doğrula ve İşi Bitir" butonu submitEndJob'u (async) ÇAĞIRIRKEN
    // hiçbir kilit/disabled durumu yoktu. Personel mobilde butona hızlıca birkaç kez
    // dokunursa (yavaş internet, çift tıklama vb.) submitEndJob AYNI ANDA birden fazla
    // kez çalışıyordu. shared.jsx > defterGelirKaydet() içindeki mükerrer koruması
    // "önce oku (var mı?) sonra yaz" mantığıyla çalışıyor; iki çağrı da aynı anda
    // okuma yaptığında ikisi de "kayıt yok" görüp İKİSİ DE yeni satır ekliyordu —
    // yani aynı iş için deftere kopya gelir kaydı düşüyordu.
    // ÇÖZÜM: Gönderim sırasında bu kilit true yapılır; submitEndJob başında ikinci
    // bir çağrı gelirse hemen durdurulur, buton da bu sırada devre dışı bırakılır.
    // ==========================================================================
    const [endJobKaydediliyor, setEndJobKaydediliyor] = useState(false);
    const [endJobData, setEndJobData] = useState({ 
      paymentMethod: 'Banka', // DEĞİŞTİ: varsayılan Banka — listede de ilk seçenek 
      damageStatus: 'Hasarsız teslim edildi', 
      damageDetails: '',
      damageImages: [],
      truckImages: [],
      deliveryImages: [], // YENİ: Teslim edilen yerin fotoğraf/videoları
      truckStatus: 'Herhangi bir sorun yok',
      truckIssueDetails: '',
      customerSatisfaction: 'Herhangi bir işlem yapmadı.',
      enteredCode: '',
      elevatorSetup: 'Evet',
      elevatorSetupReason: '',
      elevatorImages: [],
      elevatorIssue: 'Hayır',
      elevatorIssueReason: '',
      vehicleIssue: 'Hayır',
      vehicleIssueReason: ''
    });

    const [showApproveModal, setShowApproveModal] = useState(false);
    const [jobToApprove, setJobToApprove] = useState(null);
    const [approveData, setApproveData] = useState({ addPoints: 'Evet', reviewImage: '' });

    const [showMesaiModal, setShowMesaiModal] = useState(false);
    const [jobForMesai, setJobForMesai] = useState(null);
    const [mesaiModalData, setMesaiModalData] = useState({});

    const [aiModal, setAiModal] = useState({ isOpen: false, loading: false, content: '', title: '', type: '' });
    const [viewingImage, setViewingImage] = useState(null);

    const [dataLoadStatus, setDataLoadStatus] = useState({
      jobs: false, trans: false, tasks: false, notif: false, msg: false, logs: false, veh: false, mat: false, pers: false, settings: false, contacts: false, todos: false
    });
    
    // ========================================================================
    // İKİ KATMANLI İŞ (jobs) YÜKLEME — OKUMA MALİYETİ OPTİMİZASYONU
    // SORUN: 'jobs' sorgusu 8 YIL geriye giden kayıtları limit(8000) ile CANLI
    // dinliyordu. 19 kullanıcı sayfayı her yenilediğinde on binlerce okuma
    // oluşuyordu. Limit koymak yeterli değildi; PENCEREYİ daraltmak gerekti.
    //
    // ÇÖZÜM:
    //  1) CANLI KATMAN (canliIsler): yalnızca SON 30 GÜN, limit 200. Anlık akış,
    //     rozetler, bugünün işleri ve arama bu katmandan beslenir.
    //  2) ARŞİV KATMANI (arsivIsler): TÜM geçmiş, oturum açılınca arka planda
    //     bir kez yüklenir. Kalıcı yerel önbellek sayesinde sonraki açılışlarda
    //     ücretli okuma yapılmaz (ayrıntı: "TAM GEÇMİŞ YÜKLEYİCİ" bölümü).
    //  3) Aşağıdaki 'jobs' değişkeni iki katmanın BİRLEŞİMİdir; bu sayede
    //     mevcut tüm ekranlar, istatistikler ve arama kartları hiç
    //     değiştirilmeden aynı şekilde çalışmaya devam eder.
    // ========================================================================
    const [canliIsler, setCanliIsler] = useState([]);   // Son 30 gün (realtime)
    const [arsivIsler, setArsivIsler] = useState([]);   // Geçmiş (getDocs, isteğe bağlı)
    // Arşivin nereye kadar yüklendiği ve durum bilgisi
    // NOT: Eski parçalı arşiv durumu kaldırıldı (artık tüm geçmiş otomatik yükleniyor).

    // BİRLEŞİK LİSTE: aynı id iki katmanda varsa canlı olan (güncel) kazanır
    const jobs = useMemo(() => {
      if (arsivIsler.length === 0) return canliIsler;
      const harita = new Map();
      arsivIsler.forEach(j => harita.set(j.id, j));
      canliIsler.forEach(j => harita.set(j.id, j)); // Canlı veri arşivi ezer
      return [...harita.values()];
    }, [canliIsler, arsivIsler]);

    // ========================================================================
    // TAM GEÇMİŞ YÜKLEYİCİ (önbellek öncelikli)
    //
    // İSTEK: "Daha Fazla Yükle" düğmeleri olmasın; tüm işler, müşteriler ve
    // cariler her zaman görünsün.
    //
    // SORUN: Tüm geçmişi (~17.000 kayıt) HER sayfa açılışında sunucudan çekmek
    // 19 kullanıcı için aylık ~97 MİLYON okuma demekti — daha önce düzelttiğimiz
    // fatura sorunundan bile büyük.
    //
    // ÇÖZÜM: Firestore'un KALICI YEREL ÖNBELLEĞİ (IndexedDB, shared.tsx'te açıldı)
    //   1) Önce ÖNBELLEKTEN okunur -> ücretli okuma YOK, veri anında gelir.
    //   2) Önbellek boşsa (ilk giriş) sunucudan bir kez indirilip diske yazılır.
    //   3) Günde bir kez sunucudan sessizce tazelenir (başka kullanıcıların
    //      değişiklikleri yansısın diye). Son tazeleme localStorage'da tutulur.
    //   4) Son 30 günün canlı dinleyicisi zaten açık; güncel işler anında yansır.
    // ========================================================================
    const [gecmisDurum, setGecmisDurum] = useState({ yukleniyor: false, kaynak: null, adet: 0 });
    const gecmisYuklendiRef = useRef(false);

    const tumGecmisiYukle = useCallback(async () => {
      if (!firebaseUser || gecmisYuklendiRef.current) return;
      gecmisYuklendiRef.current = true;
      setGecmisDurum(prev => ({ ...prev, yukleniyor: true }));

      const TAZELEME_ANAHTARI = 'sembol_tumGecmis_sonTazeleme';
      const TAZELEME_ARALIGI = 24 * 60 * 60 * 1000; // 24 saat
      const isColRef = collection(db, 'artifacts', appId, 'public', 'data', 'jobs');
      const tumIslerSorgu = query(isColRef, orderBy('date', 'desc'));

      const yaz = (snap, kaynak) => {
        const gelen = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setArsivIsler(prev => {
          const harita = new Map(prev.map(j => [j.id, j]));
          gelen.forEach(j => harita.set(j.id, j));
          return [...harita.values()];
        });
        setGecmisDurum({ yukleniyor: false, kaynak, adet: gelen.length });
      };

      const sonTazeleme = Number(localStorage.getItem(TAZELEME_ANAHTARI) || 0);
      const tazelemeGerekli = (Date.now() - sonTazeleme) > TAZELEME_ARALIGI;

      // 1) ÖNBELLEK (ücretsiz, anında)
      try {
        const cacheSnap = await getDocsFromCache(tumIslerSorgu);
        if (!cacheSnap.empty) {
          yaz(cacheSnap, 'önbellek');
          if (tazelemeGerekli) {
            // HIZLANDIRMA (kullanıcı talebi): 24 saatlik TAM sunucu tazelemesi
            // eskiden önbellek yazımının HEMEN ardından başlıyordu ve açılışı
            // yine kilitliyordu. Artık 5 sn ERTELENİR — ekran önbellekten
            // anında dolar, binlerce kaydın ağ okuması arkadan sessizce gelir.
            setTimeout(async () => {
              try {
                const serverSnap = await getDocs(tumIslerSorgu);
                yaz(serverSnap, 'güncellendi');
                localStorage.setItem(TAZELEME_ANAHTARI, String(Date.now()));
              } catch (e) { console.warn('Geçmiş tazelenemedi:', e); }
            }, 5000);
          }
          return;
        }
      } catch (e) { /* Önbellek yok -> sunucuya düşülür */ }

      // 2) SUNUCU (yalnızca ilk kez veya önbellek temizlenmişse)
      try {
        const serverSnap = await getDocs(tumIslerSorgu);
        yaz(serverSnap, 'ilk yükleme');
        localStorage.setItem(TAZELEME_ANAHTARI, String(Date.now()));
      } catch (e) {
        console.error('Tüm geçmiş yüklenemedi:', e);
        setGecmisDurum({ yukleniyor: false, kaynak: 'hata', adet: 0 });
        gecmisYuklendiRef.current = false; // Tekrar denenebilsin
      }
    }, [firebaseUser]);

    // ========================================================================
    // HIZLANDIRMA (kullanıcı talebi — "açılış 2-3 dk sürüyor"):
    // ========================================================================
    // ESKİ DAVRANIŞ: Tam geçmiş (~17.000 kayıt), anonim oturum açılır açılmaz
    // — yani kullanıcı HENÜZ GİRİŞ EKRANINDAYKEN — indirilmeye başlıyordu.
    // Önbellek boşsa (ilk kurulum, gizli sekme, iOS'un IndexedDB'yi silmesi)
    // ya da 24 saatlik tazeleme zamanı geldiyse, binlerce kaydın ağdan çekilip
    // işlenmesi telefonda ana iş parçacığını kilitliyor; giriş ekranı ve
    // anasayfa dakikalarca geç geliyordu.
    // YENİ DAVRANIŞ:
    //   1) Arşiv, kullanıcı GERÇEKTEN OTURUM AÇTIKTAN sonra başlar — giriş
    //      ekranı ve anasayfanın ilk boyaması ağır işten tamamen kurtuldu.
    //   2) Başlatma 1,5 sn ertelenir (tarayıcı boşta kalınca): önce ekran
    //      çizilir, arşiv sessizce arkadan gelir. Son 30 günün canlı
    //      dinleyicisi zaten açık olduğu için güncel işler ANINDA görünür;
    //      yalnızca eski kayıtlar birkaç saniye gecikmeli dolar.
    //   3) İçerik ve veri akışı DEĞİŞMEDİ — yalnızca zamanlama değişti.
    useEffect(() => {
      if (!firebaseUser || !isAuthenticated) return;
      const idleBaslat = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
      const idleIptal = window.cancelIdleCallback || clearTimeout;
      const tanitici = idleBaslat(() => tumGecmisiYukle());
      return () => idleIptal(tanitici);
    }, [firebaseUser, isAuthenticated, tumGecmisiYukle]);

    // ========================================================================
    // DÖNEM YÜKLEYİCİ (takvim, cari/müşteri profili gibi ekranlar için)
    // Kullanıcı geçmiş bir AYA giderse o dönemin işleri getDocs ile BİR KEZ
    // okunur ve arşive eklenir. Aynı dönem ikinci kez istenirse tekrar okuma
    // YAPILMAZ (yuklenenDonemler kaydı tutulur) — okuma maliyeti düşük kalır.
    // ========================================================================
    const yuklenenDonemler = useRef(new Set());
    const [donemYukleniyor, setDonemYukleniyor] = useState(false);

    const donemIsleriYukle = useCallback(async (basTarih, bitTarih, ustLimit = 500) => {
      if (!firebaseUser || !basTarih || !bitTarih) return;
      const anahtar = `${basTarih}_${bitTarih}`;
      if (yuklenenDonemler.current.has(anahtar)) return; // Zaten okundu
      yuklenenDonemler.current.add(anahtar);
      setDonemYukleniyor(true);
      try {
        const snap = await getDocs(query(
          collection(db, 'artifacts', appId, 'public', 'data', 'jobs'),
          where('date', '>=', basTarih),
          where('date', '<=', bitTarih),
          orderBy('date', 'desc'),
          limit(ustLimit) // Bir dönem için güvenlik sınırı (ay: 500, yıl: 2000)
        ));
        const gelen = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        if (gelen.length > 0) {
          setArsivIsler(prev => {
            const harita = new Map(prev.map(j => [j.id, j]));
            gelen.forEach(j => harita.set(j.id, j));
            return [...harita.values()];
          });
        }
      } catch (e) {
        console.error('Dönem işleri yüklenemedi:', e);
        yuklenenDonemler.current.delete(anahtar); // Hata olduysa tekrar denenebilsin
      } finally {
        setDonemYukleniyor(false);
      }
    }, [firebaseUser]);

    // YENİ: Şeflerin saha denetimleri — merkezi olarak dinlenir ve iş listelerine prop
    // olarak geçilir; böylece her işte "kim denetledi" bilgisi gösterilebilir.
    const [sahaDenetimleri, setSahaDenetimleri] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [materials, setMaterials] = useState([]);
    const materialSeedRunning = React.useRef(false);
    const [personnelList, setPersonnelList] = useState([]);
    const [allPersonnelActions, setAllPersonnelActions] = useState([]);
    const [allMesaiRecords, setAllMesaiRecords] = useState([]);
    const [positions, setPositions] = useState([]);
    const [ranks, setRanks] = useState([]);
    const [positionModules, setPositionModules] = useState({});

    // ========================================================================
    // YENİ: İŞ / GÖREV / ARAÇ BİLDİRİMLERİ — MEVCUT STATE ÜZERİNDEN DIFF
    // ----------------------------------------------------------------------
    // Bu üç effect, jobs/tasks/vehicles için AYRI bir onSnapshot AÇMAZ.
    // Onun yerine, zaten ana veri yükleme effect'i tarafından doldurulan
    // jobs/tasks/vehicles state'lerinin bir önceki render'daki haliyle
    // şimdiki halini karşılaştırır (useRef önbelleği ile). Böylece:
    //   • Yeni iş kaydı / iptal / tarih değişikliği / hasar bildirimi
    //   • Yeni görev (Görev Tahtası)
    //   • Yeni araç (Araç Tahtası)
    // olayları için SIFIR EK FIRESTORE OKUMASI ile bildirim üretilir.
    //
    // Kimler görür (iş kayıtları): Operasyon, Satış Personeli, Müdür, Firma Sahibi.
    // Kimler görür (görev/araç): Operasyon yetkisi olanlar.
    // ========================================================================
    const jobOnbellekRef = useRef({});
    const jobIlkYuklemeRef = useRef(true);
    // ==========================================================================
    // HATA DÜZELTMESİ (kullanıcı bildirimi — "durmadan bildirim geliyor",
    // 2021 tarihli eski bir iş için "🆕 Yeni İş Kaydı" bildirimi gelmesi):
    // ==========================================================================
    // KÖK NEDEN: `jobs` = canliIsler (son 30 gün, anlık) + arsivIsler (TÜM
    // geçmiş, ~17.000 kayıt) birleşimidir. Bu bildirim effect'i SADECE İLK
    // ÇALIŞMASINDA (jobIlkYuklemeRef) önbelleği doldurup bildirim üretmeden
    // çıkıyordu — ama bu ilk çalışma, `arsivIsler` DAHA YÜKLENMEDEN, yalnızca
    // `canliIsler` (son 30 gün) doluyken gerçekleşiyordu (arşiv 1,5 sn sonra
    // arka planda, tembel/idle yüklemeyle geliyor). Arşiv birkaç saniye sonra
    // dolunca `jobs` state'i binlerce eski kayıtla birden büyüyor; bu effect
    // TEKRAR çalışıyor ama artık "ilk yükleme" değil (bayrak zaten düştü) —
    // önbellekte hiç olmayan (çünkü ilk doldurmada henüz yoktular) TÜM o eski
    // işler "yeni eklenen iş" sanılıp her biri için bildirim gönderiliyordu.
    // Aynı şey, eski bir aya/müşteri profiline gidilip donemIsleriYukle() ile
    // ek geçmiş yüklendiğinde de tekrar oluşabiliyordu.
    // ÇÖZÜM: Kalıcı ve en güvenli çözüm olarak, kaydın GERÇEKTEN AÇILDIĞI ana
    // (createdAt) göre bir KESME TARİHİ eklendi. 1 Eylül 2026'dan ÖNCE
    // açılmış hiçbir iş kaydı için (arşiv ne zaman/nasıl yüklenirse yüklensin)
    // artık bildirim ÜRETİLMEZ. createdAt alanı yoksa (çok eski kayıt) da
    // güvenli tarafta kalınıp bildirim üretilmez.
    // ==========================================================================
    const IS_BILDIRIM_BASLANGIC = '2026-09-01T00:00:00';
    const isKaydiBildirimUygun = (j) => !!j.createdAt && j.createdAt >= IS_BILDIRIM_BASLANGIC;
    useEffect(() => {
      if (jobs.length === 0) return; // Henüz veri gelmedi
      const yetkiliMi = jobBildirimYetkisiVarMi();
      const tarihGunAdi = (tarihStr) => {
        if (!tarihStr) return 'Tarih belirtilmemiş';
        try { return new Date(tarihStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }); }
        catch (e) { return tarihStr; }
      };
      const fiyatGoster = (p) => { const n = parseFloat(p); return isNaN(n) || n === 0 ? 'Belirtilmemiş' : `₺${n.toLocaleString('tr-TR')}`; };

      if (jobIlkYuklemeRef.current) {
        // İlk dolduruşta bildirim ÜRETME — sadece önbelleği doldur (kıyas tabanı)
        jobs.forEach(j => { jobOnbellekRef.current[j.id] = { status: j.status, date: j.date, hasar: j.endJobDetails?.damageStatus }; });
        jobIlkYuklemeRef.current = false;
        return;
      }

      jobs.forEach(j => {
        const onceki = jobOnbellekRef.current[j.id];
        const bildirimUygun = isKaydiBildirimUygun(j);
        if (!onceki) {
          // Yeni eklenen iş (önbellekte hiç yoktu) — VEYA arşiv/dönem yükleyicisi
          // ile SONRADAN merkeze giren ESKİ bir kayıt olabilir; kesme tarihi
          // ikisini ayırt eder.
          if (yetkiliMi && bildirimUygun) {
            const otomatikAsansorMu = j.contractDetails === 'Otomatik Oluşturulan Asansör Kurulum Kaydı';
            const cokGunluDevamKaydiMi = (j.price === '0' || j.price === 0) && j.type !== 'Asansör';
            if (!otomatikAsansorMu && !cokGunluDevamKaydiMi) {
              bildirimGonder('🆕 Yeni İş Kaydı',
                `${tarihGunAdi(j.date)}\n${j.type} Kaydı • ${j.customerName || 'İsimsiz müşteri'}\nAçan: ${j.createdBy || 'Bilinmiyor'} • Fiyat: ${fiyatGoster(j.price)}`,
                { tag: `is-yeni-${j.id}` });
            }
          }
        } else {
          if (yetkiliMi && bildirimUygun) {
            if (j.status === 'cancelled' && onceki.status !== 'cancelled') {
              bildirimGonder('❌ İş İptal Edildi',
                `${tarihGunAdi(j.date)}\n${j.type} Kaydı • ${j.customerName || 'İsimsiz müşteri'}\nİptal eden: ${j.cancelledBy || 'Bilinmiyor'}`,
                { tag: `is-iptal-${j.id}` });
            } else if (j.date !== onceki.date && j.status !== 'cancelled') {
              bildirimGonder('📅 İş Tarihi Değiştirildi',
                `${j.customerName || 'İsimsiz müşteri'} (${j.type})\nYeni tarih: ${tarihGunAdi(j.date)}\nDeğiştiren: ${j.updatedBy || 'Bilinmiyor'}`,
                { tag: `is-tarih-${j.id}` });
            }
          }
          if (opYetkisiVarMi() && bildirimUygun && j.endJobDetails?.damageStatus === 'Hasar var' && onceki.hasar !== 'Hasar var') {
            bildirimGonder('⚠️ Hasarlı İş Bildirimi', `${j.customerName || 'Bir müşteri'} işinde hasar bildirimi yapıldı.`, { tag: `hasar-${j.id}` });
          }
        }
        jobOnbellekRef.current[j.id] = { status: j.status, date: j.date, hasar: j.endJobDetails?.damageStatus };
      });
    }, [jobs]);

    const taskOnbellekRef = useRef(new Set());
    const taskIlkYuklemeRef = useRef(true);
    useEffect(() => {
      if (tasks.length === 0) return;
      if (taskIlkYuklemeRef.current) {
        tasks.forEach(t => taskOnbellekRef.current.add(t.id));
        taskIlkYuklemeRef.current = false;
        return;
      }
      if (opYetkisiVarMi()) {
        tasks.forEach(t => {
          if (!taskOnbellekRef.current.has(t.id)) {
            bildirimGonder('📋 Yeni Görev', t.title || t.description || 'Görev Tahtası\'na yeni bir görev eklendi.', { tag: `gorev-${t.id}` });
          }
        });
      }
      tasks.forEach(t => taskOnbellekRef.current.add(t.id));
    }, [tasks]);

    const vehicleOnbellekRef = useRef(new Set());
    const vehicleIlkYuklemeRef = useRef(true);
    useEffect(() => {
      if (vehicles.length === 0) return;
      if (vehicleIlkYuklemeRef.current) {
        vehicles.forEach(v => vehicleOnbellekRef.current.add(v.id));
        vehicleIlkYuklemeRef.current = false;
        return;
      }
      if (opYetkisiVarMi()) {
        vehicles.forEach(v => {
          if (!vehicleOnbellekRef.current.has(v.id)) {
            bildirimGonder('🚚 Yeni Araç', `${v.plate || 'Yeni araç'} Araç Tahtası'na eklendi.`, { tag: `arac-${v.id}` });
          }
        });
      }
      vehicles.forEach(v => vehicleOnbellekRef.current.add(v.id));
    }, [vehicles]);

    // ==========================================================================
    // YENİ (kullanıcı talebi): FİNANS > DEFTER İŞLEMİ BİLDİRİMİ
    // --------------------------------------------------------------------------
    // Bir deftere PARA GİRİŞİ / PARA ÇIKIŞI / TRANSFER (Virman) kaydedildiğinde
    // Finans bildirim yetkisi olan kullanıcılara tarayıcı bildirimi gider.
    // jobs/tasks/vehicles ile AYNI "diff tabanlı" desen: ilk yüklemede bildirim
    // ÜRETİLMEZ (mevcut geçmiş kayıtlar spam üretmesin), yalnızca SONRADAN
    // eklenen yeni kayıtlar bildirim üretir.
    //
    // OKUMA MALİYETİ: defterIslemleri zamanla büyüyen bir koleksiyondur ve
    // jobs/tasks/vehicles'ın aksine App.jsx'te zaten yüklü bir state'e binemez
    // (Finans verisi burada tutulmuyor) — bu yüzden TEK yeni, KAPSAMI DARALTILMIŞ
    // bir dinleyicidir: yalnızca en YENİ 100 kayıt (orderBy + limit) dinlenir.
    //
    // ÇİFT BİLDİRİM ENGELİ: Bazı işlemler (Virman, Tahsilat, Taksit/Maaş/Avans
    // Ödemesi) iki bacaklı yazılır (kaynak + hedef/mahsup). Aynı olay için İKİ
    // ayrı bildirim gitmesin diye ikinci bacak (isVirman+giris, alacakMahsup,
    // krediMahsup, odemeMahsup) ve devir/açılış kaydı (devirKaydi) bastırılır.
    // ==========================================================================
    const islemOnbellekRef = useRef(new Set());
    const islemIlkYuklemeRef = useRef(true);
    useEffect(() => {
      if (!isAuthenticated) return;
      const qIslem = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const unsub = onSnapshot(qIslem, snap => {
        if (islemIlkYuklemeRef.current) {
          // İlk dolduruşta bildirim ÜRETME — sadece önbelleği doldur (kıyas tabanı)
          snap.docs.forEach(d => islemOnbellekRef.current.add(d.id));
          islemIlkYuklemeRef.current = false;
          return;
        }
        const yetkiliMi = finansBildirimYetkisiVarMi();
        snap.docChanges().forEach(chg => {
          if (chg.type !== 'added') return; // Yalnızca YENİ eklenen kayıtlar
          if (islemOnbellekRef.current.has(chg.doc.id)) return;
          islemOnbellekRef.current.add(chg.doc.id);
          if (!yetkiliMi) return;
          const d = chg.doc.data();
          if (d.silindi) return; // Yumuşak silinmiş kayıt bildirim üretmez
          if (d.isVirman && d.tip === 'giris') return;               // Transfer: tek bildirim (çıkış bacağından)
          if (d.alacakMahsup || d.krediMahsup || d.odemeMahsup) return; // Mahsup bacağı
          if (d.devirKaydi) return;                                   // Açılış/devir kaydı bir "işlem" değil
          const tutarStr = `₺${(parseFloat(d.tutar) || 0).toLocaleString('tr-TR')}`;
          const yapan = d.by || 'Bilinmiyor';
          if (d.isVirman) {
            bildirimGonder('🔁 Hesaplar Arası Transfer', `${d.aciklama || ''} • ${tutarStr}\nİşlemi yapan: ${yapan}`, { tag: `defter-virman-${d.virmanId || chg.doc.id}` });
          } else if (d.tip === 'giris') {
            bildirimGonder('💰 Para Girişi (Defter)', `${d.aciklama || d.kategori || 'Gelir kaydı'} • ${tutarStr}\nİşlemi yapan: ${yapan}`, { tag: `defter-giris-${chg.doc.id}` });
          } else if (d.tip === 'cikis') {
            bildirimGonder('💸 Para Çıkışı (Defter)', `${d.aciklama || d.kategori || 'Gider kaydı'} • ${tutarStr}\nİşlemi yapan: ${yapan}`, { tag: `defter-cikis-${chg.doc.id}` });
          }
        });
      }, () => {});
      return () => unsub();
    }, [isAuthenticated]);

    // YENİ: Sayfa kataloğu (Ana Şema) — kişiye özel yetki ekranında listelenen sayfalar
    const [moduleCatalog, setModuleCatalog] = useState(VARSAYILAN_MODUL_KATALOGU);
    // YENİ: Logo önbelleği — Firebase'den marka ayarları gelene kadar (özellikle
    // açılış/yükleme ekranında) kullanıcının yüklediği logo görünmüyordu, çünkü
    // appBranding henüz boştu ve varsayılan logoya düşülüyordu. Artık logo
    // localStorage'da saklanıyor ve uygulama ilk karede doğru logoyla açılıyor.
    const [appBranding, setAppBranding] = useState(() => {
      try {
        const kayitli = localStorage.getItem('sembol_crm_branding');
        if (kayitli) {
          const p = JSON.parse(kayitli);
          return { logoUrl: p.logoUrl || '', logoSize: p.logoSize || 100 };
        }
      } catch (e) {}
      return { logoUrl: '', logoSize: 100 };
    });
    const [complaints, setComplaints] = useState([]);
    const [companyContacts, setCompanyContacts] = useState([]);
    const [todos, setTodos] = useState([]);
    const [companyPasswords, setCompanyPasswords] = useState([]);
    
    const [newTransaction, setNewTransaction] = useState({ amount: '', category: 'Nakliye Tahsilatı', account: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [draggingTask, setDraggingTask] = useState(null);
    const [newTask, setNewTask] = useState({ title: '', description: '', assignee: 'Tüm Personeller', date: new Date().toISOString().split('T')[0] });
    const [newTodo, setNewTodo] = useState({ title: '', details: '', reminderDate: new Date().toISOString().split('T')[0], priority: 'Normal', status: 'todo' });
    // YENİ: "Yeni Ekle" artık sol menüde ayrı bir sayfa değil; Takip ve Yapılacak
    // İşler sayfasının sağ üstünde bir buton/modal olarak açılıyor.
    const [showAddTodoModal, setShowAddTodoModal] = useState(false);

    const [showContactModal, setShowContactModal] = useState(false);
    // YENİ: Şirket İletişimi yönetim penceresi (sıralama / düzenleme / silme tek yerde)
    const [showContactsManageModal, setShowContactsManageModal] = useState(false);
    // YENİ: Eski sistemden içe aktarma penceresi
    const [showImportModal, setShowImportModal] = useState(false);
    const [contactDeleteId, setContactDeleteId] = useState(null);
    const [contactForm, setContactForm] = useState({ name: '', phone: '', position: '' });
    const [isContactsOpen, setIsContactsOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [viewingCariKey, setViewingCariKey] = useState(null);
    const [viewingPersonnelProfileId, setViewingPersonnelProfileId] = useState(null);
    const [pendingEditPersonnelId, setPendingEditPersonnelId] = useState(null);
    const [viewingVehicleProfileId, setViewingVehicleProfileId] = useState(null);
    const [vehicleEditForm, setVehicleEditForm] = useState({});
    const [aracBelgeYukleniyor, setAracBelgeYukleniyor] = useState(false); // Araç belgeleri toplu yükleme
    const [viewingRuhsatUrl, setViewingRuhsatUrl] = useState(null);

    const [isDataMigrated, setIsDataMigrated] = useState(() => localStorage.getItem('sembol_data_migrated') === 'true');

    const [formData, setFormData] = useState({
      isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo',
      fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '',
      extraLoadingAddresses: [], selectedDepo: '', 
      toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '',
      extraUnloadingAddresses: [], wallMounting: [], esyaDurumu: [],
      date: new Date().toISOString().split('T')[0], time: '09:00', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
    });

    const isAddingCengizRef = React.useRef(false);

    useEffect(() => {
      const initAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (e) { console.error("Auth hatası:", e); }
      };
      initAuth();
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setFirebaseUser(user);
        if(!user) setIsAuthChecking(false);
      });
      return () => unsubscribe();
    }, []);

    const [existingCustomerMatch, setExistingCustomerMatch] = useState(null);
    const [showCustomerSearchBox, setShowCustomerSearchBox] = useState(false);
    // YENİ: Kayıt sonrası açılan başarı paneli (WhatsApp bilgilendirme + Sözleşme indirme seçenekleriyle)
    const [savedJobInfo, setSavedJobInfo] = useState(null);
    // YENİ: Başarı panelinde hangi adımların tamamlandığını takip eder (tik işaretleri için)
    const [savedNotified, setSavedNotified] = useState(false);   // WhatsApp bilgilendirme tıklandı mı
    const [savedContractDl, setSavedContractDl] = useState(false); // Sözleşme indir tıklandı mı
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');

    useEffect(() => {
      if (activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') {
        if (formData.customerPhone && formData.customerPhone.length > 5) {
          const matchedJob = jobs.find(j => 
            j.customerPhone.replace(/\s+/g, '') === formData.customerPhone.replace(/\s+/g, '')
          );
          
          if (matchedJob && matchedJob.customerName !== formData.customerName) {
            setExistingCustomerMatch({
              type: 'phone',
              name: matchedJob.customerName,
              phone: matchedJob.customerPhone
            });
            return;
          }
        }
        
        if (formData.customerName && formData.customerName.length > 3) {
           const matchedJob = jobs.find(j => 
              j.customerName.toLowerCase() === formData.customerName.toLowerCase()
           );

           if (matchedJob && matchedJob.customerPhone !== formData.customerPhone && !formData.customerPhone) {
              setExistingCustomerMatch({
                type: 'name',
                name: matchedJob.customerName,
                phone: matchedJob.customerPhone
              });
              return;
           }
        }
        
        setExistingCustomerMatch(null);
      }
    }, [formData.customerName, formData.customerPhone, activeTab, jobs]);

    useEffect(() => {
      if (!firebaseUser) return;
      const getCol = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);
      const unsubs = [];

      // CANLI PENCERE: yalnızca SON 30 GÜN canlı dinlenir. Daha eski kayıtlar
      // arşiv katmanından (önbellek öncelikli tam geçmiş) gelir.
      const canliBaslangic = new Date();
      canliBaslangic.setDate(canliBaslangic.getDate() - 30);
      const startDateStr = canliBaslangic.toISOString().split('T')[0];

      // ========================================================================
      // DÜZELTME (Firestore okuma patlaması denetimi — 13 Ağustos 2026):
      // Bu sorgu 8 YIL geriye giden TÜM iş kayıtlarını, HİÇBİR limit OLMADAN,
      // canlı (realtime) dinliyordu. Aktif bir nakliye firması için 8 yıllık
      // kayıt kolayca on binlerce doküman demektir; bu sayı, HER kullanıcının
      // HER oturum açılışında/sayfa yenilemesinde YENİDEN baştan okunuyordu.
      // 19 kullanıcı x günde birkaç kez x on binlerce doküman = milyonlarca
      // okuma. Bu, muhtemelen 38 milyon okumanın EN BÜYÜK tek kaynağıydı.
      // ÇÖZÜM: 8 yıllık tarih filtresi AYNEN korunuyor (mevcut raporlama
      // ekranlarının ihtiyacı olabilir diye iş mantığına dokunulmadı), ama
      // üstüne bir GÜVENLİK LİMİTİ eklendi. Bu limit normal kullanımda hiçbir
      // şeyi etkilemez (günlük birkaç iş kaydı olan bir firma için 8000
      // kayıt çok geniş bir pay), ama veri beklenmedik şekilde şişerse
      // maliyetin sınırsız büyümesini engeller.
      // NOT: Eğer firmanızda gerçekten 8000'den fazla iş kaydı bu tarih
      // aralığında varsa (çok yüksek hacim), bu limiti artırmak yerine,
      // eski/tamamlanmış yılların raporlamasını CANLI DİNLEME yerine
      // "bir kereye mahsus getDocs ile sayfalama" şekline taşımanızı öneririz.
      // ========================================================================
      // NOT: orderBy('date','desc') eklendi ki 8000 sınırı aşılırsa (olası
      // değil ama garanti altına alalım) rastgele değil, EN GÜNCEL kayıtlar
      // tutulsun. where + orderBy AYNI alan (date) üzerinde olduğu için
      // Firestore'da ek bir composite index gerektirmez.
      // Son 30 günün işleri, en güncel üstte, en fazla 200 doküman.
      const qJobs = query(getCol('jobs'), where('date', '>=', startDateStr), orderBy('date', 'desc'), limit(200));
      const qTrans = query(getCol('transactions'), limit(300));
      const qTasks = query(getCol('tasks'), limit(100));

      unsubs.push(onSnapshot(qJobs, snap => { setCanliIsler(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, jobs: true})); }, console.error));
      unsubs.push(onSnapshot(qTrans, snap => { setTransactions(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, trans: true})); }, console.error));
      unsubs.push(onSnapshot(qTasks, snap => { setTasks(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, tasks: true})); }, console.error));
            
      const qNotifs = query(getCol('notifications'), limit(100));
      const qMsgs = query(getCol('messages'), limit(50));
      const qLogs = query(getCol('systemLogs'), limit(100));
      const qComplaints = query(getCol('complaints'), limit(50));

      unsubs.push(onSnapshot(qNotifs, snap => { setNotifications(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, notif: true})); }, console.error));
      unsubs.push(onSnapshot(qMsgs, snap => { setMessages(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, msg: true})); }, console.error));
      unsubs.push(onSnapshot(qLogs, snap => { setSystemLogs(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, logs: true})); }, console.error));
      unsubs.push(onSnapshot(qComplaints, snap => { setComplaints(snap.docs.map(d => ({...d.data(), id: d.id}))); }, console.error));
      
      unsubs.push(onSnapshot(getCol('vehicles'), snap => { setVehicles(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, veh: true})); }, console.error));
      
      unsubs.push(onSnapshot(getCol('materials'), async snap => { 
        const list = snap.docs.map(d => ({...d.data(), id: d.id}));
        setMaterials(list); 
        setDataLoadStatus(p => ({...p, mat: true})); 

        if (firebaseUser && !snap.metadata.hasPendingWrites && !materialSeedRunning.current) {
            materialSeedRunning.current = true;
            try {
              const defaultMats = [
                  { name: 'Streç', category: 'Ambalaj Malzemesi', unit: 'Rulo', checkKey: 'streç' },
                  { name: 'Bant', category: 'Ambalaj Malzemesi', unit: 'Adet', checkKey: 'bant' },
                  { name: 'Poşet', category: 'Ambalaj Malzemesi', unit: 'Adet', checkKey: 'poşet' },
                  { name: 'Kağıt', category: 'Ambalaj Malzemesi', unit: 'Kg', checkKey: 'kağıt' },
                  { name: 'Koli', category: 'Ambalaj Malzemesi', unit: 'Adet', checkKey: 'koli' }
              ];

              const norm = (s) => (s || '').toLocaleLowerCase('tr-TR');

              for (const mat of defaultMats) {
                  const matches = list.filter(m => norm(m.name).includes(mat.checkKey));

                  if (matches.length === 0) {
                      await addDoc(getCol('materials'), { name: mat.name, category: mat.category, unit: mat.unit, stock: '0' });
                  } else if (matches.length > 1) {
                      const totalStock = matches.reduce((sum, m) => sum + (parseFloat(m.stock) || 0), 0);
                      const keep = matches[0];
                      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', keep.id), {
                          name: mat.name, category: mat.category, unit: mat.unit, stock: String(totalStock)
                      });
                      for (let i = 1; i < matches.length; i++) {
                          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', matches[i].id));
                      }
                  }
              }
            } catch (err) {
              console.error('Malzeme senkronizasyon/temizleme hatası:', err);
            } finally {
              materialSeedRunning.current = false;
            }
        }
      }, console.error));

      unsubs.push(onSnapshot(getCol('companyContacts'), snap => { 
        let contacts = snap.docs.map(d => ({...d.data(), id: d.id}));
        contacts.sort((a, b) => (a.order || 0) - (b.order || 0));
        setCompanyContacts(contacts); 
        setDataLoadStatus(p => ({...p, contacts: true})); 
      }, console.error));
      unsubs.push(onSnapshot(getCol('todos'), snap => { setTodos(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, todos: true})); }, console.error));
      unsubs.push(onSnapshot(getCol('companyPasswords'), snap => { setCompanyPasswords(snap.docs.map(d => ({...d.data(), id: d.id}))); }, console.error));

      unsubs.push(onSnapshot(getCol('personnelList'), async snap => {
        const list = snap.docs.map(d => ({...d.data(), id: d.id})); 
        setPersonnelList(list);

        // YENİ: Varsayılan "admin / admin" (Sistem Yöneticisi) hesabı artık hiç oluşturulmaz.
        // Sistemde hâlâ eski "admin/admin" hesabı varsa (email==='admin' && password==='admin'),
        // güvenlik amacıyla otomatik olarak kalıcı şekilde silinir.
        const legacyAdminDocs = snap.docs.filter(d => {
          const data = d.data();
          return data.email === 'admin' && data.password === 'admin';
        });
        for (const legacyDoc of legacyAdminDocs) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', legacyDoc.id));
        }

        setDataLoadStatus(p => ({...p, pers: true}));
        setIsAuthChecking(false);
      }, console.error));

      // DÜZELTME: personnelActions (personel hareket/aksiyon kayıtları) zamanla
      // sürekli büyüyen bir günlük (log) koleksiyonudur; limitsiz dinlemek
      // ileride tehlikeli büyüyebilir. En güncel 3000 kayıt yeterlidir;
      // orderBy ile taşma durumunda ESKİ değil YENİ kayıtlar tutulur.
      // CANLI LİMİT 3000 -> 200: anlık akış için son kayıtlar yeterli.
      // Personel profilindeki kişiye ait geçmiş, o sayfanın kendi sorgusuyla gelir.
      unsubs.push(onSnapshot(query(getCol('personnelActions'), orderBy('createdAt', 'desc'), limit(200)), snap => {
        setAllPersonnelActions(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }, console.error));

      // OKUMA SINIRI: her belge bir AY'ı temsil eder; 36 belge = 3 yıl geçmiş.
      // Sınırsız bırakılırsa yıllar geçtikçe her açılışta hepsi okunur.
      // CANLI LİMİT 36 -> 12: her belge bir AY'dır ve içinde tüm personelin
      // günlük kayıtları vardır (büyük belgeler). Daha eski aylar puantaj/maaş
      // ekranlarında ay seçilerek zaten ayrıca okunuyor.
      unsubs.push(onSnapshot(query(getCol('mesai'), limit(12)), snap => {
        const flat = [];
        snap.docs.forEach(d => {
          const m = d.id.match(/(\d{4})_(\d{1,2})/);
          if (!m) return;
          const records = d.data().records || {};
          Object.keys(records).forEach(personId => {
            const dayMap = records[personId] || {};
            Object.keys(dayMap).forEach(dayNum => {
              const dayData = dayMap[dayNum];
              const code = typeof dayData === 'object' && dayData !== null ? dayData.status : dayData;
              // YENİ: FGM/FM/EM saat bilgisini de taşı (Finans mesai ücreti hesabıyla birebir eşleşmesi için)
              // HATA DÜZELTMESİ: saat virgüllü ondalık olarak saklanıyor (örn. "4,5").
              // parseFloat virgülü ondalık ayıracı saymadığı için parseFloat("4,5") -> 4
              // gibi HATALI kesiliyordu (Personel Profili > Performans Özeti'ndeki
              // "Fazla Mesai" saatinin ve Finans tarafındaki toplamların eksik
              // görünmesine sebep oluyordu). Virgül noktaya çevrilip öyle parse edilir.
              const hours = (typeof dayData === 'object' && dayData !== null) ? (parseFloat(String(dayData.hours ?? '').replace(',', '.')) || 0) : 0;
              flat.push({ personId, year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(dayNum), code, hours });
            });
          });
        });
        setAllMesaiRecords(flat);
      }, console.error));

      // DÜZELTME: sahaDenetimleri de zamanla büyüyen bir koleksiyon; güvenlik
      // limiti eklendi (en güncel 2000 denetim yeterli, iş listelerinde
      // "kim denetledi" rozeti için kullanılıyor).
      // CANLI LİMİT 2000 -> 200: kişi bazlı geçmiş profil sayfasında getDocs ile okunur.
      unsubs.push(onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri'), orderBy('denetimTarihi', 'desc'), limit(200)), snap => {
        setSahaDenetimleri(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, console.error));

      unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), async docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPositions(data.positions || []);
          setRanks(data.ranks || []);
          setPositionModules(data.positionModules || {});
          // YENİ: Sayfa kataloğu (Ana Şema) — Firebase'de kayıtlıysa onu, yoksa varsayılan listeyi kullan
          // ============================================================
          // KATALOG BİRLEŞTİRME:
          // Firebase'deki kayıtlı katalog varsayılan listeyi ezdiği için,
          // yazılıma sonradan eklenen sayfalar (ör. Hatırlatmalar) katalogda
          // görünmüyordu. Aşağıdaki blok, kayıtlı katalogda EKSİK olan
          // varsayılan sayfaları listenin sonuna ekler. Yöneticinin elle
          // eklediği/kaldırdığı diğer sayfalara dokunulmaz.
          // ============================================================
          if (Array.isArray(data.moduleCatalog) && data.moduleCatalog.length > 0) {
            const mevcutIdler = new Set(data.moduleCatalog.map(m => m?.id));
            const eksikler = VARSAYILAN_MODUL_KATALOGU.filter(m => !mevcutIdler.has(m.id));
            setModuleCatalog(eksikler.length > 0 ? [...data.moduleCatalog, ...eksikler] : data.moduleCatalog);
          } else {
            setModuleCatalog(VARSAYILAN_MODUL_KATALOGU);
          }
        } else {
          const defaultPos = ['Şoför', 'Taşıma Elemanı', 'Muhasebe', 'Mobilya Ustası', 'Satış Personeli', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operasyon', 'Operatör', 'Firma Sahibi'];
          const defaultRanks = ['Müdür', 'Ekip Şefi', 'Asistan', 'Standart', 'Heryerden Usta', 'Kalfa'];
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { positions: defaultPos, ranks: defaultRanks, positionModules: {} });
          setPositions(defaultPos);
          setRanks(defaultRanks);
          setPositionModules({});
        }
        setDataLoadStatus(p => ({...p, settings: true}));
      }, console.error));

      unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'appBranding'), docSnap => {
        const yeni = docSnap.exists()
          ? { logoUrl: docSnap.data().logoUrl || '', logoSize: docSnap.data().logoSize || 100 }
          : { logoUrl: '', logoSize: 100 };
        setAppBranding(yeni);
        // YENİ: Sonraki açılışta logo ilk karede görünsün diye önbelleğe yaz
        try { localStorage.setItem('sembol_crm_branding', JSON.stringify(yeni)); } catch (e) {}
      }, console.error));

      return () => unsubs.forEach(unsub => unsub());
    }, [firebaseUser]);

    useEffect(() => {
      if (personnelList.length > 0 && !isAuthenticated) {
        try {
          const savedUser = localStorage.getItem('sembol_crm_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            const parsedInput = (parsed.email || '').trim().toLocaleLowerCase('tr-TR');
            const user = personnelList.find(p => {
              const pEmail = (p.email || '').trim().toLocaleLowerCase('tr-TR');
              const pName = (p.fullName || '').trim().toLocaleLowerCase('tr-TR');
              return (pEmail === parsedInput || pName === parsedInput) && p.password === parsed.password;
            });
            if (user && user.employmentStatus !== 'Pasif') {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }
          }
        } catch (e) {}
        // YENİ: Oturum geri yükleme denemesi bitti (başarılı ya da değil)
        setOturumDenendi(true);
      }
    }, [personnelList, isAuthenticated]); 

    useEffect(() => {
      if (isAuthenticated && currentUser && personnelList.length > 0) {
        const updatedUser = personnelList.find(p => p.id === currentUser.id);
        if (updatedUser) {
          if (updatedUser.employmentStatus === 'Pasif') {
             setCurrentUser(updatedUser);
          } else if (JSON.stringify(updatedUser.permissions) !== JSON.stringify(currentUser.permissions) || updatedUser.employmentStatus !== currentUser.employmentStatus) {
             setCurrentUser(updatedUser);
          }
        } else {
          handleLogout();
        }
      }
    }, [personnelList]);

    const handleAddContact = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      if (editingContact) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', editingContact.id), contactForm);
        addSystemLog('İletişim Hattı', `Şirket iletişim hattındaki kişi güncellendi: ${contactForm.name}`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companyContacts'), { ...contactForm, order: companyContacts.length });
        addSystemLog('İletişim Hattı', `Şirket iletişim hattına yeni kişi eklendi: ${contactForm.name}`);
      }
      setContactForm({ name: '', phone: '', position: '' });
      setShowContactModal(false);
      setEditingContact(null);
    };

    const handleDeleteContact = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', id));
    };

    const handleReorderContact = async (index, direction) => {
      if (!firebaseUser) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= companyContacts.length) return;
      
      const current = companyContacts[index];
      const target = companyContacts[newIndex];
      
      const currentOrder = current.order !== undefined ? current.order : index;
      const targetOrder = target.order !== undefined ? target.order : newIndex;
      
      await Promise.all([
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', current.id), { order: targetOrder }),
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', target.id), { order: currentOrder })
      ]);
    };

    const addSystemLog = async (action, details) => {
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'systemLogs'), {
        action, details,
        user: currentUser ? currentUser.fullName : 'Sistem',
        // YENİ: Sıralamanın metin ayrıştırmasına bağlı kalmaması için makine okunur zaman damgası
        createdAt: new Date().toISOString(),
        timestamp: new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      });
    };

    // YENİ: SEKME SİMGESİ (FAVICON)
    // Uygulama açılırken mevcut favicon bağlantıları kaldırılıp yerine
    // Sembol Nakliyat logosu takılır. (Kalıcı çözüm için index.html'deki
    // <link rel="icon"> satırını da aynı adresle güncellemek gerekir.)
    useEffect(() => {
      const FAVICON_URL = 'https://www.sembolevdeneve.com/wp-content/uploads/2026/07/favicon.webp';
      try {
        // Var olan tüm ikon bağlantılarını temizle (eski favicon kalmasın)
        document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach(el => el.remove());
        // Yeni ikonu ekle
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/webp';
        link.href = FAVICON_URL;
        document.head.appendChild(link);
        // iOS ana ekran kısayolu için
        const apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        apple.href = FAVICON_URL;
        document.head.appendChild(apple);
      } catch (e) { /* tarayıcı engellerse sessiz geç */ }
    }, []);

    // YENİ: Aktif sekme her değiştiğinde saklanır → yenilemede aynı bölüm açılır
    useEffect(() => {
      try { sessionStorage.setItem('sembolAktifSekme', activeTab); } catch (e) { /* gizli mod vb. */ }
    }, [activeTab]);

    // YENİ: Bölüm değiştiğinde (ve yenilemeden sonra) içerik en üstten başlar
    useEffect(() => {
      if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }, [activeTab]);

    // ========================================================================
    // "İKİ KEZ YUKARI ÇEK → SAYFAYI YENİLE" — SADECE MOBİL (dokunmatik)
    // Sayfa en üstteyken kullanıcı arka arkaya İKİ kez parmağıyla aşağı sürüklerse
    // sayfa yenilenir. İlk çekimde uyarı çıkar, ikincisinde yenileme başlar.
    // Yenileme sonrası kullanıcı aynı bölümde ve sayfanın en üstünde devam eder.
    // NOT: Masaüstünde (fare/trackpad tekerleği) bu davranış KASITLI OLARAK
    // devre dışı — normal sayfa kaydırması sırasında yanlışlıkla sayfayı
    // yenilemesin diye. Masaüstünde yenilemek için tarayıcının kendi
    // yenileme tuşu / Cmd+R kullanılır.
    // ========================================================================
    useEffect(() => {
      // YENİ: Bu özellik KAPATILDI. Mobilde en üstteyken iki kez arka arkaya
      // aşağı çekme hareketi artık sayfayı yenilemez. Kod silinmedi; ileride
      // tekrar açmak istenirse aşağıdaki değişkeni true yapmak yeterlidir.
      const CIFT_CEKME_YENILEME_AKTIF = false;
      if (!CIFT_CEKME_YENILEME_AKTIF) return;

      const el = mainScrollRef.current;
      if (!el || !isAuthenticated) return;

      const ESIK = 70;    // çekme mesafesi eşiği (px)
      const SURE = 2500;  // iki çekim arasında izin verilen süre (ms)

      const cekimAlgilandi = () => {
        const s = cekimRef.current;
        const simdi = Date.now();
        if (simdi - s.sonZaman > SURE) s.sayac = 0; // arada çok beklendiyse baştan say
        s.sayac += 1;
        s.sonZaman = simdi;

        if (s.sayac >= 2) {
          // İkinci çekim: sayfayı yenile (aktif sekme zaten saklandığı için aynı bölüm açılır)
          s.sayac = 0;
          clearTimeout(s.zamanlayici);
          setYenilemeAsamasi(2);
          setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 300);
          return;
        }
        // İlk çekim: kullanıcıyı bilgilendir, süre dolarsa sayacı sıfırla
        setYenilemeAsamasi(1);
        clearTimeout(s.zamanlayici);
        s.zamanlayici = setTimeout(() => { cekimRef.current.sayac = 0; setYenilemeAsamasi(0); }, SURE);
      };

      // --- Dokunmatik (mobil): en üstteyken parmağı aşağı sürükleme ---
      let baslangicY = null;
      const onTouchStart = (e) => { baslangicY = el.scrollTop <= 0 ? e.touches[0].clientY : null; };
      const onTouchMove = (e) => {
        if (baslangicY === null || el.scrollTop > 0) return;
        if (e.touches[0].clientY - baslangicY > ESIK) { baslangicY = null; cekimAlgilandi(); }
      };
      const onTouchEnd = () => { baslangicY = null; };

      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: true });
      el.addEventListener('touchend', onTouchEnd, { passive: true });
      return () => {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        clearTimeout(cekimRef.current.zamanlayici);
      };
    }, [isAuthenticated]);

    const handleSyncOldData = async () => {
      try {
        const jobsSnap = await getDocs(collection(db, 'jobs'));
        for (const docSnap of jobsSnap.docs) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', docSnap.id), docSnap.data());

        const personnelSnap = await getDocs(collection(db, 'personnel'));
        for (const docSnap of personnelSnap.docs) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', docSnap.id), docSnap.data());

        const transSnap = await getDocs(collection(db, 'transactions'));
        for (const docSnap of transSnap.docs) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', docSnap.id), docSnap.data());

        localStorage.setItem('sembol_data_migrated', 'true');
        setIsDataMigrated(true);
        alert("Harika! Kök dizindeki eski verileriniz yeni sisteme aktarıldı.");
      } catch (err) {
        console.error(err);
        alert("Veri çekilirken hata oluştu: " + err.message);
      }
    };

    const handleAddPersonnel = async (newPersonnel) => {
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelList'), {
        ...newPersonnel, permissions: { canView: true, canEdit: false }, createdAt: new Date().toISOString()
      });
      addSystemLog('Personel Eklendi', `${newPersonnel.fullName} sisteme eklendi.`);
    };

    // YENİ: Personel Başvuru bölümünden bir aday kadroya alındığında çağrılır.
    // Aday bilgileri personel listesi (personnelList) yapısına eşlenerek kaydedilir;
    // eksik alanlar (IBAN, maaş vb.) daha sonra personel profili üzerinden tamamlanabilir.
    const handleHireCandidate = async (cand) => {
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelList'), {
        fullName: cand.fullName || '',
        personalPhone: cand.phone || '',
        collarType: cand.collarType || 'Mavi Yaka',
        position: cand.position || 'Şoför',
        rank: 'Standart',
        employmentStatus: 'Aktif',
        email: '', password: '', companyPhone: '', iban: '', tcNo: '', setcard: '', address: cand.address || '', profileImage: '',
        bankaParasi: '', maas: cand.expectedSalary || '', yemek: '', yol: '', icrasiVar: 'Hayır',
        startDate: new Date().toISOString().split('T')[0],
        hiredFromCandidate: true, // Aday takip sisteminden geldiğini işaretle
        ozlukEkstra: (cand.belgeler || []).map(b => ({ id: b.id || Date.now().toString(), label: b.label, url: b.url })), // YENİ: aday belgeleri özlük dosyasına aktarılır
        permissions: { canView: true, canEdit: false },
        createdAt: new Date().toISOString()
      });
      addSystemLog('Aday Kadroya Alındı', `${cand.fullName} (${cand.position}) aday takip sisteminden kadroya alındı.`);
    };

    const handleUpdatePersonnel = async (updatedUser) => {
      if (!firebaseUser) return;
      const { id, ...data } = updatedUser;
      
      const oldUser = personnelList.find(p => p.id === id);
      if (oldUser && oldUser.employmentStatus !== 'Pasif' && data.employmentStatus === 'Pasif') {
          data.passiveDate = new Date().toISOString();
          const leaveEvent = { id: Date.now().toString(), date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), type: 'Pasif' };
          data.leaveHistory = [...(oldUser.leaveHistory || []), leaveEvent];
      } else if (oldUser && oldUser.employmentStatus === 'Pasif' && data.employmentStatus !== 'Pasif') {
          data.passiveDate = null;
      }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id), data);
      addSystemLog('Personel Güncellendi', `${data.fullName} bilgileri güncellendi.`);
    };

    const handleDeletePersonnel = async (id) => {
      if (!firebaseUser) return;
      const person = personnelList.find(p => p.id === id);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id));
      if(person) addSystemLog('Personel Silindi', `${person.fullName} sistemden kaldırıldı.`);
      if (currentUser && currentUser.id === id) handleLogout();
    };

    const handleUpdateModuleAccess = async (userId, modulesData) => {
      if (!firebaseUser) return;
      const user = personnelList.find(p => p.id === userId);
      if (!user) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', userId), {
        permissions: { ...user.permissions, modules: modulesData }
      });
      addSystemLog('Görüntüleme Yetkileri', `${user.fullName} personelinin modül erişim izinleri güncellendi.`);
    };

    const handleUpdatePermissions = async (id, permissionType, value) => {
      if (!firebaseUser) return;
      const user = personnelList.find(p => p.id === id);
      if (!user) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id), {
        permissions: { ...user.permissions, [permissionType]: value }
      });
    };

    const handleUpdatePositionModuleAccess = async (position, moduleId, newValue) => {
      if (!firebaseUser) return;
      
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), {
          [`positionModules.${position}.${moduleId}`]: newValue
        });
      } catch (error) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), {
          positionModules: {
            [position]: {
              [moduleId]: newValue
            }
          }
        }, { merge: true });
      }
      
      addSystemLog('Görüntüleme Yetkileri', `${position} pozisyonunun modül erişim izinleri güncellendi.`);
    };

    const handleAddPosition = async (newPos) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { positions: [...positions, newPos] });
    };

    const handleDeletePosition = async (posToDelete) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { positions: positions.filter(p => p !== posToDelete) });
    };

    // YENİ: Pozisyon adını düzenleme — pozisyon listesindeki adı, o pozisyona
    // sahip TÜM personelin kaydındaki position alanını VE Modül Görüntüleme'de
    // o pozisyon adına bağlı yetkileri (positionModules) günceller. Aksi halde
    // hem seçim kutularında yetim bir isim kalır hem de daha önce o pozisyona
    // verilmiş modül yetkileri sessizce kaybolurdu.
    const handleUpdatePosition = async (oldPos, newPosName) => {
      if (!firebaseUser) return;
      const trimmed = (newPosName || '').trim();
      if (!trimmed || trimmed === oldPos) return;
      const yeniPositions = positions.map(p => p === oldPos ? trimmed : p);
      const yeniPositionModules = { ...positionModules };
      if (yeniPositionModules[oldPos] !== undefined) {
        yeniPositionModules[trimmed] = yeniPositionModules[oldPos];
        delete yeniPositionModules[oldPos];
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), {
        positions: yeniPositions,
        positionModules: yeniPositionModules
      });
      const etkilenenPersonel = personnelList.filter(p => p.position === oldPos);
      await Promise.all(etkilenenPersonel.map(p =>
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', p.id), { position: trimmed })
      ));
      addSystemLog('Pozisyon Adı Güncellendi', `"${oldPos}" pozisyonu "${trimmed}" olarak yeniden adlandırıldı (${etkilenenPersonel.length} personel etkilendi).`);
    };

    const handleAddRank = async (newRank) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { ranks: [...ranks, newRank] });
    };

    const handleDeleteRank = async (rankToDelete) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { ranks: ranks.filter(r => r !== rankToDelete) });
    };

    // YENİ: Rütbe adını düzenleme — hem rütbe listesindeki adı, hem de o rütbeye
    // sahip TÜM personelin kaydındaki rank alanını günceller (veri tutarlılığı için;
    // aksi halde seçim kutularında artık listede olmayan eski isim yetim kalırdı).
    const handleUpdateRank = async (oldRank, newRankName) => {
      if (!firebaseUser) return;
      const trimmed = (newRankName || '').trim();
      if (!trimmed || trimmed === oldRank) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), {
        ranks: ranks.map(r => r === oldRank ? trimmed : r)
      });
      const etkilenenPersonel = personnelList.filter(p => p.rank === oldRank);
      await Promise.all(etkilenenPersonel.map(p =>
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', p.id), { rank: trimmed })
      ));
      addSystemLog('Rütbe Adı Güncellendi', `"${oldRank}" rütbesi "${trimmed}" olarak yeniden adlandırıldı (${etkilenenPersonel.length} personel etkilendi).`);
    };

    const handleAddVehicle = async (newVehicle) => {
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'vehicles'), newVehicle);
      addSystemLog('Araç Eklendi', `${newVehicle.plate} plakalı araç eklendi.`);
      setActiveTab('vehicleList');
    };

    const handleUpdateVehicle = async (updatedVehicle) => {
      if (!firebaseUser) return;
      const { id, ...data } = updatedVehicle;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', id), data);
      addSystemLog('Araç Güncellendi', `${data.plate} plakalı araç bilgileri güncellendi.`);
      setEditingVehicle(null);
    };

    const handleDeleteVehicle = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', id));
    };

    const handleAddMaterial = async (newMaterial) => {
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'materials'), newMaterial);
      addSystemLog('Malzeme Eklendi', `${newMaterial.name} stoklara eklendi.`);
      setActiveTab('materialList');
    };

    const handleDeleteMaterial = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', id));
    };

    const handleUpdateMaterialStock = async (materialId, amountChange, description, cost) => {
      if (!firebaseUser) return;
      const material = materials.find(m => m.id === materialId);
      if (!material) return;

      const changeNum = parseFloat(amountChange) || 0;
      const newStock = Math.max(0, parseFloat(material.stock) + changeNum);

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', materialId), {
        stock: String(newStock)
      });

      let actionText = changeNum > 0 ? 'Stok Girişi' : 'Stok Çıkışı';
      let detailsText = `${material.name} malzemesi için ${Math.abs(changeNum)} ${material.unit} ${actionText} yapıldı.`;
      if (description) detailsText += ` Açıklama: ${description}.`;
      if (cost && parseFloat(cost) > 0) detailsText += ` Tutar: ₺${cost}.`;

      addSystemLog(actionText, detailsText);

      if (cost && parseFloat(cost) > 0 && changeNum > 0) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
          type: 'expense',
          amount: parseFloat(cost),
          category: 'Malzeme Alımı',
          account: 'cash',
          date: new Date().toISOString().split('T')[0],
          description: `${material.name} Alımı: ${description || ''}`.trim()
        });
      } else if (cost && parseFloat(cost) > 0 && changeNum < 0) {
         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
          type: 'income',
          amount: parseFloat(cost),
          category: 'Malzeme Satışı / Çıkışı',
          account: 'cash',
          date: new Date().toISOString().split('T')[0],
          description: `${material.name} Çıkışı: ${description || ''}`.trim()
        });
      }
    };

    const handleAddTask = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), { ...newTask, status: 'todo' });
      setShowTaskModal(false);
      setNewTask({ title: '', description: '', assignee: 'Tüm Personeller', date: new Date().toISOString().split('T')[0] });
      setActiveTab('taskList');
    };
    
    const handleUpdateTaskStatus = async (taskId, status) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), { status });
    };

    const handleAddTodo = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'todos'), { ...newTodo, createdBy: currentUser?.fullName, createdAt: new Date().toISOString() });
      setNewTodo({ title: '', details: '', reminderDate: new Date().toISOString().split('T')[0], priority: 'Normal', status: 'todo' });
      // KALDIRILDI: setActiveTab('todoList') yönlendirmesi — "Takip ve Yapılacak İşler"
      // sayfası kapatıldığı için kayıt sonrası kullanıcı bulunduğu ekranda kalır.
      // YENİ: Kayıt sonrası "Yeni Ekle" modalı otomatik kapanır
      setShowAddTodoModal(false);
      addSystemLog('Yapılacak Eklendi', `Yeni bir yapılacak iş eklendi: ${newTodo.title}`);
    };

    const handleUpdateTodoStatus = async (id, status) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'todos', id), { status });
    };

    const handleDeleteTodo = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'todos', id));
      addSystemLog('Yapılacak Silindi', `Yapılacak listesinden bir kayıt silindi.`);
    };

    const handleApprovePoints = async (job, individualPoints, reviewImageUrl, supportPersonnelIds = []) => {
      if (!firebaseUser) return;
      try {
        // YENİ: Daha önce onaylanmışsa bu bir DÜZENLEMEDİR — eski puanlar önce geri alınır (çift sayım engellenir)
        const isEditingApproval = !!job.pointsApproved;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
          pointsApproved: true,
          reviewImage: reviewImageUrl || null,
          supportPersonnelIds: supportPersonnelIds,
          approvedPoints: individualPoints // YENİ: Verilen puanların anlık görüntüsü (düzenlemede geri almak için)
        });

        const hasAnyPoints = Object.values(individualPoints).some(v => parseFloat(v) > 0) || (supportPersonnelIds && supportPersonnelIds.length > 0);

        if (hasAnyPoints || isEditingApproval) {
          const jobDate = new Date(job.date);
          const year = jobDate.getFullYear();
          const month = jobDate.getMonth() + 1;
          const day = jobDate.getDate();

          const puantajRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${year}_${month}`);
          const snap = await getDoc(puantajRef);
          let records = snap.exists() ? snap.data().records : {};

          // YENİ: DÜZENLEME ise önce eski onaydaki puanlar puantajdan düşülür
          if (isEditingApproval) {
            const oldPoints = job.approvedPoints || {};
            let removedMain = false;
            Object.keys(oldPoints).forEach(pId => {
              const pts = parseFloat(oldPoints[pId]) || 0;
              if (pts > 0 && records[pId]) {
                records[pId][day] = Math.max(0, (parseFloat(records[pId][day]) || 0) - pts);
                removedMain = true;
              }
            });
            if (removedMain && records['daily_comments']) {
              records['daily_comments'][day] = Math.max(0, (parseFloat(records['daily_comments'][day]) || 0) - 1);
            }
            // Eski destek puanları (0.5) da geri alınır
            (job.supportPersonnelIds || []).forEach(spId => {
              if (records[spId]) records[spId][day] = Math.max(0, (parseFloat(records[spId][day]) || 0) - 0.5);
            });
          }

          let addedMainPoints = false;
          
          Object.keys(individualPoints).forEach(pId => {
            const pts = parseFloat(individualPoints[pId]) || 0;
            if (pts > 0) {
              if (!records[pId]) records[pId] = {};
              records[pId][day] = (parseFloat(records[pId][day]) || 0) + pts;
              addedMainPoints = true;
            }
          });

          if (addedMainPoints) {
            if (!records['daily_comments']) records['daily_comments'] = {};
            records['daily_comments'][day] = (parseFloat(records['daily_comments'][day]) || 0) + 1;
          }

          if (supportPersonnelIds && supportPersonnelIds.length > 0) {
            supportPersonnelIds.forEach(spId => {
              if (!records[spId]) records[spId] = {};
              records[spId][day] = (parseFloat(records[spId][day]) || 0) + 0.5;
            });

            const notifsCol = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
            const assignDateStr = new Date().toISOString().split('T')[0];
            // YENİ: Düzenlemede aynı kişiye tekrar bildirim gitmesin — sadece yeni eklenenlere gönder
            const previousSupportIds = isEditingApproval ? (job.supportPersonnelIds || []) : [];
            for (const spId of supportPersonnelIds.filter(id => !previousSupportIds.includes(id))) {
              await addDoc(notifsCol, {
                userId: spId,
                title: '🌟 Takım Desteği Puanı!',
                message: `Diğer takım arkadaşlarınıza yardımcı olduğunuz için teşekkür ederiz! Harika iş çıkardınız. Destek puanınız (0.5) hanenize eklendi.`,
                date: new Date().toLocaleString('tr-TR'),
                read: false,
                type: 'support_bonus',
                assignedDate: assignDateStr,
                jobDate: job.date
              });
            }
          }

          await setDoc(puantajRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
        }

        addSystemLog('Puan Onaylandı', `${job.customerName} operasyonu için müşteri puanı/yorumu onaylandı.`);
        alert("İşlem başarıyla tamamlandı!");
      } catch (e) {
        console.error(e);
        alert("Puan onaylanırken hata oluştu.");
      }
    };

    const handleOpenApproveModal = (job) => {
      setJobToApprove(job);
      const teamIds = job.assignedPersonnelIds ? [...job.assignedPersonnelIds] : [];
      if (job.assignedPersonnelId && !teamIds.includes(job.assignedPersonnelId)) {
        teamIds.push(job.assignedPersonnelId);
      }
      const initialPoints = {};
      teamIds.forEach(id => {
         // YENİ: Düzenleme ise daha önce verilen puan otomatik gelir, yoksa varsayılan 1
         initialPoints[id] = (job.approvedPoints && job.approvedPoints[id] !== undefined) ? job.approvedPoints[id] : 1;
      });
      setApproveData({ individualPoints: initialPoints, reviewImage: job.reviewImage || '', supportPersonnelIds: job.supportPersonnelIds || [] });
      setShowApproveModal(true);
    };

    const handleReviewImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setApproveData(prev => ({ ...prev, reviewImage: 'Yükleniyor...' }));

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', {
          method: 'POST',
          body: formData,
        });
        const text = await res.text();
        let uploadedUrl = file.name;
        try {
          const json = JSON.parse(text);
          uploadedUrl = json.url || json.fileName || json.file || text;
        } catch (err) {
          uploadedUrl = text.trim();
        }
        setApproveData(prev => ({ ...prev, reviewImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Görsel yüklenemedi.");
        setApproveData(prev => ({ ...prev, reviewImage: '' }));
      }
    };

    const submitApprovePoints = async (e) => {
      e.preventDefault();
      if (approveData.reviewImage === 'Yükleniyor...') {
        alert('Lütfen görselin yüklenmesini bekleyin.');
        return;
      }
      await handleApprovePoints(jobToApprove, approveData.individualPoints, approveData.reviewImage, approveData.supportPersonnelIds);
      setShowApproveModal(false);
      setJobToApprove(null);
    };
    
    const handleOpenMesaiModal = async (job) => {
      setJobForMesai(job);
      const teamIds = job.assignedPersonnelIds ? [...job.assignedPersonnelIds] : [];
      if (job.assignedPersonnelId && !teamIds.includes(job.assignedPersonnelId)) {
        teamIds.push(job.assignedPersonnelId);
      }

      const validTeamIds = teamIds.filter(id => {
         const p = personnelList.find(pers => String(pers.id) === String(id));
         return p && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
      });

      const dateObj = new Date(job.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      try {
        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${year}_${month}`);
        const snap = await getDoc(mesaiRef);
        let records = snap.exists() ? snap.data().records : {};

        // ============================================================
        // YENİ: QR MESAİ ÖNERİSİ (yalnızca Mavi Yaka)
        // O güne ait QR giriş/çıkış kayıtları çekilir ve her personelin
        // çalışma programıyla karşılaştırılarak durum + saat HAZIR gelir.
        // Fazla mesai ekip bazlıdır: ekipteki EN ERKEN çıkış esas alınır.
        // Puantaja yazılmaz; yalnızca ekranda öneri olarak gösterilir,
        // yönetici "Mesaileri Kaydet" dediğinde işlenir.
        // ============================================================
        const tarihStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let oneriler = {};
        try {
          const qrKayitlari = await gunlukQrKayitlariGetir(tarihStr);
          const ekip = validTeamIds.map(id => personnelList.find(pers => String(pers.id) === String(id))).filter(Boolean);
          oneriler = mesaiOnerileriHesapla(ekip, qrKayitlari, tarihStr);
        } catch (qrErr) {
          console.warn('QR mesai önerileri hesaplanamadı, varsayılan kullanılacak:', qrErr);
        }

        const initialModalData = {};
        validTeamIds.forEach(pId => {
          const valObj = records[pId] && records[pId][day];
          const val = typeof valObj === 'object' && valObj !== null ? valObj.status : valObj || '';
          const hours = typeof valObj === 'object' && valObj !== null ? valObj.hours : '';
          const oneri = oneriler[pId];
          // Puantajda ELLE girilmiş bir kayıt varsa ona dokunulmaz; yoksa QR önerisi kullanılır
          const elleGirilmis = typeof valObj === 'object' && valObj !== null && valObj.manual === true;
          initialModalData[pId] = elleGirilmis || !oneri
            ? { status: val || 'G', hours: hours || '', oneri: oneri || null }
            : { status: oneri.status, hours: oneri.hours, oneri };
        });

        setMesaiModalData(initialModalData);
        setShowMesaiModal(true);
      } catch (err) {
        console.error("Mesai bilgileri yüklenemedi", err);
        alert("Mesai bilgileri yüklenirken hata oluştu.");
      }
    };

    const submitMesaiApprove = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !jobForMesai) return;

      const dateObj = new Date(jobForMesai.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      try {
        // ====================================================================
        // YENİ (kullanıcı talebi — 2. ekteki boş "Saat" hücreleri):
        // ====================================================================
        // Fazla Mesai (FM) / Eksik Mesai (EM) / F.Gün+Mesai (FGM) SAATE bağlı
        // kodlardır. Saat girilmezse mesai tablosunda hücre "FM / Saat(boş)"
        // olarak kalıyor; personelin fazla mesai ücreti hesaplanamıyor — yani
        // mesai fiilen KAYBOLUYOR. Bu yüzden kaydetmeden önce saat kontrolü
        // yapılır ve eksikse uyarı verilip kayıt durdurulur.
        const saatGerekenler = Object.keys(mesaiModalData).filter(pId => {
          const d = mesaiModalData[pId];
          if (!['FM', 'EM', 'FGM'].includes(d.status)) return false;
          const s = String(d.hours ?? '').trim();
          return s === '' || !(parseFloat(s.replace(',', '.')) > 0);
        });
        if (saatGerekenler.length > 0) {
          const adlar = saatGerekenler
            .map(pId => (personnelList || []).find(x => String(x.id) === String(pId))?.fullName || pId)
            .join('\n• ');
          alert(`Saat girilmemiş mesai var — kayıt yapılmadı.\n\nAşağıdaki personel için Fazla/Eksik Mesai seçili ama SAAT boş:\n\n• ${adlar}\n\nSaat girmezseniz mesai ücreti hesaplanamaz. Lütfen saatleri yazın veya durumu "G - Geldi" olarak değiştirin.`);
          return;
        }

        // ====================================================================
        // DÜZELTME (kullanıcı talebi — "operasyon sorumlusu onaylayınca mesai
        // Personel Muhasebe > Mesai tablosunda görünsün, mesai kaçmasın"):
        // ====================================================================
        // ESKİ HATA: Onaylanan TÜM personel, yaka tipine bakılmadan MAVİ YAKA
        // dokümanına (mesai/{yıl}_{ay}) yazılıyordu. Finans > Personel Muhasebe
        // ekranı mavi yakayı bu dokümandan, beyaz yakayı ise 'beyaz_' önekli
        // dokümandan okur. Dolayısıyla ekipte bir BEYAZ YAKA personel varsa
        // (operasyon sorumlusu, depo sorumlusu vb.) onun mesaisi yanlış
        // dokümana gidiyor ve mesai tablosunda HİÇ GÖRÜNMÜYORDU — "mesai
        // kaçması" tam olarak buydu.
        // YENİ: Kayıtlar yaka tipine göre AYRILIR ve her biri kendi dokümanına
        // yazılır. Veri biçimi ({ status, hours }) mesai tablosunun beklediği
        // biçimle aynı; tablo bunu olduğu gibi okur, gerekirse Mesai Takip
        // ekranından elle değiştirilebilir (kaynak damgası bunu engellemez).
        const beyazMi = (pId) => {
          const p = (personnelList || []).find(x => String(x.id) === String(pId));
          if (!p) return false;
          if (p.collarType) return p.collarType === 'Beyaz Yaka';
          // Yaka tipi girilmemişse pozisyona göre karar ver (sistemin genel kuralı)
          return !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position);
        };

        const gruplar = { '': {}, 'beyaz_': {} };
        Object.keys(mesaiModalData).forEach(pId => {
          const onek = beyazMi(pId) ? 'beyaz_' : '';
          gruplar[onek][pId] = mesaiModalData[pId];
        });

        let yazilanKisi = 0;
        for (const onek of Object.keys(gruplar)) {
          const grup = gruplar[onek];
          if (Object.keys(grup).length === 0) continue;
          const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${onek}${year}_${month}`);
          const snap = await getDoc(mesaiRef);
          const records = snap.exists() ? (snap.data().records || {}) : {};
          Object.keys(grup).forEach(pId => {
            if (!records[pId]) records[pId] = {};
            // 'oneri' yalnızca ekranda gösterim içindir; puantaja yazılmaz
            const { status, hours } = grup[pId];
            // kaynak: 'isOnay' -> bu hücrenin iş onayından geldiğini belirtir.
            // manual: true -> bu bir İNSAN KARARIDIR; mesai tablosundaki
            // otomatik doldurma/temizleme mantığı bu hücreyi SİLMEZ. Yönetici
            // Mesai Takip ekranından yine elle değiştirebilir.
            records[pId][day] = { status, hours: hours || '', kaynak: 'isOnay', manual: true };
            yazilanKisi += 1;
          });
          await setDoc(mesaiRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobForMesai.id), { mesaiApproved: true });

        addSystemLog('Mesai Onaylandı', `${jobForMesai.customerName} operasyonunda ${yazilanKisi} personelin mesai durumu (${day}.${month}.${year}) Personel Muhasebe mesai tablosuna işlendi.`);
        setShowMesaiModal(false);
        setJobForMesai(null);
      } catch (err) {
        console.error("Mesai onaylanamadı", err);
        alert("Mesai kaydedilirken bir hata oluştu.");
      }
    };

    const handleUpdateComplaintStatus = async (id, status, isRead = false) => {
      if (!firebaseUser) return;
      const updateData = { status };
      if (isRead) updateData.read = true;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'complaints', id), updateData);
    };

    const handleDeleteComplaint = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'complaints', id));
    };

    const handleUpdateTask = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !editingTask) return;
      const { id, ...data } = editingTask;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id), data);
      setEditingTask(null);
    };

    const handleDeleteTask = async (taskId) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId));
    };

    const openEditTask = (task) => {
      setEditingTask(task);
    };

    const handleAddTransaction = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;

      const amount = parseFloat(newTransaction.amount);

      let allIncome = jobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + (parseFloat(j.price) || 0), 0) + transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      let allExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      let netBalance = allIncome - allExpense;

      if (transactionType === 'expense' && netBalance - amount < 0) {
        alert(`Kasadaki net durumunuz: ₺${netBalance.toLocaleString('tr-TR')}. Lütfen işlem yapmadan önce kasanıza gelir/para ekleyin veya mevcut giderlerinizi düzenleyin.`);
        return;
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { 
        type: transactionType, amount: amount, category: newTransaction.category, account: newTransaction.account, date: newTransaction.date, description: newTransaction.description 
      });
      setNewTransaction({ amount: '', category: transactionType === 'income' ? 'Nakliye Tahsilatı' : 'Maaş Ödemesi', account: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
      setActiveTab('financeDashboard');
    };

    const onSendMessage = async (msgData) => {
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), msgData);
    };

    const onMarkMessageAsRead = async (msgId) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msgId), { read: true });
    };

    const markNotificationsAsRead = async (userId) => {
      if (!firebaseUser) return;
      const unreadNotifs = notifications.filter(n => String(n.userId) === String(userId) && !n.read);
      for (const n of unreadNotifs) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', n.id), { read: true });
      }
    };

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleProvinceChange = (e, type) => {
      const province = e.target.value;
      let provKey, distKey;
      if (type === 'from') { provKey = 'fromProvince'; distKey = 'fromDistrict'; }
      else if (type === 'to') { provKey = 'toProvince'; distKey = 'toDistrict'; }
      setFormData({ ...formData, [provKey]: province, [distKey]: '' });
    };

    const toggleDepoDirection = () => {
      setFormData(prev => ({
        ...prev, depoDirection: prev.depoDirection === 'toDepo' ? 'fromDepo' : 'toDepo',
        fromProvince: prev.toProvince, fromDistrict: prev.toDistrict, fromFloor: prev.toFloor, fromTransportMethod: prev.toTransportMethod, fromPacking: prev.toPacking, fromRoomCount: prev.toRoomCount, fromDistance: prev.toDistance, fromDistanceUnit: prev.toDistanceUnit, fromAddress: prev.toAddress,
        toProvince: prev.fromProvince, toDistrict: prev.fromDistrict, toFloor: prev.fromFloor, toTransportMethod: prev.fromTransportMethod, toPacking: prev.fromPacking, toRoomCount: prev.fromRoomCount, toDistance: prev.fromDistance, toDistanceUnit: prev.fromDistanceUnit, toAddress: prev.fromAddress,
      }));
    };

    const handleSwapAddresses = () => {
      setFormData(prev => ({
        ...prev, depoDirection: prev.depoDirection === 'toDepo' ? 'fromDepo' : 'toDepo',
        fromProvince: prev.toProvince, fromDistrict: prev.toDistrict, fromFloor: prev.toFloor, fromTransportMethod: prev.toTransportMethod, fromPacking: prev.toPacking, fromRoomCount: prev.toRoomCount, fromDistance: prev.toDistance, fromDistanceUnit: prev.toDistanceUnit, fromAddress: prev.toAddress,
        extraLoadingAddresses: prev.extraUnloadingAddresses || [],
        toProvince: prev.fromProvince, toDistrict: prev.fromDistrict, toFloor: prev.fromFloor, toTransportMethod: prev.fromTransportMethod, toPacking: prev.fromPacking, toRoomCount: prev.fromRoomCount, toDistance: prev.fromDistance, toDistanceUnit: prev.fromDistanceUnit, toAddress: prev.fromAddress,
        extraUnloadingAddresses: prev.extraLoadingAddresses || [],
      }));
    };

    const handleDepoChange = (e) => {
      const depoName = e.target.value;
      const depo = DEPO_LOCATIONS.find(d => d.name === depoName);
      if (depo) {
        // YENİ: Kat ve taşıma şekli artık tesise göre gelir. Tanımlı değilse
        // eski davranış korunur: Giriş Kat + Merdiven.
        const kat = depo.floor || 'Giriş Kat';
        const tasima = depo.transportMethod || 'Merdiven';
        if (formData.depoDirection === 'fromDepo') {
          setFormData({...formData, selectedDepo: depoName, fromProvince: depo.province, fromDistrict: depo.district, fromAddress: depo.address, fromFloor: kat, fromTransportMethod: tasima, fromPacking: 'Kendisi Topladı', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre'});
        } else {
          setFormData({...formData, selectedDepo: depoName, toProvince: depo.province, toDistrict: depo.district, toAddress: depo.address, toFloor: kat, toTransportMethod: tasima, toPacking: 'Kendisi Topladı', toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre'});
        }
      } else {
        if (formData.depoDirection === 'fromDepo') {
          setFormData({...formData, selectedDepo: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromAddress: '', fromFloor: '1. Kat', fromTransportMethod: 'Merdiven', fromPacking: 'Kendisi Topladı', fromRoomCount: '2+1', fromDistance: '', fromDistanceUnit: 'Metre'});
        } else {
          setFormData({...formData, selectedDepo: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toAddress: '', toFloor: '1. Kat', toTransportMethod: 'Merdiven', toPacking: 'Kendisi Topladı', toRoomCount: '2+1', toDistance: '', toDistanceUnit: 'Metre'});
        }
      }
    };

    const handleEditJob = (job) => {
      setEditingJobId(job.id);
      setRecordType(job.type || 'Nakliye');
      setFormData({ ...job, extraLoadingAddresses: job.extraLoadingAddresses || [], extraUnloadingAddresses: job.extraUnloadingAddresses || [] });
      if (job.type === 'Nakliye') setActiveTab('addNakliye');
      else if (job.type === 'Depo') setActiveTab('addDepo');
      else if (job.type === 'Asansör') setActiveTab('addAsansor');
      else setActiveTab('addNakliye');
    };

    const handleCancelJob = async (id) => {
      if (!firebaseUser) return;
      const jobToCancel = jobs.find(j => j.id === id);
      // YENİ: İptalin ne zaman ve kim tarafından yapıldığı da kayda işlenir (raporlama için)
      const updateData = { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: currentUser?.fullName || 'Sistem' };

      if (jobToCancel && (
        (jobToCancel.assignedPersonnelIds && jobToCancel.assignedPersonnelIds.length > 0) ||
        jobToCancel.assignedPersonnelId ||
        (jobToCancel.team && jobToCancel.team !== 'Atanmadı')
      )) {
        updateData.assignedPersonnelIds = [];
        updateData.assignedPersonnelId = null;
        updateData.teamNames = [];
        updateData.team = 'Atanmadı';
      }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), updateData);
      addSystemLog('İş İptal Edildi', `Sistem üzerinden bir operasyon iptal edildi.`);
    };

    const handleRestoreJob = async (id) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), { status: 'pending' });
      addSystemLog('İş Geri Alındı', `İptal edilen bir operasyon geri alındı.`);
    };

    const handleCompletelyDeleteJob = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id));
      // ======================================================================
      // DÜZELTME (KRİTİK): ARŞİV KATMANINDAN DA DÜŞÜR
      // ======================================================================
      // SORUNUN KÖKÜ: İşler iki katmanda tutulur — son 30 gün canlı dinlenir
      // (onSnapshot, silinince kendiliğinden düşer), daha ESKİ işler ise bir
      // kez okunup arsivIsler içinde BELLEKTE tutulur. Eski Sistem Aktarımı
      // kayıtları Mayıs/Haziran tarihli olduğu için arşiv katmanındaydı;
      // deleteDoc Firestore'dan siliyordu ama bellekteki kopya kaldığı için
      // ekranda hiçbir şey olmamış gibi görünüyordu ("silmiyor" şikâyeti).
      // Artık silinen kayıt arşiv listesinden de anında çıkarılır.
      // ======================================================================
      setArsivIsler(prev => prev.filter(j => j.id !== id));
      addSystemLog('İş Kalıcı Olarak Silindi', `Sistem üzerinden bir operasyon kalıcı olarak silindi.`);
    };

    const submitChangeJobDate = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !jobToChangeDate || !newJobDate) return;

      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToChangeDate.id), {
          date: newJobDate
        });
        addSystemLog('İş Tarihi Değiştirildi', `${jobToChangeDate.customerName} operasyonunun tarihi ${jobToChangeDate.date} -> ${newJobDate} olarak değiştirildi.`);

        if (jobToChangeDate.deliveryCode || jobToChangeDate.customerName) {
            const relatedAsansors = jobs.filter(j =>
                (j.deliveryCode === jobToChangeDate.deliveryCode || j.customerName === jobToChangeDate.customerName) &&
                j.type === 'Asansör' &&
                j.id !== jobToChangeDate.id &&
                j.date === jobToChangeDate.date
            );
            if (relatedAsansors.length > 0) {
                for (const asansor of relatedAsansors) {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', asansor.id), {
                      date: newJobDate
                    });
                }
                addSystemLog('İş Tarihi Değiştirildi', `Bağlı ${relatedAsansors.length} adet asansör kurulum işinin tarihi de otomatik olarak yeni güne (${newJobDate}) taşındı.`);
            }
        }

        setShowChangeDateModal(false);
        setJobToChangeDate(null);
        setNewJobDate('');
      } catch(err) {
        console.error(err);
        alert("Tarih değiştirilirken hata oluştu.");
      }
    };

    const handleMarkAsDamaged = async (id) => {
      if (!firebaseUser) return;
      const job = jobs.find(j => j.id === id);
      if (!job) return;
      
      const updatedEndJobDetails = {
        ...(job.endJobDetails || {}),
        damageStatus: 'Hasar var',
        damageDetails: job.endJobDetails?.damageDetails || 'Sonradan hasar bildirimi yapıldı.'
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), { 
        endJobDetails: updatedEndJobDetails 
      });
      addSystemLog('Hasar Bildirimi', `${job.customerName} müşterisinin tamamlanan operasyonuna hasar kaydı eklendi.`);
    };

    const handleOpenResolveDamageModal = (id) => {
      setResolveDamageModal({ isOpen: true, jobId: id, note: '', cost: '', files: [] });
    };

    const handleResolveDamageSubmit = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !resolveDamageModal.jobId) return;

      const job = jobs.find(j => j.id === resolveDamageModal.jobId);
      if (!job) return;

      // DEĞİŞTİ: HASAR TUTARI ZORUNLU. Boş bırakılarak kayıt yapılamaz;
      // masrafsız çözümlerde 0 girilmelidir (0 geçerlidir, borç yazılmaz).
      // Buton zaten boşken kilitli, ama fonksiyon seviyesinde de denetlenir.
      if (String(resolveDamageModal.cost).trim() === '') {
        alert('Hasar Tutarı zorunludur. Maliyetsiz çözüm olduysa 0 girebilirsiniz.');
        return;
      }
      const girilenTutar = parseFloat(resolveDamageModal.cost);
      if (isNaN(girilenTutar) || girilenTutar < 0) {
        alert('Hasar Tutarı 0 veya daha büyük bir sayı olmalıdır.');
        return;
      }

      // ======================================================================
      // YENİ: HASAR TUTARI -> EKİBE EŞİT BÖLÜNEREK "HASAR BORCU" YAZILIR
      // ======================================================================
      // Kural (kullanıcı talebi):
      //  • Hasarın maliyeti (ör. 10.000 TL) işe GİDEN ekibe eşit bölünür
      //    (5 kişi gittiyse kişi başı 2.000 TL).
      //  • Bu tutar ASLA maaştan kesilmez; yalnızca PRİM'den kesilir.
      //    Kesinti işlemi Maaş Tablosu'nda (Finans > Personel Muhasebe) yapılır:
      //    kişinin o ayki prim TL'si borcundan büyükse borç kapanır, küçükse
      //    prim sıfırlanır ve KALAN borç sonraki aylara devreder. Prim hiçbir
      //    zaman eksiye düşmez, saat hesabına da eksi sokulmaz.
      //  • Personel kartında iki alan tutulur:
      //      hasarBorcuToplam -> bugüne kadar yazılan toplam hasar payı
      //      hasarBorcuKalan  -> henüz primlerden kesilmemiş kalan borç
      //  • Her personelin hareket akışına (personnelActions) kayıt düşülür,
      //    böylece profildeki "Personel Hareket İşlemleri"nde görünür.
      // ======================================================================
      const hasarTutari = parseFloat(resolveDamageModal.cost) || 0;
      const ekipIdleri = (job.assignedPersonnelIds || []).filter(Boolean);
      let kisiBasi = 0;

      if (hasarTutari > 0 && ekipIdleri.length > 0) {
        kisiBasi = Math.round((hasarTutari / ekipIdleri.length) * 100) / 100; // Kuruşa yuvarla
        for (const pid of ekipIdleri) {
          const kisi = personnelList.find(p => String(p.id) === String(pid));
          if (!kisi) continue; // Kayıttan silinmiş personel atlanır
          try {
            // 1) Personel kartındaki borç sayaçları artırılır (kümülatif)
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(pid)), {
              hasarBorcuToplam: (parseFloat(kisi.hasarBorcuToplam) || 0) + kisiBasi,
              hasarBorcuKalan: (parseFloat(kisi.hasarBorcuKalan) || 0) + kisiBasi
            });
            // 2) Hareket akışına düşülür (profilde görünür)
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelActions'), {
              personnelId: String(pid),
              type: 'hasarBorcu',
              title: 'Hasar Borcu Eklendi',
              amount: kisiBasi,
              note: `${job.customerName} işindeki hasar: ₺${hasarTutari.toLocaleString('tr-TR')} / ${ekipIdleri.length} kişi. Priminden kesilecek.`,
              jobId: job.id,
              date: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString()
            });
          } catch (err) { console.error('Hasar borcu yazılamadı:', pid, err); }
        }
      }

      const updatedEndJobDetails = {
        ...(job.endJobDetails || {}),
        damageResolved: true,
        damageResolutionNote: resolveDamageModal.note,
        // YENİ: Çözüm belgeleri (fotoğraf/PDF/dekont) — { url, name } listesi.
        // Yüklemesi tamamlanmamış yer tutucular kaydedilmez.
        damageResolutionFiles: (resolveDamageModal.files || []).filter(f => f.url && f.url !== 'Yükleniyor...'),
        // YENİ: Maliyet bilgisi işin üzerinde de saklanır (raporlama/iz için)
        damageCost: hasarTutari,
        damageCostPerPerson: kisiBasi,
        damageCostTeamCount: ekipIdleri.length
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
        endJobDetails: updatedEndJobDetails
      });

      addSystemLog('Hasar Çözüldü', `${job.customerName} müşterisinin hasar kaydı çözüldü olarak işaretlendi.${hasarTutari > 0 ? ` Maliyet ₺${hasarTutari.toLocaleString('tr-TR')} — ${ekipIdleri.length} kişiye ₺${kisiBasi.toLocaleString('tr-TR')} hasar borcu yazıldı (primden kesilecek).` : ''}`);
      setResolveDamageModal({ isOpen: false, jobId: null, note: '', cost: '', files: [] });
    };

    // YENİ: Hasarlı İşler "Düzenle" butonu — hasar notunu ve (çözülmüşse) çözüm notunu düzenlemek için modalı açar.
    const handleOpenEditDamageModal = (job) => {
      setEditDamageModal({
        isOpen: true,
        jobId: job.id,
        damageDetails: job.endJobDetails?.damageDetails || '',
        damageResolutionNote: job.endJobDetails?.damageResolutionNote || '',
        damageResolved: !!job.endJobDetails?.damageResolved
      });
    };

    // YENİ: Düzenlenen hasar/çözüm notlarını kaydet
    const handleEditDamageSubmit = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !editDamageModal.jobId) return;
      const job = jobs.find(j => j.id === editDamageModal.jobId);
      if (!job) return;

      const updatedEndJobDetails = {
        ...(job.endJobDetails || {}),
        damageDetails: editDamageModal.damageDetails,
        ...(editDamageModal.damageResolved ? { damageResolutionNote: editDamageModal.damageResolutionNote } : {})
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
        endJobDetails: updatedEndJobDetails
      });

      addSystemLog('Hasar Notu Düzenlendi', `${job.customerName} müşterisinin hasar notu${editDamageModal.damageResolved ? ' ve çözüm notu' : ''} güncellendi.`);
      setEditDamageModal({ isOpen: false, jobId: null, damageDetails: '', damageResolutionNote: '', damageResolved: false });
    };

    const handleAddJob = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      // YENİ: Zorunlu alan kontrolü (güvenlik amaçlı ikinci katman)
      // İsim veya telefon boşsa kayıt oluşturulmaz. Asıl uyarı penceresi AddJobView içindedir.
      if (!formData.customerName?.trim() || !formData.customerPhone?.trim()) return;
      const wasEditing = !!editingJobId; // Bildirim metni için düzenleme mi, yeni kayıt mı olduğunu başta yakala
      try {
        const jobData = { type: recordType, ...formData };
        Object.keys(jobData).forEach(key => jobData[key] === undefined && delete jobData[key]);

        const duration = parseInt(formData.durationDays || '1');
        // YENİ: Başarı panelindeki WhatsApp mesajında kullanmak için teslim kodunu dış kapsamda tut
        let savedDeliveryCode = jobData.deliveryCode || '';

        if (editingJobId) {
          // DÜZELTME: Düzenlemede orijinal kayıt zamanı (createdAt) korunur; ayrıca
          // "en son ne zaman / kim güncelledi" bilgisi de kayda işlenir.
          const mevcut = jobs.find(j => j.id === editingJobId);
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', editingJobId), {
            ...jobData,
            createdAt: mevcut?.createdAt || jobData.createdAt || new Date().toISOString(),
            createdBy: mevcut?.createdBy || jobData.createdBy || (currentUser?.fullName || 'Sistem'),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.fullName || 'Sistem'
          });
          addSystemLog('Kayıt Güncellendi', `${formData.customerName} müşterisine ait iş güncellendi.`);

          // YENİ: Kapora düzenlendiyse defter kaydı da güncellenir.
          // defterKaporaKaydet mükerrer korumalıdır: kayıt varsa GÜNCELLER,
          // kapora sıfırlandıysa SİLER. Bu yüzden koşulsuz çağırmak güvenli —
          // aksi halde kapora silindiğinde defterde hayalet satır kalırdı.
          await defterKaporaKaydet({
            db, appId,
            job: { ...jobData, id: editingJobId, createdAt: mevcut?.createdAt || jobData.createdAt },
            currentUser, addSystemLog
          });

          setEditingJobId(null);
        } else {
          const newDeliveryCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          savedDeliveryCode = newDeliveryCode; // Panelde göstermek/mesajda kullanmak için sakla
          
          for (let i = 0; i < duration; i++) {
            const jobDate = new Date(formData.date);
            jobDate.setDate(jobDate.getDate() + i);
            const dateStr = jobDate.toISOString().split('T')[0];

            const currentPrice = i === 0 ? jobData.price : '0';
            const currentDeposit = i === 0 ? jobData.deposit : '0';
            
            const primaryJob = { 
              ...jobData, 
              date: dateStr,
              price: currentPrice,
              deposit: currentDeposit,
              team: 'Atanmadı', 
              assignedPersonnelId: null, 
              assignedPersonnelIds: [], 
              teamNames: [], 
              status: 'pending', 
              endJobDetails: null,
              deliveryCode: newDeliveryCode,
              createdBy: currentUser?.fullName || 'Sistem',
              createdAt: new Date().toISOString()
            };
            const _yeniIsRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), primaryJob);
            // YENİ: Kapora girildiyse BANKA defterine gelir olarak yazılır.
            // Yalnızca kaporası olan ilk gün için çalışır: çok günlü kayıtlarda
            // 2. günden sonrası deposit '0' olarak açıldığı için kayıt atılmaz.
            // Hata fırlatmaz; defter kaydı başarısız olsa bile iş kaydı durur.
            if ((parseFloat(currentDeposit) || 0) > 0) {
              await defterKaporaKaydet({
                db, appId,
                job: { ...primaryJob, id: _yeniIsRef.id },
                currentUser, addSystemLog
              });
            }
            
            if(i === 0) {
              addSystemLog('Yeni İş Kaydı', `${formData.customerName} için ${duration} günlük yeni bir ${recordType} kaydı oluşturuldu.`);
            }

            if (recordType !== 'Asansör' && i === 0) {
              const createAsansor = async (sourceAddr, installType) => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), {
                  type: 'Asansör', customerType: formData.customerType, tcNo: formData.tcNo, taxNo: formData.taxNo, customerName: formData.customerName, customerPhone: formData.customerPhone, altPhone: formData.altPhone, date: dateStr, time: formData.time, price: '0', deposit: '0', deliveryCode: newDeliveryCode, contractDetails: 'Otomatik Oluşturulan Asansör Kurulum Kaydı', notes: '', team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [], status: 'pending', endJobDetails: null, createdBy: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString(), fromFloor: sourceAddr.floor, fromDistance: sourceAddr.distance, fromDistanceUnit: sourceAddr.distanceUnit, fromPacking: 'Kendi İşimiz', fromRoomCount: installType, fromProvince: sourceAddr.province || '', fromDistrict: sourceAddr.district || '', fromAddress: sourceAddr.address || '', toProvince: '', toDistrict: '', toAddress: '', toFloor: '', toRoomCount: '', toDistance: '', toDistanceUnit: '', extraLoadingAddresses: [], extraUnloadingAddresses: []
                });
              };

              if (formData.fromTransportMethod === 'Dış Cephe Asansörü') {
                await createAsansor({ floor: formData.fromFloor, distance: formData.fromDistance, distanceUnit: formData.fromDistanceUnit, province: formData.fromProvince, district: formData.fromDistrict, address: formData.fromAddress }, 'Yükleme Kurulum');
              }
              for (const addr of (formData.extraLoadingAddresses || [])) {
                if (addr.transportMethod === 'Dış Cephe Asansörü') await createAsansor(addr, 'Yükleme Kurulum');
              }
              if (formData.toTransportMethod === 'Dış Cephe Asansörü') {
                await createAsansor({ floor: formData.toFloor, distance: formData.toDistance, distanceUnit: formData.toDistanceUnit, province: formData.toProvince, district: formData.toDistrict, address: formData.toAddress }, 'Boşaltma Kurulum');
              }
              for (const addr of (formData.extraUnloadingAddresses || [])) {
                if (addr.transportMethod === 'Dış Cephe Asansörü') await createAsansor(addr, 'Boşaltma Kurulum');
              }
            }
          }
        }
        
        setFormData({
          isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', extraLoadingAddresses: [], selectedDepo: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', extraUnloadingAddresses: [], wallMounting: [], esyaDurumu: [], date: new Date().toISOString().split('T')[0], time: '09:00', durationDays: '1', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
        });
        // YENİ: Önceki takvim yönlendirmesi iptal edildi. Bunun yerine altta
        // "Müşteri Kaydınız Oluşturuldu" paneli açılır (WA bilgilendirme + sözleşme indirme seçenekli).
        setSavedNotified(false);    // Tik durumlarını sıfırla
        setSavedContractDl(false);
        setSavedJobInfo({ ...jobData, deliveryCode: savedDeliveryCode, wasEditing });
      } catch (err) { console.error(err); }
    };

    const generateTeamSuggestion = (job) => {
      let base = 4;
      const room = job.fromRoomCount || '';
      const isDepo = job.type === 'Depo';

      if (room.includes('1+0') || room.includes('Parça')) base = isDepo ? 2 : 3;
      else if (room.includes('1+1')) base = isDepo ? 3 : 4;
      else if (room.includes('2+1')) base = isDepo ? 4 : 5;
      else if (room.includes('3+1')) base = isDepo ? 5 : 6;
      else if (room.includes('4+1') || room.includes('Villa') || room.includes('Ofis')) base = isDepo ? 6 : 7;
      else base = isDepo ? 4 : 5;

      let targetCount = base;
      let notes = [];
      notes.push(`${room} ${job.type || 'Nakliye'} operasyonu taban ekip: ${base} kişi.`);

      if (job.fromPacking === 'Toplama Yapılacak') {
        targetCount += 1;
        notes.push("Firma toplaması olduğu için +1 kişi eklendi.");
      }

      const getFloorNum = (floorStr) => {
        if (!floorStr) return 0;
        const match = floorStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };

      const fromFloor = getFloorNum(job.fromFloor);
      const toFloor = getFloorNum(job.toFloor);

      if (job.fromTransportMethod === 'Merdiven' && fromFloor > 3) {
        targetCount += 1;
        notes.push(`Yükleme ${fromFloor}. Kat Merdiven olduğu için +1 kişi eklendi.`);
      }
      if (job.toTransportMethod === 'Merdiven' && toFloor > 3) {
        targetCount += 1;
        notes.push(`Boşaltma ${toFloor}. Kat Merdiven olduğu için +1 kişi eklendi.`);
      }

      const isHighValue = parseInt(job.price || 0) > 25000;
      if (isHighValue) {
        notes.push("Yüksek bütçeli iş: Daha çok yorum alan tecrübeli ekiplere öncelik verildi.");
      }

      const busyIds = jobs.filter(j => j.date === job.date && j.id !== job.id && j.status !== 'cancelled')
                          .flatMap(j => j.assignedPersonnelIds || []);

      const personnelScores = {};
      personnelList.forEach(p => personnelScores[p.id] = 0);
      
      jobs.filter(j => j.status === 'completed' && j.pointsApproved).forEach(j => {
          (j.assignedPersonnelIds || []).forEach(id => {
              if(personnelScores[id] !== undefined) personnelScores[id] += 1;
          });
      });
      
      let available = personnelList.filter(p => !busyIds.includes(p.id) && ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(p.position));

      available.sort((a, b) => {
         const rankWeight = { 'Müdür': 5, 'Ekip Şefi': 4, 'Heryerden Usta': 3, 'Kalfa': 3, 'Asistan': 2, 'Standart': 1 };
         let scoreA = rankWeight[a.rank] || 0;
         let scoreB = rankWeight[b.rank] || 0;
         
         if (isHighValue) {
             scoreA += (personnelScores[a.id] || 0) * 2;
             scoreB += (personnelScores[b.id] || 0) * 2;
         }

         return scoreB - scoreA;
      });

      const suggested = [];
      
      const soforIdx = available.findIndex(p => p.position === 'Şoför');
      if (soforIdx > -1) suggested.push(available.splice(soforIdx, 1)[0]);

      const ustaIdx = available.findIndex(p => p.position === 'Mobilya Ustası');
      if (ustaIdx > -1) suggested.push(available.splice(ustaIdx, 1)[0]);

      if (suggested.length > 0) {
          const anchorId = suggested[0].id;
          const synergyScores = {};
          jobs.filter(j => j.status === 'completed' && j.assignedPersonnelIds?.includes(anchorId)).forEach(j => {
              j.assignedPersonnelIds.forEach(id => {
                  if (id !== anchorId) {
                      synergyScores[id] = (synergyScores[id] || 0) + 1;
                  }
              });
          });

          available.sort((a, b) => {
              const synA = synergyScores[a.id] || 0;
              const synB = synergyScores[b.id] || 0;
              return synB - synA; 
          });
      }

      while (suggested.length < targetCount && available.length > 0) {
         let nextIdx = available.findIndex(p => p.position === 'Şoför');
         if (nextIdx === -1) nextIdx = available.findIndex(p => p.position === 'Mobilya Ustası');
         if (nextIdx === -1) nextIdx = available.findIndex(p => p.position === 'Taşıma Elemanı');
         if (nextIdx === -1) nextIdx = 0;

         suggested.push(available.splice(nextIdx, 1)[0]);
      }

      let yevmiyeciCount = 1;
      while (suggested.length < targetCount) {
         suggested.push({ fullName: `Yevmiyeci ${yevmiyeciCount}`, position: 'Taşıma Elemanı', isExternal: true });
         yevmiyeciCount++;
      }

      return {
        targetCount,
        notes,
        suggested
      };
    };

    const handleOpenAssignModal = (job) => {
      setJobToAssign(job);
      setAssigneeId(job.assignedPersonnelId || '');
      setAssignedVehiclePlate(job.assignedVehiclePlate || '');
      setAssignOperationNote(job.notes || '');
      setAdditionalAssignees(job.assignedPersonnelIds ? job.assignedPersonnelIds.filter(id => id !== job.assignedPersonnelId) : []);
      
      setAssignedTargetVehiclePlate(job.assignedTargetVehiclePlate || '');
      setIsTargetVehicleExternal(job.isTargetVehicleExternal || false);
      setAssignedJobTime(job.assignedJobTime || job.time || '');

      let manual = [];
      if (job.teamNames && job.teamNames.length > 0) {
        const systemNames = personnelList.filter(p => job.assignedPersonnelIds?.includes(p.id)).map(p => p.fullName);
        manual = job.teamNames.filter(name => !systemNames.includes(name));
      }
      setManualExtraAssignees(manual);

      const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking, job.type);
      setAssignedMaterials({
        strec: est.strec || 0,
        bant: est.bant || 0,
        poset: est.poset || 0,
        kagit: est.kagit || 0,
        koli: est.koli || 0,
        // Depo patpatı yalnızca depo işlerinde taşınır
        ...(job.type === 'Depo' ? { depoPatpati: est.depoPatpati || 0 } : {})
      });
      setCustomMaterials(job.customMaterials || []);
      setNewCustomMaterial({ name: '', amount: 1 });
      setShowBusyPersonnel(false);
      setTeamSuggestion(null);

      setShowAssignModal(true);
    };

    const submitAssignJob = async (e) => {
      e.preventDefault();
      if(!assigneeId || !firebaseUser) return;
      const mainPerson = personnelList.find(p => String(p.id) === String(assigneeId));
      if(!mainPerson) return;

      const additionalPersons = personnelList.filter(p => additionalAssignees.includes(p.id));
      const allAssignedIds = [mainPerson.id, ...additionalPersons.map(p => p.id)];
      const manualNames = manualExtraAssignees.map(n => n.trim()).filter(n => n !== '');
      const allNames = [mainPerson.fullName, ...additionalPersons.map(p => p.fullName), ...manualNames];

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToAssign.id), {
        assignedPersonnelId: mainPerson.id, 
        assignedPersonnelIds: allAssignedIds, 
        teamNames: allNames, 
        team: allNames.join(', '), 
        assignedVehiclePlate: assignedVehiclePlate, 
        status: 'in-progress', 
        assignedDate: jobToAssign.assignedDate || new Date().toISOString().split('T')[0],
        assignedMaterials: assignedMaterials,
        customMaterials: customMaterials,
        notes: assignOperationNote,
        assignedTargetVehiclePlate: jobToAssign.type === 'Asansör' ? assignedTargetVehiclePlate : null,
        isTargetVehicleExternal: jobToAssign.type === 'Asansör' ? isTargetVehicleExternal : null,
        assignedJobTime: jobToAssign.type === 'Asansör' ? assignedJobTime : null
      });
      
      const notifsCol = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
      const assignDateStr = new Date().toISOString().split('T')[0];
      for (const userId of allAssignedIds) {
        await addDoc(notifsCol, {
          userId: userId, title: 'Yeni Görev Ataması', message: `${jobToAssign.customerName} operasyonu için görevlendirildiniz.`, date: new Date().toLocaleString('tr-TR'), read: false,
          type: 'assignment', assignedDate: assignDateStr, jobDate: jobToAssign.date
        });
      }

      try {
        const jobDateObj = new Date(jobToAssign.date);
        const y = jobDateObj.getFullYear();
        const m = jobDateObj.getMonth() + 1;
        const d = jobDateObj.getDate();

        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y}_${m}`);
        const mesaiSnap = await getDoc(mesaiRef);
        let mesaiRecords = mesaiSnap.exists() ? mesaiSnap.data().records : {};

        let updated = false;
        allAssignedIds.forEach(pId => {
          const p = personnelList.find(pers => pers.id === pId);
          if (p && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))) {
            if (!mesaiRecords[pId]) mesaiRecords[pId] = {};
            const currentStatusObj = mesaiRecords[pId][d];
            const currentStatus = typeof currentStatusObj === 'object' && currentStatusObj !== null ? currentStatusObj.status : currentStatusObj;
            
            if (!currentStatus) {
              mesaiRecords[pId][d] = { status: jobDateObj.getDay() === 0 ? 'FGM' : 'G', hours: '' };
              updated = true;
            }
          }
        });

        if (updated) {
          await setDoc(mesaiRef, { records: mesaiRecords, updatedAt: new Date().toISOString() }, { merge: true });
        }
      } catch (err) {
        console.error("Otomatik mesai güncelleme hatası:", err);
      }
      
      setShowAssignModal(false); setJobToAssign(null); setAssigneeId(''); setAdditionalAssignees([]); setManualExtraAssignees([]); setAssignedVehiclePlate(''); setTeamSuggestion(null);
    };

    const handleAddManualAssignee = () => setManualExtraAssignees([...manualExtraAssignees, '']);
    const handleManualAssigneeChange = (index, value) => {
      const updated = [...manualExtraAssignees]; updated[index] = value; setManualExtraAssignees(updated);
    };
    const handleRemoveManualAssignee = (index) => setManualExtraAssignees(manualExtraAssignees.filter((_, i) => i !== index));

    const submitRemoveAssignment = async () => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToAssign.id), {
        assignedPersonnelId: null, 
        assignedPersonnelIds: [], 
        teamNames: [], 
        team: 'Atanmadı', 
        assignedVehiclePlate: '', 
        status: jobToAssign.status === 'completed' ? 'completed' : 'pending', 
        assignedDate: null,
        assignedMaterials: null,
        customMaterials: [],
        assignedTargetVehiclePlate: null,
        isTargetVehicleExternal: null,
        assignedJobTime: null
      });
      setShowAssignModal(false); setJobToAssign(null); setAssigneeId(''); setAdditionalAssignees([]); setManualExtraAssignees([]); setAssignedVehiclePlate(''); setTeamSuggestion(null);
    };

    const handleOpenEndJobModal = (job) => {
      setJobToEnd(job);
      setEndJobError('');
      setEndJobKaydediliyor(false); // Mükerrer-önleme kilidi her açılışta sıfırlanır
      setEndJobData({ 
        paymentMethod: 'Banka', // DEĞİŞTİ: varsayılan Banka — listede de ilk seçenek damageStatus: 'Hasarsız teslim edildi', damageDetails: '', damageImages: [], truckImages: [], deliveryImages: [], truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Herhangi bir işlem yapmadı.', enteredCode: '',
        elevatorSetup: 'Evet', elevatorSetupReason: '', elevatorImages: [], elevatorIssue: 'Hayır', elevatorIssueReason: '', vehicleIssue: 'Hayır', vehicleIssueReason: '',
        // YENİ: İş zaten sonlandırılmışsa (düzenleme modu) önceki sonlandırma bilgilerini forma doldur.
        // Yeni/devam eden işlerde job.endJobDetails boş olduğu için varsayılanlar aynen kalır.
        ...(job.endJobDetails || {})
      });
      setShowEndJobModal(true);
    };

    // YENİ: Sonlandırma ekranındaki görsel alanları. 'delivery' = Teslim Edilen Yer fotoğrafları.
    const END_JOB_GORSEL_ALANI = { truck: 'truckImages', delivery: 'deliveryImages', elevator: 'elevatorImages', damage: 'damageImages' };

    // YENİ: Artık BİRDEN FAZLA fotoğraf/video aynı anda seçilip yüklenebilir.
    // Dosyalar sırayla yüklenir; her biri yüklenirken listede "Yükleniyor..." görünür.
    const handleFileUpload = async (e, type) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const alan = END_JOB_GORSEL_ALANI[type] || 'damageImages';

      for (const file of files) {
        setEndJobData(prev => ({ ...prev, [alan]: [...(prev[alan] || []), 'Yükleniyor...'] }));

        const formData = new FormData();
        formData.append('file', file);

        try {
          const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', {
            method: 'POST',
            body: formData,
          });
          const text = await res.text();
          let uploadedUrl = file.name;
          try {
            const json = JSON.parse(text);
            uploadedUrl = json.url || json.fileName || json.file || text;
          } catch (err) {
            uploadedUrl = text.trim();
          }
          setEndJobData(prev => ({ ...prev, [alan]: (prev[alan] || []).map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        } catch (err) {
          console.error("Yükleme hatası:", err);
          setEndJobData(prev => ({ ...prev, [alan]: (prev[alan] || []).map(img => img === 'Yükleniyor...' ? file.name : img) }));
        }
      }
    };

  const submitEndJob = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      // MÜKERRER-ÖNLEME: işlem zaten sürüyorsa (ör. butona hızlı art arda
      // dokunuldu) ikinci çağrı burada durdurulur; deftere kopya kayıt düşmez.
      if (endJobKaydediliyor) return;
      setEndJobKaydediliyor(true);
      // Kilidin hangi çıkış yolundan (hatalı kod / hata fırlaması / başarı)
      // geçilirse geçilsin MUTLAKA açılması için tüm gövde try/finally içine alındı.
      try {

      if (jobToEnd.type !== 'Asansör') {
        const userCode = (endJobData.enteredCode || '').toString().trim().toUpperCase();
        const realCode = (jobToEnd.deliveryCode || '').toString().trim().toUpperCase();

        if (realCode && userCode !== realCode) {
          // GÜVENLİK: Hata mesajında gerçek teslim kodu ARTIK GÖSTERİLMEZ.
          // Aksi halde personel hiçbir şey girmeden "Doğrula" diyerek kodu
          // ekranda görüp müşteriye sormadan işi kapatabiliyordu.
          setEndJobError(userCode
            ? 'Girdiğiniz kod hatalı. Lütfen müşteriden aldığınız teslim kodunu kontrol edip tekrar deneyin.'
            : 'Lütfen müşteriden 6 haneli teslim kodunu isteyip yukarıdaki alana girin.');
          return;
        }
      }

      setEndJobError('');

      if (!jobToEnd.materialsDeducted && jobToEnd.type !== 'Asansör') {
        const estData = jobToEnd.assignedMaterials || calculateMaterials(jobToEnd.fromRoomCount, jobToEnd.fromPacking, jobToEnd.type);
        const customMats = jobToEnd.customMaterials || [];
        let deductedList = [];

        const norm = (s) => (s || '').toLocaleLowerCase('tr-TR');
        const materialTypes = [
          { key: 'streç', amount: estData.strec || 0 },
          { key: 'bant', amount: estData.bant || 0 },
          { key: 'poşet', amount: estData.poset || 0 },
          { key: 'kağıt', amount: estData.kagit || 0 },
          { key: 'koli', amount: estData.koli || 0 },
          // YENİ: Depo patpatı YALNIZCA depo işlerinde stoktan düşülür.
          // (calculateMaterials bu kalemi zaten sadece jobType==='Depo' iken üretir;
          //  ayrıca burada da iş tipi kontrol edilerek çift güvence sağlanır.)
          { key: 'patpat', amount: (jobToEnd.type === 'Depo' ? (estData.depoPatpati || 0) : 0) }
        ];

        // YENİ: Aynı malzeme birden fazla kez düşülecekse TEK kalemde toplanır.
        // Böylece stok hareketi kaydında "7 Adet Koli, 7 Adet Koli, ..." gibi
        // tekrar eden uzun listeler oluşmaz.
        const toplamlar = new Map(); // materialId -> { target, miktar }

        for (const mt of materialTypes) {
          const target = materials.find(m => norm(m.name).includes(mt.key));
          if (!target) continue;

          let deductAmount = mt.amount;
          const cMat = customMats.find(cm => norm(cm.name).includes(mt.key));
          if (cMat) deductAmount += parseFloat(cMat.amount) || 0;

          if (deductAmount > 0) {
            const mevcut = toplamlar.get(target.id);
            if (mevcut) mevcut.miktar += deductAmount;
            else toplamlar.set(target.id, { target, miktar: deductAmount });
          }
        }

        for (const { target, miktar } of toplamlar.values()) {
          const yuvarlanmis = Math.round(miktar * 100) / 100; // ondalık artıkları temizle
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', target.id), { stock: String((parseFloat(target.stock) || 0) - yuvarlanmis) });
          deductedList.push(`${yuvarlanmis} ${target.unit} ${target.name}`);
        }
        
        if (deductedList.length > 0) {
           addSystemLog('Stok Çıkışı (Oto)', `${jobToEnd.customerName} operasyonu sonlandırıldığı için malzemeler düşüldü: ${deductedList.join(', ')}`);
        } else {
           addSystemLog('Stok Çıkışı (Oto)', `${jobToEnd.customerName} operasyonu sonlandırıldı (Düşülecek malzeme bulunamadı).`);
        }
      }

      // YENİ: İlk tamamlanma zamanını kaydediyoruz. 3 saatlik düzenleme penceresi bu zamandan
      // itibaren ölçülür. Sonradan düzenleyip tekrar kaydedildiğinde eski zaman korunur (süre uzamaz).
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToEnd.id), { status: 'completed', endJobDetails: endJobData, materialsDeducted: true, completedAt: jobToEnd.completedAt || new Date().toISOString() });

      // YENİ: İş kapandığında KAPORA HARİÇ KALAN BAKİYE ilgili deftere
      // "PARA GİRİŞİ (ALDIM)" olarak yazılır. Açıklamaya araç plakası eklenir.
      // Hangi deftere gideceği ödeme yöntemine göre belirlenir (Nakit->Kasa,
      // Havale/EFT->Banka, Kredi Kartı->Kredi Kartı, Ödeme Yapmadı->Borçlu).
      // Bu çağrı işin kapanmasından SONRA yapılır ve hata fırlatmaz; defter
      // kaydı başarısız olsa bile iş kapanmış kalır.
      // YENİ: Ekip şefi adı ve araç kimliği burada çözülüp geçiriliyor.
      // shared.jsx'in personel/araç listelerine erişimi yok; çözümleme burada
      // yapılmalı. Plaka karşılaştırmasında boşluk ve harf büyüklüğü normalleştirilir.
      const _plakaTemiz = (x) => (x || '').toString().replace(/\s/g, '').toUpperCase();
      const _ekipSefi = personnelList.find(pp => pp.id === jobToEnd.assignedPersonnelId);
      const _arac = vehicles.find(v => _plakaTemiz(v.plate) === _plakaTemiz(jobToEnd.assignedVehiclePlate));
      await defterGelirKaydet({
        db, appId,
        job: { ...jobToEnd, completedAt: jobToEnd.completedAt || new Date().toISOString() },
        endJobDetails: endJobData,
        currentUser,
        addSystemLog,
        ekipSefiAdi: _ekipSefi?.fullName || '',
        ekipSefiId: _ekipSefi?.id || '',
        aracId: _arac?.id || ''
      });
      setShowEndJobModal(false); 
      setJobToEnd(null);
      } finally {
        // Başarı, erken çıkış veya hata — hepsinde kilit açılır ki
        // (bu iş için modal tekrar açılırsa) yeniden gönderim yapılabilsin.
        setEndJobKaydediliyor(false);
      }
    };

    const handleGenerateMessage = async (job) => {
      setAiModal({ isOpen: true, loading: true, content: '', title: 'Müşteri Mesajı Hazırla', type: 'message' });
      try {
        const prompt = `Sen Sembol Nakliyat firmasının kurumsal asistanısın. Müşteri: ${job.customerName}, Tarih: ${job.date} ${job.time}, Güzergah: ${job.fromProvince}/${job.fromDistrict} -> ${job.toProvince ? job.toProvince + '/' + job.toDistrict : 'belirtilmemiş'}. Onay ve bilgilendirme WhatsApp mesajı oluştur.`;
        const resText = await callGeminiAPI(prompt, false);
        setAiModal(prev => ({ ...prev, loading: false, content: resText }));
      } catch (e) { setAiModal(prev => ({ ...prev, loading: false, content: 'Hata oluştu.' })); }
    };

    const handleEstimateMaterials = (job) => {
      const est = calculateMaterials(job.fromRoomCount, job.fromPacking, job.type);
      const content = `Tahmini Gerekli Malzemeler:\n\n- ${est.strec} Rulo Streç\n- ${est.bant} Adet Bant\n- ${est.poset} Adet Poşet\n- ${est.kagit} Kg Kağıt\n- ${est.koli} Adet Koli${job.type === 'Depo' && est.depoPatpati ? `\n- ${est.depoPatpati} Adet Depo Patpatı` : ''}`;
      setAiModal({ isOpen: true, loading: false, content, title: '📦 Malzeme Tahmini', type: 'material', jobId: job.id, estData: est, alreadyDeducted: job.materialsDeducted });
    };

    const handleDeductMaterials = async () => {
      const { jobId, estData } = aiModal;
      if (!estData || !jobId || !firebaseUser) return;

      const job = jobs.find(j => j.id === jobId);
      const customMats = job?.customMaterials || [];
      const actualEst = job?.assignedMaterials || estData;
      let deductedList = [];

      const norm = (s) => (s || '').toLocaleLowerCase('tr-TR');
      const materialTypes = [
        { key: 'streç', amount: actualEst.strec || 0 },
        { key: 'bant', amount: actualEst.bant || 0 },
        { key: 'poşet', amount: actualEst.poset || 0 },
        { key: 'kağıt', amount: actualEst.kagit || 0 },
        { key: 'koli', amount: actualEst.koli || 0 }
      ];

      for (const mt of materialTypes) {
        const target = materials.find(m => norm(m.name).includes(mt.key));
        if (!target) continue;

        let deductAmount = mt.amount;
        const cMat = customMats.find(cm => norm(cm.name).includes(mt.key));
        if (cMat) deductAmount += parseFloat(cMat.amount) || 0;

        if (deductAmount > 0) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', target.id), { stock: String((parseFloat(target.stock) || 0) - deductAmount) });
          deductedList.push(`${deductAmount} ${target.unit} ${target.name}`);
        }
      }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobId), { materialsDeducted: true });
      setAiModal({ ...aiModal, alreadyDeducted: true, content: aiModal.content + '\n\n✅ Malzemeler stoktan başarılı bir şekilde düşüldü.' });
      
      if (deductedList.length > 0) {
         addSystemLog('Stok Çıkışı', `${job?.customerName || 'Manuel'} operasyonu için malzeme düşüldü: ${deductedList.join(', ')}`);
      } else {
         addSystemLog('Stok Çıkışı', `Manuel onay ile operasyon için malzeme stoktan düşüldü.`);
      }
    };

    const handleGenerateDailySummary = async (jobsList) => {
      setAiModal({ isOpen: true, loading: true, content: '', title: '✨ Yapay Zeka Sabah Brifingi', type: 'summary' });
      try {
        const pendingCount = jobsList.filter(j => j.status === 'pending').length;
        const inProgressCount = jobsList.filter(j => j.status === 'in-progress').length;
        const prompt = `Sembol Nakliyat'ın yapay zeka müdürüsün. Sistemde bugün toplam ${jobsList.length} kayıtlı iş var. ${pendingCount} bekliyor, ${inProgressCount} sürüyor. Ekibine güne başlarken gönderebileceğin, onları motive edecek kısa (max 3 cümle) bir sabah brifingi yaz.`;
        const resText = await callGeminiAPI(prompt, false);
        setAiModal(prev => ({ ...prev, loading: false, content: resText }));
      } catch (e) { setAiModal(prev => ({ ...prev, loading: false, content: 'Hata oluştu.' })); }
    };

    const handleLogin = async (email, password, rememberMe) => {
      // YENİ: Açılış animasyonu kaldırıldığı için giriş ekranı, personel
      // listesi arka planda yüklenmeden önce de görünür durumda. Liste henüz
      // gelmemişken deneme yapılırsa kullanıcıya "şifre hatalı" demek yanlış
      // olur; bunun yerine kısa bir bekleme uyarısı gösterilir.
      if (!personnelList || personnelList.length === 0) {
        setLoginError('Sistem hazırlanıyor, lütfen 1-2 saniye sonra tekrar deneyin.');
        return;
      }
      const normalizeStr = (str) => (str || '').toString().trim().toLocaleLowerCase('tr-TR');
      const loginInput = normalizeStr(email);
      
      const user = personnelList.find(p => {
        const pEmail = normalizeStr(p.email);
        const pName = normalizeStr(p.fullName);
        return (pEmail === loginInput || pName === loginInput) && String(p.password) === String(password);
      });

      if (user) {
        if (user.employmentStatus === 'Pasif') {
           setLoginError('Hesabınız pasife alınmıştır. Sisteme erişim yetkiniz bulunmuyor.');
           return;
        }

        if (user.permissions && user.permissions.canView === false) {
           setLoginError('Sisteme giriş yetkiniz kapatılmıştır. Lütfen yöneticinizle iletişime geçin.');
           return;
        }

        setCurrentUser(user); setIsAuthenticated(true); setLoginError('');
        if (rememberMe) try { localStorage.setItem('sembol_crm_user', JSON.stringify({ email, password })); } catch (e) { }
        else try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}

        try {
          const nowStr = new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(user.id)), {
            lastLogin: nowStr
          });
        } catch (err) { console.error("Son giriş tarihi güncellenemedi:", err); }
      } else setLoginError('Kullanıcı adı / E-posta veya şifre hatalı.');
    };

    const handleLogout = () => {
      setIsAuthenticated(false); setCurrentUser(null); setActiveTab('dashboard'); setIsSidebarOpen(false);
      // YENİ: Çıkışta saklanan aktif sekme temizlenir; sonraki girişte anasayfadan başlanır
      try { sessionStorage.removeItem('sembolAktifSekme'); } catch (e) {}
      try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
    };

    const allDataLoaded = Object.values(dataLoadStatus).every(v => v === true);

    // ========================================================================
    // KALDIRILDI: "SİSTEM YÜKLENİYOR..." AÇILIŞ ANİMASYONU (kullanıcı talebi)
    // ========================================================================
    // Eskiden burada, Firebase kimlik kontrolü ve kayıtlı oturumun geri
    // yüklenmesi sırasında logolu/animasyonlu siyah bir bekleme ekranı
    // gösteriliyordu. Artık uygulama beklemeden DOĞRUDAN giriş ekranını açar.
    // Notlar:
    //  • "Beni Hatırla" ile kayıtlı oturumu olanlarda giriş ekranı bir an
    //    görünüp otomatik girişle kapanabilir — animasyonun kaldırılmasının
    //    doğal sonucudur, hata değildir.
    //  • Personel listesi arka planda henüz yüklenmemişken giriş denenirse
    //    handleLogin "Sistem hazırlanıyor..." uyarısı verir (aşağıda eklendi),
    //    yanlış yere "şifre hatalı" denmez.
    // ========================================================================

    if (!isAuthenticated) {
      return <LoginScreen onLogin={handleLogin} error={loginError} appBranding={appBranding} />;
    }

    if (currentUser?.employmentStatus === 'Pasif') {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 animate-in fade-in text-white">
          <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
          <h1 className="text-2xl font-black mb-2 text-center text-white">Hesabınız Pasife Alınmıştır</h1>
          <p className="text-neutral-400 text-center mb-6">Sisteme erişim yetkiniz sonlandırılmıştır. Lütfen yöneticinizle iletişime geçin.</p>
          <button onClick={handleLogout} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-600/30">Çıkış Yap</button>
        </div>
      );
    }

    // KALDIRILDI: "BULUT VERİLERİ EŞİTLENİYOR..." tam ekran beklemesi.
    // Eskiden 12 koleksiyonun TAMAMI yüklenene kadar hiçbir şey gösterilmiyordu; iş
    // kaydı sayısı arttıkça bu bekleme uzuyordu. Artık uygulama anında açılıyor,
    // eşitleme sürerken sağ altta küçük bir bilgi rozeti gösteriliyor (aşağıda).

    const userPos = currentUser?.position || '';
    const isSuperAdmin = currentUser?.fullName === 'Sistem Yöneticisi' || userPos === 'Firma Sahibi';
    const canEdit = isSuperAdmin || currentUser?.permissions?.canEdit === true;
    
    const isSales = userPos.includes('Satış');
    const isMuhasebe = userPos.includes('Muhasebe');
    const isDepo = userPos.includes('Depo Sorumlusu') || userPos.includes('Depo');
    
    const isManager = userPos.includes('Yönetici') || userPos.includes('Firma Sahibi') || currentUser?.rank === 'Müdür' || canEdit;

    const canApprovePoints = userPos.includes('Operasyon') || userPos === 'Firma Sahibi' || canEdit;

    const hasJobAccess = canEdit || isManager || isMuhasebe || isDepo;
    const hasResourceAccess = isManager || isMuhasebe || canEdit;
    const hasTaskAccess = isManager || canEdit;
    const hasOperasyonAccess = isManager || currentUser?.position?.includes('Operasyon') || canEdit;
    
    const checkAccess = (key) => {
      if (currentUser?.employmentStatus === 'Pasif') return false;
      if (isSuperAdmin) return true;

      if (currentUser?.permissions?.modules && typeof currentUser.permissions.modules[key] === 'boolean') {
        return currentUser.permissions.modules[key];
      }

      const posAccess = positionModules?.[currentUser?.position];
      if (posAccess && typeof posAccess[key] === 'boolean') return posAccess[key];
      
      const rankAccess = positionModules?.[currentUser?.rank];
      if (rankAccess && typeof rankAccess[key] === 'boolean') return rankAccess[key];
      
      return false;
    };

    const showDashboard = checkAccess('dashboard');
    const showCalendar = checkAccess('calendar');
    const showProfileSettings = checkAccess('profileSettings');
    const showAddInfo = checkAccess('addInfo');
    const showMySpecialTasks = checkAccess('mySpecialTasks');
    const showAddJob = checkAccess('addJob');
    // ========================================================================
    // YENİ (kullanıcı talebi): SATIŞ ALT SAYFA YETKİLERİ
    // ------------------------------------------------------------------------
    // Kural 1: Üst "Satış Bölümü" (addJob) yetkisi YOKSA, hiçbir alt sayfa
    //          görünmez (alt sayfa yetkisi açık olsa bile). Alt sayfa üst
    //          bölümün içindedir; bölüme erişimi olmayan alt sayfayı da görmez.
    // Kural 2: addJob VARSA: alt sayfa yetkisi kişiye özel olarak açıkça
    //          BELİRTİLMİŞSE o değer geçerlidir (açık/kapalı). BELİRTİLMEMİŞSE
    //          üst bölüm yetkisini miras alır (varsayılan: görünür). Böylece
    //          mevcut kullanıcılar bozulmaz; yönetici yalnızca kısmak istediği
    //          alt sayfayı Yetkilendirme'den kapatır.
    // ========================================================================
    const altSatisErisimi = (altKey) => {
      if (!showAddJob) return false; // üst bölüm kapalıysa alt sayfalar da kapalı
      // Kişiye özel açık bir tercih varsa ona uy
      if (currentUser?.permissions?.modules && typeof currentUser.permissions.modules[altKey] === 'boolean') {
        return currentUser.permissions.modules[altKey];
      }
      // Pozisyon/rütbe seviyesinde tanımlıysa ona uy
      const posAccess = positionModules?.[currentUser?.position];
      if (posAccess && typeof posAccess[altKey] === 'boolean') return posAccess[altKey];
      const rankAccess = positionModules?.[currentUser?.rank];
      if (rankAccess && typeof rankAccess[altKey] === 'boolean') return rankAccess[altKey];
      // Hiç tanımlı değilse üst bölümü miras al (görünür)
      return true;
    };
    const showSatisMusteriKayit = altSatisErisimi('satisMusteriKayit');
    const showSatisMusteriHavuzu = altSatisErisimi('satisMusteriHavuzu');
    const showSatisSahaPortfoy = altSatisErisimi('satisSahaPortfoy');
    const showJobList = checkAccess('jobList');
    const showCustomers = checkAccess('customers');
    const showPersonnel = checkAccess('personnel');
    const showTodos = checkAccess('todos');
    const showOperasyon = checkAccess('operasyon');
    const showFinance = checkAccess('finance');
    const showAuth = checkAccess('auth');
    const showSystemFiles = checkAccess('systemFiles');
    const showMyComplaint = checkAccess('myComplaint');
    const showGlobalSearch = checkAccess('globalSearch');
    const showGlobalSearchCustomer = checkAccess('globalSearchCustomer');
    const showGlobalSearchVehicle = checkAccess('globalSearchVehicle');
    const showGlobalSearchPersonnel = checkAccess('globalSearchPersonnel');
    // YENİ: Dava Dosyaları modül yetkisi — Yetkilendirme'den kişiye/pozisyona göre açılıp kapatılır
    const showDavaDosyalari = checkAccess('davaDosyalari');
    // YENİ: Hatırlatmalar modül yetkisi. checkAccess varsayılan olarak false
    // döndüğü için bu bölüm BAŞLANGIÇTA HERKESTE KAPALIDIR; Yetkilendirme
    // ekranından kişiye/pozisyona göre açılır.
    const showHatirlatmalar = checkAccess('hatirlatmalar');
    // YENİ: Şirket İletişimi listesini düzenleme yetkisi.
    // Yöneticiler her zaman yetkilidir; ayrıca Yetkilendirme'den başka kişilere de verilebilir.
    const canManageContacts = isManager || checkAccess('companyContacts');
    // YENİ: Avukat pozisyonundaki kullanıcı tespiti — anasayfası tamamen kendine özel olur
    const isAvukatUser = (currentUser?.position || '').toLocaleLowerCase('tr').includes('avukat');
    // YENİ: Maaş/mesai/puantaj/muhasebe ekranlarına AVUKAT pozisyonu dahil edilmez.
    // Avukat, personel değerlendirme ve bordro süreçlerinin tamamen dışında tutulur.
    // MUHASEBE/PUANTAJ LİSTESİ: avukatlar zaten hariçti; artık ÇALIŞMA ŞEKLİ
    // "Uzaktan" olan herkes (danışman, firma sahibi vb.) de hariç tutulur.
    // Bu kişiler maaş / puantaj / mesai / prim süreçlerine dahil değildir.
    const personnelListMuhasebe = personnelList.filter(p =>
      !((p.position || '').toLocaleLowerCase('tr').includes('avukat')) && p.calismaSekli !== 'Uzaktan'
    );
    
    const isMaviYakaUser = currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position));
    const isStandardBlueCollarApp = isMaviYakaUser && currentUser?.rank !== 'Ekip Şefi' && currentUser?.rank !== 'Heryerden Usta' && currentUser?.rank !== 'Kalfa' && currentUser?.rank !== 'Müdür' && currentUser?.position !== 'Firma Sahibi' && !currentUser?.permissions?.canEdit;
    
    const myTasksForBadge = tasks.filter(t => t.assignee === currentUser?.fullName || t.assignee === 'Tüm Personeller');
    const unreadTasksCount = myTasksForBadge.filter(t => t.status !== 'completed').length;

    const generalTodoTasksCount = tasks.filter(t => t.status !== 'completed').length;
    const generalTodosCount = todos.filter(t => t.status !== 'completed').length;

    const todayStrApp = new Date().toISOString().split('T')[0];

    const unreadJobCount = jobs.filter(j => {
      const isMyJob = j.assignedPersonnelIds?.includes(currentUser?.id) || j.assignedPersonnelId === currentUser?.id;
      if (!isMyJob) return false;
      if (j.isHiddenFromTeam) return false;
      if (j.status !== 'pending' && j.status !== 'in-progress') return false;
      if (isStandardBlueCollarApp && j.date > todayStrApp) return false;
      return true;
    }).length;

    const visibleJobs = hasJobAccess ? jobs : jobs.filter(j => {
      const isMyJob = j.assignedPersonnelIds?.includes(currentUser?.id) || j.assignedPersonnelId === currentUser?.id;
      if (!isMyJob) return false;
      if (j.isHiddenFromTeam) return false;
      
      if (isStandardBlueCollarApp && j.date > todayStrApp) return false;

      if (j.status === 'completed') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const jobDate = new Date(j.date);
        jobDate.setHours(0, 0, 0, 0);
        
        if (jobDate < today) {
          return false;
        }
      }
      return true;
    });
    
    const visibleNotifications = notifications.filter(n => {
      if (n.userId !== currentUser?.id) return false;
      if (isStandardBlueCollarApp && n.type === 'assignment' && n.jobDate && n.jobDate > todayStrApp) {
        return false;
      }
      return true;
    });

    const unreadNotifCount = visibleNotifications.filter(n => !n.read).length;
    const totalUnreadCount = unreadNotifCount;

    let dueMaintenanceCount = 0;
    vehicles.forEach(v => {
        if (v.maintenanceRecords && Array.isArray(v.maintenanceRecords)) {
            v.maintenanceRecords.forEach(r => {
                let isDue = false;
                if (r.nextDate && r.nextDate <= todayStrApp) {
                    isDue = true;
                }
                if (r.nextKm && v.km && parseInt(v.km) >= parseInt(r.nextKm)) {
                    isDue = true;
                }
                if (isDue) {
                    dueMaintenanceCount++;
                }
            });
        }
    });

    // ========================================================================
    // YENİ: OPERASYON BAŞLIĞI TOPLAM BİLDİRİM SAYISI
    // "Operasyon" ana menü başlığındaki rozet, artık yalnızca araç bakımını
    // değil, ALT MENÜLERİNDEKİ TÜM BİLDİRİM SAYILARININ TOPLAMINI gösterir:
    //   • Hasarlı İşler   → çözülmemiş hasar kaydı sayısı
    //   • Görev Tahtası   → tamamlanmamış görev sayısı
    //   • Araç Bakım      → zamanı gelmiş bakım sayısı
    // Böylece menü kapalıyken bile içeride kaç iş beklediği tek bakışta görülür.
    // ========================================================================
    const unresolvedDamageCountTotal = jobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var' && !j.endJobDetails?.damageResolved).length;
    const operasyonToplamBildirim = unresolvedDamageCountTotal + generalTodoTasksCount + dueMaintenanceCount;

    // ========================================================================
    // YENİ: İNSAN KAYNAKLARI BAŞLIĞI TOPLAM BİLDİRİM SAYISI
    // "İnsan Kaynakları" ana menü başlığındaki rozet, alt menülerindeki tüm
    // bildirim sayılarının TOPLAMINI gösterir. Şu an İK altında bildirim
    // üreten tek bölüm "Şikayet Bildirimleri" (okunmamış şikayetler); ileride
    // başka bir alt menüye sayaç eklenirse buraya da eklenmesi yeterlidir.
    // Hatırlatmalar/Operasyon başlıklarıyla aynı görsel dili kullanır:
    // beyaz zemin+siyah yazı ile kırmızı zemin+beyaz yazı arasında yanıp söner.
    // ========================================================================
    const okunmamisSikayetSayisi = complaints.filter(c => !c.read).length;
    const insanKaynaklariToplamBildirim = okunmamisSikayetSayisi;



    return (
      <div className="flex h-screen bg-neutral-50 font-sans text-neutral-900 overflow-hidden">
        
        <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-black text-white flex items-center gap-2 px-3 z-30 shadow-md border-b border-red-600">
          <div className="flex items-center gap-2 shrink-0">
            <MarkaLogo
              logoUrl={appBranding?.logoUrl}
              className="w-auto object-contain max-w-[160px]"
              style={{ height: `${Math.min(48, 40 * ((appBranding?.logoSize || 100) / 100))}px` }}
              fallback={(
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded-lg font-black text-white">S</div>
                  <h1 className="font-bold text-lg">Sembol Nakliyat</h1>
                </div>
              )}
            />
          </div>

          {showGlobalSearch && (
          <div className="relative flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                // YENİ: Enter'a basınca, girilen metinle eşleşen ilk aracın profiline direkt git
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const norm = (s) => (s || '').toString().toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                  const q = norm(globalSearchQuery);
                  if (!q) return;
                  // YENİ: Enter'da önce TESLİM KODU denenir (3+ karakter).
                  // Eşleşme varsa doğrudan müşteri profiline gidilir.
                  if (q.length >= 3) {
                    const kodEslesme = jobs.find(j => j.deliveryCode && norm(j.deliveryCode) === q && j.customerPhone);
                    if (kodEslesme) {
                      setViewingCariKey(normalizeCariPhone(kodEslesme.customerPhone));
                      setActiveTab('customerProfile');
                      setGlobalSearchQuery('');
                      setIsSidebarOpen(false);
                      return;
                    }
                  }
                  if (!showGlobalSearchVehicle) return;
                  // Önce tam plaka eşleşmesi ara, yoksa plakası aramayı içeren ilk aracı al
                  const match = vehicles.find(v => norm(v.plate) === q) || vehicles.find(v => norm(v.plate).includes(q));
                  if (match) {
                    setViewingVehicleProfileId(match.id);
                    setActiveTab('vehicleProfile');
                    setGlobalSearchQuery('');
                    setIsSidebarOpen(false);
                  }
                }}
                placeholder="Araç, personel, müşteri ara..."
                className="w-full pl-9 pr-8 py-2 bg-white text-black border-2 border-red-500 ring-2 ring-red-500/30 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-600 transition"
              />
              {globalSearchQuery && (
                <button onClick={() => setGlobalSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {globalSearchQuery.trim() !== '' && (() => {
              const normalizeSearchStr = (s) => (s || '').toString().toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
              const q = normalizeSearchStr(globalSearchQuery);

              const vehicleResults = showGlobalSearchVehicle ? vehicles.filter(v => normalizeSearchStr(v.plate).includes(q) || normalizeSearchStr(v.type).includes(q)).slice(0, 5) : [];
              const personnelResults = showGlobalSearchPersonnel ? personnelList.filter(p =>
                normalizeSearchStr(p.fullName).includes(q) ||
                normalizeSearchStr(p.personalPhone).includes(q) ||
                normalizeSearchStr(p.companyPhone).includes(q)
              ).slice(0, 5) : [];
              const customerMap = new Map();
              if (showGlobalSearchCustomer) {
                jobs.forEach(j => {
                  if (!j.customerPhone) return;
                  const key = normalizeCariPhone(j.customerPhone);
                  if (!customerMap.has(key)) customerMap.set(key, { name: j.customerName, phone: j.customerPhone, cariKey: key });
                });
              }
              const customerResults = showGlobalSearchCustomer ? Array.from(customerMap.values()).filter(c =>
                normalizeSearchStr(c.name).includes(q) || normalizeSearchStr(c.phone).includes(q)
              ).slice(0, 5) : [];
              // ======================================================================
              // YENİ: TESLİM KODU İLE ARAMA
              // ======================================================================
              // Teslim kodu 6 haneli, benzersiz bir koddur; müşteri adı/telefon
              // yerine bu kodu bilen biri (örn. şoförle konuşan yönetici) direkt
              // o işin müşterisine ulaşabilsin diye eklendi. Kod tam olarak
              // eşleşen işin müşterisi bulunur ve normal müşteri sonucu gibi
              // "Cariye Git" ile profiline gidilir. En az 3 karakter yazılmadan
              // aranmaz — aksi halde her harf tüm işleri tarardı.
              // ======================================================================
              const deliveryCodeMatch = (showGlobalSearchCustomer && q.length >= 3)
                ? jobs.find(j => j.deliveryCode && normalizeSearchStr(j.deliveryCode) === q)
                : null;
              const deliveryCodeResult = (deliveryCodeMatch && deliveryCodeMatch.customerPhone) ? {
                name: deliveryCodeMatch.customerName,
                phone: deliveryCodeMatch.customerPhone,
                cariKey: normalizeCariPhone(deliveryCodeMatch.customerPhone),
                kod: deliveryCodeMatch.deliveryCode,
              } : null;
              const hasAnyResult = vehicleResults.length > 0 || personnelResults.length > 0 || customerResults.length > 0 || !!deliveryCodeResult;

              return (
                <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-red-500 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-[70vh] overflow-y-auto custom-scrollbar text-black">
                  {!hasAnyResult && (
                    <p className="p-5 text-sm text-neutral-500 text-center font-medium">Eşleşen araç, personel, müşteri veya teslim kodu bulunamadı.</p>
                  )}

                  {/* YENİ: TESLİM KODU EŞLEŞMESİ — bulunduysa en üstte, kendi
                      başlığıyla gösterilir; normal müşteri sonuçlarıyla karışmaz. */}
                  {deliveryCodeResult && (
                    <div className="p-3 border-b border-neutral-100 bg-emerald-50/40">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider px-2 mb-1.5">Teslim Kodu Eşleşmesi</p>
                      <button type="button" onClick={() => { setViewingCariKey(deliveryCodeResult.cariKey); setActiveTab('customerProfile'); setGlobalSearchQuery(''); setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">{(deliveryCodeResult.name || '?').charAt(0).toUpperCase()}</div>
                        <div className="flex-1"><span className="font-bold text-black text-sm block">{deliveryCodeResult.name}</span><span className="text-[10px] text-neutral-500">{deliveryCodeResult.phone} • Kod: {deliveryCodeResult.kod}</span></div>
                        <span className="text-[10px] font-bold text-emerald-700">Cariye Git →</span>
                      </button>
                    </div>
                  )}

                  {showGlobalSearchCustomer && customerResults.length > 0 && (
                    <div className="p-3 border-b border-neutral-100">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Müşteriler</p>
                      {customerResults.map((c, idx) => (
                        <button key={idx} type="button" onClick={() => { setViewingCariKey(c.cariKey); setActiveTab('customerProfile'); setGlobalSearchQuery(''); setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                          <div className="flex-1"><span className="font-bold text-black text-sm block">{c.name}</span><span className="text-[10px] text-neutral-500">{c.phone}</span></div>
                          <span className="text-[10px] font-bold text-orange-600">Cariye Git →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showGlobalSearchPersonnel && personnelResults.length > 0 && (
                    <div className="p-3 border-b border-neutral-100">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Personel</p>
                      {personnelResults.map(p => (
                        <button key={p.id} type="button" onClick={() => { setViewingPersonnelProfileId(p.id); setActiveTab('personnelProfile'); setGlobalSearchQuery(''); setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.profileImage ? <img src={p.profileImage} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-400" />}
                          </div>
                          <div className="flex-1"><span className="font-bold text-black text-sm block">{p.fullName}</span><span className="text-[10px] text-neutral-500">{p.position}</span></div>
                          <span className="text-[10px] font-bold text-orange-600">Profiline Git →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showGlobalSearchVehicle && vehicleResults.length > 0 && (
                    <div className="p-3">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Araçlar</p>
                      {vehicleResults.map(v => (
                        <button key={v.id} type="button" onClick={() => { setViewingVehicleProfileId(v.id); setActiveTab('vehicleProfile'); setGlobalSearchQuery(''); setIsSidebarOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Truck className="w-4 h-4" /></div>
                          <div className="flex-1"><span className="font-bold text-black text-sm block">{v.plate}</span><span className="text-[10px] text-neutral-500">{v.type}</span></div>
                          <span className="text-[10px] font-bold text-orange-600">Profiline Git →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          )}

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 hover:bg-neutral-800 rounded-lg transition shrink-0"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <div className="space-y-1.5"><div className="w-6 h-0.5 bg-white"></div><div className="w-6 h-0.5 bg-white"></div><div className="w-6 h-0.5 bg-white"></div></div>}
          </button>
        </div>

        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative top-0 left-0 z-40 w-64 md:min-w-[256px] bg-black text-white flex flex-col shadow-2xl shrink-0 h-full transition-transform duration-300 ease-in-out border-r border-neutral-800`}>
          <div className="p-6 flex flex-col items-center gap-2 border-b border-neutral-800 text-center">
            <MarkaLogo
              logoUrl={appBranding?.logoUrl}
              className="w-full object-contain mb-2"
              style={{ maxWidth: `${180 * ((appBranding?.logoSize || 100) / 100)}px` }}
              fallback={(
                <div className="flex items-center gap-4 mb-2">
                  <div className="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-full border-2 border-neutral-800/50 bg-red-600"><span className="font-black text-3xl text-white">S</span></div>
                  <div><h1 className="text-2xl font-black leading-tight text-white tracking-widest">SEMBOL</h1></div>
                </div>
              )}
            />
            <p className="text-red-600 text-[10px] font-bold mt-0.5 tracking-[0.2em] bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">OPERASYON MERKEZİ</p>
          </div>

          <div className="px-6 py-4 bg-neutral-900/50 border-b border-neutral-800 flex flex-col">
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2">Aktif Kullanıcı</span>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white font-bold overflow-hidden">
                    {currentUser?.profileImage ? (
                      <img src={currentUser.profileImage} alt={currentUser?.fullName} className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.fullName?.charAt(0)
                    )}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse absolute bottom-0 right-0 border-2 border-neutral-900"></div>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-white truncate">{currentUser?.fullName}</span>
                  <span className="text-[10px] text-neutral-400 truncate">{currentUser?.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* ========================================================
                    YENİ: YENİ PERSONEL — İŞ KILAVUZU DİKKAT IŞIĞI
                    İşe başlama tarihinden itibaren 1 AY boyunca (30 gün),
                    personelin kendi İş Kılavuzu simgesi dikkat çekici
                    şekilde yanıp söner — pozisyonuna göre hazırlanmış
                    kılavuzu okumasını hatırlatır. 30 gün dolunca buton
                    kendiliğinden normal görünümüne döner (aşağıdaki tarih
                    farkı hesabına göre).
                    ======================================================== */}
                {/* ==========================================================
                    DEĞİŞTİ (kullanıcı talebi): BU KISAYOL KİME GÖRE NE GÖSTERİR
                    ==========================================================
                    • MÜDÜR / FİRMA SAHİBİ  -> DEFTER kısayolu (kitap simgesi,
                      zümrüt yeşili, sürekli yanıp söner). En sık kullanılan
                      sayfa olduğu için isim satırının yanında hep elinin
                      altında durur. Bu kişilerde İş Kılavuzu simgesi GÖRÜNMEZ;
                      kılavuza gerektiğinde sol menüden ulaşılabilir.
                    • DİĞER PERSONEL        -> eskisi gibi İŞ KILAVUZU simgesi.
                    ========================================================== */}
                {(currentUser?.position === 'Firma Sahibi' || currentUser?.rank === 'Müdür') ? (
                  <button
                    onClick={() => { setActiveTab('finansDefter'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsFinanceSubMenuOpen(true); }}
                    className={`relative p-2 rounded-xl transition shrink-0 ${activeTab === 'finansDefter'
                      ? 'bg-emerald-600 text-white'
                      : 'defter-kisayol-yanson text-white'}`}
                    title="Defter — Kasa, cari ve borç/alacak takibi"
                  >
                    <BookOpen className="w-5 h-5" />
                  </button>
                ) : (
                <button
                  onClick={() => { setActiveTab('isKilavuzu'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`relative p-2 rounded-xl transition shrink-0 ${activeTab === 'isKilavuzu' ? 'bg-red-600 text-white' : (() => {
                    // İki durumda ikon kırmızı zeminle yanıp söner:
                    //  1) ÖZELLİK YENİ: İş Kılavuzu yayına alındıktan sonraki 30 gün
                    //     boyunca HERKESTE yanar (aşağıdaki KILAVUZ_YAYIN_TARIHI).
                    //  2) YENİ PERSONEL: işe başlayalı 30 günü geçmemiş personelde yanar.
                    const bugun00 = new Date().setHours(0, 0, 0, 0);
                    const gunFarki = (tarihStr) => {
                      const t = new Date(tarihStr + 'T00:00:00');
                      if (isNaN(t.getTime())) return null;
                      return Math.floor((bugun00 - t.getTime()) / (1000 * 60 * 60 * 24));
                    };
                    const ozellikGun = gunFarki(KILAVUZ_YAYIN_TARIHI);
                    const ozellikYeni = ozellikGun !== null && ozellikGun >= 0 && ozellikGun <= 30;
                    const personelGun = currentUser?.startDate ? gunFarki(currentUser.startDate) : null;
                    const personelYeni = personelGun !== null && personelGun >= 0 && personelGun <= 30;
                    return (ozellikYeni || personelYeni) ? 'yeni-personel-isik-yanson text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800';
                  })()}`}
                  title="İş Kılavuzu ve İş Şeması"
                >
                  <ClipboardList className="w-5 h-5" />
                  {/* YENİ rozeti: özellik yayına alındıktan sonraki 30 gün boyunca görünür */}
                  {(() => {
                    const t = new Date(KILAVUZ_YAYIN_TARIHI + 'T00:00:00');
                    if (isNaN(t.getTime())) return null;
                    const gun = Math.floor((new Date().setHours(0, 0, 0, 0) - t.getTime()) / (1000 * 60 * 60 * 24));
                    if (gun < 0 || gun > 30) return null;
                    return (
                      <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-pulse border border-yellow-500">
                        YENİ
                      </span>
                    );
                  })()}
                </button>
                )}
                <button 
                  onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`relative p-2 rounded-xl transition shrink-0 ${activeTab === 'notifications' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                  title="Bildirimler"
                >
                  <Bell className="w-5 h-5" />
                  {/* ============================================================
                      YENİ: Eskiden yalnızca küçük bir kırmızı nokta vardı.
                      Artık rozet bir SAYI gösterir ve yanıp söner.
                      Sayı = okunmamış bildirimler + BU KULLANICIYA ATANMIŞ,
                      henüz TAMAMLANMAMIŞ görevler.
                      Atanmış görev kısmı önemlidir: kullanıcı bildirimi okusa
                      bile, GÖREV TAMAMLANANA KADAR rozet yanıp sönmeye devam
                      eder — böylece iş unutulmaz.
                      ============================================================ */}
                  {(() => {
                    const zilSayisi = unreadNotifCount + atanmisGorevSayisi;
                    if (zilSayisi <= 0) return null;
                    return (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center">
                        <span className="relative flex w-4 h-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex items-center justify-center rounded-full w-4 h-4 bg-red-500 text-white text-[9px] font-black">{zilSayisi > 9 ? '9+' : zilSayisi}</span>
                        </span>
                      </span>
                    );
                  })()}
                </button>
              </div>
            </div>
          </div>
          
          <nav className="flex flex-col mt-4 px-4 gap-2 overflow-y-auto flex-1 pb-6 custom-scrollbar">
            
            {showDashboard && (
              <button 
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-black transition flex justify-start items-center gap-3 rounded-xl bg-gradient-to-r from-white via-neutral-100 to-neutral-300 text-black shadow-lg shadow-neutral-300/40 hover:scale-[1.02] ${activeTab === 'dashboard' ? 'ring-2 ring-black/70' : ''}`}
              >
                <Calendar className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Anasayfa</span>
              </button>
            )}
            
            {showCalendar && (
              <button 
                onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                // DEĞİŞİKLİK: Bu buton İKİ farklı isimle kullanılıyor —
                // Mavi Yaka'da "Puan Tablosu", Beyaz Yaka'da "Randevular".
                // İstek yalnızca Puan Tablosu içindi, bu yüzden renk isMaviYakaUser'a bağlandı:
                //   Mavi Yaka  -> SARI geçiş (yeni)
                //   Beyaz Yaka -> turkuaz geçiş (eskisi aynen korundu)
                // NOT: Ternary'nin her dalı TAM sınıf metni içerir; Tailwind sınıf adlarını
                // kaynak kodda birleştirilmemiş hâliyle taradığı için parça parça yazılmadı.
                className={`w-full py-3 px-4 text-sm font-black transition flex justify-start items-center gap-3 rounded-xl hover:scale-[1.02] ${isMaviYakaUser ? 'bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 shadow-lg shadow-yellow-400/40' : 'bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-500 shadow-lg shadow-teal-400/40'} ${activeTab === 'calendar' ? (isMaviYakaUser ? 'ring-2 ring-yellow-800/70' : 'ring-2 ring-teal-800/70') : ''}`}
              >
                <CalendarDays className="w-5 h-5 shrink-0 text-black" />
                {/* YENİ: Menü adı "Takvim" → "Randevular" olarak değiştirildi (sayfa/rota aynı)
                    YENİ: Yazı rengi siyah yapıldı (önceden beyazdı) */}
                {/* MAVİ YAKA'da bu sayfa puan takvimi olarak kullanıldığı için
                    menü adı "Puan Tablosu" olarak görünür. Sayfa/rota aynı. */}
                <span className="whitespace-nowrap font-black text-black">{isMaviYakaUser ? 'Puan Tablosu' : 'Randevular'}</span>
              </button>
            )}


            {showProfileSettings && (
              <button 
                onClick={() => { setActiveTab('profileSettings'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-[#8B5E34] via-[#B98A55] to-[#5C3B1E] text-white shadow-lg shadow-[#5C3B1E]/40 hover:scale-[1.02] ${activeTab === 'profileSettings' ? 'ring-2 ring-white/70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Profilim</span>
                </div>
                {/* YENİ: "Özel Görevlerim" artık Profilim sayfasının içinde; yeni/bitmemiş
                    görev varsa burada yanıp sönen ışık ve sayı rozeti gösterilir. */}
                {/* DEĞİŞİKLİK: Işık artık "mySpecialTasks" modül yetkisine bağlı DEĞİL.
                    Görev kişiye atandıysa yetki ayarından bağımsız olarak uyarı görünür;
                    tek koşul bitmemiş görev sayısının 0'dan büyük olmasıdır. Böylece tüm
                    görevler "completed" olduğunda unreadTasksCount 0'a düşer ve ışık söner. */}
                {unreadTasksCount > 0 && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    {/* GÖREV SAYISI KADAR IŞIK: her bitmemiş görev için bir yanıp sönen nokta
                        basılır. Sol menü dar olduğu için en fazla 4 nokta gösterilir; gerçek
                        sayı zaten yanındaki rozette yazar. animationDelay ile noktalar sırayla
                        yanar, hepsi aynı anda değil (daha okunaklı bir uyarı efekti). */}
                    <span className="flex items-center gap-1">
                      {Array.from({ length: Math.min(unreadTasksCount, 4) }).map((_, i) => (
                        <span key={i} className="relative flex w-2.5 h-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" style={{ animationDelay: `${i * 250}ms` }}></span>
                          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-red-500"></span>
                        </span>
                      ))}
                    </span>
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{unreadTasksCount}</span>
                  </span>
                )}
              </button>
            )}

            {/* ================================================================
                YENİ: HATIRLATMALAR — Profilim'in hemen altında.
                Takvim mantığıyla görev/not takibi (bkz. Operasyon.jsx).
                YENİ: Artık "Randevular" (Takvim) butonuyla aynı çerçeve
                mantığında, HER ZAMAN GÖRÜNÜR bordo (koyu kırmızı) renk
                geçişli bir arka plana sahip. Bekleyen hatırlatma varsa
                (bugünkü + geciken) daha canlı kırmızıya döner ve ismin
                yanında yanıp sönen bildirim ışığı + sayı rozeti görünür;
                seçili sekmedeyken tek renk kırmızıya döner.
                ================================================================ */}
            {/* YETKİ: Hatırlatmalar artık modüler yetkiye bağlı. Yetkisi olmayan
                kullanıcıda bu buton hiç görünmez (başlangıçta herkeste kapalı). */}
            {showHatirlatmalar && (
            <button
              onClick={() => { setActiveTab('hatirlatmalar'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
              className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl ${
                activeTab === 'hatirlatmalar'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : hatirlatmaBildirim > 0
                    ? 'bg-red-50 text-red-700 border-2 border-red-300 shadow-sm hover:border-red-500'
                    : 'bg-gradient-to-r from-red-950 via-red-900 to-red-800 text-white shadow-lg shadow-red-900/40 hover:scale-[1.02]'
              }`}
            >
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Hatırlatmalar</span>
              </div>
              {hatirlatmaBildirim > 0 && (
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="relative flex w-2.5 h-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-red-500"></span>
                  </span>
                  {/* YENİ: Rozet artık sabit kırmızı değil; beyaz zemin+siyah yazı ile
                      kırmızı zemin+beyaz yazı arasında geçiş yaparak yanıp söner. */}
                  <span className="menu-rozet-yansonen text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border border-red-300">{hatirlatmaBildirim}</span>
                </span>
              )}
            </button>
            )}

            {/* NOT: "Bilgilendirme Ekle" sol menüden kaldırıldı — artık Bildirim Merkezi'nin
                (Bell simgesi) sağ üstünde buton olarak erişiliyor. Sayfa rotası (activeTab
                === 'addInfo') aynen duruyor, sadece menüdeki kısayol kaldırıldı. */}

            {/* NOT: "Özel Görevlerim" ayrı bir sol menü öğesi olmaktan çıkarıldı;
                artık "Profilim" sayfasının içinde bir bölüm olarak gösteriliyor
                (bkz. ProfileSettingsView). Sayfa rotası (activeTab === 'mySpecialTasks')
                geriye dönük uyumluluk için hâlâ mevcut. */}

{isMaviYakaUser && (
                <button 
                  onClick={() => { setActiveTab('myAssignedJobs'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  // DEĞİŞİKLİK: Buton artık "Profilim" ile BİREBİR AYNI yapıda; tek fark renk paleti.
                  // Profilim kahverengi geçiş kullanır (from-[#8B5E34] via-[#B98A55] to-[#5C3B1E]);
                  // burada aynı üç duraklı yapı MAVİ tonlarıyla kuruldu.
                  // font-black + shadow-lg + hover:scale-[1.02] ve aktifken ring-2 ring-white/70
                  // değerleri Profilim butonundan aynen alındı ki iki buton görsel olarak eş dursun.
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-[#1D4ED8] via-[#60A5FA] to-[#1E3A8A] text-white shadow-lg shadow-[#1E3A8A]/40 hover:scale-[1.02] ${activeTab === 'myAssignedJobs' ? 'ring-2 ring-white/70' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* DEĞİŞİKLİK: Sol menü etiketi "Bana Atanan Görevler" -> "Bana Atanan İşler".
                        Sadece görünen yazı değişti; activeTab anahtarı ('myAssignedJobs') ve
                        yönlendirme mantığı aynı kaldı, hiçbir rota bozulmadı. */}
                    <ClipboardList className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Bana Atanan İşler</span>
                  </div>
                  {unreadJobCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{unreadJobCount}</span>
                  )}
                </button>
            )}

            {/* TAŞINDI (kullanıcı talebi): FİNANS menüsü artık SATIŞ'ın ÜSTÜNDE.
                Günlük kullanım sırası bu şekilde daha akıcı. */}
            {showFinance && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsFinanceSubMenuOpen(!isFinanceSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsAddJobSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-600/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Finans</span>
                  </div>
                  {isFinanceSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isFinanceSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {/* ==========================================================
                        TAŞINDI + ÖNE ÇIKARILDI (kullanıcı talebi):
                        Defter, alt menünün EN ÜSTÜNE alındı ve diğerlerinden
                        görsel olarak ayrıldı — en sık kullanılan sayfa olduğu için:
                          • Küçük nokta yerine DEFTER SİMGESİ (BookOpen)
                          • Kendi çerçevesi ve hafif zümrüt zemini
                          • Seçiliyken dolu zümrüt, değilken çerçeveli duruş
                        Altına ince bir ayırıcı çizgi konarak menünün geri
                        kalanından ayrıldı.
                        ========================================================== */}
                    <button 
                      onClick={() => { setActiveTab('finansDefter'); setIsSidebarOpen(false); }}
                      className={`w-full py-3 px-4 text-sm font-black transition flex justify-start items-center gap-2.5 rounded-xl border ${activeTab === 'finansDefter'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 hover:text-emerald-200'}`}
                    >
                      <BookOpen className="w-4 h-4 shrink-0" /> Defter
                      <span className={`ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'finansDefter' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300'}`}>KASA</span>
                    </button>
                    {/* Defter'i menünün geri kalanından ayıran ince çizgi */}
                    <div className="h-px bg-neutral-800 my-1.5"></div>
                    <button 
                      onClick={() => { setActiveTab('financeDashboard'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'financeDashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'financeDashboard' ? 'bg-white' : 'bg-blue-500'}`}></div> Kasa Özeti
                    </button>
                    <button 
                      onClick={() => { setActiveTab('reporting'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'reporting' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'reporting' ? 'bg-white' : 'bg-blue-500'}`}></div> Genel Ciro Raporu
                    </button>
                    <button 
                      onClick={() => { setActiveTab('advancedReporting'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'advancedReporting' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'advancedReporting' ? 'bg-white' : 'bg-blue-500'}`}></div> Analiz & İstatistik
                    </button>
                    <button 
                      onClick={() => { setActiveTab('personelMuhasebe'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personelMuhasebe' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personelMuhasebe' ? 'bg-white' : 'bg-blue-500'}`}></div> Personel Muhasebe
                    </button>
                    <button 
                      onClick={() => { setActiveTab('personelOdeme'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personelOdeme' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personelOdeme' ? 'bg-white' : 'bg-blue-500'}`}></div> Personel Ödemeleri
                    </button>
                  </div>
                )}
              </div>
            )}

            {showAddJob && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsAddJobSubMenuOpen(!isAddJobSubMenuOpen); setIsJobSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Satış</span>
                  </div>
                  {isAddJobSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isAddJobSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {/* YENİ (kullanıcı talebi): Alt sayfalar artık kendi yetkilerine
                        göre görünür. Yetkisi olmayan alt sayfa menüde çıkmaz. */}
                    {showSatisMusteriKayit && (<>
                    {/* YENİ: Nakliye Kayıt, Depo Kayıt ve Asansör Kayıt artık TEK SAYFA
                        ("Müşteri Kayıt") altında birleştirildi. Üç ayrı menü öğesi yerine
                        tek giriş noktası var; sayfanın içinde üstte 3 geçiş butonu bulunur
                        (Nakliye Kayıt / Depo Kayıt / Asansör Kayıt) — bkz. aşağıdaki render
                        bloğundaki "musteriKayitSekmeleri". Buraya tıklandığında varsayılan
                        olarak son seçili sekme (activeTab addNakliye/addDepo/addAsansor'dan
                        biriyse) açık kalır; hiçbiri seçili değilse Nakliye ile başlar. */}
                    <button 
                      onClick={() => {
                        const zatenSayfadayiz = ['addNakliye', 'addDepo', 'addAsansor'].includes(activeTab);
                        if (!zatenSayfadayiz) {
                          setActiveTab('addNakliye'); setRecordType('Nakliye'); setEditingJobId(null);
                          setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', wallMounting: [], esyaDurumu: [], contractDetails: '', notes: ''});
                        }
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${['addNakliye', 'addDepo', 'addAsansor'].includes(activeTab) ? 'text-yellow-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${['addNakliye', 'addDepo', 'addAsansor'].includes(activeTab) ? 'bg-yellow-400' : 'bg-yellow-600'}`}></div> Müşteri Kayıt
                    </button>
                    </>)}
                    {/* YENİ: MÜŞTERİ HAVUZU — telefon/WhatsApp/Instagram/Gmail kanallarından
                        gelen tüm müşteri adaylarının toplandığı havuz ekranı */}
                    {showSatisMusteriHavuzu && (
                    <button
                      onClick={() => { setActiveTab('musteriHavuzu'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'musteriHavuzu' ? 'text-yellow-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'musteriHavuzu' ? 'bg-yellow-400' : 'bg-yellow-600'}`}></div> Müşteri Havuzu
                    </button>
                    )}
                    {/* YENİ: SAHA PORTFÖY — Satış Bölümü'nün EN ALTINDA. Saha pazarlama
                        ekibinin iş ortağı portföyü: emlak ofisleri, site yönetimleri,
                        ziyaret takibi, komisyon/teminat carisi ve kartvizit arşivi. */}
                    {showSatisSahaPortfoy && (
                    <button
                      onClick={() => { setActiveTab('sahaPortfoy'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'sahaPortfoy' ? 'text-yellow-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'sahaPortfoy' ? 'bg-yellow-400' : 'bg-yellow-600'}`}></div> Saha Portföy
                    </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {showOperasyon && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsOperasyonSubMenuOpen(!isOperasyonSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-red-600/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Operasyon</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* YENİ: Rozet artık alt menülerdeki TÜM bildirimlerin TOPLAMINI
                        gösterir (Hasarlı İşler + Görev Tahtası + Araç Bakım) ve
                        beyaz zemin+siyah yazı ile kırmızı zemin+beyaz yazı arasında
                        geçiş yaparak yanıp söner. Menü açıkken gizlenir (alt
                        menülerde kırılımı ayrı ayrı görüldüğü için). */}
                    {operasyonToplamBildirim > 0 && !isOperasyonSubMenuOpen && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        {/* YENİ: Hatırlatmalar/İK ile aynı görsel dil — yanıp sönen ışık */}
                        <span className="relative flex w-2.5 h-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-red-500"></span>
                        </span>
                        <span className="menu-rozet-yansonen text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border border-white/60">{operasyonToplamBildirim}</span>
                      </span>
                    )}
                    {isOperasyonSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                
                {isOperasyonSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {canApprovePoints && (
                    <button 
                      onClick={() => { setActiveTab('isOnaylamaTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'isOnaylamaTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'isOnaylamaTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> İş Onaylama Tahtası
                    </button>
                    )}
                    <button 
                      onClick={() => { setActiveTab('ekipKurmaTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'ekipKurmaTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ekipKurmaTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Ekip Kurma Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('izinTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'izinTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'izinTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> İzin Tahtası
                    </button>
                    {/* TAŞINDI: Hasarlı İşler butonu, kullanıcı isteğiyle İzin Tahtası'nın altına alındı (kod birebir aynı) */}
                    <button 
                      onClick={() => { setActiveTab('damagedJobs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'damagedJobs' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'damagedJobs' ? 'bg-white' : 'bg-orange-500'}`}></div> Hasarlı İşler
                      {/* YENİ: Çözüm bekleyen hasarlı iş sayısı — yanıp sönen bildirim ışığı ve sayı rozeti */}
                      {(() => {
                        const unresolvedDamageCount = jobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var' && !j.endJobDetails?.damageResolved).length;
                        if (unresolvedDamageCount === 0) return null;
                        return (
                          <span className="ml-auto flex items-center gap-1.5">
                            {/* Yanıp sönen ışık (ping animasyonu) */}
                            <span className="relative flex w-2.5 h-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-red-600"></span>
                            </span>
                            {/* Sayı rozeti de hafifçe yanıp söner */}
                            <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse shadow-sm">
                              {unresolvedDamageCount}
                            </span>
                          </span>
                        );
                      })()}
                    </button>
                    <button 
                      onClick={() => { setActiveTab('personelTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personelTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personelTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Personel Tahtası
                    </button>
                    {/* NOT: "Puantaj Tahtası" buradan KALDIRILDI — artık İnsan
                        Kaynakları altında "Puantaj Takip" adıyla, Mesai Takip'in
                        hemen altında yer alıyor. Sayfa rotası ('puantajTahtasi') aynı. */}
                    {/* NOT: "Mavi Mesai Tahtası" menü maddesi kullanıcı isteğiyle KALDIRILDI.
                        Aynı bilgi Finans > Personel Muhasebe > Mavi Yaka Mesai ekranında
                        ve İK > Mesai Takip bölümünde zaten mevcut. */}
                    <button 
                      onClick={() => { setActiveTab('taskList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'taskList' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'taskList' ? 'bg-white' : 'bg-orange-500'}`}></div> <span className="whitespace-nowrap">Görev Tahtası</span>
                      </div>
                      {generalTodoTasksCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{generalTodoTasksCount}</span>
                      )}
                    </button>
                    <button 
                      onClick={() => { setActiveTab('vehicleList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'vehicleList' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'vehicleList' ? 'bg-white' : 'bg-orange-500'}`}></div> Araç Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('vehicleMaintenance'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'vehicleMaintenance' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'vehicleMaintenance' ? 'bg-white' : 'bg-orange-500'}`}></div> <span className="whitespace-nowrap">Araç Rapor & Bakım</span>
                      </div>
                      {dueMaintenanceCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{dueMaintenanceCount}</span>
                      )}
                    </button>
                    <button 
                      onClick={() => { setActiveTab('materialList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'materialList' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'materialList' ? 'bg-white' : 'bg-orange-500'}`}></div> Malzeme Listesi
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DEĞİŞİKLİK: "İnsan Kaynakları" menüsü sıralamada YUKARI alındı.
                Eski sıra: Satış > Operasyon > Finans > Müşteri Portföyü > İnsan Kaynakları
                Yeni sıra: Satış > Operasyon > İNSAN KAYNAKLARI > Finans > Müşteri Portföyü
                Blok satır satır aynen taşındı; içindeki hiçbir buton, yetki (showPersonnel)
                veya alt menü mantığı değiştirilmedi. Sadece JSX içindeki konumu değişti. */}
            {showPersonnel && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsPersonnelSubMenuOpen(!isPersonnelSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-green-500 via-green-600 to-emerald-800 text-white shadow-lg shadow-green-700/40 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">İnsan Kaynakları</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* YENİ: Alt menülerdeki bildirimlerin TOPLAMI. Hatırlatmalar ve
                        Operasyon başlıklarıyla aynı görsel dil: yanıp sönen ışık +
                        beyaz/siyah ↔ kırmızı/beyaz geçişli rozet. Menü açıkken gizlenir
                        (alt menülerde kırılımı ayrı ayrı görüldüğü için). */}
                    {insanKaynaklariToplamBildirim > 0 && !isPersonnelSubMenuOpen && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="relative flex w-2.5 h-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-red-500"></span>
                        </span>
                        <span className="menu-rozet-yansonen text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border border-white/60">{insanKaynaklariToplamBildirim}</span>
                      </span>
                    )}
                    {isPersonnelSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                
                {isPersonnelSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {/* ==========================================================
                        SIRALAMA (kullanıcı isteği 15.08.2026):
                        1) Mesai Takip  2) Saha Raporlaması  3) Şikayet Bildirimleri
                        4) Personel Başvuru  5) Personel Listesi  6) Özlük Dosyaları
                        Sayfa rotaları (activeTab) DEĞİŞMEDİ; yalnızca menüdeki
                        sıra ve "Tüm Personel" -> "Personel Listesi" etiketi değişti.
                        ========================================================== */}

                    {/* 1) Mesai Takip — QR + konum doğrulamalı giriş/çıkış takibi */}
                    <MesaiTakipMenuButonu activeTab={activeTab} setActiveTab={setActiveTab} setIsSidebarOpen={setIsSidebarOpen} />

                    {/* 1.b) Puantaj Takip — Operasyon menüsünden buraya taşındı.
                            Eski adı "Puantaj Tahtası"; sayfa rotası değişmedi. */}
                    <button 
                      onClick={() => { setActiveTab('puantajTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'puantajTahtasi' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'puantajTahtasi' ? 'bg-white' : 'bg-green-500'}`}></div> Puantaj Takip
                    </button>

                    {/* 2) Saha Raporlaması — şeflerin saha denetimleri */}
                    <button 
                      onClick={() => { setActiveTab('sahaRaporlamasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'sahaRaporlamasi' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'sahaRaporlamasi' ? 'bg-white' : 'bg-green-500'}`}></div> Saha Raporlaması
                    </button>

                    {/* 3) Şikayet Bildirimleri — okunmamış sayısı rozette gösterilir */}
                    <button 
                      onClick={() => { setActiveTab('complaints'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'complaints' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'} relative`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'complaints' ? 'bg-white' : 'bg-green-500'}`}></div> 
                      Şikayet Bildirimleri
                      {complaints.filter(c => !c.read).length > 0 && (
                        <span className="absolute right-4 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{complaints.filter(c => !c.read).length}</span>
                      )}
                    </button>

                    {/* 4) Personel Başvuru — aday takip sistemi (işe alım süreci) */}
                    <button 
                      onClick={() => { setActiveTab('personelBasvuru'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personelBasvuru' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personelBasvuru' ? 'bg-white' : 'bg-green-500'}`}></div> Personel Başvuru
                    </button>

                    {/* 5) Personel Listesi (eski adı "Tüm Personel" — yalnızca etiket değişti,
                           sayfa rotası 'personnelList' olarak kaldı).
                        NOT: "Personel Ekle" sol menüden kaldırılmıştı; bu sayfanın sağ üst
                        köşesindeki buton olarak duruyor. */}
                    <button 
                      onClick={() => { setActiveTab('personnelList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personnelList' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personnelList' ? 'bg-white' : 'bg-green-500'}`}></div> Personel Listesi
                    </button>

                    {/* 6) Özlük Dosyaları */}
                    <button 
                      onClick={() => { setActiveTab('ozlukDosyalari'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'ozlukDosyalari' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ozlukDosyalari' ? 'bg-white' : 'bg-green-500'}`}></div> Özlük Dosyaları
                    </button>
                    {/* NOT: İK altındaki eski "Şirket Evrakları" (sirketEvraklari) menüden kaldırıldı —
                        aynı işlev artık "Şirket Dosyaları" ana menüsü altında (sirketBelgeleri) yönetiliyor. */}
                  </div>
                )}
              </div>
            )}

            {/* YENİ: "İş Listesi" ve "Müşteri Listesi" başlıkları kaldırıldı; ikisi "MÜŞTERİ PORTFÖYÜ" başlığında birleştirildi. */}
            {(showJobList || showCustomers) && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsJobSubMenuOpen(!isJobSubMenuOpen); setIsCustomerSubMenuOpen(false); setIsAddJobSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950 text-white shadow-lg shadow-amber-900/40 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Müşteri Portföyü</span>
                  </div>
                  {isJobSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isJobSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {/* İş Listesi alt menüsü — "Mevcut / Tamamlanan / İptal Edilen İşler" sol menüden
                        kaldırıldı; artık "Tüm İşler" sayfasının en üstündeki butonlardan seçiliyor. */}
                    {showJobList && (<>
                    <button 
                      onClick={() => { setActiveTab('allJobs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'allJobs' ? 'bg-amber-700 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'allJobs' ? 'bg-white' : 'bg-amber-700'}`}></div> Tüm İşler
                    </button>
                    </>)}
                    {/* Müşteri Listesi alt menüsü — "Özel Müşteriler / Kara Liste" sol menüden
                        kaldırıldı; artık "Tüm Müşteriler" sayfasının en üstündeki butonlardan seçiliyor. */}
                    {showCustomers && (<>
                    <button 
                      onClick={() => { setActiveTab('allCustomers'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'allCustomers' ? 'bg-amber-700 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'allCustomers' ? 'bg-white' : 'bg-amber-700'}`}></div> Tüm Müşteriler
                    </button>
                    </>)}
                  </div>
                )}
              </div>
            )}

            {/* YENİ: ŞİRKET DOSYALARI — mor geçişli ana menü. Hukuki süreçlerin (dava, icra,
                ihtar/ihbar vb.) ve avukat muhasebesinin yönetildiği bölümler burada toplanır.
                İK yetkisi OLMAYAN ama 'Dava Dosyaları' yetkisi verilen kullanıcılar (ör. Avukat) da görür. */}
            {(showPersonnel || showDavaDosyalari) && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsSirketDosyalariSubMenuOpen(!isSirketDosyalariSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsAddJobSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-purple-500 via-purple-700 to-fuchsia-950 text-white shadow-lg shadow-purple-700/40 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Şirket Dosyaları</span>
                  </div>
                  {isSirketDosyalariSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isSirketDosyalariSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {/* Dava Dosyaları — hukuk takip merkezi + avukat muhasebesi (İK veya davaDosyalari yetkisi) */}
                    {(showPersonnel || showDavaDosyalari) && (
                    <button 
                      onClick={() => { setActiveTab('davaDosyalari'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'davaDosyalari' ? 'bg-purple-700 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'davaDosyalari' ? 'bg-white' : 'bg-purple-500'}`}></div> Dava Dosyaları
                    </button>
                    )}
                    {/* YENİ: Şirket Evrakları — kategorili şirket evrak arşiv merkezi (sadece İK yetkisi) */}
                    {showPersonnel && (
                    <button 
                      onClick={() => { setActiveTab('sirketBelgeleri'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'sirketBelgeleri' ? 'bg-purple-700 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'sirketBelgeleri' ? 'bg-white' : 'bg-purple-500'}`}></div> Şirket Evrakları
                    </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* NOT: "Takip ve Yapılacak İşler" sayfası ve ona giden kısayol butonu
                kullanıcı isteğiyle tamamen kaldırıldı (rota kapatıldı). */}

            {/* YENİ: "Yetkilendirme" artık ayrı bir ana menü değil; alt öğeleri (Mevcut
                Kullanıcılar, Pozisyonlar, Rütbeler, İzinler Yönetimi, Modül Görüntüleme)
                "Sistem Dosyaları" menüsünün altına taşındı. Yetki kontrolleri (showAuth /
                showSystemFiles) öğe bazında AYNEN korunuyor, sadece tek başlık altında
                toplandılar. Başlığın arka planı artık Finans Bölümü'ndeki gibi HER ZAMAN
                renk geçişli — burada kırmızı tonlarda. */}
            {(showAuth || showSystemFiles) && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsSystemFilesSubMenuOpen(!isSystemFilesSubMenuOpen); setIsAuthSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-red-500 via-red-600 to-red-800 text-white shadow-lg shadow-red-700/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Sistem Dosyaları</span>
                  </div>
                  {isSystemFilesSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isSystemFilesSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    {/* Eskiden "Yetkilendirme" başlığı altındaydı — yetki kontrolü (showAuth) aynen korunuyor */}
                    {showAuth && (<>
                    <button 
                      onClick={() => { setActiveTab('userList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'userList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'userList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Kullanıcılar
                    </button>
                    {/* NOT: "Pozisyonlar" ve "Rütbeler" de artık ayrı sol menü öğeleri
                        değil; "Mevcut Kullanıcılar" sayfasının içine sekme olarak taşındı
                        (bkz. UserListView üstündeki sekme çubuğu). Sayfa rotaları
                        (activeTab === 'positions' / 'ranks') geriye dönük uyumluluk için
                        hâlâ mevcut. */}
                    {/* NOT: "İzinler Yönetimi" ve "Modül Görüntüleme" artık ayrı sol menü
                        öğeleri değil; "Mevcut Kullanıcılar" sayfasının içine sekme olarak
                        taşındı (bkz. UserListView üstündeki sekme çubuğu). Sayfa rotaları
                        (activeTab === 'permissions' / 'moduleAccess') geriye dönük
                        uyumluluk için hâlâ mevcut. */}
                    </>)}
                    {/* Sistem Dosyaları'nın kendi mevcut öğeleri — showSystemFiles aynen korunuyor */}
                    {showSystemFiles && (<>
                    <button 
                      onClick={() => { setActiveTab('backupSystem'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'backupSystem' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'backupSystem' ? 'bg-white' : 'bg-red-600'}`}></div> Yedekleme
                    </button>
                    <button 
                      onClick={() => { setActiveTab('systemLogs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'systemLogs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'systemLogs' ? 'bg-white' : 'bg-red-600'}`}></div> Hareket Geçmişi
                    </button>
                    <button 
                      onClick={() => { setActiveTab('userActivities'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'userActivities' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'userActivities' ? 'bg-white' : 'bg-red-600'}`}></div> Kullanıcı Hareketleri
                    </button>
                    <button 
                      onClick={() => { setActiveTab('companyPasswords'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'companyPasswords' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'companyPasswords' ? 'bg-white' : 'bg-red-600'}`}></div> Kurumsal Şifreler
                    </button>
                    {/* YENİ: "Uygulama Ayarları" artık ayrı bir ana menü değil,
                        Sistem Dosyaları'nın alt menüsüne taşındı. */}
                    <button 
                      onClick={() => { setActiveTab('appSettings'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'appSettings' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'appSettings' ? 'bg-white' : 'bg-red-600'}`}></div> Uygulama Ayarları
                    </button>
                    {/* YENİ: "Resmi Ayarları" — sözleşme maddeleri ve şirket IBAN'ı
                        buradan yönetilir. Sistem Dosyaları alt menüsünün EN ALTINDA durur. */}
                    <button 
                      onClick={() => { setActiveTab('resmiAyarlar'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'resmiAyarlar' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'resmiAyarlar' ? 'bg-white' : 'bg-red-600'}`}></div> Resmi Ayarları
                    </button>
                    </>)}
                  </div>
                )}
              </div>
            )}


            {/* NOT: "Şikayet Bildirim" ayrı bir sol menü öğesi olmaktan çıkarıldı;
                artık "Özel Görevlerim" gibi "Profilim" sayfasının içinde bir bölüm
                olarak gösteriliyor (bkz. ProfileSettingsView). Sayfa rotası
                (activeTab === 'myComplaint') geriye dönük uyumluluk için hâlâ mevcut. */}

          </nav>

          <div className="px-4 pb-4">
            <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
               <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
                  <button onClick={() => setIsContactsOpen(!isContactsOpen)} className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:text-white transition flex-1 text-left">
                    <Phone className="w-3.5 h-3.5"/> Şirket İletişimi {isContactsOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </button>
                  {/* YENİ: Tek düzenleme butonu — ekleme, sıralama, düzenleme ve silme
                      işlemlerinin tamamı açılan yönetim penceresinden yapılır. */}
                  {canManageContacts && (
                    <button onClick={() => setShowContactsManageModal(true)} title="İletişim Listesini Düzenle"
                      className="hover:text-white transition bg-emerald-800/50 hover:bg-emerald-700/50 p-1.5 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
               </div>
               
               {isContactsOpen && (
                 <div className="space-y-1 mt-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {/* Liste artık sade: sadece isim, unvan ve telefon. Tıklayınca arama başlar. */}
                    {companyContacts.map((c) => (
                       <a key={c.id} href={`tel:${c.phone}`} className="flex flex-col hover:bg-emerald-800/30 p-1.5 rounded transition w-full">
                          <span className="text-white text-xs font-bold truncate">{c.name}</span>
                          <span className="text-emerald-200/70 text-[9px] truncate mt-0.5">{c.position} - {c.phone}</span>
                       </a>
                    ))}
                    {companyContacts.length === 0 && <p className="text-[10px] text-emerald-200/50 italic py-1 px-1.5">Kayıtlı numara yok.</p>}
                 </div>
               )}
            </div>
          </div>

          <div className="p-4 border-t border-neutral-800 space-y-2">
            <button 
              onClick={handleLogout}
              className="w-full py-3 px-4 text-sm font-bold text-red-500 hover:text-white hover:bg-red-600 transition flex justify-center items-center gap-2 rounded-xl border border-red-500/30 hover:border-red-600"
            >
              <LogOut className="w-4 h-4 shrink-0" /> Çıkış Yap
            </button>
          </div>
        </aside>

        {/* YENİ: Arka planda veri eşitlemesi sürerken küçük bilgi rozeti.
            Uygulamayı ENGELLEMEZ; kullanıcı bu sırada her yerde gezinebilir. */}
        {!allDataLoaded && (
          <div className="fixed bottom-4 right-4 z-[60] bg-black/85 backdrop-blur text-white px-3 py-2 rounded-full shadow-xl flex items-center gap-2 pointer-events-none animate-in fade-in">
            <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin shrink-0" />
            <span className="text-[11px] font-black tracking-wide">Veriler eşitleniyor...</span>
          </div>
        )}

        {/* YENİ: "İki kez yukarı çek → yenile" göstergesi */}
        {yenilemeAsamasi > 0 && (
          <div className="fixed top-0 left-0 right-0 z-[70] flex justify-center pointer-events-none">
            <div className={`mt-3 px-4 py-2 rounded-full shadow-xl text-xs font-black flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${yenilemeAsamasi === 2 ? 'bg-red-600 text-white' : 'bg-white text-neutral-700 border border-neutral-200'}`}>
              {yenilemeAsamasi === 2
                ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sayfa yenileniyor...</>)
                : (<><ChevronUp className="w-3.5 h-3.5 text-red-600" /> Yenilemek için bir kez daha yukarı çekin</>)}
            </div>
          </div>
        )}

        <main ref={mainScrollRef} className="flex-1 w-full p-4 md:p-8 mt-16 md:mt-0 overflow-y-auto relative">
          <div className="max-w-6xl mx-auto">
            {showGlobalSearch && (
              <div className="hidden md:block relative mb-6">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-red-500" />
                  <input
                    type="text"
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    // YENİ: Enter'a basınca, girilen metinle eşleşen ilk aracın profiline direkt git
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || !showGlobalSearchVehicle) return;
                      // Arama metnini normalize et (küçük harf + boşlukları kaldır)
                      const norm = (s) => (s || '').toString().toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                      const q = norm(globalSearchQuery);
                      if (!q) return;
                      // Önce tam plaka eşleşmesi ara, yoksa plakası aramayı içeren ilk aracı al
                      const match = vehicles.find(v => norm(v.plate) === q) || vehicles.find(v => norm(v.plate).includes(q));
                      if (match) {
                        setViewingVehicleProfileId(match.id);
                        setActiveTab('vehicleProfile');
                        setGlobalSearchQuery('');
                      }
                    }}
                    placeholder="Araç plakası, personel adı veya müşteri adı/telefon numarası ara..."
                    className="w-full pl-12 pr-4 py-3.5 bg-white text-black border-2 border-red-500 ring-4 ring-red-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-600 transition shadow-sm"
                  />
                  {globalSearchQuery && (
                    <button onClick={() => setGlobalSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {globalSearchQuery.trim() !== '' && (() => {
                  const normalizeSearchStr = (s) => (s || '').toString().toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                  const q = normalizeSearchStr(globalSearchQuery);

                  const vehicleResults = showGlobalSearchVehicle ? vehicles.filter(v => normalizeSearchStr(v.plate).includes(q) || normalizeSearchStr(v.type).includes(q)).slice(0, 5) : [];
                  const personnelResults = showGlobalSearchPersonnel ? personnelList.filter(p =>
                    normalizeSearchStr(p.fullName).includes(q) ||
                    normalizeSearchStr(p.personalPhone).includes(q) ||
                    normalizeSearchStr(p.companyPhone).includes(q)
                  ).slice(0, 5) : [];
                  const customerMap = new Map();
                  if (showGlobalSearchCustomer) {
                    jobs.forEach(j => {
                      if (!j.customerPhone) return;
                      const key = normalizeCariPhone(j.customerPhone);
                      if (!customerMap.has(key)) customerMap.set(key, { name: j.customerName, phone: j.customerPhone, cariKey: key });
                    });
                  }
                  const customerResults = showGlobalSearchCustomer ? Array.from(customerMap.values()).filter(c =>
                    normalizeSearchStr(c.name).includes(q) || normalizeSearchStr(c.phone).includes(q)
                  ).slice(0, 5) : [];
                  const hasAnyResult = vehicleResults.length > 0 || personnelResults.length > 0 || customerResults.length > 0;

                  return (
                    <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-red-500 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-[70vh] overflow-y-auto custom-scrollbar text-black">
                      {!hasAnyResult && (
                        <p className="p-5 text-sm text-neutral-500 text-center font-medium">Eşleşen araç, personel veya müşteri bulunamadı.</p>
                      )}

                      {showGlobalSearchCustomer && customerResults.length > 0 && (
                        <div className="p-3 border-b border-neutral-100">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Müşteriler (İsim veya Telefon Numarasıyla)</p>
                          {customerResults.map((c, idx) => (
                            <button key={idx} type="button" onClick={() => { setViewingCariKey(c.cariKey); setActiveTab('customerProfile'); setGlobalSearchQuery(''); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                              <div className="flex-1"><span className="font-bold text-black text-sm block">{c.name}</span><span className="text-[10px] text-neutral-500">{c.phone}</span></div>
                              <span className="text-[10px] font-bold text-orange-600">Cariye Git →</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {showGlobalSearchPersonnel && personnelResults.length > 0 && (
                        <div className="p-3 border-b border-neutral-100">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Personel</p>
                          {personnelResults.map(p => (
                            <button key={p.id} type="button" onClick={() => { setViewingPersonnelProfileId(p.id); setActiveTab('personnelProfile'); setGlobalSearchQuery(''); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                                {p.profileImage ? <img src={p.profileImage} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-400" />}
                              </div>
                              <div className="flex-1"><span className="font-bold text-black text-sm block">{p.fullName}</span><span className="text-[10px] text-neutral-500">{p.position}</span></div>
                              <span className="text-[10px] font-bold text-orange-600">Profiline Git →</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {showGlobalSearchVehicle && vehicleResults.length > 0 && (
                        <div className="p-3">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Araçlar</p>
                          {vehicleResults.map(v => (
                            <button key={v.id} type="button" onClick={() => { setViewingVehicleProfileId(v.id); setActiveTab('vehicleProfile'); setGlobalSearchQuery(''); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Truck className="w-4 h-4" /></div>
                              <div className="flex-1"><span className="font-bold text-black text-sm block">{v.plate}</span><span className="text-[10px] text-neutral-500">{v.type}</span></div>
                              <span className="text-[10px] font-bold text-orange-600">Profiline Git →</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ====================================================================
                GEÇMİŞ DURUM SATIRI
                Düğme yoktur; tüm geçmiş otomatik yüklenir. Bu satır yalnızca
                ilk yükleme sürerken görünür ve tamamlanınca kaybolur.
                ==================================================================== */}
            {/* GEÇMİŞ DURUMU: Artık düğme YOK — tüm geçmiş otomatik yüklenir.
                Bu satır yalnızca ilk yükleme sırasında bilgi verir, sonra kaybolur. */}
            {gecmisDurum.yukleniyor && (
              <div className="mb-4 bg-white border border-neutral-200 rounded-2xl p-3 flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 text-neutral-400 animate-spin shrink-0" />
                <p className="text-[11px] font-bold text-neutral-600">Tüm geçmiş kayıtlar yükleniyor...</p>
              </div>
            )}

            {/* YENİ: Avukat pozisyonundaki kullanıcıya TAMAMEN ÖZEL anasayfa (hukuk odaklı, maaş/mesai içermez) */}
            {activeTab === 'dashboard' && showDashboard && isAvukatUser && <AvukatDashboardView currentUser={currentUser} setActiveTab={setActiveTab} setViewingImage={setViewingImage} />}
            {activeTab === 'dashboard' && showDashboard && !isAvukatUser && <DashboardView jobs={visibleJobs} allJobs={jobs} personnelList={personnelList} currentUser={currentUser} setViewingImage={setViewingImage} transactions={transactions} />}
            {activeTab === 'notifications' && <NotificationsView notifications={visibleNotifications} markNotificationsAsRead={markNotificationsAsRead} currentUser={currentUser} canAddInfo={showAddInfo} onAddInfo={() => setActiveTab('addInfo')} />}
            {activeTab === 'calendar' && showCalendar && <CalendarView jobs={currentUser?.position === 'Operatör' ? jobs : visibleJobs} handleEditJob={handleEditJob} currentUser={currentUser} setJobToChangeDate={setJobToChangeDate} setNewJobDate={setNewJobDate} setShowChangeDateModal={setShowChangeDateModal} setCancelJobId={setCancelJobId} setDeleteJobId={setDeleteJobId} onDonemGerekli={donemIsleriYukle} donemYukleniyor={donemYukleniyor} />}
            {activeTab === 'profileSettings' && showProfileSettings && <ProfileSettingsView currentUser={currentUser} handleUpdatePersonnel={handleUpdatePersonnel} showMySpecialTasks={showMySpecialTasks} tasks={tasks} handleUpdateTaskStatus={handleUpdateTaskStatus} showMyComplaint={showMyComplaint} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'myAssignedJobs' && <MyAssignedJobsView currentUser={currentUser} jobs={visibleJobs} handleOpenEndJobModal={handleOpenEndJobModal} markNotificationsAsRead={markNotificationsAsRead} />}
            {activeTab === 'mySpecialTasks' && showMySpecialTasks && <MyTasksView currentUser={currentUser} tasks={tasks} handleUpdateTaskStatus={handleUpdateTaskStatus} />}
            
            {activeTab === 'isOnaylamaTahtasi' && showOperasyon && <IsOnaylamaTahtasiView jobs={visibleJobs} handleEditJob={handleEditJob} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints} handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal} personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} handleOpenEndJobModal={handleOpenEndJobModal} isManager={isManager} currentUser={currentUser} />}
            {activeTab === 'ekipKurmaTahtasi' && showOperasyon && <EkipKurmaTahtasiView jobs={visibleJobs} personnelList={personnelList} vehicles={vehicles} materials={materials} db={db} appId={appId} addSystemLog={addSystemLog} allPersonnelActions={allPersonnelActions} allMesaiRecords={allMesaiRecords} />}
            {activeTab === 'izinTahtasi' && showOperasyon && <IzinTahtasiView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'personelTahtasi' && showOperasyon && <PersonelTahtasiView personnelList={personnelListMuhasebe} setViewingPersonnelProfileId={setViewingPersonnelProfileId} setActiveTab={setActiveTab} jobs={jobs} allPersonnelActions={allPersonnelActions} vehicles={vehicles} allMesaiRecords={allMesaiRecords} />}
            {/* YETKİ: Menü İnsan Kaynakları altına taşındığı için İK yetkisi olan
                kullanıcılar da bu sayfayı açabilir (Operasyon yetkisi korunur). */}
            {activeTab === 'puantajTahtasi' && (showOperasyon || showPersonnel) && <PuantajTahtasiView personnelList={personnelListMuhasebe} db={db} appId={appId} />}
            {/* NOT: "Mavi Mesai Tahtası" sayfası menüden kaldırıldığı için render edilmiyor. */}
            
            {/* YENİ: Kayıt sonrası alttan açılan başarı paneli — WhatsApp bilgilendirme ve Sözleşme indirme seçenekleri */}
            {savedJobInfo && (
              <div className="fixed inset-0 bg-black/50 z-[9998] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
                <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-md p-6 pb-8 animate-in slide-in-from-bottom-8">
                  <button 
                    type="button" 
                    onClick={() => setSavedJobInfo(null)}
                    className="absolute top-4 right-4 p-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition"
                  >
                    <X className="w-4 h-4 text-neutral-500" />
                  </button>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3 animate-in zoom-in">
                      <CheckCircle className="w-9 h-9 text-green-600" />
                    </div>
                    <h3 className="text-lg font-black text-black mb-1">
                      {savedJobInfo.wasEditing ? 'Müşteri Kaydınız Güncellendi!' : 'Müşteri Kaydınız Oluşturuldu!'}
                    </h3>
                    <p className="text-sm text-neutral-500 mb-4">
                      <b>{savedJobInfo.customerName}</b> • {(savedJobInfo.date || '').split('-').reverse().join('.')} {savedJobInfo.time}
                    </p>
                    {/* YENİ: Kullanıcıya doğru sırayı hatırlatan bilgilendirme metni */}
                    <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-left flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 mt-0.5">💡</span>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Önce <b>müşteriyi WhatsApp'tan bilgilendirin</b>, ardından <b>sözleşmeyi indirip</b> yine WhatsApp üzerinden müşteriyle paylaşın. Her iki adımı da tamamladığınızda kaydı bitirebilirsiniz.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      {/* Müşteriyi Bilgilendir (WA): kayıt bilgilerini WhatsApp üzerinden müşteriye gönderir */}
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            // Telefonu uluslararası formata çevir (05xx -> 905xx)
                            let phone = (savedJobInfo.customerPhone || '').replace(/\D/g, '');
                            if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                            else if (!phone.startsWith('90')) phone = '90' + phone;
                            // Her müşteriye özel değerler
                            const price = parseInt(savedJobInfo.price || 0);
                            const kapora = Math.round(price * 0.20); // Toplam tutarın %20'si kapora (sözleşme 20. madde)
                            const kaporaStr = kapora.toLocaleString('tr-TR');
                            const teslimKodu = savedJobInfo.deliveryCode || '------';
                            // Kurumsal/bireysel başlığa göre özel hitap
                            const unvan = savedJobInfo.customerType === 'Kurumsal' ? 'Değerli' : 'Sayın';
                            const isTipi = savedJobInfo.type || 'Nakliye';
                            const msg = `${unvan} *${savedJobInfo.customerName}*,\n\n` +
                              `💰 *Kapora Bilgilendirmesi:*\n` +
                              `İşleminizin onaylanması ve aracınızın rezerve edilmesi için toplam tutarın %20'si olan *${kaporaStr} TL* kapora ödemenizi rica ederiz.\n\n` +
                              `🏦 *Banka Bilgileri:*\n` +
                              // DEĞİŞİKLİK: Banka bilgisi artık sabit değil.
                              // aktifBankaBilgiMetni() Resmi Ayarları'ndaki VARSAYILAN hesabı
                              // okur; ayar kaydı yoksa koddaki varsayılana düşer.
                              // Böylece IBAN panelden değiştirildiğinde mesaj da güncellenir.
                              `${aktifBankaBilgiMetni()}\n\n` +
                              `⚠️ *ÖNEMLİ NOT:* Lütfen ödeme yaparken açıklama kısmına sadece size gönderdiğimiz teslim kodunu (*${teslimKodu}*) yazınız.\n\n` +
                              `*Sembol Nakliyat* olarak ${savedJobInfo.date || ''} tarihinde saat ${savedJobInfo.time || ''} sularında planlanan ${isTipi} işleminiz sistemimize başarıyla kaydedilmiştir.\n\n` +
                              `🚚 *Güzergah Bilgisi:*\n` +
                              `📍 Alış: ${savedJobInfo.fromProvince || ''} / ${savedJobInfo.fromDistrict || ''}\n` +
                              `🏁 Teslim: ${savedJobInfo.toProvince || ''} / ${savedJobInfo.toDistrict || ''}\n\n` +
                              `Bizi tercih ettiğiniz için teşekkür eder, yeni yerinizin hayırlı olmasını dileriz. İyi günler!`;
                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                            setSavedNotified(true); // Tıklandı olarak işaretle (tik görünür)
                          }}
                          className={`w-full px-3 py-3 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm ${savedNotified ? 'bg-[#128C7E]' : 'bg-[#25D366] hover:bg-[#128C7E]'}`}
                        >
                          <MessageCircle className="w-4 h-4 shrink-0" /> Müşteriyi Bilgilendir (WA)
                        </button>
                        {/* YENİ: Bilgilendirme tıklandıysa altında yeşil tik işareti */}
                        {savedNotified && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 animate-in fade-in">
                            <CheckCircle className="w-3.5 h-3.5" /> Bilgilendirildi
                          </span>
                        )}
                      </div>
                      {/* Sözleşmeyi İndir: takvimdeki sözleşme mantığıyla aynı PDF'i oluşturur (dosya adı: Ad-Soyad-GG.AA.YYYY.pdf) */}
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            generateContractPDF(savedJobInfo);
                            setSavedContractDl(true); // Tıklandı olarak işaretle (tik görünür)
                          }}
                          className={`w-full px-3 py-3 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm ${savedContractDl ? 'bg-black' : 'bg-neutral-900 hover:bg-black'}`}
                        >
                          <Download className="w-4 h-4 shrink-0" /> Sözleşmeyi İndir
                        </button>
                        {/* YENİ: Sözleşme indir tıklandıysa altında yeşil tik işareti */}
                        {savedContractDl && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 animate-in fade-in">
                            <CheckCircle className="w-3.5 h-3.5" /> İndirildi
                          </span>
                        )}
                      </div>
                    </div>
                    {/* YENİ: Her iki adım da tamamlanınca "Tamamlandı" butonu çıkar; tıklanınca panel kapanır ve takvime yönlendirir */}
                    {savedNotified && savedContractDl && (
                      <button
                        type="button"
                        onClick={() => {
                          setSavedJobInfo(null);       // Paneli kapat
                          setActiveTab('calendar');    // Takvim sayfasına yönlendir
                        }}
                        className="w-full mt-5 px-4 py-3.5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/30 animate-in fade-in slide-in-from-bottom-2"
                      >
                        <CheckCircle className="w-5 h-5" /> Tamamlandı — Takvime Git
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'myComplaint' && showMyComplaint && <MyComplaintSubmitView currentUser={currentUser} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'addInfo' && showAddInfo && <AddInfoView currentUser={currentUser} personnelList={personnelList} addSystemLog={addSystemLog} onBack={() => setActiveTab('notifications')} />}
            
            {/* YENİ: MÜŞTERİ HAVUZU EKRANI — kendi alt yetkisiyle görünür */}
            {activeTab === 'musteriHavuzu' && showSatisMusteriHavuzu &&
              <MusteriHavuzuView currentUser={currentUser} personnelList={personnelList} addSystemLog={addSystemLog} />}

            {/* YENİ: SAHA PORTFÖY EKRANI — kendi alt yetkisiyle görünür */}
            {activeTab === 'sahaPortfoy' && showSatisSahaPortfoy &&
              <SahaPortfoyView personnelList={personnelList} currentUser={currentUser} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}

            {/* YENİ: HATIRLATMALAR EKRANI — takvim mantığıyla görev/not takibi.
                jobs/personnelList/vehicles, konuya göre "İlgili" seçimi için geçilir. */}
            {activeTab === 'hatirlatmalar' && showHatirlatmalar &&
              <HatirlatmalarView jobs={jobs} personnelList={personnelList} vehicles={vehicles} currentUser={currentUser} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}

            {(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') && showSatisMusteriKayit &&
              <div className="space-y-4">
                {/* ============================================================
                    YENİ: MÜŞTERİ KAYIT — 3 GEÇİŞ SEKMESİ
                    Nakliye Kayıt / Depo Kayıt / Asansör Kayıt artık tek sayfa.
                    Her butonun içindeki mantık (activeTab, recordType, formData
                    sıfırlama), eskiden sol menüde ayrı ayrı duran 3 butonla
                    BİREBİR AYNIDIR — sadece konumu sayfanın üstüne taşındı.
                    ============================================================ */}
                <div className="max-w-4xl mx-auto flex bg-neutral-100 p-1.5 rounded-2xl shadow-sm border border-neutral-200 gap-1">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('addNakliye'); setRecordType('Nakliye'); setEditingJobId(null); setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', wallMounting: [], esyaDurumu: [], contractDetails: '', notes: ''}); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black transition flex items-center justify-center gap-2 ${activeTab === 'addNakliye' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                  >
                    <Car className="w-4 h-4" /> Nakliye Kayıt
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('addDepo'); setRecordType('Depo'); setEditingJobId(null); setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: 'Giriş Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', wallMounting: [], esyaDurumu: [], contractDetails: '', notes: '', selectedDepo: '', depoDirection: 'toDepo'}); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black transition flex items-center justify-center gap-2 ${activeTab === 'addDepo' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                  >
                    <Package className="w-4 h-4" /> Depo Kayıt
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('addAsansor'); setRecordType('Asansör'); setEditingJobId(null); setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendi İşimiz', fromTransportMethod: 'Dış Cephe Asansörü', fromRoomCount: 'Yükleme Kurulum', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: '', toDistrict: '', toFloor: '', toPacking: '', toTransportMethod: '', toRoomCount: '', toDistance: '', toDistanceUnit: '', toAddress: '', contractDetails: '', notes: ''}); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black transition flex items-center justify-center gap-2 ${activeTab === 'addAsansor' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Asansör Kayıt
                  </button>
                </div>

                {/* NOT: "Kayıtlı Müşteriden Seç" butonu kullanıcı isteğiyle kaldırıldı */}
                {formData.customerName && formData.customerPhone && (() => {
                  const cariMatchJob = jobs.find(j =>
                    normalizeCariName(j.customerName) === normalizeCariName(formData.customerName) &&
                    normalizeCariPhone(j.customerPhone) === normalizeCariPhone(formData.customerPhone)
                  );
                  if (!cariMatchJob) return null;
                  return (
                    <div className="max-w-4xl mx-auto bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                      <p className="text-sm font-bold">Bu müşterinin sistemde zaten bir cari kaydı var. Bu yeni iş de aynı cari profiline otomatik olarak eklenecek.</p>
                    </div>
                  );
                })()}

                {existingCustomerMatch && (
                  <div className="max-w-4xl mx-auto bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-bold">
                          {existingCustomerMatch.type === 'phone' 
                            ? 'Bu telefon numarasına ait bir müşteri kaydı bulundu.' 
                            : 'Bu isme ait bir müşteri kaydı bulundu.'}
                        </p>
                        <p className="text-xs mt-0.5">Sistemdeki İsim: <b>{existingCustomerMatch.name}</b> • Numara: <b>{existingCustomerMatch.phone}</b></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        customerName: existingCustomerMatch.name, 
                        customerPhone: existingCustomerMatch.phone 
                      }))}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
                    >
                      Bilgileri Eşleştir
                    </button>
                  </div>
                )}
                <AddJobView 
                  type={recordType} 
                  formData={formData} 
                  setFormData={setFormData}
                  handleInputChange={handleInputChange}
                  handleProvinceChange={handleProvinceChange}
                  handleDepoChange={handleDepoChange}
                  toggleDepoDirection={toggleDepoDirection}
                  handleSwapAddresses={handleSwapAddresses}
                  handleAddJob={handleAddJob}
                  showSecondFromAddress={showSecondFromAddress}
                  setShowSecondFromAddress={setShowSecondFromAddress}
                  showSecondToAddress={showSecondToAddress}
                  setShowSecondToAddress={setShowSecondToAddress}
                  editingJobId={editingJobId}
                />
              </div>
            }
            {activeTab === 'allCustomers' && showCustomers && (
              <div className="space-y-4">
                 <CustomerListView jobs={jobs} title="Tüm Müşteriler" handleEditJob={handleEditJob} onViewCari={(key) => { setViewingCariKey(key); setActiveTab('customerProfile'); }} />
              </div>
            )}
            {activeTab === 'specialCustomers' && showCustomers && <CustomerListView jobs={jobs} title="Özel Müşteriler" handleEditJob={handleEditJob} onViewCari={(key) => { setViewingCariKey(key); setActiveTab('customerProfile'); }} />}
            {activeTab === 'customerProfile' && showCustomers && <CustomerProfileView currentUser={currentUser} setViewingImage={setViewingImage} setMarkDamageJobId={setMarkDamageJobId} jobs={jobs} cariKey={viewingCariKey} handleEditJob={handleEditJob} onBack={() => setActiveTab('allCustomers')} db={db} appId={appId} addSystemLog={addSystemLog} personnelList={personnelList} vehicles={vehicles} />}

            {activeTab === 'currentJobs' && showJobList && <CurrentJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} />}
            {activeTab === 'completedJobs' && showJobList && <CompletedJobsView jobs={jobs} handleEditJob={handleEditJob} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints} handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal} handleOpenResolveDamageModal={handleOpenResolveDamageModal} />}
            {/* YENİ: "Tüm İşler" artık kategori butonlu İş Merkezi'ni açar
                (Tüm / Mevcut / Tamamlanan / İptal Edilen tek sayfada) */}
            {activeTab === 'allJobs' && showJobList && <IsMerkeziView jobs={jobs} sahaDenetimleri={sahaDenetimleri} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints} handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal} handleOpenResolveDamageModal={handleOpenResolveDamageModal} handleRestoreJob={handleRestoreJob} />}
            {activeTab === 'damagedJobs' && showJobList && <DamagedJobsView jobs={jobs} handleEditJob={handleOpenEditDamageModal} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} handleOpenResolveDamageModal={handleOpenResolveDamageModal} canDelete={isManager} />}
            {activeTab === 'cancelledJobs' && showJobList && <CancelledJobsView jobs={jobs} handleEditJob={handleEditJob} handleRestoreJob={handleRestoreJob} setDeleteJobId={setDeleteJobId} />}

            {activeTab === 'customerBlacklist' && showCustomers && <PlaceholderView title="Müşteri Kara Listesi" icon={AlertTriangle} />}
            
            {/* YENİ: Personel Başvuru (Aday Takip) sayfası */}
            {activeTab === 'personelBasvuru' && showPersonnel && <PersonelBasvuruView positions={positions} currentUser={currentUser} onHire={handleHireCandidate} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}
            {activeTab === 'addPersonnel' && showPersonnel && <AddPersonnelView onAdd={handleAddPersonnel} positions={positions} ranks={ranks} />}
            {activeTab === 'personnelList' && showPersonnel && <PersonnelListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} title="Personel Listesi" onViewProfile={(id) => { setViewingPersonnelProfileId(id); setActiveTab('personnelProfile'); }} pendingEditPersonnelId={pendingEditPersonnelId} setPendingEditPersonnelId={setPendingEditPersonnelId} onAddClick={() => setActiveTab('addPersonnel')} />}
            {activeTab === 'personnelProfile' && showPersonnel && <PersonnelProfileView personId={viewingPersonnelProfileId} personnelList={personnelList} jobs={jobs} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} onBack={() => setActiveTab('personnelList')} setActiveTab={setActiveTab} setPendingEditPersonnelId={setPendingEditPersonnelId} allPersonnelActions={allPersonnelActions} vehicles={vehicles} currentUser={currentUser} allMesaiRecords={allMesaiRecords} />}
            {activeTab === 'ozlukDosyalari' && showPersonnel && <OzlukDosyalariView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} currentUser={currentUser} />}
            {/* YENİ: Saha Raporlaması — şef denetimlerinin yönetim ekranı */}
            {activeTab === 'sahaRaporlamasi' && showPersonnel && <SahaRaporlamasiView personnelList={personnelList} db={db} appId={appId} setViewingImage={setViewingImage} jobs={jobs} onViewCari={(tel) => { setViewingCariKey(normalizeCariPhone(tel)); setActiveTab('customerProfile'); }} />}
            {/* YENİ: İK > Mesai Takip sayfası (QR + konum doğrulamalı giriş/çıkış) */}
            {activeTab === 'mesaiTakip' && showPersonnel && <MesaiTakipView personnelList={personnelList} currentUser={currentUser} jobs={jobs} onViewProfile={(id) => { setViewingPersonnelProfileId(id); setActiveTab('personnelProfile'); }} />}
            {activeTab === 'complaints' && showPersonnel && <ComplaintsView complaints={complaints} updateComplaintStatus={handleUpdateComplaintStatus} deleteComplaint={handleDeleteComplaint} />}
            {/* YENİ: Şirket Evrakları sayfası */}
            {activeTab === 'sirketEvraklari' && showPersonnel && <SirketEvraklariView db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} currentUser={currentUser} />}
            {/* YENİ: Dava Dosyaları (Şirket Dosyaları > Hukuk Takip Merkezi) sayfası — İK veya davaDosyalari yetkisiyle erişilir */}
            {activeTab === 'davaDosyalari' && (showPersonnel || showDavaDosyalari) && <DavaDosyalariView currentUser={currentUser} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}
            {/* YENİ: Şirket Evrakları (Şirket Dosyaları > Evrak Arşiv Merkezi) sayfası */}
            {activeTab === 'sirketBelgeleri' && showPersonnel && <SirketBelgeleriView currentUser={currentUser} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}
            {activeTab === 'addVehicle' && showOperasyon && <AddVehicleView onAdd={handleAddVehicle} onCancel={() => setActiveTab('vehicleList')} />}
            {activeTab === 'vehicleList' && showOperasyon && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
                  <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
                    <h2 className="text-xl font-bold text-black flex items-center gap-2">
                      <Car className="w-6 h-6 text-red-600" /> Araç Tahtası
                    </h2>
                    <button 
                      onClick={() => setActiveTab('addVehicle')}
                      className="bg-black text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition shadow-lg"
                    >
                      <PlusCircle className="w-5 h-5" /> Araç Ekle
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black text-white border-b border-neutral-200">
                        <tr>
                          <th className="p-4 font-bold rounded-tl-xl">Araç Plakası</th>
                          <th className="p-4 font-bold">Araç Fotoğrafı</th>
                          <th className="p-4 font-bold">Araç Cinsi</th>
                          <th className="p-4 font-bold">Taşıma Kapasitesi</th>
                          <th className="p-4 font-bold">Araç Detayları</th>
                          <th className="p-4 font-bold">Ruhsat</th>
                          <th className="p-4 font-bold">Profil</th>
                          <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {/* DEĞİŞİKLİK: Araçlar artık HACME GÖRE BÜYÜKTEN KÜÇÜĞE sıralanıyor.
                            ÖNEMLİ: [...vehicles] ile KOPYA alınır; sort() diziyi yerinde
                            değiştirdiği için doğrudan vehicles.sort() yazmak Firebase'den
                            gelen state'i bozar ve React'te beklenmedik render sorunlarına yol açar.
                            volume alanı "number" input'undan METİN olarak kaydedildiği için
                            parseFloat ile sayıya çevrilir; boş/geçersiz hacim 0 sayılır ve
                            böyle araçlar listenin en altına düşer. */}
                        {[...vehicles].sort((a, b) => (parseFloat(b.volume) || 0) - (parseFloat(a.volume) || 0)).map(vehicle => (
                          <tr key={vehicle.id} className="hover:bg-neutral-50 transition">
                            <td className="p-4 font-bold text-black text-lg whitespace-nowrap">
                              <div className="border-2 border-black rounded px-3 py-1.5 inline-flex items-center gap-2 bg-white shadow-sm">
                                <span className="bg-blue-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-sm">TR</span>
                                <span className="tracking-widest">{vehicle.plate.toUpperCase()}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {vehicle.vehiclePhoto && vehicle.vehiclePhoto !== 'Yükleniyor...' ? (
                                <button type="button" onClick={() => setViewingImage({ title: `${vehicle.plate} - Araç Fotoğrafı`, name: vehicle.vehiclePhoto })} className="block">
                                  <img src={vehicle.vehiclePhoto} alt={vehicle.plate} className="w-16 h-12 object-cover rounded-lg border border-neutral-200 hover:opacity-80 transition" />
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-400 font-medium">Yüklenmedi</span>
                              )}
                            </td>
                            <td className="p-4 font-bold text-neutral-800 text-base">{vehicle.type}</td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1.5">
                                {vehicle.capacity.map(cap => (
                                  <span key={cap} className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100">
                                    {cap} Ev
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4 text-neutral-600 text-xs">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <span><b className="text-black">Hacim:</b> {vehicle.volume ? `${vehicle.volume} m³` : '-'}</span>
                                <span><b className="text-black">KM:</b> {vehicle.km}</span>
                                <span><b className="text-black">Model:</b> {vehicle.model}</span>
                                <span><b className="text-black">Renk:</b> {vehicle.color}</span>
                                <span><b className="text-black">Vites:</b> {vehicle.transmission}</span>
                                {/* YENİ: Tonaj bilgisi */}
                                <span><b className="text-black">Tonaj:</b> {vehicle.tonnage ? `${parseFloat(vehicle.tonnage).toLocaleString('tr-TR')} kg` : '-'}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {vehicle.ruhsatFoto && vehicle.ruhsatFoto !== 'Yükleniyor...' ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingRuhsatUrl(vehicle.ruhsatFoto)}
                                  className="px-3 py-2 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-lg hover:bg-neutral-200 transition flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Ruhsatı Gör
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-400 font-medium">Yüklenmedi</span>
                              )}
                            </td>
                            <td className="p-4">
                              <button
                                type="button"
                                onClick={() => { setViewingVehicleProfileId(vehicle.id); setActiveTab('vehicleProfile'); }}
                                className="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <FolderOpen className="w-3.5 h-3.5" /> Araç Profiline Git
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingVehicle(vehicle);
                                    setVehicleEditForm(vehicle);
                                  }} 
                                  className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition" 
                                  title="Aracı Düzenle"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDeleteVehicle(vehicle.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition" title="Aracı Sil">
                                  <Ban className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {vehicles.length === 0 && (
                          <tr>
                            <td colSpan="8" className="p-6 text-center text-neutral-500">Kayıtlı araç bulunamadı.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* YENİ: MEVCUT ARAÇ FİLOSU TONAJ KAYDI — tüm araçların tonajlarının toplamı.
                      Tonaj bilgisi girilmemiş araçlar toplama dahil edilmez. */}
                  {vehicles.length > 0 && (
                    <div className="mt-5 bg-gradient-to-r from-neutral-900 to-black rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-black text-sm md:text-base">Mevcut Araç Filosu Tonaj Kaydı</p>
                          <p className="text-neutral-400 text-xs font-bold">{vehicles.length} araç • {vehicles.filter(v => parseFloat(v.tonnage) > 0).length} tanesinde tonaj bilgisi girili</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl md:text-3xl font-black text-white">
                          {vehicles.reduce((toplam, v) => toplam + (parseFloat(v.tonnage) || 0), 0).toLocaleString('tr-TR')} <span className="text-base font-bold text-neutral-400">kg</span>
                        </p>
                        <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Toplam Filo Tonajı</p>
                      </div>
                    </div>
                  )}
                </div>

                {editingVehicle && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                      <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Car className="w-5 h-5"/> Aracı Düzenle</h3>
                        <button onClick={() => setEditingVehicle(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
                      </div>
                      
                      <div  className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Plakası</label>
                            <input required type="text" value={vehicleEditForm.plate} onChange={(e) => setVehicleEditForm({...vehicleEditForm, plate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition uppercase" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Cinsi</label>
                            <select required value={vehicleEditForm.type} onChange={(e) => setVehicleEditForm({...vehicleEditForm, type: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                              <option value="Kamyon">Kamyon</option>
                              <option value="Kamyonet">Kamyonet</option>
                              <option value="Panelvan">Panelvan</option>
                              <option value="Minivan">Minivan</option>
                            </select>
                          </div>
                        </div>

                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                          <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-red-600" /> Araç Eşya Alma Kapasitesi
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['1+0', '1+1', '2+1', '3+1', '4+1'].map(cap => (
                              <label key={cap} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border text-sm transition-all ${vehicleEditForm.capacity?.includes(cap) ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100'}`}>
                                <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={vehicleEditForm.capacity?.includes(cap)} 
                                  onChange={() => {
                                    const newCap = vehicleEditForm.capacity?.includes(cap) 
                                      ? vehicleEditForm.capacity.filter(c => c !== cap) 
                                      : [...(vehicleEditForm.capacity || []), cap];
                                    setVehicleEditForm({...vehicleEditForm, capacity: newCap});
                                  }} 
                                />
                                {cap}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Hacim (m³)</label>
                            <input required type="number" value={vehicleEditForm.volume} onChange={(e) => setVehicleEditForm({...vehicleEditForm, volume: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç KM</label>
                            <input required type="number" value={vehicleEditForm.km} onChange={(e) => setVehicleEditForm({...vehicleEditForm, km: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Model (Yıl)</label>
                            <input required type="number" value={vehicleEditForm.model} onChange={(e) => setVehicleEditForm({...vehicleEditForm, model: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                          </div>
                          {/* YENİ: Tonaj (kg) — araç filosunun toplam taşıma kapasitesi hesabında kullanılır */}
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Tonaj (kg)</label>
                            <input type="number" value={vehicleEditForm.tonnage || ''} onChange={(e) => setVehicleEditForm({...vehicleEditForm, tonnage: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 3500" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Renk</label>
                            <select required value={vehicleEditForm.color} onChange={(e) => setVehicleEditForm({...vehicleEditForm, color: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                              <option value="Beyaz">Beyaz</option>
                              <option value="Gri">Gri</option>
                              <option value="Siyah">Siyah</option>
                              <option value="Yeşil">Yeşil</option>
                              <option value="Kırmızı">Kırmızı</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Vites</label>
                            <select required value={vehicleEditForm.transmission} onChange={(e) => setVehicleEditForm({...vehicleEditForm, transmission: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                              <option value="Manuel">Manuel</option>
                              <option value="Otomatik">Otomatik</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-neutral-700 mb-1">Gerekli Ehliyet</label>
                          <select required value={vehicleEditForm.requiredLicense || 'Küçük Ehliyet'} onChange={(e) => setVehicleEditForm({...vehicleEditForm, requiredLicense: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                            <option value="Küçük Ehliyet">Küçük Ehliyet</option>
                            <option value="Büyük Ehliyet">Büyük Ehliyet</option>
                          </select>
                        </div>

                        {/* ============================================================
                            YENİ: SİGORTA (TRAFİK) VE KASKO MALİYETİ
                            ============================================================ */}
                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-4">
                          <label className="block text-sm font-bold text-black flex items-center gap-2">
                            <Shield className="w-4 h-4 text-red-600" /> Sigorta ve Kasko Maliyeti
                          </label>
                          <div>
                            <p className="text-[11px] font-black text-neutral-500 uppercase mb-1.5">Trafik Sigortası</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Yıllık Tutar (₺)</label>
                                <input type="number" step="0.01" min="0" value={vehicleEditForm.sigortaTutari || ''} onChange={e => setVehicleEditForm({ ...vehicleEditForm, sigortaTutari: e.target.value })} placeholder="Örn: 12500" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Bitiş Tarihi</label>
                                <input type="date" value={vehicleEditForm.sigortaBitis || ''} onChange={e => setVehicleEditForm({ ...vehicleEditForm, sigortaBitis: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Sigorta Şirketi</label>
                                <input value={vehicleEditForm.sigortaSirketi || ''} onChange={e => setVehicleEditForm({ ...vehicleEditForm, sigortaSirketi: e.target.value })} placeholder="Örn: Anadolu Sigorta" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-neutral-500 uppercase mb-1.5">Kasko</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Yıllık Tutar (₺)</label>
                                <input type="number" step="0.01" min="0" value={vehicleEditForm.kaskoTutari || ''} onChange={e => setVehicleEditForm({ ...vehicleEditForm, kaskoTutari: e.target.value })} placeholder="Örn: 28000" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Bitiş Tarihi</label>
                                <input type="date" value={vehicleEditForm.kaskoBitis || ''} onChange={e => setVehicleEditForm({ ...vehicleEditForm, kaskoBitis: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Kasko Şirketi</label>
                                <input value={vehicleEditForm.kaskoSirketi || ''} onChange={e => setVehicleEditForm({ ...vehicleEditForm, kaskoSirketi: e.target.value })} placeholder="Örn: Axa Sigorta" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                              </div>
                            </div>
                          </div>
                          {/* Toplam gider + yaklaşan yenileme uyarısı */}
                          {(() => {
                            const sig = parseFloat(vehicleEditForm.sigortaTutari) || 0;
                            const kas = parseFloat(vehicleEditForm.kaskoTutari) || 0;
                            const toplam = sig + kas;
                            const kalanGun = (t) => { if (!t) return null; const f = Math.ceil((new Date(t) - new Date()) / 86400000); return isNaN(f) ? null : f; };
                            const sg = kalanGun(vehicleEditForm.sigortaBitis), kg = kalanGun(vehicleEditForm.kaskoBitis);
                            const uyarilar = [];
                            if (sg !== null && sg <= 30) uyarilar.push(sg < 0 ? `Trafik sigortası ${Math.abs(sg)} gün önce doldu` : `Trafik sigortası ${sg} gün sonra bitiyor`);
                            if (kg !== null && kg <= 30) uyarilar.push(kg < 0 ? `Kasko ${Math.abs(kg)} gün önce doldu` : `Kasko ${kg} gün sonra bitiyor`);
                            if (toplam === 0 && uyarilar.length === 0) return null;
                            return (
                              <div className="pt-3 border-t border-neutral-200 space-y-2">
                                {toplam > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-neutral-600">Yıllık toplam sigorta gideri</span>
                                    <span className="text-sm font-black text-black">{toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                                  </div>
                                )}
                                {uyarilar.map((u, i) => (
                                  <p key={i} className="text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {u}
                                  </p>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* ============================================================
                            YENİ: ARAÇ BELGELERİ (BİRDEN FAZLA)
                            ============================================================ */}
                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                          <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-red-600" /> Araç Belgeleri
                            <span className="text-[10px] font-medium text-neutral-400">(fotoğraf / PDF — birden fazla)</span>
                          </label>
                          {(vehicleEditForm.belgeler || []).length > 0 && (
                            <div className="space-y-1.5 mb-3">
                              {vehicleEditForm.belgeler.map((b, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl p-2">
                                  {b.type === 'image'
                                    ? <img src={b.url} alt={b.name} className="w-10 h-10 rounded-lg object-cover border border-neutral-200 shrink-0" />
                                    : <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-red-500" /></div>}
                                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs font-bold text-black hover:text-red-600 hover:underline truncate" title={b.name}>{b.name}</a>
                                  <button type="button" onClick={() => setVehicleEditForm(prev => ({ ...prev, belgeler: (prev.belgeler || []).filter((_, x) => x !== i) }))} className="p-1.5 text-neutral-300 hover:text-red-600 transition shrink-0" title="Belgeyi kaldır">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <label className={`w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer flex items-center justify-center gap-2 text-sm font-black transition ${aracBelgeYukleniyor ? 'border-neutral-200 text-neutral-300 cursor-wait' : 'border-red-300 text-red-600 hover:bg-red-50'}`}>
                            {aracBelgeYukleniyor ? <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</> : <><PlusCircle className="w-4 h-4" /> Belge Ekle</>}
                            <input type="file" multiple accept="image/*,application/pdf" disabled={aracBelgeYukleniyor} className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;
                                setAracBelgeYukleniyor(true);
                                const yeniler = [];
                                for (const file of files) {
                                  const fd = new FormData();
                                  fd.append('file', file);
                                  try {
                                    const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
                                    const text = await res.text();
                                    let url = file.name;
                                    try { const json = JSON.parse(text); url = json.url || json.fileName || json.file || text; } catch (err) { url = text.trim(); }
                                    const uz = (file.name.split('.').pop() || '').toLowerCase();
                                    const tip = ['jpg','jpeg','png','gif','webp','heic','heif','bmp'].includes(uz) ? 'image' : (uz === 'pdf' ? 'pdf' : 'file');
                                    yeniler.push({ url, name: file.name, type: tip, eklenme: new Date().toISOString() });
                                  } catch (err) { console.error('Belge yüklenemedi:', file.name, err); alert(`"${file.name}" yüklenemedi.`); }
                                }
                                setVehicleEditForm(prev => ({ ...prev, belgeler: [...(prev.belgeler || []), ...yeniler] }));
                                setAracBelgeYukleniyor(false);
                                e.target.value = '';
                              }} />
                          </label>
                          {(vehicleEditForm.belgeler || []).length > 0 && (
                            <p className="text-[10px] font-bold text-neutral-400 mt-1.5 text-center">{vehicleEditForm.belgeler.length} belge eklendi</p>
                          )}
                        </div>

                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                          <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                            <Camera className="w-4 h-4 text-red-600" /> Araç Fotoğrafı
                          </label>
                          {vehicleEditForm.vehiclePhoto && vehicleEditForm.vehiclePhoto !== 'Yükleniyor...' && (
                            <img src={vehicleEditForm.vehiclePhoto} alt="Araç" className="h-28 rounded-lg border border-neutral-200 mb-2 object-cover" />
                          )}
                          <MediaCaptureMenu
                            buttonLabel="Araç Fotoğrafı Ekle"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              setVehicleEditForm(prev => ({ ...prev, vehiclePhoto: 'Yükleniyor...' }));
                              const uploadData = new FormData();
                              uploadData.append('file', file);
                              try {
                                const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: uploadData });
                                const text = await res.text();
                                let uploadedUrl = file.name;
                                try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
                                setVehicleEditForm(prev => ({ ...prev, vehiclePhoto: uploadedUrl }));
                              } catch (err) {
                                console.error('Araç fotoğrafı yükleme hatası:', err);
                                setVehicleEditForm(prev => ({ ...prev, vehiclePhoto: '' }));
                              }
                            }}
                          />
                          {vehicleEditForm.vehiclePhoto === 'Yükleniyor...' && <p className="text-xs text-neutral-400 mt-1">Yükleniyor...</p>}
                        </div>

                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                          <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-red-600" /> Araç Ruhsat Fotoğrafı
                          </label>
                          {vehicleEditForm.ruhsatFoto && vehicleEditForm.ruhsatFoto !== 'Yükleniyor...' && (
                            isVideoUrl(vehicleEditForm.ruhsatFoto) ? (
                              <video src={vehicleEditForm.ruhsatFoto} controls className="h-28 rounded-lg border border-neutral-200 mb-2 bg-black" />
                            ) : (
                              <img src={vehicleEditForm.ruhsatFoto} alt="Ruhsat" className="h-28 rounded-lg border border-neutral-200 mb-2 object-cover" />
                            )
                          )}
                          <MediaCaptureMenu
                            buttonLabel="Ruhsat Fotoğrafı / Videosu Ekle"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              setVehicleEditForm(prev => ({ ...prev, ruhsatFoto: 'Yükleniyor...' }));
                              const uploadData = new FormData();
                              uploadData.append('file', file);
                              try {
                                const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: uploadData });
                                const text = await res.text();
                                let uploadedUrl = file.name;
                                try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
                                setVehicleEditForm(prev => ({ ...prev, ruhsatFoto: uploadedUrl }));
                              } catch (err) {
                                console.error('Ruhsat yükleme hatası:', err);
                                setVehicleEditForm(prev => ({ ...prev, ruhsatFoto: '' }));
                              }
                            }}
                          />
                          {vehicleEditForm.ruhsatFoto === 'Yükleniyor...' && <p className="text-xs text-neutral-400 mt-1">Yükleniyor...</p>}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-neutral-100">
                          <button type="button" onClick={() => setEditingVehicle(null)} className="flex-1 py-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">İptal</button>
                          <button type="button" onClick={(e) => { e.preventDefault(); handleUpdateVehicle(vehicleEditForm); }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/20">Değişiklikleri Kaydet</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {viewingRuhsatUrl && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setViewingRuhsatUrl(null)}>
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                  <div className="bg-black text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Araç Ruhsatı</h3>
                    <button onClick={() => setViewingRuhsatUrl(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-4 bg-neutral-100 flex justify-center">
                    {isVideoUrl(viewingRuhsatUrl) ? (
                      <video src={viewingRuhsatUrl} controls autoPlay className="max-h-[70vh] rounded-lg bg-black" />
                    ) : (
                      <img src={viewingRuhsatUrl} alt="Araç Ruhsatı" className="max-h-[70vh] rounded-lg object-contain" />
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'vehicleMaintenance' && showOperasyon && <VehicleMaintenanceView vehicles={vehicles} onUpdateVehicle={handleUpdateVehicle} addSystemLog={addSystemLog} />}
            {activeTab === 'vehicleProfile' && showOperasyon && <VehicleProfileView vehicleId={viewingVehicleProfileId} vehicles={vehicles} jobs={jobs} handleEditJob={handleEditJob} setViewingRuhsatUrl={setViewingRuhsatUrl} onBack={() => setActiveTab('vehicleList')} />}

            {/* NOT: "Yeni Ekle" artık tam sayfa değil, aşağıda modal olarak render ediliyor (showAddTodoModal) */}
            {/* KALDIRILDI: "Takip ve Yapılacak İşler" sayfası kullanıcı isteğiyle kapatıldı.
                TodoListView bileşeni ve todos verisi silinmedi (Anasayfa'daki sayaçlar vb.
                başka yerler kullanıyor olabilir); yalnızca bu rota render edilmiyor.
                Geri açmak isterseniz aşağıdaki satırın başındaki `false &&` kısmını kaldırın. */}
            {false && activeTab === 'todoList' && showTodos && <TodoListView todos={todos} handleUpdateTodoStatus={handleUpdateTodoStatus} handleDeleteTodo={handleDeleteTodo} onAddClick={() => setShowAddTodoModal(true)} />}

            {/* YENİ: İŞ KILAVUZU VE İŞ ŞEMASI — pozisyona göre görev rehberi.
                Kaldırılan "Takip ve Yapılacak İşler" sayfasının yerine geçti. */}
            {activeTab === 'isKilavuzu' &&
              <IsKilavuzuView currentUser={currentUser} personnelList={personnelList} addSystemLog={addSystemLog} />}

            {activeTab === 'materialList' && showOperasyon && <MaterialListView materials={materials} onDelete={handleDeleteMaterial} onUpdateStock={handleUpdateMaterialStock} onAdd={handleAddMaterial} systemLogs={systemLogs} />}
            
            {activeTab === 'financeDashboard' && showFinance && <FinanceDashboardView jobs={jobs} transactions={transactions} transactionType={transactionType} setTransactionType={setTransactionType} newTransaction={newTransaction} setNewTransaction={setNewTransaction} handleAddTransaction={handleAddTransaction} personnelList={personnelList} handleEditJob={handleEditJob} db={db} appId={appId} />}
            {activeTab === 'reporting' && showFinance && <ReportingView jobs={jobs} personnelList={personnelList} />}
            {activeTab === 'advancedReporting' && showFinance && <AdvancedReportingView jobs={jobs} />}
            {/* DEĞİŞİKLİK: currentUser eklendi — avans ve maaş ödemeleri deftere
                yazılırken "işlemi kim yaptı" bilgisinin kayda geçmesi için gerekli. */}
            {activeTab === 'personelMuhasebe' && showFinance && <PersonelMuhasebeView personnelList={personnelListMuhasebe} db={db} appId={appId} addSystemLog={addSystemLog} currentUser={currentUser} />}
            {activeTab === 'personelOdeme' && showFinance && <PersonelOdemeView personnelList={personnelListMuhasebe} transactions={transactions} db={db} appId={appId} addSystemLog={addSystemLog} currentUser={currentUser} />}
            {/* YENİ: Defter — kasa/cari alacak-verecek takibi */}
            {/* YENİ: Defter satırındaki müşteri adı ve araç plakası tıklanabilir oldu.
                Gezinme App.jsx'te yapılıyor çünkü cari anahtarı ve araç listesi
                burada; plakadan araç kimliğine çeviren arama da burada yapılır.
                Araç bulunamazsa sessiz kalmıyoruz, kullanıcıya bilgi veriyoruz. */}
            {activeTab === 'finansDefter' && showFinance && <FinansDefterView currentUser={currentUser} addSystemLog={addSystemLog} jobs={jobs} vehicles={vehicles} personnelList={personnelList}
              onViewCari={(tel) => { if (!tel) return; setViewingCariKey(normalizeCariPhone(tel)); setActiveTab('customerProfile'); }}
              onViewPersonnel={(personelId) => {
                if (!personelId) return;
                setViewingPersonnelProfileId(personelId); setActiveTab('personnelProfile');
              }}
              onViewVehicle={(plaka) => {
                if (!plaka) return;
                const temiz = (x) => (x || '').toString().replace(/\s/g, '').toUpperCase();
                const arac = vehicles.find(v => temiz(v.plate) === temiz(plaka));
                if (arac) { setViewingVehicleProfileId(arac.id); setActiveTab('vehicleProfile'); }
                else { alert(`"${plaka}" plakalı araç, araç listesinde bulunamadı. Araç kaydı silinmiş olabilir.`); }
              }} />}

            {activeTab === 'addTask' && showOperasyon &&
              <AddTaskFormView 
                newTask={newTask}
                setNewTask={setNewTask}
                handleAddTask={handleAddTask}
                personnelList={personnelList}
              />
            }
            {activeTab === 'taskList' && showOperasyon &&
              <TaskManagerView 
                tasks={tasks}
                setShowTaskModal={setShowTaskModal}
                draggingTask={draggingTask}
                setDraggingTask={setDraggingTask}
                openEditTask={openEditTask}
                handleUpdateTaskStatus={handleUpdateTaskStatus}
                handleDeleteTask={handleDeleteTask}
              />
            }
            
            {activeTab === 'userList' && showAuth && (
              <div className="max-w-5xl mx-auto">
                {/* YENİ: Mevcut Kullanıcılar / İzinler Yönetimi / Modül Görüntüleme / Pozisyonlar /
                    Rütbeler artık aynı sayfada sekme olarak bir arada; ayrı sol menü öğeleri kaldırıldı. */}
                <div className="flex flex-wrap gap-2 mb-4 bg-neutral-100 p-1.5 rounded-xl">
                  <button onClick={() => setKullaniciYonetimSekme('kullanicilar')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${kullaniciYonetimSekme === 'kullanicilar' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                    <Users className="w-4 h-4" /> Mevcut Kullanıcılar
                  </button>
                  <button onClick={() => setKullaniciYonetimSekme('izinler')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${kullaniciYonetimSekme === 'izinler' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                    <Shield className="w-4 h-4" /> İzinler Yönetimi
                  </button>
                  <button onClick={() => setKullaniciYonetimSekme('modul')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${kullaniciYonetimSekme === 'modul' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                    <Eye className="w-4 h-4" /> Modül Görüntüleme
                  </button>
                  <button onClick={() => setKullaniciYonetimSekme('pozisyonlar')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${kullaniciYonetimSekme === 'pozisyonlar' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                    <Briefcase className="w-4 h-4" /> Pozisyonlar
                  </button>
                  <button onClick={() => setKullaniciYonetimSekme('rutbeler')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${kullaniciYonetimSekme === 'rutbeler' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                    <Star className="w-4 h-4" /> Rütbeler
                  </button>
                </div>
                {kullaniciYonetimSekme === 'kullanicilar' && <UserListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} onDelete={handleDeletePersonnel} positions={positions} ranks={ranks} positionModules={positionModules} moduleCatalog={moduleCatalog} />}
                {kullaniciYonetimSekme === 'izinler' && <PermissionsView personnelList={personnelList} handleUpdatePermissions={handleUpdatePermissions} positions={positions} />}
                {kullaniciYonetimSekme === 'modul' && <ModuleAccessView moduleCatalog={moduleCatalog} addSystemLog={addSystemLog} />}
                {kullaniciYonetimSekme === 'pozisyonlar' && <PositionsView positions={positions} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} onUpdatePosition={handleUpdatePosition} />}
                {kullaniciYonetimSekme === 'rutbeler' && <RanksView ranks={ranks} onAddRank={handleAddRank} onDeleteRank={handleDeleteRank} onUpdateRank={handleUpdateRank} />}
              </div>
            )}
            {/* NOT: "Pozisyonlar" ve "Rütbeler" sayfa rotaları (activeTab === 'positions' / 'ranks')
                geriye dönük uyumluluk için hâlâ mevcut; menüden erişim yukarıdaki sekmelerden yapılır. */}
            {activeTab === 'positions' && showAuth && <PositionsView positions={positions} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} onUpdatePosition={handleUpdatePosition} />}
            {activeTab === 'ranks' && showAuth && <RanksView ranks={ranks} onAddRank={handleAddRank} onDeleteRank={handleDeleteRank} onUpdateRank={handleUpdateRank} />}
            {activeTab === 'permissions' && showAuth && <PermissionsView personnelList={personnelList} handleUpdatePermissions={handleUpdatePermissions} positions={positions} />}
            {activeTab === 'moduleAccess' && showAuth && <ModuleAccessView moduleCatalog={moduleCatalog} addSystemLog={addSystemLog} />}
            
            {activeTab === 'backupSystem' && showSystemFiles && <SystemFilesView jobs={jobs} personnelList={personnelList} vehicles={vehicles} materials={materials} db={db} appId={appId} addSystemLog={addSystemLog} onJobDeleted={(idler) => setArsivIsler(prev => prev.filter(j => !idler.includes(j.id)))} />}
            {activeTab === 'systemLogs' && showSystemFiles && <SystemLogsView logs={systemLogs} />}
            {activeTab === 'userActivities' && showSystemFiles && <UserActivitiesView personnelList={personnelList} />}
            {activeTab === 'companyPasswords' && showSystemFiles && <CompanyPasswordsView passwords={companyPasswords} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'appSettings' && showSystemFiles && <AppSettingsView db={db} appId={appId} addSystemLog={addSystemLog} appBranding={appBranding} />}
            {/* YENİ: Resmi Ayarları — sözleşme maddeleri ve şirket IBAN yönetimi.
                Uygulama Ayarları ile aynı yetkiye (systemFiles) bağlıdır. */}
            {activeTab === 'resmiAyarlar' && showSystemFiles && <ResmiAyarlarView db={db} appId={appId} addSystemLog={addSystemLog} currentUser={currentUser} />}
          </div>
        </main>

        {cancelJobId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95 shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">İşi İptal Et</h3>
              <p className="text-neutral-600 mb-6 text-sm font-medium">Bu operasyonu iptal etmek istediğinize emin misiniz? İptal edilen işler takvimden kaldırılacaktır.</p>
              <div className="flex gap-3">
                <button onClick={() => setCancelJobId(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={() => { handleCancelJob(cancelJobId); setCancelJobId(null); }} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30">Evet, İptal Et</button>
              </div>
            </div>
          </div>
        )}

        {deleteJobId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95 shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Kalıcı Olarak Sil</h3>
              <p className="text-neutral-600 mb-6 text-sm font-medium">Bu operasyonu sistemden kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteJobId(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={() => { handleCompletelyDeleteJob(deleteJobId); setDeleteJobId(null); }} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30">Evet, Tamamen Sil</button>
              </div>
            </div>
          </div>
        )}

        {showChangeDateModal && jobToChangeDate && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95 shadow-2xl">
              <CalendarDays className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">İşin Tarihini Değiştir</h3>
              <p className="text-neutral-600 mb-4 text-sm font-medium">Bu operasyonun gününü değiştirdiğinizde, bağlı asansör işi de (varsa) yeni güne taşınacaktır.</p>
              
              <div className="mb-6 text-left">
                 <label className="block text-sm font-bold text-black mb-1">Yeni Tarih</label>
                 <input 
                    type="date" 
                    value={newJobDate} 
                    onChange={e => setNewJobDate(e.target.value)} 
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-orange-600 outline-none transition font-bold" 
                 />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowChangeDateModal(false); setJobToChangeDate(null); setNewJobDate(''); }} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={submitChangeJobDate} className="flex-1 p-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition shadow-lg shadow-orange-600/30">Tarihi Güncelle</button>
              </div>
            </div>
          </div>
        )}

        {markDamageJobId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95 shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Hasar Kaydı Oluştur</h3>
              <p className="text-neutral-600 mb-6 text-sm font-medium">Bu operasyonda hasar oluştuğunu onaylıyor musunuz? İşlem sonrası bu kayıt "Hasarlı İşler" sekmesinde görüntülenecektir.</p>
              <div className="flex gap-3">
                <button onClick={() => setMarkDamageJobId(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Hayır, Vazgeç</button>
                <button onClick={() => { handleMarkAsDamaged(markDamageJobId); setMarkDamageJobId(null); }} className="flex-1 p-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition shadow-lg shadow-orange-600/30">Evet, Onaylıyorum</button>
              </div>
            </div>
          </div>
        )}

        {showAssignModal && jobToAssign && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  Personele Görev Ata
                  <button 
                    type="button" 
                    onClick={() => setTeamSuggestion(teamSuggestion ? null : generateTeamSuggestion(jobToAssign))}
                    className="ml-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-sm hover:bg-red-500 transition shadow-sm font-black"
                    title="Sistem Tahmini Ekip Önerisi"
                  >
                    ?
                  </button>
                </h3>
                <button onClick={() => {setShowAssignModal(false); setTeamSuggestion(null);}} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {teamSuggestion && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-black text-indigo-900 flex items-center gap-2 mb-2 text-sm">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Tahmini Ekip Önerisi ({teamSuggestion.targetCount} Kişi)
                    </h4>
                    <ul className="text-[10px] text-indigo-800 font-medium list-disc pl-4 mb-3 space-y-0.5 leading-relaxed">
                      {teamSuggestion.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {teamSuggestion.suggested.map((p, idx) => (
                         <div key={idx} className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-sm ${p.isExternal ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-white text-indigo-900 border-indigo-200'}`}>
                           <User className="w-3 h-3 opacity-70" />
                           {p.fullName} <span className="opacity-70 font-medium text-[9px]">({p.position})</span>
                         </div>
                      ))}
                    </div>
                  </div>
                )}
                <div  className="space-y-5">
                  <p className="text-sm text-neutral-600 pb-2 border-b border-neutral-100">
                    <b className="text-black">Müşteri:</b> {jobToAssign.customerName} <br/>
                    <b className="text-black">Tarih:</b> {jobToAssign.date}
                  </p>

                  <div>
                    <label className="block text-sm font-bold text-black mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" /> Operasyon Notu
                    </label>
                    <textarea 
                      value={assignOperationNote} 
                      onChange={(e) => setAssignOperationNote(e.target.value)} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none h-20 text-sm font-medium bg-white" 
                      placeholder="Ekibe iletilecek operasyon notu ekleyin veya düzenleyin..." 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Asıl Görevli (Ekip Şefi / Sorumlu)</label>
                    <select required value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                      <option value="">Lütfen personel seçiniz...</option>
                      {jobToAssign.type === 'Asansör' ? (
                        personnelList.filter(p => p.position === 'Operatör').map(person => (
                          <option key={person.id} value={person.id}>{person.fullName} - {person.position} ({person.rank})</option>
                        ))
                      ) : (
                        personnelList.filter(p => p.rank === 'Ekip Şefi' || p.rank === 'Kalfa').map(person => (
                          <option key={person.id} value={person.id}>{person.fullName} - {person.position} ({person.rank})</option>
                        ))
                      )}
                    </select>
                  </div>

                  {assigneeId && jobToAssign.type === 'Asansör' && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-100 pt-4 mb-2 space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-red-600" /> Hangi Araçla İşe Gidecek?
                        </label>
                        <select value={assignedVehiclePlate} onChange={(e) => setAssignedVehiclePlate(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                          <option value="">Araç Seçilmedi</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-bold text-black flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-red-600" /> Hangi Araca Asansör Kuracak?
                          </label>
                          <button type="button" onClick={() => setIsTargetVehicleExternal(!isTargetVehicleExternal)} className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-1 rounded-lg border border-neutral-200 font-bold hover:bg-neutral-200 transition">
                            {isTargetVehicleExternal ? 'Sistemden Seç' : 'Sistem Dışı Araç'}
                          </button>
                        </div>
                        {isTargetVehicleExternal ? (
                          <input type="text" value={assignedTargetVehiclePlate} onChange={(e) => setAssignedTargetVehiclePlate(e.target.value)} placeholder="Örn: 34 ABC 123 (Dışarıdan Araç)" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-sm" />
                        ) : (
                          <select value={assignedTargetVehiclePlate} onChange={(e) => setAssignedTargetVehiclePlate(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                            <option value="">Araç Seçilmedi</option>
                            {vehicles.map(v => (
                              <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-600" /> Saat Kaçta İşe Gidecek?
                        </label>
                        <input type="time" value={assignedJobTime} onChange={(e) => setAssignedJobTime(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium" />
                      </div>
                    </div>
                  )}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (() => {
                    const busyPersonnelIdsThisDay = jobs
                      .filter(j => j.date === jobToAssign.date && j.id !== jobToAssign.id && j.status !== 'cancelled')
                      .flatMap(j => j.assignedPersonnelIds || []);

                    const availablePersonnel = personnelList.filter(p => 
                      p.id !== parseInt(assigneeId) && 
                      ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(p.position) &&
                      (showBusyPersonnel || !busyPersonnelIdsThisDay.includes(p.id))
                    );

                    return (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-bold text-black flex items-center gap-2">
                            <Users className="w-4 h-4 text-red-600" /> Beraber Gidecek Diğer Personeller
                          </label>
                          <button 
                            type="button" 
                            onClick={() => setShowBusyPersonnel(!showBusyPersonnel)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-bold border transition ${showBusyPersonnel ? 'bg-red-50 text-red-600 border-red-200' : 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}
                          >
                            {showBusyPersonnel ? 'Meşgulleri Gizle' : '+ İkinci İşi Ata'}
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-neutral-300 rounded-xl p-2 bg-white space-y-1 custom-scrollbar">
                          {availablePersonnel.map(person => {
                            const isBusy = busyPersonnelIdsThisDay.includes(person.id);
                            return (
                              <label key={person.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer transition border border-transparent hover:border-neutral-200">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-600 cursor-pointer"
                                  checked={additionalAssignees.includes(person.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setAdditionalAssignees([...additionalAssignees, person.id]);
                                    else setAdditionalAssignees(additionalAssignees.filter(id => id !== person.id));
                                  }}
                                />
                                <span className="text-sm font-medium text-black flex-1 flex items-center gap-2">
                                  {person.fullName} <span className="text-xs text-neutral-500">({person.position})</span>
                                  {isBusy && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 font-bold ml-auto">Başka İşi Var</span>}
                                </span>
                              </label>
                            );
                          })}
                          {availablePersonnel.length === 0 && (
                            <p className="text-xs text-neutral-500 p-2">Bu tarihte müsait durumda uygun pozisyonda (Şoför, Usta, Taşıma Elemanı) personel bulunmuyor.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-100 pt-4 mb-2">
                      <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-red-600" /> Operasyon Aracı (Plaka Seçimi)
                      </label>
                      <select value={assignedVehiclePlate} onChange={(e) => setAssignedVehiclePlate(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                        <option value="">Araç Seçilmedi (İsteğe Bağlı)</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-100 pt-4 mb-2">
                      <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4 text-red-600" /> Operasyon Malzemeleri (Tahmini ve Özel)
                      </label>
                      <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-3">
                        <p className="text-[11px] text-neutral-500 font-medium border-b border-neutral-200 pb-2">
                          Sistemin otomatik tahmin ettiği miktarları ayarlayabilir veya listeye yeni malzeme ekleyebilirsiniz.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {['strec', 'bant', 'poset', 'kagit', 'koli'].map(key => (
                            <div key={key} className="flex items-center justify-between bg-white border border-neutral-200 p-2 rounded-lg shadow-sm">
                              <span className="text-xs font-bold text-neutral-700 capitalize">
                                {key === 'strec' ? 'Streç' : key === 'kagit' ? 'Kağıt' : key}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button type="button" onClick={() => setAssignedMaterials(prev => ({...prev, [key]: Math.max(0, prev[key] - 0.5)}))} className="w-5 h-5 bg-red-50 text-red-600 rounded flex items-center justify-center font-bold hover:bg-red-100 transition">-</button>
                                <span className="text-xs font-black w-6 text-center">{assignedMaterials[key]}</span>
                                <button type="button" onClick={() => setAssignedMaterials(prev => ({...prev, [key]: prev[key] + 0.5}))} className="w-5 h-5 bg-green-50 text-green-600 rounded flex items-center justify-center font-bold hover:bg-green-100 transition">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-2 border-t border-neutral-200">
                          <label className="block text-[11px] font-bold text-neutral-600 mb-1.5">Ekstra Malzeme Ekle</label>
                          <div className="flex gap-2">
                            <select value={newCustomMaterial.name} onChange={e => setNewCustomMaterial({...newCustomMaterial, name: e.target.value})} className="flex-1 p-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 text-xs font-bold bg-white cursor-pointer">
                              <option value="">Listeden Malzeme Seçin...</option>
                              {materials.filter(m => !['streç', 'bant', 'poşet', 'kağıt', 'koli'].includes(m.name.toLowerCase())).map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ))}
                            </select>
                            <input type="number" value={newCustomMaterial.amount} onChange={e => setNewCustomMaterial({...newCustomMaterial, amount: parseFloat(e.target.value) || 0})} className="w-16 p-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 text-xs text-center font-bold bg-white" min="0.5" step="0.5" />
                            <button type="button" onClick={() => {
                              const matName = newCustomMaterial.name.trim();
                              if(matName) {
                                const existingIdx = customMaterials.findIndex(c => c.name === matName);
                                if (existingIdx > -1) {
                                    const updated = [...customMaterials];
                                    updated[existingIdx].amount += newCustomMaterial.amount;
                                    setCustomMaterials(updated);
                                } else {
                                    setCustomMaterials([...customMaterials, { id: Date.now(), name: matName, amount: newCustomMaterial.amount }]);
                                }
                                setNewCustomMaterial({ name: '', amount: 1 });
                              }
                            }} className="bg-neutral-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm">Ekle</button>
                          </div>
                          
                          {customMaterials.length > 0 && (
                            <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                              {customMaterials.map(cm => (
                                <div key={cm.id} className="flex items-center justify-between bg-white border border-neutral-200 p-2 rounded-lg shadow-sm">
                                  <span className="text-xs font-bold text-neutral-700">{cm.name} <span className="text-neutral-500">({cm.amount} Adet)</span></span>
                                  <button type="button" onClick={() => setCustomMaterials(customMaterials.filter(c => c.id !== cm.id))} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-black flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-red-600" /> Sistem Dışı / Yevmiyeli Personel
                        </label>
                        <button 
                          type="button" 
                          onClick={handleAddManualAssignee}
                          className="text-xs bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-200 transition font-bold flex items-center gap-1 border border-neutral-200"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Yeni Ekle
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {manualExtraAssignees.length === 0 ? (
                          <p className="text-xs text-neutral-500 italic px-1">Dışarıdan yevmiyeli personel eklemek için "Yeni Ekle" butonuna tıklayın.</p>
                        ) : (
                          manualExtraAssignees.map((name, index) => (
                            <div key={index} className="flex gap-2 animate-in slide-in-from-left-2">
                              <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => handleManualAssigneeChange(index, e.target.value)} 
                                className="flex-1 p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium text-sm" 
                                placeholder={`Ekstra Personel ${index + 1} (Örn: Yevmiyeli Ahmet)`} 
                              />
                              <button 
                                type="button" 
                                onClick={() => handleRemoveManualAssignee(index)}
                                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition border border-red-100"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs font-medium text-blue-700 flex items-start gap-2">
                    <Bell className="w-4 h-4 shrink-0 mt-0.5" /> 
                    Görevi atadığınızda seçtiğiniz tüm personellerin paneline anında bildirim olarak düşecektir.
                  </div>

                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={submitAssignJob} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20">
                      <CheckSquare className="w-5 h-5" /> Görevi Onayla ve Atamayı Yap
                    </button>

                    {jobToAssign.team !== 'Atanmadı' && (
                      <button type="button" onClick={submitRemoveAssignment} className="w-full py-4 bg-neutral-100 text-red-600 font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-2 border border-red-100">
                        <Ban className="w-5 h-5" /> Atamayı Kaldır / Temizle
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {aiModal.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> {aiModal.title}</h3>
                <button onClick={() => setAiModal({ isOpen: false, loading: false, content: '', title: '', type: '' })} className="text-white/80 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6">
                {aiModal.loading ? (
                  <div className="flex flex-col items-center justify-center py-10 text-purple-600">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p className="font-bold animate-pulse">Yapay Zeka Hazırlıyor...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea 
                      readOnly
                      value={aiModal.content}
                      className="w-full p-4 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none min-h-[12rem] resize-none transition bg-neutral-50 text-sm font-medium" 
                    />
                    {aiModal.type === 'material' && !aiModal.alreadyDeducted && (
                      <button onClick={handleDeductMaterials} className="w-full py-4 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition flex justify-center items-center gap-2 shadow-lg">
                        <Package className="w-5 h-5" /> Malzemeleri Stoktan Düş
                      </button>
                    )}
                    <CopyButton content={aiModal.content} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewingImage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
                <h3 className="font-bold text-lg">{viewingImage.title}</h3>
                <button onClick={() => setViewingImage(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 flex flex-col items-center w-full">
                <div className="w-full aspect-video bg-neutral-100 rounded-xl border border-neutral-300 flex flex-col items-center justify-center mb-4 overflow-hidden relative shadow-inner">
                  {viewingImage.name.startsWith('http') ? (
                    isVideoUrl(viewingImage.name) ? (
                      <video src={viewingImage.name} controls autoPlay muted className="w-full h-full object-contain z-10 bg-black" />
                    ) : (
                      <img src={viewingImage.name} alt="Görsel" className="w-full h-full object-contain z-10" />
                    )
                  ) : (
                    <Camera className="w-16 h-16 text-neutral-300 z-10" />
                  )}
                </div>
                
                {viewingImage.name.startsWith('http') && (
                  <div className="w-full flex flex-col gap-2 mb-4">
                    <a href={viewingImage.name} target="_blank" rel="noreferrer" className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition flex justify-center items-center gap-2 border border-red-200">
                      <ArrowUpRight className="w-5 h-5" /> Görseli / Dosyayı Aç
                    </a>
                    <p className="text-[10px] text-neutral-400 text-center truncate px-2">
                      Link: {viewingImage.name}
                    </p>
                  </div>
                )}
                
                <button onClick={() => setViewingImage(null)} className="w-full py-4 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl transition shadow-lg mt-auto">Kapat</button>
              </div>
            </div>
          </div>
        )}

        {showTaskModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
                <h3 className="font-bold text-lg">Yeni Görev Oluştur</h3>
                <button onClick={() => setShowTaskModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div  className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Görev Başlığı</label>
                  <input required type="text" value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" placeholder="Örn: Müşteri aramaları yapılacak" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Detaylar</label>
                  <textarea required value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none h-24 resize-none transition" placeholder="Görev açıklaması..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Görevli</label>
                    <select value={newTask.assignee} onChange={(e) => setNewTask({...newTask, assignee: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition">
                      <option value="Tüm Personeller">Tüm Personeller</option>
                      {personnelList.map(person => <option key={person.id} value={person.fullName}>{person.fullName}</option>)}
                      <option value="Muhasebe">Muhasebe Departmanı</option>
                      <option value="Yönetim">Yönetim Kurulu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                    <input required type="date" value={newTask.date} onChange={(e) => setNewTask({...newTask, date: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" />
                  </div>
                </div>

                <button type="button" onClick={handleAddTask} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
                  <PlusCircle className="w-5 h-5" /> Görevi Ekle
                </button>
              </div>
            </div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
                <h3 className="font-bold text-lg">Görevi Düzenle</h3>
                <button onClick={() => setEditingTask(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div  className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Görev Başlığı</label>
                  <input required type="text" value={editingTask.title} onChange={(e) => setEditingTask({...editingTask, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Detaylar</label>
                  <textarea required value={editingTask.description} onChange={(e) => setEditingTask({...editingTask, description: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none h-24 resize-none transition" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Görevli</label>
                    <select value={editingTask.assignee} onChange={(e) => setEditingTask({...editingTask, assignee: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition">
                      <option value="Tüm Personeller">Tüm Personeller</option>
                      {personnelList.map(person => <option key={person.id} value={person.fullName}>{person.fullName}</option>)}
                      <option value="Muhasebe">Muhasebe Departmanı</option>
                      <option value="Yönetim">Yönetim Kurulu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                    <input required type="date" value={editingTask.date} onChange={(e) => setEditingTask({...editingTask, date: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" />
                  </div>
                </div>

                <button type="button" onClick={handleUpdateTask} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
                  <CheckCircle className="w-5 h-5" /> Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {showEndJobModal && jobToEnd && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
                <h3 className="font-bold text-lg">Operasyonu Sonlandır</h3>
                <button onClick={() => setShowEndJobModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {endJobError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 mb-4">
                    <AlertTriangle className="w-5 h-5 shrink-0" /> {endJobError}
                  </div>
                )}
                <div  className="space-y-4">
                  {jobToEnd.type === 'Asansör' ? (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Ödeme Şekli</label>
                        <select value={endJobData.paymentMethod} onChange={e => setEndJobData({...endJobData, paymentMethod: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            {/* DEĞİŞTİ: "Havale/EFT" -> "Banka", ilk seçenek */}
                            <option value="Banka">Banka</option>
                            <option value="Nakit">Nakit</option>
                            <option value="Ödeme Alınmadı">Ödeme Alınmadı</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Asansör Kuruldu mu?</label>
                        <select value={endJobData.elevatorSetup} onChange={e => setEndJobData({...endJobData, elevatorSetup: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Evet">Evet</option>
                            <option value="Hayır">Hayır</option>
                        </select>
                      </div>
                      {endJobData.elevatorSetup === 'Hayır' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="block text-sm font-bold text-red-600 mb-1">Asansör Kurulmama Nedeni *</label>
                          <textarea required value={endJobData.elevatorSetupReason} onChange={e => setEndJobData({...endJobData, elevatorSetupReason: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-2" placeholder="Neden kurulamadı?"></textarea>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Asansör Kurulum Fotoğrafı</label>
                        <div className="flex flex-col gap-2">
                          {(endJobData.elevatorImages || []).map((img, idx) => (
                            <div key={'eimg'+idx} className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                              <Camera className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="text-sm font-medium text-neutral-600 flex-1 truncate">{img}</span>
                              {img !== 'Yükleniyor...' && (
                                <button type="button" onClick={() => setEndJobData(prev => ({...prev, elevatorImages: prev.elevatorImages.filter((_, i) => i !== idx)}))} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><X className="w-4 h-4"/></button>
                              )}
                            </div>
                          ))}
                          <MediaCaptureMenu multiple onChange={(e) => handleFileUpload(e, 'elevator')} buttonLabel="Fotoğraf / Video Ekle" buttonClassName="cursor-pointer w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Asansörde Sorun Var mı?</label>
                        <select value={endJobData.elevatorIssue} onChange={e => setEndJobData({...endJobData, elevatorIssue: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Hayır">Hayır</option>
                            <option value="Evet">Evet</option>
                        </select>
                      </div>
                      {endJobData.elevatorIssue === 'Evet' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="block text-sm font-bold text-red-600 mb-1">Asansör Sorunu Nedeni *</label>
                          <textarea required value={endJobData.elevatorIssueReason} onChange={e => setEndJobData({...endJobData, elevatorIssueReason: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-2" placeholder="Sorun nedir?"></textarea>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Araçta Sorun Var mı?</label>
                        <select value={endJobData.vehicleIssue} onChange={e => setEndJobData({...endJobData, vehicleIssue: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Hayır">Hayır</option>
                            <option value="Evet">Evet</option>
                        </select>
                      </div>
                      {endJobData.vehicleIssue === 'Evet' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="block text-sm font-bold text-red-600 mb-1">Araç Sorunu Nedeni *</label>
                          <textarea required value={endJobData.vehicleIssueReason} onChange={e => setEndJobData({...endJobData, vehicleIssueReason: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-2" placeholder="Araçtaki sorun nedir?"></textarea>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 mb-4 text-center">
                        <Key className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                        <label className="block text-sm font-bold text-emerald-900 mb-2">Müşteri Teslim Kodunu Giriniz *</label>
                        <input required type="text" value={endJobData.enteredCode || ''} onChange={e => setEndJobData({...endJobData, enteredCode: e.target.value.toUpperCase()})} className="w-full p-3 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none transition font-mono tracking-widest uppercase text-center text-xl font-black text-emerald-800 placeholder-emerald-300" placeholder="6 HANELİ KOD" />
                        <p className="text-[10px] text-emerald-700 mt-2 font-medium">İşi başarıyla sonlandırmak için müşteriden teslim kodunu isteyip yukarıdaki alana girin.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Ödeme Yöntemi</label>
                        {/* DEĞİŞTİ (kullanıcı talebi): "Havale/EFT" -> "Banka" ve
                            sıra Banka > Nakit > Kredi Kartı > Ödeme Yapmadı oldu.
                            Seçime göre gelir OTOMATİK olarak doğru deftere düşer:
                              Banka         -> Banka türü (NAKLİYE GARANTİ BANK)
                              Nakit         -> Nakit türü (NAKLİYE NAKİT)
                              Kredi Kartı   -> Kredi Kartı türü (NAKLİYE KREDİ KARTI)
                              Ödeme Yapmadı -> Borçlu türü (NAKLİYE ALACAK)
                            Eski işlerdeki 'Havale/EFT' değeri de Banka defterine
                            eşleşmeye devam eder (shared.tsx ODEME_DEFTER_TUR_ESLEME). */}
                        <select value={endJobData.paymentMethod} onChange={e => setEndJobData({...endJobData, paymentMethod: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                          <option value="Banka">Banka</option>
                          <option value="Nakit">Nakit</option>
                          <option value="Kredi Kartı">Kredi Kartı</option>
                          <option value="Ödeme Yapmadı">Ödeme Yapmadı</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Müşteri Memnuniyeti</label>
                        <select value={endJobData.customerSatisfaction} onChange={e => setEndJobData({...endJobData, customerSatisfaction: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                          <option value="Yorum yazdı.">Yorum yazdı.</option>
                          <option value="Video alındı.">Video alındı.</option>
                          <option value="Şirketle İletişime Geçti.">Şirketle İletişime Geçti.</option>
                          <option value="Herhangi bir işlem yapmadı.">Herhangi bir işlem yapmadı.</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-black mb-1">Hasar Durumu</label>
                          <select value={endJobData.damageStatus} onChange={e => setEndJobData({...endJobData, damageStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Hasarsız teslim edildi">Hasarsız</option>
                            <option value="Hasar var">Hasar var</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-black mb-1">Kamyon Durumu</label>
                          <select value={endJobData.truckStatus} onChange={e => setEndJobData({...endJobData, truckStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Herhangi bir sorun yok">Sorun yok</option>
                            <option value="Sorun var">Sorun var</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Kamyon Kasası Fotoğrafı / Videosu (İş Sonu)</label>
                        <div className="flex flex-col gap-2">
                          {(endJobData.truckImages || []).map((img, idx) => (
                            <div key={'timg'+idx} className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                              <Camera className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="text-sm font-medium text-neutral-600 flex-1 truncate">{img}</span>
                              {img !== 'Yükleniyor...' && (
                                <button type="button" onClick={() => setEndJobData(prev => ({...prev, truckImages: prev.truckImages.filter((_, i) => i !== idx)}))} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><X className="w-4 h-4"/></button>
                              )}
                            </div>
                          ))}
                          {/* YENİ: multiple → birden fazla fotoğraf/video aynı anda; "Şimdi Çek" doğrudan kamerayı açar (iOS/Android) */}
                          <MediaCaptureMenu multiple onChange={(e) => handleFileUpload(e, 'truck')} buttonLabel="Yeni Görsel Ekle" buttonClassName="cursor-pointer w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2" />
                        </div>
                      </div>

                      {/* YENİ: TESLİM EDİLEN YERİN FOTOĞRAFI / VİDEOSU — kasa fotoğrafıyla birebir aynı mantık */}
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Teslim Edilen Yerin Fotoğrafı / Videosu (İş Sonu)</label>
                        <div className="flex flex-col gap-2">
                          {(endJobData.deliveryImages || []).map((img, idx) => (
                            <div key={'dlvimg'+idx} className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                              <Camera className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="text-sm font-medium text-neutral-600 flex-1 truncate">{img}</span>
                              {img !== 'Yükleniyor...' && (
                                <button type="button" onClick={() => setEndJobData(prev => ({...prev, deliveryImages: (prev.deliveryImages || []).filter((_, i) => i !== idx)}))} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><X className="w-4 h-4"/></button>
                              )}
                            </div>
                          ))}
                          <MediaCaptureMenu multiple onChange={(e) => handleFileUpload(e, 'delivery')} buttonLabel="Yeni Görsel Ekle" buttonClassName="cursor-pointer w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2" />
                        </div>
                      </div>

                      {endJobData.damageStatus === 'Hasar var' && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                          <label className="block text-sm font-bold text-red-900 mb-1">Hasar Detayı (Müşteriye de iletilecek)</label>
                          <textarea required value={endJobData.damageDetails} onChange={e => setEndJobData({...endJobData, damageDetails: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-3" placeholder="Hasar hakkında detaylı bilgi..."></textarea>
                          
                          <label className="block text-sm font-bold text-red-900 mb-1 mt-2">Hasar Fotoğrafı</label>
                          <div className="flex flex-col gap-2 mb-3">
                            {(endJobData.damageImages || []).map((img, idx) => (
                              <div key={'dimg'+idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-red-200">
                                <Camera className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="text-sm font-medium text-red-600 flex-1 truncate">{img}</span>
                                {img !== 'Yükleniyor...' && (
                                  <button type="button" onClick={() => setEndJobData(prev => ({...prev, damageImages: prev.damageImages.filter((_, i) => i !== idx)}))} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"><X className="w-4 h-4"/></button>
                                )}
                              </div>
                            ))}
                            <MediaCaptureMenu multiple onChange={(e) => handleFileUpload(e, 'damage')} buttonLabel="Yeni Hasar Fotoğrafı Ekle" buttonClassName="cursor-pointer w-full bg-white hover:bg-neutral-50 border border-red-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2 text-red-600" />
                          </div>
                          
                          {endJobData.damageDetails.trim().length > 0 && (
                            <div className="flex flex-col sm:flex-row gap-2 animate-in fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                                  if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                  else if (!phone.startsWith('90')) phone = '90' + phone;
                                  const msg = `Sayın *${jobToEnd.customerName}*,\n\nSembol Nakliyat olarak taşıma işleminizi tamamlamış bulunmaktayız. Ekibimiz tarafından teslimat sırasında aşağıdaki durum tutanak altına alınarak operasyon merkezimize raporlanmıştır:\n\n⚠️ *Hasar / Sorun Bildirimi:*\n_${endJobData.damageDetails}_\n\nMüşteri memnuniyeti bizim için en öncelikli konudur. Konuyla ilgili operasyon sorumlumuz en kısa sürede sizinle iletişime geçerek sürecin takibini sağlayacaktır.\n\nAnlayışınız için teşekkür ederiz.\n*Sembol Nakliyat Yönetimi*`;
                                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                                className="flex-1 px-3 py-2 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <MessageCircle className="w-4 h-4 shrink-0" /> Müşteriye Bildir (WA)
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                                  const msg = `Sayın ${jobToEnd.customerName},\nSembol Nakliyat olarak isinizi tamamladik. Ekibimiz tarafindan bir hasar durumu (${endJobData.damageDetails}) raporlanmistir. Operasyon sorumlumuz sizinle iletisime gececektir.`;
                                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                                  const separator = isIOS ? '&' : '?';
                                  window.open(`sms:${phone}${separator}body=${encodeURIComponent(msg)}`, '_self');
                                }}
                                className="flex-1 px-3 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <MessageSquareText className="w-4 h-4 shrink-0" /> Müşteriye Bildir (SMS)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {endJobData.truckStatus === 'Sorun var' && (
                        <div>
                          <label className="block text-sm font-bold text-black mb-1">Kamyon Sorunu Detayı</label>
                          <textarea required value={endJobData.truckIssueDetails} onChange={e => setEndJobData({...endJobData, truckIssueDetails: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none resize-none h-16 text-sm" placeholder="Araçtaki arıza/sorun..."></textarea>
                        </div>
                      )}
                    </>
                  )}

                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mt-4 mb-2">
                    <label className="block text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                      <Star className="w-4 h-4 text-blue-600 fill-blue-600" /> Müşteriden Değerlendirme (Google Yorum) İste
                    </label>
                    <p className="text-[10px] text-blue-700 mb-3 font-medium">İşi sonlandırmadan önce müşteriye otomatik Google değerlendirme linki gönderebilirsiniz.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                          if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                          else if (!phone.startsWith('90')) phone = '90' + phone;
                          
                          let reviewLink = "https://g.page/r/CY7qIJg9osoKEBM/review";
                          let msgBody = `Sayın *${jobToEnd.customerName}*,\n\nSembol Nakliyat olarak taşıma işleminizi tamamlamış bulunmaktayız. Bizi tercih ettiğiniz için teşekkür ederiz.\n\nHizmetimizden memnun kaldıysanız, aşağıdaki linke tıklayarak Google üzerinden bize kısa bir yorum bırakırsanız çok seviniriz. Değerli yorumlarınız, ekibimiz ve firmamız için çok önemlidir.\n\n⭐ *Değerlendirme Linki:*\n${reviewLink}\n\nYeni adresinizde sağlık ve mutluluk dolu günler dileriz.\n*Sembol Nakliyat Yönetimi*`;
                          
                          if (jobToEnd.type === 'Depo') {
                              reviewLink = "https://g.page/r/Ce80w-lqdhRkEBM/review";
                              msgBody = `Sayın *${jobToEnd.customerName}*,\n\nSembol Nakliyat Depoevim olarak depolama işleminizi tamamlamış bulunmaktayız. Bizi tercih ettiğiniz için teşekkür ederiz.\n\nHizmetimizden memnun kaldıysanız, aşağıdaki linke tıklayarak Google üzerinden bize kısa bir yorum bırakırsanız çok seviniriz. Değerli yorumlarınız, ekibimiz ve firmamız için çok önemlidir.\n\n⭐ *Değerlendirme Linki:*\n${reviewLink}\n\nEşyalarınız güvende, iyi günler dileriz.\n*Sembol Nakliyat Depoevim Yönetimi*`;
                          }
                          
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgBody)}`, '_blank');
                        }}
                        className="flex-1 px-3 py-2 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" /> WhatsApp'tan İste
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                          
                          let reviewLink = "https://g.page/r/CY7qIJg9osoKEBM/review";
                          let msgBody = `Sayın ${jobToEnd.customerName},\nSembol Nakliyat olarak tasima isleminizi tamamladik. Bizi tercih ettiginiz icin tesekkur ederiz.\n\nHizmetimizden memnun kaldiysaniz asagidaki linkten bize kisa bir yorum birakabilirsiniz. Yorumlariniz bizim icin cok degerlidir.\n\nLink: ${reviewLink}\n\nYeni adresinizde mutluluklar dileriz.`;
                          
                          if (jobToEnd.type === 'Depo') {
                              reviewLink = "https://g.page/r/Ce80w-lqdhRkEBM/review";
                              msgBody = `Sayın ${jobToEnd.customerName},\nSembol Nakliyat Depoevim olarak depolama isleminizi tamamladik. Bizi tercih ettiginiz icin tesekkur ederiz.\n\nHizmetimizden memnun kaldiysaniz asagidaki linkten bize kisa bir yorum birakabilirsiniz. Yorumlariniz bizim icin cok degerlidir.\n\nLink: ${reviewLink}\n\nEsyalariniz guvende, iyi gunler dileriz.`;
                          }
                          
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                          const separator = isIOS ? '&' : '?';
                          window.open(`sms:${phone}${separator}body=${encodeURIComponent(msgBody)}`, '_self');
                        }}
                        className="flex-1 px-3 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageSquareText className="w-4 h-4 shrink-0" /> SMS ile İste
                      </button>
                    </div>
                  </div>

                  {/* HATA DÜZELTMESİ: buton artık kaydediliyorken disabled — hızlı art arda
                      dokunma (çift tıklama) submitEndJob'u ikinci kez tetikleyemez, bu da
                      deftere aynı işten kopya/mükerrer gelir kaydı düşmesini önler. */}
                  <button type="button" onClick={submitEndJob} disabled={endJobKaydediliyor} className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {endJobKaydediliyor
                      ? (<><Loader2 className="w-5 h-5 animate-spin" /> Kaydediliyor...</>)
                      : (<><CheckCircle className="w-5 h-5" /> {jobToEnd.type === 'Asansör' ? 'Asansör İşini Sonlandır' : 'Kodu Doğrula ve İşi Bitir'}</>)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showApproveModal && jobToApprove && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh]">
              <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-yellow-500 shrink-0">
                <h3 className="font-bold text-base flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Puan Onay Ekranı</h3>
                <button onClick={() => setShowApproveModal(false)} className="text-neutral-400 hover:text-white transition p-1"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                <div  className="space-y-4">
                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black text-black leading-tight">{jobToApprove.customerName}</p>
                      <p className="text-[10px] font-bold text-neutral-500 mt-0.5"><CalendarDays className="w-3 h-3 inline mr-0.5"/>{jobToApprove.date}</p>
                    </div>
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2 py-1 rounded border border-yellow-200">Onay Bekliyor</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1.5">Ekip Puan Girişi</label>
                          <div className="bg-white border border-neutral-200 rounded-lg p-1.5 space-y-1">
                            {(() => {
                              const teamIds = jobToApprove.assignedPersonnelIds ? [...jobToApprove.assignedPersonnelIds] : [];
                              if (jobToApprove.assignedPersonnelId && !teamIds.includes(jobToApprove.assignedPersonnelId)) {
                                teamIds.push(jobToApprove.assignedPersonnelId);
                              }
                              if (teamIds.length === 0) return <span className="text-[10px] text-neutral-500 italic px-2">Görevli personel bulunamadı.</span>;
                              
                              return teamIds.map(pId => {
                                const person = personnelList.find(p => p.id === pId);
                                return (
                                  <div key={pId} className="flex justify-between items-center bg-neutral-50 p-1.5 rounded-md border border-neutral-100">
                                    <span className="text-[11px] font-bold text-black flex items-center gap-1.5 truncate pr-2">
                                       <User className="w-3 h-3 text-neutral-400 shrink-0" />
                                       <span className="truncate">{person?.fullName || 'Bilinmeyen Personel'}</span>
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <input 
                                         type="number" 
                                         step="0.5" 
                                         min="0" 
                                         value={approveData.individualPoints[pId] !== undefined ? approveData.individualPoints[pId] : 1} 
                                         onChange={e => setApproveData({...approveData, individualPoints: {...approveData.individualPoints, [pId]: parseFloat(e.target.value) || 0}})} 
                                         className="w-12 h-6 border border-neutral-300 rounded text-center outline-none focus:ring-1 focus:ring-yellow-500 font-bold text-xs" 
                                      />
                                      <span className="text-[9px] font-bold text-neutral-500">Puan</span>
                                    </div>
                                  </div>
                                )
                              });
                            })()}
                          </div>
                        </div>

                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col max-h-36">
                          <label className="block text-[11px] font-bold text-blue-900 mb-1.5 flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-600" /> Ekstra Destek (0,5 Puan)
                          </label>
                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 bg-white p-1 rounded border border-blue-100">
                            {personnelList.filter(p => !jobToApprove.assignedPersonnelIds?.includes(p.id) && p.id !== jobToApprove.assignedPersonnelId && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))).map(p => (
                              <label key={p.id} className="flex items-center gap-1.5 p-1.5 hover:bg-neutral-50 rounded cursor-pointer transition">
                                <input type="checkbox" className="w-3.5 h-3.5 text-blue-600 rounded" checked={approveData.supportPersonnelIds?.includes(p.id)} onChange={(e) => {
                                    if(e.target.checked) setApproveData({...approveData, supportPersonnelIds: [...(approveData.supportPersonnelIds||[]), p.id]});
                                    else setApproveData({...approveData, supportPersonnelIds: (approveData.supportPersonnelIds||[]).filter(id => id !== p.id)});
                                }} />
                                <span className="text-[10px] font-medium text-black truncate">{p.fullName}</span>
                              </label>
                            ))}
                            {personnelList.filter(p => !jobToApprove.assignedPersonnelIds?.includes(p.id) && p.id !== jobToApprove.assignedPersonnelId && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))).length === 0 && (
                                <span className="text-[9px] text-neutral-500 italic px-1">Seçilebilecek ekstra personel yok.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-black mb-1.5 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-neutral-500" /> Müşteri Yorumu Görseli
                        </label>
                        <div className="flex-1 flex flex-col">
                          {approveData.reviewImage && approveData.reviewImage !== 'Yükleniyor...' && (
                            <div className="flex-1 w-full min-h-[120px] overflow-hidden rounded-lg border border-neutral-200 relative group">
                              {isVideoUrl(approveData.reviewImage) ? (
                                <video src={approveData.reviewImage} controls className="w-full h-full object-cover bg-black" />
                              ) : (
                                <img src={approveData.reviewImage} alt="Yorum" className="w-full h-full object-cover bg-neutral-100" />
                              )}
                              <button type="button" onClick={() => setApproveData(prev => ({...prev, reviewImage: ''}))} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition shadow-md">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {approveData.reviewImage === 'Yükleniyor...' && (
                            <div className="flex-1 min-h-[120px] flex items-center justify-center font-bold text-[10px] text-neutral-500 animate-pulse bg-neutral-50 rounded-lg border border-neutral-200">
                              Görsel Yükleniyor...
                            </div>
                          )}
                          {!approveData.reviewImage && (
                            <MediaCaptureMenu onChange={handleReviewImageUpload} buttonLabel="Yorum Görseli Ekle (İsteğe Bağlı)" buttonClassName="cursor-pointer w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 border-dashed rounded-lg flex-1 min-h-[120px] text-center transition flex flex-col justify-center items-center gap-1.5" />
                          )}
                        </div>
                      </div>
                  </div>

                  <button type="button" onClick={submitApprovePoints} className="w-full py-3 bg-yellow-500 text-black font-black text-sm rounded-xl hover:bg-yellow-600 transition flex justify-center items-center gap-2 shadow-md">
                    <CheckCircle className="w-4 h-4" /> Onayla ve Puanları İşle
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMesaiModal && jobForMesai && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-blue-500 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Mesai / Devamsızlık Onayla</h3>
                <button onClick={() => setShowMesaiModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar max-h-[80vh]">
                <div  className="space-y-4">
                   <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 mb-4">
                      <p className="text-sm font-bold text-black mb-1">Müşteri: {jobForMesai.customerName}</p>
                      <p className="text-xs text-neutral-500">Tarih: {jobForMesai.date}</p>
                   </div>
                   
                   {Object.keys(mesaiModalData).length === 0 ? (
                      <p className="text-sm text-neutral-500 italic">Bu işe atanmış kayıtlı mavi yaka personel bulunmuyor.</p>
                   ) : (
                      <div className="space-y-3">
                         {Object.keys(mesaiModalData).map(pId => {
                            const person = personnelList.find(p => String(p.id) === String(pId));
                            const data = mesaiModalData[pId];
                            return (
                               <div key={pId} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-neutral-200 shadow-sm">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                  <div className="flex-1 font-bold text-sm text-black flex items-center gap-2">
                                     <User className="w-4 h-4 text-neutral-400 shrink-0" />
                                     <span className="truncate">{person?.fullName || 'Bilinmeyen Personel'}</span>
                                  </div>
                                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                     <select 
                                        value={data.status} 
                                        onChange={e => setMesaiModalData(prev => ({ ...prev, [pId]: { ...prev[pId], status: e.target.value } }))}
                                        className="p-2 border border-neutral-300 rounded-lg outline-none text-sm font-bold bg-neutral-50 flex-1 focus:ring-2 focus:ring-blue-500"
                                     >
                                        {MESAI_STATUS_OPTIONS.map(opt => (
                                           <option key={opt.code} value={opt.code}>{opt.code} - {opt.label}</option>
                                        ))}
                                     </select>
                                     {(data.status === 'FM' || data.status === 'EM' || data.status === 'FGM') && (
                                        <input 
                                           type="number" 
                                           step="0.5"
                                           placeholder="Saat" 
                                           /* DÜZELTME: Öneri "0,5" gibi VİRGÜLLÜ geliyordu; type="number"
                                              alanı virgülü geçersiz sayıp kutuyu BOŞ gösteriyordu.
                                              Ekranda nokta ile gösterilir, state'te virgüllü saklanır
                                              (puantaj kayıtları virgül biçimini kullanıyor). */
                                           value={String(data.hours ?? '').replace(',', '.')}
                                           onChange={e => setMesaiModalData(prev => ({ ...prev, [pId]: { ...prev[pId], hours: e.target.value.replace('.', ',') } }))}
                                           className="w-16 p-2 border border-neutral-300 rounded-lg outline-none text-sm font-bold text-center"
                                        />
                                     )}
                                  </div>
                                  </div>

                                  {/* YENİ: QR MESAİ ÖZETİ — giriş/çıkış saatleri ve önerinin gerekçesi.
                                      Yönetici neyin neden önerildiğini tek bakışta görür. */}
                                  {data.oneri && (
                                    <div className={`rounded-lg px-2.5 py-2 border text-[11px] font-bold flex flex-col gap-1 ${data.oneri.status === 'D' ? 'bg-red-50 border-red-200 text-red-700' : data.oneri.status === 'EM' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : (data.oneri.status === 'FM' || data.oneri.status === 'FGM' || data.oneri.status === 'FG') ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="flex items-center gap-1">
                                          <QrCode className="w-3 h-3" />
                                          Giriş: <b>{data.oneri.girisSaati || '—'}</b>
                                          {data.oneri.kaynak && data.oneri.kaynak !== 'yok' && (
                                            <span className="text-[9px] opacity-70">({data.oneri.kaynak === 'manuel' ? 'elle kod' : 'kamera'})</span>
                                          )}
                                        </span>
                                        <span>Çıkış: <b>{data.oneri.cikisSaati || '—'}</b></span>
                                        {data.oneri.ekipCikis && (
                                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Ekip çıkışı (en erken): <b>{data.oneri.ekipCikis}</b></span>
                                        )}
                                      </div>
                                      <p className="opacity-90">{data.oneri.aciklama}</p>
                                      {/* Öneri değiştirildiyse uyar; yönetici son sözü söyler */}
                                      {(data.status !== data.oneri.status || String(data.hours || '') !== String(data.oneri.hours || '')) && (
                                        <p className="text-[10px] text-neutral-500 italic">Öneri elle değiştirildi (öneri: {data.oneri.status}{data.oneri.hours ? ` ${data.oneri.hours} sa` : ''}).</p>
                                      )}
                                    </div>
                                  )}
                                  {!data.oneri && (
                                    <p className="text-[10px] font-bold text-neutral-400 italic">Bu personel için o güne ait QR mesai kaydı bulunamadı — durumu elle seçin.</p>
                                  )}
                               </div>
                            )
                         })}
                      </div>
                   )}

                   <button type="button" onClick={submitMesaiApprove} disabled={Object.keys(mesaiModalData).length === 0} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg mt-4 disabled:opacity-50">
                     <CheckCircle className="w-5 h-5" /> Mesaileri Kaydet
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {resolveDamageModal.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-green-500 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Hasar Sorununu Çöz</h3>
                <button onClick={() => setResolveDamageModal({ isOpen: false, jobId: null, note: '', cost: '', files: [] })} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div  className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Çözüm Notu / Açıklama</label>
                    <textarea required value={resolveDamageModal.note} onChange={e => setResolveDamageModal({...resolveDamageModal, note: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none transition text-sm" placeholder="Sorun nasıl çözüldü? Müşteri ile nasıl anlaşıldı? (Örn: Tamir masrafı karşılandı.)"></textarea>
                  </div>
                  {/* DEĞİŞTİ: HASAR TUTARI ARTIK ZORUNLU.
                      • Boş bırakılamaz; masrafsız çözümler için 0 girilir.
                      • Kutu, dikkat çekmesi için turuncu temalıdır.
                      • 0'dan büyük tutar girilince kutu ve "Çözüldü Olarak
                        Kaydet" butonu KIRMIZIYA döner — ekibe borç yazılacağı
                        bir bakışta anlaşılır. */}
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Hasar Tutarı / Maliyet (₺) <span className="font-black text-red-600">*</span> <span className="font-medium text-neutral-400">— zorunlu</span></label>
                    <input type="number" required min="0" step="0.01" value={resolveDamageModal.cost} onChange={e => setResolveDamageModal({...resolveDamageModal, cost: e.target.value})}
                      className={`w-full p-3 border-2 rounded-xl outline-none transition text-sm font-bold ${(parseFloat(resolveDamageModal.cost) || 0) > 0
                        ? 'bg-red-50 border-red-400 text-red-700 focus:ring-2 focus:ring-red-500'
                        : 'bg-orange-50 border-orange-300 text-orange-800 focus:ring-2 focus:ring-orange-400'}`}
                      placeholder="Örn: 10000" />
                    {/* Açıklama: maliyetsiz çözümde 0 girilebilir */}
                    <p className="text-[11px] font-medium text-neutral-500 mt-1.5">Maliyetsiz çözüm olduysa <b>0</b> girebilirsiniz — kimseye borç yazılmaz.</p>
                    {(() => {
                      // Canlı önizleme: tutar ve ekip belliyse kişi başı payı göster
                      const j = jobs.find(x => x.id === resolveDamageModal.jobId);
                      const ekipSayisi = (j?.assignedPersonnelIds || []).filter(Boolean).length;
                      const tutar = parseFloat(resolveDamageModal.cost) || 0;
                      if (tutar <= 0) return null;
                      if (ekipSayisi === 0) return <p className="text-[11px] font-bold text-red-600 mt-1.5">Bu işe atanmış ekip bulunamadı — tutar girilse de kimseye borç yazılamaz.</p>;
                      const pay = Math.round((tutar / ekipSayisi) * 100) / 100;
                      return <p className="text-[11px] font-bold text-red-700 mt-1.5">İşe giden {ekipSayisi} kişiye eşit bölünür: kişi başı ₺{pay.toLocaleString('tr-TR')} hasar borcu yazılır ve yalnızca PRİMLERİNDEN kesilir.</p>;
                    })()}
                  </div>
                  {/* ==============================================================
                      YENİ: ÇÖZÜM BELGELERİ (isteğe bağlı, çoklu)
                      Fotoğraf, PDF, dekont, servis fişi vb. eklenebilir. Dosyalar
                      mevcut yükleme sunucusuna gider; kayıt sırasında işin
                      endJobDetails.damageResolutionFiles alanına yazılır ve hasar
                      tahtasında, iş kartında ve müşteri profilinde görüntülenir.
                      ============================================================== */}
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Çözüm Belgeleri <span className="font-medium text-neutral-400">— isteğe bağlı (fotoğraf, PDF, dekont; çoklu seçilebilir)</span></label>
                    <label className="cursor-pointer w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2 text-sm font-bold text-neutral-600">
                      <Upload className="w-4 h-4" /> Dosya Ekle (Fotoğraf / PDF / Belge)
                      {/* accept: görseller + PDF + yaygın belge türleri; multiple ile çoklu seçim */}
                      <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={handleResolveFileUpload} className="hidden" />
                    </label>
                    {/* Eklenen dosyaların listesi — tek tek kaldırılabilir */}
                    {resolveDamageModal.files.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {resolveDamageModal.files.map((f, i) => (
                          <div key={i} className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs font-bold ${f.url === 'Yükleniyor...' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                            <span className="flex items-center gap-1.5 min-w-0">
                              {f.url === 'Yükleniyor...' ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : (/\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(f.url) ? <Camera className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />)}
                              <span className="truncate">{f.name}</span>
                              {f.url === 'Yükleniyor...' && <span className="shrink-0 font-medium">yükleniyor…</span>}
                            </span>
                            {f.url !== 'Yükleniyor...' && (
                              <button type="button" onClick={() => setResolveDamageModal(prev => ({ ...prev, files: prev.files.filter((_, x) => x !== i) }))} className="text-red-500 hover:text-red-700 shrink-0" title="Listeden çıkar">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* DEĞİŞTİ: Buton, hasar tutarı 0'dan büyükse KIRMIZI olur (borç
                      yazılacak uyarısı); 0 veya boşsa eskisi gibi YEŞİL kalır.
                      Tutar alanı boşsa buton kilitlenir (zorunlu alan).
                      YENİ: Dosya yüklemesi SÜRERKEN de kilitlenir — yarım kalmış
                      "Yükleniyor..." yer tutucusunun kaydedilmesi engellenir. */}
                  <button type="button" onClick={handleResolveDamageSubmit}
                    disabled={String(resolveDamageModal.cost).trim() === '' || resolveYukleniyor > 0}
                    className={`w-full py-4 text-white font-black rounded-xl transition flex justify-center items-center gap-2 shadow-lg mt-2 ${(String(resolveDamageModal.cost).trim() === '' || resolveYukleniyor > 0)
                      ? 'bg-neutral-300 cursor-not-allowed'
                      : (parseFloat(resolveDamageModal.cost) || 0) > 0
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-500 hover:bg-green-600'}`}>
                    <CheckCircle className="w-5 h-5" />
                    {(parseFloat(resolveDamageModal.cost) || 0) > 0 ? 'Çözüldü Olarak Kaydet (Ekibe Borç Yazılacak)' : 'Çözüldü Olarak Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* YENİ: Hasarlı İşler "Düzenle" modalı — hasar notunu ve (çözülmüşse) çözüm notunu düzenler */}
        {editDamageModal.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Edit className="w-5 h-5 text-red-500" /> Hasar Notunu Düzenle</h3>
                <button onClick={() => setEditDamageModal({ isOpen: false, jobId: null, damageDetails: '', damageResolutionNote: '', damageResolved: false })} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Hasar Notu</label>
                    <textarea required value={editDamageModal.damageDetails} onChange={e => setEditDamageModal({ ...editDamageModal, damageDetails: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none transition text-sm" placeholder="Hasarın ne olduğunu açıklayın."></textarea>
                  </div>
                  {/* Çözüm notu sadece daha önce "Çözüldü" işaretlenmişse düzenlenebilir */}
                  {editDamageModal.damageResolved && (
                    <div>
                      <label className="block text-sm font-bold text-black mb-2">Çözüm Notu</label>
                      <textarea value={editDamageModal.damageResolutionNote} onChange={e => setEditDamageModal({ ...editDamageModal, damageResolutionNote: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none transition text-sm" placeholder="Sorun nasıl çözüldü?"></textarea>
                    </div>
                  )}
                  <button type="button" onClick={handleEditDamageSubmit} className="w-full py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <Save className="w-5 h-5" /> Değişiklikleri Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* YENİ: "YENİ EKLE" (Yapılacak İş) MODALI — Takip ve Yapılacak İşler
            sayfasının sağ üstündeki butonla açılır; sol menüde ayrı sayfa değildir. */}
        {showAddTodoModal && showTodos && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="bg-red-700 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-lg flex items-center gap-2"><ListTodo className="w-5 h-5" /> Yeni Yapılacak İş Ekle</h3>
                <button onClick={() => setShowAddTodoModal(false)} className="text-red-200 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-2">
                <AddTodoView newTodo={newTodo} setNewTodo={setNewTodo} handleAddTodo={handleAddTodo} />
              </div>
            </div>
          </div>
        )}

        {/* YENİ: ESKİ SİSTEMDEN İÇE AKTARMA PENCERESİ */}
        {showImportModal && isManager && (
          <EskiVeriIceAktar
            jobs={jobs}
            currentUser={currentUser}
            addSystemLog={addSystemLog}
            onClose={() => setShowImportModal(false)}
          />
        )}

        {/* YENİ: ŞİRKET İLETİŞİMİ YÖNETİM PENCERESİ
            Ekleme, sıra değiştirme (yukarı/aşağı), düzenleme ve silme işlemlerinin
            tamamı bu tek pencerede toplanır. Sol menüdeki liste sade kalır. */}
        {showContactsManageModal && canManageContacts && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
              <div className="bg-emerald-700 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Phone className="w-5 h-5" /> Şirket İletişimi Yönetimi</h3>
                <button onClick={() => { setShowContactsManageModal(false); setContactDeleteId(null); }} className="text-emerald-200 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-4 border-b border-neutral-200 shrink-0">
                <button
                  onClick={() => { setContactForm({ name: '', phone: '', position: '' }); setEditingContact(null); setShowContactModal(true); }}
                  className="w-full py-2.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition text-sm flex items-center justify-center gap-2">
                  <PlusCircle className="w-4 h-4" /> Yeni Kişi Ekle
                </button>
                <p className="text-[11px] text-neutral-400 font-bold mt-2 text-center">Sıralamayı ok tuşlarıyla değiştirebilir, kayıtları düzenleyip silebilirsiniz.</p>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto">
                {companyContacts.length === 0 && (
                  <p className="text-center text-neutral-400 text-sm font-bold py-8">Kayıtlı numara yok. "Yeni Kişi Ekle" ile başlayın.</p>
                )}
                {companyContacts.map((c, index) => (
                  <div key={c.id} className="border border-neutral-200 rounded-xl p-3 flex items-center gap-3 hover:border-emerald-400 transition">
                    {/* Sıra numarası + yukarı/aşağı taşıma */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button disabled={index === 0} onClick={() => handleReorderContact(index, 'up')} title="Yukarı Taşı"
                        className="p-1 rounded-lg text-neutral-500 hover:text-black hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed transition"><ChevronUp className="w-4 h-4" /></button>
                      <span className="text-[10px] font-black text-neutral-400">{index + 1}</span>
                      <button disabled={index === companyContacts.length - 1} onClick={() => handleReorderContact(index, 'down')} title="Aşağı Taşı"
                        className="p-1 rounded-lg text-neutral-500 hover:text-black hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed transition"><ChevronDown className="w-4 h-4" /></button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-black text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-neutral-500 font-bold truncate">{c.position}</p>
                      <p className="text-[11px] text-emerald-600 font-bold">{c.phone}</p>
                    </div>

                    {/* Düzenle / Sil */}
                    {contactDeleteId === c.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-black text-red-600">Silinsin mi?</span>
                        <button onClick={async () => { await handleDeleteContact(c.id); addSystemLog('İletişim Hattı', `Şirket iletişim hattından kişi silindi: ${c.name}`); setContactDeleteId(null); }}
                          className="px-2.5 py-1.5 bg-red-600 text-white text-[11px] font-black rounded-lg hover:bg-red-700 transition">Evet</button>
                        <button onClick={() => setContactDeleteId(null)}
                          className="px-2.5 py-1.5 bg-neutral-100 text-neutral-600 text-[11px] font-bold rounded-lg hover:bg-neutral-200 transition">Vazgeç</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setEditingContact(c); setContactForm({ name: c.name, phone: c.phone, position: c.position }); setShowContactModal(true); }} title="Düzenle"
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setContactDeleteId(c.id)} title="Sil"
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-neutral-200 shrink-0">
                <button onClick={() => { setShowContactsManageModal(false); setContactDeleteId(null); }}
                  className="w-full py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Kapat</button>
              </div>
            </div>
          </div>
        )}

        {showContactModal && (
          /* Bu pencere, yönetim penceresinin ÜSTÜNDE açılır (z-[60]) */
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-emerald-600 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Phone className="w-5 h-5" /> {editingContact ? 'İletişim Numarası Düzenle' : 'İletişim Numarası Ekle'}</h3>
                <button onClick={() => { setShowContactModal(false); setEditingContact(null); }} className="text-emerald-200 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6">
                <div  className="space-y-4">
                  {!editingContact && (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Personel Seçerek Doldur</label>
                        <select 
                          className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none bg-white font-medium"
                          onChange={(e) => {
                            const p = personnelList.find(x => String(x.id) === e.target.value);
                            if (p) {
                              setContactForm({ name: p.fullName, phone: p.personalPhone || p.companyPhone || '', position: p.position });
                            }
                          }}
                        >
                          <option value="">-- Personel Seçin --</option>
                          {personnelList.map(p => (
                            <option key={p.id} value={p.id}>{p.fullName} ({p.position})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="text-center text-xs font-bold text-neutral-400 py-1">VEYA MANUEL GİRİŞ YAPIN</div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">İsim Soyisim</label>
                    <input required type="text" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Telefon Numarası</label>
                    <input required type="text" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none" placeholder="Örn: 0555..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Pozisyon / Unvan</label>
                    <input required type="text" value={contactForm.position} onChange={e => setContactForm({...contactForm, position: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none" placeholder="Örn: Operasyon Müdürü" />
                  </div>
                  <button type="button" onClick={handleAddContact} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <CheckCircle className="w-5 h-5" /> {editingContact ? 'Değişiklikleri Kaydet' : 'Kaydet ve Ekle'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <style dangerouslySetInnerHTML={{__html: `
          /* ================================================================
             YENİ: TAKVİMDE "BUGÜN" HÜCRESİNİN YANIP SÖNEN ÇERÇEVESİ
             Hatırlatmalar takviminde bugünün hücresi artık kırmızı DOLGU
             değil; çerçevesi yumuşak şekilde yanıp söner. Böylece hücrenin
             içindeki gün numarası ve durum simgeleri okunabilir kalır.
             ================================================================ */
          @keyframes hatirlatmaBugunCerceve {
            0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
            50%      { border-color: #fca5a5; box-shadow: 0 0 0 4px rgba(239,68,68,0.12); }
          }
          .hatirlatma-bugun-cerceve {
            animation: hatirlatmaBugunCerceve 1.6s ease-in-out infinite;
          }

          /* ================================================================
             YENİ: SOL MENÜ BİLDİRİM ROZETİ — RENK DEĞİŞTİREREK YANIP SÖNME
             Rozet iki durum arasında geçiş yapar:
               • Beyaz arka plan + siyah yazı
               • Kırmızı arka plan + beyaz yazı
             "Operasyon" başlığında (alt menülerin toplamı) ve
             "Hatırlatmalar" menüsünde kullanılır.
             ================================================================ */
          @keyframes menuRozetYanSon {
            0%, 49%   { background-color: #ffffff; color: #000000; }
            50%, 100% { background-color: #dc2626; color: #ffffff; }
          }
          .menu-rozet-yansonen {
            animation: menuRozetYanSon 1.2s steps(1, end) infinite;
          }

          /* ================================================================
             YENİ: YENİ PERSONEL — İŞ KILAVUZU İKONU DİKKAT ÇEKİCİ YANIP SÖNME
             İşe başlayan personelin ilk 30 günü boyunca, ismin yanındaki
             İş Kılavuzu simgesi (ClipboardList) kırmızı zemin + hafif
             büyüyüp küçülme (nabız) efektiyle dikkat çeker. 30 gün dolunca
             bu sınıf artık uygulanmaz, ikon normal görünümüne döner.
             ================================================================ */
          @keyframes yeniPersonelIsikYanson {
            0%, 100% { background-color: #dc2626; box-shadow: 0 0 0 0 rgba(220,38,38,0.6); transform: scale(1); }
            50%      { background-color: #f87171; box-shadow: 0 0 0 6px rgba(220,38,38,0.15); transform: scale(1.08); }
          }
          .yeni-personel-isik-yanson {
            animation: yeniPersonelIsikYanson 1s ease-in-out infinite;
          }

          /* ================================================================
             YENİ: DEFTER KISAYOLU — SÜREKLİ YANIP SÖNME
             Müdür ve firma sahibinde, isim satırının yanındaki Defter simgesi
             kalıcı olarak nabız atar. İş Kılavuzu'nun kırmızısından ayrılsın
             diye ZÜMRÜT YEŞİLİ seçildi (Defter sayfasının kendi rengi).
             Ritim biraz daha yavaş (1.6s) — sürekli göründüğü için hızlı
             yanıp sönme yorucu olurdu; bu tempo göz köşesinde fark edilir
             ama rahatsız etmez.
             ================================================================ */
          @keyframes defterKisayolYanson {
            0%, 100% { background-color: #059669; box-shadow: 0 0 0 0 rgba(16,185,129,0.55); transform: scale(1); }
            50%      { background-color: #34d399; box-shadow: 0 0 0 7px rgba(16,185,129,0.12); transform: scale(1.10); }
          }
          .defter-kisayol-yanson {
            animation: defterKisayolYanson 1.6s ease-in-out infinite;
          }
          /* Hareket azaltma tercihi açık kullanıcılarda animasyon durur,
             simge sabit yeşil kalır (erişilebilirlik). */
          @media (prefers-reduced-motion: reduce) {
            .defter-kisayol-yanson { animation: none; background-color: #059669; }
          }

          /* ================================================================
             YENİ: MOBİLDE "AŞAĞI ÇEKİNCE SAYFA YENİLEME" (pull-to-refresh) KAPALI
             Sayfanın en üstündeyken parmakla aşağı çekildiğinde tarayıcının
             sayfayı yenilemesini engeller. "contain" değeri sayfa içindeki
             normal kaydırmayı BOZMAZ; yalnızca kaydırma sınırına gelindiğinde
             tarayıcının devraldığı yenileme/zincirleme davranışını durdurur.
             Chrome (Android), Edge, Safari 16+ ve Chrome iOS'ta geçerlidir.
             ================================================================ */
          html, body {
            overscroll-behavior-y: contain;
            overscroll-behavior-x: none;
          }
          /* Uygulamanın kök kapsayıcısı da aynı davranışı devralır (React mount noktası) */
          #root, #app {
            overscroll-behavior: contain;
          }
          /* Pencere/tablo içi kaydırma alanları: alt/üst sınıra gelindiğinde
             kaydırmanın arkadaki sayfaya "taşmasını" ve yenilemeyi tetiklemesini önler */
          .custom-scrollbar, .custom-scrollbar-table {
            overscroll-behavior: contain;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
          .custom-scrollbar-table::-webkit-scrollbar {
            height: 16px;
            width: 16px;
          }
          .custom-scrollbar-table::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
          }
          .custom-scrollbar-table::-webkit-scrollbar-thumb {
            background-color: #ef4444;
            border-radius: 10px;
            border: 4px solid #f1f5f9;
          }
          .custom-scrollbar-table::-webkit-scrollbar-thumb:hover {
            background-color: #dc2626;
          }
        `}} />
      </div>
    );
  }

// ============================================================================
// YENİ: HATA YAKALAYICI (ErrorBoundary) — "Beyaz Ekran" Sorununa Kalıcı Çözüm
// ----------------------------------------------------------------------------
// Sorun: Uygulama içinde bir yerde beklenmeyen bir JavaScript hatası oluşursa,
// React o an ekrandaki her şeyi kaldırır ve kullanıcı BOŞ/BEYAZ bir ekranla
// baş başa kalır — hatanın ne olduğuna dair hiçbir bilgi görünmez.
//
// Çözüm: AppInternal (yukarıdaki, eskiden "App" olan asıl uygulama) artık bu
// ErrorBoundary ile sarmalanıyor. Bir hata oluştuğunda ekran BEYAZ KALMAZ;
// yerine hatanın mesajını ve "Sayfayı Yenile" butonunu gösteren bir ekran
// çıkar. Böylece mobilde (veya herhangi bir cihazda) bu sorun tekrar
// yaşanırsa, ekrandaki mesaj bize (veya bana) tam olarak neyin patladığını
// gösterir; artık kör tahmin yapmaya gerek kalmaz.
//
// ÖNEMLİ: AppInternal'in içeriğine (state, useEffect, JSX) TEK SATIR
// dokunulmadı; sadece fonksiyonun adı değiştirildi ve buraya bir sarmalayıcı
// eklendi. Uygulamanın normal çalışma mantığı BİREBİR AYNI.
// ============================================================================
class SembolErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hataVar: false, hata: null, hataDetay: null };
  }
  static getDerivedStateFromError(hata) {
    return { hataVar: true, hata };
  }
  componentDidCatch(hata, hataDetay) {
    // Hatayı tarayıcı konsoluna da yazdır (uzaktan hata ayıklama için)
    console.error('Sembol CRM - Yakalanan Hata:', hata, hataDetay);
    this.setState({ hataDetay });
  }
  handleYenile = () => {
    // Bozuk bir sekme hafızası (sessionStorage) sorunun kaynağıysa temizler
    try { sessionStorage.removeItem('sembolAktifSekme'); } catch (e) {}
    window.location.reload();
  };
  render() {
    if (this.state.hataVar) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px', color: '#ef4444' }}>Bir şeyler ters gitti</h1>
          <p style={{ fontSize: '13px', color: '#a3a3a3', maxWidth: '440px', marginBottom: '16px', lineHeight: 1.5 }}>
            Uygulama beklenmeyen bir hatayla karşılaştı. Aşağıdaki hata mesajını ekran görüntüsü alıp destek ekibine iletebilirsiniz.
          </p>
          <div style={{
            background: '#1a1a1a', border: '1px solid #ef4444', borderRadius: '12px',
            padding: '14px', maxWidth: '90vw', overflowX: 'auto', marginBottom: '20px'
          }}>
            <code style={{ fontSize: '11px', color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {String(this.state.hata?.message || this.state.hata || 'Bilinmeyen hata')}
            </code>
          </div>
          <button onClick={this.handleYenile} style={{
            background: '#dc2626', color: '#fff', border: 'none', borderRadius: '12px',
            padding: '12px 24px', fontSize: '14px', fontWeight: 900, cursor: 'pointer'
          }}>
            🔄 Sayfayı Yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// YENİ: Gerçek dışa aktarım (export default) — AppInternal'i ErrorBoundary
// içinde render eder. Uygulamanın giriş noktası (main.jsx / index.jsx) hiçbir
// değişiklik gerektirmez; "import App from './App.jsx'" aynen çalışır.
export default function App() {
  return (
    <SembolErrorBoundary>
      <AppInternal />
    </SembolErrorBoundary>
  );
}
