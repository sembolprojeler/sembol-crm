// src/aiKaynakSema.js
// ============================================================================
// YAPAY ZEKA KAYNAK ŞEMASI — CRM ekranı ile /api uçlarının ORTAK tanımı
// ----------------------------------------------------------------------------
// ChatGPT / Gemini / Claude / Grok / Perplexity / Copilot'tan gelen
// ziyaretçileri sınıflandıran TEK eşleme tablosu. Sunucu (api/submit-lead.js,
// api/yeni-musteri.js) kaynağı buradan hesaplar; Müşteri Havuzu (Satis.jsx)
// etiketleri, "YAPAY ZEKA" istatistik kutularını ve kaynak filtresini yine
// buradan üretir — ikisi hiçbir zaman ayrışmaz.
//
// YENİ BİR PLATFORM / REKLAM EKLEMEK: yalnızca AI_PLATFORMLARI'na satır
// eklemek ya da bir satıra "reklam" nesnesi eklemek yeterli. Kutu, etiket,
// filtre ve geçerli reklamKaynagi değerleri otomatik çoğalır.
// (WordPress'teki kaynak scriptleri de aynı kodları — chatgpt_ads,
// gemini_organik… — üretir; yeni kod eklenirse orada da eklenmeli.)
//
// React / Firebase içermez; hem tarayıcıda hem Vercel fonksiyonunda çalışır.
// ============================================================================

// Reklam sayılan utm_medium değerleri (küçük harfle karşılaştırılır).
export const AI_REKLAM_MEDIUMLARI = ['cpc', 'ppc', 'paid', 'ads'];

// Her satır bir platform:
//   alanAdlari    → referrer'ın alan adı bunlardan biri ya da alt alan adıysa eşleşir
//   utmKaynaklari → utm_source (küçük harf) bunlardan biriyse eşleşir
//   organik       → reklam işareti yoksa yazılan kod/etiket
//   reklam        → (opsiyonel) platformun reklamı varsa. tiklamaKimligiAlani:
//                   reklam tıklama kimliğinin payload'daki/URL'deki parametre adı
//                   (boşsa okunmaz). Kimlik varsa ziyaret her zaman reklamdır.
//   kutuRenk      → istatistik kutusundaki başlık rengi (koyu zemin)
//   rozetRenk     → listedeki kaynak rozetinin rengi (açık zemin)
// DİKKAT: x.com / twitter.com bilerek Grok'a eklenmedi (X'ten gelen her ziyaret
// Grok değildir).
export const AI_PLATFORMLARI = [
  {
    id: 'chatgpt', ad: 'ChatGPT',
    alanAdlari: ['chatgpt.com', 'chat.openai.com'],
    utmKaynaklari: ['chatgpt', 'chatgpt.com', 'openai', 'chat.openai.com'],
    reklam: { kod: 'chatgpt_ads', etiket: 'ChatGPT Reklam', kutu: 'ChatGPT Ads', tiklamaKimligiAlani: '', kutuRenk: 'text-emerald-300', rozetRenk: 'bg-emerald-100 text-emerald-800' },
    organik: { kod: 'chatgpt_organik', etiket: 'ChatGPT Organik', kutu: 'ChatGPT Organik', kutuRenk: 'text-teal-300', rozetRenk: 'bg-teal-100 text-teal-700' },
  },
  {
    id: 'gemini', ad: 'Gemini',
    alanAdlari: ['gemini.google.com', 'bard.google.com'],
    utmKaynaklari: ['gemini', 'gemini.google.com', 'bard', 'bard.google.com'],
    organik: { kod: 'gemini_organik', etiket: 'Gemini Organik', kutu: 'Gemini', kutuRenk: 'text-blue-300', rozetRenk: 'bg-blue-100 text-blue-800' },
  },
  {
    id: 'claude', ad: 'Claude',
    alanAdlari: ['claude.ai'],
    utmKaynaklari: ['claude', 'claude.ai'],
    organik: { kod: 'claude_organik', etiket: 'Claude Organik', kutu: 'Claude', kutuRenk: 'text-orange-300', rozetRenk: 'bg-orange-100 text-orange-800' },
  },
  {
    id: 'grok', ad: 'Grok',
    alanAdlari: ['grok.com'],
    utmKaynaklari: ['grok', 'grok.com'],
    organik: { kod: 'grok_organik', etiket: 'Grok Organik', kutu: 'Grok', kutuRenk: 'text-neutral-200', rozetRenk: 'bg-neutral-200 text-neutral-800' },
  },
  {
    id: 'perplexity', ad: 'Perplexity',
    alanAdlari: ['perplexity.ai'],
    utmKaynaklari: ['perplexity', 'perplexity.ai'],
    organik: { kod: 'perplexity_organik', etiket: 'Perplexity Organik', kutu: 'Perplexity', kutuRenk: 'text-cyan-300', rozetRenk: 'bg-cyan-100 text-cyan-800' },
  },
  {
    id: 'copilot', ad: 'Copilot',
    alanAdlari: ['copilot.microsoft.com', 'copilot.cloud.microsoft'],
    utmKaynaklari: ['copilot', 'copilot.microsoft.com', 'copilot.cloud.microsoft'],
    organik: { kod: 'copilot_organik', etiket: 'Copilot Organik', kutu: 'Copilot', kutuRenk: 'text-violet-300', rozetRenk: 'bg-violet-100 text-violet-800' },
  },
];

// ---- Tablodan türetilen listeler ----
// İstatistik kutuları: her platformun önce reklam, sonra organik kutusu.
export const AI_ISTATISTIK_KUTULARI = AI_PLATFORMLARI.flatMap(p => [
  ...(p.reklam ? [{ kod: p.reklam.kod, ad: p.reklam.kutu, renk: p.reklam.kutuRenk, reklam: true }] : []),
  { kod: p.organik.kod, ad: p.organik.kutu, renk: p.organik.kutuRenk, reklam: false },
]);
export const AI_KAYNAK_DEGERLERI = AI_ISTATISTIK_KUTULARI.map(k => k.kod);
export const AI_REKLAM_DEGERLERI = AI_PLATFORMLARI.filter(p => p.reklam).map(p => p.reklam.kod);
// { chatgpt_ads: { ad: 'ChatGPT Reklam', renk: '…', platform: 'ChatGPT', reklam: true }, … }
export const AI_KAYNAK_ETIKETLERI = Object.fromEntries(AI_PLATFORMLARI.flatMap(p => [
  ...(p.reklam ? [[p.reklam.kod, { ad: p.reklam.etiket, renk: p.reklam.rozetRenk, platform: p.ad, reklam: true }]] : []),
  [p.organik.kod, { ad: p.organik.etiket, renk: p.organik.rozetRenk, platform: p.ad, reklam: false }],
]));
// Reklam tıklama kimliği okunacak parametre adları (yalnızca dolu olanlar).
export const AI_TIKLAMA_KIMLIGI_ALANLARI = AI_PLATFORMLARI
  .filter(p => p.reklam && p.reklam.tiklamaKimligiAlani)
  .map(p => ({ platform: p.id, alan: p.reklam.tiklamaKimligiAlani }));

export const aiKaynakMi = (kod) => AI_KAYNAK_DEGERLERI.includes(kod);

// "https://chatgpt.com/c/..." ya da çıplak "chatgpt.com" → "chatgpt.com"
export function alanAdiCoz(deger) {
  const s = String(deger || '').trim().toLowerCase();
  if (!s) return '';
  try { return new URL(s.includes('://') ? s : `https://${s}`).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function alanAdiPlatformu(host) {
  if (!host) return null;
  return AI_PLATFORMLARI.find(p => p.alanAdlari.some(d => host === d || host.endsWith(`.${d}`))) || null;
}

function sonuc(platform, reklam, yontem) {
  const hedef = reklam && platform.reklam ? platform.reklam : platform.organik;
  return { kod: hedef.kod, platform: platform.id, reklam: hedef === platform.reklam, yontem };
}

// Ziyaretin yapay zeka kaynağını bulur; eşleşme yoksa null (mevcut mantık çalışır).
// girdi: { utmSource, utmMedium, referrer, tiklamaKimlikleri: { chatgpt: '…' } }
// Öncelik: 1) reklam tıklama kimliği  2) utm_source (+ medium reklamsa reklam)
//          3) referrer alan adı (referrer tek başına reklam sayılmaz)
export function aiKaynakSiniflandir(girdi) {
  const g = girdi || {};
  const kimlikler = g.tiklamaKimlikleri || {};
  const kimlikli = AI_PLATFORMLARI.find(p => p.reklam && kimlikler[p.id]);
  if (kimlikli) return sonuc(kimlikli, true, 'tiklama_kimligi');

  const utmSource = String(g.utmSource || '').trim().toLowerCase();
  if (utmSource) {
    const p = AI_PLATFORMLARI.find(x => x.utmKaynaklari.includes(utmSource));
    if (p) {
      const reklamMedium = AI_REKLAM_MEDIUMLARI.includes(String(g.utmMedium || '').trim().toLowerCase());
      return sonuc(p, reklamMedium, reklamMedium && p.reklam ? 'utm_reklam' : 'utm');
    }
  }

  const p = alanAdiPlatformu(alanAdiCoz(g.referrer));
  if (p) return sonuc(p, false, 'referrer');
  return null;
}
