import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Vercel paneline şifreler girilirken yanlışlıkla konan boşluk veya tırnakları temizler
const cleanEnv = (val) => (val || '').replace(/['"]/g, '').trim();

const firebaseConfig = {
  apiKey: cleanEnv(process.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnv(process.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnv(process.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnv(process.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnv(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnv(process.env.VITE_FIREBASE_APP_ID)
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
      // Gelen veriyi güvenli bir şekilde objeye çevir
      const crmData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      
      // DİKKAT: shared.jsx dosyasında appId = "..." kısmında tam olarak ne yazıyorsa buraya onu yaz!
      const targetAppId = "sembol-crm-lokal"; 
      
      console.log("Firebase'e yazılıyor... Proje ID:", firebaseConfig.projectId, " Hedef Klasör:", targetAppId);

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
