// src/botBilgiSema.js
// ============================================================================
// Sembol CRM — WHATSAPP BOT BİLGİ BANKASI (2026-10-08) — SAF ORTAK MODÜL
// ----------------------------------------------------------------------------
// Kullananlar: src/BotBilgileri.jsx (Sistem Dosyaları > Bot Bilgileri), api/whatsapp-send.js
// (botBilgiKaydet / botBilgiGeriAl / botBilgiDene), api/_lib/botBilgi.js (webhook okuması),
// api/_lib/botTalimatlari.js (yedek metin = ilk içerik). React / Firebase / Node bağımlılığı YOK.
//
// Firestore (yalnızca sunucu yazar — firestore.rules sunucuKorumali "bot_bilgi/.+"):
//   artifacts/{appId}/public/data/bot_bilgi/{marka}                 → güncel içerik
//   artifacts/{appId}/public/data/bot_bilgi/{marka}/surumler/{id}   → son 10 sürüm
// İçerik: { bolumler: { firma: '…', subeler: '…', … }, sss: [{ soru, cevap }] }
//
// Bilgi bankası yalnızca markanın BİLGİ bloğunun yerine geçer. Temel kurallar (KVKK, devir
// türleri, hizmet reddi koruması, 81 il, taşıma akışı, günlük sınır, "+KDV", "uydurma") kodda
// kalır; yönetici silemez. Fiyat rakamları Fiyat Tablosu'ndan gelir: buraya yazılan TL tutarları
// bota gitmeden gizlenir (tutarlariGizle).
// ============================================================================

export const BOT_BILGI_MARKALARI = [
  { id: 'depoevim', ad: 'DepoEvim', aktif: true },
  { id: 'sembol', ad: 'Sembol', aktif: false }, // ileride
];
export const botBilgiMarkasiGecerliMi = (m) => BOT_BILGI_MARKALARI.some(x => x.id === m && x.aktif);

// SSS ayrı bir listedir (bolumler içinde değil)
export const BOT_BILGI_BOLUMLERI = [
  { id: 'firma', baslik: 'Firma', ipucu: 'Kim olduğumuz, hizmetler, iletişim' },
  { id: 'subeler', baslik: 'Şubeler ve ziyaret saatleri', ipucu: 'Adresler, çalışma / ziyaret saatleri, randevu' },
  { id: 'depoBoyutlari', baslik: 'Depo boyutları ve fiyat açıklamaları', ipucu: 'Boyutlar, ölçüler; fiyatın neye göre değiştiği (rakam değil)' },
  { id: 'kurallar', baslik: 'Kurallar', ipucu: 'En kısa süre, yasaklı eşyalar, sigorta, sözleşme' },
  { id: 'odeme', baslik: 'Ödeme', ipucu: 'Ödeme yöntemleri, kampanya koşulları' },
  { id: 'nakliye', baslik: 'Nakliye / anahtar teslim', ipucu: 'Adresten alım, paketleme, teslim' },
  { id: 'sss', baslik: 'Sık sorulan sorular', ipucu: 'Soru + cevap', liste: true },
  { id: 'asla', baslik: 'Asla söyleme / söz verme', ipucu: 'Botun kesinlikle söylememesi, söz vermemesi gerekenler' },
  { id: 'diger', baslik: 'Diğer bilgiler', ipucu: 'Başka bir bölüme uymayanlar' },
];
export const METIN_BOLUMLERI = BOT_BILGI_BOLUMLERI.filter(b => !b.liste).map(b => b.id);

// Maliyet sınırı: bu metin her bot çağrısında gider (bir müşteri mesajında 3 çağrıya kadar)
export const BOT_BILGI_SINIRLARI = { toplam: 12000, bolum: 4000, sssAdet: 50, soru: 300, cevap: 1000 };
export const SURUM_SAYISI = 10;
export const WORD_SINIRI = 5 * 1024 * 1024;
export const FIYAT_NOTU = "Fiyat rakamları Fiyat Tablosu'ndan gelir; buraya yazılan rakamlar bot tarafından söylenmez.";

// ------------------------------------------------------------------ İLK İÇERİK
// botTalimatlari.js'deki 2026-10-08 öncesi sabit DepoEvim bilgisi, bölümlere ayrılmış hâli.
// Bilgi bankası boşken / okunamazken bot bunu kullanır (api/_lib/botTalimatlari.js).
const DEPOEVIM_ILK = {
  bolumler: {
    firma: [
      "- 2004'ten beri nakliyat, 2015'ten beri DepoEvim markasıyla depolama. K3 yetki belgeli.",
      '- Telefon: 0545 240 84 61 · info@depoevim.com',
      '- 7/24 kamera, kişiye özel kilitli oda, rutubetsiz/iklimlendirilmiş, düzenli ilaçlama.',
      '- İKİ AYRI HİZMET — karıştırma:',
      '  1) EŞYA DEPOLAMA (anahtar teslim): firma eşyayı adresten alır, paketler, depoya taşır. Aylık kira + bir defalık alım/nakliye ücreti.',
      '  2) KİRALIK DEPO (bireysel depo kiralama): müşteri eşyasını kendisi getirir; depoya erişim RANDEVU ile. Yalnızca aylık kira.',
    ].join('\n'),
    subeler: [
      '- Şubeler (İstanbul): Kartal (Yalı Mh. Bağlar Cd. No:74/2), Ümraniye (Dudullu OSB Mh. 1. Cd. No:30/4), Çekmeköy (Ekşioğlu Mah. Atabey Cad. No:28/2), Başakşehir (Atatürk Blv. No:98 Kat:2, Avrupa Yakası), Pendik (Bahçelievler Mah. Yeni Sok. No:5 C).',
      '- Gebze şubesi "yakında" — henüz hizmet vermiyor.',
      '- Çalışma saatleri: hafta içi 09:00–18:00. Kiralık depoya erişim randevu ile.',
    ].join('\n'),
    depoBoyutlari: [
      '- Depo boyutları: 1+0 = 10 m³ (2×1,7×3 m), 1+1 = 15 m³ (2×2,5×3 m), 2+1 = 22 m³ (3×2,5×3 m), 3+1 = 30 m³ (4×2,5×3 m).',
      '- Daha büyük/özel hacim ve kurumsal depolama için ekip teklif verir (devret).',
      '- Aylık kira yalnızca muhafaza + sigorta bedelidir.',
    ].join('\n'),
    kurallar: [
      '- Taahhüt yok, sözleşmeli ve faturalı.',
      '- Allianz sigortalı (doğal afet, su baskını, yangın, hırsızlık).',
      '- İş yeri / ticari eşya, her gün giriş-çıkış yapılacak ticari kullanım, kurumsal arşiv → ekibe devret.',
    ].join('\n'),
    odeme: [
      '- Kampanya (gerçek): 6 ay peşin ödemede 1 ay, 12 ay peşin ödemede 2 ay hediye.',
      '- Aylık ödemeler IBAN ile; kredi kartı yalnızca kampanyalı toplu ödemede.',
      '- Online kiralama sayfası: https://www.depoevim.com/depo-fiyatlarimiz/ (müşteri isterse önerebilirsin).',
    ].join('\n'),
    nakliye: [
      '- Paketleme ve alım nakliyesi kiradan ayrıdır, bir defaya mahsus hesaplanır.',
      "- Eşyalar Türkiye'nin her ilinden alınabilir (alım ücreti mesafeye göre hesaplanır); depolar İstanbul'dadır. Alım adresi İstanbul dışı diye reddetme.",
    ].join('\n'),
    asla: [
      '- Ödeme ALMAZSIN, ödeme / kart bilgisi isteme.',
      '- Gebze şubesi için hizmet sözü verme.',
    ].join('\n'),
    diger: '',
  },
  sss: [],
};
export function varsayilanBotBilgi(marka = 'depoevim') {
  const bos = { bolumler: Object.fromEntries(METIN_BOLUMLERI.map(id => [id, ''])), sss: [] };
  if (marka !== 'depoevim') return bos;
  return { bolumler: { ...bos.bolumler, ...DEPOEVIM_ILK.bolumler }, sss: DEPOEVIM_ILK.sss.map(x => ({ ...x })) };
}

// ------------------------------------------------------------------ SAYAÇ / KARŞILAŞTIRMA
export function karakterSayisi(icerik = {}) {
  const b = icerik.bolumler || {};
  return METIN_BOLUMLERI.reduce((t, id) => t + String(b[id] || '').length, 0)
    + (icerik.sss || []).reduce((t, x) => t + String(x?.soru || '').length + String(x?.cevap || '').length, 0);
}
export const icerikBosMu = (icerik) => !icerik || karakterSayisi(icerik) === 0;
const sade = (icerik = {}) => ({
  bolumler: Object.fromEntries(METIN_BOLUMLERI.map(id => [id, String(icerik.bolumler?.[id] || '')])),
  sss: (icerik.sss || []).map(x => ({ soru: String(x?.soru || ''), cevap: String(x?.cevap || '') })),
});
export const iceriklerEsitMi = (a, b) => JSON.stringify(sade(a)) === JSON.stringify(sade(b));

// ------------------------------------------------------------------ DOĞRULAMA (sunucu + tarayıcı)
// Bilinmeyen alan, yanlış tür ya da sınır aşımı → { ok: false, hata }. Metinler kırpılır, satır sonları "\n".
const temizMetin = (s) => String(s).replace(/\r\n?/g, '\n').replace(/[^\P{Cc}\n\t]/gu, '').trim(); // satır sonu / sekme dışındaki kontrol karakterleri
export function botBilgiDogrula(ham) {
  const S = BOT_BILGI_SINIRLARI;
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return { ok: false, hata: 'İçerik geçersiz.' };
  const fazla = Object.keys(ham).filter(k => !['bolumler', 'sss'].includes(k));
  if (fazla.length) return { ok: false, hata: `Bilinmeyen alan: ${fazla.join(', ')}` };
  const b = ham.bolumler ?? {};
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, hata: 'Bölümler geçersiz.' };
  const bilinmeyen = Object.keys(b).filter(k => !METIN_BOLUMLERI.includes(k));
  if (bilinmeyen.length) return { ok: false, hata: `Bilinmeyen bölüm: ${bilinmeyen.join(', ')}` };
  const bolumler = {};
  for (const id of METIN_BOLUMLERI) {
    const v = b[id] ?? '';
    if (typeof v !== 'string') return { ok: false, hata: `"${id}" bölümü metin olmalı.` };
    const t = temizMetin(v);
    if (t.length > S.bolum) return { ok: false, hata: `"${BOT_BILGI_BOLUMLERI.find(x => x.id === id).baslik}" bölümü en fazla ${S.bolum} karakter olabilir.` };
    bolumler[id] = t;
  }
  const s = ham.sss ?? [];
  if (!Array.isArray(s)) return { ok: false, hata: 'SSS listesi geçersiz.' };
  if (s.length > S.sssAdet) return { ok: false, hata: `En fazla ${S.sssAdet} soru eklenebilir.` };
  const sss = [];
  for (const x of s) {
    if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).some(k => !['soru', 'cevap'].includes(k))
      || typeof (x.soru ?? '') !== 'string' || typeof (x.cevap ?? '') !== 'string') return { ok: false, hata: 'SSS maddesi geçersiz.' };
    const soru = temizMetin(x.soru ?? ''), cevap = temizMetin(x.cevap ?? '');
    if (soru.length > S.soru || cevap.length > S.cevap) return { ok: false, hata: `SSS: soru en fazla ${S.soru}, cevap en fazla ${S.cevap} karakter.` };
    if (soru || cevap) sss.push({ soru, cevap });
  }
  const icerik = { bolumler, sss };
  const toplam = karakterSayisi(icerik);
  if (toplam > S.toplam) return { ok: false, hata: `Toplam ${toplam} karakter; sınır ${S.toplam}.` };
  return { ok: true, icerik, toplam };
}

// ------------------------------------------------------------------ BOTA GİDEN METİN
// TL tutarları bota hiç ulaşmaz (fiyat yalnızca Fiyat Tablosu'ndan; 1.000 altı tutarlar da)
const TUTAR = /(?:₺\s*\d[\d.,]*|\d[\d.,]*\s*(?:TL|TRY|₺|türk\s+lirası|lira(?:sı|dır|ya)?)(?![\p{L}]))/giu;
export const FIYAT_YER_TUTUCU = "[fiyat: Fiyat Tablosu'ndan]";
export const tutarlariGizle = (metin) => String(metin || '').replace(TUTAR, FIYAT_YER_TUTUCU);

export function botBilgiMetni(icerik) {
  if (icerikBosMu(icerik)) return '';
  const parcalar = [];
  for (const bolum of BOT_BILGI_BOLUMLERI) {
    if (bolum.liste) {
      const sss = (icerik.sss || []).filter(x => x.soru && x.cevap);
      if (sss.length) parcalar.push(`[${bolum.baslik}]\n${sss.map(x => `S: ${x.soru}\nC: ${x.cevap}`).join('\n')}`);
      continue;
    }
    const t = String(icerik.bolumler?.[bolum.id] || '').trim();
    if (!t) continue;
    parcalar.push(bolum.id === 'asla' ? `[${bolum.baslik.toLocaleUpperCase('tr-TR')} — KESİN KURAL]\n${t}` : `[${bolum.baslik}]\n${t}`);
  }
  return tutarlariGizle(parcalar.join('\n'));
}

// ------------------------------------------------------------------ SAYFA YETKİSİ
// Bu sayfaya ÖZEL (yoneticiMi'den farklı: canEdit AÇMAZ). Sunucu da aynı fonksiyonu kullanır.
export function botBilgiYetkisi(p) {
  if (!p || p.employmentStatus === 'Pasif' || p.permissions?.canView === false) return false;
  return p.fullName === 'Sistem Yöneticisi' || p.position === 'Firma Sahibi' || p.rank === 'Müdür' || String(p.position || '').includes('Yönetici');
}

// ------------------------------------------------------------------ WORD → BÖLÜMLER
// bloklar: [{ tur: 'baslik' | 'paragraf', metin }] (tarayıcı mammoth HTML'inden üretir)
const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/[çğıöşüâîû]/g, h => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[h])
  .replace(/[^a-z0-9³]+/g, ' ').trim();
// Sıra önemli: ilk eşleşen kazanır ("asla" kurallardan, "sss" depo fiyatından önce)
const ESLEME = [
  ['sss', ['sik sorulan', 'sss', 'soru cevap', 'sorular']],
  ['asla', ['asla', 'soz verme', 'soyleme', 'soylenmeyecek']],
  ['subeler', ['sube', 'ziyaret', 'adres', 'calisma saat', 'saatler']],
  ['depoBoyutlari', ['boyut', 'olcu', 'm3', 'm³', 'fiyat aciklama', 'depo tip', 'hacim']],
  ['kurallar', ['kural', 'yasak', 'sigorta', 'sozlesme', 'en kisa', 'kosul']],
  ['odeme', ['odeme', 'kampanya', 'iban', 'kredi kart', 'fatura']],
  ['nakliye', ['nakliye', 'anahtar teslim', 'tasima', 'alim', 'paketleme', 'teslim']],
  ['firma', ['firma', 'hakkimizda', 'hakkinda', 'kurumsal', 'genel bilgi', 'iletisim']],
  ['diger', ['diger']],
];
export function bolumEsle(baslik) {
  const n = norm(baslik).replace(/^\d+\s*/, '');
  if (!n) return null;
  const tam = BOT_BILGI_BOLUMLERI.find(b => norm(b.baslik) === n);
  if (tam) return tam.id;
  for (const [id, anahtarlar] of ESLEME) if (anahtarlar.some(a => n.includes(a))) return id;
  return null;
}
const SORU = /^\s*(?:soru|s)\s*[:.)-]\s*(.*)$/i;
const CEVAP = /^\s*(?:cevap|yanıt|c)\s*[:.)-]\s*(.*)$/i;
// Word başlık stili kullanılmamışsa kısa paragraf başlık sayılır, ama YALNIZCA ":" ile bitiyorsa
// ("Ödeme:") ya da (numarasız hâli) bir bölüm adıyla birebir aynıysa ("3) Kurallar") — ve bir bölüme eşleşirse.
// ("Kartal şubesi" gibi içerik satırları başlık sayılmaz.)
const numarasiz = (metin) => norm(metin).replace(/^\d+\s*/, '');
const baslikGibiMi = (metin) => metin.length <= 60 && !SORU.test(metin) && !CEVAP.test(metin)
  && (/:$/.test(metin) || BOT_BILGI_BOLUMLERI.some(b => norm(b.baslik) === numarasiz(metin)));

export function wordBloklariniDagit(bloklar = []) {
  const bolumler = Object.fromEntries(METIN_BOLUMLERI.map(id => [id, []]));
  const sss = [];
  let simdiki = 'diger', acikSoru = null, sonCevap = false;
  const soruKapat = () => { if (acikSoru && (acikSoru.soru || acikSoru.cevap)) sss.push(acikSoru); acikSoru = null; sonCevap = false; };
  for (const b of bloklar) {
    // Tanıma (başlık / SSS) kırpılmış metinle; bölüme yazılan satır girintisini korur
    const ham = String(b?.metin || '').replace(/\s+$/, '');
    const girinti = ham.match(/^[ \t\u00a0]*/)[0].replace(/\t/g, '  ').replace(/\u00a0/g, ' ');
    const metin = ham.replace(/\s+/g, ' ').trim();
    if (!metin) continue;
    const satir = girinti + metin;
    const eslesen = b.tur === 'baslik' || baslikGibiMi(metin) ? bolumEsle(metin.replace(/:$/, '')) : null;
    if (eslesen || b.tur === 'baslik') {
      soruKapat();
      simdiki = eslesen || 'diger';
      if (!eslesen) bolumler.diger.push(`${metin}:`); // tanınmayan başlık bağlamıyla "Diğer"e
      continue;
    }
    const s = metin.match(SORU), c = metin.match(CEVAP);
    if (s) { soruKapat(); acikSoru = { soru: s[1].trim(), cevap: '' }; continue; }
    if (c && acikSoru) { acikSoru.cevap = [acikSoru.cevap, c[1].trim()].filter(Boolean).join(' '); sonCevap = true; continue; }
    if (simdiki === 'sss') {
      // SSS bölümünde kalıpsız yazım: "?" ile biten satır soru, sonraki satırlar cevap
      if (/\?$/.test(metin)) { soruKapat(); acikSoru = { soru: metin, cevap: '' }; continue; }
      if (acikSoru) { acikSoru.cevap = [acikSoru.cevap, metin].filter(Boolean).join(' '); sonCevap = true; continue; }
      bolumler.diger.push(satir);
      continue;
    }
    if (acikSoru && sonCevap) { acikSoru.cevap += ` ${metin}`; continue; }
    soruKapat();
    bolumler[simdiki].push(satir);
  }
  soruKapat();
  return { bolumler: Object.fromEntries(Object.entries(bolumler).map(([id, satirlar]) => [id, satirlar.join('\n')])), sss };
}

// mammoth HTML'i → bloklar (DOM gerekmez; mammoth çıktısı sade: h1-6, p, ul/ol/li, table, strong, a, br)
const VARLIK = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const varlikCoz = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (t, k) => (k[0] === '#'
  ? String.fromCodePoint(k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : Number(k.slice(1))) : VARLIK[k.toLowerCase()] ?? t));
export function htmlBloklari(html = '') {
  const metin = String(html)
    // Tablo hücresi tek satırda kalsın: hücre içindeki paragraflar boşlukla birleşir, hücreler " | " ile
    .replace(/<t([dh])\b[^>]*>([^]*?)<\/t\1>/gi, (_, __, ic) => `${ic.replace(/<\/?p\b[^>]*>/gi, ' ')} | `)
    .replace(/<h[1-6]\b[^>]*>/gi, '\n\u0001')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>|<\/(?:h[1-6]|p|li|tr|ul|ol|table|div)>|<(?:p|tr|ul|ol|table|div)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  // Satır başı girintisi KORUNUR (sekme = 2 boşluk); satır içindeki boşluk dizileri teke iner
  return varlikCoz(metin).split('\n').map(s => {
    const bas = s.match(/^[ \t\u00a0]*/)[0];
    const govde = s.slice(bas.length).replace(/[ \t\u00a0]+/g, ' ').replace(/(?:\s*\|\s*)+$/, '').trimEnd();
    return govde ? bas.replace(/\t/g, '  ').replace(/\u00a0/g, ' ') + govde : '';
  })
    .filter(s => s && s !== '\u0001')
    .map(s => (s.startsWith('\u0001') ? { tur: 'baslik', metin: s.slice(1).trim() } : { tur: 'paragraf', metin: s }));
}

// ------------------------------------------------------------------ TASLAK BİRLEŞTİRME
// secimler: { [bolumId | 'sss']: 'degistir' | 'ekle' | 'yoksay' } — gelen boşsa mevcut kalır
export function taslakBirlestir(mevcut, gelen, secimler = {}) {
  const sonuc = { bolumler: { ...(mevcut.bolumler || {}) }, sss: [...(mevcut.sss || [])] };
  for (const id of METIN_BOLUMLERI) {
    const g = String(gelen.bolumler?.[id] || '').trim();
    const m = String(mevcut.bolumler?.[id] || '').trim();
    if (!g) continue;
    if (secimler[id] === 'degistir') sonuc.bolumler[id] = g;
    else if (secimler[id] === 'ekle') sonuc.bolumler[id] = m ? `${m}\n${g}` : g;
  }
  const gs = gelen.sss || [];
  if (gs.length && secimler.sss === 'degistir') sonuc.sss = gs.map(x => ({ ...x }));
  else if (gs.length && secimler.sss === 'ekle') sonuc.sss = [...sonuc.sss, ...gs.map(x => ({ ...x }))];
  return sonuc;
}
// Word'den gelenle mevcut arasında fark olan bölümler (taslak ekranı yalnızca bunları gösterir)
// Karşılaştırmada boşluk farkları (girinti, satır sonu, çift boşluk) YOK SAYILIR — yalnızca girintisi farklı bölüm "farklı" değildir
const bosluksuz = (x) => String(x || '').replace(/\s+/g, ' ').trim();
const sssBosluksuz = (liste = []) => JSON.stringify(liste.map(x => [bosluksuz(x?.soru), bosluksuz(x?.cevap)]));
export function farkliBolumler(mevcut, gelen) {
  const farklar = METIN_BOLUMLERI.filter(id => bosluksuz(gelen.bolumler?.[id]) && bosluksuz(gelen.bolumler[id]) !== bosluksuz(mevcut.bolumler?.[id]));
  if ((gelen.sss || []).length && sssBosluksuz(gelen.sss) !== sssBosluksuz(mevcut.sss || [])) farklar.push('sss');
  return farklar;
}

// Word dosyasının crm/uploads adı: botbilgi_<marka>_<YYYYMMDD-HHMM>_<rastgele>.docx
export function wordDosyaAdi(marka, ms = Date.now(), rastgele = Math.random().toString(36).slice(2, 10)) {
  const t = new Date(ms).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  return `botbilgi_${String(marka).replace(/[^a-z]/g, '')}_${t}_${String(rastgele).replace(/[^a-z0-9]/gi, '').slice(0, 12)}.docx`;
}
