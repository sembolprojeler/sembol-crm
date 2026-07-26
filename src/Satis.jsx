import React, { useState, useEffect, useMemo } from 'react';
import { Truck, MapPin, Phone, FileText, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, Briefcase, Wallet, ArrowUpRight, ArrowUpDown, UserPlus, Edit, User, MessageCircle, Package, Database, History, Save, Search, FolderOpen, Ban, CheckCircle } from 'lucide-react';
import { collection, addDoc, onSnapshot, doc, setDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { db, appId, PROVINCES, FLOORS, TURKEY_LOCATIONS, DEPO_LOCATIONS, normalizeCariPhone, generateContractPDF, SayfalamaBar } from './shared.jsx';

  // ============================================================================
  // YENİ: Ortak Bölüm Başlığı Bileşeni (SectionHeader)
  // 4 ana başlık (Müşteri, Finans, Yükleme, Boşaltma) için tek tip, şık tasarım.
  // Punto, eski başlıklara göre ~%5 küçültülmüştür (16px -> 15px, 18px -> 17px).
  // ============================================================================
  const SectionHeader = ({ icon: Icon, title, rightSlot }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 -mx-3 md:-mx-4 -mt-3 md:-mt-4 mb-4 px-3 md:px-4 py-2.5 rounded-t-2xl bg-gradient-to-r from-red-600/10 via-neutral-100 to-transparent border-b-2 border-red-600/20">
      <div className="flex items-center gap-2.5">
        {/* İkon rozeti: kırmızı zemin üzerinde beyaz ikon (%10 küçültüldü) */}
        <span className="w-7 h-7 shrink-0 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30">
          <Icon className="w-3.5 h-3.5" />
        </span>
        {/* Başlık yazısı: %10 küçültülmüş punto (15px→13.5px, 17px→15px) */}
        <h3 className="font-black text-neutral-900 uppercase tracking-wide text-[13.5px] md:text-[15px] leading-tight">
          {title}
        </h3>
      </div>
      {/* Başlığın sağına eklenebilecek opsiyonel alan (örn. depo seçimi) */}
      {rightSlot}
    </div>
  );

  // ============================================================================
  // YENİ: "Teslim Durumu" seçenekleri (eski adı Teslim Şekli / Duvar Montajı).
  // NOT: Bu seçimler Sözleşme Detayı'na YAZI olarak EKLENMEZ. Bunun yerine
  // sözleşme PDF'inde ve tüm iş kartlarında ayrı bir satır/etiket olarak gösterilir.
  // ============================================================================
  const WALL_MOUNT_OPTIONS = ['TV Montajı', 'Mobilya Sabitleme', 'Raf/Tablo', 'Avize', 'Kalıcı Ambalaj', 'Montaj Yapılmayacak', 'Depoya Teslim'];

  // YENİ: "Eşya Durumu" seçenekleri — Teslim Durumu ile AYNI mantıkta çoklu seçim.
  // Varsayılan (boş seçim) = "Toplu". Firma toplaması gereken seçenekler materyal hesabını tetikler.
  const ESYA_OPTIONS = ['Kendisi Topladı', 'Toplama Yapılacaktır', 'Sadece Mutfak Toplama', 'Sadece Kıyafet Toplama', 'Sökülüm İşlemi Yoktur', 'Ambalaj İşlemi Yoktur', 'Özel Mobilya Sökülüm'];
  // Bu seçeneklerden biri seçiliyse firma toplaması yapılacak demektir (materyal hesabı için)
  const ESYA_COMPANY_PACKING = ['Toplama Yapılacaktır', 'Sadece Mutfak Toplama', 'Sadece Kıyafet Toplama'];

  export const AddJobView = ({
    type, formData, setFormData, handleInputChange, handleProvinceChange,
    handleDepoChange, toggleDepoDirection, handleAddJob, editingJobId, handleSwapAddresses
  }) => {
    // YENİ: İsim / telefon boş bırakılırsa gösterilecek uyarı penceresi state'i
    const [showValidationModal, setShowValidationModal] = useState(false);
    // YENİ: Teslim Durumu açılır penceresinin açık/kapalı durumu
    const [wallMountOpen, setWallMountOpen] = useState(false);
    // YENİ: Eşya Durumu açılır penceresinin açık/kapalı durumu
    const [esyaOpen, setEsyaOpen] = useState(false);

    // YENİ: Seçili teslim durumu işlemleri (dizi). Boş dizi = "Yok" seçili demektir.
    const selectedWallMounts = formData.wallMounting || [];
    // YENİ: Seçili eşya durumu işlemleri (dizi). Boş dizi = "Toplu" (varsayılan) demektir.
    const selectedEsya = formData.esyaDurumu || [];

    // YENİ: Teslim durumu seçimini değiştirir. Sözleşme detayına HİÇBİR yazı eklenmez;
    // sadece wallMounting dizisi güncellenir (sözleşme PDF'i ve iş kartları bu diziyi okur).
    const toggleWallMount = (opt) => {
      setFormData(prev => {
        const current = prev.wallMounting || [];
        const next = opt === 'Yok'
          ? [] // "Yok" seçilirse tüm seçimler temizlenir
          : (current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt]);
        return { ...prev, wallMounting: next };
      });
    };

    // YENİ: Eşya durumu seçimini değiştirir (Teslim Durumu ile aynı çoklu-seçim mantığı).
    // "Kendisi Topladı" dahil tüm seçenekler bağımsız açılıp kapanır (çoklu seçim).
    // Geriye dönük uyumluluk için fromPacking (string) senkron tutulur:
    // firma toplaması gerektiren bir seçim varsa 'Toplama Yapılacak', yoksa 'Kendisi Topladı'.
    const toggleEsya = (opt) => {
      setFormData(prev => {
        const current = prev.esyaDurumu || [];
        const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
        // Materyal hesabı ve sözleşmedeki "Toplama Hizmeti" için fromPacking senkronu
        const needsCompanyPacking = next.some(o => ESYA_COMPANY_PACKING.includes(o));
        return { ...prev, esyaDurumu: next, fromPacking: needsCompanyPacking ? 'Toplama Yapılacak' : 'Kendisi Topladı' };
      });
    };

    // YENİ: Kayıt öncesi zorunlu alan kontrolü.
    // İsim veya telefon boşsa kayıt YAPILMAZ, uyarı penceresi açılır.
    const handleSaveClick = (e) => {
      if (!formData.customerName?.trim() || !formData.customerPhone?.trim()) {
        setShowValidationModal(true);
        return;
      }
      handleAddJob(e); // Alanlar doluysa App.jsx içindeki asıl kayıt fonksiyonu çalışır
    };

    // Ortak input stili (tekrarı azaltmak için değişkende tutuyoruz)
    const inputCls = "w-full min-w-0 p-2.5 md:p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition";
    const selectCls = "w-full min-w-0 p-2.5 md:p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition";
    const labelCls = "block text-xs md:text-sm font-bold text-neutral-700 mb-1";

    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 md:p-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
          {/* Sayfa ana başlığı: "Detaylı" ibaresi kaldırıldı, tek satırda görünür (whitespace-nowrap) */}
          <h2 className="text-[17px] md:text-[22px] font-black text-black flex items-center gap-2 whitespace-nowrap overflow-hidden">
            <PlusCircle className="w-6 h-6 md:w-7 md:h-7 text-red-600 shrink-0" /> 
            {editingJobId ? `${type} Kaydını Güncelle` : `${type} Kaydı Oluştur`}
          </h2>
          <button 
            type="button" 
            onClick={() => setFormData({...formData, isSpecial: !formData.isSpecial})}
            className="flex flex-col items-center group transition"
            title="Özel Müşteri Olarak İşaretle"
          >
            <Star className={`w-8 h-8 transition ${formData.isSpecial ? 'text-yellow-400 fill-yellow-400 drop-shadow-md scale-110' : 'text-neutral-300 group-hover:text-yellow-200'}`} />
            <span className={`text-[10px] font-bold mt-1 ${formData.isSpecial ? 'text-yellow-600' : 'text-neutral-400'}`}>ÖZEL</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* ==================== MÜŞTERİ VE RANDEVU BİLGİLERİ ==================== */}
          <div className="bg-neutral-50 p-3 md:p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <SectionHeader icon={Users} title="Müşteri ve Randevu Bilgileri" />
            
            <div className="flex bg-neutral-200/60 p-1 rounded-xl mb-5 w-full md:w-fit border border-neutral-300">
              <button 
                type="button"
                onClick={() => setFormData({...formData, customerType: 'Bireysel'})}
                className={`flex-1 md:flex-none px-4 md:px-5 py-2 text-xs md:text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${formData.customerType === 'Bireysel' ? 'bg-white text-red-600 shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                <User className="w-4 h-4" /> Bireysel Müşteri
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, customerType: 'Kurumsal'})}
                className={`flex-1 md:flex-none px-4 md:px-5 py-2 text-xs md:text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${formData.customerType === 'Kurumsal' ? 'bg-white text-red-600 shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                <Briefcase className="w-4 h-4" /> Kurumsal Müşteri
              </button>
            </div>

            <div className="space-y-4">
              {/* SATIR 1: Ad Soyad + TC Kimlik No (mobilde de yan yana) */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>
                    {formData.customerType === 'Kurumsal' ? 'Şirket Ünvanı *' : 'Ad Soyad *'}
                  </label>
                  <input required type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className={inputCls} placeholder={formData.customerType === 'Kurumsal' ? 'Örn: Sembol Nakliyat A.Ş.' : 'Örn: Mehmet Şen'} />
                </div>
                <div>
                  <label className={labelCls}>
                    {formData.customerType === 'Kurumsal' ? 'Vergi No' : 'TC Kimlik Numarası'}
                  </label>
                  {formData.customerType === 'Kurumsal' ? (
                    <input type="text" name="taxNo" value={formData.taxNo} onChange={handleInputChange} className={inputCls} placeholder="Vergi numarası" />
                  ) : (
                    // TC Kimlik No: inputMode=numeric ile mobilde sayı klavyesi açılır; onChange içinde harf/işaret temizlenir (yalnızca 0-9, en fazla 11 hane)
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      name="tcNo" 
                      value={formData.tcNo} 
                      onChange={(e) => {
                        const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 11); // Rakam dışı karakterleri sil
                        handleInputChange({ target: { name: 'tcNo', value: onlyDigits } });
                      }} 
                      className={inputCls} 
                      placeholder="İsteğe bağlı" 
                    />
                  )}
                </div>
              </div>

              {/* SATIR 2: Telefon + Yedek Telefon (mobilde de yan yana) */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Telefon Numarası *</label>
                  <input required type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} className={inputCls} placeholder="Örn: 05551234567" />
                </div>
                <div>
                  <label className={labelCls}>Yedek Telefon Numarası</label>
                  <input type="tel" name="altPhone" value={formData.altPhone || ''} onChange={handleInputChange} className={inputCls} placeholder="İsteğe Bağlı" />
                </div>
              </div>

              {/* SATIR 3: Tarih + Saat + İşlem Süresi — 3 eşit sütun, küçültülmüş ve hizalı, birbirine taşmaz */}
              {/* min-w-0 + w-full taşmayı engeller, ortak küçük punto (text-sm) ile hepsi aynı görünür */}
              <div className="grid grid-cols-3 gap-2">
                <div className="min-w-0">
                  <label className={`${labelCls} text-center`}>Tarih *</label>
                  <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full min-w-0 h-11 box-border appearance-none px-1 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold text-[11px] md:text-sm text-center [text-align-last:center]" />
                </div>
                <div className="min-w-0">
                  <label className={`${labelCls} text-center`}>Saat *</label>
                  <input required type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full min-w-0 h-11 box-border appearance-none px-1 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold text-[11px] md:text-sm text-center [text-align-last:center]" />
                </div>
                <div className="min-w-0">
                  <label className={`${labelCls} text-center`}>İşlem Süresi *</label>
                  <select name="durationDays" value={formData.durationDays || '1'} onChange={handleInputChange} className="w-full min-w-0 h-11 box-border px-1 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-bold text-[11px] md:text-sm text-center [text-align-last:center]">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d} Gün</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== FİNANS VE OPERASYON NOTLARI ==================== */}
          {/* NOT: Bu bölüm, ekran görüntülerindeki akışa uygun şekilde müşteri bilgilerinin hemen altına taşındı */}
          <div className="bg-neutral-50 p-3 md:p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <SectionHeader icon={Wallet} title="Finans ve Operasyon Notları" />
            <div className="space-y-4">
              {/* SATIR 1: Anlaşılan Fiyat + Alınan Kapora (mobilde de yan yana) */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Anlaşılan Fiyat (TL)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} className={`${inputCls} font-bold`} />
                </div>
                <div>
                  <label className={labelCls}>Alınan Kapora (TL)</label>
                  <input type="number" name="deposit" value={formData.deposit} onChange={handleInputChange} className={`${inputCls} font-bold text-green-600`} />
                </div>
              </div>
              {/* SATIR 2: Sözleşme Detayı + Operasyon Notları (mobilde de yan yana) */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Sözleşme Detayı</label>
                  <textarea name="contractDetails" value={formData.contractDetails || ''} onChange={handleInputChange} className={`${inputCls} h-20 resize-none`} />
                </div>
                <div>
                  <label className={labelCls}>Operasyon Notları</label>
                  <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} className={`${inputCls} h-20 resize-none`} />
                </div>
              </div>
            </div>
          </div>

          {/* ==================== YÜKLEME BİLGİLERİ (1. ADRES) ==================== */}
          <div className="bg-neutral-50 p-3 md:p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <SectionHeader 
              icon={ArrowUpRight} 
              title={type === 'Asansör' ? 'Kurulum Adresi' : 'Yükleme Bilgileri (1. Adres)'}
              rightSlot={type === 'Depo' && formData.depoDirection === 'fromDepo' ? (
                <div className="flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-100">
                  <Database className="w-4 h-4 text-red-600" />
                  <label className="text-xs font-bold text-red-700 whitespace-nowrap">Kendi Depomuzdan Çıkacak:</label>
                  <select 
                    name="selectedDepo"
                    value={formData.selectedDepo || ''} 
                    onChange={handleDepoChange}
                    className="p-1.5 border border-red-200 rounded-lg text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-red-600 text-red-700 cursor-pointer"
                  >
                    <option value="">-- Özel Adres (Seçilmedi) --</option>
                    <option value="Pendik Depoevim">Pendik Depoevim</option>
                    <option value="Kartal Depoevim">Kartal Depoevim</option>
                    <option value="Çekmeköy Depoevim">Çekmeköy Depoevim</option>
                    <option value="Ümraniye Depoevim">Ümraniye Depoevim</option>
                  </select>
                </div>
              ) : null}
            />
            <div className="space-y-4 mb-5">
                {/* SATIR 1: Daire Tipi + Kat (mobilde de yan yana) */}
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className={labelCls}>{type === 'Asansör' ? 'Kurulum Tipi' : 'Daire Tipi'}</label>
                    <select name="fromRoomCount" value={formData.fromRoomCount} onChange={handleInputChange} className={selectCls}>
                      {type === 'Asansör' ? (
                        <>
                          <option value="Yükleme Kurulum">Yükleme Kurulum</option>
                          <option value="Boşaltma Kurulum">Boşaltma Kurulum</option>
                          <option value="İnşaat Kurulum">İnşaat Kurulum</option>
                          <option value="Parça Eşya Kurulum">Parça Eşya Kurulum</option>
                        </>
                      ) : (
                        <>
                          <option value="1+0">1+0</option>
                          <option value="1+1">1+1</option>
                          <option value="2+1">2+1</option>
                          <option value="3+1">3+1</option>
                          <option value="4+1">4+1</option>
                          <option value="Ofis">Ofis</option>
                          <option value="Villa">Villa</option>
                          <option value="Parça Eşya">Parça Eşya</option>
                          <option value="Depoevim Tesisleri">Depoevim Tesisleri</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Kat</label>
                    <select name="fromFloor" value={formData.fromFloor} onChange={handleInputChange} className={selectCls}>
                      {type === 'Asansör' 
                        ? Array.from({ length: 20 }, (_, i) => `${i + 1}. Kat`).map(f => <option key={`from-${f}`} value={f}>{f}</option>)
                        : FLOORS.map(f => <option key={`from-${f}`} value={f}>{f}</option>)
                      }
                    </select>
                  </div>
                </div>

                {/* SATIR 2: Taşıma Şekli + Yükleme Mesafesi + Eşya Durumu — 3 eşit sütun, küçültülmüş ve hizalı, taşmasız */}
                {/* items-end: farklı satır sayısındaki etiketlerde kutular alttan hizalanır. min-w-0: taşmayı engeller */}
                <div className={`grid ${type === 'Asansör' ? 'grid-cols-2' : 'grid-cols-3'} gap-2 items-end`}>
                  {type !== 'Asansör' && (
                    <div className="min-w-0">
                      <label className={labelCls}>Taşıma Şekli</label>
                      <select name="fromTransportMethod" value={formData.fromTransportMethod || 'Merdiven'} onChange={handleInputChange} className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600 text-xs md:text-sm">
                        <option value="Bina Asansörü">Bina Asansörü</option>
                        <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                        <option value="Merdiven">Merdiven</option>
                      </select>
                    </div>
                  )}
                  <div className="min-w-0">
                    <label className={labelCls}>{type === 'Asansör' ? 'Kurulum Açısı' : 'Yükleme Mesafesi'}</label>
                    <div className="flex gap-1">
                      {/* Sayı kutusu: 3 hane tam gözükecek genişlikte (min-w) */}
                      <input type="number" name="fromDistance" value={formData.fromDistance} onChange={handleInputChange} placeholder="20" className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-xs md:text-sm" />
                      {/* Birim kutusu: kapalıyken kısa (M / A), listede tam açıklama görünür */}
                      <select name="fromDistanceUnit" value={formData.fromDistanceUnit} onChange={handleInputChange} className="w-11 shrink-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-xs md:text-sm text-center">
                        <option value="Metre">M</option>
                        <option value="Adım">A</option>
                      </select>
                    </div>
                  </div>
                  <div className="min-w-0 relative">
                    <label className={labelCls}>{type === 'Asansör' ? 'Kime Kurulacak' : 'Eşya Durumu'}</label>
                    {type === 'Asansör' ? (
                      <select name="fromPacking" value={formData.fromPacking || 'Kendi İşimiz'} onChange={handleInputChange} className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white text-xs md:text-sm">
                        <option value="Kendi İşimiz">Kendi İşimiz</option>
                        <option value="Dışarıya Kiralama">Dışarıya Kiralama</option>
                      </select>
                    ) : (
                      <>
                        {/* YENİ: EŞYA DURUMU — Teslim Durumu ile aynı çoklu seçim açılır penceresi. Varsayılan: Kendisi Topladı */}
                        <button
                          type="button"
                          onClick={() => setEsyaOpen(o => !o)}
                          className={`w-full min-w-0 p-2 border rounded-xl outline-none bg-white text-xs md:text-sm text-left flex items-center justify-between gap-1 transition ${selectedEsya.length > 0 ? 'border-red-400 text-red-600 font-bold ring-1 ring-red-200' : 'border-neutral-300 text-neutral-700'}`}
                        >
                          {/* Kutuda: hiç seçim yoksa "Kendisi Topladı" (varsayılan), 1 seçimde adı, 2+ seçimde sayı */}
                          <span className="truncate">{selectedEsya.length === 0 ? 'Kendisi Topladı' : (selectedEsya.length === 1 ? selectedEsya[0] : `${selectedEsya.length} işlem seçildi`)}</span>
                          <span className="text-neutral-400 shrink-0">▾</span>
                        </button>
                        {esyaOpen && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setEsyaOpen(false)}></div>
                            <div className="absolute z-30 mt-1 right-0 w-56 bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1 max-h-64 overflow-y-auto custom-scrollbar">
                              {ESYA_OPTIONS.map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleEsya(opt)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 ${selectedEsya.includes(opt) ? 'bg-red-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                                >
                                  {opt}
                                  {selectedEsya.includes(opt) && <span>✓</span>}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                <div className="col-span-1">
                  <label className={labelCls}>İl *</label>
                  <select required name="fromProvince" value={formData.fromProvince} onChange={(e) => handleProvinceChange(e, 'from')} className={selectCls}>
                    <option value="">İl Seçiniz</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className={labelCls}>İlçe *</label>
                  <input required type="text" name="fromDistrict" value={formData.fromDistrict} onChange={handleInputChange} placeholder="İlçe giriniz" className={inputCls} />
                </div>
            </div>
            <div>
                <label className={labelCls}>Açık Adres Bilgileri</label>
                <textarea name="fromAddress" value={formData.fromAddress} onChange={handleInputChange} className={`${inputCls} h-16 resize-none`} placeholder="Mahalle, sokak, bina no vb." />
            </div>

            {/* EKSTRA YÜKLEME ADRESLERİ */}
            {formData.extraLoadingAddresses?.map((addr, index) => (
              <div key={addr.id} className="mt-8 pt-6 border-t-2 border-neutral-200 border-dashed relative">
                <button 
                  type="button" 
                  onClick={() => {
                    setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.filter(a => a.id !== addr.id) }));
                  }} 
                  className="absolute -top-4 right-0 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-bold flex items-center gap-1 border border-red-100 shadow-sm"
                >
                  <X className="w-3.5 h-3.5"/> Adresi Kaldır
                </button>
                <h4 className="font-black text-neutral-700 mb-4 flex items-center gap-2 text-md uppercase tracking-wide">
                  {index + 2}. {type === 'Asansör' ? 'Kurulum Adresi' : 'Yükleme Adresi'}
                </h4>
                <div className="space-y-4 mb-5">
                  {/* SATIR 1: Daire Tipi + Kat */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className={labelCls}>{type === 'Asansör' ? 'Kurulum Tipi' : 'Daire Tipi'}</label>
                      <select 
                        value={addr.roomCount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, roomCount: e.target.value } : a) }))} 
                        className={selectCls}
                      >
                        {type === 'Asansör' ? (
                          <>
                            <option value="Yükleme Kurulum">Yükleme Kurulum</option>
                            <option value="Boşaltma Kurulum">Boşaltma Kurulum</option>
                            <option value="İnşaat Kurulum">İnşaat Kurulum</option>
                            <option value="Parça Eşya Kurulum">Parça Eşya Kurulum</option>
                          </>
                        ) : (
                          <>
                            <option value="1+0">1+0</option>
                            <option value="1+1">1+1</option>
                            <option value="2+1">2+1</option>
                            <option value="3+1">3+1</option>
                            <option value="4+1">4+1</option>
                            <option value="Ofis">Ofis</option>
                            <option value="Villa">Villa</option>
                            <option value="Parça Eşya">Parça Eşya</option>
                            <option value="Depoevim Tesisleri">Depoevim Tesisleri</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Kat</label>
                      <select 
                        value={addr.floor} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, floor: e.target.value } : a) }))} 
                        className={selectCls}
                      >
                        {type === 'Asansör' 
                          ? Array.from({ length: 20 }, (_, i) => `${i + 1}. Kat`).map(f => <option key={`ext-from-${f}`} value={f}>{f}</option>)
                          : FLOORS.map(f => <option key={`ext-from-${f}`} value={f}>{f}</option>)
                        }
                      </select>
                    </div>
                  </div>
                  {/* SATIR 2: Taşıma Şekli + Mesafe + Eşya Durumu — 3 eşit sütun, hizalı, taşmasız */}
                  <div className={`grid ${type === 'Asansör' ? 'grid-cols-2' : 'grid-cols-3'} gap-2 items-end`}>
                    {type !== 'Asansör' && (
                      <div className="min-w-0">
                        <label className={labelCls}>Taşıma Şekli</label>
                        <select 
                          value={addr.transportMethod} 
                          onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, transportMethod: e.target.value } : a) }))} 
                          className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600 text-xs md:text-sm"
                        >
                          <option value="Bina Asansörü">Bina Asansörü</option>
                          <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                          <option value="Merdiven">Merdiven</option>
                        </select>
                      </div>
                    )}
                    <div className="min-w-0">
                      <label className={labelCls}>{type === 'Asansör' ? 'Kurulum Açısı' : 'Yükleme Mesafesi'}</label>
                      <div className="flex gap-1">
                        <input 
                          type="number" 
                          value={addr.distance} 
                          onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, distance: e.target.value } : a) }))} 
                          placeholder="20" 
                          className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-xs md:text-sm" 
                        />
                        <select 
                          value={addr.distanceUnit} 
                          onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, distanceUnit: e.target.value } : a) }))} 
                          className="w-11 shrink-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-xs md:text-sm text-center"
                        >
                          <option value="Metre">M</option>
                          <option value="Adım">A</option>
                        </select>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className={labelCls}>{type === 'Asansör' ? 'Kime Kurulacak' : 'Eşya Durumu'}</label>
                      <select 
                        value={addr.packing} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, packing: e.target.value } : a) }))} 
                        className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white text-xs md:text-sm"
                      >
                        {type === 'Asansör' ? (
                          <>
                            <option value="Kendi İşimiz">Kendi İşimiz</option>
                            <option value="Dışarıya Kiralama">Dışarıya Kiralama</option>
                          </>
                        ) : (
                          <>
                            {ESYA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                  <div className="col-span-1">
                    <label className={labelCls}>İl</label>
                    <select 
                      value={addr.province} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, province: e.target.value, district: '' } : a) }))} 
                      className={selectCls}
                    >
                      <option value="">İl Seçiniz</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className={labelCls}>İlçe</label>
                    <input 
                      type="text"
                      value={addr.district} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, district: e.target.value } : a) }))} 
                      placeholder="İlçe giriniz"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Açık Adres Bilgileri</label>
                  <textarea 
                    value={addr.address} 
                    onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, address: e.target.value } : a) }))} 
                    className={`${inputCls} h-16 resize-none`}
                    placeholder="Mahalle, sokak, bina no vb." 
                  />
                </div>
              </div>
            ))}

            <button 
              type="button" 
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  extraLoadingAddresses: [
                    ...(prev.extraLoadingAddresses || []),
                    { id: Date.now(), province: '', district: '', floor: '1. Kat', transportMethod: 'Merdiven', packing: type === 'Asansör' ? 'Kendi İşimiz' : 'Kendisi Topladı', roomCount: type === 'Asansör' ? 'Yükleme Kurulum' : '1+0 / Parça Eşya', distance: '', distanceUnit: 'Metre', address: '' }
                  ]
                }));
              }} 
              className="mt-4 w-full py-2 border border-dashed border-neutral-300 text-neutral-500 text-sm font-bold rounded-lg hover:bg-neutral-100 hover:border-neutral-400 transition flex justify-center items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> Yeni {type === 'Asansör' ? 'Kurulum' : 'Yükleme'} Adresi Ekle
            </button>
          </div>

          {type !== 'Asansör' && (
            <>
              {/* ORTADAKİ YER DEĞİŞTİRME BUTONU */}
              {/* NOT: Bu buton, tam olarak YÜKLEME ve BOŞALTMA bölümlerinin ORTASINDA konumlanır */}
              <div className="flex justify-center items-center h-0 relative z-10">
                {/* Yönleri Değiştir: kullanıcı isteğiyle sadece simge olarak küçültüldü */}
                <button 
                  type="button" 
                  onClick={handleSwapAddresses}
                  className="bg-black text-white p-2.5 rounded-full shadow-xl border-[3px] border-white hover:bg-neutral-800 transition absolute"
                  title="Yükleme ve Boşaltma Bilgilerini Yer Değiştir"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>

              {/* ==================== BOŞALTMA BİLGİLERİ (1. ADRES) ==================== */}
              <div className="bg-neutral-50 p-3 md:p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <SectionHeader 
                  icon={MapPin} 
                  title="Boşaltma Bilgileri (1. Adres)"
                  rightSlot={type === 'Depo' && formData.depoDirection === 'toDepo' ? (
                    <div className="flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-100">
                      <Database className="w-4 h-4 text-red-600" />
                      <label className="text-xs font-bold text-red-700 whitespace-nowrap">Kendi Depomuza İndir:</label>
                      <select 
                        name="selectedDepo"
                        value={formData.selectedDepo || ''} 
                        onChange={handleDepoChange}
                        className="p-1.5 border border-red-200 rounded-lg text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-red-600 text-red-700 cursor-pointer"
                      >
                        <option value="">-- Özel Adres (Seçilmedi) --</option>
                        <option value="Pendik Depoevim">Pendik Depoevim</option>
                        <option value="Kartal Depoevim">Kartal Depoevim</option>
                        <option value="Çekmeköy Depoevim">Çekmeköy Depoevim</option>
                        <option value="Ümraniye Depoevim">Ümraniye Depoevim</option>
                      </select>
                    </div>
                  ) : null}
                />
            <div className="space-y-4 mb-5">
                {/* SATIR 1: Daire Tipi + Kat (mobilde de yan yana) */}
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className={labelCls}>Daire Tipi</label>
                    <select name="toRoomCount" value={formData.toRoomCount} onChange={handleInputChange} className={selectCls}>
                      <option value="1+0">1+0</option>
                      <option value="1+1">1+1</option>
                      <option value="2+1">2+1</option>
                      <option value="3+1">3+1</option>
                      <option value="4+1">4+1</option>
                      <option value="Ofis">Ofis</option>
                      <option value="Villa">Villa</option>
                      <option value="Parça Eşya">Parça Eşya</option>
                      <option value="Depoevim Tesisleri">Depoevim Tesisleri</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Kat</label>
                    <select name="toFloor" value={formData.toFloor} onChange={handleInputChange} className={selectCls}>
                      {FLOORS.map(f => <option key={`to-${f}`} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                {/* SATIR 2: Taşıma Şekli + Boşaltma Mesafesi + Duvar Montajı — yükleme adresindeki düzenle birebir aynı (3 eşit sütun, hizalı, taşmasız) */}
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="min-w-0">
                    <label className={labelCls}>Taşıma Şekli</label>
                    <select name="toTransportMethod" value={formData.toTransportMethod || 'Merdiven'} onChange={handleInputChange} className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600 text-xs md:text-sm">
                      <option value="Bina Asansörü">Bina Asansörü</option>
                      <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                      <option value="Merdiven">Merdiven</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Boşaltma Mesafesi</label>
                    <div className="flex gap-1">
                      <input type="number" name="toDistance" value={formData.toDistance} onChange={handleInputChange} placeholder="15" className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-xs md:text-sm" />
                      <select name="toDistanceUnit" value={formData.toDistanceUnit} onChange={handleInputChange} className="w-11 shrink-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-xs md:text-sm text-center">
                        <option value="Metre">M</option>
                        <option value="Adım">A</option>
                      </select>
                    </div>
                  </div>
                  {/* YENİ: TESLİM ŞEKLİ (eski adı Duvar Montajı) — çoklu seçim yapılabilen açılır pencere */}
                  <div className="min-w-0 relative">
                    <label className={labelCls}>Teslim Durumu</label>
                    <button
                      type="button"
                      onClick={() => setWallMountOpen(o => !o)}
                      className={`w-full min-w-0 p-2 border rounded-xl outline-none bg-white text-xs md:text-sm text-left flex items-center justify-between gap-1 transition ${selectedWallMounts.length > 0 ? 'border-red-400 text-red-600 font-bold ring-1 ring-red-200' : 'border-neutral-300 text-neutral-700'}`}
                    >
                      {/* Kutuda seçim sayısı gösterilir: hiç seçim yoksa "Yok" yazar */}
                      <span className="truncate">{selectedWallMounts.length === 0 ? 'Yok' : `${selectedWallMounts.length} işlem seçildi`}</span>
                      <span className="text-neutral-400 shrink-0">▾</span>
                    </button>
                    {wallMountOpen && (
                      <>
                        {/* Dışarıya tıklanınca pencereyi kapatan görünmez katman */}
                        <div className="fixed inset-0 z-20" onClick={() => setWallMountOpen(false)}></div>
                        <div className="absolute z-30 mt-1 right-0 w-56 bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1 max-h-64 overflow-y-auto custom-scrollbar">
                          {/* "Yok" seçeneği: tüm seçimleri temizler */}
                          <button
                            type="button"
                            onClick={() => { toggleWallMount('Yok'); setWallMountOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition ${selectedWallMounts.length === 0 ? 'bg-red-50 text-red-600' : 'text-neutral-600 hover:bg-neutral-100'}`}
                          >
                            Yok
                          </button>
                          {WALL_MOUNT_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleWallMount(opt)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 ${selectedWallMounts.includes(opt) ? 'bg-red-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                            >
                              {opt}
                              {selectedWallMounts.includes(opt) && <span>✓</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                <div className="col-span-1">
                  <label className={labelCls}>İl *</label>
                  <select required name="toProvince" value={formData.toProvince} onChange={(e) => handleProvinceChange(e, 'to')} className={selectCls}>
                    <option value="">İl Seçiniz</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className={labelCls}>İlçe *</label>
                  <input required type="text" name="toDistrict" value={formData.toDistrict} onChange={handleInputChange} placeholder="İlçe giriniz" className={inputCls} />
                </div>
            </div>
            <div>
                <label className={labelCls}>Açık Adres Bilgileri</label>
                <textarea name="toAddress" value={formData.toAddress} onChange={handleInputChange} className={`${inputCls} h-16 resize-none`} placeholder="Mahalle, sokak, bina no vb." />
            </div>

            {/* EKSTRA BOŞALTMA ADRESLERİ */}
            {formData.extraUnloadingAddresses?.map((addr, index) => (
              <div key={addr.id} className="mt-8 pt-6 border-t-2 border-neutral-200 border-dashed relative">
                <button 
                  type="button" 
                  onClick={() => {
                    setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.filter(a => a.id !== addr.id) }));
                  }} 
                  className="absolute -top-4 right-0 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-bold flex items-center gap-1 border border-red-100 shadow-sm"
                >
                  <X className="w-3.5 h-3.5"/> Adresi Kaldır
                </button>
                <h4 className="font-black text-neutral-700 mb-4 flex items-center gap-2 text-md uppercase tracking-wide">
                  {index + 2}. Boşaltma Adresi
                </h4>
                <div className="space-y-4 mb-5">
                  {/* SATIR 1: Daire Tipi + Kat */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className={labelCls}>Daire Tipi</label>
                      <select 
                        value={addr.roomCount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, roomCount: e.target.value } : a) }))} 
                        className={selectCls}
                      >
                        <option value="1+0">1+0</option>
                        <option value="1+1">1+1</option>
                        <option value="2+1">2+1</option>
                        <option value="3+1">3+1</option>
                        <option value="4+1">4+1</option>
                        <option value="Ofis">Ofis</option>
                        <option value="Villa">Villa</option>
                        <option value="Parça Eşya">Parça Eşya</option>
                        <option value="Depoevim Tesisleri">Depoevim Tesisleri</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Kat</label>
                      <select 
                        value={addr.floor} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, floor: e.target.value } : a) }))} 
                        className={selectCls}
                      >
                        {FLOORS.map(f => <option key={`ext-to-${f}`} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* SATIR 2: Taşıma Şekli + Boşaltma Mesafesi */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className={labelCls}>Taşıma Şekli</label>
                      <select 
                        value={addr.transportMethod} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, transportMethod: e.target.value } : a) }))} 
                        className={`${selectCls} font-bold text-red-600`}
                      >
                        <option value="Bina Asansörü">Bina Asansörü</option>
                        <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                        <option value="Merdiven">Merdiven</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Boşaltma Mesafesi</label>
                      <div className="flex gap-1.5 md:gap-2">
                        <input 
                          type="number" 
                          value={addr.distance} 
                          onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, distance: e.target.value } : a) }))} 
                          placeholder="15" 
                          className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-xs md:text-sm" 
                        />
                        <select 
                          value={addr.distanceUnit} 
                          onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, distanceUnit: e.target.value } : a) }))} 
                          className="w-11 shrink-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-xs md:text-sm text-center"
                        >
                          <option value="Metre">M</option>
                          <option value="Adım">A</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                  <div className="col-span-1">
                    <label className={labelCls}>İl</label>
                    <select 
                      value={addr.province} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, province: e.target.value, district: '' } : a) }))} 
                      className={selectCls}
                    >
                      <option value="">İl Seçiniz</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className={labelCls}>İlçe</label>
                    <input 
                      type="text"
                      value={addr.district} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, district: e.target.value } : a) }))} 
                      placeholder="İlçe giriniz"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Açık Adres Bilgileri</label>
                  <textarea 
                    value={addr.address} 
                    onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, address: e.target.value } : a) }))} 
                    className={`${inputCls} h-16 resize-none`}
                    placeholder="Mahalle, sokak, bina no vb." 
                  />
                </div>
              </div>
            ))}

            <button 
              type="button" 
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  extraUnloadingAddresses: [
                    ...(prev.extraUnloadingAddresses || []),
                    { id: Date.now(), province: '', district: '', floor: '1. Kat', transportMethod: 'Merdiven', packing: 'Kendisi Topladı', roomCount: '1+0 / Parça Eşya', distance: '', distanceUnit: 'Metre', address: '' }
                  ]
                }));
              }} 
              className="mt-4 w-full py-2 border border-dashed border-neutral-300 text-neutral-500 text-sm font-bold rounded-lg hover:bg-neutral-100 hover:border-neutral-400 transition flex justify-center items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> Yeni Boşaltma Adresi Ekle
            </button>
          </div>
            </>
          )}

          <button type="button" onClick={handleSaveClick} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-700 transition flex justify-center items-center gap-2 text-xl shadow-xl shadow-red-600/30">
            <PlusCircle className="w-6 h-6" /> 
            {editingJobId ? 'Kaydı Güncelle' : 'Kaydı Oluştur'}
          </button>
        </div>

        {/* ==================== YENİ: ZORUNLU ALAN UYARI PENCERESİ ==================== */}
        {/* İsim veya telefon boş bırakılıp "Kaydı Oluştur"a basılırsa bu pencere açılır ve kayıt YAPILMAZ */}
        {showValidationModal && (
          <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-black text-black mb-2">Eksik Bilgi!</h3>
                <p className="text-sm text-neutral-600 mb-5">
                  Müşteri kaydı oluşturabilmek için <b>{formData.customerType === 'Kurumsal' ? 'Şirket Ünvanı' : 'Ad Soyad'}</b> ve <b>Telefon Numarası</b> alanları zorunludur. Lütfen bu alanları doldurun.
                </p>
                <button 
                  type="button" 
                  onClick={() => setShowValidationModal(false)}
                  className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
                >
                  Tamam, Anladım
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  export const CustomerListView = ({ jobs, title, handleEditJob, onViewCari }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // YENİ: Kategori sekmesi — "Özel Müşteriler" ve "Kara Liste" artık sol menüde değil,
    // bu sayfanın en üstündeki butonlardan seçiliyor.
    const [kategori, setKategori] = useState(title === 'Özel Müşteriler' ? 'ozel' : 'tum');
    // YENİ: Sayfalama — liste 50'şerli sayfalara bölünür
    const SAYFA_BOYUTU = 50;
    const [sayfa, setSayfa] = useState(1);

    // YENİ: Kara liste bilgisi cari profillerinde tutulur; canlı dinlenir
    const [profilMap, setProfilMap] = useState({});
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'customerProfiles'), snap => {
        const m = {};
        snap.docs.forEach(d => { m[d.id] = d.data(); });
        setProfilMap(m);
      }, console.error);
      return () => unsub();
    }, []);
    // Bir işin müşterisi kara listede mi? (cari anahtarı üzerinden bakılır)
    const isKaraListe = (job) => !!profilMap[normalizeCariPhone(job.customerPhone)]?.blacklisted;

    // Seçili kategoriye göre kaynak iş listesi
    const relevantJobs =
      kategori === 'ozel' ? jobs.filter(j => j.isSpecial) :
      kategori === 'kara' ? jobs.filter(j => isKaraListe(j)) :
      jobs;

    // Müşterileri telefon numaralarına göre gruplayıp tekilleştiriyoruz
    const customersMap = new Map();
    relevantJobs.forEach(job => {
      if (!job.customerPhone) return;
      
      // Telefon numarasını standartlaştırma (Boşlukları temizle vb. gerekirse)
      const phoneKey = job.customerPhone.replace(/\s+/g, '');
      // YENİ: Cari Profili sayfasına gidebilmek için normalize edilmiş telefon anahtarı
      const cariKey = normalizeCariPhone(job.customerPhone);

      if (!customersMap.has(phoneKey)) {
        customersMap.set(phoneKey, {
            name: job.customerName,
            phone: job.customerPhone,
            cariKey,
            type: job.customerType || 'Bireysel',
            isSpecial: job.isSpecial,
            jobCount: 1,
            totalRevenue: Number(job.price) || 0,
            lastJobDate: job.date,
            latestJob: job
        });
      } else {
        const c = customersMap.get(phoneKey);
        
        // Eğer aynı numaraya farklı bir isim kaydedilmişse (örn: Ahmet Yılmaz, Ahmet Y.)
        // İsimleri birleştirebilir veya en son kaydedileni kullanabilirsiniz. 
        // Şimdilik ilk kaydedilen ismi tutuyoruz, dilersek güncelleyebiliriz.
        // c.name = job.customerName; 

        c.jobCount += 1;
        c.totalRevenue += (Number(job.price) || 0);
        if (new Date(job.date) > new Date(c.lastJobDate)) {
            c.lastJobDate = job.date;
            c.latestJob = job;
        }
        if (job.isSpecial) c.isSpecial = true;
      }
    });

    const customers = Array.from(customersMap.values())
      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery))
      .sort((a, b) => new Date(b.lastJobDate) - new Date(a.lastJobDate));

    // Arama veya kategori değişince ilk sayfaya dön; yalnızca aktif sayfa render edilir
    useEffect(() => { setSayfa(1); }, [searchQuery, kategori]);
    const pagedCustomers = customers.slice((sayfa - 1) * SAYFA_BOYUTU, sayfa * SAYFA_BOYUTU);

    // Üst kategori butonları için canlı sayaçlar (tekil müşteri sayısı)
    const tekilSayisi = (list) => new Set(list.filter(j => j.customerPhone).map(j => j.customerPhone.replace(/\s+/g, ''))).size;
    const SEKMELER = [
      { id: 'tum',  label: 'Tüm Müşteriler',  icon: Users, renk: 'bg-red-600',    sayac: tekilSayisi(jobs) },
      { id: 'ozel', label: 'Özel Müşteriler', icon: Star,  renk: 'bg-yellow-500', sayac: tekilSayisi(jobs.filter(j => j.isSpecial)) },
      { id: 'kara', label: 'Kara Liste',      icon: Ban,   renk: 'bg-black',      sayac: tekilSayisi(jobs.filter(j => isKaraListe(j))) },
    ];
    const aktifBaslik = SEKMELER.find(s => s.id === kategori)?.label || title;

    return (
      <div className="space-y-4 animate-in fade-in">
        {/* YENİ: ÜST KATEGORİ BUTONLARI — Tüm / Özel / Kara Liste */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SEKMELER.map(s => {
              const Icon = s.icon;
              const aktif = kategori === s.id;
              return (
                <button key={s.id} onClick={() => setKategori(s.id)}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-black border transition hover:scale-[1.02] ${aktif ? `${s.renk} text-white border-transparent shadow-md` : 'bg-white text-neutral-500 border-neutral-200 hover:border-red-400 hover:text-red-600'}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{s.label}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${aktif ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{s.sayac}</span>
                </button>
              );
            })}
          </div>
        </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2 shrink-0">
            <Users className="w-6 h-6 text-red-600" /> {aktifBaslik}
          </h2>
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-white border-b border-neutral-200">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Müşteri Bilgisi</th>
                <th className="p-4 font-bold">İletişim</th>
                <th className="p-4 font-bold text-center">Toplam İşlem</th>
                <th className="p-4 font-bold text-right">Toplam Hacim</th>
                <th className="p-4 font-bold">Son İşlem Tarihi</th>
                <th className="p-4 font-bold">Cari Profili</th>
                <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pagedCustomers.map((c, index) => {
                // YENİ: Bu müşteri kara listede mi? Sebebi de tooltip olarak gösterilir.
                const karaProfil = profilMap[c.cariKey];
                const kara = !!karaProfil?.blacklisted;
                return (
                <tr key={index} className={`transition ${kara ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-neutral-50'}`}>
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-2">
                      {kara
                        ? <Ban className="w-4 h-4 text-red-600 shrink-0" />
                        : (c.isSpecial && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 drop-shadow-sm shrink-0" />)}
                      <div>
                        {/* Kara listedeki müşterinin adı üstü çizili gösterilir */}
                        <span className={kara ? 'line-through decoration-red-500 decoration-2 text-neutral-500' : ''}>{c.name}</span>
                        {kara && <span className="ml-2 text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full align-middle tracking-wider">KARA LİSTE</span>}
                        <span className="block text-[10px] text-neutral-500 font-medium">{c.type} Müşteri</span>
                        {kara && karaProfil?.blacklistReason && (
                          <span className="block text-[10px] text-red-600 font-bold mt-0.5 max-w-[240px] truncate" title={karaProfil.blacklistReason}>
                            Sebep: {karaProfil.blacklistReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-neutral-600 font-medium">
                    <a href={"tel:" + c.phone} className="flex items-center gap-1.5 hover:text-red-600 transition">
                      <Phone className="w-3.5 h-3.5" /> {c.phone}
                    </a>
                  </td>
                  <td className="p-4 text-center font-bold text-neutral-700">
                    <span className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200">{c.jobCount} İşlem</span>
                  </td>
                  <td className="p-4 text-right font-black text-green-600">
                    ₺{c.totalRevenue.toLocaleString('tr-TR')}
                  </td>
                  <td className="p-4 text-neutral-600">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-neutral-400" /> {c.lastJobDate}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => onViewCari && onViewCari(c.cariKey)} className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 w-max">
                      <FolderOpen className="w-3.5 h-3.5" /> Cari Profiline Git
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleEditJob(c.latestJob)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 w-max">
                      <Edit className="w-3.5 h-3.5" /> Son İşe Git
                    </button>
                  </td>
                </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-neutral-500">
                    {kategori === 'kara'
                      ? 'Kara listeye alınmış müşteri bulunmuyor.'
                      : kategori === 'ozel'
                        ? 'Özel müşteri kaydı bulunamadı.'
                        : 'Müşteri kaydı bulunamadı.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* YENİ: Sayfalama çubuğu — 50'şerli sayfa geçişi */}
        <SayfalamaBar toplam={customers.length} sayfa={sayfa} sayfaBoyutu={SAYFA_BOYUTU} onSayfaChange={setSayfa} birim="müşteri" />
      </div>
      </div>
    );
  };

  // --- YENİ: CARİ PROFİLİ SAYFASI ---
  // Bu bileşen TAMAMEN YENİ ve EKLENTİ niteliğindedir. Ayrı bir "customers"
  // koleksiyonu oluşturulmadı; profil, aynı isim+telefon numarasına sahip
  // TÜM iş kayıtlarından (jobs) CANLI olarak türetiliyor. Bu sayede her yeni
  // iş kaydı otomatik olarak ilgili müşterinin cari profiline işliyor;
  // ayrıca büyük/küçük harf ve telefon formatı farkı gözetmeksizin aynı
  // müşteri tek bir cari profilde birleşmiş oluyor.
  export const CustomerProfileView = ({ jobs, cariKey, onBack, handleEditJob, db, appId, addSystemLog, personnelList = [], vehicles = [], currentUser }) => {
    const customerJobs = jobs
      .filter(j => normalizeCariPhone(j.customerPhone) === cariKey)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // YENİ: Bu tarihten önceki işleri geriye dönük tamamlayamayacağımız için
    // cari hesapta otomatik olarak "tamamlandı + tahsil edildi" kabul ediyoruz.
    const CARI_AUTO_COMPLETE_CUTOFF = '2026-07-05';
    const isBeforeCariCutoff = (dateStr) => !!dateStr && dateStr < CARI_AUTO_COMPLETE_CUTOFF;

    // YENİ: Manuel cari hareketleri (Borç Ekle / Tahsilat Ekle) ve kişisel bilgi düzenlemesi
    const [cariTransactions, setCariTransactions] = useState([]);
    const [profileOverride, setProfileOverride] = useState(null);
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editProfileForm, setEditProfileForm] = useState({ name: '', phone: '', altPhone: '', customerType: 'Bireysel', idNo: '' });
    const [showAddDebtModal, setShowAddDebtModal] = useState(false);
    const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
    const [manualEntryForm, setManualEntryForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    // YENİ: KARA LİSTE — müşteriyi sebebiyle birlikte kara listeye alma / düzenleme / çıkarma
    const [showBlacklistModal, setShowBlacklistModal] = useState(false);
    const [blacklistReasonInput, setBlacklistReasonInput] = useState('');
    const [showBlacklistRemoveConfirm, setShowBlacklistRemoveConfirm] = useState(false);

    useEffect(() => {
      if (!cariKey || !db) return;
      const unsub1 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'customerProfiles', cariKey), snap => {
        setProfileOverride(snap.exists() ? snap.data() : null);
      }, console.error);
      const qTrans = query(collection(db, 'artifacts', appId, 'public', 'data', 'cariTransactions'), where('cariKey', '==', cariKey));
      const unsub2 = onSnapshot(qTrans, snap => {
        setCariTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }, console.error);
      return () => { unsub1(); unsub2(); };
    }, [cariKey, db, appId]);

    if (!cariKey || customerJobs.length === 0) {
      return (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center animate-in fade-in">
          <button onClick={onBack} className="mb-4 text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Listeye Geri Dön
          </button>
          <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">Bu müşteriye ait cari profili bulunamadı.</p>
        </div>
      );
    }

    const oldestFirst = [...customerJobs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstJob = oldestFirst[0];
    const latestJob = customerJobs[0];

    // Kişisel bilgiler: eğer manuel düzenleme yapılmışsa (profileOverride) onu, yoksa iş kayıtlarından türeteni kullan
    const customerName = profileOverride?.name || latestJob.customerName;
    const customerPhone = profileOverride?.phone || latestJob.customerPhone;
    const altPhone = profileOverride?.altPhone ?? (customerJobs.find(j => j.altPhone)?.altPhone || '');
    const customerType = profileOverride?.customerType || latestJob.customerType || 'Bireysel';
    const idNo = profileOverride?.idNo ?? ((customerJobs.find(j => j.tcNo)?.tcNo) || (customerJobs.find(j => j.taxNo)?.taxNo) || '');

    // YENİ: Kendi oluşturduğumuz (otomatik) 0 TL'lik Asansör kurulum kayıtları cari hesaba dahil edilmez.
    // Sadece Nakliye, Depo ve ücretli (0 TL olmayan) Asansör işleri cari hesaba işlenir.
    const isCariExcluded = (j) => j.type === 'Asansör' && (!j.price || parseFloat(j.price) === 0);
    const cariEligibleJobs = oldestFirst.filter(j => !isCariExcluded(j));

    const isJobFullyPaid = (j) => {
      const method = j.endJobDetails?.paymentMethod;
      return j.status === 'completed' && method && !['Ödeme Yapmadı', 'Ödeme Alınmadı'].includes(method);
    };

    // --- Ödeme / Cari Hesap Özeti (Depoevim tarzı) ---
    const rawEntries = [];
    cariEligibleJobs.forEach(j => {
      const price = parseFloat(j.price) || 0;
      const deposit = parseFloat(j.deposit) || 0;
      // YENİ: Cutoff tarihinden önceki işler otomatik olarak tamamlanmış + tahsil edilmiş kabul edilir
      const forcedComplete = isBeforeCariCutoff(j.date);
      const fullyPaid = forcedComplete || isJobFullyPaid(j);
      const paidAmount = fullyPaid ? price : deposit;

      if (price > 0) rawEntries.push({ date: j.date, desc: `${j.type || 'Nakliye'} İşlemi - ${j.customerName}`, debt: price, credit: 0 });
      if (paidAmount > 0) rawEntries.push({ date: j.date, desc: fullyPaid ? 'Tahsilat (İş Tamamlandı)' : 'Kapora Tahsilatı', debt: 0, credit: paidAmount });
    });
    // YENİ: Manuel eklenen borç/tahsilat kayıtlarını da hesap dökümüne dahil et
    cariTransactions.forEach(t => {
      rawEntries.push({
        date: t.date,
        desc: t.description || (t.type === 'debt' ? 'Manuel Borç Kaydı' : 'Manuel Tahsilat'),
        debt: t.type === 'debt' ? (parseFloat(t.amount) || 0) : 0,
        credit: t.type === 'payment' ? (parseFloat(t.amount) || 0) : 0
      });
    });
    rawEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const ledgerRows = rawEntries.map((e, idx) => {
      runningBalance += e.debt - e.credit;
      return { id: idx, ...e, balance: runningBalance };
    });
    const totalAmount = rawEntries.reduce((s, e) => s + e.debt, 0);
    const totalPaid = rawEntries.reduce((s, e) => s + e.credit, 0);
    const remainingBalance = totalAmount - totalPaid;

    const handleSaveProfileEdit = async (e) => {
      e.preventDefault();
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customerProfiles', cariKey), {
        ...editProfileForm,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (addSystemLog) addSystemLog('Cari Profil Düzenlendi', `${editProfileForm.name} müşterisinin cari profil bilgileri güncellendi.`);
      setShowEditProfileModal(false);
    };

    // YENİ: KARA LİSTE DURUMU — customerProfiles dokümanında saklanır
    const isBlacklisted = !!profileOverride?.blacklisted;
    const blacklistReason = profileOverride?.blacklistReason || '';
    const blacklistedBy = profileOverride?.blacklistedBy || '';
    const blacklistedAt = profileOverride?.blacklistedAt || '';

    // Müşteriyi kara listeye al veya mevcut sebebi güncelle
    const handleSaveBlacklist = async (e) => {
      e.preventDefault();
      if (!blacklistReasonInput.trim()) return;
      const yeniKayit = !isBlacklisted; // ilk kez mi ekleniyor
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customerProfiles', cariKey), {
        blacklisted: true,
        blacklistReason: blacklistReasonInput.trim(),
        blacklistedBy: yeniKayit ? (currentUser?.fullName || 'Sistem') : (blacklistedBy || currentUser?.fullName || 'Sistem'),
        blacklistedAt: yeniKayit ? new Date().toISOString() : (blacklistedAt || new Date().toISOString()),
        blacklistUpdatedBy: currentUser?.fullName || 'Sistem',
        blacklistUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (addSystemLog) addSystemLog(yeniKayit ? 'Müşteri Kara Listeye Alındı' : 'Kara Liste Sebebi Güncellendi', `${customerName} (${customerPhone}) — Sebep: ${blacklistReasonInput.trim()}`);
      setShowBlacklistModal(false);
    };

    // Müşteriyi kara listeden çıkar (sebep kaydı geçmiş için saklanır)
    const handleRemoveBlacklist = async () => {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customerProfiles', cariKey), {
        blacklisted: false,
        blacklistRemovedBy: currentUser?.fullName || 'Sistem',
        blacklistRemovedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (addSystemLog) addSystemLog('Müşteri Kara Listeden Çıkarıldı', `${customerName} (${customerPhone}) kara listeden çıkarıldı.`);
      setShowBlacklistRemoveConfirm(false);
    };

    const handleAddManualEntry = async (e, type) => {
      e.preventDefault();
      if (!manualEntryForm.amount) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cariTransactions'), {
        cariKey,
        type,
        amount: parseFloat(manualEntryForm.amount) || 0,
        description: manualEntryForm.description,
        date: manualEntryForm.date,
        createdAt: new Date().toISOString()
      });
      if (addSystemLog) addSystemLog(type === 'debt' ? 'Cari Borç Eklendi' : 'Cari Tahsilat Eklendi', `${customerName} carisine ${manualEntryForm.amount} TL ${type === 'debt' ? 'borç' : 'tahsilat'} kaydı eklendi.`);
      setManualEntryForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowAddDebtModal(false);
      setShowAddPaymentModal(false);
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-8">
        <button onClick={onBack} className="text-sm font-bold text-neutral-500 hover:text-black transition flex items-center gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Listeye Geri Dön
        </button>

        {/* Kişisel Bilgiler */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 ${isBlacklisted ? 'border-red-300 ring-1 ring-red-100' : 'border-neutral-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-neutral-200 pb-4">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              <Users className="w-6 h-6 text-red-600" /> Cari Hesap Profili
            </h2>
            {/* YENİ: SAĞ ÜST KARA LİSTE BUTONU */}
            {isBlacklisted ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setBlacklistReasonInput(blacklistReason); setShowBlacklistModal(true); }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-black rounded-xl transition flex items-center gap-1.5 border border-red-200">
                  <Edit className="w-3.5 h-3.5" /> Sebebi Düzenle
                </button>
                <button type="button" onClick={() => setShowBlacklistRemoveConfirm(true)}
                  className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-black rounded-xl transition flex items-center gap-1.5 border border-green-200">
                  <CheckCircle className="w-3.5 h-3.5" /> Kara Listeden Çıkar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => { setBlacklistReasonInput(''); setShowBlacklistModal(true); }}
                className="px-4 py-2 bg-black hover:bg-red-700 text-white text-xs font-black rounded-xl transition flex items-center gap-2 shadow-sm">
                <Ban className="w-4 h-4" /> Kara Listeye Al
              </button>
            )}
          </div>

          {/* YENİ: KARA LİSTE BİLDİRİM BANDI — sebep, ekleyen ve tarih görünür */}
          {isBlacklisted && (
            <div className="mb-5 rounded-xl border-2 border-red-300 bg-red-50 p-4 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-red-700 flex items-center gap-2">
                    BU MÜŞTERİ KARA LİSTEDE
                    <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">DİKKAT</span>
                  </p>
                  <p className="text-sm font-bold text-red-900 mt-1.5 whitespace-pre-wrap">{blacklistReason || 'Sebep belirtilmemiş.'}</p>
                  <p className="text-[11px] font-bold text-red-500 mt-2">
                    {blacklistedBy ? `Ekleyen: ${blacklistedBy}` : ''}
                    {blacklistedAt ? ` • ${new Date(blacklistedAt).toLocaleString('tr-TR')}` : ''}
                    {profileOverride?.blacklistUpdatedAt && profileOverride.blacklistUpdatedAt !== blacklistedAt
                      ? ` • Son güncelleme: ${profileOverride.blacklistUpdatedBy || '—'} (${new Date(profileOverride.blacklistUpdatedAt).toLocaleString('tr-TR')})`
                      : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mb-5">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shrink-0 ${isBlacklisted ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-black flex items-center gap-2 flex-wrap">
                {/* Kara listedeki müşterinin adı üstü çizili gösterilir */}
                <span className={isBlacklisted ? 'line-through decoration-red-500 decoration-2 text-neutral-500' : ''}>{customerName}</span>
                {isBlacklisted && <span className="text-[10px] font-black bg-red-600 text-white px-2 py-1 rounded-full tracking-wider">KARA LİSTE</span>}
                {latestJob.isSpecial && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                {/* YENİ: İsmin yanına düzenleme butonu */}
                <button
                  type="button"
                  onClick={() => { setEditProfileForm({ name: customerName, phone: customerPhone, altPhone: altPhone, customerType: customerType, idNo: idNo }); setShowEditProfileModal(true); }}
                  className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition"
                  title="Cari Profilini Düzenle"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </h3>
              <p className="text-neutral-500 text-sm font-medium">İlk Kayıt: {firstJob.date}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <a href={`tel:${(customerPhone || '').replace(/\D/g, '')}`} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-sm font-bold rounded-xl transition flex items-center gap-2">
              <Phone className="w-4 h-4" /> Ara
            </a>
            <a
              href={`https://wa.me/${(() => { let p = (customerPhone || '').replace(/\D/g, ''); if (p.startsWith('0')) p = '90' + p.substring(1); else if (!p.startsWith('90')) p = '90' + p; return p; })()}`}
              target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-bold rounded-xl transition flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Telefon</span>
              <p className="font-bold text-black text-sm">{customerPhone}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Yedek Telefon</span>
              <p className="font-bold text-black text-sm">{altPhone || '-'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Müşteri Tipi</span>
              <p className="font-bold text-black text-sm">{customerType}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">{customerType === 'Kurumsal' ? 'Vergi No' : 'TC Kimlik No'}</span>
              <p className="font-bold text-black text-sm">{idNo || '-'}</p>
            </div>
          </div>
        </div>

        {/* Ödeme Bilgileri (Depoevim tarzı Cari Hesap Dökümü) */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-lg text-black flex items-center gap-2">
              <Wallet className="w-6 h-6 text-green-600" /> Cari Hesap / Ödeme Bilgileri
            </h3>
            {/* YENİ: Manuel Borç Ekle / Tahsilat Ekle butonları */}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setManualEntryForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] }); setShowAddDebtModal(true); }} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Borç Ekle
              </button>
              <button type="button" onClick={() => { setManualEntryForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] }); setShowAddPaymentModal(true); }} className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Tahsilat Ekle
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <span className="text-xs font-bold text-neutral-500 block mb-1">Toplam Anlaşma Tutarı</span>
              <span className="text-xl font-black text-black">₺{totalAmount.toLocaleString('tr-TR')}</span>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <span className="text-xs font-bold text-green-700 block mb-1">Toplam Tahsilat</span>
              <span className="text-xl font-black text-green-700">₺{totalPaid.toLocaleString('tr-TR')}</span>
            </div>
            <div className={`p-4 rounded-xl border ${remainingBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'}`}>
              <span className={`text-xs font-bold block mb-1 ${remainingBalance > 0 ? 'text-red-700' : 'text-neutral-500'}`}>Kalan Bakiye</span>
              <span className={`text-xl font-black ${remainingBalance > 0 ? 'text-red-700' : 'text-black'}`}>₺{remainingBalance.toLocaleString('tr-TR')}</span>
            </div>
          </div>

          <h4 className="font-bold text-sm text-neutral-600 mb-2 flex items-center gap-1.5"><History className="w-4 h-4" /> Detaylı Hesap Dökümü (Ekstre)</h4>
          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="p-3 font-bold">Tarih</th>
                  <th className="p-3 font-bold">İşlem Açıklaması</th>
                  <th className="p-3 font-bold text-right">Borç</th>
                  <th className="p-3 font-bold text-right">Tahsilat</th>
                  <th className="p-3 font-bold text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ledgerRows.map(row => (
                  <tr key={row.id} className="hover:bg-neutral-50 transition">
                    <td className="p-3 font-medium text-black whitespace-nowrap">{row.date}</td>
                    <td className="p-3 text-neutral-600">{row.desc}</td>
                    <td className="p-3 text-right font-bold text-red-600">{row.debt > 0 ? `₺${row.debt.toLocaleString('tr-TR')}` : '-'}</td>
                    <td className="p-3 text-right font-bold text-green-600">{row.credit > 0 ? `₺${row.credit.toLocaleString('tr-TR')}` : '-'}</td>
                    <td className="p-3 text-right font-black text-black">₺{row.balance.toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
                {ledgerRows.length === 0 && (
                  <tr><td colSpan="5" className="p-4 text-center text-neutral-400">Herhangi bir mali hareket bulunmuyor.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Müşterinin Yaptığı İşler */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="font-bold text-lg text-black mb-4 flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2"><ClipboardList className="w-6 h-6 text-blue-500" /> Yaptığı İşler</span>
            <span className="text-xs bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200 font-bold text-neutral-500">{customerJobs.length} kayıt</span>
          </h3>
          <div className="space-y-3">
            {customerJobs.map(job => {
              // YENİ: Cutoff tarihinden önceki işler cari amaçlı "Tamamlandı" olarak gösterilir
              const forcedComplete = isBeforeCariCutoff(job.date);
              const statusLabel = forcedComplete
                ? 'Tamamlandı (Otomatik)'
                : (job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : job.status === 'cancelled' ? 'İptal Edildi' : 'Bekliyor');

              // YENİ: İşin detay bilgilerini derle (araç, ekip, kaydı açan)
              const teamNames = (job.teamNames && job.teamNames.length > 0)
                ? job.teamNames
                : (job.assignedPersonnelIds || []).map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
              const vehiclePlate = job.assignedVehiclePlate || '';
              const vehicleInfo = vehiclePlate ? vehicles.find(v => v.plate === vehiclePlate) : null;
              const creator = job.createdBy || job.creatorName || job.salesPerson || '';

              return (
                <div key={job.id} className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl shadow-sm transition hover:border-blue-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase tracking-wider shrink-0 ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                        {job.type || 'Nakliye'}
                      </span>
                      <div>
                        <span className="font-bold text-black text-sm block">{job.date} {job.time ? `- ${job.time}` : ''}</span>
                        <span className={`text-[10px] font-bold uppercase ${forcedComplete || job.status === 'completed' ? 'text-black' : job.status === 'in-progress' ? 'text-red-600' : job.status === 'cancelled' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          {statusLabel}
                          {isCariExcluded(job) && <span className="ml-1.5 text-neutral-400 normal-case font-medium">(Cari hesaba dahil değil)</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {job.price ? <span className="font-black text-green-600 text-sm">₺{parseInt(job.price).toLocaleString('tr-TR')}</span> : null}
                      <button onClick={() => generateContractPDF(job)} className="px-3 py-2 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition flex items-center gap-1.5 whitespace-nowrap">
                        <FileText className="w-3.5 h-3.5" /> Sözleşmeyi İndir
                      </button>
                      <button onClick={() => handleEditJob(job)} className="px-3 py-2 bg-white border border-neutral-200 text-neutral-600 text-xs font-bold rounded-lg hover:bg-neutral-100 transition flex items-center gap-1.5 whitespace-nowrap">
                        İşe Git <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* YENİ: İşin detay kart bilgileri (araç, ekip, kaydı açan, güzergah) */}
                  <div className="mt-3 pt-3 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <Truck className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-neutral-400 font-bold uppercase text-[9px] block">Giden Araç</span>
                        <span className="font-bold text-black">{vehiclePlate ? `${vehiclePlate}${vehicleInfo ? ` (${vehicleInfo.type})` : ''}` : 'Atanmadı'}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-neutral-400 font-bold uppercase text-[9px] block">Giden Ekip</span>
                        <span className="font-bold text-black">{teamNames.length > 0 ? teamNames.join(', ') : 'Atanmadı'}</span>
                      </div>
                    </div>
                    {creator && (
                      <div className="flex items-start gap-2">
                        <UserPlus className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 font-bold uppercase text-[9px] block">Kaydı Açan</span>
                          <span className="font-bold text-black">{creator}</span>
                        </div>
                      </div>
                    )}
                    {(job.fromDistrict || job.toDistrict) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 font-bold uppercase text-[9px] block">Güzergah</span>
                          <span className="font-bold text-black">{job.fromDistrict || '?'} → {job.toDistrict || '?'}</span>
                        </div>
                      </div>
                    )}
                    {job.endJobDetails?.paymentMethod && (
                      <div className="flex items-start gap-2">
                        <Wallet className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 font-bold uppercase text-[9px] block">Ödeme Yöntemi</span>
                          <span className="font-bold text-black">{job.endJobDetails.paymentMethod}</span>
                        </div>
                      </div>
                    )}
                    {job.roomCount && (
                      <div className="flex items-start gap-2">
                        <Package className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 font-bold uppercase text-[9px] block">Ev / Hacim</span>
                          <span className="font-bold text-black">{job.roomCount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* YENİ: KARA LİSTEYE ALMA / SEBEP DÜZENLEME MODALI */}
        {showBlacklistModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-red-700 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Ban className="w-5 h-5" /> {isBlacklisted ? 'Kara Liste Sebebini Düzenle' : 'Müşteriyi Kara Listeye Al'}</h3>
                <button onClick={() => setShowBlacklistModal(false)} className="text-red-200 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSaveBlacklist} className="p-6 space-y-4">
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-neutral-400 uppercase">Müşteri</p>
                  <p className="text-sm font-black text-black">{customerName}</p>
                  <p className="text-xs font-bold text-neutral-500">{customerPhone}</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Kara Liste Sebebi *</label>
                  <textarea required value={blacklistReasonInput} onChange={e => setBlacklistReasonInput(e.target.value)}
                    className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 h-28 resize-none text-sm"
                    placeholder="Örn: Ödemesini yapmadı ve iletişimi kesti / Ekibimize hakaret etti / Sürekli asılsız hasar iddiası..." />
                  <p className="text-[11px] text-neutral-400 font-bold mt-1.5">Bu sebep cari profilinde ve kara liste ekranında görünecektir.</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowBlacklistModal(false)} className="flex-1 py-3 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
                  <button type="submit" disabled={!blacklistReasonInput.trim()} className="flex-1 py-3 bg-red-700 text-white font-black rounded-xl hover:bg-red-800 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    {isBlacklisted ? 'Sebebi Güncelle' : 'Onayla ve Kara Listeye Al'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* YENİ: KARA LİSTEDEN ÇIKARMA ONAY MODALI */}
        {showBlacklistRemoveConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700 mb-1"><b>{customerName}</b> kara listeden çıkarılacak.</p>
              <p className="text-xs text-neutral-400 font-bold mb-4">Müşteri tekrar normal listede görünecek.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowBlacklistRemoveConfirm(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl text-sm">Vazgeç</button>
                <button onClick={handleRemoveBlacklist} className="flex-1 py-2.5 bg-green-600 text-white font-black rounded-xl text-sm hover:bg-green-700">Evet, Çıkar</button>
              </div>
            </div>
          </div>
        )}

        {/* YENİ: Cari Profil Düzenleme Modalı */}
        {showEditProfileModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-black text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Edit className="w-5 h-5" /> Cari Profilini Düzenle</h3>
                <button onClick={() => setShowEditProfileModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSaveProfileEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Ad Soyad</label>
                  <input required type="text" value={editProfileForm.name} onChange={e => setEditProfileForm({ ...editProfileForm, name: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Telefon</label>
                  <input required type="text" value={editProfileForm.phone} onChange={e => setEditProfileForm({ ...editProfileForm, phone: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Yedek Telefon</label>
                  <input type="text" value={editProfileForm.altPhone} onChange={e => setEditProfileForm({ ...editProfileForm, altPhone: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Müşteri Tipi</label>
                  <select value={editProfileForm.customerType} onChange={e => setEditProfileForm({ ...editProfileForm, customerType: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white focus:ring-2 focus:ring-red-600">
                    <option value="Bireysel">Bireysel</option>
                    <option value="Kurumsal">Kurumsal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">{editProfileForm.customerType === 'Kurumsal' ? 'Vergi No' : 'TC Kimlik No'}</label>
                  <input type="text" value={editProfileForm.idNo} onChange={e => setEditProfileForm({ ...editProfileForm, idNo: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                  <Save className="w-5 h-5" /> Kaydet
                </button>
              </form>
            </div>
          </div>
        )}

        {/* YENİ: Manuel Borç Ekle Modalı */}
        {showAddDebtModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-red-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg">Manuel Borç Ekle</h3>
                <button onClick={() => setShowAddDebtModal(false)} className="text-red-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={(e) => handleAddManualEntry(e, 'debt')} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tutar (TL)</label>
                  <input required type="number" value={manualEntryForm.amount} onChange={e => setManualEntryForm({ ...manualEntryForm, amount: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Açıklama</label>
                  <input type="text" value={manualEntryForm.description} onChange={e => setManualEntryForm({ ...manualEntryForm, description: e.target.value })} placeholder="Örn: Ek hizmet bedeli" className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                  <input required type="date" value={manualEntryForm.date} onChange={e => setManualEntryForm({ ...manualEntryForm, date: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                  <PlusCircle className="w-5 h-5" /> Borcu Ekle
                </button>
              </form>
            </div>
          </div>
        )}

        {/* YENİ: Manuel Tahsilat Ekle Modalı */}
        {showAddPaymentModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-green-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg">Manuel Tahsilat Ekle</h3>
                <button onClick={() => setShowAddPaymentModal(false)} className="text-green-100 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={(e) => handleAddManualEntry(e, 'payment')} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tutar (TL)</label>
                  <input required type="number" value={manualEntryForm.amount} onChange={e => setManualEntryForm({ ...manualEntryForm, amount: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Açıklama</label>
                  <input type="text" value={manualEntryForm.description} onChange={e => setManualEntryForm({ ...manualEntryForm, description: e.target.value })} placeholder="Örn: Nakit tahsilat" className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-1">Tarih</label>
                  <input required type="date" value={manualEntryForm.date} onChange={e => setManualEntryForm({ ...manualEntryForm, date: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <button type="submit" className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                  <PlusCircle className="w-5 h-5" /> Tahsilatı Ekle
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // YENİ: ESKİ SİSTEMDEN VERİ AKTARIMI (semboln_db.sql → CRM)
  // Eski uygulamanın phpMyAdmin SQL yedeğini okuyup iş + müşteri kayıtlarını
  // yeni sisteme aktarır. Kurallar:
  //  - 'orders' (işler) ve 'transfers' (yükleme/boşaltma detayları) tabloları okunur.
  //    Depo KİRALAMA tabloları (rents/users/stores) HİÇ okunmaz → o 346 kayıt yok sayılır.
  //  - Ad Soyad → customerName, Telefon → customerPhone, TC → tcNo,
  //    Tarih+Saat → date+time, Toplam Tutar → price, Kapora → deposit,
  //    Ek Açıklama → notes (Operasyon Notları).
  //  - Adres → açık adres alanına yazılır; metinde il/ilçe tespit edilirse seçilir,
  //    edilemezse il/ilçe BOŞ bırakılır.
  //  - Kat → 'n. Kat' (0=Giriş Kat); Taşıma Şekli: dış asansör varsa 'Dış Cephe
  //    Asansörü', bina asansörü varsa 'Bina Asansörü', yoksa 'Merdiven'.
  //  - Toplanacak eşya varsa 'Toplama Yapılacak', yoksa 'Kendisi Topladı'.
  //  - Adreste 'Depoevim' geçiyorsa kayıt DEPO formatında açılır; şube adı
  //    (Çekmeköy/Kartal/Ümraniye) geçiyorsa o şube, geçmiyorsa Pendik seçilir.
  //  - complate/wait/work → tamamlanmış; canceled → iptal olarak aktarılır.
  //    Ekip/personel BOŞ bırakılır; puan ve mesai otomatik ONAYLI işaretlenir,
  //    stok düşümü yapılmaz (materialsDeducted: true).
  //  - 'deneme/test/asdf' gibi çöp kayıtlar atlanır. Aynı kayıt (legacyId)
  //    ikinci kez aktarılmaz. Aynı isim+telefon zaten aynı cari profilde birleşir.
  //  - Her aktarım bir parti (batch) olarak kaydedilir; SON AKTARIM tek tuşla
  //    GERİ ALINABİLİR (eklenen tüm kayıtlar silinir, hiç yüklenmemiş gibi olur).
  // ============================================================================
  export const EskiVeriIceAktar = ({ jobs = [], currentUser, addSystemLog, onClose }) => {
    const [asama, setAsama] = useState('dosya'); // dosya | onizleme | aktariliyor | bitti
    const [hata, setHata] = useState('');
    const [ozet, setOzet] = useState(null);        // önizleme özeti
    const [hazirKayitlar, setHazirKayitlar] = useState([]); // aktarılacak yeni iş dokümanları
    const [ilerleme, setIlerleme] = useState({ yazilan: 0, toplam: 0 });
    const [sonPartiler, setSonPartiler] = useState([]);     // geçmiş aktarımlar (geri alma için)
    const [geriAliniyor, setGeriAliniyor] = useState(false);

    // Geçmiş aktarım partilerini canlı dinle (geri alma butonu için)
    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'legacyImports'), snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setSonPartiler(list);
      });
      return () => unsub();
    }, []);

    // ---------------- SQL AYRIŞTIRICI ----------------
    // Belirtilen tablonun tüm INSERT ifadelerindeki satır demetlerini döndürür.
    // Tek tırnaklı stringleri, \' ve '' kaçışlarını, NULL ve sayıları doğru çözer.
    const parseInsertRows = (sql, tablo) => {
      const rows = [];
      const marker = 'INSERT INTO `' + tablo + '`';
      let from = 0;
      while (true) {
        const idx = sql.indexOf(marker, from);
        if (idx === -1) break;
        const valIdx = sql.indexOf('VALUES', idx);
        if (valIdx === -1) break;
        let i = valIdx + 6;
        let depth = 0, inStr = false, cur = '', tuple = [], done = false;
        const pushVal = () => {
          const t = cur;
          cur = '';
          if (t === '\u0000NULL\u0000') tuple.push(null);
          else tuple.push(t);
        };
        while (i < sql.length && !done) {
          const ch = sql[i];
          if (inStr) {
            if (ch === '\\') { // backslash kaçışı: \' \\ \n vb.
              const nx = sql[i + 1];
              cur += nx === 'n' ? '\n' : nx === 'r' ? '\r' : nx === 't' ? '\t' : (nx ?? '');
              i += 2; continue;
            }
            if (ch === "'") {
              if (sql[i + 1] === "'") { cur += "'"; i += 2; continue; } // '' kaçışı
              inStr = false; i++; continue;
            }
            cur += ch; i++; continue;
          }
          if (ch === "'") { inStr = true; i++; continue; }
          if (ch === '(') { depth++; if (depth === 1) { tuple = []; cur = ''; } else cur += ch; i++; continue; }
          if (ch === ')') {
            depth--;
            if (depth === 0) { pushVal(); rows.push(tuple); } else cur += ch;
            i++; continue;
          }
          if (depth >= 1) {
            if (ch === ',' && depth === 1) { pushVal(); i++; continue; }
            cur += ch; i++; continue;
          }
          if (ch === ';') { done = true; break; }
          i++;
        }
        // NULL değerlerini işaretle: tırnaksız NULL token'ları trim edilmiş 'NULL' olarak gelir
        for (const r of rows) for (let k = 0; k < r.length; k++) {
          if (typeof r[k] === 'string' && r[k].trim() === 'NULL') r[k] = null;
          else if (typeof r[k] === 'string') r[k] = r[k].trim() === r[k] ? r[k] : r[k].trim();
        }
        from = valIdx + 6;
      }
      return rows;
    };

    // ---------------- YARDIMCI EŞLEYİCİLER ----------------
    const trLower = (s) => (s || '').toLocaleLowerCase('tr-TR');

    // Çöp/deneme kayıt tespiti
    const copKayitMi = (ad) => {
      const t = trLower(ad).trim();
      if (!t) return true;
      if (/(deneme|test\b|asdf|sdfs|dsad|qwe|zxc|xxxx|aaaa)/.test(t)) return true;
      // tek kelime + 4+ harf + hiç sesli harf yok → rastgele tuş basımı
      if (/^[bcçdfgğhjklmnprsştvzqwx]{4,}$/.test(t)) return true;
      return false;
    };

    // YENİ KURAL: İsim en az İKİ kelimeli olmalı (ad + soyad). Tek kelimelik kayıtlar atlanır.
    const isimGecerliMi = (ad) => {
      const kelimeler = String(ad || '').trim().split(/\s+/).filter(k => k.length >= 2);
      return kelimeler.length >= 2;
    };

    // YENİ KURAL: Telefon 11 haneli geçerli bir Türk cep numarası olmalı (05XXXXXXXXX).
    // 11111111111, 33333333333 gibi tek rakamdan oluşan/uydurma numaralar elenir.
    const telefonGecerliMi = (tel) => {
      let t = String(tel || '').replace(/\D/g, '');
      if (t.startsWith('90') && t.length === 12) t = '0' + t.slice(2); // +90... formatı
      if (t.length === 10 && t.startsWith('5')) t = '0' + t;           // baştaki 0 eksikse tamamla
      if (t.length !== 11) return false;            // 11 hane değilse aktarma
      if (!t.startsWith('05')) return false;        // cep numarası değilse aktarma
      if (/^(\d)\1{10}$/.test(t)) return false;     // 11111111111 gibi hepsi aynı rakam
      if (/^0(\d)\1{9}$/.test(t)) return false;     // 05555555555 gibi kalıp numara
      const govde = t.slice(1);                     // 5XXXXXXXXX
      if (new Set(govde).size <= 2) return false;   // 2 farklı rakamdan az → uydurma
      if (/^0501234567|^05123456789|^05000000/.test(t)) return false; // ardışık/sıfır kalıpları
      return true;
    };

    // Telefonu standart 11 haneli biçime çevir (05XXXXXXXXX)
    const telefonNormalize = (tel) => {
      let t = String(tel || '').replace(/\D/g, '');
      if (t.startsWith('90') && t.length === 12) t = '0' + t.slice(2);
      if (t.length === 10 && t.startsWith('5')) t = '0' + t;
      return t;
    };

    // Metni sadeleştir: küçük harf, noktalama → boşluk (kelime bazlı eşleşme için)
    const adresNorm = (s) => (s || '').toLocaleLowerCase('tr-TR')
      .replace(/i̇/g, 'i').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();

    // Tek başına il belirtmeyen, çok sayıda ilde bulunan genel adlar
    const GENEL_ILCE_ADLARI = new Set(['merkez', 'cumhuriyet', 'carsi', 'çarşı', 'sahil']);

    // İl/ilçe arama indeksi — bir kez kurulur, her adreste yeniden taranmaz.
    // (Eski sürüm her adres için 972 ilçeyi tek tek tarıyordu; 4.600 kayıtta tarayıcı donuyordu.)
    const KONUM_INDEKS = useMemo(() => {
      const ilce = new Map(), il = new Map();
      for (const [ilAdi, ilceler] of Object.entries(TURKEY_LOCATIONS)) {
        il.set(adresNorm(ilAdi.replace(/\s*\(.*\)/, '')), ilAdi);
        for (const d of ilceler) {
          for (const k of new Set([adresNorm(d), adresNorm(d).replace(/ /g, '')])) {
            if (!ilce.has(k)) ilce.set(k, []);
            if (!ilce.get(k).some(x => x.district === d && x.province === ilAdi)) ilce.get(k).push({ province: ilAdi, district: d });
          }
        }
      }
      return { ilce, il };
    }, []);

    // Adres metninden il/ilçe tespiti.
    // Türkçe adreslerde ilçe/il SONDA yazıldığı için tarama sondan başa yapılır;
    // böylece "Yenişehir mah. ... / Pendik" adresi Bursa değil, Pendik olarak eşleşir.
    // Kesin sonuç yoksa il/ilçe BOŞ bırakılır (kullanıcı kuralı).
    const ilIlceBul = (adres) => {
      const bos = { province: '', district: '' };
      if (!adres) return bos;
      const kelimeler = adresNorm(adres).split(' ').filter(Boolean);
      if (kelimeler.length === 0) return bos;

      // Adreste açıkça il adı geçiyor mu? (belirsiz ilçelerde ipucu olarak kullanılır)
      let ipucuIl = '';
      for (const k of kelimeler) { const v = KONUM_INDEKS.il.get(k); if (v) ipucuIl = v; }
      const istanbulMu = kelimeler.includes('istanbul');

      // Sondan başa, 1-3 kelimelik birleşimlerle aday ara (Küçük Çekmece, Gazi Osman Paşa gibi)
      const adaylar = [];
      for (let i = kelimeler.length - 1; i >= 0; i--) {
        for (let n = 3; n >= 1; n--) {
          if (i - n + 1 < 0) continue;
          const parca = kelimeler.slice(i - n + 1, i + 1).join(' ');
          for (const key of new Set([parca, parca.replace(/ /g, '')])) {
            const bulunan = KONUM_INDEKS.ilce.get(key);
            if (bulunan) adaylar.push({ key, secenekler: bulunan });
          }
        }
      }
      if (adaylar.length === 0) {
        if (ipucuIl && !ipucuIl.startsWith('İstanbul')) return { province: ipucuIl, district: '' };
        return bos;
      }

      for (const aday of adaylar) {
        let sec = aday.secenekler;
        if (sec.length > 1) {
          const ipucuyla = ipucuIl ? sec.filter(s => s.province === ipucuIl) : [];
          if (ipucuyla.length) sec = ipucuyla;
          else if (istanbulMu) { const ist = sec.filter(s => s.province.startsWith('İstanbul')); if (ist.length === 1) sec = ist; }
        }
        if (sec.length === 1) {
          // Genel ad (Merkez vb.) + il ipucu yoksa güvenilmez → boş bırak
          if (GENEL_ILCE_ADLARI.has(aday.key) && !ipucuIl && !istanbulMu) continue;
          return { province: sec[0].province, district: sec[0].district };
        }
        const anadolu = sec.find(s => s.province === 'İstanbul (Anadolu)');
        if (anadolu && istanbulMu) return { province: anadolu.province, district: anadolu.district };
      }
      if (ipucuIl && !ipucuIl.startsWith('İstanbul')) return { province: ipucuIl, district: '' };
      return bos;
    };

    // Kat eşlemesi: 0 → Giriş Kat, n → 'n. Kat' (1-30 arası FLOORS ile birebir)
    const katEsle = (n) => {
      const f = parseInt(n);
      if (isNaN(f)) return '';
      if (f <= 0) return 'Giriş Kat';
      return `${Math.min(f, 30)}. Kat`;
    };

    // Taşıma şekli eşlemesi (eski sistemdeki iki ayrı alan birleştirilir):
    //   nelevator = "Nakliye Asansörü" (dış cephe)  → 1: Var, 0: Yok
    //   elevator  = "Asansör" (bina asansörü)       → 2: Var, 1/0: Yok
    // Kural: Dış cephe asansörü varsa (bina asansörü olsun olmasın) 'Dış Cephe Asansörü';
    //        yoksa bina asansörü varsa 'Bina Asansörü'; ikisi de yoksa 'Merdiven'.
    const tasimaEsle = (t) => {
      if (!t) return 'Merdiven';
      if (parseInt(t.nelevator) === 1) return 'Dış Cephe Asansörü';
      if (parseInt(t.elevator) === 2) return 'Bina Asansörü';
      return 'Merdiven';
    };

    // Daire tipi eşlemesi: eski sistemde sayı (3 → "3+1"). Yeni sistemdeki
    // seçenek listesinde karşılığı yoksa BOŞ bırakılır.
    const DAIRE_TIPLERI = { 1: '1+1', 2: '2+1', 3: '3+1', 4: '4+1', 5: '5+1', 6: '6+1' };
    const daireTipiEsle = (n) => DAIRE_TIPLERI[parseInt(n)] || '';

    // Depoevim şube tespiti
    const depoSubeBul = (adres) => {
      const t = trLower(adres);
      if (t.includes('çekmeköy') || t.includes('cekmekoy')) return 'Çekmeköy Depoevim';
      if (t.includes('kartal')) return 'Kartal Depoevim';
      if (t.includes('ümraniye') || t.includes('umraniye')) return 'Ümraniye Depoevim';
      return 'Pendik Depoevim'; // sadece "depoevim" yazıyorsa varsayılan şube
    };

    // ---------------- DOSYA OKUMA + ÖNİZLEME ----------------
    const handleDosyaSec = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setHata('');
      const reader = new FileReader();
      reader.onerror = () => setHata('Dosya okunamadı.');
      reader.onload = () => {
        try { analizEt(String(reader.result)); }
        catch (err) { console.error(err); setHata('SQL dosyası ayrıştırılamadı: ' + err.message); }
      };
      reader.readAsText(file, 'utf-8');
    };

    const analizEt = (sql) => {
      // orders sütun sırası: id, name_surname, mobile, TC_kimlik, date, km, amount, final_amount,
      // status, new_control, sef_control, kasko, kapora, ekInfo, canceledNote, load_info, unload_info, ...
      const orderRows = parseInsertRows(sql, 'orders');
      // transfers sütun sırası: id, type, elevator, carry_stuff, apartment_type, floor, address, ...
      const transferRows = parseInsertRows(sql, 'transfers');
      if (orderRows.length === 0) { setHata("Dosyada 'orders' tablosu bulunamadı. Doğru yedek dosyasını seçtiğinizden emin olun."); return; }

      const transferMap = new Map();
      // transfers sütun sırası (0'dan): id, type, elevator, carry_stuff, apartment_type,
      // floor, address, kmbosaltma, kmyukleme, nelevator, createDate, created_at, updated_at
      // NOT: nelevator 9. indekstedir (10 = createDate). Bu eşleşme, eski uygulamanın
      // "Nakliye Asansörü / Asansör / Kat / Daire Tipi" ekranıyla birebir doğrulanmıştır.
      transferRows.forEach(r => transferMap.set(String(r[0]), {
        elevator: r[2], carry_stuff: r[3], apartment_type: r[4], floor: r[5], address: r[6] || '', nelevator: r[9]
      }));

      // Daha önce aktarılmış kayıtları atla (legacyId üzerinden)
      const mevcutLegacy = new Set(jobs.map(j => j.legacyId).filter(Boolean));

      const kayitlar = [];
      let atlananCop = 0, atlananMukerrer = 0, atlananBos = 0, atlananIsim = 0, atlananTelefon = 0;
      let sayacIptal = 0, sayacDepo = 0;

      for (const r of orderRows) {
        const [id, ad, tel, tc, tarihSaat, , , toplam, status, , , , kapora, ekInfo, canceledNote, loadId, unloadId] = r;
        const legacyId = 'order_' + id;
        if (mevcutLegacy.has(legacyId)) { atlananMukerrer++; continue; }
        if (!ad || !String(ad).trim()) { atlananBos++; continue; }
        if (copKayitMi(ad)) { atlananCop++; continue; }
        // YENİ: Ad + soyad yoksa (tek kelimelik isim) aktarma
        if (!isimGecerliMi(ad)) { atlananIsim++; continue; }
        // YENİ: 11 haneli geçerli cep numarası yoksa aktarma
        if (!telefonGecerliMi(tel)) { atlananTelefon++; continue; }

        const yuk = transferMap.get(String(loadId)) || null;
        const bos = transferMap.get(String(unloadId)) || null;

        // Tarih/saat: '2021-06-01 03:30:00' → '2021-06-01' + '03:30'
        let date = '', time = '';
        if (tarihSaat) {
          const [d, t] = String(tarihSaat).split(' ');
          date = d || '';
          time = (t || '').slice(0, 5);
        }

        const yukAdres = (yuk?.address || '').trim();
        const bosAdres = (bos?.address || '').trim();

        // Depoevim tespiti: yükleme veya boşaltma adresinde geçiyorsa DEPO kaydı olur
        const yukDepo = trLower(yukAdres).includes('depoevim') || trLower(yukAdres).includes('depo evim');
        const bosDepo = trLower(bosAdres).includes('depoevim') || trLower(bosAdres).includes('depo evim');
        const depoMu = yukDepo || bosDepo;

        // İptal durumu
        const iptalMi = trLower(status) === 'canceled';
        if (iptalMi) sayacIptal++;
        if (depoMu) sayacDepo++;

        const simdi = new Date().toISOString();
        const jobDoc = {
          legacyId,
          type: depoMu ? 'Depo' : 'Nakliye',
          customerType: 'Bireysel',
          customerName: String(ad).trim(),
          customerPhone: telefonNormalize(tel),
          altPhone: '',
          tcNo: tc ? String(tc).trim() : '',
          taxNo: '',
          date, time,
          price: toplam ? String(parseFloat(String(toplam).replace(',', '.')) || '') : '',
          deposit: kapora ? String(parseFloat(String(kapora).replace(',', '.')) || '') : '',
          notes: [ekInfo, canceledNote].filter(Boolean).join(' | ').trim(),
          durationDays: '1',
          isSpecial: false,
          deliveryCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          // Ekip bilgisi BOŞ bırakılır
          team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [],
          extraLoadingAddresses: [], extraUnloadingAddresses: [],
          // Durum: iptal → cancelled; diğer her şey → tamamlanmış + onaylı
          status: iptalMi ? 'cancelled' : 'completed',
          endJobDetails: null,
          materialsDeducted: true,   // eski işler için stok DÜŞÜLMEZ
          pointsApproved: !iptalMi,  // puan otomatik onaylı
          mesaiApproved: !iptalMi,   // mesai otomatik onaylı
          completedAt: !iptalMi && date ? `${date}T${time || '09:00'}:00` : null,
          cancelledAt: iptalMi && date ? `${date}T${time || '09:00'}:00` : null,
          createdBy: 'Eski Sistem Aktarımı',
          createdAt: date ? `${date}T${time || '09:00'}:00` : simdi,
          importedLegacy: true,
        };

        // ---- YÜKLEME TARAFI ----
        if (yukDepo) {
          const sube = DEPO_LOCATIONS.find(d => d.name === depoSubeBul(yukAdres)) || DEPO_LOCATIONS[0];
          Object.assign(jobDoc, {
            depoDirection: 'fromDepo', selectedDepo: sube.name,
            fromProvince: sube.province, fromDistrict: sube.district, fromAddress: sube.address,
            fromFloor: 'Giriş Kat', fromTransportMethod: 'Merdiven', fromPacking: 'Kendisi Topladı',
            fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre',
          });
        } else {
          const konum = yukAdres ? ilIlceBul(yukAdres) : { province: '', district: '' };
          Object.assign(jobDoc, {
            fromProvince: konum.province, fromDistrict: konum.district, fromAddress: yukAdres,
            fromFloor: katEsle(yuk?.floor), fromTransportMethod: tasimaEsle(yuk),
            fromPacking: parseInt(yuk?.carry_stuff) === 2 ? 'Toplama Yapılacak' : 'Kendisi Topladı',
            fromRoomCount: daireTipiEsle(yuk?.apartment_type), fromDistance: '', fromDistanceUnit: 'Metre',
          });
        }

        // ---- BOŞALTMA TARAFI ----
        if (bosDepo && !yukDepo) {
          const sube = DEPO_LOCATIONS.find(d => d.name === depoSubeBul(bosAdres)) || DEPO_LOCATIONS[0];
          Object.assign(jobDoc, {
            depoDirection: 'toDepo', selectedDepo: sube.name,
            toProvince: sube.province, toDistrict: sube.district, toAddress: sube.address,
            toFloor: 'Giriş Kat', toTransportMethod: 'Merdiven', toPacking: 'Kendisi Topladı',
            toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre',
          });
        } else {
          const konum = bosAdres ? ilIlceBul(bosAdres) : { province: '', district: '' };
          Object.assign(jobDoc, {
            toProvince: konum.province, toDistrict: konum.district, toAddress: bosAdres,
            toFloor: katEsle(bos?.floor), toTransportMethod: tasimaEsle(bos),
            toPacking: 'Kendisi Topladı',
            toRoomCount: daireTipiEsle(bos?.apartment_type), toDistance: '', toDistanceUnit: 'Metre',
          });
        }

        // Teslim durumu eski sistemde yok → boş bırakılır (görünümde 'Yok' yazar)
        jobDoc.wallMounting = [];

        kayitlar.push(jobDoc);
      }

      // Aktarım tarihine göre eskiden yeniye yaz (cari 'ilk kayıt' tarihleri doğru otursun)
      kayitlar.sort((a, b) => String(a.date).localeCompare(String(b.date)));

      setHazirKayitlar(kayitlar);
      setOzet({
        okunanIs: orderRows.length,
        okunanAdres: transferRows.length,
        aktarilacak: kayitlar.length,
        tamamlanan: kayitlar.length - sayacIptal,
        iptal: sayacIptal,
        depo: sayacDepo,
        nakliye: kayitlar.length - sayacDepo,
        tekilMusteri: new Set(kayitlar.map(k => (k.customerPhone || '').replace(/\D/g, ''))).size,
        atlananCop, atlananMukerrer, atlananBos, atlananIsim, atlananTelefon,
      });
      setAsama('onizleme');
    };

    // ---------------- AKTARIM (Firestore'a yazma) ----------------
    const aktarimiBaslat = async () => {
      if (hazirKayitlar.length === 0) return;
      setAsama('aktariliyor');
      setIlerleme({ yazilan: 0, toplam: hazirKayitlar.length });
      const partiId = 'imp_' + Date.now();
      const yazilanIdler = [];
      try {
        const PARCA = 350; // Firestore batch limiti 500; güvenli pay bırakıyoruz
        for (let i = 0; i < hazirKayitlar.length; i += PARCA) {
          const dilim = hazirKayitlar.slice(i, i + PARCA);
          const batch = writeBatch(db);
          for (const kayit of dilim) {
            const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'));
            batch.set(ref, { ...kayit, importBatchId: partiId });
            yazilanIdler.push(ref.id);
          }
          await batch.commit();
          setIlerleme({ yazilan: Math.min(i + PARCA, hazirKayitlar.length), toplam: hazirKayitlar.length });
        }
        // Geri alma için parti kaydı oluştur
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'legacyImports', partiId), {
          jobIds: yazilanIdler, count: yazilanIdler.length,
          by: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
        });
        addSystemLog?.('Eski Sistem Aktarımı', `${yazilanIdler.length} iş kaydı eski sistemden içe aktarıldı.`);
        setAsama('bitti');
      } catch (err) {
        console.error(err);
        setHata('Aktarım sırasında hata oluştu: ' + err.message + ' — "Son Yüklemeyi Geri Al" ile yarım aktarımı temizleyebilirsiniz.');
        // Yarım kalan parti de geri alınabilsin diye kaydı yine oluştur
        if (yazilanIdler.length > 0) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'legacyImports', partiId), {
            jobIds: yazilanIdler, count: yazilanIdler.length, incomplete: true,
            by: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString()
          });
        }
        setAsama('onizleme');
      }
    };

    // ---------------- SON YÜKLEMEYİ GERİ AL ----------------
    const sonYuklemeyiGeriAl = async () => {
      const parti = sonPartiler[0];
      if (!parti || geriAliniyor) return;
      setGeriAliniyor(true);
      try {
        const ids = parti.jobIds || [];
        const PARCA = 350;
        for (let i = 0; i < ids.length; i += PARCA) {
          const batch = writeBatch(db);
          ids.slice(i, i + PARCA).forEach(id => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id)));
          await batch.commit();
        }
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'legacyImports', parti.id));
        addSystemLog?.('Eski Sistem Aktarımı Geri Alındı', `${ids.length} içe aktarılmış kayıt silindi; sistem aktarım öncesine döndü.`);
      } catch (err) { setHata('Geri alma sırasında hata: ' + err.message); }
      setGeriAliniyor(false);
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
          <div className="bg-black text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2"><Database className="w-5 h-5 text-yellow-400" /> Eski Sistemden İçe Aktar</h3>
            <button onClick={onClose} disabled={asama === 'aktariliyor'} className="text-neutral-400 hover:text-white transition disabled:opacity-40"><X className="w-6 h-6" /></button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {hata && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl p-3">{hata}</div>}

            {/* AŞAMA 1: DOSYA SEÇİMİ */}
            {asama === 'dosya' && (
              <>
                <p className="text-sm text-neutral-600 font-medium">
                  Eski uygulamanın SQL yedeğini (<b>semboln_db.sql</b>) seçin. İş kayıtları ve müşteriler
                  otomatik eşleştirilerek sisteme aktarılır. <b>Depo kiralama kayıtları aktarılmaz.</b>
                </p>
                <label className="cursor-pointer w-full py-8 bg-neutral-50 border-2 border-neutral-300 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-neutral-100 hover:border-red-400 transition">
                  <Database className="w-8 h-8 text-neutral-400" />
                  <span className="text-sm font-black text-neutral-600">SQL Dosyası Seç (.sql)</span>
                  <span className="text-[11px] font-bold text-neutral-400">Dosya sadece tarayıcınızda okunur, önce önizleme gösterilir</span>
                  <input type="file" accept=".sql,text/plain" className="hidden" onChange={handleDosyaSec} />
                </label>
              </>
            )}

            {/* AŞAMA 2: ÖNİZLEME */}
            {asama === 'onizleme' && ozet && (
              <>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs font-bold text-neutral-500">
                  Dosyada {ozet.okunanIs.toLocaleString('tr-TR')} iş ve {ozet.okunanAdres.toLocaleString('tr-TR')} adres kaydı okundu.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-xl font-black text-black">{ozet.aktarilacak.toLocaleString('tr-TR')}</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-0.5">Aktarılacak İş</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-xl font-black text-purple-700">{ozet.tekilMusteri.toLocaleString('tr-TR')}</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-0.5">Tekil Müşteri (Cari)</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-xl font-black text-green-600">{ozet.tamamlanan.toLocaleString('tr-TR')}</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-0.5">Tamamlanmış + Onaylı</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-xl font-black text-red-600">{ozet.iptal.toLocaleString('tr-TR')}</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-0.5">İptal Edilmiş</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-xl font-black text-red-500">{ozet.nakliye.toLocaleString('tr-TR')}</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-0.5">Nakliye Kaydı</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3 text-center"><div className="text-xl font-black text-blue-600">{ozet.depo.toLocaleString('tr-TR')}</div><div className="text-[10px] font-black text-neutral-400 uppercase mt-0.5">Depo Kaydı</div></div>
                </div>
                <div className="text-[11px] font-bold text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                  <b className="text-neutral-500">Atlanan kayıtlar:</b> {ozet.atlananCop} deneme/çöp • {ozet.atlananTelefon} geçersiz telefon (11 hane değil veya uydurma)
                  • {ozet.atlananIsim} tek kelimelik isim (soyadı yok) • {ozet.atlananBos} isimsiz • {ozet.atlananMukerrer} daha önce aktarılmış.
                  Depo kiralama müşterileri hiç okunmadı.
                </div>
                <button onClick={aktarimiBaslat} className="w-full py-3.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg">
                  <Database className="w-5 h-5" /> {ozet.aktarilacak.toLocaleString('tr-TR')} Kaydı İçe Aktar
                </button>
              </>
            )}

            {/* AŞAMA 3: AKTARILIYOR */}
            {asama === 'aktariliyor' && (
              <div className="py-6 text-center space-y-3">
                <div className="text-sm font-black text-black">Kayıtlar aktarılıyor, lütfen pencereyi kapatmayın...</div>
                <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden border border-neutral-200">
                  <div className="bg-red-600 h-full transition-all" style={{ width: `${ilerleme.toplam ? Math.round((ilerleme.yazilan / ilerleme.toplam) * 100) : 0}%` }}></div>
                </div>
                <div className="text-xs font-bold text-neutral-500">{ilerleme.yazilan.toLocaleString('tr-TR')} / {ilerleme.toplam.toLocaleString('tr-TR')}</div>
              </div>
            )}

            {/* AŞAMA 4: BİTTİ */}
            {asama === 'bitti' && (
              <div className="py-4 text-center space-y-3">
                <CheckCircle className="w-14 h-14 text-green-600 mx-auto" />
                <div className="text-base font-black text-black">Aktarım tamamlandı!</div>
                <p className="text-xs font-bold text-neutral-500">
                  {ilerleme.toplam.toLocaleString('tr-TR')} iş kaydı eklendi. Müşteriler cari profillerinde otomatik birleşti.
                  Tamamlanan İşler, İptal Edilen İşler ve Tüm Müşteriler bölümlerinden kontrol edebilirsiniz.
                </p>
                <button onClick={onClose} className="w-full py-3 bg-neutral-900 text-white font-black rounded-xl hover:bg-black transition">Kapat</button>
              </div>
            )}

            {/* SON YÜKLEMEYİ GERİ AL — her aşamada altta görünür (aktarım sırasında hariç) */}
            {asama !== 'aktariliyor' && sonPartiler.length > 0 && (
              <div className="border-t border-neutral-200 pt-4">
                <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-800">Son yükleme: {sonPartiler[0].count?.toLocaleString('tr-TR')} kayıt{sonPartiler[0].incomplete ? ' (yarım kaldı)' : ''}</p>
                    <p className="text-[10px] font-bold text-amber-600">{sonPartiler[0].by} • {sonPartiler[0].createdAt ? new Date(sonPartiler[0].createdAt).toLocaleString('tr-TR') : ''}</p>
                  </div>
                  <button onClick={sonYuklemeyiGeriAl} disabled={geriAliniyor}
                    className="shrink-0 px-3 py-2 bg-amber-600 text-white text-xs font-black rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-1.5">
                    {geriAliniyor ? 'Geri Alınıyor...' : 'Son Yüklemeyi Geri Al'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };