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
  aktifBankaHesabi, ibanBicimle } from './shared.jsx';


  export const AddInfoView = ({ currentUser, personnelList, addSystemLog, onBack }) => {
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
        {/* YENİ: Bu sayfa artık sol menüde değil, Bildirim Merkezi'nin sağ üstündeki
            butondan açılıyor; bu yüzden geri dönüş bağlantısı eklendi. */}
        {onBack && (
          <div className="max-w-2xl mx-auto mb-3">
            <button onClick={onBack} className="text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Bildirim Merkezi'ne Dön
            </button>
          </div>
        )}
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
  // ============================================================================
  // YENİ: PERSONEL BAŞVURU TAKİP MERKEZİ (Aday Takip Sistemi / ATS)
  // Beyaz ve mavi yaka pozisyonlarına iş ilanından başvuran tüm adayların
  // uçtan uca takibi: başvuru → görüşme → sınav → değerlendirme → kadroya alma.
  // Sınav sonuçları aday kartına eklenir; onaylanan aday tek tıkla kadroya çekilir.
  // ============================================================================
  export const PersonelBasvuruView = ({ positions, currentUser, onHire, addSystemLog, setViewingImage }) => {
    // YENİ 3 AŞAMALI SÜREÇ: Yeni Başvuru → (Değerlendirme / Yedek Havuz / Reddedildi) → Kadroya Alındı
    // "Görüşme Planlandı" ve "Sınav Aşaması" aşamaları kaldırıldı.
    const STAGES = [
      { id: 'Yeni Başvuru',   color: 'bg-sky-100 text-sky-700 border-sky-200',        dot: 'bg-sky-500' },
      { id: 'Değerlendirme',  color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
      { id: 'Yedek Havuz',    color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
      { id: 'Reddedildi',     color: 'bg-red-100 text-red-600 border-red-200',         dot: 'bg-red-500' },
      { id: 'Kadroya Alındı', color: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-600' },
    ];
    const SOURCES = ['İş İlanı Sitesi', 'Sosyal Medya', 'Referans', 'Şubeye Başvuru', 'Diğer'];
    // Sistemdeki pozisyonlar (App.jsx'ten gelir); boşsa varsayılan liste
    const POSITION_LIST = (positions && positions.length > 0) ? positions : ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu'];

    const [candidates, setCandidates] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stageFilter, setStageFilter] = useState('Tümü');
    const [collarFilter, setCollarFilter] = useState('Tümü');
    const [positionFilter, setPositionFilter] = useState('Tümü'); // YENİ: pozisyona göre filtre
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [hireCandidate, setHireCandidate] = useState(null);
    const [belgeUploading, setBelgeUploading] = useState(false); // form içinde belge yükleniyor mu
    const [belgeLabel, setBelgeLabel] = useState('');            // yeni belge adı
    const [detayBelgeUploading, setDetayBelgeUploading] = useState(null); // detayda belge yükleyen aday id

    const emptyForm = {
      fullName: '', phone: '', collarType: 'Mavi Yaka', position: POSITION_LIST[0] || 'Şoför',
      source: 'İş İlanı Sitesi', expectedSalary: '', address: '', notes: '', stage: 'Yeni Başvuru', belgeler: []
    };
    const [form, setForm] = useState(emptyForm);

    // Adaylar Firestore'dan canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'candidates'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCandidates(list);
      });
      return () => unsub();
    }, []);

    // Dosyayı sunucuya yükleyip URL döndürür
    const uploadFile = async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
      const text = await res.text();
      try { const json = JSON.parse(text); return json.url || json.fileName || json.file || text; } catch (err) { return text.trim(); }
    };

    // YENİ: Form içinde belge ekle (aday kaydından önce). Artık BİRDEN FAZLA dosya/fotoğraf aynı anda
    // seçilebilir (Şimdi Çek / Galeriden Yükle / Dosyadan). Her dosya sırayla yüklenip form.belgeler
    // dizisine ayrı bir kayıt olarak eklenir. "Belge adı" artık opsiyoneldir: yazılmazsa dosyanın kendi
    // adı kullanılır; yazılıp birden fazla dosya seçilirse sonuna sıra numarası eklenir (CV (1), CV (2)...).
    const handleFormBelgeUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setBelgeUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadFile(file);
          const label = belgeLabel.trim()
            ? (files.length > 1 ? `${belgeLabel.trim()} (${i + 1})` : belgeLabel.trim())
            : (file.name || `Belge ${i + 1}`);
          setForm(prev => ({ ...prev, belgeler: [...(prev.belgeler || []), { id: Date.now().toString() + '_' + i, label, url }] }));
        }
        setBelgeLabel('');
      } catch (err) { alert('Belge yüklenemedi.'); }
      setBelgeUploading(false);
    };
    const handleFormBelgeRemove = (id) => setForm(prev => ({ ...prev, belgeler: (prev.belgeler || []).filter(b => b.id !== id) }));

    // Aday kaydet (yeni veya düzenleme)
    const handleSaveCandidate = async () => {
      if (!form.fullName.trim() || !form.phone.trim()) return;
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', editingId), { ...form });
        addSystemLog?.('Aday Güncellendi', `${form.fullName} adlı adayın bilgileri güncellendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'candidates'), {
          ...form, exams: [], history: [{ date: new Date().toISOString(), text: 'Başvuru alındı', by: currentUser?.fullName || 'Sistem' }],
          createdBy: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
        });
        addSystemLog?.('Yeni Aday Başvurusu', `${form.fullName} adlı aday sisteme eklendi (${form.position}).`);
      }
      setForm(emptyForm); setEditingId(null); setShowForm(false); setBelgeLabel('');
    };

    // Aşama değiştir (süreç geçmişine işlenir)
    const handleStageChange = async (cand, newStage) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', cand.id), {
        stage: newStage,
        history: [...(cand.history || []), { date: new Date().toISOString(), text: `Aşama: ${newStage}`, by: currentUser?.fullName || 'Sistem' }]
      });
    };

    // Adayı YEDEK HAVUZ'a al
    const handleMoveToPool = async (cand) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', cand.id), {
        stage: 'Yedek Havuz', pooledAt: new Date().toISOString(),
        history: [...(cand.history || []), { date: new Date().toISOString(), text: 'Yedek havuza alındı (ileride değerlendirilmek üzere)', by: currentUser?.fullName || 'Sistem' }]
      });
    };

    // Havuzdaki adayı tekrar sürece dahil et → artık "Değerlendirme" aşamasına döner
    const handleRecallFromPool = async (cand) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', cand.id), {
        stage: 'Değerlendirme', recalledAt: new Date().toISOString(),
        history: [...(cand.history || []), { date: new Date().toISOString(), text: 'Havuzdan tekrar değerlendirmeye alındı 📞', by: currentUser?.fullName || 'Sistem' }]
      });
    };

    // YENİ: Detay panelinde belge ekle (kayıtlı adaya). Artık BİRDEN FAZLA dosya/fotoğraf
    // aynı anda seçilebilir (Şimdi Çek / Galeriden / Dosyadan). Belge adı olarak dosyanın
    // kendi adı kullanılır; sonradan kalem simgesiyle yeniden adlandırılabilir.
    const handleDetayBelgeUpload = async (cand, e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setDetayBelgeUploading(cand.id);
      try {
        const yeniler = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadFile(file);
          yeniler.push({ id: Date.now().toString() + '_' + i, label: (file.name || `Belge ${i + 1}`), url });
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', cand.id), {
          belgeler: [...(cand.belgeler || []), ...yeniler],
          history: [...(cand.history || []), { date: new Date().toISOString(), text: `${yeniler.length} belge eklendi`, by: currentUser?.fullName || 'Sistem' }]
        });
      } catch (err) { alert('Belge yüklenemedi.'); }
      setDetayBelgeUploading(null);
    };
    // Detayda belge sil / adını değiştir
    const handleDetayBelgeRemove = async (cand, id) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', cand.id), { belgeler: (cand.belgeler || []).filter(b => b.id !== id) });
    };
    const handleDetayBelgeRename = async (cand, id) => {
      const cur = (cand.belgeler || []).find(b => b.id === id);
      const yeni = window.prompt('Belge adını düzenleyin:', cur?.label || '');
      if (yeni === null || !yeni.trim()) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', cand.id), { belgeler: (cand.belgeler || []).map(b => b.id === id ? { ...b, label: yeni.trim() } : b) });
    };

    // Filtrelenmiş liste (isim/telefon/pozisyon arama + aşama + yaka + pozisyon)
    const filtered = candidates.filter(cnd => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q || (cnd.fullName || '').toLowerCase().includes(q) || (cnd.phone || '').includes(q) || (cnd.position || '').toLowerCase().includes(q);
      const matchStage = stageFilter === 'Tümü' || cnd.stage === stageFilter;
      const matchCollar = collarFilter === 'Tümü' || cnd.collarType === collarFilter;
      const matchPos = positionFilter === 'Tümü' || cnd.position === positionFilter;
      return matchQ && matchStage && matchCollar && matchPos;
    });

    const stageOf = (id) => STAGES.find(s => s.id === id) || STAGES[0];
    // Adaylarda geçen benzersiz pozisyonlar (filtre için)
    const usedPositions = Array.from(new Set(candidates.map(c => c.position).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

    return (
      <div className="max-w-5xl mx-auto animate-in fade-in space-y-5">
        {/* BAŞLIK + ÖZET */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-700 to-emerald-900 rounded-2xl p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><UserPlus className="w-6 h-6" /> Personel Başvuru Merkezi</h2>
              <p className="text-green-100 text-xs md:text-sm mt-1">Tüm beyaz/mavi yaka aday başvurularını buradan takip edin. Süreç: Başvuru → Değerlendirme → Kadro.</p>
            </div>
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); setBelgeLabel(''); }}
              className="shrink-0 px-4 py-2.5 bg-white text-emerald-800 font-black rounded-xl shadow hover:scale-[1.03] transition flex items-center gap-2 text-sm">
              <PlusCircle className="w-4 h-4" /> Yeni Aday Ekle
            </button>
          </div>
          {/* Aşama sayaçları (5 aşama) */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-4">
            {STAGES.map(s => {
              const cnt = candidates.filter(cd => cd.stage === s.id).length;
              return (
                <button key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? 'Tümü' : s.id)}
                  className={`rounded-xl px-2 py-2 text-center transition border ${stageFilter === s.id ? 'bg-white text-emerald-900 border-white shadow' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                  <div className="text-lg font-black leading-none">{cnt}</div>
                  <div className="text-[9px] font-bold mt-1 leading-tight opacity-90">{s.id}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* FİLTRELER */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 space-y-2">
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="İsim, telefon veya pozisyon ara..."
                className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm" />
            </div>
            <div className="flex gap-2">
              {['Tümü', 'Mavi Yaka', 'Beyaz Yaka'].map(cType => (
                <button key={cType} onClick={() => setCollarFilter(cType)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${collarFilter === cType ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>
                  {cType}
                </button>
              ))}
            </div>
          </div>
          {/* YENİ: Pozisyona göre filtre */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-neutral-400 uppercase">Pozisyon:</span>
            <button onClick={() => setPositionFilter('Tümü')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${positionFilter === 'Tümü' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>Tümü</button>
            {usedPositions.map(p => (
              <button key={p} onClick={() => setPositionFilter(positionFilter === p ? 'Tümü' : p)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${positionFilter === p ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-400'}`}>{p}</button>
            ))}
            {(stageFilter !== 'Tümü' || positionFilter !== 'Tümü') && (
              <button onClick={() => { setStageFilter('Tümü'); setPositionFilter('Tümü'); }} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 flex items-center gap-1">Filtreyi Temizle <X className="w-3 h-3" /></button>
            )}
          </div>
        </div>

        {/* ADAY LİSTESİ */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-neutral-400 font-bold text-sm">
              {candidates.length === 0 ? 'Henüz aday başvurusu yok. "Yeni Aday Ekle" ile ilk adayı ekleyin.' : 'Filtreye uyan aday bulunamadı.'}
            </div>
          )}
          {filtered.map(cand => {
            const st = stageOf(cand.stage);
            const isOpen = expandedId === cand.id;
            const isFinal = cand.stage === 'Kadroya Alındı' || cand.stage === 'Reddedildi';
            return (
              <div key={cand.id} className={`bg-white rounded-2xl shadow-sm border transition overflow-hidden ${cand.stage === 'Kadroya Alındı' ? 'border-green-300' : cand.stage === 'Reddedildi' ? 'border-red-200 opacity-75' : cand.stage === 'Yedek Havuz' ? 'border-indigo-300' : 'border-neutral-200'}`}>
                {/* KART ÜSTÜ */}
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isOpen ? null : cand.id)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-black text-white text-sm ${cand.collarType === 'Beyaz Yaka' ? 'bg-sky-600' : 'bg-emerald-700'}`}>
                      {(cand.fullName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-black truncate flex items-center gap-2">
                        {cand.fullName}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cand.collarType === 'Beyaz Yaka' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{cand.collarType}</span>
                      </div>
                      <div className="text-xs text-neutral-500 font-medium truncate flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {cand.position}</span>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {cand.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(cand.belgeler || []).length > 0 && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" /> {(cand.belgeler || []).length} Belge
                      </span>
                    )}
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span> {cand.stage}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                  </div>
                </div>

                {/* DETAY PANELİ */}
                {isOpen && (
                  <div className="border-t border-neutral-100 bg-neutral-50/60 p-4 space-y-4 animate-in slide-in-from-top-1">
                    {/* Bilgi satırı */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><span className="text-neutral-400 font-bold block text-[9px] uppercase">Başvuru Kaynağı</span><span className="font-bold text-neutral-700">{cand.source || '-'}</span></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><span className="text-neutral-400 font-bold block text-[9px] uppercase">Maaş Beklentisi</span><span className="font-bold text-neutral-700">{cand.expectedSalary ? `${parseInt(cand.expectedSalary).toLocaleString('tr-TR')} TL` : '-'}</span></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5 col-span-2"><span className="text-neutral-400 font-bold block text-[9px] uppercase">Adres</span><span className="font-bold text-neutral-700">{cand.address || '-'}</span></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5 col-span-2 md:col-span-4"><span className="text-neutral-400 font-bold block text-[9px] uppercase">Başvuru Tarihi</span><span className="font-bold text-neutral-700">{cand.createdAt ? cand.createdAt.split('T')[0].split('-').reverse().join('.') : '-'}</span></div>
                    </div>
                    {cand.notes && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 font-medium"><b>Not:</b> {cand.notes}</div>}

                    {/* YENİ: ADAY BELGELERİ — görüntüle / adını değiştir / kaldır + yeni belge ekle */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-neutral-700 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 text-blue-600" /> Aday Belgeleri</h4>
                        {!isFinal && (
                          /* YENİ: Şimdi Çek / Galeriden Yükle / Dosyadan seçenekleri + birden fazla belge/fotoğraf seçimi */
                          <MediaCaptureMenu
                            compact
                            multiple
                            disabled={detayBelgeUploading === cand.id}
                            buttonLabel={detayBelgeUploading === cand.id ? 'Yükleniyor...' : 'Belge Ekle'}
                            buttonClassName="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                            onChange={(e) => handleDetayBelgeUpload(cand, e)}
                          />
                        )}
                      </div>
                      {(cand.belgeler || []).length === 0 ? (
                        <p className="text-[11px] text-neutral-400 font-medium">Henüz belge eklenmedi.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(cand.belgeler || []).map(b => (
                            <div key={b.id} className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2">
                              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                              <span className="font-bold text-neutral-700 text-xs flex-1 truncate" title={b.label}>{b.label}</span>
                              <button onClick={() => setViewingImage?.({ title: b.label, name: b.url })} className="text-[10px] font-bold text-neutral-600 bg-white border border-neutral-200 rounded px-1.5 py-0.5 hover:bg-neutral-100 flex items-center gap-0.5"><Eye className="w-3 h-3" /> Gör</button>
                              {!isFinal && <button onClick={() => handleDetayBelgeRename(cand, b.id)} className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 hover:bg-blue-100 flex items-center gap-0.5"><Edit className="w-3 h-3" /></button>}
                              {!isFinal && <button onClick={() => handleDetayBelgeRemove(cand, b.id)} className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 hover:bg-red-100 flex items-center gap-0.5"><X className="w-3 h-3" /></button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SÜREÇ GEÇMİŞİ */}
                    {(cand.history || []).length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-3">
                        <h4 className="text-xs font-black text-neutral-700 mb-2 flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-neutral-500" /> Süreç Geçmişi</h4>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {[...(cand.history || [])].reverse().map((h, i) => (
                            <div key={i} className="text-[10px] text-neutral-500 font-medium flex gap-2">
                              <span className="text-neutral-400 shrink-0">{new Date(h.date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex-1">{h.text}</span>
                              <span className="text-neutral-400 shrink-0">{h.by}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AKSİYONLAR */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* YENİ: Hızlı aşama butonları — Değerlendirmeye Al / Havuza Al / Reddedildi */}
                      {!isFinal && cand.stage !== 'Değerlendirme' && (
                        <button onClick={() => handleStageChange(cand, 'Değerlendirme')} className="px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-100 transition flex items-center gap-1 border border-orange-200"><Star className="w-3.5 h-3.5" /> Değerlendirmeye Al</button>
                      )}
                      {cand.stage !== 'Yedek Havuz' && !isFinal && (
                        <button onClick={() => handleMoveToPool(cand)} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition flex items-center gap-1 border border-indigo-200"><History className="w-3.5 h-3.5" /> Havuza Al</button>
                      )}
                      {cand.stage === 'Yedek Havuz' && (
                        <button onClick={() => handleRecallFromPool(cand)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition flex items-center gap-1 shadow-md shadow-indigo-600/30"><Phone className="w-3.5 h-3.5" /> Tekrar Değerlendir</button>
                      )}
                      {cand.stage !== 'Reddedildi' && cand.stage !== 'Kadroya Alındı' && (
                        <button onClick={() => handleStageChange(cand, 'Reddedildi')} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition flex items-center gap-1 border border-red-200"><X className="w-3.5 h-3.5" /> Reddet</button>
                      )}
                      {/* WhatsApp */}
                      <button onClick={() => {
                        let phone = (cand.phone || '').replace(/\D/g, '');
                        if (phone.startsWith('0')) phone = '90' + phone.substring(1); else if (!phone.startsWith('90')) phone = '90' + phone;
                        window.open(`https://wa.me/${phone}`, '_blank');
                      }} className="px-3 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#128C7E] transition flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</button>
                      {/* Düzenle */}
                      <button onClick={() => { setForm({ fullName: cand.fullName || '', phone: cand.phone || '', collarType: cand.collarType || 'Mavi Yaka', position: cand.position || POSITION_LIST[0], source: cand.source || 'İş İlanı Sitesi', expectedSalary: cand.expectedSalary || '', address: cand.address || '', notes: cand.notes || '', stage: cand.stage || 'Yeni Başvuru', belgeler: cand.belgeler || [] }); setEditingId(cand.id); setShowForm(true); setBelgeLabel(''); }}
                        className="px-3 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold hover:bg-neutral-200 transition flex items-center gap-1 border border-neutral-200"><Edit className="w-3.5 h-3.5" /> Düzenle</button>
                      {/* Sil */}
                      <button onClick={() => setDeleteId(cand.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition flex items-center gap-1 border border-red-200"><X className="w-3.5 h-3.5" /> Sil</button>
                      {/* KADROYA AL — pozisyon otomatik eşleştirilir */}
                      {cand.stage !== 'Kadroya Alındı' && cand.stage !== 'Reddedildi' && (
                        <button onClick={() => setHireCandidate(cand)} className="ml-auto px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl text-xs font-black hover:scale-[1.03] transition flex items-center gap-1.5 shadow-md shadow-green-600/30">
                          <CheckCircle className="w-4 h-4" /> Kadroya Al
                        </button>
                      )}
                      {cand.stage === 'Kadroya Alındı' && (
                        <span className="ml-auto text-xs font-black text-green-700 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Kadroda</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ADAY EKLE / DÜZENLE MODALI */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-black mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-700" /> {editingId ? 'Adayı Düzenle' : 'Yeni Aday Başvurusu'}</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Ad Soyad *</label>
                    <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" placeholder="Örn: Ali Yılmaz" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Telefon *</label>
                    <input value={form.phone} inputMode="numeric" onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 11) })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" placeholder="05xxxxxxxxx" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Yaka Tipi</label>
                    <select value={form.collarType} onChange={e => setForm({ ...form, collarType: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      <option>Mavi Yaka</option><option>Beyaz Yaka</option>
                    </select></div>
                  {/* YENİ: Pozisyon artık sistemdeki pozisyonlardan SEÇİLİR (kadroya alınca bu pozisyona eşleştirilir) */}
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Başvurulan Pozisyon</label>
                    <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      {POSITION_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Başvuru Kaynağı</label>
                    <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                      {SOURCES.map(s => <option key={s}>{s}</option>)}
                    </select></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Maaş Beklentisi (TL)</label>
                    <input type="number" value={form.expectedSalary} onChange={e => setForm({ ...form, expectedSalary: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" /></div>
                </div>
                {/* YENİ: Adres alanı */}
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Adres</label>
                  <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm h-14 resize-none" placeholder="İkametgah / ev adresi" /></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Notlar</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm h-16 resize-none" placeholder="Deneyim, referans, izlenim vb." /></div>

                {/* YENİ: BELGE EKLE — adaya ait belgeler (CV, kimlik, ehliyet vb.) */}
                <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                  <label className="text-xs font-black text-neutral-700 mb-2 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 text-blue-600" /> Belgeler</label>
                  <div className="flex gap-1.5 mb-2">
                    <input value={belgeLabel} onChange={e => setBelgeLabel(e.target.value)} placeholder="Belge adı (opsiyonel, örn: CV)" className="flex-1 min-w-0 p-2 border border-neutral-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-600" />
                    {/* YENİ: Şimdi Çek / Galeriden Yükle / Dosyadan seçenekleri + birden fazla belge/fotoğraf seçimi (multiple) */}
                    <MediaCaptureMenu
                      compact
                      multiple
                      disabled={belgeUploading}
                      buttonLabel={belgeUploading ? 'Yükleniyor...' : 'Yükle'}
                      onChange={handleFormBelgeUpload}
                    />
                  </div>
                  {(form.belgeler || []).length > 0 && (
                    <div className="space-y-1">
                      {(form.belgeler || []).map(b => (
                        <div key={b.id} className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-xs">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-bold text-neutral-700 flex-1 truncate">{b.label}</span>
                          <button onClick={() => setViewingImage?.({ title: b.label, name: b.url })} className="text-neutral-500 hover:text-black"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleFormBelgeRemove(b.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
                <button onClick={handleSaveCandidate} disabled={!form.fullName.trim() || !form.phone.trim()} className="flex-1 py-2.5 bg-emerald-700 text-white font-black rounded-xl hover:bg-emerald-800 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {editingId ? 'Güncelle' : 'Adayı Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SİLME ONAY MODALI */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center animate-in zoom-in-95">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700 mb-4">Bu aday kaydı kalıcı olarak silinecek. Emin misiniz?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', deleteId)); setDeleteId(null); }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* KADROYA ALMA ONAY MODALI */}
        {hireCandidate && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"><CheckCircle className="w-8 h-8 text-green-600" /></div>
              <h3 className="font-black text-black mb-1">Kadroya Alınsın mı?</h3>
              <p className="text-xs text-neutral-500 mb-4"><b>{hireCandidate.fullName}</b> — <b>{hireCandidate.position}</b> ({hireCandidate.collarType}) pozisyonuyla personel listesine eklenecek. Aday durumu "Kadroya Alındı" olacak ve belgeleri özlük dosyasına aktarılacak.</p>
              <div className="flex gap-2">
                <button onClick={() => setHireCandidate(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={async () => {
                  await onHire?.(hireCandidate);
                  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', hireCandidate.id), {
                    stage: 'Kadroya Alındı', hiredAt: new Date().toISOString(),
                    history: [...(hireCandidate.history || []), { date: new Date().toISOString(), text: 'Kadroya alındı 🎉', by: currentUser?.fullName || 'Sistem' }]
                  });
                  setHireCandidate(null);
                }} className="flex-1 py-2.5 bg-green-600 text-white font-black rounded-xl text-sm hover:bg-green-700">Evet, Kadroya Al</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // YENİ: ŞİRKET EVRAKLARI — şirkete ait genel belgelerin yüklendiği/yönetildiği bölüm.
  // (Vergi levhası, imza sirküleri, ruhsatlar, sözleşmeler, sigorta poliçeleri vb.)
  // Belgeler 'sirketEvraklari' Firestore koleksiyonunda tutulur; yükle / görüntüle / düzenle / sil.
  // ============================================================================
  export const SirketEvraklariView = ({ db, appId, addSystemLog, setViewingImage, currentUser }) => {
    const [docs, setDocs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [label, setLabel] = useState('');
    const [category, setCategory] = useState('Genel');
    const [isUploading, setIsUploading] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Hazır kategori önerileri
    const CATEGORIES = ['Genel', 'Vergi & Mali', 'Resmi Belgeler', 'Ruhsat & İzin', 'Sigorta', 'Sözleşmeler', 'Araç Belgeleri', 'Diğer'];
    const CATEGORY_COLORS = {
      'Genel': 'bg-neutral-100 text-neutral-700 border-neutral-200',
      'Vergi & Mali': 'bg-green-50 text-green-700 border-green-200',
      'Resmi Belgeler': 'bg-blue-50 text-blue-700 border-blue-200',
      'Ruhsat & İzin': 'bg-amber-50 text-amber-700 border-amber-200',
      'Sigorta': 'bg-purple-50 text-purple-700 border-purple-200',
      'Sözleşmeler': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Araç Belgeleri': 'bg-teal-50 text-teal-700 border-teal-200',
      'Diğer': 'bg-neutral-100 text-neutral-600 border-neutral-200',
    };

    // Belgeler canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sirketEvraklari'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setDocs(list);
      });
      return () => unsub();
    }, []);

    // Belge yükle
    const handleUpload = async (e) => {
      const file = e.target.files[0];
      if (!file || !label.trim()) return;
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sirketEvraklari'), {
          label: label.trim(), category, url: uploadedUrl,
          uploadedBy: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
        });
        addSystemLog?.('Şirket Evrakı Eklendi', `"${label.trim()}" (${category}) şirket evrakı yüklendi.`);
        setLabel(''); setCategory('Genel'); setShowForm(false);
      } catch (err) {
        console.error('Yükleme hatası:', err);
        alert('Belge yüklenemedi.');
      }
      setIsUploading(false);
    };

    // Belge adını / kategorisini düzenle
    const handleRename = async (d) => {
      const yeni = window.prompt('Belge adını düzenleyin:', d.label || '');
      if (yeni === null || !yeni.trim()) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketEvraklari', d.id), { label: yeni.trim() });
    };

    const filtered = docs.filter(d => {
      const q = searchQuery.toLowerCase();
      return !q || (d.label || '').toLowerCase().includes(q) || (d.category || '').toLowerCase().includes(q);
    });

    return (
      <div className="max-w-5xl mx-auto animate-in fade-in space-y-5">
        {/* BAŞLIK */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-700 to-emerald-900 rounded-2xl p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><FolderOpen className="w-6 h-6" /> Şirket Evrakları</h2>
              <p className="text-green-100 text-xs md:text-sm mt-1">Şirkete ait resmi belgeleri (vergi levhası, imza sirküleri, ruhsatlar, sigorta, sözleşmeler vb.) buradan yükleyin ve yönetin.</p>
            </div>
            <button onClick={() => { setShowForm(v => !v); setLabel(''); setCategory('Genel'); }} className="shrink-0 px-4 py-2.5 bg-white text-emerald-800 font-black rounded-xl shadow hover:scale-[1.03] transition flex items-center gap-2 text-sm">
              <PlusCircle className="w-4 h-4" /> Evrak Yükle
            </button>
          </div>
        </div>

        {/* YÜKLEME FORMU */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 animate-in slide-in-from-top-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Belge Adı *</label>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Örn: 2026 Vergi Levhası" className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-600 block mb-1">Kategori</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-600 text-sm">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <label className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${label.trim() ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-neutral-200 text-neutral-400 pointer-events-none'}`}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isUploading ? 'Yükleniyor...' : (label.trim() ? 'Dosya Seç & Yükle' : 'Önce belge adı girin')}
                <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading || !label.trim()} />
              </label>
              <button onClick={() => { setShowForm(false); setLabel(''); }} className="px-4 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
            </div>
          </div>
        )}

        {/* ARAMA */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Belge adı veya kategoriye göre ara..." className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm" />
          </div>
        </div>

        {/* BELGE LİSTESİ */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-neutral-400 font-bold text-sm">
            {docs.length === 0 ? 'Henüz şirket evrakı yüklenmemiş. "Evrak Yükle" ile ilk belgeyi ekleyin.' : 'Aramanıza uyan belge bulunamadı.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(d => (
              <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 flex flex-col gap-3 hover:shadow-md hover:border-emerald-200 transition">
                <div className="flex items-start gap-2">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><FileText className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-neutral-800 leading-tight truncate" title={d.label}>{d.label}</h3>
                    <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Genel']}`}>{d.category || 'Genel'}</span>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400 font-medium flex items-center justify-between">
                  <span>{d.createdAt ? d.createdAt.split('T')[0].split('-').reverse().join('.') : '-'}</span>
                  <span className="truncate ml-2">{d.uploadedBy || ''}</span>
                </div>
                <div className="flex flex-col gap-1.5 mt-auto">
                  <button onClick={() => setViewingImage({ title: d.label, name: d.url })} className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 border border-neutral-200">
                    <Eye className="w-4 h-4" /> Görüntüle
                  </button>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleRename(d)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 border border-blue-100">
                      <Edit className="w-3.5 h-3.5" /> Düzenle
                    </button>
                    <button onClick={() => setDeleteId(d.id)} className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 border border-red-100">
                      <X className="w-3.5 h-3.5" /> Kaldır
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SİLME ONAY MODALI */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center animate-in zoom-in-95">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700 mb-4">Bu şirket evrakı kalıcı olarak silinecek. Emin misiniz?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketEvraklari', deleteId)); addSystemLog?.('Şirket Evrakı Silindi', 'Bir şirket evrakı silindi.'); setDeleteId(null); }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // ============================================================================
  // YENİ: DAVA DOSYALARI (ŞİRKET DOSYALARI > HUKUK TAKİP MERKEZİ)
  // Şirkete gelen/açılan tüm hukuki süreçlerin tek merkezden yönetildiği bölüm:
  // Davalar, İcra Takipleri, İhtarnameler, İhbarnameler, Arabuluculuk, UETS
  // Tebligatları, Vergi/İdari süreçler vb.
  // Özellikler:
  //  - Dosya bazlı takip: dosya no, mahkeme/kurum, karşı taraf, konum (davacı/davalı...),
  //    dava tutarı, kritik tarihler (duruşma / itiraz-cevap son günü), avukat, notlar.
  //  - Belge yönetimi: fotoğraf + PDF + her tür dosya, ÇOKLU yükleme (Şimdi Çek /
  //    Galeriden / Dosyadan). Her belgede KİMİN ve NE ZAMAN yüklediği görünür.
  //  - Süreç geçmişi: durum değişiklikleri ve önemli olaylar otomatik loglanır.
  //  - Filtreleme: durum, dosya türü ve serbest arama.
  //  - AVUKAT MUHASEBESİ: dosya masrafı, harç, bilirkişi, vekalet ücreti, aylık
  //    sabit ücret vb. giderler ile yapılan ödemeler ayrı ayrı kaydedilir.
  //    Toplam Masraf / Ödenen / Kalan Bakiye anlık hesaplanır. Kaydı kimin
  //    girdiği (ör. şirket avukatı kendi kullanıcısıyla) her satırda görünür.
  // Veriler Firestore'da 'davaDosyalari' ve 'avukatMuhasebe' koleksiyonlarında tutulur.
  // ============================================================================
  export const DavaDosyalariView = ({ currentUser, addSystemLog, setViewingImage }) => {
    // Dosya türleri (hukuki süreç çeşitleri)
    const DOSYA_TURLERI = ['İş Davası', 'Ticari Dava', 'Hukuk Davası', 'Ceza Davası', 'İcra Takibi', 'İhtarname', 'İhbarname', 'Arabuluculuk', 'UETS Tebligatı', 'Vergi / İdari', 'Sigorta / Hasar', 'Diğer'];
    // Dosya durumları ve renk kodları (rozet + kart kenarı için)
    const DURUMLAR = [
      { id: 'Yeni',               color: 'bg-sky-100 text-sky-700 border-sky-200',           dot: 'bg-sky-500' },
      { id: 'İnceleniyor',        color: 'bg-amber-100 text-amber-700 border-amber-200',     dot: 'bg-amber-500' },
      { id: 'Devam Ediyor',       color: 'bg-orange-100 text-orange-700 border-orange-200',  dot: 'bg-orange-500' },
      { id: 'Duruşma Bekleniyor', color: 'bg-purple-100 text-purple-700 border-purple-200',  dot: 'bg-purple-500' },
      { id: 'İtiraz Süreci',      color: 'bg-rose-100 text-rose-700 border-rose-200',        dot: 'bg-rose-500' },
      { id: 'Uzlaşıldı',          color: 'bg-teal-100 text-teal-700 border-teal-200',        dot: 'bg-teal-500' },
      { id: 'Kazanıldı',          color: 'bg-green-100 text-green-700 border-green-200',     dot: 'bg-green-600' },
      { id: 'Kaybedildi',         color: 'bg-red-100 text-red-600 border-red-200',           dot: 'bg-red-500' },
      { id: 'Arşiv',              color: 'bg-neutral-100 text-neutral-500 border-neutral-200', dot: 'bg-neutral-400' },
    ];
    // Şirketin dosyadaki konumu
    const TARAFLAR = ['Davacı', 'Davalı', 'Alacaklı', 'Borçlu', 'Müşteki', 'İhtar Eden', 'İhtar Edilen', 'Tebliğ Alan'];
    // Muhasebe kayıt türleri: 'masraf' = borçlandıran gider, 'odeme' = avukata/kuruma yapılan ödeme
    const MASRAF_TURLERI = ['Dava Masrafı', 'Harç', 'Bilirkişi Ücreti', 'Tebligat / Posta', 'İcra Masrafı', 'Vekalet Ücreti', 'Aylık Sabit Ücret', 'Diğer Masraf'];

    const [dosyalar, setDosyalar] = useState([]);
    const [muhasebe, setMuhasebe] = useState([]);
    const [altSekme, setAltSekme] = useState('dosyalar'); // 'dosyalar' | 'muhasebe'
    const [searchQuery, setSearchQuery] = useState('');
    const [durumFilter, setDurumFilter] = useState('Tümü');
    const [turFilter, setTurFilter] = useState('Tümü');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [belgeUploading, setBelgeUploading] = useState(false);     // form içi belge yükleme durumu
    const [belgeLabel, setBelgeLabel] = useState('');                // form içi yeni belge adı (opsiyonel)
    const [detayBelgeUploading, setDetayBelgeUploading] = useState(null); // detayda yükleme yapılan dosya id

    // Boş dosya formu
    const emptyForm = {
      baslik: '', dosyaTuru: 'İş Davası', durum: 'Yeni', taraf: 'Davalı',
      dosyaNo: '', mahkeme: '', karsiTaraf: '', avukat: '', tutar: '',
      acilisTarihi: new Date().toISOString().split('T')[0], durusmaTarihi: '', sonTarih: '',
      notlar: '', belgeler: []
    };
    const [form, setForm] = useState(emptyForm);

    // Muhasebe kayıt formu (yon: masraf/odeme)
    const emptyMuhForm = { yon: 'masraf', tur: 'Dava Masrafı', tutar: '', tarih: new Date().toISOString().split('T')[0], dosyaId: '', aciklama: '' };
    const [muhForm, setMuhForm] = useState(emptyMuhForm);
    const [muhDosyaFilter, setMuhDosyaFilter] = useState('Tümü');
    const [muhDeleteId, setMuhDeleteId] = useState(null);
    // YENİ: Muhasebe kaydına eklenecek dekont/belge listesi (birden fazla olabilir).
    // Her öğe: { url, name, type } — type 'image' veya 'pdf'/'file'
    const [muhBelgeler, setMuhBelgeler] = useState([]);
    const [muhBelgeYukleniyor, setMuhBelgeYukleniyor] = useState(false);
    // YENİ: "Dekontu Gör" penceresinde gösterilecek kayıt
    const [muhBelgeGoster, setMuhBelgeGoster] = useState(null);

    // Dava dosyaları Firestore'dan canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setDosyalar(list);
      });
      return () => unsub();
    }, []);

    // Avukat muhasebe kayıtları Firestore'dan canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'avukatMuhasebe'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
        setMuhasebe(list);
      });
      return () => unsub();
    }, []);

    // Dosyayı sunucuya yükleyip URL döndürür (mevcut upload altyapısıyla aynı)
    const uploadFile = async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
      const text = await res.text();
      try { const json = JSON.parse(text); return json.url || json.fileName || json.file || text; } catch (err) { return text.trim(); }
    };

    // ÇOKLU belge yükleme (form içinde, dosya kaydından önce). Fotoğraf/PDF/her tür dosya desteklenir.
    // Her belgeye yükleyen kişi ve tarih otomatik işlenir.
    const handleFormBelgeUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setBelgeUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadFile(file);
          const label = belgeLabel.trim()
            ? (files.length > 1 ? `${belgeLabel.trim()} (${i + 1})` : belgeLabel.trim())
            : (file.name || `Belge ${i + 1}`);
          setForm(prev => ({ ...prev, belgeler: [...(prev.belgeler || []), { id: Date.now().toString() + '_' + i, label, url, uploadedBy: currentUser?.fullName || 'Sistem', date: new Date().toISOString() }] }));
        }
        setBelgeLabel('');
      } catch (err) { alert('Belge yüklenemedi.'); }
      setBelgeUploading(false);
    };
    const handleFormBelgeRemove = (id) => setForm(prev => ({ ...prev, belgeler: (prev.belgeler || []).filter(b => b.id !== id) }));

    // Kayıtlı dosyaya detay panelinden ÇOKLU belge ekleme
    const handleDetayBelgeUpload = async (dosya, e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setDetayBelgeUploading(dosya.id);
      try {
        const yeniler = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadFile(file);
          yeniler.push({ id: Date.now().toString() + '_' + i, label: file.name || `Belge ${i + 1}`, url, uploadedBy: currentUser?.fullName || 'Sistem', date: new Date().toISOString() });
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', dosya.id), {
          belgeler: [...(dosya.belgeler || []), ...yeniler],
          history: [...(dosya.history || []), { date: new Date().toISOString(), text: `${yeniler.length} belge eklendi`, by: currentUser?.fullName || 'Sistem' }]
        });
        addSystemLog?.('Dava Dosyası Belge', `${dosya.baslik} dosyasına ${yeniler.length} belge eklendi.`);
      } catch (err) { alert('Belge yüklenemedi.'); }
      setDetayBelgeUploading(null);
    };
    const handleDetayBelgeRemove = async (dosya, id) => {
      const b = (dosya.belgeler || []).find(x => x.id === id);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', dosya.id), {
        belgeler: (dosya.belgeler || []).filter(x => x.id !== id),
        history: [...(dosya.history || []), { date: new Date().toISOString(), text: `Belge silindi: ${b?.label || ''}`, by: currentUser?.fullName || 'Sistem' }]
      });
    };
    const handleDetayBelgeRename = async (dosya, id) => {
      const cur = (dosya.belgeler || []).find(b => b.id === id);
      const yeni = window.prompt('Belge adını düzenleyin:', cur?.label || '');
      if (yeni === null || !yeni.trim()) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', dosya.id), { belgeler: (dosya.belgeler || []).map(b => b.id === id ? { ...b, label: yeni.trim() } : b) });
    };

    // Dosya kaydet (yeni veya düzenleme)
    const handleSaveDosya = async () => {
      if (!form.baslik.trim()) return;
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', editingId), { ...form });
        addSystemLog?.('Dava Dosyası Güncellendi', `${form.baslik} dosyası güncellendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari'), {
          ...form,
          history: [{ date: new Date().toISOString(), text: 'Dosya açıldı', by: currentUser?.fullName || 'Sistem' }],
          createdBy: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
        });
        addSystemLog?.('Yeni Dava Dosyası', `${form.baslik} (${form.dosyaTuru}) dosyası açıldı.`);
      }
      setForm(emptyForm); setEditingId(null); setShowForm(false); setBelgeLabel('');
    };

    // Durum değiştir (süreç geçmişine otomatik işlenir)
    const handleDurumChange = async (dosya, yeniDurum) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', dosya.id), {
        durum: yeniDurum,
        history: [...(dosya.history || []), { date: new Date().toISOString(), text: `Durum: ${yeniDurum}`, by: currentUser?.fullName || 'Sistem' }]
      });
    };

    // ========================================================================
    // YENİ: SÜREÇ İŞLEMLERİ — dosya TÜRÜNE göre mantıklı takip adımları.
    // Her buton tek dokunuşla Süreç Geçmişi'ne tarih + kullanıcı adıyla işlenir;
    // istenirse işleme kısa bir not da eklenebilir. "Özel İşlem" ile listede
    // olmayan herhangi bir adım serbest metin olarak kaydedilebilir.
    // ========================================================================
    const SUREC_ISLEMLERI = {
      'İcra Takibi':    ['Takip Açıldı', 'Ödeme Emri Gönderildi', 'Tebliğ Edildi', 'İtiraz Edildi', 'İtirazın Kaldırılması İstendi', 'Haciz Talep Edildi', 'Haciz Yapıldı', 'Tahsilat Yapıldı', 'Dosya Kapandı'],
      'İş Davası':      ['Dava Açıldı', 'Dilekçe Sunuldu', 'Cevap Dilekçesi Geldi', 'Duruşma Yapıldı', 'Bilirkişi Raporu Geldi', 'Karar Çıktı', 'İstinaf / Temyiz Edildi'],
      'Ticari Dava':    ['Dava Açıldı', 'Dilekçe Sunuldu', 'Cevap Dilekçesi Geldi', 'Duruşma Yapıldı', 'Bilirkişi Raporu Geldi', 'Karar Çıktı', 'İstinaf / Temyiz Edildi'],
      'Hukuk Davası':   ['Dava Açıldı', 'Dilekçe Sunuldu', 'Cevap Dilekçesi Geldi', 'Duruşma Yapıldı', 'Bilirkişi Raporu Geldi', 'Karar Çıktı', 'İstinaf / Temyiz Edildi'],
      'Ceza Davası':    ['Şikayet / İhbar Yapıldı', 'İfade Verildi', 'İddianame Kabul Edildi', 'Duruşma Yapıldı', 'Karar Çıktı', 'İstinaf / Temyiz Edildi'],
      'İhtarname':      ['İhtar Gönderildi', 'Tebliğ Edildi', 'Cevap Geldi', 'Süre Doldu (Cevapsız)'],
      'İhbarname':      ['İhbar Gönderildi', 'Tebliğ Edildi', 'Cevap Geldi', 'Süre Doldu (Cevapsız)'],
      'Arabuluculuk':   ['Başvuru Yapıldı', 'Toplantı Tarihi Belirlendi', 'Toplantı Yapıldı', 'Anlaşma Sağlandı', 'Anlaşma Sağlanamadı (Son Tutanak)'],
      'UETS Tebligatı': ['Tebligat Alındı', 'İncelendi', 'Cevap / İtiraz Verildi', 'Gereği Yapıldı'],
      'Vergi / İdari':  ['Başvuru / Beyan Yapıldı', 'Tebligat Alındı', 'İtiraz / Uzlaşma Talep Edildi', 'Ödeme Yapıldı', 'Sonuçlandı'],
      'Sigorta / Hasar':['Hasar Bildirimi Yapıldı', 'Eksper İncelemesi Yapıldı', 'Teklif Geldi', 'Ödeme Alındı', 'Dosya Kapandı'],
      'Diğer':          ['Başvuru Yapıldı', 'Cevap Geldi', 'İşlem Yapıldı', 'Sonuçlandı'],
    };

    const handleSurecIslem = async (dosya, islemAdi) => {
      // İşleme isteğe bağlı kısa bir açıklama eklenebilir (boş bırakılabilir)
      const not = window.prompt(`"${islemAdi}" işlemi kaydedilecek.\n\nİsterseniz kısa bir not ekleyin (boş bırakılabilir):`, '');
      if (not === null) return; // Vazgeçildi
      const metin = not.trim() ? `${islemAdi} — ${not.trim()}` : islemAdi;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', dosya.id), {
        history: [...(dosya.history || []), { date: new Date().toISOString(), text: metin, by: currentUser?.fullName || 'Sistem' }]
      });
      addSystemLog?.('Dava Dosyası İşlemi', `${dosya.baslik}: ${metin}`);
    };

    const handleOzelIslem = async (dosya) => {
      const metin = window.prompt('Yapılan işlemi yazın (örn: "Karşı tarafla görüşüldü, ek süre istendi"):', '');
      if (metin === null || !metin.trim()) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', dosya.id), {
        history: [...(dosya.history || []), { date: new Date().toISOString(), text: metin.trim(), by: currentUser?.fullName || 'Sistem' }]
      });
      addSystemLog?.('Dava Dosyası İşlemi', `${dosya.baslik}: ${metin.trim()}`);
    };

    // ======================================================================
    // YENİ: DEKONT / BELGE YÜKLEME (çoklu seçim destekli)
    // Şirket Evrakları ekranındaki ile AYNI yükleme altyapısını kullanır
    // (upload.php). Seçilen dosyalar tek tek yüklenir, dönen adresler
    // muhBelgeler listesinde birikir ve "Kaydet"e basıldığında muhasebe
    // kaydının içine 'belgeler' alanı olarak yazılır.
    // PDF ve fotoğraf (jpg/png/heic vb.) birlikte seçilebilir.
    // ======================================================================
    const handleMuhBelgeUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setMuhBelgeYukleniyor(true);
      const yeniler = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
          const text = await res.text();
          let uploadedUrl = file.name;
          try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
          // Dosya tipini uzantıdan belirle (önizlemede resim mi bağlantı mı gösterileceğini seçer)
          const uzanti = (file.name.split('.').pop() || '').toLowerCase();
          const tip = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'].includes(uzanti) ? 'image' : (uzanti === 'pdf' ? 'pdf' : 'file');
          yeniler.push({ url: uploadedUrl, name: file.name, type: tip });
        } catch (err) {
          console.error('Dekont yüklenemedi:', file.name, err);
          alert(`"${file.name}" yüklenemedi.`);
        }
      }
      setMuhBelgeler(prev => [...prev, ...yeniler]);
      setMuhBelgeYukleniyor(false);
      e.target.value = ''; // Aynı dosya tekrar seçilebilsin diye giriş sıfırlanır
    };

    // Muhasebe kaydı ekle (masraf veya ödeme). Kim girdiyse ismi kayda işlenir (avukat dahil).
    const handleSaveMuhasebe = async () => {
      if (!muhForm.tutar || isNaN(parseFloat(muhForm.tutar))) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'avukatMuhasebe'), {
        ...muhForm, tutar: parseFloat(muhForm.tutar),
        belgeler: muhBelgeler, // YENİ: Yüklenen dekont/belge listesi kayda eklenir
        ekleyen: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
      });
      addSystemLog?.('Avukat Muhasebe', `${muhForm.yon === 'masraf' ? 'Masraf' : 'Ödeme'} kaydı eklendi: ${parseFloat(muhForm.tutar).toLocaleString('tr-TR')} TL (${muhForm.tur})${muhBelgeler.length ? ` — ${muhBelgeler.length} belge eklendi` : ''}.`);
      setMuhForm(emptyMuhForm);
      setMuhBelgeler([]); // YENİ: Belge listesi de temizlenir
    };

    // --- HESAPLAMALAR ---
    const paraFormat = (n) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const toplamMasraf = muhasebe.filter(m => m.yon === 'masraf').reduce((s, m) => s + (Number(m.tutar) || 0), 0);
    const toplamOdenen = muhasebe.filter(m => m.yon === 'odeme').reduce((s, m) => s + (Number(m.tutar) || 0), 0);
    const kalanBakiye = toplamMasraf - toplamOdenen; // pozitifse avukata/kurumlara borç var demektir
    const aktifDosyaSayisi = dosyalar.filter(d => !['Arşiv', 'Kazanıldı', 'Kaybedildi', 'Uzlaşıldı'].includes(d.durum)).length;

    // Önümüzdeki 30 gün içinde duruşması / son tarihi olan dosyalar (yaklaşan kritik tarihler)
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const gunFarki = (tarihStr) => tarihStr ? Math.ceil((new Date(tarihStr) - bugun) / (1000 * 60 * 60 * 24)) : null;
    const yaklasanlar = dosyalar
      .map(d => {
        const f1 = gunFarki(d.durusmaTarihi); const f2 = gunFarki(d.sonTarih);
        const enYakin = [f1, f2].filter(x => x !== null && x >= 0).sort((a, b) => a - b)[0];
        return { ...d, kalanGun: enYakin === undefined ? null : enYakin };
      })
      .filter(d => d.kalanGun !== null && d.kalanGun <= 30 && !['Arşiv'].includes(d.durum))
      .sort((a, b) => a.kalanGun - b.kalanGun);

    // Dosya bazlı masraf toplamı (kart üstünde gösterilir)
    const dosyaMasrafi = (dosyaId) => muhasebe.filter(m => m.dosyaId === dosyaId && m.yon === 'masraf').reduce((s, m) => s + (Number(m.tutar) || 0), 0);

    // Filtrelenmiş dosya listesi
    const filtered = dosyalar.filter(d => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q || (d.baslik || '').toLowerCase().includes(q) || (d.dosyaNo || '').toLowerCase().includes(q) || (d.karsiTaraf || '').toLowerCase().includes(q) || (d.mahkeme || '').toLowerCase().includes(q) || (d.avukat || '').toLowerCase().includes(q);
      const matchDurum = durumFilter === 'Tümü' || d.durum === durumFilter;
      const matchTur = turFilter === 'Tümü' || d.dosyaTuru === turFilter;
      return matchQ && matchDurum && matchTur;
    });

    // Muhasebe listesi filtreli
    const muhFiltered = muhasebe.filter(m => muhDosyaFilter === 'Tümü' || (muhDosyaFilter === 'Genel' ? !m.dosyaId : m.dosyaId === muhDosyaFilter));

    const durumOf = (id) => DURUMLAR.find(s => s.id === id) || DURUMLAR[0];
    const dosyaAdi = (id) => dosyalar.find(d => d.id === id)?.baslik || 'Genel (dosyasız)';
    const tarihGoster = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '—';

    return (
      <div className="max-w-6xl mx-auto animate-in fade-in space-y-5">
        {/* BAŞLIK + ÖZET — mor geçişli hukuk paneli */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-800 to-fuchsia-950 rounded-2xl p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><Scale className="w-6 h-6" /> Dava Dosyaları — Hukuk Takip Merkezi</h2>
              <p className="text-purple-200 text-xs md:text-sm mt-1">Dava, icra, ihtar/ihbar, arabuluculuk ve tüm hukuki süreçler ile avukat muhasebesi tek merkezden yönetilir.</p>
            </div>
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); setBelgeLabel(''); }}
              className="shrink-0 px-4 py-2.5 bg-white text-purple-900 font-black rounded-xl shadow hover:scale-[1.03] transition flex items-center gap-2 text-sm">
              <PlusCircle className="w-4 h-4" /> Yeni Dosya Aç
            </button>
          </div>
          {/* Özet kartları: dosya + muhasebe durumu bir arada */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <div className="rounded-xl px-3 py-2.5 bg-white/10 border border-white/20"><div className="text-lg font-black leading-none">{aktifDosyaSayisi}</div><div className="text-[9px] font-bold mt-1 opacity-90">AKTİF DOSYA</div></div>
            <div className={`rounded-xl px-3 py-2.5 border ${yaklasanlar.length > 0 ? 'bg-red-500/30 border-red-300/40' : 'bg-white/10 border-white/20'}`}><div className="text-lg font-black leading-none">{yaklasanlar.length}</div><div className="text-[9px] font-bold mt-1 opacity-90">YAKLAŞAN TARİH (30 GÜN)</div></div>
            <div className="rounded-xl px-3 py-2.5 bg-white/10 border border-white/20"><div className="text-lg font-black leading-none">{paraFormat(toplamMasraf)} ₺</div><div className="text-[9px] font-bold mt-1 opacity-90">TOPLAM MASRAF</div></div>
            <div className="rounded-xl px-3 py-2.5 bg-white/10 border border-white/20"><div className="text-lg font-black leading-none">{paraFormat(toplamOdenen)} ₺</div><div className="text-[9px] font-bold mt-1 opacity-90">ÖDENEN TUTAR</div></div>
            <div className={`rounded-xl px-3 py-2.5 border ${kalanBakiye > 0 ? 'bg-amber-500/30 border-amber-300/40' : 'bg-emerald-500/30 border-emerald-300/40'}`}><div className="text-lg font-black leading-none">{paraFormat(kalanBakiye)} ₺</div><div className="text-[9px] font-bold mt-1 opacity-90">KALAN BAKİYE</div></div>
          </div>
        </div>

        {/* YAKLAŞAN KRİTİK TARİH UYARILARI */}
        {yaklasanlar.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-3">
            <div className="text-[10px] font-black text-red-500 uppercase mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Yaklaşan Duruşma / Son Tarihler</div>
            <div className="flex flex-wrap gap-2">
              {yaklasanlar.map(d => (
                <button key={d.id} onClick={() => { setAltSekme('dosyalar'); setExpandedId(d.id); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${d.kalanGun <= 7 ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
                  {d.baslik} — {d.kalanGun === 0 ? 'BUGÜN' : `${d.kalanGun} gün kaldı`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ALT SEKME GEÇİŞİ: Dosyalar / Avukat Muhasebesi */}
        <div className="flex gap-2">
          <button onClick={() => setAltSekme('dosyalar')} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition border ${altSekme === 'dosyalar' ? 'bg-purple-700 text-white border-purple-700 shadow' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}><span className="flex items-center justify-center gap-2"><FolderOpen className="w-4 h-4" /> Dosyalar ({dosyalar.length})</span></button>
          <button onClick={() => setAltSekme('muhasebe')} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition border ${altSekme === 'muhasebe' ? 'bg-purple-700 text-white border-purple-700 shadow' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}><span className="flex items-center justify-center gap-2"><Wallet className="w-4 h-4" /> Avukat Muhasebesi ({muhasebe.length})</span></button>
        </div>

        {/* ================= DOSYALAR SEKMESİ ================= */}
        {altSekme === 'dosyalar' && (<>
        {/* FİLTRELER */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Dosya adı, dosya no, karşı taraf, mahkeme veya avukat ara..."
              className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-neutral-400 uppercase">Durum:</span>
            {['Tümü', ...DURUMLAR.map(s => s.id)].map(s => (
              <button key={s} onClick={() => setDurumFilter(s)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${durumFilter === s ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-neutral-400 uppercase">Tür:</span>
            {['Tümü', ...DOSYA_TURLERI].map(t => (
              <button key={t} onClick={() => setTurFilter(t)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${turFilter === t ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* DOSYA KARTLARI */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm font-bold text-neutral-400">Kayıtlı dosya bulunamadı. "Yeni Dosya Aç" ile ilk hukuki süreci ekleyin.</div>
          )}
          {filtered.map(d => {
            const st = durumOf(d.durum);
            const masraf = dosyaMasrafi(d.id);
            const kalanG = [gunFarki(d.durusmaTarihi), gunFarki(d.sonTarih)].filter(x => x !== null && x >= 0).sort((a, b) => a - b)[0];
            return (
              <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                {/* KART BAŞLIĞI */}
                <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="w-full text-left p-4 hover:bg-neutral-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0"><Scale className="w-5 h-5 text-purple-700" /></div>
                      <div className="min-w-0">
                        <div className="font-black text-black text-sm truncate">{d.baslik}</div>
                        <div className="text-[11px] text-neutral-500 font-bold mt-0.5 flex flex-wrap gap-x-2">
                          <span>{d.dosyaTuru}</span>
                          {d.dosyaNo && <span>• No: {d.dosyaNo}</span>}
                          {d.karsiTaraf && <span>• Karşı Taraf: {d.karsiTaraf}</span>}
                          {d.taraf && <span>• Konum: {d.taraf}</span>}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-bold mt-0.5 flex flex-wrap gap-x-2">
                          {d.mahkeme && <span>{d.mahkeme}</span>}
                          {d.avukat && <span>• Av. {d.avukat}</span>}
                          {masraf > 0 && <span className="text-amber-600">• Masraf: {paraFormat(masraf)} ₺</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${st.color}`}>{d.durum}</span>
                      {kalanG !== undefined && kalanG !== null && <span className={`text-[10px] font-black ${kalanG <= 7 ? 'text-red-600' : 'text-amber-600'}`}>⏳ {kalanG === 0 ? 'BUGÜN' : `${kalanG} gün`}</span>}
                      {(d.belgeler || []).length > 0 && <span className="text-[10px] font-bold text-neutral-400">{(d.belgeler || []).length} belge</span>}
                    </div>
                  </div>
                </button>

                {/* DETAY PANELİ */}
                {expandedId === d.id && (
                  <div className="border-t border-neutral-100 p-4 space-y-4 animate-in slide-in-from-top-2 bg-neutral-50/50">
                    {/* Bilgi ızgarası */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Açılış Tarihi</div><div className="font-black text-black">{tarihGoster(d.acilisTarihi)}</div></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Duruşma / Kritik Tarih</div><div className="font-black text-black">{tarihGoster(d.durusmaTarihi)}</div></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">İtiraz / Cevap Son Günü</div><div className="font-black text-black">{tarihGoster(d.sonTarih)}</div></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Dava / Takip Tutarı</div><div className="font-black text-black">{d.tutar ? `${paraFormat(d.tutar)} ₺` : '—'}</div></div>
                    </div>
                    {d.notlar && <div className="bg-white rounded-xl border border-neutral-200 p-3 text-xs text-neutral-600"><span className="font-black text-neutral-400 text-[10px] uppercase block mb-1">Notlar</span>{d.notlar}</div>}

                    {/* Durum değiştir + işlem butonları */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={d.durum} onChange={e => handleDurumChange(d, e.target.value)} className="p-2 border border-neutral-300 rounded-lg bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600">
                        {DURUMLAR.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                      </select>
                      <button onClick={() => { setForm({ ...emptyForm, ...d }); setEditingId(d.id); setShowForm(true); }} className="px-3 py-2 bg-neutral-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-black transition"><Edit className="w-3.5 h-3.5" /> Düzenle</button>
                      <button onClick={() => { setAltSekme('muhasebe'); setMuhDosyaFilter(d.id); setMuhForm({ ...emptyMuhForm, dosyaId: d.id }); }} className="px-3 py-2 bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-purple-800 transition"><Wallet className="w-3.5 h-3.5" /> Dosya Muhasebesi</button>
                      <button onClick={() => setDeleteId(d.id)} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-100 transition"><X className="w-3.5 h-3.5" /> Sil</button>
                    </div>

                    {/* YENİ: SÜREÇ İŞLEMLERİ — dosyanın türüne göre takip adımları.
                        Tek dokunuşla Süreç Geçmişi'ne işlenir; her işleme not eklenebilir. */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3">
                      <span className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5 mb-2"><CheckSquare className="w-3.5 h-3.5 text-purple-600" /> Süreç İşlemleri <span className="normal-case font-bold text-neutral-400">({d.dosyaTuru})</span></span>
                      <div className="flex flex-wrap gap-1.5">
                        {(SUREC_ISLEMLERI[d.dosyaTuru] || SUREC_ISLEMLERI['Diğer']).map(islem => (
                          <button key={islem} onClick={() => handleSurecIslem(d, islem)}
                            className="px-2.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold hover:bg-purple-100 hover:border-purple-300 transition">
                            {islem}
                          </button>
                        ))}
                        <button onClick={() => handleOzelIslem(d)}
                          className="px-2.5 py-1.5 bg-neutral-800 text-white rounded-lg text-[11px] font-bold hover:bg-black transition flex items-center gap-1">
                          <PlusCircle className="w-3 h-3" /> Özel İşlem
                        </button>
                      </div>
                    </div>

                    {/* BELGELER — çoklu yükleme (fotoğraf/PDF/dosya), yükleyen kişi + tarih görünür */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 text-purple-600" /> Dosya Belgeleri</span>
                        <MediaCaptureMenu compact multiple disabled={detayBelgeUploading === d.id}
                          buttonLabel={detayBelgeUploading === d.id ? 'Yükleniyor...' : 'Belge Ekle'}
                          onChange={(e) => handleDetayBelgeUpload(d, e)} />
                      </div>
                      {(d.belgeler || []).length === 0 && <div className="text-[11px] text-neutral-400 font-bold py-2">Henüz belge yüklenmemiş.</div>}
                      <div className="space-y-1">
                        {(d.belgeler || []).map(b => (
                          <div key={b.id} className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs">
                            <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-neutral-700 truncate">{b.label}</div>
                              <div className="text-[10px] text-neutral-400 font-bold">{b.uploadedBy || '—'} • {b.date ? new Date(b.date).toLocaleString('tr-TR') : ''}</div>
                            </div>
                            <button onClick={() => setViewingImage?.({ title: b.label, name: b.url })} className="text-neutral-500 hover:text-black" title="Görüntüle"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDetayBelgeRename(d, b.id)} className="text-neutral-500 hover:text-black" title="Adını değiştir"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDetayBelgeRemove(d, b.id)} className="text-red-400 hover:text-red-600" title="Sil"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SÜREÇ GEÇMİŞİ */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3">
                      <span className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5 mb-2"><History className="w-3.5 h-3.5 text-purple-600" /> Süreç Geçmişi</span>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {[...(d.history || [])].reverse().map((h, i) => (
                          <div key={i} className="text-[11px] text-neutral-500 font-bold flex gap-2">
                            <span className="text-neutral-400 shrink-0">{new Date(h.date).toLocaleString('tr-TR')}</span>
                            <span className="text-neutral-700">{h.text}</span>
                            <span className="text-purple-600 ml-auto shrink-0">{h.by}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>)}

        {/* ================= AVUKAT MUHASEBESİ SEKMESİ ================= */}
        {altSekme === 'muhasebe' && (<>
        {/* Muhasebe özet şeridi */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center"><div className="text-lg font-black text-amber-600">{paraFormat(toplamMasraf)} ₺</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-1">Toplam Masraf / Ücret</div></div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center"><div className="text-lg font-black text-emerald-600">{paraFormat(toplamOdenen)} ₺</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-1">Toplam Ödenen</div></div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center"><div className={`text-lg font-black ${kalanBakiye > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{paraFormat(kalanBakiye)} ₺</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-1">Kalan Bakiye</div></div>
        </div>

        {/* YENİ KAYIT FORMU — masraf (avukat da girebilir) veya ödeme */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 space-y-3">
          <div className="text-xs font-black text-neutral-700 flex items-center gap-1.5"><PlusCircle className="w-4 h-4 text-purple-600" /> Yeni Muhasebe Kaydı</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {/* Kayıt yönü: masraf mı ödeme mi */}
            <select value={muhForm.yon} onChange={e => setMuhForm({ ...muhForm, yon: e.target.value })} className="p-2.5 border border-neutral-300 rounded-xl bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600">
              <option value="masraf">Masraf / Ücret (Gider)</option>
              <option value="odeme">Ödeme (Ödenen Tutar)</option>
            </select>
            <select value={muhForm.tur} onChange={e => setMuhForm({ ...muhForm, tur: e.target.value })} className="p-2.5 border border-neutral-300 rounded-xl bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600">
              {(muhForm.yon === 'masraf' ? MASRAF_TURLERI : ['Avukata Ödeme', 'Harç Ödemesi', 'Kurum Ödemesi', 'Diğer Ödeme']).map(t => <option key={t}>{t}</option>)}
            </select>
            <input type="number" value={muhForm.tutar} onChange={e => setMuhForm({ ...muhForm, tutar: e.target.value })} placeholder="Tutar (TL)" className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600" />
            <input type="date" value={muhForm.tarih} onChange={e => setMuhForm({ ...muhForm, tarih: e.target.value })} className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600" />
            {/* Kayıt bir dosyaya bağlanabilir ya da genel (ör. aylık sabit ücret) olabilir */}
            <select value={muhForm.dosyaId} onChange={e => setMuhForm({ ...muhForm, dosyaId: e.target.value })} className="p-2.5 border border-neutral-300 rounded-xl bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600">
              <option value="">Genel (dosyasız)</option>
              {dosyalar.map(d => <option key={d.id} value={d.id}>{d.baslik}</option>)}
            </select>
            <button onClick={handleSaveMuhasebe} disabled={!muhForm.tutar} className="p-2.5 bg-purple-700 text-white rounded-xl text-xs font-black hover:bg-purple-800 transition disabled:opacity-40">Kaydet</button>
          </div>
          <input value={muhForm.aciklama} onChange={e => setMuhForm({ ...muhForm, aciklama: e.target.value })} placeholder="Açıklama (opsiyonel — örn: Nisan ayı sabit ücret, X dosyası bilirkişi ücreti)" className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-600" />

          {/* YENİ: DEKONT / BELGE YÜKLEME — birden fazla PDF ve fotoğraf seçilebilir */}
          <div className="border-2 border-dashed border-purple-200 rounded-xl p-3 bg-purple-50/40 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${muhBelgeYukleniyor ? 'bg-neutral-200 text-neutral-400 pointer-events-none' : 'bg-purple-700 text-white hover:bg-purple-800'}`}>
                {muhBelgeYukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {muhBelgeYukleniyor ? 'Yükleniyor...' : 'Dekont / Belge Yükle'}
                {/* multiple: birden fazla dosya birlikte seçilebilir. accept: fotoğraf + PDF */}
                <input type="file" multiple accept="image/*,application/pdf,.pdf" className="hidden" onChange={handleMuhBelgeUpload} disabled={muhBelgeYukleniyor} />
              </label>
              <span className="text-[10px] font-bold text-neutral-500">
                {muhBelgeler.length > 0 ? `${muhBelgeler.length} belge eklendi — kaydettiğinizde kayda bağlanacak` : 'PDF ve fotoğraf seçebilirsiniz (birden fazla)'}
              </span>
            </div>
            {/* Yüklenen belgelerin küçük önizlemeleri — kaydetmeden önce çıkarılabilir */}
            {muhBelgeler.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {muhBelgeler.map((b, i) => (
                  <div key={i} className="relative group flex items-center gap-1.5 bg-white border border-purple-200 rounded-lg pl-1.5 pr-6 py-1.5 shadow-sm">
                    {b.type === 'image'
                      ? <img src={b.url} alt={b.name} className="w-8 h-8 object-cover rounded" />
                      : <span className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center"><FileText className="w-4 h-4" /></span>}
                    <span className="text-[10px] font-bold text-neutral-700 max-w-[110px] truncate">{b.name}</span>
                    {/* Yanlış yüklenen belgeyi listeden çıkar */}
                    <button type="button" onClick={() => setMuhBelgeler(prev => prev.filter((_, x) => x !== i))}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-red-600 transition" title="Bu belgeyi çıkar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DOSYAYA GÖRE FİLTRE */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-neutral-400 uppercase">Dosya:</span>
          <button onClick={() => setMuhDosyaFilter('Tümü')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${muhDosyaFilter === 'Tümü' ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200'}`}>Tümü</button>
          <button onClick={() => setMuhDosyaFilter('Genel')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${muhDosyaFilter === 'Genel' ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200'}`}>Genel</button>
          {dosyalar.map(d => (
            <button key={d.id} onClick={() => setMuhDosyaFilter(d.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${muhDosyaFilter === d.id ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200'}`}>{d.baslik}</button>
          ))}
        </div>

        {/* MUHASEBE TABLOSU — kaydı kimin girdiği (avukat dahil) her satırda görünür */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900 text-white">
              <tr>
                <th className="p-3 font-bold rounded-tl-2xl">Tarih</th>
                <th className="p-3 font-bold">Yön</th>
                <th className="p-3 font-bold">Tür</th>
                <th className="p-3 font-bold">Dosya</th>
                <th className="p-3 font-bold">Açıklama</th>
                <th className="p-3 font-bold">Ekleyen</th>
                {/* YENİ: Kayda bağlı dekont/belge varsa buradan görüntülenir */}
                <th className="p-3 font-bold text-center">Dekont</th>
                <th className="p-3 font-bold text-right">Tutar</th>
                <th className="p-3 font-bold rounded-tr-2xl"></th>
              </tr>
            </thead>
            <tbody>
              {muhFiltered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-neutral-400 font-bold">Kayıt bulunamadı.</td></tr>}
              {muhFiltered.map(m => (
                <tr key={m.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3 font-bold text-neutral-600">{tarihGoster(m.tarih)}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${m.yon === 'masraf' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{m.yon === 'masraf' ? 'MASRAF' : 'ÖDEME'}</span></td>
                  <td className="p-3 font-bold text-neutral-700">{m.tur}</td>
                  <td className="p-3 text-neutral-500 font-bold">{dosyaAdi(m.dosyaId)}</td>
                  <td className="p-3 text-neutral-500 max-w-[200px] truncate">{m.aciklama || '—'}</td>
                  <td className="p-3 font-bold text-purple-700">{m.ekleyen || '—'}</td>
                  {/* YENİ: DEKONTU GÖR — kayda belge eklenmişse buton, yoksa tire görünür */}
                  <td className="p-3 text-center">
                    {m.belgeler?.length > 0 ? (
                      <button onClick={() => setMuhBelgeGoster(m)}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-black inline-flex items-center gap-1 transition"
                        title="Bu kayda ait dekont/belgeleri görüntüle">
                        <Eye className="w-3 h-3" /> Dekontu Gör ({m.belgeler.length})
                      </button>
                    ) : <span className="text-neutral-300 font-bold">—</span>}
                  </td>
                  <td className={`p-3 text-right font-black ${m.yon === 'masraf' ? 'text-amber-600' : 'text-emerald-600'}`}>{m.yon === 'masraf' ? '+' : '−'}{paraFormat(m.tutar)} ₺</td>
                  <td className="p-3 text-right"><button onClick={() => setMuhDeleteId(m.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>)}

        {/* YENİ: DEKONT GÖRÜNTÜLEME PENCERESİ
            Kayda bağlı tüm belgeleri listeler. Fotoğraflar doğrudan gösterilir
            (tıklayınca yeni sekmede tam boyut açılır), PDF'ler görüntüleme
            bağlantısı olarak sunulur. */}
        {muhBelgeGoster && (
          <div className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setMuhBelgeGoster(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h3 className="font-black text-black flex items-center gap-2 text-sm"><Wallet className="w-5 h-5 text-purple-700" /> Ödeme Dekontu / Belgeler</h3>
                  <p className="text-[11px] font-bold text-neutral-500 mt-1 truncate">
                    {tarihGoster(muhBelgeGoster.tarih)} • {muhBelgeGoster.tur} • {muhBelgeGoster.yon === 'masraf' ? '+' : '−'}{paraFormat(muhBelgeGoster.tutar)} ₺
                  </p>
                </div>
                <button onClick={() => setMuhBelgeGoster(null)} className="text-neutral-400 hover:text-black shrink-0"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(muhBelgeGoster.belgeler || []).map((b, i) => (
                  <a key={i} href={b.url} target="_blank" rel="noopener noreferrer"
                    className="border border-neutral-200 rounded-xl overflow-hidden hover:border-purple-400 hover:shadow-md transition group">
                    {b.type === 'image' ? (
                      <img src={b.url} alt={b.name} className="w-full h-40 object-cover bg-neutral-100" />
                    ) : (
                      <div className="w-full h-40 bg-red-50 flex flex-col items-center justify-center gap-2 text-red-600">
                        <FileText className="w-10 h-10" />
                        <span className="text-[10px] font-black uppercase">{b.type === 'pdf' ? 'PDF Belge' : 'Dosya'}</span>
                      </div>
                    )}
                    <div className="p-2 flex items-center gap-1.5 bg-white">
                      <Eye className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="text-[11px] font-bold text-neutral-700 truncate group-hover:text-purple-700">{b.name || 'Belge'}</span>
                    </div>
                  </a>
                ))}
              </div>
              <div className="p-3 border-t border-neutral-200 shrink-0">
                <button onClick={() => setMuhBelgeGoster(null)} className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl text-sm transition">Kapat</button>
              </div>
            </div>
          </div>
        )}

        {/* YENİ / DÜZENLE DOSYA MODALI */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><Scale className="w-5 h-5 text-purple-700" /> {editingId ? 'Dosyayı Düzenle' : 'Yeni Dava Dosyası'}</h3>
                <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Dosya Başlığı *</label>
                  <input value={form.baslik} onChange={e => setForm({ ...form, baslik: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" placeholder="Örn: X Ltd. Şti. alacak davası" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Dosya Türü</label>
                    <select value={form.dosyaTuru} onChange={e => setForm({ ...form, dosyaTuru: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-purple-600 text-sm">
                      {DOSYA_TURLERI.map(t => <option key={t}>{t}</option>)}
                    </select></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Şirketin Konumu</label>
                    <select value={form.taraf} onChange={e => setForm({ ...form, taraf: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-purple-600 text-sm">
                      {TARAFLAR.map(t => <option key={t}>{t}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Dosya / Esas No</label>
                    <input value={form.dosyaNo} onChange={e => setForm({ ...form, dosyaNo: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" placeholder="2026/1234 E." /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Mahkeme / İcra Dairesi / Kurum</label>
                    <input value={form.mahkeme} onChange={e => setForm({ ...form, mahkeme: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" placeholder="İst. 5. İş Mahkemesi" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Karşı Taraf</label>
                    <input value={form.karsiTaraf} onChange={e => setForm({ ...form, karsiTaraf: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">İlgili Avukat</label>
                    <input value={form.avukat} onChange={e => setForm({ ...form, avukat: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" placeholder="Şirket avukatı adı" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Dava / Takip Tutarı (TL)</label>
                    <input type="number" value={form.tutar} onChange={e => setForm({ ...form, tutar: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Açılış Tarihi</label>
                    <input type="date" value={form.acilisTarihi} onChange={e => setForm({ ...form, acilisTarihi: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Duruşma / Kritik Tarih</label>
                    <input type="date" value={form.durusmaTarihi} onChange={e => setForm({ ...form, durusmaTarihi: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" /></div>
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">İtiraz / Cevap Son Günü</label>
                    <input type="date" value={form.sonTarih} onChange={e => setForm({ ...form, sonTarih: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" /></div>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Notlar</label>
                  <textarea value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm h-16 resize-none" placeholder="Sürece dair önemli notlar..." /></div>

                {/* BELGELER — form aşamasında da çoklu yükleme yapılabilir */}
                <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                  <label className="text-xs font-black text-neutral-700 mb-2 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 text-purple-600" /> Belgeler</label>
                  <div className="flex gap-1.5 mb-2">
                    <input value={belgeLabel} onChange={e => setBelgeLabel(e.target.value)} placeholder="Belge adı (opsiyonel, örn: Tebligat)" className="flex-1 min-w-0 p-2 border border-neutral-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-600" />
                    <MediaCaptureMenu compact multiple disabled={belgeUploading}
                      buttonLabel={belgeUploading ? 'Yükleniyor...' : 'Yükle'}
                      onChange={handleFormBelgeUpload} />
                  </div>
                  {(form.belgeler || []).length > 0 && (
                    <div className="space-y-1">
                      {(form.belgeler || []).map(b => (
                        <div key={b.id} className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-xs">
                          <FileText className="w-3.5 h-3.5 text-purple-500" />
                          <span className="font-bold text-neutral-700 flex-1 truncate">{b.label} <span className="text-neutral-400 font-normal">({b.uploadedBy})</span></span>
                          <button onClick={() => setViewingImage?.({ title: b.label, name: b.url })} className="text-neutral-500 hover:text-black"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleFormBelgeRemove(b.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
                <button onClick={handleSaveDosya} disabled={!form.baslik.trim()} className="flex-1 py-2.5 bg-purple-700 text-white font-black rounded-xl hover:bg-purple-800 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {editingId ? 'Güncelle' : 'Dosyayı Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DOSYA SİLME ONAYI */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center animate-in zoom-in-95">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700 mb-4">Bu dava dosyası kalıcı olarak silinecek. Emin misiniz?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari', deleteId)); addSystemLog?.('Dava Dosyası Silindi', 'Bir dava dosyası silindi.'); setDeleteId(null); }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* MUHASEBE KAYDI SİLME ONAYI */}
        {muhDeleteId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center animate-in zoom-in-95">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700 mb-4">Bu muhasebe kaydı silinecek. Emin misiniz?</p>
              <div className="flex gap-2">
                <button onClick={() => setMuhDeleteId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'avukatMuhasebe', muhDeleteId)); addSystemLog?.('Avukat Muhasebe', 'Bir muhasebe kaydı silindi.'); setMuhDeleteId(null); }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // YENİ: ŞİRKET BELGELERİ (ŞİRKET DOSYALARI > BELGE ARŞİV MERKEZİ)
  // Şirkete ait TÜM resmi evrakların kategorili arşiv mantığıyla saklandığı,
  // arandığı ve yönetildiği bölüm: İmza Sirküleri, Kira Kontratı, Vergi Levhası,
  // Ticaret Sicil, Faaliyet Belgesi, Sigorta Poliçeleri, Ruhsat/İzinler vb.
  // Özellikler:
  //  - KATEGORİ (BÖLÜM) MANTIĞI: Her belge bir bölüme eklenir; bölümlere göre
  //    tek tıkla filtrelenir, her bölümün belge sayısı görünür.
  //  - ARŞİV ARAMA: Belge adı, açıklama, etiket ve ekli dosya adlarında arama.
  //  - GEÇERLİLİK TAKİBİ: Son geçerlilik tarihi olan belgelerde (kontrat,
  //    poliçe, ruhsat vb.) süresi geçen KIRMIZI, 30 gün içinde dolacak olan
  //    SARI uyarıyla üstte listelenir.
  //  - ÇOKLU DOSYA: Her belge kaydına birden fazla fotoğraf/PDF/dosya eklenir
  //    (Şimdi Çek / Galeriden / Dosyadan). Kimin ne zaman yüklediği görünür.
  //  - Tam yönetim: ekle / görüntüle / düzenle / dosya ekle-çıkar / sil,
  //    tüm hareketler kayıt geçmişine (kim, ne zaman) işlenir.
  // Veriler Firestore'da 'sirketBelgeleri' koleksiyonunda tutulur.
  // ============================================================================
  export const SirketBelgeleriView = ({ currentUser, addSystemLog, setViewingImage }) => {
    // Arşiv bölümleri (kategoriler): ikon + renk ile birlikte tanımlanır
    const KATEGORILER = [
      { id: 'Resmi Evraklar',        icon: Landmark,   color: 'text-indigo-600',  bg: 'bg-indigo-100',  desc: 'İmza sirküleri, ticaret sicil, faaliyet belgesi...' },
      { id: 'Sözleşme & Kontratlar', icon: FileText,   color: 'text-purple-600',  bg: 'bg-purple-100',  desc: 'Kira kontratı, tedarikçi ve iş sözleşmeleri...' },
      { id: 'Vergi & Mali Evraklar', icon: Wallet,     color: 'text-emerald-600', bg: 'bg-emerald-100', desc: 'Vergi levhası, beyannameler, mali tablolar...' },
      { id: 'Sigorta Poliçeleri',    icon: CheckSquare,color: 'text-sky-600',     bg: 'bg-sky-100',     desc: 'İşyeri, nakliyat, araç ve sorumluluk poliçeleri...' },
      { id: 'Ruhsat & İzinler',      icon: Key,        color: 'text-amber-600',   bg: 'bg-amber-100',   desc: 'İşyeri ruhsatı, taşıma yetki belgeleri (K1 vb.)...' },
      { id: 'Araç Belgeleri',        icon: Car,        color: 'text-red-600',     bg: 'bg-red-100',     desc: 'Şirket araçlarına ait genel evraklar...' },
      { id: 'Banka & Finans',        icon: CreditCard, color: 'text-teal-600',    bg: 'bg-teal-100',    desc: 'Banka sözleşmeleri, kredi ve teminat evrakları...' },
      { id: 'Diğer',                 icon: Package,    color: 'text-neutral-600', bg: 'bg-neutral-100', desc: 'Diğer tüm şirket belgeleri...' },
    ];

    const [belgeler, setBelgeler] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [kategoriFilter, setKategoriFilter] = useState('Tümü');
    const [siralama, setSiralama] = useState('yeni'); // 'yeni' | 'gecerlilik' | 'az'
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [dosyaUploading, setDosyaUploading] = useState(false);      // form içi yükleme
    const [detayUploading, setDetayUploading] = useState(null);       // detayda yükleme yapılan belge id
    const [dosyaLabel, setDosyaLabel] = useState('');                 // form içi dosya adı (opsiyonel)
    // YENİ: Kritik evrak uyarı şeridinde varsayılan olarak yalnızca ilk 5 kayıt
    // gösterilir; "Tümünü Göster" ile tamamı açılır. Uzun listenin ekranı
    // kaplamasını ve asıl arşiv bölümünü aşağı itmesini önler.
    const [tumKritikleriGoster, setTumKritikleriGoster] = useState(false);

    // Boş belge kayıt formu
    const emptyForm = {
      baslik: '', kategori: 'Resmi Evraklar', aciklama: '', etiketler: '',
      gecerlilikTarihi: '', dosyalar: []
    };
    const [form, setForm] = useState(emptyForm);

    // Şirket belgeleri Firestore'dan canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBelgeler(list);
      });
      return () => unsub();
    }, []);

    // Dosyayı sunucuya yükleyip URL döndürür (mevcut upload altyapısıyla aynı)
    const uploadFile = async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
      const text = await res.text();
      try { const json = JSON.parse(text); return json.url || json.fileName || json.file || text; } catch (err) { return text.trim(); }
    };

    // ÇOKLU dosya yükleme (form içinde, kayıttan önce). Yükleyen + tarih otomatik işlenir.
    const handleFormDosyaUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setDosyaUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadFile(file);
          const label = dosyaLabel.trim()
            ? (files.length > 1 ? `${dosyaLabel.trim()} (${i + 1})` : dosyaLabel.trim())
            : (file.name || `Dosya ${i + 1}`);
          setForm(prev => ({ ...prev, dosyalar: [...(prev.dosyalar || []), { id: Date.now().toString() + '_' + i, label, url, uploadedBy: currentUser?.fullName || 'Sistem', date: new Date().toISOString() }] }));
        }
        setDosyaLabel('');
      } catch (err) { alert('Dosya yüklenemedi.'); }
      setDosyaUploading(false);
    };
    const handleFormDosyaRemove = (id) => setForm(prev => ({ ...prev, dosyalar: (prev.dosyalar || []).filter(d => d.id !== id) }));

    // Kayıtlı belgeye detay panelinden ÇOKLU dosya ekleme
    const handleDetayDosyaUpload = async (belge, e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setDetayUploading(belge.id);
      try {
        const yeniler = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await uploadFile(file);
          yeniler.push({ id: Date.now().toString() + '_' + i, label: file.name || `Dosya ${i + 1}`, url, uploadedBy: currentUser?.fullName || 'Sistem', date: new Date().toISOString() });
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri', belge.id), {
          dosyalar: [...(belge.dosyalar || []), ...yeniler],
          history: [...(belge.history || []), { date: new Date().toISOString(), text: `${yeniler.length} dosya eklendi`, by: currentUser?.fullName || 'Sistem' }]
        });
        addSystemLog?.('Şirket Evrakı', `${belge.baslik} kaydına ${yeniler.length} dosya eklendi.`);
      } catch (err) { alert('Dosya yüklenemedi.'); }
      setDetayUploading(null);
    };
    const handleDetayDosyaRemove = async (belge, id) => {
      const d = (belge.dosyalar || []).find(x => x.id === id);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri', belge.id), {
        dosyalar: (belge.dosyalar || []).filter(x => x.id !== id),
        history: [...(belge.history || []), { date: new Date().toISOString(), text: `Dosya silindi: ${d?.label || ''}`, by: currentUser?.fullName || 'Sistem' }]
      });
    };
    const handleDetayDosyaRename = async (belge, id) => {
      const cur = (belge.dosyalar || []).find(d => d.id === id);
      const yeni = window.prompt('Dosya adını düzenleyin:', cur?.label || '');
      if (yeni === null || !yeni.trim()) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri', belge.id), { dosyalar: (belge.dosyalar || []).map(d => d.id === id ? { ...d, label: yeni.trim() } : d) });
    };

    // Belge kaydet (yeni veya düzenleme)
    const handleSaveBelge = async () => {
      if (!form.baslik.trim()) return;
      if (editingId) {
        const eski = belgeler.find(b => b.id === editingId);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri', editingId), {
          ...form,
          history: [...(eski?.history || []), { date: new Date().toISOString(), text: 'Belge bilgileri güncellendi', by: currentUser?.fullName || 'Sistem' }]
        });
        addSystemLog?.('Şirket Evrakı Güncellendi', `${form.baslik} evrakı güncellendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri'), {
          ...form,
          history: [{ date: new Date().toISOString(), text: 'Belge arşive eklendi', by: currentUser?.fullName || 'Sistem' }],
          createdBy: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
        });
        addSystemLog?.('Yeni Şirket Evrakı', `${form.baslik} (${form.kategori}) arşive eklendi.`);
      }
      setForm(emptyForm); setEditingId(null); setShowForm(false); setDosyaLabel('');
    };

    // --- GEÇERLİLİK (SÜRE) HESAPLARI ---
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    // YENİ: "SÜRESİZ" işaretli (tarihi olmayan) evraklar süre hesabına hiç girmez —
    // ne süresi geçti uyarısı ne de "kritik evraklar" şeridinde görünür.
    const kalanGun = (t) => (t && t !== 'SÜRESİZ') ? Math.ceil((new Date(t) - bugun) / (1000 * 60 * 60 * 24)) : null;
    // Süresi geçmiş veya 30 gün içinde dolacak belgeler (uyarı şeridi için)
    const suresiKritikler = belgeler
      .map(b => ({ ...b, kalan: kalanGun(b.gecerlilikTarihi) }))
      .filter(b => b.kalan !== null && b.kalan <= 30)
      .sort((a, b) => a.kalan - b.kalan);

    // Kategori bazlı belge sayıları
    const kategoriSayisi = (kat) => belgeler.filter(b => b.kategori === kat).length;

    // Filtrelenmiş + sıralanmış arşiv listesi
    const filtered = belgeler.filter(b => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q
        || (b.baslik || '').toLowerCase().includes(q)
        || (b.aciklama || '').toLowerCase().includes(q)
        || (b.etiketler || '').toLowerCase().includes(q)
        || (b.dosyalar || []).some(d => (d.label || '').toLowerCase().includes(q));
      const matchKat = kategoriFilter === 'Tümü' || b.kategori === kategoriFilter;
      return matchQ && matchKat;
    }).sort((a, b) => {
      if (siralama === 'az') return (a.baslik || '').localeCompare(b.baslik || '', 'tr');
      if (siralama === 'gecerlilik') {
        // Geçerlilik tarihi olanlar en yakından uzağa; olmayanlar sona
        const ka = kalanGun(a.gecerlilikTarihi), kb = kalanGun(b.gecerlilikTarihi);
        if (ka === null && kb === null) return 0;
        if (ka === null) return 1; if (kb === null) return -1;
        return ka - kb;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || ''); // 'yeni'
    });

    const katOf = (id) => KATEGORILER.find(k => k.id === id) || KATEGORILER[KATEGORILER.length - 1];
    const tarihGoster = (t) => t === 'SÜRESİZ' ? 'Süresiz' : (t ? new Date(t).toLocaleDateString('tr-TR') : '—');
    // Geçerlilik rozeti: süresi geçmiş / yaklaşan / normal
    const gecerlilikRozet = (t) => {
      const k = kalanGun(t);
      if (k === null) return null;
      if (k < 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-600 border border-red-200">SÜRESİ GEÇTİ ({Math.abs(k)} gün)</span>;
      if (k <= 30) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">{k === 0 ? 'BUGÜN DOLUYOR' : `${k} GÜN KALDI`}</span>;
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">GEÇERLİ</span>;
    };

    return (
      <div className="max-w-6xl mx-auto animate-in fade-in space-y-5">
        {/* BAŞLIK — mor/indigo geçişli arşiv paneli */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-700 to-fuchsia-950 rounded-2xl p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><FolderOpen className="w-6 h-6" /> Şirket Evrakları — Arşiv Merkezi</h2>
              <p className="text-purple-200 text-xs md:text-sm mt-1">İmza sirküleri, kira kontratı, vergi levhası ve tüm şirket evrakları bölüm bölüm arşivlenir; anında aranır ve bulunur.</p>
            </div>
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); setDosyaLabel(''); }}
              className="shrink-0 px-4 py-2.5 bg-white text-purple-900 font-black rounded-xl shadow hover:scale-[1.03] transition flex items-center gap-2 text-sm">
              <PlusCircle className="w-4 h-4" /> Yeni Evrak Ekle
            </button>
          </div>
          {/* Genel sayaçlar */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl px-3 py-2.5 bg-white/10 border border-white/20"><div className="text-lg font-black leading-none">{belgeler.length}</div><div className="text-[9px] font-bold mt-1 opacity-90">TOPLAM EVRAK</div></div>
            <div className="rounded-xl px-3 py-2.5 bg-white/10 border border-white/20"><div className="text-lg font-black leading-none">{belgeler.reduce((s, b) => s + (b.dosyalar || []).length, 0)}</div><div className="text-[9px] font-bold mt-1 opacity-90">TOPLAM DOSYA</div></div>
            <div className={`rounded-xl px-3 py-2.5 border ${suresiKritikler.length > 0 ? 'bg-red-500/30 border-red-300/40' : 'bg-white/10 border-white/20'}`}><div className="text-lg font-black leading-none">{suresiKritikler.length}</div><div className="text-[9px] font-bold mt-1 opacity-90">SÜRESİ KRİTİK EVRAK</div></div>
          </div>
        </div>

        {/* SÜRESİ KRİTİK BELGE UYARILARI (geçmiş veya 30 gün içinde dolacak) */}
        {suresiKritikler.length > 0 && (() => {
          // YENİ: Varsayılan olarak yalnızca EN ÖNEMLİ 5 kayıt gösterilir.
          // "Önem" sıralaması mevcut mantıkla aynıdır (suresiKritikler zaten
          // kalan güne göre artan sıralı; yani süresi en çok geçmiş olan en başta).
          const GOSTERILECEK = 5;
          const gizliSayisi = suresiKritikler.length - GOSTERILECEK;
          const listelenenler = tumKritikleriGoster ? suresiKritikler : suresiKritikler.slice(0, GOSTERILECEK);
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Geçerlilik Süresi Kritik Evraklar
                  {/* Toplam sayı rozeti — kaç kayıt olduğu daraltılmış haldeyken de görünür */}
                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200">{suresiKritikler.length}</span>
                </div>
                {/* YENİ: Tümünü Göster / Daralt butonu (yalnızca 5'ten fazla kayıt varsa) */}
                {gizliSayisi > 0 && (
                  <button type="button" onClick={() => setTumKritikleriGoster(v => !v)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black border transition bg-red-50 text-red-600 border-red-200 hover:bg-red-100 flex items-center gap-1">
                    {tumKritikleriGoster
                      ? <><ChevronUp className="w-3 h-3" /> Daralt</>
                      : <><ChevronDown className="w-3 h-3" /> Tümünü Göster (+{gizliSayisi})</>}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {listelenenler.map(b => (
                  <button key={b.id} onClick={() => { setKategoriFilter('Tümü'); setExpandedId(b.id); }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${b.kalan < 0 ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
                    {b.baslik} — {b.kalan < 0 ? `${Math.abs(b.kalan)} gün geçti` : b.kalan === 0 ? 'BUGÜN doluyor' : `${b.kalan} gün kaldı`}
                  </button>
                ))}
              </div>
              {/* Daraltılmış haldeyken kaç kaydın gizli olduğunu belirt */}
              {!tumKritikleriGoster && gizliSayisi > 0 && (
                <p className="text-[10px] font-bold text-neutral-400 mt-2">
                  {gizliSayisi} evrak daha var — tamamını görmek için yukarıdaki butona basın.
                </p>
              )}
            </div>
          );
        })()}

        {/* KATEGORİ (BÖLÜM) KARTLARI — arşiv bölümleri, tıklayınca filtreler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {KATEGORILER.map(k => {
            const Icon = k.icon;
            const aktif = kategoriFilter === k.id;
            return (
              <button key={k.id} onClick={() => setKategoriFilter(aktif ? 'Tümü' : k.id)}
                className={`text-left rounded-2xl border p-3 transition hover:scale-[1.02] ${aktif ? 'bg-purple-700 border-purple-700 text-white shadow-lg' : 'bg-white border-neutral-200 hover:border-purple-300'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${aktif ? 'bg-white/20' : k.bg}`}>
                  <Icon className={`w-4.5 h-4.5 w-5 h-5 ${aktif ? 'text-white' : k.color}`} />
                </div>
                <div className={`text-xs font-black ${aktif ? 'text-white' : 'text-black'}`}>{k.id}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${aktif ? 'text-purple-100' : 'text-neutral-400'}`}>{kategoriSayisi(k.id)} evrak</div>
              </button>
            );
          })}
        </div>

        {/* ARAMA + SIRALAMA */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Arşivde ara: evrak adı, açıklama, etiket veya dosya adı..."
              className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-sm" />
          </div>
          <div className="flex gap-1.5">
            {[{ id: 'yeni', l: 'Yeni Eklenen' }, { id: 'gecerlilik', l: 'Geçerlilik Tarihi' }, { id: 'az', l: 'A → Z' }].map(s => (
              <button key={s.id} onClick={() => setSiralama(s.id)} className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition whitespace-nowrap ${siralama === s.id ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}>{s.l}</button>
            ))}
            {kategoriFilter !== 'Tümü' && (
              <button onClick={() => setKategoriFilter('Tümü')} className="px-3 py-2 rounded-xl text-[11px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 flex items-center gap-1"><X className="w-3 h-3" /> {kategoriFilter}</button>
            )}
          </div>
        </div>

        {/* BELGE KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.length === 0 && (
            <div className="md:col-span-2 bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm font-bold text-neutral-400">Arşivde evrak bulunamadı. "Yeni Evrak Ekle" ile ilk evrakı arşive ekleyin.</div>
          )}
          {filtered.map(b => {
            const kat = katOf(b.kategori);
            const Icon = kat.icon;
            const acik = expandedId === b.id;
            return (
              <div key={b.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${acik ? 'border-purple-300 md:col-span-2' : 'border-neutral-200'}`}>
                {/* KART BAŞLIĞI */}
                <button onClick={() => setExpandedId(acik ? null : b.id)} className="w-full text-left p-4 hover:bg-neutral-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kat.bg}`}><Icon className={`w-5 h-5 ${kat.color}`} /></div>
                      <div className="min-w-0">
                        <div className="font-black text-black text-sm truncate">{b.baslik}</div>
                        <div className="text-[11px] text-neutral-500 font-bold mt-0.5">{b.kategori} • {(b.dosyalar || []).length} dosya</div>
                        {b.etiketler && <div className="text-[10px] text-purple-600 font-bold mt-0.5 truncate">🏷 {b.etiketler}</div>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {gecerlilikRozet(b.gecerlilikTarihi)}
                      <span className="text-[10px] font-bold text-neutral-400">{tarihGoster(b.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {/* DETAY PANELİ */}
                {acik && (
                  <div className="border-t border-neutral-100 p-4 space-y-4 animate-in slide-in-from-top-2 bg-neutral-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Bölüm</div><div className="font-black text-black">{b.kategori}</div></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Geçerlilik Tarihi</div><div className="font-black text-black">{tarihGoster(b.gecerlilikTarihi)}</div></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Ekleyen</div><div className="font-black text-black">{b.createdBy || '—'}</div></div>
                      <div className="bg-white rounded-xl border border-neutral-200 p-2.5"><div className="text-neutral-400 font-bold">Eklenme Tarihi</div><div className="font-black text-black">{tarihGoster(b.createdAt)}</div></div>
                    </div>
                    {b.aciklama && <div className="bg-white rounded-xl border border-neutral-200 p-3 text-xs text-neutral-600"><span className="font-black text-neutral-400 text-[10px] uppercase block mb-1">Açıklama</span>{b.aciklama}</div>}

                    {/* İşlem butonları */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => { setForm({ ...emptyForm, ...b }); setEditingId(b.id); setShowForm(true); }} className="px-3 py-2 bg-neutral-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-black transition"><Edit className="w-3.5 h-3.5" /> Düzenle</button>
                      <button onClick={() => setDeleteId(b.id)} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-100 transition"><X className="w-3.5 h-3.5" /> Sil</button>
                    </div>

                    {/* EKLİ DOSYALAR — çoklu yükleme; yükleyen kişi + tarih görünür */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 text-purple-600" /> Ekli Dosyalar</span>
                        <MediaCaptureMenu compact multiple disabled={detayUploading === b.id}
                          buttonLabel={detayUploading === b.id ? 'Yükleniyor...' : 'Dosya Ekle'}
                          onChange={(e) => handleDetayDosyaUpload(b, e)} />
                      </div>
                      {(b.dosyalar || []).length === 0 && <div className="text-[11px] text-neutral-400 font-bold py-2">Henüz dosya yüklenmemiş.</div>}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {(b.dosyalar || []).map(d => (
                          <div key={d.id} className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs">
                            <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-neutral-700 truncate">{d.label}</div>
                              <div className="text-[10px] text-neutral-400 font-bold">{d.uploadedBy || '—'} • {d.date ? new Date(d.date).toLocaleString('tr-TR') : ''}</div>
                            </div>
                            <button onClick={() => setViewingImage?.({ title: d.label, name: d.url })} className="text-neutral-500 hover:text-black" title="Görüntüle"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDetayDosyaRename(b, d.id)} className="text-neutral-500 hover:text-black" title="Adını değiştir"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDetayDosyaRemove(b, d.id)} className="text-red-400 hover:text-red-600" title="Sil"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KAYIT GEÇMİŞİ */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3">
                      <span className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5 mb-2"><History className="w-3.5 h-3.5 text-purple-600" /> Kayıt Geçmişi</span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {[...(b.history || [])].reverse().map((h, i) => (
                          <div key={i} className="text-[11px] text-neutral-500 font-bold flex gap-2">
                            <span className="text-neutral-400 shrink-0">{new Date(h.date).toLocaleString('tr-TR')}</span>
                            <span className="text-neutral-700">{h.text}</span>
                            <span className="text-purple-600 ml-auto shrink-0">{h.by}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* YENİ / DÜZENLE BELGE MODALI */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-black flex items-center gap-2"><FolderOpen className="w-5 h-5 text-purple-700" /> {editingId ? 'Evrakı Düzenle' : 'Yeni Şirket Evrakı'}</h3>
                <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Evrak Adı *</label>
                  <input value={form.baslik} onChange={e => setForm({ ...form, baslik: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" placeholder="Örn: İmza Sirküleri 2026, Merkez Ofis Kira Kontratı" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Bölüm (Kategori)</label>
                    <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-purple-600 text-sm">
                      {KATEGORILER.map(k => <option key={k.id} value={k.id}>{k.id}</option>)}
                    </select></div>
                  {/* Süreli belgelerde (kontrat, poliçe, ruhsat vb.) doldurulur; sistem otomatik uyarır.
                      YENİ: Tarihi olmayan (süresiz) evraklar için tek dokunuşla tarih alanını
                      pasifleştiren buton — bu evraklarda tarih girmek ZORUNLU DEĞİLDİR. */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-neutral-600">Geçerlilik / Bitiş Tarihi</label>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, gecerlilikTarihi: f.gecerlilikTarihi === 'SÜRESİZ' ? '' : 'SÜRESİZ' }))}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition ${form.gecerlilikTarihi === 'SÜRESİZ' ? 'bg-purple-600 text-white border-purple-600' : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'}`}
                      >
                        {form.gecerlilikTarihi === 'SÜRESİZ' ? '✓ Süresiz' : 'Tarihi Yok'}
                      </button>
                    </div>
                    {form.gecerlilikTarihi === 'SÜRESİZ' ? (
                      <div className="w-full p-2.5 border border-dashed border-neutral-300 rounded-xl text-sm text-neutral-400 font-bold bg-neutral-50">Bu evrakın son kullanma tarihi yok</div>
                    ) : (
                      <input type="date" value={form.gecerlilikTarihi} onChange={e => setForm({ ...form, gecerlilikTarihi: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" />
                    )}
                  </div>
                </div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Etiketler <span className="text-neutral-400 font-normal">(virgülle ayırın — aramada kullanılır)</span></label>
                  <input value={form.etiketler} onChange={e => setForm({ ...form, etiketler: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm" placeholder="örn: noter, 2026, merkez ofis" /></div>
                <div><label className="text-xs font-bold text-neutral-600 block mb-1">Açıklama</label>
                  <textarea value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600 text-sm h-16 resize-none" placeholder="Evraka dair notlar..." /></div>

                {/* DOSYALAR — çoklu yükleme (fotoğraf/PDF/dosya) */}
                <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                  <label className="text-xs font-black text-neutral-700 mb-2 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 text-purple-600" /> Dosyalar</label>
                  <div className="flex gap-1.5 mb-2">
                    <input value={dosyaLabel} onChange={e => setDosyaLabel(e.target.value)} placeholder="Dosya adı (opsiyonel)" className="flex-1 min-w-0 p-2 border border-neutral-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-600" />
                    <MediaCaptureMenu compact multiple disabled={dosyaUploading}
                      buttonLabel={dosyaUploading ? 'Yükleniyor...' : 'Yükle'}
                      onChange={handleFormDosyaUpload} />
                  </div>
                  {(form.dosyalar || []).length > 0 && (
                    <div className="space-y-1">
                      {(form.dosyalar || []).map(d => (
                        <div key={d.id} className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-xs">
                          <FileText className="w-3.5 h-3.5 text-purple-500" />
                          <span className="font-bold text-neutral-700 flex-1 truncate">{d.label} <span className="text-neutral-400 font-normal">({d.uploadedBy})</span></span>
                          <button onClick={() => setViewingImage?.({ title: d.label, name: d.url })} className="text-neutral-500 hover:text-black"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleFormDosyaRemove(d.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
                <button onClick={handleSaveBelge} disabled={!form.baslik.trim()} className="flex-1 py-2.5 bg-purple-700 text-white font-black rounded-xl hover:bg-purple-800 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {editingId ? 'Güncelle' : 'Arşive Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SİLME ONAYI */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center animate-in zoom-in-95">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700 mb-4">Bu evrak ve tüm ekli dosya kayıtları arşivden kalıcı olarak silinecek. Emin misiniz?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sirketBelgeleri', deleteId)); addSystemLog?.('Şirket Evrakı Silindi', 'Bir şirket evrakı arşivden silindi.'); setDeleteId(null); }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm">Evet, Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // YENİ: AVUKAT ANASAYFASI (SADECE "AVUKAT" POZİSYONUNDAKİ KULLANICIYA ÖZEL)
  // Avukat pozisyonundaki kullanıcı sisteme girdiğinde standart operasyon
  // anasayfası yerine BU sayfa açılır. İçerikte maaş, mesai, puantaj, personel
  // değerlendirme gibi HİÇBİR personel-muhasebe unsuru YOKTUR; tamamen hukuk
  // süreçlerine odaklıdır:
  //  - Kişiye özel karşılama + günün hukuk odaklı özeti
  //  - Dosya istatistikleri (aktif, duruşma bekleyen, kritik tarih, belge sayısı)
  //  - Duruma göre FİLTRELİ dosya raporu (tek tıkla durum bazlı liste)
  //  - Yaklaşan duruşma / son tarih ajandası
  //  - SON EKLENEN BELGELER akışı (kim, hangi dosyaya, ne zaman yükledi)
  //  - SON HAREKETLER bildirim akışı (tüm dosyalardaki süreç geçmişinden)
  //  - Avukat muhasebesi özeti (toplam masraf / ödenen / kalan bakiye)
  // Veriler 'davaDosyalari' ve 'avukatMuhasebe' koleksiyonlarından canlı okunur.
  // ============================================================================
  export const AvukatDashboardView = ({ currentUser, setActiveTab, setViewingImage }) => {
    // DavaDosyalariView ile aynı durum tanımları (renk uyumu için)
    const DURUMLAR = [
      { id: 'Yeni',               color: 'bg-sky-100 text-sky-700 border-sky-200' },
      { id: 'İnceleniyor',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
      { id: 'Devam Ediyor',       color: 'bg-orange-100 text-orange-700 border-orange-200' },
      { id: 'Duruşma Bekleniyor', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      { id: 'İtiraz Süreci',      color: 'bg-rose-100 text-rose-700 border-rose-200' },
      { id: 'Uzlaşıldı',          color: 'bg-teal-100 text-teal-700 border-teal-200' },
      { id: 'Kazanıldı',          color: 'bg-green-100 text-green-700 border-green-200' },
      { id: 'Kaybedildi',         color: 'bg-red-100 text-red-600 border-red-200' },
      { id: 'Arşiv',              color: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
    ];

    const [dosyalar, setDosyalar] = useState([]);
    const [muhasebe, setMuhasebe] = useState([]);
    const [durumFilter, setDurumFilter] = useState('Tümü'); // duruma göre hızlı rapor filtresi

    // Dava dosyaları canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'davaDosyalari'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setDosyalar(list);
      });
      return () => unsub();
    }, []);

    // Avukat muhasebe kayıtları canlı dinlenir
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'avukatMuhasebe'), snap => {
        setMuhasebe(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }, []);

    // --- HESAPLAMALAR ---
    const paraFormat = (n) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const kalanGun = (t) => t ? Math.ceil((new Date(t) - bugun) / (1000 * 60 * 60 * 24)) : null;

    const aktifDosyalar = dosyalar.filter(d => !['Arşiv', 'Kazanıldı', 'Kaybedildi', 'Uzlaşıldı'].includes(d.durum));
    const durusmaBekleyen = dosyalar.filter(d => d.durum === 'Duruşma Bekleniyor');
    const toplamBelge = dosyalar.reduce((s, d) => s + (d.belgeler || []).length, 0);

    // Yaklaşan 30 gün ajandası (duruşma veya itiraz/cevap son günü)
    const yaklasanlar = dosyalar
      .map(d => {
        const f1 = kalanGun(d.durusmaTarihi); const f2 = kalanGun(d.sonTarih);
        const enYakin = [f1, f2].filter(x => x !== null && x >= 0).sort((a, b) => a - b)[0];
        return { ...d, kalan: enYakin === undefined ? null : enYakin };
      })
      .filter(d => d.kalan !== null && d.kalan <= 30 && d.durum !== 'Arşiv')
      .sort((a, b) => a.kalan - b.kalan);

    // Muhasebe özeti
    const toplamMasraf = muhasebe.filter(m => m.yon === 'masraf').reduce((s, m) => s + (Number(m.tutar) || 0), 0);
    const toplamOdenen = muhasebe.filter(m => m.yon === 'odeme').reduce((s, m) => s + (Number(m.tutar) || 0), 0);
    const kalanBakiye = toplamMasraf - toplamOdenen;

    // SON EKLENEN BELGELER: tüm dosyaların belgeleri tek akışta, en yeniden eskiye
    const sonBelgeler = dosyalar
      .flatMap(d => (d.belgeler || []).map(b => ({ ...b, dosyaBaslik: d.baslik, dosyaId: d.id })))
      .filter(b => b.date)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);

    // SON HAREKETLER (bildirim akışı): tüm dosyaların süreç geçmişi birleşik
    const sonHareketler = dosyalar
      .flatMap(d => (d.history || []).map(h => ({ ...h, dosyaBaslik: d.baslik })))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 12);

    // Duruma göre filtreli rapor listesi
    const filtreliDosyalar = (durumFilter === 'Tümü' ? dosyalar : dosyalar.filter(d => d.durum === durumFilter));
    const durumOf = (id) => DURUMLAR.find(s => s.id === id) || DURUMLAR[0];
    const tarihGoster = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '—';

    return (
      <div className="max-w-6xl mx-auto animate-in fade-in space-y-5">
        {/* KİŞİYE ÖZEL KARŞILAMA — hukuk odaklı anasayfa başlığı */}
        <div className="bg-gradient-to-r from-purple-700 via-purple-900 to-fuchsia-950 rounded-2xl p-5 md:p-7 text-white shadow-lg">
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <Scale className="w-7 h-7" /> Hoş Geldiniz, Av. {currentUser?.fullName}
          </h2>
          <p className="text-purple-200 text-xs md:text-sm mt-1.5">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — Şirketin tüm hukuki süreçlerinin güncel özeti aşağıdadır.
          </p>
          {/* Hızlı istatistikler */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <button onClick={() => setActiveTab?.('davaDosyalari')} className="rounded-xl px-3 py-3 bg-white/10 border border-white/20 text-left hover:bg-white/20 transition">
              <div className="text-2xl font-black leading-none">{aktifDosyalar.length}</div>
              <div className="text-[10px] font-bold mt-1.5 opacity-90">AKTİF DOSYA</div>
            </button>
            <button onClick={() => { setDurumFilter('Duruşma Bekleniyor'); }} className="rounded-xl px-3 py-3 bg-white/10 border border-white/20 text-left hover:bg-white/20 transition">
              <div className="text-2xl font-black leading-none">{durusmaBekleyen.length}</div>
              <div className="text-[10px] font-bold mt-1.5 opacity-90">DURUŞMA BEKLEYEN</div>
            </button>
            <div className={`rounded-xl px-3 py-3 border ${yaklasanlar.length > 0 ? 'bg-red-500/30 border-red-300/40' : 'bg-white/10 border-white/20'}`}>
              <div className="text-2xl font-black leading-none">{yaklasanlar.length}</div>
              <div className="text-[10px] font-bold mt-1.5 opacity-90">KRİTİK TARİH (30 GÜN)</div>
            </div>
            <div className="rounded-xl px-3 py-3 bg-white/10 border border-white/20">
              <div className="text-2xl font-black leading-none">{toplamBelge}</div>
              <div className="text-[10px] font-bold mt-1.5 opacity-90">TOPLAM BELGE</div>
            </div>
          </div>
        </div>

        {/* YAKLAŞAN DURUŞMA / SON TARİH AJANDASI */}
        {yaklasanlar.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-4">
            <div className="text-xs font-black text-red-500 uppercase mb-3 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Yaklaşan Duruşma & Son Tarihler</div>
            <div className="space-y-2">
              {yaklasanlar.map(d => (
                <button key={d.id} onClick={() => setActiveTab?.('davaDosyalari')}
                  className={`w-full text-left flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition ${d.kalan <= 7 ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-black truncate">{d.baslik}</div>
                    <div className="text-[10px] font-bold text-neutral-500">{d.dosyaTuru} {d.mahkeme ? `• ${d.mahkeme}` : ''} {d.durusmaTarihi ? `• Duruşma: ${tarihGoster(d.durusmaTarihi)}` : ''} {d.sonTarih ? `• Son gün: ${tarihGoster(d.sonTarih)}` : ''}</div>
                  </div>
                  <span className={`shrink-0 text-xs font-black ${d.kalan <= 7 ? 'text-red-600' : 'text-amber-600'}`}>{d.kalan === 0 ? 'BUGÜN' : `${d.kalan} gün`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DURUMA GÖRE FİLTRELİ DOSYA RAPORU */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black text-neutral-700 uppercase flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-purple-600" /> Duruma Göre Dosya Raporu</div>
            <button onClick={() => setActiveTab?.('davaDosyalari')} className="text-[11px] font-black text-purple-700 hover:underline flex items-center gap-1">Tüm Dosyalara Git <ArrowUpRight className="w-3.5 h-3.5" /></button>
          </div>
          {/* Durum filtresi: sayaçlı çipler */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <button onClick={() => setDurumFilter('Tümü')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${durumFilter === 'Tümü' ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}>Tümü ({dosyalar.length})</button>
            {DURUMLAR.map(s => {
              const cnt = dosyalar.filter(d => d.durum === s.id).length;
              if (cnt === 0) return null; // boş durumları gizle, rapor sade kalsın
              return (
                <button key={s.id} onClick={() => setDurumFilter(durumFilter === s.id ? 'Tümü' : s.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${durumFilter === s.id ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-400'}`}>
                  {s.id} ({cnt})
                </button>
              );
            })}
          </div>
          {/* Filtreli mini dosya listesi */}
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {filtreliDosyalar.length === 0 && <div className="text-[11px] text-neutral-400 font-bold py-3 text-center">Bu durumda dosya bulunmuyor.</div>}
            {filtreliDosyalar.map(d => {
              const st = durumOf(d.durum);
              return (
                <button key={d.id} onClick={() => setActiveTab?.('davaDosyalari')} className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 hover:bg-neutral-50 transition">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0"><Scale className="w-4 h-4 text-purple-700" /></div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-black truncate">{d.baslik}</div>
                      <div className="text-[10px] font-bold text-neutral-500 truncate">{d.dosyaTuru}{d.dosyaNo ? ` • ${d.dosyaNo}` : ''}{d.karsiTaraf ? ` • ${d.karsiTaraf}` : ''}</div>
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${st.color}`}>{d.durum}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* SON EKLENEN BELGELER AKIŞI */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
            <div className="text-xs font-black text-neutral-700 uppercase mb-3 flex items-center gap-1.5"><FolderOpen className="w-4 h-4 text-purple-600" /> Son Eklenen Belgeler</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {sonBelgeler.length === 0 && <div className="text-[11px] text-neutral-400 font-bold py-3 text-center">Henüz belge yüklenmemiş.</div>}
              {sonBelgeler.map(b => (
                <div key={b.dosyaId + '_' + b.id} className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-xs">
                  <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-neutral-700 truncate">{b.label}</div>
                    <div className="text-[10px] text-neutral-400 font-bold truncate">{b.dosyaBaslik} • {b.uploadedBy || '—'} • {b.date ? new Date(b.date).toLocaleString('tr-TR') : ''}</div>
                  </div>
                  <button onClick={() => setViewingImage?.({ title: b.label, name: b.url })} className="text-neutral-500 hover:text-black shrink-0" title="Görüntüle"><Eye className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* SON HAREKETLER — bildirim akışı */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
            <div className="text-xs font-black text-neutral-700 uppercase mb-3 flex items-center gap-1.5"><Bell className="w-4 h-4 text-purple-600" /> Son Hareketler & Bildirimler</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {sonHareketler.length === 0 && <div className="text-[11px] text-neutral-400 font-bold py-3 text-center">Henüz hareket kaydı yok.</div>}
              {sonHareketler.map((h, i) => (
                <div key={i} className="flex items-start gap-2 border-b border-neutral-100 pb-1.5 text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0"></div>
                  <div className="min-w-0">
                    <span className="font-black text-black">{h.dosyaBaslik}:</span>{' '}
                    <span className="text-neutral-600 font-bold">{h.text}</span>
                    <div className="text-[10px] text-neutral-400 font-bold">{new Date(h.date).toLocaleString('tr-TR')} • {h.by}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AVUKAT MUHASEBESİ ÖZETİ — sadece dava/hukuk muhasebesi (maaş/mesai YOK) */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black text-neutral-700 uppercase flex items-center gap-1.5"><Wallet className="w-4 h-4 text-purple-600" /> Hukuk Muhasebesi Özeti</div>
            <button onClick={() => setActiveTab?.('davaDosyalari')} className="text-[11px] font-black text-purple-700 hover:underline flex items-center gap-1">Detaylı Muhasebe <ArrowUpRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-base md:text-lg font-black text-amber-600">{paraFormat(toplamMasraf)} ₺</div><div className="text-[9px] md:text-[10px] font-black text-neutral-400 uppercase mt-1">Toplam Masraf / Ücret</div></div>
            <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-base md:text-lg font-black text-emerald-600">{paraFormat(toplamOdenen)} ₺</div><div className="text-[9px] md:text-[10px] font-black text-neutral-400 uppercase mt-1">Ödenen Tutar</div></div>
            <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className={`text-base md:text-lg font-black ${kalanBakiye > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{paraFormat(kalanBakiye)} ₺</div><div className="text-[9px] md:text-[10px] font-black text-neutral-400 uppercase mt-1">Kalan Bakiye</div></div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // YENİ: SAHA RAPORLAMASI — Şeflerin sahada yaptığı denetimlerin yönetim ekranı.
  // En son rapordan eskiye doğru listelenir; ay bazlı özet (kaç denetim, kaç iş,
  // ortalama puan, kayıt doğruluğu dağılımı), şef bazlı performans ve puanlanan
  // personel dökümü bir arada sunulur.
  // ==========================================================================
  export const SahaRaporlamasiView = ({ personnelList = [], db, appId, setViewingImage, jobs = [], onViewCari }) => {
    const aylarTR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const buAy = new Date().toISOString().substring(0, 7); // YYYY-MM

    const bugunStr = new Date().toISOString().split('T')[0];
    const [denetimler, setDenetimler] = useState([]);
    // DEĞİŞİKLİK: Ay filtresi yerine GÜNLÜK takip. Sayfa her zaman BUGÜN ile açılır,
    // sağ/sol oklarla gün değiştirilir.
    const [tarih, setTarih] = useState(bugunStr);
    const [sefFiltre, setSefFiltre] = useState('Tümü');
    // YENİ: Denetim notları açık olan personel kartının anahtarı (akordiyon)
    const [acikPuanKarti, setAcikPuanKarti] = useState(null);
    const [arama, setArama] = useState('');
    // NOT: acikId state'i, alttaki "Denetim Yapılan İşler" açılır listesi kaldırıldığı için silindi.
    const [yukleniyor, setYukleniyor] = useState(true);

    useEffect(() => {
      if (!db) return;
      // NOT: Bu sayfa "Tüm Zamanlar" raporlama seçeneği sunduğu için (ay filtresi
      // 'tum' olabilir) buraya limit KONULMADI — limit koymak eski dönemlerin
      // raporunu sessizce eksik gösterebilirdi. Sayfa yalnızca ziyaret edildiğinde
      // açık olduğu için (arka planda sürekli çalışan bir maliyet değil) bu risk
      // kabul edilebilir düzeyde.
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri'), snap => {
        setDenetimler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setYukleniyor(false);
      }, e => { console.error(e); setYukleniyor(false); });
      return () => unsub();
    }, [db, appId]);

    // Ay listesi: kayıtlardan otomatik üretilir (en yeni en üstte)
    const mevcutAylar = [...new Set(denetimler.map(d => (d.jobDate || '').substring(0, 7)).filter(Boolean))].sort().reverse();
    const sefler = [...new Set(denetimler.map(d => d.sefAdi).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr-TR'));

    // Filtrelenmiş + EN YENİDEN ESKİYE sıralı liste
    // Denetim GÜNÜ: kaydın oluşturulma tarihi (şefin sahaya gittiği gün) esas alınır;
    // yoksa işin tarihine düşülür.
    const denetimGunu = (d) => (d.denetimTarihi || '').substring(0, 10) || (d.jobDate || '');
    const filtreli = denetimler
      .filter(d => denetimGunu(d) === tarih)
      .filter(d => sefFiltre === 'Tümü' || d.sefAdi === sefFiltre)
      .filter(d => {
        const q = arama.trim().toLocaleLowerCase('tr-TR');
        if (!q) return true;
        const havuz = [d.jobCustomerName, d.genelRapor, d.kayitAcan, d.sefAdi, d.jobRoute,
          ...(d.personelPuanlari || []).map(p => `${p.personelAdi} ${p.ozelNot}`)].join(' ').toLocaleLowerCase('tr-TR');
        return havuz.includes(q);
      })
      .sort((a, b) => new Date(b.denetimTarihi || b.jobDate || 0) - new Date(a.denetimTarihi || a.jobDate || 0));

    // ---- ÖZET İSTATİSTİKLER (filtrelenmiş küme üzerinden) ----
    const toplamDenetim = filtreli.length;
    const denetlenenIsler = new Set(filtreli.map(d => String(d.jobId))).size;
    const tumPuanlar = filtreli.flatMap(d => (d.personelPuanlari || []).map(p => parseInt(p.puan) || 0)).filter(n => n > 0);
    const genelOrtalama = tumPuanlar.length > 0 ? Math.round((tumPuanlar.reduce((t, n) => t + n, 0) / tumPuanlar.length) * 10) / 10 : 0;
    const notluDenetim = filtreli.filter(d => (d.personelPuanlari || []).some(p => (p.ozelNot || '').trim())).length;

    // Kayıt doğruluğu dağılımı — satış/kayıt kalitesini gösterir
    const DOGRULUK_STIL = {
      'Hepsi doğru':             { bar: 'bg-green-500',  yazi: 'text-green-700',  kutu: 'bg-green-50 border-green-200' },
      'Hemen hemen doğru':       { bar: 'bg-lime-500',   yazi: 'text-lime-700',   kutu: 'bg-lime-50 border-lime-200' },
      'Çok yanlış bilgiler var': { bar: 'bg-orange-500', yazi: 'text-orange-700', kutu: 'bg-orange-50 border-orange-200' },
      'Tamamen yanlış':          { bar: 'bg-red-500',    yazi: 'text-red-700',    kutu: 'bg-red-50 border-red-200' },
    };
    const dogrulukDagilim = Object.keys(DOGRULUK_STIL).map(k => ({
      ad: k, sayi: filtreli.filter(d => d.kayitDogrulugu === k).length,
    }));
    const dogrulukToplam = dogrulukDagilim.reduce((t, x) => t + x.sayi, 0) || 1;

    // Şef bazlı performans: kaç denetim, kaç personel puanladı, ortalaması
    const sefPerformans = sefler.map(s => {
      const kendi = filtreli.filter(d => d.sefAdi === s);
      const puanlar = kendi.flatMap(d => (d.personelPuanlari || []).map(p => parseInt(p.puan) || 0)).filter(n => n > 0);
      return {
        ad: s, denetim: kendi.length, personel: puanlar.length,
        ortalama: puanlar.length > 0 ? Math.round((puanlar.reduce((t, n) => t + n, 0) / puanlar.length) * 10) / 10 : 0,
        raporlu: kendi.filter(d => (d.genelRapor || '').trim()).length,
      };
    }).filter(x => x.denetim > 0).sort((a, b) => b.denetim - a.denetim);

    // Personel bazlı saha puanı sıralaması (en düşük puanlılar üstte — dikkat gerektirenler)
    // ==========================================================================
    // GÜNLÜK ŞEF TAKİBİ
    // Her şefin o gün yaptığı denetimler; her denetimde hangi işe gittiği,
    // hangi plakalı araçla, işin tutarı, müşteri bilgisi ve kime kaç puan
    // verdiği tek bakışta görünür.
    // Eski kayıtlarda plaka/fiyat alanı bulunmadığı için, iş listesinden
    // (jobs) tamamlanmaya çalışılır.
    // ==========================================================================
    const isBul = (jobId) => jobs.find(j => String(j.id) === String(jobId)) || null;
    const denetimDetay = (d) => {
      const is = isBul(d.jobId);
      return {
        plaka: d.jobVehiclePlate || is?.assignedVehiclePlate || '',
        fiyat: d.jobPrice || is?.price || '',
        telefon: d.jobCustomerPhone || is?.customerPhone || '',
        musteri: d.jobCustomerName || is?.customerName || 'Bilinmiyor',
        rota: d.jobRoute || (is ? `${is.fromDistrict || '?'} → ${is.toDistrict || '?'}` : ''),
        tur: d.jobType || is?.type || '',
        saat: d.jobTime || is?.time || '',
      };
    };

    const sefGunlukTakip = [...new Set(filtreli.map(d => d.sefAdi).filter(Boolean))]
      .map(sef => {
        const kendi = filtreli
          .filter(d => d.sefAdi === sef)
          .sort((a, b) => new Date(a.denetimTarihi || 0) - new Date(b.denetimTarihi || 0));
        const puanlar = kendi.flatMap(d => (d.personelPuanlari || []).map(pp => parseInt(pp.puan) || 0)).filter(n => n > 0);
        const toplamCiro = kendi.reduce((t, d) => t + (parseFloat(denetimDetay(d).fiyat) || 0), 0);
        return {
          ad: sef,
          denetimler: kendi,
          denetimSayisi: kendi.length,
          puanlananPersonel: puanlar.length,
          ortalama: puanlar.length ? Math.round((puanlar.reduce((t, n) => t + n, 0) / puanlar.length) * 10) / 10 : 0,
          toplamCiro,
        };
      })
      .sort((a, b) => b.denetimSayisi - a.denetimSayisi);

    // Gün gezinme yardımcıları
    const gunKaydir = (adet) => {
      const d = new Date(tarih);
      d.setDate(d.getDate() + adet);
      setTarih(d.toISOString().split('T')[0]);
    };
    const tarihEtiketi = new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' });

    const personelPuanOzet = (() => {
      const harita = {};
      filtreli.forEach(d => (d.personelPuanlari || []).forEach(p => {
        const puan = parseInt(p.puan) || 0;
        if (!puan) return;
        const k = String(p.personelId);
        if (!harita[k]) harita[k] = { ad: p.personelAdi, pozisyon: p.pozisyon || '', puanlar: [], notlar: [] };
        harita[k].puanlar.push(puan);
        // DEĞİŞTİ: Not artık düz metin değil, BAĞLAMIYLA saklanıyor — hangi işte,
        // hangi şef tarafından, kaç puanla yazıldığı ekranda gösterilebilsin diye.
        // (Eskiden yalnızca metin tutuluyordu ve ekranda sadece "1 not" yazıyordu.)
        if ((p.ozelNot || '').trim()) harita[k].notlar.push({
          metin: p.ozelNot.trim(),
          is: d.jobCustomerName || '',
          sef: d.sefAdi || '',
          puan,
          // Denetim saati kayıtta ayrı bir alan değil; denetimTarihi'nden türetilir
          // (üstteki denetim kartı da aynı kaynağı kullanıyor).
          saat: d.denetimTarihi ? new Date(d.denetimTarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''
        });
      }));
      return Object.values(harita).map(x => ({
        ...x, ortalama: Math.round((x.puanlar.reduce((t, n) => t + n, 0) / x.puanlar.length) * 10) / 10,
      })).sort((a, b) => a.ortalama - b.ortalama);
    })();

    // NOT: Aylık etiket kaldırıldı; sayfa artık GÜNLÜK çalışıyor (tarihEtiketi).
    const puanRenk = (p) => p >= 4.5 ? 'text-green-600' : p >= 3.5 ? 'text-lime-600' : p >= 2.5 ? 'text-orange-500' : 'text-red-600';

    return (
      <div className="max-w-6xl mx-auto animate-in fade-in space-y-5 pb-8">
        {/* BAŞLIK + ÖZET */}
        <div className="bg-gradient-to-r from-purple-700 via-purple-800 to-neutral-900 rounded-2xl p-5 md:p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-6 h-6" />
            <h2 className="text-xl font-black">Saha Raporlaması</h2>
          </div>
          <p className="text-xs font-bold text-purple-200 mb-4">Şeflerin sahada yaptığı denetimler, personel puanlamaları ve saha notları — <b className="text-white">{tarihEtiketi}</b></p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] font-black uppercase text-purple-200">Yapılan Denetim</div>
              <div className="text-2xl font-black mt-0.5">{toplamDenetim}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] font-black uppercase text-purple-200">Gidilen İş</div>
              <div className="text-2xl font-black mt-0.5">{denetlenenIsler}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] font-black uppercase text-purple-200">Ortalama Saha Puanı</div>
              <div className="text-2xl font-black mt-0.5">{genelOrtalama % 1 === 0 ? genelOrtalama : String(genelOrtalama).replace('.', ',')} <span className="text-sm text-purple-200">/ 5</span></div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-[10px] font-black uppercase text-purple-200">Özel Not Girilen</div>
              <div className="text-2xl font-black mt-0.5">{notluDenetim}</div>
            </div>
          </div>
        </div>

        {/* FİLTRELER */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-3 flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Rapor, müşteri, personel veya şef adı ara..."
              className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-600 transition" />
          </div>
          {/* GÜN SEÇİCİ: sol/sağ ok + tarih + BUGÜN kısayolu (açılış her zaman bugün) */}
          <div className="flex items-stretch gap-1">
            <button onClick={() => gunKaydir(-1)} title="Önceki gün"
              className="px-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-600 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="date" value={tarih} onChange={e => setTarih(e.target.value || bugunStr)}
              className="px-2 py-2.5 border border-neutral-300 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-purple-600" />
            <button onClick={() => gunKaydir(1)} title="Sonraki gün"
              className="px-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-600 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
            {tarih !== bugunStr && (
              <button onClick={() => setTarih(bugunStr)} title="Bugüne dön"
                className="px-3 rounded-xl bg-purple-700 text-white text-[10px] font-black hover:bg-purple-800 transition whitespace-nowrap">BUGÜN</button>
            )}
          </div>
          <select value={sefFiltre} onChange={e => setSefFiltre(e.target.value)} className="p-2.5 border border-neutral-300 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-purple-600">
            <option value="Tümü">Tüm Şefler</option>
            {sefler.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* KAYIT DOĞRULUĞU DAĞILIMI — satış/kayıt kalitesi denetimi */}
        {toplamDenetim > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4">
            <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-neutral-400" /> Kayıt Doğruluğu (İşi Açan Kişilerin Doğruluk Değerlendirmesi)
            </h3>
            <div className="space-y-2">
              {dogrulukDagilim.map(x => {
                const st = DOGRULUK_STIL[x.ad];
                const oran = Math.round((x.sayi / dogrulukToplam) * 100);
                return (
                  <div key={x.ad}>
                    <div className="flex justify-between text-[11px] font-bold mb-0.5">
                      <span className={st.yazi}>{x.ad}</span>
                      <span className="text-neutral-500">{x.sayi} denetim • %{oran}</span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className={`h-full ${st.bar}`} style={{ width: `${oran}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ====================================================================
            GÜNLÜK ŞEF DENETİM DÖKÜMÜ (yeni)
            Seçili günde her şefin kaç denetim yaptığı; her denetimde hangi işe
            gittiği, plaka, tutar, müşteri ve kime kaç puan verdiği.
            ==================================================================== */}
        {sefGunlukTakip.length > 0 && (
          <div className="space-y-4">
            {sefGunlukTakip.map(sef => (
              <div key={sef.ad} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                {/* ŞEF BAŞLIĞI + günün özeti */}
                <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg shrink-0">
                      {sef.ad.charAt(0).toLocaleUpperCase('tr-TR')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-base truncate">{sef.ad}</h3>
                      <p className="text-[11px] font-bold text-purple-200">Bu gün sahada yaptığı denetimler</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                      <div className="text-lg font-black leading-none">{sef.denetimSayisi}</div>
                      <div className="text-[9px] font-black text-purple-200 uppercase">denetim</div>
                    </div>
                    <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                      <div className="text-lg font-black leading-none">{sef.puanlananPersonel}</div>
                      <div className="text-[9px] font-black text-purple-200 uppercase">personel</div>
                    </div>
                    <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                      <div className="text-lg font-black leading-none">{String(sef.ortalama).replace('.', ',')}</div>
                      <div className="text-[9px] font-black text-purple-200 uppercase">ort. puan</div>
                    </div>
                    {sef.toplamCiro > 0 && (
                      <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                        <div className="text-lg font-black leading-none">₺{sef.toplamCiro.toLocaleString('tr-TR')}</div>
                        <div className="text-[9px] font-black text-purple-200 uppercase">gidilen iş tutarı</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* DENETİM DÖKÜMÜ */}
                <div className="divide-y divide-neutral-100">
                  {sef.denetimler.map((d, sira) => {
                    const bilgi = denetimDetay(d);
                    const saat = d.denetimTarihi ? new Date(d.denetimTarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div key={d.id} className="p-4 hover:bg-neutral-50/70 transition">
                        {/* İŞ BİLGİSİ */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-5 h-5 rounded-md bg-neutral-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">{sira + 1}</span>
                              {/* Müşteri kartı: cari profiline gidilebilir */}
                              <button
                                onClick={() => onViewCari && d.jobCustomerName && onViewCari(bilgi.telefon)}
                                disabled={!onViewCari || !bilgi.telefon}
                                className={`font-black text-sm text-black truncate text-left ${onViewCari && bilgi.telefon ? 'hover:text-purple-700 hover:underline' : ''}`}
                                title={onViewCari && bilgi.telefon ? 'Cari profiline git' : ''}
                              >
                                {bilgi.musteri}
                              </button>
                              {bilgi.tur && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{bilgi.tur}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pl-7 text-[11px] font-bold text-neutral-500">
                              {bilgi.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {bilgi.telefon}</span>}
                              {bilgi.rota && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {bilgi.rota}</span>}
                              {bilgi.saat && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> İş saati {bilgi.saat}</span>}
                              {saat && <span className="flex items-center gap-1 text-purple-600"><ClipboardCheck className="w-3 h-3" /> Denetim {saat}</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 shrink-0">
                            {/* Araç plakası */}
                            {bilgi.plaka ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg">
                                <Truck className="w-3.5 h-3.5" /> {bilgi.plaka}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-neutral-300 px-2 py-1">Araç bilgisi yok</span>
                            )}
                            {/* İş tutarı */}
                            {bilgi.fiyat ? (
                              <span className="text-[11px] font-black bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-lg">
                                ₺{(parseFloat(bilgi.fiyat) || 0).toLocaleString('tr-TR')}
                              </span>
                            ) : null}
                            {/* Kayıt doğruluğu */}
                            {d.kayitDogrulugu && (
                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${(DOGRULUK_STIL[d.kayitDogrulugu] || {}).kutu || 'bg-neutral-50 border-neutral-200'} ${(DOGRULUK_STIL[d.kayitDogrulugu] || {}).yazi || 'text-neutral-600'}`}>
                                {d.kayitDogrulugu}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* PERSONEL PUANLARI: kime kaç verdi */}
                        {(d.personelPuanlari || []).length > 0 && (
                          <div className="pl-7 flex flex-wrap gap-1.5 mb-2">
                            {d.personelPuanlari.map((pp, i) => {
                              const puan = parseInt(pp.puan) || 0;
                              const renk = puan >= 5 ? 'bg-green-100 text-green-800 border-green-300'
                                : puan === 4 ? 'bg-lime-100 text-lime-800 border-lime-300'
                                : puan === 3 ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                : 'bg-red-100 text-red-800 border-red-300';
                              return (
                                <span key={i} className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg border ${renk}`}
                                      title={pp.ozelNot ? `Not: ${pp.ozelNot}` : ''}>
                                  {pp.personelAdi}
                                  <span className="flex items-center gap-0.5">{puan}<Star className="w-3 h-3 fill-current" /></span>
                                  {pp.ozelNot ? <MessageSquareText className="w-3 h-3 opacity-70" /> : null}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Şefin genel raporu */}
                        {(d.genelRapor || '').trim() && (
                          <p className="pl-7 text-[11px] font-bold text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                            {d.genelRapor}
                          </p>
                        )}

                        {/* ============================================================
                            SAHADA ÇEKİLEN FOTOĞRAFLAR
                            Şefin denetim sırasında yüklediği görseller. Tıklayınca
                            büyük önizleme açılır. Video ise kamera simgesi gösterilir.
                            ============================================================ */}
                        {(() => {
                          const medya = (d.medya || []).filter(Boolean);
                          if (medya.length === 0) return null;
                          return (
                            <div className="pl-7 mt-2">
                              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Sahada çekilen görseller ({medya.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {medya.map((url, i) => (
                                  <button
                                    key={url + i}
                                    type="button"
                                    onClick={() => setViewingImage?.({ title: `${bilgi.musteri} — Saha Görseli ${i + 1}`, name: url })}
                                    className="w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-500 transition flex items-center justify-center"
                                    title="Büyütmek için tıklayın"
                                  >
                                    {isVideoUrl(url)
                                      ? <Camera className="w-5 h-5 text-neutral-500" />
                                      : <img src={url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Seçili günde hiç denetim yoksa */}
        {!yukleniyor && sefGunlukTakip.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
            <ClipboardCheck className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-black text-neutral-500">Bu gün için saha denetimi kaydı yok</p>
            <p className="text-[11px] font-bold text-neutral-400 mt-1">Oklarla başka bir güne geçebilirsiniz.</p>
          </div>
        )}

        {/* ŞEF PERFORMANSI + DİKKAT GEREKTİREN PERSONEL */}
        {toplamDenetim > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-4">
              <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-500" /> Şef Performansı
              </h3>
              <div className="space-y-2">
                {sefPerformans.map(s => (
                  <div key={s.ad} className="flex items-center gap-3 bg-neutral-50 rounded-xl p-2.5 border border-neutral-200">
                    <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                      {s.ad.charAt(0).toLocaleUpperCase('tr-TR')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-sm text-black block truncate">{s.ad}</span>
                      <span className="text-[10px] font-bold text-neutral-400">{s.denetim} denetim • {s.personel} personel puanladı • {s.raporlu} rapor yazdı</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-lg font-black ${puanRenk(s.ortalama)}`}>{String(s.ortalama).replace('.', ',')}</span>
                      <span className="block text-[9px] font-black text-neutral-400 uppercase">verdiği ort.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 p-4">
              <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500" /> Personel Saha Puanları <span className="normal-case font-bold text-neutral-400">(en düşük puanlı üstte)</span>
              </h3>
              <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                {personelPuanOzet.map((p, i) => {
                  // YENİ: Notu olan kartlar açılabilir. Tıklanınca o personele
                  // yazılmış tüm denetim notları, hangi işte ve hangi şef
                  // tarafından yazıldığıyla birlikte listelenir.
                  const anahtar = p.ad + i;
                  const acik = acikPuanKarti === anahtar;
                  const notVar = p.notlar.length > 0;
                  return (
                    <div key={anahtar} className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
                      <div
                        onClick={() => { if (notVar) setAcikPuanKarti(acik ? null : anahtar); }}
                        className={`flex items-center gap-3 p-2.5 ${notVar ? 'cursor-pointer hover:bg-neutral-100 transition' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-sm text-black block truncate">{p.ad}</span>
                          <span className="text-[10px] font-bold text-neutral-400">
                            {p.pozisyon || '—'} • {p.puanlar.length} denetim
                            {notVar && <span className="text-purple-600"> • {p.notlar.length} not</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-lg font-black ${puanRenk(p.ortalama)}`}>{String(p.ortalama).replace('.', ',')}</span>
                          <Star className="w-3.5 h-3.5 text-yellow-500" />
                          {notVar && <ChevronDown className={`w-4 h-4 text-neutral-400 transition ${acik ? 'rotate-180' : ''}`} />}
                        </div>
                      </div>
                      {/* DENETİM NOTLARI */}
                      {acik && notVar && (
                        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-neutral-200 pt-2">
                          {p.notlar.map((n, ni) => (
                            <div key={ni} className="bg-white rounded-lg p-2 border border-neutral-200">
                              <p className="text-xs font-medium text-neutral-700 leading-relaxed">{n.metin}</p>
                              <p className="text-[10px] font-bold text-neutral-400 mt-1">
                                {n.puan} <Star className="w-2.5 h-2.5 text-yellow-500 inline -mt-0.5" />
                                {n.is ? ` • ${n.is}` : ''}
                                {n.sef ? ` • ${n.sef}` : ''}
                                {n.saat ? ` • ${n.saat}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* NOT: Alttaki "Denetim Yapılan İşler" listesi kullanıcı isteğiyle KALDIRILDI.
            Aynı bilgiler (iş, plaka, tutar, personel puanları, şef raporu ve sahada
            çekilen fotoğraflar) yukarıdaki günlük şef denetim dökümünde gösteriliyor. */}
      </div>
    );
  };
