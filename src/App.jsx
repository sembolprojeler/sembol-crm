import React, { useState, useEffect } from 'react';
import { Truck, Calendar, Phone, FileText, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, ChevronDown, ChevronUp, Briefcase, Car, Wallet, CheckSquare, Shield, Activity, ArrowUpRight, UserPlus, Camera, Edit, Ban, LogOut, Lock, Bell, User, Sparkles, Loader2, Copy, MessageSquareText, MessageCircle, Package, Database, Download, Save, Search, Key, ListTodo, Eye, EyeOff, FolderOpen } from 'lucide-react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs, query, orderBy, getDoc, limit, where } from 'firebase/firestore';
import { db, appId, auth, DEPO_LOCATIONS, MESAI_STATUS_OPTIONS, callGeminiAPI, isVideoUrl, normalizeCariName, normalizeCariPhone, CopyButton, MediaCaptureMenu, calculateMaterials, generateContractPDF } from './shared.jsx';
import { AddJobView, CustomerListView, CustomerProfileView } from './Satis.jsx';
import { AddInfoView, CurrentJobsView, AllJobsView, CompletedJobsView, CalendarView, IzinTahtasiView, PuantajTahtasiView, MaviMesaiTahtasiView, MaterialListView, DamagedJobsView, CancelledJobsView, AddVehicleView, VehicleMaintenanceView, VehicleProfileView, AddPersonnelView, PersonnelListView, PersonnelProfileView, OzlukDosyalariView, ComplaintsView, PersonelTahtasiView, IsOnaylamaTahtasiView, EkipKurmaTahtasiView, MyAssignedJobsView, MyComplaintSubmitView } from './Operasyon.jsx';
import { ReportingView, AdvancedReportingView, FinanceDashboardView, PersonelMuhasebeView, PersonelOdemeView } from './Finans.jsx';
  // ============================================================================
  // GÜNCELLENMİŞ DashboardView — Kendi App.jsx dosyanızdaki eski DashboardView
  // bileşeninin TAMAMININ yerine bunu koyun. Diğer hiçbir dosyaya/bileşene
  // dokunmanıza gerek yok. db ve appId zaten './shared.jsx' üzerinden modül
  // seviyesinde import edildiği için ekstra prop göndermenize gerek kalmadı.
  // ============================================================================
  const DashboardView = ({ jobs, allJobs, personnelList, currentUser, setViewingImage, transactions }) => {
    const [filterPeriod, setFilterPeriod] = useState('today');
    const [viewingDashboardJob, setViewingDashboardJob] = useState(null);

    const isAdmin = ['Müdür', 'Firma Sahibi', 'Operasyon'].some(role => currentUser?.position?.includes(role) || currentUser?.rank === role) || currentUser?.permissions?.canEdit;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    const matchesPeriod = (d) => {
      if (filterPeriod === 'all') return true;
      if (filterPeriod === 'today') return d.toISOString().split('T')[0] === todayStr;
      if (filterPeriod === 'week') {
        const day = today.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const weekStart = new Date(today); weekStart.setDate(today.getDate() - diffToMonday); weekStart.setHours(0, 0, 0, 0);
        return d >= weekStart;
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
    const registrationJobs = jobs.filter(j => matchesPeriod(new Date(j.createdAt || j.date)));

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
    const [dailyData, setDailyData] = useState({ today: null, yesterday: null });
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

        let todayPuan = parseFloat(currentMonthPuantajRecords[currentUser.id]?.[currentDay]) || 0;
        let yesterdayPuan = 0;

        if (currentMonth === yMonth && currentYear === yYear) {
          yesterdayPuan = parseFloat(currentMonthPuantajRecords[currentUser.id]?.[yDay]) || 0;
        } else {
          const docRefPuantajYest = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${yYear}_${yMonth}`);
          const snapPuantajYest = await getDoc(docRefPuantajYest);
          if (snapPuantajYest.exists()) {
            const yRecords = snapPuantajYest.data().records || {};
            yesterdayPuan = parseFloat(yRecords[currentUser.id]?.[yDay]) || 0;
          }
        }

        const docRefMesaiToday = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${currentYear}_${currentMonth}`);
        const snapMesaiToday = await getDoc(docRefMesaiToday);
        let todayStatus = null;
        let currentMonthMesaiRecords = {};
        if (snapMesaiToday.exists()) {
          currentMonthMesaiRecords = snapMesaiToday.data().records || {};
          const myRecord = currentMonthMesaiRecords[currentUser.id] || {};
          const tData = myRecord[currentDay];
          if (tData) todayStatus = typeof tData === 'object' ? tData.status : tData;
        }

        let yesterdayStatus = null;
        if (currentMonth === yMonth && currentYear === yYear) {
          const myRecord = currentMonthMesaiRecords[currentUser.id] || {};
          const yData = myRecord[yDay];
          if (yData) yesterdayStatus = typeof yData === 'object' ? yData.status : yData;
        } else {
          const docRefMesaiYesterday = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${yYear}_${yMonth}`);
          const snapMesaiYesterday = await getDoc(docRefMesaiYesterday);
          if (snapMesaiYesterday.exists()) {
            const records = snapMesaiYesterday.data().records || {};
            const myRecord = records[currentUser.id] || {};
            const yData = myRecord[yDay];
            if (yData) yesterdayStatus = typeof yData === 'object' ? yData.status : yData;
          }
        }

        setDailyData({
          today: { mesai: todayStatus, puan: todayPuan },
          yesterday: { mesai: yesterdayStatus, puan: yesterdayPuan }
        });
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

    const renderDailySummary = (data, dayLabel) => {
      if (!data || (!data.mesai && data.puan === 0)) return null;
      const boxes = [];

      if (data.puan > 0) {
        let pTitle = '', pMsg = '', pBg = 'bg-yellow-50', pBorder = 'border-yellow-200', pTextCol = 'text-yellow-800';
        let pIcon = <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
        if (data.puan === 0.5) {
          pTitle = `${dayLabel} Destek Puanı!`; pMsg = 'Takım arkadaşlarına yardımcı olduğun için 0.5 puan kazandın. Harika bir takım oyuncususun!';
          pBg = 'bg-blue-50'; pBorder = 'border-blue-200'; pTextCol = 'text-blue-800'; pIcon = <Users className="w-6 h-6 text-blue-600" />;
        } else if (data.puan === 1) {
          pTitle = `${dayLabel} Müşteri Puanı!`; pMsg = 'Müşteri memnuniyetini sağladığın için 1 tam puan kazandın. Tebrikler!';
        } else if (data.puan > 1) {
          pTitle = `${dayLabel} Harika Performans!`; pMsg = `Hem müşteri memnuniyeti hem de takım desteği ile toplam ${data.puan} puan kazandın!`;
          pBg = 'bg-emerald-50'; pBorder = 'border-emerald-200'; pTextCol = 'text-emerald-800'; pIcon = <Sparkles className="w-6 h-6 text-emerald-600" />;
        }
        boxes.push(
          <div key="puan" className={`p-4 rounded-2xl border ${pBg} ${pBorder} shadow-sm flex items-start gap-4 mb-3 w-full`}>
            <div className="bg-white p-3 rounded-full shadow-sm shrink-0 border border-white/50">{pIcon}</div>
            <div>
              <h3 className={`font-black text-base md:text-lg ${pTextCol} mb-0.5`}>{pTitle}</h3>
              <p className={`text-xs md:text-sm font-medium ${pTextCol} opacity-90`}>{pMsg}</p>
            </div>
          </div>
        );
      }

      if (data.mesai) {
        let bg = '', textCol = '', border = '', icon = null, title = '', msg = '';
        switch (data.mesai) {
          case 'G': bg = 'bg-green-50'; border = 'border-green-200'; textCol = 'text-green-800'; title = `${dayLabel} Mesain Onaylandı`; msg = 'Mesain sisteme eksiksiz olarak işlendi. Harika!'; icon = <CheckCircle className="w-6 h-6 text-green-600" />; break;
          case 'FM': bg = 'bg-blue-50'; border = 'border-blue-200'; textCol = 'text-blue-800'; title = `${dayLabel} Fazla Mesai`; msg = 'Harika efor! Emeklerinin karşılığını göreceksin, aynen devam! 💪'; icon = <Clock className="w-6 h-6 text-blue-600" />; break;
          case 'EM': bg = 'bg-yellow-50'; border = 'border-yellow-200'; textCol = 'text-yellow-800'; title = `${dayLabel} Eksik Mesai`; msg = 'Biraz eksik çalıştın gibi görünüyor. Bir dahaki sefere telafi edeceğinden eminiz!'; icon = <Clock className="w-6 h-6 text-yellow-600" />; break;
          case 'D': bg = 'bg-red-50'; border = 'border-red-200'; textCol = 'text-red-800'; title = `${dayLabel} İşe Gelmedin`; msg = 'Aramızda değildin. Umarım her şey yolundadır, seni dinlenmiş olarak bekliyoruz.'; icon = <AlertTriangle className="w-6 h-6 text-red-600" />; break;
          case 'Hİ': bg = 'bg-blue-50'; border = 'border-blue-200'; textCol = 'text-blue-800'; title = `${dayLabel} İzinlisin`; msg = 'Haftalık iznini iyi değerlendir, dinlenmek en doğal hakkın. İyi tatiller! 🌴'; icon = <Clock className="w-6 h-6 text-blue-600" />; break;
          case 'Yİ': bg = 'bg-purple-50'; border = 'border-purple-200'; textCol = 'text-purple-800'; title = `${dayLabel} Yıllık İzindesin`; msg = 'Uzun bir tatil zamanı! Kendine bolca vakit ayır ve iyice dinlen. 🏖️'; icon = <CalendarDays className="w-6 h-6 text-purple-600" />; break;
          case 'Bİ': bg = 'bg-pink-50'; border = 'border-pink-200'; textCol = 'text-pink-800'; title = `${dayLabel} Bayram İznindesin`; msg = 'İyi bayramlar! Sevdiklerinle birlikte güzel vakit geçir. 🍬'; icon = <Star className="w-6 h-6 text-pink-600" />; break;
          case 'FG': bg = 'bg-teal-50'; border = 'border-teal-200'; textCol = 'text-teal-800'; title = `${dayLabel} Fazla Gün`; msg = 'Ekstra bir gün çalışarak gücünü gösterdin! Harikasın! 🚀'; icon = <Activity className="w-6 h-6 text-teal-600" />; break;
          case 'FGM': bg = 'bg-cyan-50'; border = 'border-cyan-200'; textCol = 'text-cyan-800'; title = `${dayLabel} Fazla Gün + Mesai`; msg = 'İzin gününde hem çalışıp hem de mesaiye kaldın! Harika bir efor! 🚀💪'; icon = <Activity className="w-6 h-6 text-cyan-600" />; break;
          case 'Üİ': bg = 'bg-neutral-100'; border = 'border-neutral-300'; textCol = 'text-neutral-700'; title = `${dayLabel} Ücretsiz İzin`; msg = 'İzindesin, dinlenmene bak. Tekrar aramızda görmek için sabırsızlanıyoruz.'; icon = <Ban className="w-6 h-6 text-neutral-500" />; break;
          case 'R': bg = 'bg-orange-50'; border = 'border-orange-200'; textCol = 'text-orange-800'; title = `${dayLabel} Raporlusun`; msg = 'Geçmiş olsun! Lütfen sağlığına dikkat et, seni sağlıklı olarak tekrar görmek istiyoruz. 🏥'; icon = <Activity className="w-6 h-6 text-orange-600" />; break;
          default: break;
        }
        if (title) {
          boxes.push(
            <div key="mesai" className={`p-4 rounded-2xl border ${bg} ${border} shadow-sm flex items-start gap-4 mb-3 w-full`}>
              <div className="bg-white p-3 rounded-full shadow-sm shrink-0 border border-white/50">{icon}</div>
              <div>
                <h3 className={`font-black text-base md:text-lg ${textCol} mb-0.5`}>{title}</h3>
                <p className={`text-xs md:text-sm font-medium ${textCol} opacity-90`}>{msg}</p>
              </div>
            </div>
          );
        }
      }

      return (
        <div className="flex-1 animate-in fade-in slide-in-from-top-4 flex flex-col">
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3 pl-1 border-b border-neutral-200 pb-2">{dayLabel} Özeti</h3>
          <div className="flex flex-col flex-1">{boxes}</div>
        </div>
      );
    };

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
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
          <div className="flex items-start lg:items-center gap-4 w-full lg:w-auto">
            <div>
              <h2 className="text-2xl font-black text-black">Hoş Geldiniz, {currentUser?.fullName}</h2>
              <p className="text-neutral-500 font-medium">Sistemdeki genel operasyon özetini aşağıdan takip edebilirsiniz.</p>
            </div>
            {isMaviYaka && (
              <button onClick={handleRefresh} disabled={isRefreshing} className="ml-auto p-2.5 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition shrink-0 shadow-sm border border-neutral-200" title="Günlük Özeti Yenile">
                <Loader2 className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-red-600' : ''}`} />
              </button>
            )}
          </div>
          {isMaviYaka && (
            <div className={`flex items-center gap-4 p-3 pr-5 rounded-2xl border ${scoreColor} shadow-sm shrink-0 w-full lg:w-auto animate-in slide-in-from-right-4`}>
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/50">{scoreIcon}</div>
              <div>
                <div className="flex items-end gap-2 mb-0.5">
                  <span className={`text-2xl font-black leading-none ${scoreTextColor}`}>{myScore.toString().replace('.', ',')}</span>
                  <span className="text-xs font-bold text-neutral-600 mb-0.5 uppercase tracking-wider">Aylık Puan</span>
                </div>
                <p className={`text-xs font-bold ${scoreTextColor} opacity-90`}>{scoreMessage}</p>
              </div>
            </div>
          )}
        </div>

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

        {/* BUGÜN / DÜN MESAİ VE YORUM(PUAN) DURUMU — sadece Mavi Yaka */}
        {isMaviYaka && (dailyData.today || dailyData.yesterday) && (
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {dailyData.today && <div className="flex-1">{renderDailySummary(dailyData.today, 'Bugün')}</div>}
            {dailyData.yesterday && <div className="flex-1">{renderDailySummary(dailyData.yesterday, 'Dün')}</div>}
          </div>
        )}

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Toplam İş</p>
            <p className="text-2xl font-black text-black mb-2">{dashboardJobs.length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.type === 'Nakliye' || !j.type).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Bekleyen</p>
            <p className="text-2xl font-black text-neutral-600 mb-2">{dashboardJobs.filter(j => j.status === 'pending').length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.status === 'pending' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.status === 'pending' && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.status === 'pending' && j.type === 'Asansör').length} Asansör</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Toplam Kayıt</p>
            <p className="text-2xl font-black text-black mb-2">{registrationJobs.length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{registrationJobs.filter(j => j.type === 'Nakliye' || !j.type).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{registrationJobs.filter(j => j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{registrationJobs.filter(j => j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">Onay Bekleyen Kayıt</p>
            <p className="text-2xl font-black text-neutral-600 mb-2">{registrationJobs.filter(j => j.status === 'pending').length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{registrationJobs.filter(j => j.status === 'pending' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{registrationJobs.filter(j => j.status === 'pending' && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{registrationJobs.filter(j => j.status === 'pending' && j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 border-l-4 border-l-neutral-400 flex flex-col justify-between">
            <p className="text-neutral-500 text-sm font-medium mb-1">İptal Edilen Kayıt</p>
            <p className="text-2xl font-black text-neutral-500 mb-2">{registrationJobs.filter(j => j.status === 'cancelled').length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{registrationJobs.filter(j => j.status === 'cancelled' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{registrationJobs.filter(j => j.status === 'cancelled' && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{registrationJobs.filter(j => j.status === 'cancelled' && j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
          <div className="bg-black p-4 rounded-2xl shadow-sm border border-black flex flex-col justify-between">
            <p className="text-neutral-400 text-sm font-medium mb-1">Onaylanan Kayıt</p>
            <p className="text-2xl font-black text-white mb-2">{registrationJobs.filter(j => j.status !== 'cancelled' && j.status !== 'pending').length}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{registrationJobs.filter(j => j.status !== 'cancelled' && j.status !== 'pending' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{registrationJobs.filter(j => j.status !== 'cancelled' && j.status !== 'pending' && j.type === 'Depo').length} Depo</span>
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{registrationJobs.filter(j => j.status !== 'cancelled' && j.status !== 'pending' && j.type === 'Asansör').length} Asansör</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-80 flex flex-col">
          <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2"><ClipboardList className="w-5 h-5 text-red-600" /> Son Kaydedilen İşler</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
            {jobs.slice().sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 5).map(job => (
              <div key={job.id} onClick={() => setViewingDashboardJob(job)} className="p-3 bg-neutral-50 hover:bg-neutral-100 cursor-pointer rounded-xl border border-neutral-100 flex justify-between items-center text-sm transition">
                <div>
                  <p className="font-bold text-black">{job.customerName}</p>
                  <p className="text-[10px] text-neutral-500">{job.date} - {job.time}</p>
                  <p className="text-[10px] text-neutral-400 font-medium">Kaydeden: <span className="font-bold text-neutral-600">{job.createdBy || 'Bilinmiyor'}</span></p>
                </div>
                <span className={`text-[9px] px-2 py-1 rounded font-bold text-white uppercase shrink-0 ml-2 ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>{job.type || 'Nakliye'}</span>
              </div>
            ))}
            {jobs.length === 0 && <p className="text-center text-neutral-400 text-xs py-4">Kayıtlı operasyon yok.</p>}
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

  const TodoListView = ({ todos, handleUpdateTodoStatus, handleDeleteTodo }) => {
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

  const UserListView = ({ personnelList, onUpdate, onDelete, positions, ranks, positionModules }) => {
    const [editingUser, setEditingUser] = useState(null);

    const modules = [
      { id: 'dashboard', label: 'Anasayfa' },
      { id: 'calendar', label: 'Takvim' },
      { id: 'profileSettings', label: 'Profilim' },
      { id: 'addInfo', label: 'Bilgilendirme Ekle' },
      { id: 'mySpecialTasks', label: 'Özel Görevlerim' },
      { id: 'addJob', label: 'Satış Bölümü' },
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
      { id: 'globalSearchPersonnel', label: 'Arama: Personel' }
    ];

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

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Users className="w-6 h-6 text-red-600" /> Mevcut Kullanıcılar ve Yetkileri
        </h2>
        
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium mb-6 border border-blue-200">
          Kullanıcıları düzenleyebilir, silebilir veya onlara <b>kişiye özel</b> modül erişim yetkileri atayabilirsiniz. Kişiye özel atanan yetkiler, pozisyon yetkilerini ezer.
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
              {personnelList.map(person => (
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
              {personnelList.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-neutral-500">Kayıtlı kullanıcı bulunamadı.</td>
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

  const PositionsView = ({ positions, onAddPosition, onDeletePosition }) => {
    const [newPos, setNewPos] = useState('');
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
            <div key={idx} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="font-bold text-black">{pos}</span>
              <button onClick={() => onDeletePosition(pos)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const RanksView = ({ ranks, onAddRank, onDeleteRank }) => {
    const [newRank, setNewRank] = useState('');
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
            <div key={idx} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="font-bold text-black">{rank}</span>
              <button onClick={() => onDeleteRank(rank)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PermissionsView = ({ personnelList, handleUpdatePermissions }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Shield className="w-6 h-6 text-red-600" /> İzinler Yönetimi
      </h2>
      <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-6 border border-red-200">
        Personellerin sisteme müdahale (veri ekleme, silme, düzenleme) ve sisteme giriş yetkilerini buradan yönetebilirsiniz. <b>Düzenleme Yetkisi</b> verilen personeller görüntüleyebildikleri modüllerde değişiklik yapabilirler. Sayfa görünürlükleri "Modül Görüntüleme" alanından belirlenir.
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
            {personnelList.map(user => (
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
          </tbody>
        </table>
      </div>
    </div>
  );

const ModuleAccessView = ({ positions, ranks = [], positionModules, handleUpdatePositionModuleAccess }) => {
    const modules = [
      { id: 'dashboard', label: 'Anasayfa' },
      { id: 'calendar', label: 'Takvim' },
      { id: 'profileSettings', label: 'Profilim' },
      { id: 'addInfo', label: 'Bilgilendirme Ekle' },
      { id: 'mySpecialTasks', label: 'Özel Görevlerim' },
      { id: 'addJob', label: 'Satış Bölümü' },
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
      { id: 'globalSearchPersonnel', label: 'Arama: Personel' }
    ];

    const allGroups = [...new Set([...(positions || []), ...(ranks || [])])];

    const handleToggle = (group, moduleId, currentStatus) => {
      handleUpdatePositionModuleAccess(group, moduleId, !currentStatus);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Eye className="w-6 h-6 text-red-600" /> Pozisyona Göre Modül Görüntüleme Yetkileri
        </h2>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium mb-6 border border-blue-200">
          Bu sayfadan yetkilendirmeleri <b>pozisyonlara göre</b> yönetebilirsiniz. Burada yapacağınız ayarlamalar o pozisyonda çalışan tüm personeller için geçerli olacaktır. Görüntüleme yetkisi olmayan kullanıcılar o modüle erişemezler.
        </div>
        
        <div className="space-y-6">
          {allGroups.map(group => (
            <div key={group} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4 border-b border-neutral-200 pb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-black">{group}</h4>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase">Tüm "{group}" personelleri için geçerlidir</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {modules.map(mod => {
                  const hasAccess = positionModules?.[group]?.[mod.id] ?? false;
                  return (
                    <label key={mod.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${hasAccess ? 'bg-blue-50 border-blue-200' : 'bg-white border-neutral-200 hover:bg-neutral-100'}`}>
                      <span className={`text-xs font-bold ${hasAccess ? 'text-blue-800' : 'text-neutral-600'}`}>{mod.label}</span>
                      <div className="relative inline-flex items-center">
                        <input type="checkbox" className="sr-only peer" checked={hasAccess} onChange={() => handleToggle(group, mod.id, hasAccess)} />
                        <div className="w-7 h-4 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {allGroups.length === 0 && (
            <p className="text-center text-neutral-500 italic py-4">Sistemde tanımlı pozisyon/rütbe bulunmuyor.</p>
          )}
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
            <img
              src={logoPreview || "https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp"}
              alt="Logo Önizleme"
              className="w-auto object-contain"
              style={{ height: `${96 * (logoSize / 100)}px` }}
              onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl">S</div>'; }}
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

  const SystemFilesView = ({ jobs, personnelList, vehicles, materials, db, appId, addSystemLog }) => {
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
      </div>
    );
  };

  const SystemLogsView = ({ logs }) => (
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
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-neutral-50 transition">
                <td className="p-4 font-medium text-black whitespace-nowrap">{log.timestamp}</td>
                <td className="p-4 font-bold text-neutral-800">{log.user}</td>
                <td className="p-4">
                  <span className="bg-neutral-100 px-2 py-1 rounded-md text-xs font-bold border border-neutral-200">{log.action}</span>
                </td>
                <td className="p-4 text-neutral-600">{log.details}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="4" className="p-6 text-center text-neutral-500 font-medium">Sistemde henüz bir hareket bulunmuyor.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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

  const NotificationsView = ({ notifications, markNotificationsAsRead, currentUser }) => {
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
        <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Bell className="w-7 h-7 text-red-600" /> Bildirim Merkezi
        </h2>
        <div className="space-y-4">
          {myNotifications.length === 0 ? (
             <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200">
               <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
               <p className="text-neutral-500 font-medium">Sistemde size ait herhangi bir bildirim bulunmuyor.</p>
             </div>
          ) : (
             myNotifications.map(n => (
               <div key={n.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${n.read ? 'bg-white border-neutral-200' : 'bg-red-50/40 border-red-200'}`}>
                 <div>
                   <h4 className="font-bold text-black flex items-center gap-2 text-lg">
                     {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0"></span>}
                     {n.title}
                   </h4>
                   <p className="text-sm text-neutral-600 mt-1.5 leading-relaxed">{n.message}</p>
                 </div>
                 <div className="shrink-0 text-right">
                    <span className="inline-block text-xs font-bold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />{n.date}
                    </span>
                 </div>
               </div>
             ))
          )}
        </div>
      </div>
    );
  };

  const ProfileSettingsView = ({ currentUser, handleUpdatePersonnel }) => {
    const [editForm, setEditForm] = useState({ 
      personalPhone: currentUser?.personalPhone || '', 
      password: currentUser?.password || '', 
      profileImage: currentUser?.profileImage || '' 
    });
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

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
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto relative">
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
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Giriş Şifresi</label>
               <input type="text" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
           </div>

           <button type="button" onClick={handleSaveProfile} disabled={isUploading} className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 disabled:opacity-50">
             Bilgilerimi Güncelle
           </button>
         </div>
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
            <img 
              src={appBranding?.logoUrl || "https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp"} 
              alt="Sembol Nakliyat" 
              className="w-auto object-contain mb-2 drop-shadow-sm" 
              style={{ height: `${96 * ((appBranding?.logoSize || 100) / 100)}px` }}
              onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4">S</div><h1 class="text-2xl font-black text-black tracking-widest">SEMBOL</h1>'; }} 
            />
            <p className="text-red-600 text-xs font-bold mt-1 tracking-[0.2em] bg-red-50 px-3 py-1 rounded-full border border-red-100">OPERASYON MERKEZİ</p>
          </div>
          
          <div  className="p-8 space-y-6">
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
            
            <button type="button" onClick={handleSubmit} className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 text-lg mt-4">
              Sisteme Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- ANA UYGULAMA (APP) ---
  export default function App() {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState('dashboard'); 
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
    
    const [isOperasyonSubMenuOpen, setIsOperasyonSubMenuOpen] = useState(false);
    
    const [recordType, setRecordType] = useState('Nakliye');
    const [transactionType, setTransactionType] = useState('income');
    const [editingJobId, setEditingJobId] = useState(null); 
    const [cancelJobId, setCancelJobId] = useState(null); 
    const [deleteJobId, setDeleteJobId] = useState(null);
    const [markDamageJobId, setMarkDamageJobId] = useState(null);
    const [resolveDamageModal, setResolveDamageModal] = useState({ isOpen: false, jobId: null, note: '' });

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
    const [endJobData, setEndJobData] = useState({ 
      paymentMethod: 'Nakit', 
      damageStatus: 'Hasarsız teslim edildi', 
      damageDetails: '',
      damageImages: [],
      truckImages: [],
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
    
    const [jobs, setJobs] = useState([]);
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
    const [appBranding, setAppBranding] = useState({ logoUrl: '', logoSize: 100 });
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

    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', phone: '', position: '' });
    const [isContactsOpen, setIsContactsOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [viewingCariKey, setViewingCariKey] = useState(null);
    const [viewingPersonnelProfileId, setViewingPersonnelProfileId] = useState(null);
    const [pendingEditPersonnelId, setPendingEditPersonnelId] = useState(null);
    const [viewingVehicleProfileId, setViewingVehicleProfileId] = useState(null);
    const [vehicleEditForm, setVehicleEditForm] = useState({});
    const [viewingRuhsatUrl, setViewingRuhsatUrl] = useState(null);

    const [isDataMigrated, setIsDataMigrated] = useState(() => localStorage.getItem('sembol_data_migrated') === 'true');

    const [formData, setFormData] = useState({
      isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo',
      fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Toplu', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '',
      extraLoadingAddresses: [], selectedDepo: '', 
      toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Toplu', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '',
      extraUnloadingAddresses: [],
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

      const historyStartDate = new Date();
      historyStartDate.setFullYear(historyStartDate.getFullYear() - 8);
      const startDateStr = historyStartDate.toISOString().split('T')[0];

      const qJobs = query(getCol('jobs'), where('date', '>=', startDateStr));
      const qTrans = query(getCol('transactions'), limit(300));
      const qTasks = query(getCol('tasks'), limit(100));

      unsubs.push(onSnapshot(qJobs, snap => { setJobs(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, jobs: true})); }, console.error));
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

      unsubs.push(onSnapshot(getCol('personnelActions'), snap => {
        setAllPersonnelActions(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }, console.error));

      unsubs.push(onSnapshot(getCol('mesai'), snap => {
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
              flat.push({ personId, year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(dayNum), code });
            });
          });
        });
        setAllMesaiRecords(flat);
      }, console.error));

      unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), async docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPositions(data.positions || []);
          setRanks(data.ranks || []);
          setPositionModules(data.positionModules || {});
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
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppBranding({ logoUrl: data.logoUrl || '', logoSize: data.logoSize || 100 });
        } else {
          setAppBranding({ logoUrl: '', logoSize: 100 });
        }
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
        timestamp: new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      });
    };

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

    const handleAddRank = async (newRank) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { ranks: [...ranks, newRank] });
    };

    const handleDeleteRank = async (rankToDelete) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { ranks: ranks.filter(r => r !== rankToDelete) });
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
      setActiveTab('todoList');
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

        const initialModalData = {};
        validTeamIds.forEach(pId => {
          const valObj = records[pId] && records[pId][day];
          const val = typeof valObj === 'object' && valObj !== null ? valObj.status : valObj || '';
          const hours = typeof valObj === 'object' && valObj !== null ? valObj.hours : '';
          initialModalData[pId] = {
             status: val || 'G',
             hours: hours || ''
          };
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
        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${year}_${month}`);
        const snap = await getDoc(mesaiRef);
        let records = snap.exists() ? snap.data().records : {};

        Object.keys(mesaiModalData).forEach(pId => {
          if (!records[pId]) records[pId] = {};
          records[pId][day] = mesaiModalData[pId];
        });

        await setDoc(mesaiRef, { records, updatedAt: new Date().toISOString() }, { merge: true });

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobForMesai.id), { mesaiApproved: true });

        addSystemLog('Mesai Onaylandı', `${jobForMesai.customerName} operasyonundaki personellerin mesai durumları güncellendi.`);
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
        if (formData.depoDirection === 'fromDepo') {
          setFormData({...formData, selectedDepo: depoName, fromProvince: depo.province, fromDistrict: depo.district, fromAddress: depo.address, fromFloor: 'Giriş Kat', fromTransportMethod: 'Merdiven', fromPacking: 'Toplu', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre'});
        } else {
          setFormData({...formData, selectedDepo: depoName, toProvince: depo.province, toDistrict: depo.district, toAddress: depo.address, toFloor: 'Giriş Kat', toTransportMethod: 'Merdiven', toPacking: 'Toplu', toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre'});
        }
      } else {
        if (formData.depoDirection === 'fromDepo') {
          setFormData({...formData, selectedDepo: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromAddress: '', fromFloor: '1. Kat', fromTransportMethod: 'Merdiven', fromPacking: 'Toplu', fromRoomCount: '2+1', fromDistance: '', fromDistanceUnit: 'Metre'});
        } else {
          setFormData({...formData, selectedDepo: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toAddress: '', toFloor: '1. Kat', toTransportMethod: 'Merdiven', toPacking: 'Toplu', toRoomCount: '2+1', toDistance: '', toDistanceUnit: 'Metre'});
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
      const updateData = { status: 'cancelled' };

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
      setResolveDamageModal({ isOpen: true, jobId: id, note: '' });
    };

    const handleResolveDamageSubmit = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !resolveDamageModal.jobId) return;

      const job = jobs.find(j => j.id === resolveDamageModal.jobId);
      if (!job) return;

      const updatedEndJobDetails = {
        ...(job.endJobDetails || {}),
        damageResolved: true,
        damageResolutionNote: resolveDamageModal.note
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
        endJobDetails: updatedEndJobDetails
      });

      addSystemLog('Hasar Çözüldü', `${job.customerName} müşterisinin hasar kaydı çözüldü olarak işaretlendi.`);
      setResolveDamageModal({ isOpen: false, jobId: null, note: '' });
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

        if (editingJobId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', editingJobId), jobData);
          addSystemLog('Kayıt Güncellendi', `${formData.customerName} müşterisine ait iş güncellendi.`);
          setEditingJobId(null);
        } else {
          const newDeliveryCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          
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
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), primaryJob);
            
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
          isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Toplu', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', extraLoadingAddresses: [], selectedDepo: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Toplu', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', extraUnloadingAddresses: [], date: new Date().toISOString().split('T')[0], time: '09:00', durationDays: '1', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
        });
        // YENİ: Önceki takvim yönlendirmesi iptal edildi. Bunun yerine altta
        // "Müşteri Kaydınız Oluşturuldu" paneli açılır (WA bilgilendirme + sözleşme indirme seçenekli).
        setSavedJobInfo({ ...jobData, wasEditing });
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

      const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking);
      setAssignedMaterials({
        strec: est.strec || 0,
        bant: est.bant || 0,
        poset: est.poset || 0,
        kagit: est.kagit || 0,
        koli: est.koli || 0
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
      setEndJobData({ 
        paymentMethod: 'Nakit', damageStatus: 'Hasarsız teslim edildi', damageDetails: '', damageImages: [], truckImages: [], truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Herhangi bir işlem yapmadı.', enteredCode: '',
        elevatorSetup: 'Evet', elevatorSetupReason: '', elevatorImages: [], elevatorIssue: 'Hayır', elevatorIssueReason: '', vehicleIssue: 'Hayır', vehicleIssueReason: '',
        // YENİ: İş zaten sonlandırılmışsa (düzenleme modu) önceki sonlandırma bilgilerini forma doldur.
        // Yeni/devam eden işlerde job.endJobDetails boş olduğu için varsayılanlar aynen kalır.
        ...(job.endJobDetails || {})
      });
      setShowEndJobModal(true);
    };

    const handleFileUpload = async (e, type) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (type === 'truck') setEndJobData(prev => ({ ...prev, truckImages: [...(prev.truckImages || []), 'Yükleniyor...'] }));
      else if (type === 'elevator') setEndJobData(prev => ({ ...prev, elevatorImages: [...(prev.elevatorImages || []), 'Yükleniyor...'] }));
      else setEndJobData(prev => ({ ...prev, damageImages: [...(prev.damageImages || []), 'Yükleniyor...'] }));

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
        
        if (type === 'truck') {
          setEndJobData(prev => ({ ...prev, truckImages: prev.truckImages.map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        } else if (type === 'elevator') {
          setEndJobData(prev => ({ ...prev, elevatorImages: prev.elevatorImages.map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        } else {
          setEndJobData(prev => ({ ...prev, damageImages: prev.damageImages.map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        }
      } catch (err) {
        console.error("Yükleme hatası:", err);
        if (type === 'truck') {
          setEndJobData(prev => ({ ...prev, truckImages: prev.truckImages.map(img => img === 'Yükleniyor...' ? file.name : img) }));
        } else if (type === 'elevator') {
          setEndJobData(prev => ({ ...prev, elevatorImages: prev.elevatorImages.map(img => img === 'Yükleniyor...' ? file.name : img) }));
        } else {
          setEndJobData(prev => ({ ...prev, damageImages: prev.damageImages.map(img => img === 'Yükleniyor...' ? file.name : img) }));
        }
      }
    };

  const submitEndJob = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      
      if (jobToEnd.type !== 'Asansör') {
        const userCode = (endJobData.enteredCode || '').toString().trim().toUpperCase();
        const realCode = (jobToEnd.deliveryCode || '').toString().trim().toUpperCase();

        if (realCode && userCode !== realCode) {
          setEndJobError(`Girdiğiniz kod hatalı. Müşteriden "${realCode}" kodunu istemelisiniz.`); 
          return;
        }
      }

      setEndJobError('');

      if (!jobToEnd.materialsDeducted && jobToEnd.type !== 'Asansör') {
        const estData = jobToEnd.assignedMaterials || calculateMaterials(jobToEnd.fromRoomCount, jobToEnd.fromPacking);
        const customMats = jobToEnd.customMaterials || [];
        let deductedList = [];

        const norm = (s) => (s || '').toLocaleLowerCase('tr-TR');
        const materialTypes = [
          { key: 'streç', amount: estData.strec || 0 },
          { key: 'bant', amount: estData.bant || 0 },
          { key: 'poşet', amount: estData.poset || 0 },
          { key: 'kağıt', amount: estData.kagit || 0 },
          { key: 'koli', amount: estData.koli || 0 }
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
        
        if (deductedList.length > 0) {
           addSystemLog('Stok Çıkışı (Oto)', `${jobToEnd.customerName} operasyonu sonlandırıldığı için malzemeler düşüldü: ${deductedList.join(', ')}`);
        } else {
           addSystemLog('Stok Çıkışı (Oto)', `${jobToEnd.customerName} operasyonu sonlandırıldı (Düşülecek malzeme bulunamadı).`);
        }
      }

      // YENİ: İlk tamamlanma zamanını kaydediyoruz. 3 saatlik düzenleme penceresi bu zamandan
      // itibaren ölçülür. Sonradan düzenleyip tekrar kaydedildiğinde eski zaman korunur (süre uzamaz).
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToEnd.id), { status: 'completed', endJobDetails: endJobData, materialsDeducted: true, completedAt: jobToEnd.completedAt || new Date().toISOString() });
      setShowEndJobModal(false); 
      setJobToEnd(null);
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
      const est = calculateMaterials(job.fromRoomCount, job.fromPacking);
      const content = `Tahmini Gerekli Malzemeler:\n\n- ${est.strec} Rulo Streç\n- ${est.bant} Adet Bant\n- ${est.poset} Adet Poşet\n- ${est.kagit} Kg Kağıt\n- ${est.koli} Adet Koli`;
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
      try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
    };

    const allDataLoaded = Object.values(dataLoadStatus).every(v => v === true);

    if (isAuthChecking) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white animate-in fade-in">
          <img 
            src={appBranding?.logoUrl || "https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp"} 
            alt="Sembol Nakliyat" 
            className="w-auto object-contain mb-6 animate-pulse drop-shadow-2xl" 
            style={{ height: `${96 * ((appBranding?.logoSize || 100) / 100)}px` }}
            onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4 animate-pulse">S</div>'; }} 
          />
          <p className="font-bold tracking-widest text-neutral-400">SİSTEM YÜKLENİYOR...</p>
        </div>
      );
    }

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

    if (!allDataLoaded) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white animate-in fade-in">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
          <p className="font-bold tracking-widest text-neutral-400">BULUT VERİLERİ EŞİTLENİYOR...</p>
        </div>
      );
    }

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

    return (
      <div className="flex h-screen bg-neutral-50 font-sans text-neutral-900 overflow-hidden">
        
        <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-black text-white flex items-center gap-2 px-3 z-30 shadow-md border-b border-red-600">
          <div className="flex items-center gap-2 shrink-0">
            <img 
              src={appBranding?.logoUrl || "https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp"} 
              alt="Sembol Nakliyat" 
              className="w-auto object-contain" 
              style={{ height: `${Math.min(48, 40 * ((appBranding?.logoSize || 100) / 100))}px` }}
              onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="flex items-center gap-2"><div class="w-8 h-8 bg-red-600 flex items-center justify-center rounded-lg font-black text-white">S</div><h1 class="font-bold text-lg">Sembol Nakliyat</h1></div>'; }} 
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
              const hasAnyResult = vehicleResults.length > 0 || personnelResults.length > 0 || customerResults.length > 0;

              return (
                <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-red-500 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-[70vh] overflow-y-auto custom-scrollbar text-black">
                  {!hasAnyResult && (
                    <p className="p-5 text-sm text-neutral-500 text-center font-medium">Eşleşen araç, personel veya müşteri bulunamadı.</p>
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
            <img 
              src={appBranding?.logoUrl || "https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp"} 
              alt="Sembol Nakliyat" 
              className="w-full object-contain mb-2" 
              style={{ maxWidth: `${180 * ((appBranding?.logoSize || 100) / 100)}px` }}
              onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="flex items-center gap-4"><div class="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-full border-2 border-neutral-800/50 bg-red-600"><span class="font-black text-3xl text-white">S</span></div><div><h1 class="text-2xl font-black leading-tight text-white tracking-widest">SEMBOL</h1></div></div>'; }} 
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
              <button 
                onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`relative p-2 rounded-xl transition shrink-0 ${activeTab === 'notifications' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                title="Bildirimler"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-neutral-900"></span>
                )}
              </button>
            </div>
          </div>
          
          <nav className="flex flex-col mt-4 px-4 gap-2 overflow-y-auto flex-1 pb-6 custom-scrollbar">
            
            {showDashboard && (
              <button 
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <Calendar className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Anasayfa</span>
              </button>
            )}
            
            {showCalendar && (
              <button 
                onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'calendar' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <CalendarDays className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Takvim</span>
              </button>
            )}

            {showProfileSettings && (
              <button 
                onClick={() => { setActiveTab('profileSettings'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'profileSettings' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Profilim</span>
                </div>
              </button>
            )}

            {showAddInfo && (
              <button 
                onClick={() => { setActiveTab('addInfo'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl mt-2 ${activeTab === 'addInfo' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Bilgilendirme Ekle</span>
                </div>
              </button>
            )}

            {showMySpecialTasks && (
              <button 
                onClick={() => { setActiveTab('mySpecialTasks'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl mt-2 ${activeTab === 'mySpecialTasks' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Özel Görevlerim</span>
                </div>
                {unreadTasksCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{unreadTasksCount}</span>
                )}
              </button>
            )}

{isMaviYakaUser && (
                <button 
                  onClick={() => { setActiveTab('myAssignedJobs'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'myAssignedJobs' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Bana Atanan Görevler</span>
                  </div>
                  {unreadJobCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{unreadJobCount}</span>
                  )}
                </button>
            )}

            {showAddJob && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsAddJobSubMenuOpen(!isAddJobSubMenuOpen); setIsJobSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-500/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Satış Bölümü</span>
                  </div>
                  {isAddJobSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isAddJobSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('addNakliye'); setRecordType('Nakliye'); setEditingJobId(null); setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Toplu', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Toplu', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', contractDetails: '', notes: ''}); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addNakliye' ? 'text-yellow-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addNakliye' ? 'bg-yellow-400' : 'bg-yellow-600'}`}></div> Nakliye Kayıt
                    </button>
                    <button 
                      onClick={() => { setActiveTab('addDepo'); setRecordType('Depo'); setEditingJobId(null); setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: 'Giriş Kat', fromPacking: 'Toplu', fromTransportMethod: 'Merdiven', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: 'İstanbul (Anadolu)', toDistrict: '', toFloor: '1. Kat', toPacking: 'Toplu', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', contractDetails: '', notes: '', selectedDepo: '', depoDirection: 'toDepo'}); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addDepo' ? 'text-yellow-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addDepo' ? 'bg-yellow-400' : 'bg-yellow-600'}`}></div> Depo Kayıt
                    </button>
                    <button 
                      onClick={() => { setActiveTab('addAsansor'); setRecordType('Asansör'); setEditingJobId(null); setFormData({...formData, isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', fromProvince: 'İstanbul (Anadolu)', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendi İşimiz', fromTransportMethod: 'Dış Cephe Asansörü', fromRoomCount: 'Yükleme Kurulum', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', toProvince: '', toDistrict: '', toFloor: '', toPacking: '', toTransportMethod: '', toRoomCount: '', toDistance: '', toDistanceUnit: '', toAddress: '', contractDetails: '', notes: ''}); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addAsansor' ? 'text-yellow-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addAsansor' ? 'bg-yellow-400' : 'bg-yellow-600'}`}></div> Asansör Kayıt
                    </button>
                  </div>
                )}
              </div>
            )}

            {showOperasyon && (
              <div className="flex flex-col gap-1 mt-2 mb-2">
                <button 
                  onClick={() => { setIsOperasyonSubMenuOpen(!isOperasyonSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-red-600/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Operasyon Bölümü</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dueMaintenanceCount > 0 && !isOperasyonSubMenuOpen && (
                      <span className="bg-white text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">{dueMaintenanceCount}</span>
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
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'damagedJobs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'damagedJobs' ? 'bg-white' : 'bg-red-600'}`}></div> Hasarlı İşler
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
                    <button 
                      onClick={() => { setActiveTab('puantajTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'puantajTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'puantajTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Puantaj Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('maviMesaiTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'maviMesaiTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'maviMesaiTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Mavi Mesai Tahtası
                    </button>
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

            {showFinance && (
              <div className="flex flex-col gap-1 mt-2 mb-2">
                <button 
                  onClick={() => { setIsFinanceSubMenuOpen(!isFinanceSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsAddJobSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-600/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Finans Bölümü</span>
                  </div>
                  {isFinanceSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isFinanceSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
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

            {showJobList && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsJobSubMenuOpen(!isJobSubMenuOpen); setIsAddJobSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsOperasyonSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'currentJobs' || activeTab === 'completedJobs' || activeTab === 'allJobs' || activeTab === 'damagedJobs' || activeTab === 'cancelledJobs') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className={`w-5 h-5 shrink-0 ${(activeTab === 'currentJobs' || activeTab === 'completedJobs' || activeTab === 'allJobs' || activeTab === 'damagedJobs' || activeTab === 'cancelledJobs') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">İş Listesi</span>
                  </div>
                  {isJobSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isJobSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('currentJobs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'currentJobs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'currentJobs' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut İşler
                    </button>
                    <button 
                      onClick={() => { setActiveTab('completedJobs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'completedJobs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'completedJobs' ? 'bg-white' : 'bg-red-600'}`}></div> Tamamlanan İşler
                    </button>
                    <button 
                      onClick={() => { setActiveTab('allJobs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'allJobs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'allJobs' ? 'bg-white' : 'bg-red-600'}`}></div> Tüm İşler
                    </button>
                    <button 
                      onClick={() => { setActiveTab('cancelledJobs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'cancelledJobs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'cancelledJobs' ? 'bg-white' : 'bg-red-600'}`}></div> İptal Edilen İşler
                    </button>
                  </div>
                )}
              </div>
            )}

            {showCustomers && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsCustomerSubMenuOpen(!isCustomerSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'specialCustomers' || activeTab === 'allCustomers' || activeTab === 'customerBlacklist') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Users className={`w-5 h-5 shrink-0 ${(activeTab === 'specialCustomers' || activeTab === 'allCustomers' || activeTab === 'customerBlacklist') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Müşteri Listesi</span>
                  </div>
                  {isCustomerSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isCustomerSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('allCustomers'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'allCustomers' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'allCustomers' ? 'bg-white' : 'bg-red-600'}`}></div> Tüm Müşteriler
                    </button>
                    <button 
                      onClick={() => { setActiveTab('specialCustomers'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'specialCustomers' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'specialCustomers' ? 'bg-white' : 'bg-red-600'}`}></div> Özel Müşteriler
                    </button>
                    <button 
                      onClick={() => { setActiveTab('customerBlacklist'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'customerBlacklist' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'customerBlacklist' ? 'bg-white' : 'bg-red-600'}`}></div> Kara Liste
                    </button>
                  </div>
                )}
              </div>
            )}

            {showPersonnel && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsPersonnelSubMenuOpen(!isPersonnelSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addPersonnel' || activeTab === 'personnelList' || activeTab === 'ozlukDosyalari' || activeTab === 'complaints') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className={`w-5 h-5 shrink-0 ${(activeTab === 'addPersonnel' || activeTab === 'personnelList' || activeTab === 'ozlukDosyalari' || activeTab === 'complaints') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Personel Listesi</span>
                  </div>
                  {isPersonnelSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isPersonnelSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('addPersonnel'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addPersonnel' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addPersonnel' ? 'bg-white' : 'bg-red-600'}`}></div> Personel Ekle
                    </button>
                    <button 
                      onClick={() => { setActiveTab('personnelList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personnelList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personnelList' ? 'bg-white' : 'bg-red-600'}`}></div> Tüm Personel
                    </button>
                    <button 
                      onClick={() => { setActiveTab('ozlukDosyalari'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'ozlukDosyalari' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ozlukDosyalari' ? 'bg-white' : 'bg-red-600'}`}></div> Özlük Dosyaları
                    </button>
                    <button 
                      onClick={() => { setActiveTab('complaints'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'complaints' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'} relative`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'complaints' ? 'bg-white' : 'bg-red-600'}`}></div> 
                      Şikayet Bildirimleri
                      {complaints.filter(c => !c.read).length > 0 && (
                        <span className="absolute right-4 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{complaints.filter(c => !c.read).length}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {showTodos && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsTodoSubMenuOpen(!isTodoSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addTodo' || activeTab === 'todoList') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <ListTodo className={`w-5 h-5 shrink-0 ${(activeTab === 'addTodo' || activeTab === 'todoList') ? 'text-red-500' : ''}`} /> 
                    <span className="whitespace-nowrap">Yapılacak Listesi</span>
                    {generalTodosCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{generalTodosCount}</span>
                    )}
                  </div>
                  {isTodoSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isTodoSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('addTodo'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addTodo' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addTodo' ? 'bg-white' : 'bg-red-600'}`}></div> Yeni Ekle
                    </button>
                    <button 
                      onClick={() => { setActiveTab('todoList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'todoList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'todoList' ? 'bg-white' : 'bg-red-600'}`}></div> <span className="whitespace-nowrap">Takip ve Yapılacaklar</span>
                      </div>
                      {generalTodosCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{generalTodosCount}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {showAuth && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsAuthSubMenuOpen(!isAuthSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'userList' || activeTab === 'positions' || activeTab === 'ranks' || activeTab === 'permissions' || activeTab === 'moduleAccess') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Shield className={`w-5 h-5 shrink-0 ${(activeTab === 'userList' || activeTab === 'positions' || activeTab === 'ranks' || activeTab === 'permissions' || activeTab === 'moduleAccess') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Yetkilendirme</span>
                  </div>
                  {isAuthSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isAuthSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('userList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'userList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'userList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Kullanıcılar
                    </button>
                    <button 
                      onClick={() => { setActiveTab('positions'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'positions' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'positions' ? 'bg-white' : 'bg-red-600'}`}></div> Pozisyonlar
                    </button>
                    <button 
                      onClick={() => { setActiveTab('ranks'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'ranks' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ranks' ? 'bg-white' : 'bg-red-600'}`}></div> Rütbeler
                    </button>
                    <button 
                      onClick={() => { setActiveTab('permissions'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'permissions' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'permissions' ? 'bg-white' : 'bg-red-600'}`}></div> İzinler Yönetimi
                    </button>
                    <button 
                      onClick={() => { setActiveTab('moduleAccess'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'moduleAccess' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'moduleAccess' ? 'bg-white' : 'bg-red-600'}`}></div> Modül Görüntüleme
                    </button>
                  </div>
                )}
              </div>
            )}

            {showSystemFiles && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsSystemFilesSubMenuOpen(!isSystemFilesSubMenuOpen); setIsAuthSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'backupSystem' || activeTab === 'systemLogs' || activeTab === 'userActivities' || activeTab === 'companyPasswords') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 shrink-0 ${(activeTab === 'backupSystem' || activeTab === 'systemLogs' || activeTab === 'userActivities' || activeTab === 'companyPasswords') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Sistem Dosyaları</span>
                  </div>
                  {isSystemFilesSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isSystemFilesSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
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
                  </div>
                )}
              </div>
            )}

            {showSystemFiles && (
              <button 
                onClick={() => { setActiveTab('appSettings'); setIsSidebarOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'appSettings' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <Sparkles className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Uygulama Ayarları</span>
              </button>
            )}

            {showMyComplaint && (
              <button 
                onClick={() => { setActiveTab('myComplaint'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl mt-2 ${activeTab === 'myComplaint' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Şikayet Bildirim</span>
                </div>
              </button>
            )}

          </nav>

          <div className="px-4 pb-4">
            <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
               <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
                  <button onClick={() => setIsContactsOpen(!isContactsOpen)} className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:text-white transition flex-1 text-left">
                    <Phone className="w-3.5 h-3.5"/> Şirket İletişimi {isContactsOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </button>
                  {isManager && (
                    <button onClick={() => { setContactForm({ name: '', phone: '', position: '' }); setEditingContact(null); setShowContactModal(true); }} className="hover:text-white transition bg-emerald-800/50 hover:bg-emerald-700/50 p-1.5 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                      <PlusCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
               </div>
               
               {isContactsOpen && (
                 <div className="space-y-1 mt-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {companyContacts.map((c, index) => (
                       <div key={c.id} className="flex justify-between items-center group">
                          <a href={`tel:${c.phone}`} className="flex flex-col hover:bg-emerald-800/30 p-1.5 rounded transition w-full">
                             <span className="text-white text-xs font-bold truncate">{c.name}</span>
                             <span className="text-emerald-200/70 text-[9px] truncate mt-0.5">{c.position} - {c.phone}</span>
                          </a>
                          {isManager && (
                             <div className="flex items-center shrink-0 gap-1 bg-emerald-900/50 p-1 rounded-lg">
                                <button disabled={index === 0} onClick={() => handleReorderContact(index, 'up')} className="text-neutral-400 hover:text-white disabled:opacity-30 p-0.5"><ChevronUp className="w-3 h-3"/></button>
                                <button disabled={index === companyContacts.length - 1} onClick={() => handleReorderContact(index, 'down')} className="text-neutral-400 hover:text-white disabled:opacity-30 p-0.5"><ChevronDown className="w-3 h-3"/></button>
                                <button onClick={() => { setEditingContact(c); setContactForm({name: c.name, phone: c.phone, position: c.position}); setShowContactModal(true); }} className="text-blue-400 hover:text-blue-300 p-0.5"><Edit className="w-3 h-3"/></button>
                                <button onClick={() => handleDeleteContact(c.id)} className="text-red-400 hover:text-red-300 p-0.5"><X className="w-3 h-3"/></button>
                             </div>
                          )}
                       </div>
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

        <main className="flex-1 w-full p-4 md:p-8 mt-16 md:mt-0 overflow-y-auto relative">
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

            {activeTab === 'dashboard' && showDashboard && <DashboardView jobs={visibleJobs} allJobs={jobs} personnelList={personnelList} currentUser={currentUser} setViewingImage={setViewingImage} transactions={transactions} />}
            {activeTab === 'notifications' && <NotificationsView notifications={visibleNotifications} markNotificationsAsRead={markNotificationsAsRead} currentUser={currentUser} />}
            {activeTab === 'calendar' && showCalendar && <CalendarView jobs={currentUser?.position === 'Operatör' ? jobs : visibleJobs} handleEditJob={handleEditJob} currentUser={currentUser} setJobToChangeDate={setJobToChangeDate} setNewJobDate={setNewJobDate} setShowChangeDateModal={setShowChangeDateModal} setCancelJobId={setCancelJobId} />}
            {activeTab === 'profileSettings' && showProfileSettings && <ProfileSettingsView currentUser={currentUser} handleUpdatePersonnel={handleUpdatePersonnel} />}
            {activeTab === 'myAssignedJobs' && <MyAssignedJobsView currentUser={currentUser} jobs={visibleJobs} handleOpenEndJobModal={handleOpenEndJobModal} markNotificationsAsRead={markNotificationsAsRead} />}
            {activeTab === 'mySpecialTasks' && showMySpecialTasks && <MyTasksView currentUser={currentUser} tasks={tasks} handleUpdateTaskStatus={handleUpdateTaskStatus} />}
            
            {activeTab === 'isOnaylamaTahtasi' && showOperasyon && <IsOnaylamaTahtasiView jobs={visibleJobs} handleEditJob={handleEditJob} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints} handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal} personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} handleOpenEndJobModal={handleOpenEndJobModal} isManager={isManager} />}
            {activeTab === 'ekipKurmaTahtasi' && showOperasyon && <EkipKurmaTahtasiView jobs={visibleJobs} personnelList={personnelList} vehicles={vehicles} materials={materials} db={db} appId={appId} addSystemLog={addSystemLog} allPersonnelActions={allPersonnelActions} allMesaiRecords={allMesaiRecords} />}
            {activeTab === 'izinTahtasi' && showOperasyon && <IzinTahtasiView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'personelTahtasi' && showOperasyon && <PersonelTahtasiView personnelList={personnelList} setViewingPersonnelProfileId={setViewingPersonnelProfileId} setActiveTab={setActiveTab} jobs={jobs} allPersonnelActions={allPersonnelActions} vehicles={vehicles} allMesaiRecords={allMesaiRecords} />}
            {activeTab === 'puantajTahtasi' && showOperasyon && <PuantajTahtasiView personnelList={personnelList} db={db} appId={appId} />}
            {activeTab === 'maviMesaiTahtasi' && showOperasyon && <MaviMesaiTahtasiView personnelList={personnelList} db={db} appId={appId} />}
            
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
                    <p className="text-sm text-neutral-500 mb-5">
                      <b>{savedJobInfo.customerName}</b> • {(savedJobInfo.date || '').split('-').reverse().join('.')} {savedJobInfo.time}
                    </p>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      {/* Müşteriyi Bilgilendir (WA): kayıt bilgilerini WhatsApp üzerinden müşteriye gönderir */}
                      <button
                        type="button"
                        onClick={() => {
                          // Telefonu uluslararası formata çevir (05xx -> 905xx)
                          let phone = (savedJobInfo.customerPhone || '').replace(/\D/g, '');
                          if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                          else if (!phone.startsWith('90')) phone = '90' + phone;
                          const trDate = (savedJobInfo.date || '').split('-').reverse().join('.');
                          const rota = `${savedJobInfo.fromProvince || ''}/${savedJobInfo.fromDistrict || ''} ➡️ ${savedJobInfo.toProvince || ''}/${savedJobInfo.toDistrict || ''}`;
                          const msg = `Sayın *${savedJobInfo.customerName}*,\n\nSembol Nakliyat olarak *${trDate}* tarihi saat *${savedJobInfo.time}* için ${savedJobInfo.type || 'Nakliye'} kaydınız başarıyla oluşturulmuştur. ✅\n\n📍 *Güzergah:* ${rota}\n💰 *Anlaşılan Tutar:* ${parseInt(savedJobInfo.price || 0).toLocaleString('tr-TR')} TL\n💵 *Alınan Kapora:* ${parseInt(savedJobInfo.deposit || 0).toLocaleString('tr-TR')} TL\n\nTaşıma gününden önce ekibimiz sizinle iletişime geçecektir. Bizi tercih ettiğiniz için teşekkür ederiz.\n\n*Sembol Nakliyat*`;
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="px-3 py-3 bg-[#25D366] text-white text-xs font-bold rounded-xl hover:bg-[#128C7E] transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" /> Müşteriyi Bilgilendir (WA)
                      </button>
                      {/* Sözleşmeyi İndir: takvimdeki sözleşme mantığıyla aynı PDF'i oluşturur (dosya adı: Ad-Soyad-GG.AA.YYYY.pdf) */}
                      <button
                        type="button"
                        onClick={() => generateContractPDF(savedJobInfo)}
                        className="px-3 py-3 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-black transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-4 h-4 shrink-0" /> Sözleşmeyi İndir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'myComplaint' && showMyComplaint && <MyComplaintSubmitView currentUser={currentUser} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'addInfo' && showAddInfo && <AddInfoView currentUser={currentUser} personnelList={personnelList} addSystemLog={addSystemLog} />}
            
            {(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') && showAddJob &&
              <div className="space-y-4">
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
            {activeTab === 'customerProfile' && showCustomers && <CustomerProfileView jobs={jobs} cariKey={viewingCariKey} handleEditJob={handleEditJob} onBack={() => setActiveTab('allCustomers')} db={db} appId={appId} addSystemLog={addSystemLog} personnelList={personnelList} vehicles={vehicles} />}

            {activeTab === 'currentJobs' && showJobList && <CurrentJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} />}
            {activeTab === 'completedJobs' && showJobList && <CompletedJobsView jobs={jobs} handleEditJob={handleEditJob} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints} handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal} handleOpenResolveDamageModal={handleOpenResolveDamageModal} />}
            {activeTab === 'allJobs' && showJobList && <AllJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setDeleteJobId={setDeleteJobId} />}
            {activeTab === 'damagedJobs' && showJobList && <DamagedJobsView jobs={jobs} handleEditJob={handleEditJob} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} handleOpenResolveDamageModal={handleOpenResolveDamageModal} />}
            {activeTab === 'cancelledJobs' && showJobList && <CancelledJobsView jobs={jobs} handleEditJob={handleEditJob} handleRestoreJob={handleRestoreJob} setDeleteJobId={setDeleteJobId} />}

            {activeTab === 'customerBlacklist' && showCustomers && <PlaceholderView title="Müşteri Kara Listesi" icon={AlertTriangle} />}
            
            {activeTab === 'addPersonnel' && showPersonnel && <AddPersonnelView onAdd={handleAddPersonnel} positions={positions} ranks={ranks} />}
            {activeTab === 'personnelList' && showPersonnel && <PersonnelListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} title="Tüm Personel" onViewProfile={(id) => { setViewingPersonnelProfileId(id); setActiveTab('personnelProfile'); }} pendingEditPersonnelId={pendingEditPersonnelId} setPendingEditPersonnelId={setPendingEditPersonnelId} />}
            {activeTab === 'personnelProfile' && showPersonnel && <PersonnelProfileView personId={viewingPersonnelProfileId} personnelList={personnelList} jobs={jobs} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} onBack={() => setActiveTab('personnelList')} setActiveTab={setActiveTab} setPendingEditPersonnelId={setPendingEditPersonnelId} allPersonnelActions={allPersonnelActions} vehicles={vehicles} currentUser={currentUser} allMesaiRecords={allMesaiRecords} />}
            {activeTab === 'ozlukDosyalari' && showPersonnel && <OzlukDosyalariView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}
            {activeTab === 'complaints' && showPersonnel && <ComplaintsView complaints={complaints} updateComplaintStatus={handleUpdateComplaintStatus} deleteComplaint={handleDeleteComplaint} />}
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
                        {vehicles.map(vehicle => (
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
                                <span className="col-span-2"><b className="text-black">Vites:</b> {vehicle.transmission}</span>
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {activeTab === 'addTodo' && showTodos && <AddTodoView newTodo={newTodo} setNewTodo={setNewTodo} handleAddTodo={handleAddTodo} />}
            {activeTab === 'todoList' && showTodos && <TodoListView todos={todos} handleUpdateTodoStatus={handleUpdateTodoStatus} handleDeleteTodo={handleDeleteTodo} />}

            {activeTab === 'materialList' && showOperasyon && <MaterialListView materials={materials} onDelete={handleDeleteMaterial} onUpdateStock={handleUpdateMaterialStock} onAdd={handleAddMaterial} systemLogs={systemLogs} />}
            
            {activeTab === 'financeDashboard' && showFinance && <FinanceDashboardView jobs={jobs} transactions={transactions} transactionType={transactionType} setTransactionType={setTransactionType} newTransaction={newTransaction} setNewTransaction={setNewTransaction} handleAddTransaction={handleAddTransaction} personnelList={personnelList} handleEditJob={handleEditJob} db={db} appId={appId} />}
            {activeTab === 'reporting' && showFinance && <ReportingView jobs={jobs} personnelList={personnelList} />}
            {activeTab === 'advancedReporting' && showFinance && <AdvancedReportingView jobs={jobs} />}
            {activeTab === 'personelMuhasebe' && showFinance && <PersonelMuhasebeView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'personelOdeme' && showFinance && <PersonelOdemeView personnelList={personnelList} transactions={transactions} db={db} appId={appId} addSystemLog={addSystemLog} currentUser={currentUser} />}

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
            
            {activeTab === 'userList' && showAuth && <UserListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} onDelete={handleDeletePersonnel} positions={positions} ranks={ranks} positionModules={positionModules} />}            {activeTab === 'positions' && showAuth && <PositionsView positions={positions} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} />}
            {activeTab === 'ranks' && showAuth && <RanksView ranks={ranks} onAddRank={handleAddRank} onDeleteRank={handleDeleteRank} />}
            {activeTab === 'permissions' && showAuth && <PermissionsView personnelList={personnelList} handleUpdatePermissions={handleUpdatePermissions} />}
            {activeTab === 'moduleAccess' && showAuth && <ModuleAccessView positions={positions} ranks={ranks} positionModules={positionModules} handleUpdatePositionModuleAccess={handleUpdatePositionModuleAccess} />}
            
            {activeTab === 'backupSystem' && showSystemFiles && <SystemFilesView jobs={jobs} personnelList={personnelList} vehicles={vehicles} materials={materials} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'systemLogs' && showSystemFiles && <SystemLogsView logs={systemLogs} />}
            {activeTab === 'userActivities' && showSystemFiles && <UserActivitiesView personnelList={personnelList} />}
            {activeTab === 'companyPasswords' && showSystemFiles && <CompanyPasswordsView passwords={companyPasswords} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'appSettings' && showSystemFiles && <AppSettingsView db={db} appId={appId} addSystemLog={addSystemLog} appBranding={appBranding} />}
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
                            <option value="Nakit">Nakit</option>
                            <option value="Havale/EFT">Havale/EFT</option>
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
                          <MediaCaptureMenu onChange={(e) => handleFileUpload(e, 'elevator')} buttonLabel="Fotoğraf / Video Ekle" buttonClassName="cursor-pointer w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2" />
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
                        <select value={endJobData.paymentMethod} onChange={e => setEndJobData({...endJobData, paymentMethod: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                          <option value="Nakit">Nakit</option>
                          <option value="Havale/EFT">Havale/EFT</option>
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
                          <MediaCaptureMenu onChange={(e) => handleFileUpload(e, 'truck')} buttonLabel="Yeni Görsel Ekle" buttonClassName="cursor-pointer w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2" />
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
                            <MediaCaptureMenu onChange={(e) => handleFileUpload(e, 'damage')} buttonLabel="Yeni Hasar Fotoğrafı Ekle" buttonClassName="cursor-pointer w-full bg-white hover:bg-neutral-50 border border-red-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2 text-red-600" />
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

                  <button type="button" onClick={submitEndJob} className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <CheckCircle className="w-5 h-5" /> {jobToEnd.type === 'Asansör' ? 'Asansör İşini Sonlandır' : 'Kodu Doğrula ve İşi Bitir'}
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
                               <div key={pId} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-sm">
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
                                           value={data.hours}
                                           onChange={e => setMesaiModalData(prev => ({ ...prev, [pId]: { ...prev[pId], hours: e.target.value } }))}
                                           className="w-16 p-2 border border-neutral-300 rounded-lg outline-none text-sm font-bold text-center"
                                        />
                                     )}
                                  </div>
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
                <button onClick={() => setResolveDamageModal({ isOpen: false, jobId: null, note: '' })} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div  className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Çözüm Notu / Açıklama</label>
                    <textarea required value={resolveDamageModal.note} onChange={e => setResolveDamageModal({...resolveDamageModal, note: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none transition text-sm" placeholder="Sorun nasıl çözüldü? Müşteri ile nasıl anlaşıldı? (Örn: Tamir masrafı karşılandı.)"></textarea>
                  </div>
                  <button type="button" onClick={handleResolveDamageSubmit} className="w-full py-4 bg-green-500 text-white font-black rounded-xl hover:bg-green-600 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <CheckCircle className="w-5 h-5" /> Çözüldü Olarak Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showContactModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
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
