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

    // YENİ: Sıralama önce makine okunur createdAt alanına bakar; yoksa metin tarihini ayrıştırır.
    // Böylece "en son işlem en üstte" sıralaması her kayıtta güvenilir çalışır.
    const logZamani = (log) => {
      if (log?.createdAt) {
        const t = new Date(log.createdAt).getTime();
        if (!isNaN(t)) return t;
      }
      return parseLogDate(log?.timestamp);
    };

    // YENİ: Hareket detayını ayrıştırıp TEKRAR EDEN malzemeleri tek kalemde toplar.
    // Eski kayıtlarda "1 Kg Kağıt, 7 Adet Koli, 1 Kg Kağıt, 7 Adet Koli..." şeklinde
    // uzayan listeler bu sayede "2 Kg Kağıt, 14 Adet Koli" olarak sade görünür.
    const parseMalzemeDetay = (metin) => {
      if (!metin) return { baslik: '', kalemler: [] };
      const ayirac = metin.indexOf(':');
      if (ayirac === -1) return { baslik: metin, kalemler: [] };
      const baslik = metin.slice(0, ayirac).trim();
      const govde = metin.slice(ayirac + 1);
      const harita = new Map();
      const cozulemeyen = [];
      govde.split(',').map(s => s.trim()).filter(Boolean).forEach(parca => {
        const m = parca.match(/^([\d.,]+)\s+(.+)$/); // "1.5 Rulo Streç" → 1.5 + "Rulo Streç"
        if (!m) { cozulemeyen.push(parca); return; }
        const miktar = parseFloat(String(m[1]).replace(',', '.'));
        if (isNaN(miktar)) { cozulemeyen.push(parca); return; }
        const ad = m[2].trim();
        harita.set(ad, (harita.get(ad) || 0) + miktar);
      });
      const kalemler = Array.from(harita.entries()).map(([ad, miktar]) => ({ ad, miktar: Math.round(miktar * 100) / 100 }));
      return { baslik, kalemler, cozulemeyen };
    };

    // YENİ: Hareket listesi için arama ve işlem türü filtresi
    const [logArama, setLogArama] = useState('');
    const [logTuru, setLogTuru] = useState('Tümü'); // 'Tümü' | 'giris' | 'cikis'

    // Sistem loglarından sadece malzeme ve stok hareketlerini filtrele (en yeni en üstte)
    const allMaterialLogsSorted = systemLogs.filter(log => 
      log.action?.includes('Malzeme') || log.action?.includes('Stok')
    ).sort((a, b) => logZamani(b) - logZamani(a));

    // Arama + tür filtresi uygulanmış liste
    const filtrelenmisLoglar = allMaterialLogsSorted.filter(log => {
      const cikisMi = (log.action || '').includes('Çıkış');
      if (logTuru === 'cikis' && !cikisMi) return false;
      if (logTuru === 'giris' && cikisMi) return false;
      const q = logArama.trim().toLocaleLowerCase('tr-TR');
      if (!q) return true;
      return `${log.details || ''} ${log.user || ''} ${log.action || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });

    // YENİ: "Tüm Hareketleri Gör" butonu için TAM liste (kesilmemiş)
    const allMaterialLogs = filtrelenmisLoglar;
    const materialLogs = filtrelenmisLoglar.slice(0, 20); // Son 20 hareketi göster

    // Hareket satırının detay hücresi — başlık + toplanmış malzeme etiketleri
    const DetayHucresi = ({ log }) => {
      const { baslik, kalemler, cozulemeyen } = parseMalzemeDetay(log.details);
      const cikisMi = (log.action || '').includes('Çıkış');
      if (!kalemler || kalemler.length === 0) {
        return <span className="text-neutral-600 font-medium">{log.details}</span>;
      }
      return (
        <div className="min-w-0">
          <p className="text-neutral-700 font-bold text-[13px] mb-1.5">{baslik}</p>
          <div className="flex flex-wrap gap-1">
            {kalemler.map((k, i) => (
              <span key={i} className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${cikisMi ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                {cikisMi ? '−' : '+'}{k.miktar} {k.ad}
              </span>
            ))}
            {(cozulemeyen || []).map((c, i) => (
              <span key={'x' + i} className="text-[11px] font-bold px-2 py-0.5 rounded-lg border bg-neutral-50 text-neutral-500 border-neutral-200">{c}</span>
            ))}
          </div>
        </div>
      );
    };

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
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-neutral-200 pb-4 gap-3">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              <History className="w-6 h-6 text-red-600" /> Stok Hareketleri
              <span className="text-xs font-bold text-neutral-400">(en yeni en üstte)</span>
            </h2>
            {/* YENİ: Tüm Hareketleri Gör Butonu */}
            <button
              onClick={() => setShowAllLogsModal(true)}
              className="bg-neutral-100 text-neutral-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-200 transition w-full sm:w-auto justify-center"
            >
              <History className="w-4 h-4" /> Tüm Hareketleri Gör ({allMaterialLogs.length})
            </button>
          </div>

          {/* YENİ: Arama + işlem türü filtresi */}
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={logArama} onChange={e => setLogArama(e.target.value)} placeholder="Müşteri, malzeme veya personel ara..."
                className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600 transition" />
            </div>
            <div className="flex gap-1.5">
              {[{ k: 'Tümü', l: 'Tümü' }, { k: 'cikis', l: 'Stok Çıkışı' }, { k: 'giris', l: 'Stok Girişi' }].map(o => (
                <button key={o.k} onClick={() => setLogTuru(o.k)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap ${logTuru === o.k ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-red-400'}`}>
                  {o.l}
                </button>
              ))}
            </div>
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
                  <tr key={log.id} className="hover:bg-neutral-50 transition align-top">
                    <td className="p-4 font-medium text-black whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${log.action.includes('Çıkış') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4"><DetayHucresi log={log} /></td>
                    <td className="p-4 font-bold text-neutral-800 whitespace-nowrap">{log.user}</td>
                  </tr>
                ))}
                {materialLogs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-neutral-500">
                      {logArama.trim() || logTuru !== 'Tümü' ? 'Aramanıza uygun hareket bulunamadı.' : 'Henüz malzeme hareketi bulunmuyor.'}
                    </td>
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
                      <tr key={log.id} className="hover:bg-neutral-50 transition align-top">
                        <td className="p-4 font-medium text-black whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${log.action.includes('Çıkış') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4"><DetayHucresi log={log} /></td>
                        <td className="p-4 font-bold text-neutral-800 whitespace-nowrap">{log.user}</td>
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

  export const AddVehicleView = ({ onAdd, onCancel }) => {
    const [formData, setFormData] = useState({
      plate: '', type: 'Kamyon', capacity: [], volume: '', km: '', model: '', color: 'Beyaz', transmission: 'Manuel', ruhsatFoto: '', vehiclePhoto: '', requiredLicense: 'Küçük Ehliyet', tonnage: '',
      // YENİ: Sigorta (trafik) ve Kasko maliyet + yenileme tarihi bilgileri
      sigortaTutari: '', sigortaBitis: '', sigortaSirketi: '',
      kaskoTutari: '', kaskoBitis: '', kaskoSirketi: '',
      // YENİ: Araca ait birden fazla belge (ruhsat, poliçe, muayene, fatura...)
      belgeler: []
    });
    const [belgeYukleniyor, setBelgeYukleniyor] = useState(false);

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

    // YENİ: Birden fazla belge (fotoğraf/PDF) aynı anda yüklenebilir.
    // Hatırlatmalar bölümündeki belge altyapısıyla aynı yöntemi kullanır.
    const handleBelgeYukle = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setBelgeYukleniyor(true);
      const yeniler = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
          const text = await res.text();
          let url = file.name;
          try { const json = JSON.parse(text); url = json.url || json.fileName || json.file || text; } catch (err) { url = text.trim(); }
          const uzanti = (file.name.split('.').pop() || '').toLowerCase();
          const tip = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'].includes(uzanti) ? 'image' : (uzanti === 'pdf' ? 'pdf' : 'file');
          yeniler.push({ url, name: file.name, type: tip, eklenme: new Date().toISOString() });
        } catch (err) {
          console.error('Belge yüklenemedi:', file.name, err);
          alert(`"${file.name}" yüklenemedi.`);
        }
      }
      setFormData(prev => ({ ...prev, belgeler: [...(prev.belgeler || []), ...yeniler] }));
      setBelgeYukleniyor(false);
      e.target.value = ''; // Aynı dosya tekrar seçilebilsin
    };

    // Yüklenen belgeyi listeden kaldırır
    const belgeSil = (idx) => {
      setFormData(prev => ({ ...prev, belgeler: (prev.belgeler || []).filter((_, i) => i !== idx) }));
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            {/* YENİ: Tonaj (kg) — araç filosunun toplam taşıma kapasitesi hesabında kullanılır */}
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Tonaj (kg)</label>
              <input type="number" value={formData.tonnage || ''} onChange={(e) => setFormData({...formData, tonnage: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 3500" />
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

          {/* ====================================================================
              YENİ: SİGORTA (TRAFİK) VE KASKO MALİYETLERİ
              Yıllık tutar, bitiş tarihi ve şirket bilgisi tutulur. Bitiş
              tarihine 30 günden az kaldıysa uyarı rozeti gösterilir.
              ==================================================================== */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-4">
            <label className="block text-sm font-bold text-black flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-600" /> Sigorta ve Kasko Maliyeti
            </label>

            {/* TRAFİK SİGORTASI */}
            <div>
              <p className="text-[11px] font-black text-neutral-500 uppercase mb-1.5">Trafik Sigortası</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1">Yıllık Tutar (₺)</label>
                  <input type="number" step="0.01" min="0" value={formData.sigortaTutari}
                    onChange={e => setFormData({ ...formData, sigortaTutari: e.target.value })}
                    placeholder="Örn: 12500" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1">Bitiş Tarihi</label>
                  <input type="date" value={formData.sigortaBitis}
                    onChange={e => setFormData({ ...formData, sigortaBitis: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1">Sigorta Şirketi</label>
                  <input value={formData.sigortaSirketi}
                    onChange={e => setFormData({ ...formData, sigortaSirketi: e.target.value })}
                    placeholder="Örn: Anadolu Sigorta" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
              </div>
            </div>

            {/* KASKO */}
            <div>
              <p className="text-[11px] font-black text-neutral-500 uppercase mb-1.5">Kasko</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1">Yıllık Tutar (₺)</label>
                  <input type="number" step="0.01" min="0" value={formData.kaskoTutari}
                    onChange={e => setFormData({ ...formData, kaskoTutari: e.target.value })}
                    placeholder="Örn: 28000" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1">Bitiş Tarihi</label>
                  <input type="date" value={formData.kaskoBitis}
                    onChange={e => setFormData({ ...formData, kaskoBitis: e.target.value })}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1">Kasko Şirketi</label>
                  <input value={formData.kaskoSirketi}
                    onChange={e => setFormData({ ...formData, kaskoSirketi: e.target.value })}
                    placeholder="Örn: Axa Sigorta" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
              </div>
            </div>

            {/* TOPLAM + YENİLEME UYARISI */}
            {(() => {
              const sig = parseFloat(formData.sigortaTutari) || 0;
              const kas = parseFloat(formData.kaskoTutari) || 0;
              const toplam = sig + kas;
              // Bitiş tarihine kalan gün sayısı
              const kalanGun = (tarih) => {
                if (!tarih) return null;
                const fark = Math.ceil((new Date(tarih) - new Date()) / (1000 * 60 * 60 * 24));
                return isNaN(fark) ? null : fark;
              };
              const sg = kalanGun(formData.sigortaBitis);
              const kg = kalanGun(formData.kaskoBitis);
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

          {/* ====================================================================
              YENİ: ARAÇ BELGELERİ (BİRDEN FAZLA)
              Poliçe, muayene, fatura vb. fotoğraf veya PDF olarak toplu eklenir.
              ==================================================================== */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-red-600" /> Araç Belgeleri
              <span className="text-[10px] font-medium text-neutral-400">(fotoğraf / PDF — birden fazla seçilebilir)</span>
            </label>

            {/* Yüklenen belgelerin listesi */}
            {(formData.belgeler || []).length > 0 && (
              <div className="space-y-1.5 mb-3">
                {formData.belgeler.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl p-2">
                    {b.type === 'image'
                      ? <img src={b.url} alt={b.name} className="w-10 h-10 rounded-lg object-cover border border-neutral-200 shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-red-500" /></div>}
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs font-bold text-black hover:text-red-600 hover:underline truncate" title={b.name}>
                      {b.name}
                    </a>
                    <button type="button" onClick={() => belgeSil(i)} className="p-1.5 text-neutral-300 hover:text-red-600 transition shrink-0" title="Belgeyi kaldır">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Çoklu dosya seçici */}
            <label className={`w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer flex items-center justify-center gap-2 text-sm font-black transition ${belgeYukleniyor ? 'border-neutral-200 text-neutral-300 cursor-wait' : 'border-red-300 text-red-600 hover:bg-red-50'}`}>
              {belgeYukleniyor ? <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</> : <><PlusCircle className="w-4 h-4" /> Belge Ekle</>}
              <input type="file" multiple accept="image/*,application/pdf" onChange={handleBelgeYukle} disabled={belgeYukleniyor} className="hidden" />
            </label>
            {(formData.belgeler || []).length > 0 && (
              <p className="text-[10px] font-bold text-neutral-400 mt-1.5 text-center">{formData.belgeler.length} belge eklendi</p>
            )}
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

        {/* İşlem Yapılacak Aracı Seçin — YENİ: açılır liste yerine tipine göre simgeli araç kartları */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-black mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-red-600" /> Filo — İşlem Yapmak İçin Araca Dokunun
          </h3>
          {/* Tüm araçlar plakası ve tip simgesiyle (Kamyon = büyük tır simgesi, Kamyonet = küçük araç simgesi) kart olarak listelenir */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {vehicles.map(v => {
              const isSelected = String(selectedVehicleId) === String(v.id);
              const isKamyon = (v.type || '').toLowerCase().includes('kamyon') && !(v.type || '').toLowerCase().includes('kamyonet');
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(isSelected ? '' : v.id)}
                  title={`${v.plate} — ${v.type || 'Araç'}${v.model ? ' • ' + v.model : ''}`}
                  className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-red-600 bg-gradient-to-b from-red-50 to-white shadow-lg shadow-red-600/20 scale-[1.03]'
                      : 'border-neutral-200 bg-gradient-to-b from-neutral-50 to-white hover:border-red-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {/* Seçim onay işareti */}
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow animate-in zoom-in">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {/* Araç tipi simgesi: Kamyon büyük ve koyu, Kamyonet küçük ve açık tonda */}
                  <span className={`flex items-center justify-center rounded-2xl transition ${
                    isKamyon
                      ? `w-14 h-14 ${isSelected ? 'bg-red-600 text-white shadow-md shadow-red-600/40' : 'bg-neutral-800 text-white group-hover:bg-red-600'}`
                      : `w-12 h-12 ${isSelected ? 'bg-red-500 text-white shadow-md shadow-red-500/40' : 'bg-neutral-200 text-neutral-600 group-hover:bg-red-100 group-hover:text-red-600'}`
                  }`}>
                    <Truck className={isKamyon ? 'w-8 h-8' : 'w-6 h-6'} />
                  </span>
                  {/* Plaka: tabela görünümünde */}
                  <span className={`px-2 py-0.5 rounded-md border font-black tracking-widest text-xs whitespace-nowrap ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-300 group-hover:border-neutral-500'}`}>
                    {v.plate}
                  </span>
                  {/* Araç tipi etiketi */}
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-red-600' : 'text-neutral-400 group-hover:text-neutral-600'}`}>
                    {v.type || 'Araç'}{v.volume ? ` • ${v.volume} m³` : ''}
                  </span>
                </button>
              );
            })}
            {vehicles.length === 0 && (
              <div className="col-span-full text-center py-8 text-neutral-400 font-medium text-sm">
                Sisteme kayıtlı araç bulunmuyor.
              </div>
            )}
          </div>

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
                        <option value="K3 Belgesi Yenileme">K3 Belgesi Yenileme</option>
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
                      <input type="date" value={recordForm.nextDate} onChange={e => setRecordForm({...recordForm, nextDate: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" title="Muayene, Sigorta veya K3 belgesi bitiş/yenileme tarihi" />
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
