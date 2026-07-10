import React, { useState, useEffect } from 'react';
import { Truck, MapPin, CheckCircle, Clock, PlusCircle, ClipboardList, Star, AlertTriangle, X, Users, CalendarDays, Briefcase, Wallet, Activity, ArrowUpRight, ArrowDownRight, Landmark, CreditCard, DollarSign, Edit, Ban, User, Loader2, Package, Database, Download, BarChart, TrendingUp } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, appId, MESAI_STATUS_OPTIONS, isPersonnelVisibleInMonth } from './shared.jsx';
  export const ReportingView = ({ jobs, personnelList }) => {
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
        reportData[creator] = { count: 0, revenue: 0, nakliyeCount: 0, nakliyeRevenue: 0, depoCount: 0, depoRevenue: 0, asansorCount: 0, asansorRevenue: 0, cancelledCount: 0 };
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
      if (selectedType !== 'Tümü' && job.type !== selectedType) return;
      const d = new Date(job.date);
      const inPeriod = reportPeriod === 'year'
        ? d.getFullYear() === selectedYear
        : (d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth);
      if (!inPeriod) return;
      const creator = job.createdBy || 'Sistem / Bilinmeyen';
      if (!reportData[creator]) {
        reportData[creator] = { count: 0, revenue: 0, nakliyeCount: 0, nakliyeRevenue: 0, depoCount: 0, depoRevenue: 0, asansorCount: 0, asansorRevenue: 0, cancelledCount: 0 };
      }
      reportData[creator].cancelledCount = (reportData[creator].cancelledCount || 0) + 1;
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

    return (
      <div className="space-y-6 animate-in fade-in">
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
                        <div className="flex items-center justify-center mt-1.5">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-lg border border-red-200 text-[10px] font-black flex items-center gap-1">
                            <Ban className="w-3 h-3" /> {item.cancelledCount} İş İptali
                          </span>
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
      const leader = assigned.find(p => ['Ekip Şefi', 'Müdür', 'Kalfa'].includes(p.rank));
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

    // Tarihe göre yeniden eskiye sırala
    allRecords.sort((a, b) => b.rawDate - a.rawDate);

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
    });

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

      const nextMonthPrims = {};
      over20.forEach(p => {
          nextMonthPrims[p.id] = Math.round(cikanRakam * p.finalScore);
      });

      setMonthCloseModalData({
          rank1Score, rank2Score, rank3Score,
          winners, over20, yorumSayisi, cikanRakam, nextMonthPrims, newBonusRecords
      });
      setShowMonthCloseModal(true);
    };

    const confirmCloseMonth = async () => {
       try {
           const puantajRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${docPrefix}${currentYear}_${currentMonth}`);
           await setDoc(puantajRef, {
               bonusRecords: monthCloseModalData.newBonusRecords,
               isClosed: true
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

           setPuantajMeta(prev => ({...prev, bonusRecords: monthCloseModalData.newBonusRecords, isClosed: true}));
           setShowMonthCloseModal(false);
           addSystemLog('Ay Sonu Kapanışı', `${currentMonth}/${currentYear} dönemi ${collarType} puantajı kapatıldı, primler hesaplanıp ${nextMonth}/${nextYear} maaşlarına eklendi.`);
           
       } catch (e) {
           console.error(e);
           alert("Kapatma işlemi sırasında hata oluştu.");
       }
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 md:p-6 animate-in fade-in flex flex-col h-[calc(100vh-190px)] relative w-full overflow-hidden">
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
                <div className="w-full md:w-auto bg-purple-100 text-purple-800 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 border border-purple-200 text-sm mt-1 md:mt-0 order-last md:order-none cursor-not-allowed">
                  <CheckCircle className="w-4 h-4" /> Ay Kapatıldı
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
                                {monthCloseModalData.winners.rank1.length > 0 && <p className="text-[10px] font-bold text-white bg-yellow-500 px-2 py-0.5 rounded-full w-max mt-1">+10 Puan Eklenecek</p>}
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-neutral-300 shadow-sm">
                            <span className="text-2xl">🥈</span>
                            <div>
                                <p className="font-black text-neutral-500 text-lg leading-none mb-1">2. Sıra <span className="text-sm text-neutral-400">({monthCloseModalData.rank2Score > 0 ? monthCloseModalData.rank2Score : 0} Puan)</span></p>
                                <p className="text-sm font-bold text-neutral-800">
                                    {monthCloseModalData.winners.rank2.length > 0 ? monthCloseModalData.winners.rank2.map(w => w.name).join(', ') : 'Kimse Yok'}
                                </p>
                                {monthCloseModalData.winners.rank2.length > 0 && <p className="text-[10px] font-bold text-white bg-neutral-500 px-2 py-0.5 rounded-full w-max mt-1">+5 Puan Eklenecek</p>}
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-orange-300 shadow-sm">
                            <span className="text-2xl">🥉</span>
                            <div>
                                <p className="font-black text-orange-600 text-lg leading-none mb-1">3. Sıra <span className="text-sm text-neutral-500">({monthCloseModalData.rank3Score > 0 ? monthCloseModalData.rank3Score : 0} Puan)</span></p>
                                <p className="text-sm font-bold text-neutral-800">
                                    {monthCloseModalData.winners.rank3.length > 0 ? monthCloseModalData.winners.rank3.map(w => w.name).join(', ') : 'Kimse Yok'}
                                </p>
                                {monthCloseModalData.winners.rank3.length > 0 && <p className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full w-max mt-1">+3 Puan Eklenecek</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Kısım: Prim Hesaplama Formülü */}
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                    <h4 className="font-black text-blue-900 text-lg mb-4 flex items-center gap-2 border-b border-blue-200 pb-2">💰 Prime Dönüşüm Hesaplaması</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-blue-200 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-neutral-500 mb-1">Toplam Yorum</p>
                            <p className="text-xl font-black text-blue-600">{monthCloseModalData.yorumSayisi}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-blue-200 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-neutral-500 mb-1">&ge;20 Puan Alan</p>
                            <p className="text-xl font-black text-blue-600">{monthCloseModalData.over20.length} Kişi</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-blue-200 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-neutral-500 mb-1">Sabit Bölen</p>
                            <p className="text-xl font-black text-blue-600">8</p>
                        </div>
                        <div className="bg-blue-600 p-3 rounded-xl border border-blue-700 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-blue-200 mb-1">Birim Katsayı</p>
                            <p className="text-xl font-black text-white">{monthCloseModalData.cikanRakam.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-white p-3 rounded-xl border border-blue-200">
                        <p className="text-xs font-bold text-blue-800 mb-2">Gelecek Ay Primine Yansıyacak Tutarlar:</p>
                        {monthCloseModalData.over20.length > 0 ? monthCloseModalData.over20.map(p => (
                            <div key={p.id} className="flex justify-between items-center border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                                <span className="font-bold text-sm text-neutral-800">{p.name} <span className="text-[10px] text-neutral-400">({p.finalScore} Net Puan)</span></span>
                                <span className="font-black text-green-600">₺{monthCloseModalData.nextMonthPrims[p.id]?.toLocaleString('tr-TR')}</span>
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
    });

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

            beyazYakaList.forEach(person => {
              if (!fetchedRecords[person.id]) fetchedRecords[person.id] = {};
              for (let d = 1; d <= daysInMonth; d++) {
                const existingValObj = fetchedRecords[person.id][d];
                const existingStatus = typeof existingValObj === 'object' && existingValObj !== null ? existingValObj.status : existingValObj;
                
                // Eğer o güne ait bir mesai girişi yapılmamışsa (boşsa) otomatik doldur
                if (!existingStatus) {
                  const dateObj = new Date(currentYear, currentMonth - 1, d);
                  const isSunday = dateObj.getDay() === 0; // 0 = Pazar
                  fetchedRecords[person.id][d] = { status: isSunday ? 'Hİ' : 'G', hours: '' };
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
          [day]: { status: value, hours: '' } // Sadece status değiştirirken saati sıfırla
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
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 md:p-6 animate-in fade-in flex flex-col h-[calc(100vh-190px)] relative w-full overflow-hidden">
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

  export const MaasView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
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
    });

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

      // Devamsızlık, Rapor ve Ücretsiz İzin doğrudan Mesai Gün Sayısını eksiltir
      const mesaiGunSayisi = Math.max(0, 30 - rapor - devamsizlikSayisi - ucretsizIzinSayisi);
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
      const toplamAvans = nakitAvans + resmiAvans;
      const netMaas = (maas / 30) * mesaiGunSayisi;
      const maliyet = netMaas + mesaiUcreti + yol + yemek;
      
      // Kalan Nakit: (Hak edilen maaş) - Bankaya Yatan Kısım - Nakit Avans + Mesai Ücreti
      const kalanNakit = netMaas - hesaplananBanka - nakitAvans + mesaiUcreti;

      return { 
        nakitAvans, resmiAvans, gunlukSaat, toplamSaat, mesaiGunSayisi, 
        maas, fazlaGunSayisi, devamsizlikSayisi, rapor, ucretsizIzinSayisi, prim, yol, yemek,
        hesaplananBanka, icraKesintisi, bankaKalan,
        mesaiUcreti, toplamAvans, netMaas, maliyet, kalanNakit 
      };
    };

    // Alt Kısımda Gösterilecek Genel Toplamları Hesapla
    let totalKalanBanka = 0;
    let totalKalanNakit = 0;
    let totalYol = 0;
    let totalYemek = 0;

    targetPersonnelList.forEach(person => {
        const c = calcRow(person.id);
        totalKalanBanka += c.bankaKalan;
        totalKalanNakit += c.kalanNakit;
        totalYol += c.yol;
        totalYemek += c.yemek;
    });

    const handleDownloadCSV = () => {
      const headers = [
        "PERSONEL BİLGİSİ", "İŞE BAŞLANGIÇ TARİHİ", "NAKİT AVANS", "RESMİ AVANS", "GÜNLÜK SAAT", "TOPLAM SAAT", 
        "MESAİ GÜN SAYISI", "FAZLA GÜN SAYISI", "DEVAMSIZLIK", "RAPOR", "YILLIK İZİN", "BANKA PARASI", 
        "PRİM", "MAAŞ", "MESAİ ÜCRETİ", "YEMEK PARASI", "YOL PARASI", "BORÇLANMA", "İCRA TUTARI", "KALAN BANKA", "KALAN NAKİT"
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
              c.prim,
              c.maas,
              c.mesaiUcreti.toFixed(2),
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

        <div className="flex-1 w-full overflow-auto overflow-x-auto border border-neutral-300 custom-scrollbar-table rounded-xl bg-white shadow-inner relative">
          <table className="w-full border-collapse text-xs md:text-sm min-w-max">
            <thead className="sticky top-0 z-30 shadow-md">
              <tr>
                <th colSpan="21" className="bg-green-600 text-white font-black py-2 border-b-2 border-neutral-400 text-sm md:text-lg tracking-wider">
                  {months.find(m => m.val === currentMonth)?.label.toUpperCase()} {currentYear} {collarType.toUpperCase()} MAAŞ HESAPLAMA TABLOSU
                </th>
              </tr>
              <tr>
                <th className="bg-neutral-200 text-black font-black p-2 border-b border-r border-neutral-400 sticky left-0 z-30 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs align-bottom">PERSONEL BİLGİSİ</th>
                <th className="bg-neutral-100 text-neutral-900 font-bold p-2 border-b border-r border-neutral-400 w-24 text-center">İŞE BAŞLANGIÇ TARİHİ</th>
                <th className="bg-yellow-100 text-yellow-900 font-bold p-2 border-b border-r border-neutral-400 w-24">NAKİT AVANS</th>
                <th className="bg-yellow-100 text-yellow-900 font-bold p-2 border-b border-r border-neutral-400 w-24">RESMİ AVANS</th>
                <th className="bg-blue-100 text-blue-900 font-bold p-2 border-b border-r border-neutral-400 w-20">GÜNLÜK SAAT</th>
                <th className="bg-blue-100 text-blue-900 font-bold p-2 border-b border-r border-neutral-400 w-20">TOPLAM SAAT</th>
                <th className="bg-blue-100 text-blue-900 font-bold p-2 border-b border-r border-neutral-400 w-20">MESAİ GÜN SAYISI</th>
                <th className="bg-teal-100 text-teal-900 font-bold p-2 border-b border-r border-neutral-400 w-24">FAZLA GÜN SAYISI</th>
                <th className="bg-red-100 text-red-900 font-bold p-2 border-b border-r border-neutral-400 w-20">DEVAMSIZLIK</th>
                <th className="bg-orange-100 text-orange-900 font-bold p-2 border-b border-r border-neutral-400 w-20">RAPOR</th>
                <th className="bg-purple-100 text-purple-900 font-bold p-2 border-b border-r border-neutral-400 w-24">YILLIK İZİN</th>
                <th className="bg-neutral-100 text-neutral-900 font-bold p-2 border-b border-r border-neutral-400 w-24">BANKA PARASI</th>
                <th className="bg-green-100 text-green-900 font-bold p-2 border-b border-r border-neutral-400 w-20">PRİM</th>
                <th className="bg-blue-100 text-blue-900 font-bold p-2 border-b border-r border-neutral-400 w-24">MAAŞ</th>
                <th className="bg-purple-200 text-purple-900 font-black p-2 border-b border-r border-neutral-400 w-24">MESAİ ÜCRETİ</th>
                <th className="bg-neutral-100 text-neutral-900 font-bold p-2 border-b border-r border-neutral-400 w-24">YEMEK PARASI</th>
                <th className="bg-neutral-100 text-neutral-900 font-bold p-2 border-b border-r border-neutral-400 w-24">YOL PARASI</th>
                <th className="bg-red-100 text-red-900 font-bold p-2 border-b border-r border-neutral-400 w-24">BORÇLANMA</th>
                <th className="bg-red-200 text-red-900 font-bold p-2 border-b border-r border-neutral-400 w-24">İCRA TUTARI</th>
                <th className="bg-yellow-200 text-yellow-900 font-black p-2 border-b border-r border-neutral-400 w-24">KALAN BANKA</th>
                <th className="bg-orange-200 text-orange-900 font-black p-2 border-b border-neutral-400 w-24">KALAN NAKİT</th>
              </tr>
            </thead>
            <tbody>
              {targetPersonnelList.map(person => {
                const row = maasData[person.id] || {};
                const c = calcRow(person.id);
                return (
                  <tr key={person.id} className="hover:bg-neutral-50 transition border-b border-neutral-300">
                    <td className="sticky left-0 z-20 bg-white border-r border-neutral-400 p-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 border border-neutral-300 text-[8px] md:text-sm">
                          {person.profileImage ? (
                            <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                          ) : (
                            person.fullName.charAt(0)
                          )}
                        </div>
                        <span className="font-bold text-neutral-800 text-xs truncate max-w-[150px]">{person.fullName.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="border-r border-neutral-300 p-1 text-center text-xs font-medium text-neutral-600 align-middle">
                      {person.startDate || '-'}
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-yellow-50/30">
                      <input type="number" value={row.nakitAvans || ''} onChange={e => handleCellChange(person.id, 'nakitAvans', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-yellow-100 focus:ring-1 focus:ring-yellow-400 rounded" placeholder="0" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-yellow-50/30">
                      <input type="number" value={row.resmiAvans || ''} onChange={e => handleCellChange(person.id, 'resmiAvans', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-yellow-100 focus:ring-1 focus:ring-yellow-400 rounded" placeholder="0" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-blue-50/50">
                      <input type="number" readOnly value={c.gunlukSaat || ''} className="w-full h-8 text-center bg-transparent outline-none rounded font-bold text-blue-600 cursor-not-allowed" placeholder="0" title="Mesai tablosundan otomatik hesaplanır" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-blue-50/50">
                      <input type="number" readOnly value={c.toplamSaat} className="w-full h-8 text-center bg-transparent outline-none rounded font-bold text-blue-600 cursor-not-allowed" placeholder="0" title="Otomatik hesaplanır" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-blue-50/50">
                      <input type="number" readOnly value={c.mesaiGunSayisi} className="w-full h-8 text-center bg-transparent outline-none rounded font-bold cursor-not-allowed" title="Mesai tablosundan otomatik hesaplanır" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-teal-50/50">
                      <input type="number" value={row.fazlaGun !== undefined ? row.fazlaGun : (c.fazlaGunSayisi || '')} onChange={e => handleCellChange(person.id, 'fazlaGun', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-teal-100 focus:ring-1 focus:ring-teal-400 rounded text-teal-700 font-bold" placeholder="0" title="Manuel düzenlenebilir" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-red-50/50">
                      <input type="number" value={row.devamsizlik !== undefined ? row.devamsizlik : (c.devamsizlikSayisi || '')} onChange={e => handleCellChange(person.id, 'devamsizlik', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-red-100 focus:ring-1 focus:ring-red-400 rounded text-red-600 font-bold" placeholder="0" title="Manuel düzenlenebilir" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-orange-50/50">
                      <input type="number" value={row.rapor !== undefined ? row.rapor : (c.rapor || '')} onChange={e => handleCellChange(person.id, 'rapor', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-orange-100 focus:ring-1 focus:ring-orange-400 rounded text-orange-600 font-bold" placeholder="0" title="Manuel düzenlenebilir" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-purple-50/50">
                      <input type="number" value={(yearlyData[person.id] && yearlyData[person.id].yillikIzin) || ''} onChange={e => handleYearlyChange(person.id, 'yillikIzin', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-purple-100 focus:ring-1 focus:ring-purple-400 rounded text-purple-700 font-bold" placeholder="0" title="Tüm yıl boyunca geçerlidir. Yıl sonunda sıfırlanır." />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-neutral-100 font-bold text-neutral-600 text-center align-middle">
                      {c.hesaplananBanka.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="border-r border-neutral-300 p-1">
                      <input type="number" value={row.prim || ''} onChange={e => handleCellChange(person.id, 'prim', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-green-50 focus:ring-1 focus:ring-green-400 rounded text-green-600 font-bold" placeholder="0" />
                    </td>
                    <td className="border-r border-neutral-300 p-1">
                      <input type="number" value={row.maas !== undefined ? row.maas : (person.maas || '')} onChange={e => handleCellChange(person.id, 'maas', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded font-bold" placeholder="0" />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-purple-100 font-bold text-purple-900 text-center align-middle">
                      {c.mesaiUcreti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`border-r border-neutral-300 p-1 ${row.yemekOdendi ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input type="number" value={row.yemek !== undefined ? row.yemek : (person.yemek || '')} onChange={e => handleCellChange(person.id, 'yemek', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-neutral-100 focus:ring-1 focus:ring-neutral-400 rounded" placeholder="0" />
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'yemekOdendi', 'yemekOdenenTutar', (row.yemek !== undefined ? row.yemek : (person.yemek || 0)))} className={`p-1 shrink-0 rounded transition ${row.yemekOdendi ? 'text-green-600' : 'text-neutral-300 hover:text-neutral-500'}`} title={row.yemekOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className={`border-r border-neutral-300 p-1 ${row.yolOdendi ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input type="number" value={row.yol !== undefined ? row.yol : (person.yol || '')} onChange={e => handleCellChange(person.id, 'yol', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-neutral-100 focus:ring-1 focus:ring-neutral-400 rounded" placeholder="0" />
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'yolOdendi', 'yolOdenenTutar', (row.yol !== undefined ? row.yol : (person.yol || 0)))} className={`p-1 shrink-0 rounded transition ${row.yolOdendi ? 'text-green-600' : 'text-neutral-300 hover:text-neutral-500'}`} title={row.yolOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-red-50/50">
                      <input type="number" value={(yearlyData[person.id] && yearlyData[person.id].borclanma) || ''} onChange={e => handleYearlyChange(person.id, 'borclanma', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-red-100 focus:ring-1 focus:ring-red-400 rounded text-red-700 font-bold" placeholder="0" title="Tüm yıl boyunca geçerlidir. Yıl sonunda sıfırlanır." />
                    </td>
                    <td className={`border-r border-neutral-300 p-1 font-black text-center align-middle ${row.icraOdendi ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={row.icraOdendi ? 'line-through opacity-70' : ''}>{c.icraKesintisi.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        {c.icraKesintisi > 0 && (
                          <button type="button" onClick={() => handlePaymentToggle(person.id, 'icraOdendi', 'icraOdenenTutar', c.icraKesintisi)} className={`p-0.5 shrink-0 rounded transition ${row.icraOdendi ? 'text-green-700' : 'text-red-600/50 hover:text-red-800'}`} title={row.icraOdendi ? 'İcra Kesintisi Yatırıldı (Gidere işlendi)' : 'İcra Kesintisi Ödenmedi'}>
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`border-r border-neutral-300 p-1 align-middle ${row.bankaOdendi ? 'bg-green-200' : 'bg-yellow-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${row.bankaOdendi ? 'text-green-800 line-through opacity-70' : 'text-yellow-900'}`}>{c.bankaKalan.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'bankaOdendi', 'bankaOdenenTutar', c.bankaKalan)} className={`p-0.5 shrink-0 rounded transition ${row.bankaOdendi ? 'text-green-700' : 'text-yellow-600/50 hover:text-yellow-800'}`} title={row.bankaOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className={`p-1 align-middle ${row.nakitOdendi ? 'bg-green-300' : 'bg-orange-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${row.nakitOdendi ? 'text-green-900 line-through opacity-70' : 'text-orange-900'}`}>{c.kalanNakit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handlePaymentToggle(person.id, 'nakitOdendi', 'nakitOdenenTutar', c.kalanNakit)} className={`p-0.5 shrink-0 rounded transition ${row.nakitOdendi ? 'text-green-800' : 'text-orange-600/50 hover:text-orange-800'}`} title={row.nakitOdendi ? 'Ödendi (Gidere işlendi)' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {targetPersonnelList.length === 0 && (
                <tr>
                  <td colSpan="21" className="p-8 text-center text-neutral-500 font-medium">
                    Sistemde {collarType.toLowerCase()} personel kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
            {targetPersonnelList.length > 0 && (
              <tfoot className="sticky bottom-0 z-40 shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.1)]">
                <tr className="bg-black text-white font-black text-xs md:text-sm">
                  <td colSpan="15" className="p-2 md:p-3 text-right border-r border-neutral-600">GENEL TOPLAMLAR :</td>
                  <td className="p-2 md:p-3 text-center border-r border-neutral-600 text-white">₺{totalYemek.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 md:p-3 text-center border-r border-neutral-600 text-white">₺{totalYol.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 md:p-3 text-center border-r border-neutral-600"></td>
                  <td className="p-2 md:p-3 text-center border-r border-neutral-600"></td>
                  <td className="p-2 md:p-3 text-center border-r border-neutral-600 text-yellow-400">₺{totalKalanBanka.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 md:p-3 text-center text-orange-400">₺{totalKalanNakit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
      return collarType === 'Mavi Yaka' 
        ? (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
        : (p.collarType === 'Beyaz Yaka' || (!p.collarType && !['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
    });

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
      
      const mesaiGunSayisi = Math.max(0, 30 - rapor - devamsizlikSayisi - ucretsizIzinSayisi);
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

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedPersonnel(targetPersonnelList.map(p => p.id));
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

    const handleDownloadCSV = () => {
        if (selectedPersonnel.length === 0) {
            alert("Lütfen en az bir personel seçin.");
            return;
        }

        let toplamAdet = selectedPersonnel.length;
        let toplamTutar = 0;
        const rowsData = [];

        selectedPersonnel.forEach(id => {
            const person = targetPersonnelList.find(p => p.id === id);
            if (person) {
                const amount = getAmountForTab(id);
                toplamTutar += amount;
                
                // Tutar formatı: Noktasız, küsurat için virgül (Örn: 15000,50 veya 15000)
                let amountStr = amount.toFixed(2).replace('.', ',');
                if (amountStr.endsWith(',00')) {
                    amountStr = amount.toString();
                }

                // IBAN formatı: Boşluksuz (Örn: TR123456789012345678901234)
                const iban = person.iban ? person.iban.replace(/\s+/g, '') : '';
                
                // TC Kimlik formatı (Varsa)
                const tckn = person.tcNo ? person.tcNo.replace(/\s+/g, '') : '';
                
                // Banka Kodu ve Şube Kodu IBAN'dan veya sistemden (Şimdilik boş bırakılıyor, IBAN yeterli genelde)
                const bankaKodu = ''; 
                const subeKodu = '';
                const hesapNo = '';

                // Satır Formatı: İsim,TCKN (Opsiyonel),Banka Kodu,Şube Kodu,Hesap,IBAN (Boşluksuz 26 Karakter),Tutar,Borç İzahat,Alacak izahat,,,
                rowsData.push(`${person.fullName},${tckn},${bankaKodu},${subeKodu},${hesapNo},${iban},${amountStr},${bankInfo.borcIzahat},,,,,`);
            }
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

        let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
        
        // --- BAŞLIK VE BİLGİLENDİRME ALANLARI ---
        csvContent += `Kurum Kodu,${bankInfo.kurumKodu},Garanti Bankası tarafından verilen kurum kodunuz.,,,,,,Ödeme Tipleri,,,\n`;
        csvContent += `Şube Kodu,${bankInfo.subeKodu},Şubenizden öğreniniz,,,,,,O,SOSYAL YARDIM,G,PROMOSYON\n`;
        csvContent += `Hesap,${bankInfo.hesapNo},Maaş ödemesinde kullanacağınız hesap. 1299998-2 şeklinde kontrol digiti girmeyiniz.,,,,,,D,DÖNER SERMAYE    ,R,PRİM ÖDEMESİ     \n`;
        csvContent += `Toplam Adet,${toplamAdet},Toplam maaş adedi. (Giriş yapıldıkça otomatik olarak hesaplanır.),,,,,,C,KOMİSYON,S,EK DERS ÜCRETİ\n`;
        csvContent += `Toplam Tutar,${toplamTutarStr},Toplam ödeme tutarı. (Giriş yapıldıkça otomatik olarak hesaplanır.),,,,,,F,FAZLA MESAİ      ,H,HUZUR HAKKI\n`;
        csvContent += `Döviz Kodu,TL,Döviz kodunu listeden seçiniz.,,,,,,I,İKRAMİYE         ,V,ASGARİ GEÇİM İNDİRİMİ\n`;
        csvContent += `Ödeme Tarihi,${odemeTarihiFormatted},GGAAYYYY formatında. (Örnek: 04032001 giriniz.),,,,,,K,KIDEM TAZMİNATI  ,Y,YOLLUK           \n`;
        csvContent += `Ödeme Tipi,${odemeTipiFormatted},Ödeme tiplerini yandaki tabloda görebilirsiniz.,,,,,,M,MAAŞ             ,Z,DİĞER            \n`;
        csvContent += `Borç İzahat,${bankInfo.borcIzahat},,,,,,,N,AVANS            ,X,KESİNTİ\n`;
        csvContent += `"BİLGİLENDİRME : Dosyanızdaki bilgiler banka sistemine otomatik olarak yüklenecektir. Banka kodu boş veya  62 ise havale, 62'den farklı ise EFT'dir. Kayıtlar içinde EFT varsa ödeme tarihi işgünü olmalıdır. Başka bir excel dosyasından kopyalama yapmak istiyorsanız Edit/Paste Spacial seçeneğini Values seçerek kullanınız.",,,,,,,,,,,\n`;
        csvContent += `"Herhangi bir hataya yol açmamak için dosyanın formatını değiştirmeyiniz, açıklamalara uyunuz. ",,,,,,,,,,,\n`;
        
        // --- SÜTUN BAŞLIKLARI ---
        csvContent += `İsim,TCKN (Opsiyonel),Banka Kodu,Şube Kodu,Hesap,IBAN (Boşluksuz 26 Karakter),Tutar,Borç İzahat,Alacak izahat,,,\n`;

        // --- VERİ SATIRLARI ---
        rowsData.forEach(row => {
            csvContent += row + "\n";
        });

        // CSV Dosyasını Oluştur ve İndir
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Banka_Talimati_${collarType.replace(' ', '_')}_${activeTab.replace(/ /g, '_')}_${currentYear}_${currentMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addSystemLog('Banka CSV İndirildi', `${collarType} ${activeTab} için toplu ödeme dosyası oluşturuldu. (${selectedPersonnel.length} Kişi)`);
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
            <p>Bu alandan personellerin maaş, yol veya avans ödemelerini toplu bir şekilde gerçekleştirmek için banka sistemlerine uyumlu CSV indirebilirsiniz. <b>Burada girilen tutarlar, doğrudan seçili dönemin "{collarType}" Maaş Tablosuna işlenir.</b> İstediğiniz personeli listeden seçip/çıkarabilirsiniz.</p>
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
                    <Download className="w-5 h-5" /> Banka CSV Formatında İndir
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

            <div className="overflow-x-auto bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                        <tr>
                            <th className="p-4 w-12 text-center">
                                <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-green-600 focus:ring-green-600 cursor-pointer" onChange={handleSelectAll} checked={selectedPersonnel.length === targetPersonnelList.length && targetPersonnelList.length > 0} />
                            </th>
                            <th className="p-4 font-black">Personel Adı</th>
                            <th className="p-4 font-black">IBAN</th>
                            <th className="p-4 font-black text-center">Tutar / {activeTab} (TL)</th>
                            <th className="p-4 font-black">Alacak İzahat (Dekont Açıklaması)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {targetPersonnelList.map(p => {
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
                        {targetPersonnelList.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-neutral-500 font-medium">Bu listeye uygun personel bulunamadı.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    );
  };

