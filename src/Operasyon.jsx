import React, { useState, useEffect } from 'react';
import { Truck, Calendar, MapPin, Phone, FileText, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Briefcase, Car, Wallet, CheckSquare, GripVertical, Activity, ArrowUpRight, Landmark, CreditCard, DollarSign, ArrowRightLeft, UserPlus, Camera, Edit, Ban, LogOut, Mail, Bell, User, Loader2, MessageSquareText, MessageCircle, Send, Package, History, Save, Search, Key, BarChart, Eye, EyeOff, FolderOpen, Shirt, Smartphone, Award, Zap } from 'lucide-react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, query, getDoc, where } from 'firebase/firestore';
import { db, appId, MESAI_STATUS_OPTIONS, isPersonnelVisibleInMonth, isVideoUrl, MediaCaptureMenu, TUTANAK_TEMPLATES, generateContractPDF, calculateMaterials, getIhbarSuresiBilgisi } from './shared.jsx';
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

  export const AddInfoView = ({ currentUser, personnelList, addSystemLog }) => {
    const [infoType, setInfoType] = useState('Duyuru'); // Duyuru, Paylaşım, En İyiler

    // Form States
    const [announcement, setAnnouncement] = useState({ title: '', content: '' });
    const [post, setPost] = useState({ title: '', imageUrl: '' });
    const [bestEmp, setBestEmp] = useState({ title: 'Ayın En İyi Personeli', employeeName: '' });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // YENİ: Yayınlanan bilgilendirmeleri yönetme (listele / sırala / yayından al / düzenle)
    const [publishedItems, setPublishedItems] = useState([]);
    const [editingInfoItem, setEditingInfoItem] = useState(null);
    useEffect(() => {
      const colName = infoType === 'Duyuru' ? 'announcements' : infoType === 'Paylaşım' ? 'posts' : 'bestEmployees';
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', colName), snap => {
        const items = snap.docs.map(d => ({ ...d.data(), id: d.id }))
          .filter(item => !item.hidden)
          .sort((a, b) => (a.sortOrder ?? a.timestamp ?? 0) - (b.sortOrder ?? b.timestamp ?? 0));
        setPublishedItems(items);
      }, console.error);
      return () => unsub();
    }, [infoType]);

    const infoColName = infoType === 'Duyuru' ? 'announcements' : infoType === 'Paylaşım' ? 'posts' : 'bestEmployees';

    const toggleInfoHidden = async (item) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', infoColName, item.id), { hidden: !item.hidden });
      if (addSystemLog) addSystemLog(item.hidden ? 'Bilgilendirme Yayına Alındı' : 'Bilgilendirme Yayından Alındı', `${infoType}: ${item.title || item.employeeName || ''}`);
    };

    const moveInfoItem = async (index, direction) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= publishedItems.length) return;
      const a = publishedItems[index];
      const b = publishedItems[targetIndex];
      const aOrder = a.sortOrder ?? a.timestamp ?? 0;
      const bOrder = b.sortOrder ?? b.timestamp ?? 0;
      await Promise.all([
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', infoColName, a.id), { sortOrder: bOrder }),
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', infoColName, b.id), { sortOrder: aOrder })
      ]);
    };

    const handleSaveEditInfo = async () => {
      if (!editingInfoItem) return;
      const { id, ...rest } = editingInfoItem;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', infoColName, id), rest);
      if (addSystemLog) addSystemLog('Bilgilendirme Düzenlendi', `${infoType}: ${rest.title || rest.employeeName || ''}`);
      setEditingInfoItem(null);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setIsSubmitting(true);
        setPost(prev => ({ ...prev, imageUrl: 'Yükleniyor...' }));
  
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
          setPost(prev => ({ ...prev, imageUrl: uploadedUrl }));
        } catch (err) {
          console.error("Yükleme hatası:", err);
          alert("Görsel yüklenemedi.");
          setPost(prev => ({ ...prev, imageUrl: '' }));
        }
        setIsSubmitting(false);
      };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const colRef = collection(db, 'artifacts', appId, 'public', 'data', 
                infoType === 'Duyuru' ? 'announcements' : 
                infoType === 'Paylaşım' ? 'posts' : 'bestEmployees'
            );

            const commonData = {
                timestamp: new Date().getTime(),
                dateStr: new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
                author: currentUser.fullName
            };

            if (infoType === 'Duyuru') {
                await addDoc(colRef, { ...announcement, ...commonData });
                setAnnouncement({ title: '', content: '' });
                addSystemLog('Duyuru Eklendi', `Sisteme yeni bir duyuru eklendi: ${announcement.title}`);
            } else if (infoType === 'Paylaşım') {
                await addDoc(colRef, { ...post, ...commonData });
                setPost({ title: '', imageUrl: '' });
                addSystemLog('Paylaşım Eklendi', `Sisteme yeni bir saha paylaşımı eklendi.`);
            } else if (infoType === 'En İyiler') {
                await addDoc(colRef, { ...bestEmp, ...commonData });
                setBestEmp({ title: 'Ayın En İyi Personeli', employeeName: '' });
                addSystemLog('En İyiler Eklendi', `Sisteme ayın en iyi personeli eklendi: ${bestEmp.employeeName}`);
            }

            setSuccessMsg('Bilgilendirme başarıyla yayınlandı!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            console.error("Hata:", error);
            alert("İşlem sırasında bir hata oluştu.");
        }
        setIsSubmitting(false);
    };

    return (
      <>
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
            <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
                <Bell className="w-6 h-6 text-red-600" /> Bilgilendirme Ekle
            </h2>

            <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl mb-6">
                {['Duyuru', 'Paylaşım', 'En İyiler'].map(type => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setInfoType(type)}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${infoType === type ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {successMsg && (
                <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-xl font-bold text-sm border border-green-200 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> {successMsg}
                </div>
            )}

            <div  className="space-y-4">
                {infoType === 'Duyuru' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-black mb-1">Duyuru Başlığı</label>
                            <input required type="text" value={announcement.title} onChange={e => setAnnouncement({...announcement, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: Yeni Araç Filomuz Hakkında" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-1">Duyuru İçeriği</label>
                            <textarea required value={announcement.content} onChange={e => setAnnouncement({...announcement, content: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-32 resize-none transition" placeholder="Tüm personelin göreceği detaylı duyuru metni..."></textarea>
                        </div>
                    </>
                )}

                {infoType === 'Paylaşım' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-black mb-1">Paylaşım Başlığı / Açıklaması</label>
                            <input required type="text" value={post.title} onChange={e => setPost({...post, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: Kadıköy operasyonundan kareler" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-1">Görsel Ekle</label>
                            {post.imageUrl && post.imageUrl !== 'Yükleniyor...' && (
                                <div className="mb-2 w-full max-h-48 overflow-hidden rounded-xl border border-neutral-200">
                                    {isVideoUrl(post.imageUrl) ? (
                                      <video src={post.imageUrl} controls className="w-full h-full object-contain bg-black" />
                                    ) : (
                                      <img src={post.imageUrl} alt="Önizleme" className="w-full h-full object-contain bg-neutral-100" />
                                    )}
                                </div>
                            )}
                            {post.imageUrl === 'Yükleniyor...' && <div className="p-4 text-center font-bold text-neutral-500 animate-pulse bg-neutral-50 rounded-xl border border-neutral-200 mb-2">Görsel Yükleniyor...</div>}
                            <MediaCaptureMenu onChange={handleFileUpload} disabled={isSubmitting} buttonLabel="Fotoğraf / Video Yükle" buttonClassName="cursor-pointer w-full py-4 bg-neutral-50 border border-neutral-300 border-dashed rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-100 transition" />
                        </div>
                    </>
                )}

                {infoType === 'En İyiler' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-black mb-1">Başlık</label>
                            <input required type="text" value={bestEmp.title} onChange={e => setBestEmp({...bestEmp, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: Ayın En İyi Şoförü" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-1">Personel Seçimi</label>
                            <select required value={bestEmp.employeeName} onChange={e => setBestEmp({...bestEmp, employeeName: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                                <option value="">Lütfen personel seçin...</option>
                                {personnelList.map(p => (
                                    <option key={p.id} value={p.fullName}>{p.fullName} - {p.position}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                <button type="button" onClick={handleSubmit} disabled={isSubmitting || post.imageUrl === 'Yükleniyor...'} className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 mt-6">
                    <Send className="w-5 h-5" /> Yayına Al
                </button>
            </div>

            {/* YENİ: Yayınlanan {infoType} Listesi — sıralama, düzenleme, yayından alma */}
            <div className="mt-8 pt-6 border-t border-neutral-200">
              <h3 className="font-bold text-black mb-3">Yayınlanan {infoType} Listesi</h3>
              {publishedItems.length === 0 ? (
                <p className="text-sm text-neutral-500 italic">Henüz yayınlanmış bir {infoType.toLowerCase()} yok.</p>
              ) : (
                <div className="space-y-2">
                  {publishedItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button type="button" disabled={index === 0} onClick={() => moveInfoItem(index, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 transition"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button type="button" disabled={index === publishedItems.length - 1} onClick={() => moveInfoItem(index, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 transition"><ChevronDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-black truncate">{item.title || item.employeeName || 'Başlıksız'}</p>
                        {item.dateStr && <p className="text-[10px] text-neutral-400 font-medium">{item.dateStr}</p>}
                      </div>
                      <button type="button" onClick={() => setEditingInfoItem(item)} className="p-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 transition shrink-0" title="Düzenle"><Edit className="w-4 h-4 text-neutral-600" /></button>
                      <button type="button" onClick={() => toggleInfoHidden(item)} className="p-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 transition shrink-0" title="Yayından Al"><EyeOff className="w-4 h-4 text-neutral-600" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>

        {editingInfoItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingInfoItem(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-black mb-4">Bilgilendirmeyi Düzenle</h3>
              <div className="space-y-3">
                {infoType !== 'En İyiler' ? (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Başlık</label>
                      <input type="text" value={editingInfoItem.title || ''} onChange={e => setEditingInfoItem({ ...editingInfoItem, title: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    {infoType === 'Duyuru' && (
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-1">İçerik</label>
                        <textarea value={editingInfoItem.content || ''} onChange={e => setEditingInfoItem({ ...editingInfoItem, content: e.target.value })} rows={4} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Başlık</label>
                      <input type="text" value={editingInfoItem.title || ''} onChange={e => setEditingInfoItem({ ...editingInfoItem, title: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Personel</label>
                      <select value={editingInfoItem.employeeName || ''} onChange={e => setEditingInfoItem({ ...editingInfoItem, employeeName: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 bg-white">
                        {personnelList.map(p => <option key={p.id} value={p.fullName}>{p.fullName}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setEditingInfoItem(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition">İptal</button>
                <button type="button" onClick={handleSaveEditInfo} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition">Kaydet</button>
              </div>
            </div>
          </div>
        )}
    </>
    );
  };

  export const CurrentJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials, setCancelJobId, setViewingImage, setDeleteJobId }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState(''); // ARAMA STATE'İ EKLENDİ

    const sendAppointmentMessage = (job, method) => {
      let phone = job.customerPhone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '90' + phone.substring(1);
      else if (!phone.startsWith('90')) phone = '90' + phone;

      const msg = `Merhaba ${job.customerName},\n\nBen Sembol Nakliyat operasyon sorumlunuz. ${job.date} saat ${job.time} sularında planlanan işleminiz için ekibimiz ve aracımız hazırlıklarını tamamlamıştır. İşi daha iyi organize edebilmemiz açısından taşıma aracımız için uygun bir park yeri ayarlamanızı rica ederiz.\n\n🔒 *Güvenliğiniz için Teslim Kodunuz:* ${job.deliveryCode || 'Bulunmuyor'}\nEkibimiz geldiğinde eşya teslimi için bu kodu kendilerine iletebilirsiniz.\n\nHerhangi bir sorun durumunda veya talebinizde doğrudan benimle bu numara üzerinden iletişime geçebilirsiniz.\n\nŞimdiden yeni yerinizin hayırlı olmasını dileriz. Süreci sizin için en iyi şekilde tamamlamaya çalışacağız. Görüşmek üzere!`;

      if (method === 'wa') {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      } else if (method === 'sms') {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const separator = isIOS ? '&' : '?';
        window.open(`sms:${phone}${separator}body=${encodeURIComponent(msg)}`, '_self');
      }
    };

    const prevDay = () => {
      const newDate = new Date(viewDate);
      newDate.setDate(viewDate.getDate() - 1);
      setViewDate(newDate);
    };

    const nextDay = () => {
      const newDate = new Date(viewDate);
      newDate.setDate(viewDate.getDate() + 1);
      setViewDate(newDate);
    };

    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const day = String(viewDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const formattedDate = viewDate.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // ARAMA MANTIĞI EKLENDİ (Arama yapılıyorsa tarihi yoksay, global ara)
    const dailyJobs = jobs
      .filter(j => {
        if (j.status === 'cancelled') return false;
        
        if (searchQuery.trim()) {
          return (j.customerName && j.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
                 (j.customerPhone && j.customerPhone.includes(searchQuery));
        }
        
        return j.date === dateStr;
      })
      .sort((a, b) => {
        if (searchQuery.trim()) {
           return new Date(b.date) - new Date(a.date); // Aramada en yeniler üstte görünsün
        }
        const order = { 'Nakliye': 1, 'Depo': 2, 'Asansör': 3 };
        return (order[a.type || 'Nakliye'] || 4) - (order[b.type || 'Nakliye'] || 4);
      });

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <button onClick={prevDay} className="p-4 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl transition"><ChevronLeft className="w-6 h-6" /></button>
            <div className="text-center min-w-[150px]">
              <h2 className="text-xl md:text-2xl font-bold text-black">{formattedDate}</h2>
              <p className="text-sm font-medium text-neutral-500 mt-1">Günlük Operasyonlar Ajandası</p>
            </div>
            <button onClick={nextDay} className="p-4 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl transition"><ChevronRight className="w-6 h-6" /></button>
          </div>
          
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Tüm kayıtlarda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition"
            />
          </div>
        </div>

        <div className="space-y-4">
          {dailyJobs.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-neutral-200 text-center text-neutral-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
              <p className="text-lg font-medium">{searchQuery.trim() ? 'Aramanıza uygun kayıt bulunamadı.' : 'Bu tarihe kayıtlı herhangi bir aktif operasyon bulunmuyor.'}</p>
            </div>
          ) : (
            dailyJobs.map(job => (
              <div key={job.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${job.status === 'cancelled' ? 'border-red-400 bg-red-50/40' : job.isSpecial ? 'border-yellow-400 ring-2 ring-yellow-100 bg-yellow-50/30' : 'border-neutral-200'} flex flex-col md:flex-row gap-6 justify-between hover:border-red-600 transition group cursor-pointer`}>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-xl text-black flex items-center gap-1.5">
                        {job.isSpecial && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />}
                        {job.customerName}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase tracking-wider ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                        {job.type || 'Nakliye'}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        job.status === 'completed' ? 'bg-black text-white' :
                        job.status === 'in-progress' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' :
                        job.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : job.status === 'cancelled' ? 'İptal Edildi' : 'Bekliyor'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {job.price && (
                        <div className="text-right leading-none bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 shadow-sm">
                          <span className="block text-lg font-black text-green-700">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                          {job.deposit && <span className="block text-[10px] font-bold text-green-600 mt-1">Kapora: ₺{parseInt(job.deposit).toLocaleString('tr-TR')}</span>}
                        </div>
                      )}
                      {job.createdBy && (
                        <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200" title={`Kayıt Eden: ${job.createdBy}`}>
                          <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 text-[8px]">
                             {job.createdBy.charAt(0)}
                          </div>
                          <span className="text-[10px] font-bold text-neutral-600">{job.createdBy}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <a href={"tel:" + (job.customerPhone || '').replace(/\D/g, '')} className="flex items-center gap-1.5 text-sm font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-200 transition cursor-pointer"><Phone className="w-4 h-4 text-black" /> {job.customerPhone}</a>
                    
                    {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(job.teamNames || [job.team]).map((name, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-sm font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                            <User className="w-4 h-4" /> {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-bold bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg border border-yellow-100">
                        <User className="w-4 h-4" /> Atanmadı
                      </span>
                    )}
                    
                    {job.time && <span className="flex items-center gap-1.5 text-sm font-bold bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-100"><Clock className="w-4 h-4" /> Saat: {job.time}</span>}
                    <span className="flex items-center gap-1.5 text-sm font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100"><Key className="w-4 h-4" /> Kod: {job.deliveryCode || 'Yok'}</span>
                    {job.assignedVehiclePlate && <span className="flex items-center gap-1.5 text-sm font-bold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100"><Truck className="w-4 h-4" /> Araç: {job.assignedVehiclePlate}</span>}
                  </div>
                  
                  <div className="text-sm text-neutral-600 flex flex-col gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" /> 
                      <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1">
                          <span className="text-black font-bold">{job.extraLoadingAddresses?.length > 0 ? '1. Yükleme:' : 'AL:'} {job.fromProvince}/{job.fromDistrict}</span>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{job.fromRoomCount}</span>
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{job.fromFloor}</span>
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{job.fromTransportMethod}</span>
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{job.fromPacking}</span>
                          </div>
                        </div>
                        <div className="text-xs mt-1">{job.fromAddress}</div>
                        <div className="text-[10px] text-neutral-500 mt-1"><b>Mesafe:</b> {job.fromDistance} {job.fromDistanceUnit}</div>
                      </div>
                    </div>
                    {job.extraLoadingAddresses?.map((addr, idx) => (
                      <div key={addr.id} className="flex items-start gap-2 pt-2 border-t border-neutral-200/60">
                        <MapPin className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" /> 
                        <div className="flex-1">
                          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1">
                            <span className="text-black font-bold">{idx + 2}. Yükleme: {addr.province}/{addr.district}</span>
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{addr.roomCount}</span>
                              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{addr.floor}</span>
                              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{addr.transportMethod}</span>
                              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{addr.packing}</span>
                            </div>
                          </div>
                          <div className="text-xs mt-1">{addr.address}</div>
                          <div className="text-[10px] text-neutral-500 mt-1"><b>Mesafe:</b> {addr.distance} {addr.distanceUnit}</div>
                        </div>
                      </div>
                    ))}
                    
                    {job.toProvince && (
                      <>
                        <div className="w-full h-0.5 bg-neutral-200 my-1"></div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> 
                          <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1">
                              <span className="text-black font-bold">{job.extraUnloadingAddresses?.length > 0 ? '1. Boşaltma:' : 'VR:'} {job.toProvince}/{job.toDistrict}</span>
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{job.toRoomCount}</span>
                                <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{job.toFloor}</span>
                                <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{job.toTransportMethod}</span>
                                <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{job.toPacking}</span>
                              </div>
                            </div>
                            <div className="text-xs mt-1">{job.toAddress}</div>
                            <div className="text-[10px] text-neutral-500 mt-1"><b>Mesafe:</b> {job.toDistance} {job.toDistanceUnit}</div>
                          </div>
                        </div>
                        {job.extraUnloadingAddresses?.map((addr, idx) => (
                      <div key={addr.id} className="flex items-start gap-2 pt-2 border-t border-neutral-200/60">
                        <MapPin className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> 
                        <div className="flex-1">
                          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1">
                            <span className="text-black font-bold">{idx + 2}. Boşaltma: {addr.province}/{addr.district}</span>
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{addr.roomCount}</span>
                              <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{addr.floor}</span>
                              <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{addr.transportMethod}</span>
                              <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100 text-red-700">{addr.packing}</span>
                            </div>
                          </div>
                          <div className="text-xs mt-1">{addr.address}</div>
                          <div className="text-[10px] text-neutral-500 mt-1"><b>Mesafe:</b> {addr.distance} {addr.distanceUnit}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              
              {(job.contractDetails || job.notes) && (
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {job.contractDetails && (
                    <div className="text-xs font-medium bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-200 flex items-start gap-2">
                      <FileText className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" /> 
                      <div><b className="block text-blue-900 mb-0.5">Sözleşme Detayı:</b>{job.contractDetails}</div>
                    </div>
                  )}
                  {job.notes && (
                    <div className="text-xs font-medium bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 flex items-start gap-2 whitespace-pre-wrap">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" /> 
                      <div><b className="block text-yellow-900 mb-0.5">Operasyon Notu:</b>{job.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Tahmini Malzeme Bölümü */}
              {job.type !== 'Asansör' && (
              <div className="mt-4 text-xs font-medium bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 flex flex-col md:flex-row gap-x-3 gap-y-2 md:items-center">
                <div className="flex items-center gap-1.5 shrink-0"><Package className="w-4 h-4 text-amber-600" /> <b className="text-amber-900">Sistem Malzeme Tahmini:</b></div>
                <div className="flex gap-3 flex-wrap flex-1">
                  {(() => {
                    const est = calculateMaterials(job.fromRoomCount, job.fromPacking);
                    return (
                      <>
                        <span><b>{est.strec}</b> Streç</span>
                        <span><b>{est.bant}</b> Bant</span>
                        <span><b>{est.poset}</b> Poşet</span>
                        <span><b>{est.kagit}kg</b> Kağıt</span>
                        <span><b>{est.koli}</b> Koli</span>
                      </>
                    );
                  })()}
                </div>
                {job.materialsDeducted && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-[10px] ml-auto uppercase tracking-wider shrink-0 border border-green-200">Stoktan Düşüldü</span>}
              </div>
              )}

              {job.endJobDetails && (
                <div className="mt-4 text-xs font-medium bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-green-200/50 pb-2">
                    <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
                    <b className="text-green-900 text-sm">Personel Tarafından İş Sonlandırıldı</b>
                  </div>
                  {job.type === 'Asansör' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                      <p><b>Ödeme:</b> {job.endJobDetails.paymentMethod}</p>
                      <p><b>Kurulum:</b> {job.endJobDetails.elevatorSetup}</p>
                      {job.endJobDetails.elevatorSetup === 'Hayır' && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Kurulmama Nedeni:</b> {job.endJobDetails.elevatorSetupReason}</p>}
                      <p><b>Asansör Sorunu:</b> {job.endJobDetails.elevatorIssue}</p>
                      {job.endJobDetails.elevatorIssue === 'Evet' && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Asansör Sorun Detayı:</b> {job.endJobDetails.elevatorIssueReason}</p>}
                      <p><b>Araç Sorunu:</b> {job.endJobDetails.vehicleIssue}</p>
                      {job.endJobDetails.vehicleIssue === 'Evet' && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Araç Sorun Detayı:</b> {job.endJobDetails.vehicleIssueReason}</p>}
                      {(job.endJobDetails.elevatorImages || []).map((img, idx) => (
                        <button key={'elev'+idx} type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Kurulum Fotoğrafı', name: img}); }} className="md:col-span-2 text-left text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 hover:bg-green-100 transition flex justify-between items-center shadow-sm">
                          <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Kurulum Fotoğrafı {idx > 0 ? idx+1 : ''}:</b> {img}</span>
                          <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-green-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                      <p><b>Ödeme:</b> {job.endJobDetails.paymentMethod}</p>
                      <p><b>Müşteri Memnuniyeti:</b> {job.endJobDetails.customerSatisfaction}</p>
                      <p><b>Eşya Hasarı:</b> {job.endJobDetails.damageStatus}</p>
                      <p><b>Kamyon Durumu:</b> {job.endJobDetails.truckStatus}</p>
                      {(job.endJobDetails.truckImages || (job.endJobDetails.truckImage ? [job.endJobDetails.truckImage] : [])).map((img, idx) => (
                        <button key={'truck'+idx} type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Kasa Fotoğrafı', name: img}); }} className="md:col-span-2 text-left text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 hover:bg-green-100 transition flex justify-between items-center shadow-sm">
                          <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Kasa Fotoğrafı {idx > 0 ? idx+1 : ''}:</b> {img}</span>
                          <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-green-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                        </button>
                      ))}
                      {(job.endJobDetails.damageImages || (job.endJobDetails.damageImage ? [job.endJobDetails.damageImage] : [])).map((img, idx) => (
                        <button key={'damage'+idx} type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Hasar Fotoğrafı', name: img}); }} className="md:col-span-2 text-left text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition flex justify-between items-center shadow-sm">
                          <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Hasar Fotoğrafı {idx > 0 ? idx+1 : ''}:</b> {img}</span>
                          <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-red-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                        </button>
                      ))}
                      {job.endJobDetails.damageDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Hasar Detayı:</b> {job.endJobDetails.damageDetails}</p>}
                      {job.endJobDetails.truckIssueDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Kamyon Sorunu:</b> {job.endJobDetails.truckIssueDetails}</p>}
                    </div>
                  )}
                </div>
              )}
              
              {/* YENİ İŞLEM BUTONLARI */}
              <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-2">
                <button onClick={() => generateContractPDF(job)} className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <FileText className="w-4 h-4"/> PDF Sözleşme
                </button>
                <button onClick={() => handleEditJob(job)} className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <Edit className="w-4 h-4"/> Bilgileri Düzenle
                </button>
                <button onClick={() => handleOpenAssignModal(job)} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4"/> {job.team !== 'Atanmadı' ? 'Görevlendirmeyi Düzenle' : 'Görev Ata'}
                </button>
                
                {/* Yeni SMS / WA Onay Butonları */}
                <button onClick={() => sendAppointmentMessage(job, 'wa')} className="px-3 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4"/> Randevu Onayı (WA)
                </button>
                <button onClick={() => sendAppointmentMessage(job, 'sms')} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <MessageSquareText className="w-4 h-4"/> Randevu Onayı (SMS)
                </button>

                {job.type !== 'Asansör' && (
                <button onClick={() => handleEstimateMaterials(job)} className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <Package className="w-4 h-4"/> ✨ Malzeme Tahmini
                </button>
                )}
                {job.status !== 'cancelled' && (
                  <button onClick={() => setCancelJobId(job.id)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                    <Ban className="w-4 h-4"/> İşi İptal Et
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setDeleteJobId(job.id); }} className="px-3 py-2 bg-neutral-100 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition flex items-center gap-1.5 border border-neutral-200 hover:border-red-200">
                  <X className="w-4 h-4"/> Kalıcı Sil
                </button>
              </div>
            </div>
          </div>
        ))
          )}
        </div>
      </div>
    );
  };

  export const AllJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials, setCancelJobId, setDeleteJobId }) => {
    const [sortOrder, setSortOrder] = useState('newest');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Arama metnine göre filtreleme (Müşteri Adı veya Telefon)
    const filteredJobs = jobs.filter(job => 
      (job.customerName && job.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (job.customerPhone && job.customerPhone.includes(searchQuery))
    );

    const sortedJobs = [...filteredJobs].sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.date) - new Date(a.date);
      return new Date(a.date) - new Date(b.date);
    });

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2 shrink-0">
            <ClipboardList className="w-6 h-6 text-red-600" /> Tüm İşler Listesi
          </h2>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Müşteri Adı veya Telefon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition"
              />
            </div>
            <div className="flex items-center gap-2 bg-neutral-50 p-1.5 rounded-xl border border-neutral-200 w-full md:w-auto">
              <span className="text-xs font-bold text-neutral-500 pl-2">Sıralama:</span>
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
                className="p-2 border-none bg-transparent text-sm font-bold text-black outline-none cursor-pointer"
              >
                <option value="newest">Tarihe Göre (Yeniden Eskiye)</option>
                <option value="oldest">Tarihe Göre (Eskiden Yeniye)</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* KART TABANLI YAPI (Responsive Fix) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedJobs.map(job => (
            <div key={job.id} className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col gap-3 transition ${job.status === 'cancelled' ? 'border-red-400 bg-red-50/40' : job.isSpecial ? 'border-yellow-400 ring-1 ring-yellow-100 bg-yellow-50/20' : 'border-neutral-200 hover:border-red-400'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-base text-black flex items-center gap-1">
                      {job.isSpecial && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 drop-shadow-sm" />}
                      {job.customerName}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold text-white uppercase tracking-wider ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                      {job.type || 'Nakliye'}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      job.status === 'completed' ? 'bg-black text-white' :
                      job.status === 'in-progress' ? 'bg-red-600 text-white shadow-sm' :
                      job.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-neutral-100 text-neutral-700 border border-neutral-200'
                    }`}>
                      {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : job.status === 'cancelled' ? 'İptal' : 'Bekliyor'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-neutral-600 font-medium">
                  <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded border border-neutral-200"><CalendarDays className="w-3 h-3 text-neutral-400"/> {job.date}</span>
                  <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded border border-neutral-200"><Clock className="w-3 h-3 text-neutral-400"/> {job.time}</span>
                  <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded border border-neutral-200"><Phone className="w-3 h-3 text-neutral-400"/> {job.customerPhone}</span>
                </div>

                <div className="text-[11px] text-neutral-600 flex flex-col gap-1.5 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" /> 
                    <div className="flex-1 leading-tight">
                      <span className="text-black font-bold block mb-0.5">{job.extraLoadingAddresses?.length > 0 ? '1. AL:' : 'AL:'} {job.fromProvince}/{job.fromDistrict}</span>
                      <span className="text-[9px] font-medium text-neutral-500">{job.fromRoomCount} • {job.fromFloor} • {job.fromTransportMethod}</span>
                    </div>
                  </div>
                  {job.toProvince && (
                    <div className="flex items-start gap-1.5 pt-1.5 border-t border-neutral-200/80">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> 
                      <div className="flex-1 leading-tight">
                        <span className="text-red-900 font-bold block mb-0.5">{job.extraUnloadingAddresses?.length > 0 ? '1. VR:' : 'VR:'} {job.toProvince}/{job.toDistrict}</span>
                        <span className="text-[9px] font-medium text-red-600/80">{job.toRoomCount} • {job.toFloor} • {job.toTransportMethod}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end mt-auto pt-2">
                  <div className="flex flex-col gap-1">
                      {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(job.teamNames || [job.team]).map((name, i) => (
                            <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-blue-50 text-blue-700 border-blue-100">
                              <User className="w-3 h-3 shrink-0" /> {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border w-fit bg-yellow-50 text-yellow-700 border-yellow-100">
                          <User className="w-3 h-3 shrink-0" /> Atanmadı
                        </span>
                      )}
                      {job.assignedVehiclePlate && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border w-fit bg-purple-50 text-purple-700 border-purple-100">
                          <Truck className="w-3 h-3 shrink-0" /> {job.assignedVehiclePlate}
                        </span>
                      )}
                  </div>
                  {job.price && (
                    <div className="text-right">
                      <span className="block text-sm font-black text-green-600">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t border-neutral-100">
                  <button onClick={() => generateContractPDF(job)} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition" title="PDF Sözleşme">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEditJob(job)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition" title="Düzenle">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleOpenAssignModal(job)} className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition" title="Görev Ata">
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleGenerateMessage(job)} className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition" title="Mesaj">
                    <MessageSquareText className="w-4 h-4" />
                  </button>
                  {job.type !== 'Asansör' && (
                  <button onClick={() => handleEstimateMaterials(job)} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition" title="Malzeme">
                    <Package className="w-4 h-4" />
                  </button>
                  )}
                  {job.status !== 'cancelled' && (
                    <button onClick={() => setCancelJobId(job.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition" title="İptal Et">
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setDeleteJobId(job.id)} className="p-1.5 bg-neutral-100 hover:bg-red-100 text-red-600 rounded-lg transition" title="Kalıcı Sil">
                    <X className="w-4 h-4" />
                  </button>
                </div>
            </div>
          ))}
          {sortedJobs.length === 0 && (
            <div className="col-span-full p-8 text-center text-neutral-500">Kayıtlı iş bulunamadı.</div>
          )}
        </div>
      </div>
    );
  };

  export const CompletedJobsView = ({ jobs, handleEditJob, setViewingImage, setDeleteJobId, setMarkDamageJobId, canApprovePoints, handleOpenApproveModal, handleOpenMesaiModal, handleOpenResolveDamageModal }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState(''); // ARAMA STATE'İ EKLENDİ

    const prevDay = () => {
      const newDate = new Date(viewDate);
      newDate.setDate(viewDate.getDate() - 1);
      setViewDate(newDate);
    };

    const nextDay = () => {
      const newDate = new Date(viewDate);
      newDate.setDate(viewDate.getDate() + 1);
      setViewDate(newDate);
    };

    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const day = String(viewDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const formattedDate = viewDate.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // ARAMA MANTIĞI EKLENDİ (Arama yapılıyorsa tarihi yoksay, global ara)
    const completedJobs = jobs
      .filter(j => {
        if (j.status !== 'completed') return false;
        
        if (searchQuery.trim()) {
          return (j.customerName && j.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
                 (j.customerPhone && j.customerPhone.includes(searchQuery));
        }
        
        return j.date === dateStr;
      })
      .sort((a, b) => {
        if (searchQuery.trim()) {
           return new Date(b.date) - new Date(a.date); // Aramada en yeniler üstte görünsün
        }
        const order = { 'Nakliye': 1, 'Depo': 2, 'Asansör': 3 };
        return (order[a.type || 'Nakliye'] || 4) - (order[b.type || 'Nakliye'] || 4);
      });

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <button onClick={prevDay} className="p-4 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl transition"><ChevronLeft className="w-6 h-6" /></button>
            <div className="text-center min-w-[150px]">
              <h2 className="text-xl md:text-2xl font-bold text-green-600 flex justify-center items-center gap-2"><CheckCircle className="w-6 h-6"/> {formattedDate}</h2>
              <p className="text-sm font-medium text-neutral-500 mt-1">Tamamlanan Operasyonlar</p>
            </div>
            <button onClick={nextDay} className="p-4 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl transition"><ChevronRight className="w-6 h-6" /></button>
          </div>
          
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Tüm kayıtlarda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 transition"
            />
          </div>
        </div>

        <div className="space-y-4">
          {completedJobs.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-neutral-200 text-center text-neutral-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
              <p className="text-lg font-medium">{searchQuery.trim() ? 'Aramanıza uygun kayıt bulunamadı.' : 'Bu tarihe kayıtlı tamamlanmış operasyon bulunmuyor.'}</p>
            </div>
          ) : (
            completedJobs.map(job => (
              <div key={job.id} className="p-4 border border-green-200 bg-white shadow-sm rounded-xl flex flex-col md:flex-row gap-4 justify-between md:items-center hover:border-green-400 transition">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-black text-lg">{job.customerName}</h3>
                      <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-bold shadow-sm">TAMAMLANDI</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase shadow-sm ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                        {job.type || 'Nakliye'}
                      </span>
                    </div>
                    {job.createdBy && (
                      <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200" title={`Kayıt Eden: ${job.createdBy}`}>
                        <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 text-[8px]">
                           {job.createdBy.charAt(0)}
                        </div>
                        <span className="text-[10px] font-bold text-neutral-600">{job.createdBy}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 mb-2">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-neutral-400" /> {job.date} - {job.time}</span>
                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-neutral-400" /> {job.customerPhone}</span>
                  </div>
                  
                  {/* EKİP VE ARAÇ BİLGİSİ EKLENDİ */}
                  <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
                    {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(job.teamNames || [job.team]).map((name, i) => (
                          <span key={i} className="flex items-center gap-1 font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">
                            <User className="w-3.5 h-3.5" /> {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg border border-yellow-100">
                        <User className="w-3.5 h-3.5" /> Ekip Atanmamış
                      </span>
                    )}
                    {job.assignedVehiclePlate && (
                      <span className="flex items-center gap-1 font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100">
                        <Truck className="w-3.5 h-3.5" /> {job.assignedVehiclePlate}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-neutral-600 mb-3"><MapPin className="w-4 h-4 inline mr-1 text-neutral-400" /> {job.fromDistrict} <ArrowRightLeft className="w-3 h-3 inline mx-1 text-neutral-300" /> {job.toDistrict || 'Belirtilmedi'}</p>
                  
                  {job.endJobDetails && (
                    <div className="text-xs flex flex-col gap-2 mt-2 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 font-medium">Hasar Durumu: <b className="font-bold">{job.endJobDetails.damageStatus}</b></span>
                        <span className="bg-neutral-50 text-neutral-700 px-2 py-1 rounded border border-neutral-200 font-medium">Kamyon: <b className="font-bold">{job.endJobDetails.truckStatus}</b></span>
                        <span className="bg-neutral-50 text-neutral-700 px-2 py-1 rounded border border-neutral-200 font-medium">Memnuniyet: <b className="font-bold">{job.endJobDetails.customerSatisfaction}</b></span>
                      </div>
                      {job.endJobDetails.damageDetails && (
                        <div className="bg-red-50 p-2.5 rounded-lg text-red-800 border border-red-200 leading-relaxed">
                          <b className="block mb-0.5">Hasar Detayı:</b> {job.endJobDetails.damageDetails}
                        </div>
                      )}
                      {job.endJobDetails.damageResolved && (
                        <div className="bg-green-50 p-2.5 rounded-lg text-green-800 border border-green-200 leading-relaxed mt-2">
                          <b className="block mb-0.5 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Çözüm Notu:</b> 
                          {job.endJobDetails.damageResolutionNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {job.price && (
                    <div className="text-right mb-2">
                      <span className="block text-lg font-black text-green-600">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                      {/* KAPORA BİLGİSİ EKLENDİ */}
                      {job.deposit && (
                        <span className="block text-xs font-bold text-neutral-500 mt-0.5">Kapora: ₺{parseInt(job.deposit).toLocaleString('tr-TR')}</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => generateContractPDF(job)} className="flex-1 px-3 py-2 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-1.5 text-xs border border-neutral-200">
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                    <button onClick={() => handleEditJob(job)} className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition flex justify-center items-center gap-1.5 text-xs border border-blue-100">
                      <Edit className="w-4 h-4" /> Düzenle
                    </button>
                  </div>
                  
                  {/* HASAR OLUŞTU BUTONU */}
                  {job.endJobDetails?.damageStatus !== 'Hasar var' && (
                    <button onClick={() => setMarkDamageJobId(job.id)} className="w-full px-4 py-2 bg-orange-50 text-orange-700 font-bold rounded-xl hover:bg-orange-100 transition flex justify-center items-center gap-2 text-sm border border-orange-200">
                      <AlertTriangle className="w-4 h-4" /> Hasar Oluştu
                    </button>
                  )}
                  
                  {/* PUAN ONAY BUTONU */}
                  {canApprovePoints && !job.pointsApproved && (
                    <button onClick={() => handleOpenApproveModal(job)} className="w-full px-4 py-2 bg-yellow-50 text-yellow-700 font-bold rounded-xl hover:bg-yellow-100 transition flex justify-center items-center gap-2 text-sm border border-yellow-200">
                      <Star className="w-4 h-4" /> Puanı Onayla
                    </button>
                  )}
                  {job.pointsApproved && (
                    <div className="w-full px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl flex justify-center items-center gap-2 text-sm border border-green-200 opacity-70 cursor-not-allowed">
                      <CheckCircle className="w-4 h-4" /> Puan Onaylandı
                    </div>
                  )}

                  {/* MESAİ ONAY BUTONU */}
                  {canApprovePoints && !job.mesaiApproved && (
                    <button onClick={() => handleOpenMesaiModal(job)} className="w-full px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition flex justify-center items-center gap-2 text-sm border border-blue-200">
                      <Clock className="w-4 h-4" /> Mesai Onayla
                    </button>
                  )}
                  {job.mesaiApproved && (
                    <div className="w-full px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-xl flex justify-center items-center gap-2 text-sm border border-blue-200 opacity-70 cursor-not-allowed">
                      <CheckCircle className="w-4 h-4" /> Mesai Onaylandı
                    </div>
                  )}

                  {(job.endJobDetails?.truckImages || (job.endJobDetails?.truckImage ? [job.endJobDetails.truckImage] : [])).map((img, idx) => (
                    <button key={idx} onClick={() => setViewingImage({title: 'Kasa Fotoğrafı', name: img})} className="w-full px-4 py-2 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-2 text-sm border border-neutral-200">
                      <Camera className="w-4 h-4" /> Kasa Görseli {idx > 0 ? idx+1 : ''}
                    </button>
                  ))}
                  
                  {(job.endJobDetails?.damageImages || (job.endJobDetails?.damageImage ? [job.endJobDetails.damageImage] : [])).map((img, idx) => (
                    <button key={'dmg'+idx} onClick={() => setViewingImage({title: 'Hasar Fotoğrafı', name: img})} className="w-full px-4 py-2 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition flex justify-center items-center gap-2 text-sm border border-red-200">
                      <Camera className="w-4 h-4" /> Hasar Görseli {idx > 0 ? idx+1 : ''}
                    </button>
                  ))}

                  {!job.endJobDetails?.damageResolved && job.endJobDetails?.damageStatus === 'Hasar var' && (
                    <button onClick={() => handleOpenResolveDamageModal(job.id)} className="w-full px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition flex justify-center items-center gap-2 text-sm border border-green-200">
                      <CheckCircle className="w-4 h-4" /> Sorun Çözüldü
                    </button>
                  )}

                  <button onClick={(e) => { e.stopPropagation(); setDeleteJobId(job.id); }} className="w-full px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition flex justify-center items-center gap-2 text-sm border border-red-100">
                    <X className="w-4 h-4" /> Kalıcı Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  export const CalendarView = ({ jobs, handleEditJob, currentUser, setJobToChangeDate, setNewJobDate, setShowChangeDateModal, setCancelJobId }) => {
    const canAssign = currentUser?.position?.includes('Operasyon') || currentUser?.position?.includes('Firma Sahibi') || currentUser?.permissions?.canEdit;
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]); 
    const [myPuantaj, setMyPuantaj] = useState({});

    const isOperator = currentUser?.position === 'Operatör';
    const isMaviYaka = (currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position))) && !isOperator;

    useEffect(() => {
      if (!isMaviYaka || !currentUser) return;
      const fetchPuantaj = async () => {
        try {
          const docRefPuantaj = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${currentYear}_${currentMonth + 1}`);
          const snapPuantaj = await getDoc(docRefPuantaj);
          if (snapPuantaj.exists()) {
            const records = snapPuantaj.data().records || {};
            setMyPuantaj(records[currentUser.id] || {});
          } else {
            setMyPuantaj({});
          }
        } catch (e) { console.error("Puantaj hatası", e); }
      };
      fetchPuantaj();
    }, [currentMonth, currentYear, currentUser, isMaviYaka]);

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // İptal edilenleri takvimden gizliyoruz ve önceliğe göre sıralıyoruz (Nakliye > Depo > Asansör)
    const activeJobs = jobs
      .filter(j => {
        if (isOperator) {
          const jobDate = new Date(j.date);
          const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return j.type === 'Asansör' && jobDate >= currentMonthStart && j.status !== 'cancelled';
        }
        return j.status !== 'cancelled';
      })
      .sort((a, b) => {
        const order = { 'Nakliye': 1, 'Depo': 2, 'Asansör': 3 };
        return (order[a.type || 'Nakliye'] || 4) - (order[b.type || 'Nakliye'] || 4);
      });
      
    const jobsByDate = activeJobs.reduce((acc, job) => {
      if(!acc[job.date]) acc[job.date] = [];
      acc[job.date].push(job);
      return acc;
    }, {});

    const days = [];
    let startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        day: i,
        date: dateStr,
        jobs: jobsByDate[dateStr] || []
      });
    }

    const nextMonth = () => {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    };

    const prevMonth = () => {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    };

    const getCapacityColor = (coreJobCount) => {
      if (coreJobCount === 0) return 'bg-white border-neutral-200 hover:bg-neutral-50';
      if (coreJobCount <= 3) return 'bg-neutral-50 border-neutral-300 hover:bg-neutral-100';
      if (coreJobCount === 4) return 'bg-red-50 border-red-200 hover:bg-red-100';
      return 'bg-black border-black text-white hover:bg-neutral-900';
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-black rounded-lg transition"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-bold text-black w-40 text-center">{monthNames[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-black rounded-lg transition"><ChevronRight className="w-5 h-5" /></button>
          </div>
          
          {isMaviYaka ? (
            <div className="flex flex-col gap-2 items-end">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold bg-yellow-50 p-1.5 rounded-xl border border-yellow-200 text-yellow-800">
                <div className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Ay İçerisinde Kazanılan Puanlar</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-end">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold bg-neutral-50 p-1.5 rounded-xl border border-neutral-200">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-600"></div> Nakliye</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> Depo</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Asansör</div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold bg-neutral-50 p-1.5 rounded-xl border border-neutral-200">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white border border-neutral-300"></div> Boş (0)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-neutral-300"></div> Müsait (1-3)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600"></div> Yoğun (4)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-black"></div> Dolu (5+)</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {dayNames.map(day => (
            <div key={day} className="text-center font-bold text-neutral-500 text-xs py-2">
              {day}
            </div>
          ))}
          
          {days.map((item, index) => {
            const coreJobs = !isMaviYaka && item ? item.jobs.filter(j => j.type !== 'Asansör' && j.status !== 'cancelled') : [];
            const asansorJobs = !isMaviYaka && item ? item.jobs.filter(j => j.type === 'Asansör' && j.status !== 'cancelled') : [];
            const dayPuan = isMaviYaka && item ? parseFloat(myPuantaj[item.day]) || 0 : 0;
            const isToday = item && item.date === today.toISOString().split('T')[0];
            const isFull = !isMaviYaka && coreJobs.length >= 5;

            let cellClass = 'bg-transparent border-transparent';
            if (item) {
               if (isMaviYaka) {
                  cellClass = dayPuan > 0 ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-white border-neutral-200 hover:bg-neutral-50';
               } else {
                  cellClass = getCapacityColor(coreJobs.length);
               }
            }

            return (
              <div 
                key={index} 
                onClick={() => item && setSelectedDate(item.date)}
                className={`min-h-[64px] p-1.5 rounded-xl border transition cursor-pointer flex flex-col overflow-hidden ${cellClass} ${item && selectedDate === item.date ? 'ring-2 ring-red-600 ring-offset-1' : ''}`}
              >
                {item && (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[11px] font-bold ${isToday ? 'bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : (isFull && !isMaviYaka ? 'text-white' : 'text-black')}`}>
                        {item.day}
                      </span>
                      {coreJobs.length > 0 && !isMaviYaka && (
                        <span className={`text-[9px] font-bold ${isFull ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {coreJobs.length} İş
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-0.5 items-start w-full mt-auto">
                      <div className="flex flex-col gap-0.5 w-full">
                        {isMaviYaka ? (
                            dayPuan > 0 && (
                                <div className="flex flex-col items-center justify-center w-full mt-0.5 animate-in zoom-in">
                                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 drop-shadow-sm mb-0.5" />
                                    <span className="text-[10px] font-black text-yellow-700 leading-none">{dayPuan} Puan</span>
                                </div>
                            )
                        ) : (
                          <>
                            {coreJobs.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 items-center">
                                {coreJobs.slice(0, 5).map(job => (
                                  job.isSpecial ? 
                                    <Star key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                                  :
                                    <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className={`w-2 h-2 rounded-full ${job.type === 'Depo' ? 'bg-blue-600' : 'bg-red-600'}`}></div>
                                ))}
                              </div>
                            )}
                            
                            {asansorJobs.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5 pt-0.5 border-t border-black/10 w-full items-center">
                                {asansorJobs.slice(0, 5).map(job => (
                                  job.isSpecial ?
                                    <Star key={job.id} title={`${job.customerName} - ${job.team} (${job.type})`} className="w-2 h-2 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                                  :
                                    <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type})`} className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* SEÇİLİ GÜNÜN İŞLERİ ÖNİZLEMESİ */}
        {selectedDate && !isMaviYaka && (
          <div className="mt-8 pt-6 border-t border-neutral-200 animate-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-red-600" />
              {selectedDate.split('-').reverse().join('.')} Tarihindeki Operasyonlar
            </h3>
            
            <div className="space-y-2.5">
              {(!jobsByDate[selectedDate] || jobsByDate[selectedDate].length === 0) ? (
                <div className="p-6 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-neutral-500 font-medium text-sm">
                  Bu tarihte kayıtlı herhangi bir operasyon bulunmuyor.
                </div>
              ) : (
                jobsByDate[selectedDate].map(job => (
                  <div key={job.id} className={`bg-white p-3.5 rounded-xl shadow-sm border ${job.status === 'cancelled' ? 'border-red-400 bg-red-50/40' : job.isSpecial ? 'border-yellow-400 ring-1 ring-yellow-100 bg-yellow-50/20' : 'border-neutral-200 hover:border-red-400'} flex flex-col gap-2.5 transition group`}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-black flex items-center gap-1">
                          {job.isSpecial && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />}
                          {job.customerName}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold text-white uppercase tracking-wider ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                          {job.type || 'Nakliye'}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          job.status === 'completed' ? 'bg-black text-white' :
                          job.status === 'in-progress' ? 'bg-red-600 text-white shadow-sm' :
                          job.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                          'bg-neutral-100 text-neutral-700 border border-neutral-200'
                        }`}>
                          {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : job.status === 'cancelled' ? 'İptal' : 'Bekliyor'}
                        </span>
                        <span className="text-[10px] font-black text-neutral-600 flex items-center gap-1 ml-1"><Clock className="w-3 h-3" /> {job.time}</span>
                      </div>
                      {job.price && (
                        <div className="text-right shrink-0 leading-none">
                          <span className="block text-sm font-black text-green-600">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-neutral-600 flex flex-col gap-1.5 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" /> 
                        <div className="flex-1 leading-tight">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                            <span className="text-black font-bold">{job.extraLoadingAddresses?.length > 0 ? '1. AL:' : 'AL:'} {job.fromProvince}/{job.fromDistrict}</span>
                            <span className="text-[9px] font-medium text-neutral-500">{job.fromRoomCount} • {job.fromFloor} • {job.fromTransportMethod} • {job.fromPacking}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500">{job.fromAddress}</div>
                        </div>
                      </div>
                      
                      {job.extraLoadingAddresses?.map((addr, idx) => (
                        <div key={addr.id} className="flex items-start gap-1.5 pt-1.5 border-t border-neutral-200/60">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" /> 
                          <div className="flex-1 leading-tight">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                              <span className="text-black font-bold">{idx + 2}. Yükleme: {addr.province}/{addr.district}</span>
                              <span className="text-[9px] font-medium text-neutral-500">{addr.roomCount} • {addr.floor} • {addr.transportMethod} • {addr.packing}</span>
                            </div>
                            <div className="text-[10px] text-neutral-500">{addr.address}</div>
                          </div>
                        </div>
                      ))}
                      
                      {job.toProvince && (
                        <>
                          <div className="flex items-start gap-1.5 pt-1.5 border-t border-neutral-200/80">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> 
                            <div className="flex-1 leading-tight">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                                <span className="text-red-900 font-bold">{job.extraUnloadingAddresses?.length > 0 ? '1. Boşaltma:' : 'VR:'} {job.toProvince}/{job.toDistrict}</span>
                                <span className="text-[9px] font-medium text-red-600/80">{job.toRoomCount} • {job.toFloor} • {job.toTransportMethod} • {job.toPacking}</span>
                              </div>
                              <div className="text-[10px] text-neutral-500">{job.toAddress}</div>
                            </div>
                          </div>
                          {job.extraUnloadingAddresses?.map((addr, idx) => (
                            <div key={addr.id} className="flex items-start gap-1.5 pt-1.5 border-t border-neutral-200/60">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> 
                              <div className="flex-1 leading-tight">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                                  <span className="text-red-900 font-bold">{idx + 2}. Boşaltma: {addr.province}/{addr.district}</span>
                                  <span className="text-[9px] font-medium text-red-600/80">{addr.roomCount} • {addr.floor} • {addr.transportMethod} • {addr.packing}</span>
                                </div>
                                <div className="text-[10px] text-neutral-500">{addr.address}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {(job.contractDetails || job.notes) && (
                      <div className="grid grid-cols-1 gap-1.5 mt-0.5">
                        {job.contractDetails && (
                          <div className="text-[10px] font-medium bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-200 flex items-start gap-1.5 leading-tight">
                            <FileText className="w-3 h-3 shrink-0 text-blue-600" /> 
                            <span><b className="text-blue-900">Sözleşme:</b> {job.contractDetails}</span>
                          </div>
                        )}
                        {job.notes && (
                          <div className="text-[10px] font-medium bg-yellow-50 text-yellow-800 p-2 rounded-lg border border-yellow-200 flex items-start gap-1.5 leading-tight whitespace-pre-wrap">
                            <AlertTriangle className="w-3 h-3 shrink-0 text-yellow-600" /> 
                            <span><b className="text-yellow-900">Not:</b> {job.notes}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-white text-neutral-700 px-2 py-1 rounded border border-neutral-200"><Phone className="w-3 h-3 text-black" /> {job.customerPhone}</span>
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border ${job.team === 'Atanmadı' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}><User className="w-3 h-3" /> {job.team}</span>
                        {job.assignedVehiclePlate && <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100"><Truck className="w-3 h-3" /> {job.assignedVehiclePlate}</span>}
                        {job.createdBy && <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100"><UserPlus className="w-3 h-3" /> Kaydı Açan: {job.createdBy}</span>}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                        {!isOperator && (
                          <>
                            <button 
                              onClick={() => {
                                let phone = job.customerPhone.replace(/\D/g, '');
                                if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                else if (!phone.startsWith('90')) phone = '90' + phone;

                                const kapora = parseInt(job.price || 0) * 0.10;
                                const kaporaText = kapora > 0 ? kapora.toLocaleString('tr-TR') : '...';

                                const msg = `Sayın *${job.customerName}*,\n\n*Sembol Nakliyat* olarak ${job.date} tarihinde saat ${job.time} sularında planlanan işleminiz sistemimize başarıyla kaydedilmiştir.\n\n🚚 *Güzergah Bilgisi:*\n📍 Alış: ${job.fromProvince} / ${job.fromDistrict}\n📍 Teslim: ${job.toProvince ? job.toProvince + ' / ' + job.toDistrict : 'Belirtilmemiş'}\n\n🔒 *Güvenliğiniz için Teslim Kodunuz:* ${job.deliveryCode || 'Bulunmuyor'}\n(Ekibimiz geldiğinde eşya teslimi için bu kodu kendilerine iletebilirsiniz.)\n\n💰 *Kapora Bilgilendirmesi:*\nİşleminizin onaylanması ve aracınızın rezerve edilmesi için toplam tutarın %10'u olan *${kaporaText} TL* kapora ödemenizi rica ederiz.\n\n🏦 *Banka Bilgileri:*\nBanka: Denizbank\nAlıcı: Şenol Beşinci\nIBAN: TR 94 0013 4000 0262 9671 7000 01\n\n⚠️ *ÖNEMLİ NOT:* Lütfen ödeme yaparken açıklama kısmına sadece size gönderdiğimiz teslim kodunu (${job.deliveryCode || 'Yok'}) yazınız.\n\nBizi tercih ettiğiniz için teşekkür eder, yeni yerinizin hayırlı olmasını dileriz. İyi günler!`;
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                            }} 
                            className="px-3 py-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shadow-sm"
                          >
                            <MessageCircle className="w-3 h-3"/> Bilgilendir (WA)
                          </button>
                          <button onClick={() => generateContractPDF(job)} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-green-200">
                            <FileText className="w-3 h-3"/> PDF
                          </button>
                          <button onClick={() => handleEditJob(job)} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-neutral-200">
                            <Edit className="w-3 h-3"/> Düzenle
                          </button>
                          {/* YENİ: Tarih değiştirme ve iptal sadece işi açan kişi VEYA Yönetici/Müdür tarafından yapılabilir */}
                          {(() => {
                            const isYonetici = currentUser?.position === 'Firma Sahibi' || currentUser?.rank === 'Müdür' || currentUser?.permissions?.canEdit;
                            const isCreator = job.createdBy && currentUser?.fullName && job.createdBy === currentUser.fullName;
                            const canManage = isYonetici || isCreator;
                            if (!canManage) return null;
                            return (
                              <>
                                <button onClick={() => { setJobToChangeDate(job); setNewJobDate(job.date); setShowChangeDateModal(true); }} className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-orange-200">
                                  <CalendarDays className="w-3 h-3"/> Tarih Değiştir
                                </button>
                                {job.status !== 'cancelled' && (
                                  <button onClick={() => setCancelJobId(job.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-red-200">
                                    <Ban className="w-3 h-3"/> İptal Et
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedDate && isMaviYaka && (
          <div className="mt-8 pt-6 border-t border-neutral-200 animate-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              {selectedDate.split('-').reverse().join('.')} Tarihli Puan Özeti
            </h3>
            <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-200 text-center">
              {parseFloat(myPuantaj[parseInt(selectedDate.split('-')[2])]) > 0 ? (
                <>
                  <Star className="w-12 h-12 text-yellow-500 fill-yellow-500 mx-auto mb-3" />
                  <p className="text-xl font-black text-yellow-800">{myPuantaj[parseInt(selectedDate.split('-')[2])]} Puan</p>
                  <p className="text-sm font-bold text-yellow-700 mt-1">Harika iş çıkardın! Müşteri memnuniyeti veya takım desteği sağladın.</p>
                </>
              ) : (
                <p className="text-neutral-500 font-medium text-sm">Bu tarihte kazanılmış bir puanınız bulunmuyor.</p>
              )}
            </div>
          </div>
        )}

      </div>
    );
  };

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
      return {
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        yearNum: d.getFullYear(),
        dateStr: d.toISOString().split('T')[0],
        dayName: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()]
      };
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
          let mergedRecords = mSnap1.exists() ? mSnap1.data().records || {} : {};

          // Hafta diğer aya taşıyorsa (Örn: 28 Mayıs - 3 Haziran) iki ayı da birleştir
          if (m1 !== m2) {
             const mRef2 = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y2}_${m2}`);
             const mSnap2 = await getDoc(mRef2);
             if (mSnap2.exists()) {
                 const records2 = mSnap2.data().records || {};
                 for (const pId in records2) {
                     if (!mergedRecords[pId]) mergedRecords[pId] = {};
                     mergedRecords[pId] = { ...mergedRecords[pId], ...records2[pId] };
                 }
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

          days.forEach(day => {
             records[specialLeaveForm.personnelId][day] = { status: specialLeaveForm.type, hours: '' };

             // Eğer şu an görüntülenen mesaiData içinde de varsa anında yansıt
             if (!newMesaiData[specialLeaveForm.personnelId]) newMesaiData[specialLeaveForm.personnelId] = {};
             newMesaiData[specialLeaveForm.personnelId][day] = { status: specialLeaveForm.type, hours: '' };
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
      let leaveCountThisWeek = 0;
      weekDays.forEach(wd => {
         const cell = mesaiData[personId]?.[wd.dayNum];
         const status = typeof cell === 'object' && cell !== null ? cell.status : cell;
         if (status === 'Hİ' || status === 'D') {
            leaveCountThisWeek++;
         }
      });

      // Zaten bu güne atılmışsa işlem yapma
      const existingCell = mesaiData[personId]?.[targetDayNum];
      const existingStatus = typeof existingCell === 'object' && existingCell !== null ? existingCell.status : existingCell;
      
      if (existingStatus === 'Hİ' || existingStatus === 'D') {
         setIsSaving(false);
         return; 
      }

      // İlk atama Haftalık İzin, sonrakiler Devamsızlık
      const newStatus = leaveCountThisWeek === 0 ? 'Hİ' : 'D';

      // Local state'i güncelle
      const newMesaiData = { ...mesaiData };
      if (!newMesaiData[personId]) newMesaiData[personId] = {};
      newMesaiData[personId][targetDayNum] = { status: newStatus, hours: '' };
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

       // Local state
       const newMesaiData = { ...mesaiData };
       if (newMesaiData[personId] && newMesaiData[personId][targetDayNum]) {
          newMesaiData[personId][targetDayNum] = { status: '', hours: '' };
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
                 const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
                 const isWeekendDay = i === 6; // Sunday
                 
                 // Bu güne atanan personelleri bul (Tüm Mavi Yaka listesi üzerinden filtrele, displayPersonnel'den değil)
                 const assignedPersons = maviYakaList.filter(p => {
                    const cell = mesaiData[p.id]?.[wd.dayNum];
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
                             const cell = mesaiData[p.id]?.[wd.dayNum];
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
                       const cell = mesaiData[person.id]?.[wd.dayNum];
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
    
    // Mavi yaka olanları filtrele (Sıralama: Şoför, Mobilya Ustası, Taşıma Elemanı)
    const currentListMonth = weekStart.getMonth() + 1;
    const currentListYear = weekStart.getFullYear();
    const maviYakaList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (!isPersonnelVisibleInMonth(p, currentListYear, currentListMonth)) return false;
      return p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position));
    }).sort((a, b) => {
        const orderA = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[a.position] || 99;
        const orderB = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[b.position] || 99;
        if (orderA !== orderB) return orderA - orderB;
        if (a.employmentStatus === 'Pasif' && b.employmentStatus !== 'Pasif') return 1;
        if (a.employmentStatus !== 'Pasif' && b.employmentStatus === 'Pasif') return -1;
        return a.fullName.localeCompare(b.fullName);
    });

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        yearNum: d.getFullYear(),
        dateStr: d.toISOString().split('T')[0],
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
          let mergedRecords = pSnap1.exists() ? pSnap1.data().records || {} : {};

          // Hafta diğer aya taşıyorsa (Örn: 28 Mayıs - 3 Haziran) iki ayı da birleştir
          if (m1 !== m2) {
             const pRef2 = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${y2}_${m2}`);
             const pSnap2 = await getDoc(pRef2);
             if (pSnap2.exists()) {
                 const records2 = pSnap2.data().records || {};
                 for (const pId in records2) {
                     if (!mergedRecords[pId]) mergedRecords[pId] = {};
                     mergedRecords[pId] = { ...mergedRecords[pId], ...records2[pId] };
                 }
             }
          }
          setPuantajData(mergedRecords);
        } catch(e) { console.error("Puantaj veri çekilemedi:", e); }
      };
      fetchPuantaj();
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
              <Star className="w-7 h-7 text-yellow-500 fill-yellow-500" /> Haftalık Puantaj Tahtası
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">Mavi yaka personellerinin haftalık kazandığı puanları buradan takip edebilirsiniz.</p>
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

        <div className="flex-1 w-full overflow-auto custom-scrollbar-table border border-neutral-300 rounded-2xl bg-white shadow-sm relative">
            <table className="w-full border-collapse text-sm text-left table-fixed">
              <thead className="bg-neutral-100 sticky top-0 z-30 shadow-sm">
                <tr>
                  <th className="p-2 md:p-3 border-b border-r border-neutral-300 font-black text-neutral-800 sticky left-0 bg-neutral-100 z-40 w-[26%] md:w-[20%] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Personel
                  </th>
                  {weekDays.map((wd) => {
                    const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
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
                        const pts = parseFloat(puantajData[person.id]?.[wd.dayNum]) || 0;
                        weeklyTotal += pts;
                        const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
                        
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
        const orderA = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[a.position] || 99;
        const orderB = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[b.position] || 99;
        if (orderA !== orderB) return orderA - orderB;
        if (a.employmentStatus === 'Pasif' && b.employmentStatus !== 'Pasif') return 1;
        if (a.employmentStatus !== 'Pasif' && b.employmentStatus === 'Pasif') return -1;
        return a.fullName.localeCompare(b.fullName);
    });

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        dateObj: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        yearNum: d.getFullYear(),
        dateStr: d.toISOString().split('T')[0],
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
          let mergedRecords = mSnap1.exists() ? mSnap1.data().records || {} : {};

          // Hafta diğer aya taşıyorsa (Örn: 28 Mayıs - 3 Haziran) iki ayı da birleştir
          if (m1 !== m2) {
             const mRef2 = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y2}_${m2}`);
             const mSnap2 = await getDoc(mRef2);
             if (mSnap2.exists()) {
                 const records2 = mSnap2.data().records || {};
                 for (const pId in records2) {
                     if (!mergedRecords[pId]) mergedRecords[pId] = {};
                     mergedRecords[pId] = { ...mergedRecords[pId], ...records2[pId] };
                 }
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
                    const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
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
                        const cell = mesaiData[person.id]?.[wd.dayNum];
                        const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                        const hr = typeof cell === 'object' && cell !== null ? cell.hours : '';
                        const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
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

  export const AddMaterialView = ({ onAdd, onCancel }) => {
    const [formData, setFormData] = useState({ name: '', category: 'Ambalaj Malzemesi', stock: '', unit: 'Adet' });
    
    const handleSubmit = (e) => {
      e.preventDefault();
      onAdd(formData);
      setFormData({ name: '', category: 'Ambalaj Malzemesi', stock: '', unit: 'Adet' });
    };

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2">
            <Package className="w-6 h-6 text-red-600" /> Malzeme & Stok Ekle
          </h2>
          {onCancel && (
            <button type="button" onClick={onCancel} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div  className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-black mb-1">Malzeme Adı</label>
            <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium" placeholder="Örn: Koli Bantı, 50x50 Koli" />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1">Kategori</label>
            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Ambalaj Malzemesi">Ambalaj Malzemesi</option>
              <option value="Temizlik Malzemesi">Temizlik Malzemesi</option>
              <option value="Araç Ekipmanı">Araç Ekipmanı</option>
              <option value="Diğer Sarf Malzeme">Diğer Sarf Malzeme</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1">Güncel Stok Miktarı</label>
              <input required type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-black text-red-600" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1">Stok Birimi</label>
              <select value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                <option value="Adet">Adet</option>
                <option value="Rulo">Rulo</option>
                <option value="Kg">Kg</option>
                <option value="Metre">Metre</option>
                <option value="Kutu">Kutu</option>
                <option value="Paket">Paket</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={handleSubmit} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
            <PlusCircle className="w-5 h-5" /> Malzemeyi Kaydet
          </button>
        </div>
      </div>
    );
  };

  export const UpdateMaterialStockView = ({ materials, onUpdate, onCancel }) => {
    const [formData, setFormData] = useState({ materialId: '', actionType: 'add', amount: '', description: '', cost: '' });
    
    const selectedMaterial = materials.find(m => m.id === formData.materialId);

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.materialId || !formData.amount) return;
      
      let change = parseFloat(formData.amount);
      if (formData.actionType === 'remove') change = -Math.abs(change);
      else change = Math.abs(change);

      onUpdate(formData.materialId, change, formData.description, formData.cost);
      onCancel();
    };

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-blue-600" /> Stok Güncelle / Değiştir
          </h2>
          <button type="button" onClick={onCancel} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div  className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-black mb-1">Malzeme Seçin</label>
            <select required value={formData.materialId} onChange={(e) => setFormData({...formData, materialId: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white transition font-medium">
              <option value="">Lütfen listeden bir malzeme seçin...</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} (Mevcut Stok: {(Math.round((parseFloat(m.stock) || 0) * 10) / 10).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} {m.unit})</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1">İşlem Türü</label>
              <div className="flex bg-neutral-100 p-1 rounded-xl">
                <button type="button" onClick={() => setFormData({...formData, actionType: 'add'})} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${formData.actionType === 'add' ? 'bg-green-500 text-white shadow-sm' : 'text-neutral-500'}`}>Stoğa Ekle (+)</button>
                <button type="button" onClick={() => setFormData({...formData, actionType: 'remove'})} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${formData.actionType === 'remove' ? 'bg-red-500 text-white shadow-sm' : 'text-neutral-500'}`}>Stoktan Çıkar (-)</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1">Miktar ({selectedMaterial ? selectedMaterial.unit : 'Birim'})</label>
              <input required type="number" min="0.1" step="0.1" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition font-black text-blue-600" placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1">Açıklama / Not</label>
              <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition font-medium" placeholder="Örn: Yeni alım yapıldı, Zayi oldu..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1">Toplam Maliyet / Gelir (TL)</label>
              <input type="number" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition font-medium" placeholder="İsteğe bağlı..." title="Eğer bir tutar girerseniz finans kasasına otomatik işlenir." />
            </div>
          </div>

          <button type="button" onClick={handleSubmit} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg shadow-blue-600/20 mt-4">
            <CheckCircle className="w-5 h-5" /> Stokları Güncelle
          </button>
        </div>
      </div>
    );
  };

  export const MaterialListView = ({ materials, onDelete, onUpdateStock, onAdd, systemLogs = [] }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    // YENİ: "Tüm Hareketleri Gör" modalı için state
    const [showAllLogsModal, setShowAllLogsModal] = useState(false);

    const handleAdd = (data) => {
      if(onAdd) onAdd(data);
      setShowAddModal(false);
    };

    const parseLogDate = (str) => {
       if (!str) return 0;
       const parts = str.split(' ');
       if (parts.length < 2) return 0;
       const [datePart, timePart] = parts;
       const [d, m, y] = datePart.split('.');
       const [hr, min] = timePart.split(':');
       return new Date(`${y}-${m}-${d}T${hr}:${min}:00`).getTime() || 0;
    };

    // Sistem loglarından sadece malzeme ve stok hareketlerini filtrele
    const allMaterialLogsSorted = systemLogs.filter(log => 
      log.action?.includes('Malzeme') || log.action?.includes('Stok')
    ).sort((a, b) => parseLogDate(b.timestamp) - parseLogDate(a.timestamp));

    // YENİ: "Tüm Hareketleri Gör" butonu için TAM liste (kesilmemiş)
    const allMaterialLogs = allMaterialLogsSorted;
    const materialLogs = allMaterialLogsSorted.slice(0, 20); // Son 20 hareketi göster

    return (
      <div className="flex flex-col gap-6 animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 relative">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              <Package className="w-6 h-6 text-red-600" /> Mevcut Malzemeler ve Stok Durumu
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowUpdateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-lg w-full sm:w-auto justify-center"
              >
                <ArrowRightLeft className="w-5 h-5" /> Stok Değiştir
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-black text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition shadow-lg w-full sm:w-auto justify-center"
              >
                <PlusCircle className="w-5 h-5" /> Malzeme Ekle
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white border-b border-neutral-200">
                <tr>
                  <th className="p-4 font-bold rounded-tl-xl">Malzeme Adı</th>
                  <th className="p-4 font-bold">Kategori</th>
                  <th className="p-4 font-bold text-center">Stok Miktarı</th>
                  <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {materials.map(material => (
                  <tr key={material.id} className="hover:bg-neutral-50 transition">
                    <td className="p-4 font-bold text-black text-base">{material.name}</td>
                    <td className="p-4 text-neutral-600 font-medium">
                      <span className="bg-neutral-100 px-2.5 py-1 rounded-lg text-xs border border-neutral-200">{material.category}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-sm font-black px-3 py-1 rounded-xl ${parseInt(material.stock) <= 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {(Math.round((parseFloat(material.stock) || 0) * 10) / 10).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} <span className="text-xs font-bold opacity-70">{material.unit}</span>
                      </span>
                      {parseInt(material.stock) <= 10 && <div className="text-[10px] text-red-500 font-bold mt-1">Kritik Stok!</div>}
                    </td>
                    <td className="p-4">
                      <button onClick={() => onDelete(material.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition" title="Malzemeyi Sil">
                        <Ban className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {materials.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-neutral-500">Kayıtlı malzeme bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* YENİ EKLENEN: MALZEME HAREKETLERİ */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 relative">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b border-neutral-200 pb-4 gap-3">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              <History className="w-6 h-6 text-red-600" /> Malzeme Hareketleri (Son 20 İşlem)
            </h2>
            {/* YENİ: Tüm Hareketleri Gör Butonu */}
            <button
              onClick={() => setShowAllLogsModal(true)}
              className="bg-neutral-100 text-neutral-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-200 transition w-full sm:w-auto justify-center"
            >
              <History className="w-4 h-4" /> Tüm Hareketleri Gör ({allMaterialLogs.length})
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="p-4 font-bold rounded-tl-xl">Tarih / Saat</th>
                  <th className="p-4 font-bold">İşlem Türü</th>
                  <th className="p-4 font-bold">Detaylar</th>
                  <th className="p-4 font-bold rounded-tr-xl">İşlemi Yapan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {materialLogs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-50 transition">
                    <td className="p-4 font-medium text-black whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${log.action.includes('Çıkışı') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-600 font-medium">{log.details}</td>
                    <td className="p-4 font-bold text-neutral-800">{log.user}</td>
                  </tr>
                ))}
                {materialLogs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-neutral-500">Henüz malzeme hareketi bulunmuyor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="w-full max-w-2xl relative animate-in zoom-in-95">
              <AddMaterialView onAdd={handleAdd} onCancel={() => setShowAddModal(false)} />
            </div>
          </div>
        )}

        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="w-full max-w-2xl relative animate-in zoom-in-95">
              <UpdateMaterialStockView materials={materials} onUpdate={onUpdateStock} onCancel={() => setShowUpdateModal(false)} />
            </div>
          </div>
        )}

        {/* YENİ: Tüm Malzeme Hareketlerini Gösteren Modal */}
        {showAllLogsModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
              <div className="bg-black text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><History className="w-5 h-5" /> Tüm Malzeme Hareketleri ({allMaterialLogs.length})</h3>
                <button onClick={() => setShowAllLogsModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 sticky top-0">
                    <tr>
                      <th className="p-4 font-bold">Tarih / Saat</th>
                      <th className="p-4 font-bold">İşlem Türü</th>
                      <th className="p-4 font-bold">Detaylar</th>
                      <th className="p-4 font-bold">İşlemi Yapan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {allMaterialLogs.map(log => (
                      <tr key={log.id} className="hover:bg-neutral-50 transition">
                        <td className="p-4 font-medium text-black whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${log.action.includes('Çıkışı') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-600 font-medium">{log.details}</td>
                        <td className="p-4 font-bold text-neutral-800">{log.user}</td>
                      </tr>
                    ))}
                    {allMaterialLogs.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-6 text-center text-neutral-500">Henüz malzeme hareketi bulunmuyor.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export const DamagedJobsView = ({ jobs, handleEditJob, setViewingImage, setDeleteJobId, handleOpenResolveDamageModal }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const damagedJobs = jobs.filter(j => {
      if (j.endJobDetails?.damageStatus !== 'Hasar var') return false;
      if (searchQuery.trim()) {
        return (j.customerName && j.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
               (j.customerPhone && j.customerPhone.includes(searchQuery));
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">Hasarlı İşler</h2>
              <p className="text-sm font-medium text-neutral-500">Operasyon sırasında hasar bildirimi yapılmış kayıtlar.</p>
            </div>
          </div>
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Müşteri Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {damagedJobs.length === 0 ? (
            <div className="col-span-full p-12 bg-white rounded-2xl shadow-sm border border-neutral-200 text-center text-neutral-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg font-medium">{searchQuery.trim() ? 'Aramanıza uygun hasarlı kayıt bulunamadı.' : 'Sistemde hasar kaydı bulunan operasyon bulunmuyor.'}</p>
            </div>
          ) : (
            damagedJobs.map(job => (
              <div key={job.id} className={`p-5 rounded-2xl shadow-sm border transition flex flex-col gap-4 ${job.endJobDetails?.damageResolved ? 'bg-white border-green-200 hover:border-green-400' : 'bg-red-50/30 border-red-200 hover:border-red-400'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-black text-lg">{job.customerName}</h3>
                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1 mt-1">
                      <CalendarDays className="w-3.5 h-3.5" /> {job.date} - {job.time}
                    </p>
                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {job.customerPhone}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm ${job.endJobDetails?.damageResolved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-600 text-white animate-pulse'}`}>
                    {job.endJobDetails?.damageResolved ? 'Çözüldü' : 'Çözüm Bekliyor'}
                  </span>
                </div>

                <div className="text-sm bg-white p-4 rounded-xl border border-red-100 flex-1 shadow-sm">
                  <p className="font-bold text-red-800 mb-1.5 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> Hasar Detayı:</p>
                  <p className="text-neutral-700 leading-relaxed text-xs">{job.endJobDetails?.damageDetails}</p>
                  
                  {job.endJobDetails?.damageResolved && job.endJobDetails?.damageResolutionNote && (
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <p className="font-bold text-green-800 mb-1.5 flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> Çözüm Notu:</p>
                      <p className="text-neutral-700 leading-relaxed text-xs">{job.endJobDetails.damageResolutionNote}</p>
                    </div>
                  )}
                </div>

                {job.endJobDetails?.damageImages && job.endJobDetails.damageImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {job.endJobDetails.damageImages.map((img, idx) => (
                      <button key={idx} onClick={() => setViewingImage({title: 'Hasar Fotoğrafı', name: img})} className="flex-1 py-2 bg-white border border-neutral-200 text-neutral-700 text-xs font-bold rounded-lg hover:bg-neutral-50 transition flex justify-center items-center gap-1.5 shadow-sm">
                        <Camera className="w-4 h-4" /> Foto {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-neutral-200/60">
                  {!job.endJobDetails?.damageResolved && (
                    <button onClick={() => handleOpenResolveDamageModal(job.id)} className="col-span-2 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition flex justify-center items-center gap-1.5 shadow-sm">
                      <CheckCircle className="w-4 h-4" /> Sorun Çözüldü Olarak İşaretle
                    </button>
                  )}
                  <button onClick={() => handleEditJob(job)} className="py-2.5 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-1.5 border border-neutral-200">
                    <Edit className="w-4 h-4" /> Düzenle
                  </button>
                  <button onClick={() => setDeleteJobId(job.id)} className="py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition flex justify-center items-center gap-1.5 border border-red-100">
                    <X className="w-4 h-4" /> Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  export const CancelledJobsView = ({ jobs, handleEditJob, handleRestoreJob, setDeleteJobId }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const cancelledJobs = jobs.filter(j => {
      if (j.status !== 'cancelled') return false;
      if (searchQuery.trim()) {
        return (j.customerName && j.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
               (j.customerPhone && j.customerPhone.includes(searchQuery));
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <Ban className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">İptal Edilen İşler</h2>
              <p className="text-sm font-medium text-neutral-500">İptal edilmiş operasyon kayıtları.</p>
            </div>
          </div>
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Müşteri Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cancelledJobs.length === 0 ? (
            <div className="col-span-full p-12 bg-white rounded-2xl shadow-sm border border-neutral-200 text-center text-neutral-500">
              <Ban className="w-16 h-16 mx-auto mb-4 text-red-500 opacity-50" />
              <p className="text-lg font-medium">{searchQuery.trim() ? 'Aramanıza uygun kayıt bulunamadı.' : 'Sistemde iptal edilmiş operasyon bulunmuyor.'}</p>
            </div>
          ) : (
            cancelledJobs.map(job => (
              <div key={job.id} className="bg-red-50/30 p-5 rounded-2xl shadow-sm border border-red-200 transition flex flex-col gap-4 hover:border-red-400">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-black text-lg line-through opacity-70">{job.customerName}</h3>
                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1 mt-1">
                      <CalendarDays className="w-3.5 h-3.5" /> {job.date} - {job.time}
                    </p>
                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {job.customerPhone}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm bg-red-100 text-red-800 border border-red-200">
                    İptal Edildi
                  </span>
                </div>

                <div className="text-sm bg-white p-3 rounded-xl border border-red-100 flex-1 shadow-sm">
                  <p className="font-bold text-neutral-800 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-neutral-400"/> Güzergah:</p>
                  <p className="text-neutral-600 text-xs">{job.fromDistrict} ➔ {job.toDistrict || 'Belirtilmedi'}</p>
                  {job.notes && (
                    <div className="mt-2 pt-2 border-t border-neutral-100">
                      <p className="text-xs font-bold text-neutral-700">Not:</p>
                      <p className="text-xs text-neutral-500">{job.notes}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-red-200/60">
                  <button onClick={() => handleRestoreJob(job.id)} className="col-span-2 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-xl hover:bg-green-100 transition flex justify-center items-center gap-1.5 shadow-sm border border-green-200">
                    <CheckCircle className="w-4 h-4" /> İşi Geri Al (Aktifleştir)
                  </button>
                  <button onClick={() => handleEditJob(job)} className="py-2.5 bg-white text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-50 transition flex justify-center items-center gap-1.5 border border-neutral-200">
                    <Edit className="w-4 h-4" /> Düzenle
                  </button>
                  <button onClick={() => setDeleteJobId(job.id)} className="py-2.5 bg-red-100 text-red-700 text-xs font-bold rounded-xl hover:bg-red-200 transition flex justify-center items-center gap-1.5 border border-red-200">
                    <X className="w-4 h-4" /> Kalıcı Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  export const AddVehicleView = ({ onAdd, onCancel }) => {
    const [formData, setFormData] = useState({
      plate: '', type: 'Kamyon', capacity: [], volume: '', km: '', model: '', color: 'Beyaz', transmission: 'Manuel', ruhsatFoto: '', vehiclePhoto: '', requiredLicense: 'Küçük Ehliyet'
    });

    const handleRuhsatUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setFormData(prev => ({ ...prev, ruhsatFoto: 'Yükleniyor...' }));
      const uploadData = new FormData();
      uploadData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: uploadData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setFormData(prev => ({ ...prev, ruhsatFoto: uploadedUrl }));
      } catch (err) {
        console.error('Ruhsat yükleme hatası:', err);
        setFormData(prev => ({ ...prev, ruhsatFoto: '' }));
      }
    };

    const handleVehiclePhotoUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setFormData(prev => ({ ...prev, vehiclePhoto: 'Yükleniyor...' }));
      const uploadData = new FormData();
      uploadData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: uploadData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setFormData(prev => ({ ...prev, vehiclePhoto: uploadedUrl }));
      } catch (err) {
        console.error('Araç fotoğrafı yükleme hatası:', err);
        setFormData(prev => ({ ...prev, vehiclePhoto: '' }));
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.plate || !formData.volume || !formData.km || !formData.model) return;
      onAdd(formData);
    };

    return (
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2"><PlusCircle className="w-6 h-6 text-red-600" /> Araç Ekle</h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-black transition"><X className="w-6 h-6" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Plakası</label>
              <input required type="text" value={formData.plate} onChange={(e) => setFormData({...formData, plate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition uppercase" placeholder="Örn: 34 ABC 123" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Cinsi</label>
              <select required value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                <option value="Kamyon">Kamyon</option>
                <option value="Kamyonet">Kamyonet</option>
                <option value="Panelvan">Panelvan</option>
                <option value="Minivan">Minivan</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Gerekli Ehliyet</label>
            <select required value={formData.requiredLicense} onChange={(e) => setFormData({...formData, requiredLicense: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
              <option value="Küçük Ehliyet">Küçük Ehliyet</option>
              <option value="Büyük Ehliyet">Büyük Ehliyet</option>
            </select>
          </div>

          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-red-600" /> Araç Eşya Alma Kapasitesi
            </label>
            <div className="flex flex-wrap gap-2">
              {['1+0', '1+1', '2+1', '3+1', '4+1'].map(cap => (
                <label key={cap} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border text-sm transition-all ${formData.capacity?.includes(cap) ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100'}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.capacity?.includes(cap)}
                    onChange={() => {
                      const newCap = formData.capacity?.includes(cap)
                        ? formData.capacity.filter(c => c !== cap)
                        : [...(formData.capacity || []), cap];
                      setFormData({...formData, capacity: newCap});
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
              <input required type="number" value={formData.volume} onChange={(e) => setFormData({...formData, volume: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Araç KM</label>
              <input required type="number" value={formData.km} onChange={(e) => setFormData({...formData, km: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Model (Yıl)</label>
              <input required type="number" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Renk</label>
              <select required value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                <option value="Beyaz">Beyaz</option>
                <option value="Gri">Gri</option>
                <option value="Siyah">Siyah</option>
                <option value="Yeşil">Yeşil</option>
                <option value="Kırmızı">Kırmızı</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Vites</label>
              <select required value={formData.transmission} onChange={(e) => setFormData({...formData, transmission: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                <option value="Manuel">Manuel</option>
                <option value="Otomatik">Otomatik</option>
              </select>
            </div>
          </div>

          {/* YENİ: Araç Ruhsat Fotoğrafı Ekleme */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" /> Araç Ruhsat Fotoğrafı
            </label>
            {formData.ruhsatFoto && formData.ruhsatFoto !== 'Yükleniyor...' && (
              isVideoUrl(formData.ruhsatFoto) ? (
                <video src={formData.ruhsatFoto} controls className="h-28 rounded-lg border border-neutral-200 mb-2 bg-black" />
              ) : (
                <img src={formData.ruhsatFoto} alt="Ruhsat" className="h-28 rounded-lg border border-neutral-200 mb-2 object-cover" />
              )
            )}
            <MediaCaptureMenu onChange={handleRuhsatUpload} buttonLabel="Ruhsat Fotoğrafı / Videosu Ekle" />
            {formData.ruhsatFoto === 'Yükleniyor...' && <p className="text-xs text-neutral-400 mt-1">Yükleniyor...</p>}
          </div>

          {/* YENİ: Araç Fotoğrafı */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4 text-red-600" /> Araç Fotoğrafı
            </label>
            {formData.vehiclePhoto && formData.vehiclePhoto !== 'Yükleniyor...' && (
              <img src={formData.vehiclePhoto} alt="Araç" className="h-28 rounded-lg border border-neutral-200 mb-2 object-cover" />
            )}
            <MediaCaptureMenu onChange={handleVehiclePhotoUpload} buttonLabel="Araç Fotoğrafı Ekle" />
            {formData.vehiclePhoto === 'Yükleniyor...' && <p className="text-xs text-neutral-400 mt-1">Yükleniyor...</p>}
          </div>

          <div className="flex gap-3 pt-4 border-t border-neutral-100">
            <button type="button" onClick={onCancel} className="flex-1 py-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">İptal</button>
            <button type="button" onClick={handleSubmit} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/20">Aracı Kaydet</button>
          </div>
        </div>
      </div>
    );
  };
  
  export const VehicleMaintenanceView = ({ vehicles, onUpdateVehicle, addSystemLog }) => {
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;
    
    const [recordForm, setRecordForm] = useState({
      type: 'Periyodik Bakım',
      date: new Date().toISOString().split('T')[0],
      km: '',
      cost: '',
      nextDate: '',
      nextKm: '',
      notes: ''
    });

    // --- YENİ: Kayıt düzenleme modu için state ---
    const [editingRecordInfo, setEditingRecordInfo] = useState(null); // { vehicleId, recordId } | null

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!selectedVehicle) return;

      // --- YENİ: Düzenleme modu ise var olan kaydı güncelle ---
      if (editingRecordInfo && editingRecordInfo.recordId) {
        const updatedRecords = (selectedVehicle.maintenanceRecords || []).map(r =>
          r.id === editingRecordInfo.recordId ? { ...r, ...recordForm } : r
        );

        let newKmEdit = selectedVehicle.km;
        if (recordForm.km && parseInt(recordForm.km) > parseInt(selectedVehicle.km || '0')) {
          newKmEdit = recordForm.km;
        }

        onUpdateVehicle({
          ...selectedVehicle,
          km: newKmEdit,
          maintenanceRecords: updatedRecords
        });

        addSystemLog('Araç Bakım Düzenlendi', `${selectedVehicle.plate} aracının ${recordForm.type} kaydı güncellendi.`);
        setEditingRecordInfo(null);
        setRecordForm({
          type: 'Periyodik Bakım',
          date: new Date().toISOString().split('T')[0],
          km: '',
          cost: '',
          nextDate: '',
          nextKm: '',
          notes: ''
        });
        return;
      }

      const newRecord = {
        id: Date.now().toString(),
        ...recordForm,
        createdAt: new Date().toISOString()
      };

      const updatedRecords = [...(selectedVehicle.maintenanceRecords || []), newRecord];
      
      let newKm = selectedVehicle.km;
      if (recordForm.km && parseInt(recordForm.km) > parseInt(selectedVehicle.km || '0')) {
        newKm = recordForm.km;
      }

      onUpdateVehicle({
        ...selectedVehicle,
        km: newKm,
        maintenanceRecords: updatedRecords
      });

      addSystemLog('Araç Bakım Eklendi', `${selectedVehicle.plate} aracına ${recordForm.type} kaydı girildi.`);
      
      setRecordForm({
        type: 'Periyodik Bakım',
        date: new Date().toISOString().split('T')[0],
        km: '',
        cost: '',
        nextDate: '',
        nextKm: '',
        notes: ''
      });
    };

    // --- YENİ: Bir kaydı düzenlemek için formu doldurup düzenleme moduna geçer ---
    const handleStartEdit = (vehicleId, record) => {
      setSelectedVehicleId(vehicleId);
      setEditingRecordInfo({ vehicleId, recordId: record.id });
      setRecordForm({
        type: record.type || 'Periyodik Bakım',
        date: record.date || new Date().toISOString().split('T')[0],
        km: record.km || '',
        cost: record.cost || '',
        nextDate: record.nextDate || '',
        nextKm: record.nextKm || '',
        notes: record.notes || ''
      });
    };

    // --- YENİ: Düzenleme modunu iptal eder ---
    const handleCancelEdit = () => {
      setEditingRecordInfo(null);
      setRecordForm({
        type: 'Periyodik Bakım',
        date: new Date().toISOString().split('T')[0],
        km: '',
        cost: '',
        nextDate: '',
        nextKm: '',
        notes: ''
      });
    };

    const handleDelete = (recordId) => {
      if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
      const updatedRecords = (selectedVehicle.maintenanceRecords || []).filter(r => r.id !== recordId);
      onUpdateVehicle({
        ...selectedVehicle,
        maintenanceRecords: updatedRecords
      });
    };

    // --- Kritik Durum Hesaplama ---
    const todayStr = new Date().toISOString().split('T')[0];
    const criticalAlerts = [];
    vehicles.forEach(v => {
      if (v.maintenanceRecords) {
        v.maintenanceRecords.forEach(r => {
           let isCritical = false;
           let reason = '';
           if (r.nextDate && r.nextDate <= todayStr) { isCritical = true; reason = 'Tarihi Geçti/Yaklaştı'; }
           if (r.nextKm && v.km && parseInt(v.km) >= parseInt(r.nextKm)) { isCritical = true; reason = 'KM Sınırı Aşıldı'; }
           if (isCritical) criticalAlerts.push({ vehicle: v.plate, type: r.type, reason, nextDate: r.nextDate, nextKm: r.nextKm });
        });
      }
    });

    // --- Son İşlemler Hesaplama ---
    let allRecords = [];
    vehicles.forEach(v => {
       if (v.maintenanceRecords) {
           v.maintenanceRecords.forEach(r => {
               allRecords.push({ ...r, plate: v.plate, vehicleId: v.id });
           });
       }
    });
    allRecords.sort((a,b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    // YENİ: Artık sadece son 5 değil, bugüne kadar eklenen TÜM kayıtlar (aşağıda kaydırmalı alanda) gösteriliyor
    const recentRecords = allRecords;

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-8">
        <h2 className="text-2xl font-black text-black flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Activity className="w-7 h-7 text-red-600" /> Araç Rapor & Bakım Yönetimi
        </h2>

        {/* İşlem Yapılacak Aracı Seçin */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-black mb-3">İşlem Yapılacak Aracı Seçin</h3>
          <select 
            value={selectedVehicleId} 
            onChange={(e) => setSelectedVehicleId(e.target.value)} 
            className="w-full md:w-[400px] p-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-base cursor-pointer shadow-sm transition hover:border-red-400"
          >
            <option value="">-- Araç Seçiniz --</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate} ({v.type})</option>
            ))}
          </select>

          {selectedVehicle && (
            <div className="mt-8 pt-8 border-t border-neutral-200 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-4">
              
              {/* Form Bölümü */}
              <div>
                <h3 className="text-lg font-black text-black mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-red-600" />
                    {editingRecordInfo ? 'Kaydı Düzenle' : 'Rapor / Bakım Ekle'}
                  </span>
                  <span className="text-xs bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200">{selectedVehicle.plate}</span>
                </h3>
                <div  className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">İşlem Türü</label>
                      <select required value={recordForm.type} onChange={e => setRecordForm({...recordForm, type: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium">
                        <option value="Periyodik Bakım">Periyodik Bakım (Yağ/Filtre)</option>
                        <option value="Araç Muayenesi">Araç Muayenesi</option>
                        <option value="Sigorta / Kasko">Sigorta / Kasko</option>
                        <option value="Lastik Değişimi">Lastik Değişimi</option>
                        <option value="Arıza / Tamir">Arıza / Tamir</option>
                        <option value="Ceza / Trafik">Ceza / Trafik</option>
                        <option value="Diğer">Diğer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Tarih</label>
                      <input required type="date" value={recordForm.date} onChange={e => setRecordForm({...recordForm, date: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">İşlem Yapılan KM</label>
                      <input required type="number" value={recordForm.km} onChange={e => setRecordForm({...recordForm, km: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" placeholder={selectedVehicle.km} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Maliyet (TL)</label>
                      <input type="number" value={recordForm.cost} onChange={e => setRecordForm({...recordForm, cost: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Gelecek İşlem Tarihi</label>
                      <input type="date" value={recordForm.nextDate} onChange={e => setRecordForm({...recordForm, nextDate: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" title="Muayene veya Sigorta bitiş tarihi" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Gelecek İşlem KM</label>
                      <input type="number" value={recordForm.nextKm} onChange={e => setRecordForm({...recordForm, nextKm: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" placeholder="Sonraki bakım KM'si" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Detaylar / Notlar</label>
                    <textarea value={recordForm.notes} onChange={e => setRecordForm({...recordForm, notes: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-20 resize-none" placeholder="Değişen parçalar, muayene istasyonu vb..."></textarea>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSubmit} className="flex-1 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/30">
                      <Save className="w-5 h-5" /> {editingRecordInfo ? 'Kaydı Güncelle' : 'Kaydı Ekle'}
                    </button>
                    {editingRecordInfo && (
                      <button type="button" onClick={handleCancelEdit} className="px-5 py-4 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition">
                        Vazgeç
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Geçmiş Kayıtlar Bölümü */}
              <div className="flex flex-col overflow-hidden">
                <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3 shrink-0">
                  <History className="w-5 h-5 text-neutral-600" /> {selectedVehicle.plate} Geçmiş Kayıtları
                </h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 max-h-[500px]">
                  {!(selectedVehicle.maintenanceRecords && selectedVehicle.maintenanceRecords.length > 0) ? (
                    <p className="text-center text-sm text-neutral-500 italic py-10 bg-neutral-50 rounded-xl border border-neutral-200">Bu araca ait kayıt bulunmuyor.</p>
                  ) : (
                    [...(selectedVehicle.maintenanceRecords)].sort((a,b)=> new Date(b.date) - new Date(a.date)).map(record => (
                      <div key={record.id} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex flex-col sm:flex-row gap-4 justify-between relative group shadow-sm transition hover:border-red-200">
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => handleStartEdit(selectedVehicle.id, record)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg" title="Düzenle"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => handleDelete(record.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg" title="Sil"><X className="w-4 h-4"/></button>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-black text-base">{record.type}</span>
                            <span className="text-[10px] bg-white border border-neutral-200 px-2 py-0.5 rounded font-bold text-neutral-600"><CalendarDays className="w-3 h-3 inline mr-1"/>{record.date}</span>
                          </div>
                          <p className="text-xs text-neutral-600 font-medium mb-2">{record.notes}</p>
                          <div className="flex flex-wrap gap-2">
                            {record.km && <span className="text-[10px] font-bold bg-neutral-200 text-neutral-700 px-2 py-1 rounded">İşlem: {record.km} KM</span>}
                            {record.nextKm && <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-200">Sonraki: {record.nextKm} KM</span>}
                            {record.nextDate && <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200">Sonraki: {record.nextDate}</span>}
                          </div>
                        </div>
                        {record.cost && (
                          <div className="sm:text-right shrink-0 mt-2 sm:mt-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start">
                            <span className="block text-xs font-bold text-neutral-500 uppercase">Maliyet</span>
                            <span className="text-lg font-black text-red-600">₺{parseInt(record.cost).toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Filo Kritik Durum */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" /> Filo Kritik Durum & Hatırlatmalar
          </h3>
          {criticalAlerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 text-green-700 p-5 rounded-xl flex items-center gap-3 font-bold">
              <CheckCircle className="w-6 h-6" /> Sistemde yaklaşan veya gecikmiş hiçbir bakım/muayene bulunmuyor. Harika!
            </div>
          ) : (
            <div className="space-y-3">
              {criticalAlerts.map((alert, i) => (
                <div key={i} className="bg-red-50 border border-red-200 p-4 rounded-xl flex justify-between items-center text-sm shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-red-900 text-base">{alert.vehicle} - {alert.type}</span>
                    <span className="text-red-700 font-medium">{alert.reason} {alert.nextDate ? `(${alert.nextDate})` : ''} {alert.nextKm ? `(${alert.nextKm} KM)` : ''}</span>
                  </div>
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Son Eklenen İşlemler */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2"><History className="w-6 h-6 text-blue-500" /> Son Eklenen İşlemler</span>
            <span className="text-xs bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200 font-bold text-neutral-500">{recentRecords.length} kayıt</span>
          </h3>
          {recentRecords.length === 0 ? (
            <p className="text-sm text-neutral-500 font-medium">Henüz herhangi bir araca bakım kaydı eklenmemiş.</p>
          ) : (
            /* YENİ: Bugüne kadarki tüm kayıtlar artık kaydırmalı (scroll) bir alanda listeleniyor */
            <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-2">
              {recentRecords.map(r => (
                <div key={r.id} className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl flex justify-between items-center text-sm shadow-sm transition hover:border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Car className="w-4 h-4"/></div>
                    <div>
                      <span className="font-black text-black text-base block mb-0.5">{r.plate}</span>
                      <span className="text-neutral-600 font-medium">{r.type} <span className="text-[10px] text-neutral-400 ml-1">({r.date})</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-green-600 text-base">{r.cost ? `₺${parseInt(r.cost).toLocaleString('tr-TR')}` : ''}</span>
                    {/* YENİ: Duruma göre düzenleme butonu */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(r.vehicleId, r)}
                      className="p-2 bg-white border border-neutral-200 text-neutral-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition shrink-0"
                      title="Bu kaydı düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  };
  
  // --- YENİ: ARAÇ PROFİLİ SAYFASI ---
  // Bu bileşen TAMAMEN YENİ ve EKLENTİ niteliğindedir. Mevcut araç
  // ekleme/düzenleme/bakım mantığına hiç dokunulmadı.
  export const VehicleProfileView = ({ vehicleId, vehicles, jobs, onBack, setViewingRuhsatUrl, handleEditJob }) => {
    const vehicle = vehicles.find(v => String(v.id) === String(vehicleId));

    const [periodFilter, setPeriodFilter] = useState('month'); // week | month | year | all

    if (!vehicle) {
      return (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center animate-in fade-in">
          <button onClick={onBack} className="mb-4 text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Listeye Geri Dön
          </button>
          <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">Araç bulunamadı.</p>
        </div>
      );
    }

    const getPeriodStart = () => {
      const now = new Date();
      if (periodFilter === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      if (periodFilter === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
      if (periodFilter === 'year') return new Date(now.getFullYear(), 0, 1);
      return null;
    };
    const periodStart = getPeriodStart();

    const vehicleJobs = jobs.filter(j => j.assignedVehiclePlate === vehicle.plate).sort((a, b) => new Date(b.date) - new Date(a.date));
    const periodJobs = periodStart ? vehicleJobs.filter(j => new Date(j.date) >= periodStart) : vehicleJobs;

    // --- Muayene / Kritik Bakım Bilgisi ---
    const todayStr = new Date().toISOString().split('T')[0];
    const muayeneRecords = (vehicle.maintenanceRecords || []).filter(r => r.type === 'Araç Muayenesi').sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestMuayene = muayeneRecords[0];
    const muayeneDue = latestMuayene?.nextDate && latestMuayene.nextDate <= todayStr;

    const allAlerts = (vehicle.maintenanceRecords || []).filter(r => {
      let isCritical = false;
      if (r.nextDate && r.nextDate <= todayStr) isCritical = true;
      if (r.nextKm && vehicle.km && parseInt(vehicle.km) >= parseInt(r.nextKm)) isCritical = true;
      return isCritical;
    });

    const recentMaintenance = [...(vehicle.maintenanceRecords || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-8">
        <button onClick={onBack} className="text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Listeye Geri Dön
        </button>

        {/* Araç Bilgileri */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-4">
            <Car className="w-6 h-6 text-red-600" /> Araç Profili
          </h2>
          <div className="flex items-center gap-4 mb-5">
            {vehicle.vehiclePhoto && vehicle.vehiclePhoto !== 'Yükleniyor...' ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-neutral-200 shadow-sm">
                <img src={vehicle.vehiclePhoto} alt={vehicle.plate} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                <Truck className="w-8 h-8 text-purple-600" />
              </div>
            )}
            <div>
              <div className="border-2 border-black rounded px-3 py-1.5 inline-flex items-center gap-2 bg-white shadow-sm mb-1.5">
                <span className="bg-blue-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-sm">TR</span>
                <span className="tracking-widest font-black text-xl">{vehicle.plate.toUpperCase()}</span>
              </div>
              <p className="text-neutral-500 text-sm font-bold">{vehicle.type} • {vehicle.model} Model</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-sm mb-4">
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Güncel KM</span><p className="font-bold text-black">{vehicle.km || '-'}</p></div>
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Hacim</span><p className="font-bold text-black">{vehicle.volume ? `${vehicle.volume} m³` : '-'}</p></div>
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Renk</span><p className="font-bold text-black">{vehicle.color || '-'}</p></div>
            <div><span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Vites</span><p className="font-bold text-black">{vehicle.transmission || '-'}</p></div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {(vehicle.capacity || []).map(cap => (
              <span key={cap} className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100">{cap} Ev</span>
            ))}
          </div>

          {vehicle.ruhsatFoto && vehicle.ruhsatFoto !== 'Yükleniyor...' ? (
            <button onClick={() => setViewingRuhsatUrl(vehicle.ruhsatFoto)} className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-bold rounded-xl transition flex items-center gap-2 w-max">
              <FileText className="w-4 h-4" /> Ruhsatı Gör
            </button>
          ) : (
            <span className="text-xs text-neutral-400 font-medium italic">Ruhsat fotoğrafı yüklenmemiş.</span>
          )}
        </div>

        {/* Muayene / Kritik Durum */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-orange-500" /> Muayene ve Kritik Durum</h3>
          <div className={`p-4 rounded-xl border mb-4 ${muayeneDue ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <span className={`text-[10px] font-bold uppercase block mb-1 ${muayeneDue ? 'text-red-600' : 'text-green-700'}`}>Son Muayene Kaydı</span>
            {latestMuayene ? (
              <p className={`font-black ${muayeneDue ? 'text-red-700' : 'text-green-800'}`}>
                {latestMuayene.date} tarihinde yapıldı. {latestMuayene.nextDate ? `Sonraki muayene: ${latestMuayene.nextDate}` : ''} {muayeneDue && '— GECİKMİŞ / YAKLAŞIYOR!'}
              </p>
            ) : (
              <p className="font-bold text-neutral-500">Sistemde kayıtlı bir muayene bilgisi bulunmuyor.</p>
            )}
          </div>

          {allAlerts.length > 0 && (
            <div className="space-y-2">
              {allAlerts.map((a, i) => (
                <div key={i} className="bg-red-50 border border-red-200 p-3 rounded-xl flex justify-between items-center text-sm">
                  <span className="font-bold text-red-900">{a.type}</span>
                  <span className="text-red-700 font-medium text-xs">{a.nextDate ? `Tarih: ${a.nextDate}` : ''} {a.nextKm ? `KM: ${a.nextKm}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bu Dönem Kaç İşe Gitti */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><BarChart className="w-6 h-6 text-blue-600" /> Operasyon Özeti</h3>
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              {[{ k: 'week', l: 'Haftalık' }, { k: 'month', l: 'Aylık' }, { k: 'year', l: 'Bu Sene' }, { k: 'all', l: 'Tüm Zamanlar' }].map(opt => (
                <button key={opt.k} type="button" onClick={() => setPeriodFilter(opt.k)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${periodFilter === opt.k ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-center mb-4">
            <span className="text-3xl font-black text-black block">{periodJobs.length}</span>
            <span className="text-xs font-bold text-neutral-500">Bu Dönemde Gidilen İş</span>
          </div>

          <h4 className="font-bold text-sm text-neutral-600 mb-2">Gittiği İşler</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {periodJobs.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Bu dönemde bu araçla yapılmış bir iş bulunamadı.</p>
            ) : periodJobs.map(job => (
              <div key={job.id} className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-black block">{job.customerName}</span>
                  <span className="text-[10px] text-neutral-500 font-bold">{job.date} • {job.type || 'Nakliye'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${job.status === 'completed' ? 'bg-black text-white' : job.status === 'in-progress' ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                    {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
                  </span>
                  <button onClick={() => handleEditJob(job)} className="px-2.5 py-1.5 bg-white border border-neutral-200 text-neutral-600 text-[10px] font-bold rounded-lg hover:bg-neutral-100 transition flex items-center gap-1 whitespace-nowrap">
                    İşe Git <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Son Bakım Kayıtları */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><History className="w-6 h-6 text-neutral-600" /> Son Bakım Kayıtları</h3>
          <div className="space-y-2">
            {recentMaintenance.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Henüz bakım kaydı girilmemiş.</p>
            ) : recentMaintenance.map(r => (
              <div key={r.id} className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-black block">{r.type}</span>
                  <span className="text-[10px] text-neutral-500 font-bold">{r.date} {r.km ? `• ${r.km} KM'de yapıldı` : ''}</span>
                </div>
                {r.cost && <span className="font-black text-red-600 text-sm">₺{parseInt(r.cost).toLocaleString('tr-TR')}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  export const AddPersonnelView = ({ onAdd, positions, ranks }) => {
    const [formData, setFormData] = useState({
      fullName: '', email: '', password: '', position: positions?.[0] || 'Şoför', rank: ranks?.[0] || 'Standart',
      collarType: 'Mavi Yaka', employmentStatus: 'Aktif',
      personalPhone: '', companyPhone: '', iban: '', tcNo: '', setcard: '', address: '', profileImage: '',
      bankaParasi: '', maas: '', yemek: '', yol: '', icrasiVar: 'Hayır', startDate: new Date().toISOString().split('T')[0]
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
        personalPhone: '', companyPhone: '', iban: '', tcNo: '', setcard: '', address: '', profileImage: '',
        bankaParasi: '', maas: '', yemek: '', yol: '', icrasiVar: 'Hayır', startDate: new Date().toISOString().split('T')[0]
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
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">SetCard Numarası</label>
              <input type="text" value={formData.setcard} onChange={e => setFormData({...formData, setcard: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="SetCard Numarası" />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-neutral-700 mb-1">Yaka Tipi *</label>
              <select value={formData.collarType} onChange={e => setFormData({...formData, collarType: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-medium text-neutral-700 cursor-pointer">
                <option value="Mavi Yaka">Mavi Yaka</option>
                <option value="Beyaz Yaka">Beyaz Yaka</option>
              </select>
            </div>
            <div className="hidden md:block"></div> {/* Boşluk için */}
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Banka IBAN Numarası</label>
            <input type="text" value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-mono text-sm uppercase transition" placeholder="TR..." />
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres</label>
            <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition h-20 resize-none" placeholder="Personel adresi..."></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Maaş Ücreti (TL)</label>
                <input type="number" value={formData.maas} onChange={e => setFormData({...formData, maas: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Yol Parası (TL)</label>
                <input type="number" value={formData.yol} onChange={e => setFormData({...formData, yol: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Yemek Parası (TL)</label>
                <input type="number" value={formData.yemek} onChange={e => setFormData({...formData, yemek: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
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
  export const PersonnelListView = ({ personnelList, onUpdate, positions = [], ranks = [], onViewProfile, pendingEditPersonnelId, setPendingEditPersonnelId }) => {
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

    const filteredList = personnelList.filter(p => {
      if (filterYaka && p.collarType !== filterYaka) return false;
      if (filterPozisyon && p.position !== filterPozisyon) return false;
      if (filterRutbe && p.rank !== filterRutbe) return false;
      const durum = p.employmentStatus === 'Pasif' ? 'Pasif' : 'Aktif';
      if (filterDurum === 'Aktif' && durum !== 'Aktif') return false;
      if (filterDurum === 'Pasif' && durum !== 'Pasif') return false;
      return true;
    });

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
                  <div className="hidden md:block"></div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Banka IBAN Numarası</label>
                  <input type="text" value={editingUser.iban || ''} onChange={e => setEditingUser({...editingUser, iban: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-mono text-sm uppercase transition" placeholder="TR..." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres</label>
                  <textarea value={editingUser.address || ''} onChange={e => setEditingUser({...editingUser, address: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition h-20 resize-none" placeholder="Personel adresi..."></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Maaş Ücreti (TL)</label>
                      <input type="number" value={editingUser.maas || ''} onChange={e => setEditingUser({...editingUser, maas: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Yol Parası (TL)</label>
                      <input type="number" value={editingUser.yol || ''} onChange={e => setEditingUser({...editingUser, yol: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Yemek Parası (TL)</label>
                      <input type="number" value={editingUser.yemek || ''} onChange={e => setEditingUser({...editingUser, yemek: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
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
    const [resignForm, setResignForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '' });

    // YENİ: İşten çıkış HESAP DÖKÜMÜ / kesin hesap kapama akışı için state'ler
    // (Yemek/Yol iadesi, İcra, çalışılan gün, kalan banka/nakit tablosu + onay + imzalı belge)
    const [showSettlementModal, setShowSettlementModal] = useState(false); // hesap dökümü tablosu penceresi
    const [settlementData, setSettlementData] = useState(null); // hesaplanan döküm
    const [settlementConfirm, setSettlementConfirm] = useState({ nakitVerildi: false, bankaVerildi: false, belgeUrl: '' });
    const [settlementUploading, setSettlementUploading] = useState(false);

    // YENİ: Personel Hareket İşlemleri (Avans, Maaş/Yol/Yemek Onayı, Tutanak, Rapor)
    const [personnelActions, setPersonnelActions] = useState([]);
    const nowMonth = new Date().toISOString().split('T')[0].substring(0, 7); // YYYY-MM
    const [showAvansModal, setShowAvansModal] = useState(false);
    const [avansForm, setAvansForm] = useState({ type: 'nakit', amount: '', month: nowMonth, note: '' });
    // YENİ: Maaş / Yol / Yemek durumu artık Mavi/Beyaz Maaş Tablosu'ndaki tiklerden otomatik okunur (bildirim mantığı)
    const [financeMonth, setFinanceMonth] = useState(nowMonth); // YYYY-MM, her zaman şimdiki ay seçili başlar
    const [financeMonthRow, setFinanceMonthRow] = useState({});
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

    // YENİ: Prim Ödeme Gir — Maaş Tablosu'ndaki prim (fazla mesai saati) alanına saat veya tutar girişi
    const [showPrimModal, setShowPrimModal] = useState(false);
    const [primForm, setPrimForm] = useState({ mode: 'tutar', value: '', month: nowMonth, note: '' });
    const [primSubmitting, setPrimSubmitting] = useState(false);

    // YENİ: Otomatik özellik puanı hesaplaması için TÜM personelin üzerine, sadece bu kişiye
    // ait manuel Performans Değerlendirme düzeltmeleri Firestore'dan dinlenir.
    const autoSkillsMap = React.useMemo(() => computeAllAutoSkills(personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords), [personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords]);
    const autoSkills = autoSkillsMap[String(personId)] || {};
    const isManagerUser = currentUser?.rank === 'Müdür' || currentUser?.position === 'Firma Sahibi' || currentUser?.permissions?.canEdit;
    const [skillAdjustments, setSkillAdjustments] = useState([]);
    useEffect(() => {
      if (!personId || !db) return;
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
    // YENİ: Bu personelin ekibine yazılmış (hasar var) işlerin dönem içi sayısı ve son hasarlı işler listesi
    const periodDamagesCount = periodJobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').length;
    const recentDamagedJobs = personJobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var').slice(0, 5);

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
    const periodFazlaMesaiSayisi = personMesaiForPeriod.filter(m => ['FG', 'FGM', 'FM'].includes(m.code)).length;
    const periodRaporGunSayisi = personMesaiForPeriod.filter(m => m.code === 'R').length;
    const periodDevamsizlikSayisi = personMesaiForPeriod.filter(m => m.code === 'D').length;
    const periodUcretsizIzinSayisi = personMesaiForPeriod.filter(m => m.code === 'Üİ').length;
    const periodUcretliIzinSayisi = personMesaiForPeriod.filter(m => m.code === 'Yİ').length;

    // YENİ: Özellikler bölümü sadece Mavi Yaka'da gösterilir; Temizlik Görevlisi ve
    // Asansör Operatörü hariç.
    const isMaviYakaPerson = person && (person.collarType === 'Mavi Yaka' || (!person.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Operatör'].includes(person.position)));
    const skillsHiddenPositions = ['Temizlik Görevlisi', 'Operatör'];
    const showSkillsSection = isMaviYakaPerson && !skillsHiddenPositions.includes(person?.position);
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
    const computeSettlement = (dateStr) => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const resignDay = d.getDate();
      const daysInMonth = new Date(year, month, 0).getDate();
      const calışılanGun = resignDay;        // ayın 1'inden ayrılış gününe kadar çalıştı sayılır
      const calışılmayanGun = daysInMonth - resignDay;

      const maas = parseFloat(person.maas) || 0;
      const bankaParasiBase = parseFloat(person.bankaParasi) || 0;
      const yemekAylik = parseFloat(person.yemek) || 0;
      const yolAylik = parseFloat(person.yol) || 0;

      // YENİ: Gerçek puantaj verisiyle kırılım — ayın 1'inden ayrılış gününe kadar
      // Devamsız/Rapor/Ücretsiz İzin günleri "Ödenecek Gün"den düşülür; Fazla Mesai/Gün günleri
      // fazla mesai ücreti olarak ayrıca eklenir.
      const personMesaiUpToResign = (allMesaiRecords || []).filter(m => String(m.personId) === String(personId) && m.year === year && m.month === month && m.day <= resignDay);
      const devamsizGun = personMesaiUpToResign.filter(m => m.code === 'D').length;
      const raporGun = personMesaiUpToResign.filter(m => m.code === 'R').length;
      const ucretsizIzinGun = personMesaiUpToResign.filter(m => m.code === 'Üİ').length;
      const fazlaGunSayisi = personMesaiUpToResign.filter(m => ['FG', 'FGM', 'FM'].includes(m.code)).length;
      const odenecekGun = Math.max(0, calışılanGun - devamsizGun - raporGun - ucretsizIzinGun);

      // Maaş tablosu ile aynı formüller (Devamsız/Rapor/Ücretsiz İzin düşülmüş "Ödenecek Gün"e orantılı)
      const hesaplananBanka = (bankaParasiBase / 30) * odenecekGun;
      const icraKesintisi = person.icrasiVar === 'Evet' ? (hesaplananBanka / 4) : 0;
      const saatlikUcret = maas / 200;
      const fazlaMesaiUcreti = saatlikUcret * ((fazlaGunSayisi * 10) - (devamsizGun * 3));
      const netMaas = (maas / 30) * odenecekGun + fazlaMesaiUcreti;

      // Peşin verilen yemek/yol'un, çalışılmayan güne düşen İADE tutarı
      const yemekIade = (yemekAylik / daysInMonth) * calışılmayanGun;
      const yolIade = (yolAylik / daysInMonth) * calışılmayanGun;
      const toplamIade = yemekIade + yolIade;

      // Kalan tutarlar (avans bu ekranda 0 kabul; profil ana kaynağı maaş tablosudur)
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

      setSettlementData({
        dateStr, year, month, daysInMonth, calışılanGun, calışılmayanGun,
        devamsizGun, raporGun, ucretsizIzinGun, fazlaGunSayisi, odenecekGun, fazlaMesaiUcreti,
        maas, netMaas, hesaplananBanka, icraKesintisi,
        yemekAylik, yolAylik, yemekIade, yolIade, toplamIade,
        nakittenDusulen, bankadanDusulen,
        finalKalanNakit: Math.max(0, kalanNakit),
        finalKalanBanka: Math.max(0, kalanBanka)
      });
      setSettlementConfirm({ nakitVerildi: false, bankaVerildi: false, belgeUrl: '' });
      setShowSettlementModal(true);
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
    const financeSaatlikUcret = (parseFloat(person.maas) || 0) / 200;
    const financePrimSaat = parseFloat(financeMonthRow.prim) || 0;
    const financePrimHesaplananTutar = financePrimSaat * financeSaatlikUcret;
    const financePrimManuelTutar = parseFloat(financeMonthRow.primOdenenTutar) || 0;
    const financePrimTutar = financePrimManuelTutar > 0 ? financePrimManuelTutar : financePrimHesaplananTutar;
    const financePrimOdendi = financePrimManuelTutar > 0 || (financeFullyPaid && financePrimSaat > 0);
    const primStatusText = financePrimOdendi ? `${financeMonthLabel} Prim Ödendi (₺${financePrimTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})})` : (financePrimTutar > 0 ? `${financeMonthLabel} Prim Bekleniyor (₺${financePrimTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})})` : `${financeMonthLabel} Prim Bekleniyor`);
    const primStatusStyle = financePrimOdendi ? 'bg-green-50 border-green-200 text-green-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500';

    const [financeYearNum, financeMonthNum] = financeMonth.split('-').map(v => parseInt(v));
    const financePersonMesai = (allMesaiRecords || []).filter(m => String(m.personId) === String(personId) && m.year === financeYearNum && m.month === financeMonthNum);
    const financeFazlaGunSayisi = financePersonMesai.filter(m => ['FG', 'FGM', 'FM'].includes(m.code)).length;
    const financeDevamsizGunSayisi = financePersonMesai.filter(m => m.code === 'D').length;
    const financeMesaiSaat = (financeFazlaGunSayisi * 10) - (financeDevamsizGunSayisi * 3) + financePrimSaat;
    const financeMesaiTutar = financeMesaiSaat * financeSaatlikUcret;

    const financeAvansTutar = (parseFloat(financeMonthRow.nakitAvans) || 0) + (parseFloat(financeMonthRow.resmiAvans) || 0);
    const financeKalanOdenenTutar = (financeMonthRow.bankaOdendi ? (parseFloat(financeMonthRow.bankaOdenenTutar) || 0) : 0) + (financeMonthRow.nakitOdendi ? (parseFloat(financeMonthRow.nakitOdenenTutar) || 0) : 0);
    const financeMaasOdenenTutar = financeAvansTutar + financeKalanOdenenTutar;
    const financeYemekTutar = parseFloat(financeMonthRow.yemekOdenenTutar) || 0;
    const financeYolTutar = parseFloat(financeMonthRow.yolOdenenTutar) || 0;
    const financeToplamOdenenTutar = financeMaasOdenenTutar + (financeMonthRow.yolOdendi ? financeYolTutar : 0) + (financeMonthRow.yemekOdendi ? financeYemekTutar : 0) + (financePrimOdendi ? financePrimTutar : 0);

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

    // Maaş tablosundaki (personnelMaas) ilgili aya avans/onay verisini işleyen ortak fonksiyon
    const applyToMaasRow = async (monthStr, patch) => {
      const [y, m] = monthStr.split('-');
      const maasRef = doc(db, 'artifacts', appId, 'public', 'data', 'personnelMaas', `${maasDocPrefix}${parseInt(y)}_${parseInt(m)}`);
      const snap = await getDoc(maasRef);
      const data = snap.exists() ? snap.data() : { rows: {} };
      const rows = data.rows || {};
      const existingRow = rows[personId] || {};
      rows[personId] = { ...existingRow, ...patch(existingRow) };
      await setDoc(maasRef, { rows, updatedAt: new Date().toISOString() }, { merge: true });
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
      const fieldKey = avansForm.type === 'nakit' ? 'nakitAvans' : 'resmiAvans';
      try {
        await applyToMaasRow(avansForm.month, (row) => ({
          [fieldKey]: (parseFloat(row[fieldKey]) || 0) + amount
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

        // O anki kullanılabilir kalan nakit (yaklaşık): netMaas - hesaplananBanka - mevcutNakitAvans
        const kullanilabilirNakit = Math.max(0, netMaas - hesaplananBanka - mevcutNakitAvans);
        const nakittenDusulecek = Math.min(amount, kullanilabilirNakit);
        const bankadanDusulecek = amount - nakittenDusulecek;

        // Maaş satırını güncelle: nakit ve (gerekirse) banka avansına yansıt
        records[personId] = {
          ...row,
          nakitAvans: mevcutNakitAvans + nakittenDusulecek,
          resmiAvans: mevcutResmiAvans + bankadanDusulecek
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
          note: `${debtForm.note ? debtForm.note + ' • ' : ''}Nakitten: ₺${nakittenDusulecek.toLocaleString('tr-TR')}${bankadanDusulecek > 0 ? ` • Bankadan: ₺${bankadanDusulecek.toLocaleString('tr-TR')}` : ''}`
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
    // YENİ: Seçilen tutanak şablonunu personel bilgileriyle doldurup yazdırma penceresinde açar
    const generateTutanakPDF = () => {
      const template = TUTANAK_TEMPLATES.find(t => t.key === tutanakTemplateKey);
      if (!template) { alert('Lütfen önce bir tutanak şablonu seçin.'); return; }
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
          ${template.body(person, tutanakForm)}
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

    const handleTutanakSubmit = async (e) => {
      e.preventDefault();
      if (!tutanakForm.title) return;
      try {
        // Özlük dosyasına otomatik ekle
        if (tutanakForm.fileUrl) {
          const ozluk = person.ozlukDosyalari || {};
          const key = `tutanak_${Date.now()}`;
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
            ozlukDosyalari: { ...ozluk, [key]: { name: `Tutanak: ${tutanakForm.title}`, url: tutanakForm.fileUrl, date: tutanakForm.date } }
          });
        }
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
        if (raporForm.fileUrl) {
          const ozluk = person.ozlukDosyalari || {};
          const key = `rapor_${Date.now()}`;
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(personId)), {
            ozlukDosyalari: { ...ozluk, [key]: { name: `Sağlık Raporu (${raporForm.startDate})`, url: raporForm.fileUrl, date: raporForm.startDate } }
          });
        }
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
    const [selectedLeaveYear, setSelectedLeaveYear] = useState(String(currentYear));
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
              <p className="text-neutral-500 text-sm font-bold">{person.position} • {person.rank}</p>
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
                  <p className="mt-2 text-[11px] font-bold text-green-300 bg-green-900/40 border border-green-700 rounded-lg px-2 py-1.5 inline-block">✓ Tüm maaş ödemesi ve sözleşmeler imzalandı. Çıkış tamamlandı.</p>
                ) : (
                  <button type="button" onClick={() => computeSettlement(person.resignationDate)} className="mt-2 px-3 py-2 bg-white text-neutral-900 text-xs font-black rounded-lg hover:bg-neutral-100 transition flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Çıkış Hesap Dökümünü Aç / Tamamla
                  </button>
                )}
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
            <button type="button" onClick={() => { setAvansForm({ type: 'nakit', amount: '', month: nowMonth, note: '' }); setShowAvansModal(true); }} className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1.5">
              <DollarSign className="w-5 h-5" /> Avans Girişi Yap
            </button>
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
          </div>
        </div>

        {/* YENİ: Maaş / Yol / Yemek / Prim / Mesai Durumu — artık buton değil, Maaş Tablosu tiklerinden otomatik okunan bildirim */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><Wallet className="w-6 h-6 text-green-600" /> Maaş / Yol / Yemek Durumu</h3>
            <input
              type="month"
              value={financeMonth}
              onChange={e => setFinanceMonth(e.target.value || nowMonth)}
              className="p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-green-600 font-bold text-sm bg-white"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-4 rounded-xl border-2 ${maasStatusStyle} flex items-center gap-3`}>
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Maaş Durumu</span>
                <span className="block font-black text-sm leading-snug">{maasStatusText}</span>
              </div>
            </div>
            <div className={`p-4 rounded-xl border-2 ${yolStatusStyle} flex items-center gap-3`}>
              <Car className="w-6 h-6 shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Yol Parası Durumu</span>
                <span className="block font-black text-sm leading-snug">{yolStatusText}</span>
              </div>
            </div>
            <div className={`p-4 rounded-xl border-2 ${yemekStatusStyle} flex items-center gap-3`}>
              <CreditCard className="w-6 h-6 shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Yemek Kartı Durumu</span>
                <span className="block font-black text-sm leading-snug">{yemekStatusText}</span>
              </div>
            </div>
            <div className={`p-4 rounded-xl border-2 ${primStatusStyle} flex items-center gap-3`}>
              <Star className="w-6 h-6 shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Prim Durumu</span>
                <span className="block font-black text-sm leading-snug">{primStatusText}</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border-2 bg-blue-50 border-blue-200 text-blue-700 flex items-center gap-3 md:col-span-2">
              <Clock className="w-6 h-6 shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Mesai Durumu ({financeMonthLabel})</span>
                <span className="block font-black text-sm leading-snug">{financeMesaiSaat.toFixed(1)} Saat (₺{financeMesaiTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})})</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between items-center">
            <span className="text-sm font-bold text-neutral-500">Toplam Ödenen ({financeMonthLabel})</span>
            <span className="text-lg font-black text-black">₺{financeToplamOdenenTutar.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>
          </div>
        </div>

        {/* YENİ: Personel Hareket İşlemleri (geçmiş) */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2"><History className="w-6 h-6 text-purple-600" /> Personel Hareket İşlemleri</h3>
          {personnelActions.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Henüz bir hareket kaydı yok.</p>
          ) : (
            <div className="space-y-2.5">
              {personnelActions.map(a => {
                const typeStyles = {
                  avans: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-600', icon: <DollarSign className="w-4 h-4 text-white" /> },
                  onay: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-600', icon: <CheckCircle className="w-4 h-4 text-white" /> },
                  tutanak: { bg: 'bg-neutral-50 border-neutral-200', badge: 'bg-neutral-700', icon: <FileText className="w-4 h-4 text-white" /> },
                  rapor: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-600', icon: <PlusCircle className="w-4 h-4 text-white" /> },
                  borcOdeme: { bg: 'bg-rose-50 border-rose-200', badge: 'bg-rose-600', icon: <Landmark className="w-4 h-4 text-white" /> }
                };
                const st = typeStyles[a.type] || typeStyles.tutanak;
                return (
                  <div key={a.id} className={`border p-3 rounded-xl flex items-center justify-between gap-3 ${st.bg}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${st.badge}`}>{st.icon}</div>
                      <div className="min-w-0">
                        <span className="font-bold text-black text-sm block truncate">
                          {a.title}
                          {a.amount > 0 && <span className="text-green-700"> — ₺{parseFloat(a.amount).toLocaleString('tr-TR')}</span>}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-medium">
                          {a.month ? `Dönem: ${a.month}` : ''} {a.date ? `• ${a.date}` : ''} {a.endDate ? `→ ${a.endDate}` : ''} {a.note ? `• ${a.note}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {a.fileUrl && (
                        <button onClick={() => setViewingImage && setViewingImage({ title: a.title, name: a.fileUrl })} className="p-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-100 transition" title="Belgeyi Gör">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteAction(a.id)} className="p-1.5 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition" title="Sil">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kıyafet Takibi */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><Shirt className="w-6 h-6 text-indigo-600" /> Kıyafet Takibi</h3>
            <button type="button" onClick={() => { setEditingClothingId(null); setClothingForm({ item: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); setShowClothingModal(true); }} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" /> Kıyafet Ekle
            </button>
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2"><Smartphone className="w-6 h-6 text-teal-600" /> Telefon Takibi</h3>
            <button type="button" onClick={() => { setEditingPhoneId(null); setPhoneForm({ model: '', date: new Date().toISOString().split('T')[0], note: '', fileUrl: '' }); setShowPhoneModal(true); }} className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" /> Telefon Ekle
            </button>
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
              <span className="text-3xl font-black text-black block">{periodJobsCount}</span>
              <span className="text-xs font-bold text-neutral-500">Yapılan İş</span>
            </div>
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
              <span className="text-3xl font-black text-yellow-600 block">{periodReviewsCount}</span>
              <span className="text-xs font-bold text-yellow-700">Alınan Yorum</span>
            </div>
            {/* YENİ: Ekibine hasar kaydı yazılmış iş sayısı */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center col-span-2 md:col-span-1">
              <span className="text-3xl font-black text-red-600 block">{periodDamagesCount}</span>
              <span className="text-xs font-bold text-red-700">Hasarlı İş</span>
            </div>
            {/* YENİ: Mesai/puantaj tabanlı sayaçlar */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
              <span className="text-3xl font-black text-blue-600 block">{periodFazlaMesaiSayisi}</span>
              <span className="text-xs font-bold text-blue-700">Fazla Mesai</span>
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
          <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 text-neutral-600 text-xs font-bold rounded-lg">
            <FolderOpen className="w-3.5 h-3.5" /> {Object.keys(person.ozlukDosyalari || {}).length} belge yüklü
          </span>
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
                          <tr className="bg-neutral-50"><td className="p-2.5 text-neutral-500 text-xs">Fazla Mesai / Gün Sayısı</td><td className="p-2.5 text-right text-xs text-neutral-500">{settlementData.fazlaGunSayisi} gün</td></tr>
                        </>
                      )}
                      <tr><td className="p-2.5 text-neutral-600">Ödenecek Gün (Puantaj Kırılımlı)</td><td className="p-2.5 text-right font-bold text-black">{settlementData.odenecekGun} gün</td></tr>
                      {settlementData.fazlaMesaiUcreti !== 0 && (
                        <tr className={settlementData.fazlaMesaiUcreti > 0 ? 'bg-green-50' : 'bg-red-50'}>
                          <td className={`p-2.5 ${settlementData.fazlaMesaiUcreti > 0 ? 'text-green-700' : 'text-red-700'}`}>Fazla Mesai / Devamsızlık Ücret Etkisi</td>
                          <td className={`p-2.5 text-right font-bold ${settlementData.fazlaMesaiUcreti > 0 ? 'text-green-700' : 'text-red-700'}`}>{settlementData.fazlaMesaiUcreti > 0 ? '+' : ''}₺{settlementData.fazlaMesaiUcreti.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td>
                        </tr>
                      )}
                      <tr><td className="p-2.5 text-neutral-600">Hak Edilen Net Maaş</td><td className="p-2.5 text-right font-bold text-black">₺{settlementData.netMaas.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      <tr className="bg-red-50"><td className="p-2.5 text-red-700">Yemek Parası İadesi <span className="text-[10px] text-red-400">(peşin verildi)</span></td><td className="p-2.5 text-right font-bold text-red-700">− ₺{settlementData.yemekIade.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      <tr className="bg-red-50"><td className="p-2.5 text-red-700">Yol Parası İadesi <span className="text-[10px] text-red-400">(peşin verildi)</span></td><td className="p-2.5 text-right font-bold text-red-700">− ₺{settlementData.yolIade.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      {settlementData.icraKesintisi > 0 && (
                        <tr className="bg-orange-50"><td className="p-2.5 text-orange-700">İcra Kesintisi</td><td className="p-2.5 text-right font-bold text-orange-700">₺{settlementData.icraKesintisi.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      )}
                      <tr><td className="p-2.5 text-neutral-500 text-xs">İadenin Nakitten Düşülen Kısmı</td><td className="p-2.5 text-right text-xs text-neutral-500">₺{settlementData.nakittenDusulen.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                      <tr><td className="p-2.5 text-neutral-500 text-xs">İadenin Bankadan Düşülen Kısmı</td><td className="p-2.5 text-right text-xs text-neutral-500">₺{settlementData.bankadanDusulen.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Final tutarlar */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black uppercase text-yellow-700 mb-1">Kalan Banka Parası</p>
                    <p className="text-xl font-black text-yellow-800">₺{settlementData.finalKalanBanka.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</p>
                  </div>
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black uppercase text-orange-700 mb-1">Kalan Nakit Parası</p>
                    <p className="text-xl font-black text-orange-800">₺{settlementData.finalKalanNakit.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</p>
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
                      <p>Girilen tutar, borçlandırma tutarından düşülür. Ödeme önce Kalan Nakit'ten karşılanır; nakit yetersizse kalan kısım Kalan Banka tarafından tahsil edilir.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-black mb-1">Ödenecek Tutar (TL)</label>
                      <input required type="number" max={currentDebt} value={debtForm.amount} onChange={e => setDebtForm({ ...debtForm, amount: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-600" placeholder={`En fazla ₺${currentDebt.toLocaleString('tr-TR')}`} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-black mb-1">Kesintinin Yapılacağı Ay</label>
                      <input required type="month" value={debtForm.month} onChange={e => setDebtForm({ ...debtForm, month: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-600" />
                      <p className="text-[10px] text-neutral-500 font-medium mt-1">Ödeme, seçtiğiniz ayın Kalan Nakit'inden (yetmezse Kalan Banka'sından) düşülür.</p>
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

  export const OzlukDosyalariView = ({ personnelList, db, appId, addSystemLog, setViewingImage }) => {
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [collarFilter, setCollarFilter] = useState('Tümü'); // 'Tümü', 'Mavi Yaka', 'Beyaz Yaka'

    const filteredList = personnelList.filter(p => {
      const matchesSearch = p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || (p.position && p.position.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCollar = collarFilter === 'Tümü' ? true : p.collarType === collarFilter;
      return matchesSearch && matchesCollar;
    });

    const handleFileUpload = async (e, docType) => {
      const file = e.target.files[0];
      if (!file || !selectedPerson) return;
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }

        const updatedOzluk = { ...(selectedPerson.ozlukDosyalari || {}), [docType]: uploadedUrl };
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukDosyalari: updatedOzluk });
        addSystemLog('Özlük Dosyası Eklendi', `${selectedPerson.fullName} personeline ait ${docType} dosyası eklendi.`);
        setSelectedPerson({ ...selectedPerson, ozlukDosyalari: updatedOzluk });
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Dosya yüklenemedi.");
      }
      setIsUploading(false);
    };

    const handleDeleteFile = async (docType) => {
      if (!window.confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
      const updatedOzluk = { ...(selectedPerson.ozlukDosyalari || {}) };
      delete updatedOzluk[docType];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), { ozlukDosyalari: updatedOzluk });
      addSystemLog('Özlük Dosyası Silindi', `${selectedPerson.fullName} personeline ait ${docType} dosyası silindi.`);
      setSelectedPerson({ ...selectedPerson, ozlukDosyalari: updatedOzluk });
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
      { id: 'digerBelgeler', label: 'Diğer Belgeler' }
    ];

    if (!selectedPerson) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-7xl mx-auto h-full flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4 shrink-0">
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
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-red-50">
                    <span className="flex items-center gap-1.5 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded-lg">
                      <FolderOpen className="w-4 h-4" /> {evrakCount} Evrak
                    </span>
                    <button onClick={() => setSelectedPerson(p)} className="text-[10px] font-black text-red-500 group-hover:text-red-700 uppercase tracking-widest transition">
                      DOSYAYI AÇ
                    </button>
                  </div>
                </div>
              )
            })}
            {filteredList.length === 0 && (
              <div className="col-span-full py-12 text-center text-neutral-500 font-medium">
                Aradığınız kriterlere uygun personel bulunamadı.
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
                const fileUrl = selectedPerson.ozlukDosyalari?.[docType.id];
                return (
                  <div key={docType.id} className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 relative group bg-white shadow-sm hover:shadow-md transition hover:border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className={`w-5 h-5 ${fileUrl ? 'text-green-500' : 'text-neutral-400'}`} />
                      <h3 className="font-bold text-sm text-neutral-800 leading-tight">{docType.label}</h3>
                    </div>
                    
                    {fileUrl ? (
                      <div className="flex flex-col gap-2 mt-auto">
                        <button onClick={() => setViewingImage({title: docType.label, name: fileUrl})} className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 border border-neutral-200">
                          <Eye className="w-4 h-4" /> Görüntüle
                        </button>
                        <button onClick={() => handleDeleteFile(docType.id)} className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-100">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-auto">
                        <MediaCaptureMenu
                          onChange={(e) => handleFileUpload(e, docType.id)}
                          disabled={isUploading}
                          buttonLabel="Yükle"
                          compact={true}
                          buttonClassName="cursor-pointer w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 border border-red-100 border-dashed"
                        />
                      </div>
                    )}
                  </div>
                )
            })}
          </div>
        </div>
      </div>
    );
  };

  export const ComplaintsView = ({ complaints, updateComplaintStatus, deleteComplaint }) => {
    const [filter, setFilter] = useState('all');

    const filtered = complaints.filter(c => filter === 'all' ? true : c.status === filter).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" /> Şikayet ve Bildirimler
          </h2>
          <div className="flex bg-neutral-100 p-1 rounded-xl">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'all' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Tümü</button>
            <button onClick={() => setFilter('Yeni')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'Yeni' ? 'bg-red-500 text-white shadow-sm' : 'text-neutral-500'}`}>Yeni</button>
            <button onClick={() => setFilter('İnceleniyor')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'İnceleniyor' ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-500'}`}>İnceleniyor</button>
            <button onClick={() => setFilter('Çözüldü')} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'Çözüldü' ? 'bg-green-500 text-white shadow-sm' : 'text-neutral-500'}`}>Çözüldü</button>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.map(c => (
            <div key={c.id} className={`p-4 rounded-xl border flex flex-col gap-3 transition ${!c.read ? 'bg-red-50/30 border-red-200' : 'bg-white border-neutral-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-black flex items-center gap-2">
                    {!c.read && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>}
                    {c.subject}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 font-medium"><User className="w-3 h-3 inline mr-1" /> {c.senderName} ({c.senderPosition}) • <Clock className="w-3 h-3 inline ml-2 mr-1" /> {c.dateStr}</p>
                </div>
                <select 
                  value={c.status} 
                  onChange={e => updateComplaintStatus(c.id, e.target.value, true)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border outline-none cursor-pointer ${c.status === 'Yeni' ? 'bg-red-100 text-red-800 border-red-200' : c.status === 'İnceleniyor' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}`}
                >
                  <option value="Yeni">Yeni</option>
                  <option value="İnceleniyor">İnceleniyor</option>
                  <option value="Çözüldü">Çözüldü</option>
                </select>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {c.content}
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => { if(window.confirm('Bildirimi silmek istediğinize emin misiniz?')) deleteComplaint(c.id); }} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 bg-white px-2 py-1 rounded border border-red-100 hover:bg-red-50 transition"><Ban className="w-3.5 h-3.5" /> Sil</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-neutral-500 py-8 bg-neutral-50 rounded-xl border border-neutral-200">Gösterilecek şikayet/bildirim bulunamadı.</p>
          )}
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
           const skillDiff = computeAvgSkillForPerson(b, skillsMap) - computeAvgSkillForPerson(a, skillsMap);
           if (skillDiff !== 0) return skillDiff;
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
  // --- PERSONEL TAHTASI BİLEŞENİ SONU ---

  export const IsOnaylamaTahtasiView = ({ jobs, handleEditJob, setMarkDamageJobId, canApprovePoints, handleOpenApproveModal, handleOpenMesaiModal, personnelList = [], db, appId, addSystemLog, setViewingImage, handleOpenEndJobModal, isManager }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    // YENİ: "Ekibi Düzenle" modalı — ekipten sistemli/sistem dışı personel ekleme-çıkarma
    const [editingTeamJob, setEditingTeamJob] = useState(null);
    const [teamManualNameInput, setTeamManualNameInput] = useState('');

    const getTeamSystemNames = (job) => (job.assignedPersonnelIds || []).map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
    const getTeamManualNames = (job) => {
      const systemNames = getTeamSystemNames(job);
      return (job.teamNames || []).filter(name => !systemNames.includes(name));
    };

    const saveTeam = async (job, assignedPersonnelIds, teamNames) => {
      const systemNames = assignedPersonnelIds.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
      const displayNames = [...systemNames, ...teamNames.filter(n => !systemNames.includes(n))];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
        assignedPersonnelIds,
        teamNames,
        team: displayNames.length > 0 ? displayNames.join(', ') : 'Atanmadı'
      });
    };

    const handleAddToTeam = async (job, personId) => {
      const currentIds = job.assignedPersonnelIds || [];
      if (currentIds.includes(personId)) return;
      await saveTeam(job, [...currentIds, personId], job.teamNames || []);
      if (addSystemLog) addSystemLog('Ekip Düzenlendi', `${job.customerName} işine personel eklendi.`);
    };

    const handleRemoveFromTeam = async (job, personId) => {
      const currentIds = (job.assignedPersonnelIds || []).filter(id => id !== personId);
      await saveTeam(job, currentIds, job.teamNames || []);
      if (addSystemLog) addSystemLog('Ekip Düzenlendi', `${job.customerName} işinden personel çıkarıldı.`);
    };

    const handleAddManualName = async (job) => {
      const name = teamManualNameInput.trim();
      if (!name) return;
      const currentNames = job.teamNames || [];
      if (currentNames.includes(name)) { setTeamManualNameInput(''); return; }
      await saveTeam(job, job.assignedPersonnelIds || [], [...currentNames, name]);
      setTeamManualNameInput('');
      if (addSystemLog) addSystemLog('Ekip Düzenlendi', `${job.customerName} işine "${name}" sistem dışı olarak eklendi.`);
    };

    const handleRemoveManualName = async (job, name) => {
      const currentNames = (job.teamNames || []).filter(n => n !== name);
      await saveTeam(job, job.assignedPersonnelIds || [], currentNames);
      if (addSystemLog) addSystemLog('Ekip Düzenlendi', `${job.customerName} işinden "${name}" çıkarıldı.`);
    };

    // YENİ: Artık sadece tamamlananlar değil, o güne ait tüm işler (iptal hariç) gösterilir;
    // tamamlanmamışlar "Sürüyor" rozetiyle soluk gösterilir. İşler tip sırasına göre sıralanır.
    const JOB_TYPE_ORDER_ONAY = { 'Nakliye': 0, 'Depo': 1, 'Asansör': 2 };
    const completedJobs = jobs.filter(j => j.status !== 'cancelled' && j.date === selectedDate).sort((a, b) => {
      const typeDiff = (JOB_TYPE_ORDER_ONAY[a.type] ?? 3) - (JOB_TYPE_ORDER_ONAY[b.type] ?? 3);
      if (typeDiff !== 0) return typeDiff;
      return new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time);
    });

    return (
      <>
      <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] animate-in fade-in pb-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <CheckSquare className="w-7 h-7 text-red-600" /> İş Onaylama Tahtası
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">Günü seçin, tamamlanan operasyonların puan, mesai ve hasar bildirimlerini buradan yönetin.</p>
          </div>
          <div className="flex items-center gap-2 bg-neutral-100 p-2 rounded-xl border border-neutral-200 w-full md:w-auto">
            <CalendarDays className="w-5 h-5 text-neutral-500 ml-1" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-black cursor-pointer px-2"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-full relative">
          {completedJobs.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white/50">
              <CheckCircle className="w-16 h-16 text-green-500/50 mb-3" />
              <p className="font-bold text-neutral-500 text-lg">Bu tarihte tamamlanmış operasyon bulunmuyor.</p>
            </div>
          ) : (
            <div className="flex gap-4 min-h-full items-start w-max min-w-full pb-4">
              {completedJobs.map(job => (
                <div key={job.id} className="w-[260px] md:w-[280px] shrink-0 bg-white rounded-xl flex flex-col h-fit overflow-hidden border-2 border-neutral-200 hover:border-red-400 transition-colors duration-200 shadow-md pb-1">
                  {/* Header */}
                  <div className={`p-3 border-b-4 ${job.type === 'Nakliye' ? 'border-red-500 bg-red-50' : job.type === 'Asansör' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'} shrink-0`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white ${job.type === 'Nakliye' ? 'bg-red-600' : job.type === 'Asansör' ? 'bg-green-600' : 'bg-blue-600'}`}>{job.type || 'Nakliye'}</span>
                      <span className="text-[11px] font-bold text-neutral-600"><Clock className="w-3 h-3 inline mr-1" />{job.time}</span>
                    </div>
                    {job.status !== 'completed' && (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded bg-neutral-400 text-white uppercase tracking-widest mb-1">Sürüyor</span>
                    )}
                    <h3 className="font-black text-[15px] text-black truncate mb-1" title={job.customerName}>{job.customerName}</h3>
                    {job.assignedVehiclePlate && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded w-fit mb-1.5">
                        <Truck className="w-3 h-3 shrink-0" /> {job.assignedVehiclePlate}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-700 mb-2">
                      <span className="truncate flex-1"><MapPin className="w-3 h-3 inline mr-0.5 text-neutral-400"/>{job.fromDistrict} ➔ {job.toDistrict || '?'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-neutral-700 bg-white p-1.5 rounded border border-neutral-200 shadow-sm flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-600" /> {job.team}
                    </div>
                  </div>

                  {/* End Job Details */}
                  <div className="p-3 flex flex-col gap-2 flex-1 bg-neutral-50/30">
                     {job.endJobDetails ? (
                       <div className="text-xs flex flex-col gap-2 bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm">
                          <span className="flex items-start gap-1">
                             <span className="font-bold text-neutral-500 w-16 shrink-0">Hasar:</span> 
                             <span className={`font-bold ${job.endJobDetails.damageStatus === 'Hasar var' ? 'text-red-600' : 'text-green-600'}`}>{job.endJobDetails.damageStatus}</span>
                          </span>
                          <span className="flex items-start gap-1">
                             <span className="font-bold text-neutral-500 w-16 shrink-0">Ödeme:</span> 
                             <span className="font-bold text-neutral-800">{job.endJobDetails.paymentMethod}</span>
                          </span>
                          <span className="flex items-start gap-1">
                             <span className="font-bold text-neutral-500 w-16 shrink-0">M.Memnun.:</span>
                             <span className="font-bold text-neutral-800">{job.endJobDetails.customerSatisfaction}</span>
                          </span>
                       </div>
                     ) : (
                       <div className="text-xs text-neutral-400 italic text-center py-2">Sonlandırma detayı yok.</div>
                     )}
                     {/* YENİ: Ekip şefinin yüklediği kasa/hasar/asansör medyalarının görüntülenmesi */}
                     {setViewingImage && (job.endJobDetails?.truckImages || job.endJobDetails?.damageImages || job.endJobDetails?.elevatorImages) && (
                       <div className="flex flex-wrap gap-1.5">
                         {(job.endJobDetails?.truckImages || []).filter(img => img && img !== 'Yükleniyor...').map((img, idx) => (
                           <button key={'truck'+idx} onClick={() => setViewingImage({ title: 'Kasa Fotoğrafı', name: img })} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1">
                             <Camera className="w-3 h-3" /> Kasa {idx > 0 ? idx + 1 : ''}
                           </button>
                         ))}
                         {(job.endJobDetails?.damageImages || []).filter(img => img && img !== 'Yükleniyor...').map((img, idx) => (
                           <button key={'dmg'+idx} onClick={() => setViewingImage({ title: 'Hasar Fotoğrafı', name: img })} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition flex items-center gap-1">
                             <Camera className="w-3 h-3" /> Hasar {idx > 0 ? idx + 1 : ''}
                           </button>
                         ))}
                         {(job.endJobDetails?.elevatorImages || []).filter(img => img && img !== 'Yükleniyor...').map((img, idx) => (
                           <button key={'elv'+idx} onClick={() => setViewingImage({ title: 'Asansör Fotoğrafı', name: img })} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition flex items-center gap-1">
                             <Camera className="w-3 h-3" /> Asansör {idx > 0 ? idx + 1 : ''}
                           </button>
                         ))}
                       </div>
                     )}
                  </div>

                  {/* Actions */}
                  <div className="p-2 border-t border-neutral-200 bg-neutral-50 flex flex-col gap-1.5 shrink-0">
                    {/* YENİ: Ekibi Düzenle — sistemli/sistem dışı personel ekleme-çıkarma */}
                    {isManager && (
                      <button onClick={() => setEditingTeamJob(job)} className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 transition flex justify-center items-center gap-1.5 border border-indigo-200">
                        <Users className="w-4 h-4" /> Ekibi Düzenle
                      </button>
                    )}
                    {/* YENİ: Tamamlanmamış işler için yönetici manuel kapatabilir */}
                    {isManager && job.status !== 'completed' && handleOpenEndJobModal && (
                      <button onClick={() => handleOpenEndJobModal(job)} className="w-full py-2 bg-neutral-800 text-white font-bold text-xs rounded-lg hover:bg-black transition flex justify-center items-center gap-1.5">
                        <CheckSquare className="w-4 h-4" /> Manuel Kapat
                      </button>
                    )}
                  </div>

                  {canApprovePoints && job.status === 'completed' && (
                  <div className="p-2 border-t border-neutral-200 bg-neutral-50 flex flex-col gap-1.5 shrink-0">
                    {!job.pointsApproved ? (
                      <button onClick={() => handleOpenApproveModal(job)} className="w-full py-2 bg-yellow-50 text-yellow-700 font-bold text-xs rounded-lg hover:bg-yellow-100 transition flex justify-center items-center gap-1.5 border border-yellow-200">
                        <Star className="w-4 h-4" /> Puan Onayla
                      </button>
                    ) : (
                      <div className="w-full py-2 bg-yellow-100 text-yellow-700 font-bold text-xs rounded-lg flex justify-center items-center gap-1.5 border border-yellow-200 opacity-60 cursor-not-allowed">
                        <CheckCircle className="w-4 h-4" /> Puan Onaylandı
                      </div>
                    )}

                    {!job.mesaiApproved ? (
                      <button onClick={() => handleOpenMesaiModal(job)} className="w-full py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg hover:bg-blue-100 transition flex justify-center items-center gap-1.5 border border-blue-200">
                        <Clock className="w-4 h-4" /> Mesai Onayla
                      </button>
                    ) : (
                      <div className="w-full py-2 bg-blue-100 text-blue-700 font-bold text-xs rounded-lg flex justify-center items-center gap-1.5 border border-blue-200 opacity-60 cursor-not-allowed">
                        <CheckCircle className="w-4 h-4" /> Mesai Onaylandı
                      </div>
                    )}

                    {job.endJobDetails?.damageStatus !== 'Hasar var' && (
                      <button onClick={() => setMarkDamageJobId(job.id)} className="w-full py-2 bg-orange-50 text-orange-700 font-bold text-xs rounded-lg hover:bg-orange-100 transition flex justify-center items-center gap-1.5 border border-orange-200">
                        <AlertTriangle className="w-4 h-4" /> Hasar Oluştu Bildir
                      </button>
                    )}
                    
                    <button onClick={() => handleEditJob(job)} className="w-full py-2 bg-white text-neutral-700 font-bold text-xs rounded-lg hover:bg-neutral-100 transition flex justify-center items-center gap-1.5 border border-neutral-200 mt-1">
                      <Edit className="w-3.5 h-3.5" /> İncele / Düzenle
                    </button>
                  </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* YENİ: Ekibi Düzenle Modalı */}
      {editingTeamJob && (() => {
        const job = jobs.find(j => j.id === editingTeamJob.id) || editingTeamJob;
        const assignedIds = job.assignedPersonnelIds || [];
        const manualNames = getTeamManualNames(job);
        const availablePersonnel = personnelList.filter(p => !assignedIds.includes(p.id) && p.employmentStatus !== 'Pasif');
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setEditingTeamJob(null)}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Ekibi Düzenle</h3>
                <button onClick={() => setEditingTeamJob(null)} className="text-indigo-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <p className="text-xs font-bold text-neutral-400 uppercase">{job.customerName} — {job.date}</p>

                <div>
                  <h4 className="text-sm font-bold text-black mb-2">Mevcut Ekip</h4>
                  {assignedIds.length === 0 && manualNames.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">Ekipte henüz kimse yok.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {assignedIds.map(pId => {
                        const person = personnelList.find(p => String(p.id) === String(pId));
                        return (
                          <div key={pId} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg p-2">
                            <span className="text-sm font-bold text-black">{person?.fullName || 'Bilinmeyen Personel'}</span>
                            <button onClick={() => handleRemoveFromTeam(job, pId)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })}
                      {manualNames.map(name => (
                        <div key={name} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-2">
                          <span className="text-sm font-bold text-purple-800">{name} <span className="text-[10px] font-medium text-purple-400">(sistem dışı)</span></span>
                          <button onClick={() => handleRemoveManualName(job, name)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-black mb-2">Personel Ekle</h4>
                  <select onChange={e => { if (e.target.value) { handleAddToTeam(job, e.target.value); e.target.value = ''; } }} defaultValue="" className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-medium">
                    <option value="">Sistemden personel seçin...</option>
                    {availablePersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.position || p.rank})</option>)}
                  </select>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-black mb-2">Sistem Dışı İsim Ekle</h4>
                  <div className="flex gap-2">
                    <input type="text" value={teamManualNameInput} onChange={e => setTeamManualNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddManualName(job)} placeholder="Örn: Yardımcı Şoför" className="flex-1 p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    <button onClick={() => handleAddManualName(job)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition text-sm">Ekle</button>
                  </div>
                </div>

                <button onClick={() => setEditingTeamJob(null)} className="w-full py-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Kapat</button>
              </div>
            </div>
          </div>
        );
      })()}
      </>
    );
  };

  // --- YENİ EKLENEN: EKİP KURMA TAHTASI KART BİLEŞENİ ---
  export const BoardJobCard = ({ job, personnelList, vehicles, materials, dragOverTarget, handleDragOver, handleDragLeave, handleDropToJob, handleDragStart, db, appId, calculateMaterials }) => {
    const [note, setNote] = useState(job.notes || '');
    const [manualName, setManualName] = useState('');
    
    // YENİ STATE'LER: Sistem harici malzeme ekleme için
    const [customMaterials, setCustomMaterials] = useState(job.customMaterials || []);
    const [newCustomMaterial, setNewCustomMaterial] = useState({ name: '', amount: 1 });

    useEffect(() => { setNote(job.notes || ''); }, [job.notes]);

    const targetCount = React.useMemo(() => {
      let base = 4;
      const room = job.fromRoomCount || '';
      const isDepo = job.type === 'Depo';

      if (room.includes('1+0') || room.includes('Parça')) base = isDepo ? 2 : 3;
      else if (room.includes('1+1')) base = isDepo ? 3 : 4;
      else if (room.includes('2+1')) base = isDepo ? 4 : 5;
      else if (room.includes('3+1')) base = isDepo ? 5 : 6;
      else if (room.includes('4+1') || room.includes('Villa') || room.includes('Ofis')) base = isDepo ? 6 : 7;
      else base = isDepo ? 4 : 5;

      let tc = base;
      if (job.fromPacking === 'Toplama Yapılacak') tc += 1;
      const getFloorNum = (fs) => { const m = (fs||'').match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
      if (job.fromTransportMethod === 'Merdiven' && getFloorNum(job.fromFloor) > 3) tc += 1;
      if (job.toTransportMethod === 'Merdiven' && getFloorNum(job.toFloor) > 3) tc += 1;
      return tc;
    }, [job.fromRoomCount, job.type, job.fromPacking, job.fromTransportMethod, job.fromFloor, job.toTransportMethod, job.toFloor]);

    const systemNames = (job.assignedPersonnelIds || []).map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
    const manualNames = (job.teamNames || []).filter(name => !systemNames.includes(name));
    const currentCount = systemNames.length + manualNames.length;

    // YENİ: Ekipteki ilk kişi (fiili şoför) ile atanan aracın gerekli ehliyeti karşılaştırılır
    const driverPerson = (job.assignedPersonnelIds || []).length > 0 ? personnelList.find(p => String(p.id) === String(job.assignedPersonnelIds[0])) : null;
    const assignedVehicle = job.assignedVehiclePlate ? (vehicles || []).find(v => v.plate === job.assignedVehiclePlate) : null;
    const licenseWarning = !!(driverPerson && assignedVehicle && assignedVehicle.requiredLicense === 'Büyük Ehliyet' && driverPerson.ehliyet !== 'Büyük Ehliyet');
    const isNakliye = job.type === 'Nakliye' || !job.type;
    const isAsansor = job.type === 'Asansör';
    const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking);

    const handleNoteBlur = async () => {
        if (note !== job.notes) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), { notes: note });
        }
    };

    const handleMaterialChange = async (key, amount) => {
        const updated = { ...est, [key]: Math.max(0, (est[key]||0) + amount) };
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), { assignedMaterials: updated });
    };

    const toggleTeamVisibility = async () => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            isHiddenFromTeam: !job.isHiddenFromTeam
        });
    };

    // YENİ: Ekip Kurma Tahtası'ndan da Randevu Onayı (WA/SMS) mesajı gönderebilmek için eklendi
    const sendAppointmentMessage = (method) => {
        let phone = (job.customerPhone || '').replace(/\D/g, '');
        if (!phone) { alert('Bu iş için kayıtlı bir müşteri telefonu bulunamadı.'); return; }
        if (phone.startsWith('0')) phone = '90' + phone.substring(1);
        else if (!phone.startsWith('90')) phone = '90' + phone;

        const msg = `Merhaba ${job.customerName},\n\nBen Sembol Nakliyat operasyon sorumlunuz. ${job.date} saat ${job.time} sularında planlanan işleminiz için ekibimiz ve aracımız hazırlıklarını tamamlamıştır. İşi daha iyi organize edebilmemiz açısından taşıma aracımız için uygun bir park yeri ayarlamanızı rica ederiz.\n\n🔒 *Güvenliğiniz için Teslim Kodunuz:* ${job.deliveryCode || 'Bulunmuyor'}\nEkibimiz geldiğinde eşya teslimi için bu kodu kendilerine iletebilirsiniz.\n\nHerhangi bir sorun durumunda veya talebinizde doğrudan benimle bu numara üzerinden iletişime geçebilirsiniz.\n\nŞimdiden yeni yerinizin hayırlı olmasını dileriz. Süreci sizin için en iyi şekilde tamamlamaya çalışacağız. Görüşmek üzere!`;

        if (method === 'wa') {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        } else if (method === 'sms') {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const separator = isIOS ? '&' : '?';
            window.open(`sms:${phone}${separator}body=${encodeURIComponent(msg)}`, '_self');
        }
    };

    // EKLENEN YENİ METOTLAR: Doğrudan kart üzerinden malzeme ekleme ve çıkarma
    const handleAddCustomMaterial = async () => {
       const matName = newCustomMaterial.name.trim();
       if(matName) {
           const existingIdx = customMaterials.findIndex(c => c.name === matName);
           let updated;
           if (existingIdx > -1) {
               updated = [...customMaterials];
               updated[existingIdx].amount += newCustomMaterial.amount;
           } else {
               updated = [...customMaterials, { id: Date.now(), name: matName, amount: newCustomMaterial.amount }];
           }
           setCustomMaterials(updated);
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), { customMaterials: updated });
           setNewCustomMaterial({ name: '', amount: 1 });
       }
    };
    
    const handleRemoveCustomMaterial = async (id) => {
       const updated = customMaterials.filter(c => c.id !== id);
       setCustomMaterials(updated);
       await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), { customMaterials: updated });
    };

    const submitManualAdd = async () => {
        if (!manualName.trim()) return;
        const newNames = [...(job.teamNames || [])];
        newNames.push(manualName.trim());

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            teamNames: newNames,
            team: newNames.join(', '),
        });
        setManualName('');
    };

    const handleRemoveManualFromJob = async (nameToRemove) => {
        const newNames = (job.teamNames || []).filter(n => n !== nameToRemove);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            teamNames: newNames,
            team: newNames.length > 0 ? newNames.join(', ') : 'Atanmadı'
        });
    };

    const handleApproveTeam = async () => {
        const allAssignedIds = job.assignedPersonnelIds || [];
        if (allAssignedIds.length === 0 && manualNames.length === 0) return alert("Önce personel atamalısınız!");

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            status: job.status === 'pending' ? 'in-progress' : job.status,
            isTeamApproved: true,
            assignedDate: new Date().toISOString().split('T')[0]
        });

        const notifsCol = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
        const assignDateStr = new Date().toISOString().split('T')[0];
        
        for (const userId of allAssignedIds) {
            await addDoc(notifsCol, {
                userId: userId, title: 'Yeni Görev Ataması', message: `${job.customerName} operasyonu için görevlendirildiniz.`, date: new Date().toLocaleString('tr-TR'), read: false,
                type: 'assignment', assignedDate: assignDateStr, jobDate: job.date
            });
        }

        try {
            const dateObj = new Date(job.date);
            const y = dateObj.getFullYear();
            const m = dateObj.getMonth() + 1;
            const d = dateObj.getDate();

            const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y}_${m}`);
            const mesaiSnap = await getDoc(mesaiRef);
            let mesaiRecords = mesaiSnap.exists() ? mesaiSnap.data().records : {};

            let updated = false;
            allAssignedIds.forEach(pId => {
                const p = personnelList.find(pers => String(pers.id) === String(pId));
                if (p && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))) {
                    if (!mesaiRecords[pId]) mesaiRecords[pId] = {};
                    const currentStatusObj = mesaiRecords[pId][d];
                    const currentStatus = typeof currentStatusObj === 'object' && currentStatusObj !== null ? currentStatusObj.status : currentStatusObj;
                    
                    if (!currentStatus) {
                        mesaiRecords[pId][d] = { status: dateObj.getDay() === 0 ? 'FGM' : 'G', hours: '' };
                        updated = true;
                    }
                }
            });

            if (updated) {
                await setDoc(mesaiRef, { records: mesaiRecords, updatedAt: new Date().toISOString() }, { merge: true });
            }
        } catch (err) {
            console.error("Mesai güncelleme hatası:", err);
        }
    };

    return (
      <div 
        onDragOver={(e) => handleDragOver(e, job.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropToJob(e, job.id)}
        className={`w-[260px] md:w-[280px] shrink-0 bg-white rounded-xl flex flex-col h-fit overflow-hidden border-2 transition-colors duration-200 shadow-md pb-1 ${dragOverTarget === job.id ? (isNakliye ? 'border-red-400 bg-red-50/50' : isAsansor ? 'border-green-400 bg-green-50/50' : 'border-blue-400 bg-blue-50/50') : 'border-neutral-200 hover:border-neutral-300'}`}
      >
        {/* İŞ KARTI BAŞLIĞI */}
        <div className={`p-3 border-b-4 ${isNakliye ? 'border-red-500 bg-red-50' : isAsansor ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'} shrink-0`}>
          <div className="flex justify-between items-start mb-1.5">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white ${isNakliye ? 'bg-red-600' : isAsansor ? 'bg-green-600' : 'bg-blue-600'}`}>{job.type || 'Nakliye'}</span>
            <span className="text-[11px] font-bold text-neutral-600"><Clock className="w-3 h-3 inline mr-1" />{job.time}</span>
          </div>
          <h3 className="font-black text-[15px] text-black truncate mb-1" title={job.customerName}>{job.customerName}</h3>
          
          {isAsansor && job.fromRoomCount && (
             <div className="mb-2">
                 <span className={`text-[10px] font-black px-2 py-1 rounded-md text-white uppercase shadow-sm ${job.fromRoomCount.includes('Yükleme') ? 'bg-orange-500' : 'bg-indigo-500'}`}>
                     <ArrowUpRight className="w-3 h-3 inline mr-1" /> {job.fromRoomCount}
                 </span>
             </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-700 mb-2">
            {!isAsansor && <span className="bg-white px-1 py-0.5 rounded border border-neutral-300 shadow-sm">{job.fromRoomCount}</span>}
            {!isAsansor && <span>•</span>}
            <span className="truncate flex-1">{job.fromDistrict} {job.toDistrict ? `➔ ${job.toDistrict}` : ''}</span>
          </div>

          <div className="text-[9px] flex flex-col gap-1 mb-2 bg-white p-1.5 rounded border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center">
               <span className="truncate text-neutral-600"><b>Kat:</b> {job.fromFloor} {job.toFloor ? `➔ ${job.toFloor}` : ''}</span>
               {job.price && <span className="font-black text-green-700 text-[10px] shrink-0">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>}
            </div>
            <div className="flex justify-between text-neutral-600">
               <span className="truncate"><b>Şekil:</b> {job.fromTransportMethod} {job.toTransportMethod ? `➔ ${job.toTransportMethod}` : ''}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
               <span className="truncate"><b>Eşya:</b> {job.fromPacking}</span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-neutral-200 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-500">Ekip:</span>
            <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${currentCount >= targetCount ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {currentCount} / {targetCount} Kişi
            </span>
          </div>
        </div>

        {/* Araç Sürükleme / Gösterim Alanı */}
        <div className="p-2 bg-neutral-50 border-b border-neutral-200 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
             <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Atanan Araç</span>
          </div>
          {job.assignedVehiclePlate ? (
            <div 
              draggable
              onDragStart={(e) => handleDragStart(e, 'vehicle', job.assignedVehiclePlate, job.id)}
              className="bg-white border border-purple-200 rounded-xl p-2 flex items-center gap-2 shadow-sm cursor-grab active:cursor-grabbing hover:border-purple-400 transition group relative"
            >
              <div className="bg-purple-100 p-1.5 rounded-lg"><Truck className="w-3.5 h-3.5 text-purple-600"/></div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-black tracking-widest">{job.assignedVehiclePlate}</h4>
              </div>
              <GripVertical className="w-3.5 h-3.5 text-neutral-300 opacity-0 group-hover:opacity-100 transition" />
            </div>
          ) : null}
          {licenseWarning && (
            <div className="mt-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg p-1.5 flex items-center gap-1.5 text-[9px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Şoförün ehliyeti bu araç için yetersiz!
            </div>
          )}
          {!job.assignedVehiclePlate && (
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-2 flex flex-col items-center justify-center text-neutral-400 bg-white/50 h-[46px]">
              <span className="text-[9px] font-bold flex items-center gap-1.5"><Truck className="w-3.5 h-3.5"/> Aracı Sürükleyin</span>
            </div>
          )}
        </div>

        {/* Atanmış Personeller */}
        <div className="h-[280px] p-2 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 bg-neutral-100/50 shrink-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Görevli Personeller</span>
            <button 
              onClick={toggleTeamVisibility}
              className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded font-bold border transition shadow-sm ${job.isHiddenFromTeam ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'}`}
              title={job.isHiddenFromTeam ? "Personellere iş atanmamış gibi görünüyor. Aktif etmek için tıklayın." : "Personellerden bu işi gizlemek için tıklayın."}
            >
              {job.isHiddenFromTeam ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {job.isHiddenFromTeam ? 'Ekip Gizli' : 'Ekibi Gizle'}
            </button>
          </div>
          
          {(job.assignedPersonnelIds || []).length === 0 && manualNames.length === 0 ? (
            <div className="flex-1 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center text-neutral-400 space-y-2 min-h-[60px] bg-neutral-50/50">
              <Users className="w-6 h-6 opacity-50" />
              <p className="text-[9px] font-bold text-center">Personelleri buraya<br/>sürükleyin.</p>
            </div>
          ) : (
            <>
              {/* Sistem Personelleri */}
              {(job.assignedPersonnelIds || []).map((pId, idx) => {
                const person = personnelList.find(p => String(p.id) === String(pId));
                if (!person) return null;
                return (
                  <div 
                    key={pId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'person', person.id, job.id)}
                    className="bg-white border border-neutral-200 rounded-xl p-2 flex items-center gap-2 shadow-sm cursor-grab active:cursor-grabbing hover:border-orange-400 transition group relative overflow-hidden shrink-0"
                  >
                    <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                      {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" alt={person.fullName} /> : <User className="w-3.5 h-3.5 text-neutral-400" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-[11px] text-black truncate">{person.fullName}</h4>
                      <p className="text-[8px] font-medium text-neutral-500 truncate flex items-center gap-1">
                        {idx === 0 && <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500 inline" />} 
                        {person.position}
                      </p>
                    </div>
                    <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                );
              })}
              
              {/* Sistem Dışı / Manuel Personeller */}
              {manualNames.map((mName, idx) => (
                 <div key={'m'+idx} className="bg-orange-50 border border-orange-200 rounded-xl p-2 flex items-center gap-2 shadow-sm group shrink-0">
                     <div className="w-7 h-7 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
                         <UserPlus className="w-3.5 h-3.5 text-orange-600"/>
                     </div>
                     <div className="flex-1 overflow-hidden">
                         <h4 className="font-bold text-[11px] text-orange-900 truncate">{mName}</h4>
                         <p className="text-[8px] font-medium text-orange-600/70 truncate">Dış Personel</p>
                     </div>
                     <button onClick={() => handleRemoveManualFromJob(mName)} className="text-red-500 hover:text-red-700 p-0.5 opacity-0 group-hover:opacity-100 transition"><X className="w-3.5 h-3.5"/></button>
                 </div>
              ))}
            </>
          )}

          {/* Manuel Personel Ekleme Butonu/Girişi */}
          <div className="mt-auto pt-1.5 border-t border-neutral-200/50 shrink-0 flex gap-1">
              <input type="text" value={manualName} onChange={e=>setManualName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitManualAdd()} placeholder="+ Sistem Dışı Ekle" className="flex-1 text-[10px] p-1.5 border border-neutral-300 rounded outline-none focus:ring-1 focus:ring-orange-400 font-bold" />
              <button onClick={submitManualAdd} className="bg-neutral-800 text-white px-2 rounded text-[10px] font-bold shadow-sm hover:bg-black transition">+</button>
          </div>
        </div>

        {/* Malzemeler */}
        {job.type !== 'Asansör' && (
        <div className="p-2 border-t border-neutral-200 bg-amber-50/30 shrink-0">
          <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-1 block flex items-center gap-1"><Package className="w-3 h-3"/> Malzemeler</span>
          <div className="grid grid-cols-2 gap-1 mb-1">
            {['strec', 'bant', 'poset', 'kagit', 'koli'].map(key => (
              <div key={key} className="flex items-center justify-between bg-white border border-neutral-200 p-1 rounded shadow-sm text-[9px]">
                 <span className="font-bold text-neutral-700 capitalize">{key === 'strec' ? 'Streç' : key === 'kagit' ? 'Kağıt' : key}</span>
                 <div className="flex items-center gap-1">
                    <button onClick={() => handleMaterialChange(key, -1)} className="bg-red-50 text-red-600 rounded w-3.5 h-3.5 flex items-center justify-center font-bold">-</button>
                    <span className="w-3 text-center font-black">{est[key]}</span>
                    <button onClick={() => handleMaterialChange(key, 1)} className="bg-green-50 text-green-600 rounded w-3.5 h-3.5 flex items-center justify-center font-bold">+</button>
                 </div>
              </div>
            ))}
          </div>

          {/* SİSTEM HARİCİ MALZEME EKLEME - DOĞRUDAN KARTA GÖMÜLDÜ */}
          <div className="pt-1.5 mt-1.5 border-t border-amber-200/50">
            <label className="block text-[9px] font-bold text-amber-800/80 mb-1">Ekstra Malzeme Ekle</label>
            <div className="flex gap-1">
              <select value={newCustomMaterial.name} onChange={e => setNewCustomMaterial({...newCustomMaterial, name: e.target.value})} className="flex-1 p-1 text-[9px] border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 font-bold bg-white cursor-pointer">
                <option value="">Seçiniz...</option>
                {materials.filter(m => !['streç', 'bant', 'poşet', 'kağıt', 'koli'].includes(m.name.toLowerCase())).map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              <input type="number" value={newCustomMaterial.amount} onChange={e => setNewCustomMaterial({...newCustomMaterial, amount: parseFloat(e.target.value) || 0})} className="w-10 p-1 border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 text-[9px] text-center font-bold bg-white" min="0.5" step="0.5" />
              <button type="button" onClick={handleAddCustomMaterial} className="bg-amber-600 text-white px-2 rounded text-[9px] font-bold hover:bg-amber-700 transition shadow-sm">Ekle</button>
            </div>
            {customMaterials.length > 0 && (
              <div className="mt-1.5 space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
                {customMaterials.map(cm => (
                  <div key={cm.id} className="flex items-center justify-between bg-white border border-amber-200 p-1 rounded shadow-sm text-[9px]">
                    <span className="font-bold text-amber-900">{cm.name} <span className="text-amber-700">({cm.amount} Adet)</span></span>
                    <button type="button" onClick={() => handleRemoveCustomMaterial(cm.id)} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Operasyon Notu */}
        <div className="p-2 border-t border-neutral-200 bg-neutral-50 shrink-0">
          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Operasyon Notu</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            className="w-full p-1.5 text-[10px] border border-neutral-300 rounded outline-none focus:ring-1 focus:ring-red-500 resize-none h-10 bg-white"
            placeholder="Ekibe özel notlar..."
          />
        </div>

        {/* Onay Butonu */}
        <div className="p-2 border-t border-neutral-200 shrink-0 bg-white">
          <button 
            onClick={handleApproveTeam}
            className={`w-full py-2 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm ${job.isTeamApproved ? 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100' : 'bg-black text-white hover:bg-neutral-800'}`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> {job.isTeamApproved ? 'Ekip Onaylandı / Düzenle' : 'Tüm Ekibi Onayla'}
          </button>
        </div>

        {/* YENİ: Müşteriye Randevu Onayı (WhatsApp / SMS) Butonları */}
        <div className="p-2 border-t border-neutral-200 shrink-0 bg-white flex gap-1.5">
          <button
            type="button"
            onClick={() => sendAppointmentMessage('wa')}
            className="flex-1 py-2 text-[10px] font-bold rounded-lg transition flex items-center justify-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E]"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Randevu Onayı (WA)
          </button>
          <button
            type="button"
            onClick={() => sendAppointmentMessage('sms')}
            className="flex-1 py-2 text-[10px] font-bold rounded-lg transition flex items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
          >
            <MessageSquareText className="w-3.5 h-3.5" /> Randevu Onayı (SMS)
          </button>
        </div>
      </div>
    );
  };

  export const EkipKurmaTahtasiView = ({ jobs, personnelList, vehicles, materials, db, appId, addSystemLog, allPersonnelActions = [], allMesaiRecords = [] }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [dragOverTarget, setDragOverTarget] = useState(null);
    const [mesaiData, setMesaiData] = useState({});

    // --- YENİ: "FAZLA İŞ ATA" ÖZELLİĞİ İÇİN EKLENEN STATE'LER ---
    // Not: Mevcut kodların hiçbiri değiştirilmedi, sadece ek özellik için yeni state'ler eklendi.
    const [showFazlaIsAtaModal, setShowFazlaIsAtaModal] = useState(false); // Modal açık/kapalı
    const [fazlaIsAtaPersonId, setFazlaIsAtaPersonId] = useState('');      // Seçilen (meşgul) personel
    const [fazlaIsAtaJobId, setFazlaIsAtaJobId] = useState('');            // Eklenecek hedef iş
    const [fazlaIsAtaVehiclePlate, setFazlaIsAtaVehiclePlate] = useState(''); // YENİ: Fazladan atanacak araç (boşta olsun olmasın, tüm liste)
    const [fazlaIsAtaError, setFazlaIsAtaError] = useState('');           // Uyarı mesajı

    useEffect(() => {
      const fetchMesai = async () => {
        if (!db || !appId) return;
        const dateObj = new Date(selectedDate);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        try {
          const mRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${year}_${month}`);
          const mSnap = await getDoc(mRef);
          if (mSnap.exists()) setMesaiData(mSnap.data().records || {});
          else setMesaiData({});
        } catch(e) { console.error("Mesai veri çekilemedi:", e); }
      };
      fetchMesai();
    }, [selectedDate, db, appId]);

    const dailyJobs = jobs.filter(j => 
      j.date === selectedDate && 
      j.status !== 'cancelled'
    ).sort((a, b) => {
      const order = { 'Nakliye': 1, 'Depo': 2, 'Asansör': 3 };
      const typeA = a.type || 'Nakliye';
      const typeB = b.type || 'Nakliye';
      
      if (order[typeA] !== order[typeB]) {
          return order[typeA] - order[typeB];
      }
      return new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00'));
    });

    const maviYakaList = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      const isCollarMatch = p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operatör'].includes(p.position));
      if (!isCollarMatch) return false;
      if (p.employmentStatus === 'Aktif') return true;
      // YENİ: İşi bırakan personel, bıraktığı tarihe kadar (o tarih dahil) geçmiş günlerde
      // hâlâ ekip listesinde görünsün; bıraktığı tarihten SONRAKİ günlerde artık hiç görünmesin.
      if (p.passiveDate && selectedDate <= p.passiveDate) return true;
      return false;
    });

    const busyPersonnelIdsThisDay = jobs
      .filter(j => j.date === selectedDate && j.status !== 'cancelled' && !j.isHiddenFromTeam)
      .flatMap(j => j.assignedPersonnelIds || []);

    const busyVehiclesThisDay = jobs
      .filter(j => j.date === selectedDate && j.status !== 'cancelled' && j.assignedVehiclePlate && !j.isHiddenFromTeam)
      .map(j => j.assignedVehiclePlate);

    const selectedDay = parseInt(selectedDate.split('-')[2], 10);

    let displayPersonnel = maviYakaList.filter(p => {
       const d = mesaiData[p.id]?.[selectedDay];
       const st = typeof d === 'object' && d !== null ? d.status : d;
       if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ', 'D'].includes(st)) return false; 
       return true;
    });

    // YENİ: Aynı pozisyon içinde artık otomatik özellik puanına göre sıralanır
    const skillsMap = React.useMemo(() => computeAllAutoSkills(personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords), [personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords]);
    const posOrder = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3, 'Operatör': 4 };
    displayPersonnel.sort((a, b) => {
        const orderA = posOrder[a.position] || 99;
        const orderB = posOrder[b.position] || 99;
        if (orderA !== orderB) return orderA - orderB;
        const skillDiff = computeAvgSkillForPerson(b, skillsMap) - computeAvgSkillForPerson(a, skillsMap);
        if (skillDiff !== 0) return skillDiff;
        return a.fullName.localeCompare(b.fullName);
    });
    
    let availableVehicles = vehicles.filter(v => !busyVehiclesThisDay.includes(v.plate));
    availableVehicles.sort((a, b) => {
      const getMaxCap = (caps) => Math.max(0, ...(caps || []).map(c => parseInt(c.split('+')[0]) || 0));
      return getMaxCap(b.capacity) - getMaxCap(a.capacity);
    });

    const handleDragStart = (e, itemType, itemId, sourceJobId) => {
      e.dataTransfer.setData('itemType', itemType); 
      e.dataTransfer.setData('itemId', itemId);
      e.dataTransfer.setData('sourceJobId', sourceJobId || 'unassigned');
      e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e, targetId) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverTarget(targetId);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setDragOverTarget(null);
    };

    const handleDropToJob = async (e, targetJobId) => {
      e.preventDefault();
      setDragOverTarget(null);
      const itemType = e.dataTransfer.getData('itemType');
      const itemId = e.dataTransfer.getData('itemId');
      const sourceJobId = e.dataTransfer.getData('sourceJobId');

      if (!itemId || sourceJobId === targetJobId) return;

      try {
        if (itemType === 'person') {
          const targetJob = jobs.find(j => j.id === targetJobId);
          let newIds = [...(targetJob.assignedPersonnelIds || [])];
          const person = personnelList.find(p => String(p.id) === String(itemId));

          if (targetJob.type === 'Asansör' && person.position !== 'Operatör') {
              alert("Asansör işlerine sadece 'Operatör' pozisyonundaki personeller atanabilir!");
              return;
          }

          if (newIds.length === 0 && targetJob.type !== 'Asansör') {
              const isValidFirst = (person.rank === 'Ekip Şefi' || person.rank === 'Heryerden Usta' || person.rank === 'Kalfa' || person.rank === 'Müdür' || person.position === 'Firma Sahibi');

              if (!isValidFirst) {
                  alert("İşin en başına eklenecek ilk kişi Ekip Şefi veya yetkili biri olmalıdır!");
                  return;
              }
          }

          if (!newIds.includes(itemId)) newIds.push(itemId);

          const manualNames = (targetJob.teamNames || []).filter(name => !targetJob.assignedPersonnelIds?.includes(personnelList.find(p => p.fullName === name)?.id));
          const systemNames = newIds.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
          const allNames = [...systemNames, ...manualNames];

          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', targetJobId), {
            assignedPersonnelIds: newIds,
            assignedPersonnelId: newIds[0] || null, 
            teamNames: allNames,
            team: allNames.length > 0 ? allNames.join(', ') : 'Atanmadı'
          });

          if (sourceJobId !== 'unassigned') {
            const sourceJob = jobs.find(j => j.id === sourceJobId);
            if (sourceJob) {
              let sIds = (sourceJob.assignedPersonnelIds || []).filter(id => String(id) !== String(itemId));
              const sManualNames = (sourceJob.teamNames || []).filter(name => !sourceJob.assignedPersonnelIds?.includes(personnelList.find(p => p.fullName === name)?.id));
              const sSystemNames = sIds.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
              const sAllNames = [...sSystemNames, ...sManualNames];

              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', sourceJobId), {
                assignedPersonnelIds: sIds,
                assignedPersonnelId: sIds[0] || null,
                teamNames: sAllNames,
                team: sAllNames.length > 0 ? sAllNames.join(', ') : 'Atanmadı'
              });
            }
          }
        } else if (itemType === 'vehicle') {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', targetJobId), {
            assignedVehiclePlate: itemId
          });

          if (sourceJobId !== 'unassigned' && sourceJobId !== targetJobId) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', sourceJobId), {
              assignedVehiclePlate: ''
            });
          }
        }
      } catch (err) {
        console.error("Atama sırasında hata oluştu:", err);
      }
    };

    const handleDropToUnassigned = async (e) => {
      e.preventDefault();
      setDragOverTarget(null);
      const itemType = e.dataTransfer.getData('itemType');
      const itemId = e.dataTransfer.getData('itemId');
      const sourceJobId = e.dataTransfer.getData('sourceJobId');

      if (!itemId || sourceJobId === 'unassigned') return;

      try {
        if (itemType === 'person') {
          const sourceJob = jobs.find(j => j.id === sourceJobId);
          if (sourceJob) {
            let sIds = (sourceJob.assignedPersonnelIds || []).filter(id => String(id) !== String(itemId));
            const sManualNames = (sourceJob.teamNames || []).filter(name => !sourceJob.assignedPersonnelIds?.includes(personnelList.find(p => p.fullName === name)?.id));
            const sSystemNames = sIds.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
            const sAllNames = [...sSystemNames, ...sManualNames];

            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', sourceJobId), {
              assignedPersonnelIds: sIds,
              assignedPersonnelId: sIds[0] || null,
              teamNames: sAllNames,
              team: sAllNames.length > 0 ? sAllNames.join(', ') : 'Atanmadı'
            });
          }
        } else if (itemType === 'vehicle') {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', sourceJobId), {
            assignedVehiclePlate: ''
          });
        }
      } catch (err) {
        console.error("İptal işlemi sırasında hata:", err);
      }
    };

    // --- YENİ: "FAZLA İŞ ATA" FONKSİYONU ---
    // Bu fonksiyon TAMAMEN YENİ ve EKLENTİ niteliğindedir; mevcut atama
    // fonksiyonlarına (handleDropToJob, handleDropToUnassigned) hiç dokunulmadı.
    // Amaç: O gün başka bir işe zaten yazılmış (meşgul) bir personeli/aracı, ASIL
    // işinden ÇIKARMADAN, seçilen farklı bir işe de EK olarak eklemek.
    const handleFazlaIsAta = async () => {
      setFazlaIsAtaError('');
      if (!fazlaIsAtaJobId || (!fazlaIsAtaPersonId && !fazlaIsAtaVehiclePlate)) {
        setFazlaIsAtaError('Lütfen bir iş ve en az bir personel veya araç seçin.');
        return;
      }

      const targetJob = jobs.find(j => j.id === fazlaIsAtaJobId);
      if (!targetJob) {
        setFazlaIsAtaError('İş bulunamadı.');
        return;
      }

      const updateData = {};

      if (fazlaIsAtaPersonId) {
        const person = personnelList.find(p => String(p.id) === String(fazlaIsAtaPersonId));
        if (!person) {
          setFazlaIsAtaError('Personel bulunamadı.');
          return;
        }

        // Asansör işlerine sadece Operatör atanabilir kuralı korunuyor
        if (targetJob.type === 'Asansör' && person.position !== 'Operatör') {
          setFazlaIsAtaError("Asansör işlerine sadece 'Operatör' pozisyonundaki personeller atanabilir!");
          return;
        }

        let newIds = [...(targetJob.assignedPersonnelIds || [])];
        if (newIds.includes(fazlaIsAtaPersonId)) {
          setFazlaIsAtaError('Bu personel zaten bu işe atanmış.');
          return;
        }
        newIds.push(fazlaIsAtaPersonId);

        const manualNames = (targetJob.teamNames || []).filter(name => !targetJob.assignedPersonnelIds?.includes(personnelList.find(p => p.fullName === name)?.id));
        const systemNames = newIds.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
        const allNames = [...systemNames, ...manualNames];

        updateData.assignedPersonnelIds = newIds;
        updateData.assignedPersonnelId = newIds[0] || null;
        updateData.teamNames = allNames;
        updateData.team = allNames.length > 0 ? allNames.join(', ') : 'Atanmadı';
      }

      // YENİ: Fazladan araç ataması - o gün başka bir işte olsa bile (boşta olma şartı aranmadan)
      // seçilen araç, ilgili işe atanabiliyor.
      if (fazlaIsAtaVehiclePlate) {
        updateData.assignedVehiclePlate = fazlaIsAtaVehiclePlate;
      }

      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', fazlaIsAtaJobId), updateData);

        const person = fazlaIsAtaPersonId ? personnelList.find(p => String(p.id) === String(fazlaIsAtaPersonId)) : null;
        const logParts = [];
        if (person) logParts.push(`${person.fullName} personeli`);
        if (fazlaIsAtaVehiclePlate) logParts.push(`${fazlaIsAtaVehiclePlate} plakalı araç`);
        if (addSystemLog) addSystemLog('Fazla İş Ata', `${logParts.join(' ve ')}, ${targetJob.customerName || 'iş'} operasyonuna ek olarak atandı.`);

        setFazlaIsAtaPersonId('');
        setFazlaIsAtaJobId('');
        setFazlaIsAtaVehiclePlate('');
        setShowFazlaIsAtaModal(false);
      } catch (err) {
        console.error('Fazla iş atama sırasında hata:', err);
        setFazlaIsAtaError('Atama sırasında bir hata oluştu.');
      }
    };

    return (
      <div className="flex flex-col lg:h-[calc(100vh-140px)] animate-in fade-in pb-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <Users className="w-7 h-7 text-orange-500" /> Ekip Kurma Tahtası
            </h2>
            <p className="text-sm font-medium text-neutral-500 mt-1">Günü seçin, boştaki araç ve personelleri ilgili işlerin içine sürükleyerek ekipleri kurun.</p>
          </div>
          <div className="flex items-center gap-2 bg-neutral-100 p-2 rounded-xl border border-neutral-200 w-full md:w-auto">
            <CalendarDays className="w-5 h-5 text-neutral-500 ml-1" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-black cursor-pointer px-2"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 lg:overflow-hidden">
          
          {/* SOL: İŞ SÜTUNLARI (DİKEY KAYDIRMA AKTİF EDİLDİ) */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-[520px] lg:h-full relative">
            {dailyJobs.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300">
                <ClipboardList className="w-16 h-16 text-neutral-300 mb-3" />
                <p className="font-bold text-neutral-500 text-lg">Bu tarihte hiç operasyon kaydı bulunamadı.</p>
              </div>
            ) : (
              <div className="flex gap-4 min-h-full items-start w-max min-w-full pb-4">
                {dailyJobs.map(job => (
                  <BoardJobCard 
                    key={job.id} 
                    job={job} 
                    personnelList={personnelList} 
                    vehicles={vehicles}
                    materials={materials}
                    dragOverTarget={dragOverTarget}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDropToJob={handleDropToJob}
                    handleDragStart={handleDragStart}
                    db={db} 
                    appId={appId}
                    calculateMaterials={calculateMaterials}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SAĞ: BOŞTAKİ ARAÇLAR VE PERSONELLER */}
          <div 
            onDragOver={(e) => handleDragOver(e, 'unassigned')}
            onDragLeave={handleDragLeave}
            onDrop={handleDropToUnassigned}
            className={`w-full lg:w-[220px] xl:w-[240px] h-auto lg:h-full flex flex-col gap-4 shrink-0 transition-colors ${dragOverTarget === 'unassigned' ? 'bg-orange-50/50 rounded-2xl ring-2 ring-orange-400 ring-inset p-2' : ''}`}
          >
            {/* Araç Havuzu */}
            <div className="h-[220px] lg:h-1/3 flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden shrink-0">
              <div className="p-2.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-xs text-black flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-purple-600" /> Boştaki Araçlar
                </h3>
                <span className="bg-black text-white px-1.5 py-0.5 rounded text-[10px] font-bold">{availableVehicles.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 bg-neutral-50/30">
                {availableVehicles.length === 0 ? (
                  <div className="text-center text-neutral-400 py-4 text-[10px] font-medium">Boşta araç bulunmuyor.</div>
                ) : (
                  availableVehicles.map(vehicle => (
                    <div 
                      key={vehicle.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'vehicle', vehicle.plate, 'unassigned')}
                      className="bg-white border border-neutral-200 rounded-xl p-2 flex items-center gap-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-purple-400 transition group"
                    >
                      <div className="bg-purple-100 p-1.5 rounded-lg shrink-0"><Truck className="w-3.5 h-3.5 text-purple-600"/></div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-[11px] text-black tracking-widest">{vehicle.plate}</h4>
                        <p className="text-[9px] font-medium text-neutral-500">{vehicle.type} • {vehicle.capacity[0] || '?'} Ev</p>
                      </div>
                      <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Personel Havuzu */}
            <div className="h-[340px] lg:flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden shrink-0 lg:shrink">
              <div className="p-2.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-xs text-black flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-orange-500" /> Ekipler
                </h3>
                {/* YENİ: Fazla İş Ata Butonu - mevcut başlık/yapı değiştirilmeden eklendi */}
                <button
                  type="button"
                  onClick={() => { setFazlaIsAtaError(''); setFazlaIsAtaPersonId(''); setFazlaIsAtaJobId(''); setFazlaIsAtaVehiclePlate(''); setShowFazlaIsAtaModal(true); }}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-sm transition flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Fazla İş Ata
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 bg-neutral-50/30">
                {displayPersonnel.length === 0 ? (
                  <div className="text-center text-neutral-400 py-6 text-[10px] font-medium">Boşta personel bulunmuyor.</div>
                ) : (
                  displayPersonnel.map(person => {
                    const isBusy = busyPersonnelIdsThisDay.includes(person.id);
                    return (
                      <div 
                        key={person.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'person', person.id, 'unassigned')}
                        className={`bg-white border rounded-xl p-2 flex items-center gap-2.5 shadow-sm cursor-grab active:cursor-grabbing transition hover:shadow-md group ${isBusy ? 'border-orange-300 opacity-80' : 'border-neutral-200 hover:border-orange-500'}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                          {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" alt={person.fullName} /> : <User className="w-3.5 h-3.5 text-neutral-400" />}
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col justify-center">
                          <div className="flex items-center gap-1">
                            <h4 className="font-bold text-[11px] text-black truncate">{person.fullName}</h4>
                            {isBusy && <span className="text-[8px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded font-black border border-orange-200 shrink-0">MEŞGUL</span>}
                          </div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{person.position}</p>
                        </div>
                        <PersonPositionRankIcons person={person} />
                        <SkillScoreBadge person={person} skillsMap={skillsMap} />
                        <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>

        {/* --- YENİ: FAZLA İŞ ATA MODALI --- */}
        {/* Mevcut hiçbir bileşen/JSX değiştirilmedi; bu modal tamamen ek olarak eklendi. */}
        {showFazlaIsAtaModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-orange-500 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Fazla İş Ata
                </h3>
                <button onClick={() => setShowFazlaIsAtaModal(false)} className="text-orange-100 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs font-medium text-neutral-500">
                  O gün başka bir işe zaten atanmış (meşgul) personelleri, mevcut işlerinden çıkarmadan
                  seçtiğiniz farklı bir işe de EK personel olarak atayabilirsiniz.
                </p>

                {fazlaIsAtaError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {fazlaIsAtaError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-black mb-1">Meşgul / Ekip Personeli Seçin (İsteğe Bağlı)</label>
                  <select
                    value={fazlaIsAtaPersonId}
                    onChange={(e) => setFazlaIsAtaPersonId(e.target.value)}
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium"
                  >
                    <option value="">-- Personel Seçin --</option>
                    {busyPersonnelIdsThisDay
                      .filter((id, idx, arr) => arr.indexOf(id) === idx)
                      .map(id => personnelList.find(p => String(p.id) === String(id)))
                      .filter(Boolean)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.fullName} ({p.position})</option>
                      ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">Bu liste, o gün en az bir işe atanmış tüm ekip üyelerini gösterir.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-1">Ek Olarak Atanacak İş</label>
                  <select
                    value={fazlaIsAtaJobId}
                    onChange={(e) => setFazlaIsAtaJobId(e.target.value)}
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium"
                  >
                    <option value="">-- İş Seçin --</option>
                    {dailyJobs.map(j => (
                      <option key={j.id} value={j.id}>{j.customerName} — {j.type || 'Nakliye'} ({j.time || '--:--'})</option>
                    ))}
                  </select>
                </div>

                {/* YENİ: Fazladan İşe Gidecek Ek Araç Seçimi - boşta olma şartı aranmadan TÜM araçlar listelenir */}
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Fazladan Gidecek Ek Araç (İsteğe Bağlı)</label>
                  <select
                    value={fazlaIsAtaVehiclePlate}
                    onChange={(e) => setFazlaIsAtaVehiclePlate(e.target.value)}
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium"
                  >
                    <option value="">-- Araç Seçilmedi --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">Bu listede araçların o gün boşta olup olmadığına bakılmaz, tüm filo gösterilir.</p>
                </div>

                <button
                  type="button"
                  onClick={handleFazlaIsAta}
                  className="w-full py-4 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition flex justify-center items-center gap-2 shadow-lg mt-2"
                >
                  <CheckCircle className="w-5 h-5" /> Fazladan Ata
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };
  // --- EKİP KURMA TAHTASI SONU ---

  export const MyAssignedJobsView = ({ jobs, currentUser, handleOpenEndJobModal, markNotificationsAsRead }) => {
    useEffect(() => {
      if (currentUser?.id) {
        markNotificationsAsRead(currentUser.id);
      }
    }, [currentUser?.id]); // Sonsuz döngüyü kırmak için obje bağımlılığı kaldırıldı, sadece ID dinleniyor

    const todayStr = new Date().toISOString().split('T')[0];
    
    // YENİ EKLENEN: Mavi yaka ve Ekip Şefi OLMAYAN durumu kontrol et
    const isStandardBlueCollar = (currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position))) && currentUser?.rank !== 'Ekip Şefi' && currentUser?.rank !== 'Heryerden Usta' && currentUser?.rank !== 'Kalfa' && currentUser?.rank !== 'Müdür' && currentUser?.position !== 'Firma Sahibi' && !currentUser?.permissions?.canEdit;

    const myJobs = jobs.filter(j => {
        const isAssigned = j.assignedPersonnelIds?.includes(currentUser.id) || j.assignedPersonnelId === currentUser.id;
        if (!isAssigned) return false;
        if (j.isHiddenFromTeam) return false;
        // Ekip Şefi değilse (Standart mavi yaka) işleri sadece atandığı gün sabah görür
        if (isStandardBlueCollar && j.date > todayStr) return false;
        return true;
    });

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <ClipboardList className="w-6 h-6 text-red-600" /> Bana Atanan Görevler
        </h2>
        <div className="space-y-4">
           {myJobs.length === 0 ? (
              <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 font-medium">
                Atanmış aktif operasyonunuz bulunmuyor.
              </div>
           ) : myJobs.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(job => {
              const isMainAssignee = job.assignedPersonnelId === currentUser.id;

              return (
              <div key={job.id} className="p-5 border border-neutral-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-black text-lg">
                         {isStandardBlueCollar ? 'Operasyon Görevi' : job.customerName}
                      </h3>
                      <p className="text-sm font-medium text-neutral-500 flex items-center gap-1.5 mt-1">
                        <CalendarDays className="w-4 h-4" /> {job.date} - {job.time}
                      </p>
                      {!isStandardBlueCollar && (
                        <a href={`tel:${(job.customerPhone || '').replace(/\D/g, '')}`} className="text-sm font-bold text-neutral-700 flex items-center gap-1.5 mt-1 hover:text-red-600 transition w-max bg-neutral-100 px-2 py-1 rounded-lg">
                          <Phone className="w-4 h-4 text-red-600" /> {job.customerPhone}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                        job.status === 'completed' ? 'bg-black text-white' :
                        job.status === 'in-progress' ? 'bg-red-600 text-white' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
                      </span>
                      {job.createdBy && (
                        <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200" title={`Kayıt Eden: ${job.createdBy}`}>
                          <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 text-[8px]">
                             {job.createdBy.charAt(0)}
                          </div>
                          <span className="text-[10px] font-bold text-neutral-600">{job.createdBy}</span>
                        </div>
                      )}
                    </div>
                 </div>

                 {/* EKİP & ARAÇ BİLGİSİ */}
                 <div className="flex flex-wrap items-center gap-2 text-xs mb-1 mt-2 border-t border-neutral-100 pt-3">
                    {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(job.teamNames || [job.team]).map((name, i) => (
                          <span key={i} className="flex items-center gap-1 font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">
                            <User className="w-3.5 h-3.5" /> {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg border border-yellow-100">
                        <User className="w-3.5 h-3.5" /> Ekip Atanmamış
                      </span>
                    )}
                    {job.assignedVehiclePlate && (
                      <span className="flex items-center gap-1 font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100">
                        <Truck className="w-3.5 h-3.5" /> {job.assignedVehiclePlate}
                      </span>
                    )}
                 </div>

                 {/* ASANSÖR GÖREV DETAYLARI (BÜYÜK GÖSTERİM) */}
                 {job.type === 'Asansör' && (job.assignedTargetVehiclePlate || job.assignedJobTime) && (
                    <div className="bg-white border-2 border-red-500 p-4 sm:p-5 rounded-2xl mt-3 flex flex-col gap-4 shadow-lg animate-in zoom-in-95 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
                       <h4 className="font-black text-red-600 text-lg sm:text-xl flex items-center gap-2 border-b border-red-100 pb-2">
                          <ArrowUpRight className="w-6 h-6 sm:w-7 sm:h-7" /> Asansör Operasyon Detayları
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {job.assignedJobTime && (
                             <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex items-center gap-4">
                                <div className="bg-red-100 p-3 rounded-xl shrink-0"><Clock className="w-8 h-8 text-red-600" /></div>
                                <div>
                                   <span className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">İşe Gidiş Saati</span>
                                   <span className="block text-2xl sm:text-3xl font-black text-black">{job.assignedJobTime}</span>
                                </div>
                             </div>
                          )}
                          {job.assignedTargetVehiclePlate && (
                             <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex items-center gap-4">
                                <div className="bg-red-100 p-3 rounded-xl shrink-0"><Truck className="w-8 h-8 text-red-600" /></div>
                                <div>
                                   <span className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Kurulacak Araç</span>
                                   <div className="flex items-center gap-2 flex-wrap">
                                      <span className="block text-xl sm:text-2xl font-black text-black tracking-wider uppercase">{job.assignedTargetVehiclePlate}</span>
                                      {job.isTargetVehicleExternal && <span className="text-[10px] bg-black text-white px-2 py-1 rounded-md font-bold shrink-0 shadow-sm">DIŞ ARAÇ</span>}
                                   </div>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                 )}

                 {/* ADRES BİLGİLERİ */}
                 <div className="text-sm text-neutral-600 bg-neutral-50 p-4 rounded-xl border border-neutral-100 flex flex-col gap-3 mt-2">
                    {/* AL (YÜKLEME) */}
                    <div>
                      <p className="font-bold text-black flex items-start gap-1"><MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0"/> AL (Yükleme): {job.fromProvince}/{job.fromDistrict}</p>
                      <p className="text-xs ml-5 mt-0.5">{job.fromAddress}</p>
                      <p className="text-[10px] ml-5 text-neutral-500 font-bold mt-1">Daire: {job.fromRoomCount} | Kat: {job.fromFloor} | Şekil: {job.fromTransportMethod} | Eşya: {job.fromPacking}</p>
                      {isMainAssignee && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((job.fromProvince || '') + ' ' + (job.fromDistrict || '') + ' ' + (job.fromAddress || ''))}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1 transition w-max mt-2 ml-5">
                          <MapPin className="w-3 h-3"/> Yol Tarifi Al
                        </a>
                      )}
                    </div>
                    {job.extraLoadingAddresses?.map((addr, idx) => (
                      <div key={'ext-from-'+idx} className="pt-2 border-t border-neutral-200">
                        <p className="font-bold text-black flex items-start gap-1"><MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0"/> {idx+2}. AL (Yükleme): {addr.province}/{addr.district}</p>
                        <p className="text-xs ml-5 mt-0.5">{addr.address}</p>
                        <p className="text-[10px] ml-5 text-neutral-500 font-bold mt-1">Daire: {addr.roomCount} | Kat: {addr.floor} | Şekil: {addr.transportMethod} | Eşya: {addr.packing}</p>
                        {isMainAssignee && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr.province || '') + ' ' + (addr.district || '') + ' ' + (addr.address || ''))}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1 transition w-max mt-2 ml-5">
                            <MapPin className="w-3 h-3"/> Yol Tarifi Al
                          </a>
                        )}
                      </div>
                    ))}

                    {/* VR (BOŞALTMA) - TÜM GÖREVLİLER GÖREBİLİR */}
                    {job.toDistrict && (
                      <>
                        <div className="w-full h-px bg-neutral-200 my-1"></div>
                        <div>
                          <p className="font-bold text-red-700 flex items-start gap-1"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0"/> VR (Boşaltma): {job.toProvince}/{job.toDistrict}</p>
                          <p className="text-xs ml-5 mt-0.5 text-neutral-700">{job.toAddress}</p>
                          <p className="text-[10px] ml-5 text-neutral-500 font-bold mt-1">Daire: {job.toRoomCount} | Kat: {job.toFloor} | Şekil: {job.toTransportMethod} | Eşya: {job.toPacking}</p>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((job.toProvince || '') + ' ' + (job.toDistrict || '') + ' ' + (job.toAddress || ''))}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 transition w-max mt-2 ml-5">
                            <MapPin className="w-3 h-3"/> Yol Tarifi Al
                          </a>
                        </div>
                        {job.extraUnloadingAddresses?.map((addr, idx) => (
                          <div key={'ext-to-'+idx} className="pt-2 border-t border-neutral-200">
                            <p className="font-bold text-red-700 flex items-start gap-1"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0"/> {idx+2}. VR (Boşaltma): {addr.province}/{addr.district}</p>
                            <p className="text-xs ml-5 mt-0.5 text-neutral-700">{addr.address}</p>
                            <p className="text-[10px] ml-5 text-neutral-500 font-bold mt-1">Daire: {addr.roomCount} | Kat: {addr.floor} | Şekil: {addr.transportMethod} | Eşya: {addr.packing}</p>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr.province || '') + ' ' + (addr.district || '') + ' ' + (addr.address || ''))}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 transition w-max mt-2 ml-5">
                              <MapPin className="w-3 h-3"/> Yol Tarifi Al
                            </a>
                          </div>
                        ))}
                      </>
                    )}
                 </div>

                 {/* SÖZLEŞME VE NOTLAR */}
                 {(job.contractDetails || job.notes) && (
                   <div className="grid grid-cols-1 gap-2 mt-2">
                     {job.contractDetails && (
                       <p className="text-xs bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 flex items-start gap-2">
                         <FileText className="w-4 h-4 text-blue-500 shrink-0"/>
                         <span><b className="block mb-0.5 text-blue-900">Sözleşme Detayı:</b> {job.contractDetails}</span>
                       </p>
                     )}
                     {job.notes && (
                       <p className="text-xs bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-100 flex items-start gap-2">
                         <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0"/>
                         <span><b className="block mb-0.5 text-yellow-900">Operasyon Notu:</b> {job.notes}</span>
                       </p>
                     )}
                   </div>
                 )}

                 {/* MALZEME BİLGİSİ */}
                 {job.type !== 'Asansör' && (
                 <div className="mt-2 text-xs font-medium bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 flex flex-col md:flex-row gap-x-3 gap-y-2 md:items-center">
                    <div className="flex items-center gap-1.5 shrink-0"><Package className="w-4 h-4 text-amber-600" /> <b className="text-amber-900">Operasyon Malzemeleri:</b></div>
                    <div className="flex gap-3 flex-wrap flex-1">
                      {(() => {
                        const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking);
                        return (
                          <>
                            <span><b>{est.strec}</b> Streç</span>
                            <span><b>{est.bant}</b> Bant</span>
                            <span><b>{est.poset}</b> Poşet</span>
                            <span><b>{est.kagit}kg</b> Kağıt</span>
                            <span><b>{est.koli}</b> Koli</span>
                          </>
                        );
                      })()}
                    </div>
                    {job.customMaterials && job.customMaterials.length > 0 && (
                      <div className="flex gap-2 flex-wrap border-l border-amber-200 pl-3 ml-2">
                        {job.customMaterials.map(cm => (
                          <span key={cm.id} className="font-bold">+{cm.amount} {cm.name}</span>
                        ))}
                      </div>
                    )}
                 </div>
                 )}

                 {/* FİYAT BİLGİSİ (SADECE ASIL GÖREVLİ) */}
                 {isMainAssignee && job.price && (
                    <div className="mt-2 flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-xl">
                      <span className="text-xs font-bold text-green-800 flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-green-600"/> Anlaşılan Ücret</span>
                      <div className="text-right">
                        <span className="block text-lg font-black text-green-700">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                        {job.deposit && <span className="block text-[10px] font-bold text-green-600">Kapora: ₺{parseInt(job.deposit).toLocaleString('tr-TR')}</span>}
                      </div>
                    </div>
                 )}

                 {/* SADECE ASIL GÖREVLİ SONLANDIRABİLİR */}
                 {job.status === 'in-progress' && isMainAssignee && (
                   <div className="mt-4 flex flex-col gap-2">
                     <button 
                       onClick={() => {
                         let phone = job.customerPhone.replace(/\D/g, '');
                         if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                         else if (!phone.startsWith('90')) phone = '90' + phone;
                         const msg = `Merhaba *${job.customerName}* 👋\n\nSembol Nakliyat ekibi olarak operasyonunuz için yola çıkmış bulunmaktayız. 🚚💨\n\n*Önemli Not:* Açık adresinize doğru hareket ettik, ancak adresi daha kolay ve hızlı bulabilmemiz için bize bu sohbet üzerinden *konum gönderirseniz* çok seviniriz. 📍\n\nAnlayışınız için teşekkür ederiz, görüşmek üzere! 🤝`;
                         window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                       }}
                       className="w-full py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-xl transition flex justify-center items-center gap-2 shadow-sm text-sm"
                     >
                       <MessageCircle className="w-5 h-5" /> Müşteriden WhatsApp'tan Konum İste
                     </button>
                     <button onClick={() => handleOpenEndJobModal(job)} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition flex justify-center items-center gap-2 shadow-md text-base">
                       <CheckCircle className="w-6 h-6" /> İşi Sonlandır & Teslim Kodu Gir
                     </button>
                   </div>
                 )}
              </div>
           )})}
        </div>
      </div>
    );
  };

  export const MyComplaintSubmitView = ({ currentUser, db, appId, addSystemLog }) => {
    const [complaintSubject, setComplaintSubject] = useState('');
    const [complaintContent, setComplaintContent] = useState('');
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    const showMessage = (text, type = 'success') => {
      setStatusMessage({ text, type });
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
    };

    const submitComplaint = async (e) => {
       e.preventDefault();
       try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'complaints'), {
            senderId: currentUser.id,
            senderName: currentUser.fullName,
            senderPosition: currentUser.position,
            subject: complaintSubject,
            content: complaintContent,
            status: 'Yeni',
            read: false,
            timestamp: new Date().toISOString(),
            dateStr: new Date().toLocaleString('tr-TR')
          });
          setComplaintSubject(''); setComplaintContent('');
          showMessage('Bildiriminiz yöneticilere başarıyla iletildi.', 'success');
       } catch(err) { console.error(err); showMessage('Bir hata oluştu.', 'error'); }
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto relative">
         {statusMessage.text && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-sm shadow-xl z-50 animate-in slide-in-from-top-4 ${statusMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
              {statusMessage.text}
            </div>
         )}
         <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
           <AlertTriangle className="w-6 h-6 text-red-600" /> Şikayet / Sorun Bildirimi
         </h2>
         <div  className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-800 font-medium mb-4">
               Sistemdeki sorunları, personel şikayetlerini veya araç/ekipman eksikliklerini doğrudan yönetim kuruluna iletebilirsiniz.
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1">Konu Başlığı</label>
              <input required type="text" value={complaintSubject} onChange={e => setComplaintSubject(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 34 SBL 01 Aracında Arıza" />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1">Detaylı Açıklama</label>
              <textarea required value={complaintContent} onChange={e => setComplaintContent(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-32 resize-none transition" placeholder="Sorunu tüm detaylarıyla açıklayın..."></textarea>
            </div>
            <button type="button" onClick={submitComplaint} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
               <Send className="w-5 h-5" /> Bildirimi Yöneticilere Gönder
            </button>
         </div>
      </div>
    );
  };

  // --- PUANTAJ VIEW (Aylık Tablo) ---
