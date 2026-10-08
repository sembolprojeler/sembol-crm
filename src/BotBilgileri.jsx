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
// Okuma: Firestore (kurallarda açık). Yazma: YALNIZCA /api/whatsapp-send (botBilgiKaydet /
// botBilgiGeriAl / botBilgiDene) — personelId + şifre + botBilgiYetkisi (canEdit AÇMAZ).
// Şema / doğrulama / Word dağıtma: src/botBilgiSema.js
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Save, RotateCcw, Upload, Download, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, Info, Loader2, FileText, Play, X } from 'lucide-react';
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

const bosIcerik = () => ({ bolumler: Object.fromEntries(METIN_BOLUMLERI.map(id => [id, ''])), sss: [] });
const normalIcerik = (ic) => ({ bolumler: { ...bosIcerik().bolumler, ...(ic?.bolumler || {}) }, sss: (ic?.sss || []).map(x => ({ soru: x.soru || '', cevap: x.cevap || '' })) });
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

  const kirli = !!(taslak && taban && !iceriklerEsitMi(taslak, taban.icerik)) || !!word;
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

  const dogrulama = useMemo(() => (taslak ? botBilgiDogrula(taslak) : { ok: true }), [taslak]);
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
