// src/whatsappPanel.js
// ============================================================================
// CRM WhatsApp paneli — SAF yardımcılar (React / Firebase yok; node --test ile denenir)
// src/WhatsApp.jsx, src/App.jsx (menü rozeti) ve src/Satis.jsx (lead → sohbet) kullanır.
// ============================================================================

// Müşterinin son mesajından sonra serbest metin gönderme süresi (Meta kuralı)
export const PENCERE_MS = 24 * 60 * 60 * 1000;
export const PENCERE_UYARISI = '24 saat geçti, müşteri yazınca cevap verebilirsiniz (şablon mesaj sonraki aşamada).';
export const SIFRE_YOK_MESAJI = 'Panelden mesaj göndermek için kullanıcı adı ve şifreyle giriş yapın.';

export const pencereAcikMi = (k, simdi = Date.now()) => {
  const t = Date.parse(k?.lastCustomerMessageAt || '');
  return !!t && simdi - t <= PENCERE_MS;
};
// Kalan süre metni: "3 sa 12 dk" | "" (kapalıysa)
export function pencereKalan(k, simdi = Date.now()) {
  const t = Date.parse(k?.lastCustomerMessageAt || '');
  if (!t) return '';
  const kalan = PENCERE_MS - (simdi - t);
  if (kalan <= 0) return '';
  const sa = Math.floor(kalan / 3600000), dk = Math.floor((kalan % 3600000) / 60000);
  return sa ? `${sa} sa ${dk} dk` : `${dk} dk`;
}

// Hat → marka etiketi (konuşmadaki marka alanı; eski belgelerde boş olabilir → DepoEvim/0850)
export const MARKA_ETIKETI = { depoevim: 'DepoEvim', sembol: 'Sembol' };
export const konusmaMarkasi = (k) => k?.marka === 'sembol' ? 'sembol' : 'depoevim';

// YENİ (2026-10-08): kullanıcı adıyla yazan müşteri (Meta telefon göndermedi; waId = BSUID "TR.1349…")
const bsuidMi = (x) => /^[A-Z]{2}\./.test(String(x || ''));
export const kullaniciAdiylaMi = (k) => !k?.phone && (k?.kullaniciAdiyla === true || bsuidMi(k?.waId));
// Aranabilir telefon rakamları ('' → telefon yok; BSUID asla telefon sayılmaz)
export const musteriTelefonu = (k) => String(k?.phone || (bsuidMi(k?.waId) ? '' : k?.waId) || '').replace(/\D/g, '');
export const musteriAdi = (k) => k?.profileName || (k?.username ? `@${k.username}` : '') || 'WhatsApp Müşterisi';
// Adın altındaki satır: telefon ya da "@kullanici · Kullanıcı adıyla yazdı"
export function musteriAltSatiri(k) {
  if (!kullaniciAdiylaMi(k)) return k?.phone || k?.waId || '';
  return k?.username ? `@${k.username} · Kullanıcı adıyla yazdı` : 'Kullanıcı adıyla yazdı';
}

export const bekliyorMu = (k) => k?.needsAgent === true;
export const bekleyenSayisi = (liste = []) => liste.filter(bekliyorMu).length;

// Liste: personel bekleyenler en üstte, sonra son mesaja göre (yeni → eski)
// filtre: { marka: 'tumu'|'depoevim'|'sembol', mod: 'tumu'|'bot'|'human'|'bekleyen', arama }
export function konusmalariSuz(liste = [], { marka = 'tumu', mod = 'tumu', arama = '' } = {}) {
  const q = String(arama || '').trim().toLocaleLowerCase('tr-TR');
  const qRakam = q.replace(/\D/g, '');
  return liste
    .filter(k => marka === 'tumu' || konusmaMarkasi(k) === marka)
    .filter(k => mod === 'tumu' || (mod === 'bekleyen' ? bekliyorMu(k) : (k.mode || 'bot') === mod))
    .filter(k => !q || String(k.profileName || '').toLocaleLowerCase('tr-TR').includes(q)
      || String(k.username || '').toLocaleLowerCase('tr-TR').includes(q.replace(/^@/, ''))
      || (qRakam.length >= 3 && (String(k.waId || '').includes(qRakam) || String(k.phone || '').replace(/\D/g, '').includes(qRakam))))
    .sort((a, b) => (bekliyorMu(b) - bekliyorMu(a)) || String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')));
}

// Mesaj balonu: kimden + gösterilecek metin + (konumsa) harita linki.
// Medya indirme/önizleme yok (sonraki aşama): webhook metni "[görsel] …" gibi etiketli yazar.
const MEDYA_ETIKETI = { image: '[görsel]', audio: '[sesli mesaj]', video: '[video]', document: '[belge]', sticker: '[çıkartma]', location: '[konum]', contacts: '[kişi kartı]', reaction: '[tepki]' };
export function mesajGorunumu(m = {}) {
  const kimden = m.from === 'customer' ? 'musteri' : m.from === 'agent' ? 'personel' : 'bot';
  let metin = String(m.text || '');
  const etiket = MEDYA_ETIKETI[m.type];
  if (etiket && !metin.startsWith(etiket.slice(0, -1))) metin = `${etiket}${metin ? ` ${metin}` : ''}`;
  if (!metin) metin = etiket || '[boş mesaj]';
  const lat = Number(m.konum?.lat), lng = Number(m.konum?.lng);
  const harita = m.type === 'location' && Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)
    ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  const ad = kimden === 'musteri' ? '' : kimden === 'personel' ? (m.agentName || 'Personel') : (m.agentName || 'Bot');
  return { kimden, metin, harita, ad, medya: !!etiket, otomatik: !!m.otomatik };
}

// YENİ (2026-10-07): medya (crm/uploads) — panelde nasıl gösterilecek?
//  durum: 'hazir' (oynat / önizle / indir) · 'bekliyor' (yükleniyor…) · 'hata' · 'yok' (eski mesaj: hiç alınmamış)
//  getirilebilir: "Medyayı getir" düğmesi gösterilsin mi (süresi dolmuşsa HAYIR)
//  Webhook işi yarıda kaldıysa 'bekliyor' 2 dakikadan uzun sürer → getirilebilir.
const MEDYA_TURU = { image: 'gorsel', audio: 'ses', video: 'video', document: 'belge' };
export function medyaGorunumu(m = {}, simdi = Date.now()) {
  const tur = MEDYA_TURU[m.type];
  if (!tur || (!m.mediaId && !m.medya?.url)) return null;
  const md = m.medya || {};
  const durum = md.url && md.durum === 'hazir' ? 'hazir' : md.durum === 'bekliyor' ? 'bekliyor' : md.durum === 'hata' ? 'hata' : 'yok';
  const suresiDoldu = md.hataTuru === 'suresi_doldu';
  const takildi = durum === 'bekliyor' && simdi - (Date.parse(m.alindi || m.timestamp || '') || simdi) > 2 * 60 * 1000;
  return {
    tur, durum, url: md.url || null, mimeType: md.mimeType || '', boyut: Number(md.boyut) || 0,
    dosyaAdi: md.dosyaAdi || '', caption: md.caption || '', hata: m.medyaHata || '', suresiDoldu,
    getirilebilir: !!m.mediaId && !suresiDoldu && (durum === 'yok' || durum === 'hata' || takildi),
  };
}
export const boyutMetni = (n) => (!n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Gönderim durumu (yalnızca giden mesajlar)
export function durumBilgisi(m = {}) {
  if (m.direction !== 'out' && m.from === 'customer') return null;
  switch (m.status) {
    case 'read': return { simge: '✓✓', renk: 'text-sky-500', baslik: 'Okundu' };
    case 'delivered': return { simge: '✓✓', renk: 'text-neutral-400', baslik: 'İletildi' };
    case 'sent': return { simge: '✓', renk: 'text-neutral-400', baslik: 'Gönderildi' };
    case 'failed': return { simge: '!', renk: 'text-red-600', baslik: `Gönderilemedi${m.hata?.mesaj ? `: ${m.hata.mesaj}` : ''}` };
    default: return { simge: '…', renk: 'text-neutral-300', baslik: 'Gönderiliyor' };
  }
}

// Sekme başlığı: panel açıkken okunmamış ya da personel bekleyen konuşma sayısı
export const dikkatSayisi = (liste = []) => liste.filter(k => Number(k.unreadCount) > 0 || bekliyorMu(k)).length;
export const sekmeBasligi = (n, taban = 'WhatsApp – CRM') => (n > 0 ? `(${n}) ${taban}` : taban);

// Lead bot hattından mı geldi? → CRM sohbetinin konuşma kimliği, değilse null (wa.me kalır)
export function botLeadKonusmaId(lead) {
  if (!lead || lead.kayitTipi !== 'whatsapp-bot') return null;
  return lead.whatsapp?.konusmaId || lead.whatsapp?.waId || null;
}

// Liste saati: bugün → "14:05", dün → "Dün", daha eski → "05.10"
export function listeSaati(isoZaman, simdi = Date.now()) {
  const t = new Date(isoZaman || '');
  if (Number.isNaN(t.getTime())) return '';
  const gun = (d) => d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const bugun = new Date(simdi);
  if (gun(t) === gun(bugun)) return t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
  if (gun(t) === gun(new Date(simdi - 86400000))) return 'Dün';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Istanbul' }).formatToParts(t).map(x => [x.type, x.value]));
  return `${p.day}.${p.month}`;
}

// WhatsApp paneli yetkisi — App.jsx altSatisErisimi('satisWhatsapp') ve sunucu (api/_lib/crmYetki.js)
// ile AYNI kural. App'te rozet dinleyicisi erken return'lerden ÖNCE kurulduğu için burada da var.
export function whatsappErisimi(p, positionModules = {}) {
  if (!p || p.employmentStatus === 'Pasif') return false;
  const superAdmin = p.fullName === 'Sistem Yöneticisi' || (p.position || '') === 'Firma Sahibi';
  const tanimli = (key) => {
    for (const v of [p.permissions?.modules?.[key], positionModules?.[p.position]?.[key], positionModules?.[p.rank]?.[key]]) if (typeof v === 'boolean') return v;
    return null;
  };
  if (!superAdmin && tanimli('addJob') !== true) return false;
  const t = tanimli('satisWhatsapp');
  return t === null ? true : t;
}

// YENİ (2026-10-07): App.jsx görüntüleyicisi { title, name } bekler (name = dosya adresi) —
// diğer ekranlardaki setViewingImage({ title, name }) çağrılarıyla AYNI biçim
export const gorselGoruntuleyiciIstegi = (md = {}) => ({ title: md.caption ? `WhatsApp görseli — ${md.caption}`.slice(0, 120) : 'WhatsApp görseli', name: md.url || '' });
