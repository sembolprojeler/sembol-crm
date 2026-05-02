import React, { useState, useEffect } from 'react';
import { 
  Truck, Calendar, MapPin, Phone, FileText, 
  CheckCircle, Clock, PlusCircle, ClipboardList, 
  Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Briefcase, Car, Wallet, CheckSquare, Shield, GripVertical, Activity,
  ArrowUpRight, ArrowDownRight, Landmark, CreditCard, DollarSign, ArrowRightLeft, ArrowUpDown,
  UserPlus, Camera, Upload, Edit, Ban, LogOut, Lock, Mail, Bell, User, Sparkles, Loader2, Copy, MessageSquareText,
  MessageCircle, Send
} from 'lucide-react';

// --- FIREBASE BAĞLANTISI ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc, deleteDoc, setDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8ofu_2rZwJeHWftmr6STilgF_qjO3LVI",
  authDomain: "sembol-operasyon-merkezi.firebaseapp.com",
  projectId: "sembol-operasyon-merkezi",
  storageBucket: "sembol-operasyon-merkezi.firebasestorage.app",
  messagingSenderId: "1054049299174",
  appId: "1:1054049299174:web:2193f916a3501543d92927"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ----------------------------
// TÜRKİYE İL VE İLÇE VERİTABANI
const TURKEY_LOCATIONS = {
  "İstanbul (Avrupa)": ["Arnavutköy", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kâğıthane", "Küçükçekmece", "Sarıyer", "Silivri", "Sultangazi", "Şişli", "Zeytinburnu"],
  "İstanbul (Anadolu)": ["Adalar", "Ataşehir", "Beykoz", "Çekmeköy", "Kadıköy", "Kartal", "Maltepe", "Pendik", "Sancaktepe", "Sultanbeyli", "Şile", "Tuzla", "Ümraniye", "Üsküdar"],
  "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  "Adıyaman": ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kâhta", "Merkez", "Samsat", "Sincik", "Tut"],
  "Afyonkarahisar": ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"],
  "Ağrı": ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"],
  "Aksaray": ["Ağaçören", "Eskil", "Gülağaç", "Güzelyurt", "Merkez", "Ortaköy", "Sarıyahşi", "Sultanhanı"],
  "Amasya": ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"],
  "Antalya": ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
  "Ardahan": ["Çıldır", "Damal", "Göle", "Hanak", "Merkez", "Posof"],
  "Artvin": ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Kemalpaşa", "Merkez", "Murgul", "Şavşat", "Yusufeli"],
  "Aydın": ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
  "Balıkesir": ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
  "Bartın": ["Amasra", "Kurucaşile", "Merkez", "Ulus"],
  "Batman": ["Beşiri", "Gercüş", "Hasankeyf", "Kozluk", "Merkez", "Sason"],
  "Bayburt": ["Aydıntepe", "Demirözü", "Merkez"],
  "Bilecik": ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"],
  "Bingöl": ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"],
  "Bitlis": ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"],
  "Bolu": ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"],
  "Burdur": ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"],
  "Bursa": ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"],
  "Çanakkale": ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"],
  "Çankırı": ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"],
  "Çorum": ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"],
  "Denizli": ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"],
  "Diyarbakır": ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"],
  "Düzce": ["Akçakoca", "Cumayeri", "Çilimli", "Gölyaka", "Gümüşova", "Kaynaşlı", "Merkez", "Yığılca"],
  "Edirne": ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"],
  "Elazığ": ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"],
  "Erzincan": ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Refahiye", "Tercan", "Üzümlü"],
  "Erzurum": ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"],
  "Eskişehir": ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
  "Gaziantep": ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"],
  "Giresun": ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"],
  "Gümüşhane": ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"],
  "Hakkari": ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"],
  "Hatay": ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"],
  "Iğdır": ["Aralık", "Karakoyunlu", "Merkez", "Tuzluca"],
  "Isparta": ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Senirkent", "Sütçüler", "Şarkikaraağaç", "Uluborlu", "Yalvaç", "Yenişarbademli"],
  "Kahramanmaraş": ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"],
  "Karabük": ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"],
  "Karaman": ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıveliler"],
  "Kars": ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"],
  "Kastamonu": ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
  "Kayseri": ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"],
  "Kırıkkale": ["Bahşılı", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"],
  "Kırklareli": ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"],
  "Kırşehir": ["Akçakent", "Akpınar", "Boztepe", "Çiçekdağı", "Kaman", "Merkez", "Mucur"],
  "Kilis": ["Elbeyli", "Musabeyli", "Polateli", "Merkez"],
  "Kocaeli": ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
  "Konya": ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
  "Kütahya": ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "Merkez", "Pazarlar", "Şaphane", "Simav", "Tavşanlı"],
  "Malatya": ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"],
  "Manisa": ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"],
  "Mardin": ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"],
  "Mersin": ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"],
  "Muğla": ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
  "Muş": ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"],
  "Nevşehir": ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"],
  "Niğde": ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"],
  "Ordu": ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"],
  "Osmaniye": ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"],
  "Rize": ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"],
  "Sakarya": ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
  "Samsun": ["19 Mayıs", "Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"],
  "Siirt": ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"],
  "Sinop": ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"],
  "Sivas": ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gölova", "Gürün", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara"],
  "Şanlıurfa": ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"],
  "Şırnak": ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"],
  "Tekirdağ": ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"],
  "Tokat": ["Almus", "Artova", "Başçiftlik", "Erbaa", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile", "Merkez"],
  "Trabzon": ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı", "Tonya", "Vakfıkebir", "Yomra"],
  "Tunceli": ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"],
  "Uşak": ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"],
  "Van": ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"],
  "Yalova": ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"],
  "Yozgat": ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Saraykent", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakılı", "Yerköy", "Merkez"],
  "Zonguldak": ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"]
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
  const apiKey = "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

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
      if (!response.ok) throw new Error('API Error');
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

// --- DIŞARI ÇIKARTILAN BİLEŞENLER ---

const DashboardView = ({ jobs }) => (
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
        <p className="text-sm text-neutral-500">Bugünkü ve yaklaşan işlerinizi görmek için sol menüden sekmeleri kullanabilirsiniz.</p>
    </div>
  </div>
);

const AddJobView = ({
  type, formData, setFormData, handleInputChange, handleProvinceChange,
  handleDepoChange, toggleDepoDirection, handleAddJob, editingJobId,
  showSecondFromAddress, setShowSecondFromAddress, showSecondToAddress, setShowSecondToAddress
}) => {
  const [aiText, setAiText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAIFill = async () => {
    if(!aiText.trim()) return;
    setIsAiLoading(true);
    try {
      const prompt = `Nakliyat müşterisinden gelen mesajdan kayıt formu bilgilerini çıkar:
      Mesaj: "${aiText}"
      Bulabildiklerini doldur, bulamadıklarını boş bırak. summaryNotes kısmına detayları özetle.
      Sadece JSON döndür.`;
      
      const res = await callGeminiAPI(prompt, true);
      const data = JSON.parse(res);
      
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
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <PlusCircle className="w-7 h-7 text-red-600" /> 
        {editingJobId ? `Detaylı ${type} Kaydını Güncelle` : `Detaylı ${type} Kaydı Oluştur`}
      </h2>

      {/* YAPAY ZEKA ASİSTANI */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-5 rounded-2xl border border-purple-100 mb-6 shadow-inner">
        <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" /> ✨ Yapay Zeka ile Hızlı Doldur
        </h3>
        <p className="text-sm text-purple-800 mb-3">Müşterinin WhatsApp mesajını veya dağınık notlarınızı buraya yapıştırın, formu otomatik dolduralım.</p>
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
      </div>

      <form onSubmit={handleAddJob} className="space-y-6">
        {/* MÜŞTERİ BİLGİLERİ */}
        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
          <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Users className="w-5 h-5 text-red-600" /> Müşteri Bilgileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Müşteri Adı Soyadı *</label>
              <input required type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Telefon 1 *</label>
              <input required type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
          </div>
        </div>

        {/* ALINACAK ADRES BASİTLEŞTİRİLMİŞ */}
        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
           <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
             <MapPin className="w-5 h-5 text-red-600" /> Alınacak Adres
           </h3>
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
              <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres *</label>
              <textarea required name="fromAddress" value={formData.fromAddress} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-16 resize-none" />
           </div>
        </div>

        {/* GİDECEK ADRES BASİTLEŞTİRİLMİŞ */}
        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
           <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
             <MapPin className="w-5 h-5 text-red-600" /> Gidecek Adres
           </h3>
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
              <label className="block text-sm font-bold text-neutral-700 mb-1">Açık Adres *</label>
              <textarea required name="toAddress" value={formData.toAddress} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-16 resize-none" />
           </div>
        </div>

        {/* FİNANS & TARİH */}
        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
          <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Wallet className="w-5 h-5 text-red-600" /> Tarih ve Finans Bilgileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Taşıma Tarihi *</label>
              <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Anlaşılan Fiyat (TL)</label>
              <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Alınan Kapora (TL)</label>
              <input type="number" name="deposit" value={formData.deposit} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold text-green-600" />
            </div>
          </div>
        </div>

        {/* SÖZLEŞME VE NOTLAR */}
        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
          <h3 className="font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <FileText className="w-5 h-5 text-red-600" /> Sözleşme ve Operasyon Notları
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Sözleşme Detayı</label>
              <textarea name="contractDetails" value={formData.contractDetails || ''} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-24 resize-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Operasyon Notları</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-24 resize-none transition" />
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

const CurrentJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage }) => {
  const [viewDate, setViewDate] = useState(new Date());

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
  const dailyJobs = jobs.filter(j => j.date === dateStr);

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
            <p className="text-lg font-medium">Bu tarihe kayıtlı herhangi bir operasyon bulunmuyor.</p>
          </div>
        ) : (
          dailyJobs.map(job => (
            <div key={job.id} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row gap-6 justify-between hover:border-red-600 transition group cursor-pointer">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-black text-xl text-black">{job.customerName}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase tracking-wider ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                    {job.type || 'Nakliye'}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                    job.status === 'completed' ? 'bg-black text-white' :
                    job.status === 'in-progress' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' :
                    'bg-neutral-100 text-neutral-700'
                  }`}>
                    {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
                  </span>
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
                  
                  <span className="flex items-center gap-1.5 text-sm font-bold bg-neutral-100 text-neutral-500 px-3 py-1.5 rounded-lg border border-neutral-200">
                    <UserPlus className="w-4 h-4" /> Kayıt: {job.createdBy || 'Sistem'}
                  </span>
                </div>
                
                <div className="text-sm text-neutral-600 flex flex-col gap-2 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                  <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" /> <div><b className="text-black">Nereden Alınacak:</b> {job.fromProvince}/{job.fromDistrict} - {job.fromAddress}</div></div>
                  <div className="flex items-start gap-2 mt-2"><MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> <div><b className="text-black">Nereye Gidecek:</b> {job.toProvince}/{job.toDistrict} - {job.toAddress}</div></div>
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
                       {job.endJobDetails.truckImage && <p className="md:col-span-2 text-green-700"><b>Kasa Fotoğrafı:</b> 📷 Sisteme Yüklendi ({job.endJobDetails.truckImage})</p>}
                       {job.endJobDetails.damageDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Hasar Detayı:</b> {job.endJobDetails.damageDetails}</p>}
                       {job.endJobDetails.truckIssueDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Kamyon Sorunu:</b> {job.endJobDetails.truckIssueDetails}</p>}
                     </div>
                  </div>
                )}
                
                {/* YENİ İŞLEM BUTONLARI */}
                <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-2">
                  <button onClick={() => handleEditJob(job)} className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                    <Edit className="w-4 h-4"/> Bilgileri Düzenle
                  </button>
                  <button onClick={() => handleOpenAssignModal(job)} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4"/> {job.team !== 'Atanmadı' ? 'Görevlendirmeyi Düzenle' : 'Görev Ata'}
                  </button>
                  <button onClick={() => handleGenerateMessage(job)} className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4"/> Müşteri Mesajı
                  </button>
                  <button className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                    <Ban className="w-4 h-4"/> İşi İptal Et
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

const AllJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage }) => {
  const [sortOrder, setSortOrder] = useState('newest');
  
  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.date) - new Date(a.date);
    return new Date(a.date) - new Date(b.date);
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
        <h2 className="text-xl font-bold text-black flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-red-600" /> Tüm İşler Listesi
        </h2>
        <div className="flex items-center gap-2 bg-neutral-50 p-1.5 rounded-xl border border-neutral-200">
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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-black text-white border-b border-neutral-200">
            <tr>
              <th className="p-4 font-bold rounded-tl-xl">Tarih</th>
              <th className="p-4 font-bold">Müşteri Bilgisi</th>
              <th className="p-4 font-bold">Operasyon Güzergahı</th>
              <th className="p-4 font-bold">Durum</th>
              <th className="p-4 font-bold">Atanan Personel</th>
              <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedJobs.map(job => (
              <tr key={job.id} className="hover:bg-neutral-50 transition">
                <td className="p-4 font-bold text-black whitespace-nowrap">
                  <Clock className="w-4 h-4 inline mr-1 text-neutral-400"/> {job.date} <br/>
                  <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block">{job.time}</span><br/>
                  <span className="text-[10px] text-neutral-400 font-bold mt-1.5 flex items-center gap-1"><UserPlus className="w-3 h-3" /> Kayıt: {job.createdBy || 'Sistem'}</span>
                </td>
                <td className="p-4 font-bold text-neutral-800">{job.customerName}<br/><span className="text-xs font-medium text-neutral-500">{job.customerPhone}</span></td>
                <td className="p-4 text-neutral-600 text-xs min-w-[200px]">
                  <div className="mb-1"><span className="text-neutral-400 font-bold">AL:</span> {job.fromProvince}/{job.fromDistrict} - {job.fromAddress}</div>
                  {job.toProvince && <div className="mt-2 mb-1"><span className="text-neutral-400 font-bold">VR:</span> {job.toProvince}/{job.toDistrict} - {job.toAddress}</div>}
                </td>
                <td className="p-4">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase whitespace-nowrap ${
                    job.status === 'completed' ? 'bg-black text-white' :
                    job.status === 'in-progress' ? 'bg-red-600 text-white shadow-sm' :
                    'bg-neutral-200 text-neutral-700'
                  }`}>
                    {job.status === 'completed' ? 'Tamamlandı' : job.status === 'in-progress' ? 'Sürüyor' : 'Bekliyor'}
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
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEditJob(job)} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition" title="Bilgileri Düzenle">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenAssignModal(job)} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition" title={job.team !== 'Atanmadı' ? 'Görevlendirmeyi Düzenle' : 'Görev Ata'}>
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleGenerateMessage(job)} className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition" title="Müşteri Mesajı Oluştur">
                      <MessageSquareText className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition" title="İşi İptal Et">
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedJobs.length === 0 && (
              <tr>
                <td colSpan="6" className="p-6 text-center text-neutral-500">Kayıtlı iş bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
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

  const jobsByDate = jobs.reduce((acc, job) => {
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

  const getCapacityColor = (jobCount) => {
    if (jobCount === 0) return 'bg-white border-neutral-200 hover:bg-neutral-50';
    if (jobCount <= 2) return 'bg-neutral-50 border-neutral-300 hover:bg-neutral-100';
    if (jobCount <= 4) return 'bg-red-50 border-red-200 hover:bg-red-100';
    return 'bg-black border-black text-white hover:bg-neutral-900';
  };

  const getCapacityBadge = (jobCount) => {
    if (jobCount === 0) return <span className="text-xs text-neutral-400 font-medium">Boş</span>;
    if (jobCount <= 2) return <span className="text-xs text-black font-bold bg-neutral-200 px-2 py-0.5 rounded-full">{jobCount} İş (Müsait)</span>;
    if (jobCount <= 4) return <span className="text-xs text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded-full">{jobCount} İş (Yoğun)</span>;
    return <span className="text-xs text-white font-bold bg-neutral-800 px-2 py-0.5 rounded-full">{jobCount} İş (Dolu)</span>;
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
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border border-neutral-300"></div> Boş</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-neutral-300"></div> Müsait (1-2)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600"></div> Yoğun (3-4)</div>
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
        
        {days.map((item, index) => (
          <div 
            key={index} 
            onClick={() => item && setSelectedDate(item.date)}
            className={`min-h-[100px] p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between ${item ? getCapacityColor(item.jobs.length) : 'bg-transparent border-transparent'} ${item && selectedDate === item.date ? 'ring-2 ring-red-600 ring-offset-2' : ''}`}
          >
            {item && (
              <>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-lg font-bold ${item.date === today.toISOString().split('T')[0] ? 'bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : (item.jobs.length >= 5 ? 'text-white' : 'text-black')}`}>
                    {item.day}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1 items-start">
                  {getCapacityBadge(item.jobs.length)}
                  
                  {item.jobs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.jobs.map(job => (
                        <div key={job.id} title={`${job.customerName} - ${job.team} (${job.type || 'Nakliye'})`} className={`w-2.5 h-2.5 rounded-full ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}></div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
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
                <div key={job.id} className="p-4 bg-white border border-neutral-200 rounded-xl hover:border-red-600 transition shadow-sm flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-black text-base">{job.customerName}</span>
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
                    <div className="text-xs text-neutral-600 flex items-center gap-3 mb-2 font-medium">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${job.team === 'Atanmadı' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}><User className="w-3.5 h-3.5" /> {job.team}</span>
                      <span className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200"><Phone className="w-3.5 h-3.5" /> {job.customerPhone}</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                      <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" /> <div><b className="text-neutral-700">AL:</b> {job.fromProvince}/{job.fromDistrict} - {job.fromAddress}</div></div>
                      {job.toProvince && <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" /> <div><b className="text-neutral-700">VR:</b> {job.toProvince}/{job.toDistrict} - {job.toAddress}</div></div>}
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

const CustomerListView = ({ jobs, title = "Müşteri Listesi" }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
    <div className="flex justify-between items-center mb-6 border-b border-neutral-200 pb-4">
      <h2 className="text-xl font-bold text-black flex items-center gap-2">
        <Users className="w-6 h-6 text-red-600" /> {title}
      </h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-black text-white border-b border-neutral-200">
          <tr>
            <th className="p-4 font-bold rounded-tl-xl">Ad Soyad / Firma Ünvanı</th>
            <th className="p-4 font-bold">Müşteri Tipi</th>
            <th className="p-4 font-bold">İletişim Bilgileri</th>
            <th className="p-4 font-bold">TC / Vergi No</th>
            <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {jobs.map(job => (
            <tr key={job.id} className="hover:bg-neutral-50 transition">
              <td className="p-4 font-bold text-black whitespace-nowrap">{job.customerName}</td>
              <td className="p-4 font-bold text-neutral-800">
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${job.customerType === 'Kurumsal' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{job.customerType}</span>
              </td>
              <td className="p-4 text-neutral-600">
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {job.customerPhone}</div>
                {job.altPhone && <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400"><Phone className="w-3 h-3" /> {job.altPhone}</div>}
              </td>
              <td className="p-4 text-neutral-600">
                {job.customerType === 'Kurumsal' ? <span className="text-xs">VN: {job.taxNo}</span> : <span className="text-xs">TC: {job.tcNo || 'Belirtilmedi'}</span>}
              </td>
              <td className="p-4">
                <button className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition" title="Detayları Gör">
                  <User className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan="5" className="p-6 text-center text-neutral-500">Müşteri kaydı bulunamadı.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// --- YENİ EKLENEN PROFİL VE MESAJLAŞMA BİLEŞENİ ---
const ProfileView = ({ currentUser, jobs, notifications, markNotificationsAsRead, personnelList, messages, setMessages, handleOpenEndJobModal }) => {
  const [activeProfileTab, setActiveProfileTab] = useState('jobs'); // 'jobs' | 'messages'
  const [activeChatUserId, setActiveChatUserId] = useState(null);
  const [newMessage, setNewMessage] = useState('');

  const myJobs = jobs.filter(j => j.assignedPersonnelIds?.includes(currentUser.id) || j.assignedPersonnelId === currentUser.id);
  const myNotifications = notifications.filter(n => n.userId === currentUser.id);

  // Profil sekmesi açıldığında bildirimleri okundu olarak işaretle
  React.useEffect(() => {
    markNotificationsAsRead(currentUser.id);
  }, [currentUser.id]);

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
                    <div key={job.id} className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 hover:border-red-400 transition group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-black">{job.customerName}</span>
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
                        <span className="flex items-center gap-1.5 font-bold bg-white text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-200"><Phone className="w-3.5 h-3.5" /> {job.customerPhone}</span>
                        
                        {(job.teamNames || (job.team && job.team !== 'Atanmadı' ? [job.team] : [])).length > 0 && (
                           <div className="flex flex-wrap gap-1.5">
                             {(job.teamNames || [job.team]).map((name, i) => (
                                <span key={i} className="flex items-center gap-1 font-bold bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg border border-blue-100">
                                  <User className="w-3.5 h-3.5" /> {name}
                                </span>
                             ))}
                           </div>
                        )}

                        <span className="flex items-center gap-1 font-bold bg-neutral-100 text-neutral-500 px-2 py-1.5 rounded-lg border border-neutral-200">
                          <UserPlus className="w-3.5 h-3.5" /> Kayıt: {job.createdBy || 'Sistem'}
                        </span>
                      </div>

                      <div className="text-sm text-neutral-600 space-y-2 bg-white p-4 rounded-xl border border-neutral-100">
                        <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" /> <div><b className="text-black">AL:</b> {job.fromProvince}/{job.fromDistrict} - {job.fromAddress}</div></div>
                        {job.toProvince && <div className="flex items-start gap-2 mt-2 pt-2 border-t border-neutral-100"><MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> <div><b className="text-black">VR:</b> {job.toProvince}/{job.toDistrict} - {job.toAddress}</div></div>}
                      </div>

                      {job.notes && (
                        <div className="mt-4 text-xs font-medium bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 flex items-start gap-2">
                          <FileText className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" /> {job.notes}
                        </div>
                      )}

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
                             {job.endJobDetails.truckImage && <p className="md:col-span-2 text-green-700"><b>Kasa Fotoğrafı:</b> 📷 Sisteme Yüklendi ({job.endJobDetails.truckImage})</p>}
                             {job.endJobDetails.damageDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Hasar Detayı:</b> {job.endJobDetails.damageDetails}</p>}
                             {job.endJobDetails.truckIssueDetails && <p className="md:col-span-2 text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100"><b>Kamyon Sorunu:</b> {job.endJobDetails.truckIssueDetails}</p>}
                           </div>
                        </div>
                      )}

                      {/* İŞİ SONLANDIR BUTONU */}
                      {job.status !== 'completed' && (
                        <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-end">
                          <button
                            onClick={() => handleOpenEndJobModal(job)}
                            className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-600/20"
                          >
                            <CheckCircle className="w-4 h-4" /> İşi Sonlandır
                          </button>
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
                <div className="w-1/3 bg-neutral-50 border-r border-neutral-200 overflow-y-auto custom-scrollbar">
                  {personnelList.filter(p => p.id !== currentUser.id).map(user => {
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
          </div>
        </div>

      </div>
    </div>
  );
};

const FinanceDashboardView = ({ transactions, setActiveTab }) => {
  const getBalance = (accountType) => {
    return transactions.filter(t => t.account === accountType).reduce((acc, curr) => {
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);
  };

  const cashBalance = getBalance('cash');
  const bankBalance = getBalance('bank');
  const ccBalance = getBalance('credit-card');
  const totalBalance = cashBalance + bankBalance + ccBalance;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
        <h2 className="text-2xl font-bold text-black flex items-center gap-2">
          <Wallet className="w-7 h-7 text-red-600" /> Cari Kasa Özeti
        </h2>
        <div className="bg-black text-white px-5 py-3 rounded-2xl text-xl font-black shadow-lg flex items-center gap-2">
          Toplam Bakiye: <span className="text-green-400">₺{totalBalance.toLocaleString('tr-TR')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4 hover:border-red-600 transition group cursor-pointer">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition"><DollarSign className="w-6 h-6" /></div>
          <div>
            <p className="text-neutral-500 text-sm font-bold mb-0.5">Nakit Kasa</p>
            <p className="text-xl font-black text-black">₺{cashBalance.toLocaleString('tr-TR')}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4 hover:border-red-600 transition group cursor-pointer">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition"><Landmark className="w-6 h-6" /></div>
          <div>
            <p className="text-neutral-500 text-sm font-bold mb-0.5">Banka Hesapları</p>
            <p className="text-xl font-black text-black">₺{bankBalance.toLocaleString('tr-TR')}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4 hover:border-red-600 transition group cursor-pointer">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition"><CreditCard className="w-6 h-6" /></div>
          <div>
            <p className="text-neutral-500 text-sm font-bold mb-0.5">Kredi Kartları</p>
            <p className="text-xl font-black text-black">₺{ccBalance.toLocaleString('tr-TR')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
          <h3 className="font-bold text-black flex items-center gap-2">Son Kasa Hareketleri</h3>
          <button onClick={() => setActiveTab('addTransaction')} className="text-sm font-bold text-red-600 hover:text-red-700 flex items-center gap-1">+ Yeni İşlem</button>
        </div>
        <div className="divide-y divide-neutral-100">
          {transactions.map(tx => (
            <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl shadow-sm ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {tx.type === 'income' ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                </div>
                <div>
                  <p className="font-bold text-black text-base">{tx.category}</p>
                  <p className="text-xs font-medium text-neutral-500 mt-0.5">{tx.description} • {tx.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-black ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '-'}₺{tx.amount.toLocaleString('tr-TR')}
                </p>
                <p className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md inline-block mt-1">
                  {tx.account === 'cash' ? 'NAKİT KASA' : tx.account === 'bank' ? 'BANKA HESABI' : 'KREDİ KARTI'}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="p-8 text-center text-neutral-500 font-medium">Henüz bir kasa hareketi bulunmuyor.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const AddTransactionView = ({ transactionType, setTransactionType, newTransaction, setNewTransaction, handleAddTransaction }) => (
  <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
    <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
      <Wallet className="w-6 h-6 text-red-600" /> Para Ekle / Çıkar
    </h2>
    
    <div className="flex bg-neutral-100 p-1.5 rounded-2xl mb-6">
      <button 
        type="button"
        onClick={() => { setTransactionType('income'); setNewTransaction({...newTransaction, category: 'Nakliye Tahsilatı'}); }}
        className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex justify-center items-center gap-2 ${transactionType === 'income' ? 'bg-green-600 text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}
      >
        <ArrowDownRight className="w-4 h-4" /> Gelir Ekle (Tahsilat)
      </button>
      <button 
        type="button"
        onClick={() => { setTransactionType('expense'); setNewTransaction({...newTransaction, category: 'Maaş Ödemesi'}); }}
        className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex justify-center items-center gap-2 ${transactionType === 'expense' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}
      >
        <ArrowUpRight className="w-4 h-4" /> Gider Ekle (Ödeme)
      </button>
    </div>

    <form onSubmit={handleAddTransaction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">Tutar (TL)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">₺</span>
            <input required type="number" min="0" value={newTransaction.amount} onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})} className="w-full pl-8 pr-3 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition font-bold" placeholder="Örn: 5000" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-black mb-1">İşlem Tarihi</label>
          <input required type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-black mb-1">Kategori (Ne İşlemi?)</label>
          <select value={newTransaction.category} onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition font-medium">
            {transactionType === 'income' ? (
              <>
                <option value="Nakliye Tahsilatı">Nakliye Tahsilatı</option>
                <option value="Depo Kirası">Depo Kirası Geliri</option>
                <option value="Asansör Kiralama">Asansör Kiralama Geliri</option>
                <option value="Diğer Gelir">Diğer Gelir</option>
              </>
            ) : (
              <>
                <option value="Maaş Ödemesi">Personel Maaş Ödemesi</option>
                <option value="Personel Avans">Personel Avans Ödemesi</option>
                <option value="Araç Gideri">Araç Bakım / Yakıt Gideri</option>
                <option value="Ofis Gideri">Ofis / Kira / Fatura Ödemesi</option>
                <option value="Malzeme Alımı">Ambalaj / Malzeme Alımı</option>
                <option value="Diğer Gider">Diğer Gider</option>
              </>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-black mb-1">Hangi Kasa/Hesap?</label>
          <select value={newTransaction.account} onChange={(e) => setNewTransaction({...newTransaction, account: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition font-medium">
            <option value="cash">Nakit Kasa (Ofis)</option>
            <option value="bank">Banka Hesabı</option>
            <option value="credit-card">Kredi Kartı</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-black mb-1">Açıklama / Not</label>
        <textarea required value={newTransaction.description} onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none h-20 resize-none transition" placeholder={transactionType === 'income' ? "Örn: Ayşe Hanım nakliye kalan ödemesi..." : "Örn: Şenol Ustaya haftalık avans verildi..."} />
      </div>

      <button type="submit" className={`w-full py-4 text-white font-bold rounded-xl transition flex justify-center items-center gap-2 shadow-lg mt-4 ${transactionType === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}>
        <PlusCircle className="w-5 h-5" /> 
        {transactionType === 'income' ? 'Geliri Kasaya Ekle' : 'Gideri Kasadan Düş'}
      </button>
    </form>
  </div>
);

const AddTaskFormView = ({ newTask, setNewTask, handleAddTask, personnelList }) => (
  <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
    <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
      <CheckSquare className="w-6 h-6 text-red-600" /> Yeni Görev Ekle
    </h2>
    <form onSubmit={handleAddTask} className="space-y-4">
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
);

const TaskManagerView = ({ tasks, setTasks, setShowTaskModal, draggingTask, setDraggingTask, openEditTask }) => {
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
      setTasks(tasks.map(t => t.id === draggingTask ? { ...t, status } : t));
      setDraggingTask(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
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

const PersonnelListView = ({ personnelList, onUpdate, positions = [], ranks = [] }) => {
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
        <Briefcase className="w-6 h-6 text-red-600" /> Mevcut Personel Listesi
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
                <td className="p-4 font-bold text-black">{p.fullName}</td>
                <td className="p-4 text-neutral-600">{p.email}</td>
                <td className="p-4 text-neutral-600">{p.password}</td>
                <td className="p-4 flex gap-2">
                  <button onClick={() => openEdit(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"><Edit className="w-4 h-4"/></button>
                  <button onClick={() => setDeletingUserId(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><Ban className="w-4 h-4"/></button>
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
          <div className="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4">
            S
          </div>
          <h1 className="text-2xl font-black text-black tracking-widest">SEMBOL</h1>
          <p className="text-red-600 text-xs font-bold mt-1 tracking-[0.2em]">OPERASYON MERKEZİ</p>
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

// --- ANA UYGULAMA (APP) ---
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [isVehicleSubMenuOpen, setIsVehicleSubMenuOpen] = useState(false);
  const [isPersonnelSubMenuOpen, setIsPersonnelSubMenuOpen] = useState(false);
  const [isTaskSubMenuOpen, setIsTaskSubMenuOpen] = useState(false);
  const [isCustomerSubMenuOpen, setIsCustomerSubMenuOpen] = useState(false);
  const [isJobSubMenuOpen, setIsJobSubMenuOpen] = useState(false);
  const [isAuthSubMenuOpen, setIsAuthSubMenuOpen] = useState(false);
  const [isFinanceSubMenuOpen, setIsFinanceSubMenuOpen] = useState(false);
  const [recordType, setRecordType] = useState('Nakliye');
  const [transactionType, setTransactionType] = useState('income');
  const [editingJobId, setEditingJobId] = useState(null); 

  const [showSecondFromAddress, setShowSecondFromAddress] = useState(false);
  const [showSecondToAddress, setShowSecondToAddress] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [jobToAssign, setJobToAssign] = useState(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [additionalAssignees, setAdditionalAssignees] = useState([]);
  const [manualExtraAssignees, setManualExtraAssignees] = useState([]);
  
  // Personel İşi Sonlandırma State'i
  const [showEndJobModal, setShowEndJobModal] = useState(false);
  const [jobToEnd, setJobToEnd] = useState(null);
  const [endJobData, setEndJobData] = useState({ 
    paymentMethod: 'Nakit', 
    damageStatus: 'Hasarsız teslim edildi', 
    damageDetails: '',
    truckImage: '',
    truckStatus: 'Herhangi bir sorun yok',
    truckIssueDetails: '',
    customerSatisfaction: 'Herhangi bir şey yapmadı.'
  });

  const [aiMessageModal, setAiMessageModal] = useState({ isOpen: false, loading: false, content: '', job: null });

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('sembol_notifications');
    if (saved) return JSON.parse(saved);
    return [];
  });

  React.useEffect(() => {
    localStorage.setItem('sembol_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('sembol_messages');
    if (saved) return JSON.parse(saved);
    return [];
  });

  React.useEffect(() => {
    localStorage.setItem('sembol_messages', JSON.stringify(messages));
  }, [messages]);

  const [transactions, setTransactions] = useState([
    { id: 1, type: 'income', category: 'Nakliye Tahsilatı', amount: 25000, account: 'bank', date: '2026-04-20', description: 'Ayşe Yılmaz Peşinat' },
    { id: 2, type: 'expense', category: 'Maaş Ödemesi', amount: 12500, account: 'cash', date: '2026-04-21', description: 'Şenol Usta Avans' },
    { id: 3, type: 'expense', category: 'Araç Gideri', amount: 3200, account: 'credit-card', date: '2026-04-22', description: '34 SBL 01 Yakıt' }
  ]);
  const [newTransaction, setNewTransaction] = useState({ amount: '', category: 'Nakliye Tahsilatı', account: 'cash', date: new Date().toISOString().split('T')[0], description: '' });

  const [positions, setPositions] = useState(() => {
    const saved = localStorage.getItem('sembol_positions');
    if (saved) return JSON.parse(saved);
    return [
      'Şoför', 'Taşıyıcı / Eleman', 'Marangoz / Mobilyacı', 
      'Tesisatçı', 'Ambalaj / Paketleme Görevlisi', 
      'Asansör Operatörü', 'Ofis Çalışanı / Yönetici'
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('sembol_positions', JSON.stringify(positions));
  }, [positions]);

  const handleAddPosition = (newPos) => { setPositions([...positions, newPos]); };
  const handleDeletePosition = (posToDelete) => { setPositions(positions.filter(p => p !== posToDelete)); };

  const [ranks, setRanks] = useState(() => {
    const saved = localStorage.getItem('sembol_ranks');
    if (saved) return JSON.parse(saved);
    return [
      'Ekip Şefi (Formen)', 'Usta', 'Kalfa', 
      'Standart Eleman', 'Çırak / Yeni Başlayan'
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('sembol_ranks', JSON.stringify(ranks));
  }, [ranks]);

  const handleAddRank = (newRank) => { setRanks([...ranks, newRank]); };
  const handleDeleteRank = (rankToDelete) => { setRanks(ranks.filter(r => r !== rankToDelete)); };

  const [personnelList, setPersonnelList] = useState(() => {
    const saved = localStorage.getItem('sembol_personnelList_v3');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, fullName: 'Mustafa Beşinci', tcNo: '11111111111', birthDate: '1980-01-01', companyPhone: '05320000000', personalPhone: '05320000000', position: 'Ofis Çalışanı / Yönetici', rank: 'Ekip Şefi (Formen)', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'mustafa', password: 'mustafa', permissions: { canView: true, canEdit: true } },
      { id: 2, fullName: 'Şenol Usta', tcNo: '12345678901', birthDate: '1985-05-15', companyPhone: '05551112233', personalPhone: '05321112233', position: 'Şoför', rank: 'Ekip Şefi (Formen)', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'senol@sembolnakliyat.com', password: 'pass.senol123', permissions: { canView: true, canEdit: true } },
      { id: 3, fullName: 'Mustafa Demir', tcNo: '98765432109', birthDate: '1990-08-22', companyPhone: '', personalPhone: '05441112233', position: 'Taşıyıcı / Eleman', rank: 'Usta', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'mustafa@sembolnakliyat.com', password: 'pass.mustafa123', permissions: { canView: true, canEdit: false } },
      { id: 4, fullName: 'Ahmet Öztürk', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'ahmet.ozturk@sembolnakliyat.com', password: 'pass.ahmet123', permissions: { canView: true, canEdit: false } },
      { id: 5, fullName: 'Azat Allakulyyev', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'azat.allakulyyev@sembolnakliyat.com', password: 'pass.azat123', permissions: { canView: true, canEdit: false } },
      { id: 6, fullName: 'Atamurad Razakulov', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'atamurad.razakulov@sembolnakliyat.com', password: 'pass.atamurad123', permissions: { canView: true, canEdit: false } },
      { id: 7, fullName: 'Batuhan Bagana', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'batuhan.bagana@sembolnakliyat.com', password: 'pass.batuhan123', permissions: { canView: true, canEdit: false } },
      { id: 8, fullName: 'Berdimyrat Artykov', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'berdimyrat.artykov@sembolnakliyat.com', password: 'pass.berdimyrat123', permissions: { canView: true, canEdit: false } },
      { id: 9, fullName: 'Berna Çelik', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Ofis Çalışanı / Yönetici', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'berna.celik@sembolnakliyat.com', password: 'pass.berna123', permissions: { canView: true, canEdit: false } },
      { id: 10, fullName: 'Cengiz Çakar', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'cengiz.cakar@sembolnakliyat.com', password: 'pass.cengiz123', permissions: { canView: true, canEdit: false } },
      { id: 11, fullName: 'Erkan Kurt', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'erkan.kurt@sembolnakliyat.com', password: 'pass.erkan123', permissions: { canView: true, canEdit: false } },
      { id: 12, fullName: 'Ferhat Arslan', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'ferhat.arslan@sembolnakliyat.com', password: 'pass.ferhat123', permissions: { canView: true, canEdit: false } },
      { id: 13, fullName: 'Fatma Koçak', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Ofis Çalışanı / Yönetici', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'fatma.kocak@sembolnakliyat.com', password: 'pass.fatma123', permissions: { canView: true, canEdit: false } },
      { id: 14, fullName: 'Kamil Kılınç', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'kamil.kilinc@sembolnakliyat.com', password: 'pass.kamil123', permissions: { canView: true, canEdit: false } },
      { id: 15, fullName: 'Korhan Taşkaya', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'korhan.taskaya@sembolnakliyat.com', password: 'pass.korhan123', permissions: { canView: true, canEdit: false } },
      { id: 16, fullName: 'Mehmet Şen', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'mehmet.sen@sembolnakliyat.com', password: 'pass.mehmet123', permissions: { canView: true, canEdit: false } },
      { id: 17, fullName: 'Mesut İnan', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'mesut.inan@sembolnakliyat.com', password: 'pass.mesut123', permissions: { canView: true, canEdit: false } },
      { id: 18, fullName: 'Muhammet Gök', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'muhammet.gok@sembolnakliyat.com', password: 'pass.muhammet123', permissions: { canView: true, canEdit: false } },
      { id: 19, fullName: 'Oğuzhan Çakır', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'oguzhan.cakir@sembolnakliyat.com', password: 'pass.oguzhan123', permissions: { canView: true, canEdit: false } },
      { id: 20, fullName: 'Ömer Akmeşe', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'omer.akmese@sembolnakliyat.com', password: 'pass.omer123', permissions: { canView: true, canEdit: false } },
      { id: 21, fullName: 'Ömer Yıldız', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'omer.yildiz@sembolnakliyat.com', password: 'pass.omer1234', permissions: { canView: true, canEdit: false } },
      { id: 22, fullName: 'Oğuzhan Akbulut', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'oguzhan.akbulut@sembolnakliyat.com', password: 'pass.oguzhan1234', permissions: { canView: true, canEdit: false } },
      { id: 23, fullName: 'Ruslan Muradov', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'ruslan.muradov@sembolnakliyat.com', password: 'pass.ruslan123', permissions: { canView: true, canEdit: false } },
      { id: 24, fullName: 'Sedat Uslu', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'sedat.uslu@sembolnakliyat.com', password: 'pass.sedat123', permissions: { canView: true, canEdit: false } },
      { id: 25, fullName: 'Vehbi Çirgin', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'vehbi.cirgin@sembolnakliyat.com', password: 'pass.vehbi123', permissions: { canView: true, canEdit: false } },
      { id: 26, fullName: 'Tayfur Akyüz', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'tayfur.akyuz@sembolnakliyat.com', password: 'pass.tayfur123', permissions: { canView: true, canEdit: false } },
      { id: 27, fullName: 'Ozan İbiş', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'ozan.ibis@sembolnakliyat.com', password: 'pass.ozan123', permissions: { canView: true, canEdit: false } },
      { id: 28, fullName: 'Rafet Tarakçı', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'rafet.tarakci@sembolnakliyat.com', password: 'pass.rafet123', permissions: { canView: true, canEdit: false } },
      { id: 29, fullName: 'Erdem Yaman', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: 'Taşıyıcı / Eleman', rank: 'Standart Eleman', safetyTraining: 'Eğitim Aldı (Geçerli)', email: 'erdem.yaman@sembolnakliyat.com', password: 'pass.erdem123', permissions: { canView: true, canEdit: false } }
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('sembol_personnelList_v3', JSON.stringify(personnelList));
  }, [personnelList]);

  React.useEffect(() => {
    try {
      const savedUser = localStorage.getItem('sembol_crm_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const user = personnelList.find(p => 
          (p.email === parsed.email || p.fullName.toLowerCase() === parsed.email?.toLowerCase()) && 
          p.password === parsed.password
        );
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      }
    } catch (e) {
      console.warn("Tarayıcı önbelleğine erişilemedi.");
    } finally {
      setIsAuthChecking(false);
    }
  }, []); 

  const handleAddPersonnel = (newPersonnel) => {
    setPersonnelList(prev => [{ ...newPersonnel, permissions: { canView: true, canEdit: false } }, ...prev]);
  };

  const handleUpdatePersonnel = (updatedUser) => {
    setPersonnelList(prev => prev.map(p => p.id === updatedUser.id ? updatedUser : p));
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      const savedUser = localStorage.getItem('sembol_crm_user');
      if (savedUser) {
        localStorage.setItem('sembol_crm_user', JSON.stringify({ email: updatedUser.email, password: updatedUser.password }));
      }
    }
  };

  const handleDeletePersonnel = (id) => {
    setPersonnelList(prev => prev.filter(p => p.id !== id));
    if (currentUser && currentUser.id === id) {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setActiveTab('dashboard');
      try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
    }
  };

  const handleUpdatePermissions = (id, permissionType, value) => {
    setPersonnelList(prev => prev.map(p =>
      p.id === id ? { ...p, permissions: { ...p.permissions, [permissionType]: value } } : p
    ));
  };

  const [tasks, setTasks] = useState([
    { id: '1', title: 'Yeni Araç Kredisi Başvurusu', description: 'Ziraat bankası ile görüşülecek ve evraklar teslim edilecek.', status: 'todo', assignee: 'Mustafa Beşinci', date: '2026-04-28' },
    { id: '2', title: 'Aylık Fatura Kesimleri', description: 'Nisan ayı faturaları e-arşiv portala girilecek.', status: 'in-progress', assignee: 'Muhasebe Departmanı', date: '2026-04-27' },
    { id: '3', title: 'Depo 4 İlaçlaması', description: 'Depo 4 için rutin haşere ilaçlaması yapıldı.', status: 'completed', assignee: 'Şenol Usta', date: '2026-04-25' }
  ]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggingTask, setDraggingTask] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: 'Mustafa Beşinci', date: new Date().toISOString().split('T')[0] });

  const [jobs, setJobs] = useState(() => {
    const saved = localStorage.getItem('sembol_jobs_v4');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 1, type: 'Nakliye', customerType: 'Bireysel', tcNo: '12345678901', taxNo: '', customerName: 'Ayşe Yılmaz', customerPhone: '05551234567',
        fromProvince: 'İstanbul (Anadolu)', fromDistrict: 'Kadıköy', fromAddress: 'Moda Cd. No:12', fromFloor: '3. Kat', fromElevator: 'Hayır', fromRoomCount: '3+1', fromDistance: '15', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Anadolu)', toDistrict: 'Ataşehir', toAddress: 'Atatürk Mh. No:45', toFloor: '5. Kat', toElevator: 'Evet', toRoomCount: '3+1', toDistance: '10', toDistanceUnit: 'Metre',
        date: new Date().toISOString().split('T')[0], time: '08:30', price: '25000', deposit: '5000',
        team: 'Şenol Usta', assignedPersonnelId: 2, assignedPersonnelIds: [2], teamNames: ['Şenol Usta'],
        contractDetails: 'Sözleşme PDF olarak Whatsapptan atıldı.', notes: 'Piyano var, dikkatli taşınacak.', status: 'in-progress', endJobDetails: null, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 2, type: 'Depo', customerType: 'Kurumsal', tcNo: '', taxNo: '9876543210', customerName: 'Demir Mimarlık A.Ş.', customerPhone: '05329876543',
        fromProvince: 'İstanbul (Avrupa)', fromDistrict: 'Beşiktaş', fromAddress: 'Levent Mah. Çiçek Sk. No:5', fromFloor: 'Giriş Kat', fromElevator: 'Hayır', fromRoomCount: 'Ofis / İşyeri', fromDistance: '5', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Anadolu)', toDistrict: 'Pendik', toAddress: 'Bahçelievler Mah. Yeni Sk. No: 5/A', toFloor: 'Giriş Kat', toElevator: 'Hayır', toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre',
        date: '2026-05-15', time: '10:00', price: '12000', deposit: '2000',
        team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [],
        contractDetails: 'Aylık 3000 TL depo kirası üzerinden anlaşıldı. İlk ay + taşıma peşin.', notes: 'Ofis mobilyaları ve arşiv dosyaları depolanacak.', status: 'pending', endJobDetails: null, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 3, type: 'Asansör', customerType: 'Bireysel', tcNo: '33344455566', taxNo: '', customerName: 'Kemal Sunal', customerPhone: '05443332211',
        fromProvince: 'Ankara', fromDistrict: 'Çankaya', fromAddress: 'Tunalı Hilmi Cad. No: 80', fromFloor: '8. Kat', fromElevator: 'Yükleme', fromRoomCount: 'Asansör', fromDistance: 'Tek Taraf', fromDistanceUnit: '',
        toProvince: '', toDistrict: '', toAddress: '', toFloor: '', toElevator: '', toRoomCount: '', toDistance: '', toDistanceUnit: '',
        date: '2026-04-20', time: '13:00', price: '4500', deposit: '1000',
        team: 'Mustafa Demir', assignedPersonnelId: 3, assignedPersonnelIds: [3], teamNames: ['Mustafa Demir'],
        contractDetails: 'Sadece dış cephe asansörü kurulum hizmeti.', notes: 'Balkon camı sökülecek.', status: 'completed',
        endJobDetails: { paymentMethod: 'Nakit', damageStatus: 'Hasarsız teslim edildi', damageDetails: '', truckImage: '', truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Yorum Yazdı .' }, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 4, type: 'Nakliye', customerType: 'Bireysel', tcNo: '22233344455', taxNo: '', customerName: 'Hasan Yılmaz', customerPhone: '05554443322',
        fromProvince: 'İzmir', fromDistrict: 'Bornova', fromAddress: 'Özkanlar Mah. 250 Sk. No: 12', fromFloor: '2. Kat', fromElevator: 'Bina Asansörü', fromRoomCount: '2+1', fromDistance: '20', fromDistanceUnit: 'Metre',
        toProvince: 'İzmir', toDistrict: 'Karşıyaka', toAddress: 'Bostanlı Mah. Cemal Gürsel Cad. No: 100', toFloor: '4. Kat', toElevator: 'Evet', toRoomCount: '2+1', toDistance: '15', toDistanceUnit: 'Metre',
        date: '2026-05-18', time: '09:00', price: '18000', deposit: '3000',
        team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [],
        contractDetails: 'Standart taşıma + paketleme.', notes: 'Sabah erken başlanması istendi.', status: 'pending', endJobDetails: null, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 5, type: 'Nakliye', customerType: 'Kurumsal', tcNo: '', taxNo: '1122334455', customerName: 'Vatan Bilgisayar (Şube Transferi)', customerPhone: '02125556677',
        fromProvince: 'İstanbul (Avrupa)', fromDistrict: 'Bakırköy', fromAddress: 'Cevizlik Mah. İstanbul Cad.', fromFloor: 'Giriş Kat', fromElevator: 'Hayır', fromRoomCount: 'Ofis / İşyeri', fromDistance: '5', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Avrupa)', toDistrict: 'Beylikdüzü', toAddress: 'Marmara Park AVM İçi', toFloor: '1. Kat', toElevator: 'Bina Asansörü', toRoomCount: 'Ofis / İşyeri', toDistance: '50', toDistanceUnit: 'Metre',
        date: new Date().toISOString().split('T')[0], time: '22:00', price: '40000', deposit: '0',
        team: 'Mustafa Beşinci, Şenol Usta', assignedPersonnelId: 1, assignedPersonnelIds: [1, 2], teamNames: ['Mustafa Beşinci', 'Şenol Usta'],
        contractDetails: 'Kurumsal fatura kesilecek. 30 gün vade.', notes: 'AVM kapanışından sonra gece çalışması yapılacak.', status: 'in-progress', endJobDetails: null, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 6, type: 'Depo', customerType: 'Bireysel', tcNo: '55566677788', taxNo: '', customerName: 'Zeynep Kaya', customerPhone: '05332221100',
        fromProvince: 'İstanbul (Anadolu)', fromDistrict: 'Kadıköy', fromAddress: 'Fenerbahçe Mah. Fener Kalamış Cad.', fromFloor: '5. Kat', fromElevator: 'Evet', fromRoomCount: 'Eşyaların Bir Kısmı', fromDistance: '10', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Anadolu)', toDistrict: 'Kartal', toAddress: 'Yalı Mah. Bağlar Cad. No: 74/2', toFloor: 'Giriş Kat', toElevator: 'Hayır', toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre',
        date: '2026-04-15', time: '11:00', price: '8500', deposit: '8500',
        team: 'Şenol Usta', assignedPersonnelId: 2, assignedPersonnelIds: [2], teamNames: ['Şenol Usta'],
        contractDetails: '6 aylık peşin ödeme alındı.', notes: 'Sadece yazlık eşyalar ve kışlık lastikler alındı.', status: 'completed',
        endJobDetails: { paymentMethod: 'Kredi Kartı', damageStatus: 'Hasarsız teslim edildi', damageDetails: '', truckImage: 'kasa_son_hali.jpg', truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Video Alındı.' }, createdBy: 'Berna Çelik'
      },
      {
        id: 7, type: 'Asansör', customerType: 'Kurumsal', tcNo: '', taxNo: '7778889990', customerName: 'ABC İnşaat A.Ş.', customerPhone: '05321110099',
        fromProvince: 'Bursa', fromDistrict: 'Nilüfer', fromAddress: 'Ataevler Mah. Yeni Site İnşaatı', fromFloor: '12. Kat', fromElevator: 'İnşaat', fromRoomCount: '', fromDistance: 'Tüm Gün', fromDistanceUnit: '',
        toProvince: '', toDistrict: '', toAddress: '', toFloor: '', toElevator: '', toRoomCount: '', toDistance: '', toDistanceUnit: '',
        date: '2026-05-22', time: '08:00', price: '15000', deposit: '5000',
        team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [],
        contractDetails: 'Günlük kiralama. Operatör dahil.', notes: 'İnşaat malzemesi (kapı, pencere) çekilecek.', status: 'pending', endJobDetails: null, createdBy: 'Fatma Koçak'
      },
      {
        id: 8, type: 'Nakliye', customerType: 'Bireysel', tcNo: '99988877766', taxNo: '', customerName: 'Elif Şahin', customerPhone: '05445556677',
        fromProvince: 'Antalya', fromDistrict: 'Muratpaşa', fromAddress: 'Lara Mah. Yalı Cad.', fromFloor: '3. Kat', fromElevator: 'Bina Asansörü', fromRoomCount: '1+1', fromDistance: '5', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Avrupa)', toDistrict: 'Sarıyer', toAddress: 'Maslak Mah. Dereboyu Cad.', toFloor: '7. Kat', toElevator: 'Evet', toRoomCount: '1+1', toDistance: '20', toDistanceUnit: 'Metre',
        date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0], time: '07:00', price: '35000', deposit: '10000',
        team: 'Mustafa Demir', assignedPersonnelId: 3, assignedPersonnelIds: [3], teamNames: ['Mustafa Demir'],
        contractDetails: 'Şehirlerarası nakliyat. Sigorta dahil.', notes: 'Müşteri 1 gün önceden eşyaların sarılmasını istedi.', status: 'in-progress', endJobDetails: null, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 9, type: 'Depo', customerType: 'Bireysel', tcNo: '11122233344', taxNo: '', customerName: 'Burak Yılmaz', customerPhone: '05334445566',
        fromProvince: 'İstanbul (Anadolu)', fromDistrict: 'Ümraniye', fromAddress: 'Dudullu OSB Mah. 1. Cad. No: 30/4', fromFloor: 'Giriş Kat', fromElevator: 'Hayır', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Anadolu)', toDistrict: 'Çekmeköy', toAddress: 'Mimar Sinan Mah. Orman Cad.', toFloor: 'Müstakil / Villa', toElevator: 'Hayır', toRoomCount: '4+1 ve Üzeri', toDistance: '10', toDistanceUnit: 'Metre',
        date: '2026-05-25', time: '14:00', price: '20000', deposit: '0',
        team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [],
        contractDetails: 'Depodan çıkış işlemi.', notes: '2 yıl depoda kalan eşyalar yeni villaya taşınacak.', status: 'pending', endJobDetails: null, createdBy: 'Mustafa Beşinci'
      },
      {
        id: 10, type: 'Nakliye', customerType: 'Kurumsal', tcNo: '', taxNo: '5554443332', customerName: 'MedicalPark Hastanesi', customerPhone: '02165554433',
        fromProvince: 'İstanbul (Anadolu)', fromDistrict: 'Göztepe', fromAddress: 'Hastane E Blok Deposu', fromFloor: 'Bodrum Kat', fromElevator: 'Bina Asansörü', fromRoomCount: 'Ofis / İşyeri', fromDistance: '30', fromDistanceUnit: 'Metre',
        toProvince: 'İstanbul (Anadolu)', toDistrict: 'Pendik', toAddress: 'Yeni Şube Binası', toFloor: 'Giriş Kat', toElevator: 'Hayır', toRoomCount: 'Ofis / İşyeri', toDistance: '15', toDistanceUnit: 'Metre',
        date: '2026-04-10', time: '20:00', price: '45000', deposit: '45000',
        team: 'Mustafa Beşinci, Şenol Usta, Mustafa Demir', assignedPersonnelId: 1, assignedPersonnelIds: [1, 2, 3], teamNames: ['Mustafa Beşinci', 'Şenol Usta', 'Mustafa Demir'],
        contractDetails: 'Tıbbi cihaz taşıması. Özel sigorta yapıldı.', notes: 'Hassas cihazlar var, havalı naylon ile 3 kat sarıldı.', status: 'completed',
        endJobDetails: { paymentMethod: 'İban', damageStatus: 'Hasarsız teslim edildi', damageDetails: '', truckImage: '', truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Yazı Alındı.' }, createdBy: 'Mustafa Beşinci'
      }
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('sembol_jobs_v4', JSON.stringify(jobs));
  }, [jobs]);

  const [formData, setFormData] = useState({
    customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo',
    fromProvince: '', fromDistrict: '', fromFloor: '', fromElevator: 'Hayır', fromRoomCount: '2+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '',
    fromProvince2: '', fromDistrict2: '', fromFloor2: '', fromElevator2: 'Hayır', fromRoomCount2: '1+0 / Parça Eşya', fromDistance2: '', fromDistanceUnit2: 'Metre', fromAddress2: '',
    selectedDepo: '', 
    toProvince: '', toDistrict: '', toFloor: '', toElevator: 'Hayır', toRoomCount: '2+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '',
    toProvince2: '', toDistrict2: '', toFloor2: '', toElevator2: 'Hayır', toRoomCount2: '1+0 / Parça Eşya', toDistance2: '', toDistanceUnit2: 'Metre', toAddress2: '',
    date: new Date().toISOString().split('T')[0], time: '08:00', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
// --- TEK SEFERLİK VERİ GÖÇÜ (MIGRATION) FONKSİYONU ---
  const handleMigrateToCloud = async () => {
    const onay = window.confirm("Dikkat: Tüm lokal verileriniz Google Bulut'a kopyalanacak. Onaylıyor musunuz?");
    if (!onay) return;

    try {
      // 1. Personelleri Buluta Yolla
      for (const person of personnelList) {
         await addDoc(collection(db, "personnel"), person);
      }
      
      // 2. Mevcut İşleri Buluta Yolla
      for (const job of jobs) {
         await addDoc(collection(db, "jobs"), job);
      }

      // 3. Kasa Hareketlerini Buluta Yolla
      for (const tx of transactions) {
         await addDoc(collection(db, "transactions"), tx);
      }

      alert("MUHTEŞEM! 🚀 Tüm verileriniz başarıyla Google Firebase'e yüklendi. Artık Firebase panelinden verilerinizi görebilirsiniz. Şimdi eski kodları silme işlemine geçebiliriz.");
    } catch (error) {
      console.error("Yükleme hatası:", error);
      alert("Bir hata oluştu: " + error.message);
    }
  };
  // -----------------------------------------------------
  const handleProvinceChange = (e, type) => {
    const province = e.target.value;
    let provKey, distKey;
    if (type === 'from') { provKey = 'fromProvince'; distKey = 'fromDistrict'; }
    else if (type === 'to') { provKey = 'toProvince'; distKey = 'toDistrict'; }
    else if (type === 'from2') { provKey = 'fromProvince2'; distKey = 'fromDistrict2'; }
    else if (type === 'to2') { provKey = 'toProvince2'; distKey = 'toDistrict2'; }

    setFormData({ ...formData, [provKey]: province, [distKey]: '' });
  };

  const toggleDepoDirection = () => {
    setFormData(prev => ({
      ...prev, depoDirection: prev.depoDirection === 'toDepo' ? 'fromDepo' : 'toDepo',
      fromProvince: prev.toProvince, fromDistrict: prev.toDistrict, fromFloor: prev.toFloor, fromElevator: prev.toElevator, fromRoomCount: prev.toRoomCount, fromDistance: prev.toDistance, fromDistanceUnit: prev.toDistanceUnit, fromAddress: prev.toAddress,
      toProvince: prev.fromProvince, toDistrict: prev.fromDistrict, toFloor: prev.fromFloor, toElevator: prev.fromElevator, toRoomCount: prev.fromRoomCount, toDistance: prev.fromDistance, toDistanceUnit: prev.fromDistanceUnit, toAddress: prev.fromAddress,
    }));
  };

  const handleDepoChange = (e) => {
    const depoName = e.target.value;
    const depo = DEPO_LOCATIONS.find(d => d.name === depoName);
    
    if (depo) {
      if (formData.depoDirection === 'fromDepo') {
        setFormData({
          ...formData, selectedDepo: depoName, fromProvince: depo.province, fromDistrict: depo.district, fromAddress: depo.address, fromFloor: 'Giriş Kat', fromElevator: 'Hayır', fromRoomCount: 'Depoevim Tesisleri', fromDistance: '0', fromDistanceUnit: 'Metre'
        });
      } else {
        setFormData({
          ...formData, selectedDepo: depoName, toProvince: depo.province, toDistrict: depo.district, toAddress: depo.address, toFloor: 'Giriş Kat', toElevator: 'Hayır', toRoomCount: 'Depoevim Tesisleri', toDistance: '0', toDistanceUnit: 'Metre'
        });
      }
    } else {
      if (formData.depoDirection === 'fromDepo') {
        setFormData({...formData, selectedDepo: '', fromProvince: '', fromDistrict: '', fromAddress: '', fromFloor: '', fromElevator: 'Hayır', fromRoomCount: '2+1', fromDistance: '', fromDistanceUnit: 'Metre'});
      } else {
        setFormData({...formData, selectedDepo: '', toProvince: '', toDistrict: '', toAddress: '', toFloor: '', toElevator: 'Hayır', toRoomCount: '2+1', toDistance: '', toDistanceUnit: 'Metre'});
      }
    }
  };

  const handleEditJob = (job) => {
    setEditingJobId(job.id);
    setRecordType(job.type || 'Nakliye');
    setFormData({ ...job });
    setShowSecondFromAddress(!!job.fromProvince2);
    setShowSecondToAddress(!!job.toProvince2);
    if (job.type === 'Nakliye') setActiveTab('addNakliye');
    else if (job.type === 'Depo') setActiveTab('addDepo');
    else if (job.type === 'Asansör') setActiveTab('addAsansor');
    else setActiveTab('addNakliye');
  };

  const handleAddJob = (e) => {
    e.preventDefault();
    if (editingJobId) {
      setJobs(jobs.map(j => j.id === editingJobId ? { ...j, ...formData, id: editingJobId } : j));
      setEditingJobId(null);
    } else {
      const newJob = { id: Date.now(), type: recordType, ...formData, team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [], status: 'pending', endJobDetails: null, createdBy: currentUser?.fullName || 'Sistem' };
      setJobs([newJob, ...jobs]);
    }
    
    setFormData({
      customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo',
      fromProvince: '', fromDistrict: '', fromFloor: '', fromElevator: 'Hayır', fromRoomCount: '2+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '',
      fromProvince2: '', fromDistrict2: '', fromFloor2: '', fromElevator2: 'Hayır', fromRoomCount2: '1+0 / Parça Eşya', fromDistance2: '', fromDistanceUnit2: 'Metre', fromAddress2: '',
      selectedDepo: '',
      toProvince: '', toDistrict: '', toFloor: '', toElevator: 'Hayır', toRoomCount: '2+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '',
      toProvince2: '', toDistrict2: '', toFloor2: '', toElevator2: 'Hayır', toRoomCount2: '1+0 / Parça Eşya', toDistance2: '', toDistanceUnit2: 'Metre', toAddress2: '',
      date: new Date().toISOString().split('T')[0], time: '08:00', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
    });
    setShowSecondFromAddress(false);
    setShowSecondToAddress(false);
    setActiveTab('dashboard');
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    const newTaskObj = { id: Date.now().toString(), ...newTask, status: 'todo' };
    setTasks([...tasks, newTaskObj]);
    setShowTaskModal(false);
    setNewTask({ title: '', description: '', assignee: personnelList.length > 0 ? personnelList[0].fullName : 'Yönetim', date: new Date().toISOString().split('T')[0] });
    setActiveTab('taskList');
  };

  const openEditTask = (task) => {
    setEditingTask(task);
  };

  const handleUpdateTask = (e) => {
    e.preventDefault();
    setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    const newTx = { id: Date.now(), type: transactionType, amount: parseFloat(newTransaction.amount), category: newTransaction.category, account: newTransaction.account, date: newTransaction.date, description: newTransaction.description };
    setTransactions([newTx, ...transactions]);
    setNewTransaction({ amount: '', category: transactionType === 'income' ? 'Nakliye Tahsilatı' : 'Maaş Ödemesi', account: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
    setActiveTab('financeDashboard');
  };

  const handleLogin = (email, password, rememberMe) => {
    const user = personnelList.find(p => 
      (p.email === email || p.fullName.toLowerCase() === email.toLowerCase()) && 
      p.password === password
    );
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      setLoginError('');
      if (rememberMe) {
        try { localStorage.setItem('sembol_crm_user', JSON.stringify({ email, password })); } catch (e) { }
      } else {
        try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
      }
    } else {
      setLoginError('Kullanıcı adı / E-posta veya şifre hatalı. Lütfen tekrar deneyin.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
    setIsSidebarOpen(false);
    try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
  };

  const handleOpenAssignModal = (job) => {
    setJobToAssign(job);
    setAssigneeId(job.assignedPersonnelId || '');
    setAdditionalAssignees(job.assignedPersonnelIds ? job.assignedPersonnelIds.filter(id => id !== job.assignedPersonnelId) : []);
    
    let manual = [];
    if (job.teamNames && job.teamNames.length > 0) {
       const systemNames = personnelList.filter(p => job.assignedPersonnelIds?.includes(p.id)).map(p => p.fullName);
       manual = job.teamNames.filter(name => !systemNames.includes(name));
    }
    setManualExtraAssignees(manual);
    setShowAssignModal(true);
  };

  const submitAssignJob = (e) => {
    e.preventDefault();
    if(!assigneeId) return;

    const mainPerson = personnelList.find(p => p.id === parseInt(assigneeId));
    if(!mainPerson) return;

    const additionalPersons = personnelList.filter(p => additionalAssignees.includes(p.id));
    const allAssignedIds = [mainPerson.id, ...additionalPersons.map(p => p.id)];
    
    const manualNames = manualExtraAssignees.map(n => n.trim()).filter(n => n !== '');
    
    const allNames = [mainPerson.fullName, ...additionalPersons.map(p => p.fullName), ...manualNames];

    setJobs(jobs.map(j => j.id === jobToAssign.id ? { 
      ...j, 
      assignedPersonnelId: mainPerson.id, 
      assignedPersonnelIds: allAssignedIds,
      teamNames: allNames,
      team: allNames.join(', '), 
      status: 'in-progress' 
    } : j));
    
    const newNotifs = allAssignedIds.map(userId => ({
      id: Date.now() + Math.random(),
      userId: userId,
      title: 'Yeni Görev Ataması',
      message: `${jobToAssign.customerName} müşterisine ait ${jobToAssign.date} tarihli operasyon için ${userId === mainPerson.id ? 'ekip sorumlusu (asıl görevli) olarak ' : 'ekip üyesi olarak '}görevlendirildiniz.`,
      date: new Date().toLocaleString('tr-TR'),
      read: false
    }));
    
    setNotifications([...newNotifs, ...notifications]);
    
    setShowAssignModal(false);
    setJobToAssign(null);
    setAssigneeId('');
    setAdditionalAssignees([]);
    setManualExtraAssignees([]);
  };

  const handleAddManualAssignee = () => {
    setManualExtraAssignees([...manualExtraAssignees, '']);
  };

  const handleManualAssigneeChange = (index, value) => {
    const updated = [...manualExtraAssignees];
    updated[index] = value;
    setManualExtraAssignees(updated);
  };

  const handleRemoveManualAssignee = (index) => {
    const updated = manualExtraAssignees.filter((_, i) => i !== index);
    setManualExtraAssignees(updated);
  };

  const submitRemoveAssignment = () => {
    setJobs(jobs.map(j => j.id === jobToAssign.id ? { 
      ...j, 
      assignedPersonnelId: null, 
      assignedPersonnelIds: [],
      teamNames: [],
      team: 'Atanmadı', 
      status: j.status === 'completed' ? 'completed' : 'pending' 
    } : j));
    setShowAssignModal(false);
    setJobToAssign(null);
    setAssigneeId('');
    setAdditionalAssignees([]);
    setManualExtraAssignees([]);
  };

  // İŞ SONLANDIRMA FONKSİYONLARI (YENİ EKLENDİ)
  const handleOpenEndJobModal = (job) => {
    setJobToEnd(job);
    setEndJobData({ 
      paymentMethod: 'Nakit', 
      damageStatus: 'Hasarsız teslim edildi', 
      damageDetails: '',
      truckImage: '',
      truckStatus: 'Herhangi bir sorun yok',
      truckIssueDetails: '',
      customerSatisfaction: 'Herhangi bir şey yapmadı.'
    });
    setShowEndJobModal(true);
  };

  const submitEndJob = (e) => {
    e.preventDefault();
    setJobs(jobs.map(j => j.id === jobToEnd.id ? { ...j, status: 'completed', endJobDetails: endJobData } : j));
    setShowEndJobModal(false);
    setJobToEnd(null);
  };

  const markNotificationsAsRead = (userId) => {
    setNotifications(prev => prev.map(n => n.userId === userId ? { ...n, read: true } : n));
  };

  const handleGenerateMessage = async (job) => {
    setAiMessageModal({ isOpen: true, loading: true, content: '', job });
    try {
      const prompt = `Sen Sembol Nakliyat firmasının kurumsal ve samimi bir asistanısın. Şu müşteri için profesyonel bir taşıma onay ve bilgilendirme WhatsApp mesajı taslağı oluştur.
      Müşteri Adı: ${job.customerName}
      Tarih ve Saat: ${job.date} ${job.time}
      Güzergah: ${job.fromProvince}/${job.fromDistrict} bölgesinden ${job.toProvince ? job.toProvince + '/' + job.toDistrict : 'belirtilmemiş'} bölgesine.
      Lütfen emojiler kullan, güven verici bir dil kullan ve ekibimizin belirtilen saatte orada olacağını belirt.`;
      
      const resText = await callGeminiAPI(prompt, false);
      setAiMessageModal(prev => ({ ...prev, loading: false, content: resText }));
    } catch (e) {
      setAiMessageModal(prev => ({ ...prev, loading: false, content: 'Mesaj oluşturulurken bir hata oluştu.' }));
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white animate-in fade-in">
         <div className="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4 animate-pulse">S</div>
         <p className="font-bold tracking-widest text-neutral-400">SİSTEM YÜKLENİYOR...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  const hasFullAccess = currentUser?.permissions?.canEdit || currentUser?.position?.includes('Yönetici');
  const visibleJobs = hasFullAccess ? jobs : jobs.filter(j => j.assignedPersonnelIds?.includes(currentUser?.id) || j.assignedPersonnelId === currentUser?.id);
  
  const unreadNotifCount = notifications.filter(n => n.userId === currentUser?.id && !n.read).length;
  const unreadMessageCount = messages.filter(m => m.receiverId === currentUser?.id && !m.read).length;
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
{/* --- GÖÇ BUTONU BURADA --- */}{/*
          <button 
            onClick={handleMigrateToCloud}
            className="w-full py-3 px-4 mt-2 mb-4 text-sm font-black transition flex justify-center items-center gap-2 rounded-xl bg-green-600 text-white shadow-lg shadow-green-600/30 animate-pulse"
          >
            ☁️ VERİLERİ BULUTA AKTAR
          </button>       */}   
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
          {hasFullAccess && (
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
          {hasFullAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsJobSubMenuOpen(!isJobSubMenuOpen); setIsCustomerSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'currentJobs' || activeTab === 'allJobs' || activeTab === 'cancelledJobs' || activeTab === 'jobBlacklist') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className={`w-5 h-5 shrink-0 ${(activeTab === 'currentJobs' || activeTab === 'allJobs' || activeTab === 'cancelledJobs' || activeTab === 'jobBlacklist') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">İş Listesi</span>
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
                  <button 
                    onClick={() => { setActiveTab('jobBlacklist'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'jobBlacklist' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'jobBlacklist' ? 'bg-white' : 'bg-red-600'}`}></div> İş Kara Listesi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Görev Listesi */}
          {hasFullAccess && (
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
          {hasFullAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsCustomerSubMenuOpen(!isCustomerSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'customerList' || activeTab === 'allCustomers' || activeTab === 'customerBlacklist') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Users className={`w-5 h-5 shrink-0 ${(activeTab === 'customerList' || activeTab === 'allCustomers' || activeTab === 'customerBlacklist') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Müşteri Listesi</span>
                </div>
                {isCustomerSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isCustomerSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('customerList'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'customerList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'customerList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Müşteriler
                  </button>
                  <button 
                    onClick={() => { setActiveTab('allCustomers'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'allCustomers' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'allCustomers' ? 'bg-white' : 'bg-red-600'}`}></div> Tüm Müşteriler
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
          {hasFullAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsPersonnelSubMenuOpen(!isPersonnelSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addPersonnel' || activeTab === 'personnelList') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className={`w-5 h-5 shrink-0 ${(activeTab === 'addPersonnel' || activeTab === 'personnelList') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Personel Listesi</span>
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
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personnelList' ? 'bg-white' : 'bg-red-600'}`}></div> Mevcut Personel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Araç Listesi */}
          {hasFullAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsVehicleSubMenuOpen(!isVehicleSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
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

          {/* Finans Listesi */}
          {hasFullAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsFinanceSubMenuOpen(!isFinanceSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'financeDashboard' || activeTab === 'addTransaction') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <div className="flex items-center gap-3">
                  <Wallet className={`w-5 h-5 shrink-0 ${(activeTab === 'financeDashboard' || activeTab === 'addTransaction') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Finans Yönetimi</span>
                </div>
                {isFinanceSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isFinanceSubMenuOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                  <button 
                    onClick={() => { setActiveTab('financeDashboard'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'financeDashboard' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'financeDashboard' ? 'bg-white' : 'bg-red-600'}`}></div> Cari Kasa Özeti
                  </button>
                  <button 
                    onClick={() => { setActiveTab('addTransaction'); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addTransaction' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addTransaction' ? 'bg-white' : 'bg-red-600'}`}></div> Para Ekle / Çıkar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Yetkilendirme */}
          {hasFullAccess && (
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setIsAuthSubMenuOpen(!isAuthSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
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

          {hasFullAccess && (
            <button 
              onClick={() => { setActiveTab('transactionTracking'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
              className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'transactionTracking' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
            >
              <Activity className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">İşlem Takibi</span>
            </button>
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
          {activeTab === 'dashboard' && <DashboardView jobs={visibleJobs} />}
          {activeTab === 'calendar' && <CalendarView jobs={visibleJobs} handleEditJob={handleEditJob} />}
          {activeTab === 'profile' && <ProfileView currentUser={currentUser} jobs={jobs} notifications={notifications} markNotificationsAsRead={markNotificationsAsRead} personnelList={personnelList} messages={messages} setMessages={setMessages} handleOpenEndJobModal={handleOpenEndJobModal} />}
          
          {(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') && hasFullAccess &&
            <AddJobView 
              type={recordType} 
              formData={formData} 
              setFormData={setFormData}
              handleInputChange={handleInputChange}
              handleProvinceChange={handleProvinceChange}
              handleDepoChange={handleDepoChange}
              toggleDepoDirection={toggleDepoDirection}
              handleAddJob={handleAddJob}
              showSecondFromAddress={showSecondFromAddress}
              setShowSecondFromAddress={setShowSecondFromAddress}
              showSecondToAddress={showSecondToAddress}
              setShowSecondToAddress={setShowSecondToAddress}
              editingJobId={editingJobId}
            />
          }
          {activeTab === 'customerList' && hasFullAccess && <CustomerListView jobs={jobs.filter(j => j.status !== 'completed')} title="Mevcut Müşteri Listesi" />}
          {activeTab === 'allCustomers' && hasFullAccess && <CustomerListView jobs={jobs} title="Tüm Müşteriler Listesi" />}

          {/* İş Listesi Modülleri */}
          {activeTab === 'currentJobs' && hasFullAccess && <CurrentJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} />}
          {activeTab === 'allJobs' && hasFullAccess && <AllJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} />}
          {activeTab === 'cancelledJobs' && hasFullAccess && <PlaceholderView title="İptal Edilen İşler" icon={ClipboardList} />}
          {activeTab === 'jobBlacklist' && hasFullAccess && <PlaceholderView title="İş Kara Listesi" icon={AlertTriangle} />}

          {activeTab === 'customerBlacklist' && hasFullAccess && <PlaceholderView title="Müşteri Kara Listesi" icon={AlertTriangle} />}
          
          {/* Personel ve Araç Modülleri */}
          {activeTab === 'addPersonnel' && hasFullAccess && <AddPersonnelView onAdd={handleAddPersonnel} positions={positions} ranks={ranks} />}
          {activeTab === 'personnelList' && hasFullAccess && <PersonnelListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} />}
          {activeTab === 'addVehicle' && hasFullAccess && <PlaceholderView title="Araç Ekle" icon={Car} />}
          {activeTab === 'vehicleList' && hasFullAccess && <PlaceholderView title="Mevcut Araç Listesi" icon={Car} />}
          
          {/* Finans Yönetimi Modülleri */}
          {activeTab === 'financeDashboard' && hasFullAccess && <FinanceDashboardView transactions={transactions} setActiveTab={setActiveTab} />}
          {activeTab === 'addTransaction' && hasFullAccess &&
            <AddTransactionView 
              transactionType={transactionType}
              setTransactionType={setTransactionType}
              newTransaction={newTransaction}
              setNewTransaction={setNewTransaction}
              handleAddTransaction={handleAddTransaction}
            />
          }

          {activeTab === 'addTask' && hasFullAccess &&
            <AddTaskFormView 
              newTask={newTask}
              setNewTask={setNewTask}
              handleAddTask={handleAddTask}
              personnelList={personnelList}
            />
          }
          {activeTab === 'taskList' && hasFullAccess &&
            <TaskManagerView 
              tasks={tasks}
              setTasks={setTasks}
              setShowTaskModal={setShowTaskModal}
              draggingTask={draggingTask}
              setDraggingTask={setDraggingTask}
              openEditTask={openEditTask}
            />
          }
          
          {/* Yetkilendirme Modülleri */}
          {activeTab === 'userList' && hasFullAccess && <UserListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} onDelete={handleDeletePersonnel} positions={positions} ranks={ranks} />}
          {activeTab === 'positions' && hasFullAccess && <PositionsView positions={positions} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} />}
          {activeTab === 'ranks' && hasFullAccess && <RanksView ranks={ranks} onAddRank={handleAddRank} onDeleteRank={handleDeleteRank} />}
          {activeTab === 'permissions' && hasFullAccess && <PermissionsView personnelList={personnelList} handleUpdatePermissions={handleUpdatePermissions} />}
          
          {/* İşlem Takibi Modülü */}
          {activeTab === 'transactionTracking' && hasFullAccess && <PlaceholderView title="İşlem Takibi" icon={Activity} />}
        </div>
      </main>

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
                    {personnelList.map(person => (
                      <option key={person.id} value={person.id}>{person.fullName} - {person.position}</option>
                    ))}
                  </select>
                </div>

                {assigneeId && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-red-600" /> Beraber Gidecek Diğer Personeller
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-neutral-300 rounded-xl p-2 bg-white space-y-1 custom-scrollbar">
                      {personnelList.filter(p => p.id !== parseInt(assigneeId)).map(person => (
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
                      {personnelList.filter(p => p.id !== parseInt(assigneeId)).length === 0 && (
                         <p className="text-xs text-neutral-500 p-2">Eklenebilecek başka personel bulunmuyor.</p>
                      )}
                    </div>
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
      {aiMessageModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> Müşteri Mesajı Hazırla</h3>
              <button onClick={() => setAiMessageModal({ isOpen: false, loading: false, content: '', job: null })} className="text-white/80 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6">
              {aiMessageModal.loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-purple-600">
                  <Loader2 className="w-12 h-12 animate-spin mb-4" />
                  <p className="font-bold animate-pulse">Yapay Zeka Mesajı Tasarlıyor...</p>
                </div>
              ) : (
                <div>
                  <textarea 
                    readOnly
                    value={aiMessageModal.content}
                    className="w-full p-4 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none h-48 resize-none transition bg-neutral-50 mb-4 text-sm font-medium" 
                  />
                  <CopyButton content={aiMessageModal.content} />
                </div>
              )}
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
            
            <form onSubmit={handleUpdateTask} className="p-6 space-y-4">
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
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}