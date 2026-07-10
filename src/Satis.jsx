import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Phone, FileText, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, Briefcase, Wallet, ArrowUpRight, ArrowUpDown, UserPlus, Edit, User, MessageCircle, Package, Database, History, Save, Search, FolderOpen } from 'lucide-react';
import { collection, addDoc, onSnapshot, doc, setDoc, query, where } from 'firebase/firestore';
import { db, appId, PROVINCES, FLOORS, normalizeCariPhone, generateContractPDF } from './shared.jsx';
  export const AddJobView = ({
    type, formData, setFormData, handleInputChange, handleProvinceChange,
    handleDepoChange, toggleDepoDirection, handleAddJob, editingJobId, handleSwapAddresses
  }) => {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
          <h2 className="text-2xl font-black text-black flex items-center gap-2">
            <PlusCircle className="w-7 h-7 text-red-600" /> 
            {editingJobId ? `Detaylı ${type} Kaydını Güncelle` : `Detaylı ${type} Kaydı Oluştur`}
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

        <div  className="space-y-6">
          {/* MÜŞTERİ VE GENEL BİLGİLER */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
            <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
              <Users className="w-5 h-5 text-red-600" /> Müşteri ve Randevu Bilgileri
            </h3>
            
            <div className="flex bg-neutral-200/60 p-1 rounded-xl mb-6 w-fit border border-neutral-300">
              <button 
                type="button"
                onClick={() => setFormData({...formData, customerType: 'Bireysel'})}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${formData.customerType === 'Bireysel' ? 'bg-white text-red-600 shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                <User className="w-4 h-4" /> Bireysel Müşteri
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, customerType: 'Kurumsal'})}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${formData.customerType === 'Kurumsal' ? 'bg-white text-red-600 shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                <Briefcase className="w-4 h-4" /> Kurumsal Müşteri
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">
                  {formData.customerType === 'Kurumsal' ? 'Şirket Ünvanı *' : 'Ad Soyad *'}
                </label>
                <input required type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder={formData.customerType === 'Kurumsal' ? 'Örn: Sembol Nakliyat A.Ş.' : 'Örn: Mehmet Şen'} />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Telefon Numarası *</label>
                <input required type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 05551234567" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Yedek Telefon Numarası</label>
                <input type="tel" name="altPhone" value={formData.altPhone || ''} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="İsteğe Bağlı" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">
                  {formData.customerType === 'Kurumsal' ? 'Vergi No' : 'TC Kimlik Numarası'}
                </label>
                {formData.customerType === 'Kurumsal' ? (
                  <input type="text" name="taxNo" value={formData.taxNo} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Vergi numarası giriniz" />
                ) : (
                  <input type="text" name="tcNo" value={formData.tcNo} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="İsteğe bağlı" />
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Tarih *</label>
                <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Saat *</label>
                <input required type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">İşlem Süresi (Gün) *</label>
                <select name="durationDays" value={formData.durationDays || '1'} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold transition">
                  {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d} Gün</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* YÜKLEME BİLGİLERİ */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 border-b border-neutral-200 pb-2 gap-2">
              <h3 className="font-black text-red-600 flex items-center gap-2 text-lg uppercase tracking-wide">
                {type === 'Asansör' ? 'Kurulum Adresi' : 'Yükleme Bilgileri (1. Adres)'}
              </h3>
              {type === 'Depo' && formData.depoDirection === 'fromDepo' && (
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
              )}
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${type === 'Asansör' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 mb-6`}>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">{type === 'Asansör' ? 'Kurulum Tipi' : 'Daire Tipi'}</label>
                  <select name="fromRoomCount" value={formData.fromRoomCount} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Kat</label>
                  <select name="fromFloor" value={formData.fromFloor} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                    {type === 'Asansör' 
                      ? Array.from({ length: 20 }, (_, i) => `${i + 1}. Kat`).map(f => <option key={`from-${f}`} value={f}>{f}</option>)
                      : FLOORS.map(f => <option key={`from-${f}`} value={f}>{f}</option>)
                    }
                  </select>
                </div>
                {type !== 'Asansör' && (
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Taşıma Şekli</label>
                    <select name="fromTransportMethod" value={formData.fromTransportMethod || 'Merdiven'} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600">
                      <option value="Bina Asansörü">Bina Asansörü</option>
                      <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                      <option value="Merdiven">Merdiven</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">{type === 'Asansör' ? 'Kurulum Açısı' : 'Yükleme Mesafesi'}</label>
                  <div className="flex gap-2">
                    <input type="number" name="fromDistance" value={formData.fromDistance} onChange={handleInputChange} placeholder="Örn: 20" className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
                    <select name="fromDistanceUnit" value={formData.fromDistanceUnit} onChange={handleInputChange} className="w-24 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                      <option value="Metre">Metre</option>
                      <option value="Adım">Adım</option>
                    </select>
                  </div>
                </div>
                <div className={type === 'Asansör' ? "lg:col-span-3" : "lg:col-span-4"}>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">{type === 'Asansör' ? 'Kime Kurulacak' : 'Küçük Eşyaların Durumu'}</label>
                  <select name="fromPacking" value={formData.fromPacking || (type === 'Asansör' ? 'Kendi İşimiz' : 'Kendisi Topladı')} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                    {type === 'Asansör' ? (
                      <>
                        <option value="Kendi İşimiz">Kendi İşimiz</option>
                        <option value="Dışarıya Kiralama">Dışarıya Kiralama</option>
                      </>
                    ) : (
                      <>
                        <option value="Kendisi Topladı">Kendisi Topladı</option>
                        <option value="Toplama Yapılacak">Toplama Yapılacak</option>
                      </>
                    )}
                  </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">İl *</label>
                  <select required name="fromProvince" value={formData.fromProvince} onChange={(e) => handleProvinceChange(e, 'from')} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                    <option value="">İl Seçiniz</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">İlçe *</label>
                  <input required type="text" name="fromDistrict" value={formData.fromDistrict} onChange={handleInputChange} placeholder="İlçe giriniz" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                </div>
            </div>
            <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres Bilgileri</label>
                <textarea name="fromAddress" value={formData.fromAddress} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-16 resize-none" placeholder="Mahalle, sokak, bina no vb." />
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
                <div className={`grid grid-cols-1 md:grid-cols-2 ${type === 'Asansör' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 mb-6`}>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">{type === 'Asansör' ? 'Kurulum Tipi' : 'Daire Tipi'}</label>
                    <select 
                      value={addr.roomCount} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, roomCount: e.target.value } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
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
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Kat</label>
                    <select 
                      value={addr.floor} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, floor: e.target.value } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                    >
                      {type === 'Asansör' 
                        ? Array.from({ length: 20 }, (_, i) => `${i + 1}. Kat`).map(f => <option key={`ext-from-${f}`} value={f}>{f}</option>)
                        : FLOORS.map(f => <option key={`ext-from-${f}`} value={f}>{f}</option>)
                      }
                    </select>
                  </div>
                  {type !== 'Asansör' && (
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Taşıma Şekli</label>
                      <select 
                        value={addr.transportMethod} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, transportMethod: e.target.value } : a) }))} 
                        className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600"
                      >
                        <option value="Bina Asansörü">Bina Asansörü</option>
                        <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                        <option value="Merdiven">Merdiven</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">{type === 'Asansör' ? 'Kurulum Açısı' : 'Yükleme Mesafesi'}</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={addr.distance} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, distance: e.target.value } : a) }))} 
                        placeholder="Örn: 20" 
                        className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" 
                      />
                      <select 
                        value={addr.distanceUnit} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, distanceUnit: e.target.value } : a) }))} 
                        className="w-24 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                      >
                        <option value="Metre">Metre</option>
                        <option value="Adım">Adım</option>
                      </select>
                    </div>
                  </div>
                  <div className={type === 'Asansör' ? "lg:col-span-3" : "lg:col-span-4"}>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">{type === 'Asansör' ? 'Kime Kurulacak' : 'Küçük Eşyaların Durumu'}</label>
                    <select 
                      value={addr.packing} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, packing: e.target.value } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                    >
                      {type === 'Asansör' ? (
                        <>
                          <option value="Kendi İşimiz">Kendi İşimiz</option>
                          <option value="Dışarıya Kiralama">Dışarıya Kiralama</option>
                        </>
                      ) : (
                        <>
                          <option value="Kendisi Topladı">Kendisi Topladı</option>
                          <option value="Toplama Yapılacak">Toplama Yapılacak</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İl</label>
                    <select 
                      value={addr.province} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, province: e.target.value, district: '' } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                    >
                      <option value="">İl Seçiniz</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İlçe</label>
                    <input 
                      type="text"
                      value={addr.district} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, district: e.target.value } : a) }))} 
                      placeholder="İlçe giriniz"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres Bilgileri</label>
                  <textarea 
                    value={addr.address} 
                    onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, address: e.target.value } : a) }))} 
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-16 resize-none" 
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
              className="mt-6 w-full py-3 border-2 border-dashed border-neutral-300 text-neutral-600 font-bold rounded-xl hover:bg-neutral-100 hover:border-neutral-400 transition flex justify-center items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" /> Yeni {type === 'Asansör' ? 'Kurulum' : 'Yükleme'} Adresi Ekle
            </button>
          </div>

          {type !== 'Asansör' && (
            <>
              {/* ORTADAKİ YER DEĞİŞTİRME BUTONU */}
              <div className="flex justify-center items-center h-0 relative z-10">
                <button 
                  type="button" 
                  onClick={handleSwapAddresses}
                  className="bg-black text-white px-6 py-2.5 rounded-full shadow-2xl border-4 border-white hover:bg-neutral-800 transition flex items-center gap-2 font-bold text-sm absolute"
                  title="Yükleme ve Boşaltma Bilgilerini Yer Değiştir"
                >
                  <ArrowUpDown className="w-5 h-5" /> Yönleri Değiştir
                </button>
              </div>

              {/* BOŞALTMA BİLGİLERİ */}
              <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 border-b border-neutral-200 pb-2 gap-2">
                  <h3 className="font-black text-red-600 flex items-center gap-2 text-lg uppercase tracking-wide">
                    Boşaltma Bilgileri (1. Adres)
                  </h3>
                  {type === 'Depo' && formData.depoDirection === 'toDepo' && (
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
                  )}
                </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Daire Tipi</label>
                  <select name="toRoomCount" value={formData.toRoomCount} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Kat</label>
                  <select name="toFloor" value={formData.toFloor} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                    {FLOORS.map(f => <option key={`to-${f}`} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Taşıma Şekli</label>
                  <select name="toTransportMethod" value={formData.toTransportMethod || 'Merdiven'} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600">
                    <option value="Bina Asansörü">Bina Asansörü</option>
                    <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                    <option value="Merdiven">Merdiven</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Boşaltma Mesafesi</label>
                  <div className="flex gap-2">
                    <input type="number" name="toDistance" value={formData.toDistance} onChange={handleInputChange} placeholder="Örn: 15" className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" />
                    <select name="toDistanceUnit" value={formData.toDistanceUnit} onChange={handleInputChange} className="w-24 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                      <option value="Metre">Metre</option>
                      <option value="Adım">Adım</option>
                    </select>
                  </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">İl *</label>
                  <select required name="toProvince" value={formData.toProvince} onChange={(e) => handleProvinceChange(e, 'to')} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                    <option value="">İl Seçiniz</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">İlçe *</label>
                  <input required type="text" name="toDistrict" value={formData.toDistrict} onChange={handleInputChange} placeholder="İlçe giriniz" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                </div>
            </div>
            <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres Bilgileri</label>
                <textarea name="toAddress" value={formData.toAddress} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-16 resize-none" placeholder="Mahalle, sokak, bina no vb." />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Daire Tipi</label>
                    <select 
                      value={addr.roomCount} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, roomCount: e.target.value } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
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
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Kat</label>
                    <select 
                      value={addr.floor} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, floor: e.target.value } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                    >
                      {FLOORS.map(f => <option key={`ext-to-${f}`} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Taşıma Şekli</label>
                    <select 
                      value={addr.transportMethod} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, transportMethod: e.target.value } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-red-600"
                    >
                      <option value="Bina Asansörü">Bina Asansörü</option>
                      <option value="Dış Cephe Asansörü">Dış Cephe Asansörü</option>
                      <option value="Merdiven">Merdiven</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Boşaltma Mesafesi</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={addr.distance} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, distance: e.target.value } : a) }))} 
                        placeholder="Örn: 15" 
                        className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none" 
                      />
                      <select 
                        value={addr.distanceUnit} 
                        onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, distanceUnit: e.target.value } : a) }))} 
                        className="w-24 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                      >
                        <option value="Metre">Metre</option>
                        <option value="Adım">Adım</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İl</label>
                    <select 
                      value={addr.province} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, province: e.target.value, district: '' } : a) }))} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                    >
                      <option value="">İl Seçiniz</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İlçe</label>
                    <input 
                      type="text"
                      value={addr.district} 
                      onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, district: e.target.value } : a) }))} 
                      placeholder="İlçe giriniz"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres Bilgileri</label>
                  <textarea 
                    value={addr.address} 
                    onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, address: e.target.value } : a) }))} 
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-16 resize-none" 
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
              className="mt-6 w-full py-3 border-2 border-dashed border-neutral-300 text-neutral-600 font-bold rounded-xl hover:bg-neutral-100 hover:border-neutral-400 transition flex justify-center items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" /> Yeni Boşaltma Adresi Ekle
            </button>
          </div>
            </>
          )}

          {/* FİNANS & NOTLAR */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
            <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
              <Wallet className="w-5 h-5 text-red-600" /> Finans ve Operasyon Notları
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Anlaşılan Fiyat (TL)</label>
                <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Alınan Kapora (TL)</label>
                <input type="number" name="deposit" value={formData.deposit} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold text-green-600" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Sözleşme Detayı</label>
                <textarea name="contractDetails" value={formData.contractDetails || ''} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-20 resize-none transition" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Operasyon Notları</label>
                <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-20 resize-none transition" />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleAddJob} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-700 transition flex justify-center items-center gap-2 text-xl shadow-xl shadow-red-600/30">
            <PlusCircle className="w-6 h-6" /> 
            {editingJobId ? 'Kaydı Güncelle' : 'Kaydı Oluştur'}
          </button>
        </div>
      </div>
    );
  };

  export const CustomerListView = ({ jobs, title, handleEditJob, onViewCari }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Sadece başlığa göre filtreleme yapıyoruz
    const relevantJobs = title === 'Özel Müşteriler' ? jobs.filter(j => j.isSpecial) : jobs;

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

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2 shrink-0">
            <Users className="w-6 h-6 text-red-600" /> {title}
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
              {customers.map((c, index) => (
                <tr key={index} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-2">
                      {c.isSpecial && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 drop-shadow-sm shrink-0" />}
                      <div>
                        {c.name}
                        <span className="block text-[10px] text-neutral-500 font-medium">{c.type} Müşteri</span>
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
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-neutral-500">Müşteri kaydı bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
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
  export const CustomerProfileView = ({ jobs, cariKey, onBack, handleEditJob, db, appId, addSystemLog, personnelList = [], vehicles = [] }) => {
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
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-4">
            <Users className="w-6 h-6 text-red-600" /> Cari Hesap Profili
          </h2>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-2xl font-black text-orange-600 shrink-0">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-black flex items-center gap-2">
                {customerName}
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

