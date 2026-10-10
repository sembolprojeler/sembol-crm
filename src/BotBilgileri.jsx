// src/BotBilgileri.jsx
// ============================================================================
// Sembol CRM — SİSTEM DOSYALARI > BOT BİLGİLERİ (2026-10-08)
// ----------------------------------------------------------------------------
// WhatsApp botunun bildiği bilgileri yöneticiler düzenler (kod / deploy gerekmez):
//   • Bölüm bölüm metin kutuları + SSS listesi (ekle / sil / sırala), karakter sayacı ve sınırı
//   • Kaydet (son kaydeden + tarih), son 10 sürüm ve "bu sürüme geri dön"
//   • Word'den içe aktar: .docx (≤ 5 MB) TARAYICIDAN crm/upload.php'ye yüklenir (arşiv), metin
//     TARAYICIDA mammoth ile çıkarılır, bölümlere dağıtılır; TASLAK olarak gelir, bölüm bölüm
//     Değiştir / Ekle / Yoksay — Kaydet'e basılmadan bota yansımaz. Yükleme başarısızsa içerik
//     yine aktarılır, sürüme yalnızca dosya adı yazılır.
//   • Dene: kayıtlı bilgi ya da ekrandaki taslakla botun cevabı (müşteriye hiçbir şey gitmez)
//   • YENİ (2026-10-10): ÖRNEK SOHBETLER — her marka için ayrı (Sembol açılınca kendi sayfasında görünür).
//     Gerçek konuşmalardan örnekler; bot üslubu / soru sırasını / cevap biçimini bunlardan öğrenir.
//     Elle yazılır ya da WhatsApp "Sohbeti dışa aktar" (.txt) dosyasından aktarılır; telefon ve e-posta
//     otomatik maskelenir. icerik.ornekSohbetler alanında, bilgilerle AYNI kayıt / sürüm akışıyla saklanır.
// Okuma: Firestore (kurallarda açık). Yazma: YALNIZCA /api/whatsapp-send (botBilgiKaydet /
// botBilgiGeriAl / botBilgiDene) — personelId + şifre + botBilgiYetkisi (canEdit AÇMAZ).
// Şema / doğrulama / Word dağıtma: src/botBilgiSema.js
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Save, RotateCcw, Upload, Download, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, Info, Loader2, FileText, Play, X, MessageCircle, Eye, EyeOff } from 'lucide-react'; // YENİ: örnek sohbet simgeleri
import { doc, collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db, appId } from './shared.jsx';
import { firestoreKaynagi } from './whatsappKaynak.js';
import { kaydedilmemisAyarla } from './kaydedilmemisUyari.js';
import {
  BOT_BILGI_MARKALARI, BOT_BILGI_BOLUMLERI, METIN_BOLUMLERI, BOT_BILGI_SINIRLARI, SURUM_SAYISI, WORD_SINIRI, FIYAT_NOTU,
  varsayilanBotBilgi, karakterSayisi, iceriklerEsitMi, botBilgiDogrula, htmlBloklari, wordBloklariniDagit,
  taslakBirlestir, farkliBolumler, wordDosyaAdi, icerikBosMu,
} from './botBilgiSema.js';

const YUKLEME_URL = 'https://www.sembolevdeneve.com/crm/upload.php';
const DOSYA_KOKU = 'https://www.sembolevdeneve.com/crm/uploads/';
const CIKIS_UYARISI = 'Bot Bilgileri sayfasında kaydedilmemiş değişiklikler var. Çıkarsanız kaybolacak. Devam edilsin mi?';
const ARSIV_UYARISI = 'Dosya arşive kaydedilemedi, içerik yine de aktarıldı.';

const kok = () => ['artifacts', appId, 'public', 'data'];
// Varsayılan veri kaynağı (test / önizlemede sahte kaynak verilebilir)
const botBilgiKaynagi = {
  belgeDinle: (marka, cb, hata) => onSnapshot(doc(db, ...kok(), 'bot_bilgi', marka), s => cb(s.exists() ? s.data() : null), hata),
  surumleriDinle: (marka, cb) => onSnapshot(
    query(collection(db, ...kok(), 'bot_bilgi', marka, 'surumler'), orderBy('kaydedilme', 'desc'), limit(SURUM_SAYISI)),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => cb([])),
  istek: firestoreKaynagi.istek,
  // CRM'in bugünkü yükleme yöntemi (App.jsx ile aynı okuma). Başarısızsa fırlatır.
  dosyaYukle: async (dosya, ad) => {
    const fd = new FormData();
    fd.append('file', dosya, ad);
    const ctrl = new AbortController();
    const z = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch(YUKLEME_URL, { method: 'POST', body: fd, signal: ctrl.signal });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let url = '';
      try { const j = JSON.parse(text); url = j.url || j.fileName || j.file || ''; } catch { url = text.trim(); }
      url = String(url || '').trim();
      if (!url || /<|\s/.test(url)) throw new Error('Yükleme yanıtı anlaşılamadı');
      return { url: /^https?:\/\//i.test(url) ? url : DOSYA_KOKU + url.replace(/^\/?(?:crm\/)?(?:uploads\/)?/, '') };
    } finally { clearTimeout(z); }
  },
  // Word → HTML (mammoth, yalnızca gerektiğinde yüklenir)
  wordHtml: async (dosya) => {
    const m = await import('mammoth');
    const mammoth = m.default || m;
    const r = await mammoth.convertToHtml({ arrayBuffer: await dosya.arrayBuffer() });
    return r.value || '';
  },
};

// ============================================================================
// YENİ (2026-10-10 · kullanıcı talebi): ÖRNEK SOHBETLER
// ----------------------------------------------------------------------------
// Her sohbet: { baslik, konu, metin }  metin satırları "Müşteri: …" / "Biz: …" biçiminde.
// Sınırlar botun her mesajda okuyacağı metni makul tutmak içindir.
// ============================================================================
const ORNEK_SINIR = { adet: 30, sohbet: 4000, toplam: 40000 };
const ORNEK_KONULAR = ['Genel', 'Eşya Depolama', 'Kiralık Depo', 'Nakliye', 'Fiyat sorusu', 'Pazarlık / itiraz', 'Randevu / ziyaret', 'Şikâyet'];
const bosOrnek = () => ({ baslik: '', konu: 'Genel', metin: 'Müşteri: \nBiz: ' });
const normalOrnekler = (l) => (Array.isArray(l) ? l : []).map(x => ({ baslik: x?.baslik || '', konu: x?.konu || 'Genel', metin: x?.metin || '' }));
const ornekToplam = (l) => (l || []).reduce((t, x) => t + (x.metin || '').length + (x.baslik || '').length, 0);
const ornekDogrula = (l) => {
  if ((l || []).length > ORNEK_SINIR.adet) return `En fazla ${ORNEK_SINIR.adet} örnek sohbet eklenebilir.`;
  const uzun = (l || []).findIndex(x => (x.metin || '').length > ORNEK_SINIR.sohbet);
  if (uzun >= 0) return `${uzun + 1}. örnek sohbet çok uzun (en fazla ${ORNEK_SINIR.sohbet.toLocaleString('tr-TR')} karakter).`;
  if (ornekToplam(l) > ORNEK_SINIR.toplam) return `Örnek sohbetlerin toplamı ${ORNEK_SINIR.toplam.toLocaleString('tr-TR')} karakteri aşamaz.`;
  const bos = (l || []).findIndex(x => !(x.metin || '').replace(/^(Müşteri|Biz):\s*$/gm, '').trim());
  if (bos >= 0) return `${bos + 1}. örnek sohbet boş — doldurun ya da silin.`;
  return '';
};
// Kişisel bilgileri maskeler (telefon, e-posta) — örnekler bota "öğretilir", kişisel veri taşımasın
const kisiselMaskele = (m) => String(m || '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-posta]')
  .replace(/(?:\+?90[\s-]?)?0?\(?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, '[telefon]');
// WhatsApp "Sohbeti dışa aktar" .txt → [{ ad, metin }]  (Android: "10.10.2026 14:58 - Ali: …", iOS: "[10.10.2026 14:58:12] Ali: …")
const whatsappTxtAyristir = (txt) => {
  const satirRe = /^\[?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)(?:\s?[APap][Mm])?\]?\s*(?:-\s*)?([^:]{1,60}):\s?(.*)$/;
  const mesajlar = [];
  String(txt || '').replace(/[‎‏‪-‮]/g, '').split(/\r?\n/).forEach(satir => {
    const m = satir.match(satirRe);
    if (m) mesajlar.push({ ad: m[3].trim(), metin: m[4] });
    else if (mesajlar.length && satir.trim()) mesajlar[mesajlar.length - 1].metin += `\n${satir}`;
  });
  const atla = /^<?(medya dahil edilmedi|media omitted|bu mesaj silindi|this message was deleted|görüntü dahil edilmedi|image omitted|video omitted|ses dahil edilmedi|audio omitted)>?$/i;
  return mesajlar.filter(x => x.metin.trim() && !atla.test(x.metin.trim()));
};

const bosIcerik = () => ({ bolumler: Object.fromEntries(METIN_BOLUMLERI.map(id => [id, ''])), sss: [], ornekSohbetler: [] });
// DEĞİŞTİ (2026-10-10): ornekSohbetler alanı korunur
const normalIcerik = (ic) => ({ bolumler: { ...bosIcerik().bolumler, ...(ic?.bolumler || {}) }, sss: (ic?.sss || []).map(x => ({ soru: x.soru || '', cevap: x.cevap || '' })), ornekSohbetler: normalOrnekler(ic?.ornekSohbetler) });
const tarihMetni = (iso) => { const t = new Date(iso || ''); return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }); };
const baslikBul = (id) => BOT_BILGI_BOLUMLERI.find(b => b.id === id)?.baslik || id;
function kaynakEtiketi(k = {}) {
  if (k.tur === 'word') return `Word: ${k.dosyaAdi || 'dosya'}`;
  if (k.tur === 'geriAl') return `Geri alındı (${tarihMetni(k.geriAlinanTarih) || 'eski sürüm'})`;
  return 'Elle';
}
const SECIM_ETIKETI = { degistir: 'Değiştir', ekle: 'Ekle', yoksay: 'Yoksay' };

// Marka değişince sayfa baştan kurulur (key) — taslak / Word / deneme durumu markalar arasında taşınmaz
export function BotBilgileriView({ currentUser, addSystemLog, kaynak = botBilgiKaynagi }) {
  const [marka, setMarka] = useState('depoevim');
  return <BotBilgileriSayfasi key={marka} marka={marka} setMarka={setMarka} currentUser={currentUser} addSystemLog={addSystemLog} kaynak={kaynak} />;
}

function BotBilgileriSayfasi({ marka, setMarka, currentUser, addSystemLog, kaynak }) {
  const [kayit, setKayit] = useState(undefined); // undefined: yükleniyor · null: hiç kaydedilmemiş
  const [okumaHatasi, setOkumaHatasi] = useState('');
  const [surumler, setSurumler] = useState([]);
  const [taban, setTaban] = useState(null); // { icerik, surumId } — taslağın çıktığı kayıt
  const [taslak, setTaslak] = useState(null);
  const [kaynakBilgisi, setKaynakBilgisi] = useState({ tur: 'elle' });
  const [word, setWord] = useState(null); // { gelen, secimler, farklar, dosyaAdi, url, arsivHatasi }
  const [isleniyor, setIsleniyor] = useState('');
  const [bildirim, setBildirim] = useState(null); // { tur: 'ok' | 'hata' | 'uyari', metin }
  const [dene, setDene] = useState({ soru: '', kaynak: 'kayitli', sonuc: null, hata: '' });
  const kimlik = { personelId: currentUser?.id, sifre: currentUser?.password };

  // DEĞİŞTİ (2026-10-10): örnek sohbet değişiklikleri de "kaydedilmemiş" sayılır (şema karşılaştırması bu alanı bilmez)
  const ornekKirli = !!(taslak && taban && JSON.stringify(normalOrnekler(taslak.ornekSohbetler)) !== JSON.stringify(normalOrnekler(taban.icerik?.ornekSohbetler)));
  const kirli = !!(taslak && taban && !iceriklerEsitMi(taslak, taban.icerik)) || ornekKirli || !!word;
  const kirliRef = useRef(kirli);
  const kayitRef = useRef(kayit);
  useEffect(() => { kirliRef.current = kirli; kayitRef.current = kayit; });
  const zorlaRef = useRef(null); // geri alma / kaydetme sonrası bu surumId gelince taslak sıfırlanır

  const sifirla = (k) => {
    const icerik = normalIcerik(k?.icerik || varsayilanBotBilgi(marka));
    setTaban({ icerik, surumId: k?.surumId || null });
    setTaslak(normalIcerik(icerik));
    setKaynakBilgisi({ tur: 'elle' });
  };

  // ---- canlı okuma
  useEffect(() => {
    const u1 = kaynak.belgeDinle(marka, setKayit, (e) => { setOkumaHatasi(e?.message || 'okunamadı'); setKayit(null); });
    const u2 = kaynak.surumleriDinle(marka, setSurumler);
    return () => { u1?.(); u2?.(); };
  }, [marka, kaynak]);
  useEffect(() => {
    if (kayit === undefined) return;
    const hedef = zorlaRef.current && kayit?.surumId === zorlaRef.current;
    if (hedef) zorlaRef.current = null;
    if (!kirliRef.current || hedef) sifirla(kayit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kayit]);
  const uzaktaDegisti = !!(kayit !== undefined && taban && (kayit?.surumId || null) !== taban.surumId);

  // ---- kaydedilmemiş değişiklik koruması (menü değişimi: App.jsx · sekme kapatma: beforeunload)
  useEffect(() => {
    if (!kirli) { kaydedilmemisAyarla(null); return undefined; }
    kaydedilmemisAyarla(CIKIS_UYARISI);
    const dinle = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', dinle);
    return () => { window.removeEventListener('beforeunload', dinle); kaydedilmemisAyarla(null); };
  }, [kirli]);

  // DEĞİŞTİ (2026-10-10): örnek sohbet sınırları da kontrol edilir
  const dogrulama = useMemo(() => {
    if (!taslak) return { ok: true };
    const d = botBilgiDogrula(taslak);
    if (!d.ok) return d;
    const h = ornekDogrula(taslak.ornekSohbetler);
    return h ? { ok: false, hata: h } : d;
  }, [taslak]);
  const toplam = taslak ? karakterSayisi(taslak) : 0;
  const S = BOT_BILGI_SINIRLARI;

  // ---- düzenleme
  const bolumYaz = (id, v) => setTaslak(t => ({ ...t, bolumler: { ...t.bolumler, [id]: v } }));
  const sssYaz = (i, alan, v) => setTaslak(t => ({ ...t, sss: t.sss.map((x, j) => (j === i ? { ...x, [alan]: v } : x)) }));
  const sssEkle = () => setTaslak(t => ({ ...t, sss: [...t.sss, { soru: '', cevap: '' }] }));
  const sssSil = (i) => setTaslak(t => ({ ...t, sss: t.sss.filter((_, j) => j !== i) }));
  const sssTasi = (i, yon) => setTaslak(t => {
    const j = i + yon;
    if (j < 0 || j >= t.sss.length) return t;
    const s = [...t.sss]; [s[i], s[j]] = [s[j], s[i]];
    return { ...t, sss: s };
  });

  // ---- YENİ (2026-10-10): örnek sohbet düzenleme
  const [ornekOnizle, setOrnekOnizle] = useState({});        // { index: true } — balon önizlemesi açık olanlar
  const [waAktar, setWaAktar] = useState(null);              // { dosyaAdi, mesajlar, adlar, biz: Set }
  const ornekler = taslak?.ornekSohbetler || [];
  const ornekYaz = (i, alan, v) => setTaslak(t => ({ ...t, ornekSohbetler: t.ornekSohbetler.map((x, j) => (j === i ? { ...x, [alan]: v } : x)) }));
  const ornekEkle = (yeni = bosOrnek()) => setTaslak(t => ({ ...t, ornekSohbetler: [...(t.ornekSohbetler || []), yeni] }));
  const ornekSil = (i) => { if (window.confirm('Bu örnek sohbet silinsin mi?')) setTaslak(t => ({ ...t, ornekSohbetler: t.ornekSohbetler.filter((_, j) => j !== i) })); };
  const ornekTasi = (i, yon) => setTaslak(t => {
    const j = i + yon; const l = [...t.ornekSohbetler];
    if (j < 0 || j >= l.length) return t;
    [l[i], l[j]] = [l[j], l[i]];
    return { ...t, ornekSohbetler: l };
  });
  // WhatsApp dışa aktarım dosyası seçildi → konuşanları göster, "Biz" kim seçtir
  async function waDosyaSec(e) {
    const dosya = e.target.files?.[0];
    e.target.value = '';
    if (!dosya) return;
    if (!/\.txt$/i.test(dosya.name)) { setBildirim({ tur: 'hata', metin: 'WhatsApp\'ta sohbette "Sohbeti dışa aktar → Medyasız" deyin; gelen .txt dosyasını seçin.' }); return; }
    if (dosya.size > 2 * 1024 * 1024) { setBildirim({ tur: 'hata', metin: 'Dosya 2 MB\'tan büyük olamaz.' }); return; }
    const mesajlar = whatsappTxtAyristir(await dosya.text());
    if (!mesajlar.length) { setBildirim({ tur: 'hata', metin: 'Dosyada mesaj bulunamadı. WhatsApp\'tan "Sohbeti dışa aktar" ile alınmış .txt dosyası olmalı.' }); return; }
    const adlar = [...new Set(mesajlar.map(m => m.ad))];
    // Şirket adı geçen konuşmacı (Sembol / DepoEvim) varsayılan olarak "Biz" seçilir
    const biz = new Set(adlar.filter(a => /sembol|depoevim|depo evim/i.test(a)));
    setWaAktar({ dosyaAdi: dosya.name, mesajlar, adlar, biz });
  }
  function waUygula() {
    if (!waAktar?.biz?.size) return;
    // Arka arkaya aynı tarafın mesajları tek satırda birleşir; telefon / e-posta maskelenir
    const satirlar = [];
    waAktar.mesajlar.forEach(m => {
      const rol = waAktar.biz.has(m.ad) ? 'Biz' : 'Müşteri';
      const metin = kisiselMaskele(m.metin).replace(/\s*\n\s*/g, ' ').trim();
      if (satirlar.length && satirlar[satirlar.length - 1].rol === rol) satirlar[satirlar.length - 1].metin += ` ${metin}`;
      else satirlar.push({ rol, metin });
    });
    let metin = satirlar.map(x => `${x.rol}: ${x.metin}`).join('\n');
    if (metin.length > ORNEK_SINIR.sohbet) metin = `${metin.slice(0, ORNEK_SINIR.sohbet - 40).replace(/\n[^\n]*$/, '')}\n… (sohbet kısaltıldı)`;
    ornekEkle({ baslik: waAktar.dosyaAdi.replace(/\.txt$/i, '').replace(/^WhatsApp (Chat with|Sohbeti) /i, '').slice(0, 80) || 'WhatsApp sohbeti', konu: 'Genel', metin });
    setBildirim({ tur: 'ok', metin: 'Sohbet örneklere eklendi (telefon / e-posta maskelendi). Gözden geçirin; bota yansıması için Kaydet\'e basın.' });
    setWaAktar(null);
  }

  // ---- sunucu işlemleri
  async function kaydet() {
    if (!dogrulama.ok || !kirli || word) return;
    setIsleniyor('kaydet'); setBildirim(null);
    const r = await kaynak.istek({ islem: 'botBilgiKaydet', marka, icerik: taslak, tabanSurum: taban?.surumId || null, kaynak: kaynakBilgisi, ...kimlik });
    setIsleniyor('');
    if (!r.ok) { setBildirim({ tur: 'hata', metin: r.hata || 'Kaydedilemedi.' }); return; }
    zorlaRef.current = r.surumId;
    if (kayitRef.current?.surumId === r.surumId) { zorlaRef.current = null; sifirla(kayitRef.current); }
    else { setTaban({ icerik: normalIcerik(taslak), surumId: r.surumId }); setKaynakBilgisi({ tur: 'elle' }); }
    addSystemLog?.('Bot Bilgileri', `${BOT_BILGI_MARKALARI.find(m => m.id === marka)?.ad} bot bilgileri kaydedildi (${kaynakEtiketi(kaynakBilgisi)}).`);
    setBildirim({ tur: 'ok', metin: 'Kaydedildi. En geç 1 dakika içinde bota yansır.' });
  }

  async function geriAl(s) {
    const soru = kirli
      ? `Ekrandaki kaydedilmemiş değişiklikler silinecek ve ${tarihMetni(s.kaydedilme)} tarihli sürüm geri yüklenecek. Devam edilsin mi?`
      : `${tarihMetni(s.kaydedilme)} tarihli sürüm geri yüklensin mi? (Yeni bir sürüm olarak kaydedilir.)`;
    if (!window.confirm(soru)) return;
    setIsleniyor('geriAl'); setBildirim(null);
    const r = await kaynak.istek({ islem: 'botBilgiGeriAl', marka, surumId: s.id, tabanSurum: kayitRef.current?.surumId || null, ...kimlik });
    setIsleniyor('');
    if (!r.ok) { setBildirim({ tur: 'hata', metin: r.hata || 'Geri alınamadı.' }); return; }
    setWord(null);
    zorlaRef.current = r.surumId;
    if (kayitRef.current?.surumId === r.surumId) { zorlaRef.current = null; sifirla(kayitRef.current); }
    addSystemLog?.('Bot Bilgileri', `Bot bilgileri ${tarihMetni(s.kaydedilme)} tarihli sürüme geri alındı.`);
    setBildirim({ tur: 'ok', metin: 'Sürüm geri yüklendi. En geç 1 dakika içinde bota yansır.' });
  }

  async function deneCalistir() {
    if (!dene.soru.trim()) return;
    if (dene.kaynak === 'taslak' && !dogrulama.ok) { setDene(d => ({ ...d, hata: dogrulama.hata, sonuc: null })); return; }
    setIsleniyor('dene'); setDene(d => ({ ...d, sonuc: null, hata: '' }));
    const r = await kaynak.istek({ islem: 'botBilgiDene', marka, soru: dene.soru.trim(), kaynak: dene.kaynak, ...(dene.kaynak === 'taslak' ? { icerik: taslak } : {}), ...kimlik });
    setIsleniyor('');
    setDene(d => (r.ok ? { ...d, sonuc: r } : { ...d, hata: r.hata || 'Deneme başarısız.' }));
  }

  // ---- Word'den içe aktar
  async function wordSec(e) {
    const dosya = e.target.files?.[0];
    e.target.value = '';
    if (!dosya) return;
    setBildirim(null);
    if (!/\.docx$/i.test(dosya.name)) { setBildirim({ tur: 'hata', metin: 'Yalnızca .docx dosyası yüklenebilir (eski .doc için Word\'de "Farklı Kaydet → Word Belgesi (.docx)").' }); return; }
    if (dosya.size > WORD_SINIRI) { setBildirim({ tur: 'hata', metin: 'Dosya 5 MB\'tan büyük olamaz.' }); return; }
    setIsleniyor('word');
    // Arşive yükleme ve metin çıkarma birlikte; yükleme hatası içe aktarmayı DURDURMAZ
    const [html, yukleme] = await Promise.all([
      kaynak.wordHtml(dosya).catch(() => null),
      kaynak.dosyaYukle(dosya, wordDosyaAdi(marka)).catch(err => { console.warn('[bot-bilgi] Word arşive yüklenemedi', err?.message); return null; }),
    ]);
    setIsleniyor('');
    if (html === null) { setBildirim({ tur: 'hata', metin: 'Word dosyası okunamadı. Dosyanın bozuk olmadığından ve .docx olduğundan emin olun.' }); return; }
    const gelen = wordBloklariniDagit(htmlBloklari(html));
    if (icerikBosMu(gelen)) { setBildirim({ tur: 'hata', metin: 'Dosyada aktarılacak metin bulunamadı.' }); return; }
    const farklar = farkliBolumler(taslak, gelen);
    if (!farklar.length) { setBildirim({ tur: 'uyari', metin: `Word dosyasındaki bilgiler mevcut içerikle aynı; değişiklik yok.${yukleme?.url ? '' : ` ${ARSIV_UYARISI}`}` }); return; }
    setWord({ gelen, farklar, secimler: Object.fromEntries(farklar.map(id => [id, 'degistir'])), dosyaAdi: dosya.name, url: yukleme?.url || '', arsivHatasi: !yukleme?.url });
  }
  function wordUygula() {
    setTaslak(t => normalIcerik(taslakBirlestir(t, word.gelen, word.secimler)));
    const uygulanan = Object.values(word.secimler).some(s => s !== 'yoksay');
    if (uygulanan) setKaynakBilgisi({ tur: 'word', dosyaAdi: word.dosyaAdi, ...(word.url ? { url: word.url } : {}) });
    setBildirim({ tur: word.arsivHatasi ? 'uyari' : 'ok', metin: `${uygulanan ? 'Word içeriği taslağa aktarıldı. Bota yansıması için Kaydet\'e basın.' : 'Hiçbir bölüm aktarılmadı.'}${word.arsivHatasi ? ` ${ARSIV_UYARISI}` : ''}` });
    setWord(null);
  }

  // ------------------------------------------------------------------ GÖRÜNÜM
  const yukleniyor = kayit === undefined || !taslak;
  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24">
      {/* Başlık */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0"><Bot className="w-6 h-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-black">Bot Bilgileri</h2>
            <p className="text-xs font-bold text-neutral-500">WhatsApp botunun müşterilere anlatacağı bilgiler. Kaydedince en geç 1 dakika içinde bota yansır.</p>
          </div>
          <div className="flex gap-1.5">
            {BOT_BILGI_MARKALARI.map(m => (
              <button key={m.id} type="button" disabled={!m.aktif || isleniyor} onClick={() => { if (m.id !== marka && (!kirli || window.confirm(CIKIS_UYARISI))) setMarka(m.id); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border ${m.id === marka ? 'bg-black text-white border-black' : 'border-neutral-200 text-neutral-600'} disabled:opacity-40`}
                title={m.aktif ? '' : 'Yakında'}>{m.ad}{m.aktif ? '' : ' (yakında)'}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-[12px] font-bold">
          <p className="flex gap-2 items-start text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><Info className="w-4 h-4 shrink-0 mt-0.5" />{FIYAT_NOTU}</p>
          <p className="flex gap-2 items-start text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2"><Info className="w-4 h-4 shrink-0 mt-0.5" />
            Temel kurallar (KVKK bilgilendirmesi, personele devir, hizmet reddi koruması, 81 ilden alım, taşıma talebi akışı, günlük mesaj sınırı, "+KDV") kodda sabittir; bu sayfadan değiştirilemez.</p>
        </div>
      </div>

      {okumaHatasi && <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">Bilgiler okunamadı: {okumaHatasi}</p>}
      {yukleniyor && !okumaHatasi && <p className="p-6 text-center text-sm font-bold text-neutral-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Yükleniyor…</p>}

      {!yukleniyor && (<>
        {/* Durum / araç çubuğu (yapışkan) */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur rounded-2xl border border-neutral-200 p-3 shadow-sm flex items-center gap-2 flex-wrap">
          <div className="text-[12px] font-bold text-neutral-600 min-w-0 flex-1">
            {kayit ? <>Son kayıt: <b className="text-black">{kayit.kaydeden?.ad || '—'}</b> · {tarihMetni(kayit.kaydedilme)} · {kaynakEtiketi(kayit.kaynak)}</>
              : <span className="text-amber-700">Henüz kaydedilmedi — bot şu an aşağıdaki ilk bilgileri (koddaki yedek) kullanıyor.</span>}
            <span className={`ml-2 ${toplam > S.toplam ? 'text-red-600' : toplam > S.toplam * 0.9 ? 'text-amber-600' : 'text-neutral-400'}`}>· {toplam.toLocaleString('tr-TR')} / {S.toplam.toLocaleString('tr-TR')} karakter</span>
            {kirli && <span className="ml-2 text-red-600">· Kaydedilmemiş değişiklik var</span>}
          </div>
          <a href="/bot-bilgi-sablonu.docx" download className="px-3 py-2 rounded-lg text-xs font-black border border-neutral-200 hover:bg-neutral-50 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Word şablonu</a>
          <label className={`px-3 py-2 rounded-lg text-xs font-black border border-neutral-200 flex items-center gap-1 ${isleniyor || word ? 'opacity-50 pointer-events-none' : 'hover:bg-neutral-50 cursor-pointer'}`}>
            {isleniyor === 'word' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Word'den içe aktar
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={wordSec} />
          </label>
          {kirli && !word && <button type="button" disabled={!!isleniyor} onClick={() => { if (window.confirm('Kaydedilmemiş değişiklikler silinsin mi?')) sifirla(kayit); }}
            className="px-3 py-2 rounded-lg text-xs font-black border border-neutral-200 hover:bg-neutral-50 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Vazgeç</button>}
          <button type="button" onClick={kaydet} disabled={!kirli || !!word || !dogrulama.ok || !!isleniyor}
            className="px-4 py-2 rounded-lg text-xs font-black bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 disabled:opacity-40">
            {isleniyor === 'kaydet' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Kaydet</button>
        </div>

        {bildirim && (
          <p className={`rounded-xl px-4 py-3 text-sm font-bold flex gap-2 items-start border ${bildirim.tur === 'hata' ? 'bg-red-50 border-red-200 text-red-700' : bildirim.tur === 'uyari' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            {bildirim.tur === 'ok' ? <Info className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="flex-1">{bildirim.metin}</span>
            <button type="button" onClick={() => setBildirim(null)}><X className="w-4 h-4" /></button>
          </p>
        )}
        {uzaktaDegisti && kirli && (
          <p className="rounded-xl px-4 py-3 text-sm font-bold bg-amber-50 border border-amber-200 text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Siz düzenlerken başka bir yönetici bilgileri kaydetti ({kayit?.kaydeden?.ad || '—'}, {tarihMetni(kayit?.kaydedilme)}). Kaydetmeden önce sayfayı yenileyip değişikliklerinizi yeniden uygulayın.</p>
        )}
        {!dogrulama.ok && <p className="rounded-xl px-4 py-3 text-sm font-bold bg-red-50 border border-red-200 text-red-700">{dogrulama.hata}</p>}

        {/* Word taslağı: mevcut / Word'den gelen */}
        {word && (
          <div className="bg-white rounded-2xl border-2 border-blue-300 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="font-black text-black text-sm flex-1 min-w-0 truncate">Word'den gelen taslak — {word.dosyaAdi}</h3>
              <button type="button" onClick={() => setWord(null)} className="px-3 py-1.5 rounded-lg text-xs font-black border border-neutral-200 hover:bg-neutral-50">İptal</button>
              <button type="button" onClick={wordUygula} className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white">Seçimleri taslağa uygula</button>
            </div>
            {word.arsivHatasi && <p className="text-[12px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{ARSIV_UYARISI} Sürüme yalnızca dosya adı yazılacak.</p>}
            <p className="text-[12px] font-bold text-neutral-500">Yalnızca farklı olan bölümler listelenir. Her bölüm için seçin; taslağa uyguladıktan sonra da Kaydet'e basmadan bota yansımaz.</p>
            {word.farklar.map(id => {
              const sssMi = id === 'sss';
              const mevcut = sssMi ? (taslak.sss || []).map(x => `S: ${x.soru}\nC: ${x.cevap}`).join('\n') : taslak.bolumler[id];
              const gelen = sssMi ? word.gelen.sss.map(x => `S: ${x.soru}\nC: ${x.cevap}`).join('\n') : word.gelen.bolumler[id];
              return (
                <div key={id} className="border border-neutral-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <p className="font-black text-sm text-black flex-1">{baslikBul(id)}{sssMi ? ` (${word.gelen.sss.length} soru)` : ''}</p>
                    {Object.entries(SECIM_ETIKETI).map(([s, ad]) => (
                      <button key={s} type="button" onClick={() => setWord(w => ({ ...w, secimler: { ...w.secimler, [id]: s } }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${word.secimler[id] === s ? 'bg-blue-600 text-white border-blue-600' : 'border-neutral-200 text-neutral-600'}`}>{ad}</button>
                    ))}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div><p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Mevcut</p>
                      <pre className="whitespace-pre-wrap break-words text-[12px] bg-neutral-50 rounded-lg p-2 max-h-48 overflow-auto font-sans">{mevcut || '—'}</pre></div>
                    <div><p className="text-[10px] font-black text-blue-500 uppercase mb-1">Word'den gelen</p>
                      <pre className="whitespace-pre-wrap break-words text-[12px] bg-blue-50 rounded-lg p-2 max-h-48 overflow-auto font-sans">{gelen}</pre></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bölümler */}
        <fieldset disabled={!!word || isleniyor === 'kaydet' || isleniyor === 'geriAl'} className="space-y-3 disabled:opacity-60">
          {BOT_BILGI_BOLUMLERI.map(b => (b.liste ? (
            <div key={b.id} className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-black text-sm text-black flex-1">{b.baslik} <span className="text-[11px] font-bold text-neutral-400">({taslak.sss.length} / {S.sssAdet})</span></h3>
                <button type="button" onClick={sssEkle} disabled={taslak.sss.length >= S.sssAdet} className="px-2.5 py-1.5 rounded-lg text-xs font-black border border-neutral-200 hover:bg-neutral-50 flex items-center gap-1 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /> Soru ekle</button>
              </div>
              {!taslak.sss.length && <p className="text-[12px] font-bold text-neutral-400">Henüz soru yok.</p>}
              <div className="space-y-2">
                {taslak.sss.map((x, i) => (
                  <div key={i} className="border border-neutral-200 rounded-xl p-2.5 flex gap-2">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <input value={x.soru} maxLength={S.soru} onChange={e => sssYaz(i, 'soru', e.target.value)} placeholder="Soru"
                        className="w-full border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm font-bold" />
                      <textarea value={x.cevap} maxLength={S.cevap} onChange={e => sssYaz(i, 'cevap', e.target.value)} placeholder="Cevap" rows={2}
                        className="w-full border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => sssTasi(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30" title="Yukarı"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => sssTasi(i, 1)} disabled={i === taslak.sss.length - 1} className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30" title="Aşağı"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => sssSil(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Sil"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key={b.id} className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
              <div className="flex items-baseline gap-2 mb-1.5">
                <h3 className="font-black text-sm text-black flex-1">{b.baslik}</h3>
                <span className={`text-[11px] font-bold ${taslak.bolumler[b.id].length > S.bolum ? 'text-red-600' : 'text-neutral-400'}`}>{taslak.bolumler[b.id].length} / {S.bolum}</span>
              </div>
              <p className="text-[11px] font-bold text-neutral-400 mb-1.5">{b.ipucu}</p>
              <textarea value={taslak.bolumler[b.id]} onChange={e => bolumYaz(b.id, e.target.value)} rows={Math.min(14, Math.max(3, taslak.bolumler[b.id].split('\n').length + 1))}
                className={`w-full border rounded-lg px-3 py-2 text-sm leading-relaxed ${b.id === 'asla' ? 'border-red-200 bg-red-50/30' : 'border-neutral-200'}`} />
            </div>
          )))}
        </fieldset>

        {/* ==================================================================
            YENİ (2026-10-10 · kullanıcı talebi): ÖRNEK SOHBETLER (markaya özel)
            ================================================================== */}
        <fieldset disabled={!!word || isleniyor === 'kaydet' || isleniyor === 'geriAl'} className="disabled:opacity-60">
          <div className="bg-white rounded-2xl border-2 border-green-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <MessageCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-black text-sm text-black flex-1 min-w-0">
                Örnek Sohbetler — {BOT_BILGI_MARKALARI.find(m => m.id === marka)?.ad}
                <span className="ml-1 text-[11px] font-bold text-neutral-400">({ornekler.length} / {ORNEK_SINIR.adet} · {ornekToplam(ornekler).toLocaleString('tr-TR')} / {ORNEK_SINIR.toplam.toLocaleString('tr-TR')} karakter)</span>
              </h3>
              <label className={`px-2.5 py-1.5 rounded-lg text-xs font-black border border-green-300 text-green-800 flex items-center gap-1 ${ornekler.length >= ORNEK_SINIR.adet ? 'opacity-40 pointer-events-none' : 'hover:bg-green-50 cursor-pointer'}`}>
                <Upload className="w-3.5 h-3.5" /> WhatsApp'tan aktar (.txt)
                <input type="file" accept=".txt,text/plain" className="hidden" onChange={waDosyaSec} />
              </label>
              <button type="button" onClick={() => ornekEkle()} disabled={ornekler.length >= ORNEK_SINIR.adet}
                className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /> Sohbet ekle</button>
            </div>
            <p className="text-[12px] font-bold text-neutral-500 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              Gerçek müşteri konuşmalarından iyi örnekler ekleyin. Bot yeni müşterilere cevap verirken bu sohbetlerdeki <b>üslubu, soru sırasını ve cevap biçimini</b> örnek alır.
              Her satırı <b>"Müşteri:"</b> ya da <b>"Biz:"</b> ile başlatın. Fiyat rakamları yine Fiyat Tablosu'ndan gelir; telefon / e-posta otomatik maskelenir.
              Bu marka için ayrıdır{marka !== 'sembol' ? ' — Sembol açıldığında kendi sayfasında ayrı örnekler girilir' : ''}.
            </p>

            {/* WhatsApp .txt aktarımı — "Biz" kim? */}
            {waAktar && (
              <div className="border-2 border-blue-300 rounded-xl p-3 space-y-2 bg-blue-50/40">
                <p className="text-sm font-black text-black">{waAktar.dosyaAdi} — {waAktar.mesajlar.length} mesaj</p>
                <p className="text-[12px] font-bold text-neutral-600">Bu sohbette <b>şirket adına</b> yazanları işaretleyin (geri kalanlar "Müşteri" olur):</p>
                <div className="flex flex-wrap gap-1.5">
                  {waAktar.adlar.map(ad => {
                    const secili = waAktar.biz.has(ad);
                    return (
                      <button key={ad} type="button" onClick={() => setWaAktar(w => { const b = new Set(w.biz); if (b.has(ad)) b.delete(ad); else b.add(ad); return { ...w, biz: b }; })}
                        className={`px-2.5 py-1 rounded-lg text-[12px] font-black border ${secili ? 'bg-green-600 text-white border-green-600' : 'bg-white text-neutral-700 border-neutral-300'}`}>
                        {kisiselMaskele(ad)} {secili ? '· Biz' : '· Müşteri'}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setWaAktar(null)} className="px-3 py-1.5 rounded-lg text-xs font-black border border-neutral-200 bg-white">İptal</button>
                  <button type="button" onClick={waUygula} disabled={!waAktar.biz.size} className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40">Örneklere ekle</button>
                </div>
              </div>
            )}

            {!ornekler.length && !waAktar && <p className="text-[12px] font-bold text-neutral-400">Henüz örnek sohbet yok.</p>}
            <div className="space-y-2.5">
              {ornekler.map((x, i) => {
                const satirlar = (x.metin || '').split('\n').filter(l => l.trim());
                return (
                  <div key={i} className="border border-neutral-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-white bg-green-600 rounded-md px-1.5 py-0.5">{i + 1}</span>
                      <input value={x.baslik} maxLength={80} onChange={e => ornekYaz(i, 'baslik', e.target.value)} placeholder="Başlık (ör. 2+1 depolama — fiyat sorusu)"
                        className="flex-1 min-w-[180px] border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm font-bold" />
                      <select value={x.konu} onChange={e => ornekYaz(i, 'konu', e.target.value)} className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs font-black bg-white">
                        {ORNEK_KONULAR.map(k => <option key={k}>{k}</option>)}
                      </select>
                      <button type="button" onClick={() => setOrnekOnizle(o => ({ ...o, [i]: !o[i] }))} className="p-1.5 rounded-lg hover:bg-neutral-100" title={ornekOnizle[i] ? 'Düzenle' : 'Önizle'}>
                        {ornekOnizle[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      <button type="button" onClick={() => ornekTasi(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30" title="Yukarı"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => ornekTasi(i, 1)} disabled={i === ornekler.length - 1} className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30" title="Aşağı"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => ornekSil(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Sil"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {ornekOnizle[i] ? (
                      /* Balon önizlemesi — WhatsApp görünümü */
                      <div className="bg-[#efeae2] rounded-lg p-2.5 space-y-1.5 max-h-80 overflow-y-auto">
                        {satirlar.map((l, j) => {
                          const biz = /^Biz\s*:/i.test(l);
                          const metin = l.replace(/^(Müşteri|Biz)\s*:\s*/i, '');
                          return (
                            <div key={j} className={`flex ${biz ? 'justify-end' : 'justify-start'}`}>
                              <p className={`max-w-[80%] rounded-xl px-2.5 py-1.5 text-[13px] shadow-sm whitespace-pre-wrap ${biz ? 'bg-[#d9fdd3]' : 'bg-white'}`}>{metin}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea value={x.metin} onChange={e => ornekYaz(i, 'metin', e.target.value)} rows={Math.min(14, Math.max(4, (x.metin || '').split('\n').length + 1))}
                        placeholder={'Müşteri: Merhaba, 2+1 evimi depolatmak istiyorum\nBiz: Merhaba, memnuniyetle yardımcı olalım. Eşyalarınız şu an hangi ilçede?'}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm leading-relaxed font-mono" />
                    )}
                    <p className={`text-[11px] font-bold text-right ${(x.metin || '').length > ORNEK_SINIR.sohbet ? 'text-red-600' : 'text-neutral-400'}`}>
                      {satirlar.filter(l => /^Müşteri\s*:/i.test(l)).length} müşteri · {satirlar.filter(l => /^Biz\s*:/i.test(l)).length} biz mesajı · {(x.metin || '').length.toLocaleString('tr-TR')} / {ORNEK_SINIR.sohbet.toLocaleString('tr-TR')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </fieldset>

        {/* Dene */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm space-y-2">
          <h3 className="font-black text-sm text-black flex items-center gap-2"><Play className="w-4 h-4 text-green-600" /> Dene</h3>
          <p className="text-[12px] font-bold text-neutral-500">Bir müşteri sorusu yazın; botun nasıl cevap vereceğini görün. Müşteriye hiçbir şey gönderilmez, konuşma / lead / günlük sayaç etkilenmez. (Denemede fiyat hesaplanmaz.)</p>
          <textarea value={dene.soru} maxLength={1000} onChange={e => setDene(d => ({ ...d, soru: e.target.value }))} rows={2} placeholder="Ör. Kartal şubesine hafta sonu gidebilir miyim?"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex items-center gap-3 flex-wrap text-[12px] font-bold">
            <label className="flex items-center gap-1"><input type="radio" checked={dene.kaynak === 'kayitli'} onChange={() => setDene(d => ({ ...d, kaynak: 'kayitli' }))} /> Kayıtlı bilgilerle</label>
            <label className="flex items-center gap-1"><input type="radio" checked={dene.kaynak === 'taslak'} onChange={() => setDene(d => ({ ...d, kaynak: 'taslak' }))} /> Ekrandaki taslakla{kirli ? ' (kaydedilmemiş)' : ''}</label>
            <button type="button" onClick={deneCalistir} disabled={!dene.soru.trim() || !!isleniyor} className="ml-auto px-4 py-2 rounded-lg text-xs font-black bg-black text-white flex items-center gap-1 disabled:opacity-40">
              {isleniyor === 'dene' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Dene</button>
          </div>
          {dene.hata && <p className="text-sm font-bold text-red-600">{dene.hata}</p>}
          {dene.sonuc && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-1.5">
              <p className="text-[11px] font-black text-green-800 uppercase">Botun cevabı · {({ kayitli: 'kayıtlı bilgiler', taslak: 'ekrandaki taslak', yedek: 'koddaki yedek bilgiler (kayıt yok)' })[dene.sonuc.bilgiKaynagi] || ''}</p>
              <p className="text-sm whitespace-pre-wrap text-neutral-900">{dene.sonuc.cevap}</p>
              <p className="text-[11px] font-bold text-neutral-500">Niyet: {dene.sonuc.intent || '—'}{dene.sonuc.handoff ? ` · Personele aktarırdı (${dene.sonuc.handoffType || 'bildir'}${dene.sonuc.handoffReason ? `: ${dene.sonuc.handoffReason}` : ''})` : ''}</p>
              {dene.sonuc.uyari && <p className="text-[12px] font-bold text-amber-800">{dene.sonuc.uyari}</p>}
            </div>
          )}
        </div>

        {/* Sürümler */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="font-black text-sm text-black mb-2">Önceki sürümler <span className="text-[11px] font-bold text-neutral-400">(son {SURUM_SAYISI})</span></h3>
          {!surumler.length && <p className="text-[12px] font-bold text-neutral-400">Henüz sürüm yok.</p>}
          <div className="divide-y divide-neutral-100">
            {surumler.map(s => {
              const guncel = s.id === kayit?.surumId;
              return (
                <div key={s.id} className="py-2 flex items-center gap-2 flex-wrap text-[12px] font-bold">
                  <span className="text-neutral-900">{tarihMetni(s.kaydedilme)}</span>
                  <span className="text-neutral-500">· {s.kaydeden?.ad || '—'}</span>
                  <span className="text-neutral-500 min-w-0 truncate">· {kaynakEtiketi(s.kaynak)}</span>
                  {s.kaynak?.url && <a href={s.kaynak.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5"><Download className="w-3 h-3" /> dosyayı indir</a>}
                  <span className="text-neutral-400">· {Number(s.toplam || 0).toLocaleString('tr-TR')} karakter</span>
                  <span className="ml-auto" />
                  {guncel ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-600 text-white">Güncel</span>
                    : <button type="button" onClick={() => geriAl(s)} disabled={!!isleniyor} className="px-2.5 py-1 rounded-lg text-[11px] font-black border border-neutral-200 hover:bg-neutral-50 flex items-center gap-1 disabled:opacity-40">
                      <RotateCcw className="w-3 h-3" /> Bu sürüme geri dön</button>}
                </div>
              );
            })}
          </div>
        </div>
      </>)}
    </div>
  );
}
