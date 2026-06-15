import React, { useState, useEffect } from 'react';
  import { 
    Truck, Calendar, MapPin, Phone, FileText, 
    CheckCircle, Clock, PlusCircle, ClipboardList, 
    Star, AlertTriangle, X, Users, CalendarDays, ChevronLeft, ChevronRight,
    ChevronDown, ChevronUp, Briefcase, Car, Wallet, CheckSquare, Shield, GripVertical, Activity,
    ArrowUpRight, ArrowDownRight, Landmark, CreditCard, DollarSign, ArrowRightLeft, ArrowUpDown,
    UserPlus, Camera, Upload, Edit, Ban, LogOut, Lock, Mail, Bell, User, Sparkles, Loader2, Copy, MessageSquareText,
    MessageCircle, Send, Package, Database, Download, History, Save, Search, Key, BarChart, TrendingUp, ListTodo,
    Eye, EyeOff, FolderOpen
  } from 'lucide-react';

  // --- FIREBASE BAĞLANTISI ---
  import { initializeApp } from "firebase/app";
  import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, setDoc, getDocs, query, orderBy, getDoc, limit, where
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
  const baseProvinces = Object.keys(TURKEY_LOCATIONS).filter(p => p !== "İstanbul (Anadolu)" && p !== "İstanbul (Avrupa)");
  baseProvinces.sort((a, b) => a.localeCompare(b, 'tr'));
  const PROVINCES = ["İstanbul (Anadolu)", "İstanbul (Avrupa)", ...baseProvinces];
  const FLOORS = ['Bodrum Kat', 'Giriş Kat', 'Müstakil / Villa', ...Array.from({ length: 30 }, (_, i) => `${i + 1}. Kat`)];

  // DEPOEVİM TESİSLERİ
  const DEPO_LOCATIONS = [
    { name: "Pendik Depoevim", province: "İstanbul (Anadolu)", district: "Pendik", address: "Bahçelievler Mah. Yeni Sk. No: 5/A" },
    { name: "Kartal Depoevim", province: "İstanbul (Anadolu)", district: "Kartal", address: "Yalı Mah. Bağlar Cad. No: 74/2" },
    { name: "Çekmeköy Depoevim", province: "İstanbul (Anadolu)", district: "Çekmeköy", address: "Ekşioğlu Mah. Atabey Cad. No: 28/2" },
    { name: "Ümraniye Depoevim", province: "İstanbul (Anadolu)", district: "Ümraniye", address: "Dudullu OSB Mah. 1. Cad. No: 30/4" }
  ];

  const MESAI_STATUS_OPTIONS = [
    { code: 'G', label: 'Geldi', color: 'bg-green-100 text-green-700 focus:bg-green-200' },
    { code: 'FG', label: 'Fazla Gün', color: 'bg-teal-100 text-teal-700 focus:bg-teal-200' },
    { code: 'FGM', label: 'F.Gün+Mesai', color: 'bg-cyan-100 text-cyan-800 focus:bg-cyan-200' },
    { code: 'FM', label: 'Fazla Mesai', color: 'bg-blue-100 text-blue-700 focus:bg-blue-200' },
    { code: 'EM', label: 'Eksik Mesai', color: 'bg-yellow-100 text-yellow-700 focus:bg-yellow-200' },
    { code: 'D', label: 'Devamsız', color: 'bg-red-100 text-red-700 focus:bg-red-200' },
    { code: 'R', label: 'Raporlu', color: 'bg-orange-100 text-orange-700 focus:bg-orange-200' },
    { code: 'Hİ', label: 'Haftalık İzin', color: 'bg-blue-100 text-blue-700 focus:bg-blue-200' },
    { code: 'Yİ', label: 'Yıllık İzin', color: 'bg-purple-100 text-purple-700 focus:bg-purple-200' },
    { code: 'Bİ', label: 'Bayram İzni', color: 'bg-pink-100 text-pink-700 focus:bg-pink-200' },
    { code: 'Üİ', label: 'Ücretsiz İzin', color: 'bg-neutral-200 text-neutral-700 focus:bg-neutral-300' }
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

    const isBinaAsansorFrom = job.fromTransportMethod === 'Bina Asansörü' ? 'Var' : 'Yok';
    const isCepheAsansorFrom = job.fromTransportMethod === 'Dış Cephe Asansörü' ? 'Var' : 'Yok';
    const isToplamaFrom = job.fromPacking === 'Toplama Yapılacak' ? 'Var' : 'Yok';

    const isBinaAsansorTo = job.toTransportMethod === 'Bina Asansörü' ? 'Var' : 'Yok';
    const isCepheAsansorTo = job.toTransportMethod === 'Dış Cephe Asansörü' ? 'Var' : 'Yok';

    const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${job.customerName} - Sözleşme</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; font-size: 10px; }
        
        .page { 
          width: 210mm; 
          height: 297mm;
          background: white;
          padding: 8mm 12mm;
          margin: 10mm auto;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          position: relative;
          page-break-after: always;
          overflow: hidden;
        }
        @media print {
          @page { margin: 0 !important; }
          body { background: white; margin: 0; -webkit-print-color-adjust: exact; }
          .page { margin: 0; padding: 8mm 12mm; box-shadow: none; border: none; height: 297mm; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
        }
        .header { text-align: center; border-bottom: 2px solid #d32f2f; padding-bottom: 6px; margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; }
        .logo-img { height: 40px; margin-bottom: 4px; object-fit: contain; }
        .subtitle { font-size: 11px; color: #333; font-weight: bold; margin-bottom: 3px; letter-spacing: 1px; }
        .contact-info { font-size: 9px; color: #555; line-height: 1.2; }
        
        .main-title { font-size: 13px; font-weight: bold; text-align: center; margin: 8px 0; padding: 5px; background: #f0f0f0; border: 1px solid #ccc; text-transform: uppercase;}
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
        th { background: #f0f0f0; padding: 4px; border: 1px solid #ccc; text-align: left; font-size: 11px; color: #d32f2f; }
        td { padding: 4px; border: 1px solid #ccc; vertical-align: top; }
        .label { font-weight: bold; width: 35%; background: #fafafa; }
        
        .section-title { font-weight: bold; font-size: 11px; color: #d32f2f; margin-top: 8px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
        .desc-box { padding: 6px; border: 1px dashed #ccc; font-size: 10px; min-height: 25px; margin-bottom: 8px; background: #fafafa; }
        
        .code-box { border: 2px dashed #d32f2f; background-color: #fff5f5; padding: 6px; margin-bottom: 8px; text-align: center; border-radius: 6px; }
        .code-title { font-size: 10px; color: #d32f2f; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
        .code-val { font-size: 18px; font-weight: 900; color: #000; letter-spacing: 4px; }
        .code-sub { font-size: 8px; color: #555; margin-top: 2px; }

        .signatures { display: flex; justify-content: space-between; margin-top: 10px; }
        .sign-box { width: 45%; font-size: 10px; }
        .sign-title { font-weight: bold; text-align: center; margin-bottom: 4px; text-decoration: underline; }
        .sign-details { line-height: 1.4; }
        .kase-img { max-height: 50px; margin-top: 4px; display: block; margin-left: auto; margin-right: auto; }
        
        /* Page 2 Styles */
        .terms-list { font-size: 9px; line-height: 1.35; text-align: justify; }
        .terms-group-title { font-weight: bold; font-size: 10px; margin-top: 6px; margin-bottom: 2px; text-decoration: underline; }
      </style>
    </head>
    <body>
      
      <div class="page">
        <div class="header">
          <img src="https://www.sembolevdeneve.com/crm/uploads/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" />
          <div class="subtitle">EVDEN EVE - ASANSÖRLÜ TAŞIMA - DEPOLAMA</div>
          <div class="contact-info">
            Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL | Tel: (0216) 390 89 99<br/>
            Vergi No: 7600944287 | www.sembolnakliyat.com
          </div>
        </div>
        
        <div class="main-title">EVDEN EVE TAŞIMACILIK VE NAKLİYE SÖZLEŞMESİ</div>
        
        <table>
          <tr><th colspan="2">YÜKLEME ADRESİ (NEREDEN)</th></tr>
          <tr><td class="label">Adres:</td><td>${job.fromProvince || ''}/${job.fromDistrict || ''} - ${job.fromAddress || ''}</td></tr>
          <tr><td class="label">Kat:</td><td>${job.fromFloor || ''}</td></tr>
          <tr><td class="label">Oda Sayısı:</td><td>${job.fromRoomCount || ''}</td></tr>
          <tr><td class="label">Bina Asansörü:</td><td>${isBinaAsansorFrom}</td></tr>
          <tr><td class="label">Dış Cephe Asansörü:</td><td>${isCepheAsansorFrom}</td></tr>
          <tr><td class="label">Toplama Hizmeti:</td><td>${isToplamaFrom}</td></tr>
        </table>

        <table>
          <tr><th colspan="2">BOŞALTMA ADRESİ (NEREYE)</th></tr>
          <tr><td class="label">Adres:</td><td>${job.toProvince ? job.toProvince + '/' + job.toDistrict + ' - ' + job.toAddress : 'Belirtilmedi'}</td></tr>
          <tr><td class="label">Kat:</td><td>${job.toFloor || ''}</td></tr>
          <tr><td class="label">Oda Sayısı:</td><td>${job.toRoomCount || ''}</td></tr>
          <tr><td class="label">Bina Asansörü:</td><td>${isBinaAsansorTo}</td></tr>
          <tr><td class="label">Dış Cephe Asansörü:</td><td>${isCepheAsansorTo}</td></tr>
        </table>

        ${job.contractDetails && job.contractDetails.trim() !== '' ? `
        <div class="section-title">EKSTRA SÖZLEŞME DETAYI</div>
        <div class="desc-box">
          ${job.contractDetails}
        </div>
        ` : ''}

        <div class="code-box">
          <div class="code-title">Güvenlik / Teslim Kodu</div>
          <div class="code-val">${job.deliveryCode || 'BULUNMUYOR'}</div>
          <div class="code-sub">(Lütfen eşya teslimatında ekiplerimize bu kodu iletiniz.)</div>
        </div>

        <table>
          <tr><th colspan="2">ANLAŞMA ÖDEME DETAYLARI</th></tr>
          <tr><td class="label">Taşıma Tarihi / Saati:</td><td>${job.date || ''} - ${job.time || ''}</td></tr>
          <tr><td class="label">Anlaşma Bedeli (TL):</td><td>${fiyat} TL</td></tr>
          <tr><td class="label">Alınan Peşinat:</td><td>${kapora} TL</td></tr>
          <tr><td class="label">Kalan Bakiye (TL):</td><td><b>${bakiye} TL</b></td></tr>
        </table>

        <div class="signatures">
          <div class="sign-box">
            <div class="sign-title">HİZMET VEREN (KAŞE / İMZA)</div>
            <div class="sign-details text-center">
              <b>Sembol Nakliyat Depoculuk Tic. Ltd. Şti.</b>
              <img src="https://www.sembolevdeneve.com/crm/uploads/ka%C5%9Fe.jpg" class="kase-img" alt="Kaşe" />
            </div>
          </div>
          <div class="sign-box">
            <div class="sign-title">HİZMET ALAN (MÜŞTERİ)</div>
            <div class="sign-details">
              <b>TC Kimlik No:</b> ${job.tcNo || '....................................'}<br/>
              <b>İletişim No:</b> ${job.customerPhone || '....................................'}<br/>
              <b>Adı Soyadı:</b> ${job.customerName || '....................................'}<br/><br/>
              <b>İmza:</b>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. SAYFA -->
      <div class="page">
        <div class="header">
          <img src="https://www.sembolevdeneve.com/crm/uploads/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" />
          <div class="subtitle">EVDEN EVE - ASANSÖRLÜ TAŞIMA - DEPOLAMA</div>
          <div class="contact-info">
            Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL | Tel: (0216) 390 89 99<br/>
            Vergi No: 7600944287 | www.sembolnakliyat.com
          </div>
        </div>

        <div class="main-title">HİZMET KAPSAMI VE OPERASYONEL ŞARTLAR<br/><span style="font-size: 11px; color: #555;">SÖZLEŞME ŞARTLARI VE MADDELERİ</span></div>

        <div class="terms-list">
          1. Taşıma işlemi kapalı kasa nakliye aracı ile gerçekleştirilecek olup, aksi belirtmedikçe tek araç icin geçerlidir.<br/>
          2. Eşyaların ambalajlanması, mobilyaların de-montaj ve montaj işlemleri yüklenici firma sorumluluğundadır.<br/>
          3. Şehir içi nakliye hizmetinin, mücbir sebepler haricinde aynı iş günü içerisinde tamamlanması esastır.<br/>
          4. Para kasası, piyano ve özel yapım eşyalar gibi özel taşıma gerektiren yükler önceden bildirilmelidir; aksi halde ek ücret tahakkuk ettirilir.<br/>
          5. Sözleşme yapılan kişinin adreslerde bulunması süreci takip etmesi gerekmektedir.<br/>

          <div class="terms-group-title">TEKNİK SINIRLANDIRMALAR VE İSTİSNALAR</div>
          6. Avize, perde, ankastre ve duvarda takılı eşyaları sökülümü yapılır; ancak montaj işlemleri hizmet kapsamı dışındadır.<br/>
          7. Korniş, klima, aspiratör montajı, duvar montajı ve elektrik işleri firmanın sorumluluğunda değildir.<br/>
          8. Tesisatı hazır olmayan beyaz eşyaların bağlantısı teknik emniyet gerekçesiyle yapılmamaktadır.<br/>
          9. Klima sökülüm ve montajı hizmet kapsamında değildir.<br/>
          10. Toplama hizmeti alındığında yeni adreste kolileri açılıp dizme/yerleştirme hizmeti yoktur.<br/>

          <div class="terms-group-title">NAKLİYE VE ERİŞİM KOŞULLARI</div>
          11. Nakliye aracının yükleme ve boşaltma noktalarına yanaşma imkanı sağlanmalıdır. 30 metreyi aşan mesafelerde ek işçilik maliyeti oluşur.<br/>
          12. Apartman boşluğuna veya kapı ölçülerine sığmayan eşyaların taşınması firmanın sorumluluğu dışındadır.<br/>
          13. Kat farkı veya asansör kullanımı değişiklikleri durumunda fiyatlandırma güncellenebilir.<br/>
          14. Toplama hizmeti alınmadığında küçük eşyaların kolileri taşımaya hazır halde bulunmalıdır.<br/>

          <div class="terms-group-title">HASAR, SİGORTA VE SORUMLULUK</div>
          15. Taşınan emtia, nakliye esnasında oluşabilecek risklere karşı Emtia Sigortası güvencesindedir.<br/>
          16. Olası personel hasarında firma, nakliye bedelinin %10'una kadar doğrudan tazmin sorumluluğunu kabul eder.<br/>
          17. Hasar gören eşyalar için firma imkanlar doğrultusunda teknik tamir destek sağlanmaktadır.<br/>
          18. Fabrika kutusu olmayan elektronik cihazlar, ziynet eşyası, nakit para ve yanıcı/akıcı maddeler sorumluluk dışındadır.<br/>
          19. Hasar ve eksik bildirimlerinin teslimat anında yapılması zorunludur; adres terk edildikten sonraki talepler için sorumluluk alınmaz.<br/>

          <div class="terms-group-title">ÖDEME, İPTAL VE DEPOLAMA HÜKÜMLERİ</div>
          20. Hizmet bedelinin %10'u kapora olarak alınır; kalan bakiye teslim edilecek adreste tahsil edilir.<br/>
          21. Anlaşılan nakliye fiyatına KDV dahil değildir.<br/>
          22. Şehirler arası taşımalarda eşya araca yüklendikten sonra %50 ödemeye tamamlanmaktadır.<br/>
          23. Taşıma gününe 72 saatten az süre kala yapılan iptal ve değişikliklerde toplam bedelin %50'si cayma tazminatı olarak fatura edilir.<br/>
          24. Depolama hizmetinde belirtilen fiyat sadece depoya giriş nakliyesini kapsar; çıkış nakliyesi ayrıca fiyatlandırılır.<br/>
          25. Yüklenici firma, taşıma tarihine 72 saat kalan herhangi bir mazeret bildirmeksizin sözleşmeyi tek tarafli feshetme hakkına sahiptir.<br/>

          <div class="terms-group-title">GİZLİLİK VE HUKUKİ YETKİ</div>
          26. Müşteri kişisel verileri KVKK kapsamında gizli tutulur.<br/>
          27. Firmanın ticari itibarini zedeleyici art niyetli kötüyeleyici yorumlar ve paylaşımlar yapılamaz.<br/>
          28. Kaydını yaptırıp kişisel bilgilerini firma ile paylaşmış hizmet alan kişiye firmamız tarafından telefon/internet aracılığıyla tüm maddeleri bildirilmiş veya bahsedilmiştir. Tüm maddeler kabul edilmiştir.<br/>
          29. Firma tarafından hizmet alan kişiler sözleşme maddeleri dahilinde haklarını arayabilirler.<br/>
          İşbu 29 maddelik sözleşmeden doğan ihtilaflarda Istanbul (Anadolu) Mahkemeleri ve Icra Daireleri yetkilidir.<br/>
        </div>

        <div class="signatures">
          <div class="sign-box">
            <div class="sign-title">HİZMET VEREN (KAŞE / İMZA)</div>
            <div class="sign-details text-center">
              <b>Sembol Nakliyat Depoculuk Tic. Ltd. Şti.</b>
              <img src="https://www.sembolevdeneve.com/crm/uploads/ka%C5%9Fe.jpg" class="kase-img" alt="Kaşe" />
            </div>
          </div>
          <div class="sign-box">
            <div class="sign-title">HİZMET ALAN (MÜŞTERİ)</div>
            <div class="sign-details">
              <b>TC Kimlik No:</b> ${job.tcNo || '....................................'}<br/>
              <b>İletişim No:</b> ${job.customerPhone || '....................................'}<br/>
              <b>Adı Soyadı:</b> ${job.customerName || '....................................'}<br/><br/>
              <b>İmza:</b>
            </div>
          </div>
        </div>
      </div>
      <script>
        // Tarayıcıdaki başlık ve linkin basılmasını engellemek için gerekli olabilecek bir ek stil (bazı tarayıcılar destekler).
        const style = document.createElement('style');
        style.textContent = '@page { margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } }';
        document.head.appendChild(style);
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

  const AdminMaviYakaTakip = ({ jobs, personnelList, transactions }) => {
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

  const DashboardView = ({ jobs, allJobs, personnelList, vehicles, materials, systemLogs, currentUser, setViewingImage, transactions }) => {
    const isAdmin = ['Müdür', 'Firma Sahibi', 'Operasyon'].some(role => currentUser?.position?.includes(role) || currentUser?.rank === role) || currentUser?.permissions?.canEdit;
    
    const [myScore, setMyScore] = useState(0);
    const [dailyData, setDailyData] = useState({ today: { mesai: null, puan: 0 }, yesterday: { mesai: null, puan: 0 } });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filterPeriod, setFilterPeriod] = useState('today');

    // YENİ EKLENEN STATE (BİLGİLENDİRMELER İÇİN - Dizi Olarak Güncellendi)
    const [latestInfo, setLatestInfo] = useState({ announcements: [], posts: [], bestEmps: [] });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    const dashboardJobs = jobs.filter(j => {
      if (filterPeriod === 'all') return true;
      const jDate = new Date(j.date);
      if (filterPeriod === 'today') return j.date === todayStr;
      if (filterPeriod === 'month') return jDate.getMonth() === todayMonth && jDate.getFullYear() === todayYear;
      if (filterPeriod === 'year') return jDate.getFullYear() === todayYear;
      return true;
    });

    const isMaviYaka = currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position));

    // YENİ EKLENEN EFFECT
    useEffect(() => {
      const annRef = collection(db, 'artifacts', appId, 'public', 'data', 'announcements');
      const postRef = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
      const bestRef = collection(db, 'artifacts', appId, 'public', 'data', 'bestEmployees');

const qAnn = query(annRef, orderBy('timestamp', 'desc'), limit(15));
      const qPost = query(postRef, orderBy('timestamp', 'desc'), limit(15));
      const qBest = query(bestRef, orderBy('timestamp', 'desc'), limit(15));

      const unsubs = [];
      unsubs.push(onSnapshot(qAnn, snap => {
        setLatestInfo(prev => ({...prev, announcements: snap.docs.map(d => ({ ...d.data(), id: d.id }))}));
      }));
      unsubs.push(onSnapshot(qPost, snap => {
        setLatestInfo(prev => ({...prev, posts: snap.docs.map(d => ({ ...d.data(), id: d.id }))}));
      }));
      unsubs.push(onSnapshot(qBest, snap => {
        setLatestInfo(prev => ({...prev, bestEmps: snap.docs.map(d => ({ ...d.data(), id: d.id }))}));
      }));

      return () => unsubs.forEach(u => u());
    }, []);

    const handleDeleteInfo = async (colName, id) => {
       try {
           await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id));
       } catch (err) { console.error("Silme hatası:", err); }
    };

    const fetchMyScoreAndStatus = async () => {
      try {
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = yesterday.getMonth() + 1;
        const yDay = yesterday.getDate();

        // 1. Fetch current month Puantaj
        const docRefPuantaj = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${currentYear}_${currentMonth}`);
        const snapPuantaj = await getDoc(docRefPuantaj);
        let currentMonthPuantajRecords = {};
        if (snapPuantaj.exists()) {
          currentMonthPuantajRecords = snapPuantaj.data().records || {};
          const myRecord = currentMonthPuantajRecords[currentUser.id] || {};
          const total = Object.values(myRecord).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
          setMyScore(total);
        }

        let todayPuan = parseFloat(currentMonthPuantajRecords[currentUser.id]?.[currentDay]) || 0;
        let yesterdayPuan = 0;

        // 2. Fetch yesterday Puantaj (if previous month)
        if (currentMonth === yMonth && currentYear === yYear) {
            yesterdayPuan = parseFloat(currentMonthPuantajRecords[currentUser.id]?.[yDay]) || 0;
        } else {
            const docRefPuantajYest = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${yYear}_${yMonth}`);
            const snapPuantajYest = await getDoc(docRefPuantajYest);
            if (snapPuantajYest.exists()) {
                const yRecords = snapPuantajYest.data().records || {};
                yesterdayPuan = parseFloat(yRecords[currentUser.id]?.[yDay]) || 0;
            }
        }

        // 3. Fetch current month Mesai
        const docRefMesaiToday = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${currentYear}_${currentMonth}`);
        const snapMesaiToday = await getDoc(docRefMesaiToday);
        let todayStatus = null;
        let currentMonthMesaiRecords = {};
        if (snapMesaiToday.exists()) {
           currentMonthMesaiRecords = snapMesaiToday.data().records || {};
           const myRecord = currentMonthMesaiRecords[currentUser.id] || {};
           const tData = myRecord[currentDay];
           if (tData) todayStatus = typeof tData === 'object' ? tData.status : tData;
        }

        // 4. Fetch yesterday Mesai
        let yesterdayStatus = null;
        if (currentMonth === yMonth && currentYear === yYear) {
           const myRecord = currentMonthMesaiRecords[currentUser.id] || {};
           const yData = myRecord[yDay];
           if (yData) yesterdayStatus = typeof yData === 'object' ? yData.status : yData;
        } else {
           const docRefMesaiYesterday = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${yYear}_${yMonth}`);
           const snapMesaiYesterday = await getDoc(docRefMesaiYesterday);
           if (snapMesaiYesterday.exists()) {
             const records = snapMesaiYesterday.data().records || {};
             const myRecord = records[currentUser.id] || {};
             const yData = myRecord[yDay];
             if (yData) yesterdayStatus = typeof yData === 'object' ? yData.status : yData;
           }
        }

        setDailyData({
            today: { mesai: todayStatus, puan: todayPuan },
            yesterday: { mesai: yesterdayStatus, puan: yesterdayPuan }
        });

      } catch (error) {
        console.error("Veriler yüklenemedi", error);
      }
    };

useEffect(() => {
      if (!isMaviYaka || !currentUser) return;
      fetchMyScoreAndStatus();
    }, [currentUser, isMaviYaka]);

    const handleRefresh = async () => {
      setIsRefreshing(true);
      await fetchMyScoreAndStatus();
      setTimeout(() => setIsRefreshing(false), 800);
    };

    let scoreColor = '';
    let scoreTextColor = '';
    let scoreMessage = '';
    let scoreIcon = null;

    if (myScore < 10) {
      scoreColor = 'bg-red-50 border-red-200';
      scoreTextColor = 'text-red-600';
      scoreMessage = 'Daha iyi! Azimlen, başarabilirsin! 💪';
      scoreIcon = <AlertTriangle className="w-6 h-6 text-red-600" />;
    } else if (myScore < 25) {
      scoreColor = 'bg-yellow-50 border-yellow-200';
      scoreTextColor = 'text-yellow-600';
      scoreMessage = 'Gayret! Potaya girmeye az kaldı! 🏃‍♂️';
      scoreIcon = <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
    } else {
      scoreColor = 'bg-green-50 border-green-200';
      scoreTextColor = 'text-green-600';
      scoreMessage = 'Birinciliğe göz dikmişsin! Çok iyisin, en iyisi olacaksın! 🏆';
      scoreIcon = <CheckCircle className="w-6 h-6 text-green-600" />;
    }

    // --- MESAİ DURUM BİLDİRİMİ HAZIRLIĞI ---
    const renderDailySummary = (data, dayLabel) => {
       if (!data || (!data.mesai && data.puan === 0)) return null;

       const boxes = [];

       if (data.puan > 0) {
            let pTitle = '';
            let pMsg = '';
            let pBg = 'bg-yellow-50';
            let pBorder = 'border-yellow-200';
            let pTextCol = 'text-yellow-800';
            let pIcon = <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />;

            if (data.puan === 0.5) {
                pTitle = `${dayLabel} Destek Puanı!`;
                pMsg = 'Takım arkadaşlarına yardımcı olduğun için 0.5 puan kazandın. Harika bir takım oyuncususun!';
                pBg = 'bg-blue-50'; pBorder = 'border-blue-200'; pTextCol = 'text-blue-800';
                pIcon = <Users className="w-6 h-6 text-blue-600" />;
            } else if (data.puan === 1) {
                pTitle = `${dayLabel} Müşteri Puanı!`;
                pMsg = 'Müşteri memnuniyetini sağladığın için 1 tam puan kazandın. Tebrikler!';
            } else if (data.puan > 1) {
                pTitle = `${dayLabel} Harika Performans!`;
                pMsg = `Hem müşteri memnuniyeti hem de takım desteği ile toplam ${data.puan} puan kazandın!`;
                pBg = 'bg-emerald-50'; pBorder = 'border-emerald-200'; pTextCol = 'text-emerald-800';
                pIcon = <Sparkles className="w-6 h-6 text-emerald-600" />;
            }

            boxes.push(
              <div key="puan" className={`p-4 rounded-2xl border ${pBg} ${pBorder} shadow-sm flex items-start gap-4 mb-3 w-full`}>
                 <div className="bg-white p-3 rounded-full shadow-sm shrink-0 border border-white/50">{pIcon}</div>
                 <div>
                    <h3 className={`font-black text-base md:text-lg ${pTextCol} mb-0.5`}>{pTitle}</h3>
                    <p className={`text-xs md:text-sm font-medium ${pTextCol} opacity-90`}>{pMsg}</p>
                 </div>
              </div>
           );
       }

       if (data.mesai) {
          let bg = '', textCol = '', border = '', icon = null, title = '', msg = '';
          switch (data.mesai) {
             case 'G': bg = 'bg-green-50'; border = 'border-green-200'; textCol = 'text-green-800'; title = `${dayLabel} Mesain Onaylandı`; msg = 'Mesain sisteme eksiksiz olarak işlendi. Harika!'; icon = <CheckCircle className="w-6 h-6 text-green-600" />; break;
             case 'FM': bg = 'bg-blue-50'; border = 'border-blue-200'; textCol = 'text-blue-800'; title = `${dayLabel} Fazla Mesai`; msg = 'Harika efor! Emeklerinin karşılığını göreceksin, aynen devam! 💪'; icon = <Clock className="w-6 h-6 text-blue-600" />; break;
             case 'EM': bg = 'bg-yellow-50'; border = 'border-yellow-200'; textCol = 'text-yellow-800'; title = `${dayLabel} Eksik Mesai`; msg = 'Biraz eksik çalıştın gibi görünüyor. Bir dahaki sefere telafi edeceğinden eminiz!'; icon = <Clock className="w-6 h-6 text-yellow-600" />; break;
             case 'D': bg = 'bg-red-50'; border = 'border-red-200'; textCol = 'text-red-800'; title = `${dayLabel} İşe Gelmedin`; msg = 'Aramızda değildin. Umarım her şey yolundadır, seni dinlenmiş olarak bekliyoruz.'; icon = <AlertTriangle className="w-6 h-6 text-red-600" />; break;
             case 'Hİ': bg = 'bg-blue-50'; border = 'border-blue-200'; textCol = 'text-blue-800'; title = `${dayLabel} İzinlisin`; msg = 'Haftalık iznini iyi değerlendir, dinlenmek en doğal hakkın. İyi tatiller! 🌴'; icon = <Clock className="w-6 h-6 text-blue-600" />; break;
             case 'Yİ': bg = 'bg-purple-50'; border = 'border-purple-200'; textCol = 'text-purple-800'; title = `${dayLabel} Yıllık İzindesin`; msg = 'Uzun bir tatil zamanı! Kendine bolca vakit ayır ve iyice dinlen. 🏖️'; icon = <CalendarDays className="w-6 h-6 text-purple-600" />; break;
             case 'Bİ': bg = 'bg-pink-50'; border = 'border-pink-200'; textCol = 'text-pink-800'; title = `${dayLabel} Bayram İznindesin`; msg = 'İyi bayramlar! Sevdiklerinle birlikte güzel vakit geçir. 🍬'; icon = <Star className="w-6 h-6 text-pink-600" />; break;
             case 'FG': bg = 'bg-teal-50'; border = 'border-teal-200'; textCol = 'text-teal-800'; title = `${dayLabel} Fazla Gün`; msg = 'Ekstra bir gün çalışarak gücünü gösterdin! Harikasın! 🚀'; icon = <Activity className="w-6 h-6 text-teal-600" />; break;
             case 'FGM': bg = 'bg-cyan-50'; border = 'border-cyan-200'; textCol = 'text-cyan-800'; title = `${dayLabel} Fazla Gün + Mesai`; msg = 'İzin gününde hem çalışıp hem de mesaiye kaldın! Harika bir efor! 🚀💪'; icon = <Activity className="w-6 h-6 text-cyan-600" />; break;
             case 'Üİ': bg = 'bg-neutral-100'; border = 'border-neutral-300'; textCol = 'text-neutral-700'; title = `${dayLabel} Ücretsiz İzin`; msg = 'İzindesin, dinlenmene bak. Tekrar aramızda görmek için sabırsızlanıyoruz.'; icon = <Ban className="w-6 h-6 text-neutral-500" />; break;
             case 'R': bg = 'bg-orange-50'; border = 'border-orange-200'; textCol = 'text-orange-800'; title = `${dayLabel} Raporlusun`; msg = 'Geçmiş olsun! Lütfen sağlığına dikkat et, seni sağlıklı olarak tekrar görmek istiyoruz. 🏥'; icon = <Activity className="w-6 h-6 text-orange-600" />; break;
             default: break;
          }
          if (title) {
              boxes.push(
                  <div key="mesai" className={`p-4 rounded-2xl border ${bg} ${border} shadow-sm flex items-start gap-4 mb-3 w-full`}>
                     <div className="bg-white p-3 rounded-full shadow-sm shrink-0 border border-white/50">{icon}</div>
                     <div>
                        <h3 className={`font-black text-base md:text-lg ${textCol} mb-0.5`}>{title}</h3>
                        <p className={`text-xs md:text-sm font-medium ${textCol} opacity-90`}>{msg}</p>
                     </div>
                  </div>
              );
          }
       }

       return (
           <div className="flex-1 animate-in fade-in slide-in-from-top-4 flex flex-col">
               <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3 pl-1 border-b border-neutral-200 pb-2">{dayLabel} Özeti</h3>
               <div className="flex flex-col flex-1">
                   {boxes}
               </div>
           </div>
       );
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
          <div className="flex items-start lg:items-center gap-4 w-full lg:w-auto">
            <div>
              <h2 className="text-2xl font-black text-black">Hoş Geldiniz, {currentUser?.fullName}</h2>
              <p className="text-neutral-500 font-medium">Sistemdeki genel operasyon özetini aşağıdan takip edebilirsiniz.</p>
            </div>
            {isMaviYaka && (
              <button 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="ml-auto p-2.5 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition shrink-0 shadow-sm border border-neutral-200"
                title="Günlük Özeti Yenile"
              >
                 <Loader2 className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-red-600' : ''}`} />
              </button>
            )}
          </div>
          
          {isMaviYaka && (
            <div className={`flex items-center gap-4 p-3 pr-5 rounded-2xl border ${scoreColor} shadow-sm shrink-0 w-full lg:w-auto animate-in slide-in-from-right-4`}>
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/50">
                {scoreIcon}
              </div>
              <div>
                <div className="flex items-end gap-2 mb-0.5">
                  <span className={`text-2xl font-black leading-none ${scoreTextColor}`}>{myScore.toString().replace('.', ',')}</span>
                  <span className="text-xs font-bold text-neutral-600 mb-0.5 uppercase tracking-wider">Aylık Puan</span>
                </div>
                <p className={`text-xs font-bold ${scoreTextColor} opacity-90`}>{scoreMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* --- YENİ EKLENEN BİLGİLENDİRME PANOSU (DUYURU, PAYLAŞIM, EN İYİLER) --- */}
        {(latestInfo.announcements.length > 0 || latestInfo.posts.length > 0 || latestInfo.bestEmps.length > 0) && (
          <div className="flex flex-col gap-6 mb-2">
            
            {/* DUYURULAR (İkiden fazlası için kaydırma) */}
            {latestInfo.announcements.length > 0 && (
               <div className="flex flex-col gap-4 max-h-[340px] overflow-y-auto custom-scrollbar pr-2">
                 {latestInfo.announcements.map((ann) => (
                   <div key={ann.id} className="bg-red-50 border border-red-200 p-4 md:p-5 rounded-2xl shadow-sm flex items-start gap-4 shrink-0 relative animate-in slide-in-from-top-4">
                      {isAdmin && <button onClick={() => handleDeleteInfo('announcements', ann.id)} className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-700 bg-white rounded-lg shadow-sm border border-red-100 transition"><X className="w-4 h-4"/></button>}
                      <div className="bg-white p-3 rounded-full shrink-0 shadow-sm border border-red-100"><Bell className="w-6 h-6 text-red-600" /></div>
                      <div className="flex-1 pr-8">
                         <h3 className="text-red-800 font-black text-lg flex flex-wrap items-center gap-2">
                            {ann.title} 
                            <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full shadow-sm">DUYURU</span>
                         </h3>
                         <p className="text-red-700 text-sm font-medium mt-2 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                         <p className="text-red-500/80 text-[10px] mt-3 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {ann.dateStr} • {ann.author}</p>
                      </div>
                   </div>
                 ))}
               </div>
            )}

            {/* PAYLAŞIMLAR (İkiden fazlası için kaydırma) */}
            {latestInfo.posts.length > 0 && (
               <div className="flex flex-col gap-4 max-h-[640px] overflow-y-auto custom-scrollbar pr-2">
                 {latestInfo.posts.map((post) => (
                   <div key={post.id} className="bg-blue-50 border border-blue-200 p-4 md:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center md:items-start gap-4 shrink-0 relative animate-in slide-in-from-top-4 delay-75">
                      {isAdmin && <button onClick={() => handleDeleteInfo('posts', post.id)} className="absolute top-3 right-3 p-1.5 text-blue-400 hover:text-blue-700 bg-white rounded-lg shadow-sm border border-blue-100 transition"><X className="w-4 h-4"/></button>}
                      <div className="bg-white p-3 rounded-full shrink-0 shadow-sm border border-blue-100 hidden md:block"><Sparkles className="w-6 h-6 text-blue-600" /></div>
                      <div className="flex-1 w-full pr-8">
                         <h3 className="text-blue-800 font-black text-lg flex flex-wrap items-center gap-2 mb-2">
                            {post.title} 
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-sm">SAHADAN KARELER</span>
                         </h3>
                         {post.imageUrl && (
                            <div className="w-full max-w-sm h-48 md:h-64 rounded-xl overflow-hidden shadow-sm border border-blue-100 cursor-pointer group" onClick={() => setViewingImage && setViewingImage({title: post.title, name: post.imageUrl})}>
                               <img src={post.imageUrl} alt="Paylaşım" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                            </div>
                         )}
                         <p className="text-blue-500/80 text-[10px] mt-3 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {post.dateStr} • {post.author}</p>
                      </div>
                   </div>
                 ))}
               </div>
            )}

            {/* EN İYİLER (İkiden fazlası için kaydırma) */}
            {latestInfo.bestEmps.length > 0 && (
               <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                 {latestInfo.bestEmps.map((bestEmp) => {
                   const bestEmpPerson = personnelList?.find(p => p.fullName === bestEmp.employeeName);
                   return (
                     <div key={bestEmp.id} className="bg-yellow-50 border border-yellow-200 p-4 md:p-5 rounded-2xl shadow-sm flex items-center gap-4 shrink-0 relative animate-in slide-in-from-top-4 delay-150">
                        {isAdmin && <button onClick={() => handleDeleteInfo('bestEmployees', bestEmp.id)} className="absolute top-3 right-3 p-1.5 text-yellow-500 hover:text-yellow-700 bg-white rounded-lg shadow-sm border border-yellow-200 transition"><X className="w-4 h-4"/></button>}
                        <div className="w-14 h-14 bg-white rounded-full shrink-0 shadow-sm border border-yellow-300 flex items-center justify-center overflow-hidden relative">
                          {bestEmpPerson?.profileImage ? (
                              <img src={bestEmpPerson.profileImage} alt={bestEmpPerson.fullName} className="w-full h-full object-cover" />
                          ) : (
                              <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-1 border-2 border-white"><Star className="w-3 h-3 text-white fill-white"/></div>
                        </div>
                        <div className="flex-1 pr-8">
                           <h3 className="text-yellow-800 font-black text-lg flex flex-wrap items-center gap-2">
                              {bestEmp.title} 
                              <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full shadow-sm">EN İYİLER</span>
                           </h3>
                           <p className="text-yellow-700 text-sm font-bold mt-1.5">
                              Tebrikler <span className="text-black font-black bg-yellow-200 px-1.5 py-0.5 rounded">{bestEmp.employeeName}</span>! Başarılarının devamını dileriz. 👏
                           </p>
                           <p className="text-yellow-600/80 text-[10px] mt-3 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {bestEmp.dateStr} • {bestEmp.author}</p>
                        </div>
                     </div>
                   );
                 })}
               </div>
            )}
          </div>
        )}

        {/* Günlük Mesai Durumu Bildirimi */}
        {isMaviYaka && (dailyData.today || dailyData.yesterday) && (
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {dailyData.today && <div className="flex-1">{renderDailySummary(dailyData.today, 'Bugün')}</div>}
            {dailyData.yesterday && <div className="flex-1">{renderDailySummary(dailyData.yesterday, 'Dün')}</div>}
          </div>
        )}

        {/* --- ALINAN YORUMLAR --- */}
        {(allJobs || jobs).filter(j => j.pointsApproved && j.reviewImage).length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
            <h3 className="text-emerald-800 font-black flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 fill-emerald-600 text-emerald-600" /> Alınan Yorumlar
            </h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {(allJobs || jobs).filter(j => j.pointsApproved && j.reviewImage).sort((a,b) => new Date(b.date) - new Date(a.date)).map(rev => {
                // Sadece sistemdeki personelleri bul (dışarıdan manuel yazılanları yoksay)
                const systemPersonnelNames = personnelList
                  .filter(p => rev.assignedPersonnelIds?.includes(p.id) || rev.assignedPersonnelId === p.id)
                  .map(p => p.fullName);
                
                const uniqueNames = [...new Set(systemPersonnelNames)];

                return (
                  <div key={rev.id} className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden relative group min-w-[280px] max-w-[320px] shrink-0 flex flex-col">
                    <div className="w-full h-40 bg-neutral-100 cursor-pointer relative" onClick={() => setViewingImage && setViewingImage({title: 'Müşteri Yorumu', name: rev.reviewImage})}>
                      <img src={rev.reviewImage} alt="Müşteri Yorumu" className="w-full h-full object-cover hover:scale-105 transition duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                      <div className="absolute bottom-2 left-2 right-2 text-white">
                        <h4 className="font-bold text-sm truncate">{rev.customerName}</h4>
                        <span className="text-[10px] font-medium opacity-90">{rev.date}</span>
                      </div>
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-2 rounded-lg text-center flex items-center justify-center gap-1 border border-emerald-100 shadow-sm">
                        👏 Güzel Tebrikler! 👏
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs text-neutral-600 mt-1">
                        {uniqueNames.length > 0 && (
                          <div className="flex items-start gap-1.5">
                            <Users className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" /> 
                            <span className="font-medium leading-tight">
                              <b className="text-black block mb-0.5">Yorum Alan Ekip:</b>
                              {uniqueNames.join(', ')}
                            </span>
                          </div>
                        )}
                        {rev.assignedVehiclePlate && (
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-4 h-4 shrink-0 text-purple-600" /> 
                            <span className="font-medium">
                              <b className="text-black">Araç:</b> {rev.assignedVehiclePlate}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- DESTEK YAPANLARA TEŞEKKÜRLER --- */}
        {(allJobs || jobs).filter(j => j.pointsApproved && j.supportPersonnelIds && j.supportPersonnelIds.length > 0).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl shadow-sm relative overflow-hidden mt-6">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <h3 className="text-blue-800 font-black flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600" /> Takım Çalışması & Destek Panosu
            </h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {(allJobs || jobs).filter(j => j.pointsApproved && j.supportPersonnelIds && j.supportPersonnelIds.length > 0).sort((a,b) => new Date(b.date) - new Date(a.date)).map(job => {
                const supportNames = personnelList
                  .filter(p => job.supportPersonnelIds.includes(p.id))
                  .map(p => p.fullName);

                return (
                  <div key={'sup-'+job.id} className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden relative min-w-[280px] max-w-[320px] shrink-0 flex flex-col p-4">
                    <div className="flex items-center gap-3 mb-3 border-b border-neutral-100 pb-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs text-neutral-500 font-bold">{job.date}</p>
                        <p className="text-sm font-black text-black truncate">{job.customerName}</p>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-neutral-600 font-medium mb-3 leading-relaxed">
                        Zorlu anlarda takım arkadaşlarını yalnız bırakmayıp destek olan kahramanlarımız! Diğer takım arkadaşlarına yardımcı olduğunuz için teşekkür eder, tebrik ederiz. Harika bir iş çıkardınız! 🏆💪
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        {supportNames.map((name, i) => (
                          <span key={i} className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isMaviYaka && (
          <>
            <div className="flex justify-between items-end mt-6 mb-[-8px]">
              <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">İş İstatistikleri</h3>
              <select 
                value={filterPeriod} 
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="px-3 py-1.5 text-sm font-bold bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-red-600 transition shadow-sm cursor-pointer"
              >
                <option value="today">Bugün</option>
                <option value="month">Aylık</option>
                <option value="year">Bu Yıl</option>
                <option value="all">Tüm Zamanlar</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
                <p className="text-neutral-500 text-sm font-medium mb-1">Toplam İş</p>
                <p className="text-2xl font-black text-black mb-2">{dashboardJobs.length}</p>
                <div className="flex flex-wrap gap-1 mt-auto">
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.type === 'Nakliye' || !j.type).length} Nakliye</span>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.type === 'Depo').length} Depo</span>
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.type === 'Asansör').length} Asansör</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 flex flex-col justify-between">
                <p className="text-neutral-500 text-sm font-medium mb-1">Bekleyen</p>
                <p className="text-2xl font-black text-neutral-600 mb-2">{dashboardJobs.filter(j => j.status === 'pending').length}</p>
                <div className="flex flex-wrap gap-1 mt-auto">
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.status === 'pending' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.status === 'pending' && j.type === 'Depo').length} Depo</span>
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.status === 'pending' && j.type === 'Asansör').length} Asansör</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 border-l-4 border-l-red-600 flex flex-col justify-between">
                <p className="text-neutral-500 text-sm font-medium mb-1">Sahada (Devam)</p>
                <p className="text-2xl font-black text-red-600 mb-2">{dashboardJobs.filter(j => j.status === 'in-progress').length}</p>
                <div className="flex flex-wrap gap-1 mt-auto">
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{dashboardJobs.filter(j => j.status === 'in-progress' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{dashboardJobs.filter(j => j.status === 'in-progress' && j.type === 'Depo').length} Depo</span>
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{dashboardJobs.filter(j => j.status === 'in-progress' && j.type === 'Asansör').length} Asansör</span>
                </div>
              </div>
              <div className="bg-black p-4 rounded-2xl shadow-sm border border-black flex flex-col justify-between">
                <p className="text-neutral-400 text-sm font-medium mb-1">Tamamlanan</p>
                <p className="text-2xl font-black text-white mb-2">{dashboardJobs.filter(j => j.status === 'completed').length}</p>
                <div className="flex flex-wrap gap-1 mt-auto">
                  <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{dashboardJobs.filter(j => j.status === 'completed' && (j.type === 'Nakliye' || !j.type)).length} Nakliye</span>
                  <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{dashboardJobs.filter(j => j.status === 'completed' && j.type === 'Depo').length} Depo</span>
                  <span className="text-[10px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-700">{dashboardJobs.filter(j => j.status === 'completed' && j.type === 'Asansör').length} Asansör</span>
                </div>
              </div>
            </div>
            
            {isAdmin && (
               <AdminMaviYakaTakip jobs={allJobs} personnelList={personnelList} transactions={transactions} />
            )}
            
            <div className="grid grid-cols-1 gap-6 mt-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-80 flex flex-col">
                  <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
                    <ClipboardList className="w-5 h-5 text-red-600" /> Son Eklenen Operasyonlar
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {jobs.slice().sort((a,b) => new Date(b.id) - new Date(a.id)).slice(0, 5).map(job => (
                        <div key={job.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-black">{job.customerName}</p>
                            <p className="text-[10px] text-neutral-500">{job.date} - {job.time}</p>
                          </div>
                          <span className={`text-[9px] px-2 py-1 rounded font-bold text-white uppercase ${job.type === 'Depo' ? 'bg-blue-600' : job.type === 'Asansör' ? 'bg-green-500' : 'bg-red-600'}`}>
                            {job.type || 'Nakliye'}
                          </span>
                        </div>
                    ))}
                    {jobs.length === 0 && <p className="text-center text-neutral-400 text-xs py-4">Kayıtlı operasyon yok.</p>}
                  </div>
              </div>
            </div>
          </>
        )}

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-64 flex flex-col">
              <h3 className="text-sm font-bold text-black mb-3 flex items-center gap-2 border-b border-neutral-100 pb-2"><Briefcase className="w-4 h-4 text-red-600"/> Sistemdeki Personeller</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {personnelList.slice(0, 5).map(p => (
                  <div key={p.id} className="text-xs flex justify-between items-center p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {p.profileImage ? (
                          <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" />
                        ) : (
                          p.fullName.charAt(0)
                        )}
                      </div>
                      <span className="font-bold text-black">{p.fullName}</span>
                    </div>
                    <span className="text-neutral-500">{p.position}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-64 flex flex-col">
              <h3 className="text-sm font-bold text-black mb-3 flex items-center gap-2 border-b border-neutral-100 pb-2"><Car className="w-4 h-4 text-red-600"/> Aktif Araçlar</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {vehicles.slice(0, 5).map(v => (
                  <div key={v.id} className="text-xs flex justify-between p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                    <span className="font-bold text-black">{v.plate}</span><span className="text-neutral-500">{v.type}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-64 flex flex-col">
              <h3 className="text-sm font-bold text-black mb-3 flex items-center gap-2 border-b border-neutral-100 pb-2"><Package className="w-4 h-4 text-red-600"/> Stok Durumu (Kritik)</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {materials.sort((a,b)=>a.stock - b.stock).slice(0, 5).map(m => (
                  <div key={m.id} className="text-xs flex justify-between items-center p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                    <span className="font-bold text-black">{m.name}</span>
                    <span className={`font-black px-2 py-0.5 rounded ${m.stock <= 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{m.stock} {m.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AddInfoView = ({ currentUser, personnelList, addSystemLog }) => {
    const [infoType, setInfoType] = useState('Duyuru'); // Duyuru, Paylaşım, En İyiler
    
    // Form States
    const [announcement, setAnnouncement] = useState({ title: '', content: '' });
    const [post, setPost] = useState({ title: '', imageUrl: '' });
    const [bestEmp, setBestEmp] = useState({ title: 'Ayın En İyi Personeli', employeeName: '' });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

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

            <form onSubmit={handleSubmit} className="space-y-4">
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
                                    <img src={post.imageUrl} alt="Önizleme" className="w-full h-full object-contain bg-neutral-100" />
                                </div>
                            )}
                            {post.imageUrl === 'Yükleniyor...' && <div className="p-4 text-center font-bold text-neutral-500 animate-pulse bg-neutral-50 rounded-xl border border-neutral-200 mb-2">Görsel Yükleniyor...</div>}
                            <label className="cursor-pointer w-full py-4 bg-neutral-50 border border-neutral-300 border-dashed rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-100 transition">
                                <Upload className="w-5 h-5 text-neutral-500" />
                                <span className="text-sm font-bold text-neutral-600">Fotoğraf Yükle</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isSubmitting} />
                            </label>
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

                <button type="submit" disabled={isSubmitting || post.imageUrl === 'Yükleniyor...'} className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 mt-6">
                    <Send className="w-5 h-5" /> Yayına Al
                </button>
            </form>
        </div>
    );
  };

  const AddJobView = ({
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

          <button type="submit" className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-700 transition flex justify-center items-center gap-2 text-xl shadow-xl shadow-red-600/30">
            <PlusCircle className="w-6 h-6" /> 
            {editingJobId ? 'Kaydı Güncelle' : 'Kaydı Oluştur'}
          </button>
        </form>
      </div>
    );
  };

  const CurrentJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials, setCancelJobId, setViewingImage, setDeleteJobId }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState(''); // ARAMA STATE'İ EKLENDİ

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

                <button onClick={() => handleEstimateMaterials(job)} className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <Package className="w-4 h-4"/> ✨ Malzeme Tahmini
                </button>
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

  const CustomerListView = ({ jobs, title, handleEditJob }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Sadece başlığa göre filtreleme yapıyoruz
    const relevantJobs = title === 'Özel Müşteriler' ? jobs.filter(j => j.isSpecial) : jobs;

    // Müşterileri telefon numaralarına göre gruplayıp tekilleştiriyoruz
    const customersMap = new Map();
    relevantJobs.forEach(job => {
      if (!job.customerPhone) return;
      
      // Telefon numarasını standartlaştırma (Boşlukları temizle vb. gerekirse)
      const phoneKey = job.customerPhone.replace(/\s+/g, '');

      if (!customersMap.has(phoneKey)) {
        customersMap.set(phoneKey, {
            name: job.customerName,
            phone: job.customerPhone,
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
                    <button onClick={() => handleEditJob(c.latestJob)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 w-max">
                      <Edit className="w-3.5 h-3.5" /> Son İşe Git
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-neutral-500">Müşteri kaydı bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const AllJobsView = ({ jobs, handleEditJob, handleOpenAssignModal, handleGenerateMessage, handleEstimateMaterials, setCancelJobId, setDeleteJobId }) => {
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
                  <button onClick={() => handleEstimateMaterials(job)} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition" title="Malzeme">
                    <Package className="w-4 h-4" />
                  </button>
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

  const CompletedJobsView = ({ jobs, handleEditJob, setViewingImage, setDeleteJobId, setMarkDamageJobId, canApprovePoints, handleOpenApproveModal, handleOpenMesaiModal }) => {
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
  const CalendarView = ({ jobs, handleEditJob, currentUser, handleOpenAssignModal }) => {
    const canAssign = currentUser?.position?.includes('Operasyon') || currentUser?.position?.includes('Firma Sahibi') || currentUser?.permissions?.canEdit;
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]); 
    const [myPuantaj, setMyPuantaj] = useState({});

    const isMaviYaka = currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position));

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
      .filter(j => j.status !== 'cancelled')
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
            const coreJobs = !isMaviYaka && item ? item.jobs.filter(j => j.type !== 'Asansör') : [];
            const asansorJobs = !isMaviYaka && item ? item.jobs.filter(j => j.type === 'Asansör') : [];
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
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
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
                        {canAssign && (
                          <button onClick={() => handleOpenAssignModal(job)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-blue-200">
                            <CheckSquare className="w-3 h-3"/> {job.team !== 'Atanmadı' ? 'Görevi Düzenle' : 'Görev Ata'}
                          </button>
                        )}
                        <button onClick={() => generateContractPDF(job)} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-green-200">
                          <FileText className="w-3 h-3"/> PDF
                        </button>
                        <button onClick={() => handleEditJob(job)} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 border border-neutral-200">
                          <Edit className="w-3 h-3"/> Düzenle
                        </button>
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
  const IzinTahtasiView = ({ personnelList, db, appId, addSystemLog }) => {
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
    const maviYakaList = personnelList.filter(p => 
      p.employmentStatus === 'Aktif' && 
      (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu'].includes(p.position)))
    ).sort((a, b) => {
        const orderA = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[a.position] || 99;
        const orderB = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[b.position] || 99;
        return orderA - orderB;
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
          addSystemLog('İzin Tahtası Özel Durum', `${p.fullName} için ${specialLeaveForm.startDate} ile ${specialLeaveForm.endDate} tarihleri arasına özel durum (${typeLabel}) girildi.`);
       }

       setShowSpecialLeaveModal(false);
       setSpecialLeaveForm({ personnelId: '', type: 'R', startDate: '', endDate: '' });
       setIsSaving(false);
    };

    const handleDragStart = (e, personId) => {
      e.dataTransfer.setData('personId', personId);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
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
        
        addSystemLog('İzin Tahtası İşlemi', `${p.fullName} personeline ${targetDayObj.dateStr} tarihinde ${newStatus === 'Hİ' ? 'Haftalık İzin' : 'Devamsızlık'} girildi.`);

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

    // Filtreleme: Zaten yıllık izin, raporlu veya pasif olanları listede gösterme
    // Not: Seçili haftanın herhangi bir gününde Rapor veya Yıllık İzin varsa listeden kaldırıyoruz.
    const displayPersonnel = maviYakaList.filter(p => {
       let hasLongTermLeave = false;
       weekDays.forEach(wd => {
          const cell = mesaiData[p.id]?.[wd.dayNum];
          const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
          if (st === 'R' || st === 'Yİ' || st === 'Bİ' || st === 'Üİ') {
             hasLongTermLeave = true;
          }
       });
       return !hasLongTermLeave;
    });

    return (
      <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] animate-in fade-in pb-4">
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

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
           
           {/* SOL: GÜNLER (7 KOLON) */}
           <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-full">
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
           <div className="w-full lg:w-[160px] xl:w-[180px] h-full flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden shrink-0">
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
              <form onSubmit={handleAddSpecialLeave} className="p-6 space-y-4">
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
                <button type="submit" disabled={isSaving} className="w-full py-4 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-500/30 flex justify-center items-center gap-2 mt-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  {isSaving ? 'Kaydediliyor...' : 'Durumu Kaydet'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  };

  // --- YENİ: PUANTAJ TAHTASI BİLEŞENİ ---
  const PuantajTahtasiView = ({ personnelList, db, appId }) => {
    const today = new Date();
    // Monday of the current week
    const currentDay = today.getDay() || 7; 
    const diffToMonday = today.getDate() - currentDay + 1;
    const initialMonday = new Date(today.setDate(diffToMonday));
    initialMonday.setHours(0, 0, 0, 0);

    const [weekStart, setWeekStart] = useState(initialMonday);
    const [puantajData, setPuantajData] = useState({});
    
    // Mavi yaka ve aktif olanları filtrele
    const maviYakaList = personnelList.filter(p => 
      p.employmentStatus === 'Aktif' && 
      (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
    );

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

    const weeklySummary = maviYakaList.map(p => {
      let total = 0;
      weekDays.forEach(wd => {
        const val = puantajData[p.id]?.[wd.dayNum];
        if (val) total += parseFloat(val) || 0;
      });
      return { ...p, weeklyTotal: total };
    }).filter(p => p.weeklyTotal > 0).sort((a, b) => b.weeklyTotal - a.weeklyTotal);

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

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
           
           {/* SOL: GÜNLER (7 KOLON) */}
           <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-full">
              {weekDays.map((wd, i) => {
                 const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
                 const isWeekendDay = i === 6; // Sunday
                 
                 // Bu günde puan alan personelleri bul
                 const scoredPersons = maviYakaList.filter(p => {
                    const val = puantajData[p.id]?.[wd.dayNum];
                    return parseFloat(val) > 0;
                 }).sort((a,b) => parseFloat(puantajData[b.id]?.[wd.dayNum]) - parseFloat(puantajData[a.id]?.[wd.dayNum]));

                 return (
                    <div 
                       key={i} 
                       className={`flex-1 min-w-[140px] max-w-[200px] flex flex-col bg-white rounded-xl shadow-sm border ${isToday ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-neutral-200'} overflow-hidden shrink-0`}
                    >
                       <div className={`p-2 border-b ${isToday ? 'bg-yellow-50 border-yellow-200' : isWeekendDay ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'} text-center shrink-0`}>
                          <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-yellow-700' : isWeekendDay ? 'text-red-700' : 'text-neutral-500'}`}>{wd.dayName}</p>
                          <p className={`text-xl font-black ${isToday ? 'text-yellow-600' : isWeekendDay ? 'text-red-600' : 'text-black'}`}>{wd.dayNum}</p>
                       </div>
                       
                       <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 bg-neutral-50/50">
                          {scoredPersons.map(p => {
                             const pts = parseFloat(puantajData[p.id]?.[wd.dayNum]);
                             
                             return (
                                <div key={p.id} className={`p-2 rounded-lg border flex flex-col gap-1 shadow-sm relative group bg-white border-yellow-300 hover:border-yellow-400 transition`}>
                                   <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-neutral-200 bg-neutral-100`}>
                                         {p.profileImage ? <img src={p.profileImage} className="w-full h-full object-cover" alt="" /> : <User className={`w-3 h-3 text-neutral-400`} />}
                                      </div>
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-bold truncate text-black">{p.fullName}</span>
                                      </div>
                                   </div>
                                   <div className="flex items-center justify-center gap-1 bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5 mt-1">
                                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                      <span className="text-[10px] font-black">+{pts} Puan</span>
                                   </div>
                                </div>
                             )
                          })}
                          {scoredPersons.length === 0 && (
                             <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-200 rounded-lg text-[10px] text-neutral-400 font-bold text-center px-2 py-4">
                                Puan alan yok
                             </div>
                          )}
                       </div>
                    </div>
                 )
              })}
           </div>

           {/* SAĞ: HAFTALIK ÖZET */}
           <div className="w-full lg:w-[160px] xl:w-[200px] h-full flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden shrink-0">
              <div className="p-3 border-b border-neutral-200 bg-yellow-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-xs text-yellow-900 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" /> Haftalık Özet
                </h3>
                <span className="bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded-lg text-[10px] font-bold">{weeklySummary.length} Kişi</span>
              </div>
              <div className="p-2 bg-yellow-100/50 border-b border-yellow-200 shrink-0">
                 <p className="text-[9px] text-yellow-800 font-medium leading-tight text-center">
                    Bu haftanın en çok puan alan personelleri
                 </p>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 bg-neutral-50/30">
                 {weeklySummary.map((person, idx) => (
                       <div 
                         key={person.id}
                         className={`bg-white border rounded-xl p-2 flex items-center gap-2 shadow-sm transition hover:shadow-md border-neutral-200`}
                       >
                         <div className="relative shrink-0">
                           <div className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                             {person.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" alt="" /> : <User className="w-3 h-3 text-neutral-400" />}
                           </div>
                           {idx === 0 && <div className="absolute -top-1 -right-1 text-xs">👑</div>}
                         </div>
                         <div className="flex-1 overflow-hidden flex flex-col justify-center">
                           <h4 className="font-bold text-[10px] text-black truncate">{person.fullName}</h4>
                         </div>
                         <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0 bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center gap-0.5`}>
                            {person.weeklyTotal} <Star className="w-2.5 h-2.5 fill-yellow-600 text-yellow-600"/>
                         </span>
                       </div>
                    ))}
                 {weeklySummary.length === 0 && (
                    <p className="text-center text-[10px] text-neutral-500 italic py-4">Henüz puan kazanan yok.</p>
                 )}
              </div>
           </div>

        </div>
      </div>
    );
  };

  const MaviMesaiTahtasiView = ({ personnelList, db, appId }) => {
    const today = new Date();
    const currentDay = today.getDay() || 7; 
    const diffToMonday = today.getDate() - currentDay + 1;
    const initialMonday = new Date(today.setDate(diffToMonday));
    initialMonday.setHours(0, 0, 0, 0);

    const [weekStart, setWeekStart] = useState(initialMonday);
    const [mesaiData, setMesaiData] = useState({});
    
    // Mavi yaka ve aktif olanları filtrele
    const maviYakaList = personnelList.filter(p => 
      p.employmentStatus === 'Aktif' && 
      (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))
    ).sort((a, b) => {
        const orderA = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[a.position] || 99;
        const orderB = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 }[b.position] || 99;
        return orderA - orderB;
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
        <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-full">
          {weekDays.map((wd, i) => {
             const isToday = wd.dateStr === new Date().toISOString().split('T')[0];
             const isWeekendDay = i === 6; // Sunday
             
             // İstatistikleri hesapla
             let presentCount = 0;
             let absentCount = 0;
             let emptyCount = 0;

             maviYakaList.forEach(p => {
                const cell = mesaiData[p.id]?.[wd.dayNum];
                const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                if (!st) emptyCount++;
                else if (['G', 'FG', 'FGM', 'FM', 'EM'].includes(st)) presentCount++;
                else absentCount++;
             });

             // Personelleri sırala: İşlemi Olanlar (G, FM vs) > İzinliler > Boş Olanlar
             const sortedPersonnelForDay = [...maviYakaList].sort((a, b) => {
                const cellA = mesaiData[a.id]?.[wd.dayNum];
                const stA = typeof cellA === 'object' && cellA !== null ? cellA.status : cellA;
                
                const cellB = mesaiData[b.id]?.[wd.dayNum];
                const stB = typeof cellB === 'object' && cellB !== null ? cellB.status : cellB;

                const getWeight = (status) => {
                   if (!status) return 3; // En altta
                   if (['G', 'FG', 'FGM', 'FM', 'EM'].includes(status)) return 1; // En üstte
                   return 2; // İzinli/Devamsız ortada
                };

                return getWeight(stA) - getWeight(stB);
             });

             return (
                <div 
                   key={i} 
                   className={`flex-1 min-w-[220px] max-w-[280px] flex flex-col bg-white rounded-xl shadow-sm border ${isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} overflow-hidden shrink-0`}
                >
                   {/* Sütun Başlığı */}
                   <div className={`p-3 border-b ${isToday ? 'bg-blue-50 border-blue-200' : isWeekendDay ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'} shrink-0 flex flex-col items-center justify-center relative`}>
                      {isToday && <span className="absolute top-1 left-2 text-[8px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded shadow-sm">BUGÜN</span>}
                      <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-700' : isWeekendDay ? 'text-red-700' : 'text-neutral-500'}`}>{wd.dayName}</p>
                      <p className={`text-2xl font-black ${isToday ? 'text-blue-600' : isWeekendDay ? 'text-red-600' : 'text-black'}`}>{wd.dayNum}</p>
                      
                      {/* Günlük Özet Logları */}
                      <div className="flex gap-1.5 mt-2 w-full justify-center">
                         <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200" title="Mevcut">{presentCount} Mevcut</span>
                         <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200" title="İzinli / Devamsız">{absentCount} Yok</span>
                      </div>
                   </div>
                   
                   {/* Personel Listesi */}
                   <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-2 bg-neutral-50/50">
                      {sortedPersonnelForDay.map(p => {
                         const cell = mesaiData[p.id]?.[wd.dayNum];
                         const st = typeof cell === 'object' && cell !== null ? cell.status : cell;
                         const hr = typeof cell === 'object' && cell !== null ? cell.hours : '';
                         
                         const option = MESAI_STATUS_OPTIONS.find(o => o.code === st);
                         const isPresent = ['G', 'FG', 'FGM', 'FM', 'EM'].includes(st);
                         const isMissing = st && !isPresent;
                         
                         return (
                            <div key={p.id} className={`p-2 rounded-lg border flex flex-col gap-1.5 shadow-sm transition-colors ${st ? 'bg-white border-neutral-200' : 'bg-transparent border-transparent opacity-60'}`}>
                               <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                     <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden border ${isPresent ? 'border-green-300' : isMissing ? 'border-red-300' : 'border-neutral-200 bg-neutral-100'}`}>
                                        {p.profileImage ? <img src={p.profileImage} className="w-full h-full object-cover" alt="" /> : <User className="w-3 h-3 text-neutral-400" />}
                                     </div>
                                     <span className="text-[11px] font-bold text-black truncate">{p.fullName}</span>
                                  </div>
                               </div>
                               
                               <div className="flex justify-between items-center bg-neutral-50 p-1 rounded border border-neutral-100 min-h-[24px]">
                                  {st ? (
                                    <>
                                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${option?.color || 'bg-neutral-200 text-neutral-700'}`}>
                                          {option?.label || st}
                                       </span>
                                       {hr && <span className="text-[9px] font-bold text-neutral-600">{hr} Saat</span>}
                                    </>
                                  ) : (
                                     <span className="text-[9px] font-medium text-neutral-400 italic px-1">Kayıt Girilmedi</span>
                                  )}
                               </div>
                            </div>
                         )
                      })}
                      {sortedPersonnelForDay.length === 0 && (
                         <div className="h-full flex items-center justify-center text-[10px] text-neutral-400 font-bold text-center px-2 py-4">
                            Personel Bulunamadı
                         </div>
                      )}
                   </div>
                </div>
             )
          })}
        </div>
      </div>
    );
  };

  const ReportingView = ({ jobs, personnelList }) => {
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
              <option value="Tüm Personeller">Tüm Personeller</option>
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

    const changeTaskStatus = (taskId, newStatus) => {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
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

                    {/* HIZLI İŞLEM BUTONLARI */}
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100">
                      <button onClick={() => deleteTask(task.id)} className="flex-1 py-1.5 px-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg transition border border-red-100 text-center">Görevi Sil</button>
                      {task.status === 'todo' && (
                        <>
                          <button onClick={() => changeTaskStatus(task.id, 'in-progress')} className="flex-1 py-1.5 px-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg transition border border-blue-100 text-center">İşleme Alındı</button>
                          <button onClick={() => changeTaskStatus(task.id, 'completed')} className="flex-1 py-1.5 px-1 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold rounded-lg transition border border-green-100 text-center">Tamamlandı</button>
                        </>
                      )}
                      {task.status === 'in-progress' && (
                        <button onClick={() => changeTaskStatus(task.id, 'completed')} className="flex-1 py-1.5 px-1 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold rounded-lg transition border border-green-100 text-center">Tamamlandı</button>
                      )}
                      {task.status === 'completed' && (
                        <button onClick={() => changeTaskStatus(task.id, 'todo')} className="flex-1 py-1.5 px-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-bold rounded-lg transition border border-neutral-200 text-center">Geri Al</button>
                      )}
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
    const [formData, setFormData] = useState({ fullName: '', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: '', rank: '', employmentStatus: 'Aktif', email: '', password: '', profileImage: '', collarType: 'Mavi Yaka', startDate: '', setCardNo: '', maas: '', yol: '', yemek: '', bankaParasi: '', icrasiVar: 'Hayır' });
    const [isUploading, setIsUploading] = useState(false);
    
    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploading(true);
      setFormData(prev => ({ ...prev, profileImage: 'Yükleniyor...' }));

      const uploadData = new FormData();
      uploadData.append('file', file);

      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', {
          method: 'POST',
          body: uploadData,
        });
        const text = await res.text();
        let uploadedUrl = file.name;
        try {
          const json = JSON.parse(text);
          uploadedUrl = json.url || json.fileName || json.file || text;
        } catch (err) {
          uploadedUrl = text.trim();
        }
        setFormData(prev => ({ ...prev, profileImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Görsel yüklenemedi.");
        setFormData(prev => ({ ...prev, profileImage: '' }));
      }
      setIsUploading(false);
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      onAdd({ id: Date.now(), ...formData });
      setFormData({ fullName: '', tcNo: '', birthDate: '', companyPhone: '', personalPhone: '', position: '', rank: '', employmentStatus: 'Aktif', email: '', password: '', profileImage: '', collarType: 'Mavi Yaka', startDate: '', setCardNo: '', maas: '', yol: '', yemek: '', bankaParasi: '', icrasiVar: 'Hayır' });
    };

    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <UserPlus className="w-7 h-7 text-red-600" /> Personel Ekle
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 mb-2 flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="w-20 h-20 rounded-full border-2 border-white shadow-sm overflow-hidden bg-neutral-200 flex items-center justify-center shrink-0">
                {formData.profileImage === 'Yükleniyor...' ? (
                  <span className="text-[10px] text-neutral-500 font-bold animate-pulse">Yükleniyor</span>
                ) : formData.profileImage ? (
                  <img src={formData.profileImage} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <UserPlus className="w-8 h-8 text-neutral-400" />
                )}
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <label className="block text-sm font-bold text-neutral-700">Profil Fotoğrafı</label>
                <label className="cursor-pointer px-4 py-2 bg-white border border-neutral-300 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-50 transition w-full sm:w-fit shadow-sm">
                  <Upload className="w-4 h-4 text-neutral-600" />
                  <span className="text-sm font-bold text-neutral-700">Fotoğraf Yükle</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>
              </div>
            </div>
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
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">İşe Başlama Tarihi</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">SetCard Numarası</label>
              <input type="text" name="setCardNo" value={formData.setCardNo} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="SetCard Numarası" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Yaka Tipi *</label>
              <select required name="collarType" value={formData.collarType} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                <option value="Mavi Yaka">Mavi Yaka</option>
                <option value="Beyaz Yaka">Beyaz Yaka</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Maaş Ücreti (TL)</label>
              <input type="number" name="maas" value={formData.maas} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Yol Parası (TL)</label>
              <input type="number" name="yol" value={formData.yol} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Yemek Parası (TL)</label>
              <input type="number" name="yemek" value={formData.yemek} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Banka Parası (Aylık TL)</label>
              <input type="number" name="bankaParasi" value={formData.bankaParasi} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="Örn: 17000" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">İcrası Var mı?</label>
              <select name="icrasiVar" value={formData.icrasiVar} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
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
              <label className="block text-sm font-bold text-neutral-700 mb-1">Personel Durumu *</label>
              <select required name="employmentStatus" value={formData.employmentStatus} onChange={handleInputChange} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                <option value="Aktif">Aktif (Çalışıyor)</option>
                <option value="Pasif">Pasif (İşten Ayrıldı / Erişim Yok)</option>
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
    const [isUploading, setIsUploading] = useState(false);

    // Filtreleme State'leri
    const [filterCollar, setFilterCollar] = useState('Tümü');
    const [filterPosition, setFilterPosition] = useState('Tümü');
    const [filterRank, setFilterRank] = useState('Tümü');

    const filteredPersonnel = personnelList.filter(p => {
      if (filterCollar !== 'Tümü' && (p.collarType || 'Belirtilmedi') !== filterCollar) return false;
      if (filterPosition !== 'Tümü' && p.position !== filterPosition) return false;
      if (filterRank !== 'Tümü' && p.rank !== filterRank) return false;
      return true;
    });

    const openEdit = (person) => {
      setEditingPerson(person);
      setEditForm(person);
    };

    const saveEdit = (e) => {
      e.preventDefault();
      onUpdate(editForm);
      setEditingPerson(null);
    };

    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploading(true);
      setEditForm(prev => ({ ...prev, profileImage: 'Yükleniyor...' }));

      const uploadData = new FormData();
      uploadData.append('file', file);

      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', {
          method: 'POST',
          body: uploadData,
        });
        const text = await res.text();
        let uploadedUrl = file.name;
        try {
          const json = JSON.parse(text);
          uploadedUrl = json.url || json.fileName || json.file || text;
        } catch (err) {
          uploadedUrl = text.trim();
        }
        setEditForm(prev => ({ ...prev, profileImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Görsel yüklenemedi.");
        setEditForm(prev => ({ ...prev, profileImage: '' }));
      }
      setIsUploading(false);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2 shrink-0">
            <Briefcase className="w-6 h-6 text-red-600" /> {title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select value={filterCollar} onChange={e => setFilterCollar(e.target.value)} className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none cursor-pointer">
               <option value="Tümü">Tüm Yakalar</option>
               <option value="Mavi Yaka">Mavi Yaka</option>
               <option value="Beyaz Yaka">Beyaz Yaka</option>
            </select>
            <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)} className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none cursor-pointer max-w-[150px] truncate">
               <option value="Tümü">Tüm Pozisyonlar</option>
               {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterRank} onChange={e => setFilterRank(e.target.value)} className="px-3 py-1.5 text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-xl outline-none cursor-pointer max-w-[150px] truncate">
               <option value="Tümü">Tüm Rütbeler</option>
               {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-white border-b border-neutral-200">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Ad Soyad</th>
                <th className="p-4 font-bold">İletişim</th>
                <th className="p-4 font-bold">Pozisyon / Rütbe</th>
                <th className="p-4 font-bold">Yaka Tipi</th>
                <th className="p-4 font-bold">Çalışma Durumu</th>
                <th className="p-4 font-bold rounded-tr-xl">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPersonnel.map(person => (
                <tr key={person.id} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {person.profileImage ? (
                          <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                        ) : (
                          person.fullName.charAt(0)
                        )}
                      </div>
                      {person.fullName}
                    </div>
                  </td>
                  <td className="p-4 text-neutral-600">
                    <div className="flex flex-col gap-1 text-xs font-medium">
                      {person.personalPhone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-neutral-400"/> {person.personalPhone}</span>}
                      {person.companyPhone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-neutral-400"/> Şirket: {person.companyPhone}</span>}
                      {person.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-neutral-400"/> {person.email}</span>}
                      {person.startDate && <span className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3 text-neutral-400"/> Başlama: {person.startDate}</span>}
                      {person.setCardNo && <span className="flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-neutral-400"/> SetCard: {person.setCardNo}</span>}
                      {!person.personalPhone && !person.companyPhone && !person.email && !person.startDate && !person.setCardNo && <span className="text-neutral-400 italic">Belirtilmedi</span>}
                    </div>
                  </td>
                  <td className="p-4 text-neutral-600">
                    <span className="font-bold">{person.position}</span><br/>
                    <span className="text-xs text-neutral-500">{person.rank}</span>
                  </td>
                  <td className="p-4 text-neutral-600">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase whitespace-nowrap ${person.collarType === 'Beyaz Yaka' ? 'bg-neutral-100 text-neutral-700 border border-neutral-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                      {person.collarType || 'Belirtilmedi'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase whitespace-nowrap ${
                      (person.employmentStatus === 'Aktif' || !person.employmentStatus) ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {person.employmentStatus || 'Aktif'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => openEdit(person)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Personeli Düzenle">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPersonnel.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-neutral-500">Kayıtlı personel bulunamadı veya arama kriterlerine uyan personel yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingPerson && (
          <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 w-full max-w-4xl animate-in zoom-in-95 my-8">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <Edit className="w-6 h-6 text-red-600" /> Personel Bilgilerini Düzenle
              </h3>
              <form onSubmit={saveEdit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 mb-2 flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="w-20 h-20 rounded-full border-2 border-white shadow-sm overflow-hidden bg-neutral-200 flex items-center justify-center shrink-0">
                      {editForm.profileImage === 'Yükleniyor...' ? (
                        <span className="text-[10px] text-neutral-500 font-bold animate-pulse">Yükleniyor</span>
                      ) : editForm.profileImage ? (
                        <img src={editForm.profileImage} alt="Profil" className="w-full h-full object-cover" />
                      ) : (
                        <UserPlus className="w-8 h-8 text-neutral-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <label className="block text-sm font-bold text-neutral-700">Profil Fotoğrafı</label>
                      <label className="cursor-pointer px-4 py-2 bg-white border border-neutral-300 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-50 transition w-full sm:w-fit shadow-sm">
                        <Upload className="w-4 h-4 text-neutral-600" />
                        <span className="text-sm font-bold text-neutral-700">Fotoğraf Yükle</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Ad Soyad *</label>
                    <input required type="text" value={editForm.fullName || ''} onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">TC Kimlik No</label>
                    <input type="text" value={editForm.tcNo || ''} onChange={(e) => setEditForm({...editForm, tcNo: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Kişisel Telefon</label>
                    <input type="tel" value={editForm.personalPhone || ''} onChange={(e) => setEditForm({...editForm, personalPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Şirket Telefonu</label>
                    <input type="tel" value={editForm.companyPhone || ''} onChange={(e) => setEditForm({...editForm, companyPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İşe Başlama Tarihi</label>
                    <input type="date" value={editForm.startDate || ''} onChange={(e) => setEditForm({...editForm, startDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">SetCard Numarası</label>
                    <input type="text" value={editForm.setCardNo || ''} onChange={(e) => setEditForm({...editForm, setCardNo: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" placeholder="SetCard Numarası" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Yaka Tipi *</label>
                    <select required value={editForm.collarType || 'Mavi Yaka'} onChange={(e) => setEditForm({...editForm, collarType: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                      <option value="Mavi Yaka">Mavi Yaka</option>
                      <option value="Beyaz Yaka">Beyaz Yaka</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Maaş Ücreti (TL)</label>
                    <input type="number" value={editForm.maas || ''} onChange={(e) => setEditForm({...editForm, maas: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Yol Parası (TL)</label>
                    <input type="number" value={editForm.yol || ''} onChange={(e) => setEditForm({...editForm, yol: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Yemek Parası (TL)</label>
                    <input type="number" value={editForm.yemek || ''} onChange={(e) => setEditForm({...editForm, yemek: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Banka Parası (Aylık TL)</label>
                    <input type="number" value={editForm.bankaParasi || ''} onChange={(e) => setEditForm({...editForm, bankaParasi: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">İcrası Var mı?</label>
                    <select value={editForm.icrasiVar || 'Hayır'} onChange={(e) => setEditForm({...editForm, icrasiVar: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                      <option value="Hayır">Hayır</option>
                      <option value="Evet">Evet</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-neutral-700">Pozisyonu *</label>
                    <select required className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 bg-white" value={editForm.position || ''} onChange={(e) => setEditForm({...editForm, position: e.target.value})}>
                      <option value="">Seçiniz</option>
                      {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-neutral-700">Rütbesi *</label>
                    <select required className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 bg-white" value={editForm.rank || ''} onChange={(e) => setEditForm({...editForm, rank: e.target.value})}>
                      <option value="">Seçiniz</option>
                      {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Personel Durumu *</label>
                    <select required value={editForm.employmentStatus || 'Aktif'} onChange={(e) => setEditForm({...editForm, employmentStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                      <option value="Aktif">Aktif (Çalışıyor)</option>
                      <option value="Pasif">Pasif (İşten Ayrıldı / Erişim Yok)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">E-Posta (Sisteme Giriş İçin)</label>
                    <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 mb-1">Şifre (Sisteme Giriş İçin)</label>
                    <input type="text" value={editForm.password || ''} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200">
                  <button type="button" onClick={() => setEditingPerson(null)} className="flex-1 py-4 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition">İptal</button>
                  <button type="submit" disabled={isUploading} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-600/30 disabled:opacity-50">Değişiklikleri Kaydet</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ComplaintsView = ({ complaints, updateComplaintStatus, deleteComplaint }) => {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" /> Şikayet ve Bildirimler
        </h2>
        <div className="space-y-4">
          {complaints.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 font-medium bg-neutral-50 rounded-xl border border-neutral-200">
              Sistemde kayıtlı şikayet veya bildirim bulunmuyor.
            </div>
          ) : (
            complaints.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(complaint => (
              <div key={complaint.id} className={`p-5 rounded-xl border transition ${complaint.read ? 'bg-white border-neutral-200' : 'bg-red-50/30 border-red-200'}`}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-3 border-b border-neutral-100 pb-3 gap-3">
                  <div>
                    <h3 className="font-bold text-black text-lg flex items-center gap-2">
                      {!complaint.read && <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>}
                      {complaint.subject}
                    </h3>
                    <div className="text-xs text-neutral-500 mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-neutral-700">{complaint.senderName} ({complaint.senderPosition})</span>
                      <span>•</span>
                      <span>{complaint.dateStr}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select 
                      value={complaint.status}
                      onChange={(e) => updateComplaintStatus(complaint.id, e.target.value, true)}
                      className={`text-xs font-bold px-3 py-2 rounded-lg border outline-none cursor-pointer transition ${
                        complaint.status === 'Yeni' ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-600' :
                        complaint.status === 'İnceleniyor' ? 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-600' :
                        'bg-green-50 text-green-700 border-green-200 focus:ring-green-600'
                      }`}
                    >
                      <option value="Yeni">Yeni</option>
                      <option value="İnceleniyor">İnceleniyor</option>
                      <option value="Çözüldü">Çözüldü</option>
                    </select>
                    <button onClick={() => deleteComplaint(complaint.id)} className="p-2 bg-neutral-100 hover:bg-red-100 text-neutral-500 hover:text-red-600 rounded-lg transition" title="Sil">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{complaint.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const OzlukDosyalariView = ({ personnelList, db, appId, addSystemLog, setViewingImage }) => {
    const [filterCollar, setFilterCollar] = useState('Mavi Yaka');
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [uploadingCategory, setUploadingCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const documentCategories = [
      "Personel Kimlik",
      "Personel Ehliyet Ve diğer vb belgeler",
      "Personel İş Güvenliği",
      "Personel Sağlık Raporu",
      "Personel Sigorta Giriş",
      "Personel Tutanakları",
      "Personel Dilekçe Şikayet",
      "Personel Ücretsiz izinleri",
      "Personel Ücretli İzinleri",
      "Personel Devamsızlık tutanakları",
      "Personel Diğer Belgeleri"
    ];

    const filteredPersonnel = personnelList.filter(p => {
      if (p.position === 'Firma Sahibi') return false;
      if (p.collarType !== filterCollar && !(filterCollar === 'Mavi Yaka' && !p.collarType)) return false;
      if (searchQuery.trim() && !p.fullName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    const handleFileUpload = async (e, category) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploadingCategory(category);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { 
          const json = JSON.parse(text); 
          uploadedUrl = json.url || json.fileName || json.file || text; 
        } catch (err) { 
          uploadedUrl = text.trim(); 
        }

        const currentFiles = selectedPerson.ozlukDosyasi?.[category] || [];
        const newFile = { 
          name: file.name, 
          url: uploadedUrl, 
          date: new Date().toLocaleDateString('tr-TR') 
        };
        const updatedOzluk = { ...(selectedPerson.ozlukDosyasi || {}), [category]: [...currentFiles, newFile] };
        
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), {
          ozlukDosyasi: updatedOzluk
        });

        setSelectedPerson({ ...selectedPerson, ozlukDosyasi: updatedOzluk });
        addSystemLog('Özlük Dosyası Eklendi', `${selectedPerson.fullName} personeline ait "${category}" bölümüne yeni belge eklendi.`);
        
      } catch (err) {
        alert('Yükleme sırasında hata oluştu.');
      }
      setUploadingCategory(null);
    };

    const handleDeleteFile = async (category, fileIndex) => {
      if (!window.confirm('Bu belgeyi kalıcı olarak silmek istediğinize emin misiniz?')) return;
      
      const currentFiles = selectedPerson.ozlukDosyasi?.[category] || [];
      const newFiles = currentFiles.filter((_, i) => i !== fileIndex);
      const updatedOzluk = { ...(selectedPerson.ozlukDosyasi || {}), [category]: newFiles };
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', selectedPerson.id), {
        ozlukDosyasi: updatedOzluk
      });

      setSelectedPerson({ ...selectedPerson, ozlukDosyasi: updatedOzluk });
      addSystemLog('Özlük Dosyası Silindi', `${selectedPerson.fullName} personeline ait "${category}" bölümünden bir belge silindi.`);
    };

    if (selectedPerson) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in slide-in-from-right-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-200 pb-4 mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedPerson(null)} 
                className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden border-2 border-white shadow-sm shrink-0">
                  {selectedPerson.profileImage ? (
                    <img src={selectedPerson.profileImage} alt={selectedPerson.fullName} className="w-full h-full object-cover" />
                  ) : (
                    selectedPerson.fullName.charAt(0)
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-black">{selectedPerson.fullName} <span className="text-sm font-medium text-neutral-500">/ Özlük Dosyası</span></h2>
                  <p className="text-xs font-bold text-neutral-500 mt-0.5">{selectedPerson.position} • {selectedPerson.rank} • {selectedPerson.collarType || 'Mavi Yaka'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documentCategories.map((cat, idx) => {
              const files = selectedPerson.ozlukDosyasi?.[cat] || [];
              return (
                <div key={idx} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="flex justify-between items-center mb-3 border-b border-neutral-200 pb-2">
                    <h3 className="font-bold text-black text-sm flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-red-600" /> {cat}
                    </h3>
                    <span className="text-xs font-bold bg-white text-neutral-600 px-2 py-1 rounded shadow-sm border border-neutral-200">{files.length} Belge</span>
                  </div>
                  
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto custom-scrollbar">
                    {files.map((file, fIdx) => (
                      <div key={fIdx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm group">
                        <div className="flex items-center gap-2 overflow-hidden pr-2">
                          <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold text-neutral-800 truncate" title={file.name}>{file.name}</span>
                            <span className="text-[9px] text-neutral-500 font-medium">{file.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => setViewingImage({ title: `${cat} Belgesi`, name: file.url })} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition" title="Görüntüle">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteFile(cat, fIdx)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition" title="Sil">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {files.length === 0 && (
                      <p className="text-xs text-neutral-400 italic py-2">Henüz bu kategoriye belge eklenmemiş.</p>
                    )}
                  </div>
                  
                  <label className={`cursor-pointer w-full py-2.5 bg-white border border-neutral-300 border-dashed rounded-lg flex items-center justify-center gap-2 hover:bg-neutral-100 transition shadow-sm ${uploadingCategory === cat ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingCategory === cat ? (
                      <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-neutral-500" />
                    )}
                    <span className="text-xs font-bold text-neutral-600">{uploadingCategory === cat ? 'Yükleniyor...' : 'Yeni Belge Yükle'}</span>
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, cat)} disabled={uploadingCategory !== null} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2 shrink-0">
            <FolderOpen className="w-6 h-6 text-red-600" /> Personel Özlük Dosyaları
          </h2>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Personel Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition"
              />
            </div>
            <div className="flex bg-neutral-100 p-1 rounded-xl shrink-0">
              <button 
                onClick={() => setFilterCollar('Mavi Yaka')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${filterCollar === 'Mavi Yaka' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Mavi Yaka
              </button>
              <button 
                onClick={() => setFilterCollar('Beyaz Yaka')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${filterCollar === 'Beyaz Yaka' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
              >
                Beyaz Yaka
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPersonnel.map(person => {
            let totalDocs = 0;
            if (person.ozlukDosyasi) {
               Object.values(person.ozlukDosyasi).forEach(arr => totalDocs += arr.length);
            }
            
            return (
              <div 
                key={person.id} 
                onClick={() => setSelectedPerson(person)}
                className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-4 cursor-pointer transition group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-600/5 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0 shadow-sm">
                    {person.profileImage ? (
                      <img src={person.profileImage} alt={person.fullName} className="w-full h-full object-cover" />
                    ) : (
                      person.fullName.charAt(0)
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-black text-sm truncate">{person.fullName}</h3>
                    <p className="text-[10px] font-medium text-neutral-500 truncate">{person.position}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-neutral-200 relative z-10">
                  <span className="text-xs font-bold text-neutral-600 flex items-center gap-1.5 bg-white px-2 py-1 rounded shadow-sm border border-neutral-200">
                    <FolderOpen className="w-3.5 h-3.5 text-red-600" /> {totalDocs} Evrak
                  </span>
                  <span className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-1 rounded border border-red-100 group-hover:bg-red-600 group-hover:text-white transition">
                    Dosyayı Aç
                  </span>
                </div>
              </div>
            );
          })}
          {filteredPersonnel.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500 font-medium border-2 border-dashed border-neutral-200 rounded-2xl">
              Bu kategoriye uygun personel bulunamadı.
            </div>
          )}
        </div>
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
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {p.profileImage ? (
                          <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" />
                        ) : (
                          p.fullName.charAt(0)
                        )}
                      </div>
                      <div>
                        {p.fullName}
                        <span className="block text-xs text-neutral-500 font-medium mt-0.5">{p.position} - {p.rank}</span>
                      </div>
                    </div>
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
                <td className="p-4 font-bold text-black">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                      {p.profileImage ? (
                        <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" />
                      ) : (
                        p.fullName.charAt(0)
                      )}
                    </div>
                    {p.fullName}
                  </div>
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

  const ModuleAccessView = ({ personnelList, handleUpdateModuleAccess, currentUser }) => {
    const [editingUser, setEditingUser] = useState(null);
    const [modules, setModules] = useState({});

    // Eski rollere göre fallback izinleri (Arayüz varsayılanları)
    const getFallbackAccess = (user) => {
      const isManager = user.position?.includes('Yönetici') || user.position?.includes('Firma Sahibi') || user.rank === 'Müdür';
      const isMuhasebe = user.position?.includes('Muhasebe');
      const isDepo = user.position?.includes('Depo Sorumlusu') || user.position?.includes('Depo');
      const isSales = user.position?.includes('Satış');
      const canEdit = user.permissions?.canEdit;
      
      const jobAcc = canEdit || isManager || isMuhasebe || isDepo;
      const resAcc = isManager || isMuhasebe || (canEdit && !isSales && !isDepo);
      const finAcc = isManager || isMuhasebe || (canEdit && !isSales && !isDepo);
      const taskAcc = isManager || (canEdit && !isSales && !isDepo && !isMuhasebe);
      const admAcc = isManager || (canEdit && !isSales && !isDepo && !isMuhasebe);

      return {
        dashboard: true, calendar: true, addJob: jobAcc, jobList: jobAcc, tasks: taskAcc, customers: jobAcc,
        personnel: resAcc, vehicles: resAcc, materials: resAcc, finance: finAcc, auth: admAcc, systemFiles: admAcc
      };
    };

    const moduleGroups = [
      { title: 'Genel Menüler', items: [{ key: 'dashboard', label: 'Anasayfa' }, { key: 'calendar', label: 'Takvim' }] },
      { title: 'Operasyon & İşlem', items: [{ key: 'addJob', label: 'Kayıt Aç' }, { key: 'jobList', label: 'İş Listesi' }, { key: 'tasks', label: 'Görev Listesi' }, { key: 'customers', label: 'Müşteri Listesi' }] },
      { title: 'Kaynak & Envanter', items: [{ key: 'personnel', label: 'Personel Listesi' }, { key: 'vehicles', label: 'Araç Listesi' }, { key: 'materials', label: 'Malzeme Listesi' }] },
      { title: 'Yönetim & Yetki', items: [{ key: 'finance', label: 'Finans Yönetimi' }, { key: 'auth', label: 'Yetkilendirme' }, { key: 'systemFiles', label: 'Sistem Dosyaları' }] }
    ];

    const openEdit = (user) => {
      setEditingUser(user);
      const fallback = getFallbackAccess(user);
      setModules({ ...fallback, ...(user.permissions?.modules || {}) });
    };

    const handleSave = () => {
      handleUpdateModuleAccess(editingUser.id, modules);
      setEditingUser(null);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Shield className="w-6 h-6 text-red-600" /> Modül Görüntüleme İzinleri
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black text-white rounded-t-xl">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Personel</th>
                <th className="p-4 font-bold">Pozisyon / Rütbe</th>
                <th className="p-4 font-bold text-center rounded-tr-xl">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {personnelList.map(p => (
                <tr key={p.id} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {p.profileImage ? <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" /> : p.fullName.charAt(0)}
                      </div>
                      {p.fullName}
                    </div>
                  </td>
                  <td className="p-4 text-neutral-600">
                    <span className="font-bold text-black block">{p.position}</span>
                    <span className="text-xs text-neutral-500">{p.rank}</span>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => openEdit(p)} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl transition flex items-center gap-2 mx-auto shadow-sm">
                      <CheckSquare className="w-4 h-4" /> Modülleri Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-3xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-neutral-200 pb-4 mb-4 shrink-0">
                <h3 className="font-black text-xl text-black flex items-center gap-2">
                  <Shield className="w-6 h-6 text-red-600" /> {editingUser.fullName} - Modül Erişimleri
                </h3>
                <button onClick={() => setEditingUser(null)} className="text-neutral-400 hover:text-black transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-6">
                <p className="text-sm font-medium text-neutral-600 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                  Aşağıdaki anahtarları kullanarak personelin sol menüde hangi sekmeleri görüntüleyebileceğini aktif veya pasif hale getirebilirsiniz.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {moduleGroups.map((group, gIdx) => (
                    <div key={gIdx} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                      <h4 className="bg-neutral-100 font-bold text-black p-3 border-b border-neutral-200 text-sm">{group.title}</h4>
                      <div className="p-3 divide-y divide-neutral-100">
                        {group.items.map(item => (
                          <div key={item.key} className="flex justify-between items-center py-2.5">
                            <span className="text-sm font-medium text-neutral-700">{item.label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={modules[item.key] || false} 
                                onChange={(e) => setModules(prev => ({ ...prev, [item.key]: e.target.checked }))} 
                              />
                              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200 shrink-0">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition">Vazgeç</button>
                <button type="button" onClick={handleSave} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-600/30">Erişim İzinlerini Kaydet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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

  const VehicleMaintenanceView = ({ vehicles, onUpdateVehicle, addSystemLog }) => {
    const [selectedPlate, setSelectedPlate] = useState('');
    const [innerTab, setInnerTab] = useState('history'); // history, periodic, inspection
    
    // Form States
    const [historyForm, setHistoryForm] = useState({ date: new Date().toISOString().split('T')[0], title: '', cost: '', notes: '' });
    const [periodicForm, setPeriodicForm] = useState({ type: 'Genel Bakım', targetKm: '', targetDate: '', notes: '' });
    const [inspectionForm, setInspectionForm] = useState({ lastDate: '', nextDate: '', cost: '', notes: '' });

    const selectedVehicle = vehicles.find(v => v.plate === selectedPlate);

    useEffect(() => {
      if (selectedVehicle && selectedVehicle.inspectionRecord) {
        setInspectionForm(selectedVehicle.inspectionRecord);
      } else {
        setInspectionForm({ lastDate: '', nextDate: '', cost: '', notes: '' });
      }
    }, [selectedPlate, vehicles]);

    const handleAddHistory = (e) => {
      e.preventDefault();
      if (!selectedVehicle) return;
      
      const newRecord = { id: Date.now(), ...historyForm };
      const updatedHistory = [...(selectedVehicle.maintenanceHistory || []), newRecord];
      
      onUpdateVehicle({ ...selectedVehicle, maintenanceHistory: updatedHistory });
      addSystemLog('Araç Bakım Kaydı', `${selectedVehicle.plate} plakalı araca yeni bir geçmiş bakım kaydı eklendi.`);
      setHistoryForm({ date: new Date().toISOString().split('T')[0], title: '', cost: '', notes: '' });
    };

    const handleDeleteHistory = (id) => {
      if (!selectedVehicle) return;
      const updatedHistory = selectedVehicle.maintenanceHistory.filter(h => h.id !== id);
      onUpdateVehicle({ ...selectedVehicle, maintenanceHistory: updatedHistory });
    };

    const handleAddPeriodic = (e) => {
      e.preventDefault();
      if (!selectedVehicle) return;
      
      const newRecord = { id: Date.now(), ...periodicForm, status: 'Bekliyor' };
      const updatedPeriodic = [...(selectedVehicle.periodicMaintenances || []), newRecord];
      
      onUpdateVehicle({ ...selectedVehicle, periodicMaintenances: updatedPeriodic });
      addSystemLog('Periyodik Bakım Planlandı', `${selectedVehicle.plate} plakalı araca yeni bir periyodik bakım planlandı.`);
      setPeriodicForm({ type: 'Genel Bakım', targetKm: '', targetDate: '', notes: '' });
    };

    const handleCompletePeriodic = (id) => {
      if (!selectedVehicle) return;
      const updatedPeriodic = selectedVehicle.periodicMaintenances.map(p => 
        p.id === id ? { ...p, status: 'Tamamlandı', completedDate: new Date().toISOString().split('T')[0] } : p
      );
      onUpdateVehicle({ ...selectedVehicle, periodicMaintenances: updatedPeriodic });
    };

    const handleDeletePeriodic = (id) => {
      if (!selectedVehicle) return;
      const updatedPeriodic = selectedVehicle.periodicMaintenances.filter(p => p.id !== id);
      onUpdateVehicle({ ...selectedVehicle, periodicMaintenances: updatedPeriodic });
    };

    const handleUpdateInspection = (e) => {
      e.preventDefault();
      if (!selectedVehicle) return;
      
      onUpdateVehicle({ ...selectedVehicle, inspectionRecord: inspectionForm });
      addSystemLog('Araç Muayene Güncellemesi', `${selectedVehicle.plate} plakalı aracın muayene bilgileri güncellendi.`);
      alert('Muayene bilgileri başarıyla kaydedildi.');
    };

    const calculateDaysLeft = (targetDate) => {
      if (!targetDate) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(targetDate);
      const diffTime = target - today;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const fleetAlerts = [];
    const recentHistory = [];

    vehicles.forEach(v => {
      // Muayene kontrolleri
      if (v.inspectionRecord?.nextDate) {
        const daysLeft = calculateDaysLeft(v.inspectionRecord.nextDate);
        if (daysLeft !== null && daysLeft <= 30) {
          fleetAlerts.push({
            type: 'inspection',
            plate: v.plate,
            daysLeft,
            urgency: daysLeft < 0 ? 'critical' : 'warning',
            text: daysLeft < 0 ? `Muayene ${Math.abs(daysLeft)} gün geçti!` : `Muayeneye ${daysLeft} gün kaldı.`
          });
        }
      }

      // Periyodik bakım kontrolleri
      (v.periodicMaintenances || []).filter(p => p.status === 'Bekliyor').forEach(p => {
         let isAlert = false;
         let text = '';
         let urgency = 'warning';

         if (p.targetKm) {
           const diffKm = parseInt(p.targetKm) - parseInt(v.km || 0);
           if (diffKm <= 0) { isAlert = true; urgency = 'critical'; text = `${p.type}: KM Geldi/Geçti!`; }
           else if (diffKm <= 1500) { isAlert = true; urgency = 'warning'; text = `${p.type}: ${diffKm} KM kaldı`; }
         }
         
         if (p.targetDate && !isAlert) {
           const daysLeft = calculateDaysLeft(p.targetDate);
           if (daysLeft !== null) {
             if (daysLeft <= 0) { isAlert = true; urgency = 'critical'; text = `${p.type}: Zamanı geçti!`; }
             else if (daysLeft <= 15) { isAlert = true; urgency = 'warning'; text = `${p.type}: ${daysLeft} gün kaldı`; }
           }
         }

         if (isAlert) {
           fleetAlerts.push({
             type: 'periodic',
             plate: v.plate,
             urgency,
             text
           });
         }
      });

      // Geçmişi toparla
      (v.maintenanceHistory || []).forEach(h => {
         recentHistory.push({
           plate: v.plate,
           date: h.date,
           title: h.title,
           cost: h.cost,
           timestamp: new Date(h.date).getTime()
         });
      });
    });

    fleetAlerts.sort((a, b) => (a.urgency === 'critical' ? -1 : 1));
    recentHistory.sort((a, b) => b.timestamp - a.timestamp);
    const topRecentHistory = recentHistory.slice(0, 5);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in flex flex-col min-h-[calc(100vh-140px)]">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4 shrink-0">
          <Activity className="w-6 h-6 text-red-600" /> Araç Rapor & Bakım Yönetimi
        </h2>

        {}
        {/* YENİ EKLENEN BÖLÜM: FİLO ÖZETİ VE UYARILAR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 shrink-0">
          <div className="lg:col-span-2 bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-sm flex flex-col max-h-64">
            <h3 className="text-neutral-800 font-black mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500"/> Filo Kritik Durum & Hatırlatmalar</h3>
            <div className="overflow-y-auto custom-scrollbar pr-2 space-y-2.5 flex-1">
              {fleetAlerts.length > 0 ? fleetAlerts.map((alert, i) => (
                 <div key={i} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${alert.urgency === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${alert.urgency === 'critical' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                        {alert.type === 'inspection' ? <Shield className="w-4 h-4" /> : <Clock className="w-4 h-4"/>}
                      </div>
                      <div>
                        <p className="font-black text-black">{alert.plate}</p>
                        <p className={`text-xs font-bold ${alert.urgency === 'critical' ? 'text-red-700' : 'text-yellow-700'}`}>{alert.text}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${alert.urgency === 'critical' ? 'bg-red-600 text-white shadow-sm' : 'bg-yellow-500 text-white shadow-sm'}`}>
                      {alert.urgency === 'critical' ? 'Acil Eylem' : 'Yaklaşıyor'}
                    </span>
                 </div>
              )) : (
                <div className="flex items-center gap-2 text-green-700 font-bold bg-green-50 p-4 rounded-xl border border-green-200">
                   <CheckCircle className="w-5 h-5 shrink-0"/> Sistemde yaklaşan veya gecikmiş hiçbir bakım/muayene bulunmuyor. Harika!
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm flex flex-col max-h-64">
            <h3 className="text-black font-black mb-4 flex items-center gap-2"><History className="w-5 h-5 text-blue-600"/> Son Eklenen İşlemler</h3>
            <div className="overflow-y-auto custom-scrollbar pr-2 space-y-3 flex-1">
              {topRecentHistory.length > 0 ? topRecentHistory.map((h, i) => (
                 <div key={i} className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center">
                      <span className="bg-neutral-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest">{h.plate}</span>
                      <span className="text-[10px] text-neutral-500 font-bold">{h.date}</span>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <p className="font-bold text-sm text-neutral-800 leading-tight flex-1 pr-2 truncate" title={h.title}>{h.title}</p>
                      {h.cost && <span className="text-xs font-black text-red-600 shrink-0">₺{parseInt(h.cost).toLocaleString('tr-TR')}</span>}
                    </div>
                 </div>
              )) : (
                <p className="text-xs text-neutral-500 font-medium">Henüz herhangi bir araca bakım kaydı eklenmemiş.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 shrink-0">
          <label className="block text-sm font-bold text-neutral-700 mb-2">İşlem Yapılacak Aracı Seçin</label>
          <select 
            value={selectedPlate} 
            onChange={(e) => setSelectedPlate(e.target.value)} 
            className="w-full md:w-1/2 p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold text-lg text-black"
          >
            <option value="">-- Araç Seçiniz --</option>
            {vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>)}
          </select>
        </div>

        {selectedVehicle ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="flex flex-wrap gap-4 items-center bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6 shrink-0">
              <div className="bg-blue-600 text-white font-black px-4 py-2 rounded-lg border-2 border-black flex items-center gap-2 text-xl tracking-widest shadow-sm">
                <span className="text-[10px] bg-white text-blue-600 px-1 py-0.5 rounded-sm h-fit leading-none">TR</span>
                {selectedVehicle.plate.toUpperCase()}
              </div>
              <div className="flex gap-4 flex-wrap text-sm font-medium text-neutral-600 ml-auto">
                <span className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 flex items-center gap-1.5"><Car className="w-4 h-4 text-neutral-400"/> Cinsi: <b className="text-black">{selectedVehicle.type}</b></span>
                <span className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 flex items-center gap-1.5"><Activity className="w-4 h-4 text-neutral-400"/> Güncel KM: <b className="text-black">{selectedVehicle.km}</b></span>
                <span className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-neutral-400"/> Model: <b className="text-black">{selectedVehicle.model}</b></span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 border-b border-neutral-200 pb-4 shrink-0">
              <button onClick={() => setInnerTab('history')} className={`px-4 py-2 font-bold rounded-lg transition flex items-center gap-2 ${innerTab === 'history' ? 'bg-red-600 text-white shadow-md' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                <History className="w-4 h-4" /> Geçmiş Bakım Kayıtları
              </button>
              <button onClick={() => setInnerTab('periodic')} className={`px-4 py-2 font-bold rounded-lg transition flex items-center gap-2 ${innerTab === 'periodic' ? 'bg-red-600 text-white shadow-md' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                <Clock className="w-4 h-4" /> Periyodik Takip
              </button>
              <button onClick={() => setInnerTab('inspection')} className={`px-4 py-2 font-bold rounded-lg transition flex items-center gap-2 ${innerTab === 'inspection' ? 'bg-red-600 text-white shadow-md' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                <Shield className="w-4 h-4" /> Muayene Durumu
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
              
              {/* GEÇMİŞ BAKIMLAR */}
              {innerTab === 'history' && (
                <div className="space-y-6">
                  <form onSubmit={handleAddHistory} className="bg-neutral-50 p-5 rounded-xl border border-neutral-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">İşlem Tarihi</label>
                      <input required type="date" value={historyForm.date} onChange={e => setHistoryForm({...historyForm, date: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Yapılan İşlem / Parça</label>
                      <input required type="text" value={historyForm.title} onChange={e => setHistoryForm({...historyForm, title: e.target.value})} placeholder="Örn: Balata Değişimi" className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Maliyet (TL)</label>
                      <input type="number" value={historyForm.cost} onChange={e => setHistoryForm({...historyForm, cost: e.target.value})} placeholder="İsteğe Bağlı" className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-black text-white font-bold rounded-lg hover:bg-neutral-800 transition flex justify-center items-center gap-2">
                      <PlusCircle className="w-4 h-4" /> Kayıt Ekle
                    </button>
                    <div className="md:col-span-2 lg:col-span-4">
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Açıklama / Not (Hangi serviste yapıldı, km vs.)</label>
                      <input type="text" value={historyForm.notes} onChange={e => setHistoryForm({...historyForm, notes: e.target.value})} placeholder="Detaylı notlar..." className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                  </form>

                  <div className="space-y-3">
                    <h3 className="font-bold text-black border-b border-neutral-200 pb-2">Geçmiş İşlemler</h3>
                    {(selectedVehicle.maintenanceHistory || []).sort((a,b) => new Date(b.date) - new Date(a.date)).map(hist => (
                      <div key={hist.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 group hover:border-red-300 transition">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CalendarDays className="w-4 h-4 text-neutral-400" />
                            <span className="font-bold text-neutral-600 text-sm">{hist.date}</span>
                          </div>
                          <p className="font-black text-black text-lg">{hist.title}</p>
                          {hist.notes && <p className="text-sm text-neutral-500 mt-1">{hist.notes}</p>}
                        </div>
                        <div className="flex flex-col justify-between items-end">
                          {hist.cost && <span className="font-black text-red-600">₺{parseInt(hist.cost).toLocaleString('tr-TR')}</span>}
                          <button onClick={() => handleDeleteHistory(hist.id)} className="text-xs font-bold text-neutral-400 hover:text-red-600 transition flex items-center gap-1 mt-auto pt-2">
                            <X className="w-3.5 h-3.5" /> Kaydı Sil
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!selectedVehicle.maintenanceHistory || selectedVehicle.maintenanceHistory.length === 0) && (
                      <p className="text-center text-neutral-500 py-6 text-sm">Araca ait geçmiş bakım kaydı bulunmuyor.</p>
                    )}
                  </div>
                </div>
              )}

              {/* PERİYODİK TAKİP */}
              {innerTab === 'periodic' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-800 flex gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>Periyodik bakımları KM'ye veya Tarihe göre planlayabilirsiniz. KM yaklaştığında sistem sizi uyaracaktır.</p>
                  </div>
                  
                  <form onSubmit={handleAddPeriodic} className="bg-neutral-50 p-5 rounded-xl border border-neutral-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Bakım Türü</label>
                      <input required type="text" value={periodicForm.type} onChange={e => setPeriodicForm({...periodicForm, type: e.target.value})} placeholder="Örn: 10 Bin Bakımı, Yağ Değişimi" className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Hedef KM</label>
                      <input type="number" value={periodicForm.targetKm} onChange={e => setPeriodicForm({...periodicForm, targetKm: e.target.value})} placeholder="Örn: 160000" className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">Hedef Tarih</label>
                      <input type="date" value={periodicForm.targetDate} onChange={e => setPeriodicForm({...periodicForm, targetDate: e.target.value})} className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div className="lg:col-span-2 flex flex-col md:flex-row gap-4 w-full">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-neutral-700 mb-1">Notlar</label>
                        <input type="text" value={periodicForm.notes} onChange={e => setPeriodicForm({...periodicForm, notes: e.target.value})} placeholder="Neler değişecek?" className="w-full p-2.5 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600" />
                      </div>
                      <button type="submit" className="py-2.5 px-4 bg-black text-white font-bold rounded-lg hover:bg-neutral-800 transition flex justify-center items-center gap-2 h-[42px] mt-auto whitespace-nowrap">
                        <PlusCircle className="w-4 h-4" /> Planla
                      </button>
                    </div>
                  </form>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* BEKLEYENLER */}
                    <div>
                      <h3 className="font-bold text-black border-b border-neutral-200 pb-2 mb-3">Yaklaşan / Bekleyen Bakımlar</h3>
                      <div className="space-y-3">
                        {(selectedVehicle.periodicMaintenances || []).filter(p => p.status === 'Bekliyor').map(p => {
                          let isCritical = false;
                          let isWarning = false;
                          let alertText = "";

                          if (p.targetKm) {
                            const diffKm = parseInt(p.targetKm) - parseInt(selectedVehicle.km);
                            if (diffKm <= 0) { isCritical = true; alertText = `KM GELDİ GEÇİYOR! (${Math.abs(diffKm)} km geçti)`; }
                            else if (diffKm <= 1500) { isWarning = true; alertText = `Yaklaştı! Sadece ${diffKm} KM Kaldı`; }
                          }
                          
                          if (p.targetDate) {
                            const daysLeft = calculateDaysLeft(p.targetDate);
                            if (daysLeft !== null) {
                              if (daysLeft <= 0) { isCritical = true; alertText = `ZAMANI GEÇTİ! (${Math.abs(daysLeft)} gün gecikti)`; }
                              else if (daysLeft <= 15) { isWarning = true; alertText = `Yaklaştı! Sadece ${daysLeft} Gün Kaldı`; }
                            }
                          }

                          return (
                            <div key={p.id} className={`p-4 rounded-xl border shadow-sm flex flex-col gap-2 ${isCritical ? 'bg-red-50 border-red-300' : isWarning ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-neutral-200'}`}>
                              <div className="flex justify-between items-start">
                                <h4 className="font-black text-lg text-black">{p.type}</h4>
                                <div className="flex gap-1">
                                  <button onClick={() => handleCompletePeriodic(p.id)} className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition" title="Tamamlandı İşaretle"><CheckCircle className="w-4 h-4"/></button>
                                  <button onClick={() => handleDeletePeriodic(p.id)} className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition" title="Sil"><X className="w-4 h-4"/></button>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 text-xs font-bold text-neutral-600">
                                {p.targetKm && <span className="bg-white px-2 py-1 rounded border border-neutral-200">Hedef KM: {p.targetKm}</span>}
                                {p.targetDate && <span className="bg-white px-2 py-1 rounded border border-neutral-200">Hedef Tarih: {p.targetDate}</span>}
                              </div>
                              
                              {p.notes && <p className="text-sm text-neutral-500 mt-1">{p.notes}</p>}
                              
                              {(isCritical || isWarning) && (
                                <div className={`text-xs font-black px-3 py-1.5 rounded-lg mt-2 inline-flex items-center gap-2 w-max ${isCritical ? 'bg-red-600 text-white' : 'bg-yellow-400 text-black'}`}>
                                  <AlertTriangle className="w-4 h-4" /> {alertText}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {(!selectedVehicle.periodicMaintenances || selectedVehicle.periodicMaintenances.filter(p => p.status === 'Bekliyor').length === 0) && (
                          <p className="text-center text-neutral-500 py-6 text-sm">Bekleyen periyodik bakım bulunmuyor.</p>
                        )}
                      </div>
                    </div>

                    {/* TAMAMLANANLAR */}
                    <div>
                      <h3 className="font-bold text-neutral-500 border-b border-neutral-200 pb-2 mb-3">Tamamlanmış Bakımlar</h3>
                      <div className="space-y-3 opacity-70 hover:opacity-100 transition">
                        {(selectedVehicle.periodicMaintenances || []).filter(p => p.status === 'Tamamlandı').sort((a,b) => new Date(b.completedDate) - new Date(a.completedDate)).map(p => (
                          <div key={p.id} className="p-4 rounded-xl border border-green-200 bg-green-50 shadow-sm flex flex-col gap-1 relative">
                             <button onClick={() => handleDeletePeriodic(p.id)} className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                             <div className="flex items-center gap-2 text-green-700 font-bold mb-1"><CheckCircle className="w-4 h-4" /> Tamamlandı ({p.completedDate})</div>
                             <h4 className="font-black text-black">{p.type}</h4>
                             <p className="text-xs text-neutral-600">{p.targetKm ? `Hedef KM: ${p.targetKm}` : ''} {p.targetDate ? `| Hedef Tarih: ${p.targetDate}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MUAYENE DURUMU */}
              {innerTab === 'inspection' && (
                <div className="space-y-6 max-w-2xl">
                  {(() => {
                    const daysLeft = calculateDaysLeft(inspectionForm.nextDate);
                    let alertBox = null;
                    if (daysLeft !== null) {
                      if (daysLeft < 0) alertBox = <div className="bg-red-600 text-white p-4 rounded-xl font-black flex items-center gap-3 shadow-lg shadow-red-600/30 animate-pulse"><AlertTriangle className="w-6 h-6"/> DİKKAT: MUAYENE TARİHİ {Math.abs(daysLeft)} GÜN GEÇTİ! ARAÇ TRAFİĞE ÇIKAMAZ!</div>;
                      else if (daysLeft <= 30) alertBox = <div className="bg-yellow-500 text-black p-4 rounded-xl font-black flex items-center gap-3 shadow-lg shadow-yellow-500/30"><Clock className="w-6 h-6"/> UYARI: MUAYENEYE SADECE {daysLeft} GÜN KALDI! Randevu alın.</div>;
                      else alertBox = <div className="bg-green-100 text-green-700 p-4 rounded-xl font-bold flex items-center gap-3"><CheckCircle className="w-5 h-5"/> Muayeneye daha {daysLeft} gün var. Her şey yolunda.</div>;
                    }
                    return alertBox;
                  })()}

                  <form onSubmit={handleUpdateInspection} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-black border-b border-neutral-100 pb-2 mb-4">Muayene Bilgilerini Güncelle</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-1">Son Muayene Tarihi</label>
                        <input type="date" value={inspectionForm.lastDate} onChange={e => setInspectionForm({...inspectionForm, lastDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-1">Gelecek Muayene Tarihi (Bitiş) *</label>
                        <input required type="date" value={inspectionForm.nextDate} onChange={e => setInspectionForm({...inspectionForm, nextDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-black text-red-600" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-1">Son Muayene Maliyeti (TL)</label>
                        <input type="number" value={inspectionForm.cost} onChange={e => setInspectionForm({...inspectionForm, cost: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-1">Muayene Notları (Kusurlar, eksikler vb.)</label>
                      <textarea value={inspectionForm.notes} onChange={e => setInspectionForm({...inspectionForm, notes: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none h-24" placeholder="Hafif kusur: Cam filmi vb..."></textarea>
                    </div>
                    <button type="submit" className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg">
                      <Save className="w-5 h-5" /> Muayene Bilgilerini Kaydet
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 bg-neutral-50/50 rounded-2xl border border-neutral-200 border-dashed">
            <Car className="w-16 h-16 text-neutral-300 mb-4" />
            <p className="text-lg font-black text-neutral-600 mb-1">Araç Seçilmedi</p>
            <p className="text-sm font-medium">Bakım, Periyodik veya Muayene işlemlerini görmek için yukarıdan araç seçin.</p>
          </div>
        )}
      </div>
    );
  };

  const AddTodoView = ({ newTodo, setNewTodo, handleAddTodo }) => (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
        <ListTodo className="w-6 h-6 text-red-600" /> Yeni Yapılacak İş Ekle
      </h2>
      <form onSubmit={handleAddTodo} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-black mb-1">Konu Başlığı</label>
          <input required type="text" value={newTodo.title} onChange={(e) => setNewTodo({...newTodo, title: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium" placeholder="Örn: Müşteri memnuniyet aramaları yapılacak" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-black mb-1">Detay / Açıklama</label>
          <textarea required value={newTodo.details} onChange={(e) => setNewTodo({...newTodo, details: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none h-28 resize-none transition font-medium text-sm" placeholder="Yapılacak işin detayları..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-black mb-1">Hatırlatma / Tarih</label>
            <input required type="date" value={newTodo.reminderDate} onChange={(e) => setNewTodo({...newTodo, reminderDate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-bold" />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1">Aciliyet Önemi</label>
            <select value={newTodo.priority} onChange={(e) => setNewTodo({...newTodo, priority: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white font-bold transition cursor-pointer">
              <option value="Düşük" className="text-green-600 font-bold">Düşük Öncelik</option>
              <option value="Normal" className="text-blue-600 font-bold">Normal Öncelik</option>
              <option value="Yüksek" className="text-orange-600 font-bold">Yüksek Öncelik</option>
              <option value="Acil" className="text-red-600 font-black">Acil (Hemen Yapılmalı)</option>
            </select>
          </div>
        </div>

        <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-2">
          <PlusCircle className="w-5 h-5" /> Listeye Kaydet
        </button>
      </form>
    </div>
  );

  const TodoListView = ({ todos, handleUpdateTodoStatus, handleDeleteTodo }) => {
    const columns = [
      { id: 'todo', title: 'YAPILACAK', color: 'bg-neutral-800' },
      { id: 'in-progress', title: 'İŞLEME ALINDI', color: 'bg-blue-600' },
      { id: 'completed', title: 'YAPILDI', color: 'bg-green-600' }
    ];

    return (
      <div className="h-[calc(100vh-120px)] flex flex-col animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-black flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-red-600" /> Takip ve Yapılacak İşler
          </h2>
        </div>

        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar items-start">
          {columns.map(column => (
            <div key={column.id} className="bg-neutral-100 rounded-2xl w-80 md:w-96 flex-shrink-0 flex flex-col max-h-full border border-neutral-200">
              <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-white rounded-t-2xl shadow-sm">
                <h3 className="font-bold text-black text-sm flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                  {column.title}
                </h3>
                <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2.5 py-1 rounded-lg border border-neutral-200">
                  {todos.filter(t => t.status === column.id).length} İş
                </span>
              </div>

              <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
                {todos.filter(t => t.status === column.id).sort((a,b) => new Date(a.reminderDate) - new Date(b.reminderDate)).map(todo => (
                  <div key={todo.id} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 hover:border-red-400 transition group flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          todo.priority === 'Acil' ? 'bg-red-50 text-red-700 border-red-200' :
                          todo.priority === 'Yüksek' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          todo.priority === 'Normal' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        Önem: {todo.priority}
                      </span>
                      <button onClick={() => handleDeleteTodo(todo.id)} className="text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <h4 className="font-black text-black text-base leading-tight">{todo.title}</h4>
                    <p className="text-xs text-neutral-600 whitespace-pre-wrap font-medium">{todo.details}</p>
                    
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 bg-neutral-50 px-2 py-1.5 rounded-lg border border-neutral-200 mt-1 w-max">
                      <CalendarDays className="w-3.5 h-3.5 text-red-600" /> Hatırlatma: {todo.reminderDate}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-3 mt-1 border-t border-neutral-100">
                      {todo.status !== 'todo' && <button onClick={() => handleUpdateTodoStatus(todo.id, 'todo')} className="flex-1 py-1.5 px-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition text-[10px] font-bold rounded-lg border border-neutral-200 text-center">Yapılacaklara Al</button>}
                      {todo.status !== 'in-progress' && <button onClick={() => handleUpdateTodoStatus(todo.id, 'in-progress')} className="flex-1 py-1.5 px-1 bg-blue-50 text-blue-700 hover:bg-blue-100 transition text-[10px] font-bold rounded-lg border border-blue-100 text-center">İşleme Al</button>}
                      {todo.status !== 'completed' && <button onClick={() => handleUpdateTodoStatus(todo.id, 'completed')} className="flex-1 py-1.5 px-1 bg-green-50 text-green-700 hover:bg-green-100 transition text-[10px] font-bold rounded-lg border border-green-100 text-center">Yapıldı</button>}
                    </div>
                  </div>
                ))}
                {todos.filter(t => t.status === column.id).length === 0 && (
                  <p className="text-center text-xs font-medium text-neutral-400 py-4">Bu alanda iş bulunmuyor.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const AddMaterialView = ({ onAdd }) => {
    const [formData, setFormData] = useState({ name: '', category: 'Ambalaj Malzemesi', stock: '', unit: 'Adet' });
    
    const handleSubmit = (e) => {
      e.preventDefault();
      onAdd(formData);
      setFormData({ name: '', category: 'Ambalaj Malzemesi', stock: '', unit: 'Adet' });
    };

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Package className="w-6 h-6 text-red-600" /> Malzeme & Stok Ekle
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
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
          <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
            <PlusCircle className="w-5 h-5" /> Malzemeyi Kaydet
          </button>
        </form>
      </div>
    );
  };

  const DamagedJobsView = ({ jobs, handleEditJob, setViewingImage, setDeleteJobId, handleOpenResolveDamageModal }) => {
    const [searchQuery, setSearchQuery] = useState(''); // ARAMA STATE'İ EKLENDİ
    
    const damagedJobs = jobs
      .filter(j => {
         if (j.endJobDetails?.damageStatus !== 'Hasar var') return false;
         
         if (searchQuery.trim()) {
             return (j.customerName && j.customerName.toLowerCase().includes(searchQuery.toLowerCase())) || 
                    (j.customerPhone && j.customerPhone.includes(searchQuery));
         }
         
         return true;
      })
      .sort((a,b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-neutral-200 pb-4 gap-4">
          <h2 className="text-xl font-bold text-black flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" /> Hasar Bildirimi Olan İşler
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
        <div className="space-y-4">
          {damagedJobs.length === 0 ? (
            <div className="text-center bg-neutral-50 p-8 rounded-2xl border border-neutral-200">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-neutral-600 font-bold text-lg">{searchQuery.trim() ? 'Aramanıza uygun kayıt bulunamadı.' : 'Harika! Hasar kaydı bulunan operasyon yok.'}</p>
            </div>
          ) : (
            damagedJobs.map(job => (
              <div key={job.id} className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between md:items-center transition ${job.endJobDetails?.damageResolved ? 'border-green-200 bg-green-50/50' : 'border-red-300 bg-red-50/50'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-black text-lg">{job.customerName}</h3>
                    {job.endJobDetails?.damageResolved ? (
                      <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1"><CheckCircle className="w-3 h-3"/> ÇÖZÜLDÜ</span>
                    ) : (
                      <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1 animate-pulse"><Clock className="w-3 h-3"/> ÇÖZÜM BEKLİYOR</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 mb-2"><CalendarDays className="w-4 h-4 inline mr-1 text-neutral-400" /> {job.date} • {job.team}</p>
                  
                  <div className="bg-white p-3 rounded-lg border border-red-100 text-xs">
                    <b className="text-red-800 block mb-1">Hasar / Müşteri Şikayeti Detayı:</b>
                    <span className="text-neutral-700 font-medium">{job.endJobDetails?.damageDetails || 'Açıklama girilmedi.'}</span>
                  </div>
                  
                  {job.endJobDetails?.damageResolved && (
                    <div className="bg-white p-3 rounded-lg border border-green-200 text-xs mt-2">
                      <b className="text-green-800 block mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> Çözüm Notu:</b>
                      <span className="text-neutral-700 font-medium">{job.endJobDetails?.damageResolutionNote}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-w-[140px]">
                  {!job.endJobDetails?.damageResolved && (
                    <button onClick={() => handleOpenResolveDamageModal(job.id)} className="w-full px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex justify-center items-center gap-2 text-sm shadow-md">
                      <CheckCircle className="w-4 h-4" /> Sorunu Çöz
                    </button>
                  )}
                  {(job.endJobDetails?.damageImages || []).map((img, idx) => (
                    <button key={idx} onClick={() => setViewingImage({title: 'Hasar Fotoğrafı', name: img})} className="w-full px-4 py-2 bg-white text-red-600 font-bold rounded-xl hover:bg-red-50 transition flex justify-center items-center gap-2 text-sm border border-red-200 shadow-sm">
                      <Camera className="w-4 h-4" /> Hasar Görseli {idx > 0 ? idx+1 : ''}
                    </button>
                  ))}
                  <button onClick={() => handleEditJob(job)} className="w-full px-4 py-2 bg-white text-neutral-700 font-bold rounded-xl hover:bg-neutral-100 transition flex justify-center items-center gap-2 text-sm border border-neutral-200">
                    <Edit className="w-4 h-4" /> Tüm Detaylar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const CancelledJobsView = ({ jobs, handleEditJob, handleRestoreJob, setDeleteJobId }) => {
    const cancelledJobs = jobs.filter(j => j.status === 'cancelled').sort((a,b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Ban className="w-6 h-6 text-red-600" /> İptal Edilen İşler Listesi
        </h2>
        <div className="space-y-4">
          {cancelledJobs.length === 0 ? (
            <div className="text-center bg-neutral-50 p-8 rounded-2xl border border-neutral-200">
              <ClipboardList className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 font-medium">Sistemde iptal edilmiş kayıtlı operasyon bulunmuyor.</p>
            </div>
          ) : (
            cancelledJobs.map(job => (
              <div key={job.id} className="p-4 rounded-xl border border-red-200 bg-red-50/30 flex flex-col md:flex-row gap-4 justify-between md:items-center transition hover:border-red-400 group">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-black text-lg line-through text-neutral-400">{job.customerName}</h3>
                    <span className="text-[10px] bg-red-100 text-red-800 border border-red-200 px-2.5 py-0.5 rounded-full font-bold">İPTAL EDİLDİ</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 mb-2 font-medium">
                    <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-neutral-200"><CalendarDays className="w-4 h-4 text-neutral-400" /> {job.date} - {job.time}</span>
                    <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-neutral-200"><Phone className="w-4 h-4 text-neutral-400" /> {job.customerPhone}</span>
                  </div>
                  <p className="text-xs text-neutral-500"><MapPin className="w-3.5 h-3.5 inline mr-1" /> {job.fromDistrict} ➔ {job.toDistrict || 'Belirtilmedi'}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row md:flex-col gap-2 min-w-[140px]">
                  <button onClick={() => handleRestoreJob(job.id)} className="w-full px-4 py-2 bg-white text-green-700 border border-green-200 font-bold rounded-xl hover:bg-green-50 transition flex justify-center items-center gap-2 text-sm shadow-sm">
                    <History className="w-4 h-4" /> İşi Geri Al (Aktif Yap)
                  </button>
                  <button onClick={() => handleEditJob(job)} className="w-full px-4 py-2 bg-white text-neutral-700 font-bold rounded-xl hover:bg-neutral-100 transition flex justify-center items-center gap-2 text-sm border border-neutral-200 shadow-sm">
                    <Edit className="w-4 h-4" /> İncele
                  </button>
                  <button onClick={() => setDeleteJobId(job.id)} className="w-full px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 text-sm shadow-sm opacity-0 group-hover:opacity-100">
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

const SystemFilesView = ({ jobs, personnelList, vehicles, materials, db, appId, addSystemLog }) => {
    const [isRestoring, setIsRestoring] = useState(false);
    
    const handleBackupData = () => {
      const dataToExport = {
        jobs,
        personnelList,
        vehicles,
        materials,
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sembol_CRM_Yedek_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      addSystemLog('Sistem Yedekleme', 'Sistem verileri JSON formatında dışa aktarıldı.');
    };

    const handleRestoreData = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!window.confirm("DİKKAT: Bu işlem mevcut tüm operasyon, personel ve araç kayıtlarınızın üzerine yazacaktır! Sadece acil durumlarda kullanılması önerilir. Onaylıyor musunuz?")) {
        e.target.value = null;
        return;
      }

      setIsRestoring(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          if (!data.jobs || !data.personnelList) {
            alert("Hata: Yüklediğiniz dosya geçerli bir Sembol CRM yedeği değil.");
            setIsRestoring(false);
            return;
          }

          // İşleri Yükle
          for (const item of data.jobs) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', item.id), item);
          }
          // Personelleri Yükle
          for (const item of data.personnelList) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', item.id), item);
          }
          // Araçları Yükle
          if (data.vehicles) {
            for (const item of data.vehicles) {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', item.id), item);
            }
          }
          // Malzemeleri Yükle
          if (data.materials) {
            for (const item of data.materials) {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', item.id), item);
            }
          }

          addSystemLog('Sistem Geri Yükleme', 'Veritabanı yedeği dosyadan başarıyla geri yüklendi.');
          alert("Sistem başarıyla geri yüklendi! Değişikliklerin aktif olması için sayfa yenilenecektir.");
          window.location.reload();
          
        } catch (err) {
          console.error("Yükleme Hatası:", err);
          alert("Dosya okunurken veya veritabanına yazılırken bir hata oluştu.");
          setIsRestoring(false);
        }
      };
      
      reader.readAsText(file);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <FileText className="w-6 h-6 text-red-600" /> Sistem Dosyaları & Yedekleme
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* DIŞA AKTAR BÖLÜMÜ */}
          <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col">
            <div className="flex items-start gap-4 mb-auto">
              <div className="p-3 bg-blue-600 rounded-xl shrink-0">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-lg mb-2">Veritabanı Yedeği Al</h3>
                <p className="text-blue-700 text-sm font-medium mb-4 leading-relaxed">
                  Sistemdeki tüm operasyon kayıtlarını (işleri), personelleri, araçları ve stok malzeme kayıtlarını tek bir JSON dosyası olarak bilgisayarınıza indirebilirsiniz. Bu işlem veri güvenliğiniz için düzenli aralıklarla önerilir.
                </p>
              </div>
            </div>
            <button onClick={handleBackupData} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 mt-4">
              <Download className="w-5 h-5" /> Sistemi Dışa Aktar (Yedekle)
            </button>
          </div>

          {/* İÇE AKTAR (RESTORE) BÖLÜMÜ */}
          <div className="p-6 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col">
            <div className="flex items-start gap-4 mb-auto">
              <div className="p-3 bg-orange-600 rounded-xl shrink-0">
                <History className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-orange-900 text-lg mb-2">Yedeği Geri Yükle</h3>
                <p className="text-orange-700 text-sm font-medium mb-4 leading-relaxed">
                  Daha önce indirdiğiniz bir <b>.json</b> yedekleme dosyasını sisteme yükleyebilirsiniz. <br/> <b className="text-red-600">DİKKAT:</b> Bu işlem mevcut verilerinizi siler ve yerine yüklediğiniz dosyadaki verileri koyar.
                </p>
              </div>
            </div>
            
            {isRestoring ? (
              <div className="w-full py-4 bg-orange-300 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm mt-4 cursor-wait">
                <Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor... Lütfen bekleyin.
              </div>
            ) : (
              <label className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 mt-4 cursor-pointer">
                <Upload className="w-5 h-5" /> Yedek Dosyasını Yükle (Restore)
                <input type="file" accept=".json" className="hidden" onChange={handleRestoreData} />
              </label>
            )}
          </div>
        </div>
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

  const FinanceDashboardView = ({ jobs, transactions, transactionType, setTransactionType, newTransaction, setNewTransaction, handleAddTransaction }) => {
    const [filterPeriod, setFilterPeriod] = useState('today');

    // Tarih karşılaştırması için bugünü sıfırla
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let allRecords = [];

    // İşlerden Gelen Gelirleri Topla (Sadece Tamamlananlar)
    jobs.filter(j => j.status === 'completed').forEach(job => {
      const jobDate = new Date(job.date);
      jobDate.setHours(0, 0, 0, 0);
      allRecords.push({
        id: 'job_' + job.id,
        rawDate: jobDate,
        displayDate: job.date,
        type: 'income',
        category: (job.type || 'Nakliye') + ' Tahsilatı',
        amount: parseFloat(job.price) || 0,
        customerOrDesc: job.customerName,
        vehicle: job.assignedVehiclePlate || '-',
        paymentMethod: job.endJobDetails?.paymentMethod || '-'
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
        customerOrDesc: t.description || '-',
        vehicle: '-',
        paymentMethod: t.account === 'cash' ? 'Nakit Kasa' : 'Banka / Havale'
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

    const totalIncome = filteredRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = filteredRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
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
           <form onSubmit={handleAddTransaction} className="flex flex-col lg:flex-row gap-4">
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
              <button type="submit" className="px-6 py-3 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition">Kaydet</button>
           </form>
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
                  <th className="p-4 font-bold">Araç Plakası</th>
                  <th className="p-4 font-bold">Ödeme Şekli (Kasa/Banka)</th>
                  <th className="p-4 font-bold text-right rounded-tr-xl">Tutar (TL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-neutral-50 transition">
                    <td className="p-4 font-medium text-black whitespace-nowrap">{r.displayDate}</td>
                    <td className="p-4">
                      <p className="font-bold text-neutral-800 text-base">{r.customerOrDesc}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5">{r.category}</p>
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
                    <td className={`p-4 text-right font-black text-base ${r.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {r.type === 'income' ? '+' : '-'}₺{r.amount.toLocaleString('tr-TR')}
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-neutral-500 font-medium">Seçili tarih aralığında finansal hareket bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

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

  const CompanyPasswordsView = ({ passwords, db, appId, addSystemLog }) => {
    const [formData, setFormData] = useState({ platform: '', link: '', username: '', password: '', notes: '' });
    const [editingId, setEditingId] = useState(null);
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [copiedField, setCopiedField] = useState(null);

    const handleAdd = async (e) => {
      e.preventDefault();
      try {
        if (editingId) {
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyPasswords', editingId), formData);
           addSystemLog('Kurumsal Şifre Güncellendi', `${formData.platform} platformuna ait şifre bilgisi güncellendi.`);
           setEditingId(null);
        } else {
           await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companyPasswords'), {
              ...formData,
              createdAt: new Date().toISOString()
           });
           addSystemLog('Kurumsal Şifre Eklendi', `${formData.platform} platformuna ait yeni şifre eklendi.`);
        }
        setFormData({ platform: '', link: '', username: '', password: '', notes: '' });
      } catch(err) { console.error(err); }
    };

    const handleEdit = (pwd) => {
      setEditingId(pwd.id);
      setFormData({ platform: pwd.platform || '', link: pwd.link || '', username: pwd.username || '', password: pwd.password || '', notes: pwd.notes || '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id, platform) => {
       if(window.confirm('Bu şifreyi kalıcı olarak silmek istediğinize emin misiniz?')) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyPasswords', id));
          addSystemLog('Kurumsal Şifre Silindi', `${platform} platformuna ait şifre silindi.`);
       }
    };

    const toggleVisible = (id) => {
      setVisiblePasswords(prev => ({...prev, [id]: !prev[id]}));
    };

    const handleCopy = (text, fieldId) => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Key className="w-6 h-6 text-red-600" /> Kurumsal Şifreler ve Hesaplar
        </h2>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-800 font-medium mb-6 flex items-start gap-3">
          <Shield className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
          <p>Şirkete ait (Instagram, Hosting, E-Posta, vb.) tüm kurumsal hesapların giriş bilgilerini buradan güvenle yönetebilirsiniz. Bu bölüme sadece yetkili yöneticiler erişebilir.</p>
        </div>

        <form onSubmit={handleAdd} className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 mb-8 space-y-4">
          <h3 className="font-bold text-black border-b border-neutral-200 pb-2 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-red-600" /> {editingId ? 'Şifre Bilgilerini Güncelle' : 'Yeni Hesap / Şifre Ekle'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Platform / Sistem Adı *</label>
              <input required type="text" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} placeholder="Örn: Instagram (Sembol Nakliyat)" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Giriş Linki (URL)</label>
              <input type="text" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} placeholder="Örn: https://instagram.com" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Kullanıcı Adı / E-Posta *</label>
              <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Kullanıcı adı veya mail adresi" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-1">Şifre *</label>
              <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Hesap Şifresi" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-mono" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-neutral-700 mb-1">Ekstra Notlar</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Giriş için pin kodu veya ekstra notlar..." className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none h-20 text-sm"></textarea>
            </div>
          </div>

          <div className="flex gap-3">
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setFormData({ platform: '', link: '', username: '', password: '', notes: '' }); }} className="flex-1 py-3 bg-neutral-200 text-neutral-700 font-bold rounded-xl hover:bg-neutral-300 transition">İptal</button>
            )}
            <button type="submit" className="flex-[2] py-3 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-md">
              <Save className="w-5 h-5" /> {editingId ? 'Değişiklikleri Kaydet' : 'Sisteme Kaydet'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {passwords.map(pwd => (
            <div key={pwd.id} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-4 hover:border-neutral-300 transition group">
               <div className="flex justify-between items-start border-b border-neutral-100 pb-3">
                  <div>
                    <h4 className="font-black text-lg text-black">{pwd.platform}</h4>
                    {pwd.link && (
                      <a href={pwd.link.startsWith('http') ? pwd.link : `https://${pwd.link}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-0.5">
                        <ArrowUpRight className="w-3 h-3" /> {pwd.link}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                     <button onClick={() => handleEdit(pwd)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle"><Edit className="w-4 h-4"/></button>
                     <button onClick={() => handleDelete(pwd.id, pwd.platform)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Sil"><X className="w-4 h-4"/></button>
                  </div>
               </div>

               <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Kullanıcı Adı / E-Posta</span>
                    <div className="flex items-center gap-2">
                       <code className="bg-neutral-100 px-3 py-1.5 rounded-lg text-sm font-bold text-black flex-1 truncate select-all">{pwd.username}</code>
                       <button onClick={() => handleCopy(pwd.username, `user_${pwd.id}`)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition shrink-0" title="Kopyala">
                         {copiedField === `user_${pwd.id}` ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                       </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Şifre</span>
                    <div className="flex items-center gap-2">
                       <code className="bg-neutral-100 px-3 py-1.5 rounded-lg text-sm font-bold text-black flex-1 truncate select-all">
                         {visiblePasswords[pwd.id] ? pwd.password : '••••••••••••'}
                       </code>
                       <button onClick={() => toggleVisible(pwd.id)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition shrink-0" title={visiblePasswords[pwd.id] ? "Gizle" : "Göster"}>
                         {visiblePasswords[pwd.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                       <button onClick={() => handleCopy(pwd.password, `pwd_${pwd.id}`)} className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition shrink-0" title="Kopyala">
                         {copiedField === `pwd_${pwd.id}` ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                       </button>
                    </div>
                  </div>
                  
                  {pwd.notes && (
                    <div className="mt-2 text-xs text-neutral-600 bg-yellow-50 p-2.5 rounded-lg border border-yellow-100">
                      <b className="text-yellow-800">Not:</b> {pwd.notes}
                    </div>
                  )}
               </div>
            </div>
          ))}
          {passwords.length === 0 && (
            <div className="lg:col-span-2 text-center text-neutral-500 py-10 bg-neutral-50 rounded-2xl border border-neutral-200">
              <Key className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="font-medium text-sm">Sistemde kayıtlı kurumsal şifre bulunmuyor.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

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

  const UserActivitiesView = ({ personnelList }) => {
    const sortedList = [...personnelList].sort((a, b) => {
      const parseDate = (str) => {
        if (!str) return 0;
        const parts = str.split(' ');
        if (parts.length < 2) return 0;
        const [datePart, timePart] = parts;
        const [d, m, y] = datePart.split('.');
        const [hr, min] = timePart.split(':');
        return new Date(`${y}-${m}-${d}T${hr}:${min}:00`).getTime() || 0;
      };
      return parseDate(b.lastLogin) - parseDate(a.lastLogin);
    });

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Activity className="w-6 h-6 text-red-600" /> Kullanıcı Hareketleri (Son Girişler)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="p-4 font-bold rounded-tl-xl">Personel</th>
                <th className="p-4 font-bold">Pozisyon / Rütbe</th>
                <th className="p-4 font-bold rounded-tr-xl">Sisteme Son Giriş Zamanı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedList.map(p => (
                <tr key={p.id} className="hover:bg-neutral-50 transition">
                  <td className="p-4 font-bold text-black">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold overflow-hidden shrink-0">
                        {p.profileImage ? <img src={p.profileImage} alt={p.fullName} className="w-full h-full object-cover" /> : p.fullName.charAt(0)}
                      </div>
                      {p.fullName}
                    </div>
                  </td>
                  <td className="p-4 text-neutral-600 font-medium">
                    <span className="block text-black font-bold">{p.position}</span>
                    <span className="text-xs text-neutral-500">{p.rank}</span>
                  </td>
                  <td className="p-4">
                    {p.lastLogin ? (
                      <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-100 font-bold flex items-center gap-1.5 w-max">
                        <Clock className="w-4 h-4 shrink-0" /> {p.lastLogin}
                      </span>
                    ) : (
                      <span className="bg-neutral-100 text-neutral-500 px-3 py-1.5 rounded-lg border border-neutral-200 font-bold flex items-center gap-1.5 w-max">
                        <Clock className="w-4 h-4 shrink-0" /> Henüz Giriş Yapmadı
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedList.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-6 text-center text-neutral-500">Kayıtlı personel bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const NotificationsView = ({ notifications, markNotificationsAsRead, currentUser }) => {
    useEffect(() => {
      if (currentUser?.id) {
        markNotificationsAsRead(currentUser.id);
      }
    }, [currentUser?.id]); // Sonsuz döngüyü kırmak için obje bağımlılığı kaldırıldı, sadece ID dinleniyor

    const myNotifications = notifications
      .filter(n => n.userId === currentUser?.id)
      .sort((a, b) => {
         // Tarih formatını (GG.AA.YYYY HH:MM) çözümleyip sıralama
         const parseDate = (str) => {
            if (!str) return 0;
            const parts = str.split(' ');
            if (parts.length < 2) return 0;
            const [datePart, timePart] = parts;
            const [d, m, y] = datePart.split('.');
            const [hr, min] = timePart.split(':');
            return new Date(`${y}-${m}-${d}T${hr}:${min}:00`).getTime() || 0;
         };
         return parseDate(b.date) - parseDate(a.date);
      });

    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in">
        <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <Bell className="w-7 h-7 text-red-600" /> Bildirim Merkezi
        </h2>
        <div className="space-y-4">
          {myNotifications.length === 0 ? (
             <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200">
               <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
               <p className="text-neutral-500 font-medium">Sistemde size ait herhangi bir bildirim bulunmuyor.</p>
             </div>
          ) : (
             myNotifications.map(n => (
               <div key={n.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${n.read ? 'bg-white border-neutral-200' : 'bg-red-50/40 border-red-200'}`}>
                 <div>
                   <h4 className="font-bold text-black flex items-center gap-2 text-lg">
                     {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0"></span>}
                     {n.title}
                   </h4>
                   <p className="text-sm text-neutral-600 mt-1.5 leading-relaxed">{n.message}</p>
                 </div>
                 <div className="shrink-0 text-right">
                    <span className="inline-block text-xs font-bold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />{n.date}
                    </span>
                 </div>
               </div>
             ))
          )}
        </div>
      </div>
    );
  };

  // --- YENİ EKLENEN: PERSONEL TAHTASI BİLEŞENİ ---
  const PersonelTahtasiView = ({ personnelList }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Sadece Mavi Yaka veya saha personeli olarak işaretlenenleri al
    const maviYakaList = personnelList.filter(p => 
      p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operatör'].includes(p.position))
    );

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
           // Rütbeye göre sıralama (Müdür > Ekip Şefi > Kalfa > Standart)
           const rankOrder = { 'Müdür': 1, 'Ekip Şefi': 2, 'Kalfa': 3, 'Asistan': 4, 'Standart': 5 };
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
                       <div key={person.id} className={`bg-white p-3 rounded-xl shadow-sm border transition hover:-translate-y-1 hover:shadow-md group relative overflow-hidden ${person.employmentStatus === 'Pasif' ? 'border-red-200 bg-red-50/30' : 'border-neutral-200 hover:border-orange-400'}`}>
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
                               {person.rank === 'Ekip Şefi' && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" title="Ekip Şefi" />}
                             </div>
                             
                             <div className="flex flex-col gap-1.5 mt-1.5">
                                <span className={`text-[10px] font-bold w-max px-2 py-0.5 rounded border ${
                                    person.rank === 'Ekip Şefi' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                    person.rank === 'Kalfa' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                    'bg-neutral-100 text-neutral-600 border-neutral-200'
                                }`}>
                                   {person.rank || 'Belirtilmedi'}
                                </span>
                                
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
                       <div key={person.id} className="bg-white p-3 rounded-xl shadow-sm border border-neutral-200 relative overflow-hidden group">
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

  // --- YENİ EKLENEN: EKİP KURMA TAHTASI KART BİLEŞENİ ---
  const BoardJobCard = ({ job, personnelList, vehicles, dragOverTarget, handleDragOver, handleDragLeave, handleDropToJob, handleDragStart, db, appId, calculateMaterials }) => {
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
    const isNakliye = job.type !== 'Depo';
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

    // EKLENEN YENİ METOTLAR: Doğrudan kart üzerinden malzeme ekleme ve çıkarma
    const handleAddCustomMaterial = async () => {
       if(newCustomMaterial.name.trim()) {
           const updated = [...customMaterials, { id: Date.now(), name: newCustomMaterial.name, amount: newCustomMaterial.amount }];
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
                        mesaiRecords[pId][d] = { status: 'G', hours: '' };
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
        className={`w-[260px] md:w-[280px] shrink-0 bg-white rounded-xl flex flex-col h-fit overflow-hidden border-2 transition-colors duration-200 shadow-md pb-1 ${dragOverTarget === job.id ? (isNakliye ? 'border-red-400 bg-red-50/50' : 'border-blue-400 bg-blue-50/50') : 'border-neutral-200 hover:border-neutral-300'}`}
      >
        {/* İŞ KARTI BAŞLIĞI */}
        <div className={`p-3 border-b-4 ${isNakliye ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'} shrink-0`}>
          <div className="flex justify-between items-start mb-1.5">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white ${isNakliye ? 'bg-red-600' : 'bg-blue-600'}`}>{job.type || 'Nakliye'}</span>
            <span className="text-[11px] font-bold text-neutral-600"><Clock className="w-3 h-3 inline mr-1" />{job.time}</span>
          </div>
          <h3 className="font-black text-[15px] text-black truncate mb-1" title={job.customerName}>{job.customerName}</h3>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-700 mb-2">
            <span className="bg-white px-1 py-0.5 rounded border border-neutral-300 shadow-sm">{job.fromRoomCount}</span>
            <span>•</span>
            <span className="truncate flex-1">{job.fromDistrict} ➔ {job.toDistrict || '?'}</span>
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
          ) : (
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-2 flex flex-col items-center justify-center text-neutral-400 bg-white/50 h-[46px]">
              <span className="text-[9px] font-bold flex items-center gap-1.5"><Truck className="w-3.5 h-3.5"/> Aracı Sürükleyin</span>
            </div>
          )}
        </div>

        {/* Atanmış Personeller */}
        <div className="h-[280px] p-2 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 bg-neutral-100/50 shrink-0">
          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5 block">Görevli Personeller</span>
          
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
            <label className="block text-[9px] font-bold text-amber-800/80 mb-1">Sistem Harici Malzeme Ekle</label>
            <div className="flex gap-1">
              <input type="text" value={newCustomMaterial.name} onChange={e => setNewCustomMaterial({...newCustomMaterial, name: e.target.value})} placeholder="Örn: Askılı Koli" className="flex-1 p-1 text-[9px] border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 font-bold bg-white" />
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
      </div>
    );
  };

  const EkipKurmaTahtasiView = ({ jobs, personnelList, vehicles, db, appId, addSystemLog }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [dragOverTarget, setDragOverTarget] = useState(null);
    const [mesaiData, setMesaiData] = useState({});
    const [showBusyPersonnel, setShowBusyPersonnel] = useState(false);

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
      (j.type === 'Nakliye' || j.type === 'Depo' || !j.type) && 
      j.status !== 'cancelled'
    ).sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

    const maviYakaList = personnelList.filter(p => 
      p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu'].includes(p.position))
    );

    const busyPersonnelIdsThisDay = jobs
      .filter(j => j.date === selectedDate && j.status !== 'cancelled')
      .flatMap(j => j.assignedPersonnelIds || []);

    const busyVehiclesThisDay = jobs
      .filter(j => j.date === selectedDate && j.status !== 'cancelled' && j.assignedVehiclePlate)
      .map(j => j.assignedVehiclePlate);

    const selectedDay = parseInt(selectedDate.split('-')[2], 10);

    let displayPersonnel = maviYakaList.filter(p => {
       const d = mesaiData[p.id]?.[selectedDay];
       const st = typeof d === 'object' && d !== null ? d.status : d;
       if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ'].includes(st)) return false; 
       if (!showBusyPersonnel && busyPersonnelIdsThisDay.includes(p.id)) return false; 
       return true;
    });

    const posOrder = { 'Şoför': 1, 'Mobilya Ustası': 2, 'Taşıma Elemanı': 3 };
    displayPersonnel.sort((a, b) => {
        const orderA = posOrder[a.position] || 99;
        const orderB = posOrder[b.position] || 99;
        return orderA - orderB;
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
    };

    const handleDragOver = (e, targetId) => {
      e.preventDefault();
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

          if (newIds.length === 0) {
              const isValidFirst = targetJob.type === 'Asansör'
                ? person.position === 'Operatör'
                : (person.rank === 'Ekip Şefi' || person.rank === 'Kalfa' || person.rank === 'Müdür' || person.position === 'Firma Sahibi');

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

    return (
      <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] animate-in fade-in pb-4">
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

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
          
          {/* SOL: İŞ SÜTUNLARI (DİKEY KAYDIRMA AKTİF EDİLDİ) */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200 h-full relative">
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
            className={`w-full lg:w-[260px] xl:w-[280px] h-full flex flex-col gap-4 shrink-0 transition-colors ${dragOverTarget === 'unassigned' ? 'bg-orange-50/50 rounded-2xl ring-2 ring-orange-400 ring-inset p-2' : ''}`}
          >
            {/* Araç Havuzu */}
            <div className="h-1/3 flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
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
            <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="p-2.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-xs text-black flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-orange-500" /> Ekipler
                </h3>
                <button 
                  onClick={() => setShowBusyPersonnel(!showBusyPersonnel)}
                  className={`text-[9px] font-bold px-2 py-1 rounded transition ${showBusyPersonnel ? 'bg-orange-500 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                  {showBusyPersonnel ? 'Meşgulleri Gizle' : '+ İkinci İşi Ata'}
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
                        <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  };
  // --- EKİP KURMA TAHTASI SONU ---

  const ProfileSettingsView = ({ currentUser, handleUpdatePersonnel }) => {
    const [editForm, setEditForm] = useState({ 
      personalPhone: currentUser?.personalPhone || '', 
      password: currentUser?.password || '', 
      profileImage: currentUser?.profileImage || '' 
    });
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    const showMessage = (text, type = 'success') => {
      setStatusMessage({ text, type });
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
    };

    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      setEditForm(prev => ({ ...prev, profileImage: 'Yükleniyor...' }));
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://www.sembolevdeneve.com/crm/upload.php', { method: 'POST', body: formData });
        const text = await res.text();
        let uploadedUrl = file.name;
        try { const json = JSON.parse(text); uploadedUrl = json.url || json.fileName || json.file || text; } catch (err) { uploadedUrl = text.trim(); }
        setEditForm(prev => ({ ...prev, profileImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err); 
        showMessage("Görsel yüklenemedi.", "error"); 
        setEditForm(prev => ({ ...prev, profileImage: '' }));
      }
      setIsUploading(false);
    };

    const handleSaveProfile = (e) => {
      e.preventDefault();
      handleUpdatePersonnel({ ...currentUser, ...editForm });
      showMessage('Profil bilgileriniz güncellendi.', 'success');
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto relative">
         {statusMessage.text && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-sm shadow-xl z-50 animate-in slide-in-from-top-4 ${statusMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
              {statusMessage.text}
            </div>
         )}
         <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
           <User className="w-7 h-7 text-red-600" /> Profil Bilgilerim
         </h2>
         <form onSubmit={handleSaveProfile} className="space-y-6">
           <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
             <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-neutral-200 flex items-center justify-center shrink-0">
               {editForm.profileImage === 'Yükleniyor...' ? (
                 <span className="text-xs text-neutral-500 font-bold animate-pulse">Yükleniyor...</span>
               ) : editForm.profileImage ? (
                 <img src={editForm.profileImage} alt="Profil" className="w-full h-full object-cover" />
               ) : (
                 <User className="w-10 h-10 text-neutral-400" />
               )}
             </div>
             <div className="flex flex-col gap-2 w-full sm:w-auto">
               <label className="block text-sm font-bold text-neutral-700">Profil Fotoğrafını Değiştir</label>
               <label className="cursor-pointer px-4 py-2 bg-white border border-neutral-300 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-50 transition w-full sm:w-fit shadow-sm">
                 <Upload className="w-4 h-4 text-neutral-600" />
                 <span className="text-sm font-bold text-neutral-700">Fotoğraf Seç</span>
                 <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
               </label>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Ad Soyad (Değiştirilemez)</label>
               <input type="text" readOnly value={currentUser.fullName} className="w-full p-3 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-500 font-bold outline-none cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Pozisyon (Değiştirilemez)</label>
               <input type="text" readOnly value={currentUser.position} className="w-full p-3 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-500 font-bold outline-none cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Kişisel Telefon</label>
               <input type="tel" value={editForm.personalPhone} onChange={e => setEditForm({...editForm, personalPhone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-1">Giriş Şifresi</label>
               <input type="text" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
             </div>
           </div>

           <button type="submit" disabled={isUploading} className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 disabled:opacity-50">
             Bilgilerimi Güncelle
           </button>
         </form>
      </div>
    );
  };

  const MyAssignedJobsView = ({ jobs, currentUser, handleOpenEndJobModal, markNotificationsAsRead }) => {
    useEffect(() => {
      if (currentUser?.id) {
        markNotificationsAsRead(currentUser.id);
      }
    }, [currentUser?.id]); // Sonsuz döngüyü kırmak için obje bağımlılığı kaldırıldı, sadece ID dinleniyor

    const todayStr = new Date().toISOString().split('T')[0];
    
    // YENİ EKLENEN: Mavi yaka ve Ekip Şefi OLMAYAN durumu kontrol et
    const isStandardBlueCollar = (currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position))) && currentUser?.rank !== 'Ekip Şefi' && currentUser?.rank !== 'Kalfa' && currentUser?.rank !== 'Müdür' && currentUser?.position !== 'Firma Sahibi' && !currentUser?.permissions?.canEdit;

    const myJobs = jobs.filter(j => {
        const isAssigned = j.assignedPersonnelIds?.includes(currentUser.id) || j.assignedPersonnelId === currentUser.id;
        if (!isAssigned) return false;
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

  const MyTasksView = ({ currentUser, tasks, handleUpdateTaskStatus }) => {
    const myTasks = tasks.filter(t => t.assignee === currentUser?.fullName || t.assignee === 'Tüm Personeller');
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-in fade-in max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2 border-b border-neutral-200 pb-4">
          <CheckSquare className="w-6 h-6 text-red-600" /> Özel Görevlerim
        </h2>
        <div className="space-y-4">
           {myTasks.length === 0 ? (
              <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 font-medium">
                Size atanmış özel bir görev bulunmuyor.
              </div>
           ) : myTasks.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(task => (
              <div key={task.id} className="p-5 border border-neutral-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-black text-lg">{task.title}</h3>
                      <p className="text-xs font-bold text-neutral-400 mt-1">Son Tarih: {task.date}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      task.status === 'completed' ? 'bg-black text-white' :
                      task.status === 'in-progress' ? 'bg-blue-600 text-white' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {task.status === 'completed' ? 'Yapıldı' : task.status === 'in-progress' ? 'İşleniyor' : 'Bekliyor'}
                    </span>
                 </div>
                 <p className="text-sm text-neutral-600">{task.description}</p>
                 
                 <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100">
                   {task.status !== 'todo' && <button onClick={() => handleUpdateTaskStatus(task.id, 'todo')} className="flex-1 py-2 text-xs font-bold rounded-lg border border-neutral-200 hover:bg-neutral-50 transition">Bekliyor Yap</button>}
                   {task.status !== 'in-progress' && <button onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')} className="flex-1 py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition">İşleme Al</button>}
                   {task.status !== 'completed' && <button onClick={() => handleUpdateTaskStatus(task.id, 'completed')} className="flex-1 py-2 text-xs font-bold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition">Tamamlandı</button>}
                 </div>
              </div>
           ))}
        </div>
      </div>
    );
  };

  const MyComplaintSubmitView = ({ currentUser, db, appId, addSystemLog }) => {
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
         <form onSubmit={submitComplaint} className="space-y-4">
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
            <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-lg shadow-red-600/20 mt-4">
               <Send className="w-5 h-5" /> Bildirimi Yöneticilere Gönder
            </button>
         </form>
      </div>
    );
  };

  // --- PUANTAJ VIEW (Aylık Tablo) ---
  const PuantajView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
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

  const MesaiView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [mesaiData, setMesaiData] = useState({});
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
          if (snap.exists()) {
            setMesaiData(snap.data().records || {});
          } else {
            setMesaiData({});
          }
        } catch (e) {
          console.error("Mesai yüklenirken hata:", e);
        } finally {
          setIsDataLoaded(true);
        }
      };
      fetchMesai();
    }, [currentMonth, currentYear, db, appId, docPrefix]);

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
            else if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ'].includes(val.status)) counts.I++;
            else if (val.status === 'FM') { counts.G++; counts.FM_H += parseFloat(val.hours) || 0; }
            else if (val.status === 'EM') { counts.G++; counts.EM_H += parseFloat(val.hours) || 0; }
            else if (val.status === 'FGM') { counts.FG++; counts.FM_H += parseFloat(val.hours) || 0; }
        } else {
             // Eski veri yapısı uyumluluğu
            if (val && val.startsWith('G')) counts.G++;
            else if (val === 'FG') counts.FG++;
            else if (val === 'D') counts.D++;
            else if (['R', 'Hİ', 'Yİ', 'Bİ', 'Üİ'].includes(val)) counts.I++;
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

  const MaasView = ({ collarType, personnelList, db, appId, addSystemLog }) => {
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
          else if (val.status === 'Üİ') ucretsizIzinCount++;
          else if (val.status === 'FG') fazlaGunCount++;
          else if (val.status === 'FGM') { fazlaGunCount++; toplamMesaiSaati += parseFloat(val.hours) || 0; }
          else if (val.status === 'FM') toplamMesaiSaati += parseFloat(val.hours) || 0;
          else if (val.status === 'EM') toplamMesaiSaati -= parseFloat(val.hours) || 0;
        } else {
          if (val === 'D') devamsiz++;
          else if (val === 'R') raporCount++;
          else if (val === 'Üİ') ucretsizIzinCount++;
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
                        <button type="button" onClick={() => handleCellChange(person.id, 'yemekOdendi', !row.yemekOdendi)} className={`p-1 shrink-0 rounded transition ${row.yemekOdendi ? 'text-green-600' : 'text-neutral-300 hover:text-neutral-500'}`} title={row.yemekOdendi ? 'Ödendi' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className={`border-r border-neutral-300 p-1 ${row.yolOdendi ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input type="number" value={row.yol !== undefined ? row.yol : (person.yol || '')} onChange={e => handleCellChange(person.id, 'yol', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-neutral-100 focus:ring-1 focus:ring-neutral-400 rounded" placeholder="0" />
                        <button type="button" onClick={() => handleCellChange(person.id, 'yolOdendi', !row.yolOdendi)} className={`p-1 shrink-0 rounded transition ${row.yolOdendi ? 'text-green-600' : 'text-neutral-300 hover:text-neutral-500'}`} title={row.yolOdendi ? 'Ödendi' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-red-50/50">
                      <input type="number" value={(yearlyData[person.id] && yearlyData[person.id].borclanma) || ''} onChange={e => handleYearlyChange(person.id, 'borclanma', e.target.value)} className="w-full h-8 text-center bg-transparent outline-none focus:bg-red-100 focus:ring-1 focus:ring-red-400 rounded text-red-700 font-bold" placeholder="0" title="Tüm yıl boyunca geçerlidir. Yıl sonunda sıfırlanır." />
                    </td>
                    <td className="border-r border-neutral-300 p-1 bg-red-100 font-black text-red-800 text-center align-middle">
                      {c.icraKesintisi.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`border-r border-neutral-300 p-1 align-middle ${row.bankaOdendi ? 'bg-green-200' : 'bg-yellow-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${row.bankaOdendi ? 'text-green-800 line-through opacity-70' : 'text-yellow-900'}`}>{c.bankaKalan.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handleCellChange(person.id, 'bankaOdendi', !row.bankaOdendi)} className={`p-0.5 shrink-0 rounded transition ${row.bankaOdendi ? 'text-green-700' : 'text-yellow-600/50 hover:text-yellow-800'}`} title={row.bankaOdendi ? 'Ödendi' : 'Ödenmedi'}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className={`p-1 align-middle ${row.nakitOdendi ? 'bg-green-300' : 'bg-orange-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-black ${row.nakitOdendi ? 'text-green-900 line-through opacity-70' : 'text-orange-900'}`}>{c.kalanNakit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={() => handleCellChange(person.id, 'nakitOdendi', !row.nakitOdendi)} className={`p-0.5 shrink-0 rounded transition ${row.nakitOdendi ? 'text-green-800' : 'text-orange-600/50 hover:text-orange-800'}`} title={row.nakitOdendi ? 'Ödendi' : 'Ödenmedi'}>
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

  const PersonelMuhasebeView = ({ personnelList, db, appId, addSystemLog }) => {
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
    const [isTodoSubMenuOpen, setIsTodoSubMenuOpen] = useState(false);
    
    const [isOperasyonSubMenuOpen, setIsOperasyonSubMenuOpen] = useState(false);
    
    const [recordType, setRecordType] = useState('Nakliye');
    const [transactionType, setTransactionType] = useState('income');
    const [editingJobId, setEditingJobId] = useState(null); 
    const [cancelJobId, setCancelJobId] = useState(null); 
    const [deleteJobId, setDeleteJobId] = useState(null);
    const [markDamageJobId, setMarkDamageJobId] = useState(null);
    const [resolveDamageModal, setResolveDamageModal] = useState({ isOpen: false, jobId: null, note: '' });

    const [showSecondFromAddress, setShowSecondFromAddress] = useState(false);
    const [showSecondToAddress, setShowSecondToAddress] = useState(false);

    // Modal State'leri
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [jobToAssign, setJobToAssign] = useState(null);
    const [assigneeId, setAssigneeId] = useState('');
    const [additionalAssignees, setAdditionalAssignees] = useState([]);
    const [manualExtraAssignees, setManualExtraAssignees] = useState([]);
    const [assignedVehiclePlate, setAssignedVehiclePlate] = useState('');
    const [showBusyPersonnel, setShowBusyPersonnel] = useState(false); // Yeni State
    const [assignOperationNote, setAssignOperationNote] = useState(''); // Yeni: Operasyon Notu State'i
    
    // Görev Atama Sırasında Malzeme Yönetimi State'leri
    const [assignedMaterials, setAssignedMaterials] = useState({ strec: 0, bant: 0, poset: 0, kagit: 0, koli: 0 });
    const [customMaterials, setCustomMaterials] = useState([]);
    const [newCustomMaterial, setNewCustomMaterial] = useState({ name: '', amount: 1 });
    
    // Asansör Özel Görev Atama State'leri
    const [assignedTargetVehiclePlate, setAssignedTargetVehiclePlate] = useState('');
    const [isTargetVehicleExternal, setIsTargetVehicleExternal] = useState(false);
    const [assignedJobTime, setAssignedJobTime] = useState('');

    const [teamSuggestion, setTeamSuggestion] = useState(null); // YENİ: Yapay zeka tahmini ekip state'i

    const [showEndJobModal, setShowEndJobModal] = useState(false);
    const [jobToEnd, setJobToEnd] = useState(null);
    const [endJobError, setEndJobError] = useState('');
    const [endJobData, setEndJobData] = useState({ 
      paymentMethod: 'Nakit', 
      damageStatus: 'Hasarsız teslim edildi', 
      damageDetails: '',
      damageImages: [],
      truckImages: [],
      truckStatus: 'Herhangi bir sorun yok',
      truckIssueDetails: '',
      customerSatisfaction: 'Herhangi bir işlem yapmadı.',
      enteredCode: '',
      elevatorSetup: 'Evet',
      elevatorSetupReason: '',
      elevatorImages: [],
      elevatorIssue: 'Hayır',
      elevatorIssueReason: '',
      vehicleIssue: 'Hayır',
      vehicleIssueReason: ''
    });

    // Puan Onay Modal State
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [jobToApprove, setJobToApprove] = useState(null);
    const [approveData, setApproveData] = useState({ addPoints: 'Evet', reviewImage: '' });

    // Mesai Onay Modal State
    const [showMesaiModal, setShowMesaiModal] = useState(false);
    const [jobForMesai, setJobForMesai] = useState(null);
    const [mesaiModalData, setMesaiModalData] = useState({});

    const [aiModal, setAiModal] = useState({ isOpen: false, loading: false, content: '', title: '', type: '' });
    const [viewingImage, setViewingImage] = useState(null);

    // --- FİREBASE VERİ STATE'LERİ ---
    const [dataLoadStatus, setDataLoadStatus] = useState({
      jobs: false, trans: false, tasks: false, notif: false, msg: false, logs: false, veh: false, mat: false, pers: false, settings: false, contacts: false, todos: false
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
    const [complaints, setComplaints] = useState([]); // Yeni: Şikayetler State
    const [companyContacts, setCompanyContacts] = useState([]); // Yeni: Şirket İletişim Hattı
    const [todos, setTodos] = useState([]); // Yapılacak Listesi
    const [companyPasswords, setCompanyPasswords] = useState([]); // Kurumsal Şifreler
    
    // Form State'leri
    const [newTransaction, setNewTransaction] = useState({ amount: '', category: 'Nakliye Tahsilatı', account: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [draggingTask, setDraggingTask] = useState(null);
    const [newTask, setNewTask] = useState({ title: '', description: '', assignee: 'Tüm Personeller', date: new Date().toISOString().split('T')[0] });
    const [newTodo, setNewTodo] = useState({ title: '', details: '', reminderDate: new Date().toISOString().split('T')[0], priority: 'Normal', status: 'todo' });

    // İletişim Hattı Modal
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', phone: '', position: '' });
    const [isContactsOpen, setIsContactsOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    // Araç Düzenleme State'leri
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [vehicleEditForm, setVehicleEditForm] = useState({});

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

    const isAddingCengizRef = React.useRef(false);

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

    // Kayıt ekranında aynı isim veya numara girildiğinde uyarı/eşleştirme için
    const [existingCustomerMatch, setExistingCustomerMatch] = useState(null);

    // Telefon numarası veya isim değiştiğinde mevcut müşterileri kontrol et
    useEffect(() => {
      if (activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') {
        if (formData.customerPhone && formData.customerPhone.length > 5) {
          const matchedJob = jobs.find(j => 
            j.customerPhone.replace(/\s+/g, '') === formData.customerPhone.replace(/\s+/g, '')
          );
          
          if (matchedJob && matchedJob.customerName !== formData.customerName) {
            setExistingCustomerMatch({
              type: 'phone',
              name: matchedJob.customerName,
              phone: matchedJob.customerPhone
            });
            return;
          }
        }
        
        if (formData.customerName && formData.customerName.length > 3) {
           const matchedJob = jobs.find(j => 
              j.customerName.toLowerCase() === formData.customerName.toLowerCase()
           );

           if (matchedJob && matchedJob.customerPhone !== formData.customerPhone && !formData.customerPhone) {
              setExistingCustomerMatch({
                type: 'name',
                name: matchedJob.customerName,
                phone: matchedJob.customerPhone
              });
              return;
           }
        }
        
        setExistingCustomerMatch(null);
      }
    }, [formData.customerName, formData.customerPhone, activeTab, jobs]);

    useEffect(() => {
      if (!firebaseUser) return;
      const getCol = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);
      const unsubs = [];

// Son 60 günün operasyonlarını çekmek için tarih hesaplaması
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const startDateStr = sixtyDaysAgo.toISOString().split('T')[0];

      const qJobs = query(getCol('jobs'), where('date', '>=', startDateStr));
      const qTrans = query(getCol('transactions'), limit(300));
      const qTasks = query(getCol('tasks'), limit(100));

      unsubs.push(onSnapshot(qJobs, snap => { setJobs(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, jobs: true})); }, console.error));
      unsubs.push(onSnapshot(qTrans, snap => { setTransactions(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, trans: true})); }, console.error));
      unsubs.push(onSnapshot(qTasks, snap => { setTasks(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, tasks: true})); }, console.error));
            
      // KARA DELİKLER - Sürekli şişen ve geçmişe dönük gereksiz okuma yapan verilere limit eklendi
      const qNotifs = query(getCol('notifications'), limit(100));
      const qMsgs = query(getCol('messages'), limit(50));
      const qLogs = query(getCol('systemLogs'), limit(100));
      const qComplaints = query(getCol('complaints'), limit(50));

      unsubs.push(onSnapshot(qNotifs, snap => { setNotifications(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, notif: true})); }, console.error));
      unsubs.push(onSnapshot(qMsgs, snap => { setMessages(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, msg: true})); }, console.error));
      unsubs.push(onSnapshot(qLogs, snap => { setSystemLogs(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, logs: true})); }, console.error));
      unsubs.push(onSnapshot(qComplaints, snap => { setComplaints(snap.docs.map(d => ({...d.data(), id: d.id}))); }, console.error));
      
      unsubs.push(onSnapshot(getCol('vehicles'), snap => { setVehicles(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, veh: true})); }, console.error));
      unsubs.push(onSnapshot(getCol('materials'), snap => { setMaterials(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, mat: true})); }, console.error));
      unsubs.push(onSnapshot(getCol('companyContacts'), snap => { 
        let contacts = snap.docs.map(d => ({...d.data(), id: d.id}));
        contacts.sort((a, b) => (a.order || 0) - (b.order || 0));
        setCompanyContacts(contacts); 
        setDataLoadStatus(p => ({...p, contacts: true})); 
      }, console.error));
      unsubs.push(onSnapshot(getCol('todos'), snap => { setTodos(snap.docs.map(d => ({...d.data(), id: d.id}))); setDataLoadStatus(p => ({...p, todos: true})); }, console.error));
      unsubs.push(onSnapshot(getCol('companyPasswords'), snap => { setCompanyPasswords(snap.docs.map(d => ({...d.data(), id: d.id}))); }, console.error));

      unsubs.push(onSnapshot(getCol('personnelList'), async snap => {
        const list = snap.docs.map(d => ({...d.data(), id: d.id})); 
        setPersonnelList(list);
        if (snap.empty) {
          await addDoc(getCol('personnelList'), {
            fullName: 'Sistem Yöneticisi', email: 'admin', password: 'admin', position: 'Firma Sahibi', rank: 'Müdür', employmentStatus: 'Aktif', permissions: { canView: true, canEdit: true }
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
          const defaultPos = ['Şoför', 'Taşıma Elemanı', 'Muhasebe', 'Mobilya Ustası', 'Satış Personeli', 'Depo Sorumlusu', 'Temizlik Görevlisi', 'Operasyon', 'Operatör', 'Firma Sahibi'];
          const defaultRanks = ['Müdür', 'Ekip Şefi', 'Asistan', 'Standart', 'Kalfa'];
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'company'), { positions: defaultPos, ranks: defaultRanks });
          setPositions(defaultPos);
          setRanks(defaultRanks);
        }
        setDataLoadStatus(p => ({...p, settings: true}));
      }, console.error));

      return () => unsubs.forEach(unsub => unsub());
    }, [firebaseUser]);

    useEffect(() => {
      if (personnelList.length > 0 && !isAuthenticated) {
        try {
          const savedUser = localStorage.getItem('sembol_crm_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            const parsedInput = (parsed.email || '').trim().toLocaleLowerCase('tr-TR');
            const user = personnelList.find(p => {
              const pEmail = (p.email || '').trim().toLocaleLowerCase('tr-TR');
              const pName = (p.fullName || '').trim().toLocaleLowerCase('tr-TR');
              return (pEmail === parsedInput || pName === parsedInput) && p.password === parsed.password;
            });
            if (user && user.employmentStatus !== 'Pasif') {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }
          }
        } catch (e) {}
      }
    }, [personnelList, isAuthenticated]); 

    useEffect(() => {
      if (isAuthenticated && currentUser && personnelList.length > 0) {
        const updatedUser = personnelList.find(p => p.id === currentUser.id);
        if (updatedUser) {
          if (updatedUser.employmentStatus === 'Pasif') {
             setCurrentUser(updatedUser);
          } else if (JSON.stringify(updatedUser.permissions) !== JSON.stringify(currentUser.permissions) || updatedUser.employmentStatus !== currentUser.employmentStatus) {
             setCurrentUser(updatedUser);
          }
        } else {
          handleLogout();
        }
      }
    }, [personnelList]);

    // --- FIREBASE CRUD İŞLEMLERİ ---

    const handleAddContact = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      if (editingContact) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', editingContact.id), contactForm);
        addSystemLog('İletişim Hattı', `Şirket iletişim hattındaki kişi güncellendi: ${contactForm.name}`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companyContacts'), { ...contactForm, order: companyContacts.length });
        addSystemLog('İletişim Hattı', `Şirket iletişim hattına yeni kişi eklendi: ${contactForm.name}`);
      }
      setContactForm({ name: '', phone: '', position: '' });
      setShowContactModal(false);
      setEditingContact(null);
    };

    const handleDeleteContact = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', id));
    };

    const handleReorderContact = async (index, direction) => {
      if (!firebaseUser) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= companyContacts.length) return;
      
      const current = companyContacts[index];
      const target = companyContacts[newIndex];
      
      const currentOrder = current.order !== undefined ? current.order : index;
      const targetOrder = target.order !== undefined ? target.order : newIndex;
      
      await Promise.all([
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', current.id), { order: targetOrder }),
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companyContacts', target.id), { order: currentOrder })
      ]);
    };

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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id), data);
      addSystemLog('Personel Güncellendi', `${data.fullName} bilgileri güncellendi.`);
    };

    const handleDeletePersonnel = async (id) => {
      if (!firebaseUser) return;
      const person = personnelList.find(p => p.id === id);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', id));
      if(person) addSystemLog('Personel Silindi', `${person.fullName} sistemden kaldırıldı.`);
      if (currentUser && currentUser.id === id) handleLogout();
    };

    const handleUpdateModuleAccess = async (userId, modulesData) => {
      if (!firebaseUser) return;
      const user = personnelList.find(p => p.id === userId);
      if (!user) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', userId), {
        permissions: { ...user.permissions, modules: modulesData }
      });
      addSystemLog('Görüntüleme Yetkileri', `${user.fullName} personelinin modül erişim izinleri güncellendi.`);
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

    const handleUpdateVehicle = async (updatedVehicle) => {
      if (!firebaseUser) return;
      const { id, ...data } = updatedVehicle;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', id), data);
      addSystemLog('Araç Güncellendi', `${data.plate} plakalı araç bilgileri güncellendi.`);
      setEditingVehicle(null);
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

    const handleUpdateMaterialStock = async (materialId, amountChange, description, cost) => {
      if (!firebaseUser) return;
      const material = materials.find(m => m.id === materialId);
      if (!material) return;

      const changeNum = parseFloat(amountChange) || 0;
      const newStock = Math.max(0, parseFloat(material.stock) + changeNum);

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', materialId), {
        stock: String(newStock)
      });

      let actionText = changeNum > 0 ? 'Stok Girişi' : 'Stok Çıkışı';
      let detailsText = `${material.name} malzemesi için ${Math.abs(changeNum)} ${material.unit} ${actionText} yapıldı.`;
      if (description) detailsText += ` Açıklama: ${description}.`;
      if (cost && parseFloat(cost) > 0) detailsText += ` Tutar: ₺${cost}.`;

      addSystemLog(actionText, detailsText);

      // Finans Eklemesi
      if (cost && parseFloat(cost) > 0 && changeNum > 0) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
          type: 'expense',
          amount: parseFloat(cost),
          category: 'Malzeme Alımı',
          account: 'cash',
          date: new Date().toISOString().split('T')[0],
          description: `${material.name} Alımı: ${description || ''}`.trim()
        });
      } else if (cost && parseFloat(cost) > 0 && changeNum < 0) {
         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
          type: 'income',
          amount: parseFloat(cost),
          category: 'Malzeme Satışı / Çıkışı',
          account: 'cash',
          date: new Date().toISOString().split('T')[0],
          description: `${material.name} Çıkışı: ${description || ''}`.trim()
        });
      }
    };

    const handleAddTask = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), { ...newTask, status: 'todo' });
      setShowTaskModal(false);
      setNewTask({ title: '', description: '', assignee: 'Tüm Personeller', date: new Date().toISOString().split('T')[0] });
      setActiveTab('taskList');
    };
    
    const handleUpdateTaskStatus = async (taskId, status) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), { status });
    };

    const handleAddTodo = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'todos'), { ...newTodo, createdBy: currentUser?.fullName, createdAt: new Date().toISOString() });
      setNewTodo({ title: '', details: '', reminderDate: new Date().toISOString().split('T')[0], priority: 'Normal', status: 'todo' });
      setActiveTab('todoList');
      addSystemLog('Yapılacak Eklendi', `Yeni bir yapılacak iş eklendi: ${newTodo.title}`);
    };

    const handleUpdateTodoStatus = async (id, status) => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'todos', id), { status });
    };

    const handleDeleteTodo = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'todos', id));
      addSystemLog('Yapılacak Silindi', `Yapılacak listesinden bir kayıt silindi.`);
    };

    const handleApprovePoints = async (job, individualPoints, reviewImageUrl, supportPersonnelIds = []) => {
      if (!firebaseUser) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
          pointsApproved: true,
          reviewImage: reviewImageUrl || null,
          supportPersonnelIds: supportPersonnelIds
        });

        const hasAnyPoints = Object.values(individualPoints).some(v => parseFloat(v) > 0) || (supportPersonnelIds && supportPersonnelIds.length > 0);

        if (hasAnyPoints) {
          const jobDate = new Date(job.date);
          const year = jobDate.getFullYear();
          const month = jobDate.getMonth() + 1;
          const day = jobDate.getDate();

          const puantajRef = doc(db, 'artifacts', appId, 'public', 'data', 'puantaj', `${year}_${month}`);
          const snap = await getDoc(puantajRef);
          let records = snap.exists() ? snap.data().records : {};

          let addedMainPoints = false;
          
          // Asıl ekibin özel puanlarını kaydet
          Object.keys(individualPoints).forEach(pId => {
            const pts = parseFloat(individualPoints[pId]) || 0;
            if (pts > 0) {
              if (!records[pId]) records[pId] = {};
              records[pId][day] = (parseFloat(records[pId][day]) || 0) + pts;
              addedMainPoints = true;
            }
          });

          // Günlük yorum/puan sayısını +1 artır (Eğer asıl ekibe bir puan girildiyse)
          if (addedMainPoints) {
            if (!records['daily_comments']) records['daily_comments'] = {};
            records['daily_comments'][day] = (parseFloat(records['daily_comments'][day]) || 0) + 1;
          }

          if (supportPersonnelIds && supportPersonnelIds.length > 0) {
            supportPersonnelIds.forEach(spId => {
              if (!records[spId]) records[spId] = {};
              records[spId][day] = (parseFloat(records[spId][day]) || 0) + 0.5;
            });

            const notifsCol = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
            const assignDateStr = new Date().toISOString().split('T')[0];
            for (const spId of supportPersonnelIds) {
              await addDoc(notifsCol, {
                userId: spId,
                title: '🌟 Takım Desteği Puanı!',
                message: `Diğer takım arkadaşlarınıza yardımcı olduğunuz için teşekkür ederiz! Harika iş çıkardınız. Destek puanınız (0.5) hanenize eklendi.`,
                date: new Date().toLocaleString('tr-TR'),
                read: false,
                type: 'support_bonus',
                assignedDate: assignDateStr,
                jobDate: job.date
              });
            }
          }

          await setDoc(puantajRef, { records, updatedAt: new Date().toISOString() }, { merge: true });
        }

        addSystemLog('Puan Onaylandı', `${job.customerName} operasyonu için müşteri puanı/yorumu onaylandı.`);
        alert("İşlem başarıyla tamamlandı!");
      } catch (e) {
        console.error(e);
        alert("Puan onaylanırken hata oluştu.");
      }
    };

    const handleOpenApproveModal = (job) => {
      setJobToApprove(job);
      const teamIds = job.assignedPersonnelIds ? [...job.assignedPersonnelIds] : [];
      if (job.assignedPersonnelId && !teamIds.includes(job.assignedPersonnelId)) {
        teamIds.push(job.assignedPersonnelId);
      }
      const initialPoints = {};
      teamIds.forEach(id => {
         initialPoints[id] = 1; // Varsayılan olarak herkese 1 puan ayarla
      });
      setApproveData({ individualPoints: initialPoints, reviewImage: '', supportPersonnelIds: [] });
      setShowApproveModal(true);
    };

    const handleReviewImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setApproveData(prev => ({ ...prev, reviewImage: 'Yükleniyor...' }));

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
        setApproveData(prev => ({ ...prev, reviewImage: uploadedUrl }));
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("Görsel yüklenemedi.");
        setApproveData(prev => ({ ...prev, reviewImage: '' }));
      }
    };

    const submitApprovePoints = async (e) => {
      e.preventDefault();
      if (approveData.reviewImage === 'Yükleniyor...') {
        alert('Lütfen görselin yüklenmesini bekleyin.');
        return;
      }
      await handleApprovePoints(jobToApprove, approveData.individualPoints, approveData.reviewImage, approveData.supportPersonnelIds);
      setShowApproveModal(false);
      setJobToApprove(null);
    };
    
    const handleOpenMesaiModal = async (job) => {
      setJobForMesai(job);
      const teamIds = job.assignedPersonnelIds ? [...job.assignedPersonnelIds] : [];
      if (job.assignedPersonnelId && !teamIds.includes(job.assignedPersonnelId)) {
        teamIds.push(job.assignedPersonnelId);
      }

      const validTeamIds = teamIds.filter(id => {
         const p = personnelList.find(pers => String(pers.id) === String(id));
         return p && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)));
      });

      const dateObj = new Date(job.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      try {
        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${year}_${month}`);
        const snap = await getDoc(mesaiRef);
        let records = snap.exists() ? snap.data().records : {};

        const initialModalData = {};
        validTeamIds.forEach(pId => {
          const valObj = records[pId] && records[pId][day];
          const val = typeof valObj === 'object' && valObj !== null ? valObj.status : valObj || '';
          const hours = typeof valObj === 'object' && valObj !== null ? valObj.hours : '';
          initialModalData[pId] = {
             status: val || 'G',
             hours: hours || ''
          };
        });

        setMesaiModalData(initialModalData);
        setShowMesaiModal(true);
      } catch (err) {
        console.error("Mesai bilgileri yüklenemedi", err);
        alert("Mesai bilgileri yüklenirken hata oluştu.");
      }
    };

    const submitMesaiApprove = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !jobForMesai) return;

      const dateObj = new Date(jobForMesai.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      try {
        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${year}_${month}`);
        const snap = await getDoc(mesaiRef);
        let records = snap.exists() ? snap.data().records : {};

        Object.keys(mesaiModalData).forEach(pId => {
          if (!records[pId]) records[pId] = {};
          records[pId][day] = mesaiModalData[pId];
        });

        await setDoc(mesaiRef, { records, updatedAt: new Date().toISOString() }, { merge: true });

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobForMesai.id), { mesaiApproved: true });

        addSystemLog('Mesai Onaylandı', `${jobForMesai.customerName} operasyonundaki personellerin mesai durumları güncellendi.`);
        setShowMesaiModal(false);
        setJobForMesai(null);
      } catch (err) {
        console.error("Mesai onaylanamadı", err);
        alert("Mesai kaydedilirken bir hata oluştu.");
      }
    };

    // Şikayet İşlemleri
    const handleUpdateComplaintStatus = async (id, status, isRead = false) => {
      if (!firebaseUser) return;
      const updateData = { status };
      if (isRead) updateData.read = true;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'complaints', id), updateData);
    };

    const handleDeleteComplaint = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'complaints', id));
    };

    const handleUpdateTask = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !editingTask) return;
      const { id, ...data } = editingTask;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id), data);
      setEditingTask(null);
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

      const amount = parseFloat(newTransaction.amount);

      // Negatif kasa kontrolü için net kasanın hesaplanması
      let allIncome = jobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + (parseFloat(j.price) || 0), 0) + transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      let allExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      let netBalance = allIncome - allExpense;

      // Negatif kasa kontrolü
      if (transactionType === 'expense' && netBalance - amount < 0) {
        alert(`Kasadaki net durumunuz: ₺${netBalance.toLocaleString('tr-TR')}. Lütfen işlem yapmadan önce kasanıza gelir/para ekleyin veya mevcut giderlerinizi düzenleyin.`);
        return;
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { 
        type: transactionType, amount: amount, category: newTransaction.category, account: newTransaction.account, date: newTransaction.date, description: newTransaction.description 
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

    const handleCompletelyDeleteJob = async (id) => {
      if (!firebaseUser) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id));
      addSystemLog('İş Kalıcı Olarak Silindi', `Sistem üzerinden bir operasyon kalıcı olarak silindi.`);
    };

    const handleMarkAsDamaged = async (id) => {
      if (!firebaseUser) return;
      const job = jobs.find(j => j.id === id);
      if (!job) return;
      
      const updatedEndJobDetails = {
        ...(job.endJobDetails || {}),
        damageStatus: 'Hasar var',
        damageDetails: job.endJobDetails?.damageDetails || 'Sonradan hasar bildirimi yapıldı.'
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), { 
        endJobDetails: updatedEndJobDetails 
      });
      addSystemLog('Hasar Bildirimi', `${job.customerName} müşterisinin tamamlanan operasyonuna hasar kaydı eklendi.`);
    };

    const handleOpenResolveDamageModal = (id) => {
      setResolveDamageModal({ isOpen: true, jobId: id, note: '' });
    };

    const handleResolveDamageSubmit = async (e) => {
      e.preventDefault();
      if (!firebaseUser || !resolveDamageModal.jobId) return;

      const job = jobs.find(j => j.id === resolveDamageModal.jobId);
      if (!job) return;

      const updatedEndJobDetails = {
        ...(job.endJobDetails || {}),
        damageResolved: true,
        damageResolutionNote: resolveDamageModal.note
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), {
        endJobDetails: updatedEndJobDetails
      });

      addSystemLog('Hasar Çözüldü', `${job.customerName} müşterisinin hasar kaydı çözüldü olarak işaretlendi.`);
      setResolveDamageModal({ isOpen: false, jobId: null, note: '' });
    };

    const handleAddJob = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      try {
        const jobData = { type: recordType, ...formData };
        Object.keys(jobData).forEach(key => jobData[key] === undefined && delete jobData[key]);

        const duration = parseInt(formData.durationDays || '1');

        if (editingJobId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', editingJobId), jobData);
          addSystemLog('Kayıt Güncellendi', `${formData.customerName} müşterisine ait iş güncellendi.`);
          setEditingJobId(null);
        } else {
          const newDeliveryCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          
          // İşlem Süresi (Gün) mantığı ile döngü
          for (let i = 0; i < duration; i++) {
            const jobDate = new Date(formData.date);
            jobDate.setDate(jobDate.getDate() + i);
            const dateStr = jobDate.toISOString().split('T')[0];

            const currentPrice = i === 0 ? jobData.price : '0';
            const currentDeposit = i === 0 ? jobData.deposit : '0';
            
            const primaryJob = { 
              ...jobData, 
              date: dateStr,
              price: currentPrice,
              deposit: currentDeposit,
              team: 'Atanmadı', 
              assignedPersonnelId: null, 
              assignedPersonnelIds: [], 
              teamNames: [], 
              status: 'pending', 
              endJobDetails: null, 
              deliveryCode: newDeliveryCode, 
              createdBy: currentUser?.fullName || 'Sistem' 
            };
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), primaryJob);
            
            if(i === 0) {
              addSystemLog('Yeni İş Kaydı', `${formData.customerName} için ${duration} günlük yeni bir ${recordType} kaydı oluşturuldu.`);
            }

            // Otomatik Asansör (Yalnızca ilk gün için asansör oluşturulsun)
            if (recordType !== 'Asansör' && i === 0) {
              const createAsansor = async (sourceAddr, installType) => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), {
                  type: 'Asansör', customerType: formData.customerType, tcNo: formData.tcNo, taxNo: formData.taxNo, customerName: formData.customerName, customerPhone: formData.customerPhone, altPhone: formData.altPhone, date: dateStr, time: formData.time, price: '0', deposit: '0', deliveryCode: newDeliveryCode, contractDetails: 'Otomatik Oluşturulan Asansör Kurulum Kaydı', notes: '', team: 'Atanmadı', assignedPersonnelId: null, assignedPersonnelIds: [], teamNames: [], status: 'pending', endJobDetails: null, createdBy: currentUser?.fullName || 'Sistem', fromFloor: sourceAddr.floor, fromDistance: sourceAddr.distance, fromDistanceUnit: sourceAddr.distanceUnit, fromPacking: 'Kendi İşimiz', fromProvince: sourceAddr.province || '', fromDistrict: sourceAddr.district || '', fromAddress: sourceAddr.address || '', toProvince: '', toDistrict: '', toAddress: '', toFloor: '', toRoomCount: '', toDistance: '', toDistanceUnit: '', extraLoadingAddresses: [], extraUnloadingAddresses: []
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
        }
        
        setFormData({
          isSpecial: false, customerType: 'Bireysel', tcNo: '', taxNo: '', customerName: '', customerPhone: '', altPhone: '', depoDirection: 'toDepo', fromProvince: '', fromDistrict: '', fromFloor: '1. Kat', fromPacking: 'Kendisi Topladı', fromTransportMethod: 'Merdiven', fromRoomCount: '1+1', fromDistance: '', fromDistanceUnit: 'Metre', fromAddress: '', extraLoadingAddresses: [], selectedDepo: '', toProvince: '', toDistrict: '', toFloor: '1. Kat', toPacking: 'Kendisi Topladı', toTransportMethod: 'Merdiven', toRoomCount: '1+1', toDistance: '', toDistanceUnit: 'Metre', toAddress: '', extraUnloadingAddresses: [], date: new Date().toISOString().split('T')[0], time: '08:00', durationDays: '1', price: '', deposit: '', team: 'Atanmadı', contractDetails: '', notes: ''
        });
        setActiveTab('dashboard');
      } catch (err) { console.error(err); }
    };

    const generateTeamSuggestion = (job) => {
      let base = 4; // default
      const room = job.fromRoomCount || '';
      const isDepo = job.type === 'Depo';

      if (room.includes('1+0') || room.includes('Parça')) base = isDepo ? 2 : 3;
      else if (room.includes('1+1')) base = isDepo ? 3 : 4;
      else if (room.includes('2+1')) base = isDepo ? 4 : 5;
      else if (room.includes('3+1')) base = isDepo ? 5 : 6;
      else if (room.includes('4+1') || room.includes('Villa') || room.includes('Ofis')) base = isDepo ? 6 : 7;
      else base = isDepo ? 4 : 5;

      let targetCount = base;
      let notes = [];
      notes.push(`${room} ${job.type || 'Nakliye'} operasyonu taban ekip: ${base} kişi.`);

      if (job.fromPacking === 'Toplama Yapılacak') {
        targetCount += 1;
        notes.push("Firma toplaması olduğu için +1 kişi eklendi.");
      }

      const getFloorNum = (floorStr) => {
        if (!floorStr) return 0;
        const match = floorStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };

      const fromFloor = getFloorNum(job.fromFloor);
      const toFloor = getFloorNum(job.toFloor);

      if (job.fromTransportMethod === 'Merdiven' && fromFloor > 3) {
        targetCount += 1;
        notes.push(`Yükleme ${fromFloor}. Kat Merdiven olduğu için +1 kişi eklendi.`);
      }
      if (job.toTransportMethod === 'Merdiven' && toFloor > 3) {
        targetCount += 1;
        notes.push(`Boşaltma ${toFloor}. Kat Merdiven olduğu için +1 kişi eklendi.`);
      }

      const isHighValue = parseInt(job.price || 0) > 25000;
      if (isHighValue) {
        notes.push("Yüksek bütçeli iş: Daha çok yorum alan tecrübeli ekiplere öncelik verildi.");
      }

      // O gün başka işte olanları bul (Müsaitlik kontrolü)
      const busyIds = jobs.filter(j => j.date === job.date && j.id !== job.id && j.status !== 'cancelled')
                          .flatMap(j => j.assignedPersonnelIds || []);

      // Müşteri Memnuniyeti / Yorum Skoru Hesaplama
      const personnelScores = {};
      personnelList.forEach(p => personnelScores[p.id] = 0);
      
      jobs.filter(j => j.status === 'completed' && j.pointsApproved).forEach(j => {
          (j.assignedPersonnelIds || []).forEach(id => {
              if(personnelScores[id] !== undefined) personnelScores[id] += 1;
          });
      });
      
      let available = personnelList.filter(p => !busyIds.includes(p.id) && ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(p.position));

      // Puan/Rank sıralaması (Önceliklendirme)
      available.sort((a, b) => {
         const rankWeight = { 'Müdür': 5, 'Ekip Şefi': 4, 'Kalfa': 3, 'Asistan': 2, 'Standart': 1 };
         let scoreA = rankWeight[a.rank] || 0;
         let scoreB = rankWeight[b.rank] || 0;
         
         // Yüksek fiyatlı işlerde yorum ve müşteri memnuniyeti puanını (x2 çarpanla) baz al
         if (isHighValue) {
             scoreA += (personnelScores[a.id] || 0) * 2;
             scoreB += (personnelScores[b.id] || 0) * 2;
         }

         return scoreB - scoreA;
      });

      const suggested = [];
      
      // 1. En az 1 Şoför ata
      const soforIdx = available.findIndex(p => p.position === 'Şoför');
      if (soforIdx > -1) suggested.push(available.splice(soforIdx, 1)[0]);

      // 2. En az 1 Mobilyacı ata
      const ustaIdx = available.findIndex(p => p.position === 'Mobilya Ustası');
      if (ustaIdx > -1) suggested.push(available.splice(ustaIdx, 1)[0]);

      // Daha önceki tamamlanmış işlerdeki "Birlikte Çalışma (Sinerji)" durumunu hesapla
      if (suggested.length > 0) {
          const anchorId = suggested[0].id;
          const synergyScores = {};
          jobs.filter(j => j.status === 'completed' && j.assignedPersonnelIds?.includes(anchorId)).forEach(j => {
              j.assignedPersonnelIds.forEach(id => {
                  if (id !== anchorId) {
                      synergyScores[id] = (synergyScores[id] || 0) + 1;
                  }
              });
          });

          // Kalan personeli Sinerji (birlikte çalışmış olma sıklığına) göre tekrar ağırlıklandır
          available.sort((a, b) => {
              const synA = synergyScores[a.id] || 0;
              const synB = synergyScores[b.id] || 0;
              return synB - synA; 
          });
      }

      // 3. Kalanı tamamlama (Sırasıyla: Şoför > Mobilyacı > Taşımacı)
      while (suggested.length < targetCount && available.length > 0) {
         let nextIdx = available.findIndex(p => p.position === 'Şoför');
         if (nextIdx === -1) nextIdx = available.findIndex(p => p.position === 'Mobilya Ustası');
         if (nextIdx === -1) nextIdx = available.findIndex(p => p.position === 'Taşıma Elemanı');
         if (nextIdx === -1) nextIdx = 0; // Güvenlik ağı

         suggested.push(available.splice(nextIdx, 1)[0]);
      }

      // 4. Sistemdeki uygun kadro yetmezse dışarıdan "Yevmiyeci" ekle
      let yevmiyeciCount = 1;
      while (suggested.length < targetCount) {
         suggested.push({ fullName: `Yevmiyeci ${yevmiyeciCount}`, position: 'Taşıma Elemanı', isExternal: true });
         yevmiyeciCount++;
      }

      return {
        targetCount,
        notes,
        suggested
      };
    };

    const handleOpenAssignModal = (job) => {
      setJobToAssign(job);
      setAssigneeId(job.assignedPersonnelId || '');
      setAssignedVehiclePlate(job.assignedVehiclePlate || '');
      setAssignOperationNote(job.notes || ''); // Mevcut notu state'e aktar
      setAdditionalAssignees(job.assignedPersonnelIds ? job.assignedPersonnelIds.filter(id => id !== job.assignedPersonnelId) : []);
      
      // Asansör için yeni stateleri başlat
      setAssignedTargetVehiclePlate(job.assignedTargetVehiclePlate || '');
      setIsTargetVehicleExternal(job.isTargetVehicleExternal || false);
      setAssignedJobTime(job.assignedJobTime || job.time || '');

      let manual = [];
      if (job.teamNames && job.teamNames.length > 0) {
        const systemNames = personnelList.filter(p => job.assignedPersonnelIds?.includes(p.id)).map(p => p.fullName);
        manual = job.teamNames.filter(name => !systemNames.includes(name));
      }
      setManualExtraAssignees(manual);

      // Malzeme Tahmini Aktarımı ve Atama Listesi
      const est = job.assignedMaterials || calculateMaterials(job.fromRoomCount, job.fromPacking);
      setAssignedMaterials({
        strec: est.strec || 0,
        bant: est.bant || 0,
        poset: est.poset || 0,
        kagit: est.kagit || 0,
        koli: est.koli || 0
      });
      setCustomMaterials(job.customMaterials || []);
      setNewCustomMaterial({ name: '', amount: 1 });
      setShowBusyPersonnel(false); // Her açılışta sıfırla
      setTeamSuggestion(null); // Modalı açarken öneriyi sıfırla

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
        assignedPersonnelId: mainPerson.id, 
        assignedPersonnelIds: allAssignedIds, 
        teamNames: allNames, 
        team: allNames.join(', '), 
        assignedVehiclePlate: assignedVehiclePlate, 
        status: 'in-progress', 
        assignedDate: jobToAssign.assignedDate || new Date().toISOString().split('T')[0],
        assignedMaterials: assignedMaterials,
        customMaterials: customMaterials,
        notes: assignOperationNote, // Düzenlenmiş notu veritabanına kaydet
        assignedTargetVehiclePlate: jobToAssign.type === 'Asansör' ? assignedTargetVehiclePlate : null,
        isTargetVehicleExternal: jobToAssign.type === 'Asansör' ? isTargetVehicleExternal : null,
        assignedJobTime: jobToAssign.type === 'Asansör' ? assignedJobTime : null
      });
      
      const notifsCol = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
      const assignDateStr = new Date().toISOString().split('T')[0];
      for (const userId of allAssignedIds) {
        await addDoc(notifsCol, {
          userId: userId, title: 'Yeni Görev Ataması', message: `${jobToAssign.customerName} operasyonu için görevlendirildiniz.`, date: new Date().toLocaleString('tr-TR'), read: false,
          type: 'assignment', assignedDate: assignDateStr, jobDate: jobToAssign.date
        });
      }

      try {
        const jobDateObj = new Date(jobToAssign.date);
        const y = jobDateObj.getFullYear();
        const m = jobDateObj.getMonth() + 1;
        const d = jobDateObj.getDate();

        const mesaiRef = doc(db, 'artifacts', appId, 'public', 'data', 'mesai', `${y}_${m}`);
        const mesaiSnap = await getDoc(mesaiRef);
        let mesaiRecords = mesaiSnap.exists() ? mesaiSnap.data().records : {};

        let updated = false;
        allAssignedIds.forEach(pId => {
          const p = personnelList.find(pers => pers.id === pId);
          if (p && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))) {
            if (!mesaiRecords[pId]) mesaiRecords[pId] = {};
            const currentStatusObj = mesaiRecords[pId][d];
            const currentStatus = typeof currentStatusObj === 'object' && currentStatusObj !== null ? currentStatusObj.status : currentStatusObj;
            
            if (!currentStatus) {
              mesaiRecords[pId][d] = { status: 'G', hours: '' };
              updated = true;
            }
          }
        });

        if (updated) {
          await setDoc(mesaiRef, { records: mesaiRecords, updatedAt: new Date().toISOString() }, { merge: true });
        }
      } catch (err) {
        console.error("Otomatik mesai güncelleme hatası:", err);
      }
      
      setShowAssignModal(false); setJobToAssign(null); setAssigneeId(''); setAdditionalAssignees([]); setManualExtraAssignees([]); setAssignedVehiclePlate(''); setTeamSuggestion(null);
    };

    const handleAddManualAssignee = () => setManualExtraAssignees([...manualExtraAssignees, '']);
    const handleManualAssigneeChange = (index, value) => {
      const updated = [...manualExtraAssignees]; updated[index] = value; setManualExtraAssignees(updated);
    };
    const handleRemoveManualAssignee = (index) => setManualExtraAssignees(manualExtraAssignees.filter((_, i) => i !== index));

    const submitRemoveAssignment = async () => {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobToAssign.id), {
        assignedPersonnelId: null, 
        assignedPersonnelIds: [], 
        teamNames: [], 
        team: 'Atanmadı', 
        assignedVehiclePlate: '', 
        status: jobToAssign.status === 'completed' ? 'completed' : 'pending', 
        assignedDate: null,
        assignedMaterials: null,
        customMaterials: [],
        assignedTargetVehiclePlate: null,
        isTargetVehicleExternal: null,
        assignedJobTime: null
      });
      setShowAssignModal(false); setJobToAssign(null); setAssigneeId(''); setAdditionalAssignees([]); setManualExtraAssignees([]); setAssignedVehiclePlate(''); setTeamSuggestion(null);
    };

    const handleOpenEndJobModal = (job) => {
      setJobToEnd(job);
      setEndJobError('');
      setEndJobData({ 
        paymentMethod: 'Nakit', damageStatus: 'Hasarsız teslim edildi', damageDetails: '', damageImages: [], truckImages: [], truckStatus: 'Herhangi bir sorun yok', truckIssueDetails: '', customerSatisfaction: 'Herhangi bir işlem yapmadı.', enteredCode: '',
        elevatorSetup: 'Evet', elevatorSetupReason: '', elevatorImages: [], elevatorIssue: 'Hayır', elevatorIssueReason: '', vehicleIssue: 'Hayır', vehicleIssueReason: ''
      });
      setShowEndJobModal(true);
    };

    const handleFileUpload = async (e, type) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (type === 'truck') setEndJobData(prev => ({ ...prev, truckImages: [...(prev.truckImages || []), 'Yükleniyor...'] }));
      else if (type === 'elevator') setEndJobData(prev => ({ ...prev, elevatorImages: [...(prev.elevatorImages || []), 'Yükleniyor...'] }));
      else setEndJobData(prev => ({ ...prev, damageImages: [...(prev.damageImages || []), 'Yükleniyor...'] }));

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
        
        if (type === 'truck') {
          setEndJobData(prev => ({ ...prev, truckImages: prev.truckImages.map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        } else if (type === 'elevator') {
          setEndJobData(prev => ({ ...prev, elevatorImages: prev.elevatorImages.map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        } else {
          setEndJobData(prev => ({ ...prev, damageImages: prev.damageImages.map(img => img === 'Yükleniyor...' ? uploadedUrl : img) }));
        }
      } catch (err) {
        console.error("Yükleme hatası:", err);
        if (type === 'truck') {
          setEndJobData(prev => ({ ...prev, truckImages: prev.truckImages.map(img => img === 'Yükleniyor...' ? file.name : img) }));
        } else if (type === 'elevator') {
          setEndJobData(prev => ({ ...prev, elevatorImages: prev.elevatorImages.map(img => img === 'Yükleniyor...' ? file.name : img) }));
        } else {
          setEndJobData(prev => ({ ...prev, damageImages: prev.damageImages.map(img => img === 'Yükleniyor...' ? file.name : img) }));
        }
      }
    };

  const submitEndJob = async (e) => {
      e.preventDefault();
      if (!firebaseUser) return;
      
      if (jobToEnd.type !== 'Asansör') {
        // Güvenli eşleşme: Sadece alfanümerik karakterleri al ve büyük harfe çevir
        const userCode = (endJobData.enteredCode || '').toString().trim().toUpperCase();
        const realCode = (jobToEnd.deliveryCode || '').toString().trim().toUpperCase();

        // Hata Kontrolü:
        if (realCode && userCode !== realCode) {
          setEndJobError(`Girdiğiniz kod hatalı. Müşteriden "${realCode}" kodunu istemelisiniz.`); 
          return;
        }
      }

      setEndJobError('');

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

    const handleLogin = async (email, password, rememberMe) => {
      const normalizeStr = (str) => (str || '').toString().trim().toLocaleLowerCase('tr-TR');
      const loginInput = normalizeStr(email);
      
      const user = personnelList.find(p => {
        const pEmail = normalizeStr(p.email);
        const pName = normalizeStr(p.fullName);
        return (pEmail === loginInput || pName === loginInput) && String(p.password) === String(password);
      });

      if (user) {
        if (user.employmentStatus === 'Pasif') {
           setLoginError('Hesabınız pasife alınmıştır. Sisteme erişim yetkiniz bulunmuyor.');
           return;
        }

        setCurrentUser(user); setIsAuthenticated(true); setLoginError('');
        if (rememberMe) try { localStorage.setItem('sembol_crm_user', JSON.stringify({ email, password })); } catch (e) { }
        else try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}

        try {
          const nowStr = new Date().toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'personnelList', String(user.id)), {
            lastLogin: nowStr
          });
        } catch (err) { console.error("Son giriş tarihi güncellenemedi:", err); }
      } else setLoginError('Kullanıcı adı / E-posta veya şifre hatalı.');
    };

    const handleLogout = () => {
      setIsAuthenticated(false); setCurrentUser(null); setActiveTab('dashboard'); setIsSidebarOpen(false);
      try { localStorage.removeItem('sembol_crm_user'); } catch (e) {}
    };

    const allDataLoaded = Object.values(dataLoadStatus).every(v => v === true);

    if (isAuthChecking) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white animate-in fade-in">
          <img 
            src="sembol-nakliyat-logo-zeminsiz-09.jpg" 
            alt="Sembol Nakliyat" 
            className="w-auto h-24 object-contain mb-6 animate-pulse drop-shadow-2xl" 
            onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="w-20 h-20 bg-red-600 flex items-center justify-center rounded-2xl font-black text-white text-4xl shadow-lg mb-4 animate-pulse">S</div>'; }} 
          />
          <p className="font-bold tracking-widest text-neutral-400">SİSTEM YÜKLENİYOR...</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <LoginScreen onLogin={handleLogin} error={loginError} />;
    }

    if (currentUser?.employmentStatus === 'Pasif') {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 animate-in fade-in text-white">
          <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
          <h1 className="text-2xl font-black mb-2 text-center text-white">Hesabınız Pasife Alınmıştır</h1>
          <p className="text-neutral-400 text-center mb-6">Sisteme erişim yetkiniz sonlandırılmıştır. Lütfen yöneticinizle iletişime geçin.</p>
          <button onClick={handleLogout} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-600/30">Çıkış Yap</button>
        </div>
      );
    }

    if (!allDataLoaded) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white animate-in fade-in">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
          <p className="font-bold tracking-widest text-neutral-400">BULUT VERİLERİ EŞİTLENİYOR...</p>
        </div>
      );
    }

    const userPos = currentUser?.position || '';
    const isSales = userPos.includes('Satış');
    const isMuhasebe = userPos.includes('Muhasebe');
    const isDepo = userPos.includes('Depo Sorumlusu') || userPos.includes('Depo');
    const isManager = userPos.includes('Yönetici') || userPos.includes('Firma Sahibi') || currentUser?.rank === 'Müdür';
    const canEdit = currentUser?.permissions?.canEdit;

    const canApprovePoints = userPos.includes('Operasyon') || isManager || canEdit;

    // Geriye dönük uyumluluk (Legacy Fallback)
    const hasJobAccess = canEdit || isManager || isMuhasebe || isDepo;
    const hasResourceAccess = isManager || isMuhasebe || (canEdit && !isSales && !isDepo); // Personel, Araç, Malzeme
    const hasFinanceAccess = isManager || isMuhasebe || (canEdit && !isSales && !isDepo); // Finans
    const hasTaskAccess = isManager || (canEdit && !isSales && !isDepo && !isMuhasebe); // Görev Listesi
    const hasAdminAccess = isManager || (canEdit && !isSales && !isDepo && !isMuhasebe); // Yetkilendirme, Sistem
    
    const checkAccess = (key, fallback) => currentUser?.permissions?.modules?.[key] ?? fallback;

    const showDashboard = checkAccess('dashboard', true);
    const showCalendar = checkAccess('calendar', true);
    const showAddJob = checkAccess('addJob', hasJobAccess);
    const showJobList = checkAccess('jobList', hasJobAccess);
    const showTasks = checkAccess('tasks', hasTaskAccess);
    const showCustomers = checkAccess('customers', hasJobAccess);
    const showPersonnel = checkAccess('personnel', hasResourceAccess);
    const showVehicles = checkAccess('vehicles', hasResourceAccess);
    const showTodos = checkAccess('todos', hasTaskAccess);
    const showMaterials = checkAccess('materials', hasResourceAccess);
    const showFinance = checkAccess('finance', hasFinanceAccess);
    const showAuth = checkAccess('auth', hasAdminAccess);
    const showSystemFiles = checkAccess('systemFiles', hasAdminAccess);
    const showOperasyon = currentUser?.position?.includes('Operasyon') || currentUser?.rank === 'Müdür';
    
    const isMaviYakaUser = currentUser?.collarType === 'Mavi Yaka' || (!currentUser?.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(currentUser?.position));
    const isStandardBlueCollarApp = isMaviYakaUser && currentUser?.rank !== 'Ekip Şefi' && currentUser?.rank !== 'Kalfa' && currentUser?.rank !== 'Müdür' && currentUser?.position !== 'Firma Sahibi' && !currentUser?.permissions?.canEdit;
    
    const myTasksForBadge = tasks.filter(t => t.assignee === currentUser?.fullName || t.assignee === 'Tüm Personeller');
    const unreadTasksCount = myTasksForBadge.filter(t => t.status === 'todo').length;

    const todayStrApp = new Date().toISOString().split('T')[0];

    const unreadJobCount = jobs.filter(j => {
      const isMyJob = j.assignedPersonnelIds?.includes(currentUser?.id) || j.assignedPersonnelId === currentUser?.id;
      if (!isMyJob) return false;
      if (j.status !== 'pending' && j.status !== 'in-progress') return false;
      if (isStandardBlueCollarApp && j.date > todayStrApp) return false;
      return true;
    }).length;

    const visibleJobs = hasJobAccess ? jobs : jobs.filter(j => {
      const isMyJob = j.assignedPersonnelIds?.includes(currentUser?.id) || j.assignedPersonnelId === currentUser?.id;
      if (!isMyJob) return false;
      
      // Standart mavi yakalı personeller gelecekteki işleri göremez, Ekip Şefi ve Üzeri görür
      if (isStandardBlueCollarApp && j.date > todayStrApp) return false;

      // Personel için: İş tamamlanmışsa ve üzerinden 1 gün geçmişse gizle
      if (j.status === 'completed') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const jobDate = new Date(j.date);
        jobDate.setHours(0, 0, 0, 0);
        
        if (jobDate < today) {
          return false;
        }
      }
      return true;
    });
    
    const visibleNotifications = notifications.filter(n => {
      if (n.userId !== currentUser?.id) return false;
      // Görev atama bildirimiyse ve işin tarihi bugünden sonraysa (gelecekteyse), gizle! Sadece iş günü geldiğinde göster. (Ekip Şefi hariç)
      if (isStandardBlueCollarApp && n.type === 'assignment' && n.jobDate && n.jobDate > todayStrApp) {
        return false;
      }
      return true;
    });

    const unreadNotifCount = visibleNotifications.filter(n => !n.read).length;
    const totalUnreadCount = unreadNotifCount;

    return (
      <div className="flex h-screen bg-neutral-50 font-sans text-neutral-900 overflow-hidden">
        
        {/* Mobil Header & Menü Butonu */}
        <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-black text-white flex items-center justify-between px-4 z-30 shadow-md border-b border-red-600">
          <div className="flex items-center gap-2">
            <img 
              src="sembol-nakliyat-logo-zeminsiz-09.jpg" 
              alt="Sembol Nakliyat" 
              className="h-10 w-auto object-contain" 
              onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="flex items-center gap-2"><div class="w-8 h-8 bg-red-600 flex items-center justify-center rounded-lg font-black text-white">S</div><h1 class="font-bold text-lg">Sembol Nakliyat</h1></div>'; }} 
            />
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
          <div className="p-6 flex flex-col items-center gap-2 border-b border-neutral-800 text-center">
            <img 
              src="sembol-nakliyat-logo-zeminsiz-09.jpg" 
              alt="Sembol Nakliyat" 
              className="w-full max-w-[180px] object-contain mb-2" 
              onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<div class="flex items-center gap-4"><div class="shrink-0 w-16 h-16 flex items-center justify-center overflow-hidden rounded-full border-2 border-neutral-800/50 bg-red-600"><span class="font-black text-3xl text-white">S</span></div><div><h1 class="text-2xl font-black leading-tight text-white tracking-widest">SEMBOL</h1></div></div>'; }} 
            />
            <p className="text-red-600 text-[10px] font-bold mt-0.5 tracking-[0.2em] bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">OPERASYON MERKEZİ</p>
          </div>

          <div className="px-6 py-4 bg-neutral-900/50 border-b border-neutral-800 flex flex-col">
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2">Aktif Kullanıcı</span>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white font-bold overflow-hidden">
                    {currentUser?.profileImage ? (
                      <img src={currentUser.profileImage} alt={currentUser?.fullName} className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.fullName?.charAt(0)
                    )}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse absolute bottom-0 right-0 border-2 border-neutral-900"></div>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-white truncate">{currentUser?.fullName}</span>
                  <span className="text-[10px] text-neutral-400 truncate">{currentUser?.email}</span>
                </div>
              </div>
              <button 
                onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                className={`relative p-2 rounded-xl transition shrink-0 ${activeTab === 'notifications' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                title="Bildirimler"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-neutral-900"></span>
                )}
              </button>
            </div>
          </div>
          
          <nav className="flex flex-col mt-4 px-4 gap-2 overflow-y-auto flex-1 pb-6 custom-scrollbar">
            
            {showDashboard && (
              <button 
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <Calendar className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Anasayfa</span>
              </button>
            )}
            
            {showCalendar && (
              <button 
                onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                className={`w-full py-3 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'calendar' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
              >
                <CalendarDays className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Takvim</span>
              </button>
            )}

            <button 
              onClick={() => { setActiveTab('profileSettings'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
              className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'profileSettings' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Profilim</span>
              </div>
            </button>

            {isMaviYakaUser && (
                <button 
                  onClick={() => { setActiveTab('myAssignedJobs'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'myAssignedJobs' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Bana Atanan Görevler</span>
                  </div>
                  {unreadJobCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{unreadJobCount}</span>
                  )}
                </button>
            )}
            
            <button 
              onClick={() => { setActiveTab('mySpecialTasks'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
              className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${activeTab === 'mySpecialTasks' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
            >
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Özel Görevlerim</span>
              </div>
              {unreadTasksCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">{unreadTasksCount}</span>
              )}
            </button>

            {showOperasyon && (
              <div className="flex flex-col gap-1 mt-2 mb-2">
                <button 
                  onClick={() => { setIsOperasyonSubMenuOpen(!isOperasyonSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-black transition flex justify-between items-center rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-red-600/30 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 shrink-0 animate-pulse" /> <span className="whitespace-nowrap">Operasyon Bölümü</span>
                  </div>
                  {isOperasyonSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isOperasyonSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('ekipKurmaTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'ekipKurmaTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ekipKurmaTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Ekip Kurma Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('izinTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'izinTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'izinTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> İzin Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('personelTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personelTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personelTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Personel Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('puantajTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'puantajTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'puantajTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Puantaj Tahtası
                    </button>
                    <button 
                      onClick={() => { setActiveTab('maviMesaiTahtasi'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'maviMesaiTahtasi' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'maviMesaiTahtasi' ? 'bg-white' : 'bg-orange-500'}`}></div> Mavi Mesai Tahtası
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Görev Listesi */}
            {showTasks && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsTaskSubMenuOpen(!isTaskSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
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
            {showCustomers && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsCustomerSubMenuOpen(!isCustomerSubMenuOpen); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
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
            {showPersonnel && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsPersonnelSubMenuOpen(!isPersonnelSubMenuOpen); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addPersonnel' || activeTab === 'personnelList' || activeTab === 'ozlukDosyalari' || activeTab === 'complaints') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className={`w-5 h-5 shrink-0 ${(activeTab === 'addPersonnel' || activeTab === 'personnelList' || activeTab === 'ozlukDosyalari' || activeTab === 'complaints') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Personel Listesi</span>
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
                      onClick={() => { setActiveTab('ozlukDosyalari'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'ozlukDosyalari' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ozlukDosyalari' ? 'bg-white' : 'bg-red-600'}`}></div> Özlük Dosyaları
                    </button>
                    <button 
                      onClick={() => { setActiveTab('complaints'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'complaints' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'} relative`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'complaints' ? 'bg-white' : 'bg-red-600'}`}></div> 
                      Şikayet Bildirimleri
                      {complaints.filter(c => !c.read).length > 0 && (
                        <span className="absolute right-4 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{complaints.filter(c => !c.read).length}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Araç Listesi */}
            {showVehicles && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsVehicleSubMenuOpen(!isVehicleSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addVehicle' || activeTab === 'vehicleList' || activeTab === 'vehicleMaintenance') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Car className={`w-5 h-5 shrink-0 ${(activeTab === 'addVehicle' || activeTab === 'vehicleList' || activeTab === 'vehicleMaintenance') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Araç Listesi</span>
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
                    <button 
                      onClick={() => { setActiveTab('vehicleMaintenance'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'vehicleMaintenance' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'vehicleMaintenance' ? 'bg-white' : 'bg-red-600'}`}></div> Araç Rapor & Bakım
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Yapılacak Listesi */}
            {showTodos && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsTodoSubMenuOpen(!isTodoSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'addTodo' || activeTab === 'todoList') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <ListTodo className={`w-5 h-5 shrink-0 ${(activeTab === 'addTodo' || activeTab === 'todoList') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Yapılacak Listesi</span>
                  </div>
                  {isTodoSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isTodoSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('addTodo'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'addTodo' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'addTodo' ? 'bg-white' : 'bg-red-600'}`}></div> Yeni Ekle
                    </button>
                    <button 
                      onClick={() => { setActiveTab('todoList'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'todoList' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'todoList' ? 'bg-white' : 'bg-red-600'}`}></div> Takip ve Yapılacaklar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Malzeme Listesi */}
            {showMaterials && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsMaterialSubMenuOpen(!isMaterialSubMenuOpen); setIsVehicleSubMenuOpen(false); setIsTodoSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
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
            {showFinance && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsFinanceSubMenuOpen(!isFinanceSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'financeDashboard' || activeTab === 'reporting' || activeTab === 'personelMuhasebe') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className={`w-5 h-5 shrink-0 ${(activeTab === 'financeDashboard' || activeTab === 'reporting' || activeTab === 'personelMuhasebe') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Finans Yönetimi</span>
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
                    <button 
                      onClick={() => { setActiveTab('personelMuhasebe'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'personelMuhasebe' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'personelMuhasebe' ? 'bg-white' : 'bg-red-600'}`}></div> Personel Muhasebe
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Yetkilendirme */}
            {showAuth && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsAuthSubMenuOpen(!isAuthSubMenuOpen); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'userList' || activeTab === 'positions' || activeTab === 'ranks' || activeTab === 'permissions' || activeTab === 'moduleAccess') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Shield className={`w-5 h-5 shrink-0 ${(activeTab === 'userList' || activeTab === 'positions' || activeTab === 'ranks' || activeTab === 'permissions' || activeTab === 'moduleAccess') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Yetkilendirme</span>
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
                    <button 
                      onClick={() => { setActiveTab('moduleAccess'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'moduleAccess' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'moduleAccess' ? 'bg-white' : 'bg-red-600'}`}></div> Modül Görüntüleme
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sistem Dosyaları */}
            {showSystemFiles && (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setIsSystemFilesSubMenuOpen(!isSystemFilesSubMenuOpen); setIsAuthSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsFinanceSubMenuOpen(false); }}
                  className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl ${(activeTab === 'backupSystem' || activeTab === 'systemLogs' || activeTab === 'userActivities' || activeTab === 'companyPasswords') ? 'bg-neutral-900 text-white border border-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 shrink-0 ${(activeTab === 'backupSystem' || activeTab === 'systemLogs' || activeTab === 'userActivities' || activeTab === 'companyPasswords') ? 'text-red-500' : ''}`} /> <span className="whitespace-nowrap">Sistem Dosyaları</span>
                  </div>
                  {isSystemFilesSubMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {isSystemFilesSubMenuOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2">
                    <button 
                      onClick={() => { setActiveTab('backupSystem'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'backupSystem' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'backupSystem' ? 'bg-white' : 'bg-red-600'}`}></div> Yedekleme
                    </button>
                    <button 
                      onClick={() => { setActiveTab('systemLogs'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'systemLogs' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'systemLogs' ? 'bg-white' : 'bg-red-600'}`}></div> Hareket Geçmişi
                    </button>
                    <button 
                      onClick={() => { setActiveTab('userActivities'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'userActivities' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'userActivities' ? 'bg-white' : 'bg-red-600'}`}></div> Kullanıcı Hareketleri
                    </button>
                    <button 
                      onClick={() => { setActiveTab('companyPasswords'); setIsSidebarOpen(false); }}
                      className={`w-full py-2.5 px-4 text-sm font-bold transition flex justify-start items-center gap-3 rounded-xl ${activeTab === 'companyPasswords' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'companyPasswords' ? 'bg-white' : 'bg-red-600'}`}></div> Kurumsal Şifreler
                    </button>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => { setActiveTab('myComplaint'); setIsSidebarOpen(false); setIsSubMenuOpen(false); setIsVehicleSubMenuOpen(false); setIsMaterialSubMenuOpen(false); setIsPersonnelSubMenuOpen(false); setIsTaskSubMenuOpen(false); setIsCustomerSubMenuOpen(false); setIsJobSubMenuOpen(false); setIsAuthSubMenuOpen(false); setIsFinanceSubMenuOpen(false); setIsSystemFilesSubMenuOpen(false); setIsTodoSubMenuOpen(false); }}
              className={`w-full py-3 px-4 text-sm font-bold transition flex justify-between items-center rounded-xl mt-2 ${activeTab === 'myComplaint' ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" /> <span className="whitespace-nowrap">Şikayet Bildirim</span>
              </div>
            </button>

          </nav>

          {/* ŞİRKET İLETİŞİM HATTI */}
          <div className="px-4 pb-4">
            <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
               <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
                  <button onClick={() => setIsContactsOpen(!isContactsOpen)} className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:text-white transition flex-1 text-left">
                    <Phone className="w-3.5 h-3.5"/> Şirket İletişimi {isContactsOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </button>
                  {isManager && (
                    <button onClick={() => { setContactForm({ name: '', phone: '', position: '' }); setEditingContact(null); setShowContactModal(true); }} className="hover:text-white transition bg-emerald-800/50 hover:bg-emerald-700/50 p-1.5 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                      <PlusCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
               </div>
               
               {isContactsOpen && (
                 <div className="space-y-1 mt-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {companyContacts.map((c, index) => (
                       <div key={c.id} className="flex justify-between items-center group">
                          <a href={`tel:${c.phone}`} className="flex flex-col hover:bg-emerald-800/30 p-1.5 rounded transition w-full">
                             <span className="text-white text-xs font-bold truncate">{c.name}</span>
                             <span className="text-emerald-200/70 text-[9px] truncate mt-0.5">{c.position} - {c.phone}</span>
                          </a>
                          {isManager && (
                             <div className="flex items-center opacity-0 group-hover:opacity-100 transition shrink-0 gap-1 bg-emerald-900/50 p-1 rounded-lg">
                                <button disabled={index === 0} onClick={() => handleReorderContact(index, 'up')} className="text-neutral-400 hover:text-white disabled:opacity-30 p-0.5"><ChevronUp className="w-3 h-3"/></button>
                                <button disabled={index === companyContacts.length - 1} onClick={() => handleReorderContact(index, 'down')} className="text-neutral-400 hover:text-white disabled:opacity-30 p-0.5"><ChevronDown className="w-3 h-3"/></button>
                                <button onClick={() => { setEditingContact(c); setContactForm({name: c.name, phone: c.phone, position: c.position}); setShowContactModal(true); }} className="text-blue-400 hover:text-blue-300 p-0.5"><Edit className="w-3 h-3"/></button>
                                <button onClick={() => handleDeleteContact(c.id)} className="text-red-400 hover:text-red-300 p-0.5"><X className="w-3 h-3"/></button>
                             </div>
                          )}
                       </div>
                    ))}
                    {companyContacts.length === 0 && <p className="text-[10px] text-emerald-200/50 italic py-1 px-1.5">Kayıtlı numara yok.</p>}
                 </div>
               )}
            </div>
          </div>

          <div className="p-4 border-t border-neutral-800 space-y-2">
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
            {activeTab === 'dashboard' && showDashboard && <DashboardView jobs={visibleJobs} allJobs={jobs} personnelList={personnelList} vehicles={vehicles} materials={materials} systemLogs={systemLogs} currentUser={currentUser} setViewingImage={setViewingImage} transactions={transactions} />}
            {activeTab === 'notifications' && <NotificationsView notifications={visibleNotifications} markNotificationsAsRead={markNotificationsAsRead} currentUser={currentUser} />}
            {activeTab === 'calendar' && showCalendar && <CalendarView jobs={visibleJobs} handleEditJob={handleEditJob} currentUser={currentUser} handleOpenAssignModal={handleOpenAssignModal} />}
            {activeTab === 'profileSettings' && <ProfileSettingsView currentUser={currentUser} handleUpdatePersonnel={handleUpdatePersonnel} />}
            {activeTab === 'myAssignedJobs' && <MyAssignedJobsView currentUser={currentUser} jobs={visibleJobs} handleOpenEndJobModal={handleOpenEndJobModal} markNotificationsAsRead={markNotificationsAsRead} />}
            {activeTab === 'mySpecialTasks' && <MyTasksView currentUser={currentUser} tasks={tasks} handleUpdateTaskStatus={handleUpdateTaskStatus} />}
            
            {activeTab === 'ekipKurmaTahtasi' && showOperasyon && <EkipKurmaTahtasiView jobs={visibleJobs} personnelList={personnelList} vehicles={vehicles} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'izinTahtasi' && showOperasyon && <IzinTahtasiView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'personelTahtasi' && showOperasyon && <PersonelTahtasiView personnelList={personnelList} />}
            {activeTab === 'puantajTahtasi' && showOperasyon && <PuantajTahtasiView personnelList={personnelList} db={db} appId={appId} />}
            {activeTab === 'maviMesaiTahtasi' && showOperasyon && <MaviMesaiTahtasiView personnelList={personnelList} db={db} appId={appId} />}
            
            {activeTab === 'myComplaint' && <MyComplaintSubmitView currentUser={currentUser} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'addInfo' && showAddJob && (currentUser?.rank === 'Müdür' || currentUser?.position === 'Firma Sahibi' || currentUser?.permissions?.canEdit) && <AddInfoView currentUser={currentUser} personnelList={personnelList} addSystemLog={addSystemLog} />}
            
            {(activeTab === 'addNakliye' || activeTab === 'addDepo' || activeTab === 'addAsansor') && showAddJob &&
              <div className="space-y-4">
                {existingCustomerMatch && (
                  <div className="max-w-4xl mx-auto bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-bold">
                          {existingCustomerMatch.type === 'phone' 
                            ? 'Bu telefon numarasına ait bir müşteri kaydı bulundu.' 
                            : 'Bu isme ait bir müşteri kaydı bulundu.'}
                        </p>
                        <p className="text-xs mt-0.5">Sistemdeki İsim: <b>{existingCustomerMatch.name}</b> • Numara: <b>{existingCustomerMatch.phone}</b></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        customerName: existingCustomerMatch.name, 
                        customerPhone: existingCustomerMatch.phone 
                      }))}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
                    >
                      Bilgileri Eşleştir
                    </button>
                  </div>
                )}
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
              </div>
            }
            {activeTab === 'allCustomers' && showCustomers && (
              <div className="space-y-4">
                 {(currentUser?.rank === 'Müdür' || currentUser?.position === 'Firma Sahibi') && (
                    <div className="flex justify-end max-w-full mx-auto">
                      <button 
                        onClick={() => {
                          const relevantJobs = jobs;
                          const customersMap = new Map();
                          relevantJobs.forEach(job => {
                            if (!job.customerPhone) return;
                            const phoneKey = job.customerPhone.replace(/\s+/g, '');
                            if (!customersMap.has(phoneKey)) {
                              customersMap.set(phoneKey, {
                                  name: job.customerName, phone: job.customerPhone, type: job.customerType || 'Bireysel',
                                  jobCount: 1, totalRevenue: Number(job.price) || 0, lastJobDate: job.date
                              });
                            } else {
                              const c = customersMap.get(phoneKey);
                              c.jobCount += 1; c.totalRevenue += (Number(job.price) || 0);
                              if (new Date(job.date) > new Date(c.lastJobDate)) c.lastJobDate = job.date;
                            }
                          });
                          
                          const customers = Array.from(customersMap.values()).sort((a, b) => new Date(b.lastJobDate) - new Date(a.lastJobDate));
                          
                          const headers = ["MÜŞTERİ ADI", "TELEFON", "MÜŞTERİ TİPİ", "TOPLAM İŞLEM", "TOPLAM CİRO (TL)", "SON İŞLEM TARİHİ"];
                          let csvContent = "\uFEFF" + headers.join(";") + "\n"; // BOM for Excel UTF-8
                          
                          customers.forEach(c => {
                              const rowData = [
                                `"${c.name.replace(/"/g, '""')}"`,
                                `"${c.phone}"`, // Force text format
                                c.type,
                                c.jobCount,
                                c.totalRevenue,
                                c.lastJobDate
                              ];
                              csvContent += rowData.join(";") + "\n";
                          });
                          
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const link = document.createElement("a");
                          const url = URL.createObjectURL(blob);
                          link.setAttribute("href", url);
                          link.setAttribute("download", `Tum_Musteriler_${new Date().toLocaleDateString('tr-TR')}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition shadow-md text-sm"
                      >
                        <Download className="w-4 h-4" /> Müşteri Listesini Excel İndir
                      </button>
                    </div>
                 )}
                 <CustomerListView jobs={jobs} title="Tüm Müşteriler" handleEditJob={handleEditJob} />
              </div>
            )}
            {activeTab === 'specialCustomers' && showCustomers && <CustomerListView jobs={jobs} title="Özel Müşteriler" handleEditJob={handleEditJob} />}

            {/* İş Listesi Modülleri */}
            {activeTab === 'currentJobs' && showJobList && <CurrentJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} />}
            {activeTab === 'completedJobs' && showJobList && <CompletedJobsView jobs={jobs} handleEditJob={handleEditJob} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} setMarkDamageJobId={setMarkDamageJobId} canApprovePoints={canApprovePoints} handleOpenApproveModal={handleOpenApproveModal} handleOpenMesaiModal={handleOpenMesaiModal} />}
            {activeTab === 'allJobs' && showJobList && <AllJobsView jobs={jobs} handleEditJob={handleEditJob} handleOpenAssignModal={handleOpenAssignModal} handleGenerateMessage={handleGenerateMessage} handleEstimateMaterials={handleEstimateMaterials} setCancelJobId={setCancelJobId} setDeleteJobId={setDeleteJobId} />}
            {activeTab === 'damagedJobs' && showJobList && <DamagedJobsView jobs={jobs} handleEditJob={handleEditJob} setViewingImage={setViewingImage} setDeleteJobId={setDeleteJobId} handleOpenResolveDamageModal={handleOpenResolveDamageModal} />}
            {activeTab === 'cancelledJobs' && showJobList && <CancelledJobsView jobs={jobs} handleEditJob={handleEditJob} handleRestoreJob={handleRestoreJob} setDeleteJobId={setDeleteJobId} />}

            {activeTab === 'customerBlacklist' && showCustomers && <PlaceholderView title="Müşteri Kara Listesi" icon={AlertTriangle} />}
            
            {/* Personel ve Araç Modülleri */}
            {activeTab === 'addPersonnel' && showPersonnel && <AddPersonnelView onAdd={handleAddPersonnel} positions={positions} ranks={ranks} />}
            {activeTab === 'personnelList' && showPersonnel && <PersonnelListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} positions={positions} ranks={ranks} title="Tüm Personel" />}
            {activeTab === 'ozlukDosyalari' && showPersonnel && <OzlukDosyalariView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} setViewingImage={setViewingImage} />}
            {activeTab === 'complaints' && showPersonnel && <ComplaintsView complaints={complaints} updateComplaintStatus={handleUpdateComplaintStatus} deleteComplaint={handleDeleteComplaint} />}
            {activeTab === 'addVehicle' && showVehicles && <AddVehicleView onAdd={handleAddVehicle} />}
            {activeTab === 'vehicleList' && showVehicles && (
              <>
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
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingVehicle(vehicle);
                                    setVehicleEditForm(vehicle);
                                  }} 
                                  className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition" 
                                  title="Aracı Düzenle"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDeleteVehicle(vehicle.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition" title="Aracı Sil">
                                  <Ban className="w-5 h-5" />
                                </button>
                              </div>
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

                {/* Araç Düzenleme Modalı */}
                {editingVehicle && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                      <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Car className="w-5 h-5"/> Aracı Düzenle</h3>
                        <button onClick={() => setEditingVehicle(null)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
                      </div>
                      
                      <form onSubmit={(e) => { e.preventDefault(); handleUpdateVehicle(vehicleEditForm); }} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Plakası</label>
                            <input required type="text" value={vehicleEditForm.plate} onChange={(e) => setVehicleEditForm({...vehicleEditForm, plate: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition uppercase" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç Cinsi</label>
                            <select required value={vehicleEditForm.type} onChange={(e) => setVehicleEditForm({...vehicleEditForm, type: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                              <option value="Kamyon">Kamyon</option>
                              <option value="Kamyonet">Kamyonet</option>
                              <option value="Panelvan">Panelvan</option>
                              <option value="Minivan">Minivan</option>
                            </select>
                          </div>
                        </div>

                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                          <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-red-600" /> Araç Eşya Alma Kapasitesi
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['1+0', '1+1', '2+1', '3+1', '4+1'].map(cap => (
                              <label key={cap} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border text-sm transition-all ${vehicleEditForm.capacity?.includes(cap) ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100'}`}>
                                <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={vehicleEditForm.capacity?.includes(cap)} 
                                  onChange={() => {
                                    const newCap = vehicleEditForm.capacity?.includes(cap) 
                                      ? vehicleEditForm.capacity.filter(c => c !== cap) 
                                      : [...(vehicleEditForm.capacity || []), cap];
                                    setVehicleEditForm({...vehicleEditForm, capacity: newCap});
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
                            <input required type="number" value={vehicleEditForm.volume} onChange={(e) => setVehicleEditForm({...vehicleEditForm, volume: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Araç KM</label>
                            <input required type="number" value={vehicleEditForm.km} onChange={(e) => setVehicleEditForm({...vehicleEditForm, km: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Model (Yıl)</label>
                            <input required type="number" value={vehicleEditForm.model} onChange={(e) => setVehicleEditForm({...vehicleEditForm, model: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Renk</label>
                            <select required value={vehicleEditForm.color} onChange={(e) => setVehicleEditForm({...vehicleEditForm, color: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                              <option value="Beyaz">Beyaz</option>
                              <option value="Gri">Gri</option>
                              <option value="Siyah">Siyah</option>
                              <option value="Yeşil">Yeşil</option>
                              <option value="Kırmızı">Kırmızı</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-neutral-700 mb-1">Vites</label>
                            <select required value={vehicleEditForm.transmission} onChange={(e) => setVehicleEditForm({...vehicleEditForm, transmission: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition">
                              <option value="Manuel">Manuel</option>
                              <option value="Otomatik">Otomatik</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-neutral-100">
                          <button type="button" onClick={() => setEditingVehicle(null)} className="flex-1 py-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">İptal</button>
                          <button type="submit" className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/20">Değişiklikleri Kaydet</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}
            {activeTab === 'vehicleMaintenance' && showVehicles && <VehicleMaintenanceView vehicles={vehicles} onUpdateVehicle={handleUpdateVehicle} addSystemLog={addSystemLog} />}

            {/* Yapılacak Listesi Modülleri */}
            {activeTab === 'addTodo' && showTodos && <AddTodoView newTodo={newTodo} setNewTodo={setNewTodo} handleAddTodo={handleAddTodo} />}
            {activeTab === 'todoList' && showTodos && <TodoListView todos={todos} handleUpdateTodoStatus={handleUpdateTodoStatus} handleDeleteTodo={handleDeleteTodo} />}

            {/* Malzeme Modülleri */}
            {activeTab === 'addMaterial' && showMaterials && <AddMaterialView onAdd={handleAddMaterial} />}
            {activeTab === 'materialList' && showMaterials && <MaterialListView materials={materials} onDelete={handleDeleteMaterial} onUpdateStock={handleUpdateMaterialStock} />}
            
            {/* Finans Yönetimi Modülleri */}
            {activeTab === 'financeDashboard' && showFinance && <FinanceDashboardView jobs={jobs} transactions={transactions} transactionType={transactionType} setTransactionType={setTransactionType} newTransaction={newTransaction} setNewTransaction={setNewTransaction} handleAddTransaction={handleAddTransaction} />}
            {activeTab === 'reporting' && showFinance && <ReportingView jobs={jobs} personnelList={personnelList} />}
            {activeTab === 'personelMuhasebe' && showFinance && <PersonelMuhasebeView personnelList={personnelList} db={db} appId={appId} addSystemLog={addSystemLog} />}

            {activeTab === 'addTask' && showTasks &&
              <AddTaskFormView 
                newTask={newTask}
                setNewTask={setNewTask}
                handleAddTask={handleAddTask}
                personnelList={personnelList}
              />
            }
            {activeTab === 'taskList' && showTasks &&
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
            {activeTab === 'userList' && showAuth && <UserListView personnelList={personnelList} onUpdate={handleUpdatePersonnel} onDelete={handleDeletePersonnel} positions={positions} ranks={ranks} />}
            {activeTab === 'positions' && showAuth && <PositionsView positions={positions} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} />}
            {activeTab === 'ranks' && showAuth && <RanksView ranks={ranks} onAddRank={handleAddRank} onDeleteRank={handleDeleteRank} />}
            {activeTab === 'permissions' && showAuth && <PermissionsView personnelList={personnelList} handleUpdatePermissions={handleUpdatePermissions} />}
            {activeTab === 'moduleAccess' && showAuth && <ModuleAccessView personnelList={personnelList} handleUpdateModuleAccess={handleUpdateModuleAccess} currentUser={currentUser} />}
            
            {/* Sistem Dosyaları Modülü */}
            {activeTab === 'backupSystem' && showSystemFiles && <SystemFilesView jobs={jobs} personnelList={personnelList} vehicles={vehicles} materials={materials} db={db} appId={appId} addSystemLog={addSystemLog} />}
            {activeTab === 'systemLogs' && showSystemFiles && <SystemLogsView logs={systemLogs} />}
            {activeTab === 'userActivities' && showSystemFiles && <UserActivitiesView personnelList={personnelList} />}
            {activeTab === 'companyPasswords' && showSystemFiles && <CompanyPasswordsView passwords={companyPasswords} db={db} appId={appId} addSystemLog={addSystemLog} />}
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

        {/* KALICI SİLME ONAY MODALI */}
        {deleteJobId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95 shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Kalıcı Olarak Sil</h3>
              <p className="text-neutral-600 mb-6 text-sm font-medium">Bu operasyonu sistemden kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteJobId(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Vazgeç</button>
                <button onClick={() => { handleCompletelyDeleteJob(deleteJobId); setDeleteJobId(null); }} className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30">Evet, Tamamen Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* HASAR BİLDİRİMİ ONAY MODALI */}
        {markDamageJobId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in-95 shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="font-black text-xl text-black mb-2">Hasar Kaydı Oluştur</h3>
              <p className="text-neutral-600 mb-6 text-sm font-medium">Bu operasyonda hasar oluştuğunu onaylıyor musunuz? İşlem sonrası bu kayıt "Hasarlı İşler" sekmesinde görüntülenecektir.</p>
              <div className="flex gap-3">
                <button onClick={() => setMarkDamageJobId(null)} className="flex-1 p-3 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition">Hayır, Vazgeç</button>
                <button onClick={() => { handleMarkAsDamaged(markDamageJobId); setMarkDamageJobId(null); }} className="flex-1 p-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition shadow-lg shadow-orange-600/30">Evet, Onaylıyorum</button>
              </div>
            </div>
          </div>
        )}

        {/* İŞ ATAMA MODALI */}
        {showAssignModal && jobToAssign && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  Personele Görev Ata
                  <button 
                    type="button" 
                    onClick={() => setTeamSuggestion(teamSuggestion ? null : generateTeamSuggestion(jobToAssign))}
                    className="ml-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-sm hover:bg-red-500 transition shadow-sm font-black"
                    title="Sistem Tahmini Ekip Önerisi"
                  >
                    ?
                  </button>
                </h3>
                <button onClick={() => {setShowAssignModal(false); setTeamSuggestion(null);}} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {teamSuggestion && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-black text-indigo-900 flex items-center gap-2 mb-2 text-sm">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Tahmini Ekip Önerisi ({teamSuggestion.targetCount} Kişi)
                    </h4>
                    <ul className="text-[10px] text-indigo-800 font-medium list-disc pl-4 mb-3 space-y-0.5 leading-relaxed">
                      {teamSuggestion.notes.map((note, idx) => <li key={idx}>{note}</li>)}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {teamSuggestion.suggested.map((p, idx) => (
                         <div key={idx} className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-sm ${p.isExternal ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-white text-indigo-900 border-indigo-200'}`}>
                           <User className="w-3 h-3 opacity-70" />
                           {p.fullName} <span className="opacity-70 font-medium text-[9px]">({p.position})</span>
                         </div>
                      ))}
                    </div>
                  </div>
                )}
                <form onSubmit={submitAssignJob} className="space-y-5">
                  <p className="text-sm text-neutral-600 pb-2 border-b border-neutral-100">
                    <b className="text-black">Müşteri:</b> {jobToAssign.customerName} <br/>
                    <b className="text-black">Tarih:</b> {jobToAssign.date}
                  </p>

                  <div>
                    <label className="block text-sm font-bold text-black mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" /> Operasyon Notu
                    </label>
                    <textarea 
                      value={assignOperationNote} 
                      onChange={(e) => setAssignOperationNote(e.target.value)} 
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition resize-none h-20 text-sm font-medium bg-white" 
                      placeholder="Ekibe iletilecek operasyon notu ekleyin veya düzenleyin..." 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Asıl Görevli (Ekip Şefi / Sorumlu)</label>
                    <select required value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                      <option value="">Lütfen personel seçiniz...</option>
                      {jobToAssign.type === 'Asansör' ? (
                        personnelList.filter(p => p.position === 'Operatör').map(person => (
                          <option key={person.id} value={person.id}>{person.fullName} - {person.position} ({person.rank})</option>
                        ))
                      ) : (
                        personnelList.filter(p => p.rank === 'Ekip Şefi' || p.rank === 'Kalfa').map(person => (
                          <option key={person.id} value={person.id}>{person.fullName} - {person.position} ({person.rank})</option>
                        ))
                      )}
                    </select>
                  </div>

                  {assigneeId && jobToAssign.type === 'Asansör' && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-100 pt-4 mb-2 space-y-4">
                      {/* Hangi Araçla İşe Gidecek */}
                      <div>
                        <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-red-600" /> Hangi Araçla İşe Gidecek?
                        </label>
                        <select value={assignedVehiclePlate} onChange={(e) => setAssignedVehiclePlate(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                          <option value="">Araç Seçilmedi</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>
                          ))}
                        </select>
                      </div>

                      {/* Hangi Araca Asansör Kuracak */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-bold text-black flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-red-600" /> Hangi Araca Asansör Kuracak?
                          </label>
                          <button type="button" onClick={() => setIsTargetVehicleExternal(!isTargetVehicleExternal)} className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-1 rounded-lg border border-neutral-200 font-bold hover:bg-neutral-200 transition">
                            {isTargetVehicleExternal ? 'Sistemden Seç' : 'Sistem Dışı Araç'}
                          </button>
                        </div>
                        {isTargetVehicleExternal ? (
                          <input type="text" value={assignedTargetVehiclePlate} onChange={(e) => setAssignedTargetVehiclePlate(e.target.value)} placeholder="Örn: 34 ABC 123 (Dışarıdan Araç)" className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium text-sm" />
                        ) : (
                          <select value={assignedTargetVehiclePlate} onChange={(e) => setAssignedTargetVehiclePlate(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white transition font-medium">
                            <option value="">Araç Seçilmedi</option>
                            {vehicles.map(v => (
                              <option key={v.id} value={v.plate}>{v.plate} ({v.type})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Saat Kaçta İşe Gidecek */}
                      <div>
                        <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-600" /> Saat Kaçta İşe Gidecek?
                        </label>
                        <input type="time" value={assignedJobTime} onChange={(e) => setAssignedJobTime(e.target.value)} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none transition font-medium" />
                      </div>
                    </div>
                  )}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (() => {
                    const busyPersonnelIdsThisDay = jobs
                      .filter(j => j.date === jobToAssign.date && j.id !== jobToAssign.id && j.status !== 'cancelled')
                      .flatMap(j => j.assignedPersonnelIds || []);

                    const availablePersonnel = personnelList.filter(p => 
                      p.id !== parseInt(assigneeId) && 
                      ['Şoför', 'Mobilya Ustası', 'Taşıma Elemanı'].includes(p.position) &&
                      (showBusyPersonnel || !busyPersonnelIdsThisDay.includes(p.id))
                    );

                    return (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-bold text-black flex items-center gap-2">
                            <Users className="w-4 h-4 text-red-600" /> Beraber Gidecek Diğer Personeller
                          </label>
                          <button 
                            type="button" 
                            onClick={() => setShowBusyPersonnel(!showBusyPersonnel)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-bold border transition ${showBusyPersonnel ? 'bg-red-50 text-red-600 border-red-200' : 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}
                          >
                            {showBusyPersonnel ? 'Meşgulleri Gizle' : '+ İkinci İşi Ata'}
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-neutral-300 rounded-xl p-2 bg-white space-y-1 custom-scrollbar">
                          {availablePersonnel.map(person => {
                            const isBusy = busyPersonnelIdsThisDay.includes(person.id);
                            return (
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
                                <span className="text-sm font-medium text-black flex-1 flex items-center gap-2">
                                  {person.fullName} <span className="text-xs text-neutral-500">({person.position})</span>
                                  {isBusy && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 font-bold ml-auto">Başka İşi Var</span>}
                                </span>
                              </label>
                            );
                          })}
                          {availablePersonnel.length === 0 && (
                            <p className="text-xs text-neutral-500 p-2">Bu tarihte müsait durumda uygun pozisyonda (Şoför, Usta, Taşıma Elemanı) personel bulunmuyor.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (
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

                  {assigneeId && jobToAssign.type !== 'Asansör' && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-100 pt-4 mb-2">
                      <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4 text-red-600" /> Operasyon Malzemeleri (Tahmini ve Özel)
                      </label>
                      <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-3">
                        <p className="text-[11px] text-neutral-500 font-medium border-b border-neutral-200 pb-2">
                          Sistemin otomatik tahmin ettiği miktarları ayarlayabilir veya listeye yeni malzeme ekleyebilirsiniz.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {['strec', 'bant', 'poset', 'kagit', 'koli'].map(key => (
                            <div key={key} className="flex items-center justify-between bg-white border border-neutral-200 p-2 rounded-lg shadow-sm">
                              <span className="text-xs font-bold text-neutral-700 capitalize">
                                {key === 'strec' ? 'Streç' : key === 'kagit' ? 'Kağıt' : key}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button type="button" onClick={() => setAssignedMaterials(prev => ({...prev, [key]: Math.max(0, prev[key] - 0.5)}))} className="w-5 h-5 bg-red-50 text-red-600 rounded flex items-center justify-center font-bold hover:bg-red-100 transition">-</button>
                                <span className="text-xs font-black w-6 text-center">{assignedMaterials[key]}</span>
                                <button type="button" onClick={() => setAssignedMaterials(prev => ({...prev, [key]: prev[key] + 0.5}))} className="w-5 h-5 bg-green-50 text-green-600 rounded flex items-center justify-center font-bold hover:bg-green-100 transition">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-2 border-t border-neutral-200">
                          <label className="block text-[11px] font-bold text-neutral-600 mb-1.5">Sistem Harici Malzeme Ekle</label>
                          <div className="flex gap-2">
                            <input type="text" value={newCustomMaterial.name} onChange={e => setNewCustomMaterial({...newCustomMaterial, name: e.target.value})} placeholder="Örn: Askılı Koli" className="flex-1 p-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 text-xs font-medium bg-white" />
                            <input type="number" value={newCustomMaterial.amount} onChange={e => setNewCustomMaterial({...newCustomMaterial, amount: parseFloat(e.target.value) || 0})} className="w-16 p-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 text-xs text-center font-bold bg-white" min="0.5" step="0.5" />
                            <button type="button" onClick={() => {
                              if(newCustomMaterial.name.trim()) {
                                setCustomMaterials([...customMaterials, { id: Date.now(), name: newCustomMaterial.name, amount: newCustomMaterial.amount }]);
                                setNewCustomMaterial({ name: '', amount: 1 });
                              }
                            }} className="bg-neutral-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm">Ekle</button>
                          </div>
                          
                          {customMaterials.length > 0 && (
                            <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                              {customMaterials.map(cm => (
                                <div key={cm.id} className="flex items-center justify-between bg-white border border-neutral-200 p-2 rounded-lg shadow-sm">
                                  <span className="text-xs font-bold text-neutral-700">{cm.name} <span className="text-neutral-500">({cm.amount} Adet)</span></span>
                                  <button type="button" onClick={() => setCustomMaterials(customMaterials.filter(c => c.id !== cm.id))} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {assigneeId && jobToAssign.type !== 'Asansör' && (
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

        {/* GENEL YAPAY ZEKA MODALI (MESAJ / MALZEME TAHMİNİ / ÖZET) */}
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
              <div className="p-6 flex flex-col items-center w-full">
                <div className="w-full aspect-video bg-neutral-100 rounded-xl border border-neutral-300 flex flex-col items-center justify-center mb-4 overflow-hidden relative shadow-inner">
                  {viewingImage.name.startsWith('http') ? (
                    <img src={viewingImage.name} alt="Görsel" className="w-full h-full object-contain z-10" />
                  ) : (
                    <Camera className="w-16 h-16 text-neutral-300 z-10" />
                  )}
                </div>
                
                {viewingImage.name.startsWith('http') && (
                  <div className="w-full flex flex-col gap-2 mb-4">
                    <a href={viewingImage.name} target="_blank" rel="noreferrer" className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition flex justify-center items-center gap-2 border border-red-200">
                      <ArrowUpRight className="w-5 h-5" /> Görseli / Dosyayı Aç
                    </a>
                    <p className="text-[10px] text-neutral-400 text-center truncate px-2">
                      Link: {viewingImage.name}
                    </p>
                  </div>
                )}
                
                <button onClick={() => setViewingImage(null)} className="w-full py-4 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl transition shadow-lg mt-auto">Kapat</button>
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
                      <option value="Tüm Personeller">Tüm Personeller</option>
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
                      <option value="Tüm Personeller">Tüm Personeller</option>
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

        {/* İŞ SONLANDIRMA MODALI (TESLİM KODU ONAYI İLE) */}
        {showEndJobModal && jobToEnd && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-red-600 shrink-0">
                <h3 className="font-bold text-lg">Operasyonu Sonlandır</h3>
                <button onClick={() => setShowEndJobModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {endJobError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 mb-4">
                    <AlertTriangle className="w-5 h-5 shrink-0" /> {endJobError}
                  </div>
                )}
                <form onSubmit={submitEndJob} className="space-y-4">
                  {jobToEnd.type === 'Asansör' ? (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Ödeme Şekli</label>
                        <select value={endJobData.paymentMethod} onChange={e => setEndJobData({...endJobData, paymentMethod: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Nakit">Nakit</option>
                            <option value="Havale/EFT">Havale/EFT</option>
                            <option value="Ödeme Alınmadı">Ödeme Alınmadı</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Asansör Kuruldu mu?</label>
                        <select value={endJobData.elevatorSetup} onChange={e => setEndJobData({...endJobData, elevatorSetup: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Evet">Evet</option>
                            <option value="Hayır">Hayır</option>
                        </select>
                      </div>
                      {endJobData.elevatorSetup === 'Hayır' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="block text-sm font-bold text-red-600 mb-1">Asansör Kurulmama Nedeni *</label>
                          <textarea required value={endJobData.elevatorSetupReason} onChange={e => setEndJobData({...endJobData, elevatorSetupReason: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-2" placeholder="Neden kurulamadı?"></textarea>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Asansör Kurulum Fotoğrafı</label>
                        <div className="flex flex-col gap-2">
                          {(endJobData.elevatorImages || []).map((img, idx) => (
                            <div key={'eimg'+idx} className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                              <Camera className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="text-sm font-medium text-neutral-600 flex-1 truncate">{img}</span>
                              {img !== 'Yükleniyor...' && (
                                <button type="button" onClick={() => setEndJobData(prev => ({...prev, elevatorImages: prev.elevatorImages.filter((_, i) => i !== idx)}))} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><X className="w-4 h-4"/></button>
                              )}
                            </div>
                          ))}
                          <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2">
                            <PlusCircle className="w-5 h-5 text-neutral-500" />
                            <span className="text-sm font-bold text-neutral-600">Fotoğraf Ekle</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'elevator')} />
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Asansörde Sorun Var mı?</label>
                        <select value={endJobData.elevatorIssue} onChange={e => setEndJobData({...endJobData, elevatorIssue: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Hayır">Hayır</option>
                            <option value="Evet">Evet</option>
                        </select>
                      </div>
                      {endJobData.elevatorIssue === 'Evet' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="block text-sm font-bold text-red-600 mb-1">Asansör Sorunu Nedeni *</label>
                          <textarea required value={endJobData.elevatorIssueReason} onChange={e => setEndJobData({...endJobData, elevatorIssueReason: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-2" placeholder="Sorun nedir?"></textarea>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Araçta Sorun Var mı?</label>
                        <select value={endJobData.vehicleIssue} onChange={e => setEndJobData({...endJobData, vehicleIssue: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Hayır">Hayır</option>
                            <option value="Evet">Evet</option>
                        </select>
                      </div>
                      {endJobData.vehicleIssue === 'Evet' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="block text-sm font-bold text-red-600 mb-1">Araç Sorunu Nedeni *</label>
                          <textarea required value={endJobData.vehicleIssueReason} onChange={e => setEndJobData({...endJobData, vehicleIssueReason: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-2" placeholder="Araçtaki sorun nedir?"></textarea>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 mb-4 text-center">
                        <Key className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                        <label className="block text-sm font-bold text-emerald-900 mb-2">Müşteri Teslim Kodunu Giriniz *</label>
                        <input required type="text" value={endJobData.enteredCode || ''} onChange={e => setEndJobData({...endJobData, enteredCode: e.target.value.toUpperCase()})} className="w-full p-3 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none transition font-mono tracking-widest uppercase text-center text-xl font-black text-emerald-800 placeholder-emerald-300" placeholder="6 HANELİ KOD" />
                        <p className="text-[10px] text-emerald-700 mt-2 font-medium">İşi başarıyla sonlandırmak için müşteriden teslim kodunu isteyip yukarıdaki alana girin.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Ödeme Yöntemi</label>
                        <select value={endJobData.paymentMethod} onChange={e => setEndJobData({...endJobData, paymentMethod: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                          <option value="Nakit">Nakit</option>
                          <option value="Havale/EFT">Havale/EFT</option>
                          <option value="Kredi Kartı">Kredi Kartı</option>
                          <option value="Ödeme Yapmadı">Ödeme Yapmadı</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Müşteri Memnuniyeti</label>
                        <select value={endJobData.customerSatisfaction} onChange={e => setEndJobData({...endJobData, customerSatisfaction: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                          <option value="Yorum yazdı.">Yorum yazdı.</option>
                          <option value="Video alındı.">Video alındı.</option>
                          <option value="Şirketle İletişime Geçti.">Şirketle İletişime Geçti.</option>
                          <option value="Herhangi bir işlem yapmadı.">Herhangi bir işlem yapmadı.</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-black mb-1">Hasar Durumu</label>
                          <select value={endJobData.damageStatus} onChange={e => setEndJobData({...endJobData, damageStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Hasarsız teslim edildi">Hasarsız</option>
                            <option value="Hasar var">Hasar var</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-black mb-1">Kamyon Durumu</label>
                          <select value={endJobData.truckStatus} onChange={e => setEndJobData({...endJobData, truckStatus: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none bg-white font-medium">
                            <option value="Herhangi bir sorun yok">Sorun yok</option>
                            <option value="Sorun var">Sorun var</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Kamyon Kasası Fotoğrafı / Videosu (İş Sonu)</label>
                        <div className="flex flex-col gap-2">
                          {(endJobData.truckImages || []).map((img, idx) => (
                            <div key={'timg'+idx} className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                              <Camera className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="text-sm font-medium text-neutral-600 flex-1 truncate">{img}</span>
                              {img !== 'Yükleniyor...' && (
                                <button type="button" onClick={() => setEndJobData(prev => ({...prev, truckImages: prev.truckImages.filter((_, i) => i !== idx)}))} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><X className="w-4 h-4"/></button>
                              )}
                            </div>
                          ))}
                          <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2">
                            <PlusCircle className="w-5 h-5 text-neutral-500" />
                            <span className="text-sm font-bold text-neutral-600">Yeni Görsel Ekle</span>
                            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'truck')} />
                          </label>
                        </div>
                      </div>

                      {endJobData.damageStatus === 'Hasar var' && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                          <label className="block text-sm font-bold text-red-900 mb-1">Hasar Detayı (Müşteriye de iletilecek)</label>
                          <textarea required value={endJobData.damageDetails} onChange={e => setEndJobData({...endJobData, damageDetails: e.target.value})} className="w-full p-3 border border-red-300 rounded-xl outline-none resize-none h-16 text-sm mb-3" placeholder="Hasar hakkında detaylı bilgi..."></textarea>
                          
                          <label className="block text-sm font-bold text-red-900 mb-1 mt-2">Hasar Fotoğrafı</label>
                          <div className="flex flex-col gap-2 mb-3">
                            {(endJobData.damageImages || []).map((img, idx) => (
                              <div key={'dimg'+idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-red-200">
                                <Camera className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="text-sm font-medium text-red-600 flex-1 truncate">{img}</span>
                                {img !== 'Yükleniyor...' && (
                                  <button type="button" onClick={() => setEndJobData(prev => ({...prev, damageImages: prev.damageImages.filter((_, i) => i !== idx)}))} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"><X className="w-4 h-4"/></button>
                                )}
                              </div>
                            ))}
                            <label className="cursor-pointer bg-white hover:bg-neutral-50 border border-red-300 border-dashed rounded-xl p-3 text-center transition flex justify-center items-center gap-2">
                              <PlusCircle className="w-5 h-5 text-red-500" />
                              <span className="text-sm font-bold text-red-600">Yeni Hasar Fotoğrafı Ekle</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'damage')} />
                            </label>
                          </div>
                          
                          {endJobData.damageDetails.trim().length > 0 && (
                            <div className="flex flex-col sm:flex-row gap-2 animate-in fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                                  if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                                  else if (!phone.startsWith('90')) phone = '90' + phone;
                                  const msg = `Sayın *${jobToEnd.customerName}*,\n\nSembol Nakliyat olarak taşıma işleminizi tamamlamış bulunmaktayız. Ekibimiz tarafından teslimat sırasında aşağıdaki durum tutanak altına alınarak operasyon merkezimize raporlanmıştır:\n\n⚠️ *Hasar / Sorun Bildirimi:*\n_${endJobData.damageDetails}_\n\nMüşteri memnuniyeti bizim için en öncelikli konudur. Konuyla ilgili operasyon sorumlumuz en kısa sürede sizinle iletişime geçerek sürecin takibini sağlayacaktır.\n\nAnlayışınız için teşekkür ederiz.\n*Sembol Nakliyat Yönetimi*`;
                                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                                className="flex-1 px-3 py-2 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <MessageCircle className="w-4 h-4 shrink-0" /> Müşteriye Bildir (WA)
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                                  const msg = `Sayın ${jobToEnd.customerName},\nSembol Nakliyat olarak isinizi tamamladik. Ekibimiz tarafindan bir hasar durumu (${endJobData.damageDetails}) raporlanmistir. Operasyon sorumlumuz sizinle iletisime gececektir.`;
                                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                                  const separator = isIOS ? '&' : '?';
                                  window.open(`sms:${phone}${separator}body=${encodeURIComponent(msg)}`, '_self');
                                }}
                                className="flex-1 px-3 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <MessageSquareText className="w-4 h-4 shrink-0" /> Müşteriye Bildir (SMS)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {endJobData.truckStatus === 'Sorun var' && (
                        <div>
                          <label className="block text-sm font-bold text-black mb-1">Kamyon Sorunu Detayı</label>
                          <textarea required value={endJobData.truckIssueDetails} onChange={e => setEndJobData({...endJobData, truckIssueDetails: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl outline-none resize-none h-16 text-sm" placeholder="Araçtaki arıza/sorun..."></textarea>
                        </div>
                      )}
                    </>
                  )}

                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mt-4 mb-2">
                    <label className="block text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                      <Star className="w-4 h-4 text-blue-600 fill-blue-600" /> Müşteriden Değerlendirme (Google Yorum) İste
                    </label>
                    <p className="text-[10px] text-blue-700 mb-3 font-medium">İşi sonlandırmadan önce müşteriye otomatik Google değerlendirme linki gönderebilirsiniz.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                          if (phone.startsWith('0')) phone = '90' + phone.substring(1);
                          else if (!phone.startsWith('90')) phone = '90' + phone;
                          
                          let reviewLink = "https://g.page/r/CY7qIJg9osoKEBM/review";
                          let msgBody = `Sayın *${jobToEnd.customerName}*,\n\nSembol Nakliyat olarak taşıma işleminizi tamamlamış bulunmaktayız. Bizi tercih ettiğiniz için teşekkür ederiz.\n\nHizmetimizden memnun kaldıysanız, aşağıdaki linke tıklayarak Google üzerinden bize kısa bir yorum bırakırsanız çok seviniriz. Değerli yorumlarınız, ekibimiz ve firmamız için çok önemlidir.\n\n⭐ *Değerlendirme Linki:*\n${reviewLink}\n\nYeni adresinizde sağlık ve mutluluk dolu günler dileriz.\n*Sembol Nakliyat Yönetimi*`;
                          
                          if (jobToEnd.type === 'Depo') {
                              reviewLink = "https://g.page/r/Ce80w-lqdhRkEBM/review";
                              msgBody = `Sayın *${jobToEnd.customerName}*,\n\nSembol Nakliyat Depoevim olarak depolama işleminizi tamamlamış bulunmaktayız. Bizi tercih ettiğiniz için teşekkür ederiz.\n\nHizmetimizden memnun kaldıysanız, aşağıdaki linke tıklayarak Google üzerinden bize kısa bir yorum bırakırsanız çok seviniriz. Değerli yorumlarınız, ekibimiz ve firmamız için çok önemlidir.\n\n⭐ *Değerlendirme Linki:*\n${reviewLink}\n\nEşyalarınız güvende, iyi günler dileriz.\n*Sembol Nakliyat Depoevim Yönetimi*`;
                          }
                          
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgBody)}`, '_blank');
                        }}
                        className="flex-1 px-3 py-2 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" /> WhatsApp'tan İste
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          let phone = jobToEnd.customerPhone.replace(/\D/g, '');
                          
                          let reviewLink = "https://g.page/r/CY7qIJg9osoKEBM/review";
                          let msgBody = `Sayın ${jobToEnd.customerName},\nSembol Nakliyat olarak tasima isleminizi tamamladik. Bizi tercih ettiginiz icin tesekkur ederiz.\n\nHizmetimizden memnun kaldiysaniz asagidaki linkten bize kisa bir yorum birakabilirsiniz. Yorumlariniz bizim icin cok degerlidir.\n\nLink: ${reviewLink}\n\nYeni adresinizde mutluluklar dileriz.`;
                          
                          if (jobToEnd.type === 'Depo') {
                              reviewLink = "https://g.page/r/Ce80w-lqdhRkEBM/review";
                              msgBody = `Sayın ${jobToEnd.customerName},\nSembol Nakliyat Depoevim olarak depolama isleminizi tamamladik. Bizi tercih ettiginiz icin tesekkur ederiz.\n\nHizmetimizden memnun kaldiysaniz asagidaki linkten bize kisa bir yorum birakabilirsiniz. Yorumlariniz bizim icin cok degerlidir.\n\nLink: ${reviewLink}\n\nEsyalariniz guvende, iyi gunler dileriz.`;
                          }
                          
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                          const separator = isIOS ? '&' : '?';
                          window.open(`sms:${phone}${separator}body=${encodeURIComponent(msgBody)}`, '_self');
                        }}
                        className="flex-1 px-3 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageSquareText className="w-4 h-4 shrink-0" /> SMS ile İste
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <CheckCircle className="w-5 h-5" /> {jobToEnd.type === 'Asansör' ? 'Asansör İşini Sonlandır' : 'Kodu Doğrula ve İşi Bitir'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* PUAN ONAYLAMA VE YORUM EKLEME MODALI */}
        {showApproveModal && jobToApprove && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh]">
              <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-yellow-500 shrink-0">
                <h3 className="font-bold text-base flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Puan Onay Ekranı</h3>
                <button onClick={() => setShowApproveModal(false)} className="text-neutral-400 hover:text-white transition p-1"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                <form onSubmit={submitApprovePoints} className="space-y-4">
                  <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black text-black leading-tight">{jobToApprove.customerName}</p>
                      <p className="text-[10px] font-bold text-neutral-500 mt-0.5"><CalendarDays className="w-3 h-3 inline mr-0.5"/>{jobToApprove.date}</p>
                    </div>
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2 py-1 rounded border border-yellow-200">Onay Bekliyor</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sol Taraf: Puanlar */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1.5">Ekip Puan Girişi</label>
                          <div className="bg-white border border-neutral-200 rounded-lg p-1.5 space-y-1">
                            {(() => {
                              const teamIds = jobToApprove.assignedPersonnelIds ? [...jobToApprove.assignedPersonnelIds] : [];
                              if (jobToApprove.assignedPersonnelId && !teamIds.includes(jobToApprove.assignedPersonnelId)) {
                                teamIds.push(jobToApprove.assignedPersonnelId);
                              }
                              if (teamIds.length === 0) return <span className="text-[10px] text-neutral-500 italic px-2">Görevli personel bulunamadı.</span>;
                              
                              return teamIds.map(pId => {
                                const person = personnelList.find(p => p.id === pId);
                                return (
                                  <div key={pId} className="flex justify-between items-center bg-neutral-50 p-1.5 rounded-md border border-neutral-100">
                                    <span className="text-[11px] font-bold text-black flex items-center gap-1.5 truncate pr-2">
                                       <User className="w-3 h-3 text-neutral-400 shrink-0" />
                                       <span className="truncate">{person?.fullName || 'Bilinmeyen Personel'}</span>
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <input 
                                         type="number" 
                                         step="0.5" 
                                         min="0" 
                                         value={approveData.individualPoints[pId] !== undefined ? approveData.individualPoints[pId] : 1} 
                                         onChange={e => setApproveData({...approveData, individualPoints: {...approveData.individualPoints, [pId]: parseFloat(e.target.value) || 0}})} 
                                         className="w-12 h-6 border border-neutral-300 rounded text-center outline-none focus:ring-1 focus:ring-yellow-500 font-bold text-xs" 
                                      />
                                      <span className="text-[9px] font-bold text-neutral-500">Puan</span>
                                    </div>
                                  </div>
                                )
                              });
                            })()}
                          </div>
                        </div>

                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col max-h-36">
                          <label className="block text-[11px] font-bold text-blue-900 mb-1.5 flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-600" /> Ekstra Destek (0,5 Puan)
                          </label>
                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 bg-white p-1 rounded border border-blue-100">
                            {personnelList.filter(p => !jobToApprove.assignedPersonnelIds?.includes(p.id) && p.id !== jobToApprove.assignedPersonnelId && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))).map(p => (
                              <label key={p.id} className="flex items-center gap-1.5 p-1.5 hover:bg-neutral-50 rounded cursor-pointer transition">
                                <input type="checkbox" className="w-3.5 h-3.5 text-blue-600 rounded" checked={approveData.supportPersonnelIds?.includes(p.id)} onChange={(e) => {
                                    if(e.target.checked) setApproveData({...approveData, supportPersonnelIds: [...(approveData.supportPersonnelIds||[]), p.id]});
                                    else setApproveData({...approveData, supportPersonnelIds: (approveData.supportPersonnelIds||[]).filter(id => id !== p.id)});
                                }} />
                                <span className="text-[10px] font-medium text-black truncate">{p.fullName}</span>
                              </label>
                            ))}
                            {personnelList.filter(p => !jobToApprove.assignedPersonnelIds?.includes(p.id) && p.id !== jobToApprove.assignedPersonnelId && (p.collarType === 'Mavi Yaka' || (!p.collarType && ['Şoför', 'Taşıma Elemanı', 'Mobilya Ustası', 'Depo Sorumlusu', 'Temizlik Görevlisi'].includes(p.position)))).length === 0 && (
                                <span className="text-[9px] text-neutral-500 italic px-1">Seçilebilecek ekstra personel yok.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sağ Taraf: Resim */}
                      <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-black mb-1.5 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-neutral-500" /> Müşteri Yorumu Görseli
                        </label>
                        <div className="flex-1 flex flex-col">
                          {approveData.reviewImage && approveData.reviewImage !== 'Yükleniyor...' && (
                            <div className="flex-1 w-full min-h-[120px] overflow-hidden rounded-lg border border-neutral-200 relative group">
                              <img src={approveData.reviewImage} alt="Yorum" className="w-full h-full object-cover bg-neutral-100" />
                              <button type="button" onClick={() => setApproveData(prev => ({...prev, reviewImage: ''}))} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition shadow-md">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {approveData.reviewImage === 'Yükleniyor...' && (
                            <div className="flex-1 min-h-[120px] flex items-center justify-center font-bold text-[10px] text-neutral-500 animate-pulse bg-neutral-50 rounded-lg border border-neutral-200">
                              Görsel Yükleniyor...
                            </div>
                          )}
                          {!approveData.reviewImage && (
                            <label className="cursor-pointer bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 border-dashed rounded-lg flex-1 min-h-[120px] text-center transition flex flex-col justify-center items-center gap-1.5">
                              <Upload className="w-5 h-5 text-neutral-400" />
                              <span className="text-[10px] font-bold text-neutral-600">Yorum Görseli Ekle<br/><span className="font-medium opacity-70">(İsteğe Bağlı)</span></span>
                              <input type="file" accept="image/*" className="hidden" onChange={handleReviewImageUpload} />
                            </label>
                          )}
                        </div>
                      </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-yellow-500 text-black font-black text-sm rounded-xl hover:bg-yellow-600 transition flex justify-center items-center gap-2 shadow-md">
                    <CheckCircle className="w-4 h-4" /> Onayla ve Puanları İşle
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MESAİ ONAY MODALI */}
        {showMesaiModal && jobForMesai && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-blue-500 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Mesai / Devamsızlık Onayla</h3>
                <button onClick={() => setShowMesaiModal(false)} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar max-h-[80vh]">
                <form onSubmit={submitMesaiApprove} className="space-y-4">
                   <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 mb-4">
                      <p className="text-sm font-bold text-black mb-1">Müşteri: {jobForMesai.customerName}</p>
                      <p className="text-xs text-neutral-500">Tarih: {jobForMesai.date}</p>
                   </div>
                   
                   {Object.keys(mesaiModalData).length === 0 ? (
                      <p className="text-sm text-neutral-500 italic">Bu işe atanmış kayıtlı mavi yaka personel bulunmuyor.</p>
                   ) : (
                      <div className="space-y-3">
                         {Object.keys(mesaiModalData).map(pId => {
                            const person = personnelList.find(p => String(p.id) === String(pId));
                            const data = mesaiModalData[pId];
                            return (
                               <div key={pId} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-sm">
                                  <div className="flex-1 font-bold text-sm text-black flex items-center gap-2">
                                     <User className="w-4 h-4 text-neutral-400 shrink-0" />
                                     <span className="truncate">{person?.fullName || 'Bilinmeyen Personel'}</span>
                                  </div>
                                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                     <select 
                                        value={data.status} 
                                        onChange={e => setMesaiModalData(prev => ({ ...prev, [pId]: { ...prev[pId], status: e.target.value } }))}
                                        className="p-2 border border-neutral-300 rounded-lg outline-none text-sm font-bold bg-neutral-50 flex-1 focus:ring-2 focus:ring-blue-500"
                                     >
                                        {MESAI_STATUS_OPTIONS.map(opt => (
                                           <option key={opt.code} value={opt.code}>{opt.code} - {opt.label}</option>
                                        ))}
                                     </select>
                                     {(data.status === 'FM' || data.status === 'EM' || data.status === 'FGM') && (
                                        <input 
                                           type="number" 
                                           step="0.5"
                                           placeholder="Saat" 
                                           value={data.hours}
                                           onChange={e => setMesaiModalData(prev => ({ ...prev, [pId]: { ...prev[pId], hours: e.target.value } }))}
                                           className="w-16 p-2 border border-neutral-300 rounded-lg outline-none text-sm font-bold text-center"
                                        />
                                     )}
                                  </div>
                               </div>
                            )
                         })}
                      </div>
                   )}

                   <button type="submit" disabled={Object.keys(mesaiModalData).length === 0} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg mt-4 disabled:opacity-50">
                     <CheckCircle className="w-5 h-5" /> Mesaileri Kaydet
                   </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* HASAR ÇÖZÜM MODALI */}
        {resolveDamageModal.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-green-500 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Hasar Sorununu Çöz</h3>
                <button onClick={() => setResolveDamageModal({ isOpen: false, jobId: null, note: '' })} className="text-neutral-400 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleResolveDamageSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Çözüm Notu / Açıklama</label>
                    <textarea required value={resolveDamageModal.note} onChange={e => setResolveDamageModal({...resolveDamageModal, note: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none transition text-sm" placeholder="Sorun nasıl çözüldü? Müşteri ile nasıl anlaşıldı? (Örn: Tamir masrafı karşılandı.)"></textarea>
                  </div>
                  <button type="submit" className="w-full py-4 bg-green-500 text-white font-black rounded-xl hover:bg-green-600 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <CheckCircle className="w-5 h-5" /> Çözüldü Olarak Kaydet
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* İLETİŞİM NUMARASI EKLEME MODALI */}
        {showContactModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="bg-emerald-600 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Phone className="w-5 h-5" /> {editingContact ? 'İletişim Numarası Düzenle' : 'İletişim Numarası Ekle'}</h3>
                <button onClick={() => { setShowContactModal(false); setEditingContact(null); }} className="text-emerald-200 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleAddContact} className="space-y-4">
                  {!editingContact && (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-black mb-1">Personel Seçerek Doldur</label>
                        <select 
                          className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none bg-white font-medium"
                          onChange={(e) => {
                            const p = personnelList.find(x => String(x.id) === e.target.value);
                            if (p) {
                              setContactForm({ name: p.fullName, phone: p.personalPhone || p.companyPhone || '', position: p.position });
                            }
                          }}
                        >
                          <option value="">-- Personel Seçin --</option>
                          {personnelList.map(p => (
                            <option key={p.id} value={p.id}>{p.fullName} ({p.position})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="text-center text-xs font-bold text-neutral-400 py-1">VEYA MANUEL GİRİŞ YAPIN</div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">İsim Soyisim</label>
                    <input required type="text" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Telefon Numarası</label>
                    <input required type="text" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none" placeholder="Örn: 0555..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-black mb-1">Pozisyon / Unvan</label>
                    <input required type="text" value={contactForm.position} onChange={e => setContactForm({...contactForm, position: e.target.value})} className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none" placeholder="Örn: Operasyon Müdürü" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg mt-2">
                    <CheckCircle className="w-5 h-5" /> {editingContact ? 'Değişiklikleri Kaydet' : 'Kaydet ve Ekle'}
                  </button>
                </form>
              </div>
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
          .custom-scrollbar-table::-webkit-scrollbar {
            height: 16px;
            width: 16px;
          }
          .custom-scrollbar-table::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
          }
          .custom-scrollbar-table::-webkit-scrollbar-thumb {
            background-color: #ef4444;
            border-radius: 10px;
            border: 4px solid #f1f5f9;
          }
          .custom-scrollbar-table::-webkit-scrollbar-thumb:hover {
            background-color: #dc2626;
          }
        `}} />
      </div>
    );
  }