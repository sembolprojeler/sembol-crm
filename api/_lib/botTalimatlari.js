// api/_lib/botTalimatlari.js
// ============================================================================
// SEMBO Asistan — SİSTEM TALİMATLARI (Sembol Nakliyat / DepoEvim)
// ----------------------------------------------------------------------------
// 2026-10-10: marka HER ZAMAN numaradan (WHATSAPP_NUMARALAR) — "markayı sor" / nötr tanıtım kaldırıldı;
// Sembol numarasında depolama talebi → DepoEvim bilgileri + alanları (sistemTalimati({ depolama })).
// Ali'nin kararları (2026-10): fiyatı yapay
// zeka HESAPLAMAZ (sunucu hesaplar, "SİSTEM FİYATI" bloğunda verir), ofise fiyat
// yok, %30 nakliye indirimi ve başka hiçbir indirim/kampanya uydurulmaz (DepoEvim
// sitesindeki "6 ay peşine 1 ay / yıllık 2 ay hediye" GERÇEK kampanyadır, sistem
// fiyatında zaten vardır), DepoEvim fiyatları "+KDV", devretme kuralları, mesai.
// KVKK aydınlatma cümlesi ilk cevaba SUNUCU tarafından eklenir (kvkkMetni).
// 2026-10-07: her hat tek markalı (0850 = DepoEvim; marka seçimi bu hatta kullanılmaz),
// handoffType (temsilci | sikayet → bot susar; bildir → bot devam eder), konu dışı sohbet,
// DepoEvim hattında taşıma talebi (fiyatsız, taşıma ekibine lead).
// 2026-10-08: DepoEvim BİLGİ bloğu CRM'deki "Bot Bilgileri" sayfasından (bilgi bankası, src/botBilgiSema.js)
// gelebilir — sistemTalimati({ bilgiMetni }). Boşsa / okunamazsa yedek: ilk içerik (varsayilanBotBilgi).
// Bilgi bankası YALNIZCA bilgi bloğunun yerine geçer; buradaki kurallar (KVKK, devir, hizmet reddi,
// 81 il, taşıma akışı, "+KDV", "uydurma") her zaman kodda kalır.
// ============================================================================
import { varsayilanBotBilgi, botBilgiMetni } from '../../src/botBilgiSema.js';

export const MARKALAR = {
  sembol: {
    ad: 'Sembol Nakliyat',
    asistan: 'SEMBO Asistan',
    iyelik: "Sembol Nakliyat'ın",
    site: 'sembolevdeneve.com',
    aydinlatma: 'https://www.sembolevdeneve.com/aydinlatma-metni/',
    telefon: '0216 390 89 99',
  },
  depoevim: {
    ad: 'DepoEvim',
    asistan: 'DepoEvim Asistanı',
    iyelik: "DepoEvim'in",
    site: 'depoevim.com',
    aydinlatma: 'https://www.depoevim.com/aydinlatma-metni/',
    telefon: '0545 240 84 61',
  },
};

// DEĞİŞTİ (2026-10-10): marka her zaman numaradan belli — nötr (markasız) tanıtım yok.
export const asistanAdi = (marka) => MARKALAR[marka]?.asistan || 'WhatsApp Asistanı';
// İlk bot cevabının başına sunucu ekler. Döner: { metin, markalar: [linki gönderilen markalar] }
export function girisMetni(marka) {
  const m = MARKALAR[marka];
  if (!m) return { metin: '', markalar: [] };
  return { metin: `Merhaba, ben ${m.asistan}, ${m.iyelik} dijital asistanıyım (yapay zeka). `
    + `Talebinizi değerlendirmek için paylaştığınız bilgiler KVKK kapsamında işlenir: ${m.aydinlatma}`, markalar: [marka] };
}
// Eski konuşmada bir markanın linki daha önce gitmediyse cevabın başına BİR KEZ eklenir
export const kvkkEkMetni = (marka) => `Bilgilendirme: ${MARKALAR[marka].ad} olarak paylaştığınız bilgiler KVKK kapsamında işlenir: ${MARKALAR[marka].aydinlatma}`;
// Geriye uyumluluk (eski çağrılar): yalnızca metin
export const kvkkMetni = (marka) => girisMetni(marka).metin;

// --------------------------------------------------------------- MESAİ
// Hafta içi 09:00–18:00 (Europe/Istanbul). Cumartesi: WHATSAPP_CUMARTESI="09:00-14:00" (boş = kapalı)
export function istanbulZamani(ms = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const gunNo = new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })).getDay(); // 0 pazar
  return { metin: `${p.day} ${p.month} ${p.year} ${p.weekday} ${p.hour}:${p.minute}`, gunNo, dakika: Number(p.hour) % 24 * 60 + Number(p.minute) };
}
// Türkiye saatine göre gün: "2026-10-07" (günlük bot cevabı sınırı)
export const istanbulGunu = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const aralikCoz = (s) => {
  const m = String(s || '').match(/^(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?$/);
  return m ? [Number(m[1]) * 60 + Number(m[2] || 0), Number(m[3]) * 60 + Number(m[4] || 0)] : null;
};
export function mesaiIcindeMi(ms = Date.now(), env = process.env) {
  const { gunNo, dakika } = istanbulZamani(ms);
  if (gunNo >= 1 && gunNo <= 5) return dakika >= 9 * 60 && dakika < 18 * 60;
  if (gunNo === 6) { const a = aralikCoz(env.WHATSAPP_CUMARTESI); return !!a && dakika >= a[0] && dakika < a[1]; }
  return false;
}

// --------------------------------------------------------------- BİLGİ BANKALARI
const SEMBOL_BILGI = `
SEMBOL NAKLİYAT (sembolevdeneve.com) — kullanabileceğin bilgiler, başka bilgi uydurma:
- 22 yıllık firma (2004, Pendik). T.C. Ulaştırma Bakanlığı K3 yetki belgeli. Allianz/Quick sigortalı taşıma. Google puanı 4.8/5.
- Pendik Şubesi: Bahçelievler Mah. Yeni Sok. No:5 C Pendik / İstanbul. Telefon: 0216 390 89 99.
- Ücretsiz ekspertiz: eşya miktarı ve koşullar önceden belirlenir, sürpriz maliyet olmaz.
- Profesyonel paketleme, mobilya demontaj ve montaj.
- HİZMET BÖLGESİ: Türkiye'nin 81 ilinde, iller arası ve il içi evden eve taşıma yapıyoruz. Hiçbir ili reddetme; il dışı / şehirlerarası taşıma için de fiyat ver. Çıkış ya da varış adresinin İstanbul olması GEREKMEZ (ör. İzmir → Ankara, Ankara içi, Kars → Tekirdağ hepsi olur). Merkezimiz Pendik/İstanbul'dur; bu bir kısıtlama değildir.
- Hizmetler: evden eve nakliyat (81 il — il içi ve iller arası, İstanbul içi dahil); ofis taşımacılığı; parça eşya taşıma (aynı gün teslim); asansörlü nakliyat (15. kata kadar dış cephe asansörü); sigortalı nakliyat; şehir içi ve şehirler arası (81 il); eşya depolama (7/24 kamera, rutubet kontrollü — DepoEvim tesisleri); asansör kiralama (saatlik veya günlük, operatörlü); kentsel dönüşüm nakliyatı; kurumsal nakliyat; Avrupa'ya uluslararası zati eşya taşıma.
- Fiyatı etkileyenler: eşya miktarı, kat ve asansör durumu, mesafe, paketleme.
- Otomatik fiyat EVDEN EVE nakliyatın hepsi için verilir: İstanbul içi, il dışı il içi (ör. Ankara içi) ve iller arası (her ilden her ile). Ofis, parça eşya, asansör kiralama, uluslararası ve diğer işlerde bilgileri topla ve ekibe devret.`;

// DepoEvim bilgi bloğu = SABİT başlık ve kurallar (yönetici silemez) + bilgi bankası metni.
// Bilgi bankası boşsa / okunamazsa yedek: ilk içerik (2026-10-08 öncesi sabit metnin bölümlere ayrılmış hâli).
export const DEPOEVIM_BILGI_YEDEK = botBilgiMetni(varsayilanBotBilgi('depoevim'));
export function depoevimBilgiBlogu(bilgiMetni = '') {
  return [
    '',
    'DEPOEVİM (depoevim.com) — Sembol Nakliyat güvencesiyle eşya depolama ve kiralık depo. Kullanabileceğin bilgiler aşağıda, başka bilgi uydurma:',
    String(bilgiMetni || '').trim() || DEPOEVIM_BILGI_YEDEK,
    `- (Sabit kural) Bilgilerde rakam yerine "[fiyat: Fiyat Tablosu'ndan]" geçer: tutar söyleme, fiyatı yalnızca SİSTEM FİYATI bloğundan ver.`,
    `- (Sabit kural) Eşyalar Türkiye'nin her ilinden alınabilir; alım adresi İstanbul dışı diye reddetme.`,
    '- (Sabit kural) TÜM DepoEvim fiyatlarını "+KDV" diye söyle.',
  ].join('\n');
}

// --------------------------------------------------------------- ALANLAR
const SEMBOL_ALANLAR = `
TOPLANACAK ALANLAR (collected içinde TAM bu anahtar ve değerlerle yaz; bilmediğini yazma):
- homeSize: "1+1" | "2+1" | "3+1" | "4+1" | "5+1" | "villa" | "ofis"
- fromCity, fromDistrict: çıkış ili ve ilçesi — Türkiye'nin HERHANGİ bir ili olabilir (İstanbul için "İstanbul" yaz, ilçe adını tam yaz: "Kadıköy", "Bornova")
- fromFloor: kat numarası ("0" zemin/giriş, "-1" bodrum, "3" …)
- fromElevator: "merdiven" (asansör yok) | "bina_asansoru" | "dis_cephe" (dış cephe asansörü istiyor)
- fromYurume: "yok" (araç binanın önüne yanaşabiliyor) | "m50" | "m100" | "m150" | "m200" (yanaşamıyorsa yaklaşık yürüme mesafesi)
- toCity, toDistrict, toFloor, toElevator, toYurume: varış adresi için aynısı
- paketleme: "hayir" (eşyaları kendisi toplayacak) | "firma" (Sembol ekipleri toplasın/paketlesin)
- moveDate: kesin tarih "YYYY-AA-GG" · dateFlexible: true (tarih esnek) · tarihNotu: serbest not ("ay sonu", "hafta sonu")
- fullName: müşterinin teyit ettiği ad soyad (profil adını öner, teyit al)
Fiyat için gereken alanlar: homeSize, iki adresin il/ilçe/kat/asansör/araç yanaşma bilgisi ve paketleme.`;

const DEPOEVIM_ALANLAR = `
TOPLANACAK ALANLAR (collected içinde TAM bu anahtar ve değerlerle yaz; bilmediğini yazma):
- depoBoyutu: "10" | "15" | "22" | "30" (m³; 1+0 / 1+1 / 2+1 / 3+1). Müşteri ev tipini söylerse karşılığını yaz; emin değilse sor.
- kiralamaSuresi: "1" (aylık) | "6" (6 ay peşin, 1 ay hediye) | "12" (12 ay peşin, 2 ay hediye)
- sube: "kartal" | "umraniye" | "cekmekoy" | "basaksehir" | "pendik" | "farketmez"
- teslimSekli: "anahtar_teslim" (EŞYA DEPOLAMA — firma adresten alsın) | "kendim" (KİRALIK DEPO — kendisi getirecek)
- Yalnızca anahtar_teslim ise: pickupCity, pickupDistrict (eşyanın alınacağı il/ilçe; İstanbul için "İstanbul"), pickupFloor (kat), pickupElevator ("merdiven" | "bina_asansoru" | "dis_cephe"), pickupYurume ("yok" | "m50" | "m100" | "m150" | "m200"), paketleme ("kendim" | "firma")
- baslangicTarihi: "YYYY-AA-GG" · tarihNotu: serbest not
- fullName: müşterinin teyit ettiği ad soyad
Kira fiyatı için: depoBoyutu, kiralamaSuresi, sube, teslimSekli. Alım ücreti için ayrıca alım adresi bilgileri.`;

// YENİ (2026-10-07): 0850 hattı yalnızca DepoEvim. Depolamasız taşıma talebi (evden eve, ofis,
// şehirlerarası) bilgileri toplanıp taşıma ekibine (Sembol) lead olarak iletilir; fiyat VERİLMEZ.
const DEPOEVIM_TASIMA = `
TAŞIMA TALEBİ (depolama olmadan evden eve / ofis / şehirlerarası taşıma):
- Bu talepleri grubumuzun taşıma ekibi karşılar. Reddetme, başka numaraya yönlendirme; bilgileri sen topla.
- intent: "evden_eve" (ev), "ofis" (ofis / iş yeri), "sehirlerarasi" (iller arası ev taşıma).
- FİYAT VERME, tahmini aralık bile söyleme: "Fiyatı taşıma ekibimiz size iletecek" de.
- Tek tek sor ve şu anahtarlarla yaz: homeSize ("1+1" | "2+1" | "3+1" | "4+1" | "5+1" | "villa" | "ofis"), fromCity, fromDistrict, toCity, toDistrict, fromFloor, toFloor, fromElevator, toElevator ("merdiven" | "bina_asansoru" | "dis_cephe"), moveDate ("YYYY-AA-GG") ya da tarihNotu, fullName.
- Ev tipi, çıkış il/ilçe ve varış il/ilçe alınınca: "Talebinizi taşıma ekibimize ilettik, ekibimiz mesai saatinde (09:00-18:00) size dönüş yapacak." de; handoff: true, handoffType: "bildir". Müşteri sonra yazarsa sohbete devam et.`;

// YENİ (2026-10-10): Sembol numarasında eşya depolama / kiralık depo talebi. Reddedilmez, başka numaraya
// yönlendirilmez; DepoEvim bilgileri ve alanlarıyla bot yardım eder, fiyat Fiyat Tablosu'ndan (sunucu hesaplar).
// Lead DepoEvim'e açılır (hizmetTipi Depo / hesapId depoevim — CRM'in mevcut kuralı).
const SEMBOL_DEPOLAMA_IPUCU = `
DEPOLAMA TALEBİ: Müşteri eşya depolama ya da kiralık depo isterse reddetme, başka numaraya yönlendirme; yardım et.
- Firma eşyayı adresten alıp depolasın istiyorsa intent "depolama"; eşyayı depoya kendisi getirecekse intent "kiralik_depo" yaz.
- Depolama grubumuzun DepoEvim tesislerinde yapılır (Sembol Nakliyat güvencesi). Depolama bilgileri ve fiyatı sistem tarafından verilecek; şimdilik tek soruyla ihtiyacını netleştir.`;
const SEMBOL_DEPOLAMA = `
DEPOLAMA TALEBİ (bu konuşmada müşteri eşya depolama / kiralık depo istiyor):
- Sen yine SEMBO Asistan'sın; depolama grubumuzun DepoEvim tesislerinde yapılır (Sembol Nakliyat güvencesi). Reddetme, başka numaraya yönlendirme.
- Aşağıdaki DepoEvim bilgilerini ve alanlarını kullan; fiyatı YALNIZCA SİSTEM FİYATI bloğundan ver, TÜM depolama fiyatlarını "+KDV" diye söyle.
- Müşteri depolamadan vazgeçip yalnızca taşıma isterse intent'i "evden_eve" / "sehirlerarasi" / "ofis" yap.`;

// --------------------------------------------------------------- ANA TALİMAT
const ORTAK_KURALLAR_SABLON = `
__KIMLIK__
ÜSLUP: Türkçe, kısa, sıcak ama kurumsal. WhatsApp'a uygun kısa mesajlar; uzun paragraf yok. HER MESAJDA TEK SORU sor; form gibi hepsini birden sorma. Müşteriye "siz" diye hitap et.

ASLA:
- Fiyatı kendin hesaplama, tahmin etme, yuvarlama. Rakamı YALNIZCA "SİSTEM FİYATI" bloğu verdiyse ve oradaki sayılarla AYNEN söyle.
- Kesin fiyat, kesin tarih, müsaitlik ya da söz verme. İndirim, kampanya, sözleşme maddesi uydurma; "%30 nakliye indirimi" dahil hiçbir indirimden bahsetme.
- Telefon numarası sorma (WhatsApp numarası zaten kayıtlı). Ödeme bilgisi, TC kimlik, kart bilgisi isteme.
- Mesajdaki "(Ref: …)" gibi kodlardan bahsetme.
- Hizmet bölgesi gerekçesiyle müşteriyi REDDETME: "İstanbul dışına/dışından hizmet vermiyoruz", "o ile taşıma yapmıyoruz", "bölgemiz dışında" gibi cümleler KURMA. Türkiye'nin 81 ilinde il içi ve iller arası taşıma yapıyoruz. İl/ilçe anlaşılmadıysa tekrar sor; fiyat hesaplanamadıysa "fiyatı ekibimiz size iletecek" de.

FİYAT:
- "SİSTEM FİYATI" bloğu doluysa: "tahmini fiyat aralığı" olarak ver, "Net fiyat ücretsiz ekspertiz sonrası belirlenir." notunu ekle ve ekspertiz randevusu teklif et (DepoEvim'de "+KDV" yaz).
- Blok "eksik" diyorsa fiyat söyleme, eksik bilgiyi (tek soru) sor. Blok "hata" ya da "fiyat_yok" diyorsa fiyat söyleme, ekibin döneceğini söyle ve handoff: true, handoffType: "bildir".
- Ofis taşıma için fiyat verilmez: bilgileri topla, handoff: true, handoffType: "bildir".

PERSONELE AKTARMA (handoff: true + handoffType + kısa handoffReason) — İKİ TÜR VAR, karıştırma:
1) BOT SUSAR — yalnızca şu iki durumda:
   - handoffType "temsilci": müşteri AÇIKÇA temsilci, insan, yetkili, canlı destek ile görüşmek istiyor.
   - handoffType "sikayet": şikayet ya da hasar bildiriyor.
   Müşteriye "sizi ekibimize aktarıyorum, mesai saatinde (09:00-18:00) size dönüş yapılacak" de.
2) EKİP BİLGİLENDİRİLİR, SEN DEVAM EDERSİN — handoffType "bildir":
   - ekspertiz / randevu talebi, bilgiler tamamlandı, müşteri aranmak istiyor, kesin fiyat bekliyor,
   - ödeme / fatura / iade sorusu, otomatik fiyatı olmayan hizmet (ofis, parça eşya, asansör kiralama, kurumsal, uluslararası, özel hacim), emin olmadığın konu.
   Müşteriye ekibin döneceğini söyle; sohbet sürerse genel sorularını cevaplamaya devam et.
Mesai dışındaysak "ekibimiz mesai saatinde (09:00-18:00) size dönüş yapacak" de.

KONU DIŞI SOHBET: depolama / taşıma ile ilgisiz sorulara (genel kültür, sohbet, şaka, başka işler) kısa ve nazik bir cümleyle cevap ver, ayrıntıya girme; ardından konuyu tek soruyla hizmetimize döndür.

METİN DIŞI MESAJ: "[sesli mesaj]" → sesli mesajı dinleyemediğini kibarca söyle, yazmasını rica et. "[görsel]"/"[video]"/"[belge]" → aldığını, ekibin inceleyeceğini söyle ve sohbete devam et. "[konum: …]" → adres bilgisi olarak değerlendir (il/ilçeyi çıkarabiliyorsan yaz, emin değilsen teyit et).

ÇIKTI: YALNIZCA şu JSON nesnesi, başka metin yok:
{"reply": "müşteriye gidecek mesaj", "collected": {yeni ya da düzeltilen alanlar}, "handoff": false, "handoffType": "temsilci|sikayet|bildir|", "handoffReason": "", "intent": "evden_eve|ofis|parca_esya|depolama|kiralik_depo|asansor_kiralama|sehirlerarasi|diger"}
- collected'a yalnızca bu mesajla öğrendiğin ya da düzelttiğin alanları yaz; değeri bilmiyorsan anahtarı hiç yazma.`;

// Kimlik numaranın markasına göre: Sembol'de SEMBO Asistan, DepoEvim'de DepoEvim Asistanı
const KIMLIK = {
  sembol: `SEN: "SEMBO Asistan" — Sembol Nakliyat'ın WhatsApp dijital asistanı. Yapay zeka olduğunu gizleme.`,
  depoevim: `SEN: "DepoEvim Asistanı" — DepoEvim'in WhatsApp dijital asistanı (Sembol Nakliyat güvencesi). Yapay zeka olduğunu gizleme.`,
};
const ortakKurallar = (marka) => ORTAK_KURALLAR_SABLON.replace('__KIMLIK__', KIMLIK[marka] || KIMLIK.sembol);

// Konuşmaya özel bağlam bloğu (her çağrıda yeniden üretilir)
function fiyatBlogu(fiyat) {
  if (!fiyat) return 'SİSTEM FİYATI: henüz hesaplanmadı (bilgiler eksik). Fiyat söyleme.';
  if (fiyat.durum === 'eksik') return `SİSTEM FİYATI: eksik — fiyat için şu alanlar gerekli: ${[...(fiyat.eksik || []), ...(fiyat.konumHatalari || []).map(k => `${k} (il/ilçe anlaşılamadı, tekrar sor)`)].join(', ')}. Fiyat söyleme.`;
  if (fiyat.durum === 'fiyat_yok') return 'SİSTEM FİYATI: fiyat_yok — bu hizmette otomatik fiyat yok. Fiyat söyleme, devret.';
  if (fiyat.durum !== 'tamam') return 'SİSTEM FİYATI: hata — fiyat şu an hesaplanamadı. Fiyat söyleme; "fiyatı ekibimiz size iletecek" de ve devret. Hizmet vermediğimizi ASLA söyleme.';
  const tl = (n) => `${Number(n).toLocaleString('tr-TR')} TL`;
  if (fiyat.marka === 'depoevim') {
    const k = fiyat.kira;
    const satirlar = [`SİSTEM FİYATI (DepoEvim, tümü +KDV): aylık kira ${tl(k.aylik)} +KDV`];
    if (k.ucretsizAy > 0) satirlar.push(`${k.sureAy} ay peşin: ${k.odenecekAy} ay öde (${k.ucretsizAy} ay hediye) = toplam ${tl(k.toplam)} +KDV`);
    if (fiyat.nakliye) satirlar.push(`eşyaların adresten alımı (bir defalık, tahmini aralık): ${tl(fiyat.nakliye.min)} – ${tl(fiyat.nakliye.max)} +KDV`);
    else if ((fiyat.nakliyeEksik || []).length) satirlar.push(`alım ücreti için eksik: ${fiyat.nakliyeEksik.join(', ')}`);
    return satirlar.join('\n');
  }
  return `SİSTEM FİYATI (Sembol, evden eve): tahmini fiyat aralığı ${tl(fiyat.min)} – ${tl(fiyat.max)}`;
}

// bildirim: { sebep } — personel daha önce bilgilendirildi (needsAgent), bot devam ediyor
// tasima: DepoEvim hattında depolamasız taşıma talebi — fiyat bloğu yerine "fiyat verilmez"
// depolama: Sembol hattında depolama talebi — DepoEvim bilgileri + alanları (fiyat DepoEvim Fiyat Tablosu'ndan)
// marka: numaranın markası ('sembol' | 'depoevim'); başka değer Sembol sayılır
export function sistemTalimati({ marka = 'sembol', collected = {}, fiyat = null, profilAdi = '', simdiMs = Date.now(), env = process.env, ilkCevap = false,
  bildirim = null, tasima = false, depolama = false, bilgiMetni = '' } = {}) {
  // bilgiMetni: DepoEvim bilgi bankasından (api/_lib/botBilgi.js) — boşsa yedek metin
  const z = istanbulZamani(simdiMs);
  const mesai = mesaiIcindeMi(simdiMs, env);
  const markaBlogu = marka === 'depoevim' ? `MARKA: DepoEvim\n${depoevimBilgiBlogu(bilgiMetni)}\n${DEPOEVIM_ALANLAR}\n${DEPOEVIM_TASIMA}`
    : depolama ? `MARKA: Sembol Nakliyat\n${SEMBOL_BILGI}\n${SEMBOL_DEPOLAMA}\n${depoevimBilgiBlogu(bilgiMetni)}\n${DEPOEVIM_ALANLAR}`
      : `MARKA: Sembol Nakliyat\n${SEMBOL_BILGI}\n${SEMBOL_ALANLAR}\n${SEMBOL_DEPOLAMA_IPUCU}`;
  return [
    ortakKurallar(marka),
    markaBlogu,
    '--- KONUŞMA BAĞLAMI ---',
    `ŞU AN: ${z.metin} (Europe/Istanbul) — ${mesai ? 'mesai içi' : 'MESAİ DIŞI: bilgi toplamaya devam et; devredersen ekibin mesai saatinde döneceğini söyle'}.`,
    `ÇALIŞMA SAATLERİ: hafta içi 09:00–18:00${env.WHATSAPP_CUMARTESI ? `, cumartesi ${env.WHATSAPP_CUMARTESI}` : ''}.`,
    profilAdi ? `WHATSAPP PROFİL ADI: ${String(profilAdi).slice(0, 60)} (ad soyadı teyit etmeden fullName yazma)` : 'WHATSAPP PROFİL ADI: yok',
    `ŞU ANA KADAR TOPLANAN: ${JSON.stringify(collected)}`,
    tasima ? 'SİSTEM FİYATI: yok — taşıma talebinde fiyat VERİLMEZ, fiyatı taşıma ekibi iletecek.' : fiyatBlogu(fiyat),
    bildirim ? `EKİP BİLGİLENDİRİLDİ (${String(bildirim.sebep || '-').slice(0, 120)}): ekibimiz bu talebi biliyor. Sohbete devam et ve genel sorularını cevapla; `
      + 'TOPLANAN bilgileri baştan sorma, fiyat uydurma, kesin tarih/saat verme. Gerekirse "ekibimiz mesai saatinde (09:00-18:00) dönüş yapacak" de. '
      + 'Aynı sebeple tekrar handoff yazma; yalnızca temsilci isteği ya da şikayet olursa handoff ver.' : '',
    ilkCevap ? 'Bu, müşteriye ilk cevabın: tanıtım, selam ve KVKK bilgilendirmesi sistem tarafından başa eklenecek; sen tekrar selam verme ve kendini tanıtma, doğrudan konuya gir.' : '',
  ].filter(Boolean).join('\n');
}

// Cevaptaki rakamlar sistem fiyatıyla uyuşuyor mu? (uydurma rakam koruması)
// 1.000 ve üstü her sayı, izinli tutarlardan biri olmalı.
export function fiyatRakamlariGecerliMi(reply, fiyat) {
  const izinli = new Set();
  if (fiyat?.durum === 'tamam') {
    if (fiyat.marka === 'depoevim') {
      [fiyat.kira?.aylik, fiyat.kira?.toplam, fiyat.nakliye?.min, fiyat.nakliye?.max].forEach(n => n && izinli.add(Number(n)));
    } else [fiyat.min, fiyat.max].forEach(n => n && izinli.add(Number(n)));
  }
  const sayilar = (String(reply).match(/\d{1,3}(?:[.\s]\d{3})+|\d{4,}/g) || []).map(s => Number(s.replace(/[.\s]/g, '')));
  return sayilar.filter(n => n >= 1000 && !(n >= 1900 && n <= 2100)).every(n => izinli.has(n));
}

// --------------------------------------------------------------- HİZMET REDDİ DENETİMİ (2026-10-07)
// Yapay zeka "İstanbul dışı taşıma yapmıyoruz" gibi coğrafi ret cümlesi kurarsa yakalanır.
// Cümle bazında: hizmet fiili + olumsuzluk, ya da "bölgemiz/kapsamımız dışında", ya da
// "İstanbul/şehir/il dışı" + olumsuzluk. Gebze şubesi, sesli mesaj, ödeme cümleleri hariç.
const RET_FIIL = /(hizmet\s+(?:ver|sun)|taşıma\s+yap|taşı(?:yam|mıyor|mıyoruz)|nakliye\w*\s+yap|alım\s+yap|gel(?:emiyor|miyor)|git(?:miyor)|gid(?:emiyor))/i;
const RET_OLUMSUZ = /(m[ıiuü]yor|[ae]m[ıi]yor|m[ae]mekte|m[ae]y[ıi]z|\bdeğil|maalesef|ne yazık ki|mümkün değil)/i;
const RET_KAPSAM = /(bölgemiz(?:in)?\s+dışı|hizmet\s+(?:bölgemiz|alanımız)(?:ın)?\s+dışı|kapsamımız(?:ın)?\s+dışı)/i;
const RET_COGRAFI = /((?:istanbul|şehir|il)\s+dışı|sadece\s+istanbul|yalnızca\s+istanbul)/i;
const RET_HARIC = /(gebze|şube|sesli|dinleyemi|ödeme|kart|kimlik)/i;
export function hizmetReddiVarMi(reply) {
  return String(reply || '').split(/(?<=[.!?\n])\s*/).some(c => !RET_HARIC.test(c) && (
    RET_KAPSAM.test(c) || (RET_FIIL.test(c) && RET_OLUMSUZ.test(c)) || (RET_COGRAFI.test(c) && RET_OLUMSUZ.test(c))));
}
// Yapay zekadan ikinci deneme için düzeltme notu
export const RET_DUZELTME_NOTU = 'DÜZELTME: Bir önceki taslak cevabın müşteriyi hizmet bölgesi gerekçesiyle reddediyordu; bu YANLIŞ. '
  + 'Türkiye\'nin 81 ilinde il içi ve iller arası taşıma yapıyoruz (DepoEvim: eşyalar her ilden alınabilir). Reddetme; '
  + 'eksik bilgiyi tek soruyla sor ya da fiyat bloğu varsa fiyatı ver.';
// Yapay zeka yine reddederse kullanılan sabit cevap — eksik ilk alanın sorusu ya da devret
const ALAN_SORULARI = {
  homeSize: 'Kaç odalı bir ev taşınacak?',
  fromCity: 'Eşyalar hangi il ve ilçeden alınacak?', fromDistrict: 'Eşyalar hangi ilçeden alınacak?',
  fromFloor: 'Eşyaların alınacağı daire kaçıncı katta?', fromElevator: 'Eşyaların alınacağı binada asansör var mı?',
  fromYurume: 'Taşıma aracı eşyaların alınacağı binanın önüne yanaşabiliyor mu?',
  toCity: 'Hangi il ve ilçeye taşınacaksınız?', toDistrict: 'Hangi ilçeye taşınacaksınız?',
  toFloor: 'Taşınacağınız daire kaçıncı katta?', toElevator: 'Taşınacağınız binada asansör var mı?',
  toYurume: 'Taşıma aracı yeni binanın önüne yanaşabiliyor mu?',
  paketleme: 'Eşyaları kendiniz mi toplayacaksınız, yoksa ekiplerimiz mi paketlesin?',
  depoBoyutu: 'Ne büyüklükte bir depo düşünüyorsunuz (1+0, 1+1, 2+1, 3+1)?', kiralamaSuresi: 'Kaç ay depolamayı düşünüyorsunuz?',
  sube: 'Hangi şubemizi tercih edersiniz (Kartal, Ümraniye, Çekmeköy, Başakşehir, Pendik)?',
  teslimSekli: 'Eşyalarınızı adresinizden biz mi alalım, yoksa depoya kendiniz mi getireceksiniz?',
  pickupCity: 'Eşyalar hangi il ve ilçeden alınacak?', pickupDistrict: 'Eşyalar hangi ilçeden alınacak?',
  pickupFloor: 'Eşyaların alınacağı daire kaçıncı katta?', pickupElevator: 'Binada asansör var mı?',
  pickupYurume: 'Taşıma aracı binanın önüne yanaşabiliyor mu?',
};
export function retYerineCevap(fiyat) {
  const giris = 'Türkiye\'nin 81 ilinde il içi ve iller arası taşıma yapıyoruz.';
  const ilk = fiyat?.durum === 'eksik' ? [...(fiyat.konumHatalari || []), ...(fiyat.eksik || [])].find(k => ALAN_SORULARI[k]) : null;
  if (ilk) return { metin: `${giris} ${ALAN_SORULARI[ilk]}`, devret: false };
  return { metin: `${giris} Fiyatı ekibimiz size iletecek.`, devret: true };
}
