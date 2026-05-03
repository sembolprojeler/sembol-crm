import React, { useState, useEffect } from 'react';
import { 
  Truck, Calendar, MapPin, Phone, FileText, 
  CheckCircle, Clock, PlusCircle, ClipboardList, 
  Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Briefcase, Car, Wallet, CheckSquare, Shield, GripVertical, Activity,
  ArrowUpRight, ArrowDownRight, Landmark, CreditCard, DollarSign, ArrowRightLeft, ArrowUpDown,
  UserPlus, Camera, Upload, Edit, Ban, LogOut, Lock, Mail, Bell, User, Sparkles, Loader2, Copy, MessageSquareText,
  MessageCircle, Send, Package, Database, Download, History, Save, Search, Key, BarChart, TrendingUp
} from 'lucide-react';

// --- FIREBASE BAĞLANTISI ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, setDoc, getDocs 
} from "firebase/firestore";

// YEREL VE BULUT ORTAMI UYUM KONTROLÜ
const defaultFirebaseConfig = {
  apiKey: "AIzaSyD8ofu_2rZwJeHWftmr6STilgF_qjO3LVI",
  authDomain: "sembol-operasyon-merkezi.firebaseapp.com",
  projectId: "sembol-operasyon-merkezi",
  storageBucket: "sembol-operasyon-merkezi.firebasestorage.app",
  messagingSenderId: "1054049299174",
  appId: "1:1054049299174:web:2193f916a3501543d92927"
};
const firebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config ? JSON.parse(__firebase_config) : defaultFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sembol-crm-lokal';
// ----------------------------

function useCloudState(key, initialValue, authUser) {
  const [state, setState] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'sembol_cloud_state', key);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setState(docSnap.data().value);
      } else {
        setDoc(docRef, { value: initialValue }).catch(console.error);
        setState(initialValue);
      }
      setIsLoaded(true);
    }, (err) => {
      console.error(err);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, [authUser, key]);

  const setCloudState = (newValue) => {
    setState((prevState) => {
      const evaluated = typeof newValue === 'function' ? newValue(prevState) : newValue;
      if (authUser) {
         const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'sembol_cloud_state', key);
         setDoc(docRef, { value: evaluated }).catch(console.error);
      }
      return evaluated;
    });
  };

  return [state, setCloudState, isLoaded];
}

// TÜRKİYE İL VE İLÇE VERİTABANI
const TURKEY_LOCATIONS = {
  "İstanbul (Avrupa)": ["Arnavutköy", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kâğıthane", "Küçükçekmece", "Sarıyer", "Silivri", "Sultangazi", "Şişli", "Zeytinburnu"],
  "İstanbul (Anadolu)": ["Adalar", "Ataşehir", "Beykoz", "Çekmeköy", "Kadıköy", "Kartal", "Maltepe", "Pendik", "Sancaktepe", "Sultanbeyli", "Şile", "Tuzla", "Ümraniye", "Üsküdar"],
  "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  "Antalya": ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
  "Bursa": ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"]
};
const PROVINCES = Object.keys(TURKEY_LOCATIONS);
const FLOORS = ['Bodrum Kat', 'Giriş Kat', 'Müstakil / Villa', ...Array.from({ length: 30 }, (_, i) => `${i + 1}. Kat`)];

// DEPOEVİM TESİSLERİ
const DEPO_LOCATIONS = [
  { name: "Pendik Depoevim", province: "İstanbul (Anadolu)", district: "Pendik", address: "Bahçelievler Mah. Yeni Sk. No: 5/A" },
  { name: "Kartal Depoevim", province: "İstanbul (Anadolu)", district: "Kartal", address: "Yalı Mah. Bağlar Cad. No: 74/2" },
  { name: "Çekmeköy Depoevim", province: "İstanbul (Anadolu)", district: "Çekmeköy", address: "Ekşioğlu Mah. Atabey Cad. No: 28/2" },
  { name: "Ümraniye Depoevim", province: "İstanbul (Anadolu)", district: "Ümraniye", address: "Dudullu OSB Mah. 1. Cad. No: 30/4" }
];

// --- GEMINI API CALLER ---
const callGeminiAPI = async (prompt, isJson = false) => {
  const apiKey = "AIzaSyAQNBCWSbtmPEQGD4jQEo7BdoRQC_uoV8I"; // Sistem runtime'da otomatik tanımlar
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (isJson) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          customerName: { type: "STRING" },
          customerPhone: { type: "STRING" },
          date: { type: "STRING", description: "YYYY-MM-DD" },
          price: { type: "STRING" },
          summaryNotes: { type: "STRING" }
        }
      }
    };
  }

  const fetchWithRetry = async (attempt = 0) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errInfo = await response.json().catch(() => ({}));
        throw new Error(errInfo.error?.message || 'API Error');
      }
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      if (attempt < 5) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        return fetchWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  return fetchWithRetry();
};

const CopyButton = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const el = document.createElement('textarea');
    el.value = content;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button 
      onClick={handleCopy}
      type="button"
      className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition flex justify-center items-center gap-2 shadow-lg shadow-purple-600/20"
    >
      {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />} 
      {copied ? 'Kopyalandı! (WhatsApp\'a Yapıştırın)' : 'Panoya Kopyala'}
    </button>
  );
};

// --- MALZEME TAHMİN MOTORU ---
const calculateMaterials = (roomCount, packingType) => {
   let multiplier = 1;
   if (roomCount === '1+0' || roomCount === 'Parça Eşya' || roomCount === 'Depoevim Tesisleri') multiplier = 0.5;
   else if (roomCount === '1+1') multiplier = 1;
   else if (roomCount === '2+1') multiplier = 1.5;
   else if (roomCount === '3+1') multiplier = 2;
   else if (roomCount === '4+1') multiplier = 2.5;
   else if (roomCount === 'Villa' || roomCount === 'Ofis') multiplier = 3.5;
   else multiplier = 1;

   let est = {};
   const isCompanyPacking = packingType === 'Toplama Yapılacak' || packingType === 'Kendi İşimiz';
   
   if (isCompanyPacking) {
      if (roomCount === '1+1') est = { strec: 1.5, bant: 6, poset: 10, kagit: 2, koli: 15 };
      else if (roomCount === '2+1') est = { strec: 2, bant: 8, poset: 20, kagit: 3, koli: 25 };
      else if (roomCount === '3+1') est = { strec: 3, bant: 10, poset: 30, kagit: 4, koli: 35 };
      else est = { 
        strec: Number((1.5 * multiplier).toFixed(1)), 
        bant: Math.round(6 * multiplier), 
        poset: Math.round(10 * multiplier), 
        kagit: Number((2 * multiplier).toFixed(1)), 
        koli: Math.round(15 * multiplier) 
      };
   } else {
      if (roomCount === '1+1') est = { strec: 1, bant: 4, poset: 7, kagit: 0.5, koli: 5 };
      else if (roomCount === '2+1') est = { strec: 1.5, bant: 5, poset: 10, kagit: 1, koli: 7 };
      else if (roomCount === '3+1') est = { strec: 2, bant: 7, poset: 13, kagit: 1.5, koli: 10 };
      else est = { 
        strec: Number((1 * multiplier).toFixed(1)), 
        bant: Math.round(4 * multiplier), 
        poset: Math.round(7 * multiplier), 
        kagit: Number((0.5 * multiplier).toFixed(1)), 
        koli: Math.round(5 * multiplier) 
      };
   }
   return est;
};

// --- SÖZLEŞME PDF OLUŞTURUCU ---
const generateContractPDF = (job) => {
  const printWindow = window.open('', '_blank');
  
  const bakiye = (parseInt(job.price || 0) - parseInt(job.deposit || 0)).toLocaleString('tr-TR');
  const fiyat = parseInt(job.price || 0).toLocaleString('tr-TR');
  const kapora = parseInt(job.deposit || 0).toLocaleString('tr-TR');

  const html = `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${job.customerName} - Sözleşme</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; }
      
      .page { 
        width: 210mm; 
        height: 296mm; 
        background: white; 
        margin: 5mm auto; 
        padding: 15mm; 
        position: relative; 
        box-shadow: 0 0 10px rgba(0,0,0,0.2); 
        overflow: hidden; 
        page-break-after: always; 
      }
      
      @media print {
        body { background: white; margin: 0; padding: 0; display: block; }
        .page { margin: 0; padding: 12mm 15mm; box-shadow: none; border: none; height: 296mm; page-break-after: always; }
      }
      
      .header { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 10px; }
      .title-text { font-size: 22px; font-weight: 900; margin-top: 8px; letter-spacing: 1px; color: #111; }
      .subtitle { font-size: 11px; font-weight: bold; color: #dc2626; letter-spacing: 2px; }
      .contact-info { font-size: 10px; margin-top: 4px; color: #444; }
      
      .main-title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin: 12px 0; color: #111; }
      .section-title { background: #f3f4f6; padding: 6px 10px; font-weight: bold; border-left: 4px solid #dc2626; margin-top: 15px; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; color: #111; }
      
      table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; }
      td { border: 1px solid #d1d5db; padding: 5px 8px; }
      .label { font-weight: bold; width: 35%; background: #f9fafb; }
      
      .desc-box { font-size: 11px; border: 1px solid #d1d5db; padding: 8px; min-height: 40px; color: #111; }
      
      .signatures { display: flex; justify-content: space-between; position: absolute; bottom: 15mm; left: 15mm; right: 15mm; }
      .sign-box { width: 45%; text-align: center; border-top: 1px solid #111; padding-top: 8px; font-size: 11px; color: #111; }
      
      /* 2. Sayfa Özel Stiller */
      .terms { font-size: 9.5px; line-height: 1.35; color: #111; }
      .terms h4 { font-size: 10.5px; font-weight: bold; margin-top: 10px; margin-bottom: 3px; color: #dc2626; text-transform: uppercase; }
      .terms p { margin: 2px 0; text-align: justify; }
    </style>
  </head>
  <body>
    
    <!-- SAYFA 1: OPERASYON DETAYLARI -->
    <div class="page">
      <div class="header">
        <div class="title-text" style="font-size: 28px; margin-bottom: 5px; margin-top: 0;">SEMBOL NAKLİYAT</div>
        <div class="subtitle">EVDEN EVE - ASANSÖRLÜ TAŞIMA - DEPOLAMA</div>
        <div class="contact-info">
          Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL | Tel: (0216) 390 89 99<br/>
          Vergi No: 7600944287 | www.sembolnakliyat.com
        </div>
      </div>

      <div class="main-title">EVDEN EVE TAŞIMACILIK VE NAKLİYE SÖZLEŞMESİ</div>

      <div class="section-title">YÜKLEME ADRESİ (NEREDEN)</div>
      <table>
        <tr><td class="label">Adres:</td><td>${job.fromProvince} / ${job.fromDistrict} - ${job.fromAddress}</td></tr>
        <tr><td class="label">Kat:</td><td>${job.fromFloor}</td></tr>
        <tr><td class="label">Oda Sayısı:</td><td>${job.fromRoomCount}</td></tr>
        <tr><td class="label">Taşıma Şekli (Bina Asansörü / Dış Cephe):</td><td>${job.fromTransportMethod}</td></tr>
        <tr><td class="label">Toplama Hizmeti:</td><td>${job.fromPacking}</td></tr>
      </table>

      <div class="section-title">BOŞALTMA ADRESİ (NEREYE)</div>
      <table>
        <tr><td class="label">Adres:</td><td>${job.toProvince ? `${job.toProvince} / ${job.toDistrict} - ${job.toAddress}` : 'Belirtilmedi'}</td></tr>
        <tr><td class="label">Kat:</td><td>${job.toFloor || 'Belirtilmedi'}</td></tr>
        <tr><td class="label">Oda Sayısı:</td><td>${job.toRoomCount || 'Belirtilmedi'}</td></tr>
        <tr><td class="label">Taşıma Şekli (Bina Asansörü / Dış Cephe):</td><td>${job.toTransportMethod || 'Belirtilmedi'}</td></tr>
      </table>

      <div class="section-title">AÇIKLAMA / EKSTRA NOT</div>
      <div class="desc-box">
        ${job.contractDetails ? job.contractDetails.replace(/\n/g, '<br/>') : ''}
      </div>

      <div class="section-title">ANLAŞMA VE ÖDEME DETAYLARI</div>
      <table>
        <tr><td class="label">Taşıma Tarihi / Saati:</td><td>${job.date} / ${job.time}</td></tr>
        <tr><td class="label">Anlaşma Bedeli (TL):</td><td>${fiyat} ₺</td></tr>
        <tr><td class="label">Alınan Peşinat (Kapora):</td><td>${kapora} ₺</td></tr>
        <tr><td class="label">Kalan Bakiye (TL):</td><td>${bakiye} ₺</td></tr>
        <tr><td class="label" style="background: #fee2e2; color: #dc2626;">Müşteri Teslim Kodu:</td><td style="font-size: 15px; font-weight: 900; letter-spacing: 3px; color: #dc2626; background: #fef2f2;">${job.deliveryCode || '--------'}</td></tr>
      </table>

      <div class="signatures">
        <div class="sign-box">
          <b>HİZMET VEREN (KAŞE / İMZA)</b><br/><br/><br/>
          Sembol Nakliyat Depoculuk Tic. Ltd. Şti.
        </div>
        <div class="sign-box">
          <b>HİZMET ALAN (MÜŞTERİ)</b><br/><br/>
          Adı Soyadı: ${job.customerName}<br/>
          İletişim No: ${job.customerPhone}<br/>
          TC / Vergi No: ${job.tcNo || job.taxNo || '...........................................'}<br/>
          İmza:
        </div>
      </div>
    </div>

    <!-- SAYFA 2: SÖZLEŞME ŞARTLARI -->
    <div class="page">
      <div class="header">
        <div class="title-text" style="font-size: 20px; margin-bottom: 5px; margin-top: 0;">SEMBOL NAKLİYAT</div>
        <div class="main-title" style="margin: 8px 0; font-size: 14px;">HİZMET KAPSAMI VE OPERASYONEL ŞARTLAR</div>
      </div>

      <div class="terms">
        <h4>SÖZLEŞME ŞARTLARI VE MADDELERİ</h4>
        <p>1. Taşıma işlemi kapalı kasa nakliye aracı ile gerçekleştirilecek olup, aksi belirtmedikçe tek araç için geçerlidir.</p>
        <p>2. Eşyaların ambalajlanması, mobilyaların de-montaj ve montaj işlemleri yüklenici firma sorumluluğundadır.</p>
        <p>3. Şehir içi nakliye hizmetinin, mücbir sebepler haricinde aynı iş günü içerisinde tamamlanması esastır.</p>
        <p>4. Para kasası, piyano ve özel yapım eşyalar gibi özel taşıma gerektiren yükler önceden bildirilmelidir; aksi halde ek ücret tahakkuk ettirilir.</p>
        <p>5. Sözleşme yapılan kişinin adreslerde bulunması ve süreci takip etmesi gerekmektedir.</p>
        
        <h4>TEKNİK SINIRLANDIRMALAR VE İSTİSNALAR</h4>
        <p>6. Avize, perde, ankastre ve duvarda takılı eşyaların sökülümü yapılır; ancak montaj işlemleri hizmet kapsamı dışındadır.</p>
        <p>7. Korniş, klima, aspiratör montajı, duvar montajı ve elektrik işleri firmanın sorumluluğunda değildir.</p>
        <p>8. Tesisatı hazır olmayan beyaz eşyaların bağlantısı teknik emniyet gerekçesiyle yapılmamaktadır.</p>
        <p>9. Klima sökülüm ve montajı hizmet kapsamında değildir.</p>
        <p>10. Toplama hizmeti alındığında yeni adreste kolileri açılıp dizme/yerleştirme hizmeti yoktur.</p>
        
        <h4>NAKLİYE VE ERİŞİM KOŞULLARI</h4>
        <p>11. Nakliye aracının yükleme ve boşaltma noktalarına yanaşma imkanı sağlanmalıdır. 30 metreyi aşan mesafelerde ek işçilik maliyeti oluşur.</p>
        <p>12. Apartman boşluğuna veya kapı ölçülerine sığmayan eşyaların taşınması firmanın sorumluluğu dışındadır.</p>
        <p>13. Kat farkı veya asansör kullanımı değişiklikleri durumunda fiyatlandırma güncellenebilir.</p>
        <p>14. Toplama hizmeti alınmadığında küçük eşyaların kolileri taşımaya hazır halde bulunmalıdır.</p>
        
        <h4>HASAR, SİGORTA VE SORUMLULUK</h4>
        <p>15. Taşınan emtia, nakliye esnasında oluşabilecek risklere karşı Emtia Sigortası güvencesindedir.</p>
        <p>16. Olası personel kaynaklı hasarda firma, nakliye bedelinin %10'una kadar doğrudan tazmin sorumluluğunu kabul eder.</p>
        <p>17. Hasar gören eşyalar için firma, imkanlar doğrultusunda teknik tamir desteği sağlamaktadır.</p>
        <p>18. Fabrika kutusu olmayan elektronik cihazlar, ziynet eşyası, nakit para ve yanıcı/akıcı maddeler sorumluluk dışındadır.</p>
        <p>19. Hasar ve eksik bildirimlerinin teslimat anında yapılması zorunludur; adres terk edildikten sonraki talepler için sorumluluk alınmaz.</p>
        
        <h4>ÖDEME, İPTAL VE DEPOLAMA HÜKÜMLERİ</h4>
        <p>20. Hizmet bedelinin %10'u kapora olarak alınır; kalan bakiye teslim edilecek adreste tahsil edilir. Fiyatlara KDV dahil değildir.</p>
        <p>21. Taşıma gününe 72 saatten az süre kala yapılan iptal ve değişikliklerde toplam bedelin %50'si cayma tazminatı olarak fatura edilir.</p>
        <p>22. Depolama hizmetinde belirtilen fiyat sadece depoya giriş nakliyesini kapsar; çıkış nakliyesi ayrıca fiyatlandırılır.</p>
        <p>23. Yüklenici firma, taşıma tarihine 72 saat kala herhangi bir mazeret bildirmeksizin sözleşmeyi tek taraflı feshetme hakkına sahiptir.</p>
        
        <h4>GİZLİLİK VE HUKUKİ YETKİ</h4>
        <p>24. Müşteri kişisel verileri KVKK kapsamında gizli tutulur.</p>
        <p>25. Firmanın ticari itibarını zedeleyici art niyetli, kötüleyici yorumlar ve paylaşımlar yapılamaz.</p>
        <p>26. Kaydını yaptırıp kişisel bilgilerini firma ile paylaşmış hizmet alan kişiye firmamız tarafından telefon/internet aracılığıyla tüm maddeler bildirilmiş veya bahsedilmiştir. Tüm maddeler kabul edilmiştir.</p>
        <p>27. Firma tarafından hizmet alan kişiler sözleşme maddeleri dahilinde haklarını arayabilirler. <b>İşbu 27 maddelik sözleşmeden doğan ihtilaflarda İstanbul (Anadolu) Mahkemeleri ve İcra Daireleri yetkilidir.</b></p>
      </div>

      <div class="signatures">
        <div class="sign-box">
          <b>HİZMET VEREN (KAŞE / İMZA)</b><br/><br/><br/>
          Sembol Nakliyat Depoculuk Tic. Ltd. Şti.
        </div>
        <div class="sign-box">
          <b>HİZMET ALAN (MÜŞTERİ)</b><br/><br/><br/>
          Adı Soyadı: ${job.customerName}<br/>
          İmza:
        </div>
      </div>
    </div>
    
    <script>
      // PDF çıktısı için otomatik yazdırma diyaloğunu aç
      setTimeout(() => {
        window.print();
      }, 500);
    </script>
  </body>
  </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

// --- BİLEŞENLER ---

const DashboardView = ({ jobs, handleGenerateDailySummary }) => (
  <div className="space-y-6 animate-in fade-in">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
        <p className="text-neutral-500 text-sm font-medium mb-1">Toplam İş</p>
        <p className="text-2xl font-black text-black">{jobs.length}</p>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
        <p className="text-neutral-500 text-sm font-medium mb-1">Bekleyen</p>
        <p className="text-2xl font-black text-neutral-600">{jobs.filter(j => j.status === 'pending').length}</p>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 border-l-4 border-l-red-600">
        <p className="text-neutral-500 text-sm font-medium mb-1">Sahada (Devam)</p>
        <p className="text-2xl font-black text-red-600">{jobs.filter(j => j.status === 'in-progress').length}</p>
      </div>
      <div className="bg-black p-4 rounded-2xl shadow-sm border border-black">
        <p className="text-neutral-400 text-sm font-medium mb-1">Tamamlanan</p>
        <p className="text-2xl font-black text-white">{jobs.filter(j => j.status === 'completed').length}</p>
      </div>
    </div>
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 text-center flex flex-col items-center">
        <Calendar className="w-12 h-12 text-neutral-300 mb-4" />
        <h2 className="text-lg font-bold text-neutral-700 mb-2">Operasyon Özeti</h2>
        <p className="text-sm text-neutral-500 mb-2">Bugünkü ve yaklaşan işlerinizi görmek için sol menüden sekmeleri kullanabilirsiniz.</p>
        
        <button 
          onClick={() => handleGenerateDailySummary(jobs)} 
          className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
        >
          <Sparkles className="w-5 h-5"/> ✨ Yapay Zeka Ekip Sabah Brifingi
        </button>
    </div>
  </div>
);

const AddJobView = ({
  type, formData, setFormData, handleInputChange, handleProvinceChange,
  handleDepoChange, toggleDepoDirection, handleAddJob, editingJobId, handleSwapAddresses
}) => {
  const [aiText, setAiText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleAIFill = async () => {
    if(!aiText.trim()) return;
    setIsAiLoading(true);
    setAiError('');
    try {
      const prompt = `Nakliyat müşterisinden gelen mesajdan kayıt formu bilgilerini çıkar:
      Mesaj: "${aiText}"
      Bulabildiklerini doldur, bulamadıklarını boş bırak. summaryNotes kısmına detayları özetle.
      Sadece JSON döndür.`;
      
      const res = await callGeminiAPI(prompt, true);
      let cleanRes = res.replace(/```json/gi, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanRes);
      
      setFormData(prev => ({
        ...prev,
        customerName: data.customerName || prev.customerName,
        customerPhone: data.customerPhone || prev.customerPhone,
        date: data.date || prev.date,
        price: data.price || prev.price,
        notes: data.summaryNotes ? (prev.notes ? prev.notes + '\n\n✨ AI Özet: ' + data.summaryNotes : '✨ AI Özet: ' + data.summaryNotes) : prev.notes
      }));
      setAiText('');
    } catch (e) {
      console.error("AI Error:", e);
      setAiError('Yapay zeka asistanı mesajı okuyamadı veya geçici bir sorun yaşandı.');
    } finally {
      setIsAiLoading(false);
    }
  };

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

      {/* YAPAY ZEKA ASİSTANI */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-5 rounded-2xl border border-purple-100 mb-6 shadow-inner">
        <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" /> ✨ Yapay Zeka ile Hızlı Doldur
        </h3>
        <p className="text-sm text-purple-800 mb-3">Müşterinin WhatsApp mesajını veya dağınık notlarınızı buraya yapıştırın, formu otomatik dolduralım.</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row gap-3">
            <textarea 
              value={aiText} 
              onChange={(e) => setAiText(e.target.value)} 
              className="flex-1 p-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none h-14 resize-none transition bg-white text-sm" 
              placeholder="Örn: Merhaba, haftaya Salı Kadıköy'den Ümraniye'ye 3+1 ev taşıyacağız, Ahmet Yılmaz 0555123..." 
            />
            <button 
              type="button"
              onClick={handleAIFill}
              disabled={isAiLoading || !aiText.trim()}
              className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-purple-600/30"
            >
              {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Formu Doldur</>}
            </button>
          </div>
          {aiError && (
            <p className="text-xs font-bold text-red-600 flex items-center gap-1 mt-1">
              <AlertTriangle className="w-4 h-4" /> {aiError}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleAddJob} className="space-y-6">
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
                <select required name="fromDistrict" value={formData.fromDistrict} onChange={handleInputChange} disabled={!formData.fromProvince} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                  <option value="">İlçe Seçiniz</option>
                  {formData.fromProvince && TURKEY_LOCATIONS[formData.fromProvince]?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
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
                   <select 
                     value={addr.district} 
                     onChange={(e) => setFormData(prev => ({ ...prev, extraLoadingAddresses: prev.extraLoadingAddresses.map(a => a.id === addr.id ? { ...a, district: e.target.value } : a) }))} 
                     disabled={!addr.province} 
                     className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                   >
                     <option value="">İlçe Seçiniz</option>
                     {addr.province && TURKEY_LOCATIONS[addr.province]?.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
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
                <select required name="toDistrict" value={formData.toDistrict} onChange={handleInputChange} disabled={!formData.toProvince} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white">
                  <option value="">İlçe Seçiniz</option>
                  {formData.toProvince && TURKEY_LOCATIONS[formData.toProvince]?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
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
                   <select 
                     value={addr.district} 
                     onChange={(e) => setFormData(prev => ({ ...prev, extraUnloadingAddresses: prev.extraUnloadingAddresses.map(a => a.id === addr.id ? { ...a, district: e.target.value } : a) }))} 
                     disabled={!addr.province} 
                     className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white"
                   >
                     <option value="">İlçe Seçiniz</option>
                     {addr.province && TURKEY_LOCATIONS[addr.province]?.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
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

        <button type="submit" className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-700 transition flex justify-center items-center gap-2 text-xl shadow-xl shadow-red-600/30">
          <PlusCircle className="w-6 h-6" /> 
          {editingJobId ? 'Kaydı Güncelle' : 'Kaydı Oluştur'}
        </button>
      </form>
    </div>
  );
};

const CurrentJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials, setCancelJobId, setViewingImage }) => {
  const [viewDate, setViewDate] = useState(new Date());

  const sendAppointmentMessage = (job, method) => {
    let phone = job.customerPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '90' + phone.substring(1);
    else if (!phone.startsWith('90')) phone = '90' + phone;

    const msg = `Merhaba ${job.customerName},\n\nBen Sembol Nakliyat operasyon sorumlunuz. ${job.date} saat ${job.time} sularında planlanan işleminiz için ekibimiz ve aracımız hazırlıklarını tamamlamıştır.\n\n🔒 *Güvenliğiniz için Teslim Kodunuz:* ${job.deliveryCode || 'Bulunmuyor'}\nEkibimiz geldiğinde eşya teslimi için bu kodu kendilerine iletebilirsiniz.\n\nHerhangi bir sorun durumunda veya talebinizde doğrudan benimle bu numara üzerinden iletişime geçebilirsiniz.\n\nŞimdiden yeni yerinizin hayırlı olmasını dileriz. Süreci sizin için en iyi şekilde tamamlamaya çalışacağız. Görüşmek üzere!`;

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
  const dailyJobs = jobs.filter(j => j.date === dateStr && j.status !== 'cancelled');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex justify-between items-center">
        <button onClick={prevDay} className="p-4 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl transition"><ChevronLeft className="w-6 h-6" /></button>
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold text-black">{formattedDate}</h2>
          <p className="text-sm font-medium text-neutral-500 mt-1">Günlük Operasyonlar Ajandası</p>
        </div>
        <button onClick={nextDay} className="p-4 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl transition"><ChevronRight className="w-6 h-6" /></button>
      </div>

      <div className="space-y-4">
        {dailyJobs.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-neutral-200 text-center text-neutral-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <p className="text-lg font-medium">Bu tarihe kayıtlı herhangi bir aktif operasyon bulunmuyor.</p>
          </div>
        ) : (
          dailyJobs.map(job => (
            <div key={job.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${job.status === 'cancelled' ? 'border-red-400 bg-red-50/40' : job.isSpecial ? 'border-yellow-400 ring-2 ring-yellow-100 bg-yellow-50/30' : 'border-neutral-200'} flex flex-col md:flex-row gap-6 justify-between hover:border-red-600 transition group cursor-pointer`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
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
                  
                  {job.price && (
                    <div className="ml-auto text-right">
                      <span className="block text-lg font-black text-green-600">₺{parseInt(job.price).toLocaleString('tr-TR')}</span>
                      {job.deposit && <span className="text-[10px] font-bold text-neutral-500">Kapora: ₺{parseInt(job.deposit).toLocaleString('tr-TR')}</span>}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="flex items-center gap-1.5 text-sm font-bold bg-neutral-50 text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-200"><Phone className="w-4 h-4 text-black" /> {job.customerPhone}</span>
                  
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

            {job.endJobDetails && (
              <div className="mt-4 text-xs font-medium bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex flex-col gap-3">
                 <div className="flex items-center gap-2 border-b border-green-200/50 pb-2">
                   <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
                   <b className="text-green-900 text-sm">Personel Tarafından İş Sonlandırıldı</b>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                   <p><b>Ödeme:</b> {job.endJobDetails.paymentMethod}</p>
                   <p><b>Müşteri Memnuniyeti:</b> {job.endJobDetails.customerSatisfaction}</p>
                   <p><b>Eşya Hasarı:</b> {job.endJobDetails.damageStatus}</p>
                   <p><b>Kamyon Durumu:</b> {job.endJobDetails.truckStatus}</p>
                   {job.endJobDetails.truckImage && (
                     <button type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Kasa Fotoğrafı', name: job.endJobDetails.truckImage}); }} className="md:col-span-2 text-left text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 hover:bg-green-100 transition flex justify-between items-center shadow-sm">
                       <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Kasa Fotoğrafı:</b> {job.endJobDetails.truckImage}</span>
                       <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-green-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                     </button>
                   )}
                   {job.endJobDetails.damageImage && (
                     <button type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Hasar Fotoğrafı', name: job.endJobDetails.damageImage}); }} className="md:col-span-2 text-left text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition flex justify-between items-center shadow-sm">
                       <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Hasar Fotoğrafı:</b> {job.endJobDetails.damageImage}</span>
                       <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-red-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                     </button>
                   )}
                   {job.endJobDetails.damageDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Hasar Detayı:</b> {job.endJobDetails.damageDetails}</p>}
                   {job.endJobDetails.truckIssueDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Kamyon Sorunu:</b> {job.endJobDetails.truckIssueDetails}</p>}
                 </div>
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

              <button onClick={() => handleGenerateMessage(job)} className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5" title="Yapay Zeka ile Özel Mesaj">
                <Sparkles className="w-4 h-4"/> AI Mesaj
              </button>
              <button onClick={() => handleEstimateMaterials(job)} className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                <Package className="w-4 h-4"/> ✨ Malzeme Tahmini
              </button>
              {job.status !== 'cancelled' && (
                <button onClick={() => setCancelJobId(job.id)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <Ban className="w-4 h-4"/> İşi İptal Et
                </button>
              )}
            </div>
          </div>
        </div>
      ))
        )}
      </div>
    </div>
  );
};

const AllJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials, setCancelJobId }) => {
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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-black text-white border-b border-neutral-200">
            <tr>
              <th className="p-4 font-bold rounded-tl-xl">Tarih</th>
              <th className="p-4 font-bold">Müşteri Bilgisi</th>
              <th className="p-4 font-bold">Operasyon Güzergahı</th>
              <th className="p-4 font-bold text-right">Fiyat</th>
              <th className="p-4 font-bold text-center">Durum</th>
              <th className="p-4 font-bold">Atanan Personel</th>
              <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedJobs.map(job => (
              <tr key={job.id} className={`transition ${job.status === 'cancelled' ? 'bg-red-50/40 hover:bg-red-50' : job.isSpecial ? 'bg-yellow-50/40 hover:bg-yellow-100' : 'hover:bg-neutral-50'}`}>
                <td className="p-4 font-bold text-black whitespace-nowrap"><Clock className="w-4 h-4 inline mr-1 text-neutral-400"/> {job.date} <br/><span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block">{job.time}</span></td>
                <td className="p-4 font-bold text-neutral-800">
                  <div className="flex items-center gap-1.5">
                    {job.isSpecial && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    {job.customerName}
                  </div>
                  <span className="text-xs font-medium text-neutral-500 block mt-0.5">{job.customerPhone}</span>
                </td>
                <td className="p-4 text-neutral-600 text-xs min-w-[280px]">
                  <div className="mb-2 bg-neutral-50 p-2 rounded border border-neutral-100">
                    <div className="font-bold text-black mb-1">{job.extraLoadingAddresses?.length > 0 ? '1. AL:' : 'AL:'} {job.fromProvince}/{job.fromDistrict}</div>
                    <div className="text-[10px] text-neutral-500">{job.fromRoomCount} • {job.fromFloor} • {job.fromTransportMethod} • {job.fromPacking}</div>
                  </div>
                  {job.extraLoadingAddresses?.map((addr, idx) => (
                    <div key={addr.id} className="mb-2 bg-neutral-50 p-2 rounded border border-neutral-100">
                      <div className="font-bold text-black mb-1">{idx + 2}. AL: {addr.province}/{addr.district}</div>
                      <div className="text-[10px] text-neutral-500">{addr.roomCount} • {addr.floor} • {addr.transportMethod} • {addr.packing}</div>
                    </div>
                  ))}
                  
                  {job.toProvince && (
                    <div className="mt-3 mb-2 bg-red-50/50 p-2 rounded border border-red-100/50">
                      <div className="font-bold text-red-800 mb-1">{job.extraUnloadingAddresses?.length > 0 ? '1. VR:' : 'VR:'} {job.toProvince}/{job.toDistrict}</div>
                      <div className="text-[10px] text-red-600/80">{job.toRoomCount} • {job.toFloor} • {job.toTransportMethod} • {job.toPacking}</div>
                    </div>
                  )}
                  {job.extraUnloadingAddresses?.map((addr, idx) => (
                    <div key={addr.id} className="mb-2 bg-red-50/50 p-2 rounded border border-red-100/50">
                      <div className="font-bold text-red-800 mb-1">{idx + 2}. VR: {addr.province}/{addr.district}</div>
                      <div className="text-[10px] text-red-600/80">{addr.roomCount} • {addr.floor} • {addr.transportMethod} • {addr.packing}</div>
                    </div>
                  ))}
                </td>
                <td className="p-4 text-right">
                  {job.price ? (
                    <>
                      <div className="text-sm font-black text-green-600">₺{parseInt(job.price).toLocaleString('tr-TR')}</div>
                      {job.deposit && <div className="text-[10px] text-neutral-500 font-bold mt-1">Kpr: ₺{parseInt(job.deposit).toLocaleString('tr-TR')}</div>}
                    </>
                  ) : <span className="text-neutral-400">-</span>}
                </td>
                <td className="p-4 text-center">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase whitespace-nowrap ${
                    job.status === 'completed' ? 'bg-black text-white' :
                    job.status === 'in-progress' ? 'bg-red-600 text-white shadow-sm' :
                    job.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                    'bg-neutral-200 text-neutral-700'
                  }`}>
                    {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : job.status === 'cancelled' ? 'İptal Edildi' : 'Bekliyor'}
                  </span>
                </td>
                <td className="p-4 text-neutral-700 font-bold whitespace-nowrap">
                  {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 ? (
                    <div className="flex flex-col gap-1 w-fit">
                      {(job.teamNames || [job.team]).map((name, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border bg-blue-50 text-blue-700 border-blue-100 whitespace-nowrap">
                          <User className="w-3.5 h-3.5 shrink-0" /> {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border w-fit bg-yellow-50 text-yellow-700 border-yellow-100 whitespace-nowrap">
                      <User className="w-3.5 h-3.5 shrink-0" /> Atanmadı
                    </span>
                  )}
                  {job.assignedVehiclePlate && (
                    <span className="flex items-center gap-1.5 px-2 py-1 mt-1 rounded-lg text-xs border w-fit bg-purple-50 text-purple-700 border-purple-100 whitespace-nowrap">
                      <Truck className="w-3.5 h-3.5 shrink-0" /> {job.assignedVehiclePlate}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => generateContractPDF(job)} className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition" title="PDF Sözleşme Oluştur">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEditJob(job)} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition" title="Bilgileri Düzenle">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenAssignModal(job)} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition" title={job.team !== 'Atanmadı' ? 'Görevlendirmeyi Düzenle' : 'Görev Ata'}>
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleGenerateMessage(job)} className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition" title="Müşteri Mesajı Oluştur">
                      <MessageSquareText className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEstimateMaterials(job)} className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition" title="AI Malzeme Tahmini">
                      <Package className="w-4 h-4" />
                    </button>
                    {job.status !== 'cancelled' && (
                      <button onClick={() => setCancelJobId(job.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition" title="İşi İptal Et">
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sortedJobs.length === 0 && (
              <tr>
                <td colSpan="7" className="p-6 text-center text-neutral-500">Kayıtlı iş bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CancelledJobsView = ({ jobs, handleEditJob, handleRestoreJob }) => {
  const cancelledJobs = jobs.filter(j => j.status === 'cancelled');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
        <h2 className="text-xl font-bold text-black flex items-center gap-2">
          <Ban className="w-6 h-6 text-red-600" /> İptal Edilen İşler
        </h2>
      </div>
      <div className="space-y-4">
        {cancelledJobs.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 font-medium bg-neutral-50 rounded-xl border border-neutral-200">
            Kayıtlı iptal edilmiş iş bulunmuyor.
          </div>
        ) : (
          cancelledJobs.map(job => (
            <div key={job.id} className="p-4 border border-red-200 bg-red-50/30 rounded-xl flex flex-col md:flex-row gap-4 justify-between md:items-center">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="font-bold text-black text-lg">{job.customerName}</h3>
                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">İPTAL EDİLDİ</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                    {job.type || 'Nakliye'}
                  </span>
                </div>
                <p className="text-sm text-neutral-600"><Clock className="w-3.5 h-3.5 inline mr-1" /> {job.date} - {job.time}</p>
                <p className="text-sm text-neutral-600 mt-1"><MapPin className="w-3.5 h-3.5 inline mr-1 text-neutral-400" /> {job.fromDistrict} <ArrowRightLeft className="w-3 h-3 inline mx-1 text-neutral-300" /> {job.toDistrict || 'Belirtilmedi'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleRestoreJob(job.id)} className="px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center gap-2 text-sm shadow-md">
                  <ArrowRightLeft className="w-4 h-4" /> Geri Al (Aktif Et)
                </button>
                <button onClick={() => handleEditJob(job)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center gap-2 text-sm shadow-md">
                  <Edit className="w-4 h-4" /> Düzenle
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CalendarView = ({ jobs, handleEditJob }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]); 

  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // İptal edilenleri takvimden gizliyoruz
  const activeJobs = jobs.filter(j => j.status !== 'cancelled');
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

  const getCapacityBadge = (coreJobCount) => {
    if (coreJobCount === 0) return <span className="text-xs text-neutral-400 font-medium">Boş</span>;
    if (coreJobCount <= 3) return <span className="text-xs text-black font-bold bg-neutral-200 px-2 py-0.5 rounded-full">{coreJobCount} İş (Müsait)</span>;
    if (coreJobCount === 4) return <span className="text-xs text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded-full">{coreJobCount} İş (Yoğun)</span>;
    return <span className="text-xs text-white font-bold bg-neutral-800 px-2 py-0.5 rounded-full">{coreJobCount} İş (Dolu)</span>;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-black rounded-lg transition"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold text-black w-40 text-center">{monthNames[currentMonth]} {currentYear}</h2>
          <button onClick={nextMonth} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-black rounded-lg transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
        
        <div className="flex flex-col gap-2 items-end">
          <div className="flex flex-wrap gap-3 text-xs bg-neutral-50 p-2 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600"></div> Nakliye</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-600"></div> Depo</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500"></div> Asansör</div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs bg-neutral-50 p-2 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border border-neutral-300"></div> Boş (0)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-neutral-300"></div> Müsait (1-3)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600"></div> Yoğun (4)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-black"></div> Dolu (5+)</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dayNames.map(day => (
          <div key={day} className="text-center font-bold text-neutral-500 text-sm py-2">
            {day}
          </div>
        ))}
        
        {days.map((item, index) => {
          const coreJobs = item ? item.jobs.filter(j => j.type !== 'Asansör') : [];
          const asansorJobs = item ? item.jobs.filter(j => j.type === 'Asansör') : [];
          const isToday = item && item.date === today.toISOString().split('T')[0];
          const isFull = coreJobs.length >= 5;

          return (
            <div 
              key={index} 
              onClick={() => item && setSelectedDate(item.date)}
              className={`min-h-[100px] p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between ${item ? getCapacityColor(coreJobs.length) : 'bg-transparent border-transparent'} ${item && selectedDate === item.date ? 'ring-2 ring-red-600 ring-offset-2' : ''}`}
            >
              {item && (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-lg font-bold ${isToday ? 'bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : (isFull ? 'text-white' : 'text-black')}`}>
                      {item.day}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 items-start w-full">
                    {getCapacityBadge(coreJobs.length)}
                    
                    <div className="mt-1 flex flex-col gap-1 w-full">
                      {coreJobs.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                          {coreJobs.map(job => (
                            job.isSpecial ? 
                              <Star key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                            :
                              <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className={`w-2.5 h-2.5 rounded-full ${job.type === 'Depo' ? 'bg-blue-600' : 'bg-red-600'}`}></div>
                          ))}
                        </div>
                      )}
                      
                      {asansorJobs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5 pt-1 border-t border-black/10 w-full items-center">
                          {asansorJobs.map(job => (
                            job.isSpecial ?
                              <Star key={job.id} title={`${job.customerName} - ${job.team} (${job.type})`} className="w-3 h-3 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                            :
                              <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type})`} className="w-2 h-2 rounded-full bg-green-500"></div>
                          ))}
                        </div>
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
      {selectedDate && (
        <div className="mt-8 pt-6 border-t border-neutral-200 animate-in slide-in-from-bottom-4">
          <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-red-600" />
            {selectedDate.split('-').reverse().join('.')} Tarihindeki Operasyonlar
          </h3>
          
          <div className="space-y-3">
            {(!jobsByDate[selectedDate] || jobsByDate[selectedDate].length === 0) ? (
              <div className="p-6 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-neutral-500 font-medium">
                Bu tarihte kayıtlı herhangi bir operasyon bulunmuyor.
              </div>
            ) : (
              jobsByDate[selectedDate].map(job => (
                <div key={job.id} className={`p-4 bg-white border rounded-xl hover:border-red-600 transition shadow-sm flex flex-col md:flex-row gap-4 justify-between md:items-center ${job.isSpecial ? 'border-yellow-400 ring-2 ring-yellow-50 bg-yellow-50/10' : 'border-neutral-200'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-black text-base flex items-center gap-1.5">
                        {job.isSpecial && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                        {job.customerName}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                        {job.type || 'Nakliye'}
                      </span>
                      <span className="text-[10px] font-black bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {job.time}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        job.status === 'completed' ? 'bg-black text-white' :
                        job.status === 'in-progress' ? 'bg-red-600 text-white' :
                        'bg-neutral-200 text-neutral-700'
                      }`}>
                        {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 flex items-center gap-3 mb-2 font-medium flex-wrap">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${job.team === 'Atanmadı' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}><User className="w-3.5 h-3.5" /> {job.team}</span>
                      {job.assignedVehiclePlate && <span className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg border border-purple-100 text-purple-700"><Truck className="w-3.5 h-3.5" /> {job.assignedVehiclePlate}</span>}
                      <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200"><Phone className="w-3.5 h-3.5" /> {job.customerPhone}</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                      <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" /> <div><b className="text-neutral-700">{job.extraLoadingAddresses?.length > 0 ? '1. AL:' : 'AL:'}</b> {job.fromProvince}/{job.fromDistrict} - {job.fromAddress}</div></div>
                      {job.extraLoadingAddresses?.map((addr, idx) => (
                        <div key={addr.id} className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" /> <div><b className="text-neutral-700">{idx + 2}. AL:</b> {addr.province}/{addr.district} - {addr.address}</div></div>
                      ))}
                      
                      {job.toProvince && <div className="flex items-start gap-1.5 mt-1 pt-1 border-t border-neutral-200"><MapPin className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" /> <div><b className="text-neutral-700">{job.extraUnloadingAddresses?.length > 0 ? '1. VR:' : 'VR:'}</b> {job.toProvince}/{job.toDistrict} - {job.toAddress}</div></div>}
                      {job.extraUnloadingAddresses?.map((addr, idx) => (
                        <div key={addr.id} className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" /> <div><b className="text-neutral-700">{idx + 2}. VR:</b> {addr.province}/{addr.district} - {addr.address}</div></div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-2">
                      <button onClick={() => handleEditJob(job)} className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1.5">
                        <Edit className="w-3 h-3"/> Bilgileri Düzenle
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CompletedJobsView = ({ jobs, handleEditJob, setViewingImage }) => {
  const completedJobs = jobs.filter(j => j.status === 'completed').sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
        <h2 className="text-xl font-bold text-black flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-600" /> Tamamlanan İşler
        </h2>
      </div>
      <div className="space-y-4">
        {completedJobs.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 font-medium bg-neutral-50 rounded-xl border border-neutral-200">
            Kayıtlı tamamlanmış bir operasyon bulunmuyor.
          </div>
        ) : (
          completedJobs.map(job => (
            <div key={job.id} className="p-5 border border-green-200 bg-green-50/30 rounded-xl flex flex-col md:flex-row gap-4 justify-between md:items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-black text-lg">{job.customerName}</h3>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">TAMAMLANDI</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                    {job.type || 'Nakliye'}
                  </span>
                </div>
                
                {/* Temel Bilgiler */}
                <div className="text-sm text-neutral-600 flex flex-wrap items-center gap-3 mb-3">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-neutral-400" /> {job.date} - {job.time}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-neutral-400" /> {job.fromDistrict} <ArrowRightLeft className="w-3 h-3 text-neutral-300 mx-1" /> {job.toDistrict || 'Belirtilmedi'}</span>
                    {job.price && (
                      <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md text-green-700 font-bold">
                        <DollarSign className="w-3.5 h-3.5" /> ₺{parseInt(job.price).toLocaleString('tr-TR')}
                      </span>
                    )}
                </div>

                {/* Ekip ve Araç */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-2 py-1 rounded-md text-xs font-bold text-blue-700">
                      <Users className="w-3.5 h-3.5" /> {(job.teamNames && job.teamNames.length > 0) ? job.teamNames.join(', ') : job.team}
                    </span>
                    {job.assignedVehiclePlate && (
                      <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-2 py-1 rounded-md text-xs font-bold text-purple-700">
                        <Truck className="w-3.5 h-3.5" /> {job.assignedVehiclePlate}
                      </span>
                    )}
                </div>
                
                {/* İş Sonu Formu Detayları */}
                {job.endJobDetails && (
                  <div className="mt-4 text-xs font-medium bg-white p-4 rounded-xl border border-green-100 flex flex-col gap-3 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-neutral-100">
                      <p><b className="text-neutral-700 block mb-0.5">Ödeme Durumu:</b> <span className={`font-bold ${job.endJobDetails.paymentMethod === 'Ödeme Yapmadı' ? 'text-red-600' : 'text-green-700'}`}>{job.endJobDetails.paymentMethod}</span></p>
                      <p><b className="text-neutral-700 block mb-0.5">Hasar Durumu:</b> <span className={job.endJobDetails.damageStatus === 'Hasar var' ? 'text-red-600 font-bold' : ''}>{job.endJobDetails.damageStatus}</span></p>
                      <p><b className="text-neutral-700 block mb-0.5">Müşteri Memnuniyeti:</b> {job.endJobDetails.customerSatisfaction}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-neutral-700 mb-1"><b className="flex items-center gap-1"><Truck className="w-3.5 h-3.5"/> Kamyon Durumu:</b> {job.endJobDetails.truckStatus}</p>
                        {job.endJobDetails.truckIssueDetails && <p className="text-red-600 bg-red-50 p-2 rounded border border-red-100 mt-1"><b>Sorun Detayı:</b> {job.endJobDetails.truckIssueDetails}</p>}
                        {job.endJobDetails.truckImage && (
                          <button onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Kasa Görseli', name: job.endJobDetails.truckImage}); }} className="text-blue-700 flex items-center justify-between gap-2 mt-2 bg-blue-50 p-2.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition w-full text-left shadow-sm">
                            <span className="flex items-center gap-1.5 truncate"><Camera className="w-4 h-4 shrink-0" /> <b className="shrink-0">Kasa:</b> <span className="truncate">{job.endJobDetails.truckImage}</span></span>
                            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-blue-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                          </button>
                        )}
                      </div>
                      
                      {(job.endJobDetails.damageStatus === 'Hasar var' || job.endJobDetails.damageDetails || job.endJobDetails.damageImage) && (
                        <div>
                          <p className="text-red-700 mb-1"><b className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/> Hasar Raporu</b></p>
                          {job.endJobDetails.damageDetails && <p className="text-red-600 bg-red-50 p-2 rounded border border-red-100 mt-1"><b>Detay:</b> {job.endJobDetails.damageDetails}</p>}
                          {job.endJobDetails.damageImage && (
                            <button onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Hasar Görseli', name: job.endJobDetails.damageImage}); }} className="text-orange-700 flex items-center justify-between gap-2 mt-2 bg-orange-50 p-2.5 rounded-lg border border-orange-200 hover:bg-orange-100 transition w-full text-left shadow-sm">
                              <span className="flex items-center gap-1.5 truncate"><Camera className="w-4 h-4 shrink-0" /> <b className="shrink-0">Görsel:</b> <span className="truncate">{job.endJobDetails.damageImage}</span></span>
                              <span className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-orange-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => handleEditJob(job)} className="px-4 py-2.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition flex items-center justify-center gap-2 text-sm border border-blue-200 shadow-sm w-full md:w-auto">
                  <Edit className="w-4 h-4" /> Detayları Gör
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- YENİ EKLENEN PROFİL VE MESAJLAŞMA BİLEŞENİ ---
const ProfileView = ({ currentUser, jobs, notifications, markNotificationsAsRead, personnelList, messages, setMessages, handleOpenEndJobModal, setViewingImage, handleUpdatePersonnel }) => {
  const [activeProfileTab, setActiveProfileTab] = useState('jobs'); // 'jobs' | 'messages' | 'settings'
  const [activeChatUserId, setActiveChatUserId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editProfileData, setEditProfileData] = useState({ fullName: currentUser.fullName, password: currentUser.password });
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const myJobs = jobs.filter(j => j.assignedPersonnelIds?.includes(currentUser.id) || j.assignedPersonnelId === currentUser.id);
  const myNotifications = notifications.filter(n => n.userId === currentUser.id);

  // Profil sekmesi açıldığında bildirimleri okundu olarak işaretle
  React.useEffect(() => {
    markNotificationsAsRead(currentUser.id);
  }, [currentUser.id]);

  React.useEffect(() => {
    setEditProfileData({ fullName: currentUser.fullName, password: currentUser.password });
  }, [currentUser]);

  // Yeni mesaj gönderme işlemi
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatUserId) return;
    
    const msg = {
      id: Date.now(),
      senderId: currentUser.id,
      receiverId: activeChatUserId,
      text: newMessage,
      timestamp: new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      read: false
    };
    
    setMessages([...messages, msg]);
    setNewMessage('');
  };

  // Chat penceresi açıldığında gelen mesajları okundu yap
  React.useEffect(() => {
    if (activeChatUserId) {
      let changed = false;
      const updatedMessages = messages.map(m => {
        if (m.senderId === activeChatUserId && m.receiverId === currentUser.id && !m.read) {
          changed = true;
          return { ...m, read: true };
        }
        return m;
      });
      if (changed) setMessages(updatedMessages);
    }
  }, [activeChatUserId, messages, currentUser.id, setMessages]);

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    handleUpdatePersonnel({ ...currentUser, fullName: editProfileData.fullName, password: editProfileData.password });
    setUpdateSuccess(true);
    setTimeout(() => setUpdateSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* SOL: Profil Bilgileri & Bildirimler */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-black text-3xl mb-4 mx-auto border-4 border-white shadow-lg">
              {currentUser.fullName.charAt(0)}
            </div>
            <h2 className="text-xl font-black text-center text-black mb-1">{currentUser.fullName}</h2>
            <p className="text-center text-neutral-500 text-sm font-medium mb-6">{currentUser.position} - {currentUser.rank}</p>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <Phone className="w-4 h-4 text-neutral-400" /> <span className="font-bold text-neutral-700">{currentUser.personalPhone || 'Belirtilmedi'}</span>
              </div>
              <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <Mail className="w-4 h-4 text-neutral-400" /> <span className="font-bold text-neutral-700">{currentUser.email}</span>
              </div>
              <div className="flex items-center gap-3 bg-green-50 p-3 rounded-xl border border-green-100 text-green-700">
                <Shield className="w-4 h-4" /> <span className="font-bold">{currentUser.safetyTraining}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-600" /> <h3 className="font-bold text-black">Bildirimleriniz</h3>
            </div>
            <div className="divide-y divide-neutral-100 max-h-[300px] overflow-y-auto custom-scrollbar">
              {myNotifications.length === 0 ? (
                <p className="p-6 text-center text-neutral-500 text-sm">Henüz bir bildiriminiz yok.</p>
              ) : (
                myNotifications.map(notif => (
                  <div key={notif.id} className={`p-4 ${notif.read ? 'opacity-60' : 'bg-red-50/30'}`}>
                    <p className="text-xs text-neutral-400 font-bold mb-1">{notif.date}</p>
                    <p className="text-sm font-bold text-black">{notif.title}</p>
                    <p className="text-sm text-neutral-600">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SAĞ: Görevler veya Mesajlaşma (Sekmeli Yapı) */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 h-full flex flex-col">
            
            {/* Profil Sağ Sekmeleri */}
            <div className="flex gap-6 border-b border-neutral-200 mb-6">
              <button 
                onClick={() => setActiveProfileTab('jobs')} 
                className={`pb-3 font-bold transition flex items-center gap-2 ${activeProfileTab === 'jobs' ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-500 hover:text-black'}`}
              >
                <ClipboardList className="w-5 h-5" /> Bana Atanan Görevler
              </button>
              <button 
                onClick={() => setActiveProfileTab('messages')} 
                className={`pb-3 font-bold transition flex items-center gap-2 relative ${activeProfileTab === 'messages' ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-500 hover:text-black'}`}
              >
                <MessageCircle className="w-5 h-5" /> Şirket İçi Mesajlaşma
                {messages.filter(m => m.receiverId === currentUser.id && !m.read).length > 0 && (
                  <span className="absolute -top-1 -right-3 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveProfileTab('settings')} 
                className={`pb-3 font-bold transition flex items-center gap-2 ${activeProfileTab === 'settings' ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-500 hover:text-black'}`}
              >
                <Lock className="w-5 h-5" /> Hesap Ayarları
              </button>
            </div>
            
            {/* Görevlerim Sekmesi */}
            {activeProfileTab === 'jobs' && (
              <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-2">
                {myJobs.length === 0 ? (
                  <div className="p-10 text-center text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <CheckCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="font-bold">Şu anda size atanmış aktif bir operasyon bulunmuyor.</p>
                  </div>
                ) : (
                  myJobs.map(job => (
                    <div key={job.id} className={`p-5 rounded-2xl border transition group ${job.isSpecial ? 'bg-yellow-50/20 border-yellow-400 ring-2 ring-yellow-100 hover:border-yellow-500' : 'bg-neutral-50 border-neutral-200 hover:border-red-400'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-black flex items-center gap-1.5">
                            {job.isSpecial && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />}
                            {job.customerName}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                            {job.type || 'Nakliye'}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase whitespace-nowrap ${
                          job.status === 'completed' ? 'bg-black text-white' :
                          job.status === 'in-progress' ? 'bg-red-600 text-white shadow-sm' :
                          'bg-white border border-neutral-300 text-neutral-700'
                        }`}>
                          {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
                        <span className="flex items-center gap-1.5 font-bold bg-white text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-200"><CalendarDays className="w-3.5 h-3.5" /> {job.date}</span>
                        <span className="flex items-center gap-1.5 font-bold bg-white text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-200"><Clock className="w-3.5 h-3.5" /> {job.time}</span>
                        <a href={`tel:${job.customerPhone}`} className="flex items-center gap-1.5 font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition shadow-sm">
                          <Phone className="w-3.5 h-3.5" /> {job.customerPhone} (Ara)
                        </a>
                        {job.price && (
                          <span className="flex items-center gap-1.5 font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
                            <DollarSign className="w-3.5 h-3.5" /> Fiyat: ₺{parseInt(job.price).toLocaleString('tr-TR')}
                          </span>
                        )}
                        
                        {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 && (
                           <div className="flex flex-wrap gap-1.5">
                             {(job.teamNames || [job.team]).map((name, i) => (
                                <span key={i} className="flex items-center gap-1 font-bold bg-neutral-100 text-neutral-700 px-2 py-1.5 rounded-lg border border-neutral-200">
                                  <User className="w-3.5 h-3.5" /> {name}
                                </span>
                             ))}
                           </div>
                        )}
                        {job.assignedVehiclePlate && (
                          <span className="flex items-center gap-1.5 font-bold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100">
                            <Truck className="w-3.5 h-3.5" /> {job.assignedVehiclePlate}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-neutral-600 space-y-4 bg-white p-4 rounded-xl border border-neutral-200">
                        {/* 1. Yükleme Adresi */}
                        <div className="flex items-start gap-2">
                          <MapPin className="w-5 h-5 text-neutral-400 mt-0.5 shrink-0" /> 
                          <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-1">
                              <b className="text-black text-base">{job.extraLoadingAddresses?.length > 0 ? '1. Yükleme:' : 'AL:'} {job.fromProvince}/{job.fromDistrict}</b>
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.fromProvince + ' ' + job.fromDistrict + ' ' + job.fromAddress)}`} target="_blank" rel="noreferrer" className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-blue-200 transition shrink-0 w-fit">
                                <ArrowUpRight className="w-3.5 h-3.5" /> Yol Tarifi Al
                              </a>
                            </div>
                            <div className="text-neutral-700">{job.fromAddress}</div>
                            <div className="text-[10px] text-neutral-500 mt-2 flex gap-2 flex-wrap">
                               <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{job.fromRoomCount}</span>
                               <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{job.fromFloor}</span>
                               <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{job.fromTransportMethod}</span>
                               <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{job.fromPacking}</span>
                            </div>
                          </div>
                        </div>

                        {/* Ekstra Yükleme Adresleri */}
                        {job.extraLoadingAddresses?.map((addr, idx) => (
                          <div key={addr.id} className="flex items-start gap-2 pt-3 border-t border-neutral-100">
                            <MapPin className="w-5 h-5 text-neutral-400 mt-0.5 shrink-0" /> 
                            <div className="flex-1">
                              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-1">
                                <b className="text-black text-base">{idx + 2}. Yükleme: {addr.province}/{addr.district}</b>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.province + ' ' + addr.district + ' ' + addr.address)}`} target="_blank" rel="noreferrer" className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-blue-200 transition shrink-0 w-fit">
                                  <ArrowUpRight className="w-3.5 h-3.5" /> Yol Tarifi Al
                                </a>
                              </div>
                              <div className="text-neutral-700">{addr.address}</div>
                              <div className="text-[10px] text-neutral-500 mt-2 flex gap-2 flex-wrap">
                                 <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{addr.roomCount}</span>
                                 <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{addr.floor}</span>
                                 <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{addr.transportMethod}</span>
                                 <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-black font-bold">{addr.packing}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Boşaltma Adresleri */}
                        {job.toProvince && (
                          <>
                            <div className="w-full h-0.5 bg-neutral-200 my-2"></div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" /> 
                              <div className="flex-1">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-1">
                                  <b className="text-red-800 text-base">{job.extraUnloadingAddresses?.length > 0 ? '1. Boşaltma:' : 'VR:'} {job.toProvince}/{job.toDistrict}</b>
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.toProvince + ' ' + job.toDistrict + ' ' + job.toAddress)}`} target="_blank" rel="noreferrer" className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-red-200 transition shrink-0 w-fit">
                                    <ArrowUpRight className="w-3.5 h-3.5" /> Yol Tarifi Al
                                  </a>
                                </div>
                                <div className="text-neutral-700">{job.toAddress}</div>
                                <div className="text-[10px] text-neutral-500 mt-2 flex gap-2 flex-wrap">
                                   <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{job.toRoomCount}</span>
                                   <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{job.toFloor}</span>
                                   <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{job.toTransportMethod}</span>
                                   <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{job.toPacking}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Ekstra Boşaltma Adresleri */}
                            {job.extraUnloadingAddresses?.map((addr, idx) => (
                              <div key={addr.id} className="flex items-start gap-2 pt-3 border-t border-neutral-100">
                                <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" /> 
                                <div className="flex-1">
                                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-1">
                                    <b className="text-red-800 text-base">{idx + 2}. Boşaltma: {addr.province}/{addr.district}</b>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.province + ' ' + addr.district + ' ' + addr.address)}`} target="_blank" rel="noreferrer" className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-red-200 transition shrink-0 w-fit">
                                      <ArrowUpRight className="w-3.5 h-3.5" /> Yol Tarifi Al
                                    </a>
                                  </div>
                                  <div className="text-neutral-700">{addr.address}</div>
                                  <div className="text-[10px] text-neutral-500 mt-2 flex gap-2 flex-wrap">
                                     <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{addr.roomCount}</span>
                                     <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{addr.floor}</span>
                                     <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{addr.transportMethod}</span>
                                     <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-700 font-bold">{addr.packing}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      {job.notes && (
                        <div className="mt-4 text-xs font-medium bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 flex items-start gap-2">
                          <FileText className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" /> {job.notes}
                        </div>
                      )}

                      {/* Tahmini Malzeme Bölümü */}
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

                      {/* İş Sonu Formu Gösterimi */}
                      {job.endJobDetails && (
                        <div className="mt-4 text-xs font-medium bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex flex-col gap-3">
                           <div className="flex items-center gap-2 border-b border-green-200/50 pb-2">
                             <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
                             <b className="text-green-900 text-sm">İş Tarafınızca Sonlandırıldı</b>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                             <p><b>Ödeme:</b> {job.endJobDetails.paymentMethod}</p>
                             <p><b>Müşteri Memnuniyeti:</b> {job.endJobDetails.customerSatisfaction}</p>
                             <p><b>Eşya Hasarı:</b> {job.endJobDetails.damageStatus}</p>
                             <p><b>Kamyon Durumu:</b> {job.endJobDetails.truckStatus}</p>
                             {job.endJobDetails.truckImage && (
                               <button type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Kasa Fotoğrafı', name: job.endJobDetails.truckImage}); }} className="md:col-span-2 text-left text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 hover:bg-green-100 transition flex justify-between items-center shadow-sm">
                                 <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Kasa Fotoğrafı:</b> {job.endJobDetails.truckImage}</span>
                                 <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-green-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                               </button>
                             )}
                             {job.endJobDetails.damageImage && (
                               <button type="button" onClick={(e) => { e.stopPropagation(); setViewingImage({title: 'Hasar Fotoğrafı', name: job.endJobDetails.damageImage}); }} className="md:col-span-2 text-left text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition flex justify-between items-center shadow-sm">
                                 <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 shrink-0"/> <b>Hasar Fotoğrafı:</b> {job.endJobDetails.damageImage}</span>
                                 <span className="text-[10px] bg-white px-2 py-1 rounded font-bold border border-red-200 flex items-center gap-1 shrink-0">Aç <ArrowUpRight className="w-3 h-3"/></span>
                               </button>
                             )}
                             {job.endJobDetails.damageDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Hasar Detayı:</b> {job.endJobDetails.damageDetails}</p>}
                             {job.endJobDetails.truckIssueDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Kamyon Sorunu:</b> {job.endJobDetails.truckIssueDetails}</p>}
                           </div>
                        </div>
                      )}

                      {/* İŞLEM BUTONLARI (WHATSAPP, SMS VE SONLANDIRMA) */}
                      {job.status !== 'completed' && (
                        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col xl:flex-row justify-between gap-3">
                          
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                               onClick={() => {
                                 let phone = job.customerPhone.replace(/\D/g, '');
                                 if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                 else if (!phone.startsWith('90')) phone = '90' + phone;
                                 const msg = `Merhaba ${job.customerName},\n\nSembol Nakliyat ekibi olarak operasyonunuz için yola çıkmış bulunmaktayız. 🚚\n\n📍 *Önemli Not:* Açık adresinize doğru hareket ettik, ancak adresi daha kolay ve hızlı bulabilmemiz için bize bu sohbet üzerinden *konum gönderirseniz* çok seviniriz.\n\nAnlayışınız için teşekkür ederiz, görüşmek üzere!`;
                                 window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                               }}
                               className="flex-1 sm:flex-none px-4 py-2 bg-[#25D366] text-white text-xs font-bold rounded-xl hover:bg-[#128C7E] transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                            >
                              <MessageCircle className="w-4 h-4 shrink-0" /> WhatsApp'tan İste
                            </button>

                            <button
                               onClick={() => {
                                 let phone = job.customerPhone.replace(/\D/g, '');
                                 const msg = `Merhaba ${job.customerName},\n\nSembol Nakliyat ekibi olarak operasyonunuz için yola çıkmış bulunmaktayız.\n\nAçık adresinize doğru hareket ettik, ancak adresi daha kolay bulabilmemiz için bize konum gönderirseniz çok seviniriz. Görüşmek üzere!`;
                                 const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                                 const separator = isIOS ? '&' : '?';
                                 window.open(`sms:${phone}${separator}body=${encodeURIComponent(msg)}`, '_self');
                               }}
                               className="flex-1 sm:flex-none px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                              <MessageSquareText className="w-4 h-4 shrink-0" /> SMS'ten İste
                            </button>
                          </div>

                          <div className="w-full xl:w-auto flex justify-end">
                            {['Ekip Şefi', 'Kalfa'].includes(currentUser.rank) ? (
                              <button
                                onClick={() => handleOpenEndJobModal(job)}
                                className="w-full xl:w-auto px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition flex items-center justify-center gap-2 shadow-lg"
                              >
                                <CheckCircle className="w-4 h-4 shrink-0" /> İşi Sonlandır
                              </button>
                            ) : (
                              <p className="text-xs text-red-500 font-bold flex items-center gap-1.5 w-full justify-center bg-red-50 p-2 rounded-lg border border-red-100">
                                <AlertTriangle className="w-4 h-4 shrink-0"/> Sadece Şef / Kalfa sonlandırabilir.
                              </p>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Mesajlaşma Sekmesi */}
            {activeProfileTab === 'messages' && (
              <div className="flex flex-1 h-[450px] border border-neutral-200 rounded-xl overflow-hidden animate-in fade-in">
                {/* Personel Listesi (Sol Kenar Çubuğu) */}
                <div className="w-1/3 bg-neutral-50 border-r border-neutral-200 flex flex-col">
                  {/* Arama Çubuğu */}
                  <div className="p-3 border-b border-neutral-200 shrink-0">
                    <div className="relative">
                       <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                       <input
                         type="text"
                         placeholder="Kişi veya pozisyon ara..."
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition"
                       />
                    </div>
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {personnelList
                      .filter(p => p.id !== currentUser.id)
                      .filter(p => p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || p.position.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(user => {
                      const unreadCount = messages.filter(m => m.senderId === user.id && m.receiverId === currentUser.id && !m.read).length;
                      return (
                        <button 
                          key={user.id} 
                          onClick={() => setActiveChatUserId(user.id)} 
                          className={`w-full text-left p-4 hover:bg-neutral-100 transition border-b border-neutral-200 flex items-center justify-between ${activeChatUserId === user.id ? 'bg-red-50/50 border-l-4 border-l-red-600' : 'border-l-4 border-l-transparent'}`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-neutral-600">
                              {user.fullName.charAt(0)}
                            </div>
                            <div className="truncate">
                              <p className="font-bold text-black text-sm truncate">{user.fullName}</p>
                              <p className="text-xs text-neutral-500 truncate">{user.position}</p>
                            </div>
                          </div>
                          {unreadCount > 0 && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">{unreadCount}</span>}
                        </button>
                      )
                    })}
                  
                  {personnelList.filter(p => p.id !== currentUser.id && (p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || p.position.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                    <div className="p-6 text-center text-xs text-neutral-500 font-medium">Aramanızla eşleşen kişi bulunamadı.</div>
                  )}
                  </div>
                </div>

                {/* Mesajlaşma Alanı (Sağ Taraf) */}
                <div className="w-2/3 flex flex-col bg-white">
                  {activeChatUserId ? (
                    <>
                      {/* Sohbet Üst Bilgi */}
                      <div className="p-4 border-b border-neutral-200 flex items-center gap-3 bg-white">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">
                          {personnelList.find(p => p.id === activeChatUserId)?.fullName.charAt(0)}
                        </div>
                        <div>
                           <h3 className="font-bold text-black text-sm">{personnelList.find(p => p.id === activeChatUserId)?.fullName}</h3>
                           <p className="text-[10px] text-neutral-500">Sistem İçi Sohbet</p>
                        </div>
                      </div>
                      
                      {/* Mesaj Listesi */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-neutral-50/50 custom-scrollbar flex flex-col">
                        {messages.filter(m => (m.senderId === currentUser.id && m.receiverId === activeChatUserId) || (m.senderId === activeChatUserId && m.receiverId === currentUser.id)).length === 0 ? (
                           <div className="m-auto text-center text-neutral-400 text-sm">Mesajlaşma geçmişiniz yok. Merhaba deyin! 👋</div>
                        ) : (
                           messages.filter(m => (m.senderId === currentUser.id && m.receiverId === activeChatUserId) || (m.senderId === activeChatUserId && m.receiverId === currentUser.id)).map(m => (
                             <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                               <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${m.senderId === currentUser.id ? 'bg-red-600 text-white rounded-br-none' : 'bg-white border border-neutral-200 text-black rounded-bl-none'}`}>
                                 <p className="break-words">{m.text}</p>
                                 <div className={`text-[10px] text-right mt-1.5 flex items-center justify-end gap-1 ${m.senderId === currentUser.id ? 'text-red-200' : 'text-neutral-400'}`}>
                                    {m.timestamp}
                                    {m.senderId === currentUser.id && (m.read ? <CheckCircle className="w-3 h-3 text-red-200"/> : <Clock className="w-3 h-3"/>)}
                                 </div>
                               </div>
                             </div>
                           ))
                        )}
                      </div>

                      {/* Mesaj Gönderme Çubuğu */}
                      <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-200 bg-white flex gap-2 items-end">
                        <textarea 
                          required 
                          value={newMessage} 
                          onChange={e => setNewMessage(e.target.value)} 
                          onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                          placeholder="Mesajınızı buraya yazın..." 
                          className="flex-1 p-3 bg-neutral-100 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-sm resize-none h-12 max-h-24 custom-scrollbar" 
                        />
                        <button type="submit" className="bg-red-600 text-white p-3 rounded-xl hover:bg-red-700 transition shadow-md shrink-0 h-12 w-12 flex items-center justify-center">
                          <Send className="w-5 h-5"/>
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
                         <MessageCircle className="w-8 h-8 text-neutral-300" />
                      </div>
                      <p className="text-sm font-bold text-neutral-500">Personel İçi Mesajlaşma</p>
                      <p className="text-xs mt-1">Sohbet başlatmak için sol taraftan bir kişi seçin.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hesap Ayarları Sekmesi */}
            {activeProfileTab === 'settings' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-neutral-50 border border-neutral-200 rounded-xl animate-in fade-in">
                <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
                  <Lock className="w-5 h-5 text-red-600" /> Profil ve Şifre Güncelleme
                </h3>
                {updateSuccess && (
                  <div className="bg-green-100 text-green-700 p-4 rounded-xl text-sm font-bold flex items-center gap-2 mb-6 border border-green-200">
                    <CheckCircle className="w-5 h-5" /> Bilgileriniz başarıyla güncellendi.
                  </div>
                )}
                <form onSubmit={handleProfileUpdate} className="space-y-5 max-w-md bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-2">Kullanıcı Adı (Ad Soyad)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"><User className="w-5 h-5" /></span>
                      <input type="text" value={editProfileData.fullName} onChange={e => setEditProfileData({...editProfileData, fullName: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-black" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-2">Sistem Şifresi</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"><Lock className="w-5 h-5" /></span>
                      <input type="text" value={editProfileData.password} onChange={e => setEditProfileData({...editProfileData, password: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-black" required />
                    </div>
                    <p className="text-xs text-neutral-500 mt-2 font-medium">Sisteme giriş yaparken kullandığınız şifredir. Şifrenizi kimseyle paylaşmayınız.</p>
                  </div>
                  <button type="submit" className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 flex justify-center items-center gap-2">
                    <Save className="w-5 h-5" /> Değişiklikleri Kaydet
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const FinanceDashboardView = ({ jobs }) => {
  const [selectedType, setSelectedType] = useState('Tümü');
  const [selectedPeriod, setSelectedPeriod] = useState('Aylık');
  const [selectedStatus, setSelectedStatus] = useState('Tümü');

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayStr = today.toISOString().split('T')[0];

  // Filtreleme (Dönem + Tür) - Tüm kartlar ve liste için ortak temel
  const baseFilteredJobs = jobs.filter(job => {
    if (job.status === 'cancelled') return false;
    if (!job.price) return false;
    if (selectedType !== 'Tümü' && job.type !== selectedType) return false;

    const jobDate = new Date(job.date);
    const jYear = jobDate.getFullYear();
    const jMonth = jobDate.getMonth() + 1;

    if (selectedPeriod === 'Günlük' && job.date !== todayStr) return false;
    if (selectedPeriod === 'Aylık' && (jYear !== currentYear || jMonth !== currentMonth)) return false;
    if (selectedPeriod === 'Yıllık' && jYear !== currentYear) return false;

    return true;
  });

  // Kart Hesaplamaları (Sadece Dönem ve Türe Göre Genel Özet)
  const totalVolume = baseFilteredJobs.reduce((acc, job) => acc + (Number(job.price) || 0), 0);
  const completedVolume = baseFilteredJobs.filter(j => j.status === 'completed').reduce((acc, job) => acc + (Number(job.price) || 0), 0);
  const pendingVolume = baseFilteredJobs.filter(j => j.status !== 'completed').reduce((acc, job) => acc + (Number(job.price) || 0), 0);

  // Alttaki Liste İçin Filtreleme (Durum filtresi de dahil)
  const recentJobs = baseFilteredJobs.filter(job => {
    if (selectedStatus === 'Tamamlanan' && job.status !== 'completed') return false;
    if (selectedStatus === 'Bekleyen' && job.status === 'completed') return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const listTotal = recentJobs.reduce((acc, job) => acc + (Number(job.price) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
        <h2 className="text-2xl font-bold text-black flex items-center gap-2">
          <Wallet className="w-7 h-7 text-red-600" /> Kasa Özeti
        </h2>
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm w-full md:w-auto">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-red-600"
          >
            <option value="Tümü">Tüm Zamanlar</option>
            <option value="Günlük">Bugün (Günlük)</option>
            <option value="Aylık">Bu Ay (Aylık)</option>
            <option value="Yıllık">Bu Yıl (Yıllık)</option>
          </select>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold bg-red-50 text-red-700 border border-red-200 rounded-xl outline-none focus:ring-2 focus:ring-red-600"
          >
            <option value="Tümü">Tüm Hizmetler</option>
            <option value="Nakliye">Sadece Nakliye</option>
            <option value="Depo">Sadece Depo</option>
            <option value="Asansör">Sadece Asansör</option>
          </select>
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="Tümü">Tüm Durumlar</option>
            <option value="Tamamlanan">Tamamlanan İşler</option>
            <option value="Bekleyen">Bekleyen/Süren İşler</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4 hover:border-blue-600 transition group cursor-pointer">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition"><ClipboardList className="w-6 h-6" /></div>
          <div>
            <p className="text-neutral-500 text-sm font-bold mb-0.5">Toplam Açılan İş Hacmi</p>
            <p className="text-xl font-black text-black">₺{totalVolume.toLocaleString('tr-TR')}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4 hover:border-green-600 transition group cursor-pointer">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition"><CheckCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-neutral-500 text-sm font-bold mb-0.5">Tamamlanan İş Geliri</p>
            <p className="text-xl font-black text-green-600">₺{completedVolume.toLocaleString('tr-TR')}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4 hover:border-red-600 transition group cursor-pointer">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition"><Clock className="w-6 h-6" /></div>
          <div>
            <p className="text-neutral-500 text-sm font-bold mb-0.5">Bekleyen İş Hacmi</p>
            <p className="text-xl font-black text-red-600">₺{pendingVolume.toLocaleString('tr-TR')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-black flex items-center gap-2">
            İşlem Hareketleri
            <span className="text-xs font-bold text-neutral-500 bg-neutral-200 px-2 py-0.5 rounded-full">{recentJobs.length} İşlem</span>
          </h3>
          <div className="bg-black text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-md">
            Görüntülenen Toplam: <span className="text-green-400">₺{listTotal.toLocaleString('tr-TR')}</span>
          </div>
        </div>
        <div className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto custom-scrollbar">
          {recentJobs.map(job => (
            <div key={job.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl shadow-sm ${job.type === 'Depo' ? 'bg-blue-100 text-blue-600' : job.type === 'Asansör' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  <ArrowDownRight className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-black text-base">{job.customerName}</p>
                  <p className="text-xs font-medium text-neutral-500 mt-0.5">{job.type} • {job.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-black ${job.status === 'completed' ? 'text-green-600' : 'text-neutral-500'}`}>
                  +₺{parseInt(job.price || 0).toLocaleString('tr-TR')}
                </p>
                <p className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-1 ${job.status === 'completed' ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                  {job.status === 'completed' ? 'TAMAMLANDI' : 'BEKLİYOR/DEVAM'}
                </p>
              </div>
            </div>
          ))}
          {recentJobs.length === 0 && (
            <div className="p-8 text-center text-neutral-500 font-medium">Bu filtrelere uygun fiyatı girilmiş bir işlem bulunmuyor.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReportingView = ({ jobs }) => {
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
      reportData[creator] = { count: 0, revenue: 0, nakliyeCount: 0, nakliyeRevenue: 0, depoCount: 0, depoRevenue: 0, asansorCount: 0, asansorRevenue: 0 };
    }
    const price = Number(job.price) || 0;
    reportData[creator].count += 1;
    reportData[creator].revenue += price;
    
    if (job.type === 'Nakliye') { reportData[creator].nakliyeCount += 1; reportData[creator].nakliyeRevenue += price; }
    else if (job.type === 'Depo') { reportData[creator].depoCount += 1; reportData[creator].depoRevenue += price; }
    else if (job.type === 'Asansör') { reportData[creator].asansorCount += 1; reportData[creator].asansorRevenue += price; }
  });

  const summaryList = Object.keys(reportData)
    .map(k => ({ name: k, ...reportData[k] }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalJobs = filteredJobs.length;
  const totalNakliye = filteredJobs.filter(j => j.type === 'Nakliye').length;
  const totalDepo = filteredJobs.filter(j => j.type === 'Depo').length;
  const totalAsansor = filteredJobs.filter(j => j.type === 'Asansör').length;
  const totalRevenue = summaryList.reduce((acc, curr) => acc + curr.revenue, 0);

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
                <th className="p-4 font-bold text-right">İş Başı Ortalama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {summaryList.map((item, index) => (
                <tr key={index} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black flex items-center gap-2 mt-3">
                    <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs text-neutral-600">{item.name.charAt(0)}</div>
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
                    ₺{item.count > 0 ? Math.round(item.revenue / item.count).toLocaleString('tr-TR') : 0}
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

const AddTaskFormView = ({ newTask, setNewTask, handleAddTask, personnelList }) => (
  <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
    <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
      <CheckSquare className="w-6 h-6 text-red-600" /> Yeni Görev Ekle
    </h2>
    <form onSubmit={handleAddTask} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-black mb-1">Görev Başlığı</label>
        <input required type="text" value={newTask?.title || ''} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" placeholder="Örn: Müşteri aramaları yapılacak" />
      </div>
      
      <div>
        <label className="block text-sm font-bold text-black mb-1">Detaylar</label>
        <textarea required value={newTask?.description || ''} onChange={(e) => setNewTask({...newTask, description: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none h-24 resize-none transition" placeholder="Görev açıklaması..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">Görevli</label>
          <select value={newTask?.assignee || ''} onChange={(e) => setNewTask({...newTask, assignee: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition">
            {personnelList.map(person => <option key={person.id} value={person.fullName}>{person.fullName}</option>)}
            <option value="Muhasebe">Muhasebe Departmanı</option>
            <option value="Yönetim">Yönetim Kurulu</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-black mb-1">Tarih</label>
          <input required type="date" value={newTask?.date || ''} onChange={(e) => setNewTask({...newTask, date: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" />
        </div>
      </div>

      <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
        <PlusCircle className="w-5 h-5" /> Görevi Ekle
      </button>
    </form>
  </div>
);

const TaskManagerView = ({ tasks, setTasks, setShowTaskModal, draggingTask, setDraggingTask, openEditTask, onUpdateTaskStatus, onDeleteTask }) => {
  const columns = [
    { id: 'todo', title: 'YAPILACAKLAR', color: 'bg-neutral-800' },
    { id: 'in-progress', title: 'DEVAM EDENLER', color: 'bg-red-600' },
    { id: 'completed', title: 'TAMAMLANANLAR', color: 'bg-black' }
  ];

  const handleDragStart = (e, taskId) => {
    setDraggingTask(taskId);
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    if (draggingTask) {
      if (onUpdateTaskStatus) {
        onUpdateTaskStatus(draggingTask, status);
      } else if (setTasks) {
        setTasks(tasks.map(t => t.id === draggingTask ? { ...t, status } : t));
      }
      setDraggingTask(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const deleteTask = (taskId) => {
    if (window.confirm('Görevi silmek istediğinize emin misiniz?')) {
      if (onDeleteTask) {
        onDeleteTask(taskId);
      } else if (setTasks) {
        setTasks(tasks.filter(t => t.id !== taskId));
      }
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
        {columns.map(column => (
          <div 
            key={column.id}
            className="bg-neutral-100 rounded-2xl w-80 flex-shrink-0 flex flex-col max-h-full border border-neutral-200"
            onDrop={(e) => handleDrop(e, column.id)}
            onDragOver={handleDragOver}
          >
            <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
              <h3 className="font-bold text-black text-sm flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                {column.title}
              </h3>
              <span className="bg-neutral-200 text-neutral-600 text-xs font-bold px-2 py-1 rounded-lg">
                {tasks.filter(t => t.status === column.id).length}
              </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
              {tasks.filter(t => t.status === column.id).map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-grab active:cursor-grabbing hover:border-red-600 transition group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      task.status === 'todo' ? 'bg-neutral-100 text-neutral-600' :
                      task.status === 'in-progress' ? 'bg-red-50 text-red-600' :
                      'bg-neutral-800 text-white'
                    }`}>
                      {task.date}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditTask(task)} className="text-neutral-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-black mb-1">{task.title}</h4>
                  <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{task.description}</p>
                  
                  <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200">
                      <Users className="w-3.5 h-3.5 text-red-600" />
                      {task.assignee}
                    </div>
                    <GripVertical className="w-4 h-4 text-neutral-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AddPersonnelView = ({ onAdd, positions = [], ranks = [] }) => {
  const [formData, setFormData] = useState({ fullName: '', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: '', rank: '', safetyTraining: 'Eğitim Aldı (Geçerli)', email: '', password: '' });
  
  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ id: Date.now(), ...formData });
    setFormData({ fullName: '', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: '', rank: '', safetyTraining: 'Eğitim Aldı (Geçerli)', email: '', password: '' });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <UserPlus className="w-7 h-7 text-red-600" /> Personel Ekle
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Ad Soyad *</label>
            <input required type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">TC Kimlik No</label>
            <input type="text" name="tcNo" value={formData.tcNo} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Kişisel Telefon</label>
            <input type="tel" name="personalPhone" value={formData.personalPhone} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Şirket Telefonu</label>
            <input type="tel" name="companyPhone" value={formData.companyPhone} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Pozisyon *</label>
            <select required name="position" value={formData.position} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
              <option value="">Seçiniz</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Rütbe *</label>
            <select required name="rank" value={formData.rank} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
              <option value="">Seçiniz</option>
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">İş Güvenliği Durumu</label>
            <select required name="safetyTraining" value={formData.safetyTraining} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
              <option value="Eğitim Aldı (Geçerli)">Eğitim Aldı (Geçerli)</option>
              <option value="Eğitim Süresi Doldu">Eğitim Süresi Doldu</option>
              <option value="Eğitim Almadı (Riskli)">Eğitim Almadı (Riskli)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">E-Posta (Sisteme Giriş İçin) *</label>
            <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Şifre (Sisteme Giriş İçin) *</label>
            <input required type="text" name="password" value={formData.password} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
          </div>
        </div>
        <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30">
          Personeli Kaydet
        </button>
      </form>
    </div>
  );
};

const PersonnelListView = ({ personnelList, onUpdate, positions = [], ranks = [], title = "Tüm Personel" }) => {
  const [editingPerson, setEditingPerson] = useState(null);
  const [editForm, setEditForm] = useState({});

  const openEdit = (person) => {
    setEditingPerson(person);
    setEditForm(person);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    onUpdate(editForm);
    setEditingPerson(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Briefcase className="w-6 h-6 text-red-600" /> {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-black text-white border-b border-neutral-200">
            <tr>
              <th className="p-4 font-bold rounded-tl-xl">Ad Soyad</th>
              <th className="p-4 font-bold">İletişim</th>
              <th className="p-4 font-bold">Pozisyon / Rütbe</th>
              <th className="p-4 font-bold">İş Güvenliği</th>
              <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {personnelList.map(person => (
              <tr key={person.id} className="hover:bg-neutral-50 transition">
                <td className="p-4 font-bold text-black">{person.fullName}</td>
                <td className="p-4 text-neutral-600">
                   {person.personalPhone}
                   {person.companyPhone && <><br/><span className="text-xs text-neutral-400">Şirket: {person.companyPhone}</span></>}
                </td>
                <td className="p-4 text-neutral-600">
                  <span className="font-bold">{person.position}</span><br/>
                  <span className="text-xs text-neutral-500">{person.rank}</span>
                </td>
                <td className="p-4">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase whitespace-nowrap ${
                    person.safetyTraining?.includes('Geçerli') ? 'bg-green-100 text-green-700' :
                    person.safetyTraining?.includes('Doldu') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {person.safetyTraining}
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={() => openEdit(person)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Personeli Düzenle">
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {personnelList.length === 0 && (
              <tr>
                <td colSpan="5" className="p-6 text-center text-neutral-500">Kayıtlı personel bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingPerson && (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
              <Edit className="w-5 h-5 text-red-600" /> Personel Bilgilerini Düzenle
            </h3>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-neutral-700">Ad Soyad</label>
                <input required className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" value={editForm.fullName || ''} onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-neutral-700">Pozisyonu</label>
                <select required className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 bg-white" value={editForm.position || ''} onChange={(e) => setEditForm({...editForm, position: e.target.value})}>
                  <option value="">Seçiniz</option>
                  {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-neutral-700">Rütbesi</label>
                <select required className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 bg-white" value={editForm.rank || ''} onChange={(e) => setEditForm({...editForm, rank: e.target.value})}>
                  <option value="">Seçiniz</option>
                  {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-3 mt-6 pt-2">
                <button type="button" onClick={() => setEditingPerson(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition">İptal</button>
                <button type="submit" className="flex-1 p-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-600/30">Değişiklikleri Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const UserListView = ({ personnelList, onUpdate, onDelete, positions = [] }) => {
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deletingUserId, setDeletingUserId] = useState(null);

  const openEdit = (user) => { setEditingUser(user); setEditForm(user); };
  const saveEdit = (e) => { e.preventDefault(); onUpdate(editForm); setEditingUser(null); };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 border-b pb-4 flex items-center gap-2">
        <Users className="w-6 h-6 text-red-600" /> Sistem Kullanıcıları ve Şifreler
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-black text-white rounded-t-xl">
            <tr>
              <th className="p-4 font-bold rounded-tl-xl">Personel</th>
              <th className="p-4 font-bold">Sistem E-Postası</th>
              <th className="p-4 font-bold">Şifresi</th>
              <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {personnelList.map(p => (
              <tr key={p.id} className="hover:bg-neutral-50 transition">
                <td className="p-4 font-bold text-black">
                  {p.fullName}
                  <span className="block text-xs text-neutral-500 font-medium mt-0.5">{p.position} - {p.rank}</span>
                </td>
                <td className="p-4 text-neutral-600 font-medium">{p.email || <span className="text-red-500 text-[10px] px-2 py-0.5 rounded border border-red-200 bg-red-50">E-Posta Yok</span>}</td>
                <td className="p-4 text-neutral-600">
                  <span className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 text-xs font-mono tracking-widest">{p.password || '-'}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Giriş Bilgilerini Düzenle"><Edit className="w-4 h-4"/></button>
                    <button onClick={() => setDeletingUserId(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Sistemden Kaldır"><Ban className="w-4 h-4"/></button>
                  </div>
                </td>
              </tr>
            ))}
            {personnelList.length === 0 && (
              <tr>
                <td colSpan="4" className="p-6 text-center text-neutral-500">Sistemde yetkili personel bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
         <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md animate-in zoom-in-95">
               <h3 className="font-bold text-lg mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">Giriş Bilgilerini Düzenle</h3>
               <form onSubmit={saveEdit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-neutral-700">E-Posta</label>
                    <input className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="E-Posta" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-neutral-700">Şifre</label>
                    <input className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600" value={editForm.password || ''} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Şifre" />
                  </div>
                  <div className="flex gap-3 mt-6 pt-2">
                     <button type="button" onClick={() => setEditingUser(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">İptal</button>
                     <button type="submit" className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition">Kaydet</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {deletingUserId !== null && (
         <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95">
               <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
               <h3 className="font-black text-xl text-black mb-2">Kullanıcıyı Kaldır</h3>
               <p className="text-neutral-600 mb-6 text-sm font-medium">Bu personelin sisteme erişimini ve panel hesabını kalıcı olarak silmek istediğinize emin misiniz?</p>
               <div className="flex gap-3">
                 <button onClick={() => setDeletingUserId(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                 <button onClick={() => { onDelete(deletingUserId); setDeletingUserId(null); }} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30">Evet, Kaldır</button>
               </div>
            </div>
         </div>
      )}
    </div>
  )
};

const PositionsView = ({ positions, onAddPosition, onDeletePosition }) => {
  const [newPos, setNewPos] = useState('');
  const submitPos = (e) => { 
    e.preventDefault(); 
    if (newPos.trim() && !positions.includes(newPos.trim())) { 
      onAddPosition(newPos.trim()); 
      setNewPos(''); 
    } 
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Briefcase className="w-6 h-6 text-red-600" /> Pozisyon Yönetimi
      </h2>
      <form onSubmit={submitPos} className="flex gap-3 mb-6">
         <input value={newPos} onChange={e => setNewPos(e.target.value)} placeholder="Yeni Pozisyon Ekle" className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
         <button type="submit" className="bg-black text-white px-6 py-3 font-bold rounded-xl hover:bg-neutral-800 transition flex items-center gap-2"><PlusCircle className="w-5 h-5"/> Ekle</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {positions.map(p => (
          <span key={p} className="bg-neutral-100 border border-neutral-200 text-neutral-700 px-4 py-2 rounded-xl flex items-center gap-3 text-sm font-bold">
            {p} <button onClick={() => onDeletePosition(p)} className="text-neutral-400 hover:text-red-600 transition"><X className="w-4 h-4" /></button>
          </span>
        ))}
      </div>
    </div>
  );
};

const RanksView = ({ ranks, onAddRank, onDeleteRank }) => {
  const [newRank, setNewRank] = useState('');
  const submitRank = (e) => { 
    e.preventDefault(); 
    if (newRank.trim() && !ranks.includes(newRank.trim())) { 
      onAddRank(newRank.trim()); 
      setNewRank(''); 
    } 
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Star className="w-6 h-6 text-red-600" /> Rütbe Yönetimi
      </h2>
      <form onSubmit={submitRank} className="flex gap-3 mb-6">
         <input value={newRank} onChange={e => setNewRank(e.target.value)} placeholder="Yeni Rütbe Ekle" className="flex-1 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
         <button type="submit" className="bg-black text-white px-6 py-3 font-bold rounded-xl hover:bg-neutral-800 transition flex items-center gap-2"><PlusCircle className="w-5 h-5"/> Ekle</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {ranks.map(r => (
          <span key={r} className="bg-neutral-100 border border-neutral-200 text-neutral-700 px-4 py-2 rounded-xl flex items-center gap-3 text-sm font-bold">
            {r} <button onClick={() => onDeleteRank(r)} className="text-neutral-400 hover:text-red-600 transition"><X className="w-4 h-4" /></button>
          </span>
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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-black text-white rounded-t-xl">
          <tr>
            <th className="p-4 font-bold rounded-tl-xl">Personel</th>
            <th className="p-4 font-bold text-center">Görüntüleme Yetkisi</th>
            <th className="p-4 font-bold text-center rounded-tr-xl">İşlem Yapma Yetkisi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {personnelList.map(p => (
            <tr key={p.id} className="hover:bg-neutral-50 transition">
              <td className="p-4 font-bold text-black">{p.fullName}</td>
              <td className="p-4 text-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={p.permissions?.canView || false} onChange={(e) => handleUpdatePermissions(p.id, 'canView', e.target.checked)} />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </td>
              <td className="p-4 text-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={p.permissions?.canEdit || false} onChange={(e) => handleUpdatePermissions(p.id, 'canEdit', e.target.checked)} />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </td>
            </tr>
          ))}
          {personnelList.length === 0 && (
            <tr>
              <td colSpan="3" className="p-6 text-center text-neutral-500">Sistemde yetkili personel bulunamadı.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const AddVehicleView = ({ onAdd }) => {
  const [formData, setFormData] = useState({
    plate: '',
    type: 'Kamyon',
    capacity: [],
    volume: '',
    km: '',
    model: '',
    color: 'Beyaz',
    transmission: 'Manuel'
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleCapacityChange = (cap) => {
    setFormData(prev => ({
      ...prev,
      capacity: prev.capacity.includes(cap)
        ? prev.capacity.filter(c => c !== cap)
        : [...prev.capacity, cap]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.capacity.length === 0) {
      setError('Lütfen en az bir eşya alma kapasitesi seçin.');
      return;
    }
    setError('');
    onAdd(formData);
    setFormData({ plate: '', type: 'Kamyon', capacity: [], volume: '', km: '', model: '', color: 'Beyaz', transmission: 'Manuel' });
  };

  const capacities = ['1+0', '1+1', '2+1', '3+1', '4+1'];

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Car className="w-7 h-7 text-red-600" /> Yeni Araç Ekle
      </h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 mb-6">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Plakası *</label>
            <input required type="text" name="plate" value={formData.plate} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition uppercase" placeholder="Örn: 34 SBL 01" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Cinsi *</label>
            <select required name="type" value={formData.type} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Kamyon">Kamyon</option>
              <option value="Kamyonet">Kamyonet</option>
              <option value="Panelvan">Panelvan</option>
              <option value="Minivan">Minivan</option>
            </select>
          </div>
        </div>

        <div className="bg-neutral-50 p-5 rounded-xl border border-neutral-200">
          <label className="block text-sm font-bold text-black mb-3 flex items-center gap-2">
             <Truck className="w-5 h-5 text-red-600" /> Araç Eşya Alma Kapasitesi (Çoklu Seçim) *
          </label>
          <div className="flex flex-wrap gap-3">
            {capacities.map(cap => (
              <label key={cap} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer border transition-all ${formData.capacity.includes(cap) ? 'bg-red-600 border-red-600 text-white font-bold shadow-md shadow-red-600/30' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100'}`}>
                <input type="checkbox" className="hidden" checked={formData.capacity.includes(cap)} onChange={() => handleCapacityChange(cap)} />
                {cap} Evi Alır
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Hacmi (m³) *</label>
            <input required type="number" name="volume" value={formData.volume} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 45" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç KM *</label>
            <input required type="number" name="km" value={formData.km} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 150000" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Modeli (Yıl) *</label>
            <input required type="number" name="model" value={formData.model} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 2018" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Rengi *</label>
            <select required name="color" value={formData.color} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Beyaz">Beyaz</option>
              <option value="Gri">Gri</option>
              <option value="Siyah">Siyah</option>
              <option value="Yeşil">Yeşil</option>
              <option value="Kırmızı">Kırmızı</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Vites Durumu *</label>
            <select required name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Manuel">Manuel</option>
              <option value="Otomatik">Otomatik</option>
            </select>
          </div>
        </div>

        <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 flex justify-center items-center gap-2 text-lg">
          <PlusCircle className="w-6 h-6" /> Aracı Sisteme Kaydet
        </button>
      </form>
    </div>
  );
};

const VehicleListView = ({ vehicles, onDelete }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
    <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
      <Car className="w-6 h-6 text-red-600" /> Mevcut Araç Listesi
    </h2>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-black text-white border-b border-neutral-200">
          <tr>
            <th className="p-4 font-bold rounded-tl-xl">Araç Plakası</th>
            <th className="p-4 font-bold">Araç Cinsi</th>
            <th className="p-4 font-bold">Taşıma Kapasitesi</th>
            <th className="p-4 font-bold">Araç Detayları</th>
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
                <button onClick={() => onDelete(vehicle.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition" title="Aracı Sil">
                  <Ban className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
          {vehicles.length === 0 && (
            <tr>
              <td colSpan="5" className="p-6 text-center text-neutral-500">Kayıtlı araç bulunamadı.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const AddMaterialView = ({ onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Ambalaj Malzemesi',
    stock: '',
    unit: 'Adet'
  });

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({ name: '', category: 'Ambalaj Malzemesi', stock: '', unit: 'Adet' });
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <Package className="w-7 h-7 text-red-600" /> Yeni Malzeme Ekle
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Malzeme Adı *</label>
            <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: Büyük Boy Koli, Havalı Naylon" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Kategori *</label>
            <select required name="category" value={formData.category} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Ambalaj Malzemesi">Ambalaj Malzemesi</option>
              <option value="Alet / Hırdavat Malzemesi">Alet / Hırdavat Malzemesi</option>
              <option value="Diğer">Diğer</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Mevcut Stok Miktarı *</label>
            <input required type="number" min="0" name="stock" value={formData.stock} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold text-lg" placeholder="Örn: 500" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Ölçü Birimi *</label>
            <select required name="unit" value={formData.unit} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
              <option value="Adet">Adet</option>
              <option value="Rulo">Rulo</option>
              <option value="Metre">Metre</option>
              <option value="Kg">Kg</option>
              <option value="Paket">Paket</option>
            </select>
          </div>
        </div>

        <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 flex justify-center items-center gap-2 text-lg">
          <PlusCircle className="w-6 h-6" /> Malzemeyi Stoklara Ekle
        </button>
      </form>
    </div>
  );
};

const MaterialListView = ({ materials, onDelete }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
    <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
      <Package className="w-6 h-6 text-red-600" /> Mevcut Malzemeler ve Stok Durumu
    </h2>
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
                  {material.stock} <span className="text-xs font-bold opacity-70">{material.unit}</span>
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
);

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

const SystemFilesView = () => {
  const [backups, setBackups] = useState(() => {
    const saved = localStorage.getItem('sembol_backups');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, date: '2026-04-20', time: '18:30', size: '1.2 MB', description: 'Otomatik Sistem Yedeği', status: 'success' },
      { id: 2, date: '2026-04-25', time: '09:15', size: '1.5 MB', description: 'Manuel Kullanıcı Yedeği', status: 'success' }
    ];
  });
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    localStorage.setItem('sembol_backups', JSON.stringify(backups));
  }, [backups]);

  const handleTakeBackup = () => {
    setIsBackingUp(true);
    // Gerçekçi bir yedekleme süresi simüle ediyoruz
    setTimeout(() => {
      const newBackup = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        size: (Math.random() * (3.0 - 1.5) + 1.5).toFixed(2) + ' MB',
        description: 'Manuel Sistem Yedeği (Kullanıcı Talebi)',
        status: 'success'
      };
      setBackups([newBackup, ...backups]);
      setIsBackingUp(false);
    }, 2000); 
  };

  const handleDownloadBackup = (backup) => {
    // Tüm sistem verilerini JSON olarak bir araya getirip indirme tetikliyoruz
    const allData = {
       jobs: localStorage.getItem('sembol_jobs_v3'),
       personnel: localStorage.getItem('sembol_personnelList_v3'),
       vehicles: localStorage.getItem('sembol_vehicles_v1'),
       materials: localStorage.getItem('sembol_materials_v1')
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `sembol_yedek_${backup.date}_${backup.time.replace(':','')}.json`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Yedekleme Aksiyon Alanı */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-xl font-bold text-black flex items-center gap-2 mb-2">
              <Database className="w-6 h-6 text-red-600" /> Sistem Yedekleme ve Dosyalar
            </h2>
            <p className="text-neutral-500 text-sm max-w-xl">
              Sistemdeki tüm kayıtları (işler, personel, finans, müşteriler vb.) güvenli bir şekilde yedekleyebilir ve geçmiş yedeklerinizi bilgisayarınıza indirebilirsiniz.
            </p>
          </div>
          <button 
            onClick={handleTakeBackup} 
            disabled={isBackingUp}
            className="w-full md:w-auto px-8 py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
          >
            {isBackingUp ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isBackingUp ? 'Sistem Yedekleniyor...' : 'Şimdi Yedek Al'}
          </button>
        </div>
      </div>

      {/* Yedekleme Geçmişi Tablosu */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <h3 className="text-lg font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <History className="w-5 h-5 text-red-600" /> Yedekleme Geçmişi
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Tarih / Saat</th>
                <th className="p-4 font-bold">Açıklama</th>
                <th className="p-4 font-bold">Dosya Boyutu</th>
                <th className="p-4 font-bold text-center">Durum</th>
                <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {backups.map(backup => (
                <tr key={backup.id} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black">
                    {backup.date} <br/>
                    <span className="text-xs text-neutral-500 font-medium">{backup.time}</span>
                  </td>
                  <td className="p-4 text-neutral-700">{backup.description}</td>
                  <td className="p-4 text-neutral-600 font-bold">{backup.size}</td>
                  <td className="p-4 text-center">
                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase flex items-center justify-center gap-1 w-max mx-auto">
                      <CheckCircle className="w-3 h-3" /> Başarılı
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleDownloadBackup(backup)}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition flex items-center gap-2 font-bold text-xs w-max"
                    >
                      <Download className="w-4 h-4" /> İndir
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-neutral-500 font-medium">Henüz bir sistem yedeği bulunmuyor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = ({ onLogin, error }) => {
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
            src="sembol-nakliyat-logo-zeminsiz-09.jpg" 
            alt="Sembol Nakliyat" 
            className="w-auto h-24 object-contain mb-2 drop-shadow-sm" 
            onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4">S</div><h1 class="text-2xl font-black text-black tracking-widest">SEMBOL</h1>'; }} 
          />
          <p className="text-red-600 text-xs font-bold mt-1 tracking-[0.2em] bg-red-50 px-3 py-1 rounded-full border border-red-100">OPERASYON MERKEZİ</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
          
          <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 text-lg mt-4">
            Sisteme Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
};

const CustomerListView = ({ jobs, title, handleEditJob }) => {
  // Müşterileri telefon numaralarına göre tekilleştirip filtreliyoruz
  const uniqueCustomers = jobs
    .filter(j => title === 'Özel Müşteriler' ? j.isSpecial : true)

// --- ANA UYGULAMA (APP) ---
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginError, setLoginError] = useState('');

  // Arayüz State'leri
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [isVehicleSubMenuOpen, setIsVehicleSubMenuOpen] = useState(false);
  const [isMaterialSubMenuOpen, setIsMaterialSubMenuOpen] = useState(false);
  const [isPersonnelSubMenuOpen, setIsPersonnelSubMenuOpen] = useState(false);
  const [isTaskSubMenuOpen, setIsTaskSubMenuOpen] = useState(false);
  const [isCustomerSubMenuOpen, setIsCustomerSubMenuOpen] = useState(false);
  const [isJobSubMenuOpen, setIsJobSubMenuOpen] = useState(false);
  const [isAuthSubMenuOpen, setIsAuthSubMenuOpen] = useState(false);
  const [isFinanceSubMenuOpen, setIsFinanceSubMenuOpen] = useState(false);
  const [isSystemFilesSubMenuOpen, setIsSystemFilesSubMenuOpen] = useState(false);
  
  const [recordType, setRecordType] = useState('Nakliye');
  const [transactionType, setTransactionType] = useState('income');
  const [editingJobId, setEditingJobId] = useState(null); 
  const [cancelJobId, setCancelJobId] = useState(null); 

  const [showSecondFromAddress, setShowSecondFromAddress] = useState(false);
  const [showSecondToAddress, setShowSecondToAddress] = useState(false);

  // Modal State'leri
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [jobToAssign, setJobToAssign] = useState(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [additionalAssignees, setAdditionalAssignees] = useState([]);
  const [manualExtraAssignees, setManualExtraAssignees] = useState([]);
  const [assignedVehiclePlate, setAssignedVehiclePlate] = useState('');
  
  const [showEndJobModal, setShowEndJobModal] = useState(false);
  const [jobToEnd, setJobToEnd] = useState(null);
  const [endJobError, setEndJobError] = useState('');
  const [endJobData, setEndJobData] = useState({ 
    paymentMethod: 'Nakit', 
    damageStatus: 'Hasarsız teslim edildi', 
    damageDetails: '',
    damageImage: '',
    truckImage: '',
    truckStatus: 'Herhangi bir sorun yok',
    truckIssueDetails: '',
    customerSatisfaction: 'Herhangi bir işlem yapmadı.',
    enteredCode: ''
  });

  const [aiModal, setAiModal] = useState({ isOpen: false, loading: false, content: '', title: '', type: '' });
  const [viewingImage, setViewingImage] = useState(null);

  // --- FİREBASE VERİ STATE'LERİ ---
  const [dataLoadStatus, setDataLoadStatus] = useState({
    jobs: false, trans: false, tasks: false, notif: false, msg: false, logs: false, veh: false, mat: false, pers: false, settings: false
  });
  
  const [jobs, setJobs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [positions, setPositions] = useState([]);
  const [ranks, setRanks] = useState([]);
  
  // Form State'leri
  const [newTransaction, setNewTransaction] = useState({ amount: '', category: 'Nakliye Tahsilatı', account: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggingTask, setDraggingTask] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '', date: new Date().toISOString().split('T')[0] });

  // Eski veri aktarımı kontrolü
  const [isDataMigrated, setIsDataMigrated] = useState(() => localStorage.getItem('sembol_data_migrated') === 'true');

  const [formData, setFormData] = useState({
    isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo',
    fromProvince: '', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '',
    extraLoadingAddresses: [], selectedDepo: '', 
    toProvince: '', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '',
    extraUnloadingAddresses: [],
    date: new Date().toISOString().split('T')[0], time: '08:00', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
  });

  // --- FIREBASE BAĞLANTI EFEKTLERİ ---
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

  useEffect(() => {
    if (!firebaseUser) return;
    const getCol = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);
    const unsubs = [];

// Koleksiyon Dinleyicileri
    unsubs.push(onSnapshot(getCol('jobs'), snap => { setJobs(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, jobs: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('transactions'), snap => { setTransactions(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, trans: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('tasks'), snap => { setTasks(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, tasks: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('notifications'), snap => { setNotifications(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, notif: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('messages'), snap => { setMessages(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, msg: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('systemLogs'), snap => { setSystemLogs(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, logs: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('vehicles'), snap => { setVehicles(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, veh: true})); }, console.error));
    unsubs.push(onSnapshot(getCol('materials'), snap => { setMaterials(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, mat: true})); }, console.error));

    unsubs.push(onSnapshot(getCol('personnelList'), async snap => {
      const list = snap.docs.map(d => ({...d.data(), id: d.id})); // Hatanın çözümü bu ters çevirme işlemidir
      setPersonnelList(list);
      if (snap.empty) {
        await addDoc(getCol('personnelList'), {
          fullName: 'Sistem Yöneticisi', email: 'admin', password: 'admin', position: 'Firma Sahibi', rank: 'Müdür', safetyTraining: 'Eğitim Aldı (Geçerli)', permissions: { canView: true, canEdit: true }
        });
      }
      setDataLoadStatus(p => ({...p, pers: true}));
      setIsAuthChecking(false);
    }, console.error));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), async docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPositions(data.positions || []);
        setRanks(data.ranks || []);
      } else {
        const defaultPos = ['Şoför', 'Taşıma Elemanı', 'Muhasebe', 'Mobilya Ustası', 'Satış Personeli', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operasyon', 'Firma Sahibi'];
        const defaultRanks = ['Müdür', 'Ekip Şefi', 'Asistan', 'Standart', 'Kalfa'];
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { positions: defaultPos, ranks: defaultRanks });
        setPositions(defaultPos);
        setRanks(defaultRanks);
      }
      setDataLoadStatus(p => ({...p, settings: true}));
    }, console.error));

    return () => unsubs.forEach(unsub => unsub());
  }, [firebaseUser]);

  // Oturum Kontrolü (Yerel Önbellek)
  useEffect(() => {
    if (personnelList.length > 0 && !isAuthenticated) {
      try {
        const savedUser = localStorage.getItem('sembol_crm_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          const user = personnelList.find(p => 
            (p.email === parsed.email || p.fullName?.toLowerCase() === parsed.email?.toLowerCase()) && 
            p.password === parsed.password
          );
          if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
          }
        }
      } catch (e) {}
    }
  }, [personnelList, isAuthenticated]); 

  // --- FIREBASE CRUD İŞLEMLERİ ---

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
      ...newPersonnel, permissions: { canView: true, canEdit: false }
    });
    addSystemLog('Personel Eklendi', `${newPersonnel.fullName} sisteme eklendi.`);
  };

  const handleUpdatePersonnel = async (updatedUser) => {
    if (!firebaseUser) return;
    const { id, ...data } = updatedUser;
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id), data);
    
    if (currentUser && currentUser.id === id) {
      setCurrentUser(updatedUser);
      const savedUser = localStorage.getItem('sembol_crm_user');
      if (savedUser) localStorage.setItem('sembol_crm_user', JSON.stringify({ email: updatedUser.email, password: updatedUser.password }));
    }
  };

  const handleDeletePersonnel = async (id) => {
    if (!firebaseUser) return;
    const person = personnelList.find(p => p.id === id);
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id));
    if(person) addSystemLog('Personel Silindi', `${person.fullName} sistemden kaldırıldı.`);
    if (currentUser && currentUser.id === id) handleLogout();
  };

  const handleUpdatePermissions = async (id, permissionType, value) => {
    if (!firebaseUser) return;
    const user = personnelList.find(p => p.id === id);
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id), {
      permissions: { ...user.permissions, [permissionType]: value }
    });
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

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), { ...newTask, status: 'todo' });
    setShowTaskModal(false);
    setNewTask({ title: '', description: '', assignee: personnelList.length > 0 ? personnelList[0].fullName : 'Yönetim', date: new Date().toISOString().split('T')[0] });
    setActiveTab('taskList');
  };
  
  const handleUpdateTaskStatus = async (taskId, status) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), { status });
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
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { 
      type: transactionType, amount: parseFloat(newTransaction.amount), category: newTransaction.category, account: newTransaction.account, date: newTransaction.date, description: newTransaction.description 
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

  // --- ARAYÜZ YARDIMCI FONKSİYONLARI ---

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
        setFormData({...formData, selectedDepo: depoName, fromProvince: depo.province, fromDistrict: depo.district, fromAddress: depo.address, fromFloor: 'Giriş Kat', fromTransportMethod: 'Merdiven', fromPacking: 'Kendisi Topladı', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre'});
      } else {
        setFormData({...formData, selectedDepo: depoName, toProvince: depo.province, toDistrict: depo.district, toAddress: depo.address, toFloor: 'Giriş Kat', toTransportMethod: 'Merdiven', toPacking: 'Kendisi Topladı', toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre'});
      }
    } else {
      if (formData.depoDirection === 'fromDepo') {
        setFormData({...formData, selectedDepo: '', fromProvince: '', fromDistrict: '', fromAddress: '', fromFloor: '1. Kat', fromTransportMethod: 'Merdiven', fromPacking: 'Kendisi Topladı', fromRoomCount: '2+1', fromDistance: '', fromDistanceUnit: 'Metre'});
      } else {
        setFormData({...formData, selectedDepo: '', toProvince: '', toDistrict: '', toAddress: '', toFloor: '1. Kat', toTransportMethod: 'Merdiven', toPacking: 'Kendisi Topladı', toRoomCount: '2+1', toDistance: '', toDistanceUnit: 'Metre'});
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
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), { status: 'cancelled' });
    addSystemLog('İş İptal Edildi', `Sistem üzerinden bir operasyon iptal edildi.`);
  };

  const handleRestoreJob = async (id) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), { status: 'pending' });
    addSystemLog('İş Geri Alındı', `İptal edilen bir operasyon geri alındı.`);
  };

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      const jobData = { type: recordType, ...formData };
      Object.keys(jobData).forEach(key => jobData[key] === undefined && delete jobData[key]);

      if (editingJobId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', editingJobId), jobData);
        addSystemLog('Kayıt Güncellendi', `${formData.customerName} müşterisine ait iş güncellendi.`);
        setEditingJobId(null);
      } else {
        const newDeliveryCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const primaryJob = { ...jobData, team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [], status: 'pending', endJobDetails: null, deliveryCode: newDeliveryCode, createdBy: currentUser?.fullName || 'Sistem' };
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), primaryJob);
        addSystemLog('Yeni İş Kaydı', `${formData.customerName} için yeni bir ${recordType} kaydı oluşturuldu.`);

        // Otomatik Asansör
        if (recordType !== 'Asansör') {
          const createAsansor = async (sourceAddr, installType) => {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), {
              type: 'Asansör', customerType: formData.customerType, tcNo: formData.tcNo, taxNo: formData.taxNo, customerName: formData.customerName, customerPhone: formData.customerPhone, altPhone: formData.altPhone, date: formData.date, time: formData.time, price: '0', deposit: '0', deliveryCode: newDeliveryCode, contractDetails: 'Otomatik Oluşturulan Asansör Kurulum Kaydı', notes: '', team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [], status: 'pending', endJobDetails: null, createdBy: currentUser?.fullName || 'Sistem', fromFloor: sourceAddr.floor, fromDistance: sourceAddr.distance, fromDistanceUnit: sourceAddr.distanceUnit, fromPacking: 'Kendi İşimiz', fromProvince: sourceAddr.province || '', fromDistrict: sourceAddr.district || '', fromAddress: sourceAddr.address || '', toProvince: '', toDistrict: '', toAddress: '', toFloor: '', toRoomCount: '', toDistance: '', toDistanceUnit: '', extraLoadingAddresses: [], extraUnloadingAddresses: []
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
      
      setFormData({
        isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo', fromProvince: '', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', extraLoadingAddresses: [], selectedDepo: '', toProvince: '', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', extraUnloadingAddresses: [], date: new Date().toISOString().split('T')[0], time: '08:00', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
      });
      setActiveTab('dashboard');
    } catch (err) { console.error(err); }
  };

  const handleOpenAssignModal = (job) => {
    setJobToAssign(job);
    setAssigneeId(job.assignedPersonnelId || '');
    setAssignedVehiclePlate(job.assignedVehiclePlate || '');
    setAdditionalAssignees(job.assignedPersonnelIds ? job.assignedPersonnelIds.filter(id => id !== job.assignedPersonnelId) : []);
    
    let manual = [];
    if (job.teamNames && job.teamNames.length > 0) {
       const systemNames = personnelList.filter(p => job.assignedPersonnelIds?.includes(p.id)).map(p => p.fullName);
       manual = job.teamNames.filter(name => !systemNames.includes(name));
    }
    setManualExtraAssignees(manual);
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
      assignedPersonnelId: mainPerson.id, assignedPersonnelIds: allAssignedIds, teamNames: allNames, team: allNames.join(', '), assignedVehiclePlate: assignedVehiclePlate, status: 'in-progress' 
    });
    
    const notifsCol = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
    for (const userId of allAssignedIds) {
      await addDoc(notifsCol, {
        userId: userId, title: 'Yeni Görev Ataması', message: `${jobToAssign.customerName} operasyonu için görevlendirildiniz.`, date: new Date().toLocaleString('tr-TR'), read: false
      });
    }
    
    setShowAssignModal(false); setJobToAssign(null); setAssigneeId(''); setAdditionalAssignees([]); setManualExtraAssignees([]); setAssignedVehiclePlate('');
  };

  const handleAddManualAssignee = () => setManualExtraAssignees([...manualExtraAssignees, '']);
  const handleManualAssigneeChange = (index, value) => {
    const updated = [...manualExtraAssignees]; updated[index] = value; setManualExtraAssignees(updated);
  };
  const handleRemoveManualAssignee = (index) => setManualExtraAssignees(manualExtraAssignees.filter((_, i) => i !== index));

  const submitRemoveAssignment = async () => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToAssign.id), {
      assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [], team: 'Atanmadı', assignedVehiclePlate: '', status: jobToAssign.status === 'completed' ? 'completed' : 'pending' 
    });
    setShowAssignModal(false); setJobToAssign(null); setAssigneeId(''); setAdditionalAssignees([]); setManualExtraAssignees([]); setAssignedVehiclePlate('');
  };

  const handleOpenEndJobModal = (job) => {
    setJobToEnd(job);
    setEndJobError('');
    setEndJobData({ paymentMethod: 'Nakit', damageStatus: 'Hasarsız teslim edildi', damageDetails: '', damageImage: '', truckImage: '', truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Herhangi bir işlem yapmadı.', enteredCode: '' });
    setShowEndJobModal(true);
  };

const submitEndJob = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    
    // Güvenli eşleşme: Sadece alfanümerik karakterleri al ve büyük harfe çevir
    const userCode = (endJobData.enteredCode || '').toString().trim().toUpperCase();
    const realCode = (jobToEnd.deliveryCode || '').toString().trim().toUpperCase();

    // Hata Kontrolü:
    // Sadece eğer işin bir kodu varsa (realCode mevcutsa) VE girilen kodla uyuşmuyorsa hata ver.
    if (realCode && userCode !== realCode) {
      setEndJobError(`Girdiğiniz kod hatalı. Müşteriden "${realCode}" kodunu istemelisiniz.`); 
      return;
    }

    setEndJobError(''); // Hata yoksa eski hatayı temizle

    if (!jobToEnd.materialsDeducted) {
      const estData = calculateMaterials(jobToEnd.fromRoomCount, jobToEnd.fromPacking);
      for (const m of materials) {
        let deductAmount = 0;
        if (m.name.includes('Streç')) deductAmount = estData.strec;
        if (m.name === 'Bant') deductAmount = estData.bant;
        if (m.name === 'Poşet') deductAmount = estData.poset;
        if (m.name.includes('Kağıt')) deductAmount = estData.kagit;
        if (m.name === 'Koli') deductAmount = estData.koli;
        if (deductAmount > 0) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', m.id), { stock: String(Math.max(0, parseFloat(m.stock) - deductAmount)) });
        }
      }
      addSystemLog('Stok Çıkışı (Oto)', `${jobToEnd.customerName} operasyonu sonlandırıldığı için malzemeler stoktan otomatik düşüldü.`);
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToEnd.id), { status: 'completed', endJobDetails: endJobData, materialsDeducted: true });
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

    for (const m of materials) {
      let deductAmount = 0;
      if (m.name.includes('Streç')) deductAmount = estData.strec;
      if (m.name === 'Bant') deductAmount = estData.bant;
      if (m.name === 'Poşet') deductAmount = estData.poset;
      if (m.name.includes('Kağıt')) deductAmount = estData.kagit;
      if (m.name === 'Koli') deductAmount = estData.koli;
      if (deductAmount > 0) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', m.id), { stock: String(Math.max(0, parseFloat(m.stock) - deductAmount)) });
      }
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobId), { materialsDeducted: true });
    setAiModal({ ...aiModal, alreadyDeducted: true, content: aiModal.content + '\n\n✅ Malzemeler stoktan başarılı bir şekilde düşüldü.' });
    addSystemLog('Stok Çıkışı', `Manuel onay ile operasyon için malzeme stoktan düşüldü.`);
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

  const handleLogin = (email, password, rememberMe) => {
    const user = personnelList.find(p => (p.email === email || p.fullName?.toLowerCase() === email.toLowerCase()) && p.password === password);
    if (user) {
      setCurrentUser(user); setIsAuthenticated(true); setLoginError('');
      if (rememberMe) try { localStorage.setItem('sembol_crm_user', JSON.stringify({ email, password })); } catch (e) { }
      else try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
    } else setLoginError('Kullanıcı adı / E-posta veya şifre hatalı.');
  };

  const handleLogout = () => {
    setIsAuthenticated(false); setCurrentUser(null); setActiveTab('dashboard'); setIsSidebarOpen(false);
    try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
  };

  const allDataLoaded = Object.values(dataLoadStatus).every(v => v === true);

  if (isAuthChecking || !allDataLoaded) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white animate-in fade-in">
         <div className="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4 animate-pulse">S</div>
         <p className="font-bold tracking-widest text-neutral-400">SİSTEM YÜKLENİYOR VE BULUTA BAĞLANIYOR...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} error={loginError} />;

// --- YETKİLENDİRME VE GÜVENLİK KONTROLLERİ ---
  const userPos = currentUser?.position || '';
  const userRank = currentUser?.rank || '';
  const canEdit = currentUser?.permissions?.canEdit;

  const isOwner = userPos.includes('Firma Sahibi');
  const isManager = userPos.includes('Yönetici') || isOwner || userRank === 'Müdür';
  const isMuhasebe = userPos.includes('Muhasebe');
  const isDepo = userPos.includes('Depo Sorumlusu') || userPos.includes('Depo');
  const isSales = userPos.includes('Satış');
  const isOperasyon = userPos.includes('Operasyon');

  // MENÜ ERİŞİM KURALLARI (Kesin ve Sıkı Sınırlar)
  const hasJobAccess = isManager || isOperasyon || isSales || isMuhasebe || isDepo || canEdit; 
  const hasResourceAccess = isManager || isOperasyon; // Araç, Personel, Malzeme (Sadece Yönetici ve Operasyon)
  const hasFinanceAccess = isManager || isMuhasebe; // Finans Kasa (Sadece Yönetici ve Muhasebe)
  const hasTaskAccess = isManager || isOperasyon || isMuhasebe; // Görevler
  const hasAdminAccess = isManager; // ŞİFRELER VE YETKİLER (SADECE MÜDÜR VEYA FİRMA SAHİBİ)
  const hasFullAccess = isManager; // Eski verileri kurtarma vs.
  // ----------------------------------------------
  const visibleJobs = hasJobAccess ? jobs : jobs.filter(j => {
    const isMyJob = j.assignedPersonnelIds?.includes(currentUser?.id) || j.assignedPersonnelId === currentUser?.id;
    if (!isMyJob) return false;
    if (j.status === 'completed') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const jobDate = new Date(j.date); jobDate.setHours(0, 0, 0, 0);
      if (jobDate < today) return false;
    }
    return true;
  });
  
  const unreadNotifCount = notifications.filter(n => String(n.userId) === String(currentUser?.id) && !n.read).length;
  const unreadMessageCount = messages.filter(m => String(m.receiverId) === String(currentUser?.id) && !m.read).length;
  const totalUnreadCount = unreadNotifCount + unreadMessageCount;

  return (
    <div className="flex h-screen bg-neutral-50 font-sans text-neutral-900 overflow-hidden">
      
      {/* Mobil Header & Menü Butonu */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-black text-white flex items-center justify-between px-4 z-30 shadow-md border-b border-red-600">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden">
             <div className="w-full h-full bg-red-600 flex items-center justify-center rounded-lg font-black text-white">S</div>
          </div>
          <h1 className="font-bold text-lg">Sembol Nakliyat</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          className="p-2 hover:bg-neutral-800 rounded-lg transition"
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

      {/* Sol Menü (Dikey Sidebar) */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative top-0 left-0 z-40 w-64 md:min-w-[256px] bg-black text-white flex flex-col shadow-2xl shrink-0 h-full transition-transform duration-300 ease-in-out border-r border-neutral-800`}>
        <div className="p-6 flex items-center gap-4 border-b border-neutral-800">
          <div className="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-full border-2 border-neutral-800/50 bg-red-600">
             <span className="font-black text-3xl text-white">S</span>
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight text-white tracking-widest">SEMBOL</h1>
            <p className="text-red-600 text-[10px] font-bold mt-0.5 tracking-[0.2em]">OPERASYON MERKEZİ</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-900/50 border-b border-neutral-800 flex flex-col">
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">Aktif Kullanıcı</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-bold text-white truncate">{currentUser?.fullName}</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 truncate">{currentUser?.email}</span>
        </div>
        
        <nav className="flex flex-col mt-4 px-4 gap-2 overflow-y-auto flex-1 pb-6 custom-scrollbar">
          
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
            className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
          >
            <Calendar className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Anasayfa</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
            className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'calendar' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
          >
            <CalendarDays className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Takvim</span>
          </button>

          <button 
            onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
            className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'profile' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
          >
            <div className="flex items-center gap-3">
               <User className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Profilim</span>
            </div>
            {totalUnreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{totalUnreadCount}</span>
            )}
          </button>
          
          {/* Kayıt Aç */}
          {hasJobAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsSubMenuOpen(!isSubMenuOpen); setIsVehicleSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className={`w-5 h-5 shrink-0 ${(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Kayıt Aç</span>
                </div>
                {isSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('addNakliye'); setIsSidebarOpen(false); setRecordType('Nakliye'); setEditingJobId(null); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addNakliye' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addNakliye' ? 'bg-white' : 'bg-red-600'}`}></div> Nakliye Kayıt
                  </button>
                  <button 
                    onClick={() => { setActiveTab('addDepo'); setIsSidebarOpen(false); setRecordType('Depo'); setEditingJobId(null); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addDepo' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addDepo' ? 'bg-white' : 'bg-red-600'}`}></div> Depo Kayıt
                  </button>
                  <button 
                    onClick={() => { setActiveTab('addAsansor'); setIsSidebarOpen(false); setRecordType('Asansör'); setEditingJobId(null); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addAsansor' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addAsansor' ? 'bg-white' : 'bg-red-600'}`}></div> Asansör Kayıt
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="w-full h-px bg-neutral-800 my-2"></div>

          {/* İş Listesi */}
          {hasJobAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsJobSubMenuOpen(!isJobSubMenuOpen); setIsCustomerSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'currentJobs' || activeTab === 'allJobs' || activeTab === 'completedJobs' || activeTab === 'cancelledJobs') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className={`w-5 h-5 shrink-0 ${(activeTab === 'currentJobs' || activeTab === 'allJobs' || activeTab === 'completedJobs' || activeTab === 'cancelledJobs') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">İş Listesi</span>
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

          {/* Görev Listesi */}
          {hasTaskAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsTaskSubMenuOpen(!isTaskSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addTask' || activeTab === 'taskList') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <CheckSquare className={`w-5 h-5 shrink-0 ${(activeTab === 'addTask' || activeTab === 'taskList') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Görev Listesi</span>
                </div>
                {isTaskSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isTaskSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('addTask'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addTask' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addTask' ? 'bg-white' : 'bg-red-600'}`}></div> Görev Ekle
                  </button>
                  <button 
                    onClick={() => { setActiveTab('taskList'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'taskList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'taskList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Görevler
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Müşteri Listesi */}
          {hasJobAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsCustomerSubMenuOpen(!isCustomerSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
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

          {/* Personel Listesi */}
          {hasResourceAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsPersonnelSubMenuOpen(!isPersonnelSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addPersonnel' || activeTab === 'personnelList' || activeTab === 'maviPersonnel' || activeTab === 'beyazPersonnel') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className={`w-5 h-5 shrink-0 ${(activeTab === 'addPersonnel' || activeTab === 'personnelList' || activeTab === 'maviPersonnel' || activeTab === 'beyazPersonnel') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Personel Listesi</span>
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
                    onClick={() => { setActiveTab('maviPersonnel'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'maviPersonnel' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'maviPersonnel' ? 'bg-white' : 'bg-red-600'}`}></div> Mavi Personel
                  </button>
                  <button 
                    onClick={() => { setActiveTab('beyazPersonnel'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'beyazPersonnel' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'beyazPersonnel' ? 'bg-white' : 'bg-red-600'}`}></div> Beyaz Personel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Araç Listesi */}
          {hasResourceAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsVehicleSubMenuOpen(!isVehicleSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addVehicle' || activeTab === 'vehicleList') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Car className={`w-5 h-5 shrink-0 ${(activeTab === 'addVehicle' || activeTab === 'vehicleList') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Araç Listesi</span>
                </div>
                {isVehicleSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isVehicleSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('addVehicle'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addVehicle' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addVehicle' ? 'bg-white' : 'bg-red-600'}`}></div> Araç Ekle
                  </button>
                  <button 
                    onClick={() => { setActiveTab('vehicleList'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'vehicleList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'vehicleList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Araç Listesi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Malzeme Listesi */}
          {hasResourceAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsMaterialSubMenuOpen(!isMaterialSubMenuOpen); setIsVehicleSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addMaterial' || activeTab === 'materialList') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Package className={`w-5 h-5 shrink-0 ${(activeTab === 'addMaterial' || activeTab === 'materialList') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Malzeme Listesi</span>
                </div>
                {isMaterialSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isMaterialSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('addMaterial'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addMaterial' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addMaterial' ? 'bg-white' : 'bg-red-600'}`}></div> Malzeme Ekle
                  </button>
                  <button 
                    onClick={() => { setActiveTab('materialList'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'materialList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'materialList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Malzemeler
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Finans Listesi */}
          {hasFinanceAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsFinanceSubMenuOpen(!isFinanceSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'financeDashboard' || activeTab === 'reporting') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Wallet className={`w-5 h-5 shrink-0 ${(activeTab === 'financeDashboard' || activeTab === 'reporting') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Finans Yönetimi</span>
                </div>
                {isFinanceSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isFinanceSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('financeDashboard'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'financeDashboard' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'financeDashboard' ? 'bg-white' : 'bg-red-600'}`}></div> Kasa Özeti
                  </button>
                  <button 
                    onClick={() => { setActiveTab('reporting'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'reporting' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'reporting' ? 'bg-white' : 'bg-red-600'}`}></div> Raporlama
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Yetkilendirme */}
          {hasAdminAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsAuthSubMenuOpen(!isAuthSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'userList' || activeTab === 'positions' || activeTab === 'ranks' || activeTab === 'permissions') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Shield className={`w-5 h-5 shrink-0 ${(activeTab === 'userList' || activeTab === 'positions' || activeTab === 'ranks' || activeTab === 'permissions') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Yetkilendirme</span>
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
                </div>
              )}
            </div>
          )}

          {/* Sistem Dosyaları */}
          {hasAdminAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsSystemFilesSubMenuOpen(!isSystemFilesSubMenuOpen); setIsAuthSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'backupSystem' || activeTab === 'systemLogs') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`w-5 h-5 shrink-0 ${(activeTab === 'backupSystem' || activeTab === 'systemLogs') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Sistem Ayarları</span>
                </div>
                {isSystemFilesSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isSystemFilesSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('systemLogs'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'systemLogs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'systemLogs' ? 'bg-white' : 'bg-red-600'}`}></div> Sistem Kayıtları
                  </button>
                  <button 
                    onClick={() => { setActiveTab('backupSystem'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'backupSystem' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'backupSystem' ? 'bg-white' : 'bg-red-600'}`}></div> Yedekleme
                  </button>
                </div>
              )}
            </div>
          )}

          {hasFullAccess && (
            <>
              {/* ESKİ VERİLERİ KURTARMA BUTONU BURADA */}
              {!isDataMigrated && (
                <button 
                  onClick={handleSyncOldData}
                  className="w-full py-3 px-4 mt-4 text-sm font-black transition flex justify-center items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/30 animate-pulse border border-orange-500"
                >
                  🔄 Eski Verileri Kurtar
                </button>
              )}
            </>
          )}

        </nav>

        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={handleLogout}
            className="w-full py-3 px-4 text-sm font-bold text-red-500 hover:text-white hover:bg-red-600 transition flex justify-center items-center gap-2 rounded-xl border border-red-500/30 hover:border-red-600"
          >
            <LogOut className="w-4 h-4 shrink-0" /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full p-4 md:p-8 mt-16 md:mt-0 overflow-y-auto relative">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView jobs={visibleJobs} handleGenerateDailySummary={handleGenerateDailySummary} />}
          {activeTab === 'calendar' && <CalendarView jobs={visibleJobs} handleEditJob={handleEditJob} />}
          {activeTab === 'profile' && <ProfileView currentUser={currentUser} jobs={visibleJobs} notifications={notifications} markNotificationsAsRead={markNotificationsAsRead} personnelList={personnelList} messages={messages} setMessages={setMessages} handleOpenEndJobModal={handleOpenEndJobModal} setViewingImage={setViewingImage} handleUpdatePersonnel={handleUpdatePersonnel} />}
          
          {(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') && hasJobAccess &&
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
          }
          {activeTab === 'allCustomers' && hasJobAccess && <CustomerListView jobs={jobs} title="Tüm Müşteriler" handleEditJob={handleEditJob} />}
          {activeTab === 'specialCustomers' && hasJobAccess && <CustomerListView jobs={jobs} title="Özel Müşteriler" handleEditJob={handleEditJob} />}

          {/* İş Listesi Modülleri */}
          {activeTab === 'currentJobs' && hasJobAccess && <CurrentJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setViewingImage={setViewingImage} />}
          {activeTab === 'completedJobs' && hasJobAccess && <CompletedJobsView jobs={jobs} handleEditJob={handleEditJob} setViewingImage={setViewingImage} />}
          {activeTab === 'allJobs' && hasJobAccess && <AllJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} />}
          {activeTab === 'cancelledJobs' && hasJobAccess && <CancelledJobsView jobs={jobs} handleEditJob={handleEditJob} handleRestoreJob={handleRestoreJob} />}

          {activeTab === 'customerBlacklist' && hasJobAccess && <PlaceholderView title="Müşteri Kara Listesi" icon={AlertTriangle} />}
          
          {/* Personel ve Araç Modülleri */}
          {activeTab === 'addPersonnel' && hasResourceAccess && <AddPersonnelView onAdd={handleAddPersonnel} positions={positions} ranks={ranks} />}
          {activeTab === 'personnelList' && hasResourceAccess && <PersonnelListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} title="Tüm Personel" />}
          {activeTab === 'maviPersonnel' && hasResourceAccess && <PersonnelListView personnelList={personnelList.filter(p => ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position))} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} title="Mavi Yaka Personel" />}
          {activeTab === 'beyazPersonnel' && hasResourceAccess && <PersonnelListView personnelList={personnelList.filter(p => ['Muhasebe', 'Satış Personeli', 'Operasyon', 'Firma Sahibi', 'Müdür'].includes(p.position))} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} title="Beyaz Yaka Personel" />}
          {activeTab === 'addVehicle' && hasResourceAccess && <AddVehicleView onAdd={handleAddVehicle} />}
          {activeTab === 'vehicleList' && hasResourceAccess && <VehicleListView vehicles={vehicles} onDelete={handleDeleteVehicle} />}

          {/* Malzeme Modülleri */}
          {activeTab === 'addMaterial' && hasResourceAccess && <AddMaterialView onAdd={handleAddMaterial} />}
          {activeTab === 'materialList' && hasResourceAccess && <MaterialListView materials={materials} onDelete={handleDeleteMaterial} />}
          
          {/* Finans Yönetimi Modülleri */}
          {activeTab === 'financeDashboard' && hasFinanceAccess && <FinanceDashboardView jobs={jobs} />}
          {activeTab === 'reporting' && hasFinanceAccess && <ReportingView jobs={jobs} />}

          {activeTab === 'addTask' && hasTaskAccess &&
            <AddTaskFormView 
              newTask={newTask}
              setNewTask={setNewTask}
              handleAddTask={handleAddTask}
              personnelList={personnelList}
            />
          }
{activeTab === 'taskList' && hasTaskAccess &&
            <TaskManagerView 
              tasks={tasks}
              setTasks={setTasks}
              setShowTaskModal={setShowTaskModal}
              draggingTask={draggingTask}
              setDraggingTask={setDraggingTask}
              openEditTask={openEditTask}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onDeleteTask={handleDeleteTask}
            />
          }
          
          {/* Yetkilendirme Modülleri */}
          {activeTab === 'userList' && hasAdminAccess && <UserListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} onDelete={handleDeletePersonnel} positions={positions} ranks={ranks} />}
          {activeTab === 'positions' && hasAdminAccess && <PositionsView positions={positions} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} />}
          {activeTab === 'ranks' && hasAdminAccess && <RanksView ranks={ranks} onAddRank={handleAddRank} onDeleteRank={handleDeleteRank} />}
          {activeTab === 'permissions' && hasAdminAccess && <PermissionsView personnelList={personnelList} handleUpdatePermissions={handleUpdatePermissions} />}
          
          {/* Sistem Dosyaları Modülü */}
          {activeTab === 'backupSystem' && hasAdminAccess && <SystemFilesView />}
          {activeTab === 'systemLogs' && hasAdminAccess && <SystemLogsView logs={systemLogs} />}
        </div>
      </main>

      {/* İPTAL ONAY MODALI */}
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

      {/* İŞ ATAMA MODALI */}
      {showAssignModal && jobToAssign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] flex flex-col">
            <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
              <h3 className="font-bold text-lg">Personele Görev Ata</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form onSubmit={submitAssignJob} className="space-y-5">
                <p className="text-sm text-neutral-600 pb-2 border-b border-neutral-100">
                  <b className="text-black">Müşteri:</b> {jobToAssign.customerName} <br/>
                  <b className="text-black">Tarih:</b> {jobToAssign.date}
                </p>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">Asıl Görevli (Ekip Şefi / Sorumlu)</label>
                  <select required value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                    <option value="">Lütfen personel seçiniz...</option>
                    {personnelList.filter(p => p.rank === 'Ekip Şefi' || p.rank === 'Kalfa').map(person => (
                      <option key={person.id} value={person.id}>{person.fullName} - {person.position} ({person.rank})</option>
                    ))}
                  </select>
                </div>

                {assigneeId && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-red-600" /> Beraber Gidecek Diğer Personeller
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-neutral-300 rounded-xl p-2 bg-white space-y-1 custom-scrollbar">
                      {personnelList.filter(p => p.id !== parseInt(assigneeId) && ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(p.position)).map(person => (
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
                          <span className="text-sm font-medium text-black flex-1">{person.fullName} <span className="text-xs text-neutral-500 ml-1">({person.position})</span></span>
                        </label>
                      ))}
                      {personnelList.filter(p => p.id !== parseInt(assigneeId) && ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(p.position)).length === 0 && (
                         <p className="text-xs text-neutral-500 p-2">Eklenebilecek uygun pozisyonda (Şoför, Usta, Taşıma Elemanı) personel bulunmuyor.</p>
                      )}
                    </div>
                  </div>
                )}

                {assigneeId && (
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

                {assigneeId && (
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
                  <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20">
                    <CheckSquare className="w-5 h-5" /> Görevi Onayla ve Atamayı Yap
                  </button>

                  {jobToAssign.team !== 'Atanmadı' && (
                    <button type="button" onClick={submitRemoveAssignment} className="w-full py-4 bg-neutral-100 text-red-600 font-bold rounded-xl hover:bg-neutral-200 transition flex justify-center items-center gap-2 border border-red-100">
                      <Ban className="w-5 h-5" /> Atamayı Kaldır / Temizle
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* İŞİ SONLANDIR MODALI (YENİ EKLENDİ) */}
      {showEndJobModal && jobToEnd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] flex flex-col">
            <div className="bg-green-600 text-white p-4 flex justify-between items-center border-b-4 border-green-800 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> İşi Sonlandır
              </h3>
              <button onClick={() => setShowEndJobModal(false)} className="text-white/80 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
<form onSubmit={submitEndJob} className="space-y-6">
              <p className="text-sm text-neutral-600 pb-2 border-b border-neutral-100">
                <b className="text-black">Müşteri:</b> {jobToEnd.customerName} <br/>
                <b className="text-black">Operasyon Tarihi:</b> {jobToEnd.date}
              </p>

              {/* Hata Mesajı (Kod yanlış girilirse çıkacak) */}
              {endJobError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 mb-4 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 shrink-0" /> {endJobError}
                </div>
              )}

              {/* YENİ EKLENEN: Müşteri Teslim Kodu Alanı (Sadece kod atandıysa görünür) */}
              {jobToEnd.deliveryCode && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 text-center mb-4">
                  <Key className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <label className="block text-sm font-bold text-emerald-800 mb-3">Müşteri Teslim Kodunu Giriniz *</label>
                  <input 
                    required 
                    type="text" 
                    maxLength={6}
                    value={endJobData.enteredCode} 
                    onChange={(e) => setEndJobData({...endJobData, enteredCode: e.target.value.toUpperCase()})} 
                    className="w-full p-4 border-2 border-emerald-300 rounded-xl focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none text-center font-black text-2xl tracking-[0.5em] text-emerald-700 bg-white placeholder:text-emerald-200 uppercase transition-all shadow-inner" 
                    placeholder="6 HANELİ KOD" 
                  />
                  <p className="text-xs text-emerald-700 mt-4 font-medium px-2">
                    İşi başarıyla sonlandırmak için müşteriden teslim kodunu isteyip yukarıdaki alana girin.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-black mb-2">İşin Ödemesi Nereye Yapıldı?</label>
                  <select required value={endJobData.paymentMethod} onChange={(e) => setEndJobData({...endJobData, paymentMethod: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none bg-white transition font-medium">
                    <option value="Nakit">Nakit</option>
                    <option value="İban">İban</option>
                    <option value="Kredi Kartı">Kredi Kartı</option>
                    <option value="Alınmadı">Alınmadı</option>
                  </select>
                </div>

                <div className="border-t border-neutral-100 pt-4">
                  <label className="block text-sm font-bold text-black mb-2">Kamyon Kasasının Son Hali (Fotoğraf)</label>
                  <label className="cursor-pointer bg-neutral-50 border border-neutral-300 text-neutral-600 p-3 rounded-xl font-bold hover:bg-neutral-100 transition flex items-center justify-center gap-2 w-full border-dashed">
                    <Camera className="w-5 h-5 text-neutral-500" /> 
                    {endJobData.truckImage ? '📷 ' + endJobData.truckImage : 'Fotoğraf Yükle (Zorunlu Değil)'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if(e.target.files && e.target.files[0]) {
                        setEndJobData({...endJobData, truckImage: e.target.files[0].name});
                      }
                    }} />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">Kamyonda Sorun Var Mı?</label>
                  <select required value={endJobData.truckStatus} onChange={(e) => setEndJobData({...endJobData, truckStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none bg-white transition font-medium">
                    <option value="Herhangi bir sorun yok">Herhangi bir sorun yok</option>
                    <option value="Kamyonda sorun var">Kamyonda sorun var</option>
                  </select>
                </div>

                {endJobData.truckStatus === 'Kamyonda sorun var' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-red-600 mb-2">Kamyondaki Sorunun Detayı</label>
                    <textarea required value={endJobData.truckIssueDetails} onChange={(e) => setEndJobData({...endJobData, truckIssueDetails: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-20 resize-none transition text-sm" placeholder="Araçta oluşan arıza, çizik vb. detayları yazın..." />
                  </div>
                )}

                <div className="border-t border-neutral-100 pt-4">
                  <label className="block text-sm font-bold text-black mb-2">Eşyada Herhangi Bir Hasar Oluştu mu?</label>
                  <select required value={endJobData.damageStatus} onChange={(e) => setEndJobData({...endJobData, damageStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none bg-white transition font-medium">
                    <option value="Hasarsız teslim edildi">Hasarsız teslim edildi</option>
                    <option value="Hasar oluştu">Hasar oluştu</option>
                  </select>
                </div>

                {endJobData.damageStatus === 'Hasar oluştu' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-red-600 mb-2">Hasar Detaylarını Yazın</label>
                    <textarea required value={endJobData.damageDetails} onChange={(e) => setEndJobData({...endJobData, damageDetails: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-20 resize-none transition text-sm" placeholder="Oluşan hasarın detaylarını, nerede ve nasıl olduğunu belirtin..." />
                  </div>
                )}

                <div className="border-t border-neutral-100 pt-4">
                  <label className="block text-sm font-bold text-black mb-2">Müşteri Memnun Kaldı Mı?</label>
                  <select required value={endJobData.customerSatisfaction} onChange={(e) => setEndJobData({...endJobData, customerSatisfaction: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none bg-white transition font-medium">
                    <option value="Yorum Yazdı .">Yorum Yazdı.</option>
                    <option value="Video Alındı.">Video Alındı.</option>
                    <option value="Yazı Alındı.">Yazı Alındı.</option>
                    <option value="Herhangi bir şey yapmadı.">Herhangi bir şey yapmadı.</option>
                  </select>
                </div>

                <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-xs font-medium text-green-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> 
                  Formu onayladığınızda iş başarıyla sonlandırılacak ve rapor yöneticilere iletilecektir.
                </div>

                <button type="submit" className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex justify-center items-center gap-2 shadow-lg shadow-green-600/20 mt-4">
                  <CheckCircle className="w-5 h-5" /> Formu Onayla ve İşi Bitir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* AI MÜŞTERİ MESAJI MODALI */}
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

      {/* GÖRSEL ÖNİZLEME MODALI */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
              <h3 className="font-bold text-lg">{viewingImage.title}</h3>
              <button onClick={() => setViewingImage(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="w-full aspect-video bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center mb-4 overflow-hidden relative shadow-inner">
                {/* Sahte görsel arka planı efekti */}
                <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")'}}></div>
                <Camera className="w-12 h-12 mb-3 text-neutral-300 z-10" />
                <p className="font-bold text-sm text-center px-4 z-10 text-neutral-500">Bulut Depolama Modülü</p>
                <p className="text-xs mt-1 text-center px-4 z-10 text-neutral-400 font-medium">Demo ortamında gerçek dosya sistemi aktif değildir.</p>
                <p className="text-sm mt-4 font-black text-black z-10 bg-white px-4 py-2 rounded-lg shadow-sm border border-neutral-200">{viewingImage.name}</p>
              </div>
              <button onClick={() => setViewingImage(null)} className="w-full py-4 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl transition shadow-lg">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Görev Ekleme Modalı */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
              <h3 className="font-bold text-lg">Yeni Görev Oluştur</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleAddTask} className="p-6 space-y-4">
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

              <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
                <PlusCircle className="w-5 h-5" /> Görevi Ekle
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Görev Düzenleme Modalı (Kanban Panosu İçin) */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
              <h3 className="font-bold text-lg">Görevi Düzenle</h3>
              <button onClick={() => setEditingTask(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!firebaseUser) return;
              updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', editingTask.id), editingTask)
                .then(() => setEditingTask(null))
                .catch(console.error);
            }} className="p-6 space-y-4">
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

              <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
                <CheckCircle className="w-5 h-5" /> Değişiklikleri Kaydet
              </button>
            </form>
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
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </div>
  );
}