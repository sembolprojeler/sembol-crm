import React, { useState, useEffect, useMemo, useRef } from 'react'; // DÜZELTME: QR Takip için useRef eklendi
import { Calculator, CalendarClock, CalendarPlus, QrCode, Download, Copy, Check, ChevronUp, Sparkles, ExternalLink, Filter, Truck, MapPin, Phone, FileText, PlusCircle, ClipboardList, ClipboardCheck, Shield, Eye, Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, Briefcase, Wallet, ArrowUpRight, ArrowUpDown, UserPlus, Edit, User, MessageCircle, Package, Database, History, Save, Search, FolderOpen, Ban, CheckCircle, Camera, Mail, Clock, XCircle, RefreshCw, Loader2, Send, StickyNote, ChevronDown, HelpCircle, Settings, Trash2, Zap, Handshake, Building2, Home, HardHat, ShieldCheck, TrendingUp, ChevronRight, Globe, CreditCard, PhoneCall } from 'lucide-react';
import { collection, addDoc, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs, getDoc, increment, orderBy, limit } from 'firebase/firestore';
import { db, appId, PROVINCES, FLOORS, TURKEY_LOCATIONS, DEPO_LOCATIONS, normalizeCariPhone, generateContractPDF, SayfalamaBar, isVideoUrl, MediaCaptureMenu, HasarCozumBelgeleri, odemeIcinDefterBul,
  // YENİ: Müşteri Havuzu'nda "Atanan Satışçı" listesini yalnızca Satış Personeli
  // ile sınırlamak için — eski/hatalı pozisyon adlarını da doğru eşler.
  normalizePozisyon,
  // YENİ: Çok günlü iş (1. gün / 2. gün) — profilde tek iş gösterimi ve kapora koruması
  anaIsleriFiltrele, isToplamGun, isToplamArac } from './shared.jsx';
// YENİ: QR Site Takip bölümü dahili QR üretecini OperasyonPersonel.jsx'ten alır (CDN gerektirmez)
import { QrGorsel, qrSvgUret } from './OperasyonPersonel.jsx';
// YENİ (kullanıcı talebi): depolama tekliflerinin Teklif Detayı satırları (siteden gelen ham alanlardan)
import { teklifDetayiAlanlardan, eskiTeklifMetni } from './teklifDetay.js';
// YENİ: Yapay zeka kaynak şeması — /api/submit-lead ve /api/yeni-musteri ile ortak (etiketler, kutular)
import { AI_KAYNAK_ETIKETLERI, AI_ISTATISTIK_KUTULARI, aiKaynakMi } from './aiKaynakSema.js';
// YENİ: QR Site Takip şeması — /api/qr-site ile ortak (sabitler, telefon kuralı, WordPress sayfa adresi)
import { QR_SITE_LANDING_URL, QR_SIRKET_TELEFONU, QR_HIZMETLER, QR_RANDEVU_SAATLERI, qrTelefonNormalize, qrTelefonGecerliMi } from './qrSiteSema.js';
// YENİ (kullanıcı talebi): Fiyat Tablosu şeması — /api/fiyatlar ile ortak (etiketler, anahtarlar, doğrulama)
import { DEPO_BOYUTLARI, DEPO_KIRALAMA, SEHIR_ICI_GRUPLARI, SEHIRLER_ARASI_EK_GRUPLARI, IL_TABLOSU_ETIKET, IL_TABLOSU_NOTU, FIYAT_VERI_ANAHTARLARI, fiyatDogrula, fiyatFarklari, fiyatTemizle, fiyatYolAnahtari,
  MESAFE_VARSAYILAN, MESAFE_GECISLERI, mesafeModuAcik, mesafeEsikAsildi, mesafeKalemleri, mesafeIscilikKalemi, ilceMerkezAdresi, fiyatEksikleriDoldur,
  mesafeKademeListesi, mesafeAktifKademe, mesafeOdaFarkiKalemi, FIYAT_ODALAR, mesafeOdaKademeListesi } from './fiyatSema.js'; // YENİ: uzun yol kademeleri + ev tipi farkı // YENİ: km bazlı fiyat

// ============================================================================
// YENİ (kullanıcı talebi): ESNEK MÜŞTERİ — alternatif taşınma günleri
// ----------------------------------------------------------------------------
// Kayıt ekranında (AddJobView) "Esnek Müşteri" butonu ile müşterinin randevu
// tarihi dışında da taşınabileceği günler seçilir. Hiç gün seçmeden yalnızca
// "esnek" olarak işaretlemek de mümkündür.
//
// İşe yazılan alanlar (App.jsx > handleAddJob formData'yı olduğu gibi kaydeder):
//   esnekMusteri : boolean            → müşteri esnek mi
//   esnekTarihler: ['YYYY-MM-DD', …]  → alternatif günler (sıralı, tekrarsız; boş olabilir)
//
// Bu alanlar olmayan eski kayıtlar "esnek değil" sayılır — hiçbir veri bozulmaz.
// OperasyonIsler.jsx takvimdeki kare nokta ve iş kartı rozeti için
// esnekMi / esnekAciklama / EsnekTarihRozeti'yi BURADAN import eder.
// ============================================================================

// ------------------------------------------------------------ YARDIMCILAR ---

// 'YYYY-MM-DD' metnini YEREL saatle Date'e çevirir.
// (new Date('2026-10-03') UTC kabul eder ve Türkiye saatinde güne kayma yaratabilir.)
const esnekYerelTarih = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

// Bugünün tarihi 'YYYY-MM-DD' (yerel saat) — geçmiş günlerin seçilmesini engellemek için
const esnekBugunMetni = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// Uzun gün adı: "3 Ekim 2026 Cumartesi"
export const esnekGunUzun = (s) => {
  const t = esnekYerelTarih(s);
  return t ? t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) : String(s || '');
};

// Kısa gün adı (kart rozetinde yer kaplamasın diye): "3 Eki Cmt"
export const esnekGunKisa = (s) => {
  const t = esnekYerelTarih(s);
  return t ? t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' }) : String(s || '');
};

// Geçerli, tekrarsız ve sıralı tarih listesi
const esnekTarihTemizle = (liste) =>
  [...new Set((Array.isArray(liste) ? liste : []).filter(s => esnekYerelTarih(s)))].sort();

// Kayıt esnek mi? (eski kayıtlarda alan yok → false)
export const esnekMi = (job) => job?.esnekMusteri === true;

// İş için esnek tarih listesi (her zaman dizi döner)
export const esnekTarihleri = (job) => esnekTarihTemizle(job?.esnekTarihler);

// Okunabilir açıklama:
//   "3 Ekim 2026 Cumartesi, 4 Ekim 2026 Pazar günlerinde de taşınabilir"
//   Gün seçilmemişse: "Esnek müşteri — taşınma günü değişebilir"
export const esnekAciklama = (job) => {
  if (!esnekMi(job)) return '';
  const gunler = esnekTarihleri(job);
  if (!gunler.length) return 'Esnek müşteri — taşınma günü değişebilir';
  return `${gunler.map(esnekGunUzun).join(', ')} ${gunler.length > 1 ? 'günlerinde' : 'gününde'} de taşınabilir`;
};

// ------------------------------------------------------ KAYIT EKRANI BUTONU ---
// Bireysel / Kurumsal seçicisinin SAĞINA yerleşir. Tıklayınca gün seçme penceresi açılır.
// formData / setFormData doğrudan AddJobView'den gelir (App.jsx'teki form durumu).
export const EsnekMusteriButonu = ({ formData, setFormData }) => {
  const [acik, setAcik] = useState(false);
  // Pencere içindeki taslak liste — "Kaydet"e basılana kadar forma yazılmaz
  const [taslak, setTaslak] = useState([]);
  const [secilenGun, setSecilenGun] = useState('');
  const [uyari, setUyari] = useState('');

  const aktif = esnekMi(formData);
  const gunSayisi = esnekTarihleri(formData).length;
  const anaTarih = formData?.date || ''; // Randevu tarihi (alternatif olarak eklenemez)

  // Pencereyi mevcut değerlerle aç
  const pencereAc = () => {
    setTaslak(esnekTarihleri(formData));
    setSecilenGun('');
    setUyari('');
    setAcik(true);
  };

  // Seçilen günü taslak listeye ekle (geçmiş gün, randevu günü ve tekrar engellenir)
  const gunEkle = () => {
    if (!secilenGun) return setUyari('Önce bir gün seçin.');
    if (secilenGun < esnekBugunMetni()) return setUyari('Geçmiş bir gün eklenemez.');
    if (secilenGun === anaTarih) return setUyari('Bu gün zaten randevu tarihi — alternatif olarak eklenemez.');
    if (taslak.includes(secilenGun)) return setUyari('Bu gün zaten listede.');
    setTaslak(esnekTarihTemizle([...taslak, secilenGun]));
    setSecilenGun('');
    setUyari('');
  };

  // Esnek olarak kaydet (gün listesi boş olabilir: "sadece belirtmek")
  const kaydet = () => {
    setFormData({ ...formData, esnekMusteri: true, esnekTarihler: esnekTarihTemizle(taslak) });
    setAcik(false);
  };

  // Esnekliği tamamen kaldır
  const kaldir = () => {
    setFormData({ ...formData, esnekMusteri: false, esnekTarihler: [] });
    setAcik(false);
  };

  return (
    <>
      {/* type="button": form içinde olduğu için tıklayınca kaydı GÖNDERMEMELİ */}
      <button
        type="button"
        onClick={pencereAc}
        title={aktif ? esnekAciklama(formData) : 'Müşteri başka günlerde de taşınabiliyorsa işaretleyin'}
        className={`w-full md:w-auto px-4 md:px-5 py-2.5 text-xs md:text-sm font-bold rounded-xl border transition flex items-center justify-center gap-2 ${
          aktif
            ? 'bg-amber-400 border-amber-500 text-black shadow-sm hover:bg-amber-300'
            : 'bg-white border-neutral-300 text-neutral-600 hover:border-amber-400 hover:text-amber-700'
        }`}
      >
        <CalendarClock className="w-4 h-4" />
        Esnek Müşteri
        {/* Aktifse seçilen gün sayısı rozeti */}
        {aktif && (
          <span className="text-[10px] font-black bg-black text-amber-300 px-1.5 py-0.5 rounded-md">
            {gunSayisi ? `${gunSayisi} gün` : 'Tarihsiz'}
          </span>
        )}
      </button>

      {/* ----------------------------------------------- GÜN SEÇME PENCERESİ --- */}
      {acik && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setAcik(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Başlık */}
            <div className="bg-black text-white px-5 py-3.5 flex items-center justify-between">
              <span className="font-black flex items-center gap-2"><CalendarClock className="w-5 h-5 text-amber-400" /> Esnek Müşteri</span>
              <button type="button" onClick={() => setAcik(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs font-bold text-neutral-500">
                Müşterinin randevu günü dışında taşınabileceği günleri ekleyin. Gün eklemeden de kaydedebilirsiniz; kayıt yalnızca "esnek" olarak işaretlenir.
              </p>

              {/* Gün seçimi + Ekle */}
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500">Alternatif Gün</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="date"
                    value={secilenGun}
                    min={esnekBugunMetni()}
                    onChange={e => { setSecilenGun(e.target.value); setUyari(''); }}
                    // Enter tuşu dış formu (kaydı) göndermesin; günü listeye eklesin
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); gunEkle(); } }}
                    className="flex-1 p-2.5 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:border-amber-500"
                  />
                  <button type="button" onClick={gunEkle} className="px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm flex items-center gap-1.5">
                    <CalendarPlus className="w-4 h-4" /> Ekle
                  </button>
                </div>
                {uyari && <p className="text-[11px] font-bold text-red-600 mt-1.5">{uyari}</p>}
              </div>

              {/* Eklenen günler */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {taslak.length === 0 ? (
                  <div className="text-center text-xs font-bold text-neutral-400 py-4 border border-dashed border-neutral-300 rounded-xl">
                    Gün eklenmedi — "esnek" olarak kaydedilecek
                  </div>
                ) : taslak.map(g => (
                  <div key={g} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-sm font-bold text-neutral-800">{esnekGunUzun(g)}</span>
                    <button type="button" onClick={() => setTaslak(taslak.filter(x => x !== g))} title="Günü çıkar" className="p-1 text-neutral-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Önizleme: kayıtta görünecek metin */}
              {taslak.length > 0 && (
                <p className="text-xs font-bold text-amber-800 bg-amber-100/60 rounded-lg px-3 py-2">
                  {esnekAciklama({ esnekMusteri: true, esnekTarihler: taslak })}
                </p>
              )}
            </div>

            {/* Alt butonlar */}
            <div className="border-t border-neutral-200 px-5 py-3.5 flex items-center justify-between gap-2">
              {/* Yalnızca kayıt zaten esnekse "kaldır" gösterilir */}
              {aktif ? (
                <button type="button" onClick={kaldir} className="text-xs font-black text-red-600 hover:underline">Esnekliği Kaldır</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setAcik(false)} className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 font-bold text-sm">Vazgeç</button>
                <button type="button" onClick={kaydet} className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-black text-sm flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Formda butonun altında gösterilen özet satırı (esnek değilse hiçbir şey çizmez)
export const EsnekOzetSatiri = ({ formData }) => {
  if (!esnekMi(formData)) return null;
  return (
    <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 flex items-start gap-2">
      <CalendarClock className="w-4 h-4 shrink-0 mt-px" /> {esnekAciklama(formData)}
    </p>
  );
};

// ------------------------------------------------------- İŞ KARTI ROZETİ ---
// Takvimin altındaki iş listesinde müşteri adının yanında görünür.
// En fazla 2 gün kısa adla yazılır, fazlası "+N"; tam liste üzerine gelince görünür.
export const EsnekTarihRozeti = ({ job }) => {
  if (!esnekMi(job)) return null;
  const gunler = esnekTarihleri(job);
  const gorunen = gunler.slice(0, 2).map(esnekGunKisa).join(' · ');
  return (
    <span
      title={esnekAciklama(job)}
      className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-amber-400 text-black shadow-sm flex items-center gap-1"
    >
      <CalendarClock className="w-3 h-3" />
      Esnek{gorunen ? `: ${gorunen}` : ''}{gunler.length > 2 ? ` +${gunler.length - 2}` : ''}
    </span>
  );
};

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
  // YENİ (kullanıcı talebi): KAPORA — HANGİ İŞE GİRİLECEĞİ SORULUR
  // ============================================================================
  // SORUN: "Kapora Ekle" butonu, müşterinin bekleyen işleri arasından TARİHİ EN
  // YENİ olanı sessizce seçiyordu (bekleyenler[0]). Bir müşterinin açıkta iki
  // işi varsa kapora yanlış işe yazılabiliyordu. Ekran görüntüsündeki durum
  // tam olarak buydu: 04.09 tarihli ₺0 tutarlı iş seçilmiş, oysa kapora
  // 03.09 tarihli ₺64.000'lik işe ait.
  //
  // ÇÖZÜM: Bekleyen iş SAYISI 1'den fazlaysa pencerede iş seçimi sorulur;
  // seçim yapılmadan kaydetmeye izin verilmez. Seçilen işin fiyatı, mevcut
  // kaporası ve KALAN BAKİYESİ ekranda gösterilir; %20 önerisi de seçilen işe
  // göre yeniden hesaplanır. Tek bekleyen iş varsa eski davranış korunur
  // (otomatik seçilir, kullanıcıya fazladan soru sorulmaz).
  // ============================================================================
  // Bir işin kalan bakiyesi = fiyat - mevcut kapora (sistemin diğer yerleriyle aynı)
  const kaporaIsKalanBakiye = (is) =>
    Math.max(0, (parseFloat(is?.price) || 0) - (parseFloat(is?.deposit) || 0));

  // Seçim listesinde görünecek okunur etiket: tarih • tür • tutar • kalan
  const kaporaIsEtiketi = (is) => {
    const tarih = (is?.date || '').split('-').reverse().join('.');
    const fiyat = (parseFloat(is?.price) || 0).toLocaleString('tr-TR');
    const kalan = kaporaIsKalanBakiye(is).toLocaleString('tr-TR');
    const kapora = parseFloat(is?.deposit) || 0;
    return `${tarih} • ${is?.type || 'Nakliye'} • İş: ₺${fiyat}${kapora > 0 ? ` • Kapora: ₺${kapora.toLocaleString('tr-TR')}` : ''} • Kalan: ₺${kalan}`;
  };

  // Bekleyen işler arasından seçim yaptıran açılır liste (ayrı bileşen)
  const KaporaIsSecici = ({ isler, seciliId, onSec }) => (
    <div>
      <label className="text-xs font-bold text-neutral-600 block mb-1">
        Kapora hangi işe girilsin? * <span className="text-amber-700">({isler.length} açık iş)</span>
      </label>
      <select value={seciliId} onChange={e => onSec(e.target.value)}
        className="w-full p-3 border-2 border-amber-400 rounded-xl bg-white outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold">
        {/* Seçim yapılmadan kaydedilmesin diye boş seçenek başta durur */}
        <option value="">— İş seçin —</option>
        {isler.map(j => <option key={j.id} value={j.id}>{kaporaIsEtiketi(j)}</option>)}
      </select>
      <p className="text-[10px] font-bold text-amber-700 mt-1">
        Bu müşterinin açıkta birden fazla işi var; kapora yalnızca seçtiğiniz işin bakiyesinden düşer.
      </p>
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

  // ==========================================================================
  // YENİ (kullanıcı talebi): YÜKLEME / BOŞALTMA MESAFESİ — sayı kutusu yerine SEÇİM
  // Araç yanaşıyor · 50 m · 100 m · 150 m · 200 m (Telefon Görüşmesi ile aynı değerler;
  // kayıtta yine sayı olarak saklanır: 0 / 50 / 100 / 150 / 200, birim "Metre").
  // Listede olmayan eski bir değer (ör. 20 m) kaybolmasın diye ayrıca gösterilir.
  // ==========================================================================
  const KAYIT_MESAFE_SECENEKLERI = [
    { v: '0', ad: 'Araç yanaşıyor' }, { v: '50', ad: '50 m' }, { v: '100', ad: '100 m' }, { v: '150', ad: '150 m' }, { v: '200', ad: '200 m' },
  ];
  const KayitMesafeSecimi = ({ deger, birim, onSec, className }) => {
    const d = deger === null || deger === undefined ? '' : String(deger);
    const listede = d === '' || KAYIT_MESAFE_SECENEKLERI.some(o => o.v === d);
    return (
      <select value={d} onChange={e => onSec(e.target.value)} className={className}>
        <option value="">Seçin…</option>
        {KAYIT_MESAFE_SECENEKLERI.map(o => <option key={o.v} value={o.v}>{o.ad}</option>)}
        {!listede && <option value={d}>{d} {birim === 'Adım' ? 'adım' : 'm'} (eski kayıt)</option>}
      </select>
    );
  };
  const KAYIT_MESAFE_CLS = 'w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white text-xs md:text-sm font-bold';

  export const AddJobView = ({
    type, formData, setFormData, handleInputChange, handleProvinceChange,
    handleDepoChange, toggleDepoDirection, handleAddJob, editingJobId, handleSwapAddresses
  }) => {
    // YENİ (kullanıcı talebi): Kapora için seçilebilecek hesaplar (Kredi/Ödemeler/Borçlu
    // plan defterleri hariç). Form açılınca bir kez okunur; okuma maliyeti düşüktür.
    const [kaporaHesaplari, setKaporaHesaplari] = useState([]);
    useEffect(() => {
      let iptal = false;
      (async () => {
        try {
          const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'));
          if (iptal) return;
          setKaporaHesaplari(snap.docs.map(d => ({ ...d.data(), id: d.id }))
            .filter(d => ['Banka', 'Nakit', 'Kredi Kartı'].includes(d.tur))
            .sort((a, b) => (a.blok === 'Sembol Nakliyat' ? 0 : 1) - (b.blok === 'Sembol Nakliyat' ? 0 : 1) || (a.ad || '').localeCompare((b.ad || ''), 'tr-TR')));
        } catch (e) { console.error('Kapora hesapları okunamadı:', e); }
      })();
      return () => { iptal = true; };
    }, []);
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
      <div className={`max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 md:p-6 animate-in fade-in ${type === 'Depo' ? 'kayit-depo-mavi' : type === 'Asansör' ? 'kayit-asansor-yesil' : ''}`}>
        {/* ==================================================================
            YENİ (kullanıcı talebi): DEPO KAYDINDA FORMUN RENKLERİ MAVİ
            Formdaki kırmızı sınıflar (başlık şeritleri, ikon rozetleri, seçili
            buton yazıları, odak çerçeveleri, kaydet butonu) kodlarına dokunmadan
            YALNIZCA Depo kaydında mavi karşılıklarıyla gösterilir.
            Nakliye ve Asansör kayıtları kırmızı kalır.
            ================================================================== */}
        {type === 'Depo' && (
          <style>{`
            .kayit-depo-mavi .text-red-600 { color: #2563eb !important; }
            .kayit-depo-mavi .text-red-700 { color: #1d4ed8 !important; }
            .kayit-depo-mavi .bg-red-50 { background-color: #eff6ff !important; }
            .kayit-depo-mavi .bg-red-100, .kayit-depo-mavi .hover\:bg-red-100:hover { background-color: #dbeafe !important; }
            .kayit-depo-mavi .bg-red-600 { background-color: #2563eb !important; }
            .kayit-depo-mavi .hover\:bg-red-700:hover { background-color: #1d4ed8 !important; }
            .kayit-depo-mavi .border-red-100 { border-color: #dbeafe !important; }
            .kayit-depo-mavi .border-red-200 { border-color: #bfdbfe !important; }
            .kayit-depo-mavi .border-red-400 { border-color: #60a5fa !important; }
            .kayit-depo-mavi .border-red-600\/20 { border-color: rgb(37 99 235 / 0.2) !important; }
            .kayit-depo-mavi .ring-red-200 { --tw-ring-color: #bfdbfe !important; }
            .kayit-depo-mavi .focus\:ring-red-600:focus { --tw-ring-color: #2563eb !important; }
            .kayit-depo-mavi .shadow-red-600\/30 { --tw-shadow-color: rgb(37 99 235 / 0.3) !important; }
            .kayit-depo-mavi .from-red-600\/10 { --tw-gradient-from: rgb(37 99 235 / 0.1) !important; }
          `}</style>
        )}
        {/* YENİ (kullanıcı talebi): ASANSÖR KAYDINDA FORMUN RENKLERİ YEŞİL
            (Depo'daki mavi temayla aynı yöntem — kodlara dokunulmadan) */}
        {type === 'Asansör' && (
          <style>{`
            .kayit-asansor-yesil .text-red-600 { color: #16a34a !important; }
            .kayit-asansor-yesil .text-red-700 { color: #15803d !important; }
            .kayit-asansor-yesil .bg-red-50 { background-color: #f0fdf4 !important; }
            .kayit-asansor-yesil .bg-red-100, .kayit-asansor-yesil .hover\:bg-red-100:hover { background-color: #dcfce7 !important; }
            .kayit-asansor-yesil .bg-red-600 { background-color: #16a34a !important; }
            .kayit-asansor-yesil .hover\:bg-red-700:hover { background-color: #15803d !important; }
            .kayit-asansor-yesil .border-red-100 { border-color: #dcfce7 !important; }
            .kayit-asansor-yesil .border-red-200 { border-color: #bbf7d0 !important; }
            .kayit-asansor-yesil .border-red-400 { border-color: #4ade80 !important; }
            .kayit-asansor-yesil .border-red-600\/20 { border-color: rgb(22 163 74 / 0.2) !important; }
            .kayit-asansor-yesil .ring-red-200 { --tw-ring-color: #bbf7d0 !important; }
            .kayit-asansor-yesil .focus\:ring-red-600:focus { --tw-ring-color: #16a34a !important; }
            .kayit-asansor-yesil .shadow-red-600\/30 { --tw-shadow-color: rgb(22 163 74 / 0.3) !important; }
            .kayit-asansor-yesil .from-red-600\/10 { --tw-gradient-from: rgb(22 163 74 / 0.1) !important; }
          `}</style>
        )}
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
            
            {/* YENİ: Bireysel/Kurumsal seçici + sağında Esnek Müşteri butonu aynı satırda
                (mobilde alt alta). Alt boşluk (mb-5) seçiciden bu sarmalayıcıya taşındı. */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-5">
            <div className="flex bg-neutral-200/60 p-1 rounded-xl w-full md:w-fit border border-neutral-300">
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
              {/* YENİ: Esnek Müşteri — tıklayınca alternatif günler seçilir */}
              <EsnekMusteriButonu formData={formData} setFormData={setFormData} />
            </div>
            {/* YENİ: Esnekse "… günlerinde de taşınabilir" özeti */}
            <EsnekOzetSatiri formData={formData} />

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

              {/* SATIR 3: Tarih + Saat + İşlem Süresi + Araç Sayısı — 4 eşit sütun, hizalı, birbirine taşmaz */}
              {/* DEĞİŞTİ (kullanıcı talebi): 3 sütun -> 4 sütun; "Araç Sayısı" eklendi (1-7, varsayılan 1). */}
              {/* min-w-0 + w-full taşmayı engeller, ortak küçük punto (text-sm) ile hepsi aynı görünür */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                {/* ==============================================================
                    YENİ: ARAÇ SAYISI (kullanıcı talebi)
                    Aynı gün işe kaç kamyon gidiyor? 2 seçilirse iş aynı güne
                    "1. Araç" ve "2. Araç" olarak KOPYALANIR: bilgiler ve fiyat
                    ekranda aynı görünür, her araca ayrı ekip atanır ve mesai
                    ayrı kapatılır. Ciro, cari ve teslim kodu TEK'tir (kopyaların
                    fiyatı veritabanında ₺0'dır, bkz. shared.jsx isAracKopyasiMi).
                    ============================================================== */}
                <div className="min-w-0">
                  <label className={`${labelCls} text-center`}>Araç Sayısı *</label>
                  <select name="aracSayisi" value={formData.aracSayisi || '1'} onChange={handleInputChange}
                    title="Aynı gün işe giden kamyon sayısı. 2 ve üzeri seçilirse iş takvimde araç sayısı kadar görünür; ciro tek sayılır."
                    className="w-full min-w-0 h-11 box-border px-1 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-bold text-[11px] md:text-sm text-center [text-align-last:center]">
                    {[1, 2, 3, 4, 5, 6, 7].map(a => <option key={a} value={a}>{a} Araç</option>)}
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
              {/* ==============================================================
                  YENİ (kullanıcı talebi): KAPORA HANGİ HESABA YAZILSIN?
                  Kapora girildiyse hesap seçilir; kayıt o deftere gelir olarak
                  düşer (shared.defterKaporaKaydet bu alanı okur). Seçilmezse
                  eski kural: Sembol Nakliyat bloğundaki Banka defteri.
                  ============================================================== */}
              {parseFloat(formData.deposit) > 0 && (
                <div>
                  <label className={labelCls}>Kapora Hangi Hesaba Yazılsın? *</label>
                  <select name="depositDefterId" value={formData.depositDefterId || ''} onChange={handleInputChange} className={`${inputCls} bg-white`}>
                    <option value="">Varsayılan — Sembol Nakliyat banka hesabı</option>
                    {kaporaHesaplari.map(d => <option key={d.id} value={d.id}>{d.ad} — {d.tur}</option>)}
                  </select>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">Nakit alındıysa KASA, POS ile alındıysa POS defterini seçin; kapora seçtiğiniz hesapta gelir olarak görünür.</p>
                </div>
              )}
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
                    {/* DEĞİŞTİ: Depolar artık tek tek yazılmıyor; shared.jsx'teki
                        DEPO_LOCATIONS listesinden üretiliyor. Yeni bir tesis
                        açıldığında yalnızca o listeye eklemek yeterli — bu ekranı
                        ve boşaltma tarafındaki ikizini elle güncellemek gerekmiyor. */}
                    {DEPO_LOCATIONS.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
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
                    {type !== 'Asansör' ? (
                      <KayitMesafeSecimi deger={formData.fromDistance} birim={formData.fromDistanceUnit} className={KAYIT_MESAFE_CLS}
                        onSec={v => setFormData(prev => ({ ...prev, fromDistance: v, fromDistanceUnit: 'Metre' }))} />
                    ) : (
                    <div className="flex gap-1">
                      {/* Sayı kutusu: 3 hane tam gözükecek genişlikte (min-w) */}
                      <input type="number" name="fromDistance" value={formData.fromDistance} onChange={handleInputChange} placeholder="20" className="w-full min-w-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-xs md:text-sm" />
                      {/* Birim kutusu: kapalıyken kısa (M / A), listede tam açıklama görünür */}
                      <select name="fromDistanceUnit" value={formData.fromDistanceUnit} onChange={handleInputChange} className="w-11 shrink-0 p-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-xs md:text-sm text-center">
                        <option value="Metre">M</option>
                        <option value="Adım">A</option>
                      </select>
                    </div>
                    )}
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
                      {type !== 'Asansör' ? (
                        <KayitMesafeSecimi deger={addr.distance} birim={addr.distanceUnit} className={KAYIT_MESAFE_CLS}
                          onSec={v => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, distance: v, distanceUnit: 'Metre' } : a) }))} />
                      ) : (
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
                      )}
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
                        {/* Aynı liste — DEPO_LOCATIONS tek kaynaktır */}
                        {DEPO_LOCATIONS.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
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
                    {/* DEĞİŞTİ (kullanıcı talebi): seçim listesi */}
                    <KayitMesafeSecimi deger={formData.toDistance} birim={formData.toDistanceUnit} className={KAYIT_MESAFE_CLS}
                      onSec={v => setFormData(prev => ({ ...prev, toDistance: v, toDistanceUnit: 'Metre' }))} />
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
                      {/* DEĞİŞTİ (kullanıcı talebi): seçim listesi */}
                      <KayitMesafeSecimi deger={addr.distance} birim={addr.distanceUnit} className={KAYIT_MESAFE_CLS}
                        onSec={v => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, distance: v, distanceUnit: 'Metre' } : a) }))} />
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


  // Bir işin GERÇEK kayıt (oluşturulma) zamanı. Eski aktarımlarda taşıma tarihi
  // 2029/2030/2032 gibi ileri tarihler olabildiği için sıralamada taşıma tarihi
  // yerine bu değer kullanılır. Gelecek tarihli/eksik değerler güvenilmez sayılır.
  const musteriKayitZamani = (job) => {
    const ham = job?.createdAt || job?.createdDate || job?.kayitTarihi || job?.timestamp;
    if (!ham) return null;
    const t = (typeof ham === 'object' && ham.seconds) ? new Date(ham.seconds * 1000) : new Date(ham);
    if (isNaN(t.getTime())) return null;
    const ustSinir = new Date(); ustSinir.setDate(ustSinir.getDate() + 1);
    if (t > ustSinir) return null;
    return t.getTime();
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
            latestJob: job,
            // YENİ: sıralama için müşterinin EN SON KAYDEDİLEN işinin kayıt zamanı
            sonKayitZamani: musteriKayitZamani(job)
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
        // Sıralama ölçütü ayrı tutulur: en YENİ KAYIT zamanı
        const kz = musteriKayitZamani(job);
        if (kz !== null && (c.sonKayitZamani === null || kz > c.sonKayitZamani)) {
            c.sonKayitZamani = kz;
        }
        if (job.isSpecial) c.isSpecial = true;
      }
    });

    const customers = Array.from(customersMap.values())
      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery))
      // SIRALAMA: en yeni KAYITTAN en eskiye. Kayıt zamanı bilinmeyenler en sonda.
      .sort((a, b) => {
        const ka = a.sonKayitZamani, kb = b.sonKayitZamani;
        if (ka === null && kb === null) return new Date(b.lastJobDate) - new Date(a.lastJobDate);
        if (ka === null) return 1;
        if (kb === null) return -1;
        return kb - ka;
      });

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
  export const CustomerProfileView = ({ jobs, cariKey, onBack, handleEditJob, db, appId, addSystemLog, personnelList = [], vehicles = [], currentUser, setViewingImage, setMarkDamageJobId }) => {
    const customerJobs = jobs
      .filter(j => normalizeCariPhone(j.customerPhone) === cariKey)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // ======================================================================
    // YENİ (kullanıcı talebi): ÇOK GÜNLÜ İŞ PROFİLDE TEK KAYIT
    // ----------------------------------------------------------------------
    // 2 günlük bir nakliye takvimde 2 kart (1. Gün / 2. Gün) olarak durur ama
    // müşteri açısından TEK iştir. Bu yüzden profildeki "Yaptığı İşler" ve
    // kapora penceresi devam günlerini (2. gün, 3. gün ...) listelemez; ana
    // işi "2 günlük" rozetiyle gösterir. Cari/ekstre hesapları zaten price
    // alanından beslendiği ve devam gününde price ₺0 olduğu için değişmez.
    // ======================================================================
    const customerAnaIsler = anaIsleriFiltrele(customerJobs);

    // ======================================================================
    // YENİ: SAHA DENETİMLERİ — Bu müşterinin işlerine şeflerin yaptığı denetimler.
    // İş kartında "Saha Denetim Raporunu Gör" butonuyla tüm detay (fotoğraf/video,
    // personel puanları, şef notları, kayıt doğruluğu) pencerede açılır.
    // ======================================================================
    const [sahaDenetimleri, setSahaDenetimleri] = useState([]);
    const [acikDenetim, setAcikDenetim] = useState(null); // Rapor penceresi
    useEffect(() => {
      if (!db) return;
      const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sahaDenetimleri'), snap => {
        setSahaDenetimleri(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, console.error);
      return () => unsub();
    }, [db, appId]);
    // Bir işin denetim kaydını döndürür (yoksa null)
    const jobSahaDenetimi = (jobId) => sahaDenetimleri.find(d => String(d.jobId) === String(jobId)) || null;
    const denetimPuanRenk = (p) => p >= 4.5 ? 'text-green-600' : p >= 3.5 ? 'text-lime-600' : p >= 2.5 ? 'text-orange-500' : 'text-red-600';

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
    // ========================================================================
    // YENİ: KAPORA EKLE
    // ========================================================================
    // Müşterinin SON BEKLEYEN (sonlandırılmamış) işine profilden kapora girme.
    // form: { tutar, defterId, jobId } — defterler modal açılınca okunur.
    const [showKaporaModal, setShowKaporaModal] = useState(false);
    const [kaporaForm, setKaporaForm] = useState({ tutar: '', defterId: '', jobId: '' });
    const [kaporaDefterler, setKaporaDefterler] = useState([]);
    // YENİ: Kapora penceresinde seçilebilecek bekleyen işler (birden fazlaysa sorulur)
    const [kaporaIsler, setKaporaIsler] = useState([]);
    const [kaporaKaydediliyor, setKaporaKaydediliyor] = useState(false);
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
            {/* YENİ: SAĞ ÜST BUTON GRUBU — Profili Düzenle + Kara Liste butonları yan yana */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* YENİ: Belirgin, yazılı "Profili Düzenle" butonu (eskiden isim yanındaki küçük kalem ikonuydu) */}
              <button
                type="button"
                onClick={() => { setEditProfileForm({ name: customerName, phone: customerPhone, altPhone: altPhone, customerType: customerType, idNo: idNo }); setShowEditProfileModal(true); }}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black rounded-xl transition flex items-center gap-2 border border-blue-200 shadow-sm"
                title="Cari Profilini Düzenle"
              >
                <Edit className="w-4 h-4" /> Profili Düzenle
              </button>
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
              {/* ==========================================================
                  KAPORA EKLE (kullanıcı talebi)
                  DEĞİŞTİ: Eskiden müşterinin SON bekleyen işi sessizce
                  seçiliyordu; açıkta iki iş varsa kapora yanlış işe
                  yazılabiliyordu. Artık bekleyen işlerin TAMAMI pencereye
                  taşınır: tek iş varsa otomatik seçilir (eski davranış),
                  birden fazlaysa kullanıcıya hangi işe girileceği sorulur.
                  ========================================================== */}
              <button type="button" onClick={async () => {
                // Bekleyen işler: sonlandırılmamış + iptal edilmemiş, tarihi en yeni önce
                // YENİ: Çok günlü işin DEVAM günleri (₺0 tutarlı 2. gün vb.) listelenmez;
                // kapora her zaman ANA işe (1. gün) yazılır ve onun bakiyesinden düşer.
                const bekleyenler = anaIsleriFiltrele(customerJobs)
                  .filter(j => j.status !== 'completed' && j.status !== 'cancelled' && !j.endJobDetails)
                  .sort((a, b) => new Date(b.date) - new Date(a.date));
                if (bekleyenler.length === 0) { alert('Bu müşterinin bekleyen (sonlandırılmamış) işi yok. Kapora, bekleyen bir işe bağlanır.'); return; }
                // Defterleri oku ve Banka hesabını önseç (NAKLİYE öncelikli)
                let defterListesi = [];
                try {
                  const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'));
                  defterListesi = snap.docs.map(d => ({ ...d.data(), id: d.id }))
                    .filter(d => d.tur !== 'Kredi' && d.tur !== 'Ödemeler') // plan defterlerine para girişi yazılmaz
                    .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
                } catch (e) { console.error('Defterler okunamadı:', e); }
                setKaporaDefterler(defterListesi);
                const bankaDefteri = odemeIcinDefterBul(defterListesi, 'Banka');
                // Seçilebilecek işler pencereye taşınır
                setKaporaIsler(bekleyenler);
                // TEK iş varsa otomatik seç; BİRDEN FAZLAYSA seçim kullanıcıya bırakılır
                const tekIs = bekleyenler.length === 1 ? bekleyenler[0] : null;
                // %20 öneri: yalnızca iş belliyse hesaplanır (tam sayıya yuvarlanır)
                const oneri = tekIs ? Math.round((parseFloat(tekIs.price) || 0) * 0.20) : 0;
                setKaporaForm({ tutar: oneri ? String(oneri) : '', defterId: bankaDefteri?.id || defterListesi[0]?.id || '', jobId: tekIs?.id || '' });
                setShowKaporaModal(true);
              }} className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Kapora Ekle
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
            {/* DEĞİŞTİ: Sayı, devam günleri hariç ANA iş sayısıdır (2 günlük iş = 1 kayıt) */}
            <span className="text-xs bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200 font-bold text-neutral-500">{customerAnaIsler.length} kayıt</span>
          </h3>
          <div className="space-y-3">
            {customerAnaIsler.map(job => {
              // YENİ: Çok günlü işte kaç gün sürdüğü / kaç araç gittiği rozet olarak gösterilir
              const toplamGun = isToplamGun(job, customerJobs);
              const toplamArac = isToplamArac(job);
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
                      {/* YENİ: Çok günlü iş rozeti — takvimde her gün ayrı kart olsa da burada tek iş */}
                      {toplamGun > 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black text-white uppercase tracking-wider shrink-0 bg-purple-600" title={`Bu iş ${toplamGun} gün sürüyor. Takvimde her gün ayrı kart olarak görünür; ciro ve kapora tek iş üzerinden sayılır.`}>
                          {toplamGun} Günlük
                        </span>
                      )}
                      {/* YENİ: Aynı güne birden fazla araç gidiyorsa rozet */}
                      {toplamArac > 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black text-white uppercase tracking-wider shrink-0 bg-sky-600" title={`Bu işe ${toplamArac} araç gidiyor. Takvimde araç sayısı kadar kart görünür; ciro ve teslim kodu tektir.`}>
                          {toplamArac} Araç
                        </span>
                      )}
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
                      {/* ==========================================================
                          YENİ: HASAR OLUŞTU BUTONU (müşteri profili iş kartı)
                          Operasyon > Biten İşler ekranındaki buton ile AYNI akışı
                          kullanır: setMarkDamageJobId ile onay penceresi açılır,
                          onaylanınca iş "Hasar var" olarak işaretlenir ve Hasar
                          Tahtası'nda "Çözüm Bekliyor" listesine düşer.
                          GÖRÜNME KOŞULU: yalnızca TAMAMLANMIŞ işlerde ve henüz
                          hasar işaretlenmemişse çıkar. Zaten hasarlıysa buton
                          yerine durum rozeti gösterilir (çözüldü / çözüm bekliyor).
                          NOT: setMarkDamageJobId verilmemişse hiçbir şey çizilmez,
                          böylece bu bileşeni başka yerden çağıran kod bozulmaz.
                          ========================================================== */}
                      {setMarkDamageJobId && (forcedComplete || job.status === 'completed') && (
                        job.endJobDetails?.damageStatus === 'Hasar var' ? (
                          <span className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap border ${job.endJobDetails?.damageResolved
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'}`}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {job.endJobDetails?.damageResolved ? 'Hasar Çözüldü' : 'Hasar Çözüm Bekliyor'}
                          </span>
                        ) : (
                          <button onClick={() => setMarkDamageJobId(job.id)} className="px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold rounded-lg hover:bg-orange-100 transition flex items-center gap-1.5 whitespace-nowrap">
                            <AlertTriangle className="w-3.5 h-3.5" /> Hasar Oluştu
                          </button>
                        )
                      )}
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
                    {job.notes && (
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-neutral-400 font-bold uppercase text-[9px] block">Notlar</span>
                          <span className="font-bold text-black break-words">{job.notes}</span>
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

                  {/* YENİ: İŞ SONLANDIRMA BİLGİLERİ + TESLİM GÖRSELLERİ
                      Operasyon ekranında girilen sonlandırma detayları burada da görünür. */}
                  {(() => {
                    const d = job.endJobDetails;
                    const temiz = (arr) => (arr || []).filter(x => x && x !== 'Yükleniyor...');
                    const kasa = temiz(d?.truckImages || (d?.truckImage ? [d.truckImage] : []));
                    const teslim = temiz(d?.deliveryImages);
                    const hasar = temiz(d?.damageImages);
                    const asansor = temiz(d?.elevatorImages);
                    const gorselVar = kasa.length + teslim.length + hasar.length + asansor.length > 0;
                    if (!d && !gorselVar) return null;

                    // Sonlandırma sırasında girilen metin bilgileri (boş olanlar gösterilmez)
                    const satirlar = [
                      { etiket: 'Müşteri Memnuniyeti', deger: d?.customerSatisfaction },
                      { etiket: 'Hasar Durumu', deger: d?.damageStatus, detay: d?.damageDetails },
                      // YENİ: Hasar çözüldüyse çözüm notu da müşteri profilinde görünür
                      { etiket: 'Hasar Çözümü', deger: d?.damageResolved ? 'Çözüldü' : null, detay: d?.damageResolutionNote },
                      { etiket: 'Kamyon Durumu', deger: d?.truckStatus, detay: d?.truckIssueDetails },
                      { etiket: 'Asansör Kurulumu', deger: d?.elevatorSetup, detay: d?.elevatorSetupReason },
                      { etiket: 'Asansörde Sorun', deger: d?.elevatorIssue === 'Evet' ? 'Evet' : null, detay: d?.elevatorIssueReason },
                      { etiket: 'Araçta Sorun', deger: d?.vehicleIssue === 'Evet' ? 'Evet' : null, detay: d?.vehicleIssueReason },
                    ].filter(s => s.deger);

                    // Görsel etiketi: tıklayınca mevcut görsel görüntüleyicide açılır
                    const GorselRozet = ({ liste, baslik, renk }) => liste.map((img, i) => (
                      <button key={baslik + i} type="button"
                        onClick={() => setViewingImage ? setViewingImage({ title: baslik, name: img }) : window.open(img, '_blank')}
                        className={`text-[10px] font-black px-2 py-1 rounded-lg border transition flex items-center gap-1 ${renk}`}>
                        <Camera className="w-3 h-3" /> {baslik}{liste.length > 1 ? ` ${i + 1}` : ''}
                      </button>
                    ));

                    return (
                      <div className="mt-3 pt-3 border-t border-neutral-200">
                        <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-2">İş Sonlandırma Bilgileri</p>

                        {satirlar.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs mb-2.5">
                            {satirlar.map((s, i) => (
                              <div key={i} className="min-w-0">
                                <span className="text-neutral-400 font-bold uppercase text-[9px] block">{s.etiket}</span>
                                <span className="font-bold text-black break-words">{s.deger}</span>
                                {s.detay && <span className="block text-[10px] text-neutral-500 font-medium break-words">{s.detay}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {gorselVar ? (
                          <div className="flex flex-wrap gap-1.5">
                            <GorselRozet liste={kasa} baslik="Kasa Fotoğrafı" renk="bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200" />
                            <GorselRozet liste={teslim} baslik="Teslim Yeri" renk="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" />
                            <GorselRozet liste={hasar} baslik="Hasar" renk="bg-red-50 text-red-700 border-red-200 hover:bg-red-100" />
                            <GorselRozet liste={asansor} baslik="Asansör" renk="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" />
                          </div>
                        ) : (
                          <p className="text-[10px] font-bold text-neutral-400">Bu işe ait fotoğraf / video eklenmemiş.</p>
                        )}

                        {/* YENİ: HASAR ÇÖZÜM BELGELERİ — hasar kapatılırken eklenen
                            fotoğraf/PDF/dekont dosyaları müşteri profilinde de görünür.
                            Ortak bileşen (shared.jsx): görseller görüntüleyicide,
                            PDF/belgeler yeni sekmede açılır. */}
                        {(d?.damageResolutionFiles || []).length > 0 && (
                          <div className="mt-2">
                            <span className="text-neutral-400 font-bold uppercase text-[9px] block">Hasar Çözüm Belgeleri</span>
                            <HasarCozumBelgeleri files={d.damageResolutionFiles} setViewingImage={setViewingImage} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {/* YENİ: SAHA DENETİMİ — bu işe şef denetimi yapılmışsa kim yaptığı,
                      ortalama puanı görünür ve tek dokunuşla tüm rapor açılır. */}
                  {(() => {
                    const dnt = jobSahaDenetimi(job.id);
                    if (!dnt) return null;
                    const medyaSayisi = (dnt.medya || []).filter(Boolean).length;
                    return (
                      <div className="mt-3 pt-3 border-t border-neutral-200">
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <ClipboardCheck className="w-4 h-4 text-purple-600 shrink-0" />
                              <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Saha Denetimi Yapıldı</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-base font-black ${denetimPuanRenk(dnt.ortalamaPuan)}`}>{String(dnt.ortalamaPuan ?? 0).replace('.', ',')}</span>
                              <Star className="w-3.5 h-3.5 text-yellow-500" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                            <div>
                              <span className="text-neutral-400 font-bold uppercase text-[9px] block">Denetimi Yapan Şef</span>
                              <span className="font-bold text-black">{dnt.sefAdi || '—'}</span>
                            </div>
                            <div>
                              <span className="text-neutral-400 font-bold uppercase text-[9px] block">Denetim Tarihi</span>
                              <span className="font-bold text-black">{dnt.denetimTarihi ? new Date(dnt.denetimTarihi).toLocaleString('tr-TR') : '—'}</span>
                            </div>
                          </div>
                          {dnt.genelRapor && (
                            <p className="text-[11px] font-medium text-neutral-600 line-clamp-2 break-words mb-2">{dnt.genelRapor}</p>
                          )}
                          <button type="button" onClick={() => setAcikDenetim(dnt)}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black rounded-lg transition flex justify-center items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> Saha Denetim Raporunu Gör
                            {medyaSayisi > 0 && <span className="bg-white/25 px-1.5 py-0.5 rounded-full text-[9px]">{medyaSayisi} görsel</span>}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ YENİ: SAHA DENETİM RAPORU PENCERESİ ============
            Şefin o iş için yaptığı denetimin tamamı: sahada çekilen fotoğraf/videolar,
            personel puanları ve şefin özel notları, kayıt doğruluğu değerlendirmesi
            ve saha raporu. Görsellere tıklayınca büyük boyutta açılır. */}
        {acikDenetim && (() => {
          const d = acikDenetim;
          const medya = (d.medya || []).filter(Boolean);
          const DOGRULUK_RENK = {
            'Hepsi doğru': 'bg-green-50 text-green-700 border-green-200',
            'Hemen hemen doğru': 'bg-lime-50 text-lime-700 border-lime-200',
            'Çok yanlış bilgiler var': 'bg-orange-50 text-orange-700 border-orange-200',
            'Tamamen yanlış': 'bg-red-50 text-red-700 border-red-200',
          };
          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-3 md:p-6">
              <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col h-[88vh]">
                {/* Başlık */}
                <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white px-4 py-3 flex justify-between items-center shrink-0">
                  <div className="min-w-0">
                    <h3 className="font-black text-base flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Saha Denetim Raporu</h3>
                    <p className="text-[11px] font-bold text-purple-200 truncate">{d.jobCustomerName} • {d.jobType} • {d.jobDate} {d.jobTime}</p>
                  </div>
                  <button onClick={() => setAcikDenetim(null)} className="text-purple-200 hover:text-white transition shrink-0"><X className="w-6 h-6" /></button>
                </div>

                {/* İçerik */}
                <div className="p-4 space-y-4 overflow-y-auto" style={{ height: 'calc(88vh - 60px)' }}>
                  {/* Kim denetledi / kaydı kim açtı / ortalama puan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
                      <span className="text-[9px] font-black text-purple-500 uppercase block">Denetimi Yapan Şef</span>
                      <span className="font-black text-black">{d.sefAdi || '—'}</span>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                      <span className="text-[9px] font-black text-neutral-400 uppercase block">Kaydı Açan</span>
                      <span className="font-black text-black">{d.kayitAcan || '—'}</span>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                      <span className="text-[9px] font-black text-yellow-600 uppercase block">Ortalama Puan</span>
                      <span className="font-black text-black flex items-center gap-1">
                        {String(d.ortalamaPuan ?? 0).replace('.', ',')} <Star className="w-3.5 h-3.5 text-yellow-500" /> <span className="text-[10px] text-neutral-400">/ 5</span>
                      </span>
                    </div>
                  </div>

                  {/* Kayıt doğruluğu */}
                  <div>
                    <span className="text-[9px] font-black text-neutral-400 uppercase block mb-1">İş Bilgileri Doğru Açıldı mı?</span>
                    <span className={`inline-block text-xs font-black px-2.5 py-1.5 rounded-lg border ${DOGRULUK_RENK[d.kayitDogrulugu] || 'bg-neutral-50 text-neutral-600 border-neutral-200'}`}>
                      {d.kayitDogrulugu || '—'}
                    </span>
                  </div>

                  {/* Sahada çekilen fotoğraf / video */}
                  <div className="border border-orange-200 rounded-xl overflow-hidden">
                    <div className="bg-orange-600 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wide flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5" /> Sahada Çekilen Fotoğraf / Video ({medya.length})
                    </div>
                    <div className="p-3">
                      {medya.length === 0 ? (
                        <p className="text-xs font-bold text-neutral-400">Bu denetime ait görsel bulunmuyor.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {medya.map((url, i) => (
                            <button key={url + i} type="button" onClick={() => setViewingImage?.({ title: `Saha Denetimi — Görsel ${i + 1}`, name: url })}
                              className="aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 hover:ring-2 hover:ring-orange-500 transition flex items-center justify-center relative">
                              {isVideoUrl(url)
                                ? <><Camera className="w-6 h-6 text-neutral-500" /><span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-black py-0.5">VİDEO</span></>
                                : <img src={url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Şefin saha raporu */}
                  <div className="border border-blue-200 rounded-xl overflow-hidden">
                    <div className="bg-blue-700 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wide flex items-center gap-2">
                      <ClipboardList className="w-3.5 h-3.5" /> Şefin Saha Raporu
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium text-neutral-700 whitespace-pre-wrap break-words">{d.genelRapor || '—'}</p>
                    </div>
                  </div>

                  {/* Personel puanları ve özel notlar */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="bg-neutral-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wide flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Personel Puanları ve Şef Notları ({(d.personelPuanlari || []).length})
                    </div>
                    <div className="p-3 space-y-2">
                      {(d.personelPuanlari || []).map((p, i) => (
                        <div key={p.personelId + i} className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 flex items-start gap-3">
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-lg font-black ${denetimPuanRenk(p.puan)}`}>{p.puan}</span>
                            <Star className="w-3.5 h-3.5 text-yellow-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-black text-xs text-black block">{p.personelAdi}</span>
                            {p.pozisyon && <span className="text-[10px] font-bold text-neutral-400 block">{p.pozisyon}</span>}
                            {p.ozelNot
                              ? <span className="text-[11px] text-neutral-600 font-medium block break-words mt-0.5">{p.ozelNot}</span>
                              : <span className="text-[10px] text-neutral-300 font-bold">Not girilmemiş</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-neutral-400 text-center pb-2">
                    Denetim zamanı: {d.denetimTarihi ? new Date(d.denetimTarihi).toLocaleString('tr-TR') : '—'}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
        {/* ==================================================================
            YENİ: KAPORA EKLE PENCERESİ
            İş fiyatının %20'si önerilir; tutar elle değiştirilebilir.
            Kaydedilince İKİ şey olur:
              1) İşin deposit alanına eklenir -> iş kartında ve sonlandırma
                 hesabında kapora olarak düşer (kayıt ekranındaki kaporayla
                 birebir aynı mantık).
              2) Seçilen deftere BUGÜNÜN tarihiyle GİRİŞ yazılır (kaynak:
                 'Kapora (Manuel)'). Otomatik kapora fonksiyonu bu kaydı
                 tanır ve asla üzerine yazmaz (shared.tsx koruması).
            ================================================================== */}
        {showKaporaModal && (() => {
          // DEĞİŞTİ: Artık iş seçilmemiş de olabilir (birden fazla açık iş varsa
          // kullanıcı seçene kadar boş kalır). Bu yüzden 'return null' KALDIRILDI;
          // aksi halde pencere hiç açılmazdı.
          const kaporaIsi = customerJobs.find(j => j.id === kaporaForm.jobId) || null;
          const cokIsVar = kaporaIsler.length > 1;
          const fiyat = parseFloat(kaporaIsi?.price) || 0;
          const mevcutKapora = parseFloat(kaporaIsi?.deposit) || 0;
          const girilen = parseFloat(kaporaForm.tutar) || 0;
          const seciliDefter = kaporaDefterler.find(d => d.id === kaporaForm.defterId);
          // Seçilen işin kalan bakiyesi — kapora bu tutardan düşer
          const kalanBakiye = Math.max(0, fiyat - mevcutKapora);
          // İş seçilince %20 önerisi o işe göre yeniden hesaplanır
          // DEĞİŞTİ (kullanıcı talebi): %20 yalnızca ÖNERİDİR. Kullanıcı tutarı
          // elle yazdıysa (öneriden farklıysa) iş seçimi değişince tutar SİLİNMEZ,
          // %20 ile ezilmez — girilen rakam ne ise o kaydedilir (az ya da çok).
          const isSec = (jobId) => {
            const secilen = kaporaIsler.find(j => j.id === jobId);
            const oneri = secilen ? Math.round((parseFloat(secilen.price) || 0) * 0.20) : 0;
            setKaporaForm(f => {
              const oncekiIs = kaporaIsler.find(j => j.id === f.jobId);
              const oncekiOneri = oncekiIs ? Math.round((parseFloat(oncekiIs.price) || 0) * 0.20) : 0;
              const elleGirildi = f.tutar !== '' && String(f.tutar) !== String(oncekiOneri || '');
              return { ...f, jobId, tutar: elleGirildi ? f.tutar : (oneri ? String(oneri) : '') };
            });
          };
          const kaydet = async () => {
            // YENİ: İş seçilmeden kapora kaydedilemez
            if (!kaporaIsi) { alert('Kaporanın hangi işe girileceğini seçin.'); return; }
            if (!(girilen > 0)) { alert('Geçerli bir kapora tutarı girin.'); return; }
            if (!kaporaForm.defterId) { alert('Kaporanın yazılacağı hesabı seçin.'); return; }
            // YENİ: Kapora, seçilen işin kalan bakiyesini aşamaz (yanlış iş
            // seçimini de erken yakalar). Fiyatı 0 olan işlerde kontrol atlanır.
            if (fiyat > 0 && girilen > kalanBakiye + 0.01) {
              alert(`Girilen kapora, seçilen işin kalan bakiyesinden fazla.\n\nİş tutarı: ₺${fiyat.toLocaleString('tr-TR')}\nMevcut kapora: ₺${mevcutKapora.toLocaleString('tr-TR')}\nKalan bakiye: ₺${kalanBakiye.toLocaleString('tr-TR')}\n\nDoğru işi seçtiğinizden emin olun.`);
              return;
            }
            setKaporaKaydediliyor(true);
            try {
              const bugun = new Date().toISOString().split('T')[0];
              // 1) İşin kapora alanına EKLE (mevcut kaporanın üzerine)
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', kaporaIsi.id), {
                deposit: String(mevcutKapora + girilen)
              });
              // 2) Seçilen deftere bugünün tarihiyle GİRİŞ yaz
              await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
                tip: 'giris',
                tutar: girilen,
                aciklama: kaporaIsi.deliveryCode ? `Teslim kodu: ${kaporaIsi.deliveryCode}` : 'Profilden kapora',
                kategori: 'Kapora',
                etiketler: ['Kapora', kaporaIsi.type].filter(Boolean),
                odemeYontemi: seciliDefter?.tur === 'Banka' ? 'Banka / Havale' : seciliDefter?.tur === 'Kredi Kartı' ? 'Kredi Kartı' : 'Nakit',
                tarih: bugun, // Kaporanın GİRİLDİĞİ gün — kullanıcı talebi
                defterId: kaporaForm.defterId,
                kaynak: 'Kapora (Manuel)',
                kayitTipi: 'kapora',
                kaporaKaynakId: kaporaIsi.id, // Oto fonksiyon ikinci satır açmasın diye
                isId: kaporaIsi.id,
                musteriAdi: kaporaIsi.customerName || '',
                musteriTel: kaporaIsi.customerPhone || '',
                teslimKodu: kaporaIsi.deliveryCode || '',
                by: currentUser?.fullName || 'Sistem',
                createdAt: new Date().toISOString()
              });
              if (addSystemLog) addSystemLog('Kapora Eklendi (Profil)',
                `${kaporaIsi.customerName}: ₺${girilen.toLocaleString('tr-TR')} kapora ${seciliDefter?.ad || 'deftere'} yazıldı ve işin kaporasına eklendi.`);
              setShowKaporaModal(false);
            } catch (e) {
              console.error('Kapora kaydedilemedi:', e);
              alert('Kapora kaydedilemedi. Lütfen tekrar deneyin.');
            }
            setKaporaKaydediliyor(false);
          };
          return (
            <div className="fixed inset-0 bg-black/60 z-[9997] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-black flex items-center gap-2"><Wallet className="w-5 h-5 text-amber-600" /> Kapora Ekle</h3>
                  <button onClick={() => setShowKaporaModal(false)} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  {/* YENİ: Açıkta birden fazla iş varsa hangi işe girileceği sorulur */}
                  {cokIsVar && (
                    <KaporaIsSecici isler={kaporaIsler} seciliId={kaporaForm.jobId} onSec={isSec} />
                  )}

                  {/* Bağlanan iş özeti — yalnızca iş seçiliyse gösterilir */}
                  {kaporaIsi ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
                      <div className="font-black text-sm">{kaporaIsi.customerName}</div>
                      <div>{kaporaIsi.date?.split('-').reverse().join('.')} • {kaporaIsi.type || 'Nakliye'} • İş tutarı: ₺{fiyat.toLocaleString('tr-TR')}</div>
                      {mevcutKapora > 0 && <div>Mevcut kapora: ₺{mevcutKapora.toLocaleString('tr-TR')}</div>}
                      {/* YENİ: Kaporanın düşeceği bakiye net görünsün */}
                      <div>Bu işin kalan bakiyesi: <b>₺{kalanBakiye.toLocaleString('tr-TR')}</b></div>
                    </div>
                  ) : (
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-500 text-center">
                      Devam etmek için yukarıdan bir iş seçin.
                    </div>
                  )}

                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Kapora Tutarı (₺) *</label>
                    <input type="number" inputMode="decimal" value={kaporaForm.tutar}
                      onChange={e => setKaporaForm({ ...kaporaForm, tutar: e.target.value })}
                      className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-lg font-black" />
                    <p className="text-[10px] font-bold text-neutral-400 mt-1">%20 yalnızca öneridir — daha az ya da daha fazla girebilirsiniz; yazdığınız tutar aynen seçtiğiniz deftere işlenir.</p>
                  </div>

                  <div><label className="text-xs font-bold text-neutral-600 block mb-1">Hangi hesaba yazılsın? *</label>
                    <select value={kaporaForm.defterId} onChange={e => setKaporaForm({ ...kaporaForm, defterId: e.target.value })}
                      className="w-full p-3 border border-neutral-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                      {kaporaDefterler.map(d => <option key={d.id} value={d.id}>{d.ad} — {d.tur}</option>)}
                    </select>
                    <p className="text-[10px] font-bold text-neutral-400 mt-1">Banka hesabı önseçili gelir; nakit veya kredi kartı alındıysa değiştirin.</p>
                  </div>

                  {girilen > 0 && kaporaIsi && (
                    <div className="text-[11px] font-bold text-neutral-600 bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 space-y-0.5">
                      <div>Deftere yazılacak: <b className="text-emerald-700">+₺{girilen.toLocaleString('tr-TR')}</b> (bugün, {seciliDefter?.ad || '-'})</div>
                      {/* Hangi işe işlendiği burada da tekrar yazılır — yanlış iş seçimi göze çarpsın */}
                      <div>İşlenecek iş: <b>{kaporaIsi.date?.split('-').reverse().join('.')} • ₺{fiyat.toLocaleString('tr-TR')}</b></div>
                      <div>İşin yeni kaporası: <b>₺{(mevcutKapora + girilen).toLocaleString('tr-TR')}</b> • Kalan bakiye: <b>₺{Math.max(0, fiyat - mevcutKapora - girilen).toLocaleString('tr-TR')}</b></div>
                    </div>
                  )}

                  {/* Buton, iş seçilmeden ve tutar girilmeden pasif kalır */}
                  <button onClick={kaydet} disabled={kaporaKaydediliyor || !kaporaIsi || !(girilen > 0)}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-neutral-300 text-white font-black rounded-xl transition">
                    {kaporaKaydediliyor ? 'Kaydediliyor...' : !kaporaIsi ? 'Önce iş seçin' : 'Kaporayı Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
          aracSayisi: '1', // YENİ: havuzdan aktarımda varsayılan tek araç
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

  // ============================================================================
  // YENİ: MÜŞTERİ HAVUZU MODÜLÜ — Satış Bölümü'nün bir parçası olarak buraya taşındı
  // (önceden ayrı MusteriHavuzu.jsx dosyasındaydı; içerik AYNEN korunmuştur,
  // sadece import satırları yukarıdaki ortak import bloğuyla birleştirildi)
  // ============================================================================

// ============================================================================
// MÜŞTERİ HAVUZU MODÜLÜ
// Şirketi arayan / mesaj atan tüm müşteri adayları 4 kanalda tek havuzda
// toplanır: Telefon Çağrıları, WhatsApp, Instagram DM, Gmail/E-posta.
// Satış personeli buradan müşteriye döner, durum ve not işler; her hareket
// kim tarafından yapıldıysa kayıt geçmişine (hareketler) yazılır.
//
// VERİ YAPISI (Firestore):
//  - havuzKayitlari : müşteri aday kayıtları. Alanlar:
//      kanal ('telefon'|'whatsapp'|'instagram'|'gmail'), musteriAdi, iletisim,
//      hesapId (hangi bağlı hesaptan geldi), hizmetTipi ('Nakliye'|'Depo'|'Asansör'),
//      durum, atanan (satışçı adı), sonMesaj (özet/ilk mesaj), notlar[],
//      hareketler[{tarih, kullanici, islem}], kaynak ('manuel'|'api'), createdAt
//  - havuzHesaplari : kanallara bağlı hesaplar (birden fazla olabilir). Alanlar:
//      kanal, etiket (örn "Santral 1 - 0850..."), deger (numara/kullanıcı/mail), createdAt
//
// API ENTEGRASYONU:
//  Kayıtlar manuel girilebildiği gibi, aşağıdaki uç noktalardan "Senkronize Et"
//  butonuyla da çekilir. Uç nokta dosyaları projenin api/ klasöründedir
//  (Vercel serverless). Her uç nokta normalize edilmiş kayıt listesi döndürür.
// ============================================================================

// Kanal başına API uç noktası (api/ klasöründeki dosyalarla birebir eşleşir)
const HAVUZ_API_UCLARI = {
  telefon:   '/api/santral/vapi',      // Sanal santral (Vapi) çağrı kayıtları
  whatsapp:  '/api/openai/whatsapp',   // WhatsApp Business mesajları
  instagram: '/api/openai/instagram',  // Instagram DM kutusu
  gmail:     '/api/openai/chat',       // Gmail / şirket e-postaları (AI özetli)
};

// Kanal tanımları: sekme rengi, ikonu, hesap alanı etiketleri
const KANALLAR = [
  { id: 'telefon',   ad: 'Telefon Çağrıları',   Ikon: Phone,         renk: 'blue',    hesapEtiket: 'Santral Numarası',   hesapOrnek: '0850 XXX XX XX',        iletisimEtiket: 'Telefon No' },
  { id: 'whatsapp',  ad: 'WhatsApp Mesajları',  Ikon: MessageCircle, renk: 'green',   hesapEtiket: 'WhatsApp Numarası',  hesapOrnek: '0532 XXX XX XX',        iletisimEtiket: 'Telefon No' },
  { id: 'instagram', ad: 'Instagram Mesajları', Ikon: Camera,        renk: 'pink',    hesapEtiket: 'Instagram Hesabı',   hesapOrnek: '@sembolnakliyat',       iletisimEtiket: 'Kullanıcı Adı' },
  { id: 'gmail',     ad: 'Gmail / E-posta',     Ikon: Mail,          renk: 'red',     hesapEtiket: 'E-posta Adresi',     hesapOrnek: 'info@sembolevdeneve.com', iletisimEtiket: 'E-posta' },
  // DEĞİŞTİ (kullanıcı talebi): "Web Sitesi Teklifleri" → "Hızlı Teklifler".
  // id 'web' AYNEN korunur; Firestore'daki mevcut kayıtlar (kanal: 'web') ve
  // api/submit-lead.js bu id ile yazmaya devam eder, hiçbir veri kaybı olmaz.
  // DEĞİŞTİ (kullanıcı talebi): Hızlı Teklifler mor değil TURUNCU
  // DEĞİŞTİ (kullanıcı talebi): "Hızlı Teklifler" → "Hızlı Teklifler Havuzu"
  { id: 'web',       ad: 'Hızlı Teklifler Havuzu', Ikon: Globe,         renk: 'orange',  hesapEtiket: 'Sayfa',              hesapOrnek: 'sembolevdeneve.com',      iletisimEtiket: 'Telefon No' },
  { id: 'iyzico',    ad: 'İyzico Siparişleri',    Ikon: CreditCard,  renk: 'amber',   hesapEtiket: 'Site',               hesapOrnek: 'depoevim.com',            iletisimEtiket: 'Telefon No' },
];

// Web sihirbazlarından (submit-lead.js) ve tıklama bildirimlerinden
// (yeni-musteri.js) gelen kayıtlarda hesapId gerçek bir "bağlı hesap" değil,
// hangi SİTEDEN geldiğini gösteren sabit bir değer ("depoevim" |
// "sembolevdeneve") — hesapAdi() bu ikisini özel olarak tanıyıp okunaklı
// gösteriyor (aşağıda).
const SITE_ETIKETLERI = { depoevim: 'DepoEvim', sembolevdeneve: 'Sembol Nakliyat Sitesi' };

// YENİ (kullanıcı talebi): Özet kutularındaki platform logoları — lucide-react
// 1.x marka ikonlarını kaldırdığı için sade satır içi SVG.
const GoogleLogo = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);
const FacebookLogo = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path fill="#fff" d="M15.1 12.5l.4-2.9h-2.8V7.8c0-.8.4-1.6 1.6-1.6h1.3V3.8s-1.1-.2-2.2-.2c-2.3 0-3.8 1.4-3.8 3.9v2.2H7.1v2.9h2.5V20h3.1v-7.5h2.4z" />
  </svg>
);
const InstagramLogo = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#FEDA75" /><stop offset=".35" stopColor="#FA7E1E" /><stop offset=".6" stopColor="#D62976" /><stop offset="1" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#igGrad)" />
    <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.8" />
    <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
  </svg>
);

// ============================================================================
// YENİ (kullanıcı talebi): KAYNAK İSTATİSTİK PANELİ
// ----------------------------------------------------------------------------
// Müşteri Havuzu başlığındaki "İstatistikleri Gör" düğmesiyle AÇILIR/KAPANIR.
// Eskiden başlıkta sürekli duran küçük özet kutuları çok yer kaplıyordu; artık
// varsayılan olarak gizli, açıldığında daha BÜYÜK ve okunaklı gösterilir.
// Sayım mantığı değişmedi: gruplar (OZET_GRUPLARI) ana bileşende hesaplanıp
// buraya prop olarak gelir — bu bileşen yalnızca GÖRÜNÜMDEN sorumludur.
// ============================================================================
const KaynakIstatistikPaneli = ({ gruplar, kanalAd, onKapat }) => (
  <div className="bg-black/20 border border-white/10 rounded-2xl p-3 md:p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
    {/* Panel başlığı: hangi kanalın verisi olduğu + kapatma düğmesi */}
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs md:text-sm font-black uppercase tracking-wide text-neutral-200 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-yellow-400" /> Kaynak İstatistikleri
        <span className="text-[10px] font-bold normal-case text-neutral-400">· {kanalAd}</span>
      </p>
      <button type="button" onClick={onKapat} title="İstatistikleri gizle"
        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Platform kartları: mobilde tek sütun, geniş ekranda 2-3 sütun */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {gruplar.map(grup => (
        // "genis" grup (Yapay Zeka, 7 kutu) satırın tamamını kaplar
        <div key={grup.ad} className={`bg-white/10 border ${grup.kenar} rounded-2xl backdrop-blur-sm p-3 md:p-4 ${grup.genis ? 'md:col-span-2 xl:col-span-3' : ''}`}>
          {/* Kart başlığı: büyük logo + platform adı */}
          <div className="flex items-center gap-3 pb-3 mb-3 border-b border-white/15">
            <span className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              {grup.logo('w-7 h-7')}
            </span>
            <p className="text-sm md:text-base font-black uppercase text-white tracking-wide">{grup.ad}</p>
          </div>

          {/* Alt kategori hücreleri — hücre sayısı kadar sütun (1, 2 veya 3); 3'ten fazlası (Yapay Zeka) ekran genişliğine göre 2 / 4 / 7 sütun */}
          <div className={`grid gap-2 ${grup.hucreler.length > 3 ? 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-7' : grup.hucreler.length === 3 ? 'grid-cols-3' : grup.hucreler.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {grup.hucreler.map(h => (
              <div key={h.ad} className="bg-black/20 rounded-xl px-2.5 py-2 min-w-0">
                <p className={`text-[11px] md:text-xs font-black uppercase truncate ${h.renk}`} title={h.ad}>{h.ad}</p>
                {/* Bugün / Bu Ay / Tümü — büyük punto sayılar */}
                <div className="flex justify-between gap-2 mt-1.5">
                  {[['Bugün', h.sayilar.bugun], ['Bu Ay', h.sayilar.buAy], ['Tümü', h.sayilar.tumu]].map(([ad, sayi]) => (
                    <div key={ad} className="text-center min-w-0">
                      <p className="text-xl md:text-2xl font-black text-white leading-none">{sayi}</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase mt-1 whitespace-nowrap">{ad}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Takip durumları — sıralama satış hunisine göredir
const DURUMLAR = [
  { id: 'Yeni',              renk: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
  { id: 'Görüşme Sağlandı',  renk: 'bg-blue-50 text-blue-700 border-blue-200' },
  // YENİ (kullanıcı talebi): iki ara durum eklendi — filtre çubuğu, tablolar ve
  // detay penceresi bu listeyi okuduğu için hepsinde otomatik görünür.
  { id: 'Ulaşılamadı',       renk: 'bg-orange-50 text-orange-700 border-orange-200' },
  // YENİ (kullanıcı talebi): Kaydet sonrası görüşme durumu sorusundaki seçenek
  { id: 'Tekrar Aranacak',   renk: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'Bilgi Aldı',        renk: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Dönüş Bekliyor',    renk: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Reddedildi',        renk: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'İşi Aldık',         renk: 'bg-green-50 text-green-700 border-green-200' },
];

// ============================================================================
// YENİ (kullanıcı talebi): KAYDET SONRASI "GÖRÜŞME DURUMU" SORUSU
// ----------------------------------------------------------------------------
// Teklife Bak penceresinde Kaydet'e basılınca durum butonları yerine bu soru
// açılır. Kayıt ilk etapta "Yeni" kalır; seçim yapılınca durum değişir.
// etiket = ekranda görünen metin, id = DURUMLAR'daki gerçek durum kodu.
// ============================================================================
const GORUSME_DURUMU_SECENEKLERI = [
  { id: 'Dönüş Bekliyor',  etiket: 'Dönüş Bekliyoruz',        renk: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' },
  { id: 'Tekrar Aranacak', etiket: 'Tekrar Aranacak',         renk: 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/30' },
  { id: 'Ulaşılamadı',     etiket: 'Ulaşılmadı',              renk: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' },
  { id: 'Bilgi Aldı',      etiket: 'Kesin Değil · Bilgi Aldı', renk: 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30' },
  { id: 'İşi Aldık',       etiket: 'İşi Aldık',               renk: 'bg-green-600 hover:bg-green-700 shadow-green-600/30' },
  { id: 'Reddedildi',      etiket: 'Reddedildi',              renk: 'bg-red-600 hover:bg-red-700 shadow-red-600/30' },
];

// ============================================================================
// YENİ (kullanıcı talebi): ZAMAN FİLTRESİ
// ----------------------------------------------------------------------------
// Durum filtresinin yanında görünür. Varsayılan "Tüm Zamanlar"dır.
// Haftalar Pazartesi başlar (Türkiye). Aralıklar yerel saate göre hesaplanır.
// ============================================================================
const ZAMAN_FILTRELERI = ['Bugün', 'Bu Hafta', 'Geçen Hafta', 'Bu Ay', 'Geçen Ay', 'Bu Yıl', 'Geçen Yıl', 'Tüm Zamanlar'];

// Seçilen filtre için [başlangıç, bitiş) aralığını döner; Tüm Zamanlar → null
const zamanAraligi = (filtre) => {
  const simdi = new Date();
  const gunBasi = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const bugun = gunBasi(simdi);
  const gunEkle = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  // Pazartesi'yi haftanın ilk günü kabul et (getDay: Pazar=0)
  const haftaBasi = gunEkle(bugun, -((bugun.getDay() + 6) % 7));
  switch (filtre) {
    case 'Bugün':       return [bugun, gunEkle(bugun, 1)];
    case 'Bu Hafta':    return [haftaBasi, gunEkle(haftaBasi, 7)];
    case 'Geçen Hafta': return [gunEkle(haftaBasi, -7), haftaBasi];
    case 'Bu Ay':       return [new Date(simdi.getFullYear(), simdi.getMonth(), 1), new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1)];
    case 'Geçen Ay':    return [new Date(simdi.getFullYear(), simdi.getMonth() - 1, 1), new Date(simdi.getFullYear(), simdi.getMonth(), 1)];
    case 'Bu Yıl':      return [new Date(simdi.getFullYear(), 0, 1), new Date(simdi.getFullYear() + 1, 0, 1)];
    case 'Geçen Yıl':   return [new Date(simdi.getFullYear() - 1, 0, 1), new Date(simdi.getFullYear(), 0, 1)];
    default:            return null;
  }
};

// Kayıt seçilen zaman aralığına giriyor mu?
const zamanUyar = (k, filtre) => {
  const aralik = zamanAraligi(filtre);
  if (!aralik) return true;
  if (!k.createdAt) return false;
  const t = new Date(k.createdAt);
  return t >= aralik[0] && t < aralik[1];
};

// ============================================================================
// YENİ (kullanıcı talebi): HAZIR NOT ŞABLONLARI
// ----------------------------------------------------------------------------
// Not penceresinde tıklanınca metin alanına otomatik yazılır. Sembol (nakliye)
// ve Depoevim (depolama) için ayrı 7'şer şablon vardır; kayıt hangi şirkete
// aitse o liste gösterilir. Yeni şablon eklemek için listeye satır eklemek yeter.
// ============================================================================
const NOT_SABLONLARI = {
  sembolevdeneve: [
    'Müşteri fiyatları merak ettiği için formu doldurmuş, şimdilik nakliye ihtiyacı yok.',
    'Müşteriyle görüşme sağlandı, eşyalarının videosunu WhatsApp\'tan atacak.',
    'Müşteri iki kez arandı, ulaşılamadı. Tekrar denenecek.',
    'Müşteri müsait değilmiş, daha sonra tekrar aranacak.',
    'Sıcak müşteri — fiyat verildi, takip edilmesi gerekiyor.',
    'Fiyat teklifi WhatsApp\'tan gönderildi, müşteri dönüş yapacak.',
    'Müşteri başka firmayla anlaşmış, teklif reddedildi.',
  ],
  depoevim: [
    'Müşteri fiyatları merak ettiği için formu doldurmuş, şimdilik depo ihtiyacı yok.',
    'Müşteriyle görüşme sağlandı, depolanacak eşyaların fotoğraflarını WhatsApp\'tan atacak.',
    'Müşteri iki kez arandı, ulaşılamadı. Tekrar denenecek.',
    'Müşteri müsait değilmiş, daha sonra tekrar aranacak.',
    'Sıcak müşteri — depo ölçüsü ve aylık fiyat konuşuldu, takip edilmesi gerekiyor.',
    'Depo fiyat listesi WhatsApp\'tan gönderildi, müşteri dönüş yapacak.',
    'Müşteri depoyu yerinde görmek istiyor, randevu tarihi netleşecek.',
  ],
};

// Hizmet tipi rozet renkleri (sistemin geneliyle uyumlu: Nakliye kırmızı, Depo mavi)
const HIZMET_TIPLERI = [
  { id: 'Nakliye',  Ikon: Truck,      renk: 'bg-red-600 text-white' },
  { id: 'Depo',     Ikon: Package,    renk: 'bg-blue-600 text-white' },
  { id: 'Asansör',  Ikon: ArrowUpDown, renk: 'bg-green-600 text-white' },
];

// Kanal rengine göre Tailwind sınıfları (dinamik sınıf üretimi Tailwind'de
// çalışmadığı için tüm varyantlar açıkça yazılır)
const KANAL_RENK = {
  blue:  { aktif: 'bg-blue-600 text-white shadow-md',  pasif: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400',   nokta: 'bg-blue-600',  koyu: 'text-blue-700' },
  green: { aktif: 'bg-green-600 text-white shadow-md', pasif: 'bg-green-50 text-green-700 border-green-200 hover:border-green-400', nokta: 'bg-green-600', koyu: 'text-green-700' },
  pink:  { aktif: 'bg-pink-600 text-white shadow-md',  pasif: 'bg-pink-50 text-pink-700 border-pink-200 hover:border-pink-400',   nokta: 'bg-pink-600',  koyu: 'text-pink-700' },
  red:   { aktif: 'bg-red-600 text-white shadow-md',   pasif: 'bg-red-50 text-red-700 border-red-200 hover:border-red-400',      nokta: 'bg-red-600',   koyu: 'text-red-700' },
  purple: { aktif: 'bg-purple-600 text-white shadow-md', pasif: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400', nokta: 'bg-purple-600', koyu: 'text-purple-700' },
  amber: { aktif: 'bg-amber-600 text-white shadow-md', pasif: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400', nokta: 'bg-amber-600', koyu: 'text-amber-700' },
  // YENİ (kullanıcı talebi): Hızlı Teklifler için turuncu
  orange: { aktif: 'bg-orange-500 text-white shadow-md', pasif: 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400', nokta: 'bg-orange-500', koyu: 'text-orange-700' },
};

// Tarihi kısa Türkçe biçimde göster
const tarihSaat = (iso) => iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// ============================================================================
// YENİ (kullanıcı talebi): HIZLI TEKLİFLER YARDIMCILARI
// ----------------------------------------------------------------------------
// Web sitesi sihirbazından gelen teklif talepleri ("web" kanalı) artık
// Müşteri Havuzu'nun EN BAŞINDA, "Hızlı Teklifler" adıyla ve gün gün ayrılmış
// daha okunaklı bir tabloda gösterilir. Aşağıdaki yardımcılar bu tabloyu ve
// sol menüdeki "yeni teklif" bildirim rozetlerini besler.
// ============================================================================

// Bir kaydın hangi şirkete ait olduğunu belirler — MusteriHavuzuView içindeki
// kayitSitesi ile AYNI kural (sadece depoevim işaretli olanlar depoevim'dir).
// DEĞİŞTİ: MusteriHavuzuView'daki kayitSitesi ile AYNI kural — hizmet tipi
// belirleyicidir (Depo → Depoevim, Nakliye/Asansör → Sembol); tipi olmayan
// eski kayıtlarda hesabına bakılır. Sol menüdeki rozetler de bu kurala uyar.
const hizliTeklifSitesi = (k) => {
  const tip = k.hizmetTipi;
  if (tip === 'Depo') return 'depoevim';
  if (tip === 'Nakliye' || tip === 'Asansör') return 'sembolevdeneve';
  return k.hesapId === 'depoevim' ? 'depoevim' : 'sembolevdeneve';
};

// ============================================================================
// YENİ (kullanıcı talebi): HAVUZ KAYDINI KİM SİLEBİLİR?
// ----------------------------------------------------------------------------
// "Sil" butonu artık YALNIZCA Firma Sahibi / Yönetici / Müdür (ve düzenleme
// yetkisi açıkça verilmiş kullanıcılar) tarafından görülür. Satış personeli,
// operasyon vb. kullanıcılarda buton hiç çizilmez.
//
// Kural App.jsx'teki isManager tanımıyla BİREBİR AYNIDIR; oradaki koda
// dokunmamak için burada currentUser üzerinden yeniden hesaplanır.
// NOT: Bu bir arayüz kısıtıdır. Kalıcı güvenlik için Firestore güvenlik
// kurallarında da havuzKayitlari silme yetkisi sınırlandırılmalıdır.
// ============================================================================
const havuzKaydiSilebilirMi = (currentUser) => {
  const poz = currentUser?.position || '';
  const superAdmin = currentUser?.fullName === 'Sistem Yöneticisi' || poz === 'Firma Sahibi';
  return superAdmin
    || poz.includes('Yönetici')
    || currentUser?.rank === 'Müdür'
    || currentUser?.permissions?.canEdit === true;
};

// ============================================================================
// YENİ: TEKLİF ÖZETİ AYRIŞTIRICI — teklifOzetiAyristir
// ----------------------------------------------------------------------------
// Web sihirbazı, teklifi TEK SATIR düz metin olarak gönderiyor. Örnek:
//   "[Evden Eve Nakliyat] İstanbul/Pendik → Afyonkarahisar/Diğer İlçeler
//    Tip: 3+1 Kat: 5 → 0 Çıkış asansör: Merdivenden Varış asansör: ... Tarih: Esnek"
// Bu metin detay penceresinde okunaksızdı. Burada başlık / güzergâh / alan
// satırlarına ayrıştırılıp tablo gibi gösterilir.
//
// GÜVENLİ YAKLAŞIM: Rastgele "kelime:" kalıbı aranmaz (çünkü metnin içindeki
// serbest cümleler yanlış bölünürdü). Yalnızca sihirbazın kullandığı BİLİNEN
// alan adları aranır; tanınmayan her şey olduğu gibi üstteki özet satırında
// kalır. Hiç eşleşme olmazsa ham metin aynen gösterilir — veri kaybı olmaz.
// Yeni bir alan eklenirse aşağıdaki listeye tek satır yazmak yeterlidir.
// ============================================================================
const TEKLIF_ALANLARI = [
  'Çıkış asansör', 'Varış asansör', 'Ambalaj malzemesi', 'Ek hizmetler',
  'Paketleme', 'Hizmet', 'Tarih', 'Tip', 'Kat', 'Eşya', 'Hacim', 'Süre',
  'Depo', 'Adres', 'Bütçe', 'Not', 'Asansör', 'Kişi', 'Mesafe',
  // DÜZELTME (kullanıcı talebi): Sembol "Eşya Depolama" sihirbazının alanları —
  // tanınmadıkları için "Kiralama Süresi" satırına yığılıyorlardı.
  'Depo Hacmi', 'Bulunduğu Kat', 'Alım/Teslim', 'Toplama', 'Depoya Giriş Tarihi',
  // YENİ (kullanıcı talebi): DepoEvim sihirbazının alanları — depolama
  // teklifleri de artık nakliye gibi satır satır ayrıştırılır.
  // (Ayrıştırıcı uzun adı önce dener: "Depo Boyutu" varken "Depo" yakalanmaz.)
  // NOT: "Depo Kiralama Süresi" kasıtlı olarak YOK — hiçbir builder bu bileşik
  // adı üretmiyor, ama "Depo Boyutu" değeri "...m³ Depo" ile bittiği için bir
  // önceki alanın sonundaki "Depo" kelimesiyle sıradaki "Kiralama Süresi:"
  // etiketi birleşip yanlışlıkla "Depo Kiralama Süresi" olarak eşleşiyordu —
  // hem bu satırın adını bozuyor hem "Depo Boyutu" değerinin sonundaki
  // "Depo" kelimesini çalıyordu. Bu isim kaldırılınca "Kiralama Süresi" tek
  // başına doğru eşleşiyor.
  'Depo Boyutu', 'Kiralama Süresi', 'Şube',
  'Teslim Şekli', 'Başlangıç Tarihi', 'Aylık Fiyat', 'Toplam Ödenecek (peşin)',
  'Toplam Ödenecek', 'Oda Sayısı', 'Kullanım Amacı', 'Kurulum yeri',
  // YENİ: DepoEvim "Firma adresimden alsın (Anahtar Teslim)" seçilince 2.
  // adımda açılan "Eşyalar Nereden Alınacak?" il/ilçe seçimi ve buna bağlı
  // tahmini alım/nakliye ücreti — uzun ad önce denenir ki "Toplam Ödenecek"
  // yakalanmadan önce doğru eşleşsin.
  'Eşyaların Alınacağı Yer', 'Tahmini Alım/Nakliye Ücreti',
  // HATA DÜZELTMESİ (Ali'nin bildirimi: "2 teklif geldi ikisinde de fiyat
  // yok"): submit-lead.js içindeki ortakKuyruk() fonksiyonu Evden Eve
  // Nakliyat / Parça Eşya / Ofis / Eşya Depolama / Asansör Kiralama
  // sihirbazlarının HEPSİNDE sonMesaj'ın en sonuna "Sistem fiyat tahmini:
  // X - Y TL" satırını ekliyordu, ama bu etiket aşağıdaki listede hiç
  // TANIMLI DEĞİLDİ. Ayrıştırıcı (teklifOzetiAyristir) yalnızca bu listedeki
  // adları alan sınırı sayar; tanınmayan "Sistem fiyat tahmini:" bir sınır
  // oluşturmadığından metin bir önceki alanın (Tarih) değerine yapışık kalıp
  // görünmez oluyordu — DepoEvim'in "Aylık Fiyat" / "Toplam Ödenecek" gibi
  // KENDİ etiketleri zaten listede olduğu için o sihirbazda bu sorun yoktu.
  'Sistem fiyat tahmini',
];

// YENİ: Teklif detayı satırlarına dönüşümlü etiket renkleri — her bölüm farklı
// renkte görünsün diye. Fiyat/tutar alanları her zaman yeşil vurgulanır.
const TEKLIF_SATIR_RENKLERI = [
  { etiket: 'bg-blue-100 text-blue-800',     nokta: 'bg-blue-500' },
  { etiket: 'bg-purple-100 text-purple-800', nokta: 'bg-purple-500' },
  { etiket: 'bg-amber-100 text-amber-800',   nokta: 'bg-amber-500' },
  { etiket: 'bg-rose-100 text-rose-800',     nokta: 'bg-rose-500' },
  { etiket: 'bg-teal-100 text-teal-800',     nokta: 'bg-teal-500' },
  { etiket: 'bg-indigo-100 text-indigo-800', nokta: 'bg-indigo-500' },
];
// HATA DÜZELTMESİ: "Sistem fiyat tahmini" eklendi — Evden Eve/Parça Eşya/Ofis/
// Eşya Depolama/Asansör Kiralama tekliflerinin fiyat satırı da artık DepoEvim
// tekliflerindeki gibi yeşil vurgulu gösteriliyor (bkz. TEKLIF_ALANLARI notu).
const TEKLIF_PARA_ALANLARI = ['Aylık Fiyat', 'Toplam Ödenecek (peşin)', 'Toplam Ödenecek', 'Bütçe', 'Tahmini Alım/Nakliye Ücreti', 'Sistem fiyat tahmini'];

// YENİ (kullanıcı talebi): Bazı alanların EKRANDA görünen adı değiştirilir.
// Ham metindeki anahtar (sihirbazın gönderdiği ad) AYNEN kalır — ayrıştırma
// bozulmaz, sadece etiket okunaklı hale gelir. Yeni bir ad değişikliği için
// bu listeye tek satır eklemek yeterlidir.
const TEKLIF_ETIKET_ADLARI = {
  'Çıkış asansör': 'Yükleme Şekli',
  'Varış asansör': 'Boşaltma Şekli',
  // Sembol Eşya Depolama — yeni kart düzeniyle (src/teklifDetay.js) aynı adlar
  'Bulunduğu Kat': 'Kat',
  'Alım/Teslim': 'Depoya Ulaşım',
  'Depoya Giriş Tarihi': 'Giriş Tarihi',
};
const teklifEtiketAdi = (etiket) => TEKLIF_ETIKET_ADLARI[etiket] || etiket;

const teklifOzetiAyristir = (ham) => {
  const metin = (ham || '').trim();
  if (!metin) return null;

  // 1) Baştaki [Köşeli parantez] hizmet başlığıdır
  const baslikEsleme = metin.match(/^\[([^\]]+)\]\s*/);
  const baslik = baslikEsleme ? baslikEsleme[1] : '';
  let kalan = baslikEsleme ? metin.slice(baslikEsleme[0].length) : metin;

  // 2) Bilinen alan adlarını metin içinde bul (uzun adlar önce denenir ki
  //    "Çıkış asansör" varken sadece "Asansör" yakalanmasın)
  const adlar = [...TEKLIF_ALANLARI].sort((a, b) => b.length - a.length);
  const kacis = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const desen = new RegExp(`(?:^|\\s)(${adlar.map(kacis).join('|')})\\s*:\\s*`, 'gi');

  const isaretler = [];
  let e;
  while ((e = desen.exec(kalan)) !== null) {
    isaretler.push({ etiket: e[1], basla: e.index, degerBasla: e.index + e[0].length });
  }

  // 3) Hiç alan bulunamadıysa metni olduğu gibi göster
  if (isaretler.length === 0) return { baslik, ozet: kalan.trim(), satirlar: [], ham: metin };

  // 4) İlk alandan önceki kısım güzergâh/serbest özet olarak kalır
  const ozet = kalan.slice(0, isaretler[0].basla).trim();
  const satirlar = isaretler.map((im, i) => ({
    etiket: im.etiket,
    deger: kalan.slice(im.degerBasla, i + 1 < isaretler.length ? isaretler[i + 1].basla : kalan.length).trim(),
  })).filter(s => s.deger);

  return { baslik, ozet, satirlar, ham: metin };
};

// Sadece saat kısmı (gün ayracında tarih zaten yazdığı için satırda saat yeter)
const sadeceSaat = (iso) => iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';

// Yerel (Türkiye) güne göre anahtar: "2026-09-18" — gün ayracı gruplaması için.
// toISOString kullanılmaz; UTC'ye çevirirse gece 00:00-03:00 arası kayıtlar
// önceki güne kayardı.
const gunAnahtari = (iso) => {
  if (!iso) return 'bilinmiyor';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Gün ayracı başlığı: "18 Eylül 2026 Teklifleri"
const gunBasligi = (anahtar) => {
  if (anahtar === 'bilinmiyor') return 'Tarihi Bilinmeyen Teklifler';
  const [y, m, g] = anahtar.split('-').map(Number);
  return `${new Date(y, m - 1, g).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} Teklifleri`;
};

// "Bugün" / "Dün" etiketi — diğer günlerde boş döner
const gunGoreliEtiket = (anahtar) => {
  const bugun = gunAnahtari(new Date().toISOString());
  const dunTarih = new Date(); dunTarih.setDate(dunTarih.getDate() - 1);
  const dun = gunAnahtari(dunTarih.toISOString());
  if (anahtar === bugun) return 'Bugün';
  if (anahtar === dun) return 'Dün';
  return '';
};

// Telefonu tel: ve WhatsApp (wa.me) bağlantısına uygun hale getirir.
// "05366933490", "+905452602112", "5078681629" biçimlerinin hepsini 90XXXXXXXXXX yapar.
const telefonRakam = (v) => (v || '').replace(/\D/g, '');
const waNumarasi = (v) => {
  let r = telefonRakam(v);
  if (r.startsWith('90') && r.length === 12) return r;
  if (r.startsWith('0')) r = r.slice(1);
  if (r.length === 10) return '90' + r;
  return r;
};
// "Tıklama (Bekleniyor)" gibi henüz numarası olmayan kayıtlarda arama yapılamaz
const telefonGecerliMi = (v) => telefonRakam(v).length >= 10 && !(v || '').includes('Bekleniyor');

// ============================================================================
// YENİ: SOL MENÜ BİLDİRİM SAYACI — useHizliTeklifYeniSayilari
// ----------------------------------------------------------------------------
// App.jsx bu hook'u çağırır ve Satış menüsünde iki rozet gösterir:
//   • KIRMIZI  → Sembol Nakliyat için durumu hâlâ "Yeni" olan teklif sayısı
//   • MAVİ     → Depoevim için durumu hâlâ "Yeni" olan teklif sayısı
// Durum değiştirilince (Görüşme Sağlandı, Dönüş Bekliyor, ...) onSnapshot
// anında tetiklenir ve sayı otomatik azalır.
//
// FİRESTORE OKUMA DİKKATİ: Yalnızca kanal=='web' kayıtları dinlenir (tüm
// havuz değil). "Yeni" süzmesi istemci tarafında yapılır ki durum alanı hiç
// yazılmamış eski kayıtlar da (varsayılan "Yeni") doğru sayılsın.
//   aktif: false verilirse (kullanıcı giriş yapmadıysa) hiç abone olunmaz.
// ============================================================================
// ============================================================================
// HATA DÜZELTMESİ (kullanıcı bildirimi): Satış menüsündeki rozet 45, listedeki
// "Yeni" ise 17 gösteriyordu. Sebep: rozet HAM kayıtları sayıyordu; liste ise
// spam isimli kayıtları ve aynı ad+telefondan gelen mükerrerleri gizliyor
// (mukerrerleriGizle). Rozet artık listeyle AYNI temizliği uygular.
// Aşağıdaki üç yardımcı, MusteriHavuzuView içindekilerin birebir kopyasıdır
// (bileşen içinde tanımlı oldukları için hook'tan erişilemiyordu).
// ============================================================================
const adAnahtariRozet = (ad) => (ad || '')
  .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
  .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
  .replace(/Ç/g, 'c').replace(/ç/g, 'c').replace(/Ö/g, 'o').replace(/ö/g, 'o')
  .replace(/Ü/g, 'u').replace(/ü/g, 'u')
  .toLowerCase().replace(/\s+/g, ' ').trim();

// ŞÜPHELİ / SPAM İSİM TESPİTİ — sadece AÇIKÇA sahte olanları eler; gerçek
// isimleri (tek/çift kelime, yabancı, aksanlı) korur. Kararsız kalınan
// hiçbir isim elenmez; amaç gerçek talebi asla kaçırmamaktır.
const supheliIsimRozet = (ad) => {
  const ham = (ad || '').trim();
  const norm = adAnahtariRozet(ham);
  if (!norm) return true;                                   // boş
  // (a) 2'den az HARF içeriyorsa (".", "E", "1", "--") → spam
  const harfler = norm.replace(/[^a-z]/g, '');
  if (harfler.length < 2) return true;
  // (b) Hiç sesli harf yoksa (klavye ezmesi "sk", "bcd") → spam
  if (!/[aeıioöuü]/.test(ham.toLocaleLowerCase('tr')) && !/[aeiou]/.test(norm)) return true;
  // (c) Tek karakterin tekrarı ("aaaa", "xxxx", "....") → spam
  if (/^(.)\1+$/.test(norm.replace(/\s/g, ''))) return true;
  // (d) Bilinen test/şirket kelimeleri (tam kelime eşleşmesi) → spam
  const karaListe = ['test','deneme','asd','asdf','asdasd','sdf','dsa','sda','qwe','qwer','qwerty','zxc','zxcv','aaa','xxx','sss','abc','ncnc','asdfg','fiyat','random','spam','depoevim','depo evim','sembol','sembol nakliyat'];
  const kelimeler = norm.split(' ');
  if (karaListe.includes(norm) || kelimeler.every(k => karaListe.includes(k))) return true;
  // (e) Herhangi bir kelime 3+ ARDIŞIK sessiz harfle BAŞLIYORSA → spam.
  //     Türkçede (ve neredeyse tüm dillerde) kelime 3 sessizle başlamaz;
  //     "Smsöal" (Sms...) gibi ezmeleri yakalar, gerçek isimleri etkilemez.
  const sessiz = '[bcçdfgğhjklmnprsştvyzqwx]';
  if (kelimeler.some(k => new RegExp(`^${sessiz}{3,}`, 'i').test(k))) return true;
  return false;
};

const mukerrerleriGizleRozet = (liste) => {
  const gorulen = new Set();
  return liste.filter(k => {
    // (1) Şüpheli/spam isimli kayıtlar gizlenir
    if (supheliIsimRozet(k.musteriAdi)) return false;
    // (2) Aynı ad + telefondan yalnızca en yenisi kalır
    if (!telefonGecerliMi(k.iletisim)) return true;            // Numarasız kayıt eşleştirilmez
    const anahtar = `${adAnahtariRozet(k.musteriAdi)}|${telefonRakam(k.iletisim)}`;
    if (gorulen.has(anahtar)) return false;                    // Daha yenisi zaten listede
    gorulen.add(anahtar);
    return true;
  });
};

export const useHizliTeklifYeniSayilari = (aktif = true) => {
  const [sayilar, setSayilar] = useState({ sembol: 0, depoevim: 0 });
  useEffect(() => {
    if (!aktif) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari'), where('kanal', '==', 'web'));
    const unsub = onSnapshot(q, snap => {
      let sembol = 0, depoevim = 0;
      // DEĞİŞTİ: listeyle aynı sıra (en yeni önce) ve aynı temizlik (spam + mükerrer)
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      liste.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
      mukerrerleriGizleRozet(liste).forEach(k => {
        if ((k.durum || 'Yeni') !== 'Yeni') return;   // Durumu değişen teklif sayılmaz
        if (k.atanan || k.telefonTeklifId) return;     // YENİ: satışçı aldıysa artık havuzda değil
        if (hizliTeklifSitesi(k) === 'depoevim') depoevim++; else sembol++;
      });
      setSayilar({ sembol, depoevim });
    }, err => console.error('Hızlı teklif sayacı dinlenemedi:', err));
    return () => unsub();
  }, [aktif]);
  return sayilar;
};

// ============================================================================
// YENİ: HIZLI TEKLİFLER TABLOSU — HizliTekliflerTablosu
// ----------------------------------------------------------------------------
// Web sihirbazından gelen teklifleri gün gün ayrılmış, okunaklı bir tabloda
// gösterir. Hem Sembol Nakliyat hem Depoevim için aynı bileşen kullanılır;
// yalnızca vurgu rengi değişir (Sembol kırmızı, Depoevim mavi).
//
// Her satırda:
//   • Müşteri adı, geliş kaynağı (Google Ads / Organik), saat, teklif özeti
//   • Telefon + ARA ve WHATSAPP butonları (numarası yoksa pasif)
//   • Hizmet rozeti, Durum ve Satışçı seçicileri (mevcut işlevler aynen)
//   • NOT sütunu: son not görünür, "+ Not" ile satırdan çıkmadan yeni not eklenir
//   • Detay ve Sil
//
// Props: filtrelenmiş kayıtlar ve MusteriHavuzuView'daki mevcut işleyiciler.
// Bileşen kendi Firestore çağrısı yapmaz; her şeyi üst bileşenden alır.
// ============================================================================
const HizliTekliflerTablosu = ({
  kayitlar, siteSecimi, hesapAdi, durumRenk, satiscilar, reklamKaynagiEtiket,
  onDurumDegistir, onAta, onNotEkle, onNotGuncelle, onNotSil, onDetay, onSil,
  silebilir = false,   // YENİ: yalnızca yetkili kullanıcıda "Sil" butonu çizilir
  gecmisBul = null,    // YENİ (kullanıcı talebi): (kayıt) => müşteri geçmişi | null — satırda "↺ Geçmiş" rozeti
  onGorusmeAc = null,  // YENİ: (telefonTeklifId) => Telefon Görüşmesi'nde o kaydı açar
}) => {
  // ==========================================================================
  // DEĞİŞTİ (kullanıcı talebi): NOTLAR ARTIK PENCEREDE YÖNETİLİR
  // --------------------------------------------------------------------------
  // ESKİSİ: Satırın içinde küçük bir metin kutusu açılıyordu; uzun not yazmak
  // ve eski notları okumak zordu.
  // YENİSİ: "Not Ekle" penceresi açar. Not varsa "Notu Gör (N)" butonu çıkar;
  // pencerede tüm notlar tarih/kullanıcı bilgisiyle listelenir, her not
  // düzenlenebilir ve aynı pencereden yeni not eklenebilir.
  // ==========================================================================
  const [notPenceresi, setNotPenceresi] = useState(null); // { kayitId, mod: 'ekle' | 'liste' }
  const [notTaslak, setNotTaslak] = useState('');          // Yeni not metni
  const [notKaydediliyor, setNotKaydediliyor] = useState(false);
  const [duzenleIndex, setDuzenleIndex] = useState(null);  // Düzenlenen notun sırası
  const [duzenleMetin, setDuzenleMetin] = useState('');    // Düzenlenen notun yeni metni

  // Pencere açıkken kayıt her zaman GÜNCEL listeden okunur; böylece not
  // eklenince onSnapshot tetiklendiğinde pencere de anında tazelenir.
  const notKaydi = notPenceresi ? kayitlar.find(x => x.id === notPenceresi.kayitId) : null;

  // ==========================================================================
  // YENİ (kullanıcı talebi): 200'LÜ GÖSTERİM + "DEVAMINI GÖR"
  // --------------------------------------------------------------------------
  // Tüm Zamanlar açıkken liste binlerce satıra çıkabilir; tarayıcıyı yormamak
  // için ilk 200 kayıt çizilir, her "Devamını Gör" tıklaması 200 daha ekler.
  // Filtre değişince (kayıt kümesi değişince) sınır 200'e döner.
  // ==========================================================================
  const SAYFA_BOYUTU = 200;
  const [gosterimSiniri, setGosterimSiniri] = useState(SAYFA_BOYUTU);
  useEffect(() => { setGosterimSiniri(SAYFA_BOYUTU); }, [kayitlar.length, siteSecimi]);
  const gorunenKayitlar = kayitlar.slice(0, gosterimSiniri);
  const kalanKayit = Math.max(0, kayitlar.length - gorunenKayitlar.length);

  // Kayıt hangi şirkete aitse o şirketin not şablonları gösterilir
  const notSablonlari = notKaydi ? (NOT_SABLONLARI[hizliTeklifSitesi(notKaydi)] || NOT_SABLONLARI.sembolevdeneve) : [];

  const notPenceresiKapat = () => {
    setNotPenceresi(null); setNotTaslak(''); setDuzenleIndex(null); setDuzenleMetin('');
  };

  // Şirkete göre vurgu renkleri (Tailwind dinamik sınıf üretmediği için açık yazılır)
  // DEĞİŞTİ (kullanıcı talebi): siteSecimi === 'tumu' iken iki şirketin talepleri
  // birlikte listelenir → gün ayracı nötr renkte, her SATIR kendi şirketinin
  // rengini alır (Sembol kırmızı, Depoevim mavi).
  const tumSiteler = siteSecimi === 'tumu';
  const sembolMu = siteSecimi !== 'depoevim';
  const vurgu = tumSiteler
    ? { avatar: 'bg-neutral-800', cizgi: 'bg-neutral-800', ayracArka: 'bg-neutral-100 border-neutral-200', ayracYazi: 'text-neutral-800', rozet: 'bg-neutral-900 text-white' }
    : sembolMu
    ? { avatar: 'bg-red-600', cizgi: 'bg-red-600', ayracArka: 'bg-red-50 border-red-200', ayracYazi: 'text-red-800', rozet: 'bg-red-600 text-white' }
    : { avatar: 'bg-blue-600', cizgi: 'bg-blue-600', ayracArka: 'bg-blue-50 border-blue-200', ayracYazi: 'text-blue-800', rozet: 'bg-blue-600 text-white' };
  const satirSembolMu = (k) => (tumSiteler ? hizliTeklifSitesi(k) !== 'depoevim' : sembolMu);

  // Kayıtlar zaten createdAt'e göre yeniden eskiye sıralı gelir; gün değiştiğinde
  // araya ayraç satırı eklenir. Ayraçta o günün toplam ve "Yeni" sayısı yazar.
  const gunGruplari = [];
  gorunenKayitlar.forEach(k => {
    const anahtar = gunAnahtari(k.createdAt);
    let grup = gunGruplari[gunGruplari.length - 1];
    if (!grup || grup.anahtar !== anahtar) {
      grup = { anahtar, kayitlar: [] };
      gunGruplari.push(grup);
    }
    grup.kayitlar.push(k);
  });

  // Penceredeki "Notu Kaydet" — yeni not ekler, ardından liste moduna geçer
  const notuKaydet = async () => {
    const metin = notTaslak.trim();
    if (!metin || !notKaydi) return;
    setNotKaydediliyor(true);
    await onNotEkle(notKaydi, metin);
    setNotKaydediliyor(false);
    setNotTaslak('');
    setNotPenceresi({ kayitId: notKaydi.id, mod: 'liste' });
  };

  // Penceredeki "Güncelle" — mevcut bir notun metnini değiştirir
  const notuGuncelle = async () => {
    const metin = duzenleMetin.trim();
    if (!metin || duzenleIndex === null || !notKaydi) return;
    setNotKaydediliyor(true);
    await onNotGuncelle(notKaydi, duzenleIndex, metin);
    setNotKaydediliyor(false);
    setDuzenleIndex(null); setDuzenleMetin('');
  };

  return (
    <>
    {/* ======================================================================
        YENİ (kullanıcı talebi): YENİ TEKLİF SATIRLARINA YANIP SÖNEN ÇERÇEVE
        ----------------------------------------------------------------------
        Durumu "Yeni" olan satırın TAMAMI ince bir çizgiyle çerçevelenir ve
        çerçeve yanıp söner: Sembol işlerinde KIRMIZI, Depoevim işlerinde MAVİ.
        Tailwind'de kenarlık rengini yakıp söndüren hazır sınıf olmadığı için
        küçük bir keyframe tanımlanır (outline kullanılır; tablo satırında
        güvenilir çalışır ve hücre hizasını bozmaz). Durum "Yeni"den çıkınca
        çerçeve kendiliğinden kaybolur.
        ====================================================================== */}
    <style>{`
      @keyframes hizliYeniYanip { 50% { outline-color: transparent; } }
      .hizli-yeni-cerceve { outline: 2px solid; outline-offset: -2px; animation: hizliYeniYanip 1.1s ease-in-out infinite; }
      .hizli-yeni-kirmizi { outline-color: #dc2626; }  /* Sembol Nakliyat */
      .hizli-yeni-mavi    { outline-color: #2563eb; }  /* Depoevim */
    `}</style>
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-x-auto">
      <table className="w-full text-left text-xs min-w-[1080px]">
        {/* DEĞİŞTİ (kullanıcı talebi): SÜTUN SIRASI
            Müşteri/Teklif → Telefon → Teklif (Teklife Bak) → Not →
            Durum (Hizmet + Durum + Satışçı alt alta) → Sil (en sonda) */}
        <thead className="bg-neutral-900 text-white">
          <tr>
            <th className="p-3 font-bold rounded-tl-2xl w-[26%]">Müşteri / Teklif</th>
            <th className="p-3 font-bold">Telefon</th>
            <th className="p-3 font-bold text-center">Teklif</th>
            <th className="p-3 font-bold w-[20%]">Not</th>
            <th className="p-3 font-bold">Durum</th>
            {silebilir && <th className="p-3 font-bold text-right rounded-tr-2xl">Sil</th>}
          </tr>
        </thead>
        <tbody>
          {kayitlar.length === 0 && (
            <tr><td colSpan={silebilir ? 6 : 5} className="p-10 text-center">
              <Globe className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-neutral-500 font-bold">Bu filtrelerde teklif yok.</p>
              <p className="text-neutral-400 text-[11px] mt-1">Web sitesi sihirbazından gelen talepler burada gün gün listelenir.</p>
            </td></tr>
          )}

          {gunGruplari.map(grup => {
            const yeniSayisi = grup.kayitlar.filter(k => (k.durum || 'Yeni') === 'Yeni').length;
            const goreli = gunGoreliEtiket(grup.anahtar);
            return (
              <React.Fragment key={grup.anahtar}>
                {/* ---------- GÜN AYRACI: "18 Eylül 2026 Teklifleri" ---------- */}
                <tr className={`border-y ${vurgu.ayracArka}`}>
                  <td colSpan={silebilir ? 6 : 5} className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-1.5 h-6 rounded-full ${vurgu.cizgi}`}></span>
                      <CalendarDays className={`w-4 h-4 ${vurgu.ayracYazi}`} />
                      <span className={`font-black text-sm ${vurgu.ayracYazi}`}>{gunBasligi(grup.anahtar)}</span>
                      {goreli && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${vurgu.rozet}`}>{goreli}</span>}
                      <span className="text-[11px] font-bold text-neutral-500 ml-auto">
                        {grup.kayitlar.length} teklif
                        {yeniSayisi > 0 && <span className="ml-2 text-neutral-800">• {yeniSayisi} yeni</span>}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* ---------- O GÜNÜN TEKLİF SATIRLARI ---------- */}
                {grup.kayitlar.map(k => {
                  const tip = HIZMET_TIPLERI.find(t => t.id === (k.hizmetTipi || 'Nakliye')) || HIZMET_TIPLERI[0];
                  const yeni = (k.durum || 'Yeni') === 'Yeni';
                  const sonNot = (k.notlar || [])[k.notlar?.length - 1];
                  const telefonVar = telefonGecerliMi(k.iletisim);
                  const kaynakEtiket = reklamKaynagiEtiket(k);
                  return (
                    <tr key={k.id} className={`border-b border-neutral-100 transition ${yeni ? `bg-yellow-50/40 hover:bg-yellow-50 hizli-yeni-cerceve ${satirSembolMu(k) ? 'hizli-yeni-kirmizi' : 'hizli-yeni-mavi'}` : 'hover:bg-neutral-50'}`}>

                      {/* MÜŞTERİ + TEKLİF ÖZETİ */}
                      <td className="p-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <span className={`w-8 h-8 rounded-full ${satirSembolMu(k) ? 'bg-red-600' : 'bg-blue-600'} text-white flex items-center justify-center text-[11px] font-black shrink-0`}>
                            {(k.musteriAdi || k.iletisim || '?').charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-black text-[13px] truncate">{k.musteriAdi || 'İsimsiz'}</span>
                              {yeni && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-yellow-400 text-black">YENİ</span>}
                              {/* YENİ: hangi şirket — tek havuzda ayrım için */}
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${satirSembolMu(k) ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{satirSembolMu(k) ? 'SEMBOL' : 'DEPOEVİM'}</span>
                              {/* YENİ (kullanıcı talebi): telefonla eşleşen geçmiş kayıt varsa */}
                              {gecmisBul && (() => {
                                const g = gecmisBul(k);
                                if (!g) return null;
                                const tasindi = g.isler.some(j => j.status === 'completed');
                                return <span title={`${g.isler.length} iş · ${g.havuz.length} havuz · ${g.telefon.length} telefon`}
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${tasindi ? 'bg-green-100 text-green-800 border-green-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                                  ↺ {tasindi ? 'Eski müşteri' : 'Geçmiş'} {g.toplam}</span>;
                              })()}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold text-neutral-500 flex-wrap">
                              <Clock className="w-3 h-3" /> {sadeceSaat(k.createdAt)}
                              {/* YENİ: "Diğer Site" ise hangi site olduğu rozetin içinde, "İniş
                                  sayfası" bilgisi ise fare üzerine gelince (title) görünüyor —
                                  Ali'nin "google aramasında hangi sayfaya düştü" talebi. */}
                              <span className={`px-1.5 py-0.5 rounded ${kaynakEtiket.renk}`} title={k.inisSayfasi ? `İniş sayfası: ${k.inisSayfasi}` : undefined}>
                                {kaynakEtiket.ad}{(k.reklamKaynagi === 'diger_site' && k.digerSiteAdi) ? ` (${k.digerSiteAdi})` : ''}
                              </span>
                              <span className="text-neutral-400">{hesapAdi(k.hesapId)}</span>
                            </div>
                            {k.sonMesaj && (
                              <p className="text-[11px] text-neutral-600 mt-1 leading-snug line-clamp-2" title={k.sonMesaj}>{k.sonMesaj}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* TELEFON + ARA / WHATSAPP */}
                      <td className="p-3 align-top whitespace-nowrap">
                        <p className={`font-black text-[13px] ${telefonVar ? 'text-black' : 'text-neutral-400'}`}>{k.iletisim || '—'}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <a href={telefonVar ? `tel:${telefonRakam(k.iletisim)}` : undefined}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition ${telefonVar ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-neutral-200 text-neutral-400 pointer-events-none'}`}>
                            <Phone className="w-3 h-3" /> Ara
                          </a>
                          <a href={telefonVar ? `https://wa.me/${waNumarasi(k.iletisim)}` : undefined} target="_blank" rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition ${telefonVar ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-neutral-200 text-neutral-400 pointer-events-none'}`}>
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                        </div>
                      </td>

                      {/* TEKLİF — DEĞİŞTİ: "Detayı Gör" → turuncu "Teklife Bak" */}
                      <td className="p-3 align-top text-center">
                        <button type="button" onClick={() => onDetay(k)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-black shadow-lg shadow-orange-500/40 ring-2 ring-orange-200 transition whitespace-nowrap">
                          <Eye className="w-3.5 h-3.5" /> Teklife Bak
                        </button>
                        {/* YENİ: Telefon Görüşmesi'ne aktarılmış talepte o görüşmeyi doğrudan açar */}
                        {k.telefonTeklifId && onGorusmeAc && (
                          <button type="button" onClick={() => onGorusmeAc(k.telefonTeklifId)}
                            className="mt-1.5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black transition whitespace-nowrap">
                            <PhoneCall className="w-3 h-3" /> Görüşmeye Bak
                          </button>
                        )}
                      </td>

                      {/* NOT — DEĞİŞTİ (kullanıcı talebi): SADECE GÖRÜNTÜLEME
                          Not ekleme/düzenleme artık yalnızca "Teklife Bak"
                          penceresinden yapılır; burada son not (veya "Not yok")
                          gösterilir. */}
                      <td className="p-3 align-top">
                        {sonNot ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1.5">
                            <p className="text-[11px] text-neutral-800 line-clamp-2 whitespace-pre-wrap" title={sonNot.metin}>{sonNot.metin}</p>
                            <p className="text-[9px] font-bold text-neutral-400 mt-0.5">
                              {sonNot.kullanici} • {tarihSaat(sonNot.tarih)}
                              {(k.notlar || []).length > 1 && <span className="ml-1 text-neutral-500">• +{k.notlar.length - 1} not daha</span>}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-400"><StickyNote className="w-3 h-3" /> Not yok</span>
                        )}
                      </td>

                      {/* DURUM — DEĞİŞTİ (kullanıcı talebi): SADECE GÖRÜNTÜLEME
                          Hizmet tipi, durum ve satışçı burada rozet olarak görünür;
                          değiştirme yalnızca "Teklife Bak" penceresinden yapılır
                          (durum/hizmet butonları + Kaydet ile satışçı ataması). */}
                      <td className="p-3 align-top">
                        <div className="flex flex-col gap-1.5 w-[150px]">
                          <span className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black ${tip.renk}`}>
                            <tip.Ikon className="w-3 h-3" /> {tip.id.toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-black border ${durumRenk(k.durum)}`}>
                            {k.durum || 'Yeni'}
                          </span>
                          <span className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${k.atanan ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-400 border-neutral-200'}`}>
                            <User className="w-3 h-3" /> {k.atanan || 'Atanmadı'}
                          </span>
                        </div>
                      </td>

                      {/* SİL — en sonda; yalnızca Müdür / Yönetici / Firma Sahibi görür */}
                      {silebilir && (
                        <td className="p-3 align-top text-right">
                          <button type="button" onClick={() => onSil(k.id)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-500 border border-red-200 rounded-lg text-[10px] font-black transition">
                            <Trash2 className="w-3 h-3" /> Sil
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* YENİ: DEVAMINI GÖR — her tıklamada 200 kayıt daha yüklenir */}
      {kalanKayit > 0 && (
        <div className="p-3 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-center gap-2">
          <span className="text-[11px] font-bold text-neutral-500">{gorunenKayitlar.length} / {kayitlar.length} teklif gösteriliyor</span>
          <button type="button" onClick={() => setGosterimSiniri(x => x + SAYFA_BOYUTU)}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-700 text-white rounded-xl text-xs font-black transition inline-flex items-center gap-1.5">
            <ChevronDown className="w-4 h-4" /> Devamını Gör ({Math.min(SAYFA_BOYUTU, kalanKayit)} kayıt daha)
          </button>
        </div>
      )}
    </div>

    {/* ======================================================================
        YENİ: NOT PENCERESİ
        ----------------------------------------------------------------------
        İki modda çalışır:
          mod 'ekle'  → doğrudan yeni not yazma ekranı
          mod 'liste' → tüm notlar; her notun yanında "Düzenle", altta yeni not
        Notlar, kaydın notlar[] dizisinde durur; ekleme ve güncelleme
        işlemlerinin ikisi de hareket geçmişine yazılır.
        ====================================================================== */}
    {notPenceresi && notKaydi && (
      <div className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-4 animate-in fade-in" onClick={notPenceresiKapat}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95 overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Başlık */}
          <div className="bg-neutral-900 text-white p-4 flex items-start gap-3 shrink-0">
            <span className="w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center shrink-0">
              <StickyNote className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-sm truncate">{notKaydi.musteriAdi || 'İsimsiz'}</h3>
              <p className="text-[11px] font-bold text-neutral-400 truncate">{notKaydi.iletisim} • {(notKaydi.notlar || []).length} not</p>
            </div>
            <button onClick={notPenceresiKapat} className="text-neutral-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
          </div>

          {/* İki mod arası geçiş — not yoksa sadece "Not Ekle" anlamlıdır */}
          <div className="flex gap-1 p-2 bg-neutral-100 border-b border-neutral-200 shrink-0">
            <button type="button" onClick={() => setNotPenceresi({ kayitId: notKaydi.id, mod: 'liste' })} disabled={(notKaydi.notlar || []).length === 0}
              className={`flex-1 py-2 rounded-xl text-[11px] font-black transition disabled:opacity-40 ${notPenceresi.mod === 'liste' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}>
              Notlar ({(notKaydi.notlar || []).length})
            </button>
            <button type="button" onClick={() => { setNotPenceresi({ kayitId: notKaydi.id, mod: 'ekle' }); setDuzenleIndex(null); }}
              className={`flex-1 py-2 rounded-xl text-[11px] font-black transition ${notPenceresi.mod === 'ekle' ? 'bg-yellow-400 text-black' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}>
              Yeni Not
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-neutral-50">

            {/* ---------- MOD: YENİ NOT EKLE ---------- */}
            {notPenceresi.mod === 'ekle' && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-3">
                {/* YENİ: HAZIR ŞABLONLAR — tıklanınca metin alanına yazılır, sonra düzenlenebilir */}
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Hazır Notlar</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {notSablonlari.map((sablon, i) => (
                    <button key={i} type="button" onClick={() => setNotTaslak(sablon)}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${notTaslak === sablon ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-yellow-50 border-yellow-200 text-yellow-900 hover:bg-yellow-100'}`}>
                      {sablon}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-2">Yeni Not</p>
                <textarea autoFocus rows={5} value={notTaslak} onChange={e => setNotTaslak(e.target.value)}
                  placeholder="Örn: Fiyat verildi, perşembe dönecek. Asansör gerekiyor, ek ücret konuşuldu..."
                  className="w-full p-3 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
                <button type="button" onClick={notuKaydet} disabled={!notTaslak.trim() || notKaydediliyor}
                  className="w-full mt-2 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-black disabled:opacity-40 flex items-center justify-center gap-1.5 transition hover:bg-neutral-700">
                  {notKaydediliyor ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Kaydediliyor</> : <><Send className="w-3.5 h-3.5" /> Notu Kaydet</>}
                </button>
              </div>
            )}

            {/* ---------- MOD: NOTLARI GÖR / DÜZENLE ---------- */}
            {notPenceresi.mod === 'liste' && (
              <div className="space-y-2">
                {(notKaydi.notlar || []).length === 0 && (
                  <p className="text-center text-neutral-400 font-bold text-xs py-8">Bu kayıtta henüz not yok.</p>
                )}
                {/* En yeni not en üstte; düzenleme için gerçek dizi sırası korunur */}
                {(notKaydi.notlar || []).map((n, i) => ({ n, i })).reverse().map(({ n, i }) => (
                  <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-3">
                    {duzenleIndex === i ? (
                      <>
                        <textarea autoFocus rows={4} value={duzenleMetin} onChange={e => setDuzenleMetin(e.target.value)}
                          className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
                        <div className="flex gap-2 mt-2">
                          <button type="button" onClick={() => { setDuzenleIndex(null); setDuzenleMetin(''); }}
                            className="flex-1 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-[11px] font-black hover:bg-neutral-200 transition">Vazgeç</button>
                          <button type="button" onClick={notuGuncelle} disabled={!duzenleMetin.trim() || notKaydediliyor}
                            className="flex-1 py-2 bg-neutral-900 text-white rounded-xl text-[11px] font-black disabled:opacity-40 flex items-center justify-center gap-1.5 hover:bg-neutral-700 transition">
                            {notKaydediliyor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Güncelle
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">{n.metin}</p>
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-neutral-100">
                          <p className="text-[9px] font-bold text-neutral-400">
                            {n.kullanici} • {tarihSaat(n.tarih)}
                            {n.duzenlendi && <span className="ml-1 text-neutral-500">(düzenlendi)</span>}
                          </p>
                          <span className="flex gap-1.5 shrink-0">
                            <button type="button" onClick={() => { setDuzenleIndex(i); setDuzenleMetin(n.metin); }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100 transition">
                              <Edit className="w-3 h-3" /> Düzenle
                            </button>
                            {/* YENİ: not penceresinde de Kaldır — onayı tarayıcı sorar */}
                            <button type="button" onClick={async () => { if (window.confirm('Bu not kaldırılsın mı?')) { await onNotSil(notKaydi, i); } }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-white text-red-500 border border-red-200 hover:bg-red-50 transition">
                              <Trash2 className="w-3 h-3" /> Kaldır
                            </button>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-neutral-200 shrink-0">
            <button onClick={notPenceresiKapat} className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl text-sm transition">Kapat</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// YENİ (kullanıcı talebi): Havuzdaki "Tüm Hesaplar / Tüm Satışçılar / Ara / Senkronize Et /
// Hesaplar / Yeni Kayıt" satırı şimdilik gizli. Geri açmak için true yapın.
const HAVUZ_ARAC_CUBUGU_GORUNUR = false;

export const MusteriHavuzuView = ({ currentUser, personnelList = [], addSystemLog, setViewingImage,
  // YENİ (kullanıcı talebi): "Teklife Bak" penceresindeki "Kayıt Aç" butonu.
  // App.jsx'ten gelir; hizmet tipine göre doğru kayıt sekmesini açar ve
  // müşteri ad/telefonunu forma doldurur. Yetkisi yoksa null gelir → buton çizilmez.
  onKayitAc = null,
  // YENİ (kullanıcı talebi): Müşteri geçmişi eşleştirmesi için App.jsx'teki iş
  // kayıtları. Bellekteki liste kullanılır — ek Firestore okuması yapılmaz.
  jobs = [],
  // YENİ (kullanıcı talebi): kenar çubuğundaki "+" kısayolundan gelen istek
  // { hizmet: 'Nakliye' | 'Depo', no } → Telefon Teklifleri açılır ve sihirbaz başlar
  hizliGorusme = null, onHizliGorusmeKullanildi,
  // YENİ (kullanıcı talebi): satış personelinin "Portföyüm" butonu → Telefon Görüşmesi sekmesi açılır
  telefonPortfoyIstegi = null, onTelefonPortfoyKullanildi }) => {
  // ---------------------------------------------------------------- STATE ---
  // DEĞİŞTİ (kullanıcı talebi): Havuz açılınca ilk sekme artık "Hızlı Teklifler" ('web')
  const [aktifKanal, setAktifKanal] = useState('web');
  const [kayitlar, setKayitlar] = useState([]);       // Tüm kanalların kayıtları (canlı)
  const [hesaplar, setHesaplar] = useState([]);       // Bağlı hesaplar (canlı)
  const [durumFiltre, setDurumFiltre] = useState('Tümü');
  const [hizmetFiltre, setHizmetFiltre] = useState('Tümü');
  // YENİ: Zaman filtresi — varsayılan "Tüm Zamanlar" (sekme değişince sıfırlanmaz)
  const [zamanFiltre, setZamanFiltre] = useState('Tüm Zamanlar');
  const [hesapFiltre, setHesapFiltre] = useState('Tümü');
  // YENİ (kullanıcı talebi): Kaynak filtresi — 'Tümü' | KAYNAK_FILTRELERI id'si
  const [kaynakFiltre, setKaynakFiltre] = useState('Tümü');
  // Hangi şirketin verisini görüyoruz: "sembolevdeneve" | "depoevim". Sadece
  // depoevim'den gelen kayıtlarda hesapId==='depoevim' işaretli olduğu için,
  // geri kalan HER ŞEY (gerçek telefon/whatsapp hesapları, Instagram, Gmail,
  // eski web kayıtları) otomatik olarak "sembolevdeneve" sayılır.
  // DEĞİŞTİ (kullanıcı talebi): SAĞ ÜSTTEKİ "SEMBOL / DEPOEVİM" AYRIMI KALDIRILDI.
  // Tüm talepler tek havuzda görünür; ayrım içeride Hizmet filtresi (Nakliye /
  // Depo / Asansör) ve satır renkleriyle yapılır. Sabit 'tumu' değeri, bu
  // değişkeni kullanan alt bileşenlere (HizliTekliflerTablosu) aynen iletilir.
  const siteSecimi = 'tumu';
  // YENİ: QR Takip artık her site için ayrı düğmeyle açılır — hangi site açık?
  const [qrTakipSite, setQrTakipSite] = useState('sembolevdeneve');
  // YENİ (kullanıcı talebi): Sahiplik filtresi — 'Tümü' | '__ben' | '__yok' | satışçı adı
  const [sahipFiltre, setSahipFiltre] = useState('Tümü');
  // YENİ (kullanıcı talebi): Personel transfer penceresi açık olan kayıt
  const [transferKayit, setTransferKayit] = useState(null);
  // YENİ (kullanıcı talebi): Havuz kaydından "Görüşme Formu" açılırken ön doldurma verisi
  const [telefonOnDoldur, setTelefonOnDoldur] = useState(null);
  // YENİ (kullanıcı talebi): Hızlı Teklifler artık HAVUZ mantığında — yalnızca kimsenin
  // almadığı talepler listelenir. Bu anahtar açılırsa alınmış olanlar da gösterilir.
  const [alinanlariGoster, setAlinanlariGoster] = useState(false);
  const [aktariliyor, setAktariliyor] = useState(false);   // Telefon Görüşmesi'ne aktarım sürüyor
  // YENİ (kullanıcı talebi): "Diğer Kanallar" grubu varsayılan kapalı, düğmeyle açılır
  const [digerAcik, setDigerAcik] = useState(false);
  // YENİ (kullanıcı talebi): Fiyat Tablosu penceresi + canlı fiyat dinleyicisi
  const [fiyatTablosuAcik, setFiyatTablosuAcik] = useState(false);
  const [hizliFiyatAcik, setHizliFiyatAcik] = useState(false); // YENİ (kullanıcı talebi): Hızlı Fiyat Hesapla penceresi
  const fiyatBilgi = useFiyatTablosu(true);
  // YENİ: havuzdan "Görüşmeye Bak" ile açılacak telefon görüşmesi
  const [telefonDetayId, setTelefonDetayId] = useState(null);

  // YENİ: "+" kısayolu → boş görüşme formu seçilen hizmetle açılır. İstek kullanılınca
  // App.jsx'te temizlenir; böylece havuza sonradan normal girişte form tekrar açılmaz.
  useEffect(() => {
    if (!hizliGorusme) return;
    setTelefonOnDoldur(ttBosForm(hizliGorusme.hizmet === 'Depo' ? 'Depo' : 'Nakliye'));
    setTelefonTeklifAcik(true);
    onHizliGorusmeKullanildi?.();
  }, [hizliGorusme]); // eslint-disable-line react-hooks/exhaustive-deps

  // YENİ: "Portföyüm" isteği → Telefon Görüşmesi (kişiye özel alan) sekmesi
  useEffect(() => {
    if (!telefonPortfoyIstegi) return;
    setTelefonTeklifAcik(true);
    onTelefonPortfoyKullanildi?.();
  }, [telefonPortfoyIstegi]); // eslint-disable-line react-hooks/exhaustive-deps
  // ======================================================================
  // YENİ (kullanıcı talebi): QR TAKİP — site seçicinin altındaki düğme ile
  // açılan sayfa. Kampanyalar ve taramalar burada dinlenir ki Havuz
  // listesindeki kaynak rozeti ("34 NAR 385 QR") ve otomatik eşleştirme QR
  // sayfası açılmadan da çalışsın.
  // ======================================================================
  const [qrTakipAcik, setQrTakipAcik] = useState(false);
  // YENİ (kullanıcı talebi): Kaynak istatistik paneli varsayılan KAPALI; "İstatistikleri Gör" ile açılır
  const [istatistikAcik, setIstatistikAcik] = useState(false);
  // YENİ (kullanıcı talebi): TELEFON TEKLİFLERİ — ayrı sayfa (QR Takip gibi havuzun yerine açılır).
  // Veri burada TEK KEZ dinlenir; hem giriş butonu hem sayfa aynı listeyi kullanır.
  // DEĞİŞTİ (kullanıcı talebi): Müşteri Havuzu açılınca ilk olarak Telefon Görüşmesi seçili gelir
  const [telefonTeklifAcik, setTelefonTeklifAcik] = useState(true);
  // YENİ (kullanıcı talebi): Telefon Görüşmesi istatistik kutuları başlıktaki düğmeyle açılır
  const [gorusmeIstatAcik, setGorusmeIstatAcik] = useState(false);
  const telefonTeklifleri = useTelefonTeklifleri(true);
  const qrKampanyalariSembol = useQrKampanyalari('sembolevdeneve', true);
  const qrKampanyalariDepoevim = useQrKampanyalari('depoevim', true);
  const qrTumKampanyalar = useMemo(() => [...qrKampanyalariSembol, ...qrKampanyalariDepoevim], [qrKampanyalariSembol, qrKampanyalariDepoevim]);
  const qrTaramalari = useQrTaramalari(45, true);
  const [arama, setArama] = useState('');
  const [detayKayit, setDetayKayit] = useState(null); // Detay/hareket penceresi
  const [detayFotoGoster, setDetayFotoGoster] = useState(null); // Detay penceresinde açılan fotoğraf (yan panel)
  const [notMetni, setNotMetni] = useState('');
  // YENİ: Detay penceresindeki "Hazır Şablonlar" listesi açık mı?
  const [sablonlarAcik, setSablonlarAcik] = useState(false);
  // YENİ (kullanıcı talebi): Kaydet sonrası açılan "Görüşme durumu nedir?" penceresi
  const [gorusmeDurumuKayit, setGorusmeDurumuKayit] = useState(null);   // sorulacak kayıt
  const [gorusmeDurumuKaydediliyor, setGorusmeDurumuKaydediliyor] = useState(false);
  // YENİ (kullanıcı talebi): Başlıkta ad/telefon düzenleme modu (eski eşleştirme kartının yerine)
  const [baslikDuzenle, setBaslikDuzenle] = useState(false);
  // YENİ (kullanıcı talebi): detay penceresinde not düzenleme / kaldırma
  const [detayNotDuzenle, setDetayNotDuzenle] = useState(null);   // Düzenlenen notun gerçek sırası
  const [detayNotMetin, setDetayNotMetin] = useState('');          // Düzenlenen notun yeni metni
  const [detayNotSil, setDetayNotSil] = useState(null);            // Kaldırma onayı bekleyen notun sırası
  const [yeniKayitAcik, setYeniKayitAcik] = useState(false);
  const [hesapYonetimAcik, setHesapYonetimAcik] = useState(false);
  const [yeniHesap, setYeniHesap] = useState({ etiket: '', deger: '', apiAnahtari: '' });
  const [senkronDurum, setSenkronDurum] = useState(''); // '', 'yukleniyor', mesaj
  const [silinecekId, setSilinecekId] = useState(null);

  // YENİ: Müşteri eşleştirme için state'ler
  const [duzenleIletisim, setDuzenleIletisim] = useState('');
  const [duzenleMusteriAdi, setDuzenleMusteriAdi] = useState('');

  const bosYeniKayit = { musteriAdi: '', iletisim: '', hesapId: '', hizmetTipi: 'Nakliye', sonMesaj: '' };
  const [yeniKayit, setYeniKayit] = useState(bosYeniKayit);

  const kanal = KANALLAR.find(k => k.id === aktifKanal);
  const renk = KANAL_RENK[kanal.renk];
  const kullaniciAdi = currentUser?.fullName || 'Sistem';

  // ==========================================================================
  // YENİ (kullanıcı talebi): KİM NEYİ GÖRÜR?
  // --------------------------------------------------------------------------
  //  • Kimseye atanmamış (YENİ) talepler → HERKES görür.
  //  • Bir satışçı talebi aldıysa (Kaydet ile atanan = o kişi) → yalnızca
  //    o satışçı ve tam yetkililer görür.
  //  • Tam yetki (Firma Sahibi / Yönetici / Müdür / düzenleme yetkisi —
  //    "Sil" yetkisiyle aynı kural) → her şeyi görür.
  // NOT: Bu bir arayüz kuralıdır; kalıcı güvenlik için Firestore kurallarında
  // da benzer kısıt tanımlanmalıdır.
  // ==========================================================================
  const tamYetki = havuzKaydiSilebilirMi(currentUser);
  const gorunurMu = (k) => tamYetki || !k.atanan || k.atanan === kullaniciAdi;
  const sahipUyar = (k) => sahipFiltre === 'Tümü'
    || (sahipFiltre === '__ben' ? k.atanan === kullaniciAdi : sahipFiltre === '__yok' ? !k.atanan : k.atanan === sahipFiltre);

  // ------------------------------------------------------- CANLI VERİLER ---
  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setKayitlar(list);
    });
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'havuzHesaplari'), snap => {
      setHesaplar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // YENİ: Bu kullanıcının görebildiği havuz kayıtları — liste, sayaç ve istatistikler buradan hesaplanır
  const gorunurKayitlar = useMemo(() => kayitlar.filter(gorunurMu), [kayitlar, tamYetki, kullaniciAdi]); // eslint-disable-line react-hooks/exhaustive-deps
  // YENİ: Telefon teklifleri — satışçı kendi görüşmelerini, yönetici hepsini görür
  // DEĞİŞTİ (kullanıcı talebi): telefon görüşmelerinde "herkesi görme" yalnızca müdür rütbesinde
  const telefonMudurMu = ttMudurMu(currentUser);
  const gorunurTelefonTeklifleri = useMemo(() => telefonTeklifleri.filter(t => ttGorunurMu(t, kullaniciAdi, telefonMudurMu)), [telefonTeklifleri, kullaniciAdi, telefonMudurMu]);
  // YENİ (kullanıcı talebi): MÜŞTERİ GEÇMİŞİ — telefon numarasıyla (0'lı/0'sız,
  // boşluklu yazımlar aynı sayılır) iş kayıtları + havuz + telefon teklifleri
  // eşleştirilir. Görünürlükten bağımsız TÜM kayıtlar taranır ki "bu müşteriyle
  // daha önce konuşuldu" bilgisi kaçmasın.
  const gecmisIndeksi = useMemo(() => musteriGecmisiIndeksle(jobs, kayitlar, telefonTeklifleri), [jobs, kayitlar, telefonTeklifleri]);
  const havuzGecmisi = (k) => {
    const g = musteriGecmisiBul(gecmisIndeksi, k.iletisim, k.id);
    if (!g) return null;
    // DEĞİŞTİ (kullanıcı talebi): bu talepten açılmış telefon görüşmesi "geçmiş" sayılmaz
    const telefon = g.telefon.filter(t => t.havuzKayitId !== k.id && t.id !== k.telefonTeklifId);
    const s = { ...g, telefon, toplam: g.isler.length + g.havuz.length + telefon.length };
    return s.toplam ? s : null;
  };

  // ------------------------------------------------------- YARDIMCILAR ---
  const hareketliGuncelle = async (kayit, degisiklik, islemMetni) => {
    const hareket = { tarih: new Date().toISOString(), kullanici: kullaniciAdi, islem: islemMetni };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', kayit.id), {
      ...degisiklik,
      hareketler: [...(kayit.hareketler || []), hareket],
    });
    setDetayKayit(prev => prev && prev.id === kayit.id ? { ...prev, ...degisiklik, hareketler: [...(prev.hareketler || []), hareket] } : prev);
  };

  const handleDurumDegistir = async (kayit, yeniDurum) => {
    if (kayit.durum === yeniDurum) return;
    await hareketliGuncelle(kayit, { durum: yeniDurum }, `Durum "${kayit.durum || 'Yeni'}" → "${yeniDurum}" olarak değiştirildi`);
    addSystemLog?.('Müşteri Havuzu', `${kayit.musteriAdi || kayit.iletisim}: durum "${yeniDurum}" yapıldı.`);
  };

  const handleAta = async (kayit, isim) => {
    await hareketliGuncelle(kayit, { atanan: isim }, isim ? `Kayıt ${isim} adlı satışçıya atandı` : 'Atama kaldırıldı');
  };

  // YENİ (kullanıcı talebi): PERSONEL TRANSFERİ — "ben ilgilendim, devam
  // edemeyeceğim" durumunda kayıt başka satışçıya devredilir; o artık görür.
  const handleTransfer = async (kayit, yeniSahip, transferNotu) => {
    const canli = kayitlar.find(x => x.id === kayit.id) || kayit;
    const degisiklik = { atanan: yeniSahip };
    if (transferNotu) degisiklik.notlar = [...(canli.notlar || []), { tarih: new Date().toISOString(), kullanici: kullaniciAdi, metin: `[Transfer notu → ${yeniSahip}] ${transferNotu}` }];
    await hareketliGuncelle(canli, degisiklik, `Transfer: ${canli.atanan || 'Atanmadı'} → ${yeniSahip}`);
    addSystemLog?.('Müşteri Havuzu', `${canli.musteriAdi || canli.iletisim} ${yeniSahip} adlı personele transfer edildi.`);
    setTransferKayit(null);
    // Başkasına devreden satışçı kaydı artık göremez → pencere kapanır
    if (!tamYetki && yeniSahip !== kullaniciAdi) setDetayKayit(null);
  };

  // YENİ: Havuz talebinden açılan telefon görüşme formu kaydedilince talebe işlenir;
  // talep kimseye atanmamışsa formu dolduran satışçıya atanır.
  const havuzKaydinaIsle = async (kayitId, metin) => {
    const canli = kayitlar.find(x => x.id === kayitId);
    if (!canli) return;
    const degisiklik = canli.atanan ? {} : { atanan: kullaniciAdi };
    await hareketliGuncelle(canli, degisiklik, `${metin}${degisiklik.atanan ? ` • ${kullaniciAdi} adlı satışçıya atandı` : ''}`);
  };

  // ==========================================================================
  // YENİ (kullanıcı talebi): HAVUZDAN TELEFON TEKLİFLERİ'NE AKTAR
  // --------------------------------------------------------------------------
  // "Kaydet" veya "Fiyat Hesapla"ya basıldığı an talep satışçının KENDİ
  // Telefon Teklifleri sayfasına geçer:
  //   • Web formundaki cevaplarla dolu bir telefon teklifi oluşturulur
  //     (daha önce oluşturulduysa aynısı kullanılır — mükerrer olmaz),
  //   • havuz kaydı satışçıya atanır ve telefonTeklifId ile bağlanır,
  //   • böylece talep Hızlı Teklifler havuzundan düşer.
  // bekleyenNot: detay penceresinde yazılıp eklenmemiş not (kaybolmasın diye)
  // ==========================================================================
  const havuzuTelefonaAktar = async (kayit, bekleyenNot = '') => {
    const canli = kayitlar.find(x => x.id === kayit.id) || kayit;
    const notlar = bekleyenNot
      ? [...(canli.notlar || []), { tarih: new Date().toISOString(), kullanici: kullaniciAdi, metin: bekleyenNot }]
      : (canli.notlar || []);
    let teklif = canli.telefonTeklifId ? telefonTeklifleri.find(t => t.id === canli.telefonTeklifId) : null;
    // YENİ: sabit belge kimliği — aynı talep iki kez (iki kişi aynı anda) aktarılsa bile tek kayıt olur
    const sabitId = ttHavuzTeklifId(canli.id);
    if (!teklif) teklif = telefonTeklifleri.find(t => t.id === sabitId) || null;
    if (!teklif) {
      const var_ = await getDoc(ttBelge(sabitId));
      if (var_.exists()) teklif = { id: sabitId, ...var_.data() };
    }
    if (!teklif) {
      // DEĞİŞTİ (kullanıcı talebi): teklif BASAN KULLANICIYA atanır
      const veri = ttHavuzdanTeklifVerisi({ ...canli, notlar, atanan: kullaniciAdi }, kullaniciAdi);
      await setDoc(ttBelge(sabitId), veri);
      teklif = { id: sabitId, ...veri };
      addSystemLog?.('Müşteri Havuzu', `${canli.musteriAdi || canli.iletisim} Telefon Görüşmesi'ne aktarıldı (${kullaniciAdi}).`);
    } else if (ttSahibi(teklif) !== kullaniciAdi) {
      // Görüşme daha önce başkasındaysa basan kullanıcı devralır (kullanıcı talebi)
      await updateDoc(ttBelge(teklif.id), { atanan: kullaniciAdi, updatedAt: new Date().toISOString(),
        hareketler: [...(teklif.hareketler || []), { tarih: new Date().toISOString(), kullanici: kullaniciAdi, islem: `Devralındı: ${ttSahibi(teklif) || 'Atanmadı'} → ${kullaniciAdi} (havuzdan)` }] });
      teklif = { ...teklif, atanan: kullaniciAdi };
    }
    // DEĞİŞTİ (kullanıcı talebi): havuz kaydı da her durumda basan kullanıcıya atanır
    const degisiklik = { telefonTeklifId: teklif.id };
    if (canli.atanan !== kullaniciAdi) degisiklik.atanan = kullaniciAdi;
    if (bekleyenNot) degisiklik.notlar = notlar;
    await hareketliGuncelle(canli, degisiklik,
      `Telefon Görüşmesi'ne aktarıldı${degisiklik.atanan ? ` • ${canli.atanan ? `${canli.atanan} → ` : ''}${kullaniciAdi} adlı satışçıya atandı` : ''}${bekleyenNot ? ` • Not: "${bekleyenNot.slice(0, 60)}"` : ''}`);
    return teklif;
  };

  // ==========================================================================
  // YENİ (kullanıcı talebi): ESKİ TALEPLERİ TELEFON GÖRÜŞMESİ'NE TAŞI (tek seferlik)
  // --------------------------------------------------------------------------
  // Hızlı Teklifler Havuzu artık yalnızca "Yeni" ve kimsenin almadığı
  // talepleri gösterir. Daha önce bir temsilciye atanmış ya da durumu
  // değiştirilmiş eski web talepleri, sahipleriyle birlikte Telefon
  // Görüşmesi'ne otomatik taşınır ("Hızlı Teklif Görüşmesi" etiketiyle).
  // Belge kimliği sabit (havuz_<talepId>) olduğu için birden çok kullanıcı
  // aynı anda açsa bile mükerrer kayıt oluşmaz; zaten taşınmışsa atlanır.
  // Her talep oturum başına yalnızca bir kez denenir.
  // ==========================================================================
  const tasinanlarRef = useRef(new Set());      // Bu oturumda denenen talepler
  const hataliRef = useRef(new Map());          // Aktarılamayanlar → hata mesajı
  const tasimaKilidi = useRef(false);           // Aynı anda tek taşıma döngüsü
  const bagliRef = useRef(true);
  const kayitlarRef = useRef(kayitlar);
  kayitlarRef.current = kayitlar;
  const [tasimaBilgi, setTasimaBilgi] = useState({ yapilan: 0, hata: 0, sonHata: '' });
  useEffect(() => () => { bagliRef.current = false; }, []);
  // Taşınacak mı? Web: temsilcisi olan ya da durumu değişmiş. Diğer kanallar: temsilcisi olan.
  const tasimaAdayi = (k) => !k.telefonTeklifId
    && (k.kanal === 'web' ? (k.atanan || (k.durum || 'Yeni') !== 'Yeni') : !!k.atanan);
  // Sahip: atanan temsilci; yoksa durumu son değiştiren; yoksa son not yazan kişi
  const eskiTalepSahibi = (k) => k.atanan
    || [...(k.hareketler || [])].reverse().find(h => (h.islem || '').startsWith('Durum') && h.kullanici && h.kullanici !== 'API' && h.kullanici !== 'Sistem')?.kullanici
    || [...(k.notlar || [])].reverse().find(n => n.kullanici)?.kullanici || '';
  const eskileriTasi = async () => {
    if (tasimaKilidi.current) return;
    tasimaKilidi.current = true;
    try {
      // DÜZELTME: eskiden her havuz güncellemesinde döngü iptal edilip baştan
      // başlıyordu; artık tek döngü, liste bitene kadar güncel kayıtlarla devam eder.
      for (;;) {
        const adaylar = kayitlarRef.current.filter(k => tasimaAdayi(k) && !tasinanlarRef.current.has(k.id));
        if (!bagliRef.current || adaylar.length === 0) break;
        for (const k of adaylar) {
          if (!bagliRef.current) break;
          tasinanlarRef.current.add(k.id);
          try {
            const id = ttHavuzTeklifId(k.id);
            const mevcut = await getDoc(ttBelge(id));
            if (!mevcut.exists()) {
              const sahip = eskiTalepSahibi(k);
              const veri = ttHavuzdanTeklifVerisi({ ...k, atanan: sahip }, sahip || 'Sistem');
              // DÜZELTME: Firestore "undefined" alanı reddeder → JSON ile temizlenir
              await setDoc(ttBelge(id), JSON.parse(JSON.stringify({ ...veri, atanan: sahip, olusturan: sahip || 'Sistem',
                iletisimTarihi: (k.createdAt || '').slice(0, 10) || veri.iletisimTarihi,   // Talebin geldiği gün
                hareketler: [{ tarih: new Date().toISOString(), kullanici: 'Sistem', islem: `Eski havuz talebi Telefon Görüşmesi'ne taşındı (${sahip || 'sahipsiz'})` }] })));
            }
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', k.id), {
              telefonTeklifId: id,
              hareketler: [...(k.hareketler || []), { tarih: new Date().toISOString(), kullanici: 'Sistem', islem: "Telefon Görüşmesi'ne taşındı (otomatik)" }],
            });
            hataliRef.current.delete(k.id);
            if (bagliRef.current) setTasimaBilgi(b => ({ ...b, yapilan: b.yapilan + 1 }));
          } catch (e) {
            console.error('Eski talep taşınamadı:', k.id, e);
            hataliRef.current.set(k.id, e?.message || String(e));
            if (bagliRef.current) setTasimaBilgi(b => ({ ...b, hata: hataliRef.current.size, sonHata: e?.message || String(e) }));
          }
        }
      }
    } finally { tasimaKilidi.current = false; }
  };
  // Aktarılamayanları yeniden dener (yönetici düğmesi)
  const tasimayiTekrarDene = () => {
    hataliRef.current.forEach((_, id) => tasinanlarRef.current.delete(id));
    hataliRef.current.clear();
    setTasimaBilgi(b => ({ ...b, hata: 0, sonHata: '' }));
    eskileriTasi();
  };
  useEffect(() => { if (kayitlar.some(k => tasimaAdayi(k) && !tasinanlarRef.current.has(k.id))) eskileriTasi(); }, [kayitlar]); // eslint-disable-line react-hooks/exhaustive-deps
  // Havuzdan alınmış mı? (satışçıya atanmış ya da telefon teklifine dönüşmüş)
  // DEĞİŞTİ (kullanıcı talebi): durumu "Yeni" dışındakiler de havuzdan çıkmış sayılır
  const havuzdanAlindiMi = (k) => !!(k.atanan || k.telefonTeklifId || (k.durum || 'Yeni') !== 'Yeni');

  const handleNotEkle = async (kayit) => {
    if (!notMetni.trim()) return;
    const not = { tarih: new Date().toISOString(), kullanici: kullaniciAdi, metin: notMetni.trim() };
    await hareketliGuncelle(kayit, { notlar: [...(kayit.notlar || []), not] }, `Not eklendi: "${notMetni.trim().slice(0, 60)}"`);
    setNotMetni('');
  };

  // YENİ: Hızlı Teklifler tablosundaki satır içi not kutusu için — metni
  // doğrudan parametre olarak alır (detay penceresindeki notMetni state'ine
  // bağlı değildir). Aynı veri yapısına (notlar[] + hareketler[]) yazar.
  const handleHizliNotEkle = async (kayit, metin) => {
    const temiz = (metin || '').trim();
    if (!temiz) return;
    const not = { tarih: new Date().toISOString(), kullanici: kullaniciAdi, metin: temiz };
    await hareketliGuncelle(kayit, { notlar: [...(kayit.notlar || []), not] }, `Not eklendi: "${temiz.slice(0, 60)}"`);
  };

  // YENİ (kullanıcı talebi): NOT SİLME — notu kayıttan kaldırır. Silinen notun
  // metni hareket geçmişine yazılır; böylece "kim, neyi, ne zaman sildi" izi kalır.
  const handleNotSil = async (kayit, index) => {
    const mevcut = kayit.notlar || [];
    if (index < 0 || index >= mevcut.length) return;
    const silinen = mevcut[index];
    await hareketliGuncelle(kayit, { notlar: mevcut.filter((_, i) => i !== index) },
      `Not silindi: "${(silinen?.metin || '').slice(0, 60)}"`);
  };

  // YENİ: Not penceresindeki "Güncelle" — mevcut bir notun metnini değiştirir.
  // Not SİLİNMEZ, üzerine yazılır; kim yazdıysa o bilgi korunur, sadece metin
  // ve "duzenlendi" işareti güncellenir. Değişiklik hareket geçmişine düşer.
  const handleHizliNotGuncelle = async (kayit, index, yeniMetin) => {
    const temiz = (yeniMetin || '').trim();
    const mevcut = kayit.notlar || [];
    if (!temiz || index < 0 || index >= mevcut.length) return;
    const eski = mevcut[index];
    if (eski.metin === temiz) return;   // Değişiklik yoksa yazma yapılmaz
    const yeniNotlar = mevcut.map((n, i) => i === index
      ? { ...n, metin: temiz, duzenlendi: true, duzenlemeTarihi: new Date().toISOString(), duzenleyen: kullaniciAdi }
      : n);
    await hareketliGuncelle(kayit, { notlar: yeniNotlar }, `Not güncellendi: "${temiz.slice(0, 60)}"`);
  };

  const handleHizmetDegistir = async (kayit, tip) => {
    if (kayit.hizmetTipi === tip) return;
    await hareketliGuncelle(kayit, { hizmetTipi: tip }, `Hizmet tipi "${tip}" olarak işaretlendi`);
  };

  const handleMusteriGuncelle = async (kayit) => {
    const yeniAd = duzenleMusteriAdi.trim() || kayit.musteriAdi;
    const yeniNo = duzenleIletisim.trim() || kayit.iletisim;

    if (yeniAd === kayit.musteriAdi && yeniNo === kayit.iletisim) return;

    await hareketliGuncelle(kayit, { musteriAdi: yeniAd, iletisim: yeniNo }, `Müşteri bilgileri eşleştirildi: ${yeniAd} - ${yeniNo}`);
    addSystemLog?.('Müşteri Havuzu', `Web tıklaması gerçek müşteriyle eşleştirildi: ${yeniAd}`);
  };

  const handleYeniKayit = async () => {
    if (!yeniKayit.iletisim.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari'), {
      kanal: aktifKanal,
      musteriAdi: yeniKayit.musteriAdi.trim(),
      iletisim: yeniKayit.iletisim.trim(),
      hesapId: yeniKayit.hesapId,
      hizmetTipi: yeniKayit.hizmetTipi,
      sonMesaj: yeniKayit.sonMesaj.trim(),
      durum: 'Yeni', atanan: '', notlar: [], kaynak: 'manuel',
      hareketler: [{ tarih: new Date().toISOString(), kullanici: kullaniciAdi, islem: 'Kayıt manuel olarak oluşturuldu' }],
      createdAt: new Date().toISOString(),
    });
    addSystemLog?.('Müşteri Havuzu', `${kanal.ad} havuzuna yeni kayıt eklendi: ${yeniKayit.musteriAdi || yeniKayit.iletisim}`);
    setYeniKayit(bosYeniKayit); setYeniKayitAcik(false);
  };

  const handleHesapEkle = async () => {
    if (!yeniHesap.deger.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'havuzHesaplari'), {
      kanal: aktifKanal, etiket: yeniHesap.etiket.trim() || yeniHesap.deger.trim(),
      deger: yeniHesap.deger.trim(),
      apiYolu: HAVUZ_API_UCLARI[aktifKanal] || '',
      apiAnahtari: yeniHesap.apiAnahtari.trim(),
      createdAt: new Date().toISOString(),
    });
    addSystemLog?.('Müşteri Havuzu', `${kanal.ad} için hesap bağlandı: ${yeniHesap.deger.trim()}`);
    setYeniHesap({ etiket: '', deger: '', apiAnahtari: '' });
  };

  const handleSenkron = async () => {
    setSenkronDurum('yukleniyor');
    try {
      const res = await fetch(HAVUZ_API_UCLARI[aktifKanal]);
      if (!res.ok) throw new Error('endpoint');
      const data = await res.json();
      const gelenler = Array.isArray(data?.kayitlar) ? data.kayitlar : [];
      const mevcutlar = new Set(kayitlar.filter(k => k.kanal === aktifKanal).map(k => (k.iletisim || '').toLowerCase()));
      let eklenen = 0;
      for (const g of gelenler) {
        const anahtar = (g.iletisim || '').toLowerCase();
        if (!anahtar || mevcutlar.has(anahtar)) continue;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari'), {
          kanal: aktifKanal, musteriAdi: g.musteriAdi || '', iletisim: g.iletisim,
          hesapId: g.hesapId || '', hizmetTipi: g.hizmetTipi || 'Nakliye',
          sonMesaj: g.sonMesaj || '', durum: 'Yeni', atanan: '', notlar: [], kaynak: 'api',
          hareketler: [{ tarih: new Date().toISOString(), kullanici: 'API', islem: 'Kayıt API senkronuyla alındı' }],
          createdAt: g.createdAt || new Date().toISOString(),
        });
        mevcutlar.add(anahtar); eklenen++;
      }
      setSenkronDurum(`${eklenen} yeni kayıt alındı`);
      if (eklenen > 0) addSystemLog?.('Müşteri Havuzu', `${kanal.ad}: API senkronuyla ${eklenen} yeni kayıt alındı.`);
    } catch (e) {
      setSenkronDurum('API bağlantısı henüz hazır değil — kayıtları manuel ekleyebilirsiniz');
    }
    setTimeout(() => setSenkronDurum(''), 5000);
  };

  // Bir kaydın hangi şirkete ait olduğunu belirler — SADECE depoevim'den
  // gelenler hesapId==='depoevim' taşır, gerisi sembolevdeneve sayılır.
  // ==========================================================================
  // DEĞİŞTİ (kullanıcı talebi): KAYIT HANGİ ŞİRKETTE GÖRÜNÜR?
  // --------------------------------------------------------------------------
  // ESKİSİ: Yalnızca hesabına (hesapId) bakılıyordu. Bu yüzden Sembol
  // sitesinden gelen bir DEPO talebi (örn. Tülay Sezdi) Sembol sekmesinde
  // kalıyordu.
  // YENİSİ: HİZMET TİPİ belirleyicidir —
  //     Depo    → DEPOEVİM sekmesi
  //     Nakliye → SEMBOL sekmesi
  //     Asansör → SEMBOL sekmesi
  // Hizmet tipi "Teklife Bak" penceresinden değiştirilince kayıt otomatik
  // olarak diğer sekmeye taşınır (ayrıca bir işlem gerekmez).
  //
  // Hizmet tipi hiç yazılmamış eski kayıtlarda eski kurala (hesapId) düşülür,
  // böylece geçmiş veri yerinden oynamaz.
  // ==========================================================================
  const kayitSitesi = (k) => {
    const tip = k.hizmetTipi;
    if (tip === 'Depo') return 'depoevim';
    if (tip === 'Nakliye' || tip === 'Asansör') return 'sembolevdeneve';
    return k.hesapId === 'depoevim' ? 'depoevim' : 'sembolevdeneve';
  };

  const kanalHesaplari = hesaplar.filter(h => h.kanal === aktifKanal);
  // ==========================================================================
  // YENİ (kullanıcı talebi): MÜKERRER KAYIT GİZLEME + ŞÜPHELİ İSİM FİLTRESİ
  // --------------------------------------------------------------------------
  // (Hızlı Teklifler sekmesinde) İki iş yapılır, ikisi de yalnızca GÖRÜNÜMDE:
  //   1) Aynı müşterinin mükerrer teklifleri → yalnızca EN YENİSİ gösterilir.
  //   2) Rastgele / anlamsız (spam) isimli kayıtlar → gizlenir.
  // Kayıtlar Firestore'dan SİLİNMEZ, sadece listeden düşer — veri kaybı olmaz.
  // ==========================================================================

  // Türkçe-uyumlu ad anahtarı: büyük/küçük harf VE aksan farklarını yok sayar.
  // Sorun: JS'in varsayılan toLowerCase()'i "SATIRLI" → "satirli", ama
  // "Satırlı" → "satırlı" verir; bu yüzden "YEŞİM SATIRLI" ile "YEŞİM Satırlı"
  // (aynı numara) mükerrer sayılmıyordu. Burada tüm Türkçe harfler ASCII'ye
  // indirgenip küçültülür (ç→c, ğ→g, ı/İ→i, ö→o, ş→s, ü→u), boşluklar
  // sadeleştirilir. Böylece iki yazım da AYNI anahtara iner.
  const adAnahtari = (ad) => (ad || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c').replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  // ŞÜPHELİ / SPAM İSİM TESPİTİ — sadece AÇIKÇA sahte olanları eler; gerçek
  // isimleri (tek/çift kelime, yabancı, aksanlı) korur. Kararsız kalınan
  // hiçbir isim elenmez; amaç gerçek talebi asla kaçırmamaktır.
  const supheliIsim = (ad) => {
    const ham = (ad || '').trim();
    const norm = adAnahtari(ham);
    if (!norm) return true;                                   // boş
    // (a) 2'den az HARF içeriyorsa (".", "E", "1", "--") → spam
    const harfler = norm.replace(/[^a-z]/g, '');
    if (harfler.length < 2) return true;
    // (b) Hiç sesli harf yoksa (klavye ezmesi "sk", "bcd") → spam
    if (!/[aeıioöuü]/.test(ham.toLocaleLowerCase('tr')) && !/[aeiou]/.test(norm)) return true;
    // (c) Tek karakterin tekrarı ("aaaa", "xxxx", "....") → spam
    if (/^(.)\1+$/.test(norm.replace(/\s/g, ''))) return true;
    // (d) Bilinen test/şirket kelimeleri (tam kelime eşleşmesi) → spam
    const karaListe = ['test','deneme','asd','asdf','asdasd','sdf','dsa','sda','qwe','qwer','qwerty','zxc','zxcv','aaa','xxx','sss','abc','ncnc','asdfg','fiyat','random','spam','depoevim','depo evim','sembol','sembol nakliyat'];
    const kelimeler = norm.split(' ');
    if (karaListe.includes(norm) || kelimeler.every(k => karaListe.includes(k))) return true;
    // (e) Herhangi bir kelime 3+ ARDIŞIK sessiz harfle BAŞLIYORSA → spam.
    //     Türkçede (ve neredeyse tüm dillerde) kelime 3 sessizle başlamaz;
    //     "Smsöal" (Sms...) gibi ezmeleri yakalar, gerçek isimleri etkilemez.
    const sessiz = '[bcçdfgğhjklmnprsştvyzqwx]';
    if (kelimeler.some(k => new RegExp(`^${sessiz}{3,}`, 'i').test(k))) return true;
    return false;
  };

  const mukerrerleriGizle = (liste) => {
    const gorulen = new Set();
    return liste.filter(k => {
      // (1) Şüpheli/spam isimli kayıtlar gizlenir
      if (supheliIsim(k.musteriAdi)) return false;
      // (2) Aynı ad + telefondan yalnızca en yenisi kalır
      if (!telefonGecerliMi(k.iletisim)) return true;            // Numarasız kayıt eşleştirilmez
      const anahtar = `${adAnahtari(k.musteriAdi)}|${telefonRakam(k.iletisim)}`;
      if (gorulen.has(anahtar)) return false;                    // Daha yenisi zaten listede
      gorulen.add(anahtar);
      return true;
    });
  };

  // DEĞİŞTİ: zaman filtresi en başta uygulanır; böylece durum sayaçları da
  // (Tümü (20), Yeni (0) ...) seçilen döneme göre hesaplanır.
  // DEĞİŞTİ: Hızlı Teklifler'de mükerrer kayıtlar gizlenir (sayaçlar da tekilleşir).
  // DEĞİŞTİ (kullanıcı talebi): site ayrımı yok; görünürlük + sahiplik filtresi uygulanır
  // DÜZELTME (kullanıcı talebi): Hızlı Teklifler "yeni" sayısı sol menüdeki Satış rozetiyle
  // AYNI kuralla hesaplanır. Rozet önce TÜM web taleplerinde mükerrerleri ayıklar (aynı ad +
  // telefon → yalnızca en yeni talep), SONRA alınmamış "Yeni"leri sayar. Havuz ise önce
  // alınanları çıkarıp sonra ayıklıyordu; bu yüzden müşterinin yeni talebi bir satışçıya
  // geçmişse ESKİ talebi havuzda "yeni" kalıyordu (rozet 13, havuz 31). Artık ikisi aynı.
  const webTekilIdler = useMemo(() => new Set(mukerrerleriGizle(kayitlar.filter(k => k.kanal === 'web')).map(k => k.id)), [kayitlar]); // eslint-disable-line react-hooks/exhaustive-deps
  const kanalKayitlariHam = gorunurKayitlar.filter(k => k.kanal === aktifKanal && sahipUyar(k) && zamanUyar(k, zamanFiltre)
    && (aktifKanal !== 'web' || webTekilIdler.has(k.id))
    // YENİ (kullanıcı talebi): Hızlı Teklifler'de yalnızca kimsenin almadığı talepler
    && (aktifKanal !== 'web' || alinanlariGoster || !havuzdanAlindiMi(k)));
  const kanalKayitlari = aktifKanal === 'web' ? mukerrerleriGizle(kanalKayitlariHam) : kanalKayitlariHam;
  // Kaynak filtresi, kaynak koşulları (OZET_GRUPLARI) aşağıda tanımlandığı için
  // orada uygulanır → "filtreli".
  const filtreliKaynakHaric = kanalKayitlari.filter(k => {
    if (durumFiltre !== 'Tümü' && (k.durum || 'Yeni') !== durumFiltre) return false;
    if (hizmetFiltre !== 'Tümü' && (k.hizmetTipi || 'Nakliye') !== hizmetFiltre) return false;
    if (hesapFiltre !== 'Tümü' && k.hesapId !== hesapFiltre) return false;
    if (arama.trim()) {
      const q = arama.toLowerCase();
      return (k.musteriAdi || '').toLowerCase().includes(q) || (k.iletisim || '').toLowerCase().includes(q) || (k.atanan || '').toLowerCase().includes(q);
    }
    return true;
  });

  const durumSayaclari = { 'Tümü': kanalKayitlari.length };
  DURUMLAR.forEach(d => { durumSayaclari[d.id] = kanalKayitlari.filter(k => (k.durum || 'Yeni') === d.id).length; });

  // ==========================================================================
  // DEĞİŞTİ (kullanıcı talebi): "Atanan Satışçı" listesinde ARTIK SADECE
  // SATIŞ PERSONELİ görünür.
  // --------------------------------------------------------------------------
  // ESKİSİ: Firma Sahibi dışındaki HERKES (şoförler, taşıma elemanları, depo
  // sorumluları...) listeleniyordu; liste onlarca isimle doluyordu.
  // YENİSİ: Yalnızca pozisyonu "Satış Personeli" olanlar gelir.
  //   • normalizePozisyon: "satış destek", "Satis Personeli" gibi eski/hatalı
  //     yazımlar da "Satış Personeli" sayılır (shared.jsx'teki ortak eşleme).
  //   • employmentStatus === 'Pasif' olan (işten ayrılmış) personel listelenmez;
  //     ancak bir kayda ATANMIŞ eski satışçının adı seçili kalmaya devam eder
  //     (aşağıdaki <select>'lerde mevcut değer zaten k.atanan'dan okunur).
  // ==========================================================================
  // YENİ: Havuz kaydını silme yetkisi — "Sil" butonları buna göre çizilir
  const silebilir = havuzKaydiSilebilirMi(currentUser);

  const satiscilar = personnelList.filter(p =>
    normalizePozisyon(p.position) === 'Satış Personeli' && p.employmentStatus !== 'Pasif'
  );
  const hesapAdi = (id) => SITE_ETIKETLERI[id] || kanalHesaplari.find(h => h.id === id)?.etiket || '—';
  const durumRenk = (d) => DURUMLAR.find(x => x.id === (d || 'Yeni'))?.renk || DURUMLAR[0].renk;

  const iletisimLink = (k) => {
    const v = (k.iletisim || '').replace(/\s/g, '');
    if (aktifKanal === 'telefon') return `tel:${v}`;
    // "web" sekmesindeki iletisim alanı da bir TELEFON numarasıdır (web
    // sihirbazlarından gelen "phone" alanı) — buton zaten "Mesaj At" yazıyor,
    // WhatsApp'a gitmesi lazım; mailto: yanlıştı.
    if (aktifKanal === 'whatsapp' || aktifKanal === 'web' || aktifKanal === 'iyzico') return `https://wa.me/${v.replace(/^0/, '90')}`;
    if (aktifKanal === 'instagram') return `https://instagram.com/${v.replace('@', '')}`;
    return `mailto:${v}`;
  };
  const iletisimBtnMetin = aktifKanal === 'telefon' ? 'Ara' : aktifKanal === 'gmail' ? 'Mail At' : 'Mesaj At';

  // YENİ: AKTİF SEÇİLİ KANALA GÖRE GÜNLÜK PERFORMANS İSTATİSTİKLERİ
  // DÜZELTME: eskiden "new Date().toISOString().split('T')[0]" (UTC güne göre)
  // ile karşılaştırılıyordu — bu, gunAnahtari()'nin yukarıda (satır ~3148)
  // TAM OLARAK aynı sebeple düzeltilmiş olan hatayı burada TEKRAR üretiyordu:
  // Türkiye saatiyle gece 00:00–03:00 arası gelen kayıtlar UTC'de hâlâ "dün"
  // sayıldığı için özet kutularından (Google/Facebook/Instagram/Organik
  // toplamı) düşüyor, ama "Hızlı Teklifler" gün ayracı listesi (gunAnahtari
  // kullandığı için) onları doğru şekilde "bugün" gösteriyordu — bu da kutu
  // toplamının listedeki gerçek "bugün" sayısından az çıkmasına yol açıyordu.
  // Artık ikisi de AYNI gunAnahtari() fonksiyonuyla (yerel/Türkiye günü)
  // karşılaştırılıyor, sayılar tutarlı olacak.
  // DEĞİŞTİ (kullanıcı talebi): özet kutuları artık sadece "Bugün" değil,
  // "Bu Ay" ve "Tüm Zamanlar" sayılarını da gösteriyor. Ay karşılaştırması da
  // aynı gunAnahtari() (yerel/Türkiye günü) anahtarının "YYYY-AA" kısmıyla yapılır.
  const aktifKanalTumu = gorunurKayitlar.filter(k => k.kanal === aktifKanal); // DEĞİŞTİ: tüm siteler, görünür kayıtlar
  const bugunAnahtari = gunAnahtari(new Date().toISOString());
  const buAyAnahtari = bugunAnahtari.slice(0, 7);
  const aktifKanalBugun = aktifKanalTumu.filter(k => k.createdAt && gunAnahtari(k.createdAt) === bugunAnahtari);
  const aktifKanalBuAy = aktifKanalTumu.filter(k => k.createdAt && gunAnahtari(k.createdAt).slice(0, 7) === buAyAnahtari);
  // Google Ads / Facebook Ads / Instagram Ads / Organik ayrımı ARTIK doğrudan
  // "reklamKaynagi" alanından okunuyor — bunu hem tıklama bildirimleri
  // (yeni-musteri.js) hem de wizard form gönderimleri (submit-lead.js,
  // gclid/fbclid/utm_source tespiti ile) dolduruyor. Bu alan henüz olmayan
  // ESKİ kayıtlar için (bu düzeltmeden önce oluşmuş), eski metin-tabanlı
  // Google tespitini YEDEK olarak kullanmaya devam ediyoruz (Facebook/
  // Instagram için eski kayıtlarda böyle bir metin izi yok, o yüzden sadece
  // reklamKaynagi alanına bakılıyor).
  // YENİ: QR otomatik eşleştirme (UTM → zaman) — kayıtlar değiştikçe sessizce yazar
  useQrOtomatikEslestirme(kayitlar, qrTumKampanyalar, qrTaramalari, true);
  const reklamKaynagiEsit = (k, deger) => k.reklamKaynagi
    ? k.reklamKaynagi === deger
    : (deger === 'google_ads' && (k.sonMesaj?.includes('Google reklam') || k.musteriAdi?.includes('Google Ads')));
  const reklamKaynagiAds = (k) => reklamKaynagiEsit(k, 'google_ads') || reklamKaynagiEsit(k, 'facebook_ads') || reklamKaynagiEsit(k, 'instagram_ads');
  // Satır rozetinde ve özet kutularında gösterilecek etiket + renk — platforma
  // göre ayrı ayrı. Ali'nin talebi üzerine eskiden tek "Organik" kovası olan
  // kısım artık 6 alt kategoriye ayrılıyor: Facebook Organik / Instagram
  // Organik / Google Anasayfa / Google Altsayfa / Direkt Giriş / Diğer Site
  // (site-tiklama-takip-*.txt + wizard'ların document.referrer +
  // location.pathname'den hesapladığı değer — bkz. reklamKaynagi alanı).
  // GÜNCELLEME (2026-09): facebook_organik/instagram_organik eklendi, "direkt"
  // anahtarı "direkt_giris" olarak yeniden adlandırıldı (submit-lead.js /
  // yeni-musteri.js / wizard'lardaki isimlendirmeyle BİREBİR aynı olsun diye).
  // Google organik aramada ARANAN KELİME teknik olarak hiçbir zaman bilinemez
  // (Google 2011'den beri bunu paylaşmıyor) — bu yüzden ayrım "hangi sayfaya
  // düşüldü"ne göre, "ne arandı"na göre DEĞİL.
  const REKLAM_KAYNAGI_ETIKETLERI = {
    google_ads: { ad: 'Google Ads', renk: 'bg-green-100 text-green-700' },
    facebook_ads: { ad: 'Facebook Ads', renk: 'bg-blue-100 text-blue-700' },
    facebook_organik: { ad: 'Facebook Organik', renk: 'bg-indigo-100 text-indigo-700' },
    instagram_ads: { ad: 'Instagram Ads', renk: 'bg-pink-100 text-pink-700' },
    instagram_organik: { ad: 'Instagram Organik', renk: 'bg-rose-100 text-rose-700' },
    google_anasayfa: { ad: 'Google Anasayfa', renk: 'bg-yellow-100 text-yellow-700' },
    google_altsayfa: { ad: 'Google Altsayfa', renk: 'bg-orange-100 text-orange-700' },
    direkt_giris: { ad: 'Direkt Giriş', renk: 'bg-neutral-100 text-neutral-600' },
    diger_site: { ad: 'Diğer Site', renk: 'bg-purple-100 text-purple-700' },
    // YENİ: ChatGPT Reklam / ChatGPT Organik / Gemini Organik … (src/aiKaynakSema.js)
    ...AI_KAYNAK_ETIKETLERI,
  };
  const reklamKaynagiEtiket = (k) => {
    // YENİ (kullanıcı talebi): QR'dan gelen form "Organik" değil, QR adıyla görünür
    // DEĞİŞTİ (kullanıcı talebi): "(olası)" yazılmaz — QR'dan gelen form "34 NAR 385 (QR)" gibi görünür
    // NOT: QR eşleşmesi, bu kaydın reklamKaynagi'sinden (organik/direkt/google
    // anasayfa vb.) BAĞIMSIZ ayrıca hesaplanan bir alan — bu yüzden en üstte,
    // ödemeli reklam kontrolünden bile ÖNCE gösteriliyor (bir kayıt normalde
    // hem QR hem de Google Ads olamaz, ama QR eşleşmesi varsa asıl kaynak odur).
    if (k.qrKampanyaId && k.qrKampanyaAd) return { ad: `${k.qrKampanyaAd} (QR)`, renk: 'bg-amber-100 text-amber-800 border border-amber-300' };
    if (reklamKaynagiEsit(k, 'google_ads')) return REKLAM_KAYNAGI_ETIKETLERI.google_ads;
    if (reklamKaynagiEsit(k, 'facebook_ads')) return REKLAM_KAYNAGI_ETIKETLERI.facebook_ads;
    if (reklamKaynagiEsit(k, 'facebook_organik')) return REKLAM_KAYNAGI_ETIKETLERI.facebook_organik;
    if (reklamKaynagiEsit(k, 'instagram_ads')) return REKLAM_KAYNAGI_ETIKETLERI.instagram_ads;
    if (reklamKaynagiEsit(k, 'instagram_organik')) return REKLAM_KAYNAGI_ETIKETLERI.instagram_organik;
    if (reklamKaynagiEsit(k, 'google_anasayfa')) return REKLAM_KAYNAGI_ETIKETLERI.google_anasayfa;
    if (reklamKaynagiEsit(k, 'google_altsayfa')) return REKLAM_KAYNAGI_ETIKETLERI.google_altsayfa;
    if (reklamKaynagiEsit(k, 'direkt_giris')) return REKLAM_KAYNAGI_ETIKETLERI.direkt_giris;
    if (reklamKaynagiEsit(k, 'diger_site')) return REKLAM_KAYNAGI_ETIKETLERI.diger_site;
    if (aiKaynakMi(k.reklamKaynagi)) return REKLAM_KAYNAGI_ETIKETLERI[k.reklamKaynagi];
    // DÜZELTME: QR'dan geldiği kesin ama henüz bir kampanyaya bağlanamamış kayıt
    // (ör. kampanya sonradan silinmiş/kodu değişmiş) "Organik" DEĞİL, QR görünür.
    if (!k.qrEslesmeYok && reklamKaynagiEsit(k, 'qr')) return { ad: `QR${k.qrKodu ? ` (${k.qrKodu})` : ''}`, renk: 'bg-amber-50 text-amber-700 border border-amber-200' };
    // HATA DÜZELTMESİ DEĞİL, BİLİNÇLİ AYRIM: reklamKaynagi alanı hiç yok ya da
    // bu yeni ayrıştırılmış kategorilerden ÖNCE (site-tiklama-takip scriptleri
    // güncellenmeden önce) oluşmuş bir kayıt. Bunu yanlışlıkla "Direkt Giriş"
    // sayıp yeni, kesin verilerle karıştırmamak için ayrı, nötr bir etiket.
    return { ad: 'Organik (Eski Kayıt)', renk: 'bg-neutral-100 text-neutral-500' };
  };
  // "Organik (Eski Kayıt)" kovasına düşen kayıt mı? (Reklam değil, QR eşleşmesi
  // yok, VE yeni kategorilerden hiçbirine de uymuyor.)
  const reklamKaynagiEskiKayit = (k) => !reklamKaynagiAds(k)
    && !k.qrKampanyaId
    && !reklamKaynagiEsit(k, 'qr')
    && !reklamKaynagiEsit(k, 'facebook_organik')
    && !reklamKaynagiEsit(k, 'instagram_organik')
    && !reklamKaynagiEsit(k, 'google_anasayfa')
    && !reklamKaynagiEsit(k, 'google_altsayfa')
    && !reklamKaynagiEsit(k, 'direkt_giris')
    && !reklamKaynagiEsit(k, 'diger_site')
    && !aiKaynakMi(k.reklamKaynagi);
  // Her kaynak için { bugun, buAy, tumu } sayıları
  const kaynakSayilari = (kosul) => ({
    bugun: aktifKanalBugun.filter(kosul).length,
    buAy: aktifKanalBuAy.filter(kosul).length,
    tumu: aktifKanalTumu.filter(kosul).length,
  });
  // DEĞİŞTİ (kullanıcı talebi): Özet kutuları PLATFORMA GÖRE GRUPLANDI — her
  // grup tek bir kart: solda platform logosu, sağda alt kategori hücreleri
  // (ör. Google → Ads | Anasayfa | Altsayfa). Sayım koşulları eskisiyle aynı;
  // QR eşleşmesi olan kayıtlar yalnızca QR grubunda sayılır.
  const qrDegil = (deger) => (k) => !k.qrKampanyaId && reklamKaynagiEsit(k, deger);
  // DEĞİŞTİ: logo artık (boyutSinifi) => JSX fonksiyonu; panel logoyu büyük çizebilsin diye
  // DEĞİŞTİ: her hücre sayım koşulunu ("kosul") da taşır — aynı koşul aşağıdaki
  // Kaynak filtresinde kullanılır, sayılar ile filtre hiçbir zaman ayrışmaz.
  const OZET_GRUPLARI = [
    { ad: 'Google', logo: (c) => <GoogleLogo className={c} />, kenar: 'border-yellow-400/40', hucreler: [
      { ad: 'Ads', renk: 'text-green-400', kosul: k => reklamKaynagiEsit(k, 'google_ads') },
      { ad: 'Ana Sayfa', renk: 'text-yellow-400', kosul: qrDegil('google_anasayfa') },
      { ad: 'Alt Sayfa', renk: 'text-orange-400', kosul: qrDegil('google_altsayfa') },
    ] },
    { ad: 'Facebook', logo: (c) => <FacebookLogo className={c} />, kenar: 'border-sky-400/40', hucreler: [
      { ad: 'Ads', renk: 'text-sky-400', kosul: k => reklamKaynagiEsit(k, 'facebook_ads') },
      { ad: 'Organik', renk: 'text-indigo-300', kosul: qrDegil('facebook_organik') },
    ] },
    { ad: 'Instagram', logo: (c) => <InstagramLogo className={c} />, kenar: 'border-pink-400/40', hucreler: [
      { ad: 'Ads', renk: 'text-pink-400', kosul: k => reklamKaynagiEsit(k, 'instagram_ads') },
      { ad: 'Organik', renk: 'text-rose-300', kosul: qrDegil('instagram_organik') },
    ] },
    { ad: 'QR', logo: (c) => <QrCode className={`${c} text-amber-400`} />, kenar: 'border-amber-400/40', hucreler: [
      { ad: 'QR Takip', renk: 'text-amber-400', kosul: k => !!k.qrKampanyaId || (!k.qrEslesmeYok && reklamKaynagiEsit(k, 'qr')) },
    ] },
    { ad: 'Diğer', logo: (c) => <Globe className={`${c} text-neutral-300`} />, kenar: 'border-white/20', hucreler: [
      { ad: 'Direkt Giriş', renk: 'text-neutral-300', kosul: qrDegil('direkt_giris') },
      { ad: 'Diğer Site', renk: 'text-purple-400', kosul: qrDegil('diger_site') },
      { ad: 'Eski Kayıt', renk: 'text-neutral-500', kosul: k => reklamKaynagiEskiKayit(k) },
    ] },
    // YENİ: YAPAY ZEKA — kutular src/aiKaynakSema.js tablosundan üretilir (yeni
    // platform/reklam eklenince kutu kendiliğinden çıkar). Reklam kutuları diğer
    // "Ads" hücreleri gibi QR eşleşmesinden bağımsız sayılır.
    { ad: 'Yapay Zeka', logo: (c) => <Sparkles className={`${c} text-fuchsia-300`} />, kenar: 'border-fuchsia-400/40', genis: true,
      hucreler: AI_ISTATISTIK_KUTULARI.map(x => ({ ad: x.ad, renk: x.renk, kosul: x.reklam ? (k => reklamKaynagiEsit(k, x.kod)) : qrDegil(x.kod) })) },
  ].map(g => ({ ...g, hucreler: g.hucreler.map(h => ({ ...h, sayilar: kaynakSayilari(h.kosul) })) }));

  // YENİ (kullanıcı talebi): KAYNAK FİLTRESİ — seçenekler istatistik gruplarından
  // üretilir: "Google (Tümü)", "Google · Ads", … "Yapay Zeka · ChatGPT Ads".
  const KAYNAK_FILTRELERI = OZET_GRUPLARI.flatMap(g => [
    ...(g.hucreler.length > 1 ? [{ id: `${g.ad}::*`, grup: g.ad, ad: `${g.ad} (Tümü)`, kosul: k => g.hucreler.some(h => h.kosul(k)) }] : []),
    ...g.hucreler.map(h => ({ id: `${g.ad}::${h.ad}`, grup: g.ad, ad: g.hucreler.length > 1 ? `${g.ad} · ${h.ad}` : h.ad, kosul: h.kosul })),
  ]);
  const seciliKaynakFiltresi = KAYNAK_FILTRELERI.find(f => f.id === kaynakFiltre);
  const filtreli = seciliKaynakFiltresi ? filtreliKaynakHaric.filter(seciliKaynakFiltresi.kosul) : filtreliKaynakHaric;

  // ================================================================ RENDER ===
  // YENİ (kullanıcı talebi): QR Takip sayfası — seçili site için, havuzun yerine
  // YENİ (kullanıcı talebi): Telefon Teklifleri sayfası — seçili site için, havuzun yerine
  // DEĞİŞTİ (kullanıcı talebi): Telefon Görüşmesi artık AYRI SAYFA DEĞİL — Hızlı
  // Teklifler Havuzu gibi menü butonlarının ALTINDA açılır (aşağıda, render içinde).
  if (qrTakipAcik) {
    return (
      <QrTakipView site={qrTakipSite} kayitlar={kayitlar} kampanyalar={qrTakipSite === 'depoevim' ? qrKampanyalariDepoevim : qrKampanyalariSembol}
        taramalar={qrTaramalari} currentUser={currentUser} addSystemLog={addSystemLog} onGeri={() => setQrTakipAcik(false)} />
    );
  }
  return (
    <div className="max-w-7xl mx-auto animate-in fade-in space-y-4">

      {/* BAŞLIK */}
      {/* DEĞİŞTİ (kullanıcı talebi): başlık alanı ~%20 küçültüldü (iç boşluk, yazı ve buton boyutları) */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-4 text-white shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-black flex items-center gap-2"><Users className="w-5 h-5 text-yellow-400" /> Müşteri Havuzu</h2>
            <p className="text-neutral-300 text-[11px] md:text-xs mt-0.5">Sembol Nakliyat ve DepoEvim'e gelen tüm talepler tek havuzda.</p>
            {/* YENİ: kullanıcının görünüm kapsamı */}
            <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${tamYetki ? 'bg-yellow-400 text-neutral-900' : 'bg-white/10 text-neutral-200'}`}>
              <Eye className="w-3 h-3" /> {tamYetki ? 'Yönetici görünümü — tüm talepler' : 'Yeni talepler + size atananlar'}
            </span>
          </div>

          {/* KALDIRILDI (kullanıcı talebi): SEMBOL / DEPOEVİM site düğmeleri. Artık tüm
              talepler tek havuzda; QR Takip her site için ayrı düğmeyle açılır. */}
          <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {[
              { site: 'sembolevdeneve', ad: 'Sembol', liste: qrKampanyalariSembol, cls: 'bg-red-600/20 text-red-100 border-red-500/50 hover:bg-red-600/40' },
              { site: 'depoevim', ad: 'Depoevim', liste: qrKampanyalariDepoevim, cls: 'bg-blue-600/20 text-blue-100 border-blue-500/50 hover:bg-blue-600/40' },
            ].map(q => (
              <button key={q.site} type="button" onClick={() => { setQrTakipSite(q.site); setQrTakipAcik(true); }}
                className={`px-3 py-2 rounded-xl text-xs font-black tracking-wide transition flex items-center gap-1.5 border ${q.cls}`}>
                <QrCode className="w-4 h-4" /> QR Takip — {q.ad}
                {q.liste.length > 0 && <span className="ml-0.5 text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded-full">{q.liste.length} QR</span>}
              </button>
            ))}
          </div>
          {/* YENİ (kullanıcı talebi): FİYAT TABLOSU — İstatistikleri Gör'ün solunda */}
          <div className="flex flex-wrap justify-end gap-2">
          {/* YENİ (kullanıcı talebi): HIZLI FİYAT HESAPLA — müşteri bilgisi olmadan fiyat motoru (Fiyat Tablosu'nun solunda) */}
          <button type="button" onClick={() => setHizliFiyatAcik(true)}
            className="px-4 py-2 rounded-xl text-xs font-black tracking-wide transition flex items-center gap-2 border bg-yellow-400 text-black border-yellow-300 hover:bg-yellow-300">
            <Calculator className="w-4 h-4" /> Hızlı Fiyat Hesapla
          </button>
          <button type="button" onClick={() => setFiyatTablosuAcik(true)}
            className="px-4 py-2 rounded-xl text-xs font-black tracking-wide transition flex items-center gap-2 border bg-white/10 text-emerald-100 border-emerald-400/50 hover:bg-white/20">
            <FileText className="w-4 h-4" /> Fiyat Tablosu
          </button>
          {/* YENİ (kullanıcı talebi): GÖRÜŞME İSTATİSTİKLERİ — Telefon Görüşmesi sayaçlarını aç/kapa */}
          <button type="button" onClick={() => { setGorusmeIstatAcik(a => !a); setTelefonTeklifAcik(true); }} aria-expanded={gorusmeIstatAcik}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition flex items-center gap-2 border ${gorusmeIstatAcik ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/10 text-emerald-100 border-emerald-400/50 hover:bg-white/20'}`}>
            <PhoneCall className="w-4 h-4" /> Görüşme İstatistikleri
            <ChevronDown className={`w-4 h-4 transition-transform ${gorusmeIstatAcik ? 'rotate-180' : ''}`} />
          </button>
          {/* YENİ (kullanıcı talebi): İSTATİSTİKLERİ GÖR — kaynak özet panelini açar/kapatır */}
          <button type="button" onClick={() => setIstatistikAcik(a => !a)} aria-expanded={istatistikAcik}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition flex items-center gap-2 border ${istatistikAcik ? 'bg-yellow-400 text-neutral-900 border-yellow-400' : 'bg-white/10 text-yellow-100 border-yellow-400/40 hover:bg-white/20'}`}>
            <TrendingUp className="w-4 h-4" /> {istatistikAcik ? 'İstatistikleri Gizle' : 'İstatistikleri Gör'}
            {/* Ok simgesi panel açıkken yukarı döner */}
            <ChevronDown className={`w-4 h-4 transition-transform ${istatistikAcik ? 'rotate-180' : ''}`} />
          </button>
          </div>
          </div>
        </div>

        {/* DEĞİŞTİ (kullanıcı talebi): ÖZET KUTULARI artık sürekli görünmüyor.
            "İstatistikleri Gör" düğmesiyle açılan, daha büyük KaynakIstatistikPaneli
            bileşeninde gösteriliyor. Sayım mantığı (OZET_GRUPLARI) aynen korundu. */}
        {istatistikAcik && (
          <KaynakIstatistikPaneli gruplar={OZET_GRUPLARI} kanalAd={kanal.ad} onKapat={() => setIstatistikAcik(false)} />
        )}
      </div>

      {/* ====================================================================
          DEĞİŞTİ (kullanıcı talebi): KANAL SEKMELERİ YENİ DÜZEN
          --------------------------------------------------------------------
          1) "Hızlı Teklifler" (web) EN BAŞTA, tek başına geniş bir buton olarak.
             Üzerinde toplam ve yanıp sönen "X yeni" rozeti (Sembol kırmızı,
             Depoevim mavi) bulunur.
          2) Telefon / WhatsApp / Instagram / Gmail (ve DepoEvim'de İyzico)
             "Diğer" başlığı altında toplu durur.
          Sekme tıklama davranışı (filtre sıfırlama vb.) eskisiyle birebir aynı.
          ==================================================================== */}
      {(() => {
        // DEĞİŞTİ: kanal seçilince Telefon Görüşmesi sekmesi kapanır (geçişler tek tık)
        const sekmeSec = (id) => { setTelefonTeklifAcik(false); setAktifKanal(id); setDurumFiltre('Tümü'); setHizmetFiltre('Tümü'); setHesapFiltre('Tümü'); setArama(''); setYeniKayitAcik(false); setHesapYonetimAcik(false); };
        const webKanal = KANALLAR.find(k => k.id === 'web');
        // DEĞİŞTİ (kullanıcı talebi): iki sitenin talepleri birlikte; "yeni" rozetleri ayrı renkte
        const webKayitlari = gorunurKayitlar.filter(x => x.kanal === 'web' && !havuzdanAlindiMi(x) && webTekilIdler.has(x.id)); // YENİ: yalnızca havuzdakiler (mükerrersiz)
        // DÜZELTME: rozetle aynı — mükerrer ayıklaması tüm web taleplerinde yapılır
        const webYeniler = webKayitlari.filter(x => webTekilIdler.has(x.id) && (x.durum || 'Yeni') === 'Yeni');
        const webYeniSembol = webYeniler.filter(x => kayitSitesi(x) !== 'depoevim').length;
        const webYeniDepo = webYeniler.length - webYeniSembol;
        const webAktif = aktifKanal === 'web' && !telefonTeklifAcik;
        return (
          <div className="space-y-2">
            {/* ---- YENİ (kullanıcı talebi): TELEFON TEKLİFLERİ — Hızlı Tekliflerin üstünde ----
                Tıklayınca telefonda görüşülen müşterilerin manuel girildiği sayfa açılır. */}
            {/* DEĞİŞTİ (kullanıcı talebi): Telefon Görüşmesi (sol) ve Hızlı Teklifler Havuzu (sağ) tek satırda yan yana */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <TelefonTeklifleriButonu teklifler={gorunurTelefonTeklifleri} aktif={telefonTeklifAcik} onClick={() => setTelefonTeklifAcik(true)} tamYetki={telefonMudurMu} />
            {/* KALDIRILDI (kullanıcı talebi): "Eski havuz talepleri aktarılıyor" çubuğu.
                Aktarım arka planda sessizce, otomatik yapılır; hata olursa yalnızca
                tarayıcı konsoluna yazılır ve bir sonraki açılışta yeniden denenir. */}

            {/* ---- HIZLI TEKLİFLER ---- */}
            {/* DEĞİŞTİ: Hızlı Teklifler butonu ~%20 küçültüldü */}
            <button type="button" onClick={() => sekmeSec('web')}
              className={`w-full px-3 py-2.5 rounded-2xl border-2 transition flex items-center gap-2.5 ${webAktif ? 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/30' : 'bg-white text-orange-700 border-orange-200 hover:border-orange-400'}`}>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${webAktif ? 'bg-white/20' : 'bg-orange-50'}`}>
                <Globe className="w-5 h-5" />
              </span>
              <span className="text-left flex-1 min-w-0">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-black leading-tight">{webKanal.ad}</span>
                  {/* YENİ: ortak alan olduğunu belirt */}
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 ${webAktif ? 'bg-white text-orange-700' : 'bg-orange-500 text-white'}`}><Users className="w-2.5 h-2.5" /> ORTAK ALAN</span>
                </span>
                <span className={`block text-[10px] font-bold mt-0.5 truncate ${webAktif ? 'text-white/80' : 'text-orange-600'}`} title="sembolevdeneve.com + depoevim.com sihirbazlarından gelen teklif talepleri — gün gün listelenir">
                  sembolevdeneve.com + depoevim.com sihirbazlarından gelen teklif talepleri — gün gün listelenir
                </span>
              </span>
              {/* Yeni teklif rozeti — durum "Yeni" olan kayıt varsa yanıp söner */}
              {webYeniSembol > 0 && (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white animate-pulse bg-red-600" title="Sembol Nakliyat">{webYeniSembol} yeni</span>
              )}
              {webYeniDepo > 0 && (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white animate-pulse bg-blue-600" title="DepoEvim">{webYeniDepo} yeni</span>
              )}
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${webAktif ? 'bg-white/25' : 'bg-orange-50'}`}>{webKayitlari.length}</span>
            </button>
            </div>

            {/* ---- DİĞER KANALLAR ----
                DEĞİŞTİ (kullanıcı talebi): varsayılan GİZLİ; "Diğer Kanallar" düğmesine
                basınca açılır. Seçili kanal bu gruptansa düğmede adı görünür. */}
            <div className="bg-white rounded-2xl border border-neutral-200 px-2.5 py-2">
              {(() => {
                const digerAktif = !telefonTeklifAcik && aktifKanal !== 'web' ? KANALLAR.find(k => k.id === aktifKanal) : null;
                const digerToplam = gorunurKayitlar.filter(x => x.kanal !== 'web').length;
                return (
                  <button type="button" onClick={() => setDigerAcik(a => !a)} aria-expanded={digerAcik}
                    className="w-full flex items-center gap-1.5 text-left">
                    <Users className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[11px] font-black text-neutral-600">Diğer Kanallar</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{digerToplam}</span>
                    {digerAktif && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-neutral-900 text-white">Açık: {digerAktif.ad}</span>}
                    <span className="ml-auto text-[10px] font-bold text-neutral-400">{digerAcik ? 'Gizle' : 'Göster'}</span>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${digerAcik ? 'rotate-180' : ''}`} />
                  </button>
                );
              })()}
              {digerAcik && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1">
                {KANALLAR.filter(k => k.id !== 'web').map(k => {
                  const r = KANAL_RENK[k.renk];
                  const sayi = gorunurKayitlar.filter(x => x.kanal === k.id).length;
                  const aktif = aktifKanal === k.id && !telefonTeklifAcik;
                  return (
                    <button key={k.id} type="button" onClick={() => sekmeSec(k.id)} title={k.ad}
                      className={`px-2 py-1.5 rounded-xl border transition flex items-center gap-1.5 min-w-0 ${aktif ? `${r.aktif} border-transparent` : `bg-white ${r.pasif}`}`}>
                      <k.Ikon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[10px] font-black text-left leading-tight flex-1 truncate">{k.ad}</span>
                      <span className={`text-[9px] font-black px-1 py-0.5 rounded-full shrink-0 ${aktif ? 'bg-white/25' : 'bg-white'}`}>{sayi}</span>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* YENİ (kullanıcı talebi): TELEFON GÖRÜŞMESİ — ayrı sayfa yerine menünün altında.
          Seçiliyken havuz filtreleri/tablosu yerine görüşme listesi gösterilir. */}
      {telefonTeklifAcik ? (
        <TelefonTeklifleriView teklifler={telefonTeklifleri} currentUser={currentUser} tamYetki={telefonMudurMu}
          satiscilar={satiscilar.map(p => p.fullName)} gecmisIndeksi={gecmisIndeksi}
          addSystemLog={addSystemLog} onKayitAc={onKayitAc}
          acilisFormu={telefonOnDoldur} onAcilisFormuKullanildi={() => setTelefonOnDoldur(null)}
          onHavuzKaydinaIsle={havuzKaydinaIsle} onGeri={null}
          acilisDetayId={telefonDetayId} onAcilisDetayKullanildi={() => setTelefonDetayId(null)}
          istatistikGoster={gorusmeIstatAcik} />
      ) : (<>
      {/* ARAÇ ÇUBUĞU: hesap filtresi + arama + aksiyonlar
          GİZLENDİ (kullanıcı talebi): "şu an işimiz yok". Kod duruyor; tekrar
          göstermek için HAVUZ_ARAC_CUBUGU_GORUNUR değerini true yapmak yeterli. */}
      {HAVUZ_ARAC_CUBUGU_GORUNUR && (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 flex flex-col lg:flex-row gap-2 lg:items-center">
        <select value={hesapFiltre} onChange={e => setHesapFiltre(e.target.value)} className="px-3 py-2 text-xs font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none">
          <option value="Tümü">Tüm Hesaplar ({kanalHesaplari.length})</option>
          {kanalHesaplari.map(h => <option key={h.id} value={h.id}>{h.etiket}</option>)}
        </select>
        {/* YENİ (kullanıcı talebi): SAHİPLİK — yeni talepler / bana atananlar / (yönetici) satışçı bazında */}
        <select value={sahipFiltre} onChange={e => setSahipFiltre(e.target.value)} className="px-3 py-2 text-xs font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none">
          <option value="Tümü">{tamYetki ? 'Tüm Satışçılar' : 'Yeni + Bana Atananlar'}</option>
          <option value="__ben">Bana Atananlar</option>
          <option value="__yok">Atanmamış (Yeni Talepler)</option>
          {tamYetki && satiscilar.map(p => <option key={p.id} value={p.fullName}>{p.fullName}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Müşteri adı, numara veya satışçı ara..." className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-400" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={handleSenkron} disabled={senkronDurum === 'yukleniyor'}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition disabled:opacity-60">
            {senkronDurum === 'yukleniyor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Senkronize Et
          </button>
          <button type="button" onClick={() => { setHesapYonetimAcik(v => !v); setYeniKayitAcik(false); }}
            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition">
            <Settings className="w-3.5 h-3.5" /> Hesaplar
          </button>
          <button type="button" onClick={() => { setYeniKayitAcik(v => !v); setHesapYonetimAcik(false); }}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${renk.aktif}`}>
            <PlusCircle className="w-3.5 h-3.5" /> Yeni Kayıt
          </button>
        </div>
      </div>
      )}
      {senkronDurum && senkronDurum !== 'yukleniyor' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl px-3 py-2">{senkronDurum}</div>
      )}

      {/* HESAP YÖNETİMİ */}
      {hesapYonetimAcik && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 space-y-3 animate-in slide-in-from-top-1">
          <div className="text-xs font-black text-neutral-700 flex items-center gap-1.5"><Settings className="w-4 h-4" /> Bağlı {kanal.hesapEtiket} Listesi</div>
          <div className="flex flex-wrap gap-2">
            {kanalHesaplari.length === 0 && <span className="text-xs text-neutral-400 font-bold">Henüz hesap bağlanmadı. Aşağıdan ekleyin.</span>}
            {kanalHesaplari.map(h => (
              <span key={h.id} className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full ${renk.nokta}`}></span>
                {h.etiket} <span className="text-neutral-400 font-medium">({h.deger})</span>
                <button type="button" onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzHesaplari', h.id)); }} className="text-neutral-300 hover:text-red-600"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input value={yeniHesap.etiket} onChange={e => setYeniHesap({ ...yeniHesap, etiket: e.target.value })} placeholder="Etiket (örn: Santral 1)" className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none" />
            <input value={yeniHesap.deger} onChange={e => setYeniHesap({ ...yeniHesap, deger: e.target.value })} placeholder={kanal.hesapOrnek} className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none" />
            <input type="password" value={yeniHesap.apiAnahtari} onChange={e => setYeniHesap({ ...yeniHesap, apiAnahtari: e.target.value })} placeholder="API Anahtarı (opsiyonel)" className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none" autoComplete="off" />
            <button type="button" onClick={handleHesapEkle} disabled={!yeniHesap.deger.trim()} className="p-2.5 bg-neutral-900 text-white rounded-xl text-xs font-black disabled:opacity-40">Hesap Bağla</button>
          </div>
          <div className="text-[10px] font-bold text-neutral-400 flex items-center gap-1.5 pt-1 border-t border-neutral-100">
            <Zap className="w-3 h-3" /> Bu kanalın API uç noktası: <code className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{HAVUZ_API_UCLARI[aktifKanal]}</code>
          </div>
        </div>
      )}

      {/* YENİ KAYIT FORMU */}
      {yeniKayitAcik && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 space-y-2 animate-in slide-in-from-top-1">
          <div className="text-xs font-black text-neutral-700 flex items-center gap-1.5"><PlusCircle className="w-4 h-4" /> {kanal.ad} — Yeni Kayıt</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <input value={yeniKayit.musteriAdi} onChange={e => setYeniKayit({ ...yeniKayit, musteriAdi: e.target.value })} placeholder="Müşteri Adı" className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none" />
            <input value={yeniKayit.iletisim} onChange={e => setYeniKayit({ ...yeniKayit, iletisim: e.target.value })} placeholder={kanal.iletisimEtiket + ' *'} className="p-2.5 border border-neutral-300 rounded-xl text-xs font-bold outline-none" />
            <select value={yeniKayit.hesapId} onChange={e => setYeniKayit({ ...yeniKayit, hesapId: e.target.value })} className="p-2.5 border border-neutral-300 rounded-xl bg-white text-xs font-bold outline-none">
              <option value="">Hangi hesaba geldi?</option>
              {kanalHesaplari.map(h => <option key={h.id} value={h.id}>{h.etiket}</option>)}
            </select>
            <select value={yeniKayit.hizmetTipi} onChange={e => setYeniKayit({ ...yeniKayit, hizmetTipi: e.target.value })} className="p-2.5 border border-neutral-300 rounded-xl bg-white text-xs font-bold outline-none">
              {HIZMET_TIPLERI.map(t => <option key={t.id}>{t.id}</option>)}
            </select>
            <button type="button" onClick={handleYeniKayit} disabled={!yeniKayit.iletisim.trim()} className={`p-2.5 rounded-xl text-xs font-black transition disabled:opacity-40 ${renk.aktif}`}>Havuza Ekle</button>
          </div>
          <input value={yeniKayit.sonMesaj} onChange={e => setYeniKayit({ ...yeniKayit, sonMesaj: e.target.value })} placeholder="İlk mesaj / görüşme özeti (opsiyonel)" className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs outline-none" />
        </div>
      )}

      {/* DURUM / HİZMET / KAYNAK / ZAMAN FİLTRELERİ
          DEĞİŞTİ (kullanıcı talebi): yatay kaydırma kaldırıldı — taşan öğeler alt
          satıra geçer. 1. satır: Durum butonları (tablodaki durum rozetleriyle AYNI
          renk, seçili olan koyu halkalı; mobilde (<768px) sayılı açılır liste) ve
          en sağda kırmızı "Alınanları da göster" düğmesi.
          2. satır: Hizmet + Kaynak açılır listeleri, Zaman butonları ve
          (seçili filtre varsa) en sağda "Filtreleri temizle".
          Filtre mantığı DEĞİŞMEDİ, yalnızca yerleşim. */}
      {(() => {
        // Durum filtresinde yalnızca "Müşteriyle Görüşme Durumu" penceresindeki
        // seçenekler (aynı sıra ve etiketlerle) + Tümü ve Yeni gösterilir.
        const durumSecenekleri = ['Tümü', 'Yeni', ...GORUSME_DURUMU_SECENEKLERI.map(x => x.id)];
        const durumEtiketi = (d) => GORUSME_DURUMU_SECENEKLERI.find(x => x.id === d)?.etiket || d;
        const filtreVar = durumFiltre !== 'Tümü' || hizmetFiltre !== 'Tümü' || kaynakFiltre !== 'Tümü' || zamanFiltre !== 'Tüm Zamanlar';
        const acilirSinif = (secili) => `px-2 py-1 rounded-lg text-[11px] font-black border outline-none ${secili ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'}`;
        const baslikSinif = 'text-[10px] font-black text-neutral-400 uppercase';
        return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={baslikSinif}>Durum:</span>
          {/* Mobil: sayılı açılır liste */}
          <select value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)} className={`md:hidden ${acilirSinif(durumFiltre !== 'Tümü')}`}>
            {durumSecenekleri.map(d => <option key={d} value={d}>{durumEtiketi(d)} ({durumSayaclari[d] ?? 0})</option>)}
          </select>
          {/* Masaüstü: renkli butonlar */}
          {durumSecenekleri.map(d => {
            const secili = durumFiltre === d;
            const renk = d === 'Tümü'
              ? (secili ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400')
              : durumRenk(d);
            return (
              <button key={d} type="button" onClick={() => setDurumFiltre(d)}
                className={`hidden md:inline-block px-2 py-1 rounded-lg text-[10px] font-black border transition whitespace-nowrap ${renk} ${secili && d !== 'Tümü' ? 'ring-2 ring-neutral-900 ring-offset-1' : ''} ${!secili && d !== 'Tümü' ? 'opacity-80 hover:opacity-100' : ''}`}>
                {durumEtiketi(d)} <span className="opacity-60">({durumSayaclari[d] ?? 0})</span>
              </button>
            );
          })}
          {/* DEĞİŞTİ (kullanıcı talebi): havuz dışına çıkmış (satışçıya geçmiş)
              talepleri de listele — Durum satırının en sağında, kırmızı */}
          {aktifKanal === 'web' && (
            <button type="button" onClick={() => setAlinanlariGoster(v => !v)}
              className={`ml-auto px-2.5 py-1 rounded-lg text-[11px] font-black border transition flex items-center gap-1 whitespace-nowrap ${alinanlariGoster ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-white text-red-600 border-red-300 hover:bg-red-50'}`}>
              <Eye className="w-3 h-3" /> {alinanlariGoster ? 'Alınanlar gösteriliyor' : 'Alınanları da göster'}
            </button>
          )}
        </div>

        <div className="w-full flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 border-t border-neutral-100">
          <label className="flex items-center gap-1.5">
            <span className={baslikSinif}>Hizmet:</span>
            <select value={hizmetFiltre} onChange={e => setHizmetFiltre(e.target.value)} className={acilirSinif(hizmetFiltre !== 'Tümü')}>
              {['Tümü', 'Nakliye', 'Depo', 'Asansör'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {/* KAYNAK FİLTRESİ — istatistik gruplarından üretilir */}
          <label className="flex items-center gap-1.5">
            <span className={baslikSinif}>Kaynak:</span>
            <select value={kaynakFiltre} onChange={e => setKaynakFiltre(e.target.value)} className={acilirSinif(kaynakFiltre !== 'Tümü')}>
              <option value="Tümü">Tümü</option>
              {OZET_GRUPLARI.map(g => (
                <optgroup key={g.ad} label={g.ad}>
                  {KAYNAK_FILTRELERI.filter(f => f.grup === g.ad).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {/* ZAMAN FİLTRESİ — Tüm Zamanlar varsayılan */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${baslikSinif} flex items-center gap-1`}><CalendarDays className="w-3 h-3" /> Zaman:</span>
            {ZAMAN_FILTRELERI.map(z => (
              <button key={z} type="button" onClick={() => setZamanFiltre(z)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition whitespace-nowrap ${zamanFiltre === z ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'}`}>
                {z}
              </button>
            ))}
          </div>
          {filtreVar && (
            <button type="button" onClick={() => { setDurumFiltre('Tümü'); setHizmetFiltre('Tümü'); setKaynakFiltre('Tümü'); setZamanFiltre('Tüm Zamanlar'); }}
              className="ml-auto text-[11px] font-bold text-neutral-500 underline underline-offset-2 hover:text-neutral-900 whitespace-nowrap">
              Filtreleri temizle
            </button>
          )}
        </div>
      </div>
        );
      })()}

      {/* ====================================================================
          DEĞİŞTİ: "Hızlı Teklifler" sekmesinde gün ayraçlı yeni tablo
          (HizliTekliflerTablosu) gösterilir. Diğer kanallarda aşağıdaki
          mevcut havuz tablosu AYNEN çalışmaya devam eder.
          ==================================================================== */}
      {aktifKanal === 'web' ? (
        <HizliTekliflerTablosu
          kayitlar={filtreli}
          siteSecimi={siteSecimi}
          hesapAdi={hesapAdi}
          durumRenk={durumRenk}
          satiscilar={satiscilar}
          reklamKaynagiEtiket={reklamKaynagiEtiket}
          onDurumDegistir={handleDurumDegistir}
          onAta={handleAta}
          onNotEkle={handleHizliNotEkle}
          onNotGuncelle={handleHizliNotGuncelle}
          onNotSil={handleNotSil}
          onDetay={(k) => {
            // Mevcut "Detay" butonuyla birebir aynı hazırlık
            setDetayKayit(k);
            setDetayFotoGoster(null);
            setDuzenleIletisim((k.iletisim || '').includes('Bekleniyor') ? '' : (k.iletisim || ''));
            setDuzenleMusteriAdi((k.musteriAdi || '').includes('Ziyaretçi') ? '' : (k.musteriAdi || ''));
          }}
          onSil={(id) => setSilinecekId(id)}
          silebilir={silebilir}
          gecmisBul={havuzGecmisi}
          onGorusmeAc={(id) => { setTelefonDetayId(id); setTelefonTeklifAcik(true); }}
        />
      ) : (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[900px]">
          <thead className="bg-neutral-900 text-white">
            <tr>
              <th className="p-3 font-bold rounded-tl-2xl">Müşteri</th>
              <th className="p-3 font-bold">{kanal.iletisimEtiket}</th>
              <th className="p-3 font-bold">Hesap</th>
              <th className="p-3 font-bold text-center">Hizmet</th>
              <th className="p-3 font-bold text-center">Durum</th>
              <th className="p-3 font-bold">Atanan Satışçı</th>
              <th className="p-3 font-bold">Son Hareket</th>
              <th className="p-3 font-bold text-right rounded-tr-2xl">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtreli.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-neutral-400 font-bold">
                Bu filtrelerde kayıt yok. "Yeni Kayıt" ile ekleyin veya "Senkronize Et" ile API'den çekin.
              </td></tr>
            )}
            {filtreli.map(k => {
              const sonHareket = (k.hareketler || [])[k.hareketler?.length - 1];
              const tip = HIZMET_TIPLERI.find(t => t.id === (k.hizmetTipi || 'Nakliye')) || HIZMET_TIPLERI[0];
              return (
                <tr key={k.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition">
                  <td className="p-3 font-bold text-black">
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-full ${renk.nokta} text-white flex items-center justify-center text-[10px] font-black shrink-0`}>
                        {(k.musteriAdi || k.iletisim || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate">{k.musteriAdi || 'İsimsiz'}</span>
                        {k.kaynak === 'api' && <span className="text-[9px] font-black text-neutral-400">API</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-neutral-600">{k.iletisim}</td>
                  <td className="p-3 text-neutral-500 font-bold">{hesapAdi(k.hesapId)}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${tip.renk}`}>
                      <tip.Ikon className="w-3 h-3" /> {tip.id.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <select value={k.durum || 'Yeni'} onChange={e => handleDurumDegistir(k, e.target.value)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black border outline-none cursor-pointer ${durumRenk(k.durum)}`}>
                      {DURUMLAR.map(d => <option key={d.id}>{d.id}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <select value={k.atanan || ''} onChange={e => handleAta(k, e.target.value)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold border border-neutral-200 bg-white outline-none cursor-pointer max-w-[130px]">
                      <option value="">— Atanmadı —</option>
                      {satiscilar.map(p => <option key={p.id} value={p.fullName}>{p.fullName}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-neutral-500 max-w-[190px]">
                    {sonHareket ? (
                      <span className="block truncate" title={sonHareket.islem}>
                        <b className="text-neutral-700">{sonHareket.kullanici}</b> • {tarihSaat(sonHareket.tarih)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <a href={iletisimLink(k)} target={aktifKanal === 'telefon' ? '_self' : '_blank'} rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black mr-1.5 ${k.iletisim.includes('Bekleniyor') ? 'opacity-50 pointer-events-none bg-neutral-200 text-neutral-500' : renk.aktif}`}>
                      <kanal.Ikon className="w-3 h-3" /> {iletisimBtnMetin}
                    </a>
                    <button type="button" onClick={() => {
                        setDetayKayit(k);
                        setDetayFotoGoster(null);
                        setDuzenleIletisim(k.iletisim.includes('Bekleniyor') ? '' : k.iletisim);
                        setDuzenleMusteriAdi(k.musteriAdi.includes('Ziyaretçi') ? '' : k.musteriAdi);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[10px] font-black mr-1.5">
                      <Eye className="w-3 h-3" /> Teklife Bak
                    </button>
                    {/* DEĞİŞTİ: Sil yalnızca Müdür / Yönetici / Firma Sahibi'nde görünür */}
                    {silebilir && (
                      <button type="button" onClick={() => setSilinecekId(k.id)} className="text-red-300 hover:text-red-600 align-middle"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      </>)}

      {/* DETAY / HAREKET PENCERESİ */}
      {detayKayit && (
        <div className="fixed inset-0 bg-black/70 z-[9998] flex flex-col sm:flex-row items-center justify-center p-4 gap-4 overflow-y-auto animate-in fade-in" onClick={() => { setDetayKayit(null); setDetayFotoGoster(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col animate-in zoom-in-95 shrink-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* ================================================================
                DEĞİŞTİ (kullanıcı talebi): DETAY PENCERESİ YENİDEN TASARLANDI
                ----------------------------------------------------------------
                Başlıkta artık: baş harf avatarı, müşteri adı, durum rozeti,
                doğrudan ARA / WHATSAPP butonları ve künye satırı (kanal, hesap,
                tarih, kaynak) yer alır. Tüm işleyiciler eskisiyle aynıdır.
                ================================================================ */}
            <div className={`p-4 text-white shrink-0 ${renk.aktif}`}>
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-base font-black shrink-0">
                  {(detayKayit.musteriAdi || detayKayit.iletisim || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  {/* DEĞİŞTİ (kullanıcı talebi): ad ve numara SİYAH, kalın ve
                      daha belirgin — turuncu başlık üzerinde beyaz bir kutu
                      içinde birlikte gösterilir. */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* DEĞİŞTİ (kullanıcı talebi): eski "Müşteri Bilgilerini Eşleştir"
                        kartı kaldırıldı; aynı iş artık BURADA yapılır. Kalem simgesine
                        basılınca ad ve numara yerinde metin kutusuna dönüşür, onaylanınca
                        handleMusteriGuncelle (eşleştirme) çalışır. */}
                    {baslikDuzenle ? (
                      <span className="bg-white rounded-xl px-2 py-1.5 inline-flex items-center gap-1.5 flex-wrap shadow-sm">
                        <input autoFocus value={duzenleMusteriAdi} onChange={e => setDuzenleMusteriAdi(e.target.value)}
                          placeholder="Ad Soyad" className="w-40 px-2 py-1 border border-neutral-300 rounded-lg text-sm font-black text-black outline-none focus:ring-2 focus:ring-orange-400" />
                        <input value={duzenleIletisim} onChange={e => setDuzenleIletisim(e.target.value)}
                          placeholder="Telefon" className="w-36 px-2 py-1 border border-neutral-300 rounded-lg text-sm font-black text-black outline-none focus:ring-2 focus:ring-orange-400"
                          onKeyDown={e => { if (e.key === 'Enter') { handleMusteriGuncelle(detayKayit); setBaslikDuzenle(false); } if (e.key === 'Escape') setBaslikDuzenle(false); }} />
                        <button type="button" title="Kaydet ve eşleştir"
                          disabled={(!duzenleIletisim.trim() && !duzenleMusteriAdi.trim()) || (duzenleIletisim === detayKayit.iletisim && duzenleMusteriAdi === detayKayit.musteriAdi)}
                          onClick={async () => { await handleMusteriGuncelle(detayKayit); setBaslikDuzenle(false); }}
                          className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-40"><CheckCircle className="w-4 h-4" /></button>
                        <button type="button" title="Vazgeç" onClick={() => { setBaslikDuzenle(false); setDuzenleMusteriAdi((detayKayit.musteriAdi || '').includes('Ziyaretçi') ? '' : (detayKayit.musteriAdi || '')); setDuzenleIletisim((detayKayit.iletisim || '').includes('Bekleniyor') ? '' : (detayKayit.iletisim || '')); }}
                          className="p-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg transition"><X className="w-4 h-4" /></button>
                      </span>
                    ) : (
                      <span className="bg-white rounded-xl px-3 py-1.5 inline-flex items-center gap-2 flex-wrap shadow-sm">
                        <h3 className="font-black text-lg text-black leading-tight">{detayKayit.musteriAdi || 'İsimsiz'}</h3>
                        <span className="font-black text-sm text-black/80 tracking-wide">{detayKayit.iletisim}</span>
                        <button type="button" onClick={() => setBaslikDuzenle(true)} title="Ad / telefonu düzenle ve eşleştir"
                          className="ml-1 p-1 rounded-md text-neutral-400 hover:text-orange-600 hover:bg-orange-50 transition"><Edit className="w-4 h-4" /></button>
                      </span>
                    )}
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/25">{detayKayit.durum || 'Yeni'}</span>
                    {/* YENİ (kullanıcı talebi): NUMARA SORGUSU — bu numara sistemde kayıtlı mı, kimin portföyünde? */}
                    <TTGecmisRozetleri gecmis={havuzGecmisi(detayKayit)} kullanici={kullaniciAdi} hedefId="havuz-detay-gecmis" />
                  </div>
                  {/* YENİ: mevcut satışçı — canlı kayıttan okunur, başka kullanıcı Kaydet'le devralırsa pencere açıkken bile güncellenir */}
                  {(() => {
                    const canli = kayitlar.find(x => x.id === detayKayit.id) || detayKayit;
                    return (
                      <span className="inline-flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${canli.atanan ? 'bg-white/25 text-white' : 'bg-black/20 text-white/70'}`}>
                          <User className="w-3 h-3" /> Satışçı: {canli.atanan || 'Atanmadı'}
                        </span>
                        {/* YENİ (kullanıcı talebi): başka personele devret */}
                        <button type="button" onClick={() => setTransferKayit(canli)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-neutral-900 hover:bg-neutral-100 transition shadow-sm">
                          <RefreshCw className="w-3 h-3" /> Transfer Et
                        </button>
                      </span>
                    );
                  })()}
                  <p className="text-[10px] font-bold opacity-75 mt-1 flex items-center gap-1.5 flex-wrap">
                    <kanal.Ikon className="w-3 h-3" /> {kanal.ad}
                    <span className="opacity-50">|</span> {hesapAdi(detayKayit.hesapId)}
                    <span className="opacity-50">|</span> {tarihSaat(detayKayit.createdAt)}
                    <span className="opacity-50">|</span> {detayKayit.kaynak === 'api' ? 'Otomatik' : 'Manuel'} kayıt
                  </p>
                </div>
                <button onClick={() => { setDetayKayit(null); setDetayFotoGoster(null); }} className="text-white/70 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
              </div>

              {/* Hızlı iletişim — numarası yoksa butonlar pasif */}
              {telefonGecerliMi(detayKayit.iletisim) && (
                <div className="flex gap-2 mt-3">
                  {/* DEĞİŞTİ (kullanıcı talebi): Ara MAVİ, WhatsApp YEŞİL */}
                  <a href={`tel:${telefonRakam(detayKayit.iletisim)}`} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition text-xs font-black flex items-center justify-center gap-1.5 shadow-md">
                    <Phone className="w-3.5 h-3.5" /> Ara
                  </a>
                  <a href={`https://wa.me/${waNumarasi(detayKayit.iletisim)}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white transition text-xs font-black flex items-center justify-center gap-1.5 shadow-md">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-neutral-50">
              {/* YENİ (kullanıcı talebi): MÜŞTERİ GEÇMİŞİ — telefon numarasıyla eşleşen
                  eski işler, havuz talepleri ve telefon görüşmeleri */}
              {(() => { const g = havuzGecmisi(detayKayit); return g ? <div id="havuz-detay-gecmis"><MusteriGecmisiKutusu gecmis={g} ad={detayKayit.musteriAdi} /></div> : null; })()}
              {/* TAŞINDI (kullanıcı talebi): "Telefon Görüşme Formu" artık alt çubuktaki
                  "Fiyat Hesapla" butonu (eski "Kayıt Aç"ın yerinde). */}
              {detayKayit.telefonTeklifId && (
                <p className="text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5" /> Bu talep Telefon Görüşmesi'ne aktarıldı ({detayKayit.atanan || '—'}).
                </p>
              )}
              
              {/* Müşteri Eşleştirme / Bilgi Güncelleme Alanı */}
              {/* KALDIRILDI (kullanıcı talebi): "Müşteri Bilgilerini Eşleştir" kartı →
                  düzenleme artık başlıktaki kalem simgesinde. "Kayıt Aç" butonu →
                  alt çubuğa (Vazgeç · Kaydet · Kayıt Aç) taşındı. */}

              {/* ==============================================================
                  DEĞİŞTİ: TEKLİF DETAYI ARTIK TABLO GİBİ AYRIŞTIRILIR
                  --------------------------------------------------------------
                  Web sihirbazından gelen tek satırlık uzun metin
                  (teklifOzetiAyristir ile) başlık / güzergâh / alan satırlarına
                  bölünür. Tanınmayan metin üstteki özet satırında aynen kalır,
                  hiç alan bulunamazsa ham metin gösterilir — veri kaybolmaz.
                  ============================================================== */}
              {detayKayit.sonMesaj && (() => {
                // DEĞİŞTİ (kullanıcı talebi): Sembol Eşya Depolama ve DepoEvim kayıtlarında
                // satırlar siteden gelen alanlardan (teklifAlanlari) üretilir; bu alanları
                // olmayan eski kayıtlar eskisi gibi metinden ayrıştırılır. "Kutulama" → "Toplama".
                const metinden = teklifOzetiAyristir(eskiTeklifMetni(detayKayit.sonMesaj));
                const teklif = teklifDetayiAlanlardan(detayKayit, metinden.baslik) || metinden;
                return (
                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="px-3 py-2 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black text-neutral-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Teklif Detayı
                      </p>
                      {teklif.baslik && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-neutral-900 text-white">{teklif.baslik}</span>
                      )}
                    </div>

                    {/* Güzergâh / serbest özet — büyük puntoyla en üstte */}
                    {teklif.ozet && (
                      <p className="px-3 pt-3 text-sm font-black text-black leading-snug">{teklif.ozet}</p>
                    )}

                    {/* DEĞİŞTİ (kullanıcı talebi): alanlar TABLO görünümünde, her satırın
                        etiketi farklı renkte rozet; fiyat alanları yeşil vurgulu, satırlar
                        zebra desenli. Nakliye ve DepoEvim teklifleri aynı biçimde çıkar. */}
                    {teklif.satirlar.length > 0 ? (
                      <div className="p-3">
                        <div className="border border-neutral-200 rounded-xl overflow-hidden">
                          {teklif.satirlar.map((satir, i) => {
                            const para = satir.para ?? TEKLIF_PARA_ALANLARI.includes(satir.etiket);
                            const renk = TEKLIF_SATIR_RENKLERI[i % TEKLIF_SATIR_RENKLERI.length];
                            return (
                              <div key={i} className={`flex items-center gap-2.5 px-2.5 py-2 ${i % 2 === 1 ? 'bg-neutral-50' : 'bg-white'} ${i > 0 ? 'border-t border-neutral-100' : ''}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${para ? 'bg-green-500' : renk.nokta}`}></span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 w-[132px] text-center ${para ? 'bg-green-100 text-green-800' : renk.etiket}`}>{teklifEtiketAdi(satir.etiket)}</span>
                                <span className={`text-xs flex-1 leading-snug ${para ? 'font-black text-green-700' : 'font-bold text-neutral-800'}`}>{satir.deger}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      !teklif.ozet && <p className="p-3 text-xs text-neutral-700 leading-relaxed">{teklif.ham}</p>
                    )}
                  </div>
                );
              })()}
              {Array.isArray(detayKayit.fotograflar) && detayKayit.fotograflar.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-3">
                  <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Müşterinin Yüklediği Fotoğraflar</p>
                  <HasarCozumBelgeleri
                    files={detayKayit.fotograflar.map((url, i) => ({ url, name: `Fotoğraf ${i + 1}` }))}
                    setViewingImage={setDetayFotoGoster}
                  />
                </div>
              )}
              {/* TAŞINDI (kullanıcı talebi): NOT EKLE artık Hizmet Tipi'nin ÜSTÜNDE.
              Not ekleme — DEĞİŞTİ (kullanıcı talebi): daha BELİRGİN — sarı zemin,
                  kalın çerçeve, büyük başlık, çok satırlı geniş metin alanı */}
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black text-yellow-900 flex items-center gap-1.5"><StickyNote className="w-4 h-4" /> Not Ekle</p>
                  {/* YENİ (kullanıcı talebi): HAZIR ŞABLONLAR butonu — tıklayınca
                      şablon listesi açılır, seçilen şablon not kutusuna yazılır */}
                  <button type="button" onClick={() => setSablonlarAcik(a => !a)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border transition ${sablonlarAcik ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'}`}>
                    <Zap className="w-3 h-3" /> Hazır Şablonlar <ChevronDown className={`w-3 h-3 transition-transform ${sablonlarAcik ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {sablonlarAcik && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-yellow-50/60 border border-yellow-100 rounded-xl">
                    {(NOT_SABLONLARI[kayitSitesi(detayKayit)] || NOT_SABLONLARI.sembolevdeneve).map((sablon, i) => (
                      <button key={i} type="button" onClick={() => { setNotMetni(sablon); setSablonlarAcik(false); }}
                        className="text-left px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-yellow-200 text-yellow-900 hover:bg-yellow-100 transition">
                        {sablon}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-stretch">
                  <textarea rows={2} value={notMetni} onChange={e => setNotMetni(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNotEkle(detayKayit); } }}
                    placeholder="Görüşme notunu buraya yazın… (Enter: ekle, Shift+Enter: yeni satır)"
                    className="flex-1 p-3 bg-white border-2 border-yellow-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
                  <button type="button" onClick={() => handleNotEkle(detayKayit)} disabled={!notMetni.trim()}
                    className="px-4 bg-yellow-400 hover:bg-yellow-500 text-black rounded-xl text-sm font-black disabled:opacity-40 flex items-center gap-1.5 transition shadow-md"><Send className="w-4 h-4" /> Ekle</button>
                </div>
                <p className="text-[10px] font-bold text-yellow-700/70 mt-1.5">Yazıp "Ekle"ye basmasanız bile Kaydet'te otomatik eklenir.</p>
                {/* DEĞİŞTİ (kullanıcı talebi): her notta Düzenle ve Kaldır var.
                    Liste en yeniden eskiye gösterilir; düzenleme/silme için notun
                    dizideki GERÇEK sırası (i) korunur. */}
                {(detayKayit.notlar || []).map((n, i) => ({ n, i })).reverse().map(({ n, i }) => (
                  <div key={i} className="mt-2 bg-yellow-50 border border-yellow-200 rounded-xl p-2.5">
                    {detayNotDuzenle === i ? (
                      <>
                        {/* ---------- DÜZENLEME MODU ---------- */}
                        <textarea autoFocus rows={3} value={detayNotMetin} onChange={e => setDetayNotMetin(e.target.value)}
                          className="w-full p-2 border border-yellow-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-yellow-400 resize-none bg-white" />
                        <div className="flex gap-1.5 mt-1.5">
                          <button type="button" onClick={() => { setDetayNotDuzenle(null); setDetayNotMetin(''); }}
                            className="flex-1 py-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-[10px] font-black hover:bg-neutral-50 transition">Vazgeç</button>
                          <button type="button" disabled={!detayNotMetin.trim()}
                            onClick={async () => { await handleHizliNotGuncelle(detayKayit, i, detayNotMetin); setDetayNotDuzenle(null); setDetayNotMetin(''); }}
                            className="flex-1 py-1.5 bg-neutral-900 text-white rounded-lg text-[10px] font-black disabled:opacity-40 hover:bg-neutral-700 transition flex items-center justify-center gap-1">
                            <Save className="w-3 h-3" /> Güncelle
                          </button>
                        </div>
                      </>
                    ) : detayNotSil === i ? (
                      <>
                        {/* ---------- KALDIRMA ONAYI ---------- */}
                        <p className="text-xs text-neutral-800 line-through opacity-60">{n.metin}</p>
                        <p className="text-[10px] font-black text-red-600 mt-1.5">Bu not kaldırılsın mı?</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <button type="button" onClick={() => setDetayNotSil(null)}
                            className="flex-1 py-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-[10px] font-black hover:bg-neutral-50 transition">Vazgeç</button>
                          <button type="button" onClick={async () => { await handleNotSil(detayKayit, i); setDetayNotSil(null); }}
                            className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black hover:bg-red-700 transition flex items-center justify-center gap-1">
                            <Trash2 className="w-3 h-3" /> Evet, Kaldır
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* ---------- NORMAL GÖRÜNÜM ---------- */}
                        <p className="text-xs text-neutral-800 whitespace-pre-wrap">{n.metin}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[9px] font-bold text-neutral-400">{n.kullanici} • {tarihSaat(n.tarih)}{n.duzenlendi && <span className="ml-1 text-neutral-500">(düzenlendi)</span>}</p>
                          <span className="flex gap-1 shrink-0">
                            <button type="button" onClick={() => { setDetayNotDuzenle(i); setDetayNotMetin(n.metin); setDetayNotSil(null); }}
                              className="p-1 rounded-md text-neutral-400 hover:text-black hover:bg-yellow-100 transition" title="Notu düzenle"><Edit className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => { setDetayNotSil(i); setDetayNotDuzenle(null); }}
                              className="p-1 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition" title="Notu kaldır"><Trash2 className="w-3.5 h-3.5" /></button>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* KALDIRILDI (kullanıcı talebi): "Durum" buton satırı — durum artık
                  Kaydet'e basıldıktan sonra açılan "Müşteriyle görüşme durumu nedir?"
                  penceresinden seçilir; kayıt o ana kadar "Yeni" kalır. */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-3">
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1.5">Hizmet Tipi</p>
                <div className="flex gap-1.5">
                  {HIZMET_TIPLERI.map(t => (
                    <button key={t.id} type="button" onClick={() => handleHizmetDegistir(detayKayit, t.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-1 ${(detayKayit.hizmetTipi || 'Nakliye') === t.id ? t.renk : 'bg-white text-neutral-500 border border-neutral-200'}`}>
                      <t.Ikon className="w-3 h-3" /> {t.id}
                    </button>
                  ))}
                </div>
                {/* DEĞİŞTİ (kullanıcı talebi): site sekmesi kalmadığı için uyarı yerine bilgi */}
                <p className="mt-2 text-[10px] font-bold text-neutral-500">
                  Hizmet tipi, talebin hangi şirkete ait olduğunu belirler: Depo → <b className="text-blue-700">DEPOEVİM</b>, Nakliye / Asansör → <b className="text-red-700">SEMBOL</b>.
                </p>
              </div>

              {/* Hareket geçmişi */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-3">
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1.5 flex items-center gap-1"><History className="w-3 h-3" /> Hareket Geçmişi</p>
                <div className="space-y-1.5">
                  {(detayKayit.hareketler || []).slice().reverse().map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${renk.nokta}`}></span>
                      <div>
                        <span className="text-neutral-700">{h.islem}</span>
                        <span className="block text-[9px] font-bold text-neutral-400">{h.kullanici} • {tarihSaat(h.tarih)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-neutral-200 shrink-0">
              {/* ================================================================
                  DEĞİŞTİ (kullanıcı talebi): "Kapat" → "KAYDET"
                  ----------------------------------------------------------------
                  Kaydet'e basan kullanıcı bu işin SATIŞÇISI olarak atanır
                  (k.atanan = aktif kullanıcı) ve pencere kapanır. Durum, hizmet
                  tipi ve notlar zaten anında kaydedildiği için burada ek bir
                  yazma yoktur; atamanın kendisi de hareket geçmişine düşer.
                  ================================================================ */}
              {/* ================================================================
                  DEĞİŞTİ (kullanıcı talebi): ALT ÇUBUK — Vazgeç %25 · Kaydet %50 · Kayıt Aç %25
                  ----------------------------------------------------------------
                  • Kaydet: yazılmamış notu ekler + satışçıyı en son basana atar,
                    ardından "Müşteriyle görüşme durumu nedir?" penceresini AÇAR
                    (durum orada seçilir; seçim yapılmazsa kayıt "Yeni" kalır).
                  • Kayıt Aç: hizmet tipine göre Nakliye/Depo/Asansör kaydı açar,
                    ad ve telefonu forma doldurur (eşleştirme kartından taşındı).
                  ================================================================ */}
              <div className="flex gap-2">
                <button onClick={() => { setNotMetni(''); setBaslikDuzenle(false); setDetayKayit(null); setDetayFotoGoster(null); setSablonlarAcik(false); setDetayNotDuzenle(null); setDetayNotSil(null); }}
                  className="basis-1/5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-black rounded-xl text-sm transition">Vazgeç</button>
                <button disabled={aktariliyor} onClick={async () => {
                    // DEĞİŞTİ (kullanıcı talebi): KAYDET = talebi al ve Telefon Görüşmesi'ne aktar.
                    // Yazılmamış not da eklenir; ardından "görüşme durumu" sorusu açılır.
                    if (detayKayit) {
                      setAktariliyor(true);
                      try {
                        const teklif = await havuzuTelefonaAktar(detayKayit, notMetni.trim());
                        setNotMetni('');
                        setGorusmeDurumuKayit({ ...detayKayit, telefonTeklifId: teklif.id, _teklif: teklif });
                      } catch (e) { console.error('Aktarım hatası:', e); alert('Telefon Görüşmesi\'ne aktarılamadı: ' + (e?.message || '')); }
                      finally { setAktariliyor(false); }
                    }
                    setBaslikDuzenle(false);
                    setDetayKayit(null); setDetayFotoGoster(null); setSablonlarAcik(false); setDetayNotDuzenle(null); setDetayNotSil(null);
                  }}
                  className="basis-2/5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-sm transition shadow-lg shadow-green-600/30 flex items-center justify-center gap-2 disabled:opacity-60">
                  {aktariliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
                </button>
                {/* DEĞİŞTİ (kullanıcı talebi): "Kayıt Aç" → "FİYAT HESAPLA".
                    Tıklandığı AN talep satışçının Telefon Teklifleri sayfasına geçer ve
                    soru akışlı görüşme formu açılır: Nakliye → Evden Eve penceresi,
                    Depo → DepoEvim penceresi. (Kayıt ekranına geçiş artık telefon
                    teklifinin detayındaki "Kayıt Aç" ile yapılır.) */}
                {(() => {
                  const depoMu = (detayKayit.hizmetTipi || 'Nakliye') === 'Depo';
                  return (
                    <button type="button" disabled={aktariliyor} title="Talebi Telefon Görüşmesi'ne al ve soru akışlı görüşmeyi başlat"
                      onClick={async () => {
                        setAktariliyor(true);
                        try {
                          const teklif = await havuzuTelefonaAktar(detayKayit, notMetni.trim());
                          setNotMetni(''); setBaslikDuzenle(false);
                          setDetayKayit(null); setDetayFotoGoster(null); setSablonlarAcik(false);
                          setTelefonOnDoldur(teklif);          // Sihirbaz bu kayıtla açılır
                          setTelefonTeklifAcik(true);
                        } catch (e) { console.error('Aktarım hatası:', e); alert('Telefon Görüşmesi\'ne aktarılamadı: ' + (e?.message || '')); }
                        finally { setAktariliyor(false); }
                      }}
                      className={`basis-2/5 py-2.5 rounded-xl text-white text-sm font-black transition shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-60 ${depoMu ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-red-600 hover:bg-red-700 shadow-red-600/30'}`}>
                      <PhoneCall className="w-4 h-4" />
                      <span className="leading-tight text-left">{/* DEĞİŞTİ (kullanıcı talebi): "Fiyat Hesapla" → "Teklif Gönder" */}Teklif Gönder<span className="block text-[9px] font-bold opacity-80">Telefon görüşmesi · {depoMu ? 'DepoEvim' : 'Evden Eve'}</span></span>
                    </button>
                  );
                })()}
              </div>
              <p className="text-[10px] font-bold text-neutral-400 text-center mt-1.5">
                <b className="text-neutral-500">Kaydet</b> veya <b className="text-neutral-500">Teklif Gönder</b>'e basıldığında talep {kullaniciAdi} adına alınır, havuzdan çıkar ve <b className="text-neutral-500">Telefon Görüşmesi</b> sayfanıza geçer. Başka personele devretmek için <span className="font-black text-neutral-500">Transfer Et</span> kullanın.
              </p>
            </div>
          </div>

          {detayFotoGoster && (
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[88vh] flex flex-col animate-in zoom-in-95 slide-in-from-right-4 shrink-0" onClick={e => e.stopPropagation()}>
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-purple-600 rounded-t-2xl shrink-0">
                <h3 className="font-bold text-sm truncate pr-2">{detayFotoGoster.title}</h3>
                <button onClick={() => setDetayFotoGoster(null)} className="text-neutral-400 hover:text-white transition shrink-0"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 flex-1 min-h-0 overflow-y-auto flex flex-col items-center">
                <div className="w-full aspect-video bg-neutral-100 rounded-xl border border-neutral-300 flex items-center justify-center mb-3 overflow-hidden relative shadow-inner">
                  {isVideoUrl(detayFotoGoster.name) ? (
                    <video src={detayFotoGoster.name} controls autoPlay muted className="w-full h-full object-contain bg-black" />
                  ) : (
                    <img src={detayFotoGoster.name} alt="Görsel" className="w-full h-full object-contain" />
                  )}
                </div>
                <a href={detayFotoGoster.name} target="_blank" rel="noreferrer"
                  className="w-full py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold rounded-xl transition flex justify-center items-center gap-2 border border-purple-200 text-xs mb-2">
                  <ArrowUpRight className="w-4 h-4" /> Görseli / Dosyayı Aç
                </a>
                <button onClick={() => setDetayFotoGoster(null)} className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl text-xs transition">Kapat</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          YENİ (kullanıcı talebi): "MÜŞTERİYLE GÖRÜŞME DURUMU NEDİR?"
          ------------------------------------------------------------------
          Teklife Bak → Kaydet'ten sonra açılır. Seçenekler alt alta, her biri
          kendi renginde. Seçilince kayıt durumu değişir (hareket geçmişine
          düşer) ve pencere kapanır. "Şimdilik değiştirme" ile kayıt "Yeni"
          (ya da mevcut durumunda) kalır.
          ================================================================== */}
      {gorusmeDurumuKayit && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setGorusmeDurumuKayit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-neutral-900 text-white p-4">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kaydedildi ✓ · Telefon Görüşmesi'ne aktarıldı</p>
              <h3 className="font-black text-base mt-0.5">Müşteriyle Görüşme Durumu Nedir?</h3>
              <p className="text-[11px] font-bold text-neutral-300 mt-1 truncate">{gorusmeDurumuKayit.musteriAdi || 'İsimsiz'} • {gorusmeDurumuKayit.iletisim}</p>
            </div>
            <div className="p-3 space-y-2">
              {GORUSME_DURUMU_SECENEKLERI.map(sec => (
                <button key={sec.id} type="button" disabled={gorusmeDurumuKaydediliyor}
                  onClick={async () => {
                    setGorusmeDurumuKaydediliyor(true);
                    try {
                      // ÖNEMLİ: Kayıt CANLI listeden okunur (onSnapshot ile güncel).
                      // Böylece bir önceki adımda (Kaydet) yazılan not/atama hareketi
                      // hareketler dizisinde korunur; eski kopya üzerine yazılmaz.
                      const canli = kayitlar.find(x => x.id === gorusmeDurumuKayit.id) || gorusmeDurumuKayit;
                      await handleDurumDegistir(canli, sec.id);
                      // YENİ: aktarılan telefon teklifinin durumu da aynı yapılır
                      const tId = gorusmeDurumuKayit.telefonTeklifId;
                      const teklif = tId && (telefonTeklifleri.find(t => t.id === tId) || gorusmeDurumuKayit._teklif);
                      if (teklif && teklif.durum !== sec.id) {
                        await updateDoc(ttBelge(tId), { durum: sec.id, updatedAt: new Date().toISOString(),
                          hareketler: [...(teklif.hareketler || []), { tarih: new Date().toISOString(), kullanici: kullaniciAdi, islem: `Durum "${teklif.durum || 'Yeni'}" → "${sec.id}" (havuzdan)` }] });
                      }
                    }
                    finally { setGorusmeDurumuKaydediliyor(false); setGorusmeDurumuKayit(null); }
                  }}
                  className={`w-full py-3 rounded-xl text-white text-sm font-black transition shadow-lg disabled:opacity-60 flex items-center justify-between px-4 ${sec.renk} ${(gorusmeDurumuKayit.durum || 'Yeni') === sec.id ? 'ring-2 ring-offset-2 ring-neutral-900' : ''}`}>
                  <span>{sec.etiket}</span>
                  {(gorusmeDurumuKayit.durum || 'Yeni') === sec.id
                    ? <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">Mevcut</span>
                    : <ChevronRight className="w-4 h-4 opacity-70" />}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-neutral-100">
              <button type="button" onClick={() => setGorusmeDurumuKayit(null)} disabled={gorusmeDurumuKaydediliyor}
                className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black rounded-xl text-xs transition disabled:opacity-50">
                Şimdilik değiştirme — <span className="text-neutral-800">{gorusmeDurumuKayit.durum || 'Yeni'}</span> olarak kalsın
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ (kullanıcı talebi): FİYAT TABLOSU PENCERESİ */}
      {fiyatTablosuAcik && <FiyatTablosuPenceresi currentUser={currentUser} fiyatBilgi={fiyatBilgi} onKapat={() => setFiyatTablosuAcik(false)} />}
      {/* YENİ: Hızlı Fiyat Hesapla — görüşme formunun kayıtsız "hızlı modu" (aynı sorular, aynı fiyat motoru) */}
      {hizliFiyatAcik && <TelefonTeklifFormu hizli varsayilanHizmet="Nakliye" currentUser={currentUser} onKaydet={() => {}} onKapat={() => setHizliFiyatAcik(false)} />}

      {/* YENİ (kullanıcı talebi): PERSONEL TRANSFER PENCERESİ */}
      {transferKayit && (
        <PersonelTransferPenceresi baslik={transferKayit.musteriAdi || transferKayit.iletisim} mevcut={transferKayit.atanan}
          secenekler={[...new Set([...satiscilar.map(p => p.fullName), ...(tamYetki ? [kullaniciAdi] : [])])]}
          onKapat={() => setTransferKayit(null)} onTransfer={(ad, not) => handleTransfer(transferKayit, ad, not)} />
      )}

      {/* SİLME ONAYI */}
      {silinecekId && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95">
            <h3 className="font-black text-black mb-2">Kayıt silinsin mi?</h3>
            <p className="text-xs text-neutral-500 mb-4">Bu müşteri kaydı ve tüm hareket geçmişi kalıcı olarak silinecek.</p>
            <div className="flex gap-2">
              <button onClick={() => setSilinecekId(null)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-600 font-black rounded-xl text-sm">Vazgeç</button>
              <button onClick={async () => {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', silinecekId));
                addSystemLog?.('Müşteri Havuzu', 'Bir havuz kaydı silindi.');
                setSilinecekId(null);
              }} className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  // ============================================================================
  // YENİ: SAHA PORTFÖY MODÜLÜ — Satış Bölümü'nün bir parçası olarak buraya taşındı
  // (önceden ayrı SahaPortfoy.jsx dosyasındaydı; içerik AYNEN korunmuştur,
  // sadece import satırları yukarıdaki ortak import bloğuyla birleştirildi)
  // ============================================================================
// ============================================================================
// SAHA PORTFÖY MODÜLÜ — Saha satış/pazarlama ekibinin çalışma alanı
// Amaç: Emlak ofisleri, site yönetimleri, inşaat firmaları gibi İŞ ORTAKLARINI
// portföye kazandırmak; ziyaret → görüşme → anlaşma sürecini takip etmek;
// anlaşılan ortaklara komisyon/teminat carisi tutmak; yönlendirdikleri işleri
// saymak. Kartvizitler fotoğraflanıp doğrudan partnera arşivlenir.
//
// - PORTFÖY SAHİBİ: her partner bir satış personeline aittir; herkes kimin
//   portföyü olduğunu ve kimin görüştüğünü/bağladığını görür.
// - SÜREÇ DURUMLARI: Aday → Randevu Alındı → Ziyaret Edildi → Görüşülüyor
//   → Anlaşıldı (Bağlandı) → Pasif/Reddetti.
// - ZİYARET GÜNLÜĞÜ: her ziyaret tarih + görüşen personel + sonuç notuyla
//   partnera işlenir; tüm hareketler kayıt altındadır.
// - CARİ: komisyon ödemeleri ve verilen teminatlar partner detayında tutulur;
//   toplamlar kartta görünür.
// - KARTVİZİT ARŞİVİ: kamera/galeri ile çoklu kartvizit fotoğrafı yüklenir
//   (upload.php altyapısı, MediaCaptureMenu bileşeni).
// Firebase koleksiyonu: 'sahaPortfoy' (partner dokümanları; ziyaretler,
// cariHareketler, kartvizitler ve hareketGecmisi alt dizileri).
// ============================================================================

// Partner tipleri — ikon ve renkleriyle
const PARTNER_TIPLERI = [
  { id: 'Emlak Ofisi',    ikon: Home,      renk: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'Site Yönetimi',  ikon: Building2, renk: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'İnşaat Firması', ikon: HardHat,   renk: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'Kurumsal Firma', ikon: Briefcase, renk: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Diğer',          ikon: Handshake, renk: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
];

// Süreç durumları — sıralı akış
const PORTFOY_DURUMLARI = [
  { id: 'Aday',           renk: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
  { id: 'Randevu Alındı', renk: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { id: 'Ziyaret Edildi', renk: 'bg-blue-50 text-blue-700 border-blue-300' },
  { id: 'Görüşülüyor',    renk: 'bg-purple-50 text-purple-700 border-purple-300' },
  { id: 'Anlaşıldı',      renk: 'bg-green-50 text-green-700 border-green-300' },
  { id: 'Pasif',          renk: 'bg-red-50 text-red-600 border-red-200' },
];

const bugunStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const tl = (n) => `₺${(Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

export const SahaPortfoyView = ({ personnelList = [], currentUser, addSystemLog, setViewingImage,
  // YENİ (kullanıcı talebi): "QR Site Takip" butonu — App.jsx bu fonksiyonla ilgili sekmeye geçer
  onQrSiteTakip = null }) => {
  // YENİ: Yeni (henüz aranmamış) QR taleplerinin sayısı — buton üzerinde rozet olarak görünür
  const yeniQrTalep = useYeniQrTalepSayisi(!!onQrSiteTakip);
  const [partnerlar, setPartnerlar] = useState([]);
  const [arama, setArama] = useState('');
  const [tipFiltre, setTipFiltre] = useState('Tümü');
  const [durumFiltre, setDurumFiltre] = useState('Tümü');
  const [sahipFiltre, setSahipFiltre] = useState('Tümü'); // Portföy sahibi (satış personeli) filtresi
  const [detayId, setDetayId] = useState(null);           // Detay paneli açık partner
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kartvizitYukleniyor, setKartvizitYukleniyor] = useState(false);
  const [silinecekId, setSilinecekId] = useState(null);
  // Detay panelindeki hızlı işlemler için küçük formlar
  const [ziyaretForm, setZiyaretForm] = useState({ tarih: bugunStr(), not: '' });
  const [cariForm, setCariForm] = useState({ tip: 'komisyon', tutar: '', aciklama: '' });

  // ==========================================================================
  // YENİ (kullanıcı talebi): YENİ SAHA PORTFÖY TASARIMI — görünüm state'leri
  // --------------------------------------------------------------------------
  // Veri, kayıt ve işlem mantığının HİÇBİRİ değişmedi; yalnızca ekran düzeni
  // yenilendi. Aşağıdaki iki state sadece listeyi sıralamak ve büyüyen
  // portföyü parça parça (50'şer) çizmek için eklendi.
  // ==========================================================================
  const [siralama, setSiralama] = useState('yeni');   // yeni | ad | ziyaret | komisyon | randevu
  // YENİ (kullanıcı talebi): Takvim büyüt/küçült — büyükken tam satır olur
  // (eski boyut), küçükken sağ sütunda mini takvim kalır.
  const [takvimBuyuk, setTakvimBuyuk] = useState(false);
  const PORTFOY_SAYFA = 50;
  const [gosterSayisi, setGosterSayisi] = useState(PORTFOY_SAYFA);
  // Filtre / arama değişince liste başa döner
  useEffect(() => { setGosterSayisi(PORTFOY_SAYFA); }, [arama, tipFiltre, durumFiltre, sahipFiltre, siralama]);

  // ==========================================================================
  // YENİ (kullanıcı talebi): SAHA RANDEVU SİSTEMİ
  // --------------------------------------------------------------------------
  // İş akışı: Saha pazarlamacı, bir firmayı portföye eklemeden ÖNCE randevu
  // alır → takvimden takip eder → görüşmeye gider → "Gidildi → Portföye Ekle"
  // ile görüşme bilgileri HAZIR DOLDURULMUŞ portföy formuna aktarılır.
  // Randevular 'sahaRandevular' koleksiyonunda tutulur; takvim, Hatırlatmalar
  // sayfasındaki takvimle aynı tasarım dilindedir (ay ızgarası + gün simgeleri
  // + seçili günün listesi).
  // Durumlar: bekliyor → gidildi | iptal. Tarihi geçmiş "bekliyor" randevular
  // takvimde ve listede KIRMIZI uyarıyla öne çıkar (unutulan görüşme kalmasın).
  // ==========================================================================
  const [randevular, setRandevular] = useState([]);
  const [randevuFormAcik, setRandevuFormAcik] = useState(false);
  const [randevuDuzenlenenId, setRandevuDuzenlenenId] = useState(null);
  const [randevuKaydediliyor, setRandevuKaydediliyor] = useState(false);
  const [randevuSilinecekId, setRandevuSilinecekId] = useState(null);
  // ==========================================================================
  // YENİ (kullanıcı talebi): RANDEVU TARİHİNİ DEĞİŞTİR (ERTELE)
  // --------------------------------------------------------------------------
  // Takvimdeki bekleyen randevu satırında "Tarihi Değiştir" düğmesi: küçük bir
  // pencerede yeni tarih/saat seçilir. Eski tarih kaydın erteleme geçmişine
  // yazılır (kaç kez ertelendiği görünsün). Randevu portföye bağlıysa karttaki
  // "Sonraki randevu" alanı da aynı tarihe güncellenir; takvim yeni güne odaklanır.
  // ==========================================================================
  const [tarihDegistir, setTarihDegistir] = useState(null); // { randevu, tarih, saat }
  const randevuTarihiniDegistir = async () => {
    if (!tarihDegistir?.randevu) return;
    const r = tarihDegistir.randevu;
    const yeniTarih = tarihDegistir.tarih, yeniSaat = tarihDegistir.saat || r.saat || '10:00';
    if (!yeniTarih) { alert('Yeni tarih seçin.'); return; }
    if (yeniTarih === r.tarih && yeniSaat === (r.saat || '')) { setTarihDegistir(null); return; } // değişiklik yok
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', r.id), {
        tarih: yeniTarih, saat: yeniSaat,
        ertelemeGecmisi: [...(r.ertelemeGecmisi || []), { eskiTarih: r.tarih, eskiSaat: r.saat || '', yeniTarih, yeniSaat, yapan: currentUser?.fullName || 'Sistem', zaman: new Date().toISOString() }],
      });
      // Portföye bağlıysa karttaki "Sonraki randevu" da aynı tarihe çekilir
      const pf = r.portfoyId ? partnerlar.find(x => x.id === r.portfoyId) : null;
      if (pf) {
        try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', pf.id), { sonrakiRandevu: yeniTarih }); } catch (err) { console.warn(err); }
      }
      addSystemLog?.('Saha Randevu', `${r.firmaAdi} randevusu ${r.tarih.split('-').reverse().join('.')} → ${yeniTarih.split('-').reverse().join('.')} ${yeniSaat} tarihine alındı.`);
      setRSecilenGun(yeniTarih);       // Takvim yeni güne odaklansın
      setTarihDegistir(null);
    } catch (e) { console.error(e); alert('Tarih değiştirilemedi.'); }
  };
  const bosRandevuForm = {
    firmaAdi: '', tip: 'Emlak Ofisi', yetkili: '', telefon: '', bolge: '', adres: '',
    tarih: bugunStr(), saat: '10:00', atanan: currentUser?.fullName || '', not: '',
    portfoyId: null,   // YENİ: randevu mevcut bir portföy kaydına bağlıysa kimliği
  };
  const [randevuForm, setRandevuForm] = useState(bosRandevuForm);
  // YENİ (kullanıcı talebi): Yeni Randevu penceresinde portföyden arama metni
  const [randevuPortfoyArama, setRandevuPortfoyArama] = useState('');

  // ==========================================================================
  // YENİ (kullanıcı talebi): MEVCUT PORTFÖYDEN RANDEVU
  // --------------------------------------------------------------------------
  // (a) Yeni Randevu penceresinde arama kutusuna firma adı yazılınca portföy
  //     listesi süzülür; seçilen firmanın bilgileri forma dolar ve randevu o
  //     kayda BAĞLANIR (portfoyId). Böylece "Gidildi" dendiğinde ziyaret
  //     günlüğüne işlenir, "Portföye Ekle" seçeneği gereksiz yere çıkmaz.
  // (b) Portföy detay penceresindeki "Randevu Ekle" düğmesi aynı formu firma
  //     bilgileri hazır dolu ve bağlı şekilde açar.
  // ==========================================================================
  const portfoydenRandevuFormunuDoldur = (pf) => {
    setRandevuForm(f => ({
      ...f,
      firmaAdi: pf.firmaAdi || '', tip: pf.tip || 'Emlak Ofisi', yetkili: pf.yetkili || '',
      telefon: pf.telefon || '', bolge: pf.bolge || '', adres: pf.adres || '',
      atanan: pf.portfoySahibi || f.atanan || currentUser?.fullName || '',
      portfoyId: pf.id,
    }));
    setRandevuPortfoyArama('');
  };
  // Portföy detayından doğrudan randevu penceresi aç
  const portfoydenRandevuAc = (pf) => {
    setRandevuForm({ ...bosRandevuForm, tarih: pf.sonrakiRandevu && pf.sonrakiRandevu >= bugunStr() ? pf.sonrakiRandevu : bugunStr() });
    portfoydenRandevuFormunuDoldur(pf);
    setRandevuDuzenlenenId(null);
    setRandevuFormAcik(true);
  };
  // Arama sonuçları (en fazla 8; ad, yetkili veya bölgeye göre)
  const randevuPortfoySonuclari = useMemo(() => {
    const q = randevuPortfoyArama.trim().toLocaleLowerCase('tr-TR');
    if (q.length < 2) return [];
    return partnerlar
      .filter(pf => [pf.firmaAdi, pf.yetkili, pf.bolge].some(x => String(x || '').toLocaleLowerCase('tr-TR').includes(q)))
      .slice(0, 8);
  }, [randevuPortfoyArama, partnerlar]);
  // Takvim: görüntülenen ay + seçili gün
  const [rTakvim, setRTakvim] = useState(() => { const d = new Date(); return { yil: d.getFullYear(), ay: d.getMonth() }; });
  const [rSecilenGun, setRSecilenGun] = useState(bugunStr());

  // Randevuları canlı dinle
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular'), (snap) => {
      setRandevular(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Saha randevuları yüklenemedi:', err));
    return () => unsub();
  }, []);

  // Randevu kaydet (yeni / düzenle)
  const randevuKaydet = async () => {
    if (!randevuForm.firmaAdi.trim()) { alert('Firma adı girin.'); return; }
    if (!randevuForm.tarih) { alert('Randevu tarihi seçin.'); return; }
    setRandevuKaydediliyor(true);
    try {
      if (randevuDuzenlenenId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', randevuDuzenlenenId), { ...randevuForm });
        addSystemLog?.('Saha Randevu', `${randevuForm.firmaAdi} randevusu güncellendi (${randevuForm.tarih} ${randevuForm.saat}).`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular'), {
          ...randevuForm, portfoyId: randevuForm.portfoyId || null, durum: 'bekliyor',
          kaynak: randevuForm.portfoyId ? 'portfoy' : 'manuel',
          olusturan: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString(),
        });
        addSystemLog?.('Saha Randevu', `Yeni randevu: ${randevuForm.firmaAdi} — ${randevuForm.tarih} ${randevuForm.saat} (${randevuForm.atanan}).`);
        // YENİ: Portföye bağlı randevuysa karttaki "Sonraki randevu" tarihi de güncellenir
        if (randevuForm.portfoyId) {
          try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', randevuForm.portfoyId), { sonrakiRandevu: randevuForm.tarih });
          } catch (err) { console.warn('Portföy sonraki randevu güncellenemedi:', err); }
        }
      }
      setRSecilenGun(randevuForm.tarih); // kaydedince takvim o güne odaklansın
      setRandevuFormAcik(false); setRandevuDuzenlenenId(null); setRandevuForm(bosRandevuForm); setRandevuPortfoyArama('');
    } catch (e) { console.error(e); alert('Randevu kaydedilemedi.'); }
    finally { setRandevuKaydediliyor(false); }
  };

  // Durum değiştir: iptal / tekrar bekliyor
  const randevuDurum = async (r, durum) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', r.id), {
        durum, ...(durum === 'gidildi' ? { gidilmeTarihi: new Date().toISOString() } : {}),
      });
      addSystemLog?.('Saha Randevu', `${r.firmaAdi} randevusu: ${durum === 'gidildi' ? 'GİDİLDİ' : durum === 'iptal' ? 'İPTAL edildi' : 'tekrar beklemeye alındı'}.`);
    } catch (e) { console.error(e); alert('Güncellenemedi.'); }
  };

  const randevuSil = async () => {
    if (!randevuSilinecekId) return;
    try {
      const r = randevular.find(x => x.id === randevuSilinecekId);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', randevuSilinecekId));
      addSystemLog?.('Saha Randevu', `${r?.firmaAdi || ''} randevusu silindi.`);
    } catch (e) { console.error(e); }
    setRandevuSilinecekId(null);
  };

  // ANA AKIŞ (kullanıcı talebi): Görüşmeye gidildi → firma bilgileri hazır
  // doldurulmuş şekilde "Portföye Ekle" formu açılır; ikinci kez yazmaya
  // gerek kalmaz. Randevu 'gidildi' + portföye aktarıldı olarak işaretlenir.
  // ==========================================================================
  // HATA DÜZELTMESİ + YENİ (kullanıcı bildirimi):
  //  1) "GİDİLDİ • PORTFÖYDE" yazıyor ama portföy listesinde firma yok.
  //     KÖK NEDEN: Düğmeye basıldığı anda portfoyeAktarildi:true yazılıyordu —
  //     form henüz KAYDEDİLMEDEN. Form kapatılırsa rozet kalıyor, kayıt yoktu.
  //     ÇÖZÜM: Bağ artık portföy GERÇEKTEN kaydedildiğinde kurulur
  //     (handleKaydet içinde). Bekleyen bağ `bekleyenRandevuBagi` ile taşınır.
  //  2) Randevuda girilen bilgiler (not, linkler) portföye tekrar yazılmak
  //     zorunda kalınıyordu. Artık randevu notu portföyün NOTLAR alanına ve
  //     ZİYARET GÜNLÜĞÜNE otomatik geçer; kayıt açılış tarihi randevu tarihidir.
  // ==========================================================================
  const [bekleyenRandevuBagi, setBekleyenRandevuBagi] = useState(null); // { r, gidildiIsaretle }

  // Randevu bilgileriyle portföy formunu açar (tek ortak fonksiyon)
  const randevuBilgisiylePortfoyFormuAc = (r, { gidildiIsaretle }) => {
    setForm({
      ...bosForm,
      firmaAdi: r.firmaAdi || '', tip: r.tip || 'Emlak Ofisi', yetkili: r.yetkili || '',
      telefon: r.telefon || '', bolge: r.bolge || '', adres: r.adres || '',
      portfoySahibi: r.atanan || currentUser?.fullName || '',
      // Randevu notu (linkler dâhil) portföy notlarına aynen taşınır
      notlar: r.not ? `Randevu notu (${(r.tarih || '').split('-').reverse().join('.')} ${r.saat || ''}): ${r.not}` : '',
      // Görüşme yapıldıysa durum "Ziyaret Edildi", yalnızca kayıt açılıyorsa "Randevu Alındı"
      durum: gidildiIsaretle ? 'Ziyaret Edildi' : (r.durum === 'gidildi' ? 'Ziyaret Edildi' : 'Randevu Alındı'),
      // Randevu ileri tarihliyse karttaki "Sonraki randevu" alanına da yazılır
      sonrakiRandevu: (!gidildiIsaretle && r.durum === 'bekliyor' && r.tarih) ? r.tarih : '',
    });
    setBekleyenRandevuBagi({ r, gidildiIsaretle });
    setDuzenlenenId(null); setFormAcik(true);
  };

  const randevudanPortfoyeEkle = async (r) => {
    // "Gidildi" işareti hemen konur (görüşme yapıldı); PORTFÖYDE rozeti ise kayıt oluşunca
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', r.id), {
        durum: 'gidildi', gidilmeTarihi: new Date().toISOString(),
      });
    } catch (e) { console.error(e); }
    randevuBilgisiylePortfoyFormuAc({ ...r, durum: 'gidildi' }, { gidildiIsaretle: true });
    addSystemLog?.('Saha Randevu', `${r.firmaAdi} görüşmesi yapıldı → Portföye Ekle formu açıldı.`);
  };

  // YENİ (kullanıcı talebi): Randevuyu Düzenle penceresinden "Portföye Ekle"
  // Randevunun durumu DEĞİŞMEZ (bekliyor kalır); yalnızca aynı bilgilerle
  // portföy formu açılır, kaydedilince randevu bu portföye bağlanır.
  const duzenlenenRandevudanPortfoyeEkle = () => {
    const r = randevular.find(x => x.id === randevuDuzenlenenId);
    if (!r) return;
    // Formda yapılmış ama kaydedilmemiş düzenlemeler de taşınsın
    const guncel = { ...r, ...randevuForm, id: r.id, durum: r.durum };
    setRandevuFormAcik(false);
    randevuBilgisiylePortfoyFormuAc(guncel, { gidildiIsaretle: false });
  };

  // Takvim yardımcıları (Hatırlatmalar sayfasındaki desenle aynı)
  const R_AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const R_GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const rHucreler = useMemo(() => {
    const ilkIndex = (new Date(rTakvim.yil, rTakvim.ay, 1).getDay() + 6) % 7; // Pazartesi başlangıç
    const gunSayisi = new Date(rTakvim.yil, rTakvim.ay + 1, 0).getDate();
    return [...Array(ilkIndex).fill(null), ...Array.from({ length: gunSayisi }, (_, i) => i + 1)];
  }, [rTakvim]);
  const rGunRandevulari = (tarihStr) => randevular
    .filter(r => r.tarih === tarihStr)
    .sort((a, b) => (a.saat || '').localeCompare(b.saat || ''));
  const rSecilenGunListesi = rGunRandevulari(rSecilenGun);
  // Gecikmiş = tarihi geçmiş ama hâlâ "bekliyor" (görüşmeye gidilmemiş)
  const rGecikmisler = randevular.filter(r => r.durum === 'bekliyor' && r.tarih < bugunStr());
  const rBugunkuler = randevular.filter(r => r.durum === 'bekliyor' && r.tarih === bugunStr());

  const bosForm = {
    firmaAdi: '', tip: 'Emlak Ofisi', yetkili: '', telefon: '', bolge: '', adres: '',
    portfoySahibi: currentUser?.fullName || '', durum: 'Aday',
    komisyonNotu: '', sonrakiRandevu: '', notlar: '',
    kartvizitler: [],
  };
  const [form, setForm] = useState(bosForm);

  // Satış personeli listesi (portföy sahibi seçimi için) — beyaz yaka satış öncelikli,
  // ama esneklik için tüm personel seçilebilir
  const satisPersonelleri = personnelList.filter(p => p.position !== 'Firma Sahibi').map(p => p.fullName).sort();

  // ---------------------------------------------------- VERİ DİNLEME ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy'), (snap) => {
      setPartnerlar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Saha portföyü yüklenemedi:', err));
    return () => unsub();
  }, []);

  // ---------------------------------------------------- HAREKET KAYDI ---
  // Her önemli işlem (ekleme, durum değişikliği, ziyaret, cari, kartvizit)
  // partnerın hareketGecmisi dizisine kim-ne zaman bilgisiyle yazılır.
  const hareket = (tip, detay) => ({ tip, detay, yapan: currentUser?.fullName || 'Sistem', tarih: new Date().toISOString() });

  // ---------------------------------------------------- KARTVİZİT ---
  const handleKartvizitYukle = async (e, hedefPartner = null) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setKartvizitYukleniyor(true);
    const yeniler = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: fd });
        const text = await res.text();
        let url = file.name;
        try { const json = JSON.parse(text); url = json.url || json.fileName || json.file || text; } catch (err) { url = text.trim(); }
        yeniler.push({ url, name: file.name, date: new Date().toISOString(), yukleyen: currentUser?.fullName || 'Sistem' });
      } catch (err) { console.error('Kartvizit yüklenemedi:', err); alert(`"${file.name}" yüklenemedi.`); }
    }
    if (yeniler.length > 0) {
      if (hedefPartner) {
        // Mevcut partnera doğrudan ekle (detay panelinden)
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', hedefPartner.id), {
          kartvizitler: [...(hedefPartner.kartvizitler || []), ...yeniler],
          hareketGecmisi: [...(hedefPartner.hareketGecmisi || []), hareket('kartvizit', `${yeniler.length} kartvizit eklendi`)],
        });
      } else {
        // Yeni kayıt formuna ekle (henüz kaydedilmedi)
        setForm(f => ({ ...f, kartvizitler: [...f.kartvizitler, ...yeniler] }));
      }
    }
    setKartvizitYukleniyor(false);
    if (e.target) e.target.value = '';
  };

  // ---------------------------------------------------- KAYDET / SİL ---
  // ==========================================================================
  // YENİ (kullanıcı talebi): PORTFÖY "SONRAKİ RANDEVU" ↔ RANDEVU TAKVİMİ BAĞI
  // --------------------------------------------------------------------------
  // SORUN: Mevcut portföy kaydında "Sonraki randevu" tarihi girildiğinde bu
  // yalnızca kartın üstünde bir tarih olarak duruyordu; Randevu Takvimi ise
  // sadece 'sahaRandevular' koleksiyonunu okuduğu için orada görünmüyordu.
  // ÇÖZÜM: Portföy kaydedilirken sonrakiRandevu doluysa 'sahaRandevular'da o
  // portföye BAĞLI (portfoyId) bir randevu oluşturulur; tarih değişirse aynı
  // randevu güncellenir (kopya oluşmaz). Böylece takvimde görünür ve oradan
  // "Gidildi" işlenebilir.
  // ==========================================================================
  const portfoyRandevusunuEsitle = async (portfoyId, formVerisi) => {
    if (!portfoyId) return;
    const bagli = randevular.find(r => r.portfoyId === portfoyId && r.durum === 'bekliyor');
    const tarih = (formVerisi.sonrakiRandevu || '').trim();
    if (!tarih) return;                                   // Randevu tarihi yoksa dokunma
    const ortak = {
      firmaAdi: formVerisi.firmaAdi || '', tip: formVerisi.tip || 'Emlak Ofisi', yetkili: formVerisi.yetkili || '',
      telefon: formVerisi.telefon || '', bolge: formVerisi.bolge || '', adres: formVerisi.adres || '',
      tarih, atanan: formVerisi.portfoySahibi || currentUser?.fullName || '', portfoyId,
    };
    if (bagli) {
      // Tarih veya bilgiler değişmişse bağlı randevuyu güncelle (kopya oluşturma)
      if (bagli.tarih !== tarih || bagli.firmaAdi !== ortak.firmaAdi || bagli.telefon !== ortak.telefon) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', bagli.id), ortak);
      }
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular'), {
        ...ortak, saat: '10:00', not: 'Portföy kaydındaki "Sonraki randevu" alanından otomatik oluşturuldu.',
        durum: 'bekliyor', kaynak: 'portfoy',
        olusturan: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString(),
      });
      addSystemLog?.('Saha Randevu', `${ortak.firmaAdi} için portföyden randevu takvime eklendi (${tarih}).`);
    }
  };

  const handleKaydet = async () => {
    if (!form.firmaAdi.trim()) return;
    setKaydediliyor(true);
    try {
      if (duzenlenenId) {
        const p = partnerlar.find(x => x.id === duzenlenenId);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', duzenlenenId), {
          ...form,
          hareketGecmisi: [...(p?.hareketGecmisi || []), hareket('guncelleme', 'Kayıt bilgileri güncellendi')],
        });
        addSystemLog?.('Saha Portföy', `${form.firmaAdi} kaydı güncellendi.`);
        await portfoyRandevusunuEsitle(duzenlenenId, form);          // YENİ: takvime yansıt
      } else {
        // Randevudan geliyorsa: görüşme notu ziyaret günlüğüne, açılış hareket geçmişine
        const rb = bekleyenRandevuBagi;
        const ilkZiyaretler = (rb && rb.gidildiIsaretle) ? [{
          tarih: rb.r.tarih || bugunStr(),
          sonuc: `Randevu gerçekleştirildi${rb.r.not ? ` — ${rb.r.not}` : ''}`,
          yapan: rb.r.atanan || currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString(),
        }] : [];
        const ilkHareketler = [hareket('ekleme', `Portföye eklendi (${form.tip})`)];
        if (rb) ilkHareketler.push(hareket('randevu', `${(rb.r.tarih || '').split('-').reverse().join('.')} ${rb.r.saat || ''} randevusundan aktarıldı`));
        const yeniRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy'), {
          ...form,
          ziyaretler: ilkZiyaretler, cariHareketler: [],
          hareketGecmisi: ilkHareketler,
          ekleyen: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString(),
        });
        addSystemLog?.('Saha Portföy', `Yeni iş ortağı adayı eklendi: ${form.firmaAdi} (${form.tip}) — Portföy: ${form.portfoySahibi}`);
        // ================================================================
        // HATA DÜZELTMESİ: Randevu ↔ portföy bağı ANCAK ŞİMDİ kurulur.
        // Rozet ("PORTFÖYDE") ve portfoyId gerçek kayıt oluştuktan sonra yazılır;
        // form kapatılıp vazgeçilirse randevuda yanlış rozet kalmaz.
        // ================================================================
        if (rb?.r?.id) {
          try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', rb.r.id), {
              portfoyId: yeniRef.id, portfoyeAktarildi: true,
            });
          } catch (err) { console.warn('Randevu bağı yazılamadı:', err); }
          setBekleyenRandevuBagi(null);
        }
        // Randevudan geldiyse takvimde zaten var; tekrar randevu üretme
        if (!rb) await portfoyRandevusunuEsitle(yeniRef.id, form);      // takvime yansıt
      }
      setFormAcik(false); setDuzenlenenId(null); setForm(bosForm); setBekleyenRandevuBagi(null);
    } catch (e) { console.error('Partner kaydedilemedi:', e); alert('Kaydedilemedi, tekrar deneyin.'); }
    setKaydediliyor(false);
  };

  // ==========================================================================
  // YENİ (kullanıcı talebi): RANDEVU FİRMASI PORTFÖYDE Mİ?
  // Bağlı kimlikle (portfoyId) veya firma adıyla (eski randevular için) bulur.
  // Portföyde OLAN firmaya "Portföye Ekle" seçeneği sunulmaz — sadece "Gidildi".
  // ==========================================================================
  const randevununPortfoyu = (r) => {
    if (!r) return null;
    if (r.portfoyId) { const p = partnerlar.find(x => x.id === r.portfoyId); if (p) return p; }
    const ad = String(r.firmaAdi || '').trim().toLocaleLowerCase('tr-TR');
    return ad ? (partnerlar.find(x => String(x.firmaAdi || '').trim().toLocaleLowerCase('tr-TR') === ad) || null) : null;
  };

  // Portföydeki firmanın randevusu yapıldı: randevu 'gidildi' olur, portföye
  // ziyaret günlüğü satırı düşer ve karttaki "Sonraki randevu" temizlenir.
  const portfoyRandevusuGidildi = async (r, portfoy) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaRandevular', r.id), {
        durum: 'gidildi', gidilmeTarihi: new Date().toISOString(), portfoyId: portfoy.id,
      });
      const ziyaret = { tarih: r.tarih || bugunStr(), sonuc: `Randevu gerçekleştirildi${r.not ? ` — ${r.not}` : ''}`, yapan: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString() };
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', portfoy.id), {
        ziyaretler: [...(portfoy.ziyaretler || []), ziyaret],
        // Karttaki tarih bu randevuya aitse temizle (bir sonraki randevu için boş kalsın)
        ...(portfoy.sonrakiRandevu === r.tarih ? { sonrakiRandevu: '' } : {}),
        hareketGecmisi: [...(portfoy.hareketGecmisi || []), hareket('ziyaret', `Randevu gerçekleştirildi (${r.tarih}${r.saat ? ' ' + r.saat : ''})`)],
      });
      addSystemLog?.('Saha Randevu', `${r.firmaAdi} randevusu GİDİLDİ → portföy ziyaret günlüğüne işlendi.`);
    } catch (e) { console.error(e); alert('Güncellenemedi.'); }
  };

  // Durum değiştirme — "Anlaşıldı" seçilirse "bağlayan" olarak işlemi yapan yazılır
  const handleDurumDegistir = async (p, yeniDurum) => {
    const ek = {};
    if (yeniDurum === 'Anlaşıldı' && !p.baglayan) {
      ek.baglayan = currentUser?.fullName || 'Sistem';
      ek.baglanmaTarihi = new Date().toISOString();
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', p.id), {
      durum: yeniDurum, ...ek,
      hareketGecmisi: [...(p.hareketGecmisi || []), hareket('durum', `Durum "${yeniDurum}" yapıldı${ek.baglayan ? ` — Bağlayan: ${ek.baglayan}` : ''}`)],
    });
    if (yeniDurum === 'Anlaşıldı') addSystemLog?.('Saha Portföy', `${p.firmaAdi} PORTFÖYE BAĞLANDI! (${currentUser?.fullName || 'Sistem'})`);
  };

  // Ziyaret günlüğüne kayıt
  const handleZiyaretEkle = async (p) => {
    if (!ziyaretForm.not.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', p.id), {
      ziyaretler: [...(p.ziyaretler || []), { ...ziyaretForm, yapan: currentUser?.fullName || 'Sistem', createdAt: new Date().toISOString() }],
      hareketGecmisi: [...(p.hareketGecmisi || []), hareket('ziyaret', `Ziyaret yapıldı (${ziyaretForm.tarih}): ${ziyaretForm.not.slice(0, 50)}`)],
    });
    setZiyaretForm({ tarih: bugunStr(), not: '' });
  };

  // Cari hareket: komisyon ödemesi veya teminat verilmesi
  const handleCariEkle = async (p) => {
    const tutar = parseFloat(cariForm.tutar);
    if (!tutar || isNaN(tutar)) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', p.id), {
      cariHareketler: [...(p.cariHareketler || []), { tip: cariForm.tip, tutar, aciklama: cariForm.aciklama.trim(), yapan: currentUser?.fullName || 'Sistem', tarih: new Date().toISOString() }],
      hareketGecmisi: [...(p.hareketGecmisi || []), hareket('cari', `${cariForm.tip === 'komisyon' ? 'Komisyon ödendi' : cariForm.tip === 'teminat' ? 'Teminat verildi' : 'Teminat iade alındı'}: ${tl(tutar)}`)],
    });
    addSystemLog?.('Saha Portföy Cari', `${p.firmaAdi} — ${cariForm.tip === 'komisyon' ? 'Komisyon' : 'Teminat'}: ${tl(tutar)}`);
    setCariForm({ tip: 'komisyon', tutar: '', aciklama: '' });
  };

  // Yönlendirilen iş sayacı (partner bize iş gönderdiğinde +1)
  const handleYonlendirmeEkle = async (p) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', p.id), {
      yonlendirmeSayisi: (p.yonlendirmeSayisi || 0) + 1,
      hareketGecmisi: [...(p.hareketGecmisi || []), hareket('yonlendirme', 'Yönlendirilen iş kaydedildi (+1)')],
    });
  };

  const handleSil = async () => {
    if (!silinecekId) return;
    const p = partnerlar.find(x => x.id === silinecekId);
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sahaPortfoy', silinecekId));
    addSystemLog?.('Saha Portföy', `${p?.firmaAdi || ''} portföyden silindi.`);
    setSilinecekId(null); setDetayId(null);
  };

  // ---------------------------------------------------- TÜREVLER ---
  const filtreli = partnerlar.filter(p => {
    if (tipFiltre !== 'Tümü' && p.tip !== tipFiltre) return false;
    if (durumFiltre !== 'Tümü' && p.durum !== durumFiltre) return false;
    if (sahipFiltre !== 'Tümü' && p.portfoySahibi !== sahipFiltre) return false;
    if (arama.trim()) {
      const q = arama.toLowerCase();
      return (p.firmaAdi || '').toLowerCase().includes(q) || (p.yetkili || '').toLowerCase().includes(q) || (p.telefon || '').includes(arama) || (p.bolge || '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const detay = partnerlar.find(p => p.id === detayId);
  const cariOzet = (p) => {
    const h = p.cariHareketler || [];
    const komisyon = h.filter(x => x.tip === 'komisyon').reduce((s, x) => s + (x.tutar || 0), 0);
    const teminat = h.filter(x => x.tip === 'teminat').reduce((s, x) => s + (x.tutar || 0), 0)
                  - h.filter(x => x.tip === 'teminatIade').reduce((s, x) => s + (x.tutar || 0), 0);
    return { komisyon, teminat };
  };

  // Özet kartları
  const anlasilanlar = partnerlar.filter(p => p.durum === 'Anlaşıldı');
  const buHaftaZiyaret = (() => {
    const yediGunOnce = new Date(); yediGunOnce.setDate(yediGunOnce.getDate() - 7);
    return partnerlar.reduce((s, p) => s + (p.ziyaretler || []).filter(z => new Date(z.tarih) >= yediGunOnce).length, 0);
  })();
  // DEĞİŞTİ (kullanıcı talebi): "Bekleyen Randevu" artık YENİ randevu
  // sisteminden sayılır (bekliyor + günü gelmemiş/bugün) ve partner kartına
  // elle girilmiş eski "sonraki randevu" tarihleri de eklenir (geriye uyum).
  const bekleyenRandevu = randevular.filter(r => r.durum === 'bekliyor' && r.tarih >= bugunStr()).length
    + partnerlar.filter(p => p.sonrakiRandevu && p.sonrakiRandevu >= bugunStr() && p.durum !== 'Anlaşıldı' && p.durum !== 'Pasif').length;
  const toplamKomisyon = partnerlar.reduce((s, p) => s + cariOzet(p).komisyon, 0);
  const acikTeminat = partnerlar.reduce((s, p) => s + cariOzet(p).teminat, 0);

  const tipBul = (id) => PARTNER_TIPLERI.find(t => t.id === id) || PARTNER_TIPLERI[4];
  const durumBul = (id) => PORTFOY_DURUMLARI.find(d => d.id === id) || PORTFOY_DURUMLARI[0];

  // ==========================================================================
  // YENİ TASARIM — türev veriler
  // ==========================================================================
  // Son ziyaret tarihi (sıralama ve kartta "son temas" için)
  const sonZiyaretTarihi = (p) => (p.ziyaretler || []).reduce((m, z) => (z.tarih > m ? z.tarih : m), '');
  // Bu portföye bağlı, günü gelmemiş bekleyen randevu (kartta rozet olarak görünür)
  const yaklasanRandevu = (p) => randevular
    .filter(r => r.portfoyId === p.id && r.durum === 'bekliyor' && r.tarih >= bugunStr())
    .sort((a, b) => a.tarih.localeCompare(b.tarih))[0]
    || (p.sonrakiRandevu && p.sonrakiRandevu >= bugunStr() ? { tarih: p.sonrakiRandevu, saat: '' } : null);
  // Sıralama — filtreli (mevcut mantık) üzerine uygulanır, onu değiştirmez
  const siraliListe = [...filtreli].sort((a, b) => {
    if (siralama === 'ad') return (a.firmaAdi || '').localeCompare(b.firmaAdi || '', 'tr');
    if (siralama === 'ziyaret') return sonZiyaretTarihi(b).localeCompare(sonZiyaretTarihi(a));
    if (siralama === 'komisyon') return cariOzet(b).komisyon - cariOzet(a).komisyon;
    if (siralama === 'randevu') {
      const ra = yaklasanRandevu(a)?.tarih || '9999', rb = yaklasanRandevu(b)?.tarih || '9999';
      return ra.localeCompare(rb);
    }
    return (b.createdAt || '').localeCompare(a.createdAt || ''); // yeni → eski
  });
  const gorunenListe = siraliListe.slice(0, gosterSayisi);
  // Pipeline sayıları: durum dışındaki filtreler (tip / sahip / arama) uygulanır
  const pipelineTaban = partnerlar.filter(p => {
    if (tipFiltre !== 'Tümü' && p.tip !== tipFiltre) return false;
    if (sahipFiltre !== 'Tümü' && p.portfoySahibi !== sahipFiltre) return false;
    if (arama.trim()) {
      const q = arama.toLowerCase();
      return (p.firmaAdi || '').toLowerCase().includes(q) || (p.yetkili || '').toLowerCase().includes(q) || (p.telefon || '').includes(arama) || (p.bolge || '').toLowerCase().includes(q);
    }
    return true;
  });
  const pipelineSayi = (d) => d === 'Tümü' ? pipelineTaban.length : pipelineTaban.filter(p => p.durum === d).length;
  // Pipeline pill'lerinin DOLU (seçili) renkleri
  const PIPELINE_DOLU = {
    'Tümü': 'bg-neutral-900 text-white border-neutral-900',
    'Aday': 'bg-neutral-600 text-white border-neutral-600',
    'Randevu Alındı': 'bg-yellow-500 text-black border-yellow-500',
    'Ziyaret Edildi': 'bg-blue-600 text-white border-blue-600',
    'Görüşülüyor': 'bg-purple-600 text-white border-purple-600',
    'Anlaşıldı': 'bg-green-600 text-white border-green-600',
    'Pasif': 'bg-red-600 text-white border-red-600',
  };
  // Takvim hücresi için gün özeti (nokta renkleri)
  const gunOzeti = (tarihStr) => {
    const l = rGunRandevulari(tarihStr);
    return {
      toplam: l.length,
      gecikmis: l.filter(r => r.durum === 'bekliyor' && tarihStr < bugunStr()).length,
      bekleyen: l.filter(r => r.durum === 'bekliyor' && tarihStr >= bugunStr()).length,
      gidildi: l.filter(r => r.durum === 'gidildi').length,
      iptal: l.filter(r => r.durum === 'iptal').length,
    };
  };
  const tarihKisa = (t) => t ? t.split('-').reverse().slice(0, 2).join('.') : '';

  return (
    <div className="space-y-4 animate-in fade-in max-w-7xl mx-auto">
      {/* ==================================================================
          YENİ TASARIM (kullanıcı talebi): SAHA PORTFÖY — DERLİ TOPLU DÜZEN
          ------------------------------------------------------------------
          • Üstte tek satır: başlık + iki ana buton.
          • Altında ince KPI şeridi (5 sayı, tek satır).
          • Gövde iki sütun: SOLDA Portföy (pipeline sekmeleri, arama/filtre,
            kart-satır listesi, 50'şer yükleme), SAĞDA Ajanda (mini takvim +
            günün randevuları, ekranla birlikte kayar).
          • Veri ve işlem fonksiyonları eskisiyle BİREBİR aynı.
          ================================================================== */}

      {/* BAŞLIK + ANA BUTONLAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0"><Handshake className="w-6 h-6" /></span>
          <div>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Saha Pazarlama Ekibi</p>
            <h2 className="text-2xl font-black text-black leading-tight">Saha Portföy</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* YENİ (kullanıcı talebi): QR SİTE TAKİP — asansör afişi reklamlarının QR takibi.
              Yeni talep varsa sayısı sarı rozetle görünür. */}
          {onQrSiteTakip && (
            <button type="button" onClick={onQrSiteTakip}
              className="relative px-4 py-2.5 bg-black hover:bg-neutral-800 text-amber-400 font-black rounded-xl shadow-lg shadow-black/25 transition flex items-center gap-2 text-sm">
              <QrCode className="w-4 h-4" /> QR Site Takip
              {yeniQrTalep > 0 && <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 bg-amber-400 text-black text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">{yeniQrTalep}</span>}
            </button>
          )}
          <button type="button" onClick={() => { setRandevuForm({ ...bosRandevuForm, tarih: rSecilenGun || bugunStr(), atanan: currentUser?.fullName || '' }); setRandevuDuzenlenenId(null); setRandevuFormAcik(true); }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4" /> Randevu Ekle
          </button>
          <button type="button" onClick={() => { setForm({ ...bosForm, portfoySahibi: currentUser?.fullName || '' }); setDuzenlenenId(null); setFormAcik(true); }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/25 transition flex items-center gap-2 text-sm">
            <PlusCircle className="w-4 h-4" /> Portföye Ekle
          </button>
        </div>
      </div>

      {/* KPI ŞERİDİ — tek satır, koyu zemin */}
      <div className="bg-neutral-900 rounded-2xl p-1.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
        {[
          { ad: 'Toplam Portföy', deger: partnerlar.length, Ikon: Users, renk: 'text-white', tik: () => setDurumFiltre('Tümü') },
          { ad: 'Anlaşılan', deger: anlasilanlar.length, Ikon: Star, renk: 'text-green-400', tik: () => setDurumFiltre('Anlaşıldı') },
          { ad: 'Bu Hafta Ziyaret', deger: buHaftaZiyaret, Ikon: MapPin, renk: 'text-blue-400', tik: () => setSiralama('ziyaret') },
          { ad: 'Bekleyen Randevu', deger: bekleyenRandevu, Ikon: CalendarDays, renk: 'text-yellow-400', tik: () => setSiralama('randevu') },
          { ad: 'Komisyon / Teminat', deger: `${tl(toplamKomisyon)} / ${tl(acikTeminat)}`, Ikon: Wallet, renk: 'text-orange-400', kucuk: true, tik: () => setSiralama('komisyon') },
        ].map(k => (
          <button key={k.ad} type="button" onClick={k.tik} className="text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition">
            <p className="text-[9px] font-black uppercase text-neutral-400 flex items-center gap-1"><k.Ikon className={`w-3 h-3 ${k.renk}`} /> {k.ad}</p>
            <p className={`${k.kucuk ? 'text-sm' : 'text-xl'} font-black ${k.renk} leading-tight mt-0.5`}>{k.deger}</p>
          </button>
        ))}
      </div>

      {/* GÖVDE — iki sütun (takvim büyütülünce tek sütun: takvim üstte tam satır) */}
      <div className={`grid grid-cols-1 gap-4 items-start ${takvimBuyuk ? '' : 'lg:grid-cols-3'}`}>

        {/* ============================ SOL: PORTFÖY ============================ */}
        <div className={`space-y-3 ${takvimBuyuk ? 'order-2' : 'lg:col-span-2'}`}>

          {/* PIPELINE — süreç durumları sekme gibi; sayılar arama/filtreye göre */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-2 flex items-center gap-1.5 overflow-x-auto">
            {['Tümü', ...PORTFOY_DURUMLARI.map(d => d.id)].map(d => {
              const secili = durumFiltre === d;
              const pasifRenk = d === 'Tümü' ? 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400' : `${durumBul(d).renk} hover:opacity-100 opacity-80`;
              return (
                <button key={d} type="button" onClick={() => setDurumFiltre(d)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black border transition flex items-center gap-1.5 ${secili ? PIPELINE_DOLU[d] : pasifRenk}`}>
                  {d}
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${secili ? 'bg-white/25' : 'bg-white/70'}`}>{pipelineSayi(d)}</span>
                </button>
              );
            })}
          </div>

          {/* ARAÇ ÇUBUĞU — arama + filtreler + sıralama */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-2 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Firma, yetkili, telefon veya bölge ara..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-600" />
            </div>
            <select value={tipFiltre} onChange={e => setTipFiltre(e.target.value)} className="px-3 py-2 text-xs font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none">
              <option value="Tümü">Tüm Tipler</option>
              {PARTNER_TIPLERI.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
            </select>
            <select value={sahipFiltre} onChange={e => setSahipFiltre(e.target.value)} className="px-3 py-2 text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-xl outline-none">
              <option value="Tümü">Tüm Portföy Sahipleri</option>
              {[...new Set(partnerlar.map(p => p.portfoySahibi).filter(Boolean))].sort().map(sh => <option key={sh} value={sh}>{sh}</option>)}
            </select>
            <select value={siralama} onChange={e => setSiralama(e.target.value)} className="px-3 py-2 text-xs font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none">
              <option value="yeni">Sırala: En Yeni</option>
              <option value="ad">Sırala: A → Z</option>
              <option value="ziyaret">Sırala: Son Ziyaret</option>
              <option value="randevu">Sırala: Yaklaşan Randevu</option>
              <option value="komisyon">Sırala: Komisyon</option>
            </select>
            {(arama || tipFiltre !== 'Tümü' || durumFiltre !== 'Tümü' || sahipFiltre !== 'Tümü') && (
              <button type="button" onClick={() => { setArama(''); setTipFiltre('Tümü'); setDurumFiltre('Tümü'); setSahipFiltre('Tümü'); }}
                className="px-2.5 py-2 text-[11px] font-black text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-1"><X className="w-3.5 h-3.5" /> Temizle</button>
            )}
          </div>

          {/* LİSTE — kart-satırlar; tıklanınca detay açılır */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            {siraliListe.length === 0 ? (
              <div className="p-12 text-center">
                <Handshake className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                <p className="text-neutral-500 font-bold">{partnerlar.length === 0 ? 'Henüz portföy kaydı yok.' : 'Filtrelere uygun kayıt bulunamadı.'}</p>
                <p className="text-neutral-400 text-xs mt-1">{partnerlar.length === 0 ? '"Portföye Ekle" ile ilk iş ortağı adayınızı ekleyin.' : 'Aramayı veya filtreleri değiştirin.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {gorunenListe.map(p => {
                  const tip = tipBul(p.tip); const durum = durumBul(p.durum); const TipIkon = tip.ikon;
                  const co = cariOzet(p);
                  const ziyaretSayisi = (p.ziyaretler || []).length;
                  const sonZ = sonZiyaretTarihi(p);
                  const rnd = yaklasanRandevu(p);
                  const sahipBasHarf = (p.portfoySahibi || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={p.id} onClick={() => setDetayId(p.id)}
                      className="group flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 cursor-pointer transition">
                      {/* Tip ikonu — renkli kare */}
                      <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${tip.renk}`} title={p.tip}><TipIkon className="w-5 h-5" /></span>

                      {/* Firma + yetkili + bölge */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-black text-sm truncate">{p.firmaAdi}</span>
                          {p.durum === 'Anlaşıldı' && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400 shrink-0" />}
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${durum.renk}`}>{p.durum}</span>
                          {rnd && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-600 text-white flex items-center gap-1"><CalendarDays className="w-2.5 h-2.5" /> {tarihKisa(rnd.tarih)}{rnd.saat ? ` ${rnd.saat}` : ''}</span>}
                        </div>
                        <div className="text-[11px] font-bold text-neutral-500 mt-0.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap">
                          {p.yetkili && <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" />{p.yetkili}</span>}
                          {p.telefon && <a href={`tel:${p.telefon}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-blue-600 hover:underline"><Phone className="w-3 h-3" />{p.telefon}</a>}
                          {p.bolge && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{p.bolge}</span>}
                        </div>
                      </div>

                      {/* Mini istatistikler (geniş ekranda) */}
                      <div className="hidden md:flex items-center gap-1.5 shrink-0">
                        <span className="text-center px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 min-w-[54px]" title={sonZ ? `Son ziyaret: ${tarihKisa(sonZ)}` : 'Ziyaret yok'}>
                          <span className="block text-sm font-black text-blue-700 leading-none">{ziyaretSayisi}</span>
                          <span className="block text-[8px] font-black uppercase text-blue-400 mt-0.5">ziyaret</span>
                        </span>
                        <span className="text-center px-2 py-1 rounded-lg bg-neutral-50 border border-neutral-200 min-w-[54px]">
                          <span className="block text-sm font-black text-neutral-700 leading-none">{p.yonlendirmeSayisi || 0}</span>
                          <span className="block text-[8px] font-black uppercase text-neutral-400 mt-0.5">iş</span>
                        </span>
                        {(co.komisyon > 0 || co.teminat > 0) && (
                          <span className="text-right px-2 py-1 rounded-lg bg-green-50 border border-green-100 min-w-[80px]">
                            <span className="block text-[11px] font-black text-green-700 leading-none">{tl(co.komisyon)}</span>
                            <span className="block text-[9px] font-black text-orange-600 mt-0.5">{tl(co.teminat)} teminat</span>
                          </span>
                        )}
                      </div>

                      {/* Portföy sahibi — baş harf rozeti */}
                      <span className="w-8 h-8 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center shrink-0" title={`Portföy sahibi: ${p.portfoySahibi || '—'}${p.baglayan ? ` • Bağlayan: ${p.baglayan}` : ''}`}>{sahipBasHarf}</span>
                      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-600 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
            {/* Sayfalama — büyüyen portföy için */}
            {siraliListe.length > 0 && (
              <div className="p-2.5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-neutral-500">{gorunenListe.length} / {siraliListe.length} kayıt</span>
                {gorunenListe.length < siraliListe.length && (
                  <button type="button" onClick={() => setGosterSayisi(x => x + PORTFOY_SAYFA)}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg text-[11px] font-black transition flex items-center gap-1">
                    <ChevronDown className="w-3.5 h-3.5" /> Daha Fazla Göster
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================ SAĞ: AJANDA ============================ */}
        <div className={`space-y-3 ${takvimBuyuk ? 'order-1' : 'lg:col-span-1 lg:sticky lg:top-4'}`}>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            {/* Ajanda başlığı + uyarılar */}
            <div className="p-3 bg-indigo-600 text-white">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Ajanda</h3>
                {/* YENİ (kullanıcı talebi): üst ORTADA Büyüt / Küçült */}
                <button type="button" onClick={() => setTakvimBuyuk(b => !b)}
                  title={takvimBuyuk ? 'Takvimi küçült (sağ sütuna al)' : 'Takvimi büyüt (tam satır, eski boyut)'}
                  className="text-[11px] font-black px-3 py-1.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 transition flex items-center gap-1.5 shadow-sm">
                  {takvimBuyuk ? <><ChevronDown className="w-3.5 h-3.5 rotate-180" /> Küçült</> : <><ArrowUpRight className="w-3.5 h-3.5" /> Büyüt</>}
                </button>
                <button type="button" onClick={() => { const d = new Date(); setRTakvim({ yil: d.getFullYear(), ay: d.getMonth() }); setRSecilenGun(bugunStr()); }}
                  className="text-[10px] font-black px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition">Bugün</button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-white/20">{rBugunkuler.length} randevu bugün</span>
                {rGecikmisler.length > 0 && (
                  <button type="button" onClick={() => { const t = rGecikmisler[0].tarih; setRSecilenGun(t); setRTakvim({ yil: Number(t.slice(0, 4)), ay: Number(t.slice(5, 7)) - 1 }); }}
                    className="text-[10px] font-black px-2 py-1 rounded-full bg-red-500 hover:bg-red-400 transition flex items-center gap-1 animate-pulse"><AlertTriangle className="w-3 h-3" /> {rGecikmisler.length} gecikmiş</button>
                )}
              </div>
            </div>

            {/* Mini takvim */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setRTakvim(t => { const d = new Date(t.yil, t.ay - 1, 1); return { yil: d.getFullYear(), ay: d.getMonth() }; })} className="p-1.5 hover:bg-neutral-100 rounded-lg transition"><ChevronLeft className="w-4 h-4" /></button>
                <h4 className="text-sm font-black">{R_AYLAR[rTakvim.ay]} {rTakvim.yil}</h4>
                <button type="button" onClick={() => setRTakvim(t => { const d = new Date(t.yil, t.ay + 1, 1); return { yil: d.getFullYear(), ay: d.getMonth() }; })} className="p-1.5 hover:bg-neutral-100 rounded-lg transition"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {R_GUNLER.map(g => <div key={g} className={`text-center font-black text-neutral-400 ${takvimBuyuk ? 'text-[11px] py-1' : 'text-[9px]'}`}>{g}</div>)}
              </div>
              <div className={`grid grid-cols-7 ${takvimBuyuk ? 'gap-1.5' : 'gap-1'}`}>
                {rHucreler.map((gun, i) => {
                  if (gun === null) return <div key={`rb${i}`} />;
                  const tarihStr = `${rTakvim.yil}-${String(rTakvim.ay + 1).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
                  const oz = gunOzeti(tarihStr);
                  const secili = tarihStr === rSecilenGun;
                  const buGun = tarihStr === bugunStr();
                  // Hücre rengi: gecikmiş kırmızı > bekleyen çivit > gidildi yeşil > boş
                  const zemin = secili ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : oz.gecikmis ? 'bg-red-50 border-red-300 text-red-700 hover:border-red-500'
                    : oz.bekleyen ? 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:border-indigo-400'
                    : oz.gidildi ? 'bg-green-50 border-green-200 text-green-800 hover:border-green-400'
                    : 'bg-white border-neutral-100 text-neutral-600 hover:border-neutral-300';
                  return (
                    <button key={gun} type="button" onClick={() => setRSecilenGun(tarihStr)}
                      title={oz.toplam ? `${oz.toplam} randevu` : ''}
                      className={`relative rounded-lg border font-black transition ${zemin} ${buGun && !secili ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                        ${takvimBuyuk ? 'min-h-[54px] p-1.5 text-sm flex flex-col justify-between items-start rounded-xl border-2' : 'h-11 text-xs flex flex-col items-center justify-center'}`}>
                      <span>{gun}</span>
                      {/* DEĞİŞTİ (kullanıcı talebi): HER randevu için ayrı simge —
                          eskisi gibi. Küçük modda mini, büyük modda eski boyut. */}
                      {oz.toplam > 0 && (() => {
                        const gunRnd = rGunRandevulari(tarihStr);
                        const ik = takvimBuyuk ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
                        const maks = takvimBuyuk ? 4 : 3;
                        return (
                          <span className="flex flex-wrap items-center gap-0.5 mt-0.5">
                            {gunRnd.slice(0, maks).map((r, x) => (
                              r.durum === 'gidildi'
                                ? <CheckCircle key={x} className={`${ik} ${secili ? 'text-white' : 'text-green-600'}`} title={`${r.saat || ''} ${r.firmaAdi} — Gidildi`} />
                                : r.durum === 'iptal'
                                  ? <XCircle key={x} className={`${ik} ${secili ? 'text-white/60' : 'text-neutral-300'}`} title={`${r.firmaAdi} — İptal`} />
                                  : tarihStr < bugunStr()
                                    ? <AlertTriangle key={x} className={`${ik} ${secili ? 'text-white' : 'text-red-500'}`} title={`${r.firmaAdi} — Gecikmiş (gidilmedi)`} />
                                    : <Clock key={x} className={`${ik} ${secili ? 'text-white' : 'text-indigo-500'}`} title={`${r.saat || ''} ${r.firmaAdi} — Bekliyor`} />
                            ))}
                            {gunRnd.length > maks && <span className={`text-[8px] font-black ${secili ? 'text-white' : 'text-neutral-500'}`}>+{gunRnd.length - maks}</span>}
                          </span>
                        );
                      })()}
                      {oz.toplam > 1 && <span className={`absolute -top-1 -right-1 text-[8px] font-black px-1 rounded-full ${secili ? 'bg-white text-indigo-700' : 'bg-neutral-900 text-white'}`}>{oz.toplam}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[9px] font-bold text-neutral-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-indigo-500" /> Bekleyen</span>
                <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /> Gecikmiş</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Gidildi</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-neutral-300" /> İptal</span>
              </div>
            </div>

            {/* Seçili günün randevuları — mevcut liste kodu AYNEN korunur */}
            <div className={`border-t border-neutral-100 p-3 ${takvimBuyuk ? '' : 'max-h-[60vh] overflow-y-auto'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-xs font-black text-neutral-700 leading-tight">
                  {new Date(rSecilenGun + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                  <span className="text-neutral-400 font-bold"> • {rSecilenGunListesi.length} randevu</span>
                </h4>
                <button type="button" onClick={() => { setRandevuForm({ ...bosRandevuForm, tarih: rSecilenGun, atanan: currentUser?.fullName || '' }); setRandevuDuzenlenenId(null); setRandevuFormAcik(true); }}
                  className="shrink-0 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition" title="Bu güne randevu ekle">
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>
          {rSecilenGunListesi.length === 0 ? (
            <p className="text-xs font-medium text-neutral-400 py-4 text-center">Bu güne randevu yok.</p>
          ) : (
            <div className="space-y-2">
              {rSecilenGunListesi.map(r => {
                const gecikmis = r.durum === 'bekliyor' && r.tarih < bugunStr();
                return (
                  <div key={r.id} className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${
                    r.durum === 'gidildi' ? 'border-green-200 bg-green-50/60'
                    : r.durum === 'iptal' ? 'border-neutral-200 bg-neutral-50 opacity-60'
                    : gecikmis ? 'border-red-300 bg-red-50/70' : 'border-indigo-200 bg-indigo-50/40'}`}>
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="shrink-0 text-xs font-black bg-neutral-900 text-white rounded-lg px-2 py-1">{r.saat || '--:--'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-sm text-neutral-800 break-words flex items-center gap-1.5 flex-wrap">
                          {r.firmaAdi}
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-white border border-neutral-200 text-neutral-500">{r.tip}</span>
                          {/* DEĞİŞTİ: "PORTFÖYDE" rozeti bayrağa değil GERÇEK kayda bakar */}
                          {r.durum === 'gidildi' && (() => {
                            const pfVar = !!randevununPortfoyu(r);
                            return (
                              <>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-600 text-white">GİDİLDİ{pfVar ? ' • PORTFÖYDE' : ''}</span>
                                {!pfVar && (
                                  <button type="button" onClick={() => randevuBilgisiylePortfoyFormuAc(r, { gidildiIsaretle: true })}
                                    title="Bu görüşme portföye eklenmemiş — aynı bilgilerle ekle"
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition">
                                    + Portföye Ekle
                                  </button>
                                )}
                              </>
                            );
                          })()}
                          {r.durum === 'iptal' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-neutral-400 text-white">İPTAL</span>}
                          {gecikmis && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-600 text-white">GECİKMİŞ</span>}
                        </div>
                        <div className="text-[11px] font-bold text-neutral-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {r.yetkili && <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.yetkili}</span>}
                          {r.telefon && <a href={`tel:${r.telefon}`} className="flex items-center gap-1 text-indigo-600 hover:underline"><Phone className="w-3 h-3" />{r.telefon}</a>}
                          {r.bolge && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.bolge}</span>}
                          {r.atanan && <span className="flex items-center gap-1 text-purple-600"><Handshake className="w-3 h-3" />{r.atanan}</span>}
                        </div>
                        {r.not && <p className="text-[11px] font-medium text-neutral-500 italic mt-1">{r.not}</p>}
                      </div>
                    </div>
                    {/* DEĞİŞTİ (kullanıcı talebi): işlem butonları randevu bilgisinin ALTINDA, ayraçla */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-black/5">
                      {r.durum === 'bekliyor' && (() => {
                        // DEĞİŞTİ (kullanıcı talebi): seçenekler DURUMA GÖRE sunulur.
                        //  • Firma zaten portföydeyse tek seçenek: "Gidildi" (portföye
                        //    ziyaret olarak işlenir) + İptal. "Portföye Ekle" gösterilmez.
                        //  • Firma portföyde değilse iki seçenek: "Gidildi → Portföye Ekle"
                        //    veya "Sadece Gidildi" + İptal.
                        const portfoy = randevununPortfoyu(r);
                        return (
                          <>
                            {portfoy ? (
                              <button type="button" onClick={() => portfoyRandevusuGidildi(r, portfoy)}
                                title={`${portfoy.firmaAdi} zaten portföyde — görüşme ziyaret günlüğüne işlenir`}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg transition whitespace-nowrap flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Gidildi
                              </button>
                            ) : (
                              <>
                                {/* ANA AKIŞ: görüşme yapıldı → bilgiler hazır dolu portföy formu açılır */}
                                <button type="button" onClick={() => randevudanPortfoyeEkle(r)}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg transition whitespace-nowrap flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> Gidildi → Portföye Ekle
                                </button>
                                <button type="button" onClick={() => randevuDurum(r, 'gidildi')}
                                  title="Görüşme yapıldı ama şimdilik portföye eklenmeyecek"
                                  className="px-2.5 py-1.5 bg-white border border-green-400 text-green-700 hover:bg-green-50 text-[10px] font-black rounded-lg transition whitespace-nowrap">Sadece Gidildi</button>
                              </>
                            )}
                            {/* YENİ (kullanıcı talebi): Randevuyu ertele — yeni tarih/saat seç */}
                            <button type="button" onClick={() => setTarihDegistir({ randevu: r, tarih: r.tarih, saat: r.saat || '10:00' })}
                              title="Randevunun tarihini / saatini değiştir"
                              className="px-2.5 py-1.5 bg-white border border-amber-400 text-amber-700 hover:bg-amber-50 text-[10px] font-black rounded-lg transition whitespace-nowrap flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> Tarihi Değiştir{(r.ertelemeGecmisi || []).length > 0 ? ` (${r.ertelemeGecmisi.length}×)` : ''}
                            </button>
                            <button type="button" onClick={() => randevuDurum(r, 'iptal')}
                              title="Randevuyu iptal et (gerekirse sonra tekrar aktifleştirilebilir)"
                              className="px-2.5 py-1.5 bg-white border border-neutral-300 text-neutral-500 hover:bg-neutral-100 text-[10px] font-black rounded-lg transition">İptal Et</button>
                          </>
                        );
                      })()}
                      {r.durum === 'iptal' && (
                        <button type="button" onClick={() => randevuDurum(r, 'bekliyor')}
                          className="px-2.5 py-1.5 bg-white border border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-[10px] font-black rounded-lg transition">Tekrar Aktifleştir</button>
                      )}
                      <button type="button" onClick={() => { setRandevuForm({ firmaAdi: r.firmaAdi || '', tip: r.tip || 'Emlak Ofisi', yetkili: r.yetkili || '', telefon: r.telefon || '', bolge: r.bolge || '', adres: r.adres || '', tarih: r.tarih, saat: r.saat || '', atanan: r.atanan || '', not: r.not || '' }); setRandevuDuzenlenenId(r.id); setRandevuFormAcik(true); }}
                        className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle"><Edit className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setRandevuSilinecekId(r.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Sil"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* RANDEVU FORMU (yeni / düzenle) */}
      {/* HATA DÜZELTMESİ (kullanıcı bildirimi): Portföy detayındaki "Randevu Ekle"
          basılınca form ARKADA kalıyordu. Sebep: detay penceresi z-[9997], randevu
          formu z-50 idi. Form artık detayın üstünde (z-[9998]); detay açıkken
          doğrudan buradan randevu eklenebilir, detay kapanmaz. */}
      {randevuFormAcik && (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4" onClick={() => setRandevuFormAcik(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-indigo-700 flex items-center gap-2"><CalendarDays className="w-5 h-5" /> {randevuDuzenlenenId ? 'Randevuyu Düzenle' : 'Yeni Randevu'}</h3>
              <button type="button" onClick={() => setRandevuFormAcik(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition"><X className="w-5 h-5" /></button>
            </div>
            {/* YENİ (kullanıcı talebi): Mevcut portföyden seç — ad yazınca listeden bul */}
            {!randevuDuzenlenenId && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
                <label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1"><Search className="w-3 h-3" /> Mevcut Portföyden Seç (isteğe bağlı)</label>
                {randevuForm.portfoyId ? (
                  <div className="flex items-center justify-between gap-2 mt-1 bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs font-black text-indigo-800 truncate">✓ {randevuForm.firmaAdi} <span className="font-bold text-neutral-400">• portföye bağlı</span></span>
                    <button type="button" onClick={() => setRandevuForm({ ...bosRandevuForm, tarih: randevuForm.tarih, saat: randevuForm.saat, atanan: randevuForm.atanan, not: randevuForm.not })}
                      className="text-[10px] font-black text-red-600 hover:underline shrink-0">Bağı kaldır</button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <input value={randevuPortfoyArama} onChange={e => setRandevuPortfoyArama(e.target.value)}
                      placeholder="Firma / yetkili / bölge yazın..." className="w-full p-2.5 border border-indigo-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-600" />
                    {randevuPortfoySonuclari.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        {randevuPortfoySonuclari.map(pf => (
                          <button key={pf.id} type="button" onClick={() => portfoydenRandevuFormunuDoldur(pf)}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-neutral-100 last:border-0">
                            <div className="text-xs font-black text-neutral-800">{pf.firmaAdi}</div>
                            <div className="text-[10px] font-bold text-neutral-500">{pf.tip}{pf.yetkili ? ` • ${pf.yetkili}` : ''}{pf.bolge ? ` • ${pf.bolge}` : ''} • {pf.durum}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {randevuPortfoyArama.trim().length >= 2 && randevuPortfoySonuclari.length === 0 && (
                      <p className="text-[10px] font-bold text-neutral-400 mt-1">Portföyde eşleşen kayıt yok — aşağıya yeni firma olarak yazabilirsiniz.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2"><label className="text-[10px] font-black uppercase text-neutral-400">Firma Adı *</label>
                <input value={randevuForm.firmaAdi} onChange={e => setRandevuForm({ ...randevuForm, firmaAdi: e.target.value })} placeholder="Örn: İstanbul Kepenk" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-600" /></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Tip</label>
                <select value={randevuForm.tip} onChange={e => setRandevuForm({ ...randevuForm, tip: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm bg-white outline-none">
                  {PARTNER_TIPLERI.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                </select></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Yetkili</label>
                <input value={randevuForm.yetkili} onChange={e => setRandevuForm({ ...randevuForm, yetkili: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none" /></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Telefon</label>
                <input value={randevuForm.telefon} onChange={e => setRandevuForm({ ...randevuForm, telefon: e.target.value })} inputMode="tel" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none" /></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Bölge</label>
                <input value={randevuForm.bolge} onChange={e => setRandevuForm({ ...randevuForm, bolge: e.target.value })} placeholder="Örn: Başakşehir" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-black uppercase text-neutral-400">Adres</label>
                <input value={randevuForm.adres} onChange={e => setRandevuForm({ ...randevuForm, adres: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none" /></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Tarih *</label>
                <input type="date" value={randevuForm.tarih} onChange={e => setRandevuForm({ ...randevuForm, tarih: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none" /></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Saat</label>
                <input type="time" value={randevuForm.saat} onChange={e => setRandevuForm({ ...randevuForm, saat: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-black uppercase text-neutral-400">Görüşmeye Gidecek (Saha Pazarlamacı)</label>
                <select value={randevuForm.atanan} onChange={e => setRandevuForm({ ...randevuForm, atanan: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm bg-white outline-none">
                  <option value="">— Seçin —</option>
                  {satisPersonelleri.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-black uppercase text-neutral-400">Not (görüşme amacı, dikkat edilecekler)</label>
                <textarea value={randevuForm.not} onChange={e => setRandevuForm({ ...randevuForm, not: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none h-16 resize-none" /></div>
            </div>
            <button type="button" onClick={randevuKaydet} disabled={randevuKaydediliyor}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-50">
              {randevuKaydediliyor ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {randevuDuzenlenenId ? 'Randevuyu Güncelle' : 'Randevuyu Kaydet'}
            </button>
            {/* YENİ (kullanıcı talebi): Düzenleme penceresinden doğrudan portföye ekle.
                Buradaki bilgiler (firma, yetkili, telefon, bölge, adres, not) aynen
                portföy formuna geçer; randevu bekliyor kalır ve kayıt oluşunca bağlanır. */}
            {randevuDuzenlenenId && !randevununPortfoyu(randevular.find(x => x.id === randevuDuzenlenenId)) && (
              <button type="button" onClick={duzenlenenRandevudanPortfoyeEkle}
                className="w-full py-2.5 bg-white border-2 border-red-500 text-red-700 hover:bg-red-50 font-black rounded-2xl transition flex items-center justify-center gap-2">
                <PlusCircle className="w-4 h-4" /> Bu Bilgilerle Portföye Ekle
              </button>
            )}
          </div>
        </div>
      )}

      {/* RANDEVU SİLME ONAYI */}
      {/* YENİ: TARİHİ DEĞİŞTİR penceresi — detay penceresinin de üstünde açılır */}
      {tarihDegistir && (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4" onClick={() => setTarihDegistir(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-amber-700 flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Tarihi Değiştir</h3>
              <button type="button" onClick={() => setTarihDegistir(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs">
              <p className="font-black text-amber-900">{tarihDegistir.randevu.firmaAdi}</p>
              <p className="font-bold text-amber-700">Mevcut: {tarihDegistir.randevu.tarih?.split('-').reverse().join('.')} {tarihDegistir.randevu.saat || ''}</p>
              {(tarihDegistir.randevu.ertelemeGecmisi || []).length > 0 && (
                <p className="text-[10px] font-bold text-amber-600 mt-1">Bu randevu daha önce {tarihDegistir.randevu.ertelemeGecmisi.length} kez ertelendi.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Yeni Tarih *</label>
                <input type="date" value={tarihDegistir.tarih} onChange={e => setTarihDegistir({ ...tarihDegistir, tarih: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500" /></div>
              <div><label className="text-[10px] font-black uppercase text-neutral-400">Saat</label>
                <input type="time" value={tarihDegistir.saat} onChange={e => setTarihDegistir({ ...tarihDegistir, saat: e.target.value })} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500" /></div>
            </div>
            {/* Hızlı seçimler */}
            <div className="flex flex-wrap gap-1.5">
              {[['Yarın', 1], ['+3 gün', 3], ['1 hafta', 7], ['2 hafta', 14]].map(([ad, gun]) => {
                const d = new Date(); d.setDate(d.getDate() + gun);
                const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return <button key={ad} type="button" onClick={() => setTarihDegistir({ ...tarihDegistir, tarih: t })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition ${tarihDegistir.tarih === t ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}>{ad}</button>;
              })}
            </div>
            {tarihDegistir.randevu.portfoyId && <p className="text-[10px] font-bold text-indigo-600">Portföy kartındaki "Sonraki randevu" da bu tarihe güncellenecek.</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setTarihDegistir(null)} className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl transition">Vazgeç</button>
              <button type="button" onClick={randevuTarihiniDegistir} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition">Tarihi Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {randevuSilinecekId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRandevuSilinecekId(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 space-y-3 text-center" onClick={e => e.stopPropagation()}>
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="font-black text-neutral-800">Randevu silinsin mi?</p>
            <p className="text-xs font-medium text-neutral-500">Bu işlem geri alınamaz. Görüşme yapıldıysa silmek yerine "Gidildi" olarak işaretleyin.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRandevuSilinecekId(null)} className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl transition">Vazgeç</button>
              <button type="button" onClick={randevuSil} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition">Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================ DETAY PANELİ ============================ */}
      {detay && (
        <div className="fixed inset-0 bg-black/70 z-[9997] flex items-center justify-center p-3 animate-in fade-in" onClick={() => setDetayId(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            {/* Panel başlığı */}
            <div className="p-4 border-b border-neutral-200 flex items-start justify-between shrink-0 gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-lg text-black flex items-center gap-2">{detay.firmaAdi}{detay.durum === 'Anlaşıldı' && <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />}</h3>
                <p className="text-[11px] font-bold text-neutral-500 mt-0.5">{detay.tip} • {detay.bolge || 'Bölge girilmemiş'} • Portföy: <span className="text-purple-700">{detay.portfoySahibi}</span>{detay.baglayan && <> • Bağlayan: <span className="text-green-600">{detay.baglayan}</span></>}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* YENİ (kullanıcı talebi): Mevcut portföye doğrudan randevu ekle */}
                <button type="button" onClick={() => portfoydenRandevuAc(detay)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5" title="Bu firmaya yeni randevu oluştur (takvime düşer)">
                  <CalendarDays className="w-4 h-4" /> Randevu Ekle
                </button>
                <button type="button" onClick={() => { setForm({ firmaAdi: detay.firmaAdi, tip: detay.tip, yetkili: detay.yetkili || '', telefon: detay.telefon || '', bolge: detay.bolge || '', adres: detay.adres || '', portfoySahibi: detay.portfoySahibi || '', durum: detay.durum, komisyonNotu: detay.komisyonNotu || '', sonrakiRandevu: detay.sonrakiRandevu || '', notlar: detay.notlar || '', kartvizitler: detay.kartvizitler || [] }); setDuzenlenenId(detay.id); setFormAcik(true); }}
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl border border-blue-100 transition" title="Düzenle"><Edit className="w-4 h-4" /></button>
                <button type="button" onClick={() => setSilinecekId(detay.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-100 transition" title="Sil"><Trash2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => setDetayId(null)} className="p-2 text-neutral-400 hover:text-black transition"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {/* Durum akışı — tıklanabilir süreç şeridi */}
              <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wide mb-1.5">Süreç Durumu (tıklayarak ilerletin)</p>
                <div className="flex flex-wrap gap-1.5">
                  {PORTFOY_DURUMLARI.map(d => (
                    <button key={d.id} type="button" onClick={() => handleDurumDegistir(detay, d.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black border-2 transition ${detay.durum === d.id ? 'bg-black text-white border-black' : d.renk}`}>{d.id}</button>
                  ))}
                </div>
                {detay.komisyonNotu && <p className="text-[11px] font-bold text-neutral-500 mt-2 bg-green-50 border border-green-100 rounded-xl p-2">💰 Anlaşma şartı: {detay.komisyonNotu}</p>}
                {detay.sonrakiRandevu && <p className="text-[11px] font-bold text-yellow-700 mt-1.5 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Sonraki randevu: {detay.sonrakiRandevu}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ZİYARET GÜNLÜĞÜ */}
                <div className="border border-neutral-200 rounded-2xl p-3.5">
                  <h4 className="font-black text-sm flex items-center gap-1.5 mb-2"><MapPin className="w-4 h-4 text-blue-600" /> Ziyaret Günlüğü ({(detay.ziyaretler || []).length})</h4>
                  <div className="flex gap-1.5 mb-2">
                    <input type="date" value={ziyaretForm.tarih} onChange={e => setZiyaretForm({ ...ziyaretForm, tarih: e.target.value })} className="p-2 border border-neutral-200 rounded-lg text-[11px] font-bold outline-none w-[120px]" />
                    <input value={ziyaretForm.not} onChange={e => setZiyaretForm({ ...ziyaretForm, not: e.target.value })} placeholder="Görüşme sonucu..." className="flex-1 p-2 border border-neutral-200 rounded-lg text-[11px] font-medium outline-none min-w-0" />
                    <button type="button" onClick={() => handleZiyaretEkle(detay)} disabled={!ziyaretForm.not.trim()} className="px-2.5 bg-blue-600 text-white rounded-lg text-[10px] font-black disabled:opacity-40">Ekle</button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(detay.ziyaretler || []).slice().reverse().map((z, i) => (
                      <div key={i} className="bg-blue-50/60 border border-blue-100 rounded-xl p-2 text-[11px]">
                        <p className="font-bold text-neutral-700">{z.not}</p>
                        <p className="text-[9px] font-bold text-neutral-400 mt-0.5">{z.tarih} • {z.yapan}</p>
                      </div>
                    ))}
                    {(detay.ziyaretler || []).length === 0 && <p className="text-[11px] text-neutral-400 font-medium text-center py-3">Henüz ziyaret kaydı yok.</p>}
                  </div>
                </div>

                {/* CARİ: KOMİSYON & TEMİNAT */}
                <div className="border border-neutral-200 rounded-2xl p-3.5">
                  <h4 className="font-black text-sm flex items-center gap-1.5 mb-2"><Wallet className="w-4 h-4 text-green-600" /> Cari — Komisyon & Teminat</h4>
                  <div className="grid grid-cols-2 gap-1.5 mb-2 text-center">
                    <div className="bg-green-50 border border-green-100 rounded-xl p-2"><p className="text-[9px] font-black text-green-700 uppercase">Ödenen Komisyon</p><p className="font-black text-green-700">{tl(cariOzet(detay).komisyon)}</p></div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-2"><p className="text-[9px] font-black text-orange-700 uppercase">Açık Teminat</p><p className="font-black text-orange-600">{tl(cariOzet(detay).teminat)}</p></div>
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    <select value={cariForm.tip} onChange={e => setCariForm({ ...cariForm, tip: e.target.value })} className="p-2 border border-neutral-200 rounded-lg text-[10px] font-bold outline-none bg-white">
                      <option value="komisyon">Komisyon Öde</option>
                      <option value="teminat">Teminat Ver</option>
                      <option value="teminatIade">Teminat İade Al</option>
                    </select>
                    <input type="number" value={cariForm.tutar} onChange={e => setCariForm({ ...cariForm, tutar: e.target.value })} placeholder="Tutar" className="w-20 p-2 border border-neutral-200 rounded-lg text-[11px] font-bold outline-none" />
                    <input value={cariForm.aciklama} onChange={e => setCariForm({ ...cariForm, aciklama: e.target.value })} placeholder="Açıklama" className="flex-1 p-2 border border-neutral-200 rounded-lg text-[11px] font-medium outline-none min-w-0" />
                    <button type="button" onClick={() => handleCariEkle(detay)} disabled={!cariForm.tutar} className="px-2.5 bg-green-600 text-white rounded-lg text-[10px] font-black disabled:opacity-40">Ekle</button>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {(detay.cariHareketler || []).slice().reverse().map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-neutral-50 border border-neutral-100 rounded-xl p-2 text-[11px]">
                        <span className="font-bold text-neutral-600">{c.tip === 'komisyon' ? '💰 Komisyon' : c.tip === 'teminat' ? '🛡 Teminat' : '↩ Teminat İade'} {c.aciklama && `— ${c.aciklama}`}</span>
                        <span className={`font-black ${c.tip === 'komisyon' ? 'text-green-700' : 'text-orange-600'}`}>{tl(c.tutar)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Yönlendirilen iş sayacı */}
                  <button type="button" onClick={() => handleYonlendirmeEkle(detay)}
                    className="w-full mt-2 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Yönlendirilen İş Kaydet (+1) — Toplam: {detay.yonlendirmeSayisi || 0}
                  </button>
                </div>
              </div>

              {/* KARTVİZİT ARŞİVİ */}
              <div className="border border-neutral-200 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-sm flex items-center gap-1.5"><Camera className="w-4 h-4 text-red-600" /> Kartvizit Arşivi ({(detay.kartvizitler || []).length})</h4>
                  <MediaCaptureMenu
                    onChange={(e) => handleKartvizitYukle(e, detay)}
                    disabled={kartvizitYukleniyor}
                    buttonLabel={kartvizitYukleniyor ? 'Yükleniyor...' : 'Kartvizit Çek / Yükle'}
                    compact={true}
                    multiple={true}
                    buttonClassName="cursor-pointer px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-black text-[10px] rounded-lg border border-red-200 flex items-center gap-1.5 transition"
                  />
                </div>
                {(detay.kartvizitler || []).length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {(detay.kartvizitler || []).map((k, i) => (
                      <button key={i} type="button" onClick={() => setViewingImage && setViewingImage({ title: `Kartvizit — ${detay.firmaAdi}`, name: k.url })}
                        className="border border-neutral-200 rounded-xl overflow-hidden hover:border-red-400 transition group">
                        <img src={k.url} alt={k.name} className="w-full h-16 object-cover bg-neutral-100" />
                        <p className="text-[8px] font-bold text-neutral-400 p-1 truncate group-hover:text-red-600">{k.yukleyen || ''}</p>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-neutral-400 font-medium text-center py-3">Ziyarette aldığınız kartviziti kamerayla çekip buraya kaydedin.</p>}
              </div>

              {/* HAREKET GEÇMİŞİ: kim ne yaptı */}
              <div className="border border-neutral-200 rounded-2xl p-3.5">
                <h4 className="font-black text-sm flex items-center gap-1.5 mb-2"><History className="w-4 h-4 text-neutral-500" /> Hareket Geçmişi</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {(detay.hareketGecmisi || []).slice().reverse().map((h, i) => (
                    <p key={i} className="text-[10px] font-medium text-neutral-500 border-b border-neutral-50 pb-1">
                      <b className="text-purple-700">{h.yapan}</b> — {h.detay} <span className="text-neutral-300">• {new Date(h.tarih).toLocaleString('tr-TR')}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ EKLE / DÜZENLE FORMU ============================ */}
      {formAcik && (
        <div className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-3 animate-in fade-in" onClick={() => { setFormAcik(false); setDuzenlenenId(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <h3 className="font-black text-lg text-red-600 flex items-center gap-2"><Handshake className="w-5 h-5" /> {duzenlenenId ? 'Portföy Kaydını Düzenle' : 'Portföye Ekle'}</h3>
              <button type="button" onClick={() => { setFormAcik(false); setDuzenlenenId(null); }} className="text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Firma / Kurum Adı *</label>
                  <input value={form.firmaAdi} onChange={e => setForm({ ...form, firmaAdi: e.target.value })} placeholder="Örn: Yıldız Emlak, Marina Sitesi Yönetimi..." className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Tip</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PARTNER_TIPLERI.map(t => {
                      const Ikon = t.ikon;
                      return (
                        <button key={t.id} type="button" onClick={() => setForm({ ...form, tip: t.id })}
                          className={`px-3 py-2 rounded-xl text-[11px] font-black border-2 transition flex items-center gap-1.5 ${form.tip === t.id ? 'bg-black text-white border-black' : t.renk}`}>
                          <Ikon className="w-3.5 h-3.5" /> {t.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Yetkili Kişi</label>
                  <input value={form.yetkili} onChange={e => setForm({ ...form, yetkili: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Telefon</label>
                  <input value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Bölge / Semt</label>
                  <input value={form.bolge} onChange={e => setForm({ ...form, bolge: e.target.value })} placeholder="Örn: Kadıköy" className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Sonraki Randevu (Ops.)</label>
                  <input type="date" value={form.sonrakiRandevu} onChange={e => setForm({ ...form, sonrakiRandevu: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Portföy Sahibi (Satış Personeli)</label>
                  <select value={form.portfoySahibi} onChange={e => setForm({ ...form, portfoySahibi: e.target.value })} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-600 bg-white">
                    <option value="">— Seç —</option>
                    {satisPersonelleri.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Anlaşma / Komisyon Şartı (Ops.)</label>
                  <input value={form.komisyonNotu} onChange={e => setForm({ ...form, komisyonNotu: e.target.value })} placeholder="Örn: İş başına %5 komisyon, ya da yıllık 10.000 TL teminat" className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-600" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block mb-1">Notlar</label>
                  <textarea value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} rows={2} className="w-full p-3 border border-neutral-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-600 resize-none" />
                </div>
              </div>
              {/* Kartvizit — yeni kayıtta da çekilebilir */}
              <div className="border-2 border-dashed border-red-200 rounded-xl p-3 bg-red-50/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[10px] font-black text-neutral-500 uppercase flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-red-600" /> Kartvizit ({form.kartvizitler.length})</p>
                  <MediaCaptureMenu
                    onChange={(e) => handleKartvizitYukle(e, null)}
                    disabled={kartvizitYukleniyor}
                    buttonLabel={kartvizitYukleniyor ? 'Yükleniyor...' : 'Kartvizit Çek / Yükle'}
                    compact={true}
                    multiple={true}
                    buttonClassName="cursor-pointer px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded-lg flex items-center gap-1.5 transition"
                  />
                </div>
                {form.kartvizitler.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.kartvizitler.map((k, i) => (
                      <span key={i} className="flex items-center gap-1 bg-white border border-red-100 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-600">
                        <img src={k.url} alt="" className="w-6 h-6 object-cover rounded" /> <span className="max-w-[80px] truncate">{k.name}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, kartvizitler: f.kartvizitler.filter((_, x) => x !== i) }))} className="text-neutral-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex gap-2 shrink-0">
              <button type="button" onClick={() => { setFormAcik(false); setDuzenlenenId(null); }} className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black rounded-xl transition text-sm">İptal</button>
              <button type="button" onClick={handleKaydet} disabled={kaydediliyor || !form.firmaAdi.trim()}
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
            <h3 className="font-black text-black flex items-center gap-2 mb-2"><Trash2 className="w-5 h-5 text-red-600" /> Portföyden Sil</h3>
            <p className="text-sm text-neutral-600 font-medium mb-4">Bu iş ortağı kaydı, ziyaret ve cari geçmişiyle birlikte kalıcı olarak silinecek. Emin misiniz?</p>
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

// ############################################################################
// ############################################################################
// YENİ BÖLÜM (kullanıcı talebi): QR SİTE TAKİP
// Bu bölüm Satis.jsx içinde yaşar; App.jsx QrSiteTakipView ve QrSiteLanding'i
// buradan import eder. Bölüme özel yardımcılar dosyanın diğer bölümleriyle
// çakışmasın diye "qr" önekiyle adlandırılmıştır.
// ############################################################################
// ############################################################################
// AMAÇ: Site / bina / iş yeri / malikane asansörlerine asılan reklam afişine
// o yere ÖZEL bir QR kod konur. Sakinler QR'ı okutunca giriş gerektirmeyen bir
// sayfa açılır ve iki seçenek sunulur:
//   1) HEMEN BİLGİ ALMAK İÇİN DOLDURUN → ad soyad + telefon bırakır; teşekkür
//      ekranında müşteri temsilcisinin kartı (Ara / WhatsApp) görünür.
//   2) KEŞİF İÇİN ÇAĞIRIN → adres zaten QR'a gömülüdür; sakin sadece blok /
//      kat / daire + randevu tarih-saati girer, temsilciyi keşfe çağırır.
// Yönetim tarafında ise her yer için: kaç kişi QR okuttu, kaç kişi bilgi
// (arama) istedi, kaç kişi temsilciyi aradı / WhatsApp'tan yazdı, kaç kişi
// keşif çağırdı — hepsi tek ekranda izlenir; talepler durum takibiyle yönetilir.
//
// BÖLÜM YAPISI (modülerlik kuralı):
//   • Sabitler ve yardımcılar
//   • useQrSiteler / useQrSiteTalepleri / useYeniQrTalepSayisi (Firestore hook'ları)
//   • QrSiteForm          → yer ekleme / düzenleme penceresi
//   • QrKodPaneli         → QR görseli, indirme, bağlantı kopyalama
//   • QrTalepSatiri       → tek bir talep (lead) satırı
//   • QrSiteKarti         → yer kartı (istatistik rozetleri)
//   • QrSiteTakipView     → YÖNETİM EKRANI (App.jsx'ten açılır)
//   • QrSiteLanding       → ESKİ herkese açık sayfa (DEĞİŞTİ: artık WordPress'te,
//                           sembolevdeneve.com/sembol-nakliyat-pro/?yer=<yerId> + api/qr-site.js)
//
// FIRESTORE KOLEKSİYONLARI (artifacts/{appId}/public/data/...):
//   • qrSiteler        → yerler (ad, tür, adres, temsilci, taramaSayisi ...)
//   • qrSiteTalepleri  → sakinlerin bıraktığı talepler (bilgi / keşif)
// ============================================================================

// ============================================================================
// SABİTLER
// ============================================================================
export const QR_SITE_TURLERI = ['Site', 'Bina', 'İş Yeri', 'Malikane', 'Diğer'];

// ============================================================================
// DEĞİŞTİ (kullanıcı talebi): MÜŞTERİ HER ZAMAN ŞİRKET NUMARASINI GÖRÜR
// ----------------------------------------------------------------------------
// Sakine gösterilen temsilci telefonu YALNIZCA personelin şirket hattıdır
// (companyPhone). Şahsi numara (personalPhone) hiçbir koşulda kullanılmaz.
// Personelin şirket hattı girilmemişse afişteki merkez numarası gösterilir.
// ============================================================================
// DEĞİŞTİ: QR_SIRKET_TELEFONU, QR_HIZMETLER, QR_RANDEVU_SAATLERI, qrTelefonNormalize
// ve QR_SITE_LANDING_URL src/qrSiteSema.js'e taşındı (api/qr-site.js ile ortak);
// eski import'lar bozulmasın diye buradan da dışa verilir.
export { QR_SITE_LANDING_URL, QR_SIRKET_TELEFONU, QR_HIZMETLER, QR_RANDEVU_SAATLERI, qrTelefonNormalize };
export const qrTemsilciSirketTelefonu = (temsilci) => {
  const sirketHatti = String(temsilci?.companyPhone || '').trim();
  return sirketHatti || QR_SIRKET_TELEFONU;
};

// Talep durum akışı: Yeni → Arandı → Keşif Planlandı → İş Alındı / Alamadık
export const QR_TALEP_DURUMLARI = ['Yeni', 'Arandı', 'Ulaşılamadı', 'Keşif Planlandı', 'İş Alındı', 'Alamadık'];

// Durum rozet renkleri (Tailwind)
const QR_DURUM_STIL = {
  'Yeni':            'bg-blue-100 text-blue-700 border-blue-200',
  'Arandı':          'bg-amber-100 text-amber-700 border-amber-200',
  'Ulaşılamadı':     'bg-neutral-100 text-neutral-600 border-neutral-200',
  'Keşif Planlandı': 'bg-purple-100 text-purple-700 border-purple-200',
  'İş Alındı':       'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Alamadık':        'bg-red-100 text-red-700 border-red-200',
};

// Tür ikonu
const QrTurIkonu = ({ tur, className = 'w-4 h-4' }) => {
  if (tur === 'İş Yeri') return <Briefcase className={className} />;
  if (tur === 'Malikane') return <Home className={className} />;
  return <Building2 className={className} />;
};

// ============================================================================
// YARDIMCILAR
// ============================================================================
const qrBugunStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const qrTrh = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('tr-TR');
};
const qrTrhSaat = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
// "2026-09-30" → "30.09.2026"
const qrTarihGoster = (t) => t ? t.split('-').reverse().join('.') : '—';

// DEĞİŞTİ: qrTelefonNormalize / qrTelefonGecerliMi src/qrSiteSema.js'ten gelir (API ile aynı kural)

// Sakinin QR ile açacağı herkese açık bağlantı
// DEĞİŞTİ: Sayfa WordPress'e taşındı (sembol-nakliyat-pro). Adres artık
// window.location'a bağlı değil — CRM preview/localhost'tan açılsa bile QR
// doğru adrese gider. Parametre bilerek "yer" ("qr" sitedeki reklam QR takibine ait).
export const qrSiteBaglantisi = (siteId) => `${QR_SITE_LANDING_URL}?yer=${encodeURIComponent(siteId)}`;

// Koleksiyon kısayolları
const qrSiteKoleksiyonu = () => collection(db, 'artifacts', appId, 'public', 'data', 'qrSiteler');
const qrTalepKoleksiyonu = () => collection(db, 'artifacts', appId, 'public', 'data', 'qrSiteTalepleri');
const qrSiteRef = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'qrSiteler', id);
const qrTalepRef = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'qrSiteTalepleri', id);

// Boş yer formu
const bosQrSiteForm = {
  ad: '', tur: 'Site', adres: '', ilce: '', il: 'İstanbul', bloklar: '', temsilciId: '', notlar: '', aktif: true,
};

// ============================================================================
// FIRESTORE HOOK'LARI
// ============================================================================
// Tüm yerleri canlı dinler (yönetim ekranı)
export const useQrSiteler = (aktif = true) => {
  const [siteler, setSiteler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  useEffect(() => {
    if (!aktif) return;
    const unsub = onSnapshot(qrSiteKoleksiyonu(), (snap) => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // En yeni yer üstte
      liste.sort((a, b) => String(b.olusturmaTarihi || '').localeCompare(String(a.olusturmaTarihi || '')));
      setSiteler(liste);
      setYukleniyor(false);
    }, () => setYukleniyor(false));
    return () => unsub();
  }, [aktif]);
  return { siteler, yukleniyor };
};

// Tüm talepleri canlı dinler (yönetim ekranı). Son 500 kayıtla sınırlı — okuma optimizasyonu.
export const useQrSiteTalepleri = (aktif = true) => {
  const [talepler, setTalepler] = useState([]);
  useEffect(() => {
    if (!aktif) return;
    const q = query(qrTalepKoleksiyonu(), orderBy('olusturmaTarihi', 'desc'), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      setTalepler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [aktif]);
  return talepler;
};

// Yalnızca "Yeni" durumundaki talep sayısı — Saha Portföy'deki buton rozeti için
export const useYeniQrTalepSayisi = (aktif = true) => {
  const [sayi, setSayi] = useState(0);
  useEffect(() => {
    if (!aktif) return;
    const q = query(qrTalepKoleksiyonu(), where('durum', '==', 'Yeni'));
    const unsub = onSnapshot(q, (snap) => setSayi(snap.size), () => {});
    return () => unsub();
  }, [aktif]);
  return sayi;
};

// ============================================================================
// QR KOD PANELİ — görsel + indirme (SVG/PNG) + bağlantı kopyalama
// ============================================================================
export const QrKodPaneli = ({ site, boyut = 160 }) => {
  const [kopyalandi, setKopyalandi] = useState(false);
  const baglanti = qrSiteBaglantisi(site.id);
  const dosyaAdi = `QR_${(site.ad || 'yer').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]+/g, '_')}`;

  // SVG olarak indir (baskıya en uygun, kalite kaybı olmaz)
  const svgIndir = () => {
    const svg = qrSvgUret(baglanti, 4);
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${dosyaAdi}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  // PNG olarak indir (tasarımcıya / matbaaya göndermek için 1024px)
  const pngIndir = () => {
    const svg = qrSvgUret(baglanti, 4);
    if (!svg) return;
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png'); a.download = `${dosyaAdi}.png`; a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const kopyala = async () => {
    try { await navigator.clipboard.writeText(baglanti); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 1500); }
    catch { window.prompt('Bağlantıyı kopyalayın:', baglanti); }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-2 bg-white rounded-xl border-2 border-neutral-200 shadow-sm">
        <QrGorsel deger={baglanti} boyut={boyut} />
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <button type="button" onClick={pngIndir} className="px-2.5 py-1.5 bg-black hover:bg-neutral-800 text-white text-[10px] font-black rounded-lg flex items-center gap-1 transition"><Download className="w-3 h-3" /> PNG</button>
        <button type="button" onClick={svgIndir} className="px-2.5 py-1.5 bg-neutral-700 hover:bg-neutral-900 text-white text-[10px] font-black rounded-lg flex items-center gap-1 transition"><Download className="w-3 h-3" /> SVG</button>
        <button type="button" onClick={kopyala} className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[10px] font-black rounded-lg flex items-center gap-1 transition">
          {kopyalandi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} {kopyalandi ? 'Kopyalandı' : 'Bağlantı'}
        </button>
        <a href={baglanti} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[10px] font-black rounded-lg flex items-center gap-1 transition"><ExternalLink className="w-3 h-3" /> Önizle</a>
      </div>
    </div>
  );
};

// ============================================================================
// YER EKLE / DÜZENLE PENCERESİ
// ============================================================================
export const QrSiteForm = ({ acik, baslangic, temsilciler = [], onKapat, onKaydet }) => {
  const [form, setForm] = useState(bosQrSiteForm);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  useEffect(() => { if (acik) setForm({ ...bosQrSiteForm, ...(baslangic || {}) }); }, [acik, baslangic]);
  if (!acik) return null;

  const g = (alan, deger) => setForm(f => ({ ...f, [alan]: deger }));
  const gonder = async (e) => {
    e.preventDefault();
    if (!form.ad.trim()) return alert('Yer adı zorunludur.');
    if (!form.adres.trim()) return alert('Adres zorunludur — sakin keşif isterken bu adresi görecek.');
    if (!form.temsilciId) return alert('Bir müşteri temsilcisi seçin — sakin bu kişiyi arayacak.');
    setKaydediliyor(true);
    try { await onKaydet(form); } finally { setKaydediliyor(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={onKapat}>
      <form onSubmit={gonder} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-black text-white px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-black flex items-center gap-2"><QrCode className="w-5 h-5 text-amber-400" /> {form.id ? 'Yeri Düzenle' : 'Yeni Yer + QR Oluştur'}</h3>
          <button type="button" onClick={onKapat} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase text-neutral-500">Yer Adı *</label>
              <input value={form.ad} onChange={e => g('ad', e.target.value)} placeholder="Örn. Ataşehir Park Sitesi" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold focus:border-black outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-neutral-500">Tür</label>
              <select value={form.tur} onChange={e => g('tur', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold bg-white">
                {QR_SITE_TURLERI.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Açık Adres * <span className="normal-case font-bold text-neutral-400">(sakin keşif formunda bunu görecek)</span></label>
            <textarea value={form.adres} onChange={e => g('adres', e.target.value)} rows={2} placeholder="Mahalle, cadde, sokak, no…" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold focus:border-black outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase text-neutral-500">İlçe</label>
              <input value={form.ilce} onChange={e => g('ilce', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-neutral-500">İl</label>
              <input value={form.il} onChange={e => g('il', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Bloklar <span className="normal-case font-bold text-neutral-400">(varsa virgülle: A, B, C — sakin listeden seçer)</span></label>
            <input value={form.bloklar} onChange={e => g('bloklar', e.target.value)} placeholder="A Blok, B Blok" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Müşteri Temsilcisi * <span className="normal-case font-bold text-neutral-400">(sakin bu kişiyi arayacak)</span></label>
            <select value={form.temsilciId} onChange={e => g('temsilciId', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold bg-white">
              <option value="">Seçin…</option>
              {temsilciler.map(p => <option key={p.id} value={p.id}>{p.fullName} {p.position ? `(${p.position})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Notlar (afiş asılma tarihi, kat sayısı vb.)</label>
            <textarea value={form.notlar} onChange={e => g('notlar', e.target.value)} rows={2} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 cursor-pointer">
            <input type="checkbox" checked={form.aktif !== false} onChange={e => g('aktif', e.target.checked)} className="w-4 h-4 accent-black" />
            QR aktif (kapatılırsa sakin "kampanya sona erdi" mesajı görür)
          </label>
        </div>
        <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onKapat} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl text-sm">Vazgeç</button>
          <button type="submit" disabled={kaydediliyor} className="px-5 py-2 bg-black hover:bg-neutral-800 text-white font-black rounded-xl text-sm flex items-center gap-2 disabled:opacity-60">
            {kaydediliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Kaydet
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// TALEP SATIRI — tek bir sakin talebi
// ============================================================================
export const QrTalepSatiri = ({ talep, onDurum, onSil, onNot }) => {
  const [notAcik, setNotAcik] = useState(false);
  const [notMetni, setNotMetni] = useState(talep.yoneticiNotu || '');
  const tel = qrTelefonNormalize(talep.telefon);
  const kesif = talep.tur === 'kesif';

  return (
    <div className={`p-3 rounded-xl border ${kesif ? 'border-purple-200 bg-purple-50/40' : 'border-blue-200 bg-blue-50/40'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded-full ${kesif ? 'bg-purple-600' : 'bg-blue-600'}`}>{kesif ? 'KEŞİF ÇAĞRISI' : 'BİLGİ TALEBİ'}</span>
            <span className="font-black text-black text-sm">{talep.adSoyad}</span>
            <span className="text-xs font-bold text-neutral-500">{talep.telefon}</span>
            {/* Sakin teşekkür ekranında temsilciyi aradı / WhatsApp'tan yazdı mı? */}
            {talep.temsilciyiAradi && <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> ARADI</span>}
            {talep.whatsappYazdi && <span className="text-[9px] font-black bg-[#25D366] text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> WHATSAPP</span>}
          </div>
          <div className="text-[11px] font-bold text-neutral-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {qrTrhSaat(talep.olusturmaTarihi)}</span>
            {kesif && (
              <>
                {(talep.blok || talep.kat || talep.daire) && (
                  <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {[talep.blok, talep.kat && `Kat ${talep.kat}`, talep.daire && `Daire ${talep.daire}`].filter(Boolean).join(' • ')}</span>
                )}
                <span className="flex items-center gap-1 text-purple-700"><CalendarDays className="w-3 h-3" /> Randevu: {qrTarihGoster(talep.randevuTarihi)} {talep.randevuSaati}</span>
              </>
            )}
            {!kesif && talep.hizmet && <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> {talep.hizmet}</span>}
            {talep.mesaj && <span className="italic text-neutral-500">"{talep.mesaj}"</span>}
          </div>
          {talep.yoneticiNotu && !notAcik && <p className="text-[11px] font-bold text-amber-700 mt-1">📝 {talep.yoneticiNotu}</p>}
          {notAcik && (
            <div className="flex gap-1 mt-2">
              <input value={notMetni} onChange={e => setNotMetni(e.target.value)} placeholder="Görüşme notu…" className="flex-1 p-1.5 border border-neutral-300 rounded-lg text-xs font-bold" />
              <button type="button" onClick={() => { onNot(talep.id, notMetni); setNotAcik(false); }} className="px-2 py-1 bg-black text-white text-[10px] font-black rounded-lg">Kaydet</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {/* Durum seçici */}
          <select value={talep.durum || 'Yeni'} onChange={e => onDurum(talep.id, e.target.value)}
            className={`text-[10px] font-black px-2 py-1.5 rounded-lg border cursor-pointer ${QR_DURUM_STIL[talep.durum] || QR_DURUM_STIL['Yeni']}`}>
            {QR_TALEP_DURUMLARI.map(d => <option key={d}>{d}</option>)}
          </select>
          {tel && (
            <>
              <a href={`tel:+${tel}`} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" title="Ara"><Phone className="w-3.5 h-3.5" /></a>
              <a href={`https://wa.me/${tel}?text=${encodeURIComponent(`Merhaba ${talep.adSoyad}, Sembol Nakliyat'tan arıyorum. Asansörümüzdeki QR üzerinden bıraktığınız ${kesif ? 'keşif' : 'bilgi'} talebiniz için sizinle iletişime geçiyorum. Size nasıl yardımcı olabilirim? 🚚`)}`}
                target="_blank" rel="noreferrer" className="p-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></a>
            </>
          )}
          <button type="button" onClick={() => setNotAcik(v => !v)} className="p-1.5 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Not ekle"><Edit className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => onSil(talep.id)} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Talebi sil"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// YER KARTI — istatistik rozetleriyle
// ============================================================================
export const QrSiteKarti = ({ site, istatistik, secili, onSec, onDuzenle, onSil }) => {
  return (
    <div onClick={onSec} className={`rounded-2xl border-2 p-4 cursor-pointer transition ${secili ? 'border-black bg-neutral-50 shadow-lg' : 'border-neutral-200 bg-white hover:border-neutral-400'} ${site.aktif === false ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-8 h-8 rounded-xl bg-black text-amber-400 flex items-center justify-center shrink-0"><QrTurIkonu tur={site.tur} /></span>
            <div className="min-w-0">
              <h4 className="font-black text-black text-sm leading-tight truncate">{site.ad}</h4>
              <p className="text-[10px] font-bold text-neutral-500 truncate">{site.tur} • {[site.ilce, site.il].filter(Boolean).join(' / ')}</p>
            </div>
            {site.aktif === false && <span className="text-[9px] font-black bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full">PASİF</span>}
          </div>
          <p className="text-[11px] font-bold text-neutral-600 mt-2 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> <span className="line-clamp-2">{site.adres}</span></p>
          <p className="text-[11px] font-bold text-neutral-500 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> Temsilci: {site.temsilciAd || '—'}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuzenle(); }} className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Düzenle"><Edit className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onSil(); }} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Sil"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {/* İSTATİSTİK ŞERİDİ */}
      <div className="grid grid-cols-5 gap-1 mt-3">
        {[
          { e: 'Okutan', v: site.taramaSayisi || 0, s: 'bg-neutral-900 text-white' },
          { e: 'Bilgi', v: istatistik.bilgi, s: 'bg-blue-100 text-blue-800' },
          { e: 'Aradı', v: istatistik.aradi, s: 'bg-emerald-100 text-emerald-800' },
          { e: 'WhatsApp', v: istatistik.whatsapp, s: 'bg-green-100 text-green-800' },
          { e: 'Keşif', v: istatistik.kesif, s: 'bg-purple-100 text-purple-800' },
        ].map(k => (
          <div key={k.e} className={`rounded-lg px-1 py-1.5 text-center ${k.s}`}>
            <div className="text-sm font-black leading-none">{k.v}</div>
            <div className="text-[8px] font-black uppercase mt-0.5 opacity-80">{k.e}</div>
          </div>
        ))}
      </div>
      {istatistik.yeni > 0 && (
        <div className="mt-2 text-[10px] font-black text-blue-700 flex items-center gap-1 animate-pulse"><AlertTriangle className="w-3 h-3" /> {istatistik.yeni} yeni talep bekliyor</div>
      )}
    </div>
  );
};

// ============================================================================
// YÖNETİM EKRANI — QR SİTE TAKİP
// ============================================================================
export const QrSiteTakipView = ({ personnelList = [], currentUser, addSystemLog, onGeri }) => {
  const { siteler, yukleniyor } = useQrSiteler(true);
  const talepler = useQrSiteTalepleri(true);
  const [formAcik, setFormAcik] = useState(false);
  const [formBaslangic, setFormBaslangic] = useState(null);
  const [seciliId, setSeciliId] = useState(null);
  const [arama, setArama] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('Tümü');
  const [turFiltre, setTurFiltre] = useState('Tümü');

  // Müşteri temsilcisi adayları: Satış Personeli (satış destek) + Pazarlama personeli.
  // İkisi de yoksa tüm aktif personel listelenir (eski davranış korunur).
  // DEĞİŞTİ (kullanıcı talebi): Pazarlama pozisyonunda kayıtlı personel de eklendi.
  // Pozisyon adı İK'da farklı yazılmış olabilir ("Pazarlama", "Saha Pazarlama",
  // "Pazarlama Personeli" …) — adında "pazarlama" geçen her pozisyon kabul edilir.
  const temsilciler = useMemo(() => {
    const aktif = personnelList.filter(p => p.employmentStatus !== 'Pasif');
    // Pozisyonun pazarlama olup olmadığını büyük/küçük harf ve Türkçe karakterden bağımsız kontrol eder
    const pazarlamaMi = (p) => String(p.position || '').toLocaleLowerCase('tr-TR').includes('pazarlama');
    const satisMi = (p) => normalizePozisyon(p.position) === 'Satış Personeli';
    // Ada göre alfabetik sıralama (Türkçe)
    const adSirala = (x, y) => String(x.fullName || '').localeCompare(String(y.fullName || ''), 'tr');
    const satis = aktif.filter(satisMi).sort(adSirala);
    // Satış Personeli zaten listede olduğu için pazarlamada tekrar gösterilmez
    const pazarlama = aktif.filter(p => !satisMi(p) && pazarlamaMi(p)).sort(adSirala);
    // Sıra: önce satış destek, ardından pazarlama personeli
    const adaylar = [...satis, ...pazarlama];
    return adaylar.length ? adaylar : aktif;
  }, [personnelList]);

  // Yer bazında istatistikler
  const istatistikler = useMemo(() => {
    const m = {};
    siteler.forEach(s => { m[s.id] = { bilgi: 0, kesif: 0, aradi: 0, whatsapp: 0, yeni: 0, isAlindi: 0 }; });
    talepler.forEach(t => {
      const i = m[t.siteId]; if (!i) return;
      if (t.tur === 'kesif') i.kesif++; else i.bilgi++;
      if (t.temsilciyiAradi) i.aradi++;
      if (t.whatsappYazdi) i.whatsapp++;
      if ((t.durum || 'Yeni') === 'Yeni') i.yeni++;
      if (t.durum === 'İş Alındı') i.isAlindi++;
    });
    return m;
  }, [siteler, talepler]);

  // Genel KPI
  const kpi = useMemo(() => ({
    yer: siteler.length,
    tarama: siteler.reduce((a, s) => a + (s.taramaSayisi || 0), 0),
    bilgi: talepler.filter(t => t.tur !== 'kesif').length,
    kesif: talepler.filter(t => t.tur === 'kesif').length,
    aradi: talepler.filter(t => t.temsilciyiAradi).length,
    whatsapp: talepler.filter(t => t.whatsappYazdi).length,
    yeni: talepler.filter(t => (t.durum || 'Yeni') === 'Yeni').length,
    isAlindi: talepler.filter(t => t.durum === 'İş Alındı').length,
  }), [siteler, talepler]);

  const gorunenSiteler = useMemo(() => {
    const a = arama.trim().toLocaleLowerCase('tr-TR');
    return siteler.filter(s => (turFiltre === 'Tümü' || s.tur === turFiltre) &&
      (!a || [s.ad, s.adres, s.ilce, s.il, s.temsilciAd].some(x => String(x || '').toLocaleLowerCase('tr-TR').includes(a))));
  }, [siteler, arama, turFiltre]);

  // ==========================================================================
  // DEĞİŞTİ (kullanıcı talebi): KAYITLI TEMSİLCİ TELEFONUNU OTOMATİK DÜZELT
  // Daha önce şahsi numarayla kaydedilmiş yerler (örn. Simpaş / Orhan Güloğlu)
  // ve sonradan şirket hattı değişen temsilciler için: yönetim ekranı her
  // açıldığında her yerin temsilciTel'i personel kartındaki ŞİRKET hattıyla
  // karşılaştırılır, farklıysa Firestore'da sessizce düzeltilir. Böylece sakin
  // hiçbir zaman şahsi numara görmez.
  // ==========================================================================
  useEffect(() => {
    if (!siteler.length || !personnelList.length) return;
    siteler.forEach(async (site) => {
      if (!site.temsilciId) return;
      const temsilci = personnelList.find(p => String(p.id) === String(site.temsilciId));
      if (!temsilci) return;
      const dogruTel = qrTemsilciSirketTelefonu(temsilci);
      if ((site.temsilciTel || '') !== dogruTel) {
        try { await updateDoc(qrSiteRef(site.id), { temsilciTel: dogruTel }); } catch { /* sessiz */ }
      }
    });
  }, [siteler, personnelList]);

  const seciliSite = siteler.find(s => s.id === seciliId) || null;
  const seciliTalepler = useMemo(() => talepler
    .filter(t => t.siteId === seciliId && (durumFiltre === 'Tümü' || (t.durum || 'Yeni') === durumFiltre)), [talepler, seciliId, durumFiltre]);

  // ---- İşlemler
  const siteKaydet = async (form) => {
    const temsilci = personnelList.find(p => String(p.id) === String(form.temsilciId));
    const veri = {
      ad: form.ad.trim(), tur: form.tur, adres: form.adres.trim(), ilce: form.ilce.trim(), il: form.il.trim(),
      bloklar: form.bloklar.trim(), notlar: form.notlar.trim(), aktif: form.aktif !== false,
      temsilciId: form.temsilciId, temsilciAd: temsilci?.fullName || '',
      // Temsilcinin telefonu sakine gösterilir — şirket telefonu öncelikli
      // DEĞİŞTİ: Şahsi numara ASLA yazılmaz — şirket hattı, yoksa merkez numarası
      temsilciTel: qrTemsilciSirketTelefonu(temsilci),
      guncellemeTarihi: new Date().toISOString(),
    };
    try {
      if (form.id) {
        await updateDoc(qrSiteRef(form.id), veri);
        addSystemLog?.('QR Site Takip', `"${veri.ad}" yeri güncellendi.`);
      } else {
        const ref = await addDoc(qrSiteKoleksiyonu(), { ...veri, taramaSayisi: 0, olusturmaTarihi: new Date().toISOString(), olusturanId: currentUser?.id || null, olusturanAd: currentUser?.fullName || '' });
        addSystemLog?.('QR Site Takip', `"${veri.ad}" için yeni QR oluşturuldu (temsilci: ${veri.temsilciAd}).`);
        setSeciliId(ref.id);
      }
      setFormAcik(false);
    } catch (e) { console.error(e); alert('Kaydedilemedi: ' + e.message); }
  };
  const siteSil = async (site) => {
    const adet = talepler.filter(t => t.siteId === site.id).length;
    if (!window.confirm(`"${site.ad}" silinsin mi?${adet ? ` Bu yere ait ${adet} talep kaydı da listeden düşer.` : ''} Asılı afişteki QR artık çalışmaz.`)) return;
    try { await deleteDoc(qrSiteRef(site.id)); if (seciliId === site.id) setSeciliId(null); addSystemLog?.('QR Site Takip', `"${site.ad}" yeri silindi.`); }
    catch (e) { alert('Silinemedi: ' + e.message); }
  };
  const talepDurum = async (id, durum) => {
    try { await updateDoc(qrTalepRef(id), { durum, durumGuncelleyen: currentUser?.fullName || '', durumTarihi: new Date().toISOString() }); }
    catch (e) { alert('Güncellenemedi: ' + e.message); }
  };
  const talepNot = async (id, not) => {
    try { await updateDoc(qrTalepRef(id), { yoneticiNotu: not }); } catch (e) { alert('Kaydedilemedi: ' + e.message); }
  };
  const talepSil = async (id) => {
    if (!window.confirm('Bu talep silinsin mi?')) return;
    try { await deleteDoc(qrTalepRef(id)); } catch (e) { alert('Silinemedi: ' + e.message); }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* BAŞLIK */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          {onGeri && <button type="button" onClick={onGeri} className="p-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-xl" title="Saha Portföy'e dön"><ChevronLeft className="w-5 h-5" /></button>}
          <span className="w-12 h-12 rounded-2xl bg-black text-amber-400 flex items-center justify-center shadow-lg shrink-0"><QrCode className="w-6 h-6" /></span>
          <div>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Asansör Afişi Reklam Takibi</p>
            <h2 className="text-2xl font-black text-black leading-tight">QR Site Takip</h2>
          </div>
        </div>
        <button type="button" onClick={() => { setFormBaslangic(null); setFormAcik(true); }}
          className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white font-black rounded-xl shadow-lg transition flex items-center gap-2 text-sm">
          <PlusCircle className="w-4 h-4" /> Yeni Yer + QR Oluştur
        </button>
      </div>

      {/* KPI ŞERİDİ */}
      <div className="bg-neutral-900 text-white rounded-2xl p-3 grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { e: 'Yer', v: kpi.yer, i: Building2 }, { e: 'QR Okutan', v: kpi.tarama, i: QrCode },
          { e: 'Bilgi Talebi', v: kpi.bilgi, i: Phone }, { e: 'Keşif Çağrısı', v: kpi.kesif, i: CalendarDays },
          { e: 'Temsilciyi Aradı', v: kpi.aradi, i: Phone }, { e: "WhatsApp'tan Yazdı", v: kpi.whatsapp, i: MessageCircle },
          { e: 'Yeni Bekleyen', v: kpi.yeni, i: AlertTriangle, vurgu: kpi.yeni > 0 }, { e: 'İş Alındı', v: kpi.isAlindi, i: Star },
        ].map(k => (
          <div key={k.e} className={`rounded-xl p-2 text-center ${k.vurgu ? 'bg-blue-600' : 'bg-white/5'}`}>
            <div className="text-xl font-black tabular-nums leading-none">{k.v}</div>
            <div className="text-[8px] font-black uppercase text-white/60 mt-1 leading-tight">{k.e}</div>
          </div>
        ))}
      </div>

      {/* NASIL ÇALIŞIR — kısa bilgi */}
      {siteler.length === 0 && !yukleniyor && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm font-bold text-amber-900">
          <p className="font-black mb-1">Nasıl çalışır?</p>
          <ol className="list-decimal ml-5 space-y-0.5 text-[13px]">
            <li>"Yeni Yer + QR Oluştur" ile siteyi/binayı, adresini ve müşteri temsilcisini kaydedin.</li>
            <li>Oluşan QR'ı PNG/SVG indirip afişe yerleştirin, asansöre asın.</li>
            <li>Sakin QR'ı okutunca sembolevdeneve.com'daki giriş gerektirmeyen sayfa açılır: "Hemen Bilgi Al" veya "Keşif İçin Çağırın".</li>{/* DEĞİŞTİ: sayfa WordPress'e taşındı */}
            <li>Talepler anında burada belirir; temsilci arar, durumu günceller, sonucu takip edersiniz.</li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* SOL: YER LİSTESİ */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Yer, adres, temsilci ara…" className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm font-bold focus:border-black outline-none" />
            </div>
            <select value={turFiltre} onChange={e => setTurFiltre(e.target.value)} className="px-3 py-2.5 border border-neutral-300 rounded-xl text-xs font-black bg-white">
              <option>Tümü</option>{QR_SITE_TURLERI.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {yukleniyor && <div className="text-center py-8 text-neutral-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}
          {!yukleniyor && gorunenSiteler.length === 0 && <div className="text-center py-8 text-xs font-bold text-neutral-400">Henüz yer eklenmemiş.</div>}
          {gorunenSiteler.map(s => (
            <QrSiteKarti key={s.id} site={s} istatistik={istatistikler[s.id] || { bilgi: 0, kesif: 0, aradi: 0, whatsapp: 0, yeni: 0 }}
              secili={seciliId === s.id} onSec={() => setSeciliId(s.id)}
              onDuzenle={() => { setFormBaslangic(s); setFormAcik(true); }} onSil={() => siteSil(s)} />
          ))}
        </div>

        {/* SAĞ: SEÇİLİ YER DETAYI */}
        <div className="lg:col-span-3">
          {!seciliSite ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-sm font-bold text-neutral-400 flex flex-col items-center gap-2">
              <Eye className="w-8 h-8" /> Soldan bir yer seçin: QR kodu, bağlantısı ve gelen talepler burada görünür.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="bg-black text-white p-4 flex flex-col sm:flex-row gap-4">
                <QrKodPaneli site={seciliSite} boyut={150} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><QrTurIkonu tur={seciliSite.tur} className="w-5 h-5 text-amber-400" /><h3 className="font-black text-lg leading-tight">{seciliSite.ad}</h3></div>
                  <p className="text-xs font-bold text-white/70 mt-1 flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {seciliSite.adres}{seciliSite.ilce ? `, ${seciliSite.ilce}` : ''}{seciliSite.il ? ` / ${seciliSite.il}` : ''}</p>
                  {seciliSite.bloklar && <p className="text-xs font-bold text-white/70 mt-1">Bloklar: {seciliSite.bloklar}</p>}
                  <div className="mt-3 bg-white/10 rounded-xl p-2.5">
                    <p className="text-[9px] font-black uppercase text-amber-400">Müşteri Temsilcisi</p>
                    <p className="font-black text-sm">{seciliSite.temsilciAd || '—'}</p>
                    <p className="text-xs font-bold text-white/70">{seciliSite.temsilciTel || QR_SIRKET_TELEFONU} <span className="text-[9px] text-amber-400/80">(şirket hattı — sakinin gördüğü numara)</span></p>
                  </div>
                  <p className="text-[10px] font-bold text-white/50 mt-2">Oluşturma: {qrTrh(seciliSite.olusturmaTarihi)} • Son okutma: {seciliSite.sonTarama ? qrTrhSaat(seciliSite.sonTarama) : '—'}</p>
                  {seciliSite.notlar && <p className="text-[11px] font-bold text-white/60 mt-1 italic">{seciliSite.notlar}</p>}
                </div>
              </div>

              {/* TALEPLER */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <h4 className="font-black text-black flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Gelen Talepler <span className="text-xs font-bold text-neutral-400">({seciliTalepler.length})</span></h4>
                  <div className="flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-neutral-400" />
                    <select value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)} className="px-2 py-1.5 border border-neutral-300 rounded-lg text-[11px] font-black bg-white">
                      <option>Tümü</option>{QR_TALEP_DURUMLARI.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {seciliTalepler.length === 0 ? (
                  <div className="text-center py-8 text-xs font-bold text-neutral-400">Bu yerden henüz talep gelmedi. Afiş asıldıysa okutmalar "Okutan" sayacında birikir.</div>
                ) : (
                  <div className="space-y-2">
                    {seciliTalepler.map(t => <QrTalepSatiri key={t.id} talep={t} onDurum={talepDurum} onSil={talepSil} onNot={talepNot} />)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <QrSiteForm acik={formAcik} baslangic={formBaslangic} temsilciler={temsilciler} onKapat={() => setFormAcik(false)} onKaydet={siteKaydet} />
    </div>
  );
};

// ============================================================================
// ESKİ: artık kullanılmıyor, WordPress sayfasına taşındı (sembol-nakliyat-pro)
// Yeni akış: QR → sembolevdeneve.com/sembol-nakliyat-pro/?yer=<yerId> → /api/qr-site.
// App.jsx eski "?qr=<yerId>" bağlantılarını yeni adrese yönlendirir; bu
// bileşen ve QrLandingKabuk yalnızca geri dönüş gerekirse diye tutuluyor.
// ============================================================================
// HERKESE AÇIK SAYFA — sakinin QR ile açtığı ekran (giriş gerekmez)
// ============================================================================
// App.jsx, URL'de ?qr=<yerId> görünce giriş ekranı yerine bunu çizer.
// firebaseUser: anonim oturum (App'te otomatik açılır) — yazma işlemleri
// için beklenir; oturum hazır olmadan form gönderilmez.
// ============================================================================
// Herkese açık sayfanın siyah-altın markalı çerçevesi (afiş diliyle uyumlu).
// ÖNEMLİ: Dosya seviyesinde tanımlıdır; bileşen içinde tanımlanan bir alt
// bileşen React tarafından her render'da "yeni" sayılır ve içindeki form
// alanları her tuş vuruşunda yeniden kurulup odağı kaybederdi.
const QrLandingKabuk = ({ children }) => (
  <div className="min-h-screen bg-black text-white flex flex-col" style={{ background: 'radial-gradient(ellipse at top, #1f1a10 0%, #000 60%)' }}>
    <header className="px-5 pt-8 pb-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-amber-500/60 bg-black mb-3 shadow-lg shadow-amber-500/20">
        <span className="text-2xl font-black text-amber-400">S</span>
      </div>
      <h1 className="text-2xl font-black tracking-wide text-amber-400">SEMBOL NAKLİYAT</h1>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mt-1">Evden Eve • Asansörlü Taşıma • Depolama</p>
    </header>
    <main className="flex-1 px-4 pb-10 max-w-md w-full mx-auto">{children}</main>
    <footer className="text-center text-[10px] font-bold text-white/40 pb-6 tracking-widest uppercase">Lüks yaşamın taşınma güvencesi</footer>
  </div>
);

export const QrSiteLanding = ({ siteId, firebaseUser }) => {
  const [site, setSite] = useState(null);
  const [durum, setDurum] = useState('yukleniyor'); // yukleniyor | hazir | yok | pasif
  const [secim, setSecim] = useState(null);           // null | 'bilgi' | 'kesif'
  const [form, setForm] = useState({ adSoyad: '', telefon: '', hizmet: '', blok: '', kat: '', daire: '', randevuTarihi: '', randevuSaati: '', mesaj: '' });
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [tamamlandi, setTamamlandi] = useState(null); // { talepId, tur }
  const [hata, setHata] = useState('');

  // 1) Yer bilgisini yükle + tarama sayacını artır (aynı tarayıcı oturumunda bir kez)
  useEffect(() => {
    if (!siteId || !firebaseUser) return;
    let iptal = false;
    (async () => {
      try {
        const snap = await getDoc(qrSiteRef(siteId));
        if (iptal) return;
        if (!snap.exists()) { setDurum('yok'); return; }
        const veri = { id: snap.id, ...snap.data() };
        setSite(veri);
        if (veri.aktif === false) { setDurum('pasif'); return; }
        setDurum('hazir');
        // Tarama sayacı: sayfa yenilemede tekrar saymasın diye sessionStorage
        try {
          const anahtar = `qrTarandi_${siteId}`;
          if (!sessionStorage.getItem(anahtar)) {
            await updateDoc(qrSiteRef(siteId), { taramaSayisi: increment(1), sonTarama: new Date().toISOString() });
            sessionStorage.setItem(anahtar, '1');
          }
        } catch { /* sayaç artmasa da sayfa çalışsın */ }
      } catch (e) { if (!iptal) setDurum('yok'); }
    })();
    return () => { iptal = true; };
  }, [siteId, firebaseUser]);

  const g = (alan, deger) => setForm(f => ({ ...f, [alan]: deger }));
  const bloklar = (site?.bloklar || '').split(',').map(s => s.trim()).filter(Boolean);
  // DEĞİŞTİ: Kayıtta numara yoksa merkez şirket numarası — şahsi numara asla gösterilmez
  const temsilciTelGoster = site?.temsilciTel || QR_SIRKET_TELEFONU;
  const temsilciTel = qrTelefonNormalize(temsilciTelGoster);

  // 2) Form gönder → qrSiteTalepleri'ne kayıt
  const gonder = async (e) => {
    e.preventDefault();
    setHata('');
    if (!form.adSoyad.trim()) return setHata('Lütfen adınızı ve soyadınızı yazın.');
    if (!qrTelefonGecerliMi(form.telefon)) return setHata('Lütfen geçerli bir cep telefonu yazın (05XX XXX XX XX).');
    if (secim === 'kesif') {
      if (!form.randevuTarihi) return setHata('Lütfen keşif için bir tarih seçin.');
      if (form.randevuTarihi < qrBugunStr()) return setHata('Geçmiş bir tarih seçilemez.');
      if (!form.randevuSaati) return setHata('Lütfen bir saat seçin.');
    }
    setGonderiliyor(true);
    try {
      const ref = await addDoc(qrTalepKoleksiyonu(), {
        siteId: site.id, siteAd: site.ad, siteAdres: site.adres,
        tur: secim, adSoyad: form.adSoyad.trim(), telefon: form.telefon.trim(),
        hizmet: secim === 'bilgi' ? form.hizmet : '',
        blok: secim === 'kesif' ? form.blok : '', kat: secim === 'kesif' ? form.kat : '', daire: secim === 'kesif' ? form.daire : '',
        randevuTarihi: secim === 'kesif' ? form.randevuTarihi : '', randevuSaati: secim === 'kesif' ? form.randevuSaati : '',
        mesaj: form.mesaj.trim(),
        temsilciId: site.temsilciId || '', temsilciAd: site.temsilciAd || '',
        durum: 'Yeni', temsilciyiAradi: false, whatsappYazdi: false,
        olusturmaTarihi: new Date().toISOString(),
      });
      setTamamlandi({ talepId: ref.id, tur: secim });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setHata('Gönderilemedi, lütfen tekrar deneyin. ' + (err?.message || '')); }
    finally { setGonderiliyor(false); }
  };

  // 3) Teşekkür ekranındaki Ara / WhatsApp tıklamalarını talebe işle (istatistik)
  const iletisimIsle = async (alan) => {
    if (!tamamlandi?.talepId) return;
    try { await updateDoc(qrTalepRef(tamamlandi.talepId), { [alan]: true, [`${alan}Zamani`]: new Date().toISOString() }); } catch { /* sessiz */ }
  };

  // Çerçeve bileşeni dosya seviyesinde tanımlıdır (QrLandingKabuk) — bileşen
  // içinde tanımlansaydı her render'da yeniden kurulup form odağını düşürürdü.
  const Kabuk = QrLandingKabuk;

  if (!firebaseUser || durum === 'yukleniyor') return <Kabuk><div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" /><p className="text-xs font-bold text-white/60 mt-3">Hazırlanıyor…</p></div></Kabuk>;
  if (durum === 'yok') return <Kabuk><div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"><AlertTriangle className="w-10 h-10 mx-auto text-amber-400 mb-2" /><p className="font-black">Bu QR kod tanınmadı</p><p className="text-xs font-bold text-white/60 mt-1">Bize <a href="tel:+905547261661" className="text-amber-400 underline">0554 726 16 61</a> numarasından ulaşabilirsiniz.</p></div></Kabuk>;
  if (durum === 'pasif') return <Kabuk><div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"><p className="font-black">Bu kampanya sona erdi</p><p className="text-xs font-bold text-white/60 mt-1">Yine de size yardımcı olmaktan mutluluk duyarız: <a href="tel:+905547261661" className="text-amber-400 underline">0554 726 16 61</a></p></div></Kabuk>;

  // ---------------------------------------------------------------- TEŞEKKÜR EKRANI
  if (tamamlandi) {
    const kesif = tamamlandi.tur === 'kesif';
    return (
      <Kabuk>
        <div className="bg-white text-black rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3"><Check className="w-8 h-8" /></div>
          <h2 className="text-xl font-black">Teşekkürler, {form.adSoyad.split(' ')[0]}! 🎉</h2>
          {kesif ? (
            <p className="text-sm font-bold text-neutral-600 mt-2">
              <b>{qrTarihGoster(form.randevuTarihi)} — {form.randevuSaati}</b> için keşif talebiniz alındı. Müşteri temsilciniz sizi arayarak randevuyu teyit edecek ve belirttiğiniz saatte ücretsiz keşfe gelecek.
            </p>
          ) : (
            <p className="text-sm font-bold text-neutral-600 mt-2">Bilgileriniz saha personelimize iletildi; en kısa sürede sizi arayarak dönüş yapılacaktır.</p>
          )}
          {/* TEMSİLCİ KARTI */}
          <div className="mt-5 bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Size özel müşteri temsilciniz</p>
            <p className="text-lg font-black mt-1">{site.temsilciAd || 'Sembol Nakliyat'}</p>
            <p className="text-sm font-bold text-neutral-600">{temsilciTelGoster}</p>
            <p className="text-xs font-bold text-neutral-500 mt-2">Beklemek istemiyorsanız hemen ulaşabilirsiniz:</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <a href={`tel:+${temsilciTel}`} onClick={() => iletisimIsle('temsilciyiAradi')}
                className="py-3 bg-black hover:bg-neutral-800 text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm"><Phone className="w-4 h-4" /> Hemen Ara</a>
              <a href={`https://wa.me/${temsilciTel}?text=${encodeURIComponent(`Merhaba, ${site.ad} asansöründeki QR üzerinden ulaşıyorum. ${kesif ? 'Keşif talebi bıraktım' : 'Bilgi almak istiyorum'}. Ben ${form.adSoyad}.`)}`}
                target="_blank" rel="noreferrer" onClick={() => iletisimIsle('whatsappYazdi')}
                className="py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1 text-[9px] font-black uppercase text-neutral-500">
            {['Profesyonel Ekip', 'Özel Ambalaj', 'Sigortalı Taşıma', 'Güvenli Depolama'].map(x => <div key={x} className="bg-neutral-100 rounded-lg py-2 px-1">{x}</div>)}
          </div>
        </div>
      </Kabuk>
    );
  }

  // ---------------------------------------------------------------- SEÇİM EKRANI
  if (!secim) {
    return (
      <Kabuk>
        {/* Nereden okutuldu */}
        <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0"><QrTurIkonu tur={site.tur} className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Size özel ayrıcalıklı teklif</p>
            <p className="font-black text-white leading-tight">{site.ad}</p>
            <p className="text-[11px] font-bold text-white/60 mt-0.5">{site.adres}</p>
          </div>
        </div>
        <h2 className="text-center text-lg font-black mb-1">Size nasıl yardımcı olalım?</h2>
        <p className="text-center text-xs font-bold text-white/60 mb-5">İki seçenekten birini seçin, 30 saniyede tamamlanır.</p>
        <div className="space-y-3">
          <button type="button" onClick={() => setSecim('bilgi')} className="w-full text-left bg-white text-black rounded-2xl p-5 shadow-xl hover:scale-[1.02] transition flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-black text-amber-400 flex items-center justify-center shrink-0"><Phone className="w-7 h-7" /></span>
            <div>
              <p className="font-black text-base leading-tight">Hemen Bilgi Almak İçin Doldurun</p>
              <p className="text-xs font-bold text-neutral-500 mt-1">Ad ve telefonunuzu bırakın, saha personelimiz sizi arasın.</p>
            </div>
            <ChevronDown className="w-5 h-5 -rotate-90 ml-auto text-neutral-400" />
          </button>
          <button type="button" onClick={() => setSecim('kesif')} className="w-full text-left bg-gradient-to-br from-amber-400 to-amber-600 text-black rounded-2xl p-5 shadow-xl shadow-amber-500/30 hover:scale-[1.02] transition flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-black text-amber-400 flex items-center justify-center shrink-0"><CalendarDays className="w-7 h-7" /></span>
            <div>
              <p className="font-black text-base leading-tight">Keşif İçin Çağırın</p>
              <p className="text-xs font-bold text-black/70 mt-1">Ücretsiz keşif için gün ve saat seçin, temsilcimiz kapınıza gelsin.</p>
            </div>
            <ChevronDown className="w-5 h-5 -rotate-90 ml-auto text-black/50" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-1 text-[9px] font-black uppercase text-white/60 text-center">
          {['Profesyonel Ekip', 'Özel Ambalajlama', 'Sigortalı Taşıma', 'Güvenli Depolama'].map(x => <div key={x} className="border border-white/10 rounded-lg py-2 px-1">{x}</div>)}
        </div>
        <p className="text-center text-xs font-bold text-white/50 mt-5">veya doğrudan arayın: <a href="tel:+905547261661" className="text-amber-400 font-black">0554 726 16 61</a></p>
      </Kabuk>
    );
  }

  // ---------------------------------------------------------------- FORM EKRANI
  const kesif = secim === 'kesif';
  return (
    <Kabuk>
      <button type="button" onClick={() => { setSecim(null); setHata(''); }} className="text-xs font-black text-white/60 hover:text-white flex items-center gap-1 mb-3"><ChevronLeft className="w-4 h-4" /> Geri</button>
      <form onSubmit={gonder} className="bg-white text-black rounded-3xl p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3">
          <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${kesif ? 'bg-amber-500 text-black' : 'bg-black text-amber-400'}`}>{kesif ? <CalendarDays className="w-5 h-5" /> : <Phone className="w-5 h-5" />}</span>
          <div>
            <h2 className="font-black text-base leading-tight">{kesif ? 'Keşif İçin Çağırın' : 'Hemen Bilgi Alın'}</h2>
            <p className="text-[11px] font-bold text-neutral-500">{kesif ? 'Ücretsiz keşif — temsilcimiz adresinize gelir' : 'Saha personelimiz sizi hemen arar'}</p>
          </div>
        </div>

        {/* Keşif: adres zaten biliniyor — sakin görür, değiştiremez */}
        {kesif && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase text-neutral-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Keşif adresi (QR'ı okuttuğunuz yer)</p>
            <p className="text-sm font-black mt-0.5">{site.ad}</p>
            <p className="text-xs font-bold text-neutral-600">{site.adres}</p>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black uppercase text-neutral-500">Ad Soyad *</label>
          <input value={form.adSoyad} onChange={e => g('adSoyad', e.target.value)} placeholder="Adınız Soyadınız" className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold focus:border-black outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-neutral-500">Cep Telefonu *</label>
          <input value={form.telefon} onChange={e => g('telefon', e.target.value)} type="tel" inputMode="tel" placeholder="05XX XXX XX XX" className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold focus:border-black outline-none" />
        </div>

        {!kesif && (
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Hangi hizmetle ilgileniyorsunuz? (isteğe bağlı)</label>
            <select value={form.hizmet} onChange={e => g('hizmet', e.target.value)} className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold bg-white">
              <option value="">Seçin…</option>{QR_HIZMETLER.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
        )}

        {kesif && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500">Blok</label>
                {bloklar.length > 0 ? (
                  <select value={form.blok} onChange={e => g('blok', e.target.value)} className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold bg-white">
                    <option value="">—</option>{bloklar.map(b => <option key={b}>{b}</option>)}
                  </select>
                ) : (
                  <input value={form.blok} onChange={e => g('blok', e.target.value)} placeholder="A" className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold" />
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500">Kat</label>
                <input value={form.kat} onChange={e => g('kat', e.target.value)} inputMode="numeric" placeholder="5" className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500">Daire</label>
                <input value={form.daire} onChange={e => g('daire', e.target.value)} inputMode="numeric" placeholder="12" className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500">Keşif Tarihi *</label>
                <input type="date" min={qrBugunStr()} value={form.randevuTarihi} onChange={e => g('randevuTarihi', e.target.value)} className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold bg-white" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500">Saat *</label>
                <select value={form.randevuSaati} onChange={e => g('randevuSaati', e.target.value)} className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold bg-white">
                  <option value="">Seçin…</option>{QR_RANDEVU_SAATLERI.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-[10px] font-black uppercase text-neutral-500">Not (isteğe bağlı)</label>
          <textarea value={form.mesaj} onChange={e => g('mesaj', e.target.value)} rows={2} placeholder={kesif ? 'Örn. 3+1 daire, piyano var' : 'Örn. Ekim başında taşınmayı planlıyoruz'} className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm font-bold resize-none" />
        </div>

        {hata && <p className="text-xs font-black text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {hata}</p>}

        <button type="submit" disabled={gonderiliyor} className={`w-full py-3.5 font-black rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-60 ${kesif ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-black hover:bg-neutral-800 text-white'}`}>
          {gonderiliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {kesif ? 'Temsilciyi Keşfe Çağır' : 'Beni Arayın'}
        </button>
        <p className="text-[10px] font-bold text-neutral-400 text-center">Bilgileriniz yalnızca sizinle iletişim kurmak için kullanılır.</p>
      </form>
    </Kabuk>
  );
};

// ############################################################################
// ############################################################################
// YENİ BÖLÜM (kullanıcı talebi): QR TAKİP — REKLAM QR'LARI (KAMYON / BİLBORD /
// DERGİ / PROMOSYON…) TARAMA VE FORM TAKİBİ
// ----------------------------------------------------------------------------
// AMAÇ: Kamyon kasasına, bilborda, dergiye, promosyona basılan her QR'a ÖZEL
// bir takip bağlantısı verilir. Müşteri QR'ı okutunca önce bizim takip
// sayfamıza düşer (tarama sayılır), aynı saniyede web sitesindeki teklif
// formuna yönlendirilir (UTM ve kampanya kodu eklenmiş olarak). Form
// tamamlanınca Müşteri Havuzu'na gelen kayıt "Organik" değil, "34 NAR 385 QR"
// gibi kampanya adıyla etiketlenir. Böylece her QR için: kaç kişi okuttu,
// kaç form geldi, dönüşüm oranı ne — tek ekranda görünür.
//
// VERİ (artifacts/{appId}/public/data/...):
//   • qrKampanyalari  → { site, ad, kod, tur, hedefUrl, aktif, taramaSayisi, ... }
//   • qrTaramalari    → her okutma: { kampanyaId, site, zaman, gun, cihaz, referer }
//   • havuzKayitlari  → kayda yazılan eşleşme: { qrKampanyaId, qrKampanyaAd, qrEslesme }
//
// EŞLEŞTİRME (üç katman, güçlüden zayıfa):
//   1) UTM   : Site formu utm_campaign / kampanya / qr alanını CRM'e aktarıyorsa
//              kampanya koduyla birebir eşleşir → kesin.
//   2) ZAMAN : Site UTM aktarmıyorsa bile: form, o kampanyanın son 45 dk içindeki
//              bir taramasından sonra geldiyse ve o aralıkta yalnızca BU kampanya
//              taranmışsa → "olası" olarak bağlanır (etiketinde belirtilir).
//   3) ELLE  : QR Takip sayfasındaki "Bağlanmamış organik formlar" listesinden
//              yönetici seçer. Eşleşmeler kayda yazılır; bir daha hesaplanmaz.
//
// TAKİP BAĞLANTISI: {uygulama}/?qrt=<kampanyaId>&s=<site>  (App.jsx yönlendirir)
// ############################################################################
export const QR_TAKIP_TURLERI = ['Kamyon / Araç', 'Bilbord', 'Dergi / Gazete', 'Promosyon', 'Afiş / Broşür', 'Kartvizit', 'Sosyal Medya', 'Diğer'];
export const QR_TAKIP_SITE_BILGI = {
  sembolevdeneve: { ad: 'Sembol Nakliyat', varsayilanUrl: 'https://www.sembolevdeneve.com/fiyat-teklifi-al/', renk: 'red' },
  // DEĞİŞTİ (kullanıcı talebi): Depoevim varsayılanı artık teklif sihirbazı sayfası
  depoevim: { ad: 'Depoevim', varsayilanUrl: 'https://www.depoevim.com/fiyat-teklifi-al/', renk: 'blue' },
};
const QR_ESLESME_PENCERE_DK = 45; // tarama → form arası azami süre (zaman eşleşmesi)
// KAPATILDI (kullanıcı bildirimi, 2026-09): "okutmadan sonraki 45 dk içinde gelen form
// o QR'dandır" TAHMİNİ, QR'ı test için okutan kişinin (ya da aynı saatte gelen
// başka bir müşterinin) Direkt/Google girişlerini de QR sayıyordu. Artık yalnızca
// kesin iz (formdaki qrKodu / UTM) eşleşir.
const QR_ZAMAN_ESLESMESI_AKTIF = false;

// "34 NAR 385 QR" → "34_NAR_385_QR" (utm_campaign ve eşleşme anahtarı)
export const qrKampanyaKodu = (ad) => String(ad || '').toLocaleUpperCase('tr-TR')
  .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
  .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const qrKodNormalize = (x) => qrKampanyaKodu(x);

// Hedef URL'ye UTM + kampanya kodu ekler (mevcut sorgu parametreleri korunur)
export const qrHedefUrlUret = (hedefUrl, kampanya) => {
  try {
    const u = new URL(hedefUrl);
    u.searchParams.set('utm_source', 'qr');
    u.searchParams.set('utm_medium', qrKampanyaKodu(kampanya.tur || 'qr').toLowerCase());
    u.searchParams.set('utm_campaign', kampanya.kod || qrKampanyaKodu(kampanya.ad));
    u.searchParams.set('qr', kampanya.kod || qrKampanyaKodu(kampanya.ad));
    return u.toString();
  } catch { return hedefUrl; }
};

// DEĞİŞTİ (kullanıcı bildirimi — "QR üretilemedi"):
// Geçiş noktası bağlantısı hedef adresi de içerdiği için ~290 karaktere
// çıkıyordu; dahili QR üreteci en fazla ~210 karakter (sürüm 10) destekliyor.
// Site tarafına sembol-qr-takip.js + api/qr-tarama.js kurulduğu için artık
// geçiş noktasına GEREK YOK: QR doğrudan sitenin teklif sayfasını açar
// (~140 karakter), okutmayı ve form izini site betiği CRM'e aktarır.
// Daha önce basılmış "?qrt=" bağlantılı QR'lar App.jsx'teki rota sayesinde
// çalışmaya devam eder.
export const qrTakipBaglantisi = (kampanya) => qrHedefUrlUret(
  kampanya?.hedefUrl || QR_TAKIP_SITE_BILGI[kampanya?.site]?.varsayilanUrl || QR_TAKIP_SITE_BILGI.sembolevdeneve.varsayilanUrl, kampanya || {});
const qrKampanyaKoleksiyonu = () => collection(db, 'artifacts', appId, 'public', 'data', 'qrKampanyalari');
const qrTaramaKoleksiyonu = () => collection(db, 'artifacts', appId, 'public', 'data', 'qrTaramalari');
const qrKampanyaRef = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'qrKampanyalari', id);
const gunYmdQr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------- HOOK'LAR
export const useQrKampanyalari = (site, aktif = true) => {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    if (!aktif || !site) return;
    const q = query(qrKampanyaKoleksiyonu(), where('site', '==', site));
    const unsub = onSnapshot(q, snap => {
      const l = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      l.sort((a, b) => String(b.olusturmaTarihi || '').localeCompare(String(a.olusturmaTarihi || '')));
      setListe(l);
    }, () => setListe([]));
    return () => unsub();
  }, [site, aktif]);
  return liste;
};
// Son N günün taramaları (her iki site — havuz eşleştirmesi için)
export const useQrTaramalari = (gunSayisi = 45, aktif = true) => {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    if (!aktif) return;
    const bas = new Date(); bas.setDate(bas.getDate() - gunSayisi);
    const q = query(qrTaramaKoleksiyonu(), where('zaman', '>=', bas.toISOString()), orderBy('zaman', 'desc'), limit(3000));
    const unsub = onSnapshot(q, snap => setListe(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setListe([]));
    return () => unsub();
  }, [gunSayisi, aktif]);
  return liste;
};

// ---------------------------------------------------------------- EŞLEŞTİRME
// Bir havuz kaydında UTM/kampanya izi var mı? (site formu hangi adla aktarırsa aktarsın)
const kayittanKampanyaKodu = (k) => {
  const adaylar = [k.utm_campaign, k.utmCampaign, k.kampanya, k.qr, k.qrKodu, k.utm_content, k.utmContent, k.kaynakKodu];
  for (const a of adaylar) { if (a && String(a).trim()) return qrKodNormalize(a); }
  // Bazı entegrasyonlar tüm sorguyu tek metinde saklar
  const metin = [k.landingUrl, k.sayfaUrl, k.referer, k.sonMesaj].filter(Boolean).join(' ');
  const m = metin.match(/(?:utm_campaign|qr)=([A-Za-z0-9_\-]+)/);
  return m ? qrKodNormalize(m[1]) : '';
};
// Otomatik eşleştirme: yalnızca web kanalı, reklam olmayan, henüz bağlanmamış kayıtlar
export const useQrOtomatikEslestirme = (kayitlar = [], kampanyalar = [], taramalar = [], aktif = true) => {
  const yazilan = useRef(new Set());
  useEffect(() => {
    if (!aktif || !kayitlar.length || !kampanyalar.length) return;
    const t = setTimeout(async () => {
      const kodHarita = new Map(kampanyalar.map(c => [c.kod || qrKampanyaKodu(c.ad), c]));
      for (const k of kayitlar) {
        // YENİ (kullanıcı bildirimi, 2026-09): ESKİ KOD TEMİZLİĞİ — yenilenmemiş bir
        // CRM sekmesi / eski sürüm hâlâ "45 dk zaman tahmini" ile Direkt/Google
        // formlarını QR'a bağlıyor. Formda kesin QR izi (qrKodu) yoksa bu tahmini
        // bağ kaldırılır ve qrEslesmeYok işaretlenir — eski kod da bu işarete
        // uyduğu için kaydı tekrar bağlamaz.
        if (!QR_ZAMAN_ESLESMESI_AKTIF && k.id && k.kanal === 'web' && k.qrKampanyaId && k.qrEslesme === 'zaman' && !k.qrKodu && !yazilan.current.has(k.id)) {
          yazilan.current.add(k.id);
          try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', k.id), {
              qrKampanyaId: null, qrKampanyaAd: null, qrEslesme: null, qrEslesmeYok: true,
              ...(k.reklamKaynagi === 'qr' ? { reklamKaynagi: k.oncekiReklamKaynagi || 'direkt_giris' } : {}),
            });
          } catch (e) { yazilan.current.delete(k.id); console.warn('Tahmini QR bağı kaldırılamadı:', e); }
          continue;
        }
        if (k.kanal !== 'web' || k.qrKampanyaId || k.qrEslesmeYok || !k.id) continue;
        // DEĞİŞTİ: yalnızca reklam değil, Google/Facebook/Instagram ORGANİK girişler de
        // bu ziyaretin KESİN kaynağıdır — QR'a bağlanmaz. QR'dan gelen ziyaretçi
        // formda 'qr', 'direkt_giris' (kameradan açılır, önceki sayfa yok) ya da
        // 'diger_site' (eski ?qrt= geçiş bağlantısı) olarak görünür.
        if (k.reklamKaynagi && !['qr', 'direkt_giris', 'diger_site', 'organik'].includes(k.reklamKaynagi)) continue;
        if (yazilan.current.has(k.id)) continue;
        let secilen = null, tip = '';
        // 1) UTM
        const kod = kayittanKampanyaKodu(k);
        if (kod && kodHarita.has(kod)) { secilen = kodHarita.get(kod); tip = 'utm'; }
        // 2) ZAMAN — KAPALI (bkz. QR_ZAMAN_ESLESMESI_AKTIF)
        if (QR_ZAMAN_ESLESMESI_AKTIF && !secilen && k.createdAt) {
          const formZ = new Date(k.createdAt).getTime();
          if (!isNaN(formZ)) {
            // DÜZELTME: okutma, formun doldurulduğu GERÇEK siteye (hesapId) yazılıyor —
            // sembolevdeneve'deki depolama formu (hizmetTipi 'Depo') depoevim'de aranıp eşleşmiyordu.
            const kayitSite = (k.hesapId === 'depoevim' || k.hesapId === 'sembolevdeneve') ? k.hesapId
              : (k.hizmetTipi === 'Depo') ? 'depoevim' : 'sembolevdeneve';
            const pencere = taramalar.filter(tr => tr.site === kayitSite && (() => { const z = new Date(tr.zaman).getTime(); return z <= formZ && formZ - z <= QR_ESLESME_PENCERE_DK * 60000; })());
            const ids = [...new Set(pencere.map(tr => tr.kampanyaId))];
            if (ids.length === 1) { secilen = kampanyalar.find(c => c.id === ids[0]) || null; tip = 'zaman'; }
          }
        }
        if (!secilen) continue;
        yazilan.current.add(k.id);
        try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', k.id), {
            qrKampanyaId: secilen.id, qrKampanyaAd: secilen.ad, qrEslesme: tip, qrEslesmeZamani: new Date().toISOString(),
          });
        } catch (e) { yazilan.current.delete(k.id); console.warn('QR eşleştirme yazılamadı:', e); }
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [kayitlar, kampanyalar, taramalar, aktif]);
};

// ---------------------------------------------------------------- HERKESE AÇIK YÖNLENDİRME
// App.jsx "?qrt=<id>" görünce bunu çizer: tarama yazılır, hedefe yönlendirilir.
export const QrTakipYonlendirme = ({ kampanyaId, siteIpucu, firebaseUser, logoUrl = '', hedefParam = '' }) => {
  // DEĞİŞTİ (kullanıcı talebi): ANLIK GEÇİŞ — bekleme ekranı yok.
  //  • Hedef adres QR bağlantısındaki "u" parametresinden okunur → Firestore
  //    beklenmeden yönlendirme hazır.
  //  • Okutma kaydı arka planda yazılır; yazma 900 ms'de bitmezse yine gidilir.
  //  • Anonim oturum (firebaseUser) 900 ms içinde gelmezse de gidilir.
  const yonlendirildi = useRef(false);
  const r = QR_TAKIP_SITE_BILGI[siteIpucu] || QR_TAKIP_SITE_BILGI.sembolevdeneve;
  const hedef = (() => { try { const u = decodeURIComponent(hedefParam || ''); return /^https?:\/\//i.test(u) ? u : r.varsayilanUrl; } catch { return r.varsayilanUrl; } })();
  const git = () => { if (yonlendirildi.current) return; yonlendirildi.current = true; window.location.replace(hedef); };
  useEffect(() => {
    const azami = setTimeout(git, 900); // her koşulda en geç 0,9 sn
    if (!firebaseUser || !kampanyaId) return () => clearTimeout(azami);
    (async () => {
      try {
        const ua = navigator.userAgent || '';
        const cihaz = /Android|iPhone|iPad|Mobile/i.test(ua) ? 'mobil' : 'masaüstü';
        await Promise.allSettled([
          addDoc(qrTaramaKoleksiyonu(), { kampanyaId, site: siteIpucu, zaman: new Date().toISOString(), gun: gunYmdQr(), cihaz, referer: document.referrer || '' }),
          updateDoc(qrKampanyaRef(kampanyaId), { taramaSayisi: increment(1), sonTarama: new Date().toISOString() }),
        ]);
      } catch { /* sessiz */ }
      git();
    })();
    return () => clearTimeout(azami);
  }, [kampanyaId, siteIpucu, firebaseUser]);
  // Neredeyse hiç görünmeyen, sade ekran (yalnızca ~0,5 sn)
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      {logoUrl && siteIpucu !== 'depoevim' ? <img src={logoUrl} alt="" className="max-h-16 object-contain opacity-90" /> : <p className="text-lg font-black">{r.ad}</p>}
      <p className="text-xs font-bold text-white/50 mt-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Açılıyor…</p>
      <a href={hedef} className="mt-6 text-[11px] font-black text-white/60 underline">Açılmadıysa buraya dokunun</a>
    </div>
  );
};

// ---------------------------------------------------------------- QR KAMPANYA FORMU
const bosQrKampanya = { ad: '', tur: 'Kamyon / Araç', hedefUrl: '', notlar: '', aktif: true };
export const QrKampanyaFormu = ({ acik, site, baslangic, onKapat, onKaydet }) => {
  const [form, setForm] = useState(bosQrKampanya);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  useEffect(() => { if (acik) setForm({ ...bosQrKampanya, hedefUrl: QR_TAKIP_SITE_BILGI[site]?.varsayilanUrl || '', ...(baslangic || {}) }); }, [acik, baslangic, site]);
  if (!acik) return null;
  const g = (a, v) => setForm(f => ({ ...f, [a]: v }));
  const kod = form.kod || qrKampanyaKodu(form.ad);
  const gonder = async (e) => {
    e.preventDefault();
    if (!form.ad.trim()) return alert('QR adı zorunludur (örn. 34 NAR 385 QR).');
    if (!/^https?:\/\//i.test(form.hedefUrl.trim())) return alert('Geçerli bir yönlendirme adresi girin (https://… ile başlamalı).');
    setKaydediliyor(true);
    try { await onKaydet({ ...form, ad: form.ad.trim(), hedefUrl: form.hedefUrl.trim(), kod }); } finally { setKaydediliyor(false); }
  };
  const r = QR_TAKIP_SITE_BILGI[site] || QR_TAKIP_SITE_BILGI.sembolevdeneve;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onKapat}>
      <form onSubmit={gonder} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className={`sticky top-0 ${r.renk === 'blue' ? 'bg-blue-700' : 'bg-red-700'} text-white px-5 py-3 flex items-center justify-between rounded-t-2xl`}>
          <h3 className="font-black flex items-center gap-2"><QrCode className="w-5 h-5" /> {form.id ? 'QR Kampanyasını Düzenle' : `Yeni QR — ${r.ad}`}</h3>
          <button type="button" onClick={onKapat} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">QR Adı * <span className="normal-case font-bold text-neutral-400">(havuzda kaynak olarak böyle görünür)</span></label>
            <input value={form.ad} onChange={e => g('ad', e.target.value)} placeholder="Örn. 34 NAR 385 QR, Kadıköy Bilbord, Dergi Eylül" className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold focus:border-black outline-none" />
            {form.ad && <p className="text-[10px] font-bold text-neutral-400 mt-1">Kampanya kodu: <span className="font-mono text-neutral-700">{kod}</span> (sitedeki forma utm_campaign olarak gider)</p>}
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Nereye Basıldı?</label>
            <select value={form.tur} onChange={e => g('tur', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold bg-white">
              {QR_TAKIP_TURLERI.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Site Adresi * <span className="normal-case font-bold text-neutral-400">(QR okutulunca doğrudan açılacak sayfa)</span></label>
            <input value={form.hedefUrl} onChange={e => g('hedefUrl', e.target.value)} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold font-mono focus:border-black outline-none" />
            <p className="text-[10px] font-bold text-neutral-400 mt-1">QR'ın içindeki adres: <span className="break-all font-mono">{form.hedefUrl ? qrHedefUrlUret(form.hedefUrl, { ...form, kod }) : '—'}</span></p>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-neutral-500">Notlar (asıldığı tarih, konum, kaç adet basıldı…)</label>
            <textarea value={form.notlar} onChange={e => g('notlar', e.target.value)} rows={2} className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 cursor-pointer">
            <input type="checkbox" checked={form.aktif !== false} onChange={e => g('aktif', e.target.checked)} className="w-4 h-4 accent-black" />
            QR aktif (kapatılırsa okutma sayılmaz, müşteri yine siteye gider)
          </label>
        </div>
        <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onKapat} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-black rounded-xl text-sm">Vazgeç</button>
          <button type="submit" disabled={kaydediliyor} className="px-5 py-2 bg-black hover:bg-neutral-800 text-white font-black rounded-xl text-sm flex items-center gap-2 disabled:opacity-60">
            {kaydediliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Kaydet
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------- QR KOD PANELİ (indir / kopyala)
export const QrTakipKodPaneli = ({ kampanya, boyut = 150 }) => {
  const [kopyalandi, setKopyalandi] = useState(false);
  const baglanti = qrTakipBaglantisi(kampanya); // doğrudan site adresi + kampanya izi
  const dosya = `QR_${qrKampanyaKodu(kampanya.ad) || 'kampanya'}`;
  const indir = (png) => {
    const svg = qrSvgUret(baglanti, 4); if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob);
    if (!png) { const a = document.createElement('a'); a.href = url; a.download = `${dosya}.svg`; a.click(); URL.revokeObjectURL(url); return; }
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = 2048; c.height = 2048; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 2048, 2048); ctx.drawImage(img, 0, 0, 2048, 2048); const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `${dosya}.png`; a.click(); URL.revokeObjectURL(url); };
    img.src = url;
  };
  const kopyala = async () => { try { await navigator.clipboard.writeText(baglanti); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 1500); } catch { window.prompt('Bağlantı:', baglanti); } };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-2 bg-white rounded-xl border-2 border-neutral-200 shadow-sm"><QrGorsel deger={baglanti} boyut={boyut} /></div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <button type="button" onClick={() => indir(true)} className="px-2.5 py-1.5 bg-black hover:bg-neutral-800 text-white text-[10px] font-black rounded-lg flex items-center gap-1"><Download className="w-3 h-3" /> PNG (2048px)</button>
        <button type="button" onClick={() => indir(false)} className="px-2.5 py-1.5 bg-neutral-700 hover:bg-neutral-900 text-white text-[10px] font-black rounded-lg flex items-center gap-1"><Download className="w-3 h-3" /> SVG (baskı)</button>
        <button type="button" onClick={kopyala} className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[10px] font-black rounded-lg flex items-center gap-1">{kopyalandi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} {kopyalandi ? 'Kopyalandı' : 'Bağlantıyı Kopyala'}</button>
        <a href={baglanti} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[10px] font-black rounded-lg flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Test Et</a>
      </div>
      <p className="text-[9px] font-bold text-neutral-400 text-center max-w-[220px] break-all">{baglanti}</p>
    </div>
  );
};

// ---------------------------------------------------------------- QR TAKİP SAYFASI
export const QrTakipView = ({ site, kayitlar = [], kampanyalar = [], taramalar = [], currentUser, addSystemLog, onGeri }) => {
  const [formAcik, setFormAcik] = useState(false);
  const [formBaslangic, setFormBaslangic] = useState(null);
  const [seciliId, setSeciliId] = useState(null);
  const [ara, setAra] = useState('');
  const r = QR_TAKIP_SITE_BILGI[site] || QR_TAKIP_SITE_BILGI.sembolevdeneve;
  const bugun = gunYmdQr(); const buAy = bugun.slice(0, 7);
  const kayitSite = (k) => (k.hizmetTipi === 'Depo') ? 'depoevim' : (k.hizmetTipi === 'Nakliye' || k.hizmetTipi === 'Asansör') ? 'sembolevdeneve' : (k.hesapId === 'depoevim' ? 'depoevim' : 'sembolevdeneve');
  const siteKayitlari = useMemo(() => kayitlar.filter(k => k.kanal === 'web' && kayitSite(k) === site), [kayitlar, site]);
  const siteTaramalari = useMemo(() => taramalar.filter(t => t.site === site), [taramalar, site]);

  // Kampanya istatistikleri
  // OKUTMA = anlık geçiş noktasından kaydedilen taramalar (qrTaramalari).
  // Site kampanya izini CRM'e aktarırsa o kayıtlar da okutmaya eklenir
  // (aynı ziyaret iki kez sayılmasın diye yalnızca kampanyaya bağlı olanlar).
  // FORM = telefonu olan / gerçek adlı, kampanyaya bağlı kayıtlar.
  const formMu = (k) => telefonGecerliMi(k.iletisim) || (k.musteriAdi && !String(k.musteriAdi).includes('Ziyaretçi'));
  const ist = useMemo(() => {
    const m = {};
    kampanyalar.forEach(c => { m[c.id] = { bugun: 0, buAy: 0, tumu: 0, form: 0, formBuAy: 0, isAldik: 0, mobil: 0 }; });
    siteTaramalari.forEach(t => { const i = m[t.kampanyaId]; if (!i) return; i.tumu++; if (t.gun === bugun) i.bugun++; if ((t.gun || '').startsWith(buAy)) i.buAy++; if (t.cihaz === 'mobil') i.mobil++; });
    // DEĞİŞTİ: okutma yalnızca tarama kayıtlarından sayılır (site betiği + geçiş noktası);
    // havuz kayıtları sadece FORM / İŞ sayaçlarına girer — çift sayım olmaz.
    siteKayitlari.forEach(k => {
      const i = m[k.qrKampanyaId]; if (!i) return;
      const g = gunAnahtari(k.createdAt || '');
      if (formMu(k)) { i.form++; if (g.slice(0, 7) === buAy) i.formBuAy++; if (k.durum === 'İşi Aldık') i.isAldik++; }
    });
    return m;
  }, [kampanyalar, siteTaramalari, siteKayitlari, bugun, buAy]);
  const toplam = useMemo(() => ({
    tarama: Object.values(ist).reduce((t, i) => t + (i.tumu || 0), 0),
    taramaBugun: Object.values(ist).reduce((t, i) => t + (i.bugun || 0), 0),
    form: siteKayitlari.filter(k => k.qrKampanyaId && formMu(k)).length,
    isAldik: siteKayitlari.filter(k => k.qrKampanyaId && formMu(k) && k.durum === 'İşi Aldık').length,
  }), [ist, siteKayitlari]);

  const gorunen = kampanyalar.filter(c => { const a = ara.trim().toLocaleLowerCase('tr-TR'); return !a || [c.ad, c.tur, c.kod, c.notlar].some(x => String(x || '').toLocaleLowerCase('tr-TR').includes(a)); });
  const secili = kampanyalar.find(c => c.id === seciliId) || null;
  const seciliFormlar = useMemo(() => siteKayitlari.filter(k => k.qrKampanyaId === seciliId && formMu(k)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))), [siteKayitlari, seciliId]);
  // Son 14 gün tarama grafiği (seçili kampanya)
  const gunlukSeri = useMemo(() => {
    const seri = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const g = gunYmdQr(d);
      seri.push({ gun: g, adet: siteTaramalari.filter(t => t.kampanyaId === seciliId && t.gun === g).length }); }
    return seri;
  }, [siteTaramalari, siteKayitlari, seciliId]);
  const maxAdet = Math.max(1, ...gunlukSeri.map(x => x.adet));

  // ---- İşlemler
  const kaydet = async (form) => {
    const veri = { site, ad: form.ad, kod: form.kod, tur: form.tur, hedefUrl: form.hedefUrl, notlar: form.notlar || '', aktif: form.aktif !== false, guncellemeTarihi: new Date().toISOString() };
    try {
      if (form.id) { await updateDoc(qrKampanyaRef(form.id), veri); addSystemLog?.('QR Takip', `${r.ad}: "${veri.ad}" QR kampanyası güncellendi.`); }
      else { const ref = await addDoc(qrKampanyaKoleksiyonu(), { ...veri, taramaSayisi: 0, olusturmaTarihi: new Date().toISOString(), olusturan: currentUser?.fullName || '' }); addSystemLog?.('QR Takip', `${r.ad}: "${veri.ad}" için yeni takip QR'ı oluşturuldu (${veri.tur}).`); setSeciliId(ref.id); }
      setFormAcik(false);
    } catch (e) { alert('Kaydedilemedi: ' + e.message); }
  };
  const sil = async (c) => {
    if (!window.confirm(`"${c.ad}" silinsin mi? Basılı QR'lar artık sayılmaz (müşteri yine siteye yönlenir). Bu QR'a bağlı ${ist[c.id]?.form || 0} form kaydı havuzda kalır.`)) return;
    try { await deleteDoc(qrKampanyaRef(c.id)); if (seciliId === c.id) setSeciliId(null); } catch (e) { alert('Silinemedi: ' + e.message); }
  };
  const formuBagla = async (kayit, kampanyaId) => {
    const c = kampanyalar.find(x => x.id === kampanyaId);
    try {
      // DEĞİŞTİ: "Bağı kaldır (QR değil)" kalıcıdır (qrEslesmeYok) — otomatik eşleştirme
      // kaydı tekrar bağlamaz. Kayıt sunucuda 'qr' olarak işaretlendiyse, QR'dan ÖNCEKİ
      // asıl kaynağa (submit-lead.js oncekiReklamKaynagi'ne yazar) geri döner.
      if (!c) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', kayit.id), {
        qrKampanyaId: null, qrKampanyaAd: null, qrEslesme: null, qrEslesmeYok: kampanyaId === '__yok__' ? true : null,
        ...(kampanyaId === '__yok__' && kayit.reklamKaynagi === 'qr' ? { reklamKaynagi: kayit.oncekiReklamKaynagi || 'direkt_giris', qrKodu: null } : {}),
      });
      else await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'havuzKayitlari', kayit.id), { qrKampanyaId: c.id, qrKampanyaAd: c.ad, qrEslesme: 'elle', qrEslesmeYok: null, qrEslesmeZamani: new Date().toISOString(), qrEslestiren: currentUser?.fullName || '' });
    } catch (e) { alert('Güncellenemedi: ' + e.message); }
  };
  // DEĞİŞTİ (kullanıcı talebi): tüm otomatik eşleşmeler tek etiket — "QR ile geldi"
  const ESLESME = { utm: { ad: 'QR ile geldi', s: 'bg-emerald-100 text-emerald-800' }, zaman: { ad: 'QR ile geldi', s: 'bg-emerald-100 text-emerald-800' }, elle: { ad: 'QR ile geldi', s: 'bg-emerald-100 text-emerald-800' } };
  const trhS = (iso) => { const d = new Date(iso || 0); return isNaN(d) ? '—' : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in space-y-4">
      {/* BAŞLIK */}
      <div className={`rounded-2xl p-4 text-white shadow-lg ${r.renk === 'blue' ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900' : 'bg-gradient-to-r from-red-900 via-red-800 to-red-900'}`}>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onGeri} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl" title="Müşteri Havuzu'na dön"><ChevronLeft className="w-5 h-5" /></button>
            <span className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg shrink-0"><QrCode className="w-6 h-6" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{r.ad} • Reklam QR Takibi</p>
              <h2 className="text-xl font-black leading-tight">QR Takip</h2>
            </div>
          </div>
          <button type="button" onClick={() => { setFormBaslangic(null); setFormAcik(true); }} className="px-4 py-2.5 bg-white text-black hover:bg-neutral-100 font-black rounded-xl shadow-lg flex items-center gap-2 text-sm">
            <PlusCircle className="w-4 h-4" /> Yeni QR Oluştur
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
          {[
            { e: 'QR Sayısı', v: kampanyalar.length }, { e: 'Toplam Okutma', v: toplam.tarama }, { e: 'Bugün Okutma', v: toplam.taramaBugun },
            { e: 'QR\'dan Gelen Form', v: toplam.form }, { e: 'QR\'dan İş Alındı', v: toplam.isAldik },
          ].map(k => <div key={k.e} className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-center"><div className="text-xl font-black tabular-nums">{k.v}</div><div className="text-[9px] font-black uppercase text-white/60">{k.e}</div></div>)}
        </div>
      </div>

      {kampanyalar.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[13px] font-bold text-amber-900">
          <p className="font-black mb-1">Nasıl çalışır?</p>
          <ol className="list-decimal ml-5 space-y-0.5">
            <li>"Yeni QR Oluştur" — adını (örn. <b>34 NAR 385 QR</b>), nereye basılacağını ve yönlendirme adresini girin.</li>
            <li>Oluşan QR'ı PNG/SVG indirip kamyon kasasına, bilborda, dergiye basın. Her QR'ın kendi izi vardır.</li>
            <li>Müşteri okutunca yarım saniyelik görünmez bir geçişle site açılır (okutma sayılır); form gelince 45 dk içindeki okutmayla eşleşip bu QR'a bağlanır.</li>
            <li>Form tamamlanınca Müşteri Havuzu'na "Organik" değil, <b>QR adıyla</b> düşer; burada kaç okutma → kaç form → kaç iş görürsünüz.</li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* SOL: KAMPANYA LİSTESİ */}
        <div className="lg:col-span-2 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={ara} onChange={e => setAra(e.target.value)} placeholder="QR adı, tür, kod ara…" className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm font-bold focus:border-black outline-none" />
          </div>
          {gorunen.length === 0 && <div className="text-center py-8 text-xs font-bold text-neutral-400 bg-white rounded-2xl border border-dashed border-neutral-300">Henüz QR oluşturulmamış.</div>}
          {gorunen.map(c => { const i = ist[c.id] || {}; const donusum = i.tumu ? Math.round((i.form / i.tumu) * 100) : 0; return (
            <div key={c.id} onClick={() => setSeciliId(c.id)} className={`rounded-2xl border-2 p-3 cursor-pointer transition bg-white ${seciliId === c.id ? 'border-black shadow-lg' : 'border-neutral-200 hover:border-neutral-400'} ${c.aktif === false ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-8 h-8 rounded-lg ${r.renk === 'blue' ? 'bg-blue-600' : 'bg-red-600'} text-white flex items-center justify-center shrink-0`}><QrCode className="w-4 h-4" /></span>
                    <div className="min-w-0"><p className="font-black text-black text-sm truncate">{c.ad}</p><p className="text-[10px] font-bold text-neutral-500">{c.tur} • <span className="font-mono">{c.kod}</span></p></div>
                    {c.aktif === false && <span className="text-[9px] font-black bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full">PASİF</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={e => { e.stopPropagation(); setFormBaslangic(c); setFormAcik(true); }} className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={e => { e.stopPropagation(); sil(c); }} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                {[{ e: 'Okutma', v: i.tumu || 0, s: 'bg-neutral-900 text-white' }, { e: 'Bugün', v: i.bugun || 0, s: 'bg-neutral-100 text-neutral-800' }, { e: 'Form', v: i.form || 0, s: 'bg-amber-100 text-amber-800' }, { e: 'İş', v: i.isAldik || 0, s: 'bg-emerald-100 text-emerald-800' }, { e: 'Dönüşüm', v: `%${donusum}`, s: 'bg-blue-100 text-blue-800' }]
                  .map(k => <div key={k.e} className={`rounded-lg px-1 py-1.5 text-center ${k.s}`}><div className="text-sm font-black leading-none">{k.v}</div><div className="text-[8px] font-black uppercase mt-0.5 opacity-80">{k.e}</div></div>)}
              </div>
            </div>
          ); })}
        </div>

        {/* SAĞ: DETAY */}
        <div className="lg:col-span-3 space-y-4">
          {!secili ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-sm font-bold text-neutral-400">Soldan bir QR seçin: kodu, bağlantısı, günlük okutma grafiği ve gelen formlar burada görünür.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="bg-black text-white p-4 flex flex-col sm:flex-row gap-4">
                <QrTakipKodPaneli kampanya={secili} boyut={150} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-lg leading-tight">{secili.ad}</h3>
                  <p className="text-xs font-bold text-white/70 mt-1">{secili.tur} • kod <span className="font-mono">{secili.kod}</span></p>
                  <p className="text-[11px] font-bold text-white/60 mt-2 break-all">Site adresi: {qrHedefUrlUret(secili.hedefUrl || r.varsayilanUrl, secili)}</p>
                  {secili.notlar && <p className="text-[11px] font-bold text-white/60 mt-1 italic">{secili.notlar}</p>}
                  <p className="text-[10px] font-bold text-white/50 mt-2">Oluşturma: {trhS(secili.olusturmaTarihi)} • Son okutma: {secili.sonTarama ? trhS(secili.sonTarama) : '—'}</p>
                </div>
              </div>
              {/* 14 GÜNLÜK GRAFİK */}
              <div className="p-4 border-b border-neutral-200">
                <p className="text-[10px] font-black uppercase text-neutral-500 mb-2">Son 14 gün okutma</p>
                <div className="flex items-end gap-1 h-20">
                  {gunlukSeri.map(x => (
                    <div key={x.gun} className="flex-1 flex flex-col items-center gap-1" title={`${x.gun}: ${x.adet}`}>
                      <div className={`w-full rounded-t ${x.adet ? (r.renk === 'blue' ? 'bg-blue-600' : 'bg-red-600') : 'bg-neutral-200'}`} style={{ height: `${Math.max(4, (x.adet / maxAdet) * 64)}px` }}></div>
                      <span className="text-[8px] font-bold text-neutral-400">{x.gun.slice(8)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* BU QR'DAN GELEN FORMLAR */}
              <div className="p-4">
                <h4 className="font-black text-black text-sm flex items-center gap-2 mb-2"><ClipboardList className="w-4 h-4" /> Bu QR'dan gelen formlar <span className="text-xs font-bold text-neutral-400">({seciliFormlar.length})</span></h4>
                {seciliFormlar.length === 0 ? <p className="text-xs font-bold text-neutral-400">Henüz form gelmedi. Okutmalar yukarıda birikiyor; form gelince burada ve Müşteri Havuzu'nda "{secili.ad}" etiketiyle görünür.</p> : (
                  <div className="space-y-1.5">
                    {seciliFormlar.map(k => { const e = ESLESME[k.qrEslesme] || ESLESME.elle; return (
                      <div key={k.id} className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 text-xs">
                        <span className="text-neutral-500 shrink-0">{trhS(k.createdAt)}</span>
                        <span className="font-black text-black truncate">{k.musteriAdi || k.iletisim || '—'}</span>
                        <span className="text-neutral-500 shrink-0">{k.iletisim || ''}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${e.s}`}>{e.ad}</span>
                        <span className="ml-auto text-[10px] font-black text-neutral-600 shrink-0">{k.durum || 'Yeni'}</span>
                        <select value={k.qrKampanyaId || ''} onChange={ev => formuBagla(k, ev.target.value)} className="text-[10px] font-black border border-neutral-300 rounded-lg px-1 py-1 bg-white shrink-0" title="Başka QR'a taşı / bağı kaldır">
                          {kampanyalar.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}
                          <option value="__yok__">Bağı kaldır (QR değil)</option>
                        </select>
                      </div>
                    ); })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KALDIRILDI (kullanıcı talebi): "Bağlanmamış organik formlar" — QR ile form doldurulunca
              eşleşme otomatik yapıldığı için elle bağlama bölümü gerekmiyor. */}
        </div>
      </div>

      <QrKampanyaFormu acik={formAcik} site={site} baslangic={formBaslangic} onKapat={() => setFormAcik(false)} onKaydet={kaydet} />
    </div>
  );
};

// ############################################################################
// ############################################################################
//  YENİ (kullanıcı talebi): TELEFON TEKLİFLERİ MODÜLÜ — SÜRÜM 2
// ----------------------------------------------------------------------------
//  Müşteri Havuzu'nda Hızlı Teklifler'in ÜSTÜNDEKİ bölüm. Bu sürümde:
//    • Soru soru ilerleyen görüşme sihirbazı: Evden Eve 7 soru, DepoEvim
//      5 soru (+ nakliye isterse nakliye soruları açılır), Depodan Çıkış.
//    • Sorular KAYIT EKRANIYLA AYNI değerleri kullanır (Daire Tipi, Kat,
//      Taşıma Şekli, Eşya Durumu, İl/İlçe) → "Kayıt Aç" ile form dolu açılır.
//    • Eylül 2026 PDF fiyat listelerinden TEK bir sistem fiyatı hesaplanır.
//    • Her satışçı KENDİ görüşmelerini görür; yöneticiler hepsini görür.
//    • Personel transferi, Sembol ↔ DepoEvim aktarımı, WhatsApp hazır
//      mesajları, telefon numarasıyla müşteri geçmişi uyarısı.
//  Bölümler: (1) Sabitler & fiyatlar  (2) Hesaplama & yardımcılar
//            (3) Ortak bileşenler      (4) Sihirbaz form
//            (5) Liste / detay / sayfa
//  NOT: Satis.jsx'te zaten bulunan bugunStr / tl ile çakışmasın diye bu
//  modüldekiler ttBugunStr / ttTl olarak adlandırıldı.
// ############################################################################
// ############################################################################

// Firestore: artifacts/{appId}/public/data/telefonTeklifleri
// (havuzKayitlari'na dokunulmaz; Hızlı Teklif istatistikleri etkilenmez)
const TELEFON_TEKLIF_KOLEKSIYONU = 'telefonTeklifleri';
const ttKoleksiyon = () => collection(db, 'artifacts', appId, 'public', 'data', TELEFON_TEKLIF_KOLEKSIYONU);
const ttBelge = (id) => doc(db, 'artifacts', appId, 'public', 'data', TELEFON_TEKLIF_KOLEKSIYONU, id);

// ============================================================================
// (1) SABİTLER
// ============================================================================

// Görüşme durumları — Hızlı Teklifler ile BİREBİR aynı id'ler (raporlar uyumlu).
// Durum sonradan istenildiği kadar değiştirilebilir; her değişiklik geçmişe yazılır.
const TT_DURUMLAR = [
  { id: 'Yeni',            etiket: 'Yeni',                     rozet: 'bg-neutral-100 text-neutral-700 border-neutral-300', nokta: 'bg-neutral-400' },
  { id: 'Dönüş Bekliyor',  etiket: 'Dönüş Bekliyoruz',         rozet: 'bg-amber-50 text-amber-700 border-amber-300',       nokta: 'bg-amber-500' },
  { id: 'Tekrar Aranacak', etiket: 'Tekrar Aranacak',          rozet: 'bg-sky-50 text-sky-700 border-sky-300',             nokta: 'bg-sky-500' },
  { id: 'Ulaşılamadı',     etiket: 'Ulaşılamadı',              rozet: 'bg-orange-50 text-orange-700 border-orange-300',    nokta: 'bg-orange-500' },
  { id: 'Bilgi Aldı',      etiket: 'Kesin Değil · Bilgi Aldı', rozet: 'bg-purple-50 text-purple-700 border-purple-300',    nokta: 'bg-purple-600' },
  { id: 'İşi Aldık',       etiket: 'İşi Aldık',                rozet: 'bg-green-50 text-green-700 border-green-300',       nokta: 'bg-green-600' },
  { id: 'Reddedildi',      etiket: 'Reddedildi',               rozet: 'bg-red-50 text-red-700 border-red-300',             nokta: 'bg-red-600' },
];
const ttDurumBul = (id) => TT_DURUMLAR.find(d => d.id === id) || TT_DURUMLAR[0];
// YENİ (kullanıcı talebi): Telefon Görüşmesi'nde SEÇİLEBİLEN durumlar — "Ulaşılamadı" ve
// "Kesin Değil · Bilgi Aldı" kaldırıldı (Evden Eve, Eşya Depolama, Depodan Çıkış hepsinde).
// TT_DURUMLAR aynen duruyor: bu durumdaki ESKİ kayıtlar etiketini/rengini kaybetmez.
const TT_SECILEBILIR_DURUMLAR = TT_DURUMLAR.filter(d => d.id !== 'Ulaşılamadı' && d.id !== 'Bilgi Aldı');
const TT_KAPALI_DURUMLAR = ['İşi Aldık', 'Reddedildi']; // Bunlarda takip "gecikti" sayılmaz

// Hizmetler — renkler canlı ve belirgin (kullanıcı talebi: "çok soluk").
// Tailwind dinamik sınıf üretmediği için tüm sınıflar açık yazılır.
const TT_HIZMETLER = [
  { id: 'Nakliye', ad: 'Evden Eve Nakliyat', alt: 'Sembol Nakliyat · şehir içi / şehirler arası', marka: 'SEMBOL', site: 'sembolevdeneve', Ikon: Truck,
    stil: { secili: 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/30', pasif: 'bg-white text-red-700 border-red-200 hover:border-red-500 hover:bg-red-50',
      rozet: 'bg-red-600 text-white', acik: 'bg-red-50 text-red-800 border-red-200', dugme: 'bg-red-600 hover:bg-red-700 shadow-red-600/30', serit: 'bg-red-600', yazi: 'text-red-700', halka: 'focus:ring-red-500' } },
  { id: 'Depo', ad: 'Eşya Depolama', alt: 'DepoEvim · eşyanın depoya girişi', marka: 'DEPOEVİM', site: 'depoevim', Ikon: Package,
    stil: { secili: 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/30', pasif: 'bg-white text-blue-700 border-blue-200 hover:border-blue-500 hover:bg-blue-50',
      rozet: 'bg-blue-600 text-white', acik: 'bg-blue-50 text-blue-800 border-blue-200', dugme: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30', serit: 'bg-blue-600', yazi: 'text-blue-700', halka: 'focus:ring-blue-500' } },
  { id: 'Depodan Çıkış', ad: 'Depodan Çıkış', alt: 'DepoEvim · depodan yeni adrese teslim', marka: 'DEPOEVİM', site: 'depoevim', Ikon: ArrowUpRight,
    stil: { secili: 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-600/30', pasif: 'bg-white text-violet-700 border-violet-200 hover:border-violet-500 hover:bg-violet-50',
      rozet: 'bg-violet-600 text-white', acik: 'bg-violet-50 text-violet-800 border-violet-200', dugme: 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/30', serit: 'bg-violet-600', yazi: 'text-violet-700', halka: 'focus:ring-violet-500' } },
];
const ttHizmetBul = (id) => TT_HIZMETLER.find(h => h.id === id) || TT_HIZMETLER[0];

// İl listesi: sık aranan iller EN ÜSTTE (kullanıcı talebi), kalanlar alfabetik.
// Değerler kayıt ekranındaki PROVINCES ile aynıdır ("İstanbul (Anadolu)" vb.).
const TT_ONCELIKLI_ILLER = ['İstanbul (Anadolu)', 'İstanbul (Avrupa)', 'Kocaeli', 'Bursa', 'İzmir', 'Ankara'];
const TT_DIGER_ILLER = PROVINCES.filter(il => !TT_ONCELIKLI_ILLER.includes(il));
const ttIlceler = (il) => TURKEY_LOCATIONS[il] || [];

// Daire tipi — kayıt ekranındaki "Daire Tipi" değerleriyle aynı (Depoevim Tesisleri hariç)
const TT_ODA_SECENEKLERI = [
  { id: '1+0', ad: '1+0' }, { id: '1+1', ad: '1+1' }, { id: '2+1', ad: '2+1' }, { id: '3+1', ad: '3+1' }, { id: '4+1', ad: '4+1' },
  { id: 'Villa', ad: '5+1 ve üzeri / Villa / Müstakil' }, { id: 'Ofis', ad: 'Kurumsal Ofis Taşıma' }, { id: 'Parça Eşya', ad: 'Parça Eşya' },
];

// Taşıma şekli — kayıt ekranındaki "Taşıma Şekli" değerleri; metinler web sihirbazındaki gibi
const TT_TASIMA = [
  { id: 'Merdiven',           ad: 'Merdivenden taşınacak',          alt: 'Bina asansörü yok / kullanılmayacak' },
  { id: 'Bina Asansörü',      ad: 'Bina asansörü ile',              alt: 'Eşyalar bina asansörüne sığıyor' },
  { id: 'Dış Cephe Asansörü', ad: 'Dış cephe asansörü kurulsun',    alt: 'Pencere / balkon yola bakmalı' },
];
// Kamyon yanaşma — kayıt ekranındaki "Yükleme Mesafesi" (metre) alanına yazılır
const TT_YANASMA = [
  { id: '0',   ad: 'Evet, binaya yanaşıyor' },
  { id: '50',  ad: 'Yanaşmıyor · yaklaşık 50 m' },
  { id: '100', ad: 'Yanaşmıyor · yaklaşık 100 m' },
  { id: '150', ad: 'Yanaşmıyor · yaklaşık 150 m' },   // YENİ (kullanıcı talebi)
  { id: '200', ad: 'Yanaşmıyor · yaklaşık 200 m' },   // YENİ (kullanıcı talebi)
];
// Küçük eşya paketleme — kayıt ekranındaki "Eşya Durumu" ile eşlenir
const TT_TOPLAMA = [
  { id: 'Müşteri', ad: 'Kendim toplayacağım', alt: 'Küçük eşyalar taşıma günü kolili hazır olur' }, // DEĞİŞTİ: paketleme → toplama
  { id: 'Firma',   ad: 'Firma toplasın', alt: 'Toplama hizmeti ekstra ücretlidir' },          // DEĞİŞTİ: paketleme → toplama
];
const TT_VIDEO = ['Paylaşmadı', 'Bekleniyor', 'Alındı', 'Keşif Yapıldı'];
const TT_ESYA_CINSI = [
  { id: 'Ev Eşyası', ad: 'Ev eşyası', alt: 'Müşterilerin %70-80\'i' },
  { id: 'İş Yeri Eşyası', ad: 'İş yeri eşyası', alt: 'Arşiv, stok, ofis — Mehmet Bey\'e aktarılır' },
];
const TT_NAKLIYE_TERCIHI = [
  { id: 'Kendisi', ad: 'Eşyalarımı kendim getiririm', alt: 'Nakliye soruları sorulmaz' },
  { id: 'Firma',   ad: 'Firma adresimden alsın (Anahtar Teslim)', alt: 'Sigortalı taşıma, kendi ekibimiz, kalıcı ambalaj' },
];

// Depo boyutları ve kiralama süreleri — src/fiyatSema.js (API ile ortak)
const TT_DEPO_BOYUTLARI = DEPO_BOYUTLARI;
const TT_KIRALAMA = DEPO_KIRALAMA;
// Şubeler — kayıt ekranının "Depo" seçimiyle aynı isimler (DEPO_LOCATIONS)
const TT_SUBELER = [...DEPO_LOCATIONS.map(d => d.name), 'Farketmez'];
const TT_KDV = 0.20;

// ============================================================================
// FİYAT LİSTELERİ — "... Fiyat Listesi 2026.pdf" (Güncel • Eylül 2026)
// Fiyat değişince SADECE bu tablolar güncellenir; tüm ekranlar yeni fiyatı kullanır.
// ============================================================================
// Şehir içi evden eve (Anadolu Yakası çıkışlı taban + ekler)
const FL_SEHIR_ICI_EVE = {
  taban:        { '1+0': 18000, '1+1': 25000, '2+1': 30000, '3+1': 35000, '4+1': 42000 },
  toplama:      { '1+0': 3000,  '1+1': 5000,  '2+1': 8000,  '3+1': 10000, '4+1': 15000 },
  // YENİ (kullanıcı talebi): 6-7. kat, 9-13 kat dış cephe, 4+1 Avrupa ekstra, 150-200 m yürüme
  // eklendi. PDF'te olmayan tutarlar TAHMİNİDİR (aynı artış adımıyla) — Fiyat Tablosu'ndan düzeltin.
  merdiven:     { 3: 2000, 4: 4000, 5: 6000, 6: 8000, 7: 10000 },
  disCephe:     { Anadolu: 3000, Avrupa: 5000, Anadolu913: 4500, Avrupa913: 7500 },   // Avrupa: tek taraf kurulum
  avrupaEkstra: { '1+0': 4500, '1+1': 5500, '2+1': 6500, '3+1': 11000, '4+1': 11000 },
  yurume:       { 50: 3500, 100: 6500, 150: 9500, 200: 12500 },
};
// Şehir içi evden depoya (depo müşterisine özel)
const FL_SEHIR_ICI_DEPO = {
  taban:        { '1+0': 14000, '1+1': 18000, '2+1': 25000, '3+1': 30000, '4+1': 35000 },
  toplama:      { '1+0': 2000,  '1+1': 4000,  '2+1': 6000,  '3+1': 8000,  '4+1': 10000 },
  merdiven:     { 3: 1000, 4: 3000, 5: 5000, 6: 7000, 7: 9000 },
  disCephe:     { Anadolu: 3000, Avrupa: 4500, Anadolu913: 4500, Avrupa913: 7000 },
  avrupaEkstra: { '1+0': 4000, '1+1': 5000, '2+1': 6000, '3+1': 10000, '4+1': 10000 },
  yurume:       { 50: 3000, 100: 6000, 150: 9000, 200: 12000 },
};
// Şehirler arası ekler (iki listede de aynı)
const FL_SEHIRLER_ARASI_EK = {
  toplama:  { '1+0': 3500, '1+1': 5500, '2+1': 9000, '3+1': 11000, '4+1': 16500 },
  merdiven: { 3: 2500, 4: 4500, 5: 6500, 6: 8500, 7: 10500 },
  disCephe: { Anadolu: 3500, Avrupa: 5000, Anadolu913: 5500, Avrupa913: 7500 },
  yurume:   { 50: 4000, 100: 7000, 150: 10000, 200: 13000 },
};
// 81 il — Pendik operasyon merkezi çıkışlı [1+1, 2+1, 3+1, 4+1]
// (Trakya / Avrupa ötesi illerde %15 geçiş farkı dahildir)
const FL_IL_EVDEN_EVE = {
  'Adana': [87000, 113000, 134000, 159000], 'Adıyaman': [102000, 132000, 156000, 185000], 'Afyonkarahisar': [56000, 77000, 92000, 110000],
  'Aksaray': [72000, 96000, 114000, 136000], 'Amasya': [72000, 96000, 114000, 136000], 'Ankara': [61000, 77000, 99000, 125000],
  'Antalya': [72000, 88000, 110000, 136000], 'Ardahan': [117000, 148000, 176000, 210000], 'Artvin': [108000, 139000, 164000, 194000],
  'Aydın': [66000, 82000, 105000, 133000], 'Ağrı': [113000, 145000, 172000, 204000], 'Balıkesir': [55000, 72000, 94000, 120000],
  'Bartın': [57000, 79000, 95000, 114000], 'Batman': [117000, 148000, 176000, 210000], 'Bayburt': [97000, 125000, 148000, 176000],
  'Bilecik': [44000, 66000, 77000, 90000], 'Bingöl': [108000, 139000, 164000, 194000], 'Bitlis': [119000, 152000, 179000, 211000],
  'Bolu': [48000, 68000, 81000, 97000], 'Burdur': [68000, 91000, 109000, 131000], 'Bursa': [42000, 61000, 73000, 87000],
  'Çanakkale': [58000, 81000, 98000, 118000], 'Çankırı': [61000, 82000, 99000, 119000], 'Çorum': [68000, 91000, 109000, 131000],
  'Denizli': [67000, 89000, 107000, 129000], 'Diyarbakır': [111000, 142000, 168000, 199000], 'Düzce': [45000, 65000, 78000, 94000],
  'Edirne': [54000, 76000, 92000, 111000], 'Elazığ': [102000, 132000, 156000, 185000], 'Erzincan': [94000, 122000, 144000, 170000],
  'Erzurum': [102000, 132000, 156000, 185000], 'Eskişehir': [44000, 66000, 77000, 90000], 'Gaziantep': [97000, 125000, 148000, 176000],
  'Giresun': [85000, 111000, 132000, 157000], 'Gümüşhane': [94000, 122000, 144000, 170000], 'Hakkari': [136000, 173000, 204000, 241000],
  'Hatay': [97000, 125000, 148000, 176000], 'Isparta': [68000, 91000, 109000, 131000], 'İzmir': [66000, 82000, 105000, 133000],
  'Iğdır': [122000, 156000, 184000, 218000], 'Kahramanmaraş': [94000, 122000, 144000, 170000], 'Karabük': [56000, 77000, 92000, 110000],
  'Karaman': [79000, 105000, 124000, 147000], 'Kars': [113000, 145000, 172000, 204000], 'Kastamonu': [62000, 84000, 100000, 119000],
  'Kayseri': [78000, 102000, 122000, 146000], 'Kilis': [99000, 129000, 152000, 180000], 'Kocaeli': [38000, 56000, 68000, 82000],
  'Konya': [72000, 88000, 110000, 136000], 'Kütahya': [53000, 73000, 87000, 104000], 'Kırklareli': [53000, 74000, 89000, 107000],
  'Kırıkkale': [64000, 86000, 102000, 121000], 'Kırşehir': [69000, 94000, 111000, 131000], 'Malatya': [97000, 125000, 148000, 176000],
  'Manisa': [58000, 79000, 95000, 114000], 'Mardin': [117000, 148000, 176000, 210000], 'Mersin': [85000, 111000, 132000, 157000],
  'Muğla': [77000, 94000, 116000, 142000], 'Muş': [113000, 145000, 172000, 204000], 'Nevşehir': [75000, 100000, 119000, 142000],
  'Niğde': [79000, 105000, 124000, 147000], 'Ordu': [82000, 108000, 129000, 154000], 'Osmaniye': [90000, 118000, 140000, 166000],
  'Rize': [99000, 129000, 152000, 180000], 'Sakarya': [42000, 61000, 73000, 87000], 'Samsun': [77000, 99000, 121000, 147000],
  'Siirt': [122000, 156000, 184000, 218000], 'Sinop': [73000, 97000, 114000, 134000], 'Sivas': [84000, 110000, 131000, 156000],
  'Şanlıurfa': [105000, 135000, 160000, 190000], 'Şırnak': [128000, 163000, 191000, 225000], 'Tekirdağ': [48000, 69000, 84000, 102000],
  'Tokat': [78000, 103000, 123000, 147000], 'Trabzon': [94000, 121000, 143000, 169000], 'Tunceli': [102000, 132000, 156000, 185000],
  'Uşak': [61000, 82000, 98000, 117000], 'Van': [125000, 160000, 188000, 222000], 'Yalova': [38000, 56000, 68000, 82000],
  'Yozgat': [70000, 95000, 112000, 132000], 'Zonguldak': [53000, 73000, 87000, 104000],
};
const FL_IL_EVDEN_DEPOYA = {
  'Adana': [70000, 90000, 107000, 127000], 'Adıyaman': [82000, 106000, 125000, 148000], 'Afyonkarahisar': [45000, 62000, 74000, 88000],
  'Aksaray': [58000, 77000, 91000, 109000], 'Amasya': [58000, 77000, 91000, 109000], 'Ankara': [49000, 62000, 79000, 100000],
  'Antalya': [58000, 70000, 88000, 109000], 'Ardahan': [94000, 118000, 141000, 168000], 'Artvin': [86000, 111000, 131000, 155000],
  'Aydın': [53000, 66000, 84000, 106000], 'Ağrı': [90000, 116000, 138000, 163000], 'Balıkesir': [44000, 58000, 75000, 96000],
  'Bartın': [46000, 63000, 76000, 91000], 'Batman': [94000, 118000, 141000, 168000], 'Bayburt': [78000, 100000, 118000, 141000],
  'Bilecik': [35000, 53000, 62000, 72000], 'Bingöl': [86000, 111000, 131000, 155000], 'Bitlis': [95000, 122000, 143000, 169000],
  'Bolu': [38000, 54000, 65000, 78000], 'Burdur': [54000, 73000, 87000, 105000], 'Bursa': [34000, 49000, 58000, 70000],
  'Çanakkale': [46000, 65000, 78000, 94000], 'Çankırı': [49000, 66000, 79000, 95000], 'Çorum': [54000, 73000, 87000, 105000],
  'Denizli': [54000, 71000, 86000, 103000], 'Diyarbakır': [89000, 114000, 134000, 159000], 'Düzce': [36000, 52000, 62000, 75000],
  'Edirne': [43000, 61000, 74000, 89000], 'Elazığ': [82000, 106000, 125000, 148000], 'Erzincan': [75000, 98000, 115000, 136000],
  'Erzurum': [82000, 106000, 125000, 148000], 'Eskişehir': [35000, 53000, 62000, 72000], 'Gaziantep': [78000, 100000, 118000, 141000],
  'Giresun': [68000, 89000, 106000, 126000], 'Gümüşhane': [75000, 98000, 115000, 136000], 'Hakkari': [109000, 138000, 163000, 193000],
  'Hatay': [78000, 100000, 118000, 141000], 'Isparta': [54000, 73000, 87000, 105000], 'İzmir': [53000, 66000, 84000, 106000],
  'Iğdır': [98000, 125000, 147000, 174000], 'Kahramanmaraş': [75000, 98000, 115000, 136000], 'Karabük': [45000, 62000, 74000, 88000],
  'Karaman': [63000, 84000, 99000, 118000], 'Kars': [90000, 116000, 138000, 163000], 'Kastamonu': [50000, 67000, 80000, 95000],
  'Kayseri': [62000, 82000, 98000, 117000], 'Kilis': [79000, 103000, 122000, 144000], 'Kocaeli': [30000, 45000, 54000, 66000],
  'Konya': [58000, 70000, 88000, 109000], 'Kütahya': [42000, 58000, 70000, 83000], 'Kırklareli': [42000, 59000, 71000, 86000],
  'Kırıkkale': [51000, 69000, 82000, 97000], 'Kırşehir': [55000, 75000, 89000, 105000], 'Malatya': [78000, 100000, 118000, 141000],
  'Manisa': [46000, 63000, 76000, 91000], 'Mardin': [94000, 118000, 141000, 168000], 'Mersin': [68000, 89000, 106000, 126000],
  'Muğla': [62000, 75000, 93000, 114000], 'Muş': [90000, 116000, 138000, 163000], 'Nevşehir': [60000, 80000, 95000, 114000],
  'Niğde': [63000, 84000, 99000, 118000], 'Ordu': [66000, 86000, 103000, 123000], 'Osmaniye': [72000, 94000, 112000, 133000],
  'Rize': [79000, 103000, 122000, 144000], 'Sakarya': [34000, 49000, 58000, 70000], 'Samsun': [62000, 79000, 97000, 118000],
  'Siirt': [98000, 125000, 147000, 174000], 'Sinop': [58000, 78000, 91000, 107000], 'Sivas': [67000, 88000, 105000, 125000],
  'Şanlıurfa': [84000, 108000, 128000, 152000], 'Şırnak': [102000, 130000, 153000, 180000], 'Tekirdağ': [38000, 55000, 67000, 82000],
  'Tokat': [62000, 82000, 98000, 118000], 'Trabzon': [75000, 97000, 114000, 135000], 'Tunceli': [82000, 106000, 125000, 148000],
  'Uşak': [49000, 66000, 78000, 94000], 'Van': [100000, 128000, 150000, 178000], 'Yalova': [30000, 45000, 54000, 66000],
  'Yozgat': [56000, 76000, 90000, 106000], 'Zonguldak': [42000, 58000, 70000, 83000],
};

// ============================================================================
// YENİ (kullanıcı talebi): DÜZENLENEBİLİR FİYAT TABLOSU
// ----------------------------------------------------------------------------
// Yukarıdaki PDF fiyatları VARSAYILANDIR. Müdür "Fiyat Tablosu" penceresinden
// fiyatları değiştirince Firestore'a (ayarlar/fiyatTablosu) yazılır; tüm
// kullanıcılarda canlı olarak bu tablolara uygulanır ve sistem fiyatı
// hesaplaması (ttFiyatHesapla) anında yeni fiyatları kullanır.
// ============================================================================
// Şehirler arası ekler Evden Depoya listesi için AYRI düzenlenir (varsayılan: aynı değerler)
const FL_SEHIRLER_ARASI_EK_DEPO = JSON.parse(JSON.stringify(FL_SEHIRLER_ARASI_EK));
// Kiralık depo aylık ücretleri — ŞUBE BAZLI, +KDV girilir. "Genel" = şube farketmez / web sitesi
const TT_DEPO_KIRA = (() => {
  const genel = {};
  TT_DEPO_BOYUTLARI.forEach(b => { if (b.aylik) genel[b.id] = b.aylik; });
  const liste = { Genel: { ...genel } };
  DEPO_LOCATIONS.forEach(d => { liste[d.name] = { ...genel }; });
  return liste;
})();
// YENİ (kullanıcı talebi): açılış fiyatı oranı (taban + %X) — Fiyat Tablosu'ndan
// değiştirilebilir, Sembol ve DepoEvim için ayrı. Varsayılan %25.
const TT_FIYAT_GENEL = { acilisOraniEve: 25, acilisOraniDepo: 25 };
// YENİ (kullanıcı talebi): km bazlı fiyat ayarları — Fiyat Tablosu'ndan (Firestore) üzerine yazılır
const TT_MESAFE = JSON.parse(JSON.stringify(MESAFE_VARSAYILAN));

// ============================================================================
// YENİ (kullanıcı talebi): 81 İL TABLOSUNU KM'YE GÖRE YENİDEN HESAPLAMA
// ----------------------------------------------------------------------------
// Pendik hareket merkezinden her il MERKEZİNE karayolu km'si. Kaynak: KGM İller
// Arası Mesafe Cetveli (2020) + KGM İl-İlçe Mesafe Kitabı (Pendik → İstanbul
// merkezi 39 km), Pendik'in il merkezine göre konumu hesaba katılarak.
const TT_PENDIK_IL_KM = {
  'Adana': 909, 'Adıyaman': 1160, 'Afyonkarahisar': 420, 'Aksaray': 642, 'Amasya': 674, 'Ankara': 415, 'Antalya': 687, 'Ardahan': 1412,
  'Artvin': 1303, 'Aydın': 673, 'Ağrı': 1472, 'Balıkesir': 390, 'Bartın': 388, 'Batman': 1419, 'Bayburt': 1163, 'Bilecik': 210,
  'Bingöl': 1276, 'Bitlis': 1465, 'Bolu': 236, 'Burdur': 565, 'Bursa': 220, 'Çanakkale': 341, 'Çankırı': 462, 'Çorum': 608,
  'Denizli': 617, 'Diyarbakır': 1319, 'Düzce': 201, 'Edirne': 300, 'Elazığ': 1169, 'Erzincan': 1098, 'Erzurum': 1281, 'Eskişehir': 287,
  'Gaziantep': 1072, 'Giresun': 987, 'Gümüşhane': 1060, 'Hakkari': 1759, 'Hatay': 1100, 'Isparta': 563, 'İzmir': 562, 'Iğdır': 1571,
  'Kahramanmaraş': 996, 'Karabük': 366, 'Karaman': 740, 'Kars': 1459, 'Kastamonu': 478, 'Kayseri': 735, 'Kilis': 1132, 'Kocaeli': 77,
  'Konya': 626, 'Kütahya': 321, 'Kırklareli': 250, 'Kırıkkale': 493, 'Kırşehir': 601, 'Malatya': 1070, 'Manisa': 525, 'Mardin': 1398,
  'Mersin': 903, 'Muğla': 766, 'Muş': 1382, 'Nevşehir': 692, 'Niğde': 764, 'Ordu': 909, 'Osmaniye': 996, 'Rize': 1209,
  'Sakarya': 124, 'Samsun': 746, 'Siirt': 1506, 'Sinop': 651, 'Sivas': 854, 'Şanlıurfa': 1209, 'Şırnak': 1570, 'Tekirdağ': 182,
  'Tokat': 750, 'Trabzon': 1101, 'Tunceli': 1151, 'Uşak': 468, 'Van': 1599, 'Yalova': 141, 'Yozgat': 634, 'Zonguldak': 303,
};
// Ortalama il fiyatı (Pendik çıkışlı, müşteri İstanbul'da):
//   4 nokta: Pendik → İstanbul'daki yükleme (≈ Pendik) → il merkezi → Pendik
//   toplam km = 2 × (Pendik → il merkezi)
//   fiyat = şehir içi taban (oda) + toplam km × km ücreti
//           + ev tipine göre km farkı (km tutarı × ev tipi %)
//           + bir uzun yol kademesi aşılırsa (aşılan EN YÜKSEK kademe):
//             Trakya illerinde Boğaz köprüsü (gidiş + dönüş), kademenin sabit eki,
//             kademenin yüzdesi (TOPLAMIN üzerine)
//   → 1.000 ₺'ye yukarı yuvarlanır (ortalama fiyat)
// Ek hizmetler (toplama, merdiven, dış cephe, yürüme) bu fiyata DAHİL DEĞİLDİR;
// görüşmede eskisi gibi ayrıca eklenir.
const TT_TRAKYA_ILLERI = ['Edirne', 'Kırklareli', 'Tekirdağ'];
const ttIlFiyatiKmIle = (taban, km, il, M, odaK = '') => {
  let f = taban + km * (Number(M.kmUcreti) || 0);
  // YENİ: ev tipine göre km farkı
  const odaFarki = odaK ? mesafeOdaFarkiKalemi(M, { toplamKm: km }, odaK) : null;
  if (odaFarki) f += odaFarki.tutar;
  const kademe = mesafeAktifKademe(M, km); // aşılan en yüksek uzun yol kademesi
  if (kademe) {
    if (TT_TRAKYA_ILLERI.includes(il)) f += 2 * (Number(M.gecis?.kopruFsm) || 0);
    f += Number(kademe.ek) || 0;
    f += Math.round(f * (Number(kademe.yuzde) || 0) / 100); // DEĞİŞTİ: yüzde TOPLAMIN üzerine
  }
  return Math.ceil(f / 1000) * 1000;
};
// Verilen fiyat tablosundan (taslak) yeni ilEve / ilDepo tablolarını üretir.
// Sütunlar: 1+1, 2+1, 3+1, 4+1 (1+0 için 1+1 sütunu kullanılır — eskisi gibi)
const ttIlTablolariniKmIleHesapla = (veri) => {
  const M = { ...MESAFE_VARSAYILAN, ...(veri.mesafe || {}), gecis: { ...MESAFE_VARSAYILAN.gecis, ...(veri.mesafe?.gecis || {}) }, kademeler: mesafeKademeListesi(veri.mesafe),
    odaKademeleri: mesafeOdaKademeListesi(veri.mesafe) }; // DEĞİŞTİ: ev tipi kademeleri
  const uret = (sehirIci, eskiTablo) => {
    const out = {};
    Object.keys(eskiTablo || {}).forEach(il => {
      const km = TT_PENDIK_IL_KM[il];
      if (!km) { out[il] = [...eskiTablo[il]]; return; } // tabloda km yoksa eski fiyat korunur
      out[il] = ['1+1', '2+1', '3+1', '4+1'].map(o => ttIlFiyatiKmIle(Number(sehirIci?.taban?.[o]) || 0, 2 * km, il, M, o));
    });
    return out;
  };
  return { ilEve: uret(veri.sehirIciEve, veri.ilEve), ilDepo: uret(veri.sehirIciDepo, veri.ilDepo) };
};
const ttFiyatTablolari = () => ({
  genel: TT_FIYAT_GENEL,
  sehirIciEve: FL_SEHIR_ICI_EVE, sehirIciDepo: FL_SEHIR_ICI_DEPO,
  sehirlerArasiEkEve: FL_SEHIRLER_ARASI_EK, sehirlerArasiEkDepo: FL_SEHIRLER_ARASI_EK_DEPO,
  ilEve: FL_IL_EVDEN_EVE, ilDepo: FL_IL_EVDEN_DEPOYA, depoKira: TT_DEPO_KIRA,
  mesafe: TT_MESAFE, // YENİ
});
// PDF fiyatlarının kopyası — "Varsayılana Dön" için
const TT_FIYAT_VARSAYILAN = JSON.parse(JSON.stringify(ttFiyatTablolari()));
let ttFiyatSurumu = 0;    // Fiyat her güncellendiğinde artar → hesap panelleri yeniden hesaplar
const ttDerinUygula = (hedef, kaynak) => {
  Object.keys(kaynak || {}).forEach(k => {
    const v = kaynak[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && hedef[k] && typeof hedef[k] === 'object' && !Array.isArray(hedef[k])) ttDerinUygula(hedef[k], v);
    else if (v !== null && v !== undefined && v !== '') hedef[k] = v;
  });
};
const ttFiyatlariUygula = (veri) => {
  const t = ttFiyatTablolari();
  Object.keys(t).forEach(k => { if (veri && veri[k]) ttDerinUygula(t[k], veri[k]); });
  // YENİ: kademe listesi olmayan eski kayıt → tek eşik (esikKm/iscilikYuzde/uzunYolEk) 1. kademe olur
  if (veri?.mesafe && !Array.isArray(veri.mesafe.kademeler)) TT_MESAFE.kademeler = JSON.parse(JSON.stringify(mesafeKademeListesi(veri.mesafe)));
  // YENİ: ev tipi kademeleri — eski tek satırlık "odaFarki" kaydı 1. kademe olur
  if (veri?.mesafe && !Array.isArray(veri.mesafe.odaKademeleri)) TT_MESAFE.odaKademeleri = JSON.parse(JSON.stringify(mesafeOdaKademeListesi(veri.mesafe)));
  ttFiyatSurumu += 1;
};
const ttFiyatBelge = () => doc(db, 'artifacts', appId, 'public', 'data', 'ayarlar', 'fiyatTablosu');
// Şubeye göre aylık depo kirası (+KDV); şube yoksa / farketmezse Genel liste
const ttDepoAylik = (sube, boyut) => (TT_DEPO_KIRA[sube] && TT_DEPO_KIRA[sube][boyut])
  || (TT_DEPO_KIRA.Genel && TT_DEPO_KIRA.Genel[boyut]) || TT_DEPO_BOYUTLARI.find(b => b.id === boyut)?.aylik || null;
// DEĞİŞTİ (kullanıcı talebi): fiyatlar artık YALNIZCA sunucu üzerinden yazılır
// (/api/fiyatlar — kullanıcı doğrulama + versiyon + fiyat_gecmisi). Tarayıcı bu
// belgeye doğrudan yazamaz (firestore.rules).
const TT_FIYAT_API = '/api/fiyatlar';
const ttFiyatGecmisKoleksiyon = () => collection(db, 'artifacts', appId, 'public', 'data', 'fiyat_gecmisi');
// Canlı fiyat dinleyicisi — Müşteri Havuzu'nda bir kez çalışır.
// "veri": Firestore belgesinin fiyat kısmı, OLDUĞU GİBİ. Fiyat Tablosu penceresi
// bunu gösterir; /api/fiyatlar da aynı belgeyi döndürür → ekran = API.
const useFiyatTablosu = (aktif = true) => {
  const [bilgi, setBilgi] = useState({ surum: 0, guncelleyen: '', tarih: '', versiyon: 0, veri: null });
  useEffect(() => {
    if (!aktif) return undefined;
    const unsub = onSnapshot(ttFiyatBelge(), snap => {
      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        const v = snap.data();
        ttFiyatlariUygula(v);
        const veri = {};
        FIYAT_VERI_ANAHTARLARI.forEach(k => { if (v[k] !== undefined) veri[k] = v[k]; });
        setBilgi({ surum: ttFiyatSurumu, guncelleyen: v.guncelleyen || '', tarih: v.guncellendi || v.guncellemeTarihi || '', versiyon: Number(v.versiyon) || 1, veri });
      }
    }, err => console.error('Fiyat tablosu okunamadı:', err));
    return () => unsub();
  }, [aktif]);
  return bilgi;
};

// ============================================================================
// (2) YARDIMCI FONKSİYONLAR
// ============================================================================
const ttBugunStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ttGunEkle = (tarihStr, gun) => {
  const [y, m, g] = (tarihStr || ttBugunStr()).split('-').map(Number);
  const d = new Date(y, m - 1, g + gun);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ttTrTarih = (s) => (s && String(s).includes('-') ? String(s).slice(0, 10).split('-').reverse().join('.') : (s || ''));
const ttTl = (n) => (n || n === 0) && n !== '' ? `${Math.round(Number(n)).toLocaleString('tr-TR')} ₺` : '—';

// Serbest fiyat metnini sayıya çevirir: "32.000 ₺" → 32000, "27-32.000" → 32000
const ttFiyatSayi = (metin) => {
  if (metin === null || metin === undefined || metin === '') return 0;
  const parcalar = String(metin).split('-').map(p => Number(p.replace(/[^\d]/g, '')) || 0);
  const enBuyuk = Math.max(...parcalar);
  return parcalar.map(p => (p > 0 && p < 1000 && enBuyuk >= 1000 ? p * 1000 : p)).reduce((a, b) => Math.max(a, b), 0);
};

// ----------------------------------------------------------------------------
// TELEFON ANAHTARI — eşleştirmenin kalbi (kullanıcı talebi)
// "0532 123 45 67", "05321234567", "5321234567", "+90 532 123 4567",
// "0090532..." biçimlerinin HEPSİ aynı 10 haneli anahtara dönüşür → "5321234567".
// ----------------------------------------------------------------------------
const ttTelAnahtar = (v) => {
  let r = (v || '').toString().replace(/\D/g, '');           // Boşluk, tire, parantez, + temizlenir
  if (r.startsWith('0090')) r = r.slice(4);                  // 0090 ülke kodu
  if (r.length === 12 && r.startsWith('90')) r = r.slice(2); // 90 ülke kodu
  if (r.length === 11 && r.startsWith('0')) r = r.slice(1);  // Baştaki 0
  return r.length >= 10 ? r.slice(-10) : '';
};
const ttTelGecerli = (v) => ttTelAnahtar(v).length === 10;
const ttWaNumara = (v) => { const a = ttTelAnahtar(v); return a ? `90${a}` : ''; };
// Ekranda okunaklı biçim: 0532 123 45 67
const ttTelGoster = (v) => { const a = ttTelAnahtar(v); return a ? `0${a.slice(0, 3)} ${a.slice(3, 6)} ${a.slice(6, 8)} ${a.slice(8)}` : (v || ''); };

// "3 yıl önce", "2 ay önce", "5 gün sonra" gibi göreli süre
const ttGoreliSure = (tarih) => {
  if (!tarih) return '';
  const t = new Date(String(tarih).length <= 10 ? `${tarih}T12:00:00` : tarih);
  if (isNaN(t)) return '';
  const gun = Math.round((Date.now() - t.getTime()) / 86400000);
  const ek = gun >= 0 ? 'önce' : 'sonra';
  const g = Math.abs(gun);
  if (g === 0) return 'bugün';
  if (g < 31) return `${g} gün ${ek}`;
  if (g < 365) return `${Math.round(g / 30)} ay ${ek}`;
  const yil = Math.floor(g / 365); const ay = Math.round((g % 365) / 30);
  return `${yil} yıl${ay ? ` ${ay} ay` : ''} ${ek}`;
};

// Takip (tekrar arama) durumu → 'yok' | 'gecikti' | 'bugun' | 'ileride' | 'kapali'
const ttTakipDurumu = (t) => {
  if (TT_KAPALI_DURUMLAR.includes(t.durum)) return 'kapali';
  if (!t.takipTarihi) return 'yok';
  const b = ttBugunStr();
  if (t.takipTarihi < b) return 'gecikti';
  if (t.takipTarihi === b) return 'bugun';
  return 'ileride';
};

// YENİ (kullanıcı talebi): görüşmenin kaynağı — havuzdan mı geldi, elle mi girildi?
const TT_KAYNAKLAR = [
  // DEĞİŞTİ (kullanıcı talebi): "Manuel Görüşmeler" → "Telefon Görüşmeleri"
  // DEĞİŞTİ (kullanıcı talebi): rozet "MANUEL" → "GELEN ARAMALAR"; Telefon Görüşmesi yeşili, beyaz yazı
  { id: 'manuel', ad: 'Telefon Görüşmeleri',      rozet: 'GELEN ARAMALAR', stil: 'bg-emerald-600 text-white', pasif: 'bg-white text-emerald-700 border-emerald-200' },
  // DEĞİŞTİ (kullanıcı talebi): "Hızlı Teklif Görüşmeleri" → "Hızlı Teklif Havuzu"
  { id: 'havuz',  ad: 'Hızlı Teklif Havuzu',      rozet: 'HIZLI TEKLİF', stil: 'bg-orange-500 text-white',   pasif: 'bg-white text-orange-700 border-orange-200' },
];
const ttKaynakTuru = (t) => (t.havuzKayitId ? 'havuz' : 'manuel');
const ttKaynakBul = (t) => TT_KAYNAKLAR.find(k => k.id === ttKaynakTuru(t));
// Kaydın sahibi (görünürlük ve transfer için): atanan yoksa oluşturan
const ttSahibi = (t) => t.atanan || t.olusturan || '';
// YENİ (kullanıcı talebi): Telefon Görüşmesi'nde BAŞKASININ ekranını yalnızca MÜDÜR
// rütbesi (ve Firma Sahibi / Sistem Yöneticisi) görebilir. Düzenleme yetkisi olan
// ama müdür olmayan personel de yalnızca KENDİ görüşmelerini görür.
const ttMudurMu = (u) => u?.rank === 'Müdür' || (u?.position || '').includes('Firma Sahibi') || u?.fullName === 'Sistem Yöneticisi';
const ttSiteOf = (hizmetTipi) => ttHizmetBul(hizmetTipi).site;

// ----------------------------------------------------------------------------
// ESKİ KAYIT UYUMU — ilk sürümde (tek form) girilen kayıtlar yeni alanlara
// çevrilir. Veritabanına yazılmaz; yalnızca ekranda ve hesapta kullanılır.
// ----------------------------------------------------------------------------
const ttNormalize = (t) => {
  if (!t || t.surum === 2) return t;
  const kat = (v) => (/^\d+$/.test(v || '') ? `${v}. Kat` : (v === 'Giriş' ? 'Giriş Kat' : (v || '')));
  const tasima = (v) => (v === 'Yok' ? 'Merdiven' : v === 'Var' || v === 'Yük Asansörü Var' ? 'Bina Asansörü' : (v || ''));
  const mesafe = (v) => (v === '50 metre' ? '50' : v === '100 metre' ? '100' : '0');
  // Eski formda ilçe serbest metindi; il listesinde birebir varsa ilçe alanına taşınır
  const ilceBul = (il, metin) => ttIlceler(il).find(x => x.toLocaleLowerCase('tr-TR') === String(metin || '').trim().toLocaleLowerCase('tr-TR')) || '';
  const yeni = {
    ...t,
    yukIl: t.yukIl || t.neredenIl || 'İstanbul (Anadolu)', yukIlce: t.yukIlce || ilceBul(t.neredenIl, t.neredenAdres), yukAdres: t.yukAdres || t.neredenAdres || '',
    bosIl: t.bosIl || t.nereyeIl || 'İstanbul (Anadolu)', bosIlce: t.bosIlce || ilceBul(t.nereyeIl, t.nereyeAdres), bosAdres: t.bosAdres || t.nereyeAdres || '',
    toplama: t.toplama || (t.paketleme === 'Biz Yapacağız' ? 'Firma' : t.paketleme === 'Müşteri Yapacak' ? 'Müşteri' : ''),
    depoBoyutu: t.depoBoyutu || (t.depoTipi === 'ozel' ? 'Özel' : (t.depoTipi || '')),
    nakliyeIstiyor: t.nakliyeIstiyor || (t.tasimaSekli === 'Kendi Nakliyesi' ? 'Kendisi' : t.hizmetTipi === 'Depo' ? 'Firma' : ''),
  };
  // Eski formda kat/asansör tek alandı; hangi adrese ait olduğu hizmete göre belirlenir
  if (t.hizmetTipi === 'Depodan Çıkış') { yeni.bosKat = t.bosKat || kat(t.daireKat); yeni.bosTasima = t.bosTasima || tasima(t.asansor); yeni.bosMesafe = t.bosMesafe || mesafe(t.yurumeMesafesi); }
  else { yeni.yukKat = t.yukKat || kat(t.daireKat); yeni.yukTasima = t.yukTasima || tasima(t.asansor); yeni.yukMesafe = t.yukMesafe || mesafe(t.yurumeMesafesi); }
  return yeni;
};

// Kat metnini sayıya çevirir: "3. Kat" → 3, "Giriş Kat"/"Bodrum Kat" → 0, "Müstakil / Villa" → 1
const ttKatNo = (kat) => {
  if (!kat) return 0;
  if (String(kat).startsWith('Müstakil')) return 1;
  const n = parseInt(kat, 10);
  return Number.isFinite(n) ? n : 0;
};
const ttIstanbulMu = (il) => (il || '').startsWith('İstanbul');
const ttYaka = (il) => ((il || '').includes('Avrupa') ? 'Avrupa' : 'Anadolu');
// YENİ (kullanıcı talebi): adres Avrupa Yakası mı? İl "İstanbul (Avrupa)" ise ya da
// İstanbul seçili olup ilçe Avrupa yakası ilçelerinden biriyse (ör. Bağcılar) → evet.
const ttAvrupaMi = (il, ilce) => (il || '').includes('Avrupa')
  || (ttIstanbulMu(il) && !!ilce && (TURKEY_LOCATIONS['İstanbul (Avrupa)'] || []).includes(ilce));
// Fiyatı etkileyen TÜM adreslerde (depo şubesi dahil) Avrupa Yakası var mı?
//  Nakliye: yükleme + boşaltma · Depo: eşyaların alınacağı adres + seçilen şube
//  Depodan Çıkış: çıkış şubesi + teslim adresi
const ttAvrupaAdresVarMi = (f) => {
  const sube = DEPO_LOCATIONS.find(d => d.name === f.sube);
  const adresler = f.hizmetTipi === 'Nakliye' ? [[f.yukIl, f.yukIlce], [f.bosIl, f.bosIlce]]
    : f.hizmetTipi === 'Depo' ? [[f.yukIl, f.yukIlce], sube ? [sube.province, sube.district] : null]
    : [[f.bosIl, f.bosIlce], sube ? [sube.province, sube.district] : null];
  return adresler.filter(Boolean).some(([il, ilce]) => ttAvrupaMi(il, ilce));
};
// Avrupa Yakası ekstra kalemini ekler (4+1 ve üzeri için 3+1 tutarı kullanılır)
const ttAvrupaEkstraEkle = (L, odaK, kalemler, uyarilar) => {
  kalemler.push({ ad: 'Avrupa Yakası ekstra', tutar: L.avrupaEkstra[odaK] ?? L.avrupaEkstra['3+1'] });
  if (!L.avrupaEkstra[odaK]) uyarilar.push('Listede 4+1 Avrupa ekstrası yok; 3+1 tutarı eklendi.');
};
// Daire tipinden fiyat tablosu anahtarı: Villa → 4+1, Parça Eşya → 1+0, Ofis → 3+1 (+uyarı)
const ttOdaAnahtari = (oda) => (['1+0', '1+1', '2+1', '3+1', '4+1'].includes(oda) ? oda
  : oda === 'Villa' ? '4+1' : oda === 'Parça Eşya' ? '1+0' : oda === 'Ofis' ? '3+1' : '');
// İl tablosu sütunu: [1+1, 2+1, 3+1, 4+1]; 1+0 için 1+1 sütunu kullanılır
const TT_IL_SUTUN = { '1+0': 0, '1+1': 0, '2+1': 1, '3+1': 2, '4+1': 3 };

// Ekiplerimizin çalışacağı adresler (fiyatı etkileyen adresler)
//  Nakliye → yükleme + boşaltma · Depo (firma alırsa) → yükleme · Depodan Çıkış → boşaltma
const ttIsAdresleri = (f) => {
  const yuk = { rol: 'Yükleme', il: f.yukIl, ilce: f.yukIlce, kat: f.yukKat, tasima: f.yukTasima, mesafe: f.yukMesafe };
  const bos = { rol: 'Boşaltma', il: f.bosIl, ilce: f.bosIlce, kat: f.bosKat, tasima: f.bosTasima, mesafe: f.bosMesafe };
  if (f.hizmetTipi === 'Nakliye') return [yuk, bos];
  if (f.hizmetTipi === 'Depo') return f.nakliyeIstiyor === 'Firma' ? [yuk] : [];
  return [bos];
};

// ============================================================================
// SİSTEM FİYATI HESAPLAMA — tek bir sayı üretir (kullanıcı talebi: aralık değil)
// ----------------------------------------------------------------------------
// Formül (fiyat şeması): Taban + Toplama (istenirse) + Merdiven (asansör yoksa,
// adres başına) + Dış cephe asansörü (adres başına) + Avrupa Yakası ekstra
// (şehir içi, bir kez) + Yürüme mesafesi (araç yanaşamazsa, adres başına).
// Şehirler arası: 81 il tablosu + şehirler arası ekler.
// Depo: aylık ücret × ödenecek ay (kampanya) + KDV ayrıca gösterilir.
// ============================================================================
// ============================================================================
// YENİ (kullanıcı talebi): KM BAZLI FİYAT — 4 NOKTA / 3 ETAP
// Mod açık ve rota hesaplanmışsa: km × km ücreti; toplam km eşiği (200) AŞARSA
// geçişler + sabit ek + işçilik farkı (%15 × taban + ek hizmetler). Rota yoksa
// eski hesap çalışır ve uyarı verilir. Dönen: { uygulandi, esikAsildi }
// ============================================================================
const ttMesafeUygula = (f, kalemler, uyarilar, odaK = '') => { // DEĞİŞTİ: odaK → ev tipine göre km farkı
  if (!mesafeModuAcik(TT_MESAFE)) return { uygulandi: false, esikAsildi: false };
  if (!(Number(f.rota?.toplamKm) > 0)) {
    uyarilar.push(f.rota?.hata ? `Km hesaplanamadı (${f.rota.hata}) — şimdilik eski liste fiyatı gösteriliyor.` : 'Km bazlı fiyat için yükleme ve boşaltma il/ilçesini seçin — km hesaplanınca fiyat güncellenir.');
    return { uygulandi: false, esikAsildi: false };
  }
  mesafeKalemleri(TT_MESAFE, f.rota).forEach(k => kalemler.push(k));
  // YENİ (kullanıcı talebi): ev tipine göre km farkı (büyük ev → daha çok araç / ekip / yakıt)
  const odaFarki = odaK ? mesafeOdaFarkiKalemi(TT_MESAFE, f.rota, odaK) : null;
  if (odaFarki) kalemler.push(odaFarki);
  return { uygulandi: true, esikAsildi: mesafeEsikAsildi(TT_MESAFE, f.rota.toplamKm) };
};
// Uzun yol farkı (kademe %) — TÜM kalemler eklendikten SONRA çağrılır (toplamın üzerine)
const ttMesafeIscilikEkle = (f, km, kalemler) => {
  if (!km.uygulandi) return;
  const k = mesafeIscilikKalemi(TT_MESAFE, f.rota, kalemler);
  if (k) kalemler.push(k);
};

const ttFiyatHesapla = (fHam) => {
  const f = ttNormalize(fHam || {});
  const kalemler = [];
  const uyarilar = [];
  const bilgiler = [];
  // Nakliyede ev tipi, depoda depo boyutu (kaç+1) fiyatın anahtarıdır; özel ölçü depo → 4+1 baz
  const odaK = ttOdaAnahtari(f.hizmetTipi === 'Nakliye' ? f.odaSayisi : (f.depoBoyutu === 'Özel' ? '4+1' : f.depoBoyutu));

  // ---- DEPO AYLIK ÜCRETİ (Depo ve Depodan Çıkış) ----
  let depo = null;
  if (f.hizmetTipi === 'Depo') {
    const b = TT_DEPO_BOYUTLARI.find(x => x.id === f.depoBoyutu);
    const k = TT_KIRALAMA.find(x => x.id === (f.kiralamaSuresi || '1')) || TT_KIRALAMA[0];
    // DEĞİŞTİ (kullanıcı talebi): aylık kira Fiyat Tablosu'ndaki ŞUBE fiyatından gelir
    const aylikKira = b ? ttDepoAylik(f.sube, b.id) : null;
    if (b && aylikKira) {
      const pesin = aylikKira * k.odenecekAy;
      depo = { boyut: b, kiralama: k, aylik: aylikKira, aylikKdvli: aylikKira * (1 + TT_KDV), pesin, pesinKdvli: pesin * (1 + TT_KDV), hediyeAy: k.toplamAy - k.odenecekAy };
      if (k.odenecekAy > 1) bilgiler.push('Kredi kartı YALNIZCA bu kampanyalı toplu ödemede geçerlidir; aylık ödemeler IBAN\'a yapılır.');
    } else if (f.depoBoyutu === 'Özel') uyarilar.push('Özel ölçü depo — video ile hacim belirlenip fiyat verilir.');
    if (f.esyaCinsi === 'İş Yeri Eşyası') uyarilar.push('İş yeri eşyası: teklif dosyası + KDV gerekir, bilgileri Mehmet Bey\'e aktarın. Her gün giriş-çıkış yapılacak ticari kullanıma depo verilmez.');
  }

  const adresler = ttIsAdresleri(f);
  // Müşteri kendi getiriyorsa nakliye yok
  if (f.hizmetTipi === 'Depo' && f.nakliyeIstiyor !== 'Firma') {
    if (f.nakliyeIstiyor === 'Kendisi') bilgiler.push('Kendisi getiriyor: nakliye 0 ₺. Çıkışta kalıcı ambalajın (pat pat) iadesi zorunludur — hatırlatın.');
    return { tur: 'depo', liste: 'Sadece depolama', kalemler, nakliyeToplam: 0, depo, uyarilar, bilgiler };
  }
  if (!odaK) {
    uyarilar.push(f.hizmetTipi === 'Nakliye' ? 'Fiyat için ev tipini (oda sayısı) seçin.' : 'Nakliye fiyatı için depo boyutunu (kaç+1) seçin.');
    return { tur: 'eksik', liste: '', kalemler, nakliyeToplam: 0, depo, uyarilar, bilgiler };
  }

  const depoListesi = f.hizmetTipi !== 'Nakliye';
  const sehirIci = adresler.every(a => ttIstanbulMu(a.il)) && (f.hizmetTipi !== 'Nakliye' || (ttIstanbulMu(f.yukIl) && ttIstanbulMu(f.bosIl)));

  if (sehirIci) {
    // ---------------- ŞEHİR İÇİ ----------------
    const L = depoListesi ? FL_SEHIR_ICI_DEPO : FL_SEHIR_ICI_EVE;
    const liste = depoListesi ? 'Şehir İçi Evden Depoya' : 'Şehir İçi Evden Eve';
    kalemler.push({ ad: `${odaK} nakliye taban fiyatı (Anadolu)`, tutar: L.taban[odaK] });
    // YENİ (kullanıcı talebi): km bazlı mod — km × ücret (eşik üstünde geçişler + ek)
    const km = ttMesafeUygula(f, kalemler, uyarilar, odaK);
    // Avrupa Yakası ekstra: adreslerden biri (depo şubesi dahil) Avrupa ise BİR kez eklenir
    // DEĞİŞTİ (kullanıcı talebi): il + ilçe + şube kontrolü (ttAvrupaAdresVarMi)
    // DEĞİŞTİ: km modunda eşik ÜSTÜNDE eklenmez (köprü ücretleri devreye girer)
    if (!km.esikAsildi && ttAvrupaAdresVarMi(f)) ttAvrupaEkstraEkle(L, odaK, kalemler, uyarilar);
    if (f.toplama === 'Firma') kalemler.push({ ad: `${odaK} toplama hizmeti`, tutar: L.toplama[odaK] });
    adresler.forEach(a => {
      const kat = ttKatNo(a.kat);
      if (a.tasima === 'Merdiven' && kat >= 3) {
        kalemler.push({ ad: `${a.rol}: ${kat}. kat merdiven taşıma`, tutar: ttMerdivenTutari(L.merdiven, kat) });
        if (kat > 7) uyarilar.push(`${a.rol} adresi ${kat}. kat ve asansörsüz — 7. kat tutarı alındı, dış cephe asansörü önerin.`);
      }
      if (a.tasima === 'Dış Cephe Asansörü') {
        const yaka = ttAvrupaMi(a.il, a.ilce) ? 'Avrupa' : 'Anadolu';
        kalemler.push({ ad: `${a.rol}: dış cephe asansörü (${ttDisCepheEtiket(yaka, kat)})`, tutar: ttDisCepheTutari(L.disCephe, yaka, kat) });
        if (kat > 13) uyarilar.push(`${a.rol}: liste 13. kata kadardır; ${kat}. kat için uygunluğu teyit edin.`);
      }
      if (L.yurume[a.mesafe]) kalemler.push({ ad: `${a.rol}: yürüme mesafesi (~${a.mesafe} m)`, tutar: L.yurume[a.mesafe] });
    });
    if (f.odaSayisi === 'Villa') uyarilar.push('5+1 / villa: 4+1 fiyatı baz alındı — video ile netleştirin.');
    if (f.odaSayisi === 'Ofis') uyarilar.push('Kurumsal ofis taşıma: teklif dosyası + KDV ister, Mehmet Bey\'e aktarın.');
    ttMesafeIscilikEkle(f, km, kalemler); // YENİ: eşik üstü işçilik farkı (%15)
    const toplam = kalemler.reduce((s, k) => s + (k.tutar || 0), 0);
    if (f.videoDurumu !== 'Alındı' && f.videoDurumu !== 'Keşif Yapıldı') uyarilar.push('Video/fotoğraf gelmeden fiyat kesinleşmez — mutlaka isteyin.');
    return { tur: 'sehirIci', liste, kalemler, nakliyeToplam: toplam, depo, uyarilar, bilgiler };
  }

  // ---------------- ŞEHİRLER ARASI ----------------
  const T = depoListesi ? FL_IL_EVDEN_DEPOYA : FL_IL_EVDEN_EVE;
  const liste = depoListesi ? 'Şehirler Arası Evden Depoya' : 'Şehirler Arası Evden Eve';
  const sutun = TT_IL_SUTUN[odaK];
  // Tablo Pendik çıkışlıdır: İstanbul dışındaki il(ler) baz alınır
  const disIller = [...new Set([f.hizmetTipi === 'Depodan Çıkış' ? null : f.yukIl, f.hizmetTipi === 'Depo' ? null : f.bosIl].filter(il => il && !ttIstanbulMu(il)))];
  const adaylar = disIller.map(il => ({ il, fiyat: T[il]?.[sutun] })).filter(x => x.fiyat);
  // YENİ (kullanıcı talebi): km bazlı mod — rota varsa 81 il tablosu KULLANILMAZ:
  // taban (oda, Anadolu listesi) + km × ücret (+ eşik üstü geçiş/ek/işçilik farkı)
  const kmKalem = []; const kmUyari = [];
  const km = ttMesafeUygula(f, kmKalem, kmUyari, odaK);
  kmUyari.forEach(u => uyarilar.push(u));
  if (km.uygulandi) {
    kalemler.push({ ad: `${odaK} nakliye taban fiyatı`, tutar: (depoListesi ? FL_SEHIR_ICI_DEPO : FL_SEHIR_ICI_EVE).taban[odaK] });
    kmKalem.forEach(k => kalemler.push(k));
    bilgiler.push('Km bazlı fiyat: ilçe merkezleri arası Google rotası (4 nokta / 3 etap) kullanıldı; 81 il tablosu devre dışı.');
    if (!km.esikAsildi && ttAvrupaAdresVarMi(f)) ttAvrupaEkstraEkle(depoListesi ? FL_SEHIR_ICI_DEPO : FL_SEHIR_ICI_EVE, odaK, kalemler, uyarilar);
  } else {
  if (adaylar.length === 0) {
    uyarilar.push(`${disIller.join(', ') || 'Seçilen il'} için listede fiyat bulunamadı.`);
    return { tur: 'eksik', liste, kalemler, nakliyeToplam: 0, depo, uyarilar, bilgiler };
  }
  const secilen = adaylar.sort((a, b) => b.fiyat - a.fiyat)[0];
  kalemler.push({ ad: `${secilen.il} · ${odaK === '1+0' ? '1+1 (1+0 için)' : odaK} nakliye`, tutar: secilen.fiyat });
  if (adaylar.length > 1) uyarilar.push(`İki adres de İstanbul dışında (${disIller.join(' → ')}); liste Pendik çıkışlıdır, uzak il baz alındı — Mehmet Bey'e danışın.`);
  // YENİ (kullanıcı talebi): şehirler arası işte de İstanbul tarafındaki adres Avrupa
  // Yakası ise (ya da depo şubesi Avrupa'daysa) Avrupa ekstrası eklenir
  if (ttAvrupaAdresVarMi(f)) ttAvrupaEkstraEkle(depoListesi ? FL_SEHIR_ICI_DEPO : FL_SEHIR_ICI_EVE, odaK, kalemler, uyarilar);
  }
  const E = depoListesi ? FL_SEHIRLER_ARASI_EK_DEPO : FL_SEHIRLER_ARASI_EK;   // DEĞİŞTİ: listeye özel ekler
  if (f.toplama === 'Firma') kalemler.push({ ad: `${odaK} toplama hizmeti`, tutar: E.toplama[odaK] });
  adresler.forEach(a => {
    const kat = ttKatNo(a.kat);
    if (a.tasima === 'Merdiven' && kat >= 3) {
      kalemler.push({ ad: `${a.rol}: ${kat}. kat merdiven`, tutar: ttMerdivenTutari(E.merdiven, kat) });
      if (kat > 7) uyarilar.push(`${a.rol} adresi ${kat}. kat ve asansörsüz — 7. kat tutarı alındı.`);
    }
    if (a.tasima === 'Dış Cephe Asansörü') {
      const yakaOrani = ttIstanbulMu(a.il) ? (ttAvrupaMi(a.il, a.ilce) ? 'Avrupa' : 'Anadolu') : 'Avrupa';
      kalemler.push({ ad: `${a.rol}: dış cephe asansörü${ttIstanbulMu(a.il) ? ` (${ttDisCepheEtiket(yakaOrani, kat)})` : ` (${a.il}${kat >= 10 ? ', 9-13 kat' : ''})`}`, tutar: ttDisCepheTutari(E.disCephe, yakaOrani, kat) });
      if (kat > 13) uyarilar.push(`${a.rol}: liste 13. kata kadardır; ${kat}. kat için uygunluğu teyit edin.`);
      if (!ttIstanbulMu(a.il)) uyarilar.push(`${a.il} için dış cephe asansörü yerelde kiralanır; tutarı teyit edin.`);
    }
    if (E.yurume[a.mesafe]) kalemler.push({ ad: `${a.rol}: yürüme mesafesi (~${a.mesafe} m)`, tutar: E.yurume[a.mesafe] });
  });
  if (f.odaSayisi === 'Villa') uyarilar.push('5+1 / villa: 4+1 fiyatı baz alındı — video ile netleştirin.');
  if (f.odaSayisi === 'Ofis') uyarilar.push('Kurumsal ofis taşıma: teklif dosyası + KDV ister, Mehmet Bey\'e aktarın.');
  bilgiler.push('Pendik çıkışlı ortalama bedel. %10 iskonto için Mehmet Bey\'e danışın. Eşya araca yüklendikten sonra %50 ödeme alınır.');
  if (f.videoDurumu !== 'Alındı' && f.videoDurumu !== 'Keşif Yapıldı') uyarilar.push('Video/fotoğraf gelmeden fiyat kesinleşmez — mutlaka isteyin.');
  ttMesafeIscilikEkle(f, km, kalemler); // YENİ: eşik üstü işçilik farkı (%15)
  const toplam = kalemler.reduce((s, k) => s + (k.tutar || 0), 0);
  return { tur: 'sehirlerArasi', liste, kalemler, nakliyeToplam: toplam, depo, uyarilar, bilgiler };
};

// ============================================================================
// YENİ (kullanıcı talebi): FİYAT ARALIĞI — TABAN + AÇILIŞ (%25 FAZLASI)
// Sistemin hesapladığı fiyat TABAN fiyattır (inilebilecek en alt fiyat).
// Satışçı müşteriye AÇILIŞ fiyatıyla (taban + %25) başlar; pazarlıkta
// tabana kadar iskonto yapabilir. Tutarlar 500 ₺'ye yuvarlanır.
// ============================================================================
// DEĞİŞTİ (kullanıcı talebi): oran sabit değil — Fiyat Tablosu'ndaki ayardan okunur
const ttAcilisYuzde = (hizmetTipi = 'Nakliye') => {
  const v = Number(hizmetTipi === 'Nakliye' ? TT_FIYAT_GENEL.acilisOraniEve : TT_FIYAT_GENEL.acilisOraniDepo);
  return Number.isFinite(v) && v >= 0 ? v : 25;
};
const ttYuvarla500 = (n) => Math.round((Number(n) || 0) / 500) * 500;
const ttAcilisFiyati = (taban, hizmetTipi = 'Nakliye') => (taban ? Math.ceil((taban * (1 + ttAcilisYuzde(hizmetTipi) / 100)) / 500) * 500 : 0);
// Açılış fiyatından iskonto kademeleri (tabanın altına inmez)
const ttIskontoKademeleri = (taban, hizmetTipi = 'Nakliye') => {
  if (!taban) return [];
  const acilis = ttAcilisFiyati(taban, hizmetTipi);
  return [
    { ad: 'Açılış fiyatı', not: `+%${ttAcilisYuzde(hizmetTipi)}`, tutar: acilis },
    ...[5, 10, 15].map(y => ({ ad: `%${y} iskonto`, not: 'açılıştan', tutar: Math.max(taban, ttYuvarla500(acilis * (1 - y / 100))) })),
    { ad: 'Taban fiyat', not: 'en son', tutar: taban },
  ]
    // Tabana eşit iskonto kademesi gösterilmez (o tutar "Taban fiyat" olarak kalır), mükerrerler ayıklanır
    .filter(k => k.ad === 'Taban fiyat' || k.tutar > taban || k.ad === 'Açılış fiyatı')
    .filter((k, i, a) => a.findIndex(x => x.tutar === k.tutar) === i);
};

// YENİ (kullanıcı talebi): merdiven 7. kata kadar (üstü 7. kat tutarı + uyarı)
const ttMerdivenTutari = (tablo, kat) => tablo[Math.min(kat, 7)] ?? tablo[5];
// YENİ (kullanıcı talebi): dış cephe asansörü 2-9 kat / 10-13 kat kademesi
const ttDisCepheTutari = (tablo, yaka, kat) => (kat >= 10 ? (tablo[`${yaka}913`] ?? tablo[yaka]) : tablo[yaka]);
const ttDisCepheEtiket = (yaka, kat) => `${yaka}${kat >= 10 ? ', 9-13 kat' : ''}`;

// Adres kısa metni: İstanbul'da yalnızca ilçe ("Pendik"), diğer illerde "Çankaya, Ankara"
const ttAdresKisa = (il, ilce) => (ilce ? (ttIstanbulMu(il) ? ilce : `${ilce}, ${il}`) : (il || ''));
// Kat + taşıma kısa metni: "3. Kat · Merdiven"
const ttKatTasima = (kat, tasima) => [kat, tasima].filter(Boolean).join(' · ');

// Güzergâh metni — liste ve mesajlarda kullanılır
const ttGuzergah = (tHam) => {
  const t = ttNormalize(tHam);
  if (t.hizmetTipi === 'Depo') return `${ttAdresKisa(t.yukIl, t.yukIlce) || '?'} → Depo${t.sube && t.sube !== 'Farketmez' ? ` (${t.sube.replace(' Depoevim', '')})` : ''}`;
  if (t.hizmetTipi === 'Depodan Çıkış') return `${t.sube && t.sube !== 'Farketmez' ? t.sube.replace(' Depoevim', '') + ' deposu' : 'Depomuz'} → ${ttAdresKisa(t.bosIl, t.bosIlce) || '?'}`;
  return `${ttAdresKisa(t.yukIl, t.yukIlce) || '?'} → ${ttAdresKisa(t.bosIl, t.bosIlce) || '?'}`;
};

// ============================================================================
// KAYIT EKRANINA AKTARIM — telefon teklifinden kayıt formu alanları üretir.
// App.jsx'teki havuzdanKayitAc({ ..., ekAlanlar }) bu alanları forma yazar;
// satışçıya yalnızca son fiyatı ve eksik detayları kontrol etmek kalır.
// ============================================================================
const ttKayitVerisi = (tHam) => {
  const t = ttNormalize(tHam);
  const firmaToplar = t.toplama === 'Firma';
  const oda = t.hizmetTipi === 'Nakliye' ? (t.odaSayisi || '1+1') : (t.depoBoyutu && t.depoBoyutu !== 'Özel' ? t.depoBoyutu : (t.odaSayisi || '2+1'));
  const fiyat = ttFiyatSayi(t.verilenFiyat) || t.sistemFiyati || '';
  const not = [`📞 Telefon teklifinden aktarıldı (${ttTrTarih(t.iletisimTarihi)} · ${ttSahibi(t) || '—'})`,
    t.videoDurumu ? `Video: ${t.videoDurumu}` : '', t.aciklama ? `Not: ${t.aciklama}` : ''].filter(Boolean).join('\n');
  const ortak = {
    customerName: t.musteriAdi || '', customerPhone: t.telefon || '',
    // Taşınma tarihi biliniyorsa yazılır; bilinmiyorsa kayıt ekranının varsayılanı kalır
    ...(t.tasinmaTarihi ? { date: t.tasinmaTarihi } : {}),
    price: fiyat ? String(fiyat) : '', notes: not,
    esyaDurumu: firmaToplar ? ['Toplama Yapılacaktır'] : [],
  };
  const yukAlan = {
    fromProvince: t.yukIl || 'İstanbul (Anadolu)', fromDistrict: t.yukIlce || '', fromAddress: t.yukAdres || '',
    fromFloor: t.yukKat || '1. Kat', fromTransportMethod: t.yukTasima || 'Merdiven', fromRoomCount: oda,
    fromDistance: t.yukMesafe && t.yukMesafe !== '0' ? t.yukMesafe : '', fromDistanceUnit: 'Metre',
    fromPacking: firmaToplar ? 'Toplama Yapılacak' : 'Kendisi Topladı',
  };
  const bosAlan = {
    toProvince: t.bosIl || 'İstanbul (Anadolu)', toDistrict: t.bosIlce || '', toAddress: t.bosAdres || '',
    toFloor: t.bosKat || '1. Kat', toTransportMethod: t.bosTasima || 'Merdiven', toRoomCount: oda,
    toDistance: t.bosMesafe && t.bosMesafe !== '0' ? t.bosMesafe : '', toDistanceUnit: 'Metre', toPacking: 'Kendisi Topladı',
  };
  // Seçilen şubenin adres/kat/taşıma bilgisi (kayıt ekranındaki handleDepoChange ile aynı kural)
  const depo = DEPO_LOCATIONS.find(d => d.name === t.sube);
  const depoAlani = (yon) => depo ? {
    [`${yon}Province`]: depo.province, [`${yon}District`]: depo.district, [`${yon}Address`]: depo.address,
    [`${yon}Floor`]: depo.floor || 'Giriş Kat', [`${yon}TransportMethod`]: depo.transportMethod || 'Merdiven',
    [`${yon}Packing`]: 'Kendisi Topladı', [`${yon}RoomCount`]: 'Depoevim Tesisleri', [`${yon}Distance`]: '0', [`${yon}DistanceUnit`]: 'Metre',
  } : {};
  if (t.hizmetTipi === 'Depo') {
    return { hizmetTipi: 'Depo', musteriAdi: t.musteriAdi, telefon: t.telefon,
      ekAlanlar: { ...ortak, ...yukAlan, depoDirection: 'toDepo', selectedDepo: depo ? depo.name : '', ...depoAlani('to') } };
  }
  if (t.hizmetTipi === 'Depodan Çıkış') {
    return { hizmetTipi: 'Depo', musteriAdi: t.musteriAdi, telefon: t.telefon,
      ekAlanlar: { ...ortak, ...bosAlan, depoDirection: 'fromDepo', selectedDepo: depo ? depo.name : '', ...depoAlani('from') } };
  }
  return { hizmetTipi: 'Nakliye', musteriAdi: t.musteriAdi, telefon: t.telefon, ekAlanlar: { ...ortak, ...yukAlan, ...bosAlan } };
};

// ============================================================================
// MÜŞTERİ GEÇMİŞİ İNDEKSİ (kullanıcı talebi)
// ----------------------------------------------------------------------------
// Telefon anahtarı → { isler, havuz, telefon }. İş kayıtları (jobs), havuz
// kayıtları ve telefon teklifleri BELLEKTEKİ listelerden indekslenir — ek
// Firestore okuması yapılmaz. Hem ana telefon hem yedek telefon indekslenir.
// ============================================================================
const musteriGecmisiIndeksle = (isler = [], havuz = [], teklifler = []) => {
  const m = new Map();
  const ekle = (anahtar, tur, kayit, tekilAnahtar) => {
    if (!anahtar) return;
    let g = m.get(anahtar);
    if (!g) { g = { isler: [], havuz: [], telefon: [], _tekil: new Set() }; m.set(anahtar, g); }
    const tk = `${tur}|${tekilAnahtar || kayit.id}`;
    if (g._tekil.has(tk)) return;           // Aynı iş (ör. 2. araç kopyası) bir kez sayılır
    g._tekil.add(tk); g[tur].push(kayit);
  };
  (isler || []).forEach(j => {
    if (parseInt(j.gunNo, 10) > 1) return;  // Çok günlü işin devam günleri sayılmaz
    const tekil = `${j.date || ''}|${j.type || ''}|${(j.customerName || '').trim().toLowerCase()}`;
    ekle(ttTelAnahtar(j.customerPhone), 'isler', j, tekil);
    if (j.altPhone) ekle(ttTelAnahtar(j.altPhone), 'isler', j, tekil);
  });
  (havuz || []).forEach(k => ekle(ttTelAnahtar(k.iletisim), 'havuz', k));
  (teklifler || []).forEach(t => ekle(ttTelAnahtar(t.telefon), 'telefon', t));
  return m;
};
// Bir numaranın geçmişi (haricId: kaydın kendisi listelenmesin)
const musteriGecmisiBul = (indeks, telefon, haricId = null) => {
  const a = ttTelAnahtar(telefon);
  const g = a && indeks ? indeks.get(a) : null;
  if (!g) return null;
  const tarihSirala = (alan) => (x, y) => String(y[alan] || '').localeCompare(String(x[alan] || ''));
  const s = {
    isler: g.isler.filter(x => x.id !== haricId).sort(tarihSirala('date')),
    havuz: g.havuz.filter(x => x.id !== haricId).sort(tarihSirala('createdAt')),
    telefon: g.telefon.filter(x => x.id !== haricId).sort(tarihSirala('iletisimTarihi')),
  };
  s.toplam = s.isler.length + s.havuz.length + s.telefon.length;
  return s.toplam ? s : null;
};
// İsimleri karşılaştırmak için sade anahtar (büyük/küçük harf ve Türkçe karakter farkı yok sayılır)
const ttAdAnahtar = (ad) => (ad || '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/\b(bey|hanım|hanim|hn|bay|bayan)\b/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
// İki isim "aynı kişi" sayılır mı? (ilk isimler eşleşiyorsa yeterli)
const ttAyniIsimMi = (a, b) => {
  const x = ttAdAnahtar(a), y = ttAdAnahtar(b);
  if (!x || !y) return true;               // Biri boşsa uyarı üretme
  return x === y || x.split(' ')[0] === y.split(' ')[0];
};

// ============================================================================
// SÜREÇ ADIMLARI — oryantasyon kılavuzlarındaki sıra (asla değişmez)
// ============================================================================
const TT_SUREC_NAKLIYE = [
  { id: 'video',      ad: 'Eşya videosu / fotoğrafı istendi' },
  { id: 'netFiyat',   ad: 'Video sonrası net fiyat verildi' },
  { id: 'kayit',      ad: 'Sembol CRM\'de kayıt açıldı (taşımadan 15 gün öncesine kadar)' },
  { id: 'kapora',     ad: '%20 kapora alındı — tarih kesinleşti' },
  { id: 'sozlesme',   ad: 'Sözleşme PDF olarak WhatsApp\'tan gönderildi' },
  { id: 'teslimKodu', ad: 'Teslim / güvenlik kodu anlatıldı' },
  { id: 'kurallar',   ad: '72 saat iptal kuralı ve yapılmayan hizmetler söylendi' },
  { id: 'teyit',      ad: 'Taşımadan 1 gün önce teyit araması yapıldı' },
];
const TT_SUREC_DEPO = [
  { id: 'video',      ad: 'Eşya videosu istendi (hacim + nakliye fiyatı için)' },
  { id: 'davet',      ad: 'Müşteri depoya ziyarete davet edildi' },
  { id: 'netFiyat',   ad: 'Net fiyat çalışması dönüldü' },
  { id: 'kayit',      ad: 'Depoevim CRM\'de nakliye kaydı açıldı' },
  { id: 'kapora',     ad: '%20 kapora alındı — alım tarihi kesinleşti' },
  { id: 'teyit',      ad: 'Alımdan 1 gün önce teyit araması yapıldı' },
  { id: 'sozlesme',   ad: 'Eşya depoya konduktan sonra sözleşme yapıldı (oda no + KDV dahil ücret)' },
  { id: 'kurallar',   ad: 'Aylık ödeme (5 gün, IBAN), mühür (200 ₺+KDV) ve 7 gün önce çıkış bildirimi anlatıldı' },
];
const ttSurecAdimlari = (t) => (t.hizmetTipi === 'Nakliye' ? TT_SUREC_NAKLIYE : TT_SUREC_DEPO);

// ============================================================================
// WHATSAPP HAZIR MESAJLARI (kullanıcı talebi)
// ----------------------------------------------------------------------------
// Görüşmede alınan cevaplarla OTOMATİK doldurulur. Metinler oryantasyon
// kılavuzlarındaki hazır cümlelerden türetildi. Satışçı göndermeden önce
// metni düzenleyebilir.
// ============================================================================
const ttWhatsappSablonlariHam = (tHam, gonderen = '') => {
  const t = ttNormalize(tHam);
  const ad = (t.musteriAdi || '').trim();
  const selam = ad ? `Merhaba ${ad},` : 'Merhabalar,';
  const ben = gonderen ? ` ben ${gonderen.split(' ')[0]}` : '';
  const hesap = ttFiyatHesapla(t);
  const fiyat = ttFiyatSayi(t.verilenFiyat) || ttAcilisFiyati(hesap.nakliyeToplam, t.hizmetTipi);   // DEĞİŞTİ: yoksa açılış fiyatı
  const tarih = t.tasinmaTarihi ? ttTrTarih(t.tasinmaTarihi) : (t.tasinmaNotu || '');
  const odaAd = TT_ODA_SECENEKLERI.find(o => o.id === t.odaSayisi)?.ad || t.odaSayisi;

  if (t.hizmetTipi === 'Nakliye') {
    const satirlar = [
      odaAd && `• Ev tipi: ${odaAd}`,
      `• Güzergâh: ${ttGuzergah(t)}`,
      (t.yukKat || t.yukTasima) && `• Mevcut ev: ${ttKatTasima(t.yukKat, t.yukTasima)}`,
      (t.bosKat || t.bosTasima) && `• Yeni ev: ${ttKatTasima(t.bosKat, t.bosTasima)}`,
      t.toplama && `• Küçük eşya toplama: ${t.toplama === 'Firma' ? 'Firmamız toplayacak' : 'Sizin tarafınızdan'}`,
      tarih && `• Taşınma: ${tarih}`,
    ].filter(Boolean).join('\n');
    return [
      { id: 'ozet', ad: 'Görüşme Özeti + Video İste',
        metin: `${selam} Sembol Nakliyat'tan${ben}. Görüşmemiz için teşekkür ederiz 🙏\n\n📋 Konuştuğumuz bilgiler:\n${satirlar}\n\n${fiyat ? `💰 Ortalama fiyatımız: ${ttTl(fiyat)} — sigortalı taşıma, profesyonel ekip ve söküm-montaj dahil.` : '💰 Fiyatımıza sigortalı taşıma, profesyonel ekip ve söküm-montaj dahildir.'}\n\n📹 Size net fiyat verebilmemiz için eşyalarınızın kısa bir videosunu veya fotoğraflarını bu numaraya gönderebilir misiniz? Video gelince hemen net fiyatı iletiyorum; taşıma günü fiyat değişmez.\n\nDilerseniz ofisimize de bekleriz. İyi günler dileriz.` },
      { id: 'video', ad: 'Video Hatırlatma',
        metin: `${selam} Sembol Nakliyat'tan${ben}. Taşımanız için en doğru fiyatı verebilmemiz adına eşya videonuzu bekliyoruz. Müsait olduğunuzda gönderirseniz hemen dönüş yaparım. İyi günler.` },
      { id: 'sorular', ad: '7 Soru (Keşif Mesajı)',
        metin: `Merhabalar, tüm detayları öğrenebilir miyiz?\n1. Eviniz kaç odalıdır?\n2. Nereden nereye nakliye olacaktır?\n3. Oturduğunuz ev ve yeni taşınacak ev kaçıncı kattadır?\n4. Bina içi asansör durumu nedir?\n5. Küçük eşyaları (kırılacak, kıyafet vb.) kendiniz mi toplayacaksınız?\n6. Kamyon iki adreste de binaya yanaşabiliyor mu?\n7. Ne zaman taşınmayı düşünüyorsunuz?\n\nOrtalama bir fiyat verebiliriz. Daha net fiyat için eşyanın fotoğraf ya da videosunu gönderirseniz seviniriz.` },
      // KALDIRILDI (kullanıcı talebi): "Yazılı Teklif" şablonu
      { id: 'kapora', ad: 'Kayıt & Kapora Bilgisi',
        metin: `${selam} Taşıma tarihinizi kesinleştirmek için iş bedelinin %20'si kapora olarak alınmaktadır; kalan tutar iş bitiminde ödenir. Kapora sonrası sözleşmeniz PDF olarak buradan gönderilecek; sözleşmedeki teslim kodunu teslimatta ekibimize iletmeniz yeterli. Taşımaya 72 saatten fazla varsa kapora hariç ücretsiz iptal/erteleme yapılabilir. Teşekkür ederiz.` },
    ];
  }

  // ---- DEPOEVİM (Depo / Depodan Çıkış) ----
  const b = TT_DEPO_BOYUTLARI.find(x => x.id === t.depoBoyutu);
  const sube = DEPO_LOCATIONS.find(d => d.name === t.sube);
  const bAylik = b ? ttDepoAylik(t.sube, b.id) : null;   // YENİ: şube bazlı kira
  const depoSatiri = b ? `📦 Depo: ${b.id} Depo${b.m3 ? ` (${b.m3} m³)` : ''}${bAylik ? ` — ${ttTl(bAylik)} + KDV / ay` : ''}` : '';
  const kiraSatiri = hesap.depo && hesap.depo.kiralama.odenecekAy > 1
    ? `🎁 ${hesap.depo.kiralama.ad}: ${ttTl(hesap.depo.pesin)} + KDV (${hesap.depo.kiralama.toplamAy} ay kullanım)` : '';
  const nakliyeSatiri = t.hizmetTipi === 'Depo'
    ? (t.nakliyeIstiyor === 'Firma' ? `🚚 Nakliye: ${ttAdresKisa(t.yukIl, t.yukIlce)}${t.yukKat ? `, ${ttKatTasima(t.yukKat, t.yukTasima)}` : ''} → Depo${fiyat ? ` · ${ttTl(fiyat)} (depo müşterisine özel fiyat)` : ' (nakliye fiyatı video sonrası netleşir)'}`
      : '🚚 Eşyalarınızı depoya kendiniz getireceksiniz.')
    : `🚚 Teslim: ${ttGuzergah(t)}${t.bosKat ? `, ${ttKatTasima(t.bosKat, t.bosTasima)}` : ''}${fiyat ? ` · ${ttTl(fiyat)}` : ''}`;
  const ozetSatirlari = [depoSatiri, kiraSatiri, t.sube && t.sube !== 'Farketmez' ? `🏢 Şube: ${t.sube}` : '', nakliyeSatiri, tarih ? `📅 Tarih: ${tarih}` : ''].filter(Boolean).join('\n');

  if (t.hizmetTipi === 'Depodan Çıkış') {
    return [
      { id: 'ozet', ad: 'Çıkış Teklifi',
        metin: `${selam} DepoEvim'den${ben}. Eşyalarınızın depodan teslimi için konuştuğumuz bilgiler:\n\n${ozetSatirlari}\n\nÇıkış günü planlaması için en az 7 gün önceden haber vermeniz yeterlidir. Depo ücreti veya birikmiş ödeme varsa teslimden önce kapatılması gerekir. Sorularınız için buradayız.` },
      { id: 'kapora', ad: 'Kapora & Tarih',
        metin: `${selam} Teslim tarihinizi kesinleştirmek için iş bedelinin %20'si kapora olarak alınmaktadır; kalan tutar teslimde ödenir. Tarih kesinleşince ekibimiz planlamayı yapacaktır. Teşekkür ederiz.` },
    ];
  }
  return [
    { id: 'ozet', ad: 'Görüşme Özeti + Video İste',
      metin: `${selam} DepoEvim'den${ben}. Görüşmemiz için teşekkür ederiz 🙏\n\n${ozetSatirlari}\n\nDepolarımız yüksek katta, rutubetsiz ve 7/24 kameralıdır; her odanın kapısı size özel mühürlenir, eşyalarınız sigortalıdır. Taahhüt zorunluluğu yoktur.\n\n📹 Hangi depomuza sığacağını ve nakliye fiyatını netleştirmek için eşyalarınızın videosunu gönderebilir misiniz? Hemen fiyat çalışması dönerim. Dilerseniz depolarımızı gelip görebilirsiniz.` },
    { id: 'video', ad: 'Video Hatırlatma',
      metin: `${selam} DepoEvim'den${ben}. Hem hangi depomuza sığacağını netleştirmek hem nakliye fiyatınızı kesinleştirmek için eşya videonuzu bekliyoruz. Müsait olduğunuzda gönderirseniz hemen fiyat çalışması dönerim. İyi günler.` },
    { id: 'kampanya', ad: 'Uzun Dönem Kampanya',
      metin: `${selam} Uzun süreli depolamada kampanyamızı hatırlatmak isterim:\n🎁 5 ay öde → 1 ay hediye (6 ay)\n🎁 10 ay öde → 2 ay hediye (12 ay)\n${bAylik ? `\nSizin deponuz için: 6 ay ${ttTl(bAylik * 5)} + KDV · 12 ay ${ttTl(bAylik * 10)} + KDV\n` : ''}\nKredi kartı yalnızca bu toplu ödemelerde geçerlidir; aylık ödemeler IBAN'a yapılır. Taahhüt zorunluluğu yoktur.` },
    { id: 'davet', ad: 'Depo Ziyaret Daveti',
      metin: `${selam} Depolarımızı dilediğiniz zaman gelip görebilirsiniz${sube ? `:\n📍 ${sube.name} — ${sube.address}, ${sube.district}` : '.'}\nZiyaret için 1-2 gün önceden randevu almanız yeterli. Instagram ve YouTube'daki müşteri memnuniyet videolarımızı da izleyebilirsiniz.` },
    { id: 'kapora', ad: 'Kayıt & Kapora Bilgisi',
      metin: `${selam} Alım tarihinizi kesinleştirmek için nakliye bedelinin %20'si kapora olarak alınmaktadır. Depo sözleşmeniz eşyalarınız depoya konduktan sonra yapılır ve oda numaranız paylaşılır. Aylık ücret giriş tarihinden itibaren en geç 5 gün içinde IBAN'a yatırılır. Çıkıştan en az 7 gün önce bilgi vermeniz yeterlidir. Teşekkür ederiz.` },
  ];
};

// ============================================================================
// YENİ (kullanıcı talebi): MESAJ İMZASI — MÜŞTERİ TEMSİLCİSİ
// ----------------------------------------------------------------------------
// Tüm hazır mesajların altına görüşmeyi yapan personelin ADI SOYADI
// "Müşteri Temsilciniz" unvanıyla ve hizmete göre firma adıyla eklenir;
// müşteri kiminle konuştuğunu bilir. Şablon metinleri (ttWhatsappSablonlariHam)
// hiç değişmedi, imza yalnızca sonlarına eklenir.
// ============================================================================
const ttMesajImzasi = (hizmetTipi, gonderen) => {
  const ad = (gonderen || '').trim();
  if (!ad || ad === 'Sistem') return '';
  const firma = hizmetTipi === 'Nakliye' ? 'Sembol Nakliyat' : 'DepoEvim';
  return `\n\n—\n👤 Müşteri Temsilciniz: ${ad}\n${firma}`;
};
const ttWhatsappSablonlari = (tHam, gonderen = '') => {
  const imza = ttMesajImzasi((tHam || {}).hizmetTipi || 'Nakliye', gonderen);
  return ttWhatsappSablonlariHam(tHam, gonderen).map(sb => ({ ...sb, metin: sb.metin + imza }));
};

// ============================================================================
// (3) ORTAK BİLEŞENLER
// ============================================================================

// Büyük seçim kartı — sihirbazdaki tek tıklık cevaplar için
const TTSecimKarti = ({ secili, onClick, baslik, alt, stil, Ikon = null }) => (
  <button type="button" onClick={onClick}
    className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition flex items-center gap-3 ${secili ? stil.secili : `${stil.pasif} text-neutral-800`}`}>
    {/* Radyo göstergesi (web sihirbazındaki gibi) */}
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${secili ? 'border-white bg-white/20' : 'border-neutral-300 bg-white'}`}>
      {secili && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
    </span>
    {Ikon && <Ikon className="w-5 h-5 shrink-0" />}
    <span className="min-w-0">
      <span className="block text-sm font-black leading-tight">{baslik}</span>
      {alt && <span className={`block text-[11px] font-bold mt-0.5 ${secili ? 'text-white/80' : 'text-neutral-500'}`}>{alt}</span>}
    </span>
  </button>
);

// İl + ilçe seçici — iller önceliklidir (İstanbul, Kocaeli, Bursa, İzmir, Ankara)
// ############################################################################
// YENİ (kullanıcı talebi): KM HESABI — 4 NOKTA / 3 ETAP (İLÇE MERKEZLERİ)
// ----------------------------------------------------------------------------
// Adres ELLE girilmez: il / ilçe seçimi eskisi gibi kalır, km ilçe merkezleri
// arasından hesaplanır. Noktalar:
//   1) Hareket merkezi (Pendik) · 2) Yükleme ilçesi · 3) Boşaltma ilçesi · 4) Hareket merkezi
// Depo işlerinde yükleme/boşaltma yerine şubenin ilçesi girer.
// Km sunucudaki /api/mesafe ucundan gelir (Google Routes API, önbellekli).
// ############################################################################
const TT_MESAFE_API = '/api/mesafe';
// Hizmete göre 4 nokta → [{ ad, adres }] · eksik seçim varsa null
const ttRotaNoktalari = (f) => {
  const merkez = { ad: 'Hareket merkezi (Pendik)', adres: TT_MESAFE.cikisAdresi || MESAFE_VARSAYILAN.cikisAdresi };
  const ilce = (il, ilceAdi, ad) => { const adres = ilceMerkezAdresi(il, ilceAdi); return adres ? { ad, adres, eksikIlce: !ilceAdi } : null; };
  const sube = () => { const d = DEPO_LOCATIONS.find(x => x.name === f.sube) || DEPO_LOCATIONS[0]; return { ad: d.name, adres: ilceMerkezAdresi(d.province, d.district) }; };
  let A = null, B = null;
  if (f.hizmetTipi === 'Nakliye') { A = ilce(f.yukIl, f.yukIlce, 'Yükleme'); B = ilce(f.bosIl, f.bosIlce, 'Boşaltma'); }
  else if (f.hizmetTipi === 'Depo') { if (f.nakliyeIstiyor !== 'Firma') return null; A = ilce(f.yukIl, f.yukIlce, 'Yükleme'); B = sube(); }
  else { A = sube(); B = ilce(f.bosIl, f.bosIlce, 'Boşaltma'); }
  if (!A || !B) return null;
  return [merkez, A, B, merkez];
};
// Sunucudan km iste
const ttRotaHesapla = async (noktalar, kullanici) => {
  const r = await fetch(TT_MESAFE_API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kullaniciId: kullanici?.id, sifre: kullanici?.password, noktalar: noktalar.map(n => n.adres) }),
  });
  let j; try { j = await r.json(); } catch { j = {}; }
  if (!r.ok) throw new Error(j.error || `Km servisi hatası (${r.status})`);
  // Etaplara ekran adlarını ekle
  j.etaplar = (j.etaplar || []).map((e, i) => ({ ...e, ad: `${noktalar[i].ad} → ${noktalar[i + 1].ad}` }));
  return { ...j, hesaplanan: new Date().toISOString() };
};

// Güzergah & km kartı — 4 nokta, 3 etap, toplam km, eşik durumu, geçişler (±), kalem özeti
const TTRotaKarti = ({ form, setForm, kullanici }) => {
  const [hesaplaniyor, setHesaplaniyor] = useState(false);
  if (!mesafeModuAcik(TT_MESAFE)) return null; // mod kapalıyken görünmez (eski sistem)
  const rota = form.rota;
  const noktalar = ttRotaNoktalari(form);
  const tekrar = async () => {
    if (!noktalar) return;
    setHesaplaniyor(true);
    const imza = JSON.stringify(noktalar.map(n => n.adres));
    try { const r = await ttRotaHesapla(noktalar, kullanici); setForm(f => ({ ...f, rota: { ...r, imza } })); }
    catch (e) { setForm(f => ({ ...f, rota: { hata: e.message, imza } })); }
    finally { setHesaplaniyor(false); }
  };
  const gecisDegis = (id, fark) => setForm(f => {
    const g = { ...(f.rota?.gecisler || {}) };
    g[id] = Math.max(0, (g[id] || 0) + fark);
    if (!g[id]) delete g[id];
    return { ...f, rota: { ...(f.rota || {}), gecisler: g } };
  });
  const km = Number(rota?.toplamKm) || 0;
  // DEĞİŞTİ: tek eşik yerine kademeler — en küçük kademe "eşik", aktif kademe uygulanan
  const kademe = mesafeAktifKademe(TT_MESAFE, km);
  const esik = Math.min(...mesafeKademeListesi(TT_MESAFE).map(k => Number(k.km) || Infinity)) || 0;
  const asildi = !!kademe;
  const kalemler = mesafeKalemleri(TT_MESAFE, rota);
  // YENİ: ev tipine göre km farkı da kartta görünür (fiyat hesabıyla aynı oda anahtarı)
  const kartOdaK = ttOdaAnahtari(form.hizmetTipi === 'Nakliye' ? form.odaSayisi : (form.depoBoyutu === 'Özel' ? '4+1' : form.depoBoyutu));
  const kartOdaFarki = kartOdaK ? mesafeOdaFarkiKalemi(TT_MESAFE, rota, kartOdaK) : null;
  if (kartOdaFarki) kalemler.push(kartOdaFarki);
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-black uppercase text-emerald-900 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Güzergah & Km (4 nokta · ilçe merkezleri)</p>
        {noktalar && <button type="button" onClick={tekrar} disabled={hesaplaniyor} className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[10px] font-black flex items-center gap-1 disabled:opacity-50">{hesaplaniyor ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Yeniden hesapla</button>}
      </div>
      {/* 4 nokta */}
      {noktalar ? (
        <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
          {noktalar.map((n, i) => (
            <React.Fragment key={i}>
              <span className={`px-2 py-1 rounded-lg ${i === 0 || i === 3 ? 'bg-neutral-900 text-white' : 'bg-white border border-emerald-200 text-emerald-900'}`}>{i + 1}. {n.adres.replace(', Türkiye', '')}</span>
              {i < 3 && <span className="text-emerald-700">→</span>}
            </React.Fragment>
          ))}
        </div>
      ) : <p className="text-[10px] font-bold text-neutral-500">Km hesabı için yükleme ve boşaltma il/ilçesini seçin (depo işlerinde şube otomatik eklenir).</p>}
      {noktalar?.some(n => n.eksikIlce) && <p className="text-[10px] font-bold text-amber-800">İlçe seçilmedi — il merkezi baz alındı. Daha doğru km için ilçeyi seçin.</p>}
      {hesaplaniyor && !rota?.etaplar && <p className="text-[10px] font-bold text-neutral-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Km hesaplanıyor…</p>}
      {rota?.hata && <p className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">Km hesaplanamadı: {rota.hata}</p>}
      {/* 3 etap */}
      {(rota?.etaplar || []).length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-white divide-y divide-neutral-100">
          {rota.etaplar.map((e, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
              <span className="font-bold text-neutral-700">{i + 1}. etap · {e.ad}</span>
              <span className="font-black text-neutral-900">{Number(e.km).toLocaleString('tr-TR')} km {e.dk ? <span className="text-neutral-400 font-bold">· {e.dk} dk</span> : null}</span>
            </div>
          ))}
          <div className={`flex items-center justify-between px-3 py-2 text-xs ${asildi ? 'bg-amber-100' : 'bg-emerald-100'}`}>
            <span className={`font-black ${asildi ? 'text-amber-900' : 'text-emerald-900'}`}>Toplam {asildi ? `· ${Number(kademe.km).toLocaleString('tr-TR')} km kademesi uygulandı` : Number.isFinite(esik) ? `· ${esik} km eşiği altında` : ''}</span>
            <span className={`font-black ${asildi ? 'text-amber-900' : 'text-emerald-900'}`}>{km.toLocaleString('tr-TR')} km</span>
          </div>
        </div>
      )}
      {/* Geçişler — yalnızca eşik üstünde fiyata girer */}
      {km > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase text-neutral-500 mb-1">Ücretli geçişler {asildi ? '(rotadan tespit edildi — ± ile düzeltin)' : `(${esik} km altında fiyata eklenmez)`}</p>
          <div className="flex flex-wrap gap-1.5">
            {MESAFE_GECISLERI.map(g => {
              const n = rota?.gecisler?.[g.ic] || 0;
              return (
                <span key={g.ic} className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold ${n ? (asildi ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-neutral-100 border-neutral-300 text-neutral-500 line-through') : 'bg-white border-neutral-200 text-neutral-500'}`} title={`${ttTl(TT_MESAFE.gecis?.[g.ic] || 0)} / geçiş`}>
                  <button type="button" onClick={() => gecisDegis(g.ic, -1)} className="w-4 h-4 rounded bg-black/5 hover:bg-black/10 font-black leading-none">−</button>
                  <span>{g.etiket.split(' · ')[0].split(' (')[0]}{n ? ` ×${n}` : ''}</span>
                  <button type="button" onClick={() => gecisDegis(g.ic, +1)} className="w-4 h-4 rounded bg-black/5 hover:bg-black/10 font-black leading-none">+</button>
                </span>
              );
            })}
          </div>
        </div>
      )}
      {/* Km kalemleri özeti (işçilik farkı fiyat kartında görünür) */}
      {kalemler.length > 0 && (
        <div className="rounded-xl bg-neutral-900 text-white px-3 py-2 text-[11px] space-y-0.5">
          {kalemler.map((k, i) => <div key={i} className="flex justify-between gap-2"><span className="text-white/80">{k.ad}</span><span className="font-black">{ttTl(k.tutar)}</span></div>)}
          {asildi && Number(kademe.yuzde) > 0 && <div className="text-[10px] text-amber-300 font-bold pt-0.5">+ %{kademe.yuzde} uzun yol farkı TOPLAM fiyatın üzerine eklenir · işçilik farkı (taban + ek hizmetler üzerinden) sistem fiyatına eklenir.</div>}
        </div>
      )}
    </div>
  );
};

const TTIlIlce = ({ il, ilce, adres, onIl, onIlce, onAdres, halka = '' }) => {
  const ilceler = ttIlceler(il);
  const secimCls = `w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm font-bold text-neutral-900 outline-none focus:ring-2 ${halka}`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={il || ''} onChange={e => { onIl(e.target.value); onIlce(''); }} className={secimCls}>
          <option value="">İl Seçiniz</option>
          <optgroup label="Sık Kullanılan">{TT_ONCELIKLI_ILLER.map(x => <option key={x} value={x}>{x}</option>)}</optgroup>
          <optgroup label="Diğer İller">{TT_DIGER_ILLER.map(x => <option key={x} value={x}>{x}</option>)}</optgroup>
        </select>
        {ilceler.length > 0 ? (
          <select value={ilce || ''} onChange={e => onIlce(e.target.value)} className={secimCls}>
            <option value="">İlçe Seçiniz</option>
            {ilceler.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        ) : (
          <input value={ilce || ''} onChange={e => onIlce(e.target.value)} placeholder={il ? 'İlçe yazın' : 'Önce il seçin'} disabled={!il} className={`${secimCls} disabled:bg-neutral-100`} />
        )}
      </div>
      {onAdres && (
        <input value={adres || ''} onChange={e => onAdres(e.target.value)} placeholder="Mahalle / site / sokak (opsiyonel)"
          className={`w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-semibold outline-none focus:ring-2 ${halka}`} />
      )}
    </div>
  );
};

// ============================================================================
// MÜŞTERİ GEÇMİŞİ KUTUSU (kullanıcı talebi)
// "3 yıl önce bu müşteriyi taşıdık", "teklif havuzunda var", "telefonla
// görüşüldü", "bu numara farklı bir isimle kayıtlı" bilgilerini gösterir.
// ============================================================================
const ttIsDurumu = (j) => {
  if (j.status === 'cancelled') return { ad: 'İptal edildi', renk: 'bg-red-100 text-red-700' };
  if (j.status === 'completed') return { ad: 'Taşındı ✓', renk: 'bg-green-100 text-green-800' };
  if ((j.date || '') > ttBugunStr()) return { ad: 'Planlı iş', renk: 'bg-sky-100 text-sky-800' };
  if (j.status === 'in-progress') return { ad: 'Devam ediyor', renk: 'bg-amber-100 text-amber-800' };
  return { ad: 'Kayıt var', renk: 'bg-neutral-200 text-neutral-700' };
};
// ============================================================================
// YENİ (kullanıcı talebi): NUMARA SORGUSU — GEÇMİŞ ÖZETİ (Teklife Bak başlığı)
// Numaradan bulunan geçmişin en önemli satırları kısa rozetlere çevrilir:
//   • Başka satışçının telefon görüşmesinde / portföyünde → "Erman Kadir Erişir · 1 hafta önce görüştü"
//   • Kendi görüşmeniz → "Siz · 3 gün önce görüştünüz"
//   • İş kaydı → "3 yıl önce taşındı" / "Kayıtlı işi var · 05.10.2026"
//   • Önceki havuz talebi → "2 ay önce teklif istedi · Vehbi Çirgin"
// ============================================================================
const ttGecmisOzeti = (g, kullanici = '') => {
  if (!g) return [];
  const ozet = [];
  const sure = (tarih) => { const x = ttGoreliSure(tarih); return x === 'bugün' ? 'bugün' : x; };
  // Telefon görüşmeleri — satışçı bazında en yenisi
  const sahipler = new Map();
  g.telefon.forEach(t => { const sh = ttSahibi(t) || 'Atanmamış'; if (!sahipler.has(sh)) sahipler.set(sh, t); });
  sahipler.forEach((t, sh) => {
    const benim = kullanici && sh === kullanici;
    ozet.push({
      tur: 'telefon', oncelik: benim ? 2 : 1,
      metin: benim ? `Siz · ${sure(t.iletisimTarihi)} görüştünüz` : `${sh} · ${sure(t.iletisimTarihi)} görüştü`,
      baslik: `${benim ? 'Sizin' : `${sh} adlı satışçının`} telefon görüşmesinde kayıtlı · ${ttTrTarih(t.iletisimTarihi)} · ${t.hizmetTipi} · durum: ${ttDurumBul(t.durum).etiket}`,
      cls: benim ? 'bg-emerald-500 text-white' : 'bg-yellow-300 text-neutral-900',
    });
  });
  // İş kayıtları — tamamlanan (en yeni) ve bekleyen/gelecek
  const tasindi = g.isler.find(j => j.status === 'completed');
  if (tasindi) ozet.push({ tur: 'is', oncelik: 0, metin: `${sure(tasindi.date)} taşındı`, baslik: `${ttTrTarih(tasindi.date)} · ${tasindi.type || 'Nakliye'} · ${tasindi.customerName || ''}`, cls: 'bg-neutral-900 text-white' });
  const bekleyen = g.isler.find(j => j.status !== 'completed' && j.status !== 'cancelled');
  if (bekleyen) ozet.push({ tur: 'is', oncelik: 0, metin: `Kayıtlı işi var · ${ttTrTarih(bekleyen.date)}`, baslik: `${bekleyen.type || 'Nakliye'} · ${bekleyen.customerName || ''}`, cls: 'bg-blue-600 text-white' });
  // Önceki havuz talepleri — en yenisi
  const talep = g.havuz[0];
  if (talep) ozet.push({ tur: 'havuz', oncelik: 3, metin: `${sure(talep.createdAt)} teklif istedi${talep.atanan ? ` · ${talep.atanan}` : ''}`, baslik: `${g.havuz.length} önceki talep · son: ${ttTrTarih(talep.createdAt)} · ${talep.hizmetTipi || 'Nakliye'} · ${talep.durum || 'Yeni'}`, cls: 'bg-white text-orange-700' });
  return ozet.sort((a, b) => a.oncelik - b.oncelik);
};
// Başlıktaki rozet satırı — tıklayınca aşağıdaki geçmiş kutusuna kaydırır
const TTGecmisRozetleri = ({ gecmis, kullanici, hedefId }) => {
  const ozet = ttGecmisOzeti(gecmis, kullanici);
  const git = () => document.getElementById(hedefId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (!ozet.length) {
    return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-white/90 flex items-center gap-1" title="Numara sorgulandı: iş kaydı, havuz talebi veya telefon görüşmesi bulunamadı"><CheckCircle className="w-3 h-3" /> Geçmiş kaydı yok</span>;
  }
  const gorunen = ozet.slice(0, 3);
  return (
    <>
      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1 animate-pulse" title="Bu numaranın sistemde kaydı var"><History className="w-3 h-3" /> Geçmiş {gecmis.toplam}</span>
      {gorunen.map((o, i) => (
        <button key={i} type="button" onClick={git} title={`${o.baslik} — ayrıntı için tıklayın`}
          className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm hover:opacity-90 flex items-center gap-1 ${o.cls}`}>
          {o.tur === 'telefon' ? <PhoneCall className="w-3 h-3" /> : o.tur === 'is' ? <Truck className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
          {o.metin}
        </button>
      ))}
      {ozet.length > gorunen.length && <button type="button" onClick={git} className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white">+{ozet.length - gorunen.length}</button>}
    </>
  );
};

const MusteriGecmisiKutusu = ({ gecmis, ad = '', kompakt = false }) => {
  const [acik, setAcik] = useState(!kompakt);
  if (!gecmis) return null;
  const tasindi = gecmis.isler.find(j => j.status === 'completed');
  // Aynı numara, farklı isim uyarısı — tüm kaynaklardaki isimler karşılaştırılır
  const farkliIsimler = [...new Set([
    ...gecmis.isler.map(j => j.customerName), ...gecmis.havuz.map(k => k.musteriAdi), ...gecmis.telefon.map(t => t.musteriAdi),
  ].filter(x => x && ad && !ttAyniIsimMi(x, ad)))];
  const baslik = tasindi ? `Bu müşteriyi daha önce taşıdık — ${ttGoreliSure(tasindi.date)}`
    : gecmis.isler.length ? 'Bu numaranın iş kaydı var'
    : gecmis.telefon.length ? 'Bu müşteriyle daha önce telefonda görüşüldü'
    : 'Bu müşteri teklif havuzunda var';
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
      <button type="button" onClick={() => setAcik(a => !a)} className="w-full px-3 py-2 flex items-center gap-2 text-left">
        <History className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-black text-amber-900">{baslik}</span>
          <span className="block text-[10px] font-bold text-amber-700">
            {gecmis.isler.length} iş kaydı · {gecmis.havuz.length} havuz talebi · {gecmis.telefon.length} telefon görüşmesi
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-amber-700 transition-transform ${acik ? 'rotate-180' : ''}`} />
      </button>
      {acik && (
        <div className="px-3 pb-3 space-y-1.5">
          {farkliIsimler.length > 0 && (
            <p className="text-[11px] font-black text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Bu numara farklı isimle de kayıtlı: {farkliIsimler.join(', ')}
            </p>
          )}
          {gecmis.isler.slice(0, 5).map(j => {
            const d = ttIsDurumu(j);
            return (
              <div key={`i-${j.id}`} className="bg-white border border-amber-200 rounded-lg px-2 py-1.5 flex items-center gap-2 text-[11px]">
                <Truck className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span className="flex-1 min-w-0 font-bold text-neutral-800 truncate">
                  {j.type || 'Nakliye'} · {ttTrTarih(j.date)} ({ttGoreliSure(j.date)}) · {j.customerName}
                  {parseFloat(j.price) > 0 && <span className="text-neutral-500"> · {ttTl(j.price)}</span>}
                </span>
                <span className={`px-1.5 py-0.5 rounded font-black text-[9px] shrink-0 ${d.renk}`}>{d.ad}</span>
              </div>
            );
          })}
          {gecmis.telefon.slice(0, 4).map(t => (
            <div key={`t-${t.id}`} className="bg-white border border-amber-200 rounded-lg px-2 py-1.5 flex items-center gap-2 text-[11px]">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="flex-1 min-w-0 font-bold text-neutral-800 truncate">
                Telefon: {ttTrTarih(t.iletisimTarihi)} · {t.hizmetTipi} · {t.musteriAdi || 'İsimsiz'}{t.verilenFiyat ? ` · ${t.verilenFiyat} ₺` : ''} · {ttSahibi(t) || '—'}
              </span>
              <span className={`px-1.5 py-0.5 rounded font-black text-[9px] border shrink-0 ${ttDurumBul(t.durum).rozet}`}>{ttDurumBul(t.durum).etiket}</span>
            </div>
          ))}
          {gecmis.havuz.slice(0, 4).map(k => (
            <div key={`h-${k.id}`} className="bg-white border border-amber-200 rounded-lg px-2 py-1.5 flex items-center gap-2 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="flex-1 min-w-0 font-bold text-neutral-800 truncate">
                {(KANALLAR.find(x => x.id === k.kanal)?.ad) || 'Havuz'} · {ttTrTarih(k.createdAt)} · {k.hizmetTipi || 'Nakliye'} · {k.musteriAdi || 'İsimsiz'} · {k.atanan || 'Atanmadı'}
              </span>
              <span className="px-1.5 py-0.5 rounded font-black text-[9px] bg-neutral-100 text-neutral-700 shrink-0">{k.durum || 'Yeni'}</span>
            </div>
          ))}
          {gecmis.toplam > 13 && <p className="text-[10px] font-bold text-amber-700">… ve daha fazlası</p>}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CANLI FİYAT PANELİ — form değiştikçe sistem fiyatı yeniden hesaplanır
// ============================================================================
const TTFiyatPaneli = ({ form }) => {
  const h = useMemo(() => ttFiyatHesapla(form), [form, ttFiyatSurumu]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="bg-neutral-900 text-white rounded-2xl p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-yellow-400" /> Sistem Fiyatı</p>
        {h.liste && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">{h.liste}</span>}
      </div>
      {/* YENİ (kullanıcı talebi): seçili adreslere göre TOPLAM KM (4 nokta / 3 etap) */}
      {mesafeModuAcik(TT_MESAFE) && Number(form.rota?.toplamKm) > 0 && (() => {
        const kademe = mesafeAktifKademe(TT_MESAFE, form.rota.toplamKm);
        return (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-2">
            <div className="flex items-end justify-between gap-2">
              <span className="text-[10px] font-black uppercase text-emerald-200 flex items-center gap-1"><MapPin className="w-3 h-3" /> Toplam güzergah</span>
              <span className="text-lg font-black text-emerald-300 leading-none">{Number(form.rota.toplamKm).toLocaleString('tr-TR')} km</span>
            </div>
            {(form.rota.etaplar || []).length > 0 && (
              <p className="text-[10px] font-bold text-emerald-100/80 mt-1">{form.rota.etaplar.map(e => `${Number(e.km).toLocaleString('tr-TR')}`).join(' + ')} km (3 etap){form.rota.toplamDk ? ` · ~${Math.floor(form.rota.toplamDk / 60)} sa ${form.rota.toplamDk % 60} dk` : ''}</p>
            )}
            {kademe && <p className="text-[10px] font-black text-amber-300 mt-0.5">{Number(kademe.km).toLocaleString('tr-TR')} km üstü kademe uygulandı · %{kademe.yuzde}{Number(kademe.ek) ? ` + ${ttTl(kademe.ek)}` : ''}</p>}
          </div>
        );
      })()}
      {h.kalemler.length > 0 && (
        <ul className="space-y-1">
          {h.kalemler.map((k, i) => (
            <li key={i} className="flex justify-between gap-2 text-[11px] text-neutral-300">
              <span className="min-w-0">{k.ad}</span><span className="font-black text-white shrink-0">{ttTl(k.tutar)}</span>
            </li>
          ))}
        </ul>
      )}
      {(form.hizmetTipi !== 'Depo' || form.nakliyeIstiyor === 'Firma') && (
        <div className="pt-2 border-t border-white/10 space-y-1.5">
          {/* DEĞİŞTİ (kullanıcı talebi): sistem fiyatı = TABAN; ayrıca +%25 açılış fiyatı */}
          <div className="flex items-end justify-between gap-2">
            <span className="text-[10px] font-bold uppercase text-neutral-400">{form.hizmetTipi === 'Nakliye' ? 'Taşıma' : 'Nakliye'} · Taban fiyat</span>
            <span className="text-2xl font-black text-yellow-400 leading-none">{h.nakliyeToplam ? ttTl(h.nakliyeToplam) : '—'}</span>
          </div>
          {h.nakliyeToplam > 0 && (<>
            <div className="flex items-end justify-between gap-2">
              <span className="text-[10px] font-bold uppercase text-neutral-400">Açılış fiyatı (+%{ttAcilisYuzde(form.hizmetTipi)})</span>
              <span className="text-lg font-black text-emerald-300 leading-none">{ttTl(ttAcilisFiyati(h.nakliyeToplam, form.hizmetTipi))}</span>
            </div>
            <p className="text-[10px] font-bold text-neutral-300 bg-white/5 rounded-lg px-2 py-1">
              💬 Fiyat aralığı: <b className="text-white">{ttTl(h.nakliyeToplam)} – {ttTl(ttAcilisFiyati(h.nakliyeToplam, form.hizmetTipi))}</b>. Açılışta +%{ttAcilisYuzde(form.hizmetTipi)} fiyatla başlayın; pazarlıkta tabana kadar iskonto yapabilirsiniz.
            </p>
          </>)}
        </div>
      )}
      {/* Depo ücreti: aylık + KDV ve kampanyalı peşin tutar */}
      {h.depo && (
        <div className="pt-2 border-t border-white/10 space-y-1">
          <div className="flex items-end justify-between gap-2">
            <span className="text-[10px] font-bold uppercase text-neutral-400">{h.depo.boyut.id} depo · aylık</span>
            <span className="text-lg font-black text-sky-300 leading-none">{ttTl(h.depo.aylik)} <span className="text-[10px] text-neutral-400">+KDV</span></span>
          </div>
          <p className="text-[10px] text-neutral-400 text-right">KDV dahil {ttTl(h.depo.aylikKdvli)} / ay</p>
          {h.depo.kiralama.odenecekAy > 1 && (
            <p className="text-[11px] font-black text-emerald-300 bg-emerald-500/10 rounded-lg px-2 py-1">
              🎁 {h.depo.kiralama.ad}: {ttTl(h.depo.pesin)} +KDV ({h.depo.kiralama.odenecekAy} ay öde, {h.depo.kiralama.toplamAy} ay kullan)
            </p>
          )}
        </div>
      )}
      {h.uyarilar.map((u, i) => <p key={`u${i}`} className="text-[10px] font-bold text-amber-300 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {u}</p>)}
      {h.bilgiler.map((u, i) => <p key={`b${i}`} className="text-[10px] font-bold text-sky-200 flex gap-1"><HelpCircle className="w-3 h-3 shrink-0 mt-0.5" /> {u}</p>)}
    </div>
  );
};

// ============================================================================
// GÖRÜŞME REHBERİ — oryantasyon kılavuzlarından (Sembol / DepoEvim ayrı)
// ============================================================================
const TT_REHBER = {
  Nakliye: {
    karsilama: '"Sembol Nakliyat, ben [adın], hayırlı günler, nasıl yardımcı olabilirim?"',
    bolumler: [
      { baslik: 'Hazır Cümleler', maddeler: [
        'Fiyat: "Bu taşıma için ortalama fiyatımız [X] TL. Eşyanın videosunu atarsanız fiyatı netleştirebiliriz."',
        'Toplama: "Toplama hizmetimiz ekstra [X] TL, kendiniz toplarsanız [Y] TL olur."',
        'Video + kayıt: "Size WhatsApp\'tan yazıyorum, eşyaların videosunu gönderirseniz fiyatta yardımcı oluruz."',
        'Değer: "Sigortalı taşıma, profesyonel ekip, söküm-montaj dahil [X] TL."',
        'Ofis: "Dilerseniz ofisimize de bekleriz, yüz yüze görüşelim."',
      ] },
      { baslik: 'İtiraz Karşılama', maddeler: [
        '"Pahalı": Önce kapsamı anlat (sigorta, ekip, söküm-montaj). İndirim gerekiyorsa toplamayı müşteriye bırakarak yap.',
        '"Daha ucuz aldım": "O fiyata sigorta, söküm-montaj, dış asansör dahil mi?" diye sordur. Rakibi kötüleme.',
        '"Düşüneyim": Yazılı teklifi WhatsApp\'tan gönder, "yarın kısaca arayayım" diye dönüş iznini SEN al.',
        '"Kapıda fiyat değişir mi?": "Hayır — videoyu bu yüzden istiyoruz, sözleşmede de yazar."',
        '"Az eşyam var": "Videonuzu görünce en uygun rakamı veririm."',
      ] },
      { baslik: 'Kurallar', maddeler: [
        'Kayıt taşımadan 15 gün öncesine kadar açılabilir; %20 kapora ile tarih kesinleşir.',
        '72 saatten fazla varsa kapora hariç ücretsiz iptal; daha az kala %50 cayma bedeli.',
        'Yapılmaz: klima söküm-montajı, duvar montajı, elektrik işleri. Avize/perde/ankastre sökülür, montajı yapılmaz.',
        '30 metreyi aşan yanaşma mesafesinde ek işçilik doğar.',
        'Şehirler arası: eşya araca yüklendikten sonra %50 ödeme alınır.',
      ] },
    ],
  },
  Depo: {
    karsilama: '"Depoevim, merhabalar, buyurun."',
    bolumler: [
      { baslik: 'Önce Depo Fiyatı (ilk 30 saniye)', maddeler: [
        'Eşyanın cinsini ve kaç+1 olduğunu öğren → aylık fiyatı HEMEN söyle: "2+1 için aylık 7.500 ₺ + KDV."',
        'Depoyu öv: yüksek kat, rutubetsiz, 7/24 kameralı, odası mühürlü, sigortalı.',
        'Nakliyeyi zorlamadan öner: sigortalı taşıma, kendi ekibimiz, kalıcı ambalaj, depo müşterisine özel fiyat.',
        'Video iste + depoya davet et: "Hangi depoya sığar ve nakliye fiyatı için videoyu gönderin."',
      ] },
      { baslik: 'Kampanya (tek indirim aracın)', maddeler: [
        '5 ay öde → 1 ay hediye · 10 ay öde → 2 ay hediye.',
        'Kredi kartı YALNIZCA bu toplu ödemelerde geçer; aylık ödeme IBAN\'a yapılır.',
        'Süresinden önce çıkarsa hediye aylar düşülüp kalan aylar iade edilir. Başka indirim yoktur.',
      ] },
      { baslik: 'İtiraz Karşılama', maddeler: [
        '"Nemlenir mi?": Yüksek kat, rutubet yok, kalıcı ambalaj, kamera — depoyu gezmeye davet et.',
        '"Sigortalı mı?": Evet; ayrıca oda + mühür + 7/24 kamera.',
        '"İstediğim zaman alabilir miyim?": Taahhüt yok; 1-2 gün önce randevuyla ziyaret (mühür 200 ₺+KDV).',
        '"Süre belli değil": Aylık çalışırız, çıkmadan 7 gün önce haber yeterli.',
        '"Depo uzak": İstanbul içinde nakliye mesafeyle çok değişmez; ev eşyası yılda 1-3 kez ziyaret edilir.',
      ] },
      { baslik: 'Kurallar', maddeler: [
        'Depo fiyatı sadece GİRİŞ nakliyesini kapsar; çıkış ayrı fiyatlanır — bunu müşteri SORARSA net anlat.',
        'Depo sözleşmesi eşya depoya konduktan SONRA yapılır (oda no + KDV dahil aylık ücret).',
        'Aylık ücret giriş tarihinden itibaren en geç 5 gün içinde IBAN\'a yatar.',
        'Depoda gıda bulunamaz; değerli eşya, ziynet, nakit müşteride kalmalı.',
        'Ticari / her gün giriş-çıkış kullanımına depo verilmez.',
      ] },
    ],
  },
};
const TTGorusmeRehberi = ({ hizmetTipi }) => {
  const r = hizmetTipi === 'Nakliye' ? TT_REHBER.Nakliye : TT_REHBER.Depo;
  const [acik, setAcik] = useState(0);
  return (
    <div className="space-y-2">
      <div className="bg-white border border-neutral-200 rounded-2xl p-3">
        <p className="text-[10px] font-black uppercase text-neutral-500">Karşılama</p>
        <p className="text-xs font-bold text-neutral-800 mt-0.5">{r.karsilama}</p>
      </div>
      {r.bolumler.map((b, i) => (
        <div key={b.baslik} className="bg-white border border-neutral-200 rounded-2xl">
          <button type="button" onClick={() => setAcik(acik === i ? null : i)} className="w-full px-3 py-2 flex items-center justify-between text-left">
            <span className="text-[11px] font-black text-neutral-800">{b.baslik}</span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${acik === i ? 'rotate-180' : ''}`} />
          </button>
          {acik === i && (
            <ul className="px-3 pb-3 space-y-1.5">
              {b.maddeler.map(m => <li key={m} className="text-[11px] text-neutral-700 leading-snug flex gap-1.5"><span className="text-neutral-300">•</span><span>{m}</span></li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// WHATSAPP MESAJ PENCERESİ — şablon seç, düzenle, WhatsApp'ta aç / kopyala
// ============================================================================
const TTWhatsappPenceresi = ({ t, gonderen, baslangicSablon = null, onKapat, onGonderildi }) => {
  const sablonlar = useMemo(() => ttWhatsappSablonlari(t, gonderen), [t, gonderen]);
  // YENİ: hızlı butondan gelindiyse o şablon seçili açılır
  const ilk = sablonlar.find(x => x.id === baslangicSablon) || sablonlar[0];
  const [seciliId, setSeciliId] = useState(ilk?.id);
  const [metin, setMetin] = useState(ilk?.metin || '');
  const [kopyalandi, setKopyalandi] = useState(false);
  const sec = (s) => { setSeciliId(s.id); setMetin(s.metin); };
  const numara = ttWaNumara(t.telefon);
  const gonder = () => {
    if (!numara) return;
    // wa.me bağlantısı hem masaüstü hem mobilde WhatsApp'ı hazır metinle açar
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(metin)}`, '_blank', 'noopener,noreferrer');
    onGonderildi?.(sablonlar.find(s => s.id === seciliId)?.ad || 'Özel mesaj');
  };
  const kopyala = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(metin);
      else {
        // Yedek yöntem: pano izni olmayan tarayıcılarda gizli metin kutusundan kopyalanır
        const alan = document.createElement('textarea');
        alan.value = metin; alan.style.position = 'fixed'; alan.style.opacity = '0';
        document.body.appendChild(alan); alan.select(); document.execCommand('copy'); alan.remove();
      }
      setKopyalandi(true); setTimeout(() => setKopyalandi(false), 1500);
    } catch (e) { console.error('Kopyalanamadı:', e); }
  };
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4" onClick={onKapat}>
      <div className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 bg-green-600 text-white px-4 py-3 flex items-center gap-3">
          <MessageCircle className="w-6 h-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base truncate">WhatsApp Mesajı — {t.musteriAdi || 'Müşteri'}</h3>
            <p className="text-[11px] font-bold text-white/80">{ttTelGoster(t.telefon)} · şablonu seçin, gerekirse düzenleyin</p>
          </div>
          <button type="button" onClick={onKapat} className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {sablonlar.map(s => (
              <button key={s.id} type="button" onClick={() => sec(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${seciliId === s.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-800 border-green-200 hover:border-green-500'}`}>
                {s.ad}
              </button>
            ))}
          </div>
          <textarea value={metin} onChange={e => setMetin(e.target.value)} rows={14}
            className="w-full p-3 rounded-2xl border-2 border-green-200 bg-green-50/40 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-green-500 resize-y" />
          {!numara && <p className="text-xs font-black text-red-600">Telefon numarası geçersiz — mesaj WhatsApp'ta açılamaz, kopyalayıp gönderebilirsiniz.</p>}
        </div>
        <div className="shrink-0 px-4 py-3 border-t border-neutral-200 bg-neutral-50 flex gap-2">
          <button type="button" onClick={kopyala} className="flex-1 py-2.5 rounded-xl bg-white border border-neutral-200 text-sm font-black text-neutral-700 hover:bg-neutral-100 flex items-center justify-center gap-1.5">
            {kopyalandi ? <><Check className="w-4 h-4 text-green-600" /> Kopyalandı</> : <><Copy className="w-4 h-4" /> Kopyala</>}
          </button>
          <button type="button" onClick={gonder} disabled={!numara}
            className="flex-[2] py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-black flex items-center justify-center gap-1.5 shadow-lg shadow-green-600/30 disabled:opacity-40">
            <Send className="w-4 h-4" /> WhatsApp'ta Aç
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// YENİ (kullanıcı talebi): MÜŞTERİ BİLGİLENDİRME — HIZLI WHATSAPP BUTONLARI
// ----------------------------------------------------------------------------
// Sihirbazın sağ panelinde ve teklif detayında sürekli açık durur. Her buton
// ilgili şablonu seçili olarak WhatsApp penceresini açar (göndermeden önce
// metin düzenlenebilir). Ara butonu da buradadır.
// ============================================================================
const TTWhatsappHizli = ({ t, onSec }) => {
  const sablonlar = ttWhatsappSablonlari(t);
  const telVar = ttTelGecerli(t.telefon);
  return (
    <div className="bg-white border-2 border-green-200 rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase text-green-800 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Müşteri Bilgilendirme</p>
        {telVar && <a href={`tel:0${ttTelAnahtar(t.telefon)}`} className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black flex items-center gap-1"><Phone className="w-3 h-3" /> Ara</a>}
      </div>
      {!telVar && <p className="text-[10px] font-bold text-amber-700">Mesaj göndermek için geçerli bir telefon numarası girin.</p>}
      <div className="grid grid-cols-1 gap-1.5">
        {sablonlar.map(sb => (
          <button key={sb.id} type="button" onClick={() => onSec(sb.id)} disabled={!telVar}
            className="w-full text-left px-3 py-2 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-900 text-xs font-black flex items-center gap-2 transition disabled:opacity-40">
            <Send className="w-3.5 h-3.5 shrink-0" /> <span className="flex-1">{sb.ad}</span> <ChevronRight className="w-3.5 h-3.5 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// PERSONEL TRANSFER PENCERESİ (kullanıcı talebi) — hem havuz hem telefon
// kayıtlarında kullanılır. Seçilen satışçı kaydın yeni sahibi olur.
// ============================================================================
const PersonelTransferPenceresi = ({ baslik, mevcut, secenekler = [], onTransfer, onKapat }) => {
  const [secilen, setSecilen] = useState('');
  const [not, setNot] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const liste = secenekler.filter(ad => ad && ad !== mevcut);
  const onayla = async () => {
    if (!secilen) return;
    setBekliyor(true);
    try { await onTransfer(secilen, not.trim()); } finally { setBekliyor(false); }
  };
  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4" onClick={onKapat}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="bg-neutral-900 text-white p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Personel Transferi</p>
          <h3 className="font-black text-base mt-0.5 truncate">{baslik}</h3>
          <p className="text-[11px] font-bold text-neutral-300 mt-0.5">Şu an: {mevcut || 'Atanmadı'}</p>
        </div>
        <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
          {liste.length === 0 && <p className="text-xs font-bold text-neutral-400 text-center py-4">Transfer edilebilecek satış personeli yok.</p>}
          {liste.map(ad => (
            <button key={ad} type="button" onClick={() => setSecilen(ad)}
              className={`w-full px-3 py-2.5 rounded-xl text-sm font-black border text-left flex items-center gap-2 transition ${secilen === ad ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'}`}>
              <User className="w-4 h-4" /> {ad}
            </button>
          ))}
          <textarea value={not} onChange={e => setNot(e.target.value)} rows={2} placeholder="Devredilen kişiye not (opsiyonel) — örn. video bekleniyor, perşembe aranacak"
            className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-400 resize-none" />
        </div>
        <div className="p-3 border-t border-neutral-100 flex gap-2">
          <button type="button" onClick={onKapat} className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-sm font-black text-neutral-600">Vazgeç</button>
          <button type="button" onClick={onayla} disabled={!secilen || bekliyor}
            className="flex-[2] py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-black disabled:opacity-40 flex items-center justify-center gap-1.5">
            {bekliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Transfer Et
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// (4) GÖRÜŞME SİHİRBAZI — soru soru ilerleyen form
// ============================================================================
// Boş form. Alan adları kayıt ekranına aktarılacak değerlerle uyumludur.
const ttBosForm = (hizmetTipi = 'Nakliye') => ({
  surum: 2, musteriAdi: '', telefon: '', iletisimTarihi: ttBugunStr(), hizmetTipi,
  odaSayisi: '', esyaCinsi: '',
  yukIl: 'İstanbul (Anadolu)', yukIlce: '', yukAdres: '', yukKat: '', yukTasima: '', yukMesafe: '',
  bosIl: 'İstanbul (Anadolu)', bosIlce: '', bosAdres: '', bosKat: '', bosTasima: '', bosMesafe: '',
  rota: null, // YENİ: 4 noktalı km hesabı (ilçe merkezleri)
  toplama: '', depoBoyutu: '', kiralamaSuresi: '1', sube: 'Farketmez', nakliyeIstiyor: '',
  tasinmaTarihi: '', tasinmaNotu: '', videoDurumu: 'Paylaşmadı',
  verilenFiyat: '', takipTarihi: '', durum: 'Yeni', aciklama: '', havuzKayitId: '',
});

// Hizmete göre soru akışı. Depoda "firma alsın" seçilirse nakliye soruları eklenir.
const ttAdimListesi = (f) => {
  const s = [{ id: 'musteri', baslik: 'Müşteri & Hizmet' }];
  if (f.hizmetTipi === 'Nakliye') {
    s.push(
      { id: 'oda',      baslik: 'Eviniz kaç odalı?', soru: true },
      { id: 'guzergah', baslik: 'Nereden nereye taşınacak?', soru: true },
      { id: 'kat',      baslik: 'Evler kaçıncı katta?', soru: true },
      { id: 'asansor',  baslik: 'Bina içi asansör durumu nedir?', soru: true },
      { id: 'toplama',  baslik: 'Küçük eşyaları kim toplayacak?', soru: true },
      { id: 'yanasma',  baslik: 'Kamyon iki adreste de yanaşabiliyor mu?', soru: true },
      { id: 'tarih',    baslik: 'Ne zaman taşınmayı düşünüyorsunuz?', soru: true },
    );
  } else if (f.hizmetTipi === 'Depo') {
    s.push(
      { id: 'cins',    baslik: 'Depolanacak eşya nedir?', soru: true },
      { id: 'boyut',   baslik: 'Kaç artı bir evin eşyası?', soru: true },
      { id: 'konum',   baslik: 'Eşyalarınız şu an nerede?', soru: true },
      { id: 'nakliye', baslik: 'Eşyalar depoya nasıl ulaşsın?', soru: true },
    );
    // Nakliye soruları yalnızca müşteri nakliyeyi BİZDEN isterse sorulur (kılavuz kuralı)
    if (f.nakliyeIstiyor === 'Firma') {
      s.push(
        { id: 'kat',     baslik: 'Kaçıncı kattan alınacak?', soru: true, ek: true },
        { id: 'asansor', baslik: 'Binada asansör durumu nedir?', soru: true, ek: true },
        { id: 'toplama', baslik: 'Küçük eşyaları kim koliyecek?', soru: true, ek: true },
        { id: 'yanasma', baslik: 'Araç binaya yanaşabiliyor mu?', soru: true, ek: true },
      );
    }
    s.push({ id: 'tarih', baslik: 'Bu işlemi ne zaman düşünüyorsunuz?', soru: true });
  } else {
    s.push(
      { id: 'cikisDepo', baslik: 'Eşyalar hangi depomuzda?', soru: true },
      { id: 'guzergah',  baslik: 'Nereye teslim edilecek?', soru: true },
      { id: 'kat',       baslik: 'Yeni ev kaçıncı katta?', soru: true },
      { id: 'asansor',   baslik: 'Yeni binada asansör durumu?', soru: true },
      { id: 'yanasma',   baslik: 'Araç binaya yanaşabiliyor mu?', soru: true },
      { id: 'tarih',     baslik: 'Çıkış ne zaman?', soru: true },
    );
  }
  s.push({ id: 'sonuc', baslik: 'Fiyat, Video & Takip' });
  return s;
};

// Bir adımda hangi adreslerin sorulacağı: yük / boş
const ttAdimRolleri = (f) => (f.hizmetTipi === 'Nakliye' ? ['yuk', 'bos'] : f.hizmetTipi === 'Depo' ? ['yuk'] : ['bos']);
const TT_ROL_ETIKET = { yuk: { ad: 'Yükleme (mevcut ev)', renk: 'text-green-700', zemin: 'border-green-200 bg-green-50/40' }, bos: { ad: 'Boşaltma (yeni ev)', renk: 'text-red-700', zemin: 'border-red-200 bg-red-50/40' } };

// Adım cevaplandı mı? (sol listede ✓ ve otomatik ilerleme için)
const ttAdimTamam = (f, id) => {
  const r = ttAdimRolleri(f);
  switch (id) {
    case 'musteri':   return !!(f.musteriAdi.trim() || ttTelGecerli(f.telefon));
    case 'oda':       return !!f.odaSayisi;
    case 'guzergah':  return f.hizmetTipi === 'Nakliye' ? !!(f.yukIl && f.bosIl && (f.yukIlce || f.bosIlce)) : !!(f.bosIl && f.bosIlce);
    case 'konum':     return !!(f.yukIl && f.yukIlce);
    case 'kat':       return r.every(x => f[`${x}Kat`]);
    case 'asansor':   return r.every(x => f[`${x}Tasima`]);
    case 'yanasma':   return r.every(x => f[`${x}Mesafe`] !== '' && f[`${x}Mesafe`] !== undefined);
    case 'toplama':   return !!f.toplama;
    case 'tarih':     return !!(f.tasinmaTarihi || f.tasinmaNotu);
    case 'cins':      return !!f.esyaCinsi;
    case 'boyut':     return !!f.depoBoyutu;
    case 'nakliye':   return !!f.nakliyeIstiyor;
    case 'cikisDepo': return !!(f.sube && f.sube !== 'Farketmez' && f.depoBoyutu);
    default:          return false;
  }
};

// ============================================================================
// YENİ (kullanıcı talebi): HIZLI TEKLİF → TELEFON TEKLİFİ DÖNÜŞÜMÜ
// ----------------------------------------------------------------------------
// Web sihirbazının özet metni (teklifOzetiAyristir) okunur ve cevaplar
// sihirbaz alanlarına EN İYİ TAHMİNLE yazılır: oda / depo boyutu, kiralama
// süresi, şube, teslim şekli, il/ilçe, kat, asansör, paketleme, tarih.
// Eşleşmeyen bilgi boş kalır; satışçı telefonda tamamlar. Ham metin de
// açıklamaya eklenir — hiçbir bilgi kaybolmaz.
// ============================================================================
const ttKucuk = (v) => String(v || '').toLocaleLowerCase('tr-TR');
const ttIlIlceAyristir = (metin) => {
  const [ilHam = '', ilceHam = ''] = String(metin || '').split('/').map(x => x.trim());
  let il = '';
  if (ttKucuk(ilHam).includes('istanbul')) il = TURKEY_LOCATIONS['İstanbul (Avrupa)']?.some(x => ttKucuk(x) === ttKucuk(ilceHam)) ? 'İstanbul (Avrupa)' : 'İstanbul (Anadolu)';
  else il = PROVINCES.find(x => ttKucuk(x) === ttKucuk(ilHam)) || '';
  const ilce = il ? (ttIlceler(il).find(x => ttKucuk(x) === ttKucuk(ilceHam)) || '') : '';
  return { il, ilce };
};
const ttTarihAyristir = (metin) => {
  const m = String(metin || '').match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/) || String(metin || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { tasinmaTarihi: '', tasinmaNotu: metin ? String(metin).slice(0, 40) : '' };
  const [y, a, g] = m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  return { tasinmaTarihi: `${y}-${String(a).padStart(2, '0')}-${String(g).padStart(2, '0')}`, tasinmaNotu: '' };
};
const ttKatMetni = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? (n <= 0 ? 'Giriş Kat' : `${n}. Kat`) : ''; };
const ttTasimaMetni = (v) => { const k = ttKucuk(v); return !k ? '' : k.includes('dış') || k.includes('dis cephe') ? 'Dış Cephe Asansörü' : k.includes('merdiven') ? 'Merdiven' : k.includes('asansör') || k.includes('asansor') ? 'Bina Asansörü' : ''; };
const ttHavuzdanForm = (k) => {
  const hizmet = k.hizmetTipi === 'Depo' ? 'Depo' : 'Nakliye';
  const tel = ttTelGecerli(k.iletisim) ? k.iletisim : '';
  const ad = (k.musteriAdi || '').includes('Ziyaretçi') ? '' : (k.musteriAdi || '');
  const f = { ...ttBosForm(hizmet), musteriAdi: ad, telefon: tel, havuzKayitId: k.id, kaynak: k.kanal === 'web' ? 'Hızlı Teklif' : 'Müşteri Havuzu' };
  if (!k.sonMesaj) return f;
  const tk = teklifOzetiAyristir(k.sonMesaj);
  const al = (etiket) => tk.satirlar.find(x => ttKucuk(x.etiket) === ttKucuk(etiket))?.deger || '';
  const odaBul = (m) => { const e = String(m || '').match(/(\d)\s*\+\s*(\d)/); return e ? `${e[1]}+${e[2]}` : ''; };
  if (hizmet === 'Depo') {
    const boyut = al('Depo Boyutu');
    const m3 = parseInt((boyut.match(/(\d+)\s*m/) || [])[1], 10);
    f.depoBoyutu = ({ 10: '1+0', 15: '1+1', 22: '2+1', 30: '3+1' })[m3] || odaBul(boyut) || (m3 > 30 ? 'Özel' : '');
    const sure = ttKucuk(al('Kiralama Süresi'));
    f.kiralamaSuresi = /yıllık|12/.test(sure) ? '12' : /6/.test(sure) ? '6' : '1';
    const sube = ttKucuk(al('Şube'));
    f.sube = DEPO_LOCATIONS.find(d => sube && sube.includes(ttKucuk(d.district)))?.name || 'Farketmez';
    const teslim = ttKucuk(al('Teslim Şekli'));
    f.nakliyeIstiyor = /anahtar|firma|alım/.test(teslim) ? 'Firma' : /kendi/.test(teslim) ? 'Kendisi' : '';
    const yer = ttIlIlceAyristir(al('Eşyaların Alınacağı Yer') || al('Adres'));
    if (yer.il) { f.yukIl = yer.il; f.yukIlce = yer.ilce; }
    Object.assign(f, ttTarihAyristir(al('Başlangıç Tarihi') || al('Tarih')));
  } else {
    const tip = al('Tip');
    f.odaSayisi = ttKucuk(tip).includes('villa') ? 'Villa' : ttKucuk(tip).includes('ofis') ? 'Ofis' : (TT_ODA_SECENEKLERI.find(o => o.id === odaBul(tip))?.id || '');
    const [nereden, nereye] = (tk.ozet || '').split('→').map(x => x.trim());
    const y = ttIlIlceAyristir(nereden), b = ttIlIlceAyristir(nereye);
    if (y.il) { f.yukIl = y.il; f.yukIlce = y.ilce; }
    if (b.il) { f.bosIl = b.il; f.bosIlce = b.ilce; }
    const [katY, katB] = al('Kat').split('→').map(x => x.trim());
    f.yukKat = ttKatMetni(katY); f.bosKat = ttKatMetni(katB);
    f.yukTasima = ttTasimaMetni(al('Çıkış asansör')); f.bosTasima = ttTasimaMetni(al('Varış asansör'));
    const pk = ttKucuk(al('Paketleme'));
    f.toplama = /firma|biz|profesyonel/.test(pk) ? 'Firma' : /kendi/.test(pk) ? 'Müşteri' : '';
    Object.assign(f, ttTarihAyristir(al('Tarih')));
  }
  f.aciklama = `Web teklifi: ${k.sonMesaj.slice(0, 500)}`;
  return f;
};
// Havuz talebinden üretilen görüşmenin sabit belge kimliği (mükerrer kaydı önler)
const ttHavuzTeklifId = (havuzId) => `havuz_${havuzId}`;
// Firestore'a yazılacak telefon teklifi (sahibi: talebin satışçısı, yoksa aktaran kişi)
const ttHavuzdanTeklifVerisi = (k, kullanici) => {
  const f = ttHavuzdanForm(k);
  const h = ttFiyatHesapla(f);
  const sahip = k.atanan || kullanici;
  const simdi = new Date().toISOString();
  return {
    ...f, site: ttSiteOf(f.hizmetTipi), sistemFiyati: h.nakliyeToplam || 0, depoAylik: h.depo?.aylik || '',
    verilenFiyat: '', durum: TT_DURUMLAR.some(d => d.id === k.durum) ? k.durum : 'Yeni',
    notlar: k.notlar || [], surecAdimlari: {}, olusturan: kullanici, atanan: sahip, createdAt: simdi,
    hareketler: [{ tarih: simdi, kullanici, islem: `Müşteri Havuzu'ndan aktarıldı (${f.kaynak})` }],
  };
};

// DEĞİŞTİ (kullanıcı talebi): hizli=true → "Hızlı Fiyat Hesapla": müşteri bilgisi istenmez, kayıt YAPILMAZ;
// sorular ve fiyat motoru görüşme formuyla birebir aynıdır (tek kaynak).
const TelefonTeklifFormu = ({ baslangic = null, varsayilanHizmet = 'Nakliye', gecmisIndeksi = null, gonderen = '', onKaydet, onKapat, onWhatsappKaydi = null, currentUser = null, hizli = false }) => { // DEĞİŞTİ: currentUser (km servisi doğrulaması)
  const [waSablon, setWaSablon] = useState(null);          // YENİ: açık WhatsApp şablonu
  const [notSablonAcik, setNotSablonAcik] = useState(false); // YENİ (kullanıcı talebi): hazır not şablonları kapalı başlar
  const [form, setForm] = useState(() => ({ ...ttBosForm(varsayilanHizmet), ...(baslangic ? ttNormalize(baslangic) : {}), surum: 2 }));
  const [adimIdx, setAdimIdx] = useState(0);
  const [panel, setPanel] = useState('fiyat');            // Sağ panel sekmesi: fiyat | gecmis | rehber
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState('');
  const ilerleZamanlayici = useRef(null);

  // DEĞİŞTİ (kullanıcı talebi): 1-7 arası sorular AYRI AYRI adım değil, kayıt ekranına
  // benzer TEK SAYFADA toplanır. Soru listesi (ttAdimListesi) aynen korunur; yalnızca
  // soldaki kontrol listesi, numaralar ve tamamlandı (✓) işaretleri için kullanılır.
  const soruAdimlari = ttAdimListesi(form).filter(a => a.soru);
  const soruNumarasi = (id) => soruAdimlari.findIndex(a => a.id === id) + 1;
  const adimlar = [
    { id: 'musteri', baslik: hizli ? 'Hizmet' : 'Müşteri & Hizmet' },
    { id: 'sorular', baslik: `Görüşme Soruları (${soruAdimlari.length} soru · tek sayfa)` },
    { id: 'sonuc', baslik: 'Fiyat, Video & Takip' },
  ].filter(a => !hizli || a.id !== 'sonuc'); // hızlı modda Sonuç (video / takip / kayıt) bölümü yok
  // "Sorular" sayfası, içindeki tüm sorular cevaplanınca tamamlanmış sayılır
  const adimTamamMi = (id) => (id === 'sorular' ? soruAdimlari.every(a => ttAdimTamam(form, a.id)) : ttAdimTamam(form, id));
  // DEĞİŞTİ (kullanıcı talebi): adım adım ilerleme yok — tüm bölümler TEK SAYFADA alt alta.
  // Menüdeki tıklamalar sayfayı ilgili bölüme / soruya kaydırır.
  const soruyaGit = (id) => document.getElementById(`tt-soru-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const bolumeGit = (id) => document.getElementById(`tt-bolum-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const sayfaRef = useRef(null);
  // Kaydırdıkça hangi bölümde olunduğu (soldaki menüde vurgulanır)
  const kaydirmaTakip = () => {
    const kap = sayfaRef.current;
    if (!kap) return;
    let aktif = 0;
    adimlar.forEach((a, i) => { const el = document.getElementById(`tt-bolum-${a.id}`); if (el && el.offsetTop - kap.offsetTop <= kap.scrollTop + 120) aktif = i; });
    if (aktif !== adimIdx) setAdimIdx(aktif);
  };
  const adim = adimlar[Math.min(adimIdx, adimlar.length - 1)];
  const sorular = adimlar.filter(a => a.soru);
  const soruNo = sorular.findIndex(a => a === adim) + 1;
  const hz = ttHizmetBul(form.hizmetTipi);
  const S = hz.stil;
  const roller = ttAdimRolleri(form);
  const hesap = useMemo(() => ttFiyatHesapla(form), [form]);
  const gecmis = useMemo(() => musteriGecmisiBul(gecmisIndeksi, form.telefon, baslangic?.id || null), [gecmisIndeksi, form.telefon, baslangic]);

  // Alan güncelleyiciler
  const d = (alan) => (v) => setForm(f => ({ ...f, [alan]: v }));
  // YENİ (kullanıcı talebi): il/ilçe veya şube değişince 4 noktalı km OTOMATİK hesaplanır
  // (mod açıkken). Aynı noktalar için tekrar istek atılmaz (imza). Nokta eksilirse rota silinir.
  useEffect(() => {
    if (!mesafeModuAcik(TT_MESAFE)) return undefined;
    const noktalar = ttRotaNoktalari(form);
    if (!noktalar) { if (form.rota) setForm(f => ({ ...f, rota: null })); return undefined; }
    const imza = JSON.stringify(noktalar.map(n => n.adres));
    if (form.rota?.imza === imza) return undefined;
    const z = setTimeout(async () => {
      try { const r = await ttRotaHesapla(noktalar, currentUser); setForm(f => ({ ...f, rota: { ...r, imza } })); }
      catch (e) { setForm(f => ({ ...f, rota: { hata: e.message, imza } })); }
    }, 500);
    return () => clearTimeout(z);
  }, [form.yukIl, form.yukIlce, form.bosIl, form.bosIlce, form.sube, form.hizmetTipi, form.nakliyeIstiyor]); // eslint-disable-line react-hooks/exhaustive-deps
  const git = (i) => { clearTimeout(ilerleZamanlayici.current); const a = adimlar[Math.max(0, Math.min(i, adimlar.length - 1))]; if (a) bolumeGit(a.id); };
  const ileri = () => git(adimIdx + 1);
  const geri = () => git(adimIdx - 1);
  // Seç + (adım tamamlandıysa) kısa bir gecikmeyle otomatik sonraki soruya geç — satışçıyı hızlandırır
  const secIlerle = (alan, v) => {
    const sonraki = { ...form, [alan]: v };
    setForm(sonraki);
    clearTimeout(ilerleZamanlayici.current);
    if (ttAdimTamam(sonraki, adim.id)) ilerleZamanlayici.current = setTimeout(() => setAdimIdx(i => i + 1), 220);
  };
  useEffect(() => () => clearTimeout(ilerleZamanlayici.current), []);

  // Hizmet değişince sube/nakliye tercihi gibi hizmete özel alanlar makul varsayılana döner
  const hizmetSec = (id) => setForm(f => ({
    ...f, hizmetTipi: id,
    sube: id === 'Depodan Çıkış' ? (f.sube === 'Farketmez' ? '' : f.sube) : (f.sube || 'Farketmez'),
  }));

  const kaydet = async () => {
    if (!form.musteriAdi.trim() && !ttTelGecerli(form.telefon)) { setHata('Müşteri adı veya geçerli bir telefon numarası girin.'); git(0); return; }
    setHata(''); setKaydediliyor(true);
    try {
      const nakliyeVar = form.hizmetTipi !== 'Depo' || form.nakliyeIstiyor === 'Firma';
      await onKaydet({
        ...form,
        musteriAdi: form.musteriAdi.trim(), telefon: form.telefon.trim(),
        site: ttSiteOf(form.hizmetTipi),
        sistemFiyati: hesap.nakliyeToplam || 0,
        depoAylik: hesap.depo?.aylik || '',
        // DEĞİŞTİ (kullanıcı talebi): fiyat yazılmadıysa AÇILIŞ fiyatı (taban + %25) söylenmiş kabul edilir
        verilenFiyat: form.verilenFiyat || (nakliyeVar && hesap.nakliyeToplam ? String(ttAcilisFiyati(hesap.nakliyeToplam, form.hizmetTipi)) : ''),
        acilisFiyati: nakliyeVar && hesap.nakliyeToplam ? ttAcilisFiyati(hesap.nakliyeToplam, form.hizmetTipi) : 0,
      });
    } catch (e) { setHata('Kaydedilemedi: ' + (e?.message || 'bilinmeyen hata')); setKaydediliyor(false); }
  };

  const secimCls = `w-full px-3 py-3 rounded-xl border-2 border-neutral-300 bg-white text-base font-black text-neutral-900 outline-none focus:ring-2 ${S.halka}`;

  // ------------------------------------------------ ADIM İÇERİKLERİ ---
  // NOT: Bileşen DEĞİL düz fonksiyon — render içinde bileşen tanımlamak her tuşta
  // alt ağacı yeniden oluşturur ve yazılan kutu odağını kaybeder.
  const rolKutusu = (rol, children) => (
    <div key={rol} className={`rounded-2xl border-2 p-3 space-y-2 ${TT_ROL_ETIKET[rol].zemin}`}>
      <p className={`text-[11px] font-black uppercase ${TT_ROL_ETIKET[rol].renk}`}>
        {form.hizmetTipi === 'Depo' ? 'Eşyaların alınacağı adres' : form.hizmetTipi === 'Depodan Çıkış' ? 'Teslim adresi' : TT_ROL_ETIKET[rol].ad}
        {(form[`${rol}Ilce`] || form[`${rol}Il`]) && <span className="normal-case font-bold text-neutral-500"> · {ttAdresKisa(form[`${rol}Il`], form[`${rol}Ilce`])}</span>}
      </p>
      {children}
    </div>
  );
  const rollerIzgara = roller.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3 max-w-xl';

  const adimIcerigi = (bolumId = adim.id) => {   // DEĞİŞTİ: bölüm kimliği parametre olarak alınır
    switch (bolumId) {
      case 'musteri': return (
        <div className="space-y-4">
          {/* Hizmet seçimi — canlı renkli kartlar
              DEĞİŞTİ (kullanıcı talebi): kartlar ~%30 küçültüldü (dolgu, ikon, yazı boyutu) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {TT_HIZMETLER.map(h => {
              const secili = form.hizmetTipi === h.id;
              return (
                <button key={h.id} type="button" onClick={() => hizmetSec(h.id)}
                  className={`px-2.5 py-2 rounded-xl border-2 text-left transition ${secili ? h.stil.secili : h.stil.pasif}`}>
                  <span className="flex items-center gap-1.5">
                    <h.Ikon className="w-3.5 h-3.5" />
                    <span className={`text-[8px] font-black px-1 py-px rounded ${secili ? 'bg-white/20' : h.stil.acik + ' border'}`}>{h.marka}</span>
                  </span>
                  <span className="block text-xs font-black mt-1 leading-tight">{h.ad}</span>
                  <span className={`block text-[9px] font-bold leading-tight truncate ${secili ? 'text-white/80' : 'text-neutral-500'}`} title={h.alt}>{h.alt}</span>
                </button>
              );
            })}
          </div>
          {/* YENİ: hızlı modda müşteri bilgisi alanları gösterilmez */}
          {hizli ? (
            <p className="text-[11px] font-bold text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">Hizmeti seçin, ardından aşağıdaki soruları cevaplayın — sağdaki <b>Sistem Fiyatı</b> anında hesaplanır. Müşteri bilgisi gerekmez, hiçbir şey kaydedilmez.</p>
          ) : (<>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-black uppercase text-neutral-500 mb-1">Müşteri Adı</span>
              <input autoFocus value={form.musteriAdi} onChange={e => d('musteriAdi')(e.target.value)} placeholder="Örn. Sefa Bey"
                className={`w-full px-3 py-3 rounded-xl border-2 border-neutral-300 text-base font-bold outline-none focus:ring-2 ${S.halka}`} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-black uppercase text-neutral-500 mb-1">Telefon</span>
              <input value={form.telefon} onChange={e => d('telefon')(e.target.value)} placeholder="05XX XXX XX XX" inputMode="tel"
                className={`w-full px-3 py-3 rounded-xl border-2 border-neutral-300 text-base font-bold outline-none focus:ring-2 ${S.halka}`} />
              {form.telefon && !ttTelGecerli(form.telefon) && <span className="block text-[10px] font-bold text-amber-600 mt-1">Numara 10 hane olmalı (başında 0 olsun/olmasın fark etmez)</span>}
            </label>
          </div>
          <p className="text-[11px] font-bold text-neutral-500 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Görüşme tarihi otomatik: <b className="text-neutral-800">{ttTrTarih(form.iletisimTarihi)}</b>
            <input type="date" value={form.iletisimTarihi} onChange={e => d('iletisimTarihi')(e.target.value)} className="ml-1 px-2 py-0.5 rounded-lg border border-neutral-200 text-[11px]" />
          </p>
          {/* Numara yazılır yazılmaz geçmiş kontrol edilir */}
          {gecmis && <MusteriGecmisiKutusu gecmis={gecmis} ad={form.musteriAdi} />}
          </>)}
        </div>
      );
      case 'oda': return (
        <div className="max-w-md space-y-2">
          <select value={form.odaSayisi} onChange={e => secIlerle('odaSayisi', e.target.value)} className={secimCls}>
            <option value="">Ev tipi seçin…</option>
            {TT_ODA_SECENEKLERI.map(o => <option key={o.id} value={o.id}>{o.ad}</option>)}
          </select>
          <p className="text-[11px] font-bold text-neutral-500">Kayıt ekranındaki "Daire Tipi" ile aynıdır.</p>
        </div>
      );
      case 'guzergah': return (
        <div className="space-y-3">{/* DEĞİŞTİ: altına 4 noktalı km kartı eklendi */}
          <div className={rollerIzgara}>
            {roller.map(r => rolKutusu(r, <>
                <TTIlIlce il={form[`${r}Il`]} ilce={form[`${r}Ilce`]} adres={form[`${r}Adres`]} halka={S.halka}
                  onIl={d(`${r}Il`)} onIlce={d(`${r}Ilce`)} onAdres={d(`${r}Adres`)} />
              </>))}
          </div>
          <TTRotaKarti form={form} setForm={setForm} kullanici={currentUser} />
        </div>
      );
      case 'konum': return (
        <div className="space-y-3">{/* DEĞİŞTİ: altına 4 noktalı km kartı eklendi */}
          <div className={rollerIzgara}>
            {rolKutusu('yuk', <>
              <TTIlIlce il={form.yukIl} ilce={form.yukIlce} adres={form.yukAdres} halka={S.halka} onIl={d('yukIl')} onIlce={d('yukIlce')} onAdres={d('yukAdres')} />
            </>)}
          </div>
          <TTRotaKarti form={form} setForm={setForm} kullanici={currentUser} />
        </div>
      );
      case 'kat': return (
        <div className={rollerIzgara}>
          {roller.map(r => rolKutusu(r, <>
              <select value={form[`${r}Kat`]} onChange={e => secIlerle(`${r}Kat`, e.target.value)} className={secimCls}>
                <option value="">Kat seçin…</option>
                {FLOORS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </>))}
        </div>
      );
      case 'asansor': return (
        <div className={rollerIzgara}>
          {roller.map(r => rolKutusu(r, <>
              {TT_TASIMA.map(o => (
                <TTSecimKarti key={o.id} secili={form[`${r}Tasima`] === o.id} onClick={() => secIlerle(`${r}Tasima`, o.id)} baslik={o.ad} alt={o.alt} stil={S} />
              ))}
            </>))}
        </div>
      );
      case 'yanasma': return (
        <div className={rollerIzgara}>
          {roller.map(r => rolKutusu(r, <>
              {TT_YANASMA.map(o => (
                <TTSecimKarti key={o.id} secili={form[`${r}Mesafe`] === o.id} onClick={() => secIlerle(`${r}Mesafe`, o.id)} baslik={o.ad} stil={S} />
              ))}
            </>))}
        </div>
      );
      case 'toplama': return (
        <div className="max-w-xl space-y-2">
          {TT_TOPLAMA.map(o => <TTSecimKarti key={o.id} secili={form.toplama === o.id} onClick={() => secIlerle('toplama', o.id)} baslik={o.ad} alt={o.alt} stil={S} />)}
          <p className="text-[11px] font-bold text-neutral-500">Toplama alınsa bile yeni adreste kolilerin açılıp yerleştirilmesi hizmeti yoktur.</p>
        </div>
      );
      case 'tarih': return (
        <div className="max-w-xl space-y-3">
          <input type="date" value={form.tasinmaTarihi} onChange={e => d('tasinmaTarihi')(e.target.value)} className={secimCls} />
          <div className="flex flex-wrap gap-1.5">
            {['Bu hafta', 'Hafta sonu', 'Ay başı', 'Ay ortası', 'Ay sonu', '10 gün içinde', 'Belirsiz'].map(n => (
              <button key={n} type="button" onClick={() => d('tasinmaNotu')(form.tasinmaNotu === n ? '' : n)}
                className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition ${form.tasinmaNotu === n ? S.secili : S.pasif}`}>{n}</button>
            ))}
          </div>
          <input value={form.tasinmaNotu} onChange={e => d('tasinmaNotu')(e.target.value)} placeholder="Serbest not: örn. 15 Ekim'den sonra, kiracı çıkınca"
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-semibold outline-none" />
          {form.hizmetTipi === 'Nakliye' && <p className="text-[11px] font-bold text-neutral-500">Tarih belirsizse de fiyatı bugünden verin ve kaydı alın — tarih netleşince ilk aranan firma siz olursunuz.</p>}
        </div>
      );
      case 'cins': return (
        <div className="max-w-xl space-y-2">
          {TT_ESYA_CINSI.map(o => <TTSecimKarti key={o.id} secili={form.esyaCinsi === o.id} onClick={() => secIlerle('esyaCinsi', o.id)} baslik={o.ad} alt={o.alt} stil={S} />)}
        </div>
      );
      case 'boyut': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {TT_DEPO_BOYUTLARI.map(b => {
              const secili = form.depoBoyutu === b.id;
              return (
                <button key={b.id} type="button" onClick={() => d('depoBoyutu')(b.id)}
                  className={`p-3 rounded-2xl border-2 text-left transition ${secili ? S.secili : S.pasif}`}>
                  <span className="block text-base font-black">{b.id} Depo</span>
                  <span className={`block text-[10px] font-bold ${secili ? 'text-white/80' : 'text-neutral-500'}`}>{b.m3 ? `${b.m3} m³ · ${b.olcu}` : b.olcu}</span>
                  {/* Aylık fiyat HEMEN görünür — kılavuz: "ilk 30 saniyede fiyatı söyle" */}
                  <span className="block text-sm font-black mt-1">{ttDepoAylik(form.sube, b.id) && b.aylik ? `${ttTl(ttDepoAylik(form.sube, b.id))} +KDV/ay` : 'Video ile'}</span>
                </button>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Kiralama Süresi</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TT_KIRALAMA.map(k => <TTSecimKarti key={k.id} secili={form.kiralamaSuresi === k.id} onClick={() => d('kiralamaSuresi')(k.id)} baslik={k.ad} alt={k.odenecekAy > 1 ? `${k.odenecekAy} ay öde, ${k.toplamAy} ay kullan · kredi kartı geçer` : 'Taahhüt yok, IBAN ile aylık'} stil={S} />)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Şube Tercihi</p>
            <div className="flex flex-wrap gap-1.5">
              {TT_SUBELER.map(sb => (
                <button key={sb} type="button" onClick={() => d('sube')(sb)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition ${form.sube === sb ? S.secili : S.pasif}`}>{sb.replace(' Depoevim', '')}</button>
              ))}
            </div>
          </div>
        </div>
      );
      case 'nakliye': return (
        <div className="max-w-xl space-y-2">
          {TT_NAKLIYE_TERCIHI.map(o => <TTSecimKarti key={o.id} secili={form.nakliyeIstiyor === o.id} onClick={() => secIlerle('nakliyeIstiyor', o.id)} baslik={o.ad} alt={o.alt} stil={S} />)}
          <p className="text-[11px] font-bold text-neutral-500">Nakliyeyi zorlamadan önerin. Firma seçilirse kat, asansör, kolileme ve yanaşma soruları açılır.</p>
        </div>
      );
      case 'cikisDepo': return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {DEPO_LOCATIONS.map(sb => (
              <button key={sb.name} type="button" onClick={() => d('sube')(sb.name)}
                className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition ${form.sube === sb.name ? S.secili : S.pasif}`}>{sb.name.replace(' Depoevim', '')}</button>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Depo boyutu (eşya hacmi)</p>
            <div className="flex flex-wrap gap-1.5">
              {TT_DEPO_BOYUTLARI.map(b => (
                <button key={b.id} type="button" onClick={() => secIlerle('depoBoyutu', b.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition ${form.depoBoyutu === b.id ? S.secili : S.pasif}`}>{b.id}{b.m3 ? ` · ${b.m3} m³` : ''}</button>
              ))}
            </div>
          </div>
        </div>
      );
      case 'sorular': {
        // Kayıt ekranı düzeni: açılır listeler + başlıklı bilgi kartları.
        // Değerler kayıt ekranıyla aynı (Daire Tipi, Kat, Taşıma Şekli, Mesafe, Eşya Durumu, İl/İlçe).
        const kSec = `w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm font-bold text-neutral-900 outline-none focus:ring-2 ${S.halka}`;
        const alan = (soruId, etiket, icerik, cls = '') => {
          const no = soruNumarasi(soruId);
          const tamam = no > 0 && ttAdimTamam(form, soruId);
          return (
            <div id={soruId ? `tt-soru-${soruId}` : undefined} className={cls}>
              <label className="flex items-center gap-1.5 text-xs font-black text-neutral-800 mb-1 whitespace-nowrap overflow-hidden" title={no ? soruAdimlari[no - 1].baslik : ''}>
                {no > 0 && <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center shrink-0 ${tamam ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>{tamam ? '✓' : no}</span>}
                {etiket}
              </label>
              {icerik}
            </div>
          );
        };
        const secim = (alanAdi, secenekler, ilk) => (
          <select value={form[alanAdi] || ''} onChange={e => d(alanAdi)(e.target.value)} className={kSec}>
            <option value="">{ilk}</option>
            {secenekler.map(o => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.ad}</option>))}
          </select>
        );
        // Bilgi kartı — kayıt ekranındaki "YÜKLEME BİLGİLERİ (1. ADRES)" başlığı gibi
        const kart = (baslik, Ikon, renk, icerik) => (
          <div className={`rounded-2xl border ${renk.kenar} bg-white overflow-hidden`}>
            <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${renk.baslik}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${renk.ikon}`}><Ikon className="w-4 h-4" /></span>
              <span className="text-xs font-black uppercase tracking-wide text-neutral-900">{baslik}</span>
            </div>
            <div className="p-4 space-y-3">{icerik}</div>
          </div>
        );
        const KIRMIZI = { kenar: 'border-red-100', baslik: 'bg-red-50/60 border-red-100', ikon: 'bg-red-600' };
        const MAVI = { kenar: 'border-blue-100', baslik: 'bg-blue-50/60 border-blue-100', ikon: 'bg-blue-600' };
        const MOR = { kenar: 'border-violet-100', baslik: 'bg-violet-50/60 border-violet-100', ikon: 'bg-violet-600' };
        // Adres kartı (yükleme / boşaltma / teslim): Kat · Taşıma Şekli · Mesafe, İl/İlçe, Açık adres
        const adresAlanlari = (r, guzergahSoru, nakliyeSorulari = true) => (<>
          {nakliyeSorulari && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {alan('kat', 'Kat', secim(`${r}Kat`, FLOORS, 'Kat seçin…'))}
              {alan('asansor', 'Taşıma Şekli', secim(`${r}Tasima`, TT_TASIMA.map(o => ({ id: o.id, ad: o.id })), 'Seçin…'))}
              {alan('yanasma', r === 'yuk' ? 'Yükleme Mesafesi' : 'Boşaltma Mesafesi', secim(`${r}Mesafe`, TT_YANASMA, 'Araç yanaşıyor mu?'))}
            </div>
          )}
          {alan(guzergahSoru, 'İl · İlçe · Açık Adres',
            <TTIlIlce il={form[`${r}Il`]} ilce={form[`${r}Ilce`]} adres={form[`${r}Adres`]} halka={S.halka} onIl={d(`${r}Il`)} onIlce={d(`${r}Ilce`)} onAdres={d(`${r}Adres`)} />)}
        </>);
        // DEĞİŞTİ (kullanıcı talebi): hızlı tarih seçenekleri (Bu hafta, Ay sonu…) düğme yerine
        // AÇILIR LİSTE; tarih ve tercih iki ayrı sütun olarak aynı satırda durur.
        const TARIH_TERCIHLERI = ['Bu hafta', 'Hafta sonu', 'Ay başı', 'Ay ortası', 'Ay sonu', '10 gün içinde', 'Belirsiz'];
        const tarihAlani = (etiket) => (<>
          {alan('tarih', etiket, <input type="date" value={form.tasinmaTarihi} onChange={e => d('tasinmaTarihi')(e.target.value)} className={kSec} />)}
          {alan(null, 'Tarih Tercihi', (
            <select value={form.tasinmaNotu || ''} onChange={e => d('tasinmaNotu')(e.target.value)} className={kSec}>
              <option value="">Tarih tercihi seçin…</option>
              {TARIH_TERCIHLERI.map(n => <option key={n} value={n}>{n}</option>)}
              {/* Eski kayıtlardaki serbest not kaybolmasın */}
              {form.tasinmaNotu && !TARIH_TERCIHLERI.includes(form.tasinmaNotu) && <option value={form.tasinmaNotu}>{form.tasinmaNotu}</option>}
            </select>
          ))}
        </>);
        // Yükleme ↔ boşaltma adreslerini yer değiştir (kayıt ekranındaki ⇅ düğmesi gibi)
        const adresleriDegistir = () => setForm(f => {
          const x = { ...f };
          ['Il', 'Ilce', 'Adres', 'Kat', 'Tasima', 'Mesafe'].forEach(k => { x[`yuk${k}`] = f[`bos${k}`]; x[`bos${k}`] = f[`yuk${k}`]; });
          return x;
        });

        if (form.hizmetTipi === 'Nakliye') return (
          <div className="space-y-4">
            {kart('Taşınma Bilgileri', Truck, KIRMIZI, (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {alan('oda', 'Daire Tipi', secim('odaSayisi', TT_ODA_SECENEKLERI, 'Ev tipi seçin…'))}
                {alan('toplama', 'Eşya Durumu', secim('toplama', TT_TOPLAMA, 'Küçük eşya toplama…'))}
                {tarihAlani('Taşınma Tarihi')}
              </div>
            ))}
            {kart('Yükleme Bilgileri (Mevcut Ev)', ArrowUpRight, KIRMIZI, adresAlanlari('yuk', 'guzergah'))}
            <div className="flex justify-center -my-2 relative z-10">
              <button type="button" onClick={adresleriDegistir} title="Yükleme ve boşaltma adreslerini yer değiştir"
                className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-lg hover:bg-black"><ArrowUpDown className="w-4 h-4" /></button>
            </div>
            {kart('Boşaltma Bilgileri (Yeni Ev)', MapPin, KIRMIZI, adresAlanlari('bos', 'guzergah'))}
          </div>
        );
        if (form.hizmetTipi === 'Depo') return (
          <div className="space-y-4">
            {kart('Depo Bilgileri', Package, MAVI, (<>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {alan('cins', 'Eşya Cinsi', secim('esyaCinsi', TT_ESYA_CINSI, 'Seçin…'))}
                {alan('boyut', 'Depo Boyutu (kaç+1)', secim('depoBoyutu', TT_DEPO_BOYUTLARI.map(b => ({ id: b.id,
                  ad: `${b.id} Depo${b.m3 ? ` · ${b.m3} m³` : ''}${ttDepoAylik(form.sube, b.id) && b.aylik ? ` · ${ttTl(ttDepoAylik(form.sube, b.id))} +KDV/ay` : ' · video ile'}` })), 'Depo boyutu seçin…'))}
                {alan(null, 'Kiralama Süresi', secim('kiralamaSuresi', TT_KIRALAMA, 'Seçin…'))}
                {alan(null, 'Şube Tercihi', secim('sube', TT_SUBELER, 'Seçin…'))}
                {alan('nakliye', 'Eşyalar depoya nasıl ulaşsın?', secim('nakliyeIstiyor', TT_NAKLIYE_TERCIHI, 'Seçin…'))}
                {tarihAlani('Depoya Giriş Tarihi')}
              </div>
            </>))}
            {kart(form.nakliyeIstiyor === 'Firma' ? 'Yükleme Bilgileri (Eşyaların Alınacağı Adres)' : 'Eşyaların Bulunduğu Yer', ArrowUpRight, MAVI, (<>
              {adresAlanlari('yuk', 'konum', form.nakliyeIstiyor === 'Firma')}
              {form.nakliyeIstiyor === 'Firma' && alan('toplama', 'Eşya Durumu', secim('toplama', TT_TOPLAMA, 'Küçük eşya toplama…'), 'sm:max-w-sm')}
              {form.nakliyeIstiyor !== 'Firma' && <p className="text-[11px] font-bold text-neutral-500">Firma alımı seçilirse kat, taşıma şekli, mesafe ve toplama soruları burada açılır.</p>}
            </>))}
          </div>
        );
        return (
          <div className="space-y-4">
            {kart('Depo Bilgileri (Çıkış)', Package, MOR, (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {alan('cikisDepo', 'Eşyaların Bulunduğu Depo', secim('sube', DEPO_LOCATIONS.map(x => x.name), 'Depo seçin…'))}
                {alan('cikisDepo', 'Depo Boyutu', secim('depoBoyutu', TT_DEPO_BOYUTLARI.map(b => ({ id: b.id, ad: `${b.id}${b.m3 ? ` · ${b.m3} m³` : ''}` })), 'Seçin…'))}
                {tarihAlani('Çıkış Tarihi')}
              </div>
            ))}
            {kart('Boşaltma Bilgileri (Teslim Adresi)', MapPin, MOR, adresAlanlari('bos', 'guzergah'))}
          </div>
        );
      }
      case 'sonuc': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Video Durumu</p>
            <div className="flex flex-wrap gap-1.5">
              {TT_VIDEO.map(v => (
                <button key={v} type="button" onClick={() => {
                  d('videoDurumu')(v);
                  // YENİ (kullanıcı talebi): video bekleniyorsa durum otomatik "Dönüş Bekliyoruz"
                  if (v === 'Bekleniyor') d('durum')('Dönüş Bekliyor');
                }}
                  className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition ${form.videoDurumu === v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-800 border-sky-200 hover:border-sky-500'}`}>{v}</button>
              ))}
            </div>
          </div>
          {(form.hizmetTipi !== 'Depo' || form.nakliyeIstiyor === 'Firma') && (
            <div className="space-y-3">
              {/* DEĞİŞTİ (kullanıcı talebi): sistem fiyatı TABAN; açılış = taban + %25 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-neutral-900 text-white p-3">
                  <p className="text-[10px] font-black uppercase text-neutral-400">Taban fiyat (sistem · en alt)</p>
                  <p className="text-2xl font-black text-yellow-400">{hesap.nakliyeToplam ? ttTl(hesap.nakliyeToplam) : '—'}</p>
                  <p className="text-[10px] font-bold text-neutral-400">{hesap.liste}</p>
                </div>
                <div className="rounded-2xl bg-emerald-700 text-white p-3">
                  <p className="text-[10px] font-black uppercase text-emerald-100">Açılış fiyatı (+%{ttAcilisYuzde(form.hizmetTipi)}) · müşteriye ilk söylenecek</p>
                  <p className="text-2xl font-black">{hesap.nakliyeToplam ? ttTl(ttAcilisFiyati(hesap.nakliyeToplam, form.hizmetTipi)) : '—'}</p>
                  <p className="text-[10px] font-bold text-emerald-100">Pazarlıkta tabana kadar iskonto yapabilirsiniz</p>
                </div>
              </div>
              {hesap.nakliyeToplam > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">İskonto seçenekleri — tıklayınca söylenen fiyata yazılır</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ttIskontoKademeleri(hesap.nakliyeToplam, form.hizmetTipi).map(k => {
                      const secili = ttFiyatSayi(form.verilenFiyat) === k.tutar;
                      return (
                        <button key={k.ad} type="button" onClick={() => d('verilenFiyat')(String(k.tutar))}
                          className={`px-3 py-2 rounded-xl border-2 text-left transition ${secili ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-400'}`}>
                          <span className="block text-sm font-black leading-tight">{ttTl(k.tutar)}</span>
                          <span className={`block text-[10px] font-bold ${secili ? 'text-white/70' : 'text-neutral-500'}`}>{k.ad} · {k.not}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <label className="block">
                <span className="block text-[10px] font-black uppercase text-neutral-500 mb-1">Müşteriye söylenen fiyat (₺)</span>
                <input value={form.verilenFiyat} onChange={e => d('verilenFiyat')(e.target.value)} inputMode="numeric"
                  placeholder={hesap.nakliyeToplam ? `Boş bırakılırsa açılış fiyatı ${ttTl(ttAcilisFiyati(hesap.nakliyeToplam, form.hizmetTipi))}` : 'Örn. 32000'}
                  className={`w-full px-3 py-3 rounded-xl border-2 border-neutral-300 text-base font-black outline-none focus:ring-2 ${S.halka}`} />
                {/* Tabanın altı uyarısı */}
                {hesap.nakliyeToplam > 0 && ttFiyatSayi(form.verilenFiyat) > 0 && ttFiyatSayi(form.verilenFiyat) < hesap.nakliyeToplam && (
                  <span className="mt-1 text-[11px] font-black text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Taban fiyatın ({ttTl(hesap.nakliyeToplam)}) altında! Ek iskonto için Mehmet Bey'e danışın.
                  </span>
                )}
              </label>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              {/* Takip opsiyoneldir (kullanıcı talebi) */}
              <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Takip — tekrar arama (opsiyonel)</p>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {[['Yarın', 1], ['3 gün sonra', 3], ['1 hafta sonra', 7], ['2 hafta sonra', 14], ['1 ay sonra', 30]].map(([ad, g]) => {
                  const hedef = ttGunEkle(ttBugunStr(), g);
                  return (
                    <button key={ad} type="button" onClick={() => {
                      const yeni = form.takipTarihi === hedef ? '' : hedef;
                      d('takipTarihi')(yeni);
                      // YENİ (kullanıcı talebi): tekrar arama tarihi seçilince durum "Tekrar Aranacak"
                      if (yeni) d('durum')('Tekrar Aranacak');
                    }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition ${form.takipTarihi === hedef ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-800 border-orange-200 hover:border-orange-400'}`}>{ad}</button>
                  );
                })}
              </div>
              <input type="date" value={form.takipTarihi} onChange={e => { d('takipTarihi')(e.target.value); if (e.target.value) d('durum')('Tekrar Aranacak'); }} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-bold" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Görüşme Durumu</p>
              <div className="flex flex-wrap gap-1.5">
                {TT_SECILEBILIR_DURUMLAR.map(s => (
                  <button key={s.id} type="button" onClick={() => d('durum')(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border flex items-center gap-1.5 transition ${form.durum === s.id ? `${s.rozet} ring-2 ring-neutral-900 ring-offset-1` : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.nokta}`} /> {s.etiket}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* DEĞİŞTİ (kullanıcı talebi): "Açıklama" yerine GÖRÜŞME NOTU + hazır şablonlar.
              Yazılan not kaydedilince notlara eklenir ve görüşme listesinde görünür.
              KALDIRILDI: "Cevap Özeti" bölümü (sol taraftaki soru listesi zaten gösteriyor). */}
          <div className="rounded-2xl border-2 border-yellow-200 bg-yellow-50/60 p-3 space-y-2">
            <p className="text-[11px] font-black uppercase text-yellow-900 flex items-center gap-1.5"><StickyNote className="w-4 h-4" /> Görüşme Notu</p>
            {/* Daha önce girilmiş notlar (düzenlemede) */}
            {ttSonNot(form).slice(0, 3).map((n, i) => (
              <div key={i} className="bg-white border border-yellow-100 rounded-lg px-2.5 py-1.5">
                <p className="text-xs font-semibold text-neutral-800">{n.metin}</p>
                <p className="text-[10px] font-bold text-neutral-400">{n.kullanici} · {new Date(n.tarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            ))}
            <textarea value={form.yeniNot || ''} onChange={e => d('yeniNot')(e.target.value)} rows={3}
              placeholder="Görüşme notu — örn. müşteri ile görüşüldü, yakını için düşünüyor, dönüş bekliyoruz"
              className="w-full px-3 py-2.5 rounded-xl border border-yellow-200 bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-yellow-400" />
            <div>
              {/* DEĞİŞTİ (kullanıcı talebi): açılır bölüm — seçenekler tıklayınca görünür */}
              <button type="button" onClick={() => setNotSablonAcik(a => !a)} aria-expanded={notSablonAcik}
                className="w-full flex items-center gap-1.5 text-left text-[10px] font-black uppercase text-yellow-800 hover:text-yellow-900">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${notSablonAcik ? 'rotate-180' : ''}`} />
                Hazır Şablonlar — tıklayınca nota eklenir
                <span className="ml-auto normal-case font-bold text-yellow-700">{notSablonAcik ? 'Gizle' : `${ttNotSablonlari(form.hizmetTipi).length} şablon · Göster`}</span>
              </button>
              {notSablonAcik && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1">
                  {ttNotSablonlari(form.hizmetTipi).map(sb => (
                    <button key={sb} type="button" onClick={() => d('yeniNot')((form.yeniNot || '').trim() ? `${form.yeniNot.trim()} ${sb}` : sb)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-yellow-300 hover:bg-yellow-100 text-[11px] font-bold text-neutral-700 text-left transition">{sb}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  // ================================================================ RENDER ===
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-3 md:p-4">
      <div className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[100dvh] sm:h-[calc(100dvh-1.5rem)] md:h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* BAŞLIK — hizmet rengiyle */}
        <div className={`shrink-0 px-4 md:px-5 py-3 text-white flex items-center justify-between gap-2 ${S.serit}`}>
          <div className="min-w-0 flex items-center gap-3">
            <hz.Ikon className="w-6 h-6 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base md:text-lg font-black truncate">{hizli ? `Hızlı Fiyat Hesapla — ${hz.ad}` : baslangic?.id ? (baslangic.kaynak && !baslangic.updatedAt ? `${baslangic.kaynak} → Telefon Görüşmesi` : 'Görüşmeyi Düzenle') : 'Yeni Telefon Görüşmesi'} — {hz.ad}</h3>
              <p className="text-[11px] font-bold text-white/80 truncate">{hizli ? 'Müşteri bilgisi yok · kayıt yapılmaz · yalnızca fiyat' : `${form.musteriAdi || 'Müşteri'}${form.telefon ? ` · ${ttTelGoster(form.telefon)}` : ''}`}</p>
            </div>
          </div>
          <button type="button" onClick={onKapat} className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
        </div>
        {/* İlerleme çubuğu */}
        <div className="shrink-0 h-1.5 bg-neutral-100"><div className={`h-full transition-all ${S.serit}`} style={{ width: `${Math.round((soruAdimlari.filter(x => ttAdimTamam(form, x.id)).length / Math.max(1, soruAdimlari.length)) * 100)}%` }} /></div>
        {/* Mobil adım çipleri */}
        <div className="lg:hidden shrink-0 flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-neutral-100">
          {adimlar.map((a, i) => (
            <button key={a.id + i} type="button" onClick={() => git(i)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black border ${i === adimIdx ? S.secili : adimTamamMi(a.id) ? 'bg-green-50 text-green-800 border-green-200' : 'bg-white text-neutral-500 border-neutral-200'}`}>
              {a.id === 'musteri' ? (hizli ? 'Hizmet' : 'Müşteri') : a.id === 'sonuc' ? 'Sonuç' : `Sorular (${soruAdimlari.filter(x => ttAdimTamam(form, x.id)).length}/${soruAdimlari.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[210px_1fr_320px]">
          {/* SOL: soru listesi (masaüstü) */}
          <nav className="hidden lg:block border-r border-neutral-100 overflow-y-auto p-3 space-y-1 bg-neutral-50">
            {adimlar.map((a, i) => {
              const tamam = adimTamamMi(a.id);
              const aktif = i === adimIdx;
              return (
                <React.Fragment key={a.id + i}>
                <button type="button" onClick={() => git(i)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-[11px] font-black flex items-start gap-2 transition ${aktif ? S.secili : 'text-neutral-600 hover:bg-white'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${aktif ? 'bg-white/25' : tamam ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                    {tamam && !aktif ? '✓' : a.soru ? sorular.indexOf(a) + 1 : a.id === 'musteri' ? '•' : '₺'}
                  </span>
                  <span className="leading-snug">{a.baslik}{a.ek && <span className={`block text-[9px] ${aktif ? 'text-white/70' : 'text-neutral-400'}`}>nakliye sorusu</span>}</span>
                </button>
                {/* YENİ: tek sayfadaki soruların kontrol listesi — tıklayınca o soruya kaydırır */}
                {a.id === 'sorular' && (
                  <div className="ml-4 pl-2 border-l-2 border-neutral-200 space-y-0.5 py-1">
                    {soruAdimlari.map((q, qi) => {
                      const qTamam = ttAdimTamam(form, q.id);
                      return (
                        <button key={q.id} type="button" onClick={() => soruyaGit(q.id)}
                          className="w-full text-left px-1.5 py-1 rounded-lg text-[10px] font-bold flex items-start gap-1.5 text-neutral-600 hover:bg-white">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${qTamam ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>{qTamam ? '✓' : qi + 1}</span>
                          <span className="leading-snug">{q.baslik}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* ORTA: TÜM BÖLÜMLER TEK SAYFADA — aşağı doğru kaydırılır (kullanıcı talebi) */}
          <div ref={sayfaRef} onScroll={kaydirmaTakip} className="overflow-y-auto overscroll-contain p-4 md:p-6 scroll-smooth">
            <div className="max-w-5xl space-y-8 pb-10">
              {adimlar.map((a, i) => (
                <section key={a.id} id={`tt-bolum-${a.id}`} className={`scroll-mt-4 ${i > 0 ? 'pt-6 border-t-2 border-dashed border-neutral-200' : ''}`}>
                  <p className={`text-[11px] font-black uppercase tracking-wider ${S.yazi}`}>
                    {i + 1}. Bölüm{a.id === 'sorular' ? ` · ${soruAdimlari.filter(x => ttAdimTamam(form, x.id)).length} / ${soruAdimlari.length} soru cevaplandı` : ''}
                  </p>
                  <h4 className="text-xl md:text-2xl font-black text-neutral-900 mt-0.5 mb-4">{a.baslik}</h4>
                  {adimIcerigi(a.id)}
                </section>
              ))}
            </div>
          </div>

          {/* SAĞ: fiyat / geçmiş / rehber */}
          <aside className="border-t lg:border-t-0 lg:border-l border-neutral-100 flex flex-col min-h-0 bg-neutral-50 max-h-[40vh] lg:max-h-none">
            <div className="shrink-0 flex gap-1 p-2 border-b border-neutral-100">
              {[['fiyat', 'Fiyat'], ...(hizli ? [] : [['gecmis', `Geçmiş${gecmis ? ` (${gecmis.toplam})` : ''}`]]), ['rehber', 'Rehber']].map(([id, ad]) => (
                <button key={id} type="button" onClick={() => setPanel(id)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-black transition ${panel === id ? 'bg-neutral-900 text-white' : id === 'gecmis' && gecmis ? 'bg-amber-100 text-amber-800' : 'bg-white text-neutral-600'}`}>{ad}</button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {panel === 'fiyat' && <TTFiyatPaneli form={form} />}
              {panel === 'gecmis' && (gecmis ? <MusteriGecmisiKutusu gecmis={gecmis} ad={form.musteriAdi} />
                : <p className="text-xs font-bold text-neutral-400 text-center py-6">{ttTelGecerli(form.telefon) ? 'Bu numarayla eşleşen geçmiş kayıt yok — yeni müşteri.' : 'Telefon girilince geçmiş kontrol edilir.'}</p>)}
              {panel === 'rehber' && <TTGorusmeRehberi hizmetTipi={form.hizmetTipi} />}
              {/* YENİ (kullanıcı talebi): panelin altı boş kalmasın — hazır WhatsApp mesajları (hızlı modda yok) */}
              {!hizli && <TTWhatsappHizli t={form} onSec={setWaSablon} />}
            </div>
          </aside>
        </div>

        {/* ALT ÇUBUK — DEĞİŞTİ (kullanıcı talebi): tek sayfa olduğu için Geri / Sonraki yok */}
        <div className="shrink-0 px-3 md:px-5 py-3 border-t border-neutral-200 bg-white flex items-center gap-2">
          <p className="text-[11px] font-black text-neutral-500 shrink-0">{soruAdimlari.filter(x => ttAdimTamam(form, x.id)).length} / {soruAdimlari.length} soru</p>
          <p className="flex-1 text-xs font-bold text-red-600 truncate">{hata}</p>
          {hizli ? (<>
            {/* YENİ: hızlı modda kayıt yok — yeni hesap için sıfırla */}
            <button type="button" onClick={() => setForm({ ...ttBosForm(form.hizmetTipi), surum: 2 })}
              className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-black flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Sıfırla</button>
            <button type="button" onClick={onKapat}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-black flex items-center gap-1.5"><X className="w-4 h-4" /> Kapat</button>
          </>) : (
          <button type="button" onClick={kaydet} disabled={kaydediliyor}
            className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-black flex items-center gap-1.5 shadow-lg shadow-green-600/30 disabled:opacity-60">
            {kaydediliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet
          </button>
          )}
        </div>
      </div>
      {waSablon && (
        <TTWhatsappPenceresi t={form} gonderen={gonderen} baslangicSablon={waSablon} onKapat={() => setWaSablon(null)}
          onGonderildi={(ad) => onWhatsappKaydi?.(ad)} />
      )}
    </div>
  );
};

// ============================================================================
// (5) VERİ HOOK'U, GİRİŞ BUTONU, LİSTE, DETAY VE SAYFA
// ============================================================================
// Tüm telefon tekliflerini canlı dinler (tek dinleyici — Müşteri Havuzu çağırır)
const useTelefonTeklifleri = (aktif = true) => {
  const [teklifler, setTeklifler] = useState([]);
  useEffect(() => {
    if (!aktif) return undefined;
    const unsub = onSnapshot(ttKoleksiyon(), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.iletisimTarihi || '').localeCompare(a.iletisimTarihi || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
      setTeklifler(list);
    }, err => console.error('Telefon teklifleri okunamadı:', err));
    return () => unsub();
  }, [aktif]);
  return teklifler;
};

// YENİ (kullanıcı talebi): telefon görüşmesi hazır not şablonları —
// Hızlı Teklifler'deki şablonlar + görüşme sonrası sık kullanılanlar
const ttNotSablonlari = (hizmetTipi) => [
  'Müşteri ile görüşüldü, yakını için düşünüyor. Dönüş bekliyoruz.',
  'Fiyat verildi, müşteri düşünüp dönecek.',
  'Video / fotoğraf bekleniyor, gelince net fiyat verilecek.',
  ...((typeof NOT_SABLONLARI !== 'undefined' && NOT_SABLONLARI[ttSiteOf(hizmetTipi)]) || []),
].filter((x, i, a) => a.indexOf(x) === i);
// Kaydın en son notu (liste görünümü için)
const ttSonNot = (t) => [...(t.notlar || [])].sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')));

// Görünürlük (kullanıcı talebi): her satışçı KENDİ görüşmelerini görür,
// yöneticiler (Firma Sahibi / Yönetici / Müdür / düzenleme yetkili) HEPSİNİ görür.
// DEĞİŞTİ (kullanıcı talebi): satışçı YALNIZCA kendi görüşmelerini görür; sahipsiz kayıtlar yalnızca yöneticide
const ttGorunurMu = (t, kullanici, tamYetki) => tamYetki || ttSahibi(t) === kullanici;

// Özet sayaçları
const ttOzet = (list) => {
  const ay = ttBugunStr().slice(0, 7);
  const kapanan = list.filter(t => TT_KAPALI_DURUMLAR.includes(t.durum)).length;
  const alinan = list.filter(t => t.durum === 'İşi Aldık');
  return {
    toplam: list.length,
    buAy: list.filter(t => (t.iletisimTarihi || '').startsWith(ay)).length,
    bugun: list.filter(t => ttTakipDurumu(t) === 'bugun').length,
    geciken: list.filter(t => ttTakipDurumu(t) === 'gecikti').length,
    isiAldik: alinan.length,
    donusum: kapanan ? Math.round((alinan.length / kapanan) * 100) : 0,
    alinanTutar: alinan.reduce((s, t) => s + ttFiyatSayi(t.verilenFiyat), 0),
  };
};

// Müşteri Havuzu'nda Hızlı Teklifler'in üstündeki giriş butonu
const TelefonTeklifleriButonu = ({ teklifler, onClick, aktif = false, tamYetki = false }) => {
  const o = ttOzet(teklifler);
  const nakliye = teklifler.filter(t => t.hizmetTipi === 'Nakliye').length;
  return (
    <button type="button" onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-2xl border-2 transition flex items-center gap-2.5 ${aktif ? 'bg-emerald-600 text-white border-transparent shadow-lg shadow-emerald-600/30' : 'bg-white text-emerald-800 border-emerald-200 hover:border-emerald-400'}`}>
      {/* DEĞİŞTİ (kullanıcı talebi): KİŞİYE ÖZEL ALAN olduğu simge ve yazıyla belli */}
      <span className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${aktif ? 'bg-white/20' : 'bg-emerald-50'}`}>
        <PhoneCall className="w-5 h-5" />
        <ShieldCheck className={`w-3.5 h-3.5 absolute -bottom-1 -right-1 rounded-full ${aktif ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700'}`} />
      </span>
      <span className="text-left flex-1 min-w-0">
        {/* DEĞİŞTİ (kullanıcı talebi): "Telefon Teklifleri" → "Telefon Görüşmesi" */}
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-black leading-tight">Telefon Görüşmesi</span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 ${aktif ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'}`}>
            <User className="w-2.5 h-2.5" /> {tamYetki ? 'KİŞİSEL ALANLAR' : 'KİŞİSEL ALANIM'}
          </span>
        </span>
        <span className={`block text-[10px] font-bold mt-0.5 truncate ${aktif ? 'text-white/80' : 'text-emerald-600'}`}>
          {tamYetki ? 'Tüm satışçıların kişiye özel müşterileri' : 'Yalnızca size ait müşteriler — kendi aramalarınız + havuzdan aldıklarınız'}
        </span>
      </span>
      <span className="hidden sm:inline text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0">{nakliye} Nakliye</span>
      <span className="hidden sm:inline text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">{teklifler.length - nakliye} Depo</span>
      {o.geciken > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white bg-red-600 animate-pulse shrink-0">{o.geciken} gecikti</span>}
      {o.bugun > 0 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white bg-orange-500 shrink-0">{o.bugun} bugün</span>}
      <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${aktif ? 'bg-white/25' : 'bg-emerald-50'}`}>{o.toplam}</span>
    </button>
  );
};

// YENİ (kullanıcı talebi): AÇILIR FİLTRE DÜĞMESİ — "Durum: Tümü ▾" tıklanınca seçenekler açılır
const TTFiltreAcilir = ({ baslik, deger, secenekler = [], onSec }) => {
  const [acik, setAcik] = useState(false);
  const secili = secenekler.find(x => x.id === deger) || secenekler[0];
  const aktif = deger !== 'Tümü';
  return (
    <div className="relative">
      <button type="button" onClick={() => setAcik(a => !a)} aria-expanded={acik}
        className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 whitespace-nowrap ${aktif ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'}`}>
        <span className={aktif ? 'text-white/60' : 'text-neutral-400'}>{baslik}:</span>
        {secili?.nokta && aktif && <span className={`w-2 h-2 rounded-full ${secili.nokta}`} />}
        <span className="max-w-[140px] truncate">{secili?.ad}</span>
        {secili?.sayi !== undefined && <span className={`text-[10px] ${aktif ? 'text-white/70' : 'text-neutral-400'}`}>({secili.sayi})</span>}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${acik ? 'rotate-180' : ''}`} />
      </button>
      {acik && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAcik(false)} />
          <div className="absolute z-40 mt-1 right-0 min-w-[210px] max-h-72 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1">
            {secenekler.map(x => (
              <button key={x.id} type="button" onClick={() => { onSec(x.id); setAcik(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 hover:bg-neutral-50 ${x.id === deger ? 'bg-neutral-100' : ''}`}>
                {x.nokta ? <span className={`w-2 h-2 rounded-full shrink-0 ${x.nokta}`} /> : <span className="w-2 h-2 shrink-0" />}
                <span className="flex-1 truncate">{x.ad}</span>
                {x.sayi !== undefined && <span className="text-[10px] text-neutral-400">{x.sayi}</span>}
                {x.id === deger && <CheckCircle className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Satırdaki durum seçici — durum her an değiştirilebilir
const TTDurumSecici = ({ durum, onDegis }) => {
  const [acik, setAcik] = useState(false);
  const d = ttDurumBul(durum);
  return (
    <div className="relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); setAcik(a => !a); }}
        className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-black flex items-center justify-between gap-1.5 ${d.rozet}`}>
        <span className="flex items-center gap-1.5 truncate"><span className={`w-2 h-2 rounded-full shrink-0 ${d.nokta}`} /> {d.etiket}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {acik && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setAcik(false); }} />
          <div className="absolute z-40 mt-1 right-0 w-52 bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1">
            {TT_SECILEBILIR_DURUMLAR.map(s => (
              <button key={s.id} type="button" onClick={(e) => { e.stopPropagation(); setAcik(false); onDegis(s.id); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-2 hover:bg-neutral-50 ${s.id === durum ? 'bg-neutral-100' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${s.nokta}`} /> {s.etiket}
                {s.id === durum && <CheckCircle className="w-3 h-3 ml-auto text-neutral-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TTTakipRozeti = ({ t }) => {
  const td = ttTakipDurumu(t);
  if (td === 'kapali' || td === 'yok') return null;
  const stil = { gecikti: 'bg-red-600 text-white', bugun: 'bg-orange-500 text-white', ileride: 'bg-neutral-100 text-neutral-700' }[td];
  const metin = { gecikti: 'Gecikti', bugun: 'Bugün ara', ileride: 'Ara' }[td];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${stil}`}><Clock className="w-3 h-3" /> {metin} · {ttTrTarih(t.takipTarihi).slice(0, 5)}</span>;
};

const TTCip = ({ children, vurgu = false }) => (
  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${vurgu ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-neutral-50 text-neutral-700 border-neutral-200'}`}>{children}</span>
);

// Satırdaki fiyat metni
const ttFiyatMetni = (t) => {
  if (t.verilenFiyat) return /^\d+$/.test(String(t.verilenFiyat)) ? ttTl(t.verilenFiyat) : `${t.verilenFiyat} ₺`;
  if (t.sistemFiyati) return ttTl(t.sistemFiyati);
  return t.hizmetTipi === 'Depo' && t.nakliyeIstiyor === 'Kendisi' ? 'Nakliye yok' : '—';
};

// ---------------------------------------------------------------- SATIR ---
const TelefonTeklifSatiri = ({ tHam, gecmis, sahibiGoster, onAc, onDurum, onWhatsapp }) => {
  const t = ttNormalize(tHam);
  const hz = ttHizmetBul(t.hizmetTipi);
  const telVar = ttTelGecerli(t.telefon);
  const r = ttAdimRolleri(t);
  return (
    <div onClick={onAc} className="relative grid grid-cols-1 md:grid-cols-[1.3fr_1.6fr_0.8fr_auto_1fr_auto] gap-2 md:gap-3 items-center pl-4 pr-3 py-2.5 border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer">
      {/* Hizmet rengi şeridi — Sembol kırmızı, DepoEvim mavi/mor */}
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${hz.stil.serit}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-black text-neutral-900 truncate">{t.musteriAdi || 'İsimsiz'}</p>
          {/* YENİ (kullanıcı talebi): kaynak etiketi — MANUEL / HIZLI TEKLİF */}
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${ttKaynakBul(t).stil}`}>{ttKaynakBul(t).rozet}</span>
          {gecmis && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300" title="Bu numaranın geçmiş kaydı var">↺ Geçmiş {gecmis.toplam}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] font-bold text-neutral-500">{ttTelGoster(t.telefon) || 'Telefon yok'}</span>
          {telVar && (<>
            <a href={`tel:0${ttTelAnahtar(t.telefon)}`} onClick={e => e.stopPropagation()} className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700" title="Ara"><Phone className="w-3 h-3" /></a>
            <button type="button" onClick={e => { e.stopPropagation(); onWhatsapp(); }} className="p-1 rounded-md bg-green-600 text-white hover:bg-green-700" title="WhatsApp hazır mesaj"><MessageCircle className="w-3 h-3" /></button>
          </>)}
        </div>
        <p className="text-[10px] font-bold text-neutral-400 mt-0.5">{ttTrTarih(t.iletisimTarihi)}{sahibiGoster ? ` · ${ttSahibi(t) || 'Atanmadı'}` : ''}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black text-neutral-800 truncate flex items-center gap-1.5">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hz.stil.rozet}`}>{hz.id === 'Nakliye' ? 'EVDEN EVE' : hz.id.toUpperCase()}</span>
          <MapPin className="w-3 h-3 text-neutral-400 shrink-0" /> {ttGuzergah(t)}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {t.hizmetTipi === 'Nakliye' && t.odaSayisi && <TTCip>{t.odaSayisi}</TTCip>}
          {t.hizmetTipi !== 'Nakliye' && t.depoBoyutu && <TTCip>{t.depoBoyutu} depo</TTCip>}
          {t.hizmetTipi === 'Depo' && t.kiralamaSuresi && t.kiralamaSuresi !== '1' && <TTCip vurgu>{t.kiralamaSuresi} ay kampanya</TTCip>}
          {t.hizmetTipi === 'Depo' && t.nakliyeIstiyor === 'Kendisi' && <TTCip>Kendisi getirecek</TTCip>}
          {r.map(x => t[`${x}Kat`] ? <TTCip key={x} vurgu={t[`${x}Tasima`] === 'Merdiven' && ttKatNo(t[`${x}Kat`]) >= 3}>{t[`${x}Kat`]}{t[`${x}Tasima`] ? ` · ${t[`${x}Tasima`]}` : ''}</TTCip> : null)}
          {t.toplama === 'Firma' && <TTCip vurgu>Toplama bizde</TTCip>}
          {(t.tasinmaTarihi || t.tasinmaNotu) && <TTCip><CalendarDays className="w-3 h-3 inline -mt-0.5" /> {t.tasinmaTarihi ? ttTrTarih(t.tasinmaTarihi) : t.tasinmaNotu}</TTCip>}
          <TTCip><Camera className="w-3 h-3 inline -mt-0.5" /> {t.videoDurumu || 'Paylaşmadı'}</TTCip>
        </div>
      </div>
      <div>
        <p className="text-sm font-black text-neutral-900">{ttFiyatMetni(t)}</p>
        {t.depoAylik ? <p className="text-[10px] font-bold text-sky-700">{ttTl(t.depoAylik)} +KDV/ay</p> : null}
      </div>
      {/* YENİ (kullanıcı talebi): havuzdan gelen → "Teklife Bak", elle girilen → "Görüşmeye Bak" */}
      <div className="md:text-center">
        <button type="button" onClick={e => { e.stopPropagation(); onAc(); }}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white text-[11px] font-black shadow-lg transition whitespace-nowrap ${ttKaynakTuru(t) === 'havuz' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/40 ring-2 ring-orange-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/40 ring-2 ring-emerald-200'}`}>
          {ttKaynakTuru(t) === 'havuz' ? <><Eye className="w-3.5 h-3.5" /> Teklife Bak</> : <><PhoneCall className="w-3.5 h-3.5" /> Görüşmeye Bak</>}
        </button>
      </div>
      <div className="space-y-1" onClick={e => e.stopPropagation()}>
        <TTDurumSecici durum={t.durum || 'Yeni'} onDegis={onDurum} />
        <TTTakipRozeti t={t} />
      </div>
      <ChevronRight className="hidden md:block w-4 h-4 text-neutral-300" />
      {/* DEĞİŞTİ (kullanıcı talebi): burada müşteriye girilen SON NOT görünür; not yoksa uyarı */}
      {(() => {
        const notlar = ttSonNot(t);
        if (!notlar.length) return (
          <p className="md:col-span-6 text-[11px] font-black text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Not girilmemiş — müşteriyle görüşme notu ekleyin
          </p>
        );
        const n = notlar[0];
        return (
          <div className="md:col-span-6 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
            <p className="text-xs font-semibold text-neutral-800 line-clamp-2 flex gap-1.5"><StickyNote className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" /> {n.metin}</p>
            <p className="text-[10px] font-bold text-neutral-400 ml-5">{n.kullanici} · {new Date(n.tarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}{notlar.length > 1 ? ` · +${notlar.length - 1} not daha` : ''}</p>
          </div>
        );
      })()}
    </div>
  );
};

// ---------------------------------------------------------------- DETAY ---
const TTBilgi = ({ e, v }) => (
  <div className="min-w-0"><p className="text-[9px] font-black uppercase text-neutral-400">{e}</p><p className="text-xs font-black text-neutral-800 break-words">{v || '—'}</p></div>
);

const TelefonTeklifDetay = ({ tHam, gecmis, yetkili, onKapat, onDurum, onSurec, onNotEkle, onDuzenle, onKayitAc, onWhatsapp, onTransfer, onHizmetAktar, onSil,
  onNotGuncelle = null, onNotSil = null, kullanici = '', onSunum = null }) => {
  // onWhatsapp(sablonId?) — şablon verilirse pencere o şablonla açılır
  const t = ttNormalize(tHam);
  const [not, setNot] = useState('');
  // YENİ (kullanıcı talebi): kaydedilmiş notu düzenleme / silme
  const [notDuzenle, setNotDuzenle] = useState(null);    // { anahtar, metin }
  const [notSilinecek, setNotSilinecek] = useState(null); // not nesnesi
  const [notSablonAcik, setNotSablonAcik] = useState(false); // YENİ (kullanıcı talebi): hazır şablonlar kapalı başlar
  const notAnahtari = (n) => `${n.tarih}|${n.kullanici}`;
  // Notu yazan kişi veya yetkili (yönetici / kaydın sahibi) düzenleyebilir
  const notDuzenleyebilir = (n) => yetkili || (kullanici && n.kullanici === kullanici);
  const hz = ttHizmetBul(t.hizmetTipi);
  const hesap = ttFiyatHesapla(t);
  const adimlar = ttSurecAdimlari(t);
  const surec = t.surecAdimlari || {};
  const tamam = adimlar.filter(a => surec[a.id]).length;
  const r = ttAdimRolleri(t);
  const notGonder = async () => { if (!not.trim()) return; await onNotEkle(not.trim()); setNot(''); };
  const hedefHizmet = t.hizmetTipi === 'Nakliye' ? 'Depo' : 'Nakliye';

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-3 md:p-4" onClick={onKapat}>
      <div className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        {/* Başlık — hizmet rengiyle */}
        <div className={`shrink-0 px-4 md:px-5 py-3 text-white ${hz.stil.serit}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/80 flex items-center gap-1.5"><hz.Ikon className="w-3.5 h-3.5" /> {hz.ad} · {hz.marka}
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-white">{ttKaynakBul(t).rozet}</span></p>
              <h3 className="text-lg font-black truncate">{t.musteriAdi || 'İsimsiz'} <span className="text-sm font-bold text-white/80">{ttTelGoster(t.telefon)}</span></h3>
              <p className="text-[11px] font-bold text-white/80 truncate">{ttGuzergah(t)} · Satışçı: {ttSahibi(t) || 'Atanmadı'}</p>
            </div>
            <button type="button" onClick={onKapat} className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0"><X className="w-5 h-5" /></button>
          </div>
          {/* Hızlı aksiyonlar */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {ttTelGecerli(t.telefon) && <a href={`tel:0${ttTelAnahtar(t.telefon)}`} className="px-3 py-1.5 rounded-xl bg-white text-blue-700 text-xs font-black flex items-center gap-1.5 shadow"><Phone className="w-3.5 h-3.5" /> Ara</a>}
            {ttTelGecerli(t.telefon) && <button type="button" onClick={() => onWhatsapp()} className="px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-xs font-black flex items-center gap-1.5 shadow"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp Mesajı</button>}
            {onKayitAc && <button type="button" onClick={onKayitAc} className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-black flex items-center gap-1.5 shadow"><UserPlus className="w-3.5 h-3.5" /> Kayıt Aç</button>}
            <button type="button" onClick={onDuzenle} className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center gap-1.5"><Edit className="w-3.5 h-3.5" /> Düzenle</button>
            <button type="button" onClick={onTransfer} className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Personele Transfer</button>
            <button type="button" onClick={() => onHizmetAktar(hedefHizmet)} className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" /> {hedefHizmet === 'Depo' ? 'DepoEvim\'e Aktar' : 'Sembol\'e Aktar'}
            </button>
            {/* YENİ (kullanıcı talebi): MÜŞTERİYE ÖZEL SUNUM (2 sayfa PDF)
                Eşya Depolama → Depo Sunumu · Evden Eve Nakliyat → Taşıma Sunumu (Depodan Çıkış'ta yok) */}
            {(t.hizmetTipi === 'Depo' || t.hizmetTipi === 'Nakliye') && onSunum && (
              <button type="button" onClick={onSunum} className={`px-3 py-1.5 rounded-xl bg-white text-xs font-black flex items-center gap-1.5 shadow ${t.hizmetTipi === 'Nakliye' ? 'text-red-700 hover:bg-red-50' : 'text-blue-700 hover:bg-blue-50'}`}>
                <FileText className="w-3.5 h-3.5" /> PDF Sunum İndir
              </button>
            )}
            {yetkili && <button type="button" onClick={onSil} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 ml-auto"><Trash2 className="w-3.5 h-3.5" /> Sil</button>}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-5 space-y-4">
          {gecmis && <MusteriGecmisiKutusu gecmis={gecmis} ad={t.musteriAdi} />}

          {/* Durum — sonradan istenildiği kadar değiştirilebilir */}
          <div>
            <p className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">Görüşme Durumu</p>
            <div className="flex flex-wrap gap-1.5">
              {TT_SECILEBILIR_DURUMLAR.map(s => (
                <button key={s.id} type="button" onClick={() => onDurum(s.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border flex items-center gap-1.5 transition ${(t.durum || 'Yeni') === s.id ? `${s.rozet} ring-2 ring-neutral-900 ring-offset-1` : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${s.nokta}`} /> {s.etiket}
                </button>
              ))}
            </div>
            {t.kayitAcildi && <p className="mt-1.5 text-[10px] font-black text-green-700">✓ Kayıt ekranına aktarıldı: {new Date(t.kayitAcildi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Cevaplar */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-neutral-50 border border-neutral-200 rounded-2xl p-3 self-start">
              {/* YENİ (kullanıcı talebi): kaydedilmiş bilgileri düzenle — soru sayfası dolu açılır */}
              <div className="col-span-2 md:col-span-3 flex items-center justify-between gap-2 -mb-1">
                <p className="text-[10px] font-black uppercase text-neutral-500">Kaydedilen Bilgiler</p>
                <button type="button" onClick={onDuzenle}
                  className={`px-3 py-1.5 rounded-lg text-white text-[11px] font-black flex items-center gap-1.5 shadow ${hz.stil.dugme}`}>
                  <Edit className="w-3.5 h-3.5" /> Bilgileri Düzenle
                </button>
              </div>
              <TTBilgi e="Görüşme Tarihi" v={ttTrTarih(t.iletisimTarihi)} />
              <TTBilgi e="Taşınma / İşlem Tarihi" v={[t.tasinmaTarihi && ttTrTarih(t.tasinmaTarihi), t.tasinmaNotu].filter(Boolean).join(' · ')} />
              {t.hizmetTipi === 'Nakliye' && <TTBilgi e="Ev Tipi" v={TT_ODA_SECENEKLERI.find(o => o.id === t.odaSayisi)?.ad || t.odaSayisi} />}
              {t.hizmetTipi === 'Depo' && <TTBilgi e="Eşya Cinsi" v={t.esyaCinsi} />}
              {t.hizmetTipi !== 'Nakliye' && <TTBilgi e="Depo Boyutu" v={t.depoBoyutu ? `${t.depoBoyutu}${TT_DEPO_BOYUTLARI.find(b => b.id === t.depoBoyutu)?.m3 ? ` · ${TT_DEPO_BOYUTLARI.find(b => b.id === t.depoBoyutu).m3} m³` : ''}` : ''} />}
              {t.hizmetTipi === 'Depo' && <TTBilgi e="Kiralama" v={TT_KIRALAMA.find(k => k.id === t.kiralamaSuresi)?.ad} />}
              {t.hizmetTipi !== 'Nakliye' && <TTBilgi e="Şube" v={t.sube} />}
              {t.hizmetTipi === 'Depo' && <TTBilgi e="Nakliye" v={TT_NAKLIYE_TERCIHI.find(n => n.id === t.nakliyeIstiyor)?.ad} />}
              {r.includes('yuk') || t.hizmetTipi === 'Depo' ? <TTBilgi e={t.hizmetTipi === 'Nakliye' ? 'Yükleme Adresi' : 'Eşyaların Yeri'} v={[ttAdresKisa(t.yukIl, t.yukIlce), t.yukAdres].filter(Boolean).join(' — ')} /> : null}
              {r.includes('yuk') && <TTBilgi e="Yükleme Kat / Taşıma" v={ttKatTasima(t.yukKat, t.yukTasima)} />}
              {r.includes('yuk') && <TTBilgi e="Yükleme Yanaşma" v={TT_YANASMA.find(y => y.id === t.yukMesafe)?.ad} />}
              {r.includes('bos') && <TTBilgi e="Boşaltma Adresi" v={[ttAdresKisa(t.bosIl, t.bosIlce), t.bosAdres].filter(Boolean).join(' — ')} />}
              {r.includes('bos') && <TTBilgi e="Boşaltma Kat / Taşıma" v={ttKatTasima(t.bosKat, t.bosTasima)} />}
              {r.includes('bos') && <TTBilgi e="Boşaltma Yanaşma" v={TT_YANASMA.find(y => y.id === t.bosMesafe)?.ad} />}
              {(t.hizmetTipi === 'Nakliye' || t.nakliyeIstiyor === 'Firma') && <TTBilgi e="Toplama" v={TT_TOPLAMA.find(x => x.id === t.toplama)?.ad} />}
              <TTBilgi e="Video" v={t.videoDurumu} />
              <TTBilgi e="Söylenen Fiyat" v={ttFiyatMetni(t)} />
              <TTBilgi e="Tekrar Arama" v={ttTrTarih(t.takipTarihi)} />
              {t.aciklama && <div className="col-span-2 md:col-span-3"><p className="text-[9px] font-black uppercase text-neutral-400">Açıklama</p><p className="text-xs font-semibold text-neutral-800 whitespace-pre-wrap">{t.aciklama}</p></div>}
            </div>
            {/* Güncel sistem hesabı + (YENİ) her zaman açık WhatsApp bilgilendirme butonları */}
            <div className="space-y-3">
              <TTFiyatPaneli form={t} />
              <TTWhatsappHizli t={t} onSec={(id) => onWhatsapp(id)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Süreç adımları — kılavuzdaki sıra */}
            <div className="border border-neutral-200 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black uppercase text-neutral-800 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" /> Süreç Adımları</p>
                <span className="text-[11px] font-black text-neutral-500">{tamam}/{adimlar.length}</span>
              </div>
              <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-2"><div className="h-full bg-green-500 transition-all" style={{ width: `${Math.round((tamam / adimlar.length) * 100)}%` }} /></div>
              {adimlar.map(a => (
                <label key={a.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-50 cursor-pointer">
                  <input type="checkbox" checked={!!surec[a.id]} onChange={e => onSurec(a, e.target.checked)} className="mt-0.5 accent-green-600" />
                  <span className={`text-[11px] font-bold ${surec[a.id] ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>{a.ad}</span>
                </label>
              ))}
            </div>
            {/* Notlar + geçmiş */}
            <div className="border border-neutral-200 rounded-2xl p-3 flex flex-col">
              <p className="text-xs font-black uppercase text-neutral-800 flex items-center gap-1.5 mb-2"><History className="w-4 h-4" /> Notlar & Geçmiş</p>
              <div className="flex gap-1.5 mb-2">
                <input value={not} onChange={e => setNot(e.target.value)} onKeyDown={e => e.key === 'Enter' && notGonder()}
                  placeholder="Görüşme notu ekle (örn. 15.10'da tekrar aranacak)"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
                <button type="button" onClick={notGonder} className="px-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-700"><Send className="w-4 h-4" /></button>
              </div>
              {/* YENİ (kullanıcı talebi): hazır not şablonları — açılır bölüm, tıklayınca kutuya yazılır */}
              <div className="mb-2">
                <button type="button" onClick={() => setNotSablonAcik(a => !a)} aria-expanded={notSablonAcik}
                  className="w-full flex items-center gap-1.5 text-left text-[10px] font-black uppercase text-yellow-800 hover:text-yellow-900">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${notSablonAcik ? 'rotate-180' : ''}`} />
                  Hazır Şablonlar
                  <span className="ml-auto normal-case font-bold text-yellow-700">{notSablonAcik ? 'Gizle' : `${ttNotSablonlari(t.hizmetTipi).length} şablon · Göster`}</span>
                </button>
                {notSablonAcik && (
                  <div className="flex flex-wrap gap-1 mt-1.5 animate-in fade-in slide-in-from-top-1">
                    {ttNotSablonlari(t.hizmetTipi).map(sb => (
                      <button key={sb} type="button" onClick={() => { setNot(sb); setNotSablonAcik(false); }}
                        className="px-2 py-1 rounded-lg bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-[10px] font-bold text-neutral-700 text-left">{sb}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {[...(t.notlar || []).map(n => ({ ...n, tur: 'not' })), ...(t.hareketler || []).map(h => ({ ...h, tur: 'hareket', metin: h.islem }))]
                  .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
                  .map((x, i) => (
                    <div key={i} className={`group rounded-lg px-2 py-1.5 text-[11px] ${x.tur === 'not' ? 'bg-yellow-50 border border-yellow-100 text-neutral-800 font-semibold' : 'bg-neutral-50 text-neutral-500'}`}>
                      {/* YENİ (kullanıcı talebi): not düzenleme kutusu */}
                      {x.tur === 'not' && notDuzenle?.anahtar === notAnahtari(x) ? (
                        <div className="space-y-1.5">
                          <textarea value={notDuzenle.metin} onChange={e => setNotDuzenle(nd => ({ ...nd, metin: e.target.value }))} rows={3} autoFocus
                            className="w-full p-2 rounded-lg border border-yellow-300 bg-white text-[11px] font-semibold outline-none focus:ring-2 focus:ring-yellow-400 resize-y" />
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => setNotDuzenle(null)} className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-[10px] font-black text-neutral-600">Vazgeç</button>
                            <button type="button" disabled={!notDuzenle.metin.trim()}
                              onClick={async () => { await onNotGuncelle?.(x, notDuzenle.metin.trim()); setNotDuzenle(null); }}
                              className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[10px] font-black flex items-center gap-1 disabled:opacity-40"><Save className="w-3 h-3" /> Kaydet</button>
                          </div>
                        </div>
                      ) : (<>
                        <div className="flex items-start gap-1.5">
                          <p className="whitespace-pre-wrap flex-1 min-w-0">{x.metin}</p>
                          {x.tur === 'not' && notDuzenleyebilir(x) && onNotGuncelle && (
                            <span className="flex gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition">
                              <button type="button" title="Notu düzenle" onClick={() => setNotDuzenle({ anahtar: notAnahtari(x), metin: x.metin })} className="p-1 rounded hover:bg-yellow-100 text-neutral-600"><Edit className="w-3 h-3" /></button>
                              <button type="button" title="Notu sil" onClick={() => setNotSilinecek(x)} className="p-1 rounded hover:bg-red-100 text-red-600"><Trash2 className="w-3 h-3" /></button>
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-bold text-neutral-400 mt-0.5">{x.kullanici} · {new Date(x.tarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}{x.duzenlendi ? ` · düzenlendi (${x.duzenleyen || ''})` : ''}</p>
                      </>)}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {notSilinecek && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setNotSilinecek(null); }}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-neutral-900">Bu not silinsin mi?</p>
            <p className="text-xs text-neutral-600 bg-yellow-50 border border-yellow-100 rounded-lg p-2 whitespace-pre-wrap">{notSilinecek.metin}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setNotSilinecek(null)} className="px-4 py-2 rounded-xl bg-neutral-100 text-xs font-black">Vazgeç</button>
              <button type="button" onClick={async () => { await onNotSil?.(notSilinecek); setNotSilinecek(null); }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ############################################################################
//  YENİ (kullanıcı talebi): DEPO SUNUMU — 2 SAYFALIK PDF
// ----------------------------------------------------------------------------
//  Yalnızca DEPO (eşyanın depoya girişi) görüşmelerinde, detay penceresindeki
//  "PDF Sunum İndir" butonuyla üretilir. Sözleşme PDF'iyle aynı yöntem:
//  yeni sekmede hazır sayfa açılır ve yazdır penceresinden "PDF olarak kaydet".
//  Sayfa 1: Müşteri analizi · m³ ihtiyacı · eşya dağılımı · 3D oda · "neler sığar"
//  Sayfa 2: Depo özellikleri · fiyat teklifi (kira + kampanya + nakliye) · şube ·
//           süreç · iletişim
//  Metinler Depoevim Oda Kataloğu (PDF) ve oryantasyon kılavuzundan alındı.
// ############################################################################
const DEPO_SUNUM_KATALOG = {
  '1+0': { m3: 10, en: 2.0, boy: 1.7, yuk: 3.0, koli: '20–25 koli',
    sigar: ['Yaklaşık 20–25 koli', 'Yorgan ve nevresim hurçları', 'Halı ve perde ruloları', 'Kışlık kıyafet ve ayakkabılar', 'Kitaplar ve dekorasyon', 'Valiz ve küçük mutfak eşyaları'],
    dagilim: [['Koli & küçük eşyalar', 4.0], ['Kıyafet & tekstil', 2.5], ['Halı & perde ruloları', 1.5], ['Kitap & dekorasyon', 1.0], ['Valiz & diğer', 1.0]] },
  '1+1': { m3: 15, en: 2.5, boy: 2.0, yuk: 3.0, koli: '30–35 koli',
    sigar: ['Yaklaşık 30–35 koli', 'Çamaşır makinesi ve fırın', 'Çift kişilik yatak', 'Demonte kanepe ve TV ünitesi', 'Halı ve perde ruloları', 'Yorgan ve nevresim hurçları'],
    dagilim: [['Yatak & baza', 3.5], ['Kanepe & TV ünitesi', 3.0], ['Beyaz eşya', 2.5], ['Koli & küçük eşyalar', 3.5], ['Halı & perde ruloları', 1.5], ['Diğer (masa, sandalye vb.)', 1.0]] },
  '2+1': { m3: 22, en: 3.0, boy: 2.5, yuk: 3.0, koli: '40–50 koli',
    sigar: ['Yaklaşık 40–50 koli', 'Buzdolabı ve çamaşır makinesi', 'Çift kişilik yatak ve baza', 'Demonte gardırop panelleri', 'Demonte kanepe ve TV ünitesi', 'Çocuk odası eşyaları'],
    dagilim: [['Oturma grubu', 6.5], ['Yatak & baza', 4.2], ['Gardırop / dolap', 3.8], ['Beyaz eşya', 2.1], ['Koli & küçük eşyalar', 2.4], ['Diğer (masa, sandalye vb.)', 3.0]] },
  '3+1': { m3: 30, en: 4.0, boy: 2.5, yuk: 3.0, koli: '60–70 koli',
    sigar: ['Yaklaşık 60–70 koli', 'Beyaz eşyalar (3 adet)', 'İki yatak ve bazalar', 'Demonte gardıroplar', 'Yemek masası ve sandalyeler', 'Koltuk takımı ve TV'],
    dagilim: [['Oturma grubu', 8.0], ['Yatak & bazalar', 6.0], ['Gardıroplar', 5.0], ['Beyaz eşya', 3.5], ['Yemek masası & sandalye', 2.5], ['Koli & küçük eşyalar', 3.5], ['Diğer', 1.5]] },
};
const DEPO_SUNUM_OZELLIKLER = [
  ['🏢', 'Yüksek kat, rutubetsiz depolar', 'Eşyalarınız nem ve rutubetten uzak, kuru ortamda saklanır.'],
  ['🔒', 'Size özel mühürlü oda', 'Odanızın kapısı sizin gözünüzün önünde mühürlenir; anahtar ve mühür size özeldir.'],
  ['📷', '7/24 kamera ve güvenlik', 'Tesislerimiz gece gündüz kamera ile izlenir.'],
  ['🛡️', 'Sigortalı depolama', 'Eşyalarınız depolama süresince sigorta güvencesindedir.'],
  ['📦', 'Kalıcı ambalaj (pat pat)', 'Firma nakliyesinde eşyalar kalıcı ambalajla sarılır, depoda da öyle bekler.'],
  ['📅', 'Taahhüt yok, esnek kiralama', 'Aylık çalışırız; çıkmadan 7 gün önce haber vermeniz yeterli.'],
  ['🚚', 'Anahtar teslim nakliye', 'Kendi ekibimiz ve araçlarımızla adresinizden alır, depoya yerleştiririz.'],
  ['👀', 'Ziyaret imkânı', 'Depolarımızı dilediğiniz zaman gelip görebilir, eşyanıza ulaşabilirsiniz (1-2 gün önce randevu).'],
];

const depoSunumuIndir = (tHam, gonderen = '') => {
  const t = ttNormalize(tHam);
  const k = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const boyutId = DEPO_SUNUM_KATALOG[t.depoBoyutu] ? t.depoBoyutu : '2+1';   // Özel / boş → 2+1 örneği
  const kat = DEPO_SUNUM_KATALOG[boyutId];
  const ozelMi = !DEPO_SUNUM_KATALOG[t.depoBoyutu];
  const hesap = ttFiyatHesapla(t);
  const aylik = ttDepoAylik(t.sube, boyutId);
  const kdvli = aylik ? Math.round(aylik * (1 + TT_KDV)) : 0;
  const kira = TT_KIRALAMA.find(x => x.id === (t.kiralamaSuresi || '1')) || TT_KIRALAMA[0];
  const nakliyeVar = t.nakliyeIstiyor === 'Firma';
  const nakliyeFiyat = ttFiyatSayi(t.verilenFiyat) || ttAcilisFiyati(hesap.nakliyeToplam, 'Depo');
  const sube = DEPO_LOCATIONS.find(d => d.name === t.sube);
  const bugun = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const musteriNo = String(t.id || '').replace(/\D/g, '').slice(-4) || String(Date.now()).slice(-4);
  const toplamDagilim = kat.dagilim.reduce((s, [, v]) => s + v, 0);
  const ihtiyacAlt = Math.max(1, Math.round(toplamDagilim - kat.m3 * 0.08));
  const tl = (n) => `${Math.round(Number(n) || 0).toLocaleString('tr-TR')} ₺`;
  const dosyaAdi = `Depoevim-Depo-Sunumu-${(t.musteriAdi || 'Musteri').trim().replace(/\s+/g, '-')}`;

  // 3D oda çizimi (izometrik kutu + ölçü etiketleri)
  const odaSvg = `
    <svg viewBox="0 0 320 300" width="100%" height="235" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="zemin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
        <linearGradient id="solD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>
        <linearGradient id="sagD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
      </defs>
      <!-- sol duvar -->
      <polygon points="40,70 160,20 160,170 40,220" fill="url(#solD)" stroke="#94a3b8" stroke-width="1.5"/>
      <!-- sağ duvar -->
      <polygon points="160,20 280,70 280,220 160,170" fill="url(#sagD)" stroke="#94a3b8" stroke-width="1.5"/>
      <!-- zemin -->
      <polygon points="40,220 160,170 280,220 160,270" fill="url(#zemin)" stroke="#94a3b8" stroke-width="1.5"/>
      <!-- eşya blokları -->
      <g opacity="0.95">
        <polygon points="75,175 120,158 120,110 75,127" fill="#d6b48a"/><polygon points="120,158 160,175 160,127 120,110" fill="#b8926a"/><polygon points="75,127 120,110 160,127 115,144" fill="#eacba4"/>
        <polygon points="130,205 175,188 175,140 130,157" fill="#94a3b8"/><polygon points="175,188 215,205 215,157 175,140" fill="#64748b"/><polygon points="130,157 175,140 215,157 170,174" fill="#cbd5e1"/>
        <polygon points="185,168 230,151 230,88 185,105" fill="#e9c46a"/><polygon points="230,151 255,163 255,100 230,88" fill="#c9a24d"/><polygon points="185,105 230,88 255,100 210,117" fill="#f4dd8f"/>
        <polygon points="95,225 130,212 130,178 95,191" fill="#7fb3d5"/><polygon points="130,212 160,225 160,191 130,178" fill="#5d97bf"/><polygon points="95,191 130,178 160,191 125,204" fill="#a9cfe6"/>
      </g>
      <!-- ölçüler -->
      <line x1="30" y1="70" x2="30" y2="220" stroke="#0e7490" stroke-width="1.5"/><text x="8" y="150" font-size="11" font-weight="700" fill="#0e7490">${kat.yuk.toLocaleString('tr-TR')} m</text>
      <line x1="45" y1="235" x2="160" y2="282" stroke="#0e7490" stroke-width="1.5"/><text x="70" y="275" font-size="11" font-weight="700" fill="#0e7490">${kat.boy.toLocaleString('tr-TR')} m</text>
      <line x1="160" y1="282" x2="285" y2="235" stroke="#0e7490" stroke-width="1.5"/><text x="235" y="278" font-size="11" font-weight="700" fill="#0e7490">${kat.en.toLocaleString('tr-TR')} m</text>
    </svg>`;

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${k(dosyaAdi)}</title>
  <style>
    @page { size: A4 portrait; margin: 9mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; }
    .sayfa { width: 192mm; min-height: 277mm; margin: 0 auto; page-break-after: always; display: flex; flex-direction: column; gap: 9px; }
    .sayfa:last-child { page-break-after: auto; }
    .ust { background: linear-gradient(135deg, #0e7490, #06b6d4); color: #fff; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; } .logo small { display: block; font-size: 10px; font-weight: 700; letter-spacing: 2px; opacity: .9; }
    .slogan { text-align: right; font-size: 12px; font-weight: 700; line-height: 1.3; opacity: .95; }
    .baslik { background: #0f4c81; color: #fff; font-weight: 900; font-size: 12px; padding: 6px 12px; border-radius: 8px 8px 0 0; letter-spacing: .3px; }
    .kart { border: 1.5px solid #cfe3ee; border-radius: 10px; overflow: hidden; background: #fff; }
    .kart .ic { padding: 10px 12px; }
    .iki { display: grid; grid-template-columns: 1fr 1.25fr; gap: 9px; }
    .uc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
    .etiket { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
    .deger { font-size: 13px; font-weight: 800; color: #0f172a; }
    .buyuk { font-size: 30px; font-weight: 900; color: #0f4c81; line-height: 1; }
    .m3 { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; } td:last-child { text-align: right; font-weight: 800; }
    tr.toplam td { border-top: 2px solid #0f4c81; border-bottom: 0; font-weight: 900; color: #0f4c81; }
    .sonuc { background: #0f4c81; color: #fff; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 14px; }
    .sonuc .b { font-size: 28px; font-weight: 900; line-height: 1; }
    ul.tik { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 14px; font-size: 11px; font-weight: 700; }
    ul.tik li { break-inside: avoid; padding: 3px 0 3px 18px; position: relative; } ul.tik li:before { content: "✔"; position: absolute; left: 0; color: #0891b2; font-weight: 900; }
    .ozellik { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .ozellik div { border: 1px solid #cfe3ee; border-radius: 9px; padding: 8px 10px; font-size: 10.5px; display: flex; gap: 8px; }
    .ozellik b { display: block; font-size: 11px; color: #0f4c81; margin-bottom: 1px; }
    .fiyat { background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 10px; padding: 10px 12px; }
    .fiyat .satir { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed #bae6fd; font-size: 11px; font-weight: 700; }
    .fiyat .satir:last-child { border: 0; } .fiyat .tutar { font-size: 15px; font-weight: 900; color: #0f4c81; }
    .kampanya { background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 9px 12px; font-size: 11px; }
    .kampanya b { color: #047857; }
    .not { font-size: 9.5px; color: #64748b; font-style: italic; }
    .alt { margin-top: auto; background: #0f4c81; color: #fff; border-radius: 10px; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 700; }
    .rozetler { display: flex; justify-content: space-around; gap: 6px; font-size: 10px; font-weight: 800; color: #0f4c81; padding: 6px 0; }
    .rozetler span { text-align: center; } .rozetler i { display: block; font-style: normal; font-size: 18px; }
    .adim { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .adim div { border: 1px solid #cfe3ee; border-radius: 8px; padding: 7px 6px; font-size: 9.5px; font-weight: 700; text-align: center; }
    .adim b { display: block; width: 20px; height: 20px; border-radius: 50%; background: #0891b2; color: #fff; margin: 0 auto 4px; line-height: 20px; font-size: 11px; }
    @media screen { body { background: #e2e8f0; padding: 16px; } .sayfa { background: #fff; padding: 9mm; box-shadow: 0 4px 24px rgba(0,0,0,.15); margin-bottom: 16px; } .yazdir { position: fixed; right: 16px; top: 16px; background: #0f4c81; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 900; cursor: pointer; } }
    @media print { .yazdir { display: none; } }
  </style></head><body>
  <button class="yazdir" onclick="window.print()">🖨 PDF Olarak Kaydet</button>

  <!-- ============================ SAYFA 1 ============================ -->
  <section class="sayfa">
    <div class="ust">
      <div class="logo">Depoevim<small>EŞYA DEPOLAMA · www.depoevim.com</small></div>
      <div class="slogan">Eşyalarınız için<br>en doğru alanı<br>birlikte planlıyoruz.</div>
    </div>
    <div class="iki">
      <div class="kart">
        <div class="baslik">👤 Müşteri Analizi</div>
        <div class="ic">
          <div class="etiket">Müşteri</div><div class="deger">${k(t.musteriAdi || 'Değerli Müşterimiz')}</div>
          <div style="height:6px"></div>
          <div class="uc" style="gap:6px">
            <div><div class="etiket">Müşteri No</div><div class="deger">${k(musteriNo)}</div></div>
            <div><div class="etiket">Tarih</div><div class="deger">${k(bugun)}</div></div>
            <div><div class="etiket">Temsilci</div><div class="deger">${k(gonderen || '—')}</div></div>
          </div>
          <div style="height:10px"></div>
          <div class="etiket">Toplam hacim ihtiyacı</div>
          <div class="buyuk">${ihtiyacAlt}–${kat.m3} <span class="m3">m³</span></div>
          <div class="not">(eşyalarınızın toplam kapladığı alan${ozelMi ? ' — özel ölçü için örnek' : ''})</div>
          <div style="height:10px"></div>
          <div class="etiket">Eşya dağılımı ve tahmini hacim</div>
          <table>
            ${kat.dagilim.map(([ad, m]) => `<tr><td>${k(ad)}</td><td>${m.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³</td></tr>`).join('')}
            <tr class="toplam"><td>Toplam tahmini hacim</td><td>${toplamDagilim.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³</td></tr>
          </table>
          <div class="not" style="margin-top:6px">Not: Bu analiz, beyan ettiğiniz eşya bilgilerine göre hazırlanmıştır. Gerçek hacim, eşyaların ölçülerine ve paketleme şekline göre küçük farklılık gösterebilir.</div>
        </div>
      </div>
      <div class="kart">
        <div class="baslik">📐 3D Alan Analizi — ${k(boyutId)} Oda · ${kat.m3} m³</div>
        <div class="ic">
          <div style="font-size:11px;font-weight:700">Eşyalarınız yaklaşık olarak <b>${ihtiyacAlt}–${kat.m3} m³</b>'lük bir depolama alanı kaplamaktadır. Size <b>${k(boyutId)} Oda</b> (${kat.en.toLocaleString('tr-TR')} × ${kat.boy.toLocaleString('tr-TR')} × ${kat.yuk.toLocaleString('tr-TR')} m) öneriyoruz.</div>
          ${odaSvg}
          <div class="sonuc">
            <div>📦</div>
            <div><div style="font-size:10px;font-weight:800;opacity:.85">SONUÇ</div><div class="b">${kat.m3} m³</div></div>
            <div style="font-size:11px;font-weight:700;line-height:1.3">depolama alanı ihtiyacı<br><span style="opacity:.85">${k(boyutId)} Oda · ${kat.en.toLocaleString('tr-TR')} × ${kat.boy.toLocaleString('tr-TR')} × ${kat.yuk.toLocaleString('tr-TR')} m</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="kart">
      <div class="baslik">✅ Bu odaya neler sığar?</div>
      <div class="ic"><ul class="tik">${kat.sigar.map(x => `<li>${k(x)}</li>`).join('')}</ul>
        <div class="not" style="margin-top:6px">* Ölçüler tahminidir; odalara göre değişiklik gösterebilir.</div></div>
    </div>
    <div class="rozetler">
      <span><i>🛡️</i>Korumalı Depolama</span><span><i>🌡️</i>İdeal Sıcaklık ve Nem</span><span><i>📷</i>7/24 Güvenlik</span><span><i>🚚</i>Kolay Ulaşım</span><span><i>😊</i>Eşyalarınız Her Zaman Güvende</span>
    </div>
    <div class="alt"><span>Depoevim · Eşyalarınız Emin Ellerde</span><span>Doğru hesaplama, daha güvenli bir depolama deneyimi.</span><span>Sayfa 1 / 2</span></div>
  </section>

  <!-- ============================ SAYFA 2 ============================ -->
  <section class="sayfa">
    <div class="ust">
      <div class="logo">Depoevim<small>DEPO ÖZELLİKLERİ · FİYAT TEKLİFİ</small></div>
      <div class="slogan">${k(t.musteriAdi || 'Değerli Müşterimiz')} için<br>hazırlanan teklif<br>${k(bugun)}</div>
    </div>
    <div class="kart">
      <div class="baslik">🏢 Depomuzun Özellikleri</div>
      <div class="ic"><div class="ozellik">
        ${DEPO_SUNUM_OZELLIKLER.map(([ik, b, a]) => `<div><span style="font-size:18px">${ik}</span><span><b>${k(b)}</b>${k(a)}</span></div>`).join('')}
      </div></div>
    </div>
    <div class="iki" style="grid-template-columns:1.2fr 1fr">
      <div class="kart">
        <div class="baslik">💰 Fiyat Teklifi</div>
        <div class="ic">
          <div class="fiyat">
            <div class="satir"><span>${k(boyutId)} Oda · ${kat.m3} m³ · aylık kira</span><span class="tutar">${aylik ? `${tl(aylik)} <small style="font-size:10px">+KDV</small>` : 'Video ile'}</span></div>
            ${aylik ? `<div class="satir"><span>KDV dahil aylık (%${Math.round(TT_KDV * 100)})</span><span style="font-weight:900">${tl(kdvli)}</span></div>` : ''}
            ${aylik && kira.odenecekAy > 1 ? `<div class="satir"><span>${k(kira.ad)} — ${kira.odenecekAy} ay öde, ${kira.toplamAy} ay kullan</span><span class="tutar">${tl(aylik * kira.odenecekAy)} <small style="font-size:10px">+KDV</small></span></div>` : ''}
            ${nakliyeVar ? `<div class="satir"><span>Anahtar teslim nakliye${t.yukIlce || t.yukIl ? ` (${k(ttAdresKisa(t.yukIl, t.yukIlce))} → Depo)` : ''}</span><span class="tutar">${nakliyeFiyat ? tl(nakliyeFiyat) : 'Video ile'}</span></div>` : `<div class="satir"><span>Nakliye</span><span>Eşyalarınızı kendiniz getireceksiniz</span></div>`}
          </div>
          <div class="not" style="margin-top:6px">Nakliye bedeline sigortalı taşıma, kendi ekibimiz, kalıcı ambalaj ve depoya yerleştirme dahildir. Depo sözleşmesi eşyalar depoya yerleştirildikten sonra yapılır; oda numaranız paylaşılır.</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:9px">
        <div class="kampanya"><b>🎁 Uzun dönem kampanyası</b><br>6 Ay Peşin: 5 ay öde, 1 ay hediye${aylik ? ` → <b>${tl(aylik * 5)} +KDV</b>` : ''}<br>12 Ay Peşin: 10 ay öde, 2 ay hediye${aylik ? ` → <b>${tl(aylik * 10)} +KDV</b>` : ''}<br><span class="not">Kredi kartı yalnızca toplu ödemelerde geçerlidir; aylık ödemeler IBAN ile yapılır. Taahhüt yoktur.</span></div>
        <div class="kart"><div class="baslik">📍 Şube</div><div class="ic" style="font-size:11px;font-weight:700">
          ${sube ? `${k(sube.name)}<br><span style="font-weight:500">${k(sube.address)}, ${k(sube.district)}</span>` : `Şube tercihi: farketmez — size en uygun şubemizi birlikte belirleyelim:<br><span style="font-weight:500">${DEPO_LOCATIONS.map(d => k(d.district)).join(' · ')}</span>`}
          ${t.tasinmaTarihi || t.tasinmaNotu ? `<br><span class="etiket" style="display:block;margin-top:6px">Planlanan giriş</span>${k([t.tasinmaTarihi && ttTrTarih(t.tasinmaTarihi), t.tasinmaNotu].filter(Boolean).join(' · '))}` : ''}
        </div></div>
      </div>
    </div>
    <div class="kart">
      <div class="baslik">🧭 Süreç Nasıl İşler?</div>
      <div class="ic"><div class="adim">
        <div><b>1</b>Eşya videosunu gönderin, net fiyatı iletelim</div>
        <div><b>2</b>Dilerseniz depomuzu gelip görün</div>
        <div><b>3</b>%20 kapora ile tarihiniz kesinleşsin</div>
        <div><b>4</b>Ekibimiz adresinizden alsın, depoya yerleştirsin</div>
        <div><b>5</b>Sözleşme + oda numaranız size iletilsin</div>
      </div></div>
    </div>
    <div class="alt"><span>Müşteri Temsilciniz: <b>${k(gonderen || 'Depoevim')}</b> · ${k(QR_SIRKET_TELEFONU)}</span><span>www.depoevim.com</span><span>Sayfa 2 / 2</span></div>
  </section>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>
  </body></html>`;

  const pencere = window.open('', '_blank');
  if (!pencere) { alert('Tarayıcı yeni pencereyi engelledi. Açılır pencere iznini verip tekrar deneyin.'); return; }
  pencere.document.open(); pencere.document.write(html); pencere.document.close();
};


// ############################################################################
//  YENİ (kullanıcı talebi): EVDEN EVE NAKLİYAT SUNUMU — 2 SAYFALIK PDF
// ----------------------------------------------------------------------------
//  Yalnızca EVDEN EVE NAKLİYAT görüşmelerinde "PDF Sunum İndir" ile üretilir.
//  Düzen "Sembol Nakliyat Teklif – Hizmet Sunumu" (kırmızı başlık, TEKLİF #,
//  Açıklama/Toplam, Koşul ve Şartlar); içerik "Sembol Nakliyat Ön Bilgilendirme"
//  sunumundan (süreç, kurallar, hizmetler, yapılmayan hizmetler, iletişim).
//  Sayfa 1: Müşteri + güzergâh · taşıma analizi (m³ + ARAÇ görseli) · adres
//           detayları · taşıma günü
//  Sayfa 2: Fiyat teklifi · dahil hizmetler · koşul ve şartlar · neden Sembol ·
//           yapılmayan hizmetler · iletişim
// ############################################################################
// Ev tipine göre tahmini hacim ve araç (kullanıcı bilgisi)
const NAKLIYE_SUNUM_ARAC = {
  '1+0': { m3: 10, arac: 'Panelvan', tip: 'panelvan', ekip: '2 kişilik ekip', koli: '15–20 koli' },
  '1+1': { m3: 15, arac: 'Panelvan', tip: 'panelvan', ekip: '3 kişilik ekip', koli: '25–35 koli' },
  '2+1': { m3: 25, arac: 'Kamyonet', tip: 'kamyonet', ekip: '3–4 kişilik ekip', koli: '40–50 koli' },
  '3+1': { m3: 33, arac: 'Kamyon', tip: 'kamyon', ekip: '4–5 kişilik ekip', koli: '60–70 koli' },
  '4+1': { m3: 40, arac: 'Kamyon', tip: 'kamyon', ekip: '5–6 kişilik ekip', koli: '80–90 koli' },
};
const NAKLIYE_SUNUM_ODA = (oda) => (NAKLIYE_SUNUM_ARAC[oda] ? oda : oda === 'Villa' ? '4+1' : oda === 'Ofis' ? '3+1' : oda === 'Parça Eşya' ? '1+0' : '2+1');
// Sembol Nakliyat iletişim (Ön Bilgilendirme sunumu)
const SEMBOL_ILETISIM = {
  adres: 'Bahçelievler Mah. Yeni Sok. No 5 C Pendik / İstanbul',
  tel: '0 216 390 89 99', eposta: 'sembolnakliyatbusiness@gmail.com', web: 'www.sembolevdeneve.com',   // DEĞİŞTİ (kullanıcı talebi)
  saat: 'Hafta içi 09.00 – 19.00 · Hafta sonu 10.00 – 17.00',
};

// Araç görseli — panelvan / kamyonet / kamyon (hacme göre kasa boyu değişir)
const nakliyeAracSvg = (tip, m3) => {
  const R = '#c81e2b';
  const tekerlek = (x) => `<circle cx="${x}" cy="168" r="17" fill="#1f2937"/><circle cx="${x}" cy="168" r="7" fill="#9ca3af"/>`;
  const logo = (x, y) => `<text x="${x}" y="${y}" font-size="15" font-weight="900" fill="#fff" font-family="Arial">SEMBOL</text><text x="${x}" y="${y + 13}" font-size="7" font-weight="700" fill="#fee2e2" font-family="Arial">NAKLİYAT · SİGORTALI TAŞIMA</text>`;
  if (tip === 'panelvan') return `
    <svg viewBox="0 0 360 200" width="100%" height="205" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="180" cy="186" rx="150" ry="7" fill="#e5e7eb"/>
      <path d="M40 150 L40 70 Q40 55 55 55 L230 55 Q248 55 258 70 L300 115 Q310 122 310 135 L310 150 Z" fill="${R}"/>
      <path d="M236 64 L262 64 Q268 64 272 70 L296 108 L236 108 Z" fill="#bfdbfe"/>
      <rect x="40" y="140" width="270" height="12" fill="#991b1b"/>
      ${logo(70, 100)}
      <text x="70" y="130" font-size="10" font-weight="800" fill="#fff" font-family="Arial">${m3} m³ PANELVAN</text>
      ${tekerlek(95)}${tekerlek(260)}
    </svg>`;
  const kasaBoy = tip === 'kamyonet' ? 190 : (m3 >= 40 ? 225 : 210);
  const kasaY = tip === 'kamyonet' ? 58 : 40;
  const kx = 30;
  return `
    <svg viewBox="0 0 380 200" width="100%" height="205" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="190" cy="186" rx="170" ry="7" fill="#e5e7eb"/>
      <rect x="${kx}" y="${kasaY}" width="${kasaBoy}" height="${150 - kasaY}" rx="6" fill="#f8fafc" stroke="${R}" stroke-width="4"/>
      <rect x="${kx}" y="${kasaY}" width="${kasaBoy}" height="26" rx="6" fill="${R}"/>
      <text x="${kx + 14}" y="${kasaY + 18}" font-size="13" font-weight="900" fill="#fff" font-family="Arial">SEMBOL NAKLİYAT</text>
      <text x="${kx + 14}" y="${kasaY + 60}" font-size="26" font-weight="900" fill="${R}" font-family="Arial">${m3} m³</text>
      <text x="${kx + 14}" y="${kasaY + 78}" font-size="10" font-weight="800" fill="#475569" font-family="Arial">${tip === 'kamyonet' ? 'KAMYONET' : 'KAMYON'} · KAPALI KASA</text>
      <path d="M${kx + kasaBoy + 6} 150 L${kx + kasaBoy + 6} 75 L${kx + kasaBoy + 70} 75 L${kx + kasaBoy + 100} 110 L${kx + kasaBoy + 100} 150 Z" fill="${R}"/>
      <path d="M${kx + kasaBoy + 16} 84 L${kx + kasaBoy + 64} 84 L${kx + kasaBoy + 86} 108 L${kx + kasaBoy + 16} 108 Z" fill="#bfdbfe"/>
      <rect x="${kx}" y="146" width="${kasaBoy + 100}" height="10" fill="#374151"/>
      ${tekerlek(kx + 45)}${tip === 'kamyon' ? tekerlek(kx + 85) : ''}${tekerlek(kx + kasaBoy + 60)}
    </svg>`;
};

const nakliyeSunumuIndir = (tHam, gonderen = '') => {
  const t = ttNormalize(tHam);
  const k = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const odaK = NAKLIYE_SUNUM_ODA(t.odaSayisi);
  const arac = NAKLIYE_SUNUM_ARAC[odaK];
  const odaAd = TT_ODA_SECENEKLERI.find(o => o.id === t.odaSayisi)?.ad || t.odaSayisi || odaK;
  const hesap = ttFiyatHesapla(t);
  const fiyat = ttFiyatSayi(t.verilenFiyat) || ttAcilisFiyati(hesap.nakliyeToplam, 'Nakliye');
  const sehirlerArasi = hesap.tur === 'sehirlerArasi';
  const bugunD = new Date();
  const trT = (d) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const gecerlilik = new Date(bugunD); gecerlilik.setDate(gecerlilik.getDate() + 7);
  const teklifNo = String(t.id || '').replace(/\D/g, '').slice(-4) || String(Date.now()).slice(-4);
  const tl = (n) => `${Math.round(Number(n) || 0).toLocaleString('tr-TR')} ₺`;
  const tasimaMetni = (v) => (v === 'Dış Cephe Asansörü' ? 'Dış cephe asansörü' : v === 'Bina Asansörü' ? 'Bina asansörü' : v === 'Merdiven' ? 'Merdivenden' : '—');
  const yanasmaMetni = (v) => TT_YANASMA.find(y => y.id === v)?.ad || '—';
  const adresTam = (il, ilce, acik) => [acik, ilce, il].filter(Boolean).join(', ') || '—';
  const tarih = [t.tasinmaTarihi && ttTrTarih(t.tasinmaTarihi), t.tasinmaNotu].filter(Boolean).join(' · ') || 'Birlikte planlanacak';
  const disCephe = t.yukTasima === 'Dış Cephe Asansörü' || t.bosTasima === 'Dış Cephe Asansörü';
  const toplama = t.toplama === 'Firma';
  const dosyaAdi = `Sembol-Nakliyat-Tasima-Sunumu-${(t.musteriAdi || 'Musteri').trim().replace(/\s+/g, '-')}`;
  // Fiyata dahil hizmetler (seçimlere göre)
  const dahil = [
    'Sigortalı taşıma (firma güvencesi)',
    'Kadrolu, uzman taşıma ekibi',
    'Mobilya ustası ile söküm – montaj',
    'Özel ambalaj ve kaliteli, hijyenik malzeme',
    `${arac.m3} m³ ${arac.arac.toLowerCase()} ile kapalı kasa taşıma`,
    'Askılı kıyafetler için modüler elbise dolabı',
    ...(toplama ? ['Küçük eşya toplama – kolileme (kırılacaklar özel ambalajla)'] : []),
    ...(disCephe ? ['Dış cephe asansörü ile asansörlü taşıma'] : []),
  ];

  // DEĞİŞTİ (kullanıcı talebi): logo simgesi kaldırıldı, başlık ORTALANDI
  const ust = (sayfa) => `
    <div class="ust" style="display:block;text-align:center">
      <div class="logo">SEMBOL NAKLİYAT</div>
      <div class="alt-logo">EVDEN EVE · ASANSÖRLÜ TAŞIMA · DEPOLAMA</div>
      <div class="ofis">${k(SEMBOL_ILETISIM.adres)} · ${k(SEMBOL_ILETISIM.tel)} · ${k(SEMBOL_ILETISIM.web)}</div>
      <div class="teklif" style="text-align:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.35)">
        <span class="no">TEKLİF #${k(teklifNo)}</span>
        <span style="margin:0 8px;opacity:.6">|</span>Tarih: ${trT(bugunD)}
        <span style="margin:0 8px;opacity:.6">|</span>Geçerlilik: ${trT(gecerlilik)}
        <span style="margin:0 8px;opacity:.6">|</span>Sayfa ${sayfa} / 2
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${k(dosyaAdi)}</title>
  <style>
    @page { size: A4 portrait; margin: 9mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
    .sayfa { width: 192mm; min-height: 277mm; margin: 0 auto; page-break-after: always; display: flex; flex-direction: column; gap: 9px; }
    .sayfa:last-child { page-break-after: auto; }
    .ust { background: #c81e2b; color: #fff; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: flex-start; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: .5px; } .alt-logo { font-size: 9.5px; font-weight: 800; letter-spacing: 1px; opacity: .95; }
    .ofis { font-size: 9.5px; margin-top: 6px; opacity: .9; }
    .teklif { text-align: right; font-size: 10.5px; line-height: 1.5; } .teklif .no { font-size: 17px; font-weight: 900; letter-spacing: 1px; }
    .baslik { background: #111827; color: #fff; font-weight: 900; font-size: 11.5px; padding: 6px 12px; letter-spacing: .3px; }
    .kart { border: 1.5px solid #fecaca; border-radius: 10px; overflow: hidden; background: #fff; }
    .kart .ic { padding: 10px 12px; }
    .iki { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
    /* Her yazdırma motorunda (eski WebKit dahil) yan yana kalması için tablo düzeni */
    table.duzen { width: 100%; border-collapse: separate; border-spacing: 9px 0; margin: 0 -9px; table-layout: fixed; }
    table.duzen > tbody > tr > td { vertical-align: top; padding: 0; border: 0; }
    table.kutular { width: 100%; border-collapse: separate; border-spacing: 5px 0; table-layout: fixed; margin: 0 -5px; }
    table.kutular td { border: 1px solid #fecaca; border-radius: 8px; padding: 7px 5px; font-size: 9.5px; font-weight: 700; text-align: center; vertical-align: top; }
    table.kutular td b { display: block; width: 20px; height: 20px; border-radius: 50%; background: #c81e2b; color: #fff; margin: 0 auto 4px; line-height: 20px; font-size: 11px; }
    table.istat2 { width: 100%; border-collapse: separate; border-spacing: 5px 0; table-layout: fixed; margin: 0 -5px; }
    table.istat2 td { background: #fef2f2; border-radius: 8px; padding: 7px 4px; text-align: center; border: 0; }
    table.istat2 b { display: block; font-size: 18px; font-weight: 900; color: #c81e2b; } table.istat2 span { font-size: 9.5px; font-weight: 800; color: #6b7280; }
    .etiket { font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
    .deger { font-size: 12.5px; font-weight: 800; }
    .buyuk { font-size: 30px; font-weight: 900; color: #c81e2b; line-height: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-size: 10px; color: #6b7280; padding: 4px; border-bottom: 2px solid #f97316; }
    td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; }
    .rota { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 900; }
    .rota .ok { color: #c81e2b; font-size: 18px; }
    ul.tik { list-style: none; padding: 0; margin: 0; font-size: 11px; font-weight: 700; }
    ul.tik li { padding: 3px 0 3px 18px; position: relative; } ul.tik li:before { content: "✔"; position: absolute; left: 0; color: #c81e2b; font-weight: 900; }
    ul.iki-sutun { columns: 2; column-gap: 14px; } ul.iki-sutun li { break-inside: avoid; }
    .gun { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .gun div, .adim div { border: 1px solid #fecaca; border-radius: 8px; padding: 7px 6px; font-size: 9.5px; font-weight: 700; text-align: center; }
    .gun b, .adim b { display: block; width: 20px; height: 20px; border-radius: 50%; background: #c81e2b; color: #fff; margin: 0 auto 4px; line-height: 20px; font-size: 11px; }
    .adim { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
    .fiyat td:last-child { text-align: right; font-weight: 900; }
    .toplam { display: flex; justify-content: flex-end; align-items: baseline; gap: 10px; border-top: 2px solid #f97316; padding-top: 8px; margin-top: 4px; }
    .toplam span { font-size: 12px; font-weight: 800; color: #6b7280; } .toplam b { font-size: 26px; font-weight: 900; color: #c81e2b; }
    .istat { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center; }
    .istat div { background: #fef2f2; border-radius: 8px; padding: 7px 4px; } .istat b { display: block; font-size: 18px; font-weight: 900; color: #c81e2b; } .istat span { font-size: 9.5px; font-weight: 800; color: #6b7280; }
    .yapilmaz div { font-size: 10.5px; padding: 3px 0; } .yapilmaz b { color: #b91c1c; }
    .not { font-size: 9.5px; color: #6b7280; font-style: italic; }
    .alt { margin-top: auto; border-top: 2px solid #c81e2b; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 700; }
    .alt .t { color: #c81e2b; font-weight: 900; }
    @media screen { body { background: #e5e7eb; padding: 16px; } .sayfa { background: #fff; padding: 9mm; box-shadow: 0 4px 24px rgba(0,0,0,.15); margin-bottom: 16px; } .yazdir { position: fixed; right: 16px; top: 16px; background: #c81e2b; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 900; cursor: pointer; } }
    @media print { .yazdir { display: none; } }
  </style></head><body>
  <button class="yazdir" onclick="window.print()">🖨 PDF Olarak Kaydet</button>

  <!-- ============================ SAYFA 1 ============================ -->
  <section class="sayfa">
    ${ust(1)}
    <table class="duzen"><tr><td>
      <div class="kart"><div class="baslik">MÜŞTERİ</div><div class="ic">
        <div class="deger" style="font-size:15px">${k(t.musteriAdi || 'Değerli Müşterimiz')}</div>
        <div style="font-size:11px;font-weight:600;color:#374151">${k(ttTelGoster(t.telefon) || '')}</div>
        <div style="height:8px"></div>
        <div class="etiket">Taşınma tarihi</div><div class="deger">${k(tarih)}</div>
        <div style="height:6px"></div>
        <div class="etiket">Müşteri temsilciniz</div><div class="deger">${k(gonderen || 'Sembol Nakliyat')}</div>
      </div></div>
      </td><td>
      <div class="kart"><div class="baslik">PROJE AÇIKLAMASI</div><div class="ic">
        <div class="deger">${k(odaAd)} ev taşıma · ${sehirlerArasi ? 'Şehirler arası' : 'Şehir içi'}</div>
        <div style="height:8px"></div>
        <div class="rota"><span>${k(ttAdresKisa(t.yukIl, t.yukIlce) || 'Yükleme')}</span><span class="ok">➜</span><span>${k(ttAdresKisa(t.bosIl, t.bosIlce) || 'Boşaltma')}</span></div>
        <div style="height:8px"></div>
        <div class="etiket">Küçük eşya toplama</div><div class="deger">${toplama ? 'Firmamız toplayacak (kolileme dahil)' : 'Müşteri tarafından toplanacak'}</div>
      </div></div>
    </td></tr></table>

    <div class="kart"><div class="baslik">🚚 TAŞIMA ANALİZİ — ARACINIZ</div><div class="ic">
      <table class="duzen"><tr><td style="width:56%;vertical-align:middle">
        ${nakliyeAracSvg(arac.tip, arac.m3)}
        </td><td style="vertical-align:middle">
          <div class="etiket">Tahmini eşya hacmi</div><div class="buyuk">${arac.m3} <span style="font-size:16px">m³</span></div>
          <div style="height:6px"></div>
          <div class="etiket">Araç</div><div class="deger">${arac.m3} m³ ${k(arac.arac)} · kapalı kasa</div>
          <div style="height:6px"></div>
          <div class="etiket">Tahmini ekip / koli</div><div class="deger">${k(arac.ekip)} · ${k(arac.koli)}</div>
          ${t.odaSayisi === 'Villa' ? '<div class="not" style="margin-top:6px">5+1 / villa taşımalarında eşya durumuna göre ikinci araç planlanabilir.</div>' : ''}
          ${t.odaSayisi === 'Ofis' ? '<div class="not" style="margin-top:6px">Kurumsal taşımalarda araç ve ekip keşif sonrası kesinleşir.</div>' : ''}
        </td></tr></table>
      <div class="not">Hacim ve araç, beyan edilen ev tipine göre tahminidir; eşya videosu ile kesinleşir. Güçlü filomuzda eşyanızın durumuna göre her büyüklükte araç mevcuttur.</div>
    </div></div>

    <div class="kart"><div class="baslik">📍 ADRES DETAYLARI</div><div class="ic">
      <table>
        <tr><th></th><th>Yükleme (mevcut ev)</th><th>Boşaltma (yeni ev)</th></tr>
        <tr><td class="etiket">Adres</td><td>${k(adresTam(t.yukIl, t.yukIlce, t.yukAdres))}</td><td>${k(adresTam(t.bosIl, t.bosIlce, t.bosAdres))}</td></tr>
        <tr><td class="etiket">Kat</td><td>${k(t.yukKat || '—')}</td><td>${k(t.bosKat || '—')}</td></tr>
        <tr><td class="etiket">Taşıma şekli</td><td>${k(tasimaMetni(t.yukTasima))}</td><td>${k(tasimaMetni(t.bosTasima))}</td></tr>
        <tr><td class="etiket">Araç yanaşma</td><td>${k(yanasmaMetni(t.yukMesafe))}</td><td>${k(yanasmaMetni(t.bosMesafe))}</td></tr>
      </table>
    </div></div>

    <div class="kart"><div class="baslik">🕘 TAŞINMA GÜNÜ NASIL GEÇER?</div><div class="ic"><table class="kutular"><tr>
      <td><b>1</b>Sabah 09.00'da ekibimiz adresinizde</td>
      <td><b>2</b>Ustalarımız mobilyaları söker, özel ambalajlar</td>
      <td><b>3</b>Eşyalar ${arac.m3} m³ kapalı kasa araçla taşınır</td>
      <td><b>4</b>Yeni adresinizde kusursuz kurulum</td>
    </tr></table></div></div>
    <div class="alt"><span class="t">Tüm süreci profesyonel ve sorunsuz yaşamanız için buradayız.</span><span>${k(SEMBOL_ILETISIM.web)}</span></div>
  </section>

  <!-- ============================ SAYFA 2 ============================ -->
  <section class="sayfa">
    ${ust(2)}
    <div class="kart"><div class="baslik">💰 FİYAT TEKLİFİ</div><div class="ic">
      <table class="fiyat">
        <tr><th>AÇIKLAMA</th><th style="text-align:right">TOPLAM</th></tr>
        <tr><td>Nakliye Hizmet Bedeli — ${k(odaAd)}, ${k(ttAdresKisa(t.yukIl, t.yukIlce))} ➜ ${k(ttAdresKisa(t.bosIl, t.bosIlce))}</td><td>${fiyat ? tl(fiyat) : 'Video sonrası'}</td></tr>
        ${toplama ? '<tr><td>Küçük eşya toplama – kolileme</td><td>Dahil</td></tr>' : ''}
        ${disCephe ? '<tr><td>Dış cephe asansörü kurulumu</td><td>Dahil</td></tr>' : ''}
      </table>
      <div class="toplam"><span>TOPLAM FİYAT:</span><b>${fiyat ? tl(fiyat) : 'Video sonrası netleşir'}</b></div>
      <div style="height:8px"></div>
      <div class="etiket" style="margin-bottom:3px">Fiyata dahil hizmetler</div>
      <table class="duzen"><tr>
        <td><ul class="tik">${dahil.slice(0, Math.ceil(dahil.length / 2)).map(x => `<li>${k(x)}</li>`).join('')}</ul></td>
        <td><ul class="tik">${dahil.slice(Math.ceil(dahil.length / 2)).map(x => `<li>${k(x)}</li>`).join('')}</ul></td>
      </tr></table>
    </div></div>

    <table class="duzen"><tr><td>
      <div class="kart"><div class="baslik">📄 KOŞUL VE ŞARTLAR</div><div class="ic"><ul class="tik">
        <li>Kesin fiyat, eşya video / fotoğrafı gönderildikten sonra verilir.</li>
        <li>Kayıt taşımadan 15 gün öncesine kadar açılabilir; verilen fiyat geçerlidir.</li>
        <li>Kayıtta iş bedelinin %20'si kapora olarak alınır.</li>
        <li>${sehirlerArasi ? 'Eşya araca yüklendikten sonra %50 ödeme alınır; kalan tutar teslimde ödenir.' : 'Kalan ödeme iş bitiminde şirket hesabına ya da ekip şefimize yapılır.'}</li>
        <li>72 saat öncesine kadar kapora hariç ücretsiz iptal veya erteleme yapılır.</li>
        <li>Tüm anlaşmalarda sözleşme PDF olarak gönderilir.</li>
      </ul></div></div>
      </td><td>
      <div class="kart"><div class="baslik">⭐ NEDEN SEMBOL NAKLİYAT?</div><div class="ic">
        <table class="istat2"><tr>
          <td><b>2004</b><span>'ten beri</span></td><td><b>20 Bin+</b><span>ev taşıma</span></td>
          <td><b>25</b><span>çalışan</span></td><td><b>10</b><span>araç</span></td>
        </tr></table>
        <div style="height:8px"></div>
        <ul class="tik">
          <li>Uygun fiyat — verilen hizmete göre en iyi fiyat</li>
          <li>Kadrolu, tecrübeli personel</li>
          <li>Dayanıklı ve hijyenik ambalaj malzemesi</li>
          <li>Güçlü filo — her büyüklükte kamyon</li>
          <li>Sigortalı taşıma, firma güvencesi</li>
        </ul>
      </div></div>
    </td></tr></table>

    <div class="kart"><div class="baslik">🧭 BİZİMLE TAŞINMAK İÇİN</div><div class="ic"><table class="kutular"><tr>
      <td><b>1</b>Teklif: soruları eksiksiz cevaplayın</td>
      <td><b>2</b>Fiyat: video ile kesin fiyat</td>
      <td><b>3</b>Randevu: 15 gün önce kayıt</td>
      <td><b>4</b>Kapora: iş bedelinin %20'si</td>
      <td><b>5</b>Sözleşme: PDF olarak iletilir</td>
      <td><b>6</b>Taşınma: 09.00'da ekip kapıda</td>
    </tr></table></div></div>

    <div class="kart"><div class="baslik">ℹ️ YAPILMAYAN HİZMETLER</div><div class="ic yapilmaz">
      <div><b>Duvar montajı:</b> Yalnızca modüler mobilyaların söküm ve montajı yapılır.</div>
      <div><b>Elektrik işlemi:</b> Avizelerin sökümü ve taşıması yapılır; elektrik bağlantısı yapılmaz.</div>
      <div><b>Klima montajı:</b> Klima söküm-montajı yapılmaz; beyaz eşya söküm ve montajı mevcuttur.</div>
    </div></div>

    <!-- KALDIRILDI (kullanıcı talebi): 2. sayfa alt şeridi (temsilci · telefon · çalışma saatleri) -->
  </section>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>
  </body></html>`;

  const pencere = window.open('', '_blank');
  if (!pencere) { alert('Tarayıcı yeni pencereyi engelledi. Açılır pencere iznini verip tekrar deneyin.'); return; }
  pencere.document.open(); pencere.document.write(html); pencere.document.close();
};

// CSV (Excel) dışa aktarma — Türkçe Excel için ";" ayırıcı ve BOM
const ttCsvIndir = (list) => {
  const S = [
    ['Görüşme Tarihi', t => ttTrTarih(t.iletisimTarihi)], ['Satışçı', t => ttSahibi(t)], ['Hizmet', t => t.hizmetTipi],
    ['Müşteri', t => t.musteriAdi], ['Telefon', t => ttTelGoster(t.telefon)],
    ['Tarih', t => [t.tasinmaTarihi && ttTrTarih(t.tasinmaTarihi), t.tasinmaNotu].filter(Boolean).join(' ')],
    ['Güzergâh', t => ttGuzergah(t)], ['Ev Tipi / Depo', t => t.hizmetTipi === 'Nakliye' ? t.odaSayisi : t.depoBoyutu],
    ['Yükleme Kat/Taşıma', t => ttKatTasima(t.yukKat, t.yukTasima)], ['Boşaltma Kat/Taşıma', t => ttKatTasima(t.bosKat, t.bosTasima)],
    ['Toplama', t => t.toplama], ['Video', t => t.videoDurumu], ['Sistem Fiyatı', t => t.sistemFiyati], ['Söylenen Fiyat', t => t.verilenFiyat],
    ['Depo Aylık', t => t.depoAylik], ['Durum', t => ttDurumBul(t.durum).etiket], ['Tekrar Arama', t => ttTrTarih(t.takipTarihi)], ['Açıklama', t => t.aciklama],
  ];
  const k = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const satirlar = [S.map(s => k(s[0])).join(';'), ...list.map(ttNormalize).map(t => S.map(s => k(s[1](t))).join(';'))];
  const blob = new Blob(['\uFEFF' + satirlar.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `telefon-teklifleri-${ttBugunStr()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

// ================================================================ SAYFA ===
// Props: teklifler (tümü), currentUser, satiscilar (ad listesi), tamYetki,
//        gecmisIndeksi, onKayitAc, addSystemLog, acilisFormu (havuzdan gelen
//        ön doldurma), onAcilisFormuKullanildi, onHavuzKaydinaIsle, onGeri
const TelefonTeklifleriView = ({ teklifler = [], currentUser, satiscilar = [], tamYetki = false, gecmisIndeksi = null, addSystemLog, onKayitAc = null,
  acilisFormu = null, onAcilisFormuKullanildi, onHavuzKaydinaIsle, onGeri,
  acilisDetayId = null, onAcilisDetayKullanildi,
  istatistikGoster = true }) => {   // YENİ: sayaç kutuları (Müşteri Havuzu'nda "Görüşme İstatistikleri" düğmesiyle)
  const [form, setForm] = useState(null);             // { baslangic, hizmet } — açık sihirbaz
  const [detayId, setDetayId] = useState(null);
  const [waKayit, setWaKayit] = useState(null);        // { t, sablon } — WhatsApp penceresi
  const [transferKayit, setTransferKayit] = useState(null);
  const [silinecek, setSilinecek] = useState(null);
  const [arama, setArama] = useState('');
  const [hizmetFiltre, setHizmetFiltre] = useState('Tümü');
  const [durumFiltre, setDurumFiltre] = useState('Tümü');
  const [takipFiltre, setTakipFiltre] = useState('Tümü');
  const [ayFiltre, setAyFiltre] = useState('Tümü');
  // DEĞİŞTİ (kullanıcı talebi): yöneticide de ekran KİŞİYE ÖZEL açılır ('__ben' = kendi ekranı).
  // Yönetici bir satışçı seçince o satışçının Telefon Görüşmesi ekranını birebir görür.
  // Değerler: '__ben' | satışçı adı | 'Tümü' (tüm satışçılar) | '__yok' (atanmamış)
  const [sahipFiltre, setSahipFiltre] = useState(tamYetki ? '__ben' : 'Tümü');
  const [kaynakFiltre, setKaynakFiltre] = useState('Tümü'); // YENİ: Manuel / Hızlı Teklif görüşmeleri

  const kullanici = currentUser?.fullName || 'Sistem';

  // Havuzdaki "Görüşme Formu" butonundan gelindiyse sihirbaz dolu açılır
  useEffect(() => {
    if (acilisFormu) { setForm({ baslangic: acilisFormu, hizmet: acilisFormu.hizmetTipi || 'Nakliye' }); onAcilisFormuKullanildi?.(); }
  }, [acilisFormu]); // eslint-disable-line react-hooks/exhaustive-deps
  // YENİ: havuzdaki "Görüşmeye Bak" → ilgili görüşmenin detayı açılır
  useEffect(() => {
    if (acilisDetayId) { setDetayId(acilisDetayId); onAcilisDetayKullanildi?.(); }
  }, [acilisDetayId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Görünür kayıtlar (kendi / tümü) → filtreler bunun üzerine uygulanır
  const gorunur = useMemo(() => teklifler.filter(t => ttGorunurMu(t, kullanici, tamYetki)), [teklifler, kullanici, tamYetki]);
  // YENİ: yöneticinin şu an kimin ekranına baktığı (satışçıda filtre uygulanmaz)
  const ekranSahibi = sahipFiltre === '__ben' ? kullanici : sahipFiltre;
  const ekranUyar = (t) => !tamYetki || sahipFiltre === 'Tümü'
    || (sahipFiltre === '__yok' ? !ttSahibi(t) : ttSahibi(t) === ekranSahibi);
  const baskasininEkrani = tamYetki && sahipFiltre !== '__ben';
  const hizmetli = useMemo(() => gorunur.filter(t => hizmetFiltre === 'Tümü' || (t.hizmetTipi || 'Nakliye') === hizmetFiltre)
    .filter(t => kaynakFiltre === 'Tümü' || ttKaynakTuru(t) === kaynakFiltre)
    .filter(t => ekranUyar(t)), [gorunur, hizmetFiltre, kaynakFiltre, sahipFiltre]); // eslint-disable-line react-hooks/exhaustive-deps
  const ozet = useMemo(() => ttOzet(hizmetli), [hizmetli]);
  const aylar = useMemo(() => [...new Set(gorunur.map(t => (t.iletisimTarihi || '').slice(0, 7)).filter(Boolean))].sort().reverse(), [gorunur]);
  const ayAdi = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const sahipler = useMemo(() => [...new Set([...satiscilar, ...teklifler.map(ttSahibi)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [satiscilar, teklifler]);

  const liste = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR');
    const qTel = ttTelAnahtar(arama) || arama.replace(/\D/g, '');
    return hizmetli.filter(t => {
      if (durumFiltre !== 'Tümü' && (t.durum || 'Yeni') !== durumFiltre) return false;
      if (ayFiltre !== 'Tümü' && !(t.iletisimTarihi || '').startsWith(ayFiltre)) return false;
      const td = ttTakipDurumu(t);
      if (takipFiltre === 'Bugün' && td !== 'bugun') return false;
      if (takipFiltre === 'Geciken' && td !== 'gecikti') return false;
      if (takipFiltre === 'Takipsiz' && td !== 'yok') return false;
      if (q) {
        const n = ttNormalize(t);
        const metin = [n.musteriAdi, n.yukIlce, n.bosIlce, n.yukAdres, n.bosAdres, n.aciklama, ttSahibi(n)].join(' ').toLocaleLowerCase('tr-TR');
        // Telefon aramasında 0'lı/0'sız/boşluklu yazım fark etmez
        const telUyar = qTel.length >= 4 && ttTelAnahtar(n.telefon).includes(qTel.replace(/^0/, ''));
        if (!metin.includes(q) && !telUyar) return false;
      }
      return true;
    });
  }, [hizmetli, arama, durumFiltre, ayFiltre, takipFiltre]);

  const detay = teklifler.find(t => t.id === detayId) || null;
  // YENİ (kullanıcı talebi): ekranda ilk 50 görüşme; "Devamını Gör" her tıklamada 50 daha açar.
  // Filtre / arama / ekran seçimi değişince sınır yeniden 50 olur.
  const TT_SAYFA = 50;
  const [gosterimSiniri, setGosterimSiniri] = useState(TT_SAYFA);
  useEffect(() => { setGosterimSiniri(TT_SAYFA); }, [arama, hizmetFiltre, durumFiltre, takipFiltre, ayFiltre, sahipFiltre, kaynakFiltre]);
  const gorunenListe = liste.slice(0, gosterimSiniri);
  const kalanSayi = Math.max(0, liste.length - gorunenListe.length);
  const gecmisOf = (t) => musteriGecmisiBul(gecmisIndeksi, t.telefon, t.id);
  const durumSayisi = (id) => id === 'Tümü' ? hizmetli.length : hizmetli.filter(t => (t.durum || 'Yeni') === id).length;

  // ------------------------------------------------------ FIRESTORE YAZMA ---
  const hareket = (islem) => ({ tarih: new Date().toISOString(), kullanici, islem });
  const guncelle = async (t, degisiklik, islem) => {
    const canli = teklifler.find(x => x.id === t.id) || t; // Güncel geçmiş üzerine yazılır
    await updateDoc(ttBelge(t.id), { ...degisiklik, updatedAt: new Date().toISOString(), hareketler: [...(canli.hareketler || []), hareket(islem)] });
  };

  const kaydet = async (veri) => {
    // Formdan yalnızca FORM alanları yazılır; notlar/süreç/geçmiş eski kopyayla ezilmez
    const { id: _id, notlar: _n, hareketler: _h, surecAdimlari: _s, createdAt: _c, olusturan: _o, atanan: _a, kayitAcildi: _k, yeniNot, ...alanlar } = veri;
    // YENİ (kullanıcı talebi): sihirbazdaki görüşme notu notlar listesine eklenir
    const notKaydi = (yeniNot || '').trim() ? { tarih: new Date().toISOString(), kullanici, metin: yeniNot.trim() } : null;
    // Havuzdan aktarılan kayıt henüz listeye düşmemiş olabilir → açılış verisi kullanılır
    const duzenlenen = form?.baslangic?.id ? (teklifler.find(x => x.id === form.baslangic.id) || form.baslangic) : null;
    if (duzenlenen) {
      await guncelle(duzenlenen, { ...alanlar, ...(notKaydi ? { notlar: [...(duzenlenen.notlar || []), notKaydi] } : {}) }, notKaydi ? 'Görüşme cevapları güncellendi • not eklendi' : 'Görüşme cevapları güncellendi');
      addSystemLog?.('Telefon Görüşmesi', `${alanlar.musteriAdi || alanlar.telefon} güncellendi.`);
      setDetayId(duzenlenen.id);   // Kaydedince detay (WhatsApp butonlarıyla) açık gelir
    } else {
      const ref = await addDoc(ttKoleksiyon(), {
        ...alanlar, notlar: notKaydi ? [notKaydi] : [], surecAdimlari: {}, olusturan: kullanici, atanan: kullanici,
        createdAt: new Date().toISOString(), hareketler: [hareket(`Telefon görüşmesi kaydedildi (${alanlar.hizmetTipi}${alanlar.sistemFiyati ? `, sistem fiyatı ${ttTl(alanlar.sistemFiyati)}` : ''})`)],
      });
      addSystemLog?.('Telefon Görüşmesi', `Yeni telefon teklifi: ${alanlar.musteriAdi || alanlar.telefon} (${alanlar.hizmetTipi})`);
      // Havuzdaki bir talepten başlatıldıysa o talebe de işlenir
      if (alanlar.havuzKayitId) onHavuzKaydinaIsle?.(alanlar.havuzKayitId, `Telefon görüşme formu dolduruldu${alanlar.verilenFiyat ? ` — fiyat ${alanlar.verilenFiyat} ₺` : ''}`);
      setDetayId(ref.id);
    }
    setForm(null);
  };

  const durumDegistir = async (t, yeni) => {
    const eski = t.durum || 'Yeni';
    if (eski === yeni) return;
    await guncelle(t, { durum: yeni }, `Durum "${eski}" → "${yeni}" olarak değiştirildi`);
    addSystemLog?.('Telefon Görüşmesi', `${t.musteriAdi || t.telefon}: durum "${yeni}" yapıldı.`);
  };
  const surecIsaretle = async (t, adim, deger) => {
    const canli = teklifler.find(x => x.id === t.id) || t;
    await updateDoc(ttBelge(t.id), {
      [`surecAdimlari.${adim.id}`]: deger ? new Date().toISOString() : false,
      hareketler: [...(canli.hareketler || []), hareket(`${deger ? '✓' : '✗'} ${adim.ad}`)],
    });
  };
  const notEkle = async (t, metin) => {
    const canli = teklifler.find(x => x.id === t.id) || t;
    await updateDoc(ttBelge(t.id), { notlar: [...(canli.notlar || []), { tarih: new Date().toISOString(), kullanici, metin }], updatedAt: new Date().toISOString() });
  };
  // YENİ (kullanıcı talebi): kaydedilmiş notu düzenle / sil — not, tarih + yazan kişiyle bulunur;
  // eski metin hareket geçmişine yazılır (iz kaybolmaz)
  const ayniNot = (a, b) => a.tarih === b.tarih && a.kullanici === b.kullanici;
  const notGuncelle = async (t, eskiNot, yeniMetin) => {
    const canli = teklifler.find(x => x.id === t.id) || t;
    await updateDoc(ttBelge(t.id), {
      notlar: (canli.notlar || []).map(n => (ayniNot(n, eskiNot) ? { ...n, metin: yeniMetin, duzenlendi: new Date().toISOString(), duzenleyen: kullanici } : n)),
      hareketler: [...(canli.hareketler || []), hareket(`Not düzenlendi (eski: "${String(eskiNot.metin || '').slice(0, 80)}")`)],
      updatedAt: new Date().toISOString(),
    });
  };
  const notSil = async (t, silinecekNot) => {
    const canli = teklifler.find(x => x.id === t.id) || t;
    await updateDoc(ttBelge(t.id), {
      notlar: (canli.notlar || []).filter(n => !ayniNot(n, silinecekNot)),
      hareketler: [...(canli.hareketler || []), hareket(`Not silindi: "${String(silinecekNot.metin || '').slice(0, 80)}"`)],
      updatedAt: new Date().toISOString(),
    });
  };
  const transferEt = async (t, yeniSahip, not) => {
    const eski = ttSahibi(t) || 'Atanmadı';
    const canli = teklifler.find(x => x.id === t.id) || t;
    await updateDoc(ttBelge(t.id), {
      atanan: yeniSahip, updatedAt: new Date().toISOString(),
      hareketler: [...(canli.hareketler || []), hareket(`Transfer: ${eski} → ${yeniSahip}`)],
      ...(not ? { notlar: [...(canli.notlar || []), { tarih: new Date().toISOString(), kullanici, metin: `[Transfer notu → ${yeniSahip}] ${not}` }] } : {}),
    });
    addSystemLog?.('Telefon Görüşmesi', `${t.musteriAdi || t.telefon} ${yeniSahip} adlı personele transfer edildi.`);
    setTransferKayit(null);
    if (!tamYetki && yeniSahip !== kullanici) setDetayId(null);  // Artık başkasının kaydı — pencere kapanır
  };
  // Sembol ↔ DepoEvim aktarımı: ortak cevaplar (ad, telefon, adres, kat, asansör) korunur
  const hizmetAktar = async (tHam, hedef) => {
    const t = ttNormalize(tHam);
    const ek = hedef === 'Depo'
      ? { depoBoyutu: t.depoBoyutu || (['1+0', '1+1', '2+1', '3+1'].includes(t.odaSayisi) ? t.odaSayisi : ''), nakliyeIstiyor: 'Firma', sube: t.sube || 'Farketmez', esyaCinsi: t.esyaCinsi || 'Ev Eşyası' }
      : { odaSayisi: t.odaSayisi || (t.depoBoyutu && t.depoBoyutu !== 'Özel' ? t.depoBoyutu : '') };
    const yeni = { ...t, hizmetTipi: hedef, ...ek };
    const h = ttFiyatHesapla(yeni);
    await guncelle(t, { surum: 2, hizmetTipi: hedef, site: ttSiteOf(hedef), ...ek, yukIl: t.yukIl, yukIlce: t.yukIlce, yukKat: t.yukKat || '', yukTasima: t.yukTasima || '', yukMesafe: t.yukMesafe || '',
      sistemFiyati: h.nakliyeToplam || 0, depoAylik: h.depo?.aylik || '' },
      `Hizmet aktarıldı: ${t.hizmetTipi} → ${hedef} (${hedef === 'Nakliye' ? 'Sembol' : 'DepoEvim'})`);
    addSystemLog?.('Telefon Görüşmesi', `${t.musteriAdi || t.telefon}: ${t.hizmetTipi} → ${hedef} aktarıldı.`);
    // Yeni hizmetin eksik sorularını tamamlamak için sihirbaz açılır
    setForm({ baslangic: { ...yeni, id: t.id }, hizmet: hedef });
  };
  // Kayıt ekranına aktar: form alanları dolu açılır, teklif "İşi Aldık" olur
  const kayitAc = async (t) => {
    if (!onKayitAc) return;
    const veri = ttKayitVerisi(t);
    await guncelle(t, { kayitAcildi: new Date().toISOString(), ...(t.durum !== 'İşi Aldık' ? { durum: 'İşi Aldık' } : {}) },
      `Kayıt ekranına aktarıldı (${veri.hizmetTipi})${t.durum !== 'İşi Aldık' ? ' — durum "İşi Aldık"' : ''}`);
    onKayitAc(veri);
  };
  const sil = async () => {
    if (!silinecek) return;
    await deleteDoc(ttBelge(silinecek.id));
    addSystemLog?.('Telefon Görüşmesi', `${silinecek.musteriAdi || silinecek.telefon} kaydı silindi.`);
    if (detayId === silinecek.id) setDetayId(null);
    setSilinecek(null);
  };

  const yetkiliMi = (t) => tamYetki || ttSahibi(t) === kullanici;

  // ================================================================ RENDER ===
  return (
    <div className="max-w-7xl mx-auto animate-in fade-in space-y-4">
      {/* BAŞLIK — DEĞİŞTİ (kullanıcı talebi): varsayılan GİZLİ; Müşteri Havuzu'ndaki
          "Görüşme İstatistikleri" düğmesine basınca (başlık + sayaçlar) görünür.
          Excel ve "Telefon Görüşmesi Ekle" düğmeleri gizliyken filtre satırında durur. */}
      {istatistikGoster && (
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-4 text-white shadow-lg space-y-3 animate-in fade-in slide-in-from-top-1">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div className="flex items-center gap-3">
            {onGeri && <button type="button" onClick={onGeri} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0" title="Müşteri Havuzu'na dön"><ChevronLeft className="w-5 h-5" /></button>}
            <div>
              <h2 className="text-lg md:text-xl font-black flex items-center gap-2"><PhoneCall className="w-5 h-5 text-emerald-400" /> Telefon Görüşmesi
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> KİŞİYE ÖZEL ALAN</span>
                {baskasininEkrani && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-400 text-neutral-900 flex items-center gap-1"><Eye className="w-3 h-3" /> {sahipFiltre === 'Tümü' ? 'TÜM EKRANLAR' : sahipFiltre === '__yok' ? 'ATANMAMIŞLAR' : `${ekranSahibi.toLocaleUpperCase('tr-TR')} EKRANI`}</span>}</h2>
              <p className="text-neutral-300 text-[11px] md:text-xs mt-0.5">
                {!tamYetki ? `${kullanici} — yalnızca sizin görüşmeleriniz`
                  : sahipFiltre === '__ben' ? `${kullanici} — kendi ekranınız (başka satışçının ekranı için aşağıdan seçin)`
                  : sahipFiltre === 'Tümü' ? 'Yönetici görünümü — tüm satışçıların görüşmeleri'
                  : sahipFiltre === '__yok' ? 'Yönetici görünümü — kimseye atanmamış görüşmeler'
                  : `Yönetici görünümü — ${ekranSahibi} adlı satışçının ekranı`}
              </p>
            </div>
          </div>
          {/* Yeni görüşme — hizmete göre renkli iki büyük buton */}
          <div className="flex flex-wrap gap-2">
            {/* DEĞİŞTİ (kullanıcı talebi): Excel indirme YALNIZCA Firma Sahibi'nde görünür
                (müşteri listesinin toplu dışarı alınması sınırlandırıldı) */}
            {(currentUser?.position || '').includes('Firma Sahibi') && (
              <button type="button" onClick={() => ttCsvIndir(liste)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black flex items-center gap-1.5"><Download className="w-4 h-4" /> Excel</button>
            )}
            {/* DEĞİŞTİ (kullanıcı talebi): "Evden Eve Görüşmesi" + "Depo Görüşmesi" → TEK BUTON.
                Pencere Evden Eve Nakliyat seçili açılır; üstteki hizmet kartlarından
                Eşya Depolama / Depodan Çıkış'a geçilebilir. */}
            <button type="button" onClick={() => setForm({ baslangic: null, hizmet: 'Nakliye' })}
              className="px-4 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1.5 shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30">
              <PlusCircle className="w-4 h-4" /> Telefon Görüşmesi Ekle
            </button>
          </div>
        </div>
        {istatistikGoster && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 animate-in fade-in slide-in-from-top-1">
          {[
            { e: 'Toplam', v: ozet.toplam, r: 'text-white', tik: () => { setTakipFiltre('Tümü'); setDurumFiltre('Tümü'); } },
            { e: 'Bu Ay', v: ozet.buAy, r: 'text-white', tik: () => setAyFiltre(ttBugunStr().slice(0, 7)) },
            { e: 'Bugün Aranacak', v: ozet.bugun, r: 'text-orange-400', tik: () => setTakipFiltre('Bugün') },
            { e: 'Geciken Takip', v: ozet.geciken, r: 'text-red-400', tik: () => setTakipFiltre('Geciken') },
            { e: 'İşi Aldık', v: ozet.isiAldik, r: 'text-green-400', tik: () => setDurumFiltre('İşi Aldık') },
            { e: 'Dönüşüm', v: `%${ozet.donusum}`, r: 'text-yellow-400', alt: ozet.alinanTutar ? ttTl(ozet.alinanTutar) : '' },
          ].map(k => (
            <button key={k.e} type="button" onClick={k.tik} disabled={!k.tik}
              className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-left hover:bg-white/15 transition disabled:cursor-default">
              <p className={`text-xl font-black leading-tight ${k.r}`}>{k.v}</p>
              <p className="text-[9px] font-bold uppercase text-neutral-400">{k.e}{k.alt ? ` · ${k.alt}` : ''}</p>
            </button>
          ))}
        </div>
        )}
      </div>
      )}

      {/* YENİ (kullanıcı talebi): YÖNETİCİ — KİMİN EKRANINI GÖRMEK İSTİYORSUNUZ?
          Satışçı seçilince liste, sayaçlar ve filtreler o satışçının kendi
          ekranında gördüğüyle birebir aynı olur. Varsayılan: kendi ekranınız. */}
      {tamYetki && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3">
          <p className="text-[11px] font-black uppercase text-yellow-900 flex items-center gap-1.5 mb-2"><Eye className="w-4 h-4" /> Kimin Telefon Görüşmesi ekranını görmek istiyorsunuz?</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: '__ben', ad: 'Benim Ekranım', sayi: gorunur.filter(t => ttSahibi(t) === kullanici).length, Ikon: ShieldCheck },
              ...sahipler.filter(ad => ad !== kullanici).map(ad => ({ id: ad, ad, sayi: gorunur.filter(t => ttSahibi(t) === ad).length, Ikon: User })),
              { id: 'Tümü', ad: 'Tüm Satışçılar', sayi: gorunur.length, Ikon: Users },
              { id: '__yok', ad: 'Atanmamış', sayi: gorunur.filter(t => !ttSahibi(t)).length, Ikon: HelpCircle },
            ].map(sec => (
              <button key={sec.id} type="button" onClick={() => { setSahipFiltre(sec.id); setDetayId(null); }}
                className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 ${sahipFiltre === sec.id ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' : 'bg-white text-neutral-700 border-yellow-200 hover:border-neutral-400'}`}>
                <sec.Ikon className="w-3.5 h-3.5" /> {sec.ad} <span className={`px-1.5 rounded-full text-[10px] ${sahipFiltre === sec.id ? 'bg-white/20' : 'bg-yellow-100'}`}>{sec.sayi}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FİLTRELER — DEĞİŞTİ (kullanıcı talebi): açılır düğmelerle.
          DÜZELTME (kullanıcı talebi): tek satıra sığmayıp kartın dışına TAŞIYORDU.
          Yeni düzen: 1. satır arama + Excel / Telefon Görüşmesi Ekle, 2. satır filtreler.
          Filtreler sığmazsa kart içinde alt satıra kayar — hiçbir ekran genişliğinde taşmaz. */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-2.5 flex flex-col gap-2 relative z-20">
        {/* 1. SATIR: arama kutusu (kalan genişliği doldurur) + işlem düğmeleri */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Ad, telefon (0'lı/0'sız), ilçe, açıklama veya satışçı ara…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-900/20" />
        </div>
        {/* YENİ: başlık gizliyken düğmeler burada (aynı işlevler)
            DEĞİŞTİ: filtrelerin sağından arama kutusunun sağına taşındı (taşma düzeltmesi) */}
        {!istatistikGoster && (
          <div className="flex gap-1.5 shrink-0">
            {(currentUser?.position || '').includes('Firma Sahibi') && (
              <button type="button" onClick={() => ttCsvIndir(liste)} className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-black flex items-center gap-1.5 whitespace-nowrap"><Download className="w-4 h-4" /> Excel</button>
            )}
            <button type="button" onClick={() => setForm({ baslangic: null, hizmet: 'Nakliye' })}
              className="flex-1 sm:flex-none justify-center px-4 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1.5 shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 whitespace-nowrap">
              <PlusCircle className="w-4 h-4" /> Telefon Görüşmesi Ekle
            </button>
          </div>
        )}
        </div>
        {/* 2. SATIR: filtreler — DEĞİŞTİ: lg:flex-nowrap kaldırıldı, sığmayan alt satıra kayar */}
        <div className="flex flex-wrap gap-1.5">
          <TTFiltreAcilir baslik="Kaynak" deger={kaynakFiltre} onSec={setKaynakFiltre} secenekler={[
            { id: 'Tümü', ad: 'Tüm Görüşmeler', sayi: gorunur.length },
            ...TT_KAYNAKLAR.map(k => ({ id: k.id, ad: k.ad, sayi: gorunur.filter(t => ttKaynakTuru(t) === k.id).length, nokta: k.id === 'havuz' ? 'bg-orange-500' : 'bg-emerald-600' })),
          ]} />
          <TTFiltreAcilir baslik="Hizmet" deger={hizmetFiltre} onSec={setHizmetFiltre} secenekler={[
            { id: 'Tümü', ad: 'Tüm Hizmetler', sayi: gorunur.length },
            ...TT_HIZMETLER.map(h => ({ id: h.id, ad: h.ad, sayi: gorunur.filter(t => (t.hizmetTipi || 'Nakliye') === h.id).length, nokta: h.stil.serit })),
          ]} />
          <TTFiltreAcilir baslik="Durum" deger={durumFiltre} onSec={setDurumFiltre} secenekler={[
            { id: 'Tümü', ad: 'Tüm Durumlar', sayi: durumSayisi('Tümü') },
            ...TT_DURUMLAR.filter(d => TT_SECILEBILIR_DURUMLAR.includes(d) || durumSayisi(d.id) > 0).map(d => ({ id: d.id, ad: d.etiket, sayi: durumSayisi(d.id), nokta: d.nokta })),
          ]} />
          <TTFiltreAcilir baslik="Takip" deger={takipFiltre} onSec={setTakipFiltre} secenekler={[
            { id: 'Tümü', ad: 'Tüm Takipler' },
            { id: 'Bugün', ad: 'Bugün Aranacak', sayi: ozet.bugun, nokta: 'bg-orange-500' },
            { id: 'Geciken', ad: 'Geciken', sayi: ozet.geciken, nokta: 'bg-red-600' },
            { id: 'Takipsiz', ad: 'Tarihsiz' },
          ]} />
          <TTFiltreAcilir baslik="Ay" deger={ayFiltre} onSec={setAyFiltre} secenekler={[
            { id: 'Tümü', ad: 'Tüm Aylar' },
            ...aylar.map(a => ({ id: a, ad: ayAdi(a) })),
          ]} />
          {/* Filtreleri tek tıkla temizle */}
          {(kaynakFiltre !== 'Tümü' || hizmetFiltre !== 'Tümü' || durumFiltre !== 'Tümü' || takipFiltre !== 'Tümü' || ayFiltre !== 'Tümü' || arama) && (
            <button type="button" onClick={() => { setKaynakFiltre('Tümü'); setHizmetFiltre('Tümü'); setDurumFiltre('Tümü'); setTakipFiltre('Tümü'); setAyFiltre('Tümü'); setArama(''); }}
              className="px-2.5 py-2 rounded-xl text-[11px] font-black text-red-600 hover:bg-red-50 flex items-center gap-1 whitespace-nowrap"><X className="w-3.5 h-3.5" /> Temizle</button>
          )}
        </div>
      </div>

      {/* LİSTE */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-visible">
        <div className="hidden md:grid grid-cols-[1.3fr_1.6fr_0.8fr_auto_1fr_auto] gap-3 pl-4 pr-3 py-2.5 bg-neutral-900 text-white text-xs font-black rounded-t-2xl">
          <span>Müşteri</span><span>Hizmet · Güzergâh · Cevaplar</span><span>Fiyat</span><span className="w-[124px] text-center">Görüşme</span><span>Durum · Takip</span><span className="w-4" />
        </div>
        {liste.length === 0 ? (
          <div className="p-10 text-center">
            <PhoneCall className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-black text-neutral-500">{gorunur.length ? 'Filtreye uyan görüşme yok.' : 'Henüz telefon görüşmesi eklenmedi.'}</p>
          </div>
        ) : (() => {
          // YENİ (kullanıcı talebi): HAVUZDAKİ GİBİ GÜN GÜN BÖLÜNMÜŞ LİSTE
          // Liste görüşme tarihine göre (en yeni üstte) sıralı gelir; aynı günün
          // kayıtları bir "29 Eylül 2026 Görüşmeleri" ayracının altında toplanır.
          // Ayraçtaki sayılar o günün TÜM kayıtlarını sayar (50'lik sayfalama dahil değil).
          const gunKey = (t) => (t.iletisimTarihi || '').slice(0, 10) || 'bilinmiyor';
          const gunSayilari = {};
          liste.forEach(t => { const k = gunKey(t); const g = gunSayilari[k] || (gunSayilari[k] = { toplam: 0, yeni: 0 }); g.toplam += 1; if ((t.durum || 'Yeni') === 'Yeni') g.yeni += 1; });
          const gruplar = [];
          gorunenListe.forEach(t => {
            const k = gunKey(t);
            const son = gruplar[gruplar.length - 1];
            if (son && son.anahtar === k) son.kayitlar.push(t); else gruplar.push({ anahtar: k, kayitlar: [t] });
          });
          return gruplar.map(grup => {
            const goreli = gunGoreliEtiket(grup.anahtar);
            const say = gunSayilari[grup.anahtar] || { toplam: grup.kayitlar.length, yeni: 0 };
            return (
              <React.Fragment key={grup.anahtar}>
                {/* ---------- GÜN AYRACI ---------- */}
                <div className="flex items-center gap-3 px-3 py-2 bg-emerald-50 border-y border-emerald-200">
                  <span className="w-1.5 h-6 rounded-full bg-emerald-600" />
                  <CalendarDays className="w-4 h-4 text-emerald-800" />
                  <span className="font-black text-sm text-emerald-900">{gunBasligi(grup.anahtar).replace(/Teklifleri$/, 'Görüşmeleri')}</span>
                  {goreli && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">{goreli}</span>}
                  <span className="text-[11px] font-bold text-neutral-500 ml-auto">
                    {say.toplam} görüşme
                    {say.yeni > 0 && <span className="ml-2 text-neutral-800">• {say.yeni} yeni</span>}
                  </span>
                </div>
                {grup.kayitlar.map(t => (
                  <TelefonTeklifSatiri key={t.id} tHam={t} gecmis={gecmisOf(t)} sahibiGoster={tamYetki}
                    onAc={() => setDetayId(t.id)} onDurum={(y) => durumDegistir(t, y)} onWhatsapp={() => setWaKayit({ t, sablon: 'ozet' })} />
                ))}
              </React.Fragment>
            );
          });
        })()}
        {/* YENİ: 50'den fazlası için devamını gör */}
        {kalanSayi > 0 && (
          <div className="p-3 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-center gap-2 rounded-b-2xl">
            <span className="text-[11px] font-bold text-neutral-500">{gorunenListe.length} / {liste.length} görüşme gösteriliyor</span>
            <button type="button" onClick={() => setGosterimSiniri(x => x + TT_SAYFA)}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition">
              <ChevronDown className="w-4 h-4" /> 50'den Fazlasını Gör ({Math.min(TT_SAYFA, kalanSayi)} görüşme daha)
            </button>
          </div>
        )}
      </div>

      {/* PENCERELER */}
      {form && (
        <TelefonTeklifFormu key={form.baslangic?.id || form.hizmet} baslangic={form.baslangic} varsayilanHizmet={form.hizmet} currentUser={currentUser}
          gecmisIndeksi={gecmisIndeksi} gonderen={kullanici} onKaydet={kaydet} onKapat={() => setForm(null)}
          onWhatsappKaydi={(ad) => { const id = form.baslangic?.id; const c = id && (teklifler.find(x => x.id === id) || form.baslangic); if (c) guncelle(c, {}, `WhatsApp mesajı açıldı: ${ad}`); }} />
      )}
      {detay && !form && (
        <TelefonTeklifDetay tHam={detay} gecmis={gecmisOf(detay)} yetkili={yetkiliMi(detay)} onKapat={() => setDetayId(null)}
          onDurum={(y) => durumDegistir(detay, y)} onSurec={(a, v) => surecIsaretle(detay, a, v)} onNotEkle={(m) => notEkle(detay, m)}
          onNotGuncelle={(n, m) => notGuncelle(detay, n, m)} onNotSil={(n) => notSil(detay, n)} kullanici={kullanici}
          onSunum={() => {
            if (detay.hizmetTipi === 'Nakliye') { nakliyeSunumuIndir(detay, kullanici); guncelle(detay, {}, 'Taşıma sunumu (PDF) indirildi'); }
            else { depoSunumuIndir(detay, kullanici); guncelle(detay, {}, 'Depo sunumu (PDF) indirildi'); }
          }}
          onDuzenle={() => setForm({ baslangic: detay, hizmet: detay.hizmetTipi })}
          onKayitAc={onKayitAc ? () => kayitAc(detay) : null}
          onWhatsapp={(sablon) => setWaKayit({ t: detay, sablon: sablon || null })} onTransfer={() => setTransferKayit(detay)}
          onHizmetAktar={(h) => hizmetAktar(detay, h)} onSil={() => setSilinecek(detay)} />
      )}
      {waKayit && (
        <TTWhatsappPenceresi t={waKayit.t} gonderen={kullanici} baslangicSablon={waKayit.sablon} onKapat={() => setWaKayit(null)}
          onGonderildi={(ad) => { guncelle(waKayit.t, {}, `WhatsApp mesajı açıldı: ${ad}`); }} />
      )}
      {transferKayit && (
        <PersonelTransferPenceresi baslik={transferKayit.musteriAdi || ttTelGoster(transferKayit.telefon)} mevcut={ttSahibi(transferKayit)}
          secenekler={sahipler} onKapat={() => setTransferKayit(null)} onTransfer={(ad, not) => transferEt(transferKayit, ad, not)} />
      )}
      {silinecek && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4" onClick={() => setSilinecek(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-neutral-900">"{silinecek.musteriAdi || silinecek.telefon}" kaydı silinsin mi?</p>
            <p className="text-xs text-neutral-500">Bu işlem geri alınamaz. Saklamak için durumu "Reddedildi" yapabilirsiniz.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setSilinecek(null)} className="px-4 py-2 rounded-xl bg-neutral-100 text-xs font-black">Vazgeç</button>
              <button type="button" onClick={sil} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ############################################################################
//  YENİ (kullanıcı talebi): FİYAT TABLOSU PENCERESİ
// ----------------------------------------------------------------------------
//  Müşteri Havuzu başlığındaki "Fiyat Tablosu" butonuyla açılır. Üç bölüm:
//    1) SEMBOL · Evden Eve Nakliyat   → Şehir İçi / Şehirler Arası
//    2) DEPOEVİM · Evden Depoya Nakliye → Şehir İçi / Şehirler Arası
//    3) DEPOEVİM · Kiralık Depo        → şube bazlı aylık kira (+KDV girilir,
//                                        KDV dahil fiyat otomatik gösterilir)
//  Yerleşim PDF fiyat listeleriyle aynı mantıktadır. Yalnızca MÜDÜR rütbesi
//  (ve Firma Sahibi) "Fiyatları Düzenle" ile değiştirebilir; kaydedilen
//  fiyatlar sistem fiyatı hesaplamasında HEMEN kullanılır.
// ############################################################################
// DEĞİŞTİ (kullanıcı talebi): bölüm başlıkları ve satır adları src/fiyatSema.js'ten gelir.
// /api/fiyatlar aynı başlıkları "etiket" alanında döndürür → ekran ile API ayrışmaz.
const ttFtBolumler = (gruplar, a) => gruplar.map(g => ({
  baslik: g.etiket.toLocaleUpperCase('tr-TR'),
  satirlar: g.satirlar.map(s => ({ etiket: s.etiket, yol: [a, g.ic, s.ic] })),
}));
// PDF'te olmayan (tahmini) kalemler — düzeltilene kadar "tahmini" etiketi gösterilir
const TT_FT_TAHMINI = (yol) => {
  const [, grup, anahtar] = yol;
  return (grup === 'merdiven' && ['6', '7'].includes(String(anahtar)))
    || (grup === 'yurume' && ['150', '200'].includes(String(anahtar)))
    || (grup === 'disCephe' && String(anahtar).endsWith('913'))
    || (grup === 'avrupaEkstra' && anahtar === '4+1');
};
// Şehir içi liste bölümleri (PDF sırası)
const ttSehirIciBolumleri = (a) => ttFtBolumler(SEHIR_ICI_GRUPLARI, a);
// Şehirler arası ek maliyetler
const ttSehirlerArasiEkBolumleri = (a) => ttFtBolumler(SEHIRLER_ARASI_EK_GRUPLARI, a);
const TT_FT_SEKMELER = [
  { id: 'sembol', ad: 'Evden Eve Nakliyat', marka: 'SEMBOL', alt: 'Evden eve taşıma fiyatları', Ikon: Truck, sehirIci: 'sehirIciEve', ek: 'sehirlerArasiEkEve', il: 'ilEve', oran: 'acilisOraniEve', hizmet: 'Nakliye',
    secili: 'bg-red-600 text-white border-red-600', pasif: 'bg-white text-red-700 border-red-200 hover:border-red-400', baslikCls: 'bg-red-600' },
  { id: 'depo', ad: 'Eşya Depolama Nakliyesi', marka: 'DEPOEVİM', alt: 'Evden depoya nakliye fiyatları', Ikon: Package, sehirIci: 'sehirIciDepo', ek: 'sehirlerArasiEkDepo', il: 'ilDepo', oran: 'acilisOraniDepo', hizmet: 'Depo',
    secili: 'bg-blue-600 text-white border-blue-600', pasif: 'bg-white text-blue-700 border-blue-200 hover:border-blue-400', baslikCls: 'bg-blue-600' },
  { id: 'kira', ad: 'Kiralık Depo', marka: 'DEPOEVİM', alt: 'Şube bazlı aylık depo kirası', Ikon: Wallet,
    secili: 'bg-sky-600 text-white border-sky-600', pasif: 'bg-white text-sky-700 border-sky-200 hover:border-sky-400', baslikCls: 'bg-sky-600' },
  // YENİ (kullanıcı talebi): km bazlı fiyat ayarları (iki nakliye listesi için ortak)
  { id: 'mesafe', ad: 'Km & Güzergah', marka: 'SEMBOL + DEPOEVİM', alt: 'Km ücreti · 200 km eşiği · köprü / feribot', Ikon: MapPin,
    secili: 'bg-emerald-600 text-white border-emerald-600', pasif: 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400', baslikCls: 'bg-emerald-600' },
];
const ttYolAl = (o, yol) => yol.reduce((x, k) => (x == null ? x : x[k]), o);
const ttYolYaz = (o, yol, v) => {
  const kopya = JSON.parse(JSON.stringify(o));
  let x = kopya;
  yol.slice(0, -1).forEach(k => { if (x[k] == null) x[k] = {}; x = x[k]; });
  x[yol[yol.length - 1]] = v;
  return kopya;
};

// Tek fiyat hücresi — görüntülemede "12.000 ₺", düzenlemede sayı kutusu.
// YENİ: durum = { tur: 'hata' | 'uyari', mesaj } → kırmızı / turuncu çerçeve
// DEĞİŞTİ: "birim" — 'tl' (varsayılan) · 'km' · 'yuzde'. Km ve yüzde değerleri artık ₺ ile gösterilmez.
const TTFiyatHucresi = ({ deger, duzenle, onDegis, degisti = false, durum = null, birim = 'tl' }) => (duzenle ? (
  <input value={deger ?? ''} inputMode="numeric" title={durum?.mesaj || ''}
    onChange={e => { const r = e.target.value.replace(/\D/g, ''); onDegis(r === '' ? '' : Number(r)); }}
    className={`w-28 px-2 py-1 rounded-lg border text-right text-sm font-black outline-none focus:ring-2 focus:ring-yellow-400 ${durum?.tur === 'hata' ? 'border-red-500 border-2 bg-red-50 text-red-700' : durum?.tur === 'uyari' ? 'border-orange-400 border-2 bg-orange-50' : degisti ? 'border-yellow-400 bg-yellow-50' : 'border-neutral-300 bg-white'}`} />
) : <span className="text-sm font-black text-neutral-900">{birim === 'km' ? `${Number(deger || 0).toLocaleString('tr-TR')} km` : birim === 'yuzde' ? `%${Number(deger || 0)}` : birim === 'tlkm' ? `${ttTl(deger)}/km` : ttTl(deger)}</span>);

// PDF'teki gibi başlıklı fiyat bölümü
const TTFiyatBolumu = ({ bolum, veri, kayitli, durumlar, duzenle, onDegis, renk }) => (
  <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
    <div className={`px-3 py-2 text-[11px] font-black text-white tracking-wide ${renk}`}>{bolum.baslik}</div>
    {bolum.satirlar.map((st, i) => {
      const d = ttYolAl(veri, st.yol);
      return (
        <div key={st.etiket} className={`flex items-center justify-between gap-2 px-3 py-2 ${i % 2 ? 'bg-neutral-50' : 'bg-white'}`}>
          <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5 flex-wrap">{st.etiket}
            {/* YENİ: PDF'te olmayan ve henüz değiştirilmemiş tutar */}
            {TT_FT_TAHMINI(st.yol) && d === ttYolAl(TT_FIYAT_VARSAYILAN, st.yol) && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">tahmini — kontrol edin</span>}
          </span>
          <TTFiyatHucresi deger={d} duzenle={duzenle} onDegis={v => onDegis(st.yol, v)} degisti={d !== ttYolAl(kayitli, st.yol)} durum={durumlar?.get(fiyatYolAnahtari(st.yol))} />
        </div>
      );
    })}
  </div>
);

// YENİ (kullanıcı talebi): fiyat kaydı / geri dönüş sunucu üzerinden (/api/fiyatlar)
const ttFiyatApiGonder = async (govde) => {
  const r = await fetch(TT_FIYAT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
  let j;
  try { j = await r.json(); } catch { j = {}; }
  if (!r.ok) { const e = new Error(j.error || `Sunucu hatası (${r.status})`); e.hatalar = j.hatalar; throw e; }
  return j;
};
const TT_WOO_UYARI = 'WooCommerce mağazasındaki ürün fiyatlarını da güncellemeyi unutma.';
const ttFarkDeger = (f, v) => {
  if (v == null || v === '') return '—';
  if (f.yol[0] === 'genel') return `%${v}`;
  // YENİ: km bazlı fiyat hücreleri
  if (f.yol[0] === 'mesafe') {
    if (f.yol[1] === 'modu') return Number(v) === 1 ? 'Açık' : 'Kapalı';
    if (f.yol[1] === 'cikisAdresi') return String(v);
    if (f.yol[1] === 'kmUcreti') return `${Number(v).toLocaleString('tr-TR')} ₺/km`;
    if (f.yol[1] === 'odaKademeleri') return f.yol[3] === 'km' ? `${Number(v).toLocaleString('tr-TR')} km` : `%${v}`; // YENİ
    if (f.yol[1] === 'kademeler') return f.yol[3] === 'km' ? `${Number(v).toLocaleString('tr-TR')} km` : f.yol[3] === 'yuzde' ? `%${v}` : ttTl(v); // YENİ
  }
  return ttTl(v);
};
const ttTarihKisa = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '');

const FiyatTablosuPenceresi = ({ currentUser, fiyatBilgi, onKapat }) => {
  const duzenleyebilir = ttMudurMu(currentUser);
  const [sekme, setSekme] = useState('sembol');
  const [kapsam, setKapsam] = useState('sehirIci');     // sehirIci | sehirlerArasi
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState(null);
  const [ilArama, setIlArama] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState(null);             // { tur: 'ok' | 'hata' | 'uyari', metin }
  const [ozet, setOzet] = useState(null);               // kaydetmeden önce "şu değerler değişecek"
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [gecmis, setGecmis] = useState(null);           // null = yükleniyor
  const [gecmisDetay, setGecmisDetay] = useState(null);
  // DEĞİŞTİ (kullanıcı talebi): tek kaynak Firestore — pencere belgeyi OLDUĞU GİBİ gösterir
  const kayitli = fiyatBilgi?.veri || null;
  // DEĞİŞTİ: eski kayıtlarda 'mesafe' yoktur → görüntüde varsayılanlarla doldurulur
  const veri = fiyatEksikleriDoldur(duzenle && taslak ? taslak : (kayitli || ttFiyatTablolari()), kayitli);
  const aktifSekme = TT_FT_SEKMELER.find(x => x.id === sekme);
  const degis = (yol, v) => setTaslak(t => ttYolYaz(t, yol, v));

  // Düzenlemede canlı doğrulama: hatalı hücre kırmızı, sıra uyarısı turuncu
  const dogrulama = useMemo(() => (duzenle && taslak ? fiyatDogrula(taslak, kayitli || taslak) : { hatalar: [], uyarilar: [] }), [duzenle, taslak, kayitli]);
  const durumlar = useMemo(() => {
    const m = new Map();
    dogrulama.uyarilar.forEach(u => m.set(fiyatYolAnahtari(u.yol), { tur: 'uyari', mesaj: u.mesaj }));
    dogrulama.hatalar.forEach(h => m.set(fiyatYolAnahtari(h.yol), { tur: 'hata', mesaj: h.mesaj }));
    return m;
  }, [dogrulama]);

  const duzenlemeyiAc = () => { setTaslak(fiyatEksikleriDoldur(kayitli, kayitli)); setDuzenle(true); setMesaj(null); setGecmisAcik(false); }; // DEĞİŞTİ: km hücreleri dolu gelir
  const kaydetIste = () => {
    if (dogrulama.hatalar.length) {
      setMesaj({ tur: 'hata', metin: `${dogrulama.hatalar.length} hücrede hatalı değer var (kırmızı kutular) — boş, sıfır veya sayı olmayan değer kaydedilemez. İlk hata: ${dogrulama.hatalar[0].etiket} → ${dogrulama.hatalar[0].mesaj}` });
      return;
    }
    const temiz = fiyatTemizle(taslak, kayitli);
    const farklar = fiyatFarklari(kayitli, temiz);
    if (!farklar.length) { setMesaj({ tur: 'uyari', metin: 'Değişiklik yok — kaydedilecek bir şey bulunmadı.' }); return; }
    setOzet({ temiz, farklar, uyarilar: dogrulama.uyarilar, kiraDegisti: farklar.some(f => f.yol[0] === 'depoKira') });
  };
  const kaydetOnayla = async () => {
    if (!ozet) return;
    setKaydediliyor(true);
    try {
      const r = await ttFiyatApiGonder({ islem: 'kaydet', kullaniciId: currentUser?.id, sifre: currentUser?.password, veri: ozet.temiz, beklenenVersiyon: fiyatBilgi?.versiyon });
      ttFiyatlariUygula(ozet.temiz);            // Bu ekranda beklemeden uygula
      setDuzenle(false); setTaslak(null);
      setMesaj({ tur: 'ok', metin: `Fiyatlar kaydedildi (v${r.versiyon}, ${r.degisenHucre} hücre) — sistem fiyatı hesaplamaları ve web siteleri yeni fiyatları kullanıyor.${ozet.kiraDegisti ? ` ⚠️ ${TT_WOO_UYARI}` : ''}` });
      setOzet(null); setGecmis(null);
    } catch (e) {
      console.error(e);
      setOzet(null);
      setMesaj({ tur: 'hata', metin: `Kaydedilemedi: ${e?.message || ''}${e?.hatalar?.length ? ` (${e.hatalar[0].etiket} → ${e.hatalar[0].mesaj})` : ''}` });
    } finally { setKaydediliyor(false); }
  };
  const varsayilanaDon = () => { setTaslak({ ...JSON.parse(JSON.stringify(TT_FIYAT_VARSAYILAN)), mesafe: taslak?.mesafe || veri.mesafe }); setMesaj({ tur: 'uyari', metin: 'PDF (Eylül 2026) fiyatları yüklendi (Km & Güzergah ayarlarına dokunulmadı) — kalıcı olması için Kaydet\'e basın.' }); }; // DEĞİŞTİ

  // YENİ (kullanıcı talebi): geçmiş listesi — yalnızca açılınca okunur (son 20 kayıt)
  const gecmisiAc = async () => {
    setGecmisAcik(true); setGecmis(null); setGecmisDetay(null);
    try {
      const snap = await getDocs(query(ttFiyatGecmisKoleksiyon(), orderBy('versiyon', 'desc'), limit(20)));
      setGecmis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setGecmis([]); setMesaj({ tur: 'hata', metin: 'Geçmiş okunamadı: ' + (e?.message || '') }); }
  };
  const geriDon = async (g) => {
    const hedef = (Number(g.versiyon) || 1) - 1;
    const kira = fiyatFarklari(g.eskiVeri, g.yeniVeri).some(f => f.yol[0] === 'depoKira');
    if (!window.confirm(`v${g.versiyon} değişikliği geri alınacak: fiyatlar v${hedef} haline döner (yeni kayıt olarak v${(fiyatBilgi?.versiyon || 1) + 1}).${kira ? `\n\n⚠️ ${TT_WOO_UYARI}` : ''}\n\nDevam edilsin mi?`)) return;
    setKaydediliyor(true);
    try {
      const r = await ttFiyatApiGonder({ islem: 'geriDon', kullaniciId: currentUser?.id, sifre: currentUser?.password, gecmisId: g.id, beklenenVersiyon: fiyatBilgi?.versiyon });
      ttFiyatlariUygula(g.eskiVeri);
      setMesaj({ tur: 'ok', metin: `v${hedef} fiyatlarına geri dönüldü (yeni kayıt v${r.versiyon}).${kira ? ` ⚠️ ${TT_WOO_UYARI}` : ''}` });
      gecmisiAc();
    } catch (e) { console.error(e); setMesaj({ tur: 'hata', metin: 'Geri dönülemedi: ' + (e?.message || '') }); }
    finally { setKaydediliyor(false); }
  };

  const iller = aktifSekme.il ? Object.keys(veri[aktifSekme.il] || {}).sort((a, b) => a.localeCompare(b, 'tr'))
    .filter(il => !ilArama.trim() || il.toLocaleLowerCase('tr-TR').includes(ilArama.trim().toLocaleLowerCase('tr-TR'))) : [];
  const kiraSatirlari = ['Genel', ...DEPO_LOCATIONS.map(d => d.name)];
  const kiraBoyutlari = TT_DEPO_BOYUTLARI.filter(b => b.aylik);
  const mesajCls = { ok: 'text-emerald-800 bg-emerald-50 border-emerald-200', hata: 'text-red-800 bg-red-50 border-red-200', uyari: 'text-amber-900 bg-amber-50 border-amber-200' };

  return (
    <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-3 md:p-4" onClick={onKapat}>
      <div className="relative bg-neutral-50 sm:rounded-3xl shadow-2xl w-full max-w-6xl h-[100dvh] sm:h-[calc(100dvh-1.5rem)] md:h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        {/* BAŞLIK */}
        <div className="shrink-0 bg-neutral-900 text-white px-4 md:px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-black flex items-center gap-2"><FileText className="w-5 h-5 text-yellow-400" /> Fiyat Tablosu <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">Güncel Fiyat Listesi 2026</span></h3>
            <p className="text-[11px] font-bold text-neutral-400">
              Sistem fiyatı hesaplaması ve web sitelerinin fiyat sihirbazları bu tabloyu kullanır.
              {!kayitli ? ' Fiyatlar yükleniyor…' : fiyatBilgi?.guncelleyen ? ` Son güncelleme: ${fiyatBilgi.guncelleyen} · ${ttTarihKisa(fiyatBilgi.tarih)} · v${fiyatBilgi.versiyon}` : ` v${fiyatBilgi?.versiyon || 1}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!duzenle && (
              <button type="button" onClick={() => (gecmisAcik ? setGecmisAcik(false) : gecmisiAc())} className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${gecmisAcik ? 'bg-white text-neutral-900' : 'bg-white/10 hover:bg-white/20'}`}><History className="w-4 h-4" /> Geçmiş</button>
            )}
            {/* Yalnızca müdür rütbesi düzenleyebilir */}
            {duzenleyebilir && !duzenle && (
              <button type="button" onClick={duzenlemeyiAc} disabled={!kayitli} className="px-3 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-neutral-900 text-xs font-black flex items-center gap-1.5 disabled:opacity-50"><Edit className="w-4 h-4" /> Fiyatları Düzenle</button>
            )}
            {duzenle && (<>
              <button type="button" onClick={varsayilanaDon} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> PDF Fiyatlarına Dön</button>
              <button type="button" onClick={() => { setDuzenle(false); setTaslak(null); setMesaj(null); }} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black">Vazgeç</button>
              <button type="button" onClick={kaydetIste} disabled={kaydediliyor} className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-60">
                {kaydediliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Fiyatları Kaydet
              </button>
            </>)}
            <button type="button" onClick={onKapat} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
        </div>
        {/* SEKMELER: Sembol · Depo nakliye · Kiralık depo */}
        <div className="shrink-0 px-4 md:px-5 pt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">{/* DEĞİŞTİ: 4. sekme (Km & Güzergah) */}
            {TT_FT_SEKMELER.map(x => (
              <button key={x.id} type="button" onClick={() => setSekme(x.id)}
                className={`px-3 py-2.5 rounded-2xl border-2 text-left transition flex items-center gap-2.5 ${sekme === x.id ? x.secili + ' shadow-lg' : x.pasif}`}>
                <x.Ikon className="w-5 h-5 shrink-0" />
                <span className="min-w-0">
                  <span className={`block text-[9px] font-black ${sekme === x.id ? 'text-white/80' : ''}`}>{x.marka}</span>
                  <span className="block text-sm font-black leading-tight">{x.ad}</span>
                  <span className={`block text-[10px] font-bold ${sekme === x.id ? 'text-white/80' : 'text-neutral-500'}`}>{x.alt}</span>
                </span>
              </button>
            ))}
          </div>
          {sekme !== 'kira' && sekme !== 'mesafe' && (
            <div className="flex gap-1.5">
              {[['sehirIci', 'Şehir İçi (İstanbul)'], ['sehirlerArasi', 'Şehirler Arası (81 İl)']].map(([id, ad]) => (
                <button key={id} type="button" onClick={() => setKapsam(id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition ${kapsam === id ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>{ad}</button>
              ))}
            </div>
          )}
          {duzenle && <p className="text-[11px] font-black text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-2">Düzenleme modu: fiyatları yazın ve "Fiyatları Kaydet"e basın. Değiştirdiğiniz kutular sarı, hatalı kutular kırmızı, büyük boyu küçükten ucuz olan kutular turuncu görünür.
            {(dogrulama.hatalar.length > 0 || dogrulama.uyarilar.length > 0) && <span className="block mt-0.5">{dogrulama.hatalar.length} hata · {dogrulama.uyarilar.length} sıra uyarısı</span>}</p>}
          {mesaj && <p className={`text-[11px] font-black border rounded-xl px-3 py-2 ${mesajCls[mesaj.tur]}`}>{mesaj.metin}</p>}
        </div>

        {/* İÇERİK */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-5">
          {/* YENİ (kullanıcı talebi): GEÇMİŞ — her kayıt bir versiyon; bir öncekine geri dönülebilir */}
          {gecmisAcik && !duzenle && (
            <div className="mb-4 rounded-2xl border-2 border-neutral-300 bg-white overflow-hidden">
              <div className="px-3 py-2 bg-neutral-900 text-white text-[11px] font-black tracking-wide">FİYAT GEÇMİŞİ (SON 20 KAYIT)</div>
              {gecmis === null ? <p className="p-3 text-xs font-bold text-neutral-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…</p>
                : gecmis.length === 0 ? <p className="p-3 text-xs font-bold text-neutral-500">Henüz geçmiş kaydı yok — şu anki fiyatlar v{fiyatBilgi?.versiyon || 1}. İlk kayıttan sonra her değişiklik burada listelenir.</p>
                : gecmis.map(g => {
                  const acik = gecmisDetay === g.id;
                  const farklar = acik ? fiyatFarklari(g.eskiVeri, g.yeniVeri) : [];
                  return (
                    <div key={g.id} className="border-t border-neutral-100 first:border-t-0">
                      <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                        <button type="button" onClick={() => setGecmisDetay(acik ? null : g.id)} className="text-left min-w-0 flex items-center gap-2">
                          {acik ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                          <span className="text-xs font-black text-neutral-900">v{g.versiyon}</span>
                          <span className="text-xs font-bold text-neutral-600 truncate">{g.guncelleyen} · {ttTarihKisa(g.tarih)} · {g.degisenHucre ?? '?'} hücre{g.geriDonus ? ` · v${g.geriDonus.hedefVersiyon} fiyatlarına geri dönüş` : ''}</span>
                        </button>
                        {duzenleyebilir && g.eskiVeri && (
                          <button type="button" disabled={kaydediliyor} onClick={() => geriDon(g)} className="shrink-0 px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-[11px] font-black text-neutral-800 flex items-center gap-1 disabled:opacity-50">
                            <RefreshCw className="w-3.5 h-3.5" /> Bu değişiklikten önceki hale (v{(Number(g.versiyon) || 1) - 1}) dön
                          </button>
                        )}
                      </div>
                      {acik && (
                        <div className="px-3 pb-2 max-h-64 overflow-y-auto">
                          <table className="w-full text-[11px]"><tbody>
                            {farklar.map(f => (
                              <tr key={fiyatYolAnahtari(f.yol)} className="border-t border-neutral-100">
                                <td className="py-1 pr-2 font-bold text-neutral-700">{f.etiket}</td>
                                <td className="py-1 px-2 text-right text-neutral-500 line-through whitespace-nowrap">{ttFarkDeger(f, f.eski)}</td>
                                <td className="py-1 pl-2 text-right font-black text-neutral-900 whitespace-nowrap">{ttFarkDeger(f, f.yeni)}</td>
                              </tr>
                            ))}
                          </tbody></table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
          {/* DEĞİŞTİ (kullanıcı talebi): FİYAT ARALIĞI YÜZDESİ (eski adı: açılış fiyatı oranı).
              Toplam nakliye fiyatı TABAN'dır; müşteriye TABAN – TABAN × (1 + yüzde/100) aralığı
              gösterilir. Yüzde kalemlere değil TOPLAMA uygulanır; üst sınır 500 ₺'ye yukarı yuvarlanır. */}
          {sekme !== 'kira' && sekme !== 'mesafe' && (() => {
            const yol = ['genel', aktifSekme.oran];
            const oran = Number(ttYolAl(veri, yol));
            const ornekTaban = Number(ttYolAl(veri, [aktifSekme.sehirIci, 'taban', '2+1'])) || 0;
            const ornekAcilis = ornekTaban ? Math.ceil((ornekTaban * (1 + (Number.isFinite(oran) ? oran : 0) / 100)) / 500) * 500 : 0;
            const durum = durumlar.get(fiyatYolAnahtari(yol));
            return (
              <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase text-emerald-900">Fiyat Aralığı Yüzdesi ({aktifSekme.marka} · {aktifSekme.ad})</p>
                  <p className="text-[11px] font-bold text-emerald-800">Tablodaki kalemlerle hesaplanan toplam nakliye fiyatı <b>taban</b>dır. Müşteriye <b>taban – taban × (1 + yüzde)</b> aralığı gösterilir; yüzde kalemlere tek tek değil toplama uygulanır, üst sınır 500 ₺'ye yukarı yuvarlanır. Satışçı üst sınırla açılış yapar, pazarlıkta tabana kadar iner.
                    {ornekTaban ? ` Örnek: 2+1 şehir içi taban ${ttTl(ornekTaban)} → aralık ${ttTl(ornekTaban)} – ${ttTl(ornekAcilis)}.` : ''}</p>
                  {durum && <p className="text-[11px] font-black text-red-700 mt-1">{durum.mesaj}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-black text-emerald-900">Taban +</span>
                  {duzenle ? (
                    <span className="flex items-center gap-1">
                      <span className="text-lg font-black text-emerald-800">%</span>
                      <input value={Number.isFinite(oran) && ttYolAl(veri, yol) !== '' ? oran : ''} inputMode="numeric"
                        onChange={e => { const r = e.target.value.replace(/\D/g, '').slice(0, 3); degis(yol, r === '' ? '' : Number(r)); }}
                        className={`w-20 px-2 py-1.5 rounded-lg border-2 text-right text-lg font-black outline-none focus:ring-2 focus:ring-yellow-400 ${durum ? 'border-red-500 bg-red-50 text-red-700' : oran !== ttYolAl(kayitli, yol) ? 'border-yellow-400 bg-yellow-50' : 'border-emerald-300 bg-white'}`} />
                    </span>
                  ) : <span className="text-2xl font-black text-emerald-700">%{Number.isFinite(oran) ? oran : 25}</span>}
                </div>
              </div>
            );
          })()}
          {/* DEĞİŞTİ (kullanıcı talebi): Km & Güzergah sekmesinde nakliye tabloları GÖSTERİLMEZ —
              taban, toplama, merdiven, dış cephe, Avrupa ekstra ve yürüme Evden Eve / Eşya Depolama sekmelerinden gelir */}
          {sekme !== 'kira' && sekme !== 'mesafe' && kapsam === 'sehirIci' && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-neutral-500">Nakliye taban fiyatları Anadolu Yakası çıkışlıdır; Avrupa Yakası için ekstra maliyet eklenir. Ek hizmetler taban fiyata ilave edilir.{sekme === 'depo' ? ' Depolama süresi ücreti ayrıca hesaplanır.' : ''}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ttSehirIciBolumleri(aktifSekme.sehirIci).map(b => <TTFiyatBolumu key={b.baslik} bolum={b} veri={veri} kayitli={kayitli} durumlar={durumlar} duzenle={duzenle} onDegis={degis} renk={aktifSekme.baslikCls} />)}
              </div>
            </div>
          )}
          {/* YENİ (kullanıcı talebi): 81 il tablosunu şehir içi taban + km kurallarıyla yeniden üret
              (Evden Eve VE Eşya Depolama birlikte). Yalnızca düzenleme modunda; Kaydet'e basılana kadar kalıcı değildir. */}
          {sekme !== 'kira' && sekme !== 'mesafe' && kapsam === 'sehirlerArasi' && duzenle && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 text-[11px] font-bold text-emerald-900">
                <p className="font-black uppercase">Km'ye göre yeniden hesapla</p>
                Her il için: <b>şehir içi taban (oda)</b> + <b>2 × (Pendik → il merkezi km) × km ücreti</b>; toplam km eşiği aşarsa işçilik farkı, sabit ek ve Trakya'da Boğaz köprüsü eklenir. Km'ler KGM resmî tablolarından, ayarlar <b>Km & Güzergah</b> sekmesinden alınır. <b>Evden Eve</b> ve <b>Eşya Depolama</b> tabloları birlikte güncellenir; sonuçları kontrol edip <b>Fiyatları Kaydet</b>'e basın.
              </div>
              <button type="button" onClick={() => {
                if (!window.confirm('80 ilin Evden Eve ve Eşya Depolama fiyatları şehir içi taban + km kurallarıyla yeniden hesaplanacak. Devam edilsin mi? (Kaydet\'e basmadan kalıcı olmaz)')) return;
                const yeni = ttIlTablolariniKmIleHesapla(veri);
                setTaslak(t => ({ ...t, ilEve: yeni.ilEve, ilDepo: yeni.ilDepo }));
                setMesaj({ tur: 'uyari', metin: 'Evden Eve ve Eşya Depolama 81 il fiyatları km\'ye göre yeniden hesaplandı (sarı kutular). Kontrol edip Fiyatları Kaydet\'e basın.' });
              }} className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> Km'ye Göre Yeniden Hesapla
              </button>
            </div>
          )}
          {sekme !== 'kira' && sekme !== 'mesafe' && kapsam === 'sehirlerArasi' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className={`px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white ${aktifSekme.baslikCls}`}>
                  <span className="text-[11px] font-black tracking-wide">{IL_TABLOSU_ETIKET.toLocaleUpperCase('tr-TR')}</span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input value={ilArama} onChange={e => setIlArama(e.target.value)} placeholder="İl ara…" className="pl-7 pr-2 py-1 rounded-lg text-xs font-bold text-neutral-900 outline-none w-40" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-100 text-neutral-600">
                      <tr><th className="text-left px-3 py-2 font-black">İl</th>{['1+1', '2+1', '3+1', '4+1'].map(o => <th key={o} className="text-right px-3 py-2 font-black">{o}</th>)}</tr>
                    </thead>
                    <tbody>
                      {iller.map((il, i) => (
                        <tr key={il} className={i % 2 ? 'bg-neutral-50' : 'bg-white'}>
                          <td className="px-3 py-1.5 font-black text-neutral-800">{il}</td>
                          {[0, 1, 2, 3].map(s => {
                            const yol = [aktifSekme.il, il, s];
                            const d = ttYolAl(veri, yol);
                            return <td key={s} className="px-3 py-1.5 text-right"><TTFiyatHucresi deger={d} duzenle={duzenle} onDegis={v => degis(yol, v)} degisti={d !== ttYolAl(kayitli, yol)} durum={durumlar.get(fiyatYolAnahtari(yol))} /></td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-3 py-2 text-[10px] font-bold text-neutral-500 border-t border-neutral-100">{IL_TABLOSU_NOTU}</p>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-black text-neutral-600">Bu fiyatların üzerine eklenebilecek ek maliyetler:</p>
                {ttSehirlerArasiEkBolumleri(aktifSekme.ek).map(b => <TTFiyatBolumu key={b.baslik} bolum={b} veri={veri} kayitli={kayitli} durumlar={durumlar} duzenle={duzenle} onDegis={degis} renk={aktifSekme.baslikCls} />)}
              </div>
            </div>
          )}
          {/* ================= YENİ (kullanıcı talebi): KM & GÜZERGAH SEKMESİ ================= */}
          {sekme === 'mesafe' && (() => {
            const M = veri.mesafe || {};
            const acik = Number(M.modu) === 1;
            const kayitliDolu = fiyatEksikleriDoldur(kayitli, kayitli); // DEĞİŞTİ: eski tek eşik → kademe göçüyle karşılaştır
            // DEĞİŞTİ: birim yoldan çıkarılır — km / % / ₺/km değerleri artık ₺ ile gösterilmez
            const birimOf = (yol) => (yol[1] === 'kmUcreti' ? 'tlkm'
              : (yol[1] === 'kademeler' && yol[3] === 'km') || (yol[1] === 'odaKademeleri' && yol[3] === 'km') ? 'km'
              : (yol[1] === 'kademeler' && yol[3] === 'yuzde') || (yol[1] === 'odaKademeleri' && yol[3] === 'yuzde') ? 'yuzde' : 'tl');
            const hucre = (yol) => {
              const d = ttYolAl(veri, yol);
              return <TTFiyatHucresi deger={d} duzenle={duzenle} birim={birimOf(yol)} onDegis={v => degis(yol, v)} degisti={d !== ttYolAl(kayitliDolu, yol)} durum={durumlar.get(fiyatYolAnahtari(yol))} />;
            };
            const satir = (etiket, aciklama, yol, i, sonEk = '') => (
              <div className={`flex items-center justify-between gap-2 px-3 py-2 ${i % 2 ? 'bg-neutral-50' : 'bg-white'}`}>
                <span className="text-xs font-bold text-neutral-700">{etiket}<span className="block text-[10px] text-neutral-400">{aciklama}</span></span>
                <span className="flex items-center gap-1">{hucre(yol)}{sonEk && duzenle && <span className="text-[10px] font-black text-neutral-500">{sonEk}</span>}</span>
              </div>
            );
            // DEĞİŞTİ (kullanıcı talebi): örnekler iki nakliye listesinin KENDİ fiyatlarını kullanır.
            // Km ücreti, geçişler ve işçilik farkı Evden Eve / Eşya Depolama fiyatlarının ÜZERİNE eklenir.
            const ornek = (liste, listeAdi, toplamKm, gecisler) => {
              const taban = Number(ttYolAl(veri, [liste, 'taban', '2+1'])) || 0;
              const toplama = Number(ttYolAl(veri, [liste, 'toplama', '2+1'])) || 0;
              const kalemler = [
                { ad: `2+1 nakliye taban (${listeAdi} sekmesinden)`, tutar: taban },
                { ad: `2+1 toplama (${listeAdi} sekmesinden)`, tutar: toplama },
                ...mesafeKalemleri(M, { toplamKm, gecisler }),
              ];
              const oda = mesafeOdaFarkiKalemi(M, { toplamKm }, '2+1'); // YENİ: ev tipi farkı
              if (oda) kalemler.push(oda);
              const isc = mesafeIscilikKalemi(M, { toplamKm }, kalemler);
              if (isc) kalemler.push(isc);
              return { kalemler, toplam: kalemler.reduce((t, k) => t + k.tutar, 0) };
            };
            const ornekler = [
              { baslik: 'SEMBOL · Evden Eve · 2+1 + toplama · 200 km (eşik altı)', ...ornek('sehirIciEve', 'Evden Eve', 200, { kopruOsmangazi: 2 }) },
              { baslik: `DEPOEVİM · Eşya Depolama · 2+1 + toplama · 260 km (uzun yol kademesi uygulanır)`, ...ornek('sehirIciDepo', 'Eşya Depolama', 260, { kopruOsmangazi: 2 }) },
            ];
            return (
              <div className="space-y-3">
                {/* YENİ (kullanıcı talebi): bu sekmenin diğer sekmelerle ilişkisi */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold text-emerald-900">
                  Bu sekmede yalnızca <b>km'ye bağlı ek maliyetler</b> girilir. Nakliye taban fiyatı, toplama, merdiven, dış cephe asansörü, Avrupa Yakası ekstrası ve yürüme mesafesi her zamanki gibi
                  <b> Evden Eve Nakliyat</b> (SEMBOL) ve <b>Eşya Depolama Nakliyesi</b> (DEPOEVİM) sekmelerinden alınır; buradaki km ücreti, geçişler, sabit ek ve işçilik farkı o fiyatların <b>ÜZERİNE</b> eklenir.
                </div>
                {/* MOD */}
                <div className={`rounded-2xl border-2 p-3 flex flex-col md:flex-row md:items-center gap-3 ${acik ? 'border-emerald-400 bg-emerald-50' : 'border-neutral-300 bg-white'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase text-neutral-900">Km Bazlı Fiyat Modu</p>
                    <p className="text-[11px] font-bold text-neutral-600">Açıkken sistem fiyatı: <b>taban (oda sayısı) + toplam km × km ücreti + ek hizmetler</b>. Km, seçilen <b>ilçe merkezleri</b> arasından 4 noktayla hesaplanır: <b>hareket merkezi → yükleme → boşaltma → hareket merkezi</b>. Toplam km <b>eşiği aşarsa</b> köprü/otoyol/feribot ücretleri, sabit ek maliyet ve işçilik farkı (%) eklenir. 81 il tablosu bu modda kullanılmaz. Kapalıyken eski liste sistemi çalışır.</p>
                  </div>
                  {duzenle ? (
                    <div className="flex gap-1.5 shrink-0">
                      {[[1, 'AÇIK'], [0, 'KAPALI']].map(([v, ad]) => (
                        <button key={v} type="button" onClick={() => degis(['mesafe', 'modu'], v)} className={`px-4 py-2 rounded-xl text-xs font-black border-2 ${Number(M.modu) === v ? (v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-neutral-900 text-white border-neutral-900') : 'bg-white text-neutral-600 border-neutral-300'}`}>{ad}</button>
                      ))}
                    </div>
                  ) : <span className={`shrink-0 px-4 py-2 rounded-xl text-sm font-black ${acik ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'}`}>{acik ? 'AÇIK' : 'KAPALI'}</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* HAREKET MERKEZİ + KM */}
                  <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[11px] font-black text-white tracking-wide bg-emerald-600">HAREKET MERKEZİ VE KM ÜCRETİ</div>
                    <div className="px-3 py-2">
                      <p className="text-xs font-bold text-neutral-700">Hareket merkezi (1. ve 4. nokta)</p>
                      {duzenle ? (
                        <input value={M.cikisAdresi || ''} onChange={e => degis(['mesafe', 'cikisAdresi'], e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none focus:ring-2 focus:ring-yellow-400 ${durumlar.get(fiyatYolAnahtari(['mesafe', 'cikisAdresi'])) ? 'border-red-500 bg-red-50' : 'border-neutral-300'}`} placeholder="İlçe, İl, Türkiye" />
                      ) : <p className="text-sm font-black text-neutral-900">{M.cikisAdresi}</p>}
                      <p className="text-[10px] font-bold text-neutral-400 mt-0.5">"İlçe, İl, Türkiye" biçiminde yazın — ilçe merkezi baz alınır.</p>
                    </div>
                    {satir('Km ücreti', '3 etabın TOPLAM km\'sine uygulanır (yakıt, aşınma, şoför)', ['mesafe', 'kmUcreti'], 1, '₺/km')}
                  </div>
                  {/* EŞİK KURALLARI */}
                  <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[11px] font-black text-white tracking-wide bg-emerald-600">UZUN YOL KURALLARI (KADEMELİ)</div>
                    {/* DEĞİŞTİ (kullanıcı talebi): birden fazla eşik — eklenir / silinir.
                        Toplam km hangi kademeleri AŞARSA, aşılan EN YÜKSEK kademenin işçilik % ve sabit eki uygulanır. */}
                    <div className="px-3 pt-2 grid grid-cols-[1fr_1fr_1fr_28px] gap-2 text-[10px] font-black uppercase text-neutral-500">
                      <span>Toplam km aşarsa</span><span>Toplama % artış</span><span>Sabit ek (₺)</span><span />
                    </div>
                    {(M.kademeler || []).length === 0 && <p className="px-3 py-2 text-[11px] font-bold text-neutral-400">Kademe yok — uzun yol farkı, köprü ve geçiş ücreti alınmaz.</p>}
                    {(M.kademeler || []).map((k, i) => (
                      <div key={i} className={`px-3 py-1.5 grid grid-cols-[1fr_1fr_1fr_28px] gap-2 items-center ${i % 2 ? 'bg-neutral-50' : 'bg-white'}`}>
                        <span className="flex items-center gap-1">{hucre(['mesafe', 'kademeler', i, 'km'])}{duzenle && <span className="text-[10px] font-black text-neutral-500">km</span>}</span>
                        <span className="flex items-center gap-1">{hucre(['mesafe', 'kademeler', i, 'yuzde'])}{duzenle && <span className="text-[10px] font-black text-neutral-500">%</span>}</span>
                        <span>{hucre(['mesafe', 'kademeler', i, 'ek'])}</span>
                        {duzenle ? (
                          <button type="button" title="Kademeyi sil" onClick={() => setTaslak(t => ({ ...t, mesafe: { ...t.mesafe, kademeler: (t.mesafe?.kademeler || []).filter((_, j) => j !== i) } }))}
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        ) : <span />}
                      </div>
                    ))}
                    {duzenle && (
                      <div className="px-3 py-2">
                        <button type="button" onClick={() => setTaslak(t => {
                          const liste = [...(t.mesafe?.kademeler || [])].sort((a, b) => Number(a.km) - Number(b.km));
                          const son = liste[liste.length - 1];
                          const yeni = { km: (Number(son?.km) || 0) + 200, yuzde: Number(son?.yuzde) || 15, ek: 0 };
                          return { ...t, mesafe: { ...t.mesafe, kademeler: [...(t.mesafe?.kademeler || []), yeni] } };
                        })} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5">
                          <PlusCircle className="w-3.5 h-3.5" /> Kademe Ekle
                        </button>
                      </div>
                    )}
                    <p className="px-3 py-2 text-[10px] font-bold text-neutral-400">%100'ün üstü girilebilir (en fazla %1000). Yüzde, işin <b>TOPLAM</b> maliyetinin (taban + ek hizmetler + km + geçişler + ev tipi farkı + sabit ek) üzerine eklenir. Örnek: 200 km → %15 · 400 km → %25 + 3.000 ₺. 300 km'lik işte 1. kademe, 500 km'lik işte 2. kademe uygulanır (tam eşit = aşmaz). En küçük kademe aşılınca köprü / geçiş ücretleri de eklenir; altında Avrupa Yakası ekstrası eskisi gibi uygulanır. Kaydedince kademeler küçükten büyüğe sıralanır.</p>
                  </div>
                </div>

                {/* DEĞİŞTİ (kullanıcı talebi): EV TİPİNE GÖRE KM FARKI — uzun yol kuralları gibi KADEMELİ.
                    Toplam km hangi kademeleri AŞARSA aşılan EN YÜKSEK kademenin ev tipi yüzdesi km tutarına eklenir. */}
                <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[11px] font-black text-white tracking-wide bg-emerald-600">EV TİPİNE GÖRE KM FARKI (KADEMELİ · KM TUTARINA % ARTIŞ)</div>
                  <p className="px-3 pt-2 text-[11px] font-bold text-neutral-600">Büyük ev daha çok araç, ekip ve yakıt ister: km tutarı (toplam km × km ücreti) ev tipinin yüzdesi kadar artırılır. Örnek: 1.000 km × 15 ₺ = 15.000 ₺ · 3+1 için %20 → +3.000 ₺ · %120 → +18.000 ₺. 0 = fark yok; %100'ün üstü girilebilir (en fazla %1000).</p>
                  <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                      <div className="px-3 pt-2 grid grid-cols-[1.2fr_repeat(5,1fr)_28px] gap-2 text-[10px] font-black uppercase text-neutral-500">
                        <span>Toplam km aşarsa</span>{FIYAT_ODALAR.map(o => <span key={o} className="text-center">{o}</span>)}<span />
                      </div>
                      {(M.odaKademeleri || []).length === 0 && <p className="px-3 py-2 text-[11px] font-bold text-neutral-400">Kademe yok — ev tipine göre km farkı uygulanmaz.</p>}
                      {(M.odaKademeleri || []).map((k, i) => (
                        <div key={i} className={`px-3 py-1.5 grid grid-cols-[1.2fr_repeat(5,1fr)_28px] gap-2 items-center ${i % 2 ? 'bg-neutral-50' : 'bg-white'}`}>
                          <span className="flex items-center gap-1">{hucre(['mesafe', 'odaKademeleri', i, 'km'])}{duzenle && <span className="text-[10px] font-black text-neutral-500">km</span>}</span>
                          {FIYAT_ODALAR.map(o => (
                            <span key={o} className="flex items-center justify-center gap-1">{hucre(['mesafe', 'odaKademeleri', i, 'yuzde', o])}{duzenle && <span className="text-[10px] font-black text-neutral-500">%</span>}</span>
                          ))}
                          {duzenle ? (
                            <button type="button" title="Kademeyi sil" onClick={() => setTaslak(t => ({ ...t, mesafe: { ...t.mesafe, odaKademeleri: (t.mesafe?.odaKademeleri || []).filter((_, j) => j !== i) } }))}
                              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                          ) : <span />}
                        </div>
                      ))}
                    </div>
                  </div>
                  {duzenle && (
                    <div className="px-3 py-2">
                      <button type="button" onClick={() => setTaslak(t => {
                        const liste = [...(t.mesafe?.odaKademeleri || [])].sort((a, b) => (Number(a.km) || 0) - (Number(b.km) || 0));
                        const son = liste[liste.length - 1];
                        // Yeni kademe: son kademenin 200 km fazlası, yüzdeleri son kademeden kopyalanır (sonra düzenlenir)
                        const yeni = { km: son ? (Number(son.km) || 0) + 200 : 0, yuzde: Object.fromEntries(FIYAT_ODALAR.map(o => [o, Number(son?.yuzde?.[o]) || 0])) };
                        return { ...t, mesafe: { ...t.mesafe, odaKademeleri: [...(t.mesafe?.odaKademeleri || []), yeni] } };
                      })} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5" /> Kademe Ekle
                      </button>
                    </div>
                  )}
                  <p className="px-3 py-2 text-[10px] font-bold text-neutral-400">Örnek: 0 km → 3+1 %10 · 600 km → 3+1 %20. 300 km'lik 3+1 işte %10, 1.000 km'lik işte %20 uygulanır (tam eşit = aşmaz; 0 km kademesi her mesafede geçerli). Depo işlerinde depo boyutu ev tipi yerine geçer. Uzun yol kademelerinden bağımsızdır; ikisi birlikte uygulanabilir. Kaydedince kademeler küçükten büyüğe sıralanır.</p>
                </div>

                {/* GEÇİŞLER */}
                <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[11px] font-black text-white tracking-wide bg-emerald-600">ÜCRETLİ GEÇİŞLER (KAMYON · GEÇİŞ BAŞINA · EŞİK AŞILINCA)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {MESAFE_GECISLERI.map((g, i) => (
                      <div key={g.ic} className={`flex items-center justify-between gap-2 px-3 py-2 ${i % 2 ? 'bg-neutral-50' : 'bg-white'}`}>
                        <span className="text-xs font-bold text-neutral-700">{g.etiket}
                          {ttYolAl(veri, ['mesafe', 'gecis', g.ic]) === MESAFE_VARSAYILAN.gecis[g.ic] && <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">tahmini</span>}
                        </span>{hucre(['mesafe', 'gecis', g.ic])}
                      </div>
                    ))}
                  </div>
                  <p className="px-3 py-2 text-[10px] font-bold text-neutral-400">Google rotasında görünen geçiş otomatik işaretlenir; gidiş ve dönüş ayrı sayılır. Satışçı görüşme ekranından ± ile düzeltebilir.</p>
                </div>

                {/* CANLI ÖRNEKLER */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ornekler.map((o, oi) => (
                    <div key={oi} className="rounded-2xl bg-neutral-900 text-white p-3">
                      <p className="text-[11px] font-black text-emerald-300">Örnek {oi + 1} — {o.baslik}</p>
                      <div className="mt-1 text-[11px] space-y-0.5">
                        {o.kalemler.map((k, i) => <div key={i} className="flex justify-between gap-2"><span className="text-white/80">{k.ad}</span><span className="font-black">{ttTl(k.tutar)}</span></div>)}
                        <div className="flex justify-between border-t border-white/20 pt-1 mt-1 text-sm font-black"><span>Sistem fiyatı (taban)</span><span>{ttTl(o.toplam)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {sekme === 'kira' && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-neutral-500">Aylık depo kirası şube bazlıdır. Fiyatlar <b>+KDV</b> girilir; KDV dahil tutar (%{Math.round(TT_KDV * 100)}) otomatik hesaplanır. "Genel" satırı şube farketmez seçildiğinde ve web sitesinde kullanılır.</p>
              {/* YENİ (kullanıcı talebi): kira sitede WooCommerce ürünü olarak da satılıyor */}
              {duzenle && <p className="text-[11px] font-black text-orange-900 bg-orange-50 border border-orange-300 rounded-xl px-3 py-2">⚠️ {TT_WOO_UYARI}</p>}
              <div className="rounded-2xl border border-neutral-200 bg-white overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="bg-sky-600 text-white">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-black">Şube</th>
                      {kiraBoyutlari.map(b => <th key={b.id} className="text-right px-3 py-2.5 font-black">{b.id} Depo<span className="block text-[9px] font-bold text-white/80">{b.m3} m³ · {b.olcu}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {kiraSatirlari.map((sube, i) => (
                      <tr key={sube} className={`${i % 2 ? 'bg-neutral-50' : 'bg-white'} ${sube === 'Genel' ? 'border-b-2 border-sky-200' : ''}`}>
                        <td className="px-3 py-2 font-black text-neutral-800">{sube === 'Genel' ? 'Genel Liste (Şube farketmez)' : sube}</td>
                        {kiraBoyutlari.map(b => {
                          const yol = ['depoKira', sube, b.id];
                          const d = ttYolAl(veri, yol);
                          return (
                            <td key={b.id} className="px-3 py-2 text-right align-top">
                              <TTFiyatHucresi deger={d} duzenle={duzenle} onDegis={v => degis(yol, v)} degisti={d !== ttYolAl(kayitli, yol)} durum={durumlar.get(fiyatYolAnahtari(yol))} />
                              <span className="block text-[10px] font-bold text-neutral-400">+KDV / ay</span>
                              {/* İki fiyat: +KDV ve KDV dahil */}
                              <span className="block text-[11px] font-black text-sky-700">{d ? `${ttTl(Number(d) * (1 + TT_KDV))} KDV dahil` : '—'}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold text-emerald-900 space-y-0.5">
                <p className="font-black">🎁 Uzun dönem kampanyası (hesaplamada otomatik uygulanır)</p>
                <p>6 Ay Peşin → 5 ay öde, 1 ay hediye · 12 Ay Peşin → 10 ay öde, 2 ay hediye. Kredi kartı yalnızca toplu ödemede geçer.</p>
              </div>
            </div>
          )}
        </div>

        {/* YENİ (kullanıcı talebi): KAYDETMEDEN ÖNCE ÖZET — "şu değerler değişecek" */}
        {ozet && (
          <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center p-3" onClick={() => !kaydediliyor && setOzet(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 bg-neutral-900 text-white">
                <p className="text-sm font-black">Şu değerler değişecek ({ozet.farklar.length} hücre)</p>
                <p className="text-[11px] font-bold text-neutral-400">Kayıt v{fiyatBilgi?.versiyon || 1} → v{(fiyatBilgi?.versiyon || 1) + 1} · {currentUser?.fullName}</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {ozet.uyarilar.length > 0 && (
                  <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-3 text-[11px] font-bold text-orange-900">
                    <p className="font-black flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Büyük boy küçükten ucuz ({ozet.uyarilar.length}) — kontrol edin, yine de kaydedebilirsiniz:</p>
                    <ul className="mt-1 space-y-0.5 list-disc pl-5">{ozet.uyarilar.map(u => <li key={fiyatYolAnahtari(u.yol)}>{u.etiket}: {u.mesaj}</li>)}</ul>
                  </div>
                )}
                {ozet.kiraDegisti && <p className="rounded-xl border-2 border-orange-300 bg-orange-50 p-3 text-[11px] font-black text-orange-900">⚠️ Kiralık Depo fiyatı değişiyor: {TT_WOO_UYARI}</p>}
                <table className="w-full text-[11px]">
                  <thead><tr className="text-neutral-500"><th className="text-left font-black pb-1">Hücre</th><th className="text-right font-black pb-1 px-2">Eski</th><th className="text-right font-black pb-1">Yeni</th></tr></thead>
                  <tbody>
                    {ozet.farklar.map(f => (
                      <tr key={fiyatYolAnahtari(f.yol)} className="border-t border-neutral-100">
                        <td className="py-1 pr-2 font-bold text-neutral-700">{f.etiket}</td>
                        <td className="py-1 px-2 text-right text-neutral-500 line-through whitespace-nowrap">{ttFarkDeger(f, f.eski)}</td>
                        <td className="py-1 text-right font-black text-neutral-900 whitespace-nowrap">{ttFarkDeger(f, f.yeni)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-neutral-200 flex justify-end gap-2">
                <button type="button" disabled={kaydediliyor} onClick={() => setOzet(null)} className="px-3 py-2 rounded-xl border border-neutral-300 text-xs font-black">Geri Dön ve Düzelt</button>
                <button type="button" disabled={kaydediliyor} onClick={kaydetOnayla} className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-60">
                  {kaydediliyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Onayla ve Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
