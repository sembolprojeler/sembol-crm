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
  // YENİ: Çok günlü iş (1. gün / 2. gün) rozeti ve grup fiyatı gösterimi
  isGunEtiketi, isDevamGunuMu, isGrupFiyat, isGrupKapora, isAracEtiketi, isYardimciKayitMi,
  // YENİ: Fotoğraf eksik uyarısı ve ekipler arası destek
  isFotografEksikleri, isDestekIdleri, isTamEkipIdleri, destekPersoneliMi, isAsilEkipIdleri } from './shared.jsx';
import { computeAllAutoSkills, SkillScoreBadge, PersonPositionRankIcons } from './OperasyonPersonel.jsx';


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
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-neutral-200 text-neutral-600">{(job.esyaDurumu && job.esyaDurumu.length > 0) ? job.esyaDurumu.join(' • ') : job.fromPacking}</span>
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
                                {/* YENİ: Varış bölümünde eski "eşya durumu" yerine seçilen TESLİM ŞEKLİ etiketleri yan yana gösterilir */}
                                {(job.wallMounting && job.wallMounting.length > 0)
                                  ? job.wallMounting.map(w => <span key={w} className="text-[10px] font-bold bg-indigo-50 px-2 py-0.5 rounded shadow-sm border border-indigo-200 text-indigo-700">{w}</span>)
                                  : <span className="text-[10px] font-bold bg-indigo-50 px-2 py-0.5 rounded shadow-sm border border-indigo-200 text-indigo-700">Teslim: Yok</span>}
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
                    const est = calculateMaterials(job.fromRoomCount, job.fromPacking, job.type);
                    return (
                      <>
                        <span><b>{est.strec}</b> Streç</span>
                        <span><b>{est.bant}</b> Bant</span>
                        <span><b>{est.poset}</b> Poşet</span>
                        <span><b>{est.kagit}kg</b> Kağıt</span>
                        <span><b>{est.koli}</b> Koli</span>
                        {/* Depo patpatı yalnızca depo işlerinde görünür */}
                        {job.type === 'Depo' && est.depoPatpati > 0 && <span className="text-blue-700"><b>{est.depoPatpati}</b> Depo Patpatı</span>}
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
                      {/* YENİ: Teslim edilen yerin fotoğraf/videoları */}
                      {(job.endJobDetails.deliveryImages || []).map((img, idx) => (
                        <button key={'dlv'+idx} type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Teslim Yeri Fotoğrafı', name: img}); }} className="md:col-span-2 text-left text-blue-700 bg-blue-50 p-2.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition flex justify-between items-center shadow-sm">
                          <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Teslim Yeri Fotoğrafı {idx > 0 ? idx+1 : ''}:</b> {img}</span>
                          <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-blue-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
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
    // YENİ: Sayfalama — liste 50'şerli sayfalara bölünür
    const SAYFA_BOYUTU = 50;
    const [sayfa, setSayfa] = useState(1);
    
    // Arama metnine göre filtreleme (Müşteri Adı veya Telefon)
    const filteredJobs = jobs.filter(job => 
      (job.customerName && job.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (job.customerPhone && job.customerPhone.includes(searchQuery))
    );

    // ========================================================================
    // SIRALAMA: "en yeni kayıttan en eskiye"
    // ÖNCEKİ HALİ: taşıma tarihine (job.date) göre sıralanıyordu. Eski sistemden
    // aktarılan bazı işlerde taşıma tarihi 2029/2030/2032 gibi ileri tarihler
    // olduğu için, gerçekte aylar önce girilmiş bu kayıtlar listenin en üstünde
    // kalıyor, asıl yeni kayıtlar aşağıda kayboluyordu.
    // YENİ HALİ: gerçek KAYIT (oluşturulma) zamanı esas alınır. Kayıt zamanı
    // bilinmeyen veya gelecek tarihli (güvenilmez) olanlar listenin sonuna düşer.
    // ========================================================================
    const isKayitZamani = (job) => {
      const ham = job?.createdAt || job?.createdDate || job?.kayitTarihi || job?.timestamp;
      if (!ham) return null;
      const t = (typeof ham === 'object' && ham.seconds) ? new Date(ham.seconds * 1000) : new Date(ham);
      if (isNaN(t.getTime())) return null;
      // Bir kayıt gelecekte oluşturulmuş olamaz (saat dilimi için 1 gün pay)
      const ustSinir = new Date(); ustSinir.setDate(ustSinir.getDate() + 1);
      if (t > ustSinir) return null;
      return t.getTime();
    };

    const sortedJobs = [...filteredJobs].sort((a, b) => {
      const ka = isKayitZamani(a), kb = isKayitZamani(b);
      // Kayıt zamanı bilinmeyenler her iki sıralamada da EN SONA
      if (ka === null && kb === null) return 0;
      if (ka === null) return 1;
      if (kb === null) return -1;
      return sortOrder === 'newest' ? kb - ka : ka - kb;
    });

    // Arama veya sıralama değişince ilk sayfaya dön
    useEffect(() => { setSayfa(1); }, [searchQuery, sortOrder]);
    // Yalnızca aktif sayfanın kayıtları ekrana basılır
    const pagedJobs = sortedJobs.slice((sayfa - 1) * SAYFA_BOYUTU, sayfa * SAYFA_BOYUTU);

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
                <option value="newest">Kayıt Tarihine Göre (Yeniden Eskiye)</option>
                <option value="oldest">Kayıt Tarihine Göre (Eskiden Yeniye)</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* KART TABANLI YAPI (Responsive Fix) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pagedJobs.map(job => (
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
                        <span className="text-[9px] font-medium text-red-600/80">{job.toRoomCount} • {job.toFloor} • {job.toTransportMethod} • Teslim: {(job.wallMounting && job.wallMounting.length > 0) ? job.wallMounting.join(' • ') : 'Yok'}</span>
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

        {/* YENİ: Sayfalama çubuğu — 50'şerli sayfa geçişi */}
        <SayfalamaBar toplam={sortedJobs.length} sayfa={sayfa} sayfaBoyutu={SAYFA_BOYUTU} onSayfaChange={setSayfa} birim="iş" />
      </div>
    );
  };

  export const CompletedJobsView = ({ jobs, handleEditJob, setViewingImage, setDeleteJobId, setMarkDamageJobId, canApprovePoints, handleOpenApproveModal, handleOpenMesaiModal, handleOpenResolveDamageModal, sahaDenetimleri = [] }) => {
    // YENİ: Bir işin şef saha denetimi kaydını bulur (kim denetledi + ortalama puan rozeti için)
    const jobSahaDenetimi = (jobId) => sahaDenetimleri.find(d => String(d.jobId) === String(jobId)) || null;
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
                    {/* YENİ: Bu işe şef saha denetimi yapıldıysa kim yaptığı ve puanı rozet olarak görünür */}
                    {(() => {
                      const dnt = jobSahaDenetimi(job.id);
                      if (!dnt) return null;
                      return (
                        <span className="flex items-center gap-1 font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-200"
                          title={`Denetleyen: ${dnt.sefAdi} • ${dnt.denetimTarihi ? new Date(dnt.denetimTarihi).toLocaleString('tr-TR') : ''}${dnt.genelRapor ? `\n\nRapor: ${dnt.genelRapor}` : ''}`}>
                          <ClipboardCheck className="w-3.5 h-3.5" /> Saha Denetimi: {String(dnt.ortalamaPuan ?? 0).replace('.', ',')}★
                          <span className="text-purple-500 font-black">• {dnt.sefAdi}</span>
                          {(dnt.medya || []).filter(Boolean).length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] bg-purple-200 px-1 rounded"><Camera className="w-2.5 h-2.5" />{(dnt.medya || []).filter(Boolean).length}</span>
                          )}
                        </span>
                      );
                    })()}
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
                          {/* YENİ: Çözüm belgeleri (fotoğraf/PDF/dekont) iş kartında da görünür */}
                          <HasarCozumBelgeleri files={job.endJobDetails.damageResolutionFiles} setViewingImage={setViewingImage} />
                          {(parseFloat(job.endJobDetails.damageCost) || 0) > 0 && (
                            <span className="block text-[10px] font-black text-red-600 mt-1.5">Hasar Maliyeti: ₺{parseFloat(job.endJobDetails.damageCost).toLocaleString('tr-TR')}</span>
                          )}
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
                    <div className="w-full flex items-center gap-1.5">
                      <div className="flex-1 px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl flex justify-center items-center gap-2 text-sm border border-green-200 opacity-70">
                        <CheckCircle className="w-4 h-4" /> Puan Onaylandı
                      </div>
                      {/* YENİ: Yanlış girilen puanları düzeltme butonu (sadece yetkili görür) */}
                      {canApprovePoints && (
                        <button onClick={() => handleOpenApproveModal(job)} title="Puanları Düzenle" className="p-2.5 bg-white border border-green-300 text-green-700 rounded-xl hover:bg-green-50 transition shadow-sm shrink-0">
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* MESAİ ONAY BUTONU */}
                  {canApprovePoints && !job.mesaiApproved && (
                    <button onClick={() => handleOpenMesaiModal(job)} className="w-full px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition flex justify-center items-center gap-2 text-sm border border-blue-200">
                      <Clock className="w-4 h-4" /> Mesai Onayla
                    </button>
                  )}
                  {job.mesaiApproved && (
                    <div className="w-full flex items-center gap-1.5">
                      <div className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-xl flex justify-center items-center gap-2 text-sm border border-blue-200 opacity-70">
                        <CheckCircle className="w-4 h-4" /> Mesai Onaylandı
                      </div>
                      {/* YENİ: Yanlış girilen mesaiyi düzeltme butonu (sadece yetkili görür) */}
                      {canApprovePoints && (
                        <button onClick={() => handleOpenMesaiModal(job)} title="Mesaiyi Düzenle" className="p-2.5 bg-white border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50 transition shadow-sm shrink-0">
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {(job.endJobDetails?.truckImages || (job.endJobDetails?.truckImage ? [job.endJobDetails.truckImage] : [])).map((img, idx) => (
                    <button key={idx} onClick={() => setViewingImage({title: 'Kasa Fotoğrafı', name: img})} className="w-full px-4 py-2 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-2 text-sm border border-neutral-200">
                      <Camera className="w-4 h-4" /> Kasa Görseli {idx > 0 ? idx+1 : ''}
                    </button>
                  ))}

                  {/* YENİ: Teslim edilen yerin görselleri */}
                  {(job.endJobDetails?.deliveryImages || []).map((img, idx) => (
                    <button key={'dlv'+idx} onClick={() => setViewingImage({title: 'Teslim Yeri Fotoğrafı', name: img})} className="w-full px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition flex justify-center items-center gap-2 text-sm border border-blue-200">
                      <Camera className="w-4 h-4" /> Teslim Yeri Görseli {idx > 0 ? idx+1 : ''}
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
  export const CalendarView = ({ jobs, handleEditJob, currentUser, setJobToChangeDate, setNewJobDate, setShowChangeDateModal, setCancelJobId, setDeleteJobId, onDonemGerekli, donemYukleniyor }) => {
    const canAssign = currentUser?.position?.includes('Operasyon') || currentUser?.position?.includes('Firma Sahibi') || currentUser?.permissions?.canEdit;
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]); 
    const [myPuantaj, setMyPuantaj] = useState({});

    // ======================================================================
    // GEÇMİŞ AY VERİSİ (okuma optimizasyonu sonrası gerekli)
    // Uygulama açılışta yalnızca son 30 günü canlı tutar. Kullanıcı takvimde
    // geçmiş bir aya giderse o ayın işleri görünmüyordu. Bu etki, görüntülenen
    // ay değiştiğinde o AYIN verisini bir kereye mahsus istemekle çözülür.
    // Aynı ay ikinci kez açılırsa tekrar okuma yapılmaz.
    // ======================================================================
    useEffect(() => {
      if (!onDonemGerekli) return;
      const iki = (n) => String(n).padStart(2, '0');
      const ayBasi = `${currentYear}-${iki(currentMonth + 1)}-01`;
      const sonGun = new Date(currentYear, currentMonth + 1, 0).getDate();
      const aySonu = `${currentYear}-${iki(currentMonth + 1)}-${iki(sonGun)}`;
      onDonemGerekli(ayBasi, aySonu);
    }, [currentYear, currentMonth, onDonemGerekli]);

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
        {/* YENİ: Bugünün hücresi için dikkat çeken SARI nabız (pulse) çerçeve animasyonu (daha belirgin ve hızlı) */}
        <style>{`
          .today-pulse-ring {
            border-color: #f59e0b !important;
            animation: todayPulse 1.1s ease-in-out infinite;
          }
          @keyframes todayPulse {
            0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.95); }
            70%  { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
            100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
          }
        `}</style>
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
                className={`min-h-[64px] p-1.5 rounded-xl border transition cursor-pointer flex flex-col overflow-hidden ${cellClass} ${item && selectedDate === item.date ? 'ring-2 ring-red-600 ring-offset-1' : ''} ${isToday ? 'today-pulse-ring' : ''}`}
              >
                {item && (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[11px] font-black ${isToday ? (isFull && !isMaviYaka ? 'text-red-400' : 'text-red-600') : (isFull && !isMaviYaka ? 'text-white font-bold' : 'text-black font-bold')}`}>
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
                            {/* NAKLİYE/DEPO NOKTALARI: grid-cols-3 ile her satırda KESİN 3 nokta, 2 satır = en fazla 6. */}
                            {/* Örn. 4 iş: üstte 3 nokta, altta 1 nokta. Alan sabit yükseklikte (h-[18px]) => tüm günler eşit. */}
                            <div className="grid grid-cols-3 gap-0.5 w-fit content-start h-[18px] overflow-hidden">
                                {coreJobs.slice(0, 6).map(job => (
                                  job.isSpecial ? 
                                    <Star key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className="w-2 h-2 shrink-0 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                                  :
                                    <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className={`w-2 h-2 shrink-0 rounded-full ${job.type === 'Depo' ? 'bg-blue-600' : 'bg-red-600'}`}></div>
                                ))}
                            </div>
                            
                            {/* ASANSÖR NOKTALARI: Asansör işi OLMASA BİLE bu satır her zaman render edilir (hiza sabit). */}
                            {/* SARI AYRAÇ ÇİZGİSİ her zaman sabit gösterilir (asansör işi olsa da olmasa da). */}
                            {/* En fazla 4 yeşil nokta. İstanbul (Anadolu) = açık yeşil ve önce; Avrupa/diğer il = KOYU yeşil ve en sonda. */}
                            <div className="flex flex-nowrap gap-0.5 mt-auto pt-1 w-full items-center h-[12px] overflow-hidden border-t border-yellow-400">
                                {[...asansorJobs].sort((a, b) => {
                                  // İstanbul (Anadolu) işleri önce (0), Avrupa/diğer iller sonra (1)
                                  const aRank = a.fromProvince === 'İstanbul (Anadolu)' ? 0 : 1;
                                  const bRank = b.fromProvince === 'İstanbul (Anadolu)' ? 0 : 1;
                                  return aRank - bRank;
                                }).slice(0, 4).map(job => {
                                  const isAnadolu = job.fromProvince === 'İstanbul (Anadolu)';
                                  return job.isSpecial ?
                                    <Star key={job.id} title={`${job.customerName} - ${job.team} (${job.type})`} className="w-1.5 h-1.5 shrink-0 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                                  :
                                    <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type}${isAnadolu ? '' : ' - Avrupa/Diğer'})`} className={`w-1.5 h-1.5 shrink-0 rounded-full ${isAnadolu ? 'bg-green-500' : 'bg-green-800'}`}></div>;
                                })}
                            </div>
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
                jobsByDate[selectedDate].map(job => {
                  // ============================================================
                  // YENİ (kullanıcı talebi): ÇOK GÜNLÜ İŞ GÖSTERİMİ
                  // Her gün ayrı kart olarak kalır (ekip/araç her gün ayrı gider)
                  // ama kart artık işin kaçıncı günü olduğunu söyler ve devam
                  // günlerinde de işin GERÇEK fiyatını gösterir. Veritabanında
                  // devam gününün price alanı ₺0'dır (ciro bir kez sayılır);
                  // burada yalnızca gösterim için grup fiyatı okunur.
                  // ============================================================
                  const gunEtiketi = isGunEtiketi(job, jobs);            // "2. Gün / 3" ya da null
                  const aracEtiketi = isAracEtiketi(job);                // YENİ: "2. Araç / 2" ya da null
                  const devamGunu = isYardimciKayitMi(job, jobs);        // 2. gün / 2. araç gibi yardımcı kayıt mı
                  const gosterFiyat = isGrupFiyat(job, jobs);            // İşin gerçek fiyatı
                  const gosterKapora = isGrupKapora(job, jobs);          // Ana işin kaporası
                  return (
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
                        {/* YENİ: Çok günlü işte gün rozeti — "1. GÜN / 2" */}
                        {gunEtiketi && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-purple-600 text-white shadow-sm" title="Bu iş birden fazla gün sürüyor; her gün için ekip ve mesai ayrı işlenir, ciro tek sayılır.">
                            {gunEtiketi}
                          </span>
                        )}
                        {/* YENİ: Aynı güne birden fazla araç gidiyorsa araç rozeti — "1. ARAÇ / 2" */}
                        {aracEtiketi && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-sky-600 text-white shadow-sm" title="Bu işe aynı gün birden fazla araç gidiyor; her araca ayrı ekip atanır ve mesai ayrı kapatılır, ciro ve teslim kodu tektir.">
                            {aracEtiketi}
                          </span>
                        )}
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
                      {/* DEĞİŞTİ: Devam gününde de işin gerçek fiyatı görünür (ciroya girmez) */}
                      {(job.price || gosterFiyat > 0) && (
                        <div className="text-right shrink-0 leading-none">
                          <span className="block text-sm font-black text-green-600">₺{gosterFiyat.toLocaleString('tr-TR')}</span>
                          {gosterKapora > 0 && (
                            <span className="block text-[10px] font-bold text-green-500 mt-1">Kapora: ₺{gosterKapora.toLocaleString('tr-TR')}</span>
                          )}
                          {devamGunu && (
                            <span className="block text-[9px] font-bold text-purple-600 mt-1" title="Fiyat ve kapora ana kayda (1. gün, 1. araç) kayıtlıdır; bu kayda ayrıca tutar yazılmaz.">ana kayıtta sayılır</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-neutral-600 flex flex-col gap-1.5 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" /> 
                        <div className="flex-1 leading-tight">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                            <span className="text-black font-bold">{job.extraLoadingAddresses?.length > 0 ? '1. AL:' : 'AL:'} {job.fromProvince}/{job.fromDistrict}</span>
                            <span className="text-[9px] font-medium text-neutral-500">{job.fromRoomCount} • {job.fromFloor} • {job.fromTransportMethod} • {(job.esyaDurumu && job.esyaDurumu.length > 0) ? job.esyaDurumu.join(' • ') : job.fromPacking}</span>
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
                                <span className="text-[9px] font-medium text-red-600/80">{job.toRoomCount} • {job.toFloor} • {job.toTransportMethod} • Teslim: {(job.wallMounting && job.wallMounting.length > 0) ? job.wallMounting.join(' • ') : 'Yok'}</span>
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
                      <div className="flex flex-nowrap items-center gap-1 w-full mt-2">
                        {!isOperator && (
                          <>
                            <button 
                              onClick={() => {
                                let phone = job.customerPhone.replace(/\D/g, '');
                                if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                else if (!phone.startsWith('90')) phone = '90' + phone;

                                const kapora = parseInt(job.price || 0) * 0.20; // Sözleşme 20. madde: %20 kapora
                                const kaporaText = kapora > 0 ? kapora.toLocaleString('tr-TR') : '...';

                                const msg = `Sayın *${job.customerName}*,\n\n*Sembol Nakliyat* olarak ${job.date} tarihinde saat ${job.time} sularında planlanan işleminiz sistemimize başarıyla kaydedilmiştir.\n\n🚚 *Güzergah Bilgisi:*\n📍 Alış: ${job.fromProvince} / ${job.fromDistrict}\n📍 Teslim: ${job.toProvince ? job.toProvince + ' / ' + job.toDistrict : 'Belirtilmemiş'}\n\n🔒 *Güvenliğiniz için Teslim Kodunuz:* ${job.deliveryCode || 'Bulunmuyor'}\n(Ekibimiz geldiğinde eşya teslimi için bu kodu kendilerine iletebilirsiniz.)\n\n💰 *Kapora Bilgilendirmesi:*\nİşleminizin onaylanması ve aracınızın rezerve edilmesi için toplam tutarın %20'si olan *${kaporaText} TL* kapora ödemenizi rica ederiz.\n\n🏦 *Banka Bilgileri:*\n${aktifBankaBilgiMetni()}\n\n⚠️ *ÖNEMLİ NOT:* Lütfen ödeme yaparken açıklama kısmına sadece size gönderdiğimiz teslim kodunu (${job.deliveryCode || 'Yok'}) yazınız.\n\nBizi tercih ettiğiniz için teşekkür eder, yeni yerinizin hayırlı olmasını dileriz. İyi günler!`;
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                            }} 
                            className="flex-1 min-w-0 px-1 py-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white text-[9px] font-bold rounded-lg transition flex items-center justify-center gap-0.5 shadow-sm whitespace-nowrap overflow-hidden"
                          >
                            <MessageCircle className="w-2.5 h-2.5 shrink-0"/> Bilgilendir
                          </button>
                          <button onClick={() => generateContractPDF(job)} className="flex-1 min-w-0 px-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-[9px] font-bold rounded-lg transition flex items-center justify-center gap-0.5 border border-green-200 whitespace-nowrap overflow-hidden">
                            <FileText className="w-2.5 h-2.5 shrink-0"/> PDF
                          </button>
                          <button onClick={() => handleEditJob(job)} className="flex-1 min-w-0 px-1 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[9px] font-bold rounded-lg transition flex items-center justify-center gap-0.5 border border-neutral-200 whitespace-nowrap overflow-hidden">
                            <Edit className="w-2.5 h-2.5 shrink-0"/> Düzenle
                          </button>
                          {/* YENİ: Tarih değiştirme ve iptal sadece işi açan kişi VEYA Yönetici/Müdür tarafından yapılabilir */}
                          {(() => {
                            const isYonetici = currentUser?.position === 'Firma Sahibi' || currentUser?.rank === 'Müdür' || currentUser?.permissions?.canEdit;
                            const isCreator = job.createdBy && currentUser?.fullName && job.createdBy === currentUser.fullName;
                            const canManage = isYonetici || isCreator;
                            if (!canManage) return null;
                            return (
                              <>
                                <button onClick={() => { setJobToChangeDate(job); setNewJobDate(job.date); setShowChangeDateModal(true); }} className="flex-1 min-w-0 px-1 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-[9px] font-bold rounded-lg transition flex items-center justify-center gap-0.5 border border-orange-200 whitespace-nowrap overflow-hidden">
                                  <CalendarDays className="w-2.5 h-2.5 shrink-0"/> Değiştir
                                </button>
                                {job.status !== 'cancelled' && (
                                  <button onClick={() => setCancelJobId(job.id)} className="flex-1 min-w-0 px-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[9px] font-bold rounded-lg transition flex items-center justify-center gap-0.5 border border-red-200 whitespace-nowrap overflow-hidden">
                                    <Ban className="w-2.5 h-2.5 shrink-0"/> İptal Et
                                  </button>
                                )}
                              </>
                            );
                          })()}
                          {/* ==============================================================
                              YENİ: KALICI SİL — YALNIZCA MÜDÜR VE FİRMA SAHİBİ
                              ==============================================================
                              "İptal Et" işi iptal listesine taşır, kayıt sistemde kalır.
                              Bu buton ise işi veritabanından TAMAMEN siler; hiç kaydedilmemiş
                              gibi olur ve geri alınamaz.
                              YETKİ: Yukarıdaki "Değiştir/İptal" grubundan AYRI ve daha dardır.
                              Orada işi açan kişi veya canEdit yetkisi olan da işlem yapabilir;
                              burada YALNIZCA position === 'Firma Sahibi' veya rank === 'Müdür'
                              olanlar butonu görür. canEdit yetkisi TEK BAŞINA yetmez.
                              Silme onayı, App.tsx'teki mevcut "Kalıcı Olarak Sil" penceresinden
                              geçer (setDeleteJobId) — ayrı bir onay akışı kurulmadı.
                              ============================================================== */}
                          {(currentUser?.position === 'Firma Sahibi' || currentUser?.rank === 'Müdür') && setDeleteJobId && (
                            <button onClick={() => setDeleteJobId(job.id)} className="flex-1 min-w-0 px-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold rounded-lg transition flex items-center justify-center gap-0.5 shadow-sm whitespace-nowrap overflow-hidden" title="İşi veritabanından tamamen siler — geri alınamaz">
                              <Trash2 className="w-2.5 h-2.5 shrink-0"/> Kalıcı Sil
                            </button>
                          )}
                        </>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })
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

  export const DamagedJobsView = ({ jobs, handleEditJob, setViewingImage, setDeleteJobId, handleOpenResolveDamageModal, canDelete }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // YENİ: İş tipi filtresi — 'Tümü' | 'Nakliye' | 'Depo' | 'Asansör'
    const [tipFiltre, setTipFiltre] = useState('Tümü');
    // GÖRÜNÜM MODU (kullanıcı kuralı):
    //   false -> YALNIZCA çözüm bekleyen hasarlar (varsayılan)
    //   true  -> YALNIZCA çözülmüş hasarlar
    // Buton artık "çözülenleri listeye ekleyip çıkarmaz"; iki liste arasında
    // GEÇİŞ yapar. Böylece çözülenlere bakarken bekleyenler karışmaz.
    const [cozulenGoster, setCozulenGoster] = useState(false);

    // Kaydın çözülmüş sayılıp sayılmadığını belirleyen tek nokta
    const cozuldu = (j) => !!j.endJobDetails?.damageResolved;

    // YENİ: Hasarın hangi iş tipinde oluştuğunu görmek için tip bazlı sayaçlar.
    // Sayaçlar arama kutusundan BAĞIMSIZDIR; ancak "Çözülen İşler" düğmesinin
    // durumunu dikkate alır — böylece rozetlerdeki sayı ekrandaki kart sayısıyla uyuşur.
    const tumHasarli = jobs.filter(j => j.endJobDetails?.damageStatus === 'Hasar var');
    const cozulenSayisi = tumHasarli.filter(cozuldu).length;     // Butonun rozetinde gösterilir
    const bekleyenSayisi = tumHasarli.filter(j => !cozuldu(j)).length; // Geri dönüş rozetinde gösterilir
    // Sayaçlar yalnızca AKTİF moddaki kayıtları sayar
    const sayimListesi = cozulenGoster ? tumHasarli.filter(cozuldu) : tumHasarli.filter(j => !cozuldu(j));
    const tipSayaclari = {
      'Tümü': sayimListesi.length,
      'Nakliye': sayimListesi.filter(j => !j.type || j.type === 'Nakliye').length,
      'Depo': sayimListesi.filter(j => j.type === 'Depo').length,
      'Asansör': sayimListesi.filter(j => j.type === 'Asansör').length,
    };

    const damagedJobs = jobs.filter(j => {
      if (j.endJobDetails?.damageStatus !== 'Hasar var') return false;
      // MOD FİLTRESİ: açıkken yalnızca ÇÖZÜLENLER, kapalıyken yalnızca BEKLEYENLER
      if (cozulenGoster ? !cozuldu(j) : cozuldu(j)) return false;
      // YENİ: Seçili iş tipine göre süz ("Nakliye" seçiliyse tipi boş olan eski kayıtlar da dahildir)
      if (tipFiltre !== 'Tümü') {
        const jobTipi = j.type || 'Nakliye';
        if (jobTipi !== tipFiltre) return false;
      }
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
              <h2 className="text-xl font-bold text-black flex items-center gap-2 flex-wrap">
                Hasarlı İşler
                {/* Hangi listeye bakıldığı başlıkta da açıkça yazar */}
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${cozulenGoster ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {cozulenGoster ? 'ÇÖZÜLENLER' : 'ÇÖZÜM BEKLEYENLER'}
                </span>
              </h2>
              <p className="text-sm font-medium text-neutral-500">
                {cozulenGoster
                  ? 'Çözüme kavuşturulmuş hasar kayıtları listeleniyor.'
                  : 'Operasyon sırasında hasar bildirimi yapılmış, henüz çözülmemiş kayıtlar.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
            {/* LİSTE GEÇİŞ DÜĞMESİ: iki liste arasında gidip gelir.
                Kapalıyken "Çözülen İşler (11)" -> tıklayınca çözülenler listelenir.
                Açıkken  "Çözüm Bekleyenler (8)" -> tıklayınca bekleyenlere dönülür.
                Rozetteki sayı her zaman GİDİLECEK listenin adedini gösterir. */}
            <button type="button" onClick={() => setCozulenGoster(v => !v)}
              className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition flex items-center justify-center gap-2 whitespace-nowrap ${cozulenGoster
                ? 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
                : 'bg-green-50 text-green-700 border-green-200 hover:border-green-400'}`}
              title={cozulenGoster ? 'Çözüm bekleyen hasarlara dön' : 'Yalnızca çözülmüş hasarları göster'}>
              {cozulenGoster ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {cozulenGoster ? 'Çözüm Bekleyenler' : 'Çözülen İşler'}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cozulenGoster ? 'bg-white/25' : 'bg-white/80'}`}>{cozulenGoster ? bekleyenSayisi : cozulenSayisi}</span>
            </button>
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
        </div>

        {/* YENİ: İŞ TİPİ FİLTRESİ — hasarın hangi tip işte oluştuğunu sayılarla gösterir
            ve tıklandığında listeyi o tipe göre süzer. Renkler kart rozetleriyle aynıdır. */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-neutral-200 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide mr-1">Hasarın Oluştuğu İş Tipi:</span>
          {[
            { tip: 'Tümü', aktifRenk: 'bg-neutral-800 text-white border-neutral-800', pasifRenk: 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400' },
            { tip: 'Nakliye', aktifRenk: 'bg-red-600 text-white border-red-600', pasifRenk: 'bg-red-50 text-red-700 border-red-200 hover:border-red-400' },
            { tip: 'Depo', aktifRenk: 'bg-blue-600 text-white border-blue-600', pasifRenk: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400' },
            { tip: 'Asansör', aktifRenk: 'bg-green-500 text-white border-green-500', pasifRenk: 'bg-green-50 text-green-700 border-green-200 hover:border-green-400' },
          ].map(f => (
            <button key={f.tip} type="button" onClick={() => setTipFiltre(f.tip)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 ${tipFiltre === f.tip ? f.aktifRenk : f.pasifRenk}`}>
              {f.tip}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tipFiltre === f.tip ? 'bg-white/25' : 'bg-white/70'}`}>{tipSayaclari[f.tip]}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {damagedJobs.length === 0 ? (
            <div className="col-span-full p-12 bg-white rounded-2xl shadow-sm border border-neutral-200 text-center text-neutral-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg font-medium">{searchQuery.trim() ? 'Aramanıza uygun hasarlı kayıt bulunamadı.' : tipFiltre !== 'Tümü' ? `${tipFiltre} işlerinde ${cozulenGoster ? '' : 'çözüm bekleyen '}hasar kaydı bulunmuyor.` : cozulenGoster ? 'Sistemde hasar kaydı bulunan operasyon bulunmuyor.' : 'Çözüm bekleyen hasar kaydı yok. Çözülmüş kayıtları görmek için sağ üstteki "Çözülen İşler" düğmesine basın.'}</p>
            </div>
          ) : (
            damagedJobs.map(job => (
              <div key={job.id} className={`p-5 rounded-2xl shadow-sm border transition flex flex-col gap-4 ${job.endJobDetails?.damageResolved ? 'bg-white border-green-200 hover:border-green-400' : 'bg-red-50/30 border-red-200 hover:border-red-400'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-black text-lg">{job.customerName}</h3>
                    {/* YENİ: İŞ TİPİ ROZETİ — hasarın Nakliye işinde mi, Depo işinde mi yoksa
                        Asansör işinde mi oluştuğu ilk bakışta görülür. Renk kodu diğer
                        ekranlardaki (İş Onaylama / Ekip Kurma Tahtası) desenle aynıdır:
                        Nakliye = kırmızı, Depo = mavi, Asansör = yeşil. */}
                    <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase tracking-wider shadow-sm ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                      {job.type === 'Depo' ? <Package className="w-3 h-3" /> : job.type === 'Asansör' ? <ArrowUpRight className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                      {job.type || 'Nakliye'} İşi
                    </span>
                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1 mt-1.5">
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
                      {/* YENİ: Çözüm sırasında eklenen belgeler (fotoğraf/PDF/dekont) —
                          ortak bileşen; görseller görüntüleyicide, PDF yeni sekmede açılır */}
                      <HasarCozumBelgeleri files={job.endJobDetails.damageResolutionFiles} setViewingImage={setViewingImage} />
                      {/* YENİ: Hasar maliyeti girildiyse burada da görünür */}
                      {(parseFloat(job.endJobDetails.damageCost) || 0) > 0 && (
                        <p className="text-[10px] font-black text-red-600 mt-2">Hasar Maliyeti: ₺{parseFloat(job.endJobDetails.damageCost).toLocaleString('tr-TR')}{job.endJobDetails.damageCostTeamCount > 0 ? ` (${job.endJobDetails.damageCostTeamCount} kişiye ₺${parseFloat(job.endJobDetails.damageCostPerPerson || 0).toLocaleString('tr-TR')})` : ''}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* YENİ: ADRES BİLGİSİ — hasarın hangi güzergâhta oluştuğu görülür.
                    Alış (AL) ve Teslim (VR) adresleri, varsa açık adres metniyle birlikte
                    gösterilir. Depo işlerinde teslim adresi olmayabilir; o durumda yalnızca
                    alış adresi çıkar. Ek yükleme/boşaltma noktası varsa sayısı belirtilir. */}
                <div className="text-[11px] text-neutral-600 flex flex-col gap-1.5 bg-white p-2.5 rounded-xl border border-neutral-200">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-tight min-w-0">
                      <span className="text-black font-bold block mb-0.5">
                        {job.extraLoadingAddresses?.length > 0 ? '1. AL:' : 'AL:'} {job.fromProvince || '-'}/{job.fromDistrict || '-'}
                      </span>
                      {job.fromAddress && <span className="text-[10px] font-medium text-neutral-500 block">{job.fromAddress}</span>}
                      {(job.fromRoomCount || job.fromFloor) && (
                        <span className="text-[9px] font-medium text-neutral-400 block mt-0.5">{[job.fromRoomCount, job.fromFloor].filter(Boolean).join(' • ')}</span>
                      )}
                      {job.extraLoadingAddresses?.length > 0 && (
                        <span className="text-[9px] font-bold text-neutral-500 block mt-0.5">+{job.extraLoadingAddresses.length} ek yükleme noktası</span>
                      )}
                    </div>
                  </div>
                  {job.toProvince && (
                    <div className="flex items-start gap-1.5 pt-1.5 border-t border-neutral-200/80">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-tight min-w-0">
                        <span className="text-red-900 font-bold block mb-0.5">
                          {job.extraUnloadingAddresses?.length > 0 ? '1. VR:' : 'VR:'} {job.toProvince}/{job.toDistrict || '-'}
                        </span>
                        {job.toAddress && <span className="text-[10px] font-medium text-red-700/70 block">{job.toAddress}</span>}
                        {(job.toRoomCount || job.toFloor) && (
                          <span className="text-[9px] font-medium text-red-600/60 block mt-0.5">{[job.toRoomCount, job.toFloor].filter(Boolean).join(' • ')}</span>
                        )}
                        {job.extraUnloadingAddresses?.length > 0 && (
                          <span className="text-[9px] font-bold text-red-600/70 block mt-0.5">+{job.extraUnloadingAddresses.length} ek boşaltma noktası</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* YENİ: İŞE GİDEN EKİP — hasarın hangi ekip tarafından yapıldığı görülür.
                    Ekip bilgisi kaydın kendisinde (job.teamNames / job.team) zaten mevcut;
                    diğer ekranlardaki (İş Onaylama Tahtası vb.) gösterim deseniyle aynıdır. */}
                <div className="text-xs">
                  <p className="font-bold text-neutral-500 mb-1.5 flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                    <Users className="w-3.5 h-3.5" /> İşe Giden Ekip
                  </p>
                  {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(job.teamNames || [job.team]).map((name, i) => (
                        <span key={i} className="flex items-center gap-1 font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">
                          <User className="w-3.5 h-3.5" /> {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 w-max font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg border border-yellow-100">
                      <User className="w-3.5 h-3.5" /> Ekip Atanmamış
                    </span>
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
                  {/* YENİ: Düzenle artık hasar notunu (ve çözülmüşse çözüm notunu) düzenleme modalını açar */}
                  <button onClick={() => handleEditJob(job)} className={canDelete ? 'py-2.5 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-1.5 border border-neutral-200' : 'col-span-2 py-2.5 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-1.5 border border-neutral-200'}>
                    <Edit className="w-4 h-4" /> Notu Düzenle
                  </button>
                  {/* YENİ: Sil butonu SADECE müdür yetkisindeki (canDelete) kullanıcılara gösterilir */}
                  {canDelete && (
                    <button onClick={() => setDeleteJobId(job.id)} className="py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition flex justify-center items-center gap-1.5 border border-red-100">
                      <X className="w-4 h-4" /> Sil
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

  export const CancelledJobsView = ({ jobs, handleEditJob, handleRestoreJob, setDeleteJobId }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // YENİ: Sayfalama — liste 50'şerli sayfalara bölünür
    const SAYFA_BOYUTU = 50;
    const [sayfa, setSayfa] = useState(1);

    const cancelledJobs = jobs.filter(j => {
      if (j.status !== 'cancelled') return false;
      if (searchQuery.trim()) {
        return (j.customerName && j.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
               (j.customerPhone && j.customerPhone.includes(searchQuery));
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Arama değişince ilk sayfaya dön; yalnızca aktif sayfa render edilir
    useEffect(() => { setSayfa(1); }, [searchQuery]);
    const pagedCancelled = cancelledJobs.slice((sayfa - 1) * SAYFA_BOYUTU, sayfa * SAYFA_BOYUTU);

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
            pagedCancelled.map(job => (
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

        {/* YENİ: Sayfalama çubuğu — 50'şerli sayfa geçişi */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
          <SayfalamaBar toplam={cancelledJobs.length} sayfa={sayfa} sayfaBoyutu={SAYFA_BOYUTU} onSayfaChange={setSayfa} birim="iptal kaydı" />
        </div>
      </div>
    );
  };
  // --- PERSONEL TAHTASI BİLEŞENİ SONU ---

  export const IsOnaylamaTahtasiView = ({ jobs, handleEditJob, setMarkDamageJobId, canApprovePoints, handleOpenApproveModal, handleOpenMesaiModal, personnelList = [], db, appId, addSystemLog, setViewingImage, handleOpenEndJobModal, isManager, currentUser }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    // YENİ: "Ekibi Düzenle" modalı — ekipten sistemli/sistem dışı personel ekleme-çıkarma
    const [editingTeamJob, setEditingTeamJob] = useState(null);
    // YENİ: Destek penceresi — hangi işe takviye personel gönderiliyor
    const [destekJob, setDestekJob] = useState(null);
    const [destekSecim, setDestekSecim] = useState([]);   // seçilen personel kimlikleri
    const [destekKaydediliyor, setDestekKaydediliyor] = useState(false);

    // Destek penceresi açıldığında mevcut destekçiler işaretli gelir
    useEffect(() => {
      setDestekSecim(destekJob ? isDestekIdleri(destekJob) : []);
    }, [destekJob]);
    const [teamManualNameInput, setTeamManualNameInput] = useState('');

    const getTeamSystemNames = (job) => (job.assignedPersonnelIds || []).map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
    const getTeamManualNames = (job) => {
      const systemNames = getTeamSystemNames(job);
      return (job.teamNames || []).filter(name => !systemNames.includes(name));
    };

    // ======================================================================
    // YENİ: ŞEF DENETİMİ — Şef sahaya gittiğinde o işin ekibini puanlar (1-5),
    // her personel için özel not bırakır, işin kaydının doğru açılıp açılmadığını
    // değerlendirir ve sahada gördüklerini raporlar. Kayıtlar 'sahaDenetimleri'
    // koleksiyonuna yazılır; personel profilinde "Saha Puanı" ve hareket akışında,
    // İnsan Kaynakları > Saha Raporlaması ekranında görünür.
    // ======================================================================
    const KAYIT_DOGRULUK_SECENEKLERI = [
      { deger: 'Hepsi doğru',              renk: 'bg-green-50 text-green-700 border-green-300',    aktif: 'bg-green-600 text-white border-green-600' },
      { deger: 'Hemen hemen doğru',        renk: 'bg-lime-50 text-lime-700 border-lime-300',       aktif: 'bg-lime-600 text-white border-lime-600' },
      { deger: 'Çok yanlış bilgiler var',  renk: 'bg-orange-50 text-orange-700 border-orange-300', aktif: 'bg-orange-600 text-white border-orange-600' },
      { deger: 'Tamamen yanlış',           renk: 'bg-red-50 text-red-700 border-red-300',          aktif: 'bg-red-600 text-white border-red-600' },
    ];

    const [denetimJob, setDenetimJob] = useState(null);          // Denetim penceresi açık olan iş
    const [denetimPuanlar, setDenetimPuanlar] = useState({});     // { personelId: { puan, ozelNot } }
    const [denetimRapor, setDenetimRapor] = useState('');         // Sahada görülenler / genel rapor
    // YENİ: Sahada çekilen fotoğraf/video kanıtları — denetim için ZORUNLUDUR.
    // Birden fazla eklenebilir; "Şimdi Çek" (kamera), "Galeriden" ve "Dosyadan"
    // seçenekleri MediaCaptureMenu ile iOS ve Android'de yerel olarak açılır.
    const [denetimMedya, setDenetimMedya] = useState([]);
    const [denetimMedyaYukleniyor, setDenetimMedyaYukleniyor] = useState(false);

    // Seçilen dosyaları (çoklu) sunucuya yükleyip listeye ekler
    const handleDenetimMedyaUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setDenetimMedyaYukleniyor(true);
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
          const text = await res.text();
          let url = file.name;
          try { const json = JSON.parse(text); url = json.url || json.fileName || json.file || text; } catch (err) { url = text.trim(); }
          setDenetimMedya(prev => [...prev, url]);
        } catch (err) {
          console.error('Denetim görseli yüklenemedi:', err);
          alert(`"${file.name}" yüklenemedi.`);
        }
      }
      setDenetimMedyaYukleniyor(false);
      e.target.value = ''; // aynı dosya tekrar seçilebilsin
    };

    const handleDenetimMedyaSil = (url) => setDenetimMedya(prev => prev.filter(x => x !== url));
    const [denetimDogruluk, setDenetimDogruluk] = useState('');   // Kayıt doğruluğu cevabı
    const [denetimKaydediliyor, setDenetimKaydediliyor] = useState(false);
    // YENİ: Sıfırlama modu. "Sıfırla" butonuna basıldığında true olur; form boş bırakılıp
    // kaydedilirse mevcut denetim kaydı Firebase'den TAMAMEN SİLİNİR (hiç denetlenmemiş gibi olur).
    const [denetimSifirlandi, setDenetimSifirlandi] = useState(false);
    const [mevcutDenetimler, setMevcutDenetimler] = useState([]); // Bu tarihteki kayıtlı denetimler

    // Görüntülenen günün denetim kayıtları canlı dinlenir (kart üzerinde "Denetlendi" rozeti için)
    useEffect(() => {
      if (!db) return;
      const unsub = onSnapshot(
        query(collection(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri'), where('jobDate', '==', selectedDate)),
        snap => setMevcutDenetimler(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        console.error
      );
      return () => unsub();
    }, [db, appId, selectedDate]);

    const jobDenetimi = (jobId) => mevcutDenetimler.find(d => String(d.jobId) === String(jobId)) || null;

    // Denetim penceresini açar; daha önce denetlenmişse kayıtlı değerler forma yüklenir
    const openDenetimModal = (job) => {
      const mevcut = jobDenetimi(job.id);
      if (mevcut) {
        const puanMap = {};
        (mevcut.personelPuanlari || []).forEach(p => { puanMap[p.personelId] = { puan: p.puan, ozelNot: p.ozelNot || '' }; });
        setDenetimPuanlar(puanMap);
        setDenetimRapor(mevcut.genelRapor || '');
        setDenetimDogruluk(mevcut.kayitDogrulugu || '');
        setDenetimMedya(mevcut.medya || []);
      } else {
        setDenetimPuanlar({});
        setDenetimRapor('');
        setDenetimDogruluk('');
        setDenetimMedya([]);
      }
      setDenetimJob(job);
      setDenetimSifirlandi(false); // YENİ: Pencere her açıldığında sıfırlama modu kapalı başlar
    };

    // YENİ: DENETİMİ SIFIRLA — Formdaki tüm girdileri (puanlar, notlar, kayıt doğruluğu,
    // fotoğraf/video, saha raporu) temizler ve sıfırlama modunu açar. Kullanıcı bu haldeyken
    // "Sıfırlamayı Kaydet" derse, bu işe ait denetim kaydı Firebase'den silinir ve iş
    // hiç denetlenmemiş duruma döner. Yanlışlıkla basılmaya karşı onay sorulur.
    const handleDenetimSifirla = () => {
      const mevcut = denetimJob ? jobDenetimi(denetimJob.id) : null;
      const mesaj = mevcut
        ? 'Bu işin denetimi tamamen sıfırlanacak.\n\nFormdaki tüm bilgiler silinir ve "Sıfırlamayı Kaydet" dediğinizde kayıtlı denetim de silinerek iş HİÇ DENETLENMEMİŞ duruma döner.\n\nDevam edilsin mi?'
        : 'Formdaki tüm girdiler (puanlar, notlar, fotoğraflar, rapor) temizlenecek.\n\nDevam edilsin mi?';
      if (!window.confirm(mesaj)) return;
      setDenetimPuanlar({});
      setDenetimRapor('');
      setDenetimDogruluk('');
      setDenetimMedya([]);
      setDenetimSifirlandi(true);
    };

    // Denetim penceresindeki ekip listesi: sistemli personel + sistem dışı isimler
    const denetimEkibi = (job) => {
      if (!job) return [];
      const sistemli = (job.assignedPersonnelIds || []).map(id => {
        const p = personnelList.find(x => String(x.id) === String(id));
        return p ? { id: String(p.id), ad: p.fullName, pozisyon: p.position || '', sistemli: true } : null;
      }).filter(Boolean);
      const sistemliAdlar = sistemli.map(x => x.ad);
      const elle = (job.teamNames || []).filter(n => !sistemliAdlar.includes(n))
        .map(n => ({ id: 'manuel:' + n, ad: n, pozisyon: 'Sistem dışı', sistemli: false }));
      return [...sistemli, ...elle];
    };

    const setPersonelPuan = (pid, puan) => setDenetimPuanlar(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), puan } }));
    const setPersonelNot = (pid, ozelNot) => setDenetimPuanlar(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), ozelNot } }));

    const handleSaveDenetim = async () => {
      if (!denetimJob) return;
      const ekip = denetimEkibi(denetimJob);

      // ====================================================================
      // YENİ: SIFIRLAMA KAYDI
      // "Sıfırla" butonuna basılmış ve form tamamen boşsa; normal doğrulamalar
      // (rapor/medya/puan zorunluluğu) ATLANIR ve bu işe ait kayıtlı denetim
      // Firebase'den SİLİNİR. Böylece iş hiç denetlenmemiş duruma döner.
      // Kullanıcı sıfırladıktan sonra yeniden bilgi girmişse form boş olmayacağı
      // için bu dal çalışmaz; normal kaydetme akışı devam eder.
      // ====================================================================
      const formBos = !denetimRapor.trim() && !denetimDogruluk && denetimMedya.length === 0
        && !ekip.some(p => (parseInt(denetimPuanlar[p.id]?.puan) || 0) > 0);
      if (denetimSifirlandi && formBos) {
        const mevcutKayit = jobDenetimi(denetimJob.id);
        setDenetimKaydediliyor(true);
        try {
          if (mevcutKayit) {
            // Kayıtlı denetimi tamamen sil — iş "Denetlendi" rozetini kaybeder
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri', mevcutKayit.id));
            addSystemLog?.('Saha Denetimi Sıfırlandı', `${denetimJob.customerName || ''} işine ait şef denetimi silindi; iş hiç denetlenmemiş duruma döndürüldü.`);
          }
          setDenetimSifirlandi(false);
          setDenetimJob(null);
        } catch (e) {
          console.error('Saha denetimi sıfırlanamadı:', e);
          alert('Denetim sıfırlanamadı. Lütfen tekrar deneyin.');
        }
        setDenetimKaydediliyor(false);
        return;
      }

      // Raporlama zorunlu: şef sahada gördüklerini yazmadan pencere kapatılamaz
      if (!denetimRapor.trim()) { alert('Lütfen "Saha Raporu" bölümünü doldurun. Sahada gördüklerinizi yazmadan denetim kaydedilemez.'); return; }
      if (!denetimDogruluk) { alert('Lütfen işin kaydının doğru açılıp açılmadığını değerlendirin.'); return; }
      // Sahada çekilmiş en az bir fotoğraf/video ZORUNLUDUR (denetimin sahada yapıldığının kanıtı)
      if (denetimMedya.length === 0) { alert('Sahada çekilmiş en az bir fotoğraf veya video eklemelisiniz. Denetim kanıtı olmadan kayıt tamamlanamaz.'); return; }
      const puanlananlar = ekip.map(p => ({
        personelId: p.id, personelAdi: p.ad, pozisyon: p.pozisyon,
        puan: parseInt(denetimPuanlar[p.id]?.puan) || 0,
        ozelNot: (denetimPuanlar[p.id]?.ozelNot || '').trim(),
      })).filter(p => p.puan > 0);
      if (puanlananlar.length === 0) { alert('En az bir personele 1-5 arası puan vermelisiniz.'); return; }

      setDenetimKaydediliyor(true);
      const ortalama = puanlananlar.reduce((t, p) => t + p.puan, 0) / puanlananlar.length;
      const kayit = {
        jobId: denetimJob.id,
        jobCustomerName: denetimJob.customerName || '',
        jobType: denetimJob.type || '',
        jobDate: denetimJob.date || '',
        jobTime: denetimJob.time || '',
        jobRoute: `${denetimJob.fromDistrict || '?'} → ${denetimJob.toDistrict || '?'}`,
        // YENİ: Saha Raporlaması ekranında denetlenen işin aracı, tutarı ve
        // müşteri iletişimi de görünsün diye kayda işlenir.
        jobVehiclePlate: denetimJob.assignedVehiclePlate || '',
        jobPrice: denetimJob.price || '',
        jobCustomerPhone: denetimJob.customerPhone || '',
        jobTeamNames: (denetimJob.teamNames || []),
        kayitAcan: denetimJob.createdBy || 'Bilinmiyor',
        kayitDogrulugu: denetimDogruluk,
        genelRapor: denetimRapor.trim(),
        personelPuanlari: puanlananlar,
        // YENİ (okuma optimizasyonu): 'personelPuanlari' bir NESNE dizisi olduğu
        // için Firestore'da doğrudan sorgulanamıyordu ve personel profili tüm
        // denetimleri okumak zorunda kalıyordu. Bu düz id dizisi sayesinde
        // artık array-contains ile SUNUCU TARAFINDA filtreleme yapılabiliyor.
        personelIdListesi: puanlananlar.map(pp => String(pp.personelId)),
        medya: denetimMedya,                       // Sahada çekilen fotoğraf/video listesi
        ortalamaPuan: Math.round(ortalama * 100) / 100,
        sefId: currentUser?.id ? String(currentUser.id) : '',
        sefAdi: currentUser?.fullName || 'Sistem',
        denetimTarihi: new Date().toISOString(),
      };
      try {
        const mevcut = jobDenetimi(denetimJob.id);
        if (mevcut) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri', mevcut.id), kayit);
          addSystemLog?.('Saha Denetimi Güncellendi', `${kayit.jobCustomerName} işi için şef denetimi güncellendi (ortalama ${kayit.ortalamaPuan} puan).`);
        } else {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri'), kayit);
          addSystemLog?.('Saha Denetimi Yapıldı', `${kayit.jobCustomerName} işi ${kayit.sefAdi} tarafından denetlendi (${puanlananlar.length} personel, ortalama ${kayit.ortalamaPuan} puan).`);
        }
        setDenetimSifirlandi(false); // YENİ: Normal kayıt yapıldıysa sıfırlama modu kapanır
        setDenetimJob(null);
      } catch (e) {
        console.error('Saha denetimi kaydedilemedi:', e);
        alert('Denetim kaydedilemedi. Lütfen tekrar deneyin.');
      }
      setDenetimKaydediliyor(false);
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

    // YENİ: Seçili tarihi gün bazında ileri/geri kaydırır (saat dilimi kaymasını önlemek için yerel tarih parçalarıyla biçimlendirilir)
    const shiftSelectedDate = (days) => {
      const d = new Date(selectedDate + 'T12:00:00'); // öğlen alınır ki saat dilimi gün atlatmasın
      d.setDate(d.getDate() + days);
      const pad = n => String(n).padStart(2, '0');
      setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    };

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
            {/* YENİ: Önceki gün oku */}
            <button type="button" onClick={() => shiftSelectedDate(-1)} title="Önceki gün" className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 hover:text-black transition shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <CalendarDays className="w-5 h-5 text-neutral-500" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-black cursor-pointer px-2"
            />
            {/* YENİ: Sonraki gün oku */}
            <button type="button" onClick={() => shiftSelectedDate(1)} title="Sonraki gün" className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 hover:text-black transition shrink-0">
              <ChevronRight className="w-5 h-5" />
            </button>
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
                    {/* YENİ: Müşterinin teslim kodu — her kartta görünür */}
                    {job.deliveryCode && (
                      <div className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded w-fit mb-1.5 tracking-widest">
                        <Key className="w-3 h-3 shrink-0" /> Teslim Kodu: {job.deliveryCode}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-700 mb-2">
                      <span className="truncate flex-1"><MapPin className="w-3 h-3 inline mr-0.5 text-neutral-400"/>{job.fromDistrict} ➔ {job.toDistrict || '?'}</span>
                    </div>
                    {/* YENİ: Eşya Durumu (Teslim Durumu'ndan ÖNCE) + Teslim Şekli.
                        Eşya durumu seçilmemişse varsayılan "Kendisi Topladı" gösterilir. */}
                    <div className="flex flex-wrap gap-1 mb-1.5 items-center">
                      <span className="text-[9px] font-bold text-neutral-400">Eşya:</span>
                      {(job.esyaDurumu && job.esyaDurumu.length > 0)
                        ? job.esyaDurumu.map(e => (
                            <span key={e} className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{e}</span>
                          ))
                        : <span className="text-[9px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200 px-1.5 py-0.5 rounded">Kendisi Topladı</span>}
                    </div>
                    {/* YENİ: Teslim Şekli her zaman gösterilir; seçim yoksa "Yok" etiketi (eski kayıtlar dahil) */}
                    <div className="flex flex-wrap gap-1 mb-2 items-center">
                      <span className="text-[9px] font-bold text-neutral-400">Teslim:</span>
                      {(job.wallMounting && job.wallMounting.length > 0)
                        ? job.wallMounting.map(w => (
                            <span key={w} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">{w}</span>
                          ))
                        : <span className="text-[9px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200 px-1.5 py-0.5 rounded">Yok</span>}
                    </div>
                    {/* YENİ: İşin anlaşılan fiyatı (varsa kapora da gösterilir) */}
                    <div className="flex items-center justify-between gap-2 mb-2 bg-white border border-green-200 rounded px-1.5 py-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase">Fiyat</span>
                      <span className="text-[11px] font-black text-green-700">
                        {job.price ? `₺${(parseFloat(job.price) || 0).toLocaleString('tr-TR')}` : 'Belirtilmemiş'}
                        {job.deposit && parseFloat(job.deposit) > 0 && (
                          <span className="text-[9px] font-bold text-neutral-400 ml-1">(Kapora ₺{(parseFloat(job.deposit) || 0).toLocaleString('tr-TR')})</span>
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-neutral-700 bg-white p-1.5 rounded border border-neutral-200 shadow-sm flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-600" /> {job.team}
                    </div>
                    {/* ==========================================================
                        YENİ (kullanıcı talebi): DESTEĞE GELEN PERSONEL
                        Başka ekipten bu işe destek olarak gönderilen kişiler
                        ekip listesinin altında ayrı rozetle görünür. Böylece
                        kartta "bu işe kim takviye geldi" tek bakışta okunur.
                        ========================================================== */}
                    {isDestekIdleri(job).length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 bg-cyan-50 border border-cyan-200 rounded p-1.5">
                        <span className="text-[9px] font-black text-cyan-700 uppercase flex items-center gap-1">
                          <Users className="w-3 h-3" /> Destek:
                        </span>
                        {(job.destekKayitlari || []).map(k => (
                          <span key={k.personelId} className="text-[9px] font-black bg-cyan-600 text-white px-1.5 py-0.5 rounded"
                            title={`${k.kaynakEkip || 'Diğer ekip'} ekibinden destek geldi`}>
                            {k.adSoyad}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* End Job Details */}
                  <div className="p-3 flex flex-col gap-2 flex-1 bg-neutral-50/30">
                     {job.endJobDetails ? (
                       <div className="text-xs flex flex-col gap-2 bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm">
                          {/* YENİ: Ekip şefinin işi sonlandırdığı saat (completedAt varsa gösterilir) */}
                          {job.completedAt && (
                            <span className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-md font-bold w-fit">
                               <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                               Tamamlandı: {new Date(job.completedAt).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
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
                     {/* ============================================================
                         YENİ (kullanıcı talebi): FOTOĞRAF PAYLAŞILMADI UYARISI
                         İş sonlandırıldığı hâlde KASA ve/veya TESLİM fotoğrafı
                         yüklenmemişse kartta kırmızı uyarı çıkar. Böylece hangi
                         ekibin fotoğraf paylaşmadığı yöneticiye anında görünür.
                         ============================================================ */}
                     {(() => {
                       const foto = isFotografEksikleri(job);
                       if (!foto.eksikVar) return null;
                       return (
                         <div className="flex items-start gap-1.5 bg-red-50 border border-red-300 rounded-lg p-2">
                           <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                           <div className="min-w-0">
                             <p className="text-[10px] font-black text-red-700 leading-tight">
                               {foto.eksikler.join(' ve ')} paylaşılmamış
                             </p>
                             <p className="text-[9px] font-bold text-red-500 leading-tight mt-0.5">
                               İş sonlandırıldı ama ekip {foto.eksikler.length === 2 ? 'bu görselleri' : 'bu görseli'} yüklemedi.
                             </p>
                           </div>
                         </div>
                       );
                     })()}
                     {/* YENİ: Ekip şefinin yüklediği kasa/hasar/asansör medyalarının görüntülenmesi */}
                     {setViewingImage && (job.endJobDetails?.truckImages || job.endJobDetails?.deliveryImages || job.endJobDetails?.damageImages || job.endJobDetails?.elevatorImages) && (
                       <div className="flex flex-wrap gap-1.5">
                         {(job.endJobDetails?.truckImages || []).filter(img => img && img !== 'Yükleniyor...').map((img, idx) => (
                           <button key={'truck'+idx} onClick={() => setViewingImage({ title: 'Kasa Fotoğrafı', name: img })} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1">
                             <Camera className="w-3 h-3" /> Kasa {idx > 0 ? idx + 1 : ''}
                           </button>
                         ))}
                         {/* YENİ: Teslim edilen yer görselleri */}
                         {(job.endJobDetails?.deliveryImages || []).filter(img => img && img !== 'Yükleniyor...').map((img, idx) => (
                           <button key={'dlv'+idx} onClick={() => setViewingImage({ title: 'Teslim Yeri Fotoğrafı', name: img })} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition flex items-center gap-1">
                             <Camera className="w-3 h-3" /> Teslim Yeri {idx > 0 ? idx + 1 : ''}
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
                    {/* YENİ: ŞEF DENETİMİ — sahaya giden şef ekibi puanlar, not bırakır ve rapor yazar */}
                    {(() => {
                      const dnt = jobDenetimi(job.id);
                      return (
                        <button onClick={() => openDenetimModal(job)}
                          className={`w-full py-2 font-bold text-xs rounded-lg transition flex justify-center items-center gap-1.5 border ${dnt ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' : 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'}`}>
                          <ClipboardCheck className="w-4 h-4" />
                          {dnt ? `Denetlendi • ${dnt.ortalamaPuan} ★` : 'Şef Denetimi'}
                        </button>
                      );
                    })()}
                  </div>

                  {canApprovePoints && job.status === 'completed' && (
                  <div className="p-2 border-t border-neutral-200 bg-neutral-50 flex flex-col gap-1.5 shrink-0">
                    {!job.pointsApproved ? (
                      <button onClick={() => handleOpenApproveModal(job)} className="w-full py-2 bg-yellow-50 text-yellow-700 font-bold text-xs rounded-lg hover:bg-yellow-100 transition flex justify-center items-center gap-1.5 border border-yellow-200">
                        <Star className="w-4 h-4" /> Puan Onayla
                      </button>
                    ) : (
                      <div className="w-full flex items-center gap-1.5">
                        <div className="flex-1 py-2 bg-yellow-100 text-yellow-700 font-bold text-xs rounded-lg flex justify-center items-center gap-1.5 border border-yellow-200 opacity-60">
                          <CheckCircle className="w-4 h-4" /> Puan Onaylandı
                        </div>
                        {/* YENİ: Yanlış girilen puanları düzeltmek için küçük düzenleme butonu */}
                        <button onClick={() => handleOpenApproveModal(job)} title="Puanları Düzenle" className="p-2 bg-white border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 transition shadow-sm shrink-0">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* ============================================================
                        DEĞİŞTİ (kullanıcı talebi): "MESAİ ONAYLA" -> "DESTEK"
                        ------------------------------------------------------------
                        Mesai onayı buradan KALDIRILDI. Mesai zaten QR giriş/çıkış
                        kayıtlarından hesaplanıyor ve İnsan Kaynakları > Mesai Takip
                        / Puantaj Takip ekranlarından girilip düzenlenebiliyor;
                        bu yüzden iş kartında ikinci bir onay adımı gerekmiyor.
                        Yerine DESTEK bölümü geldi: işi biten veya boşta olan
                        personel bu işe takviye olarak gönderilir.
                        ============================================================ */}
                    <button onClick={() => setDestekJob(job)}
                      className={`w-full py-2 font-bold text-xs rounded-lg transition flex justify-center items-center gap-1.5 border ${
                        isDestekIdleri(job).length > 0
                          ? 'bg-cyan-100 text-cyan-800 border-cyan-300 hover:bg-cyan-200'
                          : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'}`}>
                      <Users className="w-4 h-4" />
                      {isDestekIdleri(job).length > 0 ? `Destek • ${isDestekIdleri(job).length} kişi` : 'Destek Ekle'}
                    </button>

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

      {/* ==================== YENİ: ŞEF DENETİMİ PENCERESİ ====================
          Şef sahaya gittiğinde: ekibi 1-5 arası puanlar, her personel için özel not
          bırakır (isteğe bağlı), işin kaydının doğru açılıp açılmadığını değerlendirir
          ve sahada gördüklerini raporlar. Rapor ve kayıt değerlendirmesi zorunludur. */}
      {denetimJob && (() => {
        const job = jobs.find(j => j.id === denetimJob.id) || denetimJob;
        const ekip = denetimEkibi(job);
        const mevcut = jobDenetimi(job.id);
        const puanlananSayi = ekip.filter(p => (parseInt(denetimPuanlar[p.id]?.puan) || 0) > 0).length;
        const anlikOrtalama = puanlananSayi > 0
          ? (ekip.reduce((t, p) => t + (parseInt(denetimPuanlar[p.id]?.puan) || 0), 0) / puanlananSayi).toFixed(2)
          : '0';
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex justify-center items-center p-3 md:p-6">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col h-[90vh]">
              {/* Başlık */}
              <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white px-4 py-3 flex justify-between items-center shrink-0">
                <div className="min-w-0">
                  <h3 className="font-black text-base flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Şef Denetimi</h3>
                  <p className="text-[11px] font-bold text-purple-200 truncate">{job.customerName} • {job.type} • {job.date} {job.time}</p>
                </div>
                <button onClick={() => { setDenetimJob(null); setDenetimSifirlandi(false); }} className="text-purple-200 hover:text-white transition shrink-0"><X className="w-6 h-6" /></button>
              </div>

              {/* İçerik — kaydırmalı */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-5">
                {/* YENİ: SIFIRLAMA MODU UYARISI — "Sıfırla" butonuna basıldığında görünür */}
                {denetimSifirlandi && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 text-xs font-bold text-red-800 flex items-start gap-2">
                    <History className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Denetim <b>sıfırlandı</b>. Bu haliyle <b>"Sıfırlamayı Kaydet ve Kapat"</b> derseniz bu işe ait denetim kaydı silinir ve iş hiç denetlenmemiş duruma döner.
                      Vazgeçmek isterseniz pencereyi kapatın; yeniden denetim girmek isterseniz aşağıdaki alanları doldurmanız yeterlidir.
                    </span>
                  </div>
                )}
                {mevcut && !denetimSifirlandi && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-bold text-emerald-800">
                    Bu iş {new Date(mevcut.denetimTarihi).toLocaleString('tr-TR')} tarihinde <b>{mevcut.sefAdi}</b> tarafından denetlendi. Değişiklik yapıp yeniden kaydedebilirsiniz.
                  </div>
                )}

                {/* 1) KAYIT DOĞRULUĞU — kaydı açan kişi ve şefin değerlendirmesi */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="bg-neutral-900 text-white px-3 py-2 text-[11px] font-black uppercase tracking-wide flex items-center gap-2">
                    <UserPlus className="w-3.5 h-3.5" /> Kayıt Doğruluğu Değerlendirmesi
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200">
                      <span className="text-[9px] font-black text-neutral-400 uppercase block">Bu İşin Kaydını Açan Kişi</span>
                      <span className="font-black text-black text-sm">{job.createdBy || 'Bilinmiyor'}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-black mb-2">İş bilgileri doğru şekilde kayıt açıldı mı? <span className="text-red-500">*</span></p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {KAYIT_DOGRULUK_SECENEKLERI.map(o => (
                          <button key={o.deger} type="button" onClick={() => setDenetimDogruluk(o.deger)}
                            className={`py-2.5 px-3 rounded-lg text-xs font-black border-2 transition text-left ${denetimDogruluk === o.deger ? o.aktif : o.renk}`}>
                            {o.deger}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2) PERSONEL PUANLAMA — 1-5 puan + özel not */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="bg-purple-700 text-white px-3 py-2 text-[11px] font-black uppercase tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> İşe Giden Personel ({ekip.length})</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Ortalama: {anlikOrtalama} ★</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {ekip.length === 0 && (
                      <p className="text-xs font-bold text-neutral-400 py-4 text-center">Bu işe atanmış personel yok. Önce "Ekibi Düzenle" ile ekip ekleyin.</p>
                    )}
                    {ekip.map(p => {
                      const secili = parseInt(denetimPuanlar[p.id]?.puan) || 0;
                      return (
                        <div key={p.id} className="bg-neutral-50 rounded-xl border border-neutral-200 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div className="min-w-0">
                              <span className="font-black text-sm text-black block truncate">{p.ad}</span>
                              <span className="text-[10px] font-bold text-neutral-400">{p.pozisyon}{!p.sistemli && ' • puanı kaydedilir, profile işlenmez'}</span>
                            </div>
                            {/* 1-5 puan seçimi */}
                            <div className="flex gap-1 shrink-0">
                              {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} type="button" onClick={() => setPersonelPuan(p.id, n)}
                                  className={`w-8 h-8 rounded-lg text-xs font-black border-2 transition flex items-center justify-center ${secili === n ? 'bg-yellow-400 text-black border-yellow-500 shadow-sm' : 'bg-white text-neutral-400 border-neutral-200 hover:border-yellow-400'}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Şefin bu personel için özel notu (isteğe bağlı) */}
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase block mb-1">Özel Not (isteğe bağlı)</label>
                            <textarea value={denetimPuanlar[p.id]?.ozelNot || ''} onChange={e => setPersonelNot(p.id, e.target.value)}
                              placeholder="Sahada bu personel hakkında gördüğünüz durum..."
                              className="w-full p-2 border border-neutral-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500 resize-none h-14" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3) SAHA KANITI — fotoğraf/video (ZORUNLU, çoklu, Şimdi Çek / Galeriden / Dosyadan) */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-600 text-white px-3 py-2 text-[11px] font-black uppercase tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-2"><Camera className="w-3.5 h-3.5" /> Sahada Çekilen Fotoğraf / Video <span className="text-red-200">*</span></span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{denetimMedya.length} dosya</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {/* Eklenen dosyalar — küçük önizleme + görüntüle + sil */}
                    {denetimMedya.map((url, i) => (
                      <div key={url + i} className="flex items-center gap-2 bg-neutral-50 rounded-lg border border-neutral-200 p-2">
                        {isVideoUrl(url)
                          ? <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0"><Camera className="w-4 h-4 text-white" /></div>
                          : <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-200" onError={e => { e.target.style.display = 'none'; }} />}
                        <span className="text-[11px] font-bold text-neutral-600 flex-1 truncate">{isVideoUrl(url) ? 'Video' : 'Fotoğraf'} {i + 1}</span>
                        <button type="button" onClick={() => setViewingImage({ title: `Saha Denetimi ${i + 1}`, name: url })}
                          className="p-1.5 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition" title="Görüntüle">
                          <Eye className="w-3.5 h-3.5 text-neutral-600" />
                        </button>
                        <button type="button" onClick={() => handleDenetimMedyaSil(url)}
                          className="p-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition" title="Sil">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {/* Şimdi Çek (kamerayı açar) / Galeriden / Dosyadan — çoklu seçim destekli */}
                    <MediaCaptureMenu multiple onChange={handleDenetimMedyaUpload} disabled={denetimMedyaYukleniyor}
                      buttonLabel={denetimMedyaYukleniyor ? 'Yükleniyor...' : 'Fotoğraf / Video Ekle'}
                      buttonClassName="cursor-pointer w-full py-3 bg-orange-50 border border-orange-300 border-dashed rounded-xl flex items-center justify-center gap-2 hover:bg-orange-100 transition text-sm font-black text-orange-700" />
                    {denetimMedya.length === 0 && (
                      <p className="text-[10px] font-bold text-red-500">Denetimin sahada yapıldığının kanıtı olarak en az bir fotoğraf veya video zorunludur.</p>
                    )}
                  </div>
                </div>

                {/* 4) SAHA RAPORU — zorunlu */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-700 text-white px-3 py-2 text-[11px] font-black uppercase tracking-wide flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5" /> Saha Raporu <span className="text-red-300">*</span>
                  </div>
                  <div className="p-3">
                    <textarea value={denetimRapor} onChange={e => setDenetimRapor(e.target.value)}
                      placeholder="Sahada gördüğünüz sorunlar, detaylar, ekstra durumlar... (Örn: müşteri ek eşya çıkardı, asansör yetersizdi, ekip 20 dk geç geldi, ambalaj eksikti vb.)"
                      className="w-full p-3 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none h-28" />
                    <p className="text-[10px] font-bold text-neutral-400 mt-1">Bu rapor yönetim tarafından İnsan Kaynakları → Saha Raporlaması ekranından görüntülenir.</p>
                  </div>
                </div>
              </div>

              {/* Kaydet */}
              <div className="p-3 border-t border-neutral-200 shrink-0 flex gap-2">
                <button onClick={() => { setDenetimJob(null); setDenetimSifirlandi(false); }} className="px-4 py-3 bg-neutral-100 text-neutral-600 font-black rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
                {/* YENİ: SIFIRLA — formdaki tüm girdileri temizler; kaydedildiğinde
                    kayıtlı denetim silinir ve iş hiç denetlenmemiş duruma döner. */}
                <button type="button" onClick={handleDenetimSifirla} disabled={denetimKaydediliyor}
                  className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 font-black rounded-xl transition text-sm flex items-center gap-2 disabled:opacity-60"
                  title="Girilen tüm bilgileri temizle ve denetimi sıfırla">
                  <History className="w-4 h-4" /> Sıfırla
                </button>
                <button onClick={handleSaveDenetim} disabled={denetimKaydediliyor}
                  className={`flex-1 py-3 disabled:opacity-60 text-white font-black rounded-xl transition flex justify-center items-center gap-2 ${denetimSifirlandi ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-700 hover:bg-purple-800'}`}>
                  {denetimKaydediliyor
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> {denetimSifirlandi ? 'Sıfırlanıyor...' : 'Kaydediliyor...'}</>
                    : denetimSifirlandi
                      ? <><History className="w-5 h-5" /> Sıfırlamayı Kaydet ve Kapat</>
                      : <><CheckCircle className="w-5 h-5" /> Denetimi Kaydet ve Kapat</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* YENİ: Ekibi Düzenle Modalı */}
      {/* ======================================================================
          YENİ (kullanıcı talebi): DESTEK PENCERESİ
          ----------------------------------------------------------------------
          Aynı gün İŞİ BİTMİŞ veya HİÇ İŞİ OLMAYAN (boşta) mavi yaka personel
          listelenir; seçilenler bu işe TAKVİYE olarak eklenir.
          Sonuçları:
           • İş kartındaki ekip listesinde "Destek" rozetiyle görünürler
           • Puan onay ekranında "Ekstra Destek" olarak işaretli gelirler
           • MESAİ: destek veren kişi artık İLK ekibine göre değil, EN SON
             dahil olduğu bu ekibin çıkışına göre hesaplanır. Kaynak ekipten
             düşüldüğü için orada kalanların ortalamasını da bozmaz.
          ====================================================================== */}
      {destekJob && (() => {
        const bugununIsleri = (jobs || []).filter(j => j.date === destekJob.date && j.status !== 'cancelled');
        // Bu işin kendi ekibi zaten burada; aday olamaz
        const buIsinEkibi = new Set(isTamEkipIdleri(destekJob));
        // Mavi yaka süzgeci (mesai hesabı yalnızca mavi yakada işler)
        const maviMi = (p) => p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position));
        const adaylar = (personnelList || [])
          .filter(p => maviMi(p) && !buIsinEkibi.has(String(p.id)))
          .map(p => {
            // Kişinin o günkü asıl işi (varsa) ve o iş bitmiş mi
            const kendiIsi = bugununIsleri.find(j => isAsilEkipIdleri(j).includes(String(p.id)));
            const isBitti = !!kendiIsi && (kendiIsi.status === 'completed' || !!kendiIsi.endJobDetails);
            return {
              p,
              kendiIsi,
              isBitti,
              // Uygunluk: işi bitmiş VEYA o gün hiç işi yok (boşta)
              uygun: !kendiIsi || isBitti,
              durum: !kendiIsi ? 'Boşta' : isBitti ? 'İşi bitti' : 'İşi sürüyor',
            };
          })
          // Önce uygun olanlar, sonra ada göre
          .sort((a, b) => (b.uygun - a.uygun) || (a.p.fullName || '').localeCompare(b.p.fullName || '', 'tr'));
        const uygunlar = adaylar.filter(a => a.uygun);
        const mesgul = adaylar.filter(a => !a.uygun);

        const kaydet = async () => {
          setDestekKaydediliyor(true);
          try {
            // Seçilenler için kaynak ekip bilgisiyle birlikte kayıt üretilir
            const kayitlar = destekSecim.map(pid => {
              const a = adaylar.find(x => String(x.p.id) === String(pid));
              const eski = (destekJob.destekKayitlari || []).find(k => String(k.personelId) === String(pid));
              return eski || {
                personelId: String(pid),
                adSoyad: a?.p.fullName || '',
                kaynakIsId: a?.kendiIsi?.id || null,
                kaynakEkip: a?.kendiIsi?.customerName || (a?.kendiIsi ? '' : 'Boşta'),
                // Zincir sıralaması bu damgaya göre yapılır (2., 3., 4. ekip)
                eklenmeZamani: new Date().toISOString(),
                ekleyen: currentUser?.fullName || 'Sistem',
              };
            });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', destekJob.id), {
              destekPersonelIds: destekSecim.map(String),
              destekKayitlari: kayitlar,
            });
            addSystemLog?.('Destek Personeli',
              destekSecim.length === 0
                ? `${destekJob.customerName} işinden tüm destek personeli kaldırıldı.`
                : `${destekJob.customerName} işine ${kayitlar.map(k => k.adSoyad).join(', ')} destek olarak eklendi. Mesaileri bu ekibin çıkışına göre hesaplanacak.`);
            setDestekJob(null);
          } catch (err) { console.error('Destek kaydedilemedi:', err); alert('Destek kaydedilemedi.'); }
          finally { setDestekKaydediliyor(false); }
        };

        return (
          <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDestekJob(null)}>
            <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 bg-cyan-600 text-white shrink-0">
                <h3 className="font-black flex items-center gap-2"><Users className="w-5 h-5" /> Destek Personeli</h3>
                <button onClick={() => setDestekJob(null)} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-3 bg-cyan-50 border-b border-cyan-200 shrink-0">
                <p className="text-sm font-black text-cyan-900">{destekJob.customerName}</p>
                <p className="text-[11px] font-bold text-cyan-700">{destekJob.date} • {destekJob.team}</p>
                <p className="text-[10px] font-bold text-cyan-600 mt-1">
                  Seçilen personel bu ekibe katılır. Mesaisi artık kendi ilk ekibinden değil, BU ekibin çıkış saatinden hesaplanır.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {uygunlar.length === 0 && (
                  <p className="text-center text-xs font-bold text-neutral-400 py-6">Bu gün işi bitmiş veya boşta personel yok.</p>
                )}
                {uygunlar.map(({ p, durum, kendiIsi }) => {
                  const secili = destekSecim.includes(String(p.id));
                  return (
                    <button key={p.id} type="button"
                      onClick={() => setDestekSecim(v => secili ? v.filter(x => x !== String(p.id)) : [...v, String(p.id)])}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition ${secili ? 'border-cyan-500 bg-cyan-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}>
                      <span className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${secili ? 'bg-cyan-600 border-cyan-600' : 'border-neutral-300'}`}>
                        {secili && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-black text-sm text-neutral-800 truncate">{p.fullName}</span>
                        <span className="block text-[10px] font-bold text-neutral-500 truncate">
                          {p.position || 'Personel'} • {durum}{kendiIsi ? ` (${kendiIsi.customerName})` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {/* İşi süren personel bilgi amaçlı, seçilemez halde en altta */}
                {mesgul.length > 0 && (
                  <div className="pt-2 mt-1 border-t border-dashed border-neutral-300">
                    <p className="text-[9px] font-black text-neutral-400 uppercase mb-1.5">İşi süren personel (seçilemez)</p>
                    {mesgul.slice(0, 20).map(({ p, kendiIsi }) => (
                      <div key={p.id} className="flex items-center gap-2 p-2 opacity-50">
                        <span className="w-5 h-5 rounded border-2 border-neutral-200 shrink-0"></span>
                        <span className="text-xs font-bold text-neutral-500 truncate">{p.fullName} — {kendiIsi?.customerName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-neutral-200 shrink-0">
                <button onClick={kaydet} disabled={destekKaydediliyor}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-black rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  {destekKaydediliyor ? 'Kaydediliyor...' : destekSecim.length === 0 ? 'Desteği Kaldır' : `${destekSecim.length} Kişiyi Desteğe Ekle`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
  export const BoardJobCard = ({ job, personnelList, vehicles, materials, dragOverTarget, handleDragOver, handleDragLeave, handleDropToJob, handleDragStart, db, appId, calculateMaterials, skillsMap = {} }) => {
    const [note, setNote] = useState(job.notes || '');
    const [manualName, setManualName] = useState('');

    // YENİ STATE'LER: Sistem harici malzeme ekleme için
    const [customMaterials, setCustomMaterials] = useState(job.customMaterials || []);
    const [newCustomMaterial, setNewCustomMaterial] = useState({ name: '', amount: 1 });

    // YENİ: "Ekip Onaylandı / Düzenle" butonu için ekip düzenleme modalı
    const [showEditTeamModal, setShowEditTeamModal] = useState(false);

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
    const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking, job.type);

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

    // YENİ: Personelin işteki sırasını yukarı/aşağı taşır. Sıra assignedPersonnelIds
    // dizisinde tutulur; teamNames ve team alanları da yeni sıraya göre yeniden yazılır.
    // (1. sıradaki kişi şoför/ekip lideri kabul edildiği için sıralama önemlidir.)
    const handleMovePerson = async (pId, direction) => {
        const ids = [...(job.assignedPersonnelIds || [])];
        const index = ids.findIndex(id => String(id) === String(pId));
        const targetIndex = index + direction; // -1 = yukarı, +1 = aşağı
        if (index === -1 || targetIndex < 0 || targetIndex >= ids.length) return; // Sınır kontrolü
        [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]]; // Yer değiştir
        const sysNames = ids.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
        const allNames = [...sysNames, ...manualNames];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            assignedPersonnelIds: ids,
            assignedPersonnelId: ids[0] || null, // İlk kişi güncellenir
            teamNames: allNames,
            team: allNames.length > 0 ? allNames.join(', ') : 'Atanmadı'
        });
    };

    const handleRemoveManualFromJob = async (nameToRemove) => {
        const newNames = (job.teamNames || []).filter(n => n !== nameToRemove);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            teamNames: newNames,
            team: newNames.length > 0 ? newNames.join(', ') : 'Atanmadı'
        });
    };

    // YENİ: Ekibi Düzenle modalından sistem personeli çıkarma
    const handleRemoveSystemPersonFromJob = async (pIdToRemove) => {
        const newIds = (job.assignedPersonnelIds || []).filter(id => String(id) !== String(pIdToRemove));
        const systemNames = newIds.map(id => personnelList.find(p => String(p.id) === String(id))?.fullName).filter(Boolean);
        const allNames = [...systemNames, ...manualNames];

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
            assignedPersonnelIds: newIds,
            assignedPersonnelId: newIds[0] || null,
            teamNames: allNames,
            team: allNames.length > 0 ? allNames.join(', ') : 'Atanmadı'
        });
    };

    // YENİ: Ekibi Düzenle modalından aracı çıkarma
    const handleRemoveVehicleFromJob = async () => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), { assignedVehiclePlate: '' });
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
      <>
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
               <span className="truncate"><b>Eşya:</b> {(job.esyaDurumu && job.esyaDurumu.length > 0) ? job.esyaDurumu.join(' • ') : job.fromPacking}</span>
            </div>
            {/* YENİ: Teslim Şekli her zaman gösterilir; seçim yoksa "Yok" (eski kayıtlar dahil) */}
            <div className="flex flex-wrap gap-1 pt-1 mt-0.5 border-t border-neutral-100">
              <span className="text-neutral-500 font-bold shrink-0">Teslim:</span>
              {(job.wallMounting && job.wallMounting.length > 0)
                ? job.wallMounting.map(w => (
                    <span key={w} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">{w}</span>
                  ))
                : <span className="bg-neutral-100 text-neutral-500 border border-neutral-200 px-1.5 py-0.5 rounded font-bold">Yok</span>}
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
                    {/* YENİ: Rütbe/pozisyon simgeleri ve özellik puanı — artık burada (iş kartına atanınca) gösteriliyor */}
                    <PersonPositionRankIcons person={person} />
                    <SkillScoreBadge person={person} skillsMap={skillsMap} />
                    {/* YENİ: Personelin işteki sırasını değiştiren yukarı/aşağı butonları */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMovePerson(pId, -1); }}
                        disabled={idx === 0}
                        title="Sırayı yukarı taşı"
                        className={`w-4 h-4 flex items-center justify-center rounded border text-[8px] font-black transition ${idx === 0 ? 'border-neutral-100 text-neutral-200 cursor-not-allowed' : 'border-neutral-200 text-neutral-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300'}`}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMovePerson(pId, 1); }}
                        disabled={idx === (job.assignedPersonnelIds || []).length - 1}
                        title="Sırayı aşağı taşı"
                        className={`w-4 h-4 flex items-center justify-center rounded border text-[8px] font-black transition ${idx === (job.assignedPersonnelIds || []).length - 1 ? 'border-neutral-100 text-neutral-200 cursor-not-allowed' : 'border-neutral-200 text-neutral-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300'}`}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
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
            {/* Depo patpatı YALNIZCA depo işlerinde listelenir */}
            {['strec', 'bant', 'poset', 'kagit', 'koli', ...(job.type === 'Depo' ? ['depoPatpati'] : [])].map(key => (
              <div key={key} className={`flex items-center justify-between border p-1 rounded shadow-sm text-[9px] ${key === 'depoPatpati' ? 'bg-blue-50 border-blue-300' : 'bg-white border-neutral-200'}`}>
                 <span className={`font-bold capitalize ${key === 'depoPatpati' ? 'text-blue-800' : 'text-neutral-700'}`}>{key === 'strec' ? 'Streç' : key === 'kagit' ? 'Kağıt' : key === 'depoPatpati' ? 'Depo Patpatı' : key}</span>
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
            onClick={() => job.isTeamApproved ? setShowEditTeamModal(true) : handleApproveTeam()}
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

      {/* YENİ: Ekibi Düzenle Modalı */}
      {showEditTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditTeamModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-neutral-900 flex items-center justify-between shrink-0">
              <h3 className="font-black text-white text-sm truncate">Ekibi Düzenle — {job.customerName}</h3>
              <button onClick={() => setShowEditTeamModal(false)} className="text-neutral-300 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Atanan Araç</span>
                {job.assignedVehiclePlate ? (
                  <div className="bg-white border border-purple-200 rounded-xl p-2 flex items-center gap-2 shadow-sm">
                    <div className="bg-purple-100 p-1.5 rounded-lg"><Truck className="w-3.5 h-3.5 text-purple-600"/></div>
                    <div className="flex-1"><h4 className="font-bold text-xs text-black tracking-widest">{job.assignedVehiclePlate}</h4></div>
                    <button onClick={handleRemoveVehicleFromJob} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5"/></button>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 font-medium">Araç atanmadı.</p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Görevli Personeller</span>
                <div className="space-y-1.5">
                  {(job.assignedPersonnelIds || []).map(pId => {
                    const person = personnelList.find(p => String(p.id) === String(pId));
                    if (!person) return null;
                    return (
                      <div key={pId} className="bg-white border border-neutral-200 rounded-xl p-2 flex items-center gap-2 shadow-sm">
                        <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                          {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" alt={person.fullName} /> : <User className="w-3.5 h-3.5 text-neutral-400" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-bold text-[11px] text-black truncate">{person.fullName}</h4>
                          <p className="text-[9px] font-medium text-neutral-500 truncate">{person.position}</p>
                        </div>
                        <button onClick={() => handleRemoveSystemPersonFromJob(pId)} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    );
                  })}
                  {manualNames.map((mName, idx) => (
                    <div key={'edit-m'+idx} className="bg-orange-50 border border-orange-200 rounded-xl p-2 flex items-center gap-2 shadow-sm">
                      <div className="w-7 h-7 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
                        <UserPlus className="w-3.5 h-3.5 text-orange-600"/>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-[11px] text-orange-900 truncate">{mName}</h4>
                        <p className="text-[8px] font-medium text-orange-600/70 truncate">Dış Personel</p>
                      </div>
                      <button onClick={() => handleRemoveManualFromJob(mName)} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                  {(job.assignedPersonnelIds || []).length === 0 && manualNames.length === 0 && (
                    <p className="text-[11px] text-neutral-400 font-medium">Ekibe henüz kimse atanmadı.</p>
                  )}
                </div>
                <p className="text-[9px] text-neutral-400 font-medium mt-2">Yeni personel/araç eklemek için tahtadan sürükleyip bırakabilirsiniz.</p>
              </div>
            </div>

            <div className="p-3 border-t border-neutral-200 shrink-0">
              <button onClick={() => setShowEditTeamModal(false)} className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition text-xs">Kapat</button>
            </div>
          </div>
        </div>
      )}
      </>
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
    // YENİ: "Fazla İş Ata" MODU (aç/kapa). Açıkken Ekipler ve Araç listesinde TÜM personel/araç görünür;
    // böylece zaten atanmış olanlar bile ikinci/üçüncü bir işe fazladan sürüklenebilir. Kapalıyken sadece boştakiler görünür.
    const [fazlaIsAtaMode, setFazlaIsAtaMode] = useState(false);
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

    // YENİ: Seçili tarihi gün bazında ileri/geri kaydırır (saat dilimi kaymasını önlemek için yerel tarih parçalarıyla)
    const shiftSelectedDate = (days) => {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() + days);
      const pad = n => String(n).padStart(2, '0');
      setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    };

    let displayPersonnel = maviYakaList.filter(p => {
       const d = mesaiData[p.id]?.[selectedDay];
       const st = typeof d === 'object' && d !== null ? d.status : d;
       if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ', 'D'].includes(st)) return false;  // İzinli/raporlu/devamsız her zaman gizli
       // Fazla İş Ata modu KAPALIYSA: işe atanmış (meşgul) personel de gizlensin
       if (!fazlaIsAtaMode && busyPersonnelIdsThisDay.includes(p.id)) return false;
       return true;
    });

    // YENİ: Aynı pozisyon içinde artık otomatik özellik puanına göre sıralanır
    const skillsMap = React.useMemo(() => computeAllAutoSkills(personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords), [personnelList, jobs, allPersonnelActions, vehicles, allMesaiRecords]);
    const posOrder = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3, 'Operatör': 4 };
    displayPersonnel.sort((a, b) => {
        const orderA = posOrder[a.position] || 99;
        const orderB = posOrder[b.position] || 99;
        if (orderA !== orderB) return orderA - orderB;
        // Özellik puanı kaldırıldı; puana göre sıralama yapılmaz,
        // sıralama sonraki kriterle (isim) devam eder.
        return a.fullName.localeCompare(b.fullName);
    });
    
    // Fazla İş Ata modu AÇIKSA tüm araçlar (atanmış olanlar dahil), KAPALIYSA sadece boştaki araçlar
    let availableVehicles = fazlaIsAtaMode ? [...vehicles] : vehicles.filter(v => !busyVehiclesThisDay.includes(v.plate));
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
            {/* YENİ: Önceki gün oku */}
            <button type="button" onClick={() => shiftSelectedDate(-1)} title="Önceki gün" className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 hover:text-black transition shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <CalendarDays className="w-5 h-5 text-neutral-500" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-black cursor-pointer px-2"
            />
            {/* YENİ: Sonraki gün oku */}
            <button type="button" onClick={() => shiftSelectedDate(1)} title="Sonraki gün" className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 hover:text-black transition shrink-0">
              <ChevronRight className="w-5 h-5" />
            </button>
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
                    skillsMap={skillsMap}
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
                  availableVehicles.map(vehicle => {
                    const vBusy = busyVehiclesThisDay.includes(vehicle.plate); // Bu araç o gün başka işe atanmış mı?
                    return (
                    <div 
                      key={vehicle.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'vehicle', vehicle.plate, 'unassigned')}
                      className={`bg-white border rounded-xl p-2 flex items-center gap-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-purple-400 transition group ${vBusy ? 'border-orange-300 opacity-90' : 'border-neutral-200'}`}
                    >
                      <div className="bg-purple-100 p-1.5 rounded-lg shrink-0"><Truck className="w-3.5 h-3.5 text-purple-600"/></div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1">
                          <h4 className="font-bold text-[11px] text-black tracking-widest">{vehicle.plate}</h4>
                          {vBusy && <span className="text-[8px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded font-black border border-orange-200 shrink-0">MEŞGUL</span>}
                        </div>
                        <p className="text-[9px] font-medium text-neutral-500">{vehicle.type} • {vehicle.capacity[0] || '?'} Ev</p>
                      </div>
                      <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Personel Havuzu */}
            <div className="h-[340px] lg:flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden shrink-0 lg:shrink">
              <div className="p-2.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-xs text-black flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-orange-500" /> Ekipler
                </h3>
                {/* YENİ: Fazla İş Ata — modal açmaz; modu aç/kapatır. Açıkken tüm personel/araç görünür ve ikinci işe fazladan atanabilir. */}
                <button
                  type="button"
                  onClick={() => setFazlaIsAtaMode(m => !m)}
                  title={fazlaIsAtaMode ? 'Fazla İş Ata modu açık — kapatmak için tıklayın' : 'Fazla İş Ata modunu aç (tüm personel/araç görünür)'}
                  className={`text-[9px] font-black px-2 py-1 rounded-lg shadow-sm transition flex items-center gap-1 ${fazlaIsAtaMode ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-300' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                >
                  <UserPlus className="w-3 h-3" /> {fazlaIsAtaMode ? 'Fazla İş: AÇIK' : 'Fazla İş Ata'}
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
                        {/* Rütbe/puan simgeleri buradan kaldırıldı; sadece iş kartına atanınca gösteriliyor. */}
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
    // YENİ: IBAN paylaşım penceresi. Hangi işin müşterisiyle paylaşılacağını tutar.
    // null ise pencere kapalı.
    const [ibanPaylasJob, setIbanPaylasJob] = useState(null);
    const [ibanKopyalandi, setIbanKopyalandi] = useState(false);

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
              // YENİ: Kullanıcı Ekip Şefi veya Usta (Heryerden Usta/Kalfa) rütbesinde mi?
              const isSefOrUsta = ['Ekip Şefi', 'Heryerden Usta', 'Kalfa'].includes(currentUser?.rank);
              // YENİ: İşi Sonlandır butonu ne zaman görünsün?
              // - Şef/Usta ise: iş atandığında (tamamlanmadıysa) HER ZAMAN görünür.
              // - Diğerleri (standart mavi yaka): eskisi gibi sadece iş "sürüyor" ve asıl görevliyse.
              const canEndJob = job.status !== 'completed' && (isSefOrUsta || (job.status === 'in-progress' && isMainAssignee));

              return (
              <div key={job.id} className="p-5 border border-neutral-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                    <div>
                      {/* YENİ: Müşteri ismi + IBAN Paylaş butonu yan yana.
                          Buton SADECE Ekip Şefi / Usta rütbelerinde görünür; standart
                          mavi yaka müşteri bilgisini hiç görmediği için ona gösterilmez. */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-black text-lg">
                           {isStandardBlueCollar ? 'Operasyon Görevi' : job.customerName}
                        </h3>
                        {!isStandardBlueCollar && (
                          <button type="button" onClick={() => { setIbanPaylasJob(job); setIbanKopyalandi(false); }}
                            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition shadow-sm">
                            <Landmark className="w-3.5 h-3.5" /> IBAN Paylaş
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-neutral-500 flex items-center gap-1.5 mt-1">
                        <CalendarDays className="w-4 h-4" /> {job.date}
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
                      <p className="text-[10px] ml-5 text-neutral-500 font-bold mt-1">Daire: {job.fromRoomCount} | Kat: {job.fromFloor} | Şekil: {job.fromTransportMethod} | Eşya: {(job.esyaDurumu && job.esyaDurumu.length > 0) ? job.esyaDurumu.join(' • ') : job.fromPacking}</p>
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
                          <p className="text-[10px] ml-5 text-neutral-500 font-bold mt-1">Daire: {job.toRoomCount} | Kat: {job.toFloor} | Şekil: {job.toTransportMethod} | Teslim: {(job.wallMounting && job.wallMounting.length > 0) ? job.wallMounting.join(' • ') : 'Yok'}</p>
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
                        const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking, job.type);
                        return (
                          <>
                            <span><b>{est.strec}</b> Streç</span>
                            <span><b>{est.bant}</b> Bant</span>
                            <span><b>{est.poset}</b> Poşet</span>
                            <span><b>{est.kagit}kg</b> Kağıt</span>
                            <span><b>{est.koli}</b> Koli</span>
                            {job.type === 'Depo' && est.depoPatpati > 0 && <span className="text-blue-700"><b>{est.depoPatpati}</b> Depo Patpatı</span>}
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
                    <div className="mt-2 bg-green-50 border border-green-200 p-3 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-green-800 flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-green-600"/> Anlaşılan Ücret</span>
                        <div className="text-right">
                          <span className="block text-lg font-black text-green-700">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                          {job.deposit && <span className="block text-[10px] font-bold text-green-600">Kapora: ₺{parseInt(job.deposit).toLocaleString('tr-TR')}</span>}
                        </div>
                      </div>
                      {/* YENİ: Net Bakiye = Anlaşılan Ücret − Kapora. Tahsil edilecek tutar, diğerlerinden daha BÜYÜK ve belirgin gösterilir. */}
                      <div className="mt-3 pt-3 border-t-2 border-green-200 border-dashed flex items-center justify-between">
                        <span className="text-sm font-black text-green-900 flex items-center gap-1.5"><Wallet className="w-5 h-5 text-green-700"/> Tahsil Edilecek Net Bakiye</span>
                        <span className="text-2xl md:text-3xl font-black text-green-700 leading-none">₺{(parseInt(job.price || 0) - parseInt(job.deposit || 0)).toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                 )}

                 {/* İŞİ SONLANDIR — Şef/Usta için her zaman, diğerleri için iş sürüyorsa (asıl görevli) */}
                 {canEndJob && (
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

                 {/* SONLANDIRMA SONRASI DÜZENLEME (SADECE ASIL GÖREVLİ) — süre sınırı yok, her zaman aktif */}
                 {job.status === 'completed' && isMainAssignee && (() => {
                    // Kasa/İş fotoğrafı eklenmiş mi? ('Yükleniyor...' geçici değerini saymıyoruz.)
                    const kasaFotoVar = (job.endJobDetails?.truckImages || []).filter(img => img && img !== 'Yükleniyor...').length > 0;
                    // YENİ: Teslim edilen yerin fotoğrafı eklenmiş mi?
                    const teslimFotoVar = (job.endJobDetails?.deliveryImages || []).filter(img => img && img !== 'Yükleniyor...').length > 0;

                    return (
                      <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4">
                        {/* Kasa/İş fotoğrafı eksikse uyarı bildirimi */}
                        {!kasaFotoVar && (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-xl text-sm font-medium">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                            <span>Bu işe <b>Kasa / İş fotoğrafı</b> eklemeyi unutmuşsunuz. Aşağıdaki butondan düzenleyip fotoğrafı ekleyebilirsiniz.</span>
                          </div>
                        )}
                        {/* YENİ: Teslim yeri fotoğrafı eksikse uyarı bildirimi */}
                        {!teslimFotoVar && (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-xl text-sm font-medium">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                            <span>Bu işe <b>Teslim edilen yerin fotoğrafı</b> eklemeyi unutmuşsunuz. Aşağıdaki butondan düzenleyip ekleyebilirsiniz.</span>
                          </div>
                        )}
                        {/* Düzenleme butonu — sonlandırma modalını mevcut bilgilerle açar (her zaman aktif) */}
                        <button onClick={() => handleOpenEndJobModal(job)} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition flex justify-center items-center gap-2 shadow-md text-sm">
                          <Edit className="w-5 h-5" /> Sonlandırmayı Düzenle
                        </button>
                      </div>
                    );
                 })()}
              </div>
           )})}
        </div>

        {/* ==================================================================
            YENİ: IBAN PAYLAŞ PENCERESİ
            ==================================================================
            Ekip şefi müşteriye ödeme bilgisini üç yolla iletebilir:
              1) QR kodu göstererek (müşteri telefonuyla okutur)
              2) SMS ile
              3) WhatsApp ile
            Banka bilgileri Resmi Ayarları'ndaki VARSAYILAN hesaptan okunur;
            sabit yazılmadı, panelden değiştirilince burası da güncellenir. */}
        {ibanPaylasJob && (() => {
          const hesap = aktifBankaHesabi();
          const telefon = (ibanPaylasJob.customerPhone || '').replace(/\D/g, '');
          // Türkiye numarası: 0 ile başlıyorsa at, 90 yoksa ekle.
          const telUlusal = telefon.startsWith('0') ? telefon.slice(1) : telefon;
          const telWa = telUlusal.startsWith('90') ? telUlusal : `90${telUlusal}`;
          const kalan = Math.max(0, (parseFloat(ibanPaylasJob.price) || 0) - (parseFloat(ibanPaylasJob.deposit) || 0));

          // Müşteriye gidecek metin. SMS ve WhatsApp aynı metni kullanır ki
          // müşteri hangi kanaldan alırsa aynı bilgiyi görsün.
          const mesaj =
            `Sayın ${ibanPaylasJob.customerName || ''},\n\n` +
            `Sembol Nakliyat ödeme bilgileriniz:\n\n` +
            `Banka: ${hesap.banka}\n` +
            `Alıcı: ${hesap.aliciAdi}\n` +
            `IBAN: ${ibanBicimle(hesap.iban)}\n\n` +
            (kalan > 0 ? `Kalan bakiye: ${kalan.toLocaleString('tr-TR')} TL\n\n` : '') +
            `Ödeme açıklamasına teslim kodunuzu (${ibanPaylasJob.deliveryCode || '-'}) yazmanızı rica ederiz.\n\n` +
            `İyi günler dileriz.`;

          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">

                {/* BAŞLIK */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 sticky top-0 bg-white">
                  <div className="min-w-0">
                    <div className="font-black text-black flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-emerald-600" /> Ödeme Bilgisi Paylaş
                    </div>
                    <p className="text-[11px] font-bold text-neutral-500 truncate mt-0.5">{ibanPaylasJob.customerName}</p>
                  </div>
                  <button onClick={() => setIbanPaylasJob(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition shrink-0">
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>

                <div className="p-4 space-y-4">

                  {/* QR KODU — müşteri kendi bankacılık uygulamasıyla okutur */}
                  {hesap.qrUrl ? (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-3">
                        Müşteriye okutmak için QR
                      </p>
                      <img src={hesap.qrUrl} alt="Banka QR kodu"
                        className="w-48 h-48 mx-auto object-contain bg-white rounded-xl p-2 border border-neutral-200" />
                      <p className="text-[11px] font-bold text-neutral-600 mt-3 leading-relaxed">
                        Müşteri kendi bankacılık uygulamasından bu kodu okutarak ödeme yapabilir.
                      </p>
                    </div>
                  ) : (
                    /* QR yüklenmemişse sessiz kalmıyoruz; nerede tanımlanacağını söylüyoruz. */
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                        QR kodu tanımlı değil. Yönetici, Sistem Dosyaları &gt; Resmi Ayarları bölümünden
                        banka QR görselini yükleyebilir. IBAN bilgileri aşağıda yine paylaşılabilir.
                      </p>
                    </div>
                  )}

                  {/* HESAP BİLGİLERİ */}
                  <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="bg-neutral-900 text-white px-4 py-2.5 text-[10px] font-black uppercase tracking-wider">
                      Hesap Bilgileri
                    </div>
                    <div className="divide-y divide-neutral-100">
                      <div className="px-4 py-2.5 flex justify-between gap-3">
                        <span className="text-[11px] font-bold text-neutral-500 shrink-0">Banka</span>
                        <span className="text-xs font-black text-black text-right">{hesap.banka}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-3">
                        <span className="text-[11px] font-bold text-neutral-500 shrink-0">Alıcı</span>
                        <span className="text-xs font-black text-black text-right">{hesap.aliciAdi}</span>
                      </div>
                      <div className="px-4 py-3">
                        <div className="text-[11px] font-bold text-neutral-500 mb-1">IBAN</div>
                        {/* font-mono + tracking: rakamlar tek tek okunabilsin */}
                        <div className="text-sm font-black text-black font-mono tracking-wide break-all">
                          {ibanBicimle(hesap.iban)}
                        </div>
                      </div>
                      {kalan > 0 && (
                        <div className="px-4 py-2.5 flex justify-between gap-3 bg-emerald-50">
                          <span className="text-[11px] font-bold text-emerald-700 shrink-0">Kalan Bakiye</span>
                          <span className="text-sm font-black text-emerald-800">{kalan.toLocaleString('tr-TR')} TL</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* IBAN'I KOPYALA — şef kendi kanalından iletmek isterse */}
                  <button type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(ibanBicimle(hesap.iban));
                      setIbanKopyalandi(true);
                      setTimeout(() => setIbanKopyalandi(false), 2000);
                    }}
                    className="w-full py-3 rounded-xl border border-neutral-300 text-xs font-black text-neutral-700 hover:bg-neutral-50 transition flex items-center justify-center gap-2">
                    {ibanKopyalandi
                      ? <><CheckCircle className="w-4 h-4 text-green-600" /> IBAN kopyalandı</>
                      : <><FileText className="w-4 h-4" /> IBAN'ı kopyala</>}
                  </button>

                  {/* PAYLAŞIM BUTONLARI */}
                  {telefon ? (
                    <div className="grid grid-cols-2 gap-3">
                      {/* SMS: sms: protokolü. body parametresi iOS ve Android'de
                          desteklenir; metin encodeURIComponent ile kodlanır ki
                          Türkçe karakterler ve satır sonları bozulmasın. */}
                      <a href={`sms:${telefon}?body=${encodeURIComponent(mesaj)}`}
                        className="py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center justify-center gap-2">
                        <MessageSquareText className="w-4 h-4" /> SMS ile Paylaş
                      </a>
                      {/* WhatsApp: numara uluslararası biçimde (90...) gönderilir */}
                      <a href={`https://api.whatsapp.com/send?phone=${telWa}&text=${encodeURIComponent(mesaj)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xs transition flex items-center justify-center gap-2">
                        <MessageCircle className="w-4 h-4" /> WhatsApp ile Paylaş
                      </a>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] font-bold text-red-800">
                      Müşteri telefon numarası kayıtlı değil. SMS veya WhatsApp gönderilemez.
                    </div>
                  )}

                  {/* GÖNDERİLECEK METİN ÖNİZLEMESİ — şef ne gittiğini görsün */}
                  <details className="border border-neutral-200 rounded-xl overflow-hidden">
                    <summary className="px-4 py-2.5 bg-neutral-50 text-[11px] font-black text-neutral-600 cursor-pointer">
                      Gönderilecek mesajı gör
                    </summary>
                    <pre className="px-4 py-3 text-[11px] text-neutral-700 whitespace-pre-wrap font-sans leading-relaxed">{mesaj}</pre>
                  </details>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ============================================================================
  // YENİ: İŞ MERKEZİ — TEK SAYFADA KATEGORİ BUTONLARI
  // Daha önce sol menüde ayrı ayrı duran "Mevcut İşler", "Tamamlanan İşler" ve
  // "İptal Edilen İşler" bölümleri buraya taşındı. Sol menüde artık yalnızca
  // "Tüm İşler" var; kategoriler bu sayfanın en üstündeki butonlardan seçilir.
  // Her butona basıldığında ilgili MEVCUT bileşen (kodu değişmeden) render edilir.
  // ============================================================================
  export const IsMerkeziView = ({
    jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials,
    setCancelJobId, setViewingImage, setDeleteJobId, setMarkDamageJobId, canApprovePoints,
    handleOpenApproveModal, handleOpenMesaiModal, handleOpenResolveDamageModal, handleRestoreJob,
    sahaDenetimleri = []
  }) => {
    // Açılışta "Tüm İşler" sekmesi seçilidir
    const [kategori, setKategori] = useState('all');

    // Sekme butonları: id, etiket, ikon, aktif renk ve canlı sayaç
    const SEKMELER = [
      { id: 'all',       label: 'Tüm İşler',          icon: ClipboardList, renk: 'bg-red-600',    sayac: jobs.length },
      { id: 'current',   label: 'Mevcut İşler',       icon: Clock,         renk: 'bg-orange-600', sayac: jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length },
      { id: 'completed', label: 'Tamamlanan İşler',   icon: CheckCircle,   renk: 'bg-black',      sayac: jobs.filter(j => j.status === 'completed').length },
      { id: 'cancelled', label: 'İptal Edilen İşler', icon: Ban,           renk: 'bg-red-700',    sayac: jobs.filter(j => j.status === 'cancelled').length },
    ];

    return (
      <div className="space-y-4 animate-in fade-in">
        {/* ÜST KATEGORİ BUTONLARI */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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

        {/* SEÇİLEN KATEGORİNİN MEVCUT BİLEŞENİ (kodları değiştirilmeden kullanılır) */}
        {kategori === 'all' && (
          <AllJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal}
            handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials}
            setCancelJobId={setCancelJobId} setDeleteJobId={setDeleteJobId} />
        )}
        {kategori === 'current' && (
          <CurrentJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal}
            handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials}
            setCancelJobId={setCancelJobId} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} />
        )}
        {kategori === 'completed' && (
          <CompletedJobsView jobs={jobs} sahaDenetimleri={sahaDenetimleri} handleEditJob={handleEditJob} setViewingImage={setViewingImage}
            setDeleteJobId={setDeleteJobId} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints}
            handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal}
            handleOpenResolveDamageModal={handleOpenResolveDamageModal} />
        )}
        {kategori === 'cancelled' && (
          <CancelledJobsView jobs={jobs} handleEditJob={handleEditJob} handleRestoreJob={handleRestoreJob} setDeleteJobId={setDeleteJobId} />
        )}
      </div>
    );
  };

  // ============================================================================
  // YENİ: İŞ KILAVUZU VE İŞ ŞEMASI MODÜLÜ — Operasyon Bölümü'nün parçası olarak
  // buraya taşındı (önceden ayrı IsKilavuzu.jsx dosyasındaydı; içerik AYNEN
  // korunmuştur, sadece import satırları yukarıdaki ortak import bloğuyla
  // birleştirildi)
  // ============================================================================

// ============================================================================
// İŞ KILAVUZU VE İŞ ŞEMASI MODÜLÜ
// Her pozisyon için: ÖZET (bu iş nedir), İŞ KILAVUZU (görevler + altın kurallar)
// ve İŞ ŞEMASI (tipik bir iş gününün adım adım akışı).
// - Mavi Yaka / Beyaz Yaka sekmeleri, pozisyon kartları.
// - Personel kendi pozisyonunu "Benim Pozisyonum" rozetiyle görür ve sayfa
//   açıldığında otomatik o pozisyon seçili gelir.
// - VARSAYILAN İÇERİK: Aşağıdaki KILAVUZ_VARSAYILAN, Sembol CRM'in gerçek iş
//   akışına göre (ekip tahtası, teslim kodu, şef denetimi, hasar bildirimi,
//   puantaj, Paraşüt e-fatura, müşteri havuzu...) hazırlanmıştır.
// - DÜZENLENEBİLİR: Yetkili kullanıcılar (canEdit / Firma Sahibi / Müdür)
//   her pozisyonun içeriğini düzenleyebilir; kayıt Firebase 'isKilavuzu'
//   koleksiyonuna yazılır ve varsayılanın yerine geçer. Böylece ileride
//   pozisyonlara göre kendi içeriklerinizi ekleyebilirsiniz.
// ============================================================================

// Pozisyon tanımları: yaka, ikon ve varsayılan içerik
export const KILAVUZ_VARSAYILAN = [
  // ============================ MAVİ YAKA ============================
  {
    id: 'sofor', pozisyon: 'Şoför', yaka: 'Mavi Yaka', ikon: Truck,
    ozet: 'Aracın ve yolun sorumlusudur. Ekibi ve eşyayı güvenle adrese ulaştırır; araç bakım-muayene takibinin sahadaki gözüdür.',
    gorevler: [
      'Gün başında aracın yakıt, lastik, yağ ve genel durumunu kontrol etmek; sorun varsa Araç Bakım kaydı açtırmak',
      'Ekip Kurma Tahtası\'ndan günün işini ve ekip arkadaşlarını öğrenmek',
      'Yükleme sırasında aracın dengeli ve güvenli istiflenmesini sağlamak',
      'Adres ve rota planını iş kaydındaki bilgilerden doğrulamak (AL/VR adresleri)',
      'Trafik ve yük güvenliği kurallarına eksiksiz uymak',
      'İş sonunda kamyon kasası fotoğrafını sisteme yüklemek (Operasyonu Sonlandır ekranı)',
    ],
    kurallar: [
      'Teslim kodu MÜŞTERİDEN istenir; kod olmadan iş kapatılmaz',
      'Araçta hasar/arıza fark edildiğinde aynı gün bildirilir',
      'Kapora ve tahsilat bilgisi yalnızca iş kaydındaki tutarlara göre alınır',
    ],
    akis: [
      { baslik: 'Araç Kontrolü', detay: 'Yakıt, lastik, kasa temizliği ve ekipman kontrolü yapılır.' },
      { baslik: 'Ekip ve İş Bilgisi', detay: 'Ekip Kurma Tahtası\'ndan görev, saat ve adres öğrenilir.' },
      { baslik: 'Yükleme', detay: 'Eşya güvenli şekilde istiflenir; kasadaki yerleşim fotoğraflanır.' },
      { baslik: 'Nakliye / Teslimat', detay: 'Rota takip edilir, müşteri adresine zamanında ulaşılır.' },
      { baslik: 'İş Sonu', detay: 'Müşteriden teslim kodu alınır, kasa fotoğrafı yüklenir, operasyon sonlandırılır.' },
    ],
  },
  {
    id: 'tasima', pozisyon: 'Taşıma Elemanı', yaka: 'Mavi Yaka', ikon: Users,
    ozet: 'Eşyanın elden ele güvenle taşınmasından sorumludur. Ambalajlama, taşıma ve yerleştirmenin bel kemiğidir.',
    gorevler: [
      'Eşyaları hasar görmeyecek şekilde ambalajlamak ve taşımak',
      'Kırılacak eşyaları (cam, ayna, beyaz eşya) özel koruma ile paketlemek',
      'Ekip şefinin yönlendirmesine göre yükleme/boşaltma sırasına uymak',
      'Müşteri eşyasına kendi eşyası gibi özen göstermek',
      'Teslimatta eşyaları müşterinin istediği odalara yerleştirmek',
    ],
    kurallar: [
      'Hasar oluşursa saklanmaz; anında ekip şefine bildirilir (hasar bildirimi sisteme işlenir)',
      'Müşteriyle fiyat/tahsilat konuşulmaz; bu konu ekip şefi ve ofisin işidir',
      'Ağır eşya tek başına kaldırılmaz; ekip çalışması esastır',
    ],
    akis: [
      { baslik: 'Hazırlık', detay: 'Koli, streç, battaniye gibi malzemeler araçtan indirilir.' },
      { baslik: 'Ambalajlama', detay: 'Eşyalar oda oda paketlenir, kırılacaklar işaretlenir.' },
      { baslik: 'Yükleme', detay: 'Şoför ve şef koordinasyonunda araç yüklenir.' },
      { baslik: 'Boşaltma & Yerleştirme', detay: 'Eşyalar istenen odalara taşınır, montaj ekibine alan açılır.' },
      { baslik: 'Toplama', detay: 'Ambalaj atıkları toplanır, alan temiz teslim edilir.' },
    ],
  },
  {
    id: 'mobilya', pozisyon: 'Mobilya Ustası', yaka: 'Mavi Yaka', ikon: Wrench,
    ozet: 'Mobilyaların sökümü ve kurulumunun uzmanıdır. Duvar montajları ve hassas işçilik onun elindedir.',
    gorevler: [
      'Çıkış adresinde mobilyaları hasarsız sökmek, vida/aksesuarları poşetleyip işaretlemek',
      'Varış adresinde mobilyaları eksiksiz kurmak',
      'İş kaydındaki duvar montajı taleplerini (TV, avize, perde...) uygulamak',
      'Söküm sırasında fark edilen mevcut hasarları işe başlamadan fotoğraflayıp bildirmek',
      'El aletlerinin ve makinelerin bakımını, tam olmasını sağlamak',
    ],
    kurallar: [
      'Vida ve parçalar asla açıkta bırakılmaz; her mobilyanın parçası kendi poşetinde taşınır',
      'Duvar delme işlemlerinde tesisat (elektrik/su) kontrolü yapmadan delinmez',
      'Kurulumu biten mobilya müşteriye kontrol ettirilir',
    ],
    akis: [
      { baslik: 'Keşif', detay: 'Sökülecek mobilyalar incelenir, mevcut hasarlar fotoğraflanır.' },
      { baslik: 'Söküm', detay: 'Mobilyalar sırayla sökülür, parçalar etiketlenir.' },
      { baslik: 'Taşıma Desteği', detay: 'Hassas parçaların ambalajına nezaret edilir.' },
      { baslik: 'Kurulum', detay: 'Varışta mobilyalar kurulur, duvar montajları yapılır.' },
      { baslik: 'Müşteri Onayı', detay: 'Kurulan her parça müşteriyle birlikte kontrol edilir.' },
    ],
  },
  {
    id: 'depo', pozisyon: 'Depo Sorumlusu', yaka: 'Mavi Yaka', ikon: Package,
    ozet: 'Depo tesislerinin düzeninden, giren-çıkan eşyanın kaydından ve güvenliğinden sorumludur.',
    gorevler: [
      'Depoya giren eşyaların giriş belgesini ve fotoğraflarını sisteme yüklemek',
      'Eşyaları müşteri bazında etiketleyip depo planına göre yerleştirmek',
      'Çıkış yapan eşyalarda çıkış belgesi düzenlemek ve eşya teslim tutanağı almak',
      'Depo temizliği, ilaçlama ve aydınlatma gibi tesis sorunlarını takip edip bildirmek',
      'Dönemsel sayım yaparak kayıtlarla fiili durumu karşılaştırmak',
    ],
    kurallar: [
      'Belgesiz hiçbir eşya depoya alınmaz ve depodan çıkarılmaz',
      'Müşteri eşyası yalnızca yetkili kişiye, kimlik kontrolüyle teslim edilir',
      'Nem, haşere veya hasar riski görüldüğünde aynı gün rapor edilir',
    ],
    akis: [
      { baslik: 'Giriş Kabul', detay: 'Gelen eşya sayılır, fotoğraflanır, giriş belgesi sisteme yüklenir.' },
      { baslik: 'Yerleştirme', detay: 'Eşya etiketlenir ve müşteriye ayrılan alana istiflenir.' },
      { baslik: 'Saklama Takibi', detay: 'Periyodik kontrol: nem, ilaçlama, düzen.' },
      { baslik: 'Çıkış Hazırlığı', detay: 'Çıkış tarihi gelen eşya hazırlanır, çıkış belgesi düzenlenir.' },
      { baslik: 'Teslim', detay: 'Eşya sayım ve tutanakla müşteriye/ekibe teslim edilir.' },
    ],
  },
  {
    id: 'temizlik', pozisyon: 'Temizlik Görevlisi', yaka: 'Mavi Yaka', ikon: Sparkles,
    ozet: 'Depo tesislerinin ve ofisin hijyeninden sorumludur; temiz tesis, müşteri güveninin ilk adımıdır.',
    gorevler: [
      'Depo koridorları, ofis ve ortak alanların günlük temizliğini yapmak',
      'Temizlik malzemesi stoklarını takip edip eksikleri bildirmek',
      'Nakliye sonrası araç kasalarının temizliğine destek olmak',
      'Tesiste fark edilen arıza ve sorunları (ışık, kapı, su kaçağı) bildirmek',
    ],
    kurallar: [
      'Kimyasal malzemeler etiketli ve kilitli alanda saklanır',
      'Müşteri eşyasının bulunduğu alanlarda eşyalara dokunulmaz, sadece zemin/çevre temizlenir',
    ],
    akis: [
      { baslik: 'Günlük Tur', detay: 'Tesis gezilir, temizlik ihtiyacı olan alanlar belirlenir.' },
      { baslik: 'Temizlik', detay: 'Plan dahilinde alanlar temizlenir.' },
      { baslik: 'Malzeme Kontrolü', detay: 'Stok kontrol edilir, eksikler malzeme listesine bildirilir.' },
      { baslik: 'Raporlama', detay: 'Fark edilen tesis sorunları sorumluya iletilir.' },
    ],
  },
  {
    id: 'operator', pozisyon: 'Operatör', yaka: 'Mavi Yaka', ikon: ArrowDown,
    ozet: 'Dış cephe asansörünün kurulum ve kullanım uzmanıdır. Asansör işlerinin güvenli yürütülmesinden sorumludur.',
    gorevler: [
      'Asansör kurulum noktasını (cephe, elektrik, zemin) kontrol etmek',
      'Asansörü güvenlik standartlarına göre kurmak ve sabitlemek',
      'Taşıma boyunca asansörü kumanda etmek; yük sınırını aşmamak',
      'İş bitiminde ekipmanı söküp eksiksiz araca yüklemek',
    ],
    kurallar: [
      'Rüzgâr ve hava koşulları uygun değilse kurulum yapılmaz, ofis bilgilendirilir',
      'Asansör platformuna insan bindirilmez; yalnızca eşya taşınır',
      'Elektrik bağlantısı yalnızca topraklı ve uygun hatlardan alınır',
    ],
    akis: [
      { baslik: 'Keşif', detay: 'Cephe, kat yüksekliği ve elektrik durumu kontrol edilir.' },
      { baslik: 'Kurulum', detay: 'Asansör güvenlik kilitleriyle kurulur, test yüklemesi yapılır.' },
      { baslik: 'Operasyon', detay: 'Eşyalar kat ile zemin arasında kontrollü taşınır.' },
      { baslik: 'Söküm', detay: 'Ekipman sökülür, parçalar sayılarak araca yüklenir.' },
    ],
  },
  // ============================ BEYAZ YAKA ============================
  {
    // ========================================================================
    // YENİ: SATIŞ PERSONELİ — SEMBOL NAKLİYAT ve DEPOEVİM oryantasyon
    // kılavuzlarından derlenip iki ayrı alt sekmeye (firma) bölündü.
    // "altSekmeler" alanı olan pozisyonlarda IsKilavuzuView üstte bir
    // firma seçici gösterir; her firma kendi özet/görev/kural/akış +
    // zengin ek bölümlerine (avantajlar, hazır cümleler, itiraz karşılama,
    // fiyat özeti, 1 haftalık eğitim planı) sahiptir. Yeni işe başlayan
    // bir Satış Personeli, hangi firmada çalışacaksa o sekmeyi seçip
    // baştan sona kendi kendine öğrenebilir.
    // ========================================================================
    id: 'satis', pozisyon: 'Satış Personeli', yaka: 'Beyaz Yaka', ikon: Headphones,
    ozet: 'Müşterinin ilk temas noktasıdır. Telefon ve WhatsApp\'tan gelen talebi karşılar, fiyat verir, Müşteri Havuzu\'ndaki adayları kayda dönüştürür. Sembol Nakliyat (evden eve nakliyat) ve Depoevim (eşya depolama) olmak üzere iki ayrı iş kolu vardır — aşağıdan çalıştığın firmayı seç.',
    altSekmeler: [
      {
        id: 'sembol', baslik: 'Sembol Nakliyat',
        ozet: 'Sembol Nakliyat, 2004\'ten beri İstanbul Pendik\'te evden eve nakliyat, asansörlü taşıma ve depolama hizmeti veriyor (2004\'ten beri 20.000+ ev taşıma, 25 kadrolu çalışan, 10 araçlık filo). Telefondaki ilk sesin sensin — müşterinin firmaya güveni seninle başlar. İşi sana Mehmet Şen öğretir (takıldığında ilk ona danış); işi bağladıktan sonra Operasyon Şefi Mehmet Tutal tamamlar (hasar/şikâyet de ona gider).',
        gorevler: [
          'Telefonları karşılamak: "Sembol Nakliyat, ben [adın], hayırlı günler, nasıl yardımcı olabilirim?"',
          'Fiyat vermeden önce 7 soruyu sormak (oda sayısı, güzergâh, kat, asansör, toplama, kamyon yanaşması, tarih)',
          'Fiyat listesinden (şehir içi taban + ekler, şehirler arası 81 il) en yakın ortalama fiyatı vermek',
          'Kesin fiyat için eşyanın video/fotoğrafını istemek — video gelmeden kesin fiyat verilmez',
          'Konuştuğun her müşteriyi (isim, telefon, cevaplar) not defterine/CRM\'e yazmak, tek bir kayıtsız arama bırakmamak',
          'Saat 10:30\'dan sonra tüm cevapsız aramaları tek tek geri aramak',
          'WhatsApp (hem cep hem sabit hat) ve Instagram mesajlarını yanıtlamak, günde 3 Instagram paylaşımı yapmak',
          'Video gelince net fiyatı verip Sembol CRM\'de kaydı açmak, %20 kapora isteyip sözleşmeyi PDF olarak göndermek',
        ],
        kurallar: [
          '7 soru fiyatın kalbidir — video/foto gelmeden KESİN fiyat asla verilmez, sadece "ortalama" denir',
          'Kayıt taşımadan 15 gün öncesine kadar açılabilir; kayıt açan müşteriden iş fiyatının %20\'si kapora alınır',
          'Sözleşmedeki güvenlik/teslim kodunu müşteriye anlat — eşya ancak bu kodla teslim edilir',
          'Taşımaya 72 saatten fazla varsa iptal/erteleme kapora hariç ücretsizdir; 72 saatten az kalan iptalde toplam bedelin %50\'si cayma tazminatıdır',
          'Yapılmayan hizmetleri baştan söyle: klima söküm-montajı, duvar montajı, elektrik işleri yapılmaz; avize/perde/ankastre sökülür ama montajı yapılmaz',
          'Emin olmadığın bir fiyat/durumda Mehmet Bey\'e (Mehmet Şen) ekran görüntüsü at, tahmini fiyat verme',
          'Şehirler arası taşımalarda eşya araca yüklendikten sonra %50 ödeme alınır',
        ],
        akis: [
          { baslik: '1. Karşılama', detay: '"Sembol Nakliyat, ben [adın], hayırlı günler" — güven veren, sıcak bir açılış.' },
          { baslik: '2. Hizmeti Öv', detay: 'Sigortalı taşıma, profesyonel ekip, dış asansör imkânını kısaca anlat.' },
          { baslik: '3. 7 Soruyu Sor', detay: 'Oda sayısı, güzergâh, kat, asansör, toplama, kamyon yanaşması, tarih.' },
          { baslik: '4. Fiyat Listesine Bak', detay: 'Şehir içi: taban + ekler • Şehirler arası: 81 il tablosu.' },
          { baslik: '5. Ortalama Fiyat Ver + Video İste', detay: '"Video atarsanız fiyatta yardımcı oluruz" — kesin fiyat videoya bağlıdır.' },
          { baslik: '6. Kaydet', detay: 'İsim, telefon ve verdiğin cevapları not defterine/CRM\'e yaz, bilgilendirme mesajı gönder.' },
          { baslik: '7. Teyit + Kapat', detay: 'Özetle, ofise davet et, kibarca kapat.' },
          { baslik: '8. Takip + Sözleşme', detay: 'Video gelince net fiyatı ver, %20 kapora al, sözleşmeyi PDF olarak gönder.' },
        ],
        avantajlar: [
          'Ekibin tamamı kadrolu — günübirlik/dışarıdan işçi yok; eşyaya kimin dokunduğunu biliyoruz',
          'Her işte bir Ekip Şefi vardır: işi o yönetir, teslim kodunu o alır, sorumluluğu o taşır',
          'Mobilya ustaları söküm-montajı kusursuz yapar, özel ambalaj malzemesi kullanılır',
          '60+ başarı hikâyesi ve güçlü Google yorumları — itirazların çoğunu tek başına çözer',
          '2004\'ten beri 20.000+ ev taşındı, sigortalı taşıma ve 10 araçlık filo standarttır',
        ],
        hazirCumleler: [
          { baslik: 'Karşılama', metin: '"Sembol Nakliyat, ben [adın], hayırlı günler, nasıl yardımcı olabilirim?"' },
          { baslik: 'Fiyat Verme', metin: '"Bu taşıma için ortalama fiyatımız [X] TL. Eşyanın videosunu/fotoğrafını atarsanız fiyatı netleştirebiliriz."' },
          { baslik: 'Video İsteme', metin: '"Fiyatta yardımcı olabilmemiz için eşyaların videosunu/fotoğrafını WhatsApp\'tan gönderin."' },
          { baslik: 'Kapora', metin: '"Tarihinizi kesinleştirmek için %20 kapora alıyoruz, kalanı iş bitiminde."' },
          { baslik: 'Kapatma', metin: '"Aradığınız için teşekkürler, iyi günler dilerim."' },
        ],
        itirazlar: [
          { itiraz: '"Fiyatınız pahalıymış."', cevap: 'Bu fiyata sigortalı taşıma, profesyonel ekip ve söküm-montaj dahil. Videonuza göre fiyatı gözden geçirebiliriz — toplama işini siz üstlenirseniz düşebilir.', puf: 'İndirimi sebepsiz yapma; bir hizmeti (toplama gibi) çıkararak yap.' },
          { itiraz: '"Başka firmadan daha ucuza fiyat aldım."', cevap: '"O fiyata sigorta, söküm-montaj ve dış asansör dahil mi?" diye sor. Bizim fiyatımız nettir, taşıma günü değişmez.', puf: 'Rakibi kötüleme; "dahil mi?" sorusu bizim lehimize çalışır.' },
          { itiraz: '"Ben bir düşüneyim, size dönerim."', cevap: 'Fiyatı ve detayları WhatsApp\'tan yazılı gönder. "Aklınıza takılan fiyat mı tarih mi?" diye sor, yarın kısa bir arama sözü ver.', puf: 'Dönüş iznini SEN al; müşteriyi not defterine mutlaka yaz.' },
          { itiraz: '"Eşyalarım kırılırsa ne olacak?"', cevap: 'Taşımalar sigortalı, hassas eşyalar özel malzemeyle (balonlu naylon, özel kutular) paketlenir.', puf: 'Bu itiraz aslında satın alma sinyalidir — detay soran müşteri ciddidir.' },
          { itiraz: '"Kapıda fiyat değişir mi?"', cevap: '"Kesinlikle hayır, zaten videonuzu bu yüzden istiyoruz — sözleşmede de bu fiyat yazar."', puf: 'Video istemenin en güçlü gerekçesi: video = net fiyat = sürpriz yok.' },
        ],
        fiyatOzeti: {
          baslik: 'İstanbul Şehir İçi Taban Fiyatları (Anadolu Yakası)',
          kalemler: [
            { ad: '1+0 Nakliye', tutar: '18.000 ₺' }, { ad: '1+1 Nakliye', tutar: '25.000 ₺' },
            { ad: '2+1 Nakliye', tutar: '30.000 ₺' }, { ad: '3+1 Nakliye', tutar: '35.000 ₺' },
            { ad: '4+1 Nakliye', tutar: '42.000 ₺' },
          ],
          not: 'Üzerine eklenir: Toplama hizmeti (1+0: 3.000₺ ... 4+1: 15.000₺) • Merdiven-asansörsüz (3.kat: 2.000₺, 4.kat: 4.000₺, 5.kat: 6.000₺) • Dış cephe asansörü (Anadolu: 3.000₺, Avrupa: 9.000₺) • Avrupa Yakası ekstra ve yürüme mesafesi ücreti. Şehirler arası 81 il fiyat tablosu ofiste ayrıca mevcuttur — Mehmet Şen\'den öğren.',
        },
        egitimPlani: [
          { gun: 'Pazartesi — Öğren', icerik: 'Fiyat listelerini incele, firmanın YouTube/Instagram\'ını izle, 7 soruyu ve hazır cümleleri ezberle, 10 telefon dinle.' },
          { gun: 'Salı — İzle', icerik: 'Telefonları dinlemeye devam et, WhatsApp mesajlarını deneyimli biriyle yanıtla, Instagram paylaşımı yap.' },
          { gun: 'Çarşamba — Dene', icerik: 'Aramaları yanında biri olsun diye sen al: karşılama + 7 soru + video isteme senin, fiyatı birlikte verin. En az 5 arama.' },
          { gun: 'Perşembe — Yaklaş', icerik: 'Aramaları tek başına al, sadece fiyat öncesi teyit ettir. Cevapsız aramaları sen geri ara. İtiraz senaryolarını sesli prova et.' },
          { gun: 'Cuma — Uç', icerik: 'Tüm akışı baştan sona kendin yürüt. Gün sonu: kaç fiyat verdim? Kaç video geldi? Kaç iş kapandı?' },
        ],
      },
      {
        id: 'depoevim', baslik: 'Depoevim',
        ozet: 'Depoevim, Sembol Nakliyat çatısı altındaki eşya depolama markamızdır (depoevim.com, depo: Çekmeköy). Müşteri eşyasını aylarca sana emanet ediyor — bu iş nakliyeden bile daha çok güven işidir. Aynı ekip, aynı yetki sırası: Mehmet Şen öğretir, Operasyon Şefi Mehmet Tutal alımı/depolamayı/teslimi yönetir.',
        gorevler: [
          'Telefonları karşılamak: "Depoevim, merhabalar, buyurun."',
          'Önce eşyanın cinsini (ev/iş yeri) ve kaç+1 olduğunu sormak, aylık depo fiyatını HEMEN söylemek',
          'Nakliyeyi bizden almasını zorlamadan önermek (sigortalı taşıma, kendi ekip, kalıcı ambalaj, uygun fiyat)',
          'Nakliye isterse: nereden, kaçıncı kat, asansör, kolileme, tarih sorup listeden nakliye fiyatı çıkarmak',
          'Video istemek (hem hangi depoya sığacağını hem nakliye fiyatını netleştirir) ve depoya ziyarete davet etmek',
          'Konuştuğun her müşteriyi not defterine/CRM\'e yazmak; özellikle süresi dolmak üzere olan depolama müşterilerini takip etmek',
          'Saat 10:30\'dan sonra cevapsız aramaları geri aramak, WhatsApp/Instagram yönetmek',
          'Video onaylanınca Depoevim CRM\'de NAKLİYE kaydı açmak, %20 kapora almak (depo sözleşmesi eşya depoya konduktan SONRA yapılır)',
        ],
        kurallar: [
          'Aylık depo fiyatı İLK 2 soruda (eşya cinsi + kaç+1) hemen söylenir — nakliye soruları yalnızca müşteri nakliyeyi bizden isterse sorulur',
          'EN KRİTİK KURAL: Depolama fiyatı yalnızca GİRİŞ nakliyesini kapsar; ÇIKIŞ nakliyesi ayrıca fiyatlandırılır. Bunu kendiliğinden söyleme, müşteri sorarsa detaylıca anlat',
          'Taahhüt zorunluluğu YOKTUR — 1 ay da kalınır, 3 yıl da; en güçlü satış kozudur. Çıkış için en az 7 gün önceden haber verilmeli',
          'Uzun dönem hediye kampanyası: 5 ay öde 1 ay hediye, 10 ay öde 2 ay hediye. Kredi kartı SADECE bu toplu ödemelerde geçerlidir; normal aylık ödeme IBAN\'a yatar',
          'Video gelmeden kesin fiyat/depo boyutu taahhüt etme — "yarım ev" diyen müşterinin eşyası çoğu zaman tam ev çıkar',
          'Ticari işletmelere ve her gün giriş-çıkış yapacaklara depo verilmez — depo düzeni bu sayede korunur',
          'Emin olmadığın bir konuda Mehmet Bey\'e sor, yanlış bilgi verme',
        ],
        akis: [
          { baslik: '1. Karşılama', detay: '"Depoevim, merhabalar, buyurun."' },
          { baslik: '2. Eşyanın Cinsini Sor', detay: 'Ev eşyası mı, iş yeri eşyası mı? (%70-80 ev eşyası)' },
          { baslik: '3. Kaç+1? → Fiyatı Hemen Söyle', detay: 'Örn. 2+1 → 7.500₺ + KDV/ay. Depoyu öv: yüksek kat, rutubetsiz, kameralı.' },
          { baslik: '4. Eşyalar Nerede?', detay: '"Nerede oturuyorsunuz / eşyalar şu an nerede?"' },
          { baslik: '5. Nakliye Bizden mi?', detay: 'Sigortalı taşıma + kendi ekip + kalıcı ambalaj — zorlamadan öner.' },
          { baslik: '6. Nakliye İsterse Soruları Sor', detay: 'Nereden, kaçıncı kat, asansör, kolileme, tarih → listeden fiyat çıkar.' },
          { baslik: '7. Video İste + Depoya Davet Et', detay: '"Hangi depoya sığar + nakliye fiyatı için videoyu gönderin."' },
          { baslik: '8. Kaydet + Takip', detay: 'Fiyat çalışması dön, onaylanırsa nakliye kaydını aç.' },
        ],
        avantajlar: [
          'Depolar yüksek kattadır: rutubet, nem, havalandırma sorunu yoktur; kameralı 7/24 takip',
          'Ticari/günlük giriş-çıkış kullanımına depo verilmez — bu sayede depo düzenli, sakin ve güvenli kalır',
          'Sembol Nakliyat tecrübesiyle taşınır: sigortalı ve kalıcı ambalajla, aynı kadrolu ekip',
          'Oda + mühür sistemi: her müşterinin kendi odası vardır, kapısı mühürlenir — habersiz kimse dokunamaz',
          'Google/Instagram/YouTube\'daki güçlü müşteri memnuniyet videoları çoğu itirazı tek başına çözer',
        ],
        hazirCumleler: [
          { baslik: 'Karşılama', metin: '"Depoevim, merhabalar, buyurun."' },
          { baslik: 'Fiyat Verme', metin: '"[Kaç+1] için aylık [X] ₺ + KDV." — ilk dakikada söylenir.' },
          { baslik: 'Nakliye Önerisi', metin: '"Eşyayı kendiniz mi getirirsiniz, yoksa nakliyeyi bizden almak ister misiniz?"' },
          { baslik: 'Video + Davet', metin: '"Videoyu atarsanız hem hangi depoya sığacağı hem nakliye fiyatında yardımcı olurum. Depolarımıza da gelip görebilirsiniz."' },
          { baslik: 'Kampanya', metin: '"5 ay öde 1 ay hediye, 10 ay öde 2 ay hediye kampanyamız var; kredi kartı da yalnızca bu toplu ödemelerde geçiyor."' },
        ],
        itirazlar: [
          { itiraz: '"Eşyalarım nemlenir mi, küflenir mi?"', cevap: 'Depolar yüksek kattadır, rutubet/nem sorunu yoktur; eşya kalıcı ambalajla paketlenir, kameralı takip edilir.', puf: 'Depoyu gezmeye davet etmek bu itirazı bitiren en güçlü hamledir.' },
          { itiraz: '"Eşyalarım sigortalı mı?"', cevap: 'Evet — hem taşımada hem depoda güvence altında. Her müşterinin kendi mühürlü odası vardır, kamerayla izlenir.', puf: '"Evet" deyip geçme; mühür + oda + kamera üçlüsüyle destekle.' },
          { itiraz: '"Fiyat pahalıymış."', cevap: 'Fiyata yüksek katta rutubetsiz, kameralı, mühürlü ve sigortalı depo dahil, faturalı çalışıyoruz. Kaç ay düşündüğünü sor, kampanyayı anlat.', puf: 'Tek indirim aracı kampanyadır; sebepsiz fiyat kırma.' },
          { itiraz: '"Ne kadar kalacağımı bilmiyorum."', cevap: 'Taahhüt zorunluluğu yok — 1 ay da kalınır, 3 yıl da. Çıkarken 7 gün önce haber vermeniz yeterli.', puf: '"Taahhüt yok" bir kısıt değil, en güçlü satış silahındır.' },
          { itiraz: '"Deponuz bana uzak."', cevap: 'Nakliye fiyatı mesafeyle çok değişmez, depo müşterisine özel indirimli nakliyemiz var. Ev eşyası zaten yılda 1-3 kez ziyaret edilir.', puf: 'Uzak bölgeden arayan müşteriyi asla kaçırma.' },
        ],
        fiyatOzeti: {
          baslik: 'Aylık Depolama Fiyat Listesi (%20 KDV + Fatura)',
          kalemler: [
            { ad: '1+0 Depo (10 m³)', tutar: '4.500 ₺/ay' }, { ad: '1+1 Depo (15 m³)', tutar: '6.000 ₺/ay' },
            { ad: '2+1 Depo (22 m³)', tutar: '7.500 ₺/ay' }, { ad: '3+1 Depo (30 m³)', tutar: '9.000 ₺/ay' },
          ],
          not: 'Depo nakliyesi %25 indirimlidir (taban: 1+0: 14.000₺ ... 4+1: 35.000₺) + toplama/merdiven/dış asansör ekleri. Kampanya: 5 ay öde 1 ay hediye, 10 ay öde 2 ay hediye (yalnızca bu toplu ödemede kredi kartı geçerli).',
        },
        egitimPlani: [
          { gun: 'Pazartesi — Öğren', icerik: 'Depo ve depo-nakliye fiyat listelerini incele, depoyu gez, YouTube/Instagram videolarını izle. Soru akışını (cins → kaç+1 → fiyat → nakliye) ezberle, 10 telefon dinle.' },
          { gun: 'Salı — İzle', icerik: 'Telefonları dinlemeye devam et, WhatsApp mesajlarını deneyimli biriyle yanıtla, Instagram paylaşımı yap.' },
          { gun: 'Çarşamba — Dene', icerik: 'Aramaları yanında biri olsun diye sen al: karşılama + soru akışı + video isteme senin. En az 5 arama.' },
          { gun: 'Perşembe — Yaklaş', icerik: 'Aramaları tek başına al, fiyat öncesi teyit ettir. Cevapsız aramaları sen geri ara. İtiraz senaryolarını sesli prova et.' },
          { gun: 'Cuma — Uç', icerik: 'Tüm akışı baştan sona kendin yürüt. Gün sonu: kaç fiyat verdim? Kaç video geldi? Kaç kayıt açıldı?' },
        ],
      },
    ],
  },
  {
    id: 'operasyon', pozisyon: 'Operasyon', yaka: 'Beyaz Yaka', ikon: ClipboardList,
    ozet: 'Günlük işlerin orkestra şefidir. Ekipleri kurar, işleri onaylar, sahayı denetler.',
    gorevler: [
      'İş Onaylama Tahtası\'ndan günün işlerini kontrol edip onaylamak',
      'Ekip Kurma Tahtası\'nda araç + personel eşleştirmesi yapmak',
      'Şef Denetimi kayıtlarını ve saha raporlarını incelemek',
      'Hasarlı İşler ekranını takip edip çözüm sürecini yönetmek',
      'İzin Tahtası ve puantajı kontrol ederek ekip planını buna göre kurmak',
    ],
    kurallar: [
      'Ekipsiz ve araçsız iş sahaya çıkmaz; her iş günü öncesi tahta tamamlanır',
      'Hasar bildirimi 24 saat içinde müşteriyle iletişime dönüşür',
      'Şef denetimi yapılmamış iş "tamam" sayılmaz',
    ],
    akis: [
      { baslik: 'Sabah Kontrolü', detay: 'Günün işleri, izinler ve araç durumu gözden geçirilir.' },
      { baslik: 'Ekip Kurulumu', detay: 'Ekip Kurma Tahtası\'nda personel ve araç ataması yapılır.' },
      { baslik: 'Saha Takibi', detay: 'İşler süresince ekiplerle iletişim; sorunlara anında müdahale.' },
      { baslik: 'Denetim', detay: 'Şef denetimleri ve iş sonu raporları kontrol edilir.' },
      { baslik: 'Gün Sonu', detay: 'Tamamlanan işler onaylanır; hasar/şikâyet varsa süreç başlatılır.' },
    ],
  },
  {
    id: 'muhasebe', pozisyon: 'Muhasebe', yaka: 'Beyaz Yaka', ikon: Wallet,
    ozet: 'Paranın giriş-çıkışının ve personel hakedişlerinin sorumlusudur. Kasa, banka ve maaşlar onun masasındadır.',
    gorevler: [
      'Finans Defteri\'nden günlük gelir-gider hareketlerini işlemek ve kontrol etmek',
      'Maaş Tablosu\'nda puantaja göre hakedişleri hesaplamak; ödemeleri tik sistemiyle işlemek',
      'Paraşüt üzerinden e-Fatura (resmi API v4) kesmek ve tahsilatları eşleştirmek',
      'Kapora ve kalan bakiye takibini yapmak; geciken tahsilatları hatırlatmalara eklemek',
      'Avukat muhasebesi ve icra dosyalarının ödeme kayıtlarını dekontlarıyla tutmak',
    ],
    kurallar: [
      'Dekontu olmayan ödeme "ödendi" sayılmaz; belge sisteme yüklenir',
      'Maaş ödemelerinde tik atılan kalem gidere işlenir; yanlış tik hemen düzeltilir',
      'Ay kapanışından sonra puantaj/maaş değişikliği yönetici onayı gerektirir',
    ],
    akis: [
      { baslik: 'Gün Açılışı', detay: 'Kasa/banka bakiyeleri ve gün içi beklenen tahsilatlar kontrol edilir.' },
      { baslik: 'Hareket İşleme', detay: 'Gelir-gider kayıtları Finans Defteri\'ne işlenir.' },
      { baslik: 'Faturalama', detay: 'Tamamlanan işler için Paraşüt\'ten e-fatura kesilir.' },
      { baslik: 'Maaş Dönemi', detay: 'Ay sonunda puantaj kontrol edilir, maaş tablosu hazırlanır, ödemeler tiklenir.' },
      { baslik: 'Raporlama', detay: 'Maaş Raporu ve Operasyon & Ciro Raporu yönetime sunulur.' },
    ],
  },
  {
    id: 'avukat', pozisyon: 'Avukat', yaka: 'Beyaz Yaka', ikon: Scale,
    ozet: 'Şirketin hukuki süreçlerini yürütür: dava dosyaları, icra takipleri ve sözleşmeler.',
    gorevler: [
      'Dava Dosyaları ekranından dosyaları ve duruşma tarihlerini takip etmek',
      'İcra takiplerini başlatmak ve aşamalarını sisteme işlemek',
      'Avukat Muhasebesi\'ne masraf/ödeme kayıtlarını dekontlarıyla girmek',
      'Hasar anlaşmazlıklarında şirketi temsil edecek hukuki görüş vermek',
      'Personel sözleşmeleri ve KVKK metinlerini güncel tutmak',
    ],
    kurallar: [
      'Duruşma ve itiraz süreleri Hatırlatmalar takvimine mutlaka işlenir',
      'Her masraf kaydına belge (dekont/makbuz) eklenir',
    ],
    akis: [
      { baslik: 'Dosya İncelemesi', detay: 'Aktif dava ve icra dosyaları gözden geçirilir.' },
      { baslik: 'Süre Takibi', detay: 'Yaklaşan duruşma/itiraz süreleri hatırlatmalara eklenir.' },
      { baslik: 'İşlem', detay: 'Dilekçe, itiraz veya takip işlemleri yapılır.' },
      { baslik: 'Kayıt', detay: 'Masraflar ve gelişmeler sisteme dosya bazında işlenir.' },
    ],
  },
  {
    id: 'firmasahibi', pozisyon: 'Firma Sahibi', yaka: 'Beyaz Yaka', ikon: Star,
    ozet: 'Şirketin genel stratejisinden ve nihai kararlarından sorumludur. Tüm raporlar onun ekranında birleşir.',
    gorevler: [
      'Operasyon & Ciro Raporu ve Maaş Raporu ile şirketin gidişatını izlemek',
      'Hasarlı işler, şikâyetler ve kara liste kararlarında son sözü söylemek',
      'Personel alım/çıkış ve zam kararlarını vermek',
      'Yetkilendirme ekranından kullanıcı izinlerini yönetmek',
    ],
    kurallar: [
      'Kritik silme/sıfırlama işlemleri yalnızca bu yetkide yapılır',
      'Aylık kapanış raporu görülmeden yeni dönem hedefi konmaz',
    ],
    akis: [
      { baslik: 'Günlük Özet', detay: 'Anasayfa ve bildirimlerden günün kritik olayları taranır.' },
      { baslik: 'Rapor İncelemesi', detay: 'Ciro, maaş ve hasar raporları değerlendirilir.' },
      { baslik: 'Karar', detay: 'Onay bekleyen konular (zam, alım, anlaşmazlık) karara bağlanır.' },
      { baslik: 'Strateji', detay: 'Dönemsel hedefler ve iyileştirmeler planlanır.' },
    ],
  },
];

export const IsKilavuzuView = ({ currentUser, personnelList = [], addSystemLog }) => {
  const [yakaSekme, setYakaSekme] = useState('Mavi Yaka');
  const [secilenId, setSecilenId] = useState(null);
  const [ozelIcerikler, setOzelIcerikler] = useState({}); // Firebase'den gelen düzenlenmiş içerikler
  const [duzenleModal, setDuzenleModal] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [duzenleForm, setDuzenleForm] = useState(null);

  // Yetki: içerik düzenleme (ileride pozisyonlara göre kendi metinlerinizi girmeniz için)
  const duzenleyebilir = currentUser?.permissions?.canEdit || currentUser?.position === 'Firma Sahibi' || currentUser?.rank === 'Müdür';

  // Firebase'de düzenlenmiş içerik varsa varsayılanın yerine geçer
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'isKilavuzu'), (snap) => {
      const m = {};
      snap.docs.forEach(d => { m[d.id] = d.data(); });
      setOzelIcerikler(m);
    }, () => {});
    return () => unsub();
  }, []);

  // Varsayılan + Firebase birleşimi (Firebase kazanır)
  const tumIcerik = KILAVUZ_VARSAYILAN.map(k => ({ ...k, ...(ozelIcerikler[k.id] || {}), ikon: k.ikon }));

  // Sayfa açıldığında kullanıcının kendi pozisyonu otomatik seçilir
  useEffect(() => {
    if (secilenId) return;
    const benimki = tumIcerik.find(k => k.pozisyon === currentUser?.position);
    if (benimki) { setSecilenId(benimki.id); setYakaSekme(benimki.yaka); }
    else setSecilenId(tumIcerik.find(k => k.yaka === yakaSekme)?.id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, ozelIcerikler]);

  // ==========================================================================
  // ERİŞİM KURALI (kullanıcı isteği):
  // Normal personel YALNIZCA kendi pozisyonunun kılavuzunu görür; diğer
  // pozisyonların kartları ve yaka sekmeleri gösterilmez.
  // Yöneticiler (Firma Sahibi / Müdür / düzenleme yetkisi olanlar) tüm
  // pozisyonları görmeye devam eder — içerikleri onlar yönetiyor.
  // ==========================================================================
  const tumunuGorebilir = duzenleyebilir;
  const benimKilavuzum = tumIcerik.find(k => k.pozisyon === currentUser?.position) || null;

  const listedekiler = tumunuGorebilir
    ? tumIcerik.filter(k => k.yaka === yakaSekme)
    : (benimKilavuzum ? [benimKilavuzum] : []);
  const secili = tumIcerik.find(k => k.id === secilenId) || listedekiler[0];

  // ========================================================================
  // YENİ: ALT SEKME (FİRMA) DESTEĞİ — Satış Personeli gibi birden fazla iş
  // koluna (Sembol Nakliyat / Depoevim) sahip pozisyonlarda kullanılır.
  // Hook Kuralları: Bu useEffect, bileşende erken "return" olmadığı için
  // güvenle burada tanımlanabilir.
  // ========================================================================
  const [aktifFirmaId, setAktifFirmaId] = useState(null);
  useEffect(() => {
    if (secili?.altSekmeler && !secili.altSekmeler.some(s => s.id === aktifFirmaId)) {
      setAktifFirmaId(secili.altSekmeler[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secili]);

  const firmaSecimi = secili?.altSekmeler
    ? (secili.altSekmeler.find(s => s.id === aktifFirmaId) || secili.altSekmeler[0])
    : null;
  // Firebase override anahtarı: alt sekme varsa "pozisyonId_firmaId", yoksa "pozisyonId"
  const icerikAnahtari = firmaSecimi ? `${secili.id}_${firmaSecimi.id}` : secili?.id;
  // Gösterilecek içerik: alt sekme + varsa Firebase'deki düzenlenmiş üst yazım
  const icerik = firmaSecimi
    ? { ...firmaSecimi, ...(ozelIcerikler[icerikAnahtari] || {}) }
    : secili;

  // ---------------------------------------------------- DÜZENLEME ---
  // Metin alanları "her satır bir madde" mantığıyla düzenlenir.
  // YENİ: Alt sekmeli (firma) pozisyonlarda, o an seçili firmanın içeriği
  // düzenlenir ve icerikAnahtari (pozisyon_firma) ile ayrı kaydedilir.
  const handleDuzenleAc = () => {
    if (!icerik) return;
    setDuzenleForm({
      id: icerikAnahtari,
      ozet: icerik.ozet || '',
      gorevler: (icerik.gorevler || []).join('\n'),
      kurallar: (icerik.kurallar || []).join('\n'),
      akis: (icerik.akis || []).map(a => `${a.baslik} | ${a.detay}`).join('\n'),
    });
    setDuzenleModal(true);
  };

  const handleDuzenleKaydet = async () => {
    if (!duzenleForm) return;
    setKaydediliyor(true);
    try {
      const veri = {
        ozet: duzenleForm.ozet.trim(),
        gorevler: duzenleForm.gorevler.split('\n').map(s => s.trim()).filter(Boolean),
        kurallar: duzenleForm.kurallar.split('\n').map(s => s.trim()).filter(Boolean),
        // Akış satır biçimi: "Başlık | Detay" — | yoksa tamamı başlık olur
        akis: duzenleForm.akis.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
          const [b, ...d] = s.split('|');
          return { baslik: (b || '').trim(), detay: d.join('|').trim() };
        }),
        guncelleyen: currentUser?.fullName || 'Sistem',
        guncellemeTarihi: new Date().toISOString(),
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'isKilavuzu', duzenleForm.id), veri, { merge: true });
      addSystemLog?.('İş Kılavuzu Güncellendi', `${firmaSecimi ? `${secili?.pozisyon} (${firmaSecimi.baslik})` : secili?.pozisyon} kılavuz içeriği güncellendi.`);
      setDuzenleModal(false); setDuzenleForm(null);
    } catch (e) { console.error('Kılavuz kaydedilemedi:', e); alert('Kaydedilemedi, tekrar deneyin.'); }
    setKaydediliyor(false);
  };

  // Pozisyondaki aktif personel sayısı (kartlarda küçük rozet olarak gösterilir)
  const pozisyonKisiSayisi = (pozisyon) => personnelList.filter(p => p.position === pozisyon).length;

  return (
    <div className="space-y-4 animate-in fade-in max-w-5xl mx-auto">
      {/* BAŞLIK */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-[11px] font-black text-neutral-400 uppercase tracking-widest">Pozisyona Göre Rehber</p>
          <h2 className="text-2xl font-black text-black flex items-center gap-2"><BookOpen className="w-7 h-7 text-red-600" /> İş Kılavuzu ve İş Şeması</h2>
          <p className="text-sm text-neutral-500 font-medium mt-1">Her pozisyonun görevleri, altın kuralları ve tipik iş akışı — kim ne yapar, nasıl yapar.</p>
        </div>
        {duzenleyebilir && secili && (
          <button type="button" onClick={handleDuzenleAc}
            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200 font-black rounded-xl transition flex items-center gap-2 text-sm shrink-0">
            <Edit className="w-4 h-4" /> {firmaSecimi ? `${firmaSecimi.baslik} İçeriğini Düzenle` : 'Bu Pozisyonu Düzenle'}
          </button>
        )}
      </div>

      {/* YAKA SEKMELERİ — yalnızca tüm kılavuzları görebilen yöneticilerde */}
      {tumunuGorebilir && (
      <div className="flex bg-neutral-100 p-1.5 rounded-2xl w-fit gap-1">
        {['Mavi Yaka', 'Beyaz Yaka'].map(y => (
          <button key={y} type="button"
            onClick={() => { setYakaSekme(y); const ilk = tumIcerik.find(k => k.yaka === y); if (ilk) setSecilenId(ilk.id); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-black transition ${yakaSekme === y ? (y === 'Mavi Yaka' ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-800 text-white shadow-md') : 'text-neutral-500 hover:text-black'}`}>
            {y}
          </button>
        ))}
      </div>
      )}

      {/* Kılavuzu bulunmayan pozisyonlarda bilgilendirme */}
      {!tumunuGorebilir && !benimKilavuzum && (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <BookOpen className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-black text-neutral-500">Pozisyonunuz için henüz kılavuz tanımlanmamış</p>
          <p className="text-[11px] font-bold text-neutral-400 mt-1">İnsan Kaynakları ile görüşebilirsiniz.</p>
        </div>
      )}

      {/* POZİSYON KARTLARI — personelde yalnızca kendi pozisyonu listelenir */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {listedekiler.map(k => {
          const Ikon = k.ikon;
          const benim = k.pozisyon === currentUser?.position;
          const aktif = k.id === secili?.id;
          return (
            <button key={k.id} type="button" onClick={() => setSecilenId(k.id)}
              className={`p-3.5 rounded-2xl border-2 text-left transition relative ${aktif ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-neutral-200 hover:border-red-300'}`}>
              {/* Kullanıcının kendi pozisyonu rozetle işaretlenir */}
              {benim && <span className={`absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full ${aktif ? 'bg-white/25 text-white' : 'bg-yellow-100 text-yellow-700 border border-yellow-300'}`}>BENİM POZİSYONUM</span>}
              <Ikon className={`w-6 h-6 mb-2 ${aktif ? 'text-white' : 'text-red-600'}`} />
              <p className="font-black text-sm leading-tight">{k.pozisyon}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${aktif ? 'text-white/70' : 'text-neutral-400'}`}>{pozisyonKisiSayisi(k.pozisyon)} personel</p>
            </button>
          );
        })}
      </div>

      {secili && (
        <>
          {/* YENİ: FİRMA SEÇİCİ — yalnızca altSekmeler olan pozisyonlarda (örn. Satış
              Personeli) görünür. Sembol Nakliyat / Depoevim arasında geçiş sağlar. */}
          {secili.altSekmeler && (
            <div className="flex gap-2 flex-wrap bg-neutral-50 border-2 border-dashed border-red-200 rounded-2xl p-2">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide self-center pl-2">Firma:</span>
              {secili.altSekmeler.map(s => (
                <button key={s.id} type="button" onClick={() => setAktifFirmaId(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-black transition border-2 ${aktifFirmaId === s.id ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-neutral-200 text-neutral-600 hover:border-red-300'}`}>
                  {s.baslik}
                </button>
              ))}
            </div>
          )}

          {/* ÖZET */}
          <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-1.5">
              {(() => { const Ikon = secili.ikon; return <Ikon className="w-7 h-7 text-red-400 shrink-0" />; })()}
              <div>
                <h3 className="text-lg font-black">{secili.pozisyon}{firmaSecimi ? ` — ${firmaSecimi.baslik}` : ''}</h3>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${secili.yaka === 'Mavi Yaka' ? 'bg-blue-500' : 'bg-neutral-600'}`}>{secili.yaka}</span>
              </div>
            </div>
            <p className="text-sm text-neutral-300 font-medium leading-relaxed">{icerik.ozet}</p>
            {icerik.guncelleyen && <p className="text-[10px] text-neutral-500 font-bold mt-2">Son güncelleme: {icerik.guncelleyen}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* İŞ KILAVUZU: Görevler + Kurallar */}
            <div className="space-y-4">
              <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-5">
                <h4 className="font-black text-black flex items-center gap-2 mb-3"><ClipboardList className="w-5 h-5 text-red-600" /> İş Kılavuzu — Görevler</h4>
                <ul className="space-y-2">
                  {(icerik.gorevler || []).map((g, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-neutral-700">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> {g}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border-2 border-yellow-200 p-5">
                <h4 className="font-black text-black flex items-center gap-2 mb-3"><Star className="w-5 h-5 text-yellow-500 fill-yellow-400" /> Altın Kurallar</h4>
                <ul className="space-y-2">
                  {(icerik.kurallar || []).map((k, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm font-bold text-neutral-800 bg-yellow-50 border border-yellow-100 rounded-xl p-2.5">
                      <span className="text-yellow-600 font-black shrink-0">{i + 1}.</span> {k}
                    </li>
                  ))}
                </ul>
              </div>
              {/* YENİ: AVANTAJLAR — "Neden bizi seçmeli?" satış kozları (varsa gösterilir) */}
              {icerik.avantajlar && (
                <div className="bg-white rounded-3xl shadow-sm border-2 border-green-200 p-5">
                  <h4 className="font-black text-black flex items-center gap-2 mb-3"><Award className="w-5 h-5 text-green-600" /> Gücümüz — Neden Biz?</h4>
                  <ul className="space-y-2">
                    {icerik.avantajlar.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-neutral-700 bg-green-50 border border-green-100 rounded-xl p-2.5">
                        <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* İŞ ŞEMASI: adım adım akış */}
            <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-5">
              <h4 className="font-black text-black flex items-center gap-2 mb-4"><ChevronRight className="w-5 h-5 text-red-600" /> İş Şeması — Tipik Akış</h4>
              <div className="relative">
                {(icerik.akis || []).map((a, i, arr) => (
                  <div key={i} className="flex gap-3 relative pb-5 last:pb-0">
                    {/* Dikey bağlantı çizgisi */}
                    {i < arr.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-red-200" />}
                    <span className="w-8 h-8 rounded-full bg-red-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-md z-10">{i + 1}</span>
                    <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
                      <p className="font-black text-sm text-black">{a.baslik}</p>
                      {a.detay && <p className="text-xs font-medium text-neutral-500 mt-0.5 leading-relaxed">{a.detay}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* YENİ: HAZIR CÜMLELER — telefon/WhatsApp'ta doğrudan kullanılabilecek cümleler */}
              {icerik.hazirCumleler && (
                <div className="mt-5 pt-4 border-t border-neutral-200">
                  <h4 className="font-black text-black flex items-center gap-2 mb-3"><MessageSquareText className="w-5 h-5 text-blue-600" /> Hazır Cümleler</h4>
                  <div className="space-y-2">
                    {icerik.hazirCumleler.map((c, i) => (
                      <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-2.5">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-wide">{c.baslik}</p>
                        <p className="text-sm font-medium text-neutral-700 italic mt-0.5">{c.metin}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* YENİ: FİYAT ÖZETİ — varsa (Satış Personeli gibi fiyat veren pozisyonlarda) */}
          {icerik.fiyatOzeti && (
            <div className="bg-white rounded-3xl shadow-sm border-2 border-emerald-200 p-5">
              <h4 className="font-black text-black flex items-center gap-2 mb-3"><DollarSign className="w-5 h-5 text-emerald-600" /> {icerik.fiyatOzeti.baslik}</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                {icerik.fiyatOzeti.kalemler.map((k, i) => (
                  <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">{k.ad}</p>
                    <p className="text-base font-black text-emerald-800 mt-0.5">{k.tutar}</p>
                  </div>
                ))}
              </div>
              {icerik.fiyatOzeti.not && <p className="text-[11px] font-medium text-neutral-500 leading-relaxed">{icerik.fiyatOzeti.not}</p>}
            </div>
          )}

          {/* YENİ: İTİRAZ KARŞILAMA — hazır senaryolar (varsa gösterilir) */}
          {icerik.itirazlar && (
            <div className="bg-white rounded-3xl shadow-sm border-2 border-orange-200 p-5">
              <h4 className="font-black text-black flex items-center gap-2 mb-3"><Shield className="w-5 h-5 text-orange-600" /> İtiraz Karşılama — Hazır Senaryolar</h4>
              <div className="space-y-3">
                {icerik.itirazlar.map((it, i) => (
                  <div key={i} className="border border-orange-100 bg-orange-50/50 rounded-2xl p-3.5">
                    <p className="text-sm font-black text-orange-900">Müşteri: {it.itiraz}</p>
                    <p className="text-sm font-medium text-neutral-700 mt-1.5">Cevabın: {it.cevap}</p>
                    {it.puf && <p className="text-[11px] font-bold text-orange-600 mt-1.5 italic">💡 {it.puf}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* YENİ: 1 HAFTALIK EĞİTİM PLANI — yeni başlayanın ilk haftası (varsa gösterilir) */}
          {icerik.egitimPlani && (
            <div className="bg-white rounded-3xl shadow-sm border-2 border-purple-200 p-5">
              <h4 className="font-black text-black flex items-center gap-2 mb-3"><CalendarDays className="w-5 h-5 text-purple-600" /> 1 Haftalık Eğitim & Gelişim Planı</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {icerik.egitimPlani.map((g, i) => (
                  <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-purple-800">{g.gun}</p>
                    <p className="text-[11px] font-medium text-neutral-600 mt-1 leading-relaxed">{g.icerik}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* DÜZENLEME MODALI (yetkili kullanıcılar) */}
      {duzenleModal && duzenleForm && (
        <div className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setDuzenleModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <h3 className="font-black text-lg text-blue-700 flex items-center gap-2"><Edit className="w-5 h-5" /> {firmaSecimi ? `${secili?.pozisyon} — ${firmaSecimi.baslik}` : secili?.pozisyon} — İçeriği Düzenle</h3>
              <button type="button" onClick={() => setDuzenleModal(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Özet (bu pozisyon nedir?)</label>
                <textarea value={duzenleForm.ozet} onChange={e => setDuzenleForm({ ...duzenleForm, ozet: e.target.value })} rows={2}
                  className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Görevler (her satır bir madde)</label>
                <textarea value={duzenleForm.gorevler} onChange={e => setDuzenleForm({ ...duzenleForm, gorevler: e.target.value })} rows={6}
                  className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Altın Kurallar (her satır bir kural)</label>
                <textarea value={duzenleForm.kurallar} onChange={e => setDuzenleForm({ ...duzenleForm, kurallar: e.target.value })} rows={4}
                  className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">İş Şeması (her satır bir adım — biçim: Başlık | Detay)</label>
                <textarea value={duzenleForm.akis} onChange={e => setDuzenleForm({ ...duzenleForm, akis: e.target.value })} rows={6}
                  className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex gap-2 shrink-0">
              <button type="button" onClick={() => setDuzenleModal(false)} className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black rounded-xl transition text-sm">İptal</button>
              <button type="button" onClick={handleDuzenleKaydet} disabled={kaydediliyor}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black rounded-xl transition flex justify-center items-center gap-2">
                {kaydediliyor ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />} Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  // ============================================================================
  // YENİ: HATIRLATMALAR MODÜLÜ — Operasyon Bölümü'nün parçası olarak buraya
  // taşındı (önceden ayrı Hatirlatmalar.jsx dosyasındaydı; içerik AYNEN
  // korunmuştur, sadece import satırları yukarıdaki ortak import bloğuyla
  // birleştirildi)
  // ============================================================================

// ============================================================================
// HATIRLATMALAR MODÜLÜ (Sembol CRM)
// Depoevim CRM'deki Hatırlatma Takvimi'nin Sembol'e uyarlanmış hali.
// - Takvim mantığı: ay görünümü, günlerde tür renk noktaları, güne tıklayınca
//   o günün listesi altta açılır.
// - 2 ana tür: GÖREV (kırmızı) ve NOT (mavi). Tamamlananlar yeşile döner.
// - 6 konu başlığı: Personel, Şirket, Müşteri, Ödeme, Araç, Malzeme.
// - Konuya göre "İlgili" seçimi: Personel → personel listesi, Müşteri →
//   cari isimleri, Araç → plaka listesi (yaratıcı ek — hatırlatma doğrudan
//   kişiye/araca bağlanır, listede rozet olarak görünür).
// - Belgeler: her hatırlatmaya birden fazla fotoğraf/PDF eklenebilir
//   (Avukat Muhasebesi ile aynı upload.php altyapısı).
// - Üstte özet şerit: Geciken / Bugün / Yaklaşan 7 gün sayaçları.
// - Firebase koleksiyonu: 'hatirlatmalar'. Kim ekledi / kim tamamladı loglanır.
// ============================================================================

// Konu başlıkları — ikon ve renkleriyle (menüde ve kartlarda kullanılır)
export const HATIRLATMA_KONULARI = [
  { id: 'Personel', ikon: User,      renk: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Şirket',   ikon: Briefcase, renk: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
  { id: 'Müşteri',  ikon: Users,     renk: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Ödeme',    ikon: Wallet,    renk: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'Araç',     ikon: Truck,     renk: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'Malzeme',  ikon: Package,   renk: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
];

// Bugünün tarihi 'YYYY-MM-DD' biçiminde (yerel saat)
const bugunStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const HatirlatmalarView = ({ jobs = [], personnelList = [], vehicles = [], currentUser, addSystemLog, setViewingImage }) => {
  const bugun = new Date();
  const [ay, setAy] = useState(bugun.getMonth());       // 0-11
  const [yil, setYil] = useState(bugun.getFullYear());
  const [secilenGun, setSecilenGun] = useState(bugunStr());
  // DÜZELTME ("kayitlar is not defined" hatası): Bu state, bir önceki okuma
  // optimizasyonu sırasında yanlışlıkla silinmişti; sayfa açılır açılmaz
  // uygulama çöküyordu. Geri eklendi.
  const [kayitlar, setKayitlar] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState(null); // null = yeni kayıt
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [belgeYukleniyor, setBelgeYukleniyor] = useState(false);
  const [konuFiltre, setKonuFiltre] = useState('Tümü');
  const [silinecekId, setSilinecekId] = useState(null);
  // YENİ: Görev atanacak personeli aramak için arama kutusu metni
  const [personelArama, setPersonelArama] = useState('');
  // YENİ: "İlgili" alanındaki (Personel / Müşteri / Araç) arama kutusu.
  // Uzun listelerde aranan kaydı yazarak bulmayı sağlar.
  const [ilgiliArama, setIlgiliArama] = useState('');
  // Türkçe karakter duyarsız arama: kullanıcı "sen" yazınca "Şenol",
  // "ınan" yazınca "İnan" da bulunsun diye harfleri sadeleştirir.
  const aramaNormalize = (metin) => String(metin || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');

  const bosForm = {
    tarih: bugunStr(), saat: '', tur: 'gorev', konu: 'Şirket',
    ilgili: '', aciklama: '', belgeler: [], tamamlandi: false,
    // YENİ: Görev türünde, görevin atandığı personel (bildirim bu kişiye gider)
    atananPersonelId: '', atananPersonelAdi: '',
  };
  const [form, setForm] = useState(bosForm);

  // ---------------------------------------------------- VERİ DİNLEME ---
  useEffect(() => {
    // OKUMA SINIRI: zamanla büyüyen koleksiyon; 500 kayıt görüntüleme için yeterli
    const unsub = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar'), limit(500)), (snap) => {
      setKayitlar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Hatırlatmalar yüklenemedi:', err));
    return () => unsub();
  }, []);

  // ---------------------------------------------------- YARDIMCILAR ---
  const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const gunAdlari = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const gunKayitlari = (tarihStr) => kayitlar
    .filter(k => k.tarih === tarihStr)
    .filter(k => konuFiltre === 'Tümü' || k.konu === konuFiltre)
    .sort((a, b) => (a.saat || '99:99').localeCompare(b.saat || '99:99'));

  // Özet sayaçları: Geciken (bugünden önce, tamamlanmamış), Bugün, Yaklaşan 7 gün
  const bugunT = bugunStr();
  const yediGunSonra = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const gecikenler = kayitlar.filter(k => !k.tamamlandi && k.tarih < bugunT);
  const bugunkuler = kayitlar.filter(k => k.tarih === bugunT);
  const yaklasanlar = kayitlar.filter(k => !k.tamamlandi && k.tarih > bugunT && k.tarih <= yediGunSonra);

  // Konu bilgisi (ikon + renk) getir
  const konuBul = (id) => HATIRLATMA_KONULARI.find(k => k.id === id) || HATIRLATMA_KONULARI[1];

  // Konuya göre "İlgili" seçenekleri (yaratıcı ek: hatırlatma kişiye/araca bağlanır)
  const ilgiliSecenekleri = (konu) => {
    if (konu === 'Personel') return personnelList.filter(p => p.position !== 'Firma Sahibi').map(p => p.fullName);
    if (konu === 'Müşteri') return [...new Set(jobs.map(j => j.customerName).filter(Boolean))].sort();
    if (konu === 'Araç') return vehicles.map(v => v.plate).filter(Boolean);
    return null; // Şirket / Ödeme / Malzeme: serbest metin
  };

  // ---------------------------------------------------- BELGE YÜKLEME ---
  // Birden fazla fotoğraf/PDF birlikte seçilebilir; Avukat Muhasebesi ile aynı altyapı
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
        yeniler.push({ url, name: file.name, type: tip });
      } catch (err) { console.error('Belge yüklenemedi:', file.name, err); alert(`"${file.name}" yüklenemedi.`); }
    }
    setForm(f => ({ ...f, belgeler: [...f.belgeler, ...yeniler] }));
    setBelgeYukleniyor(false);
    e.target.value = '';
  };

  // ---------------------------------------------------- KAYDET / SİL ---
  const handleKaydet = async () => {
    if (!form.tarih || !form.aciklama.trim()) return;
    setKaydediliyor(true);
    try {
      // Düzenlemede: atama DEĞİŞTİYSE yeni kişiye bildirim gitsin (aynı kişiye tekrar gitmesin)
      const oncekiAtanan = duzenlenenId ? (kayitlar.find(k => k.id === duzenlenenId)?.atananPersonelId || '') : '';
      // DEĞİŞTİ: Görev VEYA NOT — atanmış her hatırlatma bildirim üretir.
      const atamaYeniMi = form.atananPersonelId && form.atananPersonelId !== oncekiAtanan;
      let yeniHatirlatmaId = duzenlenenId || null; // bildirime bağlanacak kimlik

      if (duzenlenenId) {
        // Mevcut hatırlatmayı güncelle
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar', duzenlenenId), {
          ...form, guncelleyen: currentUser?.fullName || 'Sistem', guncellemeTarihi: new Date().toISOString(),
        });
        addSystemLog?.('Hatırlatma Güncellendi', `${form.tarih} — ${form.konu}: ${form.aciklama.slice(0, 60)}`);
      } else {
        // DEĞİŞTİ: Dönen referans saklanıyor — bildirime hatirlatmaId yazmak
        // için kayıt kimliği gerekiyor (Bildirim Merkezi'nden "Tamamlandı"
        // işaretlenince bu kimlikle hatırlatmanın kendisi kapatılır).
        const yeniRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar'), {
          ...form, ekleyen: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString(),
        });
        yeniHatirlatmaId = yeniRef.id;
        addSystemLog?.('Hatırlatma Eklendi', `${form.tarih} — ${form.tur === 'gorev' ? 'Görev' : 'Not'} / ${form.konu}: ${form.aciklama.slice(0, 60)}`);
      }

      // ====================================================================
      // YENİ: GÖREV ATAMA BİLDİRİMİ
      // Görev bir personele atandıysa, sistemin MEVCUT bildirim altyapısına
      // ('notifications' koleksiyonu, userId bazlı) bir kayıt eklenir. Böylece
      // o personelin Bildirim Merkezi'nde görünür ve zil ikonu uyarı verir.
      // Alan yapısı, sistemdeki diğer görev atama bildirimleriyle birebir aynıdır.
      // ====================================================================
      if (atamaYeniMi) {
        try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
            userId: form.atananPersonelId,
            // DEĞİŞTİ: Başlık türe göre — not atamasında "Görev" yazması yanıltıcıydı
            title: form.tur === 'gorev' ? 'Yeni Görev Atandı' : 'Size Not Bırakıldı',
            message: `${form.konu} — ${form.aciklama.slice(0, 120)}${form.saat ? ` (Saat: ${form.saat})` : ''} | Tarih: ${form.tarih} | Atayan: ${currentUser?.fullName || 'Sistem'}`,
            date: new Date().toLocaleString('tr-TR'),
            read: false,
            type: 'hatirlatmaGorev',
            hatirlatmaTarihi: form.tarih,
            // YENİ: Bildirim, hatırlatmanın kendisine bağlanır. Bildirim
            // Merkezi'ndeki "Tamamlandı" düğmesi bu kimlikle hatırlatmayı kapatır.
            hatirlatmaId: yeniHatirlatmaId,
          });
          addSystemLog?.('Görev Atandı', `${form.atananPersonelAdi} personeline görev atandı: ${form.aciklama.slice(0, 60)}`);
        } catch (bildirimHatasi) {
          // Bildirim gönderilemese bile hatırlatma kaydı kaybolmasın
          console.error('Görev atama bildirimi gönderilemedi:', bildirimHatasi);
        }
      }

      setSecilenGun(form.tarih); // Kaydedilen güne odaklan
      setModalAcik(false); setDuzenlenenId(null); setForm(bosForm); setPersonelArama(''); setIlgiliArama('');
    } catch (e) { console.error('Hatırlatma kaydedilemedi:', e); alert('Kaydedilemedi, tekrar deneyin.'); }
    setKaydediliyor(false);
  };

  // Tamamla / geri al — kim tamamladıysa ismi kayda işlenir
  const handleTamamla = async (kayit) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar', kayit.id), {
      tamamlandi: !kayit.tamamlandi,
      tamamlayan: !kayit.tamamlandi ? (currentUser?.fullName || 'Sistem') : null,
      tamamlanmaTarihi: !kayit.tamamlandi ? new Date().toISOString() : null,
    });
    // ========================================================================
    // YENİ: BAĞLI BİLDİRİMLERİ SENKRONLA
    // ========================================================================
    // Görev/not atandığında personelin Bildirim Merkezi'ne hatirlatmaId ile
    // bağlı bir bildirim düşer. Hatırlatma BURADAN tamamlanırsa o bildirimin
    // de kapanması gerekir; yoksa personelin ekranında "BEKLİYOR" olarak
    // kalır ve zil rozetiyle çelişir. Geri açılırsa (tamamlandı geri alınırsa)
    // bildirim de yeniden bekliyor durumuna döner.
    // ========================================================================
    try {
      const bildirimSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', 'notifications'),
        where('hatirlatmaId', '==', kayit.id)
      ));
      for (const b of bildirimSnap.docs) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', b.id), {
          gorevTamamlandi: !kayit.tamamlandi,
          read: !kayit.tamamlandi ? true : b.data().read,
        });
      }
    } catch (e) { console.error('Bağlı bildirim güncellenemedi:', e); }
    if (!kayit.tamamlandi) addSystemLog?.('Hatırlatma Tamamlandı', `${kayit.tarih} — ${kayit.konu}: ${(kayit.aciklama || '').slice(0, 60)}`);
  };

  const handleSil = async () => {
    if (!silinecekId) return;
    const k = kayitlar.find(x => x.id === silinecekId);
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'hatirlatmalar', silinecekId));
    addSystemLog?.('Hatırlatma Silindi', `${k?.tarih || ''} — ${k?.konu || ''}: ${(k?.aciklama || '').slice(0, 60)}`);
    setSilinecekId(null);
  };

  const handleDuzenleAc = (kayit) => {
    setForm({ tarih: kayit.tarih, saat: kayit.saat || '', tur: kayit.tur || 'gorev', konu: kayit.konu || 'Şirket', ilgili: kayit.ilgili || '', aciklama: kayit.aciklama || '', belgeler: kayit.belgeler || [], tamamlandi: !!kayit.tamamlandi,
      // YENİ: Mevcut görev ataması da forma yüklenir (yoksa boş kalır)
      atananPersonelId: kayit.atananPersonelId || '', atananPersonelAdi: kayit.atananPersonelAdi || '' });
    setDuzenlenenId(kayit.id);
    setPersonelArama('');
    setIlgiliArama('');
    setModalAcik(true);
  };

  // ---------------------------------------------------- TAKVİM IZGARASI ---
  const ayIlkGun = new Date(yil, ay, 1);
  const ayGunSayisi = new Date(yil, ay + 1, 0).getDate();
  // Pazartesi başlangıçlı hafta: JS getDay() Pazar=0 → Pzt=0'a çevir
  const bosluk = (ayIlkGun.getDay() + 6) % 7;
  const hucreler = [...Array(bosluk).fill(null), ...Array.from({ length: ayGunSayisi }, (_, i) => i + 1)];

  const oncekiAy = () => { if (ay === 0) { setAy(11); setYil(yil - 1); } else setAy(ay - 1); };
  const sonrakiAy = () => { if (ay === 11) { setAy(0); setYil(yil + 1); } else setAy(ay + 1); };

  const secilenGunKayitlari = gunKayitlari(secilenGun);
  const secilenGunBaslik = (() => {
    const [y, m, d] = secilenGun.split('-').map(Number);
    return `${d} ${aylar[m - 1]} ${y}`;
  })();

  return (
    <div className="space-y-4 animate-in fade-in max-w-4xl mx-auto">
      {/* BAŞLIK + YENİ HATIRLATMA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-[11px] font-black text-neutral-400 uppercase tracking-widest">Hatırlatma Takvimi</p>
          <h2 className="text-2xl font-black text-black flex items-center gap-2"><CalendarDays className="w-7 h-7 text-red-600" /> Hatırlatmalar</h2>
          <p className="text-sm text-neutral-500 font-medium mt-1">Görev ve notlarınızı takvim üzerinde takip edin; tamamlandı olarak işaretleyin.</p>
        </div>
        <button type="button" onClick={() => { setForm({ ...bosForm, tarih: secilenGun }); setDuzenlenenId(null); setModalAcik(true); }}
          className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-600/25 transition flex items-center gap-2 shrink-0">
          <PlusCircle className="w-5 h-5" /> Yeni Hatırlatma
        </button>
      </div>

      {/* ÖZET ŞERİT: Geciken / Bugün / Yaklaşan (yaratıcı ek) */}
      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={() => { const g = gecikenler[0]; if (g) { setSecilenGun(g.tarih); const [y, m] = g.tarih.split('-').map(Number); setYil(y); setAy(m - 1); } }}
          className={`p-3 rounded-2xl border-2 text-left transition ${gecikenler.length > 0 ? 'bg-red-50 border-red-300 hover:border-red-500' : 'bg-white border-neutral-200'}`}>
          <p className="text-[10px] font-black uppercase tracking-wide text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Geciken</p>
          <p className="text-2xl font-black text-red-700">{gecikenler.length}</p>
        </button>
        <button type="button" onClick={() => { setSecilenGun(bugunT); setYil(bugun.getFullYear()); setAy(bugun.getMonth()); }}
          className="p-3 rounded-2xl border-2 bg-white border-neutral-200 hover:border-neutral-400 text-left transition">
          <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Bugün</p>
          <p className="text-2xl font-black text-black">{bugunkuler.length}</p>
        </button>
        <div className="p-3 rounded-2xl border-2 bg-white border-neutral-200">
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-600 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Yaklaşan 7 Gün</p>
          <p className="text-2xl font-black text-blue-700">{yaklasanlar.length}</p>
        </div>
      </div>

      {/* KONU FİLTRESİ */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-neutral-200 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide mr-1">Konu:</span>
        <button type="button" onClick={() => setKonuFiltre('Tümü')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${konuFiltre === 'Tümü' ? 'bg-black text-white border-black' : 'bg-neutral-50 text-neutral-600 border-neutral-200'}`}>Tümü</button>
        {HATIRLATMA_KONULARI.map(k => {
          const Ikon = k.ikon;
          return (
            <button key={k.id} type="button" onClick={() => setKonuFiltre(k.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition flex items-center gap-1.5 ${konuFiltre === k.id ? 'bg-black text-white border-black' : k.renk}`}>
              <Ikon className="w-3.5 h-3.5" /> {k.id}
            </button>
          );
        })}
      </div>

      {/* TAKVİM */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={oncekiAy} className="p-2 hover:bg-neutral-100 rounded-xl transition"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="text-lg font-black">{aylar[ay]} {yil}</h3>
          <button type="button" onClick={sonrakiAy} className="p-2 hover:bg-neutral-100 rounded-xl transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {gunAdlari.map(g => <div key={g} className="text-center text-[11px] font-black text-neutral-400 py-1">{g}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {hucreler.map((gun, i) => {
            if (gun === null) return <div key={`b${i}`} />;
            const tarihStr = `${yil}-${String(ay + 1).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
            const gunKyt = gunKayitlari(tarihStr);
            const secili = tarihStr === secilenGun;
            const buGun = tarihStr === bugunT;
            const gecikmisVar = gunKyt.some(k => !k.tamamlandi && tarihStr < bugunT);
            return (
              /* ============================================================
                 YENİ TAKVİM TASARIMI:
                 • BUGÜN artık kırmızı DOLGU değil — çerçevesi YANIP SÖNER
                   (hatirlatma-bugun-cerceve animasyonu, App.jsx global stil).
                 • Seçili gün: hafif kırmızı zemin + kalın kırmızı çerçeve
                   (yazı siyah kalır, okunabilirlik için).
                 • Kayıtlar nokta yerine SİMGE ile gösterilir:
                     - Tamamlanmayan → ✕ (çarpı), türün rengiyle
                       (Görev = kırmızı, Not = mavi)
                     - Tamamlanan   → ✓ (tik), yeşil
                 ============================================================ */
              <button key={gun} type="button" onClick={() => setSecilenGun(tarihStr)}
                className={`relative min-h-[54px] p-1.5 rounded-xl border-2 text-left transition flex flex-col justify-between
                  ${secili ? 'bg-red-50 border-red-500 shadow-md' : gecikmisVar ? 'bg-red-50/60 border-red-200 hover:border-red-400' : 'bg-white border-neutral-200 hover:border-neutral-400'}
                  ${buGun ? 'hatirlatma-bugun-cerceve' : ''}`}>
                <span className={`text-sm font-black ${buGun ? 'text-red-600' : 'text-neutral-700'}`}>{gun}</span>
                {/* Durum simgeleri: tamamlanmayan ✕ (tür rengi), tamamlanan ✓ (yeşil) */}
                {gunKyt.length > 0 && (
                  <span className="flex flex-wrap items-center gap-0.5">
                    {gunKyt.slice(0, 4).map((k, x) => (
                      k.tamamlandi ? (
                        <CheckCircle key={x} className="w-3.5 h-3.5 text-green-600" title="Tamamlandı" />
                      ) : (
                        <XCircle key={x} className={`w-3.5 h-3.5 ${k.tur === 'gorev' ? 'text-red-500' : 'text-blue-500'}`} title={k.tur === 'gorev' ? 'Tamamlanmayan görev' : 'Tamamlanmayan not'} />
                      )
                    ))}
                    {gunKyt.length > 4 && <span className="text-[8px] font-black text-neutral-500">+{gunKyt.length - 4}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Açıklama satırı */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] font-bold text-neutral-500">
          <span className="uppercase tracking-wide text-neutral-400">Tamamlanmayan:</span>
          <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500" /> Görev</span>
          <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-blue-500" /> Not</span>
          <span className="uppercase tracking-wide text-neutral-400 ml-2">Tamamlanan:</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-600" /> Görev / Not</span>
          <span className="flex items-center gap-1 text-red-600"><span className="w-3 h-3 rounded border-2 border-red-500" /> Yanıp sönen çerçeve: bugün</span>
        </div>
      </div>

      {/* SEÇİLİ GÜNÜN LİSTESİ */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">{secilenGunBaslik}</h3>
          <button type="button" onClick={() => { setForm({ ...bosForm, tarih: secilenGun }); setDuzenlenenId(null); setModalAcik(true); }}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-black transition flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> Ekle
          </button>
        </div>
        {secilenGunKayitlari.length === 0 ? (
          <p className="text-center text-neutral-400 font-medium py-10">Bu güne ait hatırlatma yok.</p>
        ) : (
          <div className="space-y-2.5">
            {secilenGunKayitlari.map(k => {
              const konu = konuBul(k.konu);
              const KonuIkon = konu.ikon;
              const gecikmis = !k.tamamlandi && k.tarih < bugunT;
              return (
                <div key={k.id} className={`p-3.5 rounded-2xl border-2 transition ${k.tamamlandi ? 'bg-green-50/60 border-green-200' : gecikmis ? 'bg-red-50/60 border-red-200' : 'bg-white border-neutral-200'}`}>
                  <div className="flex items-start gap-3">
                    {/* Tamamla tiki */}
                    <button type="button" onClick={() => handleTamamla(k)} title={k.tamamlandi ? 'Geri al' : 'Tamamlandı olarak işaretle'}
                      className={`mt-0.5 shrink-0 transition ${k.tamamlandi ? 'text-green-600' : 'text-neutral-300 hover:text-green-500'}`}>
                      <CheckCircle className="w-6 h-6" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {/* Tür rozeti */}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide text-white ${k.tur === 'gorev' ? 'bg-red-500' : 'bg-blue-500'}`}>{k.tur === 'gorev' ? 'Görev' : 'Not'}</span>
                        {/* Konu rozeti */}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${konu.renk}`}><KonuIkon className="w-3 h-3" /> {k.konu}</span>
                        {k.saat && <span className="text-[10px] font-black text-neutral-500 flex items-center gap-0.5"><Clock className="w-3 h-3" /> {k.saat}</span>}
                        {gecikmis && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white uppercase">Gecikti</span>}
                      </div>
                      <p className={`text-sm font-bold ${k.tamamlandi ? 'text-neutral-500 line-through' : 'text-black'}`}>{k.aciklama}</p>
                      {/* İlgili kişi/araç rozeti */}
                      {k.ilgili && <p className="text-[11px] font-bold text-neutral-500 mt-1 flex items-center gap-1"><KonuIkon className="w-3 h-3" /> İlgili: <span className="text-neutral-700">{k.ilgili}</span></p>}
                      {/* YENİ: Görev bir personele atandıysa, kimde olduğu rozetle gösterilir */}
                      {k.atananPersonelAdi && (
                        <p className="mt-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border ${k.tamamlandi ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            <User className="w-3 h-3" /> Görevli: {k.atananPersonelAdi}
                            {k.tamamlandi ? ' • Tamamlandı' : ' • Bekliyor'}
                          </span>
                        </p>
                      )}
                      {/* Belgeler */}
                      {k.belgeler?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {k.belgeler.map((b, i) => (
                            <button key={i} type="button"
                              onClick={() => b.type === 'image' && setViewingImage ? setViewingImage({ title: `Hatırlatma Belgesi`, name: b.url }) : window.open(b.url, '_blank')}
                              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg text-[10px] font-bold text-neutral-600 flex items-center gap-1 transition">
                              {b.type === 'image' ? <Eye className="w-3 h-3" /> : <FileText className="w-3 h-3 text-red-500" />}
                              <span className="max-w-[100px] truncate">{b.name || 'Belge'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Kim ekledi / kim tamamladı (kullanıcı hareketi) */}
                      <p className="text-[10px] font-medium text-neutral-400 mt-1.5">
                        {k.ekleyen && <>Ekleyen: <b className="text-neutral-500">{k.ekleyen}</b></>}
                        {k.tamamlandi && k.tamamlayan && <> • Tamamlayan: <b className="text-green-600">{k.tamamlayan}</b></>}
                      </p>
                    </div>
                    {/* Düzenle / Sil */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button type="button" onClick={() => handleDuzenleAc(k)} title="Düzenle"
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-100 transition"><Edit className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setSilinecekId(k.id)} title="Sil"
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* YENİ / DÜZENLE MODALI */}
      {modalAcik && (
        <div className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={() => { setModalAcik(false); setDuzenlenenId(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <h3 className="font-black text-lg text-red-600">{duzenlenenId ? 'Hatırlatmayı Düzenle' : 'Yeni Hatırlatma'}</h3>
              <button type="button" onClick={() => { setModalAcik(false); setDuzenlenenId(null); }} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {/* Tarih + Saat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Tarih</label>
                  <input type="date" value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Saat (Ops.)</label>
                  <input type="time" value={form.saat} onChange={e => setForm({ ...form, saat: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
              </div>
              {/* Tür: Görev / Not */}
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Tür</label>
                <div className="flex bg-neutral-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setForm({ ...form, tur: 'gorev' })} className={`flex-1 py-2 rounded-lg text-sm font-black transition ${form.tur === 'gorev' ? 'bg-red-600 text-white shadow' : 'text-neutral-500'}`}>Görev</button>
                  <button type="button" onClick={() => setForm({ ...form, tur: 'not' })} className={`flex-1 py-2 rounded-lg text-sm font-black transition ${form.tur === 'not' ? 'bg-blue-600 text-white shadow' : 'text-neutral-500'}`}>Not</button>
                </div>
              </div>

              {/* ============================================================
                  YENİ: GÖREV ATANACAK PERSONEL (yalnızca Tür = Görev iken)
                  Arama kutusuna isim yazılır, mevcut personeller arasından
                  seçilir. Seçilen personele Bildirim Merkezi'nde bildirim
                  düşer ve görev tamamlanana kadar zil ikonunda yanıp söner.
                  ============================================================ */}
              {/* DEĞİŞTİ: Atama alanı artık NOT türünde de açık — nota da
                  personel atanabilir ve aynı bildirim/rozet akışı çalışır. */}
              {(
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">{form.tur === 'gorev' ? 'Görevi Atanacak Personel (Ops.)' : 'Notun Atanacağı Personel (Ops.)'}</label>
                  {form.atananPersonelId ? (
                    // Seçim yapıldıysa: seçilen personeli göster + kaldır butonu
                    <div className="flex items-center justify-between gap-2 bg-red-50 border-2 border-red-300 rounded-xl p-2.5">
                      <span className="flex items-center gap-2 font-black text-sm text-red-800 min-w-0">
                        <User className="w-4 h-4 shrink-0" /> <span className="truncate">{form.atananPersonelAdi}</span>
                      </span>
                      <button type="button" onClick={() => { setForm({ ...form, atananPersonelId: '', atananPersonelAdi: '' }); setPersonelArama(''); }}
                        className="text-red-400 hover:text-red-700 transition shrink-0" title="Atamayı kaldır">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Arama kutusu */}
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          value={personelArama}
                          onChange={e => setPersonelArama(e.target.value)}
                          placeholder="Personel adı ara..."
                          className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600"
                        />
                      </div>
                      {/* Arama sonuçları — yazmaya başlayınca eşleşen personeller listelenir */}
                      {personelArama.trim().length > 0 && (() => {
                        const q = aramaNormalize(personelArama.trim());
                        const sonuclar = personnelList
                          .filter(p => p.employmentStatus !== 'Pasif' && aramaNormalize(p.fullName).includes(q))
                          .slice(0, 8); // Uzun listeyi kısalt (performans + okunabilirlik)
                        return sonuclar.length > 0 ? (
                          <div className="mt-1.5 border border-neutral-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto divide-y divide-neutral-100">
                            {sonuclar.map(p => (
                              <button key={p.id} type="button"
                                onClick={() => { setForm({ ...form, atananPersonelId: String(p.id), atananPersonelAdi: p.fullName }); setPersonelArama(''); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-red-50 transition flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-black text-neutral-600 overflow-hidden shrink-0">
                                  {p.profileImage ? <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" /> : (p.fullName || '?').charAt(0)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-bold text-black truncate">{p.fullName}</span>
                                  <span className="block text-[10px] font-bold text-neutral-400 truncate">{p.position || p.rank || '-'}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[11px] font-bold text-neutral-400 px-1">Eşleşen personel bulunamadı.</p>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
              {/* Konu başlığı (6 kategori) */}
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Konu</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {HATIRLATMA_KONULARI.map(kk => {
                    const Ikon = kk.ikon;
                    return (
                      <button key={kk.id} type="button" onClick={() => { setForm({ ...form, konu: kk.id, ilgili: '' }); setIlgiliArama(''); }}
                        className={`py-2 rounded-xl text-xs font-black border-2 transition flex items-center justify-center gap-1.5 ${form.konu === kk.id ? 'bg-black text-white border-black' : kk.renk}`}>
                        <Ikon className="w-3.5 h-3.5" /> {kk.id}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* İlgili (konuya göre dinamik) */}
              {(() => {
                const secenekler = ilgiliSecenekleri(form.konu);
                return (
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">İlgili {form.konu === 'Personel' ? 'Personel' : form.konu === 'Müşteri' ? 'Müşteri' : form.konu === 'Araç' ? 'Araç' : ''} (Ops.)</label>
                    {secenekler ? (
                      /* ARANABİLİR SEÇİM: düz açılır liste yerine arama kutusu.
                         Yazdıkça eşleşenler listelenir, tıklayınca seçilir. */
                      form.ilgili ? (
                        // Seçim yapıldıysa: seçileni göster + kaldır butonu
                        <div className="flex items-center justify-between gap-2 bg-red-50 border-2 border-red-300 rounded-xl p-2.5">
                          <span className="font-black text-sm text-red-800 truncate min-w-0">{form.ilgili}</span>
                          <button type="button" onClick={() => { setForm({ ...form, ilgili: '' }); setIlgiliArama(''); }}
                            className="text-red-400 hover:text-red-700 transition shrink-0" title="Seçimi kaldır">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                              value={ilgiliArama}
                              onChange={e => setIlgiliArama(e.target.value)}
                              placeholder={`${form.konu === 'Personel' ? 'Personel' : form.konu === 'Müşteri' ? 'Müşteri' : form.konu === 'Araç' ? 'Araç/plaka' : 'Kayıt'} ara...`}
                              className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600"
                            />
                          </div>
                          {(() => {
                            // Arama boşsa ilk 8 kayıt, doluysa eşleşenler gösterilir
                            const q = aramaNormalize(ilgiliArama.trim());
                            const sonuclar = (q ? secenekler.filter(x => aramaNormalize(x).includes(q)) : secenekler).slice(0, 8);
                            if (sonuclar.length === 0) {
                              return <p className="mt-1.5 text-[11px] font-bold text-neutral-400 px-1">Eşleşen kayıt bulunamadı.</p>;
                            }
                            return (
                              <div className="mt-1.5 border border-neutral-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto divide-y divide-neutral-100">
                                {sonuclar.map(x => (
                                  <button key={x} type="button"
                                    onClick={() => { setForm({ ...form, ilgili: x }); setIlgiliArama(''); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-red-50 transition text-sm font-bold text-black truncate">
                                    {x}
                                  </button>
                                ))}
                                {!q && secenekler.length > 8 && (
                                  <p className="px-3 py-2 text-[10px] font-bold text-neutral-400 bg-neutral-50">
                                    {secenekler.length} kayıttan ilk 8'i • aramak için yazın
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )
                    ) : (
                      <input value={form.ilgili} onChange={e => setForm({ ...form, ilgili: e.target.value })} placeholder="Örn: Paraşüt faturası, koli siparişi..." className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                    )}
                  </div>
                );
              })()}
              {/* Açıklama */}
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Not / Açıklama</label>
                <textarea value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} rows={3} placeholder="Detay..." className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-600 resize-none" />
              </div>
              {/* Belgeler (çoklu) */}
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Belgeler (Fotoğraf / PDF — birden fazla)</label>
                <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black border-2 border-dashed transition cursor-pointer ${belgeYukleniyor ? 'border-neutral-200 text-neutral-400 pointer-events-none' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                  {belgeYukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  {belgeYukleniyor ? 'Yükleniyor...' : 'Dosya Ekle'}
                  <input type="file" multiple accept="image/*,application/pdf,.pdf" className="hidden" onChange={handleBelgeYukle} disabled={belgeYukleniyor} />
                </label>
                {form.belgeler.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.belgeler.map((b, i) => (
                      <span key={i} className="flex items-center gap-1 bg-neutral-100 border border-neutral-200 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-600">
                        {b.type === 'image' ? <Eye className="w-3 h-3" /> : <FileText className="w-3 h-3 text-red-500" />}
                        <span className="max-w-[110px] truncate">{b.name}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, belgeler: f.belgeler.filter((_, x) => x !== i) }))} className="text-neutral-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Tamamlandı işareti */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.tamamlandi} onChange={e => setForm({ ...form, tamamlandi: e.target.checked })} className="w-4 h-4 accent-green-600" />
                <span className="text-sm font-bold text-neutral-700">Tamamlandı olarak işaretle</span>
              </label>
            </div>
            <div className="p-4 border-t border-neutral-200 flex gap-2 shrink-0">
              <button type="button" onClick={() => { setModalAcik(false); setDuzenlenenId(null); }} className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black rounded-xl transition text-sm">İptal</button>
              <button type="button" onClick={handleKaydet} disabled={kaydediliyor || !form.aciklama.trim()}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black rounded-xl transition flex justify-center items-center gap-2">
                {kaydediliyor ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />} Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SİLME ONAYI */}
      {silinecekId && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSilinecekId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-black flex items-center gap-2 mb-2"><Trash2 className="w-5 h-5 text-red-600" /> Hatırlatmayı Sil</h3>
            <p className="text-sm text-neutral-600 font-medium mb-4">Bu hatırlatma kalıcı olarak silinecek. Emin misiniz?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSilinecekId(null)} className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black rounded-xl transition text-sm">Vazgeç</button>
              <button type="button" onClick={handleSil} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition text-sm">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
