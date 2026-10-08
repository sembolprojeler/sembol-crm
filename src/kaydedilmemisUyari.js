// src/kaydedilmemisUyari.js
// ============================================================================
// Kaydedilmemiş değişiklik koruması (2026-10-08, ilk kullanan: src/BotBilgileri.jsx)
// Sayfa, kaydedilmemiş değişiklik varken uyarı metnini ayarlar; App.jsx menü / sekme
// değişiminden (setActiveTab) önce sayfadanCikilsinMi() sorar. Sekme kapatma / yenileme
// için sayfa ayrıca "beforeunload" dinler.
// ============================================================================
let aktifUyari = null;
export const kaydedilmemisAyarla = (mesaj) => { aktifUyari = mesaj || null; };
export function sayfadanCikilsinMi(onayla = (m) => window.confirm(m)) {
  if (!aktifUyari) return true;
  if (!onayla(aktifUyari)) return false;
  aktifUyari = null;
  return true;
}
