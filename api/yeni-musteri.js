import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Çift tetiklenmeyi engelleyen kod
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
      const crmData = req.body;
      
      // SEMBOL İÇİN SABİTLENMİŞ APP ID (Vercel'de undefined hatası vermemesi için)
      // Not: Eğer shared.jsx dosyasında appId "sembol" yazıyorsa burayı "sembol" yaparsın.
      const targetAppId = "sembol-crm"; 
      
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
      console.error("Hata:", error);
      res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
  } else {
    res.status(405).json({ message: 'Sadece POST metoduna izin verilir' });
  }
}
