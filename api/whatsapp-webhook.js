// api/whatsapp-webhook.js
// ============================================================================
// Sembol CRM — WHATSAPP CLOUD API WEBHOOK + BOT (DepoEvim Asistanı / SEMBO Asistan)
// ----------------------------------------------------------------------------
// GET  → Meta webhook doğrulaması (hub.mode=subscribe + hub.verify_token → hub.challenge)
// POST → Meta olayları:
//   1) X-Hub-Signature-256 (HMAC-SHA256, App Secret, HAM gövde) doğrulanır; geçersiz → 401
//   2) Meta'ya HEMEN 200 dönülür; iş waitUntil ile arka planda yapılır
//   3) NUMARA (2026-10-10): metadata.phone_number_id → WHATSAPP_NUMARALAR eşlemesi
//      ({"<id>": "sembolevdeneve" | "depoevim"}) → marka. Her numara TEK markadır, bot markayı sormaz;
//      cevaplar konuşmanın geldiği numaradan gider. Aynı müşteri iki numaraya yazarsa iki ayrı konuşma
//      olur (api/_lib/whatsapp.js konusmaKimligi). EŞLEMEDE OLMAYAN numaradan gelen mesaj KAYDEDİLİR
//      (konuşmada eslenmemis: true, personel bekliyor), bot cevap VERMEZ, "[whatsapp] UYARI" loglanır ve
//      whatsapp_durum/numara uyarısı yazılır (CRM bandı); o numaradan eşlenmiş mesaj gelince uyarı kalkar.
//   4) Tekrar koruması: mesaj belgesi kimliği = wamid, create() ile yazılır; zaten
//      varsa (Meta aynı olayı yeniden gönderdi) işlenmez, bot ikinci kez cevap vermez
//   5) Peş peşe mesaj kilidi: müşteri art arda yazarsa kısa bir bekleme sonrası
//      yalnızca SON mesajın işleyicisi cevap verir (hepsini birlikte okur); bot
//      cevap yazarken gelen yeni mesajlar için tur tekrarlanır (konuşma başına tek kilit)
//   6) Bot cevabı (api/_lib/ai.js), fiyat (api/_lib/fiyatHesap.js — yapay zeka hesaplamaz),
//      lead kaydı (api/_lib/lead.js — sihirbazla aynı biçim)
//   7) PERSONELE AKTARMA iki türdür (2026-10-07):
//      • BİLDİR (needsAgent: true, mode "bot" kalır): ekspertiz/randevu, bilgiler tamam, fiyat yok …
//      • SUSTUR (mode "human"): yalnızca açık temsilci isteği ve şikayet (ya da personel CRM'den yazınca)
//      Sessiz modda personel yazmadıysa müşteriye en fazla 3 saatte bir sabit bilgi mesajı;
//      son personel mesajından (yoksa devirden) 24 saat sonra müşterinin yeni mesajında bota döner.
//   8) Maliyet: konuşma başına günde (Türkiye saati) en fazla 30 bot cevabı
//   9) DepoEvim hattında depolamasız taşıma talebi: bilgiler toplanır, fiyat VERİLMEZ,
//      Sembol ekibi için "evden eve" lead'i açılır (konuşmada tasimaLeadId)
//   9b) YENİ (2026-10-10) Sembol hattında depolama talebi (intent depolama / kiralik_depo): bot DepoEvim
//      bilgileriyle yardım eder, fiyat DepoEvim Fiyat Tablosu'ndan (+KDV), lead DepoEvim'e (hizmetTipi Depo,
//      hesapId depoevim; konuşmada depoLeadId), DepoEvim aydınlatması BİR KEZ
//  10) statuses → giden mesajın durumu (sent / delivered / read / failed)
//  11) Meta 190 / OAuthException ya da kalıcı hata → whatsapp_durum/token uyarısı
//      (CRM'de yöneticilere kırmızı bant); yapay zeka yapılandırma hatası → whatsapp_durum/ai
//  12) Yapay zeka hatası konuşmayı KİLİTLEMEZ: sabit mesaj (30 dk'da bir), sonraki mesajda yeniden dener.
//      2026-10-10: hata turunda personel BİLGİLENDİRİLİR (needsAgent, devirTuru "bildir") — bot susmaz
//  13) Medya (görsel / ses / video / belge): ayrı arka plan işiyle Meta'dan indirilip crm/upload.php ile
//      uploads/ köküne "wa_<rastgele>" adıyla yüklenir (api/_lib/whatsappMedya.js); bot cevabı beklemez
//  14) KULLANICI ADI / BSUID (2026-10-08): kullanıcı adı olan müşterinin mesajı telefon OLMADAN gelebilir
//      (from / wa_id yok; from_user_id + contacts[].user_id + profile.username var). Konuşma kimliği o zaman
//      BSUID'dir; cevap "recipient" alanıyla gider (api/_lib/whatsapp.js musteriCoz / waMetinGonder). Telefon
//      sonradan gelirse konuşmaya yazılır, aynı konuşma sürer. Lead'de telefon yoksa iletisim "Telefon Bekleniyor …".
//  15) BİLGİ BANKASI (2026-10-08): DepoEvim bilgi bloğu CRM'deki "Bot Bilgileri" sayfasından (bot_bilgi/depoevim,
//      api/_lib/botBilgi.js, 60 sn önbellek); boş / bozuk / okunamıyorsa botTalimatlari.js'deki yedek metin.
//  Her gelen mesajda tek satır "[whatsapp] gelen <maskeli kimlik> <tip> m=<anahtarlar> c=<contacts[0] anahtarları>"
//  (yalnızca ANAHTAR adları — telefon / ad gibi değerler loglanmaz).
//  Her erken çıkışta tek satır log: "[whatsapp] atlandı <maskeli kimlik> <sebep>"
//
// ORTAM DEĞİŞKENLERİ (Vercel, VITE_ öneki YOK):
//   WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_TOKEN
//   WHATSAPP_NUMARALAR (JSON: {"<phone_number_id>": "sembolevdeneve" | "depoevim"}; boşsa hiçbir numaraya bot cevap vermez)
//   WHATSAPP_TOKEN_<phone_number_id> (isteğe bağlı: o numara başka bir Meta işletmesindeyse)
//   AI_PROVIDER (gemini|claude), GEMINI_API_KEY | ANTHROPIC_API_KEY, AI_MODEL (isteğe bağlı)
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIRESTORE_APP_ID (mevcut)
//   İsteğe bağlı: WHATSAPP_BIRLESTIRME_MS (peş peşe mesaj bekleme, varsayılan 4000),
//   WHATSAPP_CUMARTESI ("09:00-14:00"), WHATSAPP_GUNLUK_GOOGLE (bot km sorgu sınırı, 300),
//   WHATSAPP_GUNLUK_BOT_CEVABI (konuşma başına günlük bot cevabı, varsayılan 30),
//   WHATSAPP_GRAPH_VERSION (varsayılan v23.0), WHATSAPP_BOT_KAPALI=1 (bot cevap vermez, yalnızca kaydeder)
// ============================================================================
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { waitUntil } from '@vercel/functions';
import { getDb as dbVarsayilan, konusmaRef, mesajlarRef, havuzRef, durumRef, maskele, waMetinGonder, uyariYaz, uyariTemizle, aiUyariYaz, aiUyariTemizle, gelenMesajiCoz, metaHatasiCoz, hatBul, eslenmemisHat, konusmaKimligi, musteriCoz, anahtarOzeti, bsuidMi } from './_lib/whatsapp.js';
import { botCevabiUret } from './_lib/ai.js';
import { botBilgiMetniOku } from './_lib/botBilgi.js';
import { mesajMedyasiniIsle, MEDYA_TIPLERI } from './_lib/whatsappMedya.js';
import { sistemTalimati, girisMetni, kvkkEkMetni, asistanAdi, fiyatRakamlariGecerliMi, hizmetReddiVarMi, RET_DUZELTME_NOTU, retYerineCevap, istanbulGunu } from './_lib/botTalimatlari.js';
import { botFiyatHesapla, leadFiyati } from './_lib/fiyatHesap.js';
import { whatsappLeadKaydi, whatsappAlanlariniTemizle, refKoduBul, refKoduTemizle, refBelgeId, leadAcikMi, waTelefonCrm } from './_lib/lead.js';

export const YEDEK_MESAJ = 'Mesajınızı aldık, ekibimiz en kısa sürede dönüş yapacak.';
// Sessiz modda (mode "human") personel henüz yazmadıysa — en fazla 3 saatte bir
export const SESSIZ_BILGI_MESAJI = 'Mesajınız ekibimize iletildi, mesai saatinde (09:00-18:00) size dönüş yapılacak.';
// DepoEvim hattında taşıma talebi: lead Sembol'e gider → Sembol aydınlatması bir kez
export const SEMBOL_TASIMA_KVKK = 'Taşıma talebiniz grubumuzdaki Sembol Nakliyat tarafından karşılanacak. '
  + 'Kişisel verileriniz Sembol Nakliyat aydınlatma metni kapsamında işlenir: https://www.sembolevdeneve.com/aydinlatma-metni/';
// Sembol hattında depolama talebi: lead DepoEvim'e gider → DepoEvim aydınlatması bir kez
export const DEPOEVIM_DEPOLAMA_KVKK = 'Depolama talebiniz grubumuzdaki DepoEvim tarafından karşılanacak. '
  + 'Kişisel verileriniz DepoEvim aydınlatma metni kapsamında işlenir: https://www.depoevim.com/aydinlatma-metni/';
// Yapay zeka hatası turunda personele bildirim sebebi (bot susmaz)
export const AI_HATA_BILDIRIMI = 'Bot cevap veremedi (yapay zeka hatası) — müşteriye sabit mesaj gitti';
// Günlük bot cevabı sınırı dolunca — günde bir kez
export const SINIR_MESAJI = 'Ekibimiz size en kısa sürede dönüş yapacak.';
const KILIT_SURESI_MS = 90000;
// Yapay zeka art arda hata verirse müşteriye sabit mesaj en fazla 30 dakikada bir gider
const YEDEK_ARALIGI_MS = 30 * 60 * 1000;
const SESSIZ_BILGI_ARALIGI_MS = 3 * 60 * 60 * 1000;
const OTOMATIK_DONUS_MS = 24 * 60 * 60 * 1000;
// Eski kod (2026-10-06) yapay zeka hatasında konuşmayı bu sebeple personele devrediyordu
const ESKI_AI_DEVIR_SEBEBI = /yapay zeka/i;

// --------------------------------------------------------------- DEVİR TÜRÜ (2026-10-07)
// temsilci | sikayet → bot susar (mode "human"); bildir → needsAgent, bot devam eder.
// Yapay zeka handoffType vermediyse (ya da eski konuşmanın serbest metin sebebi) metinden çıkarılır;
// açıkça temsilci / şikayet geçmiyorsa "bildir" sayılır.
const BOTU_SUSTURAN = ['temsilci', 'sikayet'];
const TEMSILCI_SEBEBI = /temsilci|insan(?:la|a)?\b|yetkili|canlı destek|müşteri hizmet/i;
const SIKAYET_SEBEBI = /şikay|şikây|hasar|kırıl|memnun değil/i;
export function devirTuruBul(handoffType, sebep = '') {
  if (['temsilci', 'sikayet', 'bildir'].includes(handoffType)) return handoffType;
  if (SIKAYET_SEBEBI.test(sebep)) return 'sikayet';
  if (TEMSILCI_SEBEBI.test(sebep)) return 'temsilci';
  return 'bildir';
}

// --------------------------------------------------------------- SESSİZ MOD KARARI (saf — rapor betiği de kullanır)
// mode "human" konuşmaya müşteri yazınca ne olur? mesajlar: son mesajlar (herhangi sırada)
//  ai_hatasi  : ESKİ devir (devirTuru yok), personel yazmamış, sebep "Yapay zeka hatası" (ya da boş + devir mesajında aiHata) → bota döner, needsAgent kalkar
//  eski_bildir: ESKİ devir, personel yazmamış, sebepte temsilci / şikayet yok (ekspertiz, randevu, fiyat …) → bota döner, needsAgent kalır
//  24_saat    : son personel mesajından (yoksa devirden) 24 saat geçti → bota döner, needsAgent korunur
//  sessiz_personel: personel yazıyor → hiçbir otomatik mesaj yok
//  sessiz     : personel henüz yazmadı → en fazla 3 saatte bir bilgi mesajı
// Sebebi boş eski devirler ihtiyaten sessiz kalır (24 saat kuralı açar).
export function sessizModKarari(k = {}, mesajlar = [], simdiMs = Date.now()) {
  const devir = k.handoffAt || '';
  const personelSon = enGec(k.lastAgentAt, ...mesajlar.filter(m => m.from === 'agent').map(m => m.timestamp));
  const personelYazdi = !!personelSon && (!devir || personelSon >= devir);
  if (!personelYazdi && !k.devirTuru) {
    const sebep = k.handoffReason || '';
    const devirMesaji = [...mesajlar].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .find(m => m.from === 'bot' && (!devir || String(m.timestamp) <= devir));
    if (ESKI_AI_DEVIR_SEBEBI.test(sebep) || (!sebep && devirMesaji?.aiHata)) return { karar: 'ai_hatasi', personelYazdi };
    if (sebep && devirTuruBul('', sebep) === 'bildir') return { karar: 'eski_bildir', personelYazdi };
  }
  const dayanak = enGec(devir, personelSon, k.devralmaAt);
  if (dayanak && simdiMs - Date.parse(dayanak) >= OTOMATIK_DONUS_MS) return { karar: '24_saat', personelYazdi, dayanak };
  return { karar: personelYazdi ? 'sessiz_personel' : 'sessiz', personelYazdi, dayanak };
}

// DepoEvim hattında depolamasız taşıma talepleri → Sembol ekibine lead (fiyat verilmez)
const TASIMA_NIYETLERI = ['evden_eve', 'sehirlerarasi', 'ofis'];
// Bu alanlar gelince taşıma ekibi bilgilendirilir (yapay zekaya bırakılmaz)
const TASIMA_ZORUNLU = ['homeSize', 'fromCity', 'fromDistrict', 'toCity', 'toDistrict'];
// Sembol hattında depolama talepleri → DepoEvim fiyatı ve lead'i
const DEPOLAMA_NIYETLERI = ['depolama', 'kiralik_depo'];
// Konuşmaya bağlı bütün lead'ler (hareket satırları için)
const konusmaLeadleri = (k = {}) => [...new Set([k.leadId, k.tasimaLeadId, k.depoLeadId].filter(Boolean))];

// Hangi markaların aydınlatma linki gönderildi? Eski konuşmalar: kvkkVerildi → eski nötr
// metin yalnızca Sembol linkini gönderiyordu.
export function kvkkGonderilenOku(k = {}) {
  if (k.kvkkGonderilen && typeof k.kvkkGonderilen === 'object') return { ...k.kvkkGonderilen };
  return k.kvkkVerildi ? { sembol: k.kvkkAydinlatmaTarihi || true } : {};
}
const DURUM_SIRASI = { sent: 1, delivered: 2, read: 3 };
const enGec = (...zamanlar) => zamanlar.filter(Boolean).map(String).sort().at(-1) || '';
const atlandi = (no, sebep) => console.log('[whatsapp] atlandı', maskele(no), sebep);
// Gelen yapının teşhisi: mesaj ve contacts[0] ANAHTAR adları (değerler değil)
const yapiOzeti = (m, contacts) => `m=${anahtarOzeti(m)} c=${anahtarOzeti(Array.isArray(contacts) ? contacts[0] : null)}`;

// ------------------------------------------------------------------ İMZA
export function imzaGecerliMi(ham, baslik, secret) {
  if (!secret || !baslik || !String(baslik).startsWith('sha256=')) return false;
  const beklenen = Buffer.from('sha256=' + createHmac('sha256', secret).update(ham).digest('hex'));
  const gelen = Buffer.from(String(baslik));
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}
// İmza HAM gövde üzerinden hesaplanır: Vercel req.body'yi yalnızca erişilince
// ayrıştırır, bu yüzden req.body'ye DOKUNMADAN akış okunur.
async function hamGovdeOku(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  const parcalar = [];
  for await (const p of req) parcalar.push(typeof p === 'string' ? Buffer.from(p) : p);
  const ham = Buffer.concat(parcalar);
  if (ham.length) return ham;
  // Akış başka bir katmanca okunmuşsa: yalnızca HAM (metin / Buffer) gövde kabul edilir — ayrıştırılmış nesneden imza üretilemez
  const b = req.body;
  if (Buffer.isBuffer(b)) return b;
  return Buffer.from(typeof b === 'string' ? b : '');
}

const tl = (n) => `${Number(n).toLocaleString('tr-TR')} TL`;
// Yapay zeka fiyat cevabı üretemezse / rakam uydurursa kullanılan sabit fiyat metni
export function fiyatMesaji(f) {
  if (f.marka === 'depoevim') {
    const k = f.kira;
    const s = [`Seçimlerinize göre aylık depo kirası ${tl(k.aylik)} +KDV.`];
    if (k.ucretsizAy > 0) s.push(`${k.sureAy} ay peşin ödemede ${k.ucretsizAy} ay hediye: toplam ${tl(k.toplam)} +KDV.`);
    if (f.nakliye) s.push(`Eşyalarınızın adresten alımı için tahmini fiyat aralığı: ${tl(f.nakliye.min)} – ${tl(f.nakliye.max)} +KDV.`);
    s.push('Net fiyat ücretsiz ekspertiz sonrası belirlenir. Ücretsiz ekspertiz için randevu oluşturmamı ister misiniz?');
    return s.join('\n');
  }
  return `Verdiğiniz bilgilere göre tahmini fiyat aralığı: ${tl(f.min)} – ${tl(f.max)}.\nNet fiyat ücretsiz ekspertiz sonrası belirlenir. Ücretsiz ekspertiz için randevu oluşturmamı ister misiniz?`;
}

// Otomatik fiyatı olmayan hizmetler (Sembol)
const FIYATSIZ_NIYETLER = ['ofis', 'parca_esya', 'asansor_kiralama'];

export function handlerOlustur({
  getDb = dbVarsayilan, waitUntil: arkaPlanda = waitUntil, fetchFn = globalThis.fetch, env = process.env,
  simdi = () => Date.now(), bekle = (ms) => new Promise(r => setTimeout(r, ms)),
  aiUret = botCevabiUret, fiyatHesapla = botFiyatHesapla,
} = {}) {
  const appId = env.FIRESTORE_APP_ID;
  const iso = () => new Date(simdi()).toISOString();
  const msAyar = String(env.WHATSAPP_BIRLESTIRME_MS ?? '').trim();
  const birlestirmeMs = msAyar !== '' && Number(msAyar) >= 0 ? Number(msAyar) : 4000;
  const gunlukSinir = Number(env.WHATSAPP_GUNLUK_BOT_CEVABI) > 0 ? Number(env.WHATSAPP_GUNLUK_BOT_CEVABI) : 30;

  async function fiyatGuvenli(db, marka, collected, intent) {
    if (!marka) return null;
    if (marka === 'sembol') {
      if (FIYATSIZ_NIYETLER.includes(intent) || collected.homeSize === 'ofis') return { durum: 'fiyat_yok', sebep: intent || 'ofis' };
      if (!collected.homeSize && !['evden_eve', 'sehirlerarasi'].includes(intent)) return null;
    }
    try { return await fiyatHesapla({ db, marka, alanlar: collected, env, appId, simdi: simdi() }); }
    catch (err) { console.error('[whatsapp] fiyat hesaplanamadı:', err?.message); return { durum: 'hata' }; }
  }

  // ---- bot mesajı gönderir ve messages'a yazar (hattın numarasından)
  async function gonderVeKaydet(db, hat, kid, waId, metin, ek = {}) {
    const g = await waMetinGonder({ env, fetchFn, hat, to: waId, metin });
    const nowIso = iso();
    await mesajlarRef(db, kid, appId).doc(g.wamid || `yerel_${simdi()}`).set({
      direction: 'out', from: 'bot', agentName: asistanAdi(hat.marka), type: 'text', text: metin, timestamp: nowIso, wamid: g.wamid || null,
      status: g.ok ? 'sent' : 'failed', ...(g.ok ? {} : { hata: { kod: g.hata.kod ?? null, mesaj: g.hata.mesaj || '' } }), ...ek,
    });
    if (!g.ok) {
      console.error('[whatsapp] gönderilemedi', maskele(waId), g.hata.kod, g.hata.mesaj);
      if (g.hata.kalici) await uyariYaz(db, g.hata, nowIso, appId);
    } else await uyariTemizle(db, nowIso, appId);
    return { g, nowIso };
  }

  // ---- lead'e tek hareket satırı (bota dönüş, günlük sınır …)
  async function leadHareketiEkle(db, waId, leadId, islem) {
    if (!leadId) return;
    try {
      const lRef = havuzRef(db, leadId, appId);
      const l = await lRef.get();
      if (l.exists) await lRef.set({ hareketler: [...(l.data()?.hareketler || []), { tarih: iso(), kullanici: 'WhatsApp Bot', islem }] }, { merge: true });
    } catch (err) { console.error('[whatsapp] lead hareketi yazılamadı', maskele(waId), err?.message); }
  }

  // ---- lead (Müşteri Havuzu) — açık lead güncellenir, iş kapandıysa yeni lead.
  // alan: konuşmadaki kimlik alanı — 'leadId' (hattın markası) | 'tasimaLeadId' (DepoEvim hattından Sembol taşıma talebi)
  //       | 'depoLeadId' (Sembol hattından DepoEvim depolama talebi)
  async function leadYaz(db, { hat, kid, waId, konusma, alan, leadMarka, intent, collected, fiyat, kvkkMarkalari = [], hareket, devir }) {
    const nowIso = iso();
    let id = null, onceki = {}, ilkKayit = true;
    const dene = async (aday) => {
      const s = await havuzRef(db, aday, appId).get();
      if (!s.exists) { id = aday; onceki = {}; ilkKayit = true; return true; }
      const d = s.data() || {};
      if (!leadAcikMi(d)) return false;
      id = aday; onceki = d; ilkKayit = false; return true;
    };
    // DEĞİŞTİ (2026-10-10): site ref kodu yalnızca reklam kaynağı / sayfa bilgisini eşleştirmek içindir —
    // markadan bağımsız olarak konuşmanın İLK açılan lead'ine bir kez bağlanır (ör. Sembol sitesinden gelip
    // depolama isteyen müşterinin DepoEvim lead'i). Lead'in markası hizmetten gelir (whatsappLeadKaydi).
    if (konusma[alan]) await dene(konusma[alan]);
    if (!id && konusma.refKodu && !konusma.refKullanildi) await dene(refBelgeId(konusma.refKodu));
    if (!id) { id = `wa_${waId}_${simdi()}`; onceki = {}; ilkKayit = true; }

    const hizmet = ({ parca_esya: 'parca_esya', asansor_kiralama: 'asansor_kiralama', ofis: 'ofis' })[intent] || '';
    const { kayit } = whatsappLeadKaydi({ marka: leadMarka, hizmet, collected, waId, profilAdi: konusma.profileName || '', onceki, ilkKayit,
      telefonWa: konusma.telefonWa || (bsuidMi(waId) ? '' : waId), userId: konusma.userId || '', kullaniciAdi: konusma.username || '',
      tamamlandi: fiyat?.durum === 'tamam', fiyat: leadFiyati(fiyat), nowIso, asistan: asistanAdi(hat.marka) });
    // CRM WhatsApp sekmesi lead'den konuşmayı açabilsin
    kayit.whatsapp = { ...kayit.whatsapp, konusmaId: kid, hatId: hat.phoneNumberId, hatMarka: hat.marka };
    // Hangi markaların aydınlatma metni verildi: ['depoevim'] | ['depoevim', 'sembol'] (taşıma talebi)
    if (kvkkMarkalari.length) kayit.kvkkAydinlatmaMarka = kvkkMarkalari;
    if (hareket) kayit.hareketler = [...(kayit.hareketler || onceki.hareketler || []), { tarih: nowIso, kullanici: 'WhatsApp Bot', islem: hareket }];
    if (devir) kayit.whatsappDevir = { tarih: nowIso, sebep: devir.sebep || '', tur: devir.tur };
    await havuzRef(db, id, appId).set(kayit, { merge: true });
    return id;
  }

  // ---- günlük bot cevabı sınırı doldu: günde BİR kez sabit mesaj, personel bilgilendirilir, yapay zeka çağrılmaz
  async function gunlukSinirDoldu(db, hat, kid, waId, konusma, gun) {
    if (konusma.sinirMesajiGunu === gun) { atlandi(waId, 'günlük sınır'); return; }
    atlandi(waId, `günlük sınır (${gunlukSinir}) — bilgi mesajı gönderiliyor`);
    const { nowIso } = await gonderVeKaydet(db, hat, kid, waId, SINIR_MESAJI, { otomatik: 'gunluk_sinir' });
    const sebep = `Günlük bot cevabı sınırı doldu (${gunlukSinir})`;
    await konusmaRef(db, kid, appId).set({
      sinirMesajiGunu: gun, needsAgent: true, lastMessageAt: nowIso, lastMessagePreview: SINIR_MESAJI, lastBotAt: nowIso,
      ...(konusma.needsAgent ? {} : { handoffReason: sebep, bildirimAt: nowIso, devirTuru: 'bildir' }),
    }, { merge: true });
    if (!konusma.needsAgent) for (const id of konusmaLeadleri(konusma)) await leadHareketiEkle(db, waId, id, `Bot personeli bilgilendirdi (bot devam ediyor): ${sebep}`);
  }

  // ---- bir bot turu: son mesajları okur, cevap üretir, gönderir, kaydeder
  async function botTuru(db, hat, kid, waId) {
    const kRef = konusmaRef(db, kid, appId);
    const konusma = (await kRef.get()).data() || {};
    if (konusma.mode === 'human') { atlandi(waId, 'human mode'); return; }
    const gun = istanbulGunu(simdi());
    const gunlukSayi = konusma.botGunluk?.gun === gun ? Number(konusma.botGunluk.sayi) || 0 : 0;
    if (gunlukSayi >= gunlukSinir) { await gunlukSinirDoldu(db, hat, kid, waId, konusma, gun); return; }

    const snap = await mesajlarRef(db, kid, appId).orderBy('timestamp', 'desc').limit(20).get();
    const mesajlar = snap.docs.map(d => d.data()).reverse();
    const gecmis = mesajlar.map(d => ({ rol: d.from === 'customer' ? 'musteri' : 'asistan', metin: d.text || '' }));
    const kvkkGonderilen = kvkkGonderilenOku(konusma);
    const ilkCevap = !Object.keys(kvkkGonderilen).length;
    const collected = konusma.collected || {};
    // Marka numaradan gelir (WHATSAPP_NUMARALAR): yapay zekanın "marka" alanı dikkate alınmaz
    const marka = hat.marka;
    // YENİ (2026-10-08): DepoEvim bilgi bloğu CRM'deki Bot Bilgileri sayfasından (60 sn önbellek; boş / hata → yedek metin).
    // DepoEvim hattında her turda; Sembol hattında yalnızca depolama talebinde gerekir.
    let depoBilgisi = null;
    const bilgiMetniAl = async (depolama) => {
      if (marka !== 'depoevim' && !depolama) return '';
      if (depoBilgisi === null) depoBilgisi = await botBilgiMetniOku(db, appId, 'depoevim', simdi());
      return depoBilgisi;
    };
    let intent = konusma.intent || '';
    const tasimaMi = (niyet) => marka === 'depoevim' && TASIMA_NIYETLERI.includes(niyet);
    // YENİ (2026-10-10): Sembol hattında depolama talebi → DepoEvim fiyatı / lead'i
    const depolamaMi = (niyet) => marka === 'sembol' && DEPOLAMA_NIYETLERI.includes(niyet);
    const fiyatMarkasi = (d) => (d ? 'depoevim' : marka);
    let tasima = tasimaMi(intent);
    let depo = depolamaMi(intent);
    const fiyatOnce = tasima ? null : await fiyatGuvenli(db, fiyatMarkasi(depo), collected, intent);
    const bildirim = konusma.needsAgent ? { sebep: konusma.handoffReason || '' } : null;
    const talimat = async (c, f, t, d) => sistemTalimati({ marka, collected: c, fiyat: f, profilAdi: konusma.profileName || '', simdiMs: simdi(), env, ilkCevap, bildirim,
      tasima: t, depolama: d, bilgiMetni: await bilgiMetniAl(d) });

    let reply, handoff, handoffReason, handoffType, yeniCollected = collected, fiyat = fiyatOnce, aiHata = null;
    const r1 = await aiUret({ sistem: await talimat(collected, fiyatOnce, tasima, depo), gecmis, env, fetchFn });
    if (!r1.ok) {
      // DEĞİŞTİ (2026-10-07): yapay zeka hatası konuşmayı KİLİTLEMEZ (bot susmaz);
      // müşterinin sonraki mesajında bot yeniden dener. Sabit mesaj 30 dakikada en fazla bir kez.
      // YENİ (2026-10-10): personel bilgilendirilir (needsAgent, "bildir") — konuşma CRM'de "personel bekliyor"a düşer.
      aiHata = r1.hata;
      const hataAni = iso();
      console.error('[whatsapp] yapay zeka hatası:', maskele(waId), r1.tur, r1.hata);
      if (r1.tur === 'yapilandirma') await aiUyariYaz(db, r1, hataAni, appId);
      if (simdi() - (Date.parse(konusma.sonYedekMesaj || '') || 0) < YEDEK_ARALIGI_MS) {
        await kRef.set({ botHatasi: { zaman: hataAni, sebep: String(r1.hata || '').slice(0, 300), tur: r1.tur || 'gecici' } }, { merge: true });
        atlandi(waId, 'yedek sessizliği (30 dk)');
        return;
      }
      reply = YEDEK_MESAJ; handoff = true; handoffType = 'bildir'; handoffReason = AI_HATA_BILDIRIMI;
    } else {
      await aiUyariTemizle(db, iso(), appId);
      let out = r1.cikti;
      intent = out.intent && out.intent !== 'diger' ? out.intent : (intent || out.intent);
      tasima = tasimaMi(intent);
      const depoOnce = depo;
      depo = depolamaMi(intent);
      yeniCollected = { ...collected, ...whatsappAlanlariniTemizle(out.collected) };
      fiyat = tasima ? null : await fiyatGuvenli(db, fiyatMarkasi(depo), yeniCollected, intent);
      // Fiyat bu turda hesaplanabilir hâle geldiyse (ya da değiştiyse) ya da Sembol hattında depolama talebi
      // bu turda anlaşıldıysa (DepoEvim bilgileri gerekir) cevap yeniden üretilir
      const fiyatYeni = fiyat?.durum === 'tamam' && JSON.stringify(fiyat) !== JSON.stringify(fiyatOnce);
      if ((fiyatYeni || depo !== depoOnce) && !out.handoff) {
        const r2 = await aiUret({ sistem: await talimat(yeniCollected, fiyat, tasima, depo), gecmis, env, fetchFn });
        if (r2.ok) {
          out = { ...r2.cikti, handoff: r2.cikti.handoff || out.handoff, handoffReason: r2.cikti.handoffReason || out.handoffReason, handoffType: r2.cikti.handoffType || out.handoffType };
          yeniCollected = { ...yeniCollected, ...whatsappAlanlariniTemizle(r2.cikti.collected) };
        } else if (fiyatYeni) out = { ...out, reply: fiyatMesaji(fiyat) };
      }
      reply = out.reply;
      handoff = out.handoff;
      handoffReason = out.handoffReason;
      handoffType = out.handoffType || '';
      // YENİ (2026-10-07): coğrafi hizmet reddi ("İstanbul dışı taşıma yapmıyoruz") yakalanır —
      // bir kez düzeltme notuyla yeniden üretilir; yine ret varsa sabit cevap (soru / fiyat / devret)
      if (hizmetReddiVarMi(reply)) {
        console.warn('[whatsapp] cevapta hizmet reddi — yeniden üretiliyor', maskele(waId));
        const r3 = await aiUret({ sistem: `${await talimat(yeniCollected, fiyat, tasima, depo)}\n${RET_DUZELTME_NOTU}`, gecmis, env, fetchFn });
        if (r3.ok && !hizmetReddiVarMi(r3.cikti.reply)) {
          reply = r3.cikti.reply; handoff = r3.cikti.handoff; handoffReason = r3.cikti.handoffReason; handoffType = r3.cikti.handoffType || '';
          yeniCollected = { ...yeniCollected, ...whatsappAlanlariniTemizle(r3.cikti.collected) };
        } else if (fiyat?.durum === 'tamam') {
          reply = fiyatMesaji(fiyat);
        } else {
          const y = retYerineCevap(fiyat);
          reply = y.metin;
          if (y.devret) { handoff = true; handoffType = 'bildir'; handoffReason = 'Fiyatı ekip iletecek (bot reddetmeye çalıştı)'; }
        }
      }
      // Uydurma rakam koruması: cevapta sistemin hesaplamadığı bir tutar varsa sabit metin
      if (!fiyatRakamlariGecerliMi(reply, fiyat)) {
        console.warn('[whatsapp] cevapta sistem dışı tutar — sabit metne çevrildi', maskele(waId));
        if (fiyat?.durum === 'tamam') reply = fiyatMesaji(fiyat);
        else {
          reply = `${tasima ? 'Fiyatı taşıma ekibimiz size iletecek.' : 'Fiyat bilgisini ekibimiz sizinle paylaşacak.'} ${YEDEK_MESAJ}`;
          if (!handoff) { handoff = true; handoffType = 'bildir'; handoffReason = handoffReason || 'Fiyat sorusu (otomatik fiyat yok)'; }
        }
      }
      if (fiyat && ['fiyat_yok', 'hata'].includes(fiyat.durum) && !handoff && /fiyat|ücret|ne kadar|kaç para/i.test(gecmis.filter(g => g.rol === 'musteri').slice(-1)[0]?.metin || '')) {
        handoff = true; handoffType = 'bildir'; handoffReason = fiyat.durum === 'hata' ? 'Fiyat hesaplanamadı' : 'Otomatik fiyatı olmayan hizmet';
      }
    }

    // Devir türü: yalnızca temsilci / şikayet botu susturur; gerisi "bildir" (bot devam eder)
    let devirTuru = handoff ? devirTuruBul(handoffType, handoffReason) : null;
    // DepoEvim hattında taşıma bilgileri tamamlandı → taşıma ekibi bilgilendirilir (bir kez)
    let tasimaBildirimi = false;
    if (tasima && !konusma.tasimaBildirildi && TASIMA_ZORUNLU.every(a => yeniCollected[a]) && !BOTU_SUSTURAN.includes(devirTuru)) {
      devirTuru = 'bildir'; handoffReason = 'Taşıma talebi — taşıma ekibine iletildi'; tasimaBildirimi = true;
    }
    const sustur = BOTU_SUSTURAN.includes(devirTuru);
    const yeniBildirim = devirTuru === 'bildir' && (!konusma.needsAgent || tasimaBildirimi);
    const sebep = handoffReason || (sustur ? 'Temsilci istedi' : 'Personel bilgilendirildi');

    // KVKK: ilk cevapta tanıtım + hattın markasının aydınlatma linki;
    // eski konuşmada bu markanın linki gitmediyse BİR KEZ
    // YENİ (2026-10-07): DepoEvim hattında taşıma talebi anlaşıldığı ilk turda Sembol Nakliyat aydınlatması BİR KEZ
    let kvkkYeni = [];
    if (tasima && !kvkkGonderilen.sembol) { reply = `${SEMBOL_TASIMA_KVKK}\n\n${reply}`; kvkkYeni.push('sembol'); }
    // YENİ (2026-10-10): Sembol hattında depolama talebi anlaşıldığı ilk turda DepoEvim aydınlatması BİR KEZ
    if (depo && !kvkkGonderilen.depoevim) { reply = `${DEPOEVIM_DEPOLAMA_KVKK}\n\n${reply}`; kvkkYeni.push('depoevim'); }
    if (ilkCevap) { const gm = girisMetni(marka); reply = [gm.metin, reply].filter(Boolean).join('\n\n'); kvkkYeni.push(...gm.markalar); }
    else if (marka && !kvkkGonderilen[marka]) { reply = `${kvkkEkMetni(marka)}\n\n${reply}`; kvkkYeni.push(marka); }
    kvkkYeni = [...new Set(kvkkYeni)];

    // Fiyat izi (Vercel logu + konuşma belgesi) — numara maskeli
    const fiyatIzi = fiyat ? { durum: fiyat.durum, kaynak: fiyat.kaynak || '', toplamKm: fiyat.toplamKm ?? null,
      eksik: [...(fiyat.eksik || []), ...(fiyat.konumHatalari || []).map(k => `${k}?`)], sebep: fiyat.sebep || '' } : null;
    console.log('[whatsapp] tur', maskele(waId), JSON.stringify({ hat: hat.marka, intent, tasima, depo, fiyat: fiyatIzi, devir: devirTuru, gunluk: gunlukSayi + 1 }));

    const { g, nowIso } = await gonderVeKaydet(db, hat, kid, waId, reply, aiHata ? { aiHata: String(aiHata).slice(0, 300) } : {});

    // Lead: ilk anlamlı bilgi geldiyse (ya da personel devreye girdiyse) oluştur / güncelle
    const alan = tasima ? 'tasimaLeadId' : depo ? 'depoLeadId' : 'leadId';
    let leadId = konusma[alan] || null;
    // Aydınlatma metni gönderilmiş markalar (bu turda başarıyla gidenler dahil)
    const kvkkMarkalari = ['depoevim', 'sembol'].filter(m => kvkkGonderilen[m] || (g.ok && kvkkYeni.includes(m)));
    if (Object.keys(yeniCollected).length || sustur || yeniBildirim) {
      try {
        leadId = await leadYaz(db, { hat, kid, waId, konusma, alan, leadMarka: tasima ? 'sembol' : depo ? 'depoevim' : marka, intent, collected: yeniCollected, fiyat, kvkkMarkalari,
          hareket: sustur ? `Bot görüşmeyi personele devretti: ${sebep}` : yeniBildirim ? `Bot personeli bilgilendirdi (bot devam ediyor): ${sebep}` : null,
          devir: sustur || yeniBildirim ? { tur: devirTuru, sebep } : null });
      } catch (err) { console.error('[whatsapp] lead yazılamadı', maskele(waId), err?.message); }
    }

    await kRef.set({
      hatId: hat.phoneNumberId, collected: yeniCollected, marka, intent, [alan]: leadId,
      ...(leadId && konusma.refKodu && leadId === refBelgeId(konusma.refKodu) ? { refKullanildi: true } : {}),
      ...(g.ok && kvkkYeni.length ? {
        kvkkVerildi: true, kvkkGonderilen: { ...kvkkGonderilen, ...Object.fromEntries(kvkkYeni.map(m => [m, nowIso])) },
        ...(ilkCevap ? { kvkkAydinlatmaTarihi: nowIso } : {}),
      } : {}),
      ...(aiHata ? { botHatasi: { zaman: nowIso, sebep: String(aiHata).slice(0, 300), tur: r1.tur || 'gecici' }, ...(g.ok ? { sonYedekMesaj: nowIso } : {}) } : { botHatasi: null }),
      lastMessageAt: nowIso, lastMessagePreview: reply.slice(0, 120), lastBotAt: nowIso,
      botGunluk: { gun, sayi: gunlukSayi + 1 },
      ...(fiyat?.durum === 'tamam' ? { sonFiyat: fiyat } : {}),
      ...(fiyatIzi ? { sonFiyatDurumu: { ...fiyatIzi, zaman: nowIso } } : {}),
      ...(sustur ? { mode: 'human', needsAgent: true, handoffReason: sebep, handoffAt: nowIso, devirTuru, sonOtomatikBilgi: null } : {}),
      ...(!sustur && yeniBildirim ? { needsAgent: true, handoffReason: sebep, bildirimAt: nowIso, devirTuru: 'bildir' } : {}),
      ...(tasimaBildirimi ? { tasimaBildirildi: nowIso } : {}),
    }, { merge: true });
  }

  // ---- sessiz moddan bota dönüş (alanlar konuşmaya yazılır, lead'e hareket)
  async function botaDondur(db, kid, waId, k, { needsAgent, sebep, hareket, ek = {} }) {
    const nowIso = iso();
    const alanlar = { mode: 'bot', needsAgent, botaDonus: { zaman: nowIso, sebep }, sonOtomatikBilgi: null, ...ek };
    await konusmaRef(db, kid, appId).set(alanlar, { merge: true });
    for (const leadId of konusmaLeadleri(k)) await leadHareketiEkle(db, waId, leadId, hareket);
    console.log('[whatsapp] bota döndü', maskele(waId), sebep);
    return { ...k, ...alanlar };
  }

  // ---- mode "human" konuşmaya müşteri yazdı (2026-10-07) — karar: sessizModKarari
  async function insanModu(db, hat, kid, waId, k) {
    const kRef = konusmaRef(db, kid, appId);
    const mesajlar = (await mesajlarRef(db, kid, appId).orderBy('timestamp', 'desc').limit(50).get()).docs.map(d => d.data());
    const { karar, personelYazdi } = sessizModKarari(k, mesajlar, simdi());
    if (karar === 'ai_hatasi') {
      const nowIso = iso();
      return botaDondur(db, kid, waId, k, { needsAgent: false, sebep: 'eski yapay zeka hatası devri',
        hareket: 'Bot görüşmeye geri döndü (önceki devir yapay zeka hatasından)',
        ek: { handoffReason: '', aiKilidiAcildi: nowIso, botHatasi: { zaman: nowIso, sebep: 'Önceki yapay zeka hatası — konuşma bota geri döndü', tur: 'gecici' } } });
    }
    if (karar === 'eski_bildir') {
      return botaDondur(db, kid, waId, k, { needsAgent: true, sebep: `eski bildirim türü devir: ${k.handoffReason}`,
        hareket: `Bot görüşmeye geri döndü (önceki devir bildirim türündeydi: ${k.handoffReason}) — personel bilgilendirilmiş durumda`,
        ek: { devirTuru: 'bildir', bildirimAt: k.handoffAt || iso() } });
    }
    if (karar === '24_saat') {
      return botaDondur(db, kid, waId, k, { needsAgent: !!k.needsAgent, sebep: '24 saat',
        hareket: `Bot görüşmeye geri döndü (${personelYazdi ? 'son personel mesajından' : 'devirden'} bu yana 24 saat geçti)` });
    }
    if (karar === 'sessiz_personel') { atlandi(waId, 'human mode (personel yazıyor)'); return k; }
    const bilgiVer = await db.runTransaction(async (t) => {
      const g = (await t.get(kRef)).data() || {};
      if (g.mode !== 'human') return false;
      const son = enGec(g.handoffAt, g.sonOtomatikBilgi);
      if (son && simdi() - Date.parse(son) < SESSIZ_BILGI_ARALIGI_MS) return false;
      t.set(kRef, { sonOtomatikBilgi: iso() }, { merge: true });
      return true;
    });
    if (!bilgiVer) { atlandi(waId, 'human mode'); return k; }
    const { nowIso } = await gonderVeKaydet(db, hat, kid, waId, SESSIZ_BILGI_MESAJI, { otomatik: 'sessiz_bilgi' });
    await kRef.set({ lastMessageAt: nowIso, lastMessagePreview: SESSIZ_BILGI_MESAJI, lastBotAt: nowIso }, { merge: true });
    atlandi(waId, 'human mode — 3 saatlik bilgi mesajı gönderildi');
    return k;
  }

  // ---- gelen müşteri mesajı
  // contacts: aynı olaydaki value.contacts (profil adı, kullanıcı adı, BSUID)
  async function mesajIsle(db, hat, m, contacts = []) {
    const mu = musteriCoz(m, contacts);
    const wamid = String(m.id || '');
    console.log('[whatsapp] gelen', maskele(mu.kimlik), m.type || '-', mu.telefon ? 'tel' : mu.userId ? 'kullanici_adi' : 'kimliksiz', yapiOzeti(m, contacts));
    if (!mu.kimlik) { atlandi('', `kimlik yok (from / from_user_id / wa_id / user_id yok) ${yapiOzeti(m, contacts)}`); return; }
    if (!wamid) { atlandi(mu.kimlik, `wamid (id) yok ${yapiOzeti(m, contacts)}`); return; }
    // Konuşma kimliği: telefon, yoksa BSUID. Kullanıcı adıyla başlamış konuşmada telefon sonradan
    // gelirse (Meta 30 gün kuralı) konuşma bölünmez — BSUID'li belge varsa o sürer.
    let waId = mu.kimlik;
    if (mu.telefon && mu.userId && (await konusmaRef(db, konusmaKimligi(hat, mu.userId), appId).get()).exists) waId = mu.userId;
    const profilAdi = mu.profilAdi;
    const kid = konusmaKimligi(hat, waId);
    const c = gelenMesajiCoz(m);
    const ref = c.tip === 'text' || c.tip === 'button' ? refKoduBul(c.metin) : null;
    const metin = ref ? refKoduTemizle(c.metin) : c.metin;
    const zaman = Number(m.timestamp) > 0 ? new Date(Number(m.timestamp) * 1000).toISOString() : iso();

    // 1) Tekrar koruması — wamid ile create(); varsa çık
    try {
      await mesajlarRef(db, kid, appId).doc(wamid).create({
        direction: 'in', from: 'customer', type: c.tip, text: metin, timestamp: zaman, alindi: iso(), wamid,
        mediaId: c.mediaId || null, ...(c.konum ? { konum: c.konum } : {}), ...(ref ? { refKodu: ref.kod } : {}),
        ...(c.medya && c.mediaId ? { medya: c.medya } : {}),
      });
    } catch (err) {
      if (err?.code === 6 || /ALREADY_EXISTS/i.test(String(err?.message))) { atlandi(waId, 'tekrar'); return; }
      throw err;
    }

    // YENİ (2026-10-07): medya dosyası AYRI arka plan işiyle crm/uploads'a alınır — bot cevabı bunu beklemez
    if (c.medya && c.mediaId && MEDYA_TIPLERI.includes(c.tip)) {
      arkaPlanda(mesajMedyasiniIsle({ db, appId, env, fetchFn, hat, kid, mesajId: wamid, m: { mediaId: c.mediaId, medya: c.medya, waId }, simdi })
        .catch(err => console.error('[whatsapp] medya işi hatası', maskele(waId), err?.message)));
    }

    // 2) Konuşma özeti (okunmamış sayısı, son mesaj, hat → marka)
    const kRef = konusmaRef(db, kid, appId);
    let konusma = await db.runTransaction(async (t) => {
      const s = await t.get(kRef);
      const k = s.exists ? s.data() : {};
      const yeni = {
        waId, phone: waTelefonCrm(mu.telefon) || k.phone || '', profileName: profilAdi || k.profileName || '',
        // YENİ (2026-10-08): kullanıcı adı / BSUID — telefon yoksa panelde "Kullanıcı adıyla yazdı"
        ...(mu.telefon ? { telefonWa: mu.telefon } : {}), ...(mu.userId ? { userId: mu.userId } : {}),
        ...(mu.kullaniciAdi ? { username: mu.kullaniciAdi } : {}),
        kullaniciAdiyla: !mu.telefon && !k.telefonWa,
        hatId: hat.phoneNumberId, marka: hat.marka,
        // YENİ (2026-10-10): eşlemede olmayan numara — bot cevap vermez, personel bekler
        eslenmemis: !!hat.eslenmemis,
        ...(hat.eslenmemis && !k.needsAgent ? { needsAgent: true, handoffReason: 'Eşlenmemiş WhatsApp numarası — bot cevap vermiyor', bildirimAt: iso(), devirTuru: 'bildir' } : {}),
        lastMessageAt: zaman, lastMessagePreview: c.ozet || '', lastCustomerMessageAt: zaman, lastCustomerWamid: wamid,
        unreadCount: (Number(k.unreadCount) || 0) + 1,
        mode: k.mode || 'bot',
        ...(s.exists ? {} : { createdAt: iso(), collected: {}, ...(hat.eslenmemis ? {} : { needsAgent: false }) }),
        // Ref kodu yalnızca ilk kez (ya da yeni bir ref) gelince bağlanır (marka hattan gelir)
        ...(ref && ref.kod !== k.refKodu ? { refKodu: ref.kod, refKullanildi: false } : {}),
      };
      t.set(kRef, yeni, { merge: true });
      return { ...k, ...yeni };
    });
    if (hat.eslenmemis) { atlandi(waId, `eşlenmemiş numara (${maskele(hat.phoneNumberId)}) — kaydedildi, bot cevap vermez`); return; }
    if (!c.botaGitsin) { atlandi(waId, `bota gitmeyen mesaj türü (${c.tip}) ${yapiOzeti(m, contacts)}`); return; }
    if (konusma.mode === 'human') {
      konusma = await insanModu(db, hat, kid, waId, konusma);
      if (konusma.mode === 'human') return;
    }
    if (env.WHATSAPP_BOT_KAPALI === '1') { atlandi(waId, 'bot kapalı (WHATSAPP_BOT_KAPALI)'); return; }

    // 3) Peş peşe mesaj: kısa bekleme; bu arada yeni mesaj geldiyse cevabı o verir
    await bekle(birlestirmeMs);
    const kilit = await db.runTransaction(async (t) => {
      const k = (await t.get(kRef)).data() || {};
      if (k.lastCustomerWamid !== wamid) return 'birleştirme';
      if (k.botKilit && simdi() - Date.parse(k.botKilit.zaman) < KILIT_SURESI_MS) { t.set(kRef, { botTekrar: true }, { merge: true }); return 'kilit'; }
      t.set(kRef, { botKilit: { wamid, zaman: iso() }, botTekrar: false }, { merge: true });
      return true;
    });
    if (kilit !== true) { atlandi(waId, kilit); return; }

    // 4) Bot turu; bu sırada yeni mesaj geldiyse (botTekrar) bir tur daha
    try {
      for (let tur = 0; tur < 3; tur++) {
        await botTuru(db, hat, kid, waId);
        const devam = await db.runTransaction(async (t) => {
          const k = (await t.get(kRef)).data() || {};
          if (k.botTekrar && k.mode !== 'human') { t.set(kRef, { botTekrar: false, botKilit: { wamid, zaman: iso() } }, { merge: true }); return true; }
          t.set(kRef, { botKilit: null, botTekrar: false }, { merge: true });
          return false;
        });
        if (!devam) return;
      }
    } catch (err) {
      await kRef.set({ botKilit: null }, { merge: true }).catch(() => {});
      throw err;
    }
  }

  // ---- giden mesaj durumu
  async function durumIsle(db, hat, s) {
    // recipient_id (telefon) kullanıcı adlı müşteride gelmeyebilir; recipient_user_id (BSUID) her zaman gelir
    const adaylar = [s.recipient_id, s.recipient_user_id].map(x => String(x || '')).filter(Boolean);
    if (!adaylar.length || !s.id) { atlandi('', `durum: alıcı / id yok s=${anahtarOzeti(s)}`); return; }
    const waId = adaylar[0];
    let ref = null, snap = null;
    // 2026-10-10 öncesi 0850 konuşmalarının belge kimliği yalnızca waId'dir (yeni kimlik bulunamazsa o denenir)
    const kimlikler = [...adaylar.map(a => konusmaKimligi(hat, a)), ...(hat.marka === 'depoevim' ? adaylar : [])];
    for (const kimlik of kimlikler) {
      ref = mesajlarRef(db, kimlik, appId).doc(String(s.id));
      snap = await ref.get();
      if (snap.exists) break;
    }
    if (!snap.exists) return; // bu sistemden gönderilmemiş mesaj
    const d = snap.data() || {};
    const zaman = Number(s.timestamp) > 0 ? new Date(Number(s.timestamp) * 1000).toISOString() : iso();
    if (s.status === 'failed') {
      const hata = metaHatasiCoz({ error: s.errors?.[0] || {} }, 200);
      await ref.set({ status: 'failed', statusAt: zaman, hata: { kod: hata.kod, mesaj: hata.mesaj } }, { merge: true });
      console.error('[whatsapp] mesaj iletilemedi', maskele(waId), hata.kod, hata.mesaj);
      if (hata.kalici) await uyariYaz(db, hata, iso(), appId);
      return;
    }
    if ((DURUM_SIRASI[s.status] || 0) > (DURUM_SIRASI[d.status] || 0)) await ref.set({ status: s.status, statusAt: zaman }, { merge: true });
  }

  // ---- eşlenmemiş numara uyarısı (CRM WhatsApp sekmesinde kırmızı bant) — whatsapp_durum/numara
  async function numaraUyarisiYaz(db, numaraId) {
    await durumRef(db, appId, 'numara').set({
      aktif: true, tur: 'numara', phoneNumberId: numaraId, tarih: iso(),
      mesaj: `WhatsApp: eşlemede olmayan bir numaraya (phone_number_id ${numaraId}) mesaj geldi — mesajlar kaydedildi ama bot cevap vermiyor. Vercel'de WHATSAPP_NUMARALAR'a ekleyin.`,
    }, { merge: true });
  }
  // O numara eşlemeye eklendikten sonraki ilk mesajda bant kalkar (yalnızca aynı numaranın uyarısıysa)
  async function numaraUyarisiTemizle(db, numaraId) {
    const ref = durumRef(db, appId, 'numara');
    const s = await ref.get();
    if (s.exists && s.data()?.aktif && s.data()?.phoneNumberId === numaraId) await ref.set({ aktif: false, cozuldu: iso() }, { merge: true });
  }

  async function olaylariIsle(payload) {
    const db = getDb();
    const isler = [];
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        if (change?.field !== 'messages') { console.log('[whatsapp] atlandı', '-', `messages dışı alan (${change?.field || '-'})`); continue; }
        const v = change.value || {};
        const numaraId = String(v.metadata?.phone_number_id || '');
        const mesajlarListesi = v.messages || [];
        const hat = hatBul(env, numaraId);
        if (!hat) {
          // YENİ (2026-10-10): eşlemede olmayan numara — mesaj KAYDEDİLİR, bot cevap vermez, uyarı loglanır
          if (!numaraId) { mesajlarListesi.forEach(m => atlandi(musteriCoz(m, v.contacts).kimlik, `phone_number_id yok ${yapiOzeti(m, v.contacts)}`)); continue; }
          if (mesajlarListesi.length) {
            console.warn('[whatsapp] UYARI eşlenmemiş numara', maskele(numaraId), `— ${mesajlarListesi.length} mesaj kaydedildi, bot cevap vermiyor. WHATSAPP_NUMARALAR'a ekleyin.`);
            isler.push(numaraUyarisiYaz(db, numaraId));
          }
          const eh = eslenmemisHat(env, numaraId);
          mesajlarListesi.forEach(m => isler.push(mesajIsle(db, eh, m, v.contacts || [])));
          continue;
        }
        if (mesajlarListesi.length) isler.push(numaraUyarisiTemizle(db, numaraId));
        (v.statuses || []).forEach(s => isler.push(durumIsle(db, hat, s)));
        mesajlarListesi.forEach(m => isler.push(mesajIsle(db, hat, m, v.contacts || [])));
      }
    }
    const sonuc = await Promise.allSettled(isler);
    sonuc.filter(r => r.status === 'rejected').forEach(r => console.error('[whatsapp] olay işlenemedi:', r.reason?.message || r.reason));
  }

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      if (q['hub.mode'] === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && q['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(String(q['hub.challenge'] || ''));
        return;
      }
      res.status(403).json({ error: 'Doğrulama başarısız' });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!env.WHATSAPP_APP_SECRET || !appId) { console.error('[whatsapp] WHATSAPP_APP_SECRET / FIRESTORE_APP_ID tanımlı değil'); res.status(500).json({ error: 'Sunucu yapılandırma hatası' }); return; }

    let ham;
    try { ham = await hamGovdeOku(req); } catch { res.status(400).json({ error: 'Gövde okunamadı' }); return; }
    if (!imzaGecerliMi(ham, req.headers['x-hub-signature-256'], env.WHATSAPP_APP_SECRET)) { console.warn('[whatsapp] atlandı', '-', 'geçersiz imza (401)'); res.status(401).json({ error: 'Geçersiz imza' }); return; }
    let payload;
    try { payload = JSON.parse(ham.toString('utf8')); } catch { res.status(400).json({ error: 'Geçersiz JSON' }); return; }

    // Meta'ya hızlı 200 — asıl iş arka planda (waitUntil)
    arkaPlanda(olaylariIsle(payload).catch(err => console.error('[whatsapp] arka plan hatası:', err?.message || err)));
    res.status(200).json({ ok: true });
  };
}

export default handlerOlustur();
