// src/goruntuleyici.js
// ============================================================================
// App.jsx'teki ortak görsel/dosya görüntüleyicisinin (viewingImage) girdisini okur.
// Bütün ekranlar setViewingImage({ title, name }) ile çağırır; "name" = dosya adresi.
// YENİ (2026-10-07): name eksik / dize değilse (ör. yanlışlıkla düz URL verilmişse)
// CRM çökmesin diye güvenli okuma. { title, name: 'http…' } girdileri için davranış AYNI.
// ============================================================================
export function goruntuleyiciBilgisi(v) {
  const adres = typeof v === 'string' ? v : (typeof v?.name === 'string' ? v.name : '');
  return { baslik: typeof v?.title === 'string' ? v.title : '', adres, http: adres.startsWith('http') };
}
