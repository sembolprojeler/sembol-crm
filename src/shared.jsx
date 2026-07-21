import React, { useState } from 'react';
import { FileText, CheckCircle, Camera, Upload, Copy, FolderOpen } from 'lucide-react';
  // --- FIREBASE BAĞLANTISI (CANLI / PRODUCTION MODU) ---
  // NOT: Önceki önizleme sürümünde burada bellek içi (in-memory) sahte bir
  // Firestore + Auth katmanı vardı. Canlıya alma kapsamında bu sahte katman
  // tamamen kaldırıldı ve yerine gerçek Firebase SDK bağlantısı eklendi.
  // Fonksiyon isimleri (collection, doc, addDoc, onSnapshot, query, where,
  // orderBy, limit vb.) birebir aynı kaldığı için aşağıdaki dosyanın geri
  // kalanında HİÇBİR SATIR değiştirilmesine gerek kalmadı.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, doc, query, orderBy, limit, where } from "firebase/firestore";
  // GERÇEK FIREBASE PROJE AYARLARI (sembol-operasyon-merkezi)
  // NOT: apiKey gizli bir sır değildir (Firebase güvenliği Firestore Security
  // Rules ve Auth ile sağlanır), bu yüzden client tarafında bulunması normaldir.
  // Vercel'de farklı bir ortam (staging/production) kullanmak isterseniz bu
  // değerleri Vercel Environment Variables (VITE_FIREBASE_... veya
  // NEXT_PUBLIC_FIREBASE_...) üzerinden okuyacak şekilde güncelleyebilirsiniz.
  const defaultFirebaseConfig = {
    apiKey: "AIzaSyD8ofu_2rZwJeHWftmr6STilgF_qjO3LVI",
    authDomain: "sembol-operasyon-merkezi.firebaseapp.com",
    projectId: "sembol-operasyon-merkezi",
    storageBucket: "sembol-operasyon-merkezi.firebasestorage.app",
    messagingSenderId: "1054049299174",
    appId: "1:1054049299174:web:2193f916a3501543d92927"
  };
  // YEREL VE BULUT ORTAMI UYUM KONTROLÜ (bazı çalıştırma ortamları
  // __firebase_config / __app_id global değişkenlerini enjekte edebilir)
  const firebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config ? JSON.parse(__firebase_config) : defaultFirebaseConfig;

  export const app = initializeApp(firebaseConfig);
  export const auth = getAuth(app);
  export const db = getFirestore(app);
  export const appId = typeof __app_id !== 'undefined' ? __app_id : 'sembol-crm-lokal';

  // --- YENİDEN EKLENDİ: TÜRKİYE İL/İLÇE, DEPO KONUMLARI, MESAİ DURUM KODLARI ---
    export const TURKEY_LOCATIONS = {
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
    export const PROVINCES = ["İstanbul (Anadolu)", "İstanbul (Avrupa)", ...baseProvinces];
    export const FLOORS = ['Bodrum Kat', 'Giriş Kat', 'Müstakil / Villa', ...Array.from({ length: 30 }, (_, i) => `${i + 1}. Kat`)];

    // DEPOEVİM TESİSLERİ
    export const DEPO_LOCATIONS = [
      { name: "Pendik Depoevim", province: "İstanbul (Anadolu)", district: "Pendik", address: "Bahçelievler Mah. Yeni Sk. No: 5/A" },
      { name: "Kartal Depoevim", province: "İstanbul (Anadolu)", district: "Kartal", address: "Yalı Mah. Bağlar Cad. No: 74/2" },
      { name: "Çekmeköy Depoevim", province: "İstanbul (Anadolu)", district: "Çekmeköy", address: "Ekşioğlu Mah. Atabey Cad. No: 28/2" },
      { name: "Ümraniye Depoevim", province: "İstanbul (Anadolu)", district: "Ümraniye", address: "Dudullu OSB Mah. 1. Cad. No: 30/4" }
    ];

    export const MESAI_STATUS_OPTIONS = [
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
      { code: 'Üİ', label: 'Ücretsiz İzin', color: 'bg-neutral-200 text-neutral-700 focus:bg-neutral-300' },
      { code: 'İB', label: 'İşi Bıraktı', color: 'bg-neutral-800 text-white focus:bg-neutral-900' }
    ];

    // --- GEMINI API CALLER ---
    export const callGeminiAPI = async (prompt, isJson = false) => {
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

    // --- PERSONEL GÖRÜNÜRLÜK KONTROLÜ (Mevcut ay / Gelecek ay pasiflik kontrolü) ---
    export const isPersonnelVisibleInMonth = (person, year, month) => {
      if (person.employmentStatus !== 'Pasif') return true;
      
      if (person.passiveDate) {
        const pd = new Date(person.passiveDate);
        const py = pd.getFullYear();
        const pm = pd.getMonth() + 1;
        
        if (year < py) return true;
        if (year === py && month <= pm) return true;
        return false;
      } else {
        // Önceden pasif yapılmış ve tarihi olmayan personeller için (Sadece mevcut aya kadar görünürler)
        const today = new Date();
        const currY = today.getFullYear();
        const currM = today.getMonth() + 1;
        
        if (year < currY) return true;
        if (year === currY && month <= currM) return true;
        
        return false;
      }
    };

  // --- YENİ: YÜKLENEN DOSYANIN VİDEO OLUP OLMADIĞINI ANLAMA ---
  export const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /\.(mp4|mov|webm|avi|3gp|mkv|m4v)(\?.*)?$/i.test(url);
  };

  // --- YENİ: CARİ PROFİL EŞLEŞTİRME YARDIMCI FONKSİYONLARI ---
  export const normalizeCariName = (name) => (name || '').toString().trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
  export const normalizeCariPhone = (phone) => (phone || '').toString().replace(/\D/g, '');

  export const CopyButton = ({ content }) => {
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

  // --- YENİ: FOTOĞRAF/VİDEO EKLEME MENÜSÜ (Şimdi Çek / Galeriden Yükle / Dosyadan) ---
  export const MediaCaptureMenu = ({ onChange, disabled, buttonLabel, buttonClassName, compact = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const cameraInputRef = React.useRef(null);
    const galleryInputRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    const handlePick = (ref) => {
      setIsOpen(false);
      ref.current?.click();
    };

    const defaultButtonClass = compact
      ? "px-4 py-2 bg-white border border-neutral-300 border-dashed rounded-lg flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition text-xs font-bold text-neutral-600"
      : "cursor-pointer w-full py-3 bg-neutral-50 border border-neutral-300 border-dashed rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-100 transition";

    return (
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(o => !o)}
          className={buttonClassName || defaultButtonClass}
        >
          <Upload className={compact ? "w-3.5 h-3.5 text-neutral-500" : "w-5 h-5 text-neutral-500"} />
          <span className={compact ? "" : "text-sm font-bold text-neutral-600"}>{buttonLabel || 'Fotoğraf / Video Ekle'}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <div className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-neutral-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
              <button type="button" onClick={() => handlePick(cameraInputRef)} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-black hover:bg-neutral-50 transition border-b border-neutral-100">
                <Camera className="w-4 h-4 text-red-600 shrink-0" /> Şimdi Çek
              </button>
              <button type="button" onClick={() => handlePick(galleryInputRef)} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-black hover:bg-neutral-50 transition border-b border-neutral-100">
                <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" /> Galeriden Yükle
              </button>
              <button type="button" onClick={() => handlePick(fileInputRef)} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-black hover:bg-neutral-50 transition">
                <FileText className="w-4 h-4 text-neutral-600 shrink-0" /> Dosyadan
              </button>
            </div>
          </>
        )}

        <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" disabled={disabled} onChange={(e) => { onChange(e); e.target.value = ''; }} />
        <input ref={galleryInputRef} type="file" accept="image/*,video/*" className="hidden" disabled={disabled} onChange={(e) => { onChange(e); e.target.value = ''; }} />
        <input ref={fileInputRef} type="file" accept="*/*" className="hidden" disabled={disabled} onChange={(e) => { onChange(e); e.target.value = ''; }} />
      </div>
    );
  };

  // 4857 Sayılı İş Kanunu Madde 17 uyarınca kıdeme göre ihbar (bildirim) süresini hesaplar.
  export const getIhbarSuresiBilgisi = (startDateStr, referenceDateStr) => {
    if (!startDateStr) return { hafta: 2, aciklama: 'Kıdem bilgisi sistemde bulunamadığından asgari süre (2 hafta) esas alınmıştır.' };
    const start = new Date(startDateStr);
    const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();
    const ay = Math.max(0, (ref - start) / (1000 * 60 * 60 * 24 * 30.44));
    if (ay < 6) return { hafta: 2, aciklama: '6 aydan az kıdemi bulunan işçi (4857 Sayılı İş Kanunu Madde 17/2-a)' };
    if (ay < 18) return { hafta: 4, aciklama: '6 ay ile 1,5 yıl arası kıdemi bulunan işçi (4857 Sayılı İş Kanunu Madde 17/2-b)' };
    if (ay < 36) return { hafta: 6, aciklama: '1,5 yıl ile 3 yıl arası kıdemi bulunan işçi (4857 Sayılı İş Kanunu Madde 17/2-c)' };
    return { hafta: 8, aciklama: '3 yıldan fazla kıdemi bulunan işçi (4857 Sayılı İş Kanunu Madde 17/2-d)' };
  };

  // --- YENİ: HAZIR TUTANAK ŞABLONLARI ---
  // Her şablon; kişi bilgilerine göre otomatik doldurulabilen alanları (Ad Soyad, TC No, Görev,
  // Tarih) otomatik doldurur; olay detayı, saat, şahitler ve imza gibi elle doldurulması/imzalanması
  // gereken kısımlar noktalı çizgi olarak bırakılır (fiziksel tutanak mantığına uygun).
  export const TUTANAK_TEMPLATES = [
    {
      key: 'devamsizlik',
      title: 'İşe Gelmeme (Devamsızlık) Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT MAZERETSİZ İŞE DEVAMSIZLIK TUTANAĞI</div>
        <table>
          <tr><td class="label">Tutanak Tarihi</td><td>${f.date || '..... / ..... / 202...'}</td><td class="label">Tutanak Saati</td><td>..... : .....</td></tr>
        </table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda kimlik bilgileri belirtilen şirketimiz personeli, <b>${f.date || '..... / ..... / 202...'}</b> tarihinde mesai başlangıç saati olan <b>..... : .....</b>'da işbaşı yapmamış ve gün boyu işyerine / operasyon sahasına gelmemiştir.
        </div>
        <div class="paragraph">
          Personel, işe gelmeyeceği ile ilgili şirket yönetimine herhangi bir yazılı/sözlü bilgi vermemiş, önceden izin almamış ve mazeretini belgeleyen resmi bir sağlık raporu sunmamıştır. İşbu tutanak, personelin izinsiz ve mazeretsiz olarak işe gelmediğini tespit etmek amacıyla, aşağıda isimleri bulunan şahitler huzurunda mahalinde düzenlenerek imza altına alınmıştır.
        </div>
        <table>
          <tr><td class="label">Tutanağı Düzenleyen (Yetkili/Amir)</td><td>Adı Soyadı: ...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit 1 (Çalışma Arkadaşı)</td><td>Adı Soyadı: ...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit 2 (Çalışma Arkadaşı)</td><td>Adı Soyadı: ...................................... &nbsp; İmza:</td></tr>
        </table>
        <p class="note">Not: İşçi orada olmadığı için devamsızlık tutanağında personelin imzası aranmaz.</p>
      `
    },
    {
      key: 'gec_kalma',
      title: 'İşe Geç Kalma Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT İŞE GEÇ KALMA TUTANAĞI</div>
        <table><tr><td class="label">Tutanak Tarihi</td><td>${f.date || '..... / ..... / 202...'}</td></tr></table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda bilgileri bulunan personelimiz, <b>${f.date || '..... / ..... / 202...'}</b> tarihinde başlaması gereken mesaisine / müşteri taşıma sahasına mazeretsiz ve izinsiz olarak geç kalmıştır.
        </div>
        <table>
          <tr><td class="label">Mesai/Operasyon Başlama Saati</td><td>..... : .....</td></tr>
          <tr><td class="label">Personelin İşe Geldiği Saat</td><td>..... : .....</td></tr>
          <tr><td class="label">Toplam Gecikme Süresi</td><td>....... Saat ....... Dakika</td></tr>
        </table>
        <div class="paragraph">
          Personelin işe geç gelmesi sebebiyle Sembol Nakliyat'ın operasyonel işleyişi ve günlük taşıma planlaması aksamıştır. İşbu tutanak şahitler huzurunda düzenlenmiş ve ilgili personele yüzüne karşı okunarak tebliğ edilmiştir.
        </div>
        <table>
          <tr><td class="label">Tutanağı Düzenleyen (Yetkili)</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
        <div class="section-title">PERSONELİN BEYANI VE İMZASI</div>
        <div class="desc-box">Geç Kalma Sebebi: .........................................................................................................................</div>
        <table><tr><td class="label">İlgili Personel İmza</td><td>......................................</td></tr></table>
      `
    },
    {
      key: 'erken_cikis',
      title: 'Mesai Bitiminden Önce Erken Çıkış Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT MESAİ BİTİMİNDEN ÖNCE ERKEN ÇIKIŞ TUTANAĞI</div>
        <table><tr><td class="label">Tutanak Tarihi</td><td>${f.date || '..... / ..... / 202...'}</td></tr></table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda bilgileri bulunan personelimiz, <b>${f.date || '..... / ..... / 202...'}</b> tarihinde tamamlaması gereken günlük mesai saatini doldurmadan, yetkili amirinden gerekli izni almaksızın işyerinden / operasyon sahasından erken ayrılmıştır.
        </div>
        <table>
          <tr><td class="label">Mesai/Operasyon Bitiş Saati</td><td>..... : .....</td></tr>
          <tr><td class="label">Personelin İşten Ayrıldığı Saat</td><td>..... : .....</td></tr>
          <tr><td class="label">Eksik Kalan Süre</td><td>....... Saat ....... Dakika</td></tr>
        </table>
        <div class="section-title">Erken Çıkış Sebebi ve Olayın Özeti</div>
        <p class="note">(Örnek: Personel mesai bitimine 2 saat kala haber vermeden sahadan ayrılmıştır / Devam eden operasyonu yarım bırakmıştır vb.)</p>
        <div class="desc-box" style="min-height:60px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <div class="paragraph">
          Personelin mesai saati dolmadan izinsiz ayrılması sebebiyle Sembol Nakliyat'ın operasyonel işleyişi ve günlük taşıma planlaması aksamıştır. Eksik çalışılan süre puantaj ve ücret hesabına yansıtılabilecektir. İşbu tutanak şahitler huzurunda düzenlenmiş ve ilgili personele yüzüne karşı okunarak tebliğ edilmiştir.
        </div>
        <table>
          <tr><td class="label">Tutanağı Düzenleyen (Yetkili)</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
        <div class="section-title">PERSONELİN BEYANI VE İMZASI</div>
        <div class="desc-box">Erken Çıkış Sebebi: .........................................................................................................................</div>
        <table><tr><td class="label">İlgili Personel İmza</td><td>......................................</td></tr></table>
      `
    },
    {
      key: 'sirketten_borc',
      title: 'Şirketten Borç Alma (Personel Borç) Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT PERSONEL BORÇ ALMA TUTANAĞI</div>
        <table><tr><td class="label">Tutanak Tarihi</td><td>${f.date || '..... / ..... / 202...'}</td></tr></table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || '...........................'}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda bilgileri bulunan personelimiz, kendi talebi doğrultusunda <b>${f.date || '..... / ..... / 202...'}</b> tarihinde Sembol Nakliyat'tan aşağıda belirtilen tutarda borç (avans niteliğinde) almış olup; işbu tutarın maaşından / hakedişinden mahsup edilerek tahsil edilmesini kabul ve beyan eder.
        </div>
        <table>
          <tr><td class="label">Alınan Borç Tutarı</td><td>................................. TL</td></tr>
          <tr><td class="label">Borç Alma Şekli</td><td>Nakit ( &nbsp; ) &nbsp;&nbsp; Banka / Havale ( &nbsp; )</td></tr>
          <tr><td class="label">Geri Ödeme / Mahsup Şekli</td><td>................................. (maaştan kesinti / taksit vb.)</td></tr>
          <tr><td class="label">Taksit Sayısı</td><td>............... ay</td></tr>
        </table>
        <div class="section-title">Borç Detayı ve Açıklama</div>
        <div class="desc-box" style="min-height:60px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <div class="paragraph">
          Personel, aldığı borç tutarının yukarıda belirtilen şekilde maaşından / hakedişinden kesileceğini; iş akdinin herhangi bir nedenle sona ermesi hâlinde kalan borç bakiyesinin son ödemesinden ve/veya kıdem-ihbar vb. yasal alacaklarından defaten mahsup edilmesini kabul, beyan ve taahhüt eder. İşbu tutanak iki nüsha olarak düzenlenmiş, taraflarca okunarak imza altına alınmıştır.
        </div>
        <table>
          <tr><td class="label">Şirket Yetkilisi</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
        <div class="section-title">PERSONELİN BEYANI VE İMZASI</div>
        <div class="desc-box">Yukarıda belirtilen tutarı Sembol Nakliyat'tan borç olarak aldım; maaşımdan / hakedişimden mahsup edilmesini kabul ediyorum.</div>
        <table><tr><td class="label">İlgili Personel İmza</td><td>......................................</td></tr></table>
      `
    },
    {
      key: 'operasyonel',
      title: 'İş Kurallarına (Operasyonel) Uymama Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT İŞ VE İŞ GÜVENLİĞİ KURALLARINA UYMAMA TUTANAĞI</div>
        <table>
          <tr><td class="label">Olay Tarihi / Saati</td><td>${f.date || '..... / ..... / 202...'} - ..... : .....</td></tr>
          <tr><td class="label">Olayın Gerçekleştiği Yer</td><td>................................................................................. (Depo, Araç içi, Müşteri Evi vb.)</td></tr>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda bilgileri bulunan personel, belirtilen tarih ve saatte görevini ifa ederken şirketimizin belirlemiş olduğu çalışma, işleyiş ve iş sağlığı güvenliği (İSG) kurallarına aykırı hareket etmiştir.
        </div>
        <div class="section-title">İhlal Edilen Kural ve Olayın Özeti</div>
        <p class="note">(Örnek: Personel, zorunlu olmasına rağmen çelik burunlu ayakkabısını giymemiştir / Müşteri eşyalarını ambalajsız ve dikkatsiz taşıyarak hasar riskine yol açmıştır vb.)</p>
        <div class="desc-box" style="min-height:60px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <div class="paragraph">
          İşbu tutanak, personelin iş sözleşmesinde ve şirket yönetmeliklerinde belirtilen yükümlülüklerine uymadığını kayıt altına almak üzere düzenlenmiş ve şahitler huzurunda imzalanmıştır.
        </div>
        <table>
          <tr><td class="label">Tutanağı Düzenleyen</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">İlgili Personel</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
      `
    },
    {
      key: 'disiplin',
      title: 'Disiplin ve Davranış Kurallarına Uymama Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT DİSİPLİN VE İYİ NİYET KURALLARINA AYKIRILIK TUTANAĞI</div>
        <table>
          <tr><td class="label">Olay Tarihi / Saati</td><td>${f.date || '..... / ..... / 202...'} - ..... : .....</td></tr>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda bilgileri bulunan personel, <b>${f.date || '..... / ..... / 202...'}</b> tarihinde çalışma saatleri içerisinde işyeri disiplinini, hiyerarşiyi ve çalışma huzurunu bozacak davranışlarda bulunmuştur.
        </div>
        <div class="section-title">Olayın Özeti (Ne Yaşandı?)</div>
        <p class="note">(Örnek: Personel, yöneticisi tarafından verilen yasal taşıma görevini "ben yapmam" diyerek reddetmiş, amirine karşı yüksek sesle ve saygısızca konuşmuştur / Müşteri sahasında kurumsal kimliğe yakışmayan hareketler sergilemiştir.)</p>
        <div class="desc-box" style="min-height:60px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <div class="paragraph">
          İş Kanunu ve Sembol Nakliyat şirket içi disiplin kuralları gereğince, personelin bu davranışı ahlak ve iyi niyet kurallarına aykırı olduğundan, işbu tutanak olayın hemen ardından şahitler huzurunda düzenlenmiştir.
        </div>
        <table>
          <tr><td class="label">Tutanağı Düzenleyen</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit 1</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit 2</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">İlgili Personel</td><td>......................................</td></tr>
        </table>
      `
    },
    {
      key: 'kavga',
      title: 'Personel Arası Kavga ve Tartışma Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT İŞYERİNDE KAVGA VE ÇALIŞMA BARIŞINI BOZMA TUTANAĞI</div>
        <p class="note">(İş Kanunu 25/2 maddesi gereği "işçinin başka bir işçiye sataşması" tazminatsız kovulma sebebidir. Mahkemede çok kritik olduğu için sadece gördüğünüz objektif gerçekleri yazınız.)</p>
        <table>
          <tr><td class="label">Olay Tarihi ve Saati</td><td>${f.date || '..... / ..... / 202...'} - ..... : .....</td></tr>
          <tr><td class="label">Olayın Gerçekleştiği Yer</td><td>.................................................................................</td></tr>
        </table>
        <div class="section-title">Olaya Karışan Personeller</div>
        <table>
          <tr><td class="label">1. Personel</td><td>${p.fullName || ''} (Görevi: ${p.position || ''})</td></tr>
          <tr><td class="label">2. Personel</td><td>.............................................................. (Görevi: .......................................)</td></tr>
        </table>
        <div class="section-title">Olayın Gelişimi ve Tespiti</div>
        <div class="paragraph">
          Yukarıda belirtilen tarih ve lokasyonda; şirketimiz personelleri olan şahıslar arasında işyeri huzurunu ve güvenliğini ağır şekilde tehlikeye atan bir olay yaşanmıştır. Şahıslar arasında önce sözlü tartışma başlamış, ardından olay büyüyerek karşılıklı hakaret/küfürleşme ve [ ] Fiziksel Arbede / Darp / Kavga (Varsa işaretleyiniz) boyutuna ulaşmıştır. Olayın detayları aşağıdadır:
        </div>
        <div class="desc-box" style="min-height:60px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <div class="paragraph">
          İşyerinde kesinlikle yasak olan bu durum, çalışma barışını derinden sarsmış ve nakliye operasyonunu durdurmuştur. Olay, diğer yöneticiler ve çalışanların araya girmesiyle sonlandırılmış olup; şahitlerin ifadeleri ve gözlemleri doğrultusunda işbu tutanak imza altına alınmıştır.
        </div>
        <table>
          <tr><td class="label">Olaya Müdahale Eden / Tutanağı Düzenleyen Amir</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Görgü Tanığı (Şahit 1)</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Görgü Tanığı (Şahit 2)</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
      `
    },
    {
      key: 'trafik_cezasi',
      title: 'Şoförler İçin Trafik Cezası Bildirim ve Kesinti Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT TRAFİK CEZASI BİLDİRİM VE RÜCU (KESİNTİ) TUTANAĞI</div>
        <table><tr><td class="label">Tutanak Tarihi</td><td>${f.date || '..... / ..... / 202...'}</td></tr></table>
        <div class="section-title">1. Şoför ve Araç Bilgileri</div>
        <table>
          <tr><td class="label">Şoförün Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Cezanın Kesildiği Araç Plakası</td><td>........ - ................... - ........</td></tr>
        </table>
        <div class="section-title">2. Trafik Cezası Bilgileri</div>
        <table>
          <tr><td class="label">Ceza Tarihi ve Saati</td><td>..... / ..... / 202... - ..... : .....</td></tr>
          <tr><td class="label">Ceza Tutanak / Makbuz No</td><td>................................................................</td></tr>
          <tr><td class="label">Trafik İhlalinin Nedeni</td><td>........................................................................ (Örn: Hız Sınırı İhlali, Kırmızı Işık, Seyir Halinde Telefon Kullanımı, Hatalı Park vb.)</td></tr>
          <tr><td class="label">Cezanın Toplam Tutarı</td><td>................................ TL</td></tr>
          <tr><td class="label">Cezanın İndirimli (Ödenecek) Tutarı</td><td>................................ TL</td></tr>
        </table>
        <table>
          <tr><td class="label">Tutanağı Düzenleyen (Yetkili)</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şoför (Bilgilendirildi)</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
      `
    },
    {
      key: 'maddi_hasar',
      title: 'Personel İçin Maddi Hasar Tespit Tutanağı',
      body: (p, f) => `
        <div class="main-title">SEMBOL NAKLİYAT MADDİ HASAR VE KUSUR TESPİT TUTANAĞI</div>
        <table>
          <tr><td class="label">Olay Tarihi ve Saati</td><td>${f.date || '..... / ..... / 202...'} - ..... : .....</td></tr>
          <tr><td class="label">Olayın Gerçekleştiği Yer</td><td>................................................................................. (Örn: Kadıköy Müşteri Evi, Merdiven Boşluğu, Kamyon İçi vb.)</td></tr>
        </table>
        <div class="section-title">1. Hasara Sebebiyet Veren Personel(ler)</div>
        <table>
          <tr><td class="label">1. Personel Adı Soyadı</td><td>${p.fullName || ''} — Görevi: ${p.position || ''}</td></tr>
          <tr><td class="label">(Varsa) 2. Personel Adı</td><td>.................................................... Görevi: ....................................</td></tr>
        </table>
        <div class="section-title">2. Hasar Gören Eşya / Araç Bilgisi</div>
        <table>
          <tr><td class="label">Kime Ait Olduğu</td><td>[ ] Müşteriye Ait &nbsp; [ ] Şirkete Ait &nbsp; [ ] Üçüncü Şahsa/Binaya Ait</td></tr>
          <tr><td class="label">Hasar Gören Eşya/Araç</td><td>............................................................................................. (Örn: Müşteriye ait Samsung 65" TV, Şirket aracının sağ aynası, Yemek masası ayağı vb.)</td></tr>
          <tr><td class="label">Tahmini Hasar Bedeli</td><td>................................ TL</td></tr>
        </table>
        <div class="section-title">3. Olayın Oluş Şekli ve Detayı (Nasıl Oldu?)</div>
        <div class="paragraph">Yukarıda belirtilen yer ve zamanda, nakliye / taşıma faaliyeti esnasında adı geçen personel(ler)in dikkatsizliği, tedbirsizliği, iş güvenliği/ambalaj kurallarına uymaması neticesinde aşağıdaki hasar meydana gelmiştir:</div>
        <div class="desc-box" style="min-height:50px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <p class="note">(Örn: Çamaşır makinesi merdivenden indirilirken ambalaj yapılmamış ve duvara çarpılarak kapağı kırılmıştır.)</p>
        <div class="section-title">4. Beyan ve Kesinti Kabulü (Muvafakatname)</div>
        <div class="paragraph">
          Yukarıda yeri, tarihi ve oluş şekli belirtilen hasar olayı; mesleki dikkat ve özen yükümlülüğüme aykırı davranmam ve tamamen şahsi ihmalim/kusurum neticesinde meydana gelmiştir. Müşterinin / şirketimizin mağduriyetini gidermek adına ödenecek tazminat bedelinin veya eşyanın faturalandırılacak tamir/yenileme masrafı olan tahmini ......................... TL tutarın maaşımdan, avansımdan veya doğacak hak edişlerimden kesilmesini kendi hür irademle kabul ve beyan ederim.
        </div>
        <table>
          <tr><td class="label">Görgü Tanığı (Şahit / Ekip Şefi)</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Tutanağı Düzenleyen Yetkili</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
        <p class="note">Hasara Sebep Olan Personel(ler): (Kendi el yazınız ile "Maddi hasar bedelinin maaşımdan kesilmesini kabul ediyorum" yazarak imzalayınız. İmzalamazsa yetkili kişi buraya "İmzadan İmtina Etti" yazıp şahitlere onaylatacaktır)</p>
        <div class="desc-box" style="min-height:40px;"></div>
        <table><tr><td class="label">Adı Soyadı</td><td>...................................... &nbsp; İmza:</td></tr></table>
      `
    },
    {
      key: 'ihbar_dilekcesi',
      title: 'İhbar Süreli Fesih Bildirimi (İhbar Dilekçesi)',
      body: (p, f) => {
        const baslangic = f.ihbarBaslangic || f.date || new Date().toISOString().split('T')[0];
        const ihbarInfo = getIhbarSuresiBilgisi(p.startDate, baslangic);
        const ihbarGun = ihbarInfo.hafta * 7;
        const bitis = new Date(baslangic);
        bitis.setDate(bitis.getDate() + ihbarGun);
        const baslangicStr = new Date(baslangic).toLocaleDateString('tr-TR');
        const bitisStr = bitis.toLocaleDateString('tr-TR');
        const iseBaslamaStr = p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : '..... / ..... / 202...';
        return `
        <div class="main-title">SEMBOL NAKLİYAT İHBAR SÜRELİ FESİH BİLDİRİMİ (İHBARNAME)</div>
        <table>
          <tr><td class="label">Bildirim Tarihi</td><td>${f.date || baslangicStr}</td></tr>
        </table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
          <tr><td class="label">İşe Başlama Tarihi</td><td>${iseBaslamaStr}</td></tr>
        </table>
        <div class="paragraph">
          Sayın <b>${p.fullName || ''}</b>,
        </div>
        <div class="paragraph">
          Şirketimiz bünyesinde <b>${iseBaslamaStr}</b> tarihinden bu yana <b>${p.position || ''}</b> pozisyonunda görev yapmaktasınız. 4857 Sayılı İş Kanunu'nun 17. maddesi hükümleri gereğince, iş sözleşmenizin İHBAR SÜRELİ olarak feshedilmesine karar verilmiştir.
        </div>
        <div class="section-title">Kıdem ve İhbar Süresi Tespiti</div>
        <table>
          <tr><td class="label">Kıdem Durumu</td><td>${ihbarInfo.aciklama}</td></tr>
          <tr><td class="label">Uygulanacak Yasal İhbar Süresi</td><td>${ihbarInfo.hafta} Hafta (${ihbarGun} Gün)</td></tr>
          <tr><td class="label">İhbar Süresinin Başlangıç Tarihi</td><td>${baslangicStr}</td></tr>
          <tr><td class="label">İhbar Süresinin Bitiş Tarihi</td><td><b>${bitisStr}</b></td></tr>
        </table>
        <div class="paragraph">
          Yukarıda belirtilen ${baslangicStr} - ${bitisStr} tarihleri arasındaki ihbar süresi zarfında iş sözleşmeniz aynı şartlarla devam edecek olup, İş Kanunu'nun 27. maddesi uyarınca yeni bir iş arama iznine ilişkin yasal haklarınız saklıdır. İhbar süresinin sonunda iş sözleşmeniz herhangi bir tazminat ödenmeksizin/ödenerek (duruma göre işaretleyiniz) sona erecektir:
        </div>
        <table>
          <tr><td class="label">Fesih Sebebi</td><td>[ ] İşveren Feshi &nbsp; [ ] İşçi İstifası &nbsp; [ ] Karşılıklı Anlaşma (İkale)</td></tr>
        </table>
        <div class="section-title">Fesih Gerekçesi / Açıklama</div>
        <div class="desc-box" style="min-height:50px;">${f.note ? f.note : '................................................................................................................................................................................<br/>................................................................................................................................................................................'}</div>
        <div class="paragraph">
          İşbu ihbarname iki nüsha olarak düzenlenmiş olup, bir nüshası tarafınıza tebliğ edilmek üzere elden teslim edilmiştir. Çalışma süreniz boyunca göstermiş olduğunuz emek ve katkılardan dolayı teşekkür eder, bundan sonraki hayatınızda başarılar dileriz.
        </div>
        <table>
          <tr><td class="label">Bildirimi Yapan (Yetkili / İşveren)</td><td>Adı Soyadı: ...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Şahit</td><td>Adı Soyadı: ...................................... &nbsp; İmza:</td></tr>
        </table>
        <div class="section-title">TEBLİĞ ALAN PERSONEL</div>
        <div class="paragraph">İşbu ihbarnameyi ${f.date || baslangicStr} tarihinde elden teslim aldım, okudum ve içeriğini anladım.</div>
        <table><tr><td class="label">Adı Soyadı / İmza</td><td>${p.fullName || ''} &nbsp;&nbsp;&nbsp; İmza: ......................................</td></tr></table>
        <p class="note">Not: Personel tebellüğden (belgeyi almaktan) imtina ederse, bu durum şahitler huzurunda ayrı bir tutanakla (İşe Gelmeme/Devamsızlık ya da noter kanalıyla) belgelenmelidir.</p>
      `;
      }
    },
    {
      key: 'ibraname',
      title: 'Sulh ve İbraname (İşten Ayrılış Belgesi)',
      body: (p, f) => {
        const birakmaTarihi = f.isiBirakmaTarihi || f.date || new Date().toISOString().split('T')[0];
        const birakmaStr = new Date(birakmaTarihi).toLocaleDateString('tr-TR');
        const baslamaStr = p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : '..... / ..... / 202...';
        return `
        <div class="main-title" style="text-decoration:underline;">SULH VE İBRANAME</div>
        <table><tr><td class="label">Düzenleme Tarihi</td><td>${birakmaStr}</td></tr></table>
        <div class="paragraph">
          BAHÇELİEVLER MAHALLESİ YENİ SK RAVZA APT NO: 5/C PENDİK / İSTANBUL adresinde kurulu SEMBOL NAKLİYAT DEPOCULUK TİC. LTD. ŞTİ.'nde çalışmaya başladığım tarih olan <b>${baslamaStr}</b> tarihinden, istifa ettiğim ve hizmet akdimin feshediliş tarihi olan <b>${birakmaStr}</b> tarihine kadar geçen çalışma sürem boyunca; iş sözleşmesi hükümlerinden doğan bütün hak ve alacaklarımı, normal ücretlerimi, çalışma süreme ilişkin alacaklarım dahil olmak üzere, 506 sayılı Sosyal Sigortalar Kanunu ve 4857 sayılı İş Kanunu ile 5510 sayılı Kanun ve sair mevzuattan doğan bilcümle haklarımın tamamını ve (varsa) senelik izin haklarımı işverenden noksansız bir şekilde tahsil ettim. Kendi rızam ile hiçbir baskı altında kalmadan işten ayrıldım. İşverenden başkaca hiçbir alacağım kalmamıştır.
        </div>
        <div class="paragraph">
          İş sözleşmemden ve kanuni haklarımdan dolayı hiçbir şekil ve surette alacağım kalmadığını, şirketle gayrikabili rücu ve bütün hukuki neticelerini kapsamak üzere tam ve kesin olarak sulh olduğumu ve işvereni tam olarak ibra ettiğimden, doğmuş ve doğacak yukarıda belirtmiş olduğum bütün alacak haklarımdan feragat ettiğimi beyan ederim. Bu ibraname iki nüsha olarak düzenlenmiş olup bir nüshası işçiye, bir nüshası da işverene verilmiştir.
        </div>
        ${f.note ? `<div class="section-title">Ek Açıklama</div><div class="desc-box">${f.note}</div>` : ''}
        <div class="paragraph">Yukarıdaki bilgiler, tarafımdan okunarak imza edilmiştir.</div>
        <div class="paragraph">Ödemeyi Alan Personel,</div>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
        </table>
        <table>
          <tr><td class="label">Personel İmza</td><td></td></tr>
        </table>
        <table>
          <tr><td class="label">İşveren İmza</td><td></td></tr>
        </table>
      `;
      }
    },
    {
      key: 'ucretli_izin',
      title: 'Ücretli (Yıllık) İzin Talep ve Onay Formu',
      body: (p, f) => {
        const baslangic = f.izinBaslangic || f.date || new Date().toISOString().split('T')[0];
        const bitis = f.izinBitis || baslangic;
        const baslangicStr = new Date(baslangic).toLocaleDateString('tr-TR');
        const bitisStr = new Date(bitis).toLocaleDateString('tr-TR');
        const gunSayisi = Math.max(1, Math.round((new Date(bitis) - new Date(baslangic)) / 86400000) + 1);
        const baslamaStr = p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : '..... / ..... / 202...';
        return `
        <div class="main-title">SEMBOL NAKLİYAT ÜCRETLİ (YILLIK) İZİN TALEP VE ONAY FORMU</div>
        <table><tr><td class="label">Form Düzenleme Tarihi</td><td>${f.date || baslangicStr}</td></tr></table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
          <tr><td class="label">İşe Başlama Tarihi</td><td>${baslamaStr}</td></tr>
        </table>
        <div class="section-title">İzin Talep Bilgileri</div>
        <table>
          <tr><td class="label">İzin Türü</td><td>Yıllık Ücretli İzin (4857 Sayılı İş Kanunu Madde 53-60)</td></tr>
          <tr><td class="label">İzin Başlangıç Tarihi</td><td><b>${baslangicStr}</b></td></tr>
          <tr><td class="label">İzin Bitiş Tarihi</td><td><b>${bitisStr}</b></td></tr>
          <tr><td class="label">Toplam İzin Süresi</td><td><b>${gunSayisi} Gün</b></td></tr>
          <tr><td class="label">İzin Dönüşü İşbaşı Tarihi</td><td>${new Date(new Date(bitis).getTime() + 86400000).toLocaleDateString('tr-TR')}</td></tr>
        </table>
        <div class="paragraph">
          Yukarıda belirtilen tarihler arasında yıllık ücretli iznimi kullanmak istediğimi beyan ederim. İzin süresi boyunca ücretimin eksiksiz olarak tarafıma ödeneceğini bildiğimi, izin dönüşünde belirtilen tarihte işbaşı yapacağımı taahhüt ederim.
        </div>
        ${f.note ? `<div class="section-title">Ek Açıklama / Not</div><div class="desc-box">${f.note}</div>` : ''}
        <div class="section-title">Talep Eden Personel</div>
        <table>
          <tr><td class="label">Adı Soyadı / İmza</td><td>${p.fullName || ''} &nbsp;&nbsp;&nbsp; İmza: ......................................</td></tr>
          <tr><td class="label">Tarih</td><td>${f.date || baslangicStr}</td></tr>
        </table>
        <div class="section-title">Onaylayan Yetkili</div>
        <table>
          <tr><td class="label">Adı Soyadı / İmza</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Onay Durumu</td><td>[ ] Onaylandı &nbsp; &nbsp; [ ] Reddedildi</td></tr>
        </table>
      `;
      }
    },
    {
      key: 'ucretsiz_izin',
      title: 'Ücretsiz İzin Talep ve Onay Formu',
      body: (p, f) => {
        const baslangic = f.izinBaslangic || f.date || new Date().toISOString().split('T')[0];
        const bitis = f.izinBitis || baslangic;
        const baslangicStr = new Date(baslangic).toLocaleDateString('tr-TR');
        const bitisStr = new Date(bitis).toLocaleDateString('tr-TR');
        const gunSayisi = Math.max(1, Math.round((new Date(bitis) - new Date(baslangic)) / 86400000) + 1);
        const baslamaStr = p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : '..... / ..... / 202...';
        return `
        <div class="main-title">SEMBOL NAKLİYAT ÜCRETSİZ İZİN TALEP VE ONAY FORMU</div>
        <table><tr><td class="label">Form Düzenleme Tarihi</td><td>${f.date || baslangicStr}</td></tr></table>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
          <tr><td class="label">İşe Başlama Tarihi</td><td>${baslamaStr}</td></tr>
        </table>
        <div class="section-title">İzin Talep Bilgileri</div>
        <table>
          <tr><td class="label">İzin Türü</td><td>Ücretsiz İzin</td></tr>
          <tr><td class="label">İzin Başlangıç Tarihi</td><td><b>${baslangicStr}</b></td></tr>
          <tr><td class="label">İzin Bitiş Tarihi</td><td><b>${bitisStr}</b></td></tr>
          <tr><td class="label">Toplam İzin Süresi</td><td><b>${gunSayisi} Gün</b></td></tr>
          <tr><td class="label">İzin Dönüşü İşbaşı Tarihi</td><td>${new Date(new Date(bitis).getTime() + 86400000).toLocaleDateString('tr-TR')}</td></tr>
        </table>
        <div class="section-title">Talep Gerekçesi</div>
        <div class="desc-box" style="min-height:40px;">${f.note ? f.note : '................................................................................................................................................................................'}</div>
        <div class="paragraph">
          Yukarıda belirtilen tarihler arasında ücretsiz izin kullanmak istediğimi beyan ederim. Bu süre zarfında herhangi bir ücret ödemesi yapılmayacağını, ücretsiz izinli olduğum günlerin yıllık ücretli izin hesabına dahil edilmeyeceğini ve iş sözleşmemin bu süre boyunca askıda kalacağını bildiğimi kabul eder, izin dönüşünde belirtilen tarihte işbaşı yapacağımı taahhüt ederim.
        </div>
        <div class="section-title">Talep Eden Personel</div>
        <table>
          <tr><td class="label">Adı Soyadı / İmza</td><td>${p.fullName || ''} &nbsp;&nbsp;&nbsp; İmza: ......................................</td></tr>
          <tr><td class="label">Tarih</td><td>${f.date || baslangicStr}</td></tr>
        </table>
        <div class="section-title">Onaylayan Yetkili</div>
        <table>
          <tr><td class="label">Adı Soyadı / İmza</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">Onay Durumu</td><td>[ ] Onaylandı &nbsp; &nbsp; [ ] Reddedildi</td></tr>
        </table>
      `;
      }
    },
    {
      key: 'istifa_dilekcesi',
      title: 'İstifa Dilekçesi',
      body: (p, f) => {
        const istifaTarihi = f.istifaTarihi || f.date || new Date().toISOString().split('T')[0];
        const istifaStr = new Date(istifaTarihi).toLocaleDateString('tr-TR');
        const baslamaStr = p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : '..... / ..... / 202...';
        return `
        <div class="main-title">İSTİFA DİLEKÇESİ</div>
        <table><tr><td class="label">Dilekçe Tarihi</td><td>${f.date || istifaStr}</td></tr></table>
        <div class="paragraph"><b>SEMBOL NAKLİYAT DEPOCULUK TİC. LTD. ŞTİ. YETKİLİSİ'NE,</b></div>
        <div class="paragraph">
          BAHÇELİEVLER MAHALLESİ YENİ SK RAVZA APT NO: 5/C PENDİK / İSTANBUL adresinde bulunan şirketinizde <b>${baslamaStr}</b> tarihinden bu yana <b>${p.position || ''}</b> pozisyonunda çalışmaktayım.
        </div>
        <div class="paragraph">
          Kendi isteğim ve özgür irademle, hiçbir baskı altında kalmadan iş akdimi sona erdirmek istiyorum. İstifamın <b>${istifaStr}</b> tarihi itibarıyla kabul edilmesini ve hesabımın buna göre kapatılmasını saygılarımla arz ederim.
        </div>
        ${f.note ? `<div class="section-title">İstifa Gerekçesi (Belirtilmek İstenirse)</div><div class="desc-box">${f.note}</div>` : ''}
        <div class="paragraph">
          İstifa tarihine kadar üzerimde bulunan görev ve sorumlulukları eksiksiz olarak yerine getireceğimi, şirkete ait zimmetimdeki tüm demirbaş, evrak ve malzemeleri eksiksiz teslim edeceğimi taahhüt ederim. Çalışma sürem boyunca göstermiş olduğunuz güven ve destek için teşekkür eder, şirketinize başarılar dilerim.
        </div>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Görevi</td><td>${p.position || ''}</td></tr>
        </table>
        <table>
          <tr><td class="label">Personel İmza</td><td>${p.fullName || ''} &nbsp;&nbsp;&nbsp; İmza: ......................................</td></tr>
        </table>
        <div class="section-title">TEBELLÜĞ EDEN YETKİLİ (İşveren)</div>
        <table>
          <tr><td class="label">Teslim Alınma Tarihi</td><td>${f.date || istifaStr}</td></tr>
          <tr><td class="label">Adı Soyadı / İmza</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
        <p class="note">Not: Bu dilekçe ile birlikte "Sulh ve İbraname" ve gerekiyorsa "Zimmet İade Tutanağı" ayrıca düzenlenmelidir.</p>
      `;
      }
    }
  ];

    export const calculateMaterials = (roomCount, packingType) => {
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
  export const generateContractPDF = (job) => {
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
          <img src="https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" />
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
          <img src="https://www.sembolevdeneve.com/sembol-nakliyat-logo.webp" class="logo-img" alt="Sembol Nakliyat" />
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