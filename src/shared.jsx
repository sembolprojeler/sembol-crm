import React, { useState } from 'react';
import { FileText, CheckCircle, Camera, Upload, Copy, FolderOpen, X } from 'lucide-react';
  // --- FIREBASE BAĞLANTISI (CANLI / PRODUCTION MODU) ---
  // NOT: Önceki önizleme sürümünde burada bellek içi (in-memory) sahte bir
  // Firestore + Auth katmanı vardı. Canlıya alma kapsamında bu sahte katman
  // tamamen kaldırıldı ve yerine gerçek Firebase SDK bağlantısı eklendi.
  // Fonksiyon isimleri (collection, doc, addDoc, onSnapshot, query, where,
  // orderBy, limit vb.) birebir aynı kaldığı için aşağıdaki dosyanın geri
  // kalanında HİÇBİR SATIR değiştirilmesine gerek kalmadı.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// DEĞİŞİKLİK: getDocs, updateDoc ve deleteDoc eklendi — defter kayıtlarını
// okuyup güncellemek ve geri alınan kalemleri silmek için gerekli.
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, onSnapshot, doc, query, orderBy, limit, where, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
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
  // ==========================================================================
  // KALICI YEREL ÖNBELLEK (IndexedDB)
  // AMAÇ: "Tüm geçmiş her zaman görünsün" isteğini, Firestore okuma faturasını
  // patlatmadan karşılamak. Önbellek açıkken geçmiş kayıtlar CİHAZA BİR KEZ
  // indirilir; sonraki açılışlarda aynı veri diskten okunur ve Firestore'dan
  // TEKRAR ÜCRETLİ OKUMA YAPILMAZ.
  // 'persistentMultipleTabManager' aynı tarayıcıda birden fazla sekme açıkken
  // önbelleğin bozulmasını engeller.
  // Eski tarayıcılarda (veya gizli sekmede) IndexedDB kullanılamazsa hata
  // vermemesi için normal başlatmaya geri dönülür.
  // ==========================================================================
  let _db;
  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (e) {
    console.warn('Kalıcı önbellek başlatılamadı, normal moda geçiliyor:', e);
    _db = getFirestore(app);
  }
  export const db = _db;
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
    // ==========================================================================
    // ÇALIŞMA ŞEKLİ: 'Özgün' (kadrolu) | 'Uzaktan' (dışarıdan / panel kullanıcısı)
    // UZAKTAN çalışanlar (avukat, danışman, firma sahibi vb.) yalnızca panele
    // erişir; maaş / puantaj / mesai / prim / yıllık izin süreçlerine HİÇ dahil
    // edilmezler. Tüm bu ekranlar isPersonnelVisibleInMonth'u kullandığı için
    // kontrolü tek noktadan yapmak yeterlidir.
    // ==========================================================================
    export const isUzaktanCalisan = (person) => person?.calismaSekli === 'Uzaktan';

    // ==========================================================================
    // HASAR ÇÖZÜM BELGELERİ — ORTAK GÖRÜNTÜLEME BİLEŞENİ
    // ==========================================================================
    // Hasar kapatılırken eklenen fotoğraf / PDF / dekont dosyalarını rozet
    // olarak listeler. Üç ekranda birden kullanılır (Hasar Tahtası, iş kartı,
    // müşteri profili) — tek bileşen olması sayesinde davranış her yerde aynı:
    //   • Görseller  -> uygulamanın mevcut görüntüleyicisinde açılır
    //     (setViewingImage verilmişse; verilmemişse yeni sekmede)
    //   • PDF/diğer  -> her zaman yeni sekmede açılır (görüntüleyici PDF basmaz)
    // files: [{ url, name }] — App.tsx hasar çözümünde bu biçimde kaydedilir.
    export const HasarCozumBelgeleri = ({ files, setViewingImage }) => {
      const liste = (files || []).filter(f => f && f.url && f.url !== 'Yükleniyor...');
      if (liste.length === 0) return null;
      const gorselMi = (u) => /\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(String(u));
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {liste.map((f, i) => {
            const gorsel = gorselMi(f.url);
            const ad = f.name || (gorsel ? `Fotoğraf ${i + 1}` : `Belge ${i + 1}`);
            return (
              <button key={i} type="button"
                onClick={(e) => {
                  e.stopPropagation(); // Kart tıklamasını tetiklemesin
                  if (gorsel && setViewingImage) setViewingImage({ title: `Çözüm Belgesi — ${ad}`, name: f.url });
                  else window.open(f.url, '_blank', 'noopener'); // PDF/belge yeni sekmede
                }}
                title={ad}
                className="text-[10px] font-black px-2 py-1 rounded-lg border transition flex items-center gap-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 max-w-[160px]">
                {gorsel ? <Camera className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                <span className="truncate">{ad}</span>
              </button>
            );
          })}
        </div>
      );
    };

    // ==========================================================================
    // GARANTİ BANKASI TOPLU MAAŞ/AVANS EXCEL ŞABLONU (base64)
    // ==========================================================================
    // Bu sabit, bankanın KABUL ETTİĞİ orijinal .xlsx dosyasının BİREBİR
    // kopyasıdır (fontlar, renkler, birleşik hücreler, açıklama balonları,
    // veri doğrulama kuralları, formüller dahil her şey içinde hazırdır).
    // "Banka Excel Formatında İndir" butonu bu şablonu açar, yalnızca kurum
    // bilgilerini ve personel satırlarını doldurur; böylece çıktı bankanın
    // beklediği formatla ASLA farklılaşamaz.
    // DİKKAT: Banka şablon değiştirirse, yeni kabul edilen dosyayı base64'e
    // çevirip yalnızca bu sabiti güncellemek yeterlidir.
    export const GARANTI_MAAS_SABLON_BASE64 = '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';


    // ==========================================================================
    // POZİSYON ADI NORMALİZASYONU (eski / hatalı yazılmış pozisyon adları)
    // ==========================================================================
    // SORUN: Bazı personel kartlarında, şirket pozisyon kataloğunda BULUNMAYAN
    // pozisyon adları kalmış (ör. "Satış Destek"). Bunlar eski kayıtlardan veya
    // elle yazımdan geliyor ve ekranlarda kataloğa uymayan gruplar oluşturuyor.
    //
    // ÇÖZÜM: Aşağıdaki eşleme, geçersiz/eski adı GEÇERLİ karşılığına çevirir.
    // Anahtar küçük harfe çevrilip boşlukları sadeleştirilerek karşılaştırılır,
    // böylece "satış destek", "Satis Destek", "SATIŞ  DESTEK" hepsi yakalanır.
    //
    // ÖNEMLİ: Bu yalnızca GÖRÜNTÜLEME katmanıdır; Firebase'deki personel kaydını
    // DEĞİŞTİRMEZ. Kalıcı düzeltme için İnsan Kaynakları > Personel Listesi'nden
    // ilgili personelin pozisyonunu güncellemek gerekir. Kayıt düzeltildiğinde
    // bu eşleme zararsız biçimde devre dışı kalır (artık eşleşme olmaz).
    //
    // Yeni bir hatalı ad çıkarsa buraya tek satır eklemek yeterlidir.
    export const POZISYON_ESKI_ADLAR = {
      'satis destek': 'Satış Personeli',        // Türkçe karaktersiz yazım
      'satış destek': 'Satış Personeli',        // Ekranda görülen hatalı ad
      'satis destegi': 'Satış Personeli',
      'satış desteği': 'Satış Personeli',
      'satis personeli': 'Satış Personeli',     // Türkçe karaktersiz yazım düzeltmesi
    };

    // Pozisyon adını normalize eder. Eşleme yoksa gelen değeri AYNEN döndürür,
    // yani kataloğa uyan pozisyonlara hiç dokunmaz.
    export const normalizePozisyon = (pozisyon) => {
      const ham = String(pozisyon || '').trim();
      if (!ham) return ham;
      // Karşılaştırma anahtarı: küçük harf (tr) + çoklu boşluklar teke indirilir
      const anahtar = ham.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
      return POZISYON_ESKI_ADLAR[anahtar] || ham;
    };

    // ==========================================================================
    // ÖZLÜK BELGE LİSTESİ NORMALİZASYONU
    // ==========================================================================
    // ozlukDosyalari içindeki bir belge türü ÜÇ farklı biçimde saklanmış olabilir:
    //   1) DİZİ   -> [{ url, name, date }, ...]   (güncel biçim, çoklu belge)
    //   2) METİN  -> "https://..."                (en eski biçim, tek belge)
    //   3) NESNE  -> { url, name, date }          (tutanak/rapor gibi tek belge)
    // Bu fonksiyon üçünü de tek bir diziye çevirir; hiçbir eski veri kaybolmaz.
    //
    // TAŞINDI: Bu yardımcı eskiden yalnızca OzlukDosyalariView içinde yerel olarak
    // tanımlıydı. Personel profilinden de (tutanak/rapor eklerken) gerekli olduğu
    // için buraya alındı; artık iki ekran AYNI mantığı kullanıyor.
    export const belgeListesiNormalize = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [{ url: val, name: null, date: null }];
      if (typeof val === 'object' && val.url) return [val];
      return [];
    };

    // ==========================================================================
    // DENEME MAAŞI VE DENEME SÜRESİ
    // ==========================================================================
    // Personel işe alınırken bir "deneme maaşı" ve "deneme süresi" (1-10 ay)
    // girilebilir. Deneme süresi dolana kadar bordroda deneme maaşı, dolduktan
    // sonra normal maaş (person.maas) kullanılır.
    //
    // ÖRNEK:
    //   İşe giriş : 15 Temmuz 2026
    //   Deneme    : 50.000 TL / 2 ay
    //   Normal    : 60.000 TL
    //   -> Temmuz  : 50.000 (1. deneme ayı)
    //      Ağustos : 50.000 (2. deneme ayı)
    //      Eylül   : 60.000 (normal maaşa geçer)
    //
    // AY SAYIMI: İŞE GİRİŞ AYI 1. AY SAYILIR. Ayın hangi gününde girildiği ay
    // sayımını DEĞİŞTİRMEZ - 1'inde de girse 30'unda da girse o ay 1. deneme ayıdır.
    //
    // GÜN ORANLAMASI: Giriş ayında personel ayın tamamını çalışmadıysa, ödenecek
    // tutar mevcut bordro mantığındaki `iseGirisGun` hesabıyla gün gün oranlanır
    // (Finans.jsx). Yani 10 Temmuz'da giren personel Temmuz ayında 22 gün
    // üzerinden DENEME maaşıyla hesaplanır: (50.000/30) x 22. Buradaki
    // fonksiyonlar yalnızca "hangi maaş ORANI geçerli" sorusunu yanıtlar,
    // gün oranlamasına karışmaz.
    // ==========================================================================

    // Personel formundaki deneme süresi seçim kutusunun seçenekleri
    export const DENEME_SURE_SECENEKLERI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Verilen yıl/ay personelin deneme süresi içinde mi?
    // ay: 1-12 arası (Ocak = 1) - Finans.jsx bu formatı kullanıyor.
    export const denemeAyiMi = (person, yil, ay) => {
      const sure = parseInt(person?.denemeSuresi) || 0;
      const denemeMaasi = parseFloat(person?.denemeMaasi) || 0;

      // Üç şart da gerekli: süre, deneme maaşı ve işe giriş tarihi.
      // ESKİ KAYITLARDA bu alanlar hiç bulunmaz; onlar için fonksiyon her zaman
      // false döner ve bordro davranışı eskisiyle BİREBİR aynı kalır.
      if (sure <= 0 || denemeMaasi <= 0 || !person?.startDate) return false;

      const giris = new Date(person.startDate + 'T00:00:00');
      if (isNaN(giris.getTime())) return false;

      // Giriş ayından kaç ay geçti? Giriş ayı = 0.
      // getMonth() 0 tabanlı olduğu için gelen "ay" değerinden 1 çıkarılır.
      const gecenAy = (yil - giris.getFullYear()) * 12 + ((ay - 1) - giris.getMonth());

      // gecenAy 0 -> giriş ayı (1. deneme ayı), sure-1 -> son deneme ayı.
      // Giriş tarihinden ÖNCEKİ aylar (gecenAy < 0) deneme sayılmaz.
      return gecenAy >= 0 && gecenAy < sure;
    };

    // O ay için geçerli maaş oranı. Bordroda person.maas yerine bu kullanılır.
    export const gecerliMaas = (person, yil, ay) =>
      denemeAyiMi(person, yil, ay)
        ? (parseFloat(person?.denemeMaasi) || 0)
        : (parseFloat(person?.maas) || 0);

    // Normal maaşa geçilen ilk ay - "Eylül 2026'dan itibaren" yazısı için.
    // Dönen değer: { yil, ay, etiket } veya deneme tanımlı değilse null.
    export const denemeBitisAyi = (person) => {
      const sure = parseInt(person?.denemeSuresi) || 0;
      if (sure <= 0 || !person?.startDate) return null;

      const giris = new Date(person.startDate + 'T00:00:00');
      if (isNaN(giris.getTime())) return null;

      const gecisTarihi = new Date(giris.getFullYear(), giris.getMonth() + sure, 1);
      const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

      return {
        yil: gecisTarihi.getFullYear(),
        ay: gecisTarihi.getMonth() + 1,
        etiket: `${aylar[gecisTarihi.getMonth()]} ${gecisTarihi.getFullYear()}`
      };
    };

    // Personel formunun altında gösterilen canlı özet cümlesi.
    // Ay sayımının giriş ayını kapsaması sezgisel olmadığı için, yönetici
    // kaydetmeden önce hangi ayda geçiş olacağını görebilsin diye eklendi.
    export const denemeOzetMetni = (person) => {
      const sure = parseInt(person?.denemeSuresi) || 0;
      const denemeMaasi = parseFloat(person?.denemeMaasi) || 0;
      const normalMaas = parseFloat(person?.maas) || 0;

      if (sure <= 0 || denemeMaasi <= 0) return '';
      if (!person?.startDate) return 'Deneme süresinin işlemesi için işe giriş tarihi girilmelidir.';

      const bitis = denemeBitisAyi(person);
      const tl = (n) => n.toLocaleString('tr-TR');

      return `${sure} ay boyunca ${tl(denemeMaasi)} TL, ${bitis.etiket} ayından itibaren ${tl(normalMaas)} TL üzerinden hesaplanır.`;
    };

    export const isPersonnelVisibleInMonth = (person, year, month) => {
      // UZAKTAN çalışanlar puantaj / mesai / maaş / prim tablolarında görünmez
      if (isUzaktanCalisan(person)) return false;
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
  // NOT: 'multiple' parametresi geriye dönük uyumludur (varsayılan false).
  // Var olan tüm çağrılar hiçbir değişiklik yapmadan aynı şekilde çalışmaya devam eder;
  // sadece multiple={true} verilen yerlerde galeri/dosya seçiminde birden fazla
  // dosya/fotoğraf aynı anda seçilebilir hale gelir.
  export const MediaCaptureMenu = ({ onChange, disabled, buttonLabel, buttonClassName, compact = false, multiple = false }) => {
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

        {/* YENİ: Seçenekler artık açılır kutu (dropdown) değil, EKRANIN ORTASINDA
            açılan bir pencere. Eskiden menü `absolute` konumluydu ve modal/kart
            taşma sınırında kırpıldığı için bazı ekranlarda hiç görünmüyordu. */}
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
            <div className="relative bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
                <span className="text-sm font-black text-black">Dosya Ekle</span>
                <button type="button" onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-black transition"><X className="w-5 h-5" /></button>
              </div>

              <button type="button" onClick={() => handlePick(cameraInputRef)} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-black hover:bg-neutral-50 transition border-b border-neutral-100 text-left">
                <Camera className="w-5 h-5 text-red-600 shrink-0" />
                <span className="flex-1">Şimdi Çek<span className="block text-[10px] font-bold text-neutral-400">Kamerayı aç (fotoğraf / video)</span></span>
              </button>
              <button type="button" onClick={() => handlePick(galleryInputRef)} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-black hover:bg-neutral-50 transition border-b border-neutral-100 text-left">
                <FolderOpen className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="flex-1">Galeriden Yükle<span className="block text-[10px] font-bold text-neutral-400">Fotoğraf ve video{multiple ? ' — birden fazla seçilebilir' : ''}</span></span>
              </button>
              <button type="button" onClick={() => handlePick(fileInputRef)} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-black hover:bg-neutral-50 transition text-left">
                <FileText className="w-5 h-5 text-neutral-600 shrink-0" />
                <span className="flex-1">Dosyadan<span className="block text-[10px] font-bold text-neutral-400">PDF, Word, Excel, JPEG{multiple ? ' — birden fazla seçilebilir' : ''}</span></span>
              </button>

              <div className="p-3 bg-neutral-50 border-t border-neutral-200">
                <button type="button" onClick={() => setIsOpen(false)} className="w-full py-2.5 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition text-sm">Vazgeç</button>
              </div>
            </div>
          </div>
        )}

        {/* Kamera çekimi doğası gereği tek seferde tek kare verir; 'multiple' burada zararsızdır. */}
        <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" disabled={disabled} onChange={(e) => { onChange(e); e.target.value = ''; }} />
        {/* Galeriden: fotoğraf ve video; 'multiple' ile tek seferde birden fazla seçilebilir. */}
        <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple={multiple} className="hidden" disabled={disabled} onChange={(e) => { onChange(e); e.target.value = ''; }} />
        {/* Dosyadan: PDF, Word, Excel, PowerPoint, metin, arşiv, görsel ve video dosyaları */}
        <input ref={fileInputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,.rar,.heic,.heif,image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple={multiple} className="hidden" disabled={disabled} onChange={(e) => { onChange(e); e.target.value = ''; }} />
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
    },
    {
      // ======================================================================
      // YENİ ŞABLON: Ücretsiz Saatlik İzin Dilekçesi
      // Kullanıcının gönderdiği Word dilekçesinden uyarlandı; şirket adı,
      // departman/unvan ve personel bilgileri sistemden OTOMATİK doldurulur.
      // Diğer şablonlarla aynı tablo/başlık düzenini kullanır.
      // ======================================================================
      key: 'ucretsiz_saatlik_izin',
      title: 'Ücretsiz Saatlik İzin Dilekçesi',
      body: (p, f) => `
        <div class="main-title">ÜCRETSİZ SAATLİK İZİN DİLEKÇESİ</div>
        <div class="paragraph" style="text-align:center; font-weight:bold; margin-bottom:14px;">
          SEMBOL NAKLİYAT DEPOCULUK TİC. LTD. ŞTİ. MÜDÜRLÜĞÜ'NE<br/>
          <span style="font-weight:normal; font-size:11px;">İNSAN KAYNAKLARI DEPARTMANI'NA</span>
        </div>
        <table>
          <tr><td class="label">Tarih</td><td>${f.date || '..... / ..... / 202...'}</td>
              <td class="label">Konu</td><td>Saatlik Ücretsiz İzin Talebi</td></tr>
        </table>

        <div class="section-title">1. Talep</div>
        <div class="paragraph">
          Şirketinizde <b>${p.position || '..............................'}</b> görevi ile
          <b>${p.collarType || '..............................'}</b> kadrosunda çalışmaktayım.
        </div>
        <div class="paragraph">
          Özel/şahsi mazeretim nedeniyle <b>${f.date || '..... / ..... / 202...'}</b> tarihinde
          saat <b>..... : .....</b> ile <b>..... : .....</b> arasında ücretsiz izinli sayılmayı talep ediyorum.
          Söz konusu saatler için şahsıma ücret tahakkuk ettirilmemesini ve bu sürenin puantajıma
          <b>Ücretsiz İzin (Üİ)</b> olarak işlenmesini kabul ederim.
        </div>
        ${f.note ? `<div class="section-title">2. Mazeret Açıklaması</div><div class="desc-box">${f.note}</div>` : ''}
        <div class="paragraph">Gereğini bilgilerinize arz ederim.</div>

        <div class="section-title">Personel Bilgileri</div>
        <table>
          <tr><td class="label">Adı Soyadı</td><td>${p.fullName || ''}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${p.tcNo || ''}</td></tr>
          <tr><td class="label">Görevi / Unvanı</td><td>${p.position || ''}</td></tr>
          <tr><td class="label">İşe Giriş Tarihi</td><td>${p.startDate || ''}</td></tr>
          <tr><td class="label">İmza</td><td style="height:38px;"></td></tr>
        </table>

        <div class="section-title">İşveren / Yönetici Onayı</div>
        <div class="paragraph">
          Yukarıda bilgileri bulunan personelin belirtilen tarih ve saatler arasında ücretsiz izin kullanması:
        </div>
        <div class="paragraph" style="font-weight:bold;">
          [ &nbsp; ] UYGUNDUR &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] UYGUN DEĞİLDİR
        </div>
        <table>
          <tr><td class="label">Onaylayan Yönetici (Adı Soyadı / Unvanı)</td><td>...................................... &nbsp; İmza:</td></tr>
          <tr><td class="label">İnsan Kaynakları</td><td>...................................... &nbsp; İmza:</td></tr>
        </table>
        <p class="note">Not: Onaylanan saatler, ilgili günün puantajına "Üİ – Ücretsiz İzin" olarak işlenir ve maaş hesabından düşülür. Bu dilekçenin imzalı bir örneği personelin özlük dosyasında saklanır.</p>
      `
    }
  ];

    // ==========================================================================
    // DEPO PATPATI ADEDİ (yalnızca DEPO işlerinde kullanılır)
    // Kural: oda sayısı + 1  ->  1+0:1 | 1+1:2 | 2+1:3 | 3+1:4 | 4+1:5 ...
    // Villa/Ofis gibi büyük mekânlarda aynı oran korunarak 7 adet öngörülür.
    // Parça eşya / tesis içi taşımalarda 1 adet yeterlidir.
    // ==========================================================================
    export const depoPatpatiAdedi = (roomCount) => {
      if (!roomCount) return 1;
      if (roomCount === 'Villa' || roomCount === 'Ofis') return 7;
      if (roomCount === 'Parça Eşya' || roomCount === 'Depoevim Tesisleri') return 1;
      // "3+1" gibi değerlerde oda + salon toplamı esas alınır:
      //   1+0 -> 1 | 1+1 -> 2 | 2+1 -> 3 | 3+1 -> 4 | 4+1 -> 5 ...
      const parcalar = String(roomCount).split('+');
      const oda = parseInt(parcalar[0], 10);
      const salon = parseInt(parcalar[1] ?? '0', 10);
      if (isNaN(oda)) return 1;
      return oda + (isNaN(salon) ? 0 : salon);
    };

    // jobType: 'Depo' ise sonuca depoPatpati eklenir (diğer iş tiplerinde eklenmez)
    export const calculateMaterials = (roomCount, packingType, jobType) => {
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

    // YALNIZCA DEPO İŞLERİ: depo patpatı ihtiyacı hesaba eklenir.
    // Nakliye/Asansör işlerinde bu kalem hiç oluşturulmaz.
    if (jobType === 'Depo') {
      est.depoPatpati = depoPatpatiAdedi(roomCount);
    }

    return est;
  };

  // --- SÖZLEŞME PDF OLUŞTURUCU ---
  // ==========================================================================
  // RESMİ AYARLARI — VERİ VE YARDIMCILAR
  // ==========================================================================
  // "Sistem Dosyaları > Resmi Ayarları" ekranı bu veriyi düzenler.
  // Yardımcılar burada (shared.jsx) tutulur çünkü hem sözleşme PDF'i
  // (generateContractPDF, aşağıda) hem WhatsApp mesajları (App.jsx ve
  // Operasyon.jsx) aynı kaynaktan okumalıdır. Ekranın kendisi App.jsx içinde,
  // kardeşi AppSettingsView'in yanında durur.
  //
  // FIRESTORE YOLU (mevcut appBranding deseniyle aynı):
  //   artifacts/{appId}/public/data/settings/resmiAyarlar
  // ==========================================================================

  // Aşağıdaki 29 madde, generateContractPDF içinde SABİT yazılı olan maddelerin
  // BİREBİR aynısıdır. Firestore'da kayıt yoksa bunlar kullanılır; böylece
  // panel ilk açılışta boş gelmez ve mevcut sözleşme davranışı korunur.
  export const VARSAYILAN_SOZLESME_GRUPLARI = [
    {
      id: 'grup_genel',
      baslik: 'HİZMET KAPSAMI VE OPERASYONEL ŞARTLAR',
      maddeler: [
        'Taşıma işlemi kapalı kasa nakliye aracı ile gerçekleştirilecek olup, aksi belirtmedikçe tek araç icin geçerlidir.',
        'Eşyaların ambalajlanması, mobilyaların de-montaj ve montaj işlemleri yüklenici firma sorumluluğundadır.',
        'Şehir içi nakliye hizmetinin, mücbir sebepler haricinde aynı iş günü içerisinde tamamlanması esastır.',
        'Para kasası, piyano ve özel yapım eşyalar gibi özel taşıma gerektiren yükler önceden bildirilmelidir; aksi halde ek ücret tahakkuk ettirilir.',
        'Sözleşme yapılan kişinin adreslerde bulunması süreci takip etmesi gerekmektedir.'
      ]
    },
    {
      id: 'grup_teknik',
      baslik: 'TEKNİK SINIRLANDIRMALAR VE İSTİSNALAR',
      maddeler: [
        'Avize, perde, ankastre ve duvarda takılı eşyaları sökülümü yapılır; ancak montaj işlemleri hizmet kapsamı dışındadır.',
        'Korniş, klima, aspiratör montajı, duvar montajı ve elektrik işleri firmanın sorumluluğunda değildir.',
        'Tesisatı hazır olmayan beyaz eşyaların bağlantısı teknik emniyet gerekçesiyle yapılmamaktadır.',
        'Klima sökülüm ve montajı hizmet kapsamında değildir.',
        'Toplama hizmeti alındığında yeni adreste kolileri açılıp dizme/yerleştirme hizmeti yoktur.'
      ]
    },
    {
      id: 'grup_erisim',
      baslik: 'NAKLİYE VE ERİŞİM KOŞULLARI',
      maddeler: [
        'Nakliye aracının yükleme ve boşaltma noktalarına yanaşma imkanı sağlanmalıdır. 30 metreyi aşan mesafelerde ek işçilik maliyeti oluşur.',
        'Apartman boşluğuna veya kapı ölçülerine sığmayan eşyaların taşınması firmanın sorumluluğu dışındadır.',
        'Kat farkı veya asansör kullanımı değişiklikleri durumunda fiyatlandırma güncellenebilir.',
        'Toplama hizmeti alınmadığında küçük eşyaların kolileri taşımaya hazır halde bulunmalıdır.'
      ]
    },
    {
      id: 'grup_hasar',
      baslik: 'HASAR, SİGORTA VE SORUMLULUK',
      maddeler: [
        'Taşınan emtia, nakliye esnasında oluşabilecek risklere karşı Emtia Sigortası güvencesindedir.',
        "Olası personel hasarında firma, nakliye bedelinin %10'una kadar doğrudan tazmin sorumluluğunu kabul eder.",
        'Hasar gören eşyalar için firma imkanlar doğrultusunda teknik tamir destek sağlanmaktadır.',
        'Fabrika kutusu olmayan elektronik cihazlar, ziynet eşyası, nakit para ve yanıcı/akıcı maddeler sorumluluk dışındadır.',
        'Hasar ve eksik bildirimlerinin teslimat anında yapılması zorunludur; adres terk edildikten sonraki talepler için sorumluluk alınmaz.'
      ]
    },
    {
      id: 'grup_odeme',
      baslik: 'ÖDEME, İPTAL VE DEPOLAMA HÜKÜMLERİ',
      maddeler: [
        "Hizmet bedelinin %20'si kapora olarak alınır; kalan bakiye teslim edilecek adreste tahsil edilir.",
        'Anlaşılan nakliye fiyatına KDV dahil değildir.',
        'Şehirler arası taşımalarda eşya araca yüklendikten sonra %50 ödemeye tamamlanmaktadır.',
        "Taşıma gününe 72 saatten az süre kala yapılan iptal ve değişikliklerde toplam bedelin %50'si cayma tazminatı olarak fatura edilir.",
        'Depolama hizmetinde belirtilen fiyat sadece depoya giriş nakliyesini kapsar; çıkış nakliyesi ayrıca fiyatlandırılır.',
        'Yüklenici firma, taşıma tarihine 72 saat kalan herhangi bir mazeret bildirmeksizin sözleşmeyi tek tarafli feshetme hakkına sahiptir.'
      ]
    },
    {
      id: 'grup_gizlilik',
      baslik: 'GİZLİLİK VE HUKUKİ YETKİ',
      maddeler: [
        'Müşteri kişisel verileri KVKK kapsamında gizli tutulur.',
        'Firmanın ticari itibarini zedeleyici art niyetli kötüyeleyici yorumlar ve paylaşımlar yapılamaz.',
        'Kaydını yaptırıp kişisel bilgilerini firma ile paylaşmış hizmet alan kişiye firmamız tarafından telefon/internet aracılığıyla tüm maddeleri bildirilmiş veya bahsedilmiştir. Tüm maddeler kabul edilmiştir.',
        'Firma tarafından hizmet alan kişiler sözleşme maddeleri dahilinde haklarını arayabilirler.'
      ]
    }
  ];

  // {ADET} yer tutucusu madde sayısıyla otomatik dolar. Böylece madde
  // eklendiğinde "29 maddelik" yazısı elle düzeltilmek zorunda kalmaz.
  export const VARSAYILAN_SOZLESME_KAPANIS =
    'İşbu {ADET} maddelik sözleşmeden doğan ihtilaflarda Istanbul (Anadolu) Mahkemeleri ve Icra Daireleri yetkilidir.';

  // DEĞİŞİKLİK: Şirketin güncel hesap bilgisi. Eski Denizbank / Şenol Beşinci
  // bilgisi kaldırıldı; artık kurumsal Garanti hesabı varsayılan.
  export const VARSAYILAN_BANKA_HESAPLARI = [
    { id: 'hesap_1', banka: 'Garanti Bankası', aliciAdi: 'Sembol Nakliyat Depoculuk Tic. Ltd. Şti.', iban: 'TR42 0006 2001 1760 0006 2953 02', not: 'Kurumsal tahsilat hesabı' }
  ];

  // IBAN'ı 4'erli gruplara ayırır: "TR940013..." -> "TR94 0013 4000 ..."
  // Boşluklu girilen IBAN da doğru biçimlenir (önce tüm boşluklar temizlenir).
  export const ibanBicimle = (iban) => {
    const temiz = String(iban || '').replace(/\s+/g, '').toUpperCase();
    return temiz.replace(/(.{4})/g, '$1 ').trim();
  };

  // TR IBAN doğrulaması: TR + 24 rakam = 26 karakter.
  // UYARI amaçlıdır, kaydetmeyi ENGELLEMEZ (yurt dışı hesap gerekebilir).
  export const ibanGecerliMi = (iban) => {
    const temiz = String(iban || '').replace(/\s+/g, '').toUpperCase();
    return /^TR\d{24}$/.test(temiz);
  };

  // Tüm gruplardaki maddelerin toplam sayısı
  export const maddeSayisi = (gruplar) =>
    (gruplar || []).reduce((toplam, g) => toplam + (g.maddeler || []).length, 0);

  // Maddeleri PDF için HTML'e çevirir.
  // ÖNEMLİ: Numaralandırma gruplar boyunca KESİNTİSİZ devam eder (1..29);
  // grup başlığı sayacı sıfırlamaz — mevcut PDF davranışıyla birebir aynı.
  // İlk grubun başlığı basılmaz, çünkü mevcut PDF'te de ilk 5 madde başlıksız gelir.
  export const sozlesmeMaddeleriHTML = (gruplar, kapanis) => {
    let sayac = 0;
    let html = '';
    (gruplar || []).forEach((grup, i) => {
      if (i > 0 && grup.baslik) {
        html += `<div class="terms-group-title">${grup.baslik}</div>\n`;
      }
      (grup.maddeler || []).forEach(madde => {
        sayac++;
        html += `${sayac}. ${madde}<br/>\n`;
      });
    });
    const kapanisMetni = String(kapanis || '').replace('{ADET}', String(sayac));
    if (kapanisMetni) html += `${kapanisMetni}<br/>\n`;
    return html;
  };

  // WhatsApp mesajlarındaki banka bloğunu üretir. Varsayılan hesap bulunamazsa
  // ilk hesaba düşer; hiç ayar yoksa fabrika değerini kullanır ki mesaj
  // hiçbir durumda IBAN'sız gitmesin.
  export const bankaBilgiMetni = (ayarlar) => {
    const hesaplar = ayarlar?.bankaHesaplari?.length ? ayarlar.bankaHesaplari : VARSAYILAN_BANKA_HESAPLARI;
    const secili = hesaplar.find(h => h.id === ayarlar?.varsayilanHesapId) || hesaplar[0];
    return `Banka: ${secili.banka}\nAlıcı: ${secili.aliciAdi}\nIBAN: ${ibanBicimle(secili.iban)}`;
  };

  // Firestore doküman referansı — tek yerden üretilir ki yol yanlış yazılmasın.
  export const resmiAyarlarRef = (db, appId) =>
    doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'resmiAyarlar');


  // ==========================================================================
  // RESMİ AYARLARI CANLI ÖNBELLEĞİ
  // ==========================================================================
  // SORUN: "Resmi Ayarları" ekranından IBAN veya sözleşme maddesi
  // değiştirildiğinde hiçbir yere yansımıyordu. Çünkü banka bilgisi ve
  // sözleşme maddeleri ÜÇ AYRI YERDE koda SABİT yazılıydı:
  //   - generateContractPDF (aşağıda)  -> 29 madde
  //   - App.jsx kayıt sonrası WhatsApp mesajı
  //   - Operasyon.jsx takvim WhatsApp mesajı
  //
  // ÇÖZÜM: Modül seviyesinde TEK bir onSnapshot dinleyicisi açılır ve ayarlar
  // burada önbelleğe alınır. Üç çağrı noktası da bu önbellekten okur.
  //
  // NEDEN PROP DEĞİL ÖNBELLEK: generateContractPDF senkron bir fonksiyon ve
  // dört ayrı yerden çağrılıyor; Operasyon.jsx'teki mesaj ise derin bir
  // bileşenin içinde. Ayarları prop olarak geçirmek onlarca dosya/bileşen
  // imzasını değiştirmeyi gerektirirdi. Tek dinleyici + önbellek en az
  // müdahaleyle çalışan çözüm.
  //
  // GÜVENLİ BAŞLANGIÇ: Önbellek dolmadan (ilk saniye) veya Firestore hatası
  // durumunda null kalır; okuma fonksiyonları bu durumda VARSAYILAN değerlere
  // düşer. Yani mesaj hiçbir zaman IBAN'sız gitmez.
  // ==========================================================================
  let _resmiAyarlarOnbellek = null;

  try {
    onSnapshot(
      resmiAyarlarRef(db, appId),
      (snap) => { if (snap.exists()) _resmiAyarlarOnbellek = snap.data(); },
      (err) => console.error('Resmi Ayarları dinlenemedi, varsayılanlar kullanılacak:', err)
    );
  } catch (err) {
    console.error('Resmi Ayarları dinleyicisi başlatılamadı:', err);
  }

  // Önbellekteki ayarları döndürür (yoksa null).
  export const resmiAyarlariAl = () => _resmiAyarlarOnbellek;

  // WhatsApp mesajlarında kullanılacak GÜNCEL banka bloğu.
  // Kayıt yoksa VARSAYILAN_BANKA_HESAPLARI üzerinden üretilir.
  export const aktifBankaBilgiMetni = () => bankaBilgiMetni(_resmiAyarlarOnbellek);


  // Varsayılan banka hesabını NESNE olarak döndürür.
  // Sözleşme PDF'inde banka / alıcı / IBAN ayrı satırlar hâlinde basıldığı için
  // metin bloğu değil, alanlara tek tek erişilebilen nesne gerekiyor.
  export const aktifBankaHesabi = () => {
    const hesaplar = _resmiAyarlarOnbellek?.bankaHesaplari?.length
      ? _resmiAyarlarOnbellek.bankaHesaplari
      : VARSAYILAN_BANKA_HESAPLARI;
    return hesaplar.find(h => h.id === _resmiAyarlarOnbellek?.varsayilanHesapId) || hesaplar[0];
  };

  // Sözleşme PDF'inde basılacak GÜNCEL madde HTML'i.
  export const aktifSozlesmeMaddeleriHTML = () => sozlesmeMaddeleriHTML(
    _resmiAyarlarOnbellek?.sozlesmeGruplari?.length ? _resmiAyarlarOnbellek.sozlesmeGruplari : VARSAYILAN_SOZLESME_GRUPLARI,
    _resmiAyarlarOnbellek?.sozlesmeKapanis || VARSAYILAN_SOZLESME_KAPANIS
  );

  // ==========================================================================
  // İŞ SONLANDIRMA -> DEFTERE OTOMATİK GELİR KAYDI
  // ==========================================================================
  // Personel işi kapattığında, KAPORA HARİÇ KALAN BAKİYE ilgili deftere
  // "PARA GİRİŞİ (ALDIM)" olarak yazılır. Açıklamaya araç plakası eklenir.
  // Tüm iş tiplerinde (Nakliye / Depo / Asansör) aynı şekilde çalışır.
  //
  // HANGİ DEFTERE YAZILIR: Ödeme yöntemi, defterin TÜRÜ ile eşleştirilir.
  // Defter ADI ile eşleştirmedim; yönetici defteri yeniden adlandırdığında
  // eşleşme bozulmasın diye tür üzerinden gidiliyor.
  //   Nakit         -> Kasa
  //   Havale/EFT    -> Banka
  //   Kredi Kartı   -> Kredi Kartı   (eski kayıtlarda 'Cari (Kişi/Firma)')
  //   Ödeme Yapmadı -> Borçlu        (eski kayıtlarda 'Diğer')
  // ==========================================================================
  export const ODEME_DEFTER_TUR_ESLEME = {
    // DEĞİŞİKLİK: Defter türü 'Kasa' -> 'Nakit' olarak yeniden adlandırıldı.
    // Eski defterler 'Kasa' türüyle kayıtlı kalabileceği için ikisi de eşleşir.
    'Nakit': ['Nakit', 'Kasa'],
    'Havale/EFT': ['Banka'],
    'Kredi Kartı': ['Kredi Kartı', 'Cari (Kişi/Firma)'],
    'Ödeme Yapmadı': ['Borçlu', 'Diğer'],
    'Ödeme Alınmadı': ['Borçlu', 'Diğer']
  };

  // Kapora hariç kalan bakiye. Negatif çıkarsa 0 döner (fazla kapora alınmışsa
  // deftere eksi gelir yazmak yanlış olur).
  export const kalanBakiyeHesapla = (job) => {
    const fiyat = parseFloat(job?.price) || 0;
    const kapora = parseFloat(job?.deposit) || 0;
    return Math.max(0, fiyat - kapora);
  };

  // Ödeme yöntemine uyan defteri bulur. Birden fazla uygun defter varsa
  // adına göre ilk sıradaki seçilir (tutarlı davranış için sabit bir kural).
  export const odemeIcinDefterBul = (defterler, odemeYontemi) => {
    const hedefTurler = ODEME_DEFTER_TUR_ESLEME[odemeYontemi] || [];
    if (!hedefTurler.length) return null;
    const uygun = (defterler || [])
      .filter(d => hedefTurler.includes(d.tur))
      .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
    return uygun[0] || null;
  };

  // ------------------------------------------------------------------
  // Deftere gelir kaydını yazar / günceller.
  //
  // ÖNEMLİ - MÜKERRER KAYIT KORUMASI: İş tamamlandıktan sonra 3 saat içinde
  // tekrar düzenlenip kaydedilebiliyor. Her kaydetmede yeni satır atılsa
  // defter şişer ve bakiye yanlış çıkar. Bu yüzden önce aynı işe ait kayıt
  // (isId === job.id) aranır; varsa GÜNCELLENİR, yoksa yeni eklenir.
  //
  // Hata durumunda istisna FIRLATILMAZ, sadece false döner: defter kaydı
  // başarısız olsa bile işin kapanması engellenmemeli.
  // ------------------------------------------------------------------
  // ==========================================================================
  // KAPORA -> DEFTERE OTOMATİK GELİR KAYDI
  // ==========================================================================
  // İş kaydı oluşturulurken kapora girildiyse, o tutar BANKA defterine
  // "PARA GİRİŞİ (ALDIM)" olarak yazılır.
  //
  // NEDEN BANKA: Müşteriye gönderilen kapora bilgilendirme mesajında IBAN
  // veriliyor, yani kapora havale/EFT ile geliyor. Nakit alındığı durumlarda
  // yönetici kaydı Defter ekranından ilgili deftere taşıyabilir.
  //
  // AÇIKLAMA: Sadece teslim kodu. Müşteri ise ayrı alanlarda (musteriAdi /
  // musteriTel) tutulur ve satırda tıklanabilir cari rozeti olarak görünür.
  //
  // MÜKERRER KORUMASI: kaporaKaynakId = job.id. Kapora tutarı sonradan
  // düzeltilirse kayıt GÜNCELLENİR, sıfırlanırsa SİLİNİR.
  // DİKKAT: Tahsilat kaydı tahsilatKaynakId, kapora kaydı kaporaKaynakId
  // kullanır. İkisi ayrı olmak ZORUNDA — aynı alan kullanılsa biri diğerinin
  // üzerine yazar ve aynı işin iki para hareketinden biri kaybolur.
  // ==========================================================================
  export const defterKaporaKaydet = async ({ db, appId, job, currentUser, addSystemLog }) => {
    try {
      const tutar = parseFloat(job?.deposit) || 0;

      // Mevcut kapora kaydı (varsa) bulunur
      const mevcutSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'),
        where('kaporaKaynakId', '==', job.id)
      ));

      // Kapora yoksa/sıfırlandıysa varsa kayıt silinir; ₺0 satırı bırakılmaz.
      if (tutar <= 0) {
        for (const d of mevcutSnap.docs) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', d.id));
        }
        return true;
      }

      // BANKA türündeki defter seçilir (birden fazlaysa adına göre ilk sıradaki).
      const defterSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'));
      const uygun = defterSnap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter(d => d.tur === 'Banka')
        .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
      const defter = uygun[0];

      if (!defter) {
        addSystemLog?.('Kapora Defter Kaydı Atlandı',
          `${job.customerName} kaporası için "Banka" türünde defter bulunamadı. Finans > Defter bölümünden açın.`);
        return false;
      }

      const teslimKodu = job?.deliveryCode || '';
      const kayit = {
        tip: 'giris',
        tutar,
        aciklama: teslimKodu ? `Teslim kodu: ${teslimKodu}` : '',
        kategori: 'Kapora',
        etiketler: ['Kapora', job.type].filter(Boolean),
        odemeYontemi: 'Havale/EFT',
        // Kaporanın alındığı gün = işin kaydedildiği gün
        tarih: (job.createdAt || new Date().toISOString()).split('T')[0],
        defterId: defter.id,
        kaynak: 'Kapora (Oto)',
        kayitTipi: 'kapora',
        kaporaKaynakId: job.id,
        isId: job.id,
        // Cari eşleşmesi — satırda tıklanabilir müşteri rozeti olarak görünür
        musteriAdi: job.customerName || '',
        musteriTel: job.customerPhone || '',
        teslimKodu,
        by: currentUser?.fullName || 'Sistem'
      };

      if (!mevcutSnap.empty) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', mevcutSnap.docs[0].id), kayit);
        addSystemLog?.('Kapora Defter Kaydı Güncellendi',
          `${defter.ad}: ${job.customerName} kaporası ₺${tutar.toLocaleString('tr-TR')} olarak güncellendi.`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...kayit, createdAt: new Date().toISOString()
        });
        addSystemLog?.('Kapora Defter Kaydı (Oto)',
          `${defter.ad}: ${job.customerName} kaporası ₺${tutar.toLocaleString('tr-TR')} giriş yazıldı.`);
      }
      return true;
    } catch (err) {
      // Kapora kaydı başarısız olsa bile iş kaydı oluşmuş kalmalı.
      console.error('Kapora deftere yazılamadı:', err);
      addSystemLog?.('Kapora Defter Kaydı Hatası',
        `${job?.customerName} kaporası için defter kaydı yapılamadı: ${err?.message || 'bilinmeyen hata'}`);
      return false;
    }
  };

  // ekipSefiAdi ve aracId çağıran taraftan (App.jsx) geçilir: personel ve
  // araç listeleri orada, burada erişim yok.
  export const defterGelirKaydet = async ({ db, appId, job, endJobDetails, currentUser, addSystemLog, ekipSefiAdi, ekipSefiId, aracId }) => {
    try {
      const odemeYontemi = endJobDetails?.paymentMethod || 'Nakit';
      const tutar = kalanBakiyeHesapla(job);

      // Bakiye sıfırsa (tamamı kapora olarak alınmış) kayıt atılmaz.
      if (tutar <= 0) return false;

      // Defterleri oku — bileşenden prop geçmek yerine burada okunuyor ki
      // fonksiyon her yerden tek satırla çağrılabilsin.
      const defterSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'));
      const defterler = defterSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      const defter = odemeIcinDefterBul(defterler, odemeYontemi);
      if (!defter) {
        // Uygun defter yoksa sessiz kalmıyoruz; yönetici defteri açsın diye log atılır.
        addSystemLog?.('Defter Kaydı Atlandı',
          `${job.customerName} işi için "${odemeYontemi}" ödemesine uygun defter bulunamadı. Finans > Defter bölümünden ilgili türde bir defter açın.`);
        return false;
      }

      // DEĞİŞİKLİK: Müşteri adı ve plaka artık AÇIKLAMA METNİNE yazılmıyor.
      // İkisi de ayrı alanlarda (musteriAdi/musteriTel, plaka/aracId) tutuluyor
      // ve defter satırında tıklanabilir rozet olarak gösteriliyor. Metne gömülü
      // olsalardı ne aranabilir ne tıklanabilir olurlardı.
      // Açıklamada artık TESLİM KODU ve EKİP ŞEFİ yer alıyor — tahsilatı
      // eşleştirirken en çok bu ikisine bakılıyor.
      const plaka = job?.assignedVehiclePlate || '';
      const teslimKodu = job?.deliveryCode || '';
      const ekipSefi = ekipSefiAdi || '';
      // DEĞİŞİKLİK: Açıklamada artık SADECE teslim kodu yazıyor.
      // İş tipi zaten etikette, ekip şefi ise ayrı rozette gösteriliyor;
      // üçünü de metne yazmak satırı gereksiz uzatıyordu.
      const aciklama = teslimKodu ? `Teslim kodu: ${teslimKodu}` : '';

      const kayit = {
        tip: 'giris',
        tutar,
        aciklama,
        // DEĞİŞİKLİK: Kategori artık işi yapan ARACIN PLAKASI. Plakalar hazır
        // kategori ağacında (KAMYONLAR/ARAÇ grupları) zaten var; böylece defter
        // kategori filtresinde araç bazlı ciro doğrudan görünür. Araç atanmadıysa
        // genel 'İŞ GELİRİ' kategorisine düşer.
        kategori: plaka || 'İŞ GELİRİ',
        // DEĞİŞİKLİK: Plaka artık ETİKET olarak eklenmiyor — kendi alanı var.
        // İkisinde de durması plakanın iki yerde görünmesine yol açıyordu.
        etiketler: [job.type].filter(Boolean),
        odemeYontemi,
        tarih: (job.completedAt || new Date().toISOString()).split('T')[0],
        defterId: defter.id,
        kaynak: 'İş Sonlandırma (Oto)',
        isId: job.id,
        // DEĞİŞİKLİK: Mükerrer koruması artık isId yerine bu alana bakıyor.
        // Sebep: aynı işin KAPORA kaydı da isId taşıyor; sorgu isId üzerinden
        // yapılsaydı tahsilat, kapora satırının ÜZERİNE yazardı ve kapora kaybolurdu.
        tahsilatKaynakId: job.id,
        kayitTipi: 'tahsilat',
        // YENİ: Defter satırından MÜŞTERİ CARİSİNE ve ARAÇ PROFİLİNE tıklanarak
        // gidilebilmesi için kimlik alanları ayrıca saklanır. Bu bilgiler açıklama
        // metninin içinde de geçiyor ama metinden ayrıştırmak kırılgan olurdu.
        musteriAdi: job.customerName || '',
        musteriTel: job.customerPhone || '',
        plaka: plaka,
        aracId: aracId || '',
        teslimKodu,
        ekipSefi,
        // Ekip şefinin KİMLİĞİ de saklanır; rozet tıklanınca personel
        // profiline gitmek için ada değil kimliğe ihtiyaç var.
        ekipSefiId: ekipSefiId || '',
        by: currentUser?.fullName || 'Sistem'
      };

      // Aynı işe ait kayıt var mı? (mükerrer koruması)
      const mevcutSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'),
        where('tahsilatKaynakId', '==', job.id)
      ));

      if (!mevcutSnap.empty) {
        const hedef = mevcutSnap.docs[0];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', hedef.id), kayit);
        addSystemLog?.('Defter Geliri Güncellendi',
          `${defter.ad}: ${job.customerName} işi güncellendi, tutar ₺${tutar.toLocaleString('tr-TR')} (${odemeYontemi}).`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...kayit, createdAt: new Date().toISOString()
        });
        addSystemLog?.('Defter Geliri (Oto)',
          `${defter.ad}: ${job.customerName}${plaka ? ` (${plaka})` : ''} işinden ₺${tutar.toLocaleString('tr-TR')} giriş yapıldı (${odemeYontemi}).`);
      }
      return true;
    } catch (err) {
      // Defter kaydı başarısız olsa bile iş kapanmalı; bu yüzden yalnızca loglanır.
      console.error('Deftere gelir kaydedilemedi:', err);
      addSystemLog?.('Defter Kaydı Hatası', `${job?.customerName} işi için defter kaydı yapılamadı: ${err?.message || 'bilinmeyen hata'}`);
      return false;
    }
  };

  // ==========================================================================
  // MAAŞ / AVANS -> DEFTERE OTOMATİK GİDER KAYDI
  // ==========================================================================
  // Maaş tablosunda bir kalem girildiğinde veya ödeme tiki atıldığında,
  // ilgili deftere "PARA ÇIKIŞI (VERDİM)" olarak personel bazlı gider yazılır.
  // İşlemi yapan kullanıcı bilgisi de kayda geçer.
  //
  //   Nakit Avans          -> Kasa defteri
  //   Resmi Avans          -> Banka defteri
  //   Kalan Nakit (tik)    -> Kasa defteri
  //   Kalan Banka (tik)    -> Banka defteri
  //
  // MÜKERRER KORUMASI: Her kalem için sabit bir kaynakId üretilir
  // (ay_personel_kalem). Tutar değişirse kayıt GÜNCELLENİR, sıfırlanır veya
  // tik kaldırılırsa kayıt SİLİNİR. Böylece tutar düzeltildiğinde defterde
  // iki satır oluşmaz ve bakiye her zaman maaş tablosuyla tutarlı kalır.
  // ==========================================================================
  export const MAAS_KALEM_DEFTER_TUR = {
    nakitAvans:        ['Nakit', 'Kasa'],
    resmiAvans:        ['Banka'],
    nakitOdenenTutar:  ['Nakit', 'Kasa'],
    bankaOdenenTutar:  ['Banka']
  };

  export const MAAS_KALEM_BILGI = {
    nakitAvans:       { etiket: 'Nakit avans',           kategori: 'Avans' },
    resmiAvans:       { etiket: 'Resmi avans (banka)',   kategori: 'Avans' },
    nakitOdenenTutar: { etiket: 'Kalan nakit ödemesi',   kategori: 'Personel Maaş' },
    bankaOdenenTutar: { etiket: 'Kalan banka ödemesi',   kategori: 'Personel Maaş' }
  };

  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Yerel tarih (YYYY-AA-GG). toISOString() UTC verdiği için kullanılmıyor:
  // Türkiye'de gece 00:00-03:00 arası işlem dünün tarihine düşerdi.
  const yerelBugun = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ------------------------------------------------------------------
  // Bir maaş kalemini deftere gider olarak yazar / günceller / siler.
  // Hata fırlatmaz; maaş tablosunun kaydedilmesi asla engellenmemeli.
  // ------------------------------------------------------------------
  export const defterPersonelGiderKaydet = async ({
    db, appId, kalem, kaynakId, personelAdi, tutar, yil, ay, currentUser, addSystemLog
  }) => {
    try {
      const hedefTurler = MAAS_KALEM_DEFTER_TUR[kalem];
      const bilgi = MAAS_KALEM_BILGI[kalem];
      if (!hedefTurler || !bilgi) return false;

      const miktar = parseFloat(tutar) || 0;

      // Aynı kaleme ait mevcut kayıt (varsa) bulunur.
      const mevcutSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'),
        where('maasKaynakId', '==', kaynakId)
      ));

      // Tutar sıfır/negatifse: kalem geri alınmış demektir, kayıt SİLİNİR.
      // Aksi halde defterde ₺0 satırı kalır ve gider yanlış görünür.
      if (miktar <= 0) {
        for (const d of mevcutSnap.docs) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', d.id));
        }
        if (!mevcutSnap.empty) {
          addSystemLog?.('Defter Gideri Kaldırıldı',
            `${personelAdi} — ${bilgi.etiket} kaydı geri alındı (${AY_ADLARI[ay - 1]} ${yil}).`);
        }
        return true;
      }

      // Defterleri oku ve türe göre uygun olanı seç.
      const defterSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'defterler'));
      const uygun = defterSnap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter(d => hedefTurler.includes(d.tur))
        .sort((a, b) => (a.ad || '').localeCompare((b.ad || ''), 'tr-TR'));
      const defter = uygun[0];

      if (!defter) {
        addSystemLog?.('Defter Kaydı Atlandı',
          `${personelAdi} — ${bilgi.etiket} için "${hedefTurler.join(' / ')}" türünde defter bulunamadı. Finans > Defter bölümünden açın.`);
        return false;
      }

      const yapanKisi = currentUser?.fullName || 'Sistem';
      const kayit = {
        tip: 'cikis',
        tutar: miktar,
        // Açıklamada personel adı, kalem, dönem ve İŞLEMİ YAPAN kullanıcı yer alır.
        aciklama: `${personelAdi} — ${bilgi.etiket} (${AY_ADLARI[ay - 1]} ${yil}) • İşlemi yapan: ${yapanKisi}`,
        kategori: bilgi.kategori,
        etiketler: [personelAdi, bilgi.etiket, `${AY_ADLARI[ay - 1]} ${yil}`].filter(Boolean),
        odemeYontemi: hedefTurler.includes('Banka') ? 'Banka / Havale' : 'Nakit',
        // İşlemin YAPILDIĞI gün yazılır; günlük defter filtresi bu tarihi kullanır.
        tarih: yerelBugun(),
        defterId: defter.id,
        kaynak: 'Maaş Tablosu (Oto)',
        maasKaynakId: kaynakId,
        personelAdi,
        by: yapanKisi
      };

      if (!mevcutSnap.empty) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri', mevcutSnap.docs[0].id), kayit);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'defterIslemleri'), {
          ...kayit, createdAt: new Date().toISOString()
        });
        addSystemLog?.('Defter Gideri (Oto)',
          `${defter.ad}: ${personelAdi} — ${bilgi.etiket} ₺${miktar.toLocaleString('tr-TR')} çıkış yazıldı. İşlemi yapan: ${yapanKisi}.`);
      }
      return true;
    } catch (err) {
      console.error('Deftere personel gideri yazılamadı:', err);
      addSystemLog?.('Defter Kaydı Hatası',
        `${personelAdi} — ${kalem} defter kaydı yapılamadı: ${err?.message || 'bilinmeyen hata'}`);
      return false;
    }
  };

  // ==========================================================================
  // DEFTER ETİKETLERİ — hazır etiket ağacı
  // ==========================================================================
  // Defter işlemlerinde (para girişi / çıkışı) kullanılacak hazır etiketler.
  // Kullanıcının mevcut muhasebe uygulamasındaki kategori listesinden aynen
  // alındı. Bazı grupların ALT ETİKETLERİ var (örn. KAMYONLAR > plakalar);
  // seçim penceresi bu ağacı katlanır gruplar hâlinde gösterir.
  //
  // Kullanıcının SONRADAN eklediği etiketler burada DEĞİL, Firestore'da
  // (settings/defterEtiketleri) tutulur; böylece bu liste kod tarafında sabit
  // kalır, kullanıcı eklemeleri ise kalıcı olarak saklanır ve bir daha
  // hazır olarak gelir.
  // ==========================================================================
  export const VARSAYILAN_ETIKET_GRUPLARI = [
    { baslik: 'ARAÇ', etiketler: ['34 MIA 813', '34 MOB 328', '34 MVA 22', '34 NND 433', '34 RFC 208'] },
    { baslik: 'KAMYONLAR', etiketler: ['34 HPA 843', '34 KTS 305', '34 KUD 891', '34 NAR 456', '34 NPH 332', '34 PCY 589'] },
    { baslik: 'KİRALAR', etiketler: ['ALT KAYNARCA DEPO', 'BAŞAKŞEHİR DEPO', 'ÇEKMEKÖY DEPO', 'ÇINARDERE DEPO', 'DERNEK DEPO', 'DUDULLU DEPO', 'KARTAL DEPO', 'KURFALI DEPO', 'MERKEZ DEPO', 'MERKEZ OFİS', 'SAPANBAĞLARI DEPO', 'ÜST KAYNARCA DEPO', 'YEŞİLBAĞLAR DEPO'] },
    { baslik: 'KREDİ', etiketler: ['ARAÇ KREDİSİ', 'TAKSİTLİ BORÇLAR'] },
    { baslik: 'KREDİ KARTI', etiketler: ['ALBARAKA KART', 'EN PARA', 'GARANTİ KART', 'KUVEYTTÜRK KART'] },
    { baslik: 'MAAŞ', etiketler: ['AVANS', 'İCRA KESİNTİ', 'MESAİ', 'MESAİ - PRİM', 'YOL'] },
    { baslik: 'MALZEME', etiketler: ['BANT', 'KAĞIT', 'KOLİ', 'PAT PAT', 'POŞET', 'STREÇ', 'YATAK KILIFI'] },
    { baslik: 'REKLAM', etiketler: ['ADWORDS', 'DEPOEVİM.COM', 'HARİTA', 'META', 'SANDIKDEPO', 'SEMBOLEVDENEVE.COM'] },
    { baslik: 'FATURA', etiketler: ['ELEKTRİK', 'ISINMA', 'İNTERNET', 'SU', 'TELEFON', 'TV'] },
    { baslik: 'KİŞİLER', etiketler: ['ABDULLAH BEŞİNCİ', 'ELMAS BEŞİNCİ', 'MUSTAFA BEŞİNCİ', 'ŞENOL BEŞİNCİ'] },
    { baslik: 'GENEL', etiketler: [
      'AİDAT', 'ARAÇ ALIMI', 'ASANSÖR KİRALAMA', 'BAĞIŞ', 'CEZALAR', 'DEPO TADİLAT',
      'DEPOEVİM', 'EKİPMAN', 'FON', 'HARİCİ ALICAKLAR', 'HASAR MASRAF', 'HUKUK',
      'İŞ GÜVENLİĞİ', 'KAMYON BAKIM', 'KAPORA', 'KOMİSYON', 'MAAŞ KESİNTİ', 'MAZOT',
      'MİA MASRAF', 'MUHASEBE', 'OFİS TADİLAT', 'PERSONEL GİYİM', 'SAĞLIK / SİGORTA',
      'SATIŞ', 'SEYAHAT', 'TEREA', 'ULAŞIM / ARABA', 'UZUN YOL MASRAF', 'VERGİ',
      'YAKIT', 'YAZILIM CRM', 'YEMEK / MARKET', 'YEVMİYECİ', 'YIKAMA', 'YILLIK İZİN'
    ] }
  ];

  // Ağacı düz listeye çevirir — arama ve "bu etiket zaten var mı" kontrolü için.
  export const tumVarsayilanEtiketler = () => {
    const liste = [];
    VARSAYILAN_ETIKET_GRUPLARI.forEach(g => {
      liste.push(g.baslik);
      g.etiketler.forEach(e => liste.push(e));
    });
    // KİŞİLER ve GENEL yapay gruplama başlıkları; etiket olarak kullanılmaz.
    return liste.filter(e => e !== 'KİŞİLER' && e !== 'GENEL');
  };

  // Kullanıcının eklediği özel etiketlerin Firestore referansı.
  export const defterEtiketleriRef = (db, appId) =>
    doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'defterEtiketleri');

  export const generateContractPDF = (job) => {
    const printWindow = window.open('', '_blank');
    
    const bakiye = (parseInt(job.price || 0) - parseInt(job.deposit || 0)).toLocaleString('tr-TR');
    const fiyat = parseInt(job.price || 0).toLocaleString('tr-TR');
    const kapora = parseInt(job.deposit || 0).toLocaleString('tr-TR');

    // YENİ: PDF dosya adı "Ad-Soyad-GG.AA.YYYY" formatında oluşturulur.
    // Tarayıcılar "PDF olarak kaydet" işleminde sayfa başlığını (title) dosya adı olarak kullanır.
    const pdfDate = (job.date || '').split('-').reverse().join('.'); // YYYY-AA-GG -> GG.AA.YYYY
    const pdfFileName = `${(job.customerName || 'Musteri').trim().replace(/\s+/g, '-')}-${pdfDate}`;

    const isBinaAsansorFrom = job.fromTransportMethod === 'Bina Asansörü' ? 'Var' : 'Yok';
    const isCepheAsansorFrom = job.fromTransportMethod === 'Dış Cephe Asansörü' ? 'Var' : 'Yok';
    const isToplamaFrom = job.fromPacking === 'Toplama Yapılacak' ? 'Var' : 'Yok';

    const isBinaAsansorTo = job.toTransportMethod === 'Bina Asansörü' ? 'Var' : 'Yok';
    const isCepheAsansorTo = job.toTransportMethod === 'Dış Cephe Asansörü' ? 'Var' : 'Yok';

    // ============================================================================
    // YENİ: Birden fazla yükleme/boşaltma adresini sözleşmede göstermek için yardımcılar.
    // Her adres, 1. adresteki tabloyla aynı formatta ve "1. ADRES / 2. ADRES ..." başlığıyla basılır.
    // ============================================================================
    const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Yükleme adresi tablosu üretir (extra=false: ana adres, packing/toplama satırı gösterilir)
    const buildLoadTable = (addr, title) => {
      const binaAsansor = addr.transportMethod === 'Bina Asansörü' ? 'Var' : 'Yok';
      const cepheAsansor = addr.transportMethod === 'Dış Cephe Asansörü' ? 'Var' : 'Yok';
      const adres = addr.province ? `${escapeHtml(addr.province)}/${escapeHtml(addr.district)} - ${escapeHtml(addr.address)}` : 'Belirtilmedi';
      // YENİ: Eşya Durumu — çoklu seçim listesi varsa onu yaz (Teslim Durumu ile aynı mantık),
      // yoksa eski tekli değeri (addr.packing) göster.
      const esyaText = (addr.esyaDurumu && addr.esyaDurumu.length > 0)
        ? escapeHtml(addr.esyaDurumu.join(' • '))
        : escapeHtml(addr.packing || 'Kendisi Topladı');
      return `
        <table>
          <tr><th colspan="2">${title}</th></tr>
          <tr><td class="label">Adres:</td><td>${adres}</td></tr>
          <tr><td class="label">Kat:</td><td>${escapeHtml(addr.floor)}</td></tr>
          <tr><td class="label">Oda Sayısı:</td><td>${escapeHtml(addr.roomCount)}</td></tr>
          <tr><td class="label">Bina Asansörü:</td><td>${binaAsansor}</td></tr>
          <tr><td class="label">Dış Cephe Asansörü:</td><td>${cepheAsansor}</td></tr>
          <tr><td class="label">Eşya Durumu:</td><td>${esyaText}</td></tr>
        </table>`;
    };

    // Boşaltma adresi tablosu üretir. showTeslim=true ise (yalnızca 1. adres) Teslim Durumu satırı eklenir.
    const buildUnloadTable = (addr, title, showTeslim) => {
      const binaAsansor = addr.transportMethod === 'Bina Asansörü' ? 'Var' : 'Yok';
      const cepheAsansor = addr.transportMethod === 'Dış Cephe Asansörü' ? 'Var' : 'Yok';
      const adres = addr.province ? `${escapeHtml(addr.province)}/${escapeHtml(addr.district)} - ${escapeHtml(addr.address)}` : 'Belirtilmedi';
      const teslimRow = (showTeslim && job.wallMounting && job.wallMounting.length > 0)
        ? `<tr><td class="label">Teslim Durumu:</td><td>${escapeHtml(job.wallMounting.join(' • '))}</td></tr>` : '';
      return `
        <table>
          <tr><th colspan="2">${title}</th></tr>
          <tr><td class="label">Adres:</td><td>${adres}</td></tr>
          <tr><td class="label">Kat:</td><td>${escapeHtml(addr.floor)}</td></tr>
          <tr><td class="label">Oda Sayısı:</td><td>${escapeHtml(addr.roomCount)}</td></tr>
          <tr><td class="label">Bina Asansörü:</td><td>${binaAsansor}</td></tr>
          <tr><td class="label">Dış Cephe Asansörü:</td><td>${cepheAsansor}</td></tr>
          ${teslimRow}
        </table>`;
    };

    // Ana yükleme adresi + ekstra yükleme adreslerini birleştir
    const loadingAddresses = [
      { province: job.fromProvince, district: job.fromDistrict, address: job.fromAddress, floor: job.fromFloor, roomCount: job.fromRoomCount, transportMethod: job.fromTransportMethod, packing: job.fromPacking, esyaDurumu: job.esyaDurumu },
      ...(job.extraLoadingAddresses || [])
    ];
    // Ana boşaltma adresi + ekstra boşaltma adreslerini birleştir
    const unloadingAddresses = [
      { province: job.toProvince, district: job.toDistrict, address: job.toAddress, floor: job.toFloor, roomCount: job.toRoomCount, transportMethod: job.toTransportMethod, packing: job.toPacking },
      ...(job.extraUnloadingAddresses || [])
    ];

    const totalAddressCount = loadingAddresses.length + unloadingAddresses.length;

    // Tek adres varsa eski başlık ("...(NEREDEN)"), birden fazla varsa "... 1. ADRES / 2. ADRES" başlığı kullanılır
    const loadingTablesHtml = loadingAddresses.map((a, i) =>
      buildLoadTable(a, loadingAddresses.length === 1 ? 'YÜKLEME ADRESİ (NEREDEN)' : `YÜKLEME ADRESİ - ${i + 1}. ADRES`)
    ).join('');
    const unloadingTablesHtml = unloadingAddresses.map((a, i) =>
      buildUnloadTable(a, unloadingAddresses.length === 1 ? 'BOŞALTMA ADRESİ (NEREYE)' : `BOŞALTMA ADRESİ - ${i + 1}. ADRES`, i === 0)
    ).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${pdfFileName}</title>
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
        
        <!-- YENİ: Tüm sayfa-1 içeriği "fitbox" içine alındı; adres sayısı arttıkça JS ile otomatik küçültülüp
             her zaman TEK SAYFAYA sığdırılır (2. sayfaya asla taşmaz). -->
        <div id="fitbox">
        ${loadingTablesHtml}

        ${unloadingTablesHtml}

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

        ${/* YENİ: IBAN BİLGİLERİ bölümü. Ödeme detaylarının hemen altında yer alır.
             Bilgiler Resmi Ayarları ekranındaki VARSAYILAN hesaptan okunur; panelden
             IBAN değiştirildiğinde sözleşme de otomatik güncellenir. Sabit yazılmadı.
             escapeHtml: banka/alıcı adında & < > geçerse PDF bozulmasın diye. */ ''}
        <table>
          <tr><th colspan="2">IBAN BİLGİLERİ</th></tr>
          <tr><td class="label">Banka:</td><td>${escapeHtml(aktifBankaHesabi().banka)}</td></tr>
          <tr><td class="label">Alıcı / Hesap Sahibi:</td><td>${escapeHtml(aktifBankaHesabi().aliciAdi)}</td></tr>
          <tr><td class="label">IBAN:</td><td><b style="font-family: monospace; letter-spacing: 0.5px;">${escapeHtml(ibanBicimle(aktifBankaHesabi().iban))}</b></td></tr>
          <tr><td class="label">Ödeme Açıklaması:</td><td>Lütfen açıklama kısmına teslim kodunuzu (<b>${escapeHtml(job.deliveryCode || '-')}</b>) yazınız.</td></tr>
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
        </div><!-- /fitbox -->
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
          ${/* DEĞİŞİKLİK: 29 madde artık burada SABİT yazılı DEĞİL.
               Resmi Ayarları ekranından yönetiliyor. aktifSozlesmeMaddeleriHTML()
               Firestore'daki güncel maddeleri, kayıt yoksa varsayılanları basar.
               Numaralandırma ve grup başlıkları eskisiyle birebir aynı üretilir. */ ''}
          ${aktifSozlesmeMaddeleriHTML()}
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

        // ============================================================================
        // YENİ: OTOMATİK SIĞDIRMA — Ne kadar adres eklenirse eklensin sayfa-1 içeriği
        // ("fitbox") her zaman ilk sayfaya sığar, ASLA 2. sayfaya taşmaz.
        // Mantık: fitbox'ın gerçek yüksekliği, sayfanın kullanılabilir yüksekliğini aşarsa
        // içerik oransal olarak küçültülür (transform: scale). Genişlik korunur (width telafisi).
        // ============================================================================
        function fitPageOne() {
          const box = document.getElementById('fitbox');
          if (!box) return;
          const page = box.closest('.page');
          if (!page) return;
          // Sayfa iç yüksekliği: 297mm - (üst+alt padding 8mm+8mm). px'e çeviriyoruz (1mm ≈ 3.7795px).
          const mmToPx = 3.7795275591;
          const pagePadTop = 8 * mmToPx, pagePadBottom = 8 * mmToPx;
          // fitbox'ın başladığı dikey konumdan sayfa sonuna kadar kalan alan
          const boxTop = box.offsetTop; // .page içindeki üst konum (header + title sonrası)
          const available = (297 * mmToPx) - pagePadBottom - boxTop;
          const needed = box.scrollHeight;
          if (needed > available) {
            let s = available / needed;
            if (s > 1) s = 1;
            if (s < 0.4) s = 0.4; // aşırı küçülmeyi sınırla (okunabilirlik)
            // Genişlik telafisi: önce genişlet, sonra ölçekle -> son genişlik ~%100 kalır
            box.style.transformOrigin = 'top left';
            box.style.width = (100 / s) + '%';
            box.style.transform = 'scale(' + s + ')';
          }
        }

        // İçerik (logo/kaşe görselleri dahil) tam yüklendikten sonra ölç, sonra bas.
        window.addEventListener('load', () => {
          setTimeout(() => {
            fitPageOne();
            setTimeout(() => { window.print(); }, 350);
          }, 300);
        });
      </script>
    </body>
    </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ============================================================================
  // YENİ: PERSONEL GİRİŞ / ÇIKIŞ EVRAKLARI OTOMATİK OLUŞTURUCU
  // Personel bilgileri (ad, TC, telefon, görev, adres, tarih) otomatik doldurulur.
  // Tutanak evraklarıyla aynı stil: logo + şirket başlığı, sayfa/site alt bilgisi YOK.
  // Hem yazdırılabilir hem (üst katmanda) yükleme için kullanılır.
  //   type: 'is_sozlesmesi' | 'isg_proseduru' | 'ibraname' | 'istifa'
  // ============================================================================
  export const generatePersonnelDocPDF = (person, type) => {
    const printWindow = window.open('', '_blank');
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bugun = new Date().toLocaleDateString('tr-TR');
    const ad = esc(person.fullName || '..............................');
    const tc = esc(person.tcNo || '..............................');
    const tel = esc(person.personalPhone || person.companyPhone || '..............................');
    const gorev = esc(person.position || 'Nakliye Personeli');
    const adres = esc(person.address || '..............................');
    const iseBaslama = esc(person.startDate ? person.startDate.split('-').reverse().join('.') : bugun);

    // Belge başlıkları ve dosya adları
    const META = {
      is_sozlesmesi: { title: 'BELİRSİZ SÜRELİ İŞ SÖZLEŞMESİ', file: `${ad.replace(/\s+/g,'-')}-Is-Sozlesmesi` },
      isg_proseduru: { title: 'İŞE GİRİŞ VE ÇALIŞMA PROSEDÜRLERİ', file: `${ad.replace(/\s+/g,'-')}-ISG-Proseduru` },
      ibraname:      { title: 'İBRANAME', file: `${ad.replace(/\s+/g,'-')}-Ibraname` },
      istifa:        { title: 'İSTİFA DİLEKÇESİ', file: `${ad.replace(/\s+/g,'-')}-Istifa-Dilekcesi` },
    };
    const meta = META[type] || META.is_sozlesmesi;

    // Her belge türü için gövde HTML'i
    let bodyHtml = '';

    if (type === 'is_sozlesmesi') {
      bodyHtml = `
        <div class="main-title">BELİRSİZ SÜRELİ İŞ SÖZLEŞMESİ</div>
        <table>
          <tr><th colspan="2">İŞVEREN BİLGİLERİ</th></tr>
          <tr><td class="label">Ünvanı</td><td>Sembol Nakliyat Depoculuk Tic. Ltd. Şti.</td></tr>
          <tr><td class="label">Adresi</td><td>Bahçelievler Mah. Yeni Sokak No:5/C Pendik / İSTANBUL</td></tr>
          <tr><td class="label">Vergi No</td><td>7600944287</td></tr>
        </table>
        <table>
          <tr><th colspan="2">İŞÇİ (ÇALIŞAN) BİLGİLERİ</th></tr>
          <tr><td class="label">Adı Soyadı</td><td>${ad}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${tc}</td></tr>
          <tr><td class="label">Görevi</td><td>${gorev}</td></tr>
          <tr><td class="label">Telefon</td><td>${tel}</td></tr>
          <tr><td class="label">Adresi</td><td>${adres}</td></tr>
          <tr><td class="label">İşe Başlama Tarihi</td><td>${iseBaslama}</td></tr>
        </table>
        <div class="section-title">SÖZLEŞMENİN KONUSU VE HÜKÜMLERİ</div>
        <div class="terms-list">
          <p><b>1. Taraflar:</b> İşbu sözleşme yukarıda bilgileri yer alan işveren ile işçi arasında belirsiz süreli olarak akdedilmiştir.</p>
          <p><b>2. İşin Niteliği:</b> İşçi, işveren tarafından verilecek "${gorev}" görevini, iş sağlığı ve güvenliği kurallarına uygun şekilde yerine getirmeyi kabul eder.</p>
          <p><b>3. Çalışma Süresi:</b> Haftalık çalışma süresi yasal mevzuata uygun olup, fazla mesai ilgili kanun hükümlerine göre uygulanır.</p>
          <p><b>4. Ücret:</b> İşçiye ödenecek ücret ve yan haklar taraflar arasında kararlaştırıldığı şekilde, yasal kesintiler yapılarak ödenir.</p>
          <p><b>5. Deneme Süresi:</b> İşbu sözleşmede yasal sınırlar dahilinde deneme süresi uygulanabilir.</p>
          <p><b>6. Yükümlülükler:</b> İşçi; işyeri kurallarına, iş güvenliği talimatlarına, gizlilik ve müşteri memnuniyeti ilkelerine uymayı taahhüt eder.</p>
          <p><b>7. Feshi:</b> Sözleşmenin feshinde 4857 sayılı İş Kanunu hükümleri uygulanır.</p>
          <p><b>8. Yürürlük:</b> İşbu sözleşme ${iseBaslama} tarihinde yürürlüğe girmiş olup, taraflarca okunarak imza altına alınmıştır.</p>
        </div>
        <div class="signatures">
          <div class="sign-box"><div class="sign-title">İŞVEREN (KAŞE / İMZA)</div><div class="sign-details">Sembol Nakliyat Depoculuk Tic. Ltd. Şti.<br/><br/><br/>İmza:</div></div>
          <div class="sign-box"><div class="sign-title">İŞÇİ (ÇALIŞAN)</div><div class="sign-details">Adı Soyadı: ${ad}<br/>T.C. No: ${tc}<br/><br/>İmza:</div></div>
        </div>`;
    } else if (type === 'isg_proseduru') {
      bodyHtml = `
        <div class="main-title">İŞE GİRİŞ VE ÇALIŞMA PROSEDÜRLERİ</div>
        <table>
          <tr><th colspan="2">İŞE BAŞLAYAN KİŞİNİN BİLGİLERİ</th></tr>
          <tr><td class="label">Adı Soyadı</td><td>${ad}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${tc}</td></tr>
          <tr><td class="label">Görevi</td><td>${gorev}</td></tr>
          <tr><td class="label">Telefon Numarası</td><td>${tel}</td></tr>
          <tr><td class="label">Ev Adresi</td><td>${adres}</td></tr>
          <tr><td class="label">İşe Giriş Tarihi</td><td>${iseBaslama}</td></tr>
        </table>
        <div class="section-title">İDARİ İŞLER — TESLİM EDİLEN / ALINAN BELGELER</div>
        <table>
          <tr><th>Belge</th><th style="width:20%">Durum</th></tr>
          ${['İşe Giriş Bildirgesi','Kimlik Fotokopisi','İkametgâh Senedi','Nüfus Kayıt Örneği','Adli Sicil Kaydı','Diploma Örneği','Vesikalık Fotoğraf','KKD Teslim Tutanağı','İSG Talimatı','İş Sözleşmesi','İSG Eğitim Sertifikası','Sağlık Raporu','İşe Başlangıç Muayenesi'].map(b => `<tr><td>${b}</td><td style="text-align:center">☐</td></tr>`).join('')}
        </table>
        <div class="section-title">TAAHHÜT</div>
        <div class="desc-box">
          Yukarıda kimliği yazılı çalışan olarak, Sembol Nakliyat firmasında çalıştığım sürece tarafıma tebliğ edilen iş sağlığı ve güvenliği kuralları ile çalışma prosedürlerine eksiksiz uymayı, KKD'lerimi kullanmayı, müşteri memnuniyeti ve gizlilik ilkelerine riayet etmeyi kabul ve taahhüt ederim.
        </div>
        <div class="signatures">
          <div class="sign-box"><div class="sign-title">TEBLİĞ EDEN (İŞVEREN)</div><div class="sign-details">Sembol Nakliyat<br/><br/><br/>İmza:</div></div>
          <div class="sign-box"><div class="sign-title">TEBELLÜĞ EDEN (ÇALIŞAN)</div><div class="sign-details">Adı Soyadı: ${ad}<br/>Tarih: ${iseBaslama}<br/><br/>İmza:</div></div>
        </div>`;
    } else if (type === 'ibraname') {
      bodyHtml = `
        <div class="main-title">İBRANAME</div>
        <table>
          <tr><th colspan="2">ÇALIŞAN BİLGİLERİ</th></tr>
          <tr><td class="label">Adı Soyadı</td><td>${ad}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${tc}</td></tr>
          <tr><td class="label">Görevi</td><td>${gorev}</td></tr>
          <tr><td class="label">İşe Giriş Tarihi</td><td>${iseBaslama}</td></tr>
          <tr><td class="label">İşten Ayrılış Tarihi</td><td>${bugun}</td></tr>
        </table>
        <div class="section-title">İBRA BEYANI</div>
        <div class="terms-list">
          <p>Sembol Nakliyat Depoculuk Tic. Ltd. Şti. bünyesinde <b>${iseBaslama}</b> - <b>${bugun}</b> tarihleri arasında <b>${gorev}</b> olarak çalıştım.</p>
          <p>Çalıştığım süre boyunca hak etmiş olduğum <b>ücret, fazla mesai, yıllık izin, ihbar ve kıdem tazminatı</b> ile her türlü sosyal hak ve alacaklarımı eksiksiz ve nakden tahsil ettim.</p>
          <p>İşverenden herhangi bir alacağımın kalmadığını, bundan sonra <b>maddi ve manevi hiçbir talebim olmayacağını</b> beyan eder; işvereni bu tarih itibarıyla <b>karşılıklı olarak ibra ederim.</b></p>
          <p>İşbu ibraname tarafımca okunarak, hiçbir baskı altında kalmadan, kendi hür irademle imzalanmıştır. Tarih: ${bugun}</p>
        </div>
        <div class="signatures">
          <div class="sign-box"><div class="sign-title">İŞVEREN (KAŞE / İMZA)</div><div class="sign-details">Sembol Nakliyat Depoculuk Tic. Ltd. Şti.<br/><br/><br/>İmza:</div></div>
          <div class="sign-box"><div class="sign-title">İBRA EDEN (ÇALIŞAN)</div><div class="sign-details">Adı Soyadı: ${ad}<br/>T.C. No: ${tc}<br/><br/>İmza:</div></div>
        </div>`;
    } else if (type === 'istifa') {
      bodyHtml = `
        <div class="main-title">İSTİFA DİLEKÇESİ</div>
        <div style="text-align:right; font-size:11px; margin-bottom:10px;">Tarih: ${bugun}</div>
        <div style="font-weight:bold; font-size:12px; margin-bottom:10px;">SEMBOL NAKLİYAT DEPOCULUK TİC. LTD. ŞTİ. İNSAN KAYNAKLARI DEPARTMANINA,</div>
        <div class="terms-list">
          <p>Firmanız bünyesinde <b>${iseBaslama}</b> tarihinden itibaren <b>${gorev}</b> pozisyonunda görev yapmaktayım.</p>
          <p>Kişisel nedenlerimden dolayı <b>${bugun}</b> tarihi itibarıyla görevimden kendi isteğimle istifa etmek istiyorum.</p>
          <p>Gereğinin yapılmasını bilgilerinize arz ederim.</p>
        </div>
        <table style="margin-top:14px;">
          <tr><td class="label">Adı Soyadı</td><td>${ad}</td></tr>
          <tr><td class="label">T.C. Kimlik No</td><td>${tc}</td></tr>
          <tr><td class="label">Telefon</td><td>${tel}</td></tr>
        </table>
        <div class="signatures">
          <div class="sign-box" style="width:45%; margin-left:auto;"><div class="sign-title">İSTİFA EDEN (İMZA)</div><div class="sign-details">Adı Soyadı: ${ad}<br/>Tarih: ${bugun}<br/><br/>İmza:</div></div>
        </div>`;
    }

    const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${meta.file}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; font-size: 10px; }
        .page { width: 210mm; min-height: 297mm; background: white; padding: 12mm 14mm; margin: 10mm auto; box-shadow: 0 0 10px rgba(0,0,0,0.5); position: relative; }
        @media print {
          @page { margin: 0 !important; }
          body { background: white; margin: 0; -webkit-print-color-adjust: exact; }
          .page { margin: 0; padding: 12mm 14mm; box-shadow: none; border: none; }
        }
        .header { text-align: center; border-bottom: 2px solid #d32f2f; padding-bottom: 6px; margin-bottom: 10px; display: flex; flex-direction: column; align-items: center; }
        .logo-img { height: 44px; margin-bottom: 4px; object-fit: contain; }
        .subtitle { font-size: 11px; color: #333; font-weight: bold; margin-bottom: 3px; letter-spacing: 1px; }
        .contact-info { font-size: 9px; color: #555; line-height: 1.2; }
        .main-title { font-size: 14px; font-weight: bold; text-align: center; margin: 10px 0; padding: 6px; background: #f0f0f0; border: 1px solid #ccc; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
        th { background: #f0f0f0; padding: 5px; border: 1px solid #ccc; text-align: left; font-size: 11px; color: #d32f2f; }
        td { padding: 5px; border: 1px solid #ccc; vertical-align: top; }
        .label { font-weight: bold; width: 35%; background: #fafafa; }
        .section-title { font-weight: bold; font-size: 11px; color: #d32f2f; margin-top: 10px; margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
        .desc-box { padding: 8px; border: 1px dashed #ccc; font-size: 10px; min-height: 30px; margin-bottom: 10px; background: #fafafa; line-height: 1.5; }
        .terms-list { font-size: 10.5px; line-height: 1.6; text-align: justify; }
        .terms-list p { margin: 6px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
        .sign-box { width: 45%; font-size: 10px; }
        .sign-title { font-weight: bold; text-align: center; margin-bottom: 6px; text-decoration: underline; }
        .sign-details { line-height: 1.6; }
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
        ${bodyHtml}
      </div>
      <script>
        // Sol-alt (site adresi) ve sağ-alt (sayfa no) yazdırma bilgilerini gizlemek için sayfa marjı sıfırlanır.
        const style = document.createElement('style');
        style.textContent = '@page { margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } }';
        document.head.appendChild(style);
        window.addEventListener('load', () => { setTimeout(() => { window.print(); }, 400); });
      </script>
    </body>
    </html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };
  // ============================================================================
  // YENİ: SAYFALAMA ÇUBUĞU (PAGINATION BAR)
  // Uzun listeleri sayfalara böler. Liste bileşenleri yalnızca aktif sayfanın
  // dilimini ekrana basar; sayfa geçişi bu çubuktan yapılır.
  // Kullanım: <SayfalamaBar toplam={liste.length} sayfa={sayfa} onSayfaChange={setSayfa} birim="iş" />
  // ============================================================================
  export const SayfalamaBar = ({ toplam = 0, sayfa = 1, sayfaBoyutu = 50, onSayfaChange, birim = 'kayıt' }) => {
    const toplamSayfa = Math.max(1, Math.ceil(toplam / sayfaBoyutu));
    if (toplam === 0) return null;

    const bas = (sayfa - 1) * sayfaBoyutu + 1;
    const son = Math.min(sayfa * sayfaBoyutu, toplam);

    // Görünecek sayfa numaraları: ilk, son ve aktif sayfanın komşuları (arası "…" ile kısaltılır)
    const numaralar = [];
    const ekle = (n) => { if (n >= 1 && n <= toplamSayfa && !numaralar.includes(n)) numaralar.push(n); };
    ekle(1); ekle(toplamSayfa);
    for (let i = sayfa - 1; i <= sayfa + 1; i++) ekle(i);
    numaralar.sort((a, b) => a - b);

    const git = (n) => {
      const hedef = Math.min(Math.max(1, n), toplamSayfa);
      onSayfaChange?.(hedef);
      // Sayfa değişince listenin başına dön (uzun listelerde kullanıcı kaybolmasın)
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-neutral-200">
        {/* Kaç kayıttan kaçının gösterildiği bilgisi */}
        <span className="text-xs font-bold text-neutral-500">
          Toplam <span className="text-black">{toplam.toLocaleString('tr-TR')}</span> {birim} — {bas}-{son} arası gösteriliyor
          {toplamSayfa > 1 && <span className="text-neutral-400"> (Sayfa {sayfa}/{toplamSayfa})</span>}
        </span>

        {toplamSayfa > 1 && (
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <button onClick={() => git(sayfa - 1)} disabled={sayfa === 1}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-neutral-200 bg-white text-neutral-600 hover:border-red-400 hover:text-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-neutral-200 disabled:hover:text-neutral-600">
              ‹ Önceki
            </button>
            {numaralar.map((n, i) => (
              <span key={n} className="flex items-center gap-1">
                {/* Araya boşluk düşüyorsa üç nokta göster */}
                {i > 0 && n - numaralar[i - 1] > 1 && <span className="text-neutral-300 text-xs px-0.5">…</span>}
                <button onClick={() => git(n)}
                  className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-black border transition ${n === sayfa ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-neutral-600 border-neutral-200 hover:border-red-400 hover:text-red-600'}`}>
                  {n}
                </button>
              </span>
            ))}
            <button onClick={() => git(sayfa + 1)} disabled={sayfa === toplamSayfa}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-neutral-200 bg-white text-neutral-600 hover:border-red-400 hover:text-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-neutral-200 disabled:hover:text-neutral-600">
              Sonraki ›
            </button>
          </div>
        )}
      </div>
    );
  };

// ============================================================================
// YENİ: TARAYICI BİLDİRİMİ (Browser Notification) YARDIMCI FONKSİYONLARI
// ----------------------------------------------------------------------------
// Amaç: Hasarlı işler, Görev Tahtası, Araç Tahtası ve Hatırlatmalar'da yeni
// bir kayıt oluştuğunda, sayfa arka planda olsa bile kullanıcının tarayıcısı
// üzerinden (masaüstü bildirimi gibi) uyarı göstermek.
//
// Tarayıcı desteği: Bu API tüm ortamlarda desteklenmez (özellikle iOS Safari,
// PWA olarak ana ekrana eklenmediği sürece desteklemez). Bu yüzden her
// fonksiyon, önce API'nin var olup olmadığını kontrol eder; yoksa sessizce
// hiçbir şey yapmaz (hata fırlatmaz, uygulamayı bozmaz).
// ============================================================================

// Tarayıcı bildirim izni destekleniyor mu? (iOS Safari'de genelde false döner)
export const bildirimDestekleniyorMu = () => typeof window !== 'undefined' && 'Notification' in window;

// Kullanıcıdan bildirim izni ister. Zaten izin verilmiş/reddedilmişse tekrar sormaz.
export const bildirimIzniIste = async () => {
  if (!bildirimDestekleniyorMu()) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
};

// Bir tarayıcı bildirimi gönderir. İzin yoksa veya API desteklenmiyorsa sessizce çıkar.
// title: başlık, body: mesaj metni, opts: { tag, onClick } gibi ek seçenekler.
export const bildirimGonder = (title, body, opts = {}) => {
  if (!bildirimDestekleniyorMu() || Notification.permission !== 'granted') return;
  try {
    const bildirim = new Notification(title, {
      body,
      icon: '/logo192.png', // Proje kök dizininde bu dosya yoksa tarayıcı varsayılan ikonu kullanır, hata vermez
      tag: opts.tag, // Aynı 'tag' ile gelen bildirimler üst üste yığılmaz, günceller
      silent: false,
    });
    if (opts.onClick) {
      bildirim.onclick = () => { window.focus(); opts.onClick(); bildirim.close(); };
    }
    // 10 saniye sonra otomatik kapan (ekranda birikmesin)
    setTimeout(() => { try { bildirim.close(); } catch (e) {} }, 10000);
  } catch (e) { console.error('Bildirim gönderilemedi:', e); }
};
