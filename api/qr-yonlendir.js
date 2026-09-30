// api/qr-yonlendir.js
// ============================================================================
// Sembol CRM — ESKİ ASANSÖR AFİŞLERİ: "?qr=<yerId>" → WORDPRESS SAYFASI (302)
// ----------------------------------------------------------------------------
// Basılmış afişlerdeki QR'lar sembol-crm.vercel.app/?qr=<id> adresini açar.
// vercel.json bu istekleri ("?qrt=" olanlar HARİÇ) buraya yönlendirir. Neden
// doğrudan WordPress'e değil: Vercel redirect'i kaynak sorgu dizisini hedefe
// aynen ekler (…/?yer=X&qr=X) ve sitedeki sembol-qr-takip.js "?qr="yi reklam QR
// kampanya kodu sayar. Bu fonksiyon yalnızca "?yer=<id>" içeren TEMİZ adres üretir.
// (Neden rewrite değil: "/" index.html'e denk gelir; Vercel dosya sistemini
// rewrite'lardan önce kontrol ettiği için "/" üzerindeki rewrite hiç çalışmaz.)
//
// Hedef HER ZAMAN sabit sayfadır (açık yönlendirme yok). Geçersiz id'de ?yer
// olmadan aynı sayfaya gider → sayfa "Bu QR kod tanınmadı" ekranını gösterir.
// App.jsx'teki location.replace istemci tarafında yedek olarak durur.
// ============================================================================
import { QR_SITE_LANDING_URL } from '../src/qrSiteSema.js';

const KIMLIK_DESENI = /^[A-Za-z0-9_-]{1,64}$/;

export default function handler(req, res) {
  const ham = req.query && req.query.qr;
  const id = String(Array.isArray(ham) ? ham[0] : (ham || '')).trim();
  const hedef = KIMLIK_DESENI.test(id) ? `${QR_SITE_LANDING_URL}?yer=${encodeURIComponent(id)}` : QR_SITE_LANDING_URL;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', hedef);
  res.status(302).end();
}
