import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Truck, Calendar, XCircle, MapPin, Phone, FileText, CheckCircle, Clock, PlusCircle, ClipboardList, ClipboardCheck, Shield, Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Briefcase, Car, Wallet, CheckSquare, GripVertical, Activity, ArrowUpRight, Landmark, CreditCard, DollarSign, ArrowRightLeft, UserPlus, Camera, Edit, Ban, LogOut, Mail, Bell, User, Loader2, MessageSquareText, MessageCircle, Send, Package, History, Save, Search, Key, BarChart, Eye, EyeOff, FolderOpen, Shirt, Smartphone, Award, Zap, Scale, BookOpen, Wrench, Sparkles, Headphones, ArrowDown, Trash2, QrCode, LogIn, Keyboard, Download, RefreshCw } from 'lucide-react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, query, getDoc, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db, appId, MESAI_STATUS_OPTIONS, isPersonnelVisibleInMonth, isUzaktanCalisan, normalizePozisyon, belgeListesiNormalize, HasarCozumBelgeleri, isVideoUrl, MediaCaptureMenu, TUTANAK_TEMPLATES, generateContractPDF, generatePersonnelDocPDF, calculateMaterials, getIhbarSuresiBilgisi, SayfalamaBar,
  // YENİ: Deneme maaşı alanları — süre seçenekleri ve canlı özet metni.
  // Ayrı dosya yerine shared.jsx içinde tutuluyor; Finans.jsx da aynı
  // kaynaktan gecerliMaas'ı okur, böylece tek doğru kaynak vardır.
  DENEME_SURE_SECENEKLERI, denemeOzetMetni,
  // YENİ: Resmi Ayarları'ndaki GÜNCEL banka bilgisi (canlı önbellek).
  // Eskiden IBAN bu dosyada sabit yazılıydı ve panelden değiştirilemiyordu.
  aktifBankaBilgiMetni,
  // YENİ: IBAN Paylaş penceresi için varsayılan hesap nesnesi ve IBAN biçimleyici.
  aktifBankaHesabi, ibanBicimle,
  // YENİ: Ekipler arası destek — puantajın da destek zincirini bilmesi için
  personelSonEkipIsi, isTamEkipIdleri, isMesaiEkipIdleri } from './shared.jsx';

  export const AdminMaviYakaTakip = ({ jobs, personnelList, transactions }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [mesaiData, setMesaiData] = useState({});
    const [puantajData, setPuantajData] = useState({});
    
    useEffect(() => {
      const fetchDailyData = async () => {
        if(!db || !appId) return;
        const dateObj = new Date(selectedDate);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        
        try {
          const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${year}_${month}`);
          const mSnap = await getDoc(mRef);
          if(mSnap.exists()) setMesaiData(mSnap.data().records || {});
          else setMesaiData({});

          const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${year}_${month}`);
          const pSnap = await getDoc(pRef);
          if(pSnap.exists()) setPuantajData(pSnap.data().records || {});
          else setPuantajData({});
        } catch(e) {
          console.error("Günlük veri çekilemedi:", e);
        }
      };
      fetchDailyData();
    }, [selectedDate]);

    const selectedDay = parseInt(selectedDate.split('-')[2], 10);

    const dailyCompletedJobs = jobs.filter(j => j.date === selectedDate && j.status === 'completed');
    const yorumAlanlar = dailyCompletedJobs.filter(j => j.pointsApproved);
    const yorumAlamayanlar = dailyCompletedJobs.filter(j => !j.pointsApproved);

    const maviYakaList = personnelList.filter(p => p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));

    const mesaiHareketleri = [];
    maviYakaList.forEach(p => {
       const d = mesaiData[p.id]?.[selectedDay];
       const st = typeof d === 'object' && d !== null ? d.status : d;
       const hr = typeof d === 'object' && d !== null ? d.hours : '';
       if (st && st !== 'G') {
         mesaiHareketleri.push({ name: p.fullName, status: st, hours: hr });
       }
    });

    const finansHareketleri = transactions?.filter(t => t.date === selectedDate && t.type === 'expense') || [];

    return (
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-lg border border-slate-700 p-5 mb-6 relative overflow-hidden animate-in fade-in slide-in-from-top-4">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 pb-4 border-b border-slate-700 gap-4">
            <div>
               <h3 className="text-xl font-black text-white flex items-center gap-2">
                 <Activity className="w-6 h-6 text-blue-400" /> Mavi Yaka & Operasyon Günlük Takip
               </h3>
               <p className="text-slate-400 text-sm font-medium mt-1">Personel mesai, puan/yorum ve günlük muhasebe (avans vb.) hareketleri</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 p-2.5 rounded-xl border border-slate-600 shadow-sm shrink-0">
              <CalendarDays className="w-5 h-5 text-slate-400" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              />
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Yorum Alanlar */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 flex flex-col h-56">
               <h4 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-1.5 border-b border-slate-700/50 pb-2 shrink-0">
                 <Star className="w-4 h-4 fill-emerald-400"/> Yorum Alan Ekipler
               </h4>
               <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {yorumAlanlar.length > 0 ? yorumAlanlar.map(j => (
                     <div key={j.id} className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition">
                        <p className="text-xs text-white font-bold truncate" title={j.customerName}>{j.customerName}</p>
                        <p className="text-[10px] text-emerald-300 mt-1 truncate" title={j.team}><User className="w-3 h-3 inline mr-0.5" /> {j.team}</p>
                     </div>
                  )) : <p className="text-xs text-slate-500 italic mt-2">Bugün yorum alan ekip kaydı yok.</p>}
               </div>
            </div>

            {/* Yorum Alamayanlar */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-red-500/30 flex flex-col h-56">
               <h4 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-1.5 border-b border-slate-700/50 pb-2 shrink-0">
                 <AlertTriangle className="w-4 h-4"/> Yorum Alamayan Ekipler
               </h4>
               <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {yorumAlamayanlar.length > 0 ? yorumAlamayanlar.map(j => (
                     <div key={j.id} className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 hover:border-red-500/50 transition">
                        <p className="text-xs text-white font-bold truncate" title={j.customerName}>{j.customerName}</p>
                        <p className="text-[10px] text-red-300 mt-1 truncate" title={j.team}><User className="w-3 h-3 inline mr-0.5" /> {j.team}</p>
                     </div>
                  )) : <p className="text-xs text-slate-500 italic mt-2">Tüm ekipler yorum aldı veya iş yok.</p>}
               </div>
            </div>

            {/* Mesai / İzin */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-blue-500/30 flex flex-col h-56">
               <h4 className="text-blue-400 font-bold text-sm mb-3 flex items-center gap-1.5 border-b border-slate-700/50 pb-2 shrink-0">
                 <Clock className="w-4 h-4"/> Mesai & İzin Durumları
               </h4>
               <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {mesaiHareketleri.length > 0 ? mesaiHareketleri.map((m, i) => {
                     const opt = MESAI_STATUS_OPTIONS.find(o => o.code === m.status);
                     return (
                        <div key={i} className="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 hover:border-blue-500/50 transition">
                           <span className="text-[11px] text-white font-bold truncate pr-2" title={m.name}>{m.name}</span>
                           <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 whitespace-nowrap">
                             {opt ? opt.label : m.status} {m.hours ? `(${m.hours}s)` : ''}
                           </span>
                        </div>
                     )
                  }) : <p className="text-xs text-slate-500 italic mt-2">Özel mesai/izin kaydı bulunmuyor.</p>}
               </div>
            </div>

            {/* Muhasebe / Avans */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-orange-500/30 flex flex-col h-56">
               <h4 className="text-orange-400 font-bold text-sm mb-3 flex items-center gap-1.5 border-b border-slate-700/50 pb-2 shrink-0">
                 <Wallet className="w-4 h-4"/> Günlük Gider & Avans
               </h4>
               <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {finansHareketleri.length > 0 ? finansHareketleri.map(t => (
                     <div key={t.id} className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 hover:border-orange-500/50 transition flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1">
                           <p className="text-[11px] text-white font-bold truncate flex-1 pr-2" title={t.customerOrDesc || t.description}>{t.customerOrDesc || t.description}</p>
                           <span className="text-[11px] font-black text-orange-400 shrink-0">-₺{Number(t.amount).toLocaleString('tr-TR')}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate">{t.category}</p>
                     </div>
                  )) : <p className="text-xs text-slate-500 italic mt-2">Bugün kaydedilen bir gider/avans yok.</p>}
               </div>
            </div>
         </div>
      </div>
    )
  };

  // ==========================================================================
  // HATA DÜZELTMESİ (kullanıcı bildirimi): "1 Eylül 2026 ve sonrasına ben
  // yazmadığım izinler görünüyor"
  // --------------------------------------------------------------------------
  // KÖK NEDEN (AY SINIRI / GÜN NUMARASI ÇAKIŞMASI):
  // Puantaj verisi Firestore'da AY BAŞINA bir belgede ('mesai/2026_8',
  // 'mesai/2026_9') ve her belgede AYIN GÜNÜ (1..31) anahtarıyla tutulur.
  // Tahtalar bir hafta gösterir; hafta iki aya taşarsa (31 Ağustos – 6 Eylül)
  // iki ayın kayıtları TEK bir nesnede birleştiriliyordu:
  //     mergedRecords[pId] = { ...agustos[pId], ...eylul[pId] }
  // Anahtar sadece GÜN NUMARASI olduğu için Ağustos'un 1..6'sı ile Eylül'ün
  // 1..6'sı AYNI anahtarlara denk geliyordu. Eylül belgesinde o gün için
  // kayıt yoksa (kullanıcı Eylül'e hiçbir şey girmediyse) Ağustos'un aynı
  // numaralı gününün kaydı silinmeden kalıyor ve tahta onu EYLÜL hücresinde
  // gösteriyordu. Yani ekranda görülen izinler HAYALET değil; AĞUSTOS 1–6'ya
  // girilmiş GERÇEK kayıtların EYLÜL 1–6 hücrelerinde yanlış gösterimiydi.
  // (Doğrulandı: 31.08 -> D, 01–05.09 -> Hİ/D deseni birebir üretildi.)
  //
  // ÖNEMLİ: Firestore'a YAZAN kodlar zaten DOĞRUYDU — her biri günün kendi
  // ayının belgesine (targetDayObj.monthNum/yearNum) yazıyor. Bu yüzden
  // veritabanında bozulma YOK, sadece OKUMA/GÖSTERİM hatalıydı. Aşağıdaki
  // düzeltme yalnızca bellekteki gösterim anahtarını değiştirir; Firestore
  // şeması ve yazma mantığı AYNEN korunur (Personel Muhasebe ile uyum bozulmaz).
  //
  // ÇÖZÜM: Bellekteki mesaiData artık "yıl_ay_gün" bileşik anahtarıyla
  // adreslenir (ör. '2026_9_1'), böylece Ağustos 1 ile Eylül 1 asla karışmaz.
  // ==========================================================================
  // Bir gün nesnesi ({dayNum, monthNum, yearNum}) için bileşik anahtar üretir
  const mesaiGunAnahtari = (gunObj) => `${gunObj.yearNum}_${gunObj.monthNum}_${gunObj.dayNum}`;
  // Ay belgelerini bileşik anahtarlı tek nesnede TOPLAR (üzerine yazmaz).
  // kayitlar: { [personelId]: { [ayinGunu]: hucre } } — belgenin yıl/ayı verilir.
  const mesaiAyiBirlestir = (hedef, kayitlar, yil, ay) => {
    for (const pId in (kayitlar || {})) {
      if (!hedef[pId]) hedef[pId] = {};
      for (const gun in kayitlar[pId]) {
        hedef[pId][`${yil}_${ay}_${parseInt(gun, 10)}`] = kayitlar[pId][gun];
      }
    }
    return hedef;
  };
  // ==========================================================================
  // EK DÜZELTME: dateStr artık UTC'ye çevrilmiyor.
  // toISOString() yerel gece yarısını UTC'ye çevirir; Türkiye (UTC+3) için
  // tarih BİR GÜN GERİYE kayıyordu (31 Ağustos -> "2026-08-30"). Bu yüzden
  // "bugün" vurgusu hiç isabet etmiyor ve sistem günlüğüne yanlış tarih
  // yazılıyordu. Artık tarih, günün kendi yerel yıl/ay/gün alanlarından kurulur.
  // ==========================================================================
  const mesaiYerelTarihStr = (gunObj) =>
    `${gunObj.yearNum}-${String(gunObj.monthNum).padStart(2, '0')}-${String(gunObj.dayNum).padStart(2, '0')}`;

  // --- İZİN TAHTASI BİLEŞENİ ---
  export const IzinTahtasiView = ({ personnelList, db, appId, addSystemLog }) => {
    const today = new Date();
    // Monday of the current week
    const currentDay = today.getDay() || 7; 
    const diffToMonday = today.getDate() - currentDay + 1;
    const initialMonday = new Date(today.setDate(diffToMonday));
    initialMonday.setHours(0, 0, 0, 0);

    const [weekStart, setWeekStart] = useState(initialMonday);
    const [mesaiData, setMesaiData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    
    // YENİ EKLENEN STATE'LER (Özel Durum Ekleme İçin)
    const [showSpecialLeaveModal, setShowSpecialLeaveModal] = useState(false);
    const [specialLeaveForm, setSpecialLeaveForm] = useState({ personnelId: '', type: 'R', startDate: '', endDate: '' });

    // Mavi yaka ve aktif olanları filtrele, pozisyona göre sırala
    const maviYakaList = personnelList.filter(p => {
      if (isUzaktanCalisan(p)) return false; // UZAKTAN çalışanlar izin tahtasında yer almaz
      if (p.position === 'Firma Sahibi') return false;
      return p.employmentStatus === 'Aktif' && 
             (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operatör'].includes(p.position)));
    }).sort((a, b) => {
        const orderA = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[a.position] || 99;
        const orderB = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[b.position] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.fullName.localeCompare(b.fullName);
    });

    const year = weekStart.getFullYear();
    const month = weekStart.getMonth() + 1;
    
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const gun = {
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        yearNum: d.getFullYear(),
        dayName: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()]
      };
      // DÜZELTİLDİ: toISOString() (UTC) yerine yerel tarihten kurulur
      return { ...gun, dateStr: mesaiYerelTarihStr(gun) };
    });

    useEffect(() => {
      const fetchMesai = async () => {
        if (!db || !appId) return;
        
        try {
          const y1 = weekStart.getFullYear();
          const m1 = weekStart.getMonth() + 1;
          
          const endOfWeek = new Date(weekStart);
          endOfWeek.setDate(weekStart.getDate() + 6);
          const y2 = endOfWeek.getFullYear();
          const m2 = endOfWeek.getMonth() + 1;

          const mRef1 = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y1}_${m1}`);
          const mSnap1 = await getDoc(mRef1);
          // DÜZELTİLDİ: Kayıtlar artık 'yıl_ay_gün' bileşik anahtarıyla toplanır.
          // Böylece hafta iki aya taştığında (31 Ağustos – 6 Eylül) Ağustos'un
          // 1–6'sı Eylül'ün 1–6'sının yerine geçemez.
          let mergedRecords = {};
          if (mSnap1.exists()) mesaiAyiBirlestir(mergedRecords, mSnap1.data().records || {}, y1, m1);

          // Hafta diğer aya taşıyorsa (Örn: 28 Mayıs - 3 Haziran) iki ayı da birleştir
          if (m1 !== m2) {
             const mRef2 = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y2}_${m2}`);
             const mSnap2 = await getDoc(mRef2);
             if (mSnap2.exists()) {
                 mesaiAyiBirlestir(mergedRecords, mSnap2.data().records || {}, y2, m2);
             }
          }
          setMesaiData(mergedRecords);
        } catch(e) { console.error("Mesai veri çekilemedi:", e); }
      };
      fetchMesai();
    }, [weekStart, db, appId]);

    const handlePrevWeek = () => {
      const newStart = new Date(weekStart);
      newStart.setDate(weekStart.getDate() - 7);
      setWeekStart(newStart);
    };

    const handleNextWeek = () => {
      const newStart = new Date(weekStart);
      newStart.setDate(weekStart.getDate() + 7);
      setWeekStart(newStart);
    };

    const handleCurrentWeek = () => {
      const d = new Date();
      const curr = d.getDay() || 7; 
      const diff = d.getDate() - curr + 1;
      const monday = new Date(d.setDate(diff));
      monday.setHours(0,0,0,0);
      setWeekStart(monday);
    };

    const handleAddSpecialLeave = async (e) => {
       e.preventDefault();
       if (!specialLeaveForm.personnelId || !specialLeaveForm.startDate || !specialLeaveForm.endDate) return;

       setIsSaving(true);
       const p = personnelList.find(x => String(x.id) === specialLeaveForm.personnelId);

       let start = new Date(specialLeaveForm.startDate);
       let end = new Date(specialLeaveForm.endDate);

       // Kaydedilecek tarihleri ay ve yıla göre grupla
       const updatesByMonth = {};

       for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const day = d.getDate();
          const docKey = `${year}_${month}`;

          if (!updatesByMonth[docKey]) updatesByMonth[docKey] = [];
          updatesByMonth[docKey].push(day);
       }

       // Local state update (sadece gösterilen ay/hafta için)
       const newMesaiData = { ...mesaiData };

       for (const [docKey, days] of Object.entries(updatesByMonth)) {
          const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', docKey);
          const mSnap = await getDoc(mRef);
          let records = mSnap.exists() ? mSnap.data().records || {} : {};

          if (!records[specialLeaveForm.personnelId]) {
             records[specialLeaveForm.personnelId] = {};
          }

          // docKey 'yil_ay' biçimindedir; yerel gösterim anahtarı için ayrıştırılır
          const [dkYil, dkAy] = docKey.split('_').map(Number);
          days.forEach(day => {
             // Firestore şeması AYNEN korunur: ilgili ayın belgesine AYIN GÜNÜ ile yazılır
             records[specialLeaveForm.personnelId][day] = { status: specialLeaveForm.type, hours: '' };

             // Eğer şu an görüntülenen mesaiData içinde de varsa anında yansıt
             // DÜZELTİLDİ: bileşik anahtar ('yıl_ay_gün') kullanılır
             if (!newMesaiData[specialLeaveForm.personnelId]) newMesaiData[specialLeaveForm.personnelId] = {};
             newMesaiData[specialLeaveForm.personnelId][`${dkYil}_${dkAy}_${day}`] = { status: specialLeaveForm.type, hours: '' };
          });

          await setDoc(mRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
       }

       setMesaiData(newMesaiData);
       if(p) {
          const typeLabel = specialLeaveForm.type === 'R' ? 'Raporlu' : specialLeaveForm.type === 'Yİ' ? 'Yıllık İzin' : specialLeaveForm.type === 'Üİ' ? 'Ücretsiz İzin' : 'Bayram İzni';
          addSystemLog('İzin Tahtası Özel Durum', `${p.fullName} için ${specialLeaveForm.startDate} ile ${specialLeaveForm.endDate} tarihleri arasına özel durum (${typeLabel}) girildi. (Muhasebe sistemine işlendi)`);
       }

       setShowSpecialLeaveModal(false);
       setSpecialLeaveForm({ personnelId: '', type: 'R', startDate: '', endDate: '' });
       setIsSaving(false);
    };

    const handleDragStart = (e, personId) => {
      e.dataTransfer.setData('personId', personId);
      e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e, targetDayObj) => {
      e.preventDefault();
      const personId = e.dataTransfer.getData('personId');
      if (!personId) return;

      const p = personnelList.find(x => String(x.id) === String(personId));
      if(!p) return;

      setIsSaving(true);

      const targetDayNum = targetDayObj.dayNum;
      
      // Aynı haftada bu personelin başka bir izni/devamsızlığı var mı kontrol et
      // DÜZELTİLDİ: bileşik anahtar. Önceden gün numarasıyla bakıldığı için,
      // iki aya taşan haftada ÖNCEKİ AYIN aynı numaralı günleri de sayılıyor,
      // "ilk izin Hİ / sonraki D" kararı yanlış çıkıyordu.
      let leaveCountThisWeek = 0;
      weekDays.forEach(wd => {
         const cell = mesaiData[personId]?.[mesaiGunAnahtari(wd)];
         const status = typeof cell === 'object' && cell !== null ? cell.status : cell;
         if (status === 'Hİ' || status === 'D') {
            leaveCountThisWeek++;
         }
      });

      // Zaten bu güne atılmışsa işlem yapma
      const existingCell = mesaiData[personId]?.[mesaiGunAnahtari(targetDayObj)];
      const existingStatus = typeof existingCell === 'object' && existingCell !== null ? existingCell.status : existingCell;
      
      if (existingStatus === 'Hİ' || existingStatus === 'D') {
         setIsSaving(false);
         return; 
      }

      // İlk atama Haftalık İzin, sonrakiler Devamsızlık
      const newStatus = leaveCountThisWeek === 0 ? 'Hİ' : 'D';

      // Local state'i güncelle (bileşik anahtar ile)
      const newMesaiData = { ...mesaiData };
      if (!newMesaiData[personId]) newMesaiData[personId] = {};
      newMesaiData[personId][mesaiGunAnahtari(targetDayObj)] = { status: newStatus, hours: '' };
      setMesaiData(newMesaiData);

      // Firestore'a kaydet (İlgili ayın dokümanına)
      try {
        const docMonth = targetDayObj.monthNum;
        const docYear = targetDayObj.yearNum;
        const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docYear}_${docMonth}`);
        const mSnap = await getDoc(mRef);
        
        let recordsToSave = {};
        if (mSnap.exists()) {
           recordsToSave = mSnap.data().records || {};
        }
        
        if (!recordsToSave[personId]) recordsToSave[personId] = {};
        recordsToSave[personId][targetDayNum] = { status: newStatus, hours: '' };

        await setDoc(mRef, { records: recordsToSave, updatedAt: new Date().toISOString() }, { merge: true });
        
        addSystemLog('İzin Tahtası İşlemi', `${p.fullName} personeline ${targetDayObj.dateStr} tarihinde ${newStatus === 'Hİ' ? 'Haftalık İzin' : 'Devamsızlık'} girildi. (Muhasebe sistemine işlendi)`);

      } catch (err) {
        console.error("İzin kaydedilemedi:", err);
      }
      setIsSaving(false);
    };

    const handleRemoveLeave = async (personId, targetDayObj) => {
       setIsSaving(true);
       const targetDayNum = targetDayObj.dayNum;
       const p = personnelList.find(x => String(x.id) === String(personId));

       // Local state (DÜZELTİLDİ: bileşik anahtar — önceden gün numarasıyla
       // silindiği için, iki aya taşan haftada YANLIŞ AYIN hücresi ekrandan
       // kaldırılmış gibi görünüyordu)
       const newMesaiData = { ...mesaiData };
       const yerelAnahtar = mesaiGunAnahtari(targetDayObj);
       if (newMesaiData[personId] && newMesaiData[personId][yerelAnahtar]) {
          newMesaiData[personId][yerelAnahtar] = { status: '', hours: '' };
       }
       setMesaiData(newMesaiData);

       // Firestore
       try {
        const docMonth = targetDayObj.monthNum;
        const docYear = targetDayObj.yearNum;
        const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docYear}_${docMonth}`);
        const mSnap = await getDoc(mRef);
        
        if (mSnap.exists()) {
           let recordsToSave = mSnap.data().records || {};
           if (recordsToSave[personId] && recordsToSave[personId][targetDayNum]) {
              recordsToSave[personId][targetDayNum] = { status: '', hours: '' };
              await setDoc(mRef, { records: recordsToSave, updatedAt: new Date().toISOString() }, { merge: true });
              if(p) addSystemLog('İzin Tahtası İşlemi', `${p.fullName} personelinin ${targetDayObj.dateStr} tarihindeki izni/devamsızlığı iptal edildi.`);
           }
        }
      } catch (err) {
        console.error("İzin silinemedi:", err);
      }
      setIsSaving(false);
    };

    // İşe veya uzun süreli izne yazılıp yazılmadığına bakılmaksızın tüm aktif mavi yaka personeli sağ listede gösterilir.
    // İzin Tahtası doğrudan mavi yaka mesai sistemini (puantajı) etkilemektedir.
    const displayPersonnel = maviYakaList;

    return (
      <div className="flex flex-col lg:h-[calc(100vh-140px)] animate-in fade-in pb-4">
        {/* Üst Alan */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-blue-500" /> Haftalık İzin Tahtası
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">Personelleri sürükleyip ilgili günlere bırakarak haftalık izinlerini planlayın.</p>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowSpecialLeaveModal(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition text-sm shadow-md flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Özel Durum Ekle
             </button>
             <button onClick={handleCurrentWeek} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition text-sm">
                Bu Hafta
             </button>
             <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
               <button onClick={handlePrevWeek} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft className="w-4 h-4" /></button>
               <span className="font-bold text-sm px-2 text-black whitespace-nowrap">
                  {weekDays[0].dayNum} {["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][weekDays[0].monthNum-1]} - {weekDays[6].dayNum} {["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][weekDays[6].monthNum-1]}
               </span>
               <button onClick={handleNextWeek} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight className="w-4 h-4" /></button>
             </div>
             {isSaving && <Loader2 className="w-5 h-5 text-blue-500 animate-spin ml-2" />}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 lg:overflow-hidden">
           
           {/* SOL: GÜNLER (7 KOLON) */}
           <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-[420px] lg:h-full shrink-0">
              {weekDays.map((wd, i) => {
                 // DÜZELTİLDİ: UTC yerine yerel tarih karşılaştırması
                 const isToday = wd.dateStr === mesaiYerelTarihStr({ yearNum: new Date().getFullYear(), monthNum: new Date().getMonth() + 1, dayNum: new Date().getDate() });
                 const isWeekendDay = i === 6; // Sunday
                 
                 // Bu güne atanan personelleri bul (Tüm Mavi Yaka listesi üzerinden filtrele, displayPersonnel'den değil)
                 // DÜZELTİLDİ: bileşik anahtar ('yıl_ay_gün') — Eylül hücresinde
                 // Ağustos'un aynı numaralı gününün izni GÖRÜNMEZ artık.
                 const assignedPersons = maviYakaList.filter(p => {
                    const cell = mesaiData[p.id]?.[mesaiGunAnahtari(wd)];
                    const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                    return ['Hİ', 'D', 'R', 'Üİ', 'Yİ', 'Bİ'].includes(st);
                 });

                 return (
                    <div 
                       key={i} 
                       className={`flex-1 min-w-[140px] max-w-[200px] flex flex-col bg-white rounded-xl shadow-sm border ${isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} overflow-hidden shrink-0`}
                       onDragOver={handleDragOver}
                       onDrop={(e) => handleDrop(e, wd)}
                    >
                       <div className={`p-2 border-b ${isToday ? 'bg-blue-50 border-blue-200' : isWeekendDay ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'} text-center shrink-0`}>
                          <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-700' : isWeekendDay ? 'text-red-700' : 'text-neutral-500'}`}>{wd.dayName}</p>
                          <p className={`text-xl font-black ${isToday ? 'text-blue-600' : isWeekendDay ? 'text-red-600' : 'text-black'}`}>{wd.dayNum}</p>
                       </div>
                       
                       <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 bg-neutral-50/50">
                          {assignedPersons.map(p => {
                             const cell = mesaiData[p.id]?.[mesaiGunAnahtari(wd)];
                             const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                             
                             let cardBg = 'bg-neutral-50', borderColor = 'border-neutral-300', textColor = 'text-neutral-900', badgeBg = 'bg-neutral-600', badgeText = st;
                             
                             if (st === 'D') { cardBg = 'bg-red-50'; borderColor = 'border-red-300'; textColor = 'text-red-900'; badgeBg = 'bg-red-600'; badgeText = 'DEVAMSIZLIK (D)'; }
                             else if (st === 'Hİ') { cardBg = 'bg-blue-50'; borderColor = 'border-blue-300'; textColor = 'text-blue-900'; badgeBg = 'bg-blue-600'; badgeText = 'HAFTALIK İZİN (Hİ)'; }
                             else if (st === 'R') { cardBg = 'bg-orange-50'; borderColor = 'border-orange-300'; textColor = 'text-orange-900'; badgeBg = 'bg-orange-500'; badgeText = 'RAPORLU (R)'; }
                             else if (st === 'Yİ') { cardBg = 'bg-purple-50'; borderColor = 'border-purple-300'; textColor = 'text-purple-900'; badgeBg = 'bg-purple-600'; badgeText = 'YILLIK İZİN (Yİ)'; }
                             else if (st === 'Üİ') { cardBg = 'bg-neutral-100'; borderColor = 'border-neutral-400'; textColor = 'text-neutral-800'; badgeBg = 'bg-neutral-700'; badgeText = 'ÜCRETSİZ İZİN (Üİ)'; }
                             else if (st === 'Bİ') { cardBg = 'bg-pink-50'; borderColor = 'border-pink-300'; textColor = 'text-pink-900'; badgeBg = 'bg-pink-600'; badgeText = 'BAYRAM İZNİ (Bİ)'; }
                             
                             return (
                                <div key={p.id} className={`p-2 rounded-lg border flex flex-col gap-1 shadow-sm relative group ${cardBg} ${borderColor}`}>
                                   <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white/50 bg-white/50`}>
                                         {p.profileImage ? <img src={p.profileImage} className="w-full h-full object-cover" alt="" /> : <User className={`w-3 h-3 ${textColor}`} />}
                                      </div>
                                      <span className={`text-[11px] font-bold truncate ${textColor}`}>{p.fullName}</span>
                                   </div>
                                   <span className={`text-[9px] font-black text-center px-1.5 py-0.5 rounded text-white ${badgeBg}`}>
                                      {badgeText}
                                   </span>
                                   {/* YENİ: WhatsApp ile izin bildirme butonu (sadece gerçek izin türlerinde ve telefon varsa) */}
                                   {['Hİ', 'Yİ', 'Bİ', 'Üİ'].includes(st) && (p.personalPhone || p.companyPhone) && (
                                     <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Telefonu WhatsApp formatına çevir (başındaki 0 -> 90)
                                          let phone = (p.personalPhone || p.companyPhone || '').replace(/\D/g, '');
                                          if (!phone) { alert('Bu personelin telefon numarası kayıtlı değil.'); return; }
                                          if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                          else if (!phone.startsWith('90')) phone = '90' + phone;
                                          // İzin gününü ve türünü mesaja yerleştir
                                          const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
                                          const gun = `${wd.dayNum} ${aylar[wd.monthNum - 1]} ${wd.dayName}`;
                                          const izinAdi = st === 'Üİ' ? 'ücretsiz izinli' : st === 'Yİ' ? 'yıllık izinli' : st === 'Bİ' ? 'bayram izinli' : 'izinli';
                                          const msg = `Merhaba *${p.fullName}* 👋\n\n*Sembol Nakliyat* ailesi olarak bilgilendirmek isteriz: *${gun}* günü *${izinAdi}siniz*. 🌿\nBu tarihte işe gelmenize gerek yoktur, keyifli ve dinlendirici bir gün geçirmenizi dileriz.\n\nHerhangi bir sorunuz olursa bu numaradan bize ulaşabilirsiniz. İyi günler! 🤝`;
                                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                        }}
                                        title="WhatsApp'tan izin mesajı gönder"
                                        className="flex items-center justify-center gap-1 text-[9px] font-black text-white bg-[#25D366] hover:bg-[#128C7E] px-1.5 py-1 rounded transition"
                                     >
                                        <MessageCircle className="w-3 h-3" /> İzni Bildir
                                     </button>
                                   )}
                                   <button 
                                      onClick={() => handleRemoveLeave(p.id, wd)}
                                      className="absolute top-1 right-1 p-0.5 bg-white rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm border border-neutral-200 hover:bg-red-50"
                                   >
                                      <X className="w-3 h-3" />
                                   </button>
                                </div>
                             )
                          })}
                          {assignedPersons.length === 0 && (
                             <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-200 rounded-lg text-[10px] text-neutral-400 font-bold text-center px-2 py-4">
                                Personeli buraya sürükleyin
                             </div>
                          )}
                       </div>
                    </div>
                 )
              })}
           </div>

           {/* SAĞ: PERSONEL LİSTESİ */}
           <div className="w-full lg:w-[160px] xl:w-[180px] h-[420px] lg:h-full flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden shrink-0">
              <div className="p-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-xs text-black flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-500" /> Personel
                </h3>
                <span className="bg-black text-white px-2 py-0.5 rounded-lg text-[10px] font-bold">{displayPersonnel.length}</span>
              </div>
              <div className="p-2 bg-blue-50/50 border-b border-neutral-200 shrink-0">
                 <p className="text-[9px] text-blue-800 font-medium leading-tight text-center">
                    Sürükle: <b>İzin(Hİ)</b> / <b>Devamsız(D)</b>
                 </p>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 bg-neutral-50/30">
                 {displayPersonnel.map(person => {
                    // Bu personelin bu haftaki izin durumunu kontrol edelim ki görsel olarak farklılaşsın (Opsiyonel)
                    let weekLeaveCount = 0;
                    weekDays.forEach(wd => {
                       // DÜZELTİLDİ: bileşik anahtar (sağ listedeki izin sayısı rozeti)
                       const cell = mesaiData[person.id]?.[mesaiGunAnahtari(wd)];
                       const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                       if (['Hİ', 'D', 'R', 'Üİ', 'Yİ', 'Bİ'].includes(st)) weekLeaveCount++;
                    });

                    return (
                       <div 
                         key={person.id}
                         draggable
                         onDragStart={(e) => handleDragStart(e, person.id)}
                         className={`bg-white border rounded-xl p-1.5 flex items-center gap-1.5 shadow-sm cursor-grab active:cursor-grabbing transition hover:shadow-md group ${weekLeaveCount > 0 ? 'border-blue-300' : 'border-neutral-200 hover:border-blue-400'}`}
                       >
                         <div className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                           {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" alt="" /> : <User className="w-2.5 h-2.5 text-neutral-400" />}
                         </div>
                         <div className="flex-1 overflow-hidden flex flex-col justify-center">
                           <h4 className="font-bold text-[10px] text-black truncate">{person.fullName}</h4>
                           <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">{person.position}</p>
                         </div>
                         {weekLeaveCount > 0 && (
                            <span className={`text-[9px] font-black px-1 py-0.5 rounded border shrink-0 ${weekLeaveCount > 1 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                               {weekLeaveCount}
                            </span>
                         )}
                         <GripVertical className="w-3 h-3 text-neutral-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                       </div>
                    );
                 })}
                 {displayPersonnel.length === 0 && (
                    <p className="text-center text-[10px] text-neutral-500 italic py-4">Müsait mavi yaka bulunmuyor.</p>
                 )}
              </div>
           </div>

        </div>

        {/* ÖZEL DURUM EKLEME MODALI */}
        {showSpecialLeaveModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-orange-500">
                <h3 className="font-bold text-lg flex items-center gap-2"><CalendarDays className="w-5 h-5 text-orange-500" /> Özel Durum Ekle</h3>
                <button onClick={() => setShowSpecialLeaveModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div  className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Personel Seçin *</label>
                  <select required value={specialLeaveForm.personnelId} onChange={e => setSpecialLeaveForm({...specialLeaveForm, personnelId: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-medium bg-white">
                    <option value="">Seçiniz</option>
                    {maviYakaList.map(p => <option key={p.id} value={p.id}>{p.fullName} - {p.position}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Durum Tipi *</label>
                  <select required value={specialLeaveForm.type} onChange={e => setSpecialLeaveForm({...specialLeaveForm, type: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-medium bg-white">
                    <option value="R">Raporlu (R)</option>
                    <option value="Yİ">Yıllık İzin (Yİ)</option>
                    <option value="Üİ">Ücretsiz İzin (Üİ)</option>
                    <option value="Bİ">Bayram İzni / Ücretli İzin (Bİ)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Başlangıç Tarihi *</label>
                    <input required type="date" value={specialLeaveForm.startDate} onChange={e => setSpecialLeaveForm({...specialLeaveForm, startDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Bitiş Tarihi *</label>
                    <input required type="date" min={specialLeaveForm.startDate} value={specialLeaveForm.endDate} onChange={e => setSpecialLeaveForm({...specialLeaveForm, endDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <button type="button" onClick={handleAddSpecialLeave} disabled={isSaving} className="w-full py-4 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-500/30 flex justify-center items-center gap-2 mt-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  {isSaving ? 'Kaydediliyor...' : 'Durumu Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  // --- YENİ: PUANTAJ TAHTASI BİLEŞENİ ---
  export const PuantajTahtasiView = ({ personnelList, db, appId }) => {
    const today = new Date();
    // Monday of the current week
    const currentDay = today.getDay() || 7; 
    const diffToMonday = today.getDate() - currentDay + 1;
    const initialMonday = new Date(today.setDate(diffToMonday));
    initialMonday.setHours(0, 0, 0, 0);

    const [weekStart, setWeekStart] = useState(initialMonday);
    const [puantajData, setPuantajData] = useState({});

    // ========================================================================
    // YENİ: DÖNEM FİLTRESİ (Bu Hafta / Bu Ay / Bu Sene / Tüm Zamanlar)
    // ========================================================================
    // "Bu Hafta" eski takvim tablosunu gösterir (gün gün yıldızlar).
    // Diğer üçünde takvim anlamsızlaşır (30-365 sütun olurdu); bunun yerine
    // SIRALI PUAN LİSTESİ gösterilir: en çok puan alan en üstte.
    // ========================================================================
    const PUANTAJ_DONEMLERI = [
      { id: 'hafta', ad: 'Bu Hafta' },
      { id: 'ay', ad: 'Bu Ay' },
      { id: 'sene', ad: 'Bu Sene' },
      { id: 'tum', ad: 'Tüm Zamanlar' },
    ];
    const [donem, setDonem] = useState('hafta');
    // Dönem toplamları: { personelId: toplamPuan }
    const [donemToplamlari, setDonemToplamlari] = useState({});
    const [donemYukleniyor, setDonemYukleniyor] = useState(false);

    // Mavi yaka olanları filtrele (Sıralama: Şoför, Mobilya Ustası, Taşıma Elemanı)
    const currentListMonth = weekStart.getMonth() + 1;
    const currentListYear = weekStart.getFullYear();
    const maviYakaList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (!isPersonnelVisibleInMonth(p, currentListYear, currentListMonth)) return false;
      return p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position));
    }).sort((a, b) => {
        // YENİ: Liste artık pozisyona göre değil, doğrudan Ad Soyad'a göre
        // ALFABETİK (tr-TR) sıralanır. İşten ayrılanlar (Pasif) yine en sonda kalır.
        if (a.employmentStatus === 'Pasif' && b.employmentStatus !== 'Pasif') return 1;
        if (a.employmentStatus !== 'Pasif' && b.employmentStatus === 'Pasif') return -1;
        return (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR');
    });

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        yearNum: d.getFullYear(),
        // DÜZELTİLDİ: toISOString() (UTC) tarihi bir gün geriye kaydırıyordu
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayName: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()]
      };
    });

    useEffect(() => {
      const fetchPuantaj = async () => {
        if (!db || !appId) return;
        try {
          const y1 = weekStart.getFullYear();
          const m1 = weekStart.getMonth() + 1;
          
          const endOfWeek = new Date(weekStart);
          endOfWeek.setDate(weekStart.getDate() + 6);
          const y2 = endOfWeek.getFullYear();
          const m2 = endOfWeek.getMonth() + 1;

          const pRef1 = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${y1}_${m1}`);
          const pSnap1 = await getDoc(pRef1);
          // DÜZELTİLDİ (İzin Tahtası ile AYNI hata, burada PUAN verisinde):
          // kayıtlar 'yıl_ay_gün' bileşik anahtarıyla toplanır; iki aya taşan
          // haftada önceki ayın aynı numaralı günlerinin puanı bu ayın
          // hücrelerinde görünmez.
          let mergedRecords = {};
          if (pSnap1.exists()) mesaiAyiBirlestir(mergedRecords, pSnap1.data().records || {}, y1, m1);

          // Hafta diğer aya taşıyorsa (Örn: 28 Mayıs - 3 Haziran) iki ayı da birleştir
          if (m1 !== m2) {
             const pRef2 = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${y2}_${m2}`);
             const pSnap2 = await getDoc(pRef2);
             if (pSnap2.exists()) {
                 mesaiAyiBirlestir(mergedRecords, pSnap2.data().records || {}, y2, m2);
             }
          }
          setPuantajData(mergedRecords);
        } catch(e) { console.error("Puantaj veri çekilemedi:", e); }
      };
      fetchPuantaj();
    }, [weekStart, db, appId]);

    // ========================================================================
    // YENİ: DÖNEM TOPLAMLARINI ÇEK
    // ========================================================================
    // Puantaj kayıtları aylık dokümanlarda tutulur ('puantaj/{yil}_{ay}').
    // Bu yüzden:
    //   • Bu Ay        -> tek doküman
    //   • Bu Sene      -> o yılın 12 dokümanı
    //   • Tüm Zamanlar -> 2024 başından bu yana tüm aylar (sistem öncesi yok)
    // Okunan tüm günlerin puanları personel bazında toplanır.
    // 'hafta' seçiliyken bu effect hiç çalışmaz — orada zaten takvim tablosu var.
    // ========================================================================
    useEffect(() => {
      if (donem === 'hafta') return;
      let iptal = false;
      const fetchDonem = async () => {
        if (!db || !appId) return;
        setDonemYukleniyor(true);
        try {
          const simdi = new Date();
          const yil = simdi.getFullYear();
          const ay = simdi.getMonth() + 1;
          // Okunacak ay anahtarlarını belirle
          let anahtarlar = [];
          if (donem === 'ay') {
            anahtarlar = [`${yil}_${ay}`];
          } else if (donem === 'sene') {
            for (let m = 1; m <= 12; m++) anahtarlar.push(`${yil}_${m}`);
          } else { // tum
            const BASLANGIC_YIL = 2024; // Sistem bu yıldan önce kullanılmıyordu
            for (let y = BASLANGIC_YIL; y <= yil; y++) {
              for (let m = 1; m <= 12; m++) anahtarlar.push(`${y}_${m}`);
            }
          }
          const toplamlar = {};
          // Aylar paralel okunur; olmayan dokümanlar sessizce atlanır
          const snaplar = await Promise.all(anahtarlar.map(a =>
            getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', a)).catch(() => null)
          ));
          snaplar.forEach(snap => {
            if (!snap || !snap.exists()) return;
            const records = snap.data().records || {};
            Object.entries(records).forEach(([pId, gunler]) => {
              Object.values(gunler || {}).forEach(deger => {
                const p = parseFloat(deger) || 0;
                if (p > 0) toplamlar[pId] = (toplamlar[pId] || 0) + p;
              });
            });
          });
          if (!iptal) setDonemToplamlari(toplamlar);
        } catch (e) {
          console.error('Dönem puantajı çekilemedi:', e);
        }
        if (!iptal) setDonemYukleniyor(false);
      };
      fetchDonem();
      return () => { iptal = true; };
    }, [donem, db, appId]);

    // Liste görünümü için sıralanmış veri: en yüksek puan en üstte
    const donemSiralamasi = React.useMemo(() => {
      return maviYakaList
        .map(p => ({ person: p, puan: donemToplamlari[p.id] || 0 }))
        .sort((a, b) => b.puan - a.puan || (a.person.fullName || '').localeCompare((b.person.fullName || ''), 'tr-TR'));
    }, [maviYakaList, donemToplamlari]);

    const handlePrevWeek = () => {
      const newStart = new Date(weekStart);
      newStart.setDate(weekStart.getDate() - 7);
      setWeekStart(newStart);
    };

    const handleNextWeek = () => {
      const newStart = new Date(weekStart);
      newStart.setDate(weekStart.getDate() + 7);
      setWeekStart(newStart);
    };

    const handleCurrentWeek = () => {
      const d = new Date();
      const curr = d.getDay() || 7; 
      const diff = d.getDate() - curr + 1;
      const monday = new Date(d.setDate(diff));
      monday.setHours(0,0,0,0);
      setWeekStart(monday);
    };

    return (
      <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] animate-in fade-in pb-4">
        {/* Üst Alan */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <Star className="w-7 h-7 text-yellow-500 fill-yellow-500" /> Puantaj Takip
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">
              {donem === 'hafta' ? 'Mavi yaka personellerinin haftalık kazandığı puanları buradan takip edebilirsiniz.'
                : donem === 'ay' ? 'Bu ay kazanılan toplam puanlar — en yüksekten düşüğe sıralı.'
                : donem === 'sene' ? `${new Date().getFullYear()} yılında kazanılan toplam puanlar — en yüksekten düşüğe sıralı.`
                : 'Tüm zamanların toplam puanları — en yüksekten düşüğe sıralı.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
             {/* ==========================================================
                 YENİ: DÖNEM SEKMELERİ
                 "Bu Hafta" takvim tablosunu, diğerleri sıralı puan listesini
                 gösterir. Hafta ileri/geri okları yalnızca hafta görünümünde
                 anlamlı olduğu için orada çıkar.
                 ========================================================== */}
             <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
               {PUANTAJ_DONEMLERI.map(d => (
                 <button key={d.id} type="button" onClick={() => setDonem(d.id)}
                   className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
                     donem === d.id ? 'bg-yellow-500 text-white shadow-sm' : 'text-neutral-600 hover:bg-white'}`}>
                   {d.ad}
                 </button>
               ))}
             </div>
             {donem === 'hafta' && (<>
             <button onClick={handleCurrentWeek} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition text-sm">
                Bu Haftaya Dön
             </button>
             <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
               <button onClick={handlePrevWeek} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft className="w-4 h-4" /></button>
               <span className="font-bold text-sm px-2 text-black whitespace-nowrap">
                  {weekDays[0].dayNum} {["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][weekDays[0].monthNum-1]} - {weekDays[6].dayNum} {["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][weekDays[6].monthNum-1]}
               </span>
               <button onClick={handleNextWeek} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight className="w-4 h-4" /></button>
             </div>
             </>)}
          </div>
        </div>

        {/* ==================================================================
            YENİ: DÖNEM LİSTESİ (Bu Ay / Bu Sene / Tüm Zamanlar)
            ==================================================================
            Bu dönemlerde gün gün takvim göstermek anlamsız olurdu (30-365
            sütun). Onun yerine personeller TOPLAM PUANA göre sıralı bir
            liste halinde gösterilir; ilk üç sıra madalya renkleriyle
            vurgulanır. Puanı olmayanlar listenin sonunda gri görünür.
            ================================================================== */}
        {donem !== 'hafta' && (
          <div className="flex-1 w-full overflow-auto custom-scrollbar-table border border-neutral-300 rounded-2xl bg-white shadow-sm">
            {donemYukleniyor ? (
              <div className="p-10 text-center text-sm font-bold text-neutral-400">Puanlar hesaplanıyor...</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {donemSiralamasi.map((satir, i) => {
                  const sira = i + 1;
                  // İlk üç sıra madalya renkleri; puanı 0 olanlar vurgulanmaz
                  const madalya = satir.puan > 0 && sira === 1 ? 'bg-yellow-50 border-l-4 border-yellow-400'
                    : satir.puan > 0 && sira === 2 ? 'bg-neutral-50 border-l-4 border-neutral-400'
                    : satir.puan > 0 && sira === 3 ? 'bg-orange-50 border-l-4 border-orange-400'
                    : '';
                  return (
                    <div key={satir.person.id} className={`flex items-center gap-3 p-3 hover:bg-neutral-50 transition ${madalya} ${satir.person.employmentStatus === 'Pasif' ? 'opacity-60 grayscale' : ''}`}>
                      <span className={`w-8 text-center font-black shrink-0 ${sira <= 3 && satir.puan > 0 ? 'text-yellow-700 text-lg' : 'text-neutral-400 text-sm'}`}>{sira}</span>
                      <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden shrink-0 border border-neutral-300">
                        {satir.person.profileImage ? <img src={satir.person.profileImage} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm truncate ${satir.person.employmentStatus === 'Pasif' ? 'line-through text-neutral-500' : 'text-black'}`}>{satir.person.fullName}</div>
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate">{satir.person.position}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {satir.puan > 0 && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                        <span className={`font-black tabular-nums ${satir.puan > 0 ? 'text-yellow-700 text-lg' : 'text-neutral-300 text-base'}`}>{satir.puan}</span>
                      </div>
                    </div>
                  );
                })}
                {donemSiralamasi.length === 0 && (
                  <div className="p-10 text-center text-sm font-bold text-neutral-400">Kayıtlı mavi yaka personel bulunamadı.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HAFTALIK TAKVİM TABLOSU — yalnızca "Bu Hafta" seçiliyken */}
        {donem === 'hafta' && (
        <div className="flex-1 w-full overflow-auto custom-scrollbar-table border border-neutral-300 rounded-2xl bg-white shadow-sm relative">
            <table className="w-full border-collapse text-sm text-left table-fixed">
              <thead className="bg-neutral-100 sticky top-0 z-30 shadow-sm">
                <tr>
                  <th className="p-2 md:p-3 border-b border-r border-neutral-300 font-black text-neutral-800 sticky left-0 bg-neutral-100 z-40 w-[26%] md:w-[20%] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Personel
                  </th>
                  {weekDays.map((wd) => {
                    // DÜZELTİLDİ: UTC yerine yerel tarih karşılaştırması
                    const isToday = wd.dateStr === mesaiYerelTarihStr({ yearNum: new Date().getFullYear(), monthNum: new Date().getMonth() + 1, dayNum: new Date().getDate() });
                    return (
                      <th key={wd.dateStr} className={`p-1 md:p-2 border-b border-r border-neutral-300 text-center w-[9%] md:w-[10%] overflow-hidden ${isToday ? 'bg-yellow-200' : ''}`}>
                        <div className={`text-[10px] md:text-xs font-bold truncate ${isToday ? 'text-yellow-800' : 'text-neutral-500'}`}>{wd.dayName}</div>
                        <div className={`text-sm md:text-xl font-black ${isToday ? 'text-yellow-700' : 'text-black'}`}>{wd.dayNum}</div>
                      </th>
                    );
                  })}
                  <th className="p-1 md:p-2 border-b border-neutral-300 font-black text-center bg-yellow-400 text-black w-[11%] md:w-[10%] text-[9px] md:text-sm">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {maviYakaList.map(person => {
                  let weeklyTotal = 0;
                  return (
                    <tr key={person.id} className={`hover:bg-neutral-50 transition ${person.employmentStatus === 'Pasif' ? 'opacity-60 grayscale' : ''}`}>
                      <td className="p-1 md:p-2 border-r border-neutral-200 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-neutral-50 overflow-hidden">
                        <div className="flex items-center gap-1.5 md:gap-3">
                          <div className="hidden md:flex w-9 h-9 rounded-full bg-neutral-200 items-center justify-center overflow-hidden shrink-0 border border-neutral-300">
                            {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-400" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`font-bold text-[11px] md:text-sm truncate w-full ${person.employmentStatus === 'Pasif' ? 'line-through text-neutral-500' : 'text-black'}`} title={person.fullName}>{person.fullName}</span>
                            <span className="text-[9px] md:text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate w-full">{person.position}</span>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((wd) => {
                        // DÜZELTİLDİ: bileşik anahtar ('yıl_ay_gün')
                        const pts = parseFloat(puantajData[person.id]?.[mesaiGunAnahtari(wd)]) || 0;
                        weeklyTotal += pts;
                        // DÜZELTİLDİ: "bugün" karşılaştırması yerel tarihle
                        const isToday = wd.dateStr === mesaiYerelTarihStr({ yearNum: new Date().getFullYear(), monthNum: new Date().getMonth() + 1, dayNum: new Date().getDate() });
                        
                        return (
                          <td key={wd.dateStr} className={`p-1 border-r border-neutral-200 text-center align-middle overflow-hidden ${isToday ? 'bg-yellow-50/50' : ''}`}>
                            {pts > 0 ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1 animate-in zoom-in">
                                <Star className="w-4 h-4 md:w-6 md:h-6 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                                <span className="text-[9px] md:text-[11px] font-black text-yellow-800 bg-yellow-100 px-1 py-0.5 rounded border border-yellow-300 truncate w-full max-w-[40px] md:max-w-[60px]">+{pts}</span>
                              </div>
                            ) : (
                              <span className="text-neutral-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1 md:p-2 text-center bg-yellow-50 align-middle border-l border-neutral-300">
                        {weeklyTotal > 0 ? (
                          <span className="text-sm md:text-lg font-black text-yellow-700">{weeklyTotal}</span>
                        ) : (
                          <span className="text-neutral-400 font-bold">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {maviYakaList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-neutral-500 font-medium text-sm">
                      Kayıtlı mavi yaka personel bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  export const MaviMesaiTahtasiView = ({ personnelList, db, appId }) => {
    const today = new Date();
    const currentDay = today.getDay() || 7; 
    const diffToMonday = today.getDate() - currentDay + 1;
    const initialMonday = new Date(today.setDate(diffToMonday));
    initialMonday.setHours(0, 0, 0, 0);

    const [weekStart, setWeekStart] = useState(initialMonday);
    const [mesaiData, setMesaiData] = useState({});
    
    // Mavi yaka olanları filtrele (Muhasebe tablosuyla eşleşmesi için pasif/eski kayıtlar dahil)
    const currentListMonth = weekStart.getMonth() + 1;
    const currentListYear = weekStart.getFullYear();
    const maviYakaList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (!isPersonnelVisibleInMonth(p, currentListYear, currentListMonth)) return false;
      return p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position));
    }).sort((a, b) => {
        // YENİ: Liste artık pozisyona göre değil, doğrudan Ad Soyad'a göre
        // ALFABETİK (tr-TR) sıralanır. İşten ayrılanlar (Pasif) yine en sonda kalır.
        if (a.employmentStatus === 'Pasif' && b.employmentStatus !== 'Pasif') return 1;
        if (a.employmentStatus !== 'Pasif' && b.employmentStatus === 'Pasif') return -1;
        return (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR');
    });

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        yearNum: d.getFullYear(),
        // DÜZELTİLDİ: toISOString() (UTC) tarihi bir gün geriye kaydırıyordu
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayName: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()]
      };
    });

    useEffect(() => {
      const fetchMesaiData = async () => {
        if (!db || !appId) return;
        try {
          const y1 = weekStart.getFullYear();
          const m1 = weekStart.getMonth() + 1;
          
          const endOfWeek = new Date(weekStart);
          endOfWeek.setDate(weekStart.getDate() + 6);
          const y2 = endOfWeek.getFullYear();
          const m2 = endOfWeek.getMonth() + 1;

          const mRef1 = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y1}_${m1}`);
          const mSnap1 = await getDoc(mRef1);
          // DÜZELTİLDİ (İzin Tahtası ile AYNI hata): kayıtlar 'yıl_ay_gün'
          // bileşik anahtarıyla toplanır; iki aya taşan haftada önceki ayın
          // aynı numaralı günleri bu ayın hücrelerinde görünmez.
          let mergedRecords = {};
          if (mSnap1.exists()) mesaiAyiBirlestir(mergedRecords, mSnap1.data().records || {}, y1, m1);

          // Hafta diğer aya taşıyorsa (Örn: 28 Mayıs - 3 Haziran) iki ayı da birleştir
          if (m1 !== m2) {
             const mRef2 = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y2}_${m2}`);
             const mSnap2 = await getDoc(mRef2);
             if (mSnap2.exists()) {
                 mesaiAyiBirlestir(mergedRecords, mSnap2.data().records || {}, y2, m2);
             }
          }
          setMesaiData(mergedRecords);
        } catch(e) { console.error("Mesai veri çekilemedi:", e); }
      };
      fetchMesaiData();
    }, [weekStart, db, appId]);

    const handlePrevWeek = () => {
      const newStart = new Date(weekStart);
      newStart.setDate(weekStart.getDate() - 7);
      setWeekStart(newStart);
    };

    const handleNextWeek = () => {
      const newStart = new Date(weekStart);
      newStart.setDate(weekStart.getDate() + 7);
      setWeekStart(newStart);
    };

    const handleCurrentWeek = () => {
      const d = new Date();
      const curr = d.getDay() || 7; 
      const diff = d.getDate() - curr + 1;
      const monday = new Date(d.setDate(diff));
      monday.setHours(0,0,0,0);
      setWeekStart(monday);
    };

    return (
      <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] animate-in fade-in pb-4">
        {/* Üst Alan */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <Clock className="w-7 h-7 text-blue-600" /> Mavi Mesai Tahtası
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">Mavi yaka personellerinin haftalık mesai durumlarını buradan takip edebilirsiniz.</p>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={handleCurrentWeek} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition text-sm">
                Bu Hafta
             </button>
             <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
               <button onClick={handlePrevWeek} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft className="w-4 h-4" /></button>
               <span className="font-bold text-sm px-2 text-black whitespace-nowrap">
                  {weekDays[0].dayNum} {["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][weekDays[0].monthNum-1]} - {weekDays[6].dayNum} {["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][weekDays[6].monthNum-1]}
               </span>
               <button onClick={handleNextWeek} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight className="w-4 h-4" /></button>
             </div>
          </div>
        </div>

        {/* Ana Takvim Görünümü */}
        <div className="flex-1 w-full overflow-auto custom-scrollbar-table border border-neutral-300 rounded-2xl bg-white shadow-sm relative">
            <table className="w-full border-collapse text-sm text-left table-fixed">
              <thead className="bg-neutral-100 sticky top-0 z-30 shadow-sm">
                <tr>
                  <th className="p-2 md:p-3 border-b border-r border-neutral-300 font-black text-neutral-800 sticky left-0 bg-neutral-100 z-40 w-[30%] md:w-[23%] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Personel
                  </th>
                  {weekDays.map((wd) => {
                    // DÜZELTİLDİ: UTC yerine yerel tarih karşılaştırması
                    const isToday = wd.dateStr === mesaiYerelTarihStr({ yearNum: new Date().getFullYear(), monthNum: new Date().getMonth() + 1, dayNum: new Date().getDate() });
                    return (
                      <th key={wd.dateStr} className={`p-1 md:p-2 border-b border-r border-neutral-300 text-center w-[10%] md:w-[11%] overflow-hidden ${isToday ? 'bg-blue-100' : ''}`}>
                        <div className={`text-[10px] md:text-xs font-bold truncate ${isToday ? 'text-blue-800' : 'text-neutral-500'}`}>{wd.dayName}</div>
                        <div className={`text-sm md:text-xl font-black ${isToday ? 'text-blue-700' : 'text-black'}`}>{wd.dayNum}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {maviYakaList.map(person => {
                  return (
                    <tr key={person.id} className={`hover:bg-neutral-50 transition ${person.employmentStatus === 'Pasif' ? 'opacity-60 grayscale' : ''}`}>
                      <td className="p-1 md:p-2 border-r border-neutral-200 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-neutral-50 overflow-hidden">
                        <div className="flex items-center gap-1.5 md:gap-3">
                          <div className="hidden md:flex w-9 h-9 rounded-full bg-neutral-200 items-center justify-center overflow-hidden shrink-0 border border-neutral-300">
                            {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-400" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`font-bold text-[11px] md:text-sm truncate w-full ${person.employmentStatus === 'Pasif' ? 'line-through text-neutral-500' : 'text-black'}`} title={person.fullName}>{person.fullName}</span>
                            <span className="text-[9px] md:text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate w-full">{person.position}</span>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((wd) => {
                        // DÜZELTİLDİ: bileşik anahtar ('yıl_ay_gün')
                        const cell = mesaiData[person.id]?.[mesaiGunAnahtari(wd)];
                        const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                        const hr = typeof cell === 'object' && cell !== null ? cell.hours : '';
                        // DÜZELTİLDİ: "bugün" karşılaştırması da yerel tarihle yapılır
                        const isToday = wd.dateStr === mesaiYerelTarihStr({ yearNum: new Date().getFullYear(), monthNum: new Date().getMonth() + 1, dayNum: new Date().getDate() });
                        const option = MESAI_STATUS_OPTIONS.find(o => o.code === st);
                        
                        return (
                          <td key={wd.dateStr} className={`p-1 border-r border-neutral-200 text-center align-middle overflow-hidden ${isToday ? 'bg-blue-50/30' : ''}`}>
                            {st ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1 animate-in zoom-in">
                                <span className={`text-[9px] md:text-[11px] font-black px-1 py-0.5 rounded-md shadow-sm border border-black/5 truncate w-full max-w-[40px] md:max-w-[70px] ${option?.color || 'bg-neutral-200 text-neutral-700'}`} title={option?.label || st}>
                                  {option?.label || st}
                                </span>
                                {hr && <span className="text-[8px] md:text-[10px] font-bold text-neutral-600 bg-white px-1 py-0.5 rounded border border-neutral-200 shadow-sm truncate">{hr} S</span>}
                              </div>
                            ) : (
                              <span className="text-neutral-300 text-xs">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {maviYakaList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-neutral-500 font-medium text-sm">
                      Kayıtlı mavi yaka personel bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      </div>
    );
  };

// ============================================================================
// ÇALIŞMA PROGRAMI BÖLÜMÜ (Personel Ekle / Düzenle formlarında kullanılır)
// Amaç: Her personelin haftalık çalışma düzenini tanımlamak. Böylece Mesai
// Takip bölümü, personelin QR ile bastığı giriş/çıkış saatlerini kendi
// programıyla karşılaştırıp değerlendirebilir.
// Örnek senaryolar:
//  - Beyaz Yaka: Pzt-Cum 09:00-18:00, Cumartesi 09:00-15:00 (erken çıkış hakkı),
//    Pazar izinli  -> 6 gün / haftalık 51 saat
//  - Mavi Yaka: 6 gün x 10 saat = 60 saat, haftada 1 gün izin (gün seçilebilir)
// Veri, personel kaydının 'calismaProgrami' alanında saklanır.
// ============================================================================
export const HAFTA_GUNLERI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

// ============================================================================
// HAFTALIK MESAİ KURAL MOTORU (tüm yakalar için ortak)
// ============================================================================
// Kullanıcı kuralları (20.08.2026'dan itibaren geçerli):
//  1) QR veya manuel giriş yapan       -> GELDİ (G)
//  2) Gelmeyen personel:
//       • O hafta İLK kez gelmediyse   -> HAFTALIK İZİN (Hİ)
//       • O hafta İKİNCİ ve sonraki    -> DEVAMSIZLIK (D)
//       • O hafta zaten Hİ kullanmışsa -> doğrudan DEVAMSIZLIK (D)
//  3) Puantajda ZATEN bir izin/rapor kodu varsa (Yİ, Bİ, Üİ, R, İB) o güne
//     HİÇ dokunulmaz; QR okutulmamış olması devamsızlık saydırmaz.
//  4) Hafta boyunca 7 gün de geldiyse (Pazartesi–Pazar) PAZAR günü
//     FAZLA GÜN (FG) olarak işaretlenir.
//
// TARİH SINIRI: MESAI_KURAL_BASLANGIC'tan ÖNCEKİ günlere kural UYGULANMAZ.
// O günler "zaten işlenmiş" kabul edilir; haftalık sayımda ise puantajdaki
// mevcut kodu izin türü değilse GELMİŞ sayılır (kullanıcı talebi).
//
// Bu fonksiyon SAF'tır (Firestore'a dokunmaz), böylece hem Mesai Takip hem
// Personel Muhasebe aynı sonucu üretir ve ayrıca test edilebilir.
// ============================================================================
export const MESAI_KURAL_BASLANGIC = '2026-08-20';

// Puantajda "o güne zaten karar verilmiş" sayılan izin/rapor kodları
export const MESAI_IZIN_KODLARI = ['Yİ', 'Bİ', 'Üİ', 'R', 'İB'];
// "Gelmiş" sayılan puantaj kodları (mesai/fazla gün varyantları dahil)
export const MESAI_GELDI_KODLARI = ['G', 'FM', 'EM', 'FG', 'FGM'];

// Verilen tarihin ait olduğu haftanın PAZARTESİ gününü döndürür (YYYY-AA-GG)
export const haftaninPazartesisi = (tarihStr) => {
  const d = new Date(tarihStr + 'T00:00:00');
  const gunIndeks = (d.getDay() + 6) % 7; // Pazartesi = 0 ... Pazar = 6
  d.setDate(d.getDate() - gunIndeks);
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  const gun = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${ay}-${gun}`;
};

// Haftanın 7 gününü (Pazartesi→Pazar) tarih dizisi olarak döndürür
export const haftaGunleriListesi = (tarihStr) => {
  const bas = new Date(haftaninPazartesisi(tarihStr) + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(bas);
    d.setDate(bas.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
};

/**
 * Bir gün için haftalık kural kararını üretir.
 * @param tarihStr      Değerlendirilen gün (YYYY-AA-GG)
 * @param girisVarMi    O gün QR/manuel giriş kaydı var mı?
 * @param cikisVarMi    O gün QR/manuel ÇIKIŞ kaydı var mı? (YENİ)
 * @param mevcutKod     O günün puantajdaki mevcut kodu (yoksa null/'')
 * @param haftaGunleri  [{ tarihStr, girisVarMi, cikisVarMi, kod }] — haftanın TÜM 7 günü
 * @returns { status, aciklama } veya null (karara karışılmaz)
 */
export const haftalikMesaiKarari = ({ tarihStr, girisVarMi, cikisVarMi = false, mevcutKod, haftaGunleri = [] }) => {
  // Kural sınırı: başlangıç tarihinden önceki günlere hiç karışma
  if (tarihStr < MESAI_KURAL_BASLANGIC) return null;

  // KURAL 3: Elle işaretlenmiş izin/rapor varsa dokunma
  if (mevcutKod && MESAI_IZIN_KODLARI.includes(mevcutKod)) return null;

  // Bir günün "gelmiş" sayılıp sayılmadığı: QR girişi VEYA puantajda geldi kodu.
  // Kural başlangıcından ÖNCEKİ günlerde QR aranmaz; puantaj kodu esas alınır
  // (kullanıcı talebi: "öncesini QR/manuel basılmış kabul et").
  const gelmisSayilir = (g) => {
    if (g.kod && MESAI_IZIN_KODLARI.includes(g.kod)) return false; // İzinli gün gelmiş sayılmaz
    if (g.kod && MESAI_GELDI_KODLARI.includes(g.kod)) return true;
    if (g.tarihStr < MESAI_KURAL_BASLANGIC) return false; // Kodu yoksa ve eskiyse bilinmiyor
    // YENİ (kullanıcı talebi): Şehir dışı görevden dönüp SADECE ÇIKIŞ basılan
    // gün de çalışılmış sayılır; aksi halde o gün "gelinmedi" görünüp haftalık
    // izin/devamsızlık sayacını yanlış tetiklerdi.
    return !!g.girisVarMi || !!g.cikisVarMi;
  };

  const gunAdiBu = HAFTA_GUNLERI[(new Date(tarihStr + 'T00:00:00').getDay() + 6) % 7];

  // ---------------------------------------------------------------- GELDİ
  if (girisVarMi) {
    // ======================================================================
    // KURAL 4 (kullanıcı talebi — beyaz yaka Pazar/FG):
    // ======================================================================
    // Personel Pazartesiden hafta sonuna (Pazar dâhil) HER GÜN gelmişse o
    // hafta 7 gün çalışmış olur; zorunlu 6 günün üstüne çıktığı için Pazar
    // günü FG (Fazla Gün) verilir.
    // Hafta içinde haftalık iznini başka bir gün kullandıysa (Pazar dışı bir
    // gün gelinmemişse) toplam 6 gün çalışmış olur — bu durumda FG VERİLMEZ,
    // Pazar normal çalışma günü (G) sayılır.
    if (gunAdiBu === 'Pazar') {
      const digerAltiGun = haftaGunleri.filter(g => g.tarihStr !== tarihStr);
      // Gelinmemiş gün: izinli değil, geldi kodu yok ve hiç okutma yok
      const gelinmeyenler = digerAltiGun.filter(g => {
        if (g.kod && MESAI_IZIN_KODLARI.includes(g.kod)) return true;  // mazeretli izin = çalışılmadı
        if (g.kod === 'Hİ' || g.kod === 'D') return true;
        return !gelmisSayilir(g);
      });
      const hepsiGelmis = digerAltiGun.length === 6 && gelinmeyenler.length === 0;
      if (hepsiGelmis) {
        return { status: 'FG', aciklama: 'Pazartesi–Pazar 7 gün kesintisiz çalışıldı (zorunlu 6 günün üstü) → Pazar günü Fazla Gün (FG).' };
      }
      // Hafta içinde eksik gün varsa Pazar normal çalışma günüdür
      return { status: 'G', aciklama: `Pazar günü giriş yapıldı; haftalık izin hafta içinde kullanıldığı için (${gelinmeyenler.length} gün gelinmedi) FG verilmedi → Geldi.` };
    }
    return { status: 'G', aciklama: 'QR/kod ile giriş yapıldı → Geldi.' };
  }

  // ============================================================ ŞEHİR DIŞI
  // YENİ (kullanıcı talebi): Giriş yok ama ÇIKIŞ var.
  // Personel il dışına çıktığı gün çıkış basamamış, ertesi gün (veya bir
  // sonraki gün) dönüp basmıştır. O gün devamsız DEĞİLDİR; çalışılmıştır ve
  // personele 1 Fazla Gün (FG) eklenir. Bu kontrol haftalık izin /
  // devamsızlık kararından ÖNCE gelir, aksi halde üzerine yazılırdı.
  if (cikisVarMi) {
    return { status: 'FG', aciklama: 'Giriş kaydı yok ama çıkış basılmış → şehir dışı görevden dönüş kabul edildi; 1 Fazla Gün (FG) eklendi.' };
  }

  // ------------------------------------------------------------- GELMEDİ
  // ========================================================================
  // DÜZELTME (kullanıcı talebi — beyaz yaka haftalık izin/devamsızlık):
  // ========================================================================
  // KURAL: Bir personel haftada 6 gün gelmek zorundadır (7 günün 1'i haftalık
  // izin). Buna göre:
  //   • Hafta içinde GELİNMEYEN İLK gün          -> Hİ (haftalık izin)
  //   • GELİNMEYEN İKİNCİ ve sonraki günler      -> D  (devamsızlık)
  // ESKİ HATA: "ikinci gün" tespiti YALNIZCA puantaja daha önce Hİ yazılmış
  // olmasına bakıyordu (g.kod === 'Hİ'). Öneri henüz kaydedilmemişse (ki
  // normal akışta öneriler kullanıcı onaylayana kadar kaydedilmez) ikinci,
  // üçüncü gelmeme günü de Hİ görünüyordu; personel 5 gün çalışmış olsa bile
  // devamsızlık yazılmıyordu.
  // YENİ MANTIK: Haftanın bu günden ÖNCEKİ günlerine bakılır ve "gerçekten
  // gelinmemiş" gün var mı diye sayılır — kaydedilmiş Hİ kodu VEYA hiç
  // giriş/çıkış/geldi kodu olmayan gün. Böyle bir gün varsa bu gün ikinci
  // gelmemedir -> Devamsızlık. Yoksa haftanın ilk gelmemesidir -> Haftalık İzin.
  // İzinli (Yİ/Bİ/Üİ/R/İB) günler bu sayıma girmez; onlar mazeretli izindir.
  const oncekiGunler = haftaGunleri.filter(g => g.tarihStr < tarihStr);
  const gelmemisSayilir = (g) => {
    if (g.kod && MESAI_IZIN_KODLARI.includes(g.kod)) return false; // mazeretli izin
    if (g.kod === 'Hİ' || g.kod === 'D') return true;              // kaydedilmiş gelmeme
    if (g.kod && MESAI_GELDI_KODLARI.includes(g.kod)) return false; // geldi kodu var
    if (g.tarihStr < MESAI_KURAL_BASLANGIC) return false;          // kural öncesi: bilinmiyor
    return !g.girisVarMi && !g.cikisVarMi;                          // hiç okutma yok -> gelmemiş
  };
  const oncekiGelmemeSayisi = oncekiGunler.filter(gelmemisSayilir).length;

  if (oncekiGelmemeSayisi > 0) {
    return { status: 'D', aciklama: `Bu hafta haftalık izin zaten kullanıldı (${oncekiGelmemeSayisi}. gelmeme) — ${gunAdiBu} günü de gelinmedi → Devamsızlık (haftada 6 gün çalışma kuralı).` };
  }
  // Bu hafta ilk kez gelinmemiş -> haftalık izin
  return { status: 'Hİ', aciklama: `Bu hafta ilk kez giriş yapılmadı → Haftalık İzin (${gunAdiBu}).` };
};

// Yeni personel için varsayılan program (yaka tipine göre)
export const varsayilanCalismaProgrami = (yaka = 'Mavi Yaka') => yaka === 'Beyaz Yaka'
  ? { gunSayisi: 6, gunlukSaat: 9, baslangicSaati: '09:00', bitisSaati: '18:00', izinGunleri: ['Pazar'], erkenCikisVar: true, erkenCikisGunu: 'Cumartesi', erkenCikisBaslangic: '09:00', erkenCikisBitis: '15:00' }
  : { gunSayisi: 6, gunlukSaat: 10, baslangicSaati: '08:00', bitisSaati: '18:00', izinGunleri: ['Pazar'], erkenCikisVar: false, erkenCikisGunu: 'Cumartesi', erkenCikisBaslangic: '09:00', erkenCikisBitis: '15:00' };

// "09:00" -> 540 (dakika) çevrimi; saat farkı hesaplarında kullanılır
const saatiDakikayaCevir = (s) => { const [h, d] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (d || 0); };

// Haftalık toplam saati otomatik hesaplar (erken çıkış günü ayrı hesaplanır)
export const haftalikToplamSaat = (p) => {
  if (!p) return 0;
  const gunluk = Number(p.gunlukSaat) || 0;
  const gun = Number(p.gunSayisi) || 0;
  if (p.erkenCikisVar && gun > 0) {
    const erkenSaat = Math.max(0, (saatiDakikayaCevir(p.erkenCikisBitis) - saatiDakikayaCevir(p.erkenCikisBaslangic)) / 60);
    return (gun - 1) * gunluk + erkenSaat; // Diğer günler tam, erken çıkış günü kısa
  }
  return gun * gunluk;
};

export const CalismaProgramiBolumu = ({ program, guncelle, yakaTipi }) => {
  // Program tanımlı değilse yaka tipine göre varsayılanla başlatılır
  const p = program || varsayilanCalismaProgrami(yakaTipi);
  const degis = (alan, deger) => guncelle({ ...p, [alan]: deger });

  // İzin günü seçimi: aynı güne tekrar basılırsa listeden çıkarılır
  const izinDegis = (gun) => {
    const mevcut = Array.isArray(p.izinGunleri) ? p.izinGunleri : [];
    degis('izinGunleri', mevcut.includes(gun) ? mevcut.filter(g => g !== gun) : [...mevcut, gun]);
  };

  // Hazır şablonlar: tek tıkla tipik düzenleri doldurur
  const sablonUygula = (tip) => {
    if (tip === 'beyaz') guncelle({ gunSayisi: 6, gunlukSaat: 9, baslangicSaati: '09:00', bitisSaati: '18:00', izinGunleri: ['Pazar'], erkenCikisVar: true, erkenCikisGunu: 'Cumartesi', erkenCikisBaslangic: '09:00', erkenCikisBitis: '15:00' });
    if (tip === 'mavi60') guncelle({ gunSayisi: 6, gunlukSaat: 10, baslangicSaati: '08:00', bitisSaati: '18:00', izinGunleri: ['Pazar'], erkenCikisVar: false, erkenCikisGunu: 'Cumartesi', erkenCikisBaslangic: '09:00', erkenCikisBitis: '15:00' });
    if (tip === 'mavi54') guncelle({ gunSayisi: 6, gunlukSaat: 9, baslangicSaati: '08:00', bitisSaati: '17:00', izinGunleri: ['Pazar'], erkenCikisVar: false, erkenCikisGunu: 'Cumartesi', erkenCikisBaslangic: '09:00', erkenCikisBitis: '15:00' });
  };

  const toplam = haftalikToplamSaat(p);

  return (
    <div className="border-2 border-neutral-200 rounded-2xl p-4 bg-neutral-50/60 space-y-4">
      {/* BAŞLIK + haftalık toplam saat rozeti */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-black text-neutral-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-red-600" /> ÇALIŞMA PROGRAMI
        </h4>
        {/* Haftalık toplam otomatik hesaplanır, elle girilmez */}
        <span className="text-[11px] font-black bg-black text-white px-3 py-1.5 rounded-full">
          HAFTALIK TOPLAM: {toplam.toFixed(toplam % 1 === 0 ? 0 : 1).replace('.', ',')} SAAT
        </span>
      </div>

      {/* HAZIR ŞABLONLAR */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] font-black text-neutral-400 self-center">HAZIR ŞABLON:</span>
        <button type="button" onClick={() => sablonUygula('beyaz')} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-neutral-800 text-white hover:bg-black transition">Beyaz Yaka (Cmt erken çıkış • 51 sa)</button>
        <button type="button" onClick={() => sablonUygula('mavi60')} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-blue-600 text-white hover:bg-blue-700 transition">Mavi Yaka 60 Saat (6 gün × 10 sa)</button>
        <button type="button" onClick={() => sablonUygula('mavi54')} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-blue-500 text-white hover:bg-blue-600 transition">Mavi Yaka 54 Saat (6 gün × 9 sa)</button>
      </div>

      {/* GÜN SAYISI • GÜNLÜK SAAT • MESAİ SAATLERİ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-neutral-600 mb-1">Haftalık Çalışma Günü *</label>
          <select value={p.gunSayisi} onChange={e => degis('gunSayisi', Number(e.target.value))} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm cursor-pointer focus:ring-2 focus:ring-red-600 outline-none">
            {[1, 2, 3, 4, 5, 6, 7].map(g => <option key={g} value={g}>{g} gün</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-600 mb-1">Günlük Çalışma Saati *</label>
          <select value={p.gunlukSaat} onChange={e => degis('gunlukSaat', Number(e.target.value))} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm cursor-pointer focus:ring-2 focus:ring-red-600 outline-none">
            {[4, 5, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12].map(s => <option key={s} value={s}>{String(s).replace('.', ',')} saat</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-600 mb-1">İşe Giriş Saati</label>
          <input type="time" value={p.baslangicSaati || '09:00'} onChange={e => degis('baslangicSaati', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm focus:ring-2 focus:ring-red-600 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-600 mb-1">İşten Çıkış Saati</label>
          <input type="time" value={p.bitisSaati || '18:00'} onChange={e => degis('bitisSaati', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm focus:ring-2 focus:ring-red-600 outline-none" />
        </div>
      </div>

      {/* İZİN GÜNLERİ — Beyaz Yaka genelde Pazar, Mavi Yaka haftada 1 gün */}
      <div>
        <label className="block text-xs font-bold text-neutral-600 mb-2">Haftalık İzin Günü / Günleri <span className="font-medium text-neutral-400">(birden fazla seçilebilir)</span></label>
        <div className="flex flex-wrap gap-1.5">
          {HAFTA_GUNLERI.map(gun => {
            const secili = (p.izinGunleri || []).includes(gun);
            return (
              <button key={gun} type="button" onClick={() => izinDegis(gun)} className={`px-3 py-2 rounded-xl text-[11px] font-black transition ${secili ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-neutral-500 border border-neutral-300 hover:bg-neutral-100'}`}>
                {gun}
              </button>
            );
          })}
        </div>
      </div>

      {/* ERKEN ÇIKIŞ HAKKI — örn. Satış/Muhasebe Cumartesi 09:00-15:00 */}
      <div className="border-t border-neutral-200 pt-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={!!p.erkenCikisVar} onChange={e => degis('erkenCikisVar', e.target.checked)} className="w-4 h-4 accent-red-600 cursor-pointer" />
          <span className="text-xs font-black text-neutral-700">ERKEN ÇIKIŞ HAKKI VAR</span>
          <span className="text-[10px] font-medium text-neutral-400">(örn. Satış ve Muhasebe personeli Cumartesi 09:00-15:00)</span>
        </label>

        {/* Kutu işaretlenmezse alanlar gizlenir; gereksiz kalabalık olmasın */}
        {p.erkenCikisVar && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Erken Çıkış Günü</label>
              <select value={p.erkenCikisGunu || 'Cumartesi'} onChange={e => degis('erkenCikisGunu', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm cursor-pointer focus:ring-2 focus:ring-red-600 outline-none">
                {HAFTA_GUNLERI.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">O Gün Giriş Saati</label>
              <input type="time" value={p.erkenCikisBaslangic || '09:00'} onChange={e => degis('erkenCikisBaslangic', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm focus:ring-2 focus:ring-red-600 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">O Gün Çıkış Saati</label>
              <input type="time" value={p.erkenCikisBitis || '15:00'} onChange={e => degis('erkenCikisBitis', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-bold text-sm focus:ring-2 focus:ring-red-600 outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* ÖZET CÜMLESİ — yöneticinin girdiği düzeni tek satırda doğrulaması için */}
      <p className="text-[11px] font-bold text-neutral-500 bg-white border border-neutral-200 rounded-xl p-2.5">
        Özet: Haftada <b className="text-black">{p.gunSayisi} gün</b>, günlük <b className="text-black">{String(p.gunlukSaat).replace('.', ',')} saat</b> ({p.baslangicSaati}-{p.bitisSaati})
        {p.erkenCikisVar && <> • <b className="text-red-600">{p.erkenCikisGunu} erken çıkış: {p.erkenCikisBaslangic}-{p.erkenCikisBitis}</b></>}
        {(p.izinGunleri || []).length > 0 && <> • İzin: <b className="text-purple-600">{(p.izinGunleri || []).join(', ')}</b></>}
        {' '}• Toplam <b className="text-black">{toplam.toFixed(toplam % 1 === 0 ? 0 : 1).replace('.', ',')} saat/hafta</b>
      </p>
    </div>
  );
};

  export const AddPersonnelView = ({ onAdd, positions, ranks }) => {
    const [formData, setFormData] = useState({
      fullName: '', email: '', password: '', position: positions?.[0] || 'Şoför', rank: ranks?.[0] || 'Standart',
      collarType: 'Mavi Yaka', employmentStatus: 'Aktif',
      personalPhone: '', companyPhone: '', iban: '', tcNo: '', setcard: '', address: '', profileImage: '', birthDate: '',
      bankaParasi: '', maas: '', yemek: '', yol: '', sigortaMaliyeti: '', icrasiVar: 'Hayır', startDate: new Date().toISOString().split('T')[0],
      // YENİ: Deneme maaşı ve deneme süresi (ay). Boş bırakılırsa deneme uygulanmaz.
      denemeMaasi: '', denemeSuresi: '',
      // YENİ: Haftalık çalışma programı (gün sayısı, günlük saat, izin günü, erken çıkış)
      calismaProgrami: varsayilanCalismaProgrami('Mavi Yaka'),
      // YENİ: Çalışma şekli — 'Özgün' (kadrolu) | 'Uzaktan' (panel kullanıcısı)
      calismaSekli: 'Özgün'
    });
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      setFormData(prev => ({ ...prev, profileImage: 'Yükleniyor...' }));
      const uploadData = new FormData();
      uploadData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: uploadData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setFormData(prev => ({ ...prev, profileImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err);
        setFormData(prev => ({ ...prev, profileImage: '' }));
      }
      setIsUploading(false);
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      onAdd(formData);
      setFormData({
        fullName: '', email: '', password: '', position: positions?.[0] || 'Şoför', rank: ranks?.[0] || 'Standart',
        collarType: 'Mavi Yaka', employmentStatus: 'Aktif',
        personalPhone: '', companyPhone: '', iban: '', tcNo: '', setcard: '', address: '', profileImage: '', birthDate: '',
        bankaParasi: '', maas: '', yemek: '', yol: '', sigortaMaliyeti: '', icrasiVar: 'Hayır', startDate: new Date().toISOString().split('T')[0],
        // YENİ: Kayıt sonrası deneme alanları da sıfırlanır
        denemeMaasi: '', denemeSuresi: ''
      });
      alert('Personel başarıyla sisteme eklendi!');
    };

    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sm:p-10 animate-in fade-in">
        <h2 className="text-xl sm:text-2xl font-black text-black mb-8 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-red-600" /> Personel Ekle
        </h2>
        <div  className="space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 bg-neutral-50 rounded-xl border border-neutral-200">
            <div className="w-20 h-20 rounded-full border border-neutral-300 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
              {formData.profileImage === 'Yükleniyor...' ? (
                <span className="text-[10px] font-bold text-neutral-500 animate-pulse">...</span>
              ) : formData.profileImage ? (
                <img src={formData.profileImage} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <UserPlus className="w-8 h-8 text-neutral-400" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto items-center sm:items-start text-center sm:text-left">
              <span className="text-sm font-bold text-neutral-700">Profil Fotoğrafı</span>
              <MediaCaptureMenu onChange={handleImageUpload} disabled={isUploading} compact buttonLabel="Fotoğraf Yükle" buttonClassName="cursor-pointer px-4 py-2 bg-white border border-neutral-300 rounded-lg flex items-center justify-center gap-2 hover:bg-neutral-50 transition w-full sm:w-max shadow-sm text-xs font-bold text-neutral-700" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Ad Soyad *</label>
              <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">TC Kimlik No</label>
              <input type="text" value={formData.tcNo} onChange={e => setFormData({...formData, tcNo: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Kişisel Telefon</label>
              <input type="tel" value={formData.personalPhone} onChange={e => setFormData({...formData, personalPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Şirket Telefonu</label>
              <input type="tel" value={formData.companyPhone} onChange={e => setFormData({...formData, companyPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">İşe Başlama Tarihi</label>
              <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-neutral-700" />
            </div>
            {/* YENİ: Doğum Tarihi — Profilim sayfasında salt-okunur gösterilir */}
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Doğum Tarihi</label>
              <input type="date" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-neutral-700" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">SetCard Numarası</label>
              <input type="text" value={formData.setcard} onChange={e => setFormData({...formData, setcard: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="SetCard Numarası" />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-neutral-700 mb-1">Yaka Tipi *</label>
              <select value={formData.collarType} onChange={e => setFormData({...formData, collarType: e.target.value, calismaProgrami: varsayilanCalismaProgrami(e.target.value)})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                <option value="Mavi Yaka">Mavi Yaka</option>
                <option value="Beyaz Yaka">Beyaz Yaka</option>
              </select>
              {/* Yaka tipi değişince çalışma programı o yakanın tipik düzenine döner */}
            </div>
            <div>
              {/* YENİ: ÇALIŞMA ŞEKLİ */}
              <label className="block text-sm font-bold text-neutral-700 mb-1">Çalışma Şekli *</label>
              <select value={formData.calismaSekli} onChange={e => setFormData({ ...formData, calismaSekli: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                <option value="Özgün">Özgün (Kadrolu Personel)</option>
                <option value="Uzaktan">Uzaktan (Sadece Panel Kullanıcısı)</option>
              </select>
              {formData.calismaSekli === 'Uzaktan' && (
                <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5 flex items-start gap-1.5 animate-in fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Bu kişi maaş, puantaj, mesai, prim ve yıllık izin ekranlarında görünmez; özlük dosyası oluşturulmaz. Yalnızca panele erişir.
                </p>
              )}
            </div>
          </div>

          {/* ÇALIŞMA PROGRAMI — yalnızca kadrolu (Özgün) personelde anlamlıdır */}
          {formData.calismaSekli !== 'Uzaktan' && (
          <CalismaProgramiBolumu
            program={formData.calismaProgrami}
            yakaTipi={formData.collarType}
            guncelle={(yeni) => setFormData({ ...formData, calismaProgrami: yeni })}
          />
          )}

          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Banka IBAN Numarası</label>
            <input type="text" value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-mono text-sm uppercase transition" placeholder="TR..." />
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres</label>
            <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition h-20 resize-none" placeholder="Personel adresi..."></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
             {/* YENİ: DENEME MAAŞI — normal maaştan ÖNCE gelir.
                 Deneme süresi dolana kadar bordroda bu tutar kullanılır. */}
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Deneme Maaşı (TL)</label>
                <input type="number" value={formData.denemeMaasi || ''} onChange={e => setFormData({...formData, denemeMaasi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Yoksa boş bırakın" />
             </div>
             {/* YENİ: DENEME SÜRESİ — 1 ile 10 ay arası seçilir.
                 İŞE GİRİŞ AYI 1. AY SAYILIR: 15 Temmuz'da giren + 2 ay deneme
                 => Temmuz ve Ağustos deneme, Eylül'de normal maaşa geçer. */}
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Deneme Süresi</label>
                <select value={formData.denemeSuresi || ''} onChange={e => setFormData({...formData, denemeSuresi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition bg-white">
                  <option value="">Deneme süresi yok</option>
                  {DENEME_SURE_SECENEKLERI.map(a => <option key={a} value={a}>{a} Ay</option>)}
                </select>
             </div>
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Maaş Ücreti (TL)</label>
                <input type="number" value={formData.maas} onChange={e => setFormData({...formData, maas: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             {/* Canlı özet — yanlış giriş bordroya yansımadan fark edilsin */}
             {denemeOzetMetni(formData) && (
               <div className="sm:col-span-3 -mt-1">
                 <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                   {denemeOzetMetni(formData)}
                 </p>
               </div>
             )}
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Yol Parası (TL)</label>
                <input type="number" value={formData.yol} onChange={e => setFormData({...formData, yol: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Yemek Parası (TL)</label>
                <input type="number" value={formData.yemek} onChange={e => setFormData({...formData, yemek: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             {/* YENİ: SİGORTA MALİYETİ — personele ödenmeyen, SGK'ya ödenen aylık tutar.
                 Maaş Raporu'nda ayrı sütun olarak görünür ve "Dönem İçi Toplam Personel
                 Maliyeti" hesabına dahil edilir; "Kalan Ödenecek" hesabına DAHİL EDİLMEZ. */}
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Sigorta Maliyeti (Aylık TL)</label>
                <input type="number" value={formData.sigortaMaliyeti} onChange={e => setFormData({...formData, sigortaMaliyeti: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 9500" />
                <p className="text-[10px] font-bold text-neutral-400 mt-1">İşverene ait aylık SGK maliyeti — personele ödenmez, maliyet raporuna işlenir.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Banka Parası (Aylık TL)</label>
              <input type="number" value={formData.bankaParasi} onChange={e => setFormData({...formData, bankaParasi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 17000" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">İcrası Var mı?</label>
              <select value={formData.icrasiVar} onChange={e => setFormData({...formData, icrasiVar: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Pozisyon *</label>
              <select value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Rütbe *</label>
              <select value={formData.rank} onChange={e => setFormData({...formData, rank: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                {ranks.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Personel Durumu *</label>
              <select value={formData.employmentStatus} onChange={e => setFormData({...formData, employmentStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                <option value="Aktif">Aktif (Çalışıyor)</option>
                <option value="Pasif">Pasif</option>
              </select>
            </div>
          </div>

          {/* YENİ: Mavi Yaka için opsiyonel ikinci özellik ve ehliyet bilgisi */}
          {formData.collarType === 'Mavi Yaka' && ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(formData.position) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">İkinci Özellik (Opsiyonel)</label>
                <select value={formData.secondaryPosition || ''} onChange={e => setFormData({...formData, secondaryPosition: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                  <option value="">Yok</option>
                  {['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].filter(p => p !== formData.position).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {(formData.position === 'Şoför' || formData.secondaryPosition === 'Şoför') && (
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Ehliyet Var mı?</label>
                  <select value={formData.ehliyet || 'Yok'} onChange={e => setFormData({...formData, ehliyet: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                    <option value="Yok">Yok</option>
                    <option value="Küçük Ehliyet">Küçük Ehliyet</option>
                    <option value="Büyük Ehliyet">Büyük Ehliyet</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">E-Posta (Sisteme Giriş İçin) *</label>
              <input required type="text" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Şifre (Sisteme Giriş İçin) *</label>
              <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
          </div>

          <button type="button" onClick={handleSubmit} disabled={isUploading} className="w-full py-4 mt-2 bg-[#e62020] text-white font-bold text-lg rounded-xl hover:bg-red-700 transition shadow-md disabled:opacity-50">
            Personeli Kaydet
          </button>
        </div>
      </div>
    );
  };
  export const PersonnelListView = ({ personnelList, onUpdate, positions = [], ranks = [], onViewProfile, pendingEditPersonnelId, setPendingEditPersonnelId, onAddClick }) => {
    const [filterYaka, setFilterYaka] = useState('');
    const [filterPozisyon, setFilterPozisyon] = useState('');
    const [filterRutbe, setFilterRutbe] = useState('');
    const [filterDurum, setFilterDurum] = useState('Aktif');
    const [editingUser, setEditingUser] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // YENİ: Personel Profili'nden "Bilgileri Düzenle" ile gelindiyse düzenleme modalını otomatik aç
    useEffect(() => {
      if (pendingEditPersonnelId) {
        const target = personnelList.find(p => String(p.id) === String(pendingEditPersonnelId));
        if (target) setEditingUser(target);
        if (setPendingEditPersonnelId) setPendingEditPersonnelId(null);
      }
    }, [pendingEditPersonnelId, personnelList]);

    const filteredList = personnelList
      .filter(p => {
        if (filterYaka && p.collarType !== filterYaka) return false;
        if (filterPozisyon && p.position !== filterPozisyon) return false;
        if (filterRutbe && p.rank !== filterRutbe) return false;
        const durum = p.employmentStatus === 'Pasif' ? 'Pasif' : 'Aktif';
        if (filterDurum === 'Aktif' && durum !== 'Aktif') return false;
        if (filterDurum === 'Pasif' && durum !== 'Pasif') return false;
        return true;
      })
      // YENİ: Liste her zaman Ad Soyad'a göre alfabetik (tr-TR) sıralı gösterilir
      .sort((a, b) => (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR'));

    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      setEditingUser(prev => ({ ...prev, profileImage: 'Yükleniyor...' }));
      const uploadData = new FormData();
      uploadData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: uploadData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setEditingUser(prev => ({ ...prev, profileImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err);
        setEditingUser(prev => ({ ...prev, profileImage: '' }));
      }
      setIsUploading(false);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-red-600" /> {filterDurum === 'Aktif' ? 'Çalışan Personel' : filterDurum === 'Pasif' ? 'İşten Ayrılan Personel' : 'Tüm Personel'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterDurum} onChange={e=>setFilterDurum(e.target.value)} className="p-2 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500 bg-neutral-50 text-neutral-700 font-bold cursor-pointer transition hover:border-neutral-300">
              <option value="Aktif">Çalışan Personel</option>
              <option value="Pasif">İşten Ayrılanlar</option>
              <option value="">Tümü</option>
            </select>
            <select value={filterYaka} onChange={e=>setFilterYaka(e.target.value)} className="p-2 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500 bg-neutral-50 text-neutral-700 font-medium cursor-pointer transition hover:border-neutral-300">
              <option value="">Tüm Yakalar</option>
              <option value="Mavi Yaka">Mavi Yaka</option>
              <option value="Beyaz Yaka">Beyaz Yaka</option>
            </select>
            <select value={filterPozisyon} onChange={e=>setFilterPozisyon(e.target.value)} className="p-2 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500 bg-neutral-50 text-neutral-700 font-medium cursor-pointer transition hover:border-neutral-300">
              <option value="">Tüm Pozisyonlar</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterRutbe} onChange={e=>setFilterRutbe(e.target.value)} className="p-2 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500 bg-neutral-50 text-neutral-700 font-medium cursor-pointer transition hover:border-neutral-300">
              <option value="">Tüm Rütbeler</option>
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {/* YENİ: "Personel Ekle" artık sol menüde ayrı bir sayfa değil; bu sayfanın
                sağ üst köşesinde (filtrelerin sonunda) buton olarak duruyor. */}
            {onAddClick && (
              <button
                type="button"
                onClick={onAddClick}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-black rounded-lg transition flex items-center gap-1.5 shadow-md shadow-green-600/20 shrink-0"
              >
                <PlusCircle className="w-4 h-4" /> Personel Ekle
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-white">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Ad Soyad</th>
                <th className="p-4 font-bold">İletişim</th>
                <th className="p-4 font-bold">Pozisyon / Rütbe</th>
                <th className="p-4 font-bold text-center">Profil</th>
                <th className="p-4 font-bold text-center rounded-tr-xl">Düzenleme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredList.map(person => (
                <tr key={person.id} className="hover:bg-neutral-50 transition group">
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-200 overflow-hidden shrink-0 border border-neutral-300 shadow-sm">
                        {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover"/> : <User className="w-5 h-5 m-2.5 text-neutral-400"/>}
                      </div>
                      {person.fullName}
                    </div>
                  </td>
                  <td className="p-4 text-[11px] text-neutral-600 font-medium">
                    <div className="flex flex-col gap-1">
                      {person.personalPhone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-neutral-400"/> {person.personalPhone}</span>}
                      {person.companyPhone && <span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3 text-neutral-400"/> Şirket: {person.companyPhone}</span>}
                      {person.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-neutral-400"/> {person.email}</span>}
                      {person.startDate && <span className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3 text-neutral-400"/> Başlama: {person.startDate}</span>}
                      {person.setcard && <span className="flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-neutral-400"/> SetCard: {person.setcard}</span>}
                      {!person.personalPhone && !person.companyPhone && !person.email && !person.startDate && <span className="text-neutral-400 italic">Bilgi Yok</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-black block text-sm">{person.position || '-'}</span>
                    <span className="text-xs text-neutral-500">{person.rank || '-'}</span>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => onViewProfile && onViewProfile(person.id)} className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 w-max mx-auto" title="Profiline Git">
                      <FolderOpen className="w-3.5 h-3.5" /> Profiline Git
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => setEditingUser(person)} className="p-2 text-blue-500 border border-blue-200 bg-white rounded-lg hover:bg-blue-50 hover:border-blue-300 transition shadow-sm" title="Düzenle">
                      <Edit className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-neutral-500 font-medium border-2 border-dashed border-neutral-200 bg-neutral-50/50 m-4 rounded-xl">Bu kritere uygun personel bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
                <h3 className="font-bold text-lg">Personel Düzenle</h3>
                <button onClick={() => setEditingUser(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div  className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="w-20 h-20 rounded-full border border-neutral-300 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                    {editingUser.profileImage === 'Yükleniyor...' ? (
                      <span className="text-[10px] font-bold text-neutral-500 animate-pulse">...</span>
                    ) : editingUser.profileImage ? (
                      <img src={editingUser.profileImage} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                      <UserPlus className="w-8 h-8 text-neutral-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 w-full sm:w-auto items-center sm:items-start text-center sm:text-left">
                    <span className="text-sm font-bold text-neutral-700">Profil Fotoğrafı</span>
                    <MediaCaptureMenu onChange={handleImageUpload} disabled={isUploading} compact buttonLabel="Fotoğraf Yükle" buttonClassName="cursor-pointer px-4 py-2 bg-white border border-neutral-300 rounded-lg flex items-center justify-center gap-2 hover:bg-neutral-50 transition w-full sm:w-max shadow-sm text-xs font-bold text-neutral-700" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Ad Soyad *</label>
                    <input required type="text" value={editingUser.fullName || ''} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">TC Kimlik No</label>
                    <input type="text" value={editingUser.tcNo || ''} onChange={e => setEditingUser({...editingUser, tcNo: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Kişisel Telefon</label>
                    <input type="tel" value={editingUser.personalPhone || ''} onChange={e => setEditingUser({...editingUser, personalPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Şirket Telefonu</label>
                    <input type="tel" value={editingUser.companyPhone || ''} onChange={e => setEditingUser({...editingUser, companyPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İşe Başlama Tarihi</label>
                    <input type="date" value={editingUser.startDate || ''} onChange={e => setEditingUser({...editingUser, startDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-neutral-700" />
                  </div>
                  {/* YENİ: Doğum Tarihi — Profilim sayfasında salt-okunur gösterilir */}
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Doğum Tarihi</label>
                    <input type="date" value={editingUser.birthDate || ''} onChange={e => setEditingUser({...editingUser, birthDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-neutral-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">SetCard Numarası</label>
                    <input type="text" value={editingUser.setcard || ''} onChange={e => setEditingUser({...editingUser, setcard: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="SetCard Numarası" />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Yaka Tipi *</label>
                    <select value={editingUser.collarType || 'Mavi Yaka'} onChange={e => setEditingUser({...editingUser, collarType: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                      <option value="Mavi Yaka">Mavi Yaka</option>
                      <option value="Beyaz Yaka">Beyaz Yaka</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    {/* YENİ: ÇALIŞMA ŞEKLİ (eski kayıtlarda varsayılan 'Özgün') */}
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Çalışma Şekli *</label>
                    <select value={editingUser.calismaSekli || 'Özgün'} onChange={e => setEditingUser({...editingUser, calismaSekli: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                      <option value="Özgün">Özgün (Kadrolu Personel)</option>
                      <option value="Uzaktan">Uzaktan (Sadece Panel Kullanıcısı)</option>
                    </select>
                    {editingUser.calismaSekli === 'Uzaktan' && (
                      <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5 flex items-start gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Maaş, puantaj, mesai, prim ve yıllık izin ekranlarında görünmez; özlük dosyası oluşturulmaz.
                      </p>
                    )}
                  </div>
                </div>

                {/* ÇALIŞMA PROGRAMI — yalnızca kadrolu (Özgün) personelde anlamlıdır */}
                {(editingUser.calismaSekli || 'Özgün') !== 'Uzaktan' && (
                <CalismaProgramiBolumu
                  program={editingUser.calismaProgrami}
                  yakaTipi={editingUser.collarType || 'Mavi Yaka'}
                  guncelle={(yeni) => setEditingUser({ ...editingUser, calismaProgrami: yeni })}
                />
                )}

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Banka IBAN Numarası</label>
                  <input type="text" value={editingUser.iban || ''} onChange={e => setEditingUser({...editingUser, iban: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-mono text-sm uppercase transition" placeholder="TR..." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres</label>
                  <textarea value={editingUser.address || ''} onChange={e => setEditingUser({...editingUser, address: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition h-20 resize-none" placeholder="Personel adresi..."></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                   {/* YENİ: DENEME MAAŞI ve DENEME SÜRESİ — Personel Ekle formuyla
                       birebir aynı mantık. Sıralama: Deneme Maaşı > Deneme Süresi > Maaş. */}
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Deneme Maaşı (TL)</label>
                      <input type="number" value={editingUser.denemeMaasi || ''} onChange={e => setEditingUser({...editingUser, denemeMaasi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Yoksa boş bırakın" />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Deneme Süresi</label>
                      <select value={editingUser.denemeSuresi || ''} onChange={e => setEditingUser({...editingUser, denemeSuresi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition bg-white">
                        <option value="">Deneme süresi yok</option>
                        {DENEME_SURE_SECENEKLERI.map(a => <option key={a} value={a}>{a} Ay</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Maaş Ücreti (TL)</label>
                      <input type="number" value={editingUser.maas || ''} onChange={e => setEditingUser({...editingUser, maas: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                   </div>
                   {denemeOzetMetni(editingUser) && (
                     <div className="sm:col-span-3 -mt-1">
                       <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                         {denemeOzetMetni(editingUser)}
                       </p>
                     </div>
                   )}
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Yol Parası (TL)</label>
                      <input type="number" value={editingUser.yol || ''} onChange={e => setEditingUser({...editingUser, yol: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Yemek Parası (TL)</label>
                      <input type="number" value={editingUser.yemek || ''} onChange={e => setEditingUser({...editingUser, yemek: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                   </div>
                   {/* YENİ: SİGORTA MALİYETİ — mevcut personellerin de girilebilmesi için
                       düzenleme formuna eklendi (Personel Ekle formundakiyle aynı alan). */}
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Sigorta Maliyeti (Aylık TL)</label>
                      <input type="number" value={editingUser.sigortaMaliyeti || ''} onChange={e => setEditingUser({...editingUser, sigortaMaliyeti: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 9500" />
                      <p className="text-[10px] font-bold text-neutral-400 mt-1">İşverene ait aylık SGK maliyeti — personele ödenmez, maliyet raporuna işlenir.</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Banka Parası (Aylık TL)</label>
                    <input type="number" value={editingUser.bankaParasi || ''} onChange={e => setEditingUser({...editingUser, bankaParasi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 17000" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İcrası Var mı?</label>
                    <select value={editingUser.icrasiVar || 'Hayır'} onChange={e => setEditingUser({...editingUser, icrasiVar: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                      <option value="Hayır">Hayır</option>
                      <option value="Evet">Evet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Pozisyon *</label>
                    <select value={editingUser.position || ''} onChange={e => setEditingUser({...editingUser, position: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Rütbe *</label>
                    <select value={editingUser.rank || ''} onChange={e => setEditingUser({...editingUser, rank: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                      {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Personel Durumu *</label>
                    <select value={editingUser.employmentStatus || 'Aktif'} onChange={e => setEditingUser({...editingUser, employmentStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                      <option value="Aktif">Aktif (Çalışıyor)</option>
                      <option value="Pasif">Pasif</option>
                    </select>
                  </div>
                </div>

                {/* YENİ: Mavi Yaka için opsiyonel ikinci özellik ve ehliyet bilgisi */}
                {editingUser.collarType === 'Mavi Yaka' && ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(editingUser.position) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">İkinci Özellik (Opsiyonel)</label>
                      <select value={editingUser.secondaryPosition || ''} onChange={e => setEditingUser({...editingUser, secondaryPosition: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                        <option value="">Yok</option>
                        {['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].filter(p => p !== editingUser.position).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    {(editingUser.position === 'Şoför' || editingUser.secondaryPosition === 'Şoför') && (
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-1">Ehliyet Var mı?</label>
                        <select value={editingUser.ehliyet || 'Yok'} onChange={e => setEditingUser({...editingUser, ehliyet: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                          <option value="Yok">Yok</option>
                          <option value="Küçük Ehliyet">Küçük Ehliyet</option>
                          <option value="Büyük Ehliyet">Büyük Ehliyet</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">E-Posta (Sisteme Giriş İçin) *</label>
                    <input required type="text" value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Şifre (Sisteme Giriş İçin) *</label>
                    <input required type="text" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                </div>

                <button type="button" onClick={(e) => { e.preventDefault(); onUpdate(editingUser); setEditingUser(null); }} disabled={isUploading} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg mt-2 disabled:opacity-50">
                  <Save className="w-5 h-5" /> Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- YENİ: PERSONEL PROFİL SAYFASI ---
  // Bu bileşen TAMAMEN YENİ ve EKLENTİ niteliğindedir. Mevcut personel
  // düzenleme/listeleme mantığına hiç dokunulmadı.
  export const PERSONNEL_SKILL_DEFS = [
    { key: 'soforluk', label: 'Şoförlük Gücü', positions: ['Şoför'] },
    { key: 'mobilya', label: 'Mobilya Gücü', positions: ['Mobilya Ustası'] },
    { key: 'tasima', label: 'Taşıma Gücü', positions: ['Taşıma Elemanı'] },
    { key: 'disiplin', label: 'Disiplin Gücü' },
    { key: 'liderlik', label: 'Liderlik Gücü' },
    { key: 'takimCalismasi', label: 'Takım Çalışması Gücü' },
    { key: 'tecrube', label: 'Tecrübe Gücü' },
    { key: 'form', label: 'Form Gücü' }
  ];

  export const getSkillBarColor = (val) => {
    if (val < 35) return 'bg-red-500';
    if (val < 60) return 'bg-orange-400';
    if (val < 80) return 'bg-yellow-400';
    return 'bg-green-500';
  };
  export const getSkillTextColor = (val) => {
    if (val < 35) return 'text-red-600';
    if (val < 60) return 'text-orange-600';
    if (val < 80) return 'text-yellow-600';
    return 'text-green-600';
  };
  export const getSkillCircleColor = (val) => {
    if (val < 35) return 'bg-red-500';
    if (val < 60) return 'bg-orange-400';
    if (val < 80) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  export const isSkillVisibleForPerson = (skillDef, person) => {
    if (!skillDef.positions) return true;
    return skillDef.positions.some(pos => person?.position === pos || person?.secondaryPosition === pos);
  };

  // --- YENİ: OTOMATİK ÖZELLİK PUANI HESAPLAMA MOTORU ---
  // Elle +/- yapılan puanlar yerine, sistemdeki gerçek verilerden (işler, tutanaklar, mesai/puantaj,
  // kıdem) otomatik ve mavi yaka personeli birbirine göre kıyaslayarak (min-max normalizasyonu,
  // 20-100 aralığı) puan üretir.
  const MAVI_YAKA_POSITIONS_FOR_SKILL = ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operatör'];

  const normalizeSkillScores = (rawMap) => {
    const ids = Object.keys(rawMap);
    if (ids.length === 0) return {};
    const values = ids.map(id => rawMap[id]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const result = {};
    ids.forEach(id => {
      if (max === min) { result[id] = ids.length === 1 ? 65 : 60; return; }
      result[id] = Math.round(20 + ((rawMap[id] - min) / (max - min)) * 80);
    });
    return result;
  };

  const monthsBetweenDates = (dateStr, endDate) => {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    if (isNaN(start.getTime())) return 0;
    return Math.max(0, (endDate - start) / (1000 * 60 * 60 * 24 * 30.44));
  };

  const computeMedianJobPrice = (allJobs) => {
    const prices = allJobs.filter(j => j.status === 'completed' && (parseFloat(j.price) || 0) > 0).map(j => parseFloat(j.price)).sort((a, b) => a - b);
    if (prices.length === 0) return 0;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  };

  const computeSoforlukRaw = (person, allJobs, allVehicles) => {
    const driverJobs = allJobs.filter(j => j.status === 'completed' && (j.assignedPersonnelIds || [])[0] === person.id);
    if (driverJobs.length === 0) return null;
    const medianPrice = computeMedianJobPrice(allJobs);
    let activityScore = 0;
    driverJobs.forEach(j => {
      let weight = 1;
      const vehicle = allVehicles.find(v => v.plate === j.assignedVehiclePlate);
      if (vehicle && (vehicle.requiredLicense === 'Büyük Ehliyet' || vehicle.type === 'Kamyon')) weight += 0.6;
      if (j.fromProvince && j.toProvince && j.fromProvince !== j.toProvince) weight += 0.6;
      if (medianPrice > 0 && (parseFloat(j.price) || 0) > medianPrice * 1.5) weight += 0.2;
      activityScore += weight;
    });
    const positive = driverJobs.filter(j => ['Yorum yazdı.', 'Video alındı.'].includes(j.endJobDetails?.customerSatisfaction)).length;
    const damaged = driverJobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').length;
    const feedbackScore = (positive - damaged * 1.5) / driverJobs.length;
    return activityScore + feedbackScore;
  };

  const ROOM_COUNT_WEIGHTS = { '1+0': 1, '1+1': 1.15, '2+1': 1.3, '3+1': 1.45, '4+1': 1.6 };
  const JOB_TYPE_WEIGHTS = { 'Nakliye': 1.3, 'Depo': 1.0, 'Asansör': 0.7 };
  const computeJobDifficulty = (job, medianPrice) => {
    const typeW = JOB_TYPE_WEIGHTS[job.type] || 1;
    const roomW = ROOM_COUNT_WEIGHTS[job.fromRoomCount] || 1;
    const price = parseFloat(job.price) || 0;
    let priceW = 1;
    if (medianPrice > 0 && price > 0) {
      priceW = Math.max(0.7, Math.min(1.5, 0.5 + (price / medianPrice) * 0.5));
    }
    return typeW * roomW * priceW;
  };

  const computePositionReviewRaw = (person, allJobs) => {
    const personJobs = allJobs.filter(j => j.status === 'completed' && ((j.assignedPersonnelIds || []).includes(person.id) || j.assignedPersonnelId === person.id));
    if (personJobs.length === 0) return null;
    const medianPrice = computeMedianJobPrice(allJobs);
    let totalScore = 0, totalWeight = 0;
    personJobs.forEach(j => {
      const difficulty = computeJobDifficulty(j, medianPrice);
      const isPositive = ['Yorum yazdı.', 'Video alındı.'].includes(j.endJobDetails?.customerSatisfaction);
      const isDamaged = j.endJobDetails?.damageStatus === 'Hasar var';
      let jobScore = isDamaged ? -difficulty * 1.5 : difficulty * 0.4;
      if (isPositive) jobScore += difficulty * 1.0;
      totalScore += jobScore;
      totalWeight += difficulty;
    });
    const qualityRatio = totalWeight > 0 ? totalScore / totalWeight : 0;
    const volumeBonus = Math.log(personJobs.length + 1) * 0.12;
    return qualityRatio + volumeBonus;
  };

  const NEGATIVE_TUTANAK_KEYWORDS = ['devamsız', 'geç kal', 'disiplin', 'kavga', 'trafik cezas', 'maddi hasar'];
  const computeDisiplinRaw = (person, allActions, allMesai = []) => {
    const personActions = allActions.filter(a => String(a.personnelId) === String(person.id) && a.type === 'tutanak');
    const negativeCount = personActions.filter(a => NEGATIVE_TUTANAK_KEYWORDS.some(k => (a.title || '').toLocaleLowerCase('tr-TR').includes(k))).length;
    const devamsizGunSayisi = allMesai.filter(m => String(m.personId) === String(person.id) && m.code === 'D').length;
    const tenureMonths = Math.max(1, monthsBetweenDates(person.startDate, new Date()));
    return -((negativeCount * 1.5 + devamsizGunSayisi) / tenureMonths);
  };

  const computeLiderlikRaw = (person, allJobs) => {
    const ledJobs = allJobs.filter(j => j.status === 'completed' && j.assignedPersonnelId === person.id);
    if (ledJobs.length === 0) return null;
    const positive = ledJobs.filter(j => ['Yorum yazdı.', 'Video alındı.'].includes(j.endJobDetails?.customerSatisfaction)).length;
    const damaged = ledJobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').length;
    return (positive - damaged * 1.5) / ledJobs.length + Math.log(ledJobs.length + 1) * 0.15;
  };

  const computeTakimRaw = (person, allJobs) => {
    const supportJobs = allJobs.filter(j => (j.supportPersonnelIds || []).includes(person.id));
    if (supportJobs.length === 0) return 0;
    let score = 0;
    supportJobs.forEach(j => {
      let weight = 1;
      if (j.status === 'completed') {
        if (j.endJobDetails?.damageStatus === 'Hasar var') weight -= 0.5;
        if (['Yorum yazdı.', 'Video alındı.'].includes(j.endJobDetails?.customerSatisfaction)) weight += 0.3;
      }
      score += weight;
    });
    return score;
  };

  const computeTecrubeRaw = (person) => {
    if (!person.startDate) return 0;
    return (new Date() - new Date(person.startDate)) / 86400000;
  };

  const FAZLA_MESAI_CODES = ['FG', 'FGM', 'FM'];
  const computeFormRaw = (person, allJobs, allActions, allMesai = []) => {
    const personJobs = allJobs.filter(j => j.status === 'completed' && ((j.assignedPersonnelIds || []).includes(person.id) || j.assignedPersonnelId === person.id));
    const tenureMonths = Math.max(1, monthsBetweenDates(person.startDate, new Date()));
    const raporCountAction = allActions.filter(a => String(a.personnelId) === String(person.id) && a.type === 'rapor').length;
    const personMesai = allMesai.filter(m => String(m.personId) === String(person.id));
    const geldiGun = personMesai.filter(m => m.code === 'G').length;
    const fazlaMesaiGun = personMesai.filter(m => FAZLA_MESAI_CODES.includes(m.code)).length;
    const eksikMesaiGun = personMesai.filter(m => m.code === 'EM').length;
    const devamsizGun = personMesai.filter(m => m.code === 'D').length;
    const raporGun = personMesai.filter(m => m.code === 'R').length;
    const ucretsizIzinGun = personMesai.filter(m => m.code === 'Üİ').length;
    const calisilanGun = geldiGun + fazlaMesaiGun;
    const degerlendirilebilirGun = calisilanGun + eksikMesaiGun + devamsizGun + raporGun + ucretsizIzinGun;
    const gelmeOrani = degerlendirilebilirGun > 0 ? calisilanGun / degerlendirilebilirGun : 0.5;
    return (
      gelmeOrani * 10
      + (fazlaMesaiGun / tenureMonths) * 2.5
      - (devamsizGun / tenureMonths) * 4
      - (raporGun / tenureMonths) * 2
      - (raporCountAction / tenureMonths) * 1
      - (ucretsizIzinGun / tenureMonths) * 1
      - (eksikMesaiGun / tenureMonths) * 0.8
      + (personJobs.length / tenureMonths) * 0.5
    );
  };

  const computeMesaiGlobalModifier = (person, allMesai = []) => {
    const personMesai = allMesai.filter(m => String(m.personId) === String(person.id));
    if (personMesai.length === 0) return 0;
    const geldiGun = personMesai.filter(m => m.code === 'G').length;
    const fazlaMesaiGun = personMesai.filter(m => FAZLA_MESAI_CODES.includes(m.code)).length;
    const devamsizGun = personMesai.filter(m => m.code === 'D').length;
    const raporGun = personMesai.filter(m => m.code === 'R').length;
    const ucretsizIzinGun = personMesai.filter(m => m.code === 'Üİ').length;
    const calisilanGun = geldiGun + fazlaMesaiGun;
    const degerlendirilebilirGun = calisilanGun + devamsizGun + raporGun + ucretsizIzinGun;
    if (degerlendirilebilirGun === 0) return 0;
    const gelmeOrani = calisilanGun / degerlendirilebilirGun;
    const base = (gelmeOrani - 0.85) * 30;
    const mesaiBonus = Math.min(2, fazlaMesaiGun * 0.1);
    return Math.max(-6, Math.min(6, Math.round(base + mesaiBonus)));
  };

  export const computeAllAutoSkills = (allPersonnel, allJobs, allActions, allVehicles = [], allMesai = []) => {
    const maviYaka = (allPersonnel || []).filter(p => p.collarType === 'Mavi Yaka' || (!p.collarType && MAVI_YAKA_POSITIONS_FOR_SKILL.includes(p.position)));
    const jobs_ = allJobs || [], actions_ = allActions || [], vehicles_ = allVehicles || [], mesai_ = allMesai || [];
    const result = {};
    maviYaka.forEach(p => { result[p.id] = {}; });

    {
      const eligible = maviYaka.filter(p => p.position === 'Şoför' || p.secondaryPosition === 'Şoför');
      const rawMap = {};
      eligible.forEach(p => { const raw = computeSoforlukRaw(p, jobs_, vehicles_); if (raw !== null) rawMap[p.id] = raw; });
      const normalized = normalizeSkillScores(rawMap);
      eligible.forEach(p => { result[p.id].soforluk = normalized[p.id] !== undefined ? normalized[p.id] : 50; });
    }
    [{ pos: 'Taşıma Elemanı', key: 'tasima' }, { pos: 'Mobilya Ustası', key: 'mobilya' }].forEach(({ pos, key }) => {
      const eligible = maviYaka.filter(p => p.position === pos || p.secondaryPosition === pos);
      const rawMap = {};
      eligible.forEach(p => { const raw = computePositionReviewRaw(p, jobs_); if (raw !== null) rawMap[p.id] = raw; });
      const normalized = normalizeSkillScores(rawMap);
      eligible.forEach(p => { result[p.id][key] = normalized[p.id] !== undefined ? normalized[p.id] : 50; });
    });
    {
      const rawMap = {};
      maviYaka.forEach(p => { rawMap[p.id] = computeDisiplinRaw(p, actions_, mesai_); });
      const normalized = normalizeSkillScores(rawMap);
      maviYaka.forEach(p => { result[p.id].disiplin = normalized[p.id] ?? 50; });
    }
    {
      const leaders = maviYaka.filter(p => ['Ekip Şefi', 'Heryerden Usta', 'Kalfa'].includes(p.rank));
      const rawMap = {};
      leaders.forEach(p => { const raw = computeLiderlikRaw(p, jobs_); if (raw !== null) rawMap[p.id] = raw; });
      const normalized = normalizeSkillScores(rawMap);
      maviYaka.forEach(p => {
        result[p.id].liderlik = ['Ekip Şefi', 'Heryerden Usta', 'Kalfa'].includes(p.rank) ? (normalized[p.id] !== undefined ? normalized[p.id] : 50) : 50;
      });
    }
    {
      const rawMap = {};
      maviYaka.forEach(p => { rawMap[p.id] = computeTakimRaw(p, jobs_); });
      const normalized = normalizeSkillScores(rawMap);
      maviYaka.forEach(p => { result[p.id].takimCalismasi = normalized[p.id] ?? 50; });
    }
    {
      const rawMap = {};
      maviYaka.forEach(p => { rawMap[p.id] = computeTecrubeRaw(p); });
      const normalized = normalizeSkillScores(rawMap);
      maviYaka.forEach(p => { result[p.id].tecrube = normalized[p.id] ?? 50; });
    }
    {
      const rawMap = {};
      maviYaka.forEach(p => { rawMap[p.id] = computeFormRaw(p, jobs_, actions_, mesai_); });
      const normalized = normalizeSkillScores(rawMap);
      maviYaka.forEach(p => { result[p.id].form = normalized[p.id] ?? 50; });
    }
    maviYaka.forEach(p => {
      const modifier = computeMesaiGlobalModifier(p, mesai_);
      if (modifier === 0) return;
      Object.keys(result[p.id]).forEach(key => {
        result[p.id][key] = Math.max(0, Math.min(100, result[p.id][key] + modifier));
      });
    });
    return result;
  };

  export const computeAvgSkillForPerson = (person, skillsMap) => {
    if (!person) return 0;
    const personSkills = (skillsMap && skillsMap[String(person.id)]) || {};
    const visibleDefs = PERSONNEL_SKILL_DEFS.filter(s => isSkillVisibleForPerson(s, person));
    if (visibleDefs.length === 0) return 0;
    return Math.round(visibleDefs.reduce((sum, s) => sum + (typeof personSkills[s.key] === 'number' ? personSkills[s.key] : 50), 0) / visibleDefs.length);
  };

  export const SkillScoreBadge = ({ person, skillsMap }) => {
    // KULLANICI İSTEĞİ (15.08.2026): "Özellikler" puan sistemi tamamen
    // kaldırıldı — hiç yapılmamış gibi davranılır. Bileşen, çağrıldığı hiçbir
    // yerde (Personel Tahtası, Ekip Kurma Tahtası, iş kartları) görünmez.
    // Çağıran satırlara dokunulmadığı için hiçbir ekran bozulmaz.
    return null;
    // eslint-disable-next-line no-unreachable
    const [showPopup, setShowPopup] = useState(false);
    const personSkills = (skillsMap && skillsMap[String(person.id)]) || {};
    const visibleDefs = PERSONNEL_SKILL_DEFS.filter(s => isSkillVisibleForPerson(s, person));
    const avg = computeAvgSkillForPerson(person, skillsMap);
    return (
      <div className="relative inline-block" onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
        <button type="button" onClick={(e) => { e.stopPropagation(); setShowPopup(p => !p); }} title="Özellik Puanları (Otomatik)"
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-sm border-2 border-white shrink-0 ${getSkillCircleColor(avg)}`}>
          {avg}
        </button>
        {showPopup && (
          <div onClick={e => e.stopPropagation()} className="absolute z-50 top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-neutral-200 p-3 animate-in fade-in zoom-in-95">
            <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 truncate">{person.fullName} • Özellik Puanları</p>
            <div className="space-y-1.5">
              {visibleDefs.map(s => {
                const val = typeof personSkills[s.key] === 'number' ? personSkills[s.key] : 50;
                return (
                  <div key={s.key} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="font-bold text-neutral-600 truncate">{s.label}</span>
                    <span className={`font-black shrink-0 ${getSkillTextColor(val)}`}>{val}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-neutral-100 mt-2 pt-2 flex justify-between items-center">
              <span className="text-[10px] font-bold text-neutral-500">Ortalama</span>
              <span className={`text-xs font-black ${getSkillTextColor(avg)}`}>{avg}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SteeringWheelIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
      <line x1="12" y1="3" x2="12" y2="9.3" /><line x1="5.3" y1="16.5" x2="10.2" y2="13.3" /><line x1="18.7" y1="16.5" x2="13.8" y2="13.3" />
    </svg>
  );
  const DrillIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="9" width="9" height="6" rx="1" /><path d="M11.5 10.5h4.5l4.5-2v9l-4.5-2h-4.5z" /><line x1="20.5" y1="12" x2="22.5" y2="12" />
    </svg>
  );
  const getPositionSkillIcon = (pos, person, keyName) => {
    if (pos === 'Şoför') {
      const isBuyuk = person.ehliyet === 'Büyük Ehliyet';
      return <span key={keyName} title={`Şoför${person.ehliyet ? ' • ' + person.ehliyet : ''}`}><SteeringWheelIcon className={`w-3.5 h-3.5 shrink-0 ${isBuyuk ? 'text-yellow-500' : 'text-neutral-300'}`} /></span>;
    }
    if (pos === 'Mobilya Ustası') return <span key={keyName} title="Mobilya Ustası"><DrillIcon className="w-3.5 h-3.5 shrink-0 text-orange-600" /></span>;
    if (pos === 'Taşıma Elemanı') return <span key={keyName} title="Taşıma Elemanı"><Zap className="w-3.5 h-3.5 shrink-0 text-blue-600 fill-blue-500" /></span>;
    return null;
  };
  export const PersonPositionRankIcons = ({ person }) => {
    if (!person) return null;
    const items = [];
    if (person.rank === 'Ekip Şefi') items.push(<Star key="rank" className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" title="Ekip Şefi" />);
    else if (person.rank === 'Heryerden Usta' || person.rank === 'Kalfa') items.push(<Star key="rank" className="w-3.5 h-3.5 text-neutral-400 fill-white shrink-0" title="Heryerden Usta" />);
    const primaryIcon = getPositionSkillIcon(person.position, person, 'primary');
    if (primaryIcon) items.push(primaryIcon);
    if (person.secondaryPosition) {
      const secondaryIcon = getPositionSkillIcon(person.secondaryPosition, person, 'secondary');
      if (secondaryIcon) items.push(secondaryIcon);
    }
    if (items.length === 0) return null;
    return <div className="flex items-center gap-1 shrink-0">{items}</div>;
  };

  export const PersonnelProfileView = ({ personId, personnelList, jobs, db, appId, addSystemLog, onBack, setViewingImage, setActiveTab, setPendingEditPersonnelId, allPersonnelActions = [], vehicles = [], currentUser, allMesaiRecords = [] }) => {
    const person = personnelList.find(p => String(p.id) === String(personId));

    const [periodFilter, setPeriodFilter] = useState('month'); // week | month | lastMonth | year | all
    // YENİ: Mavi Yaka Puantaj tablosundaki toplam puanla BİREBİR aynı olması için,
    // "Alınan Yorum" değeri doğrudan puantaj aylık dokümanından (records[personId]) okunur.
    const [puantajPointsTotal, setPuantajPointsTotal] = useState(null);
    const [clothingRecords, setClothingRecords] = useState([]);
    const [phoneRecords, setPhoneRecords] = useState([]);
    const [leaveRecords, setLeaveRecords] = useState([]);

    const [showClothingModal, setShowClothingModal] = useState(false);
    const [clothingForm, setClothingForm] = useState({ item: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
    const [editingClothingId, setEditingClothingId] = useState(null);
    const [clothingUploading, setClothingUploading] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneForm, setPhoneForm] = useState({ model: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
    const [editingPhoneId, setEditingPhoneId] = useState(null);
    const [phoneUploading, setPhoneUploading] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], days: '', note: '' });

    // YENİ: "İşi Bırakma" modalı için state
    const [showResignModal, setShowResignModal] = useState(false);
    // YENİ: İşi bırakan personeli tekrar işe başlatma penceresi
    const [showRestartModal, setShowRestartModal] = useState(false);
    const [restartForm, setRestartForm] = useState({ date: new Date().toISOString().split('T')[0], mod: 'yeni', araKod: 'Üİ' });
    const [restartKaydediliyor, setRestartKaydediliyor] = useState(false);
    const [resignForm, setResignForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '' });

    // YENİ: İşten çıkış HESAP DÖKÜMÜ / kesin hesap kapama akışı için state'ler
    // (Yemek/Yol iadesi, İcra, çalışılan gün, kalan banka/nakit tablosu + onay + imzalı belge)
    const [showSettlementModal, setShowSettlementModal] = useState(false); // hesap dökümü tablosu penceresi
    const [settlementData, setSettlementData] = useState(null); // hesaplanan döküm
    // YENİ: Ayrılan personelin çıkış anındaki hakediş/maaş dökümünü SALT-OKUNUR gösteren pencere
    const [showExitSettlementView, setShowExitSettlementView] = useState(false);
    const [settlementConfirm, setSettlementConfirm] = useState({ nakitVerildi: false, bankaVerildi: false, belgeUrl: '' });
    const [settlementUploading, setSettlementUploading] = useState(false);

    // YENİ: Personel Hareket İşlemleri (Avans, Maaş/Yol/Yemek Onayı, Tutanak, Rapor)
    const [personnelActions, setPersonnelActions] = useState([]);
    const nowMonth = new Date().toISOString().split('T')[0].substring(0, 7); // YYYY-MM
    // YENİ: Hareket akışı için aylık filtre ve "tümünü gör" durumu
    const [hareketMonth, setHareketMonth] = useState(nowMonth);
    const [showAllHareket, setShowAllHareket] = useState(false);
    const [showAvansModal, setShowAvansModal] = useState(false);
    const [avansForm, setAvansForm] = useState({ type: 'nakit', amount: '', month: nowMonth, note: '' });
    // YENİ: Maaş / Yol / Yemek durumu artık Mavi/Beyaz Maaş Tablosu'ndaki tiklerden otomatik okunur (bildirim mantığı)
    const [financeMonth, setFinanceMonth] = useState(nowMonth); // YYYY-MM, her zaman şimdiki ay seçili başlar
    const [financeMonthRow, setFinanceMonthRow] = useState({});
    // ========================================================================
    // YENİ: AYRILIŞ HAKEDİŞ — ÇIKIŞ AYINA AİT MAAŞ TABLOSU KAYDI
    // "Ayrılış Hakediş Dökümü" ekranında, personele O AY İÇİNDE FİİLEN
    // YAPILMIŞ tüm ödemeleri (avanslar + maaş tablosunda tik atılmış
    // yemek/yol/banka/nakit/icra tutarları) gösterip nihai ödenecek tutarı
    // hesaplamak için, çıkış ayının maaş kaydı ayrıca okunur.
    // NOT: Bu state ve onu dolduran effect, React Hook Kuralları gereği
    // bileşenin erken "return"lerinden ÖNCE tanımlanmıştır.
    // ========================================================================
    const [cikisAyiMaasRow, setCikisAyiMaasRow] = useState({});

    // YENİ: ÇIKIŞ TARİHİNİ DÜZENLEME
    // Çıkış tarihi yanlış girildiğinde tüm hakediş hesabı kayar (çalışılan gün,
    // yemek/yol iadesi, mesai). Bu yüzden tarihi düzeltip hesabı YENİDEN
    // ÜRETEBİLMEK gerekiyor. computeSettlement(dateStr) zaten tarihi parametre
    // olarak alıyor; sadece yeni tarihle tekrar çağrılıp sonuç kaydedilir.
    const [showCikisTarihiDuzenle, setShowCikisTarihiDuzenle] = useState(false);
    const [yeniCikisTarihi, setYeniCikisTarihi] = useState('');
    const [cikisTarihiKaydediliyor, setCikisTarihiKaydediliyor] = useState(false);
    const [showTutanakModal, setShowTutanakModal] = useState(false);
    const [tutanakForm, setTutanakForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
    // YENİ: Hazır tutanak şablonu seçimi
    const [tutanakTemplateKey, setTutanakTemplateKey] = useState('');
    const [showRaporModal, setShowRaporModal] = useState(false);
    const [raporForm, setRaporForm] = useState({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
    const [actionUploading, setActionUploading] = useState(false);
    const [editingAction, setEditingAction] = useState(null);

    // YENİ: Şirkete Borç Ödemesi için state'ler
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [debtForm, setDebtForm] = useState({ amount: '', month: nowMonth, note: '' });
    // Personelin güncel borcu (maas_yearly dokümanındaki borclanma alanından okunur)
    const [currentDebt, setCurrentDebt] = useState(0);

    // ========================================================================
    // YENİ: HASAR BORCU TAKİBİ
    // Değerler doğrudan personel kartından okunur (App.tsx hasar çözümünde
    // yazar, Finans.tsx Maaş Tablosu primden kestikçe kalanı azaltır):
    //   hasarToplam -> bugüne kadar yazılan toplam hasar payı
    //   hasarKalan  -> henüz primlerden kesilmemiş kalan borç
    //   hasarOdenen -> primlerden kesilerek kapatılmış kısım (toplam - kalan)
    // ========================================================================
    const [showHasarModal, setShowHasarModal] = useState(false);
    const hasarToplam = parseFloat(person?.hasarBorcuToplam) || 0;
    const hasarKalan = parseFloat(person?.hasarBorcuKalan) || 0;
    const hasarOdenen = Math.max(0, Math.round((hasarToplam - hasarKalan) * 100) / 100);

    // YENİ: Prim Ödeme Gir — Maaş Tablosu'ndaki prim (fazla mesai saati) alanına saat veya tutar girişi
    const [showPrimModal, setShowPrimModal] = useState(false);
    const [primForm, setPrimForm] = useState({ mode: 'tutar', value: '', month: nowMonth, note: '' });
    const [primSubmitting, setPrimSubmitting] = useState(false);

    // YENİ: Personel Giriş/Çıkış Belgeleri yükleme durumu
    const [belgeUploading, setBelgeUploading] = useState('');
    // YENİ: Giriş/Çıkış belge menüsünün açık olanı ('giris' | 'cikis' | '')
    const [belgeMenuOpen, setBelgeMenuOpen] = useState('');

    // YENİ: Giriş/Çıkış belgesi yükler ve personelin ÖZLÜK dosyasına (ozlukEkstra dizisi) ekler.
    // kind: 'giris' | 'cikis' → belge özlük dosyasında ilgili başlıkla görünür.
    const handleBelgeUpload = async (e, kind) => {
      const file = e.target.files[0];
      if (!file || !person) return;
      setBelgeUploading(kind);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        const label = kind === 'giris' ? 'Personel Giriş Belgesi' : 'Personel Çıkış Belgesi';
        const newBelge = { id: Date.now().toString(), label: `${label} (${new Date().toLocaleDateString('tr-TR')})`, url: uploadedUrl };
        // Özlük dosyasındaki ekstra belgeler dizisine ekle (Özlük Dosyaları ekranında da görünür)
        const updatedExtra = [...(person.ozlukEkstra || []), newBelge];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', person.id), { ozlukEkstra: updatedExtra });
        addSystemLog(kind === 'giris' ? 'Personel Giriş Belgesi Eklendi' : 'Personel Çıkış Belgesi Eklendi', `${person.fullName} personeline ${label} eklendi (özlük dosyasına işlendi).`);
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Belge yüklenemedi.");
      }
      setBelgeUploading('');
    };

    // YENİ: Otomatik özellik puanı hesaplaması için TÜM personelin üzerine, sadece bu kişiye
    // ait manuel Performans Değerlendirme düzeltmeleri Firestore'dan dinlenir.
    const autoSkillsMap = React.useMemo(() => computeAllAutoSkills(personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords), [personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords]);
    const autoSkills = autoSkillsMap[String(personId)] || {};
    const isManagerUser = currentUser?.rank === 'Müdür' || currentUser?.position === 'Firma Sahibi' || currentUser?.permissions?.canEdit;
    const [skillAdjustments, setSkillAdjustments] = useState([]);
    useEffect(() => {
      if (!personId || !db) return;
      // Özellikler bölümü kaldırıldığı için bu veriye artık gerek yok;
      // dinleyici hiç kurulmaz (gereksiz Firestore okuması yapılmaz).
      return;
      // eslint-disable-next-line no-unreachable
      const unsubAdj = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'personnelSkillAdjustments'), where('personnelId', '==', String(personId))), snap => {
        setSkillAdjustments(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      }, console.error);
      return () => unsubAdj();
    }, [personId, db, appId]);
    const skills = React.useMemo(() => {
      const merged = { ...autoSkills };
      skillAdjustments.forEach(adj => {
        const base = typeof merged[adj.skillKey] === 'number' ? merged[adj.skillKey] : 50;
        merged[adj.skillKey] = Math.max(0, Math.min(100, base + (parseFloat(adj.delta) || 0)));
      });
      return merged;
    }, [autoSkills, skillAdjustments]);

    const [showEvalModal, setShowEvalModal] = useState(false);
    const [evalForm, setEvalForm] = useState({ skillKey: '', delta: '', reason: '' });
    const handleSubmitEval = async (e) => {
      e.preventDefault();
      if (!evalForm.skillKey || !evalForm.delta || !evalForm.reason.trim()) {
        alert('Lütfen özellik, puan miktarı ve gerekçe alanlarını doldurun.');
        return;
      }
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelSkillAdjustments'), {
          personnelId: String(personId),
          skillKey: evalForm.skillKey,
          delta: parseFloat(evalForm.delta),
          reason: evalForm.reason.trim(),
          evaluatedBy: currentUser?.fullName || currentUser?.email || 'Yönetici',
          date: new Date().toISOString()
        });
        if (addSystemLog) addSystemLog('Performans Değerlendirmesi', `${person?.fullName} için ${evalForm.skillKey} özelliğine ${evalForm.delta > 0 ? '+' : ''}${evalForm.delta} puan verildi. Gerekçe: ${evalForm.reason.trim()}`);
        setEvalForm({ skillKey: '', delta: '', reason: '' });
        setShowEvalModal(false);
      } catch (err) {
        console.error('Performans değerlendirme hatası:', err);
        alert('Değerlendirme kaydedilirken bir hata oluştu.');
      }
    };

    useEffect(() => {
      if (!personId || !db) return;
      const unsub2 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'personnelClothing'), where('personnelId', '==', String(personId))), snap => {
        setClothingRecords(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      }, console.error);
      const unsub3 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'personnelPhones'), where('personnelId', '==', String(personId))), snap => {
        setPhoneRecords(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.date) - new Date(a.date)));
      }, console.error);
      const unsub4 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'personnelAnnualLeave'), where('personnelId', '==', String(personId))), snap => {
        setLeaveRecords(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)));
      }, console.error);
      // YENİ: Personel hareket işlemleri dinleyicisi
      const unsub5 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'personnelActions'), where('personnelId', '==', String(personId))), snap => {
        setPersonnelActions(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      }, console.error);
      // YENİ: Personelin güncel borcunu (maas_yearly/{yıl} → records[personId].borclanma) canlı dinle
      const debtYear = new Date().getFullYear().toString();
      const unsub6 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'maas_yearly', debtYear), snap => {
        if (snap.exists()) {
          const records = snap.data().records || {};
          setCurrentDebt(parseFloat(records[personId]?.borclanma) || 0);
        } else {
          setCurrentDebt(0);
        }
      }, console.error);
      return () => { unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
    }, [personId, db, appId]);

    // ========================================================================
    // YENİ: AYRILIŞ HAKEDİŞ — çıkış ayının maaş tablosu kaydını canlı dinle.
    // ÖNEMLİ: Bağımlılıklar SADECE İLKEL DEĞERLER (string/sayı) — dizi/nesne
    // referansı KULLANILMADI. Aksi halde personnelList gibi her snapshot'ta
    // yeni referans alan bir değere bağlanmak, bu dinleyicinin sürekli
    // yeniden kurulmasına ve Firestore okuma maliyetinin patlamasına yol
    // açardı (bkz. önceki okuma-patlaması düzeltmesi).
    // Bu effect de bileşenin erken "return"lerinden ÖNCE tanımlıdır.
    // ========================================================================
    const cikisDetayRef = personnelList.find(p => String(p.id) === String(personId))?.cikisHesapDetay;
    const cikisYil = cikisDetayRef?.year || null;
    const cikisAy = cikisDetayRef?.month || null;
    const cikisBeyazMi = (() => {
      const pRef = personnelList.find(p => String(p.id) === String(personId));
      if (!pRef) return false;
      return pRef.collarType === 'Beyaz Yaka' || (pRef.collarType !== 'Mavi Yaka' && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(pRef.position));
    })();
    useEffect(() => {
      if (!db || !personId || !cikisYil || !cikisAy) { setCikisAyiMaasRow({}); return; }
      const prefix = cikisBeyazMi ? 'beyaz_' : '';
      const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${prefix}${cikisYil}_${cikisAy}`), snap => {
        const records = snap.exists() ? (snap.data().records || {}) : {};
        setCikisAyiMaasRow(records[personId] || {});
      }, console.error);
      return () => unsub();
    }, [personId, db, appId, cikisYil, cikisAy, cikisBeyazMi]);

    // ======================================================================
    // HOOK SIRASI DÜZELTMESİ (React hata #310)
    // Aşağıdaki iki hook ESKİDEN "if (!person) return" satırından SONRA
    // çağrılıyordu. Personel listesi henüz yüklenmemişken profil açılırsa
    // hook sayısı render'lar arasında değişiyor ve React
    // "Rendered more hooks than during the previous render" hatası veriyordu.
    // Her iki hook da 'person' nesnesine ihtiyaç duymadığı için (biri yalnızca
    // personId, diğeri sabit bir yıl kullanıyor) koşullu return'ün ÖNÜNE alındı.
    // ======================================================================
    const [sahaDenetimleri, setSahaDenetimleri] = useState([]);
    // ======================================================================
    // OKUMA OPTİMİZASYONU (saha denetimleri)
    // ESKİ HALİ: onSnapshot ile limit(2000) — profil her açıldığında 2000'e
    // kadar denetim CANLI dinleniyordu; 19 kullanıcı için ciddi okuma yükü.
    // YENİ HALİ: canlı dinleyici YOK. Yalnızca bu personele ait kayıtlar
    // getDocs ile BİR KEZ okunur:
    //   1) Önce array-contains ile SUNUCU TARAFINDA filtreleme denenir
    //      (yeni kayıtlarda 'personelIdListesi' alanı bulunur) -> genelde
    //      sadece o kişinin 10-50 kaydı okunur.
    //   2) Bu alanı içermeyen ESKİ kayıtlar için, son 12 aylık pencerede
    //      sınırlı bir yedek okuma yapılır ve istemcide filtrelenir.
    // ======================================================================
    useEffect(() => {
      if (!personId || !db) return;
      let iptal = false; // Bileşen kapanırsa state güncellemesi yapılmaz
      (async () => {
        const kol = collection(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri');
        const birlestir = (liste) => {
          const harita = new Map();
          liste.forEach(d => harita.set(d.id, d));
          return [...harita.values()];
        };
        let sonuc = [];
        // 1) SUNUCU TARAFI FİLTRE (yeni kayıtlar)
        try {
          const snap = await getDocs(query(kol, where('personelIdListesi', 'array-contains', String(personId)), limit(200)));
          sonuc = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { /* Alan/indeks yoksa yedek yola geçilir */ }

        // 2) YEDEK: eski kayıtlar için son 12 ay penceresi (sınırlı okuma)
        try {
          const oniki = new Date();
          oniki.setMonth(oniki.getMonth() - 12);
          const snapEski = await getDocs(query(
            kol,
            where('denetimTarihi', '>=', oniki.toISOString()),
            orderBy('denetimTarihi', 'desc'),
            limit(300)
          ));
          const eskiler = snapEski.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(dn => (dn.personelPuanlari || []).some(pp => String(pp.personelId) === String(personId)));
          sonuc = birlestir([...sonuc, ...eskiler]);
        } catch (e) { console.warn('Saha denetimi yedek okuması yapılamadı:', e); }

        if (!iptal) setSahaDenetimleri(sonuc);
      })();
      return () => { iptal = true; }; // Cleanup
    }, [personId, db, appId]);

    // DÜZELTME (TDZ çökmesi): 'currentYear' bu satırdan SONRA (aşağıda)
    // tanımlandığı için burada kullanılamazdı; profil sayfası açılır açılmaz
    // "Cannot access 'currentYear' before initialization" hatası veriyordu.
    // Değer doğrudan hesaplanarak bağımlılık kaldırıldı.
    const [selectedLeaveYear, setSelectedLeaveYear] = useState(() => String(new Date().getFullYear()));

    if (!person) {
      return (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center animate-in fade-in">
          <button onClick={onBack} className="mb-4 text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Listeye Geri Dön
          </button>
          <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">Personel bulunamadı.</p>
        </div>
      );
    }

    const getPeriodRange = () => {
      const now = new Date();
      if (periodFilter === 'week') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const start = new Date(now); start.setDate(now.getDate() - diffToMonday); start.setHours(0, 0, 0, 0);
        return { start, end: null };
      }
      if (periodFilter === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
      if (periodFilter === 'lastMonth') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start, end };
      }
      if (periodFilter === 'year') return { start: new Date(now.getFullYear(), 0, 1), end: null };
      return { start: null, end: null };
    };
    const { start: periodStart, end: periodEnd } = getPeriodRange();

    // YENİ: Seçili döneme ait puantaj aylık doküman(lar)ından bu personelin toplam puanını oku.
    // Mavi Yaka Puantaj tablosu ile aynı kaynak: puantaj/{yıl}_{ay} → records[personId] gün değerleri toplamı.
    useEffect(() => {
      let cancelled = false;
      const fetchPuantajPoints = async () => {
        if (!person?.id) { setPuantajPointsTotal(null); return; }
        const now = new Date();
        let months = []; // okunacak [yıl, ay(1-12)] listesi
        if (periodFilter === 'lastMonth') {
          const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          months = [[d.getFullYear(), d.getMonth() + 1]];
        } else if (periodFilter === 'year') {
          for (let m = 0; m <= now.getMonth(); m++) months.push([now.getFullYear(), m + 1]);
        } else if (periodFilter === 'all') {
          for (let i = 0; i < 24; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push([d.getFullYear(), d.getMonth() + 1]); }
        } else {
          months = [[now.getFullYear(), now.getMonth() + 1]]; // week / month → içinde bulunulan ay
        }
        let total = 0;
        for (const [y, m] of months) {
          try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${y}_${m}`));
            if (snap.exists()) {
              const recs = (snap.data().records || {})[person.id] || {};
              Object.values(recs).forEach(v => { const n = parseFloat(v); if (!isNaN(n)) total += n; });
            }
          } catch (e) { /* doküman yoksa atla */ }
        }
        if (!cancelled) setPuantajPointsTotal(total);
      };
      fetchPuantajPoints();
      return () => { cancelled = true; };
    }, [person?.id, periodFilter, db, appId]);

    const personJobs = jobs.filter(j => (j.assignedPersonnelIds || []).includes(person.id) || j.assignedPersonnelId === person.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const periodJobs = personJobs.filter(j => {
      const d = new Date(j.date);
      if (periodStart && d < periodStart) return false;
      if (periodEnd && d > periodEnd) return false;
      return true;
    });
    const periodJobsCount = periodJobs.length;
    const periodReviewsCount = periodJobs.filter(j => j.pointsApproved && j.reviewImage).length;
    // YENİ: "Alınan Yorum" değeri artık Mavi Yaka Puantaj'daki YORUM PUANI ile birebir aynı hesaplanır.
    // Puantaja işlenen puan = onaylanan işteki kişiye verilen puan (approvedPoints) + destek personeli ise 0.5.
    const periodYorumPuani = periodJobs.reduce((sum, j) => {
      if (!j.pointsApproved) return sum;
      let s = parseFloat(j.approvedPoints?.[person.id] || 0);
      if ((j.supportPersonnelIds || []).map(String).includes(String(person.id))) s += 0.5;
      return sum + s;
    }, 0);
    // YENİ: Bu personelin ekibine yazılmış (hasar var) işlerin dönem içi sayısı ve son hasarlı işler listesi
    const periodDamagesCount = periodJobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').length;
    const recentDamagedJobs = personJobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').slice(0, 5);

    // ======================================================================
    // YENİ: SAHA PUANI — Şeflerin "Şef Denetimi" ekranından bu personele verdiği
    // 1-5 arası puanların ortalaması. Hiç puan verilmemişse her zaman 0 gösterilir.
    // ======================================================================


    // Bu personele ait puan satırlarını denetim kaydıyla birlikte döndürür
    const sahaPuanKayitlari = sahaDenetimleri.map(dn => {
      const pp = (dn.personelPuanlari || []).find(x => String(x.personelId) === String(personId));
      return { denetim: dn, puan: parseInt(pp?.puan) || 0, ozelNot: pp?.ozelNot || '' };
    }).filter(x => x.puan > 0);

    // Dönem filtresine göre saha puanı ortalaması (puan yoksa 0)
    const sahaPuanDonem = sahaPuanKayitlari.filter(x => {
      const d = x.denetim.jobDate ? new Date(x.denetim.jobDate) : null;
      if (!d) return false;
      if (periodStart && d < periodStart) return false;
      if (periodEnd && d > periodEnd) return false;
      return true;
    });
    const sahaPuanOrtalamasi = sahaPuanDonem.length > 0
      ? Math.round((sahaPuanDonem.reduce((t, x) => t + x.puan, 0) / sahaPuanDonem.length) * 10) / 10
      : 0;

    // ========================================================================
    // YENİ (kullanıcı talebi): "OPERASYON" POZİSYONU İÇİN PERFORMANS ÖZETİ
    // ------------------------------------------------------------------------
    // Operasyon pozisyonundaki personel bizzat bir işe EKİP ÜYESİ olarak
    // atanmaz — koordinatördür. Bu yüzden bu personelin profilinde üstteki
    // 4 kart (Yapılan İş / Alınan Yorum / Hasarlı İş / Saha Puanı) KİŞİSEL
    // değil, ŞİRKET GENELİ rakamlar gösterir. Diğer tüm pozisyonlarda (Mavi/
    // Beyaz Yaka ekip üyeleri) eski davranış AYNEN korunur — bu blok sadece
    // isOperasyonPozisyonu true iken devreye girer, aksi halde hiç çalışmaz.
    // Seçili dönem filtresi (Bu Hafta/Bu Ay/Geçen Ay/Bu Sene/Tüm Zamanlar)
    // buradaki hesaplarda da AYNEN uygulanır (periodStart/periodEnd).
    // ========================================================================
    const isOperasyonPozisyonu = person?.position === 'Operasyon';

    // Şirket genelindeki TÜM Nakliye+Depo işleri (Asansör hariç — sistemdeki
    // "nakliyeVeyaDepo" kuralıyla birebir aynı: tip belirtilmemişse Nakliye sayılır)
    const tumNakliyeDepoIsleriDonem = isOperasyonPozisyonu ? jobs.filter(j => {
      const nakliyeVeyaDepo = j.type === 'Depo' || j.type === 'Nakliye' || !j.type;
      if (!nakliyeVeyaDepo) return false;
      const d = new Date(j.date);
      if (periodStart && d < periodStart) return false;
      if (periodEnd && d > periodEnd) return false;
      return true;
    }) : [];

    // "Yapılan İş" (Operasyon): tamamlanan iş sayısı — iptal edilenler zaten
    // status !== 'completed' olduğu için otomatik hariç kalır.
    const operasyonYapilanIsSayisi = tumNakliyeDepoIsleriDonem.filter(j => j.status === 'completed').length;

    // "Alınan Yorum" (Operasyon): puan TOPLAMI değil, tüm ekiplerin aldığı
    // yorum/değerlendirme SAYISI (kaç işe yorum/puan onaylandığı).
    const operasyonAlinanYorumSayisi = tumNakliyeDepoIsleriDonem.filter(j => j.pointsApproved && j.reviewImage).length;

    // "Hasarlı İş" (Operasyon): tüm ekiplerin toplam hasarlı iş sayısı
    const operasyonHasarliIsSayisi = tumNakliyeDepoIsleriDonem.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').length;

    // "Saha Puanı" (Operasyon): ortalama puan yerine TOPLAM SAHA DENETİMİ sayısı
    // (şirket geneli, seçili döneme göre — kimin denetlendiğinden bağımsız).
    const operasyonSahaDenetimSayisi = isOperasyonPozisyonu ? sahaDenetimleri.filter(dn => {
      const d = dn.jobDate ? new Date(dn.jobDate) : (dn.denetimTarihi ? new Date(dn.denetimTarihi) : null);
      if (!d) return false;
      if (periodStart && d < periodStart) return false;
      if (periodEnd && d > periodEnd) return false;
      return true;
    }).length : 0;

    const recentJobs = personJobs.slice(0, 5);
    const recentReviewedJobs = personJobs.filter(j => j.pointsApproved && j.reviewImage).slice(0, 5);

    // YENİ: Seçili döneme göre mesai tabanlı sayaçlar (Fazla Mesai / Devamsızlık / Rapor / İzin)
    const personMesaiForPeriod = (allMesaiRecords || []).filter(m => {
      if (String(m.personId) !== String(person.id)) return false;
      const d = new Date(m.year, m.month - 1, m.day);
      if (periodStart && d < periodStart) return false;
      if (periodEnd && d > periodEnd) return false;
      return true;
    });
    // ========================================================================
    // DEĞİŞTİ (kullanıcı talebi): "Fazla Mesai" kartı artık gün SAYISI değil,
    // Personel Muhasebe (Finans) ekranındaki "toplam fazla mesai saati" ile
    // BİREBİR AYNI mantıkla hesaplanan SAAT TOPLAMIdır: FM ve FGM saatleri
    // toplanır, EM (eksik mesai) saatleri çıkarılır.
    // HATA DÜZELTMESİ: m.hours değeri virgüllü saklanan saatlerden (örn. "4,5")
    // App.jsx'te parseFloat() ile üretiliyordu; parseFloat virgülü ondalık
    // ayıracı saymadığı için "4,5" -> 4 gibi HATALI kesiliyordu (App.jsx'teki
    // kaynak da ayrıca düzeltildi). Burada ek güvence olarak aynı çevrim
    // tekrar güvenli şekilde uygulanır.
    // ========================================================================
    const saatMetniSayiyaCevirLokal = (deger) => {
      if (deger === null || deger === undefined || deger === '') return 0;
      const n = parseFloat(String(deger).replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };
    const periodFazlaMesaiSaati = personMesaiForPeriod.reduce((toplam, m) => {
      if (m.code === 'FM' || m.code === 'FGM') return toplam + saatMetniSayiyaCevirLokal(m.hours);
      if (m.code === 'EM') return toplam - saatMetniSayiyaCevirLokal(m.hours);
      return toplam;
    }, 0);
    // Ekranda: tam sayıysa düz ("8"), değilse virgüllü ("4,5") gösterilir
    const periodFazlaMesaiSayisi = periodFazlaMesaiSaati % 1 === 0 ? periodFazlaMesaiSaati : periodFazlaMesaiSaati.toFixed(1).replace('.', ',');
    // YENİ: Sadece "Fazla Gün" (FG) sayısı
    const periodFazlaGunSayisi = personMesaiForPeriod.filter(m => m.code === 'FG').length;
    // YENİ: "Fazla Gün + Mesai" toplamı — hem tam fazla gün (FG) hem fazla gün+mesai (FGM) birlikte
    const periodFazlaGunMesaiSayisi = personMesaiForPeriod.filter(m => m.code === 'FG' || m.code === 'FGM').length;

    // YENİ: PERSONEL HAREKET AKIŞI — Maaş hareketleri + Mesai/Devamsızlık/İzin + Yorum/Puan kayıtlarını tek listede birleştir.
    // Aylık filtrelenir (hareketMonth), tarihe göre yeniden eskiye sıralanır, ilk 5 gösterilir (tümünü gör ile hepsi).
    const mesaiKodEtiket = {
      FG: { label: 'Fazla Gün', bg: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-600', icon: <Clock className="w-4 h-4 text-white" /> },
      FGM: { label: 'Fazla Gün (Mesai)', bg: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-600', icon: <Clock className="w-4 h-4 text-white" /> },
      FM: { label: 'Fazla Mesai', bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-600', icon: <Clock className="w-4 h-4 text-white" /> },
      D: { label: 'Devamsızlık', bg: 'bg-red-50 border-red-200', badge: 'bg-red-600', icon: <Ban className="w-4 h-4 text-white" /> },
      R: { label: 'Raporlu', bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500', icon: <PlusCircle className="w-4 h-4 text-white" /> },
      'Üİ': { label: 'Ücretsiz İzin', bg: 'bg-neutral-100 border-neutral-300', badge: 'bg-neutral-700', icon: <CalendarDays className="w-4 h-4 text-white" /> },
      'Yİ': { label: 'Yıllık İzin', bg: 'bg-purple-50 border-purple-200', badge: 'bg-purple-600', icon: <CalendarDays className="w-4 h-4 text-white" /> },
      'Bİ': { label: 'Bayram İzni', bg: 'bg-pink-50 border-pink-200', badge: 'bg-pink-600', icon: <CalendarDays className="w-4 h-4 text-white" /> },
      'Hİ': { label: 'Haftalık İzin', bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-600', icon: <CalendarDays className="w-4 h-4 text-white" /> },
    };
    const pad2 = n => String(n).padStart(2, '0');
    const birlesikHareketler = [
      // 1) Maaş hareketleri (avans, onay, tutanak, rapor, borç) — silme/görüntüleme düğmeleri korunur
      ...personnelActions.map(a => {
        const dstr = a.date || (a.month ? `${a.month}-01` : null);
        return {
          key: 'act-' + a.id, kaynak: 'action', raw: a,
          dateObj: dstr ? new Date(dstr) : null,
          monthStr: a.month || (a.date ? a.date.substring(0, 7) : ''),
          dateStr: a.date || (a.month ? `Dönem: ${a.month}` : ''),
          title: a.title, amount: a.amount, note: a.note, endDate: a.endDate, month: a.month,
          type: a.type, fileUrl: a.fileUrl,
        };
      }),
      // 2) Mesai / Devamsızlık / İzin kayıtları (allMesaiRecords)
      ...(allMesaiRecords || []).filter(m => String(m.personId) === String(person.id) && mesaiKodEtiket[m.code]).map(m => {
        const et = mesaiKodEtiket[m.code];
        return {
          key: 'mes-' + (m.id || `${m.year}-${m.month}-${m.day}-${m.code}`), kaynak: 'mesai',
          dateObj: new Date(m.year, m.month - 1, m.day),
          monthStr: `${m.year}-${pad2(m.month)}`,
          dateStr: `${pad2(m.day)}.${pad2(m.month)}.${m.year}`,
          title: et.label, styleBg: et.bg, styleBadge: et.badge, icon: et.icon,
        };
      }),
      // 3) Yorum / Puan alınan işler (puanı onaylı + yorum görseli olan işler)
      ...personJobs.filter(j => j.pointsApproved && j.reviewImage && j.date).map(j => ({
        key: 'yor-' + j.id, kaynak: 'yorum',
        dateObj: new Date(j.date),
        monthStr: (j.date || '').substring(0, 7),
        dateStr: j.date,
        title: `Yorum / Puan Alındı — ${j.customerName || 'Müşteri'}`,
      })),
      // 4) YENİ: Şef saha denetimleri — verilen puan ve şefin özel notu hareket akışında görünür
      ...sahaPuanKayitlari.filter(x => x.denetim.jobDate).map(x => ({
        key: 'saha-' + x.denetim.id, kaynak: 'saha',
        dateObj: new Date(x.denetim.jobDate),
        monthStr: (x.denetim.jobDate || '').substring(0, 7),
        dateStr: x.denetim.jobDate,
        title: `Saha Denetimi — ${x.puan}/5 puan (${x.denetim.jobCustomerName || 'İş'})`,
        note: [x.ozelNot ? `Şef notu: ${x.ozelNot}` : '', `Denetleyen: ${x.denetim.sefAdi || '-'}`].filter(Boolean).join(' • '),
        styleBg: 'bg-purple-50 border-purple-200',
        styleBadge: 'bg-purple-600',
        icon: 'clipboard',
      })),
    ]
      .filter(h => h.monthStr === hareketMonth)          // Seçili aya göre filtrele
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0)); // Yeniden eskiye

    const gorunenHareketler = showAllHareket ? birlesikHareketler : birlesikHareketler.slice(0, 5);
    // Seçili ay etiketi (örn. "Temmuz 2026")
    const hareketAyEtiketi = (() => {
      const aylarTR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const [hy, hm] = hareketMonth.split('-');
      return `${aylarTR[parseInt(hm) - 1]} ${hy}`;
    })();
    const periodRaporGunSayisi = personMesaiForPeriod.filter(m => m.code === 'R').length;
    const periodDevamsizlikSayisi = personMesaiForPeriod.filter(m => m.code === 'D').length;
    // DEĞİŞTİ (kullanıcı talebi): Personel Muhasebe ekranıyla (Finans.jsx)
    // BİREBİR AYNI koda entegre edildi. Finans tarafında "Ücretsiz İzin"
    // hem 'Üİ' HEM 'İB' (İşi Bıraktı) kodunu kapsıyordu — burada sadece 'Üİ'
    // sayılıyordu, 'İB' eksikti. Artık ikisi de sayılıyor.
    const periodUcretsizIzinSayisi = personMesaiForPeriod.filter(m => m.code === 'Üİ' || m.code === 'İB').length;
    // DEĞİŞTİ: "Ücretli İzin" artık TÜM ücretli izin türlerini kapsıyor:
    // Yıllık İzin (Yİ), Bayram İzni (Bİ), Haftalık İzin (Hİ). Öncesinde
    // yalnızca Yıllık İzin (Yİ) sayılıyordu; Bayram/Haftalık izin kodları
    // hiç sayaca yansımıyordu.
    const periodUcretliIzinSayisi = personMesaiForPeriod.filter(m => ['Yİ', 'Bİ', 'Hİ'].includes(m.code)).length;

    // YENİ: Özellikler bölümü sadece Mavi Yaka'da gösterilir; Temizlik Görevlisi ve
    // Asansör Operatörü hariç.
    const isMaviYakaPerson = person && (person.collarType === 'Mavi Yaka' || (!person.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Operatör'].includes(person.position)));
    const skillsHiddenPositions = ['Temizlik Görevlisi', 'Operatör'];
    // KULLANICI İSTEĞİ (15.08.2026): "Özellikler" bölümü kaldırıldı — hiç
    // yapılmamış gibi. Panel, "Personeli Değerlendir" butonu ve modalı hiçbir
    // personelde gösterilmez. (Eski hesap kodu zararsız şekilde dosyada durur.)
    const showSkillsSection = false;
    const visibleSkillDefs = PERSONNEL_SKILL_DEFS.filter(s => isSkillVisibleForPerson(s, person));
    const avgSkill = visibleSkillDefs.length > 0
      ? Math.round(visibleSkillDefs.reduce((sum, s) => sum + (typeof skills[s.key] === 'number' ? skills[s.key] : 50), 0) / visibleSkillDefs.length)
      : 0;

    const handleAddClothing = async (e) => {
      e.preventDefault();
      if (!clothingForm.item) return;
      if (editingClothingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelClothing', editingClothingId), { ...clothingForm });
        if (addSystemLog) addSystemLog('Kıyafet Kaydı Güncellendi', `${person.fullName} personelinin ${clothingForm.item} kaydı güncellendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelClothing'), { personnelId: String(personId), ...clothingForm, createdAt: new Date().toISOString() });
        if (addSystemLog) addSystemLog('Kıyafet Verildi', `${person.fullName} personeline ${clothingForm.item} verildi.`);
      }
      setClothingForm({ item: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
      setEditingClothingId(null);
      setShowClothingModal(false);
    };

    // YENİ: Kıyafet/Ekipman belgesini yükleme (Şimdi Çek / Galeriden / Dosyadan)
    const handleClothingFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setClothingUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setClothingForm(prev => ({ ...prev, fileUrl: uploadedUrl }));

        // YENİ: İmzalı zimmet tutanağı, aynı anda Özlük Dosyaları > Fazladan
        // Belgeler altına da otomatik olarak kaydedilir; her yükleme yeni bir
        // kayıt olarak eklenir (öncekiler silinmez), böylece geçmiş tüm
        // tutanaklar Özlük Dosyaları'ndan da görülebilir.
        const etiket = `Kıyafet Zimmet Tutanağı - ${clothingForm.item || 'Kıyafet'} (${clothingForm.date || new Date().toISOString().split('T')[0]})`;
        const yeniOzlukKaydi = { id: Date.now().toString(), label: etiket, url: uploadedUrl };
        const guncelOzlukEkstra = [...(person.ozlukEkstra || []), yeniOzlukKaydi];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', person.id), { ozlukEkstra: guncelOzlukEkstra });
        addSystemLog?.('Zimmet Tutanağı Kaydedildi', `${person.fullName} personeline ait "${etiket}" belgesi Özlük Dosyaları'na eklendi.`);
      } catch (err) {
        console.error('Belge yükleme hatası:', err);
        alert('Belge yüklenemedi.');
      }
      setClothingUploading(false);
    };

    // YENİ: Personel Kıyafet ve Donanım Zimmet Sözleşmesi ve Teslim Tutanağı PDF'i — personel profiline göre otomatik dolar
    const generateClothingContractPDF = () => {
      const printWindow = window.open('', '_blank');
      const today = new Date();
      const gun = clothingForm.date ? clothingForm.date.split('-')[2] : today.getDate().toString().padStart(2, '0');
      const ay = clothingForm.date ? clothingForm.date.split('-')[1] : (today.getMonth() + 1).toString().padStart(2, '0');
      const yil = clothingForm.date ? clothingForm.date.split('-')[0] : today.getFullYear().toString();

      const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${person.fullName} - Kıyafet Zimmet Sözleşmesi</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; font-size: 11px; }
          .page { width: 210mm; min-height: 297mm; background: white; padding: 12mm 15mm; margin: 10mm auto; box-shadow: 0 0 10px rgba(0,0,0,0.5); position: relative; }
          @media print {
            @page { margin: 0 !important; }
            body { background: white; margin: 0; -webkit-print-color-adjust: exact; }
            .page { margin: 0; padding: 12mm 15mm; box-shadow: none; border: none; }
          }
          .header { text-align: center; border-bottom: 2px solid #d32f2f; padding-bottom: 8px; margin-bottom: 14px; display: flex; flex-direction: column; align-items: center; }
          .logo-img { height: 44px; margin-bottom: 4px; object-fit: contain; }
          .subtitle { font-size: 11px; color: #333; font-weight: bold; margin-bottom: 3px; letter-spacing: 1px; }
          .contact-info { font-size: 9px; color: #555; line-height: 1.2; }
          .main-title { font-size: 13px; font-weight: bold; text-align: center; margin: 10px 0 16px; padding: 8px; background: #f0f0f0; border: 1px solid #ccc; text-transform: uppercase; line-height: 1.4; }
          .section-title { font-weight: bold; font-size: 12px; color: #d32f2f; margin-top: 14px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
          th { background: #f0f0f0; padding: 6px; border: 1px solid #ccc; text-align: left; font-size: 11px; color: #d32f2f; }
          td { padding: 6px 8px; border: 1px solid #ccc; vertical-align: top; }
          .label { font-weight: bold; width: 32%; background: #fafafa; }
          .paragraph { font-size: 10.5px; line-height: 1.55; text-align: justify; margin-bottom: 10px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sign-box { width: 45%; font-size: 10.5px; text-align: center; }
          .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img src="https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" onerror="this.style.display='none'" />
            <div class="subtitle">EVDEN EVE - ASANSÖRLÜ TAŞIMA - DEPOLAMA</div>
            <div class="contact-info">Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL | Tel: (0216) 390 89 99</div>
          </div>

          <div class="main-title">PERSONEL KIYAFET VE DONANIM ZİMMET SÖZLEŞMESİ VE TESLİM TUTANAĞI</div>

          <div class="section-title">1. PERSONEL BİLGİLERİ</div>
          <table>
            <tr><td class="label">Adı ve Soyadı</td><td>${person.fullName || ''}</td></tr>
            <tr><td class="label">T.C. Kimlik No</td><td>${person.tcNo || ''}</td></tr>
            <tr><td class="label">Görevi / Unvanı</td><td>${person.position || ''}${person.rank ? ' / ' + person.rank : ''}</td></tr>
            <tr><td class="label">Veriliş Tarihi</td><td>${gun} / ${ay} / ${yil}</td></tr>
            <tr><td class="label">İletişim Numarası</td><td>${person.personalPhone || person.companyPhone || ''}</td></tr>
          </table>

          <div class="section-title">2. TESLİM EDİLEN MALZEMELER</div>
          <div class="paragraph">
            Aşağıda cinsi, miktarı ve bedeni/numarası belirtilen iş kıyafetleri ile koruyucu donanımlar, Sembol Nakliyat yetkilileri tarafından aşağıda imzası bulunan personele eksiksiz, yeni, hasarsız ve kullanıma uygun durumda elden teslim edilmiştir.
          </div>
          <table>
            <tr><th>Kıyafet / Ekipman</th><th>Tarih</th><th>Not</th></tr>
            <tr>
              <td>${clothingForm.item || ''}</td>
              <td>${clothingForm.date || ''}</td>
              <td>${clothingForm.note || '-'}</td>
            </tr>
          </table>

          <div class="paragraph" style="margin-top:14px;">
            Personel, yukarıda belirtilen kıyafet ve donanımı teslim aldığını, bunları özenle kullanacağını, iş bu zimmetin kendisine ait olduğunu, işten ayrılması veya şirket tarafından talep edilmesi halinde eksiksiz ve kullanılabilir durumda iade edeceğini kabul ve beyan eder.
          </div>

          <div class="signatures">
            <div class="sign-box">
              <div class="sign-line">Teslim Eden (Şirket Yetkilisi)</div>
            </div>
            <div class="sign-box">
              <div class="sign-line">Teslim Alan (${person.fullName || ''})</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    };

    const handleAddPhone = async (e) => {
      e.preventDefault();
      if (!phoneForm.model) return;
      if (editingPhoneId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelPhones', editingPhoneId), { ...phoneForm });
        if (addSystemLog) addSystemLog('Telefon Kaydı Güncellendi', `${person.fullName} personelinin ${phoneForm.model} kaydı güncellendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelPhones'), { personnelId: String(personId), ...phoneForm, createdAt: new Date().toISOString() });
        if (addSystemLog) addSystemLog('Telefon Verildi', `${person.fullName} personeline ${phoneForm.model} telefon verildi.`);
      }
      setPhoneForm({ model: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
      setEditingPhoneId(null);
      setShowPhoneModal(false);
    };

    // YENİ: Telefon/GSM zimmet belgesini yükleme (Şimdi Çek / Galeriden / Dosyadan)
    const handlePhoneFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setPhoneUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setPhoneForm(prev => ({ ...prev, fileUrl: uploadedUrl }));

        // YENİ: İmzalı zimmet tutanağı, aynı anda Özlük Dosyaları > Fazladan
        // Belgeler altına da otomatik olarak kaydedilir; her yükleme yeni bir
        // kayıt olarak eklenir (öncekiler silinmez).
        const etiket = `Telefon Zimmet Tutanağı - ${phoneForm.model || 'Telefon'} (${phoneForm.date || new Date().toISOString().split('T')[0]})`;
        const yeniOzlukKaydi = { id: Date.now().toString(), label: etiket, url: uploadedUrl };
        const guncelOzlukEkstra = [...(person.ozlukEkstra || []), yeniOzlukKaydi];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', person.id), { ozlukEkstra: guncelOzlukEkstra });
        addSystemLog?.('Zimmet Tutanağı Kaydedildi', `${person.fullName} personeline ait "${etiket}" belgesi Özlük Dosyaları'na eklendi.`);
      } catch (err) {
        console.error('Belge yükleme hatası:', err);
        alert('Belge yüklenemedi.');
      }
      setPhoneUploading(false);
    };

    // YENİ: Şirket Telefonu ve GSM Hattı Zimmet Sözleşmesi ve Teslim Tutanağı PDF'i — personel profiline göre otomatik dolar
    const generatePhoneContractPDF = () => {
      const printWindow = window.open('', '_blank');
      const start = person.startDate ? person.startDate.split('-') : null;
      const gun = start ? start[2] : '.....';
      const ay = start ? start[1] : '.....';
      const yil = start ? start[0] : '202...';

      const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${person.fullName} - Telefon Zimmet Sözleşmesi</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; font-size: 11px; }
          .page { width: 210mm; min-height: 297mm; background: white; padding: 12mm 15mm; margin: 10mm auto; box-shadow: 0 0 10px rgba(0,0,0,0.5); position: relative; }
          @media print {
            @page { margin: 0 !important; }
            body { background: white; margin: 0; -webkit-print-color-adjust: exact; }
            .page { margin: 0; padding: 12mm 15mm; box-shadow: none; border: none; }
          }
          .header { text-align: center; border-bottom: 2px solid #d32f2f; padding-bottom: 8px; margin-bottom: 14px; display: flex; flex-direction: column; align-items: center; }
          .logo-img { height: 44px; margin-bottom: 4px; object-fit: contain; }
          .subtitle { font-size: 11px; color: #333; font-weight: bold; margin-bottom: 3px; letter-spacing: 1px; }
          .contact-info { font-size: 9px; color: #555; line-height: 1.2; }
          .main-title { font-size: 13px; font-weight: bold; text-align: center; margin: 10px 0 16px; padding: 8px; background: #f0f0f0; border: 1px solid #ccc; text-transform: uppercase; line-height: 1.4; }
          .section-title { font-weight: bold; font-size: 12px; color: #d32f2f; margin-top: 14px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
          th { background: #f0f0f0; padding: 6px; border: 1px solid #ccc; text-align: left; font-size: 11px; color: #d32f2f; }
          td { padding: 6px 8px; border: 1px solid #ccc; vertical-align: top; }
          .label { font-weight: bold; width: 32%; background: #fafafa; }
          .paragraph { font-size: 10.5px; line-height: 1.55; text-align: justify; margin-bottom: 10px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sign-box { width: 45%; font-size: 10.5px; text-align: center; }
          .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img src="https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" onerror="this.style.display='none'" />
            <div class="subtitle">EVDEN EVE - ASANSÖRLÜ TAŞIMA - DEPOLAMA</div>
            <div class="contact-info">Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL | Tel: (0216) 390 89 99</div>
          </div>

          <div class="main-title">ŞİRKET TELEFONU VE GSM HATTI ZİMMET SÖZLEŞMESİ VE TESLİM TUTANAĞI</div>

          <div class="section-title">1. PERSONEL BİLGİLERİ</div>
          <table>
            <tr><td class="label">Adı ve Soyadı</td><td>${person.fullName || ''}</td></tr>
            <tr><td class="label">T.C. Kimlik No</td><td>${person.tcNo || ''}</td></tr>
            <tr><td class="label">Görevi / Unvanı</td><td>${person.position || ''}${person.rank ? ' / ' + person.rank : ''}</td></tr>
            <tr><td class="label">İşe Başlama Tarihi</td><td>${gun} / ${ay} / ${yil}</td></tr>
          </table>

          <div class="section-title">2. TESLİM EDİLEN CİHAZ VE HAT BİLGİLERİ</div>
          <div class="paragraph">
            Sembol Nakliyat tarafından, şirket işlerinin yürütülmesi amacıyla aşağıda özellikleri belirtilen mobil cihaz (cep telefonu), aksesuarları ve GSM hattı (SIM kart), aşağıda imzası bulunan personele çalışır, hasarsız ve eksiksiz durumda elden teslim edilmiştir.
          </div>
          <table>
            <tr><th>Cihaz / Model</th><th>Teslim Tarihi</th><th>Hat / Not</th></tr>
            <tr>
              <td>${phoneForm.model || ''}</td>
              <td>${phoneForm.date || ''}</td>
              <td>${phoneForm.note || person.companyPhone || '-'}</td>
            </tr>
          </table>

          <div class="paragraph" style="margin-top:14px;">
            Personel, yukarıda belirtilen cihaz ve hattı teslim aldığını, bunları özenle ve yalnızca iş amaçlı kullanacağını, işten ayrılması veya şirket tarafından talep edilmesi halinde eksiksiz ve çalışır durumda iade edeceğini kabul ve beyan eder.
          </div>

          <div class="signatures">
            <div class="sign-box">
              <div class="sign-line">Teslim Eden (Şirket Yetkilisi)</div>
            </div>
            <div class="sign-box">
              <div class="sign-line">Teslim Alan (${person.fullName || ''})</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    };

    const handleAddLeave = async (e) => {
      e.preventDefault();
      if (!leaveForm.startDate || !leaveForm.endDate) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelAnnualLeave'), { personnelId: String(personId), ...leaveForm, createdAt: new Date().toISOString() });
      if (addSystemLog) addSystemLog('Yıllık İzin Kaydedildi', `${person.fullName} personeline yıllık izin kaydı eklendi (${leaveForm.startDate} - ${leaveForm.endDate}).`);
      setLeaveForm({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], days: '', note: '' });
      setShowLeaveModal(false);
    };

    // ========================================================================
    // YENİ: İŞE TEKRAR BAŞLATMA (iki seçenekli)
    //
    // SEÇENEK A — "Yeni giriş gibi başlat" (mod: 'yeni')
    //   Personel yeni işe alınmış gibi devam eder. İşe başlama tarihi seçilen
    //   tarih olur, ayrılış bilgileri geçmişe not olarak taşınır. Aradaki boşluk
    //   günlerine HİÇBİR ŞEY yazılmaz (personel o dönemde şirkette değildi).
    //
    // SEÇENEK B — "Hiç ayrılmamış gibi devam et" (mod: 'kesintisiz')
    //   İlk işe başlama tarihi KORUNUR (kıdem devam eder). Ayrılış ile dönüş
    //   arasındaki günler seçilen kodla (Ücretsiz İzin / Devamsız) doldurulur.
    //
    // Her iki seçenekte de ayrılışta yazılan "İB" kayıtları temizlenir ve
    // personel yeniden Aktif yapılır.
    // ========================================================================
    const handleRestartPersonnel = async (e) => {
      e.preventDefault();
      if (!restartForm.date || restartKaydediliyor) return;
      setRestartKaydediliyor(true);

      const ayrilisStr = person.resignationDate;
      const donusStr = restartForm.date;
      if (ayrilisStr && new Date(donusStr) < new Date(ayrilisStr)) {
        alert('Dönüş tarihi, ayrılış tarihinden önce olamaz.');
        setRestartKaydediliyor(false);
        return;
      }

      const isBeyazYaka = person.collarType === 'Beyaz Yaka' || (person.collarType !== 'Mavi Yaka' && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(person.position));
      const docPrefix = isBeyazYaka ? 'beyaz_' : '';

      // Ayrılış ile dönüş arasındaki AY belgelerinde gün gün işlem yapar.
      // mod='yeni'      -> aradaki günler TEMİZLENİR (İB kayıtları silinir)
      // mod='kesintisiz'-> aradaki günlere seçilen kod (Üİ / D) yazılır
      const araGunleriDuzenle = async () => {
        if (!ayrilisStr) return;
        const bas = new Date(ayrilisStr);
        const bit = new Date(donusStr);
        // Ay ay ilerle
        const imlec = new Date(bas.getFullYear(), bas.getMonth(), 1);
        while (imlec <= bit) {
          const y = imlec.getFullYear(), m = imlec.getMonth() + 1;
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${y}_${m}`);
          try {
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const records = snap.data().records || {};
              if (records[personId]) {
                const sonGun = new Date(y, m, 0).getDate();
                for (let g = 1; g <= sonGun; g++) {
                  const gunTarih = new Date(y, m - 1, g);
                  // Yalnızca ayrılış SONRASI ve dönüş ÖNCESİ günlere dokun
                  if (gunTarih <= bas || gunTarih >= bit) continue;
                  if (restartForm.mod === 'kesintisiz') {
                    records[personId][g] = { status: restartForm.araKod, hours: '' };
                  } else {
                    delete records[personId][g]; // Yeni giriş: o dönem şirkette değildi
                  }
                }
                // Dönüş günü ve sonrasındaki "İB" izlerini temizle
                for (let g = 1; g <= new Date(y, m, 0).getDate(); g++) {
                  const gunTarih = new Date(y, m - 1, g);
                  const hucre = records[personId][g];
                  const kod = typeof hucre === 'object' && hucre !== null ? hucre.status : hucre;
                  if (gunTarih >= bit && kod === 'İB') delete records[personId][g];
                }
                await setDoc(ref, { records, updatedAt: new Date().toISOString() }, { merge: true });
              }
            }
          } catch (err) { console.warn('Ara ay düzenlenemedi:', y, m, err); }
          imlec.setMonth(imlec.getMonth() + 1);
        }
      };

      try {
        await araGunleriDuzenle();

        // Geçmiş kaydı: bu ayrılış-dönüş döngüsü profilde saklanır
        const doneme = {
          ayrilis: ayrilisStr || '-',
          neden: person.resignationReason || 'Belirtilmedi',
          donus: donusStr,
          mod: restartForm.mod === 'kesintisiz' ? 'Kesintisiz (kıdem korundu)' : 'Yeni giriş',
          araKod: restartForm.mod === 'kesintisiz' ? restartForm.araKod : null
        };
        const olay = {
          id: Date.now().toString(),
          date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          type: restartForm.mod === 'kesintisiz' ? 'İşe Geri Döndü (kesintisiz)' : 'İşe Yeniden Başladı'
        };

        const guncelleme = {
          employmentStatus: 'Aktif',
          passiveDate: null,
          resignationDate: null,
          resignationReason: null,
          cikisOnaylandi: false,
          cikisHesapDetay: null,
          leaveHistory: [...(person.leaveHistory || []), olay],
          calismaGecmisi: [...(person.calismaGecmisi || []), doneme]
        };
        // Yeni giriş modunda işe başlama tarihi güncellenir; kesintisizde KORUNUR
        if (restartForm.mod === 'yeni') guncelleme.startDate = donusStr;

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), guncelleme);

        if (addSystemLog) addSystemLog('Personel İşe Geri Döndü',
          `${person.fullName}, ${donusStr} tarihinde işe geri döndü. Yöntem: ${doneme.mod}${doneme.araKod ? ` (ara günler: ${doneme.araKod})` : ''}.`);
        setShowRestartModal(false);
      } catch (err) {
        console.error('İşe geri başlatma hatası:', err);
        alert('İşe geri başlatma sırasında bir hata oluştu.');
      } finally {
        setRestartKaydediliyor(false);
      }
    };

    // --- YENİ: İŞİ BIRAKMA İŞLEMİ ---
    // Mevcut "Pasif" yapma mantığına (handleUpdatePersonnel) hiç dokunulmadan,
    // TAMAMEN AYRI bir akış olarak eklendi. Bu fonksiyon:
    // 1) Personeli o tarihten itibaren Pasif yapar ve ayrılma nedeni/tarihini kaydeder.
    // 2) Ayrıldığı aydaki KALAN günleri mesai tablosuna otomatik "İB" (İşi Bıraktı) olarak işler
    //    (Ücretsiz İzin ile aynı mantıkta: o günler için maaş hesaplanmaz).
    // 3) isPersonnelVisibleInMonth fonksiyonu zaten passiveDate'ten SONRAKİ ayларda personeli
    //    otomatik olarak puantaj/mesai/maaş tablolarından gizlediği için, sonraki aylar için
    //    ekstra bir işlem yapmaya gerek yoktur.
    const handleResignPersonnel = async (e) => {
      e.preventDefault();
      if (!resignForm.date) return;

      const resignDateObj = new Date(resignForm.date);
      const year = resignDateObj.getFullYear();
      const month = resignDateObj.getMonth() + 1;
      const resignDay = resignDateObj.getDate();
      const daysInMonth = new Date(year, month, 0).getDate();

      // Personelin mavi/beyaz yaka mesai koleksiyon önekini belirle (sistemin geri kalanıyla aynı mantık)
      const isBeyazYaka = person.collarType === 'Beyaz Yaka' || (person.collarType !== 'Mavi Yaka' && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(person.position));
      const docPrefix = isBeyazYaka ? 'beyaz_' : '';

      try {
        // 1) Ayın kalan günlerini "İB" olarak mesai tablosuna işle
        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${docPrefix}${year}_${month}`);
        const mesaiSnap = await getDoc(mesaiRef);
        let records = mesaiSnap.exists() ? mesaiSnap.data().records : {};
        if (!records[personId]) records[personId] = {};
        for (let d = resignDay + 1; d <= daysInMonth; d++) {
          records[personId][d] = { status: 'İB', hours: '' };
        }
        await setDoc(mesaiRef, { records, updatedAt: new Date().toISOString() }, { merge: true });

        // 2) Personel kaydını güncelle: Pasif yap, ayrılma tarihi/nedenini kaydet
        const leaveEvent = { id: Date.now().toString(), date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), type: 'İşten Ayrıldı' };
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
          employmentStatus: 'Pasif',
          passiveDate: resignForm.date,
          resignationDate: resignForm.date,
          resignationReason: resignForm.reason,
          leaveHistory: [...(person.leaveHistory || []), leaveEvent]
        });

        if (addSystemLog) addSystemLog('Personel İşi Bıraktı', `${person.fullName}, ${resignForm.date} tarihi itibarıyla işi bıraktı. Neden: ${resignForm.reason || 'Belirtilmedi'}.`);
        setShowResignModal(false);

        // YENİ: İşi bırakma onaylanınca, kesin hesap dökümünü hesapla ve hesap kapama penceresini aç
        computeSettlement(resignForm.date);
      } catch (err) {
        console.error('İşi bırakma işlemi sırasında hata:', err);
        alert('İşlem sırasında bir hata oluştu.');
      }
    };

    // YENİ: İşten çıkış kesin hesap dökümünü hesaplar.
    // Mantık: Yemek ve yol parası AY BAŞINDA peşin (1 aylık) verildiği için, çalışılmayan günlerin
    // yemek/yol bedeli personelden İADE alınır. Bu iade, önce Kalan Nakit'ten, yetmezse Kalan Banka'dan düşülür.
    // Banka/İcra hesabı, maaş tablosundaki formülün aynısıdır (çalışılan güne orantılı).
    const computeSettlement = async (dateStr) => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const resignDay = d.getDate();
      const daysInMonth = new Date(year, month, 0).getDate();
      const calışılanGun = resignDay;        // ayın 1'inden ayrılış gününe kadar çalıştı sayılır
      const calışılmayanGun = daysInMonth - resignDay;

      // YENİ: Personel Muhasebe > Maaş tablosundaki O AYA AİT kaydı oku. Mesai Ücreti'nin
      // BİREBİR aynı çıkması için maaş tablosundaki manuel değerler (Prim saati, elle
      // girilmiş Devamsızlık / Rapor / Fazla Gün ve Maaş) burada da kullanılır.
      let maasRow = {};
      try {
        const _prefix = person.collarType === 'Beyaz Yaka' ? 'beyaz_' : '';
        const _snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${_prefix}${year}_${month}`));
        if (_snap.exists()) maasRow = (_snap.data().records || {})[personId] || {};
      } catch (e) {
        console.error('Maaş kaydı okunamadı (mesai ücreti hesabı için):', e);
      }

      const maas = parseFloat(maasRow.maas !== undefined && maasRow.maas !== '' ? maasRow.maas : person.maas) || 0;
      const bankaParasiBase = parseFloat(person.bankaParasi) || 0;
      const yemekAylik = parseFloat(person.yemek) || 0;
      const yolAylik = parseFloat(person.yol) || 0;

      // YENİ: Gerçek puantaj verisiyle kırılım — ayın 1'inden ayrılış gününe kadar
      // Devamsız/Rapor/Ücretsiz İzin günleri "Ödenecek Gün"den düşülür; Fazla Mesai/Gün günleri
      // fazla mesai ücreti olarak ayrıca eklenir.
      // ======================================================================
      // DÜZELTİLDİ (KRİTİK): PUANTAJ KAYNAĞI ARTIK MAAŞ TABLOSU İLE AYNI
      // ======================================================================
      // ESKİ HALİ: Kırılım, App.tsx'in topladığı allMesaiRecords listesinden
      // okunuyordu. O liste 'mesai' koleksiyonundan SIRASIZ limit(12) ile
      // çekildiği için, 12 aydan fazla veri birikince İÇİNDE BULUNULAN AY
      // listeye girmeyebiliyordu. Sonuç: Maaş Tablosu'nda Mesai Ücreti dolu
      // görünürken ayrılış dökümünde 0 çıkıyordu (ekran görüntüsündeki fark).
      //
      // YENİ HALİ: O ayın 'mesai' dokümanı (Maaş Tablosu'nun okuduğu dokümanın
      // TA KENDİSİ) buradan da doğrudan okunur. Doküman yoksa eski liste
      // YEDEK olarak kullanılır; hiçbir eski davranış kaybolmaz.
      // ======================================================================
      let mesaiDocKisi = null;
      try {
        const _prefix2 = person.collarType === 'Beyaz Yaka' ? 'beyaz_' : '';
        const _msnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${_prefix2}${year}_${month}`));
        if (_msnap.exists()) mesaiDocKisi = (_msnap.data().records || {})[personId] || null;
      } catch (e) { console.error('Mesai dokümanı okunamadı (ayrılış hesabı):', e); }

      const personMesaiUpToResign = mesaiDocKisi
        ? Object.keys(mesaiDocKisi).map(gunNo => {
            const dd = mesaiDocKisi[gunNo];
            // Kayıt iki biçimde olabilir: { status, hours } nesnesi veya düz kod metni
            const code = (typeof dd === 'object' && dd !== null) ? dd.status : dd;
            const hours = (typeof dd === 'object' && dd !== null) ? (parseFloat(dd.hours) || 0) : 0;
            return { day: parseInt(gunNo), code, hours };
          }).filter(x => x.day <= resignDay) // Ayrılış günü SONRASI (otomatik İB) hesaba girmez
        : (allMesaiRecords || []).filter(m => String(m.personId) === String(personId) && m.year === year && m.month === month && m.day <= resignDay);

      const devamsizGunOto = personMesaiUpToResign.filter(m => m.code === 'D').length;
      const raporGunOto = personMesaiUpToResign.filter(m => m.code === 'R').length;
      const ucretsizIzinGun = personMesaiUpToResign.filter(m => m.code === 'Üİ' || m.code === 'İB').length;
      // DÜZELTME: "Fazla Gün" sayımı Personel Muhasebe > Maaş ile aynı olacak şekilde
      // yalnızca FG (Fazla Gün) ve FGM (Fazla Gün + Mesai) kodlarını sayar. FM (Fazla
      // Mesai) bir GÜN değil SAAT kaydıdır; aşağıda "Günlük Saat" içinde saat olarak
      // eklenir. Önceden FM de fazla gün sayıldığı için aynı gün hem ×10 saat hem de
      // kendi saati eklenip Mesai Ücreti şişiyordu.
      const fazlaGunOto = personMesaiUpToResign.filter(m => ['FG', 'FGM'].includes(m.code)).length;

      // Maaş tablosundaki elle girilmiş değerler varsa onlar geçerlidir (Finans ile aynı mantık)
      const devamsizGun = maasRow.devamsizlik !== undefined && maasRow.devamsizlik !== '' ? parseFloat(maasRow.devamsizlik) : devamsizGunOto;
      const raporGun = maasRow.rapor !== undefined && maasRow.rapor !== '' ? parseFloat(maasRow.rapor) : raporGunOto;
      const fazlaGunSayisi = maasRow.fazlaGun !== undefined && maasRow.fazlaGun !== '' ? parseFloat(maasRow.fazlaGun) : fazlaGunOto;
      const primSaati = parseFloat(maasRow.prim) || 0;

      const odenecekGun = Math.max(0, calışılanGun - devamsizGun - raporGun - ucretsizIzinGun);

      // Maaş tablosu ile aynı formüller (Devamsız/Rapor/Ücretsiz İzin düşülmüş "Ödenecek Gün"e orantılı)
      const hesaplananBanka = (bankaParasiBase / 30) * odenecekGun;
      const icraKesintisi = person.icrasiVar === 'Evet' ? (hesaplananBanka / 4) : 0;

      // "Fazla Mesai / Devamsızlık Ücret Etkisi", Personel Muhasebe > Maaş bölümündeki
      // "Mesai Ücreti" ile BİREBİR aynı formülle hesaplanır:
      //   Mesai Ücreti = (Maaş / 200) × Toplam Saat
      //   Toplam Saat  = Günlük Saat (FM/FGM +, EM −) + (Fazla Gün × 10) − (Devamsız × 3) + Prim Saati
      let gunlukSaat = 0;
      personMesaiUpToResign.forEach(m => {
        if (m.code === 'FGM' || m.code === 'FM') gunlukSaat += (parseFloat(m.hours) || 0);
        else if (m.code === 'EM') gunlukSaat -= (parseFloat(m.hours) || 0);
      });
      const toplamSaat = gunlukSaat + (fazlaGunSayisi * 10) - (devamsizGun * 3) + primSaati;
      const saatlikUcret = maas / 200;
      const fazlaMesaiUcreti = saatlikUcret * toplamSaat;
      // YENİ: Hak Edilen Net Maaş; personel maaş bölümüyle aynı mantıkla MESAİ ÜCRETİ +
      // YEMEK ve YOL parası da eklenerek hesaplanır (aylık yemek/yol tutarı brüt hak edişe dahil edilir).
      const netMaasBase = (maas / 30) * odenecekGun;
      const netMaas = netMaasBase + fazlaMesaiUcreti + yemekAylik + yolAylik;

      // Peşin verilen yemek/yol'un, çalışılmayan güne düşen İADE tutarı
      const yemekIade = (yemekAylik / daysInMonth) * calışılmayanGun;
      const yolIade = (yolAylik / daysInMonth) * calışılmayanGun;
      const toplamIade = yemekIade + yolIade;

      // Kalan tutarlar
      let kalanNakit = netMaas - hesaplananBanka;   // nakit el ödemesi kısmı
      let kalanBanka = hesaplananBanka - icraKesintisi;

      // İADE'yi önce Kalan Nakit'ten düş, yetmezse Kalan Banka'dan
      let iadeKalan = toplamIade;
      let nakittenDusulen = 0, bankadanDusulen = 0;
      if (iadeKalan > 0) {
        nakittenDusulen = Math.min(kalanNakit, iadeKalan);
        kalanNakit -= nakittenDusulen;
        iadeKalan -= nakittenDusulen;
      }
      if (iadeKalan > 0) {
        bankadanDusulen = Math.min(kalanBanka, iadeKalan);
        kalanBanka -= bankadanDusulen;
        iadeKalan -= bankadanDusulen;
      }

      // ======================================================================
      // YENİ: AVANSLAR ve FİİLEN YAPILMIŞ ÖDEMELER DE DÜŞÜLÜR (kullanıcı talebi)
      // ======================================================================
      // ESKİ HALİ: "avans bu ekranda 0 kabul" ediliyordu; Kalan Banka/Nakit,
      // ay içinde verilmiş avansları ve maaş tablosunda ÖDENDİ işaretlenmiş
      // yemek/yol/maaş kalemlerini görmüyordu. Çıkış anında gerçekte ne
      // ödeneceği görünmüyordu.
      //
      // YENİ HALİ: Çıkış ayının maaş satırından (maasRow — zaten yukarıda
      // okunuyor) tüm ödenmiş kalemler alınır ve KANALINA göre düşülür:
      //   • NAKİT kanalı: nakit avans + nakit maaş ödemesi + ödendi işaretli
      //     yemek ve yol paraları (elden/peşin verilirler)
      //   • BANKA kanalı: resmi avans + banka maaş ödemesi + ödenen icra
      // Sonuç EKSİYE DÜŞEBİLİR: verilen avans hak edilenden fazlaysa personel
      // şirkete iade edecek demektir — bu bilerek gizlenmez, ekranda kırmızı
      // "personel iade edecek" olarak gösterilir.
      // ======================================================================
      const avansNakit  = parseFloat(maasRow.nakitAvans) || 0;
      const avansResmi  = parseFloat(maasRow.resmiAvans) || 0;
      const odYemek     = parseFloat(maasRow.yemekOdenenTutar) || 0;
      const odYol       = parseFloat(maasRow.yolOdenenTutar) || 0;
      const odBanka     = parseFloat(maasRow.bankaOdenenTutar) || 0;
      const odNakit     = parseFloat(maasRow.nakitOdenenTutar) || 0;
      const odIcra      = parseFloat(maasRow.icraOdenenTutar) || 0;
      const odenenNakitToplam = avansNakit + odNakit + odYemek + odYol;
      const odenenBankaToplam = avansResmi + odBanka + odIcra;
      kalanNakit -= odenenNakitToplam;
      kalanBanka -= odenenBankaToplam;

      const dokum = {
        dateStr, year, month, daysInMonth, calışılanGun, calışılmayanGun,
        devamsizGun, raporGun, ucretsizIzinGun, fazlaGunSayisi, odenecekGun, fazlaMesaiUcreti,
        // YENİ: Mesai ücretinin dayanağı da dökümde taşınır — ekranda "kaç saat
        // mesai yaptı" ayrıca gösterilebilsin diye (toplamSaat = günlük FM/FGM/EM
        // saatleri + fazla gün×10 − devamsız×3 + prim saati; Maaş Tablosu formülü)
        toplamSaat, saatlikUcret, primSaati,
        maas, netMaas, netMaasBase, hesaplananBanka, icraKesintisi,
        yemekAylik, yolAylik, yemekIade, yolIade, toplamIade,
        nakittenDusulen, bankadanDusulen,
        // YENİ: Avans/ödeme kalemleri dökümle birlikte saklanır. odenenlerDusuldu
        // bayrağı, kayıtlı dökümü gösteren "Ayrılış Hakediş Dökümü" ekranına
        // "bu tutarlar ZATEN düşülmüş, bir daha düşme" der (çifte düşüm koruması).
        avansNakit, avansResmi, odYemek, odYol, odBanka, odNakit, odIcra,
        odenenNakitToplam, odenenBankaToplam,
        odenenlerDusuldu: true,
        // DEĞİŞTİ: Math.max(0, ...) kaldırıldı — avans hak edilenden fazlaysa
        // sonuç eksi çıkar ve personelin iade edeceği tutarı gösterir.
        finalKalanNakit: kalanNakit,
        finalKalanBanka: kalanBanka
      };
      setSettlementData(dokum);
      setSettlementConfirm({ nakitVerildi: false, bankaVerildi: false, belgeUrl: '' });
      setShowSettlementModal(true);
      // DEĞİŞİKLİK: Üretilen döküm ayrıca DÖNDÜRÜLÜR. Çıkış tarihi güncellemesinde
      // state'in yenilenmesini beklemek yerine dönen değeri doğrudan Firestore'a
      // yazabilmek için gerekli (setState eşzamanlı değildir).
      return dokum;
    };

    // YENİ: Çıkış tarihini değiştirip hakediş hesabını YENİDEN ÜRETİR.
    // computeSettlement(dateStr) hesabı yapıp setSettlementData ile state'e yazar;
    // biz burada state'in güncellenmesini beklemek yerine aynı hesabı Firestore'a
    // yazmak için computeSettlement'ın bittiğini bekleyip settlementData'yı
    // okumak zorunda kalmayalım diye, hesap sonrası kısa bir bekleme yerine
    // doğrudan computeSettlement'ı çağırıp ardından güncel state'i kullanıyoruz.
    // Bu yüzden computeSettlement artık ürettiği dökümü de DÖNDÜRÜYOR.
    const handleCikisTarihiGuncelle = async () => {
      if (!yeniCikisTarihi) { alert('Lütfen yeni çıkış tarihini seçin.'); return; }

      // İşe giriş tarihinden önceki bir çıkış tarihi mantıksız olurdu.
      if (person?.startDate && yeniCikisTarihi < person.startDate) {
        alert(`Çıkış tarihi işe giriş tarihinden (${person.startDate}) önce olamaz.`);
        return;
      }

      setCikisTarihiKaydediliyor(true);
      try {
        const yeniDokum = await computeSettlement(yeniCikisTarihi);
        if (!yeniDokum) { alert('Hesap yeniden üretilemedi.'); setCikisTarihiKaydediliyor(false); return; }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
          cikisHesapDetay: yeniDokum,
          resignDate: yeniCikisTarihi,
          cikisTarihiGuncellendi: new Date().toISOString(),
          cikisTarihiGuncelleyen: currentUser?.fullName || 'Sistem'
        });

        if (addSystemLog) addSystemLog('Çıkış Tarihi Güncellendi',
          `${person.fullName} çıkış tarihi ${person.cikisHesapDetay?.dateStr || '-'} -> ${yeniCikisTarihi} olarak değiştirildi ve hakediş hesabı yeniden üretildi. İşlemi yapan: ${currentUser?.fullName || 'Sistem'}.`);

        setShowCikisTarihiDuzenle(false);
        // Hesap modalı da kapatılır; kullanıcı güncel dökümü yeniden açsın.
        setShowSettlementModal(false);
      } catch (err) {
        console.error('Çıkış tarihi güncellenemedi:', err);
        alert('Çıkış tarihi güncellenemedi: ' + (err?.message || 'bilinmeyen hata'));
      }
      setCikisTarihiKaydediliyor(false);
    };

    // YENİ: Çıkış için imzalı belge yükleme (3 seçenekli MediaCaptureMenu ile kullanılır)
    const handleSettlementFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setSettlementUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setSettlementConfirm(prev => ({ ...prev, belgeUrl: uploadedUrl }));
      } catch (err) {
        console.error('Çıkış belgesi yükleme hatası:', err);
        alert('Belge yüklenemedi, tekrar deneyin.');
      }
      setSettlementUploading(false);
    };

    // YENİ: Çıkışı kesinleştir — özlük dosyasına belge + hesap dökümünü ekle, çıkışı tamamla
    const finalizeSettlement = async () => {
      if (!settlementData) return;
      if (!settlementConfirm.nakitVerildi || !settlementConfirm.bankaVerildi) {
        alert('Lütfen hem nakit hem banka ödemesinin yapıldığını onaylayın.');
        return;
      }
      if (!settlementConfirm.belgeUrl) {
        alert('Lütfen imzalı çıkış belgesini yükleyin.');
        return;
      }
      try {
        // Özlük dosyasına (ozlukDosyalari objesi — sistemdeki mevcut desen) çıkış belgesini ekle
        const ozluk = person.ozlukDosyalari || {};
        const key = `cikis_hesap_${Date.now()}`;
        const detayNot = `Çıkış: ${settlementData.dateStr} | Kalan Banka: ₺${settlementData.finalKalanBanka.toLocaleString('tr-TR', {maximumFractionDigits: 2})} | Kalan Nakit: ₺${settlementData.finalKalanNakit.toLocaleString('tr-TR', {maximumFractionDigits: 2})} | Tüm maaş ödemesi ve sözleşmeler imzalandı.`;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
          ozlukDosyalari: { ...ozluk, [key]: { name: 'İşten Çıkış / Hesap Kapama Belgesi', url: settlementConfirm.belgeUrl, date: settlementData.dateStr, note: detayNot } },
          cikisOnaylandi: true,
          cikisHesapDetay: settlementData,
          cikisBelgeUrl: settlementConfirm.belgeUrl
        });
        if (addSystemLog) addSystemLog('İşten Çıkış Tamamlandı', `${person.fullName} için tüm maaş ödemesi ve sözleşmeler imzalandı. Çıkış tamamlandı.`);
        setShowSettlementModal(false);
        alert('Çıkış tamamlandı. Tüm maaş ödemesi ve sözleşmeler imzalandı.');
      } catch (err) {
        console.error('Çıkış kesinleştirme hatası:', err);
        alert('Çıkış kaydedilirken bir hata oluştu.');
      }
    };

    // --- YENİ: PERSONEL HAREKET İŞLEMLERİ FONKSİYONLARI ---
    // Beyaz/Mavi yaka mesai koleksiyon önekini belirle (sistemin geri kalanıyla aynı mantık)
    const isBeyazYakaPerson = person && (person.collarType === 'Beyaz Yaka' || (person.collarType !== 'Mavi Yaka' && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(person.position)));
    const maasDocPrefix = isBeyazYakaPerson ? 'beyaz_' : '';

    // YENİ: Seçilen aya ait Maaş Tablosu (maas koleksiyonu) kaydını canlı dinle — Maaş/Yol/Yemek bildirimleri için
    useEffect(() => {
      if (!personId || !db || !financeMonth) return;
      const [fy, fm] = financeMonth.split('-');
      const financeRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${maasDocPrefix}${parseInt(fy)}_${parseInt(fm)}`);
      const unsubFinance = onSnapshot(financeRef, snap => {
        const records = snap.exists() ? (snap.data().records || {}) : {};
        setFinanceMonthRow(records[personId] || {});
      }, console.error);
      return () => unsubFinance();
    }, [personId, db, appId, financeMonth, maasDocPrefix]);

    // YENİ: Ay adları ve seçilen ayın okunabilir etiketi (örn. "2026 Temmuz")
    const financeMonthNamesTR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const [financeYearStr, financeMonthNumStr] = financeMonth.split('-');
    const financeMonthLabel = `${financeYearStr} ${financeMonthNamesTR[parseInt(financeMonthNumStr) - 1]}`;

    // Maaş durumu: Avans yatırıldı → Maaş Bekleniyor → (kalan ödendiğinde) Maaş Yatırıldı
    const financeHasAvans = (parseFloat(financeMonthRow.nakitAvans) || 0) > 0 || (parseFloat(financeMonthRow.resmiAvans) || 0) > 0;
    const financeFullyPaid = !!financeMonthRow.nakitOdendi && !!financeMonthRow.bankaOdendi;
    let maasStatusText = `${financeMonthLabel} Maaşı Bekleniyor`;
    let maasStatusStyle = 'bg-neutral-50 border-neutral-200 text-neutral-500';
    if (financeFullyPaid) {
      maasStatusText = `${financeMonthLabel} Maaşı Yatırıldı`;
      maasStatusStyle = 'bg-green-50 border-green-200 text-green-700';
    } else if (financeHasAvans) {
      maasStatusText = `${financeMonthLabel} Avans Yatırıldı`;
      maasStatusStyle = 'bg-blue-50 border-blue-200 text-blue-700';
    }
    const yemekStatusText = financeMonthRow.yemekOdendi ? `${financeMonthLabel} Yemek Kartı Yatırıldı` : `${financeMonthLabel} Yemek Kartı Bekleniyor`;
    const yemekStatusStyle = financeMonthRow.yemekOdendi ? 'bg-green-50 border-green-200 text-green-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500';
    const yolStatusText = financeMonthRow.yolOdendi ? `${financeMonthLabel} Yol Parası Yatırıldı` : `${financeMonthLabel} Yol Parası Bekleniyor`;
    const yolStatusStyle = financeMonthRow.yolOdendi ? 'bg-green-50 border-green-200 text-green-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500';

    // YENİ: Prim ve Mesai Durumu — Maaş Tablosu'ndaki prim (fazla mesai saati) alanından hesaplanır
    // YENİ: Finans → Mavi Yaka Maaş (MaasView) ile BİREBİR aynı olması için saatlik ücret,
    // maaş satırındaki override maaş varsa onu, yoksa personelin tanımlı maaşını kullanır (maas/200).
    const financeEffectiveMaas = (financeMonthRow.maas !== undefined && financeMonthRow.maas !== '')
      ? (parseFloat(financeMonthRow.maas) || 0)
      : (parseFloat(person.maas) || 0);
    const financeSaatlikUcret = financeEffectiveMaas / 200;
    const financePrimSaat = parseFloat(financeMonthRow.prim) || 0;
    const financePrimHesaplananTutar = financePrimSaat * financeSaatlikUcret;
    const financePrimManuelTutar = parseFloat(financeMonthRow.primOdenenTutar) || 0;
    const financePrimTutar = financePrimManuelTutar > 0 ? financePrimManuelTutar : financePrimHesaplananTutar;
    const financePrimOdendi = financePrimManuelTutar > 0 || (financeFullyPaid && financePrimSaat > 0);
    const primStatusText = financePrimOdendi ? `${financeMonthLabel} Prim Ödendi (₺${financePrimTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})})` : (financePrimTutar > 0 ? `${financeMonthLabel} Prim Bekleniyor (₺${financePrimTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})})` : `${financeMonthLabel} Prim Bekleniyor`);
    const primStatusStyle = financePrimOdendi ? 'bg-green-50 border-green-200 text-green-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500';

    const [financeYearNum, financeMonthNum] = financeMonth.split('-').map(v => parseInt(v));
    const financePersonMesai = (allMesaiRecords || []).filter(m => String(m.personId) === String(personId) && m.year === financeYearNum && m.month === financeMonthNum);
    // EŞLEŞTİRİLDİ: Finans → Personel Muhasebe → Mavi Yaka Maaş (MesaiView/MaasView) ile BİREBİR aynı mantık.
    // gunlukSaat: FGM/FM saatleri (+), EM saatleri (−) toplamı
    const financeGunlukSaat = financePersonMesai.reduce((sum, m) => {
      if (m.code === 'FGM' || m.code === 'FM') return sum + (parseFloat(m.hours) || 0);
      if (m.code === 'EM') return sum - (parseFloat(m.hours) || 0);
      return sum;
    }, 0);
    // Fazla Gün: yalnızca FG + FGM sayılır (FM fazla gün DEĞİL, sadece saat ekler). Maaş kaydında manuel override varsa o kullanılır.
    const financeFazlaGunAuto = financePersonMesai.filter(m => ['FG', 'FGM'].includes(m.code)).length;
    const financeFazlaGunSayisi = (financeMonthRow.fazlaGun !== undefined && financeMonthRow.fazlaGun !== '') ? (parseFloat(financeMonthRow.fazlaGun) || 0) : financeFazlaGunAuto;
    // Devamsızlık: manuel override varsa o kullanılır
    const financeDevamsizAuto = financePersonMesai.filter(m => m.code === 'D').length;
    const financeDevamsizGunSayisi = (financeMonthRow.devamsizlik !== undefined && financeMonthRow.devamsizlik !== '') ? (parseFloat(financeMonthRow.devamsizlik) || 0) : financeDevamsizAuto;
    // Toplam Saat = gunlukSaat + (fazlaGun*10) − (devamsızlık*3) + prim  → Finans MaasView ile aynı
    const financeMesaiSaat = financeGunlukSaat + (financeFazlaGunSayisi * 10) - (financeDevamsizGunSayisi * 3) + financePrimSaat;
    // Mesai ücreti = (maaş / 200) * toplam saat  → Finans ile aynı
    const financeMesaiTutar = financeMesaiSaat * financeSaatlikUcret;

    const financeAvansTutar = (parseFloat(financeMonthRow.nakitAvans) || 0) + (parseFloat(financeMonthRow.resmiAvans) || 0);
    const financeKalanOdenenTutar = (financeMonthRow.bankaOdendi ? (parseFloat(financeMonthRow.bankaOdenenTutar) || 0) : 0) + (financeMonthRow.nakitOdendi ? (parseFloat(financeMonthRow.nakitOdenenTutar) || 0) : 0);
    const financeMaasOdenenTutar = financeAvansTutar + financeKalanOdenenTutar;
    const financeYemekTutar = parseFloat(financeMonthRow.yemekOdenenTutar) || 0;
    const financeYolTutar = parseFloat(financeMonthRow.yolOdenenTutar) || 0;
    const financeToplamOdenenTutar = financeMaasOdenenTutar + (financeMonthRow.yolOdendi ? financeYolTutar : 0) + (financeMonthRow.yemekOdendi ? financeYemekTutar : 0) + (financePrimOdendi ? financePrimTutar : 0);

    // YENİ: Personelin tanımlı maaşı ve o aya ait KALAN NAKİT hesabı (Maaş Tablosu ile aynı mantık).
    // Kalan Nakit = Hak edilen net maaş − bankadan ödenen kısım − nakit avans + mesai ücreti
    const financeTanimliMaas = parseFloat(person.maas) || 0;                 // Personelin tanımlı aylık maaşı
    const financeBankaParasi = parseFloat(person.bankaParasi) || 0;          // Sabit banka ödemesi tutarı
    // Raporlu gün: maaş kaydında manuel override varsa o kullanılır (Finans MaasView ile aynı)
    const financeRaporAuto = financePersonMesai.filter(m => m.code === 'R').length;
    const financeRaporGunSayisi = (financeMonthRow.rapor !== undefined && financeMonthRow.rapor !== '') ? (parseFloat(financeMonthRow.rapor) || 0) : financeRaporAuto;
    const financeUcretsizGunSayisi = financePersonMesai.filter(m => ['Üİ', 'İB'].includes(m.code)).length; // Ücretsiz izin / işi bıraktı
    // YENİ: İŞE GİRİŞ günleri (işe başlangıç tarihinden önceki günler) ücretsiz izin gibi sayılır (maaş tablolarıyla tutarlı)
    let financeIseGirisGunSayisi = 0;
    if (person.startDate) {
      const _s = new Date(person.startDate + 'T00:00:00');
      if (!isNaN(_s.getTime())) {
        const _daysInMonth = new Date(financeYearNum, financeMonthNum, 0).getDate();
        const _startMidnight = new Date(_s.getFullYear(), _s.getMonth(), _s.getDate());
        for (let _d = 1; _d <= _daysInMonth; _d++) {
          if (new Date(financeYearNum, financeMonthNum - 1, _d) < _startMidnight) financeIseGirisGunSayisi++;
        }
      }
    }
    // Çalışılan (ödenecek) gün sayısı: 30 günden rapor + devamsızlık + ücretsiz izin + işe giriş öncesi günler düşülür
    const financeMesaiGunSayisi = Math.max(0, 30 - financeRaporGunSayisi - financeDevamsizGunSayisi - financeUcretsizGunSayisi - financeIseGirisGunSayisi);
    const financeNetMaas = (financeTanimliMaas / 30) * financeMesaiGunSayisi;         // Hak edilen net maaş
    const financeHesaplananBanka = (financeBankaParasi / 30) * financeMesaiGunSayisi; // Bankadan ödenen kısım
    const financeNakitAvansTutar = parseFloat(financeMonthRow.nakitAvans) || 0;       // Bu ay çekilen nakit avans
    // YENİ: Kalan Nakit hesabına YOL ve YEMEK ücretleri DAHİL EDİLMEZ (ayrı ödeme kalemleridir).
    // Prim ise zaten Mesai Ücreti'nin içinde olduğu için ayrıca eklenmez (çift sayım olmaz).
    const financeKalanNakit = financeNetMaas - financeHesaplananBanka - financeNakitAvansTutar + financeMesaiTutar;
    // YENİ: Bankadan (resmi) çekilen avans ve o aya ait KALAN BANKA parası
    const financeResmiAvansTutar = parseFloat(financeMonthRow.resmiAvans) || 0;        // Bu ay çekilen banka/resmi avans
    const financeKalanBanka = financeHesaplananBanka - financeResmiAvansTutar;         // Bankadan ödenecek kalan tutar

    // YENİ: İCRA — personelin icrası varsa (icrasiVar === 'Evet') hesaplanan bankanın %25'i icraya kesilir.
    const financeIcraVar = person.icrasiVar === 'Evet';
    const financeIcraKesintisi = financeIcraVar ? (financeHesaplananBanka / 4) : 0;    // İcra ücreti (%25)
    const financeIcraSonrasiKalan = financeHesaplananBanka - financeIcraKesintisi;     // İcra düşüldükten sonra personele kalan banka

    // YENİ: Personelin ne zamandır çalıştığını gösteren kıdem metni (örn. "9 aydır", "1 sene 3 aydır")
    const getTenureText = (startDateStr) => {
      if (!startDateStr) return null;
      const start = new Date(startDateStr);
      if (isNaN(start.getTime())) return null;
      const now = new Date();
      let years = now.getFullYear() - start.getFullYear();
      let months = now.getMonth() - start.getMonth();
      if (now.getDate() < start.getDate()) months -= 1;
      if (months < 0) { years -= 1; months += 12; }
      if (years <= 0 && months <= 0) return 'Bu ay işe başladı';
      if (years <= 0) return `${months} aydır çalışıyor`;
      if (months === 0) return `${years} senedir çalışıyor`;
      return `${years} sene ${months} aydır çalışıyor`;
    };
    const tenureText = getTenureText(person.startDate);

    // Belge yükleme (upload.php) yardımcı fonksiyonu
    const uploadActionFile = async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
      const text = await res.text();
      let uploadedUrl = file.name;
      try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
      return uploadedUrl;
    };

    // ========================================================================
    // MAAŞ SATIRINA YAZMA — DÜZELTİLDİ (KRİTİK HATA)
    // ========================================================================
    // SORUNUN KÖKÜ: Bu fonksiyon 'personnelMaas' adlı bir koleksiyona,
    // { rows: { personId: {...} } } yapısıyla yazıyordu. Ancak Personel Muhasebe
    // ekranındaki Maaş Tablosu (Finans.tsx > MaasView) verisini
    // 'maas' koleksiyonundan ve { records: { personId: {...} } } yapısından okur.
    // Yani avans girişi HİÇ KİMSENİN OKUMADIĞI bir koleksiyona yazılıyordu;
    // veri Firebase'e gidiyor ama Hak Ediş Durumu sütunlarında hiç görünmüyordu.
    //
    // Doğrusu şudur (Şirkete Borç Ödemesi fonksiyonu zaten böyle çalışıyordu):
    //   koleksiyon: 'maas'   ·   doküman: {beyaz_}{yıl}_{ay}   ·   alan: records
    //
    // ÇAKIŞMA ÖNLEMİ: Yazma sırasında TÜM records nesnesi geri gönderilmez;
    // yalnızca bu personelin değişen alanları "nokta notasyonu" ile yazılır
    // (records.{personId}.{alan}). Böylece aynı anda Maaş Tablosu ekranında
    // başka bir personel üzerinde çalışılıyorsa onun verisi ezilmez.
    // ========================================================================
    const applyToMaasRow = async (monthStr, patch) => {
      const [y, m] = monthStr.split('-');
      const maasRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${maasDocPrefix}${parseInt(y)}_${parseInt(m)}`);
      const snap = await getDoc(maasRef);
      const records = snap.exists() ? (snap.data().records || {}) : {};
      const existingRow = records[personId] || {};
      const degisenAlanlar = patch(existingRow) || {};

      if (!snap.exists()) {
        // Doküman hiç yoksa (o ay için maaş tablosu hiç açılmamışsa) baştan kurulur
        await setDoc(maasRef, {
          records: { [personId]: { ...existingRow, ...degisenAlanlar } },
          updatedAt: new Date().toISOString()
        }, { merge: true });
        return;
      }

      // Doküman varsa: sadece değişen alanlara nokta notasyonuyla dokunulur
      const guncelleme = { updatedAt: new Date().toISOString() };
      Object.entries(degisenAlanlar).forEach(([alan, deger]) => {
        guncelleme[`records.${personId}.${alan}`] = deger;
      });
      await updateDoc(maasRef, guncelleme);
    };

    const logAction = async (actionData) => {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'personnelActions'), {
        personnelId: String(personId),
        ...actionData,
        createdAt: new Date().toISOString()
      });
    };

    // 1) AVANS GİRİŞİ (Nakit / Resmi) — Personel Muhasebe (maaş tablosu) ilgili aya işlenir
    const handleAvansSubmit = async (e) => {
      e.preventDefault();
      if (!avansForm.amount) return;
      const amount = parseFloat(avansForm.amount) || 0;
      if (amount <= 0) { alert('Lütfen 0’dan büyük bir tutar girin.'); return; }
      // Nakit Avans -> "NAKİT AV." sütunu (Kalan Nakit'i düşürür)
      // Resmi Avans -> "RESMİ AV." sütunu (Kalan Banka'yı düşürür)
      const fieldKey = avansForm.type === 'nakit' ? 'nakitAvans' : 'resmiAvans';
      try {
        // KÜMÜLATİF: Mevcut avans üzerine EKLENİR, üzerine yazılmaz.
        // Örn. sütunda 15.000 varsa ve 5.000 avans girilirse sonuç 20.000 olur.
        // String olarak yazılır çünkü Maaş Tablosu'ndaki hücreler metin kutusudur
        // ve elle girilen değerler de string olarak saklanıyor (tip tutarlılığı).
        await applyToMaasRow(avansForm.month, (row) => ({
          [fieldKey]: String((parseFloat(row[fieldKey]) || 0) + amount)
        }));
        await logAction({
          type: 'avans',
          title: `${avansForm.type === 'nakit' ? 'Nakit' : 'Resmi'} Avans`,
          amount, month: avansForm.month, note: avansForm.note, date: new Date().toISOString().split('T')[0]
        });
        if (addSystemLog) addSystemLog('Personel Avans Girişi', `${person.fullName} için ${avansForm.month} ayına ${amount} TL ${avansForm.type} avans girildi.`);
        setAvansForm({ type: 'nakit', amount: '', month: nowMonth, note: '' });
        setShowAvansModal(false);
      } catch (err) { console.error(err); alert('Avans işlenirken hata oluştu.'); }
    };

    // YENİ: ŞİRKETE BORÇ ÖDEMESİ — Personel Muhasebe borçlandırma ile entegre.
    // Girilen tutar:
    //   1) O yılın borçlandırma (borclanma) tutarından düşülür,
    //   2) O ayın maaş satırındaki Kalan Nakit'i azaltmak için nakitAvans'a eklenir;
    //      nakit yetersizse kalan kısım banka tarafına (resmiAvans) yansıtılır.
    // Not: Sistemde kalan nakit = netMaas - hesaplananBanka - nakitAvans (+mesai),
    // kalan banka = hesaplananBanka - icra - resmiAvans olduğundan; nakitAvans/resmiAvans
    // artırmak doğrudan ilgili "kalan" tutarı düşürür.
    const handleDebtPaymentSubmit = async (e) => {
      e.preventDefault();
      const amount = parseFloat(debtForm.amount) || 0;
      if (amount <= 0) return;

      try {
        const year = parseInt(debtForm.month.split('-')[0]);
        const month = parseInt(debtForm.month.split('-')[1]);

        // 1) Seçilen aya ait maaş satırını oku (o ayın kalan nakit/banka hesabı için)
        // Maaş verisi 'maas' koleksiyonunda {records: {personId: {...}}} yapısında tutulur.
        const maasColRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', `${maasDocPrefix}${year}_${month}`);
        const maasSnap = await getDoc(maasColRef);
        const maasDocData = maasSnap.exists() ? maasSnap.data() : { records: {} };
        const records = maasDocData.records || {};
        const row = records[personId] || {};

        const netMaas = parseFloat(row.netMaasManuel ?? row.netMaas) || parseFloat(person.salary) || 0;
        const hesaplananBanka = parseFloat(row.hesaplananBanka) || 0;
        const mevcutNakitAvans = parseFloat(row.nakitAvans) || 0;
        const mevcutResmiAvans = parseFloat(row.resmiAvans) || 0;

        // YENİ: Şirkete borç ödemesinin TAMAMI Nakit Avans'tan düşülür.
        // Resmi Avans (Kalan Banka'yı etkileyen alan) artık HİÇ kullanılmaz;
        // eskiden nakit yetersiz kaldığında bankaya taşan kısım kaldırıldı.
        // Bu yüzden "kullanılabilir nakit" sınırlaması da uygulanmıyor —
        // borç tutarının tamamı doğrudan nakitAvans'a eklenir.
        const nakittenDusulecek = amount;
        const bankadanDusulecek = 0;

        // Maaş satırını güncelle: tamamı nakit avansına yansır, resmi avans dokunulmaz
        records[personId] = {
          ...row,
          nakitAvans: mevcutNakitAvans + nakittenDusulecek,
          resmiAvans: mevcutResmiAvans
        };
        await setDoc(maasColRef, { records, updatedAt: new Date().toISOString() }, { merge: true });

        // 2) Yıllık borçlandırma tutarından düş
        const yearlyRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas_yearly', year.toString());
        const yearlySnap = await getDoc(yearlyRef);
        const yData = yearlySnap.exists() ? yearlySnap.data() : { records: {} };
        const yRecords = yData.records || {};
        const mevcutBorc = parseFloat(yRecords[personId]?.borclanma) || 0;
        const yeniBorc = Math.max(0, mevcutBorc - amount);
        yRecords[personId] = { ...(yRecords[personId] || {}), borclanma: yeniBorc };
        await setDoc(yearlyRef, { records: yRecords, updatedAt: new Date().toISOString() }, { merge: true });

        // 3) Hareket kaydına ekle
        await logAction({
          type: 'borcOdeme',
          title: 'Şirkete Borç Ödemesi',
          amount, month: debtForm.month, date: new Date().toISOString().split('T')[0],
          note: `${debtForm.note ? debtForm.note + ' • ' : ''}Nakit Avans'tan düşüldü: ₺${nakittenDusulecek.toLocaleString('tr-TR')}`
        });

        if (addSystemLog) addSystemLog('Personel Borç Ödemesi', `${person.fullName} ${amount} TL şirket borcu ödedi. Kalan borç: ₺${yeniBorc.toLocaleString('tr-TR')}.`);
        setDebtForm({ amount: '', month: nowMonth, note: '' });
        setShowDebtModal(false);
      } catch (err) { console.error(err); alert('Borç ödemesi işlenirken hata oluştu.'); }
    };

    // YENİ: PRİM ÖDEME GİR — Maaş Tablosu'ndaki (maas koleksiyonu) prim (fazla mesai saati) alanına
    // saat veya tutar (₺) olarak giriş yapar. Tutar girilirse saatlik ücret × 1.5 (fazla mesai zammı)
    // ile saate çevrilir.
    const handlePrimSubmit = async (e) => {
      e.preventDefault();
      const rawVal = parseFloat(primForm.value) || 0;
      if (rawVal <= 0) { alert('Lütfen geçerli bir değer girin.'); return; }
      setPrimSubmitting(true);
      try {
        const [py, pm] = primForm.month.split('-');
        const maasDocId = `${maasDocPrefix}${parseInt(py)}_${parseInt(pm)}`;
        const maasRef = doc(db, 'artifacts', appId, 'public', 'data', 'maas', maasDocId);
        const snap = await getDoc(maasRef);
        const existingData = snap.exists() ? snap.data() : {};
        const existingRecords = existingData.records || {};
        const existingRow = existingRecords[String(personId)] || {};

        const saatlikUcret = (parseFloat(person.maas) || 0) / 200;
        const fazlaMesaiSaatlikUcret = saatlikUcret * 1.5;
        let eklenecekSaat = 0, tutarKarsiligi = 0;
        if (primForm.mode === 'saat') {
          eklenecekSaat = rawVal;
          tutarKarsiligi = rawVal * fazlaMesaiSaatlikUcret;
        } else {
          eklenecekSaat = fazlaMesaiSaatlikUcret > 0 ? rawVal / fazlaMesaiSaatlikUcret : 0;
          tutarKarsiligi = rawVal;
        }
        const yeniPrimSaat = (parseFloat(existingRow.prim) || 0) + eklenecekSaat;
        const yeniPrimTutar = (parseFloat(existingRow.primOdenenTutar) || 0) + tutarKarsiligi;
        const updatedRow = { ...existingRow, prim: yeniPrimSaat, primOdenenTutar: yeniPrimTutar };
        await setDoc(maasRef, { records: { ...existingRecords, [String(personId)]: updatedRow } }, { merge: true });

        await logAction({ type: 'prim', title: 'Prim Ödemesi', month: primForm.month, mode: primForm.mode, amount: rawVal, equivalentHours: eklenecekSaat, equivalentAmount: tutarKarsiligi, note: primForm.note, date: new Date().toISOString().split('T')[0] });
        if (addSystemLog) addSystemLog('Prim Ödemesi', `${person.fullName} için ${primForm.month} ayına ${primForm.mode === 'saat' ? `${rawVal} saat` : `₺${rawVal.toLocaleString('tr-TR')}`} prim girildi (Maaş Tablosu'na ${eklenecekSaat.toFixed(2)} saat olarak yansıdı).`);
        setPrimForm({ mode: 'tutar', value: '', month: nowMonth, note: '' });
        setShowPrimModal(false);
      } catch (err) {
        console.error('Prim ödemesi girilirken hata:', err);
        alert('Prim ödemesi girilirken bir hata oluştu.');
      }
      setPrimSubmitting(false);
    };

    // 2) YENİ: MAAŞ / YOL / YEMEK DURUMU — artık manuel onay yerine Maaş Tablosu'ndaki tikler canlı okunur
    // (Aşağıdaki useEffect, financeMonth her değiştiğinde ilgili aya ait 'maas' koleksiyon kaydını dinler)

    // 3) TUTANAK TUT — belge yüklenir, özlük dosyasına da otomatik eklenir
    // YENİ: Seçilen şablonu (tutanak veya belge/form) personel bilgileriyle doldurup yazdırma penceresinde açan ortak fonksiyon
    const printPersonnelTemplate = (template, formData) => {
      const printWindow = window.open('', '_blank');
      const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${person.fullName} - ${template.title}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; font-size: 10.5px; }
          .page { width: 210mm; min-height: 297mm; background: white; padding: 10mm 14mm; margin: 10mm auto; box-shadow: 0 0 10px rgba(0,0,0,0.5); position: relative; }
          @media print {
            @page { margin: 0 !important; }
            body { background: white; margin: 0; -webkit-print-color-adjust: exact; }
            .page { margin: 0; padding: 10mm 14mm; box-shadow: none; border: none; }
          }
          .header { text-align: center; border-bottom: 2px solid #d32f2f; padding-bottom: 6px; margin-bottom: 10px; display: flex; flex-direction: column; align-items: center; }
          .logo-img { height: 40px; margin-bottom: 4px; object-fit: contain; }
          .subtitle { font-size: 10px; color: #333; font-weight: bold; margin-bottom: 3px; letter-spacing: 1px; }
          .contact-info { font-size: 8.5px; color: #555; line-height: 1.2; }
          .main-title { font-size: 12px; font-weight: bold; text-align: center; margin: 8px 0 14px; padding: 7px; background: #f0f0f0; border: 1px solid #ccc; text-transform: uppercase; line-height: 1.4; }
          .section-title { font-weight: bold; font-size: 11px; color: #d32f2f; margin-top: 12px; margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10.5px; }
          td { padding: 5px 7px; border: 1px solid #ccc; vertical-align: top; }
          .label { font-weight: bold; width: 32%; background: #fafafa; }
          .paragraph { font-size: 10px; line-height: 1.5; text-align: justify; margin-bottom: 8px; }
          .desc-box { padding: 8px; border: 1px dashed #ccc; font-size: 10px; min-height: 30px; margin-bottom: 8px; background: #fafafa; line-height: 1.6; }
          .note { font-size: 9px; color: #666; font-style: italic; margin: 4px 0 8px; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img src="https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" onerror="this.style.display='none'" />
            <div class="subtitle">EVDEN EVE - ASANSÖRLÜ TAŞIMA - DEPOLAMA</div>
            <div class="contact-info">Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL | Tel: (0216) 390 89 99</div>
          </div>
          ${template.body(person, formData)}
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    };

    const generateTutanakPDF = () => {
      const template = TUTANAK_TEMPLATES.find(t => t.key === tutanakTemplateKey);
      if (!template) { alert('Lütfen önce bir tutanak şablonu seçin.'); return; }
      printPersonnelTemplate(template, tutanakForm);
    };

    // ========================================================================
    // YENİ ORTAK YARDIMCI: ÖZLÜK DOSYASINA BELGE EKLE
    // ========================================================================
    // SORUNUN KÖKÜ (düzeltilen hata):
    // Eski kod, tutanağı özlük dosyasına `tutanak_1755612345` gibi HER SEFERİNDE
    // BENZERSİZ bir anahtarla yazıyordu. Ancak Özlük Dosyaları ekranı belgeleri
    // sabit bir liste (documentTypes) üzerinden okuyor: 'tutanaklar',
    // 'saglikRaporu', 'kimlik' ... Benzersiz anahtar bu listede olmadığı için
    // belge Firebase'e yazılıyor ama HİÇBİR KARTTA GÖRÜNMÜYORDU.
    //
    // ÇÖZÜM: Belge artık ilgili SABİT belge türünün DİZİSİNE eklenir
    // ('tutanaklar' / 'saglikRaporu'). Böylece Özlük Dosyaları ekranındaki
    // ilgili kartta, mevcut belgelerin yanına satır olarak düşer.
    //
    // Ayrıca özlük ekranının "Hareketler" bölümüne de kayıt düşülür ki belgenin
    // kim tarafından, ne zaman eklendiği izlenebilsin.
    // ========================================================================
    const ozlukBelgesiEkle = async (docTypeId, belgeAdi, url, tarih) => {
      if (!url) return; // Yüklenmiş dosya yoksa özlüğe eklenecek bir şey yok
      const ozluk = person.ozlukDosyalari || {};
      // Mevcut liste normalize edilir (dizi / metin / tek nesne biçimleri)
      const mevcut = belgeListesiNormalize(ozluk[docTypeId]);
      const yeniListe = [...mevcut, { url, name: belgeAdi, date: tarih || new Date().toISOString() }];

      // Hareket kaydı — özlük ekranındaki "Hareketler" listesiyle aynı yapıda
      const hareket = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tip: 'ekleme',
        belgeAdi,
        url,
        tarih: new Date().toISOString(),
        kullanici: currentUser?.fullName || 'Sistem',
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
        ozlukDosyalari: { ...ozluk, [docTypeId]: yeniListe },
        ozlukGecmisi: [...(person.ozlukGecmisi || []), hareket]
      });
    };

    const handleTutanakSubmit = async (e) => {
      e.preventDefault();
      if (!tutanakForm.title) return;
      try {
        // DEĞİŞTİ: Artık 'tutanaklar' belge türünün dizisine ekleniyor.
        // ESKİ HALİ: ozlukDosyalari[`tutanak_${Date.now()}`] = { ... }  -> görünmüyordu
        await ozlukBelgesiEkle('tutanaklar', `Tutanak: ${tutanakForm.title}`, tutanakForm.fileUrl, tutanakForm.date);
        await logAction({ type: 'tutanak', title: tutanakForm.title, date: tutanakForm.date, note: tutanakForm.note, fileUrl: tutanakForm.fileUrl });
        if (addSystemLog) addSystemLog('Personel Tutanağı', `${person.fullName} için "${tutanakForm.title}" tutanağı eklendi.`);
        setTutanakForm({ title: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
        setShowTutanakModal(false);
      } catch (err) { console.error(err); alert('Tutanak eklenirken hata oluştu.'); }
    };

    // 4) RAPOR EKLE (Sağlık Raporu) — belge yüklenir, özlük dosyasına da otomatik eklenir
    const handleRaporSubmit = async (e) => {
      e.preventDefault();
      try {
        // DEĞİŞTİ: Tutanakla AYNI hata burada da vardı — rapor
        // `rapor_${Date.now()}` benzersiz anahtarıyla yazıldığı için Özlük
        // Dosyaları > "Sağlık Raporu" kartında görünmüyordu. Artık 'saglikRaporu'
        // belge türünün dizisine eklenir.
        await ozlukBelgesiEkle('saglikRaporu', `Sağlık Raporu (${raporForm.startDate})`, raporForm.fileUrl, raporForm.startDate);
        await logAction({ type: 'rapor', title: 'Sağlık Raporu', startDate: raporForm.startDate, endDate: raporForm.endDate, note: raporForm.note, fileUrl: raporForm.fileUrl, date: raporForm.startDate });
        if (addSystemLog) addSystemLog('Personel Sağlık Raporu', `${person.fullName} için sağlık raporu eklendi (${raporForm.startDate} - ${raporForm.endDate}).`);
        setRaporForm({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
        setShowRaporModal(false);
      } catch (err) { console.error(err); alert('Rapor eklenirken hata oluştu.'); }
    };

    const handleDeleteAction = async (actionId) => {
      if (!window.confirm('Bu hareket kaydını silmek istediğinize emin misiniz?')) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelActions', actionId));
    };

    const currentYear = new Date().getFullYear();
    const totalLeaveDaysThisYear = leaveRecords
      .filter(r => new Date(r.startDate).getFullYear() === currentYear)
      .reduce((sum, r) => sum + (parseFloat(r.days) || 0), 0);

    // YENİ: Yıllık İzin Takibi — 4857 Sayılı İş Kanunu Madde 53 uyarınca kıdeme göre otomatik hak hesabı
    const getYillikIzinHakki = (kidemYili) => {
      if (kidemYili < 1) return 0;
      if (kidemYili <= 5) return 14;
      if (kidemYili <= 15) return 20;
      return 26;
    };
    const leaveYearOptions = React.useMemo(() => {
      if (!person?.startDate) return [currentYear];
      const startYear = new Date(person.startDate).getFullYear();
      const years = [];
      for (let y = startYear; y <= currentYear; y++) years.push(y);
      return years.length > 0 ? years : [currentYear];
    }, [person?.startDate, currentYear]);
    const leaveYearSummaries = React.useMemo(() => {
      return leaveYearOptions.map(year => {
        const kidemYili = person?.startDate ? (new Date(`${year}-12-31`) - new Date(person.startDate)) / (1000 * 60 * 60 * 24 * 365.25) : 0;
        const hakEdilen = getYillikIzinHakki(kidemYili);
        const isPastYear = year < currentYear;
        const manualUsed = leaveRecords.filter(r => new Date(r.startDate).getFullYear() === year).reduce((sum, r) => sum + (parseFloat(r.days) || 0), 0);
        const kullanilan = isPastYear ? hakEdilen : manualUsed;
        const kalan = Math.max(0, hakEdilen - kullanilan);
        return { year, hakEdilen, kullanilan, kalan, isPastYear, isAuto: isPastYear };
      }).sort((a, b) => b.year - a.year);
    }, [leaveYearOptions, person?.startDate, leaveRecords, currentYear]);
    const visibleLeaveSummaries = selectedLeaveYear === 'all' ? leaveYearSummaries : leaveYearSummaries.filter(s => String(s.year) === selectedLeaveYear);

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-8">
        <button onClick={onBack} className="text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Listeye Geri Dön
        </button>

        {/* Kişisel Bilgiler */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-4 justify-between">
            <span className="flex items-center gap-2"><Briefcase className="w-6 h-6 text-red-600" /> Personel Profili</span>
            {/* YENİ: İşi Bırak Butonu (zaten ayrılmışsa gösterilmez) */}
            {!person.resignationDate && (
              <button
                type="button"
                onClick={() => { setResignForm({ date: new Date().toISOString().split('T')[0], reason: '' }); setShowResignModal(true); }}
                className="px-3 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> İşi Bırak
              </button>
            )}
          </h2>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-full bg-neutral-100 border border-neutral-300 overflow-hidden shrink-0 shadow-sm">
              {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" /> : <User className="w-10 h-10 m-5 text-neutral-400" />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-black">{person.fullName}</h3>
              <p className="text-neutral-500 text-sm font-bold flex items-center gap-2 flex-wrap">
                {person.position} • {person.rank}
                {/* UZAKTAN çalışan rozeti: bordro/puantaj dışı olduğu açıkça belli olsun */}
                {isUzaktanCalisan(person) && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300" title="Maaş, puantaj, mesai, prim ve yıllık izin süreçlerine dahil değildir">
                    UZAKTAN
                  </span>
                )}
              </p>
              <p className="text-neutral-400 text-xs font-medium mt-0.5">Başlama: {person.startDate || '-'}</p>
            </div>
          </div>

          {/* YENİ: İşten ayrılma bilgisi kartı (sadece ayrılmışsa gösterilir) */}
          {person.resignationDate && (
            <div className="bg-neutral-900 text-white p-4 rounded-xl mb-5 flex items-start gap-3">
              <LogOut className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-black text-sm">İşi Bıraktı</p>
                <p className="text-xs text-neutral-300 mt-1">Tarih: <b className="text-white">{person.resignationDate}</b></p>
                <p className="text-xs text-neutral-300 mt-0.5">Neden: <b className="text-white">{person.resignationReason || 'Belirtilmedi'}</b></p>
                {person.cikisOnaylandi ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-[11px] font-bold text-green-300 bg-green-900/40 border border-green-700 rounded-lg px-2 py-1.5 inline-block w-fit">✓ Tüm maaş ödemesi ve sözleşmeler imzalandı. Çıkış tamamlandı.</p>
                    {/* YENİ: Çıkış anındaki hakediş/maaş dökümünü salt-okunur görüntüle */}
                    {person.cikisHesapDetay && (
                      <button type="button" onClick={() => setShowExitSettlementView(true)} className="px-3 py-2 bg-white text-neutral-900 text-xs font-black rounded-lg hover:bg-neutral-100 transition flex items-center gap-1.5 w-fit">
                        <Wallet className="w-3.5 h-3.5" /> Ayrılırken Hakedişini Gör
                      </button>
                    )}
                  </div>
                ) : (
                  <button type="button" onClick={() => computeSettlement(person.resignationDate)} className="mt-2 px-3 py-2 bg-white text-neutral-900 text-xs font-black rounded-lg hover:bg-neutral-100 transition flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Çıkış Hesap Dökümünü Aç / Tamamla
                  </button>
                )}

                {/* YENİ: TEKRAR İŞE BAŞLAT — ayrılmış personeli geri alma */}
                <button
                  type="button"
                  onClick={() => { setRestartForm({ date: new Date().toISOString().split('T')[0], mod: 'yeni', araKod: 'Üİ' }); setShowRestartModal(true); }}
                  className="mt-2 px-3 py-2 bg-green-600 text-white text-xs font-black rounded-lg hover:bg-green-700 transition flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Tekrar İşe Başlat
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-sm">
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Kişisel Telefon</span><p className="font-bold text-black">{person.personalPhone || '-'}</p></div>
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Şirket Telefonu</span><p className="font-bold text-black">{person.companyPhone || '-'}</p></div>
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">E-Posta</span><p className="font-bold text-black truncate">{person.email || '-'}</p></div>
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Yaka Tipi</span><p className="font-bold text-black">{person.collarType || '-'}</p></div>
          </div>

          {/* YENİ: Personelin ne zamandır çalıştığını gösteren kıdem bildirimi */}
          {tenureText && (
            <div className="mt-3 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm font-bold">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Şirkette {tenureText}{person.startDate ? ` (İşe Başlama: ${person.startDate})` : ''}</span>
            </div>
          )}
        </div>

        {/* YENİ: Personel İşlem Butonları */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><Wallet className="w-6 h-6 text-green-600" /> Personel İşlemleri</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* KALDIRILDI (kullanıcı talebi): "Avans Girişi Yap" personel
                profilinden çıkarıldı. Avans girişi artık yalnızca Finans →
                Defter → Ödemeler sayfasındaki avans satırlarından yapılır ve
                ödeme yapılınca muhasebeye işlenir. */}
            <button type="button" onClick={() => { setTutanakForm({ title: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); setTutanakTemplateKey(''); setShowTutanakModal(true); }} className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1.5">
              <FileText className="w-5 h-5" /> Tutanak Tut
            </button>
            <button type="button" onClick={() => { setRaporForm({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); setShowRaporModal(true); }} className="p-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1.5">
              <PlusCircle className="w-5 h-5" /> Rapor Ekle
            </button>
            {/* YENİ: Bilgileri Düzenle — personelin kaydedildiği Personel Listesi ekranına gidip düzenleme (giriş bilgileri dahil) modalını otomatik açar */}
            <button type="button" onClick={() => { if (setPendingEditPersonnelId) setPendingEditPersonnelId(person.id); if (setActiveTab) setActiveTab('personnelList'); }} className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1.5">
              <Edit className="w-5 h-5" /> Bilgileri Düzenle
            </button>
            {/* YENİ: Şirkete Borç Ödemesi Yap — güncel borcu da gösterir */}
            <button type="button" onClick={() => { setDebtForm({ amount: '', month: nowMonth, note: '' }); setShowDebtModal(true); }} className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-1.5 relative col-span-2 md:col-span-1 min-h-[84px]">
              <Landmark className="w-5 h-5" /> Şirkete Borç Ödemesi
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${currentDebt > 0 ? 'bg-rose-600 text-white' : 'bg-green-100 text-green-700'}`}>
                {currentDebt > 0 ? `Güncel Borç: ₺${currentDebt.toLocaleString('tr-TR')}` : 'Borç Yok'}
              </span>
            </button>
            {/* YENİ: Prim Ödeme Gir — Maaş Tablosu'ndaki prim (fazla mesai saati) alanına saat/tutar girişi */}
            <button type="button" onClick={() => { setPrimForm({ mode: 'tutar', value: '', month: nowMonth, note: '' }); setShowPrimModal(true); }} className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-1.5 min-h-[84px]">
              <Star className="w-5 h-5" /> Prim Ödeme Gir
            </button>
            {/* ================================================================
                YENİ: HASAR BORCU TAKİBİ
                Hasarlı iş kapatılırken girilen maliyetin bu personele düşen
                payı burada izlenir. Rozet KALAN borcu gösterir; primlerden
                yapılan kesintilerle borç eridiğinde otomatik "Borç Yok" olur.
                Tıklanınca toplam / ödenen / kalan dökümü açılır.
                ================================================================ */}
            <button type="button" onClick={() => setShowHasarModal(true)} className="p-3 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-1.5 relative min-h-[84px]">
              <AlertTriangle className="w-5 h-5" /> Hasar Borcu Takibi
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${hasarKalan > 0 ? 'bg-orange-600 text-white' : 'bg-green-100 text-green-700'}`}>
                {hasarKalan > 0 ? `Kalan Borç: ₺${hasarKalan.toLocaleString('tr-TR')}` : 'Borç Yok'}
              </span>
            </button>
            {/* YENİ: PERSONEL GİRİŞ BELGELERİ — otomatik doldurulan evrakları oluştur/yazdır + yükle */}
            <div className="relative">
              <button type="button" onClick={() => setBelgeMenuOpen(belgeMenuOpen === 'giris' ? '' : 'giris')} className={`w-full p-3 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-1.5 min-h-[84px] ${belgeUploading === 'giris' ? 'opacity-60 pointer-events-none' : ''}`}>
                {belgeUploading === 'giris' ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                {belgeUploading === 'giris' ? 'Yükleniyor...' : 'Personel Giriş Belgeleri'}
              </button>
              {belgeMenuOpen === 'giris' && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBelgeMenuOpen('')}></div>
                  <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1">
                    <p className="text-[10px] font-black text-neutral-400 uppercase px-2 py-1">Oluştur & Yazdır (Otomatik Dolu)</p>
                    <button type="button" onClick={() => { generatePersonnelDocPDF(person, 'is_sozlesmesi'); setBelgeMenuOpen(''); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-neutral-700 hover:bg-green-50 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-green-600" /> Belirsiz Süreli İş Sözleşmesi</button>
                    <button type="button" onClick={() => { generatePersonnelDocPDF(person, 'isg_proseduru'); setBelgeMenuOpen(''); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-neutral-700 hover:bg-green-50 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-green-600" /> İşe Giriş ve Çalışma Prosedürleri</button>
                    <div className="border-t border-neutral-100 my-1"></div>
                    {/* Yükleme: seçilen dosya özlük dosyasına işlenir */}
                    <label className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer">
                      <Save className="w-3.5 h-3.5" /> Belge Yükle (Özlük Dosyasına)
                      <input type="file" className="hidden" onChange={(e) => { handleBelgeUpload(e, 'giris'); setBelgeMenuOpen(''); }} disabled={belgeUploading !== ''} />
                    </label>
                  </div>
                </>
              )}
            </div>
            {/* YENİ: PERSONEL ÇIKIŞ BELGELERİ — otomatik doldurulan evrakları oluştur/yazdır + yükle */}
            <div className="relative">
              <button type="button" onClick={() => setBelgeMenuOpen(belgeMenuOpen === 'cikis' ? '' : 'cikis')} className={`w-full p-3 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-1.5 min-h-[84px] ${belgeUploading === 'cikis' ? 'opacity-60 pointer-events-none' : ''}`}>
                {belgeUploading === 'cikis' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                {belgeUploading === 'cikis' ? 'Yükleniyor...' : 'Personel Çıkış Belgeleri'}
              </button>
              {belgeMenuOpen === 'cikis' && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBelgeMenuOpen('')}></div>
                  <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1">
                    <p className="text-[10px] font-black text-neutral-400 uppercase px-2 py-1">Oluştur & Yazdır (Otomatik Dolu)</p>
                    <button type="button" onClick={() => { generatePersonnelDocPDF(person, 'ibraname'); setBelgeMenuOpen(''); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-neutral-700 hover:bg-orange-50 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-orange-600" /> İbraname</button>
                    <button type="button" onClick={() => { generatePersonnelDocPDF(person, 'istifa'); setBelgeMenuOpen(''); }} className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-neutral-700 hover:bg-orange-50 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-orange-600" /> İstifa Dilekçesi</button>
                    <div className="border-t border-neutral-100 my-1"></div>
                    <label className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer">
                      <Save className="w-3.5 h-3.5" /> Belge Yükle (Özlük Dosyasına)
                      <input type="file" className="hidden" onChange={(e) => { handleBelgeUpload(e, 'cikis'); setBelgeMenuOpen(''); }} disabled={belgeUploading !== ''} />
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* YENİDEN TASARLANDI: MAAŞ / YOL / YEMEK DURUMU — Maaş Tablosu'ndaki personele ait TÜM sütunlar
            tek bir şık tabloda: simge + başlık + tutar + durum rozeti. Ödeme durumları üstte özet şerit olarak. */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          {/* Başlık şeridi: yeşil degrade + ay seçici */}
          <div className="bg-gradient-to-r from-green-600 via-emerald-700 to-emerald-900 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-black text-lg text-white flex items-center gap-2"><Wallet className="w-6 h-6" /> Maaş / Yol / Yemek Durumu</h3>
            <input
              type="month"
              value={financeMonth}
              onChange={e => setFinanceMonth(e.target.value || nowMonth)}
              className="p-2 border border-white/30 rounded-xl outline-none focus:ring-2 focus:ring-white font-bold text-sm bg-white/90"
            />
          </div>

          {/* ÖDEME DURUM ŞERİDİ: Maaş / Yol / Yemek / Prim — tik'li kompakt rozetler */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-neutral-50 border-b border-neutral-200">
            {[
              { label: 'Maaş', Icon: Wallet, paid: financeFullyPaid, partial: financeHasAvans, note: financeFullyPaid ? 'Yatırıldı' : (financeHasAvans ? 'Avans Verildi' : 'Bekleniyor') },
              { label: 'Yol Parası', Icon: Car, paid: !!financeMonthRow.yolOdendi, note: financeMonthRow.yolOdendi ? 'Yatırıldı' : 'Bekleniyor' },
              { label: 'Yemek Kartı', Icon: CreditCard, paid: !!financeMonthRow.yemekOdendi, note: financeMonthRow.yemekOdendi ? 'Yatırıldı' : 'Bekleniyor' },
              { label: 'Prim', Icon: Star, paid: financePrimOdendi, note: financePrimOdendi ? 'Ödendi' : 'Bekleniyor' },
            ].map(({ label, Icon, paid, partial, note }) => (
              <div key={label} className={`rounded-xl border-2 px-2.5 py-2 flex items-center gap-2 ${paid ? 'bg-green-50 border-green-300' : partial ? 'bg-blue-50 border-blue-300' : 'bg-white border-neutral-200'}`}>
                <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${paid ? 'bg-green-600 text-white' : partial ? 'bg-blue-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-neutral-400">{label}</span>
                  <span className={`block text-[11px] font-black leading-tight ${paid ? 'text-green-700' : partial ? 'text-blue-700' : 'text-neutral-500'}`}>{note}</span>
                </div>
              </div>
            ))}
          </div>

          {/* MAAŞ TABLOSU SÜTUNLARI — personele ait satırlar halinde şık tablo */}
          <div className="divide-y divide-neutral-100">
            {[
              // [Simge, renk sınıfları, Başlık, Değer, alt açıklama (ops), vurgu tipi]
              { Icon: CalendarDays, iconCls: 'bg-neutral-100 text-neutral-600', title: 'İşe Başlangıç Tarihi', value: person.startDate ? person.startDate.split('-').reverse().join('.') : '-', sub: tenureText ? `Şirkette ${tenureText}` : null },
              { Icon: Wallet, iconCls: 'bg-neutral-800 text-white', title: 'Tanımlı Maaş', value: `₺${financeTanimliMaas.toLocaleString('tr-TR', {maximumFractionDigits: 2})}` },
              { Icon: CalendarDays, iconCls: 'bg-sky-100 text-sky-700', title: 'Çalışılan Gün', value: `${financeMesaiGunSayisi} / 30 gün`, sub: `Rapor: ${financeRaporGunSayisi} • Devamsız: ${financeDevamsizGunSayisi} • Ücretsiz İzin: ${financeUcretsizGunSayisi}${financeIseGirisGunSayisi > 0 ? ` • İşe Giriş Öncesi: ${financeIseGirisGunSayisi}` : ''}` },
              { Icon: DollarSign, iconCls: 'bg-emerald-100 text-emerald-700', title: 'Hak Edilen Net Maaş', value: `₺${financeNetMaas.toLocaleString('tr-TR', {maximumFractionDigits: 2})}`, sub: 'Çalışılan güne göre hesaplanır' },
              { Icon: Landmark, iconCls: 'bg-indigo-100 text-indigo-700', title: 'Banka Ödemesi (Hesaplanan)', value: `₺${financeHesaplananBanka.toLocaleString('tr-TR', {maximumFractionDigits: 2})}`, sub: financeIcraVar ? `İcra kesintisi öncesi brüt banka tutarı` : null, badge: financeIcraVar ? { text: 'İcra Var', cls: 'bg-red-100 text-red-600 border-red-200' } : null },
              // YENİ: İcra varsa kesinti tutarı ayrı satırda kırmızı gösterilir
              ...(financeIcraVar ? [{ Icon: AlertTriangle, iconCls: 'bg-red-100 text-red-600', title: 'İcra Kesintisi (%25)', value: `-₺${financeIcraKesintisi.toLocaleString('tr-TR', {maximumFractionDigits: 2})}`, sub: 'Hesaplanan bankadan icraya kesilen tutar', negative: true }] : []),
              // YENİ: İcra varsa icra sonrası personele kalan banka ödemesi ayrı satırda
              ...(financeIcraVar ? [{ Icon: Landmark, iconCls: 'bg-green-100 text-green-700', title: 'İcra Sonrası Kalan Banka', value: `₺${financeIcraSonrasiKalan.toLocaleString('tr-TR', {maximumFractionDigits: 2})}`, sub: 'İcra kesintisi sonrası personele ödenecek banka tutarı', badge: { text: 'Personele', cls: 'bg-green-100 text-green-700 border-green-200' } }] : []),
              { Icon: Clock, iconCls: 'bg-blue-100 text-blue-700', title: `Mesai (${financeMonthLabel})`, value: `${financeMesaiSaat.toFixed(1)} Saat`, sub: `₺${financeMesaiTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})} mesai ücreti (prim dahil)`, badge: financeMesaiSaat > 0 ? { text: 'Var', cls: 'bg-blue-100 text-blue-700 border-blue-200' } : { text: 'Yok', cls: 'bg-neutral-100 text-neutral-400 border-neutral-200' } },
              { Icon: Star, iconCls: 'bg-yellow-100 text-yellow-700', title: 'Prim', value: financePrimTutar > 0 ? `₺${financePrimTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}` : '—', sub: financePrimSaat > 0 ? `${financePrimSaat.toFixed(1)} saat karşılığı • mesai ücretine dahildir` : null, badge: financePrimOdendi ? { text: 'Ödendi', cls: 'bg-green-100 text-green-700 border-green-200' } : (financePrimTutar > 0 ? { text: 'Bekliyor', cls: 'bg-amber-100 text-amber-700 border-amber-200' } : null) },
              { Icon: DollarSign, iconCls: 'bg-red-100 text-red-600', title: 'Kullanılan Nakit Avans', value: `₺${financeNakitAvansTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}`, negative: financeNakitAvansTutar > 0 },
              { Icon: Landmark, iconCls: 'bg-red-100 text-red-600', title: 'Kullanılan Banka Avansı', value: `₺${financeResmiAvansTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}`, negative: financeResmiAvansTutar > 0 },
              { Icon: Car, iconCls: 'bg-teal-100 text-teal-700', title: 'Yol Parası', value: financeYolTutar > 0 ? `₺${financeYolTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}` : (parseFloat(person.yol) > 0 ? `₺${parseFloat(person.yol).toLocaleString('tr-TR')}` : '—'), badge: financeMonthRow.yolOdendi ? { text: 'Yatırıldı', cls: 'bg-green-100 text-green-700 border-green-200' } : { text: 'Bekliyor', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' } },
              { Icon: CreditCard, iconCls: 'bg-purple-100 text-purple-700', title: 'Yemek Kartı', value: financeYemekTutar > 0 ? `₺${financeYemekTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}` : (parseFloat(person.yemek) > 0 ? `₺${parseFloat(person.yemek).toLocaleString('tr-TR')}` : '—'), badge: financeMonthRow.yemekOdendi ? { text: 'Yatırıldı', cls: 'bg-green-100 text-green-700 border-green-200' } : { text: 'Bekliyor', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' } },
            ].map((row, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition ${row.negative ? 'bg-red-50/40' : ''}`}>
                <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${row.iconCls}`}>
                  <row.Icon className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-black text-neutral-700">{row.title}</span>
                  {row.sub && <span className="block text-[10px] font-medium text-neutral-400 mt-0.5">{row.sub}</span>}
                </div>
                {row.badge && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${row.badge.cls}`}>{row.badge.text}</span>}
                <span className={`text-sm font-black whitespace-nowrap ${row.negative ? 'text-red-600' : 'text-black'}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* SONUÇ KARTLARI: Kalan Nakit + Kalan Banka — büyük vurgulu */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-neutral-50 border-t border-neutral-200">
            <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white p-4 shadow-lg shadow-orange-500/30">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider opacity-90"><DollarSign className="w-3.5 h-3.5" /> Kalan Nakit ({financeMonthLabel})</span>
              <span className="block text-xl md:text-2xl font-black mt-1">₺{financeKalanNakit.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-white p-4 shadow-lg shadow-yellow-500/30">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider opacity-90"><Landmark className="w-3.5 h-3.5" /> Kalan Banka ({financeMonthLabel})</span>
              <span className="block text-xl md:text-2xl font-black mt-1">₺{financeKalanBanka.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>
            </div>
          </div>

          {/* TOPLAM ÖDENEN — alt bant */}
          <div className="bg-neutral-900 text-white px-4 py-3 flex justify-between items-center">
            <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> Toplam Ödenen ({financeMonthLabel})</span>
            <span className="text-lg font-black text-green-400">₺{financeToplamOdenenTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>
          </div>
        </div>
        {/* Dönem Filtresi ve Özet */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><BarChart className="w-6 h-6 text-blue-600" /> Performans Özeti</h3>
            <div className="flex bg-neutral-100 p-1 rounded-xl flex-wrap">
              {[{ k: 'week', l: 'Bu Hafta' }, { k: 'month', l: 'Bu Ay' }, { k: 'lastMonth', l: 'Geçen Ay' }, { k: 'year', l: 'Bu Sene' }, { k: 'all', l: 'Tüm Zamanlar' }].map(opt => (
                <button key={opt.k} type="button" onClick={() => setPeriodFilter(opt.k)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${periodFilter === opt.k ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center">
              {/* DEĞİŞTİ (kullanıcı talebi): Operasyon pozisyonunda KİŞİSEL değil,
                  şirket geneli "tamamlanan Nakliye+Depo işi" sayısı gösterilir
                  (iptal edilenler status !== 'completed' olduğu için otomatik hariç). */}
              <span className="text-3xl font-black text-black block">{isOperasyonPozisyonu ? operasyonYapilanIsSayisi : periodJobsCount}</span>
              <span className="text-xs font-bold text-neutral-500">Yapılan İş</span>
              {isOperasyonPozisyonu && <span className="block text-[9px] font-bold text-neutral-400 mt-0.5">Tüm ekipler • Nakliye+Depo</span>}
            </div>
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
              {/* DEĞİŞTİ (kullanıcı talebi): Operasyon pozisyonunda puan TOPLAMI
                  değil, tüm ekiplerin aldığı yorum/değerlendirme SAYISI gösterilir.
                  Diğer pozisyonlarda eski davranış (puantaj puan toplamı) korunur. */}
              {isOperasyonPozisyonu ? (
                <span className="text-3xl font-black text-yellow-600 block">{operasyonAlinanYorumSayisi}</span>
              ) : (() => {
                const _v = puantajPointsTotal !== null ? puantajPointsTotal : periodYorumPuani;
                return <span className="text-3xl font-black text-yellow-600 block">{_v % 1 === 0 ? _v : _v.toFixed(1).replace('.', ',')}</span>;
              })()}
              <span className="text-xs font-bold text-yellow-700">Alınan Yorum</span>
              {isOperasyonPozisyonu && <span className="block text-[9px] font-bold text-yellow-500 mt-0.5">Tüm ekipler</span>}
            </div>
            {/* YENİ: Ekibine hasar kaydı yazılmış iş sayısı (Operasyon'da: tüm ekipler) */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center">
              <span className="text-3xl font-black text-red-600 block">{isOperasyonPozisyonu ? operasyonHasarliIsSayisi : periodDamagesCount}</span>
              <span className="text-xs font-bold text-red-700">Hasarlı İş</span>
              {isOperasyonPozisyonu && <span className="block text-[9px] font-bold text-red-400 mt-0.5">Tüm ekipler</span>}
            </div>
            {/* YENİ: SAHA PUANI — şeflerin saha denetiminde verdiği 1-5 puanların ortalaması.
                Hiç puan verilmemiş personelde her zaman 0 görünür.
                DEĞİŞTİ (kullanıcı talebi): Operasyon pozisyonunda ortalama puan yerine
                TOPLAM SAHA DENETİMİ SAYISI (şirket geneli, döneme göre) gösterilir. */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-center">
              <span className="text-3xl font-black text-purple-700 block">
                {isOperasyonPozisyonu ? operasyonSahaDenetimSayisi : (sahaPuanOrtalamasi % 1 === 0 ? sahaPuanOrtalamasi : String(sahaPuanOrtalamasi).replace('.', ','))}
              </span>
              <span className="text-xs font-bold text-purple-700">Saha Puanı</span>
              <span className="block text-[9px] font-bold text-purple-400 mt-0.5">
                {isOperasyonPozisyonu
                  ? 'Toplam saha denetimi (tüm ekipler)'
                  : (sahaPuanDonem.length > 0 ? `${sahaPuanDonem.length} denetim • 5 üzerinden` : 'Henüz şef denetimi yok')}
              </span>
            </div>
            {/* YENİ: Mesai/puantaj tabanlı sayaçlar */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
              <span className="text-3xl font-black text-blue-600 block">{periodFazlaMesaiSayisi}</span>
              <span className="text-xs font-bold text-blue-700">Fazla Mesai</span>
              <span className="block text-[9px] font-bold text-blue-400 mt-0.5">Toplam saat (Personel Muhasebe ile aynı)</span>
            </div>
            {/* YENİ: Fazla Gün (FG) + Fazla Gün+Mesai (FGM) toplamı */}
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 text-center">
              <span className="text-3xl font-black text-indigo-600 block">{periodFazlaGunMesaiSayisi}</span>
              <span className="text-xs font-bold text-indigo-700">Fazla Gün</span>
              <span className="block text-[9px] font-bold text-indigo-400 mt-0.5">Fazla Gün: {periodFazlaGunSayisi} + Mesai: {periodFazlaGunMesaiSayisi - periodFazlaGunSayisi}</span>
            </div>
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center">
              <span className="text-3xl font-black text-neutral-600 block">{periodDevamsizlikSayisi}</span>
              <span className="text-xs font-bold text-neutral-500">Devamsızlık</span>
            </div>
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center">
              <span className="text-3xl font-black text-neutral-600 block">{periodRaporGunSayisi}</span>
              <span className="text-xs font-bold text-neutral-500">Raporlu Gün</span>
            </div>
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center">
              <span className="text-3xl font-black text-neutral-600 block">{periodUcretliIzinSayisi}</span>
              <span className="text-xs font-bold text-neutral-500">Ücretli İzin</span>
            </div>
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center">
              <span className="text-3xl font-black text-neutral-600 block">{periodUcretsizIzinSayisi}</span>
              <span className="text-xs font-bold text-neutral-500">Ücretsiz İzin</span>
            </div>
          </div>
        </div>


        {/* YENİ: Personel Hareket İşlemleri (Maaş + Mesai + Yorum birleşik akış, aylık filtreli) */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><History className="w-6 h-6 text-purple-600" /> Personel Hareket İşlemleri</h3>
            {/* Aylık filtre */}
            <div className="flex items-center gap-2 bg-neutral-100 p-2 rounded-xl border border-neutral-200 w-full md:w-auto">
              <CalendarDays className="w-4 h-4 text-neutral-500 ml-1" />
              <input
                type="month"
                value={hareketMonth}
                onChange={e => { setHareketMonth(e.target.value); setShowAllHareket(false); }}
                className="bg-transparent border-none outline-none font-bold text-black cursor-pointer px-1 text-sm"
              />
            </div>
          </div>

          {gorunenHareketler.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">{hareketAyEtiketi} için bir hareket kaydı yok.</p>
          ) : (
            <>
              <div className="space-y-2.5">
                {gorunenHareketler.map(h => {
                  // Maaş hareketleri (avans/onay/tutanak/rapor/borç) — silme/görüntüleme düğmeleri korunur
                  if (h.kaynak === 'action') {
                    const typeStyles = {
                      avans: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-600', icon: <DollarSign className="w-4 h-4 text-white" /> },
                      onay: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-600', icon: <CheckCircle className="w-4 h-4 text-white" /> },
                      tutanak: { bg: 'bg-neutral-50 border-neutral-200', badge: 'bg-neutral-700', icon: <FileText className="w-4 h-4 text-white" /> },
                      rapor: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-600', icon: <PlusCircle className="w-4 h-4 text-white" /> },
                      borcOdeme: { bg: 'bg-rose-50 border-rose-200', badge: 'bg-rose-600', icon: <Landmark className="w-4 h-4 text-white" /> },
                      // YENİ: Hasar hareketleri — borç yazımı ve primden kesinti
                      hasarBorcu: { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-600', icon: <AlertTriangle className="w-4 h-4 text-white" /> },
                      hasarKesinti: { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500', icon: <AlertTriangle className="w-4 h-4 text-white" /> }
                    };
                    const st = typeStyles[h.type] || typeStyles.tutanak;
                    return (
                      <div key={h.key} className={`border p-3 rounded-xl flex items-center justify-between gap-3 ${st.bg}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${st.badge}`}>{st.icon}</div>
                          <div className="min-w-0">
                            <span className="font-bold text-black text-sm block truncate">
                              {h.title}
                              {h.amount > 0 && <span className="text-green-700"> — ₺{parseFloat(h.amount).toLocaleString('tr-TR')}</span>}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-medium">
                              {h.month ? `Dönem: ${h.month}` : ''} {h.raw?.date ? `• ${h.raw.date}` : ''} {h.endDate ? `→ ${h.endDate}` : ''} {h.note ? `• ${h.note}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {h.fileUrl && (
                            <button onClick={() => setViewingImage && setViewingImage({ title: h.title, name: h.fileUrl })} className="p-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-100 transition" title="Belgeyi Gör">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteAction(h.raw.id)} className="p-1.5 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition" title="Sil">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  // Yorum / Puan kaydı (salt-okunur)
                  if (h.kaynak === 'yorum') {
                    return (
                      <div key={h.key} className="border p-3 rounded-xl flex items-center gap-3 bg-yellow-50 border-yellow-200">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-yellow-500"><Star className="w-4 h-4 text-white" /></div>
                        <div className="min-w-0">
                          <span className="font-bold text-black text-sm block truncate">{h.title}</span>
                          <span className="text-[10px] text-neutral-500 font-medium">{h.dateStr}</span>
                        </div>
                      </div>
                    );
                  }
                  // YENİ: Şef saha denetimi kaydı (salt-okunur) — verilen puan ve şefin notu
                  if (h.kaynak === 'saha') {
                    return (
                      <div key={h.key} className="border p-3 rounded-xl flex items-start gap-3 bg-purple-50 border-purple-200">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-purple-600"><ClipboardCheck className="w-4 h-4 text-white" /></div>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-black text-sm block">{h.title}</span>
                          {h.note && <span className="text-[11px] text-purple-700 font-medium block break-words mt-0.5">{h.note}</span>}
                          <span className="text-[10px] text-neutral-500 font-medium">{h.dateStr}</span>
                        </div>
                      </div>
                    );
                  }
                  // Mesai / Devamsızlık / İzin kaydı (salt-okunur)
                  return (
                    <div key={h.key} className={`border p-3 rounded-xl flex items-center gap-3 ${h.styleBg}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${h.styleBadge}`}>{h.icon}</div>
                      <div className="min-w-0">
                        <span className="font-bold text-black text-sm block truncate">{h.title}</span>
                        <span className="text-[10px] text-neutral-500 font-medium">{h.dateStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tümünü Gör / Daha Az Göster (5'ten fazla hareket varsa) */}
              {birlesikHareketler.length > 5 && (
                <button
                  onClick={() => setShowAllHareket(!showAllHareket)}
                  className="mt-3 w-full py-2.5 text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition"
                >
                  {showAllHareket ? 'Daha Az Göster' : `Tümünü Gör (${birlesikHareketler.length} hareket)`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Kıyafet Takibi */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex justify-between items-center mb-4 gap-2">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><Shirt className="w-6 h-6 text-indigo-600" /> Kıyafet Takibi</h3>
            <div className="flex items-center gap-2 shrink-0">
              {/* YENİ: "Tutanak Hazırla" — kayıtlı en son kıyafeti (varsa) hazır getirir,
                  yoksa boş formla açar. Aynı pencereden sözleşme yazdırılır, imzalı belge
                  yüklenir ve bu belge otomatik olarak Özlük Dosyaları > Fazladan Belgeler
                  altına da kaydedilir. */}
              <button
                type="button"
                onClick={() => {
                  if (clothingRecords.length > 0) {
                    const r = clothingRecords[0];
                    setEditingClothingId(r.id);
                    setClothingForm({ item: r.item || '', date: r.date || new Date().toISOString().split('T')[0], note: r.note || '', fileUrl: r.fileUrl || '' });
                  } else {
                    setEditingClothingId(null);
                    setClothingForm({ item: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
                  }
                  setShowClothingModal(true);
                }}
                className="px-3 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> Tutanak Hazırla
              </button>
              <button type="button" onClick={() => { setEditingClothingId(null); setClothingForm({ item: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); setShowClothingModal(true); }} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Kıyafet Ekle
              </button>
            </div>
          </div>
          {clothingRecords.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Henüz kıyafet verilmemiş.</p>
          ) : (
            <>
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl mb-3">
                <span className="text-[10px] font-bold text-indigo-500 uppercase block">Son Verilen</span>
                <span className="font-black text-indigo-800">{clothingRecords[0].item} <span className="font-medium text-xs text-indigo-500">({clothingRecords[0].date})</span></span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                {clothingRecords.map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-xs gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-black block truncate">{r.item} {r.note && <span className="font-medium text-neutral-500">— {r.note}</span>}</span>
                      <span className="text-neutral-400 font-bold">{r.date}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.fileUrl && (
                        <button type="button" onClick={() => setViewingImage && setViewingImage({ title: `${r.item} - İmzalı Belge`, name: r.fileUrl })} className="p-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition" title="İmzalı Belgeyi Gör">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* YENİ: Kaydı düzenleme butonu */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClothingId(r.id);
                          setClothingForm({ item: r.item || '', date: r.date || new Date().toISOString().split('T')[0], note: r.note || '', fileUrl: r.fileUrl || '' });
                          setShowClothingModal(true);
                        }}
                        className="p-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-100 transition"
                        title="Düzenle"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Telefon Takibi */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex justify-between items-center mb-4 gap-2">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><Smartphone className="w-6 h-6 text-teal-600" /> Telefon Takibi</h3>
            <div className="flex items-center gap-2 shrink-0">
              {/* YENİ: "Tutanak Hazırla" — kayıtlı en son telefonu (varsa) hazır getirir,
                  yoksa boş formla açar. Aynı pencereden sözleşme yazdırılır, imzalı belge
                  yüklenir ve bu belge otomatik olarak Özlük Dosyaları > Fazladan Belgeler
                  altına da kaydedilir. */}
              <button
                type="button"
                onClick={() => {
                  if (phoneRecords.length > 0) {
                    const r = phoneRecords[0];
                    setEditingPhoneId(r.id);
                    setPhoneForm({ model: r.model || '', date: r.date || new Date().toISOString().split('T')[0], note: r.note || '', fileUrl: r.fileUrl || '' });
                  } else {
                    setEditingPhoneId(null);
                    setPhoneForm({ model: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' });
                  }
                  setShowPhoneModal(true);
                }}
                className="px-3 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> Tutanak Hazırla
              </button>
              <button type="button" onClick={() => { setEditingPhoneId(null); setPhoneForm({ model: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); setShowPhoneModal(true); }} className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Telefon Ekle
              </button>
            </div>
          </div>
          {phoneRecords.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Henüz şirket telefonu verilmemiş.</p>
          ) : (
            <div className="space-y-1.5">
              {phoneRecords.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-xs gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-black block truncate">{r.model} {r.note && <span className="font-medium text-neutral-500">— {r.note}</span>}</span>
                    <span className="text-neutral-400 font-bold">{r.date}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.fileUrl && (
                      <button type="button" onClick={() => setViewingImage && setViewingImage({ title: `${r.model} - İmzalı Belge`, name: r.fileUrl })} className="p-1.5 bg-white border border-teal-200 text-teal-600 rounded-lg hover:bg-teal-50 transition" title="İmzalı Belgeyi Gör">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* YENİ: Kaydı düzenleme butonu */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPhoneId(r.id);
                        setPhoneForm({ model: r.model || '', date: r.date || new Date().toISOString().split('T')[0], note: r.note || '', fileUrl: r.fileUrl || '' });
                        setShowPhoneModal(true);
                      }}
                      className="p-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-100 transition"
                      title="Düzenle"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Yıllık İzin Takibi */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><CalendarDays className="w-6 h-6 text-orange-500" /> Yıllık İzin Takibi</h3>
            <div className="flex items-center gap-2">
              <select value={selectedLeaveYear} onChange={e => setSelectedLeaveYear(e.target.value)} className="p-2 border border-neutral-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-neutral-50 text-neutral-700 font-bold cursor-pointer">
                {leaveYearOptions.slice().reverse().map(y => <option key={y} value={String(y)}>{y}</option>)}
                <option value="all">Tüm Yıllar</option>
              </select>
              <button type="button" onClick={() => setShowLeaveModal(true)} className="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> İzin Ekle
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {visibleLeaveSummaries.map(s => (
              <div key={s.year} className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-orange-500 uppercase">{s.year} {s.isPastYear && <span className="text-neutral-400 normal-case">(geçmiş yıl)</span>}</span>
                  <span className="text-[10px] font-bold text-orange-400">Hak: {s.hakEdilen} gün</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-black text-orange-800">{s.kullanilan} gün kullanılan</span>
                  <span className={`font-black ${s.kalan > 0 ? 'text-green-700' : 'text-neutral-400'}`}>{s.kalan} gün kalan</span>
                </div>
              </div>
            ))}
          </div>
          {leaveRecords.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Henüz yıllık izin kaydı yok.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
              {leaveRecords.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-xs">
                  <span className="font-bold text-black">{r.startDate} → {r.endDate} {r.note && <span className="font-medium text-neutral-500">— {r.note}</span>}</span>
                  <span className="text-orange-600 font-black shrink-0 ml-2">{r.days} gün</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Özellikler / Yetenek Kartı — sadece uygun mavi yaka personelde gösterilir */}
        {showSkillsSection && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-lg text-black flex items-center gap-2"><Award className="w-6 h-6 text-purple-600" /> Özellikler</h3>
              <p className="text-[11px] text-neutral-400 font-medium mt-0.5">Puanlar sistemdeki gerçek verilerden (işler, tutanaklar, mesai) otomatik hesaplanır.</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-neutral-400 uppercase block">Ortalama Puan</span>
              <span className={`text-2xl font-black ${getSkillTextColor(avgSkill)}`}>{avgSkill}</span>
            </div>
          </div>
          <div className="space-y-3">
            {visibleSkillDefs.map(s => {
              const val = typeof skills[s.key] === 'number' ? skills[s.key] : 50;
              return (
                <div key={s.key} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-bold text-black">{s.label}</span>
                    <span className={`text-sm font-black ${getSkillTextColor(val)}`}>{val}</span>
                  </div>
                  <div className="flex-1 h-3 bg-neutral-200 rounded-full overflow-hidden">
                    <div className={`h-full ${getSkillBarColor(val)} transition-all duration-300`} style={{ width: `${val}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          {isManagerUser && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <button type="button" onClick={() => { setEvalForm({ skillKey: visibleSkillDefs[0]?.key || '', delta: '', reason: '' }); setShowEvalModal(true); }} className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
                <Award className="w-4 h-4" /> Personeli Değerlendir
              </button>
              {skillAdjustments.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                  {skillAdjustments.slice(0, 5).map(adj => (
                    <div key={adj.id} className="text-[11px] text-neutral-500 flex justify-between gap-2">
                      <span className="truncate">{PERSONNEL_SKILL_DEFS.find(s => s.key === adj.skillKey)?.label || adj.skillKey}: {adj.reason}</span>
                      <span className={`font-bold shrink-0 ${adj.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{adj.delta > 0 ? '+' : ''}{adj.delta}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {showEvalModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEvalModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-black mb-4">Personeli Değerlendir</h3>
              <form onSubmit={handleSubmitEval} className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Özellik</label>
                  <select required value={evalForm.skillKey} onChange={e => setEvalForm({ ...evalForm, skillKey: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                    {visibleSkillDefs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Puan Değişimi (+/-)</label>
                  <input required type="number" value={evalForm.delta} onChange={e => setEvalForm({ ...evalForm, delta: e.target.value })} placeholder="Örn: 5 veya -5" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Gerekçe</label>
                  <textarea required value={evalForm.reason} onChange={e => setEvalForm({ ...evalForm, reason: e.target.value })} rows={3} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowEvalModal(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition">İptal</button>
                  <button type="submit" className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition">Kaydet</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Son Yaptığı İşler */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-red-600" /> Son Yaptığı İşler</h3>
          <div className="space-y-2.5">
            {recentJobs.length === 0 ? <p className="text-sm text-neutral-500 italic">Henüz bir işe atanmamış.</p> : recentJobs.map(job => (
              <div key={job.id} className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-black block">{job.customerName}</span>
                  <span className="text-[10px] text-neutral-500 font-bold">{job.date} • {job.type || 'Nakliye'}</span>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${job.status === 'completed' ? 'bg-black text-white' : job.status === 'in-progress' ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                  {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Son Yorum Aldığı İşler */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><Star className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Son Yorum Aldığı İşler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentReviewedJobs.length === 0 ? <p className="text-sm text-neutral-500 italic col-span-full">Henüz yorum alınmış bir iş yok.</p> : recentReviewedJobs.map(job => (
              <div key={job.id} className="bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden cursor-pointer group" onClick={() => setViewingImage && setViewingImage({ title: 'Müşteri Yorumu', name: job.reviewImage })}>
                <div className="w-full h-24 bg-neutral-200">
                  {isVideoUrl(job.reviewImage) ? <video src={job.reviewImage} className="w-full h-full object-cover" muted /> : <img src={job.reviewImage} className="w-full h-full object-cover group-hover:scale-105 transition" alt="" />}
                </div>
                <div className="p-2">
                  <span className="text-[10px] font-bold text-black block truncate">{job.customerName}</span>
                  <span className="text-[9px] text-neutral-500">{job.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* YENİ: Son Hasar Alınan İşler — ekibine hasar kaydı yazılmış son işler */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-red-600" /> Son Hasar Alınan İşler</h3>
          {recentDamagedJobs.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Bu personelin ekibine yazılmış herhangi bir hasar kaydı yok. 🎉</p>
          ) : (
            <div className="space-y-2.5">
              {recentDamagedJobs.map(job => {
                const damageImg = job.endJobDetails?.damageImages?.[0];
                return (
                  <div key={job.id} className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-3">
                    {damageImg && (
                      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-red-100 cursor-pointer" onClick={() => setViewingImage && setViewingImage({ title: 'Hasar Fotoğrafı', name: damageImg })}>
                        {isVideoUrl(damageImg) ? <video src={damageImg} className="w-full h-full object-cover" muted /> : <img src={damageImg} className="w-full h-full object-cover" alt="" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-black text-sm block truncate">{job.customerName} <span className="text-[10px] font-medium text-neutral-500">({job.type || 'Nakliye'})</span></span>
                      <span className="text-[10px] text-neutral-500 block">{job.date}</span>
                      {job.endJobDetails?.damageDetails && <p className="text-[11px] text-red-700 font-medium mt-1 line-clamp-2">{job.endJobDetails.damageDetails}</p>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${job.endJobDetails?.damageResolved ? 'bg-green-100 text-green-700' : 'bg-red-600 text-white'}`}>
                      {job.endJobDetails?.damageResolved ? 'Çözüldü' : 'Bekliyor'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Özlük Dosyaları Kısayolu */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-3 flex items-center gap-2"><FolderOpen className="w-6 h-6 text-red-600" /> Özlük Dosyaları</h3>
          <p className="text-sm text-neutral-500 mb-3">Bu personele ait kimlik, ehliyet, sözleşme gibi belgeleri Özlük Dosyaları modülünden görüntüleyip yükleyebilirsiniz.</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 text-neutral-600 text-xs font-bold rounded-lg">
              <FolderOpen className="w-3.5 h-3.5" /> {Object.keys(person.ozlukDosyalari || {}).length} belge yüklü
            </span>
            {/* YENİ: Özlük Dosyaları modülüne yönlendiren buton */}
            {setActiveTab && (
              <button
                type="button"
                onClick={() => setActiveTab('ozlukDosyalari')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Özlük Dosyalarına Git
              </button>
            )}
          </div>
        </div>

        {/* Kıyafet Ekleme Modalı */}
        {showClothingModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="bg-indigo-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-lg">{editingClothingId ? 'Kıyafet Kaydını Düzenle' : 'Kıyafet Ekle'}</h3>
                <button onClick={() => { setShowClothingModal(false); setEditingClothingId(null); setClothingForm({ item: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); }} className="text-indigo-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAddClothing} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Kıyafet / Ekipman</label>
                  <input required type="text" value={clothingForm.item} onChange={e => setClothingForm({ ...clothingForm, item: e.target.value })} placeholder="Örn: Mont, Tişört, Ayakkabı" className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                  <input required type="date" value={clothingForm.date} onChange={e => setClothingForm({ ...clothingForm, date: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Not (İsteğe Bağlı)</label>
                  <input type="text" value={clothingForm.note} onChange={e => setClothingForm({ ...clothingForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
                </div>

                {/* YENİ: PDF Zimmet Sözleşmesi Hazırla ve Yazdır — personel profiline göre otomatik doldurulur */}
                <button
                  type="button"
                  onClick={generateClothingContractPDF}
                  disabled={!clothingForm.item}
                  className="w-full py-3 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl transition flex justify-center items-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" /> Zimmet Sözleşmesi Hazırla / Yazdır
                </button>

                {/* YENİ: İmzalattığımız belgeyi ekleme (Şimdi Çek / Galeriden / Dosyadan) */}
                <div>
                  <label className="block text-sm font-bold text-black mb-1">İmzalı Belgeyi Ekle (İsteğe Bağlı)</label>
                  <MediaCaptureMenu
                    disabled={clothingUploading}
                    buttonLabel={clothingForm.fileUrl ? 'Belge Yüklendi ✓' : 'İmzalı Belgeyi Yükle'}
                    onChange={handleClothingFileUpload}
                  />
                  {clothingUploading && <p className="text-xs text-neutral-400 mt-1.5 animate-pulse">Yükleniyor...</p>}
                </div>

                <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition">{editingClothingId ? 'Güncelle' : 'Kaydet'}</button>
              </form>
            </div>
          </div>
        )}

        {/* Telefon Ekleme Modalı */}
        {showPhoneModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="bg-teal-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-lg">{editingPhoneId ? 'Telefon Kaydını Düzenle' : 'Telefon Ekle'}</h3>
                <button onClick={() => { setShowPhoneModal(false); setEditingPhoneId(null); setPhoneForm({ model: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); }} className="text-teal-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAddPhone} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Telefon Modeli</label>
                  <input required type="text" value={phoneForm.model} onChange={e => setPhoneForm({ ...phoneForm, model: e.target.value })} placeholder="Örn: Samsung A14" className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                  <input required type="date" value={phoneForm.date} onChange={e => setPhoneForm({ ...phoneForm, date: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Not / Hat Numarası (İsteğe Bağlı)</label>
                  <input type="text" value={phoneForm.note} onChange={e => setPhoneForm({ ...phoneForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-600" />
                </div>

                {/* YENİ: PDF Zimmet Sözleşmesi Hazırla ve Yazdır — personel profiline göre otomatik doldurulur */}
                <button
                  type="button"
                  onClick={generatePhoneContractPDF}
                  disabled={!phoneForm.model}
                  className="w-full py-3 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl transition flex justify-center items-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" /> Zimmet Sözleşmesi Hazırla / Yazdır
                </button>

                {/* YENİ: İmzalattığımız belgeyi ekleme (Şimdi Çek / Galeriden / Dosyadan) */}
                <div>
                  <label className="block text-sm font-bold text-black mb-1">İmzalı Belgeyi Ekle (İsteğe Bağlı)</label>
                  <MediaCaptureMenu
                    disabled={phoneUploading}
                    buttonLabel={phoneForm.fileUrl ? 'Belge Yüklendi ✓' : 'İmzalı Belgeyi Yükle'}
                    onChange={handlePhoneFileUpload}
                  />
                  {phoneUploading && <p className="text-xs text-neutral-400 mt-1.5 animate-pulse">Yükleniyor...</p>}
                </div>

                <button type="submit" className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition">{editingPhoneId ? 'Güncelle' : 'Kaydet'}</button>
              </form>
            </div>
          </div>
        )}

        {/* Yıllık İzin Ekleme Modalı */}
        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-orange-500 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg">Yıllık İzin Ekle</h3>
                <button onClick={() => setShowLeaveModal(false)} className="text-orange-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAddLeave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Başlangıç</label>
                    <input required type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Bitiş</label>
                    <input required type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Kaç Gün</label>
                  <input required type="number" value={leaveForm.days} onChange={e => setLeaveForm({ ...leaveForm, days: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Not (İsteğe Bağlı)</label>
                  <input type="text" value={leaveForm.note} onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <button type="submit" className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition">Kaydet</button>
              </form>
            </div>
          </div>
        )}

        {/* YENİ: İşi Bırakma Modalı */}
        {/* ====================================================================
            YENİ: TEKRAR İŞE BAŞLATMA PENCERESİ (iki seçenekli)
            ==================================================================== */}
        {showRestartModal && (
          <div className="fixed inset-0 bg-black/70 z-[130] flex items-center justify-center p-4" onClick={() => setShowRestartModal(false)}>
            <form onSubmit={handleRestartPersonnel} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-700 text-white flex justify-between items-center sticky top-0">
                <div>
                  <h3 className="font-black flex items-center gap-2"><UserPlus className="w-5 h-5" /> Tekrar İşe Başlat</h3>
                  <p className="text-xs font-bold opacity-90">{person.fullName}</p>
                </div>
                <button type="button" onClick={() => setShowRestartModal(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                {/* Mevcut ayrılış bilgisi */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-[11px] font-bold text-neutral-600">
                  Ayrılış: <b className="text-black">{person.resignationDate || '-'}</b> • Neden: <b className="text-black">{person.resignationReason || 'Belirtilmedi'}</b>
                </div>

                {/* Dönüş tarihi */}
                <div>
                  <label className="block text-xs font-black text-neutral-600 uppercase mb-1.5">İşe Dönüş Tarihi *</label>
                  <input type="date" required value={restartForm.date}
                    onChange={e => setRestartForm({ ...restartForm, date: e.target.value })}
                    className="w-full p-3 border-2 border-neutral-300 rounded-xl font-black text-sm outline-none focus:border-green-600" />
                </div>

                {/* İKİ SEÇENEK */}
                <div>
                  <label className="block text-xs font-black text-neutral-600 uppercase mb-2">Nasıl devam edilsin?</label>
                  <div className="space-y-2">
                    <button type="button" onClick={() => setRestartForm({ ...restartForm, mod: 'yeni' })}
                      className={`w-full text-left p-3 rounded-xl border-2 transition ${restartForm.mod === 'yeni' ? 'border-green-600 bg-green-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                      <p className="font-black text-sm text-black flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${restartForm.mod === 'yeni' ? 'border-green-600 bg-green-600' : 'border-neutral-300'}`}></span>
                        Yeni giriş gibi başlat
                      </p>
                      <p className="text-[11px] font-bold text-neutral-500 mt-1 pl-6">
                        İşe başlama tarihi <b>seçtiğiniz tarih</b> olur. Ayrılış ile dönüş arasındaki günlere hiçbir şey yazılmaz;
                        o dönemde personel şirkette değildi. Kıdem yeniden başlar.
                      </p>
                    </button>

                    <button type="button" onClick={() => setRestartForm({ ...restartForm, mod: 'kesintisiz' })}
                      className={`w-full text-left p-3 rounded-xl border-2 transition ${restartForm.mod === 'kesintisiz' ? 'border-green-600 bg-green-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                      <p className="font-black text-sm text-black flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${restartForm.mod === 'kesintisiz' ? 'border-green-600 bg-green-600' : 'border-neutral-300'}`}></span>
                        Hiç ayrılmamış gibi devam et
                      </p>
                      <p className="text-[11px] font-bold text-neutral-500 mt-1 pl-6">
                        İlk işe başlama tarihi <b>korunur</b> (kıdem devam eder). Gelmediği günler aşağıda seçtiğiniz kodla doldurulur.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Kesintisiz seçilirse: ara günlere hangi kod yazılacak */}
                {restartForm.mod === 'kesintisiz' && (
                  <div className="animate-in fade-in">
                    <label className="block text-xs font-black text-neutral-600 uppercase mb-1.5">Gelmediği günlere ne yazılsın?</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ kod: 'Üİ', ad: 'Ücretsiz İzin', not: 'Maaş hesabına dahil edilmez' },
                        { kod: 'D', ad: 'Devamsız', not: 'Devamsızlık olarak işlenir' }].map(o => (
                        <button key={o.kod} type="button" onClick={() => setRestartForm({ ...restartForm, araKod: o.kod })}
                          className={`p-3 rounded-xl border-2 text-left transition ${restartForm.araKod === o.kod ? 'border-green-600 bg-green-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                          <p className="font-black text-sm text-black">{o.ad}</p>
                          <p className="text-[10px] font-bold text-neutral-500 mt-0.5">{o.not}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Personel <b>Aktif</b> yapılacak, ayrılış kaydı ve otomatik yazılmış "İB (İşi Bıraktı)" günleri temizlenecek.
                  Bu ayrılış-dönüş bilgisi personelin çalışma geçmişine not olarak eklenir.
                </p>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowRestartModal(false)} className="flex-1 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-black text-sm hover:bg-neutral-200">Vazgeç</button>
                  <button type="submit" disabled={restartKaydediliyor} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-black text-sm hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg">
                    {restartKaydediliyor ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor</> : <><UserPlus className="w-4 h-4" /> İşe Başlat</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {showResignModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-neutral-900 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><LogOut className="w-5 h-5 text-red-400" /> İşi Bırak</h3>
                <button onClick={() => setShowResignModal(false)} className="text-neutral-300 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleResignPersonnel} className="p-6 space-y-4">
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Bu işlem personeli seçtiğiniz tarih itibarıyla pasif yapar; o tarihten sonraki günler mesai tablosunda otomatik "İB (İşi Bıraktı)" olarak işlenir ve maaş hesabına dahil edilmez. Personel, bu tarihten sonraki ekip/puantaj listelerinde görünmez.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">İşi Bırakma Tarihi</label>
                  <input required type="date" value={resignForm.date} onChange={e => setResignForm({ ...resignForm, date: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-neutral-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Ayrılma Nedeni</label>
                  <textarea value={resignForm.reason} onChange={e => setResignForm({ ...resignForm, reason: e.target.value })} placeholder="Örn: Kendi isteğiyle ayrıldı, performans yetersizliği vb." className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-neutral-800 h-20 resize-none" />
                </div>
                <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2">
                  <LogOut className="w-5 h-5" /> İşi Bırakmayı Onayla
                </button>
              </form>
            </div>
          </div>
        )}

        {/* YENİ: İŞTEN ÇIKIŞ — KESİN HESAP DÖKÜMÜ, ONAY VE İMZALI BELGE MODALI */}
        {showSettlementModal && settlementData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-start md:items-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-700 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-lg flex items-center gap-2"><LogOut className="w-5 h-5 text-red-400" /> İşten Çıkış Hesap Dökümü</h3>
                <button onClick={() => setShowSettlementModal(false)} className="text-neutral-300 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Personel & Tarih bilgisi */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm">
                  <p className="font-black text-black">{person.fullName}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">{person.position || person.rank || '-'} • Çıkış Tarihi: <span className="font-bold text-black">{settlementData.dateStr}</span></p>
                </div>

                {/* Neden bu paranın kaldığını açıklayan tablo */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="bg-neutral-800 text-white px-3 py-2 text-xs font-black uppercase tracking-wide">Hesap Detayı</div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-neutral-100">
                      <tr><td className="p-2.5 text-neutral-600">Bu Ay Çalışılan Gün</td><td className="p-2.5 text-right font-bold text-black">{settlementData.calışılanGun} / {settlementData.daysInMonth} gün</td></tr>
                      <tr><td className="p-2.5 text-neutral-600">Çalışılmayan Gün (İade Bazı)</td><td className="p-2.5 text-right font-bold text-black">{settlementData.calışılmayanGun} gün</td></tr>
                      {/* YENİ: Gerçek puantaj verisiyle kırılım */}
                      {(settlementData.devamsizGun > 0 || settlementData.raporGun > 0 || settlementData.ucretsizIzinGun > 0 || settlementData.fazlaGunSayisi > 0) && (
                        <>
                          <tr className="bg-neutral-50"><td className="p-2.5 text-neutral-500 text-xs">Devamsız / Raporlu / Ücretsiz İzin Günü</td><td className="p-2.5 text-right text-xs text-neutral-500">{settlementData.devamsizGun} / {settlementData.raporGun} / {settlementData.ucretsizIzinGun} gün</td></tr>
                        </>
                      )}
                      <tr><td className="p-2.5 text-neutral-600">Ödenecek Gün (Puantaj Kırılımlı)</td><td className="p-2.5 text-right font-bold text-black">{settlementData.odenecekGun} gün</td></tr>
                      {/* DEĞİŞTİ: Mesai Ücreti satırı artık HER ZAMAN görünür (0 olsa bile)
                          ve kaç saat mesai yapıldığı ayrıca yazılır — kullanıcı talebi:
                          "Eklediğin tutar ayrı gözüksün ki ne kadar mesai yaptığını görelim."
                          Tutar, Personel Muhasebe > Maaş'taki MESAİ ÜCR. ile birebir aynıdır. */}
                      <tr className={settlementData.fazlaMesaiUcreti > 0 ? 'bg-green-50' : settlementData.fazlaMesaiUcreti < 0 ? 'bg-red-50' : ''}>
                        <td className={`p-2.5 ${settlementData.fazlaMesaiUcreti > 0 ? 'text-green-700' : settlementData.fazlaMesaiUcreti < 0 ? 'text-red-700' : 'text-neutral-600'}`}>
                          Mesai Ücreti <span className="text-[10px] opacity-70">(Maaş Tablosu ile aynı — toplam {(settlementData.toplamSaat ?? 0).toLocaleString('tr-TR', {maximumFractionDigits: 1})} saat × ₺{(settlementData.saatlikUcret ?? 0).toLocaleString('tr-TR', {maximumFractionDigits: 2})}/saat)</span>
                        </td>
                        <td className={`p-2.5 text-right font-bold ${settlementData.fazlaMesaiUcreti > 0 ? 'text-green-700' : settlementData.fazlaMesaiUcreti < 0 ? 'text-red-700' : 'text-neutral-600'}`}>{settlementData.fazlaMesaiUcreti > 0 ? '+' : ''}₺{settlementData.fazlaMesaiUcreti.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td>
                      </tr>
                      <tr><td className="p-2.5 text-neutral-600">Hak Edilen Net Maaş <span className="text-[10px] text-neutral-400">(maaş + mesai + yemek + yol)</span></td><td className="p-2.5 text-right font-bold text-black">₺{settlementData.netMaas.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      <tr className="bg-red-50"><td className="p-2.5 text-red-700">Yemek Parası İadesi <span className="text-[10px] text-red-400">(peşin verildi)</span></td><td className="p-2.5 text-right font-bold text-red-700">− ₺{settlementData.yemekIade.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      <tr className="bg-red-50"><td className="p-2.5 text-red-700">Yol Parası İadesi <span className="text-[10px] text-red-400">(peşin verildi)</span></td><td className="p-2.5 text-right font-bold text-red-700">− ₺{settlementData.yolIade.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      {settlementData.icraKesintisi > 0 && (
                        <tr className="bg-orange-50"><td className="p-2.5 text-orange-700">İcra Kesintisi</td><td className="p-2.5 text-right font-bold text-orange-700">₺{settlementData.icraKesintisi.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      )}
                      <tr><td className="p-2.5 text-neutral-500 text-xs">İadenin Nakitten Düşülen Kısmı</td><td className="p-2.5 text-right text-xs text-neutral-500">₺{settlementData.nakittenDusulen.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      <tr><td className="p-2.5 text-neutral-500 text-xs">İadenin Bankadan Düşülen Kısmı</td><td className="p-2.5 text-right text-xs text-neutral-500">₺{settlementData.bankadanDusulen.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      {/* ==========================================================
                          YENİ: AY İÇİNDE YAPILMIŞ ÖDEMELER (avanslar + ödendi
                          işaretli kalemler). Her satırın kanalı bellidir: avans
                          nakitse Kalan Nakit'ten, bankadansa Kalan Banka'dan
                          düşülmüştür. Yalnızca tutarı 0'dan büyük olanlar görünür.
                          ========================================================== */}
                      {[
                        { ad: 'Nakit Avans', tutar: settlementData.avansNakit, kanal: 'Nakitten' },
                        { ad: 'Resmi Avans (Banka)', tutar: settlementData.avansResmi, kanal: 'Bankadan' },
                        { ad: 'Yemek Parası Ödendi', tutar: settlementData.odYemek, kanal: 'Nakitten' },
                        { ad: 'Yol Parası Ödendi', tutar: settlementData.odYol, kanal: 'Nakitten' },
                        { ad: 'Banka Maaş Ödemesi', tutar: settlementData.odBanka, kanal: 'Bankadan' },
                        { ad: 'Nakit Maaş Ödemesi', tutar: settlementData.odNakit, kanal: 'Nakitten' },
                        { ad: 'İcra Kesintisi Ödendi', tutar: settlementData.odIcra, kanal: 'Bankadan' },
                      ].filter(k => (k.tutar || 0) > 0).map((k, i) => (
                        <tr key={i} className="bg-blue-50">
                          <td className="p-2.5 text-blue-700 text-xs font-bold">{k.ad} <span className="text-[10px] text-blue-400">({k.kanal} düşüldü)</span></td>
                          <td className="p-2.5 text-right text-xs font-bold text-blue-700">− ₺{(k.tutar || 0).toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final tutarlar — DEĞİŞTİ: avanslar düşüldüğü için sonuç eksi
                    çıkabilir; eksi durumda kutu kırmızıya döner ve tutarın
                    personelden İADE alınacağı açıkça yazılır. */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl p-3 text-center border-2 ${settlementData.finalKalanBanka < 0 ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <p className={`text-[10px] font-black uppercase mb-1 ${settlementData.finalKalanBanka < 0 ? 'text-red-700' : 'text-yellow-700'}`}>{settlementData.finalKalanBanka < 0 ? 'Banka — Personel İade Edecek' : 'Kalan Banka Parası'}</p>
                    <p className={`text-xl font-black ${settlementData.finalKalanBanka < 0 ? 'text-red-800' : 'text-yellow-800'}`}>₺{Math.abs(settlementData.finalKalanBanka).toLocaleString('tr-TR', {maximumFractionDigits: 2})}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center border-2 ${settlementData.finalKalanNakit < 0 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'}`}>
                    <p className={`text-[10px] font-black uppercase mb-1 ${settlementData.finalKalanNakit < 0 ? 'text-red-700' : 'text-orange-700'}`}>{settlementData.finalKalanNakit < 0 ? 'Nakit — Personel İade Edecek' : 'Kalan Nakit Parası'}</p>
                    <p className={`text-xl font-black ${settlementData.finalKalanNakit < 0 ? 'text-red-800' : 'text-orange-800'}`}>₺{Math.abs(settlementData.finalKalanNakit).toLocaleString('tr-TR', {maximumFractionDigits: 2})}</p>
                  </div>
                </div>

                {/* Ödeme onayları */}
                <div className="border-t border-neutral-200 pt-4 space-y-2">
                  <p className="font-bold text-sm text-black mb-1">Ödeme Onayı</p>
                  <button type="button" onClick={() => setSettlementConfirm(p => ({...p, nakitVerildi: !p.nakitVerildi}))} className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition ${settlementConfirm.nakitVerildi ? 'bg-green-50 border-green-400 text-green-800' : 'bg-neutral-50 border-neutral-200 text-neutral-600'}`}>
                    <span className="font-bold text-sm">Personele Kalan Nakit Parası Verildi mi?</span>
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${settlementConfirm.nakitVerildi ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>{settlementConfirm.nakitVerildi ? 'EVET' : 'HAYIR'}</span>
                  </button>
                  <button type="button" onClick={() => setSettlementConfirm(p => ({...p, bankaVerildi: !p.bankaVerildi}))} className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition ${settlementConfirm.bankaVerildi ? 'bg-green-50 border-green-400 text-green-800' : 'bg-neutral-50 border-neutral-200 text-neutral-600'}`}>
                    <span className="font-bold text-sm">Personele Kalan Banka Parası Verildi mi?</span>
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${settlementConfirm.bankaVerildi ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>{settlementConfirm.bankaVerildi ? 'EVET' : 'HAYIR'}</span>
                  </button>
                </div>

                {/* İmzalı belge yükleme (3 seçenekli) */}
                <div className="border-t border-neutral-200 pt-4">
                  <p className="font-bold text-sm text-black mb-2">Çıkış İçin İmzalatılacak Belgeler</p>
                  {settlementConfirm.belgeUrl ? (
                    <div className="bg-green-50 border border-green-300 rounded-xl p-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-green-700 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> İmzalı belge yüklendi</span>
                      <div className="flex items-center gap-2">
                        {setViewingImage && <button type="button" onClick={() => setViewingImage({ title: 'Çıkış Belgesi', name: settlementConfirm.belgeUrl })} className="text-[10px] font-bold bg-white text-green-700 px-2 py-1 rounded-lg border border-green-200">Görüntüle</button>}
                        <button type="button" onClick={() => setSettlementConfirm(p => ({...p, belgeUrl: ''}))} className="text-[10px] font-bold bg-white text-red-600 px-2 py-1 rounded-lg border border-red-200">Kaldır</button>
                      </div>
                    </div>
                  ) : (
                    <MediaCaptureMenu
                      disabled={settlementUploading}
                      buttonLabel={settlementUploading ? 'Yükleniyor...' : 'İmzalı Belge Yükle'}
                      onChange={handleSettlementFileUpload}
                      buttonClassName="cursor-pointer w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2 text-neutral-700 font-bold text-sm"
                    />
                  )}
                </div>

                {/* Kesinleştir */}
                <button type="button" onClick={finalizeSettlement} className="w-full py-4 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition flex justify-center items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Verildi ve İmzalar Atıldı — Çıkışı Onayla
                </button>
                {person.cikisOnaylandi && (
                  <p className="text-center text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-2">✓ Bu personel için tüm maaş ödemesi ve sözleşmeler imzalandı. Çıkış tamamlandı.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* YENİ: AYRILIŞ HAKEDİŞ DÖKÜMÜ (SALT-OKUNUR) — çıkış anında kaydedilen hesap detayını gösterir */}
        {showExitSettlementView && person.cikisHesapDetay && (() => {
          const sd = person.cikisHesapDetay; // Çıkış anındaki kayıtlı hesap dökümü
          const tl = (n) => `₺${(Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;

          // ==================================================================
          // YENİ: FİİLEN YAPILMIŞ ÖDEMELER (çıkış ayının maaş tablosundan)
          // Maaş Tablosu'nda tik atılan her kalem, o tutarı GİDERE işler; yani
          // fiilen ödenmiş demektir. Avanslar da peşin verilmiş ödemelerdir.
          // Bunları toplayıp, çıkışta hesaplanan kalan tutarlardan düşerek
          // NİHAİ ödenecek rakamı buluyoruz.
          // ==================================================================
          const r = cikisAyiMaasRow || {};
          // ==================================================================
          // ÇİFTE DÜŞÜM KORUMASI (KRİTİK)
          // ==================================================================
          // YENİ dökümlerde (odenenlerDusuldu bayrağı olanlar) avanslar ve
          // ödenen kalemler computeSettlement içinde ZATEN düşülmüş durumda;
          // finalKalan tutarları nihai değerdir. Bu ekran onları BİR DAHA
          // düşerse aynı avans iki kez kesilmiş olur. Bu yüzden:
          //   • Bayrak VARSA: kalemler dökümün İÇİNDEN gösterilir, düşüm 0.
          //   • Bayrak YOKSA (eski kayıt): eski davranış — kalemler çıkış
          //     ayının maaş satırından okunur ve burada düşülür.
          // ==================================================================
          const zatenDusuldu = !!sd.odenenlerDusuldu;
          const nakitAvans   = zatenDusuldu ? (parseFloat(sd.avansNakit) || 0) : (parseFloat(r.nakitAvans) || 0);
          const resmiAvans   = zatenDusuldu ? (parseFloat(sd.avansResmi) || 0) : (parseFloat(r.resmiAvans) || 0);
          const odYemek      = zatenDusuldu ? (parseFloat(sd.odYemek) || 0) : (parseFloat(r.yemekOdenenTutar) || 0);
          const odYol        = zatenDusuldu ? (parseFloat(sd.odYol) || 0) : (parseFloat(r.yolOdenenTutar) || 0);
          const odBanka      = zatenDusuldu ? (parseFloat(sd.odBanka) || 0) : (parseFloat(r.bankaOdenenTutar) || 0);
          const odNakit      = zatenDusuldu ? (parseFloat(sd.odNakit) || 0) : (parseFloat(r.nakitOdenenTutar) || 0);
          const odIcra       = zatenDusuldu ? (parseFloat(sd.odIcra) || 0) : (parseFloat(r.icraOdenenTutar) || 0);

          // Ödeme kanalına göre ayrıştırma:
          //  • NAKİT kanalı: nakit avans + nakit ödemesi + peşin verilen yemek/yol
          //    (yemek/yol elden veya karta peşin verildiği için nakit tarafına yazılır)
          //  • BANKA kanalı: resmi avans + banka ödemesi
          // zatenDusuldu ise düşülecek tutar 0'dır (final değerler zaten nihai).
          const odenenNakitToplam = zatenDusuldu ? 0 : (nakitAvans + odNakit + odYemek + odYol);
          const odenenBankaToplam = zatenDusuldu ? 0 : (resmiAvans + odBanka);
          const odenenGenelToplam = nakitAvans + odNakit + odYemek + odYol + resmiAvans + odBanka;

          // Çıkışta hesaplanan kalan tutarlar (dondurulmuş döküm)
          const hakNakit  = Number(sd.finalKalanNakit) || 0;
          const hakBanka  = Number(sd.finalKalanBanka) || 0;
          const hakToplam = hakNakit + hakBanka;

          // NİHAİ ödenecek: hak edilen − fiilen ödenen (eksiye düşerse personel borçlu)
          const nihaiNakit  = hakNakit - odenenNakitToplam;
          const nihaiBanka  = hakBanka - odenenBankaToplam;
          const nihaiToplam = nihaiNakit + nihaiBanka;

          const odemeKalemleri = [
            { ad: 'Nakit Avans', tutar: nakitAvans, kanal: 'Nakit' },
            { ad: 'Resmi Avans (Banka)', tutar: resmiAvans, kanal: 'Banka' },
            { ad: 'Yemek Parası (peşin verildi)', tutar: odYemek, kanal: 'Nakit' },
            { ad: 'Yol Parası (peşin verildi)', tutar: odYol, kanal: 'Nakit' },
            { ad: 'Banka Maaş Ödemesi', tutar: odBanka, kanal: 'Banka' },
            { ad: 'Nakit Maaş Ödemesi', tutar: odNakit, kanal: 'Nakit' },
            { ad: 'İcra Kesintisi Ödemesi', tutar: odIcra, kanal: 'Banka' },
          ].filter(k => k.tutar > 0);

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-start md:items-center p-4 overflow-y-auto">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 my-4">
                <div className="bg-gradient-to-r from-neutral-900 to-neutral-700 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Wallet className="w-5 h-5 text-green-400" /> Ayrılış Hakediş Dökümü</h3>
                  <button onClick={() => setShowExitSettlementView(false)} className="text-neutral-300 hover:text-white transition"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* ==============================================================
                      YENİ: ESKİ KAYIT UYARISI + GÜNCEL VERİLERLE YENİDEN HESAPLA
                      ==============================================================
                      Bu döküm, çıkış ANINDA hesaplanıp personel kartına dondurulmuş
                      kayıttır. Mesai entegrasyonundan ÖNCE çıkarılan personellerde
                      kayıtta mesai alanları yoktur; bu yüzden "0 saat × ₺0" görünür
                      (Maaş Tablosu dolu olsa bile). Aşağıdaki buton, hesabı BUGÜNKÜ
                      kodla ve güncel puantaj/maaş verisiyle yeniden üretip kayıtlı
                      dökümün üzerine yazar. Çıkış tarihi DEĞİŞMEZ; yalnızca hesap
                      tazelenir. İşlem sistem günlüğüne yazılır.
                      ============================================================== */}
                  {sd.toplamSaat === undefined && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs font-bold text-amber-800">
                      Bu döküm, mesai entegrasyonu eklenmeden önce kaydedilmiş. Mesai ücreti bu yüzden ₺0 görünüyor. "Yeniden Hesapla" ile güncel verilerden tazeleyebilirsiniz.
                    </div>
                  )}
                  <button type="button" disabled={cikisTarihiKaydediliyor}
                    onClick={async () => {
                      if (!window.confirm(`Hakediş dökümü, ${sd.dateStr} çıkış tarihi ve GÜNCEL puantaj/maaş verileriyle yeniden hesaplanıp kayıtlı dökümün üzerine yazılacak. Devam edilsin mi?`)) return;
                      setCikisTarihiKaydediliyor(true);
                      try {
                        const yeniDokum = await computeSettlement(sd.dateStr);
                        // computeSettlement kendi önizleme modalını açar; burada gerek yok
                        setShowSettlementModal(false);
                        if (!yeniDokum) { alert('Hesap yeniden üretilemedi.'); }
                        else {
                          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
                            cikisHesapDetay: yeniDokum,
                            cikisHesabiYenidenHesaplandi: new Date().toISOString(),
                            cikisHesabiYenideHesaplayan: currentUser?.fullName || 'Sistem'
                          });
                          if (addSystemLog) addSystemLog('Ayrılış Hakedişi Yeniden Hesaplandı',
                            `${person.fullName} (${sd.dateStr}) hakediş dökümü güncel verilerle yeniden üretildi. Mesai: ₺${(yeniDokum.fazlaMesaiUcreti || 0).toLocaleString('tr-TR')}. İşlemi yapan: ${currentUser?.fullName || 'Sistem'}.`);
                          // person prop'u canlı dinlendiği için sd otomatik yenilenir; modal açık kalır.
                        }
                      } catch (err) {
                        console.error('Yeniden hesaplama hatası:', err);
                        alert('Yeniden hesaplanamadı: ' + (err?.message || 'bilinmeyen hata'));
                      }
                      setCikisTarihiKaydediliyor(false);
                    }}
                    className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 text-xs font-black rounded-xl border border-blue-200 transition flex items-center justify-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> {cikisTarihiKaydediliyor ? 'Hesaplanıyor...' : 'Güncel Verilerle Yeniden Hesapla'}
                  </button>
                  {/* Personel & çıkış tarihi */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-black">{person.fullName}</p>
                        <p className="text-neutral-500 text-xs mt-0.5">{person.position || person.rank || '-'} • Çıkış Tarihi: <span className="font-bold text-black">{sd.dateStr}</span></p>
                      </div>
                      {/* YENİ: ÇIKIŞ TARİHİNİ DÜZENLE
                          Tarih yanlış girildiğinde çalışılan gün, yemek/yol iadesi ve
                          mesai hesabının tamamı kayıyor. Bu buton tarihi düzeltip
                          hakediş dökümünü sıfırdan yeniden üretir. */}
                      <button type="button"
                        onClick={() => { setYeniCikisTarihi(sd.dateStr || ''); setShowCikisTarihiDuzenle(true); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-black transition flex items-center gap-1.5">
                        <Edit className="w-3.5 h-3.5" /> Tarihi Düzenle
                      </button>
                    </div>
                    {person.cikisTarihiGuncellendi && (
                      <p className="text-[10px] font-bold text-amber-700 mt-2 pt-2 border-t border-neutral-200">
                        Bu tarih {new Date(person.cikisTarihiGuncellendi).toLocaleDateString('tr-TR')} tarihinde
                        {person.cikisTarihiGuncelleyen ? ` ${person.cikisTarihiGuncelleyen}` : ''} tarafından güncellendi.
                      </p>
                    )}
                  </div>

                  {/* ============================================================
                      YENİ: EN ÜSTTE NİHAİ ÖZET — "Sonuçta ne kadar ödeyeceğim?"
                      ============================================================ */}
                  <div className={`rounded-2xl p-4 border-2 ${nihaiToplam > 0.5 ? 'bg-green-50 border-green-400' : nihaiToplam < -0.5 ? 'bg-red-50 border-red-400' : 'bg-neutral-50 border-neutral-300'}`}>
                    <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500 text-center mb-1">
                      {nihaiToplam > 0.5 ? 'Ödenecek Kalan Toplam' : nihaiToplam < -0.5 ? 'Personelin Şirkete Borcu' : 'Hesap Kapandı'}
                    </p>
                    <p className={`text-3xl font-black text-center ${nihaiToplam > 0.5 ? 'text-green-700' : nihaiToplam < -0.5 ? 'text-red-700' : 'text-neutral-600'}`}>
                      {tl(Math.abs(nihaiToplam))}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-white/70 rounded-xl p-2 text-center border border-neutral-200">
                        <p className="text-[9px] font-black uppercase text-orange-700">Nakit Ödenecek</p>
                        <p className={`text-base font-black ${nihaiNakit < -0.5 ? 'text-red-600' : 'text-orange-800'}`}>{tl(nihaiNakit)}</p>
                      </div>
                      <div className="bg-white/70 rounded-xl p-2 text-center border border-neutral-200">
                        <p className="text-[9px] font-black uppercase text-yellow-700">Bankadan Ödenecek</p>
                        <p className={`text-base font-black ${nihaiBanka < -0.5 ? 'text-red-600' : 'text-yellow-800'}`}>{tl(nihaiBanka)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-neutral-500 text-center mt-2">
                      Hak Edilen {tl(hakToplam)} − Yapılan Ödemeler {tl(odenenGenelToplam)}
                    </p>
                  </div>

                  {/* Hesap detay tablosu (salt-okunur) */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="bg-neutral-800 text-white px-3 py-2 text-xs font-black uppercase tracking-wide">Hesap Detayı</div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-neutral-100">
                        <tr><td className="p-2.5 text-neutral-600">Bu Ay Çalışılan Gün</td><td className="p-2.5 text-right font-bold text-black">{sd.calışılanGun} / {sd.daysInMonth} gün</td></tr>
                        <tr><td className="p-2.5 text-neutral-600">Çalışılmayan Gün (İade Bazı)</td><td className="p-2.5 text-right font-bold text-black">{sd.calışılmayanGun} gün</td></tr>
                        {(sd.devamsizGun > 0 || sd.raporGun > 0 || sd.ucretsizIzinGun > 0 || sd.fazlaGunSayisi > 0) && (
                          <>
                            <tr className="bg-neutral-50"><td className="p-2.5 text-neutral-500 text-xs">Devamsız / Raporlu / Ücretsiz İzin Günü</td><td className="p-2.5 text-right text-xs text-neutral-500">{sd.devamsizGun} / {sd.raporGun} / {sd.ucretsizIzinGun} gün</td></tr>
                          </>
                        )}
                        <tr><td className="p-2.5 text-neutral-600">Ödenecek Gün (Puantaj Kırılımlı)</td><td className="p-2.5 text-right font-bold text-black">{sd.odenecekGun} gün</td></tr>
                        {/* YENİ: Çalışılan güne düşen saf maaş — mesai ve yemek/yol ayrı satırlarda görülsün */}
                        <tr><td className="p-2.5 text-neutral-600">Çalışılan Güne Düşen Maaş <span className="text-[10px] text-neutral-400">({sd.odenecekGun} gün × günlük)</span></td><td className="p-2.5 text-right font-bold text-black">{tl(sd.netMaasBase)}</td></tr>
                        {/* YENİ: Aylık yemek/yol hak edişi ayrı satırlarda (brüt hakedişe dahil edilen kısım) */}
                        <tr><td className="p-2.5 text-neutral-500 text-xs">Aylık Yemek Hakedişi (brüte dahil)</td><td className="p-2.5 text-right text-xs text-neutral-500">+{tl(sd.yemekAylik)}</td></tr>
                        <tr><td className="p-2.5 text-neutral-500 text-xs">Aylık Yol Hakedişi (brüte dahil)</td><td className="p-2.5 text-right text-xs text-neutral-500">+{tl(sd.yolAylik)}</td></tr>
                        {/* TAŞINDI (kullanıcı talebi): Mesai Ücreti satırı artık Aylık Yol
                            Hakedişi'nin ALTINDA. Tutar, Personel Muhasebe > Maaş'taki
                            MESAİ ÜCR. sütunuyla birebir aynıdır ve Net Maaş'a dahildir. */}
                        <tr className={sd.fazlaMesaiUcreti > 0 ? 'bg-green-50' : sd.fazlaMesaiUcreti < 0 ? 'bg-red-50' : ''}>
                          <td className={`p-2.5 ${sd.fazlaMesaiUcreti > 0 ? 'text-green-700' : sd.fazlaMesaiUcreti < 0 ? 'text-red-700' : 'text-neutral-600'}`}>
                            Mesai Ücreti <span className="text-[10px] opacity-70">(Maaş Tablosu ile aynı — toplam {(sd.toplamSaat ?? 0).toLocaleString('tr-TR', {maximumFractionDigits: 1})} saat × ₺{(sd.saatlikUcret ?? 0).toLocaleString('tr-TR', {maximumFractionDigits: 2})}/saat)</span>
                          </td>
                          <td className={`p-2.5 text-right font-bold ${sd.fazlaMesaiUcreti > 0 ? 'text-green-700' : sd.fazlaMesaiUcreti < 0 ? 'text-red-700' : 'text-neutral-600'}`}>{sd.fazlaMesaiUcreti > 0 ? '+' : ''}{tl(sd.fazlaMesaiUcreti)}</td>
                        </tr>
                        <tr><td className="p-2.5 text-neutral-600">Hak Edilen Net Maaş <span className="text-[10px] text-neutral-400">(maaş + mesai + yemek + yol)</span></td><td className="p-2.5 text-right font-bold text-black">{tl(sd.netMaas)}</td></tr>
                        <tr className="bg-red-50"><td className="p-2.5 text-red-700">Yemek Parası İadesi <span className="text-[10px] text-red-400">(peşin verildi)</span></td><td className="p-2.5 text-right font-bold text-red-700">− {tl(sd.yemekIade)}</td></tr>
                        <tr className="bg-red-50"><td className="p-2.5 text-red-700">Yol Parası İadesi <span className="text-[10px] text-red-400">(peşin verildi)</span></td><td className="p-2.5 text-right font-bold text-red-700">− {tl(sd.yolIade)}</td></tr>
                        {sd.icraKesintisi > 0 && (
                          <tr className="bg-orange-50"><td className="p-2.5 text-orange-700">İcra Kesintisi</td><td className="p-2.5 text-right font-bold text-orange-700">{tl(sd.icraKesintisi)}</td></tr>
                        )}
                        <tr><td className="p-2.5 text-neutral-500 text-xs">İadenin Nakitten Düşülen Kısmı</td><td className="p-2.5 text-right text-xs text-neutral-500">{tl(sd.nakittenDusulen)}</td></tr>
                        <tr><td className="p-2.5 text-neutral-500 text-xs">İadenin Bankadan Düşülen Kısmı</td><td className="p-2.5 text-right text-xs text-neutral-500">{tl(sd.bankadanDusulen)}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Hak edilen (çıkış anı dondurulmuş) tutarlar */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black uppercase text-yellow-700 mb-1">Hak Edilen Banka Parası</p>
                      <p className="text-xl font-black text-yellow-800">{tl(sd.finalKalanBanka)}</p>
                    </div>
                    <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black uppercase text-orange-700 mb-1">Hak Edilen Nakit Parası</p>
                      <p className="text-xl font-black text-orange-800">{tl(sd.finalKalanNakit)}</p>
                    </div>
                  </div>

                  {/* ============================================================
                      YENİ: YAPILAN TÜM ÖDEMELER (çıkış ayı maaş tablosundan)
                      ============================================================ */}
                  <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
                    <div className="bg-blue-600 text-white px-3 py-2 text-xs font-black uppercase tracking-wide flex items-center justify-between">
                      <span>Yapılan Ödemeler ({sd.year}/{String(sd.month).padStart(2, '0')})</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-full">{tl(odenenGenelToplam)}</span>
                    </div>
                    {odemeKalemleri.length > 0 ? (
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-neutral-100">
                          {odemeKalemleri.map((k, i) => (
                            <tr key={i}>
                              <td className="p-2.5 text-neutral-600">{k.ad}</td>
                              <td className="p-2.5 text-center">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${k.kanal === 'Nakit' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{k.kanal}</span>
                              </td>
                              <td className="p-2.5 text-right font-bold text-blue-700">{tl(k.tutar)}</td>
                            </tr>
                          ))}
                          <tr className="bg-neutral-100">
                            <td className="p-2.5 font-black text-black" colSpan="2">Nakit Kanalından Ödenen</td>
                            <td className="p-2.5 text-right font-black text-orange-700">{tl(odenenNakitToplam)}</td>
                          </tr>
                          <tr className="bg-neutral-100">
                            <td className="p-2.5 font-black text-black" colSpan="2">Banka Kanalından Ödenen</td>
                            <td className="p-2.5 text-right font-black text-yellow-700">{tl(odenenBankaToplam)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className="p-4 text-center text-xs font-bold text-neutral-400">
                        Çıkış ayının maaş tablosunda tik atılmış (fiilen yapılmış) bir ödeme veya avans kaydı bulunmuyor.
                      </p>
                    )}
                  </div>

                  {/* Bilgi notu: bu döküm çıkış anında dondurulmuştur */}
                  <p className="text-center text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-2">✓ Hak ediş dökümü, personelin işten ayrıldığı gün ({sd.dateStr}) hesaplanıp kaydedilmiştir. "Yapılan Ödemeler" bölümü ise Maaş Tablosu'ndan CANLI okunur; tablodaki tikler değiştikçe burada da güncellenir.</p>

                  <button type="button" onClick={() => setShowExitSettlementView(false)} className="w-full py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-black transition">Kapat</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* YENİ: ÇIKIŞ TARİHİ DÜZENLEME PENCERESİ
            Tarih değiştirilince hakediş dökümü computeSettlement ile SIFIRDAN
            yeniden üretilir — çalışılan gün, ödenecek gün, mesai etkisi ve
            yemek/yol iadesi hepsi yeni tarihe göre yeniden hesaplanır. */}
        {showCikisTarihiDuzenle && (
          <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-neutral-200">
                <h3 className="font-black text-black flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-red-600" /> Çıkış Tarihini Düzenle
                </h3>
                <button onClick={() => setShowCikisTarihiDuzenle(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                    Tarih değiştirildiğinde hakediş hesabı <b>sıfırdan yeniden üretilir</b>:
                    çalışılan gün, ödenecek gün, mesai etkisi ve yemek/yol iadesi
                    yeni tarihe göre tekrar hesaplanır.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">Mevcut Çıkış Tarihi</label>
                  <div className="p-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm font-black text-neutral-700">
                    {person.cikisHesapDetay?.dateStr || '-'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-600 block mb-1">Yeni Çıkış Tarihi *</label>
                  <input type="date" value={yeniCikisTarihi}
                    onChange={(e) => setYeniCikisTarihi(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-sm" />
                  {person.startDate && (
                    <p className="text-[11px] text-neutral-400 font-bold mt-1.5">
                      İşe giriş: {person.startDate} — bundan önceki bir tarih seçilemez.
                    </p>
                  )}
                </div>

                <button onClick={handleCikisTarihiGuncelle}
                  disabled={cikisTarihiKaydediliyor || !yeniCikisTarihi}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  {cikisTarihiKaydediliyor
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Hesap yeniden üretiliyor...</>
                    : <><Save className="w-4 h-4" /> Tarihi Güncelle ve Yeniden Hesapla</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* YENİ: Avans Girişi Modalı */}
        {showAvansModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><DollarSign className="w-5 h-5" /> Avans Girişi</h3>
                <button onClick={() => setShowAvansModal(false)} className="text-blue-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAvansSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Avans Türü</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAvansForm({ ...avansForm, type: 'nakit' })} className={`p-3 rounded-xl font-bold text-sm border-2 transition ${avansForm.type === 'nakit' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-neutral-200 text-neutral-500'}`}>Nakit Avans</button>
                    <button type="button" onClick={() => setAvansForm({ ...avansForm, type: 'resmi' })} className={`p-3 rounded-xl font-bold text-sm border-2 transition ${avansForm.type === 'resmi' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-neutral-200 text-neutral-500'}`}>Resmi Avans</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tutar (TL)</label>
                  <input required type="number" value={avansForm.amount} onChange={e => setAvansForm({ ...avansForm, amount: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Hangi Ay (Maaş Tablosu)</label>
                  <input required type="month" value={avansForm.month} onChange={e => setAvansForm({ ...avansForm, month: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Not (İsteğe Bağlı)</label>
                  <input type="text" value={avansForm.note} onChange={e => setAvansForm({ ...avansForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">Avansı Kaydet</button>
              </form>
            </div>
          </div>
        )}

        {/* Maaş / Yol / Yemek Onay Modalı kaldırıldı — artık Maaş Tablosu tiklerinden otomatik bildirim olarak gösteriliyor (yukarıda) */}

        {/* YENİ: Tutanak Tut Modalı */}
        {showTutanakModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="bg-neutral-800 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Tutanak Tut</h3>
                <button onClick={() => { setShowTutanakModal(false); setTutanakTemplateKey(''); }} className="text-neutral-300 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleTutanakSubmit} className="p-6 space-y-4">
                {/* YENİ: Hazır Tutanak Şablonu Seçimi */}
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Hazır Tutanak Şablonu Seç</label>
                  <select
                    value={tutanakTemplateKey}
                    onChange={e => {
                      const key = e.target.value;
                      setTutanakTemplateKey(key);
                      const tpl = TUTANAK_TEMPLATES.find(t => t.key === key);
                      if (tpl) setTutanakForm(prev => ({ ...prev, title: tpl.title }));
                    }}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-neutral-800 bg-white"
                  >
                    <option value="">— Şablon Seçin (İsteğe Bağlı) —</option>
                    {TUTANAK_TEMPLATES.map(t => (
                      <option key={t.key} value={t.key}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tutanak Başlığı</label>
                  <input required type="text" value={tutanakForm.title} onChange={e => setTutanakForm({ ...tutanakForm, title: e.target.value })} placeholder="Örn: Devamsızlık Tutanağı" className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-neutral-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                  <input required type="date" value={tutanakForm.date} onChange={e => setTutanakForm({ ...tutanakForm, date: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-neutral-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Olay Detayı (İsteğe Bağlı — Şablonda "Olayın Özeti" alanına yazılır)</label>
                  <textarea value={tutanakForm.note} onChange={e => setTutanakForm({ ...tutanakForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-neutral-800 h-16 resize-none" />
                </div>

                {/* YENİ: Seçilen şablonu personel bilgilerine göre doldurup yazdır */}
                <button
                  type="button"
                  onClick={generateTutanakPDF}
                  disabled={!tutanakTemplateKey}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition flex justify-center items-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" /> Tutanağı Hazırla / Yazdır
                </button>

                {/* İmzalattığımız belgeyi ekleme (Şimdi Çek / Galeriden / Dosyadan) — Özlük dosyasına da eklenir */}
                <div>
                  <label className="block text-sm font-bold text-black mb-1">İmzalanmış Tutanağı Ekle</label>
                  <MediaCaptureMenu
                    disabled={actionUploading}
                    buttonLabel={tutanakForm.fileUrl ? 'Belge Yüklendi ✓' : 'İmzalı Belgeyi Yükle'}
                    onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setActionUploading(true);
                      try { const url = await uploadActionFile(file); setTutanakForm(prev => ({ ...prev, fileUrl: url })); } catch (err) { alert('Yükleme hatası'); }
                      setActionUploading(false);
                    }}
                  />
                </div>

                <button type="submit" disabled={actionUploading} className="w-full py-4 bg-neutral-800 text-white font-bold rounded-xl hover:bg-black transition disabled:opacity-50">Tutanağı Kaydet</button>
              </form>
            </div>
          </div>
        )}

        {/* YENİ: Rapor Ekle Modalı */}
        {showRaporModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-red-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><PlusCircle className="w-5 h-5" /> Sağlık Raporu Ekle</h3>
                <button onClick={() => setShowRaporModal(false)} className="text-red-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleRaporSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Başlangıç</label>
                    <input required type="date" value={raporForm.startDate} onChange={e => setRaporForm({ ...raporForm, startDate: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Bitiş</label>
                    <input required type="date" value={raporForm.endDate} onChange={e => setRaporForm({ ...raporForm, endDate: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Rapor Belgesi (Fotoğraf/Dosya) — Özlük dosyasına da eklenir</label>
                  <MediaCaptureMenu
                    disabled={actionUploading}
                    buttonLabel={raporForm.fileUrl ? 'Belge Yüklendi ✓' : 'Rapor Belgesi Ekle'}
                    onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setActionUploading(true);
                      try { const url = await uploadActionFile(file); setRaporForm(prev => ({ ...prev, fileUrl: url })); } catch (err) { alert('Yükleme hatası'); }
                      setActionUploading(false);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Açıklama (İsteğe Bağlı)</label>
                  <input type="text" value={raporForm.note} onChange={e => setRaporForm({ ...raporForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <button type="submit" disabled={actionUploading} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50">Raporu Kaydet</button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================
            YENİ: HASAR BORCU TAKİBİ MODALI (salt bilgi)
            Toplam yazılan hasar payı, primlerden kesilerek ÖDENEN kısım ve
            KALAN borç gösterilir. Kesinti işlemi otomatik olduğu için burada
            giriş alanı yoktur; hareket dökümü "Personel Hareket İşlemleri"
            akışında (Hasar Borcu Eklendi / Hasar Kesintisi kayıtları) izlenir.
            ================================================================== */}
        {showHasarModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-orange-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Hasar Borcu Takibi</h3>
                <button onClick={() => setShowHasarModal(false)} className="text-orange-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 space-y-4">
                {/* Üçlü özet: Toplam / Ödenen / Kalan */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl border-2 bg-neutral-50 border-neutral-200">
                    <span className="text-[9px] font-bold uppercase tracking-wider block mb-1 text-neutral-500">Toplam Hasar</span>
                    <span className="text-sm font-black text-neutral-800">₺{hasarToplam.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="p-3 rounded-xl border-2 bg-green-50 border-green-200">
                    <span className="text-[9px] font-bold uppercase tracking-wider block mb-1 text-green-600">Primden Ödenen</span>
                    <span className="text-sm font-black text-green-700">₺{hasarOdenen.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className={`p-3 rounded-xl border-2 ${hasarKalan > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-wider block mb-1 ${hasarKalan > 0 ? 'text-orange-600' : 'text-green-600'}`}>Kalan Borç</span>
                    <span className={`text-sm font-black ${hasarKalan > 0 ? 'text-orange-700' : 'text-green-700'}`}>₺{hasarKalan.toLocaleString('tr-TR')}</span>
                  </div>
                </div>
                {/* Seçili aydaki kesinti (profildeki finans ayı seçimine göre) */}
                {(parseFloat(financeMonthRow?.hasarKesinti) || 0) > 0 && (
                  <p className="text-xs text-orange-700 font-bold bg-orange-50 p-3 rounded-xl border border-orange-200 text-center">
                    Seçili ayda priminden kesilen: ₺{(parseFloat(financeMonthRow.hasarKesinti) || 0).toLocaleString('tr-TR')}
                  </p>
                )}
                <p className="text-[11px] text-neutral-500 font-medium leading-relaxed bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  Hasar borcu <b>asla maaştan kesilmez</b>; yalnızca prim hak edilen aylarda o ayın prim tutarından otomatik düşülür. Prim borçtan azsa prim sıfırlanır, kalan borç sonraki aya devreder. Tüm hareketler aşağıdaki "Personel Hareket İşlemleri" akışında listelenir.
                </p>
                {hasarKalan <= 0 && hasarToplam > 0 && (
                  <p className="text-sm text-green-700 font-bold text-center bg-green-50 p-3 rounded-xl border border-green-200">Tüm hasar borcu primlerden kesilerek kapatıldı. 🎉</p>
                )}
                {hasarToplam === 0 && (
                  <p className="text-sm text-neutral-500 font-medium text-center">Bu personele yazılmış bir hasar borcu bulunmuyor.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* YENİ: Şirkete Borç Ödemesi Modalı */}
        {showDebtModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-rose-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Landmark className="w-5 h-5" /> Şirkete Borç Ödemesi</h3>
                <button onClick={() => setShowDebtModal(false)} className="text-rose-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleDebtPaymentSubmit} className="p-6 space-y-4">
                {/* Güncel borç bilgisi */}
                <div className={`p-4 rounded-xl border-2 text-center ${currentDebt > 0 ? 'bg-rose-50 border-rose-200' : 'bg-green-50 border-green-200'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-70">Güncel Şirket Borcu</span>
                  <span className={`text-2xl font-black ${currentDebt > 0 ? 'text-rose-700' : 'text-green-700'}`}>
                    ₺{currentDebt.toLocaleString('tr-TR')}
                  </span>
                </div>

                {currentDebt <= 0 ? (
                  <p className="text-sm text-green-700 font-medium text-center bg-green-50 p-3 rounded-xl border border-green-200">Bu personelin ödenmemiş bir şirket borcu bulunmuyor. 🎉</p>
                ) : (
                  <>
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>Girilen tutar, borçlandırma tutarından düşülür. Ödemenin tamamı Nakit Avans'a işlenir; Kalan Banka etkilenmez.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-black mb-1">Ödenecek Tutar (TL)</label>
                      <input required type="number" max={currentDebt} value={debtForm.amount} onChange={e => setDebtForm({ ...debtForm, amount: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-600" placeholder={`En fazla ₺${currentDebt.toLocaleString('tr-TR')}`} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-black mb-1">Kesintinin Yapılacağı Ay</label>
                      <input required type="month" value={debtForm.month} onChange={e => setDebtForm({ ...debtForm, month: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-600" />
                      <p className="text-[10px] text-neutral-500 font-medium mt-1">Ödeme, seçtiğiniz ayın Nakit Avans'ına işlenir (Kalan Nakit bu tutar kadar azalır).</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-black mb-1">Not (İsteğe Bağlı)</label>
                      <input type="text" value={debtForm.note} onChange={e => setDebtForm({ ...debtForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-600" />
                    </div>
                    <button type="submit" className="w-full py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition flex justify-center items-center gap-2">
                      <Landmark className="w-5 h-5" /> Borç Ödemesini Kaydet
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* YENİ: Prim Ödeme Gir Modalı */}
        {showPrimModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-amber-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Star className="w-5 h-5" /> Prim Ödeme Gir</h3>
                <button onClick={() => setShowPrimModal(false)} className="text-amber-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handlePrimSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Giriş Türü</label>
                  <div className="flex bg-neutral-100 p-1 rounded-xl">
                    <button type="button" onClick={() => setPrimForm({ ...primForm, mode: 'tutar' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${primForm.mode === 'tutar' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Tutar (₺)</button>
                    <button type="button" onClick={() => setPrimForm({ ...primForm, mode: 'saat' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${primForm.mode === 'saat' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Saat</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">{primForm.mode === 'saat' ? 'Fazla Mesai Saati' : 'Prim Tutarı (TL)'}</label>
                  <input required type="number" step="0.1" value={primForm.value} onChange={e => setPrimForm({ ...primForm, value: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Ait Olduğu Ay</label>
                  <input required type="month" value={primForm.month} onChange={e => setPrimForm({ ...primForm, month: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Not (İsteğe Bağlı)</label>
                  <input type="text" value={primForm.note} onChange={e => setPrimForm({ ...primForm, note: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-600" />
                </div>
                <button type="submit" disabled={primSubmitting} className="w-full py-4 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition flex justify-center items-center gap-2 disabled:opacity-50">
                  <Star className="w-5 h-5" /> {primSubmitting ? 'Kaydediliyor...' : 'Prim Ödemesini Kaydet'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  export const OzlukDosyalariView = ({ personnelList, db, appId, addSystemLog, setViewingImage, currentUser }) => {
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [collarFilter, setCollarFilter] = useState('Tümü'); // 'Tümü', 'Mavi Yaka', 'Beyaz Yaka'
    // YENİ: Çalışma durumu filtresi — açılışta yalnızca ÇALIŞAN personel listelenir.
    // "İşten Ayrılmış Personel" sekmesiyle ayrılanlara geçilir; Mavi/Beyaz Yaka filtresi
    // her iki sekmede de aynı şekilde çalışır.
    const [durumFilter, setDurumFilter] = useState('Aktif'); // 'Aktif' | 'Pasif'
    // YENİ: "Hareketler" bölümünde tüm kayıtların gösterilip gösterilmeyeceği
    const [hareketHepsi, setHareketHepsi] = useState(false);
    // YENİ: Fazladan (ekstra) belge ekleme formu için state
    const [showExtraForm, setShowExtraForm] = useState(false);
    const [extraLabel, setExtraLabel] = useState('');

    // ========================================================================
    // YENİ: KAYIP BELGE KURTARMA (tek seferlik, otomatik)
    // ========================================================================
    // GEÇMİŞTEKİ HATA: Personel profilinden eklenen tutanak ve sağlık raporları
    // özlük dosyasına `tutanak_1755612345` / `rapor_1755612345` gibi BENZERSİZ
    // anahtarlarla yazılıyordu. Özlük Dosyaları ekranı ise belgeleri yalnızca
    // sabit türler üzerinden okuduğu için (documentTypes) bu belgeler
    // veritabanında DURUYOR ama ekranda HİÇBİR YERDE GÖRÜNMÜYORDU.
    //
    // BU EFEKT NE YAPAR: Bir personelin özlük dosyası açıldığında eski biçimli
    // anahtar var mı diye bakar; varsa içeriği doğru belge türünün dizisine
    // ('tutanaklar' / 'saglikRaporu') TAŞIR ve eski anahtarı siler.
    //
    // GÜVENLİK: Hiçbir dosya silinmez, yalnızca yer değiştirir. İşlem
    // idempotenttir — taşınacak anahtar kalmadığında hiçbir yazma yapmaz, yani
    // ikinci açılışta tekrar çalışmaz. Her taşıma "Hareketler" bölümüne iz olarak
    // düşer, böylece ne olduğu geriye dönük görülebilir.
    //
    // Yeni eklenen tutanak/raporlar ARTIK doğru anahtarla yazıldığı için bu efekt
    // yalnızca ESKİ kayıtlar için çalışır ve zamanla kendiliğinden gereksizleşir.
    // ========================================================================
    useEffect(() => {
      if (!selectedPerson?.id) return;
      const ozluk = selectedPerson.ozlukDosyalari || {};

      // Eski biçimli anahtarları bul: tutanak_... / rapor_...
      const eskiAnahtarlar = Object.keys(ozluk).filter(k => /^(tutanak|rapor)_\d+$/.test(k));
      if (eskiAnahtarlar.length === 0) return; // Taşınacak bir şey yok, çık

      let iptal = false;
      (async () => {
        const yeniOzluk = { ...ozluk };
        const yeniHareketler = [];

        eskiAnahtarlar.forEach(anahtar => {
          // Hedef belge türü: tutanak_ -> 'tutanaklar', rapor_ -> 'saglikRaporu'
          const hedef = anahtar.startsWith('tutanak_') ? 'tutanaklar' : 'saglikRaporu';
          const belgeler = belgeListesiNormalize(ozluk[anahtar]);
          if (belgeler.length === 0) { delete yeniOzluk[anahtar]; return; } // Boş/bozuk kayıt: sadece temizle

          const mevcut = belgeListesiNormalize(yeniOzluk[hedef]);
          // AYNI URL zaten hedefte varsa tekrar eklemez (kopya oluşmaz)
          const eklenecek = belgeler.filter(b => b?.url && !mevcut.some(m => m?.url === b.url));
          yeniOzluk[hedef] = [...mevcut, ...eklenecek];
          delete yeniOzluk[anahtar]; // Eski anahtar kaldırılır

          eklenecek.forEach(b => yeniHareketler.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            tip: 'ekleme',
            belgeAdi: b.name || (hedef === 'tutanaklar' ? 'Tutanak (eski kayıttan taşındı)' : 'Sağlık Raporu (eski kayıttan taşındı)'),
            url: b.url,
            tarih: new Date().toISOString(),
            kullanici: 'Sistem (otomatik taşıma)',
          }));
        });

        try {
          const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), ...yeniHareketler];
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), {
            ozlukDosyalari: yeniOzluk,
            ozlukGecmisi: yeniGecmis
          });
          if (iptal) return;
          // Ekrandaki kopyayı da güncelle ki taşınan belgeler anında görünsün
          setSelectedPerson(prev => prev && prev.id === selectedPerson.id
            ? { ...prev, ozlukDosyalari: yeniOzluk, ozlukGecmisi: yeniGecmis }
            : prev);
          if (addSystemLog && yeniHareketler.length > 0) {
            addSystemLog('Özlük Belge Taşıma', `${selectedPerson.fullName}: eski biçimde kaydedilmiş ${yeniHareketler.length} belge doğru klasöre taşındı.`);
          }
        } catch (err) {
          // Hata olursa sessiz geçilir; belge kaybolmaz, eski anahtarda kalır
          console.error('Eski özlük belgeleri taşınamadı:', err);
        }
      })();
      return () => { iptal = true; }; // Personel değişirse state güncellemesi yapılmaz
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPerson?.id, selectedPerson?.ozlukDosyalari]);

    const filteredList = personnelList.filter(p => {
      // UZAKTAN çalışanların özlük dosyası tutulmaz
      if (isUzaktanCalisan(p)) return false;
      const matchesSearch = p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || (p.position && p.position.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCollar = collarFilter === 'Tümü' ? true : p.collarType === collarFilter;
      // YENİ: employmentStatus 'Pasif' olanlar işten ayrılmış sayılır; alanı hiç
      // girilmemiş eski kayıtlar çalışan (Aktif) kabul edilir.
      const durum = p.employmentStatus === 'Pasif' ? 'Pasif' : 'Aktif';
      const matchesDurum = durum === durumFilter;
      return matchesSearch && matchesCollar && matchesDurum;
    }).sort((a, b) => (a.fullName || '').localeCompare((b.fullName || ''), 'tr-TR'));

    // Sekme rozetlerinde gösterilecek sayılar (yaka filtresi dahil, arama hariç)
    // DÜZELTME: Bu sayaçta UZAKTAN çalışan filtresi eksikti. filteredList uzaktan
    // çalışanları listeden çıkarırken (bkz. yukarıdaki isUzaktanCalisan kontrolü)
    // rozet onları saymaya devam ediyordu; bu yüzden "Çalışan Personel 43" yazıyor
    // ama ekranda daha az kart görünüyordu. Artık aynı kural burada da uygulanır,
    // rozetteki sayı ile listelenen özlük dosyası sayısı birebir eşleşir.
    const durumSayisi = (hedefDurum) => personnelList.filter(p => {
      if (isUzaktanCalisan(p)) return false;
      const matchesCollar = collarFilter === 'Tümü' ? true : p.collarType === collarFilter;
      const durum = p.employmentStatus === 'Pasif' ? 'Pasif' : 'Aktif';
      return matchesCollar && durum === hedefDurum;
    }).length;

    // ========================================================================
    // YENİ: HAREKETLER (ozlukGecmisi) — personelin özlük dosyasında yapılan her
    // işlem (belge ekleme, değiştirme, silme, yeniden adlandırma) tarih/saat ve
    // kullanıcı adıyla kaydedilir. Sayfanın en altındaki "Hareketler" bölümü bu
    // kayıtları en yenisi en üstte olacak şekilde listeler; eklenen belge
    // doğrudan oradan açılabilir.
    // ========================================================================
    const hareketKaydi = (tip, belgeAdi, url) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tip,                                   // 'ekleme' | 'degistirme' | 'silme' | 'yenidenAdlandirma'
      belgeAdi,
      url: url || '',
      tarih: new Date().toISOString(),
      kullanici: currentUser?.fullName || 'Sistem',
    });

    // Belge türü kimliğinden okunabilir adı bulur (documentTypes aşağıda tanımlıdır)
    const belgeAdiBul = (docTypeId) => (documentTypes.find(d => d.id === docTypeId)?.label) || docTypeId;

    // ======================================================================
    // ÇOKLU BELGE DESTEĞİ
    // belgeListesiNormalize artık shared.tsx'ten geliyor (dosyanın en üstünde
    // import edilmiş). Buradaki YEREL kopya kaldırıldı; sebebi, personel
    // profilindeki tutanak/rapor ekleme akışının da aynı mantığa ihtiyaç
    // duyması. İki yerde aynı fonksiyonun iki kopyası olması, birinde yapılan
    // düzeltmenin diğerine yansımaması riskini taşıyordu.
    // Desteklenen üç biçim (dizi / metin / tek nesne) aynen korundu.
    // ======================================================================

    // YENİ: Artık BİRDEN FAZLA dosya seçilebilir (MediaCaptureMenu'ye multiple=true verildi).
    // Her dosya sırayla yüklenir ve mevcut belge listesine EKLENİR (üzerine yazmaz).
    const handleFileUpload = async (e, docType) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0 || !selectedPerson) return;
      setIsUploading(true);

      const mevcutListe = belgeListesiNormalize((selectedPerson.ozlukDosyalari || {})[docType]);
      const vardiMi = mevcutListe.length > 0;
      const yeniDosyalar = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
          const text = await res.text();
          let uploadedUrl = file.name;
          try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
          yeniDosyalar.push({ url: uploadedUrl, name: file.name, date: new Date().toISOString() });
        } catch (err) {
          console.error("Yükleme hatası:", err);
          alert(`"${file.name}" yüklenemedi.`);
        }
      }

      if (yeniDosyalar.length > 0) {
        const guncelListe = [...mevcutListe, ...yeniDosyalar];
        const updatedOzluk = { ...(selectedPerson.ozlukDosyalari || {}), [docType]: guncelListe };
        // Aynı belge zaten varsa bu bir "ekleme (çoklu)" hareketidir, hiç yoksa "ekleme"
        const hareketMetni = yeniDosyalar.length > 1 ? `${yeniDosyalar.length} dosya birlikte eklendi` : yeniDosyalar[0].name;
        const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), hareketKaydi(vardiMi ? 'degistirme' : 'ekleme', belgeAdiBul(docType), hareketMetni)];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukDosyalari: updatedOzluk, ozlukGecmisi: yeniGecmis });
        addSystemLog('Özlük Dosyası Eklendi', `${selectedPerson.fullName} personeline ait ${belgeAdiBul(docType)} belgesine ${yeniDosyalar.length} dosya ${vardiMi ? 'eklendi' : 'eklendi'}.`);
        setSelectedPerson({ ...selectedPerson, ozlukDosyalari: updatedOzluk, ozlukGecmisi: yeniGecmis });
      }
      setIsUploading(false);
    };

    // YENİ: Bir belge türündeki TEK BİR dosyayı listeden çıkarır (dizideki index ile).
    // Tümü silinirse belge türü tamamen kaldırılır (kart yeniden "Yükle" durumuna döner).
    const handleDeleteSingleFile = async (docType, index) => {
      if (!window.confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
      const mevcutListe = belgeListesiNormalize((selectedPerson.ozlukDosyalari || {})[docType]);
      const silinen = mevcutListe[index];
      const kalanListe = mevcutListe.filter((_, i) => i !== index);
      const updatedOzluk = { ...(selectedPerson.ozlukDosyalari || {}) };
      if (kalanListe.length > 0) updatedOzluk[docType] = kalanListe; else delete updatedOzluk[docType];
      const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), hareketKaydi('silme', belgeAdiBul(docType), silinen?.name || '')];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukDosyalari: updatedOzluk, ozlukGecmisi: yeniGecmis });
      addSystemLog('Özlük Dosyası Silindi', `${selectedPerson.fullName} personeline ait ${belgeAdiBul(docType)} belgesinden 1 dosya silindi.`);
      setSelectedPerson({ ...selectedPerson, ozlukDosyalari: updatedOzluk, ozlukGecmisi: yeniGecmis });
    };

    const handleDeleteFile = async (docType) => {
      if (!window.confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
      const updatedOzluk = { ...(selectedPerson.ozlukDosyalari || {}) };
      delete updatedOzluk[docType];
      const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), hareketKaydi('silme', belgeAdiBul(docType), '')];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukDosyalari: updatedOzluk, ozlukGecmisi: yeniGecmis });
      addSystemLog('Özlük Dosyası Silindi', `${selectedPerson.fullName} personeline ait ${belgeAdiBul(docType)} dosyası silindi.`);
      setSelectedPerson({ ...selectedPerson, ozlukDosyalari: updatedOzluk, ozlukGecmisi: yeniGecmis });
    };

    // YENİ: FAZLADAN (EKSTRA) BELGE yükle — sabit 12 belge türü dışında özel adlı belge eklenir.
    // Ekstra belgeler ayrı bir dizi alanında tutulur: ozlukEkstra = [{ id, label, url }]
    const handleAddExtraFile = async (e) => {
      const file = e.target.files[0];
      if (!file || !selectedPerson || !extraLabel.trim()) return;
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        const newExtra = { id: Date.now().toString(), label: extraLabel.trim(), url: uploadedUrl };
        const updatedExtra = [...(selectedPerson.ozlukEkstra || []), newExtra];
        const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), hareketKaydi('ekleme', extraLabel.trim(), uploadedUrl)];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukEkstra: updatedExtra, ozlukGecmisi: yeniGecmis });
        addSystemLog('Ekstra Belge Eklendi', `${selectedPerson.fullName} personeline "${extraLabel.trim()}" belgesi eklendi.`);
        setSelectedPerson({ ...selectedPerson, ozlukEkstra: updatedExtra, ozlukGecmisi: yeniGecmis });
        setExtraLabel(''); setShowExtraForm(false);
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Dosya yüklenemedi.");
      }
      setIsUploading(false);
    };

    // YENİ: Ekstra belgeyi sil
    const handleDeleteExtraFile = async (extraId) => {
      if (!window.confirm('Bu ekstra belgeyi silmek istediğinize emin misiniz?')) return;
      const silinen = (selectedPerson.ozlukEkstra || []).find(x => x.id === extraId);
      const updatedExtra = (selectedPerson.ozlukEkstra || []).filter(x => x.id !== extraId);
      const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), hareketKaydi('silme', silinen?.label || 'Ekstra Belge', '')];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukEkstra: updatedExtra, ozlukGecmisi: yeniGecmis });
      addSystemLog('Ekstra Belge Silindi', `${selectedPerson.fullName} personeline ait "${silinen?.label || 'ekstra belge'}" silindi.`);
      setSelectedPerson({ ...selectedPerson, ozlukEkstra: updatedExtra, ozlukGecmisi: yeniGecmis });
    };

    // YENİ: Ekstra belgenin adını düzenle
    const handleRenameExtraFile = async (extraId) => {
      const current = (selectedPerson.ozlukEkstra || []).find(x => x.id === extraId);
      const yeni = window.prompt('Belge adını düzenleyin:', current?.label || '');
      if (yeni === null || !yeni.trim()) return;
      const updatedExtra = (selectedPerson.ozlukEkstra || []).map(x => x.id === extraId ? { ...x, label: yeni.trim() } : x);
      const yeniGecmis = [...(selectedPerson.ozlukGecmisi || []), hareketKaydi('yenidenAdlandirma', `${current?.label || '-'} → ${yeni.trim()}`, current?.url || '')];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukEkstra: updatedExtra, ozlukGecmisi: yeniGecmis });
      setSelectedPerson({ ...selectedPerson, ozlukEkstra: updatedExtra, ozlukGecmisi: yeniGecmis });
    };

    const documentTypes = [
      { id: 'kimlik', label: 'Kimlik Fotokopisi' },
      { id: 'ehliyet', label: 'Sürücü Belgesi (Ehliyet)' },
      { id: 'ikametgah', label: 'İkametgah Belgesi' },
      { id: 'sabikaKaydi', label: 'Adli Sicil Kaydı' },
      { id: 'saglikRaporu', label: 'Sağlık Raporu' },
      { id: 'sozlesme', label: 'İş Sözleşmesi' },
      { id: 'diploma', label: 'Diploma / Mezuniyet Belgesi' },
      { id: 'sgk', label: 'SGK İşe Giriş Bildirgesi' },
      { id: 'tutanaklar', label: 'Tutanaklar' },
      { id: 'icraDosyasi', label: 'İcra Dosyası' },
      { id: 'isGuvenligi', label: 'İş Güvenliği' },
      // YENİ: KVKK Aydınlatma/Rıza Metni ve Maaş Bordroları
      { id: 'kvkk', label: 'KVKK Aydınlatma Metni' },
      { id: 'maasBordro', label: 'Maaş Bordrosu' },
      // YENİ: Askerlik Belgesi (Terhis / Tecil / Muafiyet Belgesi)
      { id: 'askerlik', label: 'Askerlik Belgesi' },
      // YENİ: Eşya Teslim — artık her personelde sabit bir belge kartı olarak durur;
      // "Fazladan Belge Ekle" ile her seferinde elle eklemeye gerek kalmaz.
      { id: 'esyaTeslim', label: 'Eşya Teslim' },
      { id: 'digerBelgeler', label: 'Diğer Belgeler' }
    ];

    if (!selectedPerson) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-7xl mx-auto h-full flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-neutral-200 pb-4 gap-4 shrink-0">
            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
              <FolderOpen className="w-6 h-6" /> Personel Özlük Dosyaları
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input type="text" placeholder="Personel Ara..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition" />
              </div>
              <div className="flex bg-neutral-100 p-1 rounded-xl shrink-0">
                <button onClick={() => setCollarFilter('Tümü')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${collarFilter === 'Tümü' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Tümü</button>
                <button onClick={() => setCollarFilter('Mavi Yaka')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${collarFilter === 'Mavi Yaka' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Mavi Yaka</button>
                <button onClick={() => setCollarFilter('Beyaz Yaka')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${collarFilter === 'Beyaz Yaka' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Beyaz Yaka</button>
              </div>
            </div>
          </div>

          {/* YENİ: ÇALIŞMA DURUMU SEKMELERİ — açılışta "Çalışan Personel" seçilidir.
              "İşten Ayrılmış Personel"e geçildiğinde ayrılan personelin özlük dosyaları
              görünür. Yukarıdaki Mavi/Beyaz Yaka filtresi ve arama iki sekmede de geçerlidir. */}
          <div className="flex flex-wrap gap-2 mb-5 shrink-0">
            <button onClick={() => setDurumFilter('Aktif')}
              className={`px-4 py-2.5 rounded-xl text-sm font-black transition flex items-center gap-2 border ${durumFilter === 'Aktif' ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20' : 'bg-white text-neutral-500 border-neutral-200 hover:border-green-400 hover:text-green-700'}`}>
              <Users className="w-4 h-4" /> Çalışan Personel
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${durumFilter === 'Aktif' ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{durumSayisi('Aktif')}</span>
            </button>
            <button onClick={() => setDurumFilter('Pasif')}
              className={`px-4 py-2.5 rounded-xl text-sm font-black transition flex items-center gap-2 border ${durumFilter === 'Pasif' ? 'bg-neutral-800 text-white border-neutral-800 shadow-md shadow-neutral-800/20' : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-black'}`}>
              <Ban className="w-4 h-4" /> İşten Ayrılmış Personel
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${durumFilter === 'Pasif' ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{durumSayisi('Pasif')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4">
            {filteredList.map(p => {
              const evrakCount = Object.keys(p.ozlukDosyalari || {}).length;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-red-100 shadow-sm hover:border-red-300 hover:shadow-md transition-all flex flex-col p-5 group">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200 shadow-sm">
                      {p.profileImage ? <img src={p.profileImage} className="w-full h-full object-cover"/> : <User className="w-6 h-6 m-4 text-neutral-400"/>}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <h3 className="font-bold text-black text-sm truncate" title={p.fullName}>{p.fullName}</h3>
                      <p className="text-[11px] text-neutral-500 truncate font-medium mt-0.5" title={p.position}>{p.position}</p>
                      {/* YENİ: İşten ayrılmış personelde ayrılış tarihi rozeti */}
                      {p.employmentStatus === 'Pasif' && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
                          <Ban className="w-2.5 h-2.5" /> {p.resignationDate ? `Ayrıldı: ${new Date(p.resignationDate).toLocaleDateString('tr-TR')}` : 'İşten Ayrıldı'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-red-50">
                    {/* YENİ: "X Evrak" rozeti artık tıklanabilir — dosya görünümünü açar */}
                    <button onClick={() => setSelectedPerson(p)} className="flex items-center gap-1.5 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition">
                      <FolderOpen className="w-4 h-4" /> {evrakCount} Evrak
                    </button>
                    <button onClick={() => setSelectedPerson(p)} className="text-[10px] font-black text-red-500 group-hover:text-red-700 uppercase tracking-widest transition">
                      DOSYAYI AÇ
                    </button>
                  </div>
                </div>
              )
            })}
            {filteredList.length === 0 && (
              <div className="col-span-full py-12 text-center text-neutral-500 font-medium">
                {searchQuery.trim()
                  ? 'Aradığınız kriterlere uygun personel bulunamadı.'
                  : durumFilter === 'Pasif'
                    ? 'İşten ayrılmış personel kaydı bulunmuyor.'
                    : 'Çalışan personel kaydı bulunmuyor.'}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Detay Görünümü
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col relative animate-in slide-in-from-right-4 max-w-5xl mx-auto h-[calc(100vh-120px)] md:h-[calc(100vh-140px)]">
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
            <p className="font-bold text-neutral-600">Dosya Yükleniyor...</p>
          </div>
        )}
        
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-white border border-neutral-300 overflow-hidden shadow-sm shrink-0">
               {selectedPerson.profileImage ? <img src={selectedPerson.profileImage} className="w-full h-full object-cover"/> : <User className="w-6 h-6 m-3 text-neutral-400"/>}
             </div>
             <div>
               <h2 className="text-lg font-black text-black leading-tight">{selectedPerson.fullName}</h2>
               <p className="text-xs font-medium text-neutral-600">{selectedPerson.position} • {selectedPerson.tcNo || 'TC No Yok'}</p>
             </div>
          </div>
          <button onClick={() => setSelectedPerson(null)} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition shadow-sm">
             <ChevronLeft className="w-4 h-4" /> Geri Dön
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentTypes.map(docType => {
                // YENİ: fileUrl artık tek değer değil, normalize edilmiş bir DİZİ.
                // Eski kayıtlar (string/tek nesne) da otomatik olarak diziye çevrilir.
                const belgeler = belgeListesiNormalize(selectedPerson.ozlukDosyalari?.[docType.id]);
                const varMi = belgeler.length > 0;
                return (
                  <div key={docType.id} className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 relative group bg-white shadow-sm hover:shadow-md transition hover:border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className={`w-5 h-5 ${varMi ? 'text-green-500' : 'text-neutral-400'}`} />
                      <h3 className="font-bold text-sm text-neutral-800 leading-tight flex-1">{docType.label}</h3>
                      {/* YENİ: Belge sayısı 1'den fazlaysa küçük bir rozet gösterilir */}
                      {belgeler.length > 1 && (
                        <span className="text-[10px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">{belgeler.length}</span>
                      )}
                    </div>

                    {varMi ? (
                      <div className="flex flex-col gap-1.5 mt-auto">
                        {/* YENİ: Her dosya kendi satırında — Görüntüle + tek tek Kaldır */}
                        {belgeler.map((b, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <button onClick={() => setViewingImage({ title: `${docType.label}${belgeler.length > 1 ? ` (${i + 1}/${belgeler.length})` : ''}`, name: b.url })}
                              className="flex-1 py-2 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 border border-neutral-200 min-w-0">
                              <Eye className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{b.name || 'Görüntüle'}</span>
                            </button>
                            <button onClick={() => handleDeleteSingleFile(docType.id, i)} title="Bu dosyayı kaldır"
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition border border-red-100 shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {/* YENİ: Ekle — mevcut listeye birden fazla dosya daha eklenebilir (üzerine yazmaz) */}
                        <div className="flex gap-1.5">
                          <MediaCaptureMenu
                            onChange={(e) => handleFileUpload(e, docType.id)}
                            disabled={isUploading}
                            buttonLabel="Belge Ekle"
                            compact={true}
                            multiple={true}
                            buttonClassName="cursor-pointer flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 border border-blue-100"
                          />
                          {/* Birden fazla dosya varsa hepsini tek seferde kaldırma seçeneği */}
                          {belgeler.length > 1 && (
                            <button onClick={() => handleDeleteFile(docType.id)} title="Bu belge türündeki TÜM dosyaları kaldır"
                              className="px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition border border-red-100 shrink-0">
                              Tümünü Kaldır
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-auto">
                        {/* YENİ: multiple=true — ilk yüklemede de birden fazla dosya birlikte seçilebilir */}
                        <MediaCaptureMenu
                          onChange={(e) => handleFileUpload(e, docType.id)}
                          disabled={isUploading}
                          buttonLabel="Yükle"
                          compact={true}
                          multiple={true}
                          buttonClassName="cursor-pointer w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 border border-red-100 border-dashed"
                        />
                      </div>
                    )}
                  </div>
                )
            })}
          </div>

          {/* YENİ: FAZLADAN (EKSTRA) BELGELER — sabit türler dışında özel adlı belgeler */}
          <div className="mt-6 pt-5 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-sm text-neutral-700 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-red-500" /> Fazladan Belgeler</h3>
              <button onClick={() => { setShowExtraForm(v => !v); setExtraLabel(''); }} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Fazladan Belge Ekle
              </button>
            </div>

            {/* Ekstra belge ekleme formu: önce ad girilir, sonra dosya seçilir */}
            {showExtraForm && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 mb-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center animate-in slide-in-from-top-1">
                <input
                  value={extraLabel}
                  onChange={e => setExtraLabel(e.target.value)}
                  placeholder="Belge adı (örn: Referans Mektubu)"
                  className="flex-1 p-2.5 border border-neutral-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-600"
                />
                <MediaCaptureMenu
                  onChange={handleAddExtraFile}
                  disabled={isUploading || !extraLabel.trim()}
                  buttonLabel={extraLabel.trim() ? 'Dosya Seç & Yükle' : 'Önce ad girin'}
                  compact={true}
                  buttonClassName={`cursor-pointer shrink-0 px-4 py-2.5 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 ${extraLabel.trim() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-neutral-200 text-neutral-400 pointer-events-none'}`}
                />
                <button onClick={() => { setShowExtraForm(false); setExtraLabel(''); }} className="shrink-0 px-3 py-2.5 bg-white border border-neutral-300 text-neutral-600 font-bold text-xs rounded-lg hover:bg-neutral-100 transition">Vazgeç</button>
              </div>
            )}

            {(selectedPerson.ozlukEkstra || []).length === 0 && !showExtraForm && (
              <p className="text-xs text-neutral-400 font-medium py-2">Henüz fazladan belge eklenmemiş.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(selectedPerson.ozlukEkstra || []).map(extra => (
                <div key={extra.id} className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 bg-white shadow-sm hover:shadow-md transition hover:border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-green-500" />
                    <h3 className="font-bold text-sm text-neutral-800 leading-tight flex-1 truncate" title={extra.label}>{extra.label}</h3>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <button onClick={() => setViewingImage({ title: extra.label, name: extra.url })} className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 border border-neutral-200">
                      <Eye className="w-4 h-4" /> Görüntüle
                    </button>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleRenameExtraFile(extra.id)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 border border-blue-100">
                        <Edit className="w-3.5 h-3.5" /> Düzenle
                      </button>
                      <button onClick={() => handleDeleteExtraFile(extra.id)} className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 border border-red-100">
                        <X className="w-3.5 h-3.5" /> Kaldır
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================== YENİ: HAREKETLER ==================
              Özlük dosyasında yapılan tüm işlemler (ekleme / değiştirme / silme /
              yeniden adlandırma) en yenisi en üstte olacak şekilde listelenir.
              En son eklenen belge en tepede görünür ve "Aç" ile doğrudan açılır. */}
          <div className="border-t-2 border-neutral-200 mt-8 pt-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-black text-black flex items-center gap-2">
                <History className="w-5 h-5 text-red-600" /> Hareketler
              </h3>
              <span className="text-[11px] font-bold text-neutral-400">{(selectedPerson.ozlukGecmisi || []).length} kayıt</span>
            </div>

            {(selectedPerson.ozlukGecmisi || []).length === 0 ? (
              <p className="text-xs text-neutral-400 font-medium py-2">
                Henüz hareket kaydı yok. Bundan sonra eklenen, değiştirilen veya silinen her belge tarih ve saatiyle burada görünecek.
              </p>
            ) : (
              <div className="space-y-2">
                {/* En yeni hareket en üstte; varsayılan 10 kayıt gösterilir */}
                {(selectedPerson.ozlukGecmisi || [])
                  .slice()
                  .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
                  .slice(0, hareketHepsi ? undefined : 10)
                  .map((h, idx) => {
                    // NOT: Tailwind sınıfları derleme sırasında taranarak üretildiği için
                    // sınıf adları dinamik birleştirilemez; her hareket türünün sınıfları
                    // aşağıdaki sabit haritada tam olarak yazılmıştır.
                    const STIL = {
                      ekleme:            { kutu: 'bg-green-50 border-green-100', ikon: 'text-green-600', rozet: 'bg-green-50 text-green-700 border-green-100', etiket: 'Eklendi' },
                      degistirme:        { kutu: 'bg-blue-50 border-blue-100',   ikon: 'text-blue-600',  rozet: 'bg-blue-50 text-blue-700 border-blue-100',   etiket: 'Değiştirildi' },
                      silme:             { kutu: 'bg-red-50 border-red-100',     ikon: 'text-red-600',   rozet: 'bg-red-50 text-red-700 border-red-100',     etiket: 'Silindi' },
                      yenidenAdlandirma: { kutu: 'bg-amber-50 border-amber-100', ikon: 'text-amber-600', rozet: 'bg-amber-50 text-amber-700 border-amber-100', etiket: 'Adı Değişti' },
                    };
                    const st = STIL[h.tip] || STIL.ekleme;
                    return (
                      <div key={h.id} className={`flex items-center gap-3 p-3 rounded-xl border bg-white ${idx === 0 ? 'border-red-200 shadow-sm' : 'border-neutral-200'}`}>
                        <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border ${st.kutu}`}>
                          <FileText className={`w-4 h-4 ${st.ikon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-black truncate">{h.belgeAdi}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${st.rozet}`}>{st.etiket}</span>
                            {/* En son hareket vurgulanır */}
                            {idx === 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white uppercase">En Son</span>}
                          </div>
                          <div className="text-[11px] font-bold text-neutral-400 mt-0.5">
                            {new Date(h.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • {h.kullanici}
                          </div>
                        </div>
                        {/* Silinmeyen belgeler doğrudan buradan açılabilir */}
                        {h.url && h.tip !== 'silme' && (
                          <button onClick={() => setViewingImage({ title: h.belgeAdi, name: h.url })}
                            className="shrink-0 px-3 py-2 bg-neutral-900 hover:bg-black text-white text-[11px] font-black rounded-lg transition flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> Aç
                          </button>
                        )}
                      </div>
                    );
                  })}
                {(selectedPerson.ozlukGecmisi || []).length > 10 && (
                  <button onClick={() => setHareketHepsi(v => !v)}
                    className="w-full py-2.5 text-xs font-black text-red-600 hover:bg-red-50 rounded-xl transition border border-red-100">
                    {hareketHepsi ? 'Daha Az Göster' : `Tümünü Gör (${(selectedPerson.ozlukGecmisi || []).length} kayıt)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  export const PersonelTahtasiView = ({ personnelList, setViewingPersonnelProfileId, setActiveTab, jobs = [], allPersonnelActions = [], vehicles = [], allMesaiRecords = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // YENİ: İşten ayrılmış/pasif personel tahtada hiç gösterilmez
    const activePersonnelList = personnelList.filter(p => p.employmentStatus !== 'Pasif' && !p.resignationDate);

    // Sadece Mavi Yaka veya saha personeli olarak işaretlenenleri al
    const maviYakaList = activePersonnelList.filter(p =>
      p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operatör'].includes(p.position))
    );

    // YENİ: Otomatik özellik puanları (tüm personel için hesaplanır)
    const skillsMap = React.useMemo(() => computeAllAutoSkills(personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords), [personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords]);

    // Aramaya göre filtrele
    const filteredList = maviYakaList.filter(p =>
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.position && p.position.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Pozisyonlara göre gruplandırma
    const boardColumns = [
      { id: 'sofor', title: 'Şoförler', icon: <Truck className="w-5 h-5" />, color: 'bg-purple-600', match: ['Şoför'] },
      { id: 'usta', title: 'Mobilya Ustaları', icon: <Package className="w-5 h-5" />, color: 'bg-orange-600', match: ['Mobilya Ustası'] },
      { id: 'eleman', title: 'Taşıma Elemanları', icon: <Users className="w-5 h-5" />, color: 'bg-blue-600', match: ['Taşıma Elemanı'] },
      { id: 'diger', title: 'Depo & Asansör & Diğer', icon: <Briefcase className="w-5 h-5" />, color: 'bg-green-600', match: ['Depo Sorumlusu', 'Temizlik Görevlisi', 'Operatör'] }
    ];

    const getColumnPersonnel = (matches) => {
       return filteredList.filter(p => matches.includes(p.position)).sort((a, b) => {
           // Özellik puanı kaldırıldığı için puana göre sıralama da kaldırıldı;
           // sıralama sonraki kriterlerle (isim vb.) devam eder.
           // Rütbeye göre sıralama (Müdür > Ekip Şefi > Heryerden Usta/Kalfa > Standart)
           const rankOrder = { 'Müdür': 1, 'Ekip Şefi': 2, 'Heryerden Usta': 3, 'Kalfa': 3, 'Asistan': 4, 'Standart': 5 };
           return (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99);
       });
    };

    // Tüm personelleri kapsayabilmek adına listelenmemiş pozisyonlar için bir "Belirtilmeyenler" kolonu
    const getUncategorizedPersonnel = () => {
        const matchedPositions = boardColumns.flatMap(col => col.match);
        return filteredList.filter(p => !matchedPositions.includes(p.position));
    };

    const uncategorizedList = getUncategorizedPersonnel();

    return (
      <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] animate-in fade-in pb-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <UserPlus className="w-7 h-7 text-orange-500" /> Personel Tahtası
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">Saha personellerinin pozisyon ve rütbelere göre genel görünümü.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl font-black border border-orange-200 shadow-sm flex items-center gap-2 text-sm">
                <Users className="w-4 h-4"/>
                Toplam Mavi Yaka: {maviYakaList.length}
            </div>
            <div className="relative flex-1 md:w-64 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Personel Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar items-start h-full">
          {boardColumns.map(column => {
             const colPersonnel = getColumnPersonnel(column.match);
             
             return (
               <div key={column.id} className="bg-neutral-100/50 rounded-2xl w-[280px] md:w-[320px] flex-shrink-0 flex flex-col h-full border border-neutral-200 overflow-hidden shadow-sm">
                 <div className={`p-3 border-b-4 border-black/10 flex justify-between items-center text-white shadow-sm shrink-0 ${column.color}`}>
                   <h3 className="font-black text-sm flex items-center gap-2">
                     {column.icon}
                     {column.title}
                   </h3>
                   <span className="bg-black/20 text-white text-xs font-black px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/20">
                     {colPersonnel.length} Kişi
                   </span>
                 </div>

                 <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-0 bg-white/40">
                   {colPersonnel.length === 0 ? (
                     <p className="text-center text-xs font-medium text-neutral-400 py-6 border-2 border-dashed border-neutral-200 rounded-xl bg-white">Bu bölümde personel bulunmuyor.</p>
                   ) : (
                     colPersonnel.map(person => (
                       <div key={person.id} onClick={() => { if (setViewingPersonnelProfileId && setActiveTab) { setViewingPersonnelProfileId(person.id); setActiveTab('personnelProfile'); } }} className={`bg-white p-3 rounded-xl shadow-sm border transition hover:-translate-y-1 hover:shadow-md group relative overflow-hidden cursor-pointer ${person.employmentStatus === 'Pasif' ? 'border-red-200 bg-red-50/30' : 'border-neutral-200 hover:border-orange-400'}`}>
                         <div className={`absolute top-0 left-0 w-1.5 h-full ${person.employmentStatus === 'Pasif' ? 'bg-red-500' : column.color.replace('bg-', 'bg-')}`}></div>
                         <div className="flex items-start gap-3 pl-2">
                           <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0 border-2 shadow-sm ${person.employmentStatus === 'Pasif' ? 'border-red-200 grayscale' : 'border-white'}`}>
                             {person.profileImage ? (
                               <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                             ) : (
                               <User className="w-5 h-5 text-neutral-400" />
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start gap-1">
                               <h4 className={`font-black text-sm truncate ${person.employmentStatus === 'Pasif' ? 'text-neutral-500 line-through' : 'text-black'}`} title={person.fullName}>
                                  {person.fullName}
                               </h4>
                               <div className="flex items-center gap-1 shrink-0">
                                 {/* YENİ: İsmin yanına WhatsApp butonu — tıklayınca sadece WhatsApp sohbeti açılır (mesaj yok) */}
                                 {(person.personalPhone || person.companyPhone) && (
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       let phone = (person.personalPhone || person.companyPhone || '').replace(/\D/g, '');
                                       if (!phone) return;
                                       if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                       else if (!phone.startsWith('90')) phone = '90' + phone;
                                       window.open(`https://wa.me/${phone}`, '_blank');
                                     }}
                                     title="WhatsApp ile mesaj gönder"
                                     className="p-1 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white transition shrink-0"
                                   >
                                     <MessageCircle className="w-3.5 h-3.5" />
                                   </button>
                                 )}
                                 <PersonPositionRankIcons person={person} />
                                 <SkillScoreBadge person={person} skillsMap={skillsMap} />
                               </div>
                             </div>

                             <div className="flex flex-col gap-1.5 mt-1.5">
                                <span className={`text-[10px] font-bold w-max px-2 py-0.5 rounded border ${
                                    person.rank === 'Ekip Şefi' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    (person.rank === 'Heryerden Usta' || person.rank === 'Kalfa') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-neutral-100 text-neutral-600 border-neutral-200'
                                }`}>
                                   {person.rank || 'Belirtilmedi'}
                                </span>
                                {person.secondaryPosition && (
                                  <span className="text-[10px] font-bold w-max px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                                    + {person.secondaryPosition}
                                  </span>
                                )}
                                <span className="text-[10px] text-neutral-500 font-medium truncate flex items-center gap-1">
                                   <Phone className="w-3 h-3" /> {person.personalPhone || person.companyPhone || 'Kayıtlı Numara Yok'}
                                </span>
                             </div>
                           </div>
                         </div>

                         {person.employmentStatus === 'Pasif' && (
                             <div className="mt-2 text-[10px] font-bold text-center bg-red-100 text-red-700 py-1 rounded border border-red-200 uppercase tracking-widest">PASİF PERSONEL</div>
                         )}
                       </div>
                     ))
                   )}
                 </div>
               </div>
             )
          })}

          {/* Sınıflandırılamayanlar Kolonu */}
          {uncategorizedList.length > 0 && (
             <div className="bg-neutral-100/50 rounded-2xl w-[280px] md:w-[320px] flex-shrink-0 flex flex-col h-full border border-neutral-200 overflow-hidden shadow-sm">
                 <div className="p-3 border-b-4 border-black/10 flex justify-between items-center text-white shadow-sm shrink-0 bg-neutral-600">
                   <h3 className="font-black text-sm flex items-center gap-2">
                     <AlertTriangle className="w-5 h-5" />
                     Diğer Mavi Yaka
                   </h3>
                   <span className="bg-black/20 text-white text-xs font-black px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/20">
                     {uncategorizedList.length} Kişi
                   </span>
                 </div>
                 <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-0 bg-white/40">
                    {uncategorizedList.map(person => (
                       <div key={person.id} onClick={() => { if (setViewingPersonnelProfileId && setActiveTab) { setViewingPersonnelProfileId(person.id); setActiveTab('personnelProfile'); } }} className="bg-white p-3 rounded-xl shadow-sm border border-neutral-200 relative overflow-hidden group cursor-pointer hover:-translate-y-1 hover:shadow-md transition">
                           <div className="absolute top-0 left-0 w-1.5 h-full bg-neutral-400"></div>
                           <div className="flex items-start gap-3 pl-2">
                               <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center font-bold overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                 {person.profileImage ? <img src={person.profileImage} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-neutral-400" />}
                               </div>
                               <div className="flex-1 min-w-0">
                                   <h4 className="font-black text-sm truncate text-black">{person.fullName}</h4>
                                   <span className="text-[10px] text-neutral-500 font-bold block truncate mt-0.5">{person.position || 'Belirtilmedi'}</span>
                               </div>
                           </div>
                       </div>
                    ))}
                 </div>
             </div>
          )}

        </div>
      </div>
    );
  };

// ============================================================================
// ============================================================================
// MESAİ TAKİP MODÜLÜ (Operasyon Bölümü'ne entegre edildi)
// NOT: Bu bölüm daha önce ayrı bir MesaiTakip.jsx dosyasındaydı; kullanıcı
// isteğiyle Operasyon Bölümü'nün parçası olarak buraya taşındı.
// - Ana sayfadaki "Mesai Giriş Onayla" (yeşil) / "Mesai Çıkış Onayla" (kırmızı)
//   butonları: MesaiOnayButonlari
// - İK > Mesai Takip sayfası: MesaiTakipView
// - Sol menüdeki menü satırı: MesaiTakipMenuButonu
// - Veri modeli:
//     artifacts/{appId}/public/data/mesaiQrAyarlari/qrConfig  -> 5 QR + aktif QR
//     artifacts/{appId}/public/data/mesaiQrKayitlari          -> tüm giriş/çıkış kayıtları
//   Mevcut puantaj sistemi 'mesai' koleksiyonunu kullandığı için çakışmaması
//   adına burada bilerek FARKLI koleksiyon adları kullanıldı.
// ============================================================================
// ============================================================================

// ---------------------------------------------------------------------------
// YARDIMCILAR
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DAHİLİ QR KOD ÜRETİCİ (harici kütüphane / CDN GEREKTİRMEZ)
// ÖNEMLİ DÜZELTME: Eskiden QR görselleri CDN'den yüklenen "qrcode" kütüphanesi
// ile üretiliyordu. Kütüphane yüklenemediğinde (ağ engeli, CDN erişimi vb.)
// kutular sonsuza kadar dönen bir yükleme çemberi olarak kalıyordu.
// Artık QR matrisi tamamen bu dosyanın içinde, standarda (ISO/IEC 18004)
// uygun şekilde üretiliyor: Byte modu, hata düzeltme seviyesi M, versiyon 1-10
// otomatik seçimi, Reed-Solomon hata düzeltmesi ve standart maske seçimi.
// Böylece internet bağlantısı olmasa bile QR kodlar her zaman görünür.
// ---------------------------------------------------------------------------
  // Test amaçlı: JSX'e gömülecek QR motorunun aynısı
  const qrKareKodMatris = (metin) => {
    const ECC_M = { seviyeBiti: 0, blokEcc: [0,10,16,26,18,24,16,18,22,22,26], blokSayisi: [0,1,1,1,2,2,4,4,4,5,5] };
    const T = ECC_M;
    const carp = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
    const bolen = (derece) => { const r = new Array(derece).fill(0); r[derece-1]=1; let kok=1;
      for (let i=0;i<derece;i++){ for(let j=0;j<derece;j++){ r[j]=carp(r[j],kok); if(j+1<derece) r[j]^=r[j+1]; } kok=carp(kok,0x02); } return r; };
    const kalan = (veri, bol) => { const r = new Array(bol.length).fill(0);
      for (const b of veri){ const f = b ^ r.shift(); r.push(0); for (let i=0;i<bol.length;i++) r[i]^=carp(bol[i],f); } return r; };
    const hamModul = (v) => { let r=(16*v+128)*v+64; if(v>=2){ const n=Math.floor(v/7)+2; r-=(25*n-10)*n-55; if(v>=7) r-=36; } return r; };
    const hizaKonum = (v) => { if(v===1) return []; const n=Math.floor(v/7)+2; const adim=Math.ceil((v*4+4)/(n*2-2))*2;
      const s=(v*4+17)-7; const res=[6]; for(let pos=s; res.length<n; pos-=adim) res.splice(1,0,pos); return res; };

    const bytes = []; // UTF-8 byte mod
    for (const ch of unescape(encodeURIComponent(metin))) bytes.push(ch.charCodeAt(0));

    let versiyon = 0;
    for (let v = 1; v <= 10; v++) {
      const toplam = Math.floor(hamModul(v)/8);
      const veriKod = toplam - T.blokEcc[v]*T.blokSayisi[v];
      const sayacBit = v < 10 ? 8 : 16;
      if (4 + sayacBit + bytes.length*8 <= veriKod*8) { versiyon = v; break; }
    }
    if (!versiyon) return null;

    const boyut = versiyon*4 + 17;
    const toplamKod = Math.floor(hamModul(versiyon)/8);
    const veriKodSayi = toplamKod - T.blokEcc[versiyon]*T.blokSayisi[versiyon];
    const sayacBit = versiyon < 10 ? 8 : 16;

    // Bit dizisi oluştur
    const bitler = [];
    const ekle = (deger, uzunluk) => { for (let i = uzunluk-1; i >= 0; i--) bitler.push((deger >>> i) & 1); };
    ekle(0b0100, 4); ekle(bytes.length, sayacBit);
    for (const b of bytes) ekle(b, 8);
    while (bitler.length < veriKodSayi*8 && bitler.length % 8 !== 0 === false && bitler.length < veriKodSayi*8) break;
    const bitirici = Math.min(4, veriKodSayi*8 - bitler.length);
    ekle(0, bitirici);
    ekle(0, (8 - bitler.length % 8) % 8);
    for (let dolgu = 0xEC; bitler.length < veriKodSayi*8; dolgu ^= 0xEC ^ 0x11) ekle(dolgu, 8);

    const veriKodlari = [];
    for (let i = 0; i < bitler.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b<<1)|bitler[i+j]; veriKodlari.push(b); }

    // ECC ekle + araya serpiştir
    const blokSayisi = T.blokSayisi[versiyon], blokEccUzunluk = T.blokEcc[versiyon];
    const kisaBlokSayisi = blokSayisi - toplamKod % blokSayisi;
    const kisaBlokUzunluk = Math.floor(toplamKod / blokSayisi);
    const bol = bolen(blokEccUzunluk);
    const bloklar = [], eccler = [];
    for (let i = 0, k = 0; i < blokSayisi; i++) {
      const uz = kisaBlokUzunluk - blokEccUzunluk + (i < kisaBlokSayisi ? 0 : 1);
      const dat = veriKodlari.slice(k, k + uz); k += uz;
      eccler.push(kalan(dat, bol));
      if (i < kisaBlokSayisi) dat.push(0);
      bloklar.push(dat);
    }
    const sonuc = [];
    for (let i = 0; i < bloklar[0].length; i++)
      for (let j = 0; j < bloklar.length; j++)
        if (i !== kisaBlokUzunluk - blokEccUzunluk || j >= kisaBlokSayisi) sonuc.push(bloklar[j][i]);
    for (let i = 0; i < blokEccUzunluk; i++)
      for (let j = 0; j < bloklar.length; j++) sonuc.push(eccler[j][i]);

    // Modül ızgarası
    const M = Array.from({length: boyut}, () => new Array(boyut).fill(false));
    const F = Array.from({length: boyut}, () => new Array(boyut).fill(false));
    const setF = (x, y, koyu) => { M[y][x] = koyu; F[y][x] = true; };

    const desenCiz = (cx, cy) => { // Bulucu + ayırıcı
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx+dx, y = cy+dy;
        if (x >= 0 && x < boyut && y >= 0 && y < boyut) setF(x, y, d !== 2 && d !== 4);
      }
    };
    for (let i = 0; i < boyut; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); } // Zamanlama
    desenCiz(3, 3); desenCiz(boyut-4, 3); desenCiz(3, boyut-4);
    const hizalar = hizaKonum(versiyon);
    for (let i = 0; i < hizalar.length; i++) for (let j = 0; j < hizalar.length; j++) {
      if ((i===0&&j===0)||(i===0&&j===hizalar.length-1)||(i===hizalar.length-1&&j===0)) continue;
      for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) setF(hizalar[j]+dx, hizalar[i]+dy, Math.max(Math.abs(dx),Math.abs(dy)) !== 1);
    }
    // Format ve versiyon alanlarını rezerve et
    const formatCiz = (maske) => {
      const veri = T.seviyeBiti << 3 | maske;
      let rem = veri; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((veri << 10 | rem) ^ 0x5412) & 0x7FFF;
      const bit = (i) => (bits >>> i) & 1 ? true : false;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) setF(boyut-1-i, 8, bit(i));
      for (let i = 8; i < 15; i++) setF(8, boyut-15+i, bit(i));
      setF(8, boyut-8, true);
    };
    formatCiz(0);
    if (versiyon >= 7) {
      let rem = versiyon; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = versiyon << 12 | rem;
      for (let i = 0; i < 18; i++) { const b = ((bits >>> i) & 1) === 1; const a = boyut-11+i%3, c = Math.floor(i/3); setF(a, c, b); setF(c, a, b); }
    }

    // Veri bitlerini zikzak yerleştir
    let bi = 0;
    for (let sag = boyut-1; sag >= 1; sag -= 2) {
      if (sag === 6) sag = 5;
      for (let dikey = 0; dikey < boyut; dikey++) for (let j = 0; j < 2; j++) {
        const x = sag - j, yukari = ((sag + 1) & 2) === 0, y = yukari ? boyut-1-dikey : dikey;
        if (!F[y][x] && bi < sonuc.length * 8) { M[y][x] = ((sonuc[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }

    const maskeUygula = (grid, maske) => {
      const g = grid.map(r => r.slice());
      for (let y = 0; y < boyut; y++) for (let x = 0; x < boyut; x++) {
        if (F[y][x]) continue;
        let ters;
        switch (maske) {
          case 0: ters = (x + y) % 2 === 0; break;
          case 1: ters = y % 2 === 0; break;
          case 2: ters = x % 3 === 0; break;
          case 3: ters = (x + y) % 3 === 0; break;
          case 4: ters = (Math.floor(x/3) + Math.floor(y/2)) % 2 === 0; break;
          case 5: ters = x*y % 2 + x*y % 3 === 0; break;
          case 6: ters = (x*y % 2 + x*y % 3) % 2 === 0; break;
          case 7: ters = ((x + y) % 2 + x*y % 3) % 2 === 0; break;
        }
        if (ters) g[y][x] = !g[y][x];
      }
      return g;
    };

    const ceza = (g) => {
      let p = 0;
      for (let y = 0; y < boyut; y++) { let renk = g[y][0], say = 1;
        for (let x = 1; x < boyut; x++) { if (g[y][x] === renk) { say++; if (say === 5) p += 3; else if (say > 5) p++; } else { renk = g[y][x]; say = 1; } } }
      for (let x = 0; x < boyut; x++) { let renk = g[0][x], say = 1;
        for (let y = 1; y < boyut; y++) { if (g[y][x] === renk) { say++; if (say === 5) p += 3; else if (say > 5) p++; } else { renk = g[y][x]; say = 1; } } }
      for (let y = 0; y < boyut-1; y++) for (let x = 0; x < boyut-1; x++)
        if (g[y][x] === g[y][x+1] && g[y][x] === g[y+1][x] && g[y][x] === g[y+1][x+1]) p += 3;
      // Bulucu desen benzeri 1:1:3:1:1 kalıbı (iki yanından biri 4 açık modül ise ceza)
      const kalip = [true,false,true,true,true,false,true];
      const esles = (arr) => {
        let c = 0;
        const acikMi = (i) => (i < 0 || i >= arr.length) ? true : !arr[i]; // Sınır dışı = açık kabul
        for (let i = 0; i + 7 <= arr.length; i++) {
          let ok = true;
          for (let k = 0; k < 7; k++) if (arr[i+k] !== kalip[k]) { ok = false; break; }
          if (!ok) continue;
          let sol = true, sag = true;
          for (let k = 1; k <= 4; k++) { if (!acikMi(i-k)) sol = false; if (!acikMi(i+6+k)) sag = false; }
          if (sol || sag) c++;
        }
        return c;
      };
      for (let y = 0; y < boyut; y++) p += 40 * esles(g[y]);
      for (let x = 0; x < boyut; x++) p += 40 * esles(g.map(r => r[x]));
      let koyu = 0; g.forEach(r => r.forEach(v => { if (v) koyu++; }));
      p += 10 * Math.floor(Math.abs(koyu * 20 - boyut*boyut*10) / (boyut*boyut));
      return p;
    };

    // Format bitlerini verilen ızgaraya, verilen maske numarası için yazar
    const formatYaz = (g, maske) => {
      const veri = T.seviyeBiti << 3 | maske;
      let rem = veri; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((veri << 10 | rem) ^ 0x5412) & 0x7FFF;
      const bit = (i) => ((bits >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) g[i][8] = bit(i);
      g[7][8] = bit(6); g[8][8] = bit(7); g[8][7] = bit(8);
      for (let i = 9; i < 15; i++) g[8][14 - i] = bit(i);
      for (let i = 0; i < 8; i++) g[8][boyut-1-i] = bit(i);
      for (let i = 8; i < 15; i++) g[boyut-15+i][8] = bit(i);
      g[boyut-8][8] = true; // Sabit koyu modül
    };

    // STANDARDA UYGUN MASKE SEÇİMİ: her maske için TAM matris (maske + o maskeye
    // ait format bitleri) kurulur, ceza puanı hesaplanır ve en düşük olan seçilir.
    let enIyi = null, enIyiMaske = 0, enAzCeza = Infinity;
    for (let m = 0; m < 8; m++) {
      const g = maskeUygula(M, m);
      formatYaz(g, m);
      const c = ceza(g);
      if (c < enAzCeza) { enAzCeza = c; enIyi = g; enIyiMaske = m; }
    }
    return { matris: enIyi, boyut, versiyon, maske: enIyiMaske };

  };

  // QR okuma kütüphanesi (jsQR) yalnızca KAMERA ile okuma için gereklidir.
  // Tek bir CDN'e bağlı kalmamak için sırayla birden fazla adres denenir.
  const qrOkuKutuphanesi = async () => {
    if (typeof window !== 'undefined' && window.jsQR) return window.jsQR;
    const adresler = [
      'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
      'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js'
    ];
    for (const src of adresler) {
      try {
        await new Promise((resolve, reject) => {
          const el = document.createElement('script');
          el.src = src; el.async = true;
          el.onload = resolve; el.onerror = () => reject(new Error('yuklenemedi'));
          document.head.appendChild(el);
        });
        if (window.jsQR) return window.jsQR; // Başarılı
      } catch (e) { /* Sıradaki adresi dene */ }
    }
    return null; // Hiçbiri yüklenemedi -> kullanıcı elle kod girebilir
  };

// ÖNEMLİ DEĞİŞİKLİK: Eskiden her QR için ayrıca 15 haneli bir iç kod (qrDeger)
// üretilip ekranda gösteriliyordu. Kullanıcı isteğiyle bu TAMAMEN KALDIRILDI.
// Artık TEK bir kod vardır: SMB-XXXX-XXXX seri kodu. Bu kod hem QR karekodun
// İÇERİĞİDİR (kamerayla okutulur) hem de kamerası bozuk personelin ELLE
// gireceği koddur. Böylece takip tek kod üzerinden yürür.

// Seri kod üreticisi: SMB-XXXX-XXXX (karışan 0/O, 1/I karakterleri hariç)
const rastgeleManuelKod = () => {
  const havuz = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  const blok = (n) => Array.from({ length: n }, () => havuz[Math.floor(Math.random() * havuz.length)]).join('');
  return `SMB-${blok(4)}-${blok(4)}`;
};

// Bugünün ve dünün tarihi (YYYY-AA-GG) + şu anki saat (SS:DD)
const mesaiBugunStr = () => new Date().toISOString().split('T')[0];
const mesaiDunStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };
const mesaiSuankiSaat = () => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

// Personelin yakasını belirler (uygulamanın diğer bölümlerindeki mantıkla birebir aynı)
export const mesaiYakaTipi = (p) => (p?.collarType === 'Mavi Yaka' || (!p?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p?.position))) ? 'Mavi Yaka' : 'Beyaz Yaka';

// ============================================================================
// YENİ: MESAİ TAKİBİNE KİM DAHİL?
// Kullanıcı kuralı: "Sadece Beyaz Yakada örgün çalışanların takibi olsun.
// Uzaktan olanların olmasın. QR Kod Anasayfa ve Mesai Takip Bölümünde
// uzaktan çalışanlar gözükmesin."
// Bu yüzden ARTIK tek kapı bu fonksiyondur: hem Anasayfa QR butonları hem
// Mesai Takip tablosu buradan geçer. calismaSekli === 'Uzaktan' olan personel
// (danışman, uzaktan panel kullanıcısı vb.) hiçbir yerde görünmez.
// NOT: isUzaktanCalisan shared.tsx'ten geliyor (dosyanın en üstünde import edilmiş).
// ============================================================================
export const mesaiTakibeDahil = (p) => !!p && p.employmentStatus !== 'Pasif' && !isUzaktanCalisan(p);

// ============================================================================
// YENİ: BEYAZ YAKA ÖNERİ MOTORU
// Kullanıcı kuralı: "Beyaz Yakada sistem mesaili giriş yapmasın, durumu göre
// biz yaparız." Yani beyaz yakada geç geliş / fazla mesai / eksik mesai
// HESAPLANMAZ. Sistem yalnızca üç durumdan birini önerir:
//   • QR/kod okuttu           -> G  (Geldi)
//   • Okutmadı + izin günü    -> Hİ (Haftalık İzin)
//   • Okutmadı + normal gün   -> D  (Devamsızlık)
// Saat (hours) her zaman boş kalır; fazla/eksik mesai yöneticinin elle
// gireceği bir karardır. Mavi yakanın mesaiOnerileriHesapla motoruna
// KESİNLİKLE dokunulmadı; bu ayrı ve çok daha sade bir fonksiyondur.
// DİKKAT: Burada kullanılan gununProgrami() bu dosyada AŞAĞIDA tanımlıdır.
// Sorun oluşturmaz, çünkü çağrı fonksiyon GÖVDESİNİN içindedir; modül
// tamamen yüklendikten sonra çalışır. Dosyanın üstüne taşımayın.
// ============================================================================
export const beyazYakaOnerileriHesapla = (personeller, qrKayitlari, tarihStr, atananIsSeti = null) => {
  const sonuc = {};
  (personeller || []).forEach(person => {
    const giris = (qrKayitlari || []).find(k => String(k.personnelId) === String(person.id) && k.type === 'giris');
    const cikis = (qrKayitlari || []).find(k => String(k.personnelId) === String(person.id) && k.type === 'cikis');
    const prog = gununProgrami(person, tarihStr); // Haftalık izin günü bilgisi için

    if (giris) {
      // QR okutmuş -> sadece "Geldi". Saat hesabı yapılmaz.
      sonuc[person.id] = {
        status: 'G', hours: '',
        girisSaati: giris.timeStr, cikisSaati: cikis?.timeStr || null,
        aciklama: 'QR/kod ile giriş yapıldı → Geldi. (Beyaz yakada fazla/eksik mesai sistem tarafından hesaplanmaz.)',
        kaynak: giris.method
      };
      return;
    }
    // YENİ (kullanıcı talebi): ŞEHİR DIŞI GÖREV — GECİKMELİ ÇIKIŞ BASMA
    // Giriş yok ama çıkış varsa, personel önceki gün(ler)deki şehir dışı
    // görevden dönüp çıkış basmış demektir. Devamsız değil, Fazla Gün (FG).
    // Beyaz yakada saat hesabı yapılmadığı için hours yine boş bırakılır.
    if (cikis) {
      sonuc[person.id] = {
        status: 'FG', hours: '',
        girisSaati: null, cikisSaati: cikis.timeStr,
        aciklama: `Giriş kaydı yok ama ${cikis.timeStr} çıkış basılmış → şehir dışı görevden dönüş kabul edildi; 1 Fazla Gün (FG) eklendi.`,
        kaynak: cikis.method || 'cikis',
        gecikmeliCikis: true,
      };
      return;
    }
    // ====================================================================
    // YENİ (kullanıcı talebi): İŞ ATANMIŞ AMA HİÇ BASMAMIŞ → ŞEHİR DIŞI SEFER
    // ====================================================================
    // Nakliye personeli il dışına gidince o gün ne giriş ne çıkış basabiliyor.
    // O gün kendisine iş atanmışsa: yola gitmiş demektir → DEVAMSIZ/İZİN değil,
    // 1 FAZLA GÜN (FG). atananIsSeti verilmemişse (gerçek beyaz yaka ofis
    // personeli çağrısı) bu koşul çalışmaz; onlar için izin/devamsızlık akışı
    // aynen sürer. Fotoğraftaki 3 kişi (34 PCY 589 ekibi) bu daldan FG alır.
    // ====================================================================
    if (atananIsSeti && atananIsSeti.has(String(person.id))) {
      sonuc[person.id] = {
        status: 'FG', hours: '',
        girisSaati: null, cikisSaati: null,
        aciklama: 'O gün iş atanmış ama giriş/çıkış basılmamış → şehir dışı nakliye seferi kabul edildi; 1 Fazla Gün (FG) eklendi.',
        kaynak: 'sefer',
        seferKaydi: true,
      };
      return;
    }
    if (prog.izinli) {
      // Okutmamış ama çalışma programında o gün izinli -> Haftalık İzin
      sonuc[person.id] = {
        status: 'Hİ', hours: '',
        girisSaati: null, cikisSaati: cikis?.timeStr || null,
        aciklama: `${prog.gun} çalışma programında haftalık izin günü → Haftalık İzin önerildi.`,
        kaynak: 'program'
      };
      return;
    }
    // Okutmamış ve izin günü de değil -> Devamsızlık
    sonuc[person.id] = {
      status: 'D', hours: '',
      girisSaati: null, cikisSaati: cikis?.timeStr || null,
      aciklama: 'QR/kod ile giriş kaydı yok → Devamsızlık önerildi.',
      kaynak: 'yok'
    };
  });
  return sonuc;
};

// ============================================================================
// YENİ: POZİSYON RENK PALETİ (beyaz yaka blokları için)
// Mavi yakada renk = araç plakası (aynı ekip aynı renk). Beyaz yakada araç
// yok, o yüzden renk = POZİSYON. Aynı pozisyondaki herkes aynı renkte görünür.
// ============================================================================
export const POZISYON_RENKLERI = [
  { yazi: 'text-slate-700', rozet: 'bg-slate-100 text-slate-700 border-slate-300' },
  { yazi: 'text-sky-700', rozet: 'bg-sky-100 text-sky-700 border-sky-300' },
  { yazi: 'text-fuchsia-700', rozet: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' },
  { yazi: 'text-lime-700', rozet: 'bg-lime-100 text-lime-800 border-lime-300' },
  { yazi: 'text-violet-700', rozet: 'bg-violet-100 text-violet-700 border-violet-300' },
  { yazi: 'text-stone-700', rozet: 'bg-stone-100 text-stone-700 border-stone-300' },
  { yazi: 'text-red-700', rozet: 'bg-red-100 text-red-700 border-red-300' },
  { yazi: 'text-green-700', rozet: 'bg-green-100 text-green-700 border-green-300' },
];

// Pozisyon adından SABİT bir renk üretir (aynı pozisyon her zaman aynı renk).
// Basit karakter toplamı hash'i kullanılır; alfabetik sıraya bağlı olmadığı
// için yeni pozisyon eklendiğinde diğerlerinin rengi kaymaz.
export const pozisyonRengi = (pozisyon) => {
  const ad = String(pozisyon || '').trim();
  if (!ad) return { yazi: 'text-neutral-500', rozet: 'bg-neutral-100 text-neutral-600 border-neutral-300' };
  let toplam = 0;
  for (let i = 0; i < ad.length; i++) toplam += ad.charCodeAt(i);
  return POZISYON_RENKLERI[toplam % POZISYON_RENKLERI.length];
};

// Cihaz tipi tespiti: kayıtlarda hangi cihazdan (iOS/Android/Bilgisayar) girildiğini görürüz
const mesaiCihazTipi = () => {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  return 'Bilgisayar';
};

// Firestore referansları
const qrConfigRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'mesaiQrAyarlari', 'qrConfig');
const mesaiKayitlarColRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'mesaiQrKayitlari');

// ---------------------------------------------------------------------------
// QR AYARLARI KANCASI (HOOK)
// 10 adet QR kod ilk kullanımda otomatik oluşturulur ve Firebase'de saklanır.
// (Modül aktif/pasif anahtarı kaldırıldı; modül her zaman aktiftir.)
// ---------------------------------------------------------------------------
const useMesaiQrAyarlari = () => {
  const [ayarlar, setAyarlar] = useState(null);
  useEffect(() => {
    let islemYapildi = false; // Yarış koşulunu engelleyen kilit (aynı anda 2 kez yazma olmasın)

    // Yeni QR kaydı üretir (tek kod: seri kod hem QR içeriği hem elle giriş kodu)
    const yeniQr = (i) => ({
      id: `qr${i + 1}`,
      ad: `QR Kod ${i + 1}`,
      manuelKod: rastgeleManuelKod(),
      olusturma: new Date().toLocaleString('tr-TR')
    });

    const unsub = onSnapshot(qrConfigRef(), async (snap) => {
      // İLK KURULUM: 5 adet QR üret (kullanıcı isteğiyle 10 yerine 5 adet)
      if (!snap.exists()) {
        if (islemYapildi) return;
        islemYapildi = true;
        const liste = Array.from({ length: 5 }, (_, i) => yeniQr(i));
        await setDoc(qrConfigRef(), { qrList: liste, aktifQrIdler: ['qr1'] });
        return;
      }

      const veri = snap.data();
      const liste = Array.isArray(veri.qrList) ? veri.qrList : [];

      // ================================================================
      // GÖÇ (MIGRATION): Eski sürümde 10 QR vardı ve her kayıtta 15 haneli
      // qrDeger alanı tutuluyordu. Kullanıcı isteğiyle artık 5 QR ve tek
      // kod (seri kod) kullanılıyor. Aşağıdaki blok mevcut kayıtları BİR
      // KEZ sadeleştirir: fazla QR'lar silinir, qrDeger alanı kaldırılır.
      // Kayıtlar korunur, sadece yapı sadeleşir.
      // ================================================================
      const fazlaVar = liste.length > 5;
      const eskiAlanVar = liste.some(q => q && q.qrDeger !== undefined);
      const eksikKod = liste.length < 5 || liste.some(q => !q || !q.manuelKod);

      if (fazlaVar || eskiAlanVar || eksikKod) {
        if (islemYapildi) { setAyarlar(veri); return; }
        islemYapildi = true;
        const temiz = liste.slice(0, 5).map((q, i) => ({
          id: q?.id || `qr${i + 1}`,
          ad: q?.ad || `QR Kod ${i + 1}`,
          manuelKod: q?.manuelKod || rastgeleManuelKod(), // qrDeger alanı bilinçli olarak yazılmaz
          olusturma: q?.olusturma || new Date().toLocaleString('tr-TR')
        }));
        while (temiz.length < 5) temiz.push(yeniQr(temiz.length));
        // Aktif QR, kalan 5 kodun dışında kaldıysa ilk koda dönülür
        // Eski tekil 'aktifQrId' alanı çoklu 'aktifQrIdler' dizisine taşınır
        const eskiAktifler = Array.isArray(veri.aktifQrIdler) ? veri.aktifQrIdler : (veri.aktifQrId ? [veri.aktifQrId] : []);
        const gecerliler = eskiAktifler.filter(id => temiz.some(q => q.id === id));
        await setDoc(qrConfigRef(), {
          qrList: temiz,
          aktifQrIdler: gecerliler.length > 0 ? gecerliler : [temiz[0].id]
        });
        return; // Yazma sonrası onSnapshot yeniden tetiklenir
      }

      setAyarlar(veri);
    });
    return () => unsub();
  }, []);
  // ÇOKLU AKTİF QR: Artık birden fazla kod aynı anda geçerli olabilir.
  // Eski kayıtlarda yalnızca tekil 'aktifQrId' bulunduğu için ona da bakılır.
  const aktifIdler = Array.isArray(ayarlar?.aktifQrIdler)
    ? ayarlar.aktifQrIdler
    : (ayarlar?.aktifQrId ? [ayarlar.aktifQrId] : []);
  const aktifQrlar = (ayarlar?.qrList || []).filter(q => aktifIdler.includes(q.id));
  const aktifQr = aktifQrlar[0] || null; // Geriye dönük uyumluluk (başlıkta ilk kod)
  return { ayarlar, aktifQr, aktifQrlar, aktifIdler };
};

// NOT: Modül Aktif/Pasif anahtarı (useMesaiModulAktif + MesaiModulSwitch)
// kullanıcı isteğiyle KALDIRILDI. Mesai Takip artık her zaman aktiftir.
// Firebase'deki eski 'modulAktif' alanı zararsız şekilde durur, okunmaz.

// ---------------------------------------------------------------------------
// SOL MENÜDEKİ "MESAİ TAKİP" SATIRI
// DEĞİŞİKLİK: Aktif/Pasif anahtarı kaldırıldı. Modül artık her zaman aktiftir
// ve bu satır İnsan Kaynakları altındaki diğer alt menü maddeleriyle birebir
// aynı görünüme sahiptir. (Görünürlük yine modül yetkisiyle yönetilir.)
// ---------------------------------------------------------------------------
export const MesaiTakipMenuButonu = ({ activeTab, setActiveTab, setIsSidebarOpen }) => {
  const secili = activeTab === 'mesaiTakip';
  return (
    <button
      onClick={() => { setActiveTab('mesaiTakip'); if (setIsSidebarOpen) setIsSidebarOpen(false); }}
      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${secili ? 'bg-green-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${secili ? 'bg-white' : 'bg-green-500'}`}></div> Mesai Takip
    </button>
  );
};


// ---------------------------------------------------------------------------
// HARİTA MODALI — kaydın alındığı konumu OpenStreetMap üzerinde gösterir
// ---------------------------------------------------------------------------
const MesaiHaritaModal = ({ kayit, onKapat }) => {
  if (!kayit || !kayit.lat) return null;
  const d = 0.003; // Harita yakınlık penceresi
  const bbox = `${kayit.lng - d},${kayit.lat - d},${kayit.lng + d},${kayit.lat + d}`;
  return (
    <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4" onClick={onKapat}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
          <div>
            <h3 className="font-black flex items-center gap-2"><MapPin className="w-5 h-5" /> Mesai Konumu</h3>
            <p className="text-xs font-bold opacity-90">{kayit.personnelName} • {kayit.type === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'} • {kayit.dateStr?.split('-').reverse().join('.')} {kayit.timeStr}</p>
          </div>
          <button onClick={onKapat} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><X className="w-5 h-5" /></button>
        </div>
        {/* Konum haritası: ek paket gerektirmeyen OpenStreetMap gömme çerçevesi */}
        <iframe title="Mesai Konumu" className="w-full h-72 border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${kayit.lat},${kayit.lng}`} />
        <div className="p-3 flex justify-between items-center text-xs font-bold text-neutral-600">
          <span>Hassasiyet: ±{Math.round(kayit.accuracy || 0)} m • Cihaz: {kayit.cihaz || '-'}</span>
          <a href={`https://www.google.com/maps?q=${kayit.lat},${kayit.lng}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700">Google Haritalar'da Aç</a>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// QR TARAYICI MODALI
// Buton açılır açılmaz: 1) Konum izni istenir 2) SEÇİM EKRANI çıkar:
//    "QR Tarat" (kamera açılır) veya "Kod Gir" (seri kod elle girilir).
// ---------------------------------------------------------------------------
export const QrTarayiciModal = ({ tip, currentUser, onKapat, hedefTarih }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const donguRef = useRef(null);
  const [asama, setAsama] = useState('secim');         // secim | kamera | manuel | kaydediliyor | basarili | hata
  const [mesaj, setMesaj] = useState('');
  const [konum, setKonum] = useState(null);            // { lat, lng, accuracy }
  const [konumDurum, setKonumDurum] = useState('aliniyor'); // aliniyor | alindi | reddedildi
  const [manuelGirdi, setManuelGirdi] = useState('');
  const [sonKayit, setSonKayit] = useState(null);
  const okunduRef = useRef(false);                     // Aynı QR'ın art arda 2 kez işlenmesini engeller

  // ==========================================================================
  // 1) KONUM
  // DAHA ÖNCE İZİN VERMİŞ PERSONELİ TEKRAR RAHATSIZ ETMEME:
  //  • Tarayıcının izin durumu önce Permissions API ile SORULUR.
  //    - 'granted' (daha önce izin verilmiş) -> izin penceresi HİÇ çıkmaz,
  //      konum doğrudan alınır. maximumAge sayesinde son 5 dakika içinde
  //      alınmış konum varsa yeniden GPS'e gidilmez (hızlı + pil dostu).
  //    - 'denied' (kalıcı reddetmiş) -> boşuna beklenmez, hemen 'reddedildi'.
  //    - 'prompt' (ilk kez) -> izin penceresi gösterilir.
  //  • Permissions API desteklenmeyen tarayıcılarda eski davranışa dönülür.
  // ==========================================================================
  useEffect(() => {
    if (!navigator.geolocation) { setKonumDurum('reddedildi'); return; }
    let iptal = false;

    const konumIste = (dahaOnceIzinli) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (iptal) return;
          setKonum({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          setKonumDurum('alindi');
        },
        () => { if (!iptal) setKonumDurum('reddedildi'); },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          // İzin zaten varsa son 5 dakikalık konum yeterlidir; yoksa taze konum istenir
          maximumAge: dahaOnceIzinli ? 300000 : 0
        }
      );
    };

    (async () => {
      try {
        if (navigator.permissions?.query) {
          const durum = await navigator.permissions.query({ name: 'geolocation' });
          if (iptal) return;
          if (durum.state === 'denied') { setKonumDurum('reddedildi'); return; }
          konumIste(durum.state === 'granted');
          return;
        }
      } catch (e) { /* Permissions API yoksa aşağıdaki yola düşülür */ }
      konumIste(false);
    })();

    return () => { iptal = true; };
  }, []);

  // 2) KAMERA: arka kamera açılır, QR bulunana kadar kare kare taranır
  useEffect(() => {
    if (asama !== 'kamera') return;
    let iptal = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (iptal) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }

        // Öncelik: tarayıcının yerleşik BarcodeDetector'ı (Android/Chrome'da çok hızlı).
        // Desteklemeyen cihazlarda (çoğu iOS Safari) jsQR kütüphanesine düşülür.
        let dedektor = null;
        if ('BarcodeDetector' in window) {
          try { dedektor = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { dedektor = null; }
        }
        const jsQR = dedektor ? null : await qrOkuKutuphanesi().catch(() => null);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tara = async () => {
          if (iptal || okunduRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            if (dedektor) {
              const kodlar = await dedektor.detect(videoRef.current);
              if (kodlar && kodlar.length > 0) return kodBulundu(kodlar[0].rawValue);
            } else if (jsQR) {
              canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
              ctx.drawImage(videoRef.current, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const sonuc = jsQR(img.data, img.width, img.height);
              if (sonuc && sonuc.data) return kodBulundu(sonuc.data);
            }
          } catch (e) { /* Tek karedeki hata taramayı durdurmaz */ }
        };
        donguRef.current = setInterval(tara, 350); // ~Saniyede 3 kare tarama: pil dostu
      } catch (e) {
        // Kamera açılamadı (izin yok / cihaz bozuk) -> otomatik olarak elle giriş moduna geç
        setMesaj('Kamera açılamadı. Seri kodu elle girebilirsiniz.');
        setAsama('manuel');
      }
    })();
    return () => { iptal = true; kamerayiKapat(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asama === 'kamera']);

  const kamerayiKapat = () => {
    if (donguRef.current) { clearInterval(donguRef.current); donguRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  // Kameradan okunan kod -> doğrula ve kaydet (yöntem: kamera)
  const kodBulundu = (deger) => {
    if (okunduRef.current) return;
    okunduRef.current = true;
    kamerayiKapat();
    dogrulaVeKaydet(String(deger || '').trim(), 'kamera');
  };

  // Elle girilen seri kod -> doğrula ve kaydet (yöntem: manuel)
  const manuelGonder = () => {
    const temiz = manuelGirdi.toLocaleUpperCase('tr-TR').replace(/[\s-]/g, '');
    if (temiz.length < 6) { setMesaj('Lütfen QR kodun altındaki seri kodu eksiksiz girin.'); return; }
    dogrulaVeKaydet(temiz, 'manuel');
  };

  // ORTAK DOĞRULAMA + KAYIT
  const dogrulaVeKaydet = async (kod, yontem) => {
    setAsama('kaydediliyor');
    try {
      // Aktif QR'ı Firebase'den taze oku (yönetici az önce değiştirmiş olabilir)
      const snap = await getDoc(qrConfigRef());
      const veri = snap.exists() ? snap.data() : null;
      // İZİN KONTROLÜ: İzinli/raporlu personel o gün mesai basamaz.
      // (Ekranda buton zaten gizlenir; bu kontrol güvenlik amaçlı ikinci kattır.)
      const izin = await izinDurumuGetir(currentUser, mesaiBugunStr());
      if (izin.izinli) throw new Error(`Bugün ${izin.etiket.toLocaleUpperCase('tr-TR')} olduğunuz için mesai kaydı oluşturulamaz. Bir hata olduğunu düşünüyorsanız yöneticinizle görüşün.`);

      // ÇOKLU AKTİF QR: okutulan kod, aktif kodlardan HERHANGİ biriyle eşleşirse geçerlidir.
      const aktifIdListesi = Array.isArray(veri?.aktifQrIdler)
        ? veri.aktifQrIdler
        : (veri?.aktifQrId ? [veri.aktifQrId] : []);
      const aktifKodlar = (veri?.qrList || []).filter(q => aktifIdListesi.includes(q.id));
      if (aktifKodlar.length === 0) throw new Error('Aktif QR kod tanımlı değil. İK > Mesai Takip > QR Yönetimi bölümünden en az bir QR aktifleştirin.');

      // TEK KOD DOĞRULAMASI: Artık 15 haneli ayrı bir kod yok. QR karekodun
      // içeriği de, elle girilen kod da aynı seri koddur (SMB-XXXX-XXXX).
      // Karşılaştırma tire ve boşluklardan bağımsız, büyük harfe çevrilerek yapılır.
      const sadelestir = (d) => String(d || '').toLocaleUpperCase('tr-TR').replace(/[\s-]/g, '');
      // Hangi aktif kodun okutulduğu da kayda yazılabilsin diye eşleşen kod bulunur
      const eslesenKod = aktifKodlar.find(q => sadelestir(kod) === sadelestir(q.manuelKod)) || null;
      const eslesti = !!eslesenKod;
      const aktif = eslesenKod || aktifKodlar[0];
      if (!eslesti) throw new Error(yontem === 'kamera' ? 'Okutulan QR kod aktif mesai koduyla eşleşmiyor. Ofis girişindeki güncel kodu okutun.' : 'Girilen seri kod hatalı. QR kodun altındaki kodu kontrol edin.');

      const kayit = {
        personnelId: String(currentUser?.id || ''),
        personnelName: currentUser?.fullName || 'Bilinmiyor',
        position: currentUser?.position || '',
        collarType: mesaiYakaTipi(currentUser),             // Mavi Yaka / Beyaz Yaka ayrımı raporda kullanılır
        type: tip,                                          // 'giris' veya 'cikis'
        method: yontem,                                     // 'kamera' veya 'manuel' -> takibi yapılır
        qrId: aktif.id, qrAd: aktif.ad,
        // GECEYİ AŞAN İŞLER: Çıkış ertesi gün 07:00'a kadar basılabildiği için
        // kaydın hangi güne yazılacağı dışarıdan (hedefTarih) belirlenebilir.
        dateStr: hedefTarih || mesaiBugunStr(), timeStr: mesaiSuankiSaat(), timestamp: Date.now(),
        lat: konum?.lat ?? null, lng: konum?.lng ?? null, accuracy: konum?.accuracy ?? null,
        konumDurumu: konumDurum === 'alindi' ? 'alindi' : 'alinamadi',
        cihaz: mesaiCihazTipi()
      };

      // Aynı gün mükerrer kontrolü: giriş varsa tekrar giriş yazılmaz,
      // çıkış varsa yeni çıkışla GÜNCELLENİR (son çıkış saati geçerlidir).
      // OKUMA OPTİMİZASYONU: tek seferlik veri için onSnapshot yerine getDocs
      // kullanılır (dinleyici kurulup kapatılmaz, yalnızca 1-2 doküman okunur).
      const bugunkuSnap = await getDocs(query(
        mesaiKayitlarColRef(),
        where('personnelId', '==', kayit.personnelId),
        where('dateStr', '==', kayit.dateStr),
        limit(5)
      ));
      const bugunku = bugunkuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mevcut = bugunku.find(k => k.type === tip);
      if (tip === 'giris' && mevcut) {
        setSonKayit(mevcut);
        setMesaj(`Bugün ${mevcut.timeStr} itibarıyla zaten mesai GİRİŞİ yaptınız. Yeni kayıt oluşturulmadı.`);
        setAsama('basarili');
        return;
      }
      // GÜNDE TEK KEZ (kullanıcı kuralı): Çıkış da tıpkı giriş gibi bir kez
      // basılır. Eskiden ikinci çıkış mevcut kaydı GÜNCELLİYORDU; artık
      // reddediliyor. Hatalı saat girildiyse yönetici, İK > Mesai Takip
      // ekranındaki kalem simgesiyle düzeltebilir.
      if (tip === 'cikis' && mevcut) {
        setSonKayit(mevcut);
        setMesaj(`Bugün ${mevcut.timeStr} itibarıyla zaten mesai ÇIKIŞI yaptınız. Yeni kayıt oluşturulmadı.`);
        setAsama('basarili');
        return;
      }
      const ref = await addDoc(mesaiKayitlarColRef(), kayit);
      setSonKayit({ id: ref.id, ...kayit });

      // ======================================================================
      // YENİ: MESAİ TAKİP <-> PERSONEL MUHASEBE CANLI ENTEGRASYONU
      // ======================================================================
      // Kullanıcı kuralı: "Sabah okutana Geldi diye işaretliyoruz; Personel
      // Muhasebe ekranında da aynı şekilde." QR/manuel GİRİŞ kaydı başarıyla
      // yazıldığı anda, o günün puantaj hücresine otomatik 'G' işlenir.
      // Güvenlik kuralları:
      //  • Yalnızca GİRİŞ kaydında çalışır (çıkışta puantaj değişmez).
      //  • Yalnızca MESAI_KURAL_BASLANGIC ve sonrası için çalışır.
      //  • Hücrede HERHANGİ bir kod zaten varsa (izin, D, elle G, FM...)
      //    ASLA üzerine yazılmaz — elle/onaylı kayıtlar her zaman üstündür.
      //  • Hata olursa sessiz geçilir; QR kaydının kendisi zaten yazıldı,
      //    yönetici Mesai Takip'ten öneriyi tek tıkla onaylayabilir.
      // ======================================================================
      if (tip === 'giris' && kayit.dateStr >= MESAI_KURAL_BASLANGIC) {
        try {
          const [py, pa, pg] = kayit.dateStr.split('-').map(Number);
          const puantajRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${py}_${pa}`);
          const pSnap = await getDoc(puantajRef);
          const pRecords = pSnap.exists() ? (pSnap.data().records || {}) : {};
          const mevcutHucre = pRecords[String(kayit.personnelId)]?.[pg];
          const mevcutKod = (typeof mevcutHucre === 'object' && mevcutHucre !== null) ? mevcutHucre.status : mevcutHucre;
          if (!mevcutKod) { // Hücre boşsa 'G' yaz — doluysa dokunma
            if (!pRecords[String(kayit.personnelId)]) pRecords[String(kayit.personnelId)] = {};
            pRecords[String(kayit.personnelId)][pg] = {
              status: 'G',
              hours: '',
              kaynak: `QR otomatik (${yontem})`, // Nereden geldiği izlenebilsin
              otomatikTarih: new Date().toISOString()
            };
            await setDoc(puantajRef, { records: pRecords, updatedAt: new Date().toISOString() }, { merge: true });
          }
        } catch (e) { console.warn('Puantaja otomatik G yazılamadı (öneri akışı devrede):', e); }
      }

      setMesaj(`Mesai ${tip === 'giris' ? 'GİRİŞİNİZ' : 'ÇIKIŞINIZ'} ${kayit.timeStr} olarak kaydedildi. İyi çalışmalar!`);
      setAsama('basarili');
    } catch (e) {
      setMesaj(e.message || 'Kayıt sırasında bir hata oluştu.');
      setAsama('hata');
    }
  };

  const kapat = () => { kamerayiKapat(); onKapat(); };
  const giris = tip === 'giris';

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        {/* Başlık: girişte yeşil, çıkışta kırmızı */}
        <div className={`p-4 text-white flex justify-between items-center bg-gradient-to-r ${giris ? 'from-green-600 to-emerald-700' : 'from-red-600 to-rose-700'}`}>
          <h3 className="font-black flex items-center gap-2">{giris ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />} Mesai {giris ? 'Giriş' : 'Çıkış'} Onayı</h3>
          <button onClick={kapat} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><X className="w-5 h-5" /></button>
        </div>

        {/* Konum durumu şeridi */}
        <div className={`px-4 py-2 text-xs font-black flex items-center gap-2 ${konumDurum === 'alindi' ? 'bg-emerald-50 text-emerald-700' : konumDurum === 'aliniyor' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
          <MapPin className="w-4 h-4 shrink-0" />
          {konumDurum === 'alindi' && `Konum alındı (±${Math.round(konum?.accuracy || 0)} m) — kayıtla birlikte saklanacak`}
          {konumDurum === 'aliniyor' && 'Konumunuz alınıyor... (lütfen konum iznini onaylayın)'}
          {konumDurum === 'reddedildi' && 'Konum alınamadı — kayıt konumsuz olarak işaretlenecek'}
        </div>

        <div className="p-4">
          {/* SEÇİM EKRANI: butona basınca önce bu pencere çıkar */}
          {asama === 'secim' && (
            <div className="space-y-3">
              <p className="text-center text-sm font-black text-neutral-700">Mesai {giris ? 'girişinizi' : 'çıkışınızı'} nasıl onaylamak istersiniz?</p>
              {/* Seçenek 1: Kamerayla QR okutma */}
              <button onClick={() => { okunduRef.current = false; setMesaj(''); setAsama('kamera'); }} className={`w-full p-4 rounded-2xl text-white font-black text-sm flex items-center gap-3 shadow-lg hover:scale-[1.02] active:scale-95 transition bg-gradient-to-r ${giris ? 'from-green-500 to-emerald-700 shadow-green-600/30' : 'from-red-500 to-rose-700 shadow-red-600/30'}`}>
                <span className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0"><Camera className="w-6 h-6" /></span>
                <span className="text-left">QR TARAT<span className="block text-[10px] font-bold opacity-80">Kamera açılır, ofisteki QR kodu okutun</span></span>
                <QrCode className="w-6 h-6 ml-auto opacity-70" />
              </button>
              {/* Seçenek 2: Seri kodu elle girme (kamerası bozuk personel için) */}
              <button onClick={() => { setMesaj(''); setAsama('manuel'); }} className="w-full p-4 rounded-2xl bg-gradient-to-r from-neutral-800 to-black text-white font-black text-sm flex items-center gap-3 shadow-lg hover:scale-[1.02] active:scale-95 transition">
                <span className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0"><Keyboard className="w-6 h-6" /></span>
                <span className="text-left">KOD GİR<span className="block text-[10px] font-bold opacity-70">QR kodun altındaki seri kodu elle yazın</span></span>
              </button>
            </div>
          )}

          {asama === 'kamera' && (
            <div>
              {/* Kamera görüntüsü + nişangah çerçevesi */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-56 h-56 border-4 rounded-2xl ${giris ? 'border-green-400' : 'border-red-400'} shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] animate-pulse`}></div>
                </div>
                <p className="absolute bottom-3 inset-x-0 text-center text-white text-xs font-bold drop-shadow">Ofis girişindeki QR kodu çerçeveye hizalayın</p>
              </div>
              {/* Kamerası bozuk personel için elle giriş yolu */}
              <button onClick={() => { kamerayiKapat(); setMesaj(''); setAsama('manuel'); }} className="mt-3 w-full py-3 rounded-xl bg-neutral-900 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-neutral-800">
                <Keyboard className="w-4 h-4" /> Kameram Bozuk — Seri Kodu Elle Gir
              </button>
            </div>
          )}

          {asama === 'manuel' && (
            <div className="space-y-3">
              {mesaj && <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {mesaj}</p>}
              <label className="text-xs font-black text-neutral-600 uppercase">QR kodun altındaki seri kodu girin</label>
              <input value={manuelGirdi} onChange={e => setManuelGirdi(e.target.value)} placeholder="SMB-XXXX-XXXX" className="w-full p-3 border-2 border-neutral-300 rounded-xl font-black tracking-widest text-center uppercase focus:border-black outline-none" autoFocus />
              <button onClick={manuelGonder} className={`w-full py-3 rounded-xl text-white font-black flex items-center justify-center gap-2 ${giris ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                <CheckCircle className="w-5 h-5" /> Onayla
              </button>
              <button onClick={() => { okunduRef.current = false; setAsama('kamera'); }} className="w-full py-2.5 rounded-xl bg-neutral-100 text-neutral-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200"><Camera className="w-4 h-4" /> Kamerayla Okutmayı Dene</button>
            </div>
          )}

          {asama === 'kaydediliyor' && (
            <div className="py-10 flex flex-col items-center gap-3 text-neutral-600">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="font-black text-sm">Kod doğrulanıyor ve kaydediliyor...</p>
            </div>
          )}

          {(asama === 'basarili' || asama === 'hata') && (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              {asama === 'basarili' ? <CheckCircle className="w-14 h-14 text-green-600" /> : <AlertTriangle className="w-14 h-14 text-red-600" />}
              <p className={`font-black text-sm ${asama === 'basarili' ? 'text-green-700' : 'text-red-700'}`}>{mesaj}</p>
              {asama === 'basarili' && sonKayit?.lat && (
                <p className="text-xs font-bold text-neutral-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Konum kayda işlendi ({sonKayit.method === 'kamera' ? 'Kamera ile okutuldu' : 'Seri kod ile elle girildi'})</p>
              )}
              {asama === 'hata' && (
                <button onClick={() => { okunduRef.current = false; setMesaj(''); setAsama('secim'); }} className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-black text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Tekrar Dene</button>
              )}
              <button onClick={kapat} className="px-6 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-bold text-sm hover:bg-neutral-200">Kapat</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// QR MESAİ -> PUANTAJ ÖNERİ MOTORU (yalnızca MAVİ YAKA)
// Amaç: "Mesai / Devamsızlık Onayla" ekranı açıldığında, personelin QR ile
// bastığı giriş/çıkış saatlerini kendi çalışma programıyla karşılaştırıp
// durum kodunu (G / FM / EM / FG / FGM / D) ve saatini HAZIR getirmek.
// Yöneticinin işi yalnızca gözden geçirip onaylamak olur.
//
// KURALLAR (kullanıcı talebine göre):
//  1) Giriş yoksa               -> D (Devamsız)
//  2) Fazla mesai EKİP BAZLIdır -> ekipteki EN ERKEN çıkış saati esas alınır
//     (ekip birlikte döndüğü için). Yarım saate AŞAĞI yuvarlanır:
//     bitiş 18:00 & çıkış 19:49 -> 19:30 -> 1,5 saat | 19:10 -> 19:00 -> 1 saat
//  3) Geç geliş / erken çıkış   -> eksik saat, yarım saate YUKARI yuvarlanır
//     (08:00 başlangıç, 08:20 giriş -> 0,5 eksik). 10 dakika tolerans vardır.
//  4) NET hesap: fazla - eksik. Örn. 2 saat fazla + 0,5 geç geliş -> 1,5 FM
//  5) İzin günü çalışıldıysa    -> FG, günlük saatten fazlaysa FGM
// ============================================================================

// "19:49" -> 1189 (dakika)
const mesaiDk = (s) => { const [h, d] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (d || 0); };

// ===========================================================================
// YENİ: GECE YARISINI AŞAN ÇIKIŞ (kritik hata düzeltmesi)
// ===========================================================================
// SORUN: Personel gece 12'den sonra mesaisini kapattığında çıkış saati küçük
// bir sayıya düşüyordu (04:00 = 240 dk). Program bitişi 18:00 (1080 dk) ile
// karşılaştırılınca iki hata birden oluşuyordu:
//   • "erken çıkış" farkı 1080-240 = 840 dk -> 14 SAAT haksız eksik mesai
//   • ekip çıkışı 240 dk sanıldığı için 10 saatlik FAZLA MESAİ hiç yazılmıyordu
// ÇÖZÜM: Çıkış saati GİRİŞ saatinden küçükse iş geceyi aşmıştır; çıkış
// dakikasına 24 saat (1440 dk) eklenir. Böylece 07:34 giriş / 04:00 çıkış
// "07:34 -> 28:00" olarak okunur ve süre 20,5 saat çıkar.
// Giriş bilinmiyorsa GECE_ESIGI_DK altındaki çıkışlar da ertesi gün sayılır
// (07:00 öncesi bir çıkış, o günün mesaisinin bitişidir).
// ===========================================================================
const GECE_ESIGI_DK = 7 * 60; // 07:00 — bu saatten önceki çıkış "dün gecenin" çıkışıdır

// ===========================================================================
// YENİ: NORMAL ÇIKIŞ PENCERESİ (kullanıcı kuralı)
// ===========================================================================
// Saha gerçeği: iş 17:00 civarında biter, personel araç boşaltıp dönerken
// çıkışı 17:20-17:50 arasında basar. Bu SIRADAN bir gün sonudur:
//   • Eksik mesai YAZILMAZ (17:10'da basana "erken çıktın" denemez)
//   • Fazla mesai de YAZILMAZ (17:33'te basan 0,5 saat mesai yapmış sayılmaz)
// Yani bu pencerede çıkış NÖTR'dür — gün normal tamamlanmıştır.
// 18:00'dan SONRAKİ çıkışlar gerçek fazla mesaidir ve eskisi gibi hesaplanır.
// 17:00'dan ÖNCEKİ çıkışlar ise gerçek erken çıkıştır, cezası işler.
// ===========================================================================
const NORMAL_CIKIS_BAS_DK = 17 * 60; // 17:00
const NORMAL_CIKIS_BIT_DK = 18 * 60; // 18:00
const normalCikisPenceresinde = (dk) => dk !== null && dk >= NORMAL_CIKIS_BAS_DK && dk <= NORMAL_CIKIS_BIT_DK;
const cikisDkNormalize = (cikisSaat, girisSaat) => {
  if (!cikisSaat) return null;
  const c = mesaiDk(cikisSaat);
  if (girisSaat) {
    const g = mesaiDk(girisSaat);
    return c < g ? c + 1440 : c;      // Çıkış girişten küçükse ertesi gün
  }
  return c < GECE_ESIGI_DK ? c + 1440 : c; // Giriş yoksa 07:00 eşiğine bak
};
// Yarım saate aşağı yuvarla (fazla mesai için): 109 dk -> 1,5 saat
const asagiYarim = (dk) => Math.max(0, Math.floor(dk / 30) / 2);
// Yarım saate yukarı yuvarla (eksik mesai için): 20 dk -> 0,5 saat
const yukariYarim = (dk) => Math.max(0, Math.ceil(dk / 30) / 2);
// Tarihten gün adını verir (Pazartesi, Salı...)
const gunAdi = (tarihStr) => HAFTA_GUNLERI[(new Date(tarihStr).getDay() + 6) % 7];

// GEÇ GELİŞ TOLERANSI (kullanıcı kuralı): 08:00 programlı personel 08:15'e
// kadar gelirse eksik mesai YAZILMAZ. 08:16'dan itibaren yarım saate YUKARI
// yuvarlanarak düşülür (08:16-08:30 -> 0,5 sa | 08:31-09:00 -> 1 sa).
// ============================================================================
// YENİ: HAFTALIK MESAİ KURAL MOTORU (tüm yakalar için ortak)
// ============================================================================
// KULLANICI KURALLARI:
//  1) QR veya elle kod okutan  -> G (Geldi)
//  2) Okutmayan personelde HAFTA bazlı karar verilir:
//       • O hafta İLK kez gelmiyorsa       -> Hİ (Haftalık İzin)
//       • O hafta İKİNCİ ve sonraki kez    -> D  (Devamsızlık)
//       • O hafta Hİ zaten kullanılmışsa   -> doğrudan D
//  3) Puantajda ELLE girilmiş izin/rapor kodu (Yİ / Bİ / Üİ / R / İB / Hİ)
//     varsa hiç dokunulmaz; o gün için QR okutma beklenmez, devamsızlık yazılmaz.
//  4) Hafta boyunca 7/7 giriş varsa PAZAR günü FG (Fazla Gün) olur.
//     (Pazar çalışılmış ama hafta tam değilse o gün normal G sayılır; çünkü
//      haftalık izin başka bir gün kullanılmış demektir.)
//
// HAFTA TANIMI: Pazartesi → Pazar (ISO). "Pazar = fazla gün" kuralı bu tanımla
// tutarlıdır; Pazar haftanın son ve normalde izinli günüdür.
// ============================================================================

// Verilen tarihin ait olduğu haftanın PAZARTESİ gününü 'YYYY-MM-DD' döner
export const haftaBaslangici = (tarihStr) => {
  const [y, a, g] = String(tarihStr || '').split('-').map(Number);
  const d = new Date(y, (a || 1) - 1, g || 1);
  const gunNo = d.getDay();                 // 0=Pazar, 1=Pazartesi ... 6=Cumartesi
  const geriGit = gunNo === 0 ? 6 : gunNo - 1; // Pazar ise 6 gün geri (Pazartesi'ye)
  d.setDate(d.getDate() - geriGit);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Haftanın 7 gününü Pazartesi'den Pazar'a sıralı 'YYYY-MM-DD' dizisi olarak döner
export const haftaninGunleri = (tarihStr) => {
  const bas = haftaBaslangici(tarihStr);
  const [y, a, g] = bas.split('-').map(Number);
  const liste = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(y, a - 1, g + i);
    liste.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return liste;
};

// Verilen tarih Pazar mı? (FG kuralı için)
export const pazarMi = (tarihStr) => {
  const [y, a, g] = String(tarihStr || '').split('-').map(Number);
  return new Date(y, (a || 1) - 1, g || 1).getDay() === 0;
};

// Elle girilmiş ve sisteme "bu gün kapandı" diyen kodlar. Bu kodlar varsa
// personelden QR okutması BEKLENMEZ ve asla devamsızlık önerilmez.
export const ELLE_IZIN_KODLARI = ['Yİ', 'Bİ', 'Üİ', 'R', 'İB'];

// ----------------------------------------------------------------------------
// HAFTA BAĞLAMI
// Bir personelin İLGİLİ HAFTASINI tarar ve karar için gereken üç bilgiyi çıkarır.
//   haftaKayitlari : o haftanın TÜM QR kayıtları (tüm personel, tüm günler)
//   puantajHafta   : { [personId]: { 'YYYY-MM-DD': kod } } elle girilmiş kodlar
// Döner: { gelmemeSirasi, haftaHiVar, tamHafta, girisGunSayisi }
//   gelmemeSirasi : bu gün, haftanın kaçıncı "gelmeme"si (1 = ilk)
//   haftaHiVar    : bu günden ÖNCE hafta içinde Hİ kullanılmış mı
//   tamHafta      : haftanın 7 gününde de giriş var mı (Pazar FG kuralı)
// ----------------------------------------------------------------------------
export const haftaBaglamiHesapla = (person, tarihStr, haftaKayitlari, puantajHafta) => {
  const gunler = haftaninGunleri(tarihStr);
  const pid = String(person?.id);
  const kisiPuantaj = (puantajHafta || {})[pid] || {};

  const girisVarMi = (gun) => (haftaKayitlari || []).some(k =>
    String(k.personnelId) === pid && k.dateStr === gun && k.type === 'giris');

  let gelmemeSirasi = 0;   // bu güne kadarki (bu gün dahil) gelmeme sayısı
  let haftaHiVar = false;  // bu günden ÖNCE Hİ kullanıldı mı
  let girisGunSayisi = 0;

  for (const gun of gunler) {
    const geldi = girisVarMi(gun);
    if (geldi) girisGunSayisi++;
    const elleKod = kisiPuantaj[gun];

    if (gun === tarihStr) {
      if (!geldi && !ELLE_IZIN_KODLARI.includes(elleKod)) gelmemeSirasi++;
      break; // Bu günden SONRAKİ günler kararı etkilemez
    }

    // Geçmiş günler: Hİ izi ara (elle girilmiş VEYA o gün gelmeyip Hİ'ye düşmüş)
    if (elleKod === 'Hİ') { haftaHiVar = true; continue; }
    if (ELLE_IZIN_KODLARI.includes(elleKod)) continue; // Yİ/R/Üİ vb. gelmeme sayılmaz
    if (!geldi) {
      gelmemeSirasi++;
      // Puantaja henüz yazılmamışsa bile, ilk gelmeme sistemce Hİ önerilmiştir
      if (gelmemeSirasi === 1) haftaHiVar = true;
    }
  }

  return { gelmemeSirasi, haftaHiVar, tamHafta: girisGunSayisi === 7, girisGunSayisi };
};

// ----------------------------------------------------------------------------
// GELMEME KARARI: Hİ mi D mi?
// Hafta içindeki ilk gelmeme ve daha önce Hİ kullanılmamışsa -> Hİ, aksi halde D
// ----------------------------------------------------------------------------
export const gelmemeKarari = (baglam) => {
  if (baglam && baglam.gelmemeSirasi === 1 && !baglam.haftaHiVar) {
    return { status: 'Hİ', aciklama: 'Bu hafta ilk kez gelinmedi → Haftalık İzin önerildi.' };
  }
  return { status: 'D', aciklama: 'Bu hafta haftalık izin zaten kullanıldı → Devamsızlık önerildi.' };
};

const GEC_GELIS_TOLERANS_DK = 15;

// ============================================================================
// YENİ (kullanıcı kuralı): EKİP BAZLI ERKEN BAŞLANGIÇ MESAİSİ
// ============================================================================
// SAHA GERÇEĞİ: Bazı ekipler sabah 07:00'dan önce yola çıkıyor. QR girişi
// 07:00'da açıldığı için bu personel kod okutamıyor ve erken başladığı saatler
// mesaiye hiç yansımıyordu.
//
// KULLANICI KURALLARI:
//  1) QR girişi artık 05:00'da açılır (aşağıdaki QR_GIRIS_ACILIS_DK).
//  2) Erken başlangıç mesaisi EKİP BAZLIDIR ve YALNIZCA şu şartta işler:
//     o gün o ekipte giriş basmış HERKESİN girişi 07:00'dan ÖNCE olmalıdır.
//     Ekipten tek bir kişinin erken okutması kimseye mesai kazandırmaz.
//  3) Şart sağlanırsa her personele KENDİ giriş saatine göre mesai eklenir:
//     program başlangıcı (genelde 08:00) ile kendi girişi arasındaki fark.
//       06:00 giriş -> 2 saat | 05:30 giriş -> 2,5 saat | 05:00 giriş -> 3 saat
//  4) Üst sınır 3 saattir (05:00'dan önce elle girilmiş bir kayıt istismara
//     yol açmasın diye).
//
// NOT: Giriş basmamış (devamsız) ekip arkadaşı bu kontrolü BOZMAZ; o kişi
// zaten o gün ekiple yola çıkmamıştır, kararı ayrı motor verir.
// ============================================================================
export const QR_GIRIS_ACILIS_DK = 5 * 60;          // 05:00 — QR giriş butonunun açıldığı saat
export const ERKEN_BASLANGIC_SINIR_DK = 7 * 60;    // 07:00 — bu saatten önceki girişler "erken"dir
export const ERKEN_BASLANGIC_MAX_SAAT = 3;         // Eklenebilecek en fazla erken mesai (05:00 -> 3 sa)

// Ekipte giriş basan HERKES 07:00'dan önce mi basmış? (kural 2)
export const ekipErkenBaslangicVarMi = (personeller, qrKayitlari) => {
  const girisDakikalari = (personeller || [])
    .map(p => (qrKayitlari || []).find(k => String(k.personnelId) === String(p?.id) && k.type === 'giris'))
    .filter(Boolean)                       // Giriş basmayanlar hesaba katılmaz
    .map(k => mesaiDk(k.timeStr));
  if (girisDakikalari.length === 0) return false;   // Hiç giriş yoksa erken başlangıç yok
  // every: TEK bir kişi 07:00 veya sonrasında bastıysa ekip erken çıkmamıştır
  return girisDakikalari.every(dk => dk < ERKEN_BASLANGIC_SINIR_DK);
};

// Kişinin KENDİ giriş saatine göre eklenecek erken mesai saatini döner (kural 3)
export const erkenBaslangicSaati = (girisSaat, programBaslangic) => {
  if (!girisSaat) return 0;
  const girisDk = mesaiDk(girisSaat);
  if (girisDk >= ERKEN_BASLANGIC_SINIR_DK) return 0; // 07:00 sonrası girişe erken mesai yok
  const fark = mesaiDk(programBaslangic || '08:00') - girisDk;
  if (fark <= 0) return 0;
  // Fazla mesaide olduğu gibi yarım saate AŞAĞI yuvarlanır (06:20 -> 1,5 sa)
  return Math.min(ERKEN_BASLANGIC_MAX_SAAT, asagiYarim(fark));
};



// Bir personelin o güne ait programını (izin günü / erken çıkış dahil) çözer
export const gununProgrami = (person, tarihStr) => {
  const p = person?.calismaProgrami || varsayilanCalismaProgrami(person?.collarType || 'Mavi Yaka');
  const gun = gunAdi(tarihStr);
  const izinli = (p.izinGunleri || []).includes(gun);
  // Erken çıkış günü ise o güne özel saatler geçerlidir
  if (p.erkenCikisVar && p.erkenCikisGunu === gun) {
    return { izinli, baslangic: p.erkenCikisBaslangic || '09:00', bitis: p.erkenCikisBitis || '15:00', gunlukSaat: Math.max(0, (mesaiDk(p.erkenCikisBitis) - mesaiDk(p.erkenCikisBaslangic)) / 60), erkenCikisGunu: true, gun };
  }
  return { izinli, baslangic: p.baslangicSaati || '08:00', bitis: p.bitisSaati || '18:00', gunlukSaat: Number(p.gunlukSaat) || 0, erkenCikisGunu: false, gun };
};

// ANA FONKSİYON: ekip için öneri üretir
// personeller: [{id, fullName, calismaProgrami, collarType}], qrKayitlari: o güne ait QR kayıtları
// Döner: { [personelId]: { status, hours, girisSaati, cikisSaati, aciklama, ekipCikis } }
export const mesaiOnerileriHesapla = (personeller, qrKayitlari, tarihStr, atananIsSeti = null) => {
  const sonuc = {};
  const kayitBul = (pId, tip) => qrKayitlari.find(k => String(k.personnelId) === String(pId) && k.type === tip);

  // 1) EKİP BAZLI ÇIKIŞ: ekipte çıkış basmış olanların EN ERKEN saati esas alınır
  // DEĞİŞTİ: Her personelin çıkışı KENDİ girişine göre normalize edilir.
  // Aksi halde geceyi aşan bir çıkış (04:00) "en erken çıkış" sanılır ve
  // tüm ekibin fazla mesaisi sıfırlanırdı.
  const cikisSaatleri = personeller
    .map(p => cikisDkNormalize(kayitBul(p.id, 'cikis')?.timeStr, kayitBul(p.id, 'giris')?.timeStr))
    .filter(v => v !== null);
  const ekipCikisDk = cikisSaatleri.length ? Math.min(...cikisSaatleri) : null;
  // Görüntülenen saat 24 saatlik biçime geri döndürülür (28:00 -> 04:00),
  // ertesi güne taştığı belli olsun diye yanına (+1 gün) notu eklenir.
  const ekipCikisSaati = ekipCikisDk === null ? null
    : `${String(Math.floor((ekipCikisDk % 1440) / 60)).padStart(2, '0')}:${String(ekipCikisDk % 60).padStart(2, '0')}${ekipCikisDk >= 1440 ? ' (+1 gün)' : ''}`;

  // 1-B) YENİ: EKİP ERKEN BAŞLANGIÇ ŞARTI (kullanıcı kuralı)
  // Bu ekipte giriş basan HERKES 07:00'dan önce bastıysa true olur. Yalnızca
  // bu durumda aşağıda kişilere kendi giriş saatine göre erken mesai eklenir.
  const ekipErkenBasladi = ekipErkenBaslangicVarMi(personeller, qrKayitlari);

  personeller.forEach(person => {
    const giris = kayitBul(person.id, 'giris');
    const cikis = kayitBul(person.id, 'cikis');
    const prog = gununProgrami(person, tarihStr);

    // ====================================================================
    // YENİ (kullanıcı talebi): ŞEHİR DIŞI GÖREV — GECİKMELİ ÇIKIŞ BASMA
    // ====================================================================
    // Durum: Personel il dışına çıkıyor, o gün çıkış basamıyor; ertesi gün
    // ya da bir sonraki gün dönüp çıkış basıyor. O günün kayıtlarında
    // GİRİŞ YOK ama ÇIKIŞ VAR olur.
    // ESKİ DAVRANIŞ: "giriş kaydı yok" denip DEVAMSIZ (D) yazılıyordu —
    // personel yolda çalışırken devamsız görünüyordu.
    // YENİ DAVRANIŞ: Bu bir dönüş kaydıdır; o gün de çalışılmış sayılır ve
    // personele 1 FAZLA GÜN (FG) eklenir. FG kodu ücret hesabında zaten
    // fazla gün olarak sayıldığı için ek bir hesaplama gerekmez.
    // NOT: Yalnızca giriş HİÇ yokken uygulanır. Aynı gün hem giriş hem
    // çıkış varsa normal gün akışı bozulmadan işler.
    if (!giris && cikis) {
      sonuc[person.id] = {
        status: 'FG', hours: '',
        girisSaati: null, cikisSaati: cikis.timeStr, ekipCikis: ekipCikisSaati,
        aciklama: `Giriş kaydı yok ama ${cikis.timeStr} çıkış basılmış → şehir dışı görevden dönüş kabul edildi; 1 Fazla Gün (FG) eklendi.`,
        kaynak: cikis.method || 'cikis',
        // Bu bayrak arayüzde uyarı rozeti göstermek için kullanılır
        gecikmeliCikis: true,
      };
      return;
    }

    // ====================================================================
    // YENİ (kullanıcı talebi): İŞ ATANMIŞ AMA HİÇ BASMAYAN → ŞEHİR DIŞI SEFER
    // ====================================================================
    // Durum: Personel il dışına nakliye seferine gidiyor; o gün NE GİRİŞ NE
    // ÇIKIŞ basabiliyor (yolda). Ama o gün kendisine bir İŞ ATANMIŞ.
    // Kural: İş atanmış + o gün hiç QR/kod kaydı yok → personel yola gitmiş
    // demektir; DEVAMSIZ değil, 1 FAZLA GÜN (FG) eklenir. (Kullanıcının
    // fotoğraftaki uyguladığı sonuç: "Fazla Gün".)
    // atananIsSeti: o gün en az bir işe atanmış personel id'lerinin kümesi.
    // Küme verilmemişse (null) eski davranış korunur; bu koşul hiç çalışmaz.
    // ====================================================================
    if (!giris && atananIsSeti && atananIsSeti.has(String(person.id))) {
      // İzin günündeyse yine de fazla gün mantıklıdır (izinde bile sefere gitmiş)
      sonuc[person.id] = {
        status: 'FG', hours: '',
        girisSaati: null, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati,
        aciklama: 'O gün iş atanmış ama giriş/çıkış basılmamış → şehir dışı nakliye seferi kabul edildi; 1 Fazla Gün (FG) eklendi.',
        kaynak: 'sefer',
        seferKaydi: true,
      };
      return;
    }

    // KURAL 1: Hiç giriş basmamışsa devamsız
    if (!giris) {
      sonuc[person.id] = { status: 'D', hours: '', girisSaati: null, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati, aciklama: 'QR/kod ile giriş kaydı yok → Devamsız önerildi.', kaynak: 'yok' };
      return;
    }

    // KURAL 5: İzin gününde çalışmışsa Fazla Gün
    if (prog.izinli) {
      const calisilanDk = ekipCikisDk !== null ? Math.max(0, ekipCikisDk - mesaiDk(giris.timeStr)) : 0;
      const fazla = asagiYarim(Math.max(0, calisilanDk - prog.gunlukSaat * 60));
      sonuc[person.id] = fazla >= 0.5
        ? { status: 'FGM', hours: String(fazla).replace('.', ','), girisSaati: giris.timeStr, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati, aciklama: `${prog.gun} izin günü çalışıldı ve günlük saati aştı → Fazla Gün + ${fazla} saat mesai.`, kaynak: giris.method }
        : { status: 'FG', hours: '', girisSaati: giris.timeStr, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati, aciklama: `${prog.gun} izin günü çalışıldı → Fazla Gün önerildi.`, kaynak: giris.method };
      return;
    }

    // ======================================================================
    // KURAL 3: GEÇ GELİŞ
    //  • ERKEN gelen hiçbir zaman ödüllendirilmez/cezalandırılmaz: 07:40'ta
    //    basan da 08:00'de basmış sayılır (mesaisinden DÜŞÜLMEZ).
    //  • 15 dakika tolerans: 08:00-08:15 arası temiz.
    //  • 08:16'dan sonrası yarım saate YUKARI yuvarlanır:
    //    08:16-08:30 -> 0,5 sa | 08:31-09:00 -> 1 sa | 09:01-09:30 -> 1,5 sa
    // ======================================================================
    const gecDk = Math.max(0, mesaiDk(giris.timeStr) - mesaiDk(prog.baslangic));
    const eksikGiris = gecDk > GEC_GELIS_TOLERANS_DK ? yukariYarim(gecDk) : 0;

    // ======================================================================
    // YENİ KURAL: ERKEN BAŞLANGIÇ MESAİSİ (ekip şartına bağlı)
    // ----------------------------------------------------------------------
    // ekipErkenBasladi yalnızca ekipte giriş basan HERKES 07:00'dan önce
    // bastıysa true'dur. Şart sağlanmazsa (ör. ekipten biri 07:30'da bastı)
    // erken basan kişiye de mesai EKLENMEZ — eski davranış aynen korunur:
    // erken gelen ödüllendirilmez, 08:00'de basmış sayılır.
    // Şart sağlanırsa kişinin KENDİ girişine göre saat eklenir:
    //   06:00 -> 2 sa | 05:30 -> 2,5 sa | 05:00 -> 3 sa
    // ======================================================================
    const erkenFazla = ekipErkenBasladi ? erkenBaslangicSaati(giris.timeStr, prog.baslangic) : 0;

    // ======================================================================
    // KURAL 2: ÇIKIŞ
    //  • FAZLA MESAİ ekip bazlıdır: ekip birlikte döndüğü için EN ERKEN çıkış
    //    esas alınır ve yarım saate AŞAĞI yuvarlanır.
    //  • ERKEN ÇIKIŞ CEZASI ise KİŞİNİN KENDİ çıkışına göre hesaplanır.
    //    DÜZELTME: Eskiden bu ceza da ekip çıkışına bakıyordu; ekipten biri
    //    erken ayrıldığında 21:00'de çıkan personele bile "eksik mesai"
    //    yazılıyordu. Artık kimse başkasının erken çıkışından ceza almaz.
    //  • Erken çıkışta da 15 dakikalık tolerans uygulanır (17:55'te çıkan
    //    kişiye 0,5 saat kesmek gerçekçi değil).
    // ======================================================================
    let fazlaCikis = 0, eksikCikis = 0;
    const kendiCikisDk = cikis?.timeStr ? cikisDkNormalize(cikis.timeStr, giris?.timeStr) : null;

    // YENİ KURAL: Çıkış 17:00-18:00 arasındaysa gün NORMAL tamamlanmıştır.
    // Ne fazla ne eksik mesai yazılır; hesap tamamen atlanır.
    // (Erken çıkış günü olan personellerde bu pencere uygulanmaz — onların
    //  programı zaten farklıdır, örn. 15:00 bitiş.)
    const normalCikis = !prog.erkenCikisGunu && normalCikisPenceresinde(kendiCikisDk);

    if (!normalCikis) {
      if (ekipCikisDk !== null) {
        // Ekip çıkışı da normal pencerenin içindeyse ekip fazla mesai üretmez.
        const ekipNormal = !prog.erkenCikisGunu && normalCikisPenceresinde(ekipCikisDk);
        if (!ekipNormal) {
          const ekipFark = ekipCikisDk - mesaiDk(prog.bitis);
          if (ekipFark > 0) fazlaCikis = asagiYarim(ekipFark); // Yalnızca FAZLA için ekip esas
        }
      }
      if (kendiCikisDk !== null) {
        // Normalize edilmiş çıkış kullanılır (geceyi aşan işler için).
        const kendiFark = mesaiDk(prog.bitis) - kendiCikisDk; // + ise erken çıkmış
        if (kendiFark > GEC_GELIS_TOLERANS_DK) eksikCikis = yukariYarim(kendiFark);
      }
    }

    // KURAL 4: NET = (fazla çıkış + erken başlangıç) - eksikler
    // DEĞİŞTİ: Erken başlangıç mesaisi de artık fazla tarafa eklenir.
    // ÖNEMLİ: Erken başlangıç, çıkış 17:00-18:00 "normal pencere"sinde olsa
    // bile geçerlidir; kişi sabah gerçekten 2-3 saat fazla çalışmıştır.
    const net = fazlaCikis + erkenFazla - (eksikGiris + eksikCikis);
    const detay = [];
    if (eksikGiris > 0) detay.push(`geç geliş ${eksikGiris} sa`);
    if (eksikCikis > 0) detay.push(`erken çıkış ${eksikCikis} sa`);
    if (fazlaCikis > 0) detay.push(`fazla çalışma ${fazlaCikis} sa`);
    // Erken başlangıç açıklamada ayrıca gösterilir ki yönetici nedenini görsün
    if (erkenFazla > 0) detay.push(`erken başlangıç ${String(erkenFazla).replace('.', ',')} sa (ekip ${giris.timeStr} yola çıktı)`);

    if (net >= 0.5) {
      sonuc[person.id] = { status: 'FM', hours: String(net).replace('.', ','), girisSaati: giris.timeStr, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati, aciklama: `Ekip çıkışı ${ekipCikisSaati} (program ${prog.bitis})${detay.length ? ' • ' + detay.join(', ') : ''} → net ${net} saat fazla mesai.`, kaynak: giris.method };
    } else if (net <= -0.5) {
      const eksik = Math.abs(net);
      sonuc[person.id] = { status: 'EM', hours: String(eksik).replace('.', ','), girisSaati: giris.timeStr, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati, aciklama: `Giriş ${giris.timeStr} (program ${prog.baslangic})${detay.length ? ' • ' + detay.join(', ') : ''} → net ${eksik} saat eksik mesai.`, kaynak: giris.method };
    } else {
      sonuc[person.id] = { status: 'G', hours: '', girisSaati: giris.timeStr, cikisSaati: cikis?.timeStr || null, ekipCikis: ekipCikisSaati, aciklama: `Giriş ${giris.timeStr}${ekipCikisSaati ? ` • ekip çıkışı ${ekipCikisSaati}` : ''} → program dahilinde, Geldi önerildi.`, kaynak: giris.method };
    }
  });

  return sonuc;
};

// O güne ait QR mesai kayıtlarını çeker (Mesai/Devamsızlık ekranı için)
export const gunlukQrKayitlariGetir = async (tarihStr) => {
  // OKUMA OPTİMİZASYONU: tek seferlik okuma için getDocs + gün filtresi + limit.
  // (Önceden onSnapshot ile dinleyici kurulup hemen kapatılıyordu.)
  try {
    const snap = await getDocs(query(
      mesaiKayitlarColRef(),
      where('dateStr', '==', tarihStr), // Yalnızca o gün
      limit(500)                        // Güvenlik sınırı
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Günlük QR kayıtları okunamadı:', e);
    return [];
  }
};

// ============================================================================
// İZİN KONTROLÜ
// İzinli/raporlu personel o gün QR veya elle kod ile mesai basamaz; ekranında
// durumu bildirilir. İzin bilgisi iki kaynaktan gelir:
//  1) PUANTAJ (Personel Muhasebe): Hİ / Yİ / Bİ / Üİ / R kodları
//  2) ÇALIŞMA PROGRAMI: personelin haftalık izin günü (ör. Mavi Yaka'da Çarşamba)
// ============================================================================
export const IZIN_KODLARI = ['Hİ', 'Yİ', 'Bİ', 'Üİ', 'R'];

// Bir personelin belirli bir gündeki izin durumunu döner
// { izinli: true/false, kod, etiket, kaynak }
export const izinDurumuGetir = async (person, tarihStr) => {
  const [y, a, g] = (tarihStr || '').split('-').map(Number);
  // 1) Puantajda izin/rapor kodu var mı?
  try {
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y}_${a}`));
    if (snap.exists()) {
      const hucre = (snap.data().records || {})[person?.id]?.[g];
      const kod = typeof hucre === 'object' && hucre !== null ? hucre.status : hucre;
      if (IZIN_KODLARI.includes(kod)) {
        return { izinli: true, kod, etiket: MESAI_STATUS_OPTIONS.find(o => o.code === kod)?.label || kod, kaynak: 'puantaj' };
      }
    }
  } catch (e) { /* Puantaj okunamazsa engelleme yapılmaz, personel mesai basabilir */ }

  // ==========================================================================
  // DEĞİŞİKLİK (kullanıcı kuralı):
  // Çalışma programındaki SABİT haftalık izin günü (ör. "Pazar") artık QR/kod
  // girişini ENGELLEMEZ. Sebep: şirkette her gün iş var ve personel haftanın
  // herhangi bir gününde izin yapabiliyor; Pazar günü çalışan personelin mesai
  // basamaması gerçek hayata uymuyordu.
  // Artık YALNIZCA İzin Tahtası / puantaj üzerinden izinli-raporlu işaretlenen
  // personel engellenir (yukarıdaki 1. adım).
  // NOT: Program bilgisi mesai HESABINDA (geç geliş/fazla mesai) kullanılmaya
  // devam ediyor; yalnızca giriş engeli kaldırıldı.
  // ==========================================================================
  return { izinli: false };
};

// ---------------------------------------------------------------------------
// ANA SAYFA BUTONLARI — "Hoş Geldiniz" kartının hemen altında görünür.
// Yeşil = Mesai Giriş Onayla, Kırmızı = Mesai Çıkış Onayla.
// Altında Bugün/Dün mesai özeti (geldi / gelmedi / izinli) gösterilir.
// MODÜL PASİF ise bu bileşen HİÇBİR ŞEY göstermez (null döner).
// ---------------------------------------------------------------------------
export const MesaiOnayButonlari = ({ currentUser }) => {
  const [modalTipi, setModalTipi] = useState(null);   // 'giris' | 'cikis' | null
  const [kayitlarim, setKayitlarim] = useState([]);   // Bugün + dün kendi QR kayıtları
  const [puantajDurum, setPuantajDurum] = useState({ bugun: null, dun: null }); // Puantajdaki durum kodu (izin/devamsız vb.)
  const [izinBilgisi, setIzinBilgisi] = useState(null); // Bugün izinli/raporlu mu?

  // Sadece BUGÜN + DÜNE ait kendi kayıtlarını dinle (veri tasarrufu için filtreli sorgu)
  useEffect(() => {
    if (!currentUser?.id) return;
    // Kapsam: yalnızca KENDİ kayıtları + yalnızca bugün/dün + limit.
    // (En fazla 4 doküman: 2 gün x giriş/çıkış)
    const q = query(
      mesaiKayitlarColRef(),
      where('personnelId', '==', String(currentUser.id)),
      where('dateStr', 'in', [mesaiBugunStr(), mesaiDunStr()]),
      limit(10)
    );
    const unsub = onSnapshot(q, snap => setKayitlarim(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setKayitlarim([]));
    return () => unsub(); // Cleanup: bileşen kapanınca dinleyici durur
  }, [currentUser?.id]);

  // Puantaj tahtasındaki mesai durumunu (İzinli / Raporlu / Devamsız...) oku.
  // Uygulamanın mevcut 'mesai' (puantaj) koleksiyonundan SADECE OKUMA yapılır.
  useEffect(() => {
    if (!currentUser?.id) return;
    let iptal = false; // Bileşen kapanırsa state güncellemesi yapılmaz (memory leak önlemi)
    (async () => {
      // ====================================================================
      // OKUMA OPTİMİZASYONU:
      // ESKİ HALİ: puantaj ay belgesi 3 KEZ okunuyordu (bugün, dün ve ayrıca
      // izin kontrolü için). Aynı belge tekrar tekrar indiriliyordu.
      // YENİ HALİ: gerekli ay belgesi (genelde 1, ay başıysa 2) BİR KEZ okunur
      // ve hem durum hem izin bilgisi bu tek okumadan türetilir.
      // ====================================================================
      const bugunT = mesaiBugunStr(), dunT = mesaiDunStr();
      const ayAnahtari = (t) => { const [y, a] = t.split('-').map(Number); return `${y}_${a}`; };
      const gerekenAylar = [...new Set([ayAnahtari(bugunT), ayAnahtari(dunT)])]; // Genelde tek ay
      const aylikVeri = {};
      for (const anahtar of gerekenAylar) {
        try {
          const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mesai', anahtar));
          aylikVeri[anahtar] = snap.exists() ? (snap.data().records || {}) : {};
        } catch (e) { aylikVeri[anahtar] = {}; }
      }
      if (iptal) return;

      // Tek okumadan durum kodunu çöz
      const kodAl = (tarih) => {
        const [, , g] = tarih.split('-').map(Number);
        const hucre = aylikVeri[ayAnahtari(tarih)]?.[currentUser.id]?.[g];
        if (!hucre) return null;
        return typeof hucre === 'object' ? hucre.status : hucre; // G, D, Yİ, R...
      };
      const bugunKod = kodAl(bugunT);
      setPuantajDurum({ bugun: bugunKod, dun: kodAl(dunT) });

      // İZİN KONTROLÜ: aynı veriden hesaplanır, EK OKUMA YAPILMAZ.
      // YALNIZCA İzin Tahtası/puantaj kaynaklı izinler mesai girişini engeller.
      // Çalışma programındaki sabit haftalık izin günü (ör. Pazar) ARTIK
      // engellemez — şirkette her gün iş var ve personel istediği gün izin
      // yapabiliyor. Program bilgisi yalnızca mesai HESABINDA kullanılır.
      if (IZIN_KODLARI.includes(bugunKod)) {
        setIzinBilgisi({ izinli: true, kod: bugunKod, etiket: MESAI_STATUS_OPTIONS.find(o => o.code === bugunKod)?.label || bugunKod, kaynak: 'puantaj' });
      } else {
        setIzinBilgisi({ izinli: false });
      }
    })();
    return () => { iptal = true; }; // Cleanup
  }, [currentUser?.id]);

  // ==========================================================================
  // DEĞİŞTİ: ARTIK BEYAZ YAKA DA QR/MANUEL MESAİ GİRİŞİ YAPABİLİR.
  // ESKİ HALİ: mesaiYakaTipi(currentUser) !== 'Mavi Yaka' ise null dönüyordu,
  //   yani beyaz yaka personel anasayfada hiç buton görmüyordu.
  // YENİ HALİ: yaka ayrımı KALDIRILDI; giriş/çıkış akışı iki yakada da
  //   birebir aynı çalışır (aynı QR, aynı konum + kamera doğrulaması).
  //   Fark yalnızca DURUM ÖNERİSİNDE: beyaz yakada sistem fazla/eksik mesai
  //   hesaplamaz (bkz. beyazYakaOnerileriHesapla).
  // TEK İSTİSNA: UZAKTAN çalışanlar. Onlar ofise gelmediği için QR butonları
  //   kendilerine hiç gösterilmez (kullanıcı kuralı).
  // ==========================================================================
  if (!mesaiTakibeDahil(currentUser)) return null;

  const bugunku = kayitlarim.filter(k => k.dateStr === mesaiBugunStr());
  // Bugünün giriş ve çıkış kayıtları — butonların açık/kapalı olmasını belirler
  const giris = bugunku.find(k => k.type === 'giris') || null;
  const cikis = bugunku.find(k => k.type === 'cikis') || null;

  // ==========================================================================
  // SAAT KURALLARI
  //  • GİRİŞ: DEĞİŞTİ (kullanıcı kuralı) — artık her gün 05:00'dan itibaren
  //    basılabilir. Sebep: bazı ekipler 07:00'dan önce yola çıktığı için QR
  //    okutamıyordu. Erken basan personelin saatleri, ekip şartı sağlanırsa
  //    öneri motorunda ERKEN BAŞLANGIÇ MESAİSİ olarak eklenir
  //    (bkz. ekipErkenBaslangicVarMi / erkenBaslangicSaati).
  //  • ÇIKIŞ: iş gece yarısını aşabildiği için, DÜN giriş yapıp çıkış
  //    yapmamış personel ertesi gün 07:00'a kadar çıkışını basabilir.
  //    Bu durumda kayıt DÜNÜN tarihine yazılır, bugüne değil. (DEĞİŞMEDİ —
  //    gece eşiği 07:00 olarak korunur, yalnızca giriş saati öne alındı.)
  // ==========================================================================
  const suAnDk = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const GUN_BASLANGIC_DK = 7 * 60; // 07:00 — yalnızca "dünün çıkışı" eşiği için kullanılır

  const dunkuKayitlar = kayitlarim.filter(k => k.dateStr === mesaiDunStr());
  const dunGiris = dunkuKayitlar.find(k => k.type === 'giris') || null;
  const dunCikis = dunkuKayitlar.find(k => k.type === 'cikis') || null;
  // Dün girmiş, çıkmamış ve saat henüz 07:00 olmamışsa "dünün çıkışı" bekleniyor
  const bekleyenDunCikisi = !!dunGiris && !dunCikis && suAnDk < GUN_BASLANGIC_DK;

  const girisAcik = suAnDk >= QR_GIRIS_ACILIS_DK; // 05:00 öncesi giriş yapılamaz
  // NOT: "BUGÜN / DÜN ÖZETİ" kartları kullanıcı isteğiyle kaldırıldığı için
  // dunku / gunDurumu / bugunOzet / dunOzet hesapları temizlendi.

  return (
    <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-neutral-200 animate-in fade-in slide-in-from-top-2">
      {/* ======================================================================
          BAŞLIK: Üstteki "Bugün: Giriş .. • Çıkış .." rozeti KALDIRILDI.
          Aynı bilgi artık butonların yerinde, çok daha görünür şekilde duruyor.
          ====================================================================== */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5"><QrCode className="w-4 h-4 text-black" /> QR Mesai Onayı • Konum + Kamera</p>
      </div>
      {/* İZİNLİ/RAPORLU İSE: butonlar gösterilmez, durum bildirilir */}
      {izinBilgisi?.izinli ? (
        <div className="p-4 rounded-2xl border-2 border-purple-300 bg-purple-50 flex items-center gap-3 animate-in fade-in">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-purple-900">Bugün {izinBilgisi.etiket.toLocaleUpperCase('tr-TR')}</p>
            {/* Artık yalnızca İzin Tahtası/puantaj kaynaklı izinler engelleme yapar */}
            <p className="text-[11px] font-bold text-purple-700">
              İzin Tahtası'nda bugün için izinli/raporlu olarak işaretlendiniz. Mesai kaydı gerekmez.
            </p>
            <p className="text-[10px] font-bold text-purple-500 mt-1">Bir hata olduğunu düşünüyorsanız yöneticinizle görüşün.</p>
          </div>
        </div>
      ) : (
      /* ======================================================================
         GÜNDE TEK KEZ: Giriş basıldıysa yeşil buton kapanır ve yerini
         "Giriş 07:33 • Mesaiye Başladın" kartı alır. Çıkış için de aynısı.
         Böylece personel ikinci kez basmayı deneyemez, ne yaptığını da görür.
         ====================================================================== */
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* --- GİRİŞ --- */}
        {giris ? (
          <div className="py-4 px-4 rounded-2xl border-2 border-green-300 bg-green-50 flex items-center gap-3 animate-in fade-in">
            <span className="w-11 h-11 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-green-700/70">Mesai Girişi Onaylandı</p>
              <p className="text-lg font-black text-green-800 leading-tight">Giriş {giris.timeStr}</p>
              <p className="text-[11px] font-bold text-green-700">Mesaiye başladın 💪</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setModalTipi('giris')}
            disabled={!girisAcik}
            title={!girisAcik ? 'Mesai girişi her gün 05:00’dan itibaren yapılabilir' : ''}
            className={`py-4 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition ${girisAcik
              ? 'text-white bg-gradient-to-r from-green-500 via-green-600 to-emerald-700 shadow-lg shadow-green-600/40 hover:scale-[1.02] active:scale-95'
              : 'text-neutral-400 bg-neutral-100 border-2 border-dashed border-neutral-300 cursor-not-allowed'}`}
          >
            <span className={`w-9 h-9 rounded-full flex items-center justify-center ${girisAcik ? 'bg-white/20' : 'bg-neutral-200'}`}><LogIn className="w-5 h-5" /></span>
            {girisAcik ? 'MESAİ GİRİŞ ONAYLA' : 'GİRİŞ 05:00’DA AÇILIR'}
            <QrCode className="w-5 h-5 opacity-80" />
          </button>
        )}

        {/* --- ÇIKIŞ --- */}
        {cikis ? (
          <div className="py-4 px-4 rounded-2xl border-2 border-red-300 bg-red-50 flex items-center gap-3 animate-in fade-in">
            <span className="w-11 h-11 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle className="w-6 h-6 text-red-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-red-700/70">Mesai Çıkışı Onaylandı</p>
              <p className="text-lg font-black text-red-800 leading-tight">Çıkış {cikis.timeStr}</p>
              <p className="text-[11px] font-bold text-red-700">İşten ayrıldın, iyi dinlenmeler 👋</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setModalTipi('cikis')}
            disabled={!giris && !bekleyenDunCikisi}
            title={!giris && !bekleyenDunCikisi ? 'Önce mesai girişini onaylamalısın' : (bekleyenDunCikisi ? 'Dün gece biten işin çıkışını basıyorsunuz' : '')}
            className={`py-4 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition ${(giris || bekleyenDunCikisi)
              ? 'text-white bg-gradient-to-r from-red-500 via-red-600 to-rose-700 shadow-lg shadow-red-600/40 hover:scale-[1.02] active:scale-95'
              : 'text-neutral-400 bg-neutral-100 border-2 border-dashed border-neutral-300 cursor-not-allowed'}`}
          >
            <span className={`w-9 h-9 rounded-full flex items-center justify-center ${(giris || bekleyenDunCikisi) ? 'bg-white/20' : 'bg-neutral-200'}`}><LogOut className="w-5 h-5" /></span>
            {bekleyenDunCikisi ? 'DÜNÜN ÇIKIŞINI ONAYLA' : 'MESAİ ÇIKIŞ ONAYLA'}
            <QrCode className="w-5 h-5 opacity-80" />
          </button>
        )}
      </div>
      )}
      {/* NOT: "DÜN ÖZETİ" bölümü kullanıcı isteğiyle KALDIRILDI.
          Bugünün durumu zaten yukarıdaki kartlarda görünüyor. */}
      {/* Butona basılınca önce "QR Tarat / Kod Gir" seçim penceresi açılır */}
      {/* Gece yarısını aşan işlerde çıkış DÜNÜN tarihine yazılır */}
      {modalTipi && (
        <QrTarayiciModal
          tip={modalTipi}
          currentUser={currentUser}
          hedefTarih={(modalTipi === 'cikis' && bekleyenDunCikisi) ? mesaiDunStr() : mesaiBugunStr()}
          onKapat={() => setModalTipi(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// QR KODU PDF OLARAK İNDİR
// Uygulamadaki mevcut PDF desenine (generateContractPDF) uygun: yazdırma
// penceresi açılır, sayfa başlığı dosya adı olur, "PDF olarak kaydet" ile
// orijinal PDF formatında indirilir. iOS/Android/masaüstünde çalışır.
// ---------------------------------------------------------------------------
const qrPdfIndir = (qr) => {
  // DÜZELTME: QR görseli artık CDN'den değil, dahili motordan SVG olarak üretilir.
  // SVG vektörel olduğu için A4 baskıda kenarları tamamen keskin çıkar.
  const qrSvg = qrSvgUret(qr.manuelKod);
  if (!qrSvg) { alert('QR kod üretilemedi. Lütfen kodu yenileyip tekrar deneyin.'); return; }
  const w = window.open('', '_blank');
  if (!w) { alert('Açılır pencere engellendi. Lütfen tarayıcıda açılır pencerelere izin verin.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Sembol-Mesai-${qr.ad.replace(/\s+/g, '-')}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:40px;text-align:center;color:#111}
      .kart{border:4px solid #111;border-radius:24px;padding:36px;max-width:520px;margin:0 auto}
      h1{font-size:26px;letter-spacing:2px;margin:0}.alt{color:#b91c1c;font-weight:800;letter-spacing:4px;font-size:13px;margin:6px 0 24px}
      .qr{width:360px;height:360px;margin:0 auto}
      .seri{margin-top:20px;font-size:26px;font-weight:900;letter-spacing:6px;border:3px dashed #111;border-radius:14px;padding:14px}
      .not{margin-top:16px;font-size:12px;color:#555;line-height:1.6}
      @media print{body{padding:0}}
    </style></head><body>
    <div class="kart">
      <h1>SEMBOL NAKLİYAT</h1>
      <div class="alt">MESAİ TAKİP • ${qr.ad.toLocaleUpperCase('tr-TR')}</div>
      <div class="qr">${qrSvg}</div>
      <div class="seri">${qr.manuelKod}</div>
      <p class="not">Mesai giriş/çıkışınızı onaylamak için uygulamadaki yeşil/kırmızı butona basıp bu QR kodu kameraya okutun.<br/>Kameranız çalışmıyorsa yukarıdaki seri kodu elle girebilirsiniz.</p>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
    </body></html>`);
  w.document.close();
};

// QR matrisini <svg> koduna çevirir. SVG kullanıldığı için kod her ekran
// boyutunda ve baskıda net görünür, ayrıca hiçbir dış kaynak gerektirmez.
const qrSvgUret = (deger, kenarModul = 2) => {
  const q = qrKareKodMatris(deger);
  if (!q) return null;
  const tam = q.boyut + kenarModul * 2; // Sessiz alan (quiet zone) eklenir
  let kareler = '';
  for (let y = 0; y < q.boyut; y++) {
    for (let x = 0; x < q.boyut; x++) {
      if (q.matris[y][x]) kareler += `<rect x="${x + kenarModul}" y="${y + kenarModul}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}" shape-rendering="crispEdges" width="100%" height="100%"><rect width="${tam}" height="${tam}" fill="#ffffff"/><g fill="#000000">${kareler}</g></svg>`;
};

// Küçük yardımcı: seri kodun QR görselini ekranda gösterir.
// DÜZELTME: Artık CDN beklenmediği için yükleme çemberinde takılı kalmaz.
const QrGorsel = ({ deger, boyut = 140 }) => {
  const svg = useMemo(() => qrSvgUret(deger), [deger]);
  if (!svg) return (
    <div style={{ width: boyut, height: boyut }} className="bg-red-50 border border-red-200 rounded-lg flex items-center justify-center text-center p-2">
      <span className="text-[10px] font-black text-red-600">QR üretilemedi</span>
    </div>
  );
  return <div style={{ width: boyut, height: boyut }} className="rounded-lg overflow-hidden bg-white" dangerouslySetInnerHTML={{ __html: svg }} />;
};

// ---------------------------------------------------------------------------
// İK > MESAİ TAKİP SAYFASI (3 sekme)
// 1) Tüm Kayıtlar  2) QR Yönetimi  3) Raporlama
// Her sekmede Mavi Yaka / Beyaz Yaka ayrımı vardır.
// MODÜL PASİF ise sayfa içeriği gizlenir, sadece bilgi ekranı gösterilir.
// ---------------------------------------------------------------------------
export const MesaiTakipView = ({ personnelList = [], currentUser, jobs = [], onViewProfile }) => {
  const { ayarlar, aktifQr, aktifQrlar, aktifIdler } = useMesaiQrAyarlari();
  const [sekme, setSekme] = useState('kayitlar'); // "Bugünkü Durum" kaldırıldı, varsayılan Tüm Kayıtlar
  // OKUMA OPTİMİZASYONU: kayıtlar artık kapsamı daraltılmış iki ayrı state'te tutulur
  const [gunlukKayitlar, setGunlukKayitlar] = useState([]); // Seçili günün kayıtları
  const [aylikKayitlar, setAylikKayitlar] = useState([]);   // Rapor ayının kayıtları (yalnızca sekme açıkken)
  const [haritaKaydi, setHaritaKaydi] = useState(null);
  // Pano filtresi: null | 'devamsiz' | 'izinli' — grup adına göre bağımsız tutulur

  // Bugüne ait puantaj kayıtları (izin/rapor kodlarını tespit etmek için)
  // YENİ: Puantaj (Personel Muhasebe) kayıtları — "Mesai Durumu" sütunu için.
  // Anahtar: 'YYYY_A' (ör. '2026_8'), değer: { [personelId]: { [gun]: {status,hours,manual} } }
  const [puantajlar, setPuantajlar] = useState({});
  // Düzenleme modalı: hangi kayıt düzenleniyor + seçilen durum/saat
  const [durumDuzenle, setDurumDuzenle] = useState(null);
  // YENİ: Giriş/Çıkış SAATİ düzenleme penceresi. Her kayıt yalnızca BİR KEZ
  // düzenlenebilir; düzenlendikten sonra "Düzenlendi" yazar ve kilitlenir.
  const [saatDuzenle, setSaatDuzenle] = useState(null);

  // Filtreler (Tüm Kayıtlar sekmesi)
  // TEK TARİH SEÇİMİ: sayfa her açıldığında BUGÜN gelir, oklarla gün değiştirilir
  const [fTarih, setFTarih] = useState(mesaiBugunStr());
  const [fYaka, setFYaka] = useState('hepsi');
  // DEĞİŞİKLİK: "Tüm Personel" filtresi kaldırıldı, yerine MESAİ DURUMU filtresi geldi
  const [fDurum, setFDurum] = useState('hepsi');
  // DEĞİŞİKLİK: "Tüm Yöntemler" filtresi kaldırıldı, yerine PERSONEL SEÇ filtresi geldi
  const [fPersonel, setFPersonel] = useState('hepsi');
  // YENİ: Araç/Ekip filtresi — seçilen araçla sahaya çıkan personeller listelenir
  const [fArac, setFArac] = useState('hepsi');
  const [raporAy, setRaporAy] = useState(mesaiBugunStr().slice(0, 7)); // YYYY-AA
  // ==========================================================================
  // YENİ (kullanıcı talebi): RAPORLAMA SIRALAMA + YAKA AYRIMI
  // --------------------------------------------------------------------------
  // raporSirala: hangi sütuna göre sıralanacak ('saat' = toplam saat,
  //   'gun' = mesai günü, 'ad' = isim). Varsayılan 'saat' azalan — kullanıcı
  //   "en çok mesai yapan sırayla görünsün" dedi.
  // raporYon: 'desc' (çoktan aza) / 'asc' (azdan çoğa). Başlığa tekrar
  //   tıklanınca yön değişir.
  // raporYaka: rapor tablosunu yakaya göre ayırır ('ayrik' = Beyaz/Mavi ayrı
  //   bloklar, 'hepsi' = tek liste, 'beyaz'/'mavi' = yalnız o yaka).
  // ==========================================================================
  const [raporSirala, setRaporSirala] = useState('saat');
  const [raporYon, setRaporYon] = useState('desc');
  const [raporYaka, setRaporYaka] = useState('ayrik');

  // ============================================================================
  // FIRESTORE OKUMA OPTİMİZASYONU (ÖNEMLİ)
  // ESKİ HALİ: onSnapshot(mesaiKayitlarColRef()) -> TÜM koleksiyon limitsiz
  // dinleniyordu. Sayfa her açıldığında geçmişteki BÜTÜN mesai kayıtları
  // (aylar/yıllar birikimi) yeniden okunuyordu; okuma faturasının ana kaynağı buydu.
  //
  // YENİ HALİ: iki AYRI ve KAPSAMI DARALTILMIŞ dinleyici:
  //  1) Seçili GÜNÜN kayıtları  -> where('dateStr','==',fTarih) + limit
  //     (Tüm Kayıtlar sekmesi tek gün gösterdiği için yeterli)
  //  2) Rapor AYININ kayıtları  -> tarih aralığı + limit, YALNIZCA Raporlama
  //     sekmesi açıkken bağlanır. Sekme kapalıyken hiç okuma yapılmaz.
  // Her iki dinleyicinin de cleanup'ı vardır ve bağımlılıkları sabittir
  // (state güncellemesi dinleyiciyi yeniden kurmaz -> sonsuz döngü yok).
  // ============================================================================

  // 1) SEÇİLİ GÜNÜN KAYITLARI (Tüm Kayıtlar sekmesi için)
  useEffect(() => {
    if (!fTarih) return;
    const q = query(
      mesaiKayitlarColRef(),
      where('dateStr', '==', fTarih), // Yalnızca o güne ait kayıtlar
      limit(500)                      // Güvenlik sınırı: bir günde bundan fazla kayıt beklenmez
    );
    const unsub = onSnapshot(q, snap => setGunlukKayitlar(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setGunlukKayitlar([]));
    return () => unsub(); // Tarih değişince veya sayfadan çıkınca dinleyici kapanır
  }, [fTarih]);

  // ==========================================================================
  // 1b) YENİ: SEÇİLİ GÜNÜN HAFTASINA AİT KAYITLAR (haftalık kural motoru için)
  // ==========================================================================
  // Haftalık kural (ilk gelmeme → Hİ, ikinci → D, 7 gün → Pazar FG) o haftanın
  // TAMAMINI bilmeyi gerektirir. Tek günlük dinleyici bunun için yetmez.
  // Pazartesi–Pazar aralığı tek sorguda çekilir (7 gün × personel sayısı).
  // ==========================================================================
  const [haftaKayitlari, setHaftaKayitlari] = useState([]);
  useEffect(() => {
    if (!fTarih) { setHaftaKayitlari([]); return; }
    const gunler = haftaGunleriListesi(fTarih);
    const q = query(
      mesaiKayitlarColRef(),
      where('dateStr', '>=', gunler[0]), // Haftanın Pazartesi'si
      where('dateStr', '<=', gunler[6]), // Haftanın Pazar'ı
      limit(1500)                        // 7 gün × ~100 personel × 2 kayıt payı
    );
    const unsub = onSnapshot(q, snap => setHaftaKayitlari(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setHaftaKayitlari([]));
    return () => unsub();
  }, [fTarih]);

  // 2) RAPOR AYININ KAYITLARI (yalnızca Raporlama sekmesi açıkken)
  useEffect(() => {
    if (sekme !== 'rapor' || !raporAy) { setAylikKayitlar([]); return; }
    const q = query(
      mesaiKayitlarColRef(),
      where('dateStr', '>=', `${raporAy}-01`), // Ayın başı
      where('dateStr', '<=', `${raporAy}-31`), // Ayın sonu (metin karşılaştırması yeterli)
      limit(3000)                              // 30 gün x ~50 personel x 2 kayıt payı
    );
    const unsub = onSnapshot(q, snap => setAylikKayitlar(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setAylikKayitlar([]));
    return () => unsub();
  }, [sekme, raporAy]);

  // ==========================================================================
  // AKTİF PERSONEL LİSTESİ — DEĞİŞTİ
  // ESKİ HALİ: sadece 'Pasif' olanlar çıkarılıyordu.
  // YENİ HALİ: mesaiTakibeDahil() üzerinden UZAKTAN çalışanlar da çıkarılır.
  // Sebep (kullanıcı kuralı): "Sadece beyaz yakada örgün çalışanların takibi
  // olsun, uzaktan olanların olmasın." Böylece uzaktan personel ne tabloda
  // ne "Personel Seç" açılır listesinde ne de sayaç rozetlerinde görünür.
  // ==========================================================================
  const aktifPersonel = useMemo(() => personnelList.filter(p => mesaiTakibeDahil(p)), [personnelList]);
  const maviYaka = aktifPersonel.filter(p => mesaiYakaTipi(p) === 'Mavi Yaka');
  const beyazYaka = aktifPersonel.filter(p => mesaiYakaTipi(p) === 'Beyaz Yaka');
  // YENİ: Tablo artık iki yakayı birlikte gösteriyor — mavi önce, beyaz sonra.
  const takiptekiPersonel = useMemo(() => [...maviYaka, ...beyazYaka], [maviYaka, beyazYaka]);

  const bugun = mesaiBugunStr();

  // Filtrelenmiş kayıtlar (Tüm Kayıtlar sekmesi) — en yeni üstte, ilk 300 kayıt
  const filtreli = useMemo(() => gunlukKayitlar
    // ========================================================================
    // DEĞİŞTİ: "Şu an yalnızca Mavi Yaka aktif" kısıtı KALDIRILDI.
    // ESKİ HALİ: .filter(k => k.collarType === 'Mavi Yaka')
    // YENİ HALİ: iki yaka da gelir; yalnızca UZAKTAN çalışanların kayıtları
    // ayıklanır. (Eski kayıtlarda personel uzaktana çevrilmiş olabilir; o
    // yüzden filtre kaydın collarType'ına değil, güncel personel kartına bakar.)
    // ========================================================================
    .filter(k => {
      const kisi = personnelList.find(pp => String(pp.id) === String(k.personnelId));
      return kisi ? !isUzaktanCalisan(kisi) : true; // Personeli bulunamayan eski kayıt gizlenmez
    })
    .filter(k => fYaka === 'hepsi' || k.collarType === fYaka)
    // NOT: Mesai durumu filtresi burada uygulanmaz; durum bilgisi puantaj ve
    // öneri hesabından geldiği için tablo çizilirken (aşağıda) uygulanır.

    .filter(k => fPersonel === 'hepsi' || String(k.personnelId) === String(fPersonel))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    // personnelList eklendi: uzaktan çalışan filtresi bu listeye bakıyor
    .slice(0, 300), [gunlukKayitlar, fYaka, fPersonel, personnelList]); // fTarih zaten sorguda filtreli

  // YENİ: Görünen kayıtların ait olduğu AYLARIN puantaj belgelerini yükler.
  // "Mesai Durumu" sütunu, muhasebedeki (Personel Muhasebe) günlük durumu gösterir.
  // OKUMA OPTİMİZASYONU:
  // ESKİ HALİ: bağımlılık dizisi `filtreli` üzerinden türetilmiş bir metne
  // bağlıydı; kayıtlar her değiştiğinde dinleyiciler kapatılıp yeniden kuruluyor,
  // her kurulumda puantaj belgesi baştan okunuyordu (gereksiz okuma + titreme).
  // YENİ HALİ: tablo tek gün gösterdiği için SADECE o günün ayına ait TEK belge
  // dinlenir ve bağımlılık yalnızca ayın kendisidir (fTarih değişse bile ay
  // aynıysa dinleyici yeniden kurulmaz).
  const raporAyAnahtari = useMemo(() => {
    const [y, a] = String(fTarih || '').split('-');
    return (y && a) ? `${Number(y)}_${Number(a)}` : null;
  }, [fTarih]);

  useEffect(() => {
    if (!raporAyAnahtari) return;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', raporAyAnahtari);
    const unsub = onSnapshot(ref, snap => {
      setPuantajlar(prev => ({ ...prev, [raporAyAnahtari]: snap.exists() ? (snap.data().records || {}) : {} }));
    }, () => {});
    return () => unsub(); // Ay değişince veya sayfadan çıkınca kapanır
  }, [raporAyAnahtari]);

  // ==========================================================================
  // YENİ: HAFTA ÖNCEKİ AYA TAŞIYORSA O AYIN PUANTAJI DA YÜKLENİR
  // ==========================================================================
  // Haftalık kural motoru (ilk gelmeme → Hİ, ikinci → D, 7/7 → Pazar FG)
  // haftanın Pazartesi'sinden itibaren puantaj kodlarına bakar. Ay başındaki
  // günlerde haftanın başı ÖNCEKİ AYDA kalır (örn. 02.09 Çarşamba'nın haftası
  // 31.08 Pazartesi'de başlar). Yukarıdaki dinleyici yalnızca seçili günün
  // ayını yüklediği için önceki ayın kodları görünmez ve kural yanlış karar
  // verirdi. Bu etki, hafta başının ayı farklıysa O TEK belgeyi de dinler;
  // aynı aydaysa hiçbir ek okuma yapmaz.
  // ==========================================================================
  const haftaBasiAyAnahtari = useMemo(() => {
    if (!fTarih) return null;
    const [y, a] = haftaninPazartesisi(fTarih).split('-');
    const anahtar = `${Number(y)}_${Number(a)}`;
    return anahtar !== raporAyAnahtari ? anahtar : null; // Aynı aysa ek yükleme yok
  }, [fTarih, raporAyAnahtari]);

  useEffect(() => {
    if (!haftaBasiAyAnahtari) return;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', haftaBasiAyAnahtari);
    const unsub = onSnapshot(ref, snap => {
      setPuantajlar(prev => ({ ...prev, [haftaBasiAyAnahtari]: snap.exists() ? (snap.data().records || {}) : {} }));
    }, () => {});
    return () => unsub();
  }, [haftaBasiAyAnahtari]);

  // YENİ: Görünen her tarih için QR'a dayalı ÖNERİLERİ hesaplar.
  // Böylece muhasebeye henüz yazılmamış günlerde de "önerilen durum" görünür.
  const gunlukOneriler = useMemo(() => {
    // DEĞİŞTİ: Seçili tarih (fTarih) her zaman listeye katılır.
    // Sebep: O gün HİÇ kimse QR okutmamışsa eski kodda tarihler dizisi boş
    // kalıyor ve "Devamsızlık" önerisi hiç üretilmiyordu. Artık seçili gün
    // için her koşulda öneri hesaplanır.
    const tarihler = [...new Set([...filtreli.map(k => k.dateStr), fTarih].filter(Boolean))];
    const sonuc = {};
    tarihler.forEach(tarih => {
      // ======================================================================
      // YENİ TARİH SINIRI: 20.08.2026 ÖNCESİNE HİÇ ÖNERİ ÜRETİLMEZ
      // ======================================================================
      // Kullanıcı kuralı: "20 Ağustos 2026 öncesinde QR/manuel takip yoktu;
      // o dönemde Personel Muhasebe'ye girilenler geçerli sayılsın, karışık
      // olmasın." Bu yüzden eski günlerde günlük motorlar (D/Hİ önerisi) de
      // çalıştırılmaz; tablo yalnızca muhasebedeki kayıtlı kodu gösterir.
      // ======================================================================
      if (tarih < MESAI_KURAL_BASLANGIC) return;
      // ======================================================================
      // DEĞİŞTİ: İKİ YAKA İÇİN AYRI ÖNERİ MOTORU
      // ESKİ HALİ: yalnızca Mavi Yaka kayıtları alınıp mesaiOnerileriHesapla
      //   çalıştırılıyordu; beyaz yakada "Girilmemiş" görünüyordu.
      // YENİ HALİ:
      //   • MAVİ YAKA  -> mesaiOnerileriHesapla (ekip bazlı çıkış, fazla/eksik
      //     mesai, geç geliş toleransı — hiçbir şey değişmedi)
      //   • BEYAZ YAKA -> beyazYakaOnerileriHesapla (yalnızca Geldi /
      //     Haftalık İzin / Devamsızlık; saat hesabı YOK)
      // İki sonuç aynı tarih anahtarı altında birleştirilir.
      // ======================================================================
      const oGunkuTumKayitlar = gunlukKayitlar.filter(k => k.dateStr === tarih);
      const kisiCoz = (kayitlar) => [...new Set(kayitlar.map(k => String(k.personnelId)))]
        .map(id => personnelList.find(p => String(p.id) === id))
        .filter(p => p && mesaiTakibeDahil(p)); // Uzaktan çalışanlar öneri hesabına girmez

      // --- MAVİ YAKA (mevcut motor, dokunulmadı) ---
      const maviKayitlar = oGunkuTumKayitlar.filter(k => k.collarType === 'Mavi Yaka');
      const maviEkip = kisiCoz(maviKayitlar).filter(p => mesaiYakaTipi(p) === 'Mavi Yaka');
      let maviSonuc = {};
      if (maviEkip.length > 0) {
        // ====================================================================
        // DÜZELTME (KRİTİK): ÖNERİ ARTIK GERÇEKTEN EKİP BAZLI
        // ====================================================================
        // SORUNUN KÖKÜ: mesaiOnerileriHesapla, "ekipte EN ERKEN çıkan" saati
        // esas alıyor. Ancak fonksiyon o günün TÜM mavi yakasına TEK SEFERDE
        // çağrılıyordu; yani "ekip" aslında "o gün çalışan herkes" oluyordu.
        // Sonuç: 34 NAR 456 ekibinden biri 19:00'da çıkınca, 21:00'e kadar
        // çalışan 34 KUD 891 ekibinin fazla mesaisi de 19:00'a göre hesaplanıp
        // haksız yere düşüyordu.
        //
        // YENİ HALİ: Personel önce O GÜN ÇIKTIĞI ARACA (plaka) göre gruplanır
        // ve motor HER EKİP İÇİN AYRI çalıştırılır. Böylece "en erken çıkış"
        // yalnızca kişinin KENDİ ekibinden alınır. Araca atanmamış personel
        // ayrı bir grup olarak değerlendirilir.
        //
        // NOT: Buradaki ekip çözümü, aşağıdaki personelAraci() ile aynı işi
        // yapar ama onu ÇAĞIRMAZ — o fonksiyon bu satırlardan SONRA tanımlı
        // olduğu için render sırasında henüz erişilebilir değildir.
        // ====================================================================
        // ====================================================================
        // YENİ (kullanıcı talebi): PUANTAJ DA DESTEK ZİNCİRİNİ BİLİYOR
        // --------------------------------------------------------------------
        // ESKİ HALİ: Gruplama yalnızca assignedPersonnelIds'e bakıyordu. Bir
        // personel gün içinde başka ekibe DESTEK'e gönderilse bile puantaj onu
        // hâlâ İLK ekibinin plakasında sayıyordu. Sonuç: İş Onaylama Tahtası
        // ile Puantaj Takip aynı kişi için FARKLI fazla mesai gösterebiliyordu.
        //
        // YENİ HALİ: Kişinin plakası, personelSonEkipIsi ile bulunan EN SON
        // dahil olduğu ekibin aracından alınır (2., 3., 4. ekip zinciri dahil).
        // Böylece iki ekran birebir aynı sonucu üretir: destek veren kişi son
        // ekibinin çıkışıyla, ekipte kalanlar kendi çıkışlarıyla hesaplanır.
        // ====================================================================
        const ekipGruplari = new Map(); // plaka -> personel[]
        const aracsizlar = [];
        maviEkip.forEach(p => {
          // Destek zinciri dikkate alınarak kişinin O GÜNKÜ SON ekibi
          const sonIs = personelSonEkipIsi(p.id, tarih, jobs || []);
          const plaka = sonIs?.assignedVehiclePlate || null;
          if (plaka) {
            if (!ekipGruplari.has(plaka)) ekipGruplari.set(plaka, []);
            ekipGruplari.get(plaka).push(p);
          } else {
            aracsizlar.push(p); // Araca atanmamış: kendi aralarında değerlendirilir
          }
        });

        try {
          // YENİ: O gün en az bir işe atanmış personel id kümesi. Motor bunu
          // kullanarak "hiç basmamış ama iş atanmış" kişiyi Devamsız yerine
          // şehir dışı seferi (Fazla Gün) olarak değerlendirir.
          const oGunAtananlar = new Set();
          (jobs || []).forEach(is => {
            if (is.date !== tarih) return;
            // DEĞİŞTİ: isTamEkipIdleri = asıl ekip + desteğe gelenler.
            // Desteğe gönderilen kişi de o gün göreve atanmış sayılır; aksi
            // halde QR basmadıysa haksız yere "Devamsız" işaretlenebilirdi.
            isTamEkipIdleri(is).forEach(id => oGunAtananlar.add(id));
          });
          ekipGruplari.forEach(grup => {
            Object.assign(maviSonuc, mesaiOnerileriHesapla(grup, maviKayitlar, tarih, oGunAtananlar) || {});
          });
          if (aracsizlar.length > 0) {
            Object.assign(maviSonuc, mesaiOnerileriHesapla(aracsizlar, maviKayitlar, tarih, oGunAtananlar) || {});
          }
        } catch (e) { /* sessiz geç */ }
      }

      // ======================================================================
      // YENİ (kullanıcı talebi): QR OKUTMAYAN / KOD GİRMEYEN MAVİ YAKA
      // PERSONELİ DE BEYAZ YAKADAKİ GİBİ DEĞERLENDİRİLİR
      // ----------------------------------------------------------------------
      // SORUN: Yukarıdaki ekip bazlı motor SADECE o gün en az bir kaydı
      // (giriş veya çıkış) olan mavi yaka personelini değerlendiriyordu
      // (bkz. yukarıdaki "DÜZELTME (KRİTİK)" notu). Ekibe yazılmış/atanmış
      // ama QR/kod HİÇ okutmayan bir mavi yaka çalışanı bu motora hiç
      // girmiyordu; kendisi için hiçbir günlük öneri üretilmiyordu. Beyaz
      // yakada bu durum zaten doğru çözülmüştü: kaydı olmayan HERKESE
      // Devamsızlık/Haftalık İzin önerilir. Mavi yakada eksik olan tam
      // olarak buydu — kullanıcı kuralı: "okutmadıysa geldi işaretleme,
      // beyaz yakadaki gibi hangi durumdaysa onu göster."
      // ÇÖZÜM: O gün hiç kaydı OLMAYAN mavi yaka personeli ayrıca tespit
      // edilip AYNI genel motorla (beyazYakaOnerileriHesapla — yaka
      // bağımsız çalışır; yalnızca QR kaydına ve çalışma programına bakar)
      // değerlendirilir. Kaydı OLANLARIN ekip bazlı (çıkış saati, fazla/
      // eksik mesai) hesabına HİÇ DOKUNULMAZ — yalnızca hiç sonucu
      // olmayan kişiler için (Object.assign değil, tek tek kontrol ile)
      // eklenir.
      // ======================================================================
      const maviEkipIdSeti = new Set(maviEkip.map(p => String(p.id)));
      const maviKayitsizlar = maviYaka.filter(p => !maviEkipIdSeti.has(String(p.id)));
      if (maviKayitsizlar.length > 0) {
        try {
          // O gün iş atanmış id kümesi (fotoğraftaki 34 PCY 589 ekibi gibi
          // hiç basmayan ama sefere gidenler için — Devamsız yerine Fazla Gün).
          const kayitsizAtananSet = new Set();
          (jobs || []).forEach(is => {
            if (is.date !== tarih) return;
            const idler = [...(is.assignedPersonnelIds || [])];
            if (is.assignedPersonnelId) idler.push(is.assignedPersonnelId);
            idler.forEach(id => kayitsizAtananSet.add(String(id)));
          });
          const maviKayitsizSonuc = beyazYakaOnerileriHesapla(maviKayitsizlar, maviKayitlar, tarih, kayitsizAtananSet) || {};
          Object.keys(maviKayitsizSonuc).forEach(pid => {
            if (!maviSonuc[pid]) maviSonuc[pid] = maviKayitsizSonuc[pid];
          });
        } catch (e) { /* sessiz geç */ }
      }

      // --- BEYAZ YAKA (yeni sade motor) ---
      // ÖNEMLİ FARK: Beyaz yakada öneri, kaydı OLAN kişilerle sınırlı DEĞİL;
      // takipteki TÜM beyaz yaka personeline uygulanır. Böylece QR okutmayan
      // personel için "Devamsızlık", izin günündeki için "Haftalık İzin"
      // önerisi otomatik üretilir (kullanıcı kuralı). Mavi yakada bu genişletme
      // yapılmadı çünkü oradaki motor ekip bazlı çıkış saati hesaplıyor ve
      // kayıtsız kişileri eklemek ekip hesabını bozar.
      const beyazKayitlar = oGunkuTumKayitlar.filter(k => k.collarType === 'Beyaz Yaka');
      let beyazSonuc = {};
      if (beyazYaka.length > 0) {
        try { beyazSonuc = beyazYakaOnerileriHesapla(beyazYaka, beyazKayitlar, tarih) || {}; } catch (e) { /* sessiz geç */ }
      }

      if (Object.keys(maviSonuc).length || Object.keys(beyazSonuc).length) {
        sonuc[tarih] = { ...maviSonuc, ...beyazSonuc };
      }

      // ======================================================================
      // YENİ: HAFTALIK KURAL MOTORU — GELMEYENLER VE PAZAR GÜNÜ
      // ======================================================================
      // Yukarıdaki iki motor tek günlük veriye bakar; "o hafta ilk gelmeme →
      // Haftalık İzin, ikinci → Devamsızlık" ve "7 gün çalışıldıysa Pazar → FG"
      // kuralları HAFTA bağlamı ister. Bu blok, o kararı haftalık veriye göre
      // ÜZERİNE YAZAR. Saat hesabı gerektiren durumlara (FM/EM) dokunmaz;
      // yalnızca G / Hİ / D / FG kararını düzeltir.
      // Tarih sınırı ve izin kodlarına dokunmama kuralı motorun içindedir.
      // ======================================================================
      if (tarih >= MESAI_KURAL_BASLANGIC) {
        const haftaGunTarihleri = haftaGunleriListesi(tarih);
        // O haftaki tüm QR girişleri: { 'personelId|tarih': true }
        const haftaGirisSeti = new Set(
          (haftaKayitlari || [])
            .filter(k => k.type === 'giris')
            .map(k => `${k.personnelId}|${k.dateStr}`)
        );
        // YENİ (kullanıcı talebi): O haftaki tüm QR ÇIKIŞLARI. Girişi olmayıp
        // yalnızca çıkışı olan gün "şehir dışı dönüşü" sayılır ve FG verilir.
        const haftaCikisSeti = new Set(
          (haftaKayitlari || [])
            .filter(k => k.type === 'cikis')
            .map(k => `${k.personnelId}|${k.dateStr}`)
        );
        // Puantajdaki mevcut kodu okur (elle işlenmiş izin/rapor tespiti için)
        const puantajKodu = (personId, tStr) => {
          const [yy, aa, gg] = tStr.split('-');
          const hucre = puantajlar[`${parseInt(yy)}_${parseInt(aa)}`]?.[personId]?.[parseInt(gg)];
          return (typeof hucre === 'object' && hucre !== null) ? hucre.status : (hucre || null);
        };

        takiptekiPersonel.forEach(p => {
          const haftaGunleri = haftaGunTarihleri.map(t => ({
            tarihStr: t,
            girisVarMi: haftaGirisSeti.has(`${p.id}|${t}`),
            cikisVarMi: haftaCikisSeti.has(`${p.id}|${t}`),
            kod: puantajKodu(p.id, t)
          }));
          const karar = haftalikMesaiKarari({
            tarihStr: tarih,
            girisVarMi: haftaGirisSeti.has(`${p.id}|${tarih}`),
            cikisVarMi: haftaCikisSeti.has(`${p.id}|${tarih}`),
            mevcutKod: puantajKodu(p.id, tarih),
            haftaGunleri
          });
          if (!karar) return; // Kural karışmıyor (izin kodu veya tarih sınırı)

          const oncekiOneri = sonuc[tarih]?.[p.id];
          // FM/EM (saatli) önerileri KORUNUR — kişi gelmiş demektir, saat hesabı
          // tek günlük motorun işidir. Haftalık kural yalnızca G kararını
          // Pazar/FG açısından düzeltir ve gelmeyenlere Hİ/D yazar.
          if (oncekiOneri && ['FM', 'EM', 'FGM'].includes(oncekiOneri.status) && karar.status === 'G') return;

          if (!sonuc[tarih]) sonuc[tarih] = {};
          sonuc[tarih][p.id] = {
            ...(oncekiOneri || {}),
            status: karar.status,
            hours: ['Hİ', 'D', 'FG', 'G'].includes(karar.status) ? '' : (oncekiOneri?.hours || ''),
            girisSaati: oncekiOneri?.girisSaati || null,
            cikisSaati: oncekiOneri?.cikisSaati || null,
            aciklama: karar.aciklama,
            kaynak: oncekiOneri?.kaynak || 'haftalikKural'
          };
        });
      }
    });
    return sonuc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Bağımlılık sadeleştirildi: filtreli zaten gunlukKayitlar'dan türüyor
    // YENİ: fTarih ve beyazYaka eklendi (beyaz yaka önerisi bu ikisine bağlı)
    // YENİ: haftaKayitlari, puantajlar, takiptekiPersonel — haftalık kural motoru
    // YENİ: jobs — ekip (araç) bazlı gruplama bu listeden plaka çözüyor
  }, [gunlukKayitlar, personnelList, fTarih, beyazYaka, maviYaka, haftaKayitlari, puantajlar, takiptekiPersonel, jobs]);

  // RAPORLAMA: seçilen aydaki kayıtlardan kişi bazlı özet çıkarır
  const rapor = useMemo(() => {
    // Rapor ayının kayıtları ayrı ve kapsamı daraltılmış sorgudan gelir
    // ========================================================================
    // DEĞİŞTİ: Rapor artık İKİ YAKAYI kapsar.
    // ESKİ HALİ: .filter(k => k.collarType === 'Mavi Yaka')
    // YENİ HALİ: yaka kısıtı kaldırıldı; yalnızca UZAKTAN çalışanların
    // kayıtları ayıklanır. Böylece "Giriş/Çıkış takibi yine aynı şekilde"
    // kuralı raporlamada da geçerli olur.
    // ========================================================================
    const aylik = aylikKayitlar.filter(k => {
      const kisi = personnelList.find(pp => String(pp.id) === String(k.personnelId));
      return kisi ? !isUzaktanCalisan(kisi) : true;
    });
    const kisiler = new Map();
    aylik.forEach(k => {
      if (!kisiler.has(k.personnelName)) kisiler.set(k.personnelName, { ad: k.personnelName, yaka: k.collarType, gunler: new Map(), kamera: 0, manuel: 0 });
      const kisi = kisiler.get(k.personnelName);
      if (k.method === 'manuel') kisi.manuel++; else kisi.kamera++;
      if (!kisi.gunler.has(k.dateStr)) kisi.gunler.set(k.dateStr, {});
      kisi.gunler.get(k.dateStr)[k.type] = k.timeStr;
    });
    return Array.from(kisiler.values()).map(kisi => {
      let toplamDk = 0, girisDkToplam = 0, girisSay = 0;
      kisi.gunler.forEach(g => {
        if (g.giris) { // Ortalama giriş saati için dakikaya çevir
          const [s, d] = g.giris.split(':').map(Number); girisDkToplam += s * 60 + d; girisSay++;
          if (g.cikis) { // Çalışılan süre = çıkış - giriş
            const [cs, cd] = g.cikis.split(':').map(Number);
            const fark = (cs * 60 + cd) - (s * 60 + d);
            if (fark > 0) toplamDk += fark;
          }
        }
      });
      const ortGiris = girisSay ? `${String(Math.floor(girisDkToplam / girisSay / 60)).padStart(2, '0')}:${String(Math.round(girisDkToplam / girisSay) % 60).padStart(2, '0')}` : '—';
      // toplamSaatSayi: sıralama/karşılaştırma için sayısal değer (virgülsüz).
      // toplamSaat: ekranda gösterilen virgüllü metin (biçim korunur).
      const toplamSaatSayi = toplamDk / 60;
      return { ...kisi, gunSayisi: kisi.gunler.size, toplamSaatSayi, toplamSaat: toplamSaatSayi.toFixed(1).replace('.', ','), ortGiris };
    }).sort((a, b) => b.gunSayisi - a.gunSayisi);
    // personnelList eklendi: uzaktan çalışan filtresi bu listeye bakıyor
  }, [aylikKayitlar, personnelList]);

  // ==========================================================================
  // YENİ (kullanıcı talebi): Raporu seçilen ölçüt + yöne göre sıralar.
  // ==========================================================================
  const raporSirala_fn = useMemo(() => {
    const yon = raporYon === 'asc' ? 1 : -1;
    const kopya = [...rapor];
    kopya.sort((a, b) => {
      if (raporSirala === 'ad') return a.ad.localeCompare(b.ad, 'tr-TR') * yon;
      if (raporSirala === 'gun') return (a.gunSayisi - b.gunSayisi) * yon;
      // varsayılan: toplam saat (sayısal)
      return ((a.toplamSaatSayi || 0) - (b.toplamSaatSayi || 0)) * yon;
    });
    return kopya;
  }, [rapor, raporSirala, raporYon]);

  // Beyaz/Mavi ayrı bloklar için yakaya göre ayrılmış listeler
  const raporBeyaz = useMemo(() => raporSirala_fn.filter(r => r.yaka === 'Beyaz Yaka'), [raporSirala_fn]);
  const raporMavi = useMemo(() => raporSirala_fn.filter(r => r.yaka !== 'Beyaz Yaka'), [raporSirala_fn]);

  // Başlığa tıklayınca sıralama ölçütünü/yönünü değiştirir
  const raporBasligaTikla = (kolon) => {
    if (raporSirala === kolon) { setRaporYon(y => (y === 'desc' ? 'asc' : 'desc')); }
    else { setRaporSirala(kolon); setRaporYon(kolon === 'ad' ? 'asc' : 'desc'); }
  };

  // ---------------------------------------------------------------------------
  // "BİRLİKTE" SÜTUNU — EKİP BAZLI (yalnızca Mavi Yaka)
  // DEĞİŞİKLİK: Eskiden o gün şirkette giriş yapan HERKES sayılıyordu. Artık
  // personelin o gün ATANDIĞI İŞLERİN ekibi esas alınır: aynı işe atanmış
  // diğer mavi yaka personeller listelenir. Birden fazla işe atanmışsa hepsi
  // birleştirilir ve mükerrer isimler tekilleştirilir.
  // ---------------------------------------------------------------------------

  // Bir işin ekip kimlikleri (hem çoklu hem tekil atama alanı desteklenir)
  // DEĞİŞTİ: Ekip listesine desteğe gelenler de dahil edilir; puantaj
  // ipuçlarında "kiminle çalıştı" bilgisi destek personelini de gösterir.
  const isinEkipIdleri = (is) => isTamEkipIdleri(is);

  // Kayıt sahibinin o gün birlikte çalıştığı MAVİ YAKA ekip arkadaşları
  // ==========================================================================
  // "İŞE GİTTİ / ARAÇ" SÜTUNU (eski "Birlikte" sütununun yerine)
  // Personelin o gün atandığı işin ARACINI (plaka) bulur. Aynı araçla giden
  // ekibin hem plakası hem personel adı AYNI RENKTE gösterilir; böylece
  // listede hangi ekibin birlikte gittiği tek bakışta ayırt edilir.
  // ==========================================================================
  const personelAraci = (personelId, tarih) => {
    const pid = String(personelId);
    const oGunkuIsler = (jobs || []).filter(is => is.date === tarih && isinEkipIdleri(is).includes(pid));
    // YENİ: Destek zinciri varsa SON ekibin plakası başa alınır — mesai o
    // araca göre hesaplandığı için ipucunda da ilk sırada görünmelidir.
    const sonIs = personelSonEkipIsi(pid, tarih, jobs || []);
    const sonPlaka = sonIs?.assignedVehiclePlate || null;
    const hamPlakalar = [...new Set(oGunkuIsler.map(is => is.assignedVehiclePlate).filter(Boolean))];
    const plakalar = sonPlaka
      ? [sonPlaka, ...hamPlakalar.filter(pl => pl !== sonPlaka)]
      : hamPlakalar;
    return {
      plakalar,
      isler: oGunkuIsler,
      // Ekip arkadaşları (yalnızca Mavi Yaka), ipucu metninde gösterilir
      ekip: [...new Set(oGunkuIsler.flatMap(is => isinEkipIdleri(is)
        .filter(id => id !== pid)
        .map(id => personnelList.find(pp => String(pp.id) === id))
        .filter(k => k && mesaiYakaTipi(k) === 'Mavi Yaka')
        .map(k => k.fullName)))]
    };
  };

  // O GÜNÜN ARAÇ RENK HARİTASI: her plakaya sabit bir renk atanır.
  // Aynı gün içinde plaka sırası değişse bile renk kaymasın diye plakalar
  // alfabetik sıralanır.
  const ARAC_RENKLERI = [
    { yazi: 'text-orange-600', rozet: 'bg-orange-100 text-orange-700 border-orange-300' },
    { yazi: 'text-blue-600', rozet: 'bg-blue-100 text-blue-700 border-blue-300' },
    { yazi: 'text-purple-600', rozet: 'bg-purple-100 text-purple-700 border-purple-300' },
    { yazi: 'text-emerald-600', rozet: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { yazi: 'text-pink-600', rozet: 'bg-pink-100 text-pink-700 border-pink-300' },
    { yazi: 'text-cyan-600', rozet: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
    { yazi: 'text-amber-700', rozet: 'bg-amber-100 text-amber-800 border-amber-300' },
    { yazi: 'text-indigo-600', rozet: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    { yazi: 'text-teal-600', rozet: 'bg-teal-100 text-teal-700 border-teal-300' },
    { yazi: 'text-rose-600', rozet: 'bg-rose-100 text-rose-700 border-rose-300' },
  ];
  const gununAraclari = useMemo(() => {
    const plakalar = [...new Set((jobs || [])
      .filter(is => is.date === fTarih)
      .map(is => is.assignedVehiclePlate)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    const harita = {};
    plakalar.forEach((plaka, i) => { harita[plaka] = ARAC_RENKLERI[i % ARAC_RENKLERI.length]; });
    return { plakalar, harita };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, fTarih]);

  const aracRengi = (plaka) => gununAraclari.harita[plaka] || { yazi: 'text-neutral-500', rozet: 'bg-neutral-100 text-neutral-600 border-neutral-300' };

  // ---------------------------------------------------------------------------
  // MESAİ DURUMU (PUANTAJ) YARDIMCILARI — "Tüm Kayıtlar" sütunu için
  // ---------------------------------------------------------------------------
  // Bir kaydın muhasebedeki (puantaj) mevcut durumunu okur
  const puantajDurumu = (k) => {
    const [y, a, g] = (k.dateStr || '').split('-').map(Number);
    const hucre = puantajlar[`${y}_${a}`]?.[k.personnelId]?.[g];
    if (!hucre) return null;
    return typeof hucre === 'object' ? hucre : { status: hucre, hours: '', manual: false };
  };
  // QR'a dayalı öneri
  // ==========================================================================
  // ÖNERİ (Mesai Takip tablosu için SADELEŞTİRİLMİŞ)
  // KULLANICI KURALI: Bu tablo yalnızca QR/kod okutma gerçeğini gösterir:
  //   • Okuttuysa  -> "Geldi"
  //   • Okutmadıysa -> "Devamsız" (veya o gün izinliyse izin kodu)
  // FAZLA MESAİ / EKSİK MESAİ burada ÖNERİ olarak GÖSTERİLMEZ; bu durumlar
  // ancak İş Onaylama Tahtası'ndan mesai onaylandıktan sonra (puantaja
  // yazıldıktan sonra) bu sütunda görünür.
  // NOT: Onay ekranındaki (App.tsx) hesap DEĞİŞMEDİ; orada fazla/eksik mesai
  // önerisi tüm ayrıntısıyla gelmeye devam eder.
  //
  // ==========================================================================
  // HATA DÜZELTMESİ (kullanıcı bildirimi): "Haftanın her günü gelen personele
  // FAZLA GÜN yazılması lazım" — ama tabloda "Geldi" görünüyordu.
  // --------------------------------------------------------------------------
  // KÖK NEDEN: Haftalık kural motoru (haftalikMesaiKarari) 7 gün kesintisiz
  // çalışmayı DOĞRU tespit edip 'FG' üretiyordu (izole testle doğrulandı:
  // 7 gün geldi -> FG, ilk gelmeme -> Hİ, ikinci gelmeme -> D). Ancak
  // aşağıdaki sadeleştirme eşlemesi, ekrana çizilmeden ÖNCE 'FG' kodunu
  // 'G' (Geldi) hâline getiriyordu. Yani karar doğruydu, GÖSTERİM yanlıştı.
  //
  // DÜZELTME: 'FG' eşlemeden ÇIKARILDI. Gerekçe: FG bir SAAT hesabı değildir —
  // 7 gün çalışıldığı için kazanılan TAM BİR GÜNdür ve İş Onaylama
  // Tahtası'ndan saat onayı gerektirmez. Saat hesabı gerektiren FM / EM / FGM
  // için eski kural (öneri olarak gösterilmez) AYNEN korunuyor; o kısıtın
  // amacı zaten onaysız saat göstermemekti.
  //
  // NOT: Toplu işleme (onerileriPuantajaIsle) HAM öneriyi kullandığı için
  // FG'yi zaten doğru yazıyordu; bu düzeltme onu görünür ve elle
  // düzenlenebilir hâle getirir.
  // ==========================================================================
  const SADE_ONERI_ESLEME = { FM: 'G', EM: 'G', FGM: 'G' };
  const oneriDurumu = (k) => {
    const dogal = gunlukOneriler[k.dateStr]?.[k.personnelId];
    if (dogal) {
      const sadeKod = SADE_ONERI_ESLEME[dogal.status] || dogal.status;
      return sadeKod === dogal.status ? dogal : { ...dogal, status: sadeKod, hours: '' };
    }
    if (!k.dateStr || k.dateStr > mesaiBugunStr()) return null; // Gelecek gün -> boş bırak
    // YENİ TARİH SINIRI: kural başlangıcından önceki günlere "Devamsız" önerilmez;
    // o dönemin kaydı Personel Muhasebe'de ne girildiyse odur (kullanıcı kuralı).
    if (k.dateStr < MESAI_KURAL_BASLANGIC) return null;
    const person = personnelList.find(pp => String(pp.id) === String(k.personnelId));
    if (!person) return null;
    // NOT: Eskiden çalışma programındaki sabit izin gününe (ör. Pazar) bakılıp
    // "Haftalık İzin" öneriliyordu. Artık izinler İzin Tahtası'ndan belirlendiği
    // için burada program'a bakılmaz; puantajda izin kodu varsa zaten
    // puantajDurumu() onu gösterir, yoksa devamsız önerilir.
    return { status: 'D', hours: '', girisSaati: null, cikisSaati: null, aciklama: 'QR veya seri kod ile giriş kaydı yok → Devamsız önerildi. (İzinliyse İzin Tahtası’ndan işaretleyin.)' };
  };
  // Durum kodunun etiket ve rengini verir
  const durumStili = (kod) => MESAI_STATUS_OPTIONS.find(o => o.code === kod) || { code: kod, label: kod, color: 'bg-neutral-100 text-neutral-600' };
  // Satırın EKİN durum kodu: önce muhasebe kaydı, yoksa QR önerisi, o da yoksa null.
  // Mesai Durumu filtresi bu değere göre çalışır.
  const satirDurumKodu = (k) => {
    const pd = puantajDurumu(k);
    if (pd?.status) return pd.status;
    const on = oneriDurumu(k);
    return on?.status || null;
  };

  // ==========================================================================
  // GÜNLÜK TAKİP GÖSTERGESİ (başlığın sağında)
  // Seçili gün için tüm Mavi Yaka personeli durum gruplarına ayırır:
  // gelenler / devamsızlar / haftalık izinliler / diğer izinliler.
  // Tablodaki sıralama gruplarıyla BİREBİR aynı mantığı kullanır ki
  // ekrandaki liste ile rozetlerdeki sayılar birbirini tutsun.
  // ==========================================================================
  const gunlukOzet = useMemo(() => {
    const ozet = { geldi: 0, devamsiz: 0, haftalikIzin: 0, digerIzin: 0, belirsiz: 0, toplam: 0 };
    if (!fTarih) return ozet;
    // DEĞİŞTİ: maviYaka -> takiptekiPersonel (mavi + beyaz, uzaktan hariç).
    // Böylece başlıktaki "X kişi geldi / Y haftalık izin" rozetleri artık
    // beyaz yakayı da sayar ve tablodaki liste ile birebir tutar.
    takiptekiPersonel.forEach(p => {
      const satir = {
        personnelId: String(p.id),
        dateStr: fTarih,
        giris: gunlukKayitlar.find(k => String(k.personnelId) === String(p.id) && k.type === 'giris') || null
      };
      ozet.toplam += 1;
      const kod = satirDurumKodu(satir);
      if (satir.giris || ['G', 'FM', 'EM', 'FG', 'FGM'].includes(kod)) ozet.geldi += 1;
      else if (kod === 'D') ozet.devamsiz += 1;
      else if (kod === 'Hİ') ozet.haftalikIzin += 1;
      else if (['Yİ', 'Bİ', 'Üİ', 'R', 'İB'].includes(kod)) ozet.digerIzin += 1;
      else ozet.belirsiz += 1;
    });
    return ozet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fTarih, takiptekiPersonel, gunlukKayitlar, puantajlar, gunlukOneriler]);

  // Düzenlemeyi puantaja (Personel Muhasebe ile AYNI koleksiyona) yazar.
  // manual:true işaretlenir; böylece bu satır bir daha düzenlenemez ve
  // otomatik öneriler bu kaydı ezmez.
  const durumKaydet = async () => {
    if (!durumDuzenle) return;
    const { kayit, status, hours } = durumDuzenle;
    const [y, a, g] = (kayit.dateStr || '').split('-').map(Number);
    const anahtar = `${y}_${a}`;
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', anahtar);
      const snap = await getDoc(ref);
      const records = snap.exists() ? (snap.data().records || {}) : {};
      if (!records[kayit.personnelId]) records[kayit.personnelId] = {};
      records[kayit.personnelId][g] = {
        status,
        hours: (status === 'FM' || status === 'EM' || status === 'FGM') ? String(hours || '') : '',
        manual: true,                    // ELLE düzenlendi -> kilitlenir
        kaynak: 'Mesai Takip',           // Nereden düzenlendiği izlenebilsin
        duzenlemeTarihi: new Date().toLocaleString('tr-TR')
      };
      await setDoc(ref, { records, updatedAt: new Date().toISOString() }, { merge: true });
      setDurumDuzenle(null);
    } catch (e) {
      console.error('Mesai durumu kaydedilemedi:', e);
      alert('Mesai durumu kaydedilirken bir hata oluştu.');
    }
  };

  // ==========================================================================
  // YENİ: ÖNERİLERİ PUANTAJA TOPLU İŞLE
  // ==========================================================================
  // SORUN: QR kayıtlarından üretilen öneriler (Geldi / Devamsız / Fazla Mesai
  // saatleri) yalnızca ekranda görünüyordu. Personel Muhasebe > Mavi Yaka
  // Mesai tablosuna geçmesi için her satırı tek tek kalemle açıp kaydetmek
  // gerekiyordu; bu yüzden muhasebede FM kodu yazsa bile SAAT hücresi boş
  // kalıyordu.
  //
  // ÇÖZÜM: Bu düğme, seçili günün tüm önerilerini tek seferde puantaja yazar.
  // Kritik ayrıntı: ekranda gösterilen SADELEŞTİRİLMİŞ öneri (FM -> G) değil,
  // HAM öneri (gunlukOneriler) kullanılır — yoksa fazla mesai saatleri yine
  // kaybolurdu.
  //
  // KORUMALAR:
  //   • manual:true olan kayıtlara DOKUNULMAZ (elle girilen değer kutsaldır)
  //   • İzin kodları (Yİ/Bİ/Üİ/R/İB/Hİ) varsa üzerine yazılmaz
  //   • Zaten aynı değer yazılıysa tekrar yazılmaz (gereksiz Firestore yazımı)
  // ==========================================================================
  const [topluIsleniyor, setTopluIsleniyor] = useState(false);
  const KORUNAN_KODLAR = ['Yİ', 'Bİ', 'Üİ', 'R', 'İB', 'Hİ'];

  const onerileriPuantajaIsle = async () => {
    if (!fTarih) return;
    const gunOnerileri = gunlukOneriler[fTarih] || {};
    const [y, a, g] = fTarih.split('-').map(Number);
    const anahtar = `${y}_${a}`;

    // Yazılacakları önce hesapla ki kullanıcıya net bir onay sorusu sorulabilsin
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', anahtar);
    let mevcutRecords = {};
    try {
      const snap = await getDoc(ref);
      mevcutRecords = snap.exists() ? (snap.data().records || {}) : {};
    } catch (e) { console.error('Puantaj okunamadı:', e); alert('Puantaj okunamadı.'); return; }

    const yazilacaklar = [];
    takiptekiPersonel.forEach(p => {
      const oneri = gunOnerileri[String(p.id)];
      if (!oneri || !oneri.status) return;
      const mevcut = mevcutRecords[String(p.id)]?.[g];
      const mevcutKod = typeof mevcut === 'object' && mevcut !== null ? mevcut.status : mevcut;
      if (mevcut && mevcut.manual === true) return;              // Elle girilmiş: dokunma
      if (KORUNAN_KODLAR.includes(mevcutKod)) return;            // İzin kodu: dokunma
      const yeniSaat = (oneri.status === 'FM' || oneri.status === 'EM' || oneri.status === 'FGM')
        ? String(oneri.hours || '') : '';
      const mevcutSaat = typeof mevcut === 'object' && mevcut !== null ? String(mevcut.hours || '') : '';
      if (mevcutKod === oneri.status && mevcutSaat === yeniSaat) return; // Değişiklik yok
      yazilacaklar.push({ id: String(p.id), ad: p.fullName, kod: oneri.status, saat: yeniSaat });
    });

    if (yazilacaklar.length === 0) {
      alert('İşlenecek yeni öneri yok. (Elle düzenlenmiş ve izinli kayıtlara dokunulmaz.)');
      return;
    }
    const ozet = yazilacaklar.slice(0, 12).map(x => `• ${x.ad}: ${x.kod}${x.saat ? ` (${x.saat} sa)` : ''}`).join('\n');
    if (!window.confirm(
      `${fTarih.split('-').reverse().join('.')} tarihli ${yazilacaklar.length} kayıt Personel Muhasebe puantajına işlenecek:\n\n${ozet}${yazilacaklar.length > 12 ? `\n… ve ${yazilacaklar.length - 12} kayıt daha` : ''}\n\nDevam edilsin mi?`
    )) return;

    setTopluIsleniyor(true);
    try {
      const records = { ...mevcutRecords };
      yazilacaklar.forEach(x => {
        if (!records[x.id]) records[x.id] = {};
        records[x.id][g] = {
          status: x.kod,
          hours: x.saat,
          manual: false,                  // Otomatik: sonraki onaylarda güncellenebilir
          kaynak: 'Mesai Takip (Toplu Onay)',
          duzenlemeTarihi: new Date().toLocaleString('tr-TR')
        };
      });
      await setDoc(ref, { records, updatedAt: new Date().toISOString() }, { merge: true });
      // NOT: Bu bileşene addSystemLog prop'u geçilmediği için sistem günlüğü
      // yazılmaz; işlemin izi puantaj kaydındaki kaynak/duzenlemeTarihi
      // alanlarında zaten tutuluyor.
      alert(`${yazilacaklar.length} kayıt puantaja işlendi. Personel Muhasebe > Mavi Yaka Mesai tablosundan kontrol edebilirsiniz.`);
    } catch (e) {
      console.error('Toplu işleme hatası:', e);
      alert('Puantaja işlenirken hata oluştu. Lütfen tekrar deneyin.');
    }
    setTopluIsleniyor(false);
  };

  // Giriş/çıkış SAATİNİ bir kez düzenler ve kaydı kilitler.
  // Kayıt silinmez; yalnızca saat güncellenir ve kimin düzelttiği iz olarak kalır.
  const saatKaydet = async () => {
    if (!saatDuzenle) return;
    const { kayit, saat, yeniKayit } = saatDuzenle;
    // Saat biçimi ve aralık kontrolü: yalnızca 00:00 - 23:59 kabul edilir.
    // (Tarayıcının time alanı zaten kısıtlar; bu kontrol ikinci güvenlik katmanıdır.)
    const es = /^(\d{2}):(\d{2})$/.exec(saat || '');
    if (!es || Number(es[1]) > 23 || Number(es[2]) > 59) { alert('Lütfen geçerli bir saat girin (00:00 - 23:59).'); return; }
    try {
      if (!kayit && yeniKayit) {
        // ============================================================
        // ELLE YENİ KAYIT: Personel QR/kod basmayı unuttuysa yönetici
        // saati elle girer. Kayıt, QR kayıtlarıyla aynı yapıda oluşturulur
        // ancak 'elleEklendi' ile işaretlenir ve konumsuz olur.
        // saatDuzenlendi:true olduğu için bir daha değiştirilemez.
        // ============================================================
        const { grup, tip } = yeniKayit;
        await addDoc(mesaiKayitlarColRef(), {
          personnelId: String(grup.personnelId),
          personnelName: grup.personnelName,
          position: grup.position || '',
          collarType: grup.collarType,
          type: tip,                                  // 'giris' veya 'cikis'
          method: 'manuel',                           // Elle girildi
          dateStr: grup.dateStr,
          timeStr: saat,
          timestamp: new Date(`${grup.dateStr}T${saat}:00`).getTime() || Date.now(),
          lat: null, lng: null, accuracy: null,
          konumDurumu: 'alinamadi',                   // QR basılmadığı için konum yok
          cihaz: '-',
          elleEklendi: true,                          // Yönetici tarafından eklendi
          saatDuzenlendi: true,                       // Bir daha düzenlenemez
          saatDuzenleyen: currentUser?.fullName || 'Bilinmiyor',
          saatDuzenlemeTarihi: new Date().toLocaleString('tr-TR')
        });
      } else if (kayit) {
        // MEVCUT KAYDIN SAATİNİ DÜZELT (bir kez)
        await updateDoc(doc(mesaiKayitlarColRef(), kayit.id), {
          timeStr: saat,
          saatDuzenlendi: true,                                  // Bir daha düzenlenemez
          eskiSaat: kayit.timeStr,                               // Önceki saat iz olarak saklanır
          saatDuzenleyen: currentUser?.fullName || 'Bilinmiyor',
          saatDuzenlemeTarihi: new Date().toLocaleString('tr-TR')
        });
      }
      setSaatDuzenle(null);
    } catch (e) {
      console.error('Saat kaydedilemedi:', e);
      alert('Saat kaydedilirken bir hata oluştu.');
    }
  };

  // QR YÖNETİMİ işlemleri
  // ÇOKLU AKTİF: bir kodu aktif/pasif yapar. Güvenlik gereği en az BİR kod
  // aktif kalmalıdır; son aktif kodu kapatmaya çalışılırsa uyarı verilir.
  const qrAktifDegistir = async (id) => {
    const mevcut = Array.isArray(aktifIdler) ? [...aktifIdler] : [];
    const acik = mevcut.includes(id);
    if (acik && mevcut.length === 1) {
      alert('En az bir QR kod aktif kalmalıdır. Önce başka bir kodu aktif edin.');
      return;
    }
    const yeni = acik ? mevcut.filter(x => x !== id) : [...mevcut, id];
    await updateDoc(qrConfigRef(), { aktifQrIdler: yeni });
  };
  const qrYenile = async (id) => {
    if (!window.confirm('Bu QR kodun içeriği ve seri kodu YENİLENECEK. Duvardaki eski çıktı geçersiz olur. Devam edilsin mi?')) return;
    // Yalnızca seri kod yenilenir (15 haneli ayrı kod artık yok)
    const yeniListe = (ayarlar?.qrList || []).map(q => q.id === id ? { id: q.id, ad: q.ad, manuelKod: rastgeleManuelKod(), olusturma: new Date().toLocaleString('tr-TR') } : q);
    await updateDoc(qrConfigRef(), { qrList: yeniListe });
  };
  // NOT: Kayıt SİLME işlevi kullanıcı isteğiyle KALDIRILDI. Mesai hareketleri
  // (giriş/çıkış kayıtları) silinemez; yalnızca saatleri bir kez düzenlenebilir.


  const sekmeler = [
    // NOT: "Bugünkü Durum" sekmesi kullanıcı isteğiyle KALDIRILDI.
    { id: 'kayitlar', ad: 'Tüm Kayıtlar', ikon: FileText },
    { id: 'qr', ad: 'QR Yönetimi', ikon: QrCode },
    { id: 'rapor', ad: 'Raporlama', ikon: Users }
  ];

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* SAYFA BAŞLIĞI */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-5 md:p-6 rounded-2xl shadow-lg text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><QrCode className="w-7 h-7" /> Mesai Takip Bölümü</h2>
          <p className="text-white/80 text-xs md:text-sm font-bold mt-1">QR kod + konum doğrulamalı personel mesai giriş/çıkış takibi • Mavi Yaka &amp; Beyaz Yaka</p>
          {/* ÇOKLU AKTİF: aktif kodların tamamı listelenir */}
          {(aktifQrlar || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {aktifQrlar.map(q => (
                <span key={q.id} className="inline-flex items-center gap-2 text-[11px] font-black bg-white/15 px-3 py-1 rounded-full">
                  <Shield className="w-3.5 h-3.5" /> {q.ad} • {q.manuelKod}
                </span>
              ))}
              {aktifQrlar.length > 1 && (
                <span className="inline-flex items-center text-[10px] font-black bg-white/25 px-2.5 py-1 rounded-full">{aktifQrlar.length} kod aktif</span>
              )}
            </div>
          )}
        </div>
        {/* GÜNLÜK TAKİP GÖSTERGESİ — seçili günün özeti */}
        <div className="flex flex-wrap gap-2 shrink-0 md:justify-end">
          {[
            { sayi: gunlukOzet.geldi, etiket: 'kişi geldi', renk: 'bg-white text-emerald-700', ikon: CheckCircle },
            { sayi: gunlukOzet.devamsiz, etiket: 'devamsız', renk: 'bg-red-500/90 text-white', ikon: AlertTriangle },
            { sayi: gunlukOzet.haftalikIzin, etiket: 'haftalık izin', renk: 'bg-blue-500/90 text-white', ikon: Calendar },
            { sayi: gunlukOzet.digerIzin, etiket: 'diğer izin', renk: 'bg-purple-500/90 text-white', ikon: FileText },
          ].map((k, i) => (
            // Sıfır olan gruplar gizlenir; ekran gereksiz kalabalıklaşmasın
            k.sayi > 0 ? (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-sm ${k.renk}`}>
                <k.ikon className="w-4 h-4 shrink-0" />
                <span className="text-base font-black leading-none">{k.sayi}</span>
                <span className="text-[10px] font-black opacity-80 whitespace-nowrap">{k.etiket}</span>
              </div>
            ) : null
          ))}
          {/* Hiç veri yoksa kullanıcı boş alana bakmasın */}
          {gunlukOzet.toplam === 0 && (
            <span className="text-[11px] font-bold bg-white/15 px-3 py-2 rounded-xl">Bu gün için personel kaydı yok</span>
          )}
          {/* ==============================================================
              YENİ: PUANTAJA İŞLE
              Seçili günün QR önerilerini (Geldi / Devamsız / Fazla mesai
              saatleriyle birlikte) Personel Muhasebe puantajına tek tıkla
              aktarır. Elle düzenlenmiş ve izinli kayıtlara dokunmaz.
              ============================================================== */}
          {gunlukOzet.toplam > 0 && (
            <button type="button" onClick={onerileriPuantajaIsle} disabled={topluIsleniyor}
              title="Bu günün mesai önerilerini Personel Muhasebe > Mavi Yaka Mesai tablosuna işler"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-sm bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-400 text-white transition">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-black whitespace-nowrap">{topluIsleniyor ? 'İşleniyor...' : 'Puantaja İşle'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SEKMELER */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sekmeler.map(s => (
          <button key={s.id} onClick={() => setSekme(s.id)} className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap transition ${sekme === s.id ? 'bg-black text-white shadow-md' : 'bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-100'}`}>
            <s.ikon className="w-4 h-4" /> {s.ad}
          </button>
        ))}
      </div>

      {/* 2) TÜM KAYITLAR — filtreli tablo */}
      {sekme === 'kayitlar' && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
          {/* Filtre çubuğu */}
          {/* FİLTRE ÇUBUĞU — 4 filtre TEK SATIRDA.
              12 kolonluk ızgara kullanılır: tarih 4, yaka 2, durum 3, personel 3 = 12.
              Küçük ekranlarda (mobil) alt alta iner. */}
          {/* 5 FİLTRE TEK SATIRDA: tarih 3 + yaka 2 + durum 3 + personel 2 + araç 2 = 12 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2 mb-4 items-stretch">
            {/* TEK TARİH SEÇİCİ + GÜN OKLARI
                Sol ok bir gün geri, sağ ok bir gün ileri gider. Sayfa her
                açıldığında bugünle başlar. "Bugün" düğmesi hızlı dönüş sağlar. */}
            <div className="flex items-stretch gap-1 min-w-0 lg:col-span-3">
              <button
                onClick={() => { const d = new Date(fTarih); d.setDate(d.getDate() - 1); setFTarih(d.toISOString().split('T')[0]); }}
                className="px-2 shrink-0 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 transition text-neutral-600"
                title="Bir gün geri"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input type="date" value={fTarih} onChange={e => setFTarih(e.target.value || mesaiBugunStr())} className="flex-1 min-w-0 px-1.5 py-2.5 border border-neutral-300 rounded-xl text-xs font-black text-center" />
              <button
                onClick={() => { const d = new Date(fTarih); d.setDate(d.getDate() + 1); setFTarih(d.toISOString().split('T')[0]); }}
                className="px-2 shrink-0 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 transition text-neutral-600"
                title="Bir gün ileri"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {/* Bugün değilse hızlı dönüş düğmesi görünür */}
              {fTarih !== mesaiBugunStr() && (
                <button onClick={() => setFTarih(mesaiBugunStr())} className="px-2 shrink-0 rounded-xl bg-black text-white text-[9px] font-black hover:bg-neutral-800 transition whitespace-nowrap" title="Bugüne dön">BUGÜN</button>
              )}
            </div>
            <select value={fYaka} onChange={e => setFYaka(e.target.value)} className="min-w-0 truncate px-2 py-2.5 border border-neutral-300 rounded-xl text-xs font-bold lg:col-span-2"><option value="hepsi">Tüm Yakalar</option><option>Mavi Yaka</option><option>Beyaz Yaka</option></select>
            {/* YENİ: MESAİ DURUMU FİLTRESİ — Geldi / Fazla Mesai / Devamsız vb. */}
            <select value={fDurum} onChange={e => setFDurum(e.target.value)} className="min-w-0 truncate px-2 py-2.5 border border-neutral-300 rounded-xl text-xs font-bold lg:col-span-3" title="Mesai durumuna göre filtrele">
              <option value="hepsi">Tüm Mesai Durumları</option>
              {MESAI_STATUS_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
              <option value="yok">Durumu Girilmemiş</option>
            </select>
            {/* YENİ: PERSONEL SEÇ — seçilen personelin kayıtları filtrelenir */}
            <select value={fPersonel} onChange={e => setFPersonel(e.target.value)} className="min-w-0 truncate px-2 py-2.5 border border-neutral-300 rounded-xl text-xs font-bold lg:col-span-2" title="Tek bir personeli seçerek yalnızca onun kayıtlarını görün">
              <option value="hepsi">Personel Seç (Tümü)</option>
              {/* ================================================================
                  DEĞİŞTİ: Liste artık iki yakayı da içerir.
                  ESKİ HALİ: yalnızca [...maviYaka] listeleniyordu.
                  YENİ HALİ: optgroup ile "Mavi Yaka" ve "Beyaz Yaka" başlıkları
                  altında ayrı ayrı, her grup Türkçe alfabetik sırada.
                  Uzaktan çalışanlar bu listede HİÇ görünmez (aktifPersonel filtresi).
                  ================================================================ */}
              <optgroup label="Mavi Yaka">
                {[...maviYaka].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'tr')).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </optgroup>
              <optgroup label="Beyaz Yaka (Örgün)">
                {/* Beyaz yakada önce POZİSYON, sonra isim alfabetik — tabloyla aynı mantık */}
                {[...beyazYaka].sort((a, b) => {
                  const poz = (a.position || 'zzz').localeCompare(b.position || 'zzz', 'tr');
                  return poz !== 0 ? poz : (a.fullName || '').localeCompare(b.fullName || '', 'tr');
                }).map(p => <option key={p.id} value={p.id}>{p.fullName} — {p.position || 'Pozisyonsuz'}</option>)}
              </optgroup>
            </select>

            {/* YENİ: ARAÇ / EKİP FİLTRESİ — seçilen araçla giden ekibi gösterir */}
            <select value={fArac} onChange={e => setFArac(e.target.value)} className="min-w-0 truncate px-2 py-2.5 border border-neutral-300 rounded-xl text-xs font-bold lg:col-span-2" title="Bir araç seçerek o araçla sahaya çıkan ekibi görün">
              <option value="hepsi">Araç / Ekip (Tümü)</option>
              {gununAraclari.plakalar.map(pl => <option key={pl} value={pl}>{pl}</option>)}
              <option value="aracsiz">Araç atanmamış</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="text-[10px] font-black text-neutral-400 uppercase border-b border-neutral-200">
                {/* DEĞİŞİKLİK: Artık her QR kaydı ayrı satır değil; her PERSONEL-GÜN tek satır.
                    Giriş ve Çıkış ayrı sütunlarda gösterilir, basılmayan taraf boş kalır. */}
                <th className="py-2 pr-3">Personel</th><th className="py-2 pr-3">Yaka</th><th className="py-2 pr-3">Tarih</th><th className="py-2 pr-3">Giriş</th><th className="py-2 pr-3">Çıkış</th><th className="py-2 pr-3">Mesai Durumu</th><th className="py-2 pr-3">Cihaz</th><th className="py-2 pr-3" title="Personelin o gün hangi araçla sahaya çıktığı. Aynı renk = aynı ekip.">İşe Gitti / Araç</th>
              </tr></thead>
              <tbody>
                {/* ============================================================
                    SATIRLAR ARTIK PERSONEL-GÜN BAZLI
                    Aynı personelin aynı güne ait giriş ve çıkış kayıtları TEK
                    satırda birleştirilir; Giriş ve Çıkış ayrı sütunlarda görünür.
                    Basılmayan taraf boş (—) kalır.
                    Mesai Durumu filtresi de bu birleşik satıra uygulanır.
                    ============================================================ */}
                {(() => {
                  // 1) Kayıtları personel + tarih anahtarına göre grupla
                  const gruplar = new Map();
                  filtreli.forEach(k => {
                    const anahtar = `${k.personnelId}__${k.dateStr}`;
                    if (!gruplar.has(anahtar)) {
                      gruplar.set(anahtar, {
                        anahtar,
                        personnelId: k.personnelId,
                        personnelName: k.personnelName,
                        // DÜZELTME: Pozisyon adı normalize edilir. Eski/hatalı yazılmış
                        // pozisyonlar (ör. "Satış Destek") geçerli karşılığına
                        // ("Satış Personeli") çevrilir; kataloğa uyan adlar aynen kalır.
                        // Kayıt anındaki pozisyon eski adla yazılmış olabileceği için
                        // burada da uygulanır.
                        position: normalizePozisyon(k.position),
                        collarType: k.collarType,
                        dateStr: k.dateStr,
                        giris: null,
                        cikis: null,
                        zaman: 0
                      });
                    }
                    const g = gruplar.get(anahtar);
                    if (k.type === 'giris') g.giris = k; else g.cikis = k;
                    g.zaman = Math.max(g.zaman, k.timestamp || 0);
                  });

                  // 2) YENİ: QR OKUTMAYAN / KOD GİRMEYEN PERSONELİ DE EKLE
                  // Seçilen tarih aralığındaki her gün için, hiç kaydı olmayan
                  // personeller de listeye eklenir (giriş/çıkış boş görünür,
                  // durum sütununda "Devamsız" veya "Haftalık İzin" önerilir).
                  // Not: Giriş/Çıkış tipi filtresi seçiliyse bu satırlar eklenmez,
                  // çünkü o filtre zaten mevcut kayıtları süzmeyi amaçlar.
                  if (fTarih) {
                    const gunler = [fTarih]; // Tek gün görüntülendiği için sadece seçilen tarih
                    // ==================================================================
                    // DEĞİŞTİ: Filtrelere uyan personel listesi
                    // ESKİ HALİ: `maviYaka` — yalnızca mavi yaka listelenirdi.
                    // YENİ HALİ: `takiptekiPersonel` — mavi + beyaz yaka birlikte,
                    //   UZAKTAN çalışanlar hariç. Böylece QR okutmayan beyaz yaka
                    //   personel de tabloda satır olarak görünür ve durumu
                    //   (Devamsızlık / Haftalık İzin) önerilir.
                    // ==================================================================
                    const hedefPersonel = takiptekiPersonel
                      .filter(pp => fPersonel === 'hepsi' || String(pp.id) === String(fPersonel))
                      .filter(pp => fYaka === 'hepsi' || mesaiYakaTipi(pp) === fYaka);
                    gunler.forEach(tarih => {
                      hedefPersonel.forEach(pp => {
                        const anahtar = `${pp.id}__${tarih}`;
                        if (gruplar.has(anahtar)) return; // Kaydı var, atla
                        gruplar.set(anahtar, {
                          anahtar,
                          personnelId: String(pp.id),
                          personnelName: pp.fullName,
                          // DÜZELTME: Personel kartındaki pozisyon adı da normalize edilir.
                          // Böylece hem satır alt metni, hem "İşe Gitti / Araç" sütunundaki
                          // pozisyon rozeti, hem de blok başlığı ("BEYAZ YAKA • ...") aynı
                          // düzeltilmiş adı gösterir ve tek bir grupta toplanır.
                          position: normalizePozisyon(pp.position),
                          collarType: mesaiYakaTipi(pp),
                          dateStr: tarih,
                          giris: null,
                          cikis: null,
                          zaman: 0,
                          kayitYok: true // QR/kod girişi hiç yapılmamış
                        });
                      });
                    });
                  }

                  // 3) Mesai durumu filtresini birleşik satıra uygula + ALFABETİK sırala
                  const gorunenler = [...gruplar.values()]
                    .filter(g => {
                      if (fDurum === 'hepsi') return true;
                      const kod = satirDurumKodu(g);
                      return fDurum === 'yok' ? !kod : kod === fDurum;
                    })
                    // ARAÇ / EKİP FİLTRESİ
                    .filter(g => {
                      if (fArac === 'hepsi') return true;
                      const plakalar = personelAraci(g.personnelId, g.dateStr).plakalar;
                      if (fArac === 'aracsiz') return plakalar.length === 0;
                      return plakalar.includes(fArac);
                    })
                    // ==================================================================
                    // SIRALAMA: önce DURUM GRUBU, her grubun içinde ALFABETİK (Türkçe)
                    //   1) İşe gelenler      (giriş basmış veya durumu G/FM/EM/FG/FGM)
                    //   2) Devamsızlar       (D)
                    //   3) Haftalık izinliler (Hİ)
                    //   4) Diğer izinliler   (Yİ / Bİ / Üİ / R / İB)
                    //   5) Durumu belirsizler (en sonda)
                    // ==================================================================
                    // ==================================================================
                    // YENİ ÜST SEVİYE KURAL: ÖNCE MAVİ YAKA, SONRA BEYAZ YAKA
                    // Kullanıcı kuralı: "Beyaz yaka mavi yakanın altında sıralansın."
                    // Bu yüzden sıralamanın ilk kriteri artık YAKA'dır; yakalar
                    // birbirine karışmaz, tablo iki net bölüme ayrılır.
                    // ==================================================================
                    .sort((a, b) => {
                      // 0) YAKA: Mavi Yaka = 0 (üstte), Beyaz Yaka = 1 (altta)
                      const yakaNo = (satir) => satir.collarType === 'Mavi Yaka' ? 0 : 1;
                      const yakaFark = yakaNo(a) - yakaNo(b);
                      if (yakaFark !== 0) return yakaFark;

                      const grupNo = (satir) => {
                        const kod = satirDurumKodu(satir);
                        if (satir.giris) return 1;
                        if (['G', 'FM', 'EM', 'FG', 'FGM'].includes(kod)) return 1;
                        if (kod === 'D') return 2;
                        if (kod === 'Hİ') return 3;
                        if (['Yİ', 'Bİ', 'Üİ', 'R', 'İB'].includes(kod)) return 4;
                        return 5;
                      };
                      const fark = grupNo(a) - grupNo(b);
                      if (fark !== 0) return fark;
                      // GELENLER grubunda kümeleme yakaya göre FARKLI çalışır:
                      //  • MAVİ YAKA  -> ARACA göre (aynı ekip alt alta), araçsızlar sona
                      //  • BEYAZ YAKA -> POZİSYONA göre (aynı pozisyon alt alta), alfabetik
                      // Kullanıcı kuralı: beyaz yakada araç yok, gruplama pozisyonla yapılır.
                      if (grupNo(a) === 1) {
                        if (yakaNo(a) === 0) {
                          const pa = personelAraci(a.personnelId, a.dateStr).plakalar[0] || 'zzz_aracsiz';
                          const pb = personelAraci(b.personnelId, b.dateStr).plakalar[0] || 'zzz_aracsiz';
                          const plakaFark = pa.localeCompare(pb, 'tr');
                          if (plakaFark !== 0) return plakaFark;
                        } else {
                          const poza = (a.position || 'zzz_pozisyonsuz');
                          const pozb = (b.position || 'zzz_pozisyonsuz');
                          const pozFark = poza.localeCompare(pozb, 'tr'); // Pozisyonlar Türkçe alfabetik
                          if (pozFark !== 0) return pozFark;
                        }
                      }
                      // Aynı blok içinde: Türkçe alfabetik isim sırası
                      const ad = (a.personnelName || '').localeCompare(b.personnelName || '', 'tr');
                      return ad !== 0 ? ad : (b.dateStr || '').localeCompare(a.dateStr || '');
                    });

                  // ====================================================================
                  // BLOK AYIRICI: Her ekip (araç) ve her durum grubu arasına kalın
                  // ayırıcı satır konur; blok başlığında araç plakası / durum yazar.
                  // ====================================================================
                  // ==================================================================
                  // DEĞİŞTİ: Blok anahtarına YAKA ön eki eklendi.
                  // Sebep: Aynı durum kodu iki yakada da geçebiliyor (ör. her iki
                  // yakada "Devamsızlık"). Ön ek olmadan mavi yakanın devamsızlık
                  // bloğu ile beyaz yakanın devamsızlık bloğu tek blok sayılıyor ve
                  // araya ayırıcı başlık girmiyordu.
                  // Beyaz yakada gelenler ARAÇ yerine POZİSYONA göre bloklanır.
                  // ==================================================================
                  const blokAnahtari = (g) => {
                    const beyaz = g.collarType !== 'Mavi Yaka';
                    const on = beyaz ? 'beyaz' : 'mavi'; // Yaka ön eki
                    const kod = satirDurumKodu(g);
                    if (g.giris || ['G', 'FM', 'EM', 'FG', 'FGM'].includes(kod)) {
                      if (beyaz) {
                        // BEYAZ YAKA: blok = pozisyon (Operasyon, Muhasebe, Satış Personeli...)
                        return `${on}|pozisyon:${g.position || ''}`;
                      }
                      const plaka = personelAraci(g.personnelId, g.dateStr).plakalar[0];
                      return plaka ? `${on}|arac:${plaka}` : `${on}|arac:yok`;
                    }
                    if (kod === 'D') return `${on}|durum:D`;
                    if (kod === 'Hİ') return `${on}|durum:Hİ`;
                    if (['Yİ', 'Bİ', 'Üİ', 'R', 'İB'].includes(kod)) return `${on}|durum:izin`;
                    return `${on}|durum:bos`;
                  };
                  const blokBasligi = (tamAnahtar) => {
                    const [on, anahtar] = String(tamAnahtar).split('|');
                    const beyaz = on === 'beyaz';
                    // BEYAZ YAKA etiketlerinin başına "BEYAZ YAKA •" konur ki
                    // tabloda hangi bölümde olduğunuz bir bakışta anlaşılsın.
                    const onEk = beyaz ? 'BEYAZ YAKA • ' : '';

                    if (anahtar.startsWith('pozisyon:')) {
                      const poz = anahtar.slice(9);
                      // Pozisyon rozeti, o pozisyona atanan SABİT renkle boyanır
                      return poz
                        ? { metin: `${onEk}${poz.toLocaleUpperCase('tr-TR')}`, stil: pozisyonRengi(poz).rozet }
                        : { metin: `${onEk}POZİSYON GİRİLMEMİŞ`, stil: 'bg-neutral-100 text-neutral-600' };
                    }
                    if (anahtar.startsWith('arac:')) {
                      const plaka = anahtar.slice(5);
                      return plaka === 'yok'
                        ? { metin: 'İŞE GİTTİ — ARAÇ ATANMAMIŞ', stil: 'bg-neutral-100 text-neutral-600' }
                        : { metin: `EKİP — ${plaka}`, stil: aracRengi(plaka).rozet };
                    }
                    if (anahtar === 'durum:D') return { metin: `${onEk}DEVAMSIZLIK`, stil: 'bg-red-100 text-red-700' };
                    if (anahtar === 'durum:Hİ') return { metin: `${onEk}HAFTALIK İZİN`, stil: 'bg-blue-100 text-blue-700' };
                    if (anahtar === 'durum:izin') return { metin: `${onEk}DİĞER İZİNLER (Yıllık / Bayram / Ücretsiz / Raporlu)`, stil: 'bg-purple-100 text-purple-700' };
                    return { metin: `${onEk}DURUMU GİRİLMEMİŞ`, stil: 'bg-neutral-100 text-neutral-500' };
                  };
                  let oncekiBlok = null;

                  if (gorunenler.length === 0) {
                    return <tr><td colSpan={8} className="py-8 text-center text-xs font-bold text-neutral-400">Bu tarihte kayıt bulunamadı.</td></tr>;
                  }

                  // 4) Giriş/Çıkış hücresi: saat + yöntem ikonu + konum bağlantısı
                  const SaatHucresi = ({ kayit, renk, etiket, grup, tip }) => {
                    // KAYIT YOK: personel basmayı unuttuysa yönetici saati ELLE girebilir.
                    // Buton bir kez kullanılır; kaydedildikten sonra "Elle eklendi" yazar.
                    if (!kayit) {
                      return (
                        <div className="flex items-center gap-1.5">
                          {/* BASILMAMIŞ: yanıp sönen kırmızı ünlem (eski "—" yerine) */}
                          <span className="flex items-center gap-1 text-red-600 animate-pulse" title={`${etiket} basılmamış`}>
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[10px] font-black">Basılmadı</span>
                          </span>
                          <button
                            onClick={() => setSaatDuzenle({
                              kayit: null,                 // Mevcut kayıt yok -> yenisi oluşturulacak
                              etiket,
                              saat: '',
                              yeniKayit: { grup, tip }     // Hangi personel/gün/tip için ekleneceği
                            })}
                            className="p-0.5 rounded text-neutral-300 hover:text-blue-600 hover:bg-blue-50 transition"
                            title={`${etiket} saatini elle gir (personel basmayı unuttuysa)`}
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }
                    const kilitli = kayit.saatDuzenlendi === true; // Bir kez düzenlenmiş
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-xs font-black flex items-center gap-1.5 whitespace-nowrap ${renk}`}>
                          {/* Yöntem ikonu: kamerayla mı okutmuş, seri kodu elle mi girmiş */}
                          {kayit.method === 'manuel'
                            ? <Keyboard className="w-3.5 h-3.5 text-amber-600" title="Seri kodu elle girdi" />
                            : <Camera className="w-3.5 h-3.5 text-emerald-600" title="Kamerayla QR okuttu" />}
                          {kayit.timeStr}
                          {/* ==================================================
                              YENİ: ERTESİ GÜN ROZETİ
                              Çıkış saati girişten küçükse iş gece yarısını
                              aşmıştır. "04:00" tek başına yanıltıcı olduğu
                              için yanına +1 rozeti konur; böylece tabloya
                              bakan yönetici 20 saatlik mesaiyi görür.
                              ================================================== */}
                          {(() => {
                            if (tip !== 'cikis') return null;
                            // grup nesnesi hem girişi hem çıkışı taşır (g.giris / g.cikis)
                            const girisSaat = grup?.giris?.timeStr;
                            if (!girisSaat || !kayit.timeStr) return null;
                            const dk = (t) => { const [h2, m2] = String(t).split(':').map(Number); return (h2 || 0) * 60 + (m2 || 0); };
                            if (dk(kayit.timeStr) >= dk(girisSaat)) return null;
                            return <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded" title="Mesai gece yarısını aştı — çıkış ertesi gün">+1 GÜN</span>;
                          })()}
                          {/* SAAT DÜZENLEME: yalnızca bir kez yapılabilir */}
                          {kilitli ? null : (
                            <button
                              onClick={() => setSaatDuzenle({ kayit, etiket, saat: kayit.timeStr })}
                              className="p-0.5 rounded text-neutral-300 hover:text-blue-600 hover:bg-blue-50 transition"
                              title={`${etiket} saatini düzenle (yalnızca bir kez)`}
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                        {/* Düzenlenmişse bilgi satırı: eski saat ve düzenleyen ipucuyla */}
                        {kilitli && (
                          <span className={`text-[9px] font-black flex items-center gap-0.5 whitespace-nowrap cursor-help ${kayit.elleEklendi ? 'text-amber-600' : 'text-neutral-400'}`}
                                title={kayit.elleEklendi
                                  ? `QR/kod basılmamış, saat elle eklendi • Ekleyen: ${kayit.saatDuzenleyen || '-'} • ${kayit.saatDuzenlemeTarihi || ''}`
                                  : `Eski saat: ${kayit.eskiSaat || '-'} • Düzenleyen: ${kayit.saatDuzenleyen || '-'} • ${kayit.saatDuzenlemeTarihi || ''}`}>
                            <CheckCircle className={`w-2.5 h-2.5 ${kayit.elleEklendi ? 'text-amber-500' : 'text-green-600'}`} /> {kayit.elleEklendi ? 'Elle eklendi' : 'Düzenlendi'}
                          </span>
                        )}
                        {/* Konum: varsa haritada açılır, yoksa uyarı */}
                        {kayit.lat
                          ? <button onClick={() => setHaritaKaydi(kayit)} className="text-[9px] font-black text-emerald-700 flex items-center gap-0.5 hover:underline whitespace-nowrap"><MapPin className="w-2.5 h-2.5" /> Haritada Gör</button>
                          : <span className="text-[9px] font-bold text-neutral-300 whitespace-nowrap">Konumsuz</span>}
                      </div>
                    );
                  };

                  return gorunenler.map(g => {
                    const buBlok = blokAnahtari(g);
                    const yeniBlok = buBlok !== oncekiBlok;
                    oncekiBlok = buBlok;
                    const baslik = yeniBlok ? blokBasligi(buBlok) : null;
                    return (
                    <React.Fragment key={g.anahtar}>
                    {/* BLOK BAŞLIĞI: yeni ekip/durum bloğu başlıyorsa ayırıcı satır */}
                    {yeniBlok && (
                      <tr>
                        <td colSpan={9} className="pt-4 pb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full whitespace-nowrap ${baslik.stil}`}>{baslik.metin}</span>
                            <div className="flex-1 h-px bg-neutral-300"></div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* Hiç QR/kod girişi olmayan satırlar hafif kırmızı zeminle işaretlenir */}
                    <tr className={`border-b border-neutral-100 transition ${g.kayitYok ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-neutral-50'}`}>
                      {/* PERSONEL: isme tıklanınca personel profiline gidilir */}
                      <td className="py-2.5 pr-3">
                        <button
                          onClick={() => onViewProfile && onViewProfile(g.personnelId)}
                          disabled={!onViewProfile}
                          className="text-left group"
                          title="Personel profilini aç"
                        >
                          {/* ============================================================
                              İSİM RENGİ — YAKAYA GÖRE FARKLI KAYNAK
                              • MAVİ YAKA : gittiği ARACIN rengi (aynı ekip aynı renk)
                              • BEYAZ YAKA: POZİSYONUN rengi (aynı pozisyon aynı renk)
                              Kullanıcı kuralı: "Pozisyon içinde renklendirme yapalım."
                              ============================================================ */}
                          {(() => {
                            const beyaz = g.collarType !== 'Mavi Yaka';
                            if (beyaz) {
                              const renk = g.position ? pozisyonRengi(g.position).yazi : 'text-black';
                              return <span className={`text-xs font-black ${renk} group-hover:underline transition`}>{g.personnelName}</span>;
                            }
                            const pl = personelAraci(g.personnelId, g.dateStr).plakalar[0];
                            const renk = pl ? aracRengi(pl).yazi : 'text-black';
                            return <span className={`text-xs font-black ${renk} group-hover:underline transition`}>{g.personnelName}</span>;
                          })()}
                          <p className="text-[9px] font-bold text-neutral-400">{g.position}</p>
                        </button>
                      </td>
                      <td className="py-2.5 pr-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${g.collarType === 'Mavi Yaka' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-200 text-neutral-700'}`}>{g.collarType}</span></td>
                      <td className="py-2.5 pr-3 text-xs font-bold whitespace-nowrap">{g.dateStr?.split('-').reverse().join('.')}</td>
                      {/* GİRİŞ ve ÇIKIŞ ayrı sütunlar — basılmayan taraf boş kalır */}
                      {/* YENİ (kullanıcı talebi): Giriş basılmamış ama çıkış basılmışsa
                          bu bir "şehir dışı görevden dönüş" kaydıdır. Giriş hücresinde
                          kırmızı "Basılmadı" uyarısı yerine amber bilgi rozeti gösterilir;
                          sistem o güne otomatik 1 Fazla Gün (FG) verir. */}
                      <td className="py-2.5 pr-3">
                        {!g.giris && g.cikis ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-800"
                            title="Giriş basılmamış, çıkış basılmış — şehir dışı görevden dönüş sayıldı, 1 Fazla Gün (FG) eklendi">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black">ŞEHİR DIŞI DÖNÜŞÜ • +1 FG</span>
                          </span>
                        ) : (
                          <SaatHucresi kayit={g.giris} renk="text-green-700" etiket="Giriş" grup={g} tip="giris" />
                        )}
                      </td>
                      <td className="py-2.5 pr-3"><SaatHucresi kayit={g.cikis} renk="text-red-700" etiket="Çıkış" grup={g} tip="cikis" /></td>
                      {/* MESAİ DURUMU — muhasebedeki günlük durum, tam adıyla */}
                      <td className="py-2.5 pr-3">
                        {(() => {
                          const pd = puantajDurumu(g);
                          const on = oneriDurumu(g);
                          // Elle düzenlenmiş -> kilitli
                          if (pd && pd.manual) {
                            const st = durumStili(pd.status);
                            // "Geldi" olarak kaydedilmiş ama SAAT girilmişse bu aslında
                            // fazla mesaidir; mavi "Fazla Mesai" olarak gösterilir.
                            const fazlaGibi = pd.status === 'G' && parseFloat(String(pd.hours).replace(',', '.')) > 0;
                            const etiketMetni = fazlaGibi ? 'Fazla Mesai' : st.label;
                            const etiketRenk = fazlaGibi ? 'bg-blue-100 text-blue-700' : st.color;
                            return (
                              // YENİ (kullanıcı talebi): Operasyon sorumlusu ekip mesailerini onayladıktan
                              // sonra İK burada "2. doğrulamayı" yapıyor. Bu yüzden "Düzenleme yapıldı"
                              // rozeti artık KİLİT değil — yanına Edit butonu eklendi ki İK, mevcut manuel
                              // kaydı tekrar açıp değiştirebilsin. durumKaydet() zaten aynı kaydın üzerine
                              // yazabildiği (manual:true olarak tekrar işaretlediği) için ek bir Firestore
                              // değişikliği gerekmedi; sadece bu buton eklenerek erişim açıldı.
                              <div className="flex items-center gap-1.5 min-w-[120px]">
                                <div className="flex flex-col gap-0.5">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full w-fit whitespace-nowrap ${etiketRenk}`}>{etiketMetni}{pd.hours ? ` • ${pd.hours} sa` : ''}</span>
                                  <span className="text-[9px] font-black text-neutral-400 flex items-center gap-1 whitespace-nowrap"><CheckCircle className="w-2.5 h-2.5 text-green-600" /> Düzenleme yapıldı</span>
                                </div>
                                <button
                                  onClick={() => setDurumDuzenle({ kayit: g, status: pd.status || 'G', hours: pd.hours || '' })}
                                  className="p-1 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition shrink-0"
                                  title="Mesai durumunu tekrar düzenle (İK 2. doğrulama)"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          }
                          const gosterilen = pd || on;
                          const st = gosterilen ? durumStili(gosterilen.status) : null;
                          // ================================================================
                          // YENİ (kullanıcı talebi bağlamında eklendi): "ÖNERİ FARKLI" ROZETİ
                          // ----------------------------------------------------------------
                          // Puantaj (muhasebe) kaydı her zaman YETKİLİ kaynaktır ve öneri
                          // onu ASLA ezmez. Ancak daha önce OTOMATİK yazılmış (manual:false)
                          // bir kod, hafta tamamlandıktan sonra güncellenen öneriden farklı
                          // olabilir — tipik örnek: Pazar günü 'G' yazılmışken hafta 7 güne
                          // tamamlandığı için önerinin artık 'FG' (Fazla Gün) olması.
                          // Bu durumda kullanıcı ekranda hâlâ "Geldi" görüp düzeltmenin
                          // çalışmadığını sanıyordu. Artık fark küçük bir rozetle belirtilir;
                          // "Önerileri Puantaja İşle" düğmesi bu kaydı günceller
                          // (elle düzenlenmiş / izin kodlu kayıtlara dokunmaz).
                          // ================================================================
                          const oneriFarkli = pd && !pd.manual && on && on.status && on.status !== pd.status;
                          return (
                            <div className="flex items-center gap-1.5 min-w-[120px]">
                              {st ? (() => {
                                // Saat girilmiş "Geldi" kaydı = fazla mesai (mavi)
                                const fazlaGibi = gosterilen.status === 'G' && parseFloat(String(gosterilen.hours).replace(',', '.')) > 0;
                                return (
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${fazlaGibi ? 'bg-blue-100 text-blue-700' : st.color}`} title={on?.aciklama || ''}>
                                    {fazlaGibi ? 'Fazla Mesai' : st.label}{gosterilen.hours ? ` • ${gosterilen.hours} sa` : ''}
                                  </span>
                                );
                              })() : <span className="text-[10px] font-bold text-neutral-300 whitespace-nowrap">Girilmemiş</span>}
                              {!pd && on && <span className="text-[8px] font-black text-blue-500 whitespace-nowrap" title="Henüz muhasebeye yazılmadı, QR'a göre önerilen durum">ÖNERİ</span>}
                              {oneriFarkli && (
                                <span className="text-[8px] font-black text-amber-600 whitespace-nowrap"
                                      title={`Muhasebede "${durumStili(pd.status).label}" yazılı, ancak güncel öneri "${durumStili(on.status).label}". Güncellemek için "Önerileri Puantaja İşle" düğmesini kullanın.\n${on.aciklama || ''}`}>
                                  ÖNERİ: {durumStili(on.status).label}
                                </span>
                              )}
                              <button
                                onClick={() => setDurumDuzenle({ kayit: g, status: gosterilen?.status || 'G', hours: gosterilen?.hours || '' })}
                                className="p-1 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition shrink-0"
                                title="Mesai durumunu düzenle (muhasebeye yazılır)"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      {/* CİHAZ: giriş kaydı yoksa çıkışın cihazı gösterilir */}
                      <td className="py-2.5 pr-3 text-xs font-bold text-neutral-500 whitespace-nowrap">
                        {g.giris?.cihaz || g.cikis?.cihaz || (g.kayitYok ? <span className="text-[10px] font-black text-red-400">Okutmadı</span> : '-')}
                      </td>
                      {/* İŞE GİTTİ / ARAÇ: plaka, ekip rengiyle */}
                      <td className="py-2.5 pr-3">
                        {(() => {
                          // ============================================================
                          // YENİ: BEYAZ YAKADA BU SÜTUNDA POZİSYON YAZAR
                          // Kullanıcı kuralı: "İşe Gitti / Araç sütununda onlarda
                          // pozisyonları yazsın." Beyaz yaka sahaya araçla çıkmadığı
                          // için plaka yerine pozisyon rozeti gösterilir; rozet rengi
                          // pozisyonun sabit rengidir.
                          // ============================================================
                          if (g.collarType !== 'Mavi Yaka') {
                            if (!g.position) {
                              return <span className="text-[10px] font-bold text-neutral-300 whitespace-nowrap">Pozisyon girilmemiş</span>;
                            }
                            return (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border whitespace-nowrap inline-flex items-center gap-1 ${pozisyonRengi(g.position).rozet}`}
                                    title={`${g.personnelName} — ${g.position} (Beyaz Yaka)`}>
                                <Briefcase className="w-3 h-3" /> {g.position}
                              </span>
                            );
                          }
                          const bilgi = personelAraci(g.personnelId, g.dateStr);
                          if (bilgi.plakalar.length === 0) {
                            return <span className="text-[10px] font-bold text-neutral-300 whitespace-nowrap">İşe gitmedi</span>;
                          }
                          const ipucu = bilgi.isler.map(is =>
                            `${is.assignedVehiclePlate || 'Araçsız'} — ${is.customerName || 'İş'}${bilgi.ekip.length ? ` (ekip: ${bilgi.ekip.join(', ')})` : ''}`
                          ).join('  |  ');
                          return (
                            <div className="flex flex-wrap gap-1 cursor-help" title={ipucu}>
                              {bilgi.plakalar.map(pl => (
                                <span key={pl} className={`text-[10px] font-black px-2 py-0.5 rounded-lg border whitespace-nowrap flex items-center gap-1 ${aracRengi(pl).rozet}`}>
                                  <Truck className="w-3 h-3" /> {pl}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                    </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3) QR YÖNETİMİ — 10 QR, aktif seçimi, yenileme, PDF indirme */}
      {sekme === 'qr' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-xs font-bold text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Aşağıdaki 5 koddan yalnızca <b>AKTİF</b> olan geçerlidir. Ofis girişine astığınız kodu değiştirmek isterseniz başka bir kodu "Aktif Yap" ile seçin ve yeni çıktısını asın. Her kodun altındaki seri numara, kamerası bozuk personelin elle gireceği koddur.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {(ayarlar?.qrList || []).map(q => {
              const aktif = (aktifIdler || []).includes(q.id);
              return (
                <div key={q.id} className={`bg-white rounded-2xl border-2 p-4 flex flex-col items-center gap-3 transition ${aktif ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-neutral-200'}`}>
                  <div className="w-full flex justify-between items-center">
                    <h4 className="font-black text-sm">{q.ad}</h4>
                    {aktif ? <span className="text-[9px] font-black bg-emerald-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> AKTİF</span> : <span className="text-[9px] font-black bg-neutral-100 text-neutral-400 px-2.5 py-1 rounded-full">PASİF</span>}
                  </div>
                  <QrGorsel deger={q.manuelKod} />
                  {/* Seri numara: elle giriş için */}
                  <p className="text-sm font-black tracking-[0.2em] border-2 border-dashed border-neutral-300 rounded-lg px-3 py-1.5">{q.manuelKod}</p>
                  {/* NOT: Eski "15 haneli kod: ... • tarih" satırı kullanıcı isteğiyle
                      TAMAMEN kaldırıldı. Kartta yalnızca QR karekod ve altındaki
                      seri kod (elle giriş kodu) gösterilir. */}
                  <div className="w-full grid grid-cols-3 gap-1.5">
                    {/* AÇ/KAPA: aktifse "Pasif Yap", değilse "Aktif Yap" */}
                    <button onClick={() => qrAktifDegistir(q.id)} className={`py-2 rounded-lg text-[10px] font-black transition ${aktif ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{aktif ? 'Pasif Yap' : 'Aktif Yap'}</button>
                    <button onClick={() => qrPdfIndir(q)} className="py-2 rounded-lg text-[10px] font-black bg-black text-white hover:bg-neutral-800 flex items-center justify-center gap-1"><Download className="w-3 h-3" /> PDF İndir</button>
                    <button onClick={() => qrYenile(q.id)} className="py-2 rounded-lg text-[10px] font-black bg-neutral-100 text-neutral-600 hover:bg-neutral-200 flex items-center justify-center gap-1"><RefreshCw className="w-3 h-3" /> Yenile</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4) RAPORLAMA — aylık kişi bazlı özet */}
      {sekme === 'rapor' && (() => {
        // ======================================================================
        // YENİ (kullanıcı talebi): Sıralanabilir başlıklar + yaka ayrımı.
        // "Toplam Saat"e tıklayınca en çok mesai yapan en üstte; tekrar
        // tıklayınca ters sıralanır. "Beyaz / Mavi ayrı" görünümünde iki blok
        // ayrı ayrı, her biri kendi içinde sıralı listelenir.
        // ======================================================================
        const okIsareti = (kolon) => raporSirala === kolon ? (raporYon === 'desc' ? ' ↓' : ' ↑') : '';
        // Tekrar eden satır çizimi (tek yerden)
        const raporSatiri = (r, sira) => (
          <tr key={r.ad} className="border-b border-neutral-100 hover:bg-neutral-50">
            <td className="py-2.5 pr-3 text-xs font-black">
              {/* Sıra rozeti: ilk 3 madalya renginde (en çok mesai yapan öne çıksın) */}
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] mr-1.5 ${sira === 1 ? 'bg-amber-400 text-white' : sira === 2 ? 'bg-neutral-300 text-neutral-700' : sira === 3 ? 'bg-orange-300 text-white' : 'bg-neutral-100 text-neutral-400'}`}>{sira}</span>
              {r.ad}
            </td>
            <td className="py-2.5 pr-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${r.yaka === 'Mavi Yaka' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-200 text-neutral-700'}`}>{r.yaka || '—'}</span></td>
            <td className="py-2.5 pr-3 text-xs font-black">{r.gunSayisi} gün</td>
            <td className="py-2.5 pr-3 text-xs font-black text-emerald-700">{r.toplamSaat} saat</td>
            <td className="py-2.5 pr-3 text-xs font-bold">{r.ortGiris}</td>
            <td className="py-2.5 pr-3 text-xs font-bold text-emerald-700"><span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> {r.kamera}</span></td>
            <td className="py-2.5 pr-3 text-xs font-bold text-amber-700"><span className="flex items-center gap-1"><Keyboard className="w-3.5 h-3.5" /> {r.manuel}</span></td>
          </tr>
        );
        // Tıklanabilir başlık satırı (tekrar kullanılabilir)
        const baslikSatiri = (
          <tr className="text-[10px] font-black text-neutral-400 uppercase border-b border-neutral-200 select-none">
            <th className="py-2 pr-3 cursor-pointer hover:text-neutral-700" onClick={() => raporBasligaTikla('ad')}>Personel{okIsareti('ad')}</th>
            <th className="py-2 pr-3">Yaka</th>
            <th className="py-2 pr-3 cursor-pointer hover:text-neutral-700" onClick={() => raporBasligaTikla('gun')}>Mesai Günü{okIsareti('gun')}</th>
            <th className="py-2 pr-3 cursor-pointer hover:text-emerald-700 text-emerald-600" onClick={() => raporBasligaTikla('saat')} title="En çok mesai yapanı sıralamak için tıklayın">Toplam Saat{okIsareti('saat')}</th>
            <th className="py-2 pr-3">Ort. Giriş</th><th className="py-2 pr-3">Kamera</th><th className="py-2 pr-3">Elle Giriş</th>
          </tr>
        );
        const blokTablo = (liste) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>{baslikSatiri}</thead>
              <tbody>
                {liste.length === 0
                  ? <tr><td colSpan={7} className="py-8 text-center text-xs font-bold text-neutral-400">Bu ay için kayıt yok.</td></tr>
                  : liste.map((r, i) => raporSatiri(r, i + 1))}
              </tbody>
            </table>
          </div>
        );
        return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-xs font-black text-neutral-500 flex items-center gap-2"><Calendar className="w-4 h-4" /> Rapor Ayı:</label>
            <input type="month" value={raporAy} onChange={e => setRaporAy(e.target.value)} className="p-2.5 border border-neutral-300 rounded-xl text-xs font-black" />
            {/* YENİ: Yaka görünümü seçici */}
            <div className="flex items-center gap-1 ml-auto bg-neutral-100 rounded-xl p-1">
              {[
                { id: 'ayrik', ad: 'Beyaz / Mavi Ayrı' },
                { id: 'hepsi', ad: 'Hepsi' },
                { id: 'beyaz', ad: 'Beyaz Yaka' },
                { id: 'mavi', ad: 'Mavi Yaka' },
              ].map(o => (
                <button key={o.id} onClick={() => setRaporYaka(o.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition ${raporYaka === o.id ? 'bg-white shadow text-neutral-800' : 'text-neutral-500 hover:text-neutral-700'}`}>{o.ad}</button>
              ))}
            </div>
          </div>

          {/* En çok mesai yapan kişi vurgusu (sıralama saate göreyken) */}
          {raporSirala === 'saat' && raporYon === 'desc' && raporSirala_fn.length > 0 && (
            <div className="mb-3 text-[11px] font-bold text-neutral-500">
              🏆 Bu ay en çok mesai yapan: <span className="text-emerald-700 font-black">{raporSirala_fn[0].ad}</span> — {raporSirala_fn[0].toplamSaat} saat
            </div>
          )}

          {raporYaka === 'ayrik' ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-black text-neutral-700 mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-neutral-400"></span> Beyaz Yaka <span className="text-neutral-400 font-bold">({raporBeyaz.length} kişi)</span></h4>
                {blokTablo(raporBeyaz)}
              </div>
              <div>
                <h4 className="text-xs font-black text-blue-700 mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Mavi Yaka <span className="text-neutral-400 font-bold">({raporMavi.length} kişi)</span></h4>
                {blokTablo(raporMavi)}
              </div>
            </div>
          ) : (
            blokTablo(raporYaka === 'beyaz' ? raporBeyaz : raporYaka === 'mavi' ? raporMavi : raporSirala_fn)
          )}
        </div>
        );
      })()}

      {/* Ortak modallar */}
      {/* YENİ: MESAİ DURUMU DÜZENLEME MODALI
          Buradan yapılan değişiklik doğrudan Personel Muhasebe'nin kullandığı
          puantaj koleksiyonuna yazılır ve manual:true ile kilitlenir. */}
      {durumDuzenle && (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4" onClick={() => setDurumDuzenle(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black flex items-center gap-2"><Edit className="w-5 h-5" /> Mesai Durumu Düzenle</h3>
                <p className="text-xs font-bold opacity-90">{durumDuzenle.kayit?.personnelName} • {durumDuzenle.kayit?.dateStr?.split('-').reverse().join('.')}</p>
              </div>
              <button onClick={() => setDurumDuzenle(null)} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-3">
              {/* QR'dan gelen bilgi ve öneri gerekçesi */}
              {(() => {
                const on = oneriDurumu(durumDuzenle.kayit);
                if (!on) return null;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] font-bold text-blue-800 space-y-1">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1"><QrCode className="w-3 h-3" /> Giriş: <b>{on.girisSaati || '—'}</b></span>
                      <span>Çıkış: <b>{on.cikisSaati || '—'}</b></span>
                      {on.ekipCikis && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Ekip çıkışı: <b>{on.ekipCikis}</b></span>}
                    </div>
                    <p className="opacity-90">{on.aciklama}</p>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-black text-neutral-600 uppercase mb-1.5">Mesai Durumu</label>
                <select
                  value={durumDuzenle.status}
                  onChange={e => setDurumDuzenle({ ...durumDuzenle, status: e.target.value })}
                  className="w-full p-3 border-2 border-neutral-300 rounded-xl font-bold text-sm bg-white cursor-pointer focus:border-blue-600 outline-none"
                >
                  {MESAI_STATUS_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code} - {o.label}</option>)}
                </select>
              </div>

              {/* Saat alanı yalnızca saat gerektiren durumlarda görünür */}
              {(durumDuzenle.status === 'FM' || durumDuzenle.status === 'EM' || durumDuzenle.status === 'FGM') && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-black text-neutral-600 uppercase mb-1.5">Saat (yarım saatlik: 0,5 / 1 / 1,5 ...)</label>
                  <input
                    type="number" step="0.5" min="0"
                    value={String(durumDuzenle.hours || '').replace(',', '.')}
                    onChange={e => setDurumDuzenle({ ...durumDuzenle, hours: e.target.value.replace('.', ',') })}
                    className="w-full p-3 border-2 border-neutral-300 rounded-xl font-black text-center text-lg focus:border-blue-600 outline-none"
                    placeholder="Örn: 1,5"
                  />
                </div>
              )}

              <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Bu kayıt Personel Muhasebe puantajına yazılacak ve KİLİTLENECEK. Kaydettikten sonra bu sütundan tekrar düzenlenemez; değişiklik gerekirse Personel Muhasebe &gt; Mavi Yaka Mesai tablosundan yapılır.
              </p>

              <div className="flex gap-2">
                <button onClick={() => setDurumDuzenle(null)} className="flex-1 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-black text-sm hover:bg-neutral-200">Vazgeç</button>
                {/* DÜZELTME ("Cannot read properties of null (reading 'kayit')"):
                    Bu buton yanlışlıkla SAAT düzenleme modalının state'ini
                    (saatDuzenle) okuyordu; o pencere kapalıyken değeri null
                    olduğu için düzenle butonuna basınca uygulama çöküyordu.
                    Metin artık sabit ve doğru state'e bağlı. */}
                <button onClick={durumKaydet} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg">
                  <Save className="w-4 h-4" /> Kaydet ve Kilitle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* YENİ: GİRİŞ/ÇIKIŞ SAATİ DÜZENLEME MODALI
          Kayıt silinmez, yalnızca saati düzeltilir. Kaydettikten sonra o saat
          bir daha düzenlenemez ve hücrede "Düzenlendi" yazar. */}
      {saatDuzenle && (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4" onClick={() => setSaatDuzenle(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className={`p-4 text-white flex justify-between items-center bg-gradient-to-r ${saatDuzenle.etiket === 'Giriş' ? 'from-green-600 to-emerald-700' : 'from-red-600 to-rose-700'}`}>
              <div>
                <h3 className="font-black flex items-center gap-2"><Clock className="w-5 h-5" /> {saatDuzenle.etiket} Saatini {saatDuzenle.kayit ? 'Düzenle' : 'Elle Gir'}</h3>
                {/* Kayıt yoksa bilgiler gruptan okunur */}
                <p className="text-xs font-bold opacity-90">
                  {(saatDuzenle.kayit || saatDuzenle.yeniKayit?.grup)?.personnelName} • {(saatDuzenle.kayit || saatDuzenle.yeniKayit?.grup)?.dateStr?.split('-').reverse().join('.')}
                </p>
              </div>
              <button onClick={() => setSaatDuzenle(null)} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-3">
              {saatDuzenle.kayit ? (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-[11px] font-bold text-neutral-600">
                  QR ile basılan saat: <b className="text-black">{saatDuzenle.kayit.timeStr}</b>
                  <span className="block mt-0.5">Yöntem: {saatDuzenle.kayit.method === 'manuel' ? 'Seri kod (elle)' : 'Kamera (QR)'}</span>
                </div>
              ) : (
                /* KAYIT YOK: personel basmayı unutmuş, saat elle ekleniyor */
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] font-bold text-amber-800">
                  Bu personel o gün <b>{saatDuzenle.etiket.toLocaleLowerCase('tr')}</b> için QR okutmamış veya kod girmemiş.
                  <span className="block mt-0.5">Saati elle girdiğinizde kayıt <b>konumsuz</b> oluşturulur ve "Elle eklendi" olarak işaretlenir.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-neutral-600 uppercase mb-1.5">{saatDuzenle.kayit ? 'Yeni' : ''} {saatDuzenle.etiket} Saati</label>
                <input
                  type="time"
                  value={saatDuzenle.saat}
                  onChange={e => setSaatDuzenle({ ...saatDuzenle, saat: e.target.value })}
                  className="w-full p-3 border-2 border-neutral-300 rounded-xl font-black text-center text-xl focus:border-blue-600 outline-none"
                />
              </div>

              <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {saatDuzenle.kayit
                  ? 'Bu saat YALNIZCA BİR KEZ düzenlenebilir. Kaydettikten sonra kilitlenir ve hücrede "Düzenlendi" yazar. Eski saat, düzenleyen kişi ve tarih iz olarak saklanır.'
                  : 'Bu saat YALNIZCA BİR KEZ girilebilir. Kaydettikten sonra kilitlenir ve hücrede "Elle eklendi" yazar. Ekleyen kişi ve tarih iz olarak saklanır.'}
              </p>

              <div className="flex gap-2">
                <button onClick={() => setSaatDuzenle(null)} className="flex-1 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-black text-sm hover:bg-neutral-200">Vazgeç</button>
                <button onClick={saatKaydet} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg">
                  <Save className="w-4 h-4" /> Kaydet ve Kilitle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {haritaKaydi && <MesaiHaritaModal kayit={haritaKaydi} onKapat={() => setHaritaKaydi(null)} />}
    </div>
  );
};
