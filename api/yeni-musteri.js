import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// ŞİFRELER DİREKT SENİN DOSYANDAN ALINDI, ARTIK HATA VERME ŞANSI YOK!
const firebaseConfig = {
  apiKey: "AIzaSyD8ofu_2rZwJeHWftmr6STilgF_qjO3LVI",
  authDomain: "sembol-operasyon-merkezi.firebaseapp.com",
  projectId: "sembol-operasyon-merkezi",
  storageBucket: "sembol-operasyon-merkezi.firebasestorage.app",
  messagingSenderId: "1054049299174",
  appId: "1:1054049299174:web:2193f916a3501543d92927"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const crmData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      
      // SENİN SİSTEMİNİN GERÇEK HEDEF KLASÖR ADI
      const targetAppId = "sembol-crm-lokal"; 
      
      const dbPath = collection(db, 'artifacts', targetAppId, 'public', 'data', 'havuzKayitlari');
      
      const suAnkiTarih = new Date().toISOString();
      const kanalTipi = (crmData.islem || "").includes('WhatsApp') ? 'whatsapp' : 'telefon';

      await addDoc(dbPath, {
        musteriAdi: crmData.kaynak === 'google_ads' ? "Google Ads Ziyaretçisi" : "Organik Ziyaretçi",
        iletisim: "Tıklama (Bekleniyor)", 
        kanal: kanalTipi,
        hesapId: crmData.site || "Web Sitesi",
        hizmetTipi: "Belirsiz",
        durum: "Yeni",
        sonMesaj: crmData.kaynak === 'google_ads' ? "Google reklamlarından tıklama geldi" : "Normal siteden tıklama geldi",
        createdAt: suAnkiTarih, 
        hareketler: [
           { tarih: suAnkiTarih, kullanici: 'Sistem API', islem: `Ziyaretçi siteden ${kanalTipi} butonuna tıkladı.` }
        ]
      });

      res.status(200).json({ success: true, message: 'Harika, müşteri CRM havuzuna düştü!' });
    } catch (error) {
      console.error("Firebase Yazma Hatası:", error);
      res.status(500).json({ success: false, error: 'Sunucu hatası', detay: error.message });
    }
  } else {
    res.status(405).json({ message: 'Sadece POST metoduna izin verilir' });
  }
}
